/**
 * @file ResultPanel
 * @description Renders API results as table or JSON with sorting and filtering
 * @module utils/ui/ResultPanel
 */

import { UIFactory } from '../../ui/UIFactory.js';
import { escapeHtml, isOdataProperty, UIHelpers, FileHelpers } from '../../helpers/index.js';
import { Config } from '../../constants/index.js';
import { NotificationService } from '../../services/NotificationService.js';

/**
 * ResultPanel class for rendering API results with table/JSON views, sorting, and filtering.
 * @class ResultPanel
 */
export class ResultPanel {
    /**
     * Creates a new ResultPanel instance.
     * @param {Object} config - Configuration object
     * @param {HTMLElement} config.root - Root DOM element to render into
     * @param {Function} config.onToggleView - Callback when view is toggled (table/json)
     * @param {Function} config.onToggleHide - Callback when hide system fields is toggled
     * @param {Function} config.getSortState - Function to get current sort state
     * @param {Function} config.setSortState - Function to set new sort state
     * @param {Function} [config.onBulkTouch] - Optional callback for bulk touch operation on selected rows
     * @param {boolean} [config.enableSelection=false] - Whether to enable row selection with checkboxes
     * @param {string} [config.tableName=''] - Optional table name for export filename
     */
    constructor({ root, onToggleView, onToggleHide, getSortState, setSortState, onBulkTouch, enableSelection = false, tableName = '' }) {
        this.root = root;
        this.onToggleView = onToggleView;
        this.onToggleHide = onToggleHide;
        this.getSortState = getSortState;
        this.setSortState = setSortState;
        this.onBulkTouch = onBulkTouch;
        this.enableSelection = enableSelection;
        this.tableName = tableName;
        this._coll = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

        // Pagination state
        /** @private {number} */ this.currentPage = 1;
        /** @private {number} */ this.pageSize = Config.PAGINATION.defaultPageSize;
        /** @private {Array<Object>} */ this._fullDataset = [];
        /** @private {Array<Object>} */ this._originalDataset = [];

        // Selection state
        /** @private {Set<number>} */ this._selectedIndices = new Set();

        // Scroll state
        /** @private {number} */ this._tableScrollLeft = 0;

        // Search state
        /** @private {string} */ this._searchTerm = '';
        /** @private {'table'|'json'} */ this._currentView = 'table';
        /** @private {boolean} */ this._hideOdata = false;

        // DOM element references for cleanup
        /** @private {HTMLElement|null} */ this._viewTableBtn = null;
        /** @private {HTMLElement|null} */ this._viewJsonBtn = null;
        /** @private {HTMLElement|null} */ this._hideCheckbox = null;
        /** @private {HTMLElement|null} */ this._contentHost = null;
        /** @private {HTMLElement|null} */ this._bulkTouchBtn = null;
        /** @private {HTMLElement|null} */ this._exportSelect = null;
        /** @private {HTMLElement|null} */ this._searchInput = null;

        // Event handler references for cleanup
        /** @private {Function|null} */ this._handleViewTable = null;
        /** @private {Function|null} */ this._handleViewJson = null;
        /** @private {Function|null} */ this._handleHideChange = null;
        /** @private {Function|null} */ this._handleContentClick = null;
        /** @private {Function|null} */ this._handleBulkTouch = null;
        /** @private {Function|null} */ this._handleExportChange = null;
        /** @private {Function|null} */ this._handleContentScroll = null;
        /** @private {Function|null} */ this._handleSearchInput = null;
        /** @private {HTMLElement|null} */ this._bannerElement = null;
    }

    /**
     * Renders the result panel shell with toolbar controls.
     * Creates the header toolbar with record count, view toggles, and hide system fields toggle.
     * @param {number} count - Number of records
     * @param {'table'|'json'} view - Current view mode
     * @param {boolean} hideOdata - Whether to hide OData system fields
     * @returns {void}
     */
    renderShell(count, view, hideOdata) {
        const existingBanner = this._bannerElement;

        this.root.innerHTML = this._buildShellHtml(count, view, hideOdata);

        this._restoreBanner(existingBanner);
        this._setupToolbarListeners(hideOdata);
    }

    /**
     * Builds the HTML structure for the shell.
     * @private
     * @param {number} count - Number of records
     * @param {'table'|'json'} view - Current view mode
     * @param {boolean} hideOdata - Whether to hide OData system fields
     * @returns {string} HTML string
     */
    _buildShellHtml(count, view, hideOdata) {
        const toolbarHtml = this._buildToolbarHtml(count, view, hideOdata);
        const headerHtml = this._buildHeaderHtml(count);

        return `
            ${toolbarHtml}
            ${headerHtml}
            <div id="pdt-banner-container"></div>
            <div id="pdt-content" class="pdt-result-wrapper"></div>
            <div id="pdt-pagination"></div>
        `;
    }

    /**
     * Builds the toolbar HTML with export and view controls.
     * @private
     * @param {number} count - Number of records
     * @param {'table'|'json'} view - Current view mode
     * @param {boolean} hideOdata - Whether to hide OData system fields
     * @returns {string} Toolbar HTML string
     */
    _buildToolbarHtml(count, view, hideOdata) {
        if (count === 0) {
            return '';
        }

        const selectedCount = this._selectedIndices.size;
        const exportLabel = this.enableSelection && selectedCount > 0 ? ` (${selectedCount})` : '';

        return `<div class="pdt-toolbar">
            <select id="pdt-export" class="pdt-select" title="Export Results">
                <option value="" disabled selected>Export${exportLabel}...</option>
                <option value="csv">Export CSV</option>
                <option value="json">Export JSON</option>
            </select>
            <input type="text" id="pdt-search" class="pdt-input" placeholder="Search results..." value="${escapeHtml(this._searchTerm)}" title="Search across all columns">
            <div class="pdt-toolbar-group ml-auto">
                <button id="pdt-view-table" class="pdt-sub-tab ${view === 'table' ? 'active' : ''}">Table</button>
                <button id="pdt-view-json" class="pdt-sub-tab ${view === 'json' ? 'active' : ''}">JSON</button>
                <label class="pdt-switcher-toggle" title="${Config.MESSAGES.UI.hideSystemTooltip}">
                    <span class="pdt-toggle-switch">
                        <input type="checkbox" id="pdt-hide" ${hideOdata ? 'checked' : ''}>
                        <span class="pdt-toggle-slider"></span>
                    </span>
                    Hide System
                </label>
            </div>
        </div>`;
    }

    /**
     * Builds the header HTML with record count and bulk actions.
     * @private
     * @param {number} count - Number of records
     * @returns {string} Header HTML string
     */
    _buildHeaderHtml(count) {
        const label = (count === 1 || count === 0) ? 'Record' : 'Records';
        const totalPages = Math.ceil(count / this.pageSize);
        const showPagination = count > this.pageSize;
        const selectedCount = this._selectedIndices.size;

        const pageInfo = showPagination ? ` - Page ${this.currentPage}/${totalPages}` : '';
        const selectionInfo = this.enableSelection && selectedCount > 0 ? ` - ${selectedCount} selected` : '';
        const touchButton = this.enableSelection && selectedCount > 0
            ? `<button id="pdt-bulk-touch" class="modern-button pdt-touch-btn">Touch (${selectedCount})</button>`
            : '';

        return `<div class="pdt-result-header">
            <h4 class="section-title pdt-result-title">Result (${count} ${label}${pageInfo}${selectionInfo})</h4>
            ${touchButton}
        </div>`;
    }

    /**
     * Restores a previously existing banner element.
     * @private
     * @param {HTMLElement|null} existingBanner - Banner element to restore
     */
    _restoreBanner(existingBanner) {
        if (existingBanner) {
            const bannerContainer = this.root.querySelector('#pdt-banner-container');
            if (bannerContainer) {
                bannerContainer.appendChild(existingBanner);
            }
        }
    }

    /**
     * Sets up all toolbar event listeners.
     * @private
     * @param {boolean} hideOdata - Whether to hide OData system fields
     */
    _setupToolbarListeners(hideOdata) {
        this._removeToolbarListeners();

        this._viewTableBtn = this.root.querySelector('#pdt-view-table');
        this._viewJsonBtn = this.root.querySelector('#pdt-view-json');
        this._hideCheckbox = this.root.querySelector('#pdt-hide');
        this._bulkTouchBtn = this.root.querySelector('#pdt-bulk-touch');
        this._exportSelect = this.root.querySelector('#pdt-export');
        this._searchInput = this.root.querySelector('#pdt-search');

        this._handleViewTable = () => this.onToggleView('table');
        this._handleViewJson = () => this.onToggleView('json');
        this._handleHideChange = (e) => this.onToggleHide(!!e.target.checked);
        this._handleExportChange = (e) => this._handleExport(e, hideOdata);

        if (this._viewTableBtn) {
            this._viewTableBtn.addEventListener('click', this._handleViewTable);
        }
        if (this._viewJsonBtn) {
            this._viewJsonBtn.addEventListener('click', this._handleViewJson);
        }
        if (this._hideCheckbox) {
            this._hideCheckbox.addEventListener('change', this._handleHideChange);
        }
        if (this._exportSelect) {
            this._exportSelect.addEventListener('change', this._handleExportChange);
        }

        // Search input with debounce
        if (this._searchInput) {
            let searchTimeout;
            this._handleSearchInput = (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this._searchTerm = e.target.value.trim().toLowerCase();
                    this.currentPage = 1; // Reset to first page on search
                    this._refreshContent(hideOdata);
                }, 300);
            };
            this._searchInput.addEventListener('input', this._handleSearchInput);
        }

        if (this._bulkTouchBtn && this.onBulkTouch) {
            this._handleBulkTouch = () => {
                const selectedRecords = Array.from(this._selectedIndices).map(idx => this._fullDataset[idx]);
                this.onBulkTouch(selectedRecords);
            };
            this._bulkTouchBtn.addEventListener('click', this._handleBulkTouch);
        }
    }

    /**
     * Handles export action.
     * @private
     * @param {Event} e - Change event
     * @param {boolean} hideOdata - Whether to hide OData fields
     */
    _handleExport(e, hideOdata) {
        const format = e.target.value;
        if (!format) {
            return;
        }

        e.target.value = '';
        let rawData = this._fullDataset;
        if (this.enableSelection && this._selectedIndices.size > 0) {
            rawData = Array.from(this._selectedIndices).map(idx => this._fullDataset[idx]);
        }

        const data = hideOdata ? this._stripOData(rawData) : rawData;
        const filename = this._generateExportFilename(data.length, format);

        if (format === 'csv') {
            FileHelpers.downloadCsv(data, filename);
        } else if (format === 'json') {
            FileHelpers.downloadJson(data, filename);
        }
    }

    /**
     * Generates a filename for export.
     * @private
     * @param {number} count - Number of records
     * @param {string} format - File format (csv/json)
     * @returns {string} Generated filename
     */
    _generateExportFilename(count, format) {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
        const tableNamePart = this.tableName ? `_${this.tableName}` : '';
        const countPart = `_${count}records`;
        return `${dateStr}_${timeStr}${tableNamePart}${countPart}.${format}`;
    }

    /**
     * Shows a custom banner in the dedicated banner container.
     * The banner persists across renderShell() calls.
     * @param {HTMLElement} bannerElement - The banner element to display
     */
    showBanner(bannerElement) {
        const container = this.root.querySelector('#pdt-banner-container');
        if (container) {
            container.innerHTML = '';
            container.appendChild(bannerElement);
            this._bannerElement = bannerElement;
        }
    }

    /**
     * Removes the banner from the banner container.
     */
    removeBanner() {
        const container = this.root.querySelector('#pdt-banner-container');
        if (container) {
            container.innerHTML = '';
        }
        this._bannerElement = null;
    }

    /**
     * Updates the banner content without recreating it.
     * Useful for progress updates during loading.
     * @param {string} htmlContent - HTML content to set in the banner
     */
    updateBanner(htmlContent) {
        if (this._bannerElement) {
            const messageDiv = this._bannerElement.querySelector('.pdt-pagination-banner-message');
            if (messageDiv) {
                messageDiv.innerHTML = htmlContent;
            }
        }
    }

    /**
     * Renders the content area with data in either table or JSON format.
     * Handles sorting for table view and OData property filtering for both views.
     * Preserves horizontal scroll position when re-rendering after sort.
     * @param {Object} config - Configuration object
     * @param {Array<Object>} config.data - Array of data objects to display
     * @param {'table'|'json'} config.view - View mode (table or json)
     * @param {boolean} config.hideOdata - Whether to hide OData system fields
     * @returns {void}
     */
    renderContent({ data, view, hideOdata }) {
        const host = this.root.querySelector('#pdt-content');

        // Store state for refreshing (search, etc.)
        this._currentView = view;
        this._hideOdata = hideOdata;

        if (!Array.isArray(data) || data.length === 0) {
            host.innerHTML = `<p class="pdt-note">${Config.MESSAGES.UI.noRecords}</p>`;
            this._fullDataset = [];
            this._originalDataset = [];
            this.currentPage = 1;
            return;
        }

        // Store original unfiltered data
        this._originalDataset = data;

        // Apply search filter if needed
        const filteredData = this._applySearchFilter(data);
        this._fullDataset = filteredData;
        this._normalizeCurrentPage(filteredData.length);

        if (filteredData.length === 0) {
            host.innerHTML = `<p class="pdt-note">${Config.MESSAGES.UI.noSearchResults || 'No results match your search.'}</p>`;
            return;
        }

        if (view === 'json') {
            this._renderJsonView(host, filteredData, hideOdata);
        } else {
            this._renderTableView(host, filteredData, view, hideOdata);
        }
    }

    /**
     * Applies search filter to data.
     * @private
     * @param {Array<Object>} data - Data to filter
     * @returns {Array<Object>} Filtered data
     */
    _applySearchFilter(data) {
        if (!this._searchTerm) {
            return data;
        }

        const term = this._searchTerm.toLowerCase();
        return data.filter(row => {
            return Object.values(row).some(value => {
                if (value === null || value === undefined) {
                    return false;
                }
                return String(value).toLowerCase().includes(term);
            });
        });
    }

    /**
     * Refreshes content with current search term.
     * @private
     * @param {boolean} hideOdata - Whether to hide OData fields
     */
    _refreshContent(hideOdata) {
        if (this._originalDataset.length === 0) {
            return;
        }
        this.renderContent({
            data: this._originalDataset,
            view: this._currentView,
            hideOdata: hideOdata
        });
    }

    /**
     * Normalizes the current page to be within valid range.
     * @private
     * @param {number} dataLength - Total number of records
     */
    _normalizeCurrentPage(dataLength) {
        const totalPages = Math.ceil(dataLength / this.pageSize);
        if (this.currentPage > totalPages) {
            this.currentPage = totalPages;
        }
        if (this.currentPage < 1) {
            this.currentPage = 1;
        }
    }

    /**
     * Renders JSON view with pagination.
     * @private
     * @param {HTMLElement} host - Content container
     * @param {Array<Object>} data - Full dataset
     * @param {boolean} hideOdata - Whether to hide OData fields
     */
    _renderJsonView(host, data, hideOdata) {
        const startIdx = (this.currentPage - 1) * this.pageSize;
        const endIdx = startIdx + this.pageSize;
        const pageData = data.slice(startIdx, endIdx);
        const cleaned = hideOdata ? this._stripOData(pageData) : pageData;

        host.textContent = '';
        const codeBlock = UIFactory.createCopyableCodeBlock(JSON.stringify(cleaned, null, 2), 'json');
        host.appendChild(codeBlock);

        this._renderPagination(data, 'json', hideOdata);
    }

    /**
     * Renders table view with sorting and selection.
     * @private
     * @param {HTMLElement} host - Content container
     * @param {Array<Object>} data - Full dataset
     * @param {'table'|'json'} view - Current view mode
     * @param {boolean} hideOdata - Whether to hide OData fields
     */
    _renderTableView(host, data, view, hideOdata) {
        const headers = this._extractHeaders(data, hideOdata);
        const sortedIndices = this._getSortedIndices(data);
        const pageIndices = this._getPageIndices(sortedIndices);

        this._saveScrollPosition(host);

        const tableHtml = this._buildTableHtml(data, headers, pageIndices);
        host.innerHTML = tableHtml;

        this._restoreScrollPosition(host);
        this._renderPagination(data, view, hideOdata);
        this._setupTableListeners(host, data, view, hideOdata);
        this._initializeColumnResize(host);
    }

    /**
     * Extracts column headers from data.
     * @private
     * @param {Array<Object>} data - Dataset
     * @param {boolean} hideOdata - Whether to hide OData fields
     * @returns {Array<string>} Column headers
     */
    _extractHeaders(data, hideOdata) {
        const allKeys = Array.from(new Set(data.flatMap(o => Object.keys(o))));
        return hideOdata ? allKeys.filter(h => !isOdataProperty(h)) : allKeys;
    }

    /**
     * Gets sorted array of data indices.
     * @private
     * @param {Array<Object>} data - Dataset
     * @returns {Array<number>} Sorted indices
     */
    _getSortedIndices(data) {
        const indices = Array.from({ length: data.length }, (_, i) => i);
        const sort = this.getSortState();

        if (sort?.column) {
            const dir = sort.direction === 'asc' ? 1 : -1;
            const cmp = this._coll.compare;
            indices.sort((aIdx, bIdx) => {
                const av = data[aIdx]?.[sort.column];
                const bv = data[bIdx]?.[sort.column];
                const aBlank = (av === null || av === undefined || av === '');
                const bBlank = (bv === null || bv === undefined || bv === '');
                if (aBlank !== bBlank) {
                    return aBlank ? 1 * dir : -1 * dir;
                }
                return cmp(String(av ?? ''), String(bv ?? '')) * dir;
            });
        }

        return indices;
    }

    /**
     * Gets indices for current page.
     * @private
     * @param {Array<number>} indices - All sorted indices
     * @returns {Array<number>} Page indices
     */
    _getPageIndices(indices) {
        const startIdx = (this.currentPage - 1) * this.pageSize;
        const endIdx = startIdx + this.pageSize;
        return indices.slice(startIdx, endIdx);
    }

    /**
     * Builds complete table HTML.
     * @private
     * @param {Array<Object>} data - Dataset
     * @param {Array<string>} headers - Column headers
     * @param {Array<number>} pageIndices - Indices for current page
     * @returns {string} Table HTML
     */
    _buildTableHtml(data, headers, pageIndices) {
        const headerHtml = this._buildTableHeaderHtml(data, headers);
        const bodyHtml = this._buildTableBodyHtml(data, headers, pageIndices);

        return `
            <table class="pdt-table" role="grid" aria-label="API Results">
                <thead><tr>${headerHtml}</tr></thead>
                <tbody>${bodyHtml}</tbody>
            </table>
        `;
    }

    /**
     * Builds table header HTML.
     * @private
     * @param {Array<Object>} data - Dataset
     * @param {Array<string>} headers - Column headers
     * @returns {string} Header HTML
     */
    _buildTableHeaderHtml(data, headers) {
        const sort = this.getSortState();
        const allSelected = this.enableSelection && data.length > 0 && this._selectedIndices.size === data.length;
        const selectionHeader = this.enableSelection
            ? `<th><input type="checkbox" id="pdt-select-all" title="Select All" ${allSelected ? 'checked' : ''}></th>`
            : '';

        const columnHeaders = headers.map(h => {
            const isSorted = sort?.column === h;
            const sortClass = isSorted ? `sort-${sort.direction}` : '';
            return `<th class="${sortClass}" data-column="${escapeHtml(h)}" title="${escapeHtml(h)}">${escapeHtml(h)}</th>`;
        }).join('');

        return selectionHeader + columnHeaders;
    }

    /**
     * Builds table body HTML.
     * @private
     * @param {Array<Object>} data - Dataset
     * @param {Array<string>} headers - Column headers
     * @param {Array<number>} pageIndices - Indices for current page
     * @returns {string} Body HTML
     */
    _buildTableBodyHtml(data, headers, pageIndices) {
        return pageIndices.map((actualIdx) => {
            const rec = data[actualIdx];
            const isSelected = this._selectedIndices.has(actualIdx);
            const selectionCell = this.enableSelection
                ? `<td><input type="checkbox" class="pdt-row-select" data-index="${actualIdx}" ${isSelected ? 'checked' : ''}></td>`
                : '';

            const cells = headers.map(h => {
                const v = rec[h];
                const text = (v === null || v === undefined) ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
                return `<td>${escapeHtml(text)}</td>`;
            }).join('');

            return `<tr>${selectionCell}${cells}</tr>`;
        }).join('');
    }

    /**
     * Saves current horizontal scroll position.
     * @private
     * @param {HTMLElement} host - Content container
     */
    _saveScrollPosition(host) {
        const oldTable = host.querySelector('table.pdt-table');
        if (oldTable && host.scrollLeft > 0) {
            this._tableScrollLeft = host.scrollLeft;
        }
    }

    /**
     * Restores horizontal scroll position.
     * @private
     * @param {HTMLElement} host - Content container
     */
    _restoreScrollPosition(host) {
        if (this._tableScrollLeft > 0) {
            requestAnimationFrame(() => {
                host.scrollLeft = this._tableScrollLeft;
            });
        }
    }

    /**
     * Renders pagination controls if needed.
     * @private
     * @param {Array<Object>} data - Full dataset
     * @param {'table'|'json'} view - Current view mode
     * @param {boolean} hideOdata - Whether to hide OData fields
     */
    _renderPagination(data, view, hideOdata) {
        const paginationContainer = this.root.querySelector('#pdt-pagination');
        if (!paginationContainer) {
            return;
        }

        const totalPages = Math.ceil(data.length / this.pageSize);
        // Show pagination when there are results
        if (data.length > 0) {
            paginationContainer.innerHTML = '';
            paginationContainer.appendChild(this._createPaginationControls(totalPages, data, view, hideOdata));
        } else {
            paginationContainer.innerHTML = '';
        }
    }

    /**
     * Sets up table event listeners for sorting and selection.
     * @private
     * @param {HTMLElement} host - Content container
     * @param {Array<Object>} data - Full dataset
     * @param {'table'|'json'} view - Current view mode
     * @param {boolean} hideOdata - Whether to hide OData fields
     */
    _setupTableListeners(host, data, view, hideOdata) {
        // Remove old listeners
        if (this._contentHost && this._handleContentClick) {
            this._contentHost.removeEventListener('click', this._handleContentClick);
        }
        if (this._contentHost && this._handleContentScroll) {
            this._contentHost.removeEventListener('scroll', this._handleContentScroll);
        }

        this._contentHost = host;
        this._handleContentScroll = () => {
            this._tableScrollLeft = host.scrollLeft;
        };
        this._handleContentClick = (e) => this._handleTableClick(e, data, view, hideOdata);

        host.addEventListener('click', this._handleContentClick);
        host.addEventListener('scroll', this._handleContentScroll);
    }

    /**
     * Handles click events on table (sorting and selection).
     * @private
     * @param {Event} e - Click event
     * @param {Array<Object>} data - Full dataset
     * @param {'table'|'json'} view - Current view mode
     * @param {boolean} hideOdata - Whether to hide OData fields
     */
    _handleTableClick(e, data, view, hideOdata) {
        // Handle column sorting
        const th = e.target.closest('th[data-column]');
        if (th) {
            this._handleColumnSort(th.getAttribute('data-column'), data, view, hideOdata);
            return;
        }

        // Handle select all
        if (this.enableSelection && e.target.id === 'pdt-select-all') {
            e.preventDefault();
            e.stopPropagation();
            this._handleSelectAll(data, view, hideOdata);
            return;
        }

        // Handle individual row selection
        if (this.enableSelection && e.target.classList.contains('pdt-row-select')) {
            this._handleRowSelect(e.target, data, view, hideOdata);
        }
    }

    /**
     * Handles column header click for sorting.
     * @private
     * @param {string} column - Column name
     * @param {Array<Object>} data - Full dataset
     * @param {'table'|'json'} view - Current view mode
     * @param {boolean} hideOdata - Whether to hide OData fields
     */
    _handleColumnSort(column, data, view, hideOdata) {
        const state = this.getSortState();
        if (state.column === column) {
            state.direction = state.direction === 'asc' ? 'desc' : 'asc';
        } else {
            state.column = column;
            state.direction = 'asc';
        }
        this.setSortState(state);
        this.renderContent({ data, view, hideOdata });
    }

    /**
     * Handles select all checkbox.
     * @private
     * @param {Array<Object>} data - Full dataset
     * @param {'table'|'json'} view - Current view mode
     * @param {boolean} hideOdata - Whether to hide OData fields
     */
    _handleSelectAll(data, view, hideOdata) {
        const shouldSelectAll = this._selectedIndices.size !== data.length;

        if (shouldSelectAll) {
            for (let i = 0; i < data.length; i++) {
                this._selectedIndices.add(i);
            }
        } else {
            this._selectedIndices.clear();
        }

        this.renderShell(data.length, view, hideOdata);
        this.renderContent({ data, view, hideOdata });
    }

    /**
     * Handles individual row selection.
     * @private
     * @param {HTMLElement} checkbox - Checkbox element
     * @param {Array<Object>} data - Full dataset
     * @param {'table'|'json'} view - Current view mode
     * @param {boolean} hideOdata - Whether to hide OData fields
     */
    _handleRowSelect(checkbox, data, view, hideOdata) {
        const index = parseInt(checkbox.dataset.index, 10);
        if (checkbox.checked) {
            this._selectedIndices.add(index);
        } else {
            this._selectedIndices.delete(index);
        }

        this.renderShell(data.length, view, hideOdata);
        this.renderContent({ data, view, hideOdata });
    }

    /**
     * Initializes column resize functionality.
     * @private
     * @param {HTMLElement} host - Content container
     */
    _initializeColumnResize(host) {
        const table = host.querySelector('table.pdt-table');
        if (table && UIHelpers && typeof UIHelpers.initColumnResize === 'function') {
            table.setAttribute('data-resize-mode', 'shift');
            requestAnimationFrame(() => {
                UIHelpers.initColumnResize(table);
            });
        }
    }

    /**
     * Creates pagination controls for navigating through pages.
     * @private
     * @param {number} totalPages - Total number of pages
     * @param {Array<Object>} data - Full dataset
     * @param {'table'|'json'} view - Current view mode
     * @param {boolean} hideOdata - Whether to hide OData fields
     * @returns {HTMLElement} Pagination controls element
     */
    _createPaginationControls(totalPages, data, view, hideOdata) {
        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'pdt-pagination';

        const info = document.createElement('div');
        info.className = 'pdt-pagination-info';
        const startIdx = (this.currentPage - 1) * this.pageSize + 1;
        const endIdx = Math.min(this.currentPage * this.pageSize, data.length);
        info.textContent = `${startIdx.toLocaleString()}-${endIdx.toLocaleString()} of ${data.length.toLocaleString()}`;

        const controls = document.createElement('div');
        controls.className = 'pdt-pagination-controls';

        // First page button
        const firstBtn = document.createElement('button');
        firstBtn.className = 'modern-button secondary';
        firstBtn.textContent = Config.PAGINATION.buttons.first;
        firstBtn.title = Config.PAGINATION.titles.firstPage;
        firstBtn.disabled = this.currentPage === 1;
        firstBtn.onclick = () => {
            this.currentPage = 1;
            this.renderShell(data.length, view, hideOdata);
            this.renderContent({ data, view, hideOdata });
        };

        // Previous page button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'modern-button secondary';
        prevBtn.textContent = Config.PAGINATION.buttons.previous;
        prevBtn.title = Config.PAGINATION.titles.previousPage;
        prevBtn.disabled = this.currentPage === 1;
        prevBtn.onclick = () => {
            this.currentPage = Math.max(1, this.currentPage - 1);
            this.renderShell(data.length, view, hideOdata);
            this.renderContent({ data, view, hideOdata });
        };

        // Page number input
        const pageInput = document.createElement('input');
        pageInput.type = 'number';
        pageInput.min = '1';
        pageInput.max = totalPages.toString();
        pageInput.value = this.currentPage.toString();
        pageInput.className = 'pdt-input pdt-pagination-input';
        pageInput.title = Config.PAGINATION.titles.jumpToPage;
        pageInput.onchange = (e) => {
            const page = parseInt(e.target.value, 10);
            if (page >= 1 && page <= totalPages) {
                this.currentPage = page;
                this.renderShell(data.length, view, hideOdata);
                this.renderContent({ data, view, hideOdata });
            } else {
                e.target.value = this.currentPage.toString();
            }
        };

        const pageLabel = document.createElement('span');
        pageLabel.className = 'pdt-pagination-label';
        pageLabel.textContent = `of ${totalPages}`;

        // Next page button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'modern-button secondary';
        nextBtn.textContent = Config.PAGINATION.buttons.next;
        nextBtn.title = Config.PAGINATION.titles.nextPage;
        nextBtn.disabled = this.currentPage === totalPages;
        nextBtn.onclick = () => {
            this.currentPage = Math.min(totalPages, this.currentPage + 1);
            this.renderShell(data.length, view, hideOdata);
            this.renderContent({ data, view, hideOdata });
        };

        // Last page button
        const lastBtn = document.createElement('button');
        lastBtn.className = 'modern-button secondary';
        lastBtn.textContent = Config.PAGINATION.buttons.last;
        lastBtn.title = Config.PAGINATION.titles.lastPage;
        lastBtn.disabled = this.currentPage === totalPages;
        lastBtn.onclick = () => {
            this.currentPage = totalPages;
            this.renderShell(data.length, view, hideOdata);
            this.renderContent({ data, view, hideOdata });
        };

        // Page size selector (compact)
        const pageSizeSelect = document.createElement('select');
        pageSizeSelect.className = 'pdt-select pdt-pagination-size-select';
        pageSizeSelect.title = Config.PAGINATION.titles.recordsPerPage;
        Config.PAGINATION.pageSizeOptions.forEach(size => {
            const option = document.createElement('option');
            option.value = size.toString();
            option.textContent = size.toString();
            option.selected = size === this.pageSize;
            pageSizeSelect.appendChild(option);
        });
        pageSizeSelect.onchange = (e) => {
            const newPageSize = parseInt(e.target.value, 10);
            // Validate pageSize is within reasonable bounds (1-1000)
            if (isNaN(newPageSize) || newPageSize < 1 || newPageSize > 1000) {
                NotificationService.show('Page size must be between 1 and 1000', 'warn');
                e.target.value = this.pageSize.toString();
                return;
            }
            this.pageSize = newPageSize;
            this.currentPage = 1; // Reset to first page when changing page size
            this.renderShell(data.length, view, hideOdata);
            this.renderContent({ data, view, hideOdata });
        };

        controls.appendChild(firstBtn);
        controls.appendChild(prevBtn);
        controls.appendChild(pageInput);
        controls.appendChild(pageLabel);
        controls.appendChild(nextBtn);
        controls.appendChild(lastBtn);
        controls.appendChild(pageSizeSelect);

        paginationDiv.appendChild(info);
        paginationDiv.appendChild(controls);

        return paginationDiv;
    }

    /**
     * Removes toolbar event listeners to prevent memory leaks.
     * Early exit optimization to avoid unnecessary work if handlers don't exist.
     * @private
     */
    _removeToolbarListeners() {
        // Early exit if no handlers have been set up yet
        if (!this._handleViewTable && !this._handleViewJson && !this._handleHideChange && !this._handleBulkTouch && !this._handleSearchInput) {
            return;
        }

        if (this._viewTableBtn && this._handleViewTable) {
            this._viewTableBtn.removeEventListener('click', this._handleViewTable);
        }
        if (this._viewJsonBtn && this._handleViewJson) {
            this._viewJsonBtn.removeEventListener('click', this._handleViewJson);
        }
        if (this._hideCheckbox && this._handleHideChange) {
            this._hideCheckbox.removeEventListener('change', this._handleHideChange);
        }
        if (this._exportSelect && this._handleExportChange) {
            this._exportSelect.removeEventListener('change', this._handleExportChange);
        }
        if (this._searchInput && this._handleSearchInput) {
            this._searchInput.removeEventListener('input', this._handleSearchInput);
        }
        if (this._contentHost && this._handleContentScroll) {
            this._contentHost.removeEventListener('scroll', this._handleContentScroll);
        }
        if (this._bulkTouchBtn && this._handleBulkTouch) {
            this._bulkTouchBtn.removeEventListener('click', this._handleBulkTouch);
        }
    }

    /**
     * Cleans up all event listeners to prevent memory leaks.
     * Call this when the ResultPanel is no longer needed.
     */
    destroy() {
        this._removeToolbarListeners();

        if (this._contentHost && this._handleContentClick) {
            this._contentHost.removeEventListener('click', this._handleContentClick);
        }

        // Clear references
        this._viewTableBtn = null;
        this._viewJsonBtn = null;
        this._hideCheckbox = null;
        this._bulkTouchBtn = null;
        this._exportSelect = null;
        this._contentHost = null;
        this._handleViewTable = null;
        this._handleViewJson = null;
        this._handleHideChange = null;
        this._handleContentClick = null;
        this._handleContentScroll = null;
        this._handleBulkTouch = null;
        this._handleExportChange = null;

        // Destroy any column resize handlers in the hosted table (if present)
        try {
            const table = this._contentHost && this._contentHost.querySelector('table.pdt-table');
            if (table) {
                UIHelpers.destroyColumnResize(table);
            }
        } catch (_) {
            // ignore
        }
    }

    /**
     * Recursively strips OData metadata properties from data objects.
     * Removes properties that start with '@odata' or other system properties.
     * @param {*} data - Data to strip (can be object, array, or primitive)
     * @returns {*} - Cleaned data with OData properties removed
     * @private
     */
    _stripOData(data) {
        if (Array.isArray(data)) {
            return data.map(d => this._stripOData(d));
        }
        if (data && typeof data === 'object') {
            const out = {};
            for (const k of Object.keys(data)) {
                if (!isOdataProperty(k)) {
                    out[k] = this._stripOData(data[k]);
                }
            }
            return out;
        }
        return data;
    }
}
