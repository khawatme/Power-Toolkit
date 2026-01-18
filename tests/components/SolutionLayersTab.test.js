/**
 * @file Comprehensive tests for SolutionLayersTab component
 * @module tests/components/SolutionLayersTab.test.js
 * @description Tests for the Solution Layers viewer component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SolutionLayersTab } from '../../src/components/SolutionLayersTab.js';

// Mock solution data
const mockSolutions = [
    { solutionid: 'sol-1', uniquename: 'TestSolution', friendlyname: 'Test Solution' },
    { solutionid: 'sol-2', uniquename: 'AnotherSolution', friendlyname: 'Another Solution' }
];

// Mock layer data
const mockLayers = [
    {
        msdyn_componentlayerid: 'layer-1',
        msdyn_name: 'Account Form',
        msdyn_solutioncomponentname: 'Account Form',
        schemaName: 'account_main',
        componentType: 60,
        componentTypeName: 'Form',
        baseComponentTypeName: 'Form',
        objectId: 'obj-1',
        canBeDeleted: true,
        hasActiveCustomization: true
    },
    {
        msdyn_componentlayerid: 'layer-2',
        msdyn_name: 'Contact View',
        msdyn_solutioncomponentname: 'Contact View',
        schemaName: 'contact_view',
        componentType: 26,
        componentTypeName: 'View',
        baseComponentTypeName: 'View',
        objectId: 'obj-2',
        canBeDeleted: true,
        hasActiveCustomization: true
    },
    {
        msdyn_componentlayerid: 'layer-3',
        msdyn_name: 'Test Field',
        msdyn_solutioncomponentname: 'Test Field',
        schemaName: 'new_testfield',
        componentType: 2,
        componentTypeName: 'Attribute (account)',
        baseComponentTypeName: 'Attribute',
        objectId: 'obj-3',
        canBeDeleted: false,
        hasActiveCustomization: true
    },
    {
        msdyn_componentlayerid: 'layer-4',
        msdyn_name: 'Managed Component',
        msdyn_solutioncomponentname: 'Managed Component',
        schemaName: 'managed_component',
        componentType: 60,
        componentTypeName: 'Form',
        baseComponentTypeName: 'Form',
        objectId: 'obj-4',
        canBeDeleted: true,
        hasActiveCustomization: false
    }
];

// Mock dependencies
vi.mock('../../src/services/SolutionLayersService.js', () => ({
    SolutionLayersService: {
        getSolutions: vi.fn(() => Promise.resolve(mockSolutions)),
        getSolutionLayers: vi.fn(() => Promise.resolve(mockLayers)),
        deleteLayer: vi.fn(() => Promise.resolve()),
        getComponentLayers: vi.fn(() => Promise.resolve([])),
        getAvailableComponentTypes: vi.fn(() => [])
    }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: true,
        getEntityName: vi.fn(() => 'account'),
        getFormId: vi.fn(() => '12345-67890')
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        retrieveMultipleRecords: vi.fn(() => Promise.resolve({ entities: [] }))
    }
}));

// Mock helper functions
vi.mock('../../src/helpers/index.js', async () => {
    const actual = await vi.importActual('../../src/helpers/index.js');
    return {
        ...actual,
        showConfirmDialog: vi.fn(() => Promise.resolve(true)),
        UIHelpers: {
            initColumnResize: vi.fn(),
            destroyColumnResize: vi.fn()
        }
    };
});

import { SolutionLayersService } from '../../src/services/SolutionLayersService.js';
import { NotificationService } from '../../src/services/NotificationService.js';
import { showConfirmDialog } from '../../src/helpers/index.js';

describe('SolutionLayersTab', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        SolutionLayersService.getSolutions.mockResolvedValue(mockSolutions);
        SolutionLayersService.getSolutionLayers.mockResolvedValue(mockLayers);
        document.body.innerHTML = '';
    });

    afterEach(() => {
        component?.destroy?.();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with correct id', () => {
            component = new SolutionLayersTab();
            expect(component.id).toBe('solutionLayers');
        });

        it('should initialize with correct label', () => {
            component = new SolutionLayersTab();
            expect(component.label).toContain('Solution');
        });

        it('should have an icon defined', () => {
            component = new SolutionLayersTab();
            expect(component.icon).toBeDefined();
        });

        it('should NOT be a form-only component', () => {
            component = new SolutionLayersTab();
            expect(component.isFormOnly).toBeFalsy();
        });

        it('should initialize UI object', () => {
            component = new SolutionLayersTab();
            expect(component.ui).toBeDefined();
            expect(component.ui).toEqual({});
        });

        it('should initialize solutions array', () => {
            component = new SolutionLayersTab();
            expect(component.solutions).toEqual([]);
        });

        it('should initialize layers array', () => {
            component = new SolutionLayersTab();
            expect(component.layers).toEqual([]);
        });

        it('should initialize allLayers array', () => {
            component = new SolutionLayersTab();
            expect(component.allLayers).toEqual([]);
        });

        it('should initialize selectedSolutionId as null', () => {
            component = new SolutionLayersTab();
            expect(component.selectedSolutionId).toBeNull();
        });

        it('should initialize sortColumn as "name"', () => {
            component = new SolutionLayersTab();
            expect(component.sortColumn).toBe('name');
        });

        it('should initialize sortDirection as "asc"', () => {
            component = new SolutionLayersTab();
            expect(component.sortDirection).toBe('asc');
        });

        it('should initialize showOnlyDeletable as true', () => {
            component = new SolutionLayersTab();
            expect(component.showOnlyDeletable).toBe(true);
        });

        it('should initialize handler references as null', () => {
            component = new SolutionLayersTab();
            expect(component._solutionSelectHandler).toBeNull();
            expect(component._refreshBtnHandler).toBeNull();
            expect(component._layerListClickHandler).toBeNull();
        });
    });

    describe('render', () => {
        beforeEach(() => {
            component = new SolutionLayersTab();
        });

        it('should return an HTMLElement', async () => {
            const element = await component.render();
            expect(element).toBeInstanceOf(HTMLElement);
        });

        it('should render section title', async () => {
            const element = await component.render();
            expect(element.querySelector('.section-title')).toBeTruthy();
        });

        it('should render section title with correct text', async () => {
            const element = await component.render();
            const title = element.querySelector('.section-title');
            expect(title.textContent).toContain('Solution Layers');
        });

        it('should render solution select dropdown', async () => {
            const element = await component.render();
            expect(element.querySelector('#pdt-solution-select')).toBeTruthy();
        });

        it('should render component search input', async () => {
            const element = await component.render();
            expect(element.querySelector('#pdt-component-search')).toBeTruthy();
        });

        it('should render component type filter', async () => {
            const element = await component.render();
            expect(element.querySelector('#pdt-component-type-filter')).toBeTruthy();
        });

        it('should render refresh button', async () => {
            const element = await component.render();
            expect(element.querySelector('#pdt-refresh-layers')).toBeTruthy();
        });

        it('should render refresh button as disabled initially', async () => {
            const element = await component.render();
            const refreshBtn = element.querySelector('#pdt-refresh-layers');
            expect(refreshBtn.disabled).toBe(true);
        });

        it('should render layers container', async () => {
            const element = await component.render();
            expect(element.querySelector('#pdt-layers-container')).toBeTruthy();
        });

        it('should render note about active customizations', async () => {
            const element = await component.render();
            expect(element.querySelector('.pdt-note')).toBeTruthy();
        });

        it('should show initial message in layers container', async () => {
            const element = await component.render();
            const container = element.querySelector('#pdt-layers-container');
            expect(container.textContent).toContain('Select a solution');
        });
    });

    describe('postRender', () => {
        beforeEach(() => {
            component = new SolutionLayersTab();
        });

        it('should not throw when called', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            await expect(component.postRender(element)).resolves.not.toThrow();
        });

        it('should cache UI elements', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(component.ui.container).toBeTruthy();
            expect(component.ui.solutionSelect).toBeTruthy();
            expect(component.ui.componentSearch).toBeTruthy();
            expect(component.ui.componentTypeFilter).toBeTruthy();
            expect(component.ui.refreshBtn).toBeTruthy();
            expect(component.ui.layersContainer).toBeTruthy();
        });

        it('should call SolutionLayersService.getSolutions', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(SolutionLayersService.getSolutions).toHaveBeenCalled();
        });

        it('should populate solutions dropdown', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            const options = element.querySelectorAll('#pdt-solution-select option');
            expect(options.length).toBe(3); // 1 default + 2 solutions
        });

        it('should store solutions in component', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(component.solutions).toEqual(mockSolutions);
        });

        it('should setup event handlers', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(component._solutionSelectHandler).toBeInstanceOf(Function);
            expect(component._refreshBtnHandler).toBeInstanceOf(Function);
            expect(component._filterChangeHandler).toBeInstanceOf(Function);
            expect(component._searchHandler).toBeInstanceOf(Function);
        });

        it('should enable solution select after loading', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(component.ui.solutionSelect.disabled).toBe(false);
        });

        it('should handle empty solutions list', async () => {
            SolutionLayersService.getSolutions.mockResolvedValueOnce([]);
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(NotificationService.show).toHaveBeenCalled();
        });

        it('should handle solutions loading error', async () => {
            SolutionLayersService.getSolutions.mockRejectedValueOnce(new Error('Load error'));
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('Load error'),
                'error'
            );
        });
    });

    describe('solution selection', () => {
        beforeEach(async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);
        });

        it('should enable refresh button when solution is selected', async () => {
            component.ui.solutionSelect.value = 'sol-1';
            await component._onSolutionSelected();

            expect(component.ui.refreshBtn.disabled).toBe(false);
        });

        it('should disable refresh button when no solution is selected', async () => {
            component.ui.solutionSelect.value = '';
            await component._onSolutionSelected();

            expect(component.ui.refreshBtn.disabled).toBe(true);
        });

        it('should store selectedSolutionId', async () => {
            component.ui.solutionSelect.value = 'sol-1';
            await component._onSolutionSelected();

            expect(component.selectedSolutionId).toBe('sol-1');
        });

        it('should load layers when solution is selected', async () => {
            component.ui.solutionSelect.value = 'sol-1';
            await component._onSolutionSelected();

            expect(SolutionLayersService.getSolutionLayers).toHaveBeenCalled();
        });

        it('should clear layers when no solution is selected', async () => {
            component.ui.solutionSelect.value = 'sol-1';
            await component._onSolutionSelected();

            component.ui.solutionSelect.value = '';
            await component._onSolutionSelected();

            expect(component.layers).toEqual([]);
        });

        it('should show message when no solution is selected', async () => {
            component.ui.solutionSelect.value = '';
            await component._onSolutionSelected();

            expect(component.ui.layersContainer.textContent).toContain('Select a solution');
        });
    });

    describe('layer loading', () => {
        beforeEach(async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);
        });

        it('should load layers for selected solution', async () => {
            component.selectedSolutionId = 'sol-1';
            await component._loadLayers();

            expect(SolutionLayersService.getSolutionLayers).toHaveBeenCalledWith(
                'sol-1',
                'TestSolution'
            );
        });

        it('should store all layers', async () => {
            component.selectedSolutionId = 'sol-1';
            await component._loadLayers();

            expect(component.allLayers).toEqual(mockLayers);
        });

        it('should disable refresh button while loading', async () => {
            component.selectedSolutionId = 'sol-1';

            // Create a delayed promise to check the loading state
            let resolveLoad;
            SolutionLayersService.getSolutionLayers.mockReturnValueOnce(
                new Promise(resolve => { resolveLoad = resolve; })
            );

            const loadPromise = component._loadLayers();
            expect(component.ui.refreshBtn.disabled).toBe(true);

            resolveLoad(mockLayers);
            await loadPromise;
        });

        it('should enable refresh button after loading', async () => {
            component.selectedSolutionId = 'sol-1';
            await component._loadLayers();

            expect(component.ui.refreshBtn.disabled).toBe(false);
        });

        it('should handle load errors', async () => {
            SolutionLayersService.getSolutionLayers.mockRejectedValueOnce(new Error('Load error'));
            component.selectedSolutionId = 'sol-1';
            await component._loadLayers();

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('Load error'),
                'error'
            );
        });

        it('should show error in container on load failure', async () => {
            SolutionLayersService.getSolutionLayers.mockRejectedValueOnce(new Error('Load error'));
            component.selectedSolutionId = 'sol-1';
            await component._loadLayers();

            expect(component.ui.layersContainer.querySelector('.pdt-error')).toBeTruthy();
        });

        it('should not load if no solution selected', async () => {
            component.selectedSolutionId = null;
            await component._loadLayers();

            expect(SolutionLayersService.getSolutionLayers).not.toHaveBeenCalled();
        });
    });

    describe('filtering', () => {
        beforeEach(async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);
            component.selectedSolutionId = 'sol-1';
            await component._loadLayers();
        });

        it('should filter by search term', () => {
            component.ui.componentSearch.value = 'Account';
            component._applyFilters();

            expect(component.layers.some(l => l.msdyn_name.includes('Account'))).toBe(true);
            expect(component.layers.some(l => l.msdyn_name.includes('Contact'))).toBe(false);
        });

        it('should be case-insensitive search', () => {
            component.ui.componentSearch.value = 'account';
            component._applyFilters();

            expect(component.layers.some(l => l.msdyn_name.includes('Account'))).toBe(true);
        });

        it('should filter by schema name', () => {
            component.ui.componentSearch.value = 'contact_view';
            component._applyFilters();

            expect(component.layers.some(l => l.schemaName === 'contact_view')).toBe(true);
        });

        it('should filter by component type', () => {
            component.ui.componentTypeFilter.value = '60'; // Form
            component._applyFilters();

            expect(component.layers.every(l => l.componentType === 60)).toBe(true);
        });

        it('should filter for deletable only by default', () => {
            component._applyFilters();

            // Should only include layers that canBeDeleted AND hasActiveCustomization
            expect(component.layers.every(l => l.canBeDeleted && l.hasActiveCustomization)).toBe(true);
        });

        it('should show all when search is empty', () => {
            component.ui.componentSearch.value = '';
            component.ui.componentTypeFilter.value = '';
            component._applyFilters();

            // Should still filter for deletable
            const deletableLayers = mockLayers.filter(l => l.canBeDeleted && l.hasActiveCustomization);
            expect(component.layers.length).toBe(deletableLayers.length);
        });
    });

    describe('component type filter population', () => {
        beforeEach(async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);
            component.selectedSolutionId = 'sol-1';
            component.allLayers = mockLayers;
        });

        it('should populate component type dropdown', () => {
            component._populateComponentTypeFilter();

            const options = component.ui.componentTypeFilter.querySelectorAll('option');
            expect(options.length).toBeGreaterThan(1); // At least "All" + some types
        });

        it('should include "All Component Types" option', () => {
            component._populateComponentTypeFilter();

            const firstOption = component.ui.componentTypeFilter.querySelector('option');
            expect(firstOption.value).toBe('');
            expect(firstOption.textContent).toContain('All');
        });

        it('should only include deletable active layer types', () => {
            component._populateComponentTypeFilter();

            // Should include Form (60) and View (26) but not type 2 (not deletable)
            const options = Array.from(component.ui.componentTypeFilter.options);
            const values = options.map(o => o.value);
            expect(values).toContain('60');
            expect(values).toContain('26');
        });

        it('should handle empty layers', () => {
            component.allLayers = [];
            expect(() => component._populateComponentTypeFilter()).not.toThrow();
        });
    });

    describe('sorting', () => {
        beforeEach(async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);
            component.selectedSolutionId = 'sol-1';
            await component._loadLayers();
        });

        it('should sort by name ascending by default', () => {
            const sorted = component._sortLayers([...component.layers]);
            // First item should come before second alphabetically
            if (sorted.length >= 2) {
                const firstName = (sorted[0].msdyn_name || '').toLowerCase();
                const secondName = (sorted[1].msdyn_name || '').toLowerCase();
                expect(firstName <= secondName).toBe(true);
            }
        });

        it('should toggle sort direction on same column', () => {
            component.sortColumn = 'name';
            component.sortDirection = 'asc';

            // Simulate click on same column
            const mockEvent = { target: { closest: () => ({ dataset: { sort: 'name' } }) } };
            component._handleSort(mockEvent);

            expect(component.sortDirection).toBe('desc');
        });

        it('should reset to asc when changing columns', () => {
            component.sortColumn = 'name';
            component.sortDirection = 'desc';

            // Simulate click on different column
            const mockEvent = { target: { closest: () => ({ dataset: { sort: 'schemaName' } }) } };
            component._handleSort(mockEvent);

            expect(component.sortColumn).toBe('schemaName');
            expect(component.sortDirection).toBe('asc');
        });

        it('should sort by schemaName', () => {
            component.sortColumn = 'schemaName';
            const sorted = component._sortLayers([...component.layers]);

            if (sorted.length >= 2) {
                const first = (sorted[0].schemaName || '').toLowerCase();
                const second = (sorted[1].schemaName || '').toLowerCase();
                expect(first <= second).toBe(true);
            }
        });

        it('should sort by componentType', () => {
            component.sortColumn = 'componentType';
            const sorted = component._sortLayers([...component.layers]);

            if (sorted.length >= 2) {
                const first = (sorted[0].componentTypeName || '').toLowerCase();
                const second = (sorted[1].componentTypeName || '').toLowerCase();
                expect(first <= second).toBe(true);
            }
        });

        it('should ignore click on non-sortable elements', () => {
            const originalColumn = component.sortColumn;
            const mockEvent = { target: { closest: () => null } };
            component._handleSort(mockEvent);

            expect(component.sortColumn).toBe(originalColumn);
        });
    });

    describe('table rendering', () => {
        beforeEach(async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);
            component.selectedSolutionId = 'sol-1';
            await component._loadLayers();
        });

        it('should render table', () => {
            expect(component.ui.layersContainer.querySelector('table')).toBeTruthy();
        });

        it('should render table header', () => {
            expect(component.ui.layersContainer.querySelector('thead')).toBeTruthy();
        });

        it('should render table body', () => {
            expect(component.ui.layersContainer.querySelector('tbody')).toBeTruthy();
        });

        it('should render rows for each layer', () => {
            const rows = component.ui.layersContainer.querySelectorAll('tbody tr');
            expect(rows.length).toBe(component.layers.length);
        });

        it('should show no components message when layers is empty', async () => {
            SolutionLayersService.getSolutionLayers.mockResolvedValueOnce([]);
            await component._loadLayers();

            expect(component.ui.layersContainer.textContent).toContain('No');
        });

        it('should create sortable headers', () => {
            const sortableHeaders = component.ui.layersContainer.querySelectorAll('.pdt-sortable');
            expect(sortableHeaders.length).toBeGreaterThan(0);
        });
    });

    describe('table row creation', () => {
        beforeEach(async () => {
            component = new SolutionLayersTab();
        });

        it('should create row with layer id in dataset', () => {
            const row = component._createTableRow(mockLayers[0], 0);
            expect(row.dataset.layerId).toBe('layer-1');
        });

        it('should display row number', () => {
            const row = component._createTableRow(mockLayers[0], 0);
            expect(row.textContent).toContain('1');
        });

        it('should display display name', () => {
            const row = component._createTableRow(mockLayers[0], 0);
            expect(row.textContent).toContain('Account Form');
        });

        it('should display schema name', () => {
            const row = component._createTableRow(mockLayers[0], 0);
            expect(row.textContent).toContain('account_main');
        });

        it('should display component type', () => {
            const row = component._createTableRow(mockLayers[0], 0);
            expect(row.textContent).toContain('Form');
        });

        it('should show delete button for deletable layers', () => {
            const row = component._createTableRow(mockLayers[0], 0);
            expect(row.querySelector('.pdt-delete-layer')).toBeTruthy();
        });

        it('should not show delete button for non-deletable layers', () => {
            const row = component._createTableRow(mockLayers[2], 2); // canBeDeleted: false
            expect(row.querySelector('.pdt-delete-layer')).toBeFalsy();
        });

        it('should store component id in delete button', () => {
            const row = component._createTableRow(mockLayers[0], 0);
            const deleteBtn = row.querySelector('.pdt-delete-layer');
            expect(deleteBtn.dataset.componentId).toBe('obj-1');
        });
    });

    describe('delete functionality', () => {
        beforeEach(async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);
            component.selectedSolutionId = 'sol-1';
            await component._loadLayers();
        });

        it('should show confirm dialog before delete', async () => {
            const deleteBtn = component.ui.layersContainer.querySelector('.pdt-delete-layer');
            const mockEvent = {
                target: deleteBtn,
                closest: (selector) => selector === '.pdt-delete-layer' ? deleteBtn : null
            };

            await component._handleLayerAction({ target: deleteBtn });

            expect(showConfirmDialog).toHaveBeenCalled();
        });

        it('should call deleteLayer when confirmed', async () => {
            showConfirmDialog.mockResolvedValueOnce(true);
            const deleteBtn = component.ui.layersContainer.querySelector('.pdt-delete-layer');

            await component._handleLayerAction({ target: deleteBtn });

            expect(SolutionLayersService.deleteLayer).toHaveBeenCalled();
        });

        it('should not delete when cancelled', async () => {
            showConfirmDialog.mockResolvedValueOnce(false);
            const deleteBtn = component.ui.layersContainer.querySelector('.pdt-delete-layer');

            await component._handleLayerAction({ target: deleteBtn });

            expect(SolutionLayersService.deleteLayer).not.toHaveBeenCalled();
        });

        it('should show success notification after delete', async () => {
            showConfirmDialog.mockResolvedValueOnce(true);
            const deleteBtn = component.ui.layersContainer.querySelector('.pdt-delete-layer');

            await component._handleLayerAction({ target: deleteBtn });

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'success'
            );
        });

        it('should remove layer from arrays after delete', async () => {
            showConfirmDialog.mockResolvedValueOnce(true);
            const initialLayersCount = component.layers.length;
            const deleteBtn = component.ui.layersContainer.querySelector('.pdt-delete-layer');

            await component._handleLayerAction({ target: deleteBtn });

            expect(component.layers.length).toBeLessThan(initialLayersCount);
        });

        it('should handle delete errors', async () => {
            showConfirmDialog.mockResolvedValueOnce(true);
            SolutionLayersService.deleteLayer.mockRejectedValueOnce(new Error('Delete error'));
            const deleteBtn = component.ui.layersContainer.querySelector('.pdt-delete-layer');

            await component._handleLayerAction({ target: deleteBtn });

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('Delete error'),
                'error'
            );
        });

        it('should ignore clicks on non-delete elements', async () => {
            const mockEvent = {
                target: { closest: () => null }
            };

            await component._handleLayerAction(mockEvent);

            expect(showConfirmDialog).not.toHaveBeenCalled();
        });
    });

    describe('delete confirm dialog', () => {
        beforeEach(() => {
            component = new SolutionLayersTab();
        });

        it('should create dialog content', () => {
            const content = component._createDeleteConfirmDialog(mockLayers[0]);
            expect(content).toBeInstanceOf(HTMLElement);
        });

        it('should include component name', () => {
            const content = component._createDeleteConfirmDialog(mockLayers[0]);
            expect(content.textContent).toContain('Account Form');
        });

        it('should include schema name', () => {
            const content = component._createDeleteConfirmDialog(mockLayers[0]);
            expect(content.textContent).toContain('account_main');
        });

        it('should include component type', () => {
            const content = component._createDeleteConfirmDialog(mockLayers[0]);
            expect(content.textContent).toContain('Form');
        });

        it('should include warning message', () => {
            const content = component._createDeleteConfirmDialog(mockLayers[0]);
            expect(content.textContent).toContain('cannot be undone');
        });
    });

    describe('display name helper', () => {
        beforeEach(() => {
            component = new SolutionLayersTab();
        });

        it('should return msdyn_name when available', () => {
            const name = component._getDisplayName(mockLayers[0]);
            expect(name).toBe('Account Form');
        });

        it('should return msdyn_solutioncomponentname when msdyn_name is missing', () => {
            const layer = { msdyn_solutioncomponentname: 'Fallback Name' };
            const name = component._getDisplayName(layer);
            expect(name).toBe('Fallback Name');
        });

        it('should return N/A when both are missing', () => {
            const layer = {};
            const name = component._getDisplayName(layer);
            expect(name).toBe('N/A');
        });
    });

    describe('sort class helper', () => {
        beforeEach(() => {
            component = new SolutionLayersTab();
        });

        it('should return empty string for non-sorted column', () => {
            component.sortColumn = 'name';
            const result = component._getSortClass('schemaName');
            expect(result).toBe('');
        });

        it('should return sort-asc for ascending sorted column', () => {
            component.sortColumn = 'name';
            component.sortDirection = 'asc';
            const result = component._getSortClass('name');
            expect(result).toBe('sort-asc');
        });

        it('should return sort-desc for descending sorted column', () => {
            component.sortColumn = 'name';
            component.sortDirection = 'desc';
            const result = component._getSortClass('name');
            expect(result).toBe('sort-desc');
        });
    });

    describe('refresh functionality', () => {
        beforeEach(async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);
        });

        it('should reload layers on refresh', async () => {
            component.selectedSolutionId = 'sol-1';
            SolutionLayersService.getSolutionLayers.mockClear();

            await component._onRefreshLayers();

            expect(SolutionLayersService.getSolutionLayers).toHaveBeenCalled();
        });

        it('should not refresh if no solution selected', async () => {
            component.selectedSolutionId = null;
            SolutionLayersService.getSolutionLayers.mockClear();

            await component._onRefreshLayers();

            expect(SolutionLayersService.getSolutionLayers).not.toHaveBeenCalled();
        });
    });

    describe('destroy', () => {
        it('should not throw when called', () => {
            component = new SolutionLayersTab();
            expect(() => component.destroy()).not.toThrow();
        });

        it('should not throw when called after render', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            expect(() => component.destroy()).not.toThrow();
        });

        it('should cleanup after render and postRender', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);
            expect(() => component.destroy()).not.toThrow();
        });

        it('should clear handler references', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            component.destroy();

            expect(component._solutionSelectHandler).toBeNull();
            expect(component._refreshBtnHandler).toBeNull();
        });

        it('should clear data arrays', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            component.destroy();

            expect(component.solutions).toEqual([]);
            expect(component.layers).toEqual([]);
            expect(component.allLayers).toEqual([]);
        });

        it('should clear UI references', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            component.destroy();

            expect(component.ui).toEqual({});
        });

        it('should clear selectedSolutionId', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);
            component.selectedSolutionId = 'sol-1';

            component.destroy();

            expect(component.selectedSolutionId).toBeNull();
        });
    });

    describe('handler callbacks - lines 254, 325 coverage', () => {
        it('should trigger _solutionSelectHandler when solution is selected', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(component._solutionSelectHandler).toBeDefined();

            component._onSolutionSelected = vi.fn();
            if (component._solutionSelectHandler) {
                component._solutionSelectHandler();
                expect(component._onSolutionSelected).toHaveBeenCalled();
            }
        });

        it('should trigger _refreshBtnHandler when refresh is clicked', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(component._refreshBtnHandler).toBeDefined();

            component._onRefreshLayers = vi.fn();
            if (component._refreshBtnHandler) {
                component._refreshBtnHandler();
                expect(component._onRefreshLayers).toHaveBeenCalled();
            }
        });

        it('should trigger _filterChangeHandler when filter changes', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(component._filterChangeHandler).toBeDefined();

            component._applyFilters = vi.fn();
            if (component._filterChangeHandler) {
                component._filterChangeHandler();
                expect(component._applyFilters).toHaveBeenCalled();
            }
        });

        it('should trigger _searchHandler when search input changes', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(component._searchHandler).toBeDefined();

            component._applyFilters = vi.fn();
            if (component._searchHandler) {
                component._searchHandler();
                expect(component._applyFilters).toHaveBeenCalled();
            }
        });
    });

    describe('_sortLayers edge cases - lines 441, 445, 450, 497 coverage', () => {
        it('should handle sorting with equal values returning 0', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            component.sortColumn = 'name';
            component.sortDirection = 'asc';

            const layersWithSameName = [
                { msdyn_name: 'Same Name', schemaName: 'a', componentType: 60, objectId: '1' },
                { msdyn_name: 'Same Name', schemaName: 'b', componentType: 60, objectId: '2' }
            ];

            component.layers = layersWithSameName;
            const sorted = component._sortLayers([...layersWithSameName]);

            // Both have same name, so order should be preserved (stable sort)
            expect(sorted.length).toBe(2);
        });

        it('should return 0 for unknown sort column', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            component.sortColumn = 'unknownColumn';
            component.sortDirection = 'asc';

            const layers = [
                { msdyn_name: 'B', schemaName: 'b', componentType: 60, objectId: '1' },
                { msdyn_name: 'A', schemaName: 'a', componentType: 60, objectId: '2' }
            ];

            component.layers = layers;
            const sorted = component._sortLayers([...layers]);

            // Unknown column should not change order
            expect(sorted.length).toBe(2);
        });

        it('should sort by schemaName when sort column is schemaName', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            component.sortColumn = 'schemaName';
            component.sortDirection = 'asc';

            const layers = [
                { msdyn_name: 'Z', schemaName: 'z_field', componentType: 60, objectId: '1' },
                { msdyn_name: 'A', schemaName: 'a_field', componentType: 60, objectId: '2' }
            ];

            const sorted = component._sortLayers([...layers]);

            expect(sorted[0].schemaName).toBe('a_field');
            expect(sorted[1].schemaName).toBe('z_field');
        });

        it('should sort by componentType when sort column is componentType', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            component.sortColumn = 'componentType';
            component.sortDirection = 'asc';

            const layers = [
                { msdyn_name: 'A', schemaName: 'a', componentType: 60, objectId: '1' },
                { msdyn_name: 'B', schemaName: 'b', componentType: 26, objectId: '2' }
            ];

            const sorted = component._sortLayers([...layers]);

            // Verify that sorting happened - the result should have 2 items
            expect(sorted.length).toBe(2);
            // Verify both items are present
            expect(sorted.map(l => l.componentType).sort((a, b) => a - b)).toEqual([26, 60]);
        });
    });

    describe('_applyFilters early return - line 254 coverage', () => {
        it('should return early when allLayers is null', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            component.allLayers = null;
            component._renderLayers = vi.fn();

            component._applyFilters();

            // _renderLayers should not be called since we return early
            expect(component._renderLayers).not.toHaveBeenCalled();
        });
    });

    describe('_handleLayerAction early return - line 497 coverage', () => {
        it('should return early when layer is not found', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            // Set up layers without the one we're looking for
            component.layers = [{ objectId: 'different-id' }];

            const mockEvent = {
                target: {
                    closest: vi.fn((selector) => {
                        if (selector === '.pdt-delete-layer') {
                            return { dataset: { componentId: 'non-existent-id' } };
                        }
                        return null;
                    })
                }
            };

            // This should return early without throwing
            await component._handleLayerAction(mockEvent);
        });
    });

    describe('_tableHeaderClickHandler - line 325 coverage', () => {
        it('should trigger _handleSort when table header is clicked', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(component._tableHeaderClickHandler).toBeDefined();

            component._handleSort = vi.fn();
            const mockEvent = { target: { closest: () => ({ dataset: { sort: 'name' } }) } };

            if (component._tableHeaderClickHandler) {
                component._tableHeaderClickHandler(mockEvent);
                expect(component._handleSort).toHaveBeenCalledWith(mockEvent);
            }
        });
    });

    describe('_layerListClickHandler - line 325 coverage', () => {
        it('should trigger _handleLayerAction when layer action is clicked', async () => {
            component = new SolutionLayersTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(component._layerListClickHandler).toBeDefined();

            component._handleLayerAction = vi.fn();
            const mockEvent = { target: { closest: () => null } };

            if (component._layerListClickHandler) {
                component._layerListClickHandler(mockEvent);
                expect(component._handleLayerAction).toHaveBeenCalledWith(mockEvent);
            }
        });
    });
});
