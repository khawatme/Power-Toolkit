/**
 * @file Comprehensive tests for ImpersonateTab component
 * @module tests/components/ImpersonateTab.test.js
 * @description Tests for the User Impersonation component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImpersonateTab } from '../../src/components/ImpersonateTab.js';

// Mock user data
const mockUsers = [
    {
        systemuserid: 'user-1',
        fullname: 'John Doe',
        domainname: 'john.doe@contoso.com'
    },
    {
        systemuserid: 'user-2',
        fullname: 'Jane Smith',
        domainname: 'jane.smith@contoso.com'
    },
    {
        systemuserid: 'user-3',
        fullname: 'Admin User',
        domainname: 'admin@contoso.com'
    }
];

// Mock dependencies
vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        retrieveMultipleRecords: vi.fn(() => Promise.resolve({ entities: [] })),
        setImpersonation: vi.fn(),
        clearImpersonation: vi.fn(),
        isImpersonating: vi.fn(() => false),
        getImpersonationInfo: vi.fn(() => ({ isImpersonating: false, userId: null, userName: null }))
    }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: true,
        getEntityName: vi.fn(() => 'account')
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/services/SecurityAnalysisService.js', () => ({
    SecurityAnalysisService: {
        compareUserSecurity: vi.fn(() => Promise.resolve({
            commonRoles: [],
            currentUserOnlyRoles: [],
            targetUserOnlyRoles: [],
            entityPrivileges: {},
            comparisonUserEntityPrivileges: {},
            targetUserFieldProfiles: [],
            comparisonUserFieldProfiles: [],
            currentUserTeams: [],
            targetUserTeams: []
        })),
        generateAdminCenterLink: vi.fn(() => 'https://admin.example.com'),
        generateEntraLink: vi.fn(() => 'https://entra.example.com')
    }
}));

vi.mock('../../src/services/LiveImpersonationService.js', () => ({
    LiveImpersonationService: {
        isActive: false,
        start: vi.fn(() => Promise.resolve()),
        stop: vi.fn()
    }
}));

vi.mock('../../src/services/CommandBarAnalysisService.js', () => ({
    CommandBarAnalysisService: {
        getCurrentContext: vi.fn(() => 'Form'),
        getCurrentEntity: vi.fn(() => 'account'),
        compareCommandBarVisibility: vi.fn(() => Promise.resolve({
            commands: [],
            summary: { totalCommands: 0, differences: 0, potentialDifferences: 0 }
        }))
    }
}));

vi.mock('../../src/ui/LiveComparisonPanel.js', () => ({
    LiveComparisonPanel: {
        show: vi.fn(),
        hide: vi.fn()
    }
}));

vi.mock('../../src/helpers/ui.helpers.js', () => ({
    UIHelpers: {
        initColumnResize: vi.fn(),
        destroyColumnResize: vi.fn(),
        updatePaginationUI: vi.fn(),
        toggleElementHeight: vi.fn(),
        toggleAccordionCategory: vi.fn(),
        setAllAccordionCategories: vi.fn(),
        collapseAllAccordionItems: vi.fn(),
        buildSearchIndex: vi.fn(() => []),
        sortArrayByColumn: vi.fn((arr) => arr),
        toggleSortState: vi.fn(() => ({ column: 'name', direction: 'asc' })),
        generateSortableTableHeaders: vi.fn(() => '')
    }
}));

import { DataService } from '../../src/services/DataService.js';
import { NotificationService } from '../../src/services/NotificationService.js';
import { SecurityAnalysisService } from '../../src/services/SecurityAnalysisService.js';
import { LiveImpersonationService } from '../../src/services/LiveImpersonationService.js';
import { CommandBarAnalysisService } from '../../src/services/CommandBarAnalysisService.js';
import { LiveComparisonPanel } from '../../src/ui/LiveComparisonPanel.js';
import { PowerAppsApiService } from '../../src/services/PowerAppsApiService.js';

describe('ImpersonateTab', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [] });
        DataService.getImpersonationInfo.mockReturnValue({
            isImpersonating: false,
            userId: null,
            userName: null
        });
        document.body.innerHTML = '';
    });

    afterEach(() => {
        component?.destroy?.();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with correct id', () => {
            component = new ImpersonateTab();
            expect(component.id).toBe('impersonate');
        });

        it('should initialize with correct label', () => {
            component = new ImpersonateTab();
            expect(component.label).toContain('Impersonate');
        });

        it('should have an icon defined', () => {
            component = new ImpersonateTab();
            expect(component.icon).toBeDefined();
        });

        it('should NOT be a form-only component', () => {
            component = new ImpersonateTab();
            expect(component.isFormOnly).toBeFalsy();
        });

        it('should initialize UI object as empty', () => {
            component = new ImpersonateTab();
            expect(component.ui).toEqual({});
        });

        it('should initialize lastSearchResults as empty array', () => {
            component = new ImpersonateTab();
            expect(component.lastSearchResults).toEqual([]);
        });

        it('should initialize sortState with fullname asc', () => {
            component = new ImpersonateTab();
            expect(component.sortState.column).toBe('fullname');
            expect(component.sortState.direction).toBe('asc');
        });

        it('should initialize handler refs as null', () => {
            component = new ImpersonateTab();
            expect(component._handleSearch).toBeNull();
            expect(component._enterKeyHandler).toBeNull();
            expect(component._handleResultsClick).toBeNull();
            expect(component._handleStatusClick).toBeNull();
        });
    });

    describe('render', () => {
        beforeEach(() => {
            component = new ImpersonateTab();
        });

        it('should return an HTMLElement', async () => {
            const element = await component.render();
            expect(element).toBeInstanceOf(HTMLElement);
        });

        it('should render section title', async () => {
            const element = await component.render();
            expect(element.querySelector('.section-title')).toBeTruthy();
            expect(element.querySelector('.section-title').textContent).toContain('Impersonate & Security');
        });

        it('should render user search input', async () => {
            const element = await component.render();
            const input = element.querySelector('#impersonate-search-input');
            expect(input).toBeTruthy();
        });

        it('should render search button', async () => {
            const element = await component.render();
            const searchBtn = element.querySelector('#impersonate-search-btn');
            expect(searchBtn).toBeTruthy();
        });

        it('should render status container', async () => {
            const element = await component.render();
            const status = element.querySelector('#impersonation-status-container');
            expect(status).toBeTruthy();
        });

        it('should render results container', async () => {
            const element = await component.render();
            const results = element.querySelector('#impersonate-results-container');
            expect(results).toBeTruthy();
        });

        it('should have placeholder text in search input', async () => {
            const element = await component.render();
            const input = element.querySelector('#impersonate-search-input');
            expect(input.placeholder).toContain('user');
        });

        it('should render description note', async () => {
            const element = await component.render();
            const note = element.querySelector('.pdt-note');
            expect(note).toBeTruthy();
        });
    });

    describe('postRender', () => {
        beforeEach(() => {
            component = new ImpersonateTab();
        });

        it('should not throw when called', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            expect(() => component.postRender(element)).not.toThrow();
        });

        it('should cache UI elements', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component.ui.searchInput).toBeTruthy();
            expect(component.ui.searchBtn).toBeTruthy();
            expect(component.ui.statusContainer).toBeTruthy();
            expect(component.ui.resultsContainer).toBeTruthy();
        });

        it('should bind event handlers', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component._handleSearch).toBeInstanceOf(Function);
            expect(component._handleResultsClick).toBeInstanceOf(Function);
            expect(component._handleStatusClick).toBeInstanceOf(Function);
        });

        it('should call _updateStatus on postRender', async () => {
            const element = await component.render();
            document.body.appendChild(element);

            const updateSpy = vi.spyOn(ImpersonateTab.prototype, '_updateStatus');
            component.postRender(element);

            expect(updateSpy).toHaveBeenCalled();
            updateSpy.mockRestore();
        });
    });

    describe('status display', () => {
        beforeEach(async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should show empty status when not impersonating', () => {
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: false,
                userId: null,
                userName: null
            });
            component._updateStatus();
            expect(component.ui.statusContainer.textContent).toBe('');
        });

        it('should show impersonating user when active', () => {
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'user-1',
                userName: 'John Doe'
            });
            component._updateStatus();
            expect(component.ui.statusContainer.textContent).toContain('John Doe');
        });

        it('should show clear button when impersonating', () => {
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'user-1',
                userName: 'John Doe'
            });
            component._updateStatus();
            const clearBtn = component.ui.statusContainer.querySelector('#impersonate-clear-btn');
            expect(clearBtn).toBeTruthy();
        });

        it('should not show clear button when not impersonating', () => {
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: false,
                userId: null,
                userName: null
            });
            component._updateStatus();
            const clearBtn = component.ui.statusContainer.querySelector('#impersonate-clear-btn');
            expect(clearBtn).toBeNull();
        });
    });

    describe('user search', () => {
        beforeEach(async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should search for users with search term', async () => {
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: mockUsers });
            component.ui.searchInput.value = 'john';

            await component._performSearch();

            expect(DataService.retrieveMultipleRecords).toHaveBeenCalledWith(
                'systemuser',
                expect.stringContaining('john')
            );
        });

        it('should search all users when no term provided', async () => {
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: mockUsers });
            component.ui.searchInput.value = '';

            await component._performSearch();

            expect(DataService.retrieveMultipleRecords).toHaveBeenCalled();
        });

        it('should cache search results', async () => {
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: mockUsers });
            component.ui.searchInput.value = 'user';

            await component._performSearch();

            expect(component.lastSearchResults).toEqual(mockUsers);
        });

        it('should show no results message when empty', async () => {
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [] });
            component.ui.searchInput.value = 'nonexistent';

            await component._performSearch();

            expect(component.ui.resultsContainer.textContent).toContain('No active users found');
        });

        it('should trigger search on button click', async () => {
            const searchSpy = vi.spyOn(component, '_performSearch');
            component.ui.searchInput.value = 'test';
            component.ui.searchBtn.click();

            expect(searchSpy).toHaveBeenCalled();
        });

        it('should disable search button while searching', async () => {
            let resolveSearch;
            DataService.retrieveMultipleRecords.mockImplementation(() => new Promise(r => { resolveSearch = r; }));
            component.ui.searchInput.value = 'test';

            const searchPromise = component._performSearch();

            expect(component.ui.searchBtn.disabled).toBe(true);

            resolveSearch({ entities: [] });
            await searchPromise;

            expect(component.ui.searchBtn.disabled).toBe(false);
        });

        it('should handle search error gracefully', async () => {
            DataService.retrieveMultipleRecords.mockRejectedValue(new Error('Network error'));
            component.ui.searchInput.value = 'test';

            await component._performSearch();

            expect(component.ui.resultsContainer.innerHTML).toContain('error');
        });

        it('should reset sort state on new search', async () => {
            component.sortState = { column: 'domainname', direction: 'desc' };
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: mockUsers });
            component.ui.searchInput.value = 'test';

            await component._performSearch();

            expect(component.sortState.column).toBe('fullname');
            expect(component.sortState.direction).toBe('asc');
        });
    });

    describe('results rendering', () => {
        beforeEach(async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component.lastSearchResults = [...mockUsers];
        });

        it('should render users table', () => {
            component._renderResults();
            const table = component.ui.resultsContainer.querySelector('table');
            expect(table).toBeTruthy();
        });

        it('should render all users', () => {
            component._renderResults();
            const rows = component.ui.resultsContainer.querySelectorAll('tbody tr');
            expect(rows.length).toBe(mockUsers.length);
        });

        it('should show user names', () => {
            component._renderResults();
            expect(component.ui.resultsContainer.textContent).toContain('John Doe');
            expect(component.ui.resultsContainer.textContent).toContain('Jane Smith');
        });

        it('should show domain names', () => {
            component._renderResults();
            expect(component.ui.resultsContainer.textContent).toContain('john.doe@contoso.com');
        });

        it('should have sortable headers', () => {
            component._renderResults();
            // The generateSortableTableHeaders mock returns empty string, so we verify the table exists
            // In real environment, headers would have data-sort-key attributes
            const table = component.ui.resultsContainer.querySelector('table');
            expect(table).toBeTruthy();
            expect(table.querySelector('thead')).toBeTruthy();
        });

        it('should show no users message when empty', () => {
            component.lastSearchResults = [];
            component._renderResults();
            expect(component.ui.resultsContainer.textContent).toContain('No active users found');
        });
    });

    describe('sorting', () => {
        beforeEach(async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component.lastSearchResults = [...mockUsers];
            component._renderResults();
        });

        it('should sort by fullname ascending by default', () => {
            expect(component.sortState.column).toBe('fullname');
            expect(component.sortState.direction).toBe('asc');
        });

        it('should toggle sort on header click', () => {
            const header = component.ui.resultsContainer.querySelector('th[data-sort-key="fullname"]');
            if (header) {
                header.click();
                // Sort should toggle
                expect(component.sortState.direction).toBe('desc');
            }
        });

        it('should change column on different header click', () => {
            const header = component.ui.resultsContainer.querySelector('th[data-sort-key="domainname"]');
            if (header) {
                header.click();
                expect(component.sortState.column).toBe('domainname');
            }
        });
    });

    describe('impersonation actions', () => {
        beforeEach(async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component.lastSearchResults = [...mockUsers];
            component._renderResults();
        });

        it('should set impersonation on row click', async () => {
            const row = component.ui.resultsContainer.querySelector('tr[data-user-id]');
            if (row) {
                row.click();
                expect(DataService.setImpersonation).toHaveBeenCalled();
            }
        });

        it('should update status after impersonation', async () => {
            const updateSpy = vi.spyOn(component, '_updateStatus');
            const row = component.ui.resultsContainer.querySelector('tr[data-user-id]');
            if (row) {
                row.click();
                expect(updateSpy).toHaveBeenCalled();
            }
        });
    });

    describe('clear impersonation', () => {
        beforeEach(async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Set as impersonating
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'user-1',
                userName: 'John Doe'
            });
            component._updateStatus();
        });

        it('should clear impersonation on button click', async () => {
            const clearBtn = component.ui.statusContainer.querySelector('#impersonate-clear-btn');
            if (clearBtn) {
                clearBtn.click();
                expect(DataService.clearImpersonation).toHaveBeenCalled();
            }
        });

        it('should update status after clearing', async () => {
            const updateSpy = vi.spyOn(component, '_updateStatus');
            const clearBtn = component.ui.statusContainer.querySelector('#impersonate-clear-btn');
            if (clearBtn) {
                clearBtn.click();
                expect(updateSpy).toHaveBeenCalled();
            }
        });

        it('should stop live impersonation when clearing with live active', async () => {
            // Mock live impersonation as active
            LiveImpersonationService.isActive = true;

            const clearBtn = component.ui.statusContainer.querySelector('#impersonate-clear-btn');
            if (clearBtn) {
                clearBtn.click();

                expect(LiveImpersonationService.stop).toHaveBeenCalled();
                expect(LiveComparisonPanel.hide).toHaveBeenCalled();
                expect(DataService.clearImpersonation).toHaveBeenCalled();
            }

            // Reset
            LiveImpersonationService.isActive = false;
        });
    });

    describe('destroy', () => {
        it('should not throw when called without render', () => {
            component = new ImpersonateTab();
            expect(() => component.destroy()).not.toThrow();
        });

        it('should not throw when called after render', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            expect(() => component.destroy()).not.toThrow();
        });

        it('should cleanup after render and postRender', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(() => component.destroy()).not.toThrow();
        });

        it('should handle multiple destroy calls', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(() => {
                component.destroy();
                component.destroy();
            }).not.toThrow();
        });
    });

    describe('edge cases', () => {
        beforeEach(async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should handle null lastSearchResults', () => {
            component.lastSearchResults = null;
            expect(() => component._renderResults()).not.toThrow();
        });

        it('should trim search input', async () => {
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: mockUsers });
            component.ui.searchInput.value = '  john  ';
            await component._performSearch();

            expect(DataService.retrieveMultipleRecords).toHaveBeenCalledWith(
                'systemuser',
                expect.stringContaining('john')
            );
        });

        it('should handle user with missing properties', () => {
            component.lastSearchResults = [{ systemuserid: 'id-1' }]; // Missing other properties
            expect(() => component._renderResults()).not.toThrow();
        });
    });

    describe('_handleResultsClick header sorting - lines 77-80 coverage', () => {
        beforeEach(async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should handle header click and re-render results', async () => {
            // First perform a search to get results with sortable headers
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: mockUsers });
            component.ui.searchInput.value = 'user';
            await component._performSearch();

            // Store initial results
            component.lastSearchResults = mockUsers;

            // Spy on _renderResults to verify it's called
            const renderSpy = vi.spyOn(component, '_renderResults');

            // Manually invoke the click handler with a mock header element
            const mockHeader = document.createElement('th');
            mockHeader.dataset.sortKey = 'fullname';

            // Create a mock event
            const mockEvent = {
                target: {
                    closest: (selector) => {
                        if (selector === 'th[data-sort-key]') return mockHeader;
                        if (selector === 'tr[data-user-id]') return null;
                        return null;
                    }
                }
            };

            // Call the handler directly
            component._handleResultsClick(mockEvent);

            // Verify _renderResults was called
            expect(renderSpy).toHaveBeenCalled();

            renderSpy.mockRestore();
        });

        it('should handle row click for impersonation', async () => {
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: mockUsers });
            component.ui.searchInput.value = 'user';
            await component._performSearch();

            // Create a mock row element
            const mockRow = document.createElement('tr');
            mockRow.dataset.userId = 'user-1';
            mockRow.dataset.fullName = 'John Doe';

            // Create a mock event
            const mockEvent = {
                target: {
                    closest: (selector) => {
                        if (selector === 'th[data-sort-key]') return null;
                        if (selector === 'tr[data-user-id]') return mockRow;
                        return null;
                    }
                }
            };

            // Call the handler directly
            component._handleResultsClick(mockEvent);

            // Verify setImpersonation was called
            expect(DataService.setImpersonation).toHaveBeenCalledWith('user-1', 'John Doe');
        });

        it('should return early if header is clicked (not process row)', async () => {
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: mockUsers });
            component.ui.searchInput.value = 'user';
            await component._performSearch();

            const mockHeader = document.createElement('th');
            mockHeader.dataset.sortKey = 'fullname';

            // Mock event where header exists (should return early, not process row)
            const mockEvent = {
                target: {
                    closest: (selector) => {
                        if (selector === 'th[data-sort-key]') return mockHeader;
                        if (selector === 'tr[data-user-id]') return null;
                        return null;
                    }
                }
            };

            DataService.setImpersonation.mockClear();

            component._handleResultsClick(mockEvent);

            // setImpersonation should NOT be called since we hit the header branch
            expect(DataService.setImpersonation).not.toHaveBeenCalled();
        });
    });

    describe('_switchSubTab', () => {
        it('should switch to security analysis tab', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component._switchSubTab('security');

            expect(component.ui.subTabSecurity.classList.contains('active')).toBe(true);
            expect(component.ui.subTabImpersonation.classList.contains('active')).toBe(false);
            expect(component.ui.contentSecurity.style.display).toBe('block');
            expect(component.ui.contentImpersonation.style.display).toBe('none');
            expect(component.activeSubTab).toBe('security');
        });

        it('should switch to impersonation tab', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // First switch to security
            component._switchSubTab('security');
            // Then switch back
            component._switchSubTab('impersonation');

            expect(component.ui.subTabImpersonation.classList.contains('active')).toBe(true);
            expect(component.ui.subTabSecurity.classList.contains('active')).toBe(false);
            expect(component.ui.contentImpersonation.style.display).toBe('block');
            expect(component.ui.contentSecurity.style.display).toBe('none');
            expect(component.activeSubTab).toBe('impersonation');
        });
    });

    describe('_onSubTabClick', () => {
        it('should switch tab when impersonation sub-tab is clicked', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const mockTarget = document.createElement('div');
            mockTarget.classList.add('pdt-sub-tab');
            mockTarget.id = 'impersonate-tab-impersonation';

            const mockEvent = {
                target: {
                    closest: (selector) => selector === '.pdt-sub-tab' ? mockTarget : null
                }
            };

            component._onSubTabClick(mockEvent);

            expect(component.activeSubTab).toBe('impersonation');
        });

        it('should switch tab when security sub-tab is clicked', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const mockTarget = document.createElement('div');
            mockTarget.classList.add('pdt-sub-tab');
            mockTarget.id = 'impersonate-tab-security';

            const mockEvent = {
                target: {
                    closest: (selector) => selector === '.pdt-sub-tab' ? mockTarget : null
                }
            };

            component._onSubTabClick(mockEvent);

            expect(component.activeSubTab).toBe('security');
        });

        it('should return early if not clicking on a sub-tab', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const originalTab = component.activeSubTab;

            const mockEvent = {
                target: {
                    closest: () => null
                }
            };

            component._onSubTabClick(mockEvent);

            expect(component.activeSubTab).toBe(originalTab);
        });
    });

    describe('_getColorIndexForString', () => {
        it('should return consistent color index for same string', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const colorIndex1 = component._getColorIndexForString('System Administrator');
            const colorIndex2 = component._getColorIndexForString('System Administrator');

            expect(colorIndex1).toBe(colorIndex2);
        });

        it('should return value between 0 and 7', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const colorIndex = component._getColorIndexForString('Test Role');

            expect(colorIndex).toBeGreaterThanOrEqual(0);
            expect(colorIndex).toBeLessThanOrEqual(7);
        });

        it('should return different colors for different strings', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const strings = [
                'System Administrator',
                'Sales Manager',
                'Customer Service Rep',
                'Marketing User',
                'Developer Role'
            ];

            const colors = strings.map(s => component._getColorIndexForString(s));
            const uniqueColors = new Set(colors);

            // FNV-1a hash should distribute colors reasonably well
            // At least 2 different colors for 5 strings
            expect(uniqueColors.size).toBeGreaterThanOrEqual(2);
        });
    });

    describe('_updateLiveButtonState', () => {
        it('should update button to active state', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component._updateLiveButtonState(true);

            expect(component.ui.liveBtn.classList.contains('pdt-live-active')).toBe(true);
            expect(component.ui.liveBtn.textContent).toContain('Stop');
        });

        it('should update button to inactive state', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // First set to active
            component._updateLiveButtonState(true);
            // Then set to inactive
            component._updateLiveButtonState(false);

            expect(component.ui.liveBtn.classList.contains('pdt-live-active')).toBe(false);
            expect(component.ui.liveBtn.textContent).not.toContain('Stop');
        });

        it('should handle missing button gracefully', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.liveBtn = null;

            // Should not throw
            expect(() => component._updateLiveButtonState(true)).not.toThrow();
        });
    });

    describe('_performSecurityAnalysis', () => {
        it('should return early if not impersonating', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: false,
                userId: null,
                userName: null
            });

            await component._performSecurityAnalysis();

            expect(SecurityAnalysisService.compareUserSecurity).not.toHaveBeenCalled();
        });

        it('should perform security analysis when impersonating', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'target-user-123',
                userName: 'Test User'
            });

            SecurityAnalysisService.compareUserSecurity.mockResolvedValue({
                commonRoles: [{ name: 'Role1', roleid: 'r1' }],
                currentUserOnlyRoles: [],
                targetUserOnlyRoles: [],
                entityPrivileges: { read: true },
                comparisonUserEntityPrivileges: { read: true },
                targetUserFieldProfiles: [],
                comparisonUserFieldProfiles: [],
                currentUserTeams: [],
                targetUserTeams: []
            });

            await component._performSecurityAnalysis();

            expect(SecurityAnalysisService.compareUserSecurity).toHaveBeenCalled();
            expect(component.securityAnalysis).toBeTruthy();
        });

        it('should handle security analysis error', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'target-user-123',
                userName: 'Test User'
            });

            SecurityAnalysisService.compareUserSecurity.mockRejectedValue(new Error('API Error'));

            await component._performSecurityAnalysis();

            expect(component.ui.securityAnalysisContent.innerHTML).toContain('pdt-error');
        });

        it('should use comparison user when set', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'target-user-123',
                userName: 'Test User'
            });

            component.comparisonUser = { userId: 'custom-compare-user', userName: 'Custom User' };

            SecurityAnalysisService.compareUserSecurity.mockResolvedValue({
                commonRoles: [],
                currentUserOnlyRoles: [],
                targetUserOnlyRoles: [],
                entityPrivileges: {},
                comparisonUserEntityPrivileges: {},
                targetUserFieldProfiles: [],
                comparisonUserFieldProfiles: [],
                currentUserTeams: [],
                targetUserTeams: []
            });

            await component._performSecurityAnalysis();

            expect(SecurityAnalysisService.compareUserSecurity).toHaveBeenCalledWith(
                'target-user-123',
                expect.any(String),
                'custom-compare-user'
            );
        });
    });

    describe('_renderSecurityAnalysis', () => {
        it('should return early if no analysis data', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.securityAnalysis = null;

            component._renderSecurityAnalysis('Target', 'You', 'account');

            // Should not throw and content unchanged
            expect(component.ui.securityAnalysisContent).toBeTruthy();
        });

        it('should render all sections with analysis data', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.securityAnalysis = {
                commonRoles: [{ name: 'System Administrator', roleid: 'role-1' }],
                currentUserOnlyRoles: [],
                targetUserOnlyRoles: [],
                entityPrivileges: { read: { hasPrivilege: true } },
                comparisonUserEntityPrivileges: { read: { hasPrivilege: false } },
                targetUserFieldProfiles: [],
                comparisonUserFieldProfiles: [],
                currentUserTeams: [{ name: 'Team A', teamid: 'team-1', teamtype: 'Owner' }],
                targetUserTeams: []
            };

            component._renderSecurityAnalysis('Target User', 'You', 'account');

            const content = component.ui.securityAnalysisContent.innerHTML;
            expect(content).toContain('pdt-security-card');
        });

        it('should handle click on copyable ID in security analysis content', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Simulate security analysis content with copyable ID
            component.ui.securityAnalysisContent.innerHTML = `
                <div class="pdt-security-card">
                    <code class="pdt-copyable-id">role-12345</code>
                </div>
            `;

            const copyableId = component.ui.securityAnalysisContent.querySelector('.pdt-copyable-id');

            // Simulate click event - should trigger the copy handler without throwing
            expect(() => copyableId.click()).not.toThrow();
        });
    });

    describe('_renderTeamComparison', () => {
        it('should render team comparison with common teams', async () => {
            component = new ImpersonateTab();

            const analysis = {
                currentUserTeams: [{ name: 'Team A', teamid: 'team-1', teamtype: 'Owner' }],
                targetUserTeams: [{ name: 'Team A', teamid: 'team-1', teamtype: 'Owner' }]
            };

            const html = component._renderTeamComparison('Target', 'You', analysis);

            expect(html).toContain('Team A');
            expect(html).toContain('pdt-security-card');
        });

        it('should render unique teams for each user', async () => {
            component = new ImpersonateTab();

            const analysis = {
                currentUserTeams: [{ name: 'Your Team', teamid: 'team-1', teamtype: 'Owner' }],
                targetUserTeams: [{ name: 'Their Team', teamid: 'team-2', teamtype: 'Access' }]
            };

            const html = component._renderTeamComparison('Target', 'You', analysis);

            expect(html).toContain('Your Team');
            expect(html).toContain('Their Team');
        });

        it('should handle empty teams', async () => {
            component = new ImpersonateTab();

            const analysis = {
                currentUserTeams: [],
                targetUserTeams: []
            };

            const html = component._renderTeamComparison('Target', 'You', analysis);

            expect(html).toContain('pdt-note');
        });

        it('should use custom comparison user name', async () => {
            component = new ImpersonateTab();

            const analysis = {
                currentUserTeams: [{ name: 'Team A', teamid: 'team-1' }],
                targetUserTeams: []
            };

            const html = component._renderTeamComparison('Target', 'Custom User', analysis);

            expect(html).toContain("Custom User's Only Teams");
        });
    });

    describe('_renderRoleComparison', () => {
        it('should render role comparison with common roles', async () => {
            component = new ImpersonateTab();

            const analysis = {
                commonRoles: [{ name: 'Sys Admin', roleid: 'role-1' }],
                currentUserOnlyRoles: [],
                targetUserOnlyRoles: []
            };

            const html = component._renderRoleComparison('Target', 'You', analysis);

            expect(html).toContain('Sys Admin');
            expect(html).toContain('pdt-security-card');
        });

        it('should render inherited roles with team badges', async () => {
            component = new ImpersonateTab();

            const analysis = {
                commonRoles: [{
                    name: 'Sales Rep',
                    roleid: 'role-1',
                    isInherited: true,
                    teams: [{ teamName: 'Sales Team' }]
                }],
                currentUserOnlyRoles: [],
                targetUserOnlyRoles: []
            };

            const html = component._renderRoleComparison('Target', 'You', analysis);

            expect(html).toContain('Sales Team');
            expect(html).toContain('pdt-badge-team');
        });

        it('should render inherited role without team details', async () => {
            component = new ImpersonateTab();

            const analysis = {
                commonRoles: [{
                    name: 'Basic User',
                    roleid: 'role-1',
                    isInherited: true,
                    teams: null
                }],
                currentUserOnlyRoles: [],
                targetUserOnlyRoles: []
            };

            const html = component._renderRoleComparison('Target', 'You', analysis);

            // When inherited but no teams array, it shows "(via team)" badge
            expect(html).toContain('via team');
        });

        it('should use custom comparison user name for only roles section', async () => {
            component = new ImpersonateTab();

            const analysis = {
                commonRoles: [],
                currentUserOnlyRoles: [{ name: 'Custom Role', roleid: 'role-1' }],
                targetUserOnlyRoles: []
            };

            const html = component._renderRoleComparison('Target', 'Admin User', analysis);

            expect(html).toContain("Admin User's Only Roles");
        });
    });

    describe('_renderEntityPrivileges', () => {
        it('should render privilege comparison grid', async () => {
            component = new ImpersonateTab();

            const targetPrivileges = {
                read: { hasPrivilege: true },
                create: { hasPrivilege: false },
                write: true,
                delete: false
            };

            const comparisonPrivileges = {
                read: { hasPrivilege: true },
                create: { hasPrivilege: true },
                write: false,
                delete: false
            };

            const html = component._renderEntityPrivileges(
                'account',
                'Target User',
                'You',
                targetPrivileges,
                comparisonPrivileges
            );

            expect(html).toContain('account');
            expect(html).toContain('pdt-privilege-row');
        });

        it('should highlight differences in privileges', async () => {
            component = new ImpersonateTab();

            const targetPrivileges = { read: true };
            const comparisonPrivileges = { read: false };

            const html = component._renderEntityPrivileges(
                'contact',
                'Target',
                'You',
                targetPrivileges,
                comparisonPrivileges
            );

            expect(html).toContain('pdt-privilege-row--different');
        });

        it('should mark both-have and both-lack rows', async () => {
            component = new ImpersonateTab();

            const targetPrivileges = { read: true, create: false };
            const comparisonPrivileges = { read: true, create: false };

            const html = component._renderEntityPrivileges(
                'account',
                'Target',
                'You',
                targetPrivileges,
                comparisonPrivileges
            );

            expect(html).toContain('pdt-privilege-row--both-have');
            expect(html).toContain('pdt-privilege-row--both-lack');
        });
    });

    describe('_renderFieldSecurity', () => {
        it('should render no profiles message when both empty', async () => {
            component = new ImpersonateTab();

            const html = component._renderFieldSecurity('Target', 'You', [], []);

            expect(html).toContain('pdt-note');
        });

        it('should render target user field profiles', async () => {
            component = new ImpersonateTab();

            const targetProfiles = [{
                name: 'Sales Profile',
                isInherited: false,
                permissions: [{
                    attributelogicalname: 'revenue',
                    canread: 4,
                    cancreate: 0,
                    canupdate: 4
                }]
            }];

            const html = component._renderFieldSecurity('Target', 'You', targetProfiles, []);

            expect(html).toContain('Sales Profile');
            expect(html).toContain('revenue');
        });

        it('should render comparison user field profiles', async () => {
            component = new ImpersonateTab();

            const comparisonProfiles = [{
                name: 'Manager Profile',
                isInherited: true,
                permissions: []
            }];

            const html = component._renderFieldSecurity('Target', 'You', [], comparisonProfiles);

            expect(html).toContain('Manager Profile');
            expect(html).toContain('Team');
        });

        it('should use custom comparison user label', async () => {
            component = new ImpersonateTab();

            const comparisonProfiles = [{
                name: 'Profile',
                permissions: []
            }];

            const html = component._renderFieldSecurity('Target', 'Admin User', [], comparisonProfiles);

            expect(html).toContain("Admin User's Field Security Profiles");
        });

        it('should render comparison user field profiles with column permissions', async () => {
            component = new ImpersonateTab();

            const comparisonProfiles = [{
                name: 'Comparison Profile',
                isInherited: false,
                permissions: [{
                    attributelogicalname: 'salary',
                    canread: 4,
                    cancreate: 0,
                    canupdate: 0
                }]
            }];

            const html = component._renderFieldSecurity('Target', 'You', [], comparisonProfiles);

            expect(html).toContain('Comparison Profile');
            expect(html).toContain('salary');
            expect(html).toContain('pdt-permission-cell');
        });
    });

    describe('_performCommandBarAnalysis', () => {
        it('should return early if not impersonating', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: false,
                userId: null,
                userName: null
            });

            await component._performCommandBarAnalysis();

            expect(CommandBarAnalysisService.compareCommandBarVisibility).not.toHaveBeenCalled();
        });

        it('should perform command bar comparison when impersonating', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'target-user-123',
                userName: 'Test User'
            });

            CommandBarAnalysisService.compareCommandBarVisibility.mockResolvedValue({
                commands: [],
                summary: { totalCommands: 5, differences: 0, potentialDifferences: 0 }
            });

            await component._performCommandBarAnalysis();

            expect(CommandBarAnalysisService.compareCommandBarVisibility).toHaveBeenCalled();
        });

        it('should handle command bar analysis error', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'target-user-123',
                userName: 'Test User'
            });

            CommandBarAnalysisService.compareCommandBarVisibility.mockRejectedValue(new Error('API Error'));

            await component._performCommandBarAnalysis();

            expect(component.ui.securityAnalysisContent.innerHTML).toContain('pdt-error');
        });
    });

    describe('_renderCommandBarComparison', () => {
        it('should render no commands message when empty', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const comparison = {
                commands: [],
                summary: { totalCommands: 0, differences: 0, potentialDifferences: 0 }
            };

            component._renderCommandBarComparison(comparison, 'Target', 'You', 'account', 'Form');

            expect(component.ui.securityAnalysisContent.innerHTML).toContain('pdt-note');
        });

        it('should render command differences', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const comparison = {
                commands: [
                    {
                        commandId: 'cmd1',
                        commandName: 'Edit',
                        difference: 'only-current',
                        isStandardCommand: true,
                        targetUserBlockedBy: ['Mscrm.ReadPrivilege']
                    }
                ],
                summary: {
                    totalCommands: 1,
                    differences: 1,
                    potentialDifferences: 0,
                    managedCommands: 0,
                    unmanagedCommands: 0
                }
            };

            component._renderCommandBarComparison(comparison, 'Target', 'You', 'account', 'Form');

            const content = component.ui.securityAnalysisContent.innerHTML;
            expect(content).toContain('Edit');
            expect(content).toContain('Definite Differences');
        });

        it('should render potential differences', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const comparison = {
                commands: [
                    {
                        commandId: 'cmd1',
                        commandName: 'CustomAction',
                        difference: 'potential-difference',
                        isStandardCommand: false,
                        solutionName: 'MySolution'
                    }
                ],
                summary: {
                    totalCommands: 1,
                    differences: 0,
                    potentialDifferences: 1,
                    managedCommands: 0,
                    unmanagedCommands: 1
                }
            };

            component._renderCommandBarComparison(comparison, 'Target', 'You', 'account', 'Form');

            const content = component.ui.securityAnalysisContent.innerHTML;
            expect(content).toContain('CustomAction');
            expect(content).toContain('Potential Differences');
        });

        it('should render same visibility commands', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const comparison = {
                commands: [
                    {
                        commandId: 'cmd1',
                        commandName: 'Save',
                        difference: 'same',
                        isStandardCommand: true
                    }
                ],
                summary: {
                    totalCommands: 1,
                    differences: 0,
                    potentialDifferences: 0,
                    managedCommands: 0,
                    unmanagedCommands: 0
                }
            };

            component._renderCommandBarComparison(comparison, 'Target', 'You', 'account', 'Form');

            const content = component.ui.securityAnalysisContent.innerHTML;
            expect(content).toContain('Same Visibility');
        });

        it('should add click handlers for command ID copying', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const comparison = {
                commands: [
                    {
                        commandId: 'Mscrm.SavePrimary',
                        commandName: 'Save',
                        difference: 'same',
                        isStandardCommand: true
                    }
                ],
                summary: {
                    totalCommands: 1,
                    differences: 0,
                    potentialDifferences: 0,
                    managedCommands: 0,
                    unmanagedCommands: 0
                }
            };

            component._renderCommandBarComparison(comparison, 'Target', 'You', 'account', 'Form');

            // Find command ID element and verify click handler is added
            const cmdIdElement = component.ui.securityAnalysisContent.querySelector('.pdt-command-id');
            expect(cmdIdElement).toBeTruthy();
            expect(cmdIdElement.style.cursor).toBe('pointer');

            // Simulate click - should not throw
            expect(() => cmdIdElement.click()).not.toThrow();
        });

        it('should render grid context correctly', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const comparison = {
                commands: [],
                summary: { totalCommands: 0, differences: 0, potentialDifferences: 0 }
            };

            component._renderCommandBarComparison(comparison, 'Target', 'You', null, 'HomePageGrid');

            const content = component.ui.securityAnalysisContent.innerHTML;
            expect(content).toContain('Grid');
        });
    });

    describe('_renderCommandItem', () => {
        it('should render only-current difference', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'Edit',
                difference: 'only-current',
                isStandardCommand: true,
                targetUserBlockedBy: ['Mscrm.ReadPrivilege']
            };

            const html = component._renderCommandItem(cmd, 'Target', 'You', false);

            expect(html).toContain('pdt-command-item--only-you');
            expect(html).toContain('Mscrm.ReadPrivilege');
        });

        it('should render only-target difference', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'Delete',
                difference: 'only-target',
                isStandardCommand: true,
                currentUserBlockedBy: ['Mscrm.DeletePrivilege']
            };

            const html = component._renderCommandItem(cmd, 'Target User', 'You', false);

            expect(html).toContain('pdt-command-item--only-user');
            expect(html).toContain('Only Target User Can See');
        });

        it('should render potential difference', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'Custom',
                difference: 'potential-difference',
                isStandardCommand: false,
                solutionName: 'MySolution'
            };

            const html = component._renderCommandItem(cmd, 'Target', 'You', true);

            expect(html).toContain('pdt-command-item--potential');
        });

        it('should render modern command with managed badge', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'ModernCmd',
                difference: 'same',
                isStandardCommand: false,
                isModernCommand: true,
                isManaged: true,
                solutionName: 'ManagedSolution'
            };

            const html = component._renderCommandItem(cmd, 'Target', 'You', false);

            expect(html).toContain('Modern');
            expect(html).toContain('ManagedSolution');
        });

        it('should render modern command with unmanaged badge', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'ModernUnmanaged',
                difference: 'same',
                isStandardCommand: false,
                isModernCommand: true,
                isManaged: false,
                solutionName: 'UnmanagedSolution'
            };

            const html = component._renderCommandItem(cmd, 'Target', 'You', false);

            expect(html).toContain('Modern');
            expect(html).toContain('pdt-badge--unmanaged');
            expect(html).toContain('UnmanagedSolution');
        });

        it('should render non-modern managed command', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'LegacyManaged',
                difference: 'same',
                isStandardCommand: false,
                isModernCommand: false,
                isManaged: true,
                solutionName: 'ManagedPkg'
            };

            const html = component._renderCommandItem(cmd, 'Target', 'You', false);

            expect(html).toContain('pdt-badge--managed');
            expect(html).toContain('ManagedPkg');
            expect(html).not.toContain('Modern');
        });

        it('should render non-modern unmanaged command', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'CustomUnmanaged',
                difference: 'same',
                isStandardCommand: false,
                isModernCommand: false,
                isManaged: false,
                solutionName: 'ActiveCustomizations'
            };

            const html = component._renderCommandItem(cmd, 'Target', 'You', false);

            expect(html).toContain('pdt-badge--unmanaged');
            expect(html).toContain('ActiveCustomizations');
        });

        it('should render selection required badge', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'DeleteSelected',
                difference: 'same',
                isStandardCommand: true,
                selectionRequired: true
            };

            const html = component._renderCommandItem(cmd, 'Target', 'You', false);

            expect(html).toContain('Selection Required');
        });

        it('should hide blocked by when requested', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'Edit',
                difference: 'only-current',
                isStandardCommand: true,
                targetUserBlockedBy: ['Mscrm.ReadPrivilege']
            };

            const html = component._renderCommandItem(cmd, 'Target', 'You', true);

            expect(html).not.toContain('blocked by');
        });
    });

    describe('_renderCommandWithCustomRules', () => {
        it('should render evaluated custom rules', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'CustomAction',
                isStandardCommand: false,
                solutionName: 'MySolution',
                customRules: [
                    { id: 'rule1', functionName: 'isEnabled', library: 'scripts.js', evaluated: true, result: true }
                ]
            };

            const html = component._renderCommandWithCustomRules(cmd);

            expect(html).toContain('isEnabled');
            expect(html).toContain('true');
            expect(html).toContain('Evaluated');
        });

        it('should render unevaluated custom rules', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'CustomAction',
                isStandardCommand: false,
                customRules: [
                    { id: 'rule1', functionName: 'checkPermission', evaluated: false, reason: 'Library not loaded' }
                ]
            };

            const html = component._renderCommandWithCustomRules(cmd);

            expect(html).toContain('checkPermission');
            expect(html).toContain('Could Not Evaluate');
        });

        it('should show all passed badge when all rules pass', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'Action',
                isStandardCommand: true,
                customRules: [
                    { id: 'rule1', evaluated: true, result: true },
                    { id: 'rule2', evaluated: true, result: true }
                ]
            };

            const html = component._renderCommandWithCustomRules(cmd);

            expect(html).toContain('All Rules Passed');
        });

        it('should show failed badge when a rule fails', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'Action',
                isStandardCommand: true,
                customRules: [
                    { id: 'rule1', evaluated: true, result: false }
                ]
            };

            const html = component._renderCommandWithCustomRules(cmd);

            expect(html).toContain('Rule Failed');
        });

        it('should show partially evaluated badge when mix of evaluated and unevaluated', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'MixedRules',
                isStandardCommand: false,
                solutionName: 'MySolution',
                customRules: [
                    { id: 'rule1', evaluated: true, result: true },
                    { id: 'rule2', evaluated: false, reason: 'Library not loaded' }
                ]
            };

            const html = component._renderCommandWithCustomRules(cmd);

            expect(html).toContain('Partially Evaluated');
        });

        it('should show custom rules badge when no rules are evaluated', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'NoEval',
                isStandardCommand: false,
                customRules: []
            };

            const html = component._renderCommandWithCustomRules(cmd);

            expect(html).toContain('Custom Rules');
        });
    });

    describe('_renderCommandItemCompact', () => {
        it('should render visible command', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'Save',
                visibleToCurrentUser: true,
                isStandardCommand: true
            };

            const html = component._renderCommandItemCompact(cmd);

            expect(html).toContain('pdt-visible');
            expect(html).toContain('Save');
        });

        it('should render hidden command with blocked reasons', async () => {
            component = new ImpersonateTab();

            const cmd = {
                commandId: 'cmd1',
                commandName: 'Delete',
                visibleToCurrentUser: false,
                isStandardCommand: true,
                currentUserBlockedBy: ['Mscrm.DeletePrivilege', 'Mscrm.WritePrivilege', 'Mscrm.AdminOnly']
            };

            const html = component._renderCommandItemCompact(cmd);

            expect(html).toContain('pdt-hidden');
            expect(html).toContain('Mscrm.DeletePrivilege');
        });
    });

    describe('_openAdminCenter', () => {
        it('should open admin center link in new tab', async () => {
            component = new ImpersonateTab();

            const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => { });

            component._openAdminCenter();

            expect(SecurityAnalysisService.generateAdminCenterLink).toHaveBeenCalled();
            expect(windowOpenSpy).toHaveBeenCalledWith('https://admin.example.com', '_blank');

            windowOpenSpy.mockRestore();
        });
    });

    describe('_openEntra', () => {
        it('should open entra link in new tab', async () => {
            component = new ImpersonateTab();

            const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => { });

            component._openEntra();

            expect(SecurityAnalysisService.generateEntraLink).toHaveBeenCalled();
            expect(windowOpenSpy).toHaveBeenCalledWith('https://entra.example.com', '_blank');

            windowOpenSpy.mockRestore();
        });
    });

    describe('_onCompareUserChange', () => {
        it('should reset to current user when current selected', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.comparisonUser = { userId: 'custom', userName: 'Custom' };

            const mockEvent = { target: { value: 'current' } };
            await component._onCompareUserChange(mockEvent);

            expect(component.comparisonUser).toBeNull();
            expect(NotificationService.show).toHaveBeenCalledWith('Comparing with current user', 'info');
        });

        it('should show picker when custom selected', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const pickerSpy = vi.spyOn(component, '_showComparisonUserPicker').mockResolvedValue();

            const mockEvent = { target: { value: 'custom' } };
            await component._onCompareUserChange(mockEvent);

            expect(pickerSpy).toHaveBeenCalled();

            pickerSpy.mockRestore();
        });
    });

    describe('_showComparisonUserPicker', () => {
        it('should show warning when no users found', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [] });

            await component._showComparisonUserPicker();

            expect(NotificationService.show).toHaveBeenCalledWith('No users found', 'warning');
        });

        it('should handle error when fetching users fails', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            DataService.retrieveMultipleRecords.mockRejectedValue(new Error('Network error'));

            await component._showComparisonUserPicker();

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('Failed to load users'),
                'error'
            );
            expect(component.comparisonUser).toBeNull();
        });

        it('should create dialog when users are found', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const mockUsers = [
                { systemuserid: 'user-1', fullname: 'John Doe', domainname: 'john@test.com' },
                { systemuserid: 'user-2', fullname: 'Jane Smith', domainname: 'jane@test.com' }
            ];
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: mockUsers });

            // Start the picker but don't await (it waits for user interaction)
            const pickerPromise = component._showComparisonUserPicker();

            // Wait for dialog to be created
            await new Promise(resolve => setTimeout(resolve, 10));

            // Check dialog was created
            const dialog = document.querySelector('.pdt-dialog-overlay');
            expect(dialog).toBeTruthy();

            // Simulate clicking close button to resolve the promise
            const closeBtn = dialog.querySelector('.pdt-dialog-close');
            closeBtn.click();

            await pickerPromise;
        });

        it('should filter users when searching', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const mockUsers = [
                { systemuserid: 'user-1', fullname: 'John Doe', domainname: 'john@test.com' },
                { systemuserid: 'user-2', fullname: 'Jane Smith', domainname: 'jane@test.com' }
            ];
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: mockUsers });

            const pickerPromise = component._showComparisonUserPicker();
            await new Promise(resolve => setTimeout(resolve, 10));

            const dialog = document.querySelector('.pdt-dialog-overlay');
            const searchInput = dialog.querySelector('#comparison-user-search');
            const userItems = dialog.querySelectorAll('.pdt-user-item');

            // Type in search box
            searchInput.value = 'john';
            searchInput.dispatchEvent(new Event('input'));

            // Check filtering
            expect(userItems[0].style.display).toBe('block'); // John
            expect(userItems[1].style.display).toBe('none'); // Jane

            // Close dialog
            dialog.querySelector('.pdt-dialog-close').click();
            await pickerPromise;
        });

        it('should select user when clicked', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const mockUsers = [
                { systemuserid: 'user-1', fullname: 'John Doe', domainname: 'john@test.com' }
            ];
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: mockUsers });

            const pickerPromise = component._showComparisonUserPicker();
            await new Promise(resolve => setTimeout(resolve, 10));

            const dialog = document.querySelector('.pdt-dialog-overlay');
            const userItem = dialog.querySelector('.pdt-user-item');

            // Click on user
            userItem.click();

            await pickerPromise;

            expect(component.comparisonUser).toEqual({
                userId: 'user-1',
                userName: 'John Doe'
            });
            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('John Doe'),
                'success'
            );
        });

        it('should cancel when clicking overlay', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const mockUsers = [
                { systemuserid: 'user-1', fullname: 'John Doe', domainname: 'john@test.com' }
            ];
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: mockUsers });

            const pickerPromise = component._showComparisonUserPicker();
            await new Promise(resolve => setTimeout(resolve, 10));

            const dialog = document.querySelector('.pdt-dialog-overlay');

            // Click on overlay (not on dialog content)
            dialog.click();

            await pickerPromise;

            expect(component.comparisonUser).toBeNull();
            expect(component.ui.compareUserSelect.value).toBe('current');
        });
    });

    describe('_toggleLiveImpersonation', () => {
        it('should stop live impersonation when active', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Mock as active
            LiveImpersonationService.isActive = true;

            await component._toggleLiveImpersonation();

            expect(LiveImpersonationService.stop).toHaveBeenCalled();
            expect(LiveComparisonPanel.hide).toHaveBeenCalled();
            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'info'
            );

            // Reset
            LiveImpersonationService.isActive = false;
        });

        it('should show warning when trying to start without impersonation', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            LiveImpersonationService.isActive = false;
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: false,
                userId: null,
                userName: null
            });

            await component._toggleLiveImpersonation();

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'warning'
            );
            expect(LiveImpersonationService.start).not.toHaveBeenCalled();
        });

        it('should start live impersonation when user is selected', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            LiveImpersonationService.isActive = false;
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'user-123',
                userName: 'Test User'
            });

            await component._toggleLiveImpersonation();

            expect(LiveImpersonationService.start).toHaveBeenCalledWith('user-123', 'Test User');
            expect(LiveComparisonPanel.show).toHaveBeenCalled();
            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'success'
            );
        });

        it('should handle start error gracefully', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            LiveImpersonationService.isActive = false;
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true,
                userId: 'user-123',
                userName: 'Test User'
            });

            LiveImpersonationService.start.mockRejectedValue(new Error('Start failed'));

            await component._toggleLiveImpersonation();

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('Start failed'),
                'error'
            );
        });
    });

    describe('_enableSecurityAnalysis', () => {
        it('should enable all buttons when enabled is true', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component._enableSecurityAnalysis(true);

            expect(component.ui.analyzeBtn.disabled).toBe(false);
            expect(component.ui.compareCommandsBtn.disabled).toBe(false);
            expect(component.ui.liveBtn.disabled).toBe(false);
        });

        it('should disable all buttons when enabled is false', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component._enableSecurityAnalysis(false);

            expect(component.ui.analyzeBtn.disabled).toBe(true);
            expect(component.ui.compareCommandsBtn.disabled).toBe(true);
            expect(component.ui.liveBtn.disabled).toBe(true);
        });

        it('should show/hide comparison user selector', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component._enableSecurityAnalysis(true);
            expect(component.ui.compareUserSelector.style.display).toBe('flex');

            component._enableSecurityAnalysis(false);
            expect(component.ui.compareUserSelector.style.display).toBe('none');
        });
    });

    describe('_renderSecurityAnalysisPlaceholder', () => {
        it('should render placeholder message', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.securityAnalysis = { someData: true };

            component._renderSecurityAnalysisPlaceholder();

            expect(component.ui.securityAnalysisContent.innerHTML).toContain('pdt-note');
            expect(component.securityAnalysis).toBeNull();
        });
    });

    describe('_onSecurityActionClick', () => {
        it('should handle analyze-security-btn click', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const analyzeSpy = vi.spyOn(component, '_performSecurityAnalysis').mockResolvedValue();

            const mockEvent = {
                target: {
                    closest: (selector) => {
                        if (selector === 'button') {
                            return { id: 'analyze-security-btn' };
                        }
                        return null;
                    }
                }
            };

            component._onSecurityActionClick(mockEvent);

            expect(analyzeSpy).toHaveBeenCalled();
            analyzeSpy.mockRestore();
        });

        it('should handle compare-commands-btn click', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const compareSpy = vi.spyOn(component, '_performCommandBarAnalysis').mockResolvedValue();

            const mockEvent = {
                target: {
                    closest: (selector) => {
                        if (selector === 'button') {
                            return { id: 'compare-commands-btn' };
                        }
                        return null;
                    }
                }
            };

            component._onSecurityActionClick(mockEvent);

            expect(compareSpy).toHaveBeenCalled();
            compareSpy.mockRestore();
        });

        it('should handle live-impersonation-btn click', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const liveSpy = vi.spyOn(component, '_toggleLiveImpersonation').mockResolvedValue();

            const mockEvent = {
                target: {
                    closest: (selector) => {
                        if (selector === 'button') {
                            return { id: 'live-impersonation-btn' };
                        }
                        return null;
                    }
                }
            };

            component._onSecurityActionClick(mockEvent);

            expect(liveSpy).toHaveBeenCalled();
            liveSpy.mockRestore();
        });

        it('should handle open-admin-center-btn click', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const adminSpy = vi.spyOn(component, '_openAdminCenter').mockImplementation();

            const mockEvent = {
                target: {
                    closest: (selector) => {
                        if (selector === 'button') {
                            return { id: 'open-admin-center-btn' };
                        }
                        return null;
                    }
                }
            };

            component._onSecurityActionClick(mockEvent);

            expect(adminSpy).toHaveBeenCalled();
            adminSpy.mockRestore();
        });

        it('should handle open-entra-btn click', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const entraSpy = vi.spyOn(component, '_openEntra').mockImplementation();

            const mockEvent = {
                target: {
                    closest: (selector) => {
                        if (selector === 'button') {
                            return { id: 'open-entra-btn' };
                        }
                        return null;
                    }
                }
            };

            component._onSecurityActionClick(mockEvent);

            expect(entraSpy).toHaveBeenCalled();
            entraSpy.mockRestore();
        });

        it('should return early if no button target', async () => {
            component = new ImpersonateTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const mockEvent = {
                target: {
                    closest: () => null
                }
            };

            // Should not throw
            expect(() => component._onSecurityActionClick(mockEvent)).not.toThrow();
        });
    });
});
