/**
 * @file Plugin Trace Log viewer component.
 * @module components/PluginTraceLogTab
 * @description A real-time debugger for server-side code that fetches, displays, and filters Plugin Trace Logs.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { DataService } from '../services/DataService.js';
import { UIFactory } from '../ui/UIFactory.js';
import { Helpers } from '../utils/Helpers.js';

/**
 * @typedef {object} PluginTraceFilters
 * @property {string} typeName - The filter for the plugin's class name.
 * @property {string} messageContent - The filter for the trace message content.
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
        this.ui = {};
        this.currentPage = 1;
        this.pageSize = 25;
        this.pageLinks = [];
        this.pollingTimer = null;
        this.filters = { typeName: '', messageContent: '' };
        this.filterTraces = Helpers.debounce(this._filterTraces, 300);
    }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.height = '100%';
        container.innerHTML = `
            <div class="section-title">Plugin Trace Logs</div>
            <div class="pdt-toolbar">
                <input type="text" id="trace-filter-typename" class="pdt-input" placeholder="Type Name contains..." title="Filter by plugin class name">
                <input type="text" id="trace-filter-content" class="pdt-input" placeholder="Trace content contains..." title="Filter by text inside the trace message block">
                <button id="apply-server-filters-btn" class="modern-button">Filter</button>
                <div id="trace-toolbar-right-controls">
                    <label class="pdt-toggle-label" title="Automatically refresh traces">
                        <span id="live-status-indicator"></span>Live
                        <span class="pdt-toggle-switch">
                            <input type="checkbox" id="trace-live-toggle">
                            <span class="pdt-toggle-slider"></span>
                        </span>
                    </label>
                    <select id="trace-live-interval" class="pdt-select" style="width:80px;" title="Polling interval">
                        <option value="5000">5s</option>
                        <option value="10000" selected>10s</option>
                        <option value="30000">30s</option>
                    </select>
                </div>
            </div>
            <div class="pdt-toolbar" style="margin-top: 5px;">
                <input type="text" id="trace-local-search" class="pdt-input" placeholder="Filter current page results..." style="flex-grow:1;">
            </div>
            <div id="trace-log-list" style="flex-grow: 1; overflow-y: auto; min-height:0;"><p class="pdt-note">Loading...</p></div>
            <div class="pdt-pagination">
                <button id="prev-page-btn" class="modern-button secondary">&lt; Prev</button>
                <span id="page-info">Page 1</span>
                <button id="next-page-btn" class="modern-button secondary">Next &gt;</button>
            </div>`;
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
            nextPageBtn: element.querySelector('#next-page-btn')
        };

        this._loadTraces();

        this.ui.serverFilterBtn.addEventListener('click', () => this._applyServerFilters());
        this.ui.localSearchInput.addEventListener('keyup', () => this.filterTraces());
        this.ui.prevPageBtn.addEventListener('click', () => this._changePage(-1));
        this.ui.nextPageBtn.addEventListener('click', () => this._changePage(1));
        this.ui.liveToggle.addEventListener('change', () => this._handlePolling(this.ui.liveToggle.checked));
        this.ui.liveIntervalSelect.addEventListener('change', () => {
            if (this.ui.liveToggle.checked) this._handlePolling(true);
        });

        this.ui.logList.addEventListener('click', (e) => {
            const target = e.target;
            const header = target.closest('.trace-header');
            if (header && !target.classList.contains('copyable')) {
                const details = header.nextElementSibling;
                details.style.maxHeight = (details.style.maxHeight && details.style.maxHeight !== '0px')
                    ? '0px'
                    : `${details.scrollHeight}px`;
            }
            if (target.classList.contains('copyable')) {
                Helpers.copyToClipboard(target.textContent, 'Correlation ID Copied!');
            }
        });
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
        if (newPage < 1 || (direction > 0 && !this.pageLinks[this.currentPage])) {
            return;
        }
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
        if (isEnabled) {
            const interval = this.ui.liveIntervalSelect.value;
            this.pollingTimer = setInterval(() => {
                this.currentPage = 1;
                this.pageLinks = [];
                this._loadTraces(true);
            }, parseInt(interval, 10));
            this.ui.liveStatusIndicator.textContent = '🟢 ';
            this._applyServerFilters();
        } else {
            this.ui.liveStatusIndicator.textContent = '';
        }
    }

    /**
     * Constructs the OData query options string based on the current server-side filters.
     * @returns {string} The OData query string.
     * @private
     */
    _buildODataOptions() {
        const select = "$select=typename,messagename,primaryentity,exceptiondetails,messageblock,performanceexecutionduration,createdon,correlationid";
        const filterClauses = [];
        if (this.filters.typeName) {
            filterClauses.push(`contains(typename, '${this.filters.typeName}')`);
        }
        if (this.filters.messageContent) {
            filterClauses.push(`contains(messageblock, '${this.filters.messageContent}')`);
        }
        const filter = filterClauses.length > 0 ? `&$filter=${filterClauses.join(' and ')}` : "";
        const orderby = "&$orderby=createdon desc";
        return `?${select}${filter}${orderby}`;
    }

    /**
     * Fetches and renders a page of trace logs based on the current page, filters,
     * and pagination state. It also manages the state of the pagination buttons.
     * @param {boolean} [isPolling=false] - If true, the "Loading..." message is suppressed for a smoother UI update.
     * @private
     */
    async _loadTraces(isPolling = false) {
        if (!isPolling) this.ui.logList.innerHTML = '<p class="pdt-note">Loading...</p>';

        this.ui.pageInfo.textContent = `Page ${this.currentPage}`;
        this.ui.prevPageBtn.disabled = this.currentPage === 1;
        this.ui.nextPageBtn.disabled = true;

        try {
            // Build the OData query if it's the first time on this page
            if (!this.pageLinks[this.currentPage - 1]) {
                this.pageLinks[this.currentPage - 1] = this._buildODataOptions();
            }
            const options = this.pageLinks[this.currentPage - 1];
            const result = await DataService.getPluginTraceLogs(options, this.pageSize);

            // Store the link for the next page if it exists
            if (result.nextLink) {
                const url = new URL(result.nextLink);
                this.pageLinks[this.currentPage] = url.search;
                this.ui.nextPageBtn.disabled = false;
            }

            this._renderTraceList(result.entities);
            this._filterTraces();
        } catch (e) {
            this.ui.logList.innerHTML = `<div class="pdt-error">Error loading traces. The Tracing service might be disabled.</div>`;
        }
    }

    /**
     * Renders a list of trace log items into the main container.
     * @param {Array<object>} traces - An array of trace log data objects.
     * @private
     */
    _renderTraceList(traces) {
        if (traces.length === 0) {
            this.ui.logList.innerHTML = '<p class="pdt-note">No plugin trace logs found for the current filter criteria.</p>';
            return;
        }
        const fragment = document.createDocumentFragment();
        traces.forEach(log => fragment.appendChild(this._createTraceItemElement(log)));
        this.ui.logList.innerHTML = '';
        this.ui.logList.appendChild(fragment);
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

        const correlationHtml = log.correlationid ? `&bull; Correlation: <span class="copyable" title="Click to copy">${Helpers.escapeHtml(log.correlationid)}</span>` : '';
        const createdOn = new Date(log.createdon).toLocaleString();

        item.innerHTML = `
            <div class="trace-header ${isError ? 'trace-error' : 'trace-success'}">
                <div class="trace-summary">
                    <span class="trace-type">${Helpers.escapeHtml(log.typename)}</span>
                    <span class="trace-meta">${Helpers.escapeHtml(log.messagename)} on ${Helpers.escapeHtml(log.primaryentity)} &bull; ${createdOn} ${correlationHtml}</span>
                </div>
                <span>${log.performanceexecutionduration || 'N/A'} ms</span>
            </div>
            <div class="trace-details"></div>`;

        const detailsContainer = item.querySelector('.trace-details');
        detailsContainer.appendChild(UIFactory.createCopyableCodeBlock(log.messageblock, 'text'));

        if (isError) {
            const exHeader = document.createElement('h4');
            exHeader.textContent = 'Exception Details';
            exHeader.style.color = 'var(--pro-error)';
            detailsContainer.appendChild(exHeader);
            detailsContainer.appendChild(UIFactory.createCopyableCodeBlock(log.exceptiondetails, 'text'));
        }
        return item;
    }

    /**
     * Performs a client-side filter on the currently visible trace items.
     * @private
     */
    _filterTraces() {
        const term = this.ui.localSearchInput.value.toLowerCase();
        this.ui.logList.querySelectorAll('.trace-item').forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(term) ? '' : 'none';
        });
    }
}