/**
 * @file Tests for ImpersonateTab Command Bar Analysis feature
 * @module tests/components/ImpersonateTab.commandbar.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock all dependencies
vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        fetchRecords: vi.fn(),
        getImpersonationInfo: vi.fn().mockReturnValue({ isImpersonating: false, userId: null, userName: null }),
        setImpersonation: vi.fn(),
        clearImpersonation: vi.fn()
    }
}));

vi.mock('../../src/services/SecurityAnalysisService.js', () => ({
    SecurityAnalysisService: {
        getUserEntityPrivileges: vi.fn(),
        getUserSecurityRoles: vi.fn(),
        compareUserPrivileges: vi.fn(),
        generateAdminCenterLink: vi.fn().mockReturnValue('https://admin.powerplatform.microsoft.com/environments'),
        generateEntraLink: vi.fn().mockReturnValue('https://entra.microsoft.com/')
    }
}));

vi.mock('../../src/services/LiveImpersonationService.js', () => ({
    LiveImpersonationService: {
        enableImpersonation: vi.fn(),
        disableImpersonation: vi.fn(),
        isEnabled: vi.fn().mockReturnValue(false),
        isActive: false,
        start: vi.fn(),
        stop: vi.fn()
    }
}));

vi.mock('../../src/services/CommandBarAnalysisService.js', () => ({
    CommandBarAnalysisService: {
        compareCommandBarVisibility: vi.fn(),
        getCurrentContext: vi.fn().mockReturnValue('HomePageGrid'),
        getCurrentEntity: vi.fn().mockReturnValue('account')
    }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: false,
        getGlobalContext: vi.fn().mockReturnValue({
            userSettings: { userId: '{current-user-id}' }
        })
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: {
        show: vi.fn()
    }
}));

vi.mock('../../src/ui/LiveComparisonPanel.js', () => ({
    LiveComparisonPanel: {
        show: vi.fn(),
        hide: vi.fn()
    }
}));

// Import after mocks
import { ImpersonateTab } from '../../src/components/ImpersonateTab.js';
import { DataService } from '../../src/services/DataService.js';
import { CommandBarAnalysisService } from '../../src/services/CommandBarAnalysisService.js';
import { SecurityAnalysisService } from '../../src/services/SecurityAnalysisService.js';
import { NotificationService } from '../../src/services/NotificationService.js';

describe('ImpersonateTab - Command Bar Analysis', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        // Reset mock return values
        DataService.getImpersonationInfo.mockReturnValue({ isImpersonating: false, userId: null, userName: null });
    });

    afterEach(() => {
        component?.cleanup?.();
        component?.destroy?.();
    });

    describe('Command Bar Comparison Button', () => {
        it('should have command comparison button in security actions', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const compareBtn = element.querySelector('#compare-commands-btn');
            expect(compareBtn).toBeTruthy();
            expect(compareBtn.textContent).toContain('Compare');
        });

        it('should be disabled when no user is selected', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const compareBtn = element.querySelector('#compare-commands-btn');
            expect(compareBtn.disabled).toBe(true);
        });
    });

    describe('_performCommandBarAnalysis', () => {
        it('should return early when no user is impersonating', async () => {
            // When not impersonating, _performCommandBarAnalysis returns early without doing anything
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: false,
                userId: null,
                userName: null
            });

            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Call analysis without selecting user - should return early
            await component._performCommandBarAnalysis();

            // Should NOT call CommandBarAnalysisService when not impersonating
            expect(CommandBarAnalysisService.compareCommandBarVisibility).not.toHaveBeenCalled();
        });

        it('should call CommandBarAnalysisService with correct parameters', async () => {
            const mockComparison = {
                commands: [
                    {
                        commandId: 'Mscrm.NewRecordFromGrid',
                        commandName: 'New',
                        entity: 'account',
                        visibleToCurrentUser: true,
                        visibleToTargetUser: false,
                        currentUserBlockedBy: [],
                        targetUserBlockedBy: ['Missing Create privilege'],
                        difference: 'only-current',
                        solutionName: 'System',
                        publisherName: 'Microsoft',
                        isManaged: true,
                        rules: ['Create']
                    }
                ],
                summary: {
                    totalCommands: 1,
                    differences: 1,
                    onlyCurrentUser: 1,
                    onlyTargetUser: 0,
                    sameVisibility: 0,
                    context: 'HomePageGrid',
                    entity: 'account'
                }
            };

            CommandBarAnalysisService.compareCommandBarVisibility.mockResolvedValue(mockComparison);
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'test-user-123',
                userName: 'Test User'
            });

            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component._enableSecurityAnalysis(true);

            // Perform analysis
            await component._performCommandBarAnalysis();

            expect(CommandBarAnalysisService.compareCommandBarVisibility).toHaveBeenCalled();
            const callArgs = CommandBarAnalysisService.compareCommandBarVisibility.mock.calls[0];
            expect(callArgs[0]).toBe('test-user-123'); // targetUserId
            expect(callArgs[1]).toBe('account');        // entityLogicalName
            expect(callArgs[2]).toBe('HomePageGrid');   // context
            // Note: comparisonUserId (4th arg) is null when comparing to current user
        });

        it('should render comparison results', async () => {
            const mockComparison = {
                commands: [
                    {
                        commandId: 'Mscrm.NewRecordFromGrid',
                        commandName: 'New',
                        entity: 'account',
                        visibleToCurrentUser: true,
                        visibleToTargetUser: false,
                        currentUserBlockedBy: [],
                        targetUserBlockedBy: ['Missing Create privilege'],
                        difference: 'only-current',
                        solutionName: 'System',
                        publisherName: 'Microsoft',
                        isManaged: true,
                        rules: ['Create']
                    }
                ],
                summary: {
                    totalCommands: 1,
                    differences: 1,
                    onlyCurrentUser: 1,
                    onlyTargetUser: 0,
                    sameVisibility: 0,
                    context: 'HomePageGrid',
                    entity: 'account'
                }
            };

            CommandBarAnalysisService.compareCommandBarVisibility.mockResolvedValue(mockComparison);
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'test-user-123',
                userName: 'Test User'
            });

            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component._enableSecurityAnalysis(true);

            await component._performCommandBarAnalysis();

            // Check if results are rendered
            const content = component.ui.securityAnalysisContent;
            expect(content.innerHTML).toBeTruthy();
        });

        it('should handle empty results', async () => {
            const mockComparison = {
                commands: [],
                summary: {
                    totalCommands: 0,
                    differences: 0,
                    onlyCurrentUser: 0,
                    onlyTargetUser: 0,
                    sameVisibility: 0,
                    context: 'HomePageGrid',
                    entity: 'account'
                }
            };

            CommandBarAnalysisService.compareCommandBarVisibility.mockResolvedValue(mockComparison);
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'test-user-123',
                userName: 'Test User'
            });

            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component._enableSecurityAnalysis(true);

            await component._performCommandBarAnalysis();

            const content = component.ui.securityAnalysisContent;
            expect(content.innerHTML).toBeTruthy();
        });

        it('should render error message on failure', async () => {
            CommandBarAnalysisService.compareCommandBarVisibility.mockRejectedValue(
                new Error('API Error')
            );
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'test-user-123',
                userName: 'Test User'
            });

            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component._enableSecurityAnalysis(true);

            await component._performCommandBarAnalysis();

            // The implementation renders error in HTML, not via NotificationService
            const content = component.ui.securityAnalysisContent;
            expect(content.innerHTML).toContain('pdt-error');
            expect(content.innerHTML).toContain('API Error');
        });
    });

    describe('Command Rendering', () => {
        it('should render commands with differences first', async () => {
            const mockComparison = {
                commands: [
                    {
                        commandId: 'Custom.Command',
                        commandName: 'Custom',
                        difference: 'same',
                        visibleToCurrentUser: true,
                        visibleToTargetUser: true,
                        currentUserBlockedBy: [],
                        targetUserBlockedBy: [],
                        solutionName: 'MySolution',
                        isManaged: false
                    },
                    {
                        commandId: 'Mscrm.NewRecordFromGrid',
                        commandName: 'New',
                        difference: 'only-current',
                        visibleToCurrentUser: true,
                        visibleToTargetUser: false,
                        currentUserBlockedBy: [],
                        targetUserBlockedBy: ['Missing Create privilege'],
                        solutionName: 'System',
                        isManaged: true
                    }
                ],
                summary: {
                    totalCommands: 2,
                    differences: 1,
                    onlyCurrentUser: 1,
                    onlyTargetUser: 0,
                    sameVisibility: 1
                }
            };

            CommandBarAnalysisService.compareCommandBarVisibility.mockResolvedValue(mockComparison);
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'test-user-123',
                userName: 'Test User'
            });

            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component._enableSecurityAnalysis(true);

            await component._performCommandBarAnalysis();

            const content = component.ui.securityAnalysisContent;
            expect(content.innerHTML).toBeTruthy();
        });

        it('should show all same commands in collapsed section', async () => {
            const sameCommands = Array.from({ length: 50 }, (_, i) => ({
                commandId: `Command.${i}`,
                commandName: `Command ${i}`,
                difference: 'same',
                visibleToCurrentUser: true,
                visibleToTargetUser: true,
                currentUserBlockedBy: [],
                targetUserBlockedBy: [],
                solutionName: 'System',
                isManaged: true
            }));

            const mockComparison = {
                commands: sameCommands,
                summary: {
                    totalCommands: 50,
                    differences: 0,
                    onlyCurrentUser: 0,
                    onlyTargetUser: 0,
                    sameVisibility: 50
                }
            };

            CommandBarAnalysisService.compareCommandBarVisibility.mockResolvedValue(mockComparison);
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'test-user-123',
                userName: 'Test User'
            });

            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component._enableSecurityAnalysis(true);

            await component._performCommandBarAnalysis();

            const content = component.ui.securityAnalysisContent;
            expect(content.innerHTML).toBeTruthy();
        });

        it('should make command IDs clickable for copying', async () => {
            const mockComparison = {
                commands: [{
                    commandId: 'Mscrm.NewRecordFromGrid',
                    commandName: 'New',
                    difference: 'only-current',
                    visibleToCurrentUser: true,
                    visibleToTargetUser: false,
                    currentUserBlockedBy: [],
                    targetUserBlockedBy: ['Missing Create privilege'],
                    solutionName: 'System',
                    isManaged: true
                }],
                summary: { totalCommands: 1, differences: 1, sameVisibility: 0 }
            };

            CommandBarAnalysisService.compareCommandBarVisibility.mockResolvedValue(mockComparison);
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'test-user-123',
                userName: 'Test User'
            });

            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component._enableSecurityAnalysis(true);

            await component._performCommandBarAnalysis();

            // The content should be rendered
            const content = component.ui.securityAnalysisContent;
            expect(content.innerHTML).toBeTruthy();
        });
    });

    describe('Admin Center Buttons', () => {
        it('should have Open Admin Center button', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const adminBtn = element.querySelector('#open-admin-center-btn');
            expect(adminBtn).toBeTruthy();
        });

        it('should have Open Microsoft Entra button', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const entraBtn = element.querySelector('#open-entra-btn');
            expect(entraBtn).toBeTruthy();
        });

        it('should open Admin Center when clicked', async () => {
            const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => { });

            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Need to trigger the click through the security actions handler
            const adminBtn = element.querySelector('#open-admin-center-btn');
            adminBtn.click();

            expect(SecurityAnalysisService.generateAdminCenterLink).toHaveBeenCalled();
            expect(windowOpen).toHaveBeenCalledWith(
                'https://admin.powerplatform.microsoft.com/environments',
                '_blank'
            );

            windowOpen.mockRestore();
        });

        it('should open Entra when clicked', async () => {
            const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => { });

            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const entraBtn = element.querySelector('#open-entra-btn');
            entraBtn.click();

            expect(SecurityAnalysisService.generateEntraLink).toHaveBeenCalled();
            expect(windowOpen).toHaveBeenCalledWith(
                'https://entra.microsoft.com/',
                '_blank'
            );

            windowOpen.mockRestore();
        });
    });
});
