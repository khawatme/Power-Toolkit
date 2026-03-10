/**
 * @file Power Automate Flows viewer and management component.
 * @module components/PowerAutomateFlowsTab
 * @description Fetches, displays, and allows management of cloud flows (Modern Flows)
 * stored in the Dataverse workflow table. Supports solution-based filtering, turning
 * flows on/off, deleting, viewing/editing definitions as JSON or visual flow diagram,
 * and opening in the Power Automate portal.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { Config } from '../constants/index.js';
import { DataService } from '../services/DataService.js';
import { debounce, escapeHtml, showConfirmDialog } from '../helpers/index.js';
import { NotificationService } from '../services/NotificationService.js';
import { DialogService } from '../services/DialogService.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
import { BusyIndicator } from '../utils/ui/BusyIndicator.js';

/** @typedef {import('../services/FlowService.js').CloudFlow} CloudFlow */

/**
 * A component for viewing and managing Power Automate cloud flows.
 * Follows the SolutionLayersTab pattern with solution dropdown, search, and refresh.
 * @extends {BaseComponent}
 */
export class PowerAutomateFlowsTab extends BaseComponent {
    /**
     * Initializes the PowerAutomateFlowsTab component.
     */
    constructor() {
        super('powerAutomateFlows', 'Power Automate', ICONS.powerAutomateFlows, false);
        /** @type {{[k:string]: HTMLElement}} */
        this.ui = {};
        /** @type {CloudFlow[]} */
        this.allFlows = [];
        /** @type {Array<{solutionid: string, friendlyname: string, uniquename: string, ismanaged: boolean}>} */
        this.solutions = [];
        /** @type {string|null} */
        this.selectedSolutionId = null;
        /** @private */
        this.filterCards = debounce(this._filterCards, 250);

        // Handler references for cleanup
        /** @private {Function|null} */ this._solutionSelectHandler = null;
        /** @private {Function|null} */ this._refreshBtnHandler = null;
        /** @private {Function|null} */ this._searchInputHandler = null;
        /** @private {Function|null} */ this._listClickHandler = null;
    }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    // eslint-disable-next-line require-await
    async render() {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        const container = document.createElement('div');
        container.className = 'pdt-full-height-column';

        container.innerHTML = `
            <div class="section-title flex-shrink-0">Power Automate Cloud Flows</div>
            <div class="pdt-toolbar">
                <select id="pdt-flow-solution-select" class="pdt-input" style="flex: 2;">
                    <option value="">${M.selectSolution}</option>
                </select>
                <input type="text" id="flow-search" class="pdt-input" placeholder="Search by name, status, or owner..." style="flex: 1;">
                <button id="flow-refresh-btn" class="modern-button" disabled>${M.refreshFlows}</button>
            </div>
            <div id="flow-list" class="pdt-content-host pdt-card-grid">
                <p class="pdt-note">${M.selectSolution}</p>
            </div>
        `;

        return container;
    }

    /**
     * Caches UI elements, loads solutions, and attaches event listeners.
     * @param {HTMLElement} element - The root element of the component.
     */
    async postRender(element) {
        this.ui = {
            container: element,
            solutionSelect: element.querySelector('#pdt-flow-solution-select'),
            searchInput: element.querySelector('#flow-search'),
            listContainer: element.querySelector('#flow-list'),
            refreshBtn: element.querySelector('#flow-refresh-btn')
        };

        // Load solutions
        await this._loadSolutions();

        // Attach event handlers
        this._solutionSelectHandler = () => this._onSolutionSelected();
        this._refreshBtnHandler = () => this._handleRefresh();
        this._searchInputHandler = () => this.filterCards();
        this._listClickHandler = async (e) => {
            const button = /** @type {HTMLElement|null} */ (e.target)?.closest('button');
            if (!button) {
                return;
            }
            const card = button.closest('.pdt-flow-card');
            if (!card) {
                return;
            }
            const flowId = card.dataset.flowId;
            if (button.matches('.flow-toggle-btn')) {
                await this._handleToggleState(card, flowId);
            } else if (button.matches('.flow-delete-btn')) {
                await this._handleDelete(card, flowId);
            } else if (button.matches('.flow-view-btn')) {
                await this._handleViewDefinition(flowId, card.dataset.flowName, card.dataset.isManaged === 'true');
            } else if (button.matches('.flow-open-btn')) {
                this._handleOpenInPortal(flowId);
            }
        };

        this.ui.solutionSelect.addEventListener('change', this._solutionSelectHandler);
        this.ui.refreshBtn.addEventListener('click', this._refreshBtnHandler);
        this.ui.searchInput.addEventListener('input', this._searchInputHandler);
        this.ui.listContainer.addEventListener('click', this._listClickHandler);
    }

    /**
     * Loads solutions that contain cloud flows into the dropdown.
     * @private
     */
    async _loadSolutions() {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        try {
            this.ui.solutionSelect.disabled = true;
            this.solutions = await DataService.getSolutionsWithFlows();

            this.ui.solutionSelect.innerHTML = `<option value="">${M.selectSolution}</option>`;
            this.solutions.forEach(solution => {
                const option = document.createElement('option');
                option.value = solution.solutionid;
                option.textContent = `${solution.friendlyname} (${solution.uniquename})`;
                this.ui.solutionSelect.appendChild(option);
            });

            this.ui.solutionSelect.disabled = false;

            if (this.solutions.length === 0) {
                NotificationService.show(M.noSolutions, 'info');
            }
        } catch (error) {
            NotificationService.show(M.loadSolutionsFailed(error.message), 'error');
            this.ui.listContainer.innerHTML = `<p class="pdt-error">${M.loadSolutionsFailed(escapeHtml(error.message))}</p>`;
        }
    }

    /**
     * Handles solution dropdown change.
     * @private
     */
    async _onSolutionSelected() {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        this.selectedSolutionId = this.ui.solutionSelect.value;

        if (!this.selectedSolutionId) {
            this.ui.refreshBtn.disabled = true;
            this.allFlows = [];
            this.ui.listContainer.innerHTML = `<p class="pdt-note">${M.selectSolution}</p>`;
            return;
        }

        this.ui.refreshBtn.disabled = false;
        await this._loadFlows();
    }

    /**
     * Loads cloud flows for the selected solution.
     * @private
     */
    async _loadFlows() {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        if (!this.selectedSolutionId) {
            return;
        }

        this.ui.listContainer.innerHTML = `<p class="pdt-note">${M.loading}</p>`;

        try {
            BusyIndicator.set();
            this.allFlows = await DataService.getCloudFlowsBySolution(this.selectedSolutionId);
            this._renderListOrEmpty();
        } catch (e) {
            this.ui.listContainer.innerHTML = `<div class="pdt-error">${M.loadFailed(escapeHtml(e.message))}</div>`;
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Renders the flow list or an empty-state message.
     * @private
     */
    _renderListOrEmpty() {
        this.ui.listContainer.textContent = '';
        if (!this.allFlows.length) {
            this.ui.listContainer.innerHTML = `<p class="pdt-note">${Config.MESSAGES.POWER_AUTOMATE_FLOWS.noFlowsFound}</p>`;
            return;
        }
        const frag = document.createDocumentFragment();
        this.allFlows.forEach(flow => frag.appendChild(this._createFlowCard(flow)));
        this.ui.listContainer.appendChild(frag);
    }

    /**
     * Creates a card element for a single cloud flow.
     * @param {CloudFlow} flow - The flow data.
     * @returns {HTMLElement} The card element.
     * @private
     */
    _createFlowCard(flow) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        const card = document.createElement('div');
        card.className = 'pdt-flow-card pdt-card';
        card.dataset.flowId = flow.id;
        card.dataset.flowName = flow.name;
        card.dataset.statecode = String(flow.statecode);
        card.dataset.isManaged = String(flow.isManaged);

        const statusClass = this._getStatusClass(flow.statecode);
        const statusText = this._getStatusText(flow.statecode);
        const managedBadge = flow.isManaged
            ? `<span class="pdt-badge--managed pdt-badge-small">${M.managedLabel}</span>`
            : `<span class="pdt-badge--unmanaged pdt-badge-small">${M.unmanagedLabel}</span>`;

        const searchText = [flow.name, flow.description, flow.owner, statusText]
            .join(' ').toLowerCase();
        card.dataset.searchTerm = searchText;

        card.innerHTML = `
            <div class="pdt-card-header pdt-flow-header">
                <div class="pdt-flow-title-row">
                    <span class="pdt-flow-name">${escapeHtml(flow.name)}</span>
                    <div class="pdt-flow-badges">
                        <span class="pdt-status-badge ${statusClass}">${statusText}</span>
                        ${managedBadge}
                    </div>
                </div>
            </div>
            <div class="pdt-card-body pdt-flow-body">
                <div class="info-grid pdt-flow-info-grid">
                    <strong>ID:</strong><code class="pdt-flow-id copyable code-like" title="Click to copy" tabindex="0">${escapeHtml(flow.id)}</code>
                    <strong>Owner:</strong><span>${escapeHtml(flow.owner)}</span>
                    <strong>Created:</strong><span>${escapeHtml(flow.createdOn)}</span>
                    <strong>Modified:</strong><span>${escapeHtml(flow.modifiedOn)}</span>
                    <strong>Created By:</strong><span>${escapeHtml(flow.createdBy)}</span>
                    ${flow.description ? `<strong>Description:</strong><span>${escapeHtml(flow.description)}</span>` : ''}
                </div>
            </div>
            <div class="pdt-card-footer">
                ${this._getCardActions(flow)}
            </div>
        `;

        return card;
    }

    /**
     * Returns the action buttons HTML for a flow card.
     * @param {CloudFlow} flow
     * @returns {string}
     * @private
     */
    _getCardActions(flow) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        const isOn = flow.statecode === 1;
        const toggleText = isOn ? M.turnOff : M.turnOn;
        const toggleClass = isOn ? 'secondary' : '';

        if (flow.isManaged) {
            return `
                <div class="pdt-flow-actions-group">
                    <button class="modern-button secondary flow-open-btn" title="${M.openInPortal}">${M.openInPortal}</button>
                    <button class="modern-button secondary flow-view-btn" title="${M.viewDefinition}">${M.viewDefinition}</button>
                    <button class="modern-button ${toggleClass} flow-toggle-btn" title="${toggleText}">${toggleText}</button>
                </div>
            `;
        }

        return `
            <div class="pdt-flow-actions-group">
                <button class="modern-button secondary flow-delete-btn" title="${M.deleteFlow}">${M.deleteFlow}</button>
                <button class="modern-button secondary flow-open-btn" title="${M.openInPortal}">${M.openInPortal}</button>
                <button class="modern-button secondary flow-view-btn" title="${M.viewDefinition}">${M.viewDefinition}</button>
                <button class="modern-button ${toggleClass} flow-toggle-btn" title="${toggleText}">${toggleText}</button>
            </div>
        `;
    }

    /**
     * Returns the CSS class for a flow status badge.
     * @param {number} statecode
     * @returns {string}
     * @private
     */
    _getStatusClass(statecode) {
        switch (statecode) {
            case 1: return 'active';
            case 2: return 'pdt-flow-suspended';
            default: return 'inactive';
        }
    }

    /**
     * Returns the display text for a flow status.
     * @param {number} statecode
     * @returns {string}
     * @private
     */
    _getStatusText(statecode) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        switch (statecode) {
            case 1: return M.statusOn;
            case 0: return M.statusOff;
            case 2: return M.statusSuspended;
            default: return M.statusDraft;
        }
    }

    /**
     * Handles refreshing the flow list for the current solution.
     * @private
     */
    async _handleRefresh() {
        if (!this.selectedSolutionId) {
            return;
        }
        await this._loadFlows();
    }

    /**
     * Handles toggling a flow on/off.
     * @param {HTMLElement} card - The card element.
     * @param {string} flowId - The flow GUID.
     * @private
     */
    async _handleToggleState(card, flowId) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        const currentState = parseInt(card.dataset.statecode, 10);
        const activate = currentState !== 1;
        const toggleBtn = card.querySelector('.flow-toggle-btn');

        try {
            if (toggleBtn) {
                toggleBtn.disabled = true;
            }
            BusyIndicator.set();
            await DataService.setFlowState(flowId, activate);
            NotificationService.show(activate ? M.flowActivated : M.flowDeactivated, 'success');

            // Update card in-place
            const newState = activate ? 1 : 0;
            card.dataset.statecode = String(newState);
            const badge = card.querySelector('.pdt-status-badge');
            if (badge) {
                badge.className = `pdt-status-badge ${this._getStatusClass(newState)}`;
                badge.textContent = this._getStatusText(newState);
            }

            // Update the flow data
            const flow = this.allFlows.find(f => f.id === flowId);
            if (flow) {
                flow.statecode = newState;
            }

            // Re-render footer actions
            const footer = card.querySelector('.pdt-card-footer');
            if (footer && flow) {
                footer.innerHTML = this._getCardActions(flow);
            }
        } catch (e) {
            const msg = activate ? M.activateFailed(escapeHtml(e.message)) : M.deactivateFailed(escapeHtml(e.message));
            NotificationService.show(msg, 'error');
        } finally {
            if (toggleBtn) {
                toggleBtn.disabled = false;
            }
            BusyIndicator.clear();
        }
    }

    /**
     * Handles deleting a flow with confirmation.
     * @param {HTMLElement} card - The card element.
     * @param {string} flowId - The flow GUID.
     * @private
     */
    async _handleDelete(card, flowId) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        const flowName = card.dataset.flowName || '';
        const confirmed = await showConfirmDialog(M.deleteConfirmTitle, M.deleteConfirm(escapeHtml(flowName)));
        if (!confirmed) {
            return;
        }

        try {
            BusyIndicator.set();
            await DataService.deleteFlow(flowId);
            NotificationService.show(M.flowDeleted, 'success');

            // Remove from data and DOM
            this.allFlows = this.allFlows.filter(f => f.id !== flowId);
            card.remove();

            if (!this.allFlows.length) {
                this.ui.listContainer.innerHTML = `<p class="pdt-note">${M.noFlowsFound}</p>`;
            }
        } catch (e) {
            NotificationService.show(M.deleteFailed(escapeHtml(e.message)), 'error');
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Handles viewing a flow definition in a dialog with JSON and visual tabs.
     * @param {string} flowId - The flow GUID.
     * @param {string} flowName - The flow display name.
     * @private
     */
    async _handleViewDefinition(flowId, flowName, isManaged) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        try {
            BusyIndicator.set();
            const clientData = await DataService.getFlowDefinition(flowId);
            if (!clientData) {
                NotificationService.show(M.noDefinition, 'warn');
                return;
            }

            const container = this._buildDefinitionContainer(clientData, flowName, isManaged, flowId);
            DialogService.show(M.flowDefinitionTitle(escapeHtml(flowName)), container);

            // Inject footer actions (Save/Undo) into dialog footer for unmanaged flows
            if (container._footerActions) {
                const dialogFooter = document.querySelector(`#${Config.DIALOG_OVERLAY_ID} .${Config.DIALOG_CLASSES.footer}`);
                if (dialogFooter) {
                    const closeBtn = dialogFooter.querySelector(`.${Config.DIALOG_CLASSES.cancelBtn}`);
                    dialogFooter.insertBefore(container._footerActions, closeBtn);
                }
            }
        } catch (e) {
            NotificationService.show(M.loadFailed(escapeHtml(e.message)), 'error');
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Builds the definition viewer container with JSON and Visual tabs.
     * Both managed and unmanaged flows are editable; managed shows a warning.
     * @param {string} clientData - The raw clientdata JSON string.
     * @param {string} _flowName - The flow display name.
     * @param {boolean} isManaged - Whether the flow is managed.
     * @param {string} flowId - The flow GUID.
     * @returns {HTMLElement}
     * @private
     */
    _buildDefinitionContainer(clientData, _flowName, isManaged, flowId) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        const container = document.createElement('div');
        container.className = 'pdt-flow-definition-container pdt-flow-definition-wide';

        // Tab bar
        const tabBar = document.createElement('div');
        tabBar.className = 'pdt-flow-def-tabs';
        tabBar.innerHTML = `
            <button class="pdt-sub-tab active" data-tab="visual">${M.tabVisual}</button>
            <button class="pdt-sub-tab" data-tab="json">${M.tabJson}</button>
        `;

        // Panels
        const visualPanel = document.createElement('div');
        visualPanel.className = 'pdt-flow-def-panel pdt-flow-def-visual';
        visualPanel.style.display = 'block';

        const jsonPanel = document.createElement('div');
        jsonPanel.className = 'pdt-flow-def-panel pdt-flow-def-json';
        jsonPanel.style.display = 'none';

        // Parse definition early
        let parsed = null;
        let definition = null;
        try {
            parsed = JSON.parse(clientData);
            definition = parsed?.properties?.definition;
        } catch { /* invalid JSON */ }

        // Editor state
        const state = { activeTab: 'visual', jsonDirty: false, visualDirty: false, formattedJson: '' };

        // Setup editor — always editable (managed gets a warning note)
        const editor = this._setupDefinitionEditor(jsonPanel, visualPanel, clientData, parsed, state, flowId, isManaged);

        // Render visual — always editable (isManaged=false for edit panels)
        if (definition) {
            // Show managed warning above expand bar
            if (isManaged) {
                const warning = document.createElement('div');
                warning.className = 'pdt-note pdt-note--warning pdt-flow-managed-warning';
                warning.textContent = M.managedEditWarning;
                visualPanel.appendChild(warning);
            }
            const expandBar = this._createExpandCollapseBar(visualPanel);
            visualPanel.append(expandBar, this._renderFlowVisual(definition, false));
        } else {
            visualPanel.innerHTML = `<p class="pdt-note">${M.noDefinition}</p>`;
        }

        // Tab switching
        this._setupDefinitionTabSwitching(tabBar, visualPanel, jsonPanel, state, editor);

        container.append(tabBar, visualPanel, jsonPanel);
        if (editor.footerActionsEl) {
            container._footerActions = editor.footerActionsEl;
        }
        return container;
    }

    /**
     * Sets up the JSON editor panel, footer actions, and save/undo handlers.
     * @param {HTMLElement} jsonPanel - The JSON tab panel.
     * @param {HTMLElement} visualPanel - The Visual tab panel.
     * @param {string} clientData - Raw flow JSON.
     * @param {object|null} parsed - Parsed flow object.
     * @param {object} state - Shared editor state (activeTab, jsonDirty, visualDirty, formattedJson).
     * @param {string} flowId - The flow GUID.
     * @param {boolean} isManaged - Whether the flow is managed.
     * @returns {{footerActionsEl: HTMLElement, saveBtn: HTMLElement, undoBtn: HTMLElement, updateFooterState: Function}}
     * @private
     */
    _setupDefinitionEditor(jsonPanel, visualPanel, clientData, parsed, state, flowId, isManaged) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;

        // Editable JSON textarea
        state.formattedJson = this._formatJsonPreserveOrder(clientData);
        const editContainer = document.createElement('div');
        editContainer.className = 'pdt-flow-json-editor';

        // Managed warning note
        if (isManaged) {
            const warning = document.createElement('div');
            warning.className = 'pdt-note pdt-note--warning pdt-flow-managed-warning';
            warning.textContent = M.managedEditWarning;
            editContainer.appendChild(warning);
        }

        const textarea = document.createElement('textarea');
        textarea.className = 'pdt-flow-json-textarea pdt-input';
        textarea.value = state.formattedJson;
        textarea.spellcheck = false;

        editContainer.appendChild(textarea);
        jsonPanel.appendChild(editContainer);

        // Footer action buttons
        const footerActionsEl = document.createElement('div');
        footerActionsEl.className = 'pdt-flow-footer-actions';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'modern-button pdt-flow-save-btn';
        saveBtn.textContent = M.saveDefinition;
        saveBtn.disabled = true;

        const undoBtn = document.createElement('button');
        undoBtn.className = 'modern-button secondary pdt-flow-undo-btn';
        undoBtn.textContent = M.undoChanges;
        undoBtn.style.display = 'none';

        footerActionsEl.append(saveBtn, undoBtn);

        const updateFooterState = () => {
            const isDirty = state.activeTab === 'json' ? state.jsonDirty : state.visualDirty;
            saveBtn.disabled = !isDirty;
            undoBtn.style.display = isDirty ? '' : 'none';
        };

        // Track JSON textarea changes
        textarea.addEventListener('input', () => {
            state.jsonDirty = textarea.value !== state.formattedJson;
            if (state.activeTab === 'json') {
                updateFooterState();
            }
        });

        // Track visual input changes (event delegation)
        visualPanel.addEventListener('input', (e) => {
            if (e.target.matches('.pdt-flow-edit-input')) {
                state.visualDirty = true;
                if (state.activeTab === 'visual') {
                    updateFooterState();
                }
            }
        });

        // Save handler
        saveBtn.addEventListener('click', async () => {
            await this._handleDefinitionSave(state, textarea, visualPanel, parsed, flowId, updateFooterState, saveBtn, undoBtn);
        });

        // Undo handler
        undoBtn.addEventListener('click', () => {
            this._handleDefinitionUndo(state, textarea, visualPanel, updateFooterState);
        });

        return { footerActionsEl, saveBtn, undoBtn, updateFooterState };
    }

    /**
     * Handles saving the flow definition from either JSON or visual tab.
     * @param {object} state - Editor state.
     * @param {HTMLTextAreaElement} textarea - The JSON textarea.
     * @param {HTMLElement} visualPanel - The visual panel.
     * @param {object|null} parsed - The parsed flow object.
     * @param {string} flowId - The flow GUID.
     * @param {Function} updateFooterState - Callback to refresh footer button states.
     * @param {HTMLButtonElement} saveBtn - The save button element.
     * @param {HTMLButtonElement} undoBtn - The undo button element.
     * @private
     */
    async _handleDefinitionSave(state, textarea, visualPanel, parsed, flowId, updateFooterState, saveBtn, undoBtn) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;

        // Disable buttons during save to prevent double-click
        saveBtn.disabled = true;
        undoBtn.style.display = 'none';

        if (state.activeTab === 'json') {
            const newJson = textarea.value;
            try {
                JSON.parse(newJson);
            } catch {
                NotificationService.show(M.invalidJson, 'error');
                updateFooterState();
                return;
            }
            try {
                BusyIndicator.set();
                await DataService.updateFlowDefinition(flowId, newJson);
                NotificationService.show(M.flowSaved, 'success');
                state.formattedJson = newJson;
                state.jsonDirty = false;
                updateFooterState();
            } catch (e) {
                NotificationService.show(M.flowSaveFailed(escapeHtml(this._extractErrorMessage(e))), 'error');
                updateFooterState();
            } finally {
                BusyIndicator.clear();
            }
        } else {
            // Save from visual inputs
            const editInputs = visualPanel.querySelectorAll('.pdt-flow-edit-input');
            editInputs.forEach(inp => {
                if (inp._stepRef && inp.dataset.inputKey) {
                    this._setNestedValue(inp._stepRef.inputs, inp.dataset.inputKey, inp.value);
                }
            });
            const newJson = JSON.stringify(parsed, null, 2);
            try {
                BusyIndicator.set();
                await DataService.updateFlowDefinition(flowId, newJson);
                NotificationService.show(M.flowSaved, 'success');
                textarea.value = newJson;
                state.formattedJson = newJson;
                state.jsonDirty = false;
                state.visualDirty = false;
                editInputs.forEach(inp => {
                    inp._originalValue = inp.value;
                });
                updateFooterState();
            } catch (e) {
                NotificationService.show(M.flowSaveFailed(escapeHtml(this._extractErrorMessage(e))), 'error');
                updateFooterState();
            } finally {
                BusyIndicator.clear();
            }
        }
    }

    /**
     * Handles undoing changes in either JSON or visual tab.
     * @param {object} state - Editor state.
     * @param {HTMLTextAreaElement} textarea - The JSON textarea.
     * @param {HTMLElement} visualPanel - The visual panel.
     * @param {Function} updateFooterState - Callback to refresh footer button states.
     * @private
     */
    _handleDefinitionUndo(state, textarea, visualPanel, updateFooterState) {
        if (state.activeTab === 'json') {
            textarea.value = state.formattedJson;
            state.jsonDirty = false;
        } else {
            const editInputs = visualPanel.querySelectorAll('.pdt-flow-edit-input');
            editInputs.forEach(inp => {
                inp.value = inp._originalValue ?? '';
            });
            state.visualDirty = false;
        }
        updateFooterState();
    }

    /**
     * Sets up tab switching between visual and JSON panels.
     * @param {HTMLElement} tabBar - The tab bar element.
     * @param {HTMLElement} visualPanel - The visual panel.
     * @param {HTMLElement} jsonPanel - The JSON panel.
     * @param {object} state - Editor state.
     * @param {object} editor - Editor references with updateFooterState.
     * @private
     */
    _setupDefinitionTabSwitching(tabBar, visualPanel, jsonPanel, state, editor) {
        tabBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.pdt-sub-tab');
            if (!btn) {
                return;
            }
            tabBar.querySelectorAll('.pdt-sub-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            state.activeTab = tab;
            visualPanel.style.display = tab === 'visual' ? 'block' : 'none';
            jsonPanel.style.display = tab === 'json' ? 'flex' : 'none';
            editor.updateFooterState();
        });
    }

    /**
     * Creates expand/collapse all toolbar for the visual flow diagram.
     * @param {HTMLElement} visualPanel - The visual panel to target.
     * @returns {HTMLElement}
     * @private
     */
    _createExpandCollapseBar(visualPanel) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        const bar = document.createElement('div');
        bar.className = 'pdt-flow-expand-bar';
        bar.innerHTML = `
            <button class="modern-button secondary pdt-flow-expand-all-btn" title="${M.expandAll}">${M.expandAll}</button>
            <button class="modern-button secondary pdt-flow-collapse-all-btn" title="${M.collapseAll}">${M.collapseAll}</button>
        `;

        bar.querySelector('.pdt-flow-expand-all-btn').addEventListener('click', () => {
            visualPanel.querySelectorAll('.pdt-flow-edit-panel').forEach(p => {
                p.classList.add('pdt-flow-edit-panel--open');
                p.closest('.pdt-flow-node')?.classList.add('pdt-flow-node--expanded');
            });
            visualPanel.querySelectorAll('.pdt-flow-scope-details').forEach(d => {
                d.open = true;
            });
        });

        bar.querySelector('.pdt-flow-collapse-all-btn').addEventListener('click', () => {
            visualPanel.querySelectorAll('.pdt-flow-edit-panel').forEach(p => {
                p.classList.remove('pdt-flow-edit-panel--open');
                p.closest('.pdt-flow-node')?.classList.remove('pdt-flow-node--expanded');
            });
            visualPanel.querySelectorAll('.pdt-flow-scope-details').forEach(d => {
                d.open = false;
            });
        });

        return bar;
    }

    /**
     * Formats JSON while preserving key order (no sorting).
     * @param {string} jsonString - Raw JSON string.
     * @returns {string} - Formatted JSON preserving original key order.
     * @private
     */
    _formatJsonPreserveOrder(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            return JSON.stringify(parsed, null, 2);
        } catch {
            return jsonString;
        }
    }

    /**
     * Renders a visual representation of a flow definition.
     * Shows triggers, actions, conditions, scopes, loops, and switches as a flowchart.
     * @param {object} definition - The parsed flow definition object.
     * @param {boolean} [isManaged=true] - Whether the flow is managed (disables editing).
     * @returns {HTMLElement}
     * @private
     */
    _renderFlowVisual(definition, isManaged = true) {
        const wrapper = document.createElement('div');
        wrapper.className = 'pdt-flow-visual';

        // Render triggers
        if (definition.triggers) {
            for (const [name, trigger] of Object.entries(definition.triggers)) {
                wrapper.appendChild(this._createFlowNode(name, trigger, 'trigger', isManaged));
                wrapper.appendChild(this._createConnector());
            }
        }

        // Render actions in execution order
        if (definition.actions) {
            const orderedActions = this._getOrderedActions(definition.actions);
            orderedActions.forEach((item, index) => {
                wrapper.appendChild(this._createFlowNode(item.name, item.action, 'action', isManaged));
                if (index < orderedActions.length - 1) {
                    wrapper.appendChild(this._createConnector());
                }
            });
        }

        return wrapper;
    }

    /**
     * Orders actions by their runAfter dependencies (topological sort).
     * @param {object} actions - The actions dictionary from the flow definition.
     * @returns {Array<{name: string, action: object}>}
     * @private
     */
    _getOrderedActions(actions) {
        const entries = Object.entries(actions).map(([name, action]) => ({ name, action }));
        const visited = new Set();
        const ordered = [];
        const actionMap = new Map(entries.map(e => [e.name, e]));

        const visit = (name) => {
            if (visited.has(name)) {
                return;
            }
            visited.add(name);
            const entry = actionMap.get(name);
            if (!entry) {
                return;
            }
            const runAfter = entry.action.runAfter || {};
            for (const dep of Object.keys(runAfter)) {
                visit(dep);
            }
            ordered.push(entry);
        };

        entries.forEach(e => visit(e.name));
        return ordered;
    }

    /**
     * Creates a single visual flow node element.
     * @param {string} name - The step name.
     * @param {object} step - The step configuration.
     * @param {'trigger'|'action'} nodeType - The type of node.
     * @returns {HTMLElement}
     * @private
     */
    _createFlowNode(name, step, nodeType, isManaged = true) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        const type = (step.type || '').toLowerCase();
        const kind = step.kind || '';
        const nodeClass = this._getNodeClass(type, nodeType);
        const icon = this._getNodeIcon(type, nodeType);
        const label = this._getNodeLabel(type, nodeType, kind);

        const node = document.createElement('div');
        node.className = `pdt-flow-node ${nodeClass}`;

        // Build the node content
        const header = document.createElement('div');
        header.className = 'pdt-flow-node-header';
        header.innerHTML = `
            <span class="pdt-flow-node-icon">${icon}</span>
            <span class="pdt-flow-node-label">${escapeHtml(label)}</span>
        `;

        const title = document.createElement('div');
        title.className = 'pdt-flow-node-title';
        title.textContent = name;

        node.append(header, title);

        // Add type-specific content
        if (type === 'if' || type === 'switch') {
            const branchContent = this._renderBranchContent(step, type, isManaged);
            const branchCount = branchContent.querySelectorAll('.pdt-flow-branch').length;
            if (branchCount > 0) {
                const details = document.createElement('details');
                details.className = 'pdt-flow-scope-details';
                details.open = true;
                const summary = document.createElement('summary');
                summary.className = 'pdt-flow-scope-summary';
                summary.textContent = M.branchesCount(branchCount);
                details.append(summary, branchContent);
                node.appendChild(details);
            } else {
                node.appendChild(branchContent);
            }
        } else if (type === 'scope' || type === 'foreach' || type === 'until') {
            const actionCount = Object.keys(step.actions || {}).length;
            if (actionCount > 0) {
                const details = document.createElement('details');
                details.className = 'pdt-flow-scope-details';
                details.open = true;
                const summary = document.createElement('summary');
                summary.className = 'pdt-flow-scope-summary';
                summary.textContent = M.scopeActionsCount(actionCount);
                details.append(summary, this._renderScopeContent(step, isManaged));
                node.appendChild(details);
            }
        }

        // Show connection info (inputs summary)
        const inputSummary = this._getInputSummary(step);
        if (inputSummary) {
            const details = document.createElement('div');
            details.className = 'pdt-flow-node-details';
            details.textContent = inputSummary;
            node.appendChild(details);
        }

        // Expandable edit/inspect panel — click header to toggle
        const editPanel = this._buildNodeEditPanel(step, isManaged);
        if (editPanel) {
            node.appendChild(editPanel);
            node.classList.add('pdt-flow-node--clickable');
            header.addEventListener('click', () => {
                editPanel.classList.toggle('pdt-flow-edit-panel--open');
                node.classList.toggle('pdt-flow-node--expanded');
            });
        }

        // Run after info
        if (step.runAfter && Object.keys(step.runAfter).length > 0) {
            const runAfterEl = document.createElement('div');
            runAfterEl.className = 'pdt-flow-node-runafter';
            const deps = Object.keys(step.runAfter).map(d => escapeHtml(d)).join(', ');
            runAfterEl.innerHTML = `<span class="pdt-flow-runafter-label">${M.runAfterLabel}:</span> ${deps}`;
            node.appendChild(runAfterEl);
        }

        return node;
    }

    /**
     * Renders the content for branching actions (If/Switch).
     * @param {object} step - The step configuration.
     * @param {string} type - 'if' or 'switch'.
     * @returns {HTMLElement}
     * @private
     */
    _renderBranchContent(step, type, isManaged = true) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        const branchContainer = document.createElement('div');
        branchContainer.className = 'pdt-flow-branches';

        if (type === 'if') {
            // True/False branches
            const branches = [
                { label: 'Yes', actions: step.actions || {} },
                { label: 'No', actions: step.else?.actions || {} }
            ];
            branches.forEach(branch => {
                const branchEl = document.createElement('div');
                branchEl.className = 'pdt-flow-branch';
                branchEl.innerHTML = `<div class="pdt-flow-branch-label">${branch.label}</div>`;
                const actionCount = Object.keys(branch.actions).length;
                if (actionCount > 0) {
                    const subActions = this._getOrderedActions(branch.actions);
                    subActions.forEach(item => {
                        branchEl.appendChild(this._createFlowNode(item.name, item.action, 'action', isManaged));
                    });
                }
                branchContainer.appendChild(branchEl);
            });
        } else if (type === 'switch') {
            const cases = step.cases || {};
            for (const [caseName, caseData] of Object.entries(cases)) {
                const branchEl = document.createElement('div');
                branchEl.className = 'pdt-flow-branch';
                branchEl.innerHTML = `<div class="pdt-flow-branch-label">${M.caseLabel}: ${escapeHtml(caseName)}</div>`;
                if (caseData.actions) {
                    const subActions = this._getOrderedActions(caseData.actions);
                    subActions.forEach(item => {
                        branchEl.appendChild(this._createFlowNode(item.name, item.action, 'action', isManaged));
                    });
                }
                branchContainer.appendChild(branchEl);
            }
            // Default case
            if (step.default?.actions) {
                const defEl = document.createElement('div');
                defEl.className = 'pdt-flow-branch';
                defEl.innerHTML = `<div class="pdt-flow-branch-label">${M.defaultCaseLabel}</div>`;
                const subActions = this._getOrderedActions(step.default.actions);
                subActions.forEach(item => {
                    defEl.appendChild(this._createFlowNode(item.name, item.action, 'action', isManaged));
                });
                branchContainer.appendChild(defEl);
            }
        }

        return branchContainer;
    }

    /**
     * Renders nested actions inside a scope, foreach, or until.
     * @param {object} step - The step configuration.
     * @returns {HTMLElement}
     * @private
     */
    _renderScopeContent(step, isManaged = true) {
        const scopeContainer = document.createElement('div');
        scopeContainer.className = 'pdt-flow-scope-content';

        if (step.actions && Object.keys(step.actions).length > 0) {
            const subActions = this._getOrderedActions(step.actions);
            subActions.forEach((item, index) => {
                scopeContainer.appendChild(this._createFlowNode(item.name, item.action, 'action', isManaged));
                if (index < subActions.length - 1) {
                    scopeContainer.appendChild(this._createConnector());
                }
            });
        }

        return scopeContainer;
    }

    /**
     * Creates a visual connector arrow between flow nodes.
     * @returns {HTMLElement}
     * @private
     */
    _createConnector() {
        const connector = document.createElement('div');
        connector.className = 'pdt-flow-connector';
        connector.innerHTML = '<div class="pdt-flow-connector-line"></div><div class="pdt-flow-connector-arrow">▼</div>';
        return connector;
    }

    /**
     * Returns the CSS class for a node based on its type.
     * @param {string} type - The step type.
     * @param {string} nodeType - 'trigger' or 'action'.
     * @returns {string}
     * @private
     */
    _getNodeClass(type, nodeType) {
        if (nodeType === 'trigger') {
            return 'pdt-flow-node--trigger';
        }
        switch (type) {
            case 'if': return 'pdt-flow-node--condition';
            case 'switch': return 'pdt-flow-node--condition';
            case 'scope': return 'pdt-flow-node--scope';
            case 'foreach': return 'pdt-flow-node--loop';
            case 'until': return 'pdt-flow-node--loop';
            case 'openapicconnection':
            case 'openapiconnection':
            case 'apiconnection': return 'pdt-flow-node--connector';
            default: return 'pdt-flow-node--action';
        }
    }

    /**
     * Returns an icon for a node based on its type.
     * @param {string} type - The step type.
     * @param {string} nodeType - 'trigger' or 'action'.
     * @returns {string}
     * @private
     */
    _getNodeIcon(type, nodeType) {
        if (nodeType === 'trigger') {
            return '⚡';
        }
        if (!this._nodeIconMap) {
            this._nodeIconMap = {
                if: '◇', switch: '⊞', scope: '☐', foreach: '🔄', until: '🔁',
                compose: '📝', http: '🌐', response: '↩️', terminate: '🛑', wait: '⏳',
                initializevariable: '📌', setvariable: '📌', incrementvariable: '📌',
                appendtostringvariable: '📌', appendtoarrayvariable: '📌', parsejson: '{ }'
            };
        }
        return this._nodeIconMap[type] ?? '▸';
    }

    /**
     * Returns a human-readable label for a node type using a lookup map.
     * @param {string} type - The step type.
     * @param {string} nodeType - 'trigger' or 'action'.
     * @param {string} kind - The kind sub-type.
     * @returns {string}
     * @private
     */
    _getNodeLabel(type, nodeType, kind) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        if (nodeType === 'trigger') {
            return kind ? `${M.triggerLabel} (${kind})` : M.triggerLabel;
        }
        if (!this._nodeLabelMap) {
            this._nodeLabelMap = {
                if: M.conditionLabel, switch: M.switchLabel, scope: M.scopeLabel,
                foreach: M.foreachLabel, until: M.doUntilLabel, compose: M.composeLabel,
                http: M.httpLabel, response: M.responseLabel, terminate: M.terminateLabel,
                wait: M.waitLabel, initializevariable: M.initVarLabel, setvariable: M.setVarLabel,
                incrementvariable: M.incrementVarLabel, appendtostringvariable: M.appendStringLabel,
                appendtoarrayvariable: M.appendArrayLabel, parsejson: M.parseJsonLabel,
                openapicconnection: M.connectorLabel, openapiconnection: M.connectorLabel,
                apiconnection: M.connectorLabel
            };
        }
        return this._nodeLabelMap[type] ?? M.actionLabel;
    }

    /**
     * Extracts a brief summary of the step inputs for display.
     * @param {object} step - The step configuration.
     * @returns {string|null}
     * @private
     */
    _getInputSummary(step) {
        const inputs = step.inputs;
        if (!inputs) {
            return null;
        }

        // Show connector operation if available
        if (inputs.host?.operationId) {
            return `Operation: ${inputs.host.operationId}`;
        }

        // Show HTTP method and URI
        if (inputs.method && inputs.uri) {
            return `${inputs.method} ${inputs.uri}`;
        }

        // Show entity name for Dataverse operations
        if (inputs.parameters?.entityName) {
            return `Table: ${inputs.parameters.entityName}`;
        }

        return null;
    }

    /**
     * Builds an expandable edit/inspect panel for a flow node.
     * All flows get editable input fields for their step inputs.
     * @param {object} step - The step configuration.
     * @param {boolean} _isManaged - Unused; kept for API compatibility.
     * @returns {HTMLElement|null} The edit panel element, or null if no inputs.
     * @private
     */
    _buildNodeEditPanel(step, _isManaged) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        const inputs = step.inputs;
        if (!inputs || (typeof inputs === 'object' && Object.keys(inputs).length === 0)) {
            return null;
        }

        // If inputs is a string expression (e.g. "@union(...)"), render as single value
        if (typeof inputs !== 'object') {
            const panel = document.createElement('div');
            panel.className = 'pdt-flow-edit-panel';
            const panelHeader = document.createElement('div');
            panelHeader.className = 'pdt-flow-edit-panel-header';
            panelHeader.textContent = M.nodeInputsLabel;
            const row = document.createElement('div');
            row.className = 'pdt-flow-edit-row';
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'pdt-flow-edit-input pdt-input';
            input.value = String(inputs);
            input.title = String(inputs);
            input.readOnly = true;
            row.appendChild(input);
            panel.append(panelHeader, row);
            return panel;
        }

        const panel = document.createElement('div');
        panel.className = 'pdt-flow-edit-panel';

        const panelHeader = document.createElement('div');
        panelHeader.className = 'pdt-flow-edit-panel-header';
        panelHeader.textContent = M.nodeInputsLabel;
        panel.appendChild(panelHeader);

        const rows = this._flattenInputs(inputs);
        if (rows.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'pdt-flow-edit-row pdt-note';
            empty.textContent = M.nodeNoInputs;
            panel.appendChild(empty);
            return panel;
        }

        rows.forEach(({ key, value }) => {
            const row = document.createElement('div');
            row.className = 'pdt-flow-edit-row';

            const label = document.createElement('span');
            label.className = 'pdt-flow-edit-label';
            label.textContent = key;

            const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'pdt-flow-edit-input pdt-input';
            input.value = displayValue;
            input.title = displayValue;
            input.dataset.inputKey = key;
            input._stepRef = step;
            input._originalValue = displayValue;
            row.append(label, input);

            panel.appendChild(row);
        });

        return panel;
    }

    /**
     * Flattens a nested inputs object into key-value pairs for display.
     * Drills one level into nested objects to show meaningful properties.
     * @param {object} inputs - The step inputs.
     * @param {string} [prefix=''] - Key prefix for nested properties.
     * @returns {Array<{key: string, value: *}>}
     * @private
     */
    _flattenInputs(inputs, prefix = '') {
        if (typeof inputs !== 'object' || inputs === null) {
            return [{ key: prefix || 'value', value: inputs }];
        }
        const rows = [];
        for (const [key, value] of Object.entries(inputs)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                // Go one level deep for nested objects
                rows.push(...this._flattenInputs(value, fullKey));
            } else {
                rows.push({ key: fullKey, value });
            }
        }
        return rows;
    }

    /**
     * Sets a value in a nested object using a dot-notation key path.
     * Attempts to preserve the original value type (number, boolean, array).
     * @param {object} obj - The root object to modify.
     * @param {string} keyPath - Dot-notation path (e.g., 'host.operationId').
     * @param {string} value - The new string value from the input field.
     * @private
     */
    _setNestedValue(obj, keyPath, value) {
        const keys = keyPath.split('.');
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        const lastKey = keys[keys.length - 1];
        const original = current[lastKey];
        if (typeof original === 'number') {
            const num = Number(value);
            current[lastKey] = isNaN(num) ? value : num;
        } else if (typeof original === 'boolean') {
            current[lastKey] = value === 'true';
        } else if (Array.isArray(original)) {
            try {
                current[lastKey] = JSON.parse(value);
            } catch {
                current[lastKey] = value;
            }
        } else {
            current[lastKey] = value;
        }
    }

    /**
     * Extracts the most detailed error message from an API error.
     * Falls back to the standard error message if no detailed info is available.
     * @param {Error} error - The error object (may include response.data from WebApiService).
     * @returns {string} The extracted error message.
     * @private
     */
    _extractErrorMessage(error) {
        try {
            if (error.response?.data) {
                const parsed = JSON.parse(error.response.data);
                if (parsed?.error?.message) {
                    return parsed.error.message;
                }
            }
        } catch { /* response body is not JSON, use fallback */ }
        return error.message || String(error);
    }

    /**
     * Opens the flow in the Power Automate maker portal using the real environment ID.
     * @param {string} flowId - The flow GUID.
     * @private
     */
    _handleOpenInPortal(flowId) {
        try {
            const gc = PowerAppsApiService.getGlobalContext();
            const appProps = gc.getCurrentAppProperties?.();
            const envId = appProps?.environmentId;
            if (envId && envId !== 'N/A') {
                window.open(`https://make.powerautomate.com/environments/${envId}/flows/${flowId}/details`, '_blank');
            } else {
                window.open(`https://make.powerautomate.com/flows/${flowId}/details`, '_blank');
            }
        } catch {
            window.open(`https://make.powerautomate.com/flows/${flowId}/details`, '_blank');
        }
    }

    /**
     * Filters visible flow cards based on search input.
     * @private
     */
    _filterCards() {
        const term = this.ui.searchInput?.value?.toLowerCase().trim() || '';
        this.ui.listContainer?.querySelectorAll('.pdt-flow-card').forEach(card => {
            const text = card.dataset.searchTerm || '';
            card.style.display = text.includes(term) ? '' : 'none';
        });
    }

    /**
     * Lifecycle hook for cleaning up event listeners.
     */
    destroy() {
        if (this.ui.solutionSelect && this._solutionSelectHandler) {
            this.ui.solutionSelect.removeEventListener('change', this._solutionSelectHandler);
        }
        if (this.ui.refreshBtn && this._refreshBtnHandler) {
            this.ui.refreshBtn.removeEventListener('click', this._refreshBtnHandler);
        }
        if (this.ui.searchInput && this._searchInputHandler) {
            this.ui.searchInput.removeEventListener('input', this._searchInputHandler);
        }
        if (this.ui.listContainer && this._listClickHandler) {
            this.ui.listContainer.removeEventListener('click', this._listClickHandler);
        }
        if (this.filterCards?.cancel) {
            this.filterCards.cancel();
        }
    }
}
