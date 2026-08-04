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

        it('should keep the assigned role record alongside the root role', async () => {
            WebApiService.webApiFetch
                .mockResolvedValueOnce({
                    value: [{ roleid: 'role-bu-copy', name: 'System Administrator', _parentrootroleid_value: 'role-root' }]
                })
                .mockResolvedValueOnce({ value: [] });

            const result = await SecurityAnalysisService.getUserRoles('user-123');

            expect(result[0].roleid).toBe('role-root');
            expect(result[0].sourceRoleIds).toEqual(['role-bu-copy']);
        });

        it('should collect every business-unit copy behind one root role', async () => {
            WebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [] })
                .mockResolvedValueOnce({ value: [{ teamid: 'team-1', name: 'Team One' }, { teamid: 'team-2', name: 'Team Two' }] })
                .mockResolvedValueOnce({ value: [{ roleid: 'copy-a', name: 'Shared Role', _parentrootroleid_value: 'role-root' }] })
                .mockResolvedValueOnce({ value: [{ roleid: 'copy-b', name: 'Shared Role', _parentrootroleid_value: 'role-root' }] });

            const result = await SecurityAnalysisService.getUserRoles('user-123');

            expect(result).toHaveLength(1);
            expect(result[0].sourceRoleIds).toEqual(['copy-a', 'copy-b']);
        });
    });

    describe('_attachFieldPermissions', () => {
        it('should fetch every profile in parallel rather than one after another', async () => {
            // A user can hold many field security profiles; the sequential version made one round
            // trip per profile per user, on a path the preview overlay hits on every toggle.
            let inFlight = 0;
            let peak = 0;
            WebApiService.webApiFetch.mockImplementation(() => {
                inFlight++;
                peak = Math.max(peak, inFlight);
                return Promise.resolve({ value: [] }).finally(() => { inFlight--; });
            });

            const profiles = [
                { fieldsecurityprofileid: 'p1', name: 'A' },
                { fieldsecurityprofileid: 'p2', name: 'B' },
                { fieldsecurityprofileid: 'p3', name: 'C' }
            ];

            await SecurityAnalysisService._attachFieldPermissions(profiles, 'account', vi.fn());

            expect(peak).toBe(3);
            expect(profiles.every(p => Array.isArray(p.permissions))).toBe(true);
        });

        it('should do nothing without an entity name', async () => {
            const profiles = [{ fieldsecurityprofileid: 'p1', name: 'A' }];

            await SecurityAnalysisService._attachFieldPermissions(profiles, null, vi.fn());

            expect(WebApiService.webApiFetch).not.toHaveBeenCalled();
            expect(profiles[0].permissions).toBeUndefined();
        });

        it('should tolerate an empty or missing profile list', async () => {
            await expect(SecurityAnalysisService._attachFieldPermissions([], 'account', vi.fn())).resolves.toBeUndefined();
            await expect(SecurityAnalysisService._attachFieldPermissions(undefined, 'account', vi.fn())).resolves.toBeUndefined();
        });
    });

    describe('hasAnySecurityRole', () => {
        it('should be true when the user holds a direct role', async () => {
            WebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ roleid: 'role-1', name: 'Sales Rep' }] })
                .mockResolvedValueOnce({ value: [] });

            await expect(SecurityAnalysisService.hasAnySecurityRole('user-123')).resolves.toBe(true);
        });

        it('should be false when the user holds none', async () => {
            WebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [] })
                .mockResolvedValueOnce({ value: [] });

            await expect(SecurityAnalysisService.hasAnySecurityRole('user-123')).resolves.toBe(false);
        });

        it('should throw rather than report "no roles" when the lookup fails', async () => {
            // getUserRoles swallows errors into an empty array; a warning built on that would fire
            // on every outage.
            WebApiService.webApiFetch.mockRejectedValue(new Error('HTTP 403 Forbidden'));

            await expect(SecurityAnalysisService.hasAnySecurityRole('user-123')).rejects.toThrow('403');
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

        // Table metadata is the authority on which privilege guards which verb, so these ids are
        // arbitrary — only PrivilegeType decides the mapping.
        const accountMetadata = {
            LogicalName: 'account',
            Privileges: [
                { PrivilegeId: 'priv-read', Name: 'prvReadAccount', PrivilegeType: 'Read' },
                { PrivilegeId: 'priv-create', Name: 'prvCreateAccount', PrivilegeType: 'Create' },
                { PrivilegeId: 'priv-write', Name: 'prvWriteAccount', PrivilegeType: 'Write' },
                { PrivilegeId: 'priv-delete', Name: 'prvDeleteAccount', PrivilegeType: 'Delete' }
            ]
        };

        /**
         * Routes webApiFetch by URL rather than call order, so a change in request sequence surfaces
         * as a real failure instead of a silently mismatched mock.
         * @param {Array<[string, object|Function]>} handlers - [url fragment, response or thrower]
         */
        function route(handlers) {
            WebApiService.webApiFetch.mockImplementation((method, path, query = '') => {
                const url = `${path}${query}`;
                for (const [fragment, response] of handlers) {
                    if (url.includes(fragment)) {
                        return typeof response === 'function' ? response(url) : Promise.resolve(response);
                    }
                }
                return Promise.resolve({ value: [] });
            });
        }

        it('should report the depth the platform returns for each held privilege', async () => {
            route([
                ['EntityDefinitions', accountMetadata],
                ['RetrieveUserSetOfPrivilegesByIds', {
                    RolePrivileges: [
                        { PrivilegeId: 'priv-read', Depth: 'Global', PrivilegeName: 'prvReadAccount' },
                        { PrivilegeId: 'priv-write', Depth: 'Local', PrivilegeName: 'prvWriteAccount' },
                        { PrivilegeId: 'priv-delete', Depth: 'Basic', PrivilegeName: 'prvDeleteAccount' }
                    ]
                }]
            ]);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read).toMatchObject({ hasPrivilege: true, depth: 'Global (Org)' });
            expect(result.write).toMatchObject({ hasPrivilege: true, depth: 'Local (BU)' });
            expect(result.delete).toMatchObject({ hasPrivilege: true, depth: 'Basic (User)' });
            expect(result.create).toMatchObject({ hasPrivilege: false, depth: null });
        });

        it('should map Deep depth to its label', async () => {
            route([
                ['EntityDefinitions', accountMetadata],
                ['RetrieveUserSetOfPrivilegesByIds', {
                    RolePrivileges: [{ PrivilegeId: 'priv-read', Depth: 'Deep' }]
                }]
            ]);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read.depth).toBe('Deep (BU + Child)');
        });

        it('should resolve verbs whose privilege name does not contain the table name', async () => {
            // The reported bug: systemuser is guarded by prvReadUser, so any name-suffix match
            // reported "No Access" for an administrator.
            route([
                ['EntityDefinitions', {
                    LogicalName: 'systemuser',
                    Privileges: [
                        { PrivilegeId: 'priv-read-user', Name: 'prvReadUser', PrivilegeType: 'Read' },
                        { PrivilegeId: 'priv-write-user', Name: 'prvWriteUser', PrivilegeType: 'Write' }
                    ]
                }],
                ['RetrieveUserSetOfPrivilegesByIds', {
                    RolePrivileges: [{ PrivilegeId: 'priv-read-user', Depth: 'Global' }]
                }]
            ]);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'systemuser');

            expect(result.read).toMatchObject({ hasPrivilege: true, depth: 'Global (Org)' });
            expect(result.write.hasPrivilege).toBe(false);
        });

        it('should not enumerate the whole privileges table', async () => {
            route([
                ['EntityDefinitions', accountMetadata],
                ['RetrieveUserSetOfPrivilegesByIds', { RolePrivileges: [] }]
            ]);

            await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            const paths = WebApiService.webApiFetch.mock.calls.map(call => `${call[1]}${call[2] || ''}`);
            expect(paths.some(p => p.startsWith('privileges?'))).toBe(false);
        });

        it('should ask only about the privileges that guard the table', async () => {
            route([
                ['EntityDefinitions', accountMetadata],
                ['RetrieveUserSetOfPrivilegesByIds', { RolePrivileges: [] }]
            ]);

            await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            const call = WebApiService.webApiFetch.mock.calls
                .find(c => String(c[1]).includes('RetrieveUserSetOfPrivilegesByIds'));
            expect(call[1]).toContain('systemusers(user-123)');
            expect(decodeURIComponent(call[2])).toBe('?@p1=["priv-read","priv-create","priv-write","priv-delete"]');
        });

        it('should keep the strongest depth when a privilege is granted more than once', async () => {
            route([
                ['EntityDefinitions', accountMetadata],
                ['RetrieveUserSetOfPrivilegesByIds', {
                    RolePrivileges: [
                        { PrivilegeId: 'priv-read', Depth: 'Basic' },
                        { PrivilegeId: 'priv-read', Depth: 'Deep' },
                        { PrivilegeId: 'priv-read', Depth: 'Local' }
                    ]
                }]
            ]);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read.depth).toBe('Deep (BU + Child)');
        });

        it('should accept an ordinal Depth as well as the enum name', async () => {
            route([
                ['EntityDefinitions', accountMetadata],
                ['RetrieveUserSetOfPrivilegesByIds', {
                    RolePrivileges: [{ PrivilegeId: 'priv-read', Depth: 3 }]
                }]
            ]);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read).toMatchObject({ hasPrivilege: true, depth: 'Global (Org)' });
        });

        it('should ignore an unrecognized Depth rather than invent a level', async () => {
            route([
                ['EntityDefinitions', accountMetadata],
                ['RetrieveUserSetOfPrivilegesByIds', {
                    RolePrivileges: [{ PrivilegeId: 'priv-read', Depth: 'Sideways' }]
                }]
            ]);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read).toMatchObject({ hasPrivilege: false, depth: null });
        });

        it('should ignore privileges that belong to another table', async () => {
            route([
                ['EntityDefinitions', accountMetadata],
                ['RetrieveUserSetOfPrivilegesByIds', {
                    RolePrivileges: [{ PrivilegeId: 'priv-read-contact', Depth: 'Global' }]
                }]
            ]);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            privilegeTypes.forEach(type => {
                expect(result[type]).toMatchObject({ hasPrivilege: false, depth: null });
            });
        });

        it('should match privilege ids regardless of GUID casing', async () => {
            route([
                ['EntityDefinitions', {
                    LogicalName: 'account',
                    Privileges: [{ PrivilegeId: 'A1B2C3D4-0000-0000-0000-000000000001', Name: 'prvReadAccount', PrivilegeType: 'Read' }]
                }],
                ['RetrieveUserSetOfPrivilegesByIds', {
                    RolePrivileges: [{ PrivilegeId: 'a1b2c3d4-0000-0000-0000-000000000001', Depth: 'Global' }]
                }]
            ]);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read.hasPrivilege).toBe(true);
        });

        it('should fall back to RetrieveUserPrivileges when the set-based call is rejected', async () => {
            route([
                ['EntityDefinitions', accountMetadata],
                ['RetrieveUserSetOfPrivilegesByIds', () => Promise.reject(new Error('HTTP 400 Bad Request'))],
                ['RetrieveUserPrivileges', {
                    RolePrivileges: [{ PrivilegeId: 'priv-read', Depth: 'Global' }]
                }]
            ]);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read).toMatchObject({ hasPrivilege: true, depth: 'Global (Org)' });
        });

        it('should flag the result as unavailable when table metadata cannot be read', async () => {
            route([
                ['EntityDefinitions', () => Promise.reject(new Error('HTTP 403 Forbidden'))]
            ]);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.unavailable).toContain('403');
            privilegeTypes.forEach(type => {
                expect(result[type]).toMatchObject({ hasPrivilege: false, depth: null });
            });
        });

        it('should flag the result as unavailable when both privilege lookups fail', async () => {
            route([
                ['EntityDefinitions', accountMetadata],
                ['RetrieveUserSetOfPrivilegesByIds', () => Promise.reject(new Error('HTTP 400 Bad Request'))],
                ['RetrieveUserPrivileges', () => Promise.reject(new Error('HTTP 403 Forbidden'))]
            ]);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.unavailable).toContain('403');
        });

        it('should not flag unavailable when the table simply exposes no privileges', async () => {
            route([
                ['EntityDefinitions', { LogicalName: 'account', Privileges: [] }]
            ]);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.unavailable).toBeUndefined();
            privilegeTypes.forEach(type => {
                expect(result[type]).toMatchObject({ hasPrivilege: false, depth: null });
            });
        });

        it('should name the roles that grant each held privilege', async () => {
            route([
                ['EntityDefinitions', accountMetadata],
                ['RetrieveUserSetOfPrivilegesByIds', {
                    RolePrivileges: [{ PrivilegeId: 'priv-read', Depth: 'Global' }]
                }],
                ['systemuserroles_association', { value: [{ roleid: 'role-1', name: 'System Administrator' }] }],
                ['teammembership_association', { value: [] }],
                ['roleprivilegescollection', {
                    value: [{ roleid: 'role-1', privilegeid: 'priv-read' }]
                }]
            ]);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read.roles).toEqual(['System Administrator']);
        });

        it('should look up granting roles by the assigned role record, not only the root role', async () => {
            // A user in a child business unit is assigned a copy of the role; roleprivilegescollection
            // is keyed by that copy, not by the root role the comparison view uses.
            route([
                ['EntityDefinitions', accountMetadata],
                ['RetrieveUserSetOfPrivilegesByIds', {
                    RolePrivileges: [{ PrivilegeId: 'priv-read', Depth: 'Global' }]
                }],
                ['systemuserroles_association', {
                    value: [{ roleid: 'role-bu-copy', name: 'System Administrator', _parentrootroleid_value: 'role-root' }]
                }],
                ['teammembership_association', { value: [] }],
                ['roleprivilegescollection', {
                    value: [{ roleid: 'role-bu-copy', privilegeid: 'priv-read' }]
                }]
            ]);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read.roles).toEqual(['System Administrator']);
        });

        it('should still report privileges when role attribution fails', async () => {
            route([
                ['EntityDefinitions', accountMetadata],
                ['RetrieveUserSetOfPrivilegesByIds', {
                    RolePrivileges: [{ PrivilegeId: 'priv-read', Depth: 'Global' }]
                }],
                ['systemuserroles_association', { value: [{ roleid: 'role-1', name: 'System Administrator' }] }],
                ['teammembership_association', { value: [] }],
                ['roleprivilegescollection', () => Promise.reject(new Error('HTTP 403 Forbidden'))]
            ]);

            const result = await SecurityAnalysisService.getUserEntityPrivileges('user-123', 'account');

            expect(result.read).toMatchObject({ hasPrivilege: true, depth: 'Global (Org)' });
            expect(result.read.roles).toEqual([]);
            expect(result.unavailable).toBeUndefined();
        });

        it('should use the current user when no userId is provided', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{current-user-id}' }
            });
            route([
                ['EntityDefinitions', accountMetadata],
                ['RetrieveUserSetOfPrivilegesByIds', { RolePrivileges: [] }]
            ]);

            await SecurityAnalysisService.getUserEntityPrivileges(null, 'account');

            const call = WebApiService.webApiFetch.mock.calls
                .find(c => String(c[1]).includes('RetrieveUserSetOfPrivilegesByIds'));
            expect(call[1]).toContain('systemusers(current-user-id)');
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
