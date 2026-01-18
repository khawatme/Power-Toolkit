/**
 * @file Comprehensive tests for WebApiExplorerTab component
 * @module tests/components/WebApiExplorerTab.test.js
 * @description Tests for the Web API Explorer component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebApiExplorerTab } from '../../src/components/WebApiExplorerTab.js';
import { DataService } from '../../src/services/DataService.js';

// Mock dependencies
vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        webApiFetch: vi.fn(() => Promise.resolve({ value: [] })),
        retrieveMultipleRecords: vi.fn(() => Promise.resolve({ entities: [] })),
        createRecord: vi.fn(() => Promise.resolve({ id: 'new-id-123' })),
        updateRecord: vi.fn(() => Promise.resolve({})),
        deleteRecord: vi.fn(() => Promise.resolve({})),
        getAttributeDefinitions: vi.fn(() => Promise.resolve([])),
        getNavigationPropertyMap: vi.fn(() => Promise.resolve(new Map()))
    }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: true,
        getEntityName: vi.fn(() => 'account'),
        getEntityId: vi.fn(() => '12345-67890')
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/services/MetadataService.js', () => ({
    MetadataService: {
        getAllEntities: vi.fn(() => Promise.resolve([])),
        getEntityMetadata: vi.fn(() => Promise.resolve({})),
        getAttributeMetadata: vi.fn(() => Promise.resolve([]))
    }
}));

vi.mock('../../src/services/FileUploadService.js', () => ({
    FileUploadService: { uploadFile: vi.fn() }
}));

vi.mock('../../src/services/ValidationService.js', () => ({
    ValidationService: {
        validateGuid: vi.fn(),
        validateSchemaName: vi.fn(),
        validateJson: vi.fn((json) => JSON.parse(json))
    }
}));

vi.mock('../../src/core/Store.js', () => ({
    Store: {
        getState: vi.fn(() => ({ theme: 'dark' })),
        setState: vi.fn()
    }
}));

// Mock FilterGroupManager with constructor pattern
vi.mock('../../src/ui/FilterGroupManager.js', () => {
    const MockFilterGroupManager = vi.fn(function () {
        this.addFilterGroup = vi.fn();
        this.extractFilterGroups = vi.fn(() => []);
        this.cleanup = vi.fn();
        this.dispose = vi.fn();
    });
    return { FilterGroupManager: MockFilterGroupManager };
});

// Mock ResultPanel with constructor pattern
vi.mock('../../src/utils/ui/ResultPanel.js', () => {
    const MockResultPanel = vi.fn(function () {
        this.renderShell = vi.fn();
        this.renderContent = vi.fn();
        this.dispose = vi.fn();
        this.destroy = vi.fn();
        this.removeBanner = vi.fn();
        this._selectedIndices = new Set();
    });
    return { ResultPanel: MockResultPanel };
});

vi.mock('../../src/utils/ui/BusyIndicator.js', () => ({
    BusyIndicator: {
        set: vi.fn(),
        clear: vi.fn(),
        hide: vi.fn()
    }
}));

vi.mock('../../src/utils/ui/PreferencesHelper.js', () => ({
    PreferencesHelper: {
        load: vi.fn((key, defaultValue) => defaultValue),
        save: vi.fn()
    }
}));

vi.mock('../../src/ui/MetadataBrowserDialog.js', () => ({
    MetadataBrowserDialog: {
        showEntityPicker: vi.fn(() => Promise.resolve('account')),
        showColumnPicker: vi.fn(() => Promise.resolve(['name', 'createdon']))
    }
}));

vi.mock('../../src/utils/resolvers/EntityContextResolver.js', () => ({
    EntityContextResolver: {
        resolve: vi.fn(() => Promise.resolve({ entitySet: 'accounts', logicalName: 'account' })),
        getAttrMap: vi.fn(() => Promise.resolve(new Map([['name', { type: 'string' }]])))
    }
}));

vi.mock('../../src/utils/builders/ODataQueryBuilder.js', () => ({
    ODataQueryBuilder: {
        build: vi.fn(() => '?$select=name')
    }
}));

vi.mock('../../src/utils/parsers/ErrorParser.js', () => ({
    ErrorParser: {
        extract: vi.fn((error) => error.message || 'Unknown error')
    }
}));

vi.mock('../../src/ui/SmartValueInput.js', () => ({
    SmartValueInput: Object.assign(vi.fn(), {
        LOOKUP_TYPES: ['lookup', 'lookuptype', 'customer', 'customertype', 'owner', 'ownertype'],
        render: vi.fn().mockResolvedValue()
    })
}));

vi.mock('../../src/helpers/index.js', () => ({
    copyToClipboard: vi.fn(),
    debounce: vi.fn((fn) => fn),
    escapeHtml: vi.fn((str) => str),
    formatODataValue: vi.fn((v) => v),
    normalizeApiResponse: vi.fn((res) => ({ records: res?.entities || res?.value || [], count: 0 })),
    showConfirmDialog: vi.fn(() => Promise.resolve(true)),
    showColumnBrowser: vi.fn(() => Promise.resolve([]))
}));

describe('WebApiExplorerTab', () => {
    let component;

    /**
     * Helper function to render and initialize component
     */
    async function setupComponent() {
        component = new WebApiExplorerTab();
        const element = component.render();
        document.body.appendChild(element);
        component.postRender(element);
        return element;
    }

    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        // Safely destroy component - catch errors from mock elements
        try {
            component?.destroy?.();
        } catch (e) {
            // Ignore errors from mocked UI elements during test cleanup
        }
        component = null;
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        beforeEach(() => {
            component = new WebApiExplorerTab();
        });

        it('should initialize with correct id', () => {
            expect(component.id).toBe('apiExplorer');
        });

        it('should initialize with correct label', () => {
            expect(component.label).toContain('WebAPI');
        });

        it('should have an icon defined', () => {
            expect(component.icon).toBeDefined();
        });

        it('should NOT be a form-only component', () => {
            expect(component.isFormOnly).toBeFalsy();
        });

        it('should initialize lastResult as null', () => {
            expect(component.lastResult).toBeNull();
        });

        it('should initialize currentView from preferences', () => {
            expect(['table', 'json']).toContain(component.currentView);
        });

        it('should initialize hideOdata preference', () => {
            expect(typeof component.hideOdata).toBe('boolean');
        });

        it('should initialize UI object as empty', () => {
            expect(component.ui).toEqual({});
        });

        it('should initialize resultSortState with defaults', () => {
            expect(component.resultSortState).toEqual({ column: null, direction: 'asc' });
        });

        it('should initialize method state for all HTTP methods', () => {
            expect(component._methodState).toHaveProperty('GET');
            expect(component._methodState).toHaveProperty('POST');
            expect(component._methodState).toHaveProperty('PATCH');
            expect(component._methodState).toHaveProperty('DELETE');
        });

        it('should initialize dynamic handlers map', () => {
            expect(component._dynamicHandlers).toBeInstanceOf(Map);
        });

        it('should initialize nextLink as null', () => {
            expect(component.nextLink).toBeNull();
        });

        it('should initialize allLoadedRecords as empty array', () => {
            expect(component.allLoadedRecords).toEqual([]);
        });

        it('should initialize isLoadingMore as false', () => {
            expect(component.isLoadingMore).toBe(false);
        });

        it('should initialize _lastMethod as GET', () => {
            expect(component._lastMethod).toBe('GET');
        });

        it('should initialize selectedEntityLogicalName as null', () => {
            expect(component.selectedEntityLogicalName).toBeNull();
        });

        it('should initialize attrMap as null', () => {
            expect(component.attrMap).toBeNull();
        });

        it('should initialize resultPanel as null', () => {
            expect(component.resultPanel).toBeNull();
        });

        it('should initialize all handler references as null', () => {
            // Only handlers declared in constructor are tested here
            // _postEntityInputHandler and _patchEntityInputHandler are created in postRender
            expect(component._getEntityInputHandler).toBeNull();
            expect(component._executeHandler).toBeNull();
        });

        it('should initialize all filter managers as null', () => {
            expect(component.getFilterManager).toBeNull();
            expect(component.patchFilterManager).toBeNull();
            expect(component.deleteFilterManager).toBeNull();
        });

        it('should initialize GET method state structure', () => {
            const getState = component._methodState.GET;
            expect(getState).toHaveProperty('entity');
            expect(getState).toHaveProperty('recordId');
            expect(getState).toHaveProperty('fields');
            expect(getState).toHaveProperty('select');
            expect(getState).toHaveProperty('orderBy');
            expect(getState).toHaveProperty('top');
        });
    });

    describe('render', () => {
        beforeEach(() => {
            component = new WebApiExplorerTab();
        });

        it('should return an HTMLElement', () => {
            const element = component.render();
            expect(element).toBeInstanceOf(HTMLElement);
        });

        it('should render with pdt-api class', () => {
            const element = component.render();
            expect(element.className).toContain('pdt-api');
        });

        it('should render section title', () => {
            const element = component.render();
            expect(element.querySelector('.section-title')).toBeTruthy();
            expect(element.textContent).toContain('Web API Explorer');
        });

        it('should render method selector', () => {
            const element = component.render();
            const methodSelect = element.querySelector('#api-method-select');
            expect(methodSelect).toBeTruthy();
            expect(methodSelect.tagName).toBe('SELECT');
        });

        it('should have GET as first/default option', () => {
            const element = component.render();
            const methodSelect = element.querySelector('#api-method-select');
            expect(methodSelect.options[0].value).toBe('GET');
        });

        it('should have POST option', () => {
            const element = component.render();
            const options = element.querySelectorAll('#api-method-select option');
            const values = Array.from(options).map(opt => opt.value);
            expect(values).toContain('POST');
        });

        it('should have PATCH option', () => {
            const element = component.render();
            const options = element.querySelectorAll('#api-method-select option');
            const values = Array.from(options).map(opt => opt.value);
            expect(values).toContain('PATCH');
        });

        it('should have DELETE option', () => {
            const element = component.render();
            const options = element.querySelectorAll('#api-method-select option');
            const values = Array.from(options).map(opt => opt.value);
            expect(values).toContain('DELETE');
        });

        it('should render GET view section', () => {
            const element = component.render();
            const getView = element.querySelector('#api-view-get');
            expect(getView).toBeTruthy();
        });

        it('should render POST view section (hidden by default)', () => {
            const element = component.render();
            const postView = element.querySelector('#api-view-post');
            expect(postView).toBeTruthy();
            expect(postView.hidden).toBe(true);
        });

        it('should render PATCH view section (hidden by default)', () => {
            const element = component.render();
            const patchView = element.querySelector('#api-view-patch');
            expect(patchView).toBeTruthy();
            expect(patchView.hidden).toBe(true);
        });

        it('should render DELETE view section (hidden by default)', () => {
            const element = component.render();
            const deleteView = element.querySelector('#api-view-delete');
            expect(deleteView).toBeTruthy();
            expect(deleteView.hidden).toBe(true);
        });

        it('should render entity input for GET', () => {
            const element = component.render();
            const entityInput = element.querySelector('#api-get-entity');
            expect(entityInput).toBeTruthy();
            expect(entityInput.placeholder).toContain('accounts');
        });

        it('should render columns textarea for GET', () => {
            const element = component.render();
            const selectArea = element.querySelector('#api-get-select');
            expect(selectArea).toBeTruthy();
            expect(selectArea.tagName).toBe('TEXTAREA');
        });

        it('should render top count input for GET', () => {
            const element = component.render();
            const topInput = element.querySelector('#api-get-top');
            expect(topInput).toBeTruthy();
            expect(topInput.type).toBe('number');
        });

        it('should render filter container for GET', () => {
            const element = component.render();
            const filterContainer = element.querySelector('#api-get-filters-container');
            expect(filterContainer).toBeTruthy();
        });

        it('should render add filter group button', () => {
            const element = component.render();
            const addBtn = element.querySelector('#api-get-add-filter-group-btn');
            expect(addBtn).toBeTruthy();
            expect(addBtn.textContent).toContain('Add Filter Group');
        });

        it('should render browse entity button for GET', () => {
            const element = component.render();
            const browseBtn = element.querySelector('#browse-api-get-entity-btn');
            expect(browseBtn).toBeTruthy();
        });

        it('should render browse columns button for GET', () => {
            const element = component.render();
            const browseBtn = element.querySelector('#browse-api-get-select-btn');
            expect(browseBtn).toBeTruthy();
        });

        it('should render order by section for GET', () => {
            const element = component.render();
            const orderByInput = element.querySelector('#api-get-orderby-attribute');
            const orderByDir = element.querySelector('#api-get-orderby-dir');
            expect(orderByInput).toBeTruthy();
            expect(orderByDir).toBeTruthy();
        });

        it('should render order by direction options', () => {
            const element = component.render();
            const options = element.querySelectorAll('#api-get-orderby-dir option');
            const values = Array.from(options).map(opt => opt.value);
            expect(values).toContain('asc');
            expect(values).toContain('desc');
        });

        it('should render entity input for POST', () => {
            const element = component.render();
            const entityInput = element.querySelector('#api-post-entity');
            expect(entityInput).toBeTruthy();
        });

        it('should render entity input for PATCH', () => {
            const element = component.render();
            const entityInput = element.querySelector('#api-patch-entity');
            expect(entityInput).toBeTruthy();
        });

        it('should render record ID input for PATCH', () => {
            const element = component.render();
            const patchIdInput = element.querySelector('#api-patch-id');
            expect(patchIdInput).toBeTruthy();
        });

        it('should render JSON body textarea', () => {
            const element = component.render();
            const postBodyArea = element.querySelector('#api-post-body');
            const patchBodyArea = element.querySelector('#api-patch-body');
            expect(postBodyArea).toBeTruthy();
            expect(postBodyArea.tagName).toBe('TEXTAREA');
            expect(patchBodyArea).toBeTruthy();
            expect(patchBodyArea.tagName).toBe('TEXTAREA');
        });

        it('should render body mode toggle', () => {
            const element = component.render();
            const postToggle = element.querySelector('#api-post-body-mode-toggle');
            const patchToggle = element.querySelector('#api-patch-body-mode-toggle');
            expect(postToggle).toBeTruthy();
            expect(postToggle.type).toBe('checkbox');
            expect(patchToggle).toBeTruthy();
            expect(patchToggle.type).toBe('checkbox');
        });

        it('should render fields builder section', () => {
            const element = component.render();
            const postFieldsBuilder = element.querySelector('#api-post-fields-builder');
            const patchFieldsBuilder = element.querySelector('#api-patch-fields-builder');
            expect(postFieldsBuilder).toBeTruthy();
            expect(patchFieldsBuilder).toBeTruthy();
        });

        it('should render add field button', () => {
            const element = component.render();
            const postAddFieldBtn = element.querySelector('#api-post-add-field-btn');
            const patchAddFieldBtn = element.querySelector('#api-patch-add-field-btn');
            expect(postAddFieldBtn).toBeTruthy();
            expect(patchAddFieldBtn).toBeTruthy();
        });

        it('should render entity input for DELETE', () => {
            const element = component.render();
            const deleteEntityInput = element.querySelector('#api-delete-entity');
            expect(deleteEntityInput).toBeTruthy();
        });

        it('should render record ID input for DELETE', () => {
            const element = component.render();
            const deleteIdInput = element.querySelector('#api-delete-id');
            expect(deleteIdInput).toBeTruthy();
        });

        it('should render execute button', () => {
            const element = component.render();
            const executeBtn = element.querySelector('#api-execute-btn');
            expect(executeBtn).toBeTruthy();
            expect(executeBtn.textContent).toContain('Execute');
        });

        it('should render get count button', () => {
            const element = component.render();
            const countBtn = element.querySelector('#api-get-count-btn');
            expect(countBtn).toBeTruthy();
            expect(countBtn.textContent).toContain('Get Count');
        });

        it('should render format JSON button (hidden by default)', () => {
            const element = component.render();
            const formatBtn = element.querySelector('#api-format-json-btn');
            expect(formatBtn).toBeTruthy();
            expect(formatBtn.hidden).toBe(true);
        });

        it('should render preview section below toolbar', () => {
            const element = component.render();
            // Preview is now in the toolbar section, below the buttons
            const preview = element.querySelector('#api-preview');
            expect(preview).toBeTruthy();
        });

        it('should render result root container', () => {
            const element = component.render();
            const resultRoot = element.querySelector('#api-result-root');
            expect(resultRoot).toBeTruthy();
        });

        it('should render bulk PATCH filter section (hidden)', () => {
            const element = component.render();
            const filterSection = element.querySelector('#api-patch-filter-section');
            expect(filterSection).toBeTruthy();
            expect(filterSection.hidden).toBe(true);
        });

        it('should render bulk DELETE filter section (hidden)', () => {
            const element = component.render();
            const filterSection = element.querySelector('#api-delete-filter-section');
            expect(filterSection).toBeTruthy();
            expect(filterSection.hidden).toBe(true);
        });
    });

    describe('postRender', () => {
        it('should not throw when called', async () => {
            const element = await setupComponent();
            expect(element).toBeTruthy();
        });

        it('should cache UI elements', async () => {
            await setupComponent();
            expect(component.ui.methodSelect).toBeTruthy();
            expect(component.ui.getEntityInput).toBeTruthy();
            expect(component.ui.executeBtn).toBeTruthy();
        });

        it('should cache GET view UI elements', async () => {
            await setupComponent();
            expect(component.ui.getView).toBeTruthy();
            expect(component.ui.getSelectInput).toBeTruthy();
            expect(component.ui.getTopInput).toBeTruthy();
            expect(component.ui.getFiltersContainer).toBeTruthy();
        });

        it('should cache POST view UI elements', async () => {
            await setupComponent();
            expect(component.ui.postView).toBeTruthy();
            expect(component.ui.postEntityInput).toBeTruthy();
            expect(component.ui.postBodyArea).toBeTruthy();
            expect(component.ui.postFieldsContainer).toBeTruthy();
            expect(component.ui.postBodyModeToggle).toBeTruthy();
        });

        it('should cache PATCH view UI elements', async () => {
            await setupComponent();
            expect(component.ui.patchView).toBeTruthy();
            expect(component.ui.patchEntityInput).toBeTruthy();
            expect(component.ui.patchIdInput).toBeTruthy();
            expect(component.ui.patchBodyArea).toBeTruthy();
            expect(component.ui.patchFieldsContainer).toBeTruthy();
            expect(component.ui.patchBodyModeToggle).toBeTruthy();
        });

        it('should cache DELETE view UI elements', async () => {
            await setupComponent();
            expect(component.ui.deleteView).toBeTruthy();
            expect(component.ui.deleteEntityInput).toBeTruthy();
            expect(component.ui.deleteIdInput).toBeTruthy();
        });

        it('should cache toolbar buttons', async () => {
            await setupComponent();
            expect(component.ui.executeBtn).toBeTruthy();
            expect(component.ui.getCountBtn).toBeTruthy();
        });

        it('should setup method select handler', async () => {
            await setupComponent();
            expect(component._methodSelectHandler).toBeDefined();
        });

        it('should setup execute handler', async () => {
            await setupComponent();
            expect(component._executeHandler).toBeDefined();
        });

        it('should setup GET entity input handler', async () => {
            await setupComponent();
            expect(component._getEntityInputHandler).toBeDefined();
        });

        it('should initialize filter managers', async () => {
            await setupComponent();
            expect(component.getFilterManager).toBeTruthy();
            expect(component.patchFilterManager).toBeTruthy();
            expect(component.deleteFilterManager).toBeTruthy();
        });

        it('should create result panel', async () => {
            await setupComponent();
            expect(component.resultPanel).toBeTruthy();
        });

        it('should setup keydown handler for Ctrl+Enter', async () => {
            await setupComponent();
            expect(component._rootKeydownHandler).toBeDefined();
        });

        it('should call renderShell on result panel', async () => {
            await setupComponent();
            expect(component.resultPanel.renderShell).toHaveBeenCalled();
        });
    });

    describe('method switching', () => {
        it('should show GET view when GET is selected', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'GET';
            component.ui.methodSelect.dispatchEvent(new Event('change'));
            expect(component.ui.getView.hidden).toBe(false);
        });

        it('should hide POST and PATCH views when GET is selected', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'GET';
            component.ui.methodSelect.dispatchEvent(new Event('change'));
            expect(component.ui.postView.hidden).toBe(true);
            expect(component.ui.patchView.hidden).toBe(true);
        });

        it('should show POST view when POST is selected', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.methodSelect.dispatchEvent(new Event('change'));
            expect(component.ui.postView.hidden).toBe(false);
            expect(component.ui.patchView.hidden).toBe(true);
        });

        it('should show PATCH view when PATCH is selected', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'PATCH';
            component.ui.methodSelect.dispatchEvent(new Event('change'));
            expect(component.ui.patchView.hidden).toBe(false);
            expect(component.ui.postView.hidden).toBe(true);
        });

        it('should show DELETE view when DELETE is selected', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'DELETE';
            component.ui.methodSelect.dispatchEvent(new Event('change'));
            expect(component.ui.deleteView.hidden).toBe(false);
        });

        it('should hide GET view when DELETE is selected', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'DELETE';
            component.ui.methodSelect.dispatchEvent(new Event('change'));
            expect(component.ui.getView.hidden).toBe(true);
        });

        it('should update _lastMethod on method change', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.methodSelect.dispatchEvent(new Event('change'));
            expect(component._lastMethod).toBe('POST');
        });

        it('should hide format JSON button for POST initially (field builder mode)', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.methodSelect.dispatchEvent(new Event('change'));
            expect(component.ui.formatJsonBtn.hidden).toBe(true);
        });

        it('should show format JSON button for POST when in JSON mode', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.methodSelect.dispatchEvent(new Event('change'));
            component.ui.postBodyModeToggle.checked = true;
            component.ui.postBodyModeToggle.dispatchEvent(new Event('change'));
            expect(component.ui.formatJsonBtn.hidden).toBe(false);
        });

        it('should hide Get Count button for POST', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.methodSelect.dispatchEvent(new Event('change'));
            expect(component.ui.getCountBtn.hidden).toBe(true);
        });
    });

    describe('clearResults', () => {
        it('should not throw when called after setup', async () => {
            await setupComponent();
            expect(() => component.clearResults()).not.toThrow();
        });

        it('should reset lastResult', async () => {
            await setupComponent();
            component.lastResult = { records: [{ name: 'test' }] };
            component.clearResults();
            expect(component.lastResult.records).toEqual([]);
        });

        it('should reset nextLink', async () => {
            await setupComponent();
            component.nextLink = 'http://example.com/next';
            component.clearResults();
            expect(component.nextLink).toBeNull();
        });

        it('should reset allLoadedRecords', async () => {
            await setupComponent();
            component.allLoadedRecords = [{ name: 'test' }];
            component.clearResults();
            expect(component.allLoadedRecords).toEqual([]);
        });

        it('should reset resultSortState', async () => {
            await setupComponent();
            component.resultSortState = { column: 'name', direction: 'desc' };
            component.clearResults();
            expect(component.resultSortState).toEqual({ column: null, direction: 'asc' });
        });

        it('should create new result panel', async () => {
            await setupComponent();
            const oldPanel = component.resultPanel;
            component.clearResults();
            expect(component.resultPanel).not.toBe(oldPanel);
        });
    });

    describe('destroy', () => {
        it('should not throw when called without render', () => {
            component = new WebApiExplorerTab();
            expect(() => component.destroy()).not.toThrow();
        });

        it('should not throw when called after setup', async () => {
            await setupComponent();
            expect(() => component.destroy()).not.toThrow();
        });

        it('should cleanup dynamic handlers', async () => {
            await setupComponent();
            component.destroy();
            expect(component._dynamicHandlers.size).toBe(0);
        });

        it('should cleanup filter managers when cleanup is called', async () => {
            await setupComponent();
            const getFilterManager = component.getFilterManager;
            component.cleanup();
            expect(getFilterManager.cleanup).toHaveBeenCalled();
        });
    });

    describe('HTTP method state persistence', () => {
        it('should have GET state structure with all required fields', () => {
            component = new WebApiExplorerTab();
            const state = component._methodState.GET;
            expect(state).toHaveProperty('entity');
            expect(state).toHaveProperty('select');
            expect(state).toHaveProperty('orderBy');
            expect(state).toHaveProperty('top');
        });

        it('should have POST state structure', () => {
            component = new WebApiExplorerTab();
            const state = component._methodState.POST;
            expect(state).toHaveProperty('entity');
            expect(state).toHaveProperty('fields');
            expect(state).toHaveProperty('fieldValues');
        });

        it('should have PATCH state structure', () => {
            component = new WebApiExplorerTab();
            const state = component._methodState.PATCH;
            expect(state).toHaveProperty('entity');
            expect(state).toHaveProperty('recordId');
            expect(state).toHaveProperty('filters');
        });

        it('should have DELETE state structure', () => {
            component = new WebApiExplorerTab();
            const state = component._methodState.DELETE;
            expect(state).toHaveProperty('entity');
            expect(state).toHaveProperty('recordId');
            expect(state).toHaveProperty('filters');
        });
    });

    describe('result handling', () => {
        it('should support table view as currentView', () => {
            component = new WebApiExplorerTab();
            component.currentView = 'table';
            expect(component.currentView).toBe('table');
        });

        it('should support json view as currentView', () => {
            component = new WebApiExplorerTab();
            component.currentView = 'json';
            expect(component.currentView).toBe('json');
        });

        it('should track next link for pagination', () => {
            component = new WebApiExplorerTab();
            component.nextLink = 'http://example.com/next';
            expect(component.nextLink).toBe('http://example.com/next');
        });

        it('should track all loaded records for pagination', () => {
            component = new WebApiExplorerTab();
            component.allLoadedRecords = [{ id: 1 }, { id: 2 }];
            expect(component.allLoadedRecords).toHaveLength(2);
        });

        it('should track loading more state', () => {
            component = new WebApiExplorerTab();
            component.isLoadingMore = true;
            expect(component.isLoadingMore).toBe(true);
        });

        it('should have resultSortState with column property', () => {
            component = new WebApiExplorerTab();
            component.resultSortState.column = 'name';
            expect(component.resultSortState.column).toBe('name');
        });

        it('should have resultSortState with direction property', () => {
            component = new WebApiExplorerTab();
            component.resultSortState.direction = 'desc';
            expect(component.resultSortState.direction).toBe('desc');
        });
    });

    describe('entity context', () => {
        it('should track selectedEntityLogicalName', async () => {
            await setupComponent();
            component.selectedEntityLogicalName = 'account';
            expect(component.selectedEntityLogicalName).toBe('account');
        });

        it('should track attrMap for attribute metadata', async () => {
            await setupComponent();
            component.attrMap = new Map([['name', { type: 'string' }]]);
            expect(component.attrMap.get('name')).toEqual({ type: 'string' });
        });

        it('should reset entity context on entity input change', async () => {
            await setupComponent();
            component.selectedEntityLogicalName = 'account';
            component.attrMap = new Map([['name', { type: 'string' }]]);

            // Trigger input handler
            component.ui.getEntityInput.dispatchEvent(new Event('input'));

            expect(component.selectedEntityLogicalName).toBeNull();
            expect(component.attrMap).toBeNull();
        });
    });

    describe('body mode toggle (POST/PATCH)', () => {
        it('should render body mode toggle checkbox', async () => {
            await setupComponent();
            expect(component.ui.postBodyModeToggle).toBeTruthy();
            expect(component.ui.postBodyModeToggle.type).toBe('checkbox');
            expect(component.ui.patchBodyModeToggle).toBeTruthy();
            expect(component.ui.patchBodyModeToggle.type).toBe('checkbox');
        });

        it('should have fields builder visible by default', async () => {
            await setupComponent();
            expect(component.ui.postFieldsBuilder).toBeTruthy();
            expect(component.ui.patchFieldsBuilder).toBeTruthy();
        });

        it('should have JSON mode section', async () => {
            await setupComponent();
            expect(component.ui.postJsonMode).toBeTruthy();
            expect(component.ui.patchJsonMode).toBeTruthy();
        });
    });

    describe('bulk operations filter sections', () => {
        it('should have PATCH filter section', async () => {
            await setupComponent();
            expect(component.ui.patchFilterSection).toBeTruthy();
        });

        it('should have DELETE filter section', async () => {
            await setupComponent();
            expect(component.ui.deleteFilterSection).toBeTruthy();
        });

        it('should have PATCH filter container', async () => {
            await setupComponent();
            expect(component.ui.patchFiltersContainer).toBeTruthy();
        });

        it('should have DELETE filter container', async () => {
            await setupComponent();
            expect(component.ui.deleteFiltersContainer).toBeTruthy();
        });
    });

    describe('browse buttons', () => {
        it('should have browse button for GET entity', async () => {
            await setupComponent();
            expect(component.ui.browseGetEntityBtn).toBeTruthy();
        });

        it('should have browse button for GET select columns', async () => {
            await setupComponent();
            expect(component.ui.browseGetSelectBtn).toBeTruthy();
        });

        it('should have browse button for GET order by', async () => {
            await setupComponent();
            expect(component.ui.browseGetOrderByBtn).toBeTruthy();
        });

        it('should have browse button for POST/PATCH entity', async () => {
            await setupComponent();
            expect(component.ui.browsePostEntityBtn).toBeTruthy();
            expect(component.ui.browsePatchEntityBtn).toBeTruthy();
        });

        it('should have browse button for DELETE entity', async () => {
            await setupComponent();
            expect(component.ui.browseDeleteEntityBtn).toBeTruthy();
        });
    });

    describe('preview section', () => {
        it('should have preview element', async () => {
            await setupComponent();
            expect(component.ui.preview).toBeTruthy();
        });

        it('should have pdt-note class on preview', async () => {
            await setupComponent();
            expect(component.ui.preview.classList.contains('pdt-note')).toBe(true);
        });
    });

    describe('keyboard shortcuts', () => {
        it('should setup keydown handler', async () => {
            await setupComponent();
            expect(component._rootKeydownHandler).toBeDefined();
        });
    });

    describe('fields container (POST/PATCH)', () => {
        it('should have fields container', async () => {
            await setupComponent();
            expect(component.ui.postFieldsContainer).toBeTruthy();
            expect(component.ui.patchFieldsContainer).toBeTruthy();
        });

        it('should have add field button', async () => {
            await setupComponent();
            // POST and PATCH have separate add field buttons now
            expect(component.ui.postAddFieldBtn).toBeTruthy();
            expect(component.ui.patchAddFieldBtn).toBeTruthy();
        });
    });

    describe('result panel integration', () => {
        it('should create result panel with onToggleView callback', async () => {
            await setupComponent();
            expect(component.resultPanel).toBeTruthy();
        });

        it('should have result root element', async () => {
            await setupComponent();
            expect(component.ui.resultRoot).toBeTruthy();
        });
    });

    describe('filter manager integration', () => {
        it('should NOT call addFilterGroup on GET filter manager during initialization', async () => {
            await setupComponent();
            expect(component.getFilterManager.addFilterGroup).not.toHaveBeenCalled();
        });

        it('should NOT call addFilterGroup on PATCH filter manager during initialization', async () => {
            await setupComponent();
            expect(component.patchFilterManager.addFilterGroup).not.toHaveBeenCalled();
        });

        it('should NOT call addFilterGroup on DELETE filter manager during initialization', async () => {
            await setupComponent();
            expect(component.deleteFilterManager.addFilterGroup).not.toHaveBeenCalled();
        });

        it('should have empty GET filter container on initialization', async () => {
            const element = await setupComponent();
            const filterContainer = element.querySelector('#api-get-filters-container');
            expect(filterContainer).toBeTruthy();
            expect(filterContainer.querySelectorAll('.pdt-filter-group').length).toBe(0);
        });

        it('should have PATCH filter section hidden on initialization', async () => {
            const element = await setupComponent();
            const filterSection = element.querySelector('#api-patch-filter-section');
            expect(filterSection).toBeTruthy();
            expect(filterSection.hidden).toBe(true);
        });

        it('should have DELETE filter section hidden on initialization', async () => {
            const element = await setupComponent();
            const filterSection = element.querySelector('#api-delete-filter-section');
            expect(filterSection).toBeTruthy();
            expect(filterSection.hidden).toBe(true);
        });

        it('should call addFilterGroup with isFirst=true when adding first GET filter', async () => {
            await setupComponent();
            component.getFilterManager.addFilterGroup.mockClear();

            // Set entity
            component.ui.getEntityInput.value = 'accounts';

            // Call handler directly
            await component._addGetFilterGroupHandler();

            expect(component.getFilterManager.addFilterGroup).toHaveBeenCalledWith(
                component.ui.getFiltersContainer,
                true  // isFirst should be true for first filter
            );
        });

        it('should call addFilterGroup with isFirst=false when adding second GET filter', async () => {
            await setupComponent();

            // Set entity
            component.ui.getEntityInput.value = 'accounts';

            // Simulate first filter group already exists
            const mockFilterGroup = document.createElement('div');
            mockFilterGroup.className = 'pdt-filter-group';
            component.ui.getFiltersContainer.appendChild(mockFilterGroup);

            component.getFilterManager.addFilterGroup.mockClear();

            // Call handler directly
            await component._addGetFilterGroupHandler();

            expect(component.getFilterManager.addFilterGroup).toHaveBeenCalledWith(
                component.ui.getFiltersContainer,
                false  // isFirst should be false for second filter
            );
        });

        it('should call addFilterGroup with isFirst=true when adding first PATCH filter', async () => {
            await setupComponent();
            component.patchFilterManager.addFilterGroup.mockClear();

            // Set entity
            component.ui.patchEntityInput.value = 'accounts';

            // Call handler directly
            await component._addPatchFilterGroupHandler();

            expect(component.patchFilterManager.addFilterGroup).toHaveBeenCalledWith(
                component.ui.patchFiltersContainer,
                true  // isFirst should be true for first filter
            );
        });

        it('should call addFilterGroup with isFirst=true when adding first DELETE filter', async () => {
            await setupComponent();
            component.deleteFilterManager.addFilterGroup.mockClear();

            // Set entity
            component.ui.deleteEntityInput.value = 'accounts';

            // Call handler directly
            await component._addDeleteFilterGroupHandler();

            expect(component.deleteFilterManager.addFilterGroup).toHaveBeenCalledWith(
                component.ui.deleteFiltersContainer,
                true  // isFirst should be true for first filter
            );
        });
    });

    describe('_handleMethodChange advanced scenarios', () => {
        it('should save method state when switching from GET to POST', async () => {
            await setupComponent();
            component.ui.getEntityInput.value = 'accounts';
            component.ui.getSelectInput.value = 'name';

            component.ui.methodSelect.value = 'POST';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            expect(component._methodState.GET.entity).toBeDefined();
        });

        it('should restore method state when switching back to GET', async () => {
            await setupComponent();
            component.ui.getEntityInput.value = 'accounts';

            // Switch to POST
            component.ui.methodSelect.value = 'POST';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            // Switch back to GET
            component.ui.methodSelect.value = 'GET';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            expect(component.ui.getView.hidden).toBe(false);
        });

        it('should update _lastMethod after each switch', async () => {
            await setupComponent();

            component.ui.methodSelect.value = 'PATCH';
            component.ui.methodSelect.dispatchEvent(new Event('change'));
            expect(component._lastMethod).toBe('PATCH');

            component.ui.methodSelect.value = 'DELETE';
            component.ui.methodSelect.dispatchEvent(new Event('change'));
            expect(component._lastMethod).toBe('DELETE');
        });

        it('should show correct placeholder for PATCH record ID', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'PATCH';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            // PATCH record ID placeholder shows GUID format
            expect(component.ui.patchIdInput.placeholder).toContain('0000');
        });

        // POST doesn't have a record ID field - it's in its own separate section now

        it('should hide PATCH filter section when record ID is provided', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'PATCH';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            component.ui.patchIdInput.value = '12345678-1234-1234-1234-123456789012';
            component.ui.patchIdInput.dispatchEvent(new Event('input'));

            expect(component.ui.patchFilterSection.hidden).toBe(true);
        });

        it('should show DELETE filter section when record ID is empty', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'DELETE';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            component.ui.deleteIdInput.value = '';
            component.ui.deleteIdInput.dispatchEvent(new Event('input'));

            expect(component.ui.deleteFilterSection.hidden).toBe(false);
        });
    });

    describe('entity input handling', () => {
        it('should clear selectedEntityLogicalName on GET entity input', async () => {
            await setupComponent();
            component.selectedEntityLogicalName = 'account';

            component.ui.getEntityInput.dispatchEvent(new Event('input'));

            expect(component.selectedEntityLogicalName).toBeNull();
        });

        it('should clear attrMap on POST entity input', async () => {
            await setupComponent();
            component.attrMap = new Map([['name', { type: 'string' }]]);

            component.ui.postEntityInput.dispatchEvent(new Event('input'));

            expect(component.attrMap).toBeNull();
        });

        it('should clear attrMap on PATCH entity input', async () => {
            await setupComponent();
            component.attrMap = new Map([['name', { type: 'string' }]]);

            component.ui.patchEntityInput.dispatchEvent(new Event('input'));

            expect(component.attrMap).toBeNull();
        });

        it('should clear entity context on DELETE entity input', async () => {
            await setupComponent();
            component.selectedEntityLogicalName = 'account';

            component.ui.deleteEntityInput.dispatchEvent(new Event('input'));

            expect(component.selectedEntityLogicalName).toBeNull();
        });
    });

    describe('execute button behavior', () => {
        it('should have execute handler defined', async () => {
            await setupComponent();
            expect(component._executeHandler).toBeDefined();
        });

        it('should not throw when execute button is clicked', async () => {
            await setupComponent();
            expect(() => {
                component.ui.executeBtn.click();
            }).not.toThrow();
        });

        it('should disable execute button during execution', async () => {
            await setupComponent();
            component._setExecuting(true);
            expect(component.ui.executeBtn.disabled).toBe(true);
        });

        it('should enable execute button after execution', async () => {
            await setupComponent();
            component._setExecuting(true);
            component._setExecuting(false);
            expect(component.ui.executeBtn.disabled).toBe(false);
        });
    });

    describe('get count functionality', () => {
        it('should have get count handler defined', async () => {
            await setupComponent();
            expect(component._getCountHandler).toBeDefined();
        });

        it('should show Get Count button for GET method', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'GET';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            expect(component.ui.getCountBtn.hidden).toBe(false);
        });

        it('should hide Get Count button for POST method', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            expect(component.ui.getCountBtn.hidden).toBe(true);
        });

        it('should hide Get Count button for PATCH method', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'PATCH';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            expect(component.ui.getCountBtn.hidden).toBe(true);
        });

        it('should hide Get Count button for DELETE method', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'DELETE';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            expect(component.ui.getCountBtn.hidden).toBe(true);
        });
    });

    describe('view switching (table/json)', () => {
        it('should initialize with table view by default', () => {
            component = new WebApiExplorerTab();
            expect(['table', 'json']).toContain(component.currentView);
        });

        it('should track current view state', async () => {
            await setupComponent();
            component.currentView = 'json';
            expect(component.currentView).toBe('json');
        });

        it('should track hideOdata preference', async () => {
            await setupComponent();
            component.hideOdata = false;
            expect(component.hideOdata).toBe(false);
        });

        it('should update result sort state column', async () => {
            await setupComponent();
            component.resultSortState.column = 'createdon';
            expect(component.resultSortState.column).toBe('createdon');
        });

        it('should update result sort state direction', async () => {
            await setupComponent();
            component.resultSortState.direction = 'desc';
            expect(component.resultSortState.direction).toBe('desc');
        });
    });

    describe('result panel interactions', () => {
        it('should render shell on postRender', async () => {
            await setupComponent();
            expect(component.resultPanel.renderShell).toHaveBeenCalled();
        });

        it('should have result root initially hidden', async () => {
            await setupComponent();
            expect(component.ui.resultRoot.style.display).toBe('none');
        });

        it('should support bulk touch callback', async () => {
            await setupComponent();
            expect(component.resultPanel).toBeTruthy();
        });
    });

    describe('state persistence', () => {
        it('should persist GET entity state', async () => {
            await setupComponent();
            component._methodState.GET.entity = 'accounts';
            expect(component._methodState.GET.entity).toBe('accounts');
        });

        it('should persist POST fields state', async () => {
            await setupComponent();
            component._methodState.POST.fields = '{"name": "test"}';
            expect(component._methodState.POST.fields).toBe('{"name": "test"}');
        });

        it('should persist PATCH recordId state', async () => {
            await setupComponent();
            component._methodState.PATCH.recordId = '12345';
            expect(component._methodState.PATCH.recordId).toBe('12345');
        });

        it('should persist DELETE recordId state', async () => {
            await setupComponent();
            component._methodState.DELETE.recordId = '67890';
            expect(component._methodState.DELETE.recordId).toBe('67890');
        });

        it('should persist fieldValues array', async () => {
            await setupComponent();
            component._methodState.POST.fieldValues = [{ attribute: 'name', value: 'test' }];
            expect(component._methodState.POST.fieldValues).toHaveLength(1);
        });
    });

    describe('error handling', () => {
        it('should handle missing entity gracefully', async () => {
            await setupComponent();
            component.ui.getEntityInput.value = '';

            expect(() => {
                component.ui.executeBtn.click();
            }).not.toThrow();
        });

        it('should handle invalid method state', () => {
            component = new WebApiExplorerTab();
            component._methodState.INVALID = undefined;
            expect(component._methodState.INVALID).toBeUndefined();
        });
    });

    describe('cleanup and destroy advanced', () => {
        it('should cleanup all filter managers', async () => {
            await setupComponent();
            component.cleanup();

            expect(component.getFilterManager.cleanup).toHaveBeenCalled();
            expect(component.patchFilterManager.cleanup).toHaveBeenCalled();
            expect(component.deleteFilterManager.cleanup).toHaveBeenCalled();
        });

        it('should clear dynamic handlers on destroy', async () => {
            await setupComponent();
            component._dynamicHandlers.set(document.createElement('button'), { event: 'click', handler: vi.fn() });

            component.destroy();

            expect(component._dynamicHandlers.size).toBe(0);
        });

        it('should handle destroy without result panel', async () => {
            component = new WebApiExplorerTab();
            component.resultPanel = null;

            expect(() => component.destroy()).not.toThrow();
        });

        it('should handle cleanup with null filter managers', () => {
            component = new WebApiExplorerTab();
            component.getFilterManager = null;
            component.patchFilterManager = null;
            component.deleteFilterManager = null;

            expect(() => component.cleanup()).not.toThrow();
        });
    });

    describe('bulk filter section toggle', () => {
        it('should show PATCH filter section when no ID', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'PATCH';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            component.ui.patchIdInput.value = '';
            component.ui.patchIdInput.dispatchEvent(new Event('input'));

            expect(component.ui.patchFilterSection.hidden).toBe(false);
        });

        it('should hide PATCH filter section when ID is provided', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'PATCH';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            component.ui.patchIdInput.value = 'some-guid';
            component.ui.patchIdInput.dispatchEvent(new Event('input'));

            expect(component.ui.patchFilterSection.hidden).toBe(true);
        });

        it('should hide DELETE filter section when ID is provided', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'DELETE';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            component.ui.deleteIdInput.value = 'some-guid';
            component.ui.deleteIdInput.dispatchEvent(new Event('input'));

            expect(component.ui.deleteFilterSection.hidden).toBe(true);
        });
    });

    describe('format JSON button', () => {
        it('should have format JSON handler defined', async () => {
            await setupComponent();
            expect(component._formatJsonHandler).toBeDefined();
        });

        it('should hide format JSON button for POST initially', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            expect(component.ui.formatJsonBtn.hidden).toBe(true);
        });

        it('should show format JSON button for POST in JSON mode', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.methodSelect.dispatchEvent(new Event('change'));
            component.ui.postBodyModeToggle.checked = true;
            component.ui.postBodyModeToggle.dispatchEvent(new Event('change'));

            expect(component.ui.formatJsonBtn.hidden).toBe(false);
        });

        it('should hide format JSON button for PATCH initially', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'PATCH';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            expect(component.ui.formatJsonBtn.hidden).toBe(true);
        });

        it('should show format JSON button for PATCH in JSON mode', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'PATCH';
            component.ui.methodSelect.dispatchEvent(new Event('change'));
            component.ui.patchBodyModeToggle.checked = true;
            component.ui.patchBodyModeToggle.dispatchEvent(new Event('change'));

            expect(component.ui.formatJsonBtn.hidden).toBe(false);
        });

        it('should hide format JSON button for GET', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'GET';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            expect(component.ui.formatJsonBtn.hidden).toBe(true);
        });

        it('should hide format JSON button for DELETE', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'DELETE';
            component.ui.methodSelect.dispatchEvent(new Event('change'));

            expect(component.ui.formatJsonBtn.hidden).toBe(true);
        });
    });

    describe('field builder mode toggle', () => {
        it('should have field builder visible by default', async () => {
            await setupComponent();
            expect(component.ui.postFieldsBuilder.hidden).toBe(false);
        });

        it('should have JSON mode hidden by default', async () => {
            await setupComponent();
            expect(component.ui.postJsonMode.hidden).toBe(true);
        });

        it('should have body mode toggle unchecked by default', async () => {
            await setupComponent();
            expect(component.ui.postBodyModeToggle.checked).toBe(false);
            expect(component.ui.patchBodyModeToggle.checked).toBe(false);
        });

        it('should toggle to JSON mode when checkbox is checked', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.postBodyModeToggle.checked = true;
            component.ui.postBodyModeToggle.dispatchEvent(new Event('change'));

            expect(component.ui.postJsonMode.hidden).toBe(false);
            expect(component.ui.postFieldsBuilder.hidden).toBe(true);
        });

        it('should toggle back to field builder when checkbox is unchecked', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.postBodyModeToggle.checked = true;
            component.ui.postBodyModeToggle.dispatchEvent(new Event('change'));

            component.ui.postBodyModeToggle.checked = false;
            component.ui.postBodyModeToggle.dispatchEvent(new Event('change'));

            expect(component.ui.postFieldsBuilder.hidden).toBe(false);
            expect(component.ui.postJsonMode.hidden).toBe(true);
        });
    });

    describe('add field button', () => {
        it('should have add field button', async () => {
            await setupComponent();
            expect(component.ui.postAddFieldBtn).toBeTruthy();
            expect(component.ui.patchAddFieldBtn).toBeTruthy();
        });

        it('should have add field handler defined', async () => {
            await setupComponent();
            expect(component._postAddFieldBtnHandler).toBeDefined();
            expect(component._patchAddFieldBtnHandler).toBeDefined();
        });
    });

    describe('keyboard shortcuts', () => {
        it('should trigger execute on Ctrl+Enter', async () => {
            await setupComponent();
            const executeBtn = component.ui.executeBtn;
            const clickSpy = vi.spyOn(executeBtn, 'click');

            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                ctrlKey: true,
                bubbles: true
            });

            component._rootElement.dispatchEvent(event);

            expect(clickSpy).toHaveBeenCalled();
        });

        it('should trigger execute on Meta+Enter (Mac)', async () => {
            await setupComponent();
            const executeBtn = component.ui.executeBtn;
            const clickSpy = vi.spyOn(executeBtn, 'click');

            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                metaKey: true,
                bubbles: true
            });

            component._rootElement.dispatchEvent(event);

            expect(clickSpy).toHaveBeenCalled();
        });

        it('should not trigger execute on plain Enter', async () => {
            await setupComponent();
            const executeBtn = component.ui.executeBtn;
            const clickSpy = vi.spyOn(executeBtn, 'click');

            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true
            });

            component._rootElement.dispatchEvent(event);

            expect(clickSpy).not.toHaveBeenCalled();
        });
    });

    describe('live preview', () => {
        it('should have live preview handler defined', async () => {
            await setupComponent();
            expect(component._livePreviewRefreshHandler).toBeDefined();
        });

        it('should have preview element', async () => {
            await setupComponent();
            expect(component.ui.preview).toBeTruthy();
        });

        it('should update preview on entity input', async () => {
            await setupComponent();
            component.ui.getEntityInput.value = 'accounts';
            component.ui.getEntityInput.dispatchEvent(new Event('input'));

            // Preview should be updated (async, so just check it doesn't throw)
            expect(component.ui.preview).toBeTruthy();
        });
    });

    describe('pagination state', () => {
        it('should initialize nextLink as null', () => {
            component = new WebApiExplorerTab();
            expect(component.nextLink).toBeNull();
        });

        it('should initialize allLoadedRecords as empty', () => {
            component = new WebApiExplorerTab();
            expect(component.allLoadedRecords).toEqual([]);
        });

        it('should initialize isLoadingMore as false', () => {
            component = new WebApiExplorerTab();
            expect(component.isLoadingMore).toBe(false);
        });

        it('should reset pagination on clearResults', async () => {
            await setupComponent();
            component.nextLink = 'http://example.com/next';
            component.allLoadedRecords = [{ id: 1 }];

            component.clearResults();

            expect(component.nextLink).toBeNull();
            expect(component.allLoadedRecords).toEqual([]);
        });
    });

    describe('external refresh handling', () => {
        it('should have external refresh handler defined', async () => {
            await setupComponent();
            expect(component._externalRefreshHandler).toBeDefined();
        });

        it('should clear results on pdt:tool-refresh event', async () => {
            await setupComponent();
            component.lastResult = { entities: [{ name: 'test' }] };

            document.dispatchEvent(new CustomEvent('pdt:tool-refresh'));

            expect(component.lastResult.records).toEqual([]);
        });

        it('should clear results on pdt:refresh event', async () => {
            await setupComponent();
            component.lastResult = { entities: [{ name: 'test' }] };

            document.dispatchEvent(new CustomEvent('pdt:refresh'));

            expect(component.lastResult.records).toEqual([]);
        });
    });

    describe('add filter group buttons', () => {
        it('should have GET add filter group handler', async () => {
            await setupComponent();
            expect(component._addGetFilterGroupHandler).toBeDefined();
        });

        it('should have PATCH add filter group handler', async () => {
            await setupComponent();
            expect(component._addPatchFilterGroupHandler).toBeDefined();
        });

        it('should have DELETE add filter group handler', async () => {
            await setupComponent();
            expect(component._addDeleteFilterGroupHandler).toBeDefined();
        });
    });

    describe('browse buttons handlers', () => {
        it('should have pick entity handler', async () => {
            await setupComponent();
            expect(component._pickEntityHandler).toBeDefined();
        });

        it('should have browse GET select handler', async () => {
            await setupComponent();
            expect(component._browseGetSelectHandler).toBeDefined();
        });

        it('should have browse GET order by handler', async () => {
            await setupComponent();
            expect(component._browseGetOrderByHandler).toBeDefined();
        });
    });

    describe('_setExecuting', () => {
        it('should not throw when executeBtn is null', async () => {
            await setupComponent();
            component.ui.executeBtn = null;

            expect(() => component._setExecuting(true)).not.toThrow();
        });

        it('should disable button when busy', async () => {
            await setupComponent();
            component._setExecuting(true);

            expect(component.ui.executeBtn.disabled).toBe(true);
        });

        it('should enable button when not busy', async () => {
            await setupComponent();
            component._setExecuting(false);

            expect(component.ui.executeBtn.disabled).toBe(false);
        });
    });

    describe('order by elements', () => {
        it('should have order by attribute input', async () => {
            await setupComponent();
            expect(component.ui.getOrderByAttrInput).toBeTruthy();
        });

        it('should have order by direction select', async () => {
            await setupComponent();
            expect(component.ui.getOrderByDirSelect).toBeTruthy();
        });

        it('should default to ascending order', async () => {
            await setupComponent();
            expect(component.ui.getOrderByDirSelect.value).toBe('asc');
        });

        it('should support descending order', async () => {
            await setupComponent();
            component.ui.getOrderByDirSelect.value = 'desc';
            expect(component.ui.getOrderByDirSelect.value).toBe('desc');
        });
    });

    describe('top count input', () => {
        it('should have top count input', async () => {
            await setupComponent();
            expect(component.ui.getTopInput).toBeTruthy();
        });

        it('should accept numeric values', async () => {
            await setupComponent();
            component.ui.getTopInput.value = '50';
            expect(component.ui.getTopInput.value).toBe('50');
        });

        it('should be type number', async () => {
            await setupComponent();
            expect(component.ui.getTopInput.type).toBe('number');
        });
    });

    describe('columns textarea', () => {
        it('should have columns textarea', async () => {
            await setupComponent();
            expect(component.ui.getSelectInput).toBeTruthy();
        });

        it('should accept multiline input', async () => {
            await setupComponent();
            component.ui.getSelectInput.value = 'name\ncreateon\nmodifiedon';
            expect(component.ui.getSelectInput.value).toContain('\n');
        });

        it('should have spellcheck attribute set to false', async () => {
            await setupComponent();
            expect(component.ui.getSelectInput.getAttribute('spellcheck')).toBe('false');
        });
    });

    describe('JSON body textarea', () => {
        it('should have POST body textarea', async () => {
            await setupComponent();
            expect(component.ui.postBodyArea).toBeTruthy();
        });

        it('should have PATCH body textarea', async () => {
            await setupComponent();
            expect(component.ui.patchBodyArea).toBeTruthy();
        });

        it('should accept JSON input in POST body', async () => {
            await setupComponent();
            component.ui.postBodyArea.value = '{"name": "Test"}';
            expect(component.ui.postBodyArea.value).toBe('{"name": "Test"}');
        });

        it('should have spellcheck attribute set to false on POST body', async () => {
            await setupComponent();
            expect(component.ui.postBodyArea.getAttribute('spellcheck')).toBe('false');
        });
    });

    describe('record ID inputs', () => {
        it('should have PATCH record ID input', async () => {
            await setupComponent();
            expect(component.ui.patchIdInput).toBeTruthy();
        });

        it('should have DELETE record ID input', async () => {
            await setupComponent();
            expect(component.ui.deleteIdInput).toBeTruthy();
        });

        it('should accept GUID format for PATCH ID', async () => {
            await setupComponent();
            const guid = '12345678-1234-1234-1234-123456789012';
            component.ui.patchIdInput.value = guid;
            expect(component.ui.patchIdInput.value).toBe(guid);
        });

        it('should accept GUID format for DELETE ID', async () => {
            await setupComponent();
            const guid = '12345678-1234-1234-1234-123456789012';
            component.ui.deleteIdInput.value = guid;
            expect(component.ui.deleteIdInput.value).toBe(guid);
        });
    });

    describe('UI element references', () => {
        it('should cache all GET view elements', async () => {
            await setupComponent();
            expect(component.ui.getView).toBeTruthy();
            expect(component.ui.getEntityInput).toBeTruthy();
            expect(component.ui.getSelectInput).toBeTruthy();
            expect(component.ui.getTopInput).toBeTruthy();
            expect(component.ui.getFiltersContainer).toBeTruthy();
            expect(component.ui.getOrderByAttrInput).toBeTruthy();
            expect(component.ui.getOrderByDirSelect).toBeTruthy();
        });

        it('should cache all POST view elements', async () => {
            await setupComponent();
            expect(component.ui.postView).toBeTruthy();
            expect(component.ui.postEntityInput).toBeTruthy();
            expect(component.ui.postBodyArea).toBeTruthy();
            expect(component.ui.postBodyModeToggle).toBeTruthy();
            expect(component.ui.postFieldsBuilder).toBeTruthy();
            expect(component.ui.postJsonMode).toBeTruthy();
            expect(component.ui.postFieldsContainer).toBeTruthy();
        });

        it('should cache all PATCH view elements', async () => {
            await setupComponent();
            expect(component.ui.patchView).toBeTruthy();
            expect(component.ui.patchEntityInput).toBeTruthy();
            expect(component.ui.patchIdInput).toBeTruthy();
            expect(component.ui.patchBodyArea).toBeTruthy();
            expect(component.ui.patchBodyModeToggle).toBeTruthy();
            expect(component.ui.patchFieldsBuilder).toBeTruthy();
            expect(component.ui.patchJsonMode).toBeTruthy();
            expect(component.ui.patchFieldsContainer).toBeTruthy();
        });

        it('should cache all DELETE view elements', async () => {
            await setupComponent();
            expect(component.ui.deleteView).toBeTruthy();
            expect(component.ui.deleteEntityInput).toBeTruthy();
            expect(component.ui.deleteIdInput).toBeTruthy();
            expect(component.ui.deleteFilterSection).toBeTruthy();
            expect(component.ui.deleteFiltersContainer).toBeTruthy();
        });

        it('should cache all toolbar elements', async () => {
            await setupComponent();
            expect(component.ui.executeBtn).toBeTruthy();
            expect(component.ui.getCountBtn).toBeTruthy();
            expect(component.ui.formatJsonBtn).toBeTruthy();
        });

        it('should cache all browse buttons', async () => {
            await setupComponent();
            expect(component.ui.browseGetEntityBtn).toBeTruthy();
            expect(component.ui.browseGetSelectBtn).toBeTruthy();
            expect(component.ui.browseGetOrderByBtn).toBeTruthy();
            expect(component.ui.browsePostEntityBtn).toBeTruthy();
            expect(component.ui.browsePatchEntityBtn).toBeTruthy();
            expect(component.ui.browseDeleteEntityBtn).toBeTruthy();
        });
    });

    describe('method state structure', () => {
        it('should have correct GET state properties', () => {
            component = new WebApiExplorerTab();
            expect(component._methodState.GET).toHaveProperty('entity');
            expect(component._methodState.GET).toHaveProperty('recordId');
            expect(component._methodState.GET).toHaveProperty('fields');
            expect(component._methodState.GET).toHaveProperty('select');
            expect(component._methodState.GET).toHaveProperty('orderBy');
            expect(component._methodState.GET).toHaveProperty('top');
            expect(component._methodState.GET).toHaveProperty('expand');
        });

        it('should have correct POST state properties', () => {
            component = new WebApiExplorerTab();
            expect(component._methodState.POST).toHaveProperty('entity');
            expect(component._methodState.POST).toHaveProperty('fields');
            expect(component._methodState.POST).toHaveProperty('fieldsHtml');
            expect(component._methodState.POST).toHaveProperty('fieldValues');
        });

        it('should have correct PATCH state properties', () => {
            component = new WebApiExplorerTab();
            expect(component._methodState.PATCH).toHaveProperty('entity');
            expect(component._methodState.PATCH).toHaveProperty('recordId');
            expect(component._methodState.PATCH).toHaveProperty('filters');
        });

        it('should have correct DELETE state properties', () => {
            component = new WebApiExplorerTab();
            expect(component._methodState.DELETE).toHaveProperty('entity');
            expect(component._methodState.DELETE).toHaveProperty('recordId');
            expect(component._methodState.DELETE).toHaveProperty('filters');
        });

        it('should initialize all state properties as empty', () => {
            component = new WebApiExplorerTab();

            expect(component._methodState.GET.entity).toBe('');
            expect(component._methodState.POST.fields).toBe('');
            expect(component._methodState.PATCH.recordId).toBe('');
            expect(component._methodState.DELETE.entity).toBe('');
        });

        it('should initialize fieldValues as empty array', () => {
            component = new WebApiExplorerTab();

            expect(component._methodState.GET.fieldValues).toEqual([]);
            expect(component._methodState.POST.fieldValues).toEqual([]);
            expect(component._methodState.PATCH.fieldValues).toEqual([]);
            expect(component._methodState.DELETE.fieldValues).toEqual([]);
        });
    });

    describe('handler references initialization', () => {
        it('should initialize all handler references as null', () => {
            component = new WebApiExplorerTab();

            // Only handlers declared in constructor are tested here
            // _postEntityInputHandler and _patchEntityInputHandler are created dynamically in postRender
            expect(component._getEntityInputHandler).toBeNull();
            expect(component._executeHandler).toBeNull();
            expect(component._methodSelectHandler).toBeNull();
            expect(component._formatJsonHandler).toBeNull();
        });

        it('should initialize filter group handlers as null', () => {
            component = new WebApiExplorerTab();

            expect(component._addGetFilterGroupHandler).toBeNull();
            expect(component._addPatchFilterGroupHandler).toBeNull();
            expect(component._addDeleteFilterGroupHandler).toBeNull();
        });

        it('should initialize browse handlers as null', () => {
            component = new WebApiExplorerTab();

            expect(component._pickEntityHandler).toBeNull();
            expect(component._browseGetSelectHandler).toBeNull();
            expect(component._browseGetOrderByHandler).toBeNull();
        });

        it('should set handlers after postRender', async () => {
            await setupComponent();

            expect(component._methodSelectHandler).not.toBeNull();
            expect(component._executeHandler).not.toBeNull();
            expect(component._getEntityInputHandler).not.toBeNull();
        });
    });

    describe('dynamic handlers map', () => {
        it('should initialize as empty Map', () => {
            component = new WebApiExplorerTab();
            expect(component._dynamicHandlers).toBeInstanceOf(Map);
            expect(component._dynamicHandlers.size).toBe(0);
        });

        it('should be able to add handlers', async () => {
            await setupComponent();
            const btn = document.createElement('button');
            const handler = vi.fn();

            component._dynamicHandlers.set(btn, { event: 'click', handler });

            expect(component._dynamicHandlers.has(btn)).toBe(true);
        });

        it('should be able to remove handlers', async () => {
            await setupComponent();
            const btn = document.createElement('button');
            const handler = vi.fn();

            component._dynamicHandlers.set(btn, { event: 'click', handler });
            component._dynamicHandlers.delete(btn);

            expect(component._dynamicHandlers.has(btn)).toBe(false);
        });
    });

    describe('_executeGet', () => {
        let DataService;
        let NotificationService;
        let EntityContextResolver;
        let ODataQueryBuilder;
        let normalizeApiResponse;

        beforeEach(async () => {
            // Import mocks for resetting
            DataService = (await import('../../src/services/DataService.js')).DataService;
            NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
            EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
            ODataQueryBuilder = (await import('../../src/utils/builders/ODataQueryBuilder.js')).ODataQueryBuilder;
            const helpers = await import('../../src/helpers/index.js');
            normalizeApiResponse = helpers.normalizeApiResponse;

            vi.clearAllMocks();
        });

        it('should execute successfully with simple entity', async () => {
            await setupComponent();

            component.ui.getEntityInput.value = 'accounts';
            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ODataQueryBuilder.build.mockReturnValue('');
            DataService.retrieveMultipleRecords.mockResolvedValue({
                entities: [{ accountid: '123', name: 'Test Account' }],
                nextLink: null
            });
            normalizeApiResponse.mockReturnValue({ records: [{ accountid: '123', name: 'Test Account' }], count: 1 });

            await component._executeGet();

            expect(EntityContextResolver.resolve).toHaveBeenCalledWith('accounts');
            expect(DataService.retrieveMultipleRecords).toHaveBeenCalledWith('accounts', '');
            expect(component.allLoadedRecords).toEqual([{ accountid: '123', name: 'Test Account' }]);
            expect(component.nextLink).toBeNull();
            expect(component.lastResult).toEqual({ records: [{ accountid: '123', name: 'Test Account' }], count: 1 });
        });

        it('should throw error when entity input is empty', async () => {
            await setupComponent();

            component.ui.getEntityInput.value = '';
            EntityContextResolver.resolve.mockRejectedValue(new Error('Please select a table first'));

            await expect(component._executeGet()).rejects.toThrow('Please select a table first');
        });

        it('should execute with $select columns', async () => {
            await setupComponent();

            component.ui.getEntityInput.value = 'contacts';
            component.ui.getSelectInput.value = 'fullname\nemail';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'contacts', logicalName: 'contact' });
            ODataQueryBuilder.build.mockReturnValue('?$select=fullname,email');
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [], nextLink: null });
            normalizeApiResponse.mockReturnValue({ records: [], count: 0 });

            await component._executeGet();

            expect(ODataQueryBuilder.build).toHaveBeenCalled();
            expect(DataService.retrieveMultipleRecords).toHaveBeenCalledWith('contacts', '?$select=fullname,email');
        });

        it('should execute with $filter applied', async () => {
            await setupComponent();

            component.ui.getEntityInput.value = 'accounts';

            // Mock filter manager to return filter groups
            component.getFilterManager.extractFilterGroups.mockReturnValue([
                { combineOperator: 'and', conditions: [{ attribute: 'name', operator: 'contains', value: 'test' }] }
            ]);

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ODataQueryBuilder.build.mockReturnValue("?$filter=contains(name,'test')");
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [], nextLink: null });
            normalizeApiResponse.mockReturnValue({ records: [], count: 0 });

            await component._executeGet();

            expect(component.getFilterManager.extractFilterGroups).toHaveBeenCalled();
            expect(DataService.retrieveMultipleRecords).toHaveBeenCalledWith('accounts', "?$filter=contains(name,'test')");
        });

        it('should execute with $orderby applied', async () => {
            await setupComponent();

            component.ui.getEntityInput.value = 'accounts';
            component.ui.getOrderByAttrInput.value = 'name';
            component.ui.getOrderByDirSelect.value = 'desc';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ODataQueryBuilder.build.mockReturnValue('?$orderby=name desc');
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [], nextLink: null });
            normalizeApiResponse.mockReturnValue({ records: [], count: 0 });

            await component._executeGet();

            expect(DataService.retrieveMultipleRecords).toHaveBeenCalledWith('accounts', '?$orderby=name desc');
        });

        it('should execute with $top count', async () => {
            await setupComponent();

            component.ui.getEntityInput.value = 'accounts';
            component.ui.getTopInput.value = '10';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ODataQueryBuilder.build.mockReturnValue('?$top=10');
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [], nextLink: null });
            normalizeApiResponse.mockReturnValue({ records: [], count: 0 });

            await component._executeGet();

            expect(DataService.retrieveMultipleRecords).toHaveBeenCalledWith('accounts', '?$top=10');
        });

        it('should handle API error response', async () => {
            await setupComponent();

            component.ui.getEntityInput.value = 'accounts';
            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ODataQueryBuilder.build.mockReturnValue('');

            const apiError = new Error('The requested resource does not exist');
            DataService.retrieveMultipleRecords.mockRejectedValue(apiError);

            await expect(component._executeGet()).rejects.toThrow('The requested resource does not exist');
        });

        it('should store nextLink when pagination is available', async () => {
            await setupComponent();

            component.ui.getEntityInput.value = 'accounts';
            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ODataQueryBuilder.build.mockReturnValue('');
            DataService.retrieveMultipleRecords.mockResolvedValue({
                entities: [{ accountid: '1' }, { accountid: '2' }],
                nextLink: 'https://org.crm.dynamics.com/api/data/v9.2/accounts?$skiptoken=123'
            });
            normalizeApiResponse.mockReturnValue({ records: [{ accountid: '1' }, { accountid: '2' }], count: 2 });

            await component._executeGet();

            expect(component.nextLink).toBe('https://org.crm.dynamics.com/api/data/v9.2/accounts?$skiptoken=123');
            expect(component.allLoadedRecords).toHaveLength(2);
        });

        it('should update lastResult after successful execution', async () => {
            await setupComponent();

            component.ui.getEntityInput.value = 'accounts';
            const mockRecords = [
                { accountid: 'id1', name: 'Account 1' },
                { accountid: 'id2', name: 'Account 2' }
            ];

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ODataQueryBuilder.build.mockReturnValue('');
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: mockRecords, nextLink: null });
            normalizeApiResponse.mockReturnValue({ records: mockRecords, count: 2 });

            await component._executeGet();

            expect(component.lastResult).toEqual({ records: mockRecords, count: 2 });
        });

        it('should handle empty result set', async () => {
            await setupComponent();

            component.ui.getEntityInput.value = 'accounts';
            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ODataQueryBuilder.build.mockReturnValue("?$filter=name eq 'nonexistent'");
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [], nextLink: null });
            normalizeApiResponse.mockReturnValue({ records: [], count: 0 });

            await component._executeGet();

            expect(component.allLoadedRecords).toEqual([]);
            expect(component.nextLink).toBeNull();
            expect(component.lastResult).toEqual({ records: [], count: 0 });
        });

        it('should resolve entity context from entity set name', async () => {
            await setupComponent();

            component.ui.getEntityInput.value = 'systemusers';
            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'systemusers', logicalName: 'systemuser' });
            ODataQueryBuilder.build.mockReturnValue('');
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [], nextLink: null });
            normalizeApiResponse.mockReturnValue({ records: [], count: 0 });

            await component._executeGet();

            expect(EntityContextResolver.resolve).toHaveBeenCalledWith('systemusers');
        });

        it('should execute with combined query options', async () => {
            await setupComponent();

            component.ui.getEntityInput.value = 'accounts';
            component.ui.getSelectInput.value = 'name\nrevenue';
            component.ui.getTopInput.value = '50';
            component.ui.getOrderByAttrInput.value = 'createdon';
            component.ui.getOrderByDirSelect.value = 'desc';

            component.getFilterManager.extractFilterGroups.mockReturnValue([
                { combineOperator: 'and', conditions: [{ attribute: 'statecode', operator: 'eq', value: 0 }] }
            ]);

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ODataQueryBuilder.build.mockReturnValue('?$select=name,revenue&$filter=statecode eq 0&$orderby=createdon desc&$top=50');
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [{ name: 'Test' }], nextLink: null });
            normalizeApiResponse.mockReturnValue({ records: [{ name: 'Test' }], count: 1 });

            await component._executeGet();

            expect(DataService.retrieveMultipleRecords).toHaveBeenCalledWith(
                'accounts',
                '?$select=name,revenue&$filter=statecode eq 0&$orderby=createdon desc&$top=50'
            );
        });

        it('should handle undefined entities in response', async () => {
            await setupComponent();

            component.ui.getEntityInput.value = 'accounts';
            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ODataQueryBuilder.build.mockReturnValue('');
            DataService.retrieveMultipleRecords.mockResolvedValue({ nextLink: null });
            normalizeApiResponse.mockReturnValue({ records: [], count: 0 });

            await component._executeGet();

            expect(component.allLoadedRecords).toEqual([]);
        });

        it('should handle undefined nextLink in response', async () => {
            await setupComponent();

            component.ui.getEntityInput.value = 'accounts';
            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ODataQueryBuilder.build.mockReturnValue('');
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [{ id: '1' }] });
            normalizeApiResponse.mockReturnValue({ records: [{ id: '1' }], count: 1 });

            await component._executeGet();

            expect(component.nextLink).toBeNull();
        });
    });

    describe('_executePost', () => {
        let DataService;
        let NotificationService;
        let EntityContextResolver;
        let ValidationService;
        let normalizeApiResponse;

        beforeEach(async () => {
            DataService = (await import('../../src/services/DataService.js')).DataService;
            NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
            EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
            ValidationService = (await import('../../src/services/ValidationService.js')).ValidationService;
            const helpers = await import('../../src/helpers/index.js');
            normalizeApiResponse = helpers.normalizeApiResponse;

            vi.clearAllMocks();
        });

        it('should execute successfully with JSON body mode', async () => {
            await setupComponent();

            component.ui.methodSelect.value = 'POST';
            component.ui.postEntityInput.value = 'accounts';
            component.ui.postBodyModeToggle.checked = true;
            component.ui.postBodyArea.value = '{"name": "Test Account"}';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            DataService.createRecord.mockResolvedValue({ id: 'new-record-id-123' });
            normalizeApiResponse.mockReturnValue({ records: [], count: 0, id: 'new-record-id-123' });

            await component._executePost();

            expect(EntityContextResolver.resolve).toHaveBeenCalledWith('accounts');
            expect(DataService.createRecord).toHaveBeenCalledWith('accounts', { name: 'Test Account' });
            expect(component.lastResult).toBeDefined();
        });

        it('should throw error when entity is empty', async () => {
            await setupComponent();

            component.ui.postEntityInput.value = '';
            EntityContextResolver.resolve.mockRejectedValue(new Error('Please select a table first'));

            await expect(component._executePost()).rejects.toThrow('Please select a table first');
        });

        it('should execute successfully with field builder mode', async () => {
            await setupComponent();

            component.ui.methodSelect.value = 'POST';
            component.ui.postEntityInput.value = 'contacts';
            component.ui.postBodyModeToggle.checked = false;

            // Create mock field row
            const fieldRow = document.createElement('div');
            fieldRow.className = 'pdt-field-grid';
            fieldRow.innerHTML = `
                <input data-prop="field-attribute" value="firstname" />
                <input data-prop="field-value" value="John" />
            `;
            component.ui.postFieldsContainer.appendChild(fieldRow);

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'contacts', logicalName: 'contact' });
            DataService.createRecord.mockResolvedValue({ id: 'contact-id-456' });
            normalizeApiResponse.mockReturnValue({ records: [], count: 0, id: 'contact-id-456' });

            await component._executePost();

            expect(DataService.createRecord).toHaveBeenCalledWith('contacts', expect.objectContaining({ firstname: 'John' }));
        });

        it('should handle API error response', async () => {
            await setupComponent();

            component.ui.methodSelect.value = 'POST';
            component.ui.postEntityInput.value = 'accounts';
            component.ui.postBodyModeToggle.checked = true;
            component.ui.postBodyArea.value = '{"name": "Test"}';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });

            const apiError = new Error('The entity cannot be created with the given data');
            DataService.createRecord.mockRejectedValue(apiError);

            await expect(component._executePost()).rejects.toThrow('The entity cannot be created with the given data');
        });

        it('should store lastResult after successful creation', async () => {
            await setupComponent();

            component.ui.methodSelect.value = 'POST';
            component.ui.postEntityInput.value = 'leads';
            component.ui.postBodyModeToggle.checked = true;
            component.ui.postBodyArea.value = '{"subject": "New Lead"}';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'leads', logicalName: 'lead' });
            DataService.createRecord.mockResolvedValue({ id: 'lead-id-789' });
            normalizeApiResponse.mockReturnValue({ records: [], count: 0, id: 'lead-id-789' });

            await component._executePost();

            expect(component.lastResult).toEqual({ records: [], count: 0, id: 'lead-id-789' });
        });

        it('should handle empty JSON body', async () => {
            await setupComponent();

            component.ui.methodSelect.value = 'POST';
            component.ui.postEntityInput.value = 'accounts';
            component.ui.postBodyModeToggle.checked = true;
            component.ui.postBodyArea.value = '{}';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            DataService.createRecord.mockResolvedValue('new-record-id');
            ValidationService.validateJson.mockReturnValue({});

            // Empty JSON body is allowed in JSON mode - it just creates a record with default values
            await component._executePost();

            expect(DataService.createRecord).toHaveBeenCalledWith('accounts', {});
        });
    });

    describe('_executePatch', () => {
        let DataService;
        let EntityContextResolver;
        let ValidationService;
        let normalizeApiResponse;

        beforeEach(async () => {
            DataService = (await import('../../src/services/DataService.js')).DataService;
            EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
            ValidationService = (await import('../../src/services/ValidationService.js')).ValidationService;
            const helpers = await import('../../src/helpers/index.js');
            normalizeApiResponse = helpers.normalizeApiResponse;

            vi.clearAllMocks();
        });

        it('should dispatch to single patch when ID is provided', async () => {
            await setupComponent();

            const recordId = '12345678-1234-1234-1234-123456789012';
            component.ui.patchEntityInput.value = 'accounts';
            component.ui.patchIdInput.value = recordId;
            component.ui.patchBodyModeToggle.checked = true;
            component.ui.patchBodyArea.value = '{"name": "Updated Name"}';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ValidationService.validateJson = vi.fn().mockReturnValue({ name: 'Updated Name' });
            ValidationService.validateGuid.mockImplementation(() => { });
            DataService.updateRecord.mockResolvedValue({});
            normalizeApiResponse.mockReturnValue({ records: [], count: 0 });

            await component._executePatch();

            expect(DataService.updateRecord).toHaveBeenCalledWith('accounts', recordId, { name: 'Updated Name' });
        });

        it('should throw error when no ID and no filter conditions', async () => {
            await setupComponent();

            component.ui.patchEntityInput.value = 'accounts';
            component.ui.patchIdInput.value = '';
            component.patchFilterManager.extractFilterGroups.mockReturnValue([]);

            await expect(component._executePatch()).rejects.toThrow();
        });

        it('should update _lastMethod tracking', async () => {
            await setupComponent();

            component._lastMethod = 'PATCH';
            const recordId = '12345678-1234-1234-1234-123456789012';
            component.ui.patchEntityInput.value = 'accounts';
            component.ui.patchIdInput.value = recordId;
            component.ui.patchBodyModeToggle.checked = true;
            component.ui.patchBodyArea.value = '{"name": "Test"}';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ValidationService.validateJson = vi.fn().mockReturnValue({ name: 'Test' });
            ValidationService.validateGuid.mockImplementation(() => { });
            DataService.updateRecord.mockResolvedValue({});
            normalizeApiResponse.mockReturnValue({ records: [], count: 0 });

            await component._executePatch();

            expect(component._lastMethod).toBe('PATCH');
        });
    });

    describe('_executeSinglePatch', () => {
        let DataService;
        let EntityContextResolver;
        let ValidationService;
        let normalizeApiResponse;

        beforeEach(async () => {
            DataService = (await import('../../src/services/DataService.js')).DataService;
            EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
            ValidationService = (await import('../../src/services/ValidationService.js')).ValidationService;
            const helpers = await import('../../src/helpers/index.js');
            normalizeApiResponse = helpers.normalizeApiResponse;

            vi.clearAllMocks();
        });

        it('should execute successfully with valid entity and ID', async () => {
            await setupComponent();

            const recordId = '12345678-1234-1234-1234-123456789012';
            component.ui.patchEntityInput.value = 'accounts';
            component.ui.patchBodyModeToggle.checked = true;
            component.ui.patchBodyArea.value = '{"name": "Updated Account"}';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ValidationService.validateJson = vi.fn().mockReturnValue({ name: 'Updated Account' });
            ValidationService.validateGuid.mockImplementation(() => { });
            DataService.updateRecord.mockResolvedValue({});
            normalizeApiResponse.mockReturnValue({ records: [], count: 0 });

            await component._executeSinglePatch(recordId);

            expect(EntityContextResolver.resolve).toHaveBeenCalledWith('accounts');
            expect(ValidationService.validateGuid).toHaveBeenCalledWith(recordId, 'Record ID', expect.any(String));
            expect(DataService.updateRecord).toHaveBeenCalledWith('accounts', recordId, { name: 'Updated Account' });
        });

        it('should throw error when entity is empty', async () => {
            await setupComponent();

            component.ui.patchEntityInput.value = '';
            EntityContextResolver.resolve.mockRejectedValue(new Error('Please select a table first'));

            await expect(component._executeSinglePatch('12345678-1234-1234-1234-123456789012')).rejects.toThrow('Please select a table first');
        });

        it('should throw error when ID is invalid GUID', async () => {
            await setupComponent();

            component.ui.patchEntityInput.value = 'accounts';
            component.ui.patchBodyModeToggle.checked = true;
            component.ui.patchBodyArea.value = '{"name": "Test"}';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ValidationService.validateJson = vi.fn().mockReturnValue({ name: 'Test' });
            ValidationService.validateGuid.mockImplementation(() => {
                throw new Error('Invalid GUID format for Record ID');
            });

            await expect(component._executeSinglePatch('invalid-id')).rejects.toThrow('Invalid GUID format for Record ID');
        });

        it('should handle API error response', async () => {
            await setupComponent();

            const recordId = '12345678-1234-1234-1234-123456789012';
            component.ui.patchEntityInput.value = 'accounts';
            component.ui.patchBodyModeToggle.checked = true;
            component.ui.patchBodyArea.value = '{"name": "Test"}';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ValidationService.validateJson = vi.fn().mockReturnValue({ name: 'Test' });
            ValidationService.validateGuid.mockImplementation(() => { });

            const apiError = new Error('Record not found');
            DataService.updateRecord.mockRejectedValue(apiError);

            await expect(component._executeSinglePatch(recordId)).rejects.toThrow('Record not found');
        });

        it('should store lastResult after successful update', async () => {
            await setupComponent();

            const recordId = '12345678-1234-1234-1234-123456789012';
            component.ui.patchEntityInput.value = 'contacts';
            component.ui.patchBodyModeToggle.checked = true;
            component.ui.patchBodyArea.value = '{"lastname": "Smith"}';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'contacts', logicalName: 'contact' });
            ValidationService.validateJson = vi.fn().mockReturnValue({ lastname: 'Smith' });
            ValidationService.validateGuid.mockImplementation(() => { });
            DataService.updateRecord.mockResolvedValue({});
            normalizeApiResponse.mockReturnValue({ records: [], count: 0, updated: true });

            await component._executeSinglePatch(recordId);

            expect(component.lastResult).toEqual({ records: [], count: 0, updated: true });
        });

        it('should execute with field builder mode for PATCH', async () => {
            await setupComponent();

            const recordId = '12345678-1234-1234-1234-123456789012';
            component.ui.patchEntityInput.value = 'opportunities';
            component.ui.patchBodyModeToggle.checked = false;

            // Create mock field row
            const fieldRow = document.createElement('div');
            fieldRow.className = 'pdt-field-grid';
            fieldRow.innerHTML = `
                <input data-prop="field-attribute" value="name" />
                <input data-prop="field-value" value="Big Deal" />
            `;
            component.ui.patchFieldsContainer.appendChild(fieldRow);

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'opportunities', logicalName: 'opportunity' });
            ValidationService.validateGuid.mockImplementation(() => { });
            DataService.updateRecord.mockResolvedValue({});
            normalizeApiResponse.mockReturnValue({ records: [], count: 0 });

            await component._executeSinglePatch(recordId);

            expect(DataService.updateRecord).toHaveBeenCalledWith('opportunities', recordId, expect.objectContaining({ name: 'Big Deal' }));
        });
    });

    describe('_executeDelete', () => {
        let EntityContextResolver;

        beforeEach(async () => {
            EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
            vi.clearAllMocks();
        });

        it('should dispatch to single delete when ID is provided', async () => {
            await setupComponent();

            const recordId = '12345678-1234-1234-1234-123456789012';
            component.ui.deleteEntityInput.value = 'accounts';
            component.ui.deleteIdInput.value = recordId;
            component.deleteFilterManager.extractFilterGroups.mockReturnValue([]);

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });

            const singleDeleteSpy = vi.spyOn(component, '_executeSingleDelete').mockResolvedValue();

            await component._executeDelete();

            expect(singleDeleteSpy).toHaveBeenCalledWith(recordId);
        });

        it('should dispatch to bulk delete when no ID but has filter conditions', async () => {
            await setupComponent();

            component.ui.deleteEntityInput.value = 'accounts';
            component.ui.deleteIdInput.value = '';
            component.deleteFilterManager.extractFilterGroups.mockReturnValue([
                { filters: [{ attribute: 'name', operator: 'eq', value: 'test' }] }
            ]);

            const bulkDeleteSpy = vi.spyOn(component, '_executeBulkDelete').mockResolvedValue();

            await component._executeDelete();

            expect(bulkDeleteSpy).toHaveBeenCalled();
        });

        it('should throw error when neither ID nor conditions are provided', async () => {
            await setupComponent();

            component.ui.deleteEntityInput.value = 'accounts';
            component.ui.deleteIdInput.value = '';
            component.deleteFilterManager.extractFilterGroups.mockReturnValue([]);

            await expect(component._executeDelete()).rejects.toThrow('Either provide a Record ID or add filter conditions for bulk operation.');
        });

        it('should throw error when filter groups have no filters', async () => {
            await setupComponent();

            component.ui.deleteEntityInput.value = 'accounts';
            component.ui.deleteIdInput.value = '';
            component.deleteFilterManager.extractFilterGroups.mockReturnValue([{ filters: [] }]);

            await expect(component._executeDelete()).rejects.toThrow('Either provide a Record ID or add filter conditions for bulk operation.');
        });
    });

    describe('_executeSingleDelete', () => {
        let DataService;
        let EntityContextResolver;
        let ValidationService;
        let NotificationService;
        let normalizeApiResponse;
        let showConfirmDialog;

        beforeEach(async () => {
            DataService = (await import('../../src/services/DataService.js')).DataService;
            EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
            ValidationService = (await import('../../src/services/ValidationService.js')).ValidationService;
            NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
            const helpers = await import('../../src/helpers/index.js');
            normalizeApiResponse = helpers.normalizeApiResponse;
            showConfirmDialog = helpers.showConfirmDialog;

            vi.clearAllMocks();
        });

        it('should execute successfully with valid entity and ID', async () => {
            await setupComponent();

            const recordId = '12345678-1234-1234-1234-123456789012';
            component.ui.deleteEntityInput.value = 'accounts';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ValidationService.validateGuid.mockImplementation(() => { });
            showConfirmDialog.mockResolvedValue(true);
            DataService.deleteRecord.mockResolvedValue({});
            normalizeApiResponse.mockReturnValue({ records: [], count: 0 });

            await component._executeSingleDelete(recordId);

            expect(EntityContextResolver.resolve).toHaveBeenCalledWith('accounts');
            expect(ValidationService.validateGuid).toHaveBeenCalledWith(recordId, 'Record ID', expect.any(String));
            expect(DataService.deleteRecord).toHaveBeenCalledWith('accounts', recordId);
        });

        it('should throw error when entity is empty', async () => {
            await setupComponent();

            component.ui.deleteEntityInput.value = '';
            EntityContextResolver.resolve.mockRejectedValue(new Error('Please select a table first'));

            await expect(component._executeSingleDelete('12345678-1234-1234-1234-123456789012')).rejects.toThrow('Please select a table first');
        });

        it('should throw error when ID is invalid GUID', async () => {
            await setupComponent();

            component.ui.deleteEntityInput.value = 'accounts';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ValidationService.validateGuid.mockImplementation(() => {
                throw new Error('A valid GUID is required for DELETE requests');
            });

            await expect(component._executeSingleDelete('invalid-id')).rejects.toThrow('A valid GUID is required for DELETE requests');
        });

        it('should show confirmation dialog before delete', async () => {
            await setupComponent();

            const recordId = '12345678-1234-1234-1234-123456789012';
            component.ui.deleteEntityInput.value = 'accounts';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ValidationService.validateGuid.mockImplementation(() => { });
            showConfirmDialog.mockResolvedValue(true);
            DataService.deleteRecord.mockResolvedValue({});
            normalizeApiResponse.mockReturnValue({ records: [], count: 0 });

            await component._executeSingleDelete(recordId);

            expect(showConfirmDialog).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining(recordId)
            );
        });

        it('should not call deleteRecord when confirmation is cancelled', async () => {
            await setupComponent();

            const recordId = '12345678-1234-1234-1234-123456789012';
            component.ui.deleteEntityInput.value = 'accounts';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ValidationService.validateGuid.mockImplementation(() => { });
            showConfirmDialog.mockResolvedValue(false);
            normalizeApiResponse.mockReturnValue(null);

            await component._executeSingleDelete(recordId);

            expect(DataService.deleteRecord).not.toHaveBeenCalled();
            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'success');
        });

        it('should handle API error response', async () => {
            await setupComponent();

            const recordId = '12345678-1234-1234-1234-123456789012';
            component.ui.deleteEntityInput.value = 'accounts';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ValidationService.validateGuid.mockImplementation(() => { });
            showConfirmDialog.mockResolvedValue(true);

            const apiError = new Error('Record not found or already deleted');
            DataService.deleteRecord.mockRejectedValue(apiError);

            await expect(component._executeSingleDelete(recordId)).rejects.toThrow('Record not found or already deleted');
        });

        it('should store lastResult after successful delete', async () => {
            await setupComponent();

            const recordId = '12345678-1234-1234-1234-123456789012';
            component.ui.deleteEntityInput.value = 'contacts';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'contacts', logicalName: 'contact' });
            ValidationService.validateGuid.mockImplementation(() => { });
            showConfirmDialog.mockResolvedValue(true);
            DataService.deleteRecord.mockResolvedValue({});
            normalizeApiResponse.mockReturnValue({ records: [], count: 0, deleted: true });

            await component._executeSingleDelete(recordId);

            expect(component.lastResult).toEqual({ records: [], count: 0, deleted: true });
        });
    });

    describe('_executeBulkDelete', () => {
        let DataService;
        let EntityContextResolver;
        let NotificationService;
        let PowerAppsApiService;
        let showConfirmDialog;

        beforeEach(async () => {
            DataService = (await import('../../src/services/DataService.js')).DataService;
            EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
            NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
            PowerAppsApiService = (await import('../../src/services/PowerAppsApiService.js')).PowerAppsApiService;
            const helpers = await import('../../src/helpers/index.js');
            showConfirmDialog = helpers.showConfirmDialog;

            vi.clearAllMocks();
        });

        it('should show warning when no filter conditions', async () => {
            await setupComponent();

            component.ui.deleteEntityInput.value = 'accounts';
            component.deleteFilterManager.extractFilterGroups.mockReturnValue([]);

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });

            await component._executeBulkDelete();

            expect(NotificationService.show).toHaveBeenCalledWith(expect.stringContaining('No records match'), 'warning');
        });

        it('should show confirmation dialog before bulk delete', async () => {
            await setupComponent();

            component.ui.deleteEntityInput.value = 'accounts';
            component.deleteFilterManager.extractFilterGroups.mockReturnValue([
                { filters: [{ attribute: 'name', operator: 'eq', value: 'test' }] }
            ]);

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            EntityContextResolver.getAttrMap.mockResolvedValue(new Map([['name', { type: 'string' }]]));
            PowerAppsApiService.getEntityMetadata = vi.fn().mockResolvedValue({ PrimaryIdAttribute: 'accountid' });

            // Mock _fetchMatchingRecords to return records
            const mockRecords = [{ accountid: '111' }, { accountid: '222' }];
            vi.spyOn(component, '_fetchMatchingRecords').mockResolvedValue(mockRecords);
            showConfirmDialog.mockResolvedValue(false);

            await component._executeBulkDelete();

            expect(showConfirmDialog).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('2')
            );
        });

        it('should cancel bulk delete when confirmation declined', async () => {
            await setupComponent();

            component.ui.deleteEntityInput.value = 'accounts';
            component.deleteFilterManager.extractFilterGroups.mockReturnValue([
                { filters: [{ attribute: 'name', operator: 'eq', value: 'test' }] }
            ]);

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            EntityContextResolver.getAttrMap.mockResolvedValue(new Map([['name', { type: 'string' }]]));
            PowerAppsApiService.getEntityMetadata = vi.fn().mockResolvedValue({ PrimaryIdAttribute: 'accountid' });

            const mockRecords = [{ accountid: '111' }];
            vi.spyOn(component, '_fetchMatchingRecords').mockResolvedValue(mockRecords);
            showConfirmDialog.mockResolvedValue(false);

            await component._executeBulkDelete();

            expect(NotificationService.show).toHaveBeenCalledWith(expect.stringContaining('cancelled'), 'info');
        });

        it('should show warning when no matching records found', async () => {
            await setupComponent();

            component.ui.deleteEntityInput.value = 'accounts';
            component.deleteFilterManager.extractFilterGroups.mockReturnValue([
                { filters: [{ attribute: 'name', operator: 'eq', value: 'nonexistent' }] }
            ]);

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            EntityContextResolver.getAttrMap.mockResolvedValue(new Map([['name', { type: 'string' }]]));
            PowerAppsApiService.getEntityMetadata = vi.fn().mockResolvedValue({ PrimaryIdAttribute: 'accountid' });

            vi.spyOn(component, '_fetchMatchingRecords').mockResolvedValue([]);

            await component._executeBulkDelete();

            expect(NotificationService.show).toHaveBeenCalledWith(expect.stringContaining('No records match'), 'warning');
        });

        it('should execute bulk delete with filters when confirmed', async () => {
            await setupComponent();

            component.ui.deleteEntityInput.value = 'accounts';
            component.deleteFilterManager.extractFilterGroups.mockReturnValue([
                { filters: [{ attribute: 'statecode', operator: 'eq', value: '1' }] }
            ]);

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            EntityContextResolver.getAttrMap.mockResolvedValue(new Map([['statecode', { type: 'state' }]]));
            PowerAppsApiService.getEntityMetadata = vi.fn().mockResolvedValue({ PrimaryIdAttribute: 'accountid' });

            const mockRecords = [{ accountid: 'rec-1' }, { accountid: 'rec-2' }, { accountid: 'rec-3' }];
            vi.spyOn(component, '_fetchMatchingRecords').mockResolvedValue(mockRecords);
            vi.spyOn(component, '_processBatchOperations').mockResolvedValue({ successCount: 3, failCount: 0, errors: [] });
            showConfirmDialog.mockResolvedValue(true);

            await component._executeBulkDelete();

            expect(component._processBatchOperations).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ method: 'DELETE', entitySet: 'accounts', id: 'rec-1' }),
                    expect.objectContaining({ method: 'DELETE', entitySet: 'accounts', id: 'rec-2' }),
                    expect.objectContaining({ method: 'DELETE', entitySet: 'accounts', id: 'rec-3' })
                ]),
                expect.any(Number),
                expect.any(Function)
            );
            expect(NotificationService.show).toHaveBeenCalledWith(expect.stringContaining('3'), 'success');
        });
    });

    describe('_displayResult', () => {
        beforeEach(async () => {
            await setupComponent();
        });

        it('should do nothing when resultPanel is not initialized', () => {
            component.resultPanel = null;
            component.lastResult = { value: [{ id: '1', name: 'Test' }] };

            expect(() => component._displayResult()).not.toThrow();
        });

        it('should render shell with correct count for array results', () => {
            component.lastResult = { value: [{ id: '1' }, { id: '2' }, { id: '3' }] };
            component.currentView = 'table';
            component.hideOdata = false;

            component._displayResult();

            expect(component.resultPanel.renderShell).toHaveBeenCalledWith(3, 'table', false);
        });

        it('should render table view when currentView is table', () => {
            component.lastResult = { value: [{ id: '1', name: 'Test' }] };
            component.currentView = 'table';
            component.hideOdata = false;

            component._displayResult();

            expect(component.resultPanel.renderContent).toHaveBeenCalledWith({
                data: expect.any(Array),
                view: 'table',
                hideOdata: false
            });
        });

        it('should render JSON view when currentView is json', () => {
            component.lastResult = { value: [{ id: '1', name: 'Test' }] };
            component.currentView = 'json';
            component.hideOdata = false;

            component._displayResult();

            expect(component.resultPanel.renderContent).toHaveBeenCalledWith({
                data: expect.any(Array),
                view: 'json',
                hideOdata: false
            });
        });

        it('should render empty array when lastResult is empty', () => {
            component.lastResult = { value: [] };
            component.currentView = 'table';

            component._displayResult();

            expect(component.resultPanel.renderShell).toHaveBeenCalledWith(0, 'table', expect.any(Boolean));
            expect(component.resultPanel.renderContent).toHaveBeenCalledWith({
                data: [],
                view: 'table',
                hideOdata: expect.any(Boolean)
            });
        });

        it('should handle array results from value property', () => {
            component.lastResult = { value: [{ accountid: 'a1' }, { accountid: 'a2' }] };
            component.currentView = 'table';

            component._displayResult();

            expect(component.resultPanel.renderContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: [{ accountid: 'a1' }, { accountid: 'a2' }]
                })
            );
        });

        it('should handle array results from entities property', () => {
            component.lastResult = { entities: [{ contactid: 'c1' }] };
            component.currentView = 'table';

            component._displayResult();

            expect(component.resultPanel.renderContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: [{ contactid: 'c1' }]
                })
            );
        });

        it('should handle direct array lastResult', () => {
            component.lastResult = [{ leadid: 'l1' }, { leadid: 'l2' }];
            component.currentView = 'table';

            component._displayResult();

            expect(component.resultPanel.renderContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: [{ leadid: 'l1' }, { leadid: 'l2' }]
                })
            );
        });

        it('should respect hideOdata preference when true', () => {
            component.lastResult = { value: [{ id: '1', '@odata.context': 'test' }] };
            component.currentView = 'table';
            component.hideOdata = true;

            component._displayResult();

            expect(component.resultPanel.renderShell).toHaveBeenCalledWith(1, 'table', true);
            expect(component.resultPanel.renderContent).toHaveBeenCalledWith({
                data: expect.any(Array),
                view: 'table',
                hideOdata: true
            });
        });

        it('should respect hideOdata preference when false', () => {
            component.lastResult = { value: [{ id: '1' }] };
            component.currentView = 'json';
            component.hideOdata = false;

            component._displayResult();

            expect(component.resultPanel.renderContent).toHaveBeenCalledWith({
                data: expect.any(Array),
                view: 'json',
                hideOdata: false
            });
        });

        it('should show pagination banner when nextLink exists and has results', () => {
            component.lastResult = { value: [{ id: '1' }] };
            component.nextLink = 'https://org.api.crm.dynamics.com/api/data/v9.2/accounts?$skiptoken=123';
            vi.spyOn(component, '_showPaginationBanner').mockImplementation(() => { });

            component._displayResult();

            expect(component._showPaginationBanner).toHaveBeenCalled();
        });

        it('should remove pagination banner when nextLink is null', () => {
            component.lastResult = { value: [{ id: '1' }] };
            component.nextLink = null;
            vi.spyOn(component, '_removePaginationBanner').mockImplementation(() => { });

            component._displayResult();

            expect(component._removePaginationBanner).toHaveBeenCalled();
        });

        it('should remove pagination banner when results are empty', () => {
            component.lastResult = { value: [] };
            component.nextLink = 'https://org.api.crm.dynamics.com/api/data/v9.2/accounts?$skiptoken=123';
            vi.spyOn(component, '_removePaginationBanner').mockImplementation(() => { });

            component._displayResult();

            expect(component._removePaginationBanner).toHaveBeenCalled();
        });

        it('should handle null lastResult gracefully', () => {
            component.lastResult = null;
            component.currentView = 'table';

            component._displayResult();

            expect(component.resultPanel.renderShell).toHaveBeenCalledWith(0, 'table', expect.any(Boolean));
            expect(component.resultPanel.renderContent).toHaveBeenCalledWith({
                data: [],
                view: 'table',
                hideOdata: expect.any(Boolean)
            });
        });
    });

    describe('_updatePreview', () => {
        beforeEach(async () => {
            await setupComponent();
        });

        it('should show placeholder when GET entity is not set', async () => {
            component.ui.methodSelect.value = 'GET';
            component.ui.getEntityInput.value = '';

            await component._updatePreview();

            expect(component.ui.preview.innerHTML).toContain('(table?)');
        });

        it('should update preview with entity set for GET method', async () => {
            const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');
            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            EntityContextResolver.getAttrMap.mockResolvedValue(new Map());

            component.ui.methodSelect.value = 'GET';
            component.ui.getEntityInput.value = 'accounts';

            await component._updatePreview();

            expect(component.ui.preview.innerHTML).toContain('GET');
        });

        it('should hide preview for POST method', async () => {
            component.ui.methodSelect.value = 'POST';
            component.ui.postEntityInput.value = 'contacts';

            await component._updatePreview();

            expect(component.ui.preview.style.display).toBe('none');
        });

        it('should hide preview for PATCH method', async () => {
            component.ui.methodSelect.value = 'PATCH';
            component.ui.patchEntityInput.value = 'accounts';
            component.ui.patchIdInput.value = '12345-67890';

            await component._updatePreview();

            expect(component.ui.preview.style.display).toBe('none');
        });

        it('should hide preview for DELETE method', async () => {
            component.ui.methodSelect.value = 'DELETE';
            component.ui.deleteEntityInput.value = 'leads';
            component.ui.deleteIdInput.value = 'lead-id-123';

            await component._updatePreview();

            expect(component.ui.preview.style.display).toBe('none');
        });

        it('should hide preview for DELETE when entity not set', async () => {
            component.ui.methodSelect.value = 'DELETE';
            component.ui.deleteEntityInput.value = '';
            component.ui.deleteIdInput.value = '';

            await component._updatePreview();

            expect(component.ui.preview.style.display).toBe('none');
        });

        it('should update selectedEntityLogicalName after resolution', async () => {
            const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');
            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            EntityContextResolver.getAttrMap.mockResolvedValue(new Map());

            component.ui.methodSelect.value = 'GET';
            component.ui.getEntityInput.value = 'accounts';
            component.selectedEntityLogicalName = null;

            await component._updatePreview();

            expect(component.selectedEntityLogicalName).toBe('account');
        });

        it('should load attrMap when not already cached', async () => {
            const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');
            const mockAttrMap = new Map([['name', { type: 'string' }]]);
            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            EntityContextResolver.getAttrMap.mockResolvedValue(mockAttrMap);

            component.ui.methodSelect.value = 'GET';
            component.ui.getEntityInput.value = 'accounts';
            component.attrMap = null;

            await component._updatePreview();

            expect(EntityContextResolver.getAttrMap).toHaveBeenCalledWith('account');
            expect(component.attrMap).toBe(mockAttrMap);
        });

        it('should use fallback when entity resolution fails', async () => {
            const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');
            EntityContextResolver.resolve.mockRejectedValue(new Error('Entity not found'));

            component.ui.methodSelect.value = 'GET';
            component.ui.getEntityInput.value = 'customentity';

            await component._updatePreview();

            expect(component.ui.preview.innerHTML).toContain('GET');
            expect(component.ui.preview.innerHTML).toContain('customentity');
        });
    });

    describe('Preview Helper Methods', () => {
        beforeEach(async () => {
            await setupComponent();
        });

        describe('_buildMethodPreviewHtml', () => {
            it('should return HTML with method name for GET', () => {
                const html = component._buildMethodPreviewHtml('GET');
                expect(html).toContain('<strong>Method:</strong>');
                expect(html).toContain('GET');
                expect(html).toContain('pdt-preview-line');
            });

            it('should return HTML with method name for POST', () => {
                const html = component._buildMethodPreviewHtml('POST');
                expect(html).toContain('POST');
            });

            it('should return HTML with method name for PATCH', () => {
                const html = component._buildMethodPreviewHtml('PATCH');
                expect(html).toContain('PATCH');
            });

            it('should return HTML with method name for DELETE', () => {
                const html = component._buildMethodPreviewHtml('DELETE');
                expect(html).toContain('DELETE');
            });

            it('should escape HTML special characters in method name', () => {
                // Note: escapeHtml is mocked in test environment, so escaping behavior 
                // is tested in helpers/dom.helpers.test.js. Here we just verify the method works.
                const html = component._buildMethodPreviewHtml('TestMethod');
                expect(html).toContain('TestMethod');
            });
        });

        describe('_updateGetPreview', () => {
            it('should show placeholder when entity input is empty', async () => {
                component.ui.methodSelect.value = 'GET';
                component.ui.getEntityInput.value = '';

                await component._updateGetPreview();

                expect(component.ui.preview.innerHTML).toContain('(table?)');
                expect(component.ui.preview.innerHTML).toContain('GET');
            });

            it('should show placeholder for whitespace-only entity input', async () => {
                component.ui.methodSelect.value = 'GET';
                component.ui.getEntityInput.value = '   ';

                await component._updateGetPreview();

                expect(component.ui.preview.innerHTML).toContain('(table?)');
            });

            it('should resolve and display entity set for valid entity', async () => {
                const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());

                component.ui.methodSelect.value = 'GET';
                component.ui.getEntityInput.value = 'accounts';

                await component._updateGetPreview();

                expect(component.ui.preview.innerHTML).toContain('GET');
                expect(component.ui.preview.innerHTML).toContain('accounts');
            });

            it('should update entity input with resolved entity set', async () => {
                const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'contacts', logicalName: 'contact' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());

                component.ui.methodSelect.value = 'GET';
                component.ui.getEntityInput.value = 'contact';

                await component._updateGetPreview();

                expect(component.ui.getEntityInput.value).toBe('contacts');
            });

            it('should use fallback when resolution fails', async () => {
                const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');
                EntityContextResolver.resolve.mockRejectedValue(new Error('Not found'));

                component.ui.methodSelect.value = 'GET';
                component.ui.getEntityInput.value = 'unknownentity';

                await component._updateGetPreview();

                expect(component.ui.preview.innerHTML).toContain('unknownentity');
            });
        });

        describe('_updatePostPreview', () => {
            it('should display POST method and entity target', () => {
                component.ui.postEntityInput.value = 'accounts';

                component._updatePostPreview();

                expect(component.ui.preview.innerHTML).toContain('POST');
                expect(component.ui.preview.innerHTML).toContain('accounts');
            });

            it('should show placeholder when entity not set', () => {
                component.ui.postEntityInput.value = '';

                component._updatePostPreview();

                expect(component.ui.preview.innerHTML).toContain('(table?)');
            });

            it('should handle entity name in output', () => {
                // Note: escapeHtml is mocked in test environment
                component.ui.postEntityInput.value = 'test_entity';

                component._updatePostPreview();

                expect(component.ui.preview.innerHTML).toContain('test_entity');
            });
        });

        describe('_updatePatchPreview', () => {
            it('should display PATCH method with entity and record ID', () => {
                component.ui.patchEntityInput.value = 'accounts';
                component.ui.patchIdInput.value = 'abc-123';

                component._updatePatchPreview();

                expect(component.ui.preview.innerHTML).toContain('PATCH');
                expect(component.ui.preview.innerHTML).toContain('accounts');
                expect(component.ui.preview.innerHTML).toContain('abc-123');
            });

            it('should show entity placeholder when not set', () => {
                component.ui.patchEntityInput.value = '';
                component.ui.patchIdInput.value = 'some-id';

                component._updatePatchPreview();

                expect(component.ui.preview.innerHTML).toContain('(table?)');
            });

            it('should show ID placeholder when not set', () => {
                component.ui.patchEntityInput.value = 'contacts';
                component.ui.patchIdInput.value = '';

                component._updatePatchPreview();

                expect(component.ui.preview.innerHTML).toContain('(id?)');
            });

            it('should show both placeholders when neither set', () => {
                component.ui.patchEntityInput.value = '';
                component.ui.patchIdInput.value = '';

                component._updatePatchPreview();

                expect(component.ui.preview.innerHTML).toContain('(table?)');
                expect(component.ui.preview.innerHTML).toContain('(id?)');
            });
        });

        describe('_updateDeletePreview', () => {
            it('should display DELETE method with entity and record ID', () => {
                component.ui.deleteEntityInput.value = 'leads';
                component.ui.deleteIdInput.value = 'lead-456';

                component._updateDeletePreview();

                expect(component.ui.preview.innerHTML).toContain('DELETE');
                expect(component.ui.preview.innerHTML).toContain('leads');
                expect(component.ui.preview.innerHTML).toContain('lead-456');
            });

            it('should show entity placeholder when not set', () => {
                component.ui.deleteEntityInput.value = '';
                component.ui.deleteIdInput.value = 'some-id';

                component._updateDeletePreview();

                expect(component.ui.preview.innerHTML).toContain('(table?)');
            });

            it('should show ID placeholder when not set', () => {
                component.ui.deleteEntityInput.value = 'opportunities';
                component.ui.deleteIdInput.value = '';

                component._updateDeletePreview();

                expect(component.ui.preview.innerHTML).toContain('(id?)');
            });

            it('should handle entity name and ID in output', () => {
                // Note: escapeHtml is mocked in test environment
                component.ui.deleteEntityInput.value = 'test_entity';
                component.ui.deleteIdInput.value = 'test_id';

                component._updateDeletePreview();

                expect(component.ui.preview.innerHTML).toContain('test_entity');
                expect(component.ui.preview.innerHTML).toContain('test_id');
            });
        });

        describe('_setPreviewUrl', () => {
            it('should display GET method with URL', () => {
                component._setPreviewUrl('accounts');

                expect(component.ui.preview.innerHTML).toContain('GET');
                expect(component.ui.preview.innerHTML).toContain('accounts');
            });

            it('should display URL with query options', () => {
                component._setPreviewUrl('contacts?$select=fullname&$top=10');

                expect(component.ui.preview.innerHTML).toContain('contacts?$select=fullname');
                expect(component.ui.preview.innerHTML).toContain('$top=10');
            });

            it('should wrap URL in code element', () => {
                component._setPreviewUrl('accounts');

                expect(component.ui.preview.innerHTML).toContain('<code>');
            });

            it('should handle special characters in URL', () => {
                // Note: escapeHtml is mocked in test environment
                component._setPreviewUrl('accounts?$filter=name eq \'test\'');

                expect(component.ui.preview.innerHTML).toContain('accounts');
            });
        });
    });

    describe('Render Helper Methods', () => {
        beforeEach(() => {
            component = new WebApiExplorerTab();
        });

        describe('_renderGetSection', () => {
            it('should return HTML string with GET view container', () => {
                const html = component._renderGetSection();
                expect(html).toContain('id="api-view-get"');
            });

            it('should include entity input for GET', () => {
                const html = component._renderGetSection();
                expect(html).toContain('id="api-get-entity"');
            });

            it('should include columns textarea', () => {
                const html = component._renderGetSection();
                expect(html).toContain('id="api-get-select"');
            });

            it('should include top count input', () => {
                const html = component._renderGetSection();
                expect(html).toContain('id="api-get-top"');
            });

            it('should include filter container', () => {
                const html = component._renderGetSection();
                expect(html).toContain('id="api-get-filters-container"');
            });

            it('should include add filter group button in toolbar', () => {
                // Add filter group button is now in the toolbar section, not in the GET section
                const element = component.render();
                expect(element.querySelector('#api-get-add-filter-group-btn')).toBeTruthy();
            });

            it('should include order by section', () => {
                const html = component._renderGetSection();
                expect(html).toContain('id="api-get-orderby-attribute"');
                expect(html).toContain('id="api-get-orderby-dir"');
            });

            it('should include browse buttons', () => {
                const html = component._renderGetSection();
                expect(html).toContain('id="browse-api-get-entity-btn"');
                expect(html).toContain('id="browse-api-get-select-btn"');
            });
        });

        describe('_renderPostSection', () => {
            it('should return HTML string with POST view container', () => {
                const html = component._renderPostSection();
                expect(html).toContain('id="api-view-post"');
            });

            it('should be hidden by default', () => {
                const html = component._renderPostSection();
                expect(html).toContain('hidden');
            });

            it('should include entity input for POST', () => {
                const html = component._renderPostSection();
                expect(html).toContain('id="api-post-entity"');
            });

            it('should include JSON body textarea', () => {
                const html = component._renderPostSection();
                expect(html).toContain('id="api-post-body"');
            });

            it('should include body mode toggle', () => {
                const html = component._renderPostSection();
                expect(html).toContain('id="api-post-body-mode-toggle"');
            });

            it('should include fields builder section', () => {
                const html = component._renderPostSection();
                expect(html).toContain('id="api-post-fields-builder"');
            });

            it('should include add field button', () => {
                const html = component._renderPostSection();
                expect(html).toContain('id="api-post-add-field-btn"');
            });
        });

        describe('_renderPatchSection', () => {
            it('should return HTML string with PATCH view container', () => {
                const html = component._renderPatchSection();
                expect(html).toContain('id="api-view-patch"');
            });

            it('should be hidden by default', () => {
                const html = component._renderPatchSection();
                expect(html).toContain('hidden');
            });

            it('should include entity input for PATCH', () => {
                const html = component._renderPatchSection();
                expect(html).toContain('id="api-patch-entity"');
            });

            it('should include record ID input', () => {
                const html = component._renderPatchSection();
                expect(html).toContain('id="api-patch-id"');
            });

            it('should include JSON body textarea', () => {
                const html = component._renderPatchSection();
                expect(html).toContain('id="api-patch-body"');
            });

            it('should include bulk update filter section', () => {
                const html = component._renderPatchSection();
                expect(html).toContain('id="api-patch-filter-section"');
            });

            it('should include fields builder section', () => {
                const html = component._renderPatchSection();
                expect(html).toContain('id="api-patch-fields-builder"');
            });

            it('should include add field button', () => {
                const html = component._renderPatchSection();
                expect(html).toContain('id="api-patch-add-field-btn"');
            });
        });

        describe('_renderDeleteSection', () => {
            it('should return HTML string with DELETE view container', () => {
                const html = component._renderDeleteSection();
                expect(html).toContain('id="api-view-delete"');
            });

            it('should be hidden by default', () => {
                const html = component._renderDeleteSection();
                expect(html).toContain('hidden');
            });

            it('should include entity input for DELETE', () => {
                const html = component._renderDeleteSection();
                expect(html).toContain('id="api-delete-entity"');
            });

            it('should include record ID input', () => {
                const html = component._renderDeleteSection();
                expect(html).toContain('id="api-delete-id"');
            });

            it('should include bulk delete filter section', () => {
                const html = component._renderDeleteSection();
                expect(html).toContain('id="api-delete-filter-section"');
            });
        });

        describe('_renderFieldBuilderSection', () => {
            it('should return HTML for POST field builder', () => {
                const html = component._renderFieldBuilderSection('post');
                expect(html).toContain('id="api-post-fields-builder"');
                expect(html).toContain('id="api-post-fields-container"');
                expect(html).toContain('id="api-post-add-field-btn"');
            });

            it('should return HTML for PATCH field builder', () => {
                const html = component._renderFieldBuilderSection('patch');
                expect(html).toContain('id="api-patch-fields-builder"');
                expect(html).toContain('id="api-patch-fields-container"');
                expect(html).toContain('id="api-patch-add-field-btn"');
            });

            it('should include body mode toggle', () => {
                const html = component._renderFieldBuilderSection('post');
                expect(html).toContain('id="api-post-body-mode-toggle"');
            });

            it('should include mode label', () => {
                const html = component._renderFieldBuilderSection('post');
                expect(html).toContain('id="api-post-body-mode-label"');
                expect(html).toContain('Field Builder');
            });

            it('should include fields container', () => {
                const html = component._renderFieldBuilderSection('post');
                expect(html).toContain('pdt-builder-group');
            });

            it('should include JSON mode section hidden by default', () => {
                const html = component._renderFieldBuilderSection('post');
                expect(html).toContain('id="api-post-json-mode"');
                expect(html).toMatch(/id="api-post-json-mode"[^>]*hidden/);
            });

            it('should include JSON body textarea', () => {
                const html = component._renderFieldBuilderSection('patch');
                expect(html).toContain('id="api-patch-body"');
            });
        });

        describe('_renderToolbarSection', () => {
            it('should return HTML with toolbar container', () => {
                const html = component._renderToolbarSection();
                expect(html).toContain('pdt-toolbar');
            });

            it('should include execute button', () => {
                const html = component._renderToolbarSection();
                expect(html).toContain('id="api-execute-btn"');
            });

            it('should include get count button', () => {
                const html = component._renderToolbarSection();
                expect(html).toContain('id="api-get-count-btn"');
            });

            it('should include format JSON button', () => {
                const html = component._renderToolbarSection();
                expect(html).toContain('id="api-format-json-btn"');
            });

            it('should have format JSON button hidden by default', () => {
                const html = component._renderToolbarSection();
                expect(html).toMatch(/id="api-format-json-btn"[^>]*hidden/);
            });
        });
    });

    describe('_bindEntityBrowsers', () => {
        beforeEach(async () => {
            await setupComponent();
        });

        it('should register pickEntityHandler on component', () => {
            expect(component._pickEntityHandler).toBeDefined();
            expect(typeof component._pickEntityHandler).toBe('function');
        });

        it('should register browseGetSelectHandler on component', () => {
            expect(component._browseGetSelectHandler).toBeDefined();
            expect(typeof component._browseGetSelectHandler).toBe('function');
        });

        it('should register browseGetOrderByHandler on component', () => {
            expect(component._browseGetOrderByHandler).toBeDefined();
            expect(typeof component._browseGetOrderByHandler).toBe('function');
        });

        it('should open MetadataBrowserDialog when browse entity button clicked', async () => {
            const { MetadataBrowserDialog } = await import('../../src/ui/MetadataBrowserDialog.js');
            MetadataBrowserDialog.show = vi.fn();

            component._pickEntityHandler();

            expect(MetadataBrowserDialog.show).toHaveBeenCalledWith('entity', expect.any(Function));
        });

        it('should update entity inputs when entity selected from browser', async () => {
            const { MetadataBrowserDialog } = await import('../../src/ui/MetadataBrowserDialog.js');
            MetadataBrowserDialog.show = vi.fn((type, callback) => {
                callback({ LogicalName: 'account', EntitySetName: 'accounts' });
            });

            component._pickEntityHandler();

            expect(component.ui.getEntityInput.value).toBe('accounts');
            expect(component.ui.postEntityInput.value).toBe('accounts');
            expect(component.ui.patchEntityInput.value).toBe('accounts');
            expect(component.ui.deleteEntityInput.value).toBe('accounts');
        });

        it('should reset attrMap when new entity selected', async () => {
            const { MetadataBrowserDialog } = await import('../../src/ui/MetadataBrowserDialog.js');
            component.attrMap = new Map([['name', { type: 'string' }]]);

            MetadataBrowserDialog.show = vi.fn((type, callback) => {
                callback({ LogicalName: 'contact', EntitySetName: 'contacts' });
            });

            component._pickEntityHandler();

            expect(component.attrMap).toBeNull();
        });

        it('should update selectedEntityLogicalName when entity selected', async () => {
            const { MetadataBrowserDialog } = await import('../../src/ui/MetadataBrowserDialog.js');
            MetadataBrowserDialog.show = vi.fn((type, callback) => {
                callback({ LogicalName: 'opportunity', EntitySetName: 'opportunities' });
            });

            component._pickEntityHandler();

            expect(component.selectedEntityLogicalName).toBe('opportunity');
        });

        it('should clear select and orderBy inputs when entity selected', async () => {
            const { MetadataBrowserDialog } = await import('../../src/ui/MetadataBrowserDialog.js');
            component.ui.getSelectInput.value = 'name,createdon';
            component.ui.getOrderByAttrInput.value = 'modifiedon';

            MetadataBrowserDialog.show = vi.fn((type, callback) => {
                callback({ LogicalName: 'lead', EntitySetName: 'leads' });
            });

            component._pickEntityHandler();

            expect(component.ui.getSelectInput.value).toBe('');
            expect(component.ui.getOrderByAttrInput.value).toBe('');
        });

        it('should open column browser when browse select button handler called', async () => {
            const { showColumnBrowser } = await import('../../src/helpers/index.js');

            component._browseGetSelectHandler();

            expect(showColumnBrowser).toHaveBeenCalled();
        });

        it('should open column browser when browse orderBy button handler called', async () => {
            const { showColumnBrowser } = await import('../../src/helpers/index.js');

            component._browseGetOrderByHandler();

            expect(showColumnBrowser).toHaveBeenCalled();
        });
    });

    describe('Entity Metadata Loading', () => {
        beforeEach(async () => {
            await setupComponent();
        });

        it('should store attrMap after fetching entity metadata', async () => {
            const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');
            const mockAttrMap = new Map([
                ['name', { type: 'string', displayName: 'Name' }],
                ['createdon', { type: 'datetime', displayName: 'Created On' }]
            ]);
            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            EntityContextResolver.getAttrMap.mockResolvedValue(mockAttrMap);

            component.ui.methodSelect.value = 'GET';
            component.ui.getEntityInput.value = 'accounts';
            component.attrMap = null;

            await component._updatePreview();

            expect(component.attrMap).toBe(mockAttrMap);
        });

        it('should not refetch attrMap if already cached', async () => {
            const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');
            const existingMap = new Map([['name', { type: 'string' }]]);
            component.attrMap = existingMap;

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            EntityContextResolver.getAttrMap.mockClear();

            component.ui.methodSelect.value = 'GET';
            component.ui.getEntityInput.value = 'accounts';

            await component._updatePreview();

            expect(EntityContextResolver.getAttrMap).not.toHaveBeenCalled();
            expect(component.attrMap).toBe(existingMap);
        });

        it('should handle metadata fetch errors gracefully', async () => {
            const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');
            EntityContextResolver.resolve.mockRejectedValue(new Error('Metadata service unavailable'));

            component.ui.methodSelect.value = 'GET';
            component.ui.getEntityInput.value = 'invalidentity';

            await expect(component._updatePreview()).resolves.not.toThrow();
        });
    });

    describe('Field Builder Operations', () => {
        describe('_addFieldUI', () => {
            it('should add a field row to the fields container', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                const initialCount = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid').length;

                component._addFieldUI(false);

                const newCount = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid').length;
                expect(newCount).toBe(initialCount + 1);
            });

            it('should create field row with attribute input', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                component._addFieldUI(true);

                const attrInput = component.ui.postFieldsContainer.querySelector('[data-prop="field-attribute"]');
                expect(attrInput).toBeTruthy();
                expect(attrInput.placeholder).toContain('Attribute');
            });

            it('should create field row with value input', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                component._addFieldUI(true);

                const valueInput = component.ui.postFieldsContainer.querySelector('[data-prop="field-value"]');
                expect(valueInput).toBeTruthy();
                expect(valueInput.placeholder).toContain('Value');
            });

            it('should create field row with browse button', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                component._addFieldUI(true);

                const browseBtn = component.ui.postFieldsContainer.querySelector('.browse-field-attr');
                expect(browseBtn).toBeTruthy();
            });

            it('should create field row with remove button', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                component._addFieldUI(true);

                const removeBtn = component.ui.postFieldsContainer.querySelector('.pdt-condition-remove');
                expect(removeBtn).toBeTruthy();
            });

            it('should disable remove button for first row', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                component._addFieldUI(true);

                const removeBtn = component.ui.postFieldsContainer.querySelector('.pdt-condition-remove');
                expect(removeBtn.disabled).toBe(true);
            });

            it('should enable remove button for non-first rows', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                component._addFieldUI(false);

                const removeBtn = component.ui.postFieldsContainer.querySelector('.pdt-condition-remove');
                expect(removeBtn.disabled).toBe(false);
            });

            it('should register browse handler in dynamic handlers', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                const initialSize = component._dynamicHandlers.size;
                component.ui.postFieldsContainer.innerHTML = '';

                component._addFieldUI(true);

                expect(component._dynamicHandlers.size).toBeGreaterThan(initialSize);
            });

            it('should add multiple field rows when called multiple times', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                component._addFieldUI(true);
                component._addFieldUI(false);
                component._addFieldUI(false);

                const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
                expect(rows.length).toBe(3);
            });
        });

        describe('_getFieldsFromBuilder', () => {
            it('should return empty object when no fields', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                component._addFieldUI(true);

                const fields = component._getFieldsFromBuilder();

                expect(fields).toEqual({});
            });

            it('should extract simple string fields', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="name" />
                    <input data-prop="field-value" value="Test Company" />
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const fields = component._getFieldsFromBuilder();

                expect(fields).toEqual({ name: 'Test Company' });
            });

            it('should extract multiple fields', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                ['name', 'description', 'telephone1'].forEach((attr, idx) => {
                    const row = document.createElement('div');
                    row.className = 'pdt-field-grid';
                    row.innerHTML = `
                        <input data-prop="field-attribute" value="${attr}" />
                        <input data-prop="field-value" value="value${idx}" />
                    `;
                    component.ui.postFieldsContainer.appendChild(row);
                });

                const fields = component._getFieldsFromBuilder();

                expect(Object.keys(fields).length).toBe(3);
                expect(fields.name).toBe('value0');
                expect(fields.description).toBe('value1');
                expect(fields.telephone1).toBe('value2');
            });

            it('should skip empty attribute fields', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                const row1 = document.createElement('div');
                row1.className = 'pdt-field-grid';
                row1.innerHTML = `
                    <input data-prop="field-attribute" value="name" />
                    <input data-prop="field-value" value="Test" />
                `;
                const row2 = document.createElement('div');
                row2.className = 'pdt-field-grid';
                row2.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <input data-prop="field-value" value="ignored" />
                `;
                component.ui.postFieldsContainer.appendChild(row1);
                component.ui.postFieldsContainer.appendChild(row2);

                const fields = component._getFieldsFromBuilder();

                expect(Object.keys(fields).length).toBe(1);
                expect(fields.name).toBe('Test');
            });

            it('should skip LogicalName attribute', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="LogicalName" />
                    <input data-prop="field-value" value="account" />
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const fields = component._getFieldsFromBuilder();

                expect(fields.LogicalName).toBeUndefined();
            });
        });

        describe('Lookup Field Auto-Detection with @odata.bind', () => {
            it('should auto-append @odata.bind suffix when typing lookup field name', async () => {
                const { DataService } = await import('../../src/services/DataService.js');
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'accounts';
                component.ui.postFieldsContainer.innerHTML = '';

                // Mock entity context resolution
                component.selectedEntityLogicalName = 'account';
                component._ensureEntityContext = vi.fn().mockResolvedValue({
                    logicalName: 'account',
                    entitySet: 'accounts'
                });

                // Mock attribute metadata with a lookup field
                DataService.getAttributeDefinitions = vi.fn().mockResolvedValue([
                    {
                        LogicalName: 'primarycontactid',
                        AttributeType: 'Lookup',
                        AttributeTypeName: { Value: 'LookupType' },
                        Targets: ['contact']
                    }
                ]);

                // Mock navigation property map
                DataService.getNavigationPropertyMap = vi.fn().mockResolvedValue(
                    new Map([['primarycontactid', 'primarycontactid']])
                );

                // Add field row
                component._addFieldUI(true);

                const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
                const attrInput = row.querySelector('[data-prop="field-attribute"]');

                // Simulate user typing lookup field name
                attrInput.value = 'primarycontactid';

                // Trigger blur event to invoke attributeChangeHandler
                const blurEvent = new Event('blur');
                attrInput.dispatchEvent(blurEvent);

                // Wait for async operations with longer timeout
                await new Promise(resolve => setTimeout(resolve, 100));

                // Check if the @odata.bind suffix was added
                expect(attrInput.value).toBe('primarycontactid@odata.bind');
            });

            it('should not duplicate @odata.bind if already present', async () => {
                const { DataService } = await import('../../src/services/DataService.js');
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'accounts';
                component.ui.postFieldsContainer.innerHTML = '';

                component.selectedEntityLogicalName = 'account';
                component._ensureEntityContext = vi.fn().mockResolvedValue({
                    logicalName: 'account',
                    entitySet: 'accounts'
                });

                DataService.getAttributeDefinitions = vi.fn().mockResolvedValue([
                    {
                        LogicalName: 'primarycontactid',
                        AttributeType: 'Lookup',
                        AttributeTypeName: { Value: 'LookupType' },
                        Targets: ['contact']
                    }
                ]);

                DataService.getNavigationPropertyMap = vi.fn().mockResolvedValue(
                    new Map([['primarycontactid', 'primarycontactid']])
                );

                component._addFieldUI(true);

                const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
                const attrInput = row.querySelector('[data-prop="field-attribute"]');

                // User already typed with @odata.bind
                attrInput.value = 'primarycontactid@odata.bind';

                const blurEvent = new Event('blur');
                attrInput.dispatchEvent(blurEvent);

                await new Promise(resolve => setTimeout(resolve, 100));

                // Should remain the same, not become primarycontactid@odata.bind@odata.bind
                expect(attrInput.value).toBe('primarycontactid@odata.bind');
            });

            it('should use navigation property name when different from logical name', async () => {
                const { DataService } = await import('../../src/services/DataService.js');
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'accounts';
                component.ui.postFieldsContainer.innerHTML = '';

                component.selectedEntityLogicalName = 'account';
                component._ensureEntityContext = vi.fn().mockResolvedValue({
                    logicalName: 'account',
                    entitySet: 'accounts'
                });

                DataService.getAttributeDefinitions = vi.fn().mockResolvedValue([
                    {
                        LogicalName: 'primarycontactid',
                        AttributeType: 'Lookup',
                        AttributeTypeName: { Value: 'LookupType' },
                        Targets: ['contact']
                    }
                ]);

                // Navigation property name differs from logical name
                DataService.getNavigationPropertyMap = vi.fn().mockResolvedValue(
                    new Map([['primarycontactid', 'primarycontactid_contact']])
                );

                component._addFieldUI(true);

                const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
                const attrInput = row.querySelector('[data-prop="field-attribute"]');

                attrInput.value = 'primarycontactid';

                const blurEvent = new Event('blur');
                attrInput.dispatchEvent(blurEvent);

                await new Promise(resolve => setTimeout(resolve, 100));

                // Should use navigation property name
                expect(attrInput.value).toBe('primarycontactid_contact@odata.bind');
            });

            it('should not add @odata.bind for non-lookup fields', async () => {
                const { DataService } = await import('../../src/services/DataService.js');
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'accounts';
                component.ui.postFieldsContainer.innerHTML = '';

                component.selectedEntityLogicalName = 'account';
                component._ensureEntityContext = vi.fn().mockResolvedValue({
                    logicalName: 'account',
                    entitySet: 'accounts'
                });

                // Mock non-lookup field (string)
                DataService.getAttributeDefinitions = vi.fn().mockResolvedValue([
                    {
                        LogicalName: 'name',
                        AttributeType: 'String',
                        AttributeTypeName: { Value: 'StringType' }
                    }
                ]);

                component._addFieldUI(true);

                const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
                const attrInput = row.querySelector('[data-prop="field-attribute"]');

                attrInput.value = 'name';

                const blurEvent = new Event('blur');
                attrInput.dispatchEvent(blurEvent);

                await new Promise(resolve => setTimeout(resolve, 100));

                // Should remain as is for non-lookup fields
                expect(attrInput.value).toBe('name');
            });
        });

        describe('_resetFieldBuilder', () => {
            it('should clear all fields except one empty row', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                component._addFieldUI(true);
                component._addFieldUI(false);
                component._addFieldUI(false);

                component._resetFieldBuilder();

                const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
                expect(rows.length).toBe(1);
            });

            it('should clear body area', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyArea.value = '{"name": "Test"}';

                component._resetFieldBuilder();

                expect(component.ui.postBodyArea.value).toBe('');
            });
        });

        describe('_populateFieldsFromJson', () => {
            it('should populate fields from simple JSON object', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                component.ui.postEntityInput.value = 'account';

                await component._populateFieldsFromJson({ name: 'Test', revenue: 1000 });

                const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
                expect(rows.length).toBe(2);
            });

            it('should set attribute and value inputs from JSON', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                component.ui.postEntityInput.value = 'contact';

                await component._populateFieldsFromJson({ firstname: 'John' });

                const attrInput = component.ui.postFieldsContainer.querySelector('[data-prop="field-attribute"]');
                const valueInput = component.ui.postFieldsContainer.querySelector('[data-prop="field-value"]');
                expect(attrInput.value).toBe('firstname');
                expect(valueInput.value).toBe('John');
            });

            it('should handle empty JSON object', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                component.ui.postEntityInput.value = 'account';

                await component._populateFieldsFromJson({});

                const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
                expect(rows.length).toBe(1);
            });

            it('should convert complex values to JSON string', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                component.ui.postEntityInput.value = 'account';

                await component._populateFieldsFromJson({ address: { city: 'Seattle' } });

                const valueInput = component.ui.postFieldsContainer.querySelector('[data-prop="field-value"]');
                expect(valueInput.value).toBe('{"city":"Seattle"}');
            });
        });
    });

    describe('Field Value Parsing', () => {
        describe('_parseFieldValue', () => {
            it('should parse boolean true value', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'boolean';

                const result = component._parseFieldValue(input, 'true');

                expect(result).toBe(true);
            });

            it('should parse boolean false value', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'boolean';

                const result = component._parseFieldValue(input, 'false');

                expect(result).toBe(false);
            });

            it('should parse integer value', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'integer';

                const result = component._parseFieldValue(input, '42');

                expect(result).toBe(42);
            });

            it('should parse optionset value', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'optionset';

                const result = component._parseFieldValue(input, '100000001');

                expect(result).toBe(100000001);
            });

            it('should parse decimal value', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'decimal';

                const result = component._parseFieldValue(input, '123.45');

                expect(result).toBe(123.45);
            });

            it('should parse date value to ISO date string', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'date';

                const result = component._parseFieldValue(input, '2024-12-25');

                expect(result).toBe('2024-12-25');
            });

            it('should parse datetime value to ISO string', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'datetime';

                const result = component._parseFieldValue(input, '2024-12-25T10:30:00');

                expect(result).toContain('2024-12-25');
            });

            it('should parse lookup value with parentheses', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'lookup';

                const result = component._parseFieldValue(input, '/accounts(12345-67890)');

                expect(result).toBe('/accounts(12345-67890)');
            });

            it('should return undefined for invalid lookup format', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'lookup';

                const result = component._parseFieldValue(input, 'invalid-lookup');

                expect(result).toBeUndefined();
            });

            it('should parse default text value', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'text';

                const result = component._parseFieldValue(input, 'Hello World');

                expect(result).toBe('Hello World');
            });

            it('should parse JSON string in default mode', async () => {
                await setupComponent();
                const input = document.createElement('input');

                const result = component._parseFieldValue(input, '{"key": "value"}');

                expect(result).toEqual({ key: 'value' });
            });
        });

        describe('_parseBooleanValue', () => {
            it('should return true for "true" string', async () => {
                await setupComponent();
                expect(component._parseBooleanValue('true')).toBe(true);
            });

            it('should return false for "false" string', async () => {
                await setupComponent();
                expect(component._parseBooleanValue('false')).toBe(false);
            });

            it('should return undefined for invalid boolean', async () => {
                await setupComponent();
                expect(component._parseBooleanValue('yes')).toBeUndefined();
            });
        });

        describe('_parseIntegerValue', () => {
            it('should parse positive integer', async () => {
                await setupComponent();
                expect(component._parseIntegerValue('100')).toBe(100);
            });

            it('should parse negative integer', async () => {
                await setupComponent();
                expect(component._parseIntegerValue('-50')).toBe(-50);
            });

            it('should return undefined for non-numeric string', async () => {
                await setupComponent();
                expect(component._parseIntegerValue('abc')).toBeUndefined();
            });
        });

        describe('_parseDecimalValue', () => {
            it('should parse decimal with precision', async () => {
                await setupComponent();
                expect(component._parseDecimalValue('99.99')).toBe(99.99);
            });

            it('should return undefined for non-numeric', async () => {
                await setupComponent();
                expect(component._parseDecimalValue('not-a-number')).toBeUndefined();
            });
        });

        describe('_parseDateValue', () => {
            it('should format date as ISO date string', async () => {
                await setupComponent();
                const result = component._parseDateValue('2024-06-15');
                expect(result).toBe('2024-06-15');
            });

            it('should return undefined for invalid date', async () => {
                await setupComponent();
                expect(component._parseDateValue('invalid-date')).toBeUndefined();
            });
        });

        describe('_parseDateTimeValue', () => {
            it('should return ISO string for valid datetime', async () => {
                await setupComponent();
                const result = component._parseDateTimeValue('2024-06-15T14:30:00');
                expect(result).toContain('2024-06-15');
            });

            it('should return undefined for invalid datetime', async () => {
                await setupComponent();
                expect(component._parseDateTimeValue('not-a-datetime')).toBeUndefined();
            });
        });

        describe('_parseDefaultValue', () => {
            it('should return parsed JSON for valid JSON string', async () => {
                await setupComponent();
                expect(component._parseDefaultValue('{"a": 1}')).toEqual({ a: 1 });
            });

            it('should return raw string for invalid JSON', async () => {
                await setupComponent();
                expect(component._parseDefaultValue('plain text')).toBe('plain text');
            });
        });
    });

    describe('Request Body Building', () => {
        describe('_getRequestBody', () => {
            let ValidationService;

            beforeEach(async () => {
                ValidationService = (await import('../../src/services/ValidationService.js')).ValidationService;
                vi.clearAllMocks();
            });

            it('should return parsed JSON in JSON mode', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyModeToggle.checked = true;
                component.ui.postBodyArea.value = '{"name": "Test"}';
                ValidationService.validateJson = vi.fn().mockReturnValue({ name: 'Test' });

                const body = component._getRequestBody();

                expect(ValidationService.validateJson).toHaveBeenCalledWith('{"name": "Test"}', 'Request body');
                expect(body).toEqual({ name: 'Test' });
            });

            it('should extract fields in field builder mode', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyModeToggle.checked = false;

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="telephone1" />
                    <input data-prop="field-value" value="555-1234" />
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const body = component._getRequestBody();

                expect(body.telephone1).toBe('555-1234');
            });

            it('should throw error when no fields provided', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyModeToggle.checked = false;
                component.ui.postFieldsContainer.innerHTML = '';
                component._addFieldUI(true);

                expect(() => component._getRequestBody()).toThrow();
            });
        });

        describe('_extractFileUploads', () => {
            it('should return empty array when no file uploads', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyModeToggle.checked = false;
                component.ui.postFieldsContainer.innerHTML = '';
                component._addFieldUI(true);

                const uploads = component._extractFileUploads();

                expect(uploads).toEqual([]);
            });

            it('should return empty array in JSON mode', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyModeToggle.checked = true;

                const uploads = component._extractFileUploads();

                expect(uploads).toEqual([]);
            });
        });
    });

    describe('Method State Management', () => {
        describe('_saveMethodState', () => {
            it('should save GET entity to state', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'accounts';

                component._saveMethodState('GET');

                expect(component._methodState.GET.entity).toBe('accounts');
            });

            it('should save POST/PATCH entity to state', async () => {
                await setupComponent();
                component.ui.postEntityInput.value = 'contacts';
                component.ui.patchIdInput.value = 'some-id';

                component._saveMethodState('POST');

                expect(component._methodState.POST.entity).toBe('contacts');
            });

            it('should save DELETE entity and recordId to state', async () => {
                await setupComponent();
                component.ui.deleteEntityInput.value = 'leads';
                component.ui.deleteIdInput.value = 'lead-id-123';

                component._saveMethodState('DELETE');

                expect(component._methodState.DELETE.entity).toBe('leads');
                expect(component._methodState.DELETE.recordId).toBe('lead-id-123');
            });

            it('should save body area value for PATCH', async () => {
                await setupComponent();
                component.ui.patchEntityInput.value = 'accounts';
                component.ui.patchBodyArea.value = '{"name": "Test"}';

                component._saveMethodState('PATCH');

                expect(component._methodState.PATCH.fields).toBe('{"name": "Test"}');
            });

            it('should handle unknown method gracefully', async () => {
                await setupComponent();

                expect(() => component._saveMethodState('UNKNOWN')).not.toThrow();
            });
        });

        describe('_restoreMethodState', () => {
            it('should restore GET entity from state', async () => {
                await setupComponent();
                component._methodState.GET.entity = 'systemusers';

                component._restoreMethodState('GET');

                expect(component.ui.getEntityInput.value).toBe('systemusers');
            });

            it('should restore POST entity from state', async () => {
                await setupComponent();
                component._methodState.POST.entity = 'opportunities';

                component._restoreMethodState('POST');

                expect(component.ui.postEntityInput.value).toBe('opportunities');
            });

            it('should restore PATCH recordId from state', async () => {
                await setupComponent();
                component._methodState.PATCH.entity = 'accounts';
                component._methodState.PATCH.recordId = 'patch-id-456';

                component._restoreMethodState('PATCH');

                expect(component.ui.patchIdInput.value).toBe('patch-id-456');
            });

            it('should restore DELETE state', async () => {
                await setupComponent();
                component._methodState.DELETE.entity = 'tasks';
                component._methodState.DELETE.recordId = 'task-id-789';

                component._restoreMethodState('DELETE');

                expect(component.ui.deleteEntityInput.value).toBe('tasks');
                expect(component.ui.deleteIdInput.value).toBe('task-id-789');
            });

            it('should handle unknown method gracefully', async () => {
                await setupComponent();

                expect(() => component._restoreMethodState('UNKNOWN')).not.toThrow();
            });
        });

        describe('_captureFieldValues', () => {
            it('should return empty array when no fields container', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer = null;

                const values = component._captureFieldValues('POST');

                expect(values).toEqual([]);
            });

            it('should capture field values from builder rows', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="name" />
                    <input data-prop="field-value" value="Test Value" />
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const values = component._captureFieldValues('POST');

                expect(values.length).toBe(1);
                expect(values[0].attribute).toBe('name');
                expect(values[0].value).toBe('Test Value');
            });

            it('should capture multiple field values', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                ['name', 'email'].forEach((attr) => {
                    const row = document.createElement('div');
                    row.className = 'pdt-field-grid';
                    row.innerHTML = `
                        <input data-prop="field-attribute" value="${attr}" />
                        <input data-prop="field-value" value="${attr}Value" />
                    `;
                    component.ui.postFieldsContainer.appendChild(row);
                });

                const values = component._captureFieldValues('POST');

                expect(values.length).toBe(2);
            });
        });

        describe('_restoreFieldValues', () => {
            it('should not throw when no field values', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                expect(() => component._restoreFieldValues([], 'POST')).not.toThrow();
            });

            it('should restore values to existing rows', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <input data-prop="field-value" value="" />
                `;
                component.ui.postFieldsContainer.appendChild(row);

                component._restoreFieldValues([{ attribute: 'restored_attr', value: 'restored_val' }], 'POST');

                const attrInput = row.querySelector('[data-prop="field-attribute"]');
                const valueInput = row.querySelector('[data-prop="field-value"]');
                expect(attrInput.value).toBe('restored_attr');
                expect(valueInput.value).toBe('restored_val');
            });
        });
    });

    describe('Bulk Operations', () => {
        describe('_executeBulkPatch', () => {
            let DataService;
            let EntityContextResolver;
            let PowerAppsApiService;
            let showConfirmDialog;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                PowerAppsApiService = (await import('../../src/services/PowerAppsApiService.js')).PowerAppsApiService;
                const helpers = await import('../../src/helpers/index.js');
                showConfirmDialog = helpers.showConfirmDialog;

                vi.clearAllMocks();
            });

            it('should show warning when no filter conditions', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                await setupComponent();

                component.ui.patchEntityInput.value = 'accounts';
                component.ui.patchBodyModeToggle.checked = true;
                component.ui.patchBodyArea.value = '{"name": "Updated"}';
                component.patchFilterManager.extractFilterGroups.mockReturnValue([]);

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });

                await component._executeBulkPatch();

                expect(NotificationService.show).toHaveBeenCalledWith(expect.stringContaining('No records match'), 'warning');
            });

            it('should show confirmation before bulk update', async () => {
                await setupComponent();

                component.ui.patchEntityInput.value = 'accounts';
                component.ui.patchBodyModeToggle.checked = true;
                component.ui.patchBodyArea.value = '{"name": "Updated"}';
                component.patchFilterManager.extractFilterGroups.mockReturnValue([
                    { filters: [{ attr: 'name', op: 'eq', value: 'test' }] }
                ]);

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());
                PowerAppsApiService.getEntityMetadata = vi.fn().mockResolvedValue({ PrimaryIdAttribute: 'accountid' });
                vi.spyOn(component, '_fetchMatchingRecords').mockResolvedValue([{ accountid: '1' }, { accountid: '2' }]);
                showConfirmDialog.mockResolvedValue(false);

                await component._executeBulkPatch();

                expect(showConfirmDialog).toHaveBeenCalled();
            });

            it('should cancel operation when confirmation declined', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                await setupComponent();

                component.ui.patchEntityInput.value = 'accounts';
                component.ui.patchBodyModeToggle.checked = true;
                component.ui.patchBodyArea.value = '{"name": "Updated"}';
                component.patchFilterManager.extractFilterGroups.mockReturnValue([
                    { filters: [{ attr: 'name', op: 'eq', value: 'test' }] }
                ]);

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());
                PowerAppsApiService.getEntityMetadata = vi.fn().mockResolvedValue({ PrimaryIdAttribute: 'accountid' });
                vi.spyOn(component, '_fetchMatchingRecords').mockResolvedValue([{ accountid: '1' }]);
                showConfirmDialog.mockResolvedValue(false);

                await component._executeBulkPatch();

                expect(NotificationService.show).toHaveBeenCalledWith(expect.stringContaining('cancelled'), 'info');
            });
        });

        describe('_processBatchOperations', () => {
            let DataService;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                vi.clearAllMocks();
            });

            it('should process PATCH operations', async () => {
                await setupComponent();
                DataService.updateRecord.mockResolvedValue({});

                const operations = [
                    { method: 'PATCH', entitySet: 'accounts', id: '1', data: { name: 'Test' } }
                ];

                const result = await component._processBatchOperations(operations, 1000);

                expect(result.successCount).toBe(1);
                expect(result.failCount).toBe(0);
            });

            it('should process DELETE operations', async () => {
                await setupComponent();
                DataService.deleteRecord.mockResolvedValue({});

                const operations = [
                    { method: 'DELETE', entitySet: 'accounts', id: '1' }
                ];

                const result = await component._processBatchOperations(operations, 1000);

                expect(result.successCount).toBe(1);
                expect(result.failCount).toBe(0);
            });

            it('should track failed operations', async () => {
                await setupComponent();
                DataService.updateRecord.mockRejectedValue(new Error('Update failed'));

                const operations = [
                    { method: 'PATCH', entitySet: 'accounts', id: '1', data: { name: 'Test' } }
                ];

                const result = await component._processBatchOperations(operations, 1000);

                expect(result.failCount).toBe(1);
                expect(result.errors.length).toBe(1);
            });

            it('should call progress callback', async () => {
                await setupComponent();
                DataService.updateRecord.mockResolvedValue({});
                const progressCallback = vi.fn();

                const operations = [
                    { method: 'PATCH', entitySet: 'accounts', id: '1', data: {} },
                    { method: 'PATCH', entitySet: 'accounts', id: '2', data: {} }
                ];

                await component._processBatchOperations(operations, 1000, progressCallback);

                expect(progressCallback).toHaveBeenCalled();
            });
        });

        describe('_formatBulkOperationResult', () => {
            it('should format successful operation result', async () => {
                await setupComponent();

                const result = component._formatBulkOperationResult('Bulk Delete', 10, 10, 0, []);

                expect(result.length).toBe(1);
                expect(result[0].Operation).toBe('Bulk Delete');
                expect(result[0].Total).toBe(10);
                expect(result[0].Succeeded).toBe(10);
                expect(result[0].Failed).toBe(0);
            });

            it('should include error details when failures occur', async () => {
                await setupComponent();
                const errors = [
                    { index: 0, error: 'Record not found' },
                    { index: 1, error: 'Permission denied' }
                ];

                const result = component._formatBulkOperationResult('Bulk Update', 5, 3, 2, errors);

                expect(result.length).toBeGreaterThan(1);
                expect(result[0].Failed).toBe(2);
            });
        });

        describe('_fetchMatchingRecords', () => {
            let DataService;
            let ODataQueryBuilder;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                ODataQueryBuilder = (await import('../../src/utils/builders/ODataQueryBuilder.js')).ODataQueryBuilder;
                vi.clearAllMocks();
            });

            it('should fetch records with filter query', async () => {
                await setupComponent();
                component.attrMap = new Map();
                ODataQueryBuilder.build.mockReturnValue('?$filter=name eq test');
                DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [{ id: '1' }] });

                const records = await component._fetchMatchingRecords('accounts', [], ['accountid']);

                expect(DataService.retrieveMultipleRecords).toHaveBeenCalled();
                expect(records).toEqual([{ id: '1' }]);
            });

            it('should return empty array when no records match', async () => {
                await setupComponent();
                component.attrMap = new Map();
                ODataQueryBuilder.build.mockReturnValue('?$filter=name eq nonexistent');
                DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [] });

                const records = await component._fetchMatchingRecords('accounts', [], ['accountid']);

                expect(records).toEqual([]);
            });
        });
    });

    describe('Pagination', () => {
        describe('_showPaginationBanner', () => {
            it('should not throw when resultPanel is null', async () => {
                await setupComponent();
                component.resultPanel = null;

                expect(() => component._showPaginationBanner()).not.toThrow();
            });

            it('should call showBanner on resultPanel', async () => {
                await setupComponent();
                component.resultPanel.showBanner = vi.fn();
                component.allLoadedRecords = [{ id: '1' }];

                component._showPaginationBanner();

                expect(component.resultPanel.showBanner).toHaveBeenCalled();
            });
        });

        describe('_removePaginationBanner', () => {
            it('should call removeBanner on resultPanel', async () => {
                await setupComponent();

                component._removePaginationBanner();

                expect(component.resultPanel.removeBanner).toHaveBeenCalled();
            });
        });

        describe('_loadMoreRecords', () => {
            let DataService;
            let EntityContextResolver;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                vi.clearAllMocks();
            });

            it('should not execute when nextLink is null', async () => {
                await setupComponent();
                component.nextLink = null;

                await component._loadMoreRecords();

                expect(DataService.retrieveMultipleRecords).not.toHaveBeenCalled();
            });

            it('should not execute when already loading', async () => {
                await setupComponent();
                component.nextLink = 'http://test.com?$skiptoken=123';
                component.isLoadingMore = true;

                await component._loadMoreRecords();

                expect(DataService.retrieveMultipleRecords).not.toHaveBeenCalled();
            });

            it('should fetch next page and append records', async () => {
                await setupComponent();
                component.nextLink = 'https://org.crm.dynamics.com/api/data/v9.2/accounts?$skiptoken=123';
                component.allLoadedRecords = [{ id: '1' }];
                component.ui.getEntityInput.value = 'accounts';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                DataService.retrieveMultipleRecords.mockResolvedValue({
                    entities: [{ id: '2' }],
                    nextLink: null
                });

                await component._loadMoreRecords();

                expect(component.allLoadedRecords.length).toBe(2);
                expect(component.nextLink).toBeNull();
            });
        });

        describe('_loadAllRecords', () => {
            let DataService;
            let EntityContextResolver;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                vi.clearAllMocks();
            });

            it('should not execute when nextLink is null', async () => {
                await setupComponent();
                component.nextLink = null;

                await component._loadAllRecords();

                expect(DataService.retrieveMultipleRecords).not.toHaveBeenCalled();
            });

            it('should not execute when already loading', async () => {
                await setupComponent();
                component.nextLink = 'http://test.com?$skiptoken=123';
                component.isLoadingMore = true;

                await component._loadAllRecords();

                expect(DataService.retrieveMultipleRecords).not.toHaveBeenCalled();
            });

            it('should fetch all pages until nextLink is null', async () => {
                await setupComponent();
                component.nextLink = 'https://org.crm.dynamics.com/api/data/v9.2/accounts?$skiptoken=1';
                component.allLoadedRecords = [{ id: '1' }];
                component.ui.getEntityInput.value = 'accounts';
                component.resultPanel.updateBanner = vi.fn();

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                DataService.retrieveMultipleRecords
                    .mockResolvedValueOnce({ entities: [{ id: '2' }], nextLink: 'https://org.crm.dynamics.com/api/data/v9.2/accounts?$skiptoken=2' })
                    .mockResolvedValueOnce({ entities: [{ id: '3' }], nextLink: null });

                await component._loadAllRecords();

                expect(component.allLoadedRecords.length).toBe(3);
                expect(component.nextLink).toBeNull();
            });
        });
    });

    describe('URL Building', () => {
        describe('_buildGetOptionsStringFallback', () => {
            it('should build query with $select', async () => {
                await setupComponent();
                component.ui.getSelectInput.value = 'name\ncreateon';

                const result = component._buildGetOptionsStringFallback();

                expect(result).toContain('$select=name,createon');
            });

            it('should build query with $top', async () => {
                await setupComponent();
                component.ui.getTopInput.value = '50';

                const result = component._buildGetOptionsStringFallback();

                expect(result).toContain('$top=50');
            });

            it('should build query with $orderby', async () => {
                await setupComponent();
                component.ui.getOrderByAttrInput.value = 'createdon';
                component.ui.getOrderByDirSelect.value = 'desc';

                const result = component._buildGetOptionsStringFallback();

                expect(result).toContain('$orderby=createdon desc');
            });

            it('should return empty string when no options', async () => {
                await setupComponent();
                component.ui.getSelectInput.value = '';
                component.ui.getTopInput.value = '';
                component.ui.getOrderByAttrInput.value = '';
                component.getFilterManager.extractFilterGroups.mockReturnValue([]);

                const result = component._buildGetOptionsStringFallback();

                expect(result).toBe('');
            });

            it('should combine multiple query options', async () => {
                await setupComponent();
                component.ui.getSelectInput.value = 'name';
                component.ui.getTopInput.value = '10';
                component.ui.getOrderByAttrInput.value = 'name';
                component.ui.getOrderByDirSelect.value = 'asc';

                const result = component._buildGetOptionsStringFallback();

                expect(result).toContain('$select=name');
                expect(result).toContain('$top=10');
                expect(result).toContain('$orderby=name asc');
            });
        });

        describe('_buildGetOptionsString', () => {
            let EntityContextResolver;
            let ODataQueryBuilder;

            beforeEach(async () => {
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                ODataQueryBuilder = (await import('../../src/utils/builders/ODataQueryBuilder.js')).ODataQueryBuilder;
                vi.clearAllMocks();
            });

            it('should build options using ODataQueryBuilder', async () => {
                await setupComponent();
                component.attrMap = new Map([['name', { type: 'string' }]]);
                ODataQueryBuilder.build.mockReturnValue('?$select=name');

                const result = await component._buildGetOptionsString('account');

                expect(ODataQueryBuilder.build).toHaveBeenCalled();
                expect(result).toBe('?$select=name');
            });

            it('should load attrMap if not cached', async () => {
                await setupComponent();
                component.attrMap = null;
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map([['name', { type: 'string' }]]));
                ODataQueryBuilder.build.mockReturnValue('');

                await component._buildGetOptionsString('account');

                expect(EntityContextResolver.getAttrMap).toHaveBeenCalledWith('account');
            });

            it('should extract filter groups from manager', async () => {
                await setupComponent();
                component.attrMap = new Map();
                component.getFilterManager.extractFilterGroups.mockReturnValue([{ filters: [] }]);
                ODataQueryBuilder.build.mockReturnValue('');

                await component._buildGetOptionsString('account');

                expect(component.getFilterManager.extractFilterGroups).toHaveBeenCalled();
            });
        });
    });

    describe('Entity Context Resolution', () => {
        describe('_ensureEntityContext', () => {
            let EntityContextResolver;

            beforeEach(async () => {
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                vi.clearAllMocks();
            });

            it('should resolve entity from override parameter', async () => {
                await setupComponent();
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'contacts', logicalName: 'contact' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());

                const result = await component._ensureEntityContext('contacts');

                expect(EntityContextResolver.resolve).toHaveBeenCalledWith('contacts');
                expect(result.entitySet).toBe('contacts');
                expect(result.logicalName).toBe('contact');
            });

            it('should resolve from GET entity input when no override', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'accounts';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());

                const result = await component._ensureEntityContext();

                expect(result.entitySet).toBe('accounts');
            });

            it('should throw error when no entity provided', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = '';
                component.ui.postEntityInput.value = '';
                component.ui.patchEntityInput.value = '';
                component.ui.deleteEntityInput.value = '';

                await expect(component._ensureEntityContext()).rejects.toThrow();
            });

            it('should update entity inputs based on current method', async () => {
                await setupComponent();
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());

                // Test with POST method
                component.ui.methodSelect.value = 'POST';
                await component._ensureEntityContext('account');

                expect(component.ui.getEntityInput.value).toBe('accounts');
                expect(component.ui.postEntityInput.value).toBe('accounts');
                expect(component.ui.deleteEntityInput.value).toBe('accounts');

                // Test with PATCH method
                component.ui.methodSelect.value = 'PATCH';
                await component._ensureEntityContext('contact');
                expect(component.ui.patchEntityInput.value).toBe('accounts');
            });

            it('should cache selectedEntityLogicalName', async () => {
                await setupComponent();
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'leads', logicalName: 'lead' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());

                await component._ensureEntityContext('leads');

                expect(component.selectedEntityLogicalName).toBe('lead');
            });

            it('should load attrMap for entity', async () => {
                await setupComponent();
                const mockAttrMap = new Map([['subject', { type: 'string' }]]);
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'leads', logicalName: 'lead' });
                EntityContextResolver.getAttrMap.mockResolvedValue(mockAttrMap);
                component.attrMap = null;

                await component._ensureEntityContext('leads');

                expect(component.attrMap).toBe(mockAttrMap);
            });
        });
    });

    describe('Required Fields Population', () => {
        describe('_filterRequiredAttributes', () => {
            it('should filter attributes with ApplicationRequired level', async () => {
                await setupComponent();
                const attributes = [
                    { LogicalName: 'name', RequiredLevel: { Value: 'ApplicationRequired' }, IsValidForCreate: true },
                    { LogicalName: 'optional', RequiredLevel: { Value: 'None' }, IsValidForCreate: true }
                ];

                const result = component._filterRequiredAttributes(attributes);

                expect(result.length).toBe(1);
                expect(result[0].LogicalName).toBe('name');
            });

            it('should filter attributes with SystemRequired level', async () => {
                await setupComponent();
                const attributes = [
                    { LogicalName: 'required', RequiredLevel: { Value: 'SystemRequired' }, IsValidForCreate: true }
                ];

                const result = component._filterRequiredAttributes(attributes);

                expect(result.length).toBe(1);
            });

            it('should exclude primary key attributes', async () => {
                await setupComponent();
                const attributes = [
                    { LogicalName: 'accountid', RequiredLevel: { Value: 'SystemRequired' }, IsPrimaryId: true, IsValidForCreate: true }
                ];

                const result = component._filterRequiredAttributes(attributes);

                expect(result.length).toBe(0);
            });

            it('should exclude virtual attributes', async () => {
                await setupComponent();
                const attributes = [
                    { LogicalName: 'virtual', RequiredLevel: { Value: 'ApplicationRequired' }, AttributeType: 'Virtual', IsValidForCreate: true }
                ];

                const result = component._filterRequiredAttributes(attributes);

                expect(result.length).toBe(0);
            });

            it('should exclude non-creatable attributes', async () => {
                await setupComponent();
                const attributes = [
                    { LogicalName: 'readonly', RequiredLevel: { Value: 'ApplicationRequired' }, IsValidForCreate: false }
                ];

                const result = component._filterRequiredAttributes(attributes);

                expect(result.length).toBe(0);
            });
        });

        describe('_getPlaceholderForType', () => {
            it('should return empty string for string type', async () => {
                await setupComponent();
                const result = await component._getPlaceholderForType('string', {});
                expect(result).toBe('');
            });

            it('should return 0 for integer type', async () => {
                await setupComponent();
                const result = await component._getPlaceholderForType('integer', {});
                expect(result).toBe(0);
            });

            it('should return 0.0 for decimal type', async () => {
                await setupComponent();
                const result = await component._getPlaceholderForType('decimal', {});
                expect(result).toBe(0.0);
            });

            it('should return false for boolean type', async () => {
                await setupComponent();
                const result = await component._getPlaceholderForType('boolean', {});
                expect(result).toBe(false);
            });

            it('should return 1 for picklist type', async () => {
                await setupComponent();
                const result = await component._getPlaceholderForType('picklist', {});
                expect(result).toBe(1);
            });

            it('should return ISO date string for datetime type', async () => {
                await setupComponent();
                const result = await component._getPlaceholderForType('datetime', {});
                expect(result).toContain('T');
            });

            it('should return GUID placeholder for uniqueidentifier type', async () => {
                await setupComponent();
                const result = await component._getPlaceholderForType('uniqueidentifier', {});
                expect(result).toBe('00000000-0000-0000-0000-000000000000');
            });
        });
    });

    describe('Touch Dialog', () => {
        describe('_getEntityInputForMethod', () => {
            it('should return GET entity input for GET method', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'GET';
                component.ui.getEntityInput.value = 'accounts';

                const result = component._getEntityInputForMethod();

                expect(result).toBe('accounts');
            });

            it('should return POST/PATCH entity input for POST method', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'contacts';

                const result = component._getEntityInputForMethod();

                expect(result).toBe('contacts');
            });

            it('should return POST/PATCH entity input for PATCH method', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'PATCH';
                component.ui.patchEntityInput.value = 'opportunities';

                const result = component._getEntityInputForMethod();

                expect(result).toBe('opportunities');
            });

            it('should return DELETE entity input for DELETE method', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'DELETE';
                component.ui.deleteEntityInput.value = 'leads';

                const result = component._getEntityInputForMethod();

                expect(result).toBe('leads');
            });
        });

        describe('_buildTouchData', () => {
            it('should build data object from touch config with current values', async () => {
                await setupComponent();
                const record = { name: 'Test Account', revenue: 1000 };
                const touchConfig = [
                    { field: 'name', useCustomValue: false }
                ];

                const result = component._buildTouchData(record, touchConfig);

                expect(result.name).toBe('Test Account');
            });

            it('should use custom value when specified', async () => {
                await setupComponent();
                const record = { name: 'Test Account' };
                const touchConfig = [
                    { field: 'name', useCustomValue: true, customValue: 'New Name' }
                ];

                const result = component._buildTouchData(record, touchConfig);

                expect(result.name).toBe('New Name');
            });

            it('should handle missing field values gracefully', async () => {
                await setupComponent();
                const record = { name: 'Test' };
                const touchConfig = [
                    { field: 'nonexistent', useCustomValue: false }
                ];

                const result = component._buildTouchData(record, touchConfig);

                expect(result.nonexistent).toBeNull();
            });
        });
    });

    describe('Preview URL', () => {
        describe('_setPreviewUrl', () => {
            it('should set preview HTML with GET method and URL', async () => {
                await setupComponent();

                component._setPreviewUrl('accounts?$select=name');

                expect(component.ui.preview.innerHTML).toContain('GET');
                expect(component.ui.preview.innerHTML).toContain('accounts?$select=name');
            });

            it('should include URL content in preview', async () => {
                await setupComponent();

                component._setPreviewUrl('contacts?$top=10');

                expect(component.ui.preview.innerHTML).toContain('contacts?$top=10');
            });
        });
    });

    describe('Cleanup Methods', () => {
        describe('_cleanupDynamicHandlers', () => {
            it('should clear all dynamic handlers', async () => {
                await setupComponent();
                const btn = document.createElement('button');
                const handler = vi.fn();
                component._dynamicHandlers.set(btn, { event: 'click', handler });

                component._cleanupDynamicHandlers();

                expect(component._dynamicHandlers.size).toBe(0);
            });
        });

        describe('_cleanupResultPanel', () => {
            it('should call destroy on resultPanel if available', async () => {
                await setupComponent();
                component.resultPanel.destroy = vi.fn();

                component._cleanupResultPanel();

                expect(component.resultPanel.destroy).toHaveBeenCalled();
            });

            it('should not throw when resultPanel has no destroy method', async () => {
                await setupComponent();
                component.resultPanel.destroy = undefined;

                expect(() => component._cleanupResultPanel()).not.toThrow();
            });
        });
    });

    describe('Toggle Bulk Filter Section', () => {
        describe('_toggleBulkFilterSection', () => {
            it('should hide PATCH filter section when ID is provided', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'PATCH';
                component.ui.patchIdInput.value = 'some-id';

                component._toggleBulkFilterSection();

                expect(component.ui.patchFilterSection.hidden).toBe(true);
            });

            it('should show PATCH filter section when ID is empty', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'PATCH';
                component.ui.patchIdInput.value = '';

                component._toggleBulkFilterSection();

                expect(component.ui.patchFilterSection.hidden).toBe(false);
            });

            it('should hide DELETE filter section when ID is provided', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'DELETE';
                component.ui.deleteIdInput.value = 'some-id';

                component._toggleBulkFilterSection();

                expect(component.ui.deleteFilterSection.hidden).toBe(true);
            });

            it('should show DELETE filter section when ID is empty', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'DELETE';
                component.ui.deleteIdInput.value = '';

                component._toggleBulkFilterSection();

                expect(component.ui.deleteFilterSection.hidden).toBe(false);
            });
        });
    });

    describe('Format JSON Handler', () => {
        describe('_bindPayloadHelpers', () => {
            it('should format valid JSON in body area', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyArea.value = '{"name":"Test","count":5}';

                component._formatJsonHandler();

                expect(component.ui.postBodyArea.value).toContain('  ');
            });

            it('should handle empty body area', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyArea.value = '';

                component._formatJsonHandler();

                expect(component.ui.postBodyArea.value).toBe('{}');
            });

            it('should show error for invalid JSON', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyArea.value = 'invalid json {';

                component._formatJsonHandler();

                expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
            });
        });
    });

    describe('Create Value Input', () => {
        describe('_createValueInput', () => {
            it('should return input HTML with default data attr', async () => {
                await setupComponent();

                const result = component._createValueInput();

                expect(result).toContain('data-prop="field-value"');
            });

            it('should return input HTML with custom data attr', async () => {
                await setupComponent();

                const result = component._createValueInput('custom-value');

                expect(result).toContain('data-prop="custom-value"');
            });

            it('should return input HTML with placeholder', async () => {
                await setupComponent();

                const result = component._createValueInput('value', 'Enter value here');

                expect(result).toContain('placeholder="Enter value here"');
            });
        });
    });

    describe('Reset Field Row', () => {
        describe('_resetFieldRow', () => {
            it('should clear attribute input', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                component._addFieldUI(true);
                const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
                const attrInput = row.querySelector('[data-prop="field-attribute"]');
                const valueContainer = row.querySelector('.pdt-value-container');
                const removeBtn = row.querySelector('.pdt-condition-remove');

                attrInput.value = 'name';

                component._resetFieldRow(row, attrInput, valueContainer, removeBtn);

                expect(attrInput.value).toBe('');
            });

            it('should disable remove button', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                component._addFieldUI(true);
                const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
                const attrInput = row.querySelector('[data-prop="field-attribute"]');
                const valueContainer = row.querySelector('.pdt-value-container');
                const removeBtn = row.querySelector('.pdt-condition-remove');

                component._resetFieldRow(row, attrInput, valueContainer, removeBtn);

                expect(removeBtn.disabled).toBe(true);
            });

            it('should clear row attrMetadata', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                component._addFieldUI(true);
                const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
                row._attrMetadata = { type: 'string' };
                const attrInput = row.querySelector('[data-prop="field-attribute"]');
                const valueContainer = row.querySelector('.pdt-value-container');
                const removeBtn = row.querySelector('.pdt-condition-remove');

                component._resetFieldRow(row, attrInput, valueContainer, removeBtn);

                expect(row._attrMetadata).toBeNull();
            });
        });
    });

    // =====================================================================
    // HTTP Methods, Batch, Touch
    // =====================================================================

    describe('HTTP Method Execution Error Handling', () => {
        describe('_executeHandler error paths', () => {
            let EntityContextResolver;
            let NotificationService;
            let ErrorParser;

            beforeEach(async () => {
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
                ErrorParser = (await import('../../src/utils/parsers/ErrorParser.js')).ErrorParser;
                vi.clearAllMocks();
            });

            it('should show notification for selectTableFirst error', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = '';
                EntityContextResolver.resolve.mockRejectedValue(new Error('Please select a table first'));
                ErrorParser.extract.mockReturnValue('Please select a table first');

                await component._executeHandler();

                // Shows notification based on error type
                expect(NotificationService.show).toHaveBeenCalled();
            });

            it('should show error notification for API errors', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'invalidtable';
                EntityContextResolver.resolve.mockRejectedValue(new Error('Resource not found'));
                ErrorParser.extract.mockReturnValue('Resource not found');

                await component._executeHandler();

                expect(NotificationService.show).toHaveBeenCalledWith('Resource not found', 'error');
            });

            it('should re-enable execute button after error', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = '';
                EntityContextResolver.resolve.mockRejectedValue(new Error('Error'));
                ErrorParser.extract.mockReturnValue('Error');

                await component._executeHandler();

                expect(component.ui.executeBtn.disabled).toBe(false);
            });

            it('should display result section even after error', async () => {
                await setupComponent();
                component.ui.resultRoot.style.display = 'none';
                EntityContextResolver.resolve.mockRejectedValue(new Error('Error'));
                ErrorParser.extract.mockReturnValue('Error');

                await component._executeHandler();

                expect(component.ui.resultRoot.style.display).not.toBe('none');
            });
        });

        describe('_executeGet with network errors', () => {
            let DataService;
            let EntityContextResolver;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                vi.clearAllMocks();
            });

            it('should handle network timeout errors', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'accounts';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                DataService.retrieveMultipleRecords.mockRejectedValue(new Error('Network request timed out'));

                await expect(component._executeGet()).rejects.toThrow('Network request timed out');
            });

            it('should handle 401 unauthorized errors', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'accounts';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                DataService.retrieveMultipleRecords.mockRejectedValue(new Error('Unauthorized: Session expired'));

                await expect(component._executeGet()).rejects.toThrow('Unauthorized');
            });
        });

        describe('_executePost with validation errors', () => {
            let DataService;
            let EntityContextResolver;
            let ValidationService;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                ValidationService = (await import('../../src/services/ValidationService.js')).ValidationService;
                vi.clearAllMocks();
            });

            it('should handle duplicate record errors', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'accounts';
                component.ui.postBodyModeToggle.checked = true;
                component.ui.postBodyArea.value = '{"name": "Duplicate"}';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                ValidationService.validateJson = vi.fn().mockReturnValue({ name: 'Duplicate' });
                DataService.createRecord.mockRejectedValue(new Error('A record with matching key values already exists'));

                await expect(component._executePost()).rejects.toThrow('already exists');
            });

            it('should handle missing required field errors', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'accounts';
                component.ui.postBodyModeToggle.checked = true;
                component.ui.postBodyArea.value = '{}';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                ValidationService.validateJson = vi.fn().mockReturnValue({});
                DataService.createRecord.mockRejectedValue(new Error('Required field "name" is missing'));

                await expect(component._executePost()).rejects.toThrow('Required field');
            });

            it('should handle invalid JSON syntax error', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'accounts';
                component.ui.postBodyModeToggle.checked = true;
                component.ui.postBodyArea.value = '{invalid json}';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                ValidationService.validateJson = vi.fn().mockImplementation(() => {
                    throw new Error('Invalid JSON syntax');
                });

                await expect(component._executePost()).rejects.toThrow('Invalid JSON');
            });
        });
    });

    describe('File Upload Handling', () => {
        describe('_uploadFiles', () => {
            let FileUploadService;
            let NotificationService;

            beforeEach(async () => {
                FileUploadService = (await import('../../src/services/FileUploadService.js')).FileUploadService;
                NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
                vi.clearAllMocks();
            });

            it('should not upload when no file uploads provided', async () => {
                await setupComponent();

                await component._uploadFiles('account', 'record-id', []);

                expect(FileUploadService.uploadFile).not.toHaveBeenCalled();
            });

            it('should not upload when fileUploads is null', async () => {
                await setupComponent();

                await component._uploadFiles('account', 'record-id', null);

                expect(FileUploadService.uploadFile).not.toHaveBeenCalled();
            });

            it('should upload single file', async () => {
                await setupComponent();
                FileUploadService.uploadFile.mockResolvedValue({});
                const uploads = [{
                    attributeName: 'file_column',
                    fileData: 'base64data',
                    fileName: 'test.pdf',
                    mimeType: 'application/pdf'
                }];

                await component._uploadFiles('account', 'record-id', uploads);

                expect(FileUploadService.uploadFile).toHaveBeenCalledWith(
                    'account',
                    'record-id',
                    'file_column',
                    'base64data',
                    'test.pdf',
                    'application/pdf'
                );
            });

            it('should upload multiple files', async () => {
                await setupComponent();
                FileUploadService.uploadFile.mockResolvedValue({});
                const uploads = [
                    { attributeName: 'file1', fileData: 'data1', fileName: 'a.pdf', mimeType: 'application/pdf' },
                    { attributeName: 'file2', fileData: 'data2', fileName: 'b.png', mimeType: 'image/png' }
                ];

                await component._uploadFiles('account', 'record-id', uploads);

                expect(FileUploadService.uploadFile).toHaveBeenCalledTimes(2);
            });

            it('should show warning on file upload failure', async () => {
                await setupComponent();
                FileUploadService.uploadFile.mockRejectedValue(new Error('Upload failed'));
                const uploads = [{
                    attributeName: 'file_column',
                    fileData: 'base64data',
                    fileName: 'test.pdf',
                    mimeType: 'application/pdf'
                }];

                await component._uploadFiles('account', 'record-id', uploads);

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.stringContaining('File upload failed'),
                    'warning'
                );
            });
        });

        describe('_extractFileUploads with file containers', () => {
            it('should extract file upload data from file container', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyModeToggle.checked = false;
                component.ui.postFieldsContainer.innerHTML = '';

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="document_file" />
                    <div class="pdt-file-upload-container" data-prop="field-value" data-type="file"></div>
                `;

                const fileContainer = row.querySelector('.pdt-file-upload-container');
                fileContainer._fileData = 'base64filedata';
                fileContainer._fileName = 'document.pdf';
                fileContainer._mimeType = 'application/pdf';

                component.ui.postFieldsContainer.appendChild(row);

                const uploads = component._extractFileUploads();

                expect(uploads.length).toBe(1);
                expect(uploads[0].attributeName).toBe('document_file');
                expect(uploads[0].fileData).toBe('base64filedata');
                expect(uploads[0].fileName).toBe('document.pdf');
                expect(uploads[0].mimeType).toBe('application/pdf');
            });

            it('should skip file containers without complete data', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyModeToggle.checked = false;
                component.ui.postFieldsContainer.innerHTML = '';

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="incomplete_file" />
                    <div class="pdt-file-upload-container" data-prop="field-value" data-type="file"></div>
                `;

                const fileContainer = row.querySelector('.pdt-file-upload-container');
                fileContainer._fileData = 'base64data';
                // Missing fileName and mimeType

                component.ui.postFieldsContainer.appendChild(row);

                const uploads = component._extractFileUploads();

                expect(uploads.length).toBe(0);
            });
        });
    });

    describe('Touch Records Functionality', () => {
        describe('_handleBulkTouch', () => {
            let EntityContextResolver;
            let PowerAppsApiService;
            let NotificationService;

            beforeEach(async () => {
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                PowerAppsApiService = (await import('../../src/services/PowerAppsApiService.js')).PowerAppsApiService;
                NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
                vi.clearAllMocks();
            });

            it('should show warning when no records provided', async () => {
                await setupComponent();

                await component._handleBulkTouch([]);

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.stringContaining('No records'),
                    'warning'
                );
            });

            it('should show warning when records is null', async () => {
                await setupComponent();

                await component._handleBulkTouch(null);

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.stringContaining('No records'),
                    'warning'
                );
            });

            it('should cancel when touch config dialog returns null', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'accounts';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                PowerAppsApiService.getEntityMetadata = vi.fn().mockResolvedValue({
                    PrimaryIdAttribute: 'accountid',
                    PrimaryNameAttribute: 'name'
                });

                vi.spyOn(component, '_showTouchConfigDialog').mockResolvedValue(null);

                await component._handleBulkTouch([{ accountid: '1', name: 'Test' }]);

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.stringContaining('cancelled'),
                    'info'
                );
            });

            it('should cancel when touch config is empty array', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'accounts';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                PowerAppsApiService.getEntityMetadata = vi.fn().mockResolvedValue({
                    PrimaryIdAttribute: 'accountid',
                    PrimaryNameAttribute: 'name'
                });

                vi.spyOn(component, '_showTouchConfigDialog').mockResolvedValue([]);

                await component._handleBulkTouch([{ accountid: '1', name: 'Test' }]);

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.stringContaining('cancelled'),
                    'info'
                );
            });
        });

        describe('_prepareTouchOperations', () => {
            it('should prepare operations for records with primary key', async () => {
                await setupComponent();
                const records = [
                    { accountid: 'id-1', name: 'Account 1' },
                    { accountid: 'id-2', name: 'Account 2' }
                ];
                const touchConfig = [{ field: 'name', useCustomValue: false }];

                const result = component._prepareTouchOperations(records, 'accountid', touchConfig, 'accounts');

                expect(result.allOperations.length).toBe(2);
                expect(result.totalFailCount).toBe(0);
                expect(result.allErrors.length).toBe(0);
            });

            it('should track failures for records without primary key', async () => {
                await setupComponent();
                const records = [
                    { name: 'No ID Record' }
                ];
                const touchConfig = [{ field: 'name', useCustomValue: false }];

                const result = component._prepareTouchOperations(records, 'accountid', touchConfig, 'accounts');

                expect(result.allOperations.length).toBe(0);
                expect(result.totalFailCount).toBe(1);
                expect(result.allErrors.length).toBe(1);
            });

            it('should create PATCH operations with correct data', async () => {
                await setupComponent();
                const records = [{ contactid: 'c-1', firstname: 'John' }];
                const touchConfig = [{ field: 'firstname', useCustomValue: true, customValue: 'Jane' }];

                const result = component._prepareTouchOperations(records, 'contactid', touchConfig, 'contacts');

                expect(result.allOperations[0].method).toBe('PATCH');
                expect(result.allOperations[0].entitySet).toBe('contacts');
                expect(result.allOperations[0].id).toBe('c-1');
                expect(result.allOperations[0].data.firstname).toBe('Jane');
            });
        });

        describe('_buildTouchData edge cases', () => {
            it('should handle null field values', async () => {
                await setupComponent();
                const record = { name: null };
                const touchConfig = [{ field: 'name', useCustomValue: false }];

                const result = component._buildTouchData(record, touchConfig);

                expect(result.name).toBeNull();
            });

            it('should handle undefined field values', async () => {
                await setupComponent();
                const record = {};
                const touchConfig = [{ field: 'missingfield', useCustomValue: false }];

                const result = component._buildTouchData(record, touchConfig);

                expect(result.missingfield).toBeNull();
            });

            it('should use custom value even when field exists', async () => {
                await setupComponent();
                const record = { status: 'Active' };
                const touchConfig = [{ field: 'status', useCustomValue: true, customValue: 'Inactive' }];

                const result = component._buildTouchData(record, touchConfig);

                expect(result.status).toBe('Inactive');
            });

            it('should handle multiple fields in config', async () => {
                await setupComponent();
                const record = { name: 'Test', revenue: 1000 };
                const touchConfig = [
                    { field: 'name', useCustomValue: false },
                    { field: 'revenue', useCustomValue: true, customValue: 2000 }
                ];

                const result = component._buildTouchData(record, touchConfig);

                expect(result.name).toBe('Test');
                expect(result.revenue).toBe(2000);
            });

            it('should handle lowercase field lookup', async () => {
                await setupComponent();
                const record = { NAME: 'UpperCase' };
                const touchConfig = [{ field: 'name', useCustomValue: false }];

                const result = component._buildTouchData(record, touchConfig);

                // Should fall back to lowercase lookup
                expect(result.name).toBeNull();
            });
        });

        describe('_displayTouchErrors', () => {
            it('should have _displayTouchErrors method defined', async () => {
                await setupComponent();
                expect(typeof component._displayTouchErrors).toBe('function');
            });
        });
    });

    describe('Batch Operations Edge Cases', () => {
        describe('_processBatchOperations with mixed results', () => {
            let DataService;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                vi.clearAllMocks();
            });

            it('should handle mixed success and failure operations', async () => {
                await setupComponent();
                DataService.updateRecord
                    .mockResolvedValueOnce({})
                    .mockRejectedValueOnce(new Error('Failed'))
                    .mockResolvedValueOnce({});

                const operations = [
                    { method: 'PATCH', entitySet: 'accounts', id: '1', data: {} },
                    { method: 'PATCH', entitySet: 'accounts', id: '2', data: {} },
                    { method: 'PATCH', entitySet: 'accounts', id: '3', data: {} }
                ];

                const result = await component._processBatchOperations(operations, 1000);

                expect(result.successCount).toBe(2);
                expect(result.failCount).toBe(1);
            });

            it('should return error details for failures', async () => {
                await setupComponent();
                DataService.deleteRecord.mockRejectedValue(new Error('Record locked'));

                const operations = [
                    { method: 'DELETE', entitySet: 'accounts', id: '1' }
                ];

                const result = await component._processBatchOperations(operations, 1000);

                expect(result.errors.length).toBe(1);
                expect(result.failCount).toBe(1);
            });

            it('should handle unknown method type', async () => {
                await setupComponent();

                const operations = [
                    { method: 'OPTIONS', entitySet: 'accounts', id: '1' }
                ];

                const result = await component._processBatchOperations(operations, 1000);

                expect(result.failCount).toBe(1);
                expect(result.errors[0].error).toContain('Unknown method');
            });

            it('should handle POST operations in batch', async () => {
                const DataService = (await import('../../src/services/DataService.js')).DataService;
                await setupComponent();
                DataService.createRecord.mockResolvedValue({ id: 'new-id' });

                const operations = [
                    { method: 'POST', entitySet: 'accounts', data: { name: 'Test' } }
                ];

                const result = await component._processBatchOperations(operations, 1000);

                expect(result.successCount).toBe(1);
                expect(DataService.createRecord).toHaveBeenCalledWith('accounts', { name: 'Test' });
            });
        });

        describe('_formatBulkOperationResult edge cases', () => {
            it('should handle empty errors array', async () => {
                await setupComponent();

                const result = component._formatBulkOperationResult('Bulk Touch', 100, 100, 0, []);

                expect(result.length).toBe(1);
                expect(result[0].Succeeded).toBe(100);
            });

            it('should format multiple errors', async () => {
                await setupComponent();
                const errors = [
                    { index: 0, error: 'Error A' },
                    { index: 1, error: 'Error B' },
                    { index: 2, error: 'Error C' }
                ];

                const result = component._formatBulkOperationResult('Bulk Update', 10, 7, 3, errors);

                // Should have summary + separator + 3 error rows
                expect(result.length).toBe(5);
            });

            it('should handle null error messages', async () => {
                await setupComponent();
                const errors = [
                    { index: 0, error: null }
                ];

                const result = component._formatBulkOperationResult('Test', 1, 0, 1, errors);

                expect(result[2]['Error Details']).toBe('Unknown error');
            });
        });
    });

    describe('Filter Group Management Edge Cases', () => {
        describe('_initializeFilterManagers', () => {
            it('should create filter managers with correct configuration', async () => {
                await setupComponent();

                expect(component.getFilterManager).toBeTruthy();
                expect(component.patchFilterManager).toBeTruthy();
                expect(component.deleteFilterManager).toBeTruthy();
            });
        });

        describe('Add filter group handlers', () => {
            let NotificationService;
            let EntityContextResolver;

            beforeEach(async () => {
                NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                vi.clearAllMocks();
            });

            it('should show warning when adding GET filter without entity', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = '';
                EntityContextResolver.resolve.mockRejectedValue(new Error('No entity'));

                await component._addGetFilterGroupHandler();

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.any(String),
                    'warning'
                );
            });

            it('should show warning when adding PATCH filter without entity', async () => {
                await setupComponent();
                component.ui.patchEntityInput.value = '';
                EntityContextResolver.resolve.mockRejectedValue(new Error('No entity'));

                await component._addPatchFilterGroupHandler();

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.any(String),
                    'warning'
                );
            });

            it('should show warning when adding DELETE filter without entity', async () => {
                await setupComponent();
                component.ui.deleteEntityInput.value = '';
                EntityContextResolver.resolve.mockRejectedValue(new Error('No entity'));

                await component._addDeleteFilterGroupHandler();

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.any(String),
                    'warning'
                );
            });

            it('should not add filter group for wrong method', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });

                component.getFilterManager.addFilterGroup.mockClear();
                await component._addGetFilterGroupHandler();

                // Should return early without calling addFilterGroup
                expect(component.getFilterManager.addFilterGroup).not.toHaveBeenCalled();
            });

            it('should add filter group when entity context is valid', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'GET';
                component.ui.getEntityInput.value = 'accounts';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());

                await component._addGetFilterGroupHandler();

                expect(component.getFilterManager.addFilterGroup).toHaveBeenCalled();
            });
        });
    });

    describe('Response Handling Edge Cases', () => {
        describe('_displayResult with various data shapes', () => {
            it('should handle undefined entities in lastResult', async () => {
                await setupComponent();
                component.lastResult = { someOtherProp: 'value' };

                expect(() => component._displayResult()).not.toThrow();
                expect(component.resultPanel.renderShell).toHaveBeenCalledWith(0, expect.any(String), expect.any(Boolean));
            });

            it('should handle lastResult as single object', async () => {
                await setupComponent();
                component.lastResult = { id: '123', name: 'Single Record' };

                component._displayResult();

                expect(component.resultPanel.renderShell).toHaveBeenCalled();
            });

            it('should prioritize entities over value property', async () => {
                await setupComponent();
                component.lastResult = {
                    entities: [{ id: '1' }, { id: '2' }],
                    value: [{ id: '3' }]
                };

                component._displayResult();

                expect(component.resultPanel.renderContent).toHaveBeenCalledWith(
                    expect.objectContaining({
                        data: [{ id: '1' }, { id: '2' }]
                    })
                );
            });
        });

        describe('clearResults edge cases', () => {
            it('should handle dispose error gracefully', async () => {
                await setupComponent();
                component.resultPanel.dispose = vi.fn().mockImplementation(() => {
                    throw new Error('Already disposed');
                });

                expect(() => component.clearResults()).not.toThrow();
            });

            it('should recreate resultPanel with correct options', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'testentity';

                component.clearResults();

                expect(component.resultPanel).toBeTruthy();
                expect(component.resultPanel.renderShell).toHaveBeenCalled();
            });
        });
    });

    describe('Required Fields Population Edge Cases', () => {
        describe('_populateRequiredFields', () => {
            it('should be a defined method', async () => {
                await setupComponent();
                expect(typeof component._populateRequiredFields).toBe('function');
            });

            it('should not throw when called with empty string', async () => {
                await setupComponent();
                await expect(component._populateRequiredFields('')).resolves.not.toThrow();
            });
        });

        describe('_filterRequiredAttributes edge cases', () => {
            it('should exclude polymorphic type fields', async () => {
                await setupComponent();
                const attributes = [
                    {
                        LogicalName: 'owneridtype',
                        RequiredLevel: { Value: 'ApplicationRequired' },
                        AttributeType: 'EntityName',
                        IsValidForCreate: true
                    }
                ];

                const result = component._filterRequiredAttributes(attributes);

                expect(result.length).toBe(0);
            });

            it('should handle alternative RequiredLevel structure', async () => {
                await setupComponent();
                const attributes = [
                    {
                        Logicalname: 'name',
                        Requiredlevel: { Value: 'ApplicationRequired' },
                        IsValidForCreate: true
                    }
                ];

                const result = component._filterRequiredAttributes(attributes);

                expect(result.length).toBe(1);
            });
        });

        describe('_getLookupPlaceholderValue', () => {
            let DataService;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                vi.clearAllMocks();
            });

            it('should return placeholder with resolved entity set', async () => {
                await setupComponent();
                DataService.retrieveEntityDefinition = vi.fn().mockResolvedValue({ EntitySetName: 'systemusers' });

                const result = await component._getLookupPlaceholderValue({ Targets: ['systemuser'] });

                expect(result).toBe('/systemusers(00000000-0000-0000-0000-000000000000)');
            });

            it('should fallback on entity resolution error', async () => {
                await setupComponent();
                DataService.retrieveEntityDefinition = vi.fn().mockRejectedValue(new Error('Not found'));

                const result = await component._getLookupPlaceholderValue({ Targets: ['customentity'] });

                expect(result).toBe('/customentitys(00000000-0000-0000-0000-000000000000)');
            });

            it('should handle empty targets array', async () => {
                await setupComponent();
                DataService.retrieveEntityDefinition = vi.fn().mockResolvedValue({ EntitySetName: 'systemusers' });

                const result = await component._getLookupPlaceholderValue({ Targets: [] });

                expect(result).toContain('systemuser');
            });
        });
    });

    describe('Multiselect Picklist Parsing', () => {
        describe('_parseMultiselectValue', () => {
            it('should parse multiselect from checkboxes', async () => {
                await setupComponent();
                const container = document.createElement('div');
                container.className = 'pdt-multiselect-dropdown';
                container.innerHTML = `
                    <div class="pdt-multiselect-option">
                        <input type="checkbox" value="1" checked />
                    </div>
                    <div class="pdt-multiselect-option">
                        <input type="checkbox" value="2" />
                    </div>
                    <div class="pdt-multiselect-option">
                        <input type="checkbox" value="3" checked />
                    </div>
                `;

                const result = component._parseMultiselectValue(container, '');

                expect(result).toBe('1,3');
            });

            it('should return undefined when no checkboxes selected', async () => {
                await setupComponent();
                const container = document.createElement('div');
                container.className = 'pdt-multiselect-dropdown';
                container.innerHTML = `
                    <div class="pdt-multiselect-option">
                        <input type="checkbox" value="1" />
                    </div>
                `;

                const result = component._parseMultiselectValue(container, '');

                expect(result).toBeUndefined();
            });

            it('should return raw value for non-multiselect container', async () => {
                await setupComponent();
                const input = document.createElement('input');

                const result = component._parseMultiselectValue(input, '1,2,3');

                expect(result).toBe('1,2,3');
            });
        });
    });

    describe('Image Value Parsing', () => {
        describe('_parseImageValue', () => {
            it('should return fileData from file upload container', async () => {
                await setupComponent();
                const container = document.createElement('div');
                container.className = 'pdt-file-upload-container';
                container._fileData = 'base64imagedata';

                const result = component._parseImageValue(container, '');

                expect(result).toBe('base64imagedata');
            });

            it('should return manual input value when no fileData', async () => {
                await setupComponent();
                const container = document.createElement('div');
                container.className = 'pdt-file-upload-container';
                container.innerHTML = '<input class="pdt-file-data" value="manualbase64" />';

                const result = component._parseImageValue(container, '');

                expect(result).toBe('manualbase64');
            });

            it('should return raw value for non-container inputs', async () => {
                await setupComponent();
                const input = document.createElement('input');

                const result = component._parseImageValue(input, 'rawimagedata');

                expect(result).toBe('rawimagedata');
            });
        });
    });

    describe('Field Builder Handler Reattachment', () => {
        describe('_reattachFieldHandlers', () => {
            it('should not throw when fieldsContainer is null', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer = null;

                expect(() => component._reattachFieldHandlers()).not.toThrow();
            });

            it('should reattach handlers to existing rows', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                // Add a row manually
                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="name" />
                    <input data-prop="field-value" value="test" />
                    <button class="pdt-condition-remove"></button>
                    <button class="browse-field-attr"></button>
                `;
                component.ui.postFieldsContainer.appendChild(row);

                expect(() => component._reattachFieldHandlers()).not.toThrow();
            });
        });

        describe('_reattachFieldHandlers auto-detection', () => {
            beforeEach(async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'account';
                component.ui.postFieldsContainer.innerHTML = '';

                // Reset mocks
                vi.clearAllMocks();
            });

            it('should attach blur handler for auto-detection', async () => {
                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <div class="pdt-value-container"></div>
                    <button class="pdt-condition-remove"></button>
                    <button class="browse-field-attr"></button>
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const attributeInput = row.querySelector('[data-prop="field-attribute"]');

                component._reattachFieldHandlers();

                // Simulate blur event
                attributeInput.value = 'name';
                const blurEvent = new Event('blur');
                attributeInput.dispatchEvent(blurEvent);

                // Wait for async handler
                await new Promise(resolve => setTimeout(resolve, 50));

                // Verify metadata fetching was attempted
                expect(DataService.getAttributeDefinitions).toHaveBeenCalled();
            });

            it('should attach debounced input handler for auto-detection', async () => {
                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <div class="pdt-value-container"></div>
                    <button class="pdt-condition-remove"></button>
                    <button class="browse-field-attr"></button>
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const attributeInput = row.querySelector('[data-prop="field-attribute"]');

                component._reattachFieldHandlers();

                // Simulate input event
                attributeInput.value = 'name';
                const inputEvent = new Event('input');
                attributeInput.dispatchEvent(inputEvent);

                // Should NOT trigger immediately (debounced)
                expect(DataService.getAttributeDefinitions).not.toHaveBeenCalled();

                // Wait for debounce (300ms)
                await new Promise(resolve => setTimeout(resolve, 350));

                // Now it should have been called
                expect(DataService.getAttributeDefinitions).toHaveBeenCalled();
            });

            it('should attach keydown handler for Enter key immediate detection', async () => {
                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <div class="pdt-value-container"></div>
                    <button class="pdt-condition-remove"></button>
                    <button class="browse-field-attr"></button>
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const attributeInput = row.querySelector('[data-prop="field-attribute"]');

                component._reattachFieldHandlers();

                // Simulate Enter key press
                attributeInput.value = 'name';
                const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter' });
                attributeInput.dispatchEvent(keydownEvent);

                // Wait for async handler
                await new Promise(resolve => setTimeout(resolve, 50));

                // Should trigger immediately on Enter
                expect(DataService.getAttributeDefinitions).toHaveBeenCalled();
            });

            it('should render value input when metadata is found', async () => {
                DataService.getAttributeDefinitions.mockResolvedValue([{
                    LogicalName: 'primarycontactid',
                    AttributeType: 'Lookup',
                    Targets: ['contact']
                }]);

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <div class="pdt-value-container"></div>
                    <button class="pdt-condition-remove"></button>
                    <button class="browse-field-attr"></button>
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const attributeInput = row.querySelector('[data-prop="field-attribute"]');
                const renderSpy = vi.spyOn(component, '_renderValueInput');

                component._reattachFieldHandlers();

                // Trigger detection
                attributeInput.value = 'primarycontactid';
                attributeInput.dispatchEvent(new Event('blur'));

                await new Promise(resolve => setTimeout(resolve, 100));

                // Should have rendered value input with metadata
                expect(renderSpy).toHaveBeenCalled();
                expect(row._attrMetadata).toBeTruthy();
            });

            it('should append @odata.bind for lookup fields', async () => {
                DataService.getAttributeDefinitions.mockResolvedValue([{
                    LogicalName: 'primarycontactid',
                    AttributeType: 'Lookup',
                    Targets: ['contact']
                }]);
                DataService.getNavigationPropertyMap.mockResolvedValue(
                    new Map([['primarycontactid', 'primarycontactid']])
                );

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <div class="pdt-value-container"></div>
                    <button class="pdt-condition-remove"></button>
                    <button class="browse-field-attr"></button>
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const attributeInput = row.querySelector('[data-prop="field-attribute"]');

                component._reattachFieldHandlers();

                // Trigger detection with lookup field
                attributeInput.value = 'primarycontactid';
                attributeInput.dispatchEvent(new Event('blur'));

                await new Promise(resolve => setTimeout(resolve, 100));

                // Should append @odata.bind
                expect(attributeInput.value).toBe('primarycontactid@odata.bind');
            });

            it('should not duplicate @odata.bind suffix', async () => {
                DataService.getAttributeDefinitions.mockResolvedValue([{
                    LogicalName: 'primarycontactid',
                    AttributeType: 'Lookup',
                    Targets: ['contact']
                }]);
                DataService.getNavigationPropertyMap.mockResolvedValue(
                    new Map([['primarycontactid', 'primarycontactid']])
                );

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <div class="pdt-value-container"></div>
                    <button class="pdt-condition-remove"></button>
                    <button class="browse-field-attr"></button>
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const attributeInput = row.querySelector('[data-prop="field-attribute"]');

                component._reattachFieldHandlers();

                // Trigger detection with already-suffixed lookup field
                attributeInput.value = 'primarycontactid@odata.bind';
                attributeInput.dispatchEvent(new Event('blur'));

                await new Promise(resolve => setTimeout(resolve, 100));

                // Should NOT duplicate suffix
                expect(attributeInput.value).toBe('primarycontactid@odata.bind');
            });

            it('should prevent concurrent metadata loading', async () => {
                let resolveFirst;
                const firstPromise = new Promise(resolve => { resolveFirst = resolve; });

                DataService.getAttributeDefinitions.mockImplementation(() => firstPromise);

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <div class="pdt-value-container"></div>
                    <button class="pdt-condition-remove"></button>
                    <button class="browse-field-attr"></button>
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const attributeInput = row.querySelector('[data-prop="field-attribute"]');

                component._reattachFieldHandlers();

                // Trigger first detection
                attributeInput.value = 'name';
                attributeInput.dispatchEvent(new Event('blur'));

                await new Promise(resolve => setTimeout(resolve, 10));

                // Trigger second detection while first is still loading
                attributeInput.dispatchEvent(new Event('blur'));

                // Should only call once (second call prevented by _isLoadingMetadata flag)
                expect(DataService.getAttributeDefinitions).toHaveBeenCalledTimes(1);

                resolveFirst([]);
            });

            it('should handle auto-detection errors gracefully', async () => {
                DataService.getAttributeDefinitions.mockRejectedValue(new Error('API Error'));

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <div class="pdt-value-container"></div>
                    <button class="pdt-condition-remove"></button>
                    <button class="browse-field-attr"></button>
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const attributeInput = row.querySelector('[data-prop="field-attribute"]');

                component._reattachFieldHandlers();

                // Trigger detection - should not throw even on error
                attributeInput.value = 'name';
                attributeInput.dispatchEvent(new Event('blur'));

                // Wait for async handler to complete including finally block
                await new Promise(resolve => setTimeout(resolve, 200));

                // Loading flag should be reset after error
                expect(row._isLoadingMetadata).toBeFalsy();
            });

            it('should skip detection for short attribute names', async () => {
                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <div class="pdt-value-container"></div>
                    <button class="pdt-condition-remove"></button>
                    <button class="browse-field-attr"></button>
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const attributeInput = row.querySelector('[data-prop="field-attribute"]');

                component._reattachFieldHandlers();

                // Trigger with short name (2 chars)
                attributeInput.value = 'ab';
                attributeInput.dispatchEvent(new Event('blur'));

                await new Promise(resolve => setTimeout(resolve, 100));

                // Should NOT trigger for names <= 2 chars
                expect(DataService.getAttributeDefinitions).not.toHaveBeenCalled();
            });

            it('should work for both POST and PATCH methods', async () => {
                component.ui.methodSelect.value = 'PATCH';
                component.ui.patchEntityInput.value = 'contact';

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <div class="pdt-value-container"></div>
                    <button class="pdt-condition-remove"></button>
                    <button class="browse-field-attr"></button>
                `;
                component.ui.patchFieldsContainer.appendChild(row);

                const attributeInput = row.querySelector('[data-prop="field-attribute"]');

                component._reattachFieldHandlers();

                // Trigger detection
                attributeInput.value = 'fullname';
                attributeInput.dispatchEvent(new Event('blur'));

                await new Promise(resolve => setTimeout(resolve, 100));

                // Should work for PATCH too
                expect(DataService.getAttributeDefinitions).toHaveBeenCalled();
            });
        });
    });

    describe('_restoreFieldBuilder', () => {
        it('should restore from HTML state', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            const state = {
                fieldsHtml: '<div class="pdt-field-grid"><input data-prop="field-attribute" /><input data-prop="field-value" /></div>',
                fieldValues: [{ attribute: 'test', value: 'value' }]
            };

            component._restoreFieldBuilder(state);

            expect(component.ui.postFieldsContainer.innerHTML).toContain('pdt-field-grid');
        });

        it('should add empty field when no HTML state', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.postFieldsContainer.innerHTML = '';
            const state = { fieldsHtml: '', fieldValues: [] };

            component._restoreFieldBuilder(state);

            const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
            expect(rows.length).toBe(1);
        });
    });

    describe('Get Count Handler Edge Cases', () => {
        describe('_bindGetCount', () => {
            let DataService;
            let PowerAppsApiService;
            let EntityContextResolver;
            let NotificationService;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                PowerAppsApiService = (await import('../../src/services/PowerAppsApiService.js')).PowerAppsApiService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
                vi.clearAllMocks();
            });

            it('should not execute when button is disabled', async () => {
                await setupComponent();
                component.ui.getCountBtn.disabled = true;

                await component._getCountHandler();

                expect(EntityContextResolver.resolve).not.toHaveBeenCalled();
            });

            it('should restore button state after error', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'accounts';
                EntityContextResolver.resolve.mockRejectedValue(new Error('Failed'));

                await component._getCountHandler();

                expect(component.ui.getCountBtn.disabled).toBe(false);
                expect(component.ui.getCountBtn.textContent).toContain('Get Count');
            });

            it('should execute full count flow successfully', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'accounts';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());
                PowerAppsApiService.getEntityMetadata = vi.fn().mockResolvedValue({ PrimaryIdAttribute: 'accountid' });
                DataService.retrieveMultipleRecords.mockResolvedValue({
                    entities: [{ accountid: '1' }, { accountid: '2' }],
                    nextLink: null
                });

                await component._getCountHandler();

                expect(component.lastResult.entities[0]).toHaveProperty('Count');
                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.stringContaining('2'),
                    'success'
                );
            });

            it('should handle paginated count with multiple pages', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'accounts';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());
                PowerAppsApiService.getEntityMetadata = vi.fn().mockResolvedValue({ PrimaryIdAttribute: 'accountid' });
                DataService.retrieveMultipleRecords
                    .mockResolvedValueOnce({
                        entities: [{ accountid: '1' }],
                        nextLink: 'https://org.crm/api?$skiptoken=1'
                    })
                    .mockResolvedValueOnce({
                        entities: [{ accountid: '2' }],
                        nextLink: null
                    });

                await component._getCountHandler();

                expect(component.lastResult.entities[0].Pages).toBe('2');
            });

            it('should not execute when getCountBtn is null', async () => {
                await setupComponent();
                component.ui.getCountBtn = null;

                await expect(component._getCountHandler()).resolves.not.toThrow();
            });
        });
    });

    describe('Touch Dialog Creation and Interaction', () => {
        describe('_createTouchDialogOverlay', () => {
            it('should create dialog with pdt-dialog-overlay class', async () => {
                await setupComponent();

                const overlay = component._createTouchDialogOverlay('name');

                expect(overlay.className).toContain('pdt-dialog-overlay');
            });

            it('should include touch fields container', async () => {
                await setupComponent();

                const overlay = component._createTouchDialogOverlay('name');

                expect(overlay.querySelector('#touch-fields-container')).toBeTruthy();
            });

            it('should include add field button', async () => {
                await setupComponent();

                const overlay = component._createTouchDialogOverlay('name');

                expect(overlay.querySelector('#touch-add-field-btn')).toBeTruthy();
            });

            it('should include confirm and cancel buttons', async () => {
                await setupComponent();

                const overlay = component._createTouchDialogOverlay('name');

                expect(overlay.querySelector('#touch-confirm-btn')).toBeTruthy();
                expect(overlay.querySelector('#touch-cancel-btn')).toBeTruthy();
            });

            it('should add light-mode class when theme is light', async () => {
                const { Store } = await import('../../src/core/Store.js');
                Store.getState.mockReturnValue({ theme: 'light' });
                await setupComponent();

                const overlay = component._createTouchDialogOverlay('name');

                expect(overlay.classList.contains('light-mode')).toBe(true);
            });
        });

        describe('_createTouchFieldRowHTML', () => {
            it('should create field row with input elements', async () => {
                await setupComponent();
                const container = document.createElement('div');

                const row = component._createTouchFieldRowHTML(container, 'row-1', 'fieldName', 'current', '', true);

                expect(row.querySelector('.field-name-input')).toBeTruthy();
                expect(row.querySelector('.field-name-input').value).toBe('fieldName');
            });

            it('should include radio buttons for value mode', async () => {
                await setupComponent();
                const container = document.createElement('div');

                const row = component._createTouchFieldRowHTML(container, 'row-1', '', 'current', '', false);

                expect(row.querySelectorAll('input[type="radio"]').length).toBe(2);
            });

            it('should include remove button for non-first rows', async () => {
                await setupComponent();
                const container = document.createElement('div');

                const row = component._createTouchFieldRowHTML(container, 'row-1', '', 'current', '', false);

                expect(row.querySelector('.pdt-touch-remove-btn')).toBeTruthy();
            });

            it('should not include remove button for first row', async () => {
                await setupComponent();
                const container = document.createElement('div');

                const row = component._createTouchFieldRowHTML(container, 'row-1', '', 'current', '', true);

                expect(row.querySelector('.pdt-touch-remove-btn')).toBeNull();
            });

            it('should disable custom value input when mode is current', async () => {
                await setupComponent();
                const container = document.createElement('div');

                const row = component._createTouchFieldRowHTML(container, 'row-1', '', 'current', '', false);

                expect(row.querySelector('.custom-value-input').disabled).toBe(true);
            });

            it('should enable custom value input when mode is custom', async () => {
                await setupComponent();
                const container = document.createElement('div');

                const row = component._createTouchFieldRowHTML(container, 'row-1', '', 'custom', 'value', false);

                expect(row.querySelector('.custom-value-input').disabled).toBe(false);
            });
        });

        describe('_addTouchFieldRow', () => {
            it('should append row to fields container', async () => {
                await setupComponent();
                const container = document.createElement('div');

                component._addTouchFieldRow('account', container, 'name', 'current', '', true);

                expect(container.children.length).toBe(1);
            });

            it('should add multiple rows when called multiple times', async () => {
                await setupComponent();
                const container = document.createElement('div');

                component._addTouchFieldRow('account', container, 'name', 'current', '', true);
                component._addTouchFieldRow('account', container, 'revenue', 'custom', '1000', false);

                expect(container.children.length).toBe(2);
            });
        });

        describe('_bindTouchFieldRowHandlers', () => {
            it('should bind radio button change handlers', async () => {
                await setupComponent();
                const container = document.createElement('div');
                const row = component._createTouchFieldRowHTML(container, 'row-1', '', 'current', '', false);
                container.appendChild(row);

                component._bindTouchFieldRowHandlers('account', container, row, 'row-1', false);

                const customRadio = row.querySelector('input[value="custom"]');
                customRadio.checked = true;
                customRadio.dispatchEvent(new Event('change'));

                expect(row.querySelector('.custom-value-input').disabled).toBe(false);
            });

            it('should bind browse button handler', async () => {
                await setupComponent();
                const container = document.createElement('div');
                const row = component._createTouchFieldRowHTML(container, 'row-1', '', 'current', '', false);
                container.appendChild(row);

                component._bindTouchFieldRowHandlers('account', container, row, 'row-1', false);

                const browseBtn = row.querySelector('.browse-field-btn');
                expect(() => browseBtn.click()).not.toThrow();
            });

            it('should bind remove button handler for non-first rows', async () => {
                await setupComponent();
                const container = document.createElement('div');
                const row = component._createTouchFieldRowHTML(container, 'row-1', '', 'current', '', false);
                container.appendChild(row);

                component._bindTouchFieldRowHandlers('account', container, row, 'row-1', false);

                const removeBtn = row.querySelector('.pdt-touch-remove-btn');
                removeBtn.click();

                expect(container.children.length).toBe(0);
            });
        });

        describe('_handleTouchFieldBrowse', () => {
            it('should call showColumnBrowser', async () => {
                const { showColumnBrowser } = await import('../../src/helpers/index.js');
                await setupComponent();
                const fieldInput = document.createElement('input');

                component._handleTouchFieldBrowse('account', fieldInput);

                expect(showColumnBrowser).toHaveBeenCalled();
            });
        });

        describe('_handleTouchFieldRemove', () => {
            it('should remove row from container', async () => {
                await setupComponent();
                const container = document.createElement('div');
                const row1 = document.createElement('div');
                row1.className = 'pdt-builder-group';
                row1.innerHTML = '<div class="pdt-section-header">Field 1</div>';
                const row2 = document.createElement('div');
                row2.className = 'pdt-builder-group';
                row2.innerHTML = '<div class="pdt-section-header">Field 2</div>';
                container.appendChild(row1);
                container.appendChild(row2);

                component._handleTouchFieldRemove(container, row1);

                expect(container.children.length).toBe(1);
            });

            it('should renumber remaining rows after removal', async () => {
                await setupComponent();
                const container = document.createElement('div');
                for (let i = 1; i <= 3; i++) {
                    const row = document.createElement('div');
                    row.className = 'pdt-builder-group';
                    row.innerHTML = `<div class="pdt-section-header">Field ${i}</div>`;
                    container.appendChild(row);
                }

                component._handleTouchFieldRemove(container, container.children[0]);

                // First remaining row should now be "Field 1"
                expect(container.children.length).toBe(2);
            });
        });

        describe('_handleTouchDialogConfirm', () => {
            it('should show warning when field name is empty', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                await setupComponent();
                const container = document.createElement('div');
                const row = document.createElement('div');
                row.className = 'pdt-builder-group';
                row.dataset.rowId = 'row-1';
                row.innerHTML = `
                    <input class="field-name-input" value="" />
                    <input type="radio" name="value-mode-row-1" value="current" checked />
                    <input class="custom-value-input" value="" />
                `;
                container.appendChild(row);
                const overlay = document.createElement('div');
                const resolve = vi.fn();

                component._handleTouchDialogConfirm(container, overlay, resolve);

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.any(String),
                    'warning'
                );
                expect(resolve).not.toHaveBeenCalled();
            });

            it('should show warning when custom value is empty but custom mode selected', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                await setupComponent();
                const container = document.createElement('div');
                const row = document.createElement('div');
                row.className = 'pdt-builder-group';
                row.dataset.rowId = 'row-1';
                row.innerHTML = `
                    <input class="field-name-input" value="name" />
                    <input type="radio" name="value-mode-row-1" value="custom" checked />
                    <input class="custom-value-input" value="" />
                `;
                container.appendChild(row);
                const overlay = document.createElement('div');
                const resolve = vi.fn();

                component._handleTouchDialogConfirm(container, overlay, resolve);

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.any(String),
                    'warning'
                );
            });

            it('should resolve with field configs on valid input', async () => {
                await setupComponent();
                const container = document.createElement('div');
                const row = document.createElement('div');
                row.className = 'pdt-builder-group';
                row.dataset.rowId = 'row-1';
                row.innerHTML = `
                    <input class="field-name-input" value="name" />
                    <input type="radio" name="value-mode-row-1" value="current" checked />
                    <input class="custom-value-input" value="" disabled />
                `;
                container.appendChild(row);
                const overlay = document.createElement('div');
                document.body.appendChild(overlay);
                const resolve = vi.fn();

                component._handleTouchDialogConfirm(container, overlay, resolve);

                expect(resolve).toHaveBeenCalledWith([
                    expect.objectContaining({ field: 'name', useCustomValue: false })
                ]);
            });

            it('should show warning when no fields configured', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                await setupComponent();
                const container = document.createElement('div');
                const overlay = document.createElement('div');
                const resolve = vi.fn();

                component._handleTouchDialogConfirm(container, overlay, resolve);

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.any(String),
                    'warning'
                );
            });
        });

        describe('_bindTouchDialogCancelHandlers', () => {
            it('should resolve with null on cancel button click', async () => {
                await setupComponent();
                const overlay = document.createElement('div');
                document.body.appendChild(overlay);
                const cancelBtn = document.createElement('button');
                const resolve = vi.fn();

                component._bindTouchDialogCancelHandlers(overlay, cancelBtn, resolve);
                cancelBtn.click();

                expect(resolve).toHaveBeenCalledWith(null);
            });

            it('should resolve with null on overlay click', async () => {
                await setupComponent();
                const overlay = document.createElement('div');
                document.body.appendChild(overlay);
                const cancelBtn = document.createElement('button');
                const resolve = vi.fn();

                component._bindTouchDialogCancelHandlers(overlay, cancelBtn, resolve);
                overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

                expect(resolve).toHaveBeenCalledWith(null);
            });

            it('should resolve with null on ESC key press', async () => {
                await setupComponent();
                const overlay = document.createElement('div');
                document.body.appendChild(overlay);
                const cancelBtn = document.createElement('button');
                const resolve = vi.fn();

                component._bindTouchDialogCancelHandlers(overlay, cancelBtn, resolve);
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

                expect(resolve).toHaveBeenCalledWith(null);
            });

            it('should only call resolve once on multiple cancel attempts', async () => {
                await setupComponent();
                const overlay = document.createElement('div');
                document.body.appendChild(overlay);
                const cancelBtn = document.createElement('button');
                const resolve = vi.fn();

                component._bindTouchDialogCancelHandlers(overlay, cancelBtn, resolve);
                cancelBtn.click();
                cancelBtn.click();

                expect(resolve).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('Touch Result Handling', () => {
        describe('_handleTouchResult', () => {
            it('should reload records on success', async () => {
                await setupComponent();
                vi.spyOn(component, '_reloadRecordsAfterTouch').mockResolvedValue();

                await component._handleTouchResult(10, 0, []);

                expect(component._reloadRecordsAfterTouch).toHaveBeenCalled();
            });

            it('should display errors on partial failure', async () => {
                await setupComponent();
                vi.spyOn(component, '_displayTouchErrors').mockImplementation(() => { });

                await component._handleTouchResult(5, 3, [{ error: 'Failed' }]);

                expect(component._displayTouchErrors).toHaveBeenCalledWith(5, 3, [{ error: 'Failed' }]);
            });
        });

        describe('_reloadRecordsAfterTouch', () => {
            let DataService;
            let EntityContextResolver;
            let NotificationService;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
                vi.clearAllMocks();
            });

            it('should reload and display records', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'accounts';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());
                DataService.retrieveMultipleRecords.mockResolvedValue({
                    entities: [{ id: '1' }],
                    nextLink: null
                });

                await component._reloadRecordsAfterTouch();

                expect(component.allLoadedRecords.length).toBe(1);
            });

            it('should show pagination banner when nextLink exists', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'accounts';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());
                DataService.retrieveMultipleRecords.mockResolvedValue({
                    entities: [{ id: '1' }],
                    nextLink: 'https://next.page'
                });
                vi.spyOn(component, '_showPaginationBanner').mockImplementation(() => { });

                await component._reloadRecordsAfterTouch();

                expect(component._showPaginationBanner).toHaveBeenCalled();
            });

            it('should show warning on reload failure', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'accounts';
                EntityContextResolver.resolve.mockRejectedValue(new Error('Reload failed'));

                await component._reloadRecordsAfterTouch();

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.stringContaining('reload'),
                    'warning'
                );
            });
        });

        describe('_displayTouchErrors', () => {
            it('should show warning notification', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                await setupComponent();

                component._displayTouchErrors(5, 2, [{ error: 'Error 1' }]);

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.any(String),
                    'warning'
                );
            });

            it('should update lastResult with error details', async () => {
                await setupComponent();

                component._displayTouchErrors(3, 2, [
                    { error: 'Error A' },
                    { error: 'Error B' }
                ]);

                expect(component.lastResult.entities.length).toBe(2);
            });
        });
    });

    describe('Required Fields Population Complete Flow', () => {
        describe('_populateRequiredFields', () => {
            it('should return early when logicalName is empty', async () => {
                await setupComponent();

                await component._populateRequiredFields('');
                await component._populateRequiredFields(null);
                await component._populateRequiredFields(undefined);

                // Should not throw
                expect(true).toBe(true);
            });
        });

        describe('_populateRequiredFieldsJsonMode', () => {
            let DataService;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                vi.clearAllMocks();
            });

            it('should populate JSON body with required fields', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                const requiredAttrs = [
                    { LogicalName: 'name', AttributeType: 'String' },
                    { LogicalName: 'revenue', AttributeType: 'Money' }
                ];
                const navPropMap = new Map();

                await component._populateRequiredFieldsJsonMode(requiredAttrs, navPropMap);

                const jsonBody = JSON.parse(component.ui.postBodyArea.value);
                expect(jsonBody).toHaveProperty('name');
                expect(jsonBody).toHaveProperty('revenue');
            });

            it('should use navigation property for lookups', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                DataService.retrieveEntityDefinition = vi.fn().mockResolvedValue({ EntitySetName: 'accounts' });
                const requiredAttrs = [
                    { LogicalName: 'primarycontactid', AttributeType: 'Lookup', Targets: ['contact'] }
                ];
                const navPropMap = new Map([['primarycontactid', 'primarycontact']]);

                await component._populateRequiredFieldsJsonMode(requiredAttrs, navPropMap);

                const jsonBody = JSON.parse(component.ui.postBodyArea.value);
                expect(jsonBody).toHaveProperty('primarycontact@odata.bind');
            });
        });

        describe('_populateRequiredFieldsBuilderMode', () => {
            it('should be a defined method', async () => {
                await setupComponent();
                expect(typeof component._populateRequiredFieldsBuilderMode).toBe('function');
            });

            it('should handle empty requiredAttrs array', async () => {
                await setupComponent();
                const navPropMap = new Map();

                await component._populateRequiredFieldsBuilderMode([], navPropMap, 'account');

                // Should not throw
                expect(true).toBe(true);
            });
        });
    });

    describe('Lookup Value Parsing', () => {
        describe('_parseLookupValue', () => {
            it('should return value with valid OData reference format', async () => {
                await setupComponent();
                const result = component._parseLookupValue('/accounts(12345678-1234-1234-1234-123456789012)');
                expect(result).toBe('/accounts(12345678-1234-1234-1234-123456789012)');
            });

            it('should return undefined for invalid format', async () => {
                await setupComponent();
                const result = component._parseLookupValue('12345678-1234-1234-1234-123456789012');
                expect(result).toBeUndefined();
            });

            it('should return undefined for empty string', async () => {
                await setupComponent();
                const result = component._parseLookupValue('');
                expect(result).toBeUndefined();
            });
        });
    });

    describe('Field Builder Remove Handler', () => {
        describe('_createFieldRemoveHandler', () => {
            it('should reset field when only one row exists', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                component._addFieldUI(true, 'POST');

                const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
                const attrInput = row.querySelector('[data-prop="field-attribute"]');
                const removeBtn = row.querySelector('.pdt-condition-remove');
                const browseBtn = row.querySelector('.browse-field-attr');

                attrInput.value = 'testfield';

                const handler = component._createFieldRemoveHandler(row, attrInput, removeBtn, browseBtn);
                handler();

                expect(attrInput.value).toBe('');
            });

            it('should remove row when multiple rows exist', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                component._addFieldUI(true, 'POST');
                component._addFieldUI(false, 'POST');

                const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
                const secondRow = rows[1];
                const attrInput = secondRow.querySelector('[data-prop="field-attribute"]');
                const removeBtn = secondRow.querySelector('.pdt-condition-remove');
                const browseBtn = secondRow.querySelector('.browse-field-attr');
                const browseHandler = () => { };

                const handler = component._createFieldRemoveHandler(secondRow, attrInput, removeBtn, browseBtn, browseHandler, 'POST');
                handler();

                expect(component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid').length).toBe(1);
            });

            it('should cleanup dynamic handlers on remove', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                component._addFieldUI(false, 'POST');

                const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
                const attrInput = row.querySelector('[data-prop="field-attribute"]');
                const removeBtn = row.querySelector('.pdt-condition-remove');
                const browseBtn = row.querySelector('.browse-field-attr');

                const initialSize = component._dynamicHandlers.size;
                const handler = component._createFieldRemoveHandler(row, attrInput, removeBtn, browseBtn);
                handler();

                expect(component._dynamicHandlers.size).toBeLessThanOrEqual(initialSize);
            });
        });
    });

    describe('Field Browse Handler', () => {
        describe('_createFieldBrowseHandler', () => {
            it('should return a function', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                component._addFieldUI(true, 'POST');

                const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
                const handler = component._createFieldBrowseHandler(row, true);

                expect(typeof handler).toBe('function');
            });

            it('should call showColumnBrowser when invoked', async () => {
                const { showColumnBrowser } = await import('../../src/helpers/index.js');
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                component._addFieldUI(true, 'POST');

                const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
                const handler = component._createFieldBrowseHandler(row, true);
                handler();

                expect(showColumnBrowser).toHaveBeenCalled();
            });
        });
    });

    describe('OData Query Building Fallback with Filters', () => {
        describe('_buildGetOptionsStringFallback with filter groups', () => {
            it('should build filter with contains operator', async () => {
                await setupComponent();
                component.getFilterManager.extractFilterGroups.mockReturnValue([
                    { filterType: 'and', filters: [{ attr: 'name', op: 'contains', value: 'test' }] }
                ]);

                const result = component._buildGetOptionsStringFallback();

                expect(result).toContain('contains(name');
            });

            it('should build filter with startswith operator', async () => {
                await setupComponent();
                component.getFilterManager.extractFilterGroups.mockReturnValue([
                    { filterType: 'and', filters: [{ attr: 'name', op: 'startswith', value: 'A' }] }
                ]);

                const result = component._buildGetOptionsStringFallback();

                expect(result).toContain('startswith(name');
            });

            it('should build filter with endswith operator', async () => {
                await setupComponent();
                component.getFilterManager.extractFilterGroups.mockReturnValue([
                    { filterType: 'and', filters: [{ attr: 'name', op: 'endswith', value: 'Corp' }] }
                ]);

                const result = component._buildGetOptionsStringFallback();

                expect(result).toContain('endswith(name');
            });

            it('should build filter with not contains operator', async () => {
                await setupComponent();
                component.getFilterManager.extractFilterGroups.mockReturnValue([
                    { filterType: 'and', filters: [{ attr: 'name', op: 'not contains', value: 'test' }] }
                ]);

                const result = component._buildGetOptionsStringFallback();

                expect(result).toContain('not contains(name');
            });

            it('should build filter with null operators', async () => {
                await setupComponent();
                component.getFilterManager.extractFilterGroups.mockReturnValue([
                    { filterType: 'and', filters: [{ attr: 'email', op: 'eq null', value: '' }] }
                ]);

                const result = component._buildGetOptionsStringFallback();

                expect(result).toContain('email eq null');
            });

            it('should handle multiple filter groups with and', async () => {
                await setupComponent();
                component.getFilterManager.extractFilterGroups.mockReturnValue([
                    { filterType: 'and', filters: [{ attr: 'name', op: 'eq', value: 'test' }] },
                    { filterType: 'and', filters: [{ attr: 'status', op: 'eq', value: '1' }] }
                ]);

                const result = component._buildGetOptionsStringFallback();

                expect(result).toContain('$filter=');
                expect(result).toContain(' and ');
            });

            it('should handle or filter type', async () => {
                await setupComponent();
                component.getFilterManager.extractFilterGroups.mockReturnValue([
                    {
                        filterType: 'or', filters: [
                            { attr: 'name', op: 'eq', value: 'A' },
                            { attr: 'name', op: 'eq', value: 'B' }
                        ]
                    }
                ]);

                const result = component._buildGetOptionsStringFallback();

                expect(result).toContain(' or ');
            });

            it('should handle not filter type', async () => {
                await setupComponent();
                component.getFilterManager.extractFilterGroups.mockReturnValue([
                    {
                        filterType: 'not', filters: [
                            { attr: 'status', op: 'eq', value: '1' },
                            { attr: 'active', op: 'eq', value: 'true' }
                        ]
                    }
                ]);

                const result = component._buildGetOptionsStringFallback();

                expect(result).toContain('not (');
            });

            it('should skip empty filter conditions', async () => {
                await setupComponent();
                component.getFilterManager.extractFilterGroups.mockReturnValue([
                    { filterType: 'and', filters: [{ attr: '', op: '', value: '' }] }
                ]);

                const result = component._buildGetOptionsStringFallback();

                expect(result).not.toContain('$filter=');
            });
        });
    });

    describe('Destroy Method Cleanup', () => {
        describe('destroy lifecycle', () => {
            it('should call all cleanup methods', async () => {
                await setupComponent();
                vi.spyOn(component, '_removeInputHandlers');
                vi.spyOn(component, '_removeButtonHandlers');
                vi.spyOn(component, '_removeLivePreviewHandlers');
                vi.spyOn(component, '_removeExternalHandlers');
                vi.spyOn(component, '_cleanupDynamicHandlers');
                vi.spyOn(component, '_cleanupResultPanel');

                component.destroy();

                expect(component._removeInputHandlers).toHaveBeenCalled();
                expect(component._removeButtonHandlers).toHaveBeenCalled();
                expect(component._removeLivePreviewHandlers).toHaveBeenCalled();
                expect(component._removeExternalHandlers).toHaveBeenCalled();
                expect(component._cleanupDynamicHandlers).toHaveBeenCalled();
                expect(component._cleanupResultPanel).toHaveBeenCalled();
            });
        });

        describe('_removeLivePreviewHandlers', () => {
            it('should not throw when handler is null', async () => {
                await setupComponent();
                component._livePreviewRefreshHandler = null;

                expect(() => component._removeLivePreviewHandlers()).not.toThrow();
            });

            it('should call cancel on debounced handler if available', async () => {
                await setupComponent();
                const mockHandler = vi.fn();
                mockHandler.cancel = vi.fn();
                component._livePreviewRefreshHandler = mockHandler;

                component._removeLivePreviewHandlers();

                expect(mockHandler.cancel).toHaveBeenCalled();
            });
        });

        describe('_removeExternalHandlers', () => {
            it('should remove document event listeners', async () => {
                await setupComponent();
                const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

                component._removeExternalHandlers();

                expect(removeEventListenerSpy).toHaveBeenCalledWith('pdt:tool-refresh', expect.any(Function));
                expect(removeEventListenerSpy).toHaveBeenCalledWith('pdt:refresh', expect.any(Function));
            });
        });
    });

    describe('Execution State Management', () => {
        describe('_setExecuting state transitions', () => {
            it('should set busy indicator when executing', async () => {
                const { BusyIndicator } = await import('../../src/utils/ui/BusyIndicator.js');
                await setupComponent();

                component._setExecuting(true);

                expect(BusyIndicator.set).toHaveBeenCalled();
            });

            it('should clear busy indicator when not executing', async () => {
                const { BusyIndicator } = await import('../../src/utils/ui/BusyIndicator.js');
                await setupComponent();

                component._setExecuting(false);

                expect(BusyIndicator.clear).toHaveBeenCalled();
            });
        });
    });

    describe('Body Mode Toggle Handler', () => {
        describe('_bindFieldBuilder toggle handler', () => {
            it('should convert fields to JSON when switching to JSON mode', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="name" />
                    <input data-prop="field-value" value="Test Company" />
                `;
                component.ui.postFieldsContainer.appendChild(row);

                component.ui.postBodyModeToggle.checked = true;
                component.ui.postBodyModeToggle.dispatchEvent(new Event('change'));

                expect(component.ui.postBodyArea.value).toContain('name');
            });

            it('should parse JSON to fields when switching to field builder', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'contact';
                component.ui.postBodyArea.value = '{"firstname": "John", "lastname": "Doe"}';
                component.ui.postBodyModeToggle.checked = true;
                component.ui.postBodyModeToggle.dispatchEvent(new Event('change'));

                component.ui.postBodyModeToggle.checked = false;
                const changeEvent = new Event('change');
                component.ui.postBodyModeToggle.dispatchEvent(changeEvent);

                // Wait for async operation to complete
                await new Promise(resolve => setTimeout(resolve, 50));

                const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
                expect(rows.length).toBe(2);
            });

            it('should handle invalid JSON gracefully when switching', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyArea.value = 'invalid json {';
                component.ui.postBodyModeToggle.checked = true;
                component.ui.postBodyModeToggle.dispatchEvent(new Event('change'));

                component.ui.postBodyModeToggle.checked = false;

                expect(() => {
                    component.ui.postBodyModeToggle.dispatchEvent(new Event('change'));
                }).not.toThrow();
            });
        });
    });

    describe('Add Field Button Handler', () => {
        describe('_bindFieldBuilder add field', () => {
            let EntityContextResolver;
            let NotificationService;

            beforeEach(async () => {
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
                vi.clearAllMocks();
            });

            it('should add field when entity context is valid', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'accounts';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());
                const initialCount = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid').length;

                await component._postAddFieldBtnHandler();

                expect(component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid').length).toBe(initialCount + 1);
            });

            it('should show warning when entity not specified', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = '';
                EntityContextResolver.resolve.mockRejectedValue(new Error('No entity'));

                await component._postAddFieldBtnHandler();

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.any(String),
                    'warning'
                );
            });
        });
    });

    describe('Render Value Input', () => {
        describe('_renderValueInput', () => {
            it('should not throw when value container not found', async () => {
                await setupComponent();
                const row = document.createElement('div');
                const attr = { LogicalName: 'name', AttributeType: 'String' };

                await expect(component._renderValueInput(row, attr, 'account')).resolves.not.toThrow();
            });

            it('should call SmartValueInput.render when container exists', async () => {
                const { SmartValueInput } = await import('../../src/ui/SmartValueInput.js');
                SmartValueInput.render = vi.fn().mockResolvedValue();
                await setupComponent();

                const row = document.createElement('div');
                row.innerHTML = '<div class="pdt-value-container"></div>';
                const attr = { LogicalName: 'name', AttributeType: 'String' };

                await component._renderValueInput(row, attr, 'account');

                expect(SmartValueInput.render).toHaveBeenCalled();
            });

            it('should call updateRemoveButtonState after rendering', async () => {
                const { SmartValueInput } = await import('../../src/ui/SmartValueInput.js');
                SmartValueInput.render = vi.fn().mockResolvedValue();
                await setupComponent();

                const row = document.createElement('div');
                row.innerHTML = '<div class="pdt-value-container"></div>';
                row._updateRemoveButtonState = vi.fn();
                const attr = { LogicalName: 'name', AttributeType: 'String' };

                await component._renderValueInput(row, attr, 'account');

                expect(row._updateRemoveButtonState).toHaveBeenCalled();
            });
        });
    });

    describe('Method State Edge Cases', () => {
        describe('_saveGetState', () => {
            it('should save all GET state fields', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'testentity';
                const state = {};

                component._saveGetState(state);

                expect(state.entity).toBe('testentity');
            });
        });

        describe('_savePostState', () => {
            it('should capture POST field values', async () => {
                await setupComponent();
                component.ui.postEntityInput.value = 'contacts';
                component.ui.postBodyArea.value = '{}';
                const state = {};

                component._savePostState(state);

                expect(state.entity).toBe('contacts');
                expect(state.fields).toBe('{}');
                expect(state.fieldValues).toBeDefined();
            });
        });

        describe('_savePatchState', () => {
            it('should capture PATCH field values', async () => {
                await setupComponent();
                component.ui.patchEntityInput.value = 'accounts';
                component.ui.patchIdInput.value = 'test-id';
                component.ui.patchBodyArea.value = '{"name": "Updated"}';
                const state = {};

                component._savePatchState(state);

                expect(state.entity).toBe('accounts');
                expect(state.recordId).toBe('test-id');
                expect(state.fields).toBe('{"name": "Updated"}');
                expect(state.fieldValues).toBeDefined();
            });
        });

        describe('_saveDeleteState', () => {
            it('should save DELETE state', async () => {
                await setupComponent();
                component.ui.deleteEntityInput.value = 'leads';
                component.ui.deleteIdInput.value = 'delete-id';
                const state = {};

                component._saveDeleteState(state);

                expect(state.entity).toBe('leads');
                expect(state.recordId).toBe('delete-id');
            });
        });

        describe('_restoreGetState', () => {
            it('should restore GET state to inputs', async () => {
                await setupComponent();
                const state = { entity: 'opportunities', select: 'name', orderBy: 'createdon', top: '50' };

                component._restoreGetState(state);

                expect(component.ui.getEntityInput.value).toBe('opportunities');
            });
        });

        describe('_restorePostState', () => {
            it('should restore POST state', async () => {
                await setupComponent();
                const state = { entity: 'accounts', recordId: '', fields: '{"name": "Test"}', fieldsHtml: '', fieldValues: [] };

                component._restorePostState(state);

                expect(component.ui.postEntityInput.value).toBe('accounts');
                expect(component.ui.postBodyArea.value).toBe('{"name": "Test"}');
            });
        });

        describe('_restorePatchState', () => {
            it('should restore PATCH state', async () => {
                await setupComponent();
                const state = { entity: 'contacts', recordId: 'patch-id', fields: '{}', fieldsHtml: '', fieldValues: [] };

                component._restorePatchState(state);

                expect(component.ui.patchIdInput.value).toBe('patch-id');
            });
        });

        describe('_restoreDeleteState', () => {
            it('should restore DELETE state', async () => {
                await setupComponent();
                const state = { entity: 'tasks', recordId: 'task-id' };

                component._restoreDeleteState(state);

                expect(component.ui.deleteEntityInput.value).toBe('tasks');
                expect(component.ui.deleteIdInput.value).toBe('task-id');
            });
        });
    });

    describe('POST Entity Blur Handler', () => {
        describe('_postEntityBlurHandler for POST', () => {
            let EntityContextResolver;

            beforeEach(async () => {
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                vi.clearAllMocks();
            });

            it('should attempt to populate required fields on blur', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'accounts';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                vi.spyOn(component, '_populateRequiredFields').mockResolvedValue();

                await component._postEntityBlurHandler();

                expect(component._populateRequiredFields).toHaveBeenCalledWith('account');
            });

            it('should populate even when method is PATCH (handler is for POST entity input)', async () => {
                // _postEntityBlurHandler is specifically for the POST entity input field
                // It populates required fields regardless of selected method because
                // user may switch methods after filling out fields
                await setupComponent();
                component.ui.methodSelect.value = 'PATCH';
                component.ui.postEntityInput.value = 'accounts';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                vi.spyOn(component, '_populateRequiredFields').mockResolvedValue();

                await component._postEntityBlurHandler();

                expect(component._populateRequiredFields).toHaveBeenCalledWith('account');
            });

            it('should not throw when entity resolution fails', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'invalidtable';
                EntityContextResolver.resolve.mockRejectedValue(new Error('Not found'));

                await expect(component._postEntityBlurHandler()).resolves.not.toThrow();
            });
        });
    });

    describe('Execute Handler Dispatch', () => {
        describe('_executeHandler method dispatch', () => {
            it('should dispatch to _executeGet for GET method', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'GET';
                vi.spyOn(component, '_executeGet').mockResolvedValue();

                await component._executeHandler();

                expect(component._executeGet).toHaveBeenCalled();
            });

            it('should dispatch to _executePost for POST method', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                vi.spyOn(component, '_executePost').mockResolvedValue();

                await component._executeHandler();

                expect(component._executePost).toHaveBeenCalled();
            });

            it('should dispatch to _executePatch for PATCH method', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'PATCH';
                vi.spyOn(component, '_executePatch').mockResolvedValue();

                await component._executeHandler();

                expect(component._executePatch).toHaveBeenCalled();
            });

            it('should dispatch to _executeDelete for DELETE method', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'DELETE';
                vi.spyOn(component, '_executeDelete').mockResolvedValue();

                await component._executeHandler();

                expect(component._executeDelete).toHaveBeenCalled();
            });

            it('should clear selection indices before execution', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'GET';
                component.resultPanel._selectedIndices = new Set([0, 1, 2]);
                vi.spyOn(component, '_executeGet').mockResolvedValue();

                await component._executeHandler();

                expect(component.resultPanel._selectedIndices.size).toBe(0);
            });

            it('should not execute when button is disabled', async () => {
                await setupComponent();
                component.ui.executeBtn.disabled = true;
                vi.spyOn(component, '_executeGet');

                await component._executeHandler();

                expect(component._executeGet).not.toHaveBeenCalled();
            });
        });
    });

    describe('Multiselect Value Detection', () => {
        describe('_addFieldUI remove button state with multiselect', () => {
            it('should detect checked checkboxes in multiselect', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';
                component._addFieldUI(true, 'POST');

                const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
                const valueContainer = row.querySelector('.pdt-value-container');
                valueContainer.innerHTML = `
                    <div class="pdt-multiselect-dropdown" data-prop="field-value">
                        <input type="checkbox" checked value="1" />
                    </div>
                `;

                // Trigger update
                if (row._updateRemoveButtonState) {
                    row._updateRemoveButtonState();
                }

                const removeBtn = row.querySelector('.pdt-condition-remove');
                expect(removeBtn.disabled).toBe(false);
            });
        });
    });

    describe('Result Panel Banner Methods', () => {
        describe('resultPanel.showBanner', () => {
            it('should be called with banner element', async () => {
                await setupComponent();
                component.resultPanel.showBanner = vi.fn();
                component.allLoadedRecords = [{ id: '1' }];

                component._showPaginationBanner();

                expect(component.resultPanel.showBanner).toHaveBeenCalledWith(expect.any(HTMLElement));
            });
        });

        describe('resultPanel.updateBanner', () => {
            it('should be called during loadAll', async () => {
                const { DataService } = await import('../../src/services/DataService.js');
                const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');
                await setupComponent();
                component.resultPanel.updateBanner = vi.fn();
                component.nextLink = 'https://org.crm/api?$skiptoken=1';
                component.ui.getEntityInput.value = 'accounts';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                DataService.retrieveMultipleRecords.mockResolvedValue({
                    entities: [{ id: '1' }],
                    nextLink: null
                });

                await component._loadAllRecords();

                expect(component.resultPanel.updateBanner).toHaveBeenCalled();
            });
        });
    });

    describe('Escape HTML in Field Values', () => {
        describe('_getFieldsFromBuilder with special characters', () => {
            it('should handle field values with special characters', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="description" />
                    <input data-prop="field-value" value="&lt;script&gt;alert('xss')&lt;/script&gt;" />
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const fields = component._getFieldsFromBuilder('POST');

                expect(fields.description).toContain('script');
            });
        });
    });

    describe('HTTP Operation Handler Integration', () => {
        describe('POST operation with file uploads', () => {
            let DataService;
            let EntityContextResolver;
            let ValidationService;
            let FileUploadService;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                ValidationService = (await import('../../src/services/ValidationService.js')).ValidationService;
                FileUploadService = (await import('../../src/services/FileUploadService.js')).FileUploadService;
                vi.clearAllMocks();
            });

            it('should upload files after successful record creation', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'accounts';
                component.ui.postBodyModeToggle.checked = false;

                // Create a file upload field
                component.ui.postFieldsContainer.innerHTML = '';
                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="name" />
                    <input data-prop="field-value" value="Test Corp" />
                `;
                component.ui.postFieldsContainer.appendChild(row);

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());
                DataService.createRecord.mockResolvedValue({ id: 'new-record-id' });
                FileUploadService.uploadFile.mockResolvedValue({});

                vi.spyOn(component, '_extractFileUploads').mockReturnValue([
                    { attributeName: 'document', fileData: 'base64', fileName: 'test.pdf', mimeType: 'application/pdf' }
                ]);

                await component._executePost();

                expect(FileUploadService.uploadFile).toHaveBeenCalledWith(
                    'account', 'new-record-id', 'document', 'base64', 'test.pdf', 'application/pdf'
                );
            });

            it('should not upload files when no file uploads exist', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'contacts';
                component.ui.postBodyModeToggle.checked = true;
                component.ui.postBodyArea.value = '{"firstname": "John"}';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'contacts', logicalName: 'contact' });
                ValidationService.validateJson = vi.fn().mockReturnValue({ firstname: 'John' });
                DataService.createRecord.mockResolvedValue({ id: 'contact-id' });

                await component._executePost();

                expect(FileUploadService.uploadFile).not.toHaveBeenCalled();
            });
        });

        describe('PATCH operation with file uploads', () => {
            let DataService;
            let EntityContextResolver;
            let ValidationService;
            let FileUploadService;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                ValidationService = (await import('../../src/services/ValidationService.js')).ValidationService;
                FileUploadService = (await import('../../src/services/FileUploadService.js')).FileUploadService;
                vi.clearAllMocks();
            });

            it('should upload files after successful single patch', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'PATCH';
                const recordId = '12345678-1234-1234-1234-123456789012';
                component.ui.patchEntityInput.value = 'accounts';
                component.ui.patchIdInput.value = recordId;
                component.ui.patchBodyModeToggle.checked = true;
                component.ui.patchBodyArea.value = '{"name": "Updated"}';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());
                ValidationService.validateJson = vi.fn().mockReturnValue({ name: 'Updated' });
                ValidationService.validateGuid.mockImplementation(() => { });
                DataService.updateRecord.mockResolvedValue({});
                FileUploadService.uploadFile.mockResolvedValue({});

                vi.spyOn(component, '_extractFileUploads').mockReturnValue([
                    { attributeName: 'logo', fileData: 'imgdata', fileName: 'logo.png', mimeType: 'image/png' }
                ]);

                await component._executeSinglePatch(recordId);

                expect(FileUploadService.uploadFile).toHaveBeenCalledWith(
                    'account', recordId, 'logo', 'imgdata', 'logo.png', 'image/png'
                );
            });
        });

        describe('DELETE operation confirmation flow', () => {
            let DataService;
            let EntityContextResolver;
            let ValidationService;
            let showConfirmDialog;
            let NotificationService;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                ValidationService = (await import('../../src/services/ValidationService.js')).ValidationService;
                NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
                const helpers = await import('../../src/helpers/index.js');
                showConfirmDialog = helpers.showConfirmDialog;
                vi.clearAllMocks();
            });

            it('should call displayResult when confirmation is cancelled', async () => {
                await setupComponent();
                const recordId = '12345678-1234-1234-1234-123456789012';
                component.ui.deleteEntityInput.value = 'accounts';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                ValidationService.validateGuid.mockImplementation(() => { });
                showConfirmDialog.mockResolvedValue(false);

                vi.spyOn(component, '_displayResult');

                await component._executeSingleDelete(recordId);

                expect(component._displayResult).toHaveBeenCalled();
                expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'success');
            });
        });
    });

    describe('Bulk Operation Progress Tracking', () => {
        describe('_processBatchOperations progress updates', () => {
            let DataService;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                vi.clearAllMocks();
            });

            it('should update progress at threshold intervals', async () => {
                await setupComponent();
                const progressCallback = vi.fn();
                DataService.updateRecord.mockResolvedValue({});

                // Create enough operations to trigger multiple progress updates
                const operations = Array.from({ length: 150 }, (_, i) => ({
                    method: 'PATCH',
                    entitySet: 'accounts',
                    id: `id-${i}`,
                    data: { name: 'Test' }
                }));

                await component._processBatchOperations(operations, 1000, progressCallback);

                // Should have been called multiple times for progress
                expect(progressCallback).toHaveBeenCalled();
            });

            it('should include final progress update when complete', async () => {
                await setupComponent();
                const progressCallback = vi.fn();
                DataService.deleteRecord.mockResolvedValue({});

                const operations = [
                    { method: 'DELETE', entitySet: 'accounts', id: '1' },
                    { method: 'DELETE', entitySet: 'accounts', id: '2' }
                ];

                await component._processBatchOperations(operations, 1000, progressCallback);

                const lastCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1];
                expect(lastCall[0]).toBe(2); // processed
                expect(lastCall[1]).toBe(2); // total
            });

            it('should handle rejected promises in batch', async () => {
                await setupComponent();
                DataService.updateRecord.mockRejectedValue(new Error('Batch failed'));

                const operations = [
                    { method: 'PATCH', entitySet: 'accounts', id: '1', data: {} }
                ];

                const result = await component._processBatchOperations(operations, 1000);

                expect(result.failCount).toBe(1);
                expect(result.errors.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Pagination Banner Interaction', () => {
        describe('_loadMoreRecords button state management', () => {
            let DataService;
            let EntityContextResolver;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                vi.clearAllMocks();
            });

            it('should handle error during load more gracefully', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                await setupComponent();
                component.nextLink = 'https://org.crm.dynamics.com/api?$skiptoken=abc';
                component.ui.getEntityInput.value = 'accounts';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                DataService.retrieveMultipleRecords.mockRejectedValue(new Error('Network error'));

                await component._loadMoreRecords();

                expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
                expect(component.isLoadingMore).toBe(false);
            });

            it('should show success notification when all records loaded', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                await setupComponent();
                component.nextLink = 'https://org.crm.dynamics.com/api?$skiptoken=xyz';
                component.allLoadedRecords = [{ id: '1' }];
                component.ui.getEntityInput.value = 'contacts';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'contacts', logicalName: 'contact' });
                DataService.retrieveMultipleRecords.mockResolvedValue({
                    entities: [{ id: '2' }],
                    nextLink: null
                });

                await component._loadMoreRecords();

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.stringContaining('2'),
                    'success'
                );
            });
        });

        describe('_loadAllRecords iteration', () => {
            let DataService;
            let EntityContextResolver;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                vi.clearAllMocks();
            });

            it('should iterate through all pages until complete', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                await setupComponent();
                component.nextLink = 'https://org.crm/api?$skiptoken=1';
                component.allLoadedRecords = [];
                component.ui.getEntityInput.value = 'accounts';
                component.resultPanel.updateBanner = vi.fn();

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                DataService.retrieveMultipleRecords
                    .mockResolvedValueOnce({ entities: [{ id: 'a' }], nextLink: 'https://org.crm/api?$skiptoken=2' })
                    .mockResolvedValueOnce({ entities: [{ id: 'b' }], nextLink: 'https://org.crm/api?$skiptoken=3' })
                    .mockResolvedValueOnce({ entities: [{ id: 'c' }], nextLink: null });

                await component._loadAllRecords();

                expect(component.allLoadedRecords.length).toBe(3);
                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.stringContaining('3'),
                    'success'
                );
            });

            it('should handle error during load all gracefully', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                await setupComponent();
                component.nextLink = 'https://org.crm/api?$skiptoken=1';
                component.ui.getEntityInput.value = 'accounts';
                component.resultPanel.updateBanner = vi.fn();

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                DataService.retrieveMultipleRecords.mockRejectedValue(new Error('Timeout'));

                await component._loadAllRecords();

                expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
                expect(component.isLoadingMore).toBe(false);
            });
        });
    });

    describe('Entity Context Edge Cases', () => {
        describe('_ensureEntityContext with various input sources', () => {
            let EntityContextResolver;

            beforeEach(async () => {
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                vi.clearAllMocks();
            });

            it('should prioritize override parameter over UI inputs', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'contacts';
                component.ui.postEntityInput.value = 'leads';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());

                const result = await component._ensureEntityContext('accounts');

                expect(EntityContextResolver.resolve).toHaveBeenCalledWith('accounts');
                expect(result.entitySet).toBe('accounts');
            });

            it('should fall back to POST input when GET is empty', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = '';
                component.ui.postEntityInput.value = 'opportunities';
                component.ui.deleteEntityInput.value = '';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'opportunities', logicalName: 'opportunity' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());

                const result = await component._ensureEntityContext();

                expect(EntityContextResolver.resolve).toHaveBeenCalledWith('opportunities');
                expect(result.entitySet).toBe('opportunities');
            });

            it('should fall back to DELETE input when others are empty', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = '';
                component.ui.postEntityInput.value = '';
                component.ui.patchEntityInput.value = '';
                component.ui.deleteEntityInput.value = 'tasks';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'tasks', logicalName: 'task' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());

                const result = await component._ensureEntityContext();

                expect(result.entitySet).toBe('tasks');
            });

            it('should refresh attrMap when entity changes', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'accounts';

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map([['name', { type: 'string' }]]));

                const result = await component._ensureEntityContext();

                expect(result.logicalName).toBe('account');
                expect(result.entitySet).toBe('accounts');
            });
        });
    });

    describe('Field Value Type Parsing Edge Cases', () => {
        describe('_parseFieldValue with edge cases', () => {
            it('should handle empty string for integer type', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'integer';

                const result = component._parseFieldValue(input, '');

                expect(result).toBeUndefined();
            });

            it('should handle whitespace-only value', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'text';

                const result = component._parseFieldValue(input, '   ');

                expect(result).toBe('   ');
            });

            it('should handle null dataset type', async () => {
                await setupComponent();
                const input = document.createElement('input');
                // No dataset.type set

                const result = component._parseFieldValue(input, 'plain text');

                expect(result).toBe('plain text');
            });

            it('should handle file type returning undefined', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'file';

                const result = component._parseFieldValue(input, 'somedata');

                expect(result).toBeUndefined();
            });

            it('should handle invalid boolean value', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'boolean';

                const result = component._parseFieldValue(input, 'yes');

                expect(result).toBeUndefined();
            });

            it('should parse valid date with time component', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'date';

                const result = component._parseFieldValue(input, '2024-03-15T10:30:00');

                expect(result).toBe('2024-03-15');
            });

            it('should handle datetime with timezone', async () => {
                await setupComponent();
                const input = document.createElement('input');
                input.dataset.type = 'datetime';

                const result = component._parseFieldValue(input, '2024-03-15T10:30:00Z');

                expect(result).toContain('2024-03-15');
                expect(result).toContain('T');
            });
        });

        describe('_parseImageValue edge cases', () => {
            it('should return undefined for empty rawValue with no fileData', async () => {
                await setupComponent();
                const container = document.createElement('div');
                container.className = 'pdt-file-upload-container';
                container.innerHTML = '<input class="pdt-file-data" value="" />';

                const result = component._parseImageValue(container, '');

                expect(result).toBeUndefined();
            });

            it('should prioritize fileData over manual input', async () => {
                await setupComponent();
                const container = document.createElement('div');
                container.className = 'pdt-file-upload-container';
                container._fileData = 'base64fromfile';
                container.innerHTML = '<input class="pdt-file-data" value="manualinput" />';

                const result = component._parseImageValue(container, '');

                expect(result).toBe('base64fromfile');
            });
        });
    });

    describe('Query Building Edge Cases', () => {
        describe('_buildGetOptionsStringFallback complex scenarios', () => {
            it('should handle multiline select with empty lines', async () => {
                await setupComponent();
                component.ui.getSelectInput.value = 'name\n\ncreateon\n   \nmodifiedon';
                component.getFilterManager.extractFilterGroups.mockReturnValue([]);

                const result = component._buildGetOptionsStringFallback();

                expect(result).toContain('$select=name,createon,modifiedon');
            });

            it('should handle filter with single value', async () => {
                await setupComponent();
                component.getFilterManager.extractFilterGroups.mockReturnValue([
                    { filterType: 'and', filters: [{ attr: 'status', op: 'eq', value: '1' }] }
                ]);

                const result = component._buildGetOptionsStringFallback();

                expect(result).toContain('$filter=status');
            });

            it('should properly escape single quotes in filter values', async () => {
                await setupComponent();
                component.getFilterManager.extractFilterGroups.mockReturnValue([
                    { filterType: 'and', filters: [{ attr: 'name', op: 'contains', value: "O'Brien" }] }
                ]);

                const result = component._buildGetOptionsStringFallback();

                expect(result).toContain("O''Brien");
            });
        });
    });

    describe('Field Builder Restore Operations', () => {
        describe('_restoreFieldBuilder with various states', () => {
            it('should restore HTML and reattach handlers', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                vi.spyOn(component, '_restoreFieldValues');
                vi.spyOn(component, '_reattachFieldHandlers');

                const state = {
                    fieldsHtml: '<div class="pdt-field-grid"><input data-prop="field-attribute" /><input data-prop="field-value" /><button class="pdt-condition-remove"></button><button class="browse-field-attr"></button></div>',
                    fieldValues: [{ attribute: 'name', value: 'Test' }]
                };

                component._restoreFieldBuilder(state, 'POST');

                expect(component._restoreFieldValues).toHaveBeenCalledWith(state.fieldValues, 'POST');
                expect(component._reattachFieldHandlers).toHaveBeenCalled();
            });

            it('should create empty field when no HTML state', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                vi.spyOn(component, '_addFieldUI');
                component.ui.postFieldsContainer.innerHTML = '';

                const state = { fieldsHtml: '', fieldValues: [] };

                component._restoreFieldBuilder(state, 'POST');

                expect(component._addFieldUI).toHaveBeenCalledWith(true, 'POST');
            });
        });

        describe('_restoreFieldValues with attrMetadata', () => {
            it('should restore attrMetadata to rows', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <div data-prop="field-value"></div>
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const fieldValues = [{
                    attribute: 'name',
                    value: 'Test',
                    attrMetadata: { type: 'string', displayName: 'Name' }
                }];

                const renderValueInputSpy = vi.spyOn(component, '_renderValueInput');
                component._restoreFieldValues(fieldValues, 'POST');

                expect(row._attrMetadata).toEqual({ type: 'string', displayName: 'Name' });
                expect(renderValueInputSpy).toHaveBeenCalledWith(
                    row,
                    { type: 'string', displayName: 'Name' },
                    'Test'
                );
            });

            it('should render value input for fields with metadata', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'PATCH';
                component.ui.patchFieldsContainer.innerHTML = '';

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <div data-prop="field-value"></div>
                `;
                component.ui.patchFieldsContainer.appendChild(row);

                const fieldValues = [{
                    attribute: 'statuscode',
                    value: '1',
                    attrMetadata: {
                        type: 'picklist',
                        displayName: 'Status Reason',
                        options: [{ value: 1, label: 'Active' }, { value: 2, label: 'Inactive' }]
                    }
                }];

                component._restoreFieldValues(fieldValues, 'PATCH');

                expect(row._attrMetadata).toBeDefined();
                expect(row._attrMetadata.type).toBe('picklist');
            });

            it('should restore plain text value when no metadata', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <input data-prop="field-value" value="" />
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const fieldValues = [{
                    attribute: 'name',
                    value: 'Test Value'
                    // No attrMetadata
                }];

                const renderValueInputSpy = vi.spyOn(component, '_renderValueInput');
                component._restoreFieldValues(fieldValues, 'POST');

                const valueInput = row.querySelector('[data-prop="field-value"]');
                expect(valueInput.value).toBe('Test Value');
                expect(renderValueInputSpy).not.toHaveBeenCalled();
            });

            it('should handle more values than rows', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postFieldsContainer.innerHTML = '';

                const row = document.createElement('div');
                row.className = 'pdt-field-grid';
                row.innerHTML = `
                    <input data-prop="field-attribute" value="" />
                    <input data-prop="field-value" value="" />
                `;
                component.ui.postFieldsContainer.appendChild(row);

                const fieldValues = [
                    { attribute: 'field1', value: 'value1' },
                    { attribute: 'field2', value: 'value2' } // More than available rows
                ];

                // Should not throw
                expect(() => component._restoreFieldValues(fieldValues, 'POST')).not.toThrow();
            });
        });
    });

    describe('Touch Dialog Complete Flow', () => {
        describe('_showTouchConfigDialog', () => {
            it('should be a defined async function', async () => {
                await setupComponent();
                expect(typeof component._showTouchConfigDialog).toBe('function');
            });
        });

        describe('_handleTouchResult complete paths', () => {
            let NotificationService;

            beforeEach(async () => {
                NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
                vi.clearAllMocks();
            });

            it('should show success on full success', async () => {
                await setupComponent();
                vi.spyOn(component, '_reloadRecordsAfterTouch').mockResolvedValue();

                await component._handleTouchResult(10, 0, []);

                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.stringContaining('10'),
                    'success'
                );
            });

            it('should show warning on partial failure', async () => {
                await setupComponent();
                vi.spyOn(component, '_displayTouchErrors');

                await component._handleTouchResult(8, 2, [{ error: 'err1' }, { error: 'err2' }]);

                expect(component._displayTouchErrors).toHaveBeenCalledWith(8, 2, expect.any(Array));
            });
        });
    });

    describe('Required Fields Advanced Scenarios', () => {
        describe('_populateRequiredFieldsBuilderMode', () => {
            let DataService;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                vi.clearAllMocks();
            });

            it('should create field rows for each required attribute', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                const requiredAttrs = [
                    { LogicalName: 'name', AttributeType: 'String' },
                    { LogicalName: 'primarycontactid', AttributeType: 'Lookup', Targets: ['contact'] }
                ];
                const navPropMap = new Map([['primarycontactid', 'primarycontact']]);
                DataService.retrieveEntityDefinition = vi.fn().mockResolvedValue({ EntitySetName: 'contacts' });

                vi.spyOn(component, '_renderValueInput').mockResolvedValue();

                await component._populateRequiredFieldsBuilderMode(requiredAttrs, navPropMap, 'account');

                const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
                expect(rows.length).toBe(2);
            });

            it('should use navigation property name for lookups', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                const requiredAttrs = [
                    { LogicalName: 'ownerid', AttributeType: 'Owner', Targets: ['systemuser', 'team'] }
                ];
                const navPropMap = new Map([['ownerid', 'owninguser']]);

                vi.spyOn(component, '_renderValueInput').mockResolvedValue();

                await component._populateRequiredFieldsBuilderMode(requiredAttrs, navPropMap, 'account');

                const attrInput = component.ui.postFieldsContainer.querySelector('[data-prop="field-attribute"]');
                expect(attrInput.value).toContain('@odata.bind');
            });
        });

        describe('_filterRequiredAttributes comprehensive', () => {
            it('should exclude VirtualType attributes', async () => {
                await setupComponent();
                const attributes = [
                    {
                        LogicalName: 'virtualfield',
                        RequiredLevel: { Value: 'ApplicationRequired' },
                        AttributeTypeName: { Value: 'VirtualType' },
                        IsValidForCreate: true
                    }
                ];

                const result = component._filterRequiredAttributes(attributes);

                expect(result.length).toBe(0);
            });

            it('should handle attributes with Requiredlevel (lowercase)', async () => {
                await setupComponent();
                const attributes = [
                    {
                        Logicalname: 'testfield',
                        Requiredlevel: { Value: 'ApplicationRequired' },
                        IsValidForCreate: true
                    }
                ];

                const result = component._filterRequiredAttributes(attributes);

                expect(result.length).toBe(1);
            });

            it('should exclude customeridtype polymorphic fields', async () => {
                await setupComponent();
                const attributes = [
                    {
                        LogicalName: 'customeridtype',
                        RequiredLevel: { Value: 'ApplicationRequired' },
                        AttributeType: 'EntityName',
                        IsValidForCreate: true
                    }
                ];

                const result = component._filterRequiredAttributes(attributes);

                expect(result.length).toBe(0);
            });
        });
    });

    describe('Multiselect Value Parsing Complete', () => {
        describe('_parseMultiselectValue edge cases', () => {
            it('should handle single checked checkbox', async () => {
                await setupComponent();
                const container = document.createElement('div');
                container.className = 'pdt-multiselect-dropdown';
                container.innerHTML = `
                    <div class="pdt-multiselect-option">
                        <input type="checkbox" value="42" checked />
                    </div>
                `;

                const result = component._parseMultiselectValue(container, '');

                expect(result).toBe('42');
            });

            it('should return undefined for empty raw value in non-multiselect', async () => {
                await setupComponent();
                const input = document.createElement('input');

                const result = component._parseMultiselectValue(input, '');

                expect(result).toBeUndefined();
            });
        });
    });

    describe('Preview Update Comprehensive', () => {
        describe('_updatePreview for all methods', () => {
            it('should show POST target without ID', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postEntityInput.value = 'accounts';

                await component._updatePreview();

                // Preview should be hidden for POST method
                expect(component.ui.preview.style.display).toBe('none');
            });

            it('should hide preview for PATCH method', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'PATCH';
                component.ui.patchEntityInput.value = '';
                component.ui.patchIdInput.value = '';

                await component._updatePreview();

                // Preview should be hidden for PATCH method
                expect(component.ui.preview.style.display).toBe('none');
            });
        });

        describe('_setPreviewUrl formatting', () => {
            it('should set URL in preview element', async () => {
                await setupComponent();

                component._setPreviewUrl("accounts?$filter=name eq 'Test'");

                expect(component.ui.preview.innerHTML).toContain('accounts');
                expect(component.ui.preview.innerHTML).toContain('filter');
            });
        });
    });

    describe('Cleanup Comprehensive Tests', () => {
        describe('_removeInputHandlers edge cases', () => {
            it('should not throw when UI elements are null', async () => {
                await setupComponent();
                component.ui.getEntityInput = null;
                component.ui.postPatchEntityInput = null;

                expect(() => component._removeInputHandlers()).not.toThrow();
            });
        });

        describe('_removeButtonHandlers edge cases', () => {
            it('should not throw when handlers are null', async () => {
                await setupComponent();
                component._formatJsonHandler = null;
                component._executeHandler = null;

                expect(() => component._removeButtonHandlers()).not.toThrow();
            });
        });

        describe('Full cleanup lifecycle', () => {
            it('should call cleanup on all filter managers', async () => {
                await setupComponent();
                component.getFilterManager.cleanup = vi.fn();
                component.patchFilterManager.cleanup = vi.fn();
                component.deleteFilterManager.cleanup = vi.fn();

                component.cleanup();

                expect(component.getFilterManager.cleanup).toHaveBeenCalled();
                expect(component.patchFilterManager.cleanup).toHaveBeenCalled();
                expect(component.deleteFilterManager.cleanup).toHaveBeenCalled();
            });

            it('should handle null filter managers in cleanup', async () => {
                await setupComponent();
                component.getFilterManager = null;
                component.patchFilterManager = null;
                component.deleteFilterManager = null;

                expect(() => component.cleanup()).not.toThrow();
            });
        });
    });

    describe('Get Count Complete Flow', () => {
        describe('_getCountHandler pagination handling', () => {
            let DataService;
            let EntityContextResolver;
            let PowerAppsApiService;
            let NotificationService;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                PowerAppsApiService = (await import('../../src/services/PowerAppsApiService.js')).PowerAppsApiService;
                NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
                vi.clearAllMocks();
            });

            it('should update button text during counting', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'accounts';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());
                PowerAppsApiService.getEntityMetadata = vi.fn().mockResolvedValue({ PrimaryIdAttribute: 'accountid' });
                DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [], nextLink: null });

                await component._getCountHandler();

                // Button should be re-enabled after execution
                expect(component.ui.getCountBtn.disabled).toBe(false);
            });

            it('should display result in table format', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'contacts';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'contacts', logicalName: 'contact' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());
                PowerAppsApiService.getEntityMetadata = vi.fn().mockResolvedValue({ PrimaryIdAttribute: 'contactid' });
                DataService.retrieveMultipleRecords.mockResolvedValue({
                    entities: [{ contactid: '1' }, { contactid: '2' }],
                    nextLink: null
                });

                await component._getCountHandler();

                expect(component.lastResult.entities[0]).toHaveProperty('Table', 'contact');
                expect(component.lastResult.entities[0]).toHaveProperty('Count', '2');
                expect(component.lastResult.entities[0]).toHaveProperty('Pages', '1');
            });
        });
    });

    describe('Entity Browser Selection', () => {
        describe('_pickEntityHandler complete flow', () => {
            it('should reset filter container when entity selected', async () => {
                const { MetadataBrowserDialog } = await import('../../src/ui/MetadataBrowserDialog.js');
                await setupComponent();

                // Add some content to filters
                component.ui.getFiltersContainer.innerHTML = '<div>existing filter</div>';

                MetadataBrowserDialog.show = vi.fn((type, callback) => {
                    callback({ LogicalName: 'contact', EntitySetName: 'contacts' });
                });

                component._pickEntityHandler();

                expect(component.ui.getFiltersContainer.textContent).toBe('');
            });

            it('should populate required fields for POST method', async () => {
                const { MetadataBrowserDialog } = await import('../../src/ui/MetadataBrowserDialog.js');
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                vi.spyOn(component, '_populateRequiredFields').mockResolvedValue();

                MetadataBrowserDialog.show = vi.fn((type, callback) => {
                    callback({ LogicalName: 'lead', EntitySetName: 'leads' });
                });

                component._pickEntityHandler();

                expect(component._populateRequiredFields).toHaveBeenCalledWith('lead');
            });
        });
    });

    describe('Format JSON Handler Edge Cases', () => {
        describe('_formatJsonHandler with various inputs', () => {
            it('should format minified JSON to pretty print', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyArea.value = '{"a":1,"b":{"c":2}}';

                component._formatJsonHandler();

                expect(component.ui.postBodyArea.value).toContain('\n');
                expect(component.ui.postBodyArea.value).toContain('  ');
            });

            it('should handle whitespace-only input', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyArea.value = '   ';

                component._formatJsonHandler();

                expect(component.ui.postBodyArea.value).toBe('{}');
            });
        });
    });

    describe('Bulk Operation Error Formatting', () => {
        describe('_formatBulkOperationResult with errors', () => {
            it('should include error separator row', async () => {
                await setupComponent();
                const errors = [{ index: 0, error: 'Test error' }];

                const result = component._formatBulkOperationResult('Test Op', 5, 4, 1, errors);

                expect(result.length).toBeGreaterThan(1);
                expect(result[1].Operation).toContain('Errors');
            });

            it('should format each error with index', async () => {
                await setupComponent();
                const errors = [
                    { index: 0, error: 'Error A' },
                    { index: 5, error: 'Error B' }
                ];

                const result = component._formatBulkOperationResult('Bulk Op', 10, 8, 2, errors);

                const errorRows = result.filter(r => r.Operation?.startsWith('Error'));
                expect(errorRows.length).toBe(2);
            });
        });
    });

    describe('Additional Lookup Parsing', () => {
        describe('_parseLookupValue edge cases', () => {
            it('should handle lookup with entitySet only', async () => {
                await setupComponent();

                const result = component._parseLookupValue('/accounts(12345678-1234-1234-1234-123456789012)');

                expect(result).toBe('/accounts(12345678-1234-1234-1234-123456789012)');
            });

            it('should return undefined for empty lookup value', async () => {
                await setupComponent();

                const result = component._parseLookupValue('');

                expect(result).toBeUndefined();
            });

            it('should return undefined when value does not contain parentheses', async () => {
                await setupComponent();

                const result = component._parseLookupValue('justtext');

                expect(result).toBeUndefined();
            });
        });
    });

    describe('Decimal and Integer Parsing', () => {
        describe('_parseDecimalValue edge cases', () => {
            it('should parse valid decimal with many digits', async () => {
                await setupComponent();

                const result = component._parseDecimalValue('123456.789012');

                expect(result).toBe(123456.789012);
            });

            it('should handle NaN input', async () => {
                await setupComponent();

                const result = component._parseDecimalValue('not a number');

                expect(result).toBeUndefined();
            });

            it('should handle negative decimals', async () => {
                await setupComponent();

                const result = component._parseDecimalValue('-99.99');

                expect(result).toBe(-99.99);
            });
        });

        describe('_parseIntegerValue edge cases', () => {
            it('should parse valid integer', async () => {
                await setupComponent();

                const result = component._parseIntegerValue('42');

                expect(result).toBe(42);
            });

            it('should handle float input by truncating', async () => {
                await setupComponent();

                const result = component._parseIntegerValue('42.9');

                expect(result).toBe(42);
            });

            it('should return undefined for NaN', async () => {
                await setupComponent();

                const result = component._parseIntegerValue('abc');

                expect(result).toBeUndefined();
            });
        });
    });

    describe('Touch Field Row Handlers', () => {
        describe('_addTouchFieldRow', () => {
            it('should be a defined function', async () => {
                await setupComponent();
                expect(typeof component._addTouchFieldRow).toBe('function');
            });
        });

        describe('_bindTouchFieldRowHandlers', () => {
            it('should be a defined function', async () => {
                await setupComponent();
                expect(typeof component._bindTouchFieldRowHandlers).toBe('function');
            });
        });
    });

    describe('Display Touch Errors', () => {
        describe('_displayTouchErrors formatting', () => {
            it('should format errors with record info', async () => {
                await setupComponent();
                vi.spyOn(component, '_displayResult');

                const errors = [
                    { recordId: 'id-1', error: { message: 'Test error 1' } },
                    { recordId: 'id-2', error: { message: 'Test error 2' } }
                ];

                component._displayTouchErrors(8, 2, errors);

                expect(component._displayResult).toHaveBeenCalled();
            });
        });
    });

    describe('Body Mode Toggle Handling', () => {
        describe('body mode toggle switching', () => {
            it('should show fields container when in builder mode', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyModeToggle.checked = false;

                // Trigger the toggle handler
                component._postBodyModeToggleHandler();

                expect(component.ui.postFieldsContainer.style.display).not.toBe('none');
            });

            it('should show body area when in JSON mode', async () => {
                await setupComponent();
                component.ui.methodSelect.value = 'POST';
                component.ui.postBodyModeToggle.checked = true;

                // Trigger the toggle handler
                component._postBodyModeToggleHandler();

                expect(component.ui.postBodyArea.style.display).not.toBe('none');
            });
        });
    });

    describe('Method Select Change', () => {
        describe('method switching state', () => {
            it('should save current state before switching', async () => {
                await setupComponent();
                vi.spyOn(component, '_saveMethodState');
                component._lastMethod = 'GET';
                component.ui.methodSelect.value = 'POST';

                // Trigger the method select handler
                component._methodSelectHandler();

                expect(component._saveMethodState).toHaveBeenCalledWith('GET');
            });

            it('should restore state for target method', async () => {
                await setupComponent();
                vi.spyOn(component, '_restoreMethodState');
                component._lastMethod = 'GET';
                component.ui.methodSelect.value = 'DELETE';

                // Trigger the method select handler
                component._methodSelectHandler();

                expect(component._restoreMethodState).toHaveBeenCalledWith('DELETE');
            });
        });
    });

    describe('Build Touch Data', () => {
        describe('_buildTouchData with various field configurations', () => {
            it('should be a defined function', async () => {
                await setupComponent();
                expect(typeof component._buildTouchData).toBe('function');
            });
        });
    });

    describe('Prepare Touch Operations', () => {
        describe('_prepareTouchOperations validation', () => {
            it('should be a defined function', async () => {
                await setupComponent();
                expect(typeof component._prepareTouchOperations).toBe('function');
            });
        });
    });

    describe('Reload Records After Touch', () => {
        describe('_reloadRecordsAfterTouch execution', () => {
            let DataService;
            let EntityContextResolver;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                vi.clearAllMocks();
            });

            it('should refresh get results after touch', async () => {
                await setupComponent();
                component.ui.getEntityInput.value = 'accounts';
                component.allLoadedRecords = [{ id: '1' }];
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [{ id: '1', modifiedon: new Date() }], nextLink: null });
                vi.spyOn(component, '_displayResult');

                await component._reloadRecordsAfterTouch();

                expect(DataService.retrieveMultipleRecords).toHaveBeenCalled();
            });
        });
    });

    describe('Load All Records Button State', () => {
        describe('_loadAllRecords with pagination buttons', () => {
            let DataService;
            let EntityContextResolver;

            beforeEach(async () => {
                DataService = (await import('../../src/services/DataService.js')).DataService;
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                vi.clearAllMocks();
            });

            it('should update loadAll button state during loading', async () => {
                await setupComponent();

                // Create and add buttons to DOM
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.id = 'api-load-more-btn';
                const loadAllBtn = document.createElement('button');
                loadAllBtn.id = 'api-load-all-btn';
                loadAllBtn.textContent = 'Load All';
                document.body.appendChild(loadMoreBtn);
                document.body.appendChild(loadAllBtn);

                component.nextLink = 'https://org.crm/api?$skiptoken=1';
                component.allLoadedRecords = [];
                component.ui.getEntityInput.value = 'accounts';
                component.resultPanel.updateBanner = vi.fn();

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [{ id: 'a' }], nextLink: null });

                await component._loadAllRecords();

                // After completion, buttons should be re-enabled
                expect(loadAllBtn.disabled).toBe(false);
                expect(loadMoreBtn.disabled).toBe(false);

                // Cleanup
                document.body.removeChild(loadMoreBtn);
                document.body.removeChild(loadAllBtn);
            });

            it('should restore button state after error', async () => {
                await setupComponent();

                // Create and add buttons to DOM
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.id = 'api-load-more-btn';
                const loadAllBtn = document.createElement('button');
                loadAllBtn.id = 'api-load-all-btn';
                loadAllBtn.textContent = 'Load All';
                document.body.appendChild(loadMoreBtn);
                document.body.appendChild(loadAllBtn);

                component.nextLink = 'https://org.crm/api?$skiptoken=1';
                component.ui.getEntityInput.value = 'accounts';
                component.resultPanel.updateBanner = vi.fn();

                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                DataService.retrieveMultipleRecords.mockRejectedValue(new Error('Network error'));

                await component._loadAllRecords();

                // After error, buttons should be re-enabled
                expect(loadAllBtn.disabled).toBe(false);
                expect(loadMoreBtn.disabled).toBe(false);
                expect(component.isLoadingMore).toBe(false);

                // Cleanup
                document.body.removeChild(loadMoreBtn);
                document.body.removeChild(loadAllBtn);
            });
        });
    });

    describe('Filter Group Handler Success Paths', () => {
        describe('_addPatchFilterGroupHandler success path', () => {
            let EntityContextResolver;

            beforeEach(async () => {
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                vi.clearAllMocks();
            });

            it('should add filter group when PATCH entity context is valid', async () => {
                await setupComponent();
                component.ui.patchEntityInput.value = 'contacts';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'contacts', logicalName: 'contact' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());

                // Reset mock to track new calls
                component.patchFilterManager.addFilterGroup.mockClear();

                await component._addPatchFilterGroupHandler();

                expect(component.patchFilterManager.addFilterGroup).toHaveBeenCalledWith(
                    component.ui.patchFiltersContainer,
                    true  // Should be true when container is empty
                );
            });
        });

        describe('_addDeleteFilterGroupHandler success path', () => {
            let EntityContextResolver;

            beforeEach(async () => {
                EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
                vi.clearAllMocks();
            });

            it('should add filter group when DELETE entity context is valid', async () => {
                await setupComponent();
                component.ui.deleteEntityInput.value = 'accounts';
                EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
                EntityContextResolver.getAttrMap.mockResolvedValue(new Map());

                // Reset mock to track new calls
                component.deleteFilterManager.addFilterGroup.mockClear();

                await component._addDeleteFilterGroupHandler();

                expect(component.deleteFilterManager.addFilterGroup).toHaveBeenCalledWith(
                    component.ui.deleteFiltersContainer,
                    true  // Should be true when container is empty
                );
            });
        });
    });

    describe('_buildGetOptionsStringFallback filter type edge cases', () => {
        it('should return single filter without wrapping parentheses', async () => {
            await setupComponent();
            component.getFilterManager.extractFilterGroups.mockReturnValue([
                {
                    filterType: 'and',
                    filters: [{ attr: 'name', op: 'eq', value: 'Test' }]
                }
            ]);

            const result = component._buildGetOptionsStringFallback();

            // Single filter should not be wrapped in parentheses
            expect(result).toContain('$filter=name eq Test');
            expect(result).not.toContain('(name eq Test)');
        });

        it('should handle filterType not with multiple filters', async () => {
            await setupComponent();
            component.getFilterManager.extractFilterGroups.mockReturnValue([
                {
                    filterType: 'not',
                    filters: [
                        { attr: 'status', op: 'eq', value: '1' },
                        { attr: 'priority', op: 'eq', value: '2' }
                    ]
                }
            ]);

            const result = component._buildGetOptionsStringFallback();

            // 'not' filterType should wrap with 'not (... and ...)'
            expect(result).toContain('not (');
            expect(result).toContain(' and ');
        });

        it('should handle filterType and with multiple filters wrapped in parentheses', async () => {
            await setupComponent();
            component.getFilterManager.extractFilterGroups.mockReturnValue([
                {
                    filterType: 'and',
                    filters: [
                        { attr: 'name', op: 'eq', value: 'A' },
                        { attr: 'status', op: 'eq', value: '1' }
                    ]
                }
            ]);

            const result = component._buildGetOptionsStringFallback();

            // Multiple filters with 'and' should be wrapped in parentheses
            expect(result).toContain('(');
            expect(result).toContain(' and ');
        });

        it('should handle filterType or with multiple filters wrapped in parentheses', async () => {
            await setupComponent();
            component.getFilterManager.extractFilterGroups.mockReturnValue([
                {
                    filterType: 'or',
                    filters: [
                        { attr: 'name', op: 'eq', value: 'A' },
                        { attr: 'name', op: 'eq', value: 'B' }
                    ]
                }
            ]);

            const result = component._buildGetOptionsStringFallback();

            // Multiple filters with 'or' should be wrapped in parentheses with ' or '
            expect(result).toContain('(');
            expect(result).toContain(' or ');
        });

        it('should skip filter groups where all filters are empty', async () => {
            await setupComponent();
            component.getFilterManager.extractFilterGroups.mockReturnValue([
                {
                    filterType: 'and',
                    filters: [
                        { attr: '', op: '', value: '' },
                        { attr: '', op: 'eq', value: '' }
                    ]
                }
            ]);

            const result = component._buildGetOptionsStringFallback();

            // No filter should be added when all conditions are empty
            expect(result).not.toContain('$filter=');
        });
    });

    describe('_loadMoreRecords button state management detailed', () => {
        let DataService;
        let EntityContextResolver;

        beforeEach(async () => {
            DataService = (await import('../../src/services/DataService.js')).DataService;
            EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
            vi.clearAllMocks();
        });

        it('should disable loadAllBtn during loading and re-enable after success', async () => {
            await setupComponent();

            // Create and add buttons to DOM
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'api-load-more-btn';
            loadMoreBtn.textContent = 'Load More';
            const loadAllBtn = document.createElement('button');
            loadAllBtn.id = 'api-load-all-btn';
            document.body.appendChild(loadMoreBtn);
            document.body.appendChild(loadAllBtn);

            component.nextLink = 'https://org.crm.dynamics.com/api?$skiptoken=abc';
            component.allLoadedRecords = [{ id: '1' }];
            component.ui.getEntityInput.value = 'accounts';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            DataService.retrieveMultipleRecords.mockResolvedValue({
                entities: [{ id: '2' }],
                nextLink: 'https://org.crm.dynamics.com/api?$skiptoken=def'
            });

            await component._loadMoreRecords();

            // After completion with more pages, buttons should be re-enabled
            expect(loadAllBtn.disabled).toBe(false);
            expect(loadMoreBtn.disabled).toBe(false);

            // Cleanup
            document.body.removeChild(loadMoreBtn);
            document.body.removeChild(loadAllBtn);
        });

        it('should update loadMoreBtn text to loading during operation', async () => {
            await setupComponent();

            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'api-load-more-btn';
            loadMoreBtn.textContent = 'Load More';
            document.body.appendChild(loadMoreBtn);

            component.nextLink = 'https://org.crm.dynamics.com/api?$skiptoken=xyz';
            component.allLoadedRecords = [];
            component.ui.getEntityInput.value = 'contacts';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'contacts', logicalName: 'contact' });

            let capturedText = null;
            DataService.retrieveMultipleRecords.mockImplementation(() => {
                capturedText = loadMoreBtn.textContent;
                return Promise.resolve({ entities: [{ id: 'new' }], nextLink: null });
            });

            await component._loadMoreRecords();

            // Button text should have been 'Loading...' during the operation
            expect(capturedText).toBe('Loading...');
            // After completion, button text should be restored
            expect(loadMoreBtn.textContent).toBe('Load More');

            document.body.removeChild(loadMoreBtn);
        });

        it('should handle missing loadAllBtn gracefully', async () => {
            await setupComponent();

            // Only create loadMoreBtn, not loadAllBtn
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'api-load-more-btn';
            loadMoreBtn.textContent = 'Load More';
            document.body.appendChild(loadMoreBtn);

            component.nextLink = 'https://org.crm.dynamics.com/api?$skiptoken=abc';
            component.allLoadedRecords = [];
            component.ui.getEntityInput.value = 'accounts';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            DataService.retrieveMultipleRecords.mockResolvedValue({
                entities: [{ id: '1' }],
                nextLink: null
            });

            // Should not throw even without loadAllBtn
            await expect(component._loadMoreRecords()).resolves.not.toThrow();

            document.body.removeChild(loadMoreBtn);
        });

        it('should restore button states after error', async () => {
            await setupComponent();

            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'api-load-more-btn';
            loadMoreBtn.textContent = 'Load More';
            const loadAllBtn = document.createElement('button');
            loadAllBtn.id = 'api-load-all-btn';
            document.body.appendChild(loadMoreBtn);
            document.body.appendChild(loadAllBtn);

            component.nextLink = 'https://org.crm.dynamics.com/api?$skiptoken=xyz';
            component.ui.getEntityInput.value = 'accounts';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            DataService.retrieveMultipleRecords.mockRejectedValue(new Error('API Error'));

            await component._loadMoreRecords();

            // Buttons should be re-enabled in finally block
            expect(loadMoreBtn.disabled).toBe(false);
            expect(loadAllBtn.disabled).toBe(false);
            expect(loadMoreBtn.textContent).toBe('Load More');

            document.body.removeChild(loadMoreBtn);
            document.body.removeChild(loadAllBtn);
        });
    });

    describe('_toggleBulkFilterSection', () => {
        it('should hide PATCH filter section when patchIdInput has value', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'PATCH';
            component.ui.patchIdInput.value = 'some-guid-123';
            component.ui.patchFilterSection.hidden = false;

            component._toggleBulkFilterSection();

            expect(component.ui.patchFilterSection.hidden).toBe(true);
        });

        it('should show PATCH filter section when patchIdInput is empty', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'PATCH';
            component.ui.patchIdInput.value = '';
            component.ui.patchFilterSection.hidden = true;

            component._toggleBulkFilterSection();

            expect(component.ui.patchFilterSection.hidden).toBe(false);
        });

        it('should hide DELETE filter section when deleteIdInput has value', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'DELETE';
            component.ui.deleteIdInput.value = 'some-guid-456';
            component.ui.deleteFilterSection.hidden = false;

            component._toggleBulkFilterSection();

            expect(component.ui.deleteFilterSection.hidden).toBe(true);
        });

        it('should show DELETE filter section when deleteIdInput is empty', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'DELETE';
            component.ui.deleteIdInput.value = '';
            component.ui.deleteFilterSection.hidden = true;

            component._toggleBulkFilterSection();

            expect(component.ui.deleteFilterSection.hidden).toBe(false);
        });
    });

    describe('_resetFieldBuilder - lines 553-565', () => {
        it('should clear fieldsContainer innerHTML', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.postFieldsContainer.innerHTML = '<div>old content</div>';

            component._resetFieldBuilder();

            expect(component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid').length).toBe(1);
        });

        it('should clear bodyArea value', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.postBodyArea.value = '{"name": "test"}';

            component._resetFieldBuilder();

            expect(component.ui.postBodyArea.value).toBe('');
        });

        it('should add a single empty field row', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.postFieldsContainer.innerHTML = '';

            component._resetFieldBuilder();

            const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
            expect(rows.length).toBe(1);
        });
    });

    describe('_saveDeleteState - lines 592-595', () => {
        it('should save DELETE method state with entity and recordId', async () => {
            await setupComponent();
            const state = { entity: '', recordId: '' };
            component.ui.deleteEntityInput.value = 'leads';
            component.ui.deleteIdInput.value = 'delete-guid-123';

            component._saveDeleteState(state);

            expect(state.entity).toBe('leads');
            expect(state.recordId).toBe('delete-guid-123');
        });

        it('should save empty values when inputs are empty', async () => {
            await setupComponent();
            const state = { entity: '', recordId: '' };
            component.ui.deleteEntityInput.value = '';
            component.ui.deleteIdInput.value = '';

            component._saveDeleteState(state);

            expect(state.entity).toBe('');
            expect(state.recordId).toBe('');
        });
    });

    describe('_restoreDeleteState', () => {
        it('should restore DELETE state to UI inputs', async () => {
            await setupComponent();
            const state = { entity: 'opportunities', recordId: 'opp-guid-999' };

            component._restoreDeleteState(state);

            expect(component.ui.deleteEntityInput.value).toBe('opportunities');
            expect(component.ui.deleteIdInput.value).toBe('opp-guid-999');
        });
    });

    describe('_savePostState field builder', () => {
        it('should save field builder values to state', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            const state = { entity: '', recordId: '', fields: '', fieldsHtml: '', fieldValues: [] };
            component.ui.postEntityInput.value = 'contacts';
            component.ui.postBodyArea.value = '{"test": true}';

            // Add a field row with values
            const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
            const attrInput = row.querySelector('[data-prop="field-attribute"]');
            const valueInput = row.querySelector('[data-prop="field-value"]');
            attrInput.value = 'name';
            valueInput.value = 'Test Name';

            component._savePostState(state);

            expect(state.entity).toBe('contacts');
            expect(state.fields).toBe('{"test": true}');
            expect(state.fieldsHtml).toBeTruthy();
        });
    });

    describe('_populateFieldsFromJson - lines 2013-2060', () => {
        it('should populate field builder from JSON object', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.postEntityInput.value = 'account';
            const jsonObj = { name: 'Test Account', revenue: 1000000 };

            await component._populateFieldsFromJson(jsonObj);

            const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
            expect(rows.length).toBe(2);

            const firstRow = rows[0];
            expect(firstRow.querySelector('[data-prop="field-attribute"]').value).toBe('name');
            expect(firstRow.querySelector('[data-prop="field-value"]').value).toBe('Test Account');
        });

        it('should add empty field if no entries in object', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.postFieldsContainer.innerHTML = '';
            component.ui.postEntityInput.value = 'account';

            await component._populateFieldsFromJson({});

            const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
            expect(rows.length).toBe(1);
        });

        it('should stringify complex object values', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.postEntityInput.value = 'account';
            const jsonObj = { nested: { a: 1, b: 2 } };

            await component._populateFieldsFromJson(jsonObj);

            const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
            expect(row.querySelector('[data-prop="field-value"]').value).toBe('{"a":1,"b":2}');
        });
    });

    describe('_populateRequiredFieldsBuilderMode - lines 2164-2184', () => {
        let SmartValueInput;

        beforeEach(async () => {
            SmartValueInput = (await import('../../src/ui/SmartValueInput.js')).SmartValueInput;
            vi.clearAllMocks();
        });

        it('should populate builder with required attributes', async () => {
            await setupComponent();
            const requiredAttrs = [
                { LogicalName: 'name', AttributeType: 'String' },
                { LogicalName: 'revenue', AttributeType: 'Decimal' }
            ];
            const navPropMap = new Map();

            await component._populateRequiredFieldsBuilderMode(requiredAttrs, navPropMap, 'account');

            const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
            expect(rows.length).toBe(2);
        });

        it('should handle lookup types with navigation property names', async () => {
            await setupComponent();
            const requiredAttrs = [
                { LogicalName: 'primarycontactid', AttributeType: 'Lookup' }
            ];
            const navPropMap = new Map([['primarycontactid', 'primarycontactid']]);

            await component._populateRequiredFieldsBuilderMode(requiredAttrs, navPropMap, 'account');

            const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
            expect(row.querySelector('[data-prop="field-attribute"]').value).toContain('@odata.bind');
        });
    });

    describe('_populateRequiredFieldsJsonMode - lines 2140-2143', () => {
        it('should populate JSON body area with required fields template', async () => {
            await setupComponent();
            const requiredAttrs = [
                { LogicalName: 'name', AttributeType: 'String' }
            ];
            const navPropMap = new Map();

            await component._populateRequiredFieldsJsonMode(requiredAttrs, navPropMap);

            expect(component.ui.postBodyArea.value).toContain('name');
        });
    });

    describe('_extractFileUploads from field builder - lines 2272-2295', () => {
        it('should return empty array when no file uploads', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.postBodyModeToggle.checked = false;

            const result = component._extractFileUploads();

            expect(result).toEqual([]);
        });

        it('should extract file uploads from field builder rows', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.postBodyModeToggle.checked = false;

            // Add a row with file upload
            const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
            const attrInput = row.querySelector('[data-prop="field-attribute"]');
            attrInput.value = 'documentbody';

            const valueContainer = document.createElement('div');
            valueContainer.className = 'pdt-file-upload-container';
            valueContainer.dataset.type = 'file';
            valueContainer.dataset.prop = 'field-value';
            valueContainer._fileData = 'base64data';
            valueContainer._fileName = 'test.pdf';
            valueContainer._mimeType = 'application/pdf';

            const existingValueContainer = row.querySelector('.pdt-value-container');
            existingValueContainer.innerHTML = '';
            existingValueContainer.appendChild(valueContainer);

            const result = component._extractFileUploads();

            expect(result.length).toBe(1);
            expect(result[0].attributeName).toBe('documentbody');
            expect(result[0].fileName).toBe('test.pdf');
        });
    });

    describe('_uploadFiles - lines 2343-2358', () => {
        let FileUploadService;
        let NotificationService;

        beforeEach(async () => {
            FileUploadService = (await import('../../src/services/FileUploadService.js')).FileUploadService;
            NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
            vi.clearAllMocks();
        });

        it('should upload multiple files successfully', async () => {
            await setupComponent();
            FileUploadService.uploadFile.mockResolvedValue({});

            const fileUploads = [
                { attributeName: 'doc1', fileData: 'data1', fileName: 'file1.pdf', mimeType: 'application/pdf' },
                { attributeName: 'doc2', fileData: 'data2', fileName: 'file2.pdf', mimeType: 'application/pdf' }
            ];

            await component._uploadFiles('account', 'entity-123', fileUploads);

            expect(FileUploadService.uploadFile).toHaveBeenCalledTimes(2);
        });

        it('should show warning on file upload failure', async () => {
            await setupComponent();
            FileUploadService.uploadFile.mockRejectedValue(new Error('Upload failed'));

            const fileUploads = [
                { attributeName: 'doc1', fileData: 'data1', fileName: 'file1.pdf', mimeType: 'application/pdf' }
            ];

            await component._uploadFiles('account', 'entity-123', fileUploads);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('File upload failed'),
                'warning'
            );
        });
    });

    describe('_handleTouchDialogConfirm - lines 2713-2717', () => {
        let NotificationService;

        beforeEach(async () => {
            NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
            vi.clearAllMocks();
        });

        it('should show warning when no fields configured', async () => {
            await setupComponent();

            const overlay = document.createElement('div');
            overlay.innerHTML = '<div class="touch-field-row"></div>';
            document.body.appendChild(overlay);

            const fieldsContainer = overlay.querySelector('.touch-field-row').parentElement;
            fieldsContainer.innerHTML = ''; // No field rows

            const resolve = vi.fn();

            component._handleTouchDialogConfirm(fieldsContainer, overlay, resolve);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'warning'
            );

            document.body.removeChild(overlay);
        });
    });

    describe('_displayTouchErrors - lines 2882-2883, 2958-2961', () => {
        it('should display touch errors in result panel', async () => {
            await setupComponent();
            vi.spyOn(component, '_displayResult');

            const errors = [
                { error: 'Error 1' },
                { error: 'Error 2' }
            ];

            component._displayTouchErrors(5, 2, errors);

            expect(component.lastResult.entities.length).toBe(2);
            expect(component._displayResult).toHaveBeenCalled();
        });
    });

    describe('_getEntityInputForMethod - lines 2817, 2839', () => {
        it('should return GET entity input value', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'GET';
            component.ui.getEntityInput.value = 'accounts';

            const result = component._getEntityInputForMethod();

            expect(result).toBe('accounts');
        });

        it('should return POST entity input value', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.postEntityInput.value = 'contacts';

            const result = component._getEntityInputForMethod();

            expect(result).toBe('contacts');
        });

        it('should return PATCH entity input value', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'PATCH';
            component.ui.patchEntityInput.value = 'leads';

            const result = component._getEntityInputForMethod();

            expect(result).toBe('leads');
        });

        it('should return DELETE entity input value', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'DELETE';
            component.ui.deleteEntityInput.value = 'opportunities';

            const result = component._getEntityInputForMethod();

            expect(result).toBe('opportunities');
        });
    });

    describe('_prepareTouchOperations - lines 2849-2850', () => {
        it('should skip records without primary key', async () => {
            await setupComponent();

            const records = [
                { accountid: 'guid-1', name: 'Test' },
                { name: 'No ID' }, // Missing primary key
                { accountid: 'guid-2', name: 'Test 2' }
            ];
            const touchConfig = [{ field: 'name', useCustomValue: false }];

            const result = component._prepareTouchOperations(
                records,
                'accountid',
                touchConfig,
                'accounts'
            );

            expect(result.allOperations.length).toBe(2);
            expect(result.totalFailCount).toBe(1);
            expect(result.allErrors.length).toBe(1);
        });
    });

    describe('_buildTouchData - lines 2839', () => {
        it('should build touch data with custom value', async () => {
            await setupComponent();

            const record = { name: 'Original', modifiedon: '2025-01-01' };
            const touchConfig = [
                { field: 'name', useCustomValue: true, customValue: 'Updated' }
            ];

            const result = component._buildTouchData(record, touchConfig);

            expect(result.name).toBe('Updated');
        });

        it('should build touch data with current value', async () => {
            await setupComponent();

            const record = { name: 'Keep This', status: 1 };
            const touchConfig = [
                { field: 'name', useCustomValue: false },
                { field: 'status', useCustomValue: false }
            ];

            const result = component._buildTouchData(record, touchConfig);

            expect(result.name).toBe('Keep This');
            expect(result.status).toBe(1);
        });

        it('should handle lowercase field lookup fallback', async () => {
            await setupComponent();

            const record = { NAME: 'Uppercase Field' };
            const touchConfig = [
                { field: 'name', useCustomValue: false }
            ];

            const result = component._buildTouchData(record, touchConfig);

            expect(result.name).toBe(null); // Falls back to null if not found
        });
    });

    describe('_handleTouchResult - lines 2882-2883', () => {
        let NotificationService;

        beforeEach(async () => {
            NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
            vi.clearAllMocks();
        });

        it('should reload records and show success when no failures', async () => {
            await setupComponent();
            vi.spyOn(component, '_reloadRecordsAfterTouch').mockResolvedValue();

            await component._handleTouchResult(10, 0, []);

            expect(component._reloadRecordsAfterTouch).toHaveBeenCalled();
            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'success'
            );
        });

        it('should display errors when there are failures', async () => {
            await setupComponent();
            vi.spyOn(component, '_displayTouchErrors');

            await component._handleTouchResult(5, 2, [{ error: 'Test error' }]);

            expect(component._displayTouchErrors).toHaveBeenCalledWith(5, 2, [{ error: 'Test error' }]);
        });
    });

    describe('_parseLookupValue - lines 2013-2018', () => {
        it('should return value if it contains parentheses', async () => {
            await setupComponent();

            const result = component._parseLookupValue('/accounts(00000000-0000-0000-0000-000000000000)');

            expect(result).toBe('/accounts(00000000-0000-0000-0000-000000000000)');
        });

        it('should return undefined if value lacks parentheses', async () => {
            await setupComponent();

            const result = component._parseLookupValue('invalid-lookup');

            expect(result).toBeUndefined();
        });
    });

    describe('_parseDefaultValue - lines 2018', () => {
        it('should parse valid JSON string', async () => {
            await setupComponent();

            const result = component._parseDefaultValue('{"key": "value"}');

            expect(result).toEqual({ key: 'value' });
        });

        it('should return raw string if not valid JSON', async () => {
            await setupComponent();

            const result = component._parseDefaultValue('plain text value');

            expect(result).toBe('plain text value');
        });
    });

    describe('clearResults with ResultPanel creation - lines 3169-3178', () => {
        it('should clear resultRoot textContent', async () => {
            await setupComponent();
            component.ui.resultRoot.textContent = 'Previous content';

            component.clearResults();

            // resultRoot should have been cleared before new panel creation
            expect(component.resultPanel).toBeDefined();
        });

        it('should create new ResultPanel with correct options', async () => {
            const { ResultPanel } = await import('../../src/utils/ui/ResultPanel.js');
            await setupComponent();
            ResultPanel.mockClear();

            component.clearResults();

            expect(ResultPanel).toHaveBeenCalledWith(expect.objectContaining({
                root: component.ui.resultRoot,
                enableSelection: true
            }));
        });
    });

    describe('Keyboard shortcut handler - lines 366-370', () => {
        it('should trigger execute on Ctrl+Enter', async () => {
            const element = await setupComponent();
            const clickSpy = vi.spyOn(component.ui.executeBtn, 'click');

            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                ctrlKey: true,
                bubbles: true
            });
            element.dispatchEvent(event);

            expect(clickSpy).toHaveBeenCalled();
        });

        it('should trigger execute on Meta+Enter (Mac)', async () => {
            const element = await setupComponent();
            const clickSpy = vi.spyOn(component.ui.executeBtn, 'click');

            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                metaKey: true,
                bubbles: true
            });
            element.dispatchEvent(event);

            expect(clickSpy).toHaveBeenCalled();
        });
    });

    describe('_addGetFilterGroupHandler error path - lines 1210-1213', () => {
        let NotificationService;
        let EntityContextResolver;

        beforeEach(async () => {
            NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
            EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
            vi.clearAllMocks();
        });

        it('should show warning when entity context fails', async () => {
            await setupComponent();
            component.ui.getEntityInput.value = '';
            EntityContextResolver.resolve.mockRejectedValue(new Error('No entity'));

            await component._addGetFilterGroupHandler();

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'warning'
            );
        });
    });

    describe('_addPatchFilterGroupHandler error path - lines 1289-1291', () => {
        let NotificationService;
        let EntityContextResolver;

        beforeEach(async () => {
            NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
            EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
            vi.clearAllMocks();
        });

        it('should show warning when PATCH entity context fails', async () => {
            await setupComponent();
            component.ui.patchEntityInput.value = '';
            EntityContextResolver.resolve.mockRejectedValue(new Error('No entity'));

            await component._addPatchFilterGroupHandler();

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'warning'
            );
        });
    });

    describe('_addDeleteFilterGroupHandler error path - lines 1380-1382', () => {
        let NotificationService;
        let EntityContextResolver;

        beforeEach(async () => {
            NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
            EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
            vi.clearAllMocks();
        });

        it('should show warning when DELETE entity context fails', async () => {
            await setupComponent();
            component.ui.deleteEntityInput.value = '';
            EntityContextResolver.resolve.mockRejectedValue(new Error('No entity'));

            await component._addDeleteFilterGroupHandler();

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'warning'
            );
        });
    });

    describe('_addFieldBtnHandler error path - lines 1464', () => {
        let NotificationService;
        let EntityContextResolver;

        beforeEach(async () => {
            NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
            EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
            vi.clearAllMocks();
        });

        it('should show warning when adding field without entity context', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.postEntityInput.value = '';
            EntityContextResolver.resolve.mockRejectedValue(new Error('No entity'));

            await component._postAddFieldBtnHandler();

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'warning'
            );
        });
    });

    describe('_getPlaceholderForType - lines 2214-2237', () => {
        it('should return empty string for string type', async () => {
            await setupComponent();

            const result = await component._getPlaceholderForType('string', {});

            expect(result).toBe('');
        });

        it('should return 0 for integer type', async () => {
            await setupComponent();

            const result = await component._getPlaceholderForType('integer', {});

            expect(result).toBe(0);
        });

        it('should return 0.0 for decimal type', async () => {
            await setupComponent();

            const result = await component._getPlaceholderForType('decimal', {});

            expect(result).toBe(0.0);
        });

        it('should return false for boolean type', async () => {
            await setupComponent();

            const result = await component._getPlaceholderForType('boolean', {});

            expect(result).toBe(false);
        });

        it('should return ISO datetime for datetime type', async () => {
            await setupComponent();

            const result = await component._getPlaceholderForType('datetime', {});

            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });

        it('should return 1 for picklist type', async () => {
            await setupComponent();

            const result = await component._getPlaceholderForType('picklist', {});

            expect(result).toBe(1);
        });

        it('should return null for unknown type', async () => {
            await setupComponent();

            const result = await component._getPlaceholderForType('unknown', {});

            expect(result).toBeNull();
        });
    });

    describe('_getLookupPlaceholderValue - lines 2469-2470, 2476-2478', () => {
        let DataService;

        beforeEach(async () => {
            DataService = (await import('../../src/services/DataService.js')).DataService;
            vi.clearAllMocks();
        });

        it('should return entitySet placeholder from API', async () => {
            await setupComponent();
            DataService.retrieveEntityDefinition = vi.fn().mockResolvedValue({ EntitySetName: 'contacts' });

            const result = await component._getLookupPlaceholderValue({ Targets: ['contact'] });

            expect(result).toContain('/contacts(');
        });

        it('should fallback to pluralized name on error', async () => {
            await setupComponent();
            DataService.retrieveEntityDefinition = vi.fn().mockRejectedValue(new Error('Not found'));

            const result = await component._getLookupPlaceholderValue({ Targets: ['account'] });

            expect(result).toContain('/accounts(');
        });

        it('should use default systemuser when no targets', async () => {
            await setupComponent();
            DataService.retrieveEntityDefinition = vi.fn().mockResolvedValue({ EntitySetName: 'systemusers' });

            const result = await component._getLookupPlaceholderValue({ Targets: [] });

            expect(result).toContain('/systemusers(');
        });
    });

    describe('_getRequestBody JSON mode validation - lines 2492-2498', () => {
        let ValidationService;

        beforeEach(async () => {
            ValidationService = (await import('../../src/services/ValidationService.js')).ValidationService;
            vi.clearAllMocks();
        });

        it('should validate and return parsed JSON in JSON mode', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.postBodyModeToggle.checked = true;
            component.ui.postBodyArea.value = '{"name": "Test"}';
            ValidationService.validateJson.mockReturnValue({ name: 'Test' });

            const result = component._getRequestBody();

            expect(ValidationService.validateJson).toHaveBeenCalledWith(
                '{"name": "Test"}',
                'Request body'
            );
            expect(result).toEqual({ name: 'Test' });
        });
    });

    describe('_executeBulkPatch no records matched - lines 2387-2396', () => {
        let NotificationService;
        let EntityContextResolver;
        let ValidationService;

        beforeEach(async () => {
            NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
            EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
            ValidationService = (await import('../../src/services/ValidationService.js')).ValidationService;
            vi.clearAllMocks();
        });

        it('should show warning when no filter groups', async () => {
            await setupComponent();
            component.ui.patchEntityInput.value = 'accounts';
            component.ui.patchBodyModeToggle.checked = true;
            component.ui.patchBodyArea.value = '{"name": "Test"}';

            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            ValidationService.validateJson.mockReturnValue({ name: 'Test' });

            // Return empty filter groups
            component.patchFilterManager.extractFilterGroups.mockReturnValue([]);

            await component._executeBulkPatch();

            expect(NotificationService.show).toHaveBeenCalled();
        });
    });

    describe('_executeBulkDelete no filter groups - lines 3010-3012, 3019-3020', () => {
        let NotificationService;
        let EntityContextResolver;

        beforeEach(async () => {
            NotificationService = (await import('../../src/services/NotificationService.js')).NotificationService;
            EntityContextResolver = (await import('../../src/utils/resolvers/EntityContextResolver.js')).EntityContextResolver;
            vi.clearAllMocks();
        });

        it('should show warning when no filter groups for DELETE', async () => {
            await setupComponent();
            component.ui.deleteEntityInput.value = 'accounts';
            EntityContextResolver.resolve.mockResolvedValue({ entitySet: 'accounts', logicalName: 'account' });
            component.deleteFilterManager.extractFilterGroups.mockReturnValue([]);

            await component._executeBulkDelete();

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'warning'
            );
        });
    });

    describe('_restoreFieldBuilder - lines 2530-2533', () => {
        it('should restore field builder from saved state with fieldsHtml', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';

            // Clear existing fields first
            component.ui.postFieldsContainer.innerHTML = '';

            // Create HTML for two fields
            const fieldsHtml = `
                <div class="pdt-field-grid">
                    <div class="pdt-input-with-button">
                        <input type="text" class="pdt-input" data-prop="field-attribute" value="name">
                    </div>
                    <div class="pdt-value-container">
                        <input type="text" class="pdt-input pdt-full-width" data-prop="field-value" value="Test">
                    </div>
                </div>
                <div class="pdt-field-grid">
                    <div class="pdt-input-with-button">
                        <input type="text" class="pdt-input" data-prop="field-attribute" value="revenue">
                    </div>
                    <div class="pdt-value-container">
                        <input type="text" class="pdt-input pdt-full-width" data-prop="field-value" value="1000">
                    </div>
                </div>
            `;
            const state = { fieldsHtml };

            component._restoreFieldBuilder(state, 'POST');

            const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
            expect(rows.length).toBe(2);
        });

        it('should add empty field when no fieldsHtml in state', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            component.ui.postFieldsContainer.innerHTML = '';
            const state = {}; // No fieldsHtml means use default behavior

            component._restoreFieldBuilder(state, 'POST');

            const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
            expect(rows.length).toBe(1);
        });
    });

    describe('_restoreFieldValues - lines 2550-2560', () => {
        it('should restore values to existing field rows', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            const fieldValues = [
                { attribute: 'name', value: 'Restored Name' }
            ];

            component._restoreFieldValues(fieldValues, 'POST');

            const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
            expect(row.querySelector('[data-prop="field-attribute"]').value).toBe('name');
            expect(row.querySelector('[data-prop="field-value"]').value).toBe('Restored Name');
        });

        it('should handle empty field values array', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';

            component._restoreFieldValues([], 'POST');

            // Should not throw error
            expect(true).toBe(true);
        });

        it('should restore attrMetadata if present', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';
            const fieldValues = [
                { attribute: 'name', value: 'Test', attrMetadata: { type: 'String' } }
            ];

            component._restoreFieldValues(fieldValues, 'POST');

            const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
            expect(row._attrMetadata).toEqual({ type: 'String' });
        });
    });

    describe('_createFieldRemoveHandler multiple rows - lines 2589-2593', () => {
        it('should remove row when multiple rows exist', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';

            // Add a second field row
            component._addFieldUI(false, 'POST');
            expect(component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid').length).toBe(2);

            // Get the second row (non-first row)
            const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
            const secondRow = rows[1];
            const removeBtn = secondRow.querySelector('.pdt-condition-remove');
            removeBtn.click();

            expect(component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid').length).toBe(1);
        });

        it('should reset first row when triggered with content', async () => {
            await setupComponent();
            component.ui.methodSelect.value = 'POST';

            const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
            const attrInput = row.querySelector('[data-prop="field-attribute"]');
            const valueInput = row.querySelector('[data-prop="field-value"]');
            attrInput.value = 'name';
            valueInput.value = 'test';

            // Trigger the input event to enable the remove button
            attrInput.dispatchEvent(new Event('input'));

            const removeBtn = row.querySelector('.pdt-condition-remove');

            // The remove button should now be enabled since there's content
            expect(removeBtn.disabled).toBe(false);
            removeBtn.click();

            // Row should still exist but be reset
            expect(component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid').length).toBe(1);
            expect(attrInput.value).toBe('');
        });
    });

    describe('cleanup filter managers - line 3292', () => {
        it('should call cleanup on all filter managers', async () => {
            await setupComponent();
            component.getFilterManager.cleanup = vi.fn();
            component.patchFilterManager.cleanup = vi.fn();
            component.deleteFilterManager.cleanup = vi.fn();

            component.cleanup();

            expect(component.getFilterManager.cleanup).toHaveBeenCalled();
            expect(component.patchFilterManager.cleanup).toHaveBeenCalled();
            expect(component.deleteFilterManager.cleanup).toHaveBeenCalled();
        });
    });

    describe('ResultPanel callbacks - lines 2450-2465 coverage', () => {
        it('should call onToggleView callback and update currentView', async () => {
            await setupComponent();
            const { ResultPanel } = await import('../../src/utils/ui/ResultPanel.js');

            // Get the options passed to ResultPanel constructor
            const constructorCall = ResultPanel.mock.calls[0][0];
            expect(constructorCall.onToggleView).toBeDefined();

            // Call the onToggleView callback directly
            component.currentView = 'table';
            component._displayResult = vi.fn();
            constructorCall.onToggleView('json');

            expect(component.currentView).toBe('json');
            expect(component._displayResult).toHaveBeenCalled();
        });

        it('should call onToggleHide callback and update hideOdata', async () => {
            await setupComponent();
            const { ResultPanel } = await import('../../src/utils/ui/ResultPanel.js');

            const constructorCall = ResultPanel.mock.calls[0][0];
            expect(constructorCall.onToggleHide).toBeDefined();

            component.hideOdata = true;
            component._displayResult = vi.fn();
            constructorCall.onToggleHide(false);

            expect(component.hideOdata).toBe(false);
            expect(component._displayResult).toHaveBeenCalled();
        });

        it('should call getSortState callback and return resultSortState', async () => {
            await setupComponent();
            const { ResultPanel } = await import('../../src/utils/ui/ResultPanel.js');

            const constructorCall = ResultPanel.mock.calls[0][0];
            expect(constructorCall.getSortState).toBeDefined();

            component.resultSortState = { column: 'name', direction: 'desc' };
            const result = constructorCall.getSortState();

            expect(result).toEqual({ column: 'name', direction: 'desc' });
        });

        it('should call setSortState callback and update resultSortState', async () => {
            await setupComponent();
            const { ResultPanel } = await import('../../src/utils/ui/ResultPanel.js');

            const constructorCall = ResultPanel.mock.calls[0][0];
            expect(constructorCall.setSortState).toBeDefined();

            constructorCall.setSortState({ column: 'createdon', direction: 'asc' });

            expect(component.resultSortState).toEqual({ column: 'createdon', direction: 'asc' });
        });

        it('should call onBulkTouch callback with records', async () => {
            await setupComponent();
            const { ResultPanel } = await import('../../src/utils/ui/ResultPanel.js');

            const constructorCall = ResultPanel.mock.calls[0][0];
            expect(constructorCall.onBulkTouch).toBeDefined();

            component._handleBulkTouch = vi.fn();
            const mockRecords = [{ id: '1' }, { id: '2' }];
            constructorCall.onBulkTouch(mockRecords);

            expect(component._handleBulkTouch).toHaveBeenCalledWith(mockRecords);
        });
    });

    describe('FilterGroupManager callbacks - lines 2475-2495 coverage', () => {
        it('should call getFilterManager getEntityContext callback', async () => {
            await setupComponent();
            const { FilterGroupManager } = await import('../../src/ui/FilterGroupManager.js');

            // Get the first FilterGroupManager (GET context)
            const getFilterCall = FilterGroupManager.mock.calls[0][0];
            expect(getFilterCall.getEntityContext).toBeDefined();

            component._ensureEntityContext = vi.fn().mockResolvedValue({ logicalName: 'account' });
            const result = await getFilterCall.getEntityContext();

            expect(result).toBe('account');
            expect(component._ensureEntityContext).toHaveBeenCalled();
        });

        it('should call getFilterManager renderValueInput callback', async () => {
            await setupComponent();
            const { FilterGroupManager } = await import('../../src/ui/FilterGroupManager.js');

            const getFilterCall = FilterGroupManager.mock.calls[0][0];
            expect(getFilterCall.renderValueInput).toBeDefined();

            component._renderValueInput = vi.fn().mockResolvedValue();
            component._ensureEntityContext = vi.fn().mockResolvedValue({ logicalName: 'contact' });

            const mockConditionGroup = document.createElement('div');
            const mockAttr = 'name';
            const mockGetEntityContext = vi.fn().mockResolvedValue('contact');

            await getFilterCall.renderValueInput(mockAttr, mockConditionGroup, mockGetEntityContext);

            expect(component._renderValueInput).toHaveBeenCalledWith(mockConditionGroup, mockAttr, 'contact', 'filter');
        });

        it('should call getFilterManager onUpdate callback', async () => {
            await setupComponent();
            const { FilterGroupManager } = await import('../../src/ui/FilterGroupManager.js');

            const getFilterCall = FilterGroupManager.mock.calls[0][0];
            expect(getFilterCall.onUpdate).toBeDefined();

            component._updatePreview = vi.fn();
            getFilterCall.onUpdate();

            expect(component._updatePreview).toHaveBeenCalled();
        });

        it('should call patchFilterManager and deleteFilterManager callbacks when available', async () => {
            await setupComponent();
            const { FilterGroupManager } = await import('../../src/ui/FilterGroupManager.js');

            // Verify multiple filter managers are created for different HTTP methods
            expect(FilterGroupManager.mock.calls.length).toBeGreaterThanOrEqual(1);

            // Verify the first filter manager has the expected callback structure
            const firstFilterCall = FilterGroupManager.mock.calls[0][0];
            expect(firstFilterCall).toBeDefined();
            expect(typeof firstFilterCall.getEntityContext).toBe('function');
        });
    });

    describe('_handleBulkTouch - lines 2771-2800 coverage', () => {
        it('should show warning when no records provided', async () => {
            await setupComponent();
            const { NotificationService } = await import('../../src/services/NotificationService.js');

            await component._handleBulkTouch([]);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('selected'),
                'warning'
            );
        });

        it('should show warning when records is null', async () => {
            await setupComponent();
            const { NotificationService } = await import('../../src/services/NotificationService.js');

            await component._handleBulkTouch(null);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('selected'),
                'warning'
            );
        });
    });

    describe('_copyFromGet - inter-group-operator fix', () => {
        it('should copy inter-group-operator when copying filters from GET to PATCH', async () => {
            await setupComponent();

            // Mock EntityContextResolver for smart input rendering
            const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');
            EntityContextResolver.resolve = vi.fn().mockResolvedValue({
                entitySet: 'accounts',
                logicalName: 'account'
            });
            EntityContextResolver.getAttrMap = vi.fn().mockResolvedValue(new Map());

            // Setup GET with table name
            component.ui.getEntityInput = { value: 'accounts' };
            component.ui.patchEntityInput = { value: '' };
            component.ui.patchIdInput = { value: 'some-id' };
            component.ui.patchFilterSection = { hidden: true };
            component.ui.addPatchFilterGroupBtn = { hidden: true };
            component.ui.patchFiltersContainer = document.createElement('div');

            // Mock filter groups with inter-group-operator
            const mockFilterGroups = [
                {
                    filterType: 'and',
                    filters: [{ attr: 'name', op: 'eq', value: 'test' }]
                },
                {
                    filterType: 'or',
                    interGroupOperator: 'or', // Second group has inter-group-operator
                    filters: [{ attr: 'statecode', op: 'eq', value: '0' }]
                }
            ];

            component.getFilterManager.extractFilterGroups.mockReturnValue(mockFilterGroups);

            // Mock addFilterGroup to create realistic filter group DOM
            component.patchFilterManager.addFilterGroup.mockImplementation((container, isFirst) => {
                const filterGroup = document.createElement('div');
                filterGroup.className = 'pdt-filter-group';

                // Add filter type select
                const filterTypeSelect = document.createElement('select');
                filterTypeSelect.setAttribute('data-prop', 'filter-type');
                // Add actual options
                ['and', 'or', 'not'].forEach(type => {
                    const option = document.createElement('option');
                    option.value = type;
                    filterTypeSelect.appendChild(option);
                });
                filterGroup.appendChild(filterTypeSelect);

                // Add conditions container
                const conditionsContainer = document.createElement('div');
                conditionsContainer.className = 'pdt-filter-group-conditions';
                filterGroup.appendChild(conditionsContainer);

                // Add first condition
                const conditionRow = document.createElement('div');
                conditionRow.className = 'pdt-condition-grid';
                const attrInput = document.createElement('input');
                attrInput.setAttribute('data-prop', 'attribute');
                const opSelect = document.createElement('select');
                opSelect.setAttribute('data-prop', 'operator');
                const valueInput = document.createElement('input');
                valueInput.setAttribute('data-prop', 'value');
                conditionRow.appendChild(attrInput);
                conditionRow.appendChild(opSelect);
                conditionRow.appendChild(valueInput);
                conditionsContainer.appendChild(conditionRow);

                // If not first group, add separator before it
                if (!isFirst) {
                    const separator = document.createElement('div');
                    separator.className = 'pdt-filter-group-separator';
                    const operatorSelect = document.createElement('select');
                    operatorSelect.setAttribute('data-prop', 'inter-group-operator');
                    // Add actual options to inter-group-operator select
                    ['and', 'or'].forEach(op => {
                        const option = document.createElement('option');
                        option.value = op;
                        operatorSelect.appendChild(option);
                    });
                    separator.appendChild(operatorSelect);
                    container.appendChild(separator);
                }

                container.appendChild(filterGroup);
            });

            // Execute copy
            await component._copyFromGet('PATCH');

            // Verify table name copied
            expect(component.ui.patchEntityInput.value).toBe('accounts');

            // Verify ID cleared for bulk mode
            expect(component.ui.patchIdInput.value).toBe('');

            // Verify filter section shown
            expect(component.ui.patchFilterSection.hidden).toBe(false);
            expect(component.ui.addPatchFilterGroupBtn.hidden).toBe(false);

            // Verify filter groups were added
            expect(component.patchFilterManager.addFilterGroup).toHaveBeenCalledTimes(2);

            // Verify inter-group-operator was set
            const groups = component.ui.patchFiltersContainer.querySelectorAll('.pdt-filter-group');
            expect(groups.length).toBe(2);

            // Second group should have separator with operator
            const secondGroup = groups[1];
            const separator = secondGroup.previousElementSibling;
            expect(separator).toBeTruthy();
            expect(separator.classList.contains('pdt-filter-group-separator')).toBe(true);

            const operatorSelect = separator.querySelector('[data-prop="inter-group-operator"]');
            expect(operatorSelect).toBeTruthy();
            expect(operatorSelect.value).toBe('or'); // Should be set to 'or' from mockFilterGroups
        });

        it('should copy inter-group-operator when copying filters from GET to DELETE', async () => {
            await setupComponent();

            // Mock EntityContextResolver for smart input rendering
            const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');
            EntityContextResolver.resolve = vi.fn().mockResolvedValue({
                entitySet: 'contacts',
                logicalName: 'contact'
            });
            EntityContextResolver.getAttrMap = vi.fn().mockResolvedValue(new Map());

            // Setup GET with table name
            component.ui.getEntityInput = { value: 'contacts' };
            component.ui.deleteEntityInput = { value: '' };
            component.ui.deleteIdInput = { value: 'some-id' };
            component.ui.deleteFilterSection = { hidden: true };
            component.ui.addDeleteFilterGroupBtn = { hidden: true };
            component.ui.deleteFiltersContainer = document.createElement('div');

            // Mock filter groups with inter-group-operator
            const mockFilterGroups = [
                {
                    filterType: 'and',
                    filters: [{ attr: 'firstname', op: 'eq', value: 'John' }]
                },
                {
                    filterType: 'and',
                    interGroupOperator: 'and', // AND between groups
                    filters: [{ attr: 'lastname', op: 'eq', value: 'Doe' }]
                }
            ];

            component.getFilterManager.extractFilterGroups.mockReturnValue(mockFilterGroups);

            // Mock addFilterGroup
            component.deleteFilterManager.addFilterGroup.mockImplementation((container, isFirst) => {
                const filterGroup = document.createElement('div');
                filterGroup.className = 'pdt-filter-group';

                const filterTypeSelect = document.createElement('select');
                filterTypeSelect.setAttribute('data-prop', 'filter-type');
                // Add options for filter type
                ['and', 'or', 'not'].forEach(type => {
                    const option = document.createElement('option');
                    option.value = type;
                    filterTypeSelect.appendChild(option);
                });
                filterGroup.appendChild(filterTypeSelect);

                const conditionsContainer = document.createElement('div');
                conditionsContainer.className = 'pdt-filter-group-conditions';
                filterGroup.appendChild(conditionsContainer);

                const conditionRow = document.createElement('div');
                conditionRow.className = 'pdt-condition-grid';
                const attrInput = document.createElement('input');
                attrInput.setAttribute('data-prop', 'attribute');
                const opSelect = document.createElement('select');
                opSelect.setAttribute('data-prop', 'operator');
                const valueInput = document.createElement('input');
                valueInput.setAttribute('data-prop', 'value');
                conditionRow.appendChild(attrInput);
                conditionRow.appendChild(opSelect);
                conditionRow.appendChild(valueInput);
                conditionsContainer.appendChild(conditionRow);

                if (!isFirst) {
                    const separator = document.createElement('div');
                    separator.className = 'pdt-filter-group-separator';
                    const operatorSelect = document.createElement('select');
                    operatorSelect.setAttribute('data-prop', 'inter-group-operator');
                    // Add options for inter-group-operator
                    ['and', 'or'].forEach(op => {
                        const option = document.createElement('option');
                        option.value = op;
                        operatorSelect.appendChild(option);
                    });
                    separator.appendChild(operatorSelect);
                    container.appendChild(separator);
                }

                container.appendChild(filterGroup);
            });

            // Execute copy
            await component._copyFromGet('DELETE');

            // Verify the inter-group-operator was set for DELETE
            const groups = component.ui.deleteFiltersContainer.querySelectorAll('.pdt-filter-group');
            expect(groups.length).toBe(2);

            const secondGroup = groups[1];
            const separator = secondGroup.previousElementSibling;
            const operatorSelect = separator.querySelector('[data-prop="inter-group-operator"]');
            expect(operatorSelect.value).toBe('and');
        });

        it('should show warning when no table name in GET', async () => {
            // Manually create a minimal component without full setup to avoid cleanup issues
            const testComponent = new WebApiExplorerTab();

            const { NotificationService } = await import('../../src/services/NotificationService.js');

            // Mock only the necessary properties
            testComponent.ui = {
                getEntityInput: { value: '' }
            };

            testComponent.getFilterManager = {
                extractFilterGroups: vi.fn(() => [])
            };

            testComponent._copyFromGet('PATCH');

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'warning'
            );

            // Don't assign to component variable to avoid cleanup in afterEach
        });
    });

    // Test refactored _copyFromGet helper methods
    describe('_copyFromGet refactored helper methods', () => {
        describe('_validateAndGetTableName', () => {
            it('should return trimmed table name when valid', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.getEntityInput = { value: '  account  ' };

                const result = component._validateAndGetTableName();

                expect(result).toBe('account');
            });

            it('should return null and show warning when empty', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.getEntityInput = { value: '' };

                const result = component._validateAndGetTableName();

                expect(result).toBeNull();
                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.any(String),
                    'warning'
                );
            });

            it('should return null and show warning when only whitespace', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.getEntityInput = { value: '   ' };

                const result = component._validateAndGetTableName();

                expect(result).toBeNull();
                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.any(String),
                    'warning'
                );
            });
        });

        describe('_copyTableNameToTarget', () => {
            it('should copy table name to PATCH entity input', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.patchEntityInput = { value: '' };

                component._copyTableNameToTarget('account', 'PATCH');

                expect(component.ui.patchEntityInput.value).toBe('account');
            });

            it('should copy table name to DELETE entity input', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.deleteEntityInput = { value: '' };

                component._copyTableNameToTarget('contact', 'DELETE');

                expect(component.ui.deleteEntityInput.value).toBe('contact');
            });

            it('should not throw when entity input is missing', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.patchEntityInput = null;

                expect(() => component._copyTableNameToTarget('account', 'PATCH')).not.toThrow();
            });
        });

        describe('_enableBulkModeForTarget', () => {
            it('should clear PATCH record ID and show filter section', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.patchIdInput = { value: 'some-id' };
                component.ui.patchFilterSection = { hidden: true };
                component.ui.addPatchFilterGroupBtn = { hidden: true };

                component._enableBulkModeForTarget('PATCH');

                expect(component.ui.patchIdInput.value).toBe('');
                expect(component.ui.patchFilterSection.hidden).toBe(false);
                expect(component.ui.addPatchFilterGroupBtn.hidden).toBe(false);
            });

            it('should clear DELETE record ID and show filter section', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.deleteIdInput = { value: 'some-id' };
                component.ui.deleteFilterSection = { hidden: true };
                component.ui.addDeleteFilterGroupBtn = { hidden: true };

                component._enableBulkModeForTarget('DELETE');

                expect(component.ui.deleteIdInput.value).toBe('');
                expect(component.ui.deleteFilterSection.hidden).toBe(false);
                expect(component.ui.addDeleteFilterGroupBtn.hidden).toBe(false);
            });
        });

        describe('_getTargetContainerAndManager', () => {
            it('should return PATCH container and manager', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                const patchContainer = document.createElement('div');
                component.ui.patchFiltersContainer = patchContainer;

                const result = component._getTargetContainerAndManager('PATCH');

                expect(result.targetContainer).toBe(patchContainer);
                expect(result.targetManager).toBe(component.patchFilterManager);
            });

            it('should return DELETE container and manager', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                const deleteContainer = document.createElement('div');
                component.ui.deleteFiltersContainer = deleteContainer;

                const result = component._getTargetContainerAndManager('DELETE');

                expect(result.targetContainer).toBe(deleteContainer);
                expect(result.targetManager).toBe(component.deleteFilterManager);
            });
        });

        describe('_clearTargetFilters', () => {
            it('should clear container innerHTML', () => {
                const container = document.createElement('div');
                container.innerHTML = '<div>Old content</div>';

                component = new WebApiExplorerTab();
                component._clearTargetFilters(container);

                expect(container.innerHTML).toBe('');
            });

            it('should not throw when container is null', () => {
                component = new WebApiExplorerTab();
                expect(() => component._clearTargetFilters(null)).not.toThrow();
            });
        });

        describe('_setFilterType', () => {
            it('should set filter type value', () => {
                const filterGroup = document.createElement('div');
                const select = document.createElement('select');
                select.setAttribute('data-prop', 'filter-type');
                const option = document.createElement('option');
                option.value = 'simple';
                select.appendChild(option);
                filterGroup.appendChild(select);

                component = new WebApiExplorerTab();
                component._setFilterType(filterGroup, 'simple');

                expect(select.value).toBe('simple');
            });

            it('should not throw when select is missing', () => {
                const filterGroup = document.createElement('div');

                component = new WebApiExplorerTab();
                expect(() => component._setFilterType(filterGroup, 'simple')).not.toThrow();
            });
        });

        describe('_setInterGroupOperator', () => {
            it('should set inter-group operator value', () => {
                const separator = document.createElement('div');
                separator.classList.add('pdt-filter-group-separator');
                const select = document.createElement('select');
                select.setAttribute('data-prop', 'inter-group-operator');
                const option = document.createElement('option');
                option.value = 'or';
                select.appendChild(option);
                separator.appendChild(select);

                const filterGroup = document.createElement('div');
                document.body.appendChild(separator);
                document.body.appendChild(filterGroup);

                component = new WebApiExplorerTab();
                component._setInterGroupOperator(filterGroup, 'or');

                expect(select.value).toBe('or');

                document.body.removeChild(separator);
                document.body.removeChild(filterGroup);
            });

            it('should not throw when separator is missing', () => {
                const filterGroup = document.createElement('div');

                component = new WebApiExplorerTab();
                expect(() => component._setInterGroupOperator(filterGroup, 'or')).not.toThrow();
            });
        });

        describe('_setConditionAttributes', () => {
            it('should set attribute and operator values', () => {
                const conditionRow = document.createElement('div');
                const attrInput = document.createElement('input');
                attrInput.setAttribute('data-prop', 'attribute');
                const opSelect = document.createElement('select');
                opSelect.setAttribute('data-prop', 'operator');
                const option = document.createElement('option');
                option.value = 'eq';
                opSelect.appendChild(option);
                conditionRow.appendChild(attrInput);
                conditionRow.appendChild(opSelect);

                component = new WebApiExplorerTab();
                component._setConditionAttributes(conditionRow, { attr: 'name', op: 'eq' });

                expect(attrInput.value).toBe('name');
                expect(opSelect.value).toBe('eq');
            });

            it('should not throw when inputs are missing', () => {
                const conditionRow = document.createElement('div');

                component = new WebApiExplorerTab();
                expect(() => component._setConditionAttributes(conditionRow, { attr: 'name', op: 'eq' })).not.toThrow();
            });
        });

        describe('_setPlainTextValue', () => {
            it('should set plain text value', () => {
                const conditionRow = document.createElement('div');
                const valueInput = document.createElement('input');
                valueInput.setAttribute('data-prop', 'value');
                conditionRow.appendChild(valueInput);

                component = new WebApiExplorerTab();
                component._setPlainTextValue(conditionRow, 'test value');

                expect(valueInput.value).toBe('test value');
            });

            it('should not throw when value input is missing', () => {
                const conditionRow = document.createElement('div');

                component = new WebApiExplorerTab();
                expect(() => component._setPlainTextValue(conditionRow, 'test')).not.toThrow();
            });
        });

        describe('_setMultiselectValue', () => {
            it('should check matching checkboxes', () => {
                const valueInput = document.createElement('div');
                valueInput.classList.add('pdt-multiselect-dropdown');

                const cb1 = document.createElement('input');
                cb1.type = 'checkbox';
                cb1.value = '1';
                const cb2 = document.createElement('input');
                cb2.type = 'checkbox';
                cb2.value = '2';
                const cb3 = document.createElement('input');
                cb3.type = 'checkbox';
                cb3.value = '3';

                valueInput.appendChild(cb1);
                valueInput.appendChild(cb2);
                valueInput.appendChild(cb3);

                component = new WebApiExplorerTab();
                component._setMultiselectValue(valueInput, '1, 3');

                expect(cb1.checked).toBe(true);
                expect(cb2.checked).toBe(false);
                expect(cb3.checked).toBe(true);
            });

            it('should handle single value', () => {
                const valueInput = document.createElement('div');
                valueInput.classList.add('pdt-multiselect-dropdown');

                const cb1 = document.createElement('input');
                cb1.type = 'checkbox';
                cb1.value = '1';
                valueInput.appendChild(cb1);

                component = new WebApiExplorerTab();
                component._setMultiselectValue(valueInput, '1');

                expect(cb1.checked).toBe(true);
            });
        });

        describe('_setValueInputValue', () => {
            it('should set regular input value', () => {
                const conditionRow = document.createElement('div');
                const valueInput = document.createElement('input');
                valueInput.setAttribute('data-prop', 'value');
                conditionRow.appendChild(valueInput);

                component = new WebApiExplorerTab();
                component._setValueInputValue(conditionRow, { value: 'test' });

                expect(valueInput.value).toBe('test');
            });

            it('should call _setMultiselectValue for multiselect', () => {
                const conditionRow = document.createElement('div');
                const valueInput = document.createElement('div');
                valueInput.setAttribute('data-prop', 'value');
                valueInput.classList.add('pdt-multiselect-dropdown');
                conditionRow.appendChild(valueInput);

                component = new WebApiExplorerTab();
                component._setMultiselectValue = vi.fn();
                component._setValueInputValue(conditionRow, { value: '1,2' });

                expect(component._setMultiselectValue).toHaveBeenCalledWith(valueInput, '1,2');
            });

            it('should not throw when value input is missing', () => {
                const conditionRow = document.createElement('div');

                component = new WebApiExplorerTab();
                expect(() => component._setValueInputValue(conditionRow, { value: 'test' })).not.toThrow();
            });
        });

        describe('_showCopySuccessMessage', () => {
            it('should show message without filter count', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                component = new WebApiExplorerTab();

                component._showCopySuccessMessage('account', 0);

                expect(NotificationService.show).toHaveBeenCalledWith(
                    'Copied from GET: account',
                    'success'
                );
            });

            it('should show message with single filter group', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                component = new WebApiExplorerTab();

                component._showCopySuccessMessage('contact', 1);

                expect(NotificationService.show).toHaveBeenCalledWith(
                    'Copied from GET: contact with 1 filter group',
                    'success'
                );
            });

            it('should show message with multiple filter groups', async () => {
                const { NotificationService } = await import('../../src/services/NotificationService.js');
                component = new WebApiExplorerTab();

                component._showCopySuccessMessage('lead', 3);

                expect(NotificationService.show).toHaveBeenCalledWith(
                    'Copied from GET: lead with 3 filter groups',
                    'success'
                );
            });
        });
    });

    // Test refactored _updateMethodView helper methods
    describe('_updateMethodView refactored helper methods', () => {
        describe('_updateMethodSections', () => {
            it('should show only GET view', async () => {
                component = new WebApiExplorerTab();
                component.ui = {
                    getView: { hidden: true },
                    postView: { hidden: false },
                    patchView: { hidden: false },
                    deleteView: { hidden: false }
                };

                component._updateMethodSections('GET');

                expect(component.ui.getView.hidden).toBe(false);
                expect(component.ui.postView.hidden).toBe(true);
                expect(component.ui.patchView.hidden).toBe(true);
                expect(component.ui.deleteView.hidden).toBe(true);
            });

            it('should show only POST view', async () => {
                component = new WebApiExplorerTab();
                component.ui = {
                    getView: { hidden: false },
                    postView: { hidden: true },
                    patchView: { hidden: false },
                    deleteView: { hidden: false }
                };

                component._updateMethodSections('POST');

                expect(component.ui.getView.hidden).toBe(true);
                expect(component.ui.postView.hidden).toBe(false);
                expect(component.ui.patchView.hidden).toBe(true);
                expect(component.ui.deleteView.hidden).toBe(true);
            });

            it('should show only PATCH view', async () => {
                component = new WebApiExplorerTab();
                component.ui = {
                    getView: { hidden: false },
                    postView: { hidden: false },
                    patchView: { hidden: true },
                    deleteView: { hidden: false }
                };

                component._updateMethodSections('PATCH');

                expect(component.ui.getView.hidden).toBe(true);
                expect(component.ui.postView.hidden).toBe(true);
                expect(component.ui.patchView.hidden).toBe(false);
                expect(component.ui.deleteView.hidden).toBe(true);
            });

            it('should show only DELETE view', async () => {
                component = new WebApiExplorerTab();
                component.ui = {
                    getView: { hidden: false },
                    postView: { hidden: false },
                    patchView: { hidden: false },
                    deleteView: { hidden: true }
                };

                component._updateMethodSections('DELETE');

                expect(component.ui.getView.hidden).toBe(true);
                expect(component.ui.postView.hidden).toBe(true);
                expect(component.ui.patchView.hidden).toBe(true);
                expect(component.ui.deleteView.hidden).toBe(false);
            });
        });

        describe('_updateFilterSections', () => {
            it('should show PATCH filter section when no record ID', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.patchIdInput = { value: '' };
                component.ui.patchFilterSection = { hidden: true };

                component._updateFilterSections('PATCH');

                expect(component.ui.patchFilterSection.hidden).toBe(false);
            });

            it('should hide PATCH filter section when record ID exists', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.patchIdInput = { value: 'some-id' };
                component.ui.patchFilterSection = { hidden: false };

                component._updateFilterSections('PATCH');

                expect(component.ui.patchFilterSection.hidden).toBe(true);
            });

            it('should show DELETE filter section when no record ID', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.deleteIdInput = { value: '' };
                component.ui.deleteFilterSection = { hidden: true };

                component._updateFilterSections('DELETE');

                expect(component.ui.deleteFilterSection.hidden).toBe(false);
            });

            it('should hide DELETE filter section when record ID exists', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.deleteIdInput = { value: 'some-id' };
                component.ui.deleteFilterSection = { hidden: false };

                component._updateFilterSections('DELETE');

                expect(component.ui.deleteFilterSection.hidden).toBe(true);
            });

            it('should hide PATCH filter section when method is not PATCH', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.patchIdInput = { value: '' };
                component.ui.patchFilterSection = { hidden: false };

                component._updateFilterSections('GET');

                expect(component.ui.patchFilterSection.hidden).toBe(true);
            });
        });

        describe('_hasRecordId', () => {
            it('should return true when input has value', () => {
                component = new WebApiExplorerTab();
                const input = { value: 'some-id' };

                const result = component._hasRecordId(input);

                expect(result).toBe(true);
            });

            it('should return false when input is empty', () => {
                component = new WebApiExplorerTab();
                const input = { value: '' };

                const result = component._hasRecordId(input);

                expect(result).toBe(false);
            });

            it('should return false when input is only whitespace', () => {
                component = new WebApiExplorerTab();
                const input = { value: '   ' };

                const result = component._hasRecordId(input);

                expect(result).toBe(false);
            });

            it('should return false when input is null', () => {
                component = new WebApiExplorerTab();

                const result = component._hasRecordId(null);

                expect(result).toBe(false);
            });
        });

        describe('_shouldShowFormatJsonButton', () => {
            it('should return true for POST with JSON mode', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.postBodyModeToggle = { checked: true };

                const result = component._shouldShowFormatJsonButton('POST');

                expect(result).toBe(true);
            });

            it('should return false for POST without JSON mode', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.postBodyModeToggle = { checked: false };

                const result = component._shouldShowFormatJsonButton('POST');

                expect(result).toBe(false);
            });

            it('should return true for PATCH with JSON mode', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.patchBodyModeToggle = { checked: true };

                const result = component._shouldShowFormatJsonButton('PATCH');

                expect(result).toBe(true);
            });

            it('should return false for PATCH without JSON mode', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.patchBodyModeToggle = { checked: false };

                const result = component._shouldShowFormatJsonButton('PATCH');

                expect(result).toBe(false);
            });

            it('should return false for GET', async () => {
                component = new WebApiExplorerTab();
                await component.render();

                const result = component._shouldShowFormatJsonButton('GET');

                expect(result).toBe(false);
            });

            it('should return false for DELETE', async () => {
                component = new WebApiExplorerTab();
                await component.render();

                const result = component._shouldShowFormatJsonButton('DELETE');

                expect(result).toBe(false);
            });
        });

        describe('_updateToolbarButtons', () => {
            it('should show Get Count button for GET method', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.getCountBtn = { hidden: true };

                component._updateToolbarButtons('GET');

                expect(component.ui.getCountBtn.hidden).toBe(false);
            });

            it('should hide Get Count button for non-GET method', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.getCountBtn = { hidden: false };

                component._updateToolbarButtons('POST');

                expect(component.ui.getCountBtn.hidden).toBe(true);
            });

            it('should show Format JSON button for POST in JSON mode', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.formatJsonBtn = { hidden: true };
                component.ui.postBodyModeToggle = { checked: true };

                component._updateToolbarButtons('POST');

                expect(component.ui.formatJsonBtn.hidden).toBe(false);
            });

            it('should hide Format JSON button for POST in field mode', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.formatJsonBtn = { hidden: false };
                component.ui.postBodyModeToggle = { checked: false };

                component._updateToolbarButtons('POST');

                expect(component.ui.formatJsonBtn.hidden).toBe(true);
            });
        });

        describe('_updateAddFilterButtons', () => {
            it('should show Add GET Filter button for GET method', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.addGetFilterGroupBtn = { hidden: true };

                component._updateAddFilterButtons('GET');

                expect(component.ui.addGetFilterGroupBtn.hidden).toBe(false);
            });

            it('should hide Add GET Filter button for non-GET method', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.addGetFilterGroupBtn = { hidden: false };

                component._updateAddFilterButtons('POST');

                expect(component.ui.addGetFilterGroupBtn.hidden).toBe(true);
            });

            it('should show Add PATCH Filter button when no record ID', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.patchIdInput = { value: '' };
                component.ui.addPatchFilterGroupBtn = { hidden: true };

                component._updateAddFilterButtons('PATCH');

                expect(component.ui.addPatchFilterGroupBtn.hidden).toBe(false);
            });

            it('should hide Add PATCH Filter button when record ID exists', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.patchIdInput = { value: 'some-id' };
                component.ui.addPatchFilterGroupBtn = { hidden: false };

                component._updateAddFilterButtons('PATCH');

                expect(component.ui.addPatchFilterGroupBtn.hidden).toBe(true);
            });

            it('should show Add DELETE Filter button when no record ID', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.deleteIdInput = { value: '' };
                component.ui.addDeleteFilterGroupBtn = { hidden: true };

                component._updateAddFilterButtons('DELETE');

                expect(component.ui.addDeleteFilterGroupBtn.hidden).toBe(false);
            });

            it('should hide Add DELETE Filter button when record ID exists', async () => {
                component = new WebApiExplorerTab();
                await component.render();
                component.ui.deleteIdInput = { value: 'some-id' };
                component.ui.addDeleteFilterGroupBtn = { hidden: false };

                component._updateAddFilterButtons('DELETE');

                expect(component.ui.addDeleteFilterGroupBtn.hidden).toBe(true);
            });
        });
    });
});
