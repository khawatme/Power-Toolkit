/**
 * @file ResultPanel
 * @description Renders API results as table or JSON with sorting and filtering
 * @module utils/ui/ResultPanel
 */

import { UIFactory } from '../../ui/UIFactory.js';
import { escapeHtml, isOdataProperty, UIHelpers } from '../../helpers/index.js';
import { Config } from '../../constants/index.js';

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
     */
    constructor({ root, onToggleView, onToggleHide, getSortState, setSortState }) {
        this.root = root;
        this.onToggleView = onToggleView;
        this.onToggleHide = onToggleHide;
        this.getSortState = getSortState;
        this.setSortState = setSortState;
        this._coll = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

        // DOM element references for cleanup
        /** @private {HTMLElement|null} */ this._viewTableBtn = null;
        /** @private {HTMLElement|null} */ this._viewJsonBtn = null;
        /** @private {HTMLElement|null} */ this._hideCheckbox = null;
        /** @private {HTMLElement|null} */ this._contentHost = null;

        // Event handler references for cleanup
        /** @private {Function|null} */ this._handleViewTable = null;
        /** @private {Function|null} */ this._handleViewJson = null;
        /** @private {Function|null} */ this._handleHideChange = null;
        /** @private {Function|null} */ this._handleContentClick = null;
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
        const label = (count === 1 || count === 0) ? 'Record' : 'Records';
        this.root.innerHTML = `
            <div class="pdt-toolbar" style="justify-content: space-between;">
                <h4 class="section-title" style="margin:0; border:none;">Result (${count} ${label})</h4>
                <div class="pdt-toolbar-group">
                    <button id="rp-view-table" class="pdt-sub-tab ${view === 'table' ? 'active' : ''}">Table</button>
                    <button id="rp-view-json" class="pdt-sub-tab ${view === 'json' ? 'active' : ''}">JSON</button>
                    <label class="pdt-switcher-toggle" title="${Config.MESSAGES.UI.hideSystemTooltip}">
                        <span class="pdt-toggle-switch">
                            <input type="checkbox" id="rp-hide" ${hideOdata ? 'checked' : ''}>
                            <span class="pdt-toggle-slider"></span>
                        </span>
                        Hide System
                    </label>
                </div>
            </div>
            <div id="rp-content" class="pdt-result-wrapper"></div>
        `;

        // Clean up old listeners before adding new ones
        this._removeToolbarListeners();

        // Store element references and add listeners
        this._viewTableBtn = this.root.querySelector('#rp-view-table');
        this._viewJsonBtn = this.root.querySelector('#rp-view-json');
        this._hideCheckbox = this.root.querySelector('#rp-hide');

        this._handleViewTable = () => this.onToggleView('table');
        this._handleViewJson = () => this.onToggleView('json');
        this._handleHideChange = (e) => this.onToggleHide(!!e.target.checked);

        if (this._viewTableBtn) {
            this._viewTableBtn.addEventListener('click', this._handleViewTable);
        }
        if (this._viewJsonBtn) {
            this._viewJsonBtn.addEventListener('click', this._handleViewJson);
        }
        if (this._hideCheckbox) {
            this._hideCheckbox.addEventListener('change', this._handleHideChange);
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
        const host = this.root.querySelector('#rp-content');
        if (!Array.isArray(data) || data.length === 0) {
            host.innerHTML = `<p class="pdt-note">${Config.MESSAGES.UI.noRecords}</p>`;
            return;
        }

        if (view === 'json') {
            const cleaned = hideOdata ? this._stripOData(data) : data;
            host.textContent = '';
            host.appendChild(UIFactory.createCopyableCodeBlock(JSON.stringify(cleaned, null, 2), 'json'));
            return;
        }

        // table
        const allKeys = Array.from(new Set(data.flatMap(o => Object.keys(o))));
        const headers = hideOdata ? allKeys.filter(h => !isOdataProperty(h)) : allKeys;

        const sort = this.getSortState();
        const rows = [...data];
        if (sort?.column) {
            const dir = sort.direction === 'asc' ? 1 : -1;
            const cmp = this._coll.compare;
            rows.sort((a, b) => {
                const av = a?.[sort.column];
                const bv = b?.[sort.column];
                const aBlank = (av === null || av === undefined || av === '');
                const bBlank = (bv === null || bv === undefined || bv === '');
                if (aBlank !== bBlank) {
                    return aBlank ? 1 * dir : -1 * dir;
                }
                return cmp(String(av ?? ''), String(bv ?? '')) * dir;
            });
        }

        const headerHtml = headers.map(h => {
            const isSorted = sort?.column === h;
            const sortClass = isSorted ? `sort-${sort.direction}` : '';
            return `<th class="${sortClass}" data-column="${escapeHtml(h)}">${escapeHtml(h)}</th>`;
        }).join('');

        const bodyHtml = rows.map(rec => `
            <tr>
                ${headers.map(h => {
        const v = rec[h];
        const text = (v === null || v === undefined) ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
        return `<td>${escapeHtml(text)}</td>`;
    }).join('')}
            </tr>
        `).join('');

        host.innerHTML = `
            <table class="pdt-table" role="grid" aria-label="API Results">
                <thead><tr>${headerHtml}</tr></thead>
                <tbody>${bodyHtml}</tbody>
            </table>
        `;

        // Remove old content click listener before adding new one
        if (this._contentHost && this._handleContentClick) {
            this._contentHost.removeEventListener('click', this._handleContentClick);
        }

        this._contentHost = host;
        this._handleContentClick = (e) => {
            const th = e.target.closest('th[data-column]');
            if (!th) {
                return;
            }
            const col = th.getAttribute('data-column');
            const state = this.getSortState();
            if (state.column === col) {
                state.direction = state.direction === 'asc' ? 'desc' : 'asc';
            } else {
                state.column = col;
                state.direction = 'asc';
            }
            this.setSortState(state);
            this.renderContent({ data, view, hideOdata });
        };

        host.addEventListener('click', this._handleContentClick);

        // Initialize column resizing for the rendered table (if present)
        const table = host.querySelector('table.pdt-table');
        if (table && UIHelpers && typeof UIHelpers.initColumnResize === 'function') {
            table.setAttribute('data-resize-mode', 'shift');
            UIHelpers.initColumnResize(table);
        }
    }

    /**
     * Removes toolbar event listeners to prevent memory leaks.
     * Early exit optimization to avoid unnecessary work if handlers don't exist.
     * @private
     */
    _removeToolbarListeners() {
        // Early exit if no handlers have been set up yet
        if (!this._handleViewTable && !this._handleViewJson && !this._handleHideChange) {
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
        this._contentHost = null;
        this._handleViewTable = null;
        this._handleViewJson = null;
        this._handleHideChange = null;
        this._handleContentClick = null;

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
