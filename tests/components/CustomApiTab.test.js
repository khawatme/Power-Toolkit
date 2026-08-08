/**
 * @file Tests for CustomApiTab component
 * @module tests/components/CustomApiTab.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// MOCKS (MUST BE BEFORE IMPORTS)
// ═══════════════════════════════════════════════════════════════

const mockApis = [
    {
        customapiid: 'api-001',
        uniquename: 'new_TestAction',
        displayname: 'Test Action',
        description: 'A test action',
        bindingtype: 0,
        boundentitylogicalname: '',
        isfunction: false,
        isprivate: false,
        ismanaged: false,
        allowedcustomprocessingsteptype: 0,
        executeprivilegename: '',
        workflowsdkstepenabled: false,
        PluginTypeId: null,
        CustomAPIRequestParameters: [
            { customapirequestparameterid: 'p1', uniquename: 'InputName', name: 'new_TestAction.InputName', displayname: 'Input Name', description: 'Name input', type: 10, isoptional: false, logicalentityname: '' }
        ],
        CustomAPIResponseProperties: [
            { customapiresponsepropertyid: 'r1', uniquename: 'OutputResult', name: 'new_TestAction.OutputResult', displayname: 'Output Result', description: 'Result', type: 10, logicalentityname: '' }
        ]
    },
    {
        customapiid: 'api-002',
        uniquename: 'new_TestFunction',
        displayname: 'Test Function',
        description: 'A test function',
        bindingtype: 1,
        boundentitylogicalname: 'account',
        isfunction: true,
        isprivate: false,
        ismanaged: true,
        allowedcustomprocessingsteptype: 2,
        executeprivilegename: 'prvReadAccount',
        workflowsdkstepenabled: false,
        PluginTypeId: { plugintypeid: 'pt1', typename: 'MyPlugin.Execute', name: 'Execute', assemblyname: 'MyPlugin' },
        CustomAPIRequestParameters: [],
        CustomAPIResponseProperties: []
    }
];

vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        listSolutions: vi.fn().mockResolvedValue([]),
        retrieveMultipleRecords: vi.fn().mockResolvedValue({ entities: [] }),
        addSolutionComponent: vi.fn().mockResolvedValue({}),
        retrieveRecord: vi.fn().mockResolvedValue({})
    }
}));

vi.mock('../../src/services/CustomApiService.js', () => ({
    CustomApiService: {
        fetchAll: vi.fn().mockResolvedValue([]),
        fetchBySolution: vi.fn().mockResolvedValue([]),
        fetchById: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({ customapiid: 'new-id' }),
        addRequestParameter: vi.fn().mockResolvedValue({}),
        addResponseProperty: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({}),
        updateRequestParameter: vi.fn().mockResolvedValue({}),
        updateResponseProperty: vi.fn().mockResolvedValue({}),
        deleteRequestParameter: vi.fn().mockResolvedValue({}),
        deleteResponseProperty: vi.fn().mockResolvedValue({}),
        execute: vi.fn().mockResolvedValue({ status: 200, statusText: 'OK', body: {}, headers: {}, duration: 50, size: 10 }),
        buildEndpointUrl: vi.fn().mockReturnValue('new_TestAction'),
        buildRequestBody: vi.fn().mockReturnValue({}),
        generateCodeSnippet: vi.fn().mockReturnValue('// code'),
        generateDefaultParamValues: vi.fn().mockReturnValue({}),
        exportDefinition: vi.fn().mockReturnValue({ uniquename: 'new_TestAction' }),
        importDefinition: vi.fn().mockResolvedValue({}),
        fetchPluginTypes: vi.fn().mockResolvedValue([]),
        getTypeLabel: vi.fn().mockReturnValue('String'),
        getBindingLabel: vi.fn().mockReturnValue('Global'),
        getProcessingLabel: vi.fn().mockReturnValue('None')
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/services/DialogService.js', () => ({
    DialogService: { show: vi.fn() }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: true,
        getFormContext: vi.fn().mockReturnValue({
            data: { entity: { getId: vi.fn().mockReturnValue('{abc-123}'), getEntityName: vi.fn().mockReturnValue('account') } }
        }),
        getGlobalContext: vi.fn().mockReturnValue({
            getClientUrl: vi.fn().mockReturnValue('https://org.crm.dynamics.com')
        }),
        getEntityId: vi.fn().mockReturnValue('abc-123')
    }
}));

vi.mock('../../src/utils/ui/BusyIndicator.js', () => ({
    BusyIndicator: { set: vi.fn(), clear: vi.fn() }
}));

vi.mock('../../src/utils/parsers/ErrorParser.js', () => ({
    ErrorParser: { extract: vi.fn(e => e?.message || 'Unknown error') }
}));

vi.mock('../../src/helpers/index.js', () => ({
    debounce: vi.fn((fn) => {
        const wrapper = (...args) => fn.apply(null, args);
        wrapper.cancel = vi.fn();
        return wrapper;
    }),
    escapeHtml: vi.fn(s => s ?? ''),
    copyToClipboard: vi.fn(),
    showConfirmDialog: vi.fn().mockResolvedValue(true)
}));

// ═══════════════════════════════════════════════════════════════
// IMPORTS (AFTER MOCKS)
// ═══════════════════════════════════════════════════════════════

import { CustomApiTab } from '../../src/components/CustomApiTab.js';
import { CustomApiService } from '../../src/services/CustomApiService.js';
import { DataService } from '../../src/services/DataService.js';
import { NotificationService } from '../../src/services/NotificationService.js';
import { DialogService } from '../../src/services/DialogService.js';
import { BusyIndicator } from '../../src/utils/ui/BusyIndicator.js';
import { showConfirmDialog, copyToClipboard, escapeHtml } from '../../src/helpers/index.js';

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

describe('CustomApiTab', () => {
    let tab;

    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        CustomApiService.fetchAll.mockResolvedValue([...mockApis]);
        CustomApiService.getTypeLabel.mockReturnValue('String');
        CustomApiService.getBindingLabel.mockReturnValue('Global');
        CustomApiService.getProcessingLabel.mockReturnValue('None');
    });

    afterEach(() => {
        tab?.cleanup?.();
        tab?.destroy?.();
        tab = null;
        document.body.innerHTML = '';
    });

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    describe('constructor', () => {
        it('should initialize with correct id', () => {
            tab = new CustomApiTab();
            expect(tab.id).toBe('customApi');
        });

        it('should initialize with correct label', () => {
            tab = new CustomApiTab();
            expect(tab.label).toBe('Custom APIs');
        });

        it('should initialize allApis as empty array', () => {
            tab = new CustomApiTab();
            expect(tab.allApis).toEqual([]);
        });

        it('should initialize selectedApi as null', () => {
            tab = new CustomApiTab();
            expect(tab.selectedApi).toBeNull();
        });

        it('should initialize activeView as browser', () => {
            tab = new CustomApiTab();
            expect(tab.activeView).toBe('browser');
        });

        it('should initialize executionHistory as empty array', () => {
            tab = new CustomApiTab();
            expect(tab.executionHistory).toEqual([]);
        });

        it('should initialize UI refs as empty object', () => {
            tab = new CustomApiTab();
            expect(tab.ui).toEqual({});
        });
    });

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    describe('render', () => {
        it('should return HTMLElement', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            expect(element).toBeInstanceOf(HTMLElement);
        });

        it('should have pdt-capi class', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            expect(element.className).toBe('pdt-capi');
        });

        it('should contain sub-tab toggle buttons', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            const subTabs = element.querySelectorAll('.pdt-sub-tab');
            expect(subTabs).toHaveLength(2);
        });

        it('should contain solution selector', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            expect(element.querySelector('#capi-solution-select')).toBeTruthy();
        });

        it('should contain browser view', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            expect(element.querySelector('#capi-browser-view')).toBeTruthy();
        });

        it('should contain tester view (hidden)', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            const tester = element.querySelector('#capi-tester-view');
            expect(tester).toBeTruthy();
            expect(tester.style.display).toBe('none');
        });

        it('should contain search input', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            expect(element.querySelector('#capi-search')).toBeTruthy();
        });

        it('should contain create button', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            expect(element.querySelector('#capi-create-btn')).toBeTruthy();
        });

        it('should contain import button', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            expect(element.querySelector('#capi-import-btn')).toBeTruthy();
        });

        it('should not call CustomApiService.fetchAll on render', async () => {
            tab = new CustomApiTab();
            await tab.render();
            expect(CustomApiService.fetchAll).not.toHaveBeenCalled();
        });

        it('should not trigger BusyIndicator on render', async () => {
            tab = new CustomApiTab();
            await tab.render();
            expect(BusyIndicator.set).not.toHaveBeenCalled();
            expect(BusyIndicator.clear).not.toHaveBeenCalled();
        });

        it('should have empty allApis on render before solution selection', async () => {
            tab = new CustomApiTab();
            await tab.render();
            expect(tab.allApis).toHaveLength(0);
        });

        it('should show select-solution message in list container on render', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            const note = element.querySelector('#capi-list .pdt-note');
            expect(note).toBeTruthy();
            expect(element.querySelectorAll('.pdt-capi-card')).toHaveLength(0);
        });

        it('should render stats section', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            // listContainer is cached during render
            const stats = element.querySelector('#capi-stats');
            expect(stats).toBeTruthy();
        });

        it('should not show error on initial render', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            expect(element.querySelector('.pdt-error')).toBeNull();
        });

        it('should show select-solution note regardless of API data on render', async () => {
            CustomApiService.fetchAll.mockResolvedValue([]);
            tab = new CustomApiTab();
            const element = await tab.render();
            expect(element.querySelector('#capi-list .pdt-note')).toBeTruthy();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // POSTRENDER
    // ═══════════════════════════════════════════════════════════

    describe('postRender', () => {
        it('should cache DOM references', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            expect(tab.ui.searchInput).toBeTruthy();
            expect(tab.ui.createBtn).toBeTruthy();
            expect(tab.ui.importBtn).toBeTruthy();
            expect(tab.ui.listContainer).toBeTruthy();
            expect(tab.ui.apiSelect).toBeTruthy();
            expect(tab.ui.executeBtn).toBeTruthy();
        });

        it('should populate tester select with APIs', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();
            tab._populateTesterSelect();

            const options = tab.ui.apiSelect.querySelectorAll('option');
            // 1 placeholder + 2 APIs
            expect(options.length).toBeGreaterThanOrEqual(3);
        });

        it('should bind search handler', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            expect(tab._searchHandler).toBeInstanceOf(Function);
        });

        it('should bind create button handler', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            expect(tab._createBtnHandler).toBeInstanceOf(Function);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════

    describe('cleanup', () => {
        it('should not throw when called without postRender', () => {
            tab = new CustomApiTab();
            expect(() => tab.cleanup()).not.toThrow();
        });

        it('should cancel debounced filterCards', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.cleanup();

            if (tab.filterCards?.cancel) {
                expect(tab.filterCards.cancel).toHaveBeenCalled();
            }
        });
    });

    // ═══════════════════════════════════════════════════════════
    // CARD RENDERING
    // ═══════════════════════════════════════════════════════════

    describe('_createApiCard', () => {
        it('should create card with correct data-api-id', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const card = tab._createApiCard(mockApis[0]);
            expect(card.dataset.apiId).toBe('api-001');
        });

        it('should show action badge for actions', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const card = tab._createApiCard(mockApis[0]);
            expect(card.querySelector('.pdt-capi-badge-action')).toBeTruthy();
        });

        it('should show function badge for functions', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const card = tab._createApiCard(mockApis[1]);
            expect(card.querySelector('.pdt-capi-badge-function')).toBeTruthy();
        });

        it('should show managed badge for managed APIs', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const card = tab._createApiCard(mockApis[1]);
            expect(card.querySelector('.pdt-capi-badge-managed')).toBeTruthy();
        });

        it('should not show managed badge for unmanaged APIs', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const card = tab._createApiCard(mockApis[0]);
            expect(card.querySelector('.pdt-capi-badge-managed')).toBeFalsy();
        });

        it('should include edit and delete buttons for unmanaged APIs', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const card = tab._createApiCard(mockApis[0]);
            expect(card.querySelector('.capi-edit-btn')).toBeTruthy();
            expect(card.querySelector('.capi-delete-btn')).toBeTruthy();
        });

        it('should not include edit/delete for managed APIs', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const card = tab._createApiCard(mockApis[1]);
            expect(card.querySelector('.capi-edit-btn')).toBeFalsy();
            expect(card.querySelector('.capi-delete-btn')).toBeFalsy();
        });

        it('should include expand, export, and test buttons', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const card = tab._createApiCard(mockApis[0]);
            expect(card.querySelector('.capi-expand-btn')).toBeTruthy();
            expect(card.querySelector('.capi-export-btn')).toBeTruthy();
            expect(card.querySelector('.capi-test-btn')).toBeTruthy();
        });

        it('should escape API name with escapeHtml', async () => {
            tab = new CustomApiTab();
            await tab.render();

            tab._createApiCard(mockApis[0]);
            expect(escapeHtml).toHaveBeenCalledWith('new_TestAction');
        });

        it('should include search term data attribute', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const card = tab._createApiCard(mockApis[0]);
            expect(card.dataset.searchTerm).toContain('new_testaction');
        });

        it('should render param table when params exist', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const card = tab._createApiCard(mockApis[0]);
            expect(card.querySelector('.pdt-capi-mini-table')).toBeTruthy();
        });

        it('should show plugin name when available', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const card = tab._createApiCard(mockApis[1]);
            expect(escapeHtml).toHaveBeenCalledWith('MyPlugin.Execute');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // SEARCH / FILTER
    // ═══════════════════════════════════════════════════════════

    describe('_filterCards', () => {
        it('should hide non-matching cards', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            tab.ui.searchInput.value = 'TestFunction';
            tab._filterCards();

            const cards = element.querySelectorAll('.pdt-capi-card');
            const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
            expect(visibleCards).toHaveLength(1);
        });

        it('should show all cards with empty search', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            tab.ui.searchInput.value = '';
            tab._filterCards();

            const cards = element.querySelectorAll('.pdt-capi-card');
            const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
            expect(visibleCards).toHaveLength(2);
        });

        it('should preserve the active search filter across a re-render (data refresh)', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];

            // The user has an active search; a data refresh (e.g. after adding a parameter) re-renders.
            tab.ui.searchInput.value = 'TestFunction';
            tab._renderBrowser();

            const cards = element.querySelectorAll('.pdt-capi-card');
            const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
            expect(visibleCards).toHaveLength(1); // filter still applied, not reset to "show all"
        });
    });

    // ═══════════════════════════════════════════════════════════
    // VIEW TOGGLE
    // ═══════════════════════════════════════════════════════════

    describe('_switchView', () => {
        it('should switch to tester view', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._switchView('tester');

            expect(tab.activeView).toBe('tester');
            expect(tab.ui.testerView.style.display).not.toBe('none');
            expect(tab.ui.browserView.style.display).toBe('none');
        });

        it('should switch to browser view', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._switchView('tester');
            tab._switchView('browser');

            expect(tab.activeView).toBe('browser');
            expect(tab.ui.browserView.style.display).not.toBe('none');
            expect(tab.ui.testerView.style.display).toBe('none');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // EXPAND / COLLAPSE
    // ═══════════════════════════════════════════════════════════

    describe('_toggleExpand', () => {
        it('should show expandable section when collapsed', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            const card = element.querySelector('.pdt-capi-card');
            const btn = card.querySelector('.capi-expand-btn');
            tab._toggleExpand(card, btn);

            const expandable = card.querySelector('.pdt-capi-expandable');
            expect(expandable.style.display).toBe('block');
        });

        it('should hide expandable section when expanded', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            const card = element.querySelector('.pdt-capi-card');
            const btn = card.querySelector('.capi-expand-btn');

            // Expand then collapse
            tab._toggleExpand(card, btn);
            tab._toggleExpand(card, btn);

            const expandable = card.querySelector('.pdt-capi-expandable');
            expect(expandable.style.display).toBe('none');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // DELETE
    // ═══════════════════════════════════════════════════════════

    describe('_handleDelete', () => {
        it('should show confirmation dialog', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._handleDelete(mockApis[0]);

            expect(showConfirmDialog).toHaveBeenCalled();
        });

        it('should call CustomApiService.delete on confirm', async () => {
            showConfirmDialog.mockResolvedValue(true);
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._handleDelete(mockApis[0]);

            expect(CustomApiService.delete).toHaveBeenCalledWith('api-001');
        });

        it('should not delete when cancelled', async () => {
            showConfirmDialog.mockResolvedValue(false);
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._handleDelete(mockApis[0]);

            expect(CustomApiService.delete).not.toHaveBeenCalled();
        });

        it('should show success notification on delete', async () => {
            showConfirmDialog.mockResolvedValue(true);
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._handleDelete(mockApis[0]);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String), 'success'
            );
        });

        it('should show error notification on delete failure', async () => {
            showConfirmDialog.mockResolvedValue(true);
            CustomApiService.delete.mockRejectedValue(new Error('Cannot delete'));
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._handleDelete(mockApis[0]);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String), 'error'
            );
        });
    });

    // ═══════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════

    describe('_handleExport', () => {
        it('should export definition and trigger download', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            // Mock URL and createElement for download
            const createObjectURL = vi.fn().mockReturnValue('blob:url');
            const revokeObjectURL = vi.fn();
            vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

            tab._handleExport(mockApis[0]);

            expect(CustomApiService.exportDefinition).toHaveBeenCalledWith(mockApis[0]);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // TESTER - API SELECTION
    // ═══════════════════════════════════════════════════════════

    describe('_onApiSelected', () => {
        it('should set selectedApi when valid API is selected', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();
            tab._populateTesterSelect();

            tab.ui.apiSelect.value = 'api-001';
            tab._onApiSelected();

            expect(tab.selectedApi).toBe(mockApis[0]);
        });

        it('should enable execute button when API is selected', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();
            tab._populateTesterSelect();

            tab.ui.apiSelect.value = 'api-001';
            tab._onApiSelected();

            expect(tab.ui.executeBtn.disabled).toBe(false);
        });

        it('should disable execute button when no API selected', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.ui.apiSelect.value = '';
            tab._onApiSelected();

            expect(tab.ui.executeBtn.disabled).toBe(true);
        });

        it('should show target section for entity-bound APIs', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();
            tab._populateTesterSelect();

            tab.ui.apiSelect.value = 'api-002';
            tab._onApiSelected();

            expect(tab.ui.targetSection.style.display).not.toBe('none');
        });

        it('should update method badge', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();
            tab._populateTesterSelect();

            tab.ui.apiSelect.value = 'api-001';
            tab._onApiSelected();

            expect(tab.ui.methodBadge.textContent).toBe('POST');
        });

        it('should show GET for functions', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();
            tab._populateTesterSelect();

            tab.ui.apiSelect.value = 'api-002';
            tab._onApiSelected();

            expect(tab.ui.methodBadge.textContent).toBe('GET');
        });

        it('should show code generation panel', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();
            tab._populateTesterSelect();

            tab.ui.apiSelect.value = 'api-001';
            tab._onApiSelected();

            expect(tab.ui.codeGen.style.display).not.toBe('none');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // TESTER - EXECUTE
    // ═══════════════════════════════════════════════════════════

    describe('_handleExecute', () => {
        it('should not execute when no API is selected', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.selectedApi = null;
            await tab._handleExecute();

            expect(CustomApiService.execute).not.toHaveBeenCalled();
        });

        it('should call CustomApiService.execute with selected API', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.selectedApi = mockApis[0];
            tab.ui.apiSelect.value = 'api-001';
            await tab._handleExecute();

            expect(CustomApiService.execute).toHaveBeenCalledWith(
                mockApis[0],
                expect.any(Object),
                expect.any(String),
                expect.any(Object)
            );
        });

        it('should show loading state during execution', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.selectedApi = mockApis[0];
            await tab._handleExecute();

            expect(BusyIndicator.set).toHaveBeenCalled();
            expect(BusyIndicator.clear).toHaveBeenCalled();
        });

        it('should show response panel after execution', async () => {
            CustomApiService.execute.mockResolvedValue({
                status: 200, statusText: 'OK', body: { result: 'ok' },
                headers: { 'content-type': 'application/json' }, duration: 123, size: 42
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.selectedApi = mockApis[0];
            await tab._handleExecute();

            expect(tab.ui.responsePanel.style.display).not.toBe('none');
        });

        it('should handle execution error', async () => {
            CustomApiService.execute.mockRejectedValue(new Error('Timeout'));

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.selectedApi = mockApis[0];
            await tab._handleExecute();

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String), 'error'
            );
        });

        it('should add to execution history', async () => {
            CustomApiService.execute.mockResolvedValue({
                status: 200, statusText: 'OK', body: {},
                headers: {}, duration: 50, size: 10
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.selectedApi = mockApis[0];
            await tab._handleExecute();

            expect(tab.executionHistory.length).toBeGreaterThanOrEqual(1);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // CODE GENERATION
    // ═══════════════════════════════════════════════════════════

    describe('_switchCodeLang', () => {
        it('should update code output with selected language', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.selectedApi = mockApis[0];
            tab._switchCodeLang('csharp');

            expect(CustomApiService.generateCodeSnippet).toHaveBeenCalledWith(
                mockApis[0],
                expect.any(Object),
                'csharp',
                expect.any(String)
            );
        });
    });

    // ═══════════════════════════════════════════════════════════
    // RESPONSE TABS
    // ═══════════════════════════════════════════════════════════

    describe('_switchResponseTab', () => {
        it('should show body panel', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._switchResponseTab('body');

            const bodyPanel = element.querySelector('#capi-response-body');
            expect(bodyPanel.style.display).not.toBe('none');
        });

        it('should show headers panel', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._switchResponseTab('headers');

            const headersPanel = element.querySelector('#capi-response-headers');
            expect(headersPanel.style.display).not.toBe('none');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // FORMAT SIZE
    // ═══════════════════════════════════════════════════════════

    describe('_formatSize', () => {
        it('should format bytes correctly', async () => {
            tab = new CustomApiTab();

            expect(tab._formatSize(500)).toBe('500 B');
            expect(tab._formatSize(1024)).toBe('1.0 KB');
            expect(tab._formatSize(1048576)).toBe('1.0 MB');
        });

        it('should handle zero bytes', async () => {
            tab = new CustomApiTab();
            expect(tab._formatSize(0)).toBe('0 B');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // BROWSER CLICK DELEGATION
    // ═══════════════════════════════════════════════════════════

    describe('_handleBrowserClick', () => {
        it('should ignore clicks not on buttons', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            const card = element.querySelector('.pdt-capi-card');
            const event = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(event, 'target', { value: card });

            // Should not throw
            await tab._handleBrowserClick(event);
        });

        it('should handle expand button click', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            const expandBtn = element.querySelector('.capi-expand-btn');
            const card = expandBtn.closest('.pdt-capi-card');

            expandBtn.click();

            const expandable = card.querySelector('.pdt-capi-expandable');
            expect(expandable.style.display).toBe('block');
        });

        it('should handle test button - switch to tester', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            const testBtn = element.querySelector('.capi-test-btn');
            testBtn.click();

            expect(tab.activeView).toBe('tester');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // STATS
    // ═══════════════════════════════════════════════════════════

    describe('_renderStats', () => {
        it('should render 4 stat cards', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._renderStats();

            const statCards = tab.ui.statsContainer.querySelectorAll('.pdt-stat-card');
            expect(statCards).toHaveLength(4);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // NORMALIZE CREATE PREFILL
    // ═══════════════════════════════════════════════════════════

    describe('_normalizeCreatePrefill', () => {
        beforeEach(() => { tab = new CustomApiTab(); });

        it('should return defaults when prefill is null', () => {
            const result = tab._normalizeCreatePrefill(null, 'new');
            expect(result.prefixHint).toBe('new_MyCustomApi');
            expect(result.uniquenameValue).toBe('new_');
            expect(result.name).toBe('');
            expect(result.displayname).toBe('');
            expect(result.description).toBe('');
            expect(result.bindingtype).toBe(0);
            expect(result.processingType).toBe(0);
            expect(result.isprivate).toBe(false);
            expect(result.workflowEnabled).toBe(false);
        });

        it('should return defaults when prefix is empty', () => {
            const result = tab._normalizeCreatePrefill(null, '');
            expect(result.prefixHint).toBe('new_MyCustomApi');
            expect(result.uniquenameValue).toBe('');
        });

        it('should use prefill values when provided', () => {
            const prefill = {
                uniquename: 'my_Api',
                name: 'My Api',
                displayname: 'My Display',
                description: 'Desc',
                isfunction: true,
                bindingtype: 1,
                boundentitylogicalname: 'account',
                allowedcustomprocessingsteptype: 2,
                executeprivilegename: 'prv',
                isprivate: true,
                workflowsdkstepenabled: true
            };
            const result = tab._normalizeCreatePrefill(prefill, 'new');
            expect(result.uniquenameValue).toBe('my_Api');
            expect(result.name).toBe('My Api');
            expect(result.displayname).toBe('My Display');
            expect(result.description).toBe('Desc');
            expect(result.isfunction).toBe(true);
            expect(result.bindingtype).toBe(1);
            expect(result.boundentity).toBe('account');
            expect(result.processingType).toBe(2);
            expect(result.privilege).toBe('prv');
            expect(result.isprivate).toBe(true);
            expect(result.workflowEnabled).toBe(true);
        });

        it('should not prepend prefix when prefill has uniquename', () => {
            const result = tab._normalizeCreatePrefill({ uniquename: 'existing' }, 'new');
            expect(result.uniquenameValue).toBe('existing');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // COLLECT CREATE FORM VALUES
    // ═══════════════════════════════════════════════════════════

    describe('_collectCreateFormValues', () => {
        let container;

        beforeEach(() => {
            tab = new CustomApiTab();
            container = document.createElement('div');
            container.innerHTML = `
                <input id="capi-new-name" value="my_api">
                <textarea id="capi-new-description">Test desc</textarea>
                <select id="capi-new-isfunction"><option value="false" selected>Action</option></select>
                <select id="capi-new-bindingtype"><option value="0" selected>Global</option></select>
                <input id="capi-new-boundentity" value="">
                <select id="capi-new-processing"><option value="0" selected>None</option></select>
                <input id="capi-new-privilege" value="">
                <select id="capi-new-plugintype"><option value="" selected>None</option></select>
                <input type="checkbox" id="capi-new-private">
                <input type="checkbox" id="capi-new-workflow">
            `;
        });

        it('should collect all form values', () => {
            const result = tab._collectCreateFormValues(container, 'my_api', 'My API');
            expect(result.uniquename).toBe('my_api');
            expect(result.displayname).toBe('My API');
            expect(result.description).toBe('Test desc');
            expect(result.isfunction).toBe(false);
            expect(result.bindingtype).toBe(0);
            expect(result.isprivate).toBe(false);
            expect(result.workflowsdkstepenabled).toBe(false);
        });

        it('should fall back to uniquename when name is empty', () => {
            container.querySelector('#capi-new-name').value = '';
            const result = tab._collectCreateFormValues(container, 'my_api', 'My API');
            expect(result.name).toBe('my_api');
        });

        it('should include plugin type bind when selected', () => {
            container.querySelector('#capi-new-plugintype').innerHTML = '<option value="pt-123" selected>Plugin</option>';
            const result = tab._collectCreateFormValues(container, 'my_api', 'My API');
            expect(result['PluginTypeId@odata.bind']).toBe('/plugintypes(pt-123)');
        });

        it('should not include plugin type bind when empty', () => {
            const result = tab._collectCreateFormValues(container, 'my_api', 'My API');
            expect(result['PluginTypeId@odata.bind']).toBeUndefined();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // COLLECT PARAM FORM VALUES
    // ═══════════════════════════════════════════════════════════

    describe('_collectParamFormValues', () => {
        let container;

        beforeEach(() => {
            tab = new CustomApiTab();
            container = document.createElement('div');
            container.innerHTML = `
                <input id="capi-param-uniquename" value="MyParam">
                <input id="capi-param-displayname" value="My Param Display">
                <input id="capi-param-description" value="Param desc">
                <select id="capi-param-type"><option value="10" selected>String</option></select>
                <input id="capi-param-entity" value="">
                <input type="checkbox" id="capi-param-optional">
            `;
        });

        it('should return param object when uniquename is provided', () => {
            const result = tab._collectParamFormValues(container, 'new_TestApi');
            expect(result).not.toBeNull();
            expect(result.uniquename).toBe('MyParam');
            expect(result.name).toBe('new_TestApi.MyParam');
            expect(result.displayname).toBe('My Param Display');
            expect(result.description).toBe('Param desc');
            expect(result.type).toBe(10);
            expect(result.isoptional).toBe(false);
        });

        it('should return null when uniquename is empty', () => {
            container.querySelector('#capi-param-uniquename').value = '';
            const result = tab._collectParamFormValues(container, 'new_TestApi');
            expect(result).toBeNull();
        });

        it('should return null when uniquename is whitespace', () => {
            container.querySelector('#capi-param-uniquename').value = '   ';
            const result = tab._collectParamFormValues(container, 'new_TestApi');
            expect(result).toBeNull();
        });

        it('should fall back to uniquename for displayname when empty', () => {
            container.querySelector('#capi-param-displayname').value = '';
            const result = tab._collectParamFormValues(container, 'new_TestApi');
            expect(result.displayname).toBe('MyParam');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // REFRESH DATA AND RE-EXPAND
    // ═══════════════════════════════════════════════════════════

    describe('_refreshDataAndReExpand', () => {
        it('should call _refreshData and expand the matching card', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            // Spy on _toggleExpand
            const toggleSpy = vi.spyOn(tab, '_toggleExpand').mockImplementation(() => {});

            // After render, cards exist for mockApis
            await tab._refreshDataAndReExpand('api-001');

            expect(toggleSpy).toHaveBeenCalledTimes(1);
            const [card, btn] = toggleSpy.mock.calls[0];
            expect(card.dataset.apiId).toBe('api-001');
        });

        it('should not throw when card is not found', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const toggleSpy = vi.spyOn(tab, '_toggleExpand').mockImplementation(() => {});

            await tab._refreshDataAndReExpand('nonexistent-id');

            expect(toggleSpy).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // BUILD CREATE FORM HTML
    // ═══════════════════════════════════════════════════════════

    describe('_buildCreateFormHtml', () => {
        beforeEach(() => { tab = new CustomApiTab(); });

        it('should return HTML string with all form fields', () => {
            const fields = tab._normalizeCreatePrefill(null, 'new');
            const html = tab._buildCreateFormHtml(fields, '<option value="pt1">Plugin1</option>');

            expect(html).toContain('id="capi-new-uniquename"');
            expect(html).toContain('id="capi-new-name"');
            expect(html).toContain('id="capi-new-displayname"');
            expect(html).toContain('id="capi-new-description"');
            expect(html).toContain('id="capi-new-isfunction"');
            expect(html).toContain('id="capi-new-bindingtype"');
            expect(html).toContain('id="capi-new-processing"');
            expect(html).toContain('id="capi-new-plugintype"');
            expect(html).toContain('id="capi-new-private"');
            expect(html).toContain('id="capi-new-workflow"');
            expect(html).toContain('Plugin1');
        });

        it('should mark selected options for prefill values', () => {
            const prefill = {
                isfunction: true,
                bindingtype: 1,
                allowedcustomprocessingsteptype: 2,
                isprivate: true,
                workflowsdkstepenabled: true
            };
            const fields = tab._normalizeCreatePrefill(prefill, '');
            const html = tab._buildCreateFormHtml(fields, '');

            // Function option should be selected
            expect(html).toContain('value="true" selected');
            // Entity binding should be selected
            expect(html).toContain('value="1" selected');
            // Sync and Async processing should be selected
            expect(html).toContain('value="2" selected');
            // Checkboxes should be checked
            expect(html).toContain('id="capi-new-private" checked');
            expect(html).toContain('id="capi-new-workflow" checked');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // LOAD SOLUTIONS
    // ═══════════════════════════════════════════════════════════

    describe('_loadSolutions', () => {
        it('should load solutions into the dropdown', async () => {
            DataService.retrieveMultipleRecords.mockResolvedValue({
                entities: [
                    { solutionid: 'sol-1', uniquename: 'MySolution', friendlyname: 'My Solution', ismanaged: false, publisherid: { customizationprefix: 'new' } },
                    { solutionid: 'sol-2', uniquename: 'ManagedSol', friendlyname: 'Managed Sol', ismanaged: true, publisherid: { customizationprefix: 'ms' } }
                ]
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._loadSolutions();

            const options = tab.ui.solutionSelect.querySelectorAll('option');
            expect(options.length).toBe(3); // "All" + 2 solutions
            expect(options[1].value).toBe('sol-1');
            expect(options[1].dataset.prefix).toBe('new');
        });

        it('should show [Managed] label for managed solutions', async () => {
            DataService.retrieveMultipleRecords.mockResolvedValue({
                entities: [
                    { solutionid: 'sol-m', uniquename: 'Managed', friendlyname: 'Managed', ismanaged: true, publisherid: { customizationprefix: 'ms' } }
                ]
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._loadSolutions();

            const opt = tab.ui.solutionSelect.querySelectorAll('option')[1];
            expect(opt.textContent).toContain('[Managed]');
        });

        it('should fallback to All Solutions on error', async () => {
            DataService.retrieveMultipleRecords.mockRejectedValue(new Error('fail'));

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._loadSolutions();

            const options = tab.ui.solutionSelect.querySelectorAll('option');
            expect(options.length).toBe(1);
        });

        it('should not throw when solutionSelect is missing', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.ui.solutionSelect = null;

            await expect(tab._loadSolutions()).resolves.toBeUndefined();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // ON SOLUTION CHANGED
    // ═══════════════════════════════════════════════════════════

    describe('_onSolutionChanged', () => {
        it('should fetch by solution when a solution is selected', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            // Set up the select with a value
            tab.ui.solutionSelect.innerHTML = '<option value="sol-1" data-name="MySol" data-prefix="new">My Sol</option>';
            tab.ui.solutionSelect.value = 'sol-1';
            CustomApiService.fetchBySolution.mockResolvedValue([mockApis[0]]);

            await tab._onSolutionChanged();

            expect(CustomApiService.fetchBySolution).toHaveBeenCalledWith('sol-1');
            expect(tab.selectedSolutionId).toBe('sol-1');
            expect(tab.selectedSolutionName).toBe('MySol');
            expect(tab.allApis).toHaveLength(1);
        });

        it('should show empty state when no solution is selected', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.ui.solutionSelect.innerHTML = '<option value="" data-name="" data-prefix="">--- Select ---</option>';
            tab.ui.solutionSelect.value = '';

            await tab._onSolutionChanged();

            expect(CustomApiService.fetchAll).not.toHaveBeenCalled();
            expect(tab.selectedSolutionId).toBe('');
            expect(tab.allApis).toHaveLength(0);
            expect(tab.ui.listContainer.innerHTML).toContain('pdt-note');
        });

        it('should show BusyIndicator during load when solution is selected', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.ui.solutionSelect.innerHTML = '<option value="sol-1" data-name="MySol" data-prefix="new">My Sol</option>';
            tab.ui.solutionSelect.value = 'sol-1';
            vi.clearAllMocks();
            CustomApiService.fetchBySolution.mockResolvedValue([]);

            await tab._onSolutionChanged();

            expect(BusyIndicator.set).toHaveBeenCalled();
            expect(BusyIndicator.clear).toHaveBeenCalled();
        });

        it('should show error on fetch failure', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.ui.solutionSelect.innerHTML = '<option value="sol-1" data-name="X" data-prefix="">X</option>';
            tab.ui.solutionSelect.value = 'sol-1';
            CustomApiService.fetchBySolution.mockRejectedValue(new Error('Network error'));

            await tab._onSolutionChanged();

            expect(tab.ui.listContainer.innerHTML).toContain('pdt-error');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // RENDER BROWSER
    // ═══════════════════════════════════════════════════════════

    describe('_renderBrowser', () => {
        it('should render cards for all APIs', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.allApis = [...mockApis];
            tab._renderBrowser();

            const cards = tab.ui.listContainer.querySelectorAll('.pdt-capi-card');
            expect(cards).toHaveLength(2);
        });

        it('should show no-results message when empty', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.allApis = [];
            tab._renderBrowser();

            expect(tab.ui.listContainer.querySelector('.pdt-note')).toBeTruthy();
        });

        it('should call _renderStats', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const spy = vi.spyOn(tab, '_renderStats');
            tab._renderBrowser();

            expect(spy).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // RENDER PARAM TABLE
    // ═══════════════════════════════════════════════════════════

    describe('_renderParamTable', () => {
        it('should render table with params', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const html = tab._renderParamTable(mockApis[0].CustomAPIRequestParameters, mockApis[0]);
            expect(html).toContain('pdt-capi-mini-table');
            expect(html).toContain('InputName');
        });

        it('should include edit/delete buttons for unmanaged API', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const html = tab._renderParamTable(mockApis[0].CustomAPIRequestParameters, mockApis[0]);
            expect(html).toContain('capi-edit-param-btn');
            expect(html).toContain('capi-delete-param-btn');
        });

        it('should not include edit/delete for managed API', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const html = tab._renderParamTable(mockApis[0].CustomAPIRequestParameters, mockApis[1]);
            expect(html).not.toContain('capi-edit-param-btn');
            expect(html).not.toContain('capi-delete-param-btn');
        });

        it('should show Required for non-optional params', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const html = tab._renderParamTable(mockApis[0].CustomAPIRequestParameters, mockApis[0]);
            expect(html).toContain('<strong>Required</strong>');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // RENDER PROP TABLE
    // ═══════════════════════════════════════════════════════════

    describe('_renderPropTable', () => {
        it('should render table with properties', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const html = tab._renderPropTable(mockApis[0].CustomAPIResponseProperties, mockApis[0]);
            expect(html).toContain('pdt-capi-mini-table');
            expect(html).toContain('OutputResult');
        });

        it('should include edit/delete buttons for unmanaged API', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const html = tab._renderPropTable(mockApis[0].CustomAPIResponseProperties, mockApis[0]);
            expect(html).toContain('capi-edit-prop-btn');
            expect(html).toContain('capi-delete-prop-btn');
        });

        it('should not include edit/delete for managed API', async () => {
            tab = new CustomApiTab();
            await tab.render();

            const html = tab._renderPropTable(mockApis[0].CustomAPIResponseProperties, mockApis[1]);
            expect(html).not.toContain('capi-edit-prop-btn');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // BUILD SOLUTION INFO HTML
    // ═══════════════════════════════════════════════════════════

    describe('_buildSolutionInfoHtml', () => {
        it('should show success info when solution is selected', async () => {
            tab = new CustomApiTab();
            tab.selectedSolutionId = 'sol-1';
            tab.selectedSolutionName = 'MySolution';
            tab.selectedSolutionPrefix = 'new';

            const html = tab._buildSolutionInfoHtml();
            expect(html).toContain('pdt-soln-info--success');
            expect(html).toContain('MySolution');
        });

        it('should show warning when no solution is selected', async () => {
            tab = new CustomApiTab();
            tab.selectedSolutionId = '';
            tab.selectedSolutionName = '';

            const html = tab._buildSolutionInfoHtml();
            expect(html).toContain('pdt-soln-info--warning');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // OPEN CREATE DIALOG
    // ═══════════════════════════════════════════════════════════

    describe('_openCreateDialog', () => {
        it('should call DialogService.show with create title', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._openCreateDialog();

            expect(DialogService.show).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(HTMLElement)
            );
        });

        it('should use import review title when prefill is provided', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._openCreateDialog({ uniquename: 'imported_api' });

            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should load plugin types', async () => {
            CustomApiService.fetchPluginTypes.mockResolvedValue([
                { plugintypeid: 'pt1', typename: 'TestPlugin', name: 'Execute', ismanaged: false }
            ]);

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._openCreateDialog();

            expect(CustomApiService.fetchPluginTypes).toHaveBeenCalled();
        });

        it('should not fail if fetchPluginTypes throws', async () => {
            CustomApiService.fetchPluginTypes.mockRejectedValue(new Error('fail'));

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await expect(tab._openCreateDialog()).resolves.toBeUndefined();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // HANDLE CREATE SUBMIT
    // ═══════════════════════════════════════════════════════════

    describe('_handleCreateSubmit', () => {
        let content;
        let dlg;
        let createBtn;
        let revalidate;

        beforeEach(async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            content = document.createElement('div');
            content.innerHTML = `
                <input id="capi-new-uniquename" value="new_TestApi">
                <input id="capi-new-name" value="new_TestApi">
                <input id="capi-new-displayname" value="Test API">
                <textarea id="capi-new-description">Desc</textarea>
                <select id="capi-new-isfunction"><option value="false" selected>Action</option></select>
                <select id="capi-new-bindingtype"><option value="0" selected>Global</option></select>
                <input id="capi-new-boundentity" value="">
                <select id="capi-new-processing"><option value="0" selected>None</option></select>
                <input id="capi-new-privilege" value="">
                <select id="capi-new-plugintype"><option value="" selected>None</option></select>
                <input type="checkbox" id="capi-new-private">
                <input type="checkbox" id="capi-new-workflow">
            `;
            document.body.appendChild(content);
            dlg = { close: vi.fn() };
            createBtn = document.createElement('button');
            createBtn.textContent = 'Create';
            revalidate = vi.fn();
        });

        it('should call CustomApiService.create on valid submit', async () => {
            await tab._handleCreateSubmit(content, dlg, createBtn, revalidate);

            expect(CustomApiService.create).toHaveBeenCalledWith(
                expect.objectContaining({ uniquename: 'new_TestApi' }),
                [], [],
                expect.any(String)
            );
        });

        it('should show success notification and close dialog', async () => {
            await tab._handleCreateSubmit(content, dlg, createBtn, revalidate);

            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'success');
            expect(dlg.close).toHaveBeenCalled();
        });

        it('should show error when uniquename is empty', async () => {
            content.querySelector('#capi-new-uniquename').value = '';

            await tab._handleCreateSubmit(content, dlg, createBtn, revalidate);

            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
            expect(CustomApiService.create).not.toHaveBeenCalled();
        });

        it('should show error when displayname is empty', async () => {
            content.querySelector('#capi-new-displayname').value = '';

            await tab._handleCreateSubmit(content, dlg, createBtn, revalidate);

            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
        });

        it('should handle create failure', async () => {
            CustomApiService.create.mockRejectedValue(new Error('Create failed'));

            await tab._handleCreateSubmit(content, dlg, createBtn, revalidate);

            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
            expect(revalidate).toHaveBeenCalled();
        });

        it('should disable form during submission', async () => {
            let capturedDisableState;
            CustomApiService.create.mockImplementation(async () => {
                capturedDisableState = createBtn.disabled;
                return { customapiid: 'new-id' };
            });

            await tab._handleCreateSubmit(content, dlg, createBtn, revalidate);

            expect(capturedDisableState).toBe(true);
        });

        it('should show BusyIndicator and clear it', async () => {
            vi.clearAllMocks();
            CustomApiService.create.mockResolvedValue({ customapiid: 'new-id' });
            CustomApiService.fetchAll.mockResolvedValue([...mockApis]);

            await tab._handleCreateSubmit(content, dlg, createBtn, revalidate);

            expect(BusyIndicator.set).toHaveBeenCalled();
            expect(BusyIndicator.clear).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // OPEN EDIT DIALOG
    // ═══════════════════════════════════════════════════════════

    describe('_openEditDialog', () => {
        it('should call DialogService.show', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._openEditDialog(mockApis[0]);

            expect(DialogService.show).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(HTMLElement)
            );
        });

        it('should populate form with API values', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            // Capture the content passed to DialogService
            let dialogContent;
            DialogService.show.mockImplementation((_title, content) => {
                dialogContent = content;
                return { close: vi.fn() };
            });

            tab._openEditDialog(mockApis[0]);

            expect(dialogContent.querySelector('#capi-edit-displayname').value).toBe('Test Action');
            expect(dialogContent.querySelector('#capi-edit-description').value).toBe('A test action');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // OPEN ADD PARAM DIALOG
    // ═══════════════════════════════════════════════════════════

    describe('_openAddParamDialog', () => {
        it('should call DialogService.show', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._openAddParamDialog(mockApis[0]);

            expect(DialogService.show).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(HTMLElement)
            );
        });

        it('should include solution info HTML', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            let dialogContent;
            DialogService.show.mockImplementation((_title, content) => {
                dialogContent = content;
                return { close: vi.fn() };
            });

            tab._openAddParamDialog(mockApis[0]);

            expect(dialogContent.querySelector('.pdt-soln-row')).toBeTruthy();
        });

        it('should include type options dropdown', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            let dialogContent;
            DialogService.show.mockImplementation((_title, content) => {
                dialogContent = content;
                return { close: vi.fn() };
            });

            tab._openAddParamDialog(mockApis[0]);

            const typeSelect = dialogContent.querySelector('#capi-param-type');
            expect(typeSelect).toBeTruthy();
            expect(typeSelect.options.length).toBeGreaterThan(0);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // OPEN ADD PROP DIALOG
    // ═══════════════════════════════════════════════════════════

    describe('_openAddPropDialog', () => {
        it('should call DialogService.show', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._openAddPropDialog(mockApis[0]);

            expect(DialogService.show).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(HTMLElement)
            );
        });

        it('should include type options', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            let dialogContent;
            DialogService.show.mockImplementation((_title, content) => {
                dialogContent = content;
                return { close: vi.fn() };
            });

            tab._openAddPropDialog(mockApis[0]);

            expect(dialogContent.querySelector('#capi-prop-type')).toBeTruthy();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // OPEN EDIT PARAM DIALOG
    // ═══════════════════════════════════════════════════════════

    describe('_openEditParamDialog', () => {
        const mockParam = {
            customapirequestparameterid: 'p1',
            uniquename: 'InputName',
            displayname: 'Input Name',
            description: 'Name input',
            isoptional: false
        };

        it('should call DialogService.show', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._openEditParamDialog(mockParam);

            expect(DialogService.show).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(HTMLElement)
            );
        });

        it('should populate with param values', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            let dialogContent;
            DialogService.show.mockImplementation((_title, content) => {
                dialogContent = content;
                return { close: vi.fn() };
            });

            tab._openEditParamDialog(mockParam);

            expect(dialogContent.querySelector('#capi-eparam-displayname').value).toBe('Input Name');
            expect(dialogContent.querySelector('#capi-eparam-description').value).toBe('Name input');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // HANDLE DELETE PARAM
    // ═══════════════════════════════════════════════════════════

    describe('_handleDeleteParam', () => {
        it('should show confirmation dialog', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._handleDeleteParam('p1', 'InputName');

            expect(showConfirmDialog).toHaveBeenCalled();
        });

        it('should call deleteRequestParameter on confirm', async () => {
            showConfirmDialog.mockResolvedValue(true);
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._handleDeleteParam('p1', 'InputName');

            expect(CustomApiService.deleteRequestParameter).toHaveBeenCalledWith('p1');
        });

        it('should not delete when cancelled', async () => {
            showConfirmDialog.mockResolvedValue(false);
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._handleDeleteParam('p1', 'InputName');

            expect(CustomApiService.deleteRequestParameter).not.toHaveBeenCalled();
        });

        it('should show success on delete', async () => {
            showConfirmDialog.mockResolvedValue(true);
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._handleDeleteParam('p1', 'InputName');

            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'success');
        });

        it('should show error on failure', async () => {
            showConfirmDialog.mockResolvedValue(true);
            CustomApiService.deleteRequestParameter.mockRejectedValue(new Error('fail'));
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._handleDeleteParam('p1', 'InputName');

            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // OPEN EDIT PROP DIALOG
    // ═══════════════════════════════════════════════════════════

    describe('_openEditPropDialog', () => {
        const mockProp = {
            customapiresponsepropertyid: 'r1',
            uniquename: 'OutputResult',
            displayname: 'Output Result',
            description: 'Result'
        };

        it('should call DialogService.show', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._openEditPropDialog(mockProp);

            expect(DialogService.show).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(HTMLElement)
            );
        });

        it('should populate with prop values', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            let dialogContent;
            DialogService.show.mockImplementation((_title, content) => {
                dialogContent = content;
                return { close: vi.fn() };
            });

            tab._openEditPropDialog(mockProp);

            expect(dialogContent.querySelector('#capi-eprop-displayname').value).toBe('Output Result');
            expect(dialogContent.querySelector('#capi-eprop-description').value).toBe('Result');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // HANDLE DELETE PROP
    // ═══════════════════════════════════════════════════════════

    describe('_handleDeleteProp', () => {
        it('should show confirmation dialog', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._handleDeleteProp('r1', 'OutputResult');

            expect(showConfirmDialog).toHaveBeenCalled();
        });

        it('should call deleteResponseProperty on confirm', async () => {
            showConfirmDialog.mockResolvedValue(true);
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._handleDeleteProp('r1', 'OutputResult');

            expect(CustomApiService.deleteResponseProperty).toHaveBeenCalledWith('r1');
        });

        it('should not delete when cancelled', async () => {
            showConfirmDialog.mockResolvedValue(false);
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._handleDeleteProp('r1', 'OutputResult');

            expect(CustomApiService.deleteResponseProperty).not.toHaveBeenCalled();
        });

        it('should show success on delete', async () => {
            showConfirmDialog.mockResolvedValue(true);
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._handleDeleteProp('r1', 'OutputResult');

            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'success');
        });

        it('should show error on failure', async () => {
            showConfirmDialog.mockResolvedValue(true);
            CustomApiService.deleteResponseProperty.mockRejectedValue(new Error('fail'));
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._handleDeleteProp('r1', 'OutputResult');

            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // HANDLE IMPORT
    // ═══════════════════════════════════════════════════════════

    describe('_handleImport', () => {
        it('should create a file input and trigger click', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

            tab._handleImport();

            expect(clickSpy).toHaveBeenCalled();
            clickSpy.mockRestore();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // POPULATE TESTER SELECT
    // ═══════════════════════════════════════════════════════════

    describe('_populateTesterSelect', () => {
        it('should populate dropdown with APIs', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.allApis = [...mockApis];
            tab._populateTesterSelect();

            const options = tab.ui.apiSelect.querySelectorAll('option');
            expect(options.length).toBe(3); // placeholder + 2 APIs
        });

        it('should show type prefix (ACT/FN)', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.allApis = [...mockApis];
            tab._populateTesterSelect();

            const opt1 = tab.ui.apiSelect.querySelector('option[value="api-001"]');
            expect(opt1.textContent).toContain('[ACT]');
            const opt2 = tab.ui.apiSelect.querySelector('option[value="api-002"]');
            expect(opt2.textContent).toContain('[FN]');
        });

        it('should not throw when apiSelect is null', async () => {
            tab = new CustomApiTab();
            tab.ui = { apiSelect: null };

            expect(() => tab._populateTesterSelect()).not.toThrow();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // BUILD PARAM INPUTS
    // ═══════════════════════════════════════════════════════════

    describe('_buildParamInputs', () => {
        it('should build text input for string type', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Name', type: 10, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            expect(input).toBeTruthy();
            expect(input.tagName).toBe('INPUT');
            expect(input.type).toBe('text');
        });

        it('should build select for boolean type', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Flag', type: 0, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const select = tab.ui.paramInputs.querySelector('.capi-param-value');
            expect(select.tagName).toBe('SELECT');
            expect(select.options.length).toBe(3); // —, true, false
        });

        it('should build datetime-local input for DateTime type', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Date', type: 1, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            expect(input.type).toBe('datetime-local');
        });

        it('should build textarea for Entity type', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Record', type: 3, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const textarea = tab.ui.paramInputs.querySelector('.capi-param-value');
            expect(textarea.tagName).toBe('TEXTAREA');
        });

        it('should build textarea for EntityCollection type', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Records', type: 4, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const textarea = tab.ui.paramInputs.querySelector('.capi-param-value');
            expect(textarea.tagName).toBe('TEXTAREA');
        });

        it('should build textarea for EntityReference type', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Ref', type: 5, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const textarea = tab.ui.paramInputs.querySelector('.capi-param-value');
            expect(textarea.tagName).toBe('TEXTAREA');
        });

        it('should show required marker for non-optional params', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Name', type: 10, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const label = tab.ui.paramInputs.querySelector('label');
            expect(label.textContent).toContain('*');
        });

        it('should not show required marker for optional params', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Name', type: 10, isoptional: true, description: '' }];
            tab._buildParamInputs(params);

            const label = tab.ui.paramInputs.querySelector('label');
            expect(label.textContent).not.toContain('*');
        });

        it('should not throw when paramInputs is null', async () => {
            tab = new CustomApiTab();
            tab.ui = { paramInputs: null };

            expect(() => tab._buildParamInputs([])).not.toThrow();
        });

        it('should handle multiple params', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [
                { uniquename: 'Name', type: 10, isoptional: false, description: '' },
                { uniquename: 'Flag', type: 0, isoptional: true, description: '' }
            ];
            tab._buildParamInputs(params);

            const inputs = tab.ui.paramInputs.querySelectorAll('.capi-param-value');
            expect(inputs).toHaveLength(2);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // COLLECT PARAM VALUES
    // ═══════════════════════════════════════════════════════════

    describe('_collectParamValues', () => {
        it('should collect values from param inputs', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Name', type: 10, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = 'test value';

            const values = tab._collectParamValues();
            expect(values.Name).toBe('test value');
        });

        it('should skip empty values', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Name', type: 10, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const values = tab._collectParamValues();
            expect(values.Name).toBeUndefined();
        });

        it('should return empty object when no inputs', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const values = tab._collectParamValues();
            expect(values).toEqual({});
        });
    });

    // ═══════════════════════════════════════════════════════════
    // UPDATE ENDPOINT PREVIEW
    // ═══════════════════════════════════════════════════════════

    describe('_updateEndpointPreview', () => {
        it('should update endpoint preview text', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.selectedApi = mockApis[0];
            CustomApiService.buildEndpointUrl.mockReturnValue('new_TestAction');

            tab._updateEndpointPreview();

            expect(tab.ui.endpointPreview.textContent).toBe('new_TestAction');
        });

        it('should not throw when selectedApi is null', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.selectedApi = null;
            expect(() => tab._updateEndpointPreview()).not.toThrow();
        });

        it('should pass targetId to buildEndpointUrl', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.selectedApi = mockApis[1];
            tab.ui.targetId.value = 'abc-123';
            CustomApiService.buildEndpointUrl.mockReturnValue('accounts(abc-123)/Microsoft.Dynamics.CRM.new_TestFunction');

            tab._updateEndpointPreview();

            expect(CustomApiService.buildEndpointUrl).toHaveBeenCalledWith(
                mockApis[1],
                'abc-123',
                expect.any(Object)
            );
        });
    });

    // ═══════════════════════════════════════════════════════════
    // COLLECT CUSTOM HEADERS
    // ═══════════════════════════════════════════════════════════

    describe('_collectCustomHeaders', () => {
        it('should collect headers from header rows', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            // Add a header row
            tab._addHeaderRow();
            const row = tab.ui.headersContainer.querySelector('.pdt-capi-header-row');
            row.querySelector('.capi-header-name').value = 'X-Custom';
            row.querySelector('.capi-header-value').value = 'test123';

            const headers = tab._collectCustomHeaders();
            expect(headers['X-Custom']).toBe('test123');
        });

        it('should collect multiple headers from multiple rows', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            // Set values on the initial row
            const initialRow = tab.ui.headersContainer.querySelector('.pdt-capi-header-row');
            initialRow.querySelector('.capi-header-name').value = 'X-First';
            initialRow.querySelector('.capi-header-value').value = 'value1';

            // Add second header row
            tab._addHeaderRow();
            const rows = tab.ui.headersContainer.querySelectorAll('.pdt-capi-header-row');
            const secondRow = rows[rows.length - 1];
            secondRow.querySelector('.capi-header-name').value = 'X-Second';
            secondRow.querySelector('.capi-header-value').value = 'value2';

            // Add third header row
            tab._addHeaderRow();
            const allRows = tab.ui.headersContainer.querySelectorAll('.pdt-capi-header-row');
            const thirdRow = allRows[allRows.length - 1];
            thirdRow.querySelector('.capi-header-name').value = 'MSCRM.SuppressDuplicateDetection';
            thirdRow.querySelector('.capi-header-value').value = 'true';

            const headers = tab._collectCustomHeaders();
            expect(Object.keys(headers)).toHaveLength(3);
            expect(headers['X-First']).toBe('value1');
            expect(headers['X-Second']).toBe('value2');
            expect(headers['MSCRM.SuppressDuplicateDetection']).toBe('true');
        });

        it('should skip rows with empty name or value', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._addHeaderRow();
            const row = tab.ui.headersContainer.querySelector('.pdt-capi-header-row');
            row.querySelector('.capi-header-name').value = 'X-Custom';
            row.querySelector('.capi-header-value').value = '';

            const headers = tab._collectCustomHeaders();
            expect(Object.keys(headers)).toHaveLength(0);
        });

        it('should return empty object when no rows', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const headers = tab._collectCustomHeaders();
            expect(headers).toEqual({});
        });
    });

    // ═══════════════════════════════════════════════════════════
    // ADD HEADER ROW
    // ═══════════════════════════════════════════════════════════

    describe('_addHeaderRow', () => {
        it('should add a header row to the container', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const initialCount = tab.ui.headersContainer.querySelectorAll('.pdt-capi-header-row').length;
            tab._addHeaderRow();

            const rows = tab.ui.headersContainer.querySelectorAll('.pdt-capi-header-row');
            expect(rows).toHaveLength(initialCount + 1);
        });

        it('should add multiple rows', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const initialCount = tab.ui.headersContainer.querySelectorAll('.pdt-capi-header-row').length;
            tab._addHeaderRow();
            tab._addHeaderRow();

            const rows = tab.ui.headersContainer.querySelectorAll('.pdt-capi-header-row');
            expect(rows).toHaveLength(initialCount + 2);
        });

        it('should contain name and value inputs', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._addHeaderRow();

            const row = tab.ui.headersContainer.querySelector('.pdt-capi-header-row');
            expect(row.querySelector('.capi-header-name')).toBeTruthy();
            expect(row.querySelector('.capi-header-value')).toBeTruthy();
        });

        it('should contain a remove button', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._addHeaderRow();

            const row = tab.ui.headersContainer.querySelector('.pdt-capi-header-row');
            expect(row.querySelector('.capi-remove-header-btn')).toBeTruthy();
        });

        it('should not throw when headersContainer is null', async () => {
            tab = new CustomApiTab();
            tab.ui = { headersContainer: null };

            expect(() => tab._addHeaderRow()).not.toThrow();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // DISPLAY RESPONSE
    // ═══════════════════════════════════════════════════════════

    describe('_displayResponse', () => {
        it('should show response panel', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._displayResponse({ status: 200, statusText: 'OK', body: { result: 'ok' }, headers: {}, duration: 50, size: 100 });

            expect(tab.ui.responsePanel.style.display).not.toBe('none');
        });

        it('should show success status class for 2xx', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._displayResponse({ status: 200, statusText: 'OK', body: {}, headers: {}, duration: 50, size: 10 });

            expect(tab.ui.responseStatus.innerHTML).toContain('pdt-capi-status-success');
        });

        it('should show error status class for 4xx', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._displayResponse({ status: 400, statusText: 'Bad Request', body: {}, headers: {}, duration: 50, size: 10 });

            expect(tab.ui.responseStatus.innerHTML).toContain('pdt-capi-status-error');
        });

        it('should show warn status class for 3xx', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._displayResponse({ status: 301, statusText: 'Moved', body: {}, headers: {}, duration: 50, size: 10 });

            expect(tab.ui.responseStatus.innerHTML).toContain('pdt-capi-status-warn');
        });

        it('should display duration and size', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._displayResponse({ status: 200, statusText: 'OK', body: {}, headers: {}, duration: 123, size: 456 });

            expect(tab.ui.responseTime.textContent).toBe('123ms');
            expect(tab.ui.responseSize.textContent).toBe('456 B');
        });

        it('should show empty response text when body is null', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._displayResponse({ status: 200, statusText: 'OK', body: null, headers: {}, duration: 50, size: 0 });

            expect(tab.ui.responseJson.textContent).toBe('(empty response)');
        });

        it('should not throw when responsePanel is null', async () => {
            tab = new CustomApiTab();
            tab.ui = { responsePanel: null };

            expect(() => tab._displayResponse({ status: 200, statusText: 'OK', body: {}, headers: {}, duration: 0, size: 0 })).not.toThrow();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // UPDATE CODE OUTPUT
    // ═══════════════════════════════════════════════════════════

    describe('_updateCodeOutput', () => {
        it('should update code output with generated snippet', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.selectedApi = mockApis[0];
            CustomApiService.generateCodeSnippet.mockReturnValue('// generated code');

            tab._updateCodeOutput('javascript');

            expect(tab.ui.codeOutput.value).toBe('// generated code');
        });

        it('should not crash when selectedApi is null', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.selectedApi = null;
            expect(() => tab._updateCodeOutput('javascript')).not.toThrow();
        });

        it('should not crash when codeOutput is null', async () => {
            tab = new CustomApiTab();
            tab.ui = { codeOutput: null };
            tab.selectedApi = mockApis[0];

            expect(() => tab._updateCodeOutput('javascript')).not.toThrow();
        });

        it('should pass targetId to generateCodeSnippet', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.selectedApi = mockApis[0];
            tab.ui.targetId.value = 'target-id';

            tab._updateCodeOutput('csharp');

            expect(CustomApiService.generateCodeSnippet).toHaveBeenCalledWith(
                mockApis[0],
                expect.any(Object),
                'csharp',
                'target-id'
            );
        });
    });

    // ═══════════════════════════════════════════════════════════
    // ADD TO HISTORY
    // ═══════════════════════════════════════════════════════════

    describe('_addToHistory', () => {
        it('should add entry to executionHistory', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const result = { status: 200, statusText: 'OK', body: {}, headers: {}, duration: 50, size: 10 };
            tab._addToHistory(mockApis[0], {}, result);

            expect(tab.executionHistory).toHaveLength(1);
            expect(tab.executionHistory[0].apiName).toBe('new_TestAction');
            expect(tab.executionHistory[0].method).toBe('POST');
        });

        it('should prepend new entries (most recent first)', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const result1 = { status: 200, statusText: 'OK', body: {}, headers: {}, duration: 50, size: 10 };
            const result2 = { status: 201, statusText: 'Created', body: {}, headers: {}, duration: 30, size: 5 };
            tab._addToHistory(mockApis[0], {}, result1);
            tab._addToHistory(mockApis[1], {}, result2);

            expect(tab.executionHistory[0].status).toBe(201);
        });

        it('should limit history to 20 entries', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const result = { status: 200, statusText: 'OK', body: {}, headers: {}, duration: 50, size: 10 };
            for (let i = 0; i < 25; i++) {
                tab._addToHistory(mockApis[0], {}, result);
            }

            expect(tab.executionHistory).toHaveLength(20);
        });

        it('should set method to GET for functions', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const result = { status: 200, statusText: 'OK', body: {}, headers: {}, duration: 50, size: 10 };
            tab._addToHistory(mockApis[1], {}, result);

            expect(tab.executionHistory[0].method).toBe('GET');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // RENDER HISTORY
    // ═══════════════════════════════════════════════════════════

    describe('_renderHistory', () => {
        it('should show history panel when entries exist', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.executionHistory = [{ timestamp: '10:00', apiName: 'test', method: 'POST', status: 200, statusText: 'OK', duration: 50, size: 10 }];
            tab._renderHistory();

            expect(tab.ui.historyPanel.style.display).not.toBe('none');
        });

        it('should hide history panel when empty', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.executionHistory = [];
            tab._renderHistory();

            expect(tab.ui.historyPanel.style.display).toBe('none');
        });

        it('should render history entries', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.executionHistory = [
                { timestamp: '10:00', apiName: 'API1', method: 'POST', status: 200, statusText: 'OK', duration: 50, size: 10 },
                { timestamp: '10:01', apiName: 'API2', method: 'GET', status: 404, statusText: 'Not Found', duration: 100, size: 20 }
            ];
            tab._renderHistory();

            const entries = tab.ui.historyList.querySelectorAll('.pdt-capi-history-entry');
            expect(entries).toHaveLength(2);
        });

        it('should show success status for 2xx', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.executionHistory = [{ timestamp: '10:00', apiName: 'test', method: 'POST', status: 200, statusText: 'OK', duration: 50, size: 10 }];
            tab._renderHistory();

            expect(tab.ui.historyList.innerHTML).toContain('pdt-capi-status-success');
        });

        it('should show error status for 4xx+', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.executionHistory = [{ timestamp: '10:00', apiName: 'test', method: 'POST', status: 500, statusText: 'Error', duration: 50, size: 10 }];
            tab._renderHistory();

            expect(tab.ui.historyList.innerHTML).toContain('pdt-capi-status-error');
        });

        it('should not throw when historyPanel is null', async () => {
            tab = new CustomApiTab();
            tab.ui = { historyPanel: null };

            tab.executionHistory = [];
            expect(() => tab._renderHistory()).not.toThrow();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // SHOW HISTORY DETAIL
    // ═══════════════════════════════════════════════════════════

    describe('_showHistoryDetail', () => {
        it('should not throw for invalid index', async () => {
            tab = new CustomApiTab();
            tab.executionHistory = [];

            expect(() => tab._showHistoryDetail(99)).not.toThrow();
        });

        it('should call DialogService.show for valid entry', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.executionHistory = [{
                timestamp: '10:00', apiName: 'test', method: 'POST',
                status: 200, statusText: 'OK', duration: 50, size: 10,
                paramValues: {}, body: { result: 'ok' }, headers: { 'content-type': 'application/json' }
            }];

            tab._showHistoryDetail(0);

            expect(DialogService.show).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(HTMLElement)
            );
        });

        it('should show (empty response) when body is null', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            let dialogContent;
            DialogService.show.mockImplementation((_title, content) => {
                dialogContent = content;
                return { close: vi.fn() };
            });

            tab.executionHistory = [{
                timestamp: '10:00', apiName: 'test', method: 'POST',
                status: 200, statusText: 'OK', duration: 50, size: 10,
                paramValues: {}, body: null, headers: {}
            }];

            tab._showHistoryDetail(0);

            expect(dialogContent.innerHTML).toContain('(empty response)');
        });

        it('should show (none) when paramValues is empty', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            let dialogContent;
            DialogService.show.mockImplementation((_title, content) => {
                dialogContent = content;
                return { close: vi.fn() };
            });

            tab.executionHistory = [{
                timestamp: '10:00', apiName: 'test', method: 'POST',
                status: 200, statusText: 'OK', duration: 50, size: 10,
                paramValues: {}, body: {}, headers: {}
            }];

            tab._showHistoryDetail(0);

            expect(dialogContent.innerHTML).toContain('(none)');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // REFRESH DATA
    // ═══════════════════════════════════════════════════════════

    describe('_refreshData', () => {
        it('should fetchAll when no solution is selected', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            vi.clearAllMocks();
            CustomApiService.fetchAll.mockResolvedValue([...mockApis]);

            tab.selectedSolutionId = '';
            await tab._refreshData();

            expect(CustomApiService.fetchAll).toHaveBeenCalled();
            expect(tab.allApis).toHaveLength(2);
        });

        it('should fetchBySolution when solution is selected', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            vi.clearAllMocks();
            CustomApiService.fetchBySolution.mockResolvedValue([mockApis[0]]);

            tab.selectedSolutionId = 'sol-1';
            await tab._refreshData();

            expect(CustomApiService.fetchBySolution).toHaveBeenCalledWith('sol-1');
            expect(tab.allApis).toHaveLength(1);
        });

        it('should re-render browser after fetch', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const spy = vi.spyOn(tab, '_renderBrowser');
            CustomApiService.fetchAll.mockResolvedValue([...mockApis]);

            tab.selectedSolutionId = '';
            await tab._refreshData();

            expect(spy).toHaveBeenCalled();
        });

        it('should repopulate tester select', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const spy = vi.spyOn(tab, '_populateTesterSelect');
            CustomApiService.fetchAll.mockResolvedValue([...mockApis]);

            tab.selectedSolutionId = '';
            await tab._refreshData();

            expect(spy).toHaveBeenCalled();
        });

        it('should show error notification on failure', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            vi.clearAllMocks();
            CustomApiService.fetchAll.mockRejectedValue(new Error('Network fail'));

            tab.selectedSolutionId = '';
            await tab._refreshData();

            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // BROWSER CLICK - ADDITIONAL DELEGATED ACTIONS
    // ═══════════════════════════════════════════════════════════

    describe('_handleBrowserClick - delegated actions', () => {
        it('should handle delete button click', async () => {
            showConfirmDialog.mockResolvedValue(true);
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            const deleteSpy = vi.spyOn(tab, '_handleDelete');
            const deleteBtn = element.querySelector('.capi-delete-btn');
            deleteBtn.click();

            expect(deleteSpy).toHaveBeenCalled();
        });

        it('should handle edit button click', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            const editSpy = vi.spyOn(tab, '_openEditDialog').mockImplementation(() => {});
            const editBtn = element.querySelector('.capi-edit-btn');
            editBtn.click();

            expect(editSpy).toHaveBeenCalled();
        });

        it('should handle export button click', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            const exportSpy = vi.spyOn(tab, '_handleExport').mockImplementation(() => {});
            const exportBtn = element.querySelector('.capi-export-btn');
            exportBtn.click();

            expect(exportSpy).toHaveBeenCalled();
        });

        it('should handle add-param button click', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            // Expand a card first to reveal add-param button
            const card = element.querySelector('.pdt-capi-card');
            const expandBtn = card.querySelector('.capi-expand-btn');
            tab._toggleExpand(card, expandBtn);

            const addParamSpy = vi.spyOn(tab, '_openAddParamDialog').mockImplementation(() => {});
            const addParamBtn = card.querySelector('.capi-add-param-btn');
            if (addParamBtn) {
                addParamBtn.click();
                expect(addParamSpy).toHaveBeenCalled();
            }
        });

        it('should handle add-prop button click', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            // Expand a card first
            const card = element.querySelector('.pdt-capi-card');
            const expandBtn = card.querySelector('.capi-expand-btn');
            tab._toggleExpand(card, expandBtn);

            const addPropSpy = vi.spyOn(tab, '_openAddPropDialog').mockImplementation(() => {});
            const addPropBtn = card.querySelector('.capi-add-prop-btn');
            if (addPropBtn) {
                addPropBtn.click();
                expect(addPropSpy).toHaveBeenCalled();
            }
        });

        it('should handle edit-param button click', async () => {
            CustomApiService.fetchById.mockResolvedValue(mockApis[0]);
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            // Expand card to see param buttons
            const card = element.querySelector('.pdt-capi-card');
            const expandBtn = card.querySelector('.capi-expand-btn');
            tab._toggleExpand(card, expandBtn);

            const editParamSpy = vi.spyOn(tab, '_openEditParamDialog').mockImplementation(() => {});
            const editParamBtn = card.querySelector('.capi-edit-param-btn');
            if (editParamBtn) {
                editParamBtn.click();
                // Wait for the async fetchById
                await vi.waitFor(() => expect(editParamSpy).toHaveBeenCalled());
            }
        });

        it('should handle delete-param button click', async () => {
            showConfirmDialog.mockResolvedValue(true);
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            // Expand card
            const card = element.querySelector('.pdt-capi-card');
            const expandBtn = card.querySelector('.capi-expand-btn');
            tab._toggleExpand(card, expandBtn);

            const deleteParamSpy = vi.spyOn(tab, '_handleDeleteParam').mockImplementation(async () => {});
            const deleteParamBtn = card.querySelector('.capi-delete-param-btn');
            if (deleteParamBtn) {
                deleteParamBtn.click();
                expect(deleteParamSpy).toHaveBeenCalled();
            }
        });

        it('should handle edit-prop button click', async () => {
            CustomApiService.fetchById.mockResolvedValue(mockApis[0]);
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            // Expand card to see prop buttons
            const card = element.querySelector('.pdt-capi-card');
            const expandBtn = card.querySelector('.capi-expand-btn');
            tab._toggleExpand(card, expandBtn);

            const spy = vi.spyOn(tab, '_openEditPropDialog').mockImplementation(() => {});
            const editPropBtn = card.querySelector('.capi-edit-prop-btn');
            if (editPropBtn) {
                editPropBtn.click();
                await vi.waitFor(() => expect(spy).toHaveBeenCalled());
            }
        });

        it('should handle delete-prop button click', async () => {
            showConfirmDialog.mockResolvedValue(true);
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);
            tab.allApis = [...mockApis];
            tab._renderBrowser();

            // Expand card
            const card = element.querySelector('.pdt-capi-card');
            const expandBtn = card.querySelector('.capi-expand-btn');
            tab._toggleExpand(card, expandBtn);

            const spy = vi.spyOn(tab, '_handleDeleteProp').mockImplementation(async () => {});
            const deletePropBtn = card.querySelector('.capi-delete-prop-btn');
            if (deletePropBtn) {
                deletePropBtn.click();
                expect(spy).toHaveBeenCalled();
            }
        });
    });

    // ═══════════════════════════════════════════════════════════
    // POSTRENDER HANDLERS (INNER CALLBACKS)
    // ═══════════════════════════════════════════════════════════

    describe('postRender handlers', () => {
        it('should handle view toggle click', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const testerTab = element.querySelector('#capi-tab-tester');
            testerTab.click();

            expect(tab.activeView).toBe('tester');
        });

        it('should handle code tab click', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.selectedApi = mockApis[0];
            const codeTab = element.querySelector('.pdt-capi-code-tab[data-lang="csharp"]');
            if (codeTab) {
                codeTab.click();
                expect(CustomApiService.generateCodeSnippet).toHaveBeenCalledWith(
                    mockApis[0], expect.any(Object), 'csharp', expect.any(String)
                );
            }
        });

        it('should handle copy code button click', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.selectedApi = mockApis[0];
            tab.ui.codeOutput.value = '// test code';
            const copyBtn = element.querySelector('#capi-copy-code-btn');
            copyBtn?.click();

            expect(copyToClipboard).toHaveBeenCalledWith('// test code', expect.any(String));
        });

        it('should handle history entry click', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            // Add a history entry and render
            tab.executionHistory = [{
                timestamp: '10:00', apiName: 'test', method: 'POST',
                status: 200, statusText: 'OK', duration: 50, size: 10,
                paramValues: {}, body: {}, headers: {}
            }];
            tab._renderHistory();

            const spy = vi.spyOn(tab, '_showHistoryDetail').mockImplementation(() => {});
            const entry = tab.ui.historyList.querySelector('.pdt-capi-history-entry');
            entry?.click();

            expect(spy).toHaveBeenCalledWith(0);
        });

        it('should handle add header button click', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const initialCount = tab.ui.headersContainer.querySelectorAll('.pdt-capi-header-row').length;
            const addHeaderBtn = element.querySelector('#capi-add-header-btn');
            addHeaderBtn?.click();

            const newCount = tab.ui.headersContainer.querySelectorAll('.pdt-capi-header-row').length;
            expect(newCount).toBe(initialCount + 1);
        });

        it('should handle remove header button click', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            // Add an extra row so removal works (must have >1 row)
            tab._addHeaderRow();
            const rows = tab.ui.headersContainer.querySelectorAll('.pdt-capi-header-row');
            const countBefore = rows.length;

            const removeBtn = tab.ui.headersContainer.querySelector('.capi-remove-header-btn');
            removeBtn?.click();

            const countAfter = tab.ui.headersContainer.querySelectorAll('.pdt-capi-header-row').length;
            expect(countAfter).toBe(countBefore - 1);
        });

        it('should clear inputs on last header row remove attempt', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            // Ensure only 1 row
            while (tab.ui.headersContainer.querySelectorAll('.pdt-capi-header-row').length > 1) {
                tab.ui.headersContainer.querySelector('.pdt-capi-header-row').remove();
            }

            const row = tab.ui.headersContainer.querySelector('.pdt-capi-header-row');
            row.querySelector('.capi-header-name').value = 'X-Test';
            row.querySelector('.capi-header-value').value = 'val';

            const removeBtn = row.querySelector('.capi-remove-header-btn');
            removeBtn?.click();

            // Row should still exist but inputs cleared
            expect(tab.ui.headersContainer.querySelectorAll('.pdt-capi-header-row').length).toBe(1);
            expect(row.querySelector('.capi-header-name').value).toBe('');
            expect(row.querySelector('.capi-header-value').value).toBe('');
        });

        it('should handle response tab click', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const headersTab = element.querySelector('.pdt-capi-resp-tab[data-panel="headers"]');
            headersTab?.click();

            const headersPanel = element.querySelector('#capi-response-headers');
            expect(headersPanel?.style.display).not.toBe('none');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // DIALOG INNER SAVE HANDLERS
    // ═══════════════════════════════════════════════════════════

    describe('dialog inner save/create handlers', () => {
        it('_openEditDialog save button should call update', async () => {
            // Make DialogService.show attach content to DOM so querySelector works
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._openEditDialog(mockApis[0]);

            // Find the save button created by _openEditDialog
            const saveBtn = document.querySelector('.pdt-dialog-footer .modern-button');
            expect(saveBtn).toBeTruthy();

            // Modify a field to enable save
            const displayInput = document.querySelector('#capi-edit-displayname');
            displayInput.value = 'Changed Name';
            displayInput.dispatchEvent(new Event('input'));

            // Save should now be enabled
            expect(saveBtn.disabled).toBe(false);

            CustomApiService.update.mockResolvedValue({});
            CustomApiService.fetchAll.mockResolvedValue([...mockApis]);
            saveBtn.click();

            await vi.waitFor(() => {
                expect(CustomApiService.update).toHaveBeenCalledWith('api-001', expect.objectContaining({
                    displayname: 'Changed Name'
                }));
            });
        });

        it('_openEditDialog save should handle error', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._openEditDialog(mockApis[0]);

            const saveBtn = document.querySelector('.pdt-dialog-footer .modern-button');
            const displayInput = document.querySelector('#capi-edit-displayname');
            displayInput.value = 'Changed';
            displayInput.dispatchEvent(new Event('input'));

            CustomApiService.update.mockRejectedValue(new Error('Update failed'));
            saveBtn.click();

            await vi.waitFor(() => {
                expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
            });
        });

        it('_openAddParamDialog create button should add param', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._openAddParamDialog(mockApis[0]);

            const createBtn = document.querySelector('.pdt-dialog-footer .modern-button');
            // Fill required fields
            document.querySelector('#capi-param-uniquename').value = 'NewParam';
            document.querySelector('#capi-param-uniquename').dispatchEvent(new Event('input'));

            CustomApiService.addRequestParameter.mockResolvedValue({});
            CustomApiService.fetchAll.mockResolvedValue([...mockApis]);
            createBtn.click();

            await vi.waitFor(() => {
                expect(CustomApiService.addRequestParameter).toHaveBeenCalled();
            });
        });

        it('_openAddParamDialog create button should show error on failure', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._openAddParamDialog(mockApis[0]);

            const createBtn = document.querySelector('.pdt-dialog-footer .modern-button');
            document.querySelector('#capi-param-uniquename').value = 'NewParam';
            document.querySelector('#capi-param-uniquename').dispatchEvent(new Event('input'));

            CustomApiService.addRequestParameter.mockRejectedValue(new Error('fail'));
            createBtn.click();

            await vi.waitFor(() => {
                expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
            });
        });

        it('_openAddParamDialog create button should show error when uniquename empty', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._openAddParamDialog(mockApis[0]);

            // Override the revalidate to enable create button without value
            const createBtn = document.querySelector('.pdt-dialog-footer .modern-button');
            createBtn.disabled = false;

            // Leave uniquename empty
            document.querySelector('#capi-param-uniquename').value = '';
            createBtn.click();

            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
        });

        it('_openAddPropDialog create button should add prop', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._openAddPropDialog(mockApis[0]);

            const createBtn = document.querySelector('.pdt-dialog-footer .modern-button');
            document.querySelector('#capi-prop-uniquename').value = 'NewProp';
            document.querySelector('#capi-prop-uniquename').dispatchEvent(new Event('input'));

            CustomApiService.addResponseProperty.mockResolvedValue({});
            CustomApiService.fetchAll.mockResolvedValue([...mockApis]);
            createBtn.click();

            await vi.waitFor(() => {
                expect(CustomApiService.addResponseProperty).toHaveBeenCalled();
            });
        });

        it('_openAddPropDialog create button should show error on failure', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._openAddPropDialog(mockApis[0]);

            const createBtn = document.querySelector('.pdt-dialog-footer .modern-button');
            document.querySelector('#capi-prop-uniquename').value = 'NewProp';
            document.querySelector('#capi-prop-uniquename').dispatchEvent(new Event('input'));

            CustomApiService.addResponseProperty.mockRejectedValue(new Error('fail'));
            createBtn.click();

            await vi.waitFor(() => {
                expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
            });
        });

        it('_openAddPropDialog create button should show error when uniquename empty', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._openAddPropDialog(mockApis[0]);

            const createBtn = document.querySelector('.pdt-dialog-footer .modern-button');
            createBtn.disabled = false;
            document.querySelector('#capi-prop-uniquename').value = '';
            createBtn.click();

            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
        });

        it('_openEditParamDialog save button should update param', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const param = { customapirequestparameterid: 'p1', uniquename: 'InputName', displayname: 'Input Name', description: 'Desc', isoptional: false };
            tab._openEditParamDialog(param);

            const saveBtn = document.querySelector('.pdt-dialog-footer .modern-button');
            document.querySelector('#capi-eparam-displayname').value = 'Changed';
            document.querySelector('#capi-eparam-displayname').dispatchEvent(new Event('input'));

            CustomApiService.updateRequestParameter.mockResolvedValue({});
            CustomApiService.fetchAll.mockResolvedValue([...mockApis]);
            saveBtn.click();

            await vi.waitFor(() => {
                expect(CustomApiService.updateRequestParameter).toHaveBeenCalledWith('p1', expect.objectContaining({
                    displayname: 'Changed'
                }));
            });
        });

        it('_openEditParamDialog save should handle error', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const param = { customapirequestparameterid: 'p1', uniquename: 'InputName', displayname: 'Input Name', description: 'Desc', isoptional: false };
            tab._openEditParamDialog(param);

            const saveBtn = document.querySelector('.pdt-dialog-footer .modern-button');
            document.querySelector('#capi-eparam-displayname').value = 'Changed';
            document.querySelector('#capi-eparam-displayname').dispatchEvent(new Event('input'));

            CustomApiService.updateRequestParameter.mockRejectedValue(new Error('fail'));
            saveBtn.click();

            await vi.waitFor(() => {
                expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
            });
        });

        it('_openEditPropDialog save button should update prop', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const prop = { customapiresponsepropertyid: 'r1', uniquename: 'OutputResult', displayname: 'Output Result', description: 'Result' };
            tab._openEditPropDialog(prop);

            const saveBtn = document.querySelector('.pdt-dialog-footer .modern-button');
            document.querySelector('#capi-eprop-displayname').value = 'Changed';
            document.querySelector('#capi-eprop-displayname').dispatchEvent(new Event('input'));

            CustomApiService.updateResponseProperty.mockResolvedValue({});
            CustomApiService.fetchAll.mockResolvedValue([...mockApis]);
            saveBtn.click();

            await vi.waitFor(() => {
                expect(CustomApiService.updateResponseProperty).toHaveBeenCalledWith('r1', expect.objectContaining({
                    displayname: 'Changed'
                }));
            });
        });

        it('_openEditPropDialog save should handle error', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const prop = { customapiresponsepropertyid: 'r1', uniquename: 'OutputResult', displayname: 'Output Result', description: 'Result' };
            tab._openEditPropDialog(prop);

            const saveBtn = document.querySelector('.pdt-dialog-footer .modern-button');
            document.querySelector('#capi-eprop-displayname').value = 'Changed';
            document.querySelector('#capi-eprop-displayname').dispatchEvent(new Event('input'));

            CustomApiService.updateResponseProperty.mockRejectedValue(new Error('fail'));
            saveBtn.click();

            await vi.waitFor(() => {
                expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
            });
        });
    });

    // ═══════════════════════════════════════════════════════════
    // JSON VALIDATION IN BUILD PARAM INPUTS
    // ═══════════════════════════════════════════════════════════

    describe('_buildParamInputs JSON validation', () => {
        it('should show error for invalid JSON in entity param', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Record', type: 3, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const textarea = tab.ui.paramInputs.querySelector('.capi-param-value');
            textarea.value = '{invalid json}';
            textarea.dispatchEvent(new Event('input'));

            expect(textarea.classList.contains('pdt-input-error')).toBe(true);
            const errorMsg = tab.ui.paramInputs.querySelector('.pdt-capi-json-error');
            expect(errorMsg.style.display).not.toBe('none');
            expect(tab.ui.executeBtn.disabled).toBe(true);
        });

        it('should clear error for valid JSON in entity param', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Record', type: 3, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const textarea = tab.ui.paramInputs.querySelector('.capi-param-value');

            // First set invalid
            textarea.value = '{invalid}';
            textarea.dispatchEvent(new Event('input'));

            // Then set valid
            textarea.value = '{"key": "value"}';
            textarea.dispatchEvent(new Event('input'));

            expect(textarea.classList.contains('pdt-input-error')).toBe(false);
            const errorMsg = tab.ui.paramInputs.querySelector('.pdt-capi-json-error');
            expect(errorMsg.style.display).toBe('none');
            expect(tab.ui.executeBtn.disabled).toBe(false);
        });

        it('should clear error when entity param is emptied', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Record', type: 3, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const textarea = tab.ui.paramInputs.querySelector('.capi-param-value');
            textarea.value = '{invalid}';
            textarea.dispatchEvent(new Event('input'));

            textarea.value = '';
            textarea.dispatchEvent(new Event('input'));

            expect(textarea.classList.contains('pdt-input-error')).toBe(false);
            expect(tab.ui.executeBtn.disabled).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // PARAMETER TYPE VALIDATION
    // ═══════════════════════════════════════════════════════════

    describe('_buildParamInputs type validation', () => {
        // --- Integer/Picklist validation ---
        it('should build validated input for Integer type', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Count', type: 7, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            expect(input).toBeTruthy();
            expect(input.tagName).toBe('INPUT');
        });

        it('should show error for non-integer value in Integer param', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Count', type: 7, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = 'abc';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(true);
            const errorMsg = tab.ui.paramInputs.querySelector('.pdt-capi-json-error');
            expect(errorMsg.style.display).not.toBe('none');
            expect(tab.ui.executeBtn.disabled).toBe(true);
        });

        it('should accept valid integer value', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Count', type: 7, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = '42';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(false);
            expect(tab.ui.executeBtn.disabled).toBe(false);
        });

        it('should accept negative integer value', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Count', type: 7, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = '-5';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(false);
            expect(tab.ui.executeBtn.disabled).toBe(false);
        });

        it('should reject decimal value for Integer param', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Count', type: 7, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = '3.14';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(true);
            expect(tab.ui.executeBtn.disabled).toBe(true);
        });

        it('should build validated input for Picklist type', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Status', type: 9, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = '100000001';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(false);
        });

        // --- Decimal/Float/Money validation ---
        it('should show error for non-numeric value in Decimal param', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Amount', type: 2, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = 'abc';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(true);
            expect(tab.ui.executeBtn.disabled).toBe(true);
        });

        it('should accept valid decimal value', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Amount', type: 2, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = '3.14';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(false);
            expect(tab.ui.executeBtn.disabled).toBe(false);
        });

        it('should accept whole number for Decimal param', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Amount', type: 2, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = '42';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(false);
        });

        it('should accept negative decimal value', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Amount', type: 6, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = '-99.5';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(false);
        });

        it('should validate Float type same as Decimal', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Rate', type: 6, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = 'not-a-number';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(true);
        });

        it('should validate Money type same as Decimal', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Price', type: 8, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = '100.50';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(false);
        });

        // --- Guid validation ---
        it('should show error for invalid GUID', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'RecordId', type: 12, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = 'not-a-guid';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(true);
            expect(tab.ui.executeBtn.disabled).toBe(true);
        });

        it('should accept valid GUID with dashes', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'RecordId', type: 12, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = '00000000-0000-0000-0000-000000000001';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(false);
            expect(tab.ui.executeBtn.disabled).toBe(false);
        });

        it('should accept GUID with braces', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'RecordId', type: 12, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = '{00000000-0000-0000-0000-000000000001}';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(false);
        });

        // --- StringArray validation ---
        it('should build validated input for StringArray type', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Tags', type: 11, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            expect(input).toBeTruthy();
            expect(input.tagName).toBe('INPUT');
        });

        it('should accept comma-separated values for StringArray', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Tags', type: 11, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = 'a, b, c';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(false);
            expect(tab.ui.executeBtn.disabled).toBe(false);
        });

        it('should accept single value for StringArray', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Tags', type: 11, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = 'a';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(false);
        });

        it('should accept valid JSON array for StringArray', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Tags', type: 11, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = '["a","b"]';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(false);
        });

        it('should show error for invalid JSON array in StringArray', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Tags', type: 11, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = '[invalid';
            input.dispatchEvent(new Event('input'));

            expect(input.classList.contains('pdt-input-error')).toBe(true);
            expect(tab.ui.executeBtn.disabled).toBe(true);
        });

        // --- Clear validation on empty ---
        it('should clear validation error when input is emptied', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const params = [{ uniquename: 'Count', type: 7, isoptional: false, description: '' }];
            tab._buildParamInputs(params);

            const input = tab.ui.paramInputs.querySelector('.capi-param-value');
            input.value = 'abc';
            input.dispatchEvent(new Event('input'));
            expect(input.classList.contains('pdt-input-error')).toBe(true);

            input.value = '';
            input.dispatchEvent(new Event('input'));
            expect(input.classList.contains('pdt-input-error')).toBe(false);
            expect(tab.ui.executeBtn.disabled).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // _createValidatedParamInput
    // ═══════════════════════════════════════════════════════════

    describe('_createValidatedParamInput', () => {
        it('should return a wrapper div with input and error div', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const wrapper = tab._createValidatedParamInput(
                { uniquename: 'Test', type: 7 },
                'placeholder text',
                { validate: () => true, getError: () => 'error' }
            );

            expect(wrapper.tagName).toBe('DIV');
            expect(wrapper.querySelector('.capi-param-value')).toBeTruthy();
            expect(wrapper.querySelector('.pdt-capi-json-error')).toBeTruthy();
        });

        it('should set correct dataset and placeholder', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const wrapper = tab._createValidatedParamInput(
                { uniquename: 'MyParam', type: 7 },
                'Enter number',
                { validate: () => true, getError: () => 'err' }
            );

            const input = wrapper.querySelector('.capi-param-value');
            expect(input.dataset.paramName).toBe('MyParam');
            expect(input.placeholder).toBe('Enter number');
        });

        it('should disable execute button on validation failure', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const wrapper = tab._createValidatedParamInput(
                { uniquename: 'Num' },
                '',
                { validate: () => false, getError: (name) => `Invalid ${name}` }
            );

            const input = wrapper.querySelector('.capi-param-value');
            input.value = 'bad';
            input.dispatchEvent(new Event('input'));

            expect(tab.ui.executeBtn.disabled).toBe(true);
            const error = wrapper.querySelector('.pdt-capi-json-error');
            expect(error.textContent).toBe('Invalid Num');
            expect(error.style.display).not.toBe('none');
        });

        it('should enable execute button on validation success', async () => {
            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            const wrapper = tab._createValidatedParamInput(
                { uniquename: 'Num' },
                '',
                { validate: () => true, getError: () => 'err' }
            );

            const input = wrapper.querySelector('.capi-param-value');
            input.value = '42';
            input.dispatchEvent(new Event('input'));

            expect(tab.ui.executeBtn.disabled).toBe(false);
            const error = wrapper.querySelector('.pdt-capi-json-error');
            expect(error.style.display).toBe('none');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // SHOW HISTORY DETAIL - EXPORT BUTTON
    // ═══════════════════════════════════════════════════════════

    describe('_showHistoryDetail export', () => {
        it('should create export button that triggers download', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            const createObjectURL = vi.fn().mockReturnValue('blob:url');
            const revokeObjectURL = vi.fn();
            vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab.executionHistory = [{
                timestamp: '10:00:00', apiName: 'test_api', method: 'POST',
                status: 200, statusText: 'OK', duration: 50, size: 10,
                paramValues: { Name: 'test' }, body: { result: 'ok' }, headers: { 'content-type': 'application/json' }
            }];

            tab._showHistoryDetail(0);

            // Find and click the export button
            const exportBtn = document.querySelector('.pdt-dialog-footer .modern-button.secondary');
            expect(exportBtn).toBeTruthy();
            exportBtn.click();

            expect(createObjectURL).toHaveBeenCalled();
            expect(revokeObjectURL).toHaveBeenCalled();
            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'success');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // OPEN CREATE DIALOG - INNER INTERACTIONS
    // ═══════════════════════════════════════════════════════════

    describe('_openCreateDialog inner interactions', () => {
        it('should auto-generate name from uniquename', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._openCreateDialog();

            const uniquenameInput = document.querySelector('#capi-new-uniquename');
            const nameInput = document.querySelector('#capi-new-name');

            uniquenameInput.value = 'new_MyApi';
            uniquenameInput.dispatchEvent(new Event('input'));

            expect(nameInput.value).toBe('new_MyApi');
        });

        it('should enable create button when required fields are filled', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._openCreateDialog();

            const createBtn = document.querySelector('.pdt-dialog-footer .modern-button');
            expect(createBtn.disabled).toBe(true);

            document.querySelector('#capi-new-uniquename').value = 'new_Api';
            document.querySelector('#capi-new-uniquename').dispatchEvent(new Event('input'));
            document.querySelector('#capi-new-displayname').value = 'My API';
            document.querySelector('#capi-new-displayname').dispatchEvent(new Event('input'));
            document.querySelector('#capi-new-description').value = 'Desc';
            document.querySelector('#capi-new-description').dispatchEvent(new Event('input'));

            expect(createBtn.disabled).toBe(false);
        });

        it('should pre-select plugin type from prefill', async () => {
            CustomApiService.fetchPluginTypes.mockResolvedValue([
                { plugintypeid: 'pt-abc', typename: 'TestPlugin', name: 'Execute', ismanaged: false }
            ]);

            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._openCreateDialog({ uniquename: 'imported', _plugintypeid_value: 'pt-abc' });

            const pluginSelect = document.querySelector('#capi-new-plugintype');
            expect(pluginSelect.value).toBe('pt-abc');
        });

        it('should set name from prefill when name is missing', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            await tab._openCreateDialog({ uniquename: 'my_import' });

            const nameInput = document.querySelector('#capi-new-name');
            expect(nameInput.value).toBe('my_import');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // ADD PARAM/PROP DIALOG - AUTO NAME GENERATION
    // ═══════════════════════════════════════════════════════════

    describe('dialog auto-name generation', () => {
        it('_openAddParamDialog should auto-generate name from uniquename', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._openAddParamDialog(mockApis[0]);

            const uniqueInput = document.querySelector('#capi-param-uniquename');
            const nameInput = document.querySelector('#capi-param-name');

            uniqueInput.value = 'MyParam';
            uniqueInput.dispatchEvent(new Event('input'));

            expect(nameInput.value).toBe('new_TestAction.MyParam');
        });

        it('_openAddPropDialog should auto-generate name from uniquename', async () => {
            DialogService.show.mockImplementation((title, content) => {
                const dialog = document.createElement('div');
                dialog.className = 'pdt-dialog';
                const footer = document.createElement('div');
                footer.className = 'pdt-dialog-footer';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pdt-dialog-cancel';
                footer.appendChild(cancelBtn);
                dialog.appendChild(content);
                dialog.appendChild(footer);
                document.body.appendChild(dialog);
                return { close: vi.fn() };
            });

            tab = new CustomApiTab();
            const element = await tab.render();
            document.body.appendChild(element);
            tab.postRender(element);

            tab._openAddPropDialog(mockApis[0]);

            const uniqueInput = document.querySelector('#capi-prop-uniquename');
            const nameInput = document.querySelector('#capi-prop-name');

            uniqueInput.value = 'MyProp';
            uniqueInput.dispatchEvent(new Event('input'));

            expect(nameInput.value).toBe('new_TestAction.MyProp');
        });
    });
});
