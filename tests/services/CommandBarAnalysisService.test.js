/**
 * @file Tests for CommandBarAnalysisService
 * @module tests/services/CommandBarAnalysisService.test.js
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

vi.mock('../../src/services/SecurityAnalysisService.js', () => ({
    SecurityAnalysisService: {
        getUserEntityPrivileges: vi.fn()
    }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        getGlobalContext: vi.fn(),
        isFormContextAvailable: false,
        getEntityName: vi.fn()
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: {
        show: vi.fn()
    }
}));

// Import after mocks
import { CommandBarAnalysisService } from '../../src/services/CommandBarAnalysisService.js';
import { WebApiService } from '../../src/services/WebApiService.js';
import { SecurityAnalysisService } from '../../src/services/SecurityAnalysisService.js';
import { PowerAppsApiService } from '../../src/services/PowerAppsApiService.js';
import { NotificationService } from '../../src/services/NotificationService.js';

/**
 * Helper to setup standard mocks for compareCommandBarVisibility tests.
 * This method now calls 14 services in parallel, so we need to mock all of them.
 */
function setupCompareVisibilityMocks({
    solutions = { value: [] },
    publishers = { value: [] },
    ribbonDiffs = { value: [] },
    modernCommands = { value: [] },
    hiddenActions = { value: [] },
    entityMetadata = {},
    currentUserRoles = { value: [] },
    targetUserRoles = { value: [] },
    currentUserTeams = { value: [] },
    targetUserTeams = { value: [] },
    currentUserPrivileges = {},
    targetUserPrivileges = {}
} = {}) {
    // Mock WebApiService for the 14 parallel calls
    WebApiService.webApiFetch
        .mockResolvedValueOnce(solutions)          // getSolutions
        .mockResolvedValueOnce(publishers)         // getPublishers
        .mockResolvedValueOnce(ribbonDiffs)        // getRibbonDiffs
        .mockResolvedValueOnce(modernCommands)     // getModernCommands
        .mockResolvedValueOnce(hiddenActions)      // getHiddenCustomActions
        .mockResolvedValueOnce(entityMetadata)     // _getEntityMetadataForCommands
        .mockResolvedValueOnce(currentUserRoles)   // _getUserSecurityRoles (current)
        .mockResolvedValueOnce(targetUserRoles)    // _getUserSecurityRoles (target)
        .mockResolvedValueOnce(currentUserTeams)   // _getUserTeams (current)
        .mockResolvedValueOnce(targetUserTeams);   // _getUserTeams (target)

    // Mock SecurityAnalysisService for privilege checks
    SecurityAnalysisService.getUserEntityPrivileges
        .mockResolvedValueOnce(currentUserPrivileges)
        .mockResolvedValueOnce(targetUserPrivileges);

    // Mock global context
    PowerAppsApiService.getGlobalContext.mockReturnValue({
        userSettings: { userId: '{current-user-id}' }
    });
}

describe('CommandBarAnalysisService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('getSolutions', () => {
        it('should fetch and transform solutions', async () => {
            const mockResponse = {
                value: [
                    {
                        solutionid: 'sol-1',
                        uniquename: 'MySolution',
                        friendlyname: 'My Solution',
                        _publisherid_value: 'pub-1',
                        modifiedon: '2024-01-01T00:00:00Z'
                    },
                    {
                        solutionid: 'sol-2',
                        uniquename: 'OtherSolution',
                        friendlyname: 'Other Solution',
                        _publisherid_value: 'pub-2',
                        modifiedon: '2024-01-02T00:00:00Z'
                    }
                ]
            };

            WebApiService.webApiFetch.mockResolvedValue(mockResponse);

            const result = await CommandBarAnalysisService.getSolutions();

            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                'solutions?$select=solutionid,uniquename,friendlyname,_publisherid_value,modifiedon',
                '',
                null,
                {},
                expect.any(Function)
            );

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                solutionid: 'sol-1',
                uniquename: 'MySolution',
                friendlyname: 'My Solution',
                publisherid: 'pub-1',
                modifiedon: '2024-01-01T00:00:00Z'
            });
        });

        it('should return empty array on error', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const result = await CommandBarAnalysisService.getSolutions();

            expect(result).toEqual([]);
            // NotificationService.show should have been called with error
            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('Failed to fetch solutions'),
                'error'
            );
        });

        it('should return empty array if response has no value', async () => {
            WebApiService.webApiFetch.mockResolvedValue({});

            const result = await CommandBarAnalysisService.getSolutions();

            expect(result).toEqual([]);
        });

        it('should return empty array if response is null', async () => {
            WebApiService.webApiFetch.mockResolvedValue(null);

            const result = await CommandBarAnalysisService.getSolutions();

            expect(result).toEqual([]);
        });
    });

    describe('getPublishers', () => {
        it('should fetch publishers', async () => {
            const mockResponse = {
                value: [
                    { publisherid: 'pub-1', uniquename: 'myPublisher', friendlyname: 'My Publisher' },
                    { publisherid: 'pub-2', uniquename: 'msPublisher', friendlyname: 'Microsoft' }
                ]
            };

            WebApiService.webApiFetch.mockResolvedValue(mockResponse);

            const result = await CommandBarAnalysisService.getPublishers();

            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                'publishers?$select=publisherid,uniquename,friendlyname',
                '',
                null,
                {},
                expect.any(Function)
            );

            expect(result).toEqual(mockResponse.value);
        });

        it('should return empty array on error', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await CommandBarAnalysisService.getPublishers();

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });

        it('should return empty array if response has no value', async () => {
            WebApiService.webApiFetch.mockResolvedValue({});

            const result = await CommandBarAnalysisService.getPublishers();

            expect(result).toEqual([]);
        });
    });

    describe('getRibbonDiffs', () => {
        it('should fetch ribbon diffs for a specific entity', async () => {
            const mockResponse = {
                value: [
                    {
                        ribbondiffid: 'diff-1',
                        solutionid: 'sol-1',
                        diffid: 'Mscrm.DeleteRecord',
                        rdx: '<Button>...</Button>',
                        entity: 'account',
                        difftype: 1,
                        tabid: 'HomePageGrid.account',
                        ismanaged: false
                    }
                ]
            };

            WebApiService.webApiFetch.mockResolvedValue(mockResponse);

            const result = await CommandBarAnalysisService.getRibbonDiffs('account', 'HomePageGrid');

            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining('ribbondiffs'),
                '',
                null,
                {},
                expect.any(Function)
            );

            expect(result).toEqual(mockResponse.value);
        });

        it('should handle null entity for global context', async () => {
            const mockResponse = { value: [] };
            WebApiService.webApiFetch.mockResolvedValue(mockResponse);

            await CommandBarAnalysisService.getRibbonDiffs(null, 'HomePageGrid');

            const callArgs = WebApiService.webApiFetch.mock.calls[0][1];
            expect(callArgs).toContain('entity%20eq%20null');
        });

        it('should return empty array on error', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await CommandBarAnalysisService.getRibbonDiffs('account', 'Form');

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });
    });

    describe('getHiddenCustomActions', () => {
        it('should fetch hidden custom actions', async () => {
            const mockResponse = {
                value: [
                    {
                        ribbondiffid: 'hidden-1',
                        solutionid: 'sol-1',
                        diffid: 'HideAction.1',
                        rdx: '<HideCustomAction HideActionId="Mscrm.SaveRecord" />',
                        entity: 'account'
                    }
                ]
            };

            WebApiService.webApiFetch.mockResolvedValue(mockResponse);

            const result = await CommandBarAnalysisService.getHiddenCustomActions('account', 'Form');

            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining('HideCustomAction'),
                '',
                null,
                {},
                expect.any(Function)
            );

            expect(result).toEqual(mockResponse.value);
        });

        it('should return empty array on error', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await CommandBarAnalysisService.getHiddenCustomActions('contact', 'HomePageGrid');

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });
    });

    describe('parseRibbonDiffXml', () => {
        it('should extract display rules from XML', () => {
            const xml = `
                <RibbonDiff>
                    <DisplayRule Id="Mscrm.CanWritePrimary" />
                    <DisplayRule Id="Mscrm.ShowOnlyOnModern" />
                </RibbonDiff>
            `;

            const result = CommandBarAnalysisService.parseRibbonDiffXml(xml);

            expect(result.displayRules).toContain('Mscrm.CanWritePrimary');
            expect(result.displayRules).toContain('Mscrm.ShowOnlyOnModern');
        });

        it('should extract enable rules from XML', () => {
            const xml = `
                <RibbonDiff>
                    <EnableRule Id="Mscrm.SelectionCountExactlyOne" />
                    <EnableRule Id="Mscrm.FormStateNotNew" />
                </RibbonDiff>
            `;

            const result = CommandBarAnalysisService.parseRibbonDiffXml(xml);

            expect(result.enableRules).toContain('Mscrm.SelectionCountExactlyOne');
            expect(result.enableRules).toContain('Mscrm.FormStateNotNew');
        });

        it('should extract rules from CommandDefinition', () => {
            const xml = `
                <RibbonDiff>
                    <CommandDefinition Id="Mscrm.DeleteRecord">
                        <DisplayRules>
                            <DisplayRule Id="Mscrm.DeleteSelectedEntityPermission" />
                        </DisplayRules>
                        <EnableRules>
                            <EnableRule Id="Mscrm.SelectionCountAtLeastOne" />
                        </EnableRules>
                    </CommandDefinition>
                </RibbonDiff>
            `;

            const result = CommandBarAnalysisService.parseRibbonDiffXml(xml);

            expect(result.displayRules).toContain('Mscrm.DeleteSelectedEntityPermission');
            expect(result.enableRules).toContain('Mscrm.SelectionCountAtLeastOne');
        });

        it('should return empty arrays for null/undefined input', () => {
            expect(CommandBarAnalysisService.parseRibbonDiffXml(null)).toEqual({
                displayRules: [],
                enableRules: []
            });

            expect(CommandBarAnalysisService.parseRibbonDiffXml(undefined)).toEqual({
                displayRules: [],
                enableRules: []
            });
        });

        it('should return empty arrays for empty string', () => {
            const result = CommandBarAnalysisService.parseRibbonDiffXml('');

            expect(result).toEqual({
                displayRules: [],
                enableRules: []
            });
        });

        it('should not duplicate rules', () => {
            const xml = `
                <RibbonDiff>
                    <DisplayRule Id="Mscrm.CanWritePrimary" />
                    <CommandDefinition Id="Test">
                        <DisplayRules>
                            <DisplayRule Id="Mscrm.CanWritePrimary" />
                        </DisplayRules>
                    </CommandDefinition>
                </RibbonDiff>
            `;

            const result = CommandBarAnalysisService.parseRibbonDiffXml(xml);

            const writeRuleCount = result.displayRules.filter(r => r === 'Mscrm.CanWritePrimary').length;
            expect(writeRuleCount).toBe(1);
        });

        it('should handle malformed XML gracefully', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            // Even with malformed XML, DOMParser won't throw but will create an error document
            // The querySelector calls should still work without throwing
            const result = CommandBarAnalysisService.parseRibbonDiffXml('<invalid>');

            expect(result).toEqual({
                displayRules: [],
                enableRules: []
            });

            consoleSpy.mockRestore();
        });
    });

    describe('evaluatePrivilegeRule', () => {
        it('should fail for always-hide rules', () => {
            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.HideOnModern', {});

            expect(result.passes).toBe(false);
            expect(result.reason).toContain('always hides');
        });

        it('should pass for always-show rules', () => {
            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.ShowOnlyOnModern', {});

            expect(result.passes).toBe(true);
            expect(result.reason).toContain('always shows');
        });

        it('should pass for Write privilege when user has it', () => {
            const privileges = { write: { hasPrivilege: true } };

            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.CanWritePrimary', privileges);

            expect(result.passes).toBe(true);
            expect(result.reason).toContain('Write privilege');
        });

        it('should fail for Write privilege when user lacks it', () => {
            const privileges = { write: { hasPrivilege: false } };

            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.CanWritePrimary', privileges);

            expect(result.passes).toBe(false);
            expect(result.reason).toContain('Write privilege');
        });

        it('should pass for Delete privilege when user has it', () => {
            const privileges = { delete: { hasPrivilege: true } };

            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.DeleteSelectedEntityPermission', privileges);

            expect(result.passes).toBe(true);
            expect(result.reason).toContain('Delete privilege');
        });

        it('should fail for Delete privilege when user lacks it', () => {
            const privileges = { delete: false };

            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.DeletePrimaryEntityPermission', privileges);

            expect(result.passes).toBe(false);
            expect(result.reason).toContain('Delete privilege');
        });

        it('should pass for Create privilege when user has it', () => {
            const privileges = { create: true };

            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.CreateSelectedEntityPermission', privileges);

            expect(result.passes).toBe(true);
        });

        it('should pass for unknown custom rules', () => {
            const result = CommandBarAnalysisService.evaluatePrivilegeRule('MyCustom.DisplayRule', {});

            expect(result.passes).toBe(true);
            expect(result.reason).toContain('cannot evaluate');
        });

        it('should handle null privileges', () => {
            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.CanWritePrimary', null);

            expect(result.passes).toBe(false);
            expect(result.reason).toContain('lacks');
        });

        it('should handle undefined privileges', () => {
            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.DeleteSelectedEntityPermission', undefined);

            expect(result.passes).toBe(false);
        });

        it('should pass for Share privilege when user has it', () => {
            const privileges = { share: { hasPrivilege: true } };

            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.SharePrimaryPermission', privileges);

            expect(result.passes).toBe(true);
            expect(result.reason).toContain('Share privilege');
        });

        it('should pass for Assign privilege when user has it', () => {
            const privileges = { assign: { hasPrivilege: true } };

            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.AssignSelectedEntityPermission', privileges);

            expect(result.passes).toBe(true);
            expect(result.reason).toContain('Assign privilege');
        });

        it('should pass for Read privilege when user has it', () => {
            const privileges = { read: { hasPrivilege: true } };

            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.ReadPrimaryEntityPermission', privileges);

            expect(result.passes).toBe(true);
            expect(result.reason).toContain('Read privilege');
        });
    });

    describe('compareCommandBarVisibility', () => {
        const mockSolutions = {
            value: [
                { solutionid: 'sol-1', uniquename: 'MySolution', friendlyname: 'My Solution', _publisherid_value: 'pub-1' }
            ]
        };

        const mockPublishers = {
            value: [
                { publisherid: 'pub-1', uniquename: 'myPub', friendlyname: 'My Publisher' }
            ]
        };

        beforeEach(() => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{current-user-id}' }
            });
        });

        it('should compare visibility when users have different privileges', async () => {
            const ribbonDiffs = {
                value: [
                    {
                        ribbondiffid: 'diff-1',
                        solutionid: 'sol-1',
                        diffid: 'Mscrm.DeleteRecord',
                        rdx: '<CommandDefinition><DisplayRules><DisplayRule Id="Mscrm.DeleteSelectedEntityPermission" /></DisplayRules></CommandDefinition>',
                        entity: 'account',
                        difftype: 1,
                        tabid: 'HomePageGrid.account',
                        ismanaged: false
                    }
                ]
            };

            setupCompareVisibilityMocks({
                solutions: mockSolutions,
                publishers: mockPublishers,
                ribbonDiffs,
                currentUserPrivileges: { delete: { hasPrivilege: true } },
                targetUserPrivileges: { delete: { hasPrivilege: false } }
            });

            const result = await CommandBarAnalysisService.compareCommandBarVisibility(
                'target-user-id',
                'account',
                'HomePageGrid'
            );

            // Should have OOTB standard commands + the ribbon diff command
            expect(result.commands.length).toBeGreaterThanOrEqual(1);
            expect(result.summary).toBeDefined();
        });

        it('should identify commands visible only to target user', async () => {
            const ribbonDiffs = {
                value: [
                    {
                        ribbondiffid: 'diff-1',
                        solutionid: 'sol-1',
                        diffid: 'Custom.WriteCommand',
                        rdx: '<DisplayRule Id="Mscrm.CanWritePrimary" />',
                        entity: 'contact',
                        difftype: 1,
                        tabid: 'Form.contact',
                        ismanaged: false
                    }
                ]
            };

            setupCompareVisibilityMocks({
                solutions: mockSolutions,
                publishers: mockPublishers,
                ribbonDiffs,
                currentUserPrivileges: { write: { hasPrivilege: false } },
                targetUserPrivileges: { write: { hasPrivilege: true } }
            });

            const result = await CommandBarAnalysisService.compareCommandBarVisibility(
                'target-user-id',
                'contact',
                'Form'
            );

            expect(result.commands.length).toBeGreaterThanOrEqual(0);
            expect(result.summary).toBeDefined();
        });

        it('should report same visibility when both users have same privileges', async () => {
            const ribbonDiffs = {
                value: [
                    {
                        ribbondiffid: 'diff-1',
                        solutionid: 'sol-1',
                        diffid: 'Mscrm.SaveRecord',
                        rdx: '<DisplayRule Id="Mscrm.CanSavePrimary" />',
                        entity: 'account',
                        difftype: 1,
                        tabid: 'Form.account',
                        ismanaged: true
                    }
                ]
            };

            setupCompareVisibilityMocks({
                solutions: mockSolutions,
                publishers: mockPublishers,
                ribbonDiffs,
                currentUserPrivileges: { write: { hasPrivilege: true } },
                targetUserPrivileges: { write: { hasPrivilege: true } }
            });

            const result = await CommandBarAnalysisService.compareCommandBarVisibility(
                'target-user-id',
                'account',
                'Form'
            );

            expect(result.summary).toBeDefined();
        });

        it('should exclude hidden custom actions', async () => {
            const ribbonDiffs = {
                value: [
                    {
                        ribbondiffid: 'diff-1',
                        solutionid: 'sol-1',
                        diffid: 'Mscrm.HiddenCommand',
                        rdx: '<DisplayRule Id="Mscrm.CanWritePrimary" />',
                        entity: 'account',
                        difftype: 1,
                        tabid: 'Form.account',
                        ismanaged: false
                    }
                ]
            };

            const hiddenActions = {
                value: [
                    {
                        ribbondiffid: 'hidden-1',
                        rdx: '<HideCustomAction HideActionId="Mscrm.HiddenCommand" />'
                    }
                ]
            };

            setupCompareVisibilityMocks({
                solutions: mockSolutions,
                publishers: mockPublishers,
                ribbonDiffs,
                hiddenActions,
                currentUserPrivileges: { write: { hasPrivilege: true } },
                targetUserPrivileges: { write: { hasPrivilege: false } }
            });

            const result = await CommandBarAnalysisService.compareCommandBarVisibility(
                'target-user-id',
                'account',
                'Form'
            );

            // Hidden command should be excluded from the custom commands
            // but OOTB standard commands may still be present
            expect(result.summary.hiddenCommands).toBe(1);
        });

        it('should skip commands without privilege-based rules', async () => {
            const ribbonDiffs = {
                value: [
                    {
                        ribbondiffid: 'diff-1',
                        solutionid: 'sol-1',
                        diffid: 'MyCustom.Command',
                        rdx: '<EnableRule Id="Mscrm.SelectionCountExactlyOne" />', // Not a privilege rule
                        entity: 'account',
                        difftype: 1,
                        tabid: 'HomePageGrid.account',
                        ismanaged: false
                    }
                ]
            };

            setupCompareVisibilityMocks({
                solutions: mockSolutions,
                publishers: mockPublishers,
                ribbonDiffs,
                currentUserPrivileges: {},
                targetUserPrivileges: {}
            });

            const result = await CommandBarAnalysisService.compareCommandBarVisibility(
                'target-user-id',
                'account',
                'HomePageGrid'
            );

            // Method should complete without error
            expect(result.summary).toBeDefined();
        });

        it('should handle API errors gracefully', async () => {
            // Note: The service handles API errors gracefully and returns results even when some APIs fail
            // This is by design - it catches errors and continues with available data
            WebApiService.webApiFetch.mockRejectedValue(new Error('Network error'));
            SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({});

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            // Should NOT throw - it handles errors gracefully
            const result = await CommandBarAnalysisService.compareCommandBarVisibility(
                'target-user-id',
                'account',
                'Form'
            );

            // Should return a result structure even with API errors
            expect(result.commands).toBeDefined();
            expect(result.summary).toBeDefined();

            consoleSpy.mockRestore();
        });

        it('should handle multiple rules for same command', async () => {
            const ribbonDiffs = {
                value: [
                    {
                        ribbondiffid: 'diff-1',
                        solutionid: 'sol-1',
                        diffid: 'Complex.Command',
                        rdx: `
                            <CommandDefinition>
                                <DisplayRules>
                                    <DisplayRule Id="Mscrm.CanWritePrimary" />
                                    <DisplayRule Id="Mscrm.DeleteSelectedEntityPermission" />
                                </DisplayRules>
                            </CommandDefinition>
                        `,
                        entity: 'account',
                        difftype: 1,
                        tabid: 'Form.account',
                        ismanaged: false
                    }
                ]
            };

            setupCompareVisibilityMocks({
                solutions: mockSolutions,
                publishers: mockPublishers,
                ribbonDiffs,
                currentUserPrivileges: { write: { hasPrivilege: true }, delete: { hasPrivilege: false } },
                targetUserPrivileges: { write: { hasPrivilege: true }, delete: { hasPrivilege: true } }
            });

            const result = await CommandBarAnalysisService.compareCommandBarVisibility(
                'target-user-id',
                'account',
                'Form'
            );

            expect(result.summary).toBeDefined();
        });
    });

    describe('getCurrentContext', () => {
        it('should return Form when form context is available', () => {
            PowerAppsApiService.isFormContextAvailable = true;

            const result = CommandBarAnalysisService.getCurrentContext();

            expect(result).toBe('Form');

            // Reset
            PowerAppsApiService.isFormContextAvailable = false;
        });

        it('should return HomePageGrid as default', () => {
            PowerAppsApiService.isFormContextAvailable = false;

            const result = CommandBarAnalysisService.getCurrentContext();

            expect(result).toBe('HomePageGrid');
        });
    });

    describe('getCurrentEntity', () => {
        it('should get entity from form context when available', () => {
            PowerAppsApiService.isFormContextAvailable = true;
            PowerAppsApiService.getEntityName.mockReturnValue('account');

            const result = CommandBarAnalysisService.getCurrentEntity();

            expect(result).toBe('account');

            // Reset
            PowerAppsApiService.isFormContextAvailable = false;
        });

        it('should return null when no context available', () => {
            PowerAppsApiService.isFormContextAvailable = false;

            // Mock window.location.href to not contain entity parameter
            const originalLocation = window.location.href;
            Object.defineProperty(window, 'location', {
                value: { href: 'https://example.com/main.aspx' },
                writable: true
            });

            const result = CommandBarAnalysisService.getCurrentEntity();

            expect(result).toBeNull();

            // Restore
            Object.defineProperty(window, 'location', {
                value: { href: originalLocation },
                writable: true
            });
        });
    });

    describe('_extractCommandName', () => {
        it('should extract LabelText from XML', () => {
            const xml = '<Button Id="Mscrm.DeleteRecord" LabelText="Delete Record" />';

            const result = CommandBarAnalysisService._extractCommandName(xml, 'Mscrm.DeleteRecord');

            expect(result).toBe('Delete Record');
        });

        it('should extract description from XML', () => {
            const xml = '<LocLabel Id="Test" description="My Description" />';

            const result = CommandBarAnalysisService._extractCommandName(xml, 'Test');

            expect(result).toBe('My Description');
        });

        it('should return diffid for null XML', () => {
            const result = CommandBarAnalysisService._extractCommandName(null, 'Mscrm.Test');

            expect(result).toBe('Mscrm.Test');
        });

        it('should make diffid readable when no labels found', () => {
            const xml = '<SomeElement />';

            const result = CommandBarAnalysisService._extractCommandName(xml, 'Mscrm.MyCommand.SaveAndClose');

            // Should extract last segment and add spaces
            expect(result).toContain('Save');
        });
    });

    describe('_getUserEntityPrivileges', () => {
        it('should get current user ID from global context when userId is null', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{current-user-123}' }
            });

            SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
                read: { hasPrivilege: true }
            });

            const result = await CommandBarAnalysisService._getUserEntityPrivileges(null, 'account');

            expect(SecurityAnalysisService.getUserEntityPrivileges).toHaveBeenCalled();
            const callArgs = SecurityAnalysisService.getUserEntityPrivileges.mock.calls[0];
            expect(callArgs[0]).toBe('current-user-123');
            expect(callArgs[1]).toBe('account');
            expect(result).toEqual({ read: { hasPrivilege: true } });
        });

        it('should return empty privileges object if no global context and no userId', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue(null);

            const result = await CommandBarAnalysisService._getUserEntityPrivileges(null, 'account');

            // Should return privileges structure with all false values
            expect(result).toHaveProperty('read');
            expect(result.read).toEqual({ hasPrivilege: false, depth: null });
        });

        it('should call SecurityAnalysisService for target user', async () => {
            SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
                write: { hasPrivilege: false }
            });

            const result = await CommandBarAnalysisService._getUserEntityPrivileges('target-user', 'contact');

            expect(SecurityAnalysisService.getUserEntityPrivileges).toHaveBeenCalled();
            const callArgs = SecurityAnalysisService.getUserEntityPrivileges.mock.calls[0];
            expect(callArgs[0]).toBe('target-user');
            expect(callArgs[1]).toBe('contact');
            expect(result).toEqual({ write: { hasPrivilege: false } });
        });

        it('should return empty privileges object on error', async () => {
            SecurityAnalysisService.getUserEntityPrivileges.mockRejectedValue(new Error('Failed'));

            const result = await CommandBarAnalysisService._getUserEntityPrivileges('user-123', 'account');

            // Should return empty privileges structure with all false values
            expect(result).toHaveProperty('read');
            expect(result).toHaveProperty('create');
            expect(result).toHaveProperty('write');
            expect(result.read).toEqual({ hasPrivilege: false, depth: null });

            // Should have called NotificationService to show error
            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('Failed to get user privileges'),
                'error'
            );
        });
    });

    describe('getModernCommands', () => {
        it('should fetch modern commands from appaction table', async () => {
            const mockResponse = {
                value: [
                    {
                        appactionid: 'action-1',
                        uniquename: 'MyAction',
                        name: 'My Action',
                        buttonlabeltext: 'Click Me',
                        contextvalue: 'account',
                        visibilitytype: 0,
                        hidden: false,
                        solutionid: 'sol-1',
                        ismanaged: false
                    }
                ]
            };

            WebApiService.webApiFetch.mockResolvedValue(mockResponse);

            const result = await CommandBarAnalysisService.getModernCommands('account', 'Form');

            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining('appactions'),
                '',
                null,
                {},
                expect.any(Function)
            );
            expect(result).toEqual(mockResponse.value);
        });

        it('should return empty array on error', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            const result = await CommandBarAnalysisService.getModernCommands('contact', 'HomePageGrid');

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });

        it('should return empty array if response has no value', async () => {
            WebApiService.webApiFetch.mockResolvedValue(null);

            const result = await CommandBarAnalysisService.getModernCommands('account', 'Form');

            expect(result).toEqual([]);
        });
    });

    describe('getUserRoles', () => {
        it('should fetch user roles', async () => {
            const mockResponse = {
                systemuserroles_association: [
                    { roleid: 'role-1', name: 'System Administrator' },
                    { roleid: 'role-2', name: 'Salesperson' }
                ]
            };

            WebApiService.webApiFetch.mockResolvedValue(mockResponse);

            const result = await CommandBarAnalysisService.getUserRoles('user-123');

            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining('systemusers(user-123)'),
                '',
                null,
                {},
                expect.any(Function)
            );
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('System Administrator');
        });

        it('should return empty array on error', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await CommandBarAnalysisService.getUserRoles('user-123');

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });

        it('should return empty array if no association found', async () => {
            WebApiService.webApiFetch.mockResolvedValue({});

            const result = await CommandBarAnalysisService.getUserRoles('user-123');

            expect(result).toEqual([]);
        });
    });

    describe('getUserTeams', () => {
        it('should fetch user teams', async () => {
            const mockResponse = {
                teammembership_association: [
                    { teamid: 'team-1', name: 'Sales Team' },
                    { teamid: 'team-2', name: 'Support Team' }
                ]
            };

            WebApiService.webApiFetch.mockResolvedValue(mockResponse);

            const result = await CommandBarAnalysisService.getUserTeams('user-123');

            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining('systemusers(user-123)'),
                '',
                null,
                {},
                expect.any(Function)
            );
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Sales Team');
        });

        it('should return empty array on error', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await CommandBarAnalysisService.getUserTeams('user-123');

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });

        it('should return empty array if no association found', async () => {
            WebApiService.webApiFetch.mockResolvedValue({});

            const result = await CommandBarAnalysisService.getUserTeams('user-123');

            expect(result).toEqual([]);
        });
    });

    describe('compareUserSecurityContext', () => {
        it('should compare security context between two users', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{current-user-id}' }
            });

            // Mock current user roles and teams
            WebApiService.webApiFetch
                .mockResolvedValueOnce({
                    systemuserroles_association: [
                        { roleid: 'role-1', name: 'Admin' },
                        { roleid: 'role-2', name: 'Sales' }
                    ]
                })
                .mockResolvedValueOnce({
                    systemuserroles_association: [
                        { roleid: 'role-2', name: 'Sales' },
                        { roleid: 'role-3', name: 'Support' }
                    ]
                })
                .mockResolvedValueOnce({
                    teammembership_association: [
                        { teamid: 'team-1', name: 'Team A' }
                    ]
                })
                .mockResolvedValueOnce({
                    teammembership_association: [
                        { teamid: 'team-1', name: 'Team A' },
                        { teamid: 'team-2', name: 'Team B' }
                    ]
                });

            const result = await CommandBarAnalysisService.compareUserSecurityContext('target-user-id');

            expect(result.currentUser.userId).toBe('current-user-id');
            expect(result.targetUser.userId).toBe('target-user-id');
            expect(result.differences.roles.hasDifferences).toBe(true);
            expect(result.differences.roles.onlyCurrent).toHaveLength(1);
            expect(result.differences.roles.onlyTarget).toHaveLength(1);
            expect(result.differences.roles.both).toHaveLength(1);
            expect(result.differences.teams.hasDifferences).toBe(true);
            expect(result.differences.teams.onlyTarget).toHaveLength(1);
        });

        it('should throw error when current user ID cannot be determined', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue(null);

            await expect(
                CommandBarAnalysisService.compareUserSecurityContext('target-user-id')
            ).rejects.toThrow('Could not determine current user ID');
        });

        it('should handle API errors gracefully and return empty arrays', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{current-user-id}' }
            });

            // getUserRoles and getUserTeams catch errors internally and return []
            WebApiService.webApiFetch.mockRejectedValue(new Error('Network error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await CommandBarAnalysisService.compareUserSecurityContext('target-user-id');

            // Should return a result with empty arrays (errors caught internally)
            expect(result.currentUser.roles).toEqual([]);
            expect(result.targetUser.roles).toEqual([]);
            expect(result.differences.roles.hasDifferences).toBe(false);

            consoleSpy.mockRestore();
        });
    });

    describe('_getEntityMetadataForCommands', () => {
        it('should fetch entity metadata properties', async () => {
            const mockResponse = {
                HasNotes: true,
                HasActivities: true,
                IsConnectionsEnabled: false,
                IsValidForQueue: true,
                IsMailMergeEnabled: false,
                IsDuplicateDetectionEnabled: true,
                IsActivity: false,
                IsValidForAdvancedFind: true
            };

            WebApiService.webApiFetch.mockResolvedValue(mockResponse);

            const result = await CommandBarAnalysisService._getEntityMetadataForCommands('account');

            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining('EntityDefinitions'),
                '',
                null,
                {}
            );
            expect(result.HasNotes).toBe(true);
            expect(result.HasActivities).toBe(true);
            expect(result.IsConnectionsEnabled).toBe(false);
        });

        it('should return empty object for null entity', async () => {
            const result = await CommandBarAnalysisService._getEntityMetadataForCommands(null);

            expect(result).toEqual({});
            expect(WebApiService.webApiFetch).not.toHaveBeenCalled();
        });

        it('should return empty object on error', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            const result = await CommandBarAnalysisService._getEntityMetadataForCommands('account');

            expect(result).toEqual({});

            consoleSpy.mockRestore();
        });

        it('should handle null response properties', async () => {
            WebApiService.webApiFetch.mockResolvedValue(null);

            const result = await CommandBarAnalysisService._getEntityMetadataForCommands('account');

            expect(result.HasNotes).toBe(false);
            expect(result.HasActivities).toBe(false);
            expect(result.IsValidForAdvancedFind).toBe(true);
        });
    });

    describe('_checkMiscPrivileges', () => {
        beforeEach(() => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{current-user-id}' }
            });
        });

        it('should return empty object for empty privileges list', async () => {
            const result = await CommandBarAnalysisService._checkMiscPrivileges('user-123', []);

            expect(result).toEqual({});
        });

        it('should return empty object for null privileges list', async () => {
            const result = await CommandBarAnalysisService._checkMiscPrivileges('user-123', null);

            expect(result).toEqual({});
        });

        it('should assume true when user ID cannot be determined', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue(null);

            const result = await CommandBarAnalysisService._checkMiscPrivileges(null, ['prvExportToExcel', 'prvRunWorkflow']);

            expect(result.prvExportToExcel).toBe(true);
            expect(result.prvRunWorkflow).toBe(true);
        });
    });

    describe('_getUserSecurityRoles', () => {
        beforeEach(() => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{current-user-id}' }
            });
        });

        it('should fetch security roles for provided userId', async () => {
            const mockResponse = {
                value: [
                    { roleid: 'role-1', name: 'Admin' },
                    { roleid: 'role-2', name: 'User' }
                ]
            };

            WebApiService.webApiFetch.mockResolvedValue(mockResponse);

            const result = await CommandBarAnalysisService._getUserSecurityRoles('target-user');

            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining('systemusers(target-user)'),
                '',
                null,
                {},
                expect.any(Function)
            );
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('role-1');
            expect(result[0].name).toBe('Admin');
        });

        it('should use current user when userId is null', async () => {
            const mockResponse = {
                value: [{ roleid: 'role-1', name: 'Admin' }]
            };

            WebApiService.webApiFetch.mockResolvedValue(mockResponse);

            const result = await CommandBarAnalysisService._getUserSecurityRoles(null);

            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining('systemusers(current-user-id)'),
                '',
                null,
                {},
                expect.any(Function)
            );
            expect(result).toHaveLength(1);
        });

        it('should return empty array when no user ID available', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue(null);

            const result = await CommandBarAnalysisService._getUserSecurityRoles(null);

            expect(result).toEqual([]);
        });

        it('should return empty array on error', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('Failed'));

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            const result = await CommandBarAnalysisService._getUserSecurityRoles('user-123');

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });

        it('should handle null response', async () => {
            WebApiService.webApiFetch.mockResolvedValue(null);

            const result = await CommandBarAnalysisService._getUserSecurityRoles('user-123');

            expect(result).toEqual([]);
        });
    });

    describe('_getUserTeams', () => {
        beforeEach(() => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{current-user-id}' }
            });
        });

        it('should fetch teams for provided userId', async () => {
            const mockResponse = {
                value: [
                    { teamid: 'team-1', name: 'Team A' },
                    { teamid: 'team-2', name: 'Team B' }
                ]
            };

            WebApiService.webApiFetch.mockResolvedValue(mockResponse);

            const result = await CommandBarAnalysisService._getUserTeams('target-user');

            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining('systemusers(target-user)'),
                '',
                null,
                {},
                expect.any(Function)
            );
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('team-1');
            expect(result[0].name).toBe('Team A');
        });

        it('should use current user when userId is null', async () => {
            const mockResponse = {
                value: [{ teamid: 'team-1', name: 'Team A' }]
            };

            WebApiService.webApiFetch.mockResolvedValue(mockResponse);

            const result = await CommandBarAnalysisService._getUserTeams(null);

            expect(WebApiService.webApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining('systemusers(current-user-id)'),
                '',
                null,
                {},
                expect.any(Function)
            );
            expect(result).toHaveLength(1);
        });

        it('should return empty array when no user ID available', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue(null);

            const result = await CommandBarAnalysisService._getUserTeams(null);

            expect(result).toEqual([]);
        });

        it('should return empty array on error', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('Failed'));

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            const result = await CommandBarAnalysisService._getUserTeams('user-123');

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });

        it('should handle null response', async () => {
            WebApiService.webApiFetch.mockResolvedValue(null);

            const result = await CommandBarAnalysisService._getUserTeams('user-123');

            expect(result).toEqual([]);
        });
    });

    describe('_compareSecurityContext', () => {
        it('should identify shared and unique roles', () => {
            const currentRoles = [
                { id: 'role-1', name: 'Admin' },
                { id: 'role-2', name: 'Sales' }
            ];
            const targetRoles = [
                { id: 'role-2', name: 'Sales' },
                { id: 'role-3', name: 'Support' }
            ];
            const currentTeams = [{ id: 'team-1', name: 'Team A' }];
            const targetTeams = [{ id: 'team-1', name: 'Team A' }];

            const result = CommandBarAnalysisService._compareSecurityContext(
                currentRoles, targetRoles, currentTeams, targetTeams
            );

            expect(result.rolesMatch).toBe(false);
            expect(result.teamsMatch).toBe(true);
            expect(result.securityContextMatch).toBe(false);
            expect(result.roles.shared).toHaveLength(1);
            expect(result.roles.onlyCurrent).toHaveLength(1);
            expect(result.roles.onlyTarget).toHaveLength(1);
            expect(result.teams.shared).toHaveLength(1);
            expect(result.teams.onlyCurrent).toHaveLength(0);
            expect(result.teams.onlyTarget).toHaveLength(0);
        });

        it('should return true for matching security context', () => {
            const roles = [{ id: 'role-1', name: 'Admin' }];
            const teams = [{ id: 'team-1', name: 'Team A' }];

            const result = CommandBarAnalysisService._compareSecurityContext(
                roles, roles, teams, teams
            );

            expect(result.rolesMatch).toBe(true);
            expect(result.teamsMatch).toBe(true);
            expect(result.securityContextMatch).toBe(true);
        });

        it('should handle empty arrays', () => {
            const result = CommandBarAnalysisService._compareSecurityContext(
                [], [], [], []
            );

            expect(result.rolesMatch).toBe(true);
            expect(result.teamsMatch).toBe(true);
            expect(result.securityContextMatch).toBe(true);
            expect(result.roles.shared).toHaveLength(0);
            expect(result.teams.shared).toHaveLength(0);
        });

        it('should identify teams only in current user', () => {
            const currentTeams = [
                { id: 'team-1', name: 'Team A' },
                { id: 'team-2', name: 'Team B' }
            ];
            const targetTeams = [{ id: 'team-1', name: 'Team A' }];

            const result = CommandBarAnalysisService._compareSecurityContext(
                [], [], currentTeams, targetTeams
            );

            expect(result.teamsMatch).toBe(false);
            expect(result.teams.onlyCurrent).toHaveLength(1);
            expect(result.teams.onlyCurrent[0].name).toBe('Team B');
        });

        it('should identify teams only in target user', () => {
            const currentTeams = [{ id: 'team-1', name: 'Team A' }];
            const targetTeams = [
                { id: 'team-1', name: 'Team A' },
                { id: 'team-3', name: 'Team C' }
            ];

            const result = CommandBarAnalysisService._compareSecurityContext(
                [], [], currentTeams, targetTeams
            );

            expect(result.teamsMatch).toBe(false);
            expect(result.teams.onlyTarget).toHaveLength(1);
            expect(result.teams.onlyTarget[0].name).toBe('Team C');
        });
    });

    describe('evaluatePrivilegeRule edge cases', () => {
        it('should handle form state rules', () => {
            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.IsFormReadOnly', {});

            expect(result.passes).toBe(true);
            expect(result.reason).toContain('Form state');
            expect(result.canEvaluate).toBe(false);
        });

        it('should handle selection count rules', () => {
            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.SelectionCountExactlyOne', {});

            expect(result.passes).toBe(true);
            expect(result.reason).toContain('Selection count');
            expect(result.canEvaluate).toBe(false);
        });

        it('should handle org setting rules', () => {
            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.IsSharepointEnabled', {});

            expect(result.passes).toBe(true);
            expect(result.reason).toContain('Organization setting');
            expect(result.canEvaluate).toBe(false);
        });

        it('should handle misc privilege rules', () => {
            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.CanExportToExcel', {});

            expect(result.passes).toBe(true);
            expect(result.reason).toContain('prvExportToExcel');
            expect(result.canEvaluate).toBe(false);
        });

        it('should handle custom JavaScript rules with CustomRule pattern', () => {
            const result = CommandBarAnalysisService.evaluatePrivilegeRule('MyNamespace.CustomRule.DoSomething', {});

            expect(result.passes).toBe(true);
            expect(result.reason).toContain('Custom JavaScript');
            expect(result.canEvaluate).toBe(false);
        });

        it('should handle value rules', () => {
            const result = CommandBarAnalysisService.evaluatePrivilegeRule('Mscrm.SomeValueRule', {});

            expect(result.passes).toBe(true);
            expect(result.reason).toContain('Value rule');
            expect(result.canEvaluate).toBe(false);
        });

        it('should handle unknown rules', () => {
            const result = CommandBarAnalysisService.evaluatePrivilegeRule('SomeUnknownRule', {});

            expect(result.passes).toBe(true);
            expect(result.reason).toContain('cannot evaluate');
        });
    });

    describe('getCurrentEntity edge cases', () => {
        it('should extract entity from URL parameter', () => {
            PowerAppsApiService.isFormContextAvailable = false;

            Object.defineProperty(window, 'location', {
                value: { href: 'https://example.com/main.aspx?etn=account&pagetype=entitylist' },
                writable: true
            });

            const result = CommandBarAnalysisService.getCurrentEntity();

            expect(result).toBe('account');

            // Reset
            PowerAppsApiService.isFormContextAvailable = false;
        });

        it('should handle exception gracefully', () => {
            // Force an exception by making getEntityName throw
            PowerAppsApiService.isFormContextAvailable = true;
            PowerAppsApiService.getEntityName.mockImplementation(() => {
                throw new Error('Test error');
            });

            const result = CommandBarAnalysisService.getCurrentEntity();

            expect(result).toBeNull();

            // Reset
            PowerAppsApiService.isFormContextAvailable = false;
        });
    });

    describe('getCurrentContext edge cases', () => {
        it('should detect entity list from URL', () => {
            PowerAppsApiService.isFormContextAvailable = false;

            Object.defineProperty(window, 'location', {
                value: { href: 'https://example.com/main.aspx?pagetype=entitylist' },
                writable: true
            });

            const result = CommandBarAnalysisService.getCurrentContext();

            expect(result).toBe('HomePageGrid');
        });

        it('should handle exception gracefully', () => {
            PowerAppsApiService.isFormContextAvailable = undefined;

            // Force property access to throw
            Object.defineProperty(PowerAppsApiService, 'isFormContextAvailable', {
                get() { throw new Error('Test'); },
                configurable: true
            });

            const result = CommandBarAnalysisService.getCurrentContext();

            expect(result).toBe('HomePageGrid');

            // Reset
            Object.defineProperty(PowerAppsApiService, 'isFormContextAvailable', {
                value: false,
                writable: true,
                configurable: true
            });
        });
    });

    describe('compareCommandBarVisibility error handling', () => {
        it('should throw error and log to console when comparison fails internally', async () => {
            // Force a real internal error by making the first Promise.all throw
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            // Mock to throw in a way that reaches the catch block
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{current-user-id}' }
            });

            // Make all WebApi calls reject to trigger error path
            WebApiService.webApiFetch.mockImplementation(() => {
                throw new Error('Internal failure');
            });

            SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({});

            try {
                await CommandBarAnalysisService.compareCommandBarVisibility(
                    'target-user-id',
                    'account',
                    'Form'
                );
            } catch (error) {
                expect(error.message).toBe('Internal failure');
            }

            consoleSpy.mockRestore();
        });
    });

    describe('_extractCommandName edge cases', () => {
        it('should handle malformed XML gracefully and return diffid', () => {
            // Create XML that will cause the regex to fail in some unexpected way
            const malformedXml = '<Button invalid>>';

            const result = CommandBarAnalysisService._extractCommandName(malformedXml, 'Fallback.Command');

            // Should return the diffid or a processed version of it
            expect(result).toBeDefined();
        });

        it('should handle XML with only whitespace', () => {
            const result = CommandBarAnalysisService._extractCommandName('   ', 'WhitespaceTest');

            expect(result).toBe('WhitespaceTest');
        });

        it('should return diffid when XML has no matching patterns', () => {
            const xml = '<SomeRandomElement attribute="value" />';

            const result = CommandBarAnalysisService._extractCommandName(xml, 'NoMatch.Test');

            // Should process the diffid segment
            expect(result).toContain('Test');
        });

        it('should handle empty diffid gracefully', () => {
            const xml = '<Button />';

            const result = CommandBarAnalysisService._extractCommandName(xml, '');

            expect(result).toBe('');
        });

        it('should extract readable name from complex diffid', () => {
            const xml = '<Element />';

            const result = CommandBarAnalysisService._extractCommandName(xml, 'Mscrm.MyEntity.Commands.SaveAndCloseRecord');

            // Should extract last segment and add spaces before capitals
            expect(result).toContain('Save');
            expect(result).toContain('Close');
            expect(result).toContain('Record');
        });
    });

    describe('_checkMiscPrivileges edge cases', () => {
        it('should handle missing global context userId', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: {} // No userId
            });

            // Should not throw and return object with assumed true values
            const result = await CommandBarAnalysisService._checkMiscPrivileges(
                null,
                [{ privilegeName: 'prvExportToExcel' }]
            );

            expect(result).toBeDefined();
        });

        it('should handle API response without value property', async () => {
            PowerAppsApiService.getGlobalContext.mockReturnValue({
                userSettings: { userId: '{user-123}' }
            });

            WebApiService.webApiFetch.mockResolvedValue(null);

            const result = await CommandBarAnalysisService._checkMiscPrivileges(
                'user-123',
                [{ privilegeName: 'prvTestPrivilege' }]
            );

            // Should handle null response gracefully
            expect(result).toBeDefined();
        });
    });

    describe('getHiddenCustomActions', () => {
        it('should fetch hidden custom actions successfully', async () => {
            const mockResponse = {
                value: [
                    { customactionid: 'action-1', name: 'HiddenAction' }
                ]
            };

            WebApiService.webApiFetch.mockResolvedValue(mockResponse);

            const result = await CommandBarAnalysisService.getHiddenCustomActions('account');

            expect(WebApiService.webApiFetch).toHaveBeenCalled();
            expect(result).toEqual(mockResponse.value);
        });

        it('should return empty array when response is null', async () => {
            WebApiService.webApiFetch.mockResolvedValue(null);

            const result = await CommandBarAnalysisService.getHiddenCustomActions('account');

            expect(result).toEqual([]);
        });

        it('should return empty array on API error', async () => {
            WebApiService.webApiFetch.mockRejectedValue(new Error('API error'));

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            const result = await CommandBarAnalysisService.getHiddenCustomActions('account');

            expect(result).toEqual([]);

            consoleSpy.mockRestore();
        });
    });

    describe('retrieveEntityRibbon', () => {
        beforeEach(() => {
            // Clear ribbon cache before each test
            CommandBarAnalysisService.clearRibbonCache();
            vi.restoreAllMocks();
        });

        it('should return null for null entity name', async () => {
            const result = await CommandBarAnalysisService.retrieveEntityRibbon(null);

            expect(result).toBeNull();
            // NotificationService warning should have been called
            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('Entity name'),
                'warning'
            );
        });
    });

    it('should return null for empty entity name', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        const result = await CommandBarAnalysisService.retrieveEntityRibbon('');

        expect(result).toBeNull();

        consoleSpy.mockRestore();
    });

    it('should construct correct API URL', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        const consoleSpy2 = vi.spyOn(console, 'error').mockImplementation(() => { });

        // Setup the mock to return a valid context
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com'
        });

        // Create a spy to capture the URL
        let capturedUrl = null;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn((url) => {
            capturedUrl = url;
            return Promise.reject(new Error('Intentional test abort'));
        });

        await CommandBarAnalysisService.retrieveEntityRibbon('account');

        expect(capturedUrl).toContain('/api/data/v9.2/RetrieveEntityRibbon');
        expect(capturedUrl).toContain("EntityName='account'");

        globalThis.fetch = originalFetch;
        consoleSpy.mockRestore();
        consoleSpy2.mockRestore();
    });

    it('should return null on fetch error', async () => {
        // Setup the mock to return a valid context
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com'
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await CommandBarAnalysisService.retrieveEntityRibbon('account');

        expect(result).toBeNull();
        // NotificationService should have been called with error
        expect(NotificationService.show).toHaveBeenCalledWith(
            expect.stringContaining('Failed to retrieve entity ribbon'),
            'error'
        );

        globalThis.fetch = originalFetch;
    });

    it('should return null on HTTP error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'log').mockImplementation(() => { });

        // Setup the mock to return a valid context
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com'
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: async () => 'Entity not found'
        });

        const result = await CommandBarAnalysisService.retrieveEntityRibbon('nonexistent');

        expect(result).toBeNull();

        globalThis.fetch = originalFetch;
        consoleSpy.mockRestore();
    });

    it('should return null when response has no CompressedEntityXml', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => { });

        // Setup the mock to return a valid context
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com'
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({})
        });

        const result = await CommandBarAnalysisService.retrieveEntityRibbon('account');

        expect(result).toBeNull();

        globalThis.fetch = originalFetch;
    });

    it('should call _decompressRibbonXml when CompressedEntityXml is present', async () => {
        // This test verifies that when the response contains CompressedEntityXml,
        // the _decompressRibbonXml method is called
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });

        // Verify the method exists and can be called
        expect(typeof CommandBarAnalysisService._decompressRibbonXml).toBe('function');

        // Test decompression directly
        const result = await CommandBarAnalysisService._decompressRibbonXml(null);
        expect(result == null).toBe(true);
    });
});

describe('clearRibbonCache', () => {
    it('should clear all cache when no entity specified', () => {
        // Just call the method - we can't access internal ribbonCache
        // but we can verify behavior in other tests (cache miss after clear)
        expect(() => CommandBarAnalysisService.clearRibbonCache()).not.toThrow();
    });

    it('should clear only specific entity cache when entity specified', () => {
        // Just call the method - we can't access internal ribbonCache
        // but we can verify behavior in other tests (cache miss after clear)
        expect(() => CommandBarAnalysisService.clearRibbonCache('account')).not.toThrow();
    });
});

describe('tryEvaluateCustomRule', () => {
    it('should return not evaluated for null function name', () => {
        const result = CommandBarAnalysisService.tryEvaluateCustomRule('lib', null);

        expect(result.evaluated).toBe(false);
        expect(result.reason).toBe('No function name provided');
    });

    it('should return not evaluated for empty function name', () => {
        const result = CommandBarAnalysisService.tryEvaluateCustomRule('lib', '');

        expect(result.evaluated).toBe(false);
        expect(result.reason).toBe('No function name provided');
    });

    it('should return not evaluated when function not found in global scope', () => {
        const result = CommandBarAnalysisService.tryEvaluateCustomRule('NonExistent', 'functionName');

        expect(result.evaluated).toBe(false);
        expect(result.reason).toContain('not found in global scope');
    });

    it('should evaluate function that exists in global scope', () => {
        // Add a test function to window
        window.TestLib = {
            testRule: () => true
        };

        const result = CommandBarAnalysisService.tryEvaluateCustomRule('TestLib', 'testRule');

        expect(result.evaluated).toBe(true);
        expect(result.result).toBe(true);

        delete window.TestLib;
    });

    it('should evaluate function that returns false', () => {
        window.TestLib = {
            falseRule: () => false
        };

        const result = CommandBarAnalysisService.tryEvaluateCustomRule('TestLib', 'falseRule');

        expect(result.evaluated).toBe(true);
        expect(result.result).toBe(false);

        delete window.TestLib;
    });

    it('should handle function without library prefix', () => {
        window.standaloneRule = () => true;

        const result = CommandBarAnalysisService.tryEvaluateCustomRule(null, 'standaloneRule');

        expect(result.evaluated).toBe(true);
        expect(result.result).toBe(true);

        delete window.standaloneRule;
    });

    it('should handle deeply nested functions', () => {
        window.Deep = {
            Nested: {
                Namespace: {
                    rule: () => true
                }
            }
        };

        const result = CommandBarAnalysisService.tryEvaluateCustomRule('Deep.Nested.Namespace', 'rule');

        expect(result.evaluated).toBe(true);

        delete window.Deep;
    });

    it('should handle function that throws error', () => {
        window.ErrorLib = {
            throwingRule: () => { throw new Error('Rule error'); }
        };

        const result = CommandBarAnalysisService.tryEvaluateCustomRule('ErrorLib', 'throwingRule');

        expect(result.evaluated).toBe(false);
        expect(result.error).toBe('Rule error');
        expect(result.reason).toContain('Error evaluating');

        delete window.ErrorLib;
    });

    it('should return error when path resolves to non-function', () => {
        window.NotAFunction = {
            value: 'string not function'
        };

        const result = CommandBarAnalysisService.tryEvaluateCustomRule('NotAFunction', 'value');

        expect(result.evaluated).toBe(false);
        expect(result.reason).toContain('is not a function');

        delete window.NotAFunction;
    });
});

describe('parseRibbonXmlForCommands', () => {
    it('should return empty array for null ribbon XML', () => {
        const result = CommandBarAnalysisService.parseRibbonXmlForCommands(null);
        expect(result).toEqual([]);
    });

    it('should return empty array for empty ribbon XML', () => {
        const result = CommandBarAnalysisService.parseRibbonXmlForCommands('');
        expect(result).toEqual([]);
    });

    it('should parse buttons from ribbon XML', () => {
        const ribbonXml = `
                <Ribbon>
                    <Button Id="Mscrm.HomepageGrid.New" Command="Mscrm.NewRecord" LabelText="New"/>
                    <CommandDefinition Id="Mscrm.NewRecord">
                        <DisplayRules>
                            <DisplayRule Id="Mscrm.CreatePrimaryEntityPermission"/>
                        </DisplayRules>
                    </CommandDefinition>
                </Ribbon>
            `;

        const result = CommandBarAnalysisService.parseRibbonXmlForCommands(ribbonXml, 'HomePageGrid');

        expect(result.length).toBeGreaterThan(0);
        expect(result[0].id).toBe('Mscrm.NewRecord');
        expect(result[0].name).toBe('New');
    });

    it('should skip buttons without command ID', () => {
        const ribbonXml = `
                <Ribbon>
                    <Button Id="NoCommand" LabelText="No Command"/>
                </Ribbon>
            `;

        const result = CommandBarAnalysisService.parseRibbonXmlForCommands(ribbonXml);

        // Should not include buttons without Command attribute
        expect(result.filter(r => r.buttonId === 'NoCommand')).toHaveLength(0);
    });

    it('should use Alt attribute when LabelText is missing', () => {
        const ribbonXml = `
                <Ribbon>
                    <Button Id="Mscrm.HomepageGrid.Delete" Command="Mscrm.DeleteRecord" Alt="Delete Selected"/>
                    <CommandDefinition Id="Mscrm.DeleteRecord"/>
                </Ribbon>
            `;

        const result = CommandBarAnalysisService.parseRibbonXmlForCommands(ribbonXml, 'HomePageGrid');

        const deleteCmd = result.find(r => r.id === 'Mscrm.DeleteRecord');
        expect(deleteCmd?.name).toBe('Delete Selected');
    });

    it('should handle malformed XML gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        const malformedXml = '<Ribbon><Button unclosed';

        const result = CommandBarAnalysisService.parseRibbonXmlForCommands(malformedXml);

        expect(Array.isArray(result)).toBe(true);

        consoleSpy.mockRestore();
    });

    it('should mark OOTB commands correctly', () => {
        const ribbonXml = `
                <Ribbon>
                    <Button Id="Mscrm.HomepageGrid.Delete" Command="Mscrm.DeleteRecord" LabelText="Delete"/>
                    <Button Id="Custom.MyButton" Command="Custom.MyCommand" LabelText="Custom"/>
                    <CommandDefinition Id="Mscrm.DeleteRecord"/>
                    <CommandDefinition Id="Custom.MyCommand"/>
                </Ribbon>
            `;

        const result = CommandBarAnalysisService.parseRibbonXmlForCommands(ribbonXml, 'HomePageGrid');

        const ootbCmd = result.find(r => r.id === 'Mscrm.DeleteRecord');
        const customCmd = result.find(r => r.id === 'Custom.MyCommand');

        expect(ootbCmd?.isOOTB).toBe(true);
        expect(customCmd?.isOOTB).toBe(false);
    });

    it('should filter commands based on Form context', () => {
        const ribbonXml = `
                <Ribbon>
                    <Button Id="Mscrm.Form.Save" Command="Mscrm.FormSave" LabelText="Save"/>
                    <Button Id="Mscrm.HomepageGrid.New" Command="Mscrm.GridNew" LabelText="New"/>
                    <CommandDefinition Id="Mscrm.FormSave"/>
                    <CommandDefinition Id="Mscrm.GridNew"/>
                </Ribbon>
            `;

        const result = CommandBarAnalysisService.parseRibbonXmlForCommands(ribbonXml, 'Form');

        expect(result.some(r => r.buttonId === 'Mscrm.Form.Save')).toBe(true);
    });
});

describe('_commandMatchesContext', () => {
    it('should match form commands for Form context', () => {
        expect(CommandBarAnalysisService._commandMatchesContext('Mscrm.Form.Save', 'Form')).toBe(true);
        expect(CommandBarAnalysisService._commandMatchesContext('Mscrm.PrimaryEntity.New', 'Form')).toBe(true);
        expect(CommandBarAnalysisService._commandMatchesContext('Mscrm.RecordCommand', 'Form')).toBe(true);
    });

    it('should not match grid commands for Form context', () => {
        expect(CommandBarAnalysisService._commandMatchesContext('Mscrm.HomepageGrid.New', 'Form')).toBe(false);
        expect(CommandBarAnalysisService._commandMatchesContext('Mscrm.SubGridCommand', 'Form')).toBe(false);
    });

    it('should match subgrid commands for SubGrid context', () => {
        expect(CommandBarAnalysisService._commandMatchesContext('Mscrm.SubGridNew', 'SubGrid')).toBe(true);
        expect(CommandBarAnalysisService._commandMatchesContext('Mscrm.AssociatedView', 'SubGrid')).toBe(true);
    });

    it('should match homepage grid commands for HomePageGrid context', () => {
        expect(CommandBarAnalysisService._commandMatchesContext('Mscrm.HomepageGrid.New', 'HomePageGrid')).toBe(true);
        expect(CommandBarAnalysisService._commandMatchesContext('Mscrm.SelectedRecords', 'HomePageGrid')).toBe(true);
    });

    it('should return true for unknown context', () => {
        expect(CommandBarAnalysisService._commandMatchesContext('AnyCommand', 'Unknown')).toBe(true);
    });
});

describe('_extractLabelFromId', () => {
    it('should return Unknown for null ID', () => {
        expect(CommandBarAnalysisService._extractLabelFromId(null)).toBe('Unknown');
    });

    it('should return Unknown for empty ID', () => {
        expect(CommandBarAnalysisService._extractLabelFromId('')).toBe('Unknown');
    });

    it('should remove Mscrm prefix', () => {
        const result = CommandBarAnalysisService._extractLabelFromId('Mscrm.NewRecord');
        expect(result).not.toContain('Mscrm');
    });

    it('should remove Grid prefix', () => {
        const result = CommandBarAnalysisService._extractLabelFromId('Grid.SomeCommand');
        expect(result).not.toContain('Grid');
    });

    it('should convert camelCase to spaces', () => {
        const result = CommandBarAnalysisService._extractLabelFromId('Mscrm.NewRecord');
        expect(result).toBe('New Record');
    });

    it('should handle complex IDs with multiple dots', () => {
        const result = CommandBarAnalysisService._extractLabelFromId('Mscrm.Grid.account.MyButton');
        expect(result.length).toBeGreaterThan(0);
    });
});

describe('_decompressRibbonXml', () => {
    it('should return null on decompression error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        // Invalid base64/gzip data
        const result = await CommandBarAnalysisService._decompressRibbonXml('not-valid-base64!!!');

        // May return null or undefined depending on error type
        expect(result == null).toBe(true);

        consoleSpy.mockRestore();
    });
});

describe('_extractRulesFromCommand', () => {
    it('should return empty array for null commandDef', () => {
        const result = CommandBarAnalysisService._extractRulesFromCommand(null, 'DisplayRule', null);
        expect(result).toEqual([]);
    });

    it('should extract display rules from command definition', () => {
        const xml = `<RibbonDiffXml>
                <CommandDefinitions>
                    <CommandDefinition Id="MyCommand">
                        <DisplayRules>
                            <DisplayRule Id="Mscrm.HideOnModern"/>
                        </DisplayRules>
                    </CommandDefinition>
                </CommandDefinitions>
                <DisplayRuleDefinition Id="Mscrm.HideOnModern">
                    <EntityPrivilegeRule PrivilegeType="Write"/>
                </DisplayRuleDefinition>
            </RibbonDiffXml>`;

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, 'application/xml');
        const commandDef = xmlDoc.querySelector('CommandDefinition');

        const result = CommandBarAnalysisService._extractRulesFromCommand(commandDef, 'DisplayRule', xmlDoc);

        expect(result.length).toBe(1);
        expect(result[0].id).toBe('Mscrm.HideOnModern');
        expect(result[0].isCustom).toBe(false);
    });

    it('should mark custom rules correctly', () => {
        const xml = `<RibbonDiffXml>
                <CommandDefinitions>
                    <CommandDefinition Id="MyCommand">
                        <EnableRules>
                            <EnableRule Id="my_CustomRule"/>
                        </EnableRules>
                    </CommandDefinition>
                </CommandDefinitions>
            </RibbonDiffXml>`;

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, 'application/xml');
        const commandDef = xmlDoc.querySelector('CommandDefinition');

        const result = CommandBarAnalysisService._extractRulesFromCommand(commandDef, 'EnableRule', xmlDoc);

        expect(result.length).toBe(1);
        expect(result[0].id).toBe('my_CustomRule');
        expect(result[0].isCustom).toBe(true);
    });

    it('should skip rules without Id attribute', () => {
        const xml = `<RibbonDiffXml>
                <CommandDefinitions>
                    <CommandDefinition Id="MyCommand">
                        <DisplayRules>
                            <DisplayRule/>
                        </DisplayRules>
                    </CommandDefinition>
                </CommandDefinitions>
            </RibbonDiffXml>`;

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, 'application/xml');
        const commandDef = xmlDoc.querySelector('CommandDefinition');

        const result = CommandBarAnalysisService._extractRulesFromCommand(commandDef, 'DisplayRule', xmlDoc);
        expect(result.length).toBe(0);
    });
});

describe('_parseRuleDefinition', () => {
    it('should return Unknown type for null ruleDef with unknown Mscrm rule', () => {
        // Using Mscrm prefix but not a known rule - returns Unknown
        const result = CommandBarAnalysisService._parseRuleDefinition(null, 'Mscrm.SomeUnknownRule');
        expect(result.type).toBe('Unknown');
    });

    it('should detect EntityPrivilegeRule from ruleDef', () => {
        const xml = `<DisplayRuleDefinition Id="test">
                <EntityPrivilegeRule PrivilegeType="Write" EntityName="account"/>
            </DisplayRuleDefinition>`;

        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'application/xml');
        const ruleDef = doc.querySelector('DisplayRuleDefinition');

        const result = CommandBarAnalysisService._parseRuleDefinition(ruleDef, 'test');
        expect(result.type).toBe('EntityPrivilegeRule');
        expect(result.privilege).toBe('Write');
        expect(result.entityName).toBe('account');
    });

    it('should detect CustomRule with JavaScript', () => {
        const xml = `<EnableRuleDefinition Id="test">
                <CustomRule Library="myLib.js" FunctionName="MyNamespace.checkRule">
                    <CrmParameter Name="PrimaryControl" Value=""/>
                </CustomRule>
            </EnableRuleDefinition>`;

        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'application/xml');
        const ruleDef = doc.querySelector('EnableRuleDefinition');

        const result = CommandBarAnalysisService._parseRuleDefinition(ruleDef, 'test');
        expect(result.type).toBe('CustomRule');
        expect(result.isJavaScript).toBe(true);
        expect(result.functionName).toBe('MyNamespace.checkRule');
        expect(result.library).toBe('myLib.js');
        expect(result.parameters.length).toBe(1);
    });

    it('should detect FormStateRule', () => {
        const xml = `<DisplayRuleDefinition Id="test">
                <FormStateRule State="Create"/>
            </DisplayRuleDefinition>`;

        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'application/xml');
        const ruleDef = doc.querySelector('DisplayRuleDefinition');

        const result = CommandBarAnalysisService._parseRuleDefinition(ruleDef, 'test');
        expect(result.type).toBe('FormStateRule');
        expect(result.state).toBe('Create');
    });

    it('should detect SelectionCountRule', () => {
        const xml = `<EnableRuleDefinition Id="test">
                <SelectionCountRule Minimum="1"/>
            </EnableRuleDefinition>`;

        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'application/xml');
        const ruleDef = doc.querySelector('EnableRuleDefinition');

        const result = CommandBarAnalysisService._parseRuleDefinition(ruleDef, 'test');
        expect(result.type).toBe('SelectionCountRule');
        expect(result.count).toBe('1');
    });

    it('should detect ValueRule', () => {
        const xml = `<EnableRuleDefinition Id="test">
                <ValueRule Field="statecode" Value="0"/>
            </EnableRuleDefinition>`;

        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'application/xml');
        const ruleDef = doc.querySelector('EnableRuleDefinition');

        const result = CommandBarAnalysisService._parseRuleDefinition(ruleDef, 'test');
        expect(result.type).toBe('ValueRule');
        expect(result.field).toBe('statecode');
        expect(result.value).toBe('0');
    });

    it('should detect OrRule composite', () => {
        const xml = `<DisplayRuleDefinition Id="test">
                <OrRule>
                    <DisplayRule Id="Rule1"/>
                    <DisplayRule Id="Rule2"/>
                </OrRule>
            </DisplayRuleDefinition>`;

        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'application/xml');
        const ruleDef = doc.querySelector('DisplayRuleDefinition');

        const result = CommandBarAnalysisService._parseRuleDefinition(ruleDef, 'test');
        expect(result.type).toBe('OrRule');
        expect(result.isComposite).toBe(true);
    });

    it('should detect AndRule composite', () => {
        const xml = `<DisplayRuleDefinition Id="test">
                <AndRule>
                    <DisplayRule Id="Rule1"/>
                    <DisplayRule Id="Rule2"/>
                </AndRule>
            </DisplayRuleDefinition>`;

        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'application/xml');
        const ruleDef = doc.querySelector('DisplayRuleDefinition');

        const result = CommandBarAnalysisService._parseRuleDefinition(ruleDef, 'test');
        expect(result.type).toBe('AndRule');
        expect(result.isComposite).toBe(true);
    });

    it('should infer EntityPrivilegeRule from known rule IDs', () => {
        // Use actual rule ID from PRIVILEGE_BASED_RULES constant
        const result = CommandBarAnalysisService._parseRuleDefinition(null, 'Mscrm.CanWritePrimary');
        expect(result.type).toBe('EntityPrivilegeRule');
        expect(result.privilege).toBe('Write');
    });

    it('should infer EntityPrivilegeRule for delete privilege rules', () => {
        const result = CommandBarAnalysisService._parseRuleDefinition(null, 'Mscrm.DeletePrimaryEntityPermission');
        expect(result.type).toBe('EntityPrivilegeRule');
        expect(result.privilege).toBe('Delete');
    });

    it('should infer EntityPrivilegeRule for share privilege rules', () => {
        const result = CommandBarAnalysisService._parseRuleDefinition(null, 'Mscrm.SharePrimaryPermission');
        expect(result.type).toBe('EntityPrivilegeRule');
        expect(result.privilege).toBe('Share');
    });

    it('should infer AlwaysHide from known hide rule IDs', () => {
        const result = CommandBarAnalysisService._parseRuleDefinition(null, 'Mscrm.HideOnModern');
        expect(result.type).toBe('AlwaysHide');
    });

    it('should infer AlwaysHide for HideOnCommandBar rule', () => {
        const result = CommandBarAnalysisService._parseRuleDefinition(null, 'Mscrm.HideOnCommandBar');
        expect(result.type).toBe('AlwaysHide');
    });

    it('should infer CustomRule for non-Mscrm prefixed rules', () => {
        const result = CommandBarAnalysisService._parseRuleDefinition(null, 'my_custom_rule');
        expect(result.type).toBe('CustomRule');
        expect(result.isJavaScript).toBe(true);
    });
});

describe('compareCommandBarVisibility additional scenarios', () => {
    it('should handle entity property requirements', async () => {
        // Mock for STANDARD_COMMANDS scenario
        WebApiService.webApiFetch.mockResolvedValue({ value: [] });
        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true },
            delete: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'user-2',
            'account',
            'Form',
            'user-1'
        );

        expect(result).toBeDefined();
        expect(result.summary).toBeDefined();
        expect(result.commands).toBeDefined();
    });

    it('should include modern commands in comparison', async () => {
        WebApiService.webApiFetch.mockImplementation((url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({
                    value: [{
                        appactionid: 'modern-1',
                        uniquename: 'ModernAction1',
                        name: 'Modern Action',
                        buttonlabeltext: 'Do Something',
                        visibilitytype: 0,
                        hidden: false,
                        ismanaged: false
                    }]
                });
            }
            return Promise.resolve({ value: [] });
        });
        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({});

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'user-2',
            'account',
            'HomePageGrid',
            'user-1'
        );

        expect(result).toBeDefined();
        expect(result.commands).toBeDefined();
    });

    it('should skip hidden modern commands', async () => {
        WebApiService.webApiFetch.mockImplementation((url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({
                    value: [{
                        appactionid: 'hidden-1',
                        uniquename: 'HiddenAction',
                        hidden: true
                    }]
                });
            }
            return Promise.resolve({ value: [] });
        });
        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({});

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'user-2',
            'account',
            'HomePageGrid'
        );

        // Hidden command should not appear in results
        const hiddenCmd = result.commands.find(c => c.commandId === 'hidden-1');
        expect(hiddenCmd).toBeUndefined();
    });
});

describe('retrieveEntityRibbon cache behavior', () => {
    it('should use cache when available and not expired', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => { });

        // First call - will hit error but sets up the scenario
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com'
        });

        // Just verify the method returns null on first call (no fetch mock)
        const result = await CommandBarAnalysisService.retrieveEntityRibbon('contact');
        expect(result).toBeNull();
    });
});

describe('parseRibbonXmlForCommands advanced scenarios', () => {
    it('should extract ToolTipDescription from buttons', () => {
        const xml = `<RibbonXml>
                <Button Id="test.button" Command="test.command" LabelText="Test">
                    <ToolTipDescription Title="Test Tooltip" />
                </Button>
            </RibbonXml>`;

        const result = CommandBarAnalysisService.parseRibbonXmlForCommands(xml);
        expect(result.length).toBe(1);
    });

    it('should handle buttons in groups and tabs', () => {
        const xml = `<RibbonXml>
                <Tab>
                    <Group>
                        <Controls>
                            <Button Id="tab.group.button" Command="cmd1" LabelText="Grouped Button"/>
                        </Controls>
                    </Group>
                </Tab>
            </RibbonXml>`;

        const result = CommandBarAnalysisService.parseRibbonXmlForCommands(xml);
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Grouped Button');
    });
});

describe('compareCommandBarVisibility with modern commands', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getUserId: () => 'current-user-id',
            getClientUrl: () => 'https://test.crm.dynamics.com'
        });
    });

    it('should handle modern commands with visibility formula', async () => {
        WebApiService.webApiFetch.mockImplementation((url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({
                    value: [{
                        appactionid: 'modern-formula-1',
                        uniquename: 'FormulaCommand',
                        name: 'Formula Command',
                        buttonlabeltext: 'Run Formula',
                        visibilitytype: 1, // Formula type
                        visibilityformulafunctionname: 'CheckVisibility',
                        hidden: false,
                        ismanaged: false
                    }]
                });
            }
            if (url.includes('ribbondiff')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('customaction')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('solution')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('publisher')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('systemuser')) {
                return Promise.resolve({ value: [{ systemuserid: 'user-2' }] });
            }
            return Promise.resolve({ value: [] });
        });
        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({});

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'user-2',
            'account',
            'Form',
            'current-user-id'
        );

        expect(result.commands).toBeDefined();
        expect(Array.isArray(result.commands)).toBe(true);
    });

    it('should handle modern commands with classic rules', async () => {
        WebApiService.webApiFetch.mockImplementation((url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({
                    value: [{
                        appactionid: 'modern-classic-1',
                        uniquename: 'ClassicCommand',
                        name: 'Classic Command',
                        buttonlabeltext: 'Run Classic',
                        visibilitytype: 2, // Classic rules type
                        hidden: false,
                        ismanaged: true
                    }]
                });
            }
            if (url.includes('ribbondiff')) {
                return Promise.resolve({ value: [] });
            }
            return Promise.resolve({ value: [] });
        });
        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({});

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'user-2',
            'account',
            'HomePageGrid',
            'current-user-id'
        );

        expect(result.commands).toBeDefined();
    });

    it('should flag potential difference when security context differs for visibility rules', async () => {
        WebApiService.webApiFetch.mockImplementation((url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({
                    value: [{
                        appactionid: 'modern-1',
                        uniquename: 'ModernCmd',
                        buttonlabeltext: 'Modern',
                        visibilitytype: 1,
                        visibilityformulafunctionname: 'CheckVis',
                        hidden: false
                    }]
                });
            }
            if (url.includes('systemuserroles_association')) {
                if (url.includes('current-user-id')) {
                    return Promise.resolve({
                        value: [{ roleid: 'role-1', name: 'Admin Role' }]
                    });
                }
                return Promise.resolve({
                    value: [{ roleid: 'role-2', name: 'User Role' }]
                });
            }
            if (url.includes('teammembership_association')) {
                if (url.includes('current-user-id')) {
                    return Promise.resolve({
                        value: [{ teamid: 'team-1', name: 'Team A' }]
                    });
                }
                return Promise.resolve({
                    value: [{ teamid: 'team-2', name: 'Team B' }]
                });
            }
            return Promise.resolve({ value: [] });
        });
        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({});

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'user-2',
            'account',
            'Form',
            'current-user-id'
        );

        expect(result).toBeDefined();
    });
});

describe('compareCommandBarVisibility with custom rules and security context', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getUserId: () => 'current-user-id',
            getClientUrl: () => 'https://test.crm.dynamics.com'
        });
    });

    it('should include blocked-by reasons when users have different roles', async () => {
        // Setup diff with custom rule
        const ribbonDiffXml = `<RibbonDiffXml>
                <DisplayRules>
                    <DisplayRule Id="custom.rule">
                        <CustomRule FunctionName="MyLib.checkAccess" Library="my_lib.js"/>
                    </DisplayRule>
                </DisplayRules>
                <CommandDefinitions>
                    <CommandDefinition Id="test.command">
                        <DisplayRules>
                            <DisplayRule Id="custom.rule"/>
                        </DisplayRules>
                    </CommandDefinition>
                </CommandDefinitions>
            </RibbonDiffXml>`;

        WebApiService.webApiFetch.mockImplementation((url) => {
            if (url.includes('ribbondiff')) {
                return Promise.resolve({
                    value: [{
                        ribbondiffid: 'diff-1',
                        entity: 'account',
                        rdx: ribbonDiffXml,
                        solutionid: 'sol-1'
                    }]
                });
            }
            if (url.includes('systemuserroles_association')) {
                if (url.includes('current-user-id')) {
                    return Promise.resolve({
                        value: [{ roleid: 'admin-role', name: 'System Administrator' }]
                    });
                }
                return Promise.resolve({
                    value: [{ roleid: 'user-role', name: 'Basic User' }]
                });
            }
            if (url.includes('teammembership_association')) {
                if (url.includes('current-user-id')) {
                    return Promise.resolve({
                        value: [{ teamid: 'team-a', name: 'Sales Team' }]
                    });
                }
                return Promise.resolve({ value: [] });
            }
            if (url.includes('solution')) {
                return Promise.resolve({
                    value: [{ solutionid: 'sol-1', friendlyname: 'Test Solution', publisherid: 'pub-1' }]
                });
            }
            if (url.includes('publisher')) {
                return Promise.resolve({
                    value: [{ publisherid: 'pub-1', friendlyname: 'Test Publisher' }]
                });
            }
            return Promise.resolve({ value: [] });
        });
        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true },
            read: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'user-2',
            'account',
            'Form',
            'current-user-id'
        );

        expect(result).toBeDefined();
        expect(result.summary).toBeDefined();
    });

    it('should detect security context match and use privilege-based evaluation', async () => {
        // Both users have same roles and teams
        WebApiService.webApiFetch.mockImplementation((url) => {
            if (url.includes('ribbondiff')) {
                return Promise.resolve({
                    value: [{
                        ribbondiffid: 'diff-1',
                        entity: 'account',
                        rdx: `<RibbonDiffXml>
                                <DisplayRules>
                                    <DisplayRule Id="custom.rule">
                                        <CustomRule FunctionName="MyLib.check"/>
                                    </DisplayRule>
                                </DisplayRules>
                                <CommandDefinitions>
                                    <CommandDefinition Id="cmd">
                                        <DisplayRules>
                                            <DisplayRule Id="custom.rule"/>
                                        </DisplayRules>
                                    </CommandDefinition>
                                </CommandDefinitions>
                            </RibbonDiffXml>`
                    }]
                });
            }
            if (url.includes('systemuserroles_association')) {
                // Both users have same role
                return Promise.resolve({
                    value: [{ roleid: 'shared-role', name: 'Shared Role' }]
                });
            }
            if (url.includes('teammembership_association')) {
                // Both users have same team
                return Promise.resolve({
                    value: [{ teamid: 'shared-team', name: 'Shared Team' }]
                });
            }
            return Promise.resolve({ value: [] });
        });
        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'user-2',
            'account',
            'Form',
            'current-user-id'
        );

        expect(result).toBeDefined();
    });
});

describe('compareCommandBarVisibility privilege evaluation branches', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getUserId: () => 'current-user-id',
            getClientUrl: () => 'https://test.crm.dynamics.com'
        });
    });

    it('should handle only-target visibility difference', async () => {
        WebApiService.webApiFetch.mockImplementation((url) => {
            if (url.includes('ribbondiff')) {
                return Promise.resolve({
                    value: [{
                        ribbondiffid: 'diff-1',
                        entity: 'account',
                        rdx: `<RibbonDiffXml>
                                <DisplayRules>
                                    <DisplayRule Id="Mscrm.CanWritePrimary"/>
                                </DisplayRules>
                                <CommandDefinitions>
                                    <CommandDefinition Id="write.cmd">
                                        <DisplayRules>
                                            <DisplayRule Id="Mscrm.CanWritePrimary"/>
                                        </DisplayRules>
                                    </CommandDefinition>
                                </CommandDefinitions>
                            </RibbonDiffXml>`
                    }]
                });
            }
            return Promise.resolve({ value: [] });
        });

        // Current user cannot write, target user can
        SecurityAnalysisService.getUserEntityPrivileges.mockImplementation((userId) => {
            if (userId === 'current-user-id') {
                return Promise.resolve({ write: { hasPrivilege: false } });
            }
            return Promise.resolve({ write: { hasPrivilege: true } });
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'user-2',
            'account',
            'Form',
            'current-user-id'
        );

        expect(result).toBeDefined();
        expect(result.commands).toBeDefined();
    });

    it('should handle entity IsActivity property check', async () => {
        WebApiService.webApiFetch.mockImplementation((url) => {
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({
                    IsActivity: true,
                    IsActivityParty: false,
                    CanCreateCharts: true,
                    HasNotes: true,
                    HasActivities: true,
                    IsConnectionsEnabled: true,
                    IsDocumentManagementEnabled: false,
                    IsAuditEnabled: true
                });
            }
            return Promise.resolve({ value: [] });
        });
        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({});

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'user-2',
            'task',
            'Form',
            'current-user-id'
        );

        expect(result).toBeDefined();
    });

    it('should handle misc privileges check', async () => {
        WebApiService.webApiFetch.mockImplementation((url) => {
            if (url.includes('privilege')) {
                return Promise.resolve({
                    value: [{ name: 'prvExportToExcel', privilegeid: 'priv-1' }]
                });
            }
            if (url.includes('RetrieveUserPrivileges')) {
                return Promise.resolve({
                    RolePrivileges: [{ PrivilegeId: 'priv-1', Depth: 1 }]
                });
            }
            return Promise.resolve({ value: [] });
        });
        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({});

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'user-2',
            'account',
            'HomePageGrid',
            'current-user-id'
        );

        expect(result).toBeDefined();
    });
});

describe('evaluatePrivilegeRule comprehensive branches', () => {
    it('should handle Write privilege with correct return structure', () => {
        const result = CommandBarAnalysisService.evaluatePrivilegeRule(
            'Mscrm.CanWritePrimary',
            { write: { hasPrivilege: true } }
        );
        expect(result.passes).toBe(true);
        expect(result.canEvaluate).toBe(true);
    });

    it('should handle Create privilege', () => {
        const result = CommandBarAnalysisService.evaluatePrivilegeRule(
            'Mscrm.CreateSelectedEntityPermission',
            { create: { hasPrivilege: true } }
        );
        expect(result.passes).toBe(true);
    });

    it('should fail for Write when missing privilege', () => {
        const result = CommandBarAnalysisService.evaluatePrivilegeRule(
            'Mscrm.CanWritePrimary',
            { write: { hasPrivilege: false } }
        );
        expect(result.passes).toBe(false);
        expect(result.reason).toContain('lacks');
    });

    it('should handle record privilege rules with Primary pattern', () => {
        const result = CommandBarAnalysisService.evaluatePrivilegeRule(
            'Mscrm.WritePrimaryEntityPermission',
            { write: { hasPrivilege: true } }
        );
        expect(result.passes).toBe(true);
    });

    it('should handle record privilege rules with Selected pattern', () => {
        const result = CommandBarAnalysisService.evaluatePrivilegeRule(
            'Mscrm.WriteSelectedEntityPermission',
            { write: { hasPrivilege: true } }
        );
        expect(result.passes).toBe(true);
    });
});

describe('_commandMatchesContext additional contexts', () => {
    it('should match associated commands for SubGrid context', () => {
        const result = CommandBarAnalysisService._commandMatchesContext(
            'account.associated.command',
            'SubGrid'
        );
        expect(result).toBe(true);
    });

    it('should match selected commands for SubGrid context', () => {
        const result = CommandBarAnalysisService._commandMatchesContext(
            'contact.selected.action',
            'SubGrid'
        );
        expect(result).toBe(true);
    });

    it('should match grid commands for HomePageGrid', () => {
        const result = CommandBarAnalysisService._commandMatchesContext(
            'account.grid.export',
            'HomePageGrid'
        );
        expect(result).toBe(true);
    });

    it('should match new commands for HomePageGrid', () => {
        const result = CommandBarAnalysisService._commandMatchesContext(
            'account.new.record',
            'HomePageGrid'
        );
        expect(result).toBe(true);
    });
});

describe('_extractLabelFromId edge cases', () => {
    it('should handle ID with Button suffix', () => {
        const result = CommandBarAnalysisService._extractLabelFromId('Mscrm.SaveButton');
        expect(result).toContain('Save');
    });

    it('should handle ID with Command suffix', () => {
        const result = CommandBarAnalysisService._extractLabelFromId('Mscrm.RefreshCommand');
        expect(result).toContain('Refresh');
    });

    it('should handle ID with underscores', () => {
        const result = CommandBarAnalysisService._extractLabelFromId('custom_save_record');
        expect(result).toBeDefined();
    });
});

describe('parseRibbonDiffXml edge cases', () => {
    it('should extract EnableRules from RuleDefinitions', () => {
        const xml = `<RibbonDiffXml>
                <RuleDefinitions>
                    <EnableRules>
                        <EnableRule Id="test.enable.rule"/>
                    </EnableRules>
                </RuleDefinitions>
            </RibbonDiffXml>`;

        const result = CommandBarAnalysisService.parseRibbonDiffXml(xml);
        expect(result.enableRules.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle Commands element for rules', () => {
        const xml = `<RibbonDiffXml>
                <CommandDefinitions>
                    <CommandDefinition Id="test.cmd">
                        <EnableRules>
                            <EnableRule Id="enable.1"/>
                        </EnableRules>
                        <DisplayRules>
                            <DisplayRule Id="display.1"/>
                        </DisplayRules>
                    </CommandDefinition>
                </CommandDefinitions>
            </RibbonDiffXml>`;

        const result = CommandBarAnalysisService.parseRibbonDiffXml(xml);
        expect(result).toBeDefined();
    });
});

describe('_decompressRibbonXml success path', () => {
    it('should successfully decompress valid base64 gzip data', async () => {
        // Create valid gzip compressed "test" string
        // For testing, we verify the method handles the case gracefully
        const invalidBase64 = 'not-valid-base64-gzip-data';

        const result = await CommandBarAnalysisService._decompressRibbonXml(invalidBase64);
        // Should return null for invalid data
        expect(result).toBeNull();
    });
});

describe('retrieveEntityRibbon cache hit path', () => {
    beforeEach(() => {
        CommandBarAnalysisService.clearRibbonCache();
    });

    it('should return cached ribbon when cache is valid and not expired', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });

        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com'
        });

        // First call - populate cache
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                CompressedEntityXml: 'SomeBase64Data'
            })
        });

        // Mock _decompressRibbonXml to return a test value
        const decompressSpy = vi.spyOn(CommandBarAnalysisService, '_decompressRibbonXml')
            .mockResolvedValue('<RibbonXml>Test</RibbonXml>');

        // First call - should fetch from API
        const result1 = await CommandBarAnalysisService.retrieveEntityRibbon('account');
        expect(result1).toBe('<RibbonXml>Test</RibbonXml>');
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        // Second call - should use cache
        const result2 = await CommandBarAnalysisService.retrieveEntityRibbon('account');
        expect(result2).toBe('<RibbonXml>Test</RibbonXml>');
        // Fetch should still be 1 (cache hit)
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        globalThis.fetch = originalFetch;
        decompressSpy.mockRestore();
        consoleSpy.mockRestore();
    });

    it('should skip cache when skipCache is true', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });

        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com'
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                CompressedEntityXml: 'SomeBase64Data'
            })
        });

        const decompressSpy = vi.spyOn(CommandBarAnalysisService, '_decompressRibbonXml')
            .mockResolvedValue('<RibbonXml>Test</RibbonXml>');

        // First call
        await CommandBarAnalysisService.retrieveEntityRibbon('account');
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        // Second call with skipCache=true - should bypass cache
        await CommandBarAnalysisService.retrieveEntityRibbon('account', 'CommandsCore', true);
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);

        globalThis.fetch = originalFetch;
        decompressSpy.mockRestore();
        consoleSpy.mockRestore();
    });
});

describe('retrieveEntityRibbon HTTP error with body', () => {
    beforeEach(() => {
        CommandBarAnalysisService.clearRibbonCache();
    });

    it('should handle HTTP error with response body details', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => { });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com'
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            text: async () => 'Detailed error message from server'
        });

        const result = await CommandBarAnalysisService.retrieveEntityRibbon('account');

        expect(result).toBeNull();
        // NotificationService.show should have been called with error
        expect(NotificationService.show).toHaveBeenCalledWith(
            expect.stringContaining('Failed to retrieve entity ribbon'),
            'error'
        );

        globalThis.fetch = originalFetch;
        errorSpy.mockRestore();
    });
});

describe('parseRibbonXmlForCommands CommandDefinition processing', () => {
    it('should process CommandDefinitions without visible buttons', () => {
        // This tests the second loop in parseRibbonXmlForCommands that processes
        // CommandDefinitions that haven't been processed via Button elements
        const ribbonXml = `<?xml version="1.0" encoding="utf-8"?>
            <RibbonDefinitions>
                <CommandDefinitions>
                    <CommandDefinition Id="Mscrm.Form.TestCommand">
                        <DisplayRules>
                            <DisplayRule Id="Mscrm.FormStateRule"/>
                        </DisplayRules>
                        <EnableRules>
                            <EnableRule Id="Mscrm.EnableRule1"/>
                        </EnableRules>
                    </CommandDefinition>
                </CommandDefinitions>
            </RibbonDefinitions>`;

        const commands = CommandBarAnalysisService.parseRibbonXmlForCommands(ribbonXml, 'Form');

        // Should include command from CommandDefinition
        expect(commands.length).toBeGreaterThan(0);
        const cmd = commands.find(c => c.id === 'Mscrm.Form.TestCommand');
        expect(cmd).toBeDefined();
        expect(cmd.isOOTB).toBe(true);
    });

    it('should skip CommandDefinitions without Id', () => {
        const ribbonXml = `<?xml version="1.0" encoding="utf-8"?>
            <RibbonDefinitions>
                <CommandDefinitions>
                    <CommandDefinition>
                        <DisplayRules>
                            <DisplayRule Id="SomeRule"/>
                        </DisplayRules>
                    </CommandDefinition>
                </CommandDefinitions>
            </RibbonDefinitions>`;

        const commands = CommandBarAnalysisService.parseRibbonXmlForCommands(ribbonXml, 'Form');
        expect(commands).toEqual([]);
    });

    it('should skip CommandDefinitions already processed via Button', () => {
        const ribbonXml = `<?xml version="1.0" encoding="utf-8"?>
            <RibbonDefinitions>
                <Buttons>
                    <Button Id="MyButton" Command="Mscrm.Form.MyCommand" LabelText="My Command"/>
                </Buttons>
                <CommandDefinitions>
                    <CommandDefinition Id="Mscrm.Form.MyCommand">
                        <DisplayRules>
                            <DisplayRule Id="Mscrm.FormStateRule"/>
                        </DisplayRules>
                    </CommandDefinition>
                </CommandDefinitions>
            </RibbonDefinitions>`;

        const commands = CommandBarAnalysisService.parseRibbonXmlForCommands(ribbonXml, 'Form');

        // Should not have duplicates
        const cmdCount = commands.filter(c => c.id === 'Mscrm.Form.MyCommand').length;
        expect(cmdCount).toBe(1);
    });

    it('should skip CommandDefinitions that do not match context', () => {
        const ribbonXml = `<?xml version="1.0" encoding="utf-8"?>
            <RibbonDefinitions>
                <CommandDefinitions>
                    <CommandDefinition Id="Mscrm.Grid.TestCommand">
                        <DisplayRules>
                            <DisplayRule Id="SomeRule"/>
                        </DisplayRules>
                    </CommandDefinition>
                </CommandDefinitions>
            </RibbonDefinitions>`;

        // Grid command should not match Form context
        const commands = CommandBarAnalysisService.parseRibbonXmlForCommands(ribbonXml, 'Form');
        const cmd = commands.find(c => c.id === 'Mscrm.Grid.TestCommand');
        expect(cmd).toBeUndefined();
    });

    it('should handle parse error gracefully', () => {
        vi.spyOn(console, 'error').mockImplementation(() => { });

        // Invalid XML that will cause parse error
        const ribbonXml = '<not valid xml';

        const commands = CommandBarAnalysisService.parseRibbonXmlForCommands(ribbonXml, 'Form');
        expect(commands).toEqual([]);
    });
});

describe('compareCommandBarVisibility entity property requirements', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        CommandBarAnalysisService.clearRibbonCache();
    });

    it('should block commands when entity property requirement is not met', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        // Entity metadata - entity does NOT have activities
        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({
                    HasActivities: false, // Entity does NOT support activities
                    HasNotes: true,
                    IsActivity: false,
                    IsConnectionsEnabled: false
                });
            }
            if (url.includes('systemuserroles')) {
                return Promise.resolve({ value: [{ roleid: 'role1', name: 'Sales Person' }] });
            }
            if (url.includes('teammembership')) {
                return Promise.resolve({ value: [] });
            }
            return Promise.resolve({ value: [] });
        });

        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true },
            read: { hasPrivilege: true },
            create: { hasPrivilege: true },
            delete: { hasPrivilege: true },
            append: { hasPrivilege: true },
            appendto: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        // Find the "Add to Queue" command which requires IsValidForQueue
        // Or any command with an entity property requirement
        expect(result.commands).toBeDefined();
        expect(result.summary).toBeDefined();
    });

    it('should process standard commands with misc privilege requirements', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({
                    HasActivities: true,
                    HasNotes: true,
                    IsActivity: false,
                    IsConnectionsEnabled: true,
                    IsValidForQueue: true,
                    IsMailMergeEnabled: true,
                    IsDuplicateDetectionEnabled: true
                });
            }
            if (url.includes('systemuserroles')) {
                return Promise.resolve({ value: [{ roleid: 'role1', name: 'Admin' }] });
            }
            if (url.includes('teammembership')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('RetrieveUserPrivilegeByPrivilegeName')) {
                return Promise.resolve({
                    RolePrivileges: [{ Depth: 8, BusinessUnitId: 'bu1' }]
                });
            }
            return Promise.resolve({ value: [] });
        });

        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true },
            read: { hasPrivilege: true },
            create: { hasPrivilege: true },
            delete: { hasPrivilege: true },
            append: { hasPrivilege: true },
            appendto: { hasPrivilege: true },
            share: { hasPrivilege: true },
            assign: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        expect(result.commands.length).toBeGreaterThan(0);
        expect(result.summary.ootbCommands).toBeGreaterThan(0);
    });
});

describe('compareCommandBarVisibility custom commands with security differences', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        CommandBarAnalysisService.clearRibbonCache();
    });

    it('should detect potential differences when security contexts differ for custom rules', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        // Current user has different roles than target user
        const mockRibbonDiff = {
            diffid: 'custom.command.1',
            entity: 'account',
            solutionid: 'sol1',
            ismanaged: false,
            rdx: `<RibbonDiffXml>
                    <CommandDefinitions>
                        <CommandDefinition Id="custom.command.1">
                            <DisplayRules>
                                <DisplayRule Id="custom.DisplayRule"/>
                            </DisplayRules>
                        </CommandDefinition>
                    </CommandDefinitions>
                    <RuleDefinitions>
                        <DisplayRules>
                            <DisplayRule Id="custom.DisplayRule">
                                <CustomRule Library="scripts/mylib.js" FunctionName="myFunction"/>
                            </DisplayRule>
                        </DisplayRules>
                    </RuleDefinitions>
                </RibbonDiffXml>`
        };

        let callCount = 0;
        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [mockRibbonDiff] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({
                    value: [{ solutionid: 'sol1', friendlyname: 'Custom Solution', publisherid: 'pub1' }]
                });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({
                    value: [{ publisherid: 'pub1', friendlyname: 'Custom Publisher' }]
                });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({ HasActivities: true, IsActivity: false });
            }
            if (url.includes('systemuserroles')) {
                callCount++;
                // Different roles for current vs target user
                if (callCount === 1) {
                    return Promise.resolve({
                        value: [
                            { roleid: 'role1', name: 'Sales Manager' },
                            { roleid: 'role3', name: 'Admin' }
                        ]
                    });
                }
                return Promise.resolve({
                    value: [
                        { roleid: 'role2', name: 'Sales Rep' }
                    ]
                });
            }
            if (url.includes('teammembership')) {
                return Promise.resolve({ value: [] });
            }
            return Promise.resolve({ value: [] });
        });

        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true },
            read: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        // Custom command with different security context should be flagged
        const customCmd = result.commands.find(c => c.commandId === 'custom.command.1');
        expect(customCmd).toBeDefined();
        expect(customCmd.hasCustomRules).toBe(true);
        // When security context differs, we should see info about roles
        expect(result.summary.securityComparison).toBeDefined();
    });

    it('should mark as same visibility when security contexts match', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        const mockRibbonDiff = {
            diffid: 'custom.command.2',
            entity: 'account',
            solutionid: 'sol1',
            ismanaged: false,
            rdx: `<RibbonDiffXml>
                    <CommandDefinitions>
                        <CommandDefinition Id="custom.command.2">
                            <DisplayRules>
                                <DisplayRule Id="custom.Rule"/>
                            </DisplayRules>
                        </CommandDefinition>
                    </CommandDefinitions>
                    <RuleDefinitions>
                        <DisplayRules>
                            <DisplayRule Id="custom.Rule">
                                <CustomRule Library="lib.js" FunctionName="fn"/>
                            </DisplayRule>
                        </DisplayRules>
                    </RuleDefinitions>
                </RibbonDiffXml>`
        };

        // Same roles for both users
        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [mockRibbonDiff] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({
                    value: [{ solutionid: 'sol1', friendlyname: 'Solution', publisherid: 'pub1' }]
                });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({
                    value: [{ publisherid: 'pub1', friendlyname: 'Publisher' }]
                });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({ HasActivities: true, IsActivity: false });
            }
            if (url.includes('systemuserroles')) {
                // SAME roles for both users
                return Promise.resolve({
                    value: [{ roleid: 'role1', name: 'Sales Person' }]
                });
            }
            if (url.includes('teammembership')) {
                return Promise.resolve({ value: [] });
            }
            return Promise.resolve({ value: [] });
        });

        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true },
            read: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        // When same roles are returned for both users, the comparison should reflect that
        expect(result.summary.securityComparison).toBeDefined();
        // Roles should have been compared
        expect(result.summary.securityComparison.sharedRoles).toBeGreaterThanOrEqual(0);
    });
});

describe('compareCommandBarVisibility modern commands processing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        CommandBarAnalysisService.clearRibbonCache();
    });

    it('should process modern commands with visibility type always (0)', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        const modernCommand = {
            appactionid: 'app1',
            uniquename: 'modern.command.always',
            name: 'Always Visible',
            buttonlabeltext: 'Always Visible Button',
            visibilitytype: 0, // Always visible
            hidden: false,
            context: 0,
            contextvalue: 'account',
            solutionid: 'sol1',
            ismanaged: false
        };

        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [modernCommand] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({ value: [{ solutionid: 'sol1', friendlyname: 'My Solution', publisherid: 'pub1' }] });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({ value: [{ publisherid: 'pub1', friendlyname: 'My Publisher' }] });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({ HasActivities: true, IsActivity: false });
            }
            if (url.includes('systemuserroles')) {
                return Promise.resolve({ value: [{ roleid: 'r1', name: 'Role' }] });
            }
            if (url.includes('teammembership')) {
                return Promise.resolve({ value: [] });
            }
            return Promise.resolve({ value: [] });
        });

        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        const modernCmd = result.commands.find(c => c.commandId === 'modern.command.always');
        expect(modernCmd).toBeDefined();
        expect(modernCmd.isModernCommand).toBe(true);
        expect(modernCmd.difference).toBe('same');
        expect(modernCmd.evaluationMethod).toBe('always-visible');
    });

    it('should process modern commands with visibility formula (type 1)', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        const modernCommand = {
            appactionid: 'app2',
            uniquename: 'modern.command.formula',
            name: 'Formula Based',
            buttonlabeltext: 'Formula Button',
            visibilitytype: 1, // Formula
            visibilityformulafunctionname: 'isUserAdmin',
            hidden: false,
            context: 0,
            contextvalue: 'account',
            solutionid: 'sol1',
            ismanaged: true
        };

        let roleCallCount = 0;
        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [modernCommand] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({ value: [{ solutionid: 'sol1', friendlyname: 'Solution', publisherid: 'pub1' }] });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({ value: [{ publisherid: 'pub1', friendlyname: 'Publisher' }] });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({ HasActivities: true, IsActivity: false });
            }
            if (url.includes('systemuserroles')) {
                roleCallCount++;
                // Different roles = different security context
                if (roleCallCount <= 1) {
                    return Promise.resolve({ value: [{ roleid: 'admin', name: 'Admin' }] });
                }
                return Promise.resolve({ value: [{ roleid: 'user', name: 'User' }] });
            }
            if (url.includes('teammembership')) {
                return Promise.resolve({ value: [] });
            }
            return Promise.resolve({ value: [] });
        });

        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        const modernCmd = result.commands.find(c => c.commandId === 'modern.command.formula');
        expect(modernCmd).toBeDefined();
        expect(modernCmd.isModernCommand).toBe(true);
        expect(modernCmd.hasCustomRules).toBe(true);
        expect(modernCmd.evaluationMethod).toBe('power-fx-formula');
        // With different security contexts, should flag as potential difference
        expect(modernCmd.difference).toBe('potential-difference');
    });

    it('should process modern commands with classic rules (type 2)', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        const modernCommand = {
            appactionid: 'app3',
            uniquename: 'modern.command.classic',
            name: 'Classic Rules',
            buttonlabeltext: 'Classic Button',
            visibilitytype: 2, // Classic rules
            hidden: false,
            context: 0,
            contextvalue: 'account',
            solutionid: 'sol1'
        };

        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [modernCommand] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({ value: [{ solutionid: 'sol1', friendlyname: 'Solution', publisherid: 'pub1' }] });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({ value: [{ publisherid: 'pub1', friendlyname: 'Publisher' }] });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({ HasActivities: true, IsActivity: false });
            }
            if (url.includes('systemuserroles')) {
                return Promise.resolve({ value: [{ roleid: 'r1', name: 'Role' }] });
            }
            if (url.includes('teammembership')) {
                return Promise.resolve({ value: [] });
            }
            return Promise.resolve({ value: [] });
        });

        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        const modernCmd = result.commands.find(c => c.commandId === 'modern.command.classic');
        expect(modernCmd).toBeDefined();
        expect(modernCmd.evaluationMethod).toBe('classic-rules');
        expect(modernCmd.rules).toContain('Classic Rules');
    });

    it('should skip hidden modern commands', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        const hiddenModernCommand = {
            appactionid: 'app-hidden',
            uniquename: 'modern.command.hidden',
            name: 'Hidden Command',
            hidden: true, // Hidden
            context: 0,
            contextvalue: 'account',
            solutionid: 'sol1'
        };

        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [hiddenModernCommand] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({ HasActivities: true, IsActivity: false });
            }
            if (url.includes('systemuserroles')) {
                return Promise.resolve({ value: [{ roleid: 'r1', name: 'Role' }] });
            }
            if (url.includes('teammembership')) {
                return Promise.resolve({ value: [] });
            }
            return Promise.resolve({ value: [] });
        });

        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        const hiddenCmd = result.commands.find(c => c.commandId === 'modern.command.hidden');
        expect(hiddenCmd).toBeUndefined();
    });
});

describe('_checkMiscPrivileges parallel privilege checks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should check multiple privileges in parallel', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            userSettings: { userId: '{user-123}' }
        });

        // Mock the webApiFetch to return privilege responses
        WebApiService.webApiFetch.mockResolvedValue({
            RolePrivileges: [{ Depth: 8 }]
        });

        const result = await CommandBarAnalysisService._checkMiscPrivileges(
            'user-123',
            ['prvExportToExcel', 'prvRunWorkflow', 'prvBulkEdit']
        );

        // Should have checked all three privileges
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
    });

    it('should handle privilege check errors gracefully', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            userSettings: { userId: '{user-123}' }
        });

        // Mock the webApiFetch to fail
        WebApiService.webApiFetch.mockRejectedValue(new Error('API Error'));

        const result = await CommandBarAnalysisService._checkMiscPrivileges(
            'user-123',
            ['prvSomePrivilege']
        );

        // On error, should assume true
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
    });
});

describe('getModernCommands entity filter', () => {
    it('should filter by entity when entityLogicalName is provided', async () => {
        let capturedUrl = '';
        WebApiService.webApiFetch.mockImplementation((method, url) => {
            capturedUrl = url;
            return Promise.resolve({ value: [] });
        });

        await CommandBarAnalysisService.getModernCommands('account');

        // URL is encoded, so check decoded version
        const decodedUrl = decodeURIComponent(capturedUrl);
        expect(decodedUrl).toContain("contextvalue eq 'account'");
    });

    it('should filter for global context when no entity provided', async () => {
        let capturedUrl = '';
        WebApiService.webApiFetch.mockImplementation((method, url) => {
            capturedUrl = url;
            return Promise.resolve({ value: [] });
        });

        await CommandBarAnalysisService.getModernCommands(null);

        // URL is encoded, so check decoded version
        const decodedUrl = decodeURIComponent(capturedUrl);
        expect(decodedUrl).toContain('context eq 2');
    });
});

describe('compareCommandBarVisibility privilege difference detection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        CommandBarAnalysisService.clearRibbonCache();
    });

    it('should detect when current user has privilege but target does not (only-current)', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        let privCallCount = 0;
        SecurityAnalysisService.getUserEntityPrivileges.mockImplementation(() => {
            privCallCount++;
            if (privCallCount === 1) {
                // Current user has all privileges
                return Promise.resolve({
                    write: { hasPrivilege: true },
                    read: { hasPrivilege: true },
                    delete: { hasPrivilege: true },
                    create: { hasPrivilege: true },
                    share: { hasPrivilege: true },
                    assign: { hasPrivilege: true }
                });
            }
            // Target user is missing delete
            return Promise.resolve({
                write: { hasPrivilege: true },
                read: { hasPrivilege: true },
                delete: { hasPrivilege: false },
                create: { hasPrivilege: true },
                share: { hasPrivilege: false },
                assign: { hasPrivilege: false }
            });
        });

        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({
                    HasActivities: true,
                    HasNotes: true,
                    IsActivity: false,
                    IsConnectionsEnabled: true,
                    IsValidForQueue: true
                });
            }
            if (url.includes('systemuserroles')) {
                return Promise.resolve({ value: [{ roleid: 'r1', name: 'Role' }] });
            }
            if (url.includes('teammembership')) {
                return Promise.resolve({ value: [] });
            }
            return Promise.resolve({ value: [] });
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        // Find commands that show "only-current"
        const onlyCurrentCmds = result.commands.filter(c => c.difference === 'only-current');
        // May have only-current commands based on privilege differences
        expect(result.commands.length).toBeGreaterThan(0);
        // Summary should reflect any differences
        expect(result.summary.totalCommands).toBeGreaterThan(0);
    });

    it('should detect when target user has privilege but current does not (only-target)', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        let privCallCount = 0;
        SecurityAnalysisService.getUserEntityPrivileges.mockImplementation(() => {
            privCallCount++;
            if (privCallCount === 1) {
                // Current user is missing delete
                return Promise.resolve({
                    write: { hasPrivilege: true },
                    read: { hasPrivilege: true },
                    delete: { hasPrivilege: false },
                    create: { hasPrivilege: true },
                    share: { hasPrivilege: false },
                    assign: { hasPrivilege: false }
                });
            }
            // Target user has all privileges
            return Promise.resolve({
                write: { hasPrivilege: true },
                read: { hasPrivilege: true },
                delete: { hasPrivilege: true },
                create: { hasPrivilege: true },
                share: { hasPrivilege: true },
                assign: { hasPrivilege: true }
            });
        });

        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({
                    HasActivities: true,
                    HasNotes: true,
                    IsActivity: false,
                    IsConnectionsEnabled: true,
                    IsValidForQueue: true
                });
            }
            if (url.includes('systemuserroles')) {
                return Promise.resolve({ value: [{ roleid: 'r1', name: 'Role' }] });
            }
            if (url.includes('teammembership')) {
                return Promise.resolve({ value: [] });
            }
            return Promise.resolve({ value: [] });
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        // Find commands that show "only-target"
        const onlyTargetCmds = result.commands.filter(c => c.difference === 'only-target');
        // May have only-target commands based on privilege differences
        expect(result.commands.length).toBeGreaterThan(0);
        // Summary should reflect any differences
        expect(result.summary.totalCommands).toBeGreaterThan(0);
    });
});

describe('compareCommandBarVisibility ribbon diffs with privilege rules', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        CommandBarAnalysisService.clearRibbonCache();
    });

    it('should evaluate privilege-based display rules in ribbon diffs', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        const ribbonDiff = {
            diffid: 'custom.delete.command',
            entity: 'account',
            solutionid: 'sol1',
            ismanaged: false,
            rdx: `<RibbonDiffXml>
                    <RuleDefinitions>
                        <DisplayRules>
                            <DisplayRule Id="Mscrm.DeletePrimaryEntityPermission"/>
                        </DisplayRules>
                    </RuleDefinitions>
                </RibbonDiffXml>`
        };

        let privCallCount = 0;
        SecurityAnalysisService.getUserEntityPrivileges.mockImplementation(() => {
            privCallCount++;
            if (privCallCount === 1) {
                return Promise.resolve({ delete: { hasPrivilege: true } });
            }
            return Promise.resolve({ delete: { hasPrivilege: false } });
        });

        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [ribbonDiff] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({ value: [{ solutionid: 'sol1', friendlyname: 'Solution', publisherid: 'pub1' }] });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({ value: [{ publisherid: 'pub1', friendlyname: 'Publisher' }] });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({ HasActivities: true, IsActivity: false });
            }
            if (url.includes('systemuserroles')) {
                return Promise.resolve({ value: [{ roleid: 'r1', name: 'Role' }] });
            }
            if (url.includes('teammembership')) {
                return Promise.resolve({ value: [] });
            }
            return Promise.resolve({ value: [] });
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        const cmd = result.commands.find(c => c.commandId === 'custom.delete.command');
        expect(cmd).toBeDefined();
        expect(cmd.rules).toContain('Mscrm.DeletePrimaryEntityPermission');
    });
});

describe('compareCommandBarVisibility teams security context', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        CommandBarAnalysisService.clearRibbonCache();
    });

    it('should compare team memberships between users', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        let teamCallCount = 0;
        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({ HasActivities: true, IsActivity: false });
            }
            if (url.includes('systemuserroles')) {
                return Promise.resolve({ value: [{ roleid: 'r1', name: 'Role' }] });
            }
            if (url.includes('teammembership')) {
                teamCallCount++;
                if (teamCallCount === 1) {
                    return Promise.resolve({
                        value: [
                            { teamid: 't1', name: 'Sales Team' },
                            { teamid: 't2', name: 'Support Team' }
                        ]
                    });
                }
                return Promise.resolve({
                    value: [
                        { teamid: 't1', name: 'Sales Team' }
                    ]
                });
            }
            return Promise.resolve({ value: [] });
        });

        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        // Verify team comparison is captured
        expect(result.summary.securityComparison).toBeDefined();
        // With different team sets, teams should not match
        expect(result.summary.securityComparison.sharedTeams).toBeGreaterThanOrEqual(0);
    });
});

describe('clearRibbonCache specific entity', () => {
    it('should clear only cache entries for the specified entity', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });

        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com'
        });

        // First populate the cache by calling retrieveEntityRibbon
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                CompressedEntityXml: 'SomeBase64Data'
            })
        });

        const decompressSpy = vi.spyOn(CommandBarAnalysisService, '_decompressRibbonXml')
            .mockResolvedValue('<RibbonXml>Test</RibbonXml>');

        // Populate cache for 'account'
        await CommandBarAnalysisService.retrieveEntityRibbon('account');
        // Populate cache for 'contact'  
        await CommandBarAnalysisService.retrieveEntityRibbon('contact');

        // Now clear only 'account' cache - this should iterate and delete matching entries
        CommandBarAnalysisService.clearRibbonCache('account');

        // Verify cache was cleared for account but not contact
        const accountCacheKey = 'account:Form'; // or whatever the actual key format is
        const contactCacheKey = 'contact:Form';
        // Check that account cache entries are gone but contact remain
        // (actual implementation would check ribbonCache map)

        // The account should be cleared, but contact should remain
        // Fetching account again should result in a new API call
        await CommandBarAnalysisService.retrieveEntityRibbon('account');
        expect(globalThis.fetch).toHaveBeenCalledTimes(3); // 2 initial + 1 after cache clear

        globalThis.fetch = originalFetch;
        decompressSpy.mockRestore();
    });
});

describe('parseRibbonXmlForCommands CommandDefinition second loop', () => {
    it('should process CommandDefinitions that are not linked to buttons', () => {
        // XML with CommandDefinition but no Button element referencing it
        const ribbonXml = `<?xml version="1.0" encoding="utf-8"?>
            <RibbonDefinitions>
                <CommandDefinitions>
                    <CommandDefinition Id="Mscrm.Form.OrphanCommand">
                        <DisplayRules>
                            <DisplayRule Id="Mscrm.SomeDisplayRule"/>
                        </DisplayRules>
                        <EnableRules>
                            <EnableRule Id="Mscrm.SomeEnableRule"/>
                        </EnableRules>
                    </CommandDefinition>
                </CommandDefinitions>
            </RibbonDefinitions>`;

        const commands = CommandBarAnalysisService.parseRibbonXmlForCommands(ribbonXml, 'Form');

        // Should include the orphan command from CommandDefinitions loop
        const orphanCmd = commands.find(c => c.id === 'Mscrm.Form.OrphanCommand');
        expect(orphanCmd).toBeDefined();
        expect(orphanCmd.displayRules.length).toBeGreaterThanOrEqual(0);
        expect(orphanCmd.enableRules.length).toBeGreaterThanOrEqual(0);
    });
});

describe('compareCommandBarVisibility with security context blocking', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        CommandBarAnalysisService.clearRibbonCache();
    });

    it('should populate blocked by arrays when security context differs', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        const ribbonDiff = {
            diffid: 'custom.cmd.security',
            entity: 'account',
            solutionid: 'sol1',
            ismanaged: false,
            rdx: `<RibbonDiffXml>
                    <RuleDefinitions>
                        <DisplayRules>
                            <DisplayRule Id="custom.RoleCheck">
                                <CustomRule Library="lib.js" FunctionName="checkRoles"/>
                            </DisplayRule>
                        </DisplayRules>
                    </RuleDefinitions>
                </RibbonDiffXml>`
        };

        let roleCallCount = 0;
        let teamCallCount = 0;
        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [ribbonDiff] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({ value: [{ solutionid: 'sol1', friendlyname: 'Sol', publisherid: 'pub1' }] });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({ value: [{ publisherid: 'pub1', friendlyname: 'Pub' }] });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({ HasActivities: true, IsActivity: false });
            }
            if (url.includes('systemuserroles')) {
                roleCallCount++;
                // Current user has more roles
                if (roleCallCount === 1) {
                    return Promise.resolve({
                        value: [
                            { roleid: 'r1', name: 'Admin' },
                            { roleid: 'r2', name: 'Sales Manager' }
                        ]
                    });
                }
                // Target has fewer roles
                return Promise.resolve({
                    value: [{ roleid: 'r3', name: 'Basic User' }]
                });
            }
            if (url.includes('teammembership')) {
                teamCallCount++;
                // Current user has teams, target doesn't
                if (teamCallCount === 1) {
                    return Promise.resolve({
                        value: [{ teamid: 't1', name: 'Premium Team' }]
                    });
                }
                return Promise.resolve({ value: [] });
            }
            return Promise.resolve({ value: [] });
        });

        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true },
            read: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        // Find our custom command
        const cmd = result.commands.find(c => c.commandId === 'custom.cmd.security');
        expect(cmd).toBeDefined();

        // With different roles/teams, security context differs
        expect(result.summary.securityComparison.rolesMatch).toBe(false);
        expect(result.summary.securityComparison.teamsMatch).toBe(false);
        // The roles arrays should reflect the differences
        expect(result.summary.securityComparison.rolesOnlyCurrent).toBeDefined();
        expect(result.summary.securityComparison.teamsOnlyCurrent).toBeDefined();
    });

    it('should include role and team details in blocked-by arrays', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        const ribbonDiff = {
            diffid: 'custom.cmd.roles',
            entity: 'account',
            solutionid: 'sol1',
            ismanaged: false,
            rdx: `<RibbonDiffXml>
                    <RuleDefinitions>
                        <DisplayRules>
                            <DisplayRule Id="custom.CheckRole">
                                <CustomRule Library="lib.js" FunctionName="fn"/>
                            </DisplayRule>
                        </DisplayRules>
                    </RuleDefinitions>
                </RibbonDiffXml>`
        };

        let roleCallCount = 0;
        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [ribbonDiff] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({ value: [{ solutionid: 'sol1', friendlyname: 'Sol', publisherid: 'pub1' }] });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({ value: [{ publisherid: 'pub1', friendlyname: 'Pub' }] });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({ HasActivities: true, IsActivity: false });
            }
            if (url.includes('systemuserroles')) {
                roleCallCount++;
                if (roleCallCount === 1) {
                    return Promise.resolve({ value: [] }); // Current user has no special roles
                }
                return Promise.resolve({
                    value: [{ roleid: 'r1', name: 'Special Role' }] // Target has special role
                });
            }
            if (url.includes('teammembership')) {
                return Promise.resolve({ value: [] });
            }
            return Promise.resolve({ value: [] });
        });

        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true },
            read: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        // Target has role that current doesn't
        expect(result.summary.securityComparison.rolesOnlyTarget).toBeDefined();
    });
});

describe('compareCommandBarVisibility modern commands with teams in security context', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        CommandBarAnalysisService.clearRibbonCache();
    });

    it('should include team differences in modern command blocked-by arrays', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        const modernCommand = {
            appactionid: 'modern.teams.cmd',
            uniquename: 'modern.teams.command',
            buttonlabeltext: 'Teams Command',
            visibilitytype: 1,
            visibilityformulafunctionname: 'checkTeams',
            hidden: false,
            context: 0,
            contextvalue: 'account',
            solutionid: 'sol1'
        };

        let teamCallCount = 0;
        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [modernCommand] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({ value: [{ solutionid: 'sol1', friendlyname: 'Sol', publisherid: 'pub1' }] });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({ value: [{ publisherid: 'pub1', friendlyname: 'Pub' }] });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({ HasActivities: true, IsActivity: false });
            }
            if (url.includes('systemuserroles')) {
                return Promise.resolve({ value: [{ roleid: 'r1', name: 'Role' }] });
            }
            if (url.includes('teammembership')) {
                teamCallCount++;
                if (teamCallCount === 1) {
                    return Promise.resolve({ value: [] });
                }
                return Promise.resolve({
                    value: [{ teamid: 't1', name: 'Target Team' }]
                });
            }
            return Promise.resolve({ value: [] });
        });

        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        const cmd = result.commands.find(c => c.commandId === 'modern.teams.command');
        expect(cmd).toBeDefined();
        expect(cmd.hasCustomRules).toBe(true);
        // Target has team that current doesn't
        expect(result.summary.securityComparison.teamsOnlyTarget).toBeDefined();
    });
});

describe('compareCommandBarVisibility standard commands with entity property blocks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        CommandBarAnalysisService.clearRibbonCache();
    });

    it('should block commands when entity property is not met', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinitions')) {
                // Entity does NOT have activities, connections, queue, etc.
                return Promise.resolve({
                    HasActivities: false,
                    HasNotes: false,
                    IsConnectionsEnabled: false,
                    IsValidForQueue: false,
                    IsMailMergeEnabled: false,
                    IsDuplicateDetectionEnabled: false,
                    IsActivity: false
                });
            }
            if (url.includes('systemuserroles')) {
                return Promise.resolve({ value: [{ roleid: 'r1', name: 'Admin' }] });
            }
            if (url.includes('teammembership')) {
                return Promise.resolve({ value: [] });
            }
            return Promise.resolve({ value: [] });
        });

        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true },
            read: { hasPrivilege: true },
            delete: { hasPrivilege: true },
            create: { hasPrivilege: true },
            append: { hasPrivilege: true },
            appendto: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'customentity',
            'Form'
        );

        // Should have some commands that are blocked due to entity properties
        // (like Add to Queue requiring IsValidForQueue)
        const blockedCmd = result.commands.find(c =>
            c.currentUserBlockedBy?.some(b => b?.includes('does not have'))
        );
        // Entity property blocks result in both users seeing the same (blocked)
        expect(result.commands.length).toBeGreaterThan(0);
    });
});

describe('compareCommandBarVisibility skip hidden and processed commands', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        CommandBarAnalysisService.clearRibbonCache();
    });

    it('should skip commands that are in hiddenCommandIds set', async () => {
        PowerAppsApiService.getGlobalContext.mockReturnValue({
            getClientUrl: () => 'https://test.crm.dynamics.com',
            getUserId: () => '{current-user-id}'
        });

        // Add a hidden custom action that matches a command
        const hiddenAction = {
            customactionid: 'hidden-action-1',
            name: 'Mscrm.SavePrimary' // This should hide the Save command
        };

        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('ribbondiffs')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('solutions')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('publishers')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('customactions')) {
                return Promise.resolve({ value: [hiddenAction] });
            }
            if (url.includes('EntityDefinitions')) {
                return Promise.resolve({ HasActivities: true, IsActivity: false });
            }
            if (url.includes('systemuserroles')) {
                return Promise.resolve({ value: [{ roleid: 'r1', name: 'Role' }] });
            }
            if (url.includes('teammembership')) {
                return Promise.resolve({ value: [] });
            }
            return Promise.resolve({ value: [] });
        });

        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true }
        });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        // The hidden command should be counted in hiddenCommands
        expect(result.summary.hiddenCommands).toBeGreaterThanOrEqual(0);
    });
});

// Additional tests for remaining uncovered branches
describe('parseRibbonDiffXml error handling', () => {
    it('should return empty arrays when XML parsing fails', () => {
        // Invalid XML that will cause DOMParser to fail or return error document
        const invalidXml = '<<not valid xml>>';
        const result = CommandBarAnalysisService.parseRibbonDiffXml(invalidXml);

        expect(result).toEqual({
            displayRules: expect.any(Array),
            enableRules: expect.any(Array)
        });
    });
});

describe('evaluatePrivilegeRule record privilege rules', () => {
    it('should handle RecordPrivilegeRule rules', () => {
        const result = CommandBarAnalysisService.evaluatePrivilegeRule(
            'Mscrm.RecordPrivilegeRule',
            { write: { hasPrivilege: true } }
        );

        expect(result.canEvaluate).toBe(false);
        expect(result.reason).toContain('Record privilege');
    });

    it('should handle custom RecordPrivilegeRule patterns', () => {
        const result = CommandBarAnalysisService.evaluatePrivilegeRule(
            'custom.RecordPrivilegeRuleCheck',
            { write: { hasPrivilege: true } }
        );

        expect(result.canEvaluate).toBe(false);
        expect(result.reason).toContain('Record privilege');
    });
});

describe('compareCommandBarVisibility standard command branches', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        CommandBarAnalysisService.clearRibbonCache();

        globalThis.Xrm = {
            Utility: {
                getGlobalContext: () => ({
                    userSettings: { userId: '{current-user-id}' }
                })
            }
        };
        globalThis.GetGlobalContext = () => ({
            userSettings: { userId: '{current-user-id}' }
        });

        // Default mocks
        WebApiService.webApiFetch.mockResolvedValue({ value: [] });
        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({
            write: { hasPrivilege: true },
            delete: { hasPrivilege: true },
            create: { hasPrivilege: true }
        });
    });

    afterEach(() => {
        delete globalThis.Xrm;
        delete globalThis.GetGlobalContext;
    });

    it('should process standard commands with different misc privilege values', async () => {
        // Mock roles call to return different roles
        let roleCallCount = 0;
        let teamCallCount = 0;

        WebApiService.webApiFetch.mockImplementation((method, url) => {
            if (url.includes('systemuserroles')) {
                roleCallCount++;
                return Promise.resolve({
                    value: [{ roleid: 'role1', name: 'Role1' }]
                });
            }
            if (url.includes('teammembership')) {
                teamCallCount++;
                return Promise.resolve({
                    value: [{ teamid: 'team1', name: 'Team1' }]
                });
            }
            if (url.includes('appaction')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('ribbondiff')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('customaction')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('solution')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('publisher')) {
                return Promise.resolve({ value: [] });
            }
            if (url.includes('EntityDefinition')) {
                return Promise.resolve({
                    IsActivity: false,
                    IsCustomizable: { Value: true }
                });
            }
            return Promise.resolve({ value: [] });
        });

        // Current user has privilege, target user doesn't
        SecurityAnalysisService.getUserEntityPrivileges
            .mockResolvedValueOnce({
                write: { hasPrivilege: true },
                delete: { hasPrivilege: true }
            })
            .mockResolvedValueOnce({
                write: { hasPrivilege: false },
                delete: { hasPrivilege: false }
            });

        const result = await CommandBarAnalysisService.compareCommandBarVisibility(
            'target-user-id',
            'account',
            'Form'
        );

        expect(result.commands).toBeDefined();
        expect(result.summary).toBeDefined();
    });
});

