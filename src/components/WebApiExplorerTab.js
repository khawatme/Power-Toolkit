/**
 * @file Web API Explorer component.
 * @module components/WebApiExplorerTab
 * @description Provides a client for executing Web API requests (GET, POST, PATCH, DELETE) with a structured,
 * user-friendly builder UI consistent with the FetchXML Tester.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { DataService } from '../services/DataService.js';
import { NotificationService } from '../services/NotificationService.js';
import { DialogService } from '../services/DialogService.js';
import { UIFactory } from '../ui/UIFactory.js';
import { Helpers } from '../utils/Helpers.js';
import { MetadataBrowserDialog } from '../ui/MetadataBrowserDialog.js';

/**
 * Represents the result of a Web API request.
 * @typedef {object} ApiResult
 * @property {Array<object>} [entities] - The array of records for a GET request.
 * @property {string} [id] - The ID of a created record for a POST request.
 * @property {number} [status] - The HTTP status code, especially for no-content responses like DELETE.
 */

/**
 * A component for building and executing Web API requests against Dataverse.
 * @class WebApiExplorerTab
 * @extends {BaseComponent}
 */
export class WebApiExplorerTab extends BaseComponent {
    /**
     * Initializes the WebApiExplorerTab component.
     */
    constructor() {
        super('apiExplorer', 'WebAPI Explorer', ICONS.api);
        this.lastResult = null;
        this.currentView = 'table';
        this.hideOdata = true;
        this.ui = {};
        this.selectedEntityLogicalName = null;
        this.resultSortState = { column: null, direction: 'asc' };
    }

    /**
     * Renders the component's HTML structure, including separate builder UIs for each HTTP method.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="section-title">Web API Explorer</div>
            <div class="pdt-form-grid" style="margin-bottom: 15px;">
                <label for="api-method-select">Method</label>
                <select id="api-method-select" class="pdt-select">
                    <option value="GET">GET (Retrieve)</option>
                    <option value="POST">POST (Create)</option>
                    <option value="PATCH">PATCH (Update)</option>
                    <option value="DELETE">DELETE</option>
                </select>
            </div>

            <div id="api-view-get">
                <div class="pdt-section-header">Request Builder</div>
                <div class="pdt-form-grid">
                    <label for="api-get-entity">Table</label>
                    <div class="pdt-input-with-button">
                        <input type="text" id="api-get-entity" class="pdt-input" placeholder="e.g., accounts">
                        <button id="browse-api-get-entity-btn" class="pdt-input-btn" title="Browse tables">${ICONS.inspector}</button>
                    </div>
                    <label for="api-get-select">Columns ($select)</label>
                    <div class="pdt-input-with-button">
                        <textarea id="api-get-select" class="pdt-textarea" rows="3" placeholder="name\ncreatedon"></textarea>
                        <button id="browse-api-get-select-btn" class="pdt-input-btn" title="Browse columns" disabled>${ICONS.inspector}</button>
                    </div>
                    <label for="api-get-top">Top Count ($top)</label>
                    <input type="number" id="api-get-top" class="pdt-input" placeholder="Limit results, e.g., 10" value="10">
                </div>

                <div class="pdt-section-header" style="margin-top:15px;">Filter ($filter)</div>
                 <div class="pdt-form-grid">
                    <label>Conditions</label>
                    <div id="api-get-conditions-container" class="pdt-builder-group"></div>
                </div>
                
                <div class="pdt-section-header" style="margin-top:15px;">Order By ($orderby)</div>
                <div class="pdt-form-grid">
                    <label for="api-get-orderby-attribute">Attribute</label>
                    <div class="pdt-input-with-button">
                         <input id="api-get-orderby-attribute" type="text" class="pdt-input" placeholder="e.g., createdon">
                         <button id="browse-api-get-orderby-btn" class="pdt-input-btn" title="Browse columns" disabled>${ICONS.inspector}</button>
                    </div>
                    <label for="api-get-orderby-direction">Direction</label>
                    <select id="api-get-orderby-direction" class="pdt-select">
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>
                </div>
            </div>

            <div id="api-view-post-patch" style="display:none;">
                <div class="pdt-section-header" style="margin-top:15px;">Request Details</div>
                <div class="pdt-form-grid">
                    <label for="api-post-patch-entity">Table</label>
                     <div class="pdt-input-with-button">
                        <input type="text" id="api-post-patch-entity" class="pdt-input" placeholder="e.g., accounts">
                        <button id="browse-api-post-patch-entity-btn" class="pdt-input-btn" title="Browse tables">${ICONS.inspector}</button>
                    </div>
                    <label for="api-patch-id" id="api-patch-id-label">Record ID</label>
                    <input type="text" id="api-patch-id" class="pdt-input" placeholder="GUID of record to update">
                    <label for="api-body-area" style="align-self: start;">Body (JSON)</label>
                    <textarea id="api-body-area" rows="8" class="pdt-textarea" placeholder='{\n  "name": "New Account Sample"\n}'></textarea>
                </div>
            </div>

            <div id="api-view-delete" style="display:none;">
                 <div class="pdt-section-header" style="margin-top:15px;">Request Details</div>
                 <div class="pdt-form-grid">
                    <label for="api-delete-entity">Table</label>
                     <div class="pdt-input-with-button">
                        <input type="text" id="api-delete-entity" class="pdt-input" placeholder="e.g., accounts">
                        <button id="browse-api-delete-entity-btn" class="pdt-input-btn" title="Browse tables">${ICONS.inspector}</button>
                    </div>
                    <label for="api-delete-id">Record ID</label>
                    <input type="text" id="api-delete-id" class="pdt-input" placeholder="GUID of record to delete">
                </div>
            </div>
            
            <div class="pdt-toolbar" style="justify-content: space-between;">
                <div>
                    <button id="api-get-add-condition-btn" class="modern-button secondary">Add Condition</button>
                </div>
                <div class="pdt-toolbar-group">
                    <button id="api-format-json-btn" class="modern-button secondary" style="display:none;">Format JSON</button>
                    <button id="api-execute-btn" class="modern-button">Execute</button>
                </div>
            </div>
            <div id="api-result-container" style="margin-top:15px; flex-grow:1; display:flex; flex-direction:column; min-height:0;"></div>`;
        return container;
    }

    /**
     * Caches UI elements and attaches event listeners for all component interactions.
     * This version includes the corrected logic for handling manual input in the table fields.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        this.ui = {
            methodSelect: element.querySelector("#api-method-select"),
            resultContainer: element.querySelector("#api-result-container"),
            getView: element.querySelector("#api-view-get"),
            getEntityInput: element.querySelector("#api-get-entity"),
            getSelectInput: element.querySelector("#api-get-select"),
            getTopInput: element.querySelector("#api-get-top"),
            getOrderByAttrInput: element.querySelector("#api-get-orderby-attribute"),
            getOrderByDirSelect: element.querySelector("#api-get-orderby-direction"),
            getConditionsContainer: element.querySelector("#api-get-conditions-container"),
            postPatchView: element.querySelector("#api-view-post-patch"),
            postPatchEntityInput: element.querySelector("#api-post-patch-entity"),
            patchIdLabel: element.querySelector("#api-patch-id-label"),
            patchIdInput: element.querySelector("#api-patch-id"),
            bodyArea: element.querySelector("#api-body-area"),
            deleteView: element.querySelector("#api-view-delete"),
            deleteEntityInput: element.querySelector("#api-delete-entity"),
            deleteIdInput: element.querySelector("#api-delete-id"),
            addConditionBtn: element.querySelector("#api-get-add-condition-btn"),
            formatJsonBtn: element.querySelector("#api-format-json-btn"),
        };

        const _validateAndShowColumnBrowser = async (callback) => {
            if (this.selectedEntityLogicalName) {
                MetadataBrowserDialog.show('attribute', callback, this.selectedEntityLogicalName);
                return;
            }

            const entityName = this.ui.getEntityInput.value.trim();
            if (!entityName) {
                DialogService.show('Select a Table First', '<p>Please enter a table name before browsing for columns.</p>');
                return;
            }

            try {
                const allEntities = await DataService.getEntityDefinitions();
                const entityDefinition = allEntities.find(e => e.EntitySetName === entityName || e.LogicalName === entityName);

                if (entityDefinition) {
                    this.selectedEntityLogicalName = entityDefinition.LogicalName;
                    MetadataBrowserDialog.show('attribute', callback, this.selectedEntityLogicalName);
                } else {
                    DialogService.show('Invalid Table Name', `<p>The table '<strong>${Helpers.escapeHtml(entityName)}</strong>' could not be found. Please check the name or use the browse button to select a valid table.</p>`);
                }
            } catch(e) {
                DialogService.show('Error', `<p>Could not validate the table name: ${e.message}</p>`);
            }
        };
        
        element.addEventListener('click', async (e) => {
            const target = e.target.closest('button, th[data-column]');
            if (!target) return;

            const id = target.id;
            const classList = target.classList;

            if (id === 'browse-api-get-entity-btn' || id === 'browse-api-post-patch-entity-btn' || id === 'browse-api-delete-entity-btn') {
                MetadataBrowserDialog.show('entity', (selectedEntity) => {
                    this.selectedEntityLogicalName = selectedEntity.LogicalName;
                    const entitySetName = selectedEntity.EntitySetName;
                    this.ui.getEntityInput.value = entitySetName;
                    this.ui.postPatchEntityInput.value = entitySetName;
                    this.ui.deleteEntityInput.value = entitySetName;
                    this.ui.getSelectInput.value = '';
                    this.ui.getOrderByAttrInput.value = '';
                    this.ui.getConditionsContainer.innerHTML = '';
                    this._addConditionUI();
                    element.querySelectorAll('.pdt-input-btn[title="Browse columns"]').forEach(btn => btn.disabled = false);
                });
            } else if (id === 'browse-api-get-select-btn') {
                await _validateAndShowColumnBrowser((attr) => {
                    const area = this.ui.getSelectInput;
                    area.value += (area.value ? '\n' : '') + attr.LogicalName;
                });
            } else if (classList.contains('browse-condition-attr')) {
                const input = target.previousElementSibling;
                await _validateAndShowColumnBrowser((attr) => { input.value = attr.LogicalName; });
            } else if (id === 'browse-api-get-orderby-btn') {
                await _validateAndShowColumnBrowser((attr) => { this.ui.getOrderByAttrInput.value = attr.LogicalName; });
            } else if (id === 'api-get-add-condition-btn') {
                this._addConditionUI();
            } else if (id === 'api-format-json-btn') {
                try { this.ui.bodyArea.value = JSON.stringify(JSON.parse(this.ui.bodyArea.value), null, 2); } 
                catch (err) { NotificationService.show(`Invalid JSON: ${err.message}`, 'error'); }
            } else if (id === 'api-execute-btn') {
                await this._executeQuery();
            } else if (target.matches('th[data-column]')) {
                const column = target.dataset.column;
                if (this.resultSortState.column === column) {
                    this.resultSortState.direction = this.resultSortState.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    this.resultSortState.column = column;
                    this.resultSortState.direction = 'asc';
                }
                this._displayResult();
            }
        });

        // This is the corrected keyup handler.
        const entityInputs = [this.ui.getEntityInput, this.ui.postPatchEntityInput, this.ui.deleteEntityInput];
        entityInputs.forEach(input => {
            input.addEventListener('keyup', () => {
                // When a user types manually, always clear the validated logical name.
                this.selectedEntityLogicalName = null;
    
                // Enable or disable column-specific browse buttons based on whether the input has text.
                const isDisabled = !input.value.trim();
                element.querySelectorAll('#browse-api-get-select-btn, #browse-api-get-orderby-btn, .browse-condition-attr').forEach(btn => {
                    btn.disabled = isDisabled;
                });
            });
        });

        this.ui.methodSelect.addEventListener('change', () => this._updateUiState());
        this.ui.resultContainer.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            if (target.id === 'api-view-table') this._switchResultView('table');
            if (target.id === 'api-view-json') this._switchResultView('json');
        });
        this.ui.resultContainer.addEventListener('change', (e) => {
            if (e.target.matches('#odata-filter-toggle')) {
                this.hideOdata = e.target.checked;
                this._displayResult();
            }
        });

        this._updateUiState();
        this._addConditionUI(true);
    }

    /**
     * Dynamically adds a set of input fields for a new GET filter condition.
     * The first condition row's remove button will be disabled.
     * @param {boolean} [isFirst=false] - If true, the remove button will be disabled.
     * @private
     */
    _addConditionUI(isFirst = false) {
        const conditionGroup = document.createElement('div');
        conditionGroup.className = 'pdt-condition-row';
        const optionsHtml = Helpers.FILTER_OPERATORS.filter(op => op.odata).map(op => `<option value="${op.odata}">${op.text}</option>`).join('');

        conditionGroup.innerHTML = `
            <div class="pdt-input-with-button">
                <input type="text" class="pdt-input" data-prop="attribute" placeholder="Attribute">
                <button class="pdt-input-btn browse-condition-attr" title="Browse columns" ${!this.selectedEntityLogicalName ? 'disabled' : ''}>${ICONS.inspector}</button>
            </div>
            <select class="pdt-select" data-prop="operator">${optionsHtml}</select>
            <input type="text" class="pdt-input" data-prop="value" placeholder="Value (e.g., 'text' or 123)">
            <button class="modern-button danger secondary" title="Remove Condition" ${isFirst ? 'disabled' : ''}>X</button>
        `;
        
        if (!isFirst) {
            conditionGroup.querySelector('button.danger').onclick = () => conditionGroup.remove();
        }

        const operatorSelect = conditionGroup.querySelector('[data-prop="operator"]');
        const valueInput = conditionGroup.querySelector('[data-prop="value"]');
        operatorSelect.onchange = () => {
            const isNullOperator = operatorSelect.value.includes('null');
            valueInput.style.display = isNullOperator ? 'none' : 'block';
            if (isNullOperator) valueInput.value = '';
        };
        
        this.ui.getConditionsContainer.appendChild(conditionGroup);
    }

    /**
     * Shows or hides UI sections based on the selected HTTP method.
     * @private
     */
    _updateUiState() {
        const method = this.ui.methodSelect.value;
        this.ui.getView.style.display = method === 'GET' ? '' : 'none';
        this.ui.postPatchView.style.display = (method === 'POST' || method === 'PATCH') ? '' : 'none';
        this.ui.deleteView.style.display = method === 'DELETE' ? '' : 'none';
        
        this.ui.patchIdLabel.style.display = method === 'PATCH' ? '' : 'none';
        this.ui.patchIdInput.style.display = method === 'PATCH' ? '' : 'none';
        
        this.ui.addConditionBtn.style.display = method === 'GET' ? '' : 'none';
        this.ui.formatJsonBtn.style.display = (method === 'POST' || method === 'PATCH') ? '' : 'none';
    }

    /**
     * Builds and executes the Web API request based on the current UI state.
     * @private
     */
    async _executeQuery() {
        this.ui.resultContainer.innerHTML = "<p>Executing...</p>";
        const method = this.ui.methodSelect.value;
        let entity, id, options = '', body = {};

        try {
            switch (method) {
                case 'GET':
                    entity = this.ui.getEntityInput.value.trim();
                    if (!entity) throw new Error('Table name is required.');
                    const select = this.ui.getSelectInput.value.trim().replace(/\n/g, ',');
                    const top = this.ui.getTopInput.value.trim();
                    const orderAttr = this.ui.getOrderByAttrInput.value.trim();
                    const orderDir = this.ui.getOrderByDirSelect.value;
                    const filters = [];
                    this.ui.getConditionsContainer.querySelectorAll('.pdt-condition-row').forEach(row => {
                        const attr = row.querySelector('[data-prop="attribute"]').value.trim();
                        const op = row.querySelector('[data-prop="operator"]').value;
                        let val = row.querySelector('[data-prop="value"]').value.trim();
                        
                        if (op.includes('null')) {
                            if (attr) filters.push(`${attr} ${op.split(' ')[0]} null`);
                        } else if (attr && val) {
                            if (["contains", "startswith", "endswith"].includes(op)) {
                                val = val.replace(/'/g, "''");
                                filters.push(`${op}(${attr},'${val}')`);
                            } else if (op === 'not contains') {
                                val = val.replace(/'/g, "''");
                                filters.push(`not contains(${attr},'${val}')`);
                            } else {
                                if (isNaN(val) && !val.startsWith("'") && !val.startsWith("Microsoft.Dynamics.CRM")) {
                                    val = `'${val.replace(/'/g, "''")}'`;
                                }
                                filters.push(`${attr} ${op} ${val}`);
                            }
                        }
                    });
                    const odataParts = [
                        select && `$select=${select}`,
                        filters.length > 0 && `$filter=${filters.join(' and ')}`,
                        top && `$top=${top}`,
                        orderAttr && `$orderby=${orderAttr} ${orderDir}`
                    ];
                    options = odataParts.filter(Boolean).join('&');
                    this.lastResult = await DataService.retrieveMultipleRecords(entity, options);
                    break;
                case 'POST':
                case 'PATCH':
                    entity = this.ui.postPatchEntityInput.value.trim();
                    if (!entity) throw new Error('Table name is required.');
                    try { body = JSON.parse(this.ui.bodyArea.value); } 
                    catch (e) { throw new Error(`Invalid JSON in body: ${e.message}`); }
                    if (method === 'POST') {
                        this.lastResult = await DataService.createRecord(entity, body);
                    } else {
                        id = this.ui.patchIdInput.value.trim();
                        if (!Helpers.isValidGuid(id)) throw new Error('A valid Record ID (GUID) is required for PATCH.');
                        this.lastResult = await DataService.updateRecord(entity, id, body);
                    }
                    break;
                case 'DELETE':
                    entity = this.ui.deleteEntityInput.value.trim();
                    id = this.ui.deleteIdInput.value.trim();
                    if (!entity) throw new Error('Table name is required for DELETE.');
                    if (!Helpers.isValidGuid(id)) throw new Error('A valid Record ID (GUID) is required for DELETE.');
                    const confirmed = await this._confirmAction('Confirm Deletion', `<p>Are you sure you want to DELETE record <strong>${id}</strong> from <strong>${entity}</strong>?</p><p class="pdt-text-error">This action cannot be undone.</p>`);
                    if (!confirmed) {
                        this.ui.resultContainer.innerHTML = '<p class="pdt-note">Delete operation cancelled.</p>';
                        return;
                    }
                    this.lastResult = await DataService.deleteRecord(entity, id);
                    break;
            }
            this.currentView = (method === 'GET' && this.lastResult.entities?.length > 0) ? 'table' : 'json';
            this.resultSortState = { column: null, direction: 'asc' };
            this._renderResults();
        } catch (e) {
            this.ui.resultContainer.innerHTML = `<div class="pdt-error"><h4>Request Failed</h4><pre>${Helpers.escapeHtml(e.message)}</pre></div>`;
        }
    }
    
    /**
     * Renders the results container, including view-switching tabs and a sortable table.
     * @private
     */
    _renderResults() {
        const recordCount = this.lastResult?.entities?.length || 0;
        const countText = this.lastResult?.status === 204 ? '(Success, No Content)' : `(${recordCount} record${recordCount !== 1 ? 's' : ''})`;

        this.ui.resultContainer.innerHTML = `
            <div class="pdt-toolbar" style="justify-content: space-between;">
                <h4 class="section-title" style="margin:0; border:none;">Result ${countText}</h4>
                <div class="pdt-toolbar-group">
                    <button id="api-view-table" class="pdt-sub-tab">Table</button>
                    <button id="api-view-json" class="pdt-sub-tab">JSON</button>
                    <label class="pdt-switcher-toggle" title="Hide system properties">
                        <span class="pdt-toggle-switch"><input type="checkbox" id="odata-filter-toggle" ${this.hideOdata ? 'checked' : ''}><span class="pdt-toggle-slider"></span></span>@odata
                    </label>
                </div>
            </div>
            <div id="api-result-content" class="pdt-table-wrapper"></div>`;
        
        this._switchResultView(this.currentView);
    }
    
    /**
     * Switches the active view for the results (Table or JSON).
     * @param {'table' | 'json'} view - The view to switch to.
     * @private
     */
    _switchResultView(view) {
        this.currentView = view;
        this.ui.resultContainer.querySelector('#api-view-table').classList.toggle('active', view === 'table');
        this.ui.resultContainer.querySelector('#api-view-json').classList.toggle('active', view === 'json');
        this._displayResult();
    }

    /**
     * Displays the final result in the specified format (Table or JSON), applying sorting and filtering.
     * @private
     */
    _displayResult() {
        const contentEl = this.ui.resultContainer.querySelector('#api-result-content');
        if (!contentEl) return;
        
        if (this.lastResult?.status === 204) {
            contentEl.innerHTML = "<p class='pdt-note'>Operation completed successfully (Status 204 No Content).</p>";
            return;
        }
        const records = this.lastResult?.entities || (this.lastResult?.id ? [this.lastResult] : []);
        if (records.length === 0) {
            contentEl.innerHTML = "<p class='pdt-note'>Query returned no records.</p>";
            return;
        }

        if (this.currentView === 'table') {
            const displayRecords = [...records];
            if (this.resultSortState.column) {
                const { column, direction } = this.resultSortState;
                const dir = direction === 'asc' ? 1 : -1;
                displayRecords.sort((a, b) => {
                    const valA = a[column]; const valB = b[column];
                    if (valA === null || valA === undefined) return 1;
                    if (valB === null || valB === undefined) return -1;
                    return String(valA).localeCompare(String(valB), undefined, { numeric: true }) * dir;
                });
            }

            const headers = Object.keys(displayRecords[0]).filter(h => this.hideOdata ? !Helpers.isOdataProperty(h) : true);
            const headerHtml = headers.map(h => {
                const isSorted = this.resultSortState.column === h;
                const sortClass = isSorted ? `sort-${this.resultSortState.direction}` : '';
                return `<th class="${sortClass}" data-column="${h}">${Helpers.escapeHtml(h)}</th>`;
            }).join('');
            const bodyHtml = displayRecords.map(rec => `<tr>${headers.map(h => `<td class="copyable-cell" title="${Helpers.escapeHtml(rec[h])}">${Helpers.escapeHtml(rec[h])}</td>`).join('')}</tr>`).join('');
            contentEl.innerHTML = `<table class="pdt-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
        } else {
            const resultToDisplay = this.hideOdata ? this._getFilteredResult(this.lastResult) : this.lastResult;
            contentEl.innerHTML = '';
            contentEl.appendChild(UIFactory.createCopyableCodeBlock(JSON.stringify(resultToDisplay, null, 2), 'json'));
        }
    }

    /**
     * Recursively filters an object or array to remove @odata properties.
     * @param {object|Array} data - The data to filter.
     * @returns {object|Array} The filtered data.
     * @private
     */
    _getFilteredResult(data) {
        if (Array.isArray(data)) {
            return data.map(item => this._getFilteredResult(item));
        }
        if (data !== null && typeof data === 'object') {
            return Object.keys(data).reduce((acc, key) => {
                if (!Helpers.isOdataProperty(key)) { acc[key] = this._getFilteredResult(data[key]); }
                return acc;
            }, {});
        }
        return data;
    }

    /**
     * Shows a confirmation dialog.
     * @param {string} title - The dialog title.
     * @param {string} content - The HTML content for the dialog body.
     * @returns {Promise<boolean>} A promise that resolves to true if confirmed, false otherwise.
     * @private
     */
    _confirmAction(title, content) {
        return new Promise(resolve => {
            let isResolved = false;
            const handleConfirm = () => { if (!isResolved) { isResolved = true; resolve(true); } };
            DialogService.show(title, content, handleConfirm);
            const observer = new MutationObserver(() => {
                if (!document.getElementById('pdt-dialog-overlay')) {
                    if (!isResolved) { isResolved = true; resolve(false); }
                    observer.disconnect();
                }
            });
            observer.observe(document.body, { childList: true });
        });
    }
}