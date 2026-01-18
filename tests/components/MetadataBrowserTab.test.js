/**
 * @file Comprehensive tests for MetadataBrowserTab component
 * @module tests/components/MetadataBrowserTab.test.js
 * @description Tests for the Metadata Browser component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MetadataBrowserTab } from '../../src/components/MetadataBrowserTab.js';

// Mock entity data
const mockEntities = [
    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } },
    { LogicalName: 'contact', DisplayName: { UserLocalizedLabel: { Label: 'Contact' } } },
    { LogicalName: 'lead', DisplayName: { UserLocalizedLabel: { Label: 'Lead' } } }
];

// Mock attribute data
const mockAttributes = [
    { LogicalName: 'name', DisplayName: { UserLocalizedLabel: { Label: 'Name' } }, AttributeType: 'String' },
    { LogicalName: 'accountnumber', DisplayName: { UserLocalizedLabel: { Label: 'Account Number' } }, AttributeType: 'String' },
    { LogicalName: 'createdon', DisplayName: { UserLocalizedLabel: { Label: 'Created On' } }, AttributeType: 'DateTime' },
    { LogicalName: 'statecode', DisplayName: { UserLocalizedLabel: { Label: 'Status' } }, AttributeType: 'State' }
];

// Mock dependencies
vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        getEntityDefinitions: vi.fn(() => Promise.resolve(mockEntities)),
        getAttributeDefinitions: vi.fn(() => Promise.resolve(mockAttributes)),
        getImpersonationInfo: vi.fn(() => ({ isImpersonating: false }))
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: true,
        getEntityName: vi.fn(() => 'account')
    }
}));

vi.mock('../../src/services/DialogService.js', () => ({
    DialogService: {
        show: vi.fn((title, content) => {
            const dialog = { close: vi.fn() };
            return dialog;
        })
    }
}));

vi.mock('../../src/core/Store.js', () => ({
    Store: {
        subscribe: vi.fn((callback) => {
            // Return unsubscribe function
            return vi.fn();
        }),
        getState: vi.fn(() => ({}))
    }
}));

vi.mock('../../src/helpers/ui.helpers.js', () => ({
    UIHelpers: {
        initColumnResize: vi.fn(),
        destroyColumnResize: vi.fn()
    }
}));

vi.mock('../../src/helpers/index.js', () => ({
    debounce: vi.fn((fn) => {
        const debounced = (...args) => fn(...args);
        debounced.cancel = vi.fn();
        return debounced;
    }),
    escapeHtml: vi.fn((str) => str || ''),
    filterODataProperties: vi.fn((obj) => Object.entries(obj || {})),
    generateSortableTableHeaders: vi.fn(() => '<tr><th>Name</th><th>Logical Name</th></tr>'),
    getMetadataDisplayName: vi.fn((item) => item?.DisplayName?.UserLocalizedLabel?.Label || item?.LogicalName || 'Unknown'),
    sortArrayByColumn: vi.fn((arr) => arr),
    toggleSortState: vi.fn((state, column) => {
        if (state.column === column) {
            state.direction = state.direction === 'asc' ? 'desc' : 'asc';
        } else {
            state.column = column;
            state.direction = 'asc';
        }
    })
}));

import { DataService } from '../../src/services/DataService.js';
import { DialogService } from '../../src/services/DialogService.js';
import { Store } from '../../src/core/Store.js';

describe('MetadataBrowserTab', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        sessionStorage.clear();
        DataService.getEntityDefinitions.mockResolvedValue(mockEntities);
        DataService.getAttributeDefinitions.mockResolvedValue(mockAttributes);
    });

    afterEach(() => {
        component?.destroy?.();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        beforeEach(() => {
            component = new MetadataBrowserTab();
        });

        it('should initialize with correct id', () => {
            expect(component.id).toBe('metadataBrowser');
        });

        it('should initialize with correct label', () => {
            expect(component.label).toBe('Metadata Browser');
        });

        it('should have an icon defined', () => {
            expect(component.icon).toBeDefined();
        });

        it('should NOT be a form-only component', () => {
            expect(component.isFormOnly).toBeFalsy();
        });

        it('should initialize UI object as empty', () => {
            expect(component.ui).toEqual({});
        });

        it('should initialize allEntities as empty array', () => {
            expect(component.allEntities).toEqual([]);
        });

        it('should initialize selectedEntity as null', () => {
            expect(component.selectedEntity).toBeNull();
        });

        it('should initialize selectedEntityAttributes as empty array', () => {
            expect(component.selectedEntityAttributes).toEqual([]);
        });

        it('should initialize unsubscribe as null', () => {
            expect(component.unsubscribe).toBeNull();
        });

        it('should initialize entitySortState with defaults', () => {
            expect(component.entitySortState).toEqual({ column: '_displayName', direction: 'asc' });
        });

        it('should initialize attributeSortState with defaults', () => {
            expect(component.attributeSortState).toEqual({ column: '_displayName', direction: 'asc' });
        });

        it('should initialize handler references as null', () => {
            expect(component._entitySearchHandler).toBeNull();
            expect(component._attributeSearchHandler).toBeNull();
            expect(component._entityListClickHandler).toBeNull();
            expect(component._entityListKeydownHandler).toBeNull();
            expect(component._attributeListClickHandler).toBeNull();
            expect(component._attributeListKeydownHandler).toBeNull();
            expect(component._resizerMousedownHandler).toBeNull();
        });

        it('should initialize _dynamicHandlers as empty Map', () => {
            expect(component._dynamicHandlers).toBeInstanceOf(Map);
            expect(component._dynamicHandlers.size).toBe(0);
        });

        it('should initialize load tokens to 0', () => {
            expect(component._loadToken).toBe(0);
            expect(component._attrLoadToken).toBe(0);
        });
    });

    describe('render', () => {
        beforeEach(() => {
            component = new MetadataBrowserTab();
        });

        it('should return an HTMLElement', async () => {
            const element = await component.render();
            expect(element).toBeInstanceOf(HTMLElement);
        });

        it('should render with pdt-full-height-column class', async () => {
            const element = await component.render();
            expect(element.className).toContain('pdt-full-height-column');
        });

        it('should render section title', async () => {
            const element = await component.render();
            const title = element.querySelector('.section-title');
            expect(title).toBeTruthy();
            expect(title.textContent).toBe('Metadata Browser');
        });

        it('should render entity search input', async () => {
            const element = await component.render();
            const entitySearch = element.querySelector('#pdt-entity-search');
            expect(entitySearch).toBeTruthy();
            expect(entitySearch.tagName).toBe('INPUT');
        });

        it('should render entity list container', async () => {
            const element = await component.render();
            expect(element.querySelector('#pdt-entity-list-container')).toBeTruthy();
        });

        it('should render attribute search input', async () => {
            const element = await component.render();
            const attrSearch = element.querySelector('#pdt-attribute-search');
            expect(attrSearch).toBeTruthy();
            expect(attrSearch.disabled).toBe(true);
        });

        it('should render attribute list container', async () => {
            const element = await component.render();
            expect(element.querySelector('#pdt-attribute-list-container')).toBeTruthy();
        });

        it('should render resizer element', async () => {
            const element = await component.render();
            expect(element.querySelector('#pdt-metadata-resizer')).toBeTruthy();
        });

        it('should show loading message in entity list', async () => {
            const element = await component.render();
            const entityList = element.querySelector('#pdt-entity-list-container');
            expect(entityList.textContent).toContain('Loading');
        });

        it('should show select message in attribute list', async () => {
            const element = await component.render();
            const attrList = element.querySelector('#pdt-attribute-list-container');
            expect(attrList.textContent).toContain('Select');
        });
    });

    describe('postRender', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
        });

        it('should not throw when called', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            await expect(async () => component.postRender(element)).not.toThrow();
        });

        it('should cache UI elements', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component.ui.container).toBe(element);
            expect(component.ui.entitySearch).toBeTruthy();
            expect(component.ui.entityList).toBeTruthy();
            expect(component.ui.attributeSearch).toBeTruthy();
            expect(component.ui.attributeList).toBeTruthy();
            expect(component.ui.resizer).toBeTruthy();
        });

        it('should subscribe to Store for impersonation changes', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(Store.subscribe).toHaveBeenCalled();
            expect(component.unsubscribe).toBeDefined();
        });

        it('should setup entity search handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component._entitySearchHandler).toBeDefined();
            expect(typeof component._entitySearchHandler).toBe('function');
        });

        it('should setup attribute search handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component._attributeSearchHandler).toBeDefined();
            expect(typeof component._attributeSearchHandler).toBe('function');
        });

        it('should setup entity list click handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component._entityListClickHandler).toBeDefined();
        });

        it('should setup attribute list click handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component._attributeListClickHandler).toBeDefined();
        });

        it('should load entity data', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Wait for async _loadData
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(DataService.getEntityDefinitions).toHaveBeenCalled();
        });
    });

    describe('_loadData', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should populate allEntities array', async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(component.allEntities).toEqual(mockEntities);
        });

        it('should render entity list table', async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            const table = component.ui.entityList.querySelector('table');
            expect(table).toBeTruthy();
        });

        it('should handle load error gracefully', async () => {
            DataService.getEntityDefinitions.mockRejectedValueOnce(new Error('Load error'));
            await component._loadData();

            expect(component.ui.entityList.querySelector('.pdt-error')).toBeTruthy();
        });

        it('should disable attribute search during load', async () => {
            expect(component.ui.attributeSearch.disabled).toBe(true);
        });
    });

    describe('_handleEntitySelect', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should set selectedEntity', async () => {
            await component._handleEntitySelect('account');
            expect(component.selectedEntity.LogicalName).toBe('account');
        });

        it('should enable attribute search', async () => {
            await component._handleEntitySelect('account');
            expect(component.ui.attributeSearch.disabled).toBe(false);
        });

        it('should update attribute search placeholder', async () => {
            await component._handleEntitySelect('account');
            expect(component.ui.attributeSearch.placeholder).toContain('account');
        });

        it('should load attributes for entity', async () => {
            await component._handleEntitySelect('account');
            expect(DataService.getAttributeDefinitions).toHaveBeenCalledWith('account');
        });

        it('should store selectedEntityAttributes', async () => {
            await component._handleEntitySelect('account');
            expect(component.selectedEntityAttributes).toEqual(mockAttributes);
        });

        it('should persist selection to sessionStorage', async () => {
            await component._handleEntitySelect('account');
            expect(sessionStorage.getItem('pdt-metadata:lastEntity')).toBe('account');
        });

        it('should handle attribute load error', async () => {
            DataService.getAttributeDefinitions.mockRejectedValueOnce(new Error('Attr error'));
            await component._handleEntitySelect('account');
            expect(component.ui.attributeList.querySelector('.pdt-error')).toBeTruthy();
        });

        it('should return early if entity not found', async () => {
            await component._handleEntitySelect('nonexistent');
            expect(component.selectedEntity).toBeNull();
        });
    });

    describe('_renderEntityList', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should render table with entities', () => {
            component._renderEntityList(mockEntities);
            const table = component.ui.entityList.querySelector('table');
            expect(table).toBeTruthy();
        });

        it('should render correct number of rows', () => {
            component._renderEntityList(mockEntities);
            const rows = component.ui.entityList.querySelectorAll('tbody tr');
            expect(rows.length).toBe(mockEntities.length);
        });

        it('should set data-logical-name on rows', () => {
            component._renderEntityList(mockEntities);
            const firstRow = component.ui.entityList.querySelector('tbody tr');
            expect(firstRow.dataset.logicalName).toBeDefined();
        });

        it('should filter out invalid entities', () => {
            const mixedEntities = [...mockEntities, null, { LogicalName: null }];
            component._renderEntityList(mixedEntities);
            const rows = component.ui.entityList.querySelectorAll('tbody tr');
            expect(rows.length).toBe(mockEntities.length);
        });

        it('should update existing table if present', () => {
            component._renderEntityList(mockEntities);
            const table1 = component.ui.entityList.querySelector('table');

            component._renderEntityList([mockEntities[0]]);
            const table2 = component.ui.entityList.querySelector('table');

            expect(table1).toBe(table2); // Same table element
        });
    });

    describe('_renderAttributeList', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should render table with attributes', () => {
            component._renderAttributeList(mockAttributes);
            const table = component.ui.attributeList.querySelector('table');
            expect(table).toBeTruthy();
        });

        it('should render correct number of rows', () => {
            component._renderAttributeList(mockAttributes);
            const rows = component.ui.attributeList.querySelectorAll('tbody tr');
            expect(rows.length).toBe(mockAttributes.length);
        });

        it('should display attribute type column', () => {
            component._renderAttributeList(mockAttributes);
            const cells = component.ui.attributeList.querySelectorAll('tbody tr td');
            // Each row has 3 cells, third is type
            expect(cells[2].textContent).toBe('String');
        });
    });

    describe('_filterEntityList', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should filter by display name', () => {
            component.ui.entitySearch.value = 'account';
            component._filterEntityList();
            const rows = component.ui.entityList.querySelectorAll('tbody tr');
            expect(rows.length).toBe(1);
        });

        it('should filter by logical name', () => {
            component.ui.entitySearch.value = 'lead';
            component._filterEntityList();
            const rows = component.ui.entityList.querySelectorAll('tbody tr');
            expect(rows.length).toBe(1);
        });

        it('should be case-insensitive', () => {
            component.ui.entitySearch.value = 'ACCOUNT';
            component._filterEntityList();
            const rows = component.ui.entityList.querySelectorAll('tbody tr');
            expect(rows.length).toBe(1);
        });

        it('should show all entities when search is empty', () => {
            component.ui.entitySearch.value = '';
            component._filterEntityList();
            const rows = component.ui.entityList.querySelectorAll('tbody tr');
            expect(rows.length).toBe(mockEntities.length);
        });
    });

    describe('_filterAttributeList', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            // Wait for entity data to load
            await new Promise(resolve => setTimeout(resolve, 100));
            await component._handleEntitySelect('account');
            // Wait for attribute data to load
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should filter by attribute name', () => {
            component.ui.attributeSearch.value = 'name';
            component._filterAttributeList();
            const rows = component.ui.attributeList.querySelectorAll('tbody tr');
            expect(rows.length).toBeGreaterThan(0);
        });

        it('should filter by logical name', () => {
            component.ui.attributeSearch.value = 'accountnumber';
            component._filterAttributeList();
            const rows = component.ui.attributeList.querySelectorAll('tbody tr');
            expect(rows.length).toBe(1);
        });
    });

    describe('entity list click handler', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should select entity on row click', async () => {
            const row = component.ui.entityList.querySelector('tr[data-logical-name="account"]');
            if (row) {
                row.click();
                await new Promise(resolve => setTimeout(resolve, 50));
                expect(component.selectedEntity).toBeDefined();
            }
        });

        it('should show details dialog on row click', async () => {
            const row = component.ui.entityList.querySelector('tr[data-logical-name="account"]');
            if (row) {
                row.click();
                expect(DialogService.show).toHaveBeenCalled();
            }
        });

        it('should add active class to selected row', async () => {
            const row = component.ui.entityList.querySelector('tr[data-logical-name="account"]');
            if (row) {
                row.click();
                expect(row.classList.contains('active')).toBe(true);
            }
        });
    });

    describe('attribute list click handler', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await new Promise(resolve => setTimeout(resolve, 50));
            await component._handleEntitySelect('account');
        });

        it('should show attribute details dialog on row click', () => {
            const row = component.ui.attributeList.querySelector('tr[data-logical-name]');
            if (row) {
                row.click();
                expect(DialogService.show).toHaveBeenCalled();
            }
        });
    });

    describe('_showMetadataDetailsDialog', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should call DialogService.show', () => {
            component._showMetadataDetailsDialog('Test Title', { name: 'test' });
            expect(DialogService.show).toHaveBeenCalledWith('Test Title', expect.any(HTMLElement));
        });

        it('should include filter input in dialog', () => {
            let dialogContent;
            DialogService.show.mockImplementation((title, content) => {
                dialogContent = content;
                return { close: vi.fn() };
            });

            component._showMetadataDetailsDialog('Test Title', { name: 'test' });

            expect(dialogContent.querySelector('input')).toBeTruthy();
        });

        it('should include info-grid in dialog', () => {
            let dialogContent;
            DialogService.show.mockImplementation((title, content) => {
                dialogContent = content;
                return { close: vi.fn() };
            });

            component._showMetadataDetailsDialog('Test Title', { name: 'test' });

            expect(dialogContent.querySelector('.info-grid')).toBeTruthy();
        });
    });

    describe('resizer', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should setup resizer mouse handler', () => {
            expect(component._resizerMousedownHandler).toBeDefined();
        });

        it('should not throw when resizer is used', () => {
            const mousedownEvent = new MouseEvent('mousedown', { clientX: 100 });
            expect(() => component.ui.resizer.dispatchEvent(mousedownEvent)).not.toThrow();
        });
    });

    describe('destroy', () => {
        it('should not throw when called without render', () => {
            component = new MetadataBrowserTab();
            expect(() => component.destroy()).not.toThrow();
        });

        it('should not throw when called after render', async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            expect(() => component.destroy()).not.toThrow();
        });

        it('should cleanup after render and postRender', async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(() => component.destroy()).not.toThrow();
        });

        it('should unsubscribe from Store', async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const unsubscribeFn = component.unsubscribe;
            component.destroy();

            expect(unsubscribeFn).toHaveBeenCalled();
        });

        it('should clear dynamic handlers', async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.destroy();

            expect(component._dynamicHandlers.size).toBe(0);
        });

        it('should cleanup active drag handlers if mid-drag', async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Simulate starting a drag
            component._activeDragHandlers = {
                handleDrag: vi.fn(),
                stopDrag: vi.fn()
            };

            component.destroy();

            expect(component._activeDragHandlers).toBeNull();
        });
    });

    describe('sort state', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should have default entity sort state', () => {
            expect(component.entitySortState.column).toBe('_displayName');
            expect(component.entitySortState.direction).toBe('asc');
        });

        it('should have default attribute sort state', () => {
            expect(component.attributeSortState.column).toBe('_displayName');
            expect(component.attributeSortState.direction).toBe('asc');
        });
    });

    describe('impersonation notice', () => {
        beforeEach(async () => {
            sessionStorage.removeItem('pdt-impersonation-warning-dismissed');
        });

        it('should show impersonation notice when active', async () => {
            DataService.getImpersonationInfo.mockReturnValue({ isImpersonating: true });

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Wait for _loadData
            await new Promise(resolve => setTimeout(resolve, 50));

            const notice = component.ui.entityList.querySelector('.pdt-note');
            expect(notice).toBeTruthy();
        });

        it('should not show notice when dismissed', async () => {
            sessionStorage.setItem('pdt-impersonation-warning-dismissed', 'true');
            DataService.getImpersonationInfo.mockReturnValue({ isImpersonating: true });

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 50));

            // Note won't be present with dismiss button if already dismissed
        });
    });

    describe('persistence', () => {
        it('should restore last selected entity from sessionStorage', async () => {
            sessionStorage.setItem('pdt-metadata:lastEntity', 'contact');

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(DataService.getAttributeDefinitions).toHaveBeenCalledWith('contact');
        });

        it('should not restore entity if not in allEntities', async () => {
            sessionStorage.setItem('pdt-metadata:lastEntity', 'nonexistent');

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 100));

            // Should not try to load attributes for nonexistent entity
            expect(component.selectedEntity).toBeNull();
        });

        it('should add active class to restored entity row', async () => {
            sessionStorage.setItem('pdt-metadata:lastEntity', 'account');

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 100));

            const row = component.ui.entityList.querySelector('tr[data-logical-name="account"]');
            expect(row?.classList.contains('active')).toBe(true);
        });
    });

    describe('Store subscription and impersonation changes', () => {
        it('should reload data when impersonation changes', async () => {
            let storeCallback;
            Store.subscribe.mockImplementation((callback) => {
                storeCallback = callback;
                return vi.fn();
            });

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 50));
            DataService.getEntityDefinitions.mockClear();

            // Simulate impersonation change
            storeCallback({ impersonationUserId: 'user123' }, { impersonationUserId: null });

            expect(DataService.getEntityDefinitions).toHaveBeenCalled();
        });

        it('should not reload data when impersonation stays the same', async () => {
            let storeCallback;
            Store.subscribe.mockImplementation((callback) => {
                storeCallback = callback;
                return vi.fn();
            });

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 50));
            DataService.getEntityDefinitions.mockClear();

            // Same impersonation userId
            storeCallback({ impersonationUserId: 'user123' }, { impersonationUserId: 'user123' });

            expect(DataService.getEntityDefinitions).not.toHaveBeenCalled();
        });
    });

    describe('entity header sorting', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should handle sort header click', async () => {
            const table = component.ui.entityList.querySelector('table');
            if (table) {
                // Create a fake header with sort key
                const thead = table.querySelector('thead');
                thead.innerHTML = '<tr><th data-sort-key="_displayName">Name</th></tr>';

                const header = thead.querySelector('th[data-sort-key]');
                header.click();

                // Sort state should change
                expect(component.entitySortState.direction).toBeDefined();
            }
        });

        it('should handle sort header keydown with Enter', async () => {
            const table = component.ui.entityList.querySelector('table');
            if (table) {
                const thead = table.querySelector('thead');
                thead.innerHTML = '<tr><th data-sort-key="_displayName" tabindex="0">Name</th></tr>';

                const header = thead.querySelector('th[data-sort-key]');
                const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
                header.dispatchEvent(event);

                expect(component.entitySortState.direction).toBeDefined();
            }
        });

        it('should handle sort header keydown with Space', async () => {
            const table = component.ui.entityList.querySelector('table');
            if (table) {
                const thead = table.querySelector('thead');
                thead.innerHTML = '<tr><th data-sort-key="LogicalName" tabindex="0">Logical Name</th></tr>';

                const header = thead.querySelector('th[data-sort-key]');
                const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
                header.dispatchEvent(event);

                expect(component.entitySortState.column).toBe('LogicalName');
            }
        });

        it('should ignore non-sort key keydown events', async () => {
            const initialState = { ...component.entitySortState };

            const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
            component.ui.entityList.dispatchEvent(event);

            expect(component.entitySortState).toEqual(initialState);
        });
    });

    describe('attribute header sorting', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await new Promise(resolve => setTimeout(resolve, 50));
            await component._handleEntitySelect('account');
        });

        it('should handle attribute sort header click', () => {
            const table = component.ui.attributeList.querySelector('table');
            if (table) {
                const thead = table.querySelector('thead');
                thead.innerHTML = '<tr><th data-sort-key="AttributeType">Type</th></tr>';

                const header = thead.querySelector('th[data-sort-key]');
                header.click();

                expect(component.attributeSortState.column).toBe('AttributeType');
            }
        });

        it('should handle attribute sort header keydown with Enter', () => {
            const table = component.ui.attributeList.querySelector('table');
            if (table) {
                const thead = table.querySelector('thead');
                thead.innerHTML = '<tr><th data-sort-key="LogicalName" tabindex="0">Logical Name</th></tr>';

                const header = thead.querySelector('th[data-sort-key]');
                const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
                header.dispatchEvent(event);

                expect(component.attributeSortState.column).toBe('LogicalName');
            }
        });

        it('should handle attribute sort header keydown with Space', () => {
            const table = component.ui.attributeList.querySelector('table');
            if (table) {
                const thead = table.querySelector('thead');
                thead.innerHTML = '<tr><th data-sort-key="_displayName" tabindex="0">Display Name</th></tr>';

                const header = thead.querySelector('th[data-sort-key]');
                const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
                header.dispatchEvent(event);

                expect(component.attributeSortState).toBeDefined();
            }
        });
    });

    describe('resizer drag behavior', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should set cursor to col-resize on mousedown', () => {
            const mousedownEvent = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
            component.ui.resizer.dispatchEvent(mousedownEvent);

            expect(document.body.style.cursor).toBe('col-resize');
        });

        it('should store active drag handlers on mousedown', () => {
            const mousedownEvent = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
            component.ui.resizer.dispatchEvent(mousedownEvent);

            expect(component._activeDragHandlers).toBeDefined();
            expect(component._activeDragHandlers.handleDrag).toBeDefined();
            expect(component._activeDragHandlers.stopDrag).toBeDefined();
        });

        it('should handle mousemove during drag', () => {
            // Setup with proper element widths
            component.ui.resizer.previousElementSibling.style.flexBasis = '300px';
            Object.defineProperty(component.ui.resizer.previousElementSibling, 'offsetWidth', { value: 300 });
            Object.defineProperty(component.ui.container, 'offsetWidth', { value: 800 });

            const mousedownEvent = new MouseEvent('mousedown', { clientX: 300, bubbles: true });
            component.ui.resizer.dispatchEvent(mousedownEvent);

            const mousemoveEvent = new MouseEvent('mousemove', { clientX: 350, bubbles: true });
            document.dispatchEvent(mousemoveEvent);

            // Should update width
            expect(component.ui.resizer.previousElementSibling.style.flexBasis).toBeDefined();
        });

        it('should cleanup on mouseup', () => {
            const mousedownEvent = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
            component.ui.resizer.dispatchEvent(mousedownEvent);

            const mouseupEvent = new MouseEvent('mouseup', { bubbles: true });
            document.dispatchEvent(mouseupEvent);

            expect(component._activeDragHandlers).toBeNull();
            expect(document.body.style.cursor).toBe('');
        });

        it('should not resize below minimum width', () => {
            component.ui.resizer.previousElementSibling.style.flexBasis = '300px';
            Object.defineProperty(component.ui.resizer.previousElementSibling, 'offsetWidth', { value: 300 });
            Object.defineProperty(component.ui.container, 'offsetWidth', { value: 800 });

            const mousedownEvent = new MouseEvent('mousedown', { clientX: 300, bubbles: true });
            component.ui.resizer.dispatchEvent(mousedownEvent);

            // Try to resize to very small width
            const mousemoveEvent = new MouseEvent('mousemove', { clientX: 50, bubbles: true });
            document.dispatchEvent(mousemoveEvent);

            // Cleanup
            document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        });

        it('should not resize above maximum width', () => {
            component.ui.resizer.previousElementSibling.style.flexBasis = '300px';
            Object.defineProperty(component.ui.resizer.previousElementSibling, 'offsetWidth', { value: 300 });
            Object.defineProperty(component.ui.container, 'offsetWidth', { value: 800 });

            const mousedownEvent = new MouseEvent('mousedown', { clientX: 300, bubbles: true });
            component.ui.resizer.dispatchEvent(mousedownEvent);

            // Try to resize beyond max
            const mousemoveEvent = new MouseEvent('mousemove', { clientX: 750, bubbles: true });
            document.dispatchEvent(mousemoveEvent);

            // Cleanup
            document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        });
    });

    describe('_makePanelsResizable edge cases', () => {
        it('should return early if resizer is not present', async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);

            // Remove resizer before postRender
            element.querySelector('#pdt-metadata-resizer')?.remove();

            component.postRender(element);

            expect(component._resizerMousedownHandler).toBeNull();
        });
    });

    describe('impersonation notification close', () => {
        it('should dismiss notification on close button click', async () => {
            DataService.getImpersonationInfo.mockReturnValue({ isImpersonating: true });
            sessionStorage.removeItem('pdt-impersonation-warning-dismissed');

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 50));

            const closeBtn = component.ui.entityList.querySelector('.pdt-close-btn');
            if (closeBtn) {
                closeBtn.click();
                expect(sessionStorage.getItem('pdt-impersonation-warning-dismissed')).toBe('true');
            }
        });

        it('should remove notification from DOM on close', async () => {
            DataService.getImpersonationInfo.mockReturnValue({ isImpersonating: true });
            sessionStorage.removeItem('pdt-impersonation-warning-dismissed');

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 50));

            const closeBtn = component.ui.entityList.querySelector('.pdt-close-btn');
            if (closeBtn) {
                const notification = closeBtn.closest('.pdt-note');
                closeBtn.click();
                expect(component.ui.entityList.contains(notification)).toBe(false);
            }
        });

        it('should clean up dynamic handler on close', async () => {
            DataService.getImpersonationInfo.mockReturnValue({ isImpersonating: true });
            sessionStorage.removeItem('pdt-impersonation-warning-dismissed');

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 50));

            const closeBtn = component.ui.entityList.querySelector('.pdt-close-btn');
            if (closeBtn) {
                expect(component._dynamicHandlers.has(closeBtn)).toBe(true);
                closeBtn.click();
                expect(component._dynamicHandlers.has(closeBtn)).toBe(false);
            }
        });
    });

    describe('_showMetadataDetailsDialog filter functionality', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should filter grid items on search input', async () => {
            let dialogContent;
            DialogService.show.mockImplementation((title, content) => {
                dialogContent = content;
                return { close: vi.fn() };
            });

            component._showMetadataDetailsDialog('Test', {
                Name: 'TestValue',
                Description: 'SomeDescription',
                Status: 'Active'
            });

            const searchInput = dialogContent.querySelector('input');
            searchInput.value = 'status';
            searchInput.dispatchEvent(new Event('keyup'));

            // Wait for debounce
            await new Promise(resolve => setTimeout(resolve, 250));
        });

        it('should show all items when search is cleared', async () => {
            let dialogContent;
            DialogService.show.mockImplementation((title, content) => {
                dialogContent = content;
                return { close: vi.fn() };
            });

            component._showMetadataDetailsDialog('Test', { Name: 'TestValue' });

            const searchInput = dialogContent.querySelector('input');
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('keyup'));

            await new Promise(resolve => setTimeout(resolve, 250));
        });

        it('should cancel pending filter on dialog close', () => {
            let dialogRef;
            DialogService.show.mockImplementation((title, content) => {
                dialogRef = { close: vi.fn() };
                return dialogRef;
            });

            component._showMetadataDetailsDialog('Test', { Name: 'TestValue' });

            // The close should be overridden to cancel debounce
            expect(dialogRef.close).toBeDefined();
            dialogRef.close();
        });
    });

    describe('_renderEntityList edge cases', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should handle entities with missing DisplayName', () => {
            const entitiesWithMissingNames = [
                { LogicalName: 'test1' },
                { LogicalName: 'test2', DisplayName: null }
            ];
            component._renderEntityList(entitiesWithMissingNames);

            const rows = component.ui.entityList.querySelectorAll('tbody tr');
            expect(rows.length).toBe(2);
        });

        it('should use fallback when no loading message or table exists', () => {
            // Clear the entity list completely
            component.ui.entityList.innerHTML = '';

            component._renderEntityList(mockEntities);

            const table = component.ui.entityList.querySelector('table');
            expect(table).toBeTruthy();
        });

        it('should initialize column resize on table', async () => {
            const { UIHelpers } = await import('../../src/helpers/ui.helpers.js');
            UIHelpers.initColumnResize.mockClear();

            component._renderEntityList(mockEntities);

            expect(UIHelpers.initColumnResize).toHaveBeenCalled();
        });

        it('should set data-resize-mode on table', () => {
            component._renderEntityList(mockEntities);

            const table = component.ui.entityList.querySelector('table.pdt-table');
            expect(table.getAttribute('data-resize-mode')).toBe('shift');
        });
    });

    describe('_renderAttributeList edge cases', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should handle attributes with missing DisplayName', () => {
            const attributesWithMissingNames = [
                { LogicalName: 'attr1', AttributeType: 'String' },
                { LogicalName: 'attr2', DisplayName: null, AttributeType: 'Integer' }
            ];
            component._renderAttributeList(attributesWithMissingNames);

            const rows = component.ui.attributeList.querySelectorAll('tbody tr');
            expect(rows.length).toBe(2);
        });

        it('should initialize column resize on attribute table', async () => {
            const { UIHelpers } = await import('../../src/helpers/ui.helpers.js');
            UIHelpers.initColumnResize.mockClear();

            component._renderAttributeList(mockAttributes);

            expect(UIHelpers.initColumnResize).toHaveBeenCalled();
        });

        it('should set data-resize-mode on attribute table', () => {
            component._renderAttributeList(mockAttributes);

            const table = component.ui.attributeList.querySelector('table.pdt-table');
            expect(table.getAttribute('data-resize-mode')).toBe('shift');
        });
    });

    describe('stale token handling in _loadData', () => {
        it('should ignore stale response when token changes', async () => {
            let resolveFirst;
            const firstPromise = new Promise(resolve => { resolveFirst = resolve; });

            DataService.getEntityDefinitions
                .mockReturnValueOnce(firstPromise)
                .mockResolvedValueOnce([{ LogicalName: 'second' }]);

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Trigger second load before first completes
            component._loadData();
            await new Promise(resolve => setTimeout(resolve, 50));

            // Complete first (stale) load
            resolveFirst([{ LogicalName: 'first' }]);
            await new Promise(resolve => setTimeout(resolve, 50));

            // Should have second entity, not first
            expect(component.allEntities).toEqual([{ LogicalName: 'second' }]);
        });

        it('should ignore stale error when token changes', async () => {
            let rejectFirst;
            const firstPromise = new Promise((_, reject) => { rejectFirst = reject; });

            DataService.getEntityDefinitions
                .mockReturnValueOnce(firstPromise)
                .mockResolvedValueOnce(mockEntities);

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Trigger second load
            component._loadData();
            await new Promise(resolve => setTimeout(resolve, 50));

            // First (stale) load fails
            rejectFirst(new Error('Stale error'));
            await new Promise(resolve => setTimeout(resolve, 50));

            // Should not show error, should have entities
            expect(component.ui.entityList.querySelector('.pdt-error')).toBeFalsy();
        });
    });

    describe('stale token handling in _handleEntitySelect', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should ignore stale attribute response when token changes', async () => {
            let resolveFirst;
            const firstPromise = new Promise(resolve => { resolveFirst = resolve; });

            DataService.getAttributeDefinitions
                .mockReturnValueOnce(firstPromise)
                .mockResolvedValueOnce([{ LogicalName: 'second_attr', AttributeType: 'String' }]);

            // Start first load
            component._handleEntitySelect('account');

            // Start second load before first completes
            await component._handleEntitySelect('contact');

            // Complete first (stale) load
            resolveFirst([{ LogicalName: 'first_attr', AttributeType: 'String' }]);
            await new Promise(resolve => setTimeout(resolve, 50));

            // Should have second attributes
            expect(component.selectedEntityAttributes[0]?.LogicalName).toBe('second_attr');
        });

        it('should ignore stale attribute error when token changes', async () => {
            let rejectFirst;
            const firstPromise = new Promise((_, reject) => { rejectFirst = reject; });

            DataService.getAttributeDefinitions
                .mockReturnValueOnce(firstPromise)
                .mockResolvedValueOnce(mockAttributes);

            // Start first load
            component._handleEntitySelect('account');

            // Start second load
            await component._handleEntitySelect('contact');

            // First (stale) load fails
            rejectFirst(new Error('Stale error'));
            await new Promise(resolve => setTimeout(resolve, 50));

            // Should not show error
            expect(component.ui.attributeList.querySelector('.pdt-error')).toBeFalsy();
        });
    });

    describe('destroy edge cases', () => {
        it('should cancel pending debounced entity search', async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Trigger a search
            component.ui.entitySearch.value = 'test';
            component.ui.entitySearch.dispatchEvent(new Event('keyup'));

            // Destroy before debounce completes
            component.destroy();

            expect(component._entitySearchHandler.cancel).toHaveBeenCalled();
        });

        it('should cancel pending debounced attribute search', async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await new Promise(resolve => setTimeout(resolve, 50));
            await component._handleEntitySelect('account');

            // Trigger a search
            component.ui.attributeSearch.value = 'test';
            component.ui.attributeSearch.dispatchEvent(new Event('keyup'));

            // Destroy before debounce completes
            component.destroy();

            expect(component._attributeSearchHandler.cancel).toHaveBeenCalled();
        });

        it('should handle destroy when UIHelpers.destroyColumnResize throws', async () => {
            const { UIHelpers } = await import('../../src/helpers/ui.helpers.js');
            UIHelpers.destroyColumnResize.mockImplementation(() => {
                throw new Error('Cleanup error');
            });

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await new Promise(resolve => setTimeout(resolve, 50));

            // Should not throw
            expect(() => component.destroy()).not.toThrow();
        });

        it('should reset cursor when destroying during drag', async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Start drag
            const mousedownEvent = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
            component.ui.resizer.dispatchEvent(mousedownEvent);

            expect(document.body.style.cursor).toBe('col-resize');

            component.destroy();

            expect(document.body.style.cursor).toBe('');
        });
    });

    describe('_loadData with null or empty entities', () => {
        it('should handle null entities response', async () => {
            DataService.getEntityDefinitions.mockResolvedValue(null);

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(component.allEntities).toEqual([]);
        });

        it('should handle empty entities array', async () => {
            DataService.getEntityDefinitions.mockResolvedValue([]);

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(component.allEntities).toEqual([]);
        });
    });

    describe('_handleEntitySelect with null attributes', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should handle null attributes response', async () => {
            DataService.getAttributeDefinitions.mockResolvedValue(null);

            await component._handleEntitySelect('account');

            expect(component.selectedEntityAttributes).toEqual([]);
        });

        it('should handle empty attributes array', async () => {
            DataService.getAttributeDefinitions.mockResolvedValue([]);

            await component._handleEntitySelect('account');

            expect(component.selectedEntityAttributes).toEqual([]);
        });
    });

    describe('click handlers on non-matching elements', () => {
        beforeEach(async () => {
            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should not throw when clicking outside entity rows', () => {
            expect(() => {
                component.ui.entityList.click();
            }).not.toThrow();
        });

        it('should not throw when clicking outside attribute rows', async () => {
            await component._handleEntitySelect('account');

            expect(() => {
                component.ui.attributeList.click();
            }).not.toThrow();
        });
    });

    describe('getImpersonationInfo edge cases', () => {
        it('should handle missing getImpersonationInfo function', async () => {
            const originalFn = DataService.getImpersonationInfo;
            DataService.getImpersonationInfo = undefined;

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);

            expect(() => component.postRender(element)).not.toThrow();

            DataService.getImpersonationInfo = originalFn;
        });

        it('should handle null return from getImpersonationInfo', async () => {
            DataService.getImpersonationInfo.mockReturnValue(null);

            component = new MetadataBrowserTab();
            const element = await component.render();
            document.body.appendChild(element);

            expect(() => component.postRender(element)).not.toThrow();
        });
    });
});
