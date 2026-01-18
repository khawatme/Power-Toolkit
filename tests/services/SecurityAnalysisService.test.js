/**
 * @file Tests for SecurityAnalysisService
 * @module tests/services/SecurityAnalysisService.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies before importing
vi.mock('../../src/services/WebApiService.js', () => ({
    WebApiService: {
        webApiFetch: vi.fn()
    }
}));

vi.mock('../../src/services/MetadataService.js', () => ({
    MetadataService: {
        getEntitySetName: vi.fn()
    }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        getGlobalContext: vi.fn(),
        isFormContextAvailable: false,
        getFormContext: vi.fn(),
        getEntityName: vi.fn(),
        getEntityId: vi.fn()
    }
}));

// Import after mocks
import { SecurityAnalysisService } from '../../src/services/SecurityAnalysisService.js';
import { WebApiService } from '../../src/services/WebApiService.js';
import { PowerAppsApiService } from '../../src/services/PowerAppsApiService.js';

describe('SecurityAnalysisService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('getCurrentUserRoles', () => {
        it('should get current user roles via getUserRoles', async () => {
            const mockUserId = 'user-123';
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: {
                    userId: `{${mockUserId}}`
                }
            });

            const mockRolesResponse = {
                value: [
                    { roleid: 'role-1', name: 'System Administrator', _parentrootroleid_value: 'parent-role-1' },
                    { roleid: 'role-2', name: 'Sales Manager', _parentrootroleid_value: 'parent-role-2' }
                ]
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockRolesResponse) // systemuserroles_association
                .mockResolvedValueOnce({ value: [] }); // teammembership_association

            const result = await SecurityAnalysisService.getCurrentUserRoles();

            expect(result).toHaveLength(2);
            // Roles come back in the order from the API - check both roles exist
            const role1 = result.find(r => r.roleid === 'parent-role-1');
            const role2 = result.find(r => r.roleid === 'parent-role-2');

            expect(role1).toBeDefined();
            expect(role1.name).toBe('System Administrator');
            expect(role1.isInherited).toBe(false);

            expect(role2).toBeDefined();
            expect(role2.name).toBe('Sales Manager');
            expect(role2.isInherited).toBe(false);
        });

        it('should return empty array if global context is unavailable', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue(null);

            const result = await SecurityAnalysisService.getCurrentUserRoles();

            expect(result).toEqual([]);
        });

        it('should return empty array if userId is missing', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: {}
            });

            const result = await SecurityAnalysisService.getCurrentUserRoles();

            expect(result).toEqual([]);
        });

        it('should return empty array on error', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{user-123}' }
            });

            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await SecurityAnalysisService.getCurrentUserRoles();

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });
    });

    describe('getUserRoles', () => {
        it('should fetch direct roles for a user', async () => {
            const mockUserId = 'user-456';
            const mockDirectRoles = {
                value: [{ roleid: 'role-1', name: 'Sales Rep' }]
            };
            const mockTeams = { value: [] };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockDirectRoles)
                .mockResolvedValueOnce(mockTeams);

            const result = await SecurityAnalysisService.getUserRoles(mockUserId);

            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining(`systemusers(${mockUserId})/systemuserroles_association`),
                '',
                null,
                {},
                expect.any(Function)
            );
            expect(result).toContainEqual(
                expect.objectContaining({ roleid: 'role-1', isInherited: false })
            );
        });

        it('should use current user when null userId provided', async () => {
            // Mock PowerAppsApiService to return current user
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{current-user-id}' }
            });

            // Mock successful responses for current user
            WebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ roleid: 'role-1', name: 'Role 1' }] }) // Direct roles
                .mockResolvedValueOnce({ value: [] }); // Team membership

            const result = await SecurityAnalysisService.getUserRoles(null);

            expect(result).toBeInstanceOf(Array);
            // Verify it called webApiFetch with current user ID
            expect(WebApiService.webApiFetch).toHaveBeenCalled();
        });

        it('should return empty array when null userId and no current user context', async () => {
            // Mock PowerAppsApiService to return null current user
            PowerAppsApiService.getGlobalContext.mockReturnValueOnce({
                userSettings: { userId: null }
            });

            const result = await SecurityAnalysisService.getUserRoles(null);

            expect(result).toEqual([]);
            expect(WebApiService.webApiFetch).not.toHaveBeenCalled();
        });

        it('should return empty array on error', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await SecurityAnalysisService.getUserRoles('user-123');

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });

        it('should include team-inherited roles', async () => {
            const mockDirectRoles = { value: [] };
            const mockTeams = { value: [{ teamid: 'team-1', name: 'Team A' }] };
            const mockTeamRoles = {
                value: [{ roleid: 'role-from-team', name: 'Team Role' }]
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockDirectRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockTeamRoles);

            const result = await SecurityAnalysisService.getUserRoles('user-123');

            expect(result).toContainEqual(
                expect.objectContaining({ roleid: 'role-from-team', isInherited: true })
            );
        });

        it('should include teams array for inherited roles', async () => {
            const mockDirectRoles = { value: [] };
            const mockTeams = { value: [{ teamid: 'team-1', name: 'Team A' }] };
            const mockTeamRoles = {
                value: [{ roleid: 'role-from-team', name: 'Team Role' }]
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockDirectRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockTeamRoles);

            const result = await SecurityAnalysisService.getUserRoles('user-123');

            const inheritedRole = result.find(r => r.roleid === 'role-from-team');
            expect(inheritedRole).toBeDefined();
            expect(inheritedRole.isInherited).toBe(true);
            expect(inheritedRole.teams).toEqual([{ teamId: 'team-1', teamName: 'Team A' }]);
        });

        it('should consolidate roles from multiple teams', async () => {
            const mockDirectRoles = { value: [] };
            const mockTeams = {
                value: [
                    { teamid: 'team-1', name: 'Team A' },
                    { teamid: 'team-2', name: 'Team B' }
                ]
            };
            const mockTeam1Roles = {
                value: [{ roleid: 'role-shared', name: 'Shared Role' }]
            };
            const mockTeam2Roles = {
                value: [{ roleid: 'role-shared', name: 'Shared Role' }]
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockDirectRoles)  // Direct roles
                .mockResolvedValueOnce(mockTeams)        // Team memberships
                .mockResolvedValueOnce(mockTeam1Roles)   // Team 1 roles
                .mockResolvedValueOnce(mockTeam2Roles);  // Team 2 roles

            const result = await SecurityAnalysisService.getUserRoles('user-123');

            // Should have one role with both teams listed
            const sharedRole = result.find(r => r.roleid === 'role-shared');
            expect(sharedRole).toBeDefined();
            expect(sharedRole.teams).toHaveLength(2);
            expect(sharedRole.teams).toContainEqual({ teamId: 'team-1', teamName: 'Team A' });
            expect(sharedRole.teams).toContainEqual({ teamId: 'team-2', teamName: 'Team B' });
        });

        it('should handle mixed direct and team roles', async () => {
            const mockDirectRoles = {
                value: [{ roleid: 'role-direct', name: 'Direct Role' }]
            };
            const mockTeams = { value: [{ teamid: 'team-1', name: 'Team A' }] };
            const mockTeamRoles = {
                value: [{ roleid: 'role-team', name: 'Team Role' }]
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockDirectRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockTeamRoles);

            const result = await SecurityAnalysisService.getUserRoles('user-123');

            expect(result).toHaveLength(2);

            const directRole = result.find(r => r.roleid === 'role-direct');
            expect(directRole.isInherited).toBe(false);
            expect(directRole.teams).toBeUndefined();

            const teamRole = result.find(r => r.roleid === 'role-team');
            expect(teamRole.isInherited).toBe(true);
            expect(teamRole.teams).toBeDefined();
        });

        it('should handle team role fetch errors gracefully', async () => {
            const mockDirectRoles = { value: [] };
            const mockTeams = { value: [{ teamid: 'team-1', name: 'Team A' }] };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockDirectRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockRejectedValueOnce(new Error('Team role fetch failed'));

            const result = await SecurityAnalysisService.getUserRoles('user-123');

            // Should return empty array because direct roles are empty and team fetch failed gracefully
            // The error is caught and team roles are treated as empty
            expect(result).toEqual([]);
        });

        it('should sort roles alphabetically by name', async () => {
            const mockDirectRoles = {
                value: [
                    { roleid: 'role-z', name: 'Zebra Role' },
                    { roleid: 'role-a', name: 'Apple Role' }
                ]
            };
            const mockTeams = { value: [] };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockDirectRoles)
                .mockResolvedValueOnce(mockTeams);

            const result = await SecurityAnalysisService.getUserRoles('user-123');

            expect(result[0].name).toBe('Apple Role');
            expect(result[1].name).toBe('Zebra Role');
        });
    });

    describe('getUserFieldSecurityProfiles', () => {
        it('should fetch field security profiles for a user', async () => {
            const mockUserId = 'user-789';
            const mockDirectProfiles = {
                value: [{ fieldsecurityprofileid: 'profile-1', name: 'Contact Profile' }]
            };
            const mockTeamMembership = {
                value: [] // No team membership
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockDirectProfiles)
                .mockResolvedValueOnce(mockTeamMembership);

            const result = await SecurityAnalysisService.getUserFieldSecurityProfiles(mockUserId);

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                fieldsecurityprofileid: 'profile-1',
                name: 'Contact Profile',
                isInherited: false
            });
        });

        it('should use current user when null userId provided', async () => {
            // Mock PowerAppsApiService to return current user
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{current-user-id}' }
            });

            // Mock successful responses for current user
            WebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [] }) // Direct profiles
                .mockResolvedValueOnce({ value: [] }); // Team membership

            const result = await SecurityAnalysisService.getUserFieldSecurityProfiles(null);

            expect(result).toBeInstanceOf(Array);
            // Verify it called webApiFetch with current user ID
            expect(WebApiService.webApiFetch).toHaveBeenCalled();
        });

        it('should handle empty profiles gracefully', async () => {
            WebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [] }) // No direct profiles
                .mockResolvedValueOnce({ value: [] }); // No team membership

            const result = await SecurityAnalysisService.getUserFieldSecurityProfiles('user-123');

            expect(result).toEqual([]);
        });
    });

    describe('getUserEntityPrivileges', () => {
        const privilegeTypes = ['read', 'create', 'write', 'delete', 'append', 'appendto', 'assign', 'share'];

        it('should return privilege objects for an entity using roleprivileges navigation property', async () => {
            const mockUserId = 'user-123';
            const entityName = 'account';

            // Mock entity metadata lookup (ObjectTypeCode)
            const mockEntityDef = { ObjectTypeCode: 1, LogicalName: 'account' };

            // Mock all privileges query
            const mockAllPrivileges = {
                value: [
                    { privilegeid: 'priv-read', name: 'prvReadaccount' },
                    { privilegeid: 'priv-write', name: 'prvWriteaccount' },
                    { privilegeid: 'priv-create', name: 'prvCreateaccount' }
                ]
            };

            // Mock user roles
            const mockDirectRoles = { value: [{ roleid: 'role-1', name: 'Sales Rep' }] };
            const mockTeams = { value: [] };

            // Mock role privileges (roleprivilegescollection entity returns privilegeid and privilegedepthmask)
            // privilegedepthmask is an integer bit mask: Basic=1, Local=2, Deep=4, Global=8
            const mockRolePrivs = {
                value: [
                    { privilegeid: 'priv-read', privilegedepthmask: 8 }, // Global
                    { privilegeid: 'priv-write', privilegedepthmask: 2 } // Local
                ]
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef) // EntityDefinitions
                .mockResolvedValueOnce(mockAllPrivileges) // All privileges
                .mockResolvedValueOnce(mockDirectRoles) // User roles - direct
                .mockResolvedValueOnce(mockTeams) // User roles - teams
                .mockResolvedValueOnce(mockRolePrivs); // Role privileges

            const result = await SecurityAnalysisService.getUserEntityPrivileges(mockUserId, entityName);

            // Should return an object structure for each privilege
            expect(result).toHaveProperty('read');
            expect(result.read).toMatchObject({ hasPrivilege: true, depth: 'Global (Org)' });
            expect(result.write).toMatchObject({ hasPrivilege: true, depth: 'Local (BU)' });
            expect(result.create).toMatchObject({ hasPrivilege: false, depth: null });
        });

        it('should return objects with hasPrivilege:false when no privileges found', async () => {
            // Mock empty privilege response
            WebApiService.webApiFetch
                .mockResolvedValueOnce({ ObjectTypeCode: 1 })
                .mockResolvedValueOnce({ value: [] }); // No matching privileges

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            privilegeTypes.forEach(type => {
                expect(result[type]).toMatchObject({ hasPrivilege: false, depth: null });
            });
        });

        it('should use current user when null userId provided', async () => {
            // Mock PowerAppsApiService to return current user
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{current-user-id}' }
            });

            // Mock successful responses for current user
            WebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ privilegeid: 'priv-1', name: 'prvReadAccount' }] }) // Privileges
                .mockResolvedValueOnce({ value: [{ roleid: 'role-1', name: 'Role 1' }] }) // Direct roles
                .mockResolvedValueOnce({ value: [] }); // Team membership

            const result = await SecurityAnalysisService.getUserEntityPrivileges(null, 'account');

            expect(result).toHaveProperty('read');
            // Verify it called webApiFetch with current user ID
            expect(WebApiService.webApiFetch).toHaveBeenCalled();
        });

        it('should handle API errors gracefully', async () => {
            // API call fails
            WebApiService.webApiFetch.mockRejectedValueOnce(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            // Should return false for all privileges on error
            privilegeTypes.forEach(type => {
                expect(result[type]).toMatchObject({ hasPrivilege: false, depth: null });
            });

            consoleSpy.mockRestore();
        });

        it('should map privilege depth strings correctly', async () => {
            const mockEntityDef = { ObjectTypeCode: 1 };
            const mockPrivileges = {
                value: [
                    { privilegeid: 'p1', name: 'prvReadaccount' },
                    { privilegeid: 'p2', name: 'prvCreateaccount' },
                    { privilegeid: 'p3', name: 'prvWriteaccount' },
                    { privilegeid: 'p4', name: 'prvDeleteaccount' }
                ]
            };
            const mockRoles = { value: [{ roleid: 'role-1', name: 'Role' }] };
            const mockTeams = { value: [] };
            // roleprivilegescollection entity returns privilegedepthmask as integer bit mask
            // Bit masks: Basic=1, Local=2, Deep=4, Global=8
            const mockRolePrivs = {
                value: [
                    { privilegeid: 'p1', privilegedepthmask: 1 }, // Basic
                    { privilegeid: 'p2', privilegedepthmask: 2 }, // Local
                    { privilegeid: 'p3', privilegedepthmask: 4 }, // Deep
                    { privilegeid: 'p4', privilegedepthmask: 8 }  // Global
                ]
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivs);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read.depth).toBe('Basic (User)');
            expect(result.create.depth).toBe('Local (BU)');
            expect(result.write.depth).toBe('Deep (BU + Child)');
            expect(result.delete.depth).toBe('Global (Org)');
        });

        it('should keep best (deepest) privilege when multiple roles provide access', async () => {
            const mockEntityDef = { ObjectTypeCode: 1 };
            const mockPrivileges = {
                value: [{ privilegeid: 'p1', name: 'prvReadaccount' }]
            };
            const mockRoles = {
                value: [
                    { roleid: 'role-1', name: 'Role 1' },
                    { roleid: 'role-2', name: 'Role 2' }
                ]
            };
            const mockTeams = { value: [] };
            // First role gives Local (2), second gives Global (8) - should keep Global
            const mockRolePrivs1 = { value: [{ privilegeid: 'p1', privilegedepthmask: 2 }] }; // Local
            const mockRolePrivs2 = { value: [{ privilegeid: 'p1', privilegedepthmask: 8 }] }; // Global

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivs1)
                .mockResolvedValueOnce(mockRolePrivs2);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read.depth).toBe('Global (Org)');
        });

        it('should handle paginated privileges response', async () => {
            const mockEntityDef = { ObjectTypeCode: 1 };
            // First page of privileges with @odata.nextLink
            const mockPrivilegesPage1 = {
                value: [
                    { privilegeid: 'p1', name: 'prvReadaccount' }
                ],
                '@odata.nextLink': 'https://org.crm.dynamics.com/api/data/v9.2/privileges?$select=privilegeid,name&$skiptoken=page2'
            };
            // Second page without nextLink (last page)
            const mockPrivilegesPage2 = {
                value: [
                    { privilegeid: 'p2', name: 'prvWriteaccount' }
                ]
            };
            const mockRoles = { value: [{ roleid: 'role-1', name: 'Role' }] };
            const mockTeams = { value: [] };
            // roleprivilegescollection returns privilegedepthmask as integer bit mask
            const mockRolePrivs = {
                value: [
                    { privilegeid: 'p1', privilegedepthmask: 8 }, // Global
                    { privilegeid: 'p2', privilegedepthmask: 4 }  // Deep
                ]
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef)
                .mockResolvedValueOnce(mockPrivilegesPage1)
                .mockResolvedValueOnce(mockPrivilegesPage2)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivs);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            // Both privileges from both pages should be found
            expect(result.read.hasPrivilege).toBe(true);
            expect(result.read.depth).toBe('Global (Org)');
            expect(result.write.hasPrivilege).toBe(true);
            expect(result.write.depth).toBe('Deep (BU + Child)');
        });

        it('should handle paginated role privileges when role has >5000 privileges', async () => {
            const mockEntityDef = { ObjectTypeCode: 1 };
            const mockPrivileges = {
                value: [
                    { privilegeid: 'custom-priv-1', name: 'prvReadm8_customentity' }
                ]
            };
            const mockRoles = { value: [{ roleid: 'role-1', name: 'System Administrator' }] };
            const mockTeams = { value: [] };
            // First page of role privileges with @odata.nextLink
            const mockRolePrivsPage1 = {
                value: [
                    { privilegeid: 'other-priv-1', privilegedepthmask: 8 },
                    { privilegeid: 'other-priv-2', privilegedepthmask: 8 }
                ],
                '@odata.nextLink': 'https://org.crm.dynamics.com/api/data/v9.2/roleprivilegescollection?$skiptoken=page2'
            };
            // Second page contains the custom entity privilege
            const mockRolePrivsPage2 = {
                value: [
                    { privilegeid: 'custom-priv-1', privilegedepthmask: 8 } // The privilege we're looking for
                ]
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivsPage1)
                .mockResolvedValueOnce(mockRolePrivsPage2);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'm8_customentity');

            // Custom entity privilege should be found from second page
            expect(result.read.hasPrivilege).toBe(true);
            expect(result.read.depth).toBe('Global (Org)');
        });

        it('should match privileges for custom entities with mixed case names', async () => {
            const mockEntityDef = { ObjectTypeCode: 10001 };
            const mockPrivileges = {
                value: [
                    { privilegeid: 'priv-create', name: 'prvCreatem8_VehicleModel' },
                    { privilegeid: 'priv-read', name: 'prvReadm8_VehicleModel' },
                    { privilegeid: 'priv-write', name: 'prvWritem8_VehicleModel' }
                ]
            };
            const mockRoles = { value: [{ roleid: 'role-1', name: 'Sales Rep' }] };
            const mockTeams = { value: [] };
            const mockRolePrivs = {
                value: [
                    { privilegeid: 'priv-create', privilegedepthmask: 4 },
                    { privilegeid: 'priv-read', privilegedepthmask: 8 }
                ]
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivs);

            // Entity logical name is lowercase, privilege names have mixed case
            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'm8_vehiclemodel');

            expect(result.create.hasPrivilege).toBe(true);
            expect(result.create.depth).toBe('Deep (BU + Child)');
            expect(result.read.hasPrivilege).toBe(true);
            expect(result.read.depth).toBe('Global (Org)');
            expect(result.write.hasPrivilege).toBe(false);
        });
    });

    describe('getUserTeams', () => {
        it('should fetch teams for a user', async () => {
            const mockUserId = 'user-123';
            const mockTeams = {
                value: [
                    { teamid: 'team-1', name: 'Sales Team', teamtype: 0 },
                    { teamid: 'team-2', name: 'Marketing Team', teamtype: 1 }
                ]
            };

            WebApiService.webApiFetch.mockResolvedValueOnce(mockTeams);

            const result = await SecurityAnalysisService.getUserTeams(mockUserId);

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                teamid: 'team-2', // Sorted alphabetically
                name: 'Marketing Team',
                teamtype: 'Access'
            });
            expect(result[1]).toMatchObject({
                teamid: 'team-1',
                name: 'Sales Team',
                teamtype: 'Owner'
            });
        });

        it('should use current user when null userId provided', async () => {
            // Mock PowerAppsApiService to return current user
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{current-user-id}' }
            });

            // Mock successful response for current user
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ teamid: 'team-1', name: 'Team 1', teamtype: 0 }]
            });

            const result = await SecurityAnalysisService.getUserTeams(null);

            expect(result).toBeInstanceOf(Array);
            // Verify it called webApiFetch with current user ID
            expect(WebApiService.webApiFetch).toHaveBeenCalled();
        });

        it('should return empty array on error', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await SecurityAnalysisService.getUserTeams('user-123');

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });

        it('should map team types correctly', async () => {
            const mockTeams = {
                value: [
                    { teamid: 'team-1', name: 'A', teamtype: 0 },
                    { teamid: 'team-2', name: 'B', teamtype: 1 },
                    { teamid: 'team-3', name: 'C', teamtype: 2 },
                    { teamid: 'team-4', name: 'D', teamtype: 3 },
                    { teamid: 'team-5', name: 'E', teamtype: 99 }
                ]
            };

            WebApiService.webApiFetch.mockResolvedValueOnce(mockTeams);

            const result = await SecurityAnalysisService.getUserTeams('user-123');

            expect(result[0].teamtype).toBe('Owner'); // teamtype 0
            expect(result[1].teamtype).toBe('Access'); // teamtype 1
            expect(result[2].teamtype).toBe('AAD Security Group'); // teamtype 2
            expect(result[3].teamtype).toBe('AAD Office Group'); // teamtype 3
            expect(result[4].teamtype).toBe('Unknown'); // unknown teamtype
        });
    });

    describe('compareUserSecurity', () => {
        it('should compare security between current and target user', async () => {
            const targetUserId = 'target-123';

            // Mock current user context
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: {
                    userId: '{current-123}'
                }
            });

            // Mock current user roles (via getUserRoles)
            const currentUserRoles = {
                value: [
                    { roleid: 'role-1', name: 'Common Role', _parentrootroleid_value: 'parent-1' },
                    { roleid: 'role-2', name: 'Current Only', _parentrootroleid_value: 'parent-2' }
                ]
            };

            // Mock target user API calls - getUserRoles
            const targetDirectRoles = {
                value: [
                    { roleid: 'role-1', name: 'Common Role', _parentrootroleid_value: 'parent-1' },
                    { roleid: 'role-3', name: 'Target Only', _parentrootroleid_value: 'parent-3' }
                ]
            };
            const mockTeams = { value: [] };

            // Mock field security profiles - needs 2 calls (direct and team membership)
            const mockDirectProfiles = { value: [] };
            const mockTeamMembership = { value: [] };

            // Mock user teams
            const mockUserTeams = { value: [] };

            // Mock all webApiFetch calls in sequence
            // Call order:
            // 1-2: getUserRoles for comparisonUser (current user)
            // 3-4: getUserTeams for comparisonUser
            // 5-6: getUserRoles for targetUser
            // 7: getUserFieldSecurityProfiles for targetUser (direct profiles)
            // 8: getUserFieldSecurityProfiles for targetUser (team membership)
            // 9: getUserTeams for targetUser
            // 10-11: getUserFieldSecurityProfiles for comparisonUser (direct profiles, team membership)
            WebApiService.webApiFetch
                .mockResolvedValueOnce(currentUserRoles)   // 1. current user - direct roles
                .mockResolvedValueOnce(mockTeams)          // 2. current user - team membership for roles
                .mockResolvedValueOnce(mockUserTeams)      // 3. current user teams
                .mockResolvedValueOnce(targetDirectRoles)  // 4. target user - direct roles
                .mockResolvedValueOnce(mockTeams)          // 5. target user - team membership for roles
                .mockResolvedValueOnce(mockDirectProfiles) // 6. target user - direct field profiles
                .mockResolvedValueOnce(mockTeamMembership) // 7. target user - team membership for profiles
                .mockResolvedValueOnce(mockUserTeams)      // 8. target user teams
                .mockResolvedValueOnce(mockDirectProfiles) // 9. comparison user (current) - direct field profiles
                .mockResolvedValueOnce(mockTeamMembership); // 10. comparison user (current) - team membership

            const result = await SecurityAnalysisService.compareUserSecurity(targetUserId);

            expect(result).toHaveProperty('currentUserRoles');
            expect(result).toHaveProperty('targetUserRoles');
            expect(result).toHaveProperty('commonRoles');
            expect(result).toHaveProperty('currentUserOnlyRoles');
            expect(result).toHaveProperty('targetUserOnlyRoles');
            expect(result).toHaveProperty('targetUserFieldProfiles');
            expect(result).toHaveProperty('targetUserTeams');

            // Verify role comparison uses _parentrootroleid_value
            expect(result.commonRoles).toHaveLength(1);
            expect(result.commonRoles[0].roleid).toBe('parent-1');
        });

        it('should include entity privileges when entityLogicalName provided', async () => {
            const targetUserId = 'target-123';

            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: {
                    userId: '{current-123}'
                }
            });

            // Mock all API calls - getCurrentUserRoles, getUserRoles, getUserFieldSecurityProfiles, getUserTeams, getUserEntityPrivileges
            WebApiService.webApiFetch.mockResolvedValue({ value: [], RolePrivileges: [] });

            const result = await SecurityAnalysisService.compareUserSecurity(targetUserId, 'account');

            expect(result).toHaveProperty('entityPrivileges');
            expect(result).toHaveProperty('targetUserTeams');
        });
    });

    describe('isPermissionAllowed', () => {
        it('should return true for value 4', () => {
            expect(SecurityAnalysisService.isPermissionAllowed(4)).toBe(true);
        });

        it('should return false for value 0', () => {
            expect(SecurityAnalysisService.isPermissionAllowed(0)).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(SecurityAnalysisService.isPermissionAllowed(null)).toBe(false);
            expect(SecurityAnalysisService.isPermissionAllowed(undefined)).toBe(false);
        });

        it('should return false for other values', () => {
            expect(SecurityAnalysisService.isPermissionAllowed(1)).toBe(false);
            expect(SecurityAnalysisService.isPermissionAllowed(3)).toBe(false);
        });
    });

    describe('generateAdminCenterLink', () => {
        it('should generate admin center link', () => {
            const result = SecurityAnalysisService.generateAdminCenterLink();

            expect(result).toBe('https://admin.powerplatform.microsoft.com/environments');
        });
    });

    describe('generateEntraLink', () => {
        it('should generate Microsoft Entra link', () => {
            const result = SecurityAnalysisService.generateEntraLink();

            expect(result).toBe('https://entra.microsoft.com/');
        });
    });

    describe('formatPermissionValue', () => {
        it('should return Allowed for value 4', () => {
            expect(SecurityAnalysisService.formatPermissionValue(4)).toBe('Allowed');
        });

        it('should return Not Allowed for value 0', () => {
            expect(SecurityAnalysisService.formatPermissionValue(0)).toBe('Not Allowed');
        });

        it('should return Not Allowed for other values', () => {
            expect(SecurityAnalysisService.formatPermissionValue(1)).toBe('Not Allowed');
            expect(SecurityAnalysisService.formatPermissionValue(null)).toBe('Not Allowed');
        });
    });

    describe('getCurrentUserTeams', () => {
        it('should get current user teams via getUserTeams', async () => {
            const mockUserId = 'user-123';
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: {
                    userId: `{${mockUserId}}`
                }
            });

            const mockTeams = {
                value: [
                    { teamid: 'team-1', name: 'Sales Team', teamtype: 0 }
                ]
            };

            WebApiService.webApiFetch.mockResolvedValueOnce(mockTeams);

            const result = await SecurityAnalysisService.getCurrentUserTeams();

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Sales Team');
        });

        it('should return empty array if global context is unavailable', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue(null);

            const result = await SecurityAnalysisService.getCurrentUserTeams();

            expect(result).toEqual([]);
        });

        it('should return empty array if userId is missing', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: {}
            });

            const result = await SecurityAnalysisService.getCurrentUserTeams();

            expect(result).toEqual([]);
        });

        it('should return empty array on error', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{user-123}' }
            });

            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await SecurityAnalysisService.getCurrentUserTeams();

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });
    });

    describe('getFieldPermissions', () => {
        it('should fetch field permissions for a profile', async () => {
            const mockProfileId = 'profile-123';
            const mockPermissions = {
                value: [
                    { entityname: 'contact', attributelogicalname: 'mobilephone', canread: 4, cancreate: 0, canupdate: 4 },
                    { entityname: 'contact', attributelogicalname: 'emailaddress1', canread: 4, cancreate: 4, canupdate: 4 }
                ]
            };

            WebApiService.webApiFetch.mockResolvedValueOnce(mockPermissions);

            const result = await SecurityAnalysisService.getFieldPermissions(mockProfileId);

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                entityname: 'contact',
                attributelogicalname: 'mobilephone',
                canread: 4,
                cancreate: 0,
                canupdate: 4
            });
        });

        it('should filter by entity name when provided', async () => {
            const mockProfileId = 'profile-123';
            const mockPermissions = {
                value: [
                    { entityname: 'contact', attributelogicalname: 'mobilephone', canread: 4, cancreate: 0, canupdate: 4 }
                ]
            };

            WebApiService.webApiFetch.mockResolvedValueOnce(mockPermissions);

            const result = await SecurityAnalysisService.getFieldPermissions(mockProfileId, 'contact');

            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining("$filter=entityname eq 'contact'"),
                '',
                null,
                {},
                expect.any(Function)
            );
            expect(result).toHaveLength(1);
        });

        it('should return empty array when profileId is null', async () => {
            const result = await SecurityAnalysisService.getFieldPermissions(null);

            expect(result).toEqual([]);
            expect(WebApiService.webApiFetch).not.toHaveBeenCalled();
        });

        it('should return empty array on error', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await SecurityAnalysisService.getFieldPermissions('profile-123');

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });
    });

    describe('getSecuredColumnsForEntity', () => {
        it('should fetch secured columns for an entity', async () => {
            const mockUserId = 'user-123';
            const entityName = 'contact';

            // Mock getUserFieldSecurityProfiles
            const mockDirectProfiles = {
                value: [{ fieldsecurityprofileid: 'profile-1', name: 'Contact Profile' }]
            };
            const mockTeamMembership = { value: [] };

            // Mock getFieldPermissions
            const mockPermissions = {
                value: [
                    { entityname: 'contact', attributelogicalname: 'mobilephone', canread: 4, cancreate: 0, canupdate: 4 },
                    { entityname: 'contact', attributelogicalname: 'emailaddress1', canread: 4, cancreate: 4, canupdate: 4 }
                ]
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockDirectProfiles) // Direct profiles
                .mockResolvedValueOnce(mockTeamMembership) // Team membership
                .mockResolvedValueOnce(mockPermissions); // Field permissions

            const result = await SecurityAnalysisService.getSecuredColumnsForEntity(mockUserId, entityName);

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                attributelogicalname: 'emailaddress1', // sorted alphabetically
                canread: 4,
                cancreate: 4,
                canupdate: 4
            });
        });

        it('should return empty array when userId is null', async () => {
            const result = await SecurityAnalysisService.getSecuredColumnsForEntity(null, 'contact');

            expect(result).toEqual([]);
        });

        it('should return empty array when entityLogicalName is null', async () => {
            const result = await SecurityAnalysisService.getSecuredColumnsForEntity('user-123', null);

            expect(result).toEqual([]);
        });

        it('should return empty array when user has no profiles', async () => {
            WebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [] }) // No direct profiles
                .mockResolvedValueOnce({ value: [] }); // No team membership

            const result = await SecurityAnalysisService.getSecuredColumnsForEntity('user-123', 'contact');

            expect(result).toEqual([]);
        });

        it('should aggregate permissions from multiple profiles', async () => {
            // Mock two profiles
            const mockDirectProfiles = {
                value: [
                    { fieldsecurityprofileid: 'profile-1', name: 'Profile 1' },
                    { fieldsecurityprofileid: 'profile-2', name: 'Profile 2' }
                ]
            };
            const mockTeamMembership = { value: [] };

            // First profile: no read access for mobilephone
            const mockPermissions1 = {
                value: [
                    { entityname: 'contact', attributelogicalname: 'mobilephone', canread: 0, cancreate: 0, canupdate: 0 }
                ]
            };

            // Second profile: read access for mobilephone
            const mockPermissions2 = {
                value: [
                    { entityname: 'contact', attributelogicalname: 'mobilephone', canread: 4, cancreate: 0, canupdate: 4 }
                ]
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockDirectProfiles)
                .mockResolvedValueOnce(mockTeamMembership)
                .mockResolvedValueOnce(mockPermissions1)
                .mockResolvedValueOnce(mockPermissions2);

            const result = await SecurityAnalysisService.getSecuredColumnsForEntity('user-123', 'contact');

            // Should aggregate to best (highest) permission values
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                attributelogicalname: 'mobilephone',
                canread: 4, // Best from both profiles
                cancreate: 0,
                canupdate: 4
            });
            expect(result[0].profiles).toContain('Profile 1');
            expect(result[0].profiles).toContain('Profile 2');
        });

        it('should handle errors gracefully', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await SecurityAnalysisService.getSecuredColumnsForEntity('user-123', 'contact');

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });
    });

    describe('getUserFieldSecurityProfiles - team inherited profiles', () => {
        it('should include team-inherited field security profiles', async () => {
            const mockUserId = 'user-123';

            // Mock direct profiles
            const mockDirectProfiles = {
                value: [{ fieldsecurityprofileid: 'profile-1', name: 'Direct Profile' }]
            };

            // Mock team membership
            const mockTeamMembership = {
                value: [{ teamid: 'team-1' }]
            };

            // Mock team profiles
            const mockTeamProfiles = {
                value: [{ fieldsecurityprofileid: 'profile-2', name: 'Team Profile' }]
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockDirectProfiles)
                .mockResolvedValueOnce(mockTeamMembership)
                .mockResolvedValueOnce(mockTeamProfiles);

            const result = await SecurityAnalysisService.getUserFieldSecurityProfiles(mockUserId);

            expect(result).toHaveLength(2);
            // Check direct profile
            const directProfile = result.find(p => p.fieldsecurityprofileid === 'profile-1');
            expect(directProfile).toBeDefined();
            expect(directProfile.isInherited).toBe(false);
            // Check team profile
            const teamProfile = result.find(p => p.fieldsecurityprofileid === 'profile-2');
            expect(teamProfile).toBeDefined();
            expect(teamProfile.isInherited).toBe(true);
        });

        it('should deduplicate profiles preferring direct over inherited', async () => {
            const mockUserId = 'user-123';

            // Same profile ID in both direct and team
            const mockDirectProfiles = {
                value: [{ fieldsecurityprofileid: 'shared-profile', name: 'Shared Profile' }]
            };

            const mockTeamMembership = {
                value: [{ teamid: 'team-1' }]
            };

            const mockTeamProfiles = {
                value: [{ fieldsecurityprofileid: 'shared-profile', name: 'Shared Profile' }]
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockDirectProfiles)
                .mockResolvedValueOnce(mockTeamMembership)
                .mockResolvedValueOnce(mockTeamProfiles);

            const result = await SecurityAnalysisService.getUserFieldSecurityProfiles(mockUserId);

            // Should only have one profile, and it should be marked as direct (not inherited)
            expect(result).toHaveLength(1);
            expect(result[0].fieldsecurityprofileid).toBe('shared-profile');
            expect(result[0].isInherited).toBe(false);
        });

        it('should return empty array when no current user for null userId', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: null }
            });

            const result = await SecurityAnalysisService.getUserFieldSecurityProfiles(null);

            expect(result).toEqual([]);
        });

        it('should handle getUserFieldSecurityProfiles errors gracefully', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await SecurityAnalysisService.getUserFieldSecurityProfiles('user-123');

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });
    });

    describe('getUserTeams - null userId fallback', () => {
        it('should return empty array when null userId and no current user context', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: null }
            });

            const result = await SecurityAnalysisService.getUserTeams(null);

            expect(result).toEqual([]);
            expect(WebApiService.webApiFetch).not.toHaveBeenCalled();
        });
    });

    describe('getUserEntityPrivileges - edge cases', () => {
        it('should return default privileges when entityLogicalName is empty', async () => {
            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', '');

            expect(result.read).toMatchObject({ hasPrivilege: false, depth: null });
            expect(result.write).toMatchObject({ hasPrivilege: false, depth: null });
        });

        it('should return default privileges when null userId and no current user context', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: null }
            });

            const result = await SecurityAnalysisService.getUserEntityPrivileges(null, 'account');

            expect(result.read).toMatchObject({ hasPrivilege: false, depth: null });
        });
    });

    describe('_getDepthName - all cases', () => {
        it('should handle Not Allowed case for unknown depth mask', async () => {
            const mockEntityDef = { ObjectTypeCode: 1 };
            const mockPrivileges = {
                value: [{ privilegeid: 'p1', name: 'prvReadaccount' }]
            };
            const mockRoles = { value: [{ roleid: 'role-1', name: 'Role' }] };
            const mockTeams = { value: [] };
            const mockRolePrivs = {
                value: [{ privilegeid: 'p1', privilegedepthmask: 0 }] // Unknown depth mask
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivs);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read.depth).toBe('Not Allowed');
        });
    });

    describe('_checkRolePrivileges - edge cases', () => {
        it('should handle role objects with object-type roleid', async () => {
            const mockEntityDef = { ObjectTypeCode: 1 };
            const mockPrivileges = {
                value: [{ privilegeid: 'p1', name: 'prvReadaccount' }]
            };
            // Role with object-type roleid
            const mockRoles = { value: [{ roleid: { guid: 'role-guid-123' }, name: 'Role' }] };
            const mockTeams = { value: [] };
            const mockRolePrivs = {
                value: [{ privilegeid: 'p1', privilegedepthmask: 8 }]
            };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivs);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read.hasPrivilege).toBe(true);
        });

        it('should skip roles with empty roleid', async () => {
            const mockEntityDef = { ObjectTypeCode: 1 };
            const mockPrivileges = {
                value: [{ privilegeid: 'p1', name: 'prvReadaccount' }]
            };
            // Role with empty roleid
            const mockRoles = { value: [{ roleid: '', name: 'Role' }] };
            const mockTeams = { value: [] };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            // Should not have called role privileges API since roleid is empty
            expect(result.read.hasPrivilege).toBe(false);
        });
    });

    describe('_updatePrivilegeIfBetter - same depth tracking', () => {
        it('should track multiple roles providing same depth privilege', async () => {
            const mockEntityDef = { ObjectTypeCode: 1 };
            const mockPrivileges = {
                value: [{ privilegeid: 'p1', name: 'prvReadaccount' }]
            };
            const mockRoles = {
                value: [
                    { roleid: 'role-1', name: 'Role A' },
                    { roleid: 'role-2', name: 'Role B' }
                ]
            };
            const mockTeams = { value: [] };
            // Both roles give same depth
            const mockRolePrivs1 = { value: [{ privilegeid: 'p1', privilegedepthmask: 8 }] };
            const mockRolePrivs2 = { value: [{ privilegeid: 'p1', privilegedepthmask: 8 }] };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivs1)
                .mockResolvedValueOnce(mockRolePrivs2);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            // Should track both roles
            expect(result.read.roles).toContain('Role A');
            expect(result.read.roles).toContain('Role B');
        });
    });

    describe('_getEntityPrivilegesFromMetadata - error handling', () => {
        it('should return empty array when ObjectTypeCode is missing', async () => {
            const mockEntityDef = {}; // No ObjectTypeCode

            WebApiService.webApiFetch.mockResolvedValueOnce(mockEntityDef);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read.hasPrivilege).toBe(false);
        });
    });

    describe('_getEntityPrivilegesFromMetadata - activity entity handling via IsActivity metadata', () => {
        it('should use Activity privileges for email entity when IsActivity is true from metadata', async () => {
            // First call: EntityDefinitions for email returns IsActivity: true
            const mockEmailEntityDef = { ObjectTypeCode: 4202, LogicalName: 'email', IsActivity: true };
            const mockPrivileges = {
                value: [
                    { privilegeid: 'p1', name: 'prvReadActivity' },
                    { privilegeid: 'p2', name: 'prvCreateActivity' },
                    { privilegeid: 'p3', name: 'prvWriteActivity' }
                ]
            };
            const mockRoles = { value: [{ roleid: 'role-1', name: 'Basic User' }] };
            const mockTeams = { value: [] };
            const mockRolePrivs = { value: [{ privilegeid: 'p1', privilegedepthmask: 8 }] };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEmailEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivs);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'email');

            // Should query email's EntityDefinitions (to check IsActivity)
            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining("EntityDefinitions(LogicalName='email')"),
                '',
                null,
                {},
                expect.any(Function)
            );
            // Should find Activity privileges (not email-specific privileges)
            expect(result.read.hasPrivilege).toBe(true);
        });

        it('should use Activity privileges for task entity when IsActivity is true from metadata', async () => {
            const mockTaskEntityDef = { ObjectTypeCode: 4212, LogicalName: 'task', IsActivity: true };
            const mockPrivileges = {
                value: [
                    { privilegeid: 'p1', name: 'prvReadActivity' },
                    { privilegeid: 'p2', name: 'prvCreateActivity' }
                ]
            };
            const mockRoles = { value: [{ roleid: 'role-1', name: 'Basic User' }] };
            const mockTeams = { value: [] };
            const mockRolePrivs = { value: [{ privilegeid: 'p1', privilegedepthmask: 8 }] };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockTaskEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivs);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'task');

            // Should query task's EntityDefinitions
            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining("EntityDefinitions(LogicalName='task')"),
                '',
                null,
                {},
                expect.any(Function)
            );
            expect(result.read.hasPrivilege).toBe(true);
        });

        it('should use Activity privileges for phonecall entity when IsActivity is true', async () => {
            const mockPhonecallEntityDef = { ObjectTypeCode: 4210, LogicalName: 'phonecall', IsActivity: true };
            const mockPrivileges = {
                value: [{ privilegeid: 'p1', name: 'prvReadActivity' }]
            };
            const mockRoles = { value: [] };
            const mockTeams = { value: [] };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockPhonecallEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams);

            await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'phonecall');

            // Should query phonecall's EntityDefinitions
            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining("EntityDefinitions(LogicalName='phonecall')"),
                '',
                null,
                {},
                expect.any(Function)
            );
        });

        it('should use Activity privileges for custom activity entity when IsActivity is true', async () => {
            // Custom activity entity (e.g., contoso_customactivity)
            const mockCustomActivityDef = { ObjectTypeCode: 10500, LogicalName: 'contoso_customactivity', IsActivity: true };
            const mockPrivileges = {
                value: [
                    { privilegeid: 'p1', name: 'prvReadActivity' },
                    { privilegeid: 'p2', name: 'prvCreateActivity' }
                ]
            };
            const mockRoles = { value: [{ roleid: 'role-1', name: 'Basic User' }] };
            const mockTeams = { value: [] };
            const mockRolePrivs = { value: [{ privilegeid: 'p1', privilegedepthmask: 8 }] };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockCustomActivityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivs);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'contoso_customactivity');

            // Should find Activity privileges for custom activity
            expect(result.read.hasPrivilege).toBe(true);
        });

        it('should NOT use Activity privileges for account entity when IsActivity is false', async () => {
            const mockAccountEntityDef = { ObjectTypeCode: 1, LogicalName: 'account', IsActivity: false };
            const mockPrivileges = {
                value: [{ privilegeid: 'p1', name: 'prvReadaccount' }]
            };
            const mockRoles = { value: [] };
            const mockTeams = { value: [] };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockAccountEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams);

            await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            // Should query account directly
            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining("EntityDefinitions(LogicalName='account')"),
                '',
                null,
                {},
                expect.any(Function)
            );
        });

        it('should NOT use Activity privileges for contact entity when IsActivity is false', async () => {
            const mockContactEntityDef = { ObjectTypeCode: 2, LogicalName: 'contact', IsActivity: false };
            const mockPrivileges = {
                value: [{ privilegeid: 'p1', name: 'prvReadcontact' }]
            };
            const mockRoles = { value: [] };
            const mockTeams = { value: [] };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockContactEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams);

            await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'contact');

            // Should query contact directly
            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining("EntityDefinitions(LogicalName='contact')"),
                '',
                null,
                {},
                expect.any(Function)
            );
        });
    });

    describe('_fetchAllPrivileges - error handling', () => {
        it('should return empty array on fetch error', async () => {
            const mockEntityDef = { ObjectTypeCode: 1 };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef)
                .mockRejectedValueOnce(new Error('Privileges fetch failed'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read.hasPrivilege).toBe(false);

            consoleSpy.mockRestore();
        });
    });

    describe('_compareDepth - various depth comparisons', () => {
        it('should compare string depth values correctly', async () => {
            const mockEntityDef = { ObjectTypeCode: 1 };
            const mockPrivileges = {
                value: [{ privilegeid: 'p1', name: 'prvReadaccount' }]
            };
            const mockRoles = {
                value: [
                    { roleid: 'role-1', name: 'Role A' },
                    { roleid: 'role-2', name: 'Role B' }
                ]
            };
            const mockTeams = { value: [] };
            // First role gives Local (2), second gives Basic (1) - should keep Local
            const mockRolePrivs1 = { value: [{ privilegeid: 'p1', privilegedepthmask: 2 }] };
            const mockRolePrivs2 = { value: [{ privilegeid: 'p1', privilegedepthmask: 1 }] };

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivs1)
                .mockResolvedValueOnce(mockRolePrivs2);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            // Should keep Local as it's better than Basic
            expect(result.read.depth).toBe('Local (BU)');
        });

        it('should handle basic or user string depth values', async () => {
            const mockEntityDef = { ObjectTypeCode: 1 };
            const mockPrivileges = {
                value: [{ privilegeid: 'p1', name: 'prvReadaccount' }]
            };
            const mockRoles = {
                value: [
                    { roleid: 'role-1', name: 'Role A' },
                    { roleid: 'role-2', name: 'Role B' }
                ]
            };
            const mockTeams = { value: [] };
            // Basic (1) is depth 0 in comparison, Local (2) is depth 1
            const mockRolePrivs1 = { value: [{ privilegeid: 'p1', privilegedepthmask: 1 }] }; // Basic
            const mockRolePrivs2 = { value: [{ privilegeid: 'p1', privilegedepthmask: 2 }] }; // Local

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivs1)
                .mockResolvedValueOnce(mockRolePrivs2);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            // Should upgrade from Basic to Local since Local is better
            expect(result.read.depth).toBe('Local (BU)');
        });

        it('should handle deep or parent string depth comparison', async () => {
            // Test _compareDepth with Deep privilege being upgraded
            const mockEntityDef = { ObjectTypeCode: 1 };
            const mockPrivileges = {
                value: [{ privilegeid: 'p1', name: 'prvReadaccount' }]
            };
            const mockRoles = {
                value: [
                    { roleid: 'role-1', name: 'Role A' },
                    { roleid: 'role-2', name: 'Role B' }
                ]
            };
            const mockTeams = { value: [] };
            // First role gives Deep (4), second gives Global (8) - should upgrade to Global
            const mockRolePrivs1 = { value: [{ privilegeid: 'p1', privilegedepthmask: 4 }] }; // Deep
            const mockRolePrivs2 = { value: [{ privilegeid: 'p1', privilegedepthmask: 8 }] }; // Global

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivs1)
                .mockResolvedValueOnce(mockRolePrivs2);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read.depth).toBe('Global (Org)');
        });

        it('should handle unexpected numeric depth mask values (line 760)', async () => {
            // Test _compareDepth handles non-standard depth mask like 3 or 5
            const mockEntityDef = { ObjectTypeCode: 1 };
            const mockPrivileges = {
                value: [{ privilegeid: 'p1', name: 'prvReadaccount' }]
            };
            const mockRoles = {
                value: [
                    { roleid: 'role-1', name: 'Role A' },
                    { roleid: 'role-2', name: 'Role B' }
                ]
            };
            const mockTeams = { value: [] };
            // Use unusual depth mask values to hit line 760 (return d as-is)
            const mockRolePrivs1 = { value: [{ privilegeid: 'p1', privilegedepthmask: 3 }] }; // Not 1,2,4,8 - passes through
            const mockRolePrivs2 = { value: [{ privilegeid: 'p1', privilegedepthmask: 5 }] }; // Not 1,2,4,8 - passes through

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivs1)
                .mockResolvedValueOnce(mockRolePrivs2);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            // Should still work - _getDepthName(3) returns 'Not Allowed', _getDepthName(5) also returns 'Not Allowed'
            expect(result.read.hasPrivilege).toBe(true);
        });

        it('should compare Deep depth mask as second role (line 749)', async () => {
            // Test that Deep (4) as second role triggers comparison with existing privilege
            const mockEntityDef = { ObjectTypeCode: 1 };
            const mockPrivileges = {
                value: [{ privilegeid: 'p1', name: 'prvReadaccount' }]
            };
            const mockRoles = {
                value: [
                    { roleid: 'role-1', name: 'Role A' },
                    { roleid: 'role-2', name: 'Role B' }
                ]
            };
            const mockTeams = { value: [] };
            // First role sets Local (2), second role tries Deep (4) - should upgrade
            // This ensures _compareDepth is called with (4, "Local (BU)"), hitting line 749
            const mockRolePrivs1 = { value: [{ privilegeid: 'p1', privilegedepthmask: 2 }] }; // Local
            const mockRolePrivs2 = { value: [{ privilegeid: 'p1', privilegedepthmask: 4 }] }; // Deep

            WebApiService.webApiFetch
                .mockResolvedValueOnce(mockEntityDef)
                .mockResolvedValueOnce(mockPrivileges)
                .mockResolvedValueOnce(mockRoles)
                .mockResolvedValueOnce(mockTeams)
                .mockResolvedValueOnce(mockRolePrivs1)
                .mockResolvedValueOnce(mockRolePrivs2);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            // Should upgrade from Local to Deep
            expect(result.read.depth).toBe('Deep (BU + Child)');
        });
    });

    describe('generateAdminCenterLink', () => {
        it('should return Power Platform Admin Center URL', () => {
            const result = SecurityAnalysisService.generateAdminCenterLink();

            expect(result).toBe('https://admin.powerplatform.microsoft.com/environments');
        });
    });

    describe('generateEntraLink', () => {
        it('should return Microsoft Entra Admin Center URL', () => {
            const result = SecurityAnalysisService.generateEntraLink();

            expect(result).toBe('https://entra.microsoft.com/');
        });
    });

    describe('formatPermissionValue', () => {
        it('should return Allowed for value 4', () => {
            const result = SecurityAnalysisService.formatPermissionValue(4);

            expect(result).toBe('Allowed');
        });

        it('should return Not Allowed for value 0', () => {
            const result = SecurityAnalysisService.formatPermissionValue(0);

            expect(result).toBe('Not Allowed');
        });

        it('should return Not Allowed for any non-4 value', () => {
            expect(SecurityAnalysisService.formatPermissionValue(1)).toBe('Not Allowed');
            expect(SecurityAnalysisService.formatPermissionValue(2)).toBe('Not Allowed');
            expect(SecurityAnalysisService.formatPermissionValue(null)).toBe('Not Allowed');
        });
    });

    describe('isPermissionAllowed', () => {
        it('should return true for value 4', () => {
            const result = SecurityAnalysisService.isPermissionAllowed(4);

            expect(result).toBe(true);
        });

        it('should return false for value 0', () => {
            const result = SecurityAnalysisService.isPermissionAllowed(0);

            expect(result).toBe(false);
        });

        it('should return false for any non-4 value', () => {
            expect(SecurityAnalysisService.isPermissionAllowed(1)).toBe(false);
            expect(SecurityAnalysisService.isPermissionAllowed(2)).toBe(false);
            expect(SecurityAnalysisService.isPermissionAllowed(null)).toBe(false);
        });
    });

    describe('getSecuredColumnsForEntity - input validation', () => {
        it('should return empty array when userId is null', async () => {
            const result = await SecurityAnalysisService.getSecuredColumnsForEntity(null, 'account');

            expect(result).toEqual([]);
        });

        it('should return empty array when entityLogicalName is null', async () => {
            const result = await SecurityAnalysisService.getSecuredColumnsForEntity('user-123', null);

            expect(result).toEqual([]);
        });

        it('should return empty array when both params are null', async () => {
            const result = await SecurityAnalysisService.getSecuredColumnsForEntity(null, null);

            expect(result).toEqual([]);
        });
    });

    describe('compareUserSecurity - field permissions for comparison user profiles', () => {
        it('should fetch field permissions for comparison user profiles when entityLogicalName provided', async () => {
            // Mock for current user - remove braces for URL matching
            const currentUserId = 'current-user-id';
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: `{${currentUserId}}` }
            });

            // Use mockImplementation to handle multiple parallel calls based on URL patterns
            WebApiService.webApiFetch.mockImplementation((method, url) => {
                // Handle systemuserroles_association - user direct roles
                if (url.includes('systemuserroles_association')) {
                    if (url.includes('target-user-id')) {
                        return Promise.resolve({ value: [{ roleid: 'role-2', name: 'Role 2', _parentrootroleid_value: 'prole-2' }] });
                    }
                    // Current user roles
                    return Promise.resolve({ value: [{ roleid: 'role-1', name: 'Role 1', _parentrootroleid_value: 'prole-1' }] });
                }
                // Handle teammembership_association - team membership
                if (url.includes('teammembership_association')) {
                    return Promise.resolve({ value: [] });
                }
                // Handle teamroles_association - team roles
                if (url.includes('teamroles_association')) {
                    return Promise.resolve({ value: [] });
                }
                // Handle systemuserprofiles_association - user field security profiles
                if (url.includes('systemuserprofiles_association')) {
                    if (url.includes('target-user-id')) {
                        return Promise.resolve({ value: [{ fieldsecurityprofileid: 'fsp-target', name: 'Target Profile' }] });
                    }
                    // Current user profiles - when comparison user is null
                    if (url.includes(currentUserId)) {
                        return Promise.resolve({ value: [{ fieldsecurityprofileid: 'fsp-current', name: 'Current Profile' }] });
                    }
                    return Promise.resolve({ value: [] });
                }
                // Handle team field security profiles
                if (url.includes('teamprofiles_association')) {
                    return Promise.resolve({ value: [] });
                }
                // Handle EntityDefinitions for object type code
                if (url.includes('EntityDefinitions') && url.includes('ObjectTypeCode')) {
                    return Promise.resolve({ ObjectTypeCode: 1 });
                }
                // Handle privileges query
                if (url.includes('privileges')) {
                    return Promise.resolve({ value: [] });
                }
                // Handle roleassociation for privileges
                if (url.includes('roleprivileges_association')) {
                    return Promise.resolve({ value: [] });
                }
                // Handle field permissions
                if (url.includes('fieldpermissions')) {
                    if (url.includes('fsp-target')) {
                        return Promise.resolve({
                            value: [{ entityname: 'account', attributelogicalname: 'revenue', canread: 4, cancreate: 0, canupdate: 0 }]
                        });
                    }
                    if (url.includes('fsp-current')) {
                        return Promise.resolve({
                            value: [{ entityname: 'account', attributelogicalname: 'creditlimit', canread: 4, cancreate: 4, canupdate: 4 }]
                        });
                    }
                    return Promise.resolve({ value: [] });
                }
                // Default for unhandled URLs
                return Promise.resolve({ value: [] });
            });

            const result = await SecurityAnalysisService.compareUserSecurity('target-user-id', 'account', null);

            expect(result.targetUserFieldProfiles).toBeDefined();
            expect(result.comparisonUserFieldProfiles).toBeDefined();
            expect(result.comparisonUserFieldProfiles.length).toBeGreaterThan(0);
            expect(result.comparisonUserFieldProfiles[0].permissions).toBeDefined();
        });
    });

    describe('getSecuredColumnsForEntity - error handling', () => {
        it('should return empty array when error occurs during field permission fetch', async () => {
            // Mock getUserFieldSecurityProfiles to return profiles
            // so we enter the permission fetching loop, then fail on getFieldPermissions
            WebApiService.webApiFetch.mockImplementation((method, url) => {
                if (url.includes('systemuserprofiles_association')) {
                    return Promise.resolve({
                        value: [{ fieldsecurityprofileid: 'fsp-1', name: 'Profile 1' }]
                    });
                }
                if (url.includes('teammembership_association')) {
                    return Promise.resolve({ value: [] });
                }
                if (url.includes('fieldpermissions')) {
                    // Throw error to trigger catch block at lines 950-952
                    throw new Error('Field permissions API Error');
                }
                return Promise.resolve({ value: [] });
            });

            const result = await SecurityAnalysisService.getSecuredColumnsForEntity('user-id', 'account');

            expect(result).toEqual([]);
        });
    });
});
