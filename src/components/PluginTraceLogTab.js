/**
 * @file Plugin Trace Log viewer component.
 * @module components/PluginTraceLogTab
 * @description A real-time debugger for server-side code that fetches, displays, and filters Plugin Trace Logs.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { DataService } from '../services/DataService.js';
import { UIFactory } from '../ui/UIFactory.js';
import { buildODataFilterClauses, clearContainer, copyToClipboard, debounce, escapeHtml, highlightTraceMessage, toggleElementHeight, updatePaginationUI } from '../helpers/index.js';
import { Config } from '../constants/index.js';

/**
 * @typedef {object} PluginTraceFilters
 * @property {string} typeName - Filter for the plugin's class name.
 * @property {string} messageContent - Filter for the trace message content.
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
        /** @type {string[]} OData querystrings (search parts) for each page */
        this.pageLinks = [];
        /** @type {number|null} */
        this.pollingTimer = null;
        /** @type {PluginTraceFilters} */
        this.filters = { typeName: '', messageContent: '' };
        /** @private */
        this.filterTraces = debounce(this._filterTraces, 300);
    }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.className = 'pdt-traces-root';

        container.innerHTML = `
            <div class="section-title">Plugin Trace Logs</div>

            <div class="pdt-toolbar">
                <input type="text" id="trace-filter-typename" class="pdt-input" placeholder="Type Name contains..." title="Filter by plugin class name">
                <input type="text" id="trace-filter-content" class="pdt-input" placeholder="Trace content contains..." title="Filter by text inside the trace message block">
                <button id="apply-server-filters-btn" class="modern-button">Filter</button>

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
                        <option value="5000">5s</option>
                        <option value="10000" selected>10s</option>
                        <option value="30000">30s</option>
                    </select>
                </div>
            </div>

            <div class="pdt-toolbar pdt-toolbar--tight">
                <input type="text" id="trace-local-search" class="pdt-input" placeholder="Filter current page results...">
            </div>

            <div id="trace-log-list" class="pdt-content-host">
                <p class="pdt-note">${Config.MESSAGES.PLUGIN_TRACE.loading}</p>
            </div>

            <div class="pdt-pagination">
                <button id="prev-page-btn" class="modern-button secondary">&lt; Prev</button>
                <span id="page-info">Page 1</span>
                <button id="next-page-btn" class="modern-button secondary">Next &gt;</button>
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
            localSearchInput: element.querySelector('#trace-local-search'),
            liveToggle: element.querySelector('#trace-live-toggle'),
            liveIntervalSelect: element.querySelector('#trace-live-interval'),
            liveStatusIndicator: element.querySelector('#live-status-indicator'),
            logList: element.querySelector('#trace-log-list'),
            pageInfo: element.querySelector('#page-info'),
            prevPageBtn: element.querySelector('#prev-page-btn'),
            nextPageBtn: element.querySelector('#next-page-btn'),
        };

        this._bindEvents();
        this._loadTraces();
    }

    /**
     * Cleans up resources, specifically the polling timer, when the component is destroyed.
     */
    destroy() {
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
    }

    /** @private */
    _bindEvents() {
        this.ui.serverFilterBtn.addEventListener('click', () => this._applyServerFilters());
        this.ui.localSearchInput.addEventListener('input', () => this.filterTraces());
        this.ui.prevPageBtn.addEventListener('click', () => this._changePage(-1));
        this.ui.nextPageBtn.addEventListener('click', () => this._changePage(1));

        this.ui.liveToggle.addEventListener('change', () => this._handlePolling(this.ui.liveToggle.checked));
        this.ui.liveIntervalSelect.addEventListener('change', () => {
            if (this.ui.liveToggle.checked) this._handlePolling(true);
        });

        // Expand/collapse & copy correlation id
        this.ui.logList.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement} */(e.target);
            if (target.classList.contains('copyable')) {
                copyToClipboard(target.textContent, Config.MESSAGES.PLUGIN_TRACE.correlationCopied);
                return;
            }
            const header = target.closest('.trace-header');
            if (!header) return;
            const details = header.nextElementSibling;
            toggleElementHeight(details);
        });
    }

    /**
     * Applies the server-side filters, resets pagination, and reloads the trace data.
     * @private
     */
    _applyServerFilters() {
        this.filters.typeName = this.ui.typeNameInput.value.trim();
        this.filters.messageContent = this.ui.contentInput.value.trim();
        this.currentPage = 1;
        this.pageLinks = [];
        this._loadTraces();
    }

    /**
     * Navigates to the previous or next page of trace logs.
     * @param {number} direction - The direction to navigate (-1 for previous, 1 for next).
     * @private
     */
    _changePage(direction) {
        const newPage = this.currentPage + direction;
        if (newPage < 1) return;
        // only allow Next if we cached a link for the next page
        if (direction > 0 && !this.pageLinks[this.currentPage]) return;

        this.currentPage = newPage;
        this._loadTraces();
    }

    /**
     * Starts or stops the live polling timer. When starting, it clears any existing timer,
     * sets a new one based on the selected interval, and triggers an immediate data refresh.
     * @param {boolean} isEnabled - True to start polling, false to stop.
     * @private
     */
    _handlePolling(isEnabled) {
        this.destroy(); // Clear any existing timer
        this.ui.liveStatusIndicator.classList.toggle('is-live', !!isEnabled);

        if (!isEnabled) return;

        const interval = parseInt(this.ui.liveIntervalSelect.value, 10);
        this.pollingTimer = setInterval(() => {
            this.currentPage = 1;
            this.pageLinks = [];
            this._loadTraces(true);
        }, interval);

        // Kick a fresh fetch immediately with current filters
        this._applyServerFilters();
    }

    /**
     * Constructs the OData query options string based on current server-side filters.
     * @returns {string} The OData query string (search part).
     * @private
     */
    _buildODataOptions() {
        const select = "$select=typename,messagename,primaryentity,exceptiondetails,messageblock,performanceexecutionduration,createdon,correlationid";
        const filter = this._buildODataFilter();
        const orderby = "&$orderby=createdon desc";
        return `?${select}${filter}${orderby}`;
    }

    /** @private */
    _buildODataFilter() {
        const filters = {};
        if (this.filters.typeName) filters.typename = this.filters.typeName;
        if (this.filters.messageContent) filters.messageblock = this.filters.messageContent;
        return buildODataFilterClauses(filters);
    }

    /**
     * Fetches and renders a page of trace logs based on the current page, filters,
     * and pagination state. It also manages the state of the pagination buttons.
     * @param {boolean} [isPolling=false] - If true, the "Loading..." message is suppressed for smoother UI.
     * @private
     */
    async _loadTraces(isPolling = false) {
        if (!isPolling) this.ui.logList.innerHTML = `<p class="pdt-note">${Config.MESSAGES.PLUGIN_TRACE.loading}</p>`;

        updatePaginationUI(this.ui.prevPageBtn, this.ui.nextPageBtn, this.ui.pageInfo, this.currentPage, false);

        try {
            // Build and cache this page’s OData search-part if needed
            if (!this.pageLinks[this.currentPage - 1]) {
                this.pageLinks[this.currentPage - 1] = this._buildODataOptions();
            }

            const options = this.pageLinks[this.currentPage - 1];
            const result = await DataService.getPluginTraceLogs(options, this.pageSize);

            // Cache next page link (if any)
            const hasNext = !!result?.nextLink;
            if (hasNext) {
                const url = new URL(result.nextLink);
                this.pageLinks[this.currentPage] = url.search;
            }

            updatePaginationUI(this.ui.prevPageBtn, this.ui.nextPageBtn, this.ui.pageInfo, this.currentPage, hasNext);
            this._renderTraceList(Array.isArray(result?.entities) ? result.entities : []);
            this._filterTraces(); // re-apply local search
        } catch (e) {
            this.ui.logList.innerHTML = `<div class="pdt-error">${Config.MESSAGES.PLUGIN_TRACE.loadFailed}</div>`;
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
        const corr = log.correlationid
            ? `&bull; Correlation: <span class="copyable" title="Click to copy">${escapeHtml(log.correlationid)}</span>`
            : '';

        item.innerHTML = `
            <div class="trace-header ${isError ? 'trace-error' : 'trace-success'}">
                <div class="trace-summary">
                    <span class="trace-type">${escapeHtml(log.typename)}</span>
                    <span class="trace-meta">${escapeHtml(log.messagename)} on ${escapeHtml(log.primaryentity)} &bull; ${createdOn} ${corr}</span>
                </div>
                <span class="trace-duration">${log.performanceexecutionduration ?? 'N/A'} ms</span>
            </div>
            <div class="trace-details"></div>
        `;

        const details = item.querySelector('.trace-details');

        // Only render the message copy block when it has content
        const msg = (log.messageblock ?? '').toString().trim();
        if (msg) {
            if (isError) {
                // If error, show message with heading
                const msgWrap = document.createElement('div');
                msgWrap.className = 'trace-exception';
                msgWrap.innerHTML = `<h4 class="trace-exception-title">Message Block</h4>`;
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
                exWrap.innerHTML = `<h4 class="trace-exception-title">Exception Details</h4>`;
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
     * Performs a client-side filter on the currently visible trace items.
     * @private
     */
    _filterTraces = () => {
        const term = (this.ui.localSearchInput.value || '').toLowerCase();
        this.ui.logList.querySelectorAll('.trace-item').forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(term) ? '' : 'none';
        });
    };
}
