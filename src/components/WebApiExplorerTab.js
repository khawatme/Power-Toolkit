/**
 * @file Web API Explorer (classic UI aligned to FetchXmlTesterTab).
 * @module components/WebApiExplorerTab
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { DataService } from '../services/DataService.js';
import { NotificationService } from '../services/NotificationService.js';
import { copyToClipboard, debounce, escapeHtml, FILTER_OPERATORS, formatODataValue, normalizeApiResponse, shouldShowOperatorValue, showConfirmDialog, showColumnBrowser } from '../helpers/index.js';
import { MetadataBrowserDialog } from '../ui/MetadataBrowserDialog.js';
import { EntityContextResolver } from '../utils/resolvers/EntityContextResolver.js';
import { ODataQueryBuilder } from '../utils/builders/ODataQueryBuilder.js';
import { ResultPanel } from '../utils/ui/ResultPanel.js';
import { BusyIndicator } from '../utils/ui/BusyIndicator.js';
import { ErrorParser } from '../utils/parsers/ErrorParser.js';
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
    }

    /**
     * Render static structure (no results section yet).
     * Matches classic look and builder layout used in FetchXmlTesterTab.
     * @returns {Promise<HTMLElement>}
     */
    async render() {
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

      <!-- GET -->
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
            <textarea id="api-get-select" class="pdt-textarea" rows="3" placeholder="name&#10;createdon"></textarea>
            <button id="browse-api-get-select-btn" class="pdt-input-btn" title="Browse columns">${ICONS.inspector}</button>
          </div>

          <label for="api-get-top">Top Count</label>
          <input type="number" id="api-get-top" class="pdt-input" placeholder="10" value="10">
        </div>

        <div class="pdt-section-header mt-15">Filter</div>
        <div class="pdt-form-grid">
            <label>Condition</label>
            <div id="api-get-conditions-container" class="pdt-builder-group"></div>
        </div>

        <div class="pdt-section-header mt-15">Order</div>
        <div class="pdt-form-grid">
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
        </div>

        <!-- POST/PATCH -->
        <div id="api-view-postpatch" hidden>
        <div class="pdt-section-header">Request Builder</div>
        <div class="pdt-form-grid">
            <label for="api-postpatch-entity">Table Name</label>
            <div class="pdt-input-with-button">
            <input type="text" id="api-postpatch-entity" class="pdt-input" placeholder="e.g., accounts">
            <button id="browse-api-postpatch-entity-btn" class="pdt-input-btn" title="Browse tables">${ICONS.metadata}</button>
            </div>

            <label for="api-patch-id">Record ID</label>
            <input type="text" id="api-patch-id" class="pdt-input" placeholder="${Config.COMMON_PLACEHOLDERS.guid}">

            <label for="api-body">JSON Body</label>
            <textarea id="api-body" class="pdt-textarea" rows="10" placeholder='{"name": "Contoso"}'></textarea>
        </div>
        </div>

        <!-- DELETE -->
        <div id="api-view-delete" hidden>
        <div class="pdt-form-grid">
            <label for="api-delete-entity">Table Name</label>
            <div class="pdt-input-with-button mt-15">
            <input type="text" id="api-delete-entity" class="pdt-input" placeholder="e.g., accounts">
            <button id="browse-api-delete-entity-btn" class="pdt-input-btn" title="Browse tables">${ICONS.metadata}</button>
            </div>

            <label for="api-delete-id">Record ID</label>
            <input type="text" id="api-delete-id" class="pdt-input" placeholder="${Config.COMMON_PLACEHOLDERS.guid}">
        </div>
        </div>

        <div class="pdt-toolbar">
        <div class="pdt-toolbar-group">
            <button id="api-get-add-condition-btn" class="modern-button secondary">Add Condition</button>
        </div>
        <div class="pdt-toolbar-group ml-auto">
            <button id="api-copy-url-btn" class="modern-button secondary">Copy URL</button>
            <button id="api-format-json-btn" class="modern-button secondary" hidden>Format JSON</button>
            <button id="api-execute-btn" class="modern-button">Execute</button>
        </div>
        </div>

        <div id="api-preview" class="pdt-note"></div>

        <!-- Results area is rendered dynamically (like FetchXmlTesterTab) -->
        <div id="api-result-root" style="display: none;"></div>
    `;
        return el;
    }

    /**
     * Cache nodes, bind interactions, and initialize UI state.
     * @param {HTMLElement} root
     */
    postRender(root) {
        this.ui = {
            methodSelect: root.querySelector('#api-method-select'),
            preview: root.querySelector('#api-preview'),
            resultRoot: root.querySelector('#api-result-root'),

            // GET
            getView: root.querySelector('#api-view-get'),
            getEntityInput: root.querySelector('#api-get-entity'),
            getSelectInput: root.querySelector('#api-get-select'),
            getTopInput: root.querySelector('#api-get-top'),
            getConditionsContainer: root.querySelector('#api-get-conditions-container'),
            getOrderByAttrInput: root.querySelector('#api-get-orderby-attribute'),
            getOrderByDirSelect: root.querySelector('#api-get-orderby-dir'),
            browseGetEntityBtn: root.querySelector('#browse-api-get-entity-btn'),
            browseGetSelectBtn: root.querySelector('#browse-api-get-select-btn'),
            browseGetOrderByBtn: root.querySelector('#browse-api-get-orderby-btn'),

            // POST/PATCH
            postPatchView: root.querySelector('#api-view-postpatch'),
            postPatchEntityInput: root.querySelector('#api-postpatch-entity'),
            patchIdInput: root.querySelector('#api-patch-id'),
            bodyArea: root.querySelector('#api-body'),
            browsePostPatchEntityBtn: root.querySelector('#browse-api-postpatch-entity-btn'),

            // DELETE
            deleteView: root.querySelector('#api-view-delete'),
            deleteEntityInput: root.querySelector('#api-delete-entity'),
            deleteIdInput: root.querySelector('#api-delete-id'),
            browseDeleteEntityBtn: root.querySelector('#browse-api-delete-entity-btn'),

            // Toolbar
            addCondBtn: root.querySelector('#api-get-add-condition-btn'),
            copyUrlBtn: root.querySelector('#api-copy-url-btn'),
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
            setSortState: (s) => { this.resultSortState = s; }
        });

        this.ui.getEntityInput?.addEventListener('input', () => {
            this.selectedEntityLogicalName = null;
            this.attrMap = null;
            this.clearResults();
        });
        this.ui.postPatchEntityInput?.addEventListener('input', () => {
            this.selectedEntityLogicalName = null;
            this.attrMap = null;
            this.clearResults();
        });
        this.ui.deleteEntityInput?.addEventListener('input', () => {
            this.selectedEntityLogicalName = null;
            this.attrMap = null;
            this.clearResults();
        });

        root.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                this.ui.executeBtn?.click();
                e.preventDefault();
            }
        });

        // Bind interactions
        this._bindMethodSwitch();
        this._bindEntityBrowsers();
        this._bindConditionAdd();
        this._bindExecute();
        this._bindPayloadHelpers();
        this._bindLivePreview();
        this._bindExternalRefresh();

        // Init
        this._addConditionUI(true);
        this._updateMethodView();
        this._updatePreview();
        this.resultPanel.renderShell(0, this.currentView, this.hideOdata);
    }

    /* ===========================
     * View / Result Shell
     * =========================== */

    /** Switch method sections & toolbar buttons. */
    _updateMethodView() {
        /** @type {HttpMethod} */
        const m = this.ui.methodSelect.value;
        this.ui.getView.hidden = m !== 'GET';
        this.ui.postPatchView.hidden = !(m === 'POST' || m === 'PATCH');
        this.ui.deleteView.hidden = m !== 'DELETE';

        this.ui.addCondBtn.hidden = m !== 'GET';
        this.ui.copyUrlBtn.hidden = m !== 'GET';
        this.ui.formatJsonBtn.hidden = !(m === 'POST' || m === 'PATCH');
    }

    /** Method switch → update view + preview. */
    _bindMethodSwitch() {
        this.ui.methodSelect.addEventListener('change', () => {
            this._updateMethodView();
            this.clearResults();
            this._updatePreview();
        });
    }

    /**
     * Bind helpers for POST/PATCH payload editing (Format JSON).
     * Pretty-prints JSON or shows a clear error.
     * @private
     */
    _bindPayloadHelpers() {
        const btn = this.ui.formatJsonBtn;
        if (!btn) return;

        btn.addEventListener('click', () => {
            const area = this.ui.bodyArea;
            if (!area) return;

            try {
                const raw = area.value?.trim();
                const parsed = JSON.parse(raw && raw.length ? raw : '{}');
                area.value = JSON.stringify(parsed, null, 2);
                area.focus();
            } catch (e) {
                NotificationService.show(Config.MESSAGES.WEB_API.invalidJson, 'error');
            }
        });
    }

    /**
     * Render result content into #api-result-content.
     * Preserve horizontal scroll position when re-rendering (e.g., after sorting).
     * Respects hideOdata for both Table and JSON.
     * @private
     * @returns {void}
     */
    _displayResult() {
        if (!this.resultPanel) return;
        const entities = Array.isArray(this.lastResult?.entities)
            ? this.lastResult.entities
            : (Array.isArray(this.lastResult) ? this.lastResult : (this.lastResult?.value || []));

        // Always render shell + an explicit content pass, even when empty
        this.resultPanel.renderShell(entities.length, this.currentView, this.hideOdata);
        this.resultPanel.renderContent({
            data: entities || [],
            view: this.currentView,
            hideOdata: this.hideOdata
        });
    }

    /** Choose entity and columns with metadata browser, enabling controls once known. */
    _bindEntityBrowsers() {
        const pickEntity = () => {
            MetadataBrowserDialog.show('entity', (selected) => {
                this.selectedEntityLogicalName = selected.LogicalName;
                this.attrMap = null; // rebuild lazily
                const setName = selected.EntitySetName;

                this.ui.getEntityInput.value = setName;
                this.ui.postPatchEntityInput.value = setName;
                this.ui.deleteEntityInput.value = setName;

                // Reset builder to avoid stale data
                this.ui.getSelectInput.value = '';
                this.ui.getOrderByAttrInput.value = '';
                this.ui.getConditionsContainer.textContent = '';
                this._addConditionUI(true);

                this._updatePreview();
            });
        };

        this.ui.browseGetEntityBtn.addEventListener('click', pickEntity);
        this.ui.browsePostPatchEntityBtn.addEventListener('click', pickEntity);
        this.ui.browseDeleteEntityBtn.addEventListener('click', pickEntity);

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

        this.ui.browseGetSelectBtn.addEventListener('click', () =>
            pickColumn((ln) => {
                const area = this.ui.getSelectInput;
                area.value += (area.value ? '\n' : '') + ln;
            })
        );

        this.ui.browseGetOrderByBtn.addEventListener('click', () =>
            pickColumn((ln) => (this.ui.getOrderByAttrInput.value = ln))
        );
    }

    /** Add Condition button (GET only). */
    _bindConditionAdd() {
        if (!this.ui.addCondBtn) return;
        this.ui.addCondBtn.addEventListener('click', async () => {
            /** @type {HttpMethod} */
            const method = this.ui.methodSelect.value || 'GET';
            if (method !== 'GET') return;
            try {
                await this._ensureEntityContext();
                this._addConditionUI(false);
                this._updatePreview();
            } catch (e) {
                NotificationService.show(Config.MESSAGES.COMMON.selectTableFirst, 'warning');
            }
        });
    }

    /** Execute requests; Copy URL for GET. */
    _bindExecute() {
        this.ui.executeBtn.addEventListener('click', async () => {
            if (!this.ui.executeBtn || this.ui.executeBtn.disabled) return; // guard
            /** @type {HttpMethod} */
            const method = this.ui.methodSelect.value;

            this._setExecuting(true);
            try {
                switch (method) {
                    case 'GET': {
                        const { entitySet, logicalName } = await this._ensureEntityContext(this.ui.getEntityInput.value);
                        const options = await this._buildGetOptionsString(logicalName);
                        const res = await DataService.retrieveMultipleRecords(entitySet, options);
                        this.lastResult = normalizeApiResponse(res);
                        break;
                    }
                    case 'POST':
                    case 'PATCH': {
                        const { entitySet } = await this._ensureEntityContext(this.ui.postPatchEntityInput.value);
                        const body = ValidationService.validateJson(this.ui.bodyArea.value || '{}', 'Request body');

                        let res;
                        if (method === 'POST') {
                            res = await DataService.createRecord(entitySet, body);
                        } else {
                            const id = this.ui.patchIdInput.value.trim();
                            ValidationService.validateGuid(id, 'Record ID', Config.VALIDATION_ERRORS.invalidPatchGuid);
                            res = await DataService.updateRecord(entitySet, id, body);
                        }
                        this.lastResult = normalizeApiResponse(res);
                        break;
                    }
                    case 'DELETE': {
                        const { entitySet } = await this._ensureEntityContext(this.ui.deleteEntityInput.value);
                        const id = this.ui.deleteIdInput.value.trim();
                        ValidationService.validateGuid(id, 'Record ID', Config.VALIDATION_ERRORS.invalidDeleteGuid);
                        const ok = await showConfirmDialog(
                            'Confirm Delete',
                            `<p>Delete record <code>${escapeHtml(id)}</code> from <strong>${escapeHtml(entitySet)}</strong>?</p><p class="pdt-text-error">This action cannot be undone.</p>`
                        );
                        if (!ok) {
                            this.lastResult = normalizeApiResponse(null);
                            this._displayResult();
                            const count = Array.isArray(this.lastResult?.entities) ? this.lastResult.entities.length : 0;
                            NotificationService.show(Config.MESSAGES.WEB_API.requestSuccess, 'success');
                            return;
                        }
                        const res = await DataService.deleteRecord(entitySet, id);
                        // Delete is usually empty; still normalize to keep UX consistent.
                        this.lastResult = normalizeApiResponse(res);
                        break;
                    }
                }

                // Reset sort state on fresh results
                this.resultSortState = { column: null, direction: 'asc' };

                // Show results section on first execution
                if (this.ui.resultRoot.style.display === 'none') {
                    this.ui.resultRoot.style.display = '';
                }

                // Render results (shows zero/some records and keeps toolbar visible)
                this._displayResult();
                // bring results into view
                this.ui.resultRoot?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Keep preview current (also ensures URL is consistent after execution)
                this._updatePreview();
            } catch (e) {
                const friendly = ErrorParser.extract(e);
                const notifType = friendly === Config.MESSAGES.COMMON.selectTableFirst ? 'warning' : 'error';
                NotificationService.show(friendly, notifType);

                // Ensure the results panel doesn't stay in a loading/skeleton state
                this.lastResult = normalizeApiResponse(null);
                this.resultSortState = { column: null, direction: 'asc' };
                if (this.resultPanel) {
                    this.resultPanel.renderShell(0, this.currentView, this.hideOdata);
                    this.resultPanel.renderContent({
                        data: [],
                        view: this.currentView,
                        hideOdata: this.hideOdata
                    });
                }
            } finally {
                this._setExecuting(false);
            }
        });

        // Copy URL (GET only)
        this.ui.copyUrlBtn.addEventListener('click', async () => {
            try {
                const { entitySet, logicalName } = await this._ensureEntityContext(this.ui.getEntityInput.value);
                const opts = await this._buildGetOptionsString(logicalName);
                const url = `${entitySet}${opts || ''}`;
                copyToClipboard(url, 'Request URL copied.');
                this._setPreviewUrl(url);
            } catch (e) {
                NotificationService.show(Config.MESSAGES.WEB_API.buildUrlFailed(e.message), 'warning');
            }
        });
    }

    /** Live preview refresh (debounced). */
    _bindLivePreview() {
        const refresh = debounce(async () => {
            await this._updatePreview();
        }, 200);

        [
            this.ui.methodSelect, this.ui.getEntityInput, this.ui.getSelectInput, this.ui.getTopInput,
            this.ui.getOrderByAttrInput, this.ui.getOrderByDirSelect,
            this.ui.postPatchEntityInput, this.ui.patchIdInput, this.ui.bodyArea,
            this.ui.deleteEntityInput, this.ui.deleteIdInput
        ].forEach(n => n && n.addEventListener('input', refresh));

        this.ui.getConditionsContainer.addEventListener('input', refresh);
        this.ui.getConditionsContainer.addEventListener('change', refresh);
    }

    /**
     * Allow a global refresh to clear results from this tab.
     * Fire: document.dispatchEvent(new CustomEvent('pdt:tool-refresh'));
     */
    _bindExternalRefresh() {
        const clear = () => this.clearResults();
        document.addEventListener('pdt:tool-refresh', clear);
        document.addEventListener('pdt:refresh', clear);
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
            this.ui.postPatchEntityInput.value ||
            this.ui.deleteEntityInput.value || ''
        ).trim();

        if (!entityInput) {
            throw new Error(Config.MESSAGES.COMMON.selectTableFirst);
        }

        const { entitySet, logicalName } = await EntityContextResolver.resolve(entityInput);

        // Normalize UI to entity set (consistent downstream)
        if (this.ui.getEntityInput) this.ui.getEntityInput.value = entitySet;
        if (this.ui.postPatchEntityInput) this.ui.postPatchEntityInput.value = entitySet;
        if (this.ui.deleteEntityInput) this.ui.deleteEntityInput.value = entitySet;

        this.selectedEntityLogicalName = logicalName;

        // Make sure attrMap is ready
        if (!this.attrMap) {
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
        if (!this.attrMap) this.attrMap = await EntityContextResolver.getAttrMap(logicalName);

        const rawSelect = this.ui.getSelectInput.value.trim();
        const select = rawSelect ? rawSelect.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];

        // read filter rows
        const filters = [...this.ui.getConditionsContainer.querySelectorAll('.pdt-condition-grid')].map(row => {
            return {
                attr: row.querySelector('[data-prop="attribute"]')?.value.trim(),
                op: row.querySelector('[data-prop="operator"]')?.value,
                value: row.querySelector('[data-prop="value"]')?.value.trim()
            };
        }).filter(f => f.attr && f.op);

        const orderAttr = this.ui.getOrderByAttrInput.value.trim();
        const orderDir = this.ui.getOrderByDirSelect.value;
        const top = this.ui.getTopInput.value.trim();

        return ODataQueryBuilder.build({
            select,
            filters,
            orderAttr,
            orderDir,
            top,
            attrMap: this.attrMap
        });
    }

    /**
     * Append a new filter row: Attribute | Operator | Value | Remove (one line, equal widths)
     * The "Browse columns" button works whether the user typed a logical name or an entity set name.
     * @private
     * @param {boolean} isFirst
     */
    _addConditionUI(isFirst = false) {
        const row = document.createElement('div');
        row.className = 'pdt-condition-grid';
        const ops = FILTER_OPERATORS
            .filter(o => o.odata)
            .map(o => `<option value="${o.odata}">${o.text}</option>`)
            .join('');
        row.innerHTML = `
            <div class="pdt-input-with-button">
                <input type="text" class="pdt-input" data-prop="attribute" placeholder="Attribute">
                <button class="pdt-input-btn browse-condition-attr" title="Browse columns">${ICONS.inspector}</button>
            </div>
            <select class="pdt-select" data-prop="operator">${ops}</select>
            <input type="text" class="pdt-input" data-prop="value" placeholder="Value">
            <button class="modern-button danger secondary pdt-condition-remove" ${isFirst ? 'disabled' : ''}>X</button>
        `;

        // Column browser — resolve either logical name or set name before opening the dialog
        row.querySelector('.browse-condition-attr')?.addEventListener('click', () => {
            showColumnBrowser(
                async () => {
                    const { logicalName } = await this._ensureEntityContext();
                    return logicalName;
                },
                (attr) => {
                    row.querySelector('[data-prop="attribute"]').value = attr.LogicalName;
                    this._updatePreview();
                }
            );
        });

        // Remove row
        row.querySelector('.pdt-condition-remove')?.addEventListener('click', () => {
            row.remove();
            this._updatePreview();
        });

        // Hide/show Value when operator is null/not-null (match FetchXmlTester)
        const operatorSelect = row.querySelector('[data-prop="operator"]');
        const valueInput = row.querySelector('[data-prop="value"]');
        operatorSelect.onchange = () => {
            const shouldShow = shouldShowOperatorValue(operatorSelect.value);
            valueInput.style.display = shouldShow ? 'block' : 'none';
            if (!shouldShow) valueInput.value = '';
        };
        // Run once to sync initial state
        operatorSelect.dispatchEvent(new Event('change'));

        this.ui.getConditionsContainer.appendChild(row);
    }

    /**
     * Update the preview area with either the accurate GET URL (when possible),
     * or target info for other verbs. Mirrors FetchXmlTesterTab’s concise style.
     * @private
     * @returns {Promise<void>}
     */
    async _updatePreview() {
        const method = /** @type {HttpMethod} */ (this.ui.methodSelect.value);
        let html = `<div class="pdt-preview-line"><strong>Method:</strong> ${escapeHtml(method)}</div>`;

        if (method === 'GET') {
            const inputName = this.ui.getEntityInput.value.trim();
            if (!inputName) {
                html += `<div class="pdt-preview-line"><strong>URL:</strong> <code>(table?)</code></div>`;
            } else {
                try {
                    const { entitySet, logicalName } = await EntityContextResolver.resolve(inputName);
                    this.ui.getEntityInput.value = entitySet;
                    this.selectedEntityLogicalName = logicalName;
                    if (!this.attrMap) this.attrMap = await EntityContextResolver.getAttrMap(logicalName);
                    const opts = await this._buildGetOptionsString(logicalName);
                    this._setPreviewUrl(`${entitySet}${opts || ''}`);
                    return;
                } catch {
                    // fallback if not resolved yet
                    const opts = await this._buildGetOptionsStringFallback();
                    this._setPreviewUrl(`${inputName}${opts || ''}`);
                    return;
                }
            }
        } else if (method === 'POST' || method === 'PATCH') {
            const set = this.ui.postPatchEntityInput.value.trim() || '(table?)';
            const id = method === 'PATCH' ? (this.ui.patchIdInput.value.trim() || '(id?)') : '';
            html += `<div class="pdt-preview-line"><strong>Target:</strong> ${escapeHtml(set)} ${id ? `(${escapeHtml(id)})` : ''}</div>`;
        } else if (method === 'DELETE') {
            const set = this.ui.deleteEntityInput.value.trim() || '(table?)';
            const id = this.ui.deleteIdInput.value.trim() || '(id?)';
            html += `<div class="pdt-preview-line"><strong>Target:</strong> ${escapeHtml(set)} (${escapeHtml(id)})</div>`;
        }
        this.ui.preview.innerHTML = html;
    }

    /**
     * Set the preview URL to an exact escaped string (for GET).
     * @private
     * @param {string} url
     */
    _setPreviewUrl(url) {
        const html = [
            `<div class="pdt-preview-line"><strong>Method:</strong> GET</div>`,
            `<div class="pdt-preview-line"><strong>URL:</strong> <code>${escapeHtml(url)}</code></div>`
        ].join('');
        this.ui.preview.innerHTML = html;
    }

    /**
     * Fallback get-options (used only for preview when metadata not yet loaded).
     * @private
     * @returns {Promise<string>}
     */
    async _buildGetOptionsStringFallback() {
        const rawSelect = this.ui.getSelectInput.value.trim();
        const selectCols = rawSelect ? rawSelect.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];
        const top = this.ui.getTopInput.value.trim();
        const orderAttr = this.ui.getOrderByAttrInput.value.trim();
        const orderDir = this.ui.getOrderByDirSelect.value;

        // Build filter parts
        const rows = [...this.ui.getConditionsContainer.querySelectorAll('.pdt-condition-grid')];
        const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

        const filterParts = rows.map(r => {
            const a = r.querySelector('[data-prop="attribute"]').value.trim();
            const o = r.querySelector('[data-prop="operator"]').value;
            const v = r.querySelector('[data-prop="value"]').value.trim();
            if (!a || !o) return '';
            if (o.includes('null')) return `${a} ${o}`;
            if (['contains', 'startswith', 'endswith', 'not contains'].includes(o)) {
                const fn = (o === 'not contains') ? 'contains' : o;
                const expr = `${fn}(${a},${q(v)})`;
                return o === 'not contains' ? `not ${expr}` : expr;
            }
            return `${a} ${o} ${formatODataValue(v)}`;
        }).filter(Boolean);

        const params = [];
        if (selectCols.length) params.push(`$select=${selectCols.join(',')}`);
        if (filterParts.length) params.push(`$filter=${filterParts.join(' and ')}`);
        if (top) params.push(`$top=${top}`);
        if (orderAttr) params.push(`$orderby=${orderAttr} ${orderDir}`);

        return params.length ? `?${params.join('&')}` : '';
    }

    /**
     * Clear results UI and state (called on Refresh event).
     */
    clearResults() {
        this.lastResult = normalizeApiResponse(null);
        this.resultSortState = { column: null, direction: 'asc' };

        try { this.resultPanel?.dispose?.(); } catch { }
        if (this.ui.resultRoot) this.ui.resultRoot.textContent = '';
        this.resultPanel = new ResultPanel({
            root: this.ui.resultRoot,
            onToggleView: (v) => { this.currentView = v; PreferencesHelper.save(Config.STORAGE_KEYS.webApiView, v); this._displayResult(); },
            onToggleHide: (h) => { this.hideOdata = h; PreferencesHelper.save(Config.STORAGE_KEYS.webApiHideOdata, h, 'boolean'); this._displayResult(); },
            getSortState: () => this.resultSortState,
            setSortState: (s) => { this.resultSortState = s; }
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
        if (!this.ui.executeBtn) return;
        this.ui.executeBtn.disabled = !!busy;
        if (busy) BusyIndicator.set(this.ui.executeBtn, this.ui.resultRoot, 'Executing…');
        else BusyIndicator.clear(this.ui.executeBtn);
    }
}
