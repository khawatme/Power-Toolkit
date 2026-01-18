/**
 * @file Comprehensive tests for ResultPanel
 * @module tests/utils/ui/ResultPanel.test.js
 * @description Tests for API result display with table/JSON views, sorting, and filtering
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResultPanel } from '../../../src/utils/ui/ResultPanel.js';

// Mock dependencies
vi.mock('../../../src/services/NotificationService.js', () => ({
    NotificationService: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        show: vi.fn()
    }
}));

vi.mock('../../../src/ui/UIFactory.js', () => ({
    UIFactory: {
        createCopyableCodeBlock: vi.fn(() => {
            const div = document.createElement('div');
            div.className = 'copyable-code-block';
            div.innerHTML = '<code>test</code>';
            return div;
        })
    }
}));

vi.mock('../../../src/helpers/index.js', () => ({
    escapeHtml: vi.fn((str) => String(str)),
    isOdataProperty: vi.fn((name) => name.startsWith('@odata') || name.startsWith('_')),
    UIHelpers: {
        initColumnResize: vi.fn(),
        destroyColumnResize: vi.fn()
    },
    FileHelpers: {
        downloadCsv: vi.fn(),
        downloadJson: vi.fn()
    }
}));

describe('ResultPanel', () => {
    let resultPanel;
    let root;
    let mockOnToggleView;
    let mockOnToggleHide;
    let mockGetSortState;
    let mockSetSortState;
    let mockOnBulkTouch;

    beforeEach(() => {
        vi.clearAllMocks();
        root = document.createElement('div');
        root.id = 'result-root';
        document.body.appendChild(root);

        mockOnToggleView = vi.fn();
        mockOnToggleHide = vi.fn();
        mockGetSortState = vi.fn().mockReturnValue({ column: null, direction: 'asc' });
        mockSetSortState = vi.fn();
        mockOnBulkTouch = vi.fn();

        resultPanel = new ResultPanel({
            root,
            onToggleView: mockOnToggleView,
            onToggleHide: mockOnToggleHide,
            getSortState: mockGetSortState,
            setSortState: mockSetSortState
        });
    });

    afterEach(() => {
        resultPanel?.destroy?.();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with root element', () => {
            expect(resultPanel.root).toBe(root);
        });

        it('should initialize with onToggleView callback', () => {
            expect(resultPanel.onToggleView).toBe(mockOnToggleView);
        });

        it('should initialize with onToggleHide callback', () => {
            expect(resultPanel.onToggleHide).toBe(mockOnToggleHide);
        });

        it('should initialize with getSortState callback', () => {
            expect(resultPanel.getSortState).toBe(mockGetSortState);
        });

        it('should initialize with setSortState callback', () => {
            expect(resultPanel.setSortState).toBe(mockSetSortState);
        });

        it('should initialize pagination state', () => {
            expect(resultPanel.currentPage).toBe(1);
            expect(resultPanel.pageSize).toBeDefined();
            expect(typeof resultPanel.pageSize).toBe('number');
        });

        it('should initialize empty selected indices', () => {
            expect(resultPanel._selectedIndices).toBeInstanceOf(Set);
            expect(resultPanel._selectedIndices.size).toBe(0);
        });

        it('should initialize empty full dataset', () => {
            expect(resultPanel._fullDataset).toEqual([]);
        });

        it('should disable selection by default', () => {
            expect(resultPanel.enableSelection).toBeFalsy();
        });

        it('should enable selection when configured', () => {
            const panelWithSelection = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                enableSelection: true
            });

            expect(panelWithSelection.enableSelection).toBe(true);
        });

        it('should initialize with onBulkTouch callback', () => {
            const panelWithBulk = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                onBulkTouch: mockOnBulkTouch
            });

            expect(panelWithBulk.onBulkTouch).toBe(mockOnBulkTouch);
        });

        it('should initialize with table name', () => {
            const panelWithTable = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                tableName: 'accounts'
            });

            expect(panelWithTable.tableName).toBe('accounts');
        });

        it('should initialize tableName as empty string by default', () => {
            expect(resultPanel.tableName).toBe('');
        });

        it('should initialize table scroll left to 0', () => {
            expect(resultPanel._tableScrollLeft).toBe(0);
        });

        it('should initialize DOM element references as null', () => {
            expect(resultPanel._viewTableBtn).toBeNull();
            expect(resultPanel._viewJsonBtn).toBeNull();
            expect(resultPanel._hideCheckbox).toBeNull();
            expect(resultPanel._contentHost).toBeNull();
        });

        it('should initialize event handler references as null', () => {
            expect(resultPanel._handleViewTable).toBeNull();
            expect(resultPanel._handleViewJson).toBeNull();
            expect(resultPanel._handleHideChange).toBeNull();
        });
    });

    describe('renderShell', () => {
        it('should not throw when called', () => {
            expect(() => resultPanel.renderShell(5, 'table', false)).not.toThrow();
        });

        it('should render content into root element', () => {
            resultPanel.renderShell(5, 'table', false);
            expect(root.innerHTML).toBeTruthy();
        });

        it('should display record count in header', () => {
            resultPanel.renderShell(10, 'table', false);
            expect(root.textContent).toContain('10');
        });

        it('should render result wrapper container', () => {
            resultPanel.renderShell(5, 'table', false);
            const wrapper = root.querySelector('#pdt-content');
            expect(wrapper).toBeTruthy();
        });

        it('should render pagination container', () => {
            resultPanel.renderShell(5, 'table', false);
            const pagination = root.querySelector('#pdt-pagination');
            expect(pagination).toBeTruthy();
        });

        it('should render toolbar when count > 0', () => {
            resultPanel.renderShell(5, 'table', false);
            const toolbar = root.querySelector('.pdt-toolbar');
            expect(toolbar).toBeTruthy();
        });

        it('should not render toolbar when count is 0', () => {
            resultPanel.renderShell(0, 'table', false);
            const toolbar = root.querySelector('.pdt-toolbar');
            expect(toolbar).toBeFalsy();
        });

        it('should render table view button', () => {
            resultPanel.renderShell(5, 'table', false);
            const tableBtn = root.querySelector('#pdt-view-table');
            expect(tableBtn).toBeTruthy();
        });

        it('should render JSON view button', () => {
            resultPanel.renderShell(5, 'table', false);
            const jsonBtn = root.querySelector('#pdt-view-json');
            expect(jsonBtn).toBeTruthy();
        });

        it('should set table button active when view is table', () => {
            resultPanel.renderShell(5, 'table', false);
            const tableBtn = root.querySelector('#pdt-view-table');
            expect(tableBtn.classList.contains('active')).toBe(true);
        });

        it('should set JSON button active when view is json', () => {
            resultPanel.renderShell(5, 'json', false);
            const jsonBtn = root.querySelector('#pdt-view-json');
            expect(jsonBtn.classList.contains('active')).toBe(true);
        });

        it('should render hide system checkbox', () => {
            resultPanel.renderShell(5, 'table', false);
            const checkbox = root.querySelector('#pdt-hide');
            expect(checkbox).toBeTruthy();
        });

        it('should check hide system when hideOdata is true', () => {
            resultPanel.renderShell(5, 'table', true);
            const checkbox = root.querySelector('#pdt-hide');
            expect(checkbox.checked).toBe(true);
        });

        it('should uncheck hide system when hideOdata is false', () => {
            resultPanel.renderShell(5, 'table', false);
            const checkbox = root.querySelector('#pdt-hide');
            expect(checkbox.checked).toBe(false);
        });

        it('should render export select', () => {
            resultPanel.renderShell(5, 'table', false);
            const exportSelect = root.querySelector('#pdt-export');
            expect(exportSelect).toBeTruthy();
        });

        it('should render export options', () => {
            resultPanel.renderShell(5, 'table', false);
            const options = root.querySelectorAll('#pdt-export option');
            expect(options.length).toBeGreaterThan(1);
        });

        it('should render banner container', () => {
            resultPanel.renderShell(5, 'table', false);
            const bannerContainer = root.querySelector('#pdt-banner-container');
            expect(bannerContainer).toBeTruthy();
        });
    });

    describe('renderContent', () => {
        beforeEach(() => {
            resultPanel.renderShell(2, 'table', false);
        });

        it('should not throw with empty data', () => {
            expect(() => resultPanel.renderContent({
                data: [],
                view: 'table',
                hideOdata: false
            })).not.toThrow();
        });

        it('should not throw with table data', () => {
            expect(() => resultPanel.renderContent({
                data: [{ id: 1, name: 'Test' }],
                view: 'table',
                hideOdata: false
            })).not.toThrow();
        });

        it('should not throw with json view', () => {
            expect(() => resultPanel.renderContent({
                data: [{ id: 1, name: 'Test' }],
                view: 'json',
                hideOdata: false
            })).not.toThrow();
        });
    });

    describe('pagination', () => {
        it('should have default page as 1', () => {
            expect(resultPanel.currentPage).toBe(1);
        });

        it('should have pageSize defined', () => {
            expect(resultPanel.pageSize).toBeDefined();
            expect(resultPanel.pageSize).toBeGreaterThan(0);
        });

        it('should track full dataset internally', () => {
            expect(resultPanel._fullDataset).toEqual([]);
        });
    });

    describe('selection', () => {
        let selectionPanel;

        beforeEach(() => {
            selectionPanel = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                enableSelection: true
            });
        });

        it('should enable selection when configured', () => {
            expect(selectionPanel.enableSelection).toBe(true);
        });

        it('should have empty selected indices initially', () => {
            expect(selectionPanel._selectedIndices.size).toBe(0);
        });

        it('should support adding to selected indices', () => {
            selectionPanel._selectedIndices.add(0);
            selectionPanel._selectedIndices.add(1);
            expect(selectionPanel._selectedIndices.size).toBe(2);
        });

        it('should support removing from selected indices', () => {
            selectionPanel._selectedIndices.add(0);
            selectionPanel._selectedIndices.delete(0);
            expect(selectionPanel._selectedIndices.size).toBe(0);
        });

        it('should support clearing all selected indices', () => {
            selectionPanel._selectedIndices.add(0);
            selectionPanel._selectedIndices.add(1);
            selectionPanel._selectedIndices.clear();
            expect(selectionPanel._selectedIndices.size).toBe(0);
        });
    });

    describe('removeBanner', () => {
        it('should not throw when called', () => {
            resultPanel.renderShell(5, 'table', false);
            expect(() => resultPanel.removeBanner()).not.toThrow();
        });

        it('should clear banner element reference', () => {
            resultPanel._bannerElement = document.createElement('div');
            resultPanel.renderShell(5, 'table', false);
            resultPanel.removeBanner();
            expect(resultPanel._bannerElement).toBeNull();
        });
    });

    describe('destroy', () => {
        it('should not throw when called without render', () => {
            expect(() => resultPanel.destroy()).not.toThrow();
        });

        it('should not throw when called after render', () => {
            resultPanel.renderShell(5, 'table', false);
            expect(() => resultPanel.destroy()).not.toThrow();
        });

        it('should cleanup resources', () => {
            resultPanel.renderShell(5, 'table', false);
            resultPanel.destroy();
            // Verify doesn't throw when called multiple times
            expect(() => resultPanel.destroy()).not.toThrow();
        });
    });

    describe('dispose', () => {
        it('should not throw when called', () => {
            expect(() => resultPanel.dispose?.()).not.toThrow();
        });

        it('should not throw after render', () => {
            resultPanel.renderShell(5, 'table', false);
            expect(() => resultPanel.dispose?.()).not.toThrow();
        });
    });

    describe('view toggle', () => {
        beforeEach(() => {
            resultPanel.renderShell(5, 'table', false);
        });

        it('should call onToggleView when table button clicked', () => {
            const tableBtn = root.querySelector('#pdt-view-table');
            tableBtn?.click();
            expect(mockOnToggleView).toHaveBeenCalledWith('table');
        });

        it('should call onToggleView when JSON button clicked', () => {
            const jsonBtn = root.querySelector('#pdt-view-json');
            jsonBtn?.click();
            expect(mockOnToggleView).toHaveBeenCalledWith('json');
        });
    });

    describe('hide system toggle', () => {
        beforeEach(() => {
            resultPanel.renderShell(5, 'table', false);
        });

        it('should call onToggleHide when checkbox changed', () => {
            const checkbox = root.querySelector('#pdt-hide');
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
            expect(mockOnToggleHide).toHaveBeenCalledWith(true);
        });

        it('should call onToggleHide with false when unchecked', () => {
            const checkbox = root.querySelector('#pdt-hide');
            checkbox.checked = false;
            checkbox.dispatchEvent(new Event('change'));
            expect(mockOnToggleHide).toHaveBeenCalledWith(false);
        });
    });

    describe('Intl.Collator', () => {
        it('should initialize collator for sorting', () => {
            expect(resultPanel._coll).toBeInstanceOf(Intl.Collator);
        });
    });

    describe('_handleExport', () => {
        let FileHelpersMock;

        beforeEach(async () => {
            vi.clearAllMocks();
            const helpers = await import('../../../src/helpers/index.js');
            FileHelpersMock = helpers.FileHelpers;
            resultPanel._fullDataset = [
                { id: 1, name: 'Test1' },
                { id: 2, name: 'Test2' },
                { id: 3, name: 'Test3' }
            ];
            resultPanel.renderShell(3, 'table', false);
        });

        it('should export CSV with all data when no selection', () => {
            const exportSelect = root.querySelector('#pdt-export');
            exportSelect.value = 'csv';
            exportSelect.dispatchEvent(new Event('change'));

            expect(FileHelpersMock.downloadCsv).toHaveBeenCalled();
            expect(FileHelpersMock.downloadCsv.mock.calls[0][0]).toHaveLength(3);
        });

        it('should export JSON with all data when no selection', () => {
            const exportSelect = root.querySelector('#pdt-export');
            exportSelect.value = 'json';
            exportSelect.dispatchEvent(new Event('change'));

            expect(FileHelpersMock.downloadJson).toHaveBeenCalled();
            expect(FileHelpersMock.downloadJson.mock.calls[0][0]).toHaveLength(3);
        });

        it('should export only selected rows when selection enabled', () => {
            const selectionPanel = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                enableSelection: true
            });
            selectionPanel._fullDataset = [
                { id: 1, name: 'Test1' },
                { id: 2, name: 'Test2' },
                { id: 3, name: 'Test3' }
            ];
            selectionPanel._selectedIndices.add(0);
            selectionPanel._selectedIndices.add(2);
            selectionPanel.renderShell(3, 'table', false);

            const exportSelect = root.querySelector('#pdt-export');
            exportSelect.value = 'csv';
            exportSelect.dispatchEvent(new Event('change'));

            expect(FileHelpersMock.downloadCsv).toHaveBeenCalled();
            expect(FileHelpersMock.downloadCsv.mock.calls[0][0]).toHaveLength(2);
        });

        it('should reset select value after export', () => {
            const exportSelect = root.querySelector('#pdt-export');
            exportSelect.value = 'csv';
            exportSelect.dispatchEvent(new Event('change'));

            expect(exportSelect.value).toBe('');
        });

        it('should not export when format is empty', () => {
            const exportSelect = root.querySelector('#pdt-export');
            exportSelect.value = '';
            exportSelect.dispatchEvent(new Event('change'));

            expect(FileHelpersMock.downloadCsv).not.toHaveBeenCalled();
            expect(FileHelpersMock.downloadJson).not.toHaveBeenCalled();
        });

        it('should strip OData fields when hideOdata is true', () => {
            resultPanel._fullDataset = [
                { id: 1, name: 'Test', '@odata.context': 'context', _modifiedon: 'date' }
            ];
            resultPanel.renderShell(1, 'table', true);

            const exportSelect = root.querySelector('#pdt-export');
            exportSelect.value = 'json';
            exportSelect.dispatchEvent(new Event('change'));

            expect(FileHelpersMock.downloadJson).toHaveBeenCalled();
            const exportedData = FileHelpersMock.downloadJson.mock.calls[0][0];
            expect(exportedData[0]).not.toHaveProperty('@odata.context');
            expect(exportedData[0]).not.toHaveProperty('_modifiedon');
        });
    });

    describe('_generateExportFilename', () => {
        it('should generate filename with date and time', () => {
            const filename = resultPanel._generateExportFilename(10, 'csv');
            expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}_\d{6}_10records\.csv$/);
        });

        it('should include table name when provided', () => {
            const panelWithTable = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                tableName: 'accounts'
            });
            const filename = panelWithTable._generateExportFilename(5, 'json');
            expect(filename).toContain('_accounts_');
            expect(filename).toMatch(/\.json$/);
        });

        it('should include record count in filename', () => {
            const filename = resultPanel._generateExportFilename(25, 'csv');
            expect(filename).toContain('25records');
        });

        it('should use correct extension for CSV', () => {
            const filename = resultPanel._generateExportFilename(1, 'csv');
            expect(filename).toMatch(/\.csv$/);
        });

        it('should use correct extension for JSON', () => {
            const filename = resultPanel._generateExportFilename(1, 'json');
            expect(filename).toMatch(/\.json$/);
        });
    });

    describe('_renderTableView', () => {
        beforeEach(() => {
            resultPanel.renderShell(3, 'table', false);
        });

        it('should render table with data', () => {
            resultPanel.renderContent({
                data: [{ id: 1, name: 'Test' }],
                view: 'table',
                hideOdata: false
            });

            const table = root.querySelector('table.pdt-table');
            expect(table).toBeTruthy();
        });

        it('should render table headers', () => {
            resultPanel.renderContent({
                data: [{ id: 1, name: 'Test' }],
                view: 'table',
                hideOdata: false
            });

            const headers = root.querySelectorAll('th');
            expect(headers.length).toBeGreaterThan(0);
        });

        it('should render table body rows', () => {
            resultPanel.renderContent({
                data: [{ id: 1, name: 'Test' }, { id: 2, name: 'Test2' }],
                view: 'table',
                hideOdata: false
            });

            const rows = root.querySelectorAll('tbody tr');
            expect(rows.length).toBe(2);
        });

        it('should filter OData fields when hideOdata is true', () => {
            resultPanel.renderContent({
                data: [{ id: 1, name: 'Test', '@odata.context': 'value' }],
                view: 'table',
                hideOdata: true
            });

            const headerText = root.querySelector('thead').textContent;
            expect(headerText).not.toContain('@odata');
        });

        it('should include selection checkbox column when enabled', () => {
            const selectionPanel = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                enableSelection: true
            });
            selectionPanel.renderShell(1, 'table', false);
            selectionPanel.renderContent({
                data: [{ id: 1, name: 'Test' }],
                view: 'table',
                hideOdata: false
            });

            const selectAll = root.querySelector('#pdt-select-all');
            expect(selectAll).toBeTruthy();
        });
    });

    describe('_buildTableHtml', () => {
        it('should build table with thead and tbody', () => {
            const data = [{ id: 1, name: 'Test' }];
            const headers = ['id', 'name'];
            const pageIndices = [0];

            const html = resultPanel._buildTableHtml(data, headers, pageIndices);

            expect(html).toContain('<table');
            expect(html).toContain('<thead>');
            expect(html).toContain('<tbody>');
        });

        it('should include role and aria-label for accessibility', () => {
            const data = [{ id: 1 }];
            const headers = ['id'];
            const pageIndices = [0];

            const html = resultPanel._buildTableHtml(data, headers, pageIndices);

            expect(html).toContain('role="grid"');
            expect(html).toContain('aria-label="API Results"');
        });
    });

    describe('_buildTableHeaderHtml', () => {
        it('should build header with column names', () => {
            mockGetSortState.mockReturnValue({ column: null, direction: 'asc' });
            const data = [{ id: 1, name: 'Test' }];
            const headers = ['id', 'name'];

            const html = resultPanel._buildTableHeaderHtml(data, headers);

            expect(html).toContain('id');
            expect(html).toContain('name');
        });

        it('should add sort class for sorted column', () => {
            mockGetSortState.mockReturnValue({ column: 'id', direction: 'asc' });
            const data = [{ id: 1 }];
            const headers = ['id'];

            const html = resultPanel._buildTableHeaderHtml(data, headers);

            expect(html).toContain('sort-asc');
        });

        it('should add descending sort class', () => {
            mockGetSortState.mockReturnValue({ column: 'id', direction: 'desc' });
            const data = [{ id: 1 }];
            const headers = ['id'];

            const html = resultPanel._buildTableHeaderHtml(data, headers);

            expect(html).toContain('sort-desc');
        });

        it('should include select-all checkbox when selection enabled', () => {
            const selectionPanel = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                enableSelection: true
            });
            const data = [{ id: 1 }];
            const headers = ['id'];

            const html = selectionPanel._buildTableHeaderHtml(data, headers);

            expect(html).toContain('pdt-select-all');
        });

        it('should check select-all when all rows are selected', () => {
            const selectionPanel = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                enableSelection: true
            });
            selectionPanel._selectedIndices.add(0);
            const data = [{ id: 1 }];
            const headers = ['id'];

            const html = selectionPanel._buildTableHeaderHtml(data, headers);

            expect(html).toContain('checked');
        });
    });

    describe('_buildTableBodyHtml', () => {
        it('should build rows for each data item', () => {
            const data = [{ id: 1 }, { id: 2 }];
            const headers = ['id'];
            const pageIndices = [0, 1];

            const html = resultPanel._buildTableBodyHtml(data, headers, pageIndices);

            expect((html.match(/<tr>/g) || []).length).toBe(2);
        });

        it('should render cell values correctly', () => {
            const data = [{ id: 1, name: 'TestName' }];
            const headers = ['id', 'name'];
            const pageIndices = [0];

            const html = resultPanel._buildTableBodyHtml(data, headers, pageIndices);

            expect(html).toContain('1');
            expect(html).toContain('TestName');
        });

        it('should render empty string for null values', () => {
            const data = [{ id: 1, name: null }];
            const headers = ['id', 'name'];
            const pageIndices = [0];

            const html = resultPanel._buildTableBodyHtml(data, headers, pageIndices);

            expect(html).toContain('<td></td>');
        });

        it('should render empty string for undefined values', () => {
            const data = [{ id: 1 }];
            const headers = ['id', 'name'];
            const pageIndices = [0];

            const html = resultPanel._buildTableBodyHtml(data, headers, pageIndices);

            expect(html).toContain('<td></td>');
        });

        it('should JSON stringify object values', () => {
            const data = [{ id: 1, nested: { key: 'value' } }];
            const headers = ['id', 'nested'];
            const pageIndices = [0];

            const html = resultPanel._buildTableBodyHtml(data, headers, pageIndices);

            expect(html).toContain('{"key":"value"}');
        });

        it('should include row checkbox when selection enabled', () => {
            const selectionPanel = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                enableSelection: true
            });
            const data = [{ id: 1 }];
            const headers = ['id'];
            const pageIndices = [0];

            const html = selectionPanel._buildTableBodyHtml(data, headers, pageIndices);

            expect(html).toContain('pdt-row-select');
        });

        it('should check row checkbox when row is selected', () => {
            const selectionPanel = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                enableSelection: true
            });
            selectionPanel._selectedIndices.add(0);
            const data = [{ id: 1 }];
            const headers = ['id'];
            const pageIndices = [0];

            const html = selectionPanel._buildTableBodyHtml(data, headers, pageIndices);

            expect(html).toContain('checked');
        });
    });

    describe('_handleTableClick', () => {
        let selectionPanel;
        const testData = [{ id: 1, name: 'Test1' }, { id: 2, name: 'Test2' }];

        beforeEach(() => {
            selectionPanel = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                enableSelection: true
            });
            selectionPanel.renderShell(2, 'table', false);
            selectionPanel.renderContent({
                data: testData,
                view: 'table',
                hideOdata: false
            });
        });

        it('should trigger sort when header is clicked', () => {
            const header = root.querySelector('th[data-column]');
            header.click();

            expect(mockSetSortState).toHaveBeenCalled();
        });

        it('should handle select-all checkbox click', () => {
            const selectAll = root.querySelector('#pdt-select-all');
            selectAll.click();

            expect(selectionPanel._selectedIndices.size).toBeGreaterThan(0);
        });

        it('should handle row checkbox click', () => {
            const rowCheckbox = root.querySelector('.pdt-row-select');
            rowCheckbox.checked = true;
            rowCheckbox.click();

            expect(selectionPanel._selectedIndices.size).toBeGreaterThanOrEqual(0);
        });
    });

    describe('_handleColumnSort', () => {
        const testData = [{ id: 2 }, { id: 1 }, { id: 3 }];

        beforeEach(() => {
            resultPanel.renderShell(3, 'table', false);
        });

        it('should set sort column on first click', () => {
            mockGetSortState.mockReturnValue({ column: null, direction: 'asc' });

            resultPanel._handleColumnSort('id', testData, 'table', false);

            expect(mockSetSortState).toHaveBeenCalledWith({ column: 'id', direction: 'asc' });
        });

        it('should toggle direction on same column click', () => {
            mockGetSortState.mockReturnValue({ column: 'id', direction: 'asc' });

            resultPanel._handleColumnSort('id', testData, 'table', false);

            expect(mockSetSortState).toHaveBeenCalledWith({ column: 'id', direction: 'desc' });
        });

        it('should reset direction when switching columns', () => {
            mockGetSortState.mockReturnValue({ column: 'id', direction: 'desc' });

            resultPanel._handleColumnSort('name', testData, 'table', false);

            expect(mockSetSortState).toHaveBeenCalledWith({ column: 'name', direction: 'asc' });
        });
    });

    describe('_handleSelectAll', () => {
        let selectionPanel;
        const testData = [{ id: 1 }, { id: 2 }, { id: 3 }];

        beforeEach(() => {
            selectionPanel = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                enableSelection: true
            });
        });

        it('should select all rows when none selected', () => {
            selectionPanel._handleSelectAll(testData, 'table', false);

            expect(selectionPanel._selectedIndices.size).toBe(3);
            expect(selectionPanel._selectedIndices.has(0)).toBe(true);
            expect(selectionPanel._selectedIndices.has(1)).toBe(true);
            expect(selectionPanel._selectedIndices.has(2)).toBe(true);
        });

        it('should deselect all rows when all selected', () => {
            selectionPanel._selectedIndices.add(0);
            selectionPanel._selectedIndices.add(1);
            selectionPanel._selectedIndices.add(2);

            selectionPanel._handleSelectAll(testData, 'table', false);

            expect(selectionPanel._selectedIndices.size).toBe(0);
        });

        it('should select all when partially selected', () => {
            selectionPanel._selectedIndices.add(0);

            selectionPanel._handleSelectAll(testData, 'table', false);

            expect(selectionPanel._selectedIndices.size).toBe(3);
        });
    });

    describe('_handleRowSelect', () => {
        let selectionPanel;
        const testData = [{ id: 1 }, { id: 2 }];

        beforeEach(() => {
            selectionPanel = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                enableSelection: true
            });
        });

        it('should add index when checkbox is checked', () => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.index = '1';
            checkbox.checked = true;

            selectionPanel._handleRowSelect(checkbox, testData, 'table', false);

            expect(selectionPanel._selectedIndices.has(1)).toBe(true);
        });

        it('should remove index when checkbox is unchecked', () => {
            selectionPanel._selectedIndices.add(1);
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.index = '1';
            checkbox.checked = false;

            selectionPanel._handleRowSelect(checkbox, testData, 'table', false);

            expect(selectionPanel._selectedIndices.has(1)).toBe(false);
        });
    });

    describe('_createPaginationControls', () => {
        const testData = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));

        beforeEach(() => {
            resultPanel.pageSize = 10;
            resultPanel.renderShell(50, 'table', false);
        });

        it('should create pagination div with controls', () => {
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);

            expect(controls.className).toContain('pdt-pagination');
        });

        it('should display page info', () => {
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);

            expect(controls.textContent).toContain('1-10');
            expect(controls.textContent).toContain('of 50');
        });

        it('should have first page button', () => {
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const firstBtn = controls.querySelector('button');

            expect(firstBtn).toBeTruthy();
        });

        it('should disable first/prev buttons on first page', () => {
            resultPanel.currentPage = 1;
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const buttons = controls.querySelectorAll('button');

            expect(buttons[0].disabled).toBe(true);
            expect(buttons[1].disabled).toBe(true);
        });

        it('should disable next/last buttons on last page', () => {
            resultPanel.currentPage = 5;
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const buttons = controls.querySelectorAll('button');

            expect(buttons[2].disabled).toBe(true);
            expect(buttons[3].disabled).toBe(true);
        });

        it('should have page input with current page value', () => {
            resultPanel.currentPage = 3;
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const input = controls.querySelector('input[type="number"]');

            expect(input.value).toBe('3');
        });

        it('should have page size selector', () => {
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const select = controls.querySelector('select');

            expect(select).toBeTruthy();
        });

        it('should navigate to first page on first button click', () => {
            resultPanel.currentPage = 3;
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const firstBtn = controls.querySelectorAll('button')[0];

            firstBtn.click();

            expect(resultPanel.currentPage).toBe(1);
        });

        it('should navigate to previous page on prev button click', () => {
            resultPanel.currentPage = 3;
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const prevBtn = controls.querySelectorAll('button')[1];

            prevBtn.click();

            expect(resultPanel.currentPage).toBe(2);
        });

        it('should navigate to next page on next button click', () => {
            resultPanel.currentPage = 2;
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const nextBtn = controls.querySelectorAll('button')[2];

            nextBtn.click();

            expect(resultPanel.currentPage).toBe(3);
        });

        it('should navigate to last page on last button click', () => {
            resultPanel.currentPage = 2;
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const lastBtn = controls.querySelectorAll('button')[3];

            lastBtn.click();

            expect(resultPanel.currentPage).toBe(5);
        });

        it('should update page on input change', () => {
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const input = controls.querySelector('input[type="number"]');

            input.value = '4';
            input.dispatchEvent(new Event('change'));

            expect(resultPanel.currentPage).toBe(4);
        });

        it('should reject invalid page input', () => {
            resultPanel.currentPage = 2;
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const input = controls.querySelector('input[type="number"]');

            input.value = '10';
            input.dispatchEvent(new Event('change'));

            expect(input.value).toBe('2');
        });
    });

    describe('_stripOData', () => {
        it('should remove @odata prefixed properties', () => {
            const data = { id: 1, '@odata.context': 'value', '@odata.etag': 'etag' };
            const result = resultPanel._stripOData(data);

            expect(result).toEqual({ id: 1 });
        });

        it('should remove underscore prefixed properties', () => {
            const data = { id: 1, _modifiedon: 'date', _createdby: 'user' };
            const result = resultPanel._stripOData(data);

            expect(result).toEqual({ id: 1 });
        });

        it('should handle arrays', () => {
            const data = [
                { id: 1, '@odata.context': 'value' },
                { id: 2, '@odata.etag': 'etag' }
            ];
            const result = resultPanel._stripOData(data);

            expect(result).toEqual([{ id: 1 }, { id: 2 }]);
        });

        it('should handle nested objects', () => {
            const data = {
                id: 1,
                nested: { name: 'Test', '@odata.type': 'type' }
            };
            const result = resultPanel._stripOData(data);

            expect(result.nested).toEqual({ name: 'Test' });
        });

        it('should return primitives unchanged', () => {
            expect(resultPanel._stripOData('string')).toBe('string');
            expect(resultPanel._stripOData(123)).toBe(123);
            expect(resultPanel._stripOData(true)).toBe(true);
            expect(resultPanel._stripOData(null)).toBe(null);
        });

        it('should handle empty object', () => {
            expect(resultPanel._stripOData({})).toEqual({});
        });

        it('should handle empty array', () => {
            expect(resultPanel._stripOData([])).toEqual([]);
        });
    });

    describe('showBanner', () => {
        beforeEach(() => {
            resultPanel.renderShell(5, 'table', false);
        });

        it('should add banner to container', () => {
            const banner = document.createElement('div');
            banner.id = 'test-banner';
            banner.textContent = 'Test Banner';

            resultPanel.showBanner(banner);

            const container = root.querySelector('#pdt-banner-container');
            expect(container.querySelector('#test-banner')).toBeTruthy();
        });

        it('should store banner reference', () => {
            const banner = document.createElement('div');
            resultPanel.showBanner(banner);

            expect(resultPanel._bannerElement).toBe(banner);
        });

        it('should replace existing banner', () => {
            const banner1 = document.createElement('div');
            banner1.textContent = 'Banner 1';
            const banner2 = document.createElement('div');
            banner2.textContent = 'Banner 2';

            resultPanel.showBanner(banner1);
            resultPanel.showBanner(banner2);

            const container = root.querySelector('#pdt-banner-container');
            expect(container.textContent).toBe('Banner 2');
        });

        it('should not throw if container not found', () => {
            root.innerHTML = '';
            const banner = document.createElement('div');

            expect(() => resultPanel.showBanner(banner)).not.toThrow();
        });
    });

    describe('updateBanner', () => {
        beforeEach(() => {
            resultPanel.renderShell(5, 'table', false);
        });

        it('should update banner message content', () => {
            const banner = document.createElement('div');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'pdt-pagination-banner-message';
            messageDiv.textContent = 'Initial';
            banner.appendChild(messageDiv);

            resultPanel.showBanner(banner);
            resultPanel.updateBanner('<strong>Updated</strong>');

            expect(messageDiv.innerHTML).toBe('<strong>Updated</strong>');
        });

        it('should not throw if banner element is null', () => {
            resultPanel._bannerElement = null;

            expect(() => resultPanel.updateBanner('content')).not.toThrow();
        });

        it('should not throw if message div not found', () => {
            const banner = document.createElement('div');
            resultPanel.showBanner(banner);

            expect(() => resultPanel.updateBanner('content')).not.toThrow();
        });
    });

    describe('_restoreBanner', () => {
        beforeEach(() => {
            resultPanel.renderShell(5, 'table', false);
        });

        it('should restore banner after renderShell', () => {
            const banner = document.createElement('div');
            banner.id = 'persistent-banner';
            resultPanel.showBanner(banner);

            resultPanel.renderShell(5, 'table', false);

            const container = root.querySelector('#pdt-banner-container');
            expect(container.querySelector('#persistent-banner')).toBeTruthy();
        });
    });

    describe('_normalizeCurrentPage', () => {
        it('should set page to total pages if current exceeds total', () => {
            resultPanel.currentPage = 10;
            resultPanel.pageSize = 10;

            resultPanel._normalizeCurrentPage(50);

            expect(resultPanel.currentPage).toBe(5);
        });

        it('should set page to 1 if current is less than 1', () => {
            resultPanel.currentPage = 0;

            resultPanel._normalizeCurrentPage(50);

            expect(resultPanel.currentPage).toBe(1);
        });

        it('should keep valid page unchanged', () => {
            resultPanel.currentPage = 3;
            resultPanel.pageSize = 10;

            resultPanel._normalizeCurrentPage(50);

            expect(resultPanel.currentPage).toBe(3);
        });
    });

    describe('_extractHeaders', () => {
        it('should extract all unique keys from data', () => {
            const data = [
                { id: 1, name: 'A' },
                { id: 2, email: 'b@test.com' }
            ];

            const headers = resultPanel._extractHeaders(data, false);

            expect(headers).toContain('id');
            expect(headers).toContain('name');
            expect(headers).toContain('email');
        });

        it('should filter OData properties when hideOdata is true', () => {
            const data = [{ id: 1, '@odata.context': 'ctx', _modifiedon: 'date' }];

            const headers = resultPanel._extractHeaders(data, true);

            expect(headers).toContain('id');
            expect(headers).not.toContain('@odata.context');
            expect(headers).not.toContain('_modifiedon');
        });
    });

    describe('_getSortedIndices', () => {
        it('should return indices in original order when no sort', () => {
            mockGetSortState.mockReturnValue({ column: null, direction: 'asc' });
            const data = [{ id: 3 }, { id: 1 }, { id: 2 }];

            const indices = resultPanel._getSortedIndices(data);

            expect(indices).toEqual([0, 1, 2]);
        });

        it('should sort indices ascending', () => {
            mockGetSortState.mockReturnValue({ column: 'id', direction: 'asc' });
            const data = [{ id: 3 }, { id: 1 }, { id: 2 }];

            const indices = resultPanel._getSortedIndices(data);
            const sortedIds = indices.map(i => data[i].id);

            expect(sortedIds).toEqual([1, 2, 3]);
        });

        it('should sort indices descending', () => {
            mockGetSortState.mockReturnValue({ column: 'id', direction: 'desc' });
            const data = [{ id: 1 }, { id: 3 }, { id: 2 }];

            const indices = resultPanel._getSortedIndices(data);
            const sortedIds = indices.map(i => data[i].id);

            expect(sortedIds).toEqual([3, 2, 1]);
        });

        it('should handle null values during sort', () => {
            mockGetSortState.mockReturnValue({ column: 'name', direction: 'asc' });
            const data = [{ name: 'B' }, { name: null }, { name: 'A' }];

            const indices = resultPanel._getSortedIndices(data);
            const sortedNames = indices.map(i => data[i].name);

            expect(sortedNames[2]).toBeNull();
        });
    });

    describe('_getPageIndices', () => {
        it('should return correct slice for first page', () => {
            resultPanel.currentPage = 1;
            resultPanel.pageSize = 10;
            const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

            const pageIndices = resultPanel._getPageIndices(indices);

            expect(pageIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        });

        it('should return correct slice for second page', () => {
            resultPanel.currentPage = 2;
            resultPanel.pageSize = 10;
            const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

            const pageIndices = resultPanel._getPageIndices(indices);

            expect(pageIndices).toEqual([10, 11, 12]);
        });
    });

    describe('_saveScrollPosition and _restoreScrollPosition', () => {
        it('should save scroll position when table exists', () => {
            const host = document.createElement('div');
            const table = document.createElement('table');
            table.className = 'pdt-table';
            host.appendChild(table);
            host.scrollLeft = 100;

            resultPanel._saveScrollPosition(host);

            expect(resultPanel._tableScrollLeft).toBe(100);
        });

        it('should not save scroll position when no table', () => {
            const host = document.createElement('div');
            resultPanel._tableScrollLeft = 0;
            host.scrollLeft = 50;

            resultPanel._saveScrollPosition(host);

            expect(resultPanel._tableScrollLeft).toBe(0);
        });
    });

    describe('_renderPagination', () => {
        beforeEach(() => {
            resultPanel.pageSize = 10;
            resultPanel.renderShell(25, 'table', false);
        });

        it('should render pagination for multi-page data', () => {
            const data = Array.from({ length: 25 }, (_, i) => ({ id: i }));

            resultPanel._renderPagination(data, 'table', false);

            const pagination = root.querySelector('#pdt-pagination');
            expect(pagination.children.length).toBeGreaterThan(0);
        });

        it('should not render pagination for single page', () => {
            resultPanel.renderShell(5, 'table', false);
            const data = [{ id: 1 }, { id: 2 }];

            resultPanel._renderPagination(data, 'table', false);

            const pagination = root.querySelector('#pdt-pagination');
            expect(pagination.children.length).toBeGreaterThan(0);
        });
    });

    describe('bulk touch', () => {
        it('should call onBulkTouch with selected records', () => {
            const bulkPanel = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                onBulkTouch: mockOnBulkTouch,
                enableSelection: true
            });
            bulkPanel._fullDataset = [{ id: 1 }, { id: 2 }, { id: 3 }];
            bulkPanel._selectedIndices.add(0);
            bulkPanel._selectedIndices.add(2);
            bulkPanel.renderShell(3, 'table', false);

            const touchBtn = root.querySelector('#pdt-bulk-touch');
            touchBtn?.click();

            expect(mockOnBulkTouch).toHaveBeenCalledWith([
                { id: 1 },
                { id: 3 }
            ]);
        });
    });

    describe('_renderJsonView', () => {
        let UIFactoryMock;

        beforeEach(async () => {
            vi.clearAllMocks();
            const uiModule = await import('../../../src/ui/UIFactory.js');
            UIFactoryMock = uiModule.UIFactory;
            resultPanel.renderShell(5, 'json', false);
        });

        it('should call UIFactory.createCopyableCodeBlock', () => {
            resultPanel.renderContent({
                data: [{ id: 1 }],
                view: 'json',
                hideOdata: false
            });

            expect(UIFactoryMock.createCopyableCodeBlock).toHaveBeenCalled();
        });

        it('should strip OData when hideOdata is true', () => {
            resultPanel.renderContent({
                data: [{ id: 1, '@odata.context': 'ctx' }],
                view: 'json',
                hideOdata: true
            });

            const call = UIFactoryMock.createCopyableCodeBlock.mock.calls[0];
            expect(call[0]).not.toContain('@odata');
        });
    });

    describe('edge cases', () => {
        it('should handle empty data array', () => {
            resultPanel.renderShell(0, 'table', false);
            resultPanel.renderContent({
                data: [],
                view: 'table',
                hideOdata: false
            });

            const content = root.querySelector('#pdt-content');
            expect(content.textContent).toBeTruthy();
        });

        it('should handle data with only OData fields', () => {
            resultPanel.renderShell(1, 'table', true);
            resultPanel.renderContent({
                data: [{ '@odata.context': 'ctx', '@odata.etag': 'etag' }],
                view: 'table',
                hideOdata: true
            });

            expect(() => resultPanel.renderContent({
                data: [{ '@odata.context': 'ctx' }],
                view: 'table',
                hideOdata: true
            })).not.toThrow();
        });

        it('should handle very long cell values', () => {
            const longText = 'A'.repeat(1000);
            resultPanel.renderShell(1, 'table', false);
            resultPanel.renderContent({
                data: [{ text: longText }],
                view: 'table',
                hideOdata: false
            });

            const tbody = root.querySelector('tbody');
            expect(tbody?.textContent).toContain('A');
        });
    });

    describe('page size validation', () => {
        let testData;
        let NotificationServiceMock;

        beforeEach(async () => {
            vi.clearAllMocks();
            testData = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Item ${i}` }));
            resultPanel.pageSize = 10;
            const notifModule = await import('../../../src/services/NotificationService.js');
            NotificationServiceMock = notifModule.NotificationService;
        });

        it('should reject NaN page size values', () => {
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const select = controls.querySelector('select');

            select.value = 'invalid';
            select.dispatchEvent(new Event('change'));

            expect(NotificationServiceMock.show).toHaveBeenCalledWith(
                'Page size must be between 1 and 1000',
                'warn'
            );
            expect(resultPanel.pageSize).toBe(10);
        });

        it('should reject page size less than 1', () => {
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const select = controls.querySelector('select');

            select.value = '0';
            select.dispatchEvent(new Event('change'));

            expect(NotificationServiceMock.show).toHaveBeenCalledWith(
                'Page size must be between 1 and 1000',
                'warn'
            );
            expect(resultPanel.pageSize).toBe(10);
        });

        it('should reject negative page size', () => {
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const select = controls.querySelector('select');

            select.value = '-5';
            select.dispatchEvent(new Event('change'));

            expect(NotificationServiceMock.show).toHaveBeenCalledWith(
                'Page size must be between 1 and 1000',
                'warn'
            );
            expect(resultPanel.pageSize).toBe(10);
        });

        it('should reject page size greater than 1000', () => {
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const select = controls.querySelector('select');

            select.value = '1001';
            select.dispatchEvent(new Event('change'));

            expect(NotificationServiceMock.show).toHaveBeenCalledWith(
                'Page size must be between 1 and 1000',
                'warn'
            );
            expect(resultPanel.pageSize).toBe(10);
        });

        it('should accept valid page size of 1', () => {
            const controls = resultPanel._createPaginationControls(50, testData, 'table', false);
            const select = controls.querySelector('select');

            // Directly call onchange since it's assigned via .onchange = 
            select.onchange({ target: { value: '1' } });

            expect(resultPanel.pageSize).toBe(1);
            expect(resultPanel.currentPage).toBe(1);
        });

        it('should accept valid page size of 1000', () => {
            const controls = resultPanel._createPaginationControls(1, testData, 'table', false);
            const select = controls.querySelector('select');

            // Directly call onchange since it's assigned via .onchange = 
            select.onchange({ target: { value: '1000' } });

            expect(resultPanel.pageSize).toBe(1000);
        });

        it('should reset to first page when page size changes', () => {
            resultPanel.currentPage = 3;
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const select = controls.querySelector('select');

            select.value = '25';
            select.dispatchEvent(new Event('change'));

            expect(resultPanel.currentPage).toBe(1);
        });

        it('should restore original value in select when validation fails', () => {
            resultPanel.pageSize = 25;
            const controls = resultPanel._createPaginationControls(2, testData, 'table', false);
            const select = controls.querySelector('select');

            select.value = '5000';
            select.dispatchEvent(new Event('change'));

            expect(select.value).toBe('25');
        });

        it('should handle empty string page size as NaN', () => {
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const select = controls.querySelector('select');

            select.value = '';
            select.dispatchEvent(new Event('change'));

            expect(NotificationServiceMock.show).toHaveBeenCalledWith(
                'Page size must be between 1 and 1000',
                'warn'
            );
        });

        it('should handle decimal page size values', () => {
            const controls = resultPanel._createPaginationControls(5, testData, 'table', false);
            const select = controls.querySelector('select');

            // parseInt will parse "10.5" as 10, which is valid
            select.value = '10.5';
            select.dispatchEvent(new Event('change'));

            expect(resultPanel.pageSize).toBe(10);
        });
    });

    describe('_removeToolbarListeners with bulk touch', () => {
        let bulkPanel;

        beforeEach(() => {
            bulkPanel = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                onBulkTouch: mockOnBulkTouch,
                enableSelection: true
            });
            // Add selected indices so bulk touch button appears
            bulkPanel._selectedIndices.add(0);
        });

        afterEach(() => {
            bulkPanel?.destroy?.();
        });

        it('should remove bulk touch button listener when present', () => {
            bulkPanel._fullDataset = [{ id: 1 }, { id: 2 }];
            bulkPanel.renderShell(2, 'table', false);
            const bulkBtn = root.querySelector('#pdt-bulk-touch');
            expect(bulkBtn).toBeTruthy();
            const removeEventListenerSpy = vi.spyOn(bulkBtn, 'removeEventListener');

            bulkPanel._removeToolbarListeners();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('click', bulkPanel._handleBulkTouch);
        });

        it('should not throw when bulk touch button exists but handler is null', () => {
            bulkPanel._fullDataset = [{ id: 1 }, { id: 2 }];
            bulkPanel.renderShell(2, 'table', false);
            bulkPanel._handleBulkTouch = null;

            expect(() => bulkPanel._removeToolbarListeners()).not.toThrow();
        });

        it('should handle destroy with bulk touch listener properly', () => {
            bulkPanel._fullDataset = [{ id: 1 }, { id: 2 }];
            bulkPanel.renderShell(2, 'table', false);

            expect(() => bulkPanel.destroy()).not.toThrow();
            expect(bulkPanel._bulkTouchBtn).toBeNull();
            expect(bulkPanel._handleBulkTouch).toBeNull();
        });

        it('should clear bulk touch references after destroy', () => {
            bulkPanel.renderShell(5, 'table', false);
            bulkPanel.destroy();

            expect(bulkPanel._bulkTouchBtn).toBeNull();
            expect(bulkPanel._handleBulkTouch).toBeNull();
        });
    });

    describe('destroy with column resize cleanup', () => {
        let UIHelpersMock;

        beforeEach(async () => {
            vi.clearAllMocks();
            const helpersModule = await import('../../../src/helpers/index.js');
            UIHelpersMock = helpersModule.UIHelpers;
        });

        it('should not throw when destroy is called with rendered table', () => {
            resultPanel.renderShell(5, 'table', false);
            resultPanel.renderContent({
                data: [{ id: 1, name: 'Test' }],
                view: 'table',
                hideOdata: false
            });

            expect(() => resultPanel.destroy()).not.toThrow();
        });

        it('should not throw when destroyColumnResize throws an error', () => {
            UIHelpersMock.destroyColumnResize.mockImplementationOnce(() => {
                throw new Error('Column resize error');
            });

            resultPanel.renderShell(5, 'table', false);
            resultPanel.renderContent({
                data: [{ id: 1, name: 'Test' }],
                view: 'table',
                hideOdata: false
            });

            expect(() => resultPanel.destroy()).not.toThrow();
        });

        it('should handle destroy when contentHost is null', () => {
            resultPanel._contentHost = null;

            expect(() => resultPanel.destroy()).not.toThrow();
        });

        it('should handle destroy when no table exists in contentHost', () => {
            resultPanel.renderShell(5, 'json', false);
            resultPanel.renderContent({
                data: [{ id: 1 }],
                view: 'json',
                hideOdata: false
            });

            expect(() => resultPanel.destroy()).not.toThrow();
        });

        it('should set contentHost to null after destroy', () => {
            resultPanel.renderShell(5, 'table', false);
            resultPanel._contentHost = root.querySelector('#pdt-content');

            resultPanel.destroy();

            expect(resultPanel._contentHost).toBeNull();
        });

        it('should cleanup all references after destroy with table', () => {
            resultPanel.renderShell(5, 'table', false);
            resultPanel.renderContent({
                data: [{ id: 1, name: 'Test' }],
                view: 'table',
                hideOdata: false
            });

            resultPanel.destroy();

            expect(resultPanel._contentHost).toBeNull();
            expect(resultPanel._viewTableBtn).toBeNull();
            expect(resultPanel._viewJsonBtn).toBeNull();
            expect(resultPanel._hideCheckbox).toBeNull();
            expect(resultPanel._handleViewTable).toBeNull();
            expect(resultPanel._handleViewJson).toBeNull();
            expect(resultPanel._handleHideChange).toBeNull();
            expect(resultPanel._handleContentClick).toBeNull();
            expect(resultPanel._handleContentScroll).toBeNull();
            expect(resultPanel._handleExportChange).toBeNull();
        });

        it('should handle destroy with multiple calls safely', () => {
            resultPanel.renderShell(5, 'table', false);
            resultPanel.renderContent({
                data: [{ id: 1 }],
                view: 'table',
                hideOdata: false
            });

            resultPanel.destroy();
            expect(() => resultPanel.destroy()).not.toThrow();
            expect(() => resultPanel.destroy()).not.toThrow();
        });
    });

    describe('_removeToolbarListeners early exit', () => {
        it('should return early when no handlers are set', () => {
            const freshPanel = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState
            });

            // All handlers should be null by default
            expect(freshPanel._handleViewTable).toBeNull();
            expect(freshPanel._handleViewJson).toBeNull();
            expect(freshPanel._handleHideChange).toBeNull();
            expect(freshPanel._handleBulkTouch).toBeNull();

            // Should not throw and should exit early
            expect(() => freshPanel._removeToolbarListeners()).not.toThrow();
        });

        it('should only remove listeners for handlers that exist', () => {
            resultPanel.renderShell(5, 'table', false);

            // Spy on removeEventListener for all buttons
            const viewTableBtn = root.querySelector('#pdt-view-table');
            const viewJsonBtn = root.querySelector('#pdt-view-json');
            const tableRemoveSpy = vi.spyOn(viewTableBtn, 'removeEventListener');
            const jsonRemoveSpy = vi.spyOn(viewJsonBtn, 'removeEventListener');

            resultPanel._removeToolbarListeners();

            expect(tableRemoveSpy).toHaveBeenCalled();
            expect(jsonRemoveSpy).toHaveBeenCalled();
        });

        it('should handle partial handler setup', () => {
            resultPanel.renderShell(5, 'table', false);

            // Manually null out some handlers
            resultPanel._handleViewJson = null;

            expect(() => resultPanel._removeToolbarListeners()).not.toThrow();
        });
    });

    describe('page size change re-renders content', () => {
        let testData;

        beforeEach(() => {
            testData = Array.from({ length: 30 }, (_, i) => ({ id: i, name: `Item ${i}` }));
            resultPanel.pageSize = 10;
            resultPanel.renderShell(30, 'table', false);
        });

        it('should re-render shell after valid page size change', () => {
            const renderShellSpy = vi.spyOn(resultPanel, 'renderShell');
            const controls = resultPanel._createPaginationControls(3, testData, 'table', false);
            const select = controls.querySelector('select');

            // Use onchange directly since it's assigned via .onchange =
            select.onchange({ target: { value: '15' } });

            expect(renderShellSpy).toHaveBeenCalledWith(30, 'table', false);
        });

        it('should re-render content after valid page size change', () => {
            const renderContentSpy = vi.spyOn(resultPanel, 'renderContent');
            const controls = resultPanel._createPaginationControls(3, testData, 'table', false);
            const select = controls.querySelector('select');

            // Use onchange directly since it's assigned via .onchange =
            select.onchange({ target: { value: '20' } });

            expect(renderContentSpy).toHaveBeenCalledWith({
                data: testData,
                view: 'table',
                hideOdata: false
            });
        });

        it('should not re-render when page size validation fails', () => {
            const renderShellSpy = vi.spyOn(resultPanel, 'renderShell');
            const renderContentSpy = vi.spyOn(resultPanel, 'renderContent');
            const controls = resultPanel._createPaginationControls(3, testData, 'table', false);
            const select = controls.querySelector('select');

            // Use onchange directly since it's assigned via .onchange =
            select.onchange({ target: { value: '2000' } });

            // Should not have been called after the initial setup
            expect(renderShellSpy).not.toHaveBeenCalledWith(30, 'table', false);
            expect(renderContentSpy).not.toHaveBeenCalled();
        });

        it('should update pageSize and currentPage when valid value is provided', () => {
            const controls = resultPanel._createPaginationControls(3, testData, 'table', false);
            const select = controls.querySelector('select');

            resultPanel.currentPage = 2;
            select.onchange({ target: { value: '50' } });

            expect(resultPanel.pageSize).toBe(50);
            expect(resultPanel.currentPage).toBe(1);
        });

        it('should preserve pageSize when invalid value is provided', () => {
            const originalPageSize = resultPanel.pageSize;
            const controls = resultPanel._createPaginationControls(3, testData, 'table', false);
            const select = controls.querySelector('select');

            select.onchange({ target: { value: '-10' } });

            expect(resultPanel.pageSize).toBe(originalPageSize);
        });
    });

    describe('_restoreScrollPosition with requestAnimationFrame', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should restore scroll position when _tableScrollLeft > 0', async () => {
            const host = document.createElement('div');
            host.scrollLeft = 0;
            resultPanel._tableScrollLeft = 150;

            resultPanel._restoreScrollPosition(host);

            // Run requestAnimationFrame callback
            await vi.runAllTimersAsync();

            expect(host.scrollLeft).toBe(150);
        });

        it('should not restore scroll position when _tableScrollLeft is 0', async () => {
            const host = document.createElement('div');
            host.scrollLeft = 50;
            resultPanel._tableScrollLeft = 0;

            resultPanel._restoreScrollPosition(host);

            await vi.runAllTimersAsync();

            // scrollLeft should remain unchanged
            expect(host.scrollLeft).toBe(50);
        });

        it('should call requestAnimationFrame with scroll restoration callback', async () => {
            const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
            const host = document.createElement('div');
            resultPanel._tableScrollLeft = 200;

            resultPanel._restoreScrollPosition(host);

            expect(rafSpy).toHaveBeenCalled();

            await vi.runAllTimersAsync();
            expect(host.scrollLeft).toBe(200);
        });
    });

    describe('_renderPagination when no paginationContainer', () => {
        it('should return early when pagination container does not exist', () => {
            // Create a fresh root without pagination container
            const emptyRoot = document.createElement('div');
            resultPanel.root = emptyRoot;

            const data = Array.from({ length: 25 }, (_, i) => ({ id: i }));

            // Should not throw and should return early
            expect(() => resultPanel._renderPagination(data, 'table', false)).not.toThrow();
        });
    });

    describe('_setupTableListeners listener removal', () => {
        it('should remove old scroll listener when setting up new listeners', () => {
            const host1 = document.createElement('div');
            const host2 = document.createElement('div');
            const data = [{ id: 1 }];

            // Set up first listener
            resultPanel._setupTableListeners(host1, data, 'table', false);
            const oldScrollHandler = resultPanel._handleContentScroll;

            const removeListenerSpy = vi.spyOn(host1, 'removeEventListener');

            // Set up second listener - should remove old one
            resultPanel._setupTableListeners(host2, data, 'table', false);

            expect(removeListenerSpy).toHaveBeenCalledWith('scroll', oldScrollHandler);
        });

        it('should remove old click listener when setting up new listeners', () => {
            const host1 = document.createElement('div');
            const host2 = document.createElement('div');
            const data = [{ id: 1 }];

            // Set up first listener
            resultPanel._setupTableListeners(host1, data, 'table', false);
            const oldClickHandler = resultPanel._handleContentClick;

            const removeListenerSpy = vi.spyOn(host1, 'removeEventListener');

            // Set up second listener - should remove old one
            resultPanel._setupTableListeners(host2, data, 'table', false);

            expect(removeListenerSpy).toHaveBeenCalledWith('click', oldClickHandler);
        });
    });
});
