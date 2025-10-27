/**
 * @file Form Columns component.
 * @module components/FormColumnsTab
 * @description Displays a live, interactive, and filterable table of all attributes on the form or record.
 * Features include live value updates, lazy rendering for performance, and highlighting corresponding controls on the form.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { DataService } from '../services/DataService.js';
import { copyToClipboard, debounce, escapeHtml, formatDisplayValue, formatValuePreview, generateSortableTableHeaders, isSystemProperty, parseInputValue, sortArrayByColumn, toggleSortState } from '../helpers/index.js';
import { DialogService } from '../services/DialogService.js';
import { FormControlFactory } from '../ui/FormControlFactory.js';
import { NotificationService } from '../services/NotificationService.js';
import { Config } from '../constants/index.js';

/**
 * A component that displays a detailed, interactive grid of attributes from the
 * current form or the underlying record data. Features live updates, sorting,
 * filtering, lazy-rendering for performance, and control highlighting on the form.
 * @extends {BaseComponent}
 * @property {Array<object>} allColumns - The complete, cached list of all columns.
 * @property {'form'|'all'} viewMode - The current data source ('form' or 'all' record columns).
 * @property {Array<{attribute: Xrm.Attributes.Attribute, handler: Function}>} liveHandlers - Stores `onChange` handlers for cleanup.
 */
export class FormColumnsTab extends BaseComponent {
    /**
     * Initializes a new instance of the FormColumnsTab class, setting up its initial state.
     */
    constructor() {
        super('formColumns', 'Form Columns', ICONS.formColumns, true);

        /** @private */
        this._hasEnteredRecordView = false;
        /** @type {Array<object>} Caches the complete list of all columns from the data source. */
        this.allColumns = [];
        /** @type {Array<object>} Caches the currently filtered and sorted list of columns to be rendered. */
        this.currentColumns = [];
        /** @type {{column: string, direction: 'asc'|'desc'}} The current sort state of the table. */
        this.sortState = { column: 'displayName', direction: 'asc' };
        /** @type {'form'|'all'} The current view mode, determining the data source. */
        this.viewMode = 'form';
        /** @type {Array<{attribute: Xrm.Attributes.Attribute, handler: Function}>} Stores handlers for live attribute updates. */
        this.liveHandlers = [];
        /** @type {HTMLElement|null} Reference to the table's body element for DOM manipulation. */
        this.tableBody = null;
        /** @type {HTMLElement|null} The DOM element on the form currently highlighted by mouseover. */
        this.highlightedElement = null;
        /** @type {HTMLElement|null} The table row element currently being hovered over to prevent redundant DOM updates. */
        this.currentlyHoveredRow = null;
        /** @type {object} Caches references to key UI elements for quick access. */
        this.ui = {};
        /** @type {number} The number of rows to render in each batch for lazy rendering. @private */
        this.renderBatchSize = 100;
        /** @type {number} The index of the next row to be rendered in the lazy-rendering sequence. @private */
        this.renderIndex = 0;
    }

    /**
     * Renders the initial HTML structure of the component.
     * @returns {Promise<HTMLElement>} A promise that resolves with the component's root element.
     */
    async render() {
        const container = document.createElement('div');
        container.className = 'pdt-full-height-column';

        container.innerHTML = `
            <div class="section-title flex-shrink-0">Form Columns & Attributes</div>
            <div class="pdt-toolbar flex-shrink-0">
                <input type="text" id="form-cols-search" class="pdt-input flex-grow" placeholder="Search by Display or Logical Name...">
                
                <div class="pdt-toolbar-group">
                    <label id="unused-cols-container" class="pdt-switcher-toggle" style="display: none;" title="Show only columns that are not on the form">
                        <span class="pdt-toggle-switch">
                            <input type="checkbox" id="unused-cols-toggle" checked>
                            <span class="pdt-toggle-slider"></span>
                        </span>
                        Unused Only
                    </label>
                    <label id="odata-filter-container" class="pdt-switcher-toggle" style="display: none;" title="Hides system-generated fields (e.g., @odata.*, metadata) from results.">
                        <span class="pdt-toggle-switch">
                            <input type="checkbox" id="odata-filter-toggle" checked>
                            <span class="pdt-toggle-slider"></span>
                        </span>
                        Hide System
                    </label>
                </div>

                <div class="pdt-view-switcher">
                    <button class="pdt-switcher-btn active" data-view="form" title="Show only columns present on the form layout">Form Columns</button>
                    <button class="pdt-switcher-btn" data-view="all" title="Show all columns for this record, fetched via Web API">Record Columns</button>
                </div>
            </div>
            <div id="form-cols-table-wrapper" class="pdt-table-wrapper flex-grow" style="min-height: 0;">
                <p class="pdt-note">Loading columns...</p>
            </div>`;

        return container;
    }

    /**
     * Caches UI elements, attaches event listeners, and triggers the initial data load after the component is rendered.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        this.ui = {
            searchInput: element.querySelector('#form-cols-search'),
            tableWrapper: element.querySelector('#form-cols-table-wrapper'),
            viewSwitcher: element.querySelector('.pdt-view-switcher'),
            odataToggle: element.querySelector('#odata-filter-toggle'),
            unusedColsToggle: element.querySelector('#unused-cols-toggle'),
            odataContainer: element.querySelector('#odata-filter-container'),
            unusedContainer: element.querySelector('#unused-cols-container')
        };

        this._loadAndRenderTable();

        const debouncedRender = debounce(() => this._renderTableRows(), 250);
        this._onSearch = debouncedRender;
        this.ui.searchInput.addEventListener('input', this._onSearch);

        this._onOdata = () => this._renderTableRows();
        this._onUnused = () => this._renderTableRows();
        this.ui.odataToggle.addEventListener('change', this._onOdata);
        this.ui.unusedColsToggle.addEventListener('change', this._onUnused);

        this._onSwitch = (e) => this._handleViewSwitch(e);
        this.ui.viewSwitcher.addEventListener('click', this._onSwitch);

        this._onClick = (e) => this._handleTableClick(e);
        this._onMove = (e) => this._handleMouseMove(e);
        this._onLeave = () => this._handleMouseOut();
        this.ui.tableWrapper.addEventListener('click', this._onClick);
        this.ui.tableWrapper.addEventListener('mousemove', this._onMove);
        this.ui.tableWrapper.addEventListener('mouseleave', this._onLeave);

        this._onScroll = debounce(() => this._handleScroll(), 100);
        this.ui.tableWrapper.addEventListener('scroll', this._onScroll);

        this._updateViewState();
    }

    /**
     * Cleans up all attached `onChange` event listeners when the component is destroyed
     * to prevent memory leaks and performance degradation of the host application.
     */
    destroy() {
        // live form handlers
        this._detachLiveHandlers();
        // visual highlight
        this._handleMouseOut();

        try {
            const w = this.ui?.tableWrapper;
            if (w) {
                if (this._onClick) w.removeEventListener('click', this._onClick);
                if (this._onMove) w.removeEventListener('mousemove', this._onMove);
                if (this._onLeave) w.removeEventListener('mouseleave', this._onLeave);
                if (this._onScroll) w.removeEventListener('scroll', this._onScroll);
            }
            const s = this.ui?.searchInput;
            if (s && this._onSearch) s.removeEventListener('input', this._onSearch);
            if (this.ui?.odataToggle && this._onOdata) this.ui.odataToggle.removeEventListener('change', this._onOdata);
            if (this.ui?.unusedColsToggle && this._onUnused) this.ui.unusedColsToggle.removeEventListener('change', this._onUnused);
            const vs = this.ui?.viewSwitcher;
            if (vs && this._onSwitch) vs.removeEventListener('click', this._onSwitch);
        } catch { }
    }

    /**
     * Asynchronously fetches column data based on the current view and triggers the initial table render.
     * @private
     */
    async _loadAndRenderTable() {
        this.ui.tableWrapper.innerHTML = `<p class="pdt-note">${Config.MESSAGES.FORM_COLUMNS.loading(this.viewMode)}</p>`;
        this._detachLiveHandlers();
        try {
            const res = this.viewMode === 'form'
                ? await DataService.getFormColumns(true)
                : await DataService.getAllRecordColumns(true);
            this.allColumns = this._normalizeColumnsResult(res);

            this._renderTable(this.ui.tableWrapper);
            this._attachLiveHandlers();
        } catch (e) {
            this.ui.tableWrapper.innerHTML = `<div class="pdt-error">${Config.MESSAGES.FORM_COLUMNS.loadFailed(e.message)}</div>`;
        }
    }

    _normalizeColumnsResult(res) {
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.value)) return res.value;
        if (Array.isArray(res?.columns)) return res.columns;

        // Plain object from Web API (single record): turn into array
        if (res && typeof res === 'object') {
            const rows = [];
            for (const [key, raw] of Object.entries(res)) {
                // include all keys (even system) — filtering is handled later
                rows.push({
                    logicalName: key,
                    displayName: key,
                    value: raw,
                    // best-effort type string
                    type: raw === null ? 'null' : Array.isArray(raw) ? 'array' : typeof raw,
                    // allow filters to hide these if desired
                    isSystem: isSystemProperty(key)
                });
            }
            return rows;
        }
        return [];
    }

    /**
     * Updates the UI for a single row in the table in response to a data change.
     * @param {string} logicalName - The logical name of the attribute to update.
     * @private
     */
    _updateRowUI(logicalName) {
        const row = this.tableBody?.querySelector(`tr[data-logical-name="${logicalName}"]`);
        const colData = this.allColumns.find(c => c.logicalName === logicalName);
        if (!row || !colData?.attribute) return;

        const newValue = formatDisplayValue(colData.attribute.getValue(), colData.attribute);
        const isDirty = colData.attribute.getIsDirty();

        colData.isDirty = isDirty;
        colData.value = newValue;

        const valueCell = row.cells?.[2];
        const dirtyCell = row.cells?.[4];
        if (valueCell) { valueCell.textContent = newValue; valueCell.title = newValue; }
        if (dirtyCell) { dirtyCell.innerHTML = isDirty ? '<span title="Modified since last save">🟡</span>' : ''; }
    }

    /**
     * Attaches `onChange` handlers to form attributes for live updates.
     * @private
     */
    _attachLiveHandlers() {
        if (this.viewMode !== 'form' || !this.tableBody) return;

        this.liveHandlers = this.allColumns
            .filter(col => col.attribute)
            .map(colData => {
                const handler = () => this._updateRowUI(colData.logicalName);
                colData.attribute.addOnChange(handler);
                return { attribute: colData.attribute, handler };
            });
    }

    /**
     * Shows a dialog to edit an attribute's value and handles the update logic.
     * @param {object} columnData - The data for the column being edited.
     * @private
     */
    _showAttributeEditor(columnData) {
        const { logicalName, displayName, type, attribute } = columnData;
        const currentValue = attribute ? attribute.getValue() : null;

        const formControlHtml = FormControlFactory.create(type, currentValue, attribute);

        const contentHtml = `
            <p>Enter new value for <strong>${escapeHtml(displayName)}</strong>.</p>
            ${formControlHtml}
        `;

        DialogService.show(`Edit: ${logicalName}`, contentHtml, (contentDiv) => {
            try {
                const input = contentDiv.querySelector("#pdt-prompt-input, select");
                const newValue = parseInputValue(input, type);

                attribute.setValue(newValue);
                NotificationService.show(Config.MESSAGES.FORM_COLUMNS.updated, 'success');

                this._updateRowUI(logicalName);
            } catch (e) {
                NotificationService.show(Config.MESSAGES.FORM_COLUMNS.updateFailed(e.message), 'error');
                return false;
            }
        });
    }

    /**
     * Applies all active filters and sorting to the `allColumns` array, then resets
     * and triggers the lazy-rendering process for the table body.
     * @private
     */
    _renderTableRows() {
        if (!this.tableBody) return;

        const scrollLeft = this.ui.tableWrapper.scrollLeft;
        const filters = {
            hideSystem: this.ui.odataToggle.checked,
            showUnusedOnly: this.ui.unusedColsToggle.checked,
            search: this.ui.searchInput.value.toLowerCase()
        };

        this.currentColumns = this.allColumns.filter(c => {
            const searchMatch = !filters.search ||
                String(c.displayName || '').toLowerCase().includes(filters.search) ||
                String(c.logicalName || '').toLowerCase().includes(filters.search);

            if (this.viewMode === 'all') {
                const isSystem = c?.isSystem != null ? Boolean(c.isSystem) : isSystemProperty(c.logicalName);
                const onForm = Boolean(c?.onForm);
                const systemMatch = filters.hideSystem ? !isSystem : true;
                const unusedMatch = filters.showUnusedOnly ? !onForm : true;
                return searchMatch && systemMatch && unusedMatch;
            }
            return searchMatch;
        });

        this._sortTable(this.sortState.column, true);

        this.tableBody.textContent = '';
        this.renderIndex = 0;
        this.ui.tableWrapper.scrollTop = 0;

        // Remove any existing "no results" message
        const existingNote = this.ui.tableWrapper.querySelector('.pdt-note');
        if (existingNote) existingNote.remove();

        if (this.currentColumns.length === 0) {
            const note = document.createElement('p');
            note.className = 'pdt-note';
            const why = this.viewMode === 'all'
                ? (this.ui.odataToggle.checked || this.ui.unusedColsToggle.checked
                    ? 'Try turning off filters (Hide System / Unused Only) or clearing search.'
                    : 'No record columns were returned by the API.')
                : 'No form columns matched your search.';
            note.textContent = `No columns to display. ${why}`;
            this.ui.tableWrapper.appendChild(note);
        } else {
            this._renderNextBatch();
        }

        this.ui.tableWrapper.scrollLeft = scrollLeft;
    }

    /**
     * Handles the logic for switching between 'Form' and 'Record' views.
     * @param {MouseEvent} event - The click event from the view switcher button.
     * @private
     */
    _handleViewSwitch(event) {
        const button = event.target.closest('button[data-view]');
        if (!button || button.dataset.view === this.viewMode) return;
        this.viewMode = button.dataset.view;
        this._updateViewState();
        this._loadAndRenderTable();
    }

    /**
     * Updates the UI elements' visibility and active states based on the current `this.viewMode`.
     * @private
     */
    _updateViewState() {
        const isRecordView = this.viewMode === 'all';
        this.ui.odataContainer.style.display = isRecordView ? 'flex' : 'none';
        this.ui.unusedContainer.style.display = isRecordView ? 'flex' : 'none';
        this.ui.viewSwitcher.querySelector('.active')?.classList.remove('active');
        this.ui.viewSwitcher.querySelector(`button[data-view="${this.viewMode}"]`)?.classList.add('active');

        if (isRecordView && !this._hasEnteredRecordView) {
            if (this.ui.odataToggle) this.ui.odataToggle.checked = false;
            if (this.ui.unusedColsToggle) this.ui.unusedColsToggle.checked = false;
            this._hasEnteredRecordView = true;
        }
    }

    /**
     * Handles all delegated click events within the table, routing actions for various interactions.
     * @param {MouseEvent} event - The click event object.
     * @private
     */
    _handleTableClick(event) {
        const header = event.target.closest('th[data-column]');
        if (header) { this._sortTable(header.dataset.column); return; }

        const row = event.target.closest('tr');
        const cell = event.target.closest('td');
        if (!row || !cell) return;

        const logicalName = row.dataset.logicalName;
        const columnData = this.allColumns.find(c => c.logicalName === logicalName);
        if (columnData?.type === 'lookup' && columnData.attribute) { this._showLookupDetails(columnData); return; }
        if (cell.classList.contains('editable-cell') && columnData) { this._showAttributeEditor(columnData); return; }
        if (cell.classList.contains('copyable-cell')) {
            const txt = (cell.getAttribute('data-full') || cell.textContent || '').trim();
            if (!txt) return;
            const preview = txt.length > 120 ? txt.slice(0, 117) + '…' : txt;
            copyToClipboard(txt, `Copied: ${preview}`);
        }
    }

    /**
     * Displays a dialog with detailed information about a lookup field's value.
     * @param {object} columnData - The data object for the lookup column.
     * @private
     */
    _showLookupDetails(columnData) {
        const lookupValue = columnData.attribute.getValue();
        if (!lookupValue?.length) { NotificationService.show(Config.MESSAGES.FORM_COLUMNS.lookupEmpty, 'info'); return; }
        const item = lookupValue[0];
        const contentHtml = `<div class="info-grid"><strong>Record Name:</strong><span class="copyable">${escapeHtml(item.name)}</span><strong>Record ID:</strong><span class="copyable">${escapeHtml(item.id)}</span><strong>Table:</strong><span class="copyable">${escapeHtml(item.entityType)}</span></div>`;
        DialogService.show(`Lookup: ${escapeHtml(columnData.displayName)}`, contentHtml);
    }

    /**
     * Handles mouse movement over the table to highlight the corresponding control
     * and its label on the main form.
     * @param {MouseEvent} event - The mousemove event object.
     * @private
     */
    _handleMouseMove(event) {
        const row = event.target.closest('tr');
        if (row === this.currentlyHoveredRow) return;

        this._handleMouseOut(); // Clear previous highlight
        if (!row) return;

        this.currentlyHoveredRow = row;
        const logicalName = row.dataset.logicalName;
        if (!logicalName) return;

        const columnData = this.allColumns.find(c => c.logicalName === logicalName);
        const controls = columnData?.attribute?.controls.get();
        if (!controls?.length) return;

        const ctrlName = controls[0].getName();
        const controlElement =
            document.querySelector(`div[data-control-name="${ctrlName}"]`) ||
            document.querySelector(`[data-lp-id*="${ctrlName}"]`) ||
            document.querySelector(`[aria-label="${ctrlName}"]`);
        const highlightTarget =
            controlElement?.closest?.('.data-container') ||
            controlElement?.closest?.('[role="group"]') ||
            controlElement;

        if (highlightTarget) {
            highlightTarget.classList.add('pdt-highlight-border');
            this.highlightedElement = highlightTarget;
        }
    }

    /**
     * Clears any active form field highlighting when the mouse leaves the table area.
     * @private
     */
    _handleMouseOut() {
        if (this.highlightedElement) { this.highlightedElement.classList.remove('pdt-highlight-border'); this.highlightedElement = null; }
        this.currentlyHoveredRow = null;
    }

    /**
     * Detaches all live `onChange` event handlers that were attached to form attributes.
     * @private
     */
    _detachLiveHandlers() {
        try {
            this.liveHandlers.forEach(({ attribute, handler }) => {
                if (attribute && typeof attribute.removeOnChange === 'function') { attribute.removeOnChange(handler); }
            });
        } catch (error) {
            // Silent - listener cleanup errors are handled gracefully
        } finally {
            this.liveHandlers = [];
        }
    }

    /**
     * Renders the main table structure and triggers the initial render of the rows.
     * @param {HTMLElement} container - The wrapper element to render the table into.
     * @private
     */
    _renderTable(container) {
        const headers = [
            { key: 'displayName', label: 'Display Name' },
            { key: 'logicalName', label: 'Logical Name' },
            { key: 'value', label: 'Current Value' },
            { key: 'type', label: 'Type' },
            { key: 'isDirty', label: 'Dirty' },
            { key: 'requiredLevel', label: 'Required' }
        ];
        const headerHtml = headers.map(h => `<th data-column="${h.key}">${h.label}</th>`).join('');
        container.innerHTML = `<table class="pdt-table"><thead><tr>${headerHtml}</tr></thead><tbody></tbody></table>`;
        this.tableBody = container.querySelector('tbody');
        this._renderTableRows();
        const headRow = container.querySelector('thead tr');
        this._updateHeaderSortClasses(headRow);

        headRow?.querySelectorAll('th[data-column]')?.forEach(th => {
            th.setAttribute('role', 'columnheader');
            th.setAttribute('aria-sort', th.dataset.column === this.sortState.column
                ? (this.sortState.direction === 'asc' ? 'ascending' : 'descending')
                : 'none');
        });
    }

    /**
     * Renders the next batch of rows into the table body as part of the lazy rendering process.
     * @private
     */
    _renderNextBatch() {
        if (this.renderIndex >= this.currentColumns.length) return;
        const batch = this.currentColumns.slice(this.renderIndex, this.renderIndex + this.renderBatchSize);
        const rowsHtml = batch.map(c => this._createRowHtml(c)).join('');
        this.tableBody.insertAdjacentHTML('beforeend', rowsHtml);
        this.renderIndex += batch.length;
    }

    /**
     * Handles the scroll event on the table wrapper to trigger rendering of the next batch of rows.
     * @private
     */
    _handleScroll() {
        const el = this.ui.tableWrapper;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) { this._renderNextBatch(); }
    }

    /**
     * Generates the HTML string for a single table row (`<tr>`) from a column data object.
     * @param {object} column - The column data object for the row.
     * @returns {string} The HTML string for the `<tr>` element.
     * @private
     */
    _createRowHtml(column) {
        const display = (column.displayName ?? column.logicalName ?? '');
        const fullVal =
            column.value == null
                ? ''
                : (typeof column.attribute?.getValue === 'function'
                    ? formatDisplayValue(column.attribute.getValue(), column.attribute)
                    : (typeof column.value === 'string'
                        ? column.value
                        : formatValuePreview(column.value)));
        const valueStr = formatValuePreview(fullVal);
        const isEditable = this.viewMode === 'form' && column.type !== 'lookup' && (!column.isSystem || column.attribute);
        const dirtyIndicator = column.isDirty ? '<span title="Modified since last save">🟡</span>' : '';
        let requiredIndicator = '';
        if (column.requiredLevel === 'required') {
            requiredIndicator = '<span class="pdt-text-error" title="Business Required">*</span>';
        } else if (column.requiredLevel === 'recommended') {
            requiredIndicator = '<span class="pdt-text-info" title="Business Recommended">*</span>';
        }

        const editIcon = isEditable ? `<span class="edit-icon">${ICONS.edit}</span>` : '';

        return `
            <tr data-logical-name="${column.logicalName}">
                <td class="copyable-cell" title="${escapeHtml(display)}">${escapeHtml(display)}</td>
                <td class="code-like copyable-cell" title="${escapeHtml('Click to copy')}">${escapeHtml(column.logicalName ?? '')}</td>
                <td class="copyable-cell ${isEditable ? 'editable-cell' : ''}"
                    data-full="${escapeHtml(fullVal)}"
                    title="${isEditable ? 'Click to edit value.' : 'Click to copy value.'}">
                    ${editIcon}${escapeHtml(valueStr)}
                </td>
                <td class="copyable-cell">${column.type}</td>
                <td class="pdt-cell-center">${dirtyIndicator}</td>
                <td class="pdt-cell-center">${requiredIndicator}</td>
            </tr>`;
    }

    /**
     * Sorts the `currentColumns` array in place and triggers a re-render of the table rows.
     * @param {string} column - The key of the column to sort by (e.g., 'displayName').
     * @param {boolean} [isInitialSort=false] - If true, sorts the data but does not toggle
     * the sort direction or trigger an immediate DOM re-render.
     * @private
     */
    _sortTable(column, isInitialSort = false) {
        // preserve scroll positions
        const wrapper = this.ui?.tableWrapper;
        const prevScrollLeft = wrapper ? wrapper.scrollLeft : 0;
        const prevScrollTop = wrapper ? wrapper.scrollTop : 0;

        if (!isInitialSort && this.sortState.column === column) {
            this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortState.column = column;
            if (!isInitialSort) this.sortState.direction = 'asc';
        }
        const direction = this.sortState.direction === 'asc' ? 1 : -1;
        this.currentColumns.sort((a, b) => {
            const valA = a[column]; const valB = b[column];
            if (typeof valA === 'boolean' || typeof valB === 'boolean') {
                return ((Number(!!valA) - Number(!!valB)) * direction);
            }
            return String(valA ?? '').localeCompare(String(valB ?? ''), undefined, { sensitivity: 'base' }) * direction;
        });
        if (!isInitialSort) {
            this.tableBody.textContent = '';
            this.renderIndex = 0;
            this._renderNextBatch();
            this._updateHeaderSortClasses(this.tableBody.parentElement.querySelector('thead tr'));

            // restore scroll positions (horizontal + vertical)
            if (wrapper) {
                wrapper.scrollLeft = prevScrollLeft;
                wrapper.scrollTop = prevScrollTop;
            }
        }
    }

    /**
     * Updates the CSS classes on the table headers to display the current sort column and direction indicator.
     * @param {HTMLElement} headerRow - The `<tr>` element containing the table headers.
     * @private
     */
    _updateHeaderSortClasses(headerRow) {
        if (!headerRow) return;
        headerRow.querySelectorAll('th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.column === this.sortState.column) {
                th.classList.add(`sort-${this.sortState.direction}`);
                th.setAttribute('aria-sort', this.sortState.direction === 'asc' ? 'ascending' : 'descending');
            } else {
                th.setAttribute('aria-sort', 'none');
            }
        });
    }
}