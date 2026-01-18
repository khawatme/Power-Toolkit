/**
 * @file Web API Explorer (classic UI aligned to FetchXmlTesterTab).
 * @module components/WebApiExplorerTab
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { Store } from '../core/Store.js';
import { ICONS } from '../assets/Icons.js';
import { DataService } from '../services/DataService.js';
import { NotificationService } from '../services/NotificationService.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
import { FileUploadService } from '../services/FileUploadService.js';
import { debounce, escapeHtml, formatODataValue, normalizeApiResponse, showConfirmDialog, showColumnBrowser } from '../helpers/index.js';
import { MetadataBrowserDialog } from '../ui/MetadataBrowserDialog.js';
import { FilterGroupManager } from '../ui/FilterGroupManager.js';
import { EntityContextResolver } from '../utils/resolvers/EntityContextResolver.js';
import { ODataQueryBuilder } from '../utils/builders/ODataQueryBuilder.js';
import { ResultPanel } from '../utils/ui/ResultPanel.js';
import { BusyIndicator } from '../utils/ui/BusyIndicator.js';
import { ErrorParser } from '../utils/parsers/ErrorParser.js';
import { SmartValueInput } from '../ui/SmartValueInput.js';
import { Config } from '../constants/index.js';
import { PreferencesHelper } from '../utils/ui/PreferencesHelper.js';
import { ValidationService } from '../services/ValidationService.js';

/** @typedef {'GET'|'POST'|'PATCH'|'DELETE'} HttpMethod */
/** @typedef {'table'|'json'} ResultView */

export class WebApiExplorerTab extends BaseComponent {
    /**
     * Create the Web API Explorer tab.
     */
    constructor() {
        super('apiExplorer', 'WebAPI Explorer', ICONS.api);

        /** @private @type {{entities?: any[], value?: any[]} | any | null} */
        this.lastResult = null;
        /** @private @type {ResultView} */
        this.currentView = PreferencesHelper.load(Config.STORAGE_KEYS.webApiView, 'table');
        /** @private @type {boolean} */
        this.hideOdata = PreferencesHelper.load(Config.STORAGE_KEYS.webApiHideOdata, true, 'boolean');

        /** @private @type {Record<string, HTMLElement|null>} */
        this.ui = {};
        /** @private @type {string|null} */
        this.selectedEntityLogicalName = null;
        /** @private @type {Map<string, {type: string, targets?: string[]}> | null} */
        this.attrMap = null;
        /** @private @type {{column: string|null, direction: 'asc'|'desc'}} */
        this.resultSortState = { column: null, direction: 'asc' };
        /** @private @type {ResultPanel|null} */
        this.resultPanel = null;
        /** @private @type {string|null} */
        this.nextLink = null;
        /** @private @type {any[]} */
        this.allLoadedRecords = [];
        /** @private @type {boolean} */
        this.isLoadingMore = false;
        /** @private @type {string} */
        this._lastMethod = 'GET';

        /** @private {HTMLElement|null} */ this._rootElement = null;
        /** @private {Function|null} */ this._getEntityInputHandler = null;
        /** @private {Function|null} */ this._postPatchEntityInputHandler = null;
        /** @private {Function|null} */ this._postPatchEntityBlurHandler = null;
        /** @private {Function|null} */ this._deleteEntityInputHandler = null;
        /** @private {Function|null} */ this._rootKeydownHandler = null;
        /** @private {Function|null} */ this._methodSelectHandler = null;
        /** @private {Function|null} */ this._formatJsonHandler = null;
        /** @private {Function|null} */ this._pickEntityHandler = null;
        /** @private {Function|null} */ this._browseGetSelectHandler = null;
        /** @private {Function|null} */ this._browseGetOrderByHandler = null;
        /** @private {Function|null} */ this._addGetFilterGroupHandler = null;
        /** @private {Function|null} */ this._addPatchFilterGroupHandler = null;
        /** @private {Function|null} */ this._addDeleteFilterGroupHandler = null;
        /** @private {Function|null} */ this._getCountHandler = null;
        /** @private {Function|null} */ this._executeHandler = null;
        /** @private {Function|null} */ this._livePreviewRefreshHandler = null;
        /** @private {Function|null} */ this._externalRefreshHandler = null;
        /** @private {Function|null} */ this._patchIdInputHandler = null;
        /** @private {Function|null} */ this._deleteIdInputHandler = null;
        /** @private {Function|null} */ this._patchCopyFromGetHandler = null;
        /** @private {Function|null} */ this._deleteCopyFromGetHandler = null;

        /** @private @type {Map<HTMLElement, {event: string, handler: Function}>} */
        this._dynamicHandlers = new Map();

        /** @private @type {FilterGroupManager|null} */
        this.getFilterManager = null;
        /** @private @type {FilterGroupManager|null} */
        this.patchFilterManager = null;
        /** @private @type {FilterGroupManager|null} */
        this.deleteFilterManager = null;

        /** @private @type {Object.<string, {entity: string, recordId: string, fields: string, fieldsHtml: string, fieldValues: Array, filters: string, select: string, orderBy: string, top: string, expand: string}>} */
        this._methodState = {
            GET: { entity: '', recordId: '', fields: '', fieldsHtml: '', fieldValues: [], filters: '', select: '', orderBy: '', top: '', expand: '' },
            POST: { entity: '', recordId: '', fields: '', fieldsHtml: '', fieldValues: [], filters: '', select: '', orderBy: '', top: '', expand: '' },
            PATCH: { entity: '', recordId: '', fields: '', fieldsHtml: '', fieldValues: [], filters: '', select: '', orderBy: '', top: '', expand: '' },
            DELETE: { entity: '', recordId: '', fields: '', fieldsHtml: '', fieldValues: [], filters: '', select: '', orderBy: '', top: '', expand: '' }
        };
    }

    /**
     * Render static structure (no results section yet).
     * Matches classic look and builder layout used in FetchXmlTesterTab.
     * @returns {HTMLElement}
     */
    render() {
        const el = document.createElement('div');
        el.className = 'pdt-api';

        el.innerHTML = `
            <div class="section-title">Web API Explorer</div>
            <div class="pdt-form-grid">
                <label for="api-method-select">Method</label>
                <select id="api-method-select" class="pdt-select">
                    <option value="GET">GET (Retrieve)</option>
                    <option value="POST">POST (Create)</option>
                    <option value="PATCH">PATCH (Update)</option>
                    <option value="DELETE">DELETE (Delete)</option>
                </select>
            </div>
            ${this._renderGetSection()}
            ${this._renderPostSection()}
            ${this._renderPatchSection()}
            ${this._renderDeleteSection()}
            ${this._renderToolbarSection()}
            <div id="api-result-root" style="display: none;"></div>
        `;
        return el;
    }

    /**
     * Render GET method section HTML.
     * @private
     * @returns {string} HTML string for GET section
     */
    _renderGetSection() {
        return `
            <div id="api-view-get">
                <div class="pdt-section-header">Request Builder</div>
                <div class="pdt-form-grid">
                    <label for="api-get-entity">Table Name</label>
                    <div class="pdt-input-with-button">
                        <input type="text" id="api-get-entity" class="pdt-input" placeholder="e.g., accounts">
                        <button id="browse-api-get-entity-btn" class="pdt-input-btn" title="Browse tables">${ICONS.metadata}</button>
                    </div>
                    <label for="api-get-select">Columns</label>
                    <div class="pdt-input-with-button">
                        <textarea id="api-get-select" class="pdt-textarea" rows="3" spellcheck="false" placeholder="name&#10;createdon"></textarea>
                        <button id="browse-api-get-select-btn" class="pdt-input-btn" title="Browse columns">${ICONS.inspector}</button>
                    </div>
                    <label for="api-get-top">Top Count</label>
                    <input type="number" id="api-get-top" class="pdt-input" placeholder="Leave empty for all records">
                    <label>Order</label>
                    <div id="api-get-orderby-container" class="pdt-builder-group">
                        <div class="pdt-order-grid">
                            <div class="pdt-input-with-button">
                                <input id="api-get-orderby-attribute" type="text" class="pdt-input" placeholder="Attribute e.g., createdon">
                                <button id="browse-api-get-orderby-btn" class="pdt-input-btn" title="Browse columns">${ICONS.inspector}</button>
                            </div>
                            <select id="api-get-orderby-dir" class="pdt-select">
                                <option value="asc" selected>Ascending</option>
                                <option value="desc">Descending</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="pdt-section-header mt-15">Filter</div>
                <div id="api-get-filters-container" class="pdt-builder-group"></div>
            </div>`;
    }

    /**
     * Render POST method section HTML.
     * @private
     * @returns {string} HTML string for POST section
     */
    _renderPostSection() {
        return `
            <div id="api-view-post" hidden>
                <div class="pdt-section-header">Request Builder</div>
                <div class="pdt-form-grid">
                    <label for="api-post-entity">Table Name</label>
                    <div class="pdt-input-with-button">
                        <input type="text" id="api-post-entity" class="pdt-input" placeholder="e.g., accounts">
                        <button id="browse-api-post-entity-btn" class="pdt-input-btn" title="Browse tables">${ICONS.metadata}</button>
                    </div>
                </div>
                ${this._renderFieldBuilderSection('post')}
            </div>`;
    }

    /**
     * Render PATCH method section HTML.
     * @private
     * @returns {string} HTML string for PATCH section
     */
    _renderPatchSection() {
        return `
            <div id="api-view-patch" hidden>
                <div class="pdt-section-header">
                    Request Builder
                    <button id="api-patch-copy-from-get" class="modern-button secondary pdt-copy-from-get-btn" title="Copy table and filters from GET">Copy from GET</button>
                </div>
                <div class="pdt-form-grid">
                    <label for="api-patch-entity">Table Name</label>
                    <div class="pdt-input-with-button">
                        <input type="text" id="api-patch-entity" class="pdt-input" placeholder="e.g., accounts">
                        <button id="browse-api-patch-entity-btn" class="pdt-input-btn" title="Browse tables">${ICONS.metadata}</button>
                    </div>
                    <label for="api-patch-id">Record ID</label>
                    <input type="text" id="api-patch-id" class="pdt-input" placeholder="${Config.COMMON_PLACEHOLDERS.guid} (leave empty for bulk update)">
                </div>
                ${this._renderFieldBuilderSection('patch')}
                <div id="api-patch-filter-section" hidden>
                    <div class="pdt-section-header mt-15">Bulk Update Filter (Optional)</div>
                    <p class="pdt-note">${Config.MESSAGES.WEB_API.bulkUpdateInfo}</p>
                    <div id="api-patch-filters-container" class="pdt-builder-group"></div>
                </div>
            </div>`;
    }

    /**
     * Render DELETE method section HTML.
     * @private
     * @returns {string} HTML string for DELETE section
     */
    _renderDeleteSection() {
        return `
            <div id="api-view-delete" hidden>
                <div class="pdt-section-header">
                    Request Builder
                    <button id="api-delete-copy-from-get" class="modern-button secondary pdt-copy-from-get-btn" title="Copy table and filters from GET">Copy from GET</button>
                </div>
                <div class="pdt-form-grid">
                    <label for="api-delete-entity">Table Name</label>
                    <div class="pdt-input-with-button mt-15">
                        <input type="text" id="api-delete-entity" class="pdt-input" placeholder="e.g., accounts">
                        <button id="browse-api-delete-entity-btn" class="pdt-input-btn" title="Browse tables">${ICONS.metadata}</button>
                    </div>
                    <label for="api-delete-id">Record ID</label>
                    <input type="text" id="api-delete-id" class="pdt-input" placeholder="${Config.COMMON_PLACEHOLDERS.guid} (leave empty for bulk delete)">
                </div>
                <div id="api-delete-filter-section" hidden>
                    <div class="pdt-section-header mt-15">Bulk Delete Filter (Optional)</div>
                    <p class="pdt-note">${Config.MESSAGES.WEB_API.bulkDeleteInfo}</p>
                    <div id="api-delete-filters-container" class="pdt-builder-group"></div>
                </div>
            </div>`;
    }

    /**
     * Render field builder section HTML for POST/PATCH methods.
     * @private
     * @param {string} prefix - Method prefix ('post' or 'patch')
     * @returns {string} HTML string for field builder section
     */
    _renderFieldBuilderSection(prefix) {
        return `
            <div class="pdt-section-header mt-15">Fields</div>
            <div class="pdt-form-grid">
                <label>Mode</label>
                <label class="pdt-switcher-toggle pdt-switcher-start">
                    <span class="pdt-toggle-switch">
                        <input type="checkbox" id="api-${prefix}-body-mode-toggle">
                        <span class="pdt-toggle-slider"></span>
                    </span>
                    <span id="api-${prefix}-body-mode-label">Field Builder</span>
                </label>
            </div>
            <div id="api-${prefix}-fields-builder" class="pdt-form-grid mt-15">
                <label>Field</label>
                <div id="api-${prefix}-fields-container" class="pdt-builder-group"></div>
                <label></label>
                <button id="api-${prefix}-add-field-btn" class="modern-button secondary">Add Field</button>
            </div>
            <div id="api-${prefix}-json-mode" class="pdt-form-grid mt-15" hidden>
                <label for="api-${prefix}-body">JSON Body</label>
                <textarea id="api-${prefix}-body" class="pdt-textarea" rows="10" spellcheck="false" placeholder='{"name": "Contoso"}'></textarea>
            </div>`;
    }

    /**
     * Render toolbar section HTML.
     * @private
     * @returns {string} HTML string for toolbar section
     */
    _renderToolbarSection() {
        return `
            <div class="pdt-toolbar mt-15">
                <button id="api-get-add-filter-group-btn" class="modern-button secondary">Add Filter Group</button>
                <button id="api-patch-add-filter-group-btn" class="modern-button secondary" hidden>Add Filter Group</button>
                <button id="api-delete-add-filter-group-btn" class="modern-button secondary" hidden>Add Filter Group</button>
                <div class="pdt-toolbar-group ml-auto">
                    <button id="api-get-count-btn" class="modern-button secondary">Get Count</button>
                    <button id="api-format-json-btn" class="modern-button secondary" hidden>Format JSON</button>
                    <button id="api-execute-btn" class="modern-button">Execute</button>
                </div>
            </div>
            <div id="api-preview" class="pdt-note mt-15"></div>`;
    }

    /**
     * Cache nodes, bind interactions, and initialize UI state.
     * @param {HTMLElement} root
     */
    postRender(root) {
        this._rootElement = root;

        this.ui = {
            methodSelect: root.querySelector('#api-method-select'),
            preview: root.querySelector('#api-preview'),
            resultRoot: root.querySelector('#api-result-root'),

            // GET
            getView: root.querySelector('#api-view-get'),
            getEntityInput: root.querySelector('#api-get-entity'),
            getSelectInput: root.querySelector('#api-get-select'),
            getTopInput: root.querySelector('#api-get-top'),
            getFiltersContainer: root.querySelector('#api-get-filters-container'),
            addGetFilterGroupBtn: root.querySelector('#api-get-add-filter-group-btn'),
            getOrderByAttrInput: root.querySelector('#api-get-orderby-attribute'),
            getOrderByDirSelect: root.querySelector('#api-get-orderby-dir'),
            browseGetEntityBtn: root.querySelector('#browse-api-get-entity-btn'),
            browseGetSelectBtn: root.querySelector('#browse-api-get-select-btn'),
            browseGetOrderByBtn: root.querySelector('#browse-api-get-orderby-btn'),

            // POST
            postView: root.querySelector('#api-view-post'),
            postEntityInput: root.querySelector('#api-post-entity'),
            postBodyArea: root.querySelector('#api-post-body'),
            browsePostEntityBtn: root.querySelector('#browse-api-post-entity-btn'),
            postBodyModeToggle: root.querySelector('#api-post-body-mode-toggle'),
            postBodyModeLabel: root.querySelector('#api-post-body-mode-label'),
            postFieldsBuilder: root.querySelector('#api-post-fields-builder'),
            postJsonMode: root.querySelector('#api-post-json-mode'),
            postFieldsContainer: root.querySelector('#api-post-fields-container'),
            postAddFieldBtn: root.querySelector('#api-post-add-field-btn'),

            // PATCH
            patchView: root.querySelector('#api-view-patch'),
            patchEntityInput: root.querySelector('#api-patch-entity'),
            patchIdInput: root.querySelector('#api-patch-id'),
            patchBodyArea: root.querySelector('#api-patch-body'),
            browsePatchEntityBtn: root.querySelector('#browse-api-patch-entity-btn'),
            patchFilterSection: root.querySelector('#api-patch-filter-section'),
            patchFiltersContainer: root.querySelector('#api-patch-filters-container'),
            addPatchFilterGroupBtn: root.querySelector('#api-patch-add-filter-group-btn'),
            patchBodyModeToggle: root.querySelector('#api-patch-body-mode-toggle'),
            patchBodyModeLabel: root.querySelector('#api-patch-body-mode-label'),
            patchFieldsBuilder: root.querySelector('#api-patch-fields-builder'),
            patchJsonMode: root.querySelector('#api-patch-json-mode'),
            patchFieldsContainer: root.querySelector('#api-patch-fields-container'),
            patchAddFieldBtn: root.querySelector('#api-patch-add-field-btn'),

            // DELETE
            deleteView: root.querySelector('#api-view-delete'),
            deleteEntityInput: root.querySelector('#api-delete-entity'),
            deleteIdInput: root.querySelector('#api-delete-id'),
            browseDeleteEntityBtn: root.querySelector('#browse-api-delete-entity-btn'),
            deleteFilterSection: root.querySelector('#api-delete-filter-section'),
            deleteFiltersContainer: root.querySelector('#api-delete-filters-container'),
            addDeleteFilterGroupBtn: root.querySelector('#api-delete-add-filter-group-btn'),

            // Copy from GET buttons
            patchCopyFromGetBtn: root.querySelector('#api-patch-copy-from-get'),
            deleteCopyFromGetBtn: root.querySelector('#api-delete-copy-from-get'),

            // Toolbar
            getCountBtn: root.querySelector('#api-get-count-btn'),
            formatJsonBtn: root.querySelector('#api-format-json-btn'),
            executeBtn: root.querySelector('#api-execute-btn')
        };

        this.resultPanel = new ResultPanel({
            root: this.ui.resultRoot,
            onToggleView: (v) => {
                this.currentView = v;
                PreferencesHelper.save(Config.STORAGE_KEYS.webApiView, v);
                this._displayResult();
            },
            onToggleHide: (h) => {
                this.hideOdata = h;
                PreferencesHelper.save(Config.STORAGE_KEYS.webApiHideOdata, h, 'boolean');
                this._displayResult();
            },
            getSortState: () => this.resultSortState,
            setSortState: (s) => {
                this.resultSortState = s;
            },
            onBulkTouch: (records) => this._handleBulkTouch(records),
            enableSelection: true,
            tableName: this.ui.getEntityInput?.value || ''
        });

        // Store handlers for cleanup
        this._getEntityInputHandler = () => {
            this.selectedEntityLogicalName = null;
            this.attrMap = null;
        };
        this._postEntityInputHandler = () => {
            this.selectedEntityLogicalName = null;
            this.attrMap = null;
        };
        this._patchEntityInputHandler = () => {
            this.selectedEntityLogicalName = null;
            this.attrMap = null;
        };
        this._deleteEntityNameInputHandler = () => {
            this.selectedEntityLogicalName = null;
            this.attrMap = null;
        };

        // Debounced handler for auto-populating required fields when POST table name changes
        this._postEntityBlurHandler = debounce(async () => {
            const tableName = this.ui.postEntityInput?.value?.trim();
            if (tableName) {
                try {
                    const { logicalName } = await EntityContextResolver.resolve(tableName);
                    await this._populateRequiredFields(logicalName);
                } catch (_e) {
                    // Table might not exist yet
                }
            }
        }, 500);
        this._rootKeydownHandler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                this.ui.executeBtn?.click();
                e.preventDefault();
            }
        };

        this.ui.getEntityInput?.addEventListener('input', this._getEntityInputHandler);
        this.ui.postEntityInput?.addEventListener('input', this._postEntityInputHandler);
        this.ui.postEntityInput?.addEventListener('blur', this._postEntityBlurHandler);
        this.ui.patchEntityInput?.addEventListener('input', this._patchEntityInputHandler);
        this.ui.deleteEntityInput?.addEventListener('input', this._deleteEntityNameInputHandler);
        root.addEventListener('keydown', this._rootKeydownHandler);

        // Handler for toggling bulk update filter based on Record ID
        this._patchIdInputHandler = () => this._toggleBulkFilterSection();
        this.ui.patchIdInput?.addEventListener('input', this._patchIdInputHandler);

        // Handler for toggling bulk delete filter based on Record ID
        this._deleteIdInputHandler = () => this._toggleBulkFilterSection();
        this.ui.deleteIdInput?.addEventListener('input', this._deleteIdInputHandler);

        // Bind interactions
        this._bindMethodSwitch();
        this._bindEntityBrowsers();
        this._bindConditionAdd();
        this._bindFieldBuilder();
        this._bindGetCount();
        this._bindExecute();
        this._bindPayloadHelpers();
        this._bindLivePreview();
        this._bindExternalRefresh();

        this._initializeFilterManagers();

        this._addFieldUI(true, 'POST');
        this._addFieldUI(true, 'PATCH');
        this._updateMethodView();
        this._updatePreview();
        this.resultPanel.renderShell(0, this.currentView, this.hideOdata);
    }

    /* ===========================
     * View / Result Shell
     * =========================== */

    /**
     * Initialize filter group managers for GET, PATCH, and DELETE contexts.
     * @private
     */
    _initializeFilterManagers() {
        // GET filter manager
        this.getFilterManager = new FilterGroupManager({
            handlers: this._dynamicHandlers,
            getEntityContext: async () => {
                const { logicalName } = await this._ensureEntityContext();
                return logicalName;
            },
            renderValueInput: async (attr, conditionGroup, getEntityContext) => {
                const entityName = await getEntityContext();
                await this._renderValueInput(conditionGroup, attr, entityName, 'filter');
            },
            getAttributeMetadata: async (attrName, entityName) => {
                const attributes = await DataService.getAttributeDefinitions(entityName);
                return attributes.find(attr => attr.LogicalName === attrName) || null;
            },
            showNotOperator: true,
            operatorFilter: 'odata',
            onUpdate: () => this._updatePreview()
        });

        // PATCH filter manager
        this.patchFilterManager = new FilterGroupManager({
            handlers: this._dynamicHandlers,
            getEntityContext: async () => {
                const { logicalName } = await this._ensureEntityContext(this.ui.patchEntityInput?.value);
                return logicalName;
            },
            renderValueInput: async (attr, conditionGroup, getEntityContext) => {
                const entityName = await getEntityContext();
                await this._renderValueInput(conditionGroup, attr, entityName, 'filter');
            },
            getAttributeMetadata: async (attrName, entityName) => {
                const attributes = await DataService.getAttributeDefinitions(entityName);
                return attributes.find(attr => attr.LogicalName === attrName) || null;
            },
            showNotOperator: true,
            operatorFilter: 'odata',
            onUpdate: () => this._updatePreview()
        });

        // DELETE filter manager
        this.deleteFilterManager = new FilterGroupManager({
            handlers: this._dynamicHandlers,
            getEntityContext: async () => {
                const { logicalName } = await this._ensureEntityContext(this.ui.deleteEntityInput?.value);
                return logicalName;
            },
            renderValueInput: async (attr, conditionGroup, getEntityContext) => {
                const entityName = await getEntityContext();
                await this._renderValueInput(conditionGroup, attr, entityName, 'filter');
            },
            getAttributeMetadata: async (attrName, entityName) => {
                const attributes = await DataService.getAttributeDefinitions(entityName);
                return attributes.find(attr => attr.LogicalName === attrName) || null;
            },
            showNotOperator: true,
            operatorFilter: 'odata',
            onUpdate: () => this._updatePreview()
        });
    }

    /** Switch method sections & toolbar buttons. */
    _updateMethodView() {
        /** @type {HttpMethod} */
        const method = this.ui.methodSelect.value;
        this._updateMethodSections(method);
        this._updateFilterSections(method);
        this._updateToolbarButtons(method);
        this._updateAddFilterButtons(method);
    }

    /**
     * Update visibility of method sections based on selected method.
     * @param {HttpMethod} method - The selected HTTP method
     * @private
     */
    _updateMethodSections(method) {
        this.ui.getView.hidden = method !== 'GET';
        this.ui.postView.hidden = method !== 'POST';
        this.ui.patchView.hidden = method !== 'PATCH';
        this.ui.deleteView.hidden = method !== 'DELETE';
    }

    /**
     * Update visibility of filter sections for PATCH and DELETE based on record ID.
     * @param {HttpMethod} method - The selected HTTP method
     * @private
     */
    _updateFilterSections(method) {
        if (this.ui.patchFilterSection) {
            const hasPatchId = this._hasRecordId(this.ui.patchIdInput);
            this.ui.patchFilterSection.hidden = method !== 'PATCH' || hasPatchId;
        }

        if (this.ui.deleteFilterSection) {
            const hasDeleteId = this._hasRecordId(this.ui.deleteIdInput);
            this.ui.deleteFilterSection.hidden = method !== 'DELETE' || hasDeleteId;
        }
    }

    /**
     * Update visibility of toolbar buttons based on method and mode.
     * @param {HttpMethod} method - The selected HTTP method
     * @private
     */
    _updateToolbarButtons(method) {
        if (this.ui.getCountBtn) {
            this.ui.getCountBtn.hidden = method !== 'GET';
        }
        if (this.ui.formatJsonBtn) {
            this.ui.formatJsonBtn.hidden = !this._shouldShowFormatJsonButton(method);
        }
    }

    /**
     * Update visibility of Add Filter Group buttons based on method and record ID.
     * @param {HttpMethod} method - The selected HTTP method
     * @private
     */
    _updateAddFilterButtons(method) {
        if (this.ui.addGetFilterGroupBtn) {
            this.ui.addGetFilterGroupBtn.hidden = method !== 'GET';
        }
        if (this.ui.addPatchFilterGroupBtn) {
            const hasPatchId = this._hasRecordId(this.ui.patchIdInput);
            this.ui.addPatchFilterGroupBtn.hidden = method !== 'PATCH' || hasPatchId;
        }
        if (this.ui.addDeleteFilterGroupBtn) {
            const hasDeleteId = this._hasRecordId(this.ui.deleteIdInput);
            this.ui.addDeleteFilterGroupBtn.hidden = method !== 'DELETE' || hasDeleteId;
        }
    }

    /**
     * Check if a record ID input has a value.
     * @param {HTMLInputElement} input - The input element to check
     * @returns {boolean} True if input has a non-empty trimmed value
     * @private
     */
    _hasRecordId(input) {
        return input?.value?.trim().length > 0;
    }

    /**
     * Determine if Format JSON button should be shown.
     * @param {HttpMethod} method - The selected HTTP method
     * @returns {boolean} True if button should be shown
     * @private
     */
    _shouldShowFormatJsonButton(method) {
        const isPostOrPatch = method === 'POST' || method === 'PATCH';
        if (!isPostOrPatch) {
            return false;
        }
        const bodyModeToggle = method === 'POST' ? this.ui.postBodyModeToggle : this.ui.patchBodyModeToggle;
        return bodyModeToggle?.checked === true;
    }

    /**
     * Toggle bulk update/delete filter section based on Record ID input.
     * If Record ID is provided, hide the bulk filter section.
     * @private
     */
    _toggleBulkFilterSection() {
        const method = this.ui.methodSelect?.value;
        if (method === 'PATCH' && this.ui.patchFilterSection) {
            const hasId = this.ui.patchIdInput?.value?.trim().length > 0;
            this.ui.patchFilterSection.hidden = hasId;
            if (this.ui.addPatchFilterGroupBtn) {
                this.ui.addPatchFilterGroupBtn.hidden = hasId;
            }
        }
        if (method === 'DELETE' && this.ui.deleteFilterSection) {
            const hasId = this.ui.deleteIdInput?.value?.trim().length > 0;
            this.ui.deleteFilterSection.hidden = hasId;
            if (this.ui.addDeleteFilterGroupBtn) {
                this.ui.addDeleteFilterGroupBtn.hidden = hasId;
            }
        }
        this._updatePreview();
    }

    /** Method switch → update view + preview. */
    _bindMethodSwitch() {
        this._methodSelectHandler = () => {
            const previousMethod = this._lastMethod;
            const currentMethod = this.ui.methodSelect.value;

            this._saveMethodState(previousMethod);

            this._lastMethod = currentMethod;
            this._updateMethodView();
            this.clearResults();

            this._restoreMethodState(currentMethod);

            this._updatePreview();
        };
        this.ui.methodSelect.addEventListener('change', this._methodSelectHandler);
    }

    /**
     * Reset the field builder to a single empty row.
     * @private
     */
    _resetFieldBuilder() {
        const method = this.ui.methodSelect?.value;
        const fieldsContainer = method === 'POST' ? this.ui.postFieldsContainer : this.ui.patchFieldsContainer;
        const bodyArea = method === 'POST' ? this.ui.postBodyArea : this.ui.patchBodyArea;

        if (fieldsContainer) {
            fieldsContainer.innerHTML = '';
        }

        this._addFieldUI(true, method);

        if (bodyArea) {
            bodyArea.value = '';
        }
    }

    /**
     * Save the current state of the active method.
     * @private
     * @param {string} method - The method to save state for
     */
    _saveMethodState(method) {
        const state = this._methodState[method];
        if (!state) {
            return;
        }

        const handlers = {
            GET: () => this._saveGetState(state),
            POST: () => this._savePostState(state),
            PATCH: () => this._savePatchState(state),
            DELETE: () => this._saveDeleteState(state)
        };

        const handler = handlers[method];
        if (handler) {
            handler();
        }
    }

    /**
     * Save GET method state.
     * @private
     * @param {Object} state - State object to populate
     */
    _saveGetState(state) {
        state.entity = this.ui.getEntityInput?.value || '';
        state.recordId = this.ui.getIdInput?.value || '';
        state.select = this.ui.getSelect?.value || '';
        state.orderBy = this.ui.getOrderBy?.value || '';
        state.top = this.ui.getTop?.value || '';
        state.expand = this.ui.getExpand?.value || '';
    }

    /**
     * Save POST method state.
     * @private
     * @param {Object} state - State object to populate
     */
    _savePostState(state) {
        state.entity = this.ui.postEntityInput?.value || '';
        state.fields = this.ui.postBodyArea?.value || '';
        state.fieldsHtml = this.ui.postFieldsContainer?.innerHTML || '';
        state.fieldValues = this._captureFieldValues('POST');
    }

    /**
     * Save PATCH method state.
     * @private
     * @param {Object} state - State object to populate
     */
    _savePatchState(state) {
        state.entity = this.ui.patchEntityInput?.value || '';
        state.recordId = this.ui.patchIdInput?.value || '';
        state.fields = this.ui.patchBodyArea?.value || '';
        state.fieldsHtml = this.ui.patchFieldsContainer?.innerHTML || '';
        state.fieldValues = this._captureFieldValues('PATCH');
    }

    /**
     * Save DELETE method state.
     * @private
     * @param {Object} state - State object to populate
     */
    _saveDeleteState(state) {
        state.entity = this.ui.deleteEntityInput?.value || '';
        state.recordId = this.ui.deleteIdInput?.value || '';
    }

    /**
     * Capture current field values from the field builder.
     * @private
     * @param {string} method - The method ('POST' or 'PATCH')
     * @returns {Array<{attribute: string, value: string}>}
     */
    _captureFieldValues(method) {
        const container = method === 'POST' ? this.ui.postFieldsContainer : this.ui.patchFieldsContainer;
        if (!container) {
            return [];
        }

        const rows = container.querySelectorAll('.pdt-field-grid');
        const values = [];

        rows.forEach(row => {
            const attributeInput = row.querySelector('[data-prop="field-attribute"]');
            const valueInput = row.querySelector('[data-prop="field-value"]');

            values.push({
                attribute: attributeInput?.value || '',
                value: valueInput?.value || '',
                attrMetadata: row._attrMetadata || null
            });
        });

        return values;
    }

    /**
     * Restore the state for the active method.
     * @private
     * @param {string} method - The method to restore state for
     */
    _restoreMethodState(method) {
        const state = this._methodState[method];
        if (!state) {
            return;
        }

        const handlers = {
            GET: () => this._restoreGetState(state),
            POST: () => this._restorePostState(state),
            PATCH: () => this._restorePatchState(state),
            DELETE: () => this._restoreDeleteState(state)
        };

        const handler = handlers[method];
        if (handler) {
            handler();
        }
    }

    /**
     * Restore GET method state.
     * @private
     * @param {Object} state - State object to restore from
     */
    _restoreGetState(state) {
        if (this.ui.getEntityInput) {
            this.ui.getEntityInput.value = state.entity;
        }
        if (this.ui.getIdInput) {
            this.ui.getIdInput.value = state.recordId;
        }
        if (this.ui.getSelect) {
            this.ui.getSelect.value = state.select;
        }
        if (this.ui.getOrderBy) {
            this.ui.getOrderBy.value = state.orderBy;
        }
        if (this.ui.getTop) {
            this.ui.getTop.value = state.top;
        }
        if (this.ui.getExpand) {
            this.ui.getExpand.value = state.expand;
        }
    }

    /**
     * Restore POST method state.
     * @private
     * @param {Object} state - State object to restore from
     */
    _restorePostState(state) {
        if (this.ui.postEntityInput) {
            this.ui.postEntityInput.value = state.entity;
        }
        if (this.ui.postBodyArea) {
            this.ui.postBodyArea.value = state.fields;
        }
        if (this.ui.postFieldsContainer) {
            this._restoreFieldBuilder(state, 'POST');
        }
    }

    /**
     * Restore PATCH method state.
     * @private
     * @param {Object} state - State object to restore from
     */
    _restorePatchState(state) {
        if (this.ui.patchEntityInput) {
            this.ui.patchEntityInput.value = state.entity;
        }
        if (this.ui.patchIdInput) {
            this.ui.patchIdInput.value = state.recordId;
        }
        if (this.ui.patchBodyArea) {
            this.ui.patchBodyArea.value = state.fields;
        }
        if (this.ui.patchFieldsContainer) {
            this._restoreFieldBuilder(state, 'PATCH');
        }
    }

    /**
     * Restore DELETE method state.
     * @private
     * @param {Object} state - State object to restore from
     */
    _restoreDeleteState(state) {
        if (this.ui.deleteEntityInput) {
            this.ui.deleteEntityInput.value = state.entity;
        }
        if (this.ui.deleteIdInput) {
            this.ui.deleteIdInput.value = state.recordId;
        }
    }

    /**
     * Restore field builder from state.
     * @private
     * @param {Object} state - State object containing field builder state
     * @param {string} method - The method ('POST' or 'PATCH')
     */
    _restoreFieldBuilder(state, method) {
        const container = method === 'POST' ? this.ui.postFieldsContainer : this.ui.patchFieldsContainer;
        if (!container) {
            return;
        }

        if (state.fieldsHtml) {
            container.innerHTML = state.fieldsHtml;
            this._restoreFieldValues(state.fieldValues || [], method);
            this._reattachFieldHandlers();
        } else {
            container.innerHTML = '';
            this._addFieldUI(true, method);
        }
    }

    /**
     * Restore field values to the field builder rows.
     * @private
     * @param {Array<{attribute: string, value: string}>} fieldValues
     * @param {string} method - The method ('POST' or 'PATCH')
     */
    _restoreFieldValues(fieldValues, method) {
        const container = method === 'POST' ? this.ui.postFieldsContainer : this.ui.patchFieldsContainer;
        if (!container || !fieldValues.length) {
            return;
        }

        const rows = container.querySelectorAll('.pdt-field-grid');

        rows.forEach((row, index) => {
            if (index < fieldValues.length) {
                const savedField = fieldValues[index];
                const attributeInput = row.querySelector('[data-prop="field-attribute"]');
                const valueInput = row.querySelector('[data-prop="field-value"]');

                if (attributeInput) {
                    attributeInput.value = savedField.attribute;
                }

                // Restore metadata and render proper value input
                if (savedField.attrMetadata) {
                    row._attrMetadata = savedField.attrMetadata;
                    this._renderValueInput(row, savedField.attrMetadata, savedField.value);
                } else if (valueInput) {
                    valueInput.value = savedField.value;
                }
            }
        });
    }

    /**
     * Create a plain text input element for value fields.
     * @private
     * @param {string} dataAttr - The data attribute name (e.g., 'field-value', 'value')
     * @param {string} [placeholder='Value'] - Placeholder text
     * @returns {string} - HTML string for the input
     */
    _createValueInput(dataAttr = 'field-value', placeholder = 'Value') {
        return `<input type="text" class="pdt-input pdt-full-width" data-prop="${dataAttr}" placeholder="${placeholder}">`;
    }

    /**
     * Reset a field row to its default state.
     * @private
     * @param {HTMLElement} row - The field row element
     * @param {HTMLInputElement} attributeInput - The attribute input element
     * @param {HTMLElement} valueContainer - The value container element
     * @param {HTMLButtonElement} removeBtn - The remove button element
     * @param {string} [valueDataAttr='field-value'] - Data attribute for value input
     */
    _resetFieldRow(row, attributeInput, valueContainer, removeBtn, valueDataAttr = 'field-value') {
        attributeInput.value = '';
        if (valueContainer) {
            valueContainer.innerHTML = this._createValueInput(valueDataAttr);
        }
        row._attrMetadata = null;
        removeBtn.disabled = true;
    }

    /**
     * Fetch records matching filter criteria.
     * @private
     * @param {string} entitySet - The entity set name
     * @param {Array} filterGroups - Filter groups for the query
     * @param {Array<string>} selectFields - Fields to select
     * @returns {Promise<Array>} - Array of matching records
     */
    async _fetchMatchingRecords(entitySet, filterGroups, selectFields) {
        const options = ODataQueryBuilder.build({
            select: selectFields,
            filterGroups,
            attrMap: this.attrMap
        });

        BusyIndicator.set(this.ui.executeBtn, this.ui.resultRoot, Config.MESSAGES.WEB_API.findingRecords);
        const result = await DataService.retrieveMultipleRecords(entitySet, options);
        return result.entities || [];
    }

    /**
     * Format bulk operation results with error details.
     * @private
     * @param {string} operationName - Name of the operation (e.g., 'Bulk Delete')
     * @param {number} total - Total records processed
     * @param {number} succeeded - Number of successful operations
     * @param {number} failed - Number of failed operations
     * @param {Array<{index: number, error: string}>} errors - Array of error objects
     * @returns {Array<Object>} - Array of summary rows for display
     */
    _formatBulkOperationResult(operationName, total, succeeded, failed, errors) {
        const summaryRows = [{
            'Operation': operationName,
            'Total': total,
            'Succeeded': succeeded,
            'Failed': failed,
            'Error Details': ''
        }];

        // Add error details if there are failures
        if (errors && errors.length > 0) {
            summaryRows.push({
                'Operation': '--- Errors ---',
                'Total': '',
                'Succeeded': '',
                'Failed': '',
                'Error Details': ''
            });
            errors.forEach((err, idx) => {
                summaryRows.push({
                    'Operation': `Error ${idx + 1}`,
                    'Total': '',
                    'Succeeded': '',
                    'Failed': '',
                    'Error Details': err.error || 'Unknown error'
                });
            });
        }

        return summaryRows;
    }

    /**
     * Process batch operations with progress tracking.
     * @private
     * @param {Array<Object>} operations - Array of operations to batch
     * @param {number} batchSize - Size of each batch (default 1000)
     * @param {Function} progressCallback - Callback for progress updates (processedSoFar, total)
     * @returns {Promise<{successCount: number, failCount: number, errors: Array}>}
     */
    async _processBatchOperations(operations, _batchSize = Config.DATAVERSE_BATCH.MAX_BATCH_SIZE, progressCallback) {
        let totalSuccessCount = 0;
        let totalFailCount = 0;
        const allErrors = [];

        const CONCURRENCY = Config.DATAVERSE_BATCH.CONCURRENCY;
        const total = operations.length;
        let processed = 0;
        let lastProgressUpdate = 0;
        const PROGRESS_UPDATE_THRESHOLD = Config.DATAVERSE_BATCH.PROGRESS_UPDATE_THRESHOLD;

        for (let i = 0; i < operations.length; i += CONCURRENCY) {
            const chunk = operations.slice(i, i + CONCURRENCY);

            const results = await Promise.allSettled(
                chunk.map(async (op, chunkIndex) => {
                    const globalIndex = i + chunkIndex;
                    try {
                        if (op.method === 'PATCH') {
                            await DataService.updateRecord(op.entitySet, op.id, op.data);
                            return { success: true, index: globalIndex };
                        }
                        if (op.method === 'POST') {
                            await DataService.createRecord(op.entitySet, op.data);
                            return { success: true, index: globalIndex };
                        }
                        if (op.method === 'DELETE') {
                            await DataService.deleteRecord(op.entitySet, op.id);
                            return { success: true, index: globalIndex };
                        }
                        return { success: false, index: globalIndex, error: 'Unknown method' };
                    } catch (error) {
                        return {
                            success: false,
                            index: globalIndex,
                            error: ErrorParser.extract(error)
                        };
                    }
                })
            );

            results.forEach((result) => {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        totalSuccessCount++;
                    } else {
                        totalFailCount++;
                        allErrors.push({ index: result.value.index, error: result.value.error });
                    }
                } else {
                    totalFailCount++;
                    allErrors.push({ index: processed + results.indexOf(result), error: result.reason?.message || 'Unknown error' });
                }
            });

            processed += chunk.length;

            if (progressCallback && (processed - lastProgressUpdate >= PROGRESS_UPDATE_THRESHOLD || processed === total)) {
                progressCallback(processed, total);
                lastProgressUpdate = processed;
            }
        }

        return { successCount: totalSuccessCount, failCount: totalFailCount, errors: allErrors };
    }

    /**
     * Re-attach event handlers to field rows after restoring from state.
     * @private
     */
    _reattachFieldHandlers() {
        const method = this.ui.methodSelect?.value;
        const fieldsContainer = method === 'POST' ? this.ui.postFieldsContainer : this.ui.patchFieldsContainer;

        if (!fieldsContainer) {
            return;
        }

        const rows = fieldsContainer.querySelectorAll('.pdt-field-grid');
        rows.forEach((row, index) => {
            const isFirst = index === 0;
            const removeBtn = row.querySelector('.pdt-condition-remove');
            const browseBtn = row.querySelector('.browse-field-attr');
            const attributeInput = row.querySelector('[data-prop="field-attribute"]');

            const updateRemoveButtonState = () => {
                removeBtn.disabled = false;
            };

            // Auto-detection: reattach handlers for attribute change detection
            let debounceTimeout = null;

            const attributeChangeHandler = async () => {
                const attrName = attributeInput.value.trim().toLowerCase();
                const cleanAttrName = attrName.replace(/@odata\.bind$/i, '');

                if (cleanAttrName && cleanAttrName.length > 2 && !row._isLoadingMetadata) {
                    row._isLoadingMetadata = true;

                    try {
                        const entityInput = method === 'POST' ? this.ui.postEntityInput : this.ui.patchEntityInput;
                        const { logicalName: entityName } = await this._ensureEntityContext(entityInput.value);

                        const attributes = await DataService.getAttributeDefinitions(entityName);
                        const attr = attributes.find(a => a.LogicalName.toLowerCase() === cleanAttrName);

                        if (attr) {
                            const attrType = (attr.AttributeType || attr.AttributeTypeName?.Value || '').toLowerCase();
                            const isLookup = SmartValueInput.LOOKUP_TYPES.includes(attrType);

                            if (isLookup && !attributeInput.value.endsWith('@odata.bind')) {
                                const navPropMap = await DataService.getNavigationPropertyMap(entityName);
                                const navPropName = navPropMap.get(attr.LogicalName.toLowerCase()) || attr.LogicalName;
                                attributeInput.value = `${navPropName}@odata.bind`;
                            }

                            row._attrMetadata = attr;
                            await this._renderValueInput(row, attr, entityName);

                            if (isFirst) {
                                const newValueInput = row.querySelector('[data-prop="field-value"]');
                                if (newValueInput) {
                                    const valueInputHandler = () => updateRemoveButtonState();
                                    newValueInput.addEventListener('input', valueInputHandler);
                                }
                            }

                            updateRemoveButtonState();
                            this._updatePreview();
                        }
                    } catch (_error) {
                        // Auto-detection failed silently
                    } finally {
                        row._isLoadingMetadata = false;
                    }
                }
            };

            const blurHandler = async () => {
                await attributeChangeHandler();
            };
            attributeInput.addEventListener('blur', blurHandler);
            this._dynamicHandlers.set(attributeInput, { event: 'blur', handler: blurHandler });

            const debouncedInputHandler = () => {
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => attributeChangeHandler(), 300);
            };
            attributeInput.addEventListener('input', debouncedInputHandler);

            const keydownHandler = (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(debounceTimeout);
                    attributeChangeHandler();
                }
            };
            attributeInput.addEventListener('keydown', keydownHandler);

            if (isFirst) {
                const initialValueInput = row.querySelector('[data-prop="field-value"]');
                if (initialValueInput) {
                    const inputHandler = () => updateRemoveButtonState();
                    initialValueInput.addEventListener('input', inputHandler);
                }

                row._updateRemoveButtonState = updateRemoveButtonState;
            }

            if (removeBtn) {
                const removeFieldHandler = () => {
                    const currentMethod = this.ui.methodSelect?.value;
                    const currentFieldsContainer = currentMethod === 'POST' ? this.ui.postFieldsContainer : this.ui.patchFieldsContainer;
                    if (currentFieldsContainer.querySelectorAll('.pdt-field-grid').length === 1) {
                        const valueContainer = row.querySelector('.pdt-value-container');
                        this._resetFieldRow(row, attributeInput, valueContainer, removeBtn);
                    } else {
                        row.remove();
                    }
                    this._updatePreview();
                };
                removeBtn.addEventListener('click', removeFieldHandler);
                this._dynamicHandlers.set(removeBtn, { event: 'click', handler: removeFieldHandler });
            }

            if (browseBtn) {
                const browseFieldHandler = () => {
                    try {
                        const currentMethod = this.ui.methodSelect?.value;
                        const entityInput = currentMethod === 'POST' ? this.ui.postEntityInput : this.ui.patchEntityInput;
                        showColumnBrowser(
                            async () => {
                                const { logicalName } = await this._ensureEntityContext(entityInput.value);
                                return logicalName;
                            },
                            async (attr) => {
                                const attrType = (attr.AttributeType || attr.AttributeTypeName?.Value || '').toLowerCase();

                                const isLookup = SmartValueInput.LOOKUP_TYPES.includes(attrType);
                                if (isLookup) {
                                    const { logicalName: entityLogicalName } = await this._ensureEntityContext(entityInput.value);
                                    const navPropMap = await DataService.getNavigationPropertyMap(entityLogicalName);
                                    const navPropName = navPropMap.get(attr.LogicalName.toLowerCase()) || attr.LogicalName;
                                    attributeInput.value = `${navPropName}@odata.bind`;
                                    await this._renderValueInput(row, attr, entityLogicalName);
                                } else {
                                    attributeInput.value = attr.LogicalName;
                                    const { logicalName: entityLogicalName } = await this._ensureEntityContext(entityInput.value);
                                    await this._renderValueInput(row, attr, entityLogicalName);
                                }

                                if (isFirst) {
                                    updateRemoveButtonState();
                                }
                                this._updatePreview();
                            }
                        );
                    } catch (err) {
                        NotificationService.show(err.message || 'Failed to browse columns', 'error');
                    }
                };
                browseBtn.addEventListener('click', browseFieldHandler);
                this._dynamicHandlers.set(browseBtn, { event: 'click', handler: browseFieldHandler });
            }
        });
    }

    /**
     * Bind helpers for POST/PATCH payload editing (Format JSON).
     * Pretty-prints JSON or shows a clear error.
     * @private
     */
    _bindPayloadHelpers() {
        const btn = this.ui.formatJsonBtn;
        if (!btn) {
            return;
        }

        this._formatJsonHandler = () => {
            const method = this.ui.methodSelect?.value;
            const area = method === 'POST' ? this.ui.postBodyArea : this.ui.patchBodyArea;
            if (!area) {
                return;
            }

            try {
                const raw = area.value?.trim();
                const parsed = JSON.parse(raw && raw.length ? raw : '{}');
                area.value = JSON.stringify(parsed, null, 2);
                area.focus();
            } catch (_e) {
                NotificationService.show(Config.MESSAGES.WEB_API.invalidJson, 'error');
            }
        };
        btn.addEventListener('click', this._formatJsonHandler);
    }

    /**
     * Render result content into #api-result-content.
     * Preserve horizontal scroll position when re-rendering (e.g., after sorting).
     * Respects hideOdata for both Table and JSON.
     * @private
     * @returns {void}
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

        if (this.nextLink && entities.length > 0) {
            this._showPaginationBanner();
        } else {
            this._removePaginationBanner();
        }
    }

    /**
     * Bind entity and column browser buttons for metadata selection.
     * @private
     */
    _bindEntityBrowsers() {
        this._pickEntityHandler = () => {
            MetadataBrowserDialog.show('entity', async (selected) => {
                this.selectedEntityLogicalName = selected.LogicalName;
                this.attrMap = null; // rebuild lazily
                const setName = selected.EntitySetName;

                this.ui.getEntityInput.value = setName;
                this.ui.postEntityInput.value = setName;
                this.ui.patchEntityInput.value = setName;
                this.ui.deleteEntityInput.value = setName;

                // Reset builder to avoid stale data
                this.ui.getSelectInput.value = '';
                this.ui.getOrderByAttrInput.value = '';
                if (this.ui.getFiltersContainer) {
                    this.ui.getFiltersContainer.textContent = '';
                }

                const method = this.ui.methodSelect?.value;
                if (method === 'POST') {
                    await this._populateRequiredFields(selected.LogicalName);
                }

                this._updatePreview();
            });
        };

        this.ui.browseGetEntityBtn.addEventListener('click', this._pickEntityHandler);
        this.ui.browsePostEntityBtn.addEventListener('click', this._pickEntityHandler);
        this.ui.browsePatchEntityBtn.addEventListener('click', this._pickEntityHandler);
        this.ui.browseDeleteEntityBtn.addEventListener('click', this._pickEntityHandler);

        const pickColumn = (assign) => {
            showColumnBrowser(
                async () => {
                    const { logicalName } = await this._ensureEntityContext();
                    return logicalName;
                },
                (attr) => {
                    assign(attr.LogicalName);
                    this._updatePreview();
                }
            );
        };

        this._browseGetSelectHandler = () =>
            pickColumn((ln) => {
                const area = this.ui.getSelectInput;
                area.value += (area.value ? '\n' : '') + ln;
            });

        this._browseGetOrderByHandler = () =>
            pickColumn((ln) => (this.ui.getOrderByAttrInput.value = ln));

        this.ui.browseGetSelectBtn.addEventListener('click', this._browseGetSelectHandler);
        this.ui.browseGetOrderByBtn.addEventListener('click', this._browseGetOrderByHandler);
    }

    /**
     * Bind "Add Filter Group" buttons for GET, PATCH, and DELETE methods.
     * @private
     * @returns {void}
     */
    _bindConditionAdd() {
        // GET add filter group
        if (this.ui.addGetFilterGroupBtn) {
            this._addGetFilterGroupHandler = async () => {
                /** @type {HttpMethod} */
                const method = this.ui.methodSelect.value || 'GET';
                if (method !== 'GET') {
                    return;
                }
                try {
                    await this._ensureEntityContext();
                    const isFirst = this.ui.getFiltersContainer.querySelectorAll('.pdt-filter-group').length === 0;
                    this.getFilterManager.addFilterGroup(this.ui.getFiltersContainer, isFirst);
                } catch (_e) {
                    NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
                }
            };
            this.ui.addGetFilterGroupBtn.addEventListener('click', this._addGetFilterGroupHandler);
        }

        // PATCH add filter group
        if (this.ui.addPatchFilterGroupBtn) {
            this._addPatchFilterGroupHandler = async () => {
                try {
                    await this._ensureEntityContext(this.ui.patchEntityInput.value);
                    const isFirst = this.ui.patchFiltersContainer.querySelectorAll('.pdt-filter-group').length === 0;
                    this.patchFilterManager.addFilterGroup(this.ui.patchFiltersContainer, isFirst);
                } catch (_e) {
                    NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
                }
            };
            this.ui.addPatchFilterGroupBtn.addEventListener('click', this._addPatchFilterGroupHandler);
        }

        // DELETE add filter group
        if (this.ui.addDeleteFilterGroupBtn) {
            this._addDeleteFilterGroupHandler = async () => {
                try {
                    await this._ensureEntityContext(this.ui.deleteEntityInput.value);
                    const isFirst = this.ui.deleteFiltersContainer.querySelectorAll('.pdt-filter-group').length === 0;
                    this.deleteFilterManager.addFilterGroup(this.ui.deleteFiltersContainer, isFirst);
                } catch (_e) {
                    NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
                }
            };
            this.ui.addDeleteFilterGroupBtn.addEventListener('click', this._addDeleteFilterGroupHandler);
        }

        // PATCH copy from GET
        if (this.ui.patchCopyFromGetBtn) {
            this._patchCopyFromGetHandler = () => this._copyFromGet('PATCH');
            this.ui.patchCopyFromGetBtn.addEventListener('click', this._patchCopyFromGetHandler);
        }

        // DELETE copy from GET
        if (this.ui.deleteCopyFromGetBtn) {
            this._deleteCopyFromGetHandler = () => this._copyFromGet('DELETE');
            this.ui.deleteCopyFromGetBtn.addEventListener('click', this._deleteCopyFromGetHandler);
        }
    }

    /**
     * Bind field builder mode toggle (JSON ↔ Field Builder) and "Add Field" button.
     * Handles bidirectional conversion between JSON mode and field builder UI:
     * - Field Builder → JSON: Extracts fields and formats as JSON
     * - JSON → Field Builder: Parses JSON and creates field rows
     * Validates entity context before adding new fields.
     * @private
     * @returns {void}
     */
    _bindFieldBuilder() {
        // POST mode toggle
        if (this.ui.postBodyModeToggle) {
            this._postBodyModeToggleHandler = async () => {
                const isJsonMode = this.ui.postBodyModeToggle.checked;
                this.ui.postBodyModeLabel.textContent = isJsonMode
                    ? Config.MESSAGES.WEB_API.jsonModeLabel
                    : Config.MESSAGES.WEB_API.fieldBuilderLabel;
                this.ui.postFieldsBuilder.hidden = isJsonMode;
                this.ui.postJsonMode.hidden = !isJsonMode;

                if (isJsonMode) {
                    const fields = this._getFieldsFromBuilder('POST');
                    if (Object.keys(fields).length > 0) {
                        this.ui.postBodyArea.value = JSON.stringify(fields, null, 2);
                    }
                } else {
                    try {
                        const json = this.ui.postBodyArea.value.trim();
                        if (json) {
                            const obj = JSON.parse(json);
                            await this._populateFieldsFromJson(obj, 'POST');
                        }
                    } catch (_e) {
                        // Invalid JSON, keep fields as is
                    }
                }
                // Update Format JSON button visibility
                if (this.ui.formatJsonBtn && this.ui.methodSelect?.value === 'POST') {
                    this.ui.formatJsonBtn.hidden = !isJsonMode;
                }
                this._updatePreview();
            };
            this.ui.postBodyModeToggle.addEventListener('change', this._postBodyModeToggleHandler);
        }

        // POST add field button
        if (this.ui.postAddFieldBtn) {
            this._postAddFieldBtnHandler = async () => {
                try {
                    await this._ensureEntityContext(this.ui.postEntityInput.value);
                    this._addFieldUI(false, 'POST');
                    this._updatePreview();
                } catch (_e) {
                    NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
                }
            };
            this.ui.postAddFieldBtn.addEventListener('click', this._postAddFieldBtnHandler);
        }

        // PATCH mode toggle
        if (this.ui.patchBodyModeToggle) {
            this._patchBodyModeToggleHandler = async () => {
                const isJsonMode = this.ui.patchBodyModeToggle.checked;
                this.ui.patchBodyModeLabel.textContent = isJsonMode
                    ? Config.MESSAGES.WEB_API.jsonModeLabel
                    : Config.MESSAGES.WEB_API.fieldBuilderLabel;
                this.ui.patchFieldsBuilder.hidden = isJsonMode;
                this.ui.patchJsonMode.hidden = !isJsonMode;

                if (isJsonMode) {
                    const fields = this._getFieldsFromBuilder('PATCH');
                    if (Object.keys(fields).length > 0) {
                        this.ui.patchBodyArea.value = JSON.stringify(fields, null, 2);
                    }
                } else {
                    try {
                        const json = this.ui.patchBodyArea.value.trim();
                        if (json) {
                            const obj = JSON.parse(json);
                            await this._populateFieldsFromJson(obj, 'PATCH');
                        }
                    } catch (_e) {
                        // Invalid JSON, keep fields as is
                    }
                }
                // Update Format JSON button visibility
                if (this.ui.formatJsonBtn && this.ui.methodSelect?.value === 'PATCH') {
                    this.ui.formatJsonBtn.hidden = !isJsonMode;
                }
                this._updatePreview();
            };
            this.ui.patchBodyModeToggle.addEventListener('change', this._patchBodyModeToggleHandler);
        }

        // PATCH add field button
        if (this.ui.patchAddFieldBtn) {
            this._patchAddFieldBtnHandler = async () => {
                try {
                    await this._ensureEntityContext(this.ui.patchEntityInput.value);
                    this._addFieldUI(false, 'PATCH');
                    this._updatePreview();
                } catch (_e) {
                    NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
                }
            };
            this.ui.patchAddFieldBtn.addEventListener('click', this._patchAddFieldBtnHandler);
        }
    }

    /**
     * Copy table name and filter settings from GET to PATCH or DELETE.
     * @param {'PATCH'|'DELETE'} targetMethod - The target method to copy to
     * @private
     * @async
     */
    async _copyFromGet(targetMethod) {
        const tableName = this._validateAndGetTableName();
        if (!tableName) {
            return;
        }

        this._copyTableNameToTarget(tableName, targetMethod);
        this._enableBulkModeForTarget(targetMethod);

        const getFilterGroups = this.getFilterManager.extractFilterGroups(this.ui.getFiltersContainer);

        if (getFilterGroups.length > 0) {
            const { targetContainer, targetManager } = this._getTargetContainerAndManager(targetMethod);
            this._clearTargetFilters(targetContainer);

            const { entityContext, attrMap } = await this._resolveEntityMetadata(tableName);

            await this._recreateFilterGroups(getFilterGroups, targetContainer, targetManager, entityContext, attrMap);
        }

        this._showCopySuccessMessage(tableName, getFilterGroups.length);
    }

    /**
     * Validate GET table name input and return trimmed value.
     * @returns {string|null} Table name or null if invalid
     * @private
     */
    _validateAndGetTableName() {
        const tableName = this.ui.getEntityInput?.value?.trim();

        if (!tableName) {
            NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
            return null;
        }

        return tableName;
    }

    /**
     * Copy table name to target method input.
     * @param {string} tableName - The table name to copy
     * @param {'PATCH'|'DELETE'} targetMethod - The target method
     * @private
     */
    _copyTableNameToTarget(tableName, targetMethod) {
        const entityInput = targetMethod === 'PATCH' ? this.ui.patchEntityInput : this.ui.deleteEntityInput;
        if (entityInput) {
            entityInput.value = tableName;
        }
    }

    /**
     * Enable bulk mode for target method by clearing record ID and showing filter section.
     * @param {'PATCH'|'DELETE'} targetMethod - The target method
     * @private
     */
    _enableBulkModeForTarget(targetMethod) {
        if (targetMethod === 'PATCH') {
            if (this.ui.patchIdInput) {
                this.ui.patchIdInput.value = '';
            }
            if (this.ui.patchFilterSection) {
                this.ui.patchFilterSection.hidden = false;
            }
            if (this.ui.addPatchFilterGroupBtn) {
                this.ui.addPatchFilterGroupBtn.hidden = false;
            }
        } else if (targetMethod === 'DELETE') {
            if (this.ui.deleteIdInput) {
                this.ui.deleteIdInput.value = '';
            }
            if (this.ui.deleteFilterSection) {
                this.ui.deleteFilterSection.hidden = false;
            }
            if (this.ui.addDeleteFilterGroupBtn) {
                this.ui.addDeleteFilterGroupBtn.hidden = false;
            }
        }
    }

    /**
     * Get target container and filter manager for target method.
     * @param {'PATCH'|'DELETE'} targetMethod - The target method
     * @returns {{targetContainer: HTMLElement, targetManager: FilterGroupManager}} Target refs
     * @private
     */
    _getTargetContainerAndManager(targetMethod) {
        return {
            targetContainer: targetMethod === 'PATCH'
                ? this.ui.patchFiltersContainer
                : this.ui.deleteFiltersContainer,
            targetManager: targetMethod === 'PATCH'
                ? this.patchFilterManager
                : this.deleteFilterManager
        };
    }

    /**
     * Clear existing filters from target container.
     * @param {HTMLElement} targetContainer - The container to clear
     * @private
     */
    _clearTargetFilters(targetContainer) {
        if (targetContainer) {
            targetContainer.innerHTML = '';
        }
    }

    /**
     * Resolve entity metadata for the given table name.
     * @param {string} tableName - The table name to resolve
     * @returns {Promise<{entityContext: Object|null, attrMap: Map|null}>} Resolved metadata
     * @private
     * @async
     */
    async _resolveEntityMetadata(tableName) {
        let entityContext = null;
        let attrMap = null;

        try {
            entityContext = await EntityContextResolver.resolve(tableName);
            attrMap = await EntityContextResolver.getAttrMap(entityContext.logicalName);
        } catch (_e) {
            // Fall back to plain text inputs if context resolution fails
        }

        return { entityContext, attrMap };
    }

    /**
     * Recreate all filter groups from GET in the target method.
     * @param {Array} filterGroups - Filter groups to recreate
     * @param {HTMLElement} targetContainer - Target container
     * @param {FilterGroupManager} targetManager - Target filter manager
     * @param {Object|null} entityContext - Entity context
     * @param {Map|null} attrMap - Attribute map
     * @private
     * @async
     */
    async _recreateFilterGroups(filterGroups, targetContainer, targetManager, entityContext, attrMap) {
        for (let index = 0; index < filterGroups.length; index++) {
            const groupData = filterGroups[index];
            const isFirst = index === 0;

            await this._recreateFilterGroup(groupData, isFirst, targetContainer, targetManager, entityContext, attrMap);
        }
    }

    /**
     * Recreate a single filter group with all its conditions.
     * @param {Object} groupData - Filter group data
     * @param {boolean} isFirst - Whether this is the first group
     * @param {HTMLElement} targetContainer - Target container
     * @param {FilterGroupManager} targetManager - Target filter manager
     * @param {Object|null} entityContext - Entity context
     * @param {Map|null} attrMap - Attribute map
     * @private
     * @async
     */
    async _recreateFilterGroup(groupData, isFirst, targetContainer, targetManager, entityContext, attrMap) {
        targetManager.addFilterGroup(targetContainer, isFirst);

        const groups = targetContainer.querySelectorAll('.pdt-filter-group');
        const filterGroup = groups[groups.length - 1];

        this._setFilterType(filterGroup, groupData.filterType);

        if (!isFirst) {
            this._setInterGroupOperator(filterGroup, groupData.interGroupOperator);
        }

        const conditionsContainer = filterGroup.querySelector('.pdt-filter-group-conditions');
        await this._recreateConditions(groupData.filters, conditionsContainer, targetManager, entityContext, attrMap);
    }

    /**
     * Set filter type for a filter group.
     * @param {HTMLElement} filterGroup - The filter group element
     * @param {string} filterType - The filter type value
     * @private
     */
    _setFilterType(filterGroup, filterType) {
        const filterTypeSelect = filterGroup.querySelector('[data-prop="filter-type"]');
        if (filterTypeSelect) {
            filterTypeSelect.value = filterType;
        }
    }

    /**
     * Set inter-group operator for a filter group.
     * @param {HTMLElement} filterGroup - The filter group element
     * @param {string} operator - The operator value
     * @private
     */
    _setInterGroupOperator(filterGroup, operator) {
        const separator = filterGroup.previousElementSibling;
        if (separator && separator.classList.contains('pdt-filter-group-separator')) {
            const operatorSelect = separator.querySelector('[data-prop="inter-group-operator"]');
            if (operatorSelect) {
                operatorSelect.value = operator;
            }
        }
    }

    /**
     * Recreate all conditions for a filter group.
     * @param {Array} filters - Array of filter conditions
     * @param {HTMLElement} conditionsContainer - Conditions container
     * @param {FilterGroupManager} targetManager - Target filter manager
     * @param {Object|null} entityContext - Entity context
     * @param {Map|null} attrMap - Attribute map
     * @private
     * @async
     */
    async _recreateConditions(filters, conditionsContainer, targetManager, entityContext, attrMap) {
        for (let filterIndex = 0; filterIndex < filters.length; filterIndex++) {
            const filter = filters[filterIndex];

            if (filterIndex > 0) {
                targetManager.addCondition(conditionsContainer, false);
            }

            const conditions = conditionsContainer.querySelectorAll('.pdt-condition-grid');
            const conditionRow = conditions[conditions.length - 1];

            this._setConditionAttributes(conditionRow, filter);
            await this._renderConditionValue(conditionRow, filter, attrMap, entityContext, targetManager);
        }
    }

    /**
     * Set attribute and operator for a condition row.
     * @param {HTMLElement} conditionRow - The condition row element
     * @param {Object} filter - Filter data with attr and op properties
     * @private
     */
    _setConditionAttributes(conditionRow, filter) {
        const attrInput = conditionRow.querySelector('[data-prop="attribute"]');
        const opSelect = conditionRow.querySelector('[data-prop="operator"]');

        if (attrInput) {
            attrInput.value = filter.attr;
        }
        if (opSelect) {
            opSelect.value = filter.op;
        }
    }

    /**
     * Render smart value input with proper type and set its value.
     * @param {HTMLElement} conditionRow - The condition row element
     * @param {Object} filter - Filter data with attr, op, and value
     * @param {Map|null} attrMap - Attribute map
     * @param {Object|null} entityContext - Entity context
     * @param {FilterGroupManager} targetManager - Target filter manager
     * @private
     * @async
     */
    async _renderConditionValue(conditionRow, filter, attrMap, entityContext, targetManager) {
        if (filter.attr && attrMap) {
            try {
                const attr = attrMap.get(filter.attr.toLowerCase());

                if (attr) {
                    await targetManager.renderValueInput(attr, conditionRow, () => entityContext.logicalName);
                    this._setValueInputValue(conditionRow, filter);
                } else {
                    this._setPlainTextValue(conditionRow, filter.value);
                }
            } catch (_e) {
                this._setPlainTextValue(conditionRow, filter.value);
            }
        } else {
            this._setPlainTextValue(conditionRow, filter.value);
        }
    }

    /**
     * Set value for value input based on input type.
     * @param {HTMLElement} conditionRow - The condition row element
     * @param {Object} filter - Filter data with value property
     * @private
     */
    _setValueInputValue(conditionRow, filter) {
        const valueInput = conditionRow.querySelector('[data-prop="value"]');
        if (!valueInput) {
            return;
        }

        if (valueInput.classList?.contains('pdt-multiselect-dropdown')) {
            this._setMultiselectValue(valueInput, filter.value);
        } else {
            valueInput.value = filter.value;
        }
    }

    /**
     * Set values for multiselect dropdown.
     * @param {HTMLElement} valueInput - The multiselect dropdown element
     * @param {string} value - Comma-separated values to set
     * @private
     */
    _setMultiselectValue(valueInput, value) {
        const values = value.split(',').map(v => v.trim());
        const checkboxes = valueInput.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            if (values.includes(cb.value)) {
                cb.checked = true;
            }
        });
    }

    /**
     * Set plain text value for value input.
     * @param {HTMLElement} conditionRow - The condition row element
     * @param {string} value - The value to set
     * @private
     */
    _setPlainTextValue(conditionRow, value) {
        const valueInput = conditionRow.querySelector('[data-prop="value"]');
        if (valueInput) {
            valueInput.value = value;
        }
    }

    /**
     * Show success message after copying from GET.
     * @param {string} tableName - The table name that was copied
     * @param {number} filterCount - Number of filter groups copied
     * @private
     */
    _showCopySuccessMessage(tableName, filterCount) {
        const filterInfo = filterCount > 0
            ? ` with ${filterCount} filter group${filterCount > 1 ? 's' : ''}`
            : '';
        NotificationService.show(`Copied from GET: ${tableName}${filterInfo}`, 'success');
    }

    /**
     * Bind "Get Count" button to retrieve total record count.
     * @private
     */
    _bindGetCount() {
        if (!this.ui.getCountBtn) {
            return;
        }
        this._getCountHandler = async () => {
            if (!this.ui.getCountBtn || this.ui.getCountBtn.disabled) {
                return;
            }

            const originalText = this.ui.getCountBtn.textContent;

            try {
                const { entitySet, logicalName } = await this._ensureEntityContext(this.ui.getEntityInput.value);

                this.ui.getCountBtn.disabled = true;
                this.ui.getCountBtn.textContent = Config.MESSAGES.WEB_API.counting;

                const metadata = await PowerAppsApiService.getEntityMetadata(logicalName);
                const primaryKey = metadata.PrimaryIdAttribute;

                const options = await this._buildGetOptionsString(logicalName);
                const baseOptions = options ? options.replace(/\$select=[^&]+&?/, '') : '';
                const countOptions = baseOptions ? `${baseOptions}&$select=${primaryKey}` : `?$select=${primaryKey}`;

                let totalCount = 0;
                let nextLink = null;
                let pageCount = 0;

                do {
                    pageCount++;
                    this.ui.getCountBtn.textContent = Config.MESSAGES.WEB_API.countingProgress(totalCount.toLocaleString());

                    const result = nextLink
                        ? await DataService.retrieveMultipleRecords(entitySet, nextLink.split('?')[1])
                        : await DataService.retrieveMultipleRecords(entitySet, countOptions);

                    totalCount += (result.entities || []).length;
                    nextLink = result.nextLink || null;

                    if (pageCount >= Config.DATAVERSE_PAGINATION.MAX_COUNT_PAGES) {
                        NotificationService.show(
                            Config.MESSAGES.WEB_API.countLimitWarning(totalCount.toLocaleString()),
                            'warning'
                        );
                        break;
                    }
                } while (nextLink);

                this.lastResult = {
                    entities: [{
                        'Table': logicalName,
                        'Count': totalCount.toLocaleString(),
                        'Pages': pageCount.toLocaleString()
                    }]
                };
                this.resultSortState = { column: null, direction: 'asc' };

                if (this.ui.resultRoot.style.display === 'none') {
                    this.ui.resultRoot.style.display = '';
                }

                this._displayResult();
                this.ui.resultRoot?.scrollIntoView({ behavior: 'smooth', block: 'start' });

                NotificationService.show(
                    Config.MESSAGES.WEB_API.countSuccess(totalCount.toLocaleString(), pageCount),
                    'success'
                );
            } catch (error) {
                const friendly = ErrorParser.extract(error);
                const notifType = friendly === Config.MESSAGES.COMMON.selectTableFirst ? 'warning' : 'error';
                NotificationService.show(friendly, notifType);
            } finally {
                this.ui.getCountBtn.disabled = false;
                this.ui.getCountBtn.textContent = originalText;
            }
        };
        this.ui.getCountBtn.addEventListener('click', this._getCountHandler);
    }

    /**
     * Bind "Execute" and "Copy URL" buttons for Web API operations.
     * @private
     */
    _bindExecute() {
        this._executeHandler = async () => {
            if (!this.ui.executeBtn || this.ui.executeBtn.disabled) {
                return;
            }
            /** @type {HttpMethod} */
            const method = this.ui.methodSelect.value;

            this._removePaginationBanner();
            if (this.resultPanel) {
                this.resultPanel._selectedIndices?.clear();
            }

            this._setExecuting(true);
            try {
                const handlers = {
                    GET: () => this._executeGet(),
                    POST: () => this._executePost(),
                    PATCH: () => this._executePatch(),
                    DELETE: () => this._executeDelete()
                };

                const handler = handlers[method];
                if (handler) {
                    await handler();
                }
            } catch (error) {
                const friendly = ErrorParser.extract(error);
                const notifType = friendly === Config.MESSAGES.COMMON.selectTableFirst ? 'warning' : 'error';
                NotificationService.show(friendly, notifType);
            } finally {
                this._setExecuting(false);

                if (this.ui.resultRoot.style.display === 'none') {
                    this.ui.resultRoot.style.display = '';
                }

                this._displayResult();
                this.ui.resultRoot?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };
        this.ui.executeBtn.addEventListener('click', this._executeHandler);
    }

    /**
     * Execute GET request.
     * @private
     */
    async _executeGet() {
        const { entitySet, logicalName } = await this._ensureEntityContext(this.ui.getEntityInput.value);
        const options = await this._buildGetOptionsString(logicalName);
        const res = await DataService.retrieveMultipleRecords(entitySet, options);

        this.nextLink = res.nextLink || null;
        this.allLoadedRecords = res.entities || [];
        this.lastResult = normalizeApiResponse(res);
    }

    /**
     * Execute POST request.
     * @private
     */
    async _executePost() {
        const { entitySet, logicalName } = await this._ensureEntityContext(this.ui.postEntityInput.value);
        const body = this._getRequestBody();
        const fileUploads = this._extractFileUploads();

        const res = await DataService.createRecord(entitySet, body);
        this.lastResult = normalizeApiResponse(res);

        if (fileUploads.length > 0 && res.id) {
            await this._uploadFiles(logicalName, res.id, fileUploads);
        }
    }

    /**
     * Execute PATCH request (single or bulk).
     * @private
     */
    async _executePatch() {
        const id = this.ui.patchIdInput.value.trim();
        const filterGroups = this.patchFilterManager.extractFilterGroups(this.ui.patchFiltersContainer);
        const hasConditions = filterGroups.length > 0 && filterGroups.some(g => g.filters.length > 0);

        if (!id && hasConditions) {
            await this._executeBulkPatch();
            return;
        }

        if (id) {
            await this._executeSinglePatch(id);
        } else {
            throw new Error(Config.MESSAGES.WEB_API.idOrConditionsRequired);
        }
    }

    /**
     * Execute single record PATCH.
     * @private
     * @param {string} id - Record ID
     */
    async _executeSinglePatch(id) {
        const { entitySet, logicalName } = await this._ensureEntityContext(this.ui.patchEntityInput.value);
        const body = this._getRequestBody();
        const fileUploads = this._extractFileUploads();

        ValidationService.validateGuid(id, 'Record ID', Config.VALIDATION_ERRORS.invalidPatchGuid);
        const res = await DataService.updateRecord(entitySet, id, body);
        this.lastResult = normalizeApiResponse(res);

        if (fileUploads.length > 0) {
            await this._uploadFiles(logicalName, id, fileUploads);
        }
    }

    /**
     * Execute DELETE request (single or bulk).
     * @private
     */
    async _executeDelete() {
        const id = this.ui.deleteIdInput.value.trim();
        const filterGroups = this.deleteFilterManager.extractFilterGroups(this.ui.deleteFiltersContainer);
        const hasConditions = filterGroups.length > 0 && filterGroups.some(g => g.filters.length > 0);

        if (!id && hasConditions) {
            await this._executeBulkDelete();
            return;
        }

        if (id) {
            await this._executeSingleDelete(id);
        } else {
            throw new Error(Config.MESSAGES.WEB_API.idOrConditionsRequired);
        }
    }

    /**
     * Execute single record DELETE.
     * @private
     * @param {string} id - Record ID
     */
    async _executeSingleDelete(id) {
        const { entitySet } = await this._ensureEntityContext(this.ui.deleteEntityInput.value);
        ValidationService.validateGuid(id, 'Record ID', Config.VALIDATION_ERRORS.invalidDeleteGuid);

        const ok = await showConfirmDialog(
            Config.MESSAGES.WEB_API.confirmDelete,
            Config.MESSAGES.WEB_API.deleteRecordConfirm(escapeHtml(id), escapeHtml(entitySet))
        );

        if (!ok) {
            this.lastResult = normalizeApiResponse(null);
            this._displayResult();
            NotificationService.show(Config.MESSAGES.WEB_API.requestSuccess, 'success');
            return;
        }

        const res = await DataService.deleteRecord(entitySet, id);
        this.lastResult = normalizeApiResponse(res);
    }


    /**
     * Bind debounced live preview refresh for input changes.
     * @private
     */
    _bindLivePreview() {
        this._livePreviewRefreshHandler = debounce(async () => {
            await this._updatePreview();
        }, 200);

        [
            this.ui.methodSelect, this.ui.getEntityInput, this.ui.getSelectInput, this.ui.getTopInput,
            this.ui.getOrderByAttrInput, this.ui.getOrderByDirSelect,
            this.ui.postEntityInput, this.ui.patchEntityInput, this.ui.patchIdInput,
            this.ui.postBodyArea, this.ui.patchBodyArea,
            this.ui.deleteEntityInput, this.ui.deleteIdInput
        ].forEach(n => n && n.addEventListener('input', this._livePreviewRefreshHandler));

        if (this.ui.getFiltersContainer) {
            this.ui.getFiltersContainer.addEventListener('input', this._livePreviewRefreshHandler);
            this.ui.getFiltersContainer.addEventListener('change', this._livePreviewRefreshHandler);
        }

        // Add listeners for field builder container
        if (this.ui.postFieldsContainer) {
            this.ui.postFieldsContainer.addEventListener('input', this._livePreviewRefreshHandler);
        }
        if (this.ui.patchFieldsContainer) {
            this.ui.patchFieldsContainer.addEventListener('input', this._livePreviewRefreshHandler);
        }
    }

    /**
     * Allow a global refresh to clear results from this tab.
     * Fire: document.dispatchEvent(new CustomEvent('pdt:tool-refresh'));
     */
    _bindExternalRefresh() {
        this._externalRefreshHandler = () => this.clearResults();
        document.addEventListener('pdt:tool-refresh', this._externalRefreshHandler);
        document.addEventListener('pdt:refresh', this._externalRefreshHandler);
    }

    /**
     * Ensure entity set & logical name are known and attribute map is loaded.
     * Accepts either an **entity set name** or a **logical name**.
     * If nameOverride is provided, it is used; otherwise the first non-empty UI field is used.
     * Normalizes all UI inputs to the **entity set name** once resolved.
     * @private
     * @param {string=} nameOverride
     * @returns {Promise<{ entitySet: string, logicalName: string }>}
     */
    async _ensureEntityContext(nameOverride) {
        const entityInput = (nameOverride ||
            this.ui.getEntityInput.value ||
            this.ui.postEntityInput.value ||
            this.ui.patchEntityInput.value ||
            this.ui.deleteEntityInput.value || ''
        ).trim();

        if (!entityInput) {
            throw new Error(Config.MESSAGES.COMMON.selectTableFirst);
        }

        const { entitySet, logicalName } = await EntityContextResolver.resolve(entityInput);

        if (this.ui.getEntityInput) {
            this.ui.getEntityInput.value = entitySet;
        }
        const method = this.ui.methodSelect?.value;
        if (method === 'POST' && this.ui.postEntityInput) {
            this.ui.postEntityInput.value = entitySet;
        } else if (method === 'PATCH' && this.ui.patchEntityInput) {
            this.ui.patchEntityInput.value = entitySet;
        }
        if (this.ui.deleteEntityInput) {
            this.ui.deleteEntityInput.value = entitySet;
        }

        this.selectedEntityLogicalName = logicalName;

        // Only fetch attrMap if not already cached for this specific entity
        if (!this.attrMap || this.selectedEntityLogicalName !== logicalName) {
            this.attrMap = await EntityContextResolver.getAttrMap(logicalName);
        }

        return { entitySet, logicalName };
    }

    /**
     * Build GET options ($select, $filter, $top, $orderby).
     * - Rewrites lookup selects to _<attr>_value.
     * - Formats filter values by inferred type.
     * @private
     * @param {string} logicalName
     * @returns {Promise<string>}
     */
    async _buildGetOptionsString(logicalName) {
        if (!this.attrMap) {
            this.attrMap = await EntityContextResolver.getAttrMap(logicalName);
        }

        const rawSelect = this.ui.getSelectInput.value.trim();
        const select = rawSelect ? rawSelect.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];

        const filterGroups = this.getFilterManager.extractFilterGroups(this.ui.getFiltersContainer);

        const orderAttr = this.ui.getOrderByAttrInput.value.trim();
        const orderDir = this.ui.getOrderByDirSelect.value;
        const top = this.ui.getTopInput.value.trim();

        return ODataQueryBuilder.build({
            select,
            filterGroups,
            orderAttr,
            orderDir,
            top,
            attrMap: this.attrMap
        });
    }

    /**
     * Render a type-aware value input control based on attribute metadata.
     * @private
     * @param {HTMLElement} row - The field row element
     * @param {Object} attr - The attribute metadata object
     * @param {string} entityLogicalName - The entity logical name for fetching options
     * @param {'post'|'filter'} [context='post'] - Context: 'post' for field builder, 'filter' for condition filters
     * @returns {Promise<void>}
     */
    async _renderValueInput(row, attr, entityLogicalName, context = 'post') {
        const valueContainer = row.querySelector('.pdt-value-container');
        if (!valueContainer) {
            return;
        }

        const dataProp = context === 'filter' ? 'value' : 'field-value';

        await SmartValueInput.render({
            valueContainer,
            attr,
            entityName: entityLogicalName,
            dataProp,
            context,
            row,
            onInputChange: () => this._updatePreview()
        });

        if (row._updateRemoveButtonState) {
            row._updateRemoveButtonState();
        }
    }

    /**
     * Add a field row to the field builder (Attribute | Value | Remove).
     * @private
     * @param {boolean} isFirst - Whether this is the first row (disable remove button)
     * @param {string} method - The method ('POST' or 'PATCH')
     */
    _addFieldUI(isFirst = false, method = 'POST') {
        const container = method === 'POST' ? this.ui.postFieldsContainer : this.ui.patchFieldsContainer;
        if (!container) {
            return;
        }

        const row = document.createElement('div');
        row.className = 'pdt-field-grid';
        row.innerHTML = `
            <div class="pdt-input-with-button">
                <input type="text" class="pdt-input" data-prop="field-attribute" placeholder="Attribute (e.g., name)">
                <button class="pdt-input-btn browse-field-attr" title="Browse columns">${ICONS.inspector}</button>
            </div>
            <div class="pdt-value-container">
                <input type="text" class="pdt-input pdt-full-width" data-prop="field-value" placeholder="Value">
            </div>
            <button class="modern-button danger secondary pdt-condition-remove" ${isFirst ? 'disabled' : ''}>X</button>
        `;

        const browseBtn = row.querySelector('.browse-field-attr');
        const removeBtn = row.querySelector('.pdt-condition-remove');
        const attributeInput = row.querySelector('[data-prop="field-attribute"]');

        const browseFieldHandler = this._createFieldBrowseHandler(row, isFirst, method);
        if (browseBtn) {
            browseBtn.addEventListener('click', browseFieldHandler);
            this._dynamicHandlers.set(browseBtn, { event: 'click', handler: browseFieldHandler });
        }

        const updateRemoveButtonState = () => {
            removeBtn.disabled = false;
        };

        // Auto-detection: when user manually types attribute name, fetch metadata and render appropriate input
        // Use row-specific flag to prevent race conditions
        let debounceTimeout = null;

        const attributeChangeHandler = async () => {
            const attrName = attributeInput.value.trim().toLowerCase();
            // Remove @odata.bind suffix for lookup purposes
            const cleanAttrName = attrName.replace(/@odata\.bind$/i, '');

            if (cleanAttrName && cleanAttrName.length > 2 && !row._isLoadingMetadata) {
                row._isLoadingMetadata = true;

                try {
                    const entityInput = method === 'POST' ? this.ui.postEntityInput : this.ui.patchEntityInput;
                    const { logicalName: entityName } = await this._ensureEntityContext(entityInput.value);

                    const attributes = await DataService.getAttributeDefinitions(entityName);
                    const attr = attributes.find(a => a.LogicalName.toLowerCase() === cleanAttrName);

                    if (attr) {
                        const attrType = (attr.AttributeType || attr.AttributeTypeName?.Value || '').toLowerCase();
                        const isLookup = SmartValueInput.LOOKUP_TYPES.includes(attrType);

                        // For lookups, ensure attribute input has @odata.bind suffix
                        if (isLookup && !attributeInput.value.endsWith('@odata.bind')) {
                            // Get navigation property name (may differ from logical name)
                            const navPropMap = await DataService.getNavigationPropertyMap(entityName);
                            const navPropName = navPropMap.get(attr.LogicalName.toLowerCase()) || attr.LogicalName;
                            attributeInput.value = `${navPropName}@odata.bind`;
                        }

                        // Store metadata on row for later use
                        row._attrMetadata = attr;

                        await this._renderValueInput(row, attr, entityName);

                        // After rendering new input, re-attach listener to the new value input element
                        if (isFirst) {
                            const newValueInput = row.querySelector('[data-prop="field-value"]');
                            if (newValueInput) {
                                const valueInputHandler = () => updateRemoveButtonState();
                                newValueInput.addEventListener('input', valueInputHandler);
                            }
                        }

                        // Update remove button state after rendering
                        updateRemoveButtonState();
                        this._updatePreview();
                    }
                } catch (_error) {
                    // Auto-detection failed silently
                } finally {
                    row._isLoadingMetadata = false;
                }
            }
        };

        const blurHandler = async () => {
            await attributeChangeHandler();
        };
        attributeInput.addEventListener('blur', blurHandler);
        this._dynamicHandlers.set(attributeInput, { event: 'blur', handler: blurHandler });

        const debouncedInputHandler = () => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => attributeChangeHandler(), 300);
        };

        const keydownHandler = (e) => {
            if (e.key === 'Enter') {
                clearTimeout(debounceTimeout);
                attributeChangeHandler();
            }
        };
        attributeInput.addEventListener('keydown', keydownHandler);
        this._dynamicHandlers.set(attributeInput, { event: 'keydown', handler: keydownHandler });

        // Listen for input changes - combine both handlers for first row
        if (isFirst) {
            // Combine auto-detection AND remove button state update
            const combinedInputHandler = () => {
                updateRemoveButtonState();
                debouncedInputHandler();
            };
            attributeInput.addEventListener('input', combinedInputHandler);

            const initialValueInput = row.querySelector('[data-prop="field-value"]');
            if (initialValueInput) {
                const valueInputHandler = () => updateRemoveButtonState();
                initialValueInput.addEventListener('input', valueInputHandler);
            }
            this._dynamicHandlers.set(attributeInput, { event: 'input', handler: combinedInputHandler });
            row._updateRemoveButtonState = updateRemoveButtonState;
        } else {
            attributeInput.addEventListener('input', debouncedInputHandler);
            this._dynamicHandlers.set(attributeInput, { event: 'input', handler: debouncedInputHandler });
        }

        const removeFieldHandler = this._createFieldRemoveHandler(row, attributeInput, removeBtn, browseBtn, browseFieldHandler, method);
        if (removeBtn) {
            removeBtn.addEventListener('click', removeFieldHandler);
            this._dynamicHandlers.set(removeBtn, { event: 'click', handler: removeFieldHandler });
        }

        container.appendChild(row);
    }

    /**
     * Create browse button click handler for field builder rows.
     * @private
     * @param {HTMLElement} row - The field row element
     * @param {boolean} isFirst - Whether this is the first row
     * @param {string} method - The method ('POST' or 'PATCH')
     * @returns {Function} - Click handler function
     */
    _createFieldBrowseHandler(row, isFirst, method) {
        return () => {
            const entityInput = method === 'POST' ? this.ui.postEntityInput : this.ui.patchEntityInput;
            showColumnBrowser(
                async () => {
                    const { logicalName } = await this._ensureEntityContext(entityInput.value);
                    return logicalName;
                },
                async (attr) => {
                    const attrInput = row.querySelector('[data-prop="field-attribute"]');
                    const attrType = (attr.AttributeType || attr.AttributeTypeName?.Value || '').toLowerCase();

                    // For lookups, use navigation property name with @odata.bind
                    const isLookup = SmartValueInput.LOOKUP_TYPES.includes(attrType);
                    if (isLookup) {
                        const { logicalName: entityLogicalName } = await this._ensureEntityContext(entityInput.value);
                        const navPropMap = await DataService.getNavigationPropertyMap(entityLogicalName);
                        const navPropName = navPropMap.get(attr.LogicalName.toLowerCase()) || attr.LogicalName;
                        attrInput.value = `${navPropName}@odata.bind`;
                        await this._renderValueInput(row, attr, entityLogicalName);
                    } else {
                        attrInput.value = attr.LogicalName;
                        const { logicalName: entityLogicalName } = await this._ensureEntityContext(entityInput.value);
                        await this._renderValueInput(row, attr, entityLogicalName);
                    }

                    if (isFirst && row._updateRemoveButtonState) {
                        row._updateRemoveButtonState();
                    }
                    this._updatePreview();
                }
            );
        };
    }

    /**
     * Create remove button click handler for field builder rows.
     * @private
     * @param {HTMLElement} row - The field row element
     * @param {HTMLElement} attributeInput - Attribute input element
     * @param {HTMLElement} removeBtn - Remove button element
     * @param {HTMLElement} browseBtn - Browse button element
     * @param {Function} browseFieldHandler - Browse field handler function
     * @param {string} method - The method ('POST' or 'PATCH')
     * @returns {Function} - Click handler function
     */
    _createFieldRemoveHandler(row, attributeInput, removeBtn, browseBtn, browseFieldHandler, method) {
        return () => {
            const container = method === 'POST' ? this.ui.postFieldsContainer : this.ui.patchFieldsContainer;
            // If this is the only row, reset it instead of removing
            if (container.querySelectorAll('.pdt-field-grid').length === 1) {
                const valueContainer = row.querySelector('.pdt-value-container');
                this._resetFieldRow(row, attributeInput, valueContainer, removeBtn);
                this._updatePreview();
                return;
            }

            row.remove();

            // Clean up all handlers for this row
            if (browseBtn && this._dynamicHandlers.has(browseBtn)) {
                const browseHandler = this._dynamicHandlers.get(browseBtn);
                if (browseHandler) {
                    browseBtn.removeEventListener(browseHandler.event, browseHandler.handler);
                }
                this._dynamicHandlers.delete(browseBtn);
            }
            if (removeBtn && this._dynamicHandlers.has(removeBtn)) {
                const removeHandler = this._dynamicHandlers.get(removeBtn);
                if (removeHandler) {
                    removeBtn.removeEventListener(removeHandler.event, removeHandler.handler);
                }
                this._dynamicHandlers.delete(removeBtn);
            }
            if (attributeInput && this._dynamicHandlers.has(attributeInput)) {
                const attrHandler = this._dynamicHandlers.get(attributeInput);
                if (attrHandler) {
                    attributeInput.removeEventListener(attrHandler.event, attrHandler.handler);
                }
                this._dynamicHandlers.delete(attributeInput);
            }
            this._updatePreview();
        };
    }

    /**
     * Extract fields from the field builder UI as a JSON object.
     * Handles type-aware value parsing based on input data-type attribute.
     * @private
     * @param {string} [method='POST'] - The method (POST or PATCH) to get fields for
     * @returns {Object} - Key-value pairs from field builder
     */
    _getFieldsFromBuilder(method = 'POST') {
        const fields = {};
        const fieldsContainer = method === 'POST' ? this.ui.postFieldsContainer : this.ui.patchFieldsContainer;
        const rows = [...fieldsContainer.querySelectorAll('.pdt-field-grid')];

        rows.forEach(row => {
            const attr = row.querySelector('[data-prop="field-attribute"]')?.value.trim();
            const valueInput = row.querySelector('[data-prop="field-value"]');

            let rawValue = '';
            if (valueInput?.classList?.contains('pdt-multiselect-dropdown')) {
                rawValue = '';
            } else {
                rawValue = valueInput?.value?.trim() || '';
            }

            if (attr) {
                if (attr === 'LogicalName' || (attr.startsWith('@odata') && !attr.includes('@odata.bind'))) {
                    return;
                }

                const parsedValue = this._parseFieldValue(valueInput, rawValue);
                if (parsedValue !== undefined) {
                    fields[attr] = parsedValue;
                } else if (!rawValue) {
                    fields[attr] = null;
                }
            }
        });

        return fields;
    }

    /**
     * Parse field value based on data type.
     * @private
     * @param {HTMLElement} valueInput - Value input element
     * @param {string} rawValue - Raw string value
     * @returns {any|undefined} - Parsed value or undefined if invalid
     */
    _parseFieldValue(valueInput, rawValue) {
        const dataType = valueInput?.dataset?.type || 'text';

        const parsers = {
            image: () => this._parseImageValue(valueInput, rawValue),
            file: () => undefined,
            boolean: () => this._parseBooleanValue(rawValue),
            optionset: () => this._parseIntegerValue(rawValue),
            integer: () => this._parseIntegerValue(rawValue),
            multiselectpicklist: () => this._parseMultiselectValue(valueInput, rawValue),
            decimal: () => this._parseDecimalValue(rawValue),
            date: () => this._parseDateValue(rawValue),
            datetime: () => this._parseDateTimeValue(rawValue),
            lookup: () => this._parseLookupValue(rawValue)
        };

        const parser = parsers[dataType];
        return parser ? parser() : this._parseDefaultValue(rawValue);
    }

    /**
     * Parse image value.
     * @private
     */
    _parseImageValue(valueInput, rawValue) {
        if (valueInput?.classList?.contains('pdt-file-upload-container')) {
            const fileData = valueInput._fileData;
            if (fileData) {
                return fileData;
            }
            const manualInput = valueInput.querySelector('.pdt-file-data');
            return manualInput?.value?.trim() || undefined;
        }
        return rawValue.trim() || undefined;
    }

    /**
     * Parse boolean value.
     * @private
     */
    _parseBooleanValue(rawValue) {
        const boolValue = rawValue === 'true' ? true : rawValue === 'false' ? false : null;
        return boolValue !== null ? boolValue : undefined;
    }

    /**
     * Parse integer value.
     * @private
     */
    _parseIntegerValue(rawValue) {
        const intValue = parseInt(rawValue, 10);
        return !isNaN(intValue) ? intValue : undefined;
    }

    /**
     * Parse multiselect picklist value.
     * @private
     */
    _parseMultiselectValue(valueInput, rawValue) {
        if (valueInput?.classList?.contains('pdt-multiselect-dropdown')) {
            const checkboxes = valueInput.querySelectorAll('.pdt-multiselect-option input[type="checkbox"]:checked');
            const selectedValues = Array.from(checkboxes).map(cb => parseInt(cb.value, 10));
            return selectedValues.length > 0 ? selectedValues.join(',') : undefined;
        }
        return rawValue.trim() || undefined;
    }

    /**
     * Parse decimal value.
     * @private
     */
    _parseDecimalValue(rawValue) {
        const floatValue = parseFloat(rawValue);
        return !isNaN(floatValue) ? floatValue : undefined;
    }

    /**
     * Parse date value.
     * @private
     */
    _parseDateValue(rawValue) {
        const date = new Date(rawValue);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
        return undefined;
    }

    /**
     * Parse datetime value.
     * @private
     */
    _parseDateTimeValue(rawValue) {
        const date = new Date(rawValue);
        return !isNaN(date.getTime()) ? date.toISOString() : undefined;
    }

    /**
     * Parse lookup value.
     * @private
     */
    _parseLookupValue(rawValue) {
        return (rawValue.includes('(') && rawValue.includes(')')) ? rawValue : undefined;
    }

    /**
     * Parse default value (text/memo).
     * @private
     */
    _parseDefaultValue(rawValue) {
        try {
            return JSON.parse(rawValue);
        } catch {
            return rawValue;
        }
    }

    /**
     * Populate field builder from JSON object.
     * @private
     * @param {Object} obj - JSON object to convert to field rows
     * @param {string} method - The method ('POST' or 'PATCH')
     * @returns {Promise<void>}
     * @async
     */
    async _populateFieldsFromJson(obj, method = 'POST') {
        const container = method === 'POST' ? this.ui.postFieldsContainer : this.ui.patchFieldsContainer;
        if (!container) {
            return;
        }

        container.innerHTML = '';

        const { entityContext, attributes } = await this._fetchEntityMetadataForJson(method);

        let isFirst = true;
        for (const [key, value] of Object.entries(obj)) {
            await this._populateFieldRow(key, value, method, isFirst, entityContext, attributes);
            isFirst = false;
        }

        if (container.children.length === 0) {
            this._addFieldUI(true, method);
        }
    }

    /**
     * Fetch entity metadata for JSON to field builder conversion.
     * @private
     * @param {string} method - The method ('POST' or 'PATCH')
     * @returns {Promise<{entityContext: Object|null, attributes: Array|null}>}
     * @async
     */
    async _fetchEntityMetadataForJson(method) {
        const entityInput = method === 'POST' ? this.ui.postEntityInput : this.ui.patchEntityInput;
        let entityContext = null;
        let attributes = null;

        try {
            entityContext = await this._ensureEntityContext(entityInput.value);
            attributes = await DataService.getAttributeDefinitions(entityContext.logicalName);
        } catch (_error) {
            // Silently fail - fields will render without auto-detection
        }

        return { entityContext, attributes };
    }

    /**
     * Populate a single field row in the field builder.
     * @private
     * @param {string} key - Field attribute name
     * @param {any} value - Field value
     * @param {string} method - The method ('POST' or 'PATCH')
     * @param {boolean} isFirst - Whether this is the first row
     * @param {Object|null} entityContext - Entity context object
     * @param {Array|null} attributes - Entity attributes metadata
     * @returns {Promise<void>}
     * @async
     */
    async _populateFieldRow(key, value, method, isFirst, entityContext, attributes) {
        const container = method === 'POST' ? this.ui.postFieldsContainer : this.ui.patchFieldsContainer;
        this._addFieldUI(isFirst, method);

        const lastRow = container.lastElementChild;
        if (!lastRow) {
            return;
        }

        const attrInput = lastRow.querySelector('[data-prop="field-attribute"]');
        if (attrInput) {
            attrInput.value = key;
        }

        if (attributes && entityContext) {
            await this._populateFieldRowWithMetadata(lastRow, key, value, entityContext, attributes);
        } else {
            this._setFieldValueFallback(lastRow, value);
        }
    }

    /**
     * Populate field row with metadata-driven auto-detection.
     * @private
     * @param {HTMLElement} row - The field row element
     * @param {string} key - Field attribute name
     * @param {any} value - Field value
     * @param {Object} entityContext - Entity context object
     * @param {Array} attributes - Entity attributes metadata
     * @returns {Promise<void>}
     * @async
     */
    async _populateFieldRowWithMetadata(row, key, value, entityContext, attributes) {
        const cleanKey = key.replace(/@odata\.bind$/i, '');
        const attr = attributes.find(a => a.LogicalName.toLowerCase() === cleanKey.toLowerCase());

        if (attr) {
            row._attrMetadata = attr;
            await this._renderValueInput(row, attr, entityContext.logicalName);
            this._setFieldValueByType(row, value);
        } else {
            this._setFieldValueFallback(row, value);
        }
    }

    /**
     * Set field value based on input type (select, multiselect, text).
     * @private
     * @param {HTMLElement} row - The field row element
     * @param {any} value - Field value
     */
    _setFieldValueByType(row, value) {
        const valueInput = row.querySelector('[data-prop="field-value"]');
        if (!valueInput) {
            return;
        }

        if (value === null) {
            valueInput.value = '';
        } else if (valueInput.classList.contains('pdt-multiselect-dropdown')) {
            this._setMultiselectValue(valueInput, value);
        } else if (valueInput.tagName === 'SELECT') {
            valueInput.value = String(value);
        } else if (typeof value === 'object') {
            valueInput.value = JSON.stringify(value);
        } else {
            valueInput.value = String(value);
        }

        const changeEvent = new Event('change', { bubbles: true });
        valueInput.dispatchEvent(changeEvent);
    }

    /**
     * Set field value as fallback when no metadata is available.
     * @private
     * @param {HTMLElement} row - The field row element
     * @param {any} value - Field value
     */
    _setFieldValueFallback(row, value) {
        const valueInput = row.querySelector('[data-prop="field-value"]');
        if (!valueInput) {
            return;
        }

        if (value === null) {
            valueInput.value = '';
        } else {
            valueInput.value = typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
    }

    /**
     * Set value for multiselect dropdown component.
     * @private
     * @param {HTMLElement} multiselectDiv - The multiselect dropdown container
     * @param {any} value - The value to set (can be string, number, or array)
     */
    _setMultiselectValue(multiselectDiv, value) {
        if (!multiselectDiv) {
            return;
        }

        // Parse the value into an array of numbers
        let valuesToSelect = [];
        if (Array.isArray(value)) {
            valuesToSelect = value.map(v => String(v));
        } else if (typeof value === 'string') {
            // Handle comma-separated string or single value
            valuesToSelect = value.split(',').map(v => v.trim());
        } else if (typeof value === 'number') {
            valuesToSelect = [String(value)];
        } else {
            valuesToSelect = [String(value)];
        }

        // Find all checkboxes and check the ones matching our values
        const checkboxes = multiselectDiv.querySelectorAll('input[type="checkbox"]');
        let checkedCount = 0;
        const checkedLabels = [];

        checkboxes.forEach(checkbox => {
            const checkboxValue = checkbox.value;
            if (valuesToSelect.includes(checkboxValue)) {
                checkbox.checked = true;
                checkedCount++;
                checkedLabels.push(checkbox.dataset.label || checkboxValue);
            }
        });

        // Update the display text
        const textDisplay = multiselectDiv.querySelector('.pdt-multiselect-text');
        if (textDisplay) {
            if (checkedCount === 0) {
                textDisplay.textContent = '-- Select options --';
            } else if (checkedCount === 1) {
                textDisplay.textContent = checkedLabels[0];
            } else {
                textDisplay.textContent = `${checkedCount} options selected`;
            }
        }
    }

    /**
     * Populate required fields for POST operations.
     * Fetches entity metadata and adds required attributes to field builder or JSON mode.
     * @private
     * @param {string} logicalName - Entity logical name
     * @returns {Promise<void>}
     */
    async _populateRequiredFields(logicalName) {
        if (!logicalName) {
            return;
        }

        try {
            const [attributes, navPropMap] = await Promise.all([
                DataService.getAttributeDefinitions(logicalName),
                DataService.getNavigationPropertyMap(logicalName)
            ]);

            if (!attributes || attributes.length === 0) {
                return;
            }

            const requiredAttrs = this._filterRequiredAttributes(attributes);

            if (requiredAttrs.length === 0) {
                NotificationService.show(Config.MESSAGES.WEB_API.noRequiredFields, 'info');
                return;
            }

            const method = this.ui.methodSelect?.value;
            const bodyModeToggle = method === 'POST' ? this.ui.postBodyModeToggle : this.ui.patchBodyModeToggle;
            const isJsonMode = bodyModeToggle?.checked;

            if (isJsonMode) {
                await this._populateRequiredFieldsJsonMode(requiredAttrs, navPropMap);
            } else {
                await this._populateRequiredFieldsBuilderMode(requiredAttrs, navPropMap, logicalName);
            }

            NotificationService.show(Config.MESSAGES.WEB_API.requiredFieldsPopulated(requiredAttrs.length), 'success');
            this._updatePreview();

        } catch (error) {
            NotificationService.show(
                Config.MESSAGES.WEB_API.requiredFieldsLoadFailed(ErrorParser.extract(error)),
                'warning'
            );
        }
    }

    /**
     * Filter to required, creatable attributes only.
     * @private
     * @param {Array<Object>} attributes - Entity attributes
     * @returns {Array<Object>} - Required attributes
     */
    _filterRequiredAttributes(attributes) {
        return attributes.filter(attr => {
            const reqLevel = attr.RequiredLevel?.Value || attr.Requiredlevel?.Value || 'None';
            const isRequired = reqLevel === 'ApplicationRequired' || reqLevel === 'SystemRequired';
            const isValidForCreate = attr.IsValidForCreate !== false;
            const isPrimaryKey = attr.IsPrimaryId === true;
            const isLogicalField = attr.AttributeType === 'Virtual' || attr.AttributeTypeName?.Value === 'VirtualType';

            // Exclude polymorphic lookup type fields (e.g., owneridtype, customeridtype)
            const attrName = (attr.LogicalName || attr.Logicalname || '').toLowerCase();
            const isPolymorphicTypeField = attrName.endsWith('type') &&
                (attr.AttributeType === 'EntityName' || attr.AttributeTypeName?.Value === 'EntityNameType');

            return isRequired && isValidForCreate && !isPrimaryKey && !isLogicalField && !isPolymorphicTypeField;
        });
    }

    /**
     * Populate required fields in JSON mode.
     * @private
     * @param {Array<Object>} requiredAttrs - Required attributes
     * @param {Map} navPropMap - Navigation property map
     */
    async _populateRequiredFieldsJsonMode(requiredAttrs, navPropMap) {
        const template = {};
        for (const attr of requiredAttrs) {
            const attrName = (attr.LogicalName || attr.Logicalname || '').toLowerCase();
            const attrType = (attr.AttributeType || attr.Attributetype || attr.AttributeTypeName?.Value || '').toLowerCase();

            const isLookup = SmartValueInput.LOOKUP_TYPES.includes(attrType);
            let fieldName;
            if (isLookup) {
                const navPropName = navPropMap.get(attrName) || attrName;
                fieldName = `${navPropName}@odata.bind`;
            } else {
                fieldName = attrName;
            }

            template[fieldName] = await this._getPlaceholderForType(attrType, attr);
        }
        if (this.ui.postBodyArea) {
            this.ui.postBodyArea.value = JSON.stringify(template, null, 2);
        }
    }

    /**
     * Populate required fields in field builder mode.
     * @private
     * @param {Array<Object>} requiredAttrs - Required attributes
     * @param {Map} navPropMap - Navigation property map
     * @param {string} logicalName - Entity logical name
     */
    async _populateRequiredFieldsBuilderMode(requiredAttrs, navPropMap, logicalName) {
        if (!this.ui.postFieldsContainer) {
            return;
        }
        this.ui.postFieldsContainer.innerHTML = '';

        let isFirst = true;
        for (const attr of requiredAttrs) {
            this._addFieldUI(isFirst, 'POST');
            isFirst = false;

            const lastRow = this.ui.postFieldsContainer.lastElementChild;
            if (lastRow) {
                const attrInput = lastRow.querySelector('[data-prop="field-attribute"]');
                const attrName = (attr.LogicalName || attr.Logicalname || '').toLowerCase();
                const attrType = (attr.AttributeType || attr.Attributetype || attr.AttributeTypeName?.Value || '').toLowerCase();

                const isLookup = SmartValueInput.LOOKUP_TYPES.includes(attrType);
                let fieldName;
                if (isLookup) {
                    const navPropName = navPropMap.get(attrName) || attrName;
                    fieldName = `${navPropName}@odata.bind`;
                } else {
                    fieldName = attrName;
                }

                if (attrInput) {
                    attrInput.value = fieldName;
                }

                await this._renderValueInput(lastRow, attr, logicalName);

                if (lastRow._updateRemoveButtonState) {
                    lastRow._updateRemoveButtonState();
                }
            }
        }
    }

    /**
     * Get placeholder value for attribute type.
     * @private
     * @param {string} attrType - Attribute type
     * @param {Object} attr - Attribute metadata
     * @returns {Promise<string|number|boolean|null>} - Placeholder value
     */
    async _getPlaceholderForType(attrType, attr) {
        const type = (attrType || '').toLowerCase();

        // Lookup types require async resolution
        if (['lookup', 'lookuptype', 'customer', 'customertype', 'owner', 'ownertype'].includes(type)) {
            const result = await this._getLookupPlaceholderValue(attr);
            return result;
        }

        // Simple type mappings
        const typeMap = {
            'string': '', 'memo': '', 'stringtype': '', 'memotype': '',
            'integer': 0, 'bigint': 0, 'integertype': 0, 'biginttype': 0,
            'decimal': 0.0, 'double': 0.0, 'money': 0.0, 'decimaltype': 0.0, 'doubletype': 0.0, 'moneytype': 0.0,
            'boolean': false, 'booleantype': false,
            'datetime': new Date().toISOString(), 'datetimetype': new Date().toISOString(),
            'picklist': 1, 'picklisttype': 1, 'state': 1, 'statetype': 1, 'status': 1, 'statustype': 1,
            'uniqueidentifier': '00000000-0000-0000-0000-000000000000',
            'uniqueidentifiertype': '00000000-0000-0000-0000-000000000000'
        };

        return typeMap[type] ?? null;
    }

    /**
     * Get placeholder value for lookup fields.
     * @private
     * @param {Object} attr - Attribute metadata
     * @returns {Promise<string>} - OData bind reference
     */
    async _getLookupPlaceholderValue(attr) {
        const targets = attr.Targets || attr.targets || [];
        const targetEntity = targets[0] || 'systemuser';
        try {
            const { EntitySetName } = await DataService.retrieveEntityDefinition(targetEntity);
            const entitySetName = EntitySetName || targetEntity + 's';
            return `/${entitySetName}(00000000-0000-0000-0000-000000000000)`;
        } catch {
            return `/${targetEntity}s(00000000-0000-0000-0000-000000000000)`;
        }
    }

    /**
     * Extract file upload fields from field builder (file-type only, not images).
     * @private
     * @returns {Array<{attributeName: string, fileData: string, fileName: string, mimeType: string}>} - Array of file upload metadata
     */
    _extractFileUploads() {
        const fileUploads = [];
        const method = this.ui.methodSelect?.value;
        const bodyModeToggle = method === 'POST' ? this.ui.postBodyModeToggle : this.ui.patchBodyModeToggle;
        const fieldsContainer = method === 'POST' ? this.ui.postFieldsContainer : this.ui.patchFieldsContainer;
        const isJsonMode = bodyModeToggle?.checked;

        if (isJsonMode) {
            return fileUploads;
        }

        const rows = [...fieldsContainer.querySelectorAll('.pdt-field-grid')];

        rows.forEach(row => {
            const attr = row.querySelector('[data-prop="field-attribute"]')?.value.trim();
            const valueContainer = row.querySelector('[data-prop="field-value"]');

            if (valueContainer?.classList?.contains('pdt-file-upload-container') &&
                valueContainer?.dataset?.type === 'file') {
                const fileData = valueContainer._fileData;
                const fileName = valueContainer._fileName;
                const mimeType = valueContainer._mimeType;

                if (attr && fileData && fileName && mimeType) {
                    fileUploads.push({
                        attributeName: attr,
                        fileData,
                        fileName,
                        mimeType
                    });
                }
            }
        });

        return fileUploads;
    }

    /**
     * Get request body from either field builder or JSON mode.
     * Includes image-type columns directly, excludes file-type columns which are uploaded separately.
     * @private
     * @returns {Object} - Request body object
     * @throws {Error} - If JSON is invalid or no fields provided
     */
    _getRequestBody() {
        const method = this.ui.methodSelect?.value;
        const bodyModeToggle = method === 'POST' ? this.ui.postBodyModeToggle : this.ui.patchBodyModeToggle;
        const bodyArea = method === 'POST' ? this.ui.postBodyArea : this.ui.patchBodyArea;
        const isJsonMode = bodyModeToggle?.checked;

        if (isJsonMode) {
            // JSON mode: parse and validate JSON
            return ValidationService.validateJson(bodyArea.value || '{}', 'Request body');
        }
        const fields = this._getFieldsFromBuilder(method);
        const fileUploads = this._extractFileUploads();
        fileUploads.forEach(upload => {
            delete fields[upload.attributeName];
        });

        if (Object.keys(fields).length === 0 && fileUploads.length === 0) {
            throw new Error(Config.MESSAGES.WEB_API.noFieldsProvided);
        }
        return fields;

    }

    /**
     * Upload files to a record using Dataverse file upload API.
     * @private
     * @param {string} entityLogicalName - Entity logical name
     * @param {string} entityId - Record ID
     * @param {Array<{attributeName: string, fileData: string, fileName: string, mimeType: string}>} fileUploads - Array of file upload metadata
     * @returns {Promise<void>}
     */
    async _uploadFiles(entityLogicalName, entityId, fileUploads) {
        if (!fileUploads || fileUploads.length === 0) {
            return;
        }

        try {
            for (const upload of fileUploads) {
                await FileUploadService.uploadFile(
                    entityLogicalName,
                    entityId,
                    upload.attributeName,
                    upload.fileData,
                    upload.fileName,
                    upload.mimeType
                );
            }
        } catch (error) {
            NotificationService.show(
                `File upload failed: ${ErrorParser.extract(error)}`,
                'warning'
            );
        }
    }

    /**
     * Execute bulk PATCH operation: fetch records matching conditions, then update each.
     * Uses Dataverse $batch API for maximum performance - processes up to 1000 records per request.
     * @private
     * @returns {Promise<void>}
     */
    async _executeBulkPatch() {
        try {
            const { entitySet, logicalName } = await this._ensureEntityContext(this.ui.patchEntityInput.value);

            const body = this._getRequestBody();
            const filterGroups = this.patchFilterManager.extractFilterGroups(this.ui.patchFiltersContainer);

            if (filterGroups.length === 0) {
                NotificationService.show(Config.MESSAGES.WEB_API.noRecordsMatched, 'warning');
                return;
            }

            if (!this.attrMap) {
                this.attrMap = await EntityContextResolver.getAttrMap(logicalName);
            }

            const metadata = await PowerAppsApiService.getEntityMetadata(logicalName);
            const primaryKey = metadata.PrimaryIdAttribute;
            const fieldsToSelect = [primaryKey, ...Object.keys(body)].filter((v, i, a) => a.indexOf(v) === i);
            const records = await this._fetchMatchingRecords(entitySet, filterGroups, fieldsToSelect);

            if (records.length === 0) {
                NotificationService.show(Config.MESSAGES.WEB_API.noRecordsMatched, 'warning');
                return;
            }

            // Confirm bulk update
            const confirmed = await showConfirmDialog(
                Config.MESSAGES.WEB_API.confirmBulkUpdate,
                `<p>${Config.MESSAGES.WEB_API.bulkUpdateConfirm(records.length)}</p>`
            );

            if (!confirmed) {
                NotificationService.show(Config.MESSAGES.WEB_API.bulkOperationCancelled, 'info');
                return;
            }

            BusyIndicator.set(this.ui.executeBtn, this.ui.resultRoot, Config.MESSAGES.WEB_API.bulkUpdateProgress(0, records.length));

            const BATCH_SIZE = Config.DATAVERSE_BATCH.MAX_BATCH_SIZE;
            const allOperations = records.map(record => ({
                method: 'PATCH',
                entitySet,
                id: record[primaryKey],
                data: body
            }));

            const { successCount: totalSuccessCount, failCount: totalFailCount, errors: allErrors } =
                await this._processBatchOperations(allOperations, BATCH_SIZE, (processed, total) => {
                    BusyIndicator.set(this.ui.executeBtn, this.ui.resultRoot,
                        Config.MESSAGES.WEB_API.bulkUpdateProgress(processed, total));
                });

            // Show results
            if (totalFailCount === 0) {
                NotificationService.show(Config.MESSAGES.WEB_API.bulkUpdateSuccess(totalSuccessCount), 'success');
            } else {
                NotificationService.show(Config.MESSAGES.WEB_API.bulkUpdateFailed(totalSuccessCount, totalFailCount, records.length), 'warning');
            }

            // Display summary in results with error details
            this.lastResult = {
                entities: this._formatBulkOperationResult('Bulk Update', records.length, totalSuccessCount, totalFailCount, allErrors)
            };
            this.resultSortState = { column: null, direction: 'asc' };

            if (this.ui.resultRoot.style.display === 'none') {
                this.ui.resultRoot.style.display = '';
            }

            this._displayResult();
            this.ui.resultRoot?.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (error) {
            const friendly = ErrorParser.extract(error);
            NotificationService.show(friendly, 'error');
        } finally {
            if (this.ui.executeBtn) {
                BusyIndicator.clear(this.ui.executeBtn);
            }
        }
    }

    /**
     * Shows a dialog to configure bulk touch operation.
     * @param {string} logicalName - Entity logical name
     * @param {Object} metadata - Entity metadata
     * @returns {Promise<Array<{field: string, useCustomValue: boolean, customValue: any}>|null>} Touch configurations or null if cancelled
     * @private
     */
    _showTouchConfigDialog(logicalName, metadata) {
        const primaryNameAttr = metadata.PrimaryNameAttribute || 'name';

        return new Promise((resolve) => {
            const overlay = this._createTouchDialogOverlay(primaryNameAttr);
            document.body.appendChild(overlay);

            const fieldsContainer = overlay.querySelector('#touch-fields-container');
            const addFieldBtn = overlay.querySelector('#touch-add-field-btn');
            const confirmBtn = overlay.querySelector('#touch-confirm-btn');
            const cancelBtn = overlay.querySelector('#touch-cancel-btn');

            this._addTouchFieldRow(logicalName, fieldsContainer, primaryNameAttr, 'current', '', true);

            addFieldBtn.addEventListener('click', () => {
                this._addTouchFieldRow(logicalName, fieldsContainer, '', 'current', '', false);
            });

            confirmBtn.addEventListener('click', () => {
                this._handleTouchDialogConfirm(fieldsContainer, overlay, resolve);
            });

            this._bindTouchDialogCancelHandlers(overlay, cancelBtn, resolve);

            const focusDelay = Config.TOUCH_DIALOG?.focusDelay || 100;
            setTimeout(() => {
                const firstInput = overlay.querySelector('.field-name-input');
                if (firstInput) {
                    firstInput.select();
                }
            }, focusDelay);
        });
    }

    /**
     * Create the touch dialog overlay structure.
     * @private
     * @param {string} primaryNameAttr - Primary name attribute
     * @returns {HTMLElement} - Dialog overlay element
     */
    _createTouchDialogOverlay(primaryNameAttr) {
        const overlay = document.createElement('div');
        overlay.id = 'pdt-touch-config-dialog';
        overlay.className = 'pdt-dialog-overlay';

        if (Store.getState().theme === 'light') {
            overlay.classList.add('light-mode');
        }

        overlay.innerHTML = `
            <div class="pdt-dialog pdt-dialog-large">
                <div class="pdt-dialog-header">
                    <h3>${Config.MESSAGES.WEB_API.touchDialogTitle}</h3>
                </div>
                <div class="pdt-dialog-body">
                    <div class="pdt-note mb-15">
                        <p>${Config.MESSAGES.WEB_API.touchDialogInstructions}</p>
                        <p class="mt-5">${Config.MESSAGES.WEB_API.touchDialogTip(escapeHtml(primaryNameAttr))}</p>
                    </div>

                    <div id="touch-fields-container"></div>

                    <div class="pdt-toolbar pdt-touch-add-toolbar">
                        <button id="touch-add-field-btn" class="modern-button secondary">
                            ${Config.MESSAGES.WEB_API.touchDialogAddButton}
                        </button>
                    </div>
                </div>
                <div class="pdt-dialog-footer">
                    <button id="touch-confirm-btn" class="modern-button primary">${Config.MESSAGES.WEB_API.touchDialogConfirmButton}</button>
                    <button id="touch-cancel-btn" class="modern-button secondary">${Config.MESSAGES.WEB_API.touchDialogCancelButton}</button>
                </div>
            </div>
        `;
        return overlay;
    }

    /**
     * Add a field row to the touch configuration dialog.
     * @private
     * @param {string} logicalName - Entity logical name
     * @param {HTMLElement} fieldsContainer - Container for field rows
     * @param {string} fieldName - Initial field name
     * @param {string} valueMode - Initial value mode ('current' or 'custom')
     * @param {string} customValue - Initial custom value
     * @param {boolean} isFirst - Whether this is the first row (cannot be removed)
     */
    _addTouchFieldRow(logicalName, fieldsContainer, fieldName = '', valueMode = 'current', customValue = '', isFirst = false) {
        const rowId = `touch-row-${Date.now()}-${Math.random()}`;
        const row = this._createTouchFieldRowHTML(fieldsContainer, rowId, fieldName, valueMode, customValue, isFirst);
        fieldsContainer.appendChild(row);
        this._bindTouchFieldRowHandlers(logicalName, fieldsContainer, row, rowId, isFirst);
    }

    /**
     * Create the HTML structure for a touch field row.
     * @private
     * @param {HTMLElement} fieldsContainer - Container for field rows
     * @param {string} rowId - Unique row ID
     * @param {string} fieldName - Field name
     * @param {string} valueMode - Value mode ('current' or 'custom')
     * @param {string} customValue - Custom value
     * @param {boolean} isFirst - Whether this is the first row
     * @returns {HTMLElement} - Field row element
     */
    _createTouchFieldRowHTML(fieldsContainer, rowId, fieldName, valueMode, customValue, isFirst) {
        const row = document.createElement('div');
        row.className = 'pdt-builder-group mb-15';
        row.dataset.rowId = rowId;
        row.innerHTML = `
            <div class="pdt-section-header">
                ${Config.MESSAGES.WEB_API.touchDialogFieldLabel(fieldsContainer.children.length + 1)}
                ${!isFirst ? `<button class="modern-button secondary pdt-touch-remove-btn" title="${Config.MESSAGES.WEB_API.touchDialogRemoveButton}">${Config.MESSAGES.WEB_API.touchDialogRemoveButton}</button>` : ''}
            </div>
            <div class="pdt-builder-content">
                <div class="pdt-form-row">
                    <label class="pdt-label">${Config.MESSAGES.WEB_API.touchDialogColumnLabel}</label>
                    <div class="flex-1 gap-10">
                        <input type="text" class="pdt-input field-name-input flex-1" value="${escapeHtml(fieldName)}" placeholder="${Config.MESSAGES.WEB_API.touchDialogPlaceholder}">
                        <button class="pdt-input-btn browse-field-btn" title="${Config.MESSAGES.WEB_API.touchDialogBrowseTitle}">${ICONS.inspector}</button>
                    </div>
                </div>
                <div class="pdt-form-row mt-10">
                    <label class="pdt-label">${Config.MESSAGES.WEB_API.touchDialogValueModeLabel}</label>
                    <div class="flex-1">
                        <label class="pdt-radio-label">
                            <input type="radio" name="value-mode-${rowId}" value="current" ${valueMode === 'current' ? 'checked' : ''}>
                            <span>${Config.MESSAGES.WEB_API.touchDialogKeepValue}</span>
                        </label>
                        <label class="pdt-radio-label mt-5">
                            <input type="radio" name="value-mode-${rowId}" value="custom" ${valueMode === 'custom' ? 'checked' : ''}>
                            <span>${Config.MESSAGES.WEB_API.touchDialogSetValue}</span>
                        </label>
                        <input type="text" class="pdt-input custom-value-input mt-5" value="${escapeHtml(customValue)}" placeholder="${Config.MESSAGES.WEB_API.touchDialogCustomPlaceholder}" ${valueMode === 'current' ? 'disabled' : ''}>
                    </div>
                </div>
            </div>
        `;
        return row;
    }

    /**
     * Bind event handlers for a touch field row.
     * @private
     * @param {string} logicalName - Entity logical name
     * @param {HTMLElement} fieldsContainer - Container for field rows
     * @param {HTMLElement} row - Field row element
     * @param {string} rowId - Unique row ID
     * @param {boolean} isFirst - Whether this is the first row
     */
    _bindTouchFieldRowHandlers(logicalName, fieldsContainer, row, rowId, isFirst) {
        const fieldInput = row.querySelector('.field-name-input');
        const customValueInput = row.querySelector('.custom-value-input');
        const browseBtn = row.querySelector('.browse-field-btn');
        const radioButtons = row.querySelectorAll(`input[name="value-mode-${rowId}"]`);
        const removeBtn = row.querySelector('.pdt-touch-remove-btn');

        // Handle radio button changes
        radioButtons.forEach(radio => {
            radio.addEventListener('change', () => {
                customValueInput.disabled = radio.value !== 'custom';
                if (radio.value === 'custom') {
                    customValueInput.focus();
                }
            });
        });

        browseBtn.addEventListener('click', () => {
            this._handleTouchFieldBrowse(logicalName, fieldInput);
        });

        if (removeBtn && !isFirst) {
            removeBtn.addEventListener('click', () => {
                this._handleTouchFieldRemove(fieldsContainer, row);
            });
        }
    }

    /**
     * Handle browse button click for touch field row.
     * @private
     * @param {string} logicalName - Entity logical name
     * @param {HTMLElement} fieldInput - Field input element
     */
    _handleTouchFieldBrowse(logicalName, fieldInput) {
        try {
            showColumnBrowser(
                async () => {
                    await PowerAppsApiService.getEntityMetadata(logicalName);
                    return logicalName;
                },
                (attr) => {
                    fieldInput.value = attr.LogicalName;
                }
            );
        } catch (err) {
            NotificationService.show(err.message || Config.MESSAGES.WEB_API.touchDialogBrowseFailed, 'error');
        }
    }

    /**
     * Handle remove button click for touch field row.
     * @private
     * @param {HTMLElement} fieldsContainer - Container for field rows
     * @param {HTMLElement} row - Field row to remove
     */
    _handleTouchFieldRemove(fieldsContainer, row) {
        row.remove();
        Array.from(fieldsContainer.children).forEach((r, idx) => {
            const header = r.querySelector('.pdt-section-header');
            const fieldNum = header.childNodes[0];
            fieldNum.textContent = Config.MESSAGES.WEB_API.touchDialogFieldLabel(idx + 1);
        });
    }

    /**
     * Handle confirm button click for touch dialog.
     * @private
     * @param {HTMLElement} fieldsContainer - Container for field rows
     * @param {HTMLElement} overlay - Dialog overlay element
     * @param {Function} resolve - Promise resolve function
     */
    _handleTouchDialogConfirm(fieldsContainer, overlay, resolve) {
        const rows = fieldsContainer.querySelectorAll('.pdt-builder-group');
        const fields = [];

        for (const row of rows) {
            const fieldInput = row.querySelector('.field-name-input');
            const field = fieldInput.value.trim();

            if (!field) {
                NotificationService.show(Config.MESSAGES.WEB_API.touchFieldNameRequired, 'warning');
                fieldInput.focus();
                return;
            }

            const rowId = row.dataset.rowId;
            const selectedMode = row.querySelector(`input[name="value-mode-${rowId}"]:checked`).value;
            const useCustomValue = selectedMode === 'custom';
            const customValueInput = row.querySelector('.custom-value-input');
            const customValue = useCustomValue ? customValueInput.value : null;

            if (useCustomValue && !customValue) {
                NotificationService.show(Config.MESSAGES.WEB_API.touchCustomValueRequired, 'warning');
                customValueInput.focus();
                return;
            }

            fields.push({
                field,
                useCustomValue,
                customValue
            });
        }

        if (fields.length === 0) {
            NotificationService.show(Config.MESSAGES.WEB_API.touchNoFieldsConfigured, 'warning');
            return;
        }

        overlay.remove();
        resolve(fields);
    }

    /**
     * Bind cancel handlers for touch dialog (button, overlay click, ESC key).
     * @private
     * @param {HTMLElement} overlay - Dialog overlay element
     * @param {HTMLElement} cancelBtn - Cancel button element
     * @param {Function} resolve - Promise resolve function
     */
    /* eslint-disable no-use-before-define */
    _bindTouchDialogCancelHandlers(overlay, cancelBtn, resolve) {
        let cleaned = false;

        const handleCancel = () => {
            if (cleaned) {
                return;
            }
            cleaned = true;
            document.removeEventListener('keydown', handleEsc);
            overlay.removeEventListener('click', handleOverlayClick);
            cancelBtn.removeEventListener('click', handleCancel);
            overlay.remove();
            resolve(null);
        };

        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            }
        };

        const handleOverlayClick = (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        };

        cancelBtn.addEventListener('click', handleCancel);
        overlay.addEventListener('click', handleOverlayClick);
        document.addEventListener('keydown', handleEsc);
    }
    /* eslint-enable no-use-before-define */

    /**
     * Handle bulk touch operation for selected records.
     * @param {Array} records - Array of records to touch
     * @private
     */
    async _handleBulkTouch(records) {
        if (!records || records.length === 0) {
            NotificationService.show(Config.MESSAGES.WEB_API.noRecordsSelected, 'warning');
            return;
        }

        try {
            const entityInput = this._getEntityInputForMethod();
            const { entitySet, logicalName } = await this._ensureEntityContext(entityInput);
            const metadata = await PowerAppsApiService.getEntityMetadata(logicalName);
            const primaryKey = metadata.PrimaryIdAttribute;

            const touchConfig = await this._showTouchConfigDialog(logicalName, metadata);
            if (!touchConfig || touchConfig.length === 0) {
                NotificationService.show(Config.MESSAGES.WEB_API.bulkOperationCancelled, 'info');
                return;
            }

            BusyIndicator.set(this.ui.executeBtn, this.ui.resultRoot,
                Config.MESSAGES.WEB_API.bulkTouchProgress(0, records.length));

            const { allOperations, totalFailCount, allErrors } =
                this._prepareTouchOperations(records, primaryKey, touchConfig, entitySet);

            const { successCount, failCount, errors } = await this._processBatchOperations(
                allOperations,
                1000,
                (processed, total) => {
                    BusyIndicator.set(this.ui.executeBtn, this.ui.resultRoot,
                        Config.MESSAGES.WEB_API.bulkTouchProgress(processed, total));
                }
            );

            const finalSuccessCount = successCount;
            const finalFailCount = totalFailCount + failCount;
            const finalErrors = [...allErrors, ...errors];

            await this._handleTouchResult(finalSuccessCount, finalFailCount, finalErrors);
        } catch (error) {
            NotificationService.show(ErrorParser.extract(error), 'error');
        } finally {
            BusyIndicator.clear(this.ui.executeBtn);
        }
    }

    /**
     * Get entity input for current method.
     * @private
     * @returns {string}
     */
    _getEntityInputForMethod() {
        const method = this.ui.methodSelect.value;
        const inputMap = {
            GET: this.ui.getEntityInput.value,
            POST: this.ui.postEntityInput.value,
            PATCH: this.ui.patchEntityInput.value,
            DELETE: this.ui.deleteEntityInput.value
        };
        return inputMap[method] || '';
    }

    /**
     * Prepare touch operations from records.
     * @private
     */
    _prepareTouchOperations(records, primaryKey, touchConfig, entitySet) {
        const allOperations = [];
        let totalFailCount = 0;
        const allErrors = [];

        for (const record of records) {
            const recordId = record[primaryKey];
            if (!recordId) {
                totalFailCount++;
                allErrors.push({ index: allOperations.length, error: Config.MESSAGES.WEB_API.noPrimaryKeyFound });
                continue;
            }

            const data = this._buildTouchData(record, touchConfig);
            allOperations.push({
                method: 'PATCH',
                entitySet,
                id: recordId,
                data
            });
        }

        return { allOperations, totalFailCount, allErrors };
    }

    /**
     * Build touch data object from config.
     * @private
     */
    _buildTouchData(record, touchConfig) {
        const data = {};
        for (const config of touchConfig) {
            let touchValue;
            if (config.useCustomValue) {
                touchValue = config.customValue;
            } else {
                touchValue = record[config.field] ?? record[config.field.toLowerCase()] ?? null;
            }
            data[config.field] = touchValue;
        }
        return data;
    }

    /**
     * Handle touch operation result.
     * @private
     */
    async _handleTouchResult(successCount, failCount, errors) {
        if (failCount === 0) {
            await this._reloadRecordsAfterTouch();
            NotificationService.show(Config.MESSAGES.WEB_API.bulkTouchSuccess(successCount), 'success');
        } else {
            this._displayTouchErrors(successCount, failCount, errors);
        }
    }

    /**
     * Reload records after successful touch.
     * @private
     */
    async _reloadRecordsAfterTouch() {
        try {
            BusyIndicator.set(this.ui.executeBtn, this.ui.resultRoot,
                Config.MESSAGES.WEB_API.reloadingRecords);

            const { entitySet: reloadEntitySet, logicalName: reloadLogicalName } =
                await this._ensureEntityContext(this.ui.getEntityInput.value);
            const options = await this._buildGetOptionsString(reloadLogicalName);
            const res = await DataService.retrieveMultipleRecords(reloadEntitySet, options);

            this.nextLink = res.nextLink || null;
            this.allLoadedRecords = res.entities || [];
            this.lastResult = normalizeApiResponse(res);

            if (this.resultPanel) {
                this.resultPanel._selectedIndices.clear();
            }
            this._displayResult();

            if (this.nextLink) {
                this._showPaginationBanner();
            }
        } catch (error) {
            NotificationService.show(
                Config.MESSAGES.WEB_API.reloadRecordsFailed(ErrorParser.extract(error)),
                'warning'
            );
        }
    }

    /**
     * Display touch operation errors.
     * @private
     */
    _displayTouchErrors(successCount, failCount, errors) {
        const total = successCount + failCount;
        const message = Config.MESSAGES.WEB_API.bulkTouchFailed(successCount, failCount, total);
        NotificationService.show(message, 'warning');

        this.lastResult = {
            entities: errors.map((e, idx) => ({
                'Record': idx + 1,
                'Error': e.error
            }))
        };
        this._displayResult();
    }

    /**
     * Execute bulk DELETE operation: fetch records matching conditions, then delete each.
     * Uses Dataverse $batch API
     * @private
     * @returns {Promise<void>}
     */
    async _executeBulkDelete() {
        try {
            const { entitySet, logicalName } = await this._ensureEntityContext(this.ui.deleteEntityInput.value);

            const filterGroups = this.deleteFilterManager.extractFilterGroups(this.ui.deleteFiltersContainer);

            if (filterGroups.length === 0) {
                NotificationService.show(Config.MESSAGES.WEB_API.noRecordsMatched, 'warning');
                return;
            }

            if (!this.attrMap) {
                this.attrMap = await EntityContextResolver.getAttrMap(logicalName);
            }

            const metadata = await PowerAppsApiService.getEntityMetadata(logicalName);
            const primaryKey = metadata.PrimaryIdAttribute;

            const records = await this._fetchMatchingRecords(entitySet, filterGroups, [primaryKey]);

            if (records.length === 0) {
                NotificationService.show(Config.MESSAGES.WEB_API.noRecordsMatched, 'warning');
                return;
            }

            const confirmed = await showConfirmDialog(
                Config.MESSAGES.WEB_API.confirmBulkDelete,
                `<p>${Config.MESSAGES.WEB_API.bulkDeleteConfirm(records.length)}</p><p class="pdt-text-error">This action cannot be undone!</p>`
            );

            if (!confirmed) {
                NotificationService.show(Config.MESSAGES.WEB_API.bulkOperationCancelled, 'info');
                return;
            }

            BusyIndicator.set(this.ui.executeBtn, this.ui.resultRoot, Config.MESSAGES.WEB_API.bulkDeleteProgress(0, records.length));

            const BATCH_SIZE = Config.DATAVERSE_BATCH.MAX_BATCH_SIZE;
            const allOperations = records.map(record => ({
                method: 'DELETE',
                entitySet,
                id: record[primaryKey]
            }));

            const { successCount: totalSuccessCount, failCount: totalFailCount, errors: allErrors } =
                await this._processBatchOperations(allOperations, BATCH_SIZE, (processed, total) => {
                    BusyIndicator.set(this.ui.executeBtn, this.ui.resultRoot,
                        Config.MESSAGES.WEB_API.bulkDeleteProgress(processed, total));
                });

            if (totalFailCount === 0) {
                NotificationService.show(Config.MESSAGES.WEB_API.bulkDeleteSuccess(totalSuccessCount), 'success');
            } else {
                NotificationService.show(Config.MESSAGES.WEB_API.bulkDeleteFailed(totalSuccessCount, totalFailCount, records.length), 'warning');
            }

            this.lastResult = {
                entities: this._formatBulkOperationResult('Bulk Delete', records.length, totalSuccessCount, totalFailCount, allErrors)
            };
            this.resultSortState = { column: null, direction: 'asc' };

            if (this.ui.resultRoot.style.display === 'none') {
                this.ui.resultRoot.style.display = '';
            }

            this._displayResult();
            this.ui.resultRoot?.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (error) {
            const friendly = ErrorParser.extract(error);
            NotificationService.show(friendly, 'error');
        } finally {
            if (this.ui.executeBtn) {
                BusyIndicator.clear(this.ui.executeBtn);
            }
        }
    }

    /**
     * Update the preview area with either the accurate GET URL (when possible),
     * or target info for other verbs. Mirrors FetchXmlTesterTab’s concise style.
     * @private
     * @returns {Promise<void>}
     */
    async _updatePreview() {
        const method = /** @type {HttpMethod} */ (this.ui.methodSelect.value);

        switch (method) {
            case 'GET':
                this.ui.preview.style.display = '';
                await this._updateGetPreview();
                break;
            case 'POST':
            case 'PATCH':
            case 'DELETE':
            default:
                // Hide preview for non-GET methods
                this.ui.preview.style.display = 'none';
                break;
        }
    }

    /**
     * Update preview for GET method.
     * @private
     * @returns {Promise<void>}
     */
    async _updateGetPreview() {
        const inputName = this.ui.getEntityInput.value.trim();

        if (!inputName) {
            this.ui.preview.innerHTML = this._buildMethodPreviewHtml('GET') +
                '<div class="pdt-preview-line"><strong>URL:</strong> <code>(table?)</code></div>';
            return;
        }

        try {
            const { entitySet, logicalName } = await EntityContextResolver.resolve(inputName);
            this.ui.getEntityInput.value = entitySet;
            this.selectedEntityLogicalName = logicalName;
            if (!this.attrMap) {
                this.attrMap = await EntityContextResolver.getAttrMap(logicalName);
            }
            const opts = await this._buildGetOptionsString(logicalName);
            this._setPreviewUrl(`${entitySet}${opts || ''}`);
        } catch {
            const opts = await this._buildGetOptionsStringFallback();
            this._setPreviewUrl(`${inputName}${opts || ''}`);
        }
    }

    /**
     * Update preview for POST method.
     * @private
     */
    _updatePostPreview() {
        const entity = this.ui.postEntityInput.value.trim() || '(table?)';
        const html = [
            '<div class="pdt-preview-line"><strong>Method:</strong> POST</div>',
            `<div class="pdt-preview-line"><strong>URL:</strong> <code>${escapeHtml(entity)}</code></div>`
        ].join('');
        this.ui.preview.innerHTML = html;
    }

    /**
     * Update preview for PATCH method.
     * @private
     */
    _updatePatchPreview() {
        const entity = this.ui.patchEntityInput.value.trim() || '(table?)';
        const recordId = this.ui.patchIdInput.value.trim() || '(id?)';
        const url = `${entity}(${recordId})`;
        const html = [
            '<div class="pdt-preview-line"><strong>Method:</strong> PATCH</div>',
            `<div class="pdt-preview-line"><strong>URL:</strong> <code>${escapeHtml(url)}</code></div>`
        ].join('');
        this.ui.preview.innerHTML = html;
    }

    /**
     * Update preview for DELETE method.
     * @private
     */
    _updateDeletePreview() {
        const entity = this.ui.deleteEntityInput.value.trim() || '(table?)';
        const recordId = this.ui.deleteIdInput.value.trim() || '(id?)';
        const url = `${entity}(${recordId})`;
        const html = [
            '<div class="pdt-preview-line"><strong>Method:</strong> DELETE</div>',
            `<div class="pdt-preview-line"><strong>URL:</strong> <code>${escapeHtml(url)}</code></div>`
        ].join('');
        this.ui.preview.innerHTML = html;
    }


    /**
     * Build the method line HTML for preview.
     * @private
     * @param {string} method - HTTP method name
     * @returns {string} HTML string for method line
     */
    _buildMethodPreviewHtml(method) {
        return `<div class="pdt-preview-line"><strong>Method:</strong> ${escapeHtml(method)}</div>`;
    }

    /**
     * Set the preview URL to an exact escaped string (for GET).
     * @private
     * @param {string} url
     */
    _setPreviewUrl(url) {
        const html = [
            '<div class="pdt-preview-line"><strong>Method:</strong> GET</div>',
            `<div class="pdt-preview-line"><strong>URL:</strong> <code>${escapeHtml(url)}</code></div>`
        ].join('');
        this.ui.preview.innerHTML = html;
    }

    /**
     * Fallback get-options (used only for preview when metadata not yet loaded).
     * @private
     * @returns {string}
     */
    _buildGetOptionsStringFallback() {
        const rawSelect = this.ui.getSelectInput.value.trim();
        const selectCols = rawSelect ? rawSelect.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];
        const top = this.ui.getTopInput.value.trim();
        const orderAttr = this.ui.getOrderByAttrInput.value.trim();
        const orderDir = this.ui.getOrderByDirSelect.value;

        // Build filter parts from filter groups
        const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
        const filterGroups = this.getFilterManager.extractFilterGroups(this.ui.getFiltersContainer);

        const groupExpressions = filterGroups.map(group => {
            const { filterType, filters } = group;
            const filterParts = filters.map(f => {
                const { attr: a, op: o, value: v } = f;
                if (!a || !o) {
                    return '';
                }
                if (o.includes('null')) {
                    return `${a} ${o}`;
                }
                if (['contains', 'startswith', 'endswith', 'not contains'].includes(o)) {
                    const fn = (o === 'not contains') ? 'contains' : o;
                    const expr = `${fn}(${a},${q(v)})`;
                    return o === 'not contains' ? `not ${expr}` : expr;
                }
                return `${a} ${o} ${formatODataValue(v)}`;
            }).filter(Boolean);

            if (filterParts.length === 0) {
                return '';
            }
            if (filterParts.length === 1) {
                return filterParts[0];
            }

            if (filterType === 'not') {
                return `not (${filterParts.join(' and ')})`;
            }
            return `(${filterParts.join(` ${filterType} `)})`;
        }).filter(Boolean);

        const params = [];
        if (selectCols.length) {
            params.push(`$select=${selectCols.join(',')}`);
        }
        if (groupExpressions.length) {
            params.push(`$filter=${groupExpressions.join(' and ')}`);
        }
        if (top) {
            params.push(`$top=${top}`);
        }
        if (orderAttr) {
            params.push(`$orderby=${orderAttr} ${orderDir}`);
        }

        return params.length ? `?${params.join('&')}` : '';
    }

    /**
     * Clear results UI and state (called on Refresh event).
     */
    clearResults() {
        this.lastResult = normalizeApiResponse(null);
        this.resultSortState = { column: null, direction: 'asc' };
        this.nextLink = null;
        this.allLoadedRecords = [];
        this._removePaginationBanner();

        // Reset POST and PATCH field builders
        if (this.ui.postFieldsContainer) {
            this.ui.postFieldsContainer.innerHTML = '';
            this._addFieldUI(true, 'POST');
        }
        if (this.ui.patchFieldsContainer) {
            this.ui.patchFieldsContainer.innerHTML = '';
            this._addFieldUI(true, 'PATCH');
        }

        try {
            this.resultPanel?.dispose?.();
        } catch (_error) {
            // Dispose may fail if already disposed, ignore
        }
        if (this.ui.resultRoot) {
            this.ui.resultRoot.textContent = '';
        }
        this.resultPanel = new ResultPanel({
            root: this.ui.resultRoot,
            onToggleView: (v) => {
                this.currentView = v; PreferencesHelper.save(Config.STORAGE_KEYS.webApiView, v); this._displayResult();
            },
            onToggleHide: (h) => {
                this.hideOdata = h; PreferencesHelper.save(Config.STORAGE_KEYS.webApiHideOdata, h, 'boolean'); this._displayResult();
            },
            getSortState: () => this.resultSortState,
            setSortState: (s) => {
                this.resultSortState = s;
            },
            onBulkTouch: (records) => this._handleBulkTouch(records),
            enableSelection: true,
            tableName: this.ui.getEntityInput?.value || ''
        });

        // draw empty
        this.resultPanel.renderShell(0, this.currentView, this.hideOdata);
        this.resultPanel.renderContent({ data: [], view: this.currentView, hideOdata: this.hideOdata });
    }

    /**
     * Toggle executing state: disables the Execute button and shows a lightweight
     * loading placeholder in the results area so users see that work is in progress.
     * @param {boolean} busy
     */
    _setExecuting(busy) {
        if (!this.ui.executeBtn) {
            return;
        }
        this.ui.executeBtn.disabled = !!busy;
        if (busy) {
            BusyIndicator.set(this.ui.executeBtn, this.ui.resultRoot, Config.MESSAGES.WEB_API.executing);
        } else {
            BusyIndicator.clear(this.ui.executeBtn);
        }
    }

    /**
     * Shows a banner with pagination information and Load More button.
     * @private
     */
    _showPaginationBanner() {
        if (!this.resultPanel) {
            return;
        }

        const banner = document.createElement('div');
        banner.id = 'api-pagination-banner';
        banner.className = 'pdt-note pdt-warn pdt-pagination-banner';

        const message = document.createElement('div');
        message.className = 'pdt-pagination-banner-message';
        message.innerHTML = `
            <strong>${Config.MESSAGES.WEB_API.bannerTitle}</strong><br>
            <span>${Config.MESSAGES.WEB_API.paginationWarning(this.allLoadedRecords.length.toLocaleString())}</span>
        `;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'pdt-pagination-banner-buttons';

        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'api-load-more-btn';
        loadMoreBtn.className = 'modern-button secondary';
        loadMoreBtn.textContent = Config.PAGINATION.buttons.loadMore;
        loadMoreBtn.onclick = () => this._loadMoreRecords();

        const loadAllBtn = document.createElement('button');
        loadAllBtn.id = 'api-load-all-btn';
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
     * Loads the next page of records.
     * @private
     */
    async _loadMoreRecords() {
        if (!this.nextLink || this.isLoadingMore) {
            return;
        }

        const loadMoreBtn = document.getElementById('api-load-more-btn');
        const loadAllBtn = document.getElementById('api-load-all-btn');

        try {
            this.isLoadingMore = true;
            if (loadMoreBtn) {
                loadMoreBtn.disabled = true;
                loadMoreBtn.textContent = Config.PAGINATION.buttons.loading;
            }
            if (loadAllBtn) {
                loadAllBtn.disabled = true;
            }

            const url = new URL(this.nextLink);
            const queryString = url.search;
            const { entitySet } = await this._ensureEntityContext(this.ui.getEntityInput.value);
            const res = await DataService.retrieveMultipleRecords(entitySet, queryString);

            this.allLoadedRecords = this.allLoadedRecords.concat(res.entities || []);
            this.nextLink = res.nextLink || null;

            this.lastResult = { entities: this.allLoadedRecords };
            this._displayResult();

            if (this.nextLink) {
                this._showPaginationBanner();
            } else {
                this._removePaginationBanner();
                NotificationService.show(Config.MESSAGES.WEB_API.allRecordsLoaded(this.allLoadedRecords.length.toLocaleString()), 'success');
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
        if (!this.nextLink || this.isLoadingMore) {
            return;
        }

        const loadMoreBtn = document.getElementById('api-load-more-btn');
        const loadAllBtn = document.getElementById('api-load-all-btn');

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
            const { entitySet } = await this._ensureEntityContext(this.ui.getEntityInput.value);

            while (this.nextLink) {
                pagesLoaded++;

                if (this.resultPanel) {
                    this.resultPanel.updateBanner(`
                        <strong>${Config.MESSAGES.WEB_API.bannerLoadingTitle}</strong><br>
                        <span>${Config.MESSAGES.WEB_API.loadingAllRecords(this.allLoadedRecords.length.toLocaleString(), pagesLoaded)}</span>
                    `);
                }

                const url = new URL(this.nextLink);
                const queryString = url.search;

                const res = await DataService.retrieveMultipleRecords(entitySet, queryString);

                this.allLoadedRecords = this.allLoadedRecords.concat(res.entities || []);
                this.nextLink = res.nextLink || null;

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

            this.nextLink = null;
            this._removePaginationBanner();

            this.lastResult = { entities: this.allLoadedRecords };
            this._displayResult();

            NotificationService.show(
                Config.MESSAGES.WEB_API.loadAllSuccess(this.allLoadedRecords.length.toLocaleString(), pagesLoaded + 1),
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
     * Lifecycle hook for cleaning up event listeners to prevent memory leaks.
     */
    destroy() {
        this._removeInputHandlers();
        this._removeButtonHandlers();
        this._removeLivePreviewHandlers();
        this._removeExternalHandlers();
        this._cleanupDynamicHandlers();
        this._cleanupResultPanel();
    }

    /** @private */
    _removeInputHandlers() {
        const handlers = [
            [this.ui.getEntityInput, 'input', this._getEntityInputHandler],
            [this.ui.postEntityInput, 'input', this._postEntityInputHandler],
            [this.ui.postEntityInput, 'blur', this._postEntityBlurHandler],
            [this.ui.patchEntityInput, 'input', this._patchEntityInputHandler],
            [this.ui.deleteEntityInput, 'input', this._deleteEntityNameInputHandler],
            [this.ui.patchIdInput, 'input', this._patchIdInputHandler],
            [this.ui.deleteIdInput, 'input', this._deleteIdInputHandler],
            [this._rootElement, 'keydown', this._rootKeydownHandler],
            [this.ui.methodSelect, 'change', this._methodSelectHandler]
        ];
        handlers.forEach(([el, event, handler]) => el?.removeEventListener(event, handler));
    }

    /** @private */
    _removeButtonHandlers() {
        const handlers = [
            [this.ui.formatJsonBtn, this._formatJsonHandler],
            [this.ui.bodyModeToggle, this._bodyModeToggleHandler, 'change'],
            [this.ui.addFieldBtn, this._addFieldBtnHandler],
            [this.ui.browseGetEntityBtn, this._pickEntityHandler],
            [this.ui.browsePostPatchEntityBtn, this._pickEntityHandler],
            [this.ui.browseDeleteEntityBtn, this._pickEntityHandler],
            [this.ui.browseGetSelectBtn, this._browseGetSelectHandler],
            [this.ui.browseGetOrderByBtn, this._browseGetOrderByHandler],
            [this.ui.addGetFilterGroupBtn, this._addGetFilterGroupHandler],
            [this.ui.addPatchFilterGroupBtn, this._addPatchFilterGroupHandler],
            [this.ui.addDeleteFilterGroupBtn, this._addDeleteFilterGroupHandler],
            [this.ui.patchCopyFromGetBtn, this._patchCopyFromGetHandler],
            [this.ui.deleteCopyFromGetBtn, this._deleteCopyFromGetHandler],
            [this.ui.getCountBtn, this._getCountHandler],
            [this.ui.executeBtn, this._executeHandler]
        ];
        handlers.forEach(([el, handler, event = 'click']) => el && handler && el.removeEventListener(event, handler));
    }

    /** @private */
    _removeLivePreviewHandlers() {
        if (!this._livePreviewRefreshHandler) {
            return;
        }

        [
            this.ui.methodSelect, this.ui.getEntityInput, this.ui.getSelectInput, this.ui.getTopInput,
            this.ui.getOrderByAttrInput, this.ui.getOrderByDirSelect,
            this.ui.postPatchEntityInput, this.ui.patchIdInput, this.ui.bodyArea,
            this.ui.deleteEntityInput, this.ui.deleteIdInput
        ].forEach(n => n?.removeEventListener('input', this._livePreviewRefreshHandler));

        if (this.ui.getFiltersContainer) {
            this.ui.getFiltersContainer.removeEventListener('input', this._livePreviewRefreshHandler);
            this.ui.getFiltersContainer.removeEventListener('change', this._livePreviewRefreshHandler);
        }

        if (this.ui.postFieldsContainer) {
            this.ui.postFieldsContainer.removeEventListener('input', this._livePreviewRefreshHandler);
        }
        if (this.ui.patchFieldsContainer) {
            this.ui.patchFieldsContainer.removeEventListener('input', this._livePreviewRefreshHandler);
        }

        if (this._livePreviewRefreshHandler.cancel) {
            this._livePreviewRefreshHandler.cancel();
        }
    }

    /** @private */
    _removeExternalHandlers() {
        if (this._externalRefreshHandler) {
            document.removeEventListener('pdt:tool-refresh', this._externalRefreshHandler);
            document.removeEventListener('pdt:refresh', this._externalRefreshHandler);
        }
    }

    /** @private */
    _cleanupDynamicHandlers() {
        for (const [element, { event, handler }] of this._dynamicHandlers.entries()) {
            element.removeEventListener(event, handler);
        }
        this._dynamicHandlers.clear();
    }

    /** @private */
    _cleanupResultPanel() {
        if (this.resultPanel && typeof this.resultPanel.destroy === 'function') {
            this.resultPanel.destroy();
        }
    }

    /**
     * Cleanup method called when component is destroyed.
     * Removes all event listeners and cleans up resources.
     * @override
     */
    cleanup() {
        this._removeInputHandlers();
        this._removeButtonHandlers();
        this._removeLivePreviewHandlers();
        this._removeExternalHandlers();
        this._cleanupDynamicHandlers();
        this._cleanupResultPanel();

        if (this.getFilterManager) {
            this.getFilterManager.cleanup?.();
        }
        if (this.patchFilterManager) {
            this.patchFilterManager.cleanup?.();
        }
        if (this.deleteFilterManager) {
            this.deleteFilterManager.cleanup?.();
        }
    }
}

