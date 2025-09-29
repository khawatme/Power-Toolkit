/**
 * @file FetchXML Tester component.
 * @module components/FetchXmlTesterTab
 * @description Provides an advanced UI to build, edit, and execute FetchXML queries against the Dataverse Web API,
 * featuring a structured builder with metadata browsing and a traditional XML editor.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { DataService } from '../services/DataService.js';
import { NotificationService } from '../services/NotificationService.js';
import { UIFactory } from '../ui/UIFactory.js';
import { Helpers } from '../utils/Helpers.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
import { MetadataBrowserDialog } from '../ui/MetadataBrowserDialog.js';
import { DialogService } from '../services/DialogService.js';

/**
 * Represents the result of a FetchXML query.
 * @typedef {object} ApiResult
 * @property {Array<object>} entities - The array of records returned by the query.
 */

/**
 * A component that allows for building, editing, and executing FetchXML queries.
 * @class FetchXmlTesterTab
 * @extends {BaseComponent}
 * @property {ApiResult|null} lastResult - Caches the last successful API result.
 * @property {'table'|'json'} currentView - The active view for displaying results.
 * @property {boolean} hideOdata - The state of the odata property filter toggle.
 * @property {object} ui - A cache for frequently accessed UI elements.
 * @property {string|null} selectedEntityLogicalName - The logical name of the primary table from the Builder.
 * @property {{column: string|null, direction: 'asc'|'desc'}} resultSortState - The sort state of the results table.
 */
export class FetchXmlTesterTab extends BaseComponent {
    /**
     * Initializes the FetchXmlTesterTab component.
     */
    constructor() {
        super('fetchXmlTester', 'FetchXML Tester', ICONS.fetchXml);
        this.lastResult = null;
        this.currentView = 'table';
        this.hideOdata = true;
        this.ui = {};
        this.selectedEntityLogicalName = null;
        this.resultSortState = { column: null, direction: 'asc' };
    }

    /**
     * Generates FetchXML templates, including a contextual one if on a form.
     * @returns {Array<{label: string, xml: string}>} An array of template objects.
     * @private
     */
    _getFetchTemplates() {
        const currentEntityId = PowerAppsApiService.getEntityId();
        const currentEntityName = PowerAppsApiService.getEntityName();
        const templates = [
            { label: '--- Select a Template ---', xml: '' },
            {
                label: 'Basic: Active Accounts (Top 10)',
                xml: `<fetch top="10">\n  <entity name="account">\n    <attribute name="name" />\n    <attribute name="primarycontactid" />\n    <order attribute="name" />\n    <filter>\n      <condition attribute="statecode" operator="eq" value="0" />\n    </filter>\n  </entity>\n</fetch>`
            },
            {
                label: 'Join: Accounts with Contacts',
                xml: `<fetch>\n  <entity name="account">\n    <attribute name="name" />\n    <link-entity name="contact" from="parentcustomerid" to="accountid" link-type="inner" alias="contact">\n      <attribute name="fullname" />\n    </link-entity>\n  </entity>\n</fetch>`
            },
            {
                label: 'Outer Join: Contacts WITHOUT an Account',
                xml: `<fetch>\n  <entity name="contact">\n    <attribute name="fullname" />\n    <link-entity name="account" from="primarycontactid" to="contactid" link-type="outer" alias="account">\n      <attribute name="name" />\n    </link-entity>\n    <filter>\n      <condition entityname="account" attribute="accountid" operator="null" />\n    </filter>\n  </entity>\n</fetch>`
            },
            {
                label: 'Aggregate: Count of Contacts by Account',
                xml: `<fetch aggregate="true">\n  <entity name="account">\n    <attribute name="name" groupby="true" alias="account_name" />\n    <attribute name="contactid" aggregate="count" alias="contact_count" />\n    <link-entity name="contact" from="parentcustomerid" to="accountid" link-type="inner" />\n  </entity>\n</fetch>`
            }
        ];

        if (currentEntityId && currentEntityName) {
            templates.splice(1, 0, {
                label: `Contextual: Current ${currentEntityName} Record`,
                xml: `<fetch>\n  <entity name="${currentEntityName}">\n    <all-attributes />\n    <filter>\n      <condition attribute="${currentEntityName}id" operator="eq" value="${currentEntityId}" />\n    </filter>\n  </entity>\n</fetch>`
            });
        }
        return templates;
    }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="section-title">FetchXML Tester</div>
            <div class="pdt-content-host">
                <div class="pdt-sub-tabs">
                    <button id="fetch-builder-tab" class="pdt-sub-tab active">Builder</button>
                    <button id="fetch-editor-tab" class="pdt-sub-tab">XML Editor</button>
                </div>
                <div id="fetch-builder-content">
                    <div class="pdt-section-header">Primary Table</div>
                    <div class="pdt-form-grid">
                        <label>Table Name</label>
                        <div class="pdt-input-with-button"><input id="builder-entity" type="text" class="pdt-input" placeholder="e.g., account"><button id="browse-builder-entity-btn" class="pdt-input-btn" title="Browse tables">${ICONS.inspector}</button></div>
                        <label>Columns</label>
                        <div class="pdt-input-with-button"><textarea id="builder-attributes" class="pdt-textarea" rows="3" placeholder="name\ntelephone1"></textarea><button id="browse-builder-attributes-btn" class="pdt-input-btn" title="Browse columns" disabled>${ICONS.inspector}</button></div>
                        <label>Top Count</label>
                        <input id="builder-top-count" type="number" class="pdt-input" placeholder="Limit results, e.g., 50" value="10">
                    </div>
                    <div class="pdt-section-header" style="margin-top:15px;">Filter</div>
                    <div class="pdt-form-grid"><label>Conditions</label><div id="builder-conditions-container" class="pdt-builder-group"></div></div>
                    <div class="pdt-section-header" style="margin-top:15px;">Order By</div>
                    <div class="pdt-form-grid">
                        <label>Attribute</label>
                        <div class="pdt-input-with-button"><input id="builder-order-attribute" type="text" class="pdt-input" placeholder="e.g., name"><button id="browse-builder-order-btn" class="pdt-input-btn" title="Browse columns" disabled>${ICONS.inspector}</button></div>
                        <label>Direction</label>
                        <select id="builder-order-direction" class="pdt-select"><option value="false">Ascending</option><option value="true">Descending</option></select>
                    </div>
                    <div class="pdt-section-header" style="margin-top:15px;">Joins (link-entity)</div>
                    <div id="builder-joins-container" class="pdt-builder-group"></div>
                    <div class="pdt-toolbar" style="margin-top: 20px;"><button id="fetch-add-condition-btn" class="modern-button secondary">Add Condition</button><button id="fetch-add-join-btn" class="modern-button secondary">Add Join</button><button id="fetch-build-btn" class="modern-button" style="margin-left: auto; background: var(--pro-accent);">Generate XML</button></div>
                </div>
                <div id="fetch-editor-content" style="display:none;">
                    <div class="pdt-toolbar"><select id="fetch-template-select" class="pdt-select" style="flex-grow:1;"></select><button id="fetch-format-btn" class="modern-button secondary">Format XML</button></div>
                    <textarea id="fetch-xml-area" class="pdt-textarea" rows="10" placeholder="<fetch>...</fetch>"></textarea>
                </div>
                <div id="fetch-execute-toolbar" class="pdt-toolbar" style="justify-content:flex-end; margin-top:15px; display:none;"><button id="fetch-execute-btn" class="modern-button">Execute</button></div>
                <div id="fetch-result-container" class="pdt-content-host"></div>
            </div>`;
        return container;
    }

    /**
     * Caches UI elements and orchestrates the setup of event listeners and initial data.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        this._cacheUiElements(element);
        this._setupEventListeners(element);
        this._populateTemplateDropdown();
        this._addConditionUI(true); // Add the initial condition row
    }

    /**
     * Caches frequently accessed DOM elements into the this.ui object.
     * @param {HTMLElement} element - The root element of the component.
     * @private
     */
    _cacheUiElements(element) {
        this.ui = {
            templateSelect: element.querySelector("#fetch-template-select"),
            xmlArea: element.querySelector("#fetch-xml-area"),
            executeToolbar: element.querySelector("#fetch-execute-toolbar"),
            resultContainer: element.querySelector("#fetch-result-container"),
            builderTab: element.querySelector("#fetch-builder-tab"),
            editorTab: element.querySelector("#fetch-editor-tab"),
            builderContent: element.querySelector("#fetch-builder-content"),
            editorContent: element.querySelector("#fetch-editor-content"),
            joinsContainer: element.querySelector("#builder-joins-container"),
            builderEntityInput: element.querySelector('#builder-entity')
        };
    }

    /**
     * Attaches all necessary event listeners for the component.
     * @param {HTMLElement} element - The root element of the component.
     * @private
     */
    _setupEventListeners(element) {
        // Main delegated event listener for clicks
        element.addEventListener('click', (e) => this._handleDelegatedClick(e));

        // Listener for typing in the primary table input
        this.ui.builderEntityInput.addEventListener('keyup', (e) => {
            this.selectedEntityLogicalName = e.target.value.trim();
            const isDisabled = !this.selectedEntityLogicalName;
            // Query the entire component for all relevant buttons to enable/disable
            element.querySelectorAll('#browse-builder-attributes-btn, #browse-builder-order-btn, .browse-condition-attr, .browse-join-to').forEach(btn => {
                btn.disabled = isDisabled;
            });
        });

        // Listener for template selection
        this.ui.templateSelect.onchange = (e) => this._handleTemplateChange(e.target.value);

        // Delegated listeners for the results container
        this.ui.resultContainer.addEventListener('click', (e) => {
            const target = e.target.closest('button, .copyable-cell');
            if (!target) return;

            if (target.matches('.copyable-cell')) {
                Helpers.copyToClipboard(target.textContent, `Copied: ${target.textContent}`);
            } else if (target.id === 'fetch-view-table') {
                this._switchResultView('table');
            } else if (target.id === 'fetch-view-json') {
                this._switchResultView('json');
            }
        });

        this.ui.resultContainer.addEventListener('change', (e) => {
            if (e.target.matches('#odata-filter-toggle')) {
                this.hideOdata = e.target.checked;
                this._displayResult();
            }
        });
    }

    /**
     * Populates the template dropdown select element.
     * @private
     */
    _populateTemplateDropdown() {
        const templates = this._getFetchTemplates();
        templates.forEach(t => this.ui.templateSelect.add(new Option(t.label, t.xml)));
    }

    /**
     * A helper function to validate an entity name before opening the metadata browser.
     * @param {function(object):void} callback - The function to execute with the selected attribute metadata.
     * @param {string} [entityName] - The logical name of the entity to browse. Defaults to the selected primary table.
     * @private
     */
    async _validateAndShowColumnBrowser(callback, entityName) {
        const entityToQuery = entityName || this.selectedEntityLogicalName;
        if (!entityToQuery) {
            DialogService.show('Select a Table First', '<p>Please enter a valid table name before browsing for columns.</p>');
            return;
        }
        try {
            await PowerAppsApiService.getEntityMetadata(entityToQuery);
            MetadataBrowserDialog.show('attribute', callback, entityToQuery);
        } catch (e) {
            DialogService.show('Invalid Table Name', `<p>The table '<strong>${Helpers.escapeHtml(entityToQuery)}</strong>' could not be found. Please check the name.</p>`);
        }
    }

    /**
     * Handles all click events delegated from the root element, routing them to the correct action.
     * @param {Event} e - The click event object.
     * @private
     */
    async _handleDelegatedClick(e) {
        const target = e.target.closest('button, th[data-column]');
        if (!target) return;

        const id = target.id;
        const classList = target.classList;

        if (id === 'browse-builder-entity-btn') {
            MetadataBrowserDialog.show('entity', (selected) => {
                this.ui.builderEntityInput.value = selected.LogicalName;
                // Manually trigger the keyup event to enable/disable dependent buttons
                this.ui.builderEntityInput.dispatchEvent(new Event('keyup'));
            });
        } else if (id === 'browse-builder-attributes-btn') {
            await this._validateAndShowColumnBrowser((attr) => {
                const area = this.ui.builderContent.querySelector('#builder-attributes');
                area.value += (area.value ? '\n' : '') + attr.LogicalName;
            });
        } else if (id === 'browse-builder-order-btn') {
            await this._validateAndShowColumnBrowser((attr) => {
                this.ui.builderContent.querySelector('#builder-order-attribute').value = attr.LogicalName;
            });
        } else if (classList.contains('browse-condition-attr')) {
            const input = target.previousElementSibling;
            await this._validateAndShowColumnBrowser((attr) => { input.value = attr.LogicalName; });
        } else if (classList.contains('browse-join-table')) {
            const joinGroup = target.closest('.link-entity-group');
            const input = target.previousElementSibling;
            MetadataBrowserDialog.show('entity', async (selected) => {
                input.value = selected.LogicalName;
                try {
                    const metadata = await PowerAppsApiService.getEntityMetadata(selected.LogicalName);
                    joinGroup.querySelector('[data-prop="from"]').value = metadata.PrimaryIdAttribute;
                } catch (e) { console.warn("Could not fetch primary key for linked entity."); }
            });
        } else if (classList.contains('browse-join-from')) {
            const joinGroup = target.closest('.link-entity-group');
            const linkedEntityName = joinGroup.querySelector('[data-prop="name"]').value.trim();
            const input = target.previousElementSibling;
            if (!linkedEntityName) {
                DialogService.show('Table Name Required', '<p>Please enter a "Link to Table" name for this join before browsing its columns.</p>');
                return;
            }
            await this._validateAndShowColumnBrowser((attr) => { input.value = attr.LogicalName; }, linkedEntityName);
        } else if (classList.contains('browse-join-to')) {
            const input = target.previousElementSibling;
            await this._validateAndShowColumnBrowser((attr) => { input.value = attr.LogicalName; });
        } else if (classList.contains('browse-join-attrs')) {
            const joinGroup = target.closest('.link-entity-group');
            const linkedEntityName = joinGroup.querySelector('[data-prop="name"]').value.trim();
            if (!linkedEntityName) {
                DialogService.show('Table Name Required', '<p>Please enter a "Link to Table" name for this join before browsing its columns.</p>');
                return;
            }
            const callback = (attr) => {
                const area = joinGroup.querySelector('[data-prop="attributes"]');
                area.value += (area.value ? '\n' : '') + attr.LogicalName;
            };
            await this._validateAndShowColumnBrowser(callback, linkedEntityName);
        } else if (id === 'fetch-add-condition-btn') {
            this._addConditionUI();
        } else if (id === 'fetch-add-join-btn') {
            this._addLinkEntityUI();
        } else if (id === 'fetch-build-btn') {
            this._buildFetchXmlFromInputs();
        } else if (id === 'fetch-builder-tab') {
            this._switchBuilderView('builder');
        } else if (id === 'fetch-editor-tab') {
            this._switchBuilderView('editor');
        } else if (id === 'fetch-format-btn') {
            this._formatXml();
        } else if (id === 'fetch-execute-btn') {
            this._executeQuery();
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
    }
    
    /**
     * Switches the view between the FetchXML Builder and the XML Editor.
     * @param {'builder'|'editor'} view - The view to switch to.
     * @private
     */
    _switchBuilderView(view) {
        const isBuilder = view === 'builder';
        this.ui.builderTab.classList.toggle('active', isBuilder);
        this.ui.editorTab.classList.toggle('active', !isBuilder);
        this.ui.builderContent.style.display = isBuilder ? '' : 'none';
        this.ui.editorContent.style.display = isBuilder ? 'none' : '';
        this.ui.executeToolbar.style.display = isBuilder ? 'none' : 'flex';
    }

    /**
     * Dynamically adds a set of input fields for a new filter condition to the Builder UI.
     * The first condition row's remove button will be disabled.
     * @param {boolean} [isFirst=false] - If true, the remove button will be disabled.
     * @private
     */
    _addConditionUI(isFirst = false) {
        const conditionGroup = document.createElement('div');
        conditionGroup.className = 'pdt-condition-row';
        const optionsHtml = Helpers.FILTER_OPERATORS.filter(op => op.fetch).map(op => `<option value="${op.fetch}">${op.text}</option>`).join('');
        conditionGroup.innerHTML = `
            <div class="pdt-input-with-button">
                <input type="text" class="pdt-input" data-prop="attribute" placeholder="Attribute">
                <button class="pdt-input-btn browse-condition-attr" title="Browse columns" ${!this.selectedEntityLogicalName ? 'disabled' : ''}>${ICONS.inspector}</button>
            </div>
            <select class="pdt-select" data-prop="operator">${optionsHtml}</select>
            <input type="text" class="pdt-input" data-prop="value" placeholder="Value">
            <button class="modern-button danger secondary" ${isFirst ? 'disabled' : ''}>X</button>`;
        if (!isFirst) {
            conditionGroup.querySelector('button.danger').onclick = () => conditionGroup.remove();
        }
        const operatorSelect = conditionGroup.querySelector('[data-prop="operator"]');
        const valueInput = conditionGroup.querySelector('[data-prop="value"]');
        operatorSelect.onchange = () => {
            const isNullOperator = operatorSelect.value === 'null' || operatorSelect.value === 'not-null';
            valueInput.style.display = isNullOperator ? 'none' : 'block';
            if (isNullOperator) valueInput.value = '';
        };
        this.ui.builderContent.querySelector("#builder-conditions-container").appendChild(conditionGroup);
    }

    /**
     * Dynamically adds a set of input fields for a new link-entity join to the Builder UI.
     * This version includes "Browse" buttons for all entity and attribute fields.
     * @private
     */
    _addLinkEntityUI() {
        const joinGroup = document.createElement('div');
        joinGroup.className = 'pdt-form-grid link-entity-group';
        joinGroup.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--pro-border);';
        joinGroup.innerHTML = `
            <label>Link Type</label>
            <select class="pdt-select" data-prop="link-type"><option selected>inner</option><option>outer</option></select>
            <label>Link to Table</label>
            <div class="pdt-input-with-button">
                <input type="text" class="pdt-input" data-prop="name" placeholder="e.g., contact">
                <button class="pdt-input-btn browse-join-table" title="Browse tables">${ICONS.inspector}</button>
            </div>
            <label>From Attribute</label>
            <div class="pdt-input-with-button">
                <input type="text" class="pdt-input" data-prop="from" placeholder="Foreign key on linked table">
                <button class="pdt-input-btn browse-join-from" title="Browse columns for linked table">${ICONS.inspector}</button>
            </div>
            <label>To Attribute</label>
            <div class="pdt-input-with-button">
                <input type="text" class="pdt-input" data-prop="to" placeholder="Primary key on '${this.selectedEntityLogicalName || 'primary table'}'">
                <button class="pdt-input-btn browse-join-to" title="Browse columns for primary table" ${!this.selectedEntityLogicalName ? 'disabled' : ''}>${ICONS.inspector}</button>
            </div>
            <label>Alias</label>
            <input type="text" class="pdt-input" data-prop="alias" placeholder="e.g., contact_alias">
            <label>Columns</label>
            <div class="pdt-input-with-button">
                <textarea class="pdt-textarea" data-prop="attributes" rows="2" placeholder="fullname\nemailaddress1"></textarea>
                <button class="pdt-input-btn browse-join-attrs" title="Browse columns for linked table">${ICONS.inspector}</button>
            </div>
            <label></label>
            <button class="modern-button danger secondary">Remove Join</button>`;
        joinGroup.querySelector('button.danger').onclick = () => joinGroup.remove();
        this.ui.joinsContainer.appendChild(joinGroup);
    }

    /**
     * Constructs a FetchXML string by collecting and assembling all values from the
     * Builder UI inputs (table, columns, filters, order, and joins). It then switches
     * to the XML Editor view to display the result.
     * @private
     */
    _buildFetchXmlFromInputs() {
        const primaryEntity = this.ui.builderContent.querySelector("#builder-entity").value.trim();
        if (!primaryEntity) {
            NotificationService.show("Primary Table name is required.", "error");
            return;
        }
        const topCount = this.ui.builderContent.querySelector('#builder-top-count').value;
        const fetchTag = `<fetch${topCount ? ` top="${topCount}"` : ''}>`;
        const getAttributesXml = (rawText) => rawText.split('\n').map(s => s.trim()).filter(Boolean).map(attr => `    <attribute name="${attr}" />`).join('\n');
        const primaryAttributesXml = getAttributesXml(this.ui.builderContent.querySelector("#builder-attributes").value);
        const conditions = [];
        this.ui.builderContent.querySelectorAll('.pdt-condition-row').forEach(row => {
            const attr = row.querySelector('[data-prop="attribute"]').value.trim();
            const op = row.querySelector('[data-prop="operator"]').value;
            const val = row.querySelector('[data-prop="value"]').value.trim();
            if (attr) {
                if (op === 'null' || op === 'not-null') {
                    conditions.push(`      <condition attribute="${attr}" operator="${op}" />`);
                } else if (val) {
                    conditions.push(`      <condition attribute="${attr}" operator="${op}" value="${val}" />`);
                }
            }
        });
        const filterXml = conditions.length > 0 ? `    <filter type="and">\n${conditions.join('\n')}\n    </filter>\n` : '';
        let orderXml = '';
        const orderAttribute = this.ui.builderContent.querySelector('#builder-order-attribute').value.trim();
        if (orderAttribute) {
            const isDescending = this.ui.builderContent.querySelector('#builder-order-direction').value === 'true';
            orderXml = `    <order attribute="${orderAttribute}" descending="${isDescending}" />\n`;
        }
        let linkEntitiesXml = '';
        this.ui.joinsContainer.querySelectorAll('.link-entity-group').forEach(group => {
            const name = group.querySelector('[data-prop="name"]').value.trim();
            const from = group.querySelector('[data-prop="from"]').value.trim();
            const to = group.querySelector('[data-prop="to"]').value.trim();
            const linkType = group.querySelector('[data-prop="link-type"]').value;
            const alias = group.querySelector('[data-prop="alias"]').value.trim();
            if (!name || !from || !to) return;
            const attributesXml = getAttributesXml(group.querySelector('[data-prop="attributes"]').value);
            linkEntitiesXml += `    <link-entity name="${name}" from="${from}" to="${to}" link-type="${linkType}" alias="${alias}">\n`;
            if (attributesXml) {
                linkEntitiesXml += `${attributesXml}\n`;
            } else {
                linkEntitiesXml += `        <all-attributes />\n`;
            }
            linkEntitiesXml += `    </link-entity>\n`;
        });
        let xml = `${fetchTag}\n  <entity name="${primaryEntity}">\n`;
        if (primaryAttributesXml) {
            xml += `${primaryAttributesXml}\n`;
        } else {
            xml += `    <all-attributes />\n`;
        }
        if (orderXml) xml += orderXml;
        if (filterXml) xml += filterXml;
        if (linkEntitiesXml) xml += linkEntitiesXml;
        xml += `  </entity>\n</fetch>`;
        this.ui.xmlArea.value = xml;
        this._formatXml();
        this._switchBuilderView('editor');
        NotificationService.show("FetchXML generated and moved to editor.", "success");
    }

    /**
     * Handles the selection of a FetchXML template.
     * @param {string} xml - The XML content of the selected template.
     * @private
     */
    _handleTemplateChange(xml) {
        if (xml) {
            this.ui.xmlArea.value = xml;
            this._formatXml();
        }
    }

    /**
     * Formats the XML in the editor textarea using basic indentation.
     * @private
     */
    _formatXml() {
        const xmlStr = this.ui.xmlArea.value;
        if (!xmlStr) return;
        this.ui.xmlArea.value = Helpers.formatXml(xmlStr);
    }

    /**
     * Executes the FetchXML query from the editor against the Dataverse Web API.
     * @private
     */
    async _executeQuery() {
        const fetchXml = this.ui.xmlArea.value.trim();
        if (!fetchXml) {
            NotificationService.show("FetchXML cannot be empty.", 'error');
            return;
        }
        const entityMatch = /<entity name=["']([^"']+)["']/.exec(fetchXml);
        if (!entityMatch?.[1]) {
            NotificationService.show("Could not find a primary <entity> name in the FetchXML.", 'error');
            return;
        }
        const entityName = entityMatch[1];
        this.ui.resultContainer.innerHTML = "<p>Executing...</p>";
        try {
            this.lastResult = await DataService.executeFetchXml(entityName, fetchXml);
            this.currentView = 'table';
            this.resultSortState = { column: null, direction: 'asc' };
            this._renderResults();
        } catch (e) {
            this.ui.resultContainer.innerHTML = `<div class="pdt-error"><h4>Execution Failed</h4><pre>${Helpers.escapeHtml(e.message)}</pre></div>`;
        }
    }

    /**
     * Renders the results container, including view-switching tabs and result content.
     * @private
     */
    _renderResults() {
        const recordCount = this.lastResult?.entities?.length || 0;
        const countText = `(${recordCount} record${recordCount !== 1 ? 's' : ''})`;
        this.ui.resultContainer.innerHTML = `
            <div class="pdt-toolbar" style="justify-content: space-between;">
                <h4 class="section-title" style="margin:0; border:none;">Result ${countText}</h4>
                <div class="pdt-toolbar-group">
                    <button id="fetch-view-table" class="pdt-sub-tab">Table</button>
                    <button id="fetch-view-json" class="pdt-sub-tab">JSON</button>
                    <label class="pdt-switcher-toggle" title="Hide system properties">
                        <span class="pdt-toggle-switch">
                            <input type="checkbox" id="odata-filter-toggle" ${this.hideOdata ? 'checked' : ''}>
                            <span class="pdt-toggle-slider"></span>
                        </span>
                        Hide System
                    </label>
                </div>
            </div>
            <div id="fetch-result-content" class="pdt-table-wrapper"></div>`;
        this._switchResultView(this.currentView);
    }
    
    /**
     * Switches the active view for the results (Table or JSON).
     * @param {'table' | 'json'} view - The view to switch to.
     * @private
     */
    _switchResultView(view) {
        this.currentView = view;
        this.ui.resultContainer.querySelector('#fetch-view-table').classList.toggle('active', view === 'table');
        this.ui.resultContainer.querySelector('#fetch-view-json').classList.toggle('active', view === 'json');
        this._displayResult();
    }

    /**
     * Displays the final result in the specified format (Table or JSON), applying sorting and filtering.
     * @private
     */
    _displayResult() {
        const contentEl = this.ui.resultContainer.querySelector('#fetch-result-content');
        if (!contentEl) return;
        if (!this.lastResult || !this.lastResult.entities) {
            contentEl.innerHTML = "<p class='pdt-note'>Query returned no records.</p>";
            return;
        }
        let records = [...this.lastResult.entities];
        if (records.length === 0) {
            contentEl.innerHTML = "<p class='pdt-note'>Query returned no records.</p>";
            return;
        }
        if (this.currentView === 'table') {
            if (this.resultSortState.column) {
                const { column, direction } = this.resultSortState;
                const dir = direction === 'asc' ? 1 : -1;
                records.sort((a, b) => {
                    const valA = a[column];
                    const valB = b[column];
                    if (valA === null || valA === undefined) return 1;
                    if (valB === null || valB === undefined) return -1;
                    return String(valA).localeCompare(String(valB), undefined, { numeric: true }) * dir;
                });
            }
            const headers = Object.keys(records[0]).filter(h => this.hideOdata ? !Helpers.isOdataProperty(h) : true);
            const headerHtml = headers.map(h => {
                const isSorted = this.resultSortState.column === h;
                const sortClass = isSorted ? `sort-${this.resultSortState.direction}` : '';
                return `<th class="${sortClass}" data-column="${h}">${Helpers.escapeHtml(h)}</th>`;
            }).join('');
            const bodyHtml = records.map(rec => `<tr>${headers.map(h => `<td class="copyable-cell" title="Click to copy">${Helpers.escapeHtml(rec[h])}</td>`).join('')}</tr>`).join('');
            contentEl.innerHTML = `<table class="pdt-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
        } else {
            const resultToDisplay = this.hideOdata ? this._getFilteredResult(this.lastResult) : this.lastResult;
            contentEl.innerHTML = '';
            contentEl.appendChild(UIFactory.createCopyableCodeBlock(JSON.stringify(resultToDisplay, null, 2), 'json'));
        }
    }

    /**
     * Recursively filters an object or array to remove @odata properties for the JSON view.
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
}