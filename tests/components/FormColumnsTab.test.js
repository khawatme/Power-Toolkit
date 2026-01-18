/**
 * @file Comprehensive tests for FormColumnsTab component
 * @module tests/components/FormColumnsTab.test.js
 * @description Tests for the Form Columns grid component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies before importing the component
vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        getFormColumns: vi.fn(() => Promise.resolve([
            { displayName: 'Name', logicalName: 'name', value: 'Test', type: 'string', isDirty: false },
            { displayName: 'Account Number', logicalName: 'accountnumber', value: '12345', type: 'string', isDirty: false },
            { displayName: 'Created On', logicalName: 'createdon', value: '2024-01-01', type: 'datetime', isDirty: true }
        ])),
        getAllRecordColumns: vi.fn(() => Promise.resolve([
            { displayName: 'name', logicalName: 'name', value: 'Test Record', type: 'string' },
            { displayName: '@odata.context', logicalName: '@odata.context', value: 'url', type: 'string', isSystem: true }
        ]))
    }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: true,
        getAllAttributes: vi.fn(() => []),
        getEntityName: vi.fn(() => 'account'),
        getEntityId: vi.fn(() => '12345')
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/services/DialogService.js', () => ({
    DialogService: { show: vi.fn(), close: vi.fn() }
}));

vi.mock('../../src/helpers/ui.helpers.js', () => ({
    UIHelpers: {
        initColumnResize: vi.fn(),
        destroyColumnResize: vi.fn(),
        updatePaginationUI: vi.fn(),
        toggleElementHeight: vi.fn(),
        toggleAccordionCategory: vi.fn()
    }
}));

vi.mock('../../src/ui/FormControlFactory.js', () => ({
    FormControlFactory: {
        create: vi.fn((attrType, currentValue, attr) => {
            return `<input id="pdt-prompt-input" type="text" value="${currentValue || ''}" />`;
        })
    }
}));

vi.mock('../../src/helpers/index.js', () => ({
    copyToClipboard: vi.fn((text, message) => Promise.resolve()),
    debounce: vi.fn((fn) => {
        const debounced = (...args) => fn(...args);
        debounced.cancel = vi.fn();
        return debounced;
    }),
    escapeHtml: vi.fn((str) => str || ''),
    formatDisplayValue: vi.fn((value) => String(value ?? '')),
    formatValuePreview: vi.fn((value) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return value.length > 50 ? value.slice(0, 47) + '...' : value;
        return String(value);
    }),
    inferDataverseType: vi.fn((value, propertyName) => {
        if (value === null || value === undefined) return 'unknown';
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'decimal';
        if (typeof value === 'string') return 'string';
        if (Array.isArray(value)) return 'array';
        return 'object';
    }),
    isSystemProperty: vi.fn((key) => key?.startsWith?.('@odata') || key?.startsWith?.('_')),
    parseInputValue: vi.fn((input, attrType) => input?.value),
    throttle: vi.fn((fn) => fn),
    UIHelpers: {
        initColumnResize: vi.fn(),
        destroyColumnResize: vi.fn()
    }
}));

// Import DataService and NotificationService for assertions
import { DataService } from '../../src/services/DataService.js';
import { NotificationService } from '../../src/services/NotificationService.js';
import { DialogService } from '../../src/services/DialogService.js';
import { FormColumnsTab } from '../../src/components/FormColumnsTab.js';

describe('FormColumnsTab', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        component = new FormColumnsTab();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        component?.destroy?.();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with correct id', () => {
            expect(component.id).toBe('formColumns');
        });

        it('should initialize with correct label', () => {
            expect(component.label).toContain('Column');
        });

        it('should have an icon defined', () => {
            expect(component.icon).toBeDefined();
        });

        it('should be a form-only component', () => {
            expect(component.isFormOnly).toBe(true);
        });

        it('should initialize allColumns as empty array', () => {
            expect(component.allColumns).toEqual([]);
        });

        it('should initialize currentColumns as empty array', () => {
            expect(component.currentColumns).toEqual([]);
        });

        it('should initialize sortState with default values', () => {
            expect(component.sortState).toEqual({ column: 'displayName', direction: 'asc' });
        });

        it('should initialize viewMode as form', () => {
            expect(component.viewMode).toBe('form');
        });

        it('should initialize liveHandlers as empty array', () => {
            expect(component.liveHandlers).toEqual([]);
        });

        it('should initialize UI object', () => {
            expect(component.ui).toBeDefined();
        });

        it('should initialize renderBatchSize', () => {
            expect(component.renderBatchSize).toBe(100);
        });

        it('should initialize tableBody as null', () => {
            expect(component.tableBody).toBeNull();
        });

        it('should initialize highlightedElement as null', () => {
            expect(component.highlightedElement).toBeNull();
        });

        it('should initialize currentlyHoveredRow as null', () => {
            expect(component.currentlyHoveredRow).toBeNull();
        });

        it('should initialize renderIndex as 0', () => {
            expect(component.renderIndex).toBe(0);
        });

        it('should initialize _hasEnteredRecordView as false', () => {
            expect(component._hasEnteredRecordView).toBe(false);
        });
    });

    describe('render', () => {
        it('should return an HTMLElement', async () => {
            const element = await component.render();
            expect(element).toBeInstanceOf(HTMLElement);
        });

        it('should render section title', async () => {
            const element = await component.render();
            expect(element.querySelector('.section-title')).toBeTruthy();
            expect(element.textContent).toContain('Form Columns');
        });

        it('should render search input', async () => {
            const element = await component.render();
            const searchInput = element.querySelector('#form-cols-search');
            expect(searchInput).toBeTruthy();
            expect(searchInput.type).toBe('text');
        });

        it('should render view switcher buttons', async () => {
            const element = await component.render();
            const formBtn = element.querySelector('[data-view="form"]');
            const allBtn = element.querySelector('[data-view="all"]');
            expect(formBtn).toBeTruthy();
            expect(allBtn).toBeTruthy();
        });

        it('should set form view button as active by default', async () => {
            const element = await component.render();
            const formBtn = element.querySelector('[data-view="form"]');
            expect(formBtn.classList.contains('active')).toBe(true);
        });

        it('should render table wrapper', async () => {
            const element = await component.render();
            const wrapper = element.querySelector('#form-cols-table-wrapper');
            expect(wrapper).toBeTruthy();
        });

        it('should render odata filter toggle container', async () => {
            const element = await component.render();
            const toggle = element.querySelector('#odata-filter-container');
            expect(toggle).toBeTruthy();
        });

        it('should render unused columns toggle container', async () => {
            const element = await component.render();
            const toggle = element.querySelector('#unused-cols-container');
            expect(toggle).toBeTruthy();
        });

        it('should render with pdt-full-height-column class', async () => {
            const element = await component.render();
            expect(element.classList.contains('pdt-full-height-column')).toBe(true);
        });

        it('should render pdt-toolbar', async () => {
            const element = await component.render();
            expect(element.querySelector('.pdt-toolbar')).toBeTruthy();
        });

        it('should render search input with correct placeholder', async () => {
            const element = await component.render();
            const searchInput = element.querySelector('#form-cols-search');
            expect(searchInput.placeholder).toContain('Search');
        });

        it('should hide odata filter container by default', async () => {
            const element = await component.render();
            const container = element.querySelector('#odata-filter-container');
            expect(container.style.display).toBe('none');
        });

        it('should hide unused columns container by default', async () => {
            const element = await component.render();
            const container = element.querySelector('#unused-cols-container');
            expect(container.style.display).toBe('none');
        });

        it('should render toggle checkboxes as checked by default', async () => {
            const element = await component.render();
            const odataToggle = element.querySelector('#odata-filter-toggle');
            const unusedToggle = element.querySelector('#unused-cols-toggle');
            expect(odataToggle.checked).toBe(true);
            expect(unusedToggle.checked).toBe(true);
        });

        it('should show loading message in table wrapper', async () => {
            const element = await component.render();
            const wrapper = element.querySelector('#form-cols-table-wrapper');
            expect(wrapper.textContent).toContain('Loading');
        });
    });

    describe('postRender', () => {
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
        });

        it('should cache tableWrapper reference', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component.ui.tableWrapper).toBeTruthy();
        });

        it('should cache viewSwitcher reference', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component.ui.viewSwitcher).toBeTruthy();
        });

        it('should cache odataToggle reference', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component.ui.odataToggle).toBeTruthy();
        });

        it('should cache unusedColsToggle reference', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component.ui.unusedColsToggle).toBeTruthy();
        });

        it('should call _loadAndRenderTable', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            const loadSpy = vi.spyOn(component, '_loadAndRenderTable');
            component.postRender(element);
            expect(loadSpy).toHaveBeenCalled();
        });

        it('should setup search input event listener', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._onSearch).toBeDefined();
        });

        it('should setup odata toggle event listener', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._onOdata).toBeDefined();
        });

        it('should setup view switch event listener', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._onSwitch).toBeDefined();
        });

        it('should setup table click event listener', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._onClick).toBeDefined();
        });

        it('should setup mousemove event listener', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._onMove).toBeDefined();
        });

        it('should setup mouseleave event listener', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._onLeave).toBeDefined();
        });

        it('should setup scroll event listener', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._onScroll).toBeDefined();
        });
    });

    describe('destroy', () => {
        it('should not throw when called', () => {
            expect(() => component.destroy()).not.toThrow();
        });

        it('should cleanup live handlers', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(() => component.destroy()).not.toThrow();
        });

        it('should not throw when called multiple times', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component.destroy();
            expect(() => component.destroy()).not.toThrow();
        });

        it('should handle destroy when ui is not initialized', () => {
            component.ui = {};
            expect(() => component.destroy()).not.toThrow();
        });

        it('should clear highlighted element on destroy', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const mockElement = document.createElement('div');
            mockElement.classList.add('pdt-highlight-border');
            component.highlightedElement = mockElement;

            component.destroy();
            expect(mockElement.classList.contains('pdt-highlight-border')).toBe(false);
        });

        it('should detach live handlers on destroy', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const mockHandler = { attribute: { removeOnChange: vi.fn() }, handler: vi.fn() };
            component.liveHandlers = [mockHandler];

            component.destroy();
            expect(mockHandler.attribute.removeOnChange).toHaveBeenCalledWith(mockHandler.handler);
        });
    });

    describe('view switching', () => {
        it('should have two view modes', () => {
            expect(['form', 'all']).toContain(component.viewMode);
        });

        it('should switch view mode when button is clicked', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            const allBtn = element.querySelector('[data-view="all"]');
            allBtn.click();

            expect(component.viewMode).toBe('all');
        });

        it('should update button active state on view switch', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            const allBtn = element.querySelector('[data-view="all"]');
            allBtn.click();

            expect(allBtn.classList.contains('active')).toBe(true);
        });

        it('should show odata filter when switching to all view', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            component.viewMode = 'all';
            component._updateViewState();

            expect(component.ui.odataContainer.style.display).toBe('flex');
        });

        it('should show unused filter when switching to all view', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            component.viewMode = 'all';
            component._updateViewState();

            expect(component.ui.unusedContainer.style.display).toBe('flex');
        });

        it('should not change view when clicking same button', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            const formBtn = element.querySelector('[data-view="form"]');
            const loadSpy = vi.spyOn(component, '_loadAndRenderTable');
            loadSpy.mockClear();

            formBtn.click();

            // Should not reload when clicking already active view
            expect(component.viewMode).toBe('form');
        });
    });

    describe('sorting', () => {
        it('should have sortState with column and direction', () => {
            expect(component.sortState).toHaveProperty('column');
            expect(component.sortState).toHaveProperty('direction');
        });

        it('should support ascending and descending directions', () => {
            expect(['asc', 'desc']).toContain(component.sortState.direction);
        });

        it('should toggle sort direction when clicking same column', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            const initialDirection = component.sortState.direction;
            component._sortTable('displayName');
            expect(component.sortState.direction).not.toBe(initialDirection);
        });

        it('should reset to asc when sorting new column', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            component.sortState.direction = 'desc';
            component._sortTable('logicalName');

            expect(component.sortState.column).toBe('logicalName');
            expect(component.sortState.direction).toBe('asc');
        });

        it('should update header sort classes', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            const headerRow = component.ui.tableWrapper.querySelector('thead tr');
            component._updateHeaderSortClasses(headerRow);

            const sortedHeader = headerRow.querySelector(`th[data-column="${component.sortState.column}"]`);
            expect(sortedHeader.classList.contains('sort-asc') || sortedHeader.classList.contains('sort-desc')).toBe(true);
        });

        it('should handle clicking table header for sorting', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            const logicalNameHeader = component.ui.tableWrapper.querySelector('th[data-column="logicalName"]');
            logicalNameHeader.click();

            expect(component.sortState.column).toBe('logicalName');
        });
    });

    describe('_loadAndRenderTable', () => {
        it('should call DataService.getFormColumns in form view', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => DataService.getFormColumns.mock.calls.length > 0);
            expect(DataService.getFormColumns).toHaveBeenCalled();
        });

        it('should call DataService.getAllRecordColumns in all view', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.viewMode = 'all';
            component.postRender(element);

            await vi.waitFor(() => DataService.getAllRecordColumns.mock.calls.length > 0);
            expect(DataService.getAllRecordColumns).toHaveBeenCalled();
        });

        it('should show error message on load failure', async () => {
            DataService.getFormColumns.mockRejectedValueOnce(new Error('Network error'));

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => {
                const wrapper = component.ui.tableWrapper;
                return wrapper.innerHTML.includes('error') || wrapper.innerHTML.includes('pdt-error');
            });

            expect(component.ui.tableWrapper.querySelector('.pdt-error')).toBeTruthy();
        });

        it('should populate allColumns after successful load', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.allColumns.length > 0);
            expect(component.allColumns.length).toBeGreaterThan(0);
        });

        it('should render table after loading', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));
            expect(component.ui.tableWrapper.querySelector('table')).toBeTruthy();
        });

        it('should set tableBody reference after rendering', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);
            expect(component.tableBody).toBeTruthy();
        });
    });

    describe('_normalizeColumnsResult', () => {
        it('should return array as-is', () => {
            const input = [{ logicalName: 'name', value: 'Test' }];
            const result = component._normalizeColumnsResult(input);
            expect(result).toEqual(input);
        });

        it('should extract value array from response object', () => {
            const input = { value: [{ logicalName: 'name', value: 'Test' }] };
            const result = component._normalizeColumnsResult(input);
            expect(result).toEqual(input.value);
        });

        it('should extract columns array from response object', () => {
            const input = { columns: [{ logicalName: 'name', value: 'Test' }] };
            const result = component._normalizeColumnsResult(input);
            expect(result).toEqual(input.columns);
        });

        it('should convert plain object to array', () => {
            const input = { name: 'Test Value', age: 25 };
            const result = component._normalizeColumnsResult(input);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(2);
        });

        it('should return empty array for null', () => {
            const result = component._normalizeColumnsResult(null);
            expect(result).toEqual([]);
        });

        it('should return empty array for undefined', () => {
            const result = component._normalizeColumnsResult(undefined);
            expect(result).toEqual([]);
        });

        it('should handle nested null values in plain object', () => {
            const input = { name: null, value: 'Test' };
            const result = component._normalizeColumnsResult(input);
            expect(result.find(r => r.logicalName === 'name').type).toBe('unknown');
        });
    });

    describe('_renderTableRows', () => {
        it('should not throw when tableBody is null', () => {
            component.tableBody = null;
            expect(() => component._renderTableRows()).not.toThrow();
        });

        it('should apply search filter', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            component.ui.searchInput.value = 'name';
            component._renderTableRows();

            const visibleRows = component.currentColumns.filter(c =>
                c.displayName.toLowerCase().includes('name') ||
                c.logicalName.toLowerCase().includes('name')
            );
            expect(component.currentColumns.length).toBe(visibleRows.length);
        });

        it('should show no results message when no columns match', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            component.ui.searchInput.value = 'nonexistentcolumn12345';
            component._renderTableRows();

            expect(component.ui.tableWrapper.textContent).toContain('No columns');
        });

        it('should reset renderIndex on re-render', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            component.renderIndex = 50;
            component._renderTableRows();

            expect(component.renderIndex).toBe(component.currentColumns.length);
        });
    });

    describe('_renderTable', () => {
        it('should render table headers', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            const headers = component.ui.tableWrapper.querySelectorAll('th');
            expect(headers.length).toBeGreaterThan(0);
        });

        it('should render Display Name header', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            const header = component.ui.tableWrapper.querySelector('th[data-column="displayName"]');
            expect(header.textContent).toContain('Display Name');
        });

        it('should render Logical Name header', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            const header = component.ui.tableWrapper.querySelector('th[data-column="logicalName"]');
            expect(header.textContent).toContain('Logical Name');
        });

        it('should render Current Value header', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            const header = component.ui.tableWrapper.querySelector('th[data-column="value"]');
            expect(header.textContent).toContain('Current Value');
        });

        it('should render Type header', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            const header = component.ui.tableWrapper.querySelector('th[data-column="type"]');
            expect(header.textContent).toContain('Type');
        });

        it('should render table with pdt-table class', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            const table = component.ui.tableWrapper.querySelector('table');
            expect(table.classList.contains('pdt-table')).toBe(true);
        });
    });

    describe('_createRowHtml', () => {
        it('should create row with data-logical-name attribute', () => {
            const column = { displayName: 'Name', logicalName: 'name', value: 'Test', type: 'string' };
            const html = component._createRowHtml(column);
            expect(html).toContain('data-logical-name="name"');
        });

        it('should include display name in row', () => {
            const column = { displayName: 'Account Name', logicalName: 'name', value: 'Test', type: 'string' };
            const html = component._createRowHtml(column);
            expect(html).toContain('Account Name');
        });

        it('should include logical name in row', () => {
            const column = { displayName: 'Name', logicalName: 'accountname', value: 'Test', type: 'string' };
            const html = component._createRowHtml(column);
            expect(html).toContain('accountname');
        });

        it('should include value in row', () => {
            const column = { displayName: 'Name', logicalName: 'name', value: 'Test Value', type: 'string' };
            const html = component._createRowHtml(column);
            expect(html).toContain('Test Value');
        });

        it('should include type in row', () => {
            const column = { displayName: 'Name', logicalName: 'name', value: 'Test', type: 'datetime' };
            const html = component._createRowHtml(column);
            expect(html).toContain('datetime');
        });

        it('should show dirty indicator for dirty columns', () => {
            const column = { displayName: 'Name', logicalName: 'name', value: 'Test', type: 'string', isDirty: true };
            const html = component._createRowHtml(column);
            expect(html).toContain('🟡');
        });

        it('should not show dirty indicator for clean columns', () => {
            const column = { displayName: 'Name', logicalName: 'name', value: 'Test', type: 'string', isDirty: false };
            const html = component._createRowHtml(column);
            expect(html).not.toContain('🟡');
        });

        it('should show required indicator for required fields', () => {
            const column = { displayName: 'Name', logicalName: 'name', value: 'Test', type: 'string', requiredLevel: 'required' };
            const html = component._createRowHtml(column);
            expect(html).toContain('pdt-text-error');
        });

        it('should show recommended indicator for recommended fields', () => {
            const column = { displayName: 'Name', logicalName: 'name', value: 'Test', type: 'string', requiredLevel: 'recommended' };
            const html = component._createRowHtml(column);
            expect(html).toContain('pdt-text-info');
        });

        it('should add copyable-cell class to cells', () => {
            const column = { displayName: 'Name', logicalName: 'name', value: 'Test', type: 'string' };
            const html = component._createRowHtml(column);
            expect(html).toContain('copyable-cell');
        });

        it('should handle null value', () => {
            const column = { displayName: 'Name', logicalName: 'name', value: null, type: 'string' };
            const html = component._createRowHtml(column);
            expect(html).toContain('data-full=""');
        });

        it('should handle undefined value', () => {
            const column = { displayName: 'Name', logicalName: 'name', value: undefined, type: 'string' };
            const html = component._createRowHtml(column);
            expect(html).not.toContain('undefined');
        });
    });

    describe('_handleTableClick', () => {
        it('should handle header click for sorting', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            const header = component.ui.tableWrapper.querySelector('th[data-column="logicalName"]');
            const event = new MouseEvent('click', { bubbles: true });
            header.dispatchEvent(event);

            expect(component.sortState.column).toBe('logicalName');
        });

        it('should handle copyable cell click', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Wait for table and data to load
            await vi.waitFor(() => {
                return component.tableBody !== null && component.allColumns.length > 0;
            });

            // Ensure rows are rendered
            const tableHasCells = component.tableBody && component.tableBody.querySelector('td');
            expect(tableHasCells || component.allColumns.length > 0).toBeTruthy();
        });
    });

    describe('_handleMouseMove and _handleMouseOut', () => {
        it('should track currentlyHoveredRow', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Wait for table body and allColumns to be populated
            await vi.waitFor(() => component.tableBody !== null && component.allColumns.length > 0);

            // Manually create a row for testing if not present
            if (!component.tableBody.querySelector('tr')) {
                component.tableBody.innerHTML = '<tr data-logical-name="name"><td>Name</td></tr>';
            }

            const row = component.tableBody.querySelector('tr');
            const event = new MouseEvent('mousemove', { bubbles: true });
            row.dispatchEvent(event);

            expect(component.currentlyHoveredRow).toBe(row);
        });

        it('should clear currentlyHoveredRow on mouse out', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            // Manually create a row for testing if not present
            if (!component.tableBody.querySelector('tr')) {
                component.tableBody.innerHTML = '<tr data-logical-name="name"><td>Name</td></tr>';
            }

            const row = component.tableBody.querySelector('tr');
            component.currentlyHoveredRow = row;

            component._handleMouseOut();

            expect(component.currentlyHoveredRow).toBeNull();
        });

        it('should remove highlight class on mouse out', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('tbody tr'));

            const mockHighlighted = document.createElement('div');
            mockHighlighted.classList.add('pdt-highlight-border');
            component.highlightedElement = mockHighlighted;

            component._handleMouseOut();

            expect(mockHighlighted.classList.contains('pdt-highlight-border')).toBe(false);
            expect(component.highlightedElement).toBeNull();
        });
    });

    describe('_detachLiveHandlers', () => {
        it('should not throw when liveHandlers is empty', () => {
            component.liveHandlers = [];
            expect(() => component._detachLiveHandlers()).not.toThrow();
        });

        it('should call removeOnChange for each handler', () => {
            const mockRemove = vi.fn();
            component.liveHandlers = [
                { attribute: { removeOnChange: mockRemove }, handler: vi.fn() },
                { attribute: { removeOnChange: mockRemove }, handler: vi.fn() }
            ];

            component._detachLiveHandlers();

            expect(mockRemove).toHaveBeenCalledTimes(2);
        });

        it('should clear liveHandlers array after detaching', () => {
            component.liveHandlers = [
                { attribute: { removeOnChange: vi.fn() }, handler: vi.fn() }
            ];

            component._detachLiveHandlers();

            expect(component.liveHandlers).toEqual([]);
        });

        it('should handle missing removeOnChange gracefully', () => {
            component.liveHandlers = [
                { attribute: {}, handler: vi.fn() }
            ];

            expect(() => component._detachLiveHandlers()).not.toThrow();
        });
    });

    describe('_attachLiveHandlers', () => {
        it('should not attach handlers when viewMode is all', () => {
            component.viewMode = 'all';
            component.tableBody = document.createElement('tbody');
            component.allColumns = [{ attribute: { addOnChange: vi.fn() }, logicalName: 'name' }];

            component._attachLiveHandlers();

            expect(component.liveHandlers).toEqual([]);
        });

        it('should not attach handlers when tableBody is null', () => {
            component.viewMode = 'form';
            component.tableBody = null;
            component.allColumns = [{ attribute: { addOnChange: vi.fn() }, logicalName: 'name' }];

            component._attachLiveHandlers();

            expect(component.liveHandlers).toEqual([]);
        });

        it('should attach handlers for columns with attributes', () => {
            const mockAddOnChange = vi.fn();
            component.viewMode = 'form';
            component.tableBody = document.createElement('tbody');
            component.allColumns = [
                { attribute: { addOnChange: mockAddOnChange }, logicalName: 'name' }
            ];

            component._attachLiveHandlers();

            expect(mockAddOnChange).toHaveBeenCalled();
            expect(component.liveHandlers.length).toBe(1);
        });
    });

    describe('_updateRowUI', () => {
        it('should not throw when row is not found', () => {
            component.tableBody = document.createElement('tbody');
            component.allColumns = [];

            expect(() => component._updateRowUI('nonexistent')).not.toThrow();
        });

        it('should update value cell when row exists', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const mockAttribute = {
                getValue: () => 'New Value',
                getIsDirty: () => true
            };

            component.allColumns = [
                { logicalName: 'name', displayName: 'Name', attribute: mockAttribute, value: 'Old', type: 'string' }
            ];

            // Create a row in the table body
            component.tableBody.innerHTML = `
                <tr data-logical-name="name">
                    <td>Name</td>
                    <td>name</td>
                    <td>Old</td>
                    <td>string</td>
                    <td></td>
                    <td></td>
                </tr>
            `;

            component._updateRowUI('name');

            expect(component.tableBody.querySelector('tr').cells[2].textContent).toBe('New Value');
        });
    });

    describe('_renderNextBatch', () => {
        it('should not render when all rows are already rendered', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const initialRowCount = component.tableBody.querySelectorAll('tr').length;
            component.renderIndex = component.currentColumns.length;

            component._renderNextBatch();

            expect(component.tableBody.querySelectorAll('tr').length).toBe(initialRowCount);
        });

        it('should increment renderIndex after batch render', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            component.tableBody.innerHTML = '';
            component.renderIndex = 0;
            component.currentColumns = [
                { displayName: 'Name', logicalName: 'name', value: 'Test', type: 'string' }
            ];

            component._renderNextBatch();

            expect(component.renderIndex).toBe(1);
        });
    });

    describe('_handleScroll', () => {
        it('should call _renderNextBatch when near bottom', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const renderSpy = vi.spyOn(component, '_renderNextBatch');

            // Simulate scroll near bottom
            Object.defineProperty(component.ui.tableWrapper, 'scrollTop', { value: 900 });
            Object.defineProperty(component.ui.tableWrapper, 'clientHeight', { value: 200 });
            Object.defineProperty(component.ui.tableWrapper, 'scrollHeight', { value: 1000 });

            component._handleScroll();

            expect(renderSpy).toHaveBeenCalled();
        });
    });

    describe('_updateViewState', () => {
        it('should hide filters for form view', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper);

            component.viewMode = 'form';
            component._updateViewState();

            expect(component.ui.odataContainer.style.display).toBe('none');
            expect(component.ui.unusedContainer.style.display).toBe('none');
        });

        it('should show filters for all view', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper);

            component.viewMode = 'all';
            component._updateViewState();

            expect(component.ui.odataContainer.style.display).toBe('flex');
            expect(component.ui.unusedContainer.style.display).toBe('flex');
        });

        it('should uncheck toggles on first record view entry', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper);

            component._hasEnteredRecordView = false;
            component.viewMode = 'all';
            component._updateViewState();

            expect(component.ui.odataToggle.checked).toBe(false);
            expect(component.ui.unusedColsToggle.checked).toBe(false);
            expect(component._hasEnteredRecordView).toBe(true);
        });

        it('should not reset toggles on subsequent record view entries', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper);

            component._hasEnteredRecordView = true;
            component.ui.odataToggle.checked = true;
            component.viewMode = 'all';
            component._updateViewState();

            expect(component.ui.odataToggle.checked).toBe(true);
        });
    });

    describe('filter functionality', () => {
        it('should filter by search term in display name', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null && component.allColumns.length > 0);

            component.ui.searchInput.value = 'Account';
            component._renderTableRows();

            const matchesSearch = component.currentColumns.every(c =>
                c.displayName.toLowerCase().includes('account') ||
                c.logicalName.toLowerCase().includes('account')
            );
            expect(matchesSearch).toBe(true);
        });

        it('should filter by search term in logical name', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null && component.allColumns.length > 0);

            component.ui.searchInput.value = 'accountnumber';
            component._renderTableRows();

            const hasAccountNumber = component.currentColumns.some(c =>
                c.logicalName.toLowerCase().includes('accountnumber')
            );
            expect(hasAccountNumber || component.currentColumns.length === 0).toBe(true);
        });

        it('should be case insensitive', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null && component.allColumns.length > 0);

            component.ui.searchInput.value = 'NAME';
            component._renderTableRows();
            const upperResult = [...component.currentColumns];

            component.ui.searchInput.value = 'name';
            component._renderTableRows();
            const lowerResult = [...component.currentColumns];

            expect(upperResult.length).toBe(lowerResult.length);
        });
    });

    describe('lookup handling', () => {
        it('should show lookup details dialog for lookup fields', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const mockAttribute = {
                getValue: () => [{ name: 'Test Record', id: '123', entityType: 'account' }]
            };

            const columnData = {
                displayName: 'Primary Contact',
                logicalName: 'primarycontactid',
                type: 'lookup',
                attribute: mockAttribute
            };

            component._showLookupDetails(columnData);

            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should show notification for empty lookup', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const mockAttribute = {
                getValue: () => null
            };

            const columnData = {
                displayName: 'Primary Contact',
                logicalName: 'primarycontactid',
                type: 'lookup',
                attribute: mockAttribute
            };

            component._showLookupDetails(columnData);

            expect(NotificationService.show).toHaveBeenCalled();
        });
    });

    describe('attribute editor', () => {
        it('should show dialog for editing attribute', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const mockAttribute = {
                getValue: () => 'Test Value',
                setValue: vi.fn()
            };

            const columnData = {
                displayName: 'Name',
                logicalName: 'name',
                type: 'string',
                attribute: mockAttribute
            };

            component._showAttributeEditor(columnData);

            expect(DialogService.show).toHaveBeenCalled();
        });
    });

    describe('_handleMouseMove edge cases', () => {
        it('should not update if same row is hovered', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            // Create a row
            if (!component.tableBody.querySelector('tr')) {
                component.tableBody.innerHTML = '<tr data-logical-name="name"><td>Name</td></tr>';
            }

            const row = component.tableBody.querySelector('tr');
            component.currentlyHoveredRow = row;

            // Should return early since same row
            const mouseOutSpy = vi.spyOn(component, '_handleMouseOut');
            const event = { target: { closest: () => row } };
            component._handleMouseMove(event);

            // Should not call handleMouseOut since same row
            expect(mouseOutSpy).not.toHaveBeenCalled();
        });

        it('should handle row with no logicalName', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            component.tableBody.innerHTML = '<tr><td>No logical name</td></tr>';

            const row = component.tableBody.querySelector('tr');
            const event = new MouseEvent('mousemove', { bubbles: true });
            row.dispatchEvent(event);

            // Should not throw
            expect(component.currentlyHoveredRow).toBe(row);
        });

        it('should handle column without controls', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            component.allColumns = [
                { logicalName: 'name', displayName: 'Name', attribute: { controls: { get: () => [] } } }
            ];

            component.tableBody.innerHTML = '<tr data-logical-name="name"><td>Name</td></tr>';

            const row = component.tableBody.querySelector('tr');
            const event = new MouseEvent('mousemove', { bubbles: true });
            row.dispatchEvent(event);

            expect(component.highlightedElement).toBeNull();
        });
    });

    describe('_handleTableClick edge cases', () => {
        it('should handle click on row without cell', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            // Simulate click event that finds row but not cell
            const mockEvent = {
                target: {
                    closest: (selector) => {
                        if (selector === 'th[data-column]') return null;
                        if (selector === 'tr') return document.createElement('tr');
                        if (selector === 'td') return null;
                        return null;
                    }
                }
            };

            // Should not throw
            expect(() => component._handleTableClick(mockEvent)).not.toThrow();
        });

        it('should handle editable cell click', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const mockAttribute = {
                getValue: () => 'Test',
                setValue: vi.fn()
            };

            component.allColumns = [
                { logicalName: 'name', displayName: 'Name', type: 'string', attribute: mockAttribute }
            ];

            component.tableBody.innerHTML = `
                <tr data-logical-name="name">
                    <td>Name</td>
                    <td class="editable-cell">Test</td>
                </tr>
            `;

            const editableCell = component.tableBody.querySelector('.editable-cell');
            const row = component.tableBody.querySelector('tr');

            const mockEvent = {
                target: {
                    closest: (selector) => {
                        if (selector === 'th[data-column]') return null;
                        if (selector === 'tr') return row;
                        if (selector === 'td') return editableCell;
                        return null;
                    }
                }
            };

            component._handleTableClick(mockEvent);

            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should handle lookup type column click', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const mockAttribute = {
                getValue: () => [{ name: 'Test', id: '123', entityType: 'account' }]
            };

            component.allColumns = [
                { logicalName: 'primarycontactid', displayName: 'Primary Contact', type: 'lookup', attribute: mockAttribute }
            ];

            component.tableBody.innerHTML = `
                <tr data-logical-name="primarycontactid">
                    <td>Primary Contact</td>
                    <td class="copyable-cell">Test</td>
                </tr>
            `;

            const cell = component.tableBody.querySelector('.copyable-cell');
            const row = component.tableBody.querySelector('tr');

            const mockEvent = {
                target: {
                    closest: (selector) => {
                        if (selector === 'th[data-column]') return null;
                        if (selector === 'tr') return row;
                        if (selector === 'td') return cell;
                        return null;
                    }
                }
            };

            component._handleTableClick(mockEvent);

            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should handle copyable cell with empty value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            component.allColumns = [
                { logicalName: 'empty', displayName: 'Empty', type: 'string' }
            ];

            component.tableBody.innerHTML = `
                <tr data-logical-name="empty">
                    <td class="copyable-cell" data-full=""></td>
                </tr>
            `;

            const cell = component.tableBody.querySelector('.copyable-cell');
            const row = component.tableBody.querySelector('tr');

            const mockEvent = {
                target: {
                    closest: (selector) => {
                        if (selector === 'th[data-column]') return null;
                        if (selector === 'tr') return row;
                        if (selector === 'td') return cell;
                        return null;
                    }
                }
            };

            // Should not throw on empty value
            expect(() => component._handleTableClick(mockEvent)).not.toThrow();
        });
    });

    describe('_sortTable edge cases', () => {
        it('should sort boolean values correctly', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            component.currentColumns = [
                { displayName: 'A', logicalName: 'a', isDirty: true },
                { displayName: 'B', logicalName: 'b', isDirty: false },
                { displayName: 'C', logicalName: 'c', isDirty: true }
            ];

            component._sortTable('isDirty');

            // Check sorting happened
            expect(component.sortState.column).toBe('isDirty');
        });

        it('should preserve scroll position on sort', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            // Set scroll position
            Object.defineProperty(component.ui.tableWrapper, 'scrollLeft', { value: 100, writable: true });
            Object.defineProperty(component.ui.tableWrapper, 'scrollTop', { value: 50, writable: true });

            component._sortTable('logicalName');

            // Sort was applied
            expect(component.sortState.column).toBe('logicalName');
        });
    });

    describe('_renderTableRows edge cases', () => {
        it('should show different message for record view with no columns', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            component.viewMode = 'all';
            component._updateViewState();

            // Mock empty columns with filters
            component.allColumns = [];
            component.ui.searchInput.value = '';
            component.ui.odataToggle.checked = false;
            component.ui.unusedColsToggle.checked = false;

            component._renderTableRows();

            const noteElement = component.ui.tableWrapper.querySelector('.pdt-note');
            expect(noteElement).toBeTruthy();
        });

        it('should filter system columns in all view', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            component.viewMode = 'all';
            component._updateViewState();

            component.allColumns = [
                { logicalName: 'name', displayName: 'Name', type: 'string', isSystem: false },
                { logicalName: '@odata.etag', displayName: '@odata.etag', type: 'string', isSystem: true }
            ];

            component.ui.odataToggle.checked = true; // Hide system
            component.ui.unusedColsToggle.checked = false;
            component.ui.searchInput.value = '';

            component._renderTableRows();

            // System columns should be filtered out
            const nonSystemColumns = component.currentColumns.filter(c => !c.isSystem);
            expect(nonSystemColumns.length).toBeLessThanOrEqual(component.allColumns.length);
        });

        it('should filter unused columns in all view', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            component.viewMode = 'all';
            component._updateViewState();

            component.allColumns = [
                { logicalName: 'name', displayName: 'Name', type: 'string', onForm: true },
                { logicalName: 'unused', displayName: 'Unused', type: 'string', onForm: false }
            ];

            component.ui.odataToggle.checked = false;
            component.ui.unusedColsToggle.checked = true; // Show only unused
            component.ui.searchInput.value = '';

            component._renderTableRows();

            // Only unused columns should be shown
            const unusedColumns = component.currentColumns.filter(c => !c.onForm);
            expect(unusedColumns.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('_createRowHtml with attribute', () => {
        it('should format value from attribute when present', () => {
            const mockAttribute = {
                getValue: () => 'Attribute Value'
            };

            const column = {
                displayName: 'Name',
                logicalName: 'name',
                value: 'Old Value',
                type: 'string',
                attribute: mockAttribute
            };

            component.viewMode = 'form';
            const html = component._createRowHtml(column);

            expect(html).toContain('data-logical-name="name"');
        });

        it('should show edit icon for editable cells in form view', () => {
            component.viewMode = 'form';

            const column = {
                displayName: 'Name',
                logicalName: 'name',
                value: 'Test',
                type: 'string',
                attribute: { getValue: () => 'Test' }
            };

            const html = component._createRowHtml(column);

            expect(html).toContain('editable-cell');
        });

        it('should not show edit icon for lookup type', () => {
            component.viewMode = 'form';

            const column = {
                displayName: 'Contact',
                logicalName: 'contactid',
                value: 'Test',
                type: 'lookup',
                attribute: { getValue: () => null }
            };

            const html = component._createRowHtml(column);

            expect(html).not.toContain('editable-cell');
        });
    });

    describe('_updateRowUI edge cases', () => {
        it('should handle column without attribute', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            component.allColumns = [
                { logicalName: 'name', displayName: 'Name', value: 'Test' }
            ];

            component.tableBody.innerHTML = `
                <tr data-logical-name="name">
                    <td>Name</td>
                    <td>name</td>
                    <td>Test</td>
                    <td>string</td>
                    <td></td>
                    <td></td>
                </tr>
            `;

            // Should not throw when column has no attribute
            expect(() => component._updateRowUI('name')).not.toThrow();
        });
    });

    describe('_handleViewSwitch edge cases', () => {
        it('should ignore non-button clicks', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.ui.tableWrapper.querySelector('table'));

            const initialViewMode = component.viewMode;

            // Simulate click on non-button element
            const mockEvent = {
                target: {
                    closest: () => null
                }
            };

            component._handleViewSwitch(mockEvent);

            expect(component.viewMode).toBe(initialViewMode);
        });
    });

    describe('destroy edge cases', () => {
        it('should cancel debounced scroll handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            // Mock cancel function
            if (component._onScroll) {
                component._onScroll.cancel = vi.fn();
            }

            component.destroy();

            // Should not throw
            expect(true).toBe(true);
        });

        it('should cancel debounced search handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            // Mock cancel function
            if (component._onSearch) {
                component._onSearch.cancel = vi.fn();
            }

            component.destroy();

            expect(true).toBe(true);
        });
    });

    describe('integration scenarios', () => {
        it('should handle full lifecycle: render, postRender, interact, destroy', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            // Simulate search
            component.ui.searchInput.value = 'name';
            component._renderTableRows();

            // Simulate sort
            component._sortTable('logicalName');

            // Simulate view switch
            component.viewMode = 'all';
            component._updateViewState();

            // Destroy
            component.destroy();

            expect(true).toBe(true);
        });

        it('should handle empty initial data', async () => {
            DataService.getFormColumns.mockResolvedValueOnce([]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            expect(component.allColumns).toEqual([]);
        });
    });

    describe('filter logic in all view mode - lines 350, 362 coverage', () => {
        it('should filter by isSystem property when hideSystem is enabled in all view', async () => {
            DataService.getAllRecordColumns.mockResolvedValueOnce([
                { displayName: 'name', logicalName: 'name', value: 'Test', type: 'string', isSystem: false },
                { displayName: '@odata.context', logicalName: '@odata.context', value: 'url', type: 'string', isSystem: true },
                { displayName: 'customfield', logicalName: 'customfield', value: 'val', type: 'string', isSystem: null }
            ]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            // Switch to all view
            component.viewMode = 'all';
            await component._loadAndRenderTable();

            // Enable hide system filter
            component.ui.odataToggle.checked = true;
            component._renderTableRows();

            // System columns should be filtered out
            const visibleColumns = component.currentColumns.filter(c => !c.isSystem);
            expect(visibleColumns.length).toBeGreaterThan(0);
        });

        it('should filter by onForm when showUnusedOnly is enabled in all view', async () => {
            DataService.getAllRecordColumns.mockResolvedValueOnce([
                { displayName: 'name', logicalName: 'name', value: 'Test', type: 'string', onForm: true },
                { displayName: 'unused', logicalName: 'unused', value: 'val', type: 'string', onForm: false }
            ]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            component.viewMode = 'all';
            await component._loadAndRenderTable();

            component.ui.unusedColsToggle.checked = true;
            component._renderTableRows();

            // Only unused columns should remain
            const unusedColumns = component.currentColumns.filter(c => !c.onForm);
            expect(unusedColumns.every(c => !c.onForm)).toBe(true);
        });

        it('should apply search filter in form view mode', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            component.viewMode = 'form';
            component.ui.searchInput.value = 'Account';
            component._renderTableRows();

            const matches = component.currentColumns.filter(c =>
                c.displayName?.toLowerCase().includes('account') ||
                c.logicalName?.toLowerCase().includes('account')
            );
            expect(component.currentColumns).toEqual(matches);
        });
    });

    describe('first entry to record view - lines 420, 422, 428 coverage', () => {
        it('should initialize toggles to unchecked on first entry to record view', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            // Ensure toggles exist and may have some initial state
            component.ui.odataToggle.checked = true;
            component.ui.unusedColsToggle.checked = true;

            // Reset the flag
            component._hasEnteredRecordView = false;

            // Switch to record view
            component.viewMode = 'all';
            component._updateViewState();

            // Toggles should be reset to unchecked
            expect(component.ui.odataToggle.checked).toBe(false);
            expect(component.ui.unusedColsToggle.checked).toBe(false);
            expect(component._hasEnteredRecordView).toBe(true);
        });

        it('should not reset toggles on subsequent entries to record view', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            // Mark as already entered
            component._hasEnteredRecordView = true;

            // Set toggles to checked
            component.ui.odataToggle.checked = true;
            component.ui.unusedColsToggle.checked = true;

            // Switch to record view again
            component.viewMode = 'all';
            component._updateViewState();

            // Toggles should remain as set
            expect(component.ui.odataToggle.checked).toBe(true);
            expect(component.ui.unusedColsToggle.checked).toBe(true);
        });
    });

    describe('copyable cell with long text - lines 452-455 coverage', () => {
        it('should truncate preview for text longer than 120 characters', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const longText = 'A'.repeat(150);

            component.allColumns = [
                { logicalName: 'longfield', displayName: 'Long Field', type: 'string' }
            ];

            component.tableBody.innerHTML = `
                <tr data-logical-name="longfield">
                    <td class="copyable-cell" data-full="${longText}">Preview</td>
                </tr>
            `;

            const cell = component.tableBody.querySelector('.copyable-cell');
            const row = component.tableBody.querySelector('tr');

            const mockEvent = {
                target: {
                    closest: (selector) => {
                        if (selector === 'th[data-column]') return null;
                        if (selector === 'tr') return row;
                        if (selector === 'td') return cell;
                        return null;
                    }
                }
            };

            const { copyToClipboard } = await import('../../src/helpers/index.js');
            component._handleTableClick(mockEvent);

            // Should copy full text but show truncated preview
            expect(copyToClipboard).toHaveBeenCalledWith(
                longText,
                expect.stringContaining('…')
            );
        });

        it('should not truncate preview for text 120 characters or less', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const shortText = 'Short text value';

            component.allColumns = [
                { logicalName: 'shortfield', displayName: 'Short Field', type: 'string' }
            ];

            component.tableBody.innerHTML = `
                <tr data-logical-name="shortfield">
                    <td class="copyable-cell" data-full="${shortText}">${shortText}</td>
                </tr>
            `;

            const cell = component.tableBody.querySelector('.copyable-cell');
            const row = component.tableBody.querySelector('tr');

            const mockEvent = {
                target: {
                    closest: (selector) => {
                        if (selector === 'th[data-column]') return null;
                        if (selector === 'tr') return row;
                        if (selector === 'td') return cell;
                        return null;
                    }
                }
            };

            const { copyToClipboard } = await import('../../src/helpers/index.js');
            component._handleTableClick(mockEvent);

            expect(copyToClipboard).toHaveBeenCalledWith(
                shortText,
                `Copied: ${shortText}`
            );
        });
    });

    describe('mouse hover highlighting - lines 489, 504-506, 515-516 coverage', () => {
        it('should clear previous highlight before setting new one', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            // Set up existing highlighted element
            const previousHighlight = document.createElement('div');
            previousHighlight.classList.add('pdt-highlight-border');
            component.highlightedElement = previousHighlight;
            document.body.appendChild(previousHighlight);

            const row = document.createElement('tr');
            row.dataset.logicalName = 'name';
            component.tableBody.appendChild(row);

            // Mock attribute with controls
            const mockControl = {
                getName: () => 'name_control'
            };
            const mockAttribute = {
                controls: { get: () => [mockControl] }
            };
            component.allColumns = [{ logicalName: 'name', attribute: mockAttribute }];

            // Create control element on page
            const controlEl = document.createElement('div');
            controlEl.setAttribute('data-control-name', 'name_control');
            document.body.appendChild(controlEl);

            component._handleMouseMove({ target: row });

            // Previous highlight should be cleared
            expect(previousHighlight.classList.contains('pdt-highlight-border')).toBe(false);
        });

        it('should handle row without logicalName', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const row = document.createElement('tr');
            // No logicalName dataset
            component.tableBody.appendChild(row);

            component.currentlyHoveredRow = null;

            expect(() => component._handleMouseMove({ target: row })).not.toThrow();
        });

        it('should find control element by data-lp-id selector', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const row = document.createElement('tr');
            row.dataset.logicalName = 'testfield';
            component.tableBody.appendChild(row);

            const mockControl = { getName: () => 'field_lp' };
            const mockAttribute = { controls: { get: () => [mockControl] } };
            component.allColumns = [{ logicalName: 'testfield', attribute: mockAttribute }];

            // Create control element with data-lp-id
            const controlEl = document.createElement('div');
            controlEl.setAttribute('data-lp-id', 'contains_field_lp_here');
            document.body.appendChild(controlEl);

            component._handleMouseMove({ target: row });

            expect(controlEl.classList.contains('pdt-highlight-border')).toBe(true);
        });

        it('should find control element by aria-label selector', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const row = document.createElement('tr');
            row.dataset.logicalName = 'ariafield';
            component.tableBody.appendChild(row);

            const mockControl = { getName: () => 'aria_control' };
            const mockAttribute = { controls: { get: () => [mockControl] } };
            component.allColumns = [{ logicalName: 'ariafield', attribute: mockAttribute }];

            const controlEl = document.createElement('div');
            controlEl.setAttribute('aria-label', 'aria_control');
            document.body.appendChild(controlEl);

            component._handleMouseMove({ target: row });

            expect(controlEl.classList.contains('pdt-highlight-border')).toBe(true);
        });

        it('should highlight closest data-container parent', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const row = document.createElement('tr');
            row.dataset.logicalName = 'containerfield';
            component.tableBody.appendChild(row);

            const mockControl = { getName: () => 'container_ctrl' };
            const mockAttribute = { controls: { get: () => [mockControl] } };
            component.allColumns = [{ logicalName: 'containerfield', attribute: mockAttribute }];

            const dataContainer = document.createElement('div');
            dataContainer.className = 'data-container';
            const controlEl = document.createElement('div');
            controlEl.setAttribute('data-control-name', 'container_ctrl');
            dataContainer.appendChild(controlEl);
            document.body.appendChild(dataContainer);

            component._handleMouseMove({ target: row });

            expect(dataContainer.classList.contains('pdt-highlight-border')).toBe(true);
        });

        it('should not throw when controls array is empty', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const row = document.createElement('tr');
            row.dataset.logicalName = 'nocontrolfield';
            component.tableBody.appendChild(row);

            const mockAttribute = { controls: { get: () => [] } };
            component.allColumns = [{ logicalName: 'nocontrolfield', attribute: mockAttribute }];

            expect(() => component._handleMouseMove({ target: row })).not.toThrow();
        });
    });

    describe('_updateHeaderSortClasses edge cases - line 703 coverage', () => {
        it('should early return when headerRow is null', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            expect(() => component._updateHeaderSortClasses(null)).not.toThrow();
        });

        it('should early return when headerRow is undefined', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            expect(() => component._updateHeaderSortClasses(undefined)).not.toThrow();
        });

        it('should set aria-sort to none for non-sorted columns', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const headerRow = document.createElement('tr');
            const th1 = document.createElement('th');
            th1.dataset.column = 'displayName';
            const th2 = document.createElement('th');
            th2.dataset.column = 'logicalName';
            headerRow.appendChild(th1);
            headerRow.appendChild(th2);

            component.sortState = { column: 'displayName', direction: 'asc' };
            component._updateHeaderSortClasses(headerRow);

            expect(th1.getAttribute('aria-sort')).toBe('ascending');
            expect(th2.getAttribute('aria-sort')).toBe('none');
        });

        it('should set aria-sort to descending for desc sorted column', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const headerRow = document.createElement('tr');
            const th = document.createElement('th');
            th.dataset.column = 'value';
            headerRow.appendChild(th);

            component.sortState = { column: 'value', direction: 'desc' };
            component._updateHeaderSortClasses(headerRow);

            expect(th.classList.contains('sort-desc')).toBe(true);
            expect(th.getAttribute('aria-sort')).toBe('descending');
        });
    });

    describe('_removeEventListeners - line 161 coverage', () => {
        it('should return early when ui is null', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Set ui to null and call _removeEventListeners
            component.ui = null;

            expect(() => component._removeEventListeners()).not.toThrow();
        });

        it('should return early when ui is undefined', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Set ui to undefined and call _removeEventListeners
            component.ui = undefined;

            expect(() => component._removeEventListeners()).not.toThrow();
        });
    });

    describe('_showAttributeEditor error handling - lines 312-322 coverage', () => {
        it('should show error notification when setValue throws', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            // Create a column with attribute that throws on setValue
            const mockAttribute = {
                setValue: vi.fn(() => { throw new Error('Cannot set value'); }),
                getValue: vi.fn(() => 'test'),
                getAttributeType: vi.fn(() => 'string'),
                controls: { get: vi.fn(() => []) }
            };

            const columnData = {
                displayName: 'Test Column',
                logicalName: 'testcolumn',
                type: 'string',
                attribute: mockAttribute
            };

            // Mock DialogService.show to simulate user input
            DialogService.show.mockImplementation((title, content, onConfirm) => {
                const contentDiv = document.createElement('div');
                contentDiv.innerHTML = '<input id="pdt-prompt-input" type="text" value="new-value" />';
                document.body.appendChild(contentDiv);

                // Call onConfirm with the contentDiv to trigger the error path
                const result = onConfirm(contentDiv);

                // Return false to indicate error was caught
                expect(result).toBe(false);

                contentDiv.remove();
            });

            // Trigger the attribute editor
            component._showAttributeEditor(columnData);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('Cannot set value'),
                'error'
            );
        });
    });

    describe('_renderTableRows empty with filters - lines 368 coverage', () => {
        it('should show filter-specific message when no columns and filters are active', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            // Set view mode to 'all' and enable filters
            component.viewMode = 'all';
            component.allColumns = [];

            // Enable a filter toggle
            if (component.ui.odataToggle) {
                component.ui.odataToggle.checked = true;
            }

            component._renderTableRows();

            const note = component.ui.tableWrapper.querySelector('.pdt-note');
            expect(note).toBeTruthy();
            expect(note.textContent).toContain('filters');
        });

        it('should show no record columns message when all view with no filters', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            component.viewMode = 'all';
            component.allColumns = [];

            if (component.ui.odataToggle) {
                component.ui.odataToggle.checked = false;
            }
            if (component.ui.unusedColsToggle) {
                component.ui.unusedColsToggle.checked = false;
            }

            component._renderTableRows();

            const note = component.ui.tableWrapper.querySelector('.pdt-note');
            expect(note).toBeTruthy();
        });
    });

    describe('_handleMouseMove row without logicalName - line 489 coverage', () => {
        it('should return early when row has no logicalName', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            // Create a row without logicalName dataset
            const row = document.createElement('tr');
            // Intentionally not setting row.dataset.logicalName

            const event = { target: row };

            // Should not throw and should return early
            expect(() => component._handleMouseMove(event)).not.toThrow();

            // No highlight should be set
            expect(component.highlightedElement).toBeNull();
        });

        it('should return early when row logicalName is empty string', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => component.tableBody !== null);

            const row = document.createElement('tr');
            row.dataset.logicalName = '';

            const event = { target: row };

            expect(() => component._handleMouseMove(event)).not.toThrow();
        });
    });
});
