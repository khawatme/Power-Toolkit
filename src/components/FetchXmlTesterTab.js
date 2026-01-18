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
import { formatXml, normalizeApiResponse, showColumnBrowser } from '../helpers/index.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
import { MetadataBrowserDialog } from '../ui/MetadataBrowserDialog.js';
import { ResultPanel } from '../utils/ui/ResultPanel.js';
import { BusyIndicator } from '../utils/ui/BusyIndicator.js';
import { ErrorParser } from '../utils/parsers/ErrorParser.js';
import { SmartValueInput } from '../ui/SmartValueInput.js';
import { PreferencesHelper } from '../utils/ui/PreferencesHelper.js';
import { EntityContextResolver } from '../utils/resolvers/EntityContextResolver.js';
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
                    <div class="pdt-section-header mt-15">Filter</div>
                    <div id="builder-filters-container" class="pdt-builder-group"></div>
                    <div class="pdt-toolbar mt-10">
                        <button id="fetch-add-filter-group-btn" class="modern-button secondary">Add Filter Group</button>
                    </div>
                    <div class="pdt-section-header mt-15">Joins (link-entity)</div>
                    <div id="builder-joins-container" class="pdt-builder-group"></div>
                    <div class="pdt-toolbar mt-20">
                        <button id="fetch-add-join-btn" class="modern-button secondary">Add Join</button>
                        <button id="fetch-build-btn" class="modern-button ml-auto pdt-accent-button">Generate XML</button>
                    </div>
                </div>
                <div id="fetch-editor-content" style="display:none;">
                    <div class="pdt-toolbar">
                        <select id="fetch-template-select" class="pdt-select flex-grow"></select>
                    </div>
                    <textarea id="fetch-xml-area" class="pdt-textarea" rows="10" spellcheck="false" placeholder="<fetch>...</fetch>"></textarea>
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
            tableName: this.ui.builderEntityInput?.value || ''
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
    _handleDelegatedClick(e) {
        const target = e.target.closest('button, th[data-column]');
        if (!target) {
            return;
        }

        const id = target.id;
        const classList = target.classList;

        // Browse button handlers
        if (id === 'browse-builder-entity-btn') {
            this._handleBrowseEntity();
        } else if (id === 'browse-builder-attributes-btn') {
            this._handleBrowseAttributes();
        } else if (id === 'browse-builder-order-btn') {
            this._handleBrowseOrder();
        } else if (classList.contains('browse-condition-attr')) {
            this._handleBrowseConditionAttribute(target);
        } else if (classList.contains('browse-join-table')) {
            this._handleBrowseJoinTable(target);
        } else if (classList.contains('browse-join-from')) {
            this._handleBrowseJoinFrom(target);
        } else if (classList.contains('browse-join-to')) {
            this._handleBrowseJoinTo(target);
        } else if (classList.contains('browse-join-attrs')) {
            this._handleBrowseJoinAttributes(target);
        } else if (id === 'fetch-add-filter-group-btn') {
            this._handleAddFilterGroup();
        } else if (id === 'fetch-add-join-btn') {
            this._handleAddJoin();
        } else if (id === 'fetch-build-btn') {
            this._handleBuildXml();
        } else if (id === 'fetch-builder-tab') {
            this._switchBuilderView('builder');
        } else if (id === 'fetch-editor-tab') {
            this._switchBuilderView('editor');
        } else if (id === 'fetch-format-btn') {
            this._formatXml();
        } else if (id === 'fetch-execute-btn') {
            this._executeQuery();
        } else if (classList.contains('remove-join')) {
            this._handleRemoveJoin(target);
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

        const topCount = this.ui.builderContent.querySelector('#builder-top-count').value;
        const fetchTag = `<fetch${topCount ? ` top="${topCount}"` : ''}>`;

        const primaryAttributesXml = this._buildAttributesXml(this.ui.builderContent.querySelector('#builder-attributes').value);
        const filterXml = this._buildPrimaryFilterXml();
        const orderXml = this._buildOrderXml();
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

            if (this.resultPanel) {
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
