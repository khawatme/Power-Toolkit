/**
 * @file Environment Variables viewer and editor component.
 * @module components/EnvVarsTab
 * @description Fetches, displays, and allows editing of all Environment Variables and their current values.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { Config } from '../constants/index.js';
import { DataService } from '../services/DataService.js';
import { UIFactory } from '../ui/UIFactory.js';
import { debounce, escapeHtml, copyToClipboard, isJsonString, formatJsonIfValid, normalizeForJsonCompare, showConfirmDialog } from '../helpers/index.js';
import { NotificationService } from '../services/NotificationService.js';
import { DialogService } from '../services/DialogService.js';
import { ValidationService } from '../services/ValidationService.js';

/**
 * A single Environment Variable row returned by DataService.
 * @typedef {import('../services/DataService.js').EnvironmentVariable} EnvironmentVariable
 */

export class EnvironmentVariablesTab extends BaseComponent {
    /**
     * Initializes the EnvironmentVariablesTab component.
     */
    constructor() {
        super('envVars', 'Env Variables', ICONS.envVars);
        /** @type {{[k:string]: HTMLElement}} */
        this.ui = {};
        /** @type {EnvironmentVariable[]} */
        this.allVars = [];
        /** @private */
        this.filterCards = debounce(this._filterCards, 250);

        // Handler references for cleanup
        /** @private {Function|null} */ this._addBtnHandler = null;
        /** @private {Function|null} */ this._searchInputHandler = null;
        /** @private {Function|null} */ this._listClickHandler = null;

        // Edit mode handlers (for dynamic elements)
        /** @private {Function|null} */ this._textareaInputHandler = null;
        /** @private {Function|null} */ this._defaultTextareaInputHandler = null;
        /** @private {Function|null} */ this._solnButtonClickHandler = null;
        /** @private {Function|null} */ this._revalidateHandler = null;
        /** @private {Function|null} */ this._schemaBlurHandler = null;
        /** @private {Function|null} */ this._createBtnClickHandler = null;
        /** @private {Function|null} */ this._applyBtnClickHandler = null;

        // Track dynamic elements for cleanup
        // Each entry maps an element to a handler function (not an object with event/handler)
        /** @private {Map<HTMLElement, Function>} */ this._dynamicHandlers = new Map();
    }

    /**
     * Renders the component's HTML structure by fetching and displaying environment variables.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="section-title">Environment Variables</div>
            <div class="pdt-toolbar">
                <input type="text" id="env-var-search" class="pdt-input" placeholder="Search by name, type, or value...">
                <button id="env-var-add-btn" class="modern-button">New Variable</button>
            </div>
            <div id="env-var-list" class="pdt-content-host pdt-card-grid">
                <p class="pdt-note">Loading...</p>
            </div>
        `;

        this.ui.listContainer = container.querySelector('#env-var-list');

        try {
            this.allVars = await DataService.getEnvironmentVariables();
            this._renderListOrEmpty();
        } catch (e) {
            this.ui.listContainer.innerHTML = `<div class="pdt-error">${Config.MESSAGES.ENV_VARS.loadFailed(escapeHtml(e.message))}</div>`;
        }

        return container;
    }

    /**
     * Caches UI elements and attaches a single delegated event listener for all card interactions.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        this.ui.searchInput = element.querySelector('#env-var-search');
        this.ui.listContainer = element.querySelector('#env-var-list');
        this.ui.addBtn = element.querySelector('#env-var-add-btn');

        // Store handlers for cleanup
        this._addBtnHandler = () => this._openCreateDialog();
        this._searchInputHandler = () => this.filterCards();
        this._listClickHandler = async (e) => {
            const button = /** @type {HTMLElement|null} */(e.target)?.closest('button');
            if (!button) {
                return;
            }

            // Copy button inside code blocks
            if (button.matches('.copy-btn')) {
                const codeBlock = button.closest('.copyable-code-block');
                const codeEl = codeBlock?.querySelector('pre, code');
                if (codeEl) {
                    copyToClipboard(codeEl.textContent);
                }
                return;
            }

            const card = button.closest('.env-var-card');
            if (!card) {
                return;
            }

            if (button.matches('.edit-btn')) {
                this._switchToEditMode(card);
            } else if (button.matches('.cancel-btn')) {
                this._switchToViewMode(card);
            } else if (button.matches('.save-btn')) {
                await this._handleSaveClick(card);
            } else if (button.matches('.edit-default-btn')) {
                this._switchToEditDefaultMode(card);
            } else if (button.matches('.cancel-default-btn')) {
                this._switchDefaultToView(card);
            } else if (button.matches('.save-default-btn')) {
                await this._handleSaveDefault(card);
            } else if (button.matches('.delete-btn')) {
                await this._handleDelete(card);
            }
        };

        this.ui.addBtn.addEventListener('click', this._addBtnHandler);
        this.ui.searchInput.addEventListener('input', this._searchInputHandler);
        this.ui.listContainer.addEventListener('click', this._listClickHandler);
    }

    /** @private */
    _renderListOrEmpty() {
        this.ui.listContainer.textContent = '';
        if (!this.allVars.length) {
            this.ui.listContainer.innerHTML = `<p class="pdt-note">${Config.MESSAGES.ENV_VARS.noVariablesFound}</p>`;
            return;
        }
        const frag = document.createDocumentFragment();
        this.allVars.forEach(v => frag.appendChild(this._createCardElement(v)));
        this.ui.listContainer.appendChild(frag);
    }

    /**
     * Creates and returns a DOM element for a single environment variable card.
     * @param {EnvironmentVariable} variable - The environment variable data object.
     * @returns {HTMLElement} The fully constructed card element.
     * @private
     */
    _createCardElement(variable) {
        const card = document.createElement('div');
        card.className = 'env-var-card';

        // Data attributes for state management/search
        const searchableText = [
            variable.displayName, variable.schemaName, variable.type,
            variable.currentValue, variable.defaultValue, variable.description
        ].map(s => (s ?? '').toString()).join(' ').toLowerCase();

        card.dataset.searchTerm = searchableText;
        card.dataset.definitionId = variable.definitionId;
        card.dataset.valueId = variable.valueId || '';
        card.dataset.originalValue = (variable.currentValue === '(not set)') ? '' : (variable.currentValue ?? '');
        card.dataset.defaultValue = (variable.defaultValue === '—') ? '' : (variable.defaultValue ?? '');
        card.dataset.type = variable.type || '';
        card.dataset.displayName = variable.displayName || '';
        card.dataset.schemaName = variable.schemaName || '';

        card.innerHTML = `
            <div class="pdt-card-header">
                ${escapeHtml(variable.displayName || variable.schemaName || '(unnamed)')}
                <div class="pdt-subtitle-small code-like">${escapeHtml(variable.schemaName)}</div>
            </div>
            <div class="pdt-card-body">
                <div class="info-grid">
                    <strong>Display Name:</strong><span>${escapeHtml(variable.displayName || '—')}</span>
                    <strong>Schema Name:</strong><span class="copyable code-like" title="Click to copy">${escapeHtml(variable.schemaName)}</span>
                    <strong>Type:</strong><span>${escapeHtml(variable.type)}</span>
                    <strong>Description:</strong><span>${escapeHtml(variable.description || '—')}</span>
                    <strong>Current Value:</strong><div class="pdt-value-wrapper"></div>
                    <strong>Default Value:</strong><div class="pdt-value-wrapper-default"></div>
                </div>
            </div>
            <div class="pdt-card-footer"></div>
        `;

        // Values
        const cur = (variable.currentValue ?? '');
        const def = (variable.defaultValue ?? '');
        card.querySelector('.pdt-value-wrapper')?.appendChild(this._formatValue(cur === '' ? '(not set)' : cur, true));
        card.querySelector('.pdt-value-wrapper-default')?.appendChild(this._formatValue(def === '' ? '(not set)' : def, true));

        // Footer actions
        this._setCardFooter(card, [
            { cls: 'modern-button secondary edit-default-btn', text: 'Edit Default', title: 'Edit default value' },
            { cls: 'modern-button secondary edit-btn', text: 'Edit Current' },
            { cls: 'modern-button delete-btn', text: 'Delete', title: 'Delete variable' }
        ]);

        return card;
    }

    /**
     * Formats a value for display: JSON values use code-block; others are copyable spans.
     * @param {string} value
     * @param {boolean} isCopyable
     * @returns {HTMLElement}
     * @private
     */
    _formatValue(value, isCopyable) {
        const valStr = String(value ?? '').trim();
        if (isJsonString(valStr)) {
            try {
                JSON.parse(valStr); return UIFactory.createCopyableCodeBlock(valStr, 'json');
            } catch { /* no-op */ }
        }
        const span = document.createElement('span');
        if (isCopyable) {
            span.className = 'copyable'; span.title = 'Click to copy';
        }
        span.textContent = value;
        return span;
    }

    /**
     * Switch a card into "edit current value" mode.
     * @param {HTMLElement} card
     * @private
     */
    _switchToEditMode(card) {
        const wrapper = card.querySelector('.info-grid .pdt-value-wrapper');
        const originalValue = card.dataset.originalValue === '(not set)' ? '' : card.dataset.originalValue;
        const pretty = formatJsonIfValid(originalValue);
        const textarea = this._mkTextarea('pdt-textarea env-var-edit-area', pretty);

        wrapper.textContent = '';
        wrapper.appendChild(textarea);

        this._setCardFooter(card, [
            { cls: 'modern-button secondary cancel-btn', text: 'Cancel' },
            { cls: 'modern-button save-btn', text: 'Save Current', disabled: true }
        ]);

        const saveBtn = card.querySelector('.save-btn');

        const handler = () => {
            const currentNorm = normalizeForJsonCompare(textarea.value);
            const originalNorm = normalizeForJsonCompare(originalValue);
            saveBtn.disabled = (currentNorm === originalNorm);
        };
        this._dynamicHandlers.set(textarea, handler);
        textarea.addEventListener('input', handler);
    }

    /**
     * Switch a card back to view-only mode.
     * @param {HTMLElement} card
     * @param {string} [newValue]
     * @private
     */
    _switchToViewMode(card, newValue) {
        const display = newValue !== undefined ? newValue : card.dataset.originalValue;
        const wrapper = card.querySelector('.info-grid .pdt-value-wrapper');
        wrapper.textContent = '';
        wrapper.appendChild(this._formatValue(display, true));

        this._setCardFooter(card, [
            { cls: 'modern-button secondary edit-default-btn', text: 'Edit Default', title: 'Edit default value' },
            { cls: 'modern-button secondary edit-btn', text: 'Edit Current' },
            { cls: 'modern-button delete-btn', text: 'Delete', title: 'Delete variable' }
        ]);

        if (newValue !== undefined) {
            card.dataset.originalValue = newValue;
            this._updateCardSearchTerm(card, newValue);
        }
    }

    /**
     * Save current value (handles JSON/Number/Boolean coercion), then restore view mode.
     * @param {HTMLElement} card
     * @private
     */
    async _handleSaveClick(card) {
        const definitionId = card.dataset.definitionId;
        const valueId = card.dataset.valueId;
        const schemaName = card.dataset.schemaName;
        const textarea = card.querySelector('.env-var-edit-area');

        let raw = (textarea.value ?? '').trim();
        try {
            raw = this._coerceByType(raw, card.dataset.type);
        } catch (err) {
            NotificationService.show(Config.MESSAGES.ENV_VARS.invalidValue(card.dataset.type, err.message), 'error');
            return;
        }

        textarea.disabled = true;
        const saveBtn = card.querySelector('.save-btn');
        if (saveBtn) {
            saveBtn.textContent = 'Saving...';
        }

        try {
            const res = await DataService.setEnvironmentVariableValue(definitionId, valueId, raw, schemaName);
            if (!valueId) {
                const newId = res?.id || res?.environmentvariablevalueid;
                if (newId) {
                    card.dataset.valueId = newId;
                }
            }
            NotificationService.show(Config.MESSAGES.ENV_VARS.saved, 'success');
            this._switchToViewMode(card, raw);
        } catch (e) {
            NotificationService.show(Config.MESSAGES.ENV_VARS.saveFailed(e.message), 'error');
            textarea.disabled = false;
            if (saveBtn) {
                saveBtn.textContent = 'Save';
            }
        }
    }

    /**
     * Enter "edit default value" mode.
     * @param {HTMLElement} card
     * @private
     */
    _switchToEditDefaultMode(card) {
        const wrapper = card.querySelector('.info-grid .pdt-value-wrapper-default');
        const original = (card.dataset.defaultValue || '');
        const textarea = this._mkTextarea('pdt-textarea env-var-default-edit-area', formatJsonIfValid(original));

        wrapper.textContent = '';
        wrapper.appendChild(textarea);

        const footer = card.querySelector('.pdt-card-footer');
        footer.dataset.currentButtons = footer.innerHTML;

        this._setCardFooter(card, [
            { cls: 'modern-button secondary cancel-default-btn', text: 'Cancel' },
            { cls: 'modern-button save-default-btn', text: 'Save Default', disabled: true }
        ]);

        const saveBtn = card.querySelector('.save-default-btn');

        const handler = () => {
            const cur = normalizeForJsonCompare(textarea.value);
            const orig = normalizeForJsonCompare(original);
            saveBtn.disabled = (cur === orig);
        };
        this._dynamicHandlers.set(textarea, handler);
        textarea.addEventListener('input', handler);
    }

    /**
     * Exit default edit mode (optionally with updated value).
     * @param {HTMLElement} card
     * @param {string} [newDefault]
     * @private
     */
    _switchDefaultToView(card, newDefault) {
        const wrapper = card.querySelector('.info-grid .pdt-value-wrapper-default');
        const display = (newDefault !== undefined ? newDefault : (card.dataset.defaultValue || ''));
        wrapper.textContent = '';
        wrapper.appendChild(this._formatValue(display === '' ? '(not set)' : display, true));

        const footer = card.querySelector('.pdt-card-footer');
        if (footer.dataset.currentButtons) {
            footer.innerHTML = footer.dataset.currentButtons;
            footer.dataset.currentButtons = '';
        }

        if (newDefault !== undefined) {
            card.dataset.defaultValue = newDefault;
            this._updateCardSearchTerm(card, undefined, newDefault);
        }
    }

    /**
     * Persist default value via DataService.
     * @param {HTMLElement} card
     * @private
     */
    async _handleSaveDefault(card) {
        const definitionId = card.dataset.definitionId;
        const textarea = card.querySelector('.env-var-default-edit-area');
        let newValue = (textarea.value || '').trim();

        // If valid JSON, store minified
        try {
            newValue = JSON.stringify(JSON.parse(newValue));
        } catch { /* no-op */ }

        textarea.disabled = true;
        const btn = card.querySelector('.save-default-btn');
        if (btn) {
            btn.textContent = 'Saving...';
        }

        try {
            await DataService.setEnvironmentVariableDefault(definitionId, newValue);
            NotificationService.show(Config.MESSAGES.ENV_VARS.defaultUpdated, 'success');
            this._switchDefaultToView(card, newValue);
        } catch (e) {
            NotificationService.show(Config.MESSAGES.ENV_VARS.saveFailed(e.message), 'error');
            textarea.disabled = false;
            if (btn) {
                btn.textContent = 'Save Default';
            }
        }
    }

    /**
     * Show delete dialog and handle confirmation.
     * @param {HTMLElement} card
     * @private
     */
    async _handleDelete(card) {
        const display = card.dataset.displayName || card.querySelector('.pdt-card-header')?.textContent || '(unnamed)';
        const schema = card.dataset.schemaName || '';
        const definitionId = card.dataset.definitionId;

        const contentEl = document.createElement('div');
        contentEl.innerHTML = `
            <div class="pdt-warning" style="margin-bottom: 12px;">
                <strong>Delete "${escapeHtml(display)}"?</strong><br/>
                <span class="code-like">${escapeHtml(schema)}</span><br/>
                <span class="pdt-text-error">This action cannot be undone.</span>
            </div>
        `;

        const confirmed = await showConfirmDialog('Delete Environment Variable', contentEl);
        if (!confirmed) {
            return;
        }

        // Add visual feedback on the card
        const deleteBtn = card.querySelector('.delete-btn');
        const originalBtnText = deleteBtn?.textContent || 'Delete';
        if (deleteBtn) {
            deleteBtn.textContent = 'Deleting...';
            deleteBtn.disabled = true;
        }

        // Disable all buttons in the card
        card.querySelectorAll('button').forEach(btn => btn.disabled = true);

        // Add a semi-transparent overlay to the card
        card.style.opacity = '0.6';
        card.style.pointerEvents = 'none';

        try {
            await DataService.deleteEnvironmentVariable(definitionId);
            card.remove();
            NotificationService.show(Config.MESSAGES.ENV_VARS.deleted, 'success');
        } catch (e) {
            NotificationService.show(Config.MESSAGES.ENV_VARS.deleteFailed(e.message), 'error');

            // Restore card state on error
            card.style.opacity = '';
            card.style.pointerEvents = '';
            card.querySelectorAll('button').forEach(btn => btn.disabled = false);
            if (deleteBtn) {
                deleteBtn.textContent = originalBtnText;
            }
        }
    }

    /**
     * Open the "New Environment Variable" dialog.
     * @private
     */
    _buildDeleteDialogContent(displayName, schema) {
        const wrap = document.createElement('div');
        wrap.innerHTML = `
        <div class="pdt-dialog-narrow">
            <div class="pdt-warning">
                <strong>Delete "${escapeHtml(displayName)}"?</strong><br/>
                <span class="code-like">${escapeHtml(schema)}</span><br/>
                <span class="pdt-text-error">This action cannot be undone.</span>
            </div>
            <label class="pdt-checkbox pdt-inline-row gap-8" style="margin:8px 0 12px;">
                <input type="checkbox" id="del-confirm-chk"/>
                <span>I understand this will permanently delete the variable and its values.</span>
            </label>
            <div class="pdt-inline-row gap-8">
                <label class="minw-160">Type schema to confirm</label>
                <input id="del-confirm-text" class="pdt-input flex-1" placeholder="${escapeHtml(schema)}"/>
            </div>
        </div>`;
        return wrap;
    }

    /**
     * Open the "New Environment Variable" dialog.
     * @private
     */
    async _openCreateDialog() {
        const content = this._buildCreateDialogContent();
        const $ = (sel) => content.querySelector(sel);

        // Restore previously chosen solution if saved
        try {
            const saved = sessionStorage.getItem('pdt:currentSolution');
            if (saved) {
                await DataService.setCurrentSolution(saved);
            }
        } catch { /* ignore */ }

        // Field refs
        const nameEl = $('#nv-name');
        const schemaEl = $('#nv-schema');
        const typeEl = $('#nv-type');
        const defEl = $('#nv-default');
        const curEl = $('#nv-current');
        const descEl = $('#nv-desc');

        // Solution UI
        const solnInfo = $('#nv-soln-info');
        const solnButton = $('#nv-pick-solution');

        // Pre-fill prefix & solution info
        try {
            const { uniqueName, publisherPrefix } = DataService.getCurrentSolution?.() || {};
            if (publisherPrefix && !schemaEl.value) {
                schemaEl.value = `${publisherPrefix}_`;
            }
            if (uniqueName) {
                solnInfo.textContent = `Will be added to solution: ${uniqueName} (prefix: ${publisherPrefix || 'n/a'})`;
                solnInfo.style.color = '';
                solnButton.textContent = Config.MESSAGES.ENV_VARS.changeSolutionButton;
            } else {
                solnInfo.textContent = Config.MESSAGES.ENV_VARS.selectSolutionBeforeCreate;
                solnInfo.style.color = 'var(--pdt-error-color, #dc3545)';
                solnButton.textContent = Config.MESSAGES.ENV_VARS.selectSolutionButton;
            }
        } catch { }

        // Validation function
        const revalidate = () => {
            const currentSolution = DataService.getCurrentSolution?.();
            const hasSolution = !!(currentSolution && currentSolution.uniqueName);
            const valid = hasSolution && this._isCreateModelValid({
                name: nameEl.value, schema: schemaEl.value, type: typeEl.value,
                defVal: defEl.value, curVal: curEl.value
            });
            createBtn.disabled = !valid;

            // Update info text color to indicate requirement
            if (!hasSolution) {
                solnInfo.style.color = 'var(--pdt-error-color, #dc3545)';
                solnInfo.textContent = Config.MESSAGES.ENV_VARS.selectSolutionBeforeCreate;
            }
        };

        // Attach picker
        const solnButtonHandler = async () => this._openSolutionPicker(solnInfo, solnButton, schemaEl, revalidate);
        if (solnButton) {
            this._dynamicHandlers.set(solnButton, solnButtonHandler);
            solnButton.addEventListener('click', solnButtonHandler);
        }

        // Validation
        const dlg = DialogService.show(Config.DIALOG_TITLES.newEnvVar, content);
        const dlgEl = content.closest('.pdt-dialog');
        const footer = dlgEl?.querySelector('.pdt-dialog-footer');

        const createBtn = this._mkDialogFooterBtn('nv-create', 'modern-button primary', 'Create', true);
        footer?.appendChild(createBtn);

        // Attach revalidate handlers to all inputs - store for cleanup
        content.querySelectorAll('input,textarea,select').forEach(el => {
            this._dynamicHandlers.set(el, revalidate);
            el.addEventListener('input', revalidate);
        });

        // Schema prefix autofix
        const schemaBlurHandler = () => {
            try {
                const { publisherPrefix } = DataService.getCurrentSolution?.() || {};
                if (!publisherPrefix) {
                    return;
                }
                const hasPrefix = /^[a-zA-Z0-9]+_/.test(schemaEl.value);
                if (!hasPrefix && schemaEl.value.trim().length) {
                    schemaEl.value = `${publisherPrefix}_${schemaEl.value.trim()}`;
                    revalidate();
                }
            } catch { }
        };
        this._dynamicHandlers.set(schemaEl, schemaBlurHandler);
        schemaEl.addEventListener('blur', schemaBlurHandler);

        // Create handler
        const createBtnClickHandler = async () => {
            // Disable all inputs and show loading state
            createBtn.disabled = true;
            const originalText = createBtn.textContent;
            createBtn.textContent = 'Creating...';
            content.querySelectorAll('input,textarea,select,button').forEach(el => el.disabled = true);

            try {
                const model = {
                    displayName: nameEl.value.trim(),
                    schemaName: schemaEl.value.trim(),
                    type: typeEl.value,
                    description: descEl.value.trim(),
                    defaultValue: defEl.value.trim(),
                    currentValue: curEl.value.trim()
                };

                const created = await DataService.createEnvironmentVariable(model);
                NotificationService.show(Config.MESSAGES.ENV_VARS.created, 'success');
                dlg.close?.();

                const cardData = {
                    definitionId: created.definitionId,
                    valueId: created.valueId || '',
                    displayName: model.displayName,
                    schemaName: created.schemaname || model.schemaName,
                    type: model.type,
                    defaultValue: model.defaultValue || '',
                    currentValue: model.currentValue || '',
                    description: model.description || ''
                };

                const card = this._createCardElement(cardData);
                this.allVars.unshift(cardData);
                this.ui.listContainer.prepend(card);

                if (this.ui.searchInput) {
                    this.ui.searchInput.value = '';
                }
                this._filterCards();
            } catch (e) {
                NotificationService.show(Config.MESSAGES.ENV_VARS.createFailed(e.message), 'error');
                // Re-enable inputs on error
                createBtn.textContent = originalText;
                content.querySelectorAll('input,textarea,select,button').forEach(el => el.disabled = false);
                revalidate();
            }
        };
        this._dynamicHandlers.set(createBtn, createBtnClickHandler);
        createBtn.addEventListener('click', createBtnClickHandler);

        revalidate();
    }

    /**
     * Returns content for the create dialog (no footer).
     * @returns {HTMLDivElement}
     * @private
     */
    _buildCreateDialogContent() {
        const content = document.createElement('div');
        content.innerHTML = `
        <div class="pdt-form-grid minw-520">
            <div class="pdt-note grid-span-all">
                <div id="nv-soln-row" class="pdt-inline-row gap-12">
                    <span id="nv-soln-info" class="flex-1"></span>
                    <button id="nv-pick-solution" class="modern-button small ml-auto">Select solution…</button>
                </div>
            </div>

            <label>Display Name</label>
            <input type="text" class="pdt-input" id="nv-name" placeholder="Friendly name">

            <label>Schema Name</label>
            <input type="text" class="pdt-input" id="nv-schema" placeholder="publisherprefix_MySetting">

            <label>Type</label>
            <select class="pdt-select" id="nv-type">
                <option value="String" selected>String</option>
                <option value="Number">Number</option>
                <option value="Json">JSON</option>
                <option value="Boolean">Boolean</option>
            </select>

            <label>Description</label>
            <textarea class="pdt-textarea" id="nv-desc" rows="2" placeholder="What is this variable for?"></textarea>

            <label>Default Value</label>
            <textarea class="pdt-textarea" id="nv-default" rows="3" placeholder="(optional)"></textarea>

            <label>Current Value (override)</label>
            <textarea class="pdt-textarea" id="nv-current" rows="3" placeholder="(optional)"></textarea>
        </div>`;
        return content;
    }

    /**
     * Open the "Select Solution" dialog and apply selection.
     * @param {HTMLElement} solnInfo
     * @param {HTMLButtonButton} solnButton
     * @param {HTMLInputElement} schemaEl
     * @param {Function} [revalidate] - Optional callback to trigger validation after selection
     * @private
     */
    async _openSolutionPicker(solnInfo, solnButton, schemaEl, revalidate) {
        // Temporarily detach parent dialog to prevent DialogService from removing it
        const parentOverlay = document.getElementById(Config.DIALOG_OVERLAY_ID);
        let parentNode = null;

        if (parentOverlay) {
            parentNode = parentOverlay.parentNode;
            parentOverlay.remove(); // Remove from DOM but keep in memory
        }

        const pick = document.createElement('div');
        pick.innerHTML = `
            <div class="minw-420">
                <label class="grid-span-all" style="margin-bottom:6px">Choose a solution</label>
                <select id="soln-select" class="pdt-select"></select>
            </div>`;
        DialogService.show(Config.DIALOG_TITLES.selectSolution, pick);

        const dlgEl = pick.closest('.pdt-dialog');
        const footer = dlgEl?.querySelector('.pdt-dialog-footer');
        const apply = this._mkDialogFooterBtn('soln-apply', 'modern-button', 'Use this solution', true);
        footer?.appendChild(apply);

        const sel = pick.querySelector('#soln-select');

        try {
            const solutions = await DataService.listSolutions();
            if (!solutions.length) {
                sel.innerHTML = '<option>(no visible unmanaged solutions)</option>';
                apply.disabled = true;
            } else {
                sel.innerHTML = solutions.map(s =>
                    `<option value="${escapeHtml(s.uniqueName)}" data-prefix="${escapeHtml(s.prefix)}">
                        ${escapeHtml(s.friendlyName)} (${escapeHtml(s.uniqueName)}) — ${escapeHtml(s.prefix || 'no prefix')}
                    </option>`).join('');
                apply.disabled = false;
            }
        } catch {
            sel.innerHTML = '<option>(failed to load)</option>';
            apply.disabled = true;
        }

        const closeAndRestore = () => {
            // Close solution picker dialog
            const currentOverlay = document.getElementById(Config.DIALOG_OVERLAY_ID);
            if (currentOverlay) {
                currentOverlay.remove();
            }

            // Restore parent dialog
            if (parentOverlay && parentNode) {
                parentNode.appendChild(parentOverlay);
            }
        };

        const applyButtonClickHandler = async () => {
            const opt = sel.selectedOptions[0];
            const unique = opt?.value;
            await DataService.setCurrentSolution(unique);
            sessionStorage.setItem('pdt:currentSolution', unique || '');

            const { uniqueName: u, publisherPrefix: p } = DataService.getCurrentSolution();
            if (u) {
                solnInfo.textContent = `Will be added to solution: ${u} (prefix: ${p || 'n/a'})`;
                solnInfo.style.color = '';
                solnButton.textContent = Config.MESSAGES.ENV_VARS.changeSolutionButton;
            } else {
                solnInfo.textContent = Config.MESSAGES.ENV_VARS.noSolutionSelected;
                solnInfo.style.color = 'var(--pdt-error-color, #dc3545)';
                solnButton.textContent = Config.MESSAGES.ENV_VARS.selectSolutionButton;
            }
            if (p && !schemaEl.value) {
                schemaEl.value = `${p}_`;
            }

            // Trigger validation if callback provided
            if (revalidate) {
                revalidate();
            }

            closeAndRestore();
        };

        apply.addEventListener('click', applyButtonClickHandler);
        this._dynamicHandlers.set(apply, { event: 'click', handler: applyButtonClickHandler });

        // Override the dialog's close/cancel buttons to restore parent dialog
        const cancelBtn = dlgEl?.querySelector('.pdt-dialog-cancel');
        const closeBtn = dlgEl?.querySelector('.pdt-close-btn');
        const overlay = document.getElementById(Config.DIALOG_OVERLAY_ID);

        if (cancelBtn) {
            cancelBtn.onclick = closeAndRestore;
        }
        if (closeBtn) {
            closeBtn.onclick = closeAndRestore;
        }
        if (overlay) {
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    closeAndRestore();
                }
            };
        }
    }

    /**
     * Filters the displayed cards based on the search input's value.
     * @private
     */
    _filterCards = () => {
        const term = (this.ui.searchInput?.value || '').toLowerCase();
        this.ui.listContainer.querySelectorAll('.env-var-card').forEach(card => {
            const searchableText = card.dataset.searchTerm || '';
            card.style.display = searchableText.includes(term) ? '' : 'none';
        });
    };

    /**
     * Safely set footer actions for a card.
     * @param {HTMLElement} card
     * @param {Array<{cls:string,text:string, title?:string, disabled?:boolean}>} buttons
     * @private
     */
    _setCardFooter(card, buttons) {
        const footer = card.querySelector('.pdt-card-footer');
        footer.textContent = '';
        buttons.forEach(b => {
            const btn = document.createElement('button');
            btn.className = b.cls;
            btn.textContent = b.text;
            if (b.title) {
                btn.title = b.title;
            }
            if (b.disabled) {
                btn.disabled = true;
            }
            footer.appendChild(btn);
        });
    }

    /**
     * Update the search term string of a card after value changes.
     * @param {HTMLElement} card
     * @param {string} [newCurrent]
     * @param {string} [newDefault]
     * @private
     */
    _updateCardSearchTerm(card, newCurrent, newDefault) {
        const dn = card.dataset.displayName || '';
        const sn = card.dataset.schemaName || '';
        const type = card.dataset.type || '';
        const cur = (newCurrent !== undefined ? newCurrent : (card.dataset.originalValue || ''));
        const def = (newDefault !== undefined ? newDefault : (card.dataset.defaultValue || ''));
        card.dataset.searchTerm = [dn, sn, type, cur, def].join(' ').toLowerCase();
    }

    /**
     * Build a textarea with auto rows for multiline content.
     * @param {string} className
     * @param {string} value
     * @returns {HTMLTextAreaElement}
     * @private
     */
    _mkTextarea(className, value) {
        const rows = Math.max(4, Math.min(((value.match(/\n/g) || []).length + 1), 15));
        const ta = document.createElement('textarea');
        ta.className = className;
        ta.rows = rows;
        ta.value = value;
        return ta;
    }

    /**
     * Build a button intended for dialog footers.
     * @param {string} id
     * @param {string} className
     * @param {string} text
     * @param {boolean} disabled
     * @returns {HTMLButtonElement}
     * @private
     */
    _mkDialogFooterBtn(id, className, text, disabled = false) {
        const btn = document.createElement('button');
        btn.id = id;
        btn.className = className;
        btn.textContent = text;
        btn.disabled = !!disabled;
        return btn;
    }

    /**
     * Coerce text to the correct type representation for storage based on variable type.
     * @param {string} input
     * @param {string} type
     * @returns {string}
     * @private
     */
    _coerceByType(input, type) {
        const t = (type || '').toLowerCase();
        if (t === 'json') {
            const parsed = ValidationService.validateJson(input, 'Environment variable value');
            return JSON.stringify(parsed);
        }
        if (t === 'number') {
            const n = ValidationService.validateNumber(input, 'Environment variable value');
            return String(n);
        }
        if (t === 'boolean') {
            const b = ValidationService.validateBoolean(input, 'Environment variable value');
            return String(b);
        }
        return input;
    }

    /**
     * Validate the create form fields quickly without UX blocking on minor type hints.
     * @param {{name:string, schema:string, type:string, defVal:string, curVal:string}} m
     * @returns {boolean}
     * @private
     */
    _isCreateModelValid(m) {
        const hasBasics = !!m.name?.trim() && !!m.schema?.trim();
        if (!hasBasics) {
            return false;
        }

        // Ensure schema name is not just a prefix or prefix with underscore
        const schema = m.schema.trim();
        // Check if it's just "prefix_" or just a prefix without content after underscore
        if (/^[a-zA-Z0-9]+_?$/.test(schema)) {
            return false; // Invalid: just prefix or prefix_
        }
        // Ensure there's actual content after the prefix_
        if (schema.includes('_')) {
            const parts = schema.split('_');
            if (parts.length < 2 || !parts[1] || parts[1].trim() === '') {
                return false; // Invalid: prefix_ with no actual name
            }
        }

        const tryVal = (val) => {
            if (!val) {
                return true;
            }
            try {
                if (m.type === 'Number') {
                    return Number.isFinite(Number(val));
                }
                if (m.type === 'Boolean') {
                    const s = String(val).toLowerCase(); return (s === 'true' || s === 'false');
                }
                if (m.type === 'Json') {
                    JSON.parse(val); return true;
                }
                return true;
            } catch {
                return false;
            }
        };

        return tryVal(m.defVal) && tryVal(m.curVal);
    }

    /**
     * Lifecycle hook for cleaning up event listeners to prevent memory leaks.
     */
    destroy() {
        if (this.ui.addBtn) {
            this.ui.addBtn.removeEventListener('click', this._addBtnHandler);
        }
        if (this.ui.searchInput) {
            this.ui.searchInput.removeEventListener('input', this._searchInputHandler);
        }
        // Cancel any pending debounced filter
        if (this.filterCards?.cancel) {
            this.filterCards.cancel();
        }
        if (this.ui.listContainer) {
            this.ui.listContainer.removeEventListener('click', this._listClickHandler);
        }

        // Clean up all dynamically created handlers (stored as simple functions)
        for (const [element, handler] of this._dynamicHandlers.entries()) {
            // Try common event types
            element.removeEventListener('click', handler);
            element.removeEventListener('input', handler);
            element.removeEventListener('blur', handler);
        }
        this._dynamicHandlers.clear();
    }
}
