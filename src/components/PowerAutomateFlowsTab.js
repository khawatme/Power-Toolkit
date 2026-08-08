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
import { BusyIndicator } from '../utils/ui/BusyIndicator.js';
import { PreferencesHelper } from '../utils/ui/PreferencesHelper.js';

/** @typedef {import('../services/FlowService.js').CloudFlow} CloudFlow */
/** @typedef {import('../services/FlowService.js').FlowRun} FlowRun */
/** @typedef {import('../services/FlowService.js').FlowRunLog} FlowRunLog */

/**
 * Maps a `runAfter` status (as stored in the flow definition) to its dot CSS modifier and the
 * message key for its label — mirroring the maker portal's coloured "Run after" indicators.
 * @type {Object.<string, {cls: string, msg: string}>}
 */
const RUN_AFTER_STATUS_META = {
    Succeeded: { cls: 'succeeded', msg: 'runAfterSucceeded' },
    Failed: { cls: 'failed', msg: 'runAfterFailed' },
    TimedOut: { cls: 'timedout', msg: 'runAfterTimedOut' },
    Skipped: { cls: 'skipped', msg: 'runAfterSkipped' }
};

/** The four runAfter statuses in the order the maker portal shows them. @type {string[]} */
const RUN_AFTER_STATUS_ORDER = ['Succeeded', 'Failed', 'TimedOut', 'Skipped'];

/** SVG namespace and the arrowhead-marker id prefix for the flow-diagram join edges. */
const SVG_NS = 'http://www.w3.org/2000/svg';
const FLOW_ARROW_MARKER_ID = 'pdt-flow-arrowhead';

/**
 * Distinct hues cycled per join target so every node's incoming arrows share one colour — making
 * dense graphs (many converging arrows) easy to read. Mid-tones that work on light and dark themes.
 * @type {string[]}
 */
const FLOW_EDGE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#ef4444', '#0ea5e9'];

/**
 * Join arrows are routed orthogonally in dedicated vertical "lanes" in the right-side gutter, so they
 * run to the right of every node instead of crossing over the boxes. Each join target gets its own
 * lane, spaced {@link FLOW_EDGE_LANE_GAP_PX} apart, starting to the right of the widest node.
 * {@link FLOW_EDGE_LANE_MARGIN_PX} adds breathing room (and arrowhead clearance) on the far right, and
 * {@link FLOW_EDGE_CORNER_R} rounds the lane corners. Lane geometry is derived from the number of
 * joins (not measured widths), so reserving the gutter can't cause a ResizeObserver feedback loop.
 */
const FLOW_EDGE_LANE_GAP_PX = 22;
const FLOW_EDGE_LANE_MARGIN_PX = 28;
const FLOW_EDGE_CORNER_R = 30;

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

        // --- Run History sub-view state ---
        /** @type {'flows'|'runs'} */
        this.activeSubView = 'flows';
        /** @type {string|null} */
        this.selectedRunFlowId = null;
        /** @type {FlowRun[]} */
        this.allRuns = [];
        /** @type {string} Server-side status filter ('' = all). */
        this.runStatusFilter = '';
        /** @private {number|null} Live-polling timer id. */
        this.runPollingTimer = null;
        /** @private {string|null} The flow id whose runs are currently loaded (lazy-load guard). */
        this._runsLoadedFlowId = null;
        /** @private */
        this.filterRuns = debounce(this._filterRuns, 250);

        // Handler references for cleanup
        /** @private {Function|null} */ this._solutionSelectHandler = null;
        /** @private {Function|null} */ this._refreshBtnHandler = null;
        /** @private {Function|null} */ this._searchInputHandler = null;
        /** @private {Function|null} */ this._listClickHandler = null;
        /** @private {Function|null} */ this._subTabsHandler = null;
        /** @private {Function|null} */ this._runFlowSelectHandler = null;
        /** @private {Function|null} */ this._runRefreshHandler = null;
        /** @private {Function|null} */ this._runSearchHandler = null;
        /** @private {Function|null} */ this._runStatusFilterHandler = null;
        /** @private {Function|null} */ this._runLiveToggleHandler = null;
        /** @private {Function|null} */ this._runListClickHandler = null;
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

            <div class="pdt-toolbar flex-shrink-0">
                <select id="pdt-flow-solution-select" class="pdt-input" style="flex: 1;">
                    <option value="">${Config.MESSAGES.COMMON.selectSolutionDropdown}</option>
                </select>
            </div>

            <div class="pdt-sub-tabs pdt-flow-subtabs flex-shrink-0 pdt-hidden" role="tablist" aria-label="Power Automate">
                <button type="button" class="pdt-sub-tab active" data-subview="flows" role="tab" aria-selected="true">${M.subTabFlows}</button>
                <button type="button" class="pdt-sub-tab" data-subview="runs" role="tab" aria-selected="false">${M.subTabRuns}</button>
            </div>

            <div class="pdt-flow-subview pdt-full-height-column" data-subview-panel="flows">
                <div id="pdt-flow-toolbar" class="pdt-toolbar pdt-hidden">
                    <input type="text" id="flow-search" class="pdt-input" placeholder="Search by name, status, or owner..." style="flex: 1;">
                    <button id="flow-refresh-btn" class="modern-button" disabled>${M.refreshFlows}</button>
                </div>
                <div id="flow-list" class="pdt-content-host pdt-card-grid">
                    <p class="pdt-note">${M.selectSolution}</p>
                </div>
            </div>

            <div class="pdt-flow-subview pdt-full-height-column pdt-hidden" data-subview-panel="runs">
                <div class="pdt-toolbar">
                    <select id="pdt-run-flow-select" class="pdt-input" style="flex: 1;" disabled>
                        <option value="">${M.selectFlowPlaceholder}</option>
                    </select>
                    <button id="run-refresh-btn" class="modern-button" disabled>${M.refreshRuns}</button>
                </div>
                <div class="pdt-toolbar pdt-flow-runs-toolbar2">
                    <input type="text" id="run-search" class="pdt-input" placeholder="${M.runSearchPlaceholder}" style="flex: 1;" disabled>
                    <div class="pdt-toolbar-group pdt-flow-runs-controls">
                        <select id="run-status-filter" class="pdt-input pdt-flow-run-status-select" disabled>
                            <option value="">${M.runStatusAll}</option>
                            <option value="Succeeded">${M.runStatusSucceeded}</option>
                            <option value="Failed">${M.runStatusFailed}</option>
                            <option value="Cancelled">${M.runStatusCancelled}</option>
                            <option value="Running">${M.runStatusRunning}</option>
                        </select>
                        <label class="pdt-toggle-label" title="${M.liveOn}">
                            <span id="run-live-indicator" class="live-indicator" aria-hidden="true"></span>
                            ${M.liveOn}
                            <span class="pdt-toggle-switch">
                                <input type="checkbox" id="run-live-toggle" disabled>
                                <span class="pdt-toggle-slider"></span>
                            </span>
                        </label>
                        <select id="run-live-interval" class="pdt-select w-80" title="Polling interval" disabled>
                            <option value="5000">${M.liveInterval5}</option>
                            <option value="10000" selected>${M.liveInterval10}</option>
                            <option value="30000">${M.liveInterval30}</option>
                        </select>
                    </div>
                </div>
                <div id="run-summary" class="pdt-flow-run-summary pdt-hidden"></div>
                <div id="run-list" class="pdt-content-host">
                    <p class="pdt-note">${M.selectFlowForRuns}</p>
                </div>
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
            subTabs: element.querySelector('.pdt-flow-subtabs'),
            flowsPanel: element.querySelector('[data-subview-panel="flows"]'),
            runsPanel: element.querySelector('[data-subview-panel="runs"]'),
            flowsToolbar: element.querySelector('#pdt-flow-toolbar'),
            solutionSelect: element.querySelector('#pdt-flow-solution-select'),
            searchInput: element.querySelector('#flow-search'),
            listContainer: element.querySelector('#flow-list'),
            refreshBtn: element.querySelector('#flow-refresh-btn'),
            // Run History sub-view
            runFlowSelect: element.querySelector('#pdt-run-flow-select'),
            runRefreshBtn: element.querySelector('#run-refresh-btn'),
            runSearchInput: element.querySelector('#run-search'),
            runStatusFilter: element.querySelector('#run-status-filter'),
            runLiveToggle: element.querySelector('#run-live-toggle'),
            runLiveInterval: element.querySelector('#run-live-interval'),
            runLiveIndicator: element.querySelector('#run-live-indicator'),
            runSummary: element.querySelector('#run-summary'),
            runList: element.querySelector('#run-list')
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
            } else if (button.matches('.flow-runs-btn')) {
                await this._handleViewRunsForFlow(flowId);
            }
        };

        this.ui.solutionSelect.addEventListener('change', this._solutionSelectHandler);
        this.ui.refreshBtn.addEventListener('click', this._refreshBtnHandler);
        this.ui.searchInput.addEventListener('input', this._searchInputHandler);
        this.ui.listContainer.addEventListener('click', this._listClickHandler);

        // --- Run History sub-view listeners ---
        this._subTabsHandler = (e) => {
            const btn = /** @type {HTMLElement|null} */ (e.target)?.closest('.pdt-sub-tab');
            if (btn?.dataset.subview) {
                this._switchSubView(btn.dataset.subview);
            }
        };
        this._runFlowSelectHandler = () => this._onRunFlowSelected();
        this._runRefreshHandler = () => this._loadRuns();
        this._runSearchHandler = () => this.filterRuns();
        this._runStatusFilterHandler = () => this._handleRunStatusFilter();
        this._runLiveToggleHandler = () => this._handleRunPolling(this.ui.runLiveToggle.checked);
        this._runListClickHandler = (e) => this._onRunListClick(e);

        this.ui.subTabs.addEventListener('click', this._subTabsHandler);
        this.ui.runFlowSelect.addEventListener('change', this._runFlowSelectHandler);
        this.ui.runRefreshBtn.addEventListener('click', this._runRefreshHandler);
        this.ui.runSearchInput.addEventListener('input', this._runSearchHandler);
        this.ui.runStatusFilter.addEventListener('change', this._runStatusFilterHandler);
        this.ui.runLiveToggle.addEventListener('change', this._runLiveToggleHandler);
        this.ui.runList.addEventListener('click', this._runListClickHandler);
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

            this.ui.solutionSelect.innerHTML = `<option value="">${Config.MESSAGES.COMMON.selectSolutionDropdown}</option>`;
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

        // Changing the (shared) solution resets the Run History view and stops any live polling.
        this._stopRunLive();
        this._resetRunLiveToggle();
        this._resetRunHistory();

        if (!this.selectedSolutionId) {
            this.ui.refreshBtn.disabled = true;
            this.allFlows = [];
            // Hide the sub-tabs and the Flows search/refresh until a solution is chosen.
            this._switchSubView('flows');
            this.ui.subTabs.classList.add('pdt-hidden');
            this.ui.flowsToolbar.classList.add('pdt-hidden');
            this.ui.listContainer.innerHTML = `<p class="pdt-note">${M.selectSolution}</p>`;
            return;
        }

        this.ui.subTabs.classList.remove('pdt-hidden');
        this.ui.flowsToolbar.classList.remove('pdt-hidden');
        this.ui.refreshBtn.disabled = false;
        await this._loadFlows();
        // Reuse the just-loaded flows for the Run History flow picker (no second solution choice).
        this._populateRunFlowSelect();
        // If the user is already on the Run History view, load the auto-selected flow's runs now.
        if (this.activeSubView === 'runs') {
            this._ensureRunsLoaded();
        }
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
        card.dataset.isAgentFlow = String(flow.isAgentFlow === true);

        const statusClass = this._getStatusClass(flow.statecode);
        const statusText = this._getStatusText(flow.statecode);
        const managedBadge = flow.isManaged
            ? `<span class="pdt-capi-badge pdt-capi-badge-managed">${M.managedLabel}</span>`
            : `<span class="pdt-capi-badge pdt-capi-badge-unmanaged">${M.unmanagedLabel}</span>`;
        const agentFlowBadge = flow.isAgentFlow
            ? `<span class="pdt-capi-badge pdt-capi-badge-agent-flow" title="${M.agentFlowBadgeTitle}">${M.agentFlowLabel}</span>`
            : '';

        const searchText = [flow.name, flow.description, flow.owner, statusText, flow.isAgentFlow ? M.agentFlowLabel : '']
            .join(' ').toLowerCase();
        card.dataset.searchTerm = searchText;

        card.innerHTML = `
            <div class="pdt-card-header pdt-flow-header">
                <div class="pdt-flow-title-row">
                    <span class="pdt-flow-name">${escapeHtml(flow.name)}</span>
                    <div class="pdt-flow-badges">
                        <span class="pdt-status-badge ${statusClass}">${statusText}</span>
                        ${managedBadge}
                        ${agentFlowBadge}
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
        const openText = flow.isAgentFlow ? M.openInCopilotStudio : M.openInPortal;

        if (flow.isManaged) {
            return `
                <div class="pdt-flow-actions-group">
                    <button class="modern-button secondary flow-runs-btn" title="${M.runsTitle}">${M.runsCardAction}</button>
                    <button class="modern-button secondary flow-open-btn" title="${openText}">${openText}</button>
                    <button class="modern-button secondary flow-view-btn" title="${M.viewDefinition}">${M.viewDefinition}</button>
                    <button class="modern-button ${toggleClass} flow-toggle-btn" title="${toggleText}">${toggleText}</button>
                </div>
            `;
        }

        return `
            <div class="pdt-flow-actions-group">
                <button class="modern-button secondary flow-delete-btn" title="${M.deleteFlow}">${M.deleteFlow}</button>
                <button class="modern-button secondary flow-runs-btn" title="${M.runsTitle}">${M.runsCardAction}</button>
                <button class="modern-button secondary flow-open-btn" title="${openText}">${openText}</button>
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

        const markVisualDirty = () => {
            state.visualDirty = true;
            if (state.activeTab === 'visual') {
                updateFooterState();
            }
        };

        visualPanel.addEventListener('input', (e) => {
            if (e.target.matches('.pdt-flow-edit-input') || e.target.matches('.pdt-runafter-toggle')) {
                markVisualDirty();
            }
        });

        visualPanel.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.pdt-runafter-remove');
            if (removeBtn) {
                this._handleRunAfterRemove(removeBtn);
                markVisualDirty();
            }
        });

        visualPanel.addEventListener('change', (e) => {
            if (e.target.matches('.pdt-runafter-add') && e.target.value) {
                this._handleRunAfterAdd(e.target);
                markVisualDirty();
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
            this._applyRunAfterEdits(visualPanel);
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
            visualPanel.querySelectorAll('.pdt-flow-node-runafter').forEach(section => {
                section.replaceWith(this._renderRunAfter(section._stepRef, section._selfName, section._siblingNames));
            });
            const wrapper = visualPanel.querySelector('.pdt-flow-visual');
            if (wrapper) {
                this._drawJoinArrows(wrapper);
            }
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

        // Flatten triggers + execution-ordered actions into a single node list.
        const nodes = [];
        if (definition.triggers) {
            Object.entries(definition.triggers).forEach(([name, trigger]) => nodes.push({ name, step: trigger, type: 'trigger' }));
        }
        if (definition.actions) {
            this._getOrderedActions(definition.actions).forEach(item => nodes.push({ name: item.name, step: item.action, type: 'action' }));
        }

        wrapper.appendChild(this._createEdgesLayer());

        const levelActions = nodes.filter(n => n.type === 'action').map(n => ({ name: n.name, step: n.step }));
        nodes.forEach((n, index) => {
            const predecessors = n.type === 'action' ? Object.keys(n.step.runAfter || {}) : [];
            if (index > 0 && predecessors.length <= 1) {
                wrapper.appendChild(this._createConnector());
            }
            const addable = n.type === 'action' ? this._validPredecessorNames(levelActions, n.name) : [];
            const nodeEl = this._createFlowNode(n.name, n.step, n.type, isManaged, addable);
            nodeEl.dataset.flowNode = n.name;
            wrapper.appendChild(nodeEl);
        });

        this._scheduleEdgeDraw(wrapper);
        return wrapper;
    }

    /**
     * The actions (same level) that may be added as run-after predecessors of `selfName`: every other
     * action that is not a descendant of it. Per the Logic Apps/Power Automate schema, `runAfter`
     * references predecessor *actions* only (never the trigger — the first action runs after the
     * trigger implicitly via an empty runAfter), and a predecessor must not create a cycle.
     * @param {Array<{name: string, step: object}>} actions - The actions at this level.
     * @param {string} selfName - The step whose predecessors are being chosen.
     * @returns {string[]}
     * @private
     */
    _validPredecessorNames(actions, selfName) {
        const descendants = this._collectDescendants(selfName, actions);
        return actions.map(a => a.name).filter(name => name !== selfName && !descendants.has(name));
    }

    /**
     * Collects every action that (transitively) runs after `selfName` — i.e. its descendants — so they
     * can be excluded as predecessor options (adding one would create a cycle).
     * @param {string} selfName
     * @param {Array<{name: string, step: object}>} actions
     * @returns {Set<string>}
     * @private
     */
    _collectDescendants(selfName, actions) {
        const descendants = new Set();
        const visit = (name) => {
            actions.forEach(a => {
                if (!descendants.has(a.name) && Object.keys(a.step.runAfter || {}).includes(name)) {
                    descendants.add(a.name);
                    visit(a.name);
                }
            });
        };
        visit(selfName);
        return descendants;
    }

    /**
     * Creates the absolute SVG overlay (with an arrowhead marker) used to draw join edges.
     * @returns {SVGElement}
     * @private
     */
    _createEdgesLayer() {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'pdt-flow-edges');
        svg.setAttribute('aria-hidden', 'true');

        // One arrowhead marker per palette colour, so each edge's head matches its stroke.
        const defs = document.createElementNS(SVG_NS, 'defs');
        FLOW_EDGE_COLORS.forEach((color, i) => {
            const marker = document.createElementNS(SVG_NS, 'marker');
            marker.setAttribute('id', `${FLOW_ARROW_MARKER_ID}-${i}`);
            marker.setAttribute('viewBox', '0 0 10 10');
            marker.setAttribute('refX', '9');
            marker.setAttribute('refY', '5');
            marker.setAttribute('markerWidth', '7');
            marker.setAttribute('markerHeight', '7');
            marker.setAttribute('orient', 'auto-start-reverse');
            const head = document.createElementNS(SVG_NS, 'path');
            head.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
            head.setAttribute('fill', color);
            marker.appendChild(head);
            defs.appendChild(marker);
        });
        svg.appendChild(defs);
        return svg;
    }

    /**
     * Draws the join edges once the visual is laid out, and re-draws on size changes (expand/collapse,
     * resize). Guarded so it degrades to a no-op where ResizeObserver/layout is unavailable (tests).
     * @param {HTMLElement} wrapper - The visual wrapper.
     * @private
     */
    _scheduleEdgeDraw(wrapper) {
        const draw = () => this._drawJoinArrows(wrapper);
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(draw);
            observer.observe(wrapper);
            wrapper._edgesObserver = observer;
        }
        draw();
    }

    /**
     * Draws a curved arrow from each predecessor box to every join node (a step that runs after more
     * than one predecessor), so the convergence is shown as real component-to-component arrows.
     * @param {HTMLElement} wrapper - The visual wrapper.
     * @private
     */
    _drawJoinArrows(wrapper) {
        const svg = wrapper.querySelector('.pdt-flow-edges');
        if (!svg) {
            return;
        }
        svg.querySelectorAll('path.pdt-flow-edge').forEach(p => p.remove());

        const nodeEls = [...wrapper.querySelectorAll('[data-flow-node]')];
        const byName = new Map(nodeEls.map(el => [el.dataset.flowNode, el]));
        const joinNodes = nodeEls.filter(el => this._nodePredecessors(el).length > 1);

        const gutter = joinNodes.length
            ? `${FLOW_EDGE_LANE_GAP_PX * (joinNodes.length + 1) + FLOW_EDGE_LANE_MARGIN_PX}px`
            : '';
        if (wrapper.style.paddingRight !== gutter) {
            wrapper.style.paddingRight = gutter;
        }

        const width = wrapper.scrollWidth || wrapper.offsetWidth || 0;
        const height = wrapper.scrollHeight || wrapper.offsetHeight || 0;
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));

        if (!joinNodes.length) {
            return;
        }

        const maxRight = nodeEls.reduce((max, el) => Math.max(max, el.offsetLeft + el.offsetWidth), 0);
        joinNodes.forEach((nodeEl, i) => {
            // Each join target gets its own colour and its own lane; all its incoming arrows share them.
            const colorIndex = i % FLOW_EDGE_COLORS.length;
            const laneX = maxRight + FLOW_EDGE_LANE_GAP_PX * (i + 1);
            // Tint the node's run-after accent to match, so colour maps back to the node.
            const accent = nodeEl.querySelector('.pdt-flow-node-runafter--join');
            if (accent) {
                accent.style.borderLeftColor = FLOW_EDGE_COLORS[colorIndex];
            }
            this._nodePredecessors(nodeEl).forEach(predName => {
                const predEl = byName.get(predName);
                if (predEl) {
                    svg.appendChild(this._buildEdgePath(predEl, nodeEl, colorIndex, laneX));
                }
            });
        });
    }

    /**
     * Reads a top-level node's current predecessors from its own runAfter section (live — so edits
     * are reflected). Uses the section that is a direct child, not a nested scope's section.
     * @param {HTMLElement} nodeEl - The flow node element.
     * @returns {string[]} Predecessor names.
     * @private
     */
    _nodePredecessors(nodeEl) {
        const section = [...nodeEl.children].find(c => c.classList?.contains('pdt-flow-node-runafter'));
        if (!section) {
            return [];
        }
        return [...section.querySelectorAll('.pdt-flow-runafter-dep')].map(d => d.dataset.dep).filter(Boolean);
    }

    /**
     * Builds a smooth SVG edge that sweeps out of the predecessor box's right edge into the join's
     * dedicated vertical lane (clear of all node boxes), runs down (or up) the lane, then sweeps back
     * into the target box's right edge — ending in a colour-matched arrowhead. The entry and exit are
     * curves (no sharp corners); a short straight lane segment between them guarantees the arrow can't
     * cross a node even when the predecessor is much narrower than the boxes below it. Geometry uses
     * offset positions relative to the wrapper.
     * @param {HTMLElement} predEl - The predecessor node element.
     * @param {HTMLElement} nodeEl - The target (join) node element.
     * @param {number} colorIndex - Index into {@link FLOW_EDGE_COLORS} for this target.
     * @param {number} laneX - The x of this join's vertical routing lane (right of every node).
     * @returns {SVGPathElement}
     * @private
     */
    _buildEdgePath(predEl, nodeEl, colorIndex, laneX) {
        const x1 = predEl.offsetLeft + predEl.offsetWidth;
        const y1 = predEl.offsetTop + predEl.offsetHeight / 2;
        const x2 = nodeEl.offsetLeft + nodeEl.offsetWidth;
        const y2 = nodeEl.offsetTop + nodeEl.offsetHeight / 2;
        // `dir` is the travel direction down the lane (+1 down, -1 up); predecessors run before the
        // target so normally +1. `bend` is how much vertical room each sweep uses — clamped to half the
        // span so short arrows curve into one continuous S instead of overshooting.
        const dir = y2 >= y1 ? 1 : -1;
        const bend = Math.min(FLOW_EDGE_CORNER_R, Math.abs(y2 - y1) / 2);
        const d = [
            `M ${x1} ${y1}`,                                   // predecessor's right edge
            `C ${laneX} ${y1}, ${laneX} ${y1}, ${laneX} ${y1 + bend * dir}`, // sweep into the lane
            `V ${y2 - bend * dir}`,                            // run along the lane to the target's row
            `C ${laneX} ${y2}, ${laneX} ${y2}, ${x2} ${y2}`    // sweep into the target (arrow points left)
        ].join(' ');

        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', 'pdt-flow-edge');
        // Inline style (not a stroke attribute) so it isn't overridden by the .pdt-flow-edge CSS rule.
        path.style.stroke = FLOW_EDGE_COLORS[colorIndex];
        path.setAttribute('marker-end', `url(#${FLOW_ARROW_MARKER_ID}-${colorIndex})`);
        path.setAttribute('d', d);
        path.dataset.from = predEl.dataset.flowNode;
        path.dataset.to = nodeEl.dataset.flowNode;
        path.dataset.colorIndex = String(colorIndex);
        return path;
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
    _createFlowNode(name, step, nodeType, isManaged = true, siblingNames = []) {
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

        // Run after — each predecessor plus its editable status conditions, shown as the maker
        // portal's coloured toggles (green=succeeded, red=failed, amber=timed out, grey=skipped).
        // Multiple predecessors are surfaced as a "join" so converging branches are visible.
        if (step.runAfter && Object.keys(step.runAfter).length > 0) {
            node.appendChild(this._renderRunAfter(step, name, siblingNames));
        }

        return node;
    }

    /**
     * Renders a node's editable `runAfter` block: every predecessor with a toggle per status
     * (Succeeded/Failed/TimedOut/Skipped). Toggles are staged in the DOM and applied to the parsed
     * definition on Save (revertible via Undo). When a step runs after more than one predecessor it
     * is flagged as a "join" so the convergence is visible.
     * @param {object} step - The step configuration (mutated on save via the checkbox refs).
     * @returns {HTMLElement}
     * @private
     */
    _renderRunAfter(step, selfName, siblingNames = []) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;

        const el = document.createElement('div');
        el.className = 'pdt-flow-node-runafter';
        // Context kept on the element so Undo can re-render it and Add can list the other steps.
        el._stepRef = step;
        el._selfName = selfName;
        el._siblingNames = siblingNames;

        const head = document.createElement('div');
        head.className = 'pdt-flow-runafter-head';
        const label = document.createElement('span');
        label.className = 'pdt-flow-runafter-label';
        label.textContent = M.runAfterLabel;
        const join = document.createElement('span');
        join.className = 'pdt-flow-runafter-join';
        head.append(label, join);
        el.appendChild(head);

        const depsEl = document.createElement('div');
        depsEl.className = 'pdt-flow-runafter-deps';
        Object.entries(step.runAfter || {}).forEach(([dep, statuses]) => depsEl.appendChild(this._renderRunAfterDep(step, dep, statuses)));
        el.appendChild(depsEl);

        // "Add predecessor" dropdown — its options are this step's other siblings.
        const add = document.createElement('select');
        add.className = 'pdt-input pdt-runafter-add';
        add.setAttribute('aria-label', M.runAfterAddPlaceholder);
        el.appendChild(add);

        this._refreshRunAfterSection(el);
        return el;
    }

    /**
     * Refreshes a runAfter section's chrome after its predecessors change: the join badge/accent and
     * the add-dropdown's options (siblings excluding the step itself and its current predecessors).
     * @param {HTMLElement} el - The `.pdt-flow-node-runafter` section.
     * @private
     */
    _refreshRunAfterSection(el) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        const currentDeps = [...el.querySelectorAll('.pdt-flow-runafter-dep')].map(r => r.dataset.dep);

        const join = el.querySelector('.pdt-flow-runafter-join');
        const isJoin = currentDeps.length > 1;
        el.classList.toggle('pdt-flow-node-runafter--join', isJoin);
        join.textContent = isJoin ? M.runAfterJoin(currentDeps.length) : '';
        join.style.display = isJoin ? '' : 'none';

        const select = el.querySelector('.pdt-runafter-add');
        const available = (el._siblingNames || []).filter(n => n !== el._selfName && !currentDeps.includes(n));
        select.textContent = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = M.runAfterAddPlaceholder;
        select.appendChild(placeholder);
        available.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        });
        select.disabled = available.length === 0;
        select.value = '';
    }

    /**
     * Renders one predecessor row: its name, a remove (×) button, and a toggle per status.
     * @param {object} step - The owning step (stored on each toggle for save).
     * @param {string} dep - The predecessor action name.
     * @param {string[]} statuses - The currently configured statuses for this predecessor.
     * @returns {HTMLElement}
     * @private
     */
    _renderRunAfterDep(step, dep, statuses) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        const active = new Set(Array.isArray(statuses) ? statuses : []);

        const depEl = document.createElement('div');
        depEl.className = 'pdt-flow-runafter-dep';
        depEl.dataset.dep = dep;

        const nameEl = document.createElement('span');
        nameEl.className = 'pdt-flow-runafter-name';
        nameEl.textContent = dep;

        const statusesEl = document.createElement('span');
        statusesEl.className = 'pdt-flow-runafter-statuses';
        // The four standard statuses, plus any non-standard one already present (never silently drop it).
        [...new Set([...RUN_AFTER_STATUS_ORDER, ...active])].forEach(status => {
            const meta = RUN_AFTER_STATUS_META[status];
            const statusLabel = meta ? M[meta.msg] : status;

            const chip = document.createElement('label');
            chip.className = 'pdt-runafter-chip';
            chip.title = statusLabel;

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'pdt-runafter-toggle';
            cb.checked = active.has(status);
            cb._stepRef = step;
            cb.dataset.dep = dep;
            cb.dataset.status = status;
            cb.setAttribute('aria-label', `${dep} — ${statusLabel}`);

            const dot = document.createElement('span');
            dot.className = `pdt-runafter-dot pdt-runafter-dot--${meta ? meta.cls : 'unknown'}`;
            dot.setAttribute('aria-hidden', 'true');

            chip.append(cb, dot);
            statusesEl.appendChild(chip);
        });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'pdt-runafter-remove';
        remove.textContent = '×';
        remove.title = M.runAfterRemove(dep);
        remove.setAttribute('aria-label', M.runAfterRemove(dep));

        depEl.append(nameEl, statusesEl, remove);
        return depEl;
    }

    /**
     * Applies staged runAfter edits to the parsed definition. Each section rebuilds *its* step's
     * runAfter entirely from its current predecessor rows — so added rows appear, removed rows
     * disappear, and a predecessor whose statuses are all unchecked is dropped.
     * @param {HTMLElement} visualPanel - The visual editor panel.
     * @private
     */
    _applyRunAfterEdits(visualPanel) {
        visualPanel.querySelectorAll('.pdt-flow-node-runafter').forEach(section => {
            const step = section._stepRef;
            if (!step) {
                return;
            }
            const runAfter = {};
            section.querySelectorAll('.pdt-flow-runafter-dep').forEach(depRow => {
                const statuses = [...depRow.querySelectorAll('.pdt-runafter-toggle')]
                    .filter(cb => cb.checked)
                    .map(cb => cb.dataset.status);
                if (statuses.length) {
                    runAfter[depRow.dataset.dep] = statuses;
                }
            });
            step.runAfter = runAfter;
        });
    }

    /**
     * Removes a predecessor row, then refreshes the section chrome and redraws the join arrows.
     * @param {HTMLElement} removeBtn - The clicked remove button.
     * @private
     */
    _handleRunAfterRemove(removeBtn) {
        const section = removeBtn.closest('.pdt-flow-node-runafter');
        const depRow = removeBtn.closest('.pdt-flow-runafter-dep');
        if (!section || !depRow) {
            return;
        }
        depRow.remove();
        this._refreshRunAfterSection(section);
        this._redrawEdgesFor(section);
    }

    /**
     * Adds the selected sibling as a new predecessor (defaulting to "Succeeded"), then refreshes the
     * section chrome and redraws the join arrows.
     * @param {HTMLSelectElement} select - The add-predecessor dropdown.
     * @private
     */
    _handleRunAfterAdd(select) {
        const section = select.closest('.pdt-flow-node-runafter');
        const name = select.value;
        if (!section || !name) {
            return;
        }
        section.querySelector('.pdt-flow-runafter-deps')
            .appendChild(this._renderRunAfterDep(section._stepRef, name, ['Succeeded']));
        this._refreshRunAfterSection(section);
        this._redrawEdgesFor(section);
    }

    /**
     * Redraws the join arrows for the visual that owns a runAfter section (so add/remove is live).
     * @param {HTMLElement} section - A `.pdt-flow-node-runafter` element.
     * @private
     */
    _redrawEdgesFor(section) {
        const wrapper = section.closest('.pdt-flow-visual');
        if (wrapper) {
            this._drawJoinArrows(wrapper);
        }
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
                        branchEl.appendChild(this._createFlowNode(item.name, item.action, 'action', isManaged, this._validPredecessorNames(subActions.map(a => ({ name: a.name, step: a.action })), item.name)));
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
                        branchEl.appendChild(this._createFlowNode(item.name, item.action, 'action', isManaged, this._validPredecessorNames(subActions.map(a => ({ name: a.name, step: a.action })), item.name)));
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
                    defEl.appendChild(this._createFlowNode(item.name, item.action, 'action', isManaged, this._validPredecessorNames(subActions.map(a => ({ name: a.name, step: a.action })), item.name)));
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
                scopeContainer.appendChild(this._createFlowNode(item.name, item.action, 'action', isManaged, this._validPredecessorNames(subActions.map(a => ({ name: a.name, step: a.action })), item.name)));
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
     * Flattens a nested inputs object into dot-keyed value pairs for display. Recurses into nested
     * objects and into arrays *of objects* (e.g. an InitializeVariable's `variables`), so each
     * property — like a variable's `value` — is its own editable field instead of one escaped JSON
     * blob. Primitive arrays (e.g. `tags: ['a','b']`) stay a single field.
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
            if (this._isDrillableInput(value)) {
                rows.push(...this._flattenInputs(value, fullKey));
            } else {
                rows.push({ key: fullKey, value });
            }
        }
        return rows;
    }

    /**
     * Whether an inputs value should be expanded into individual editable rows: plain objects, and
     * arrays that contain objects (so their nested properties are reachable). Primitive arrays are
     * left intact so simple lists remain one field.
     * @param {*} value
     * @returns {boolean}
     * @private
     */
    _isDrillableInput(value) {
        if (!value || typeof value !== 'object') {
            return false;
        }
        if (Array.isArray(value)) {
            return value.some(item => item && typeof item === 'object');
        }
        return true;
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
     * Opens the flow in its native designer. Copilot Studio agent flows (modernflowtype=1) open in
     * Copilot Studio (/agent-flows/{id}); classic cloud flows open in the Power Automate maker portal.
     * @param {string} flowId - The flow GUID.
     * @private
     */
    async _handleOpenInPortal(flowId) {
        const flow = this.allFlows.find(f => f.id === flowId);
        const envId = await DataService.getEnvironmentId();

        if (flow?.isAgentFlow) {
            const url = envId
                ? `https://copilotstudio.microsoft.com/environments/${envId}/agent-flows/${flowId}`
                : 'https://copilotstudio.microsoft.com/';
            window.open(url, '_blank');
            return;
        }

        const url = envId
            ? `https://make.powerautomate.com/environments/${envId}/flows/${flowId}/details`
            : `https://make.powerautomate.com/flows/${flowId}/details`;
        window.open(url, '_blank');
    }

    /**
     * Opens the flow-definition dialog (the JSON + visual editor with Save/Undo) for any flow,
     * without needing a rendered Power Automate tab. Lets other tabs — e.g. AI Workbench → Workflows —
     * reuse the exact same viewer/editor instead of duplicating it.
     * @param {string} flowId - The flow GUID.
     * @param {string} flowName - The flow display name.
     * @param {boolean} isManaged - Whether the flow is managed (read-only with a warning).
     * @returns {Promise<void>}
     * @static
     */
    static openDefinitionDialog(flowId, flowName, isManaged) {
        return new PowerAutomateFlowsTab()._handleViewDefinition(flowId, flowName, isManaged);
    }

    // ═══════════════════════════════════════════════════════════
    // RUN HISTORY SUB-VIEW
    // ═══════════════════════════════════════════════════════════

    /**
     * Switches between the Flows and Run History sub-views.
     * @param {'flows'|'runs'} view
     * @private
     */
    _switchSubView(view) {
        if (view === this.activeSubView) {
            if (view === 'runs') {
                this._ensureRunsLoaded();
            }
            return;
        }
        this.activeSubView = view;
        this.ui.subTabs.querySelectorAll('.pdt-sub-tab').forEach(t => {
            const isActive = t.dataset.subview === view;
            t.classList.toggle('active', isActive);
            t.setAttribute('aria-selected', String(isActive));
        });
        this.ui.flowsPanel.classList.toggle('pdt-hidden', view !== 'flows');
        this.ui.runsPanel.classList.toggle('pdt-hidden', view !== 'runs');

        if (view === 'runs') {
            this._ensureRunsLoaded();
        } else {
            // Pause live polling while the runs view is not visible.
            this._stopRunLive();
            this._resetRunLiveToggle();
        }
    }

    /**
     * Populates the Run History flow dropdown from the flows already loaded for the current
     * solution — so the user never has to re-pick the solution. Auto-selects the only flow, or
     * restores the last-used flow when it belongs to this solution.
     * @private
     */
    _populateRunFlowSelect() {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        const select = this.ui.runFlowSelect;
        select.innerHTML = `<option value="">${M.selectFlowPlaceholder}</option>` + this.allFlows.map(f =>
            `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`
        ).join('');

        const savedFlow = PreferencesHelper.load(Config.STORAGE_KEYS.flowRunsFlow, '');
        let target = '';
        if (savedFlow && this.allFlows.some(f => f.id === savedFlow)) {
            target = savedFlow;
        } else if (this.allFlows.length === 1) {
            target = this.allFlows[0].id;
        }

        select.value = target;
        select.disabled = this.allFlows.length === 0;
        this.selectedRunFlowId = target || null;
        this._runsLoadedFlowId = null;
        this._setRunControlsEnabled(!!target);

        if (!target) {
            this.ui.runSummary.classList.add('pdt-hidden');
            this.ui.runList.innerHTML = `<p class="pdt-note">${M.selectFlowForRuns}</p>`;
        }
    }

    /**
     * Loads runs for the selected flow if they haven't been loaded yet (lazy on first view entry).
     * @private
     */
    _ensureRunsLoaded() {
        if (this.selectedRunFlowId && this._runsLoadedFlowId !== this.selectedRunFlowId) {
            this._loadRuns();
        }
    }

    /**
     * Resets the Run History panel back to its empty state (used when the solution changes).
     * @private
     */
    _resetRunHistory() {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        this.selectedRunFlowId = null;
        this.allRuns = [];
        this._runsLoadedFlowId = null;
        this.runStatusFilter = '';
        if (this.ui.runStatusFilter) {
            this.ui.runStatusFilter.value = '';
        }
        this._setRunControlsEnabled(false);
        if (this.ui.runFlowSelect) {
            this.ui.runFlowSelect.innerHTML = `<option value="">${M.selectFlowPlaceholder}</option>`;
            this.ui.runFlowSelect.disabled = true;
        }
        this.ui.runSummary?.classList.add('pdt-hidden');
        if (this.ui.runList) {
            this.ui.runList.innerHTML = `<p class="pdt-note">${M.selectFlowForRuns}</p>`;
        }
    }

    /**
     * Turns off the Live toggle and its indicator (without affecting the polling timer).
     * @private
     */
    _resetRunLiveToggle() {
        if (this.ui.runLiveToggle?.checked) {
            this.ui.runLiveToggle.checked = false;
        }
        this.ui.runLiveIndicator?.classList.remove('is-live');
    }

    /**
     * Handles run-history flow change: enables controls and loads the run list.
     * @private
     */
    async _onRunFlowSelected() {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        this.selectedRunFlowId = this.ui.runFlowSelect.value || null;
        PreferencesHelper.save(Config.STORAGE_KEYS.flowRunsFlow, this.selectedRunFlowId || '');
        this._stopRunLive();
        this._resetRunLiveToggle();

        if (!this.selectedRunFlowId) {
            this._setRunControlsEnabled(false);
            this.allRuns = [];
            this._runsLoadedFlowId = null;
            this.ui.runSummary.classList.add('pdt-hidden');
            this.ui.runList.innerHTML = `<p class="pdt-note">${M.selectFlowForRuns}</p>`;
            return;
        }

        this._setRunControlsEnabled(true);
        await this._loadRuns();
    }

    /**
     * Enables/disables the run-history controls that require a selected flow.
     * @param {boolean} enabled
     * @private
     */
    _setRunControlsEnabled(enabled) {
        [
            this.ui.runRefreshBtn, this.ui.runSearchInput, this.ui.runStatusFilter,
            this.ui.runLiveToggle, this.ui.runLiveInterval
        ].forEach(el => {
            if (el) {
                el.disabled = !enabled;
            }
        });
    }

    /**
     * Loads the run history for the selected flow and renders it.
     * @param {boolean} [isLiveRefresh=false] - When true, suppresses the loading placeholder.
     * @private
     */
    async _loadRuns(isLiveRefresh = false) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        if (!this.selectedRunFlowId) {
            return;
        }

        if (!isLiveRefresh) {
            this.ui.runList.innerHTML = `<p class="pdt-note">${M.loadingRuns}</p>`;
        }

        try {
            if (!isLiveRefresh) {
                BusyIndicator.set();
            }
            this.allRuns = await DataService.getFlowRuns(this.selectedRunFlowId, {
                top: 50,
                status: this.runStatusFilter || undefined
            });
            this._runsLoadedFlowId = this.selectedRunFlowId;
            this._renderRuns();
            this._renderRunSummary();
        } catch (error) {
            this.ui.runSummary.classList.add('pdt-hidden');
            this.ui.runList.innerHTML = `<div class="pdt-error">${M.loadRunsFailed(escapeHtml(error.message))}</div>`;
        } finally {
            if (!isLiveRefresh) {
                BusyIndicator.clear();
            }
        }
    }

    /**
     * Renders the run list (or an empty / disabled-state note).
     * @private
     */
    _renderRuns() {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        this.ui.runList.textContent = '';
        if (!this.allRuns.length) {
            // A status filter that yields nothing is a normal empty result; an unfiltered empty
            // result more likely means run history is disabled / out of retention.
            this.ui.runList.innerHTML = `<p class="pdt-note">${this.runStatusFilter ? M.noRuns : M.runHistoryDisabledNote}</p>`;
            if (!this.runStatusFilter) {
                this._augmentRunsDisabledNote();
            }
            return;
        }
        const frag = document.createDocumentFragment();
        this.allRuns.forEach(run => frag.appendChild(this._createRunRow(run)));
        this.ui.runList.appendChild(frag);
        this._filterRuns();
    }

    /**
     * Upgrades the generic empty-run note to a definitive "run history is disabled" message when the
     * org run-retention is 0 seconds. Best-effort: on any failure, or if runs have since loaded, the
     * generic note is left untouched.
     * @private
     */
    async _augmentRunsDisabledNote() {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        let retention = null;
        try {
            // Cached at the DataService layer, so an empty flow with Live on won't re-read per poll.
            ({ flowRunRetentionSeconds: retention } = await DataService.getOrganizationDiagnostics());
        } catch {
            return; // Organization settings unavailable; keep the generic note.
        }
        // Only replace if the list is still showing the empty note (no runs loaded in the meantime).
        if (retention === 0 && this.ui.runList && !this.allRuns.length) {
            this.ui.runList.innerHTML = `<p class="pdt-note">${M.runHistoryDisabledConfirmed}</p>`;
        }
    }

    /**
     * Builds the run summary bar (counts, success rate, average duration, last run).
     * @private
     */
    _renderRunSummary() {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        if (!this.allRuns.length) {
            this.ui.runSummary.classList.add('pdt-hidden');
            return;
        }

        const counts = { succeeded: 0, failed: 0, cancelled: 0, running: 0, other: 0 };
        let durationSum = 0;
        let durationCount = 0;
        this.allRuns.forEach(r => {
            counts[r.statusKey] = (counts[r.statusKey] || 0) + 1;
            if (r.durationMs !== null && r.durationMs !== undefined) {
                durationSum += r.durationMs;
                durationCount++;
            }
        });

        const completed = counts.succeeded + counts.failed + counts.cancelled;
        const successRate = completed > 0 ? Math.round((counts.succeeded / completed) * 100) : 0;
        const avgText = durationCount > 0 ? this._formatMs(Math.round(durationSum / durationCount)) : '—';
        const lastRun = this.allRuns[0]?.startTimeLabel || '';

        this.ui.runSummary.innerHTML = `
            <span class="pdt-flow-run-summary-metric">${M.summaryTotal(this.allRuns.length)}</span>
            <span class="pdt-flow-run-summary-metric pdt-flow-run-summary-rate">${M.summarySuccessRate(successRate)}</span>
            <span class="pdt-flow-run-summary-metric">${M.summaryAvgDuration(avgText)}</span>
            ${lastRun ? `<span class="pdt-flow-run-summary-metric">${M.summaryLastRun(escapeHtml(lastRun))}</span>` : ''}
            <span class="pdt-flow-run-summary-chips">
                <span class="pdt-flow-run-pill pdt-flow-run-status--succeeded">${counts.succeeded} ${M.summarySucceeded}</span>
                <span class="pdt-flow-run-pill pdt-flow-run-status--failed">${counts.failed} ${M.summaryFailed}</span>
                <span class="pdt-flow-run-pill pdt-flow-run-status--cancelled">${counts.cancelled} ${M.summaryCancelled}</span>
                ${counts.running ? `<span class="pdt-flow-run-pill pdt-flow-run-status--running">${counts.running} ${M.summaryRunning}</span>` : ''}
            </span>
        `;
        this.ui.runSummary.classList.remove('pdt-hidden');
    }

    /**
     * Creates a collapsible row element for a single run.
     * @param {FlowRun} run
     * @returns {HTMLElement}
     * @private
     */
    _createRunRow(run) {
        const row = document.createElement('div');
        row.className = 'pdt-flow-run-row';
        row.dataset.runId = run.id;
        row.dataset.runName = run.runId;

        const searchText = [run.status, run.triggerType, run.runId, run.errorMessage, run.errorCode, run.startTimeLabel]
            .join(' ').toLowerCase();
        row.dataset.searchTerm = searchText;

        const durationText = run.durationText || '—';
        const errorSummary = run.statusKey === 'failed' && run.errorMessage
            ? `<div class="pdt-flow-run-row-error">${escapeHtml(run.errorMessage)}</div>` : '';

        row.innerHTML = `
            <div class="pdt-flow-run-row-header" role="button" tabindex="0" aria-expanded="false">
                <span class="pdt-flow-run-status-badge pdt-flow-run-status--${run.statusKey}">${escapeHtml(this._getRunStatusLabel(run))}</span>
                <span class="pdt-flow-run-trigger">${escapeHtml(run.triggerType || '')}</span>
                <span class="pdt-flow-run-start">${escapeHtml(run.startTimeLabel || '')}</span>
                <span class="pdt-flow-run-duration">${escapeHtml(durationText)}</span>
                <span class="pdt-flow-run-expand-icon" aria-hidden="true">▸</span>
            </div>
            ${errorSummary}
            <div class="pdt-flow-run-details pdt-hidden"></div>
        `;
        return row;
    }

    /**
     * Handles clicks within the run list: expand/collapse and open-run deep links.
     * @param {MouseEvent} e
     * @private
     */
    _onRunListClick(e) {
        const openBtn = /** @type {HTMLElement} */ (e.target).closest('.pdt-flow-run-open-btn');
        if (openBtn) {
            const row = openBtn.closest('.pdt-flow-run-row');
            this._handleOpenRun(row?.dataset.runName);
            return;
        }
        const header = /** @type {HTMLElement} */ (e.target).closest('.pdt-flow-run-row-header');
        if (header) {
            this._handleRunExpand(header.closest('.pdt-flow-run-row'));
        }
    }

    /**
     * Expands or collapses a run row, lazily loading its action logs on first expand.
     * @param {HTMLElement} row
     * @private
     */
    async _handleRunExpand(row) {
        if (!row) {
            return;
        }
        const details = row.querySelector('.pdt-flow-run-details');
        const header = row.querySelector('.pdt-flow-run-row-header');
        const icon = row.querySelector('.pdt-flow-run-expand-icon');
        const isOpen = !details.classList.contains('pdt-hidden');

        if (isOpen) {
            details.classList.add('pdt-hidden');
            header.setAttribute('aria-expanded', 'false');
            if (icon) {
                icon.textContent = '▸';
            }
            return;
        }

        details.classList.remove('pdt-hidden');
        header.setAttribute('aria-expanded', 'true');
        if (icon) {
            icon.textContent = '▾';
        }

        if (row.dataset.loaded === 'true') {
            return;
        }
        row.dataset.loaded = 'true';

        const run = this.allRuns.find(r => r.id === row.dataset.runId);
        if (!run) {
            return;
        }

        details.innerHTML = this._buildRunDetailsHtml(run);

        // Per-action logs are best-effort: `flowlog` is an elastic unowned child the same-origin Web
        // API can't read for cloud flows, so this is typically empty. Only append the section when
        // rows actually come back — otherwise the failed-run note already points to the portal, and a
        // second "no logs" note would just be redundant.
        const logs = await DataService.getFlowRunLogs(run.id, { top: 200 });
        if (logs.length) {
            const logsHost = document.createElement('div');
            logsHost.className = 'pdt-flow-run-logs';
            logsHost.innerHTML = this._buildRunLogsHtml(logs);
            details.appendChild(logsHost);
        }
    }

    /**
     * Builds the run details panel HTML (metadata + error + open-run link).
     * @param {FlowRun} run
     * @returns {string}
     * @private
     */
    _buildRunDetailsHtml(run) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        const rows = [
            [M.runIdLabel, `<code class="copyable code-like" title="Click to copy" tabindex="0">${escapeHtml(run.runId)}</code>`],
            [M.runStartLabel, escapeHtml(run.startTimeLabel || '—')],
            [M.runEndLabel, escapeHtml(run.endTimeLabel || '—')],
            [M.runDurationLabel, escapeHtml(run.durationText || '—')],
            [M.runTriggerLabel, escapeHtml(run.triggerType || '—')]
        ];
        if (run.errorCode) {
            rows.push([M.runErrorCodeLabel, escapeHtml(run.errorCode)]);
        }
        if (run.errorMessage) {
            rows.push([M.runErrorMessageLabel, `<span class="pdt-text-error">${escapeHtml(run.errorMessage)}</span>`]);
        }
        if (run.parentRunId) {
            rows.push([M.runParentLabel, escapeHtml(run.parentRunId)]);
        }

        // The flowrun record only carries the generic rollup error; the real failing action lives in
        // the portal (flowlog is an elastic unowned child the same-origin Web API can't read). For a
        // failed run, explain that and make the portal deep link the primary action.
        const isFailed = run.statusKey === 'failed';
        const failedNote = isFailed
            ? `<p class="pdt-note pdt-flow-run-portal-note">${M.runFailedDetailNote}</p>`
            : '';
        const openBtnClass = isFailed ? 'modern-button' : 'modern-button secondary';

        const grid = rows.map(([k, v]) => `<strong>${k}:</strong><span>${v}</span>`).join('');
        return `
            <div class="info-grid pdt-flow-run-detail-grid">${grid}</div>
            ${failedNote}
            <div class="pdt-flow-run-detail-actions">
                <button class="${openBtnClass} pdt-flow-run-open-btn">${M.openRun}</button>
            </div>
        `;
    }

    /**
     * Builds the action-logs HTML for a run, or an empty-state note.
     * @param {FlowRunLog[]} logs
     * @returns {string}
     * @private
     */
    _buildRunLogsHtml(logs) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        if (!logs.length) {
            return '';
        }
        const items = logs.map(log => {
            const dataBlock = log.data
                ? `<pre class="pdt-flow-run-log-data code-like">${escapeHtml(log.data)}</pre>` : '';
            return `
                <li class="pdt-flow-run-log">
                    <div class="pdt-flow-run-log-head">
                        ${log.levelLabel ? `<span class="pdt-flow-run-log-level">${escapeHtml(log.levelLabel)}</span>` : ''}
                        <span class="pdt-flow-run-log-name">${escapeHtml(log.name || log.typeLabel || '')}</span>
                        ${log.durationText ? `<span class="pdt-flow-run-log-duration">${escapeHtml(log.durationText)}</span>` : ''}
                    </div>
                    ${dataBlock}
                </li>
            `;
        }).join('');
        return `<div class="pdt-flow-run-logs-title">${M.runLogsTitle}</div><ul class="pdt-flow-run-log-list">${items}</ul>`;
    }

    /**
     * Handles the status-filter change: re-queries the server with the chosen status.
     * @private
     */
    async _handleRunStatusFilter() {
        this.runStatusFilter = this.ui.runStatusFilter.value || '';
        await this._loadRuns();
    }

    /**
     * Filters visible run rows by the search box (client-side).
     * @private
     */
    _filterRuns() {
        const term = this.ui.runSearchInput?.value?.toLowerCase().trim() || '';
        this.ui.runList?.querySelectorAll('.pdt-flow-run-row').forEach(row => {
            const text = row.dataset.searchTerm || '';
            row.style.display = text.includes(term) ? '' : 'none';
        });
    }

    /**
     * Starts/stops live polling of the run list.
     * @param {boolean} isEnabled
     * @private
     */
    _handleRunPolling(isEnabled) {
        this._stopRunLive();
        this.ui.runLiveIndicator.classList.toggle('is-live', !!isEnabled);
        if (isEnabled) {
            this._startRunLive();
        }
    }

    /**
     * Starts the live-polling timer at the chosen interval and refreshes immediately.
     * @private
     */
    _startRunLive() {
        const interval = parseInt(this.ui.runLiveInterval.value, 10) || 10000;
        this.runPollingTimer = setInterval(() => this._loadRuns(true), interval);
        this._loadRuns(true);
    }

    /**
     * Stops the live-polling timer.
     * @private
     */
    _stopRunLive() {
        if (this.runPollingTimer) {
            clearInterval(this.runPollingTimer);
            this.runPollingTimer = null;
        }
    }

    /**
     * Switches to the Run History sub-view for a specific flow (card "Runs" shortcut). The flows are
     * already loaded for the current solution, so this just points the run picker at the flow.
     * @param {string} flowId
     * @private
     */
    async _handleViewRunsForFlow(flowId) {
        if (this.allFlows.some(f => f.id === flowId)) {
            this.ui.runFlowSelect.value = flowId;
            await this._onRunFlowSelected();
        }
        this._switchSubView('runs');
    }

    /**
     * Opens a specific run's detail page in the maker portal (or Copilot Studio for agent flows).
     * @param {string} runName - The run id (flowrun.name).
     * @private
     */
    async _handleOpenRun(runName) {
        if (!runName || !this.selectedRunFlowId) {
            return;
        }
        const flow = this.allFlows.find(f => f.id === this.selectedRunFlowId);
        const envId = await DataService.getEnvironmentId();

        if (flow?.isAgentFlow) {
            // Agent-flow per-run deep links aren't documented; fall back to the agent-flow page.
            const url = envId
                ? `https://copilotstudio.microsoft.com/environments/${envId}/agent-flows/${this.selectedRunFlowId}`
                : 'https://copilotstudio.microsoft.com/';
            window.open(url, '_blank');
            return;
        }

        const url = envId
            ? `https://make.powerautomate.com/environments/${envId}/flows/${this.selectedRunFlowId}/runs/${runName}`
            : `https://make.powerautomate.com/flows/${this.selectedRunFlowId}/runs/${runName}`;
        window.open(url, '_blank');
    }

    /**
     * Returns the display label for a run's status.
     * @param {FlowRun} run
     * @returns {string}
     * @private
     */
    _getRunStatusLabel(run) {
        const M = Config.MESSAGES.POWER_AUTOMATE_FLOWS;
        switch (run.statusKey) {
            case 'succeeded': return M.runStatusSucceeded;
            case 'failed': return M.runStatusFailed;
            case 'cancelled': return M.runStatusCancelled;
            case 'running': return M.runStatusRunning;
            default: return run.status || '';
        }
    }

    /**
     * Formats a millisecond duration for the summary bar's average.
     * @param {number} ms
     * @returns {string}
     * @private
     */
    _formatMs(ms) {
        if (ms === null || ms === undefined) {
            return '—';
        }
        if (ms < 1000) {
            return `${ms} ms`;
        }
        const s = ms / 1000;
        if (s < 60) {
            return `${s.toFixed(1)}s`;
        }
        const m = Math.floor(s / 60);
        const rs = Math.round(s % 60);
        return `${m}m ${rs}s`;
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
        this._stopRunLive();

        // [element, event, handler] tuples — removed in one pass to keep cleanup flat and additive.
        const bindings = [
            [this.ui.solutionSelect, 'change', this._solutionSelectHandler],
            [this.ui.refreshBtn, 'click', this._refreshBtnHandler],
            [this.ui.searchInput, 'input', this._searchInputHandler],
            [this.ui.listContainer, 'click', this._listClickHandler],
            [this.ui.subTabs, 'click', this._subTabsHandler],
            [this.ui.runFlowSelect, 'change', this._runFlowSelectHandler],
            [this.ui.runRefreshBtn, 'click', this._runRefreshHandler],
            [this.ui.runSearchInput, 'input', this._runSearchHandler],
            [this.ui.runStatusFilter, 'change', this._runStatusFilterHandler],
            [this.ui.runLiveToggle, 'change', this._runLiveToggleHandler],
            [this.ui.runList, 'click', this._runListClickHandler]
        ];
        bindings.forEach(([el, event, handler]) => {
            if (el && handler) {
                el.removeEventListener(event, handler);
            }
        });

        this.filterCards?.cancel?.();
        this.filterRuns?.cancel?.();
    }
}
