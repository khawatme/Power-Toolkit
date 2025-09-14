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

export class PluginTraceLogTab extends BaseComponent {
    /**
     * Initializes the PluginTraceLogTab component.
     */
    constructor() {
        super('traces', 'Plugin Traces', ICONS.traces);
        this.currentPage = 1;
        this.pageSize = 25;
        this.pageLinks = [];
        this.pollingTimer = null;
        this.filters = { typeName: '', messageName: '' };
        // Debounce the client-side filter for better performance
        this.filterTraces = Helpers.debounce(this._filterTraces, 300);
    }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="section-title">Plugin Trace Logs</div>
            <div class="pdt-toolbar">
                <input type="text" id="trace-filter-typename" class="pdt-input" placeholder="Type Name contains..." title="Filter by plugin class name">
                <input type="text" id="trace-filter-messagename" class="pdt-input" placeholder="Message contains..." title="Filter by message (e.g., Create, Update)">
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
            <div id="trace-log-list" style="flex-grow: 1; overflow-y: auto; min-height:0;"><p>Loading...</p></div>
            <div class="pdt-pagination">
                <button id="prev-page-btn" class="modern-button secondary">&lt; Prev</button>
                <span id="page-info">Page 1</span>
                <button id="next-page-btn" class="modern-button secondary">Next &gt;</button>
            </div>`;
        
        this._loadTraces(container);
        return container;
    }

    /**
     * Attaches event listeners after the component is added to the DOM.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        const serverFilterBtn = element.querySelector('#apply-server-filters-btn');
        const localSearchInput = element.querySelector('#trace-local-search');
        const liveToggle = element.querySelector('#trace-live-toggle');

        const applyServerFilters = () => this._applyServerFilters(element);
        serverFilterBtn.addEventListener('click', applyServerFilters);

        const applyLocalFilter = () => this.filterTraces(localSearchInput.value, element);
        localSearchInput.addEventListener('keyup', applyLocalFilter);

        element.querySelector('#prev-page-btn').addEventListener('click', () => this._changePage(-1, element));
        element.querySelector('#next-page-btn').addEventListener('click', () => this._changePage(1, element));

        liveToggle.addEventListener('change', () => this._handlePolling(liveToggle.checked, element));
        element.querySelector('#trace-live-interval').addEventListener('change', () => {
            if (liveToggle.checked) this._handlePolling(true, element);
        });

        // Use event delegation for trace item interactions
        element.querySelector('#trace-log-list').addEventListener('click', (e) => {
            const target = e.target;
            const header = target.closest('.trace-header');
            if (header && !target.classList.contains('copyable')) {
                const details = header.nextElementSibling;
                details.style.maxHeight = (details.style.maxHeight && details.style.maxHeight !== '0px') 
                    ? '0px' 
                    : details.scrollHeight + 'px';
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

    _applyServerFilters(element) {
        this.filters.typeName = element.querySelector('#trace-filter-typename').value.trim();
        this.filters.messageName = element.querySelector('#trace-filter-messagename').value.trim();
        this.currentPage = 1;
        this.pageLinks = [];
        this._loadTraces(element);
    }

    _changePage(direction, element) {
        const newPage = this.currentPage + direction;
        if (newPage < 1 || (direction > 0 && !this.pageLinks[this.currentPage])) {
            return; // Cannot go before page 1 or past the known last page
        }
        this.currentPage = newPage;
        this._loadTraces(element);
    }

    _handlePolling(isEnabled, element) {
        const liveStatus = element.querySelector('#live-status-indicator');
        this.destroy(); // Clear any existing timer
        if (isEnabled) {
            const interval = element.querySelector('#trace-live-interval').value;
            this.pollingTimer = setInterval(() => {
                // When polling, always go back to the first page with current filters
                this.currentPage = 1;
                this.pageLinks = [];
                this._loadTraces(element, true);
            }, parseInt(interval, 10));
            liveStatus.textContent = '🟢 ';
            this._applyServerFilters(element); // Trigger an immediate refresh
        } else {
            liveStatus.textContent = '';
        }
    }

    _buildODataOptions() {
        const select = "$select=typename,messagename,primaryentity,exceptiondetails,messageblock,performanceexecutionduration,createdon,correlationid";
        const filterClauses = [];
        if (this.filters.typeName) filterClauses.push(`contains(typename, '${this.filters.typeName}')`);
        if (this.filters.messageName) filterClauses.push(`contains(messagename, '${this.filters.messageName}')`);
        const filter = filterClauses.length > 0 ? `&$filter=${filterClauses.join(' and ')}` : "";
        const orderby = "&$orderby=createdon desc";
        return `?${select}${filter}${orderby}`;
    }

    async _loadTraces(element, isPolling = false) {
        const listContainer = element.querySelector('#trace-log-list');
        if (!isPolling) listContainer.innerHTML = '<p>Loading...</p>';
        
        // Update UI state
        element.querySelector('#page-info').textContent = `Page ${this.currentPage}`;
        element.querySelector('#prev-page-btn').disabled = this.currentPage === 1;
        element.querySelector('#next-page-btn').disabled = true;

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
                element.querySelector('#next-page-btn').disabled = false;
            }

            this._renderTraceList(listContainer, result.entities);
            this.filterTraces(element.querySelector('#trace-local-search').value, element);
        } catch (e) {
            listContainer.innerHTML = `<div class="pdt-error">Error loading traces. The Tracing service might be disabled.</div>`;
        }
    }
    
    _renderTraceList(container, traces) {
        if (traces.length === 0) {
            container.innerHTML = '<p class="pdt-note">No plugin trace logs found for the current filter criteria.</p>';
            return;
        }
        const fragment = document.createDocumentFragment();
        traces.forEach(log => fragment.appendChild(this._createTraceItemElement(log)));
        container.innerHTML = '';
        container.appendChild(fragment);
    }

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

    _filterTraces(searchTerm, element) {
        const term = searchTerm.toLowerCase();
        element.querySelectorAll('#trace-log-list .trace-item').forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(term) ? '' : 'none';
        });
    }
}