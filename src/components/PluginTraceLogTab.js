/**
 * @file Plugin Trace Log viewer component.
 * @module components/PluginTraceLogTab
 * @description A real-time debugger for server-side code that fetches, displays, and filters Plugin Trace Logs.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { DataService } from '../services/DataService.js';
import { UIFactory } from '../ui/UIFactory.js';
import { NotificationService } from '../services/NotificationService.js';
import { addEnterKeyListener, clearContainer, copyToClipboard, escapeHtml, toggleElementHeight } from '../helpers/index.js';
import { Config } from '../constants/index.js';

/**
 * @typedef {object} PluginTraceFilters
 * @property {string} typeName - Filter for the plugin's class name.
 * @property {string} messageContent - Filter for the trace message content.
 * @property {string} dateFrom - Filter for traces created on or after this date.
 * @property {string} dateTo - Filter for traces created on or before this date.
 */

/**
 * A component that provides a real-time viewer for server-side Plugin Trace Logs,
 * featuring server-side filtering, client-side search, pagination, and live polling.
 * @extends {BaseComponent}
 */
export class PluginTraceLogTab extends BaseComponent {
    /**
     * Initializes the PluginTraceLogTab component.
     */
    constructor() {
        super('traces', 'Plugin Traces', ICONS.traces);
        /** @type {{[k:string]: HTMLElement}} */
        this.ui = {};
        /** @type {number} */
        this.currentPage = 1;
        /** @type {number} */
        this.pageSize = 25;
        /** @type {Array<object>} */
        this.allTraces = [];
        /** @type {number} */
        this.totalPages = 0;
        /** @type {boolean} */
        this.hasMoreTraces = false;
        /** @type {string|null} */
        this.nextBatchLink = null;
        /** @type {number|null} */
        this.pollingTimer = null;
        /** @type {PluginTraceFilters} */
        this.filters = { typeName: '', messageContent: '', dateFrom: '', dateTo: '' };
        /** @type {boolean} */
        this.isLoading = false;

        // Event handler references for cleanup
        /** @private {Function|null} */ this._handleServerFilter = null;
        /** @private {Function|null} */ this._handleFirstPage = null;
        /** @private {Function|null} */ this._handlePrevPage = null;
        /** @private {Function|null} */ this._handleNextPage = null;
        /** @private {Function|null} */ this._handleLastPage = null;
        /** @private {Function|null} */ this._handlePageInput = null;
        /** @private {Function|null} */ this._handleLiveToggle = null;
        /** @private {Function|null} */ this._handleLiveInterval = null;
        /** @private {Function|null} */ this._handleLogListClick = null;
        /** @private {Function|null} */ this._typeNameEnterHandler = null;
        /** @private {Function|null} */ this._contentEnterHandler = null;
        /** @private {Function|null} */ this._handlePageSizeChange = null;
    }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    // eslint-disable-next-line require-await
    async render() {
        const container = document.createElement('div');
        container.className = 'pdt-traces-root';

        container.innerHTML = `
            <div class="section-title">Plugin Trace Logs</div>

            <div class="pdt-toolbar">
                <span>From</span>
                <input type="datetime-local" id="trace-filter-date-from" class="pdt-input" placeholder="From" title="Filter by date from">
                <span>To</span>
                <input type="datetime-local" id="trace-filter-date-to" class="pdt-input" placeholder="To" title="Filter by date to">

                <div id="trace-toolbar-right-controls">
                    <label class="pdt-toggle-label" title="Automatically refresh traces">
                        <span id="live-status-indicator" class="live-indicator" aria-hidden="true"></span>
                        Live
                        <span class="pdt-toggle-switch">
                            <input type="checkbox" id="trace-live-toggle">
                            <span class="pdt-toggle-slider"></span>
                        </span>
                    </label>
                    <select id="trace-live-interval" class="pdt-select w-80" title="Polling interval">
                        <option value="5000" selected>5s</option>
                        <option value="10000">10s</option>
                        <option value="30000">30s</option>
                    </select>
                </div>

                <button id="apply-server-filters-btn" class="modern-button">Filter</button>
            </div>

            <div class="pdt-toolbar">
                <input type="text" id="trace-filter-typename" class="pdt-input" placeholder="Type Name contains..." title="Filter by plugin class name">
                <input type="text" id="trace-filter-content" class="pdt-input" placeholder="Message, Entity or Content contains..." title="Search in message name, entity name, or trace content">
            </div>

            <div id="trace-log-list" class="pdt-content-host">
                <p class="pdt-note">${Config.MESSAGES.PLUGIN_TRACE.loading}</p>
            </div>

            <div class="pdt-pagination">
                <div id="trace-pagination-info" class="pdt-pagination-info">0 Traces</div>
                <div class="pdt-pagination-controls">
                    <button id="first-page-btn" class="modern-button secondary" title="${Config.PAGINATION.titles.firstPage}">${Config.PAGINATION.buttons.first}</button>
                    <button id="prev-page-btn" class="modern-button secondary" title="${Config.PAGINATION.titles.previousPage}">${Config.PAGINATION.buttons.previous}</button>
                    <input type="number" id="page-input" class="pdt-input pdt-pagination-input" min="1" value="1" title="${Config.PAGINATION.titles.jumpToPage}">
                    <span id="page-label" class="pdt-pagination-label">of 1</span>
                    <button id="next-page-btn" class="modern-button secondary" title="${Config.PAGINATION.titles.nextPage}">${Config.PAGINATION.buttons.next}</button>
                    <button id="last-page-btn" class="modern-button secondary" title="${Config.PAGINATION.titles.lastPage}">${Config.PAGINATION.buttons.last}</button>
                    <select id="trace-page-size-select" class="pdt-select pdt-pagination-size-select" title="${Config.PAGINATION.titles.recordsPerPage}">
                        ${Config.PAGINATION.pageSizeOptions.map(size =>
            `<option value="${size}" ${size === 25 ? 'selected' : ''}>${size}</option>`
        ).join('')}
                    </select>
                </div>
            </div>
        `;

        return container;
    }

    /**
     * Caches UI elements, attaches event listeners, and triggers the initial data load.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        this.ui = {
            container: element,
            serverFilterBtn: element.querySelector('#apply-server-filters-btn'),
            typeNameInput: element.querySelector('#trace-filter-typename'),
            contentInput: element.querySelector('#trace-filter-content'),
            dateFromInput: element.querySelector('#trace-filter-date-from'),
            dateToInput: element.querySelector('#trace-filter-date-to'),
            liveToggle: element.querySelector('#trace-live-toggle'),
            liveIntervalSelect: element.querySelector('#trace-live-interval'),
            liveStatusIndicator: element.querySelector('#live-status-indicator'),
            logList: element.querySelector('#trace-log-list'),
            paginationInfo: element.querySelector('#trace-pagination-info'),
            pageInput: element.querySelector('#page-input'),
            pageLabel: element.querySelector('#page-label'),
            firstPageBtn: element.querySelector('#first-page-btn'),
            prevPageBtn: element.querySelector('#prev-page-btn'),
            nextPageBtn: element.querySelector('#next-page-btn'),
            lastPageBtn: element.querySelector('#last-page-btn'),
            pageSizeSelect: element.querySelector('#trace-page-size-select')
        };

        // Reset state before binding events and loading data
        this.currentPage = 1;
        this.allTraces = [];
        this.totalPages = 0;
        this.hasMoreTraces = false;
        this.nextBatchLink = null;

        this._bindEvents();
        this._fetchAllTraces(true);
    }

    /**
     * Remove a single event listener safely
     * @private
     */
    _removeListener(element, eventType, handler) {
        if (element && handler) {
            element.removeEventListener(eventType, handler);
        }
    }

    /**
     * Clear all handler references
     * @private
     */
    _clearHandlerReferences() {
        this._handleServerFilter = null;
        this._handleFirstPage = null;
        this._handlePrevPage = null;
        this._handleNextPage = null;
        this._handleLastPage = null;
        this._handlePageInput = null;
        this._handleLiveToggle = null;
        this._handleLiveInterval = null;
        this._handleLogListClick = null;
        this._typeNameEnterHandler = null;
        this._contentEnterHandler = null;
        this._handlePageSizeChange = null;
    }

    /**
     * Remove all button event listeners
     * @private
     */
    _removeButtonListeners() {
        this._removeListener(this.ui.serverFilterBtn, 'click', this._handleServerFilter);
        this._removeListener(this.ui.firstPageBtn, 'click', this._handleFirstPage);
        this._removeListener(this.ui.prevPageBtn, 'click', this._handlePrevPage);
        this._removeListener(this.ui.nextPageBtn, 'click', this._handleNextPage);
        this._removeListener(this.ui.lastPageBtn, 'click', this._handleLastPage);
        this._removeListener(this.ui.liveToggle, 'change', this._handleLiveToggle);
        this._removeListener(this.ui.liveIntervalSelect, 'change', this._handleLiveInterval);
        this._removeListener(this.ui.pageSizeSelect, 'change', this._handlePageSizeChange);
        this._removeListener(this.ui.logList, 'click', this._handleLogListClick);
    }

    /**
     * Remove all input event listeners
     * @private
     */
    _removeInputListeners() {
        this._removeListener(this.ui.pageInput, 'change', this._handlePageInput);
        this._removeListener(this.ui.typeNameInput, 'keydown', this._typeNameEnterHandler);
        this._removeListener(this.ui.contentInput, 'keydown', this._contentEnterHandler);
    }

    /**
     * Cancel any pending operations
     * @private
     */
    _cancelPendingOperations() {
        this._stopLiveMode();
    }

    /**
     * Cleanup method called when component is destroyed
     */
    destroy() {
        this._removeButtonListeners();
        this._removeInputListeners();
        this._cancelPendingOperations();
        this._clearHandlerReferences();
    }

    /** @private */
    _bindEvents() {
        this._handleServerFilter = () => this._applyServerFilters();
        this.ui.serverFilterBtn.addEventListener('click', this._handleServerFilter);

        this._typeNameEnterHandler = addEnterKeyListener(this.ui.typeNameInput, this._handleServerFilter);
        this._contentEnterHandler = addEnterKeyListener(this.ui.contentInput, this._handleServerFilter);

        this._handleFirstPage = () => this._goToPage(1);
        this.ui.firstPageBtn.addEventListener('click', this._handleFirstPage);

        this._handlePrevPage = () => this._changePage(-1);
        this.ui.prevPageBtn.addEventListener('click', this._handlePrevPage);

        this._handleNextPage = () => this._changePage(1);
        this.ui.nextPageBtn.addEventListener('click', this._handleNextPage);

        this._handleLastPage = () => this._goToLastPage();
        this.ui.lastPageBtn.addEventListener('click', this._handleLastPage);

        this._handlePageInput = (e) => {
            const page = parseInt(e.target.value, 10);
            if (isNaN(page) || page < 1) {
                // Reset to current page if invalid number
                e.target.value = this.currentPage.toString();
                return;
            }
            // Allow navigation to any page within totalPages
            if (page >= 1 && page <= this.totalPages) {
                this._goToPage(page);
            } else {
                e.target.value = this.currentPage.toString();
            }
        };
        this.ui.pageInput.addEventListener('change', this._handlePageInput);

        this._handleLiveToggle = () => this._handlePolling(this.ui.liveToggle.checked);
        this.ui.liveToggle.addEventListener('change', this._handleLiveToggle);

        this._handleLiveInterval = () => {
            if (this.ui.liveToggle.checked) {
                this._handlePolling(true);
            }
        };
        this.ui.liveIntervalSelect.addEventListener('change', this._handleLiveInterval);

        // Page size selector
        this._handlePageSizeChange = (e) => {
            const newPageSize = parseInt(e.target.value, 10);
            if (isNaN(newPageSize) || newPageSize < 1 || newPageSize > 1000) {
                NotificationService.show('Page size must be between 1 and 1000', 'warning');
                e.target.value = this.pageSize.toString();
                return;
            }
            this.pageSize = newPageSize;
            this.currentPage = 1;
            this.totalPages = Math.max(1, Math.ceil(this.allTraces.length / this.pageSize));
            this._renderCurrentPage();
        };
        this.ui.pageSizeSelect.addEventListener('change', this._handlePageSizeChange);

        // Expand/collapse & copy correlation id
        this._handleLogListClick = (e) => {
            const target = /** @type {HTMLElement} */(e.target);
            if (target.classList.contains('copyable')) {
                copyToClipboard(target.textContent, Config.MESSAGES.PLUGIN_TRACE.correlationCopied);
                return;
            }
            const header = target.closest('.trace-header');
            if (!header) {
                return;
            }
            const details = header.nextElementSibling;
            toggleElementHeight(details);
        };
        this.ui.logList.addEventListener('click', this._handleLogListClick);
    }

    /**
     * Applies the server-side filters, resets pagination, and reloads the trace data.
     * @private
     */
    _applyServerFilters() {
        this.filters.typeName = this.ui.typeNameInput.value.trim();
        this.filters.messageContent = this.ui.contentInput.value.trim();
        this.filters.dateFrom = this.ui.dateFromInput.value.trim();
        this.filters.dateTo = this.ui.dateToInput.value.trim();
        this.currentPage = 1;
        this.allTraces = [];
        this.totalPages = 0;
        this._fetchAllTraces(false, true);
    }

    /**
     * Navigates to the previous or next page of trace logs.
     * Auto-loads more traces when reaching the last loaded page.
     * @param {number} direction - The direction to navigate (-1 for previous, 1 for next).
     * @private
     */
    async _changePage(direction) {
        const newPage = this.currentPage + direction;

        if (direction > 0 && newPage >= this.totalPages && this.hasMoreTraces) {
            await this._loadMoreTraces();
            if (newPage <= this.totalPages) {
                this.currentPage = newPage;
                this._renderCurrentPage();
            }
            return;
        }

        if (newPage < 1 || newPage > this.totalPages) {
            return;
        }

        this.currentPage = newPage;
        this._renderCurrentPage();
    }

    /**
     * Navigates directly to a specific page.
     * @param {number} page - The page number to navigate to.
     * @private
     */
    _goToPage(page) {
        if (page < 1 || page > this.totalPages) {
            return;
        }

        this.currentPage = page;
        this._renderCurrentPage();
    }

    /**
     * Navigates to the last page.
     * Loads all remaining traces if more are available.
     * @private
     */
    async _goToLastPage() {
        if (this.hasMoreTraces) {
            await this._loadAllRemainingTraces();
        }

        if (this.totalPages > 0 && this.currentPage !== this.totalPages) {
            this._goToPage(this.totalPages);
        }
    }

    /**
     * Updates the pagination UI elements to reflect current state.
     * Shows + indicator when more traces are available to load.
     * @private
     */
    _updatePaginationUI() {
        const totalTraces = this.allTraces.length;
        const start = totalTraces > 0 ? (this.currentPage - 1) * this.pageSize + 1 : 0;
        const end = Math.min(start + this.pageSize - 1, totalTraces);

        // Update pagination info with exact counts (show + if more available)
        if (this.ui.paginationInfo) {
            const countDisplay = this.hasMoreTraces ? `${totalTraces}+` : totalTraces.toString();
            this.ui.paginationInfo.textContent = totalTraces > 0
                ? `${start}-${end} of ${countDisplay}`
                : '0 Traces';
        }

        // Update page label with exact page count (show + if more available)
        if (this.ui.pageLabel) {
            const pageDisplay = this.hasMoreTraces ? `${this.totalPages}+` : this.totalPages.toString();
            this.ui.pageLabel.textContent = `of ${pageDisplay}`;
        }

        // Update button states
        if (this.ui.firstPageBtn) {
            this.ui.firstPageBtn.disabled = this.currentPage === 1;
        }
        if (this.ui.prevPageBtn) {
            this.ui.prevPageBtn.disabled = this.currentPage === 1;
        }
        if (this.ui.nextPageBtn) {
            this.ui.nextPageBtn.disabled = this.currentPage >= this.totalPages && !this.hasMoreTraces;
        }
        if (this.ui.lastPageBtn) {
            this.ui.lastPageBtn.disabled = this.currentPage >= this.totalPages && !this.hasMoreTraces;
        }
        if (this.ui.pageInput) {
            this.ui.pageInput.value = this.currentPage.toString();
        }
    }

    /**
     * Starts or stops the live polling timer. When starting, it clears any existing timer,
     * sets a new one based on the selected interval, and triggers an immediate data refresh.
     * @param {boolean} isEnabled - True to start polling, false to stop.
     * @private
     */
    _handlePolling(isEnabled) {
        // Clear only the polling timer, not all event listeners
        this._stopLiveMode();
        this.ui.liveStatusIndicator.classList.toggle('is-live', !!isEnabled);

        if (!isEnabled) {
            return;
        }

        // Start live mode
        this._startLiveMode();
    }

    /**
     * Starts the live polling mode with the current interval setting.
     * @private
     */
    _startLiveMode() {
        const interval = parseInt(this.ui.liveIntervalSelect.value, 10);
        this.pollingTimer = setInterval(() => {
            this.currentPage = 1;
            this.allTraces = [];
            this.totalPages = 0;
            this._fetchAllTraces(true);
        }, interval);

        // Kick a fresh fetch immediately with current filters
        this._applyServerFilters();
    }

    /**
     * Stops the live polling mode by clearing the timer.
     * @private
     */
    _stopLiveMode() {
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
    }

    /**
     * Constructs the OData query options string based on current server-side filters.
     * @returns {string} The OData query string (search part).
     * @private
     */
    _buildODataOptions() {
        const select = '$select=typename,messagename,primaryentity,exceptiondetails,messageblock,performanceexecutionduration,createdon,correlationid';
        const filter = this._buildODataFilter();
        const orderby = '&$orderby=createdon desc';
        return `?${select}${filter}${orderby}`;
    }

    /** @private */
    _buildODataFilter() {
        const filterClauses = [];

        if (this.filters.typeName) {
            filterClauses.push(`contains(typename,'${this.filters.typeName}')`);
        }

        if (this.filters.messageContent) {
            const searchTerm = this.filters.messageContent;
            const contentFilters = [
                `contains(messageblock,'${searchTerm}')`,
                `contains(messagename,'${searchTerm}')`,
                `contains(primaryentity,'${searchTerm}')`
            ];
            filterClauses.push(`(${contentFilters.join(' or ')})`);
        }

        let filterString = '';
        if (filterClauses.length > 0) {
            filterString = `&$filter=${filterClauses.join(' and ')}`;
        }

        const dateFilters = [];

        if (this.filters.dateFrom) {
            const dateFrom = this._formatDateForOData(this.filters.dateFrom);
            dateFilters.push(`createdon ge ${dateFrom}`);
        }
        if (this.filters.dateTo) {
            const dateTo = this._formatDateForOData(this.filters.dateTo);
            dateFilters.push(`createdon le ${dateTo}`);
        }

        if (dateFilters.length > 0) {
            const dateFilterString = dateFilters.join(' and ');
            if (filterString) {
                filterString += ` and ${dateFilterString}`;
            } else {
                filterString = `&$filter=${dateFilterString}`;
            }
        }

        return filterString;
    }

    /**
     * Formats a datetime-local value to proper OData/ISO 8601 format.
     * Converts local time to UTC (depending on timezone)
     * @param {string} dateTimeLocal - DateTime value from datetime-local input (in local timezone)
     * @returns {string} Formatted date string for OData query (in UTC)
     * @private
     */
    _formatDateForOData(dateTimeLocal) {
        if (!dateTimeLocal) {
            return '';
        }

        const localDate = new Date(dateTimeLocal);

        // Convert to ISO string which gives UTC time with 'Z' suffix
        return localDate.toISOString();
    }

    /**
     * Fetches trace logs in batches for better performance.
     * Loads up to 1000 records initially, then loads more as needed.
     * @param {boolean} [isPolling=false] - If true, the "Loading..." message is suppressed for smoother UI.
     * @param {boolean} [fullReset=false] - If true, clears all cached data and starts fresh.
     * @private
     */
    async _fetchAllTraces(isPolling = false, fullReset = false) {
        if (this.isLoading) {
            return; // Prevent concurrent fetch operations
        }

        this.isLoading = true;

        if (!isPolling) {
            this.ui.logList.innerHTML = `<p class="pdt-note">${Config.MESSAGES.PLUGIN_TRACE.loading}</p>`;
        }

        try {
            // Reset if requested or if this is a new filter
            if (fullReset) {
                this.allTraces = [];
                this.nextBatchLink = null;
                this.hasMoreTraces = false;
            }

            const options = this._buildODataOptions();
            const FETCH_PAGE_SIZE = 250; // Records per API call
            const MAX_BATCH_SIZE = 1000; // Load up to 1000 records per batch
            let recordsFetched = 0;
            let nextLink = null;

            // Fetch until we hit the batch limit or run out of records
            do {
                const currentOptions = nextLink
                    ? new URL(nextLink).search
                    : options;
                const result = await DataService.getPluginTraceLogs(currentOptions, FETCH_PAGE_SIZE);

                const traces = Array.isArray(result?.entities) ? result.entities : [];
                this.allTraces.push(...traces);
                recordsFetched += traces.length;

                nextLink = result?.nextLink || null;

                // Stop if we've fetched enough for this batch
                if (recordsFetched >= MAX_BATCH_SIZE && nextLink) {
                    break;
                }
            } while (nextLink && recordsFetched < MAX_BATCH_SIZE);

            // Store the next link for loading more later
            this.nextBatchLink = nextLink;
            this.hasMoreTraces = !!nextLink;

            // Calculate total pages based on currently loaded traces
            this.totalPages = Math.max(1, Math.ceil(this.allTraces.length / this.pageSize));

            // Reset to page 1 if current page exceeds total
            if (this.currentPage > this.totalPages) {
                this.currentPage = 1;
            }

            this._renderCurrentPage();
        } catch (_e) {
            this.ui.logList.innerHTML = `<div class="pdt-error">${Config.MESSAGES.PLUGIN_TRACE.loadFailed}</div>`;
            this.totalPages = 1;
            this.hasMoreTraces = false;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Renders the current page from the allTraces array.
     * This enables instant client-side pagination without server calls.
     * @private
     */
    _renderCurrentPage() {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageTraces = this.allTraces.slice(startIndex, endIndex);

        this._updatePaginationUI();
        this._renderTraceList(pageTraces);

        // Reset scroll to top when navigating between pages
        if (this.ui.logList) {
            this.ui.logList.scrollTop = 0;
        }
    }

    /**
     * Renders a list of trace log items into the main container.
     * @param {Array<object>} traces - Trace log data objects.
     * @private
     */
    _renderTraceList(traces) {
        if (!traces.length) {
            this.ui.logList.innerHTML = `<p class="pdt-note">${Config.MESSAGES.PLUGIN_TRACE.noTracesFound}</p>`;
            return;
        }
        const frag = document.createDocumentFragment();
        traces.forEach(log => frag.appendChild(this._createTraceItemElement(log)));
        clearContainer(this.ui.logList);
        this.ui.logList.appendChild(frag);
    }

    /**
     * Creates a single DOM element for a trace log item.
     * @param {object} log - The trace log data object.
     * @returns {HTMLElement} The created DOM element.
     * @private
     */
    _createTraceItemElement(log) {
        const item = document.createElement('div');
        item.className = 'trace-item';

        const isError = !!log.exceptiondetails;
        const createdOn = new Date(log.createdon).toLocaleString();

        const displayTypeName = this._extractClassName(log.typename);

        item.innerHTML = `
            <div class="trace-header ${isError ? 'trace-error' : 'trace-success'}">
                <div class="trace-summary">
                    <span class="trace-type">${escapeHtml(displayTypeName)}</span>
                    <span class="trace-meta">${escapeHtml(log.messagename)} on ${escapeHtml(log.primaryentity)} &bull; ${createdOn}</span>
                </div>
                <span class="trace-duration">${log.performanceexecutionduration ?? 'N/A'} ms</span>
            </div>
            <div class="trace-details"></div>
        `;

        const details = item.querySelector('.trace-details');

        // Add metadata section (correlation, assembly details, etc.)
        const metadataHtml = this._buildMetadataSection(log);
        if (metadataHtml) {
            const metadataDiv = document.createElement('div');
            metadataDiv.innerHTML = metadataHtml;
            metadataDiv.style.marginTop = '12px';
            details.appendChild(metadataDiv);
        }

        // Only render the message copy block when it has content
        const msg = (log.messageblock ?? '').toString().trim();
        if (msg) {
            if (isError) {
                // If error, show message with heading
                const msgWrap = document.createElement('div');
                msgWrap.className = 'trace-exception';
                msgWrap.innerHTML = '<h4 class="trace-exception-title">Message Block</h4>';
                msgWrap.appendChild(UIFactory.createCopyableCodeBlock(msg, 'text'));
                details.appendChild(msgWrap);
            } else {
                // If not error, show message without heading
                details.appendChild(UIFactory.createCopyableCodeBlock(msg, 'text'));
            }
        }

        // If error, optionally render exception only when it has content
        if (isError) {
            const ex = (log.exceptiondetails ?? '').toString().trim();
            if (ex) {
                const exWrap = document.createElement('div');
                exWrap.className = 'trace-exception';
                exWrap.innerHTML = '<h4 class="trace-exception-title">Exception Details</h4>';
                exWrap.appendChild(UIFactory.createCopyableCodeBlock(ex, 'text'));
                details.appendChild(exWrap);
            }
        }

        // If nothing was added, remove the details container so nothing shows
        if (!details.childElementCount) {
            details.remove();
        }

        return item;
    }

    /**
     * Extracts the full class name from the typename.
     * Example: "MyCompany.MyNamespace.MyPlugin.SubClass, MyAssembly, Version=1.0.0.0"
     * Returns: "MyCompany.MyNamespace.MyPlugin.SubClass"
     * @param {string} typename - The full typename including assembly information
     * @returns {string} The full class name without assembly information
     * @private
     */
    _extractClassName(typename) {
        if (!typename) {
            return '';
        }
        const commaIndex = typename.indexOf(',');
        return commaIndex > -1 ? typename.substring(0, commaIndex).trim() : typename;
    }

    /**
     * Builds the metadata section HTML with correlation ID and assembly details.
     * Uses inline trace-meta style for compact display.
     * @param {object} log - The trace log data object
     * @returns {string} HTML string for metadata section
     * @private
     */
    _buildMetadataSection(log) {
        const metadata = [];

        if (log.correlationid) {
            metadata.push(`<span>Correlation ID: ${escapeHtml(log.correlationid)}</span>`);
        }

        // Parse assembly information from typename
        const assemblyInfo = this._parseAssemblyInfo(log.typename);
        if (assemblyInfo.assembly) {
            metadata.push(`${escapeHtml(assemblyInfo.assembly)}`);
        }
        if (assemblyInfo.version) {
            metadata.push(`v${escapeHtml(assemblyInfo.version)}`);
        }
        if (assemblyInfo.culture) {
            metadata.push(`Culture:${escapeHtml(assemblyInfo.culture)}`);
        }
        if (assemblyInfo.publicKeyToken) {
            metadata.push(`Token: ${escapeHtml(assemblyInfo.publicKeyToken)}`);
        }

        return metadata.length > 0 ? `<div class="trace-meta">${metadata.join(' &bull; ')}</div>` : '';
    }

    /**
     * Parses assembly information from the typename string.
     * Example: "MyNamespace.MyPlugin, MyAssembly, Version=1.0.0.0, Culture=neutral, PublicKeyToken=abc123"
     * @param {string} typename - The full typename string
     * @returns {object} Object with assembly, version, culture, and publicKeyToken properties
     * @private
     */
    _parseAssemblyInfo(typename) {
        const info = {
            assembly: '',
            version: '',
            culture: '',
            publicKeyToken: ''
        };

        if (!typename) {
            return info;
        }

        const parts = typename.split(',').map(p => p.trim());

        // Assembly name
        if (parts.length > 1) {
            info.assembly = parts[1];
        }

        // Parse remaining parts for Version, Culture, PublicKeyToken
        for (let i = 2; i < parts.length; i++) {
            const part = parts[i];
            if (part.startsWith('Version=')) {
                info.version = part.substring(8);
            } else if (part.startsWith('Culture=')) {
                info.culture = part.substring(8);
            } else if (part.startsWith('PublicKeyToken=')) {
                info.publicKeyToken = part.substring(15);
            }
        }

        return info;
    }

    /**
     * Loads the next batch of traces (up to 1000 more records).
     * @private
     * @async
     */
    async _loadMoreTraces() {
        if (!this.nextBatchLink || this.isLoading) {
            return;
        }

        this.isLoading = true;
        const FETCH_PAGE_SIZE = 250;
        const MAX_BATCH_SIZE = 1000;
        let recordsFetched = 0;
        let nextLink = this.nextBatchLink;

        try {
            do {
                const currentOptions = new URL(nextLink).search;
                const result = await DataService.getPluginTraceLogs(currentOptions, FETCH_PAGE_SIZE);

                const traces = Array.isArray(result?.entities) ? result.entities : [];
                this.allTraces.push(...traces);
                recordsFetched += traces.length;

                nextLink = result?.nextLink || null;

                if (recordsFetched >= MAX_BATCH_SIZE && nextLink) {
                    break;
                }
            } while (nextLink && recordsFetched < MAX_BATCH_SIZE);

            this.nextBatchLink = nextLink;
            this.hasMoreTraces = !!nextLink;
            this.totalPages = Math.max(1, Math.ceil(this.allTraces.length / this.pageSize));
            this._updatePaginationUI();
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Loads all remaining traces (for "Last" button functionality).
     * @private
     * @async
     */
    async _loadAllRemainingTraces() {
        if (!this.nextBatchLink || this.isLoading) {
            return;
        }

        this.isLoading = true;
        const FETCH_PAGE_SIZE = 250;
        let nextLink = this.nextBatchLink;

        try {
            while (nextLink) {
                const currentOptions = new URL(nextLink).search;
                const result = await DataService.getPluginTraceLogs(currentOptions, FETCH_PAGE_SIZE);

                const traces = Array.isArray(result?.entities) ? result.entities : [];
                this.allTraces.push(...traces);

                nextLink = result?.nextLink || null;
            }

            this.nextBatchLink = null;
            this.hasMoreTraces = false;
            this.totalPages = Math.max(1, Math.ceil(this.allTraces.length / this.pageSize));
            this._updatePaginationUI();
        } finally {
            this.isLoading = false;
        }
    }
}
