/**
 * @file Custom API Manager component.
 * @module components/CustomApiTab
 * @description Provides browse, create, manage, test, code generation,
 * and export/import capabilities for Dataverse Custom APIs.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { Config } from '../constants/index.js';
import { CustomApiService } from '../services/CustomApiService.js';
import { DataService } from '../services/DataService.js';
import { NotificationService } from '../services/NotificationService.js';
import { DialogService } from '../services/DialogService.js';
import { BusyIndicator } from '../utils/ui/BusyIndicator.js';
import { ErrorParser } from '../utils/parsers/ErrorParser.js';
import { debounce, escapeHtml, copyToClipboard, showConfirmDialog } from '../helpers/index.js';

/** @typedef {import('../services/CustomApiService.js').CustomApiDefinition} CustomApiDefinition */

/**
 * Custom API Manager tab component.
 * Two views: Browser (card grid) and Tester.
 * @extends {BaseComponent}
 */
export class CustomApiTab extends BaseComponent {
    constructor() {
        super('customApi', 'Custom APIs', ICONS.customApi);

        /** @type {CustomApiDefinition[]} */
        this.allApis = [];
        /** @type {CustomApiDefinition|null} */
        this.selectedApi = null;
        /** @type {'browser'|'tester'} */
        this.activeView = 'browser';
        /** @type {object[]} */
        this.executionHistory = [];
        /** @type {string} */
        this.selectedSolutionId = '';
        /** @type {string} */
        this.selectedSolutionPrefix = '';
        /** @type {string} */
        this.selectedSolutionName = '';
        /** @type {'json'|'xml'|'raw'} */
        this._activeResponseFormat = 'json';
        /** @type {object|null} */
        this._lastResponseResult = null;

        /** @type {Record<string, HTMLElement|null>} */
        this.ui = {};

        /** @private */
        this.filterCards = debounce(this._filterCards, 250);

        // Handler references for cleanup
        /** @private {Function|null} */ this._searchHandler = null;
        /** @private {Function|null} */ this._createBtnHandler = null;
        /** @private {Function|null} */ this._importBtnHandler = null;
        /** @private {Function|null} */ this._listClickHandler = null;
        /** @private {Function|null} */ this._viewToggleHandler = null;
        /** @private {Function|null} */ this._testerClickHandler = null;
        /** @private {Function|null} */ this._apiSelectHandler = null;
        /** @private {Function|null} */ this._executeBtnHandler = null;
        /** @private {Function|null} */ this._codeTabClickHandler = null;
        /** @private {Function|null} */ this._solutionChangeHandler = null;
        /** @private {Function|null} */ this._historyClickHandler = null;
        /** @private {Function|null} */ this._responseFormatHandler = null;
    }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>}
     */
    // eslint-disable-next-line require-await
    async render() {
        const container = document.createElement('div');
        container.className = 'pdt-capi';
        container.innerHTML = `
            <div class="section-title">${Config.MESSAGES.CUSTOM_API.title}</div>

            <!-- Solution Selector -->
            <div class="pdt-toolbar" style="margin-bottom: 10px;">
                <select id="capi-solution-select" class="pdt-select" style="flex: 2;">
                    <option value="">${Config.MESSAGES.CUSTOM_API.loadingSolutions}</option>
                </select>
            </div>

            <div class="pdt-sub-tabs" style="display:none;">
                <button id="capi-tab-browser" class="pdt-sub-tab active">${Config.MESSAGES.CUSTOM_API.browserView}</button>
                <button id="capi-tab-tester" class="pdt-sub-tab">${Config.MESSAGES.CUSTOM_API.testerView}</button>
            </div>

            <!-- BROWSER VIEW -->
            <div id="capi-browser-view" class="pdt-capi-panel">
                <div class="pdt-toolbar" style="display:none;">
                    <input type="text" id="capi-search" class="pdt-input" placeholder="${Config.MESSAGES.CUSTOM_API.searchPlaceholder}">
                    <button id="capi-import-btn" class="modern-button secondary">${Config.MESSAGES.CUSTOM_API.importBtn}</button>
                    <button id="capi-create-btn" class="modern-button">${Config.MESSAGES.CUSTOM_API.createBtn}</button>
                </div>
                <div id="capi-stats" class="pdt-capi-stats"></div>
                <div id="capi-list" class="pdt-content-host pdt-card-grid">
                    <p class="pdt-note">${Config.MESSAGES.CUSTOM_API.selectSolutionBody}</p>
                </div>
            </div>

            <!-- TESTER VIEW -->
            <div id="capi-tester-view" class="pdt-capi-panel" style="display:none;">
                <div class="pdt-capi-tester">
                    <div class="pdt-form-grid">
                        <label for="capi-tester-select">${Config.MESSAGES.CUSTOM_API.selectApiLabel}</label>
                        <select id="capi-tester-select" class="pdt-select">
                            <option value="">${Config.MESSAGES.CUSTOM_API.selectApiPlaceholder}</option>
                        </select>

                        <label>${Config.MESSAGES.CUSTOM_API.endpointLabel}</label>
                        <div id="capi-endpoint-preview" class="pdt-capi-endpoint-preview code-like">—</div>

                        <label>${Config.MESSAGES.CUSTOM_API.methodLabel}</label>
                        <div id="capi-method-badge" class="pdt-capi-method-badge">—</div>
                    </div>

                    <div id="capi-tester-params" class="pdt-capi-tester-section" style="display:none;">
                        <div class="pdt-capi-section-header">${Config.MESSAGES.CUSTOM_API.parametersTitle}</div>
                        <div id="capi-param-inputs" class="pdt-form-grid"></div>
                    </div>

                    <div id="capi-tester-target" class="pdt-capi-tester-section" style="display:none;">
                        <div class="pdt-capi-section-header">${Config.MESSAGES.CUSTOM_API.targetRecordLabel}</div>
                        <div class="pdt-form-grid">
                            <label for="capi-target-id">${Config.MESSAGES.CUSTOM_API.recordIdLabel}</label>
                            <input type="text" id="capi-target-id" class="pdt-input" placeholder="${Config.MESSAGES.CUSTOM_API.recordIdPlaceholder}">
                        </div>
                    </div>

                    <div class="pdt-capi-tester-section">
                        <div class="pdt-capi-section-header">${Config.MESSAGES.CUSTOM_API.headersTitle}</div>
                        <div id="capi-custom-headers">
                            <div class="pdt-capi-header-row pdt-inline-row gap-8" style="margin-bottom:6px;">
                                <input type="text" class="pdt-input capi-header-name" style="flex:1;" placeholder="e.g. MSCRM.SuppressDuplicateDetection">
                                <input type="text" class="pdt-input capi-header-value" style="flex:1;" placeholder="e.g. true">
                                <button class="modern-button danger secondary capi-remove-header-btn" title="Remove">X</button>
                            </div>
                        </div>
                        <button id="capi-add-header-btn" class="modern-button secondary" style="font-size:11px; padding:2px 10px; margin-top:4px;">+ Add Header</button>
                    </div>

                    <div class="pdt-capi-tester-actions">
                        <button id="capi-execute-btn" class="modern-button" disabled>${Config.MESSAGES.CUSTOM_API.executeBtn}</button>
                    </div>

                    <div id="capi-response-panel" class="pdt-capi-response" style="display:none;">
                        <div class="pdt-capi-response-header">
                            <span id="capi-response-status"></span>
                            <span id="capi-response-time"></span>
                            <span id="capi-response-size"></span>
                        </div>
                        <div class="pdt-capi-response-tabs">
                            <button class="pdt-capi-resp-tab active" data-panel="body">Body</button>
                            <button class="pdt-capi-resp-tab" data-panel="headers">Headers</button>
                        </div>
                        <div id="capi-response-body" class="pdt-capi-response-content">
                            <div class="pdt-capi-resp-format-tabs">
                                <button class="pdt-capi-resp-format-tab active" data-format="json">${Config.MESSAGES.CUSTOM_API.responseFormatJson}</button>
                                <button class="pdt-capi-resp-format-tab" data-format="xml">${Config.MESSAGES.CUSTOM_API.responseFormatXml}</button>
                                <button class="pdt-capi-resp-format-tab" data-format="raw">${Config.MESSAGES.CUSTOM_API.responseFormatRaw}</button>
                            </div>
                            <div class="pdt-converter-output-wrapper">
                                <pre><code id="capi-response-json"></code></pre>
                                <button id="capi-copy-body-btn" class="modern-button secondary pdt-converter-copy-btn">${Config.MESSAGES.CUSTOM_API.copyCodeBtn}</button>
                            </div>
                        </div>
                        <div id="capi-response-headers" class="pdt-capi-response-content" style="display:none;">
                            <div class="pdt-converter-output-wrapper">
                                <pre><code id="capi-response-headers-json"></code></pre>
                                <button id="capi-copy-headers-btn" class="modern-button secondary pdt-converter-copy-btn">${Config.MESSAGES.CUSTOM_API.copyCodeBtn}</button>
                            </div>
                        </div>
                    </div>

                    <div id="capi-code-gen" class="pdt-capi-code-gen" style="display:none;">
                        <div class="pdt-capi-section-header">${Config.MESSAGES.CUSTOM_API.codeGenTitle}</div>
                        <div class="pdt-capi-code-tabs">
                            <button class="pdt-capi-code-tab active" data-lang="javascript">${Config.MESSAGES.CUSTOM_API.copyAsJs}</button>
                            <button class="pdt-capi-code-tab" data-lang="csharp">${Config.MESSAGES.CUSTOM_API.copyAsCSharp}</button>
                            <button class="pdt-capi-code-tab" data-lang="http">${Config.MESSAGES.CUSTOM_API.copyAsHttp}</button>
                            <button class="pdt-capi-code-tab" data-lang="powerAutomate">${Config.MESSAGES.CUSTOM_API.copyAsPowerAutomate}</button>
                        </div>
                        <div class="pdt-converter-output-wrapper">
                            <textarea id="capi-code-output" class="pdt-textarea pdt-converter-output" rows="12" readonly spellcheck="false"></textarea>
                            <button id="capi-copy-code-btn" class="modern-button secondary pdt-converter-copy-btn">${Config.MESSAGES.CUSTOM_API.copyCodeBtn}</button>
                        </div>
                    </div>

                    <div id="capi-history" class="pdt-capi-history" style="display:none;">
                        <div class="pdt-capi-section-header">${Config.MESSAGES.CUSTOM_API.historyTitle}</div>
                        <div id="capi-history-list"></div>
                    </div>
                </div>
            </div>
        `;

        this.ui.listContainer = container.querySelector('#capi-list');

        return container;
    }

    /**
     * Caches UI elements and attaches event listeners.
     * @param {HTMLElement} element
     */
    postRender(element) {
        // Solution selector
        this.ui.solutionSelect = element.querySelector('#capi-solution-select');

        // Browser view
        this.ui.searchInput = element.querySelector('#capi-search');
        this.ui.listContainer = element.querySelector('#capi-list');
        this.ui.createBtn = element.querySelector('#capi-create-btn');
        this.ui.importBtn = element.querySelector('#capi-import-btn');
        this.ui.statsContainer = element.querySelector('#capi-stats');
        this.ui.browserView = element.querySelector('#capi-browser-view');
        this.ui.testerView = element.querySelector('#capi-tester-view');
        this.ui.subTabs = element.querySelector('.pdt-sub-tabs');
        this.ui.browserToolbar = element.querySelector('#capi-browser-view .pdt-toolbar');

        // Tester view
        this.ui.apiSelect = element.querySelector('#capi-tester-select');
        this.ui.endpointPreview = element.querySelector('#capi-endpoint-preview');
        this.ui.methodBadge = element.querySelector('#capi-method-badge');
        this.ui.paramInputs = element.querySelector('#capi-param-inputs');
        this.ui.paramSection = element.querySelector('#capi-tester-params');
        this.ui.targetSection = element.querySelector('#capi-tester-target');
        this.ui.targetId = element.querySelector('#capi-target-id');
        this.ui.executeBtn = element.querySelector('#capi-execute-btn');
        this.ui.responsePanel = element.querySelector('#capi-response-panel');
        this.ui.responseStatus = element.querySelector('#capi-response-status');
        this.ui.responseTime = element.querySelector('#capi-response-time');
        this.ui.responseSize = element.querySelector('#capi-response-size');
        this.ui.responseJson = element.querySelector('#capi-response-json');
        this.ui.responseHeadersJson = element.querySelector('#capi-response-headers-json');
        this.ui.responseFormatTabs = element.querySelector('.pdt-capi-resp-format-tabs');
        this.ui.codeGen = element.querySelector('#capi-code-gen');
        this.ui.codeOutput = element.querySelector('#capi-code-output');
        this.ui.historyPanel = element.querySelector('#capi-history');
        this.ui.historyList = element.querySelector('#capi-history-list');

        // Set up handlers
        this._solutionChangeHandler = () => this._onSolutionChanged();
        this._searchHandler = () => this.filterCards();
        this._createBtnHandler = () => this._openCreateDialog();
        this._importBtnHandler = () => this._handleImport();
        this._listClickHandler = (e) => this._handleBrowserClick(e);
        this._viewToggleHandler = (e) => {
            const btn = e.target.closest('.pdt-sub-tab');
            if (btn) {
                const view = btn.id === 'capi-tab-tester' ? 'tester' : 'browser';
                this._switchView(view);
            }
        };
        this._apiSelectHandler = () => this._onApiSelected();
        this._executeBtnHandler = () => this._handleExecute();
        this._codeTabClickHandler = (e) => {
            const tab = e.target.closest('.pdt-capi-code-tab');
            if (tab) {
                this._switchCodeLang(tab.dataset.lang);
            }
        };
        this._historyClickHandler = (e) => {
            const entry = e.target.closest('.pdt-capi-history-entry');
            if (entry) {
                const idx = parseInt(entry.dataset.historyIdx, 10);
                if (!isNaN(idx)) {
                    this._showHistoryDetail(idx);
                }
            }
        };

        this.ui.solutionSelect.addEventListener('change', this._solutionChangeHandler);
        this.ui.searchInput.addEventListener('input', this._searchHandler);
        this.ui.createBtn.addEventListener('click', this._createBtnHandler);
        this.ui.importBtn.addEventListener('click', this._importBtnHandler);
        this.ui.listContainer.addEventListener('click', this._listClickHandler);
        element.querySelector('.pdt-sub-tabs')?.addEventListener('click', this._viewToggleHandler);
        this.ui.apiSelect.addEventListener('change', this._apiSelectHandler);
        this.ui.executeBtn.addEventListener('click', this._executeBtnHandler);
        element.querySelector('.pdt-capi-code-tabs')?.addEventListener('click', this._codeTabClickHandler);
        element.querySelector('.pdt-capi-response-tabs')?.addEventListener('click', (e) => {
            const tab = e.target.closest('.pdt-capi-resp-tab');
            if (tab) {
                this._switchResponseTab(tab.dataset.panel);
            }
        });
        this._responseFormatHandler = (e) => {
            const tab = e.target.closest('.pdt-capi-resp-format-tab');
            if (tab) {
                this._switchResponseFormat(tab.dataset.format);
            }
        };
        this.ui.responseFormatTabs?.addEventListener('click', this._responseFormatHandler);
        element.querySelector('#capi-copy-code-btn')?.addEventListener('click', () => {
            const activeLang = this.ui.codeGen?.querySelector('.pdt-capi-code-tab.active')?.dataset?.lang || 'Code';
            copyToClipboard(this.ui.codeOutput.value, Config.MESSAGES.CUSTOM_API.codeCopied(activeLang));
        });
        element.querySelector('#capi-copy-body-btn')?.addEventListener('click', () => {
            copyToClipboard(this.ui.responseJson?.textContent || '', Config.MESSAGES.CUSTOM_API.bodyCopied);
        });
        element.querySelector('#capi-copy-headers-btn')?.addEventListener('click', () => {
            copyToClipboard(this.ui.responseHeadersJson?.textContent || '', Config.MESSAGES.CUSTOM_API.headersCopied);
        });
        this.ui.historyList?.addEventListener('click', this._historyClickHandler);

        // Custom header add/remove
        this.ui.headersContainer = element.querySelector('#capi-custom-headers');
        element.querySelector('#capi-add-header-btn')?.addEventListener('click', () => this._addHeaderRow());
        this.ui.headersContainer?.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.capi-remove-header-btn');
            if (removeBtn) {
                const row = removeBtn.closest('.pdt-capi-header-row');
                if (row && this.ui.headersContainer.querySelectorAll('.pdt-capi-header-row').length > 1) {
                    row.remove();
                } else if (row) {
                    // Last row - just clear the inputs
                    row.querySelectorAll('input').forEach(inp => {
                        inp.value = '';
                    });
                }
            }
        });

        this._populateTesterSelect();
        this._loadSolutions();
    }

    /**
     * Lifecycle cleanup - remove event listeners.
     */
    cleanup() {
        this.ui.solutionSelect?.removeEventListener('change', this._solutionChangeHandler);
        this.ui.searchInput?.removeEventListener('input', this._searchHandler);
        this.ui.createBtn?.removeEventListener('click', this._createBtnHandler);
        this.ui.importBtn?.removeEventListener('click', this._importBtnHandler);
        this.ui.listContainer?.removeEventListener('click', this._listClickHandler);
        this.ui.apiSelect?.removeEventListener('change', this._apiSelectHandler);
        this.ui.executeBtn?.removeEventListener('click', this._executeBtnHandler);
        this.ui.responseFormatTabs?.removeEventListener('click', this._responseFormatHandler);
        this.ui.historyList?.removeEventListener('click', this._historyClickHandler);
        if (this.filterCards?.cancel) {
            this.filterCards.cancel();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SOLUTION SELECTOR
    // ═══════════════════════════════════════════════════════════════

    /** @private Loads solutions into the dropdown. */
    async _loadSolutions() {
        try {
            const solQs = '?$select=solutionid,uniquename,friendlyname,ismanaged&$expand=publisherid($select=customizationprefix)&$filter=isvisible eq true&$orderby=friendlyname asc';
            const solResult = await DataService.retrieveMultipleRecords('solution', solQs);
            const solutions = (solResult?.entities || []);

            if (!this.ui.solutionSelect) {
                return;
            }
            const opts = solutions.map(s => {
                const prefix = s.publisherid?.customizationprefix || '';
                const managedLabel = s.ismanaged ? ' [Managed]' : '';
                return `<option value="${escapeHtml(s.solutionid)}" data-name="${escapeHtml(s.uniquename)}" data-prefix="${escapeHtml(prefix)}">${escapeHtml(s.friendlyname)} (${escapeHtml(s.uniquename)})${managedLabel}</option>`;
            }).join('');
            this.ui.solutionSelect.innerHTML =
                `<option value="">${Config.MESSAGES.COMMON.selectSolutionDropdown}</option>${opts}`;
        } catch {
            if (this.ui.solutionSelect) {
                this.ui.solutionSelect.innerHTML =
                    `<option value="">${Config.MESSAGES.COMMON.selectSolutionDropdown}</option>`;
            }
        }
    }

    /** @private Handles solution dropdown change. */
    async _onSolutionChanged() {
        const selectedValue = this.ui.solutionSelect?.value || '';
        const selectedOption = this.ui.solutionSelect?.selectedOptions?.[0];
        this.selectedSolutionId = selectedValue;
        this.selectedSolutionName = selectedOption?.dataset?.name || '';
        this.selectedSolutionPrefix = selectedOption?.dataset?.prefix || '';

        if (!selectedValue) {
            this.allApis = [];
            this.ui.subTabs.style.display = 'none';
            this.ui.browserToolbar.style.display = 'none';
            if (this.ui.browserView) {
                this.ui.browserView.style.display = '';
            }
            if (this.ui.testerView) {
                this.ui.testerView.style.display = 'none';
            }
            this.activeView = 'browser';
            this.ui.statsContainer.innerHTML = '';
            this.ui.listContainer.innerHTML = `<p class="pdt-note">${Config.MESSAGES.CUSTOM_API.selectSolutionBody}</p>`;
            this._populateTesterSelect();
            return;
        }

        this.ui.subTabs.style.display = 'none';
        this.ui.browserToolbar.style.display = 'none';
        if (this.ui.browserView) {
            this.ui.browserView.style.display = '';
        }
        if (this.ui.testerView) {
            this.ui.testerView.style.display = 'none';
        }
        this.activeView = 'browser';

        try {
            BusyIndicator.set();
            this.ui.statsContainer.innerHTML = '';
            this.ui.listContainer.innerHTML = `<p class="pdt-note">${Config.MESSAGES.CUSTOM_API.loading}</p>`;
            this.allApis = await CustomApiService.fetchBySolution(selectedValue);
            this.ui.subTabs.style.display = '';
            this.ui.browserToolbar.style.display = '';
            this._switchView('browser');
            this._renderBrowser();
            this._populateTesterSelect();
        } catch (e) {
            this.ui.listContainer.innerHTML = `<div class="pdt-error">${Config.MESSAGES.CUSTOM_API.loadFailed(escapeHtml(e.message))}</div>`;
        } finally {
            BusyIndicator.clear();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // BROWSER VIEW
    // ═══════════════════════════════════════════════════════════════

    /** @private Renders the browser card grid and stats. */
    _renderBrowser() {
        this._renderStats();
        this.ui.listContainer.textContent = '';
        if (!this.allApis.length) {
            this.ui.listContainer.innerHTML = `<p class="pdt-note">${Config.MESSAGES.CUSTOM_API.noApisFound}</p>`;
            return;
        }
        const frag = document.createDocumentFragment();
        this.allApis.forEach(api => frag.appendChild(this._createApiCard(api)));
        this.ui.listContainer.appendChild(frag);
    }

    /** @private Renders summary statistics. */
    _renderStats() {
        if (!this.ui.statsContainer) {
            return;
        }
        const total = this.allApis.length;
        const actions = this.allApis.filter(a => !a.isfunction).length;
        const functions = this.allApis.filter(a => a.isfunction).length;
        const managed = this.allApis.filter(a => a.ismanaged).length;

        this.ui.statsContainer.innerHTML = `
            <div class="pdt-stat-card"><div class="pdt-stat-value">${total}</div><div class="pdt-stat-label">${Config.MESSAGES.CUSTOM_API.totalApis}</div></div>
            <div class="pdt-stat-card"><div class="pdt-stat-value">${actions}</div><div class="pdt-stat-label">${Config.MESSAGES.CUSTOM_API.totalActions}</div></div>
            <div class="pdt-stat-card"><div class="pdt-stat-value">${functions}</div><div class="pdt-stat-label">${Config.MESSAGES.CUSTOM_API.totalFunctions}</div></div>
            <div class="pdt-stat-card"><div class="pdt-stat-value">${managed}</div><div class="pdt-stat-label">${Config.MESSAGES.CUSTOM_API.totalManaged}</div></div>
        `;
    }

    /**
     * Creates a single API card element.
     * @private
     * @param {CustomApiDefinition} api
     * @returns {HTMLElement}
     */
    _createApiCard(api) {
        const card = document.createElement('div');
        card.className = 'pdt-card pdt-capi-card';
        card.dataset.apiId = api.customapiid;

        const searchText = [
            api.uniquename, api.displayname, api.description,
            api.boundentitylogicalname,
            api.isfunction ? 'function' : 'action',
            CustomApiService.getBindingLabel(api.bindingtype)
        ].map(s => (s ?? '').toString().toLowerCase()).join(' ');
        card.dataset.searchTerm = searchText;

        const typeBadge = api.isfunction
            ? '<span class="pdt-capi-badge pdt-capi-badge-function">Function</span>'
            : '<span class="pdt-capi-badge pdt-capi-badge-action">Action</span>';
        const managedBadge = api.ismanaged
            ? `<span class="pdt-capi-badge pdt-capi-badge-managed">${Config.MESSAGES.CUSTOM_API.managedBadge}</span>`
            : `<span class="pdt-capi-badge pdt-capi-badge-unmanaged">${Config.MESSAGES.CUSTOM_API.unmanagedBadge}</span>`;
        const bindingLabel = CustomApiService.getBindingLabel(api.bindingtype);
        const processingLabel = CustomApiService.getProcessingLabel(api.allowedcustomprocessingsteptype);
        const params = api.CustomAPIRequestParameters || [];
        const props = api.CustomAPIResponseProperties || [];
        const pluginName = api.PluginTypeId?.typename || '—';

        card.innerHTML = `
            <div class="pdt-card-header">
                <div class="pdt-capi-card-title-row">
                    <span class="pdt-capi-name">${escapeHtml(api.uniquename)}</span>
                    <span class="pdt-capi-badges">${typeBadge}${managedBadge}</span>
                </div>
                ${api.displayname ? `<div class="pdt-subtitle-small">${escapeHtml(api.displayname)}</div>` : ''}
            </div>
            <div class="pdt-card-body">
                <div class="info-grid">
                    <strong>${Config.MESSAGES.CUSTOM_API.bindingLabel}:</strong><span>${escapeHtml(bindingLabel)}</span>
                    ${api.boundentitylogicalname ? `<strong>${Config.MESSAGES.CUSTOM_API.boundEntityLabel}:</strong><span class="code-like">${escapeHtml(api.boundentitylogicalname)}</span>` : ''}
                    <strong>${Config.MESSAGES.CUSTOM_API.processingLabel}:</strong><span>${escapeHtml(processingLabel)}</span>
                    <strong>${Config.MESSAGES.CUSTOM_API.pluginLabel}:</strong><span class="code-like">${escapeHtml(pluginName)}</span>
                    ${api.description ? `<strong>Description:</strong><span>${escapeHtml(api.description)}</span>` : ''}
                    ${api.executeprivilegename ? `<strong>Privilege:</strong><span class="code-like">${escapeHtml(api.executeprivilegename)}</span>` : ''}
                </div>

                <div class="pdt-capi-expandable" style="display:none;">
                    <div class="pdt-capi-params-section">
                        <div class="pdt-capi-section-row">
                            <strong>${Config.MESSAGES.CUSTOM_API.requestParams} (${params.length})</strong>
                            ${!api.ismanaged ? '<button class="modern-button secondary capi-add-param-btn" style="font-size:11px; padding:2px 8px;">+ Add</button>' : ''}
                        </div>
                        ${params.length > 0 ? this._renderParamTable(params, api) : `<p class="pdt-note">${Config.MESSAGES.CUSTOM_API.noParams}</p>`}
                    </div>
                    <div class="pdt-capi-props-section">
                        <div class="pdt-capi-section-row">
                            <strong>${Config.MESSAGES.CUSTOM_API.responseProps} (${props.length})</strong>
                            ${!api.ismanaged ? '<button class="modern-button secondary capi-add-prop-btn" style="font-size:11px; padding:2px 8px;">+ Add</button>' : ''}
                        </div>
                        ${props.length > 0 ? this._renderPropTable(props, api) : `<p class="pdt-note">${Config.MESSAGES.CUSTOM_API.noProps}</p>`}
                    </div>
                </div>
            </div>
            <div class="pdt-card-footer">
                ${!api.ismanaged ? `<button class="modern-button secondary capi-delete-btn pdt-capi-delete-hover">${Config.MESSAGES.CUSTOM_API.deleteBtn}</button>` : ''}
                ${!api.ismanaged ? `<button class="modern-button secondary capi-edit-btn">${Config.MESSAGES.CUSTOM_API.editBtn}</button>` : ''}
                <button class="modern-button secondary capi-export-btn" title="${Config.MESSAGES.CUSTOM_API.exportTooltip}">${Config.MESSAGES.CUSTOM_API.exportBtn}</button>
                <button class="modern-button secondary capi-test-btn">${Config.MESSAGES.CUSTOM_API.testBtn}</button>
                <button class="modern-button secondary capi-expand-btn">${Config.MESSAGES.CUSTOM_API.expandBtn}</button>
            </div>
        `;

        return card;
    }

    /**
     * Renders a mini table of request parameters with edit/delete buttons.
     * @private
     * @param {CustomApiRequestParam[]} params
     * @param {CustomApiDefinition} api
     * @returns {string} HTML string
     */
    _renderParamTable(params, api) {
        const rows = params.map(p => {
            const actions = !api.ismanaged
                ? `<td class="pdt-capi-mini-actions">
                    <button class="modern-button secondary capi-edit-param-btn" style="font-size:11px; padding:2px 8px;" data-param-id="${escapeHtml(p.customapirequestparameterid)}" title="Edit">Edit</button>
                    <button class="modern-button secondary capi-delete-param-btn pdt-capi-delete-hover" style="font-size:11px; padding:2px 8px;" data-param-id="${escapeHtml(p.customapirequestparameterid)}" data-param-name="${escapeHtml(p.uniquename)}" title="Delete">Delete</button>
                  </td>`
                : '<td></td>';
            return `
                <tr>
                    <td class="code-like">${escapeHtml(p.uniquename)}</td>
                    <td>${escapeHtml(CustomApiService.getTypeLabel(p.type))}</td>
                    <td>${p.isoptional ? 'Optional' : '<strong>Required</strong>'}</td>
                    <td>${escapeHtml(p.description || '—')}</td>
                    ${actions}
                </tr>
            `;
        }).join('');
        return `<table class="pdt-capi-mini-table"><thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    /**
     * Renders a mini table of response properties with edit/delete buttons.
     * @private
     * @param {CustomApiResponseProp[]} props
     * @param {CustomApiDefinition} api
     * @returns {string} HTML string
     */
    _renderPropTable(props, api) {
        const rows = props.map(p => {
            const actions = !api.ismanaged
                ? `<td class="pdt-capi-mini-actions">
                    <button class="modern-button secondary capi-edit-prop-btn" style="font-size:11px; padding:2px 8px;" data-prop-id="${escapeHtml(p.customapiresponsepropertyid)}" title="Edit">Edit</button>
                    <button class="modern-button secondary capi-delete-prop-btn pdt-capi-delete-hover" style="font-size:11px; padding:2px 8px;" data-prop-id="${escapeHtml(p.customapiresponsepropertyid)}" data-prop-name="${escapeHtml(p.uniquename)}" title="Delete">Delete</button>
                  </td>`
                : '<td></td>';
            return `
                <tr>
                    <td class="code-like">${escapeHtml(p.uniquename)}</td>
                    <td>${escapeHtml(CustomApiService.getTypeLabel(p.type))}</td>
                    <td>${escapeHtml(p.description || '—')}</td>
                    ${actions}
                </tr>
            `;
        }).join('');
        return `<table class="pdt-capi-mini-table"><thead><tr><th>Name</th><th>Type</th><th>Description</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    /** @private Filters cards by search term. */
    _filterCards() {
        const term = (this.ui.searchInput?.value || '').toLowerCase().trim();
        this.ui.listContainer?.querySelectorAll('.pdt-capi-card').forEach(card => {
            const match = !term || card.dataset.searchTerm.includes(term);
            card.style.display = match ? '' : 'none';
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // BROWSER CLICK DELEGATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Handles all click events in the browser card list.
     * @private
     * @param {Event} e
     */
    async _handleBrowserClick(e) {
        const btn = e.target.closest('button');
        if (!btn) {
            return;
        }

        const card = btn.closest('.pdt-capi-card');
        if (!card) {
            return;
        }

        const apiId = card.dataset.apiId;
        const api = this.allApis.find(a => a.customapiid === apiId);
        if (!api) {
            return;
        }

        if (btn.matches('.capi-expand-btn')) {
            this._toggleExpand(card, btn);
        } else if (btn.matches('.capi-test-btn')) {
            this._switchView('tester');
            this.ui.apiSelect.value = apiId;
            this._onApiSelected();
        } else if (btn.matches('.capi-export-btn')) {
            this._handleExport(api);
        } else if (btn.matches('.capi-edit-btn')) {
            await this._openEditDialog(api);
        } else if (btn.matches('.capi-delete-btn')) {
            await this._handleDelete(api);
        } else if (btn.matches('.capi-add-param-btn')) {
            await this._openAddParamDialog(api);
        } else if (btn.matches('.capi-add-prop-btn')) {
            await this._openAddPropDialog(api);
        } else if (btn.matches('.capi-edit-param-btn')) {
            const paramId = btn.dataset.paramId;
            const param = (api.CustomAPIRequestParameters || []).find(p => p.customapirequestparameterid === paramId);
            if (param) {
                await this._openEditParamDialog(param);
            }
        } else if (btn.matches('.capi-delete-param-btn')) {
            await this._handleDeleteParam(btn.dataset.paramId, btn.dataset.paramName);
        } else if (btn.matches('.capi-edit-prop-btn')) {
            const propId = btn.dataset.propId;
            const prop = (api.CustomAPIResponseProperties || []).find(p => p.customapiresponsepropertyid === propId);
            if (prop) {
                await this._openEditPropDialog(prop);
            }
        } else if (btn.matches('.capi-delete-prop-btn')) {
            await this._handleDeleteProp(btn.dataset.propId, btn.dataset.propName);
        }
    }

    /**
     * Toggles expand/collapse of param/prop details in a card.
     * @private
     * @param {HTMLElement} card
     * @param {HTMLElement} btn
     */
    _toggleExpand(card, btn) {
        const expandable = card.querySelector('.pdt-capi-expandable');
        if (!expandable) {
            return;
        }
        const isExpanded = expandable.style.display !== 'none';
        expandable.style.display = isExpanded ? 'none' : 'block';
        btn.textContent = isExpanded ? Config.MESSAGES.CUSTOM_API.expandBtn : Config.MESSAGES.CUSTOM_API.collapseBtn;
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW TOGGLE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Switches between browser and tester views.
     * @private
     * @param {'browser'|'tester'} view
     */
    _switchView(view) {
        this.activeView = view;
        const tabs = this.ui.browserView?.parentElement?.querySelectorAll('.pdt-sub-tab') || [];
        tabs.forEach(t => {
            const tabView = t.id === 'capi-tab-tester' ? 'tester' : 'browser';
            t.classList.toggle('active', tabView === view);
        });
        if (this.ui.browserView) {
            this.ui.browserView.style.display = view === 'browser' ? '' : 'none';
        }
        if (this.ui.testerView) {
            this.ui.testerView.style.display = view === 'tester' ? '' : 'none';
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE DIALOG
    // ═══════════════════════════════════════════════════════════════

    /**
     * Normalizes prefill values for the create dialog, providing defaults.
     * @private
     * @param {object|null} prefill
     * @param {string} prefix
     * @returns {object}
     */
    _normalizeCreatePrefill(prefill, prefix) {
        const p = prefill || {};
        return {
            prefixHint: prefix ? `${prefix}_MyCustomApi` : 'new_MyCustomApi',
            uniquenameValue: prefix && !prefill ? prefix + '_' : (p.uniquename || ''),
            name: p.name || '',
            displayname: p.displayname || '',
            description: p.description || '',
            isfunction: p.isfunction,
            bindingtype: p.bindingtype ?? 0,
            boundentity: p.boundentitylogicalname || '',
            processingType: p.allowedcustomprocessingsteptype ?? 0,
            privilege: p.executeprivilegename || '',
            isprivate: !!p.isprivate,
            workflowEnabled: !!p.workflowsdkstepenabled
        };
    }

    /**
     * Builds the HTML content for the create Custom API form.
     * @private
     * @param {object} f - Normalized field values from _normalizeCreatePrefill
     * @param {string} pluginOpts - HTML string of plugin type <option> elements
     * @returns {string} HTML string
     */
    _buildCreateFormHtml(f, pluginOpts) {
        const sel = (cond) => cond ? 'selected' : '';
        const chk = (cond) => cond ? 'checked' : '';
        return `
            ${this._buildSolutionInfoHtml()}
            <label>${Config.MESSAGES.CUSTOM_API.uniqueNameLabel} *</label>
            <input type="text" class="pdt-input" id="capi-new-uniquename" placeholder="${escapeHtml(f.prefixHint)}" value="${escapeHtml(f.uniquenameValue)}">
            <label>${Config.MESSAGES.CUSTOM_API.nameLabel}</label>
            <input type="text" class="pdt-input pdt-input-disabled" id="capi-new-name" placeholder="${Config.MESSAGES.CUSTOM_API.namePlaceholder}" value="${escapeHtml(f.name)}" disabled>
            <label>${Config.MESSAGES.CUSTOM_API.displayNameLabel} *</label>
            <input type="text" class="pdt-input" id="capi-new-displayname" placeholder="My Custom API" value="${escapeHtml(f.displayname)}">
            <label>${Config.MESSAGES.CUSTOM_API.descriptionLabel} *</label>
            <textarea class="pdt-textarea" id="capi-new-description" rows="2">${escapeHtml(f.description)}</textarea>
            <label>${Config.MESSAGES.CUSTOM_API.isFunctionLabel} *</label>
            <select class="pdt-select" id="capi-new-isfunction">
                <option value="false" ${sel(f.isfunction !== true)}>Action (POST)</option>
                <option value="true" ${sel(f.isfunction === true)}>Function (GET)</option>
            </select>
            <label>${Config.MESSAGES.CUSTOM_API.bindingTypeLabel} *</label>
            <select class="pdt-select" id="capi-new-bindingtype">
                <option value="0" ${sel(f.bindingtype === 0)}>Global</option>
                <option value="1" ${sel(f.bindingtype === 1)}>Entity</option>
                <option value="2" ${sel(f.bindingtype === 2)}>Entity Collection</option>
            </select>
            <label>${Config.MESSAGES.CUSTOM_API.boundEntityLabel}</label>
            <input type="text" class="pdt-input" id="capi-new-boundentity" placeholder="${Config.MESSAGES.CUSTOM_API.boundEntityPlaceholder}" value="${escapeHtml(f.boundentity)}">
            <label>${Config.MESSAGES.CUSTOM_API.processingTypeLabel} *</label>
            <select class="pdt-select" id="capi-new-processing">
                <option value="0" ${sel(f.processingType === 0)}>None</option>
                <option value="1" ${sel(f.processingType === 1)}>Async Only</option>
                <option value="2" ${sel(f.processingType === 2)}>Sync and Async</option>
            </select>
            <label>${Config.MESSAGES.CUSTOM_API.privilegeNameLabel}</label>
            <input type="text" class="pdt-input" id="capi-new-privilege" placeholder="${Config.MESSAGES.CUSTOM_API.privilegeNamePlaceholder}" value="${escapeHtml(f.privilege)}">
            <label>${Config.MESSAGES.CUSTOM_API.pluginTypeLabel}</label>
            <select class="pdt-select" id="capi-new-plugintype">
                <option value="">${Config.MESSAGES.CUSTOM_API.pluginTypeNone}</option>
                ${pluginOpts}
            </select>
            <label>${Config.MESSAGES.CUSTOM_API.isPrivateLabel}</label>
            <label class="pdt-toggle-switch"><input type="checkbox" id="capi-new-private" ${chk(f.isprivate)}><span class="pdt-toggle-slider"></span></label>
            <label>${Config.MESSAGES.CUSTOM_API.workflowEnabledLabel}</label>
            <label class="pdt-toggle-switch"><input type="checkbox" id="capi-new-workflow" ${chk(f.workflowEnabled)}><span class="pdt-toggle-slider"></span></label>
        `;
    }

    /**
     * Handles the create button click in the create dialog.
     * @private
     * @param {HTMLElement} content
     * @param {object} dlg
     * @param {HTMLButtonElement} createBtn
     * @param {Function} revalidate
     */
    async _handleCreateSubmit(content, dlg, createBtn, revalidate) {
        createBtn.disabled = true;
        const originalText = createBtn.textContent;
        createBtn.textContent = Config.MESSAGES.CUSTOM_API.creating;
        content.querySelectorAll('input,textarea,select,button').forEach(el => {
            el.disabled = true;
        });

        const uniquename = content.querySelector('#capi-new-uniquename')?.value?.trim();
        const displayname = content.querySelector('#capi-new-displayname')?.value?.trim();
        if (!uniquename || !displayname) {
            NotificationService.show(Config.MESSAGES.CUSTOM_API.requiredFields, 'error');
            createBtn.textContent = originalText;
            content.querySelectorAll('input,textarea,select,button').forEach(el => {
                el.disabled = false;
            });
            content.querySelectorAll('.pdt-input-disabled').forEach(el => el.setAttribute('disabled', ''));
            revalidate();
            return;
        }

        const definition = this._collectCreateFormValues(content, uniquename, displayname);
        const solUniqueName = this.selectedSolutionName || '';

        try {
            BusyIndicator.set();
            await CustomApiService.create(definition, [], [], solUniqueName);

            NotificationService.show(Config.MESSAGES.CUSTOM_API.createSuccess, 'success');
            dlg.close?.();
            await this._refreshData();
        } catch (err) {
            NotificationService.show(Config.MESSAGES.CUSTOM_API.createFailed(ErrorParser.extract(err)), 'error');
            createBtn.textContent = originalText;
            content.querySelectorAll('input,textarea,select,button').forEach(el => {
                el.disabled = false;
            });
            content.querySelectorAll('.pdt-input-disabled').forEach(el => el.setAttribute('disabled', ''));
            revalidate();
        } finally {
            BusyIndicator.clear();
        }
    }

    /** @private Opens dialog to create a new Custom API. */
    async _openCreateDialog(prefill = null) {
        const prefix = this.selectedSolutionPrefix || '';

        // Load plugin types async (always load all, regardless of solution filter)
        let pluginTypes = [];
        try {
            pluginTypes = await CustomApiService.fetchPluginTypes();
        } catch { /* non-blocking */ }

        const pluginOpts = pluginTypes.map(p => {
            const label = p.ismanaged ? `${p.typename || p.name} (Managed)` : (p.typename || p.name);
            return `<option value="${escapeHtml(p.plugintypeid)}">${escapeHtml(label)}</option>`;
        }).join('');

        const fields = this._normalizeCreatePrefill(prefill, prefix);
        const content = document.createElement('div');
        content.className = 'pdt-form-grid pdt-capi-create-form';
        content.innerHTML = this._buildCreateFormHtml(fields, pluginOpts);

        // Auto-generate Name from uniquename
        const uniquenameEl = content.querySelector('#capi-new-uniquename');
        const nameEl = content.querySelector('#capi-new-name');
        uniquenameEl?.addEventListener('input', () => {
            nameEl.value = uniquenameEl.value.trim();
        });
        // Trigger initial name if prefill
        if (prefill?.uniquename && !prefill?.name) {
            nameEl.value = prefill.uniquename;
        }

        const dlg = DialogService.show(
            prefill ? Config.MESSAGES.CUSTOM_API.importReviewTitle : Config.MESSAGES.CUSTOM_API.createDialogTitle,
            content
        );
        const dlgEl = content.closest('.pdt-dialog');
        dlgEl?.classList.add('pdt-capi-dialog');
        const footer = dlgEl?.querySelector('.pdt-dialog-footer');

        // Create our own "Create" button (disabled initially)
        const createBtn = document.createElement('button');
        createBtn.className = 'modern-button';
        createBtn.textContent = Config.MESSAGES.CUSTOM_API.createBtnText;
        createBtn.disabled = true;
        const cancelBtn = footer?.querySelector('.pdt-dialog-cancel');
        footer?.insertBefore(createBtn, cancelBtn);

        // Pre-select plugin type if prefill has one
        if (prefill?._plugintypeid_value) {
            const pluginSelect = content.querySelector('#capi-new-plugintype');
            if (pluginSelect) {
                pluginSelect.value = prefill._plugintypeid_value;
            }
        }

        // Validation
        const revalidate = () => {
            const uname = content.querySelector('#capi-new-uniquename')?.value?.trim();
            const dname = content.querySelector('#capi-new-displayname')?.value?.trim();
            const desc = content.querySelector('#capi-new-description')?.value?.trim();
            createBtn.disabled = !uname || !dname || !desc;
        };
        content.querySelectorAll('input,textarea,select').forEach(el => {
            el.addEventListener('input', revalidate);
        });
        revalidate();

        // Create handler
        createBtn.addEventListener('click', () => this._handleCreateSubmit(content, dlg, createBtn, revalidate));
    }

    /**
     * Collects form values from the create dialog.
     * @private
     * @param {HTMLElement} container
     * @param {string} uniquename
     * @param {string} displayname
     * @returns {object}
     */
    _collectCreateFormValues(container, uniquename, displayname) {
        const val = (id) => container.querySelector(`#${id}`)?.value?.trim() || '';
        const checked = (id) => container.querySelector(`#${id}`)?.checked || false;
        const intVal = (id) => parseInt(container.querySelector(`#${id}`)?.value, 10);
        const pluginTypeId = val('capi-new-plugintype');
        const definition = {
            uniquename,
            name: val('capi-new-name') || uniquename,
            displayname,
            description: val('capi-new-description'),
            isfunction: val('capi-new-isfunction') === 'true',
            bindingtype: intVal('capi-new-bindingtype'),
            boundentitylogicalname: val('capi-new-boundentity'),
            allowedcustomprocessingsteptype: intVal('capi-new-processing'),
            executeprivilegename: val('capi-new-privilege'),
            isprivate: checked('capi-new-private'),
            workflowsdkstepenabled: checked('capi-new-workflow')
        };
        if (pluginTypeId) {
            definition['PluginTypeId@odata.bind'] = `/plugintypes(${pluginTypeId})`;
        }
        return definition;
    }

    /**
     * Builds the solution info HTML row for create dialogs.
     * @private
     * @returns {string} HTML string for solution info row
     */
    _buildSolutionInfoHtml() {
        if (this.selectedSolutionId && this.selectedSolutionName) {
            return `<div class="pdt-inline-row gap-12 grid-span-all pdt-soln-row">
                <span class="flex-1 pdt-soln-info pdt-soln-info--success">${Config.MESSAGES.CUSTOM_API.solutionSuccess} ${Config.MESSAGES.CUSTOM_API.solutionSelected(escapeHtml(this.selectedSolutionName), escapeHtml(this.selectedSolutionPrefix || 'n/a'))}</span>
            </div>`;
        }
        return `<div class="pdt-inline-row gap-12 grid-span-all pdt-soln-row">
            <span class="flex-1 pdt-soln-info pdt-soln-info--warning">${Config.MESSAGES.CUSTOM_API.solutionWarning(Config.MESSAGES.CUSTOM_API.selectSolutionBeforeCreate)}</span>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════════
    // EDIT DIALOG
    // ═══════════════════════════════════════════════════════════════

    /**
     * Opens dialog to edit mutable fields of a Custom API.
     * @private
     * @param {CustomApiDefinition} api
     */
    _openEditDialog(api) {
        const content = document.createElement('div');
        content.className = 'pdt-form-grid pdt-capi-edit-form';
        content.innerHTML = `
            <label>${Config.MESSAGES.CUSTOM_API.uniqueNameLabel}</label>
            <input type="text" class="pdt-input pdt-input-disabled" value="${escapeHtml(api.uniquename)}" disabled title="${Config.MESSAGES.CUSTOM_API.immutableField}">
            <label>${Config.MESSAGES.CUSTOM_API.nameLabel}</label>
            <input type="text" class="pdt-input pdt-input-disabled" value="${escapeHtml(api.name || '')}" disabled title="${Config.MESSAGES.CUSTOM_API.immutableField}">
            <label>${Config.MESSAGES.CUSTOM_API.displayNameLabel}</label>
            <input type="text" class="pdt-input" id="capi-edit-displayname" value="${escapeHtml(api.displayname || '')}">
            <label>${Config.MESSAGES.CUSTOM_API.descriptionLabel}</label>
            <textarea class="pdt-textarea" id="capi-edit-description" rows="2">${escapeHtml(api.description || '')}</textarea>
            <label>${Config.MESSAGES.CUSTOM_API.privilegeNameLabel}</label>
            <input type="text" class="pdt-input" id="capi-edit-privilege" value="${escapeHtml(api.executeprivilegename || '')}">
            <label>${Config.MESSAGES.CUSTOM_API.isPrivateLabel}</label>
            <label class="pdt-toggle-switch"><input type="checkbox" id="capi-edit-private" ${api.isprivate ? 'checked' : ''}><span class="pdt-toggle-slider"></span></label>
            <label>${Config.MESSAGES.CUSTOM_API.workflowEnabledLabel}</label>
            <label class="pdt-toggle-switch"><input type="checkbox" id="capi-edit-workflow" ${api.workflowsdkstepenabled ? 'checked' : ''}><span class="pdt-toggle-slider"></span></label>
            <div class="pdt-capi-immutable-notice">${Config.MESSAGES.CUSTOM_API.immutableNotice}</div>
            <span></span>
        `;

        // Track original values for dirty check
        const originals = {
            displayname: api.displayname || '',
            description: api.description || '',
            privilege: api.executeprivilegename || '',
            isprivate: !!api.isprivate,
            workflow: !!api.workflowsdkstepenabled
        };

        const dlg = DialogService.show(Config.MESSAGES.CUSTOM_API.editDialogTitle, content);
        const dlgEl = content.closest('.pdt-dialog');
        dlgEl?.classList.add('pdt-capi-dialog');
        const footer = dlgEl?.querySelector('.pdt-dialog-footer');

        // Insert custom Save button (disabled until changes detected)
        const saveBtn = document.createElement('button');
        saveBtn.className = 'modern-button';
        saveBtn.textContent = Config.MESSAGES.CUSTOM_API.saveBtnText;
        saveBtn.disabled = true;
        const cancelBtn = footer?.querySelector('.pdt-dialog-cancel');
        footer?.insertBefore(saveBtn, cancelBtn);

        const isDirty = () => {
            const dn = content.querySelector('#capi-edit-displayname')?.value?.trim() || '';
            const desc = content.querySelector('#capi-edit-description')?.value?.trim() || '';
            const priv = content.querySelector('#capi-edit-privilege')?.value?.trim() || '';
            const pvt = content.querySelector('#capi-edit-private')?.checked || false;
            const wf = content.querySelector('#capi-edit-workflow')?.checked || false;
            return dn !== originals.displayname || desc !== originals.description ||
                priv !== originals.privilege || pvt !== originals.isprivate || wf !== originals.workflow;
        };

        const revalidate = () => {
            saveBtn.disabled = !isDirty();
        };
        content.querySelectorAll('input,textarea,select').forEach(el => {
            el.addEventListener('input', revalidate);
            el.addEventListener('change', revalidate);
        });

        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = Config.MESSAGES.CUSTOM_API.saving;
            content.querySelectorAll('input,textarea,select').forEach(el => {
                el.disabled = true;
            });

            const changes = {
                displayname: content.querySelector('#capi-edit-displayname')?.value?.trim() || '',
                description: content.querySelector('#capi-edit-description')?.value?.trim() || '',
                executeprivilegename: content.querySelector('#capi-edit-privilege')?.value?.trim() || '',
                isprivate: content.querySelector('#capi-edit-private')?.checked || false,
                workflowsdkstepenabled: content.querySelector('#capi-edit-workflow')?.checked || false
            };

            try {
                BusyIndicator.set();
                await CustomApiService.update(api.customapiid, changes);
                NotificationService.show(Config.MESSAGES.CUSTOM_API.updateSuccess, 'success');
                dlg.close?.();
                await this._refreshData();
            } catch (err) {
                NotificationService.show(Config.MESSAGES.CUSTOM_API.updateFailed(ErrorParser.extract(err)), 'error');
                saveBtn.textContent = Config.MESSAGES.CUSTOM_API.saveBtnText;
                content.querySelectorAll('input,textarea,select').forEach(el => {
                    el.disabled = false;
                });
                content.querySelectorAll('.pdt-input-disabled').forEach(el => el.setAttribute('disabled', ''));
                revalidate();
            } finally {
                BusyIndicator.clear();
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // DELETE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Deletes a Custom API after confirmation.
     * @private
     * @param {CustomApiDefinition} api
     */
    async _handleDelete(api) {
        const contentEl = document.createElement('div');
        contentEl.innerHTML = `
            <div class="pdt-warning">
                <strong>Delete Custom API?</strong>
                <div class="pdt-dialog-details">
                    <strong>Unique Name:</strong> <span class="code-like">${escapeHtml(api.uniquename)}</span><br/>
                    ${api.displayname ? `<strong>Display Name:</strong> ${escapeHtml(api.displayname)}<br/>` : ''}
                    <strong>Type:</strong> ${api.isfunction ? 'Function (GET)' : 'Action (POST)'}
                </div>
                <div class="pdt-dialog-warning">
                    <span class="pdt-text-error">This will also delete all request parameters and response properties. This action cannot be undone.</span>
                </div>
            </div>
        `;

        const confirmed = await showConfirmDialog(Config.MESSAGES.CUSTOM_API.deleteConfirmTitle, contentEl);
        if (!confirmed) {
            return;
        }

        try {
            BusyIndicator.set();
            await CustomApiService.delete(api.customapiid);
            NotificationService.show(Config.MESSAGES.CUSTOM_API.deleteSuccess, 'success');
            await this._refreshData();
        } catch (err) {
            NotificationService.show(Config.MESSAGES.CUSTOM_API.deleteFailed(ErrorParser.extract(err)), 'error');
        } finally {
            BusyIndicator.clear();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ADD PARAMETER / PROPERTY DIALOGS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Collects form values from the add parameter dialog.
     * @private
     * @param {HTMLElement} content - Dialog content element
     * @param {string} apiUniquename - Parent API unique name
     * @returns {object|null} Parameter definition or null if uniquename is missing
     */
    _collectParamFormValues(content, apiUniquename) {
        const val = (id) => content.querySelector(`#${id}`)?.value?.trim() || '';
        const uniquename = content.querySelector('#capi-param-uniquename')?.value?.trim();
        if (!uniquename) {
            return null;
        }
        return {
            uniquename,
            name: `${apiUniquename}.${uniquename}`,
            displayname: val('capi-param-displayname') || uniquename,
            description: val('capi-param-description'),
            type: parseInt(content.querySelector('#capi-param-type')?.value, 10),
            logicalentityname: val('capi-param-entity'),
            isoptional: content.querySelector('#capi-param-optional')?.checked || false
        };
    }

    /**
     * Opens dialog to add a request parameter.
     * @private
     * @param {CustomApiDefinition} api
     */
    _openAddParamDialog(api) {
        const typeOptions = Object.entries(Config.CUSTOM_API_FIELD_TYPES)
            .map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`)
            .join('');

        const content = document.createElement('div');
        content.className = 'pdt-form-grid';
        content.innerHTML = `
            ${this._buildSolutionInfoHtml()}
            <label>${Config.MESSAGES.CUSTOM_API.customApiLabel}</label>
            <input type="text" class="pdt-input pdt-input-disabled" value="${escapeHtml(api.uniquename)}" disabled>
            <label>${Config.MESSAGES.CUSTOM_API.uniqueNameLabel} *</label>
            <input type="text" class="pdt-input" id="capi-param-uniquename" placeholder="InputParam1">
            <label>${Config.MESSAGES.CUSTOM_API.nameLabel}</label>
            <input type="text" class="pdt-input pdt-input-disabled" id="capi-param-name" placeholder="${Config.MESSAGES.CUSTOM_API.namePlaceholder}" disabled>
            <label>${Config.MESSAGES.CUSTOM_API.displayNameLabel}</label>
            <input type="text" class="pdt-input" id="capi-param-displayname">
            <label>${Config.MESSAGES.CUSTOM_API.descriptionLabel}</label>
            <input type="text" class="pdt-input" id="capi-param-description">
            <label>${Config.MESSAGES.CUSTOM_API.paramTypeLabel} *</label>
            <select class="pdt-select" id="capi-param-type">${typeOptions}</select>
            <label>${Config.MESSAGES.CUSTOM_API.logicalEntityNameLabel}</label>
            <input type="text" class="pdt-input" id="capi-param-entity" placeholder="${Config.MESSAGES.CUSTOM_API.logicalEntityPlaceholder}">
            <label>${Config.MESSAGES.CUSTOM_API.optionalLabel}</label>
            <label class="pdt-toggle-switch"><input type="checkbox" id="capi-param-optional"><span class="pdt-toggle-slider"></span></label>
        `;

        // Auto-generate Name: ApiUniqueName.ParamUniqueName
        const uniqueEl = content.querySelector('#capi-param-uniquename');
        const nameEl = content.querySelector('#capi-param-name');
        uniqueEl?.addEventListener('input', () => {
            nameEl.value = uniqueEl.value.trim() ? `${api.uniquename}.${uniqueEl.value.trim()}` : '';
        });

        const dlg = DialogService.show(Config.MESSAGES.CUSTOM_API.addParamTitle, content);
        const dlgEl = content.closest('.pdt-dialog');
        dlgEl?.classList.add('pdt-capi-dialog');
        const footer = dlgEl?.querySelector('.pdt-dialog-footer');

        const createBtn = document.createElement('button');
        createBtn.className = 'modern-button';
        createBtn.textContent = Config.MESSAGES.CUSTOM_API.createBtnText;
        createBtn.disabled = true;
        const cancelBtn = footer?.querySelector('.pdt-dialog-cancel');
        footer?.insertBefore(createBtn, cancelBtn);

        const revalidate = () => {
            const uname = content.querySelector('#capi-param-uniquename')?.value?.trim();
            createBtn.disabled = !uname;
        };
        content.querySelectorAll('input,textarea,select').forEach(el => {
            el.addEventListener('input', revalidate);
        });
        revalidate();

        createBtn.addEventListener('click', async () => {
            const param = this._collectParamFormValues(content, api.uniquename);
            if (!param) {
                NotificationService.show(Config.MESSAGES.CUSTOM_API.requiredFields, 'error');
                return;
            }

            createBtn.disabled = true;
            createBtn.textContent = Config.MESSAGES.CUSTOM_API.creating;
            content.querySelectorAll('input,textarea,select').forEach(el => {
                el.disabled = true;
            });

            try {
                BusyIndicator.set();
                await CustomApiService.addRequestParameter(api.customapiid, param, this.selectedSolutionName || '');
                NotificationService.show(Config.MESSAGES.CUSTOM_API.addParamSuccess, 'success');
                dlg.close?.();
                await this._refreshDataAndReExpand(api.customapiid);
            } catch (err) {
                NotificationService.show(Config.MESSAGES.CUSTOM_API.addParamFailed(ErrorParser.extract(err)), 'error');
                createBtn.textContent = Config.MESSAGES.CUSTOM_API.createBtnText;
                content.querySelectorAll('input,textarea,select').forEach(el => {
                    el.disabled = false;
                });
                // Re-disable the fields that should stay disabled
                content.querySelector('.pdt-input-disabled')?.setAttribute('disabled', '');
                content.querySelector('#capi-param-name')?.setAttribute('disabled', '');
                revalidate();
            } finally {
                BusyIndicator.clear();
            }
        });
    }

    /**
     * Opens dialog to add a response property.
     * @private
     * @param {CustomApiDefinition} api
     */
    _openAddPropDialog(api) {
        const typeOptions = Object.entries(Config.CUSTOM_API_FIELD_TYPES)
            .map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`)
            .join('');

        const content = document.createElement('div');
        content.className = 'pdt-form-grid';
        content.innerHTML = `
            ${this._buildSolutionInfoHtml()}
            <label>${Config.MESSAGES.CUSTOM_API.customApiLabel}</label>
            <input type="text" class="pdt-input pdt-input-disabled" value="${escapeHtml(api.uniquename)}" disabled>
            <label>${Config.MESSAGES.CUSTOM_API.uniqueNameLabel} *</label>
            <input type="text" class="pdt-input" id="capi-prop-uniquename" placeholder="OutputProp1">
            <label>${Config.MESSAGES.CUSTOM_API.nameLabel}</label>
            <input type="text" class="pdt-input pdt-input-disabled" id="capi-prop-name" placeholder="${Config.MESSAGES.CUSTOM_API.namePlaceholder}" disabled>
            <label>${Config.MESSAGES.CUSTOM_API.displayNameLabel}</label>
            <input type="text" class="pdt-input" id="capi-prop-displayname">
            <label>${Config.MESSAGES.CUSTOM_API.descriptionLabel}</label>
            <input type="text" class="pdt-input" id="capi-prop-description">
            <label>${Config.MESSAGES.CUSTOM_API.paramTypeLabel} *</label>
            <select class="pdt-select" id="capi-prop-type">${typeOptions}</select>
            <label>${Config.MESSAGES.CUSTOM_API.logicalEntityNameLabel}</label>
            <input type="text" class="pdt-input" id="capi-prop-entity" placeholder="${Config.MESSAGES.CUSTOM_API.logicalEntityPlaceholder}">
        `;

        // Auto-generate Name: ApiUniqueName.PropUniqueName
        const uniqueEl = content.querySelector('#capi-prop-uniquename');
        const nameEl = content.querySelector('#capi-prop-name');
        uniqueEl?.addEventListener('input', () => {
            nameEl.value = uniqueEl.value.trim() ? `${api.uniquename}.${uniqueEl.value.trim()}` : '';
        });

        const dlg = DialogService.show(Config.MESSAGES.CUSTOM_API.addPropTitle, content);
        const dlgEl = content.closest('.pdt-dialog');
        dlgEl?.classList.add('pdt-capi-dialog');
        const footer = dlgEl?.querySelector('.pdt-dialog-footer');

        const createBtn = document.createElement('button');
        createBtn.className = 'modern-button';
        createBtn.textContent = Config.MESSAGES.CUSTOM_API.createBtnText;
        createBtn.disabled = true;
        const cancelBtn = footer?.querySelector('.pdt-dialog-cancel');
        footer?.insertBefore(createBtn, cancelBtn);

        const revalidate = () => {
            const uname = content.querySelector('#capi-prop-uniquename')?.value?.trim();
            createBtn.disabled = !uname;
        };
        content.querySelectorAll('input,textarea,select').forEach(el => {
            el.addEventListener('input', revalidate);
        });
        revalidate();

        createBtn.addEventListener('click', async () => {
            const uniquename = content.querySelector('#capi-prop-uniquename')?.value?.trim();
            if (!uniquename) {
                NotificationService.show(Config.MESSAGES.CUSTOM_API.requiredFields, 'error');
                return;
            }

            const prop = {
                uniquename,
                name: `${api.uniquename}.${uniquename}`,
                displayname: content.querySelector('#capi-prop-displayname')?.value?.trim() || uniquename,
                description: content.querySelector('#capi-prop-description')?.value?.trim() || '',
                type: parseInt(content.querySelector('#capi-prop-type')?.value, 10),
                logicalentityname: content.querySelector('#capi-prop-entity')?.value?.trim() || ''
            };

            createBtn.disabled = true;
            createBtn.textContent = Config.MESSAGES.CUSTOM_API.creating;
            content.querySelectorAll('input,textarea,select').forEach(el => {
                el.disabled = true;
            });

            try {
                BusyIndicator.set();
                await CustomApiService.addResponseProperty(api.customapiid, prop, this.selectedSolutionName || '');
                NotificationService.show(Config.MESSAGES.CUSTOM_API.addPropSuccess, 'success');
                dlg.close?.();
                await this._refreshDataAndReExpand(api.customapiid);
            } catch (err) {
                NotificationService.show(Config.MESSAGES.CUSTOM_API.addPropFailed(ErrorParser.extract(err)), 'error');
                createBtn.textContent = Config.MESSAGES.CUSTOM_API.createBtnText;
                content.querySelectorAll('input,textarea,select').forEach(el => {
                    el.disabled = false;
                });
                // Re-disable the fields that should stay disabled
                content.querySelector('.pdt-input-disabled')?.setAttribute('disabled', '');
                content.querySelector('#capi-prop-name')?.setAttribute('disabled', '');
                revalidate();
            } finally {
                BusyIndicator.clear();
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // EDIT / DELETE PARAMETER & PROPERTY DIALOGS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Opens dialog to edit a request parameter.
     * @private
     * @param {object} param
     */
    _openEditParamDialog(param) {
        const content = document.createElement('div');
        content.className = 'pdt-form-grid';
        content.innerHTML = `
            <label>${Config.MESSAGES.CUSTOM_API.uniqueNameLabel}</label>
            <input type="text" class="pdt-input pdt-input-disabled" value="${escapeHtml(param.uniquename)}" disabled>
            <label>${Config.MESSAGES.CUSTOM_API.displayNameLabel}</label>
            <input type="text" class="pdt-input" id="capi-eparam-displayname" value="${escapeHtml(param.displayname || '')}">
            <label>${Config.MESSAGES.CUSTOM_API.descriptionLabel}</label>
            <input type="text" class="pdt-input" id="capi-eparam-description" value="${escapeHtml(param.description || '')}">
            <label>${Config.MESSAGES.CUSTOM_API.optionalLabel}</label>
            <label class="pdt-toggle-switch"><input type="checkbox" id="capi-eparam-optional" ${param.isoptional ? 'checked' : ''}><span class="pdt-toggle-slider"></span></label>
        `;

        // Track original values
        const originals = {
            displayname: param.displayname || '',
            description: param.description || '',
            isoptional: !!param.isoptional
        };

        const dlg = DialogService.show(Config.MESSAGES.CUSTOM_API.editParamTitle, content);
        const dlgEl = content.closest('.pdt-dialog');
        dlgEl?.classList.add('pdt-capi-dialog');
        const footer = dlgEl?.querySelector('.pdt-dialog-footer');

        const saveBtn = document.createElement('button');
        saveBtn.className = 'modern-button';
        saveBtn.textContent = Config.MESSAGES.CUSTOM_API.saveBtnText;
        saveBtn.disabled = true;
        const cancelBtn = footer?.querySelector('.pdt-dialog-cancel');
        footer?.insertBefore(saveBtn, cancelBtn);

        const isDirty = () => {
            const dn = content.querySelector('#capi-eparam-displayname')?.value?.trim() || '';
            const desc = content.querySelector('#capi-eparam-description')?.value?.trim() || '';
            const opt = content.querySelector('#capi-eparam-optional')?.checked || false;
            return dn !== originals.displayname || desc !== originals.description || opt !== originals.isoptional;
        };

        const revalidate = () => {
            saveBtn.disabled = !isDirty();
        };
        content.querySelectorAll('input,textarea,select').forEach(el => {
            el.addEventListener('input', revalidate);
            el.addEventListener('change', revalidate);
        });

        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = Config.MESSAGES.CUSTOM_API.saving;
            content.querySelectorAll('input,textarea,select').forEach(el => {
                el.disabled = true;
            });

            const changes = {
                displayname: content.querySelector('#capi-eparam-displayname')?.value?.trim() || '',
                description: content.querySelector('#capi-eparam-description')?.value?.trim() || '',
                isoptional: content.querySelector('#capi-eparam-optional')?.checked || false
            };

            try {
                BusyIndicator.set();
                await CustomApiService.updateRequestParameter(param.customapirequestparameterid, changes);
                NotificationService.show(Config.MESSAGES.CUSTOM_API.paramUpdated, 'success');
                dlg.close?.();
                await this._refreshData();
            } catch (err) {
                NotificationService.show(Config.MESSAGES.CUSTOM_API.paramUpdateFailed(ErrorParser.extract(err)), 'error');
                saveBtn.textContent = Config.MESSAGES.CUSTOM_API.saveBtnText;
                content.querySelectorAll('input,textarea,select').forEach(el => {
                    el.disabled = false;
                });
                content.querySelectorAll('.pdt-input-disabled').forEach(el => el.setAttribute('disabled', ''));
                revalidate();
            } finally {
                BusyIndicator.clear();
            }
        });
    }

    /**
     * Deletes a request parameter with styled confirmation.
     * @private
     * @param {string} paramId
     * @param {string} paramName
     */
    async _handleDeleteParam(paramId, paramName) {
        const contentEl = document.createElement('div');
        contentEl.innerHTML = `
            <div class="pdt-warning">
                <strong>Delete Request Parameter?</strong>
                <div class="pdt-dialog-details">
                    <strong>Name:</strong> <span class="code-like">${escapeHtml(paramName)}</span>
                </div>
                <div class="pdt-dialog-warning">
                    <span class="pdt-text-error">This action cannot be undone.</span>
                </div>
            </div>
        `;

        const confirmed = await showConfirmDialog('Delete Request Parameter', contentEl);
        if (!confirmed) {
            return;
        }

        try {
            BusyIndicator.set();
            await CustomApiService.deleteRequestParameter(paramId);
            NotificationService.show(Config.MESSAGES.CUSTOM_API.paramDeleted, 'success');
            await this._refreshData();
        } catch (err) {
            NotificationService.show(Config.MESSAGES.CUSTOM_API.paramDeleteFailed(ErrorParser.extract(err)), 'error');
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Opens dialog to edit a response property.
     * @private
     * @param {object} prop
     */
    _openEditPropDialog(prop) {
        const content = document.createElement('div');
        content.className = 'pdt-form-grid';
        content.innerHTML = `
            <label>${Config.MESSAGES.CUSTOM_API.uniqueNameLabel}</label>
            <input type="text" class="pdt-input pdt-input-disabled" value="${escapeHtml(prop.uniquename)}" disabled>
            <label>${Config.MESSAGES.CUSTOM_API.displayNameLabel}</label>
            <input type="text" class="pdt-input" id="capi-eprop-displayname" value="${escapeHtml(prop.displayname || '')}">
            <label>${Config.MESSAGES.CUSTOM_API.descriptionLabel}</label>
            <input type="text" class="pdt-input" id="capi-eprop-description" value="${escapeHtml(prop.description || '')}">
        `;

        // Track original values
        const originals = {
            displayname: prop.displayname || '',
            description: prop.description || ''
        };

        const dlg = DialogService.show(Config.MESSAGES.CUSTOM_API.editPropTitle, content);
        const dlgEl = content.closest('.pdt-dialog');
        const footer = dlgEl?.querySelector('.pdt-dialog-footer');

        const saveBtn = document.createElement('button');
        saveBtn.className = 'modern-button';
        saveBtn.textContent = Config.MESSAGES.CUSTOM_API.saveBtnText;
        saveBtn.disabled = true;
        const cancelBtn = footer?.querySelector('.pdt-dialog-cancel');
        footer?.insertBefore(saveBtn, cancelBtn);

        const isDirty = () => {
            const dn = content.querySelector('#capi-eprop-displayname')?.value?.trim() || '';
            const desc = content.querySelector('#capi-eprop-description')?.value?.trim() || '';
            return dn !== originals.displayname || desc !== originals.description;
        };

        const revalidate = () => {
            saveBtn.disabled = !isDirty();
        };
        content.querySelectorAll('input,textarea').forEach(el => {
            el.addEventListener('input', revalidate);
        });

        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = Config.MESSAGES.CUSTOM_API.saving;
            content.querySelectorAll('input,textarea').forEach(el => {
                el.disabled = true;
            });

            const changes = {
                displayname: content.querySelector('#capi-eprop-displayname')?.value?.trim() || '',
                description: content.querySelector('#capi-eprop-description')?.value?.trim() || ''
            };

            try {
                BusyIndicator.set();
                await CustomApiService.updateResponseProperty(prop.customapiresponsepropertyid, changes);
                NotificationService.show(Config.MESSAGES.CUSTOM_API.propUpdated, 'success');
                dlg.close?.();
                await this._refreshData();
            } catch (err) {
                NotificationService.show(Config.MESSAGES.CUSTOM_API.propUpdateFailed(ErrorParser.extract(err)), 'error');
                saveBtn.textContent = Config.MESSAGES.CUSTOM_API.saveBtnText;
                content.querySelectorAll('input,textarea').forEach(el => {
                    el.disabled = false;
                });
                content.querySelectorAll('.pdt-input-disabled').forEach(el => el.setAttribute('disabled', ''));
                revalidate();
            } finally {
                BusyIndicator.clear();
            }
        });
    }

    /**
     * Deletes a response property with styled confirmation.
     * @private
     * @param {string} propId
     * @param {string} propName
     */
    async _handleDeleteProp(propId, propName) {
        const contentEl = document.createElement('div');
        contentEl.innerHTML = `
            <div class="pdt-warning">
                <strong>Delete Response Property?</strong>
                <div class="pdt-dialog-details">
                    <strong>Name:</strong> <span class="code-like">${escapeHtml(propName)}</span>
                </div>
                <div class="pdt-dialog-warning">
                    <span class="pdt-text-error">This action cannot be undone.</span>
                </div>
            </div>
        `;

        const confirmed = await showConfirmDialog('Delete Response Property', contentEl);
        if (!confirmed) {
            return;
        }

        try {
            BusyIndicator.set();
            await CustomApiService.deleteResponseProperty(propId);
            NotificationService.show(Config.MESSAGES.CUSTOM_API.propDeleted, 'success');
            await this._refreshData();
        } catch (err) {
            NotificationService.show(Config.MESSAGES.CUSTOM_API.propDeleteFailed(ErrorParser.extract(err)), 'error');
        } finally {
            BusyIndicator.clear();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORT / IMPORT
    // ═══════════════════════════════════════════════════════════════

    /**
     * Exports a Custom API definition as a JSON file.
     * @private
     * @param {CustomApiDefinition} api
     */
    _handleExport(api) {
        const definition = CustomApiService.exportDefinition(api);
        const json = JSON.stringify(definition, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${api.uniquename}.customapi.json`;
        a.click();
        URL.revokeObjectURL(url);
        NotificationService.show(Config.MESSAGES.CUSTOM_API.exportSuccess, 'success');
    }

    /** @private Opens file picker to import a Custom API definition, then opens create dialog for review. */
    _handleImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) {
                return;
            }

            try {
                const text = await file.text();
                const definition = JSON.parse(text);

                if (!definition.uniquename) {
                    NotificationService.show(Config.MESSAGES.CUSTOM_API.importInvalid, 'error');
                    return;
                }

                // Open the Create Dialog pre-filled with import data for user review
                await this._openCreateDialog(definition);
            } catch (err) {
                NotificationService.show(Config.MESSAGES.CUSTOM_API.importFailed(ErrorParser.extract(err)), 'error');
            }
        });
        input.click();
    }

    // ═══════════════════════════════════════════════════════════════
    // TESTER VIEW
    // ═══════════════════════════════════════════════════════════════

    /** @private Populates the API selector dropdown in the tester. */
    _populateTesterSelect() {
        if (!this.ui.apiSelect) {
            return;
        }
        const options = this.allApis.map(api => {
            const type = api.isfunction ? 'FN' : 'ACT';
            return `<option value="${api.customapiid}">[${type}] ${escapeHtml(api.uniquename)}</option>`;
        }).join('');
        this.ui.apiSelect.innerHTML = `<option value="">${Config.MESSAGES.CUSTOM_API.selectApiPlaceholder}</option>${options}`;
    }

    /** @private Called when an API is selected in the tester dropdown. */
    _onApiSelected() {
        const apiId = this.ui.apiSelect?.value;
        this.selectedApi = this.allApis.find(a => a.customapiid === apiId) || null;

        if (!this.selectedApi) {
            this.ui.executeBtn.disabled = true;
            this.ui.endpointPreview.textContent = '—';
            this.ui.methodBadge.textContent = '—';
            this.ui.methodBadge.className = 'pdt-capi-method-badge';
            this.ui.paramSection.style.display = 'none';
            this.ui.targetSection.style.display = 'none';
            this.ui.codeGen.style.display = 'none';
            return;
        }

        this.ui.executeBtn.disabled = false;
        const api = this.selectedApi;

        // Method badge
        const method = api.isfunction ? 'GET' : 'POST';
        this.ui.methodBadge.textContent = method;
        this.ui.methodBadge.className = `pdt-capi-method-badge pdt-capi-method-${method.toLowerCase()}`;

        // Show target input for entity-bound APIs
        const isBound = api.bindingtype === 1 || api.bindingtype === 2;
        this.ui.targetSection.style.display = isBound ? '' : 'none';

        // Build parameter inputs
        const params = (api.CustomAPIRequestParameters || [])
            .filter(p => p.uniquename !== 'Target');
        this.ui.paramSection.style.display = params.length > 0 ? '' : 'none';
        this._buildParamInputs(params);

        // Update endpoint preview
        this._updateEndpointPreview();

        // Show code generation
        this.ui.codeGen.style.display = '';
        this._updateCodeOutput('javascript');
    }

    /**
     * Creates a validated input field with error display for parameter forms.
     * @private
     * @param {object} param - Parameter definition
     * @param {string} placeholder - Input placeholder text
     * @param {object} validationConfig - Validation configuration object
     * @param {function(string): boolean} validationConfig.validate - Returns true if the value is valid
     * @param {function(string): string} validationConfig.getError - Returns the error message for the given param name
     * @returns {HTMLDivElement} Wrapper containing input and error message
     */
    _createValidatedParamInput(param, placeholder, validationConfig) {
        const wrapper = document.createElement('div');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'pdt-input capi-param-value';
        input.dataset.paramName = param.uniquename;
        input.placeholder = placeholder;

        const errorMsg = document.createElement('div');
        errorMsg.className = 'pdt-capi-json-error';
        errorMsg.style.display = 'none';
        wrapper.appendChild(input);
        wrapper.appendChild(errorMsg);

        input.addEventListener('input', () => {
            const val = input.value.trim();
            if (val) {
                if (validationConfig.validate(val)) {
                    input.classList.remove('pdt-input-error');
                    errorMsg.style.display = 'none';
                    this.ui.executeBtn.disabled = false;
                } else {
                    input.classList.add('pdt-input-error');
                    errorMsg.textContent = validationConfig.getError(param.uniquename);
                    errorMsg.style.display = '';
                    this.ui.executeBtn.disabled = true;
                }
            } else {
                input.classList.remove('pdt-input-error');
                errorMsg.style.display = 'none';
                this.ui.executeBtn.disabled = false;
            }
        });

        return wrapper;
    }

    /**
     * Builds input fields for each request parameter.
     * @private
     * @param {CustomApiRequestParam[]} params
     */
    _buildParamInputs(params) {
        if (!this.ui.paramInputs) {
            return;
        }
        this.ui.paramInputs.innerHTML = '';

        for (const param of params) {
            const typeLabel = CustomApiService.getTypeLabel(param.type);
            const required = !param.isoptional ? ' *' : '';
            const label = document.createElement('label');
            label.textContent = `${param.uniquename}${required}`;
            label.title = `${typeLabel}${param.description ? ': ' + param.description : ''}`;

            let input;
            if (param.type === 0) { // Boolean
                input = document.createElement('select');
                input.className = 'pdt-select capi-param-value';
                input.dataset.paramName = param.uniquename;
                input.innerHTML = '<option value="">—</option><option value="true">true</option><option value="false">false</option>';
            } else if (param.type === 1) { // DateTime
                input = document.createElement('input');
                input.type = 'datetime-local';
                input.className = 'pdt-input capi-param-value';
                input.dataset.paramName = param.uniquename;
                input.title = Config.MESSAGES.CUSTOM_API.dateTimePlaceholder;
            } else if (param.type === 3 || param.type === 4 || param.type === 5) { // Entity, EntityCollection, EntityReference
                const wrapper = document.createElement('div');
                const textarea = document.createElement('textarea');
                textarea.className = 'pdt-textarea capi-param-value';
                textarea.dataset.paramName = param.uniquename;
                textarea.rows = 3;
                textarea.placeholder = `JSON for ${typeLabel}`;
                const errorMsg = document.createElement('div');
                errorMsg.className = 'pdt-capi-json-error';
                errorMsg.style.display = 'none';
                wrapper.appendChild(textarea);
                wrapper.appendChild(errorMsg);

                // Validate JSON on input
                textarea.addEventListener('input', () => {
                    const val = textarea.value.trim();
                    if (val) {
                        try {
                            JSON.parse(val);
                            textarea.classList.remove('pdt-input-error');
                            errorMsg.style.display = 'none';
                            this.ui.executeBtn.disabled = false;
                        } catch {
                            textarea.classList.add('pdt-input-error');
                            errorMsg.textContent = Config.MESSAGES.CUSTOM_API.invalidJsonParam(param.uniquename);
                            errorMsg.style.display = '';
                            this.ui.executeBtn.disabled = true;
                        }
                    } else {
                        textarea.classList.remove('pdt-input-error');
                        errorMsg.style.display = 'none';
                        this.ui.executeBtn.disabled = false;
                    }
                });

                this.ui.paramInputs.appendChild(label);
                this.ui.paramInputs.appendChild(wrapper);
                continue;
            } else if (param.type === 7 || param.type === 9) { // Integer, Picklist
                const wrapper = this._createValidatedParamInput(
                    param,
                    `${typeLabel}${param.description ? ' - ' + param.description : ''}`,
                    {
                        validate: (val) => /^-?\d+$/.test(val),
                        getError: Config.MESSAGES.CUSTOM_API.invalidIntegerParam
                    }
                );
                this.ui.paramInputs.appendChild(label);
                this.ui.paramInputs.appendChild(wrapper);
                continue;
            } else if (param.type === 2 || param.type === 6 || param.type === 8) { // Decimal, Float, Money
                const wrapper = this._createValidatedParamInput(
                    param,
                    `${typeLabel}${param.description ? ' - ' + param.description : ''}`,
                    {
                        validate: (val) => /^-?\d+(\.\d+)?$/.test(val),
                        getError: Config.MESSAGES.CUSTOM_API.invalidDecimalParam
                    }
                );
                this.ui.paramInputs.appendChild(label);
                this.ui.paramInputs.appendChild(wrapper);
                continue;
            } else if (param.type === 12) { // Guid
                const wrapper = this._createValidatedParamInput(
                    param,
                    'GUID (e.g., 00000000-0000-0000-0000-000000000000)',
                    {
                        validate: (val) => /^[{(]?[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}[})]?$/i.test(val),
                        getError: Config.MESSAGES.CUSTOM_API.invalidGuidParam
                    }
                );
                this.ui.paramInputs.appendChild(label);
                this.ui.paramInputs.appendChild(wrapper);
                continue;
            } else if (param.type === 11) { // StringArray
                const wrapper = this._createValidatedParamInput(
                    param,
                    Config.MESSAGES.CUSTOM_API.stringArrayPlaceholder,
                    {
                        validate: (val) => {
                            const trimmed = val.trim();
                            if (trimmed.startsWith('[')) {
                                try {
                                    JSON.parse(trimmed);
                                    return true;
                                } catch {
                                    return false;
                                }
                            }
                            return true;
                        },
                        getError: Config.MESSAGES.CUSTOM_API.invalidStringArrayParam
                    }
                );
                this.ui.paramInputs.appendChild(label);
                this.ui.paramInputs.appendChild(wrapper);
                continue;
            } else {
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'pdt-input capi-param-value';
                input.dataset.paramName = param.uniquename;
                input.placeholder = `${typeLabel}${param.description ? ' - ' + param.description : ''}`;
            }

            this.ui.paramInputs.appendChild(label);
            this.ui.paramInputs.appendChild(input);
        }
    }

    /** @private Collects current parameter values from the form. */
    _collectParamValues() {
        const values = {};
        this.ui.paramInputs?.querySelectorAll('.capi-param-value').forEach(el => {
            const name = el.dataset.paramName;
            const val = el.value?.trim();
            if (val) {
                values[name] = val;
            }
        });
        return values;
    }

    /** @private Updates endpoint preview based on current selections. */
    _updateEndpointPreview() {
        if (!this.selectedApi || !this.ui.endpointPreview) {
            return;
        }
        const targetId = this.ui.targetId?.value?.trim() || '{id}';
        const paramValues = this._collectParamValues();
        const endpoint = CustomApiService.buildEndpointUrl(this.selectedApi, targetId, paramValues);
        this.ui.endpointPreview.textContent = endpoint;
    }

    // ═══════════════════════════════════════════════════════════════
    // EXECUTE
    // ═══════════════════════════════════════════════════════════════

    /** @private Executes the selected Custom API. */
    async _handleExecute() {
        if (!this.selectedApi) {
            return;
        }

        const api = this.selectedApi;
        const paramValues = this._collectParamValues();
        const targetId = this.ui.targetId?.value?.trim() || '';
        const customHeaders = this._collectCustomHeaders();

        try {
            BusyIndicator.set();
            this.ui.executeBtn.disabled = true;

            const result = await CustomApiService.execute(api, paramValues, targetId, customHeaders);
            this._displayResponse(result);
            this._addToHistory(api, paramValues, result);
            this._updateCodeOutput('javascript');

            if (result.status >= 200 && result.status < 300) {
                NotificationService.show(Config.MESSAGES.CUSTOM_API.executeSuccess, 'success');
            } else {
                NotificationService.show(Config.MESSAGES.CUSTOM_API.executeFailed(
                    `HTTP ${result.status}: ${result.statusText}`
                ), 'error');
            }
        } catch (err) {
            NotificationService.show(Config.MESSAGES.CUSTOM_API.executeFailed(ErrorParser.extract(err)), 'error');
        } finally {
            BusyIndicator.clear(this.ui.executeBtn);
        }
    }

    /**
     * Collects custom headers from the header inputs.
     * @private
     * @returns {object}
     */
    _collectCustomHeaders() {
        const headers = {};
        const rows = this.ui.headersContainer?.querySelectorAll('.pdt-capi-header-row') || [];
        rows.forEach(row => {
            const n = row.querySelector('.capi-header-name')?.value?.trim();
            const v = row.querySelector('.capi-header-value')?.value?.trim();
            if (n && v) {
                headers[n] = v;
            }
        });
        return headers;
    }

    /** @private Adds a new custom header row. */
    _addHeaderRow() {
        if (!this.ui.headersContainer) {
            return;
        }
        const row = document.createElement('div');
        row.className = 'pdt-capi-header-row pdt-inline-row gap-8';
        row.style.marginBottom = '6px';
        row.innerHTML = `
            <input type="text" class="pdt-input capi-header-name" style="flex:1;" placeholder="Header Name">
            <input type="text" class="pdt-input capi-header-value" style="flex:1;" placeholder="Header Value">
            <button class="modern-button danger secondary capi-remove-header-btn" title="Remove">X</button>
        `;
        this.ui.headersContainer.appendChild(row);
    }

    /**
     * Displays the API execution response.
     * @private
     * @param {{status: number, statusText: string, body: *, headers: object, duration: number, size: number}} result
     */
    _displayResponse(result) {
        if (!this.ui.responsePanel) {
            return;
        }
        this.ui.responsePanel.style.display = '';

        // Status badge
        const statusClass = result.status >= 200 && result.status < 300 ? 'pdt-capi-status-success' :
            result.status >= 400 ? 'pdt-capi-status-error' : 'pdt-capi-status-warn';
        this.ui.responseStatus.innerHTML = `<span class="${statusClass}">${result.status} ${escapeHtml(result.statusText)}</span>`;
        this.ui.responseTime.textContent = `${result.duration}ms`;
        this.ui.responseSize.textContent = this._formatSize(result.size);

        // Body — store result and reset to JSON format
        this._lastResponseResult = result;
        this._activeResponseFormat = 'json';
        const formatTabs = this.ui.responseFormatTabs?.querySelectorAll('.pdt-capi-resp-format-tab') || [];
        formatTabs.forEach(t => t.classList.toggle('active', t.dataset.format === 'json'));
        this.ui.responseJson.textContent = this._formatResponseBody(result.body, 'json');

        // Headers
        this.ui.responseHeadersJson.textContent = JSON.stringify(result.headers, null, 2);
    }

    /**
     * Formats bytes into a human-readable size string.
     * @private
     * @param {number} bytes
     * @returns {string}
     */
    _formatSize(bytes) {
        if (bytes < 1024) {
            return `${bytes} B`;
        }
        if (bytes < 1048576) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${(bytes / 1048576).toFixed(1)} MB`;
    }

    /**
     * Switches between response body and headers tabs.
     * @private
     * @param {'body'|'headers'} panel
     */
    _switchResponseTab(panel) {
        const tabs = this.ui.responsePanel?.querySelectorAll('.pdt-capi-resp-tab') || [];
        tabs.forEach(t => t.classList.toggle('active', t.dataset.panel === panel));

        const bodyPanel = document.getElementById('capi-response-body');
        const headersPanel = document.getElementById('capi-response-headers');
        if (bodyPanel) {
            bodyPanel.style.display = panel === 'body' ? '' : 'none';
        }
        if (headersPanel) {
            headersPanel.style.display = panel === 'headers' ? '' : 'none';
        }
    }

    /**
     * Switches the response body display format.
     * @private
     * @param {'json'|'xml'|'raw'} format
     */
    _switchResponseFormat(format) {
        this._activeResponseFormat = format;
        const tabs = this.ui.responseFormatTabs?.querySelectorAll('.pdt-capi-resp-format-tab') || [];
        tabs.forEach(t => t.classList.toggle('active', t.dataset.format === format));
        if (this.ui.responseJson && this._lastResponseResult) {
            this.ui.responseJson.textContent = this._formatResponseBody(this._lastResponseResult.body, format);
        }
    }

    /**
     * Formats the response body for display in the given format.
     * @private
     * @param {*} body - The response body (parsed object or string).
     * @param {'json'|'xml'|'raw'} format
     * @returns {string}
     */
    _formatResponseBody(body, format) {
        if (body === null || body === undefined) {
            return Config.MESSAGES.CUSTOM_API.emptyResponse;
        }
        switch (format) {
            case 'xml':
                return this._jsonToXml(body, 'response');
            case 'raw':
                return typeof body === 'string' ? body : JSON.stringify(body);
            case 'json':
            default:
                return typeof body === 'string' ? body : JSON.stringify(body, null, 2);
        }
    }

    /**
     * Recursively converts a JavaScript value into a formatted XML string.
     * @private
     * @param {*} obj - Value to serialize.
     * @param {string} tag - Enclosing XML tag name.
     * @param {number} [depth=0] - Current indentation depth.
     * @returns {string}
     */
    _jsonToXml(obj, tag, depth = 0) {
        const pad = '  '.repeat(depth);
        const safeTag = String(tag).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^(\d|-)/, '_$1');
        if (obj === null || obj === undefined) {
            return `${pad}<${safeTag}/>`;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this._jsonToXml(item, safeTag, depth)).join('\n');
        }
        if (typeof obj !== 'object') {
            return `${pad}<${safeTag}>${escapeHtml(String(obj))}</${safeTag}>`;
        }
        const children = Object.entries(obj)
            .map(([k, v]) => this._jsonToXml(v, k, depth + 1))
            .join('\n');
        return children
            ? `${pad}<${safeTag}>\n${children}\n${pad}</${safeTag}>`
            : `${pad}<${safeTag}/>`;
    }

    // ═══════════════════════════════════════════════════════════════
    // CODE GENERATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Switches code generation language tab and updates output.
     * @private
     * @param {string} lang
     */
    _switchCodeLang(lang) {
        const tabs = this.ui.codeGen?.querySelectorAll('.pdt-capi-code-tab') || [];
        tabs.forEach(t => t.classList.toggle('active', t.dataset.lang === lang));
        this._updateCodeOutput(lang);
    }

    /**
     * Updates the code output panel.
     * @private
     * @param {string} lang
     */
    _updateCodeOutput(lang) {
        if (!this.selectedApi || !this.ui.codeOutput) {
            return;
        }
        const paramValues = this._collectParamValues();
        const targetId = this.ui.targetId?.value?.trim() || '';
        const code = CustomApiService.generateCodeSnippet(this.selectedApi, paramValues, lang, targetId);
        this.ui.codeOutput.value = code;
    }

    // ═══════════════════════════════════════════════════════════════
    // EXECUTION HISTORY
    // ═══════════════════════════════════════════════════════════════

    /**
     * Adds an execution to the history panel.
     * @private
     * @param {CustomApiDefinition} api
     * @param {object} paramValues
     * @param {object} result
     */
    _addToHistory(api, paramValues, result) {
        const entry = {
            timestamp: new Date().toLocaleTimeString(),
            apiName: api.uniquename,
            method: api.isfunction ? 'GET' : 'POST',
            status: result.status,
            statusText: result.statusText,
            duration: result.duration,
            size: result.size,
            paramValues: { ...paramValues },
            body: result.body,
            headers: result.headers
        };
        this.executionHistory.unshift(entry);
        if (this.executionHistory.length > 20) {
            this.executionHistory.pop();
        }
        this._renderHistory();
    }

    /** @private Renders the execution history list. */
    _renderHistory() {
        if (!this.ui.historyPanel || !this.ui.historyList) {
            return;
        }
        this.ui.historyPanel.style.display = this.executionHistory.length > 0 ? '' : 'none';

        this.ui.historyList.innerHTML = this.executionHistory.map((entry, idx) => {
            const statusClass = entry.status >= 200 && entry.status < 300 ? 'pdt-capi-status-success' : 'pdt-capi-status-error';
            return `
                <div class="pdt-capi-history-entry" data-history-idx="${idx}" role="button" tabindex="0" title="Click to view details">
                    <span class="pdt-capi-history-time">${escapeHtml(entry.timestamp)}</span>
                    <span class="pdt-capi-method-badge pdt-capi-method-${entry.method.toLowerCase()}">${entry.method}</span>
                    <span class="pdt-capi-history-name">${escapeHtml(entry.apiName)}</span>
                    <span class="${statusClass}">${entry.status}</span>
                    <span class="pdt-capi-history-duration">${entry.duration}ms</span>
                </div>
            `;
        }).join('');
    }

    /**
     * Shows a dialog with the full execution detail for a history entry.
     * @private
     * @param {number} idx - History index
     */
    _showHistoryDetail(idx) {
        const entry = this.executionHistory[idx];
        if (!entry) {
            return;
        }

        const statusClass = entry.status >= 200 && entry.status < 300 ? 'pdt-capi-status-success' : 'pdt-capi-status-error';
        const bodyStr = entry.body ? JSON.stringify(entry.body, null, 2) : '(empty response)';
        const headersStr = entry.headers ? JSON.stringify(entry.headers, null, 2) : '{}';
        const paramsStr = Object.keys(entry.paramValues || {}).length > 0
            ? JSON.stringify(entry.paramValues, null, 2) : '(none)';

        const content = document.createElement('div');
        content.innerHTML = `
            <div class="info-grid" style="margin-bottom: 12px;">
                <strong>API:</strong><span class="code-like">${escapeHtml(entry.apiName)}</span>
                <strong>Method:</strong><span class="pdt-capi-method-badge pdt-capi-method-${entry.method.toLowerCase()}">${entry.method}</span>
                <strong>Status:</strong><span class="${statusClass}">${entry.status} ${escapeHtml(entry.statusText || '')}</span>
                <strong>Duration:</strong><span>${entry.duration}ms</span>
                <strong>Size:</strong><span>${this._formatSize(entry.size || 0)}</span>
                <strong>Time:</strong><span>${escapeHtml(entry.timestamp)}</span>
            </div>
            <div class="pdt-capi-section-header">Parameters</div>
            <pre class="pdt-capi-code-output" style="max-height:120px;">${escapeHtml(paramsStr)}</pre>
            <div class="pdt-capi-section-header" style="margin-top:10px;">Response Body</div>
            <pre class="pdt-capi-code-output" style="max-height:300px;">${escapeHtml(bodyStr)}</pre>
            <div class="pdt-capi-section-header" style="margin-top:10px;">Response Headers</div>
            <pre class="pdt-capi-code-output" style="max-height:120px;">${escapeHtml(headersStr)}</pre>
        `;

        const _dlg = DialogService.show(Config.MESSAGES.CUSTOM_API.historyDetailTitle, content);
        const dlgEl = content.closest('.pdt-dialog');
        dlgEl?.classList.add('pdt-capi-dialog');
        const footer = dlgEl?.querySelector('.pdt-dialog-footer');

        // Add Export button beside Close
        const exportBtn = document.createElement('button');
        exportBtn.className = 'modern-button secondary';
        exportBtn.textContent = Config.MESSAGES.CUSTOM_API.exportDetailBtn;
        const cancelBtn = footer?.querySelector('.pdt-dialog-cancel');
        footer?.insertBefore(exportBtn, cancelBtn);

        exportBtn.addEventListener('click', () => {
            const exportData = {
                apiName: entry.apiName,
                method: entry.method,
                status: entry.status,
                statusText: entry.statusText,
                duration: entry.duration,
                size: entry.size,
                timestamp: entry.timestamp,
                parameters: entry.paramValues,
                responseBody: entry.body,
                responseHeaders: entry.headers
            };
            const json = JSON.stringify(exportData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${entry.apiName}-${entry.timestamp.replace(/:/g, '-')}.execution.json`;
            a.click();
            URL.revokeObjectURL(url);
            NotificationService.show(Config.MESSAGES.CUSTOM_API.exportDetailSuccess, 'success');
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // DATA REFRESH
    // ═══════════════════════════════════════════════════════════════

    /**
     * Refreshes data and re-expands the card for the given API.
     * @private
     * @param {string} apiId - The API ID whose card should be re-expanded
     */
    async _refreshDataAndReExpand(apiId) {
        await this._refreshData();
        const card = this.ui.listContainer?.querySelector(`.pdt-capi-card[data-api-id="${CSS.escape(apiId)}"]`);
        const btn = card?.querySelector('.capi-expand-btn');
        if (card && btn) {
            this._toggleExpand(card, btn);
        }
    }

    /** @private Refreshes all API data and re-renders the browser. */
    async _refreshData() {
        try {
            if (this.selectedSolutionId) {
                this.allApis = await CustomApiService.fetchBySolution(this.selectedSolutionId);
            } else {
                this.allApis = await CustomApiService.fetchAll();
            }
            this._renderBrowser();
            this._populateTesterSelect();
        } catch (err) {
            NotificationService.show(Config.MESSAGES.CUSTOM_API.loadFailed(ErrorParser.extract(err)), 'error');
        }
    }
}
