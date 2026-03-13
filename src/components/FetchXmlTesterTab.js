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
import { formatXml, normalizeApiResponse, showColumnBrowser, copyToClipboard } from '../helpers/index.js';
import { FetchXmlConverterService } from '../services/FetchXmlConverterService.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
import { MetadataBrowserDialog } from '../ui/MetadataBrowserDialog.js';
import { ResultPanel } from '../utils/ui/ResultPanel.js';
import { BusyIndicator } from '../utils/ui/BusyIndicator.js';
import { ErrorParser } from '../utils/parsers/ErrorParser.js';
import { SmartValueInput } from '../ui/SmartValueInput.js';
import { PreferencesHelper } from '../utils/ui/PreferencesHelper.js';
import { EntityContextResolver } from '../utils/resolvers/EntityContextResolver.js';
import { BulkTouchService } from '../services/BulkTouchService.js';
import { Config } from '../constants/index.js';
import { FilterGroupManager } from '../ui/FilterGroupManager.js';

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
        /** @type {{column: string|null, direction: 'asc'|'desc'}} */
        this.resultSortState = { column: null, direction: 'asc' };
        /** @type {ResultPanel|null} */
        this.resultPanel = null;
        /** @type {number} */
        this.joinIdCounter = 0;

        // Pagination state for server-side paging
        /** @type {string|null} */
        this.pagingCookie = null;
        /** @type {number} */
        this.currentPage = 1;
        /** @type {any[]} */
        this.allLoadedRecords = [];
        /** @type {boolean} */
        this.isLoadingMore = false;
        /** @type {string} */
        this.lastExecutedFetchXml = '';
        /** @type {string} */
        this.lastEntityName = '';

        // Event handler references for cleanup
        /** @private {HTMLElement|null} */ this._rootElement = null;
        /** @private {Function|null} */ this._handleDelegatedClickBound = null;
        /** @private {Function|null} */ this._handleRootKeydown = null;
        /** @private {Function|null} */ this._onToolRefresh = null;
        /** @private {Function|null} */ this._onRefresh = null;
        /** @private {Function|null} */ this._templateSelectHandler = null;

        // Map to track dynamically created event handlers for proper cleanup
        // Each entry: element -> {event: 'click'|'change', handler: Function}
        /** @private @type {Map<HTMLElement, {event: string, handler: Function}>} */
        this._dynamicHandlers = new Map();

        // Filter group managers (initialized in _initializeFilterManagers)
        /** @type {FilterGroupManager|null} */
        this.primaryFilterManager = null;
        /** @type {Map<number, FilterGroupManager>} */
        this.joinFilterManagers = new Map();
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
                label: 'Aggregate: Count of Accounts by City',
                xml: `<fetch aggregate="true">
                        <entity name="account">
                            <attribute name="accountid" alias="CountOfAccounts" aggregate="count" />
                            <attribute name="address1_city" alias="City" groupby="true" />
                            <order alias="CountOfAccounts" descending="true" />
                        </entity>
                    </fetch>`
            },
            {
                label: 'Aggregate: Sum/Avg Revenue',
                xml: `<fetch aggregate="true">
                        <entity name="account">
                            <attribute name="revenue" alias="TotalRevenue" aggregate="sum" />
                            <attribute name="revenue" alias="AverageRevenue" aggregate="avg" />
                            <attribute name="numberofemployees" alias="MaxEmployees" aggregate="max" />
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
     * @returns {HTMLElement} The root element of the component.
     */
    render() {
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
                            <textarea id="builder-attributes" class="pdt-textarea" rows="3" spellcheck="false" placeholder="name\ntelephone1"></textarea>
                            <button id="browse-builder-attributes-btn" class="pdt-input-btn" title="Browse columns">${ICONS.inspector}</button>
                        </div>
                        <label>Top Count</label>
                        <input id="builder-top-count" type="number" class="pdt-input" placeholder="Leave empty for all records">
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
                    <div id="builder-filters-section" style="display:none;">
                        <div class="pdt-section-header mt-15">Filter
                            <button class="pdt-section-remove-btn remove-section-btn" data-section="filters" title="${Config.MESSAGES.FETCHXML.removeSection}">&times;</button>
                        </div>
                        <div id="builder-filters-container" class="pdt-builder-group"></div>
                        <div class="pdt-toolbar mt-10">
                            <button id="fetch-add-filter-group-btn" class="modern-button secondary">Add Filter Group</button>
                        </div>
                    </div>
                    <div id="builder-joins-section" style="display:none;">
                        <div class="pdt-section-header mt-15">Joins
                            <button class="pdt-section-remove-btn remove-section-btn" data-section="joins" title="${Config.MESSAGES.FETCHXML.removeSection}">&times;</button>
                        </div>
                        <div id="builder-joins-container" class="pdt-builder-group"></div>
                        <div class="pdt-toolbar mt-10">
                            <button id="fetch-add-join-btn" class="modern-button secondary">Add Join</button>
                        </div>
                    </div>
                    <div id="builder-aggregates-section" style="display:none;">
                        <div class="pdt-section-header mt-15">${Config.MESSAGES.FETCHXML.aggregateSectionTitle}
                            <button class="pdt-section-remove-btn remove-section-btn" data-section="aggregates" title="${Config.MESSAGES.FETCHXML.removeSection}">&times;</button>
                        </div>
                        <div id="builder-aggregates-container" class="pdt-builder-group"></div>
                        <div class="pdt-toolbar mt-10">
                            <button id="fetch-add-aggregate-btn" class="modern-button secondary">${Config.MESSAGES.FETCHXML.addAggregate}</button>
                        </div>
                    </div>
                    <div id="builder-groupby-section" style="display:none;">
                        <div class="pdt-section-header mt-15">${Config.MESSAGES.FETCHXML.groupBySectionTitle}
                            <button class="pdt-section-remove-btn remove-section-btn" data-section="groupby" title="${Config.MESSAGES.FETCHXML.removeSection}">&times;</button>
                        </div>
                        <div id="builder-groupby-container" class="pdt-builder-group"></div>
                        <div class="pdt-toolbar mt-10">
                            <button id="fetch-add-groupby-btn" class="modern-button secondary">${Config.MESSAGES.FETCHXML.addGroupBy}</button>
                        </div>
                    </div>
                    <div class="pdt-toolbar mt-20">
                        <div class="pdt-add-section-wrapper ml-auto">
                            <button id="fetch-add-section-btn" class="modern-button secondary">${Config.MESSAGES.FETCHXML.addSection} ▾</button>
                            <div id="fetch-add-section-menu" class="pdt-add-section-menu" style="display:none;">
                                <button class="pdt-add-section-item" data-section="filters">${Config.MESSAGES.FETCHXML.addFilter}</button>
                                <button class="pdt-add-section-item" data-section="joins">${Config.MESSAGES.FETCHXML.addJoin}</button>
                                <button class="pdt-add-section-item" data-section="aggregates">${Config.MESSAGES.FETCHXML.addAggregateMenu}</button>
                                <button class="pdt-add-section-item" data-section="groupby">${Config.MESSAGES.FETCHXML.addGroupByMenu}</button>
                            </div>
                        </div>
                        <button id="fetch-build-btn" class="modern-button pdt-accent-button">Generate XML</button>
                    </div>
                </div>
                <div id="fetch-editor-content" style="display:none;">
                    <div class="pdt-toolbar">
                        <select id="fetch-template-select" class="pdt-select flex-grow"></select>
                    </div>
                    <textarea id="fetch-xml-area" class="pdt-textarea" rows="10" spellcheck="false" placeholder="<fetch>...</fetch>"></textarea>
                    <div id="fetch-converter-panel" class="pdt-converter-panel" style="display:none;">
                        <div class="pdt-section-header mt-15">${Config.MESSAGES.FETCHXML.convertTo}
                            <button id="fetch-converter-close-btn" class="pdt-section-remove-btn" title="${Config.MESSAGES.FETCHXML.removeSection}">&times;</button>
                        </div>
                        <div class="pdt-converter-formats">
                            <button class="pdt-converter-format-btn" data-format="csharp">${Config.MESSAGES.FETCHXML.convertFormatCSharp}</button>
                            <button class="pdt-converter-format-btn" data-format="javascript">${Config.MESSAGES.FETCHXML.convertFormatJavaScript}</button>
                            <button class="pdt-converter-format-btn" data-format="odata">${Config.MESSAGES.FETCHXML.convertFormatOData}</button>
                            <button class="pdt-converter-format-btn" data-format="sql">${Config.MESSAGES.FETCHXML.convertFormatSQL}</button>
                            <button class="pdt-converter-format-btn" data-format="powerautomate">${Config.MESSAGES.FETCHXML.convertFormatPowerAutomate}</button>
                            <button class="pdt-converter-format-btn" data-format="webapiurl">${Config.MESSAGES.FETCHXML.convertFormatWebApiUrl}</button>
                        </div>
                        <div class="pdt-converter-output-wrapper">
                            <textarea id="fetch-converter-output" class="pdt-textarea pdt-converter-output" rows="12" readonly spellcheck="false" placeholder="${Config.MESSAGES.FETCHXML.convertPlaceholder}"></textarea>
                            <button id="fetch-converter-copy-btn" class="modern-button secondary pdt-converter-copy-btn" hidden>Copy</button>
                        </div>
                    </div>
                </div>
                <div id="fetch-execute-toolbar" class="pdt-toolbar pdt-toolbar-end mt-15" style="display:none;">
                    <button id="fetch-converter-toggle-btn" class="modern-button secondary">${Config.MESSAGES.FETCHXML.convertTo}</button>
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

        this._initializeFilterManagers();

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
            },
            onBulkTouch: (records) => this._handleBulkTouch(records),
            enableSelection: true,
            tableName: this.ui.builderEntityInput?.value || '',
            entityLogicalName: this.lastEntityName || ''
        });
        this.resultPanel.renderShell(0, this.currentView, this.hideOdata);
        this._bindExternalRefresh();
    }

    /**
     * Initialize filter group managers for primary entity and joins.
     * @private
     */
    _initializeFilterManagers() {
        // Primary entity filter manager
        this.primaryFilterManager = new FilterGroupManager({
            operatorFilter: 'fetch',
            includeNot: false,
            getEntityContext: () => {
                const entityName = this.ui.builderEntityInput?.value?.trim();
                if (!entityName) {
                    throw new Error(Config.MESSAGES.COMMON.selectTableFirst);
                }
                return entityName;
            },
            renderValueInput: async (attr, conditionGroup, getEntityContext) => {
                const entityName = await getEntityContext();
                if (entityName) {
                    await this._renderValueInput(conditionGroup, attr, () => entityName);
                }
            },
            getAttributeMetadata: async (attrName, entityName) => {
                const attributes = await DataService.getAttributeDefinitions(entityName);
                return attributes.find(attr => attr.LogicalName === attrName) || null;
            },
            onUpdate: () => {
                // No preview to update in FetchXML tab
            },
            handlers: this._dynamicHandlers
        });
    }

    /**
     * Create a filter group manager for a specific join.
     * @private
     * @param {HTMLElement} joinGroup - The join group element
     * @param {number} joinId - The join ID
     * @returns {FilterGroupManager}
     */
    _createJoinFilterManager(joinGroup, joinId) {
        const manager = new FilterGroupManager({
            operatorFilter: 'fetch',
            includeNot: false,
            getEntityContext: () => {
                const joinEntityInput = joinGroup.querySelector('[data-prop="name"]');
                const joinEntityName = joinEntityInput?.value?.trim();
                if (!joinEntityName) {
                    throw new Error('Please enter a join entity name first.');
                }
                return joinEntityName;
            },
            renderValueInput: async (attr, conditionGroup, getEntityContext) => {
                const entityName = await getEntityContext();
                if (entityName) {
                    await this._renderValueInput(conditionGroup, attr, () => entityName);
                }
            },
            getAttributeMetadata: async (attrName, entityName) => {
                const attributes = await DataService.getAttributeDefinitions(entityName);
                return attributes.find(attr => attr.LogicalName === attrName) || null;
            },
            onUpdate: () => {
                // No preview to update
            },
            handlers: this._dynamicHandlers
        });

        this.joinFilterManagers.set(joinId, manager);
        return manager;
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
            filtersContainer: element.querySelector('#builder-filters-container'),
            joinsContainer: element.querySelector('#builder-joins-container'),
            aggregatesContainer: element.querySelector('#builder-aggregates-container'),
            groupByContainer: element.querySelector('#builder-groupby-container'),
            filtersSection: element.querySelector('#builder-filters-section'),
            joinsSection: element.querySelector('#builder-joins-section'),
            aggregatesSection: element.querySelector('#builder-aggregates-section'),
            groupBySection: element.querySelector('#builder-groupby-section'),
            addSectionBtn: element.querySelector('#fetch-add-section-btn'),
            addSectionMenu: element.querySelector('#fetch-add-section-menu'),
            builderEntityInput: element.querySelector('#builder-entity'),
            executeBtn: element.querySelector('#fetch-execute-btn'),
            resultRoot: element.querySelector('#fetch-result-root'),
            converterPanel: element.querySelector('#fetch-converter-panel'),
            converterOutput: element.querySelector('#fetch-converter-output'),
            converterCopyBtn: element.querySelector('#fetch-converter-copy-btn'),
            converterToggleBtn: element.querySelector('#fetch-converter-toggle-btn'),
            converterCloseBtn: element.querySelector('#fetch-converter-close-btn')
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

        // Close dropdown menu when clicking outside
        this._handleDocumentClick = (e) => {
            if (this.ui.addSectionMenu?.style.display !== 'none' &&
                !e.target.closest('.pdt-add-section-wrapper')) {
                this.ui.addSectionMenu.style.display = 'none';
            }
        };
        document.addEventListener('click', this._handleDocumentClick);
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
    _handleDelegatedClick(e) {
        const target = e.target.closest('button, th[data-column]');
        if (!target) {
            return;
        }

        const id = target.id;
        const classList = target.classList;

        // 1. Route by element ID
        if (id && this._routeById(id)) {
            return;
        }

        // 2. Route by CSS class
        this._routeByClass(classList, target);
    }

    /**
     * Routes a click event by the target element's ID.
     * @param {string} id - The element ID
     * @returns {boolean} True if a handler was matched
     * @private
     */
    _routeById(id) {
        /** @type {Record<string, () => void>} */
        const idRoutes = {
            'browse-builder-entity-btn': () => this._handleBrowseEntity(),
            'browse-builder-attributes-btn': () => this._handleBrowseAttributes(),
            'browse-builder-order-btn': () => this._handleBrowseOrder(),
            'fetch-add-filter-group-btn': () => this._handleAddFilterGroup(),
            'fetch-add-join-btn': () => this._handleAddJoin(),
            'fetch-build-btn': () => this._handleBuildXml(),
            'fetch-builder-tab': () => this._switchBuilderView('builder'),
            'fetch-editor-tab': () => this._switchBuilderView('editor'),
            'fetch-format-btn': () => this._formatXml(),
            'fetch-execute-btn': () => this._executeQuery(),
            'fetch-add-aggregate-btn': () => this._addAggregateRow(),
            'fetch-add-groupby-btn': () => this._addGroupByRow(),
            'fetch-add-section-btn': () => this._toggleAddSectionMenu(),
            'fetch-converter-copy-btn': () => this._handleCopyConverted(),
            'fetch-converter-toggle-btn': () => this._toggleConverterPanel(),
            'fetch-converter-close-btn': () => this._closeConverterPanel()
        };

        const handler = idRoutes[id];
        if (handler) {
            handler();
            return true;
        }
        return false;
    }

    /**
     * Routes a click event by the target element's CSS class.
     * @param {DOMTokenList} classList - The element's class list
     * @param {HTMLElement} target - The clicked element
     * @private
     */
    _routeByClass(classList, target) {
        if (classList.contains('browse-condition-attr')) {
            this._handleBrowseConditionAttribute(target);
        } else if (classList.contains('browse-join-table')) {
            this._handleBrowseJoinTable(target);
        } else if (classList.contains('browse-join-from')) {
            this._handleBrowseJoinFrom(target);
        } else if (classList.contains('browse-join-to')) {
            this._handleBrowseJoinTo(target);
        } else if (classList.contains('browse-join-attrs')) {
            this._handleBrowseJoinAttributes(target);
        } else if (classList.contains('remove-join')) {
            this._handleRemoveJoin(target);
        } else if (classList.contains('remove-aggregate-row')) {
            target.closest('.pdt-aggregate-row')?.remove();
            this._updateGroupByAvailability();
        } else if (classList.contains('remove-groupby-row')) {
            target.closest('.pdt-groupby-row')?.remove();
        } else if (classList.contains('pdt-add-section-item')) {
            this._handleAddSection(target.dataset.section);
        } else if (classList.contains('remove-section-btn')) {
            this._handleRemoveSection(target.dataset.section);
        } else if (classList.contains('pdt-converter-format-btn')) {
            this._handleConvert(target.dataset.format);
        }
    }

    /**
     * Toggles visibility of the "Add..." dropdown menu.
     * @private
     */
    _toggleAddSectionMenu() {
        const menu = this.ui.addSectionMenu;
        if (!menu) {
            return;
        }
        const isVisible = menu.style.display !== 'none';
        menu.style.display = isVisible ? 'none' : '';
        this._updateAddSectionMenuItems();
    }

    /**
     * Updates the "Add..." menu items: hides already-visible sections,
     * disables Group By when no aggregates exist.
     * @private
     */
    _updateAddSectionMenuItems() {
        const menu = this.ui.addSectionMenu;
        if (!menu) {
            return;
        }
        const sectionMap = {
            filters: this.ui.filtersSection,
            joins: this.ui.joinsSection,
            aggregates: this.ui.aggregatesSection,
            groupby: this.ui.groupBySection
        };
        menu.querySelectorAll('.pdt-add-section-item').forEach(item => {
            const section = item.dataset.section;
            const sectionEl = sectionMap[section];
            // Hide menu item if section is already visible
            if (sectionEl && sectionEl.style.display !== 'none') {
                item.style.display = 'none';
            } else {
                item.style.display = '';
            }
            // Disable Group By if no aggregates exist
            if (section === 'groupby') {
                const hasAggregates = this.ui.aggregatesContainer?.querySelectorAll('.pdt-aggregate-row').length > 0;
                const aggSectionVisible = this.ui.aggregatesSection?.style.display !== 'none';
                if (!hasAggregates || !aggSectionVisible) {
                    item.disabled = true;
                    item.title = Config.MESSAGES.FETCHXML.groupByRequiresAggregate;
                } else {
                    item.disabled = false;
                    item.title = '';
                }
            }
        });
    }

    /**
     * Handles adding a new section from the dropdown menu.
     * @param {string} section - Section key: 'filters', 'joins', 'aggregates', 'groupby'
     * @private
     */
    _handleAddSection(section) {
        // Close menu
        if (this.ui.addSectionMenu) {
            this.ui.addSectionMenu.style.display = 'none';
        }

        // Table name check
        const entityName = this.ui.builderEntityInput?.value?.trim();
        if (!entityName) {
            NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
            return;
        }

        // GroupBy requires at least one aggregate
        if (section === 'groupby') {
            const aggCount = this.ui.aggregatesContainer?.querySelectorAll('.pdt-aggregate-row').length || 0;
            const aggSectionVisible = this.ui.aggregatesSection?.style.display !== 'none';
            if (aggCount === 0 || !aggSectionVisible) {
                NotificationService.show(Config.MESSAGES.FETCHXML.groupByRequiresAggregate, 'warning');
                return;
            }
        }

        const sectionMap = {
            filters: this.ui.filtersSection,
            joins: this.ui.joinsSection,
            aggregates: this.ui.aggregatesSection,
            groupby: this.ui.groupBySection
        };

        const sectionEl = sectionMap[section];
        if (!sectionEl) {
            return;
        }

        // Show section
        sectionEl.style.display = '';

        // Add first item automatically
        if (section === 'filters') {
            this._handleAddFilterGroup();
        } else if (section === 'joins') {
            this._handleAddJoin();
        } else if (section === 'aggregates') {
            this._addAggregateRow();
        } else if (section === 'groupby') {
            this._addGroupByRow();
        }
    }

    /**
     * Handles removing a section and its contents.
     * @param {string} section - Section key to remove
     * @private
     */
    _handleRemoveSection(section) {
        const sectionMap = {
            filters: { sectionEl: this.ui.filtersSection, containerEl: this.ui.filtersContainer },
            joins: { sectionEl: this.ui.joinsSection, containerEl: this.ui.joinsContainer },
            aggregates: { sectionEl: this.ui.aggregatesSection, containerEl: this.ui.aggregatesContainer },
            groupby: { sectionEl: this.ui.groupBySection, containerEl: this.ui.groupByContainer }
        };

        const info = sectionMap[section];
        if (!info?.sectionEl) {
            return;
        }

        // If removing aggregates, also remove groupby section
        if (section === 'aggregates' && this.ui.groupBySection?.style.display !== 'none') {
            this._handleRemoveSection('groupby');
        }

        // Clean up dynamic handlers for elements in the container
        if (info.containerEl) {
            info.containerEl.querySelectorAll('*').forEach(el => {
                if (this._dynamicHandlers.has(el)) {
                    const { event, handler } = this._dynamicHandlers.get(el);
                    el.removeEventListener(event, handler);
                    this._dynamicHandlers.delete(el);
                }
            });
            info.containerEl.innerHTML = '';
        }

        // Clear join filter managers if removing joins
        if (section === 'joins') {
            this.joinFilterManagers.clear();
        }

        info.sectionEl.style.display = 'none';
    }

    /**
     * Updates Group By button/menu availability based on aggregate count.
     * @private
     */
    _updateGroupByAvailability() {
        const hasAggregates = this.ui.aggregatesContainer?.querySelectorAll('.pdt-aggregate-row').length > 0;
        const groupByBtn = this.ui.builderContent?.querySelector('#fetch-add-groupby-btn');
        if (groupByBtn) {
            groupByBtn.disabled = !hasAggregates;
        }
        // If no aggregates remain, hide groupby section
        if (!hasAggregates && this.ui.groupBySection?.style.display !== 'none') {
            this._handleRemoveSection('groupby');
        }
    }

    /**
     * Handles browse entity button click.
     * @private
     */
    _handleBrowseEntity() {
        MetadataBrowserDialog.show('entity', (selected) => {
            this.ui.builderEntityInput.value = selected.LogicalName;
            this.ui.builderEntityInput.dispatchEvent(new Event('keyup'));
        });
    }

    /**
     * Handles browse attributes button click.
     * @private
     */
    _handleBrowseAttributes() {
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
    }

    /**
     * Handles browse order button click.
     * @private
     */
    _handleBrowseOrder() {
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
    }

    /**
     * Handles browse condition attribute button click.
     * @param {HTMLElement} target - The button element
     * @private
     */
    _handleBrowseConditionAttribute(target) {
        const input = target.previousElementSibling;
        const conditionGroup = target.closest('.pdt-condition-grid');
        const joinGroup = target.closest('.link-entity-group');

        const getEntityName = async () => {
            let entityName;
            if (joinGroup) {
                entityName = joinGroup.querySelector('[data-prop="name"]')?.value?.trim();
                if (!entityName) {
                    throw new Error(Config.MESSAGES.FETCHXML.enterLinkEntityTableName);
                }
            } else {
                entityName = this.ui.builderEntityInput?.value?.trim();
                if (!entityName) {
                    throw new Error(Config.MESSAGES.COMMON.selectTableFirst);
                }
            }
            await PowerAppsApiService.getEntityMetadata(entityName);
            return entityName;
        };

        showColumnBrowser(
            getEntityName,
            async (attr) => {
                input.value = attr.LogicalName;
                if (conditionGroup) {
                    await this._renderValueInput(conditionGroup, attr, getEntityName);
                }
            }
        );
    }

    /**
     * Handles browse join table button click.
     * @param {HTMLElement} target - The button element
     * @private
     */
    _handleBrowseJoinTable(target) {
        const joinGroup = target.closest('.link-entity-group');
        const input = target.previousElementSibling;
        MetadataBrowserDialog.show('entity', async (selected) => {
            input.value = selected.LogicalName;
            try {
                const metadata = await PowerAppsApiService.getEntityMetadata(selected.LogicalName);
                joinGroup.querySelector('[data-prop="from"]').value = metadata.PrimaryIdAttribute;
            } catch (_) { /* ignore */ }
        });
    }

    /**
     * Handles browse join from attribute button click.
     * @param {HTMLElement} target - The button element
     * @private
     */
    _handleBrowseJoinFrom(target) {
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
    }

    /**
     * Handles browse join to attribute button click.
     * @param {HTMLElement} target - The button element
     * @private
     */
    _handleBrowseJoinTo(target) {
        const joinGroup = target.closest('.link-entity-group');
        const input = target.previousElementSibling;
        const parent = joinGroup.querySelector('[data-prop="parent"]')?.value;

        if (!parent) {
            NotificationService.show(Config.MESSAGES.FETCHXML.selectJoinParent, 'warning');
            return;
        }

        const parentEntityName = this._getParentEntityName(parent);
        if (!parentEntityName) {
            return;
        }

        showColumnBrowser(
            async () => {
                await PowerAppsApiService.getEntityMetadata(parentEntityName);
                return parentEntityName;
            },
            (attr) => {
                input.value = attr.LogicalName;
            }
        );
    }

    /**
     * Gets the parent entity name for a join.
     * @param {string} parent - Parent identifier ('primary' or join ID)
     * @returns {string|null} Parent entity name or null if not found
     * @private
     */
    _getParentEntityName(parent) {
        if (parent === 'primary') {
            const entityName = this.ui.builderEntityInput?.value?.trim();
            if (!entityName) {
                NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
                return null;
            }
            return entityName;
        }

        const parentGroup = this.ui.joinsContainer.querySelector(`[data-join-id="${parent}"]`);
        const parentEntityName = parentGroup?.querySelector('[data-prop="name"]')?.value?.trim();
        if (!parentEntityName) {
            NotificationService.show(Config.MESSAGES.FETCHXML.parentJoinRequiresTableName, 'warning');
            return null;
        }
        return parentEntityName;
    }

    /**
     * Handles browse join attributes button click.
     * @param {HTMLElement} target - The button element
     * @private
     */
    _handleBrowseJoinAttributes(target) {
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
    }

    /**
     * Handles add filter group button click.
     * @private
     */
    _handleAddFilterGroup() {
        const entityName = this.ui.builderEntityInput?.value?.trim();
        if (!entityName) {
            NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
            return;
        }
        const isFirst = this.ui.filtersContainer.querySelectorAll('.pdt-filter-group').length === 0;
        this.primaryFilterManager.addFilterGroup(this.ui.filtersContainer, isFirst);
    }

    /**
     * Handles add join button click.
     * @private
     */
    _handleAddJoin() {
        const entityName = this.ui.builderEntityInput?.value?.trim();
        if (!entityName) {
            NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
            return;
        }
        this._addLinkEntityUI();
    }

    /**
     * Handles build XML button click.
     * @private
     */
    _handleBuildXml() {
        const btn = this.ui.builderContent.querySelector('#fetch-build-btn');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = Config.MESSAGES.FETCHXML.generating;
            btn.disabled = true;
            this._buildFetchXmlFromInputs().finally(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            });
        } else {
            this._buildFetchXmlFromInputs();
        }
    }

    /**
     * Handles the removal of a join group from the Builder UI.
     * @param {HTMLElement} removeBtn - The remove button element that was clicked.
     * @private
     */
    _handleRemoveJoin(removeBtn) {
        const joinGroup = removeBtn.closest('.link-entity-group');
        if (!joinGroup) {
            return;
        }

        const joinId = joinGroup.dataset.joinId;
        const dependentJoins = Array.from(this.ui.joinsContainer.querySelectorAll('.link-entity-group'))
            .filter(g => g.querySelector('[data-prop="parent"]')?.value === joinId);

        if (dependentJoins.length > 0) {
            NotificationService.show(
                Config.MESSAGES.FETCHXML.cannotRemoveJoin(dependentJoins.length),
                'warning'
            );
            return;
        }

        joinGroup.querySelectorAll('*').forEach(el => {
            if (this._dynamicHandlers.has(el)) {
                const { event, handler } = this._dynamicHandlers.get(el);
                el.removeEventListener(event, handler);
                this._dynamicHandlers.delete(el);
            }
        });

        joinGroup.remove();
        this._refreshJoinParentOptions();
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

        // Reset converter panel and toggle when switching away
        if (isBuilder) {
            if (this.ui.converterPanel) {
                this.ui.converterPanel.style.display = 'none';
            }
            if (this.ui.converterToggleBtn) {
                this.ui.converterToggleBtn.style.display = '';
            }
        }
    }

    /**
     * Render a smart value input based on attribute type for FetchXML conditions.
     * @private
     * @param {HTMLElement} conditionGroup - The condition row element
     * @param {Object} attr - Attribute metadata
     * @param {Function} getEntityContext - Function to get entity context
     */
    async _renderValueInput(conditionGroup, attr, getEntityContext) {
        const valueContainer = conditionGroup.querySelector('.pdt-value-container');
        if (!valueContainer) {
            return;
        }

        const entityName = await getEntityContext();
        await SmartValueInput.render({
            valueContainer,
            attr,
            entityName,
            dataProp: 'value',
            context: 'fetch',
            row: conditionGroup
        });
    }

    /**
     * Dynamically adds a set of input fields for a new link-entity join to the Builder UI.
     * This version includes "Browse" buttons for all entity and attribute fields.
     * Supports nested joins by allowing parent selection.
     * @private
     */
    _addLinkEntityUI() {
        const joinId = `join_${++this.joinIdCounter}`;
        const parentOptions = this._buildJoinParentOptions();
        const joinGroup = this._createJoinGroupElement(joinId, parentOptions);

        const { parentSelect, aliasInput, nameInput } = this._getJoinGroupInputs(joinGroup);
        this._setupJoinIndentationHandlers(joinGroup, parentSelect);
        this._setupJoinParentOptionsHandlers(aliasInput, nameInput);

        const removeBtn = joinGroup.querySelector('.remove-join');
        const addFilterGroupBtn = joinGroup.querySelector('.add-join-filter-group');
        this._setupJoinButtonHandlers(joinGroup, joinId, removeBtn, addFilterGroupBtn, parentSelect, aliasInput, nameInput);

        this.ui.joinsContainer.appendChild(joinGroup);
        this._updateJoinIndentation(joinGroup, parentSelect);
    }

    /**
     * Builds parent options HTML for join dropdown.
     * @returns {string} HTML string of options
     * @private
     */
    _buildJoinParentOptions() {
        const options = ['<option value=\'\'>-- Select Parent --</option>'];
        const primaryEntity = this.ui.builderEntityInput?.value?.trim();
        if (primaryEntity) {
            options.push(`<option value="primary">${primaryEntity} (Primary)</option>`);
        }

        this.ui.joinsContainer.querySelectorAll('.link-entity-group').forEach(group => {
            const alias = group.querySelector('[data-prop="alias"]')?.value?.trim();
            const name = group.querySelector('[data-prop="name"]')?.value?.trim();
            const groupId = group.dataset.joinId;
            if (groupId) {
                const displayLabel = alias || name || `Join #${groupId.split('_')[1]}`;
                const displayEntity = name ? ` (${name})` : '';
                options.push(`<option value="${groupId}">${displayLabel}${displayEntity}</option>`);
            }
        });

        return options.join('');
    }

    /**
     * Creates the join group DOM element.
     * @param {string} joinId - Unique join identifier
     * @param {string} parentOptions - HTML string of parent options
     * @returns {HTMLElement} The join group element
     * @private
     */
    _createJoinGroupElement(joinId, parentOptions) {
        const joinGroup = document.createElement('div');
        joinGroup.className = 'pdt-form-grid link-entity-group';
        joinGroup.dataset.joinId = joinId;
        joinGroup.dataset.depth = '0';
        joinGroup.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--pro-border);';
        joinGroup.innerHTML = `
            <label>Join From</label>
            <select class="pdt-select" data-prop="parent">${parentOptions}</select>
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
                <input type="text" class="pdt-input" data-prop="to" placeholder="Key on parent table">
                <button class="pdt-input-btn browse-join-to" title="Browse columns for parent table">${ICONS.inspector}</button>
            </div>
            <label>Alias</label>
            <input type="text" class="pdt-input" data-prop="alias" placeholder="e.g., contact_alias">
            <label>Columns</label>
            <div class="pdt-input-with-button">
                <textarea class="pdt-textarea" data-prop="attributes" rows="2" spellcheck="false" placeholder="fullname\nemailaddress1"></textarea>
                <button class="pdt-input-btn browse-join-attrs" title="Browse columns for linked table">${ICONS.inspector}</button>
            </div>
            <label>Filter Groups</label>
            <div class="pdt-builder-group join-filter-groups-container"></div>
            <label></label>
            <div style="display: flex; gap: 10px;">
                <button class="modern-button secondary add-join-filter-group">Add Filter Group</button>
                <button class="modern-button danger secondary remove-join">Remove Join</button>
            </div>`;
        return joinGroup;
    }

    /**
     * Gets key input elements from join group.
     * @param {HTMLElement} joinGroup - The join group element
     * @returns {{parentSelect: HTMLElement, aliasInput: HTMLElement, nameInput: HTMLElement}}
     * @private
     */
    _getJoinGroupInputs(joinGroup) {
        return {
            parentSelect: joinGroup.querySelector('[data-prop="parent"]'),
            aliasInput: joinGroup.querySelector('[data-prop="alias"]'),
            nameInput: joinGroup.querySelector('[data-prop="name"]')
        };
    }

    /**
     * Sets up indentation update handlers for join group.
     * @param {HTMLElement} joinGroup - The join group element
     * @param {HTMLElement} parentSelect - The parent select element
     * @private
     */
    _setupJoinIndentationHandlers(joinGroup, parentSelect) {
        const updateIndentation = () => this._updateJoinIndentation(joinGroup, parentSelect);
        parentSelect.addEventListener('change', updateIndentation);
        this._dynamicHandlers.set(parentSelect, { event: 'change', handler: updateIndentation });
    }

    /**
     * Updates join group indentation based on parent selection.
     * @param {HTMLElement} joinGroup - The join group element
     * @param {HTMLElement} parentSelect - The parent select element
     * @private
     */
    _updateJoinIndentation(joinGroup, parentSelect) {
        const parent = parentSelect.value;
        let depth = 0;
        if (parent && parent !== 'primary') {
            const parentGroup = this.ui.joinsContainer.querySelector(`[data-join-id="${parent}"]`);
            if (parentGroup) {
                depth = parseInt(parentGroup.dataset.depth || '0') + 1;
            }
        }
        joinGroup.dataset.depth = depth.toString();
        joinGroup.style.marginLeft = `${depth * 20}px`;

        if (depth > 0) {
            joinGroup.style.borderLeft = '3px solid var(--pro-accent)';
            joinGroup.style.paddingLeft = '10px';
        } else {
            joinGroup.style.borderLeft = 'none';
            joinGroup.style.paddingLeft = '0';
        }
    }

    /**
     * Sets up handlers to refresh parent options when alias/name changes.
     * @param {HTMLElement} aliasInput - Alias input element
     * @param {HTMLElement} nameInput - Name input element
     * @private
     */
    _setupJoinParentOptionsHandlers(aliasInput, nameInput) {
        const updateParentOptions = () => this._refreshJoinParentOptions();
        aliasInput.addEventListener('blur', updateParentOptions);
        nameInput.addEventListener('blur', updateParentOptions);
        this._dynamicHandlers.set(aliasInput, { event: 'blur', handler: updateParentOptions });
        this._dynamicHandlers.set(nameInput, { event: 'blur', handler: updateParentOptions });
    }

    /**
     * Sets up button click handlers for join group.
     * @param {HTMLElement} joinGroup - The join group element
     * @param {string} joinId - Join identifier
     * @param {HTMLElement} removeBtn - Remove button
     * @param {HTMLElement} addFilterGroupBtn - Add filter group button
     * @param {HTMLElement} parentSelect - Parent select element
     * @param {HTMLElement} aliasInput - Alias input element
     * @param {HTMLElement} nameInput - Name input element
     * @private
     */
    _setupJoinButtonHandlers(joinGroup, joinId, removeBtn, addFilterGroupBtn, parentSelect, aliasInput, nameInput) {
        const addFilterGroupHandler = () => {
            const linkedEntityName = joinGroup.querySelector('[data-prop="name"]').value.trim();
            if (!linkedEntityName) {
                NotificationService.show(Config.MESSAGES.FETCHXML.enterLinkEntityTableName, 'warning');
                return;
            }
            const filterGroupsContainer = joinGroup.querySelector('.join-filter-groups-container');
            const isFirst = filterGroupsContainer.querySelectorAll('.pdt-filter-group').length === 0;
            const joinIdNum = parseInt(joinId.split('_')[1]);
            let manager = this.joinFilterManagers.get(joinIdNum);
            if (!manager) {
                manager = this._createJoinFilterManager(joinGroup, joinIdNum);
            }
            manager.addFilterGroup(filterGroupsContainer, isFirst);
        };

        const removeHandler = () => {
            this._removeJoinGroup(
                joinGroup, joinId, removeHandler, addFilterGroupHandler,
                parentSelect, aliasInput, nameInput, removeBtn, addFilterGroupBtn
            );
        };

        if (removeBtn) {
            removeBtn.addEventListener('click', removeHandler);
            this._dynamicHandlers.set(removeBtn, { event: 'click', handler: removeHandler });
        }
        if (addFilterGroupBtn) {
            addFilterGroupBtn.addEventListener('click', addFilterGroupHandler);
            this._dynamicHandlers.set(addFilterGroupBtn, { event: 'click', handler: addFilterGroupHandler });
        }
    }

    /**
     * Removes a join group and cleans up handlers.
     * @param {HTMLElement} joinGroup - The join group element
     * @param {string} joinId - Join identifier
     * @param {Function} removeHandler - Remove handler function
     * @param {Function} addFilterGroupHandler - Add filter group handler
     * @param {HTMLElement} parentSelect - Parent select element
     * @param {HTMLElement} aliasInput - Alias input element
     * @param {HTMLElement} nameInput - Name input element
     * @param {HTMLElement} removeBtn - Remove button
     * @param {HTMLElement} addFilterGroupBtn - Add filter group button
     * @private
     */
    _removeJoinGroup(joinGroup, joinId, removeHandler, addFilterGroupHandler, parentSelect, aliasInput, nameInput, removeBtn, addFilterGroupBtn) {
        const dependentJoins = Array.from(this.ui.joinsContainer.querySelectorAll('.link-entity-group'))
            .filter(g => g.querySelector('[data-prop="parent"]')?.value === joinId);

        if (dependentJoins.length > 0) {
            NotificationService.show(
                Config.MESSAGES.FETCHXML.cannotRemoveJoin(dependentJoins.length),
                'warning'
            );
            return;
        }

        const handlersToClean = [
            [parentSelect, 'change'],
            [aliasInput, 'blur'],
            [nameInput, 'blur'],
            [removeBtn, 'click'],
            [addFilterGroupBtn, 'click']
        ];

        handlersToClean.forEach(([element, event]) => {
            if (element && this._dynamicHandlers.has(element)) {
                const { handler } = this._dynamicHandlers.get(element);
                element.removeEventListener(event, handler);
                this._dynamicHandlers.delete(element);
            }
        });

        joinGroup.remove();
        this._refreshJoinParentOptions();
    }

    /**
     * Refreshes parent dropdown options in all join groups after joins are added/removed.
     * @private
     */
    _refreshJoinParentOptions() {
        const primaryEntity = this.ui.builderEntityInput?.value?.trim();

        this.ui.joinsContainer.querySelectorAll('.link-entity-group').forEach(joinGroup => {
            const parentSelect = joinGroup.querySelector('[data-prop="parent"]');
            if (!parentSelect) {
                return;
            }

            const currentValue = parentSelect.value;
            const parentOptions = ['<option value=\'\'>-- Select Parent --</option>'];

            if (primaryEntity) {
                parentOptions.push(`<option value="primary">${primaryEntity} (Primary)</option>`);
            }

            // Add other joins as options (excluding self, show even if alias is empty)
            this.ui.joinsContainer.querySelectorAll('.link-entity-group').forEach(otherGroup => {
                if (otherGroup === joinGroup) {
                    return;
                }

                const alias = otherGroup.querySelector('[data-prop="alias"]')?.value?.trim();
                const name = otherGroup.querySelector('[data-prop="name"]')?.value?.trim();
                const groupId = otherGroup.dataset.joinId;
                if (groupId) {
                    // Use alias if available, otherwise show "Join #N" or table name
                    const displayLabel = alias || name || `Join #${groupId.split('_')[1]}`;
                    const displayEntity = name ? ` (${name})` : '';
                    parentOptions.push(`<option value="${groupId}">${displayLabel}${displayEntity}</option>`);
                }
            });

            parentSelect.innerHTML = parentOptions.join('');
            parentSelect.value = currentValue;
        });
    }

    /**
     * Adds an aggregate column row to the Builder UI.
     * Each row has: Column (with browse), Function (select), Alias (input), Order (select), Remove button.
     * @private
     */
    _addAggregateRow() {
        const container = this.ui.aggregatesContainer;
        if (!container) {
            return;
        }

        // Table name guard
        const entityName = this.ui.builderEntityInput?.value?.trim();
        if (!entityName) {
            NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
            return;
        }

        const row = document.createElement('div');
        row.className = 'pdt-aggregate-row pdt-builder-inline-row';
        row.innerHTML = `
            <div class="pdt-input-with-button">
                <input type="text" class="pdt-input aggregate-column-input" placeholder="${Config.MESSAGES.FETCHXML.aggregateColumnPlaceholder}" data-prop="column">
                <button class="pdt-input-btn browse-aggregate-column" title="Browse columns">${ICONS.inspector}</button>
            </div>
            <select class="pdt-select aggregate-function-select" data-prop="function">
                <option value="count">count</option>
                <option value="countcolumn">countcolumn</option>
                <option value="sum">sum</option>
                <option value="avg">avg</option>
                <option value="min">min</option>
                <option value="max">max</option>
            </select>
            <input type="text" class="pdt-input aggregate-alias-input" placeholder="${Config.MESSAGES.FETCHXML.aggregateAliasPlaceholder}" data-prop="alias">
            <select class="pdt-select aggregate-order-select" data-prop="order">
                <option value="">No Order</option>
                <option value="false">Ascending</option>
                <option value="true">Descending</option>
            </select>
            <button class="modern-button secondary small remove-aggregate-row" title="${Config.MESSAGES.FETCHXML.removeAggregate}">&times;</button>
        `;

        // Bind browse button with column-type aware callback
        const browseBtn = row.querySelector('.browse-aggregate-column');
        const columnInput = row.querySelector('.aggregate-column-input');
        const funcSelect = row.querySelector('.aggregate-function-select');
        const aliasInput = row.querySelector('.aggregate-alias-input');
        const browseHandler = () => this._handleBrowseAggregateColumn(columnInput, funcSelect, aliasInput, 'aggregate');
        browseBtn.addEventListener('click', browseHandler);
        this._dynamicHandlers.set(browseBtn, { event: 'click', handler: browseHandler });

        // Auto-generate alias when function changes
        const funcHandler = () => this._autoGenerateAlias(columnInput, funcSelect, aliasInput, 'aggregate');
        funcSelect.addEventListener('change', funcHandler);
        this._dynamicHandlers.set(funcSelect, { event: 'change', handler: funcHandler });

        container.appendChild(row);
        this._updateGroupByAvailability();
    }

    /**
     * Adds a group-by column row to the Builder UI.
     * Each row has: Column (with browse), Alias (input), Date Grouping (select), Remove button.
     * @private
     */
    _addGroupByRow() {
        const container = this.ui.groupByContainer;
        if (!container) {
            return;
        }

        // Table name guard
        const entityName = this.ui.builderEntityInput?.value?.trim();
        if (!entityName) {
            NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
            return;
        }

        // GroupBy requires at least one aggregate
        const aggCount = this.ui.aggregatesContainer?.querySelectorAll('.pdt-aggregate-row').length || 0;
        if (aggCount === 0) {
            NotificationService.show(Config.MESSAGES.FETCHXML.groupByRequiresAggregate, 'warning');
            return;
        }

        const row = document.createElement('div');
        row.className = 'pdt-groupby-row pdt-builder-inline-row';
        row.innerHTML = `
            <div class="pdt-input-with-button">
                <input type="text" class="pdt-input groupby-column-input" placeholder="${Config.MESSAGES.FETCHXML.groupByColumnPlaceholder}" data-prop="column">
                <button class="pdt-input-btn browse-groupby-column" title="Browse columns">${ICONS.inspector}</button>
            </div>
            <input type="text" class="pdt-input groupby-alias-input" placeholder="${Config.MESSAGES.FETCHXML.groupByAliasPlaceholder}" data-prop="alias">
            <select class="pdt-select groupby-dategrouping-select" data-prop="dategrouping">
                <option value="">No Date Grouping</option>
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
                <option value="fiscal-period">Fiscal Period</option>
                <option value="fiscal-year">Fiscal Year</option>
            </select>
            <button class="modern-button secondary small remove-groupby-row" title="${Config.MESSAGES.FETCHXML.removeGroupBy}">&times;</button>
        `;

        // Bind browse button with auto-alias callback
        const browseBtn = row.querySelector('.browse-groupby-column');
        const columnInput = row.querySelector('.groupby-column-input');
        const aliasInput = row.querySelector('.groupby-alias-input');
        const browseHandler = () => this._handleBrowseAggregateColumn(columnInput, null, aliasInput, 'groupby');
        browseBtn.addEventListener('click', browseHandler);
        this._dynamicHandlers.set(browseBtn, { event: 'click', handler: browseHandler });

        container.appendChild(row);
    }

    /**
     * Handles browse for aggregate/groupby column fields.
     * When a column is selected, auto-generates alias and filters aggregate functions by type.
     * @param {HTMLInputElement} input - The column input element
     * @param {HTMLSelectElement|null} funcSelect - The aggregate function select (null for groupby)
     * @param {HTMLInputElement} aliasInput - The alias input element
     * @param {'aggregate'|'groupby'} mode - Whether this is for aggregate or groupby
     * @private
     */
    _handleBrowseAggregateColumn(input, funcSelect, aliasInput, mode) {
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

                // Filter aggregate functions by column type
                if (funcSelect && mode === 'aggregate') {
                    this._filterAggregateFunctionsByType(funcSelect, attr);
                }

                // Auto-generate alias
                this._autoGenerateAlias(input, funcSelect, aliasInput, mode);

                // For groupby: auto-enable date grouping for DateTime columns
                if (mode === 'groupby') {
                    const row = input.closest('.pdt-groupby-row');
                    const dateGroupSelect = row?.querySelector('[data-prop="dategrouping"]');
                    const typeName = attr.AttributeTypeName?.Value || attr.AttributeType || '';
                    if (dateGroupSelect && typeName.toLowerCase().includes('datetime')) {
                        dateGroupSelect.value = 'month';
                    }
                }
            }
        );
    }

    /**
     * Filters the aggregate function dropdown options based on column type.
     * @param {HTMLSelectElement} funcSelect - The function select element
     * @param {Object} attr - Column attribute metadata
     * @private
     */
    _filterAggregateFunctionsByType(funcSelect, attr) {
        const typeName = attr.AttributeTypeName?.Value || attr.AttributeType || '';
        const categoryMap = Config.ATTRIBUTE_TYPE_TO_AGGREGATE_CATEGORY;
        const compatMap = Config.AGGREGATE_TYPE_COMPAT;
        const category = categoryMap[typeName] || 'text';

        const currentValue = funcSelect.value;
        Array.from(funcSelect.options).forEach(option => {
            const fn = option.value;
            const isCompatible = compatMap[fn]?.includes(category);
            option.disabled = !isCompatible;
            if (option.disabled) {
                option.title = `${fn} is not supported for ${category} type columns`;
            } else {
                option.title = '';
            }
        });

        // If current selection is now disabled, switch to first enabled option
        if (funcSelect.selectedOptions[0]?.disabled) {
            const firstEnabled = Array.from(funcSelect.options).find(o => !o.disabled);
            if (firstEnabled) {
                funcSelect.value = firstEnabled.value;
            }
        }

        // Re-generate alias if function changed
        if (funcSelect.value !== currentValue) {
            const row = funcSelect.closest('.pdt-aggregate-row');
            const columnInput = row?.querySelector('[data-prop="column"]');
            const aliasInput = row?.querySelector('[data-prop="alias"]');
            if (columnInput && aliasInput) {
                this._autoGenerateAlias(columnInput, funcSelect, aliasInput, 'aggregate');
            }
        }
    }

    /**
     * Auto-generates an alias based on column name and aggregate function or group mode.
     * @param {HTMLInputElement} columnInput - Column input
     * @param {HTMLSelectElement|null} funcSelect - Function select (null for groupby)
     * @param {HTMLInputElement} aliasInput - Alias input to populate
     * @param {'aggregate'|'groupby'} mode - Mode
     * @private
     */
    _autoGenerateAlias(columnInput, funcSelect, aliasInput, mode) {
        const column = columnInput?.value?.trim();
        if (!column) {
            return;
        }

        if (mode === 'aggregate' && funcSelect) {
            const func = funcSelect.value;
            aliasInput.value = `${func}_${column}`;
        } else if (mode === 'groupby') {
            aliasInput.value = `group_${column}`;
        }
    }

    /**
     * Checks if aggregate mode is active (any aggregate or groupby rows exist).
     * @returns {boolean}
     * @private
     */
    _isAggregateMode() {
        const hasAggregates = this.ui.aggregatesContainer?.querySelectorAll('.pdt-aggregate-row').length > 0;
        const hasGroupBy = this.ui.groupByContainer?.querySelectorAll('.pdt-groupby-row').length > 0;
        return hasAggregates || hasGroupBy;
    }

    /**
     * Extracts aggregate column definitions from the Builder UI.
     * @returns {Array<{column: string, func: string, alias: string, order: string}>}
     * @private
     */
    _extractAggregateRows() {
        const rows = [];
        this.ui.aggregatesContainer?.querySelectorAll('.pdt-aggregate-row').forEach(row => {
            const column = row.querySelector('[data-prop="column"]')?.value?.trim();
            const func = row.querySelector('[data-prop="function"]')?.value;
            const alias = row.querySelector('[data-prop="alias"]')?.value?.trim();
            const order = row.querySelector('[data-prop="order"]')?.value || '';
            if (column && alias) {
                rows.push({ column, func, alias, order });
            }
        });
        return rows;
    }

    /**
     * Extracts group-by column definitions from the Builder UI.
     * @returns {Array<{column: string, alias: string, dategrouping: string}>}
     * @private
     */
    _extractGroupByRows() {
        const rows = [];
        this.ui.groupByContainer?.querySelectorAll('.pdt-groupby-row').forEach(row => {
            const column = row.querySelector('[data-prop="column"]')?.value?.trim();
            const alias = row.querySelector('[data-prop="alias"]')?.value?.trim();
            const dategrouping = row.querySelector('[data-prop="dategrouping"]')?.value;
            if (column && alias) {
                rows.push({ column, alias, dategrouping });
            }
        });
        return rows;
    }

    /**
     * Builds FetchXML attribute elements for aggregate columns.
     * @param {Array<{column: string, func: string, alias: string}>} aggregateRows
     * @returns {string}
     * @private
     */
    _buildAggregateAttributesXml(aggregateRows) {
        return aggregateRows
            .map(row => `    <attribute name="${row.column}" alias="${row.alias}" aggregate="${row.func}" />`)
            .join('\n');
    }

    /**
     * Builds FetchXML attribute elements for group-by columns.
     * @param {Array<{column: string, alias: string, dategrouping: string}>} groupByRows
     * @returns {string}
     * @private
     */
    _buildGroupByAttributesXml(groupByRows) {
        return groupByRows
            .map(row => {
                let xml = `    <attribute name="${row.column}" alias="${row.alias}" groupby="true"`;
                if (row.dategrouping) {
                    xml += ` dategrouping="${row.dategrouping}"`;
                }
                xml += ' />';
                return xml;
            })
            .join('\n');
    }

    /**
     * Validates aggregate/group-by rows before generating XML.
     * @returns {boolean} True if valid, false if validation errors
     * @private
     */
    _validateAggregateRows() {
        const aggregateRows = this.ui.aggregatesContainer?.querySelectorAll('.pdt-aggregate-row') || [];
        const groupByRows = this.ui.groupByContainer?.querySelectorAll('.pdt-groupby-row') || [];

        for (const row of aggregateRows) {
            const column = row.querySelector('[data-prop="column"]')?.value?.trim();
            const alias = row.querySelector('[data-prop="alias"]')?.value?.trim();
            if (!column) {
                NotificationService.show(Config.MESSAGES.FETCHXML.aggregateColumnRequired, 'warning');
                return false;
            }
            if (!alias) {
                NotificationService.show(Config.MESSAGES.FETCHXML.aggregateAliasRequired, 'warning');
                return false;
            }
        }

        for (const row of groupByRows) {
            const alias = row.querySelector('[data-prop="alias"]')?.value?.trim();
            if (!alias) {
                NotificationService.show(Config.MESSAGES.FETCHXML.groupByAliasRequired, 'warning');
                return false;
            }
        }

        return true;
    }

    /**
     * Constructs a FetchXML string by collecting and assembling all values from the
     * Builder UI inputs (table, columns, filters, order, and joins). It then switches
     * to the XML Editor view to display the result.
     * @private
     */
    async _buildFetchXmlFromInputs() {
        const logicalEntityName = await this._resolveAndValidateEntity();
        if (!logicalEntityName) {
            return;
        }

        const isAggregate = this._isAggregateMode();

        // Validate aggregate rows if in aggregate mode
        if (isAggregate && !this._validateAggregateRows()) {
            return;
        }

        const topCount = this.ui.builderContent.querySelector('#builder-top-count').value;
        const aggregateAttr = isAggregate ? ' aggregate="true"' : '';
        const fetchTag = `<fetch${aggregateAttr}${topCount ? ` top="${topCount}"` : ''}>`;

        let primaryAttributesXml;
        if (isAggregate) {
            const aggregateRows = this._extractAggregateRows();
            const groupByRows = this._extractGroupByRows();
            const aggXml = this._buildAggregateAttributesXml(aggregateRows);
            const grpXml = this._buildGroupByAttributesXml(groupByRows);
            primaryAttributesXml = [aggXml, grpXml].filter(Boolean).join('\n');
        } else {
            primaryAttributesXml = this._buildAttributesXml(this.ui.builderContent.querySelector('#builder-attributes').value);
        }

        const filterXml = this._buildPrimaryFilterXml();
        const orderXml = isAggregate ? this._buildAggregateOrderXml() : this._buildOrderXml();
        const linkEntitiesXml = this._buildNestedJoins('primary');

        const xml = this._assembleFetchXml(fetchTag, logicalEntityName, primaryAttributesXml, orderXml, filterXml, linkEntitiesXml);

        this.ui.xmlArea.value = xml;
        this._formatXml();
        this._switchBuilderView('editor');
        NotificationService.show(Config.MESSAGES.FETCHXML.generated, 'success');
    }

    /**
     * Resolves and validates the primary entity name.
     * @returns {Promise<string|null>} Logical entity name or null if invalid
     * @private
     */
    async _resolveAndValidateEntity() {
        const primaryEntity = this.ui.builderContent.querySelector('#builder-entity').value.trim();
        if (!primaryEntity) {
            NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
            return null;
        }

        let logicalEntityName = primaryEntity;
        try {
            const { logicalName } = await EntityContextResolver.resolve(primaryEntity);
            logicalEntityName = logicalName;

            if (primaryEntity !== logicalName) {
                this.ui.builderContent.querySelector('#builder-entity').value = logicalName;
            }
        } catch (error) {
            NotificationService.show(Config.MESSAGES.FETCHXML.resolveEntityFailed(error.message), 'warning');
        }

        return logicalEntityName;
    }

    /**
     * Converts attribute text to FetchXML attribute elements.
     * @param {string} rawText - Newline-separated attribute names
     * @returns {string} FetchXML attribute elements
     * @private
     */
    _buildAttributesXml(rawText) {
        return rawText
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean)
            .map(attr => `    <attribute name="${attr}" />`)
            .join('\n');
    }

    /**
     * Builds filter XML for primary entity from filter groups.
     * @returns {string} FetchXML filter element(s)
     * @private
     */
    _buildPrimaryFilterXml() {
        const filtersContainer = this.ui.builderContent.querySelector('#builder-filters-container');
        const filterGroups = this.primaryFilterManager.extractFilterGroups(filtersContainer);

        if (filterGroups.length === 0) {
            return '';
        }

        const groupFilters = this._buildFilterGroupsXml(filterGroups, '      ');

        if (groupFilters.length === 0) {
            return '';
        }

        if (groupFilters.length === 1) {
            return `    ${groupFilters[0].xml.trim()}\n`;
        }

        return this._combineFilterGroups(groupFilters, '    ');
    }

    /**
     * Builds filter group XML from filter group data.
     * @param {Array} filterGroups - Filter group objects
     * @param {string} indentStr - Indentation string for conditions
     * @returns {Array<{xml: string, interGroupOperator: string}>} Filter group XML objects
     * @private
     */
    _buildFilterGroupsXml(filterGroups, indentStr) {
        return filterGroups.map(group => {
            const conditions = group.filters.map(f => {
                const { attr, op, value } = f;
                if (op === 'null' || op === 'not-null') {
                    return `${indentStr}  <condition attribute="${attr}" operator="${op}" />`;
                }
                if (value) {
                    return `${indentStr}  <condition attribute="${attr}" operator="${op}" value="${value}" />`;
                }
                return null;
            }).filter(Boolean);

            if (conditions.length > 0) {
                return {
                    xml: `${indentStr}<filter type="${group.filterType}">\n${conditions.join('\n')}\n${indentStr}</filter>`,
                    interGroupOperator: group.interGroupOperator
                };
            }
            return null;
        }).filter(Boolean);
    }

    /**
     * Combines multiple filter groups using inter-group operators.
     * @param {Array<{xml: string, interGroupOperator: string}>} groupFilters - Filter group XML objects
     * @param {string} indent - Base indentation
     * @returns {string} Combined filter XML
     * @private
     */
    _combineFilterGroups(groupFilters, indent) {
        const containerType = groupFilters[1].interGroupOperator || 'and';
        const allSameOperator = groupFilters.slice(1).every(g =>
            (g.interGroupOperator || 'and') === containerType
        );

        if (allSameOperator) {
            return `${indent}<filter type="${containerType}">\n${groupFilters.map(g => g.xml).join('\n')}\n${indent}</filter>\n`;
        }
        return `${indent}<filter type="and">\n${groupFilters.map(g => g.xml).join('\n')}\n${indent}</filter>\n`;
    }

    /**
     * Builds order XML from order inputs.
     * @returns {string} FetchXML order element
     * @private
     */
    _buildOrderXml() {
        const orderAttribute = this.ui.builderContent.querySelector('#builder-order-attribute').value.trim();
        if (!orderAttribute) {
            return '';
        }
        const isDescending = this.ui.builderContent.querySelector('#builder-order-direction').value === 'true';
        return `    <order attribute="${orderAttribute}" descending="${isDescending}" />\n`;
    }

    /**
     * Builds order XML for aggregate queries.
     * Uses per-row order dropdowns from aggregate rows, plus the global order (by alias) as fallback.
     * @returns {string} FetchXML order elements with alias
     * @private
     */
    _buildAggregateOrderXml() {
        let orderXml = '';

        // Gather per-row orders from aggregate rows
        const aggregateRows = this._extractAggregateRows();
        for (const row of aggregateRows) {
            if (row.order !== '') {
                orderXml += `    <order alias="${row.alias}" descending="${row.order}" />\n`;
            }
        }

        // Also check the global order input (used as alias in aggregate mode)
        const orderAttribute = this.ui.builderContent.querySelector('#builder-order-attribute').value.trim();
        if (orderAttribute) {
            const isDescending = this.ui.builderContent.querySelector('#builder-order-direction').value === 'true';
            orderXml += `    <order alias="${orderAttribute}" descending="${isDescending}" />\n`;
        }

        return orderXml;
    }

    /**
     * Builds nested link-entity XML structure recursively.
     * @param {string} parentId - Parent join ID or 'primary'
     * @param {number} indent - Indentation level (spaces)
     * @returns {string} FetchXML link-entity elements
     * @private
     */
    _buildNestedJoins(parentId, indent = 4) {
        let xml = '';
        const indentStr = ' '.repeat(indent);

        this.ui.joinsContainer.querySelectorAll('.link-entity-group').forEach(group => {
            const parent = group.querySelector('[data-prop="parent"]')?.value;
            if (parent !== parentId) {
                return;
            }

            const joinData = this._extractJoinData(group);
            if (!joinData) {
                return;
            }

            xml += this._buildLinkEntityXml(joinData, group, indentStr, indent);
        });

        return xml;
    }

    /**
     * Extracts join data from join group element.
     * @param {HTMLElement} group - Join group element
     * @returns {{name: string, from: string, to: string, linkType: string, alias: string, joinId: string, attributesValue: string}|null}
     * @private
     */
    _extractJoinData(group) {
        const name = group.querySelector('[data-prop="name"]')?.value?.trim();
        const from = group.querySelector('[data-prop="from"]')?.value?.trim();
        const to = group.querySelector('[data-prop="to"]')?.value?.trim();
        const linkType = group.querySelector('[data-prop="link-type"]')?.value;
        const alias = group.querySelector('[data-prop="alias"]')?.value?.trim();
        const joinId = group.dataset.joinId;
        const attributesValue = group.querySelector('[data-prop="attributes"]')?.value || '';

        if (!name || !from || !to) {
            return null;
        }

        return { name, from, to, linkType, alias, joinId, attributesValue };
    }

    /**
     * Builds link-entity XML for a single join.
     * @param {Object} joinData - Join data object
     * @param {HTMLElement} group - Join group element
     * @param {string} indentStr - Indentation string
     * @param {number} indent - Indentation level
     * @returns {string} FetchXML link-entity element
     * @private
     */
    _buildLinkEntityXml(joinData, group, indentStr, indent) {
        const { name, from, to, linkType, alias, joinId, attributesValue } = joinData;

        let xml = `${indentStr}<link-entity name="${name}" from="${from}" to="${to}" link-type="${linkType}" alias="${alias}">\n`;

        const attributesXml = this._buildAttributesXml(attributesValue);
        if (attributesXml) {
            xml += attributesXml.split('\n').map(line => line ? `  ${indentStr}${line}` : '').join('\n') + '\n';
        } else {
            xml += `${indentStr}  <all-attributes />\n`;
        }

        const joinFilterXml = this._buildJoinFilterXml(group, joinId, indentStr);
        if (joinFilterXml) {
            xml += joinFilterXml;
        }

        const nestedJoins = this._buildNestedJoins(joinId, indent + 4);
        if (nestedJoins) {
            xml += nestedJoins;
        }

        xml += `${indentStr}</link-entity>\n`;
        return xml;
    }

    /**
     * Builds filter XML for a specific join.
     * @param {HTMLElement} group - Join group element
     * @param {string} joinId - Join identifier
     * @param {string} indentStr - Indentation string
     * @returns {string} FetchXML filter elements
     * @private
     */
    _buildJoinFilterXml(group, joinId, indentStr) {
        const filterGroupsContainer = group.querySelector('.join-filter-groups-container');
        const joinIdNum = parseInt(joinId.split('_')[1]);
        const manager = this.joinFilterManagers.get(joinIdNum);

        if (!manager || !filterGroupsContainer) {
            return '';
        }

        const filterGroups = manager.extractFilterGroups(filterGroupsContainer);
        if (filterGroups.length === 0) {
            return '';
        }

        const groupFilters = this._buildFilterGroupsXml(filterGroups, indentStr + '    ');
        if (groupFilters.length === 0) {
            return '';
        }

        if (groupFilters.length === 1) {
            return `${indentStr}  ${groupFilters[0].xml.trim()}\n`;
        }

        return this._combineFilterGroups(groupFilters, `${indentStr}  `);
    }

    /**
     * Assembles the final FetchXML string from all parts.
     * @param {string} fetchTag - Opening fetch tag
     * @param {string} logicalEntityName - Entity logical name
     * @param {string} primaryAttributesXml - Primary entity attributes
     * @param {string} orderXml - Order element
     * @param {string} filterXml - Filter elements
     * @param {string} linkEntitiesXml - Link-entity elements
     * @returns {string} Complete FetchXML
     * @private
     */
    _assembleFetchXml(fetchTag, logicalEntityName, primaryAttributesXml, orderXml, filterXml, linkEntitiesXml) {
        let xml = `${fetchTag}\n  <entity name="${logicalEntityName}">\n`;
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
        return xml;
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
     * Converts the current FetchXML to the selected output format.
     * @param {string} format - The target format id
     * @private
     */
    _handleConvert(format) {
        const fetchXml = this.ui.xmlArea?.value?.trim();
        if (!fetchXml) {
            NotificationService.show(Config.MESSAGES.FETCHXML.convertNoXml, 'warning');
            return;
        }

        try {
            const orgUrl = PowerAppsApiService.getGlobalContext()?.getClientUrl?.() || '';
            const output = FetchXmlConverterService.convert(fetchXml, format, { orgUrl });
            if (this.ui.converterOutput) {
                this.ui.converterOutput.value = output;
            }
            if (this.ui.converterCopyBtn) {
                this.ui.converterCopyBtn.hidden = false;
            }
        } catch (error) {
            NotificationService.show(Config.MESSAGES.FETCHXML.convertFailed(error.message), 'error');
        }
    }

    /**
     * Copies the converter output to the clipboard.
     * @private
     */
    _handleCopyConverted() {
        const text = this.ui.converterOutput?.value;
        if (text) {
            copyToClipboard(text, Config.MESSAGES.FETCHXML.convertCopied);
        }
    }

    /**
     * Opens the converter panel and hides the toggle button.
     * @private
     */
    _toggleConverterPanel() {
        const panel = this.ui.converterPanel;
        const btn = this.ui.converterToggleBtn;
        if (!panel) {
            return;
        }

        panel.style.display = '';
        if (btn) {
            btn.style.display = 'none';
        }
    }

    /**
     * Closes the converter panel, resets its state, and shows the toggle button again.
     * @private
     */
    _closeConverterPanel() {
        const panel = this.ui.converterPanel;
        const btn = this.ui.converterToggleBtn;
        if (!panel) {
            return;
        }

        panel.style.display = 'none';
        if (btn) {
            btn.style.display = '';
        }

        // Reset converter state
        if (this.ui.converterOutput) {
            this.ui.converterOutput.value = '';
        }
        if (this.ui.converterCopyBtn) {
            this.ui.converterCopyBtn.hidden = true;
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
        const entityNameFromXml = entityMatch[1];

        this._removePaginationBanner();
        if (this.resultPanel) {
            this.resultPanel._selectedIndices?.clear();
        }

        if (this.ui.executeBtn) {
            this.ui.executeBtn.disabled = true;
            if (this.ui.resultRoot) {
                BusyIndicator.set(this.ui.executeBtn, this.ui.resultRoot, Config.MESSAGES.WEB_API.executing);
            }
        }

        try {
            const { logicalName } = await EntityContextResolver.resolve(entityNameFromXml);

            let correctedFetchXml = fetchXml;
            if (entityNameFromXml !== logicalName) {
                correctedFetchXml = fetchXml.replace(
                    new RegExp(`<entity\\s+name=["']${entityNameFromXml}["']`, 'i'),
                    `<entity name="${logicalName}"`
                );
                this.ui.xmlArea.value = correctedFetchXml;
            }

            const res = await DataService.executeFetchXml(logicalName, correctedFetchXml);

            this.pagingCookie = res.pagingCookie || null;
            this.currentPage = 1;
            this.allLoadedRecords = res.entities || [];
            this.lastExecutedFetchXml = correctedFetchXml;
            this.lastEntityName = logicalName;

            this.lastResult = normalizeApiResponse(res);
            this.resultSortState = { column: null, direction: 'asc' };

            // Disable selection for aggregate queries (results are not real records)
            const isAggregate = /<fetch[^>]+aggregate\s*=\s*["']true["']/i.test(correctedFetchXml);
            if (this.resultPanel) {
                this.resultPanel.enableSelection = !isAggregate;
                this.resultPanel.currentPage = 1;
            }

            if (this.ui.resultRoot.style.display === 'none') {
                this.ui.resultRoot.style.display = '';
            }

            this._displayResult();

            // Show pagination warning if more records available
            if (this.pagingCookie) {
                this._showPaginationBanner();
            }

            this.ui.resultRoot?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {
            const friendly = ErrorParser.extract(e);
            NotificationService.show(friendly, 'error');
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
     * Handles bulk touch operation for selected records from the ResultPanel.
     * @param {Array<Object>} records - Selected records to touch
     * @private
     */
    async _handleBulkTouch(records) {
        if (!records || records.length === 0) {
            NotificationService.show(Config.MESSAGES.FETCHXML.noRecordsSelected, 'warning');
            return;
        }

        try {
            const entityName = this.lastEntityName;
            if (!entityName) {
                NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
                return;
            }

            const { entitySet, logicalName } = await EntityContextResolver.resolve(entityName);
            const metadata = await PowerAppsApiService.getEntityMetadata(logicalName);
            const primaryKey = metadata.PrimaryIdAttribute;

            const touchConfig = await BulkTouchService.showTouchConfigDialog(logicalName, metadata);
            if (!touchConfig || touchConfig.length === 0) {
                NotificationService.show(Config.MESSAGES.FETCHXML.touchCancelled, 'info');
                return;
            }

            BusyIndicator.set(this.ui.executeBtn, this.ui.resultRoot,
                Config.MESSAGES.FETCHXML.touchProgress(0, records.length));

            const { allOperations, totalFailCount, allErrors } =
                BulkTouchService.prepareTouchOperations(records, primaryKey, touchConfig, entitySet);

            const { successCount, failCount, errors } = await BulkTouchService.executeBatchOperations(
                allOperations,
                (processed, total) => {
                    BusyIndicator.set(this.ui.executeBtn, this.ui.resultRoot,
                        Config.MESSAGES.FETCHXML.touchProgress(processed, total));
                }
            );

            const finalSuccessCount = successCount;
            const finalFailCount = totalFailCount + failCount;
            const finalErrors = [...allErrors, ...errors];

            if (finalFailCount === 0) {
                NotificationService.show(Config.MESSAGES.FETCHXML.touchSuccess(finalSuccessCount), 'success');
            } else {
                NotificationService.show(
                    Config.MESSAGES.FETCHXML.touchFailed(finalSuccessCount, finalFailCount, records.length),
                    'warning'
                );
                for (const err of finalErrors) {
                    NotificationService.show(err.error || String(err), 'error');
                }
            }

            // Re-execute query to refresh results
            if (this.lastExecutedFetchXml && this.ui.xmlArea) {
                this.ui.xmlArea.value = this.lastExecutedFetchXml;
                await this._executeQuery();
            }
        } catch (error) {
            NotificationService.show(ErrorParser.extract(error), 'error');
        } finally {
            BusyIndicator.clear(this.ui.executeBtn);
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

        // Update entity context for "Open Record" links
        this.resultPanel.entityLogicalName = this.lastEntityName || '';
        this.resultPanel.tableName = this.ui.builderEntityInput?.value || '';

        this.resultPanel.renderShell(entities.length, this.currentView, this.hideOdata);
        this.resultPanel.renderContent({
            data: entities || [],
            view: this.currentView,
            hideOdata: this.hideOdata
        });

        if (this.pagingCookie && entities.length > 0) {
            this._showPaginationBanner();
        } else {
            this._removePaginationBanner();
        }
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
     * Shows a banner with pagination information and Load More/Load All buttons.
     * @private
     */
    _showPaginationBanner() {
        if (!this.resultPanel) {
            return;
        }

        const banner = document.createElement('div');
        banner.id = 'fetchxml-pagination-banner';
        banner.className = 'pdt-note pdt-warn pdt-pagination-banner';

        const message = document.createElement('div');
        message.className = 'pdt-pagination-banner-message';
        message.innerHTML = `
            <strong>${Config.MESSAGES.FETCHXML.bannerTitle}</strong><br>
            <span>${Config.MESSAGES.FETCHXML.paginationWarning(this.allLoadedRecords.length.toLocaleString())}</span>
        `;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'pdt-pagination-banner-buttons';

        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'fetchxml-load-more-btn';
        loadMoreBtn.className = 'modern-button secondary';
        loadMoreBtn.textContent = Config.PAGINATION.buttons.loadMore;
        loadMoreBtn.onclick = () => this._loadMoreRecords();

        const loadAllBtn = document.createElement('button');
        loadAllBtn.id = 'fetchxml-load-all-btn';
        loadAllBtn.className = 'modern-button';
        loadAllBtn.textContent = Config.PAGINATION.buttons.loadAll;
        loadAllBtn.onclick = () => this._loadAllRecords();

        buttonContainer.appendChild(loadMoreBtn);
        buttonContainer.appendChild(loadAllBtn);
        banner.appendChild(message);
        banner.appendChild(buttonContainer);

        this.resultPanel.showBanner(banner);
    }

    /**
     * Removes the pagination banner.
     * @private
     */
    _removePaginationBanner() {
        if (this.resultPanel) {
            this.resultPanel.removeBanner();
        }
    }

    /**
     * Loads the next page of records using paging cookie.
     * @private
     */
    async _loadMoreRecords() {
        if (!this.pagingCookie || this.isLoadingMore) {
            return;
        }

        const loadMoreBtn = document.getElementById('fetchxml-load-more-btn');
        const loadAllBtn = document.getElementById('fetchxml-load-all-btn');

        try {
            this.isLoadingMore = true;
            if (loadMoreBtn) {
                loadMoreBtn.disabled = true;
                loadMoreBtn.textContent = Config.PAGINATION.buttons.loading;
            }
            if (loadAllBtn) {
                loadAllBtn.disabled = true;
            }

            const fetchXmlWithPaging = this._injectPagingCookie(this.lastExecutedFetchXml, this.pagingCookie, this.currentPage + 1);

            const res = await DataService.executeFetchXml(this.lastEntityName, fetchXmlWithPaging);

            this.allLoadedRecords = this.allLoadedRecords.concat(res.entities || []);
            this.pagingCookie = res.pagingCookie || null;
            this.currentPage++;

            this.lastResult = { entities: this.allLoadedRecords };
            this._displayResult();

            if (this.pagingCookie) {
                this._showPaginationBanner();
            } else {
                this._removePaginationBanner();
                NotificationService.show(Config.MESSAGES.FETCHXML.allRecordsLoaded(this.allLoadedRecords.length.toLocaleString()), 'success');
            }
        } catch (error) {
            const friendly = ErrorParser.extract(error);
            NotificationService.show(friendly, 'error');
        } finally {
            this.isLoadingMore = false;
            if (loadMoreBtn) {
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = Config.PAGINATION.buttons.loadMore;
            }
            if (loadAllBtn) {
                loadAllBtn.disabled = false;
            }
        }
    }

    /**
     * Loads all remaining pages of records.
     * @private
     */
    async _loadAllRecords() {
        if (!this.pagingCookie || this.isLoadingMore) {
            return;
        }

        const loadMoreBtn = document.getElementById('fetchxml-load-more-btn');
        const loadAllBtn = document.getElementById('fetchxml-load-all-btn');

        try {
            this.isLoadingMore = true;
            if (loadMoreBtn) {
                loadMoreBtn.disabled = true;
            }
            if (loadAllBtn) {
                loadAllBtn.disabled = true;
                loadAllBtn.textContent = Config.PAGINATION.buttons.loadingAll;
            }

            let pagesLoaded = 0;

            while (this.pagingCookie) {
                pagesLoaded++;
                this.currentPage++;

                if (this.resultPanel) {
                    this.resultPanel.updateBanner(`
                        <strong>${Config.MESSAGES.FETCHXML.bannerLoadingTitle}</strong><br>
                        <span>${Config.MESSAGES.FETCHXML.loadingAllRecords(this.allLoadedRecords.length.toLocaleString(), pagesLoaded)}</span>
                    `);
                }

                const fetchXmlWithPaging = this._injectPagingCookie(this.lastExecutedFetchXml, this.pagingCookie, this.currentPage);

                const res = await DataService.executeFetchXml(this.lastEntityName, fetchXmlWithPaging);

                this.allLoadedRecords = this.allLoadedRecords.concat(res.entities || []);
                this.pagingCookie = res.pagingCookie || null;

                if (pagesLoaded % Config.PAGINATION.progressUpdateInterval === 0) {
                    this.lastResult = { entities: this.allLoadedRecords };

                    if (this.resultPanel) {
                        this.resultPanel.entityLogicalName = this.lastEntityName || '';
                        const entities = this.lastResult.entities || [];
                        this.resultPanel.renderContent({
                            data: entities,
                            view: this.currentView,
                            hideOdata: this.hideOdata
                        });
                    }
                }
            }

            this.pagingCookie = null;
            this._removePaginationBanner();

            this.lastResult = { entities: this.allLoadedRecords };
            this._displayResult();

            NotificationService.show(
                Config.MESSAGES.FETCHXML.loadAllSuccess(this.allLoadedRecords.length.toLocaleString(), pagesLoaded + 1),
                'success'
            );
        } catch (error) {
            const friendly = ErrorParser.extract(error);
            NotificationService.show(friendly, 'error');
        } finally {
            this.isLoadingMore = false;
            if (loadMoreBtn) {
                loadMoreBtn.disabled = false;
            }
            if (loadAllBtn) {
                loadAllBtn.disabled = false;
                loadAllBtn.textContent = Config.PAGINATION.buttons.loadAll;
            }
        }
    }

    /**
     * Injects paging cookie into FetchXML query.
     * @private
     * @param {string} fetchXml - Original FetchXML
     * @param {string} pagingCookie - Paging cookie from API (URL-encoded XML string like "<cookie ... />")
     * @param {number} pageNumber - Page number to fetch
     * @returns {string} FetchXML with paging attributes
     */
    _injectPagingCookie(fetchXml, pagingCookie, pageNumber) {
        // The paging cookie from the API is a complete XML string
        // Example: "<cookie pagenumber=\"2\" pagingcookie=\"%253ccookie%2520...\" istracking=\"False\" />"
        // We need to extract the pagingcookie attribute value and fully decode it to plain XML.
        const pagingCookieMatch = pagingCookie.match(/pagingcookie=["']([^"']+)["']/i);
        let cookieValue = pagingCookieMatch ? pagingCookieMatch[1] : '';

        if (!cookieValue) {
            return fetchXml.replace(
                /<fetch(\s|>)/i,
                `<fetch page="${pageNumber}"$1`
            );
        }

        let previousValue;
        let decodeAttempts = 0;
        try {
            while (cookieValue !== previousValue && decodeAttempts < Config.DATAVERSE_PAGINATION.MAX_DECODE_ATTEMPTS) {
                previousValue = cookieValue;
                cookieValue = decodeURIComponent(cookieValue);
                decodeAttempts++;
            }
        } catch (_) {
            cookieValue = previousValue || cookieValue;
        }

        const escapedCookie = cookieValue
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

        let modifiedFetchXml = fetchXml.replace(/\s+page=["'][^"']*["']/gi, '');
        modifiedFetchXml = modifiedFetchXml.replace(/\s+paging-cookie=["'][^"']*["']/gi, '');
        modifiedFetchXml = modifiedFetchXml.replace(
            /<fetch(\s|>)/i,
            `<fetch page="${pageNumber}" paging-cookie="${escapedCookie}"$1`
        );

        return modifiedFetchXml;
    }

    /**
     * Clears results and resets the ResultPanel.
     */
    clearResults() {
        this.lastResult = normalizeApiResponse(null);
        this.resultSortState = { column: null, direction: 'asc' };
        this.pagingCookie = null;
        this.currentPage = 1;
        this.allLoadedRecords = [];
        this._removePaginationBanner();

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
            },
            onBulkTouch: (records) => this._handleBulkTouch(records),
            enableSelection: true,
            tableName: this.ui.builderEntityInput?.value || ''
        });
        this.resultPanel.renderShell(0, this.currentView, this.hideOdata);
        this.resultPanel.renderContent({ data: [], view: this.currentView, hideOdata: this.hideOdata });
    }

    /**
     * Lifecycle hook for cleaning up event listeners to prevent memory leaks.
     */
    destroy() {
        if (this._rootElement && this._handleDelegatedClickBound) {
            this._rootElement.removeEventListener('click', this._handleDelegatedClickBound);
            this._handleDelegatedClickBound = null;
        }

        if (this._rootElement && this._handleRootKeydown) {
            this._rootElement.removeEventListener('keydown', this._handleRootKeydown);
            this._handleRootKeydown = null;
        }

        try {
            if (this._onToolRefresh) {
                document.removeEventListener('pdt:tool-refresh', this._onToolRefresh);
                this._onToolRefresh = null;
            }
            if (this._onRefresh) {
                document.removeEventListener('pdt:refresh', this._onRefresh);
                this._onRefresh = null;
            }
        } catch {
            // Ignore errors during event listener cleanup
        }

        if (this.ui.templateSelect && this._templateSelectHandler) {
            this.ui.templateSelect.removeEventListener('change', this._templateSelectHandler);
            this._templateSelectHandler = null;
        }

        if (this._handleDocumentClick) {
            document.removeEventListener('click', this._handleDocumentClick);
            this._handleDocumentClick = null;
        }

        for (const [element, { event, handler }] of this._dynamicHandlers.entries()) {
            element.removeEventListener(event, handler);
        }
        this._dynamicHandlers.clear();

        try {
            this.resultPanel?.dispose?.();
        } catch {
            // Ignore errors during disposal
        }

        this.resultPanel = null;
        this._rootElement = null;
    }
}
