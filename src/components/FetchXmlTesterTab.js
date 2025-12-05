/**
 * @file FetchXML Tester component.
 * @module components/FetchXmlTesterTab
 * @description Provides an advanced UI to build, edit, and execute FetchXML queries against the Dataverse Web API,
 * featuring a structured builder with metadata browsing and a traditional XML editor.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { DataService } from '../services/DataService.js';
import { NotificationService } from '../services/NotificationService.js';
import { FILTER_OPERATORS, formatXml, normalizeApiResponse, shouldShowOperatorValue, showColumnBrowser } from '../helpers/index.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
import { MetadataBrowserDialog } from '../ui/MetadataBrowserDialog.js';
import { ResultPanel } from '../utils/ui/ResultPanel.js';
import { BusyIndicator } from '../utils/ui/BusyIndicator.js';
import { ErrorParser } from '../utils/parsers/ErrorParser.js';
import { PreferencesHelper } from '../utils/ui/PreferencesHelper.js';
import { Config } from '../constants/index.js';

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
        /** @type {ApiResult|null} */
        this.lastResult = null;
        /** @type {'table'|'json'} */
        this.currentView = PreferencesHelper.load(Config.STORAGE_KEYS.fetchXmlView, 'table');
        /** @type {boolean} */
        this.hideOdata = PreferencesHelper.load(Config.STORAGE_KEYS.fetchXmlHideOdata, true, 'boolean');

        /** @type {Record<string, HTMLElement|null>} */
        this.ui = {};
        /** @type {string|null} */
        this.selectedEntityLogicalName = null;
        /** @type {{column: string|null, direction: 'asc'|'desc'}} */
        this.resultSortState = { column: null, direction: 'asc' };
        /** @type {ResultPanel|null} */
        this.resultPanel = null;

        // Event handler references for cleanup
        /** @private {HTMLElement|null} */ this._rootElement = null;
        /** @private {Function|null} */ this._handleDelegatedClickBound = null;
        /** @private {Function|null} */ this._handleEntityInput = null;
        /** @private {Function|null} */ this._handleRootKeydown = null;
        /** @private {Function|null} */ this._onToolRefresh = null;
        /** @private {Function|null} */ this._onRefresh = null;
        /** @private {Function|null} */ this._templateSelectHandler = null;

        // Map to track dynamically created event handlers for proper cleanup
        // Each entry: element -> {event: 'click'|'change', handler: Function}
        /** @private @type {Map<HTMLElement, {event: string, handler: Function}>} */
        this._dynamicHandlers = new Map();
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
                xml: `<fetch top="10">
                        <entity name="account">
                            <attribute name="name" />
                            <attribute name="primarycontactid" />
                            <order attribute="name" />
                            <filter>
                            <condition attribute="statecode" operator="eq" value="0" />
                            </filter>
                        </entity>
                    </fetch>`
            },
            {
                label: 'Join: Accounts with Contacts',
                xml: `<fetch>
                        <entity name="account">
                            <attribute name="name" />
                            <link-entity name="contact" from="parentcustomerid" to="accountid" link-type="inner" alias="contact">
                            <attribute name="fullname" />
                            </link-entity>
                        </entity>
                    </fetch>`
            },
            {
                label: 'Outer Join: Contacts WITHOUT an Account',
                xml: `<fetch>
                        <entity name="contact">
                            <attribute name="fullname" />
                            <link-entity name="account" from="primarycontactid" to="contactid" link-type="outer" alias="account">
                            <attribute name="name" />
                            </link-entity>
                            <filter>
                            <condition entityname="account" attribute="accountid" operator="null" />
                            </filter>
                        </entity>
                    </fetch>`
            },
            {
                label: 'Aggregate: Count of Contacts by Account',
                xml: `<fetch aggregate="true">
                        <entity name="account">
                            <attribute name="name" groupby="true" alias="account_name" />
                            <attribute name="contactid" aggregate="count" alias="contact_count" />
                            <link-entity name="contact" from="parentcustomerid" to="accountid" link-type="inner" />
                        </entity>
                    </fetch>`
            }
        ];

        if (currentEntityId && currentEntityName) {
            templates.splice(1, 0, {
                label: `Contextual: Current ${currentEntityName} Record`,
                xml: `<fetch>
                        <entity name="${currentEntityName}">
                            <all-attributes />
                            <filter>
                            <condition attribute="${currentEntityName}id" operator="eq" value="${currentEntityId}" />
                            </filter>
                        </entity>
                    </fetch>`
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
                        <div class="pdt-input-with-button">
                            <input id="builder-entity" type="text" class="pdt-input" placeholder="${Config.COMMON_PLACEHOLDERS.entityExample}">
                            <button id="browse-builder-entity-btn" class="pdt-input-btn" title="Browse tables">${ICONS.metadata}</button>
                        </div>
                        <label>Columns</label>
                        <div class="pdt-input-with-button">
                            <textarea id="builder-attributes" class="pdt-textarea" rows="3" placeholder="name\ntelephone1"></textarea>
                            <button id="browse-builder-attributes-btn" class="pdt-input-btn" title="Browse columns">${ICONS.inspector}</button>
                        </div>
                        <label>Top Count</label>
                        <input id="builder-top-count" type="number" class="pdt-input" placeholder="Limit results, e.g., 50" value="10">
                    </div>
                    <div class="pdt-section-header mt-15">Filter</div>
                    <div class="pdt-form-grid">
                        <label>Condition</label>
                        <div id="builder-conditions-container" class="pdt-builder-group"></div>
                    </div>
                    <div class="pdt-section-header mt-15">Order</div>
                    <div class="pdt-form-grid">
                    <label>Order</label>
                    <div class="pdt-builder-group">
                        <div class="pdt-order-grid">
                        <div class="pdt-input-with-button">
                            <input id="builder-order-attribute" type="text" class="pdt-input" placeholder="Attribute e.g., name">
                            <button id="browse-builder-order-btn" class="pdt-input-btn" title="Browse columns">${ICONS.inspector}</button>
                        </div>
                        <select id="builder-order-direction" class="pdt-select">
                            <option value="false">Ascending</option>
                            <option value="true">Descending</option>
                        </select>
                        </div>
                    </div>
                    </div>
                    <div class="pdt-section-header mt-15">Joins (link-entity)</div>
                    <div id="builder-joins-container" class="pdt-builder-group"></div>
                    <div class="pdt-toolbar mt-20">
                        <button id="fetch-add-condition-btn" class="modern-button secondary">Add Condition</button>
                        <button id="fetch-add-join-btn" class="modern-button secondary">Add Join</button>
                        <button id="fetch-build-btn" class="modern-button ml-auto" style="background: var(--pro-accent);">Generate XML</button>
                    </div>
                </div>
                <div id="fetch-editor-content" style="display:none;">
                    <div class="pdt-toolbar">
                        <select id="fetch-template-select" class="pdt-select flex-grow"></select>
                    </div>
                    <textarea id="fetch-xml-area" class="pdt-textarea" rows="10" placeholder="<fetch>...</fetch>"></textarea>
                </div>
                <div id="fetch-execute-toolbar" class="pdt-toolbar pdt-toolbar-end mt-15" style="display:none;">
                    <button id="fetch-format-btn" class="modern-button secondary">Format XML</button>
                    <button id="fetch-execute-btn" class="modern-button" title="Run (Ctrl/Cmd + Enter)">Execute</button>
                </div>

                <!-- Unified results area (ResultPanel) -->
                <div id="fetch-result-root" style="display: none;"></div>
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

        // Initialize ResultPanel shell
        this.resultPanel = new ResultPanel({
            root: this.ui.resultRoot,
            onToggleView: (v) => {
                this.currentView = v;
                PreferencesHelper.save(Config.STORAGE_KEYS.fetchXmlView, v);
                this._displayResult();
            },
            onToggleHide: (h) => {
                this.hideOdata = h;
                PreferencesHelper.save(Config.STORAGE_KEYS.fetchXmlHideOdata, h, 'boolean');
                this._displayResult();
            },
            getSortState: () => this.resultSortState,
            setSortState: (s) => {
                this.resultSortState = s;
            }
        });
        this.resultPanel.renderShell(0, this.currentView, this.hideOdata);

        // External refresh support
        this._bindExternalRefresh();
    }

    /**
     * Caches frequently accessed DOM elements into the this.ui object.
     * @param {HTMLElement} element - The root element of the component.
     * @private
     */
    _cacheUiElements(element) {
        this.ui = {
            templateSelect: element.querySelector('#fetch-template-select'),
            xmlArea: element.querySelector('#fetch-xml-area'),
            executeToolbar: element.querySelector('#fetch-execute-toolbar'),
            builderTab: element.querySelector('#fetch-builder-tab'),
            editorTab: element.querySelector('#fetch-editor-tab'),
            builderContent: element.querySelector('#fetch-builder-content'),
            editorContent: element.querySelector('#fetch-editor-content'),
            joinsContainer: element.querySelector('#builder-joins-container'),
            builderEntityInput: element.querySelector('#builder-entity'),
            executeBtn: element.querySelector('#fetch-execute-btn'),
            resultRoot: element.querySelector('#fetch-result-root')
        };
    }

    /**
     * Attaches all necessary event listeners for the component.
     * @param {HTMLElement} element - The root element of the component.
     * @private
     */
    _setupEventListeners(element) {
        // Store root element reference for cleanup
        this._rootElement = element;

        // Main delegated event listener for clicks
        this._handleDelegatedClickBound = (e) => this._handleDelegatedClick(e);
        element.addEventListener('click', this._handleDelegatedClickBound);

        // Listener for typing in the primary table input
        this._handleEntityInput = () => {
            this.selectedEntityLogicalName = this.ui.builderEntityInput.value.trim();
        };
        this.ui.builderEntityInput.addEventListener('input', this._handleEntityInput);

        // Keyboard shortcut handler (Ctrl+Enter to execute)
        this._handleRootKeydown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const editorVisible = this.ui.editorContent && this.ui.editorContent.style.display !== 'none';
                if (editorVisible && this.ui.executeBtn && !this.ui.executeBtn.disabled) {
                    this.ui.executeBtn.click();
                    e.preventDefault();
                }
            }
        };
        element.addEventListener('keydown', this._handleRootKeydown);

        // Listener for template selection
        this._templateSelectHandler = (e) => this._handleTemplateChange(e.target.value);
        this.ui.templateSelect.addEventListener('change', this._templateSelectHandler);
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
     * Handles all click events delegated from the root element, routing them to the correct action.
     * @param {Event} e - The click event object.
     * @private
     */
    async _handleDelegatedClick(e) {
        const target = e.target.closest('button, th[data-column]');
        if (!target) {
            return;
        }

        const id = target.id;
        const classList = target.classList;

        if (id === 'browse-builder-entity-btn') {
            MetadataBrowserDialog.show('entity', (selected) => {
                this.ui.builderEntityInput.value = selected.LogicalName;
                // Manually trigger the keyup event to enable/disable dependent buttons
                this.ui.builderEntityInput.dispatchEvent(new Event('keyup'));
            });
        } else if (id === 'browse-builder-attributes-btn') {
            showColumnBrowser(
                async () => {
                    const entityName = this.ui.builderEntityInput?.value?.trim();
                    if (!entityName) {
                        throw new Error(Config.MESSAGES.COMMON.selectTableFirst);
                    }
                    await PowerAppsApiService.getEntityMetadata(entityName);
                    return entityName;
                },
                (attr) => {
                    const area = this.ui.builderContent.querySelector('#builder-attributes');
                    area.value += (area.value ? '\n' : '') + attr.LogicalName;
                }
            );
        } else if (id === 'browse-builder-order-btn') {
            showColumnBrowser(
                async () => {
                    const entityName = this.ui.builderEntityInput?.value?.trim();
                    if (!entityName) {
                        throw new Error(Config.MESSAGES.COMMON.selectTableFirst);
                    }
                    await PowerAppsApiService.getEntityMetadata(entityName);
                    return entityName;
                },
                (attr) => {
                    this.ui.builderContent.querySelector('#builder-order-attribute').value = attr.LogicalName;
                }
            );
        } else if (classList.contains('browse-condition-attr')) {
            const input = target.previousElementSibling;
            showColumnBrowser(
                async () => {
                    const entityName = this.ui.builderEntityInput?.value?.trim();
                    if (!entityName) {
                        throw new Error(Config.MESSAGES.COMMON.selectTableFirst);
                    }
                    await PowerAppsApiService.getEntityMetadata(entityName);
                    return entityName;
                },
                (attr) => {
                    input.value = attr.LogicalName;
                }
            );
        } else if (classList.contains('browse-join-table')) {
            const joinGroup = target.closest('.link-entity-group');
            const input = target.previousElementSibling;
            MetadataBrowserDialog.show('entity', async (selected) => {
                input.value = selected.LogicalName;
                try {
                    const metadata = await PowerAppsApiService.getEntityMetadata(selected.LogicalName);
                    joinGroup.querySelector('[data-prop="from"]').value = metadata.PrimaryIdAttribute;
                } catch (_) { /* ignore */ }
            });
        } else if (classList.contains('browse-join-from')) {
            const joinGroup = target.closest('.link-entity-group');
            const linkedEntityName = joinGroup.querySelector('[data-prop="name"]').value.trim();
            const input = target.previousElementSibling;
            if (!linkedEntityName) {
                NotificationService.show(Config.MESSAGES.FETCHXML.enterLinkToTableName, 'warning');
                return;
            }
            showColumnBrowser(
                async () => {
                    await PowerAppsApiService.getEntityMetadata(linkedEntityName);
                    return linkedEntityName;
                },
                (attr) => {
                    input.value = attr.LogicalName;
                }
            );
        } else if (classList.contains('browse-join-to')) {
            const input = target.previousElementSibling;
            showColumnBrowser(
                async () => {
                    const entityName = this.ui.builderEntityInput?.value?.trim();
                    if (!entityName) {
                        throw new Error(Config.MESSAGES.COMMON.selectTableFirst);
                    }
                    await PowerAppsApiService.getEntityMetadata(entityName);
                    return entityName;
                },
                (attr) => {
                    input.value = attr.LogicalName;
                }
            );
        } else if (classList.contains('browse-join-attrs')) {
            const joinGroup = target.closest('.link-entity-group');
            const linkedEntityName = joinGroup.querySelector('[data-prop="name"]').value.trim();
            if (!linkedEntityName) {
                NotificationService.show(Config.MESSAGES.FETCHXML.enterLinkToTableName, 'warning');
                return;
            }
            showColumnBrowser(
                async () => {
                    await PowerAppsApiService.getEntityMetadata(linkedEntityName);
                    return linkedEntityName;
                },
                (attr) => {
                    const area = joinGroup.querySelector('[data-prop="attributes"]');
                    area.value += (area.value ? '\n' : '') + attr.LogicalName;
                }
            );
        } else if (id === 'fetch-add-condition-btn') {
            const entityName = this.ui.builderEntityInput?.value?.trim();
            if (!entityName) {
                NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
                return;
            }
            this._addConditionUI();
        } else if (id === 'fetch-add-join-btn') {
            const entityName = this.ui.builderEntityInput?.value?.trim();
            if (!entityName) {
                NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
                return;
            }
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
        conditionGroup.className = 'pdt-condition-grid';
        const optionsHtml = FILTER_OPERATORS
            .filter(op => op.fetch)
            .map(op => `<option value="${op.fetch}">${op.text}</option>`)
            .join('');
        conditionGroup.innerHTML = `
            <div class="pdt-input-with-button">
                <input type="text" class="pdt-input" data-prop="attribute" placeholder="Attribute">
                <button class="pdt-input-btn browse-condition-attr" title="Browse columns">${ICONS.inspector}</button>
            </div>
            <select class="pdt-select" data-prop="operator">${optionsHtml}</select>
            <input type="text" class="pdt-input" data-prop="value" placeholder="Value">
            <button class="modern-button danger secondary" ${isFirst ? 'disabled' : ''}>X</button>`;

        const operatorSelect = conditionGroup.querySelector('[data-prop="operator"]');
        const valueInput = conditionGroup.querySelector('[data-prop="value"]');
        const removeBtn = conditionGroup.querySelector('button.danger');

        // Handler to remove condition group and clean up its listeners
        if (!isFirst && removeBtn) {
            const removeHandler = () => {
                // Clean up this group's handlers
                if (operatorSelect && this._dynamicHandlers.has(operatorSelect)) {
                    const opHandler = this._dynamicHandlers.get(operatorSelect);
                    operatorSelect.removeEventListener('change', opHandler.handler);
                    this._dynamicHandlers.delete(operatorSelect);
                }
                if (removeBtn && this._dynamicHandlers.has(removeBtn)) {
                    removeBtn.removeEventListener('click', removeHandler);
                    this._dynamicHandlers.delete(removeBtn);
                }
                conditionGroup.remove();
            };
            removeBtn.addEventListener('click', removeHandler);
            this._dynamicHandlers.set(removeBtn, { event: 'click', handler: removeHandler });
        }

        // Operator change handler
        const operatorChangeHandler = () => {
            const shouldShow = shouldShowOperatorValue(operatorSelect.value);
            valueInput.style.display = shouldShow ? 'block' : 'none';
            if (!shouldShow) {
                valueInput.value = '';
            }
        };
        if (operatorSelect) {
            operatorSelect.addEventListener('change', operatorChangeHandler);
            this._dynamicHandlers.set(operatorSelect, { event: 'change', handler: operatorChangeHandler });
        }

        this.ui.builderContent.querySelector('#builder-conditions-container').appendChild(conditionGroup);
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
                <button class="pdt-input-btn browse-join-table" title="Browse tables">${ICONS.metadata}</button>
            </div>
            <label>From Attribute</label>
            <div class="pdt-input-with-button">
                <input type="text" class="pdt-input" data-prop="from" placeholder="Foreign key on linked table">
                <button class="pdt-input-btn browse-join-from" title="Browse columns for linked table">${ICONS.inspector}</button>
            </div>
            <label>To Attribute</label>
            <div class="pdt-input-with-button">
                <input type="text" class="pdt-input" data-prop="to" placeholder="Primary key on '${this.selectedEntityLogicalName || 'primary table'}'">
                <button class="pdt-input-btn browse-join-to" title="Browse columns for primary table">${ICONS.inspector}</button>
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

        const removeBtn = joinGroup.querySelector('button.danger');
        if (removeBtn) {
            const removeHandler = () => {
                // Clean up this group's handler
                if (removeBtn && this._dynamicHandlers.has(removeBtn)) {
                    removeBtn.removeEventListener('click', removeHandler);
                    this._dynamicHandlers.delete(removeBtn);
                }
                joinGroup.remove();
            };
            removeBtn.addEventListener('click', removeHandler);
            this._dynamicHandlers.set(removeBtn, { event: 'click', handler: removeHandler });
        }

        this.ui.joinsContainer.appendChild(joinGroup);
    }

    /**
     * Constructs a FetchXML string by collecting and assembling all values from the
     * Builder UI inputs (table, columns, filters, order, and joins). It then switches
     * to the XML Editor view to display the result.
     * @private
     */
    _buildFetchXmlFromInputs() {
        const primaryEntity = this.ui.builderContent.querySelector('#builder-entity').value.trim();
        if (!primaryEntity) {
            NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
            return;
        }
        const topCount = this.ui.builderContent.querySelector('#builder-top-count').value;
        const fetchTag = `<fetch${topCount ? ` top="${topCount}"` : ''}>`;
        const getAttributesXml = (rawText) => rawText
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean)
            .map(attr => `    <attribute name="${attr}" />`)
            .join('\n');

        const primaryAttributesXml = getAttributesXml(this.ui.builderContent.querySelector('#builder-attributes').value);

        const conditions = [];
        this.ui.builderContent.querySelectorAll('.pdt-condition-grid').forEach(row => {
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
            if (!name || !from || !to) {
                return;
            }

            const attributesXml = getAttributesXml(group.querySelector('[data-prop="attributes"]').value);
            linkEntitiesXml += `    <link-entity name="${name}" from="${from}" to="${to}" link-type="${linkType}" alias="${alias}">\n`;
            if (attributesXml) {
                linkEntitiesXml += `${attributesXml}\n`;
            } else {
                linkEntitiesXml += '        <all-attributes />\n';
            }
            linkEntitiesXml += '    </link-entity>\n';
        });

        let xml = `${fetchTag}\n  <entity name="${primaryEntity}">\n`;
        if (primaryAttributesXml) {
            xml += `${primaryAttributesXml}\n`;
        } else {
            xml += '    <all-attributes />\n';
        }
        if (orderXml) {
            xml += orderXml;
        }
        if (filterXml) {
            xml += filterXml;
        }
        if (linkEntitiesXml) {
            xml += linkEntitiesXml;
        }
        xml += '  </entity>\n</fetch>';

        this.ui.xmlArea.value = xml;
        this._formatXml();
        this._switchBuilderView('editor');
        NotificationService.show(Config.MESSAGES.FETCHXML.generated, 'success');
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
        if (!xmlStr) {
            return;
        }
        try {
            this.ui.xmlArea.value = formatXml(xmlStr);
        } catch (e) {
            NotificationService.show(Config.MESSAGES.FETCHXML.formatFailed(e.message), 'warning');
        }
    }

    /**
     * Executes the FetchXML query from the editor against the Dataverse Web API.
     * Uses ResultPanel for unified results rendering and BusyHelper for a clean busy state.
     * @private
     */
    async _executeQuery() {
        const fetchXml = this.ui.xmlArea.value.trim();
        if (!fetchXml) {
            NotificationService.show(Config.MESSAGES.FETCHXML.cannotBeEmpty, 'error');
            return;
        }
        const entityMatch = /<entity name=["']([^"']+)["']/.exec(fetchXml);
        if (!entityMatch?.[1]) {
            NotificationService.show(Config.MESSAGES.FETCHXML.noEntityName, 'error');
            return;
        }
        const entityName = entityMatch[1];

        // Busy UI
        if (this.ui.executeBtn) {
            this.ui.executeBtn.disabled = true;
            if (this.ui.resultRoot) {
                BusyIndicator.set(this.ui.executeBtn, this.ui.resultRoot, 'Executing…');
            }
        }

        try {
            const res = await DataService.executeFetchXml(entityName, fetchXml);
            this.lastResult = normalizeApiResponse(res);
            this.resultSortState = { column: null, direction: 'asc' };

            // Show results section on first execution
            if (this.ui.resultRoot.style.display === 'none') {
                this.ui.resultRoot.style.display = '';
            }

            this._displayResult();
            // Scroll results into view
            this.ui.resultRoot?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {
            const friendly = ErrorParser.extract(e);
            NotificationService.show(friendly, 'error');
            // Clear the panel to avoid lingering "loading"
            this.lastResult = normalizeApiResponse(null);
            this.resultSortState = { column: null, direction: 'asc' };
            if (this.resultPanel) {
                this.resultPanel.renderShell(0, this.currentView, this.hideOdata);
                this.resultPanel.renderContent({ data: [], view: this.currentView, hideOdata: this.hideOdata });
            }
        } finally {
            if (this.ui.executeBtn) {
                BusyIndicator.clear(this.ui.executeBtn);
                this.ui.executeBtn.disabled = false;
            }
        }
    }

    /**
     * Renders data into the ResultPanel (table or JSON), reusing the shared component.
     * @private
     */
    _displayResult() {
        if (!this.resultPanel) {
            return;
        }
        const entities = Array.isArray(this.lastResult?.entities)
            ? this.lastResult.entities
            : (Array.isArray(this.lastResult) ? this.lastResult : (this.lastResult?.value || []));

        this.resultPanel.renderShell(entities.length, this.currentView, this.hideOdata);
        this.resultPanel.renderContent({
            data: entities || [],
            view: this.currentView,
            hideOdata: this.hideOdata
        });
    }

    /**
     * Optional: allow a global refresh to clear results from this tab.
     * Fire: document.dispatchEvent(new CustomEvent('pdt:tool-refresh'));
     * @private
     */
    _bindExternalRefresh() {
        this._onToolRefresh = () => this.clearResults();
        this._onRefresh = () => this.clearResults();
        document.addEventListener('pdt:tool-refresh', this._onToolRefresh);
        document.addEventListener('pdt:refresh', this._onRefresh);
    }

    /**
     * Clears results and resets the ResultPanel.
     */
    clearResults() {
        this.lastResult = normalizeApiResponse(null);
        this.resultSortState = { column: null, direction: 'asc' };

        try {
            this.resultPanel?.dispose?.();
        } catch { /* noop */ }
        if (this.ui.resultRoot) {
            this.ui.resultRoot.textContent = '';
        }
        this.resultPanel = new ResultPanel({
            root: this.ui.resultRoot,
            onToggleView: (v) => {
                this.currentView = v; this._displayResult();
            },
            onToggleHide: (h) => {
                this.hideOdata = h; this._displayResult();
            },
            getSortState: () => this.resultSortState,
            setSortState: (s) => {
                this.resultSortState = s;
            }
        });
        this.resultPanel.renderShell(0, this.currentView, this.hideOdata);
        this.resultPanel.renderContent({ data: [], view: this.currentView, hideOdata: this.hideOdata });
    }

    /**
     * Lifecycle hook for cleaning up event listeners to prevent memory leaks.
     */
    destroy() {
        // Remove root element click handler
        if (this._rootElement && this._handleDelegatedClickBound) {
            this._rootElement.removeEventListener('click', this._handleDelegatedClickBound);
            this._handleDelegatedClickBound = null;
        }

        // Remove entity input handler
        if (this.ui.builderEntityInput && this._handleEntityInput) {
            this.ui.builderEntityInput.removeEventListener('input', this._handleEntityInput);
            this._handleEntityInput = null;
        }

        // Remove keyboard shortcut handler
        if (this._rootElement && this._handleRootKeydown) {
            this._rootElement.removeEventListener('keydown', this._handleRootKeydown);
            this._handleRootKeydown = null;
        }

        // Remove document-level event handlers
        try {
            if (this._onToolRefresh) {
                document.removeEventListener('pdt:tool-refresh', this._onToolRefresh);
                this._onToolRefresh = null;
            }
            if (this._onRefresh) {
                document.removeEventListener('pdt:refresh', this._onRefresh);
                this._onRefresh = null;
            }
        } catch { }

        // Clean up template select handler
        if (this.ui.templateSelect && this._templateSelectHandler) {
            this.ui.templateSelect.removeEventListener('change', this._templateSelectHandler);
            this._templateSelectHandler = null;
        }

        // Clean up all dynamically created handlers (condition groups, join groups)
        for (const [element, { event, handler }] of this._dynamicHandlers.entries()) {
            element.removeEventListener(event, handler);
        }
        this._dynamicHandlers.clear();

        // Clean up result panel
        try {
            this.resultPanel?.dispose?.();
        } catch { }
        this.resultPanel = null;

        // Clear root element reference
        this._rootElement = null;
    }
}
