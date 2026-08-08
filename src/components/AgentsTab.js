/**
 * @file AI Workbench viewer and management component.
 * @module components/AgentsTab
 * @description A single workbench tab for the AI artifacts that Copilot Studio and AI Builder store in Dataverse.
 * Its sub-views:
 *  - **Agents**: lists Copilot Studio agents (the `bot` table) with search/refresh. Each agent can
 *    be inspected (raw instructions, topics, knowledge, tools, configuration JSON, and its
 *    conversation **Transcripts** — `conversationtranscript`, read-only, for debugging what the
 *    agent actually did), opened in Copilot Studio, activated/deactivated, or deleted (unmanaged only).
 *  - **Workflows**: the Copilot Studio workflows (`modernflowtype=1`) in the environment.
 *  - **Prompts & Models**: lists AI Builder models and prompts (`msdyn_aimodel`).
 *
 * All data is read through the toolkit's existing session-based Web API — no external endpoints,
 * tokens, or manifest changes are required.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { Config } from '../constants/index.js';
import { AGENT_TEMPLATES, AGENT_TEMPLATE_CATEGORIES, AGENT_TEMPLATE_SUBCATEGORIES, extractTemplateTokens, applyTemplateTokens, templateApplies, templateContent, templateUse } from '../constants/agentTemplates.js';
import { GENERATOR_BLOCKS, composeInstructions, reviewInstructions, countReviewRules, REVIEW_SAMPLE } from '../constants/generatorBlocks.js';
import { normalizeAgentKind, appliesToKind } from '../constants/agentKinds.js';
import { DataService } from '../services/DataService.js';
import { NotificationService } from '../services/NotificationService.js';
import { DialogService } from '../services/DialogService.js';
import { isInstructionsComponent, extractAgentInstructions, agentInstructionsEditable, applyAgentInstructions, extractAgentModel, getComponentKind, getComponentDescription, extractConnectedAgentSchema, extractConnectedAgentName, extractPromptText, applyPromptText, extractPromptMetadata, applyPromptSettings, summarizeDataBinding, parseModelPerformance, isPromptTemplate, AI_CONFIG_TYPE_TRAINING, AI_CONFIG_TYPE_RUN, AI_CONFIG_STATUS_TRAINING, AI_CONFIG_STATUS_PUBLISHED, AI_CONFIG_STATE_DONE, parseEvaluationSet, parseEvaluationCase, parseTranscriptConversation, parseTranscriptSession, countUnpublishedComponents, summarizeAgentComposition } from '../services/AgentService.js';
import { PowerAutomateFlowsTab } from './PowerAutomateFlowsTab.js';
import { UIFactory } from '../ui/UIFactory.js';
import { BusyIndicator } from '../utils/ui/BusyIndicator.js';
import { debounce, escapeHtml, showConfirmDialog, downloadJson, downloadText, copyToClipboard, readBase64File } from '../helpers/index.js';

/** @typedef {import('../services/AgentService.js').Agent} Agent */
/** @typedef {import('../services/AgentService.js').AgentComponent} AgentComponent */
/** @typedef {import('../services/AgentService.js').AiModel} AiModel */
/** @typedef {import('../services/AgentService.js').TranscriptSummary} TranscriptSummary */

/**
 * Performance metric names that measure model quality (0–100% where higher is better), so they are
 * coloured by band. Baselines, Cohen's κ and counts are shown plain — colouring them by the same
 * scale would mislead.
 * @type {Set<string>}
 */
const PERF_QUALITY_METRICS = new Set(['accuracy', 'weightedF1', 'macroF1', 'f1Score', 'precision', 'recall']);

/**
 * @private Largest file AI Builder accepts for a prompt's image/document input.
 *
 * Documented as 25 MB across all files on a prompt; checked per file here, which is the same limit
 * for the single-file inputs the test panel supports and fails fast rather than after the upload.
 * @type {number}
 */
const MAX_PROMPT_TEST_FILE_BYTES = 25 * 1024 * 1024;

/**
 * A component for inspecting and managing Copilot Studio agents, transcripts, and AI Builder models.
 * Follows the PowerAutomateFlowsTab card pattern with a sub-view switcher.
 * @extends {BaseComponent}
 */
export class AgentsTab extends BaseComponent {
    /**
     * Initializes the AgentsTab component.
     */
    constructor() {
        // The id stays 'agents': tab order/visibility persists by id, and changing it would drop
        // every existing user's saved arrangement for this tab.
        super('agents', 'AI Workbench', ICONS.agents, false);

        /** @type {{[k:string]: HTMLElement}} */
        this.ui = {};
        /** @type {'agents'|'flows'|'prompts'|'templates'|'search'} */
        this.activeView = 'agents';

        /**
         * Bumped by destroy(). Background publish watches capture it and stop when it changes, so a
         * watch cannot outlive the tab — while Refresh (which destroys and re-renders this same
         * instance) still leaves later publishes watchable.
         * @type {number}
         */
        this._lifecycle = 0;

        /** @type {Agent[]|null} Cached agents (null until first load). */
        this.agents = null;
        /** @type {AiModel[]|null} Cached AI models (null until first load). */
        this.aiModels = null;
        /** @type {Array<{id: string, name: string, isManaged: boolean}>|null} Cached solutions for the filter. */
        this.solutions = null;
        /** @type {Object.<string, string>} Map of solution id → display name. */
        this.solutionsMap = {};
        /** @type {Array<{id: string, name: string, statecode: number, stateLabel: string, owner: string, modifiedOn: string}>|null} Cached agent flows (Copilot Studio Workflows). */
        this.agentFlows = null;

        /** @private */
        this.filterCards = debounce(() => this._filterCards(), 250);
        /** @private */
        this.searchComponents = debounce(() => this._runComponentSearch(), 400);
        /** @private */
        this.composeGeneratorDebounced = debounce(() => this._updateGeneratorOutput(), 200);
        /** @private */
        this.reviewDebounced = debounce(() => this._runInstructionReview(), 300);
        /** @private {number} Guards the review panel against an older agent load landing last. */
        this._reviewLoadToken = 0;

        this._resetWorkspace();

        // Handler references for cleanup
        /** @private {Function|null} */ this._subTabsHandler = null;
        /** @private {Function|null} */ this._hostClickHandler = null;
        /** @private {Function|null} */ this._hostInputHandler = null;
        /** @private {Function|null} */ this._hostChangeHandler = null;
        /** @private {Function|null} */ this._hostKeydownHandler = null;
    }

    // ═══════════════════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════════════════

    /**
     * Renders the component's HTML shell (title, sub-tabs, view host).
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    // eslint-disable-next-line require-await
    async render() {
        const M = Config.MESSAGES.AGENTS;
        const container = document.createElement('div');
        container.className = 'pdt-full-height-column';
        container.innerHTML = `
            <div class="section-title flex-shrink-0">${M.title}</div>
            <div class="pdt-sub-tabs pdt-agents-subtabs flex-shrink-0" role="tablist" aria-label="${M.title}">
                <button type="button" class="pdt-sub-tab active" data-view="agents" role="tab" aria-selected="true">${M.agentsView}</button>
                <button type="button" class="pdt-sub-tab" data-view="flows" role="tab" aria-selected="false">${M.flowsView}</button>
                <button type="button" class="pdt-sub-tab" data-view="prompts" role="tab" aria-selected="false">${M.promptsView}</button>
                <button type="button" class="pdt-sub-tab" data-view="templates" role="tab" aria-selected="false">${M.templatesView}</button>
                <button type="button" class="pdt-sub-tab" data-view="search" role="tab" aria-selected="false">${M.searchView}</button>
            </div>
            <div id="pdt-agents-host" class="pdt-agents-host" role="tabpanel"></div>
        `;
        return container;
    }

    /**
     * Caches UI elements, attaches delegated event listeners, and renders the default view.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        this.ui = {
            container: element,
            subTabs: element.querySelector('.pdt-agents-subtabs'),
            host: element.querySelector('#pdt-agents-host')
        };

        // Sub-tab switching
        this._subTabsHandler = (e) => {
            const btn = e.target.closest('.pdt-sub-tab');
            if (btn && btn.dataset.view) {
                this._switchView(btn.dataset.view);
            }
        };
        this.ui.subTabs.addEventListener('click', this._subTabsHandler);

        // Delegated handlers on the view host (persist across view swaps)
        this._hostClickHandler = (e) => this._onHostClick(e);
        this._hostInputHandler = (e) => {
            if (e.target.matches('.pdt-agents-search')) {
                this.filterCards();
            } else if (e.target.matches('.pdt-agent-flows-search')) {
                this._filterAgentFlows();
            } else if (e.target.matches('.pdt-templates-search')) {
                this._filterTemplates();
            } else if (e.target.matches('.pdt-agents-cross-search')) {
                this.searchComponents();
            } else if (e.target.matches('.pdt-template-customize-input')) {
                this._handleCustomizeInput(e.target);
            } else if (e.target.matches('.pdt-generator-text')) {
                this.composeGeneratorDebounced();
            } else if (e.target.matches('.pdt-review-text')) {
                this._handleReviewTextInput(e.target.value);
            }
        };
        this._hostChangeHandler = (e) => {
            if (e.target.matches('.pdt-agents-solution')) {
                this._filterCards();
            } else if (e.target.matches('.pdt-agent-flows-solution')) {
                this._filterAgentFlows();
            } else if (e.target.matches('.pdt-templates-category')) {
                this._handleTemplateCategoryChange();
            } else if (e.target.matches('.pdt-review-agent')) {
                this._handleReviewLoadAgent(e.target.value);
            } else if (e.target.matches('.pdt-templates-kind')) {
                this._handleTemplatesKindChange(e.target.value);
            } else if (e.target.matches('.pdt-generator-select, .pdt-generator-check')) {
                this._handleGeneratorFormChange(e.target);
            }
        };
        // Template cards toggle from their header (role="button"), which needs Enter/Space wired
        // up by hand — unlike a real <button>, a div gets no free keyboard activation.
        this._hostKeydownHandler = (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') {
                return;
            }
            const header = e.target.closest?.('.pdt-template-header');
            if (!header) {
                return;
            }
            e.preventDefault();
            this._handleTemplateToggle(header);
        };
        this.ui.host.addEventListener('click', this._hostClickHandler);
        this.ui.host.addEventListener('input', this._hostInputHandler);
        this.ui.host.addEventListener('change', this._hostChangeHandler);
        this.ui.host.addEventListener('keydown', this._hostKeydownHandler);

        this._switchView('agents');
    }

    /**
     * Lifecycle hook for cleaning up event listeners.
     */
    /**
     * Returns everything the user has typed or chosen to its first-open state: the Templates
     * workbench (segment, Library filters, Generator form, Review text and the shared agent type)
     * and the cross-agent search term.
     *
     * Kept apart from the data caches on purpose — this is user input, and it is reset only by an
     * explicit Refresh or close, never by moving between views.
     * @private
     */
    _resetWorkspace() {
        /** @private {string} Last cross-agent search term (preserved across view swaps). */
        this._lastSearchTerm = '';
        /**
         * @private {{mode: 'library'|'generator'|'review', category: string, subcategory: string,
         *   search: string, kind: import('../constants/agentKinds.js').AgentKind}}
         * Workbench state, shared by all three segments. `kind` is the agent experience every
         * segment respects: the Library filters by it, the Generator composes for it, and Review
         * checks against it. Loading an agent in Review sets it from that agent.
         */
        this._tplState = { mode: 'library', category: '', subcategory: '', search: '', kind: 'any' };
        /** @private {object|null} Generator selections + cached agent grounding (see _defaultGenState). */
        this._genState = null;
        /** @private {string} Last composed instruction text (for copy/download). */
        this._generatorText = '';
        /** @private {Map<string, Object.<string, string>>} Customize values per template id. */
        this._customizeValues = new Map();
        /** @private {string} Review textarea content. */
        this._reviewText = '';
        /** @private {string} The user's own text, restored when an agent selection is cleared. */
        this._pastedReviewText = '';
        /** @private {string} Agent id the review text was loaded from ('' = pasted). */
        this._reviewAgentId = '';
        /** @private {string[]} Names of the loaded agent's tools/topics/knowledge ([] = pasted). */
        this._reviewResources = [];
    }

    destroy() {
        // Stops any in-flight publish watch (see _lifecycle).
        this._lifecycle++;
        if (this.ui.subTabs && this._subTabsHandler) {
            this.ui.subTabs.removeEventListener('click', this._subTabsHandler);
        }
        if (this.ui.host) {
            this.ui.host.removeEventListener('click', this._hostClickHandler);
            this.ui.host.removeEventListener('input', this._hostInputHandler);
            this.ui.host.removeEventListener('change', this._hostChangeHandler);
            this.ui.host.removeEventListener('keydown', this._hostKeydownHandler);
        }
        if (this.filterCards?.cancel) {
            this.filterCards.cancel();
        }
        if (this.searchComponents?.cancel) {
            this.searchComponents.cancel();
        }
        if (this.composeGeneratorDebounced?.cancel) {
            this.composeGeneratorDebounced.cancel();
        }
        if (this.reviewDebounced?.cancel) {
            this.reviewDebounced.cancel();
        }
        // Drop a pending "confirm unpublish" disarm timer so it can't fire on a detached button.
        clearTimeout(this._unpublishDisarm);
        // destroy() runs only on "Refresh Tool & Clear Cache" and on close — never on a tab switch —
        // so both put the tab back to how it opens: fresh data, and none of the previous session's
        // filters, generator form, or review text left behind.
        this.agents = null;
        this.aiModels = null;
        this.agentFlows = null;
        this.solutions = null;
        this.solutionsMap = {};
        this.activeView = 'agents';
        this._resetWorkspace();
    }

    // ═══════════════════════════════════════════════════════════
    // VIEW SWITCHING
    // ═══════════════════════════════════════════════════════════

    /**
     * Switches the active sub-view and renders it.
     * @param {'agents'|'flows'|'prompts'|'templates'|'search'} view
     * @private
     */
    _switchView(view) {
        this.activeView = view;
        this.ui.subTabs.querySelectorAll('.pdt-sub-tab').forEach(t => {
            const isActive = t.dataset.view === view;
            t.classList.toggle('active', isActive);
            t.setAttribute('aria-selected', String(isActive));
        });

        switch (view) {
            case 'flows':
                this._renderFlowsView();
                break;
            case 'prompts':
                this._renderPromptsView();
                break;
            case 'templates':
                this._renderTemplatesView();
                break;
            case 'search':
                this._renderSearchView();
                break;
            default:
                this._renderAgentsView();
        }
    }

    /**
     * Central click dispatcher for the view host (event delegation).
     * @param {MouseEvent} e
     * @private
     */
    _onHostClick(e) {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) {
            return;
        }
        const card = actionEl.closest('[data-agent-id], [data-model-id], [data-flow-id]');
        const d = card?.dataset || {};
        const handlers = {
            'refresh-agents': () => {
                this.agents = null; this._loadAgents();
            },
            'refresh-prompts': () => {
                this.aiModels = null; this._loadAiModels();
            },
            'refresh-flows': () => {
                this.agentFlows = null; this._loadAgentFlows();
            },
            'flow-open': () => this._openAgentFlow(d.flowId),
            'flow-toggle': () => this._handleToggleAgentFlow(card),
            'flow-delete': () => this._handleDeleteAgentFlow(card),
            'flow-view-def': () => PowerAutomateFlowsTab.openDefinitionDialog(d.flowId, d.flowName, d.flowManaged === 'true'),
            'view-def': () => this._handleViewDefinition(d.agentId, d.agentName),
            'export-agent': () => this._handleExportAgent(d.agentId),
            'open-studio': () => this._openInCopilotStudio(d.agentId),
            toggle: () => this._handleToggleAgent(card),
            delete: () => this._handleDeleteAgent(card),
            'view-model': () => this._handleViewModel(d.modelId),
            'delete-model': () => this._handleDeleteModel(card),
            'open-aibuilder': () => this._openInAiBuilder(d.modelId),
            // Templates workbench. NOTE: template cards use data-template-id, which the shared
            // `card` lookup above does NOT match — these handlers resolve their own card.
            'tpl-mode': () => this._handleTemplatesMode(actionEl.dataset.mode),
            'tpl-subcat': () => this._handleSubcatChip(actionEl),
            'tpl-toggle': () => this._handleTemplateToggle(actionEl),
            'gen-copy': () => this._handleGeneratorCopy(),
            'gen-download': () => this._handleGeneratorDownload(),
            'gen-reset': () => this._handleGeneratorReset(),
            'review-open-agent': () => this._handleReviewOpenAgent(),
            'review-example': () => this._handleReviewExample()
        };
        handlers[actionEl.dataset.action]?.();
    }

    // ═══════════════════════════════════════════════════════════
    // AGENTS VIEW
    // ═══════════════════════════════════════════════════════════

    /**
     * Renders the Agents sub-view shell and loads agents.
     * @private
     */
    _renderAgentsView() {
        const M = Config.MESSAGES.AGENTS;
        this.ui.host.innerHTML = `
            <div class="pdt-toolbar flex-shrink-0">
                <select class="pdt-input pdt-agents-solution" data-scope="agents" style="flex: 1;" aria-label="${M.solutionFilterAll}">
                    <option value="">${M.solutionFilterAll}</option>
                </select>
                <input type="text" class="pdt-input pdt-agents-search" data-scope="agents"
                       placeholder="${M.agentSearchPlaceholder}" aria-label="${M.agentSearchPlaceholder}" style="flex: 1;">
                <button class="modern-button" data-action="refresh-agents">${M.refresh}</button>
            </div>
            <div id="pdt-agents-list" class="pdt-agents-list pdt-card-grid"></div>
        `;
        this.ui.list = this.ui.host.querySelector('#pdt-agents-list');

        if (this.agents) {
            this._renderAgentCards();
        } else {
            this._loadAgents();
        }
    }

    /**
     * Loads agents from Dataverse and renders the cards.
     * @private
     */
    async _loadAgents() {
        const M = Config.MESSAGES.AGENTS;
        const list = this.ui.host.querySelector('#pdt-agents-list');
        if (!list) {
            return;
        }
        list.innerHTML = `<p class="pdt-note">${M.loadingAgents}</p>`;
        try {
            BusyIndicator.set();
            this.agents = await DataService.getAgents();
            this._renderAgentCards();
        } catch (e) {
            list.innerHTML = `<div class="pdt-error">${M.loadAgentsFailed(escapeHtml(e.message))}</div>`;
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Renders agent cards (or an empty-state message) into the list.
     * @private
     */
    _renderAgentCards() {
        const M = Config.MESSAGES.AGENTS;
        const list = this.ui.host.querySelector('#pdt-agents-list');
        if (!list) {
            return;
        }
        if (!this.agents?.length) {
            list.innerHTML = `<p class="pdt-note">${M.noAgents}</p>`;
            return;
        }
        const frag = document.createDocumentFragment();
        this.agents.forEach(agent => frag.appendChild(this._createAgentCard(agent)));
        list.textContent = '';
        list.appendChild(frag);
        this._ensureSolutionsAndPopulate('agents');
    }

    /**
     * Creates a card element for a single agent.
     * @param {Agent} agent
     * @returns {HTMLElement}
     * @private
     */
    _createAgentCard(agent) {
        const M = Config.MESSAGES.AGENTS;
        const card = document.createElement('div');
        card.className = 'pdt-agent-card pdt-card';
        card.dataset.agentId = agent.id;
        card.dataset.agentName = agent.name;
        card.dataset.statecode = String(agent.statecode);
        card.dataset.managed = String(agent.isManaged);
        // Real solution membership (resolved later from solutioncomponent); the record's own
        // solutionid points to the invisible "Active" layer, so it is not used for filtering.
        card.dataset.solutionIds = (agent.solutionIds || []).join(' ');
        // Publish state (Copilot Studio's primary status) is derived from `publishedon` and is
        // INDEPENDENT of the Active/Inactive record state (statecode). Empty publishedon = Draft.
        const isPublished = Boolean(agent.publishedOn);
        const publishClass = isPublished ? 'published' : 'draft';
        const publishLabel = isPublished ? M.publishStatePublished : M.publishStateDraft;
        card.dataset.searchTerm = [agent.name, agent.schemaName, agent.stateLabel, publishLabel, agent.owner]
            .join(' ').toLowerCase();

        const isActive = agent.statecode === 0;
        const statusClass = isActive ? 'active' : 'inactive';
        const publishTitle = isPublished ? M.publishStatePublishedTitle(agent.publishedOn) : M.publishStateDraftTitle;
        const stateTitle = isActive ? M.recordStateActiveTitle : M.recordStateInactiveTitle;
        const managedBadge = agent.isManaged
            ? `<span class="pdt-capi-badge pdt-capi-badge-managed">${M.managedLabel}</span>`
            : `<span class="pdt-capi-badge pdt-capi-badge-unmanaged">${M.unmanagedLabel}</span>`;
        const kindLabel = agent.isModern ? M.agentKindModern : M.agentKindClassic;
        const kindTitle = agent.isModern ? M.agentKindModernTitle : M.agentKindClassicTitle;
        const kindBadge = `<span class="pdt-capi-badge pdt-agent-kind-badge ${agent.isModern ? 'modern' : 'classic'}" title="${escapeHtml(kindTitle)}">${escapeHtml(kindLabel)}</span>`;

        card.innerHTML = `
            <div class="pdt-card-header pdt-agent-header">
                <div class="pdt-agent-title-row">
                    <span class="pdt-agent-name">${escapeHtml(agent.name)}</span>
                    <div class="pdt-agent-badges">
                        <span class="pdt-status-badge pdt-agent-publish-badge ${publishClass}" title="${escapeHtml(publishTitle)}">${escapeHtml(publishLabel)}</span>
                        <span class="pdt-status-badge pdt-agent-state-badge ${statusClass}" title="${escapeHtml(stateTitle)}">${escapeHtml(agent.stateLabel)}</span>
                        ${kindBadge}
                        ${managedBadge}
                    </div>
                </div>
            </div>
            <div class="pdt-card-body">
                <div class="info-grid pdt-agent-info-grid">
                    <strong>Schema:</strong><code class="copyable code-like" title="Click to copy" tabindex="0">${escapeHtml(agent.schemaName)}</code>
                    <strong>ID:</strong><code class="copyable code-like" title="Click to copy" tabindex="0">${escapeHtml(agent.id)}</code>
                    ${agent.language ? `<strong>Language:</strong><span>${escapeHtml(agent.language)}</span>` : ''}
                    ${agent.authMode ? `<strong>Auth:</strong><span>${escapeHtml(agent.authMode)}</span>` : ''}
                    <strong>Owner:</strong><span>${escapeHtml(agent.owner)}</span>
                    <strong>Modified:</strong><span>${escapeHtml(agent.modifiedOn)}</span>
                    ${agent.publishedOn ? `<strong>Published:</strong><span>${escapeHtml(agent.publishedOn)}</span>` : ''}
                </div>
            </div>
            <div class="pdt-card-footer">
                ${this._getAgentCardActions(agent)}
            </div>
        `;
        return card;
    }

    /**
     * Returns the footer action buttons HTML for an agent card.
     * @param {Agent} agent
     * @returns {string}
     * @private
     */
    _getAgentCardActions(agent) {
        const M = Config.MESSAGES.AGENTS;
        const isActive = agent.statecode === 0;
        const toggleText = isActive ? M.deactivate : M.activate;
        const toggleClass = isActive ? 'secondary' : '';
        const deleteBtn = agent.isManaged
            ? ''
            : `<button class="modern-button secondary pdt-capi-delete-hover" data-action="delete" title="${M.deleteAgent}">${M.deleteAgent}</button>`;

        return `
            <div class="pdt-agent-actions-group">
                ${deleteBtn}
                <button class="modern-button secondary" data-action="export-agent" title="${M.exportAgentTitle}">${M.exportAgent}</button>
                <button class="modern-button secondary" data-action="open-studio" title="${M.openInStudio}">${M.openInStudio}</button>
                <button class="modern-button secondary" data-action="view-def" title="${M.viewDefinition}">${M.viewDefinition}</button>
                <button class="modern-button ${toggleClass}" data-action="toggle" title="${toggleText}">${toggleText}</button>
            </div>
        `;
    }

    /**
     * Activates or deactivates an agent, updating its card in place.
     * @param {HTMLElement} card
     * @private
     */
    async _handleToggleAgent(card) {
        const M = Config.MESSAGES.AGENTS;
        if (!card) {
            return;
        }
        const agentId = card.dataset.agentId;
        const activate = parseInt(card.dataset.statecode, 10) !== 0;
        const toggleBtn = card.querySelector('[data-action="toggle"]');

        try {
            if (toggleBtn) {
                toggleBtn.disabled = true;
            }
            BusyIndicator.set();
            await DataService.setAgentState(agentId, activate);
            NotificationService.show(activate ? M.agentActivated : M.agentDeactivated, 'success');

            const newState = activate ? 0 : 1;
            card.dataset.statecode = String(newState);
            const agent = this.agents?.find(a => a.id === agentId);
            if (agent) {
                agent.statecode = newState;
                agent.stateLabel = newState === 0 ? 'Active' : 'Inactive';
            }
            // Update only the record-state badge; the publish badge (Draft/Published) is independent
            // of statecode and must not change when activating/deactivating the record.
            const badge = card.querySelector('.pdt-agent-state-badge');
            if (badge) {
                badge.className = `pdt-status-badge pdt-agent-state-badge ${newState === 0 ? 'active' : 'inactive'}`;
                badge.title = newState === 0 ? M.recordStateActiveTitle : M.recordStateInactiveTitle;
                badge.textContent = agent ? agent.stateLabel : (newState === 0 ? 'Active' : 'Inactive');
            }
            const footer = card.querySelector('.pdt-card-footer');
            if (footer && agent) {
                footer.innerHTML = this._getAgentCardActions(agent);
            }
        } catch (e) {
            const msg = activate ? M.activateFailed(escapeHtml(e.message)) : M.deactivateFailed(escapeHtml(e.message));
            NotificationService.show(msg, 'error');
            if (toggleBtn) {
                toggleBtn.disabled = false;
            }
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Deletes an unmanaged agent after confirmation.
     * @param {HTMLElement} card
     * @private
     */
    async _handleDeleteAgent(card) {
        const M = Config.MESSAGES.AGENTS;
        if (!card) {
            return;
        }
        if (card.dataset.managed === 'true') {
            NotificationService.show(M.managedAgentNote, 'warn');
            return;
        }
        const agentId = card.dataset.agentId;
        const agentName = card.dataset.agentName || '';
        const confirmed = await showConfirmDialog(M.deleteConfirmTitle, M.deleteConfirm(escapeHtml(agentName)));
        if (!confirmed) {
            return;
        }
        const deleteBtn = card.querySelector('[data-action="delete"]');
        if (deleteBtn) {
            deleteBtn.disabled = true;
        }
        try {
            BusyIndicator.set();
            await DataService.deleteAgent(agentId);
            NotificationService.show(M.agentDeleted, 'success');
            this.agents = (this.agents || []).filter(a => a.id !== agentId);
            card.remove();
            if (!this.agents.length) {
                this._renderAgentCards();
            }
        } catch (e) {
            NotificationService.show(M.deleteFailed(escapeHtml(e.message)), 'error');
            if (deleteBtn) {
                deleteBtn.disabled = false;
            }
        } finally {
            BusyIndicator.clear();
        }
    }

    // ═══════════════════════════════════════════════════════════
    // AGENT FLOWS VIEW
    // ═══════════════════════════════════════════════════════════

    /**
     * Renders the Workflows sub-view shell (search + refresh) and loads the workflows.
     * Lists the environment's Copilot Studio agent flows ("Workflows", modernflowtype=1) directly,
     * rather than only the flows a single agent links as a tool.
     * @private
     */
    async _renderFlowsView() {
        const M = Config.MESSAGES.AGENTS;
        this.ui.host.innerHTML = `
            <div class="pdt-toolbar flex-shrink-0">
                <select class="pdt-input pdt-agent-flows-solution" style="flex: 1;" aria-label="${M.solutionFilterAll}">
                    <option value="">${M.solutionFilterAll}</option>
                </select>
                <input type="text" class="pdt-input pdt-agent-flows-search" style="flex: 2;"
                    placeholder="${M.flowsSearchPlaceholder}" aria-label="${M.flowsSearchPlaceholder}">
                <button class="modern-button" data-action="refresh-flows">${M.refresh}</button>
            </div>
            <div id="pdt-flows-list" class="pdt-agents-list pdt-card-grid">
                <p class="pdt-note">${M.loadingFlows}</p>
            </div>
        `;
        await this._loadAgentFlows();
    }

    /**
     * Loads all Copilot Studio agent flows in the environment, caching the result.
     * @private
     */
    async _loadAgentFlows() {
        const M = Config.MESSAGES.AGENTS;
        const list = this.ui.host.querySelector('#pdt-flows-list');
        if (!list) {
            return;
        }
        list.innerHTML = `<p class="pdt-note">${M.loadingFlows}</p>`;
        try {
            BusyIndicator.set();
            if (!this.agentFlows) {
                this.agentFlows = await DataService.getAgentFlows();
                try {
                    const memberships = await DataService.getSolutionMemberships(this.agentFlows.map(f => f.id));
                    this.agentFlows.forEach(f => {
                        f.solutionIds = memberships[f.id] || [];
                    });
                } catch {
                    this.agentFlows.forEach(f => {
                        f.solutionIds = f.solutionIds || [];
                    });
                }
            }
            this._renderFlowRows(this.agentFlows);
            await this._populateAgentFlowsSolutions();
            this._filterAgentFlows();
        } catch (e) {
            list.innerHTML = `<div class="pdt-error">${M.loadFlowsFailed(escapeHtml(e.message))}</div>`;
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Renders the agent flow rows (or an empty-state message).
     * @param {Array<{id: string, name: string, statecode: number, stateLabel: string, owner: string, modifiedOn: string}>} flows
     * @private
     */
    _renderFlowRows(flows) {
        const M = Config.MESSAGES.AGENTS;
        const list = this.ui.host.querySelector('#pdt-flows-list');
        if (!list) {
            return;
        }
        if (!flows?.length) {
            list.innerHTML = `<p class="pdt-note">${M.noFlows}</p>`;
            return;
        }
        const frag = document.createDocumentFragment();
        flows.forEach(flow => frag.appendChild(this._createAgentFlowRow(flow)));
        list.textContent = '';
        list.appendChild(frag);
    }

    /**
     * Builds an agent-flow card mirroring the Power Automate flow card (badges, info grid, actions).
     * @param {{id: string, name: string, description: string, statecode: number, isManaged: boolean, owner: string, createdOn: string, modifiedOn: string, createdBy: string}} flow
     * @returns {HTMLElement}
     * @private
     */
    _createAgentFlowRow(flow) {
        const M = Config.MESSAGES.AGENTS;
        const isOn = flow.statecode === 1;
        const statusText = isOn ? M.flowStatusOn : M.flowStatusOff;
        const managedBadge = flow.isManaged
            ? `<span class="pdt-capi-badge pdt-capi-badge-managed">${M.flowManagedLabel}</span>`
            : `<span class="pdt-capi-badge pdt-capi-badge-unmanaged">${M.flowUnmanagedLabel}</span>`;

        const card = document.createElement('div');
        card.className = 'pdt-flow-card pdt-card';
        card.dataset.flowId = flow.id;
        card.dataset.flowName = flow.name;
        card.dataset.flowManaged = String(flow.isManaged === true);
        card.dataset.statecode = String(flow.statecode);
        card.dataset.solutionIds = (flow.solutionIds || []).join(' ');
        card.dataset.flowSearch = [flow.name, flow.owner, statusText].join(' ').toLowerCase();
        card.innerHTML = `
            <div class="pdt-card-header pdt-flow-header">
                <div class="pdt-flow-title-row">
                    <span class="pdt-flow-name">${escapeHtml(flow.name)}</span>
                    <div class="pdt-flow-badges">
                        <span class="pdt-status-badge ${isOn ? 'active' : 'inactive'}">${statusText}</span>
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
            <div class="pdt-card-footer">${this._renderAgentFlowActions(flow)}</div>
        `;
        return card;
    }

    /**
     * Returns the action-button HTML for an agent flow row. Delete is omitted for managed flows,
     * mirroring the Power Automate tab.
     * @param {{statecode: number, isManaged: boolean}} flow
     * @returns {string}
     * @private
     */
    _renderAgentFlowActions(flow) {
        const M = Config.MESSAGES.AGENTS;
        const isOn = flow.statecode === 1;
        const toggleText = isOn ? M.flowTurnOff : M.flowTurnOn;
        const toggleClass = isOn ? 'secondary' : '';
        const deleteBtn = flow.isManaged
            ? ''
            : `<button class="modern-button secondary pdt-capi-delete-hover" data-action="flow-delete" title="${M.flowDelete}">${M.flowDelete}</button>`;
        return `
            ${deleteBtn}
            <button class="modern-button secondary" data-action="flow-open" title="${M.flowOpenInPortal}">${M.flowOpenInPortal}</button>
            <button class="modern-button secondary" data-action="flow-view-def" title="${M.flowViewDefinition}">${M.flowViewDefinition}</button>
            <button class="modern-button ${toggleClass}" data-action="flow-toggle" title="${toggleText}">${toggleText}</button>
        `;
    }

    /**
     * Activates/deactivates an agent flow and updates its row in place.
     * @param {HTMLElement} card - The flow row element.
     * @private
     */
    async _handleToggleAgentFlow(card) {
        const M = Config.MESSAGES.AGENTS;
        const flowId = card?.dataset.flowId;
        if (!flowId) {
            return;
        }
        const activate = parseInt(card.dataset.statecode, 10) !== 1;
        const btn = card.querySelector('[data-action="flow-toggle"]');
        try {
            if (btn) {
                btn.disabled = true;
            }
            BusyIndicator.set();
            await DataService.setFlowState(flowId, activate);
            NotificationService.show(activate ? M.flowActivated : M.flowDeactivated, 'success');

            const newState = activate ? 1 : 0;
            card.dataset.statecode = String(newState);
            const flow = this.agentFlows?.find(f => f.id === flowId);
            if (flow) {
                flow.statecode = newState;
            }
            const badge = card.querySelector('.pdt-status-badge');
            if (badge) {
                badge.className = `pdt-status-badge ${newState === 1 ? 'active' : 'inactive'}`;
                badge.textContent = newState === 1 ? M.flowStatusOn : M.flowStatusOff;
            }
            const actions = card.querySelector('.pdt-card-footer');
            if (actions && flow) {
                actions.innerHTML = this._renderAgentFlowActions(flow);
            }
        } catch (e) {
            NotificationService.show(M.flowToggleFailed(escapeHtml(e.message)), 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
            }
            BusyIndicator.clear();
        }
    }

    /**
     * Deletes an agent flow (unmanaged) after confirmation and removes its row.
     * @param {HTMLElement} card - The flow row element.
     * @private
     */
    async _handleDeleteAgentFlow(card) {
        const M = Config.MESSAGES.AGENTS;
        const flowId = card?.dataset.flowId;
        if (!flowId) {
            return;
        }
        const name = card.dataset.flowName || '';
        const confirmed = await showConfirmDialog(M.flowDeleteConfirmTitle, M.flowDeleteConfirm(escapeHtml(name)));
        if (!confirmed) {
            return;
        }
        const deleteBtn = card.querySelector('[data-action="flow-delete"]');
        if (deleteBtn) {
            deleteBtn.disabled = true;
        }
        try {
            BusyIndicator.set();
            await DataService.deleteFlow(flowId);
            NotificationService.show(M.flowDeleted, 'success');
            this.agentFlows = (this.agentFlows || []).filter(f => f.id !== flowId);
            card.remove();
            const list = this.ui.host.querySelector('#pdt-flows-list');
            if (list && !this.agentFlows.length) {
                list.innerHTML = `<p class="pdt-note">${M.noFlows}</p>`;
            }
        } catch (e) {
            NotificationService.show(M.flowDeleteFailed(escapeHtml(e.message)), 'error');
            if (deleteBtn) {
                deleteBtn.disabled = false;
            }
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Fills the Workflows solution dropdown from the flows' real solutioncomponent membership
     * (includes the Default/Active solution, consistent with the Agents/Prompts views).
     * @private
     */
    async _populateAgentFlowsSolutions() {
        const select = this.ui.host?.querySelector('.pdt-agent-flows-solution');
        if (!select) {
            return;
        }
        const allIds = [...new Set((this.agentFlows || []).flatMap(f => f.solutionIds || []))];
        const missing = allIds.filter(id => !this.solutionsMap[id]);
        if (missing.length) {
            try {
                Object.assign(this.solutionsMap, await DataService.getAgentSolutionNames(missing));
            } catch {
                // Fall back to the labeled short id.
            }
        }
        this._fillSolutionSelect(select, allIds);
    }

    /**
     * Applies the live search + solution filter to the agent flow rows.
     * @private
     */
    _filterAgentFlows() {
        const M = Config.MESSAGES.AGENTS;
        const list = this.ui.host.querySelector('#pdt-flows-list');
        const input = this.ui.host.querySelector('.pdt-agent-flows-search');
        const solutionSelect = this.ui.host.querySelector('.pdt-agent-flows-solution');
        if (!list) {
            return;
        }
        const term = (input?.value || '').trim().toLowerCase();
        const solutionId = solutionSelect?.value || '';
        const rows = list.querySelectorAll('[data-flow-id]');
        if (!rows.length) {
            return;
        }
        let visible = 0;
        rows.forEach(row => {
            const matchesSearch = !term || (row.dataset.flowSearch || '').includes(term);
            const matchesSolution = !solutionId
                || (row.dataset.solutionIds || '').split(' ').filter(Boolean).includes(solutionId);
            const match = matchesSearch && matchesSolution;
            row.style.display = match ? '' : 'none';
            if (match) {
                visible += 1;
            }
        });

        let empty = list.querySelector('.pdt-agent-flows-empty');
        if (visible === 0) {
            if (!empty) {
                empty = document.createElement('p');
                empty.className = 'pdt-note pdt-agent-flows-empty';
                empty.textContent = M.noFlowsMatch;
                list.appendChild(empty);
            }
        } else if (empty) {
            empty.remove();
        }
    }

    /**
     * Opens a Copilot Studio agent flow in Copilot Studio (the /agent-flows/{id} designer).
     * @param {string} flowId
     * @private
     */
    async _openAgentFlow(flowId) {
        if (!flowId) {
            return;
        }
        const envId = await this._getEnvironmentId();
        const url = envId
            ? `https://copilotstudio.microsoft.com/environments/${envId}/agent-flows/${flowId}`
            : 'https://copilotstudio.microsoft.com/';
        window.open(url, '_blank');
    }

    // ═══════════════════════════════════════════════════════════
    // AGENT DEFINITION DIALOG
    // ═══════════════════════════════════════════════════════════

    /**
     * Opens a dialog showing an agent's instructions, components, and configuration.
     * @param {string} agentId
     * @param {string} agentName
     * @private
     */
    async _handleViewDefinition(agentId, agentName) {
        const M = Config.MESSAGES.AGENTS;
        if (!agentId) {
            return;
        }
        const agent = this.agents?.find(a => a.id === agentId) || { id: agentId, name: agentName, isManaged: true };
        try {
            BusyIndicator.set();
            const [components, configuration] = await Promise.all([
                DataService.getAgentComponents(agentId),
                DataService.getAgentConfiguration(agentId).catch(() => null)
            ]);
            const container = this._buildDefinitionContainer(agent, components, configuration);
            DialogService.show(M.definitionTitle(escapeHtml(agentName || '')), container);
            this._injectDialogFooterActions(container);
        } catch (e) {
            NotificationService.show(M.loadComponentsFailed(escapeHtml(e.message)), 'error');
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Exports an agent's full definition (metadata + configuration + all components) as a JSON file,
     * for backup, diffing between environments, or source control.
     * @param {string} agentId
     * @private
     */
    async _handleExportAgent(agentId) {
        const M = Config.MESSAGES.AGENTS;
        const agent = this.agents?.find(a => a.id === agentId);
        if (!agent) {
            return;
        }
        try {
            BusyIndicator.set();
            const [components, configuration] = await Promise.all([
                DataService.getAgentComponents(agentId),
                DataService.getAgentConfiguration(agentId).catch(() => null)
            ]);
            const bundle = this._buildAgentExport(agent, components, configuration);
            const safeName = (agent.schemaName || agent.name || agentId).replace(/[^a-z0-9_-]+/gi, '_');
            downloadJson(bundle, `agent-${safeName}.json`);
            NotificationService.show(M.exported, 'success');
        } catch (e) {
            NotificationService.show(M.exportFailed(escapeHtml(e.message)), 'error');
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Builds the serializable export bundle for an agent.
     * @param {import('../services/AgentService.js').Agent} agent
     * @param {import('../services/AgentService.js').AgentComponent[]} components
     * @param {string|null} configuration
     * @returns {object}
     * @private
     */
    _buildAgentExport(agent, components, configuration) {
        return {
            exportedAt: new Date().toISOString(),
            tool: 'Power-Toolkit',
            agent: {
                id: agent.id,
                name: agent.name,
                schemaName: agent.schemaName,
                state: agent.stateLabel,
                language: agent.language,
                owner: agent.owner,
                isManaged: agent.isManaged,
                createdOn: agent.createdOn,
                modifiedOn: agent.modifiedOn,
                publishedOn: agent.publishedOn
            },
            configuration: this._safeParse(configuration),
            components: (components || []).map(component => ({
                id: component.id,
                name: component.name,
                schemaName: component.schemaName,
                kind: getComponentKind(component),
                type: component.componentTypeLabel,
                state: component.statecode === 0 ? 'Active' : 'Inactive',
                description: getComponentDescription(component),
                data: component.data || '',
                content: component.content || ''
            }))
        };
    }

    /**
     * Parses a JSON string, returning the parsed object or the original string when it is not JSON.
     * @param {string|null} text
     * @returns {*}
     * @private
     */
    _safeParse(text) {
        if (!text) {
            return null;
        }
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    /**
     * Polls `publishedon` until it moves off the value read before publishing. A timeout means
     * "not confirmed yet", never "failed".
     * @param {string} agentId - The bot GUID.
     * @param {string} previousPublishedOnRaw - Raw `publishedon` read before publishing ('' if never published).
     * @param {{attempts?: number, intervalMs?: number, wait?: (ms: number) => Promise<void>}} [opts] - Overridable for tests.
     * @returns {Promise<boolean>} True once `publishedon` has moved.
     * @private
     */
    async _waitForPublish(agentId, previousPublishedOnRaw, opts = {}) {
        const {
            attempts = Config.AGENT_PUBLISH.maxPollingAttempts,
            intervalMs = Config.AGENT_PUBLISH.pollingInterval,
            wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))
        } = opts;
        const generation = this._lifecycle;

        for (let i = 0; i < attempts; i++) {
            if (this._lifecycle !== generation) {
                return false;
            }
            try {
                const { publishedOnRaw } = await DataService.getAgentPublishState(agentId);
                if (publishedOnRaw && publishedOnRaw !== previousPublishedOnRaw) {
                    return true;
                }
            } catch {
                // Transient read failure — keep polling.
            }
            // Checked before waiting, so a publish that already landed costs no delay.
            if (i < attempts - 1) {
                await wait(intervalMs);
            }
        }
        return false;
    }

    /**
     * Keeps watching a publish that outlasted the foreground wait and announces it when it lands.
     * Fire-and-forget: one that never confirms was already reported as unconfirmed.
     * @param {Agent} agent - The agent being published.
     * @param {string} previousPublishedOnRaw - Raw `publishedon` read before publishing.
     * @param {(() => Promise<void>|void)|null} onStateChanged - Refreshes the dependent panels.
     * @returns {Promise<void>}
     * @private
     */
    async _watchPublishInBackground(agent, previousPublishedOnRaw, onStateChanged) {
        const generation = this._lifecycle;
        const landed = await this._waitForPublish(agent.id, previousPublishedOnRaw, {
            attempts: Config.AGENT_PUBLISH.backgroundPollingAttempts
        });
        if (!landed || this._lifecycle !== generation) {
            return;
        }
        NotificationService.show(Config.MESSAGES.AGENTS.published, 'success');
        await onStateChanged?.();
    }

    /**
     * Re-syncs an agent card's Draft/Published badge from the agent's current `publishedOn`.
     * Publishing happens inside the definition dialog, so the card behind it would otherwise keep
     * showing the pre-publish state until the whole list is refreshed.
     * @param {Agent} agent - The agent, with `publishedOn` already updated.
     * @private
     */
    _syncAgentCardPublishBadge(agent) {
        const M = Config.MESSAGES.AGENTS;
        const badge = this.ui?.host?.querySelector(
            `[data-agent-id="${CSS.escape(agent.id)}"] .pdt-agent-publish-badge`
        );
        if (!badge) {
            return;
        }
        const isPublished = Boolean(agent.publishedOn);
        badge.className = `pdt-status-badge pdt-agent-publish-badge ${isPublished ? 'published' : 'draft'}`;
        badge.title = isPublished ? M.publishStatePublishedTitle(agent.publishedOn) : M.publishStateDraftTitle;
        badge.textContent = isPublished ? M.publishStatePublished : M.publishStateDraft;
    }

    /**
     * Injects a container's footer actions (Save / Save & Publish / Undo) into the open dialog's
     * footer, beside the Close button.
     * @param {HTMLElement} container
     * @private
     */
    _injectDialogFooterActions(container) {
        if (!container._footerActions) {
            return;
        }
        const footer = document.querySelector(`#${Config.DIALOG_OVERLAY_ID} .${Config.DIALOG_CLASSES.footer}`);
        if (!footer) {
            return;
        }
        const closeBtn = footer.querySelector(`.${Config.DIALOG_CLASSES.cancelBtn}`);
        footer.insertBefore(container._footerActions, closeBtn);
    }

    /**
     * Builds the definition dialog container with Overview / Map / Components / Configuration sub-tabs.
     * For unmanaged agents, editable sections share a single footer editor (Save / Save & Publish / Undo).
     * @param {Agent} agent
     * @param {AgentComponent[]} components
     * @param {string|null} configuration
     * @returns {HTMLElement}
     * @private
     */
    _buildDefinitionContainer(agent, components, configuration) {
        const M = Config.MESSAGES.AGENTS;
        const container = document.createElement('div');
        container.className = 'pdt-agent-def-container';
        const activityPanel = document.createElement('div');
        activityPanel.className = 'pdt-agent-def-panel';
        let usageLoaded = false;
        const refreshActivity = async () => {
            const [freshComponents, publishState] = await Promise.all([
                DataService.getAgentComponents(agent.id),
                DataService.getAgentPublishState(agent.id)
            ]);
            agent.publishedOnRaw = publishState.publishedOnRaw;
            agent.publishedOn = publishState.publishedOn;
            components = freshComponents;

            this._renderActivityPanel(activityPanel, agent, components);
            if (usageLoaded) {
                activityPanel._loadUsage?.();
            }
            this._syncAgentCardPublishBadge(agent);
        };

        const editor = agent.isManaged ? null : this._createDefinitionEditor(agent, {
            onStateChanged: () => refreshActivity().catch(() => {
                // Best-effort: the write already succeeded, and re-opening the dialog re-reads anyway.
            })
        });
        if (editor) {
            container._footerActions = editor.footerEl;
        }

        const tabBar = document.createElement('div');
        tabBar.className = 'pdt-sub-tabs pdt-agent-def-tabs';
        tabBar.innerHTML = `
            <button type="button" class="pdt-sub-tab active" data-tab="overview">${M.tabOverview}</button>
            <button type="button" class="pdt-sub-tab" data-tab="map">${M.tabMap}</button>
            <button type="button" class="pdt-sub-tab" data-tab="components">${M.tabComponents}</button>
            <button type="button" class="pdt-sub-tab" data-tab="activity">${M.tabActivity}</button>
            <button type="button" class="pdt-sub-tab" data-tab="transcripts">${M.tabTranscripts}</button>
            <button type="button" class="pdt-sub-tab" data-tab="config">${M.tabConfig}</button>
        `;

        const panels = {
            overview: this._buildOverviewPanel(agent, components, configuration, editor),
            map: this._buildMapPanel(),
            components: this._buildComponentsPanel(agent, components, editor),
            activity: this._renderActivityPanel(activityPanel, agent, components),
            transcripts: this._buildTranscriptsPanel(),
            config: this._buildConfigPanel(agent, configuration, editor)
        };
        Object.entries(panels).forEach(([key, panel]) => {
            panel.style.display = key === 'overview' ? '' : 'none';
        });

        let transcriptsLoaded = false;
        let mapRendered = false;
        tabBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.pdt-sub-tab');
            if (!btn) {
                return;
            }
            tabBar.querySelectorAll('.pdt-sub-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            Object.entries(panels).forEach(([key, panel]) => {
                panel.style.display = key === tab ? '' : 'none';
            });
            if (tab === 'map' && !mapRendered) {
                mapRendered = true;
                this._renderMapNode(panels.map, agent, components, new Set([agent.id]), 0);
            }
            if (tab === 'transcripts' && !transcriptsLoaded) {
                transcriptsLoaded = true;
                // Re-open retries the load if it failed (keep it unlatched on error).
                this._loadTranscriptsInto(agent.id, panels.transcripts.querySelector('.pdt-agent-transcripts-list'))
                    .then(ok => {
                        transcriptsLoaded = ok;
                    });
            }
            if (tab === 'activity' && !usageLoaded) {
                // The panel itself is already current — every save/publish re-renders it in place.
                usageLoaded = true;
                activityPanel._loadUsage?.();
            }
        });

        this._makeTabsAccessible(tabBar, panels);
        // A modern agent's instructions and its Configuration JSON are two views of the same bot
        // configuration — keep them live-synced so an edit in either shows in the other and one Save
        // persists both (only present when the instructions are editable — see _buildOverviewPanel).
        const instrTa = panels.overview.querySelector('.pdt-agent-instructions-sync');
        const configTa = panels.config.querySelector('.pdt-agent-edit-textarea');
        if (instrTa && configTa) {
            this._wireInstructionSync(instrTa, configTa);
        }
        container.append(tabBar, panels.overview, panels.map, panels.components, panels.activity, panels.transcripts, panels.config);
        return container;
    }

    /**
     * Two-way binds a modern agent's friendly instructions box to the raw Configuration JSON editor,
     * which is the single source of truth. Editing the instructions splices them back into the config
     * (and marks it dirty, so the footer Save persists them); editing the raw config re-derives the
     * instructions. Mirrors the prompt dialog's editor sync, so the two never drift.
     * @param {HTMLTextAreaElement} instrTa - The Overview instructions textarea.
     * @param {HTMLTextAreaElement} configTa - The Configuration JSON textarea (the source of truth).
     * @private
     */
    _wireInstructionSync(instrTa, configTa) {
        // Re-entrancy guard: an instructions edit writes the config and dispatches `input` so the footer
        // sees it dirty — but that same event must NOT echo back into the instructions box. Re-deriving
        // would run the text through extractAgentInstructions, whose trim() strips the trailing newline /
        // spaces the user is actively typing, eating the keystroke and jumping the caret.
        let syncingFromInstructions = false;
        instrTa.addEventListener('input', () => {
            let updated;
            try {
                updated = applyAgentInstructions(configTa.value, instrTa.value);
            } catch {
                // The raw config is momentarily invalid (hand-edited) — leave it until it parses again.
                return;
            }
            syncingFromInstructions = true;
            configTa.value = this._prettyJson(updated);
            // Let the footer editor (and this pair's own listeners) see the config as changed.
            configTa.dispatchEvent(new Event('input', { bubbles: true }));
            syncingFromInstructions = false;
        });
        configTa.addEventListener('input', () => {
            if (syncingFromInstructions) {
                // This change came from the instructions box itself — don't echo it back.
                return;
            }
            try {
                JSON.parse(configTa.value);
            } catch {
                // Don't blank the instructions view while the JSON is mid-edit / invalid.
                return;
            }
            const text = extractAgentInstructions(configTa.value);
            if (instrTa.value !== text) {
                instrTa.value = text;
            }
        });
    }

    /**
     * Upgrades a dialog sub-tab bar (`.pdt-sub-tabs` of `.pdt-sub-tab[data-tab]` buttons) to the
     * WAI-ARIA Tabs pattern: tablist/tab/tabpanel roles, `aria-selected`, `aria-controls` /
     * `aria-labelledby` links, a roving tabindex, and Arrow/Home/End keyboard navigation (automatic
     * activation — the panels show without latency). It layers on top of the bar's own click handler,
     * which already shows the panel and moves the `.active` class; this keeps the ARIA state and roving
     * focus in step with whichever tab is active, and moves-and-activates on the arrow keys.
     * @param {HTMLElement} tabBar - The tablist element; its children are the tab buttons.
     * @param {Object.<string, HTMLElement>} panels - data-tab key → panel element.
     * @private
     */
    _makeTabsAccessible(tabBar, panels) {
        const tabs = Array.from(tabBar.querySelectorAll('.pdt-sub-tab'));
        if (!tabs.length) {
            return;
        }
        // A per-bar sequence keeps the generated ids unique across dialog re-opens.
        const seq = (AgentsTab._tabSeq = (AgentsTab._tabSeq || 0) + 1);
        tabBar.setAttribute('role', 'tablist');
        tabs.forEach(tab => {
            const panel = panels[tab.dataset.tab];
            const active = tab.classList.contains('active');
            tab.setAttribute('role', 'tab');
            tab.id = tab.id || `pdt-tab-${seq}-${tab.dataset.tab}`;
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
            if (panel) {
                panel.id = panel.id || `pdt-tabpanel-${seq}-${tab.dataset.tab}`;
                tab.setAttribute('aria-controls', panel.id);
                panel.setAttribute('role', 'tabpanel');
                panel.setAttribute('aria-labelledby', tab.id);
                panel.tabIndex = 0;
            }
        });

        // The bar's own click handler already switched the panel and moved `.active`; mirror that into
        // the ARIA selected state and the roving tabindex.
        tabBar.addEventListener('click', () => {
            tabs.forEach(tab => {
                const active = tab.classList.contains('active');
                tab.setAttribute('aria-selected', String(active));
                tab.tabIndex = active ? 0 : -1;
            });
        });

        tabBar.addEventListener('keydown', (e) => {
            const current = tabs.indexOf(document.activeElement);
            if (current === -1) {
                return;
            }
            let next;
            switch (e.key) {
                case 'ArrowRight':
                case 'ArrowDown':
                    next = (current + 1) % tabs.length;
                    break;
                case 'ArrowLeft':
                case 'ArrowUp':
                    next = (current - 1 + tabs.length) % tabs.length;
                    break;
                case 'Home':
                    next = 0;
                    break;
                case 'End':
                    next = tabs.length - 1;
                    break;
                default:
                    return;
            }
            e.preventDefault();
            tabs[next].focus();
            tabs[next].click();
        });
    }

    /**
     * Renders the Activity panel into an existing host: the agent's lifecycle, a recent
     * component-change timeline, and a deep link to the full Copilot Studio analytics (which the
     * gateway computes).
     *
     * Fills a host rather than creating one, so it can be re-rendered in place once a save or
     * publish invalidates the `modifiedon`/`publishedon` snapshot its counters are derived from.
     * @param {HTMLElement} panel - The host element to clear and fill.
     * @param {Agent} agent
     * @param {AgentComponent[]} components
     * @returns {HTMLElement} The same host, filled.
     * @private
     */
    _renderActivityPanel(panel, agent, components) {
        const M = Config.MESSAGES.AGENTS;
        panel.textContent = '';

        // Usage & analytics leads the tab (Dataverse-native session counts + deep link to the full
        // gateway metrics). Loaded lazily — the definition dialog triggers `_loadUsage` the first time
        // the Activity tab is opened, so the transcript query doesn't slow down opening the dialog.
        const usageHeading = document.createElement('div');
        usageHeading.className = 'pdt-agent-def-heading';
        usageHeading.textContent = M.activityUsageHeading;
        const usageSlot = document.createElement('div');
        usageSlot.className = 'pdt-agent-usage';
        usageSlot.innerHTML = `<p class="pdt-note">${M.activityLoadingUsage}</p>`;
        panel.append(usageHeading, usageSlot);
        panel._loadUsage = () => this._loadAgentUsage(usageSlot, agent.id);

        // Publish readiness — components changed since the last publish are "unpublished".
        const unpublished = countUnpublishedComponents(components, agent.publishedOnRaw);
        let publishStatus;
        if (!agent.publishedOnRaw) {
            publishStatus = { text: M.publishStatusDraft, cls: 'draft' };
        } else if (unpublished > 0) {
            publishStatus = { text: M.publishStatusPending(unpublished), cls: 'pending' };
        } else {
            publishStatus = { text: M.publishStatusUpToDate, cls: 'ok' };
        }

        // Lifecycle
        const lifeHeading = document.createElement('div');
        lifeHeading.className = 'pdt-agent-def-heading';
        lifeHeading.textContent = M.activityLifecycle;
        const grid = document.createElement('div');
        grid.className = 'info-grid pdt-agent-info-grid';
        grid.innerHTML = `
            <strong>${M.activityCreated}:</strong><span>${escapeHtml(agent.createdOn || '—')}</span>
            <strong>${M.activityModified}:</strong><span>${escapeHtml(agent.modifiedOn || '—')}</span>
            ${agent.publishedOn ? `<strong>${M.activityPublished}:</strong><span>${escapeHtml(agent.publishedOn)}</span>` : ''}
            ${agent.publishedBy ? `<strong>${M.activityPublishedBy}:</strong><span>${escapeHtml(agent.publishedBy)}</span>` : ''}
            <strong>${M.activityOwner}:</strong><span>${escapeHtml(agent.owner || '—')}</span>
            <strong>${M.activityPublishStatus}:</strong><span class="pdt-agent-publish-status pdt-agent-publish-status--${publishStatus.cls}">${escapeHtml(publishStatus.text)}</span>
        `;
        panel.append(lifeHeading, grid);

        // Composition ("anatomy") — per-kind component counts.
        const composition = summarizeAgentComposition(components);
        if (composition.length) {
            const compHeading = document.createElement('div');
            compHeading.className = 'pdt-agent-def-heading';
            compHeading.textContent = M.activityCompositionHeading;
            const compWrap = document.createElement('div');
            compWrap.className = 'pdt-agent-composition';
            composition.forEach(entry => {
                const badge = document.createElement('span');
                badge.className = 'pdt-capi-badge pdt-capi-badge-action';
                badge.textContent = `${this._kindLabel(entry.kind)} × ${entry.count}`;
                compWrap.appendChild(badge);
            });
            panel.append(compHeading, compWrap);
        }

        // Recent changes (component audit timeline)
        const changesHeading = document.createElement('div');
        changesHeading.className = 'pdt-agent-def-heading';
        changesHeading.textContent = M.activityRecentChanges;
        panel.appendChild(changesHeading);

        const changed = (components || [])
            .filter(c => c.modifiedOnRaw)
            .sort((a, b) => String(b.modifiedOnRaw).localeCompare(String(a.modifiedOnRaw)))
            .slice(0, 15);

        if (!changed.length) {
            const note = document.createElement('p');
            note.className = 'pdt-note';
            note.textContent = M.activityNoChanges;
            panel.appendChild(note);
        } else {
            const pubTime = agent.publishedOnRaw ? new Date(agent.publishedOnRaw).getTime() : null;
            const list = document.createElement('div');
            list.className = 'pdt-agent-activity-list';
            changed.forEach(c => {
                const changedTime = c.modifiedOnRaw ? new Date(c.modifiedOnRaw).getTime() : NaN;
                const isUnpublished = pubTime !== null && !Number.isNaN(changedTime) && changedTime > pubTime;
                const row = document.createElement('div');
                row.className = 'pdt-agent-activity-row';
                row.innerHTML = `
                    <span class="pdt-agent-activity-name">${escapeHtml(c.name)}</span>
                    <span class="pdt-capi-badge pdt-capi-badge-action">${escapeHtml(this._kindLabel(getComponentKind(c)))}</span>
                    ${isUnpublished ? `<span class="pdt-capi-badge pdt-agent-unpublished-tag" title="${M.activityUnpublishedTagTitle}">${M.activityUnpublishedTag}</span>` : ''}
                    <span class="pdt-agent-activity-when">${escapeHtml(c.modifiedOn)}${c.modifiedBy ? ` · ${escapeHtml(c.modifiedBy)}` : ''}</span>
                `;
                list.appendChild(row);
            });
            panel.appendChild(list);
        }

        return panel;
    }

    /**
     * Loads and renders an agent's session analytics into the given slot.
     * @param {HTMLElement} slot
     * @param {string} agentId
     * @private
     */
    async _loadAgentUsage(slot, agentId) {
        const M = Config.MESSAGES.AGENTS;
        try {
            const usage = await DataService.getAgentUsage(agentId);
            slot.textContent = '';
            if (!usage.sampled) {
                slot.innerHTML = `<p class="pdt-note">${await this._usageEmptyReason()}</p>`;
                return;
            }
            slot.appendChild(this._buildUsagePanel(usage));
        } catch {
            slot.innerHTML = `<p class="pdt-note">${M.usageUnavailable}</p>`;
        }
    }

    /**
     * Picks the most accurate "no sessions" explanation. Reads the org diagnostics to detect blocked
     * transcript recording; otherwise notes the environment-type/retention caveats. Best-effort.
     * @returns {Promise<string>}
     * @private
     */
    async _usageEmptyReason() {
        const M = Config.MESSAGES.AGENTS;
        try {
            const { transcriptRecordingBlocked } = await DataService.getOrganizationDiagnostics();
            return transcriptRecordingBlocked ? M.usageNoSessionsBlocked : M.usageNoSessionsEnv;
        } catch {
            return M.usageNoSessionsEnv;
        }
    }

    /**
     * Builds the session-analytics panel: stat tiles, a 14-day sparkline, and a channel breakdown.
     * @param {import('../services/AgentService.js').AgentUsage} usage
     * @returns {HTMLElement}
     * @private
     */
    _buildUsagePanel(usage) {
        const M = Config.MESSAGES.AGENTS;
        const wrap = document.createElement('div');
        const totalLabel = usage.capped ? `${usage.sampled}+` : String(usage.sampled);
        const stat = (value, label) =>
            `<div class="pdt-agent-runs-stat">
                <span class="pdt-agent-runs-stat-value">${escapeHtml(String(value))}</span>
                <span class="pdt-agent-runs-stat-label">${label}</span>
            </div>`;

        const stats = document.createElement('div');
        stats.className = 'pdt-agent-runs-stats';
        stats.innerHTML = stat(totalLabel, M.usageSessions)
            + stat(usage.last7, M.usageLast7)
            + stat(usage.last30, M.usageLast30);
        wrap.appendChild(stats);

        wrap.appendChild(this._buildUsageSparkline(usage.daily));

        if (usage.byChannel.length) {
            const channels = document.createElement('div');
            channels.className = 'pdt-agent-usage-channels';
            usage.byChannel.forEach(entry => {
                const badge = document.createElement('span');
                badge.className = 'pdt-capi-badge pdt-capi-badge-action';
                badge.textContent = `${entry.channel}: ${entry.count}`;
                channels.appendChild(badge);
            });
            wrap.appendChild(channels);
        }

        return wrap;
    }

    /**
     * Builds a 14-day mini bar chart (sparkline) of session counts.
     * @param {Array<{date: string, count: number}>} daily
     * @returns {HTMLElement}
     * @private
     */
    _buildUsageSparkline(daily) {
        const max = Math.max(1, ...daily.map(point => point.count));
        const chart = document.createElement('div');
        chart.className = 'pdt-agent-usage-spark';
        daily.forEach(point => {
            const bar = document.createElement('div');
            bar.className = 'pdt-agent-usage-spark-bar';
            bar.style.height = `${Math.round((point.count / max) * 100)}%`;
            bar.title = `${point.date}: ${point.count}`;
            chart.appendChild(bar);
        });
        return chart;
    }

    /** Maximum depth the orchestration map will auto-expand connected agents to. */
    static get MAP_MAX_DEPTH() {
        return 3;
    }

    /**
     * Builds the empty Map panel host. Its content — a recursive orchestration graph rooted at this
     * agent, whose connected agents expand in place (lazy-loading their own structure) and can be
     * opened to navigate to them — is rendered on first Map-tab open (see {@link _buildDefinitionContainer}),
     * not here: building it auto-expands connected agents and fetches each child agent's components,
     * so deferring avoids that request burst when the user never opens the Map tab.
     * @returns {HTMLElement}
     * @private
     */
    _buildMapPanel() {
        const panel = document.createElement('div');
        panel.className = 'pdt-agent-def-panel pdt-agent-map';
        return panel;
    }

    /**
     * Renders one agent node (header + branches) into a container. Connected-agent branches are
     * expandable and recursive.
     * @param {HTMLElement} container
     * @param {Agent} agent
     * @param {AgentComponent[]} components
     * @param {Set<string>} visited - Agent ids already on this path (cycle guard).
     * @param {number} depth
     * @private
     */
    _renderMapNode(container, agent, components, visited, depth) {
        const M = Config.MESSAGES.AGENTS;
        const isActive = agent.statecode === 0;

        const isPublished = Boolean(agent.publishedOn);
        const node = document.createElement('div');
        node.className = 'pdt-agent-map-node';
        node.innerHTML = `
            <span class="pdt-agent-map-icon">${ICONS.agents}</span>
            <span class="pdt-agent-map-title">${escapeHtml(agent.name || '')}</span>
            <span class="pdt-status-badge pdt-agent-publish-badge ${isPublished ? 'published' : 'draft'}">${escapeHtml(isPublished ? M.publishStatePublished : M.publishStateDraft)}</span>
            ${agent.stateLabel ? `<span class="pdt-status-badge ${isActive ? 'active' : 'inactive'}">${escapeHtml(agent.stateLabel)}</span>` : ''}
        `;
        container.appendChild(node);

        const comps = components || [];
        const byKind = (kind) => comps.filter(c => getComponentKind(c) === kind);
        const rail = document.createElement('div');
        rail.className = 'pdt-agent-map-branches';

        [
            { label: M.mapTopics, items: byKind('topic') },
            { label: M.mapActions, items: byKind('action') },
            { label: M.mapKnowledge, items: byKind('knowledge') },
            { label: M.mapTriggers, items: byKind('trigger') }
        ].filter(b => b.items.length).forEach(b => rail.appendChild(this._buildMapBranch(b.label, b.items)));

        const connected = byKind('connectedAgent');
        if (connected.length) {
            const branch = document.createElement('div');
            branch.className = 'pdt-agent-map-branch';
            const label = document.createElement('div');
            label.className = 'pdt-agent-map-branch-label';
            label.textContent = `${M.mapConnectedAgents} (${connected.length})`;
            branch.appendChild(label);
            connected.forEach(comp => branch.appendChild(this._buildConnectedAgentNode(comp, visited, depth)));
            rail.appendChild(branch);
        }

        if (rail.children.length) {
            container.appendChild(rail);
        } else if (depth === 0) {
            const note = document.createElement('p');
            note.className = 'pdt-note';
            note.textContent = M.mapEmpty;
            container.appendChild(note);
        }
    }

    /**
     * Builds a simple (non-expandable) Map branch of chips.
     * @param {string} label
     * @param {AgentComponent[]} items
     * @returns {HTMLElement}
     * @private
     */
    _buildMapBranch(label, items) {
        const row = document.createElement('div');
        row.className = 'pdt-agent-map-branch';
        const lbl = document.createElement('div');
        lbl.className = 'pdt-agent-map-branch-label';
        lbl.textContent = `${label} (${items.length})`;
        const chips = document.createElement('div');
        chips.className = 'pdt-agent-map-chips';
        items.forEach(component => {
            const chip = document.createElement('span');
            chip.className = 'pdt-agent-map-chip';
            chip.textContent = component.name;
            const description = getComponentDescription(component);
            if (description) {
                chip.title = description;
            }
            chips.appendChild(chip);
        });
        row.append(lbl, chips);
        return row;
    }

    /**
     * Builds a connected-agent entry in the Map. When it resolves to a known published agent within
     * the depth limit, it is expandable (lazy-loads that agent's structure) and openable; otherwise
     * it is a chip (clickable to open if the agent is known).
     * @param {AgentComponent} component
     * @param {Set<string>} visited
     * @param {number} depth
     * @returns {HTMLElement}
     * @private
     */
    _buildConnectedAgentNode(component, visited, depth) {
        const M = Config.MESSAGES.AGENTS;
        const target = this._findConnectedAgent(component);
        const wrap = document.createElement('div');
        wrap.className = 'pdt-agent-map-subagent';

        const canExpand = target && !visited.has(target.id) && (depth + 1) <= AgentsTab.MAP_MAX_DEPTH;
        if (!canExpand) {
            const chip = document.createElement(target ? 'button' : 'span');
            chip.className = 'pdt-agent-map-chip';
            chip.textContent = component.name;
            if (target) {
                chip.type = 'button';
                chip.classList.add('pdt-agent-map-chip--link');
                chip.title = M.mapOpenAgent(component.name);
                chip.addEventListener('click', () => this._handleViewDefinition(target.id, target.name));
            } else {
                // No target. A connection carrying a botSchemaName points at a separate bot: when that
                // bot isn't in the environment the reference is orphaned (deleted / not imported), so
                // flag it. Otherwise it's a self-contained inline agent — just surface its description.
                const schema = extractConnectedAgentSchema(component);
                if (schema) {
                    chip.classList.add('pdt-agent-map-chip--unresolved');
                    chip.title = M.mapUnresolvedAgent(schema);
                } else {
                    const description = getComponentDescription(component);
                    if (description) {
                        chip.title = description;
                    }
                }
            }
            wrap.appendChild(chip);
            return wrap;
        }

        const header = document.createElement('div');
        header.className = 'pdt-agent-map-subagent-header';
        const expandBtn = document.createElement('button');
        expandBtn.type = 'button';
        expandBtn.className = 'pdt-agent-map-expand';
        expandBtn.textContent = `▸ ${component.name}`;
        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'modern-button secondary pdt-agent-map-open';
        openBtn.textContent = M.mapOpenAgent(component.name);
        openBtn.addEventListener('click', () => this._handleViewDefinition(target.id, target.name));
        header.append(expandBtn, openBtn);
        wrap.appendChild(header);

        const childContainer = document.createElement('div');
        childContainer.className = 'pdt-agent-map-children';
        childContainer.style.display = 'none';
        wrap.appendChild(childContainer);

        let loaded = false;
        const toggle = async (opening) => {
            childContainer.style.display = opening ? 'block' : 'none';
            expandBtn.textContent = `${opening ? '▾' : '▸'} ${component.name}`;
            if (opening && !loaded) {
                loaded = true;
                childContainer.innerHTML = `<p class="pdt-note">${M.loadingMap}</p>`;
                try {
                    const childComponents = await DataService.getAgentComponents(target.id);
                    childContainer.innerHTML = '';
                    this._renderMapNode(childContainer, target, childComponents, new Set([...visited, target.id]), depth + 1);
                } catch (e) {
                    childContainer.innerHTML = `<div class="pdt-error">${M.loadComponentsFailed(escapeHtml(e.message))}</div>`;
                }
            }
        };
        expandBtn.addEventListener('click', () => toggle(childContainer.style.display === 'none'));

        // Expand the top-level connected agents by default so the user sees the full picture on
        // open; deeper levels stay collapsed to avoid a network storm of component fetches.
        if (depth === 0) {
            toggle(true);
        }

        return wrap;
    }

    /**
     * Finds a cached agent by display name (case-insensitive).
     * @param {string} name
     * @returns {Agent|null}
     * @private
     */
    _findAgentByName(name) {
        const norm = String(name || '').trim().toLowerCase();
        if (!norm) {
            return null;
        }
        return (this.agents || []).find(a => String(a.name || '').trim().toLowerCase() === norm) || null;
    }

    /**
     * Finds a cached agent by schema name (case-insensitive).
     * @param {string} schemaName
     * @returns {Agent|null}
     * @private
     */
    _findAgentBySchema(schemaName) {
        const norm = String(schemaName || '').trim().toLowerCase();
        if (!norm) {
            return null;
        }
        const agents = this.agents || [];
        // Exact match first — modern ConnectedAgentTool references carry the full schema (suffix and
        // all), e.g. `cr297_hrassistant_czg8r6`.
        const exact = agents.find(a => String(a.schemaName || '').trim().toLowerCase() === norm);
        if (exact) {
            return exact;
        }
        // Legacy InvokeConnectedAgentTaskAction references drop the environment-specific `_<suffix>`
        // (e.g. `cr297_PowerToolkitAgentA` vs the real `cr297_powertoolkitagenta_ab12cd`). Fall back to
        // a boundary-safe prefix match in either direction (the `_` guard keeps `..._agent` from
        // matching `..._agent2`).
        return agents.find(a => {
            const cand = String(a.schemaName || '').trim().toLowerCase();
            return cand && (cand.startsWith(`${norm}_`) || norm.startsWith(`${cand}_`));
        }) || null;
    }

    /**
     * Resolves a connected-agent component to the child agent it points at: first by the
     * `botSchemaName` embedded in a `ConnectedAgentTool` (robust to renames/duplicate names), then by
     * the component's display name (legacy `.agent.` / `.InvokeConnectedAgentTaskAction.` connections).
     * @param {AgentComponent} component
     * @returns {Agent|null}
     * @private
     */
    _findConnectedAgent(component) {
        const schema = extractConnectedAgentSchema(component);
        // Resolve by (1) the embedded botSchemaName, then (2) the component's display name, then
        // (3) the `modelDisplayName` inside the data — the last bridges a legacy connection whose
        // component name drifted from the target after a rename (e.g. "Agent A" vs "Agent As").
        return (schema && this._findAgentBySchema(schema))
            || this._findAgentByName(component.name)
            || this._findAgentByName(extractConnectedAgentName(component));
    }

    /**
     * Builds the Overview panel (the agent's instructions). Legacy agents keep these in a Custom GPT
     * (type 15) component — editable in place when unmanaged. Modern agents keep them inline in the
     * bot `configuration` (`agentSettings.instructions`), shown read-only here (edit via Configuration).
     * @param {Agent} agent
     * @param {AgentComponent[]} components
     * @param {string|null} configuration - The bot configuration JSON.
     * @param {object|null} editor - Shared footer editor, or null when read-only.
     * @returns {HTMLElement}
     * @private
     */
    _buildOverviewPanel(agent, components, configuration, editor) {
        const M = Config.MESSAGES.AGENTS;
        const panel = document.createElement('div');
        // --fill lets the single instructions editor/code block grow to the dialog height.
        panel.className = 'pdt-agent-def-panel pdt-agent-def-panel--fill';

        const comp = (components || []).find(isInstructionsComponent);
        const componentInstructions = comp?.data || comp?.content || '';
        const configInstructions = extractAgentInstructions(configuration);

        const model = extractAgentModel(configuration);
        if (model) {
            const modelLine = document.createElement('p');
            modelLine.className = 'pdt-agent-model';
            modelLine.innerHTML = `<strong>${M.modelLabel}:</strong> ${escapeHtml(model)}`;
            panel.appendChild(modelLine);
        }

        const heading = document.createElement('div');
        heading.className = 'pdt-agent-def-heading';
        heading.textContent = M.instructionsHeading;
        panel.appendChild(heading);

        if (componentInstructions.trim() && comp) {
            // Legacy Custom GPT component — editable in place.
            const field = comp.data ? 'data' : 'content';
            panel.appendChild(this._buildEditableSection(componentInstructions, {
                editable: !comp.isManaged && !agent.isManaged,
                language: 'text',
                validateJson: false,
                onSave: (val) => DataService.updateAgentComponent(comp.id, field, val),
                editor
            }));
        } else if (configInstructions.trim()) {
            // Modern agent — instructions are nested in the bot configuration JSON
            // (agentSettings.instructions), not a separate component. Edit them in place when the
            // agent is unmanaged and every segment is plain text; instructions that embed a reference
            // segment (a VariableSegment) can't round-trip through a plain-text box, so those stay
            // read-only and are edited as raw configuration.
            const canEdit = !agent.isManaged && agentInstructionsEditable(configuration);
            const note = document.createElement('p');
            note.className = 'pdt-note pdt-agent-instructions-source';
            if (canEdit) {
                note.textContent = M.instructionsInConfig;
            } else if (!agent.isManaged) {
                note.textContent = M.instructionsHasReferences;
            } else {
                note.textContent = M.instructionsFromConfig;
            }
            panel.appendChild(note);
            // The instructions and the raw Configuration JSON are two views of the same bot
            // configuration, so the instructions box doesn't save on its own: it stays live-synced with
            // the Configuration editor (see {@link _wireInstructionSync}), and the one footer
            // Save / Save & Publish persists the config — so an edit here shows in the Configuration
            // tab immediately, and neither view goes stale.
            const section = this._buildEditableSection(configInstructions, {
                editable: canEdit,
                language: 'text',
                synced: canEdit
            });
            if (canEdit) {
                section.querySelector('textarea')?.classList.add('pdt-agent-instructions-sync');
            }
            panel.appendChild(section);
        } else {
            const note = document.createElement('p');
            note.className = 'pdt-note';
            note.textContent = M.noInstructions;
            panel.appendChild(note);
        }
        return panel;
    }

    /**
     * Builds the Components panel, grouping components by category.
     * @param {Agent} agent
     * @param {AgentComponent[]} components
     * @param {object|null} editor - Shared footer editor, or null when read-only.
     * @returns {HTMLElement}
     * @private
     */
    _buildComponentsPanel(agent, components, editor) {
        const M = Config.MESSAGES.AGENTS;
        const panel = document.createElement('div');
        panel.className = 'pdt-agent-def-panel';

        if (!components?.length) {
            const note = document.createElement('p');
            note.className = 'pdt-note';
            note.textContent = M.noComponents;
            panel.appendChild(note);
            return panel;
        }

        // Group by kind (instructions are shown on the Overview tab); sort each group by name.
        const groups = [
            { heading: M.topicsHeading, kind: 'topic' },
            { heading: M.connectedAgentsHeading, kind: 'connectedAgent' },
            { heading: M.actionsHeading, kind: 'action' },
            { heading: M.knowledgeHeading, kind: 'knowledge' },
            { heading: M.triggersHeading, kind: 'trigger' },
            { heading: M.testsHeading, kind: 'test' },
            { heading: M.otherComponentsHeading, kind: 'other' }
        ];

        groups.forEach(group => {
            const items = (components || [])
                .filter(c => getComponentKind(c) === group.kind)
                .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
            if (!items.length) {
                return;
            }
            const heading = document.createElement('div');
            heading.className = 'pdt-agent-def-heading';
            heading.textContent = `${group.heading} (${items.length})`;
            panel.appendChild(heading);
            items.forEach(item => panel.appendChild(this._buildComponentRow(agent, item, editor)));
        });

        return panel;
    }

    /**
     * Returns the display badge label for a component kind.
     * @param {string} kind
     * @returns {string}
     * @private
     */
    _kindLabel(kind) {
        const M = Config.MESSAGES.AGENTS;
        return {
            topic: M.kindTopic,
            action: M.kindAction,
            connectedAgent: M.kindConnectedAgent,
            knowledge: M.kindKnowledge,
            trigger: M.kindTrigger,
            test: M.kindTest
        }[kind] || M.kindOther;
    }

    /**
     * Builds a single expandable component row (payload editable when unmanaged).
     * @param {Agent} agent
     * @param {AgentComponent} component
     * @param {object|null} editor - Shared footer editor, or null when read-only.
     * @returns {HTMLElement}
     * @private
     */
    _buildComponentRow(agent, component, editor) {
        const M = Config.MESSAGES.AGENTS;
        const details = document.createElement('details');
        details.className = 'pdt-agent-component';

        const kind = getComponentKind(component);
        const summary = document.createElement('summary');
        summary.className = 'pdt-agent-component-summary';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'pdt-agent-component-name';
        nameSpan.textContent = component.name;

        const meta = document.createElement('span');
        meta.className = 'pdt-agent-component-meta';
        const kindBadge = document.createElement('span');
        kindBadge.className = 'pdt-capi-badge pdt-capi-badge-action';
        kindBadge.textContent = this._kindLabel(kind);
        meta.appendChild(kindBadge);

        // Status badge + activate/deactivate toggle (like Copilot Studio), for togglable components.
        const hasState = component.statecode === 0 || component.statecode === 1;
        const togglable = hasState && !component.isManaged
            && ['topic', 'action', 'connectedAgent', 'knowledge'].includes(kind);
        let statusBadge = null;
        if (hasState) {
            statusBadge = document.createElement('span');
            statusBadge.className = `pdt-status-badge ${component.statecode === 0 ? 'active' : 'inactive'}`;
            statusBadge.textContent = component.statecode === 0 ? M.componentStateOn : M.componentStateOff;
            meta.appendChild(statusBadge);
        }
        if (togglable) {
            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'modern-button secondary pdt-agent-component-toggle';
            toggleBtn.textContent = component.statecode === 0 ? M.componentDeactivate : M.componentActivate;
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._handleToggleComponent(component, toggleBtn, statusBadge);
            });
            meta.appendChild(toggleBtn);
        }

        summary.append(nameSpan, meta);
        details.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'pdt-agent-component-body';
        const description = getComponentDescription(component);
        if (description) {
            const desc = document.createElement('p');
            desc.className = 'pdt-agent-component-desc';
            desc.textContent = description;
            body.appendChild(desc);
        }
        // Evaluation test sets: surface the graders and their pass/fail labels (the definition is
        // same-origin) above the raw payload. Run scores are cross-origin, so we note that.
        if (kind === 'test') {
            const testEl = this._buildTestContent(component);
            if (testEl) {
                body.appendChild(testEl);
            }
        }

        const payload = component.data || component.content || '';
        if (payload.trim()) {
            const field = component.data ? 'data' : 'content';
            const language = this._looksLikeJson(payload) ? 'json' : 'text';
            // Pretty-print JSON so the editor shows readable, indented content rather than one
            // long minified line (read-only code blocks already format it themselves).
            const value = language === 'json' ? this._prettyJson(payload) : payload;
            body.appendChild(this._buildEditableSection(value, {
                editable: !component.isManaged && !agent.isManaged,
                language,
                validateJson: language === 'json',
                onSave: (val) => DataService.updateAgentComponent(component.id, field, val),
                editor
            }));
        }
        details.appendChild(body);
        return details;
    }

    /**
     * Builds the structured view for a Test Case component: an evaluation test-set summary (graders +
     * labels) or, for a multi-turn test case, its expected conversation. Returns null when the data is
     * neither recognizable shape (the raw payload is still shown separately).
     * @param {AgentComponent} component
     * @returns {HTMLElement|null}
     * @private
     */
    _buildTestContent(component) {
        const raw = component.data || component.content || '';
        const evalSet = parseEvaluationSet(raw);
        if (evalSet) {
            return this._buildEvaluationSummary(evalSet);
        }
        const evalCase = parseEvaluationCase(raw);
        return evalCase ? this._buildEvaluationCase(evalCase) : null;
    }

    /**
     * Builds a structured summary of an evaluation test set: each grader with its grading prompt and
     * a table of outcome labels (Pass/Fail). The definition is same-origin (Dataverse); the run
     * scores are served by the cross-origin Copilot Studio service, so a note points there.
     * @param {{graders: import('../services/AgentService.js').EvaluationGrader[]}} evalSet
     * @returns {HTMLElement}
     * @private
     */
    _buildEvaluationSummary(evalSet) {
        const M = Config.MESSAGES.AGENTS;
        const wrap = document.createElement('div');
        wrap.className = 'pdt-eval-summary';

        evalSet.graders.forEach(grader => {
            const g = document.createElement('div');
            g.className = 'pdt-eval-grader';

            const head = document.createElement('div');
            head.className = 'pdt-eval-grader-head';
            if (grader.name) {
                const name = document.createElement('span');
                name.className = 'pdt-eval-grader-name';
                name.textContent = grader.name;
                head.appendChild(name);
            }
            const kindBadge = document.createElement('span');
            kindBadge.className = 'pdt-capi-badge pdt-capi-badge-action';
            kindBadge.textContent = M.evalGraderKind(grader.kind);
            head.appendChild(kindBadge);
            g.appendChild(head);

            if (grader.instructions) {
                const instr = document.createElement('p');
                instr.className = 'pdt-note pdt-eval-instructions';
                instr.innerHTML = `<strong>${M.evalInstructionsLabel}:</strong> ${escapeHtml(grader.instructions)}`;
                g.appendChild(instr);
            }

            if (grader.labels.length) {
                const table = document.createElement('table');
                table.className = 'pdt-eval-labels';
                table.innerHTML = `
                    <thead><tr>
                        <th>${M.evalLabelHeader}</th>
                        <th>${M.evalDescriptionHeader}</th>
                        <th>${M.evalOutcomeHeader}</th>
                    </tr></thead>
                    <tbody>${grader.labels.map(l => {
        const pass = /^pass$/i.test(l.outcome);
        return `<tr>
                            <td>${escapeHtml(l.name)}</td>
                            <td>${escapeHtml(l.description)}</td>
                            <td><span class="pdt-status-badge ${pass ? 'active' : 'inactive'}">${escapeHtml(l.outcome)}</span></td>
                        </tr>`;
    }).join('')}</tbody>`;
                g.appendChild(table);
            } else {
                // Some graders (e.g. GeneralQualityGrader) score holistically with no pass/fail labels.
                const noLabels = document.createElement('p');
                noLabels.className = 'pdt-note pdt-eval-nolabels';
                noLabels.textContent = M.evalNoLabelsNote;
                g.appendChild(noLabels);
            }
            wrap.appendChild(g);
        });

        const note = document.createElement('p');
        note.className = 'pdt-note pdt-eval-note';
        note.textContent = M.evalResultsNote;
        wrap.appendChild(note);

        return wrap;
    }

    /**
     * Builds a readable view of an evaluation test case (a `MultiTurnEvaluationCase`): the expected
     * conversation as ordered User/Agent turns. The definition is same-origin; run scores live in the
     * Copilot Studio service.
     * @param {{turns: import('../services/AgentService.js').EvaluationCaseTurn[]}} evalCase
     * @returns {HTMLElement}
     * @private
     */
    _buildEvaluationCase(evalCase) {
        const M = Config.MESSAGES.AGENTS;
        const wrap = document.createElement('div');
        wrap.className = 'pdt-eval-case';

        const heading = document.createElement('div');
        heading.className = 'pdt-eval-case-heading';
        heading.textContent = M.evalCaseHeading;
        wrap.appendChild(heading);

        evalCase.turns.forEach(turn => wrap.appendChild(this._buildConversationTurn(turn)));

        const note = document.createElement('p');
        note.className = 'pdt-note pdt-eval-note';
        note.textContent = M.evalResultsNote;
        wrap.appendChild(note);

        return wrap;
    }

    /**
     * Builds one User/Agent conversation turn row. Shared by the evaluation-case view and the
     * transcript conversation view.
     * @param {{role: string, text: string}} turn
     * @returns {HTMLElement}
     * @private
     */
    _buildConversationTurn(turn) {
        const M = Config.MESSAGES.AGENTS;
        const isUser = /^user$/i.test(turn.role);
        const row = document.createElement('div');
        row.className = `pdt-eval-turn pdt-eval-turn--${isUser ? 'user' : 'agent'}`;
        const roleLabel = document.createElement('span');
        roleLabel.className = 'pdt-eval-turn-role';
        roleLabel.textContent = isUser ? M.evalRoleUser : M.evalRoleAgent;
        const textEl = document.createElement('span');
        textEl.className = 'pdt-eval-turn-text';
        textEl.textContent = turn.text;
        row.append(roleLabel, textEl);
        return row;
    }

    /**
     * Activates or deactivates a component and updates its row in place.
     * @param {AgentComponent} component
     * @param {HTMLButtonElement} toggleBtn
     * @param {HTMLElement|null} statusBadge
     * @private
     */
    async _handleToggleComponent(component, toggleBtn, statusBadge) {
        const M = Config.MESSAGES.AGENTS;
        const activate = component.statecode !== 0;
        try {
            toggleBtn.disabled = true;
            BusyIndicator.set();
            await DataService.setAgentComponentState(component.id, activate);
            component.statecode = activate ? 0 : 1;
            toggleBtn.textContent = activate ? M.componentDeactivate : M.componentActivate;
            if (statusBadge) {
                statusBadge.className = `pdt-status-badge ${activate ? 'active' : 'inactive'}`;
                statusBadge.textContent = activate ? M.componentStateOn : M.componentStateOff;
            }
            NotificationService.show(activate ? M.componentActivated : M.componentDeactivated, 'success');
        } catch (e) {
            NotificationService.show(M.componentStateFailed(escapeHtml(e.message)), 'error');
        } finally {
            toggleBtn.disabled = false;
            BusyIndicator.clear();
        }
    }

    /**
     * Builds the Configuration (JSON) panel (editable when the agent is unmanaged).
     * @param {Agent} agent
     * @param {string|null} configuration
     * @param {object|null} editor - Shared footer editor, or null when read-only.
     * @returns {HTMLElement}
     * @private
     */
    _buildConfigPanel(agent, configuration, editor) {
        const M = Config.MESSAGES.AGENTS;
        const panel = document.createElement('div');
        // --fill lets the single JSON editor/code block grow to the dialog height.
        panel.className = 'pdt-agent-def-panel pdt-agent-def-panel--fill';
        if (configuration && configuration.trim()) {
            panel.appendChild(this._buildEditableSection(this._prettyJson(configuration), {
                editable: !agent.isManaged,
                language: 'json',
                validateJson: true,
                onSave: (val) => DataService.updateAgentConfiguration(agent.id, val),
                editor
            }));
        } else {
            const note = document.createElement('p');
            note.className = 'pdt-note';
            note.textContent = M.noConfig;
            panel.appendChild(note);
        }
        return panel;
    }

    // ═══════════════════════════════════════════════════════════
    // TRANSCRIPTS VIEW
    // ═══════════════════════════════════════════════════════════

    /**
     * Builds the Transcripts panel for the agent definition dialog: a retention note and a list host
     * that is populated lazily (via {@link _loadTranscriptsInto}) the first time the sub-tab is opened.
     * Each row is a native `<details>` element that opens/closes on click — no separate toggle button.
     * @returns {HTMLElement}
     * @private
     */
    _buildTranscriptsPanel() {
        const M = Config.MESSAGES.AGENTS;
        const panel = document.createElement('div');
        panel.className = 'pdt-agent-def-panel';
        panel.innerHTML = `
            <div class="pdt-agent-def-heading">${M.transcriptsHeading}</div>
            <div class="pdt-agent-transcripts-list">
                <p class="pdt-note">${M.loadingTranscripts}</p>
            </div>
        `;
        return panel;
    }

    /**
     * Loads an agent's conversation transcripts into the given list element.
     * @param {string} botId - The agent (bot) GUID.
     * @param {HTMLElement|null} listEl - The list host to render into.
     * @returns {Promise<boolean>} True if the load completed (so it isn't retried), false on error.
     * @private
     */
    async _loadTranscriptsInto(botId, listEl) {
        const M = Config.MESSAGES.AGENTS;
        if (!listEl) {
            return true;
        }
        listEl.innerHTML = `<p class="pdt-note">${M.loadingTranscripts}</p>`;
        try {
            BusyIndicator.set();
            const transcripts = await DataService.getAgentTranscripts(botId);
            if (!transcripts?.length) {
                await this._renderEmptyTranscriptsNote(listEl);
            } else {
                this._renderTranscriptRows(transcripts, listEl);
            }
            return true;
        } catch (e) {
            listEl.innerHTML = `<div class="pdt-error">${M.loadTranscriptsFailed(escapeHtml(e.message))}</div>`;
            return false;
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Renders the transcripts empty-state as ONE note carrying the most likely reason. Reads the org
     * diagnostic settings to detect blocked recording; otherwise explains the environment-type and
     * retention caveats. Best-effort: on any failure it falls back to the generic reasons note.
     * @param {HTMLElement} listEl - The list host to render into.
     * @private
     */
    async _renderEmptyTranscriptsNote(listEl) {
        const M = Config.MESSAGES.AGENTS;
        let reason = M.transcriptsEmptyReasons;
        try {
            const { transcriptRecordingBlocked } = await DataService.getOrganizationDiagnostics();
            if (transcriptRecordingBlocked) {
                reason = M.transcriptsBlockedNote;
            }
        } catch {
            // Organization settings unavailable; keep the generic reasons note.
        }
        if (!listEl) {
            return;
        }
        listEl.innerHTML = `<p class="pdt-note pdt-agent-transcripts-reason">${reason}</p>`;
    }

    /**
     * Renders transcript rows (or an empty-state message).
     * @param {TranscriptSummary[]} transcripts
     * @param {HTMLElement} list - The list host to render into.
     * @private
     */
    _renderTranscriptRows(transcripts, list) {
        const M = Config.MESSAGES.AGENTS;
        if (!list) {
            return;
        }
        if (!transcripts?.length) {
            list.innerHTML = `<p class="pdt-note">${M.noTranscripts}</p>`;
            return;
        }
        const frag = document.createDocumentFragment();
        transcripts.forEach(t => frag.appendChild(this._buildTranscriptRow(t)));
        list.textContent = '';
        list.appendChild(frag);
    }

    /**
     * Builds an expandable `<details>` row for a single conversation transcript. The collapsed summary
     * leads with the conversation date (bold) and, beneath it, an at-a-glance meta line (turns ·
     * duration · locale), with the session badges (engagement, outcome, test-pane) and the source
     * badge trailing on the right — so the important facts are visible before expanding. The body (the
     * conversation and raw JSON) is built lazily on first expand from the content already loaded with
     * the list, so opening a row needs no extra fetch.
     * @param {TranscriptSummary} t
     * @returns {HTMLElement}
     * @private
     */
    _buildTranscriptRow(t) {
        const session = parseTranscriptSession(t.content);
        const details = document.createElement('details');
        details.className = 'pdt-agent-transcript-row';
        details.dataset.transcriptId = t.id;

        const summary = document.createElement('summary');
        const lead = document.createElement('div');
        lead.className = 'pdt-agent-transcript-summary-lead';
        const when = document.createElement('span');
        when.className = 'pdt-agent-transcript-when';
        when.textContent = t.startTime || t.createdOn || '—';
        lead.appendChild(when);
        const metaParts = this._transcriptMetaParts(session);
        if (metaParts.length) {
            const submeta = document.createElement('span');
            submeta.className = 'pdt-agent-transcript-submeta';
            submeta.textContent = metaParts.join(' · ');
            lead.appendChild(submeta);
        }
        summary.appendChild(lead);
        summary.appendChild(this._buildTranscriptBadges(session, t.schemaType));
        details.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'pdt-agent-transcript-body';
        details.appendChild(body);

        // Build the (potentially heavy) conversation + highlighted raw JSON only on first expand.
        let rendered = false;
        details.addEventListener('toggle', () => {
            if (!details.open || rendered) {
                return;
            }
            rendered = true;
            body.appendChild(this._buildTranscriptContent(t.content));
        });
        return details;
    }

    /**
     * Builds the badge group shown on the right of a transcript row's summary: the session's
     * engagement, outcome and test-pane badges (when the SessionInfo / ConversationInfo traces
     * supplied them) followed by the source-schema badge (e.g. powervirtualagents). Returns an
     * (often empty) container so the summary layout stays consistent whether or not a session yielded
     * any badges.
     * @param {import('../services/AgentService.js').TranscriptSession|null} session
     * @param {string} schemaType
     * @returns {HTMLElement}
     * @private
     */
    _buildTranscriptBadges(session, schemaType) {
        const M = Config.MESSAGES.AGENTS;
        const group = document.createElement('div');
        group.className = 'pdt-agent-transcript-summary-badges';
        const addBadge = (label, cls, title) => {
            const badge = document.createElement('span');
            badge.className = `pdt-capi-badge ${cls}`;
            badge.textContent = label;
            if (title) {
                badge.title = title;
            }
            group.appendChild(badge);
        };

        // Engagement is a SessionInfo fact — only assert it when that trace supplied a type. A 1 MB
        // batch split can leave a record with ConversationInfo but no SessionInfo (or vice versa), and
        // calling a busy first batch "Unengaged" just because SessionInfo lands in a later batch would
        // be wrong.
        if (session?.type) {
            addBadge(
                session.engaged ? M.transcriptSessionEngaged : M.transcriptSessionUnengaged,
                session.engaged ? 'pdt-capi-badge-action' : 'pdt-capi-badge-managed',
                session.engaged ? M.transcriptSessionEngagedTitle : M.transcriptSessionUnengagedTitle
            );
        }
        const outcome = session ? this._transcriptOutcomeBadge(session) : null;
        if (outcome) {
            addBadge(outcome.label, outcome.cls, outcome.title);
        }
        if (session?.isDesignMode) {
            addBadge(M.transcriptSessionTestPane, 'pdt-capi-badge-managed', M.transcriptSessionTestPaneTitle);
        }
        // Source (schema) is neutral metadata, not a status — keep it grey (the app's neutral badge
        // colour) so it never reads as a second success signal beside a green "Resolved" badge.
        if (schemaType) {
            addBadge(schemaType, 'pdt-capi-badge-managed');
        }
        return group;
    }

    /**
     * Assembles the at-a-glance meta parts for a transcript row (turn count, duration, locale) from
     * its session metadata. Each part is included only when known, so a session with partial timing
     * still yields a useful line. Pure.
     * @param {import('../services/AgentService.js').TranscriptSession|null} session
     * @returns {string[]}
     * @private
     */
    _transcriptMetaParts(session) {
        const M = Config.MESSAGES.AGENTS;
        if (!session) {
            return [];
        }
        const parts = [];
        if (session.turnCount !== null) {
            parts.push(M.transcriptTurns(session.turnCount));
        }
        const duration = this._formatDuration(session.startTime, session.endTime);
        if (duration && duration !== '0:00') {
            parts.push(duration);
        }
        if (session.locale) {
            parts.push(session.locale);
        }
        return parts;
    }

    /**
     * Builds the expanded body of a transcript: the conversation rendered as ordered User/Agent turns
     * (when the content is a readable Bot Framework activity log) with the raw pretty-printed JSON in a
     * collapsible section — or just the raw JSON when it is not. The session badges and meta live on
     * the row summary, so this body carries only the conversation and the raw JSON.
     * @param {string} content - The transcript `content` JSON.
     * @returns {HTMLElement}
     * @private
     */
    _buildTranscriptContent(content) {
        const M = Config.MESSAGES.AGENTS;
        const wrap = document.createElement('div');

        if (!content || !content.trim()) {
            wrap.innerHTML = `<p class="pdt-note">${M.transcriptEmpty}</p>`;
            return wrap;
        }

        const session = parseTranscriptSession(content);
        const conversation = parseTranscriptConversation(content);
        const rawBlock = UIFactory.createCopyableCodeBlock(this._prettyJson(content), 'json');

        // Neither a readable conversation nor session metadata — show the raw JSON on its own.
        if (!session && !conversation) {
            wrap.appendChild(rawBlock);
            return wrap;
        }

        if (conversation) {
            conversation.turns.forEach(turn => wrap.appendChild(this._buildConversationTurn(turn)));
        } else {
            // A session with no message turns — explain the empty conversation rather than leaving it
            // looking broken. Only call it "unengaged" when SessionInfo actually said so (an early
            // batch of a split transcript has no SessionInfo, so it falls back to the neutral note).
            const note = document.createElement('p');
            note.className = 'pdt-note pdt-agent-transcript-empty-note';
            note.textContent = session.type && !session.engaged
                ? M.transcriptSessionUnengagedNote
                : M.transcriptSessionNoMessages;
            wrap.appendChild(note);
        }

        const raw = document.createElement('details');
        raw.className = 'pdt-agent-raw-config';
        const rawSummary = document.createElement('summary');
        rawSummary.textContent = M.transcriptRawJson;
        raw.append(rawSummary, rawBlock);
        wrap.appendChild(raw);
        return wrap;
    }

    /**
     * Maps a session's outcome to a display badge, or null when there is no meaningful outcome (an
     * unengaged session always reports `None`).
     * @param {import('../services/AgentService.js').TranscriptSession} session
     * @returns {{label: string, cls: string, title: string}|null}
     * @private
     */
    _transcriptOutcomeBadge(session) {
        const M = Config.MESSAGES.AGENTS;
        const outcome = (session.outcome || '').toLowerCase();
        if (!outcome || outcome === 'none') {
            return null;
        }
        // A non-trivial reason (anything past the default "NoError") is worth surfacing as a tooltip.
        const reason = session.outcomeReason && session.outcomeReason.toLowerCase() !== 'noerror'
            ? session.outcomeReason
            : '';
        if (outcome === 'resolved') {
            const title = session.impliedSuccess === true ? M.transcriptOutcomeResolvedImpliedTitle
                : session.impliedSuccess === false ? M.transcriptOutcomeResolvedConfirmedTitle : '';
            return { label: M.transcriptOutcomeResolved, cls: 'pdt-capi-badge-function', title };
        }
        if (outcome === 'escalated') {
            return { label: M.transcriptOutcomeEscalated, cls: 'pdt-capi-badge-unmanaged', title: reason };
        }
        // Docs write the value as `Abandon`; the CSV export as `Abandoned` — accept both.
        if (outcome === 'abandoned' || outcome === 'abandon') {
            return { label: M.transcriptOutcomeAbandoned, cls: 'pdt-capi-badge-managed', title: reason };
        }
        return { label: session.outcome, cls: 'pdt-capi-badge-managed', title: reason };
    }

    // ═══════════════════════════════════════════════════════════
    // PROMPTS & MODELS VIEW
    // ═══════════════════════════════════════════════════════════

    /**
     * Renders the Prompts & Models sub-view shell and loads AI models.
     * @private
     */
    _renderPromptsView() {
        const M = Config.MESSAGES.AGENTS;
        this.ui.host.innerHTML = `
            <div class="pdt-toolbar flex-shrink-0">
                <select class="pdt-input pdt-agents-solution" data-scope="prompts" style="flex: 1;" aria-label="${M.solutionFilterAll}">
                    <option value="">${M.solutionFilterAll}</option>
                </select>
                <input type="text" class="pdt-input pdt-agents-search" data-scope="prompts"
                       placeholder="${M.promptSearchPlaceholder}" aria-label="${M.promptSearchPlaceholder}" style="flex: 1;">
                <button class="modern-button" data-action="refresh-prompts">${M.refresh}</button>
            </div>
            <div id="pdt-models-list" class="pdt-agents-list pdt-card-grid"></div>
        `;

        if (this.aiModels) {
            this._renderModelCards();
        } else {
            this._loadAiModels();
        }
    }

    /**
     * Loads AI Builder models from Dataverse and renders the cards.
     * @private
     */
    async _loadAiModels() {
        const M = Config.MESSAGES.AGENTS;
        const list = this.ui.host.querySelector('#pdt-models-list');
        if (!list) {
            return;
        }
        list.innerHTML = `<p class="pdt-note">${M.loadingModels}</p>`;
        try {
            BusyIndicator.set();
            this.aiModels = await DataService.getAiModels();
            this._renderModelCards();
        } catch (e) {
            list.innerHTML = `<div class="pdt-error">${M.loadModelsFailed(escapeHtml(e.message))}</div>`;
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Renders AI model cards (or an empty-state message).
     * @private
     */
    _renderModelCards() {
        const M = Config.MESSAGES.AGENTS;
        const list = this.ui.host.querySelector('#pdt-models-list');
        if (!list) {
            return;
        }
        if (!this.aiModels?.length) {
            list.innerHTML = `<p class="pdt-note">${M.noModels}</p>`;
            return;
        }
        const frag = document.createDocumentFragment();
        this.aiModels.forEach(model => frag.appendChild(this._createModelCard(model)));
        list.textContent = '';
        list.appendChild(frag);
        this._ensureSolutionsAndPopulate('prompts');
    }

    /**
     * Creates a card element for a single AI Builder model.
     * @param {AiModel} model
     * @returns {HTMLElement}
     * @private
     */
    _createModelCard(model) {
        const M = Config.MESSAGES.AGENTS;
        const card = document.createElement('div');
        card.className = 'pdt-agent-card pdt-card';
        card.dataset.modelId = model.id;
        // Real solution membership (resolved later from solutioncomponent).
        card.dataset.solutionIds = (model.solutionIds || []).join(' ');
        card.dataset.searchTerm = [
            model.name, model.stateLabel, model.template, model.kindLabel,
            model.configStatus?.status, model.owner
        ].join(' ').toLowerCase();
        card.dataset.modelName = model.name;
        card.dataset.managed = String(model.isManaged);

        const isActive = model.statecode === 1;
        const statusClass = isActive ? 'active' : 'inactive';
        const managedBadge = model.isManaged
            ? `<span class="pdt-capi-badge pdt-capi-badge-managed">${M.managedLabel}</span>`
            : `<span class="pdt-capi-badge pdt-capi-badge-unmanaged">${M.unmanagedLabel}</span>`;
        // Prompts and models live on separate pages in the maker portal and behave differently
        // (prompts are never trained), so the family is worth showing at a glance.
        const kindBadge = `<span class="pdt-capi-badge pdt-capi-badge-kind-${model.kind}">${escapeHtml(model.kindLabel)}</span>`;
        // The record's own state says nothing about whether the model works — the latest
        // configuration's status does (Live / Train failed / Draft / …).
        const configStatus = model.configStatus || {};
        const configBadge = configStatus.state
            ? `<span class="pdt-capi-badge pdt-capi-badge-config-${configStatus.state}">${escapeHtml(configStatus.state === 'live' ? M.configActive : configStatus.status || M.configUnknown)}</span>`
            : '';

        card.innerHTML = `
            <div class="pdt-card-header pdt-agent-header">
                <div class="pdt-agent-title-row">
                    <span class="pdt-agent-name">${escapeHtml(model.name)}</span>
                    <div class="pdt-agent-badges">
                        <span class="pdt-status-badge ${statusClass}">${escapeHtml(model.stateLabel)}</span>
                        ${configBadge}
                        ${kindBadge}
                        ${managedBadge}
                    </div>
                </div>
            </div>
            <div class="pdt-card-body">
                <div class="info-grid pdt-agent-info-grid">
                    <strong>ID:</strong><code class="copyable code-like" title="Click to copy" tabindex="0">${escapeHtml(model.id)}</code>
                    ${model.template ? `<strong>${M.templateLabel}:</strong><span>${escapeHtml(model.template)}</span>` : ''}
                    <strong>${M.publishedLabel}:</strong><span>${model.activeConfigId ? M.publishedYes : M.publishedNo}</span>
                    ${model.hasRetrain ? `<strong>${M.retrainLabel}:</strong><span>${M.retrainScheduled}</span>` : ''}
                    <strong>Owner:</strong><span>${escapeHtml(model.owner)}</span>
                    <strong>Created:</strong><span>${escapeHtml(model.createdOn)}</span>
                    <strong>Modified:</strong><span>${escapeHtml(model.modifiedOn)}</span>
                </div>
            </div>
            <div class="pdt-card-footer">
                <div class="pdt-agent-actions-group">
                    ${model.isManaged ? '' : `<button class="modern-button secondary pdt-capi-delete-hover" data-action="delete-model" title="${M.deleteModel}">${M.deleteModel}</button>`}
                    <button class="modern-button secondary" data-action="open-aibuilder" title="${M.openInAiBuilder}">${M.openInAiBuilder}</button>
                    <button class="modern-button secondary" data-action="view-model" title="${M.viewDetails}">${M.viewDetails}</button>
                </div>
            </div>
        `;
        return card;
    }

    /**
     * Deletes an unmanaged AI Builder model or prompt after confirmation, then removes its card.
     * @param {HTMLElement} card
     * @private
     */
    async _handleDeleteModel(card) {
        const M = Config.MESSAGES.AGENTS;
        if (!card) {
            return;
        }
        if (card.dataset.managed === 'true') {
            NotificationService.show(M.deleteModelManaged, 'warn');
            return;
        }
        const modelId = card.dataset.modelId;
        const modelName = card.dataset.modelName || '';
        const confirmed = await showConfirmDialog(M.deleteModelConfirmTitle, M.deleteModelConfirm(escapeHtml(modelName)));
        if (!confirmed) {
            return;
        }
        const deleteBtn = card.querySelector('[data-action="delete-model"]');
        if (deleteBtn) {
            deleteBtn.disabled = true;
        }
        try {
            BusyIndicator.set();
            await DataService.deleteAiModel(modelId);
            NotificationService.show(M.modelDeleted, 'success');
            this.aiModels = (this.aiModels || []).filter(m => m.id !== modelId);
            card.remove();
            if (!this.aiModels.length) {
                this._renderModelCards();
            }
        } catch (e) {
            NotificationService.show(M.deleteModelFailed(escapeHtml(e.message)), 'error');
            if (deleteBtn) {
                deleteBtn.disabled = false;
            }
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Opens a details dialog for an AI Builder model, including its definition/context.
     * @param {string} modelId
     * @param {string} [initialTab] - Tab to open instead of the first (e.g. 'evaluations' after a save).
     * @private
     */
    async _handleViewModel(modelId, initialTab = null) {
        const M = Config.MESSAGES.AGENTS;
        const model = this.aiModels?.find(m => m.id === modelId);
        if (!model) {
            return;
        }
        const container = document.createElement('div');
        container.className = 'pdt-agent-model-dialog';

        // Settings and Test are prompt-only. Settings edits the same live configuration as the
        // Definition tab (through the shared editor), so a change made in either — or in both — saves
        // in one click. Managed prompts are read-only, so they get no Settings tab.
        const isPrompt = model.kind === 'prompt';
        // Only the live version of an unmanaged prompt is editable; managed prompts are read-only.
        const editable = isPrompt && !model.isManaged;
        // One shared editor drives the footer Save/Undo for the live version (like the agent dialog).
        const editor = editable
            ? this._createPromptEditor((value) => this._publishPromptConfig(model, value))
            : null;
        const panels = {
            definition: this._buildPanel(`
                <div class="pdt-agent-def-heading">${M.modelContextHeading}</div>
                <div class="pdt-agent-model-context"><p class="pdt-note">${M.loadingDetails}</p></div>
            `, true),
            ...(editable ? { settings: this._buildPanel(`<p class="pdt-note">${M.loadingDetails}</p>`) } : {}),
            ...(isPrompt ? { test: this._buildPanel('') } : {}),
            runs: this._buildPanel(`<p class="pdt-note">${M.loadingRuns}</p>`),
            evaluations: this._buildPanel(`<p class="pdt-note">${M.loadingEvaluations}</p>`)
        };
        const labels = {
            definition: isPrompt ? M.tabPrompt : M.tabDefinition, settings: M.tabSettings, test: M.tabTest,
            runs: M.tabRuns, evaluations: M.tabEvaluations
        };

        const tabBar = document.createElement('div');
        tabBar.className = 'pdt-sub-tabs pdt-agent-def-tabs';
        tabBar.innerHTML = Object.keys(panels)
            .map((key, i) => `<button type="button" class="pdt-sub-tab${i === 0 ? ' active' : ''}" data-tab="${key}">${labels[key]}</button>`)
            .join('');

        const loaded = {};
        // The Settings controls are (re)synced from the live config each time the tab is shown, so
        // they reflect edits made in the Definition tab (and are rebuilt on reload).
        let settingsControls = null;
        const loaders = {
            settings: () => {
                settingsControls = this._renderPromptSettingsTab(panels.settings, editor);
            },
            test: () => this._renderQuickTestPanel(panels.test, model),
            runs: () => this._loadModelRuns(panels.runs, model),
            evaluations: () => this._loadEvaluations(panels.evaluations, model)
        };
        tabBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.pdt-sub-tab');
            if (!btn) {
                return;
            }
            tabBar.querySelectorAll('.pdt-sub-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            Object.entries(panels).forEach(([key, panel]) => {
                panel.style.display = key === tab ? 'block' : 'none';
            });
            if (loaders[tab] && !loaded[tab]) {
                loaded[tab] = true;
                loaders[tab]();
            } else if (tab === 'settings' && settingsControls) {
                settingsControls.sync(editor.getConfig());
            }
        });
        this._makeTabsAccessible(tabBar, panels);

        // Publishing a prompt mints a new version; reload the definition and any already-opened
        // lazy panel so the dialog reflects it without the user reopening the dialog.
        const reload = async () => {
            await this._loadModelDefinition(panels.definition.querySelector('.pdt-agent-model-context'), model, editor);
            for (const key of Object.keys(loaders)) {
                if (loaded[key]) {
                    await loaders[key]();
                }
            }
        };
        this._reloadOpenModel = reload;

        // A QuickTest writes a new msdyn_aievent, so the Runs list is now stale. Reload it if it is
        // open, otherwise drop its cached flag so it re-fetches the next time it is opened.
        this._refreshModelRuns = () => {
            if (loaded.runs) {
                // Already displayed — reload it now.
                loaders.runs();
            } else {
                // Not open yet — drop the cache flag so it re-fetches when next opened.
                loaded.runs = false;
            }
        };

        container.append(tabBar, ...Object.values(panels));
        // `undefined` (not '') so an unclassified model falls back to the default label rather than
        // rendering a bare ": name".
        const kindLabel = model.kindLabel ? escapeHtml(model.kindLabel) : undefined;
        DialogService.show(M.modelTitle(escapeHtml(model.name), kindLabel), container);
        // Footer order: Save as · Save · Undo · Close. Save/Undo come from the shared editor and are
        // dirty-aware (Undo is hidden until there are changes, so the clean footer reads
        // "Save as · Save · Close"); Save as always creates a copy. Close is DialogService's own button,
        // moved to the end so it stays on the right. Appending the existing Close node re-positions it.
        const footer = document.getElementById(Config.DIALOG_OVERLAY_ID)
            ?.querySelector(`.${Config.DIALOG_CLASSES.footer}`);
        if (footer) {
            const closeBtn = footer.querySelector(`.${Config.DIALOG_CLASSES.cancelBtn}`);
            const ordered = [];
            if (isPrompt) {
                ordered.push(this._buildSaveAsButton(model));
            }
            if (editor) {
                ordered.push(editor.saveBtn, editor.undoBtn);
            }
            if (closeBtn) {
                ordered.push(closeBtn);
            }
            footer.append(...ordered);
        }

        // Reopen straight onto a specific tab (e.g. Evaluations after editing criteria / deleting cases).
        if (initialTab) {
            tabBar.querySelector(`.pdt-sub-tab[data-tab="${initialTab}"]`)?.click();
        }

        await this._loadModelDefinition(panels.definition.querySelector('.pdt-agent-model-context'), model, editor);
    }

    /**
     * Builds the footer "Save as" button for a prompt.
     * @param {AiModel} model
     * @returns {HTMLElement}
     * @private
     */
    _buildSaveAsButton(model) {
        const M = Config.MESSAGES.AGENTS;
        const saveAs = document.createElement('button');
        saveAs.type = 'button';
        saveAs.className = 'modern-button secondary pdt-agent-saveas-btn';
        saveAs.textContent = M.saveAs;
        saveAs.addEventListener('click', () => this._handleSaveAsPrompt(model));
        return saveAs;
    }

    /**
     * Creates the shared editor that backs the model dialog's footer Save/Undo for a prompt's live
     * version. The prompt's configuration JSON is the single source of truth: the Definition tab's
     * textarea edits it directly, and the Settings tab's controls edit it through {@link applyConfig}
     * — so changes made in either tab land in the same config and one Save publishes them all. Both
     * surfaces stay in sync live via {@link onChange}. Save publishes, which mints a new version and
     * reloads, re-registering a fresh, clean textarea.
     * @param {(value: string) => Promise<void>} onSave - Publishes the edited configuration.
     * @returns {{saveBtn: HTMLButtonElement, undoBtn: HTMLButtonElement, register: Function, getConfig: Function, applyConfig: Function, onChange: Function}}
     * @private
     */
    _createPromptEditor(onSave) {
        const M = Config.MESSAGES.AGENTS;
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'modern-button secondary';
        saveBtn.textContent = M.save;
        saveBtn.disabled = true;
        const undoBtn = document.createElement('button');
        undoBtn.type = 'button';
        undoBtn.className = 'modern-button secondary';
        undoBtn.textContent = M.undo;
        undoBtn.style.display = 'none';

        /** @type {{textarea: HTMLTextAreaElement, original: string}|null} */
        let current = null;
        /** Callbacks (e.g. the Settings tab) notified whenever the config changes elsewhere. */
        let changeListeners = [];
        const notifyChange = () => {
            const config = current ? current.textarea.value : '';
            changeListeners.forEach(cb => cb(config));
        };
        const update = () => {
            const dirty = Boolean(current) && current.textarea.value !== current.original;
            saveBtn.className = dirty ? 'modern-button' : 'modern-button secondary';
            saveBtn.disabled = !dirty;
            undoBtn.style.display = dirty ? '' : 'none';
        };
        const setBusy = (busy) => {
            saveBtn.disabled = busy;
            undoBtn.disabled = busy;
        };

        saveBtn.addEventListener('click', async () => {
            if (!current || current.textarea.value === current.original) {
                return;
            }
            const value = current.textarea.value;
            try {
                JSON.parse(value);
            } catch {
                NotificationService.show(M.invalidJson, 'error');
                return;
            }
            setBusy(true);
            try {
                BusyIndicator.set();
                // onSave publishes then reloads, which re-registers a fresh (clean) textarea.
                await onSave(value);
                NotificationService.show(M.saved, 'success');
            } catch (e) {
                NotificationService.show(M.saveFailed(escapeHtml(e.message)), 'error');
            } finally {
                setBusy(false);
                update();
                BusyIndicator.clear();
            }
        });

        undoBtn.addEventListener('click', () => {
            if (!current) {
                return;
            }
            current.textarea.value = current.original;
            update();
            notifyChange();
        });

        return {
            saveBtn,
            undoBtn,
            /**
             * Registers the live version's config textarea as the canonical editable surface. Called
             * on every (re)render, so it also resets the change listeners for the new render cycle.
             * @param {HTMLTextAreaElement} textarea
             * @param {string} original
             */
            register(textarea, original) {
                current = { textarea, original };
                changeListeners = [];
                textarea.addEventListener('input', () => {
                    update();
                    notifyChange();
                });
                update();
            },
            /** @returns {string} The current configuration JSON. */
            getConfig() {
                return current ? current.textarea.value : '';
            },
            /**
             * Replaces the configuration (used by the Settings tab), marking the editor dirty and
             * notifying the other surface.
             * @param {string} value
             */
            applyConfig(value) {
                if (!current) {
                    return;
                }
                current.textarea.value = value;
                update();
                notifyChange();
            },
            /**
             * Subscribes to config changes made in the other surface, so this one can re-sync.
             * @param {(config: string) => void} callback
             */
            onChange(callback) {
                changeListeners.push(callback);
            }
        };
    }

    /**
     * Opens the "Save as" name dialog for a prompt. Copying happens only on confirm.
     * @param {AiModel} model
     * @private
     */
    _handleSaveAsPrompt(model) {
        const M = Config.MESSAGES.AGENTS;
        const content = document.createElement('div');
        content.className = 'pdt-dialog-prompt';
        const label = document.createElement('label');
        label.textContent = M.saveAsLabel;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'pdt-input';
        input.value = M.saveAsDefault(model.name);
        content.append(label, input);

        DialogService.show(M.saveAsTitle, content, (container) => {
            const name = container.querySelector('input').value.trim();
            if (!name) {
                NotificationService.show(M.saveAsNameRequired, 'warn');
                return false; // keep the dialog open
            }
            this._copyPrompt(model, name);
            return true;
        }, { okText: M.save, cancelText: M.cancel });
    }

    /**
     * Copies a prompt under a new name (AI Builder's "Save as") and refreshes the list so the copy
     * shows up.
     * @param {AiModel} model
     * @param {string} name
     * @private
     */
    async _copyPrompt(model, name) {
        const M = Config.MESSAGES.AGENTS;
        try {
            BusyIndicator.set();
            const def = await DataService.getAiModelDefinition(model.id, model.activeConfigId);
            const entry = this._findPromptConfig(def.configurations);
            if (!entry) {
                NotificationService.show(M.noPromptSettings, 'warn');
                return;
            }
            await DataService.saveAsAiPrompt(model, name, entry.text);
            NotificationService.show(M.saveAsDone(name), 'success');
            this.aiModels = null;
            this._loadAiModels();
        } catch (e) {
            NotificationService.show(M.saveAsFailed(escapeHtml(e.message)), 'error');
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Builds one panel of the model dialog. Only the first panel starts visible.
     * @param {string} html - Initial panel markup.
     * @param {boolean} [visible=false]
     * @returns {HTMLElement}
     * @private
     */
    _buildPanel(html, visible = false) {
        const panel = document.createElement('div');
        panel.className = 'pdt-agent-def-panel';
        panel.innerHTML = html;
        if (!visible) {
            panel.style.display = 'none';
        }
        return panel;
    }

    // ═══════════════════════════════════════════════════════════
    // PROMPT SETTINGS CONTROLS (editable, wired to the config editor)
    // ═══════════════════════════════════════════════════════════

    /**
     * Picks the configuration a prompt's tests act on: the live one when the model has been
     * published, otherwise the newest iteration that carries a prompt.
     * @param {import('../services/AgentService.js').AiConfiguration[]} configurations
     * @returns {{config: import('../services/AgentService.js').AiConfiguration, text: string}|null}
     * @private
     */
    _findPromptConfig(configurations = []) {
        const withPrompt = configurations
            .map(config => ({
                config,
                text: config.sections.find(s => s.column === 'msdyn_customconfiguration')?.text || ''
            }))
            .filter(entry => extractPromptMetadata(entry.text));
        return withPrompt.find(entry => entry.config.isActive) || withPrompt[0] || null;
    }

    /**
     * Builds the friendly settings controls for a prompt (temperature, record limit, moderation,
     * record links, code interpreter). They are a convenience view of the configuration JSON: the
     * grid does not save on its own — {@link readSettings} exposes the current values so the caller
     * can fold them into the JSON, and {@link sync} refreshes the controls from a JSON string (used
     * on Undo).
     * @param {string} configText - The prompt configuration JSON to seed the controls from.
     * @returns {{el: HTMLElement, readSettings: Function, sync: Function}}
     * @private
     */
    _buildPromptSettingsControls(configText) {
        const M = Config.MESSAGES.AGENTS;
        const grid = document.createElement('div');
        grid.className = 'pdt-agent-settings';
        const temperatures = Array.from({ length: 11 }, (_, i) => (i / 10).toFixed(1));
        const recordLimits = Array.from({ length: 98 }, (_, i) => String(30 + i * 10));
        const selectRow = (id, setting, label, hint, options) => `
            <div class="pdt-setting-row">
                <div class="pdt-setting-label">
                    <label for="${id}">${label}</label>
                    <span class="pdt-setting-hint">${hint}</span>
                </div>
                <select id="${id}" class="pdt-input" data-setting="${setting}">
                    ${options.map(v => `<option value="${v}">${v}</option>`).join('')}
                </select>
            </div>`;
        const toggleRow = (id, setting, label, hint) => `
            <div class="pdt-setting-row">
                <div class="pdt-setting-label">
                    <label for="${id}">${label}</label>
                    <span class="pdt-setting-hint">${hint}</span>
                </div>
                <label class="pdt-toggle-switch" title="${label}">
                    <input type="checkbox" id="${id}" data-setting="${setting}">
                    <span class="pdt-toggle-slider"></span>
                </label>
            </div>`;
        grid.innerHTML = `
            <div class="pdt-setting-group">
                <div class="pdt-setting-group-title">${M.settingsGroupBehaviour}</div>
                ${selectRow('pdt-prompt-temperature', 'temperature', M.promptTemperature, M.promptTemperatureHint, temperatures)}
                ${selectRow('pdt-prompt-moderation', 'contentModerationLevel', M.promptModeration, M.promptModerationHint, ['Low', 'Moderate', 'High'])}
            </div>
            <div class="pdt-setting-group">
                <div class="pdt-setting-group-title">${M.settingsGroupGrounding}</div>
                ${selectRow('pdt-prompt-records', 'recordRetrievalLimit', M.promptRecordLimit, M.promptRecordLimitHint, recordLimits)}
                ${toggleRow('pdt-prompt-links', 'preserveRecordLinks', M.promptRecordLinks, M.promptRecordLinksHint)}
            </div>
            <div class="pdt-setting-group">
                <div class="pdt-setting-group-title">${M.settingsGroupAdvanced}</div>
                ${toggleRow('pdt-prompt-code', 'codeInterpreter', M.promptCodeInterpreter, M.promptCodeInterpreterHint)}
            </div>
        `;
        const control = (setting) => grid.querySelector(`[data-setting="${setting}"]`);

        const sync = (text) => {
            const meta = extractPromptMetadata(text) || {};
            control('temperature').value = (meta.temperature ?? 0).toFixed(1);
            control('recordRetrievalLimit').value = String(meta.recordRetrievalLimit ?? 30);
            control('contentModerationLevel').value = meta.contentModerationLevel || 'High';
            control('preserveRecordLinks').checked = Boolean(meta.preserveRecordLinks);
            control('codeInterpreter').checked = Boolean(meta.codeInterpreter);
        };
        sync(configText);

        const readSettings = () => ({
            temperature: Number(control('temperature').value),
            recordRetrievalLimit: Number(control('recordRetrievalLimit').value),
            contentModerationLevel: control('contentModerationLevel').value,
            preserveRecordLinks: control('preserveRecordLinks').checked,
            codeInterpreter: control('codeInterpreter').checked
        });

        return { el: grid, readSettings, sync };
    }

    // ═══════════════════════════════════════════════════════════
    // QUICK TEST
    // ═══════════════════════════════════════════════════════════

    /**
     * Renders the Test panel: a Run button that executes the prompt through QuickTest without
     * saving it, plus the output and what the run cost.
     * @param {HTMLElement} panel
     * @param {AiModel} model
     * @private
     */
    async _renderQuickTestPanel(panel, model) {
        const M = Config.MESSAGES.AGENTS;
        panel.innerHTML = `<p class="pdt-note">${M.loadingDetails}</p>`;
        let entry = null;
        try {
            const def = await DataService.getAiModelDefinition(model.id, model.activeConfigId);
            entry = this._findPromptConfig(def.configurations);
        } catch {
            // Fall through to the empty state below.
        }
        if (!entry) {
            panel.innerHTML = `<p class="pdt-note">${M.noPromptSettings}</p>`;
            return;
        }

        // A code-interpreter prompt can be re-tested with its already-generated code (faster, and
        // deterministic) — enabled once we have code, either stored on the config or from a run.
        const meta = extractPromptMetadata(entry.text);
        let lastReuse = meta?.code ? { code: meta.code, signature: meta.signature } : null;

        panel.innerHTML = `
            <div class="pdt-prompt-test-hero">
                <div class="pdt-prompt-test-hero-text">
                    <span class="pdt-prompt-card-title">${M.testHeading}</span>
                </div>
                <div class="pdt-agent-edit-actions pdt-prompt-test-actions">
                    <button type="button" class="modern-button" data-action="run-quick-test">${M.testRun}</button>
                    <button type="button" class="modern-button secondary" data-action="run-quick-test-reuse"${lastReuse ? '' : ' style="display:none"'} title="${M.testReuseHint}">${M.testReuse}</button>
                </div>
            </div>
            <div class="pdt-agent-test-runs pdt-agent-runs-list">
                <p class="pdt-note pdt-prompt-test-empty">${M.testEmpty}</p>
            </div>
        `;

        // When the prompt declares input variables, testing it means supplying a value for each — the
        // same values a live request (or a saved test case) would pass. Render a field per input and
        // feed the collected {id: value} map into the run, so the prompt is tested as it actually runs
        // rather than with empty {tokens}.
        const inputDefs = this._parsePromptInputs(entry.text);
        const inputFields = new Map();
        if (inputDefs.length) {
            panel.querySelector('.pdt-agent-test-runs')
                .before(this._buildQuickTestInputs(inputDefs, inputFields, Boolean(meta?.codeInterpreter)));
        }
        const collectInputs = async () => {
            if (!inputFields.size) {
                return null;
            }
            this._assertPromptFilesWithinLimit(inputFields);
            const values = {};
            for (const [id, field] of inputFields) {
                const value = await this._readPromptInputValue(field);
                if (value !== undefined) {
                    values[id] = value;
                }
            }
            return values;
        };

        // The generated Python is planned around the values it first ran with, so it is kept while
        // those stay the same and asked for afresh once they change — the maker portal's behaviour.
        // Re-picking the same file counts as unchanged, as it does there.
        let codeBasis = null;

        const runBtn = panel.querySelector('[data-action="run-quick-test"]');
        const reuseBtn = panel.querySelector('[data-action="run-quick-test-reuse"]');

        // Both buttons are held for the whole operation, reading the file included. Every run costs
        // credits, and encoding a large document takes long enough for a second click to land before
        // the request is even sent.
        let inFlight = false;
        const run = async (button, reuse) => {
            if (inFlight) {
                return;
            }
            inFlight = true;
            runBtn.disabled = true;
            reuseBtn.disabled = true;
            try {
                let inputs;
                try {
                    inputs = await collectInputs();
                } catch (e) {
                    // Running anyway would report a result as if the file had been supplied.
                    NotificationService.show(e.message, 'warn');
                    return;
                }
                const basis = this._promptInputsFingerprint(inputFields);
                const regenerate = !reuse && codeBasis !== null && basis !== codeBasis;
                codeBasis = basis;
                const result = await this._handleQuickTest(button, panel, entry, reuse, inputs, regenerate);
                // A run that generated code makes "without regenerating" available (and refreshes
                // what it will reuse).
                if (result?.succeeded && result.code) {
                    lastReuse = { code: result.code, signature: result.signature };
                    reuseBtn.style.display = '';
                }
            } finally {
                inFlight = false;
                runBtn.disabled = false;
                reuseBtn.disabled = false;
            }
        };
        runBtn.addEventListener('click', (e) => run(e.currentTarget, null));
        reuseBtn.addEventListener('click', (e) => run(e.currentTarget, lastReuse));
    }

    /**
     * Parses a prompt configuration's declared input variables, keeping each input's id (the key a
     * QuickTest request expects) alongside its friendly label, declared type, and saved sample data.
     *
     * The type matters because only a text input can be satisfied by typing: an `image`/`document`
     * input takes a file. `quickTestValue` is the "Sample data" the author saved in the maker portal,
     * so the test form can start from it rather than making the value be retyped.
     * Power Fx lives in `definitions.formulas`, not here, and is computed server-side — so it
     * correctly never appears as a field to fill.
     * @param {string} configText - The GptDynamicPrompt configuration JSON.
     * @returns {Array<{id: string, label: string, type: string, sample: string}>} The declared
     *   inputs, or [] when there are none.
     * @private
     */
    _parsePromptInputs(configText) {
        try {
            const inputs = JSON.parse(configText)?.definitions?.inputs;
            return (Array.isArray(inputs) ? inputs : [])
                .filter(input => input && input.id)
                .map(input => ({
                    id: input.id,
                    label: input.text || input.id,
                    type: String(input.type || 'text').toLowerCase(),
                    sample: typeof input.quickTestValue === 'string' ? input.quickTestValue : ''
                }));
        } catch {
            return [];
        }
    }

    /**
     * Rejects a run whose files exceed what AI Builder accepts.
     *
     * The documented limit is 25 MB across **all** files on the prompt, so the sizes are totalled
     * rather than checked one by one. Checked before anything is read, so an impossible run fails
     * immediately instead of after base64-encoding megabytes.
     * @param {Map<string, HTMLInputElement>} fields - The test form's controls, by input id.
     * @throws {Error} When the chosen files are too large together.
     * @private
     */
    _assertPromptFilesWithinLimit(fields) {
        const M = Config.MESSAGES.AGENTS;
        const files = [...fields.values()]
            .filter(field => field.type === 'file')
            .map(field => field.files?.[0])
            .filter(Boolean);

        const total = files.reduce((sum, file) => sum + file.size, 0);
        if (total <= MAX_PROMPT_TEST_FILE_BYTES) {
            return;
        }
        throw new Error(files.length === 1
            ? M.testInputFileTooLarge(files[0].name)
            : M.testInputFilesTooLarge(files.length));
    }

    /**
     * Fingerprints the values a test run is about to use, to tell an unchanged run from a new one.
     *
     * A file is identified by name and size rather than its bytes: re-picking the same file must
     * read as unchanged (it does in the maker portal), and hashing megabytes on every run to learn
     * the same thing would be wasteful.
     * @param {Map<string, HTMLInputElement>} fields - The test form's controls, by input id.
     * @returns {string}
     * @private
     */
    _promptInputsFingerprint(fields) {
        return [...fields].map(([id, field]) => {
            if (field.type !== 'file') {
                return `${id}=${field.value}`;
            }
            const file = field.files?.[0];
            return file ? `${id}=${file.name}:${file.size}` : `${id}=`;
        }).join('|');
    }

    /**
     * Builds the file picker for an image/document test input.
     *
     * The native control is hidden and driven by a toolkit button, so it matches every other
     * control in the panel instead of rendering the browser's own widget. The chosen name sits on
     * the left with the actions on the right, and a chosen file can be cleared again — otherwise
     * the only way to undo a mis-pick would be to close the dialog.
     * @param {{id: string, label: string, type: string}} def - The parsed input definition.
     * @param {string} fieldId - Unique id for the underlying control.
     * @param {Map<string, HTMLInputElement>} fieldMap - Receives the underlying file input.
     * @param {boolean} [codeInterpreter=false] - Whether the prompt runs the code interpreter, which
     *   is what makes Word/Excel/PowerPoint readable; without it only images and PDF are offered.
     * @returns {HTMLElement}
     * @private
     */
    _buildPromptFilePicker(def, fieldId, fieldMap, codeInterpreter = false) {
        const M = Config.MESSAGES.AGENTS;
        const container = document.createElement('div');
        container.className = 'pdt-file-upload-container pdt-prompt-test-file';
        container.title = codeInterpreter ? M.testInputFileHintCode : M.testInputFileHint;
        // Names the whole picker, so "Choose file" is announced against the input it belongs to
        // rather than on its own — a prompt can declare several file inputs.
        container.setAttribute('role', 'group');
        container.setAttribute('aria-label', def.label);

        const picker = document.createElement('input');
        picker.type = 'file';
        picker.id = fieldId;
        picker.className = 'pdt-file-input';
        picker.accept = codeInterpreter ? M.testInputFileAcceptCode : M.testInputFileAccept;
        picker.hidden = true;

        const name = document.createElement('span');
        name.className = 'pdt-file-name';
        name.textContent = M.testInputFileNone;

        const choose = document.createElement('button');
        choose.type = 'button';
        choose.className = 'modern-button secondary pdt-file-select-btn';
        choose.textContent = M.testInputFileChoose;

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'modern-button secondary pdt-prompt-test-file-remove';
        remove.textContent = '✕';
        remove.title = M.testInputFileRemove;
        remove.setAttribute('aria-label', M.testInputFileRemove);
        remove.hidden = true;

        const render = () => {
            const file = picker.files?.[0];
            name.textContent = file ? file.name : M.testInputFileNone;
            choose.textContent = file ? M.testInputFileReplace : M.testInputFileChoose;
            remove.hidden = !file;
        };

        choose.addEventListener('click', () => picker.click());
        picker.addEventListener('change', render);
        remove.addEventListener('click', () => {
            picker.value = '';
            render();
            // Removing hides this button, so focus would otherwise fall back to the document body.
            choose.focus();
        });

        container.append(picker, name, choose, remove);
        fieldMap.set(def.id, picker);
        return container;
    }

    /**
     * Reads one test input's value in the shape QuickTest expects.
     *
     * A file is sent inline as base64. An empty picker yields `undefined` so the input is left out
     * of the request entirely rather than claiming an empty document was supplied.
     * @param {HTMLInputElement} field - The input's control.
     * @returns {Promise<string|{base64Encoded: string}|undefined>}
     * @throws {Error} When the file is too large or cannot be read.
     * @private
     */
    async _readPromptInputValue(field) {
        const M = Config.MESSAGES.AGENTS;
        if (field.type !== 'file') {
            return field.value;
        }

        const file = field.files?.[0];
        if (!file) {
            return undefined;
        }

        try {
            return { base64Encoded: await readBase64File(file) };
        } catch {
            throw new Error(M.testInputFileFailed(file.name));
        }
    }

    /**
     * Reports whether an input's value can be supplied by typing.
     *
     * Anything else is a file input (`document` covers images too, per the maker portal's single
     * "Image or document" choice), which a text box cannot express.
     * @param {{type: string}} def - A parsed input definition.
     * @returns {boolean}
     * @private
     */
    _isTypedPromptInput(def) {
        return def.type !== 'document' && def.type !== 'image';
    }

    /**
     * Builds the interactive test's input form: one row per declared input variable.
     *
     * Only a text input gets a field, registered in {@link fieldMap} (input id → element) so the
     * caller can collect the values into the {id: value} map QuickTest spreads into the request. A
     * file input is shown but left unregistered — a text box could not carry a PDF, and sending an
     * empty string in its place would claim a document was supplied when none was.
     * @param {Array<{id: string, label: string, type: string, sample: string}>} inputDefs
     * @param {Map<string, HTMLInputElement>} fieldMap - Populated with each typed input's field.
     * @param {boolean} [codeInterpreter=false] - Whether the prompt runs the code interpreter, which
     *   widens the file types a file input accepts.
     * @returns {HTMLElement}
     * @private
     */
    _buildQuickTestInputs(inputDefs, fieldMap, codeInterpreter = false) {
        const M = Config.MESSAGES.AGENTS;
        const card = document.createElement('section');
        card.className = 'pdt-prompt-card pdt-prompt-test-inputs';
        card.innerHTML = `
            <div class="pdt-prompt-card-head">
                <span class="pdt-prompt-card-title">${M.testInputsTitle}</span>
                <span class="pdt-prompt-card-hint">${M.testInputsHint}</span>
            </div>
        `;
        const list = document.createElement('div');
        list.className = 'pdt-prompt-test-input-list';
        inputDefs.forEach((def, i) => {
            list.appendChild(this._buildQuickTestInputRow(def, `pdt-test-input-${i}`, fieldMap, codeInterpreter));
        });
        card.appendChild(list);
        return card;
    }

    /**
     * Builds one row of the test input form — a labelled field for a text input, or a file picker
     * for an image/document one.
     * @param {{id: string, label: string, type: string, sample: string}} def
     * @param {string} fieldId - Unique id tying the label to its control.
     * @param {Map<string, HTMLInputElement>} fieldMap - Populated with the input's control.
     * @param {boolean} [codeInterpreter=false] - Widens the file types a file input accepts.
     * @returns {HTMLElement}
     * @private
     */
    _buildQuickTestInputRow(def, fieldId, fieldMap, codeInterpreter = false) {
        const M = Config.MESSAGES.AGENTS;
        const row = document.createElement('div');
        row.className = 'pdt-prompt-test-input-row';

        const label = document.createElement('label');
        label.className = 'pdt-prompt-test-input-label';
        label.setAttribute('for', fieldId);
        label.textContent = def.label;

        if (!this._isTypedPromptInput(def)) {
            const badge = document.createElement('span');
            badge.className = 'pdt-badge-small';
            badge.textContent = M.testInputTypeBadge(def.type);
            label.appendChild(badge);
            // The file input it would point at is hidden, so `for` would target something outside
            // the accessibility tree. The picker names itself as a group instead.
            label.removeAttribute('for');
            row.append(label, this._buildPromptFilePicker(def, fieldId, fieldMap, codeInterpreter));
            return row;
        }

        const field = document.createElement('input');
        field.type = 'text';
        field.id = fieldId;
        field.className = 'pdt-input pdt-prompt-test-input-field';
        field.placeholder = M.testInputPlaceholder;
        if (def.sample) {
            field.value = def.sample;
            field.title = M.testInputSampleTitle;
        }
        row.append(label, field);
        fieldMap.set(def.id, field);
        return row;
    }

    /**
     * Runs QuickTest and prepends the result as a new row to the test-run log, so runs accumulate
     * and can be compared across prompt tweaks (each keeps its own output, code, logs and plan)
     * rather than replacing the previous one.
     * @param {HTMLButtonElement} button
     * @param {HTMLElement} panel
     * @param {{config: import('../services/AgentService.js').AiConfiguration, text: string}} entry
     * @param {{code: string, signature: string}|null} [reuse] - Code to run without regenerating.
     * @param {Object.<string, string|{base64Encoded: string}>|null} [inputs] - Input-variable values
     *   for a prompt that declares inputs, spread into the request so it runs with those values.
     * @param {boolean} [regenerate=false] - Ask for fresh code because the input values changed.
     * @returns {Promise<import('../services/AgentService.js').QuickTestResult|null>}
     * @private
     */
    async _handleQuickTest(button, panel, entry, reuse = null, inputs = null, regenerate = false) {
        const M = Config.MESSAGES.AGENTS;
        const list = panel.querySelector('.pdt-agent-test-runs');
        button.disabled = true;
        // Show "Running…" in the results area — where the empty-state hint sits, and where the output
        // will land — so it's the primary feedback. The persistent guidance lives in the hero hint
        // above, so replacing the empty-state here loses nothing. On a later run (results already
        // present) the note leads the list. It is removed once the run resolves.
        const running = document.createElement('p');
        running.className = 'pdt-note pdt-prompt-test-running';
        running.textContent = M.testRunning;
        const empty = list.querySelector('.pdt-prompt-test-empty');
        if (empty) {
            empty.replaceWith(running);
        } else {
            list.prepend(running);
        }
        try {
            BusyIndicator.set();
            const result = await DataService.quickTestAiConfiguration(entry.config.id, entry.text, reuse, inputs, regenerate);
            // Collapse the previous run so the newest is the one expanded.
            list.querySelectorAll('details[open]').forEach(d => {
                d.open = false;
            });
            list.prepend(this._buildQuickTestRow(result, Boolean(reuse)));
            // The test was recorded as a run — refresh the Runs tab so it isn't left stale.
            if (result.succeeded) {
                this._refreshModelRuns?.();
            }
            return result;
        } catch (e) {
            list.prepend(this._buildQuickTestRow({ succeeded: false, error: e.message }, Boolean(reuse)));
            return null;
        } finally {
            running.remove();
            button.disabled = false;
            BusyIndicator.clear();
        }
    }

    /**
     * Builds one expandable row for a QuickTest run: a timestamped summary, the output, a metrics
     * grid (model, tokens, credits), and collapsible sections for whatever the runtime returned —
     * the code interpreter's generated code, its execution logs and plan, a reasoning model's
     * thought steps, and the grounding data the run read.
     * @param {import('../services/AgentService.js').QuickTestResult} result
     * @param {boolean} [reused=false] - True when the run reused code instead of regenerating.
     * @returns {HTMLElement}
     * @private
     */
    _buildQuickTestRow(result, reused = false) {
        const M = Config.MESSAGES.AGENTS;
        const row = document.createElement('details');
        row.className = 'pdt-agent-run-row';
        row.open = true;

        const summary = document.createElement('summary');
        const when = new Date().toLocaleTimeString();
        const statusBadge = result.succeeded
            ? `<span class="pdt-capi-badge pdt-capi-badge-action">${M.runQuickTest}</span>`
            : `<span class="pdt-capi-badge pdt-capi-badge-failed">${M.testFailedBadge}</span>`;
        // Timestamp anchors the left; the finish reason and credits then the status badge(s) group on
        // the right, so the type badge is the trailing pill (e.g. "10:32 AM   stop   QUICK TEST").
        summary.innerHTML = `
            <span class="pdt-agent-run-when">${escapeHtml(when)}</span>
            ${result.succeeded && result.finishReason ? `<span class="pdt-agent-run-status">${escapeHtml(result.finishReason)}</span>` : ''}
            ${result.succeeded && result.credits !== null ? `<span class="pdt-agent-run-feature">${M.testCreditsShort(result.credits)}</span>` : ''}
            ${statusBadge}
            ${reused ? `<span class="pdt-capi-badge pdt-capi-badge-managed">${M.testReusedBadge}</span>` : ''}
        `;
        row.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'pdt-agent-run-body';
        if (!result.succeeded) {
            body.innerHTML = `<div class="pdt-error">${M.testFailed(escapeHtml(result.error || result.status || ''))}</div>`;
            row.appendChild(body);
            return row;
        }

        const outLabel = document.createElement('div');
        outLabel.className = 'pdt-agent-run-output-label';
        outLabel.textContent = result.mimeType ? M.testOutputWith(result.mimeType) : M.runOutput;
        body.append(outLabel, UIFactory.createCopyableCodeBlock(result.text, 'text'));

        const grid = document.createElement('div');
        grid.className = 'info-grid pdt-agent-info-grid';
        const rows = [
            [M.runModel, result.modelName && escapeHtml(result.modelName)],
            [M.testFinishReason, result.finishReason && escapeHtml(result.finishReason)],
            [M.testTokens, result.totalTokens !== null && M.testTokenBreakdown(result.promptTokens, result.completionTokens, result.totalTokens)],
            [M.testAiCredits, result.credits !== null && escapeHtml(String(result.credits))],
            [M.testCopilotCredits, result.copilotCredits !== null && escapeHtml(String(result.copilotCredits))]
        ];
        grid.innerHTML = rows
            .filter(([, v]) => v)
            .map(([label, v]) => `<strong>${label}:</strong><span>${v}</span>`)
            .join('');
        if (grid.innerHTML) {
            body.appendChild(grid);
        }

        // Everything the code-interpreter / reasoning runtimes attach, each collapsed by default.
        const sections = [
            [M.testPlanning, result.planning, 'text'],
            [M.testPromptFixes, result.promptFixes, 'text'],
            [M.testThoughtSteps, result.thoughtSteps, 'text'],
            [M.testCode, result.code, 'python'],
            [M.testLogs, result.logs, 'text'],
            [M.testDataUsed, result.dataUsed, this._looksLikeJson(result.dataUsed) ? 'json' : 'text']
        ];
        sections
            .filter(([, value]) => value && value.trim())
            .forEach(([label, value, language]) => {
                const details = document.createElement('details');
                details.className = 'pdt-agent-raw-config';
                const sectionSummary = document.createElement('summary');
                sectionSummary.textContent = label;
                details.append(sectionSummary, UIFactory.createCopyableCodeBlock(value.trim(), language));
                body.appendChild(details);
            });

        row.appendChild(body);
        return row;
    }

    /**
     * Loads and renders an AI model's definition into the given slot.
     * @param {HTMLElement} slot
     * @param {AiModel} model
     * @param {{saveBtn: HTMLButtonElement, undoBtn: HTMLButtonElement, register: Function}|null} [editor] - The prompt editor for the live version.
     * @private
     */
    async _loadModelDefinition(slot, model, editor = null) {
        const M = Config.MESSAGES.AGENTS;
        try {
            BusyIndicator.set();
            const def = await DataService.getAiModelDefinition(model.id, model.activeConfigId);
            slot.textContent = '';
            if (def.configurations?.length) {
                if (model.kind === 'prompt') {
                    this._renderPromptDefinition(slot, def.configurations, model, editor);
                } else {
                    this._renderTrainedModelDefinition(slot, def.configurations, model);
                }
            } else if (def.creationContext && def.creationContext.trim()) {
                slot.appendChild(UIFactory.createCopyableCodeBlock(def.creationContext, this._looksLikeJson(def.creationContext) ? 'json' : 'text'));
            } else {
                slot.innerHTML = `<p class="pdt-note">${M.noModelContext}</p>`;
            }
            // The definition we just fetched is the freshest view of the model's state — reflect it
            // on the card so a publish/train done in the dialog updates the list badge too.
            this._syncModelCardStatus(model, def.configurations || []);
        } catch (e) {
            slot.innerHTML = `<div class="pdt-error">${M.loadModelDetailsFailed(escapeHtml(e.message))}</div>`;
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Renders a trained/custom model's definition organized like the maker portal: the **Published
     * version** (the active run configuration) and the **Last trained version** (the newest training
     * configuration) as prominent blocks, then every older iteration collapsed into a read-only
     * **History** section. History versions can't be trained, published or edited — they are a record,
     * not a working surface. When the model was never published there is no Published block.
     * @param {HTMLElement} slot
     * @param {import('../services/AgentService.js').AiConfiguration[]} configurations - Newest-first.
     * @param {AiModel} model
     * @private
     */
    _renderTrainedModelDefinition(slot, configurations, model) {
        const M = Config.MESSAGES.AGENTS;
        const published = configurations.find(cfg => cfg.isActive);
        const lastTrained = configurations.find(cfg => cfg.typeCode === AI_CONFIG_TYPE_TRAINING);
        // Only one run config can be live at a time: Dataverse rejects a second Publish while another
        // is active ("AnotherRunConfigAlreadyPublished"). So the Last-trained version can only be
        // published once the current one is unpublished.
        const isPublished = Boolean(published);
        // Publishing clones a run config's output data-binding + schedule (the results table is created
        // once, at first publish, and persists after an unpublish). Carry the newest run config's —
        // active or not — so a *republish* after unpublish reuses the same results table rather than
        // rebuilding it. Falls back to null (first publish derives from the training binding).
        const template = this._buildPublishTemplate(published || configurations.find(cfg => cfg.typeCode === AI_CONFIG_TYPE_RUN));

        const shown = new Set();
        if (published) {
            this._renderVersionSection(slot, M.versionPublished, published, model, 'published', template, isPublished);
            shown.add(published);
        }
        if (lastTrained && !shown.has(lastTrained)) {
            this._renderVersionSection(slot, M.versionLastTrained, lastTrained, model, 'lastTrained', template, isPublished);
            shown.add(lastTrained);
        }

        const history = configurations.filter(cfg => !shown.has(cfg));
        if (history.length) {
            const details = document.createElement('details');
            details.className = 'pdt-agent-version-history';
            const summary = document.createElement('summary');
            summary.innerHTML = `${M.versionHistory} <span class="pdt-agent-history-count">${history.length}</span>`;
            details.appendChild(summary);
            history.forEach(cfg => this._renderModelConfig(details, cfg, model, true));
            slot.appendChild(details);
        }
    }

    /**
     * Renders one titled version block: a heading (e.g. "Published version"), the config, and the
     * version's actions (Quick test on both; Publish on Last trained; Unpublish on Published).
     * @param {HTMLElement} slot
     * @param {string} title
     * @param {import('../services/AgentService.js').AiConfiguration} cfg
     * @param {AiModel} model
     * @param {'published'|'lastTrained'} role
     * @param {{databinding: string, schedulingoptions: string}|null} template - The publish template.
     * @param {boolean} isPublished - Whether the model has a live published run config.
     * @private
     */
    _renderVersionSection(slot, title, cfg, model, role, template, isPublished) {
        const heading = document.createElement('div');
        heading.className = 'pdt-agent-def-heading pdt-agent-version-heading';
        heading.textContent = title;
        slot.appendChild(heading);
        this._renderModelConfig(slot, cfg, model);
        // Actions (Quick test / Publish / Unpublish) sit at the end of the version; Quick test opens
        // its inline tester in place. None render for an untrained Draft (nothing to act on yet).
        if (!model.isManaged) {
            const actions = this._buildVersionActions(cfg, model, role, template, isPublished);
            if (actions) {
                slot.appendChild(actions);
            }
        }
    }

    /**
     * Extracts the run config's output data-binding + scheduling (the template a Publish reuses).
     * @param {import('../services/AgentService.js').AiConfiguration|undefined} runConfig
     * @returns {{databinding: string, schedulingoptions: string}|null}
     * @private
     */
    _buildPublishTemplate(runConfig) {
        if (!runConfig || runConfig.typeCode !== AI_CONFIG_TYPE_RUN) {
            return null;
        }
        const bindingOf = (column) => runConfig.sections.find(section => section.column === column)?.text || '';
        const databinding = bindingOf('msdyn_databinding');
        return databinding ? { databinding, schedulingoptions: bindingOf('msdyn_schedulingoptions') } : null;
    }

    /**
     * Builds a version's action row: a Quick test (an inline classifier tester that expands in place),
     * and — for an unmanaged model — Publish on the Last-trained version or Unpublish on the Published
     * version. Keeps everything inside the model dialog (no nested dialog).
     * @param {import('../services/AgentService.js').AiConfiguration} cfg
     * @param {AiModel} model
     * @param {'published'|'lastTrained'} role
     * @param {{databinding: string, schedulingoptions: string}|null} template
     * @param {boolean} isPublished - Whether the model already has a live published run config.
     * @returns {HTMLElement|null} The actions row, or null when the version has nothing to act on yet
     *   (e.g. an untrained Draft — you can't test or publish it).
     * @private
     */
    _buildVersionActions(cfg, model, role, template, isPublished) {
        const M = Config.MESSAGES.AGENTS;
        // The published run config is deployed; a last-trained version is trainable, and publishable /
        // testable only once trained. Publishing is blocked while another config is live — Dataverse
        // allows only one active run config — so Publish appears only after the current one is
        // unpublished.
        const isTrained = cfg.stateCode === AI_CONFIG_STATE_DONE;
        const canQuickTest = role === 'published' || isTrained;
        const canPublish = role === 'lastTrained' && isTrained && !isPublished;
        const canUnpublish = role === 'published';
        const canTrain = role === 'lastTrained';
        if (!canQuickTest && !canPublish && !canUnpublish && !canTrain) {
            return null;
        }

        const wrap = document.createElement('div');
        wrap.className = 'pdt-model-version-actions';
        const row = document.createElement('div');
        row.className = 'pdt-agent-edit-actions';
        const status = document.createElement('span');
        status.className = 'pdt-agent-train-status';
        row.appendChild(status);
        wrap.appendChild(row);

        const addButton = (label, cls, onClick, title) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = cls;
            btn.textContent = label;
            if (title) {
                btn.title = title;
            }
            btn.addEventListener('click', () => onClick(btn));
            row.appendChild(btn);
            return btn;
        };
        // Quick test toggles an inline tester (no nested dialog over the model dialog).
        let testPanel = null;
        const addQuickTest = () => {
            testPanel = this._buildClassifierTest(cfg);
            testPanel.hidden = true;
            addButton(M.quickTestButton, 'modern-button secondary', (btn) => {
                testPanel.hidden = !testPanel.hidden;
                btn.classList.toggle('is-active', !testPanel.hidden);
                if (!testPanel.hidden) {
                    testPanel.querySelector('.pdt-model-quicktest-text')?.focus();
                }
            });
        };

        // Order mirrors the maker portal: the lifecycle action, Quick test, then Train/Retrain.
        if (role === 'lastTrained') {
            if (canPublish) {
                addButton(M.publishButton, 'modern-button', (btn) => this._handlePublish(btn, status, cfg, model, template));
            }
            if (canQuickTest) {
                addQuickTest();
            }
            addButton(isTrained ? M.retrainButton : M.trainButton, 'modern-button secondary',
                (btn) => this._handleTrain(btn, status, cfg, model, isTrained), isTrained ? M.retrainHint : '');
        } else {
            if (canQuickTest) {
                addQuickTest();
            }
            if (canUnpublish) {
                addButton(M.unpublishButton, 'modern-button secondary', (btn) => this._handleUnpublish(btn, status, cfg, model));
            }
        }
        if (testPanel) {
            wrap.appendChild(testPanel);
        }
        return wrap;
    }

    /**
     * Builds the inline classifier Quick-test tester: a text box, a Test button, and a results area
     * that fills with the suggested tags + confidence (mirrors the maker portal's Quick test dialog).
     * @param {import('../services/AgentService.js').AiConfiguration} cfg
     * @returns {HTMLElement}
     * @private
     */
    _buildClassifierTest(cfg) {
        const M = Config.MESSAGES.AGENTS;
        const panel = document.createElement('div');
        panel.className = 'pdt-model-quicktest';

        // Same shape as the prompt Test panel: a hero header with the action on the right, the
        // input in a card below it, then the results.
        const hero = document.createElement('div');
        hero.className = 'pdt-prompt-test-hero';
        hero.innerHTML = `
            <div class="pdt-prompt-test-hero-text">
                <span class="pdt-prompt-card-title">${M.quickTestHeading}</span>
                <span class="pdt-prompt-card-hint">${M.quickTestHint}</span>
            </div>
            <div class="pdt-agent-edit-actions pdt-prompt-test-actions">
                <button type="button" class="modern-button" data-action="run-quick-test">${M.quickTestRun}</button>
            </div>
        `;

        const inputCard = document.createElement('div');
        inputCard.className = 'pdt-prompt-card pdt-model-quicktest-input';
        const textarea = document.createElement('textarea');
        // `pdt-input` carries box-sizing: border-box — without it, width:100% plus the textarea's
        // own padding and border overflows the card it sits in. Same pairing as the prompt editor.
        textarea.className = 'pdt-input pdt-agent-prompt-textarea pdt-model-quicktest-text';
        textarea.placeholder = M.quickTestPlaceholder;
        textarea.setAttribute('aria-label', M.quickTestPlaceholder);
        inputCard.appendChild(textarea);

        const result = document.createElement('div');
        result.className = 'pdt-agent-test-runs pdt-model-quicktest-result';
        result.innerHTML = `<p class="pdt-note pdt-prompt-test-empty">${M.quickTestEmpty}</p>`;

        const testBtn = hero.querySelector('[data-action="run-quick-test"]');
        testBtn.addEventListener('click', () => this._handleClassifierTest(cfg.id, textarea, testBtn, result));

        panel.append(hero, inputCard, result);
        return panel;
    }

    /**
     * Runs a classifier Quick test and renders the suggested tags into the result area.
     * @param {string} configId
     * @param {HTMLTextAreaElement} textarea
     * @param {HTMLButtonElement} testBtn
     * @param {HTMLElement} result
     * @private
     */
    async _handleClassifierTest(configId, textarea, testBtn, result) {
        const M = Config.MESSAGES.AGENTS;
        const text = textarea.value.trim();
        if (!text) {
            NotificationService.show(M.quickTestNeedsText, 'warn');
            return;
        }
        testBtn.disabled = true;
        // Drop the empty-state note, then show progress above the runs already listed.
        result.querySelector('.pdt-prompt-test-empty')?.remove();
        const running = document.createElement('p');
        running.className = 'pdt-note pdt-prompt-test-running';
        running.textContent = M.quickTestRunning;
        result.prepend(running);

        try {
            BusyIndicator.set();
            const res = await DataService.quickTestModel(configId, text);
            // Collapse the previous run so the newest is the one expanded — same as the prompt Test
            // panel, which otherwise leaves a wall of open results after a few tests.
            result.querySelectorAll('details[open]').forEach(row => {
                row.open = false;
            });
            // Newest run first, so the result you just asked for is the one you see.
            result.prepend(this._buildClassifierTags(res));
        } catch (e) {
            const failure = document.createElement('div');
            failure.className = 'pdt-error';
            failure.textContent = M.quickTestFailed(e.message);
            result.prepend(failure);
        } finally {
            running.remove();
            testBtn.disabled = false;
            BusyIndicator.clear();
        }
    }

    /**
     * Builds the classifier result view: each suggested tag with a coloured confidence chip, plus the
     * credits charged. An empty result is stated plainly.
     * @param {import('../services/AgentService.js').ClassifierResult} res
     * @returns {HTMLElement}
     * @private
     */
    _buildClassifierTags(res) {
        const M = Config.MESSAGES.AGENTS;

        // One collapsible run per test, matching the prompt Test panel — so a result reads as a
        // result, and successive runs stack instead of overwriting each other.
        const row = document.createElement('details');
        row.className = 'pdt-agent-run-row';
        row.open = true;

        const summary = document.createElement('summary');
        const when = new Date().toLocaleTimeString();
        const statusBadge = res.succeeded
            ? `<span class="pdt-capi-badge pdt-capi-badge-action">${M.runQuickTest}</span>`
            : `<span class="pdt-capi-badge pdt-capi-badge-failed">${M.testFailedBadge}</span>`;
        summary.innerHTML = `
            <span class="pdt-agent-run-when">${escapeHtml(when)}</span>
            ${res.succeeded && res.predictions.length ? `<span class="pdt-agent-run-status">${escapeHtml(M.quickTestPredictionCount(res.predictions.length))}</span>` : ''}
            ${res.succeeded && res.credits !== null ? `<span class="pdt-agent-run-feature">${M.testCreditsShort(res.credits)}</span>` : ''}
            ${statusBadge}
        `;
        row.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'pdt-agent-run-body';
        row.appendChild(body);

        if (!res.succeeded) {
            body.innerHTML = `<div class="pdt-error">${M.quickTestFailed(escapeHtml(res.error || res.status || ''))}</div>`;
            return row;
        }

        body.append(this._buildModelPredictions(res));

        const grid = document.createElement('div');
        grid.className = 'info-grid pdt-agent-info-grid';
        const rows = [
            [M.testAiCredits, res.credits !== null && escapeHtml(String(res.credits))],
            [M.testCopilotCredits, res.copilotCredits !== null && escapeHtml(String(res.copilotCredits))],
            [M.quickTestPredictionId, res.predictionId && escapeHtml(res.predictionId)]
        ];
        grid.innerHTML = rows
            .filter(([, v]) => v)
            .map(([label, v]) => `<strong>${label}:</strong><span>${v}</span>`)
            .join('');
        if (grid.innerHTML) {
            body.appendChild(grid);
        }

        return row;
    }

    /**
     * Renders whatever the model predicted. A scored output (classification, object detection) gets
     * the confidence chips; a field output (document processing) gets a name/value grid; an output
     * shape this build doesn't recognize is shown verbatim rather than reported as "nothing found".
     * @param {import('../services/AgentService.js').ModelTestResult} res
     * @returns {HTMLElement}
     * @private
     */
    _buildModelPredictions(res) {
        const M = Config.MESSAGES.AGENTS;

        if (res.shape === 'other') {
            const wrap = document.createElement('div');
            const label = document.createElement('div');
            label.className = 'pdt-agent-run-output-label';
            label.textContent = M.quickTestRawOutput;
            wrap.append(label, UIFactory.createCopyableCodeBlock(res.raw, 'json'));
            return wrap;
        }

        if (!res.predictions.length) {
            const empty = document.createElement('p');
            empty.className = 'pdt-note';
            empty.textContent = M.quickTestNoPredictions;
            return empty;
        }

        // Field-style output: name and value, with the confidence alongside when there is one.
        if (res.shape === 'labels') {
            const grid = document.createElement('div');
            grid.className = 'info-grid pdt-agent-info-grid';
            grid.innerHTML = res.predictions
                .map(p => `<strong>${escapeHtml(p.label)}:</strong><span>${escapeHtml(p.value)}${p.score !== null ? ` <span class="pdt-eval-score ${this._scoreBandClass(p.score)}">${Math.round(p.score * 100)}%</span>` : ''}</span>`)
                .join('');
            return grid;
        }

        const list = document.createElement('div');
        list.className = 'pdt-model-tag-list';
        res.predictions.forEach(entry => {
            const tag = document.createElement('div');
            tag.className = 'pdt-model-tag';
            const score = entry.score !== null
                ? `<span class="pdt-eval-score ${this._scoreBandClass(entry.score)}">${Math.round(entry.score * 100)}%</span>`
                : '';
            tag.innerHTML = `<span class="pdt-model-tag-name">${escapeHtml(entry.label)}</span>${score}`;
            list.appendChild(tag);
        });
        return list;
    }

    /**
     * Maps a confidence to its colour band.
     * @param {number} score - Confidence 0–1.
     * @returns {string} The score CSS class.
     * @private
     */
    _scoreBandClass(score) {
        const pct = Math.round(score * 100);
        return `pdt-eval-score-${pct >= 80 ? 'high' : (pct >= 60 ? 'mid' : 'low')}`;
    }

    /**
     * Publishes the last-trained version: creates a run config (cloning the live output binding) and
     * publishes it, then polls to Published and refreshes the dialog. A timeout reports "still
     * finishing", never a failure.
     * @param {HTMLButtonElement} button
     * @param {HTMLElement} status
     * @param {import('../services/AgentService.js').AiConfiguration} cfg
     * @param {AiModel} model
     * @param {{databinding: string, schedulingoptions: string}|null} template
     * @private
     */
    async _handlePublish(button, status, cfg, model, template) {
        const M = Config.MESSAGES.AGENTS;
        button.disabled = true;
        try {
            BusyIndicator.set();
            // Republish clones the live run config's binding + schedule (`template`); a first publish
            // derives them from this training config's binding instead.
            const options = {
                databinding: template?.databinding || '',
                schedulingoptions: template?.schedulingoptions || '',
                trainingDatabinding: cfg.sections.find(section => section.column === 'msdyn_databinding')?.text || ''
            };
            const { configId, error } = await DataService.publishTrainedModel(model, cfg.id, options);
            if (error) {
                throw new Error(error);
            }
            status.textContent = M.publishStarted;
            const published = await this._waitForPromptPublish(configId);
            model.activeConfigId = configId;
            status.textContent = published ? M.publishFinished : M.promptPublishPending;
            NotificationService.show(published ? M.publishFinished : M.promptPublishPending, published ? 'success' : 'info');
            await this._reloadOpenModel?.();
        } catch (e) {
            status.textContent = '';
            NotificationService.show(M.publishFailed(escapeHtml(e.message)), 'error');
        } finally {
            button.disabled = false;
            BusyIndicator.clear();
        }
    }

    /**
     * Unpublishes the published run configuration (UnpublishAIConfiguration) and refreshes the dialog.
     * The button double-clicks to confirm — the model dialog can't safely stack a confirmation dialog
     * over itself.
     * @param {HTMLButtonElement} button
     * @param {HTMLElement} status
     * @param {import('../services/AgentService.js').AiConfiguration} cfg - The published run config.
     * @param {AiModel} model
     * @private
     */
    async _handleUnpublish(button, status, cfg, model) {
        const M = Config.MESSAGES.AGENTS;
        // First click arms the confirm (apps lose access to the published model); second click runs it.
        if (button.dataset.confirm !== 'true') {
            button.dataset.confirm = 'true';
            button.classList.add('pdt-button-danger');
            button.textContent = M.unpublishConfirm;
            status.textContent = M.unpublishWarning;
            // Auto-disarm so a stale "Confirm" can't fire on a later stray click.
            clearTimeout(this._unpublishDisarm);
            this._unpublishDisarm = setTimeout(() => {
                button.dataset.confirm = '';
                button.classList.remove('pdt-button-danger');
                button.textContent = M.unpublishButton;
                status.textContent = '';
            }, 4000);
            return;
        }
        clearTimeout(this._unpublishDisarm);
        button.disabled = true;
        try {
            BusyIndicator.set();
            const { error } = await DataService.unpublishAiConfiguration(cfg.id);
            if (error) {
                throw new Error(error);
            }
            model.activeConfigId = '';
            NotificationService.show(M.unpublished, 'success');
            await this._reloadOpenModel?.();
        } catch (e) {
            status.textContent = '';
            NotificationService.show(M.unpublishFailed(escapeHtml(e.message)), 'error');
        } finally {
            button.disabled = false;
            BusyIndicator.clear();
        }
    }

    /**
     * Renders a prompt's version history: the live version first (editable when an editor is given),
     * then every older version collapsed and read-only. Only the live version can be edited — the
     * others are locked, which mirrors AI Builder (you publish a new version rather than editing a
     * past one).
     * @param {HTMLElement} slot
     * @param {import('../services/AgentService.js').AiConfiguration[]} configurations
     * @param {AiModel} model
     * @param {{register: Function}|null} editor
     * @private
     */
    _renderPromptDefinition(slot, configurations, model, editor) {
        const M = Config.MESSAGES.AGENTS;
        const active = configurations.find(c => c.isActive) || configurations[0];
        if (editor) {
            this._renderActivePromptConfig(slot, active, editor);
        } else {
            this._renderLockedPromptConfig(slot, active, true);
        }
        // Older versions are context, not the task — tuck them into a collapsed history section so
        // the top of the tab stays focused on the live prompt.
        const older = configurations.filter(cfg => cfg !== active);
        if (older.length) {
            const history = document.createElement('details');
            history.className = 'pdt-agent-version-history';
            const summary = document.createElement('summary');
            summary.innerHTML = `${M.versionHistory} <span class="pdt-agent-history-count">${older.length}</span>`;
            history.appendChild(summary);
            older.forEach(cfg => this._renderLockedPromptConfig(history, cfg, false));
            slot.appendChild(history);
        }
    }

    /**
     * Renders the live prompt version as the single editable surface: friendly settings controls and
     * the raw configuration JSON, both feeding one footer Save. Changing a setting rewrites the JSON
     * (the single source of truth), so the two never diverge and one Save publishes both.
     * @param {HTMLElement} slot
     * @param {import('../services/AgentService.js').AiConfiguration} cfg
     * @param {{register: Function}} editor
     * @private
     */
    _renderActivePromptConfig(slot, cfg, editor) {
        const M = Config.MESSAGES.AGENTS;
        const configText = cfg.sections.find(s => s.column === 'msdyn_customconfiguration')?.text || '';
        const meta = extractPromptMetadata(configText);
        const wrap = document.createElement('div');
        wrap.className = 'pdt-agent-config is-active pdt-prompt-edit';

        // Compact status strip: what version you're editing, that it's live, when it last changed.
        // The heading itself carries the version, the last-run date and the status badges.
        const statusBar = document.createElement('div');
        statusBar.className = 'pdt-prompt-statusbar';
        statusBar.appendChild(this._buildConfigHeading(cfg));
        wrap.appendChild(statusBar);
        if (cfg.lastError) {
            this._renderConfigError(wrap, cfg);
        }

        // ── Primary: the prompt, edited as friendly text with {tokens}
        const card = document.createElement('section');
        card.className = 'pdt-prompt-card';
        card.innerHTML = `
            <div class="pdt-prompt-card-head">
                <span class="pdt-prompt-card-title">${M.promptSectionTitle}</span>
                <span class="pdt-prompt-card-hint">${M.promptSectionHint}</span>
            </div>
        `;
        const promptTa = document.createElement('textarea');
        promptTa.className = 'pdt-input pdt-agent-prompt-textarea';
        promptTa.spellcheck = false;
        promptTa.value = extractPromptText(configText) ?? '';
        promptTa.setAttribute('aria-label', M.promptSectionTitle);
        card.appendChild(promptTa);
        const tokenHint = document.createElement('p');
        tokenHint.className = 'pdt-prompt-token-hint';
        tokenHint.innerHTML = M.promptTokenHint;
        card.appendChild(tokenHint);
        wrap.appendChild(card);

        // ── Generated code (read-only, code-interpreter prompts)
        if (meta && meta.code && meta.code.trim()) {
            const codeDetails = document.createElement('details');
            codeDetails.className = 'pdt-agent-raw-config';
            const codeSummary = document.createElement('summary');
            codeSummary.textContent = M.testCode;
            codeDetails.append(codeSummary, UIFactory.createCopyableCodeBlock(meta.code.trim(), 'python'));
            wrap.appendChild(codeDetails);
        }

        // ── Advanced: the raw configuration JSON — the editor's source of truth
        const advanced = document.createElement('details');
        advanced.className = 'pdt-agent-raw-config pdt-prompt-advanced';
        const advancedSummary = document.createElement('summary');
        advancedSummary.textContent = M.promptAdvancedConfig;
        advanced.appendChild(advancedSummary);
        const rawTa = document.createElement('textarea');
        rawTa.className = 'pdt-input pdt-agent-edit-textarea';
        rawTa.spellcheck = false;
        rawTa.value = this._prettyJson(configText);
        advanced.appendChild(rawTa);
        wrap.appendChild(advanced);

        slot.appendChild(wrap);

        // The raw JSON is the single source of truth; the prompt textarea edits it through the shared
        // editor, and re-syncs when it (or the Settings tab) changes the config elsewhere.
        editor.register(rawTa, rawTa.value);
        promptTa.addEventListener('input', () => {
            try {
                editor.applyConfig(this._prettyJson(applyPromptText(editor.getConfig(), promptTa.value)));
            } catch {
                // Raw JSON is momentarily invalid (edited in Advanced) — ignore until it is fixed.
            }
        });
        editor.onChange((updatedConfig) => {
            const text = extractPromptText(updatedConfig) ?? '';
            if (promptTa.value !== text) {
                promptTa.value = text;
            }
        });
    }

    /**
     * Renders the Settings tab: friendly controls (temperature, record limit, moderation, record
     * links, code interpreter) that edit the same live configuration as the Definition tab, through
     * the shared editor. Changing a control rewrites the config; a Definition edit re-syncs these
     * controls (via the editor's change notification and on tab switch). One footer Save publishes
     * whatever changed in either tab.
     * @param {HTMLElement} panel
     * @param {{getConfig: Function, applyConfig: Function, onChange: Function}} editor
     * @returns {{sync: Function}|null} The controls (for re-sync), or null when there is no prompt.
     * @private
     */
    _renderPromptSettingsTab(panel, editor) {
        const M = Config.MESSAGES.AGENTS;
        const config = editor.getConfig();
        panel.textContent = '';
        if (!config || !extractPromptMetadata(config)) {
            panel.innerHTML = `<p class="pdt-note">${M.noPromptSettings}</p>`;
            return null;
        }

        const intro = document.createElement('p');
        intro.className = 'pdt-prompt-tab-intro';
        intro.textContent = M.settingsIntro;

        const controls = this._buildPromptSettingsControls(config);
        // A control change folds the settings into the live config (the single source of truth).
        controls.el.addEventListener('change', () => {
            let updated;
            try {
                updated = applyPromptSettings(editor.getConfig(), controls.readSettings());
            } catch {
                NotificationService.show(M.invalidJson, 'error');
                controls.sync(editor.getConfig());
                return;
            }
            editor.applyConfig(this._prettyJson(updated));
        });
        // Keep the controls current when the config is edited in the Definition tab (or undone).
        editor.onChange((cfg) => controls.sync(cfg));

        panel.append(intro, controls.el);
        return controls;
    }

    /**
     * Renders a locked (read-only) prompt version: its readable summary and generated code, plus the
     * raw configuration, in a collapsible block. The live version is expanded; older ones collapse.
     * @param {HTMLElement} slot
     * @param {import('../services/AgentService.js').AiConfiguration} cfg
     * @param {boolean} expanded
     * @private
     */
    _renderLockedPromptConfig(slot, cfg, expanded) {
        const M = Config.MESSAGES.AGENTS;
        const details = document.createElement('details');
        details.className = 'pdt-agent-config';
        details.open = expanded;
        if (cfg.isActive) {
            details.classList.add('is-active');
        }
        const summary = document.createElement('summary');
        summary.className = 'pdt-agent-config-heading';
        summary.appendChild(this._buildConfigHeading(cfg));
        details.appendChild(summary);

        this._renderConfigError(details, cfg);
        this._renderConfigSummary(details, cfg);
        const configText = cfg.sections.find(s => s.column === 'msdyn_customconfiguration')?.text || '';
        if (configText.trim()) {
            const raw = document.createElement('details');
            raw.className = 'pdt-agent-raw-config';
            const rawSummary = document.createElement('summary');
            rawSummary.textContent = M.tabConfig;
            raw.append(rawSummary, UIFactory.createCopyableCodeBlock(this._prettyJson(configText), 'json'));
            details.appendChild(raw);
        }
        slot.appendChild(details);
    }

    /**
     * Builds a configuration's version/status heading (version number plus Live / status / type
     * badges), shared by the editable and locked prompt renderers.
     * @param {import('../services/AgentService.js').AiConfiguration} cfg
     * @returns {HTMLElement}
     * @private
     */
    _buildConfigHeading(cfg) {
        const M = Config.MESSAGES.AGENTS;
        const heading = document.createElement('span');
        heading.className = 'pdt-agent-config-heading-inner';
        const badges = [
            cfg.isActive ? `<span class="pdt-capi-badge pdt-capi-badge-active">${M.configActive}</span>` : '',
            cfg.status ? `<span class="pdt-capi-badge ${cfg.isFailed ? 'pdt-capi-badge-failed' : 'pdt-capi-badge-managed'}">${escapeHtml(cfg.status)}</span>` : '',
            cfg.type ? `<span class="pdt-capi-badge pdt-capi-badge-action">${escapeHtml(cfg.type)}</span>` : ''
        ].filter(Boolean).join('');
        // Version leads (bold) with the last-trained/run date beneath it; badges trail on the right —
        // the same lead/badge layout the transcript rows use, so every version reads its date without
        // being opened.
        heading.innerHTML = `
            <span class="pdt-agent-config-lead">
                <span class="pdt-agent-config-version">${M.configVersion(escapeHtml(cfg.version))}</span>
                ${cfg.lastRunOn ? `<span class="pdt-agent-config-date">${escapeHtml(M.configLastRun(cfg.lastRunOn))}</span>` : ''}
            </span>
            <span class="pdt-agent-config-badges">${badges}</span>`;
        return heading;
    }

    /**
     * Renders a configuration's failure (or last-run time) into the given container, when present.
     * @param {HTMLElement} wrap
     * @param {import('../services/AgentService.js').AiConfiguration} cfg
     * @private
     */
    _renderConfigError(wrap, cfg) {
        const M = Config.MESSAGES.AGENTS;
        if (!cfg.lastError) {
            return;
        }
        // The last-run date is shown in the version heading; the error block carries only the failure.
        const error = document.createElement('div');
        error.className = 'pdt-error pdt-agent-config-error';
        const inner = cfg.lastError.innerErrors.length
            ? `<div class="pdt-agent-config-error-inner">${escapeHtml(cfg.lastError.innerErrors.join(' · '))}</div>`
            : '';
        error.innerHTML = `<strong>${M.configFailed}</strong> ${escapeHtml(cfg.lastError.message)}
            ${cfg.lastError.code && cfg.lastError.code !== cfg.lastError.message ? ` <code class="code-like">${escapeHtml(cfg.lastError.code)}</code>` : ''}${inner}`;
        wrap.appendChild(error);
    }

    /**
     * Recomputes a model's headline status from its loaded configurations and updates the card
     * badge in place. Mirrors the service's list-level {@link summarizeModelStatus} but works from
     * the mapped configuration objects the dialog already has.
     * @param {AiModel} model
     * @param {import('../services/AgentService.js').AiConfiguration[]} configurations
     * @private
     */
    _syncModelCardStatus(model, configurations) {
        const latest = configurations.find(c => c.typeCode === AI_CONFIG_TYPE_RUN)
            || configurations.find(c => c.typeCode === AI_CONFIG_TYPE_TRAINING)
            || configurations[0];
        if (!latest) {
            return;
        }
        let state = 'draft';
        if (latest.isActive) {
            state = 'live';
        } else if (latest.isFailed) {
            state = 'failed';
        } else if (latest.statusCode === AI_CONFIG_STATUS_PUBLISHED) {
            state = 'published';
        }
        model.configStatus = { state, status: latest.status, configId: latest.id, version: latest.version };

        const M = Config.MESSAGES.AGENTS;
        const card = this.ui.host?.querySelector(`[data-model-id="${model.id}"] .pdt-agent-badges`);
        if (!card) {
            return;
        }
        let badge = card.querySelector('[class*="pdt-capi-badge-config-"]');
        if (!badge) {
            badge = document.createElement('span');
            // Sits right after the record-state badge, matching the initial card order.
            card.insertBefore(badge, card.children[1] || null);
        }
        badge.className = `pdt-capi-badge pdt-capi-badge-config-${state}`;
        badge.textContent = state === 'live' ? M.configActive : (latest.status || M.configUnknown);
    }

    /**
     * Renders one configuration iteration: its version/status header, any failure, the readable
     * prompt or data-binding summary, and one editable/read-only block per payload column.
     * @param {HTMLElement} slot
     * @param {import('../services/AgentService.js').AiConfiguration} cfg
     * @param {AiModel} model
     * @param {boolean} [readOnly=false] - History versions render read-only: no Train/Retrain and no
     *   editable sections.
     * @private
     */
    _renderModelConfig(slot, cfg, model, readOnly = false) {
        const wrap = document.createElement('div');
        wrap.className = 'pdt-agent-config';
        if (cfg.isActive) {
            wrap.classList.add('is-active');
        }

        const heading = document.createElement('div');
        heading.className = 'pdt-agent-def-heading pdt-agent-config-heading';
        heading.appendChild(this._buildConfigHeading(cfg));
        wrap.appendChild(heading);
        this._renderConfigError(wrap, cfg);
        this._renderConfigSummary(wrap, cfg);

        // Model performance sits just under the data-binding info-grid, ahead of the raw payload
        // sections (the collapsible Configuration / Data binding / schema blocks).
        const perfSection = cfg.sections.find(section => section.column === 'msdyn_modelperformance');
        if (perfSection) {
            this._renderConfigSection(wrap, perfSection, cfg, model, readOnly);
        }

        // Train/Retrain is rendered with the other version actions (below) so they share one row.
        cfg.sections
            .filter(section => section.column !== 'msdyn_modelperformance')
            .forEach(section => this._renderConfigSection(wrap, section, cfg, model, readOnly));
        slot.appendChild(wrap);
    }

    /**
     * Starts training (or a retrain) and polls until Dataverse reports the outcome. Training is
     * asynchronous, so a timeout reports "still running", never a failure. A retrain clones a new
     * training iteration first (a Done configuration can't be trained in place), then polls that new
     * iteration and refreshes the dialog so it appears.
     * @param {HTMLButtonElement} button
     * @param {HTMLElement} status
     * @param {import('../services/AgentService.js').AiConfiguration} cfg
     * @param {AiModel} model
     * @param {boolean} isRetrain
     * @private
     */
    async _handleTrain(button, status, cfg, model, isRetrain) {
        const M = Config.MESSAGES.AGENTS;
        button.disabled = true;
        try {
            BusyIndicator.set();
            let configId = cfg.id;
            let operationStatus;
            let error;
            if (isRetrain) {
                const source = {
                    id: cfg.id,
                    databinding: cfg.sections.find(s => s.column === 'msdyn_databinding')?.text || '',
                    customConfiguration: cfg.sections.find(s => s.column === 'msdyn_customconfiguration')?.text || ''
                };
                ({ configId, status: operationStatus, error } = await DataService.retrainAiConfiguration(model, source));
            } else {
                ({ status: operationStatus, error } = await DataService.trainAiConfiguration(cfg.id));
            }
            if (error) {
                throw new Error(error);
            }
            status.textContent = M.trainStarted(operationStatus || '');
            const outcome = await this._waitForTrainingOutcome(configId);
            status.textContent = outcome ? M.trainFinished(outcome) : M.trainStillRunning;
            NotificationService.show(outcome ? M.trainFinished(outcome) : M.trainStillRunning, outcome ? 'success' : 'info');
            // A retrain minted a new iteration — refresh the dialog so it shows up.
            if (isRetrain) {
                await this._reloadOpenModel?.();
            }
        } catch (e) {
            status.textContent = '';
            NotificationService.show(M.trainFailed(escapeHtml(e.message)), 'error');
        } finally {
            button.disabled = false;
            BusyIndicator.clear();
        }
    }

    /**
     * Polls a configuration until it leaves the Training status.
     * @param {string} configId
     * @param {{attempts?: number, intervalMs?: number, wait?: (ms: number) => Promise<void>}} [opts] - Overridable for tests.
     * @returns {Promise<string>} The settled status label, or '' when it is still running.
     * @private
     */
    async _waitForTrainingOutcome(configId, opts = {}) {
        const {
            attempts = Config.AGENT_PUBLISH.maxPollingAttempts,
            intervalMs = Config.AGENT_PUBLISH.pollingInterval,
            wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))
        } = opts;
        const generation = this._lifecycle;

        for (let i = 0; i < attempts; i++) {
            if (this._lifecycle !== generation) {
                return '';
            }
            try {
                const { statusCode, status } = await DataService.getAiConfigurationStatus(configId);
                // 1 = Training; anything else means the run settled (Trained, Train failed, …).
                if (statusCode !== null && statusCode !== AI_CONFIG_STATUS_TRAINING) {
                    return status;
                }
            } catch {
                // Transient read failure — keep polling.
            }
            if (i < attempts - 1) {
                await wait(intervalMs);
            }
        }
        return '';
    }

    /**
     * Renders the human-readable summary for a configuration: the prompt text plus its execution
     * settings for a GPT prompt, or the bound table/feature summary for a trained model.
     * @param {HTMLElement} wrap
     * @param {import('../services/AgentService.js').AiConfiguration} cfg
     * @private
     */
    _renderConfigSummary(wrap, cfg) {
        const configText = cfg.sections.find(s => s.column === 'msdyn_customconfiguration')?.text || '';

        // Prompt text leads — it is what defines the version and what you came to read.
        const prompt = extractPromptText(configText);
        if (prompt) {
            wrap.appendChild(UIFactory.createCopyableCodeBlock(prompt, 'text'));
        }

        // Settings (model, tuning, grounding) sit right under the prompt as supporting detail.
        const meta = extractPromptMetadata(configText);
        if (meta) {
            wrap.appendChild(this._buildPromptSettingsGrid(meta));
        }

        const binding = summarizeDataBinding(cfg.sections.find(s => s.column === 'msdyn_databinding')?.text || '');
        if (binding) {
            wrap.appendChild(this._buildDataBindingGrid(binding));
        }

        // Generated code is a deeper, read-only artifact — a code-interpreter prompt is defined by
        // both the prompt and this code, so it follows the summary detail (before the raw JSON the
        // caller appends last).
        if (meta && meta.code && meta.code.trim()) {
            const details = document.createElement('details');
            details.className = 'pdt-agent-raw-config';
            const summary = document.createElement('summary');
            summary.textContent = Config.MESSAGES.AGENTS.testCode;
            details.append(summary, UIFactory.createCopyableCodeBlock(meta.code.trim(), 'python'));
            wrap.appendChild(details);
        }
    }

    /**
     * Builds the settings grid for a GPT prompt: which model it runs on, how it is tuned, and what
     * it is grounded on.
     * @param {import('../services/AgentService.js').PromptMetadata} meta
     * @returns {HTMLElement}
     * @private
     */
    _buildPromptSettingsGrid(meta) {
        const M = Config.MESSAGES.AGENTS;
        const grid = document.createElement('div');
        grid.className = 'info-grid pdt-agent-info-grid';
        const sources = meta.dataSources
            .map(s => `${s.name}${s.filters.length ? ` (${s.filters.join(', ')})` : ''}`)
            .join(', ');
        const formulas = meta.formulas.map(f => f.name).filter(Boolean).join(', ');
        const rows = [
            [M.promptModel, meta.modelType && escapeHtml(meta.modelType)],
            [M.promptTemperature, meta.temperature !== null && escapeHtml(String(meta.temperature))],
            [M.promptRecordLimit, meta.recordRetrievalLimit !== null && escapeHtml(String(meta.recordRetrievalLimit))],
            [M.promptModeration, meta.contentModerationLevel && escapeHtml(meta.contentModerationLevel)],
            [M.promptRecordLinks, meta.preserveRecordLinks !== null && (meta.preserveRecordLinks ? M.enabled : M.disabled)],
            [M.promptCodeInterpreter, meta.codeInterpreter && M.enabled],
            [M.promptOutput, meta.outputFormats.length && escapeHtml(meta.outputFormats.join(', '))],
            [M.promptDataSources, sources && escapeHtml(sources)],
            [M.promptFormulas, formulas && escapeHtml(formulas)]
        ];
        grid.innerHTML = rows
            .filter(([, value]) => value)
            .map(([label, value]) => `<strong>${label}:</strong><span>${value}</span>`)
            .join('');
        return grid;
    }

    /**
     * Builds the summary grid for a trained model's data binding: the table it reads, the column it
     * predicts, and how much of the schema it was given.
     * @param {import('../services/AgentService.js').DataBindingSummary} binding
     * @returns {HTMLElement}
     * @private
     */
    _buildDataBindingGrid(binding) {
        const M = Config.MESSAGES.AGENTS;
        const grid = document.createElement('div');
        grid.className = 'info-grid pdt-agent-info-grid';
        const predicts = binding.labelAttribute
            ? `<code class="code-like">${escapeHtml(binding.labelAttribute)}</code>${binding.labelDataType ? ` (${escapeHtml(binding.labelDataType)})` : ''}`
            : '';
        // Known input roles (text/tags) get their own friendly row — "Text input: content" — so it
        // reads like the maker portal. The record-id role and the Label (shown as Predicts) are
        // omitted, and everything else (feature columns, unknown roles) stays in a compact Columns
        // list so this degrades cleanly for prediction/other model types.
        const roleLabels = M.bindingRoleLabels;
        const roleRows = binding.columns
            .filter(column => roleLabels[column.role])
            .map(column => [roleLabels[column.role], `<code class="code-like">${escapeHtml(column.schemaName)}</code>`]);
        const specialRoles = new Set([...Object.keys(roleLabels), 'id', 'Label']);
        const columns = binding.columns
            .filter(column => !specialRoles.has(column.role))
            .map(column => `<code class="code-like">${escapeHtml(column.schemaName)}</code>${column.role ? ` <span class="pdt-binding-role">(${escapeHtml(column.role)})</span>` : ''}`)
            .join(' · ');
        const rows = [
            [M.bindingTable, `<code class="code-like">${escapeHtml(binding.entity)}</code>`],
            [M.bindingPredicts, predicts],
            ...roleRows,
            [M.bindingColumns, columns],
            [M.bindingRelated, binding.relatedTotal && M.bindingRelatedCount(binding.relatedSelected, binding.relatedTotal)]
        ];
        grid.innerHTML = rows
            .filter(([, value]) => value)
            .map(([label, value]) => `<strong>${label}:</strong><span>${value}</span>`)
            .join('');
        return grid;
    }

    /**
     * Renders one payload column of a trained/prebuilt model's configuration, editable in place.
     * Each column is edited and saved independently: the displayed text can come from any of the
     * definition columns, so the save PATCHes the column the text was read from. (Prompts are edited
     * through the shared footer editor instead — see {@link _renderActivePromptConfig}.)
     * @param {HTMLElement} wrap
     * @param {import('../services/AgentService.js').AiConfigSection} section
     * @param {import('../services/AgentService.js').AiConfiguration} cfg
     * @param {AiModel} model
     * @param {boolean} [readOnly=false] - When true (history versions) the section is never editable.
     * @private
     */
    _renderConfigSection(wrap, section, cfg, model, readOnly = false) {
        const M = Config.MESSAGES.AGENTS;

        // A trained model's performance renders as a friendly metrics panel (headline scores, per-tag
        // precision/recall/F1, test coverage) with the raw JSON tucked below — not an editor. Falls
        // through to the raw view when the payload isn't parseable performance.
        if (section.column === 'msdyn_modelperformance') {
            const perf = parseModelPerformance(section.text);
            if (perf) {
                wrap.appendChild(this._buildModelPerformanceSection(section, perf, model));
                return;
            }
        }

        const editable = section.editable && !model.isManaged && !readOnly;
        const details = document.createElement('details');
        details.className = 'pdt-agent-raw-config';
        const summary = document.createElement('summary');
        summary.textContent = section.compressed ? M.sectionCompressed(section.label) : section.label;
        details.appendChild(summary);

        // Patching a live trained iteration overwrites the running version — worth flagging.
        if (editable && cfg.isActive) {
            const note = document.createElement('p');
            note.className = 'pdt-note pdt-agent-config-warning';
            note.textContent = M.configEditLiveWarning;
            details.appendChild(note);
        }

        const value = section.language === 'json' ? this._prettyJson(section.text) : section.text;
        details.appendChild(this._buildEditableSection(value, {
            editable,
            language: section.language,
            validateJson: section.language === 'json',
            onSave: (val) => DataService.updateAiModelConfiguration(cfg.id, val, section.column)
        }));
        wrap.appendChild(details);
    }

    /**
     * Renders the trained-model performance section: an expanded, friendly metrics panel with the
     * headline score chipped on the summary (so it reads even when collapsed) and the raw JSON tucked
     * below.
     * @param {import('../services/AgentService.js').AiConfigSection} section
     * @param {import('../services/AgentService.js').ModelPerformance} perf
     * @param {AiModel} [model] - The model, used to name the metrics download file.
     * @returns {HTMLElement}
     * @private
     */
    _buildModelPerformanceSection(section, perf, model) {
        const M = Config.MESSAGES.AGENTS;
        const details = document.createElement('details');
        details.className = 'pdt-agent-raw-config pdt-model-perf-section';
        // Collapsed like the sibling sections — the headline accuracy chip on the summary reads at a
        // glance, and a model can carry the same metrics on both its training and run configs, so
        // opening every one would stack redundant walls of numbers.

        const summary = document.createElement('summary');
        summary.textContent = section.label;
        const headline = this._perfHeadlineMetric(perf);
        if (headline) {
            const chip = document.createElement('span');
            chip.className = `pdt-eval-score pdt-eval-score-${this._perfBand(headline) || 'mid'} pdt-model-perf-summary-chip`;
            chip.textContent = headline.display;
            chip.title = this._perfLabel(headline.name);
            summary.appendChild(chip);
        }
        details.appendChild(summary);

        const panel = this._buildModelPerformancePanel(perf);
        // Download the full metrics (the raw msdyn_modelperformance JSON) — the same "download detailed
        // metrics" the maker portal offers.
        const actions = document.createElement('div');
        actions.className = 'pdt-model-perf-actions';
        const download = document.createElement('button');
        download.type = 'button';
        download.className = 'modern-button secondary pdt-model-perf-download';
        download.textContent = M.perfDownload;
        download.addEventListener('click', () => {
            const safeName = (model?.name || 'model').replace(/[\\/:*?"<>|]+/g, '-');
            downloadText(this._prettyJson(section.text), `${safeName} - detailed metrics.json`, 'application/json');
        });
        actions.appendChild(download);
        panel.appendChild(actions);
        details.appendChild(panel);

        // Keep the full JSON one click away, below the friendly view.
        const raw = document.createElement('details');
        raw.className = 'pdt-agent-raw-config';
        const rawSummary = document.createElement('summary');
        rawSummary.textContent = M.perfRawJson;
        raw.append(rawSummary, UIFactory.createCopyableCodeBlock(this._prettyJson(section.text), 'json'));
        details.appendChild(raw);
        return details;
    }

    /**
     * Builds the friendly model-performance panel: global scores as coloured stat tiles, then each
     * category's test coverage, precision/recall/F1 chips and a grid of the remaining metrics.
     * @param {import('../services/AgentService.js').ModelPerformance} perf
     * @returns {HTMLElement}
     * @private
     */
    _buildModelPerformancePanel(perf) {
        const M = Config.MESSAGES.AGENTS;
        const wrap = document.createElement('div');
        wrap.className = 'pdt-model-perf';

        if (perf.headline.length) {
            // The headline metric (accuracy) leads as a radial gauge; the remaining global scores sit
            // beside it as stat tiles. A non-percentage headline falls back to tiles only.
            const gaugeMetric = this._perfHeadlineMetric(perf);
            const useGauge = gaugeMetric && gaugeMetric.pct !== null;
            const tileMetrics = useGauge ? perf.headline.filter(metric => metric !== gaugeMetric) : perf.headline;

            const headline = document.createElement('div');
            headline.className = 'pdt-model-perf-headline';
            if (useGauge) {
                headline.appendChild(this._buildPerfGauge(gaugeMetric));
            }
            if (tileMetrics.length) {
                const tiles = document.createElement('div');
                tiles.className = 'pdt-agent-runs-stats pdt-model-perf-tiles';
                tileMetrics.forEach(metric => tiles.appendChild(this._buildPerfTile(metric)));
                headline.appendChild(tiles);
            }
            wrap.appendChild(headline);
        }

        perf.categories.forEach(category => {
            // Only label categories when there is more than one — a single aggregate speaks for itself.
            if (perf.categories.length > 1 && category.category) {
                const heading = document.createElement('div');
                heading.className = 'pdt-agent-def-heading pdt-model-perf-cat-heading';
                heading.textContent = M.perfCategoryHeading(category.category);
                wrap.appendChild(heading);
            }
            wrap.appendChild(this._buildPerfCategory(category));
        });
        return wrap;
    }

    /**
     * Builds a radial gauge for a headline percentage metric: a ring filled to the score and coloured
     * by band, with the rounded score in the centre and the metric name beneath.
     * @param {import('../services/AgentService.js').PerfMetric} metric
     * @returns {HTMLElement}
     * @private
     */
    _buildPerfGauge(metric) {
        const radius = 54;
        const circumference = 2 * Math.PI * radius;
        const pct = Math.max(0, Math.min(100, metric.pct));
        const offset = circumference * (1 - pct / 100);
        const band = this._perfBand(metric) || 'mid';
        const label = this._perfLabel(metric.name);
        const wrap = document.createElement('div');
        wrap.className = 'pdt-perf-gauge-wrap';
        wrap.innerHTML = `
            <svg class="pdt-perf-gauge" viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(label)} ${escapeHtml(metric.display)}">
                <circle class="pdt-perf-gauge-track" cx="60" cy="60" r="${radius}" fill="none"></circle>
                <circle class="pdt-perf-gauge-arc pdt-perf-gauge-arc-${band}" cx="60" cy="60" r="${radius}" fill="none"
                    stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
                    stroke-linecap="round" transform="rotate(-90 60 60)"></circle>
                <text class="pdt-perf-gauge-value" x="60" y="60" text-anchor="middle" dominant-baseline="central">${Math.round(pct)}</text>
            </svg>
            <span class="pdt-perf-gauge-label">${escapeHtml(label)}</span>`;
        return wrap;
    }

    /**
     * Builds one headline stat tile (value + label), colouring the value by band for quality metrics.
     * @param {import('../services/AgentService.js').PerfMetric} metric
     * @returns {HTMLElement}
     * @private
     */
    _buildPerfTile(metric) {
        const band = this._perfBand(metric);
        const tile = document.createElement('div');
        tile.className = 'pdt-agent-runs-stat';
        tile.innerHTML = `
            <span class="pdt-agent-runs-stat-value${band ? ` pdt-perf-value-${band}` : ''}">${escapeHtml(metric.display)}</span>
            <span class="pdt-agent-runs-stat-label">${escapeHtml(this._perfLabel(metric.name))}</span>`;
        return tile;
    }

    /**
     * Builds one category's block: a test-coverage line, precision/recall/F1 as coloured chips, and a
     * grid of every remaining metric (baselines, Cohen's κ, grade, false positives/negatives, plus any
     * metric an unknown model type reports — so nothing is dropped).
     * @param {import('../services/AgentService.js').PerfCategory} category
     * @returns {HTMLElement}
     * @private
     */
    _buildPerfCategory(category) {
        const M = Config.MESSAGES.AGENTS;
        const box = document.createElement('div');
        box.className = 'pdt-model-perf-category';
        const byName = new Map(category.metrics.map(metric => [metric.name, metric]));

        const total = byName.get('numberOfCasesTotal');
        const test = byName.get('numberOfCasesTestSet');
        if (total || test) {
            const coverage = document.createElement('p');
            coverage.className = 'pdt-model-perf-coverage';
            coverage.textContent = M.perfCoverage(total ? total.display : '—', test ? test.display : '—');
            box.appendChild(coverage);
        }

        const chipNames = ['precision', 'recall', 'f1Score'];
        const chipMetrics = chipNames.map(name => byName.get(name)).filter(Boolean);
        if (chipMetrics.length) {
            const chips = document.createElement('div');
            chips.className = 'pdt-model-perf-chips';
            chipMetrics.forEach(metric => chips.appendChild(this._buildPerfChip(metric)));
            box.appendChild(chips);
        }

        const placed = new Set([...chipNames, 'numberOfCasesTotal', 'numberOfCasesTestSet']);
        const rest = category.metrics.filter(metric => !placed.has(metric.name));
        if (rest.length) {
            const grid = document.createElement('div');
            grid.className = 'info-grid pdt-agent-info-grid pdt-model-perf-grid';
            grid.innerHTML = rest
                .map(metric => `<strong>${escapeHtml(this._perfLabel(metric.name))}:</strong><span>${escapeHtml(metric.display)}</span>`)
                .join('');
            box.appendChild(grid);
        }
        return box;
    }

    /**
     * Builds a labelled, coloured metric chip (e.g. "Precision 92.3%").
     * @param {import('../services/AgentService.js').PerfMetric} metric
     * @returns {HTMLElement}
     * @private
     */
    _buildPerfChip(metric) {
        const item = document.createElement('span');
        item.className = 'pdt-model-perf-metric';
        item.innerHTML = `
            <span class="pdt-model-perf-metric-label">${escapeHtml(this._perfLabel(metric.name))}</span>
            <span class="pdt-eval-score pdt-eval-score-${this._perfBand(metric) || 'mid'}">${escapeHtml(metric.display)}</span>`;
        return item;
    }

    /**
     * Picks the metric to chip on the section summary — accuracy when present (the most intuitive),
     * otherwise the first global score.
     * @param {import('../services/AgentService.js').ModelPerformance} perf
     * @returns {import('../services/AgentService.js').PerfMetric|null}
     * @private
     */
    _perfHeadlineMetric(perf) {
        if (!perf.headline.length) {
            return null;
        }
        return perf.headline.find(metric => metric.name === 'accuracy') || perf.headline[0];
    }

    /**
     * Maps a performance metric to a colour band, but only for quality metrics — baselines, Cohen's κ
     * and counts return null so they render plain.
     * @param {import('../services/AgentService.js').PerfMetric} metric
     * @returns {'high'|'mid'|'low'|null}
     * @private
     */
    _perfBand(metric) {
        if (metric.pct === null || !PERF_QUALITY_METRICS.has(metric.name)) {
            return null;
        }
        return metric.pct >= 80 ? 'high' : (metric.pct >= 60 ? 'mid' : 'low');
    }

    /**
     * Friendly label for a performance metric — the known-name map, else the humanized camelCase name.
     * @param {string} name
     * @returns {string}
     * @private
     */
    _perfLabel(name) {
        return Config.MESSAGES.AGENTS.perfMetricLabels[name] || this._humanizeMetricName(name);
    }

    /**
     * Humanizes a camelCase metric name into Title Case (e.g. `someNewMetric` → `Some New Metric`).
     * @param {string} name
     * @returns {string}
     * @private
     */
    _humanizeMetricName(name) {
        return String(name)
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/^./, char => char.toUpperCase());
    }

    /**
     * Publishes an edited prompt configuration and waits for the new run configuration to report
     * Published. A timeout means "not confirmed yet", never "failed" — the publish keeps running
     * server-side, so the save is reported as accepted rather than as an error.
     * @param {AiModel} model
     * @param {string} customConfiguration - The edited GptDynamicPrompt JSON.
     * @returns {Promise<void>}
     * @private
     */
    async _publishPromptConfig(model, customConfiguration) {
        const M = Config.MESSAGES.AGENTS;
        const runConfigurationId = await DataService.publishAiPrompt(model, customConfiguration);
        const published = await this._waitForPromptPublish(runConfigurationId);
        // The model now runs a different configuration id; keep the cached record in step so a
        // re-open flags the right iteration as live.
        model.activeConfigId = runConfigurationId;
        if (!published) {
            NotificationService.show(M.promptPublishPending, 'info');
        }
        // Refresh the open dialog so it shows the new version rather than the pre-save one.
        await this._reloadOpenModel?.();
    }

    /**
     * Polls a new run configuration until Dataverse reports it Published.
     * @param {string} configId - The run configuration GUID returned by AIModelPublish.
     * @param {{attempts?: number, intervalMs?: number, wait?: (ms: number) => Promise<void>}} [opts] - Overridable for tests.
     * @returns {Promise<boolean>} True once the publish is confirmed.
     * @private
     */
    async _waitForPromptPublish(configId, opts = {}) {
        const {
            attempts = Config.AGENT_PUBLISH.maxPollingAttempts,
            intervalMs = Config.AGENT_PUBLISH.pollingInterval,
            wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))
        } = opts;
        const generation = this._lifecycle;

        for (let i = 0; i < attempts; i++) {
            if (this._lifecycle !== generation) {
                return false;
            }
            try {
                const { isPublished } = await DataService.getAiConfigurationStatus(configId);
                if (isPublished) {
                    return true;
                }
            } catch {
                // Transient read failure — keep polling.
            }
            // Checked before waiting, so a publish that already landed costs no delay.
            if (i < attempts - 1) {
                await wait(intervalMs);
            }
        }
        return false;
    }

    /**
     * Loads and renders the recent AI Builder runs (msdyn_aievent) for a model.
     * @param {HTMLElement} panel
     * @param {AiModel} model
     * @private
     */
    async _loadModelRuns(panel, model) {
        const M = Config.MESSAGES.AGENTS;
        try {
            BusyIndicator.set();
            const runs = await DataService.getAiBuilderRuns(model.id);
            panel.textContent = '';
            if (!runs.length) {
                panel.innerHTML = `<p class="pdt-note">${M.noRuns}</p>`;
                return;
            }
            const heading = document.createElement('div');
            heading.className = 'pdt-agent-def-heading';
            heading.textContent = M.runsHeading(runs.length);
            const list = document.createElement('div');
            list.className = 'pdt-agent-runs-list';
            runs.forEach(run => list.appendChild(this._buildRunRow(run)));
            panel.append(heading, this._buildRunsSummary(runs), this._buildRunsTrends(runs), list);
        } catch (e) {
            panel.innerHTML = `<div class="pdt-error">${M.loadRunsFailed(escapeHtml(e.message))}</div>`;
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Builds an expandable row for a single AI Builder run.
     * @param {import('../services/AgentService.js').AiBuilderRun} run
     * @returns {HTMLElement}
     * @private
     */
    _buildRunRow(run) {
        const M = Config.MESSAGES.AGENTS;
        const details = document.createElement('details');
        details.className = 'pdt-agent-run-row';

        const badge = run.quickTest
            ? `<span class="pdt-capi-badge pdt-capi-badge-action">${M.runQuickTest}</span>`
            : `<span class="pdt-capi-badge pdt-capi-badge-managed">${M.runAutomation}</span>`;
        const summary = document.createElement('summary');
        // Timestamp anchors the left; status/feature then the type badge group on the right, so the
        // badge is the trailing pill (e.g. "10:32 AM   Processed   QUICK TEST").
        summary.innerHTML = `
            <span class="pdt-agent-run-when">${escapeHtml(run.processedOn || run.createdOn || '—')}</span>
            ${run.processingStatus ? `<span class="pdt-agent-run-status">${escapeHtml(run.processingStatus)}</span>` : ''}
            ${run.featureName ? `<span class="pdt-agent-run-feature">${escapeHtml(run.featureName)}</span>` : ''}
            ${badge}
        `;
        details.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'pdt-agent-run-body';
        const meta = document.createElement('div');
        meta.className = 'info-grid pdt-agent-info-grid';
        meta.innerHTML = `
            ${run.llmModelName ? `<strong>${M.runModel}:</strong><span>${escapeHtml(run.llmModelName)}</span>` : ''}
            ${run.units !== null ? `<strong>${M.runUnits}:</strong><span>${escapeHtml(String(run.units))}</span>` : ''}
            ${run.consumption !== null ? `<strong>${M.runConsumption}:</strong><span>${escapeHtml(String(run.consumption))}</span>` : ''}
            ${run.consumptionSource ? `<strong>${M.runSource}:</strong><span>${escapeHtml(run.consumptionSource)}</span>` : ''}
            ${run.dataType ? `<strong>${M.runDataType}:</strong><span>${escapeHtml(run.dataType)}</span>` : ''}
            ${run.createdBy ? `<strong>${M.runBy}:</strong><span>${escapeHtml(run.createdBy)}</span>` : ''}
        `;
        body.appendChild(meta);

        // Input (what the run executed against) — the msdyn_datainfo column, fetched lazily on first
        // expand since it can be large (a full transcript for a transcript-classification model). The
        // section is built but NOT attached yet: it's inserted after the meta grid only once we know
        // the run actually has an input, so a run with no input never flashes an empty Input section.
        const inputSection = document.createElement('div');
        inputSection.className = 'pdt-agent-run-input-section';
        const inputLabel = document.createElement('div');
        inputLabel.className = 'pdt-agent-run-output-label';
        inputLabel.textContent = M.runInput;
        const inputSlot = document.createElement('div');
        inputSlot.className = 'pdt-agent-run-input';
        inputSection.append(inputLabel, inputSlot);

        // The Output section is always rendered. Omitting it when the run recorded nothing left an
        // expanded run showing only its Input, which reads as a rendering failure rather than as an
        // empty result — so an empty output says so instead.
        const outLabel = document.createElement('div');
        outLabel.className = 'pdt-agent-run-output-label';
        outLabel.textContent = M.runOutput;
        body.appendChild(outLabel);

        if (run.output) {
            body.appendChild(UIFactory.createCopyableCodeBlock(run.output, 'text'));
        } else {
            const empty = document.createElement('p');
            empty.className = 'pdt-note pdt-agent-run-no-output';
            empty.textContent = M.runNoOutput;
            body.appendChild(empty);
        }
        details.appendChild(body);

        let loaded = false;
        details.addEventListener('toggle', async () => {
            if (!details.open || loaded) {
                return;
            }
            loaded = true;
            try {
                const datainfo = await DataService.getAiBuilderRunInput(run.id);
                if (!datainfo || !datainfo.trim()) {
                    // No input for this run — leave just the Output (the section is never attached).
                    inputSection.remove();
                    return;
                }
                inputSlot.textContent = '';
                inputSlot.appendChild(this._buildRunInput(datainfo));
                if (!inputSection.isConnected) {
                    meta.after(inputSection); // insert between the meta grid and the Output
                }
            } catch (e) {
                inputSlot.innerHTML = `<div class="pdt-error">${M.runInputFailed(escapeHtml(e.message))}</div>`;
                if (!inputSection.isConnected) {
                    meta.after(inputSection);
                }
                loaded = false; // a failed fetch isn't cached — re-expanding retries
            }
        });
        return details;
    }

    /**
     * Builds the expanded view of a run's input (`msdyn_datainfo`). When the input is a Bot Framework
     * transcript (a transcript-classification model runs against conversations) it renders as the
     * readable User/Agent conversation with the raw JSON tucked below; otherwise it shows the input as
     * a pretty-printed JSON/text block. Callers omit the Input section entirely when there is no input,
     * so an empty value here just yields an empty block.
     * @param {string|null} datainfo - The raw `msdyn_datainfo` value.
     * @returns {HTMLElement}
     * @private
     */
    _buildRunInput(datainfo) {
        const M = Config.MESSAGES.AGENTS;
        const wrap = document.createElement('div');
        if (!datainfo || !datainfo.trim()) {
            return wrap;
        }
        const conversation = parseTranscriptConversation(datainfo);
        if (conversation) {
            conversation.turns.forEach(turn => wrap.appendChild(this._buildConversationTurn(turn)));
            const raw = document.createElement('details');
            raw.className = 'pdt-agent-raw-config';
            const rawSummary = document.createElement('summary');
            rawSummary.textContent = M.runInputRawJson;
            raw.append(rawSummary, UIFactory.createCopyableCodeBlock(datainfo, 'json'));
            wrap.appendChild(raw);
        } else {
            wrap.appendChild(UIFactory.createCopyableCodeBlock(datainfo, 'json'));
        }
        return wrap;
    }

    /**
     * Builds a consumption/usage summary card across the loaded AI Builder runs.
     * @param {import('../services/AgentService.js').AiBuilderRun[]} runs
     * @returns {HTMLElement}
     * @private
     */
    _buildRunsSummary(runs) {
        const M = Config.MESSAGES.AGENTS;
        const quick = runs.filter(run => run.quickTest).length;
        const automation = runs.length - quick;
        const credits = Math.round(runs.reduce((sum, run) => sum + (run.consumption || 0), 0) * 10000) / 10000;
        const units = runs.reduce((sum, run) => sum + (run.units || 0), 0);
        const models = [...new Set(runs.map(run => run.llmModelName).filter(Boolean))];

        const stat = (value, label) =>
            `<div class="pdt-agent-runs-stat">
                <span class="pdt-agent-runs-stat-value">${escapeHtml(String(value))}</span>
                <span class="pdt-agent-runs-stat-label">${label}</span>
            </div>`;

        const card = document.createElement('div');
        card.className = 'pdt-agent-runs-summary pdt-card';
        card.innerHTML = `
            <div class="pdt-agent-runs-stats">
                ${stat(quick, M.runsStatQuickTests)}
                ${stat(automation, M.runsStatAutomation)}
                ${stat(credits, M.runConsumption)}
                ${stat(units, M.runUnits)}
            </div>
            ${models.length ? `<div class="pdt-agent-runs-summary-meta">${M.runsStatModels}: ${escapeHtml(models.join(', '))}</div>` : ''}
        `;
        return card;
    }

    /**
     * Builds the usage-trends section for AI Builder runs: a 14-day sparkline of run counts and a
     * per-feature breakdown (run count + credits).
     * @param {import('../services/AgentService.js').AiBuilderRun[]} runs
     * @returns {HTMLElement}
     * @private
     */
    _buildRunsTrends(runs) {
        const M = Config.MESSAGES.AGENTS;
        const section = document.createElement('div');
        section.className = 'pdt-agent-runs-trends';

        const series = this._dailyCounts(runs.map(run => run.createdOnRaw));
        if (series.some(point => point.count > 0)) {
            const label = document.createElement('div');
            label.className = 'pdt-agent-runs-trend-label';
            label.textContent = M.runsTrendHeading;
            section.append(label, this._buildUsageSparkline(series));
        }

        const featureMap = new Map();
        runs.forEach(run => {
            const feature = run.featureName || M.runsFeatureUnlabeled;
            const current = featureMap.get(feature) || { count: 0, credits: 0 };
            current.count += 1;
            current.credits += (run.consumption || 0);
            featureMap.set(feature, current);
        });
        const features = [...featureMap.entries()].sort((a, b) => b[1].count - a[1].count);
        if (features.length) {
            const list = document.createElement('div');
            list.className = 'pdt-agent-usage-channels';
            features.forEach(([feature, agg]) => {
                const credits = Math.round(agg.credits * 10000) / 10000;
                const badge = document.createElement('span');
                badge.className = 'pdt-capi-badge pdt-capi-badge-action';
                badge.textContent = credits ? `${feature}: ${agg.count} · ${credits}` : `${feature}: ${agg.count}`;
                list.appendChild(badge);
            });
            section.appendChild(list);
        }
        return section;
    }

    /**
     * Builds a 14-day daily-count series (oldest first) from a list of ISO date strings.
     * @param {Array<string>} isoDates
     * @returns {Array<{date: string, count: number}>}
     * @private
     */
    _dailyCounts(isoDates) {
        const DAY = 86400000;
        const now = Date.now();
        const counts = new Map();
        (isoDates || []).forEach(iso => {
            const time = iso ? new Date(iso).getTime() : NaN;
            if (!Number.isNaN(time) && (now - time) / DAY <= 14) {
                const key = new Date(time).toISOString().slice(0, 10);
                counts.set(key, (counts.get(key) || 0) + 1);
            }
        });
        const series = [];
        for (let i = 13; i >= 0; i -= 1) {
            const key = new Date(now - i * DAY).toISOString().slice(0, 10);
            series.push({ date: key, count: counts.get(key) || 0 });
        }
        return series;
    }

    /**
     * Loads and renders the AI Builder **Test hub** view for a model/prompt: a summary of the latest
     * run, the saved test cases (expected outputs + inputs, loaded on expand), and the history of
     * test-run batches (each batch's per-case results — expected vs actual + accuracy — loaded on
     * expand). This is the same data as the maker portal's Test hub / Test results screens.
     * @param {HTMLElement} panel
     * @param {import('../services/AgentService.js').AiModel} model - The model whose tests to show.
     * @private
     */
    async _loadEvaluations(panel, model) {
        const M = Config.MESSAGES.AGENTS;
        try {
            BusyIndicator.set();
            const ev = await DataService.getPromptEvaluations(model.id);
            panel.textContent = '';
            if (!ev.testCases.length && !ev.batches.length) {
                panel.innerHTML = `<p class="pdt-note">${M.noEvaluations}</p>`;
                return;
            }

            // The passing score (from the evaluation criteria) turns each accuracy score into a
            // pass/fail; without it we fall back to a neutral colour scale.
            const passingScore = ev.criteria?.passingScore ?? null;

            // A per-batch run cache shared across the hero, the batch summaries and the expanded rows,
            // so a batch's runs are fetched at most once. All batches are pre-loaded (in parallel) so
            // every row can show its case count, average accuracy and pass/fail up front.
            const runCache = new Map();
            await Promise.all(ev.batches.map(async (batch) => {
                try {
                    runCache.set(batch.id, await DataService.getTestBatchRuns(batch.id));
                } catch {
                    // Leave uncached — the row will lazy-load its runs on expand instead.
                }
            }));

            // A test case id → name map, used as a fallback for run rows: a run's own name is blank,
            // so if the test-case lookup's formatted value is ever absent this keeps the case named.
            const caseNames = new Map(ev.testCases.map(tc => [tc.id, tc.name]));

            // Evaluation criteria bar (passing score + which checks apply) with its edit button.
            if (ev.criteria) {
                panel.appendChild(this._buildCriteriaBar(model, ev.criteria));
            }

            // Latest-run hero for the newest batch.
            const latest = ev.batches[0];
            if (latest && runCache.has(latest.id)) {
                panel.appendChild(this._buildEvalSummaryCard(latest, runCache.get(latest.id), passingScore));
            }

            if (ev.testCases.length) {
                panel.appendChild(this._buildTestCasesSection(model, ev.testCases, ev.criteria));
            }
            if (ev.batches.length) {
                panel.appendChild(this._buildEvalListSection(
                    M.evalRunsHeading(ev.batches.length),
                    ev.batches.map(b => this._buildBatchRow(b, runCache, caseNames, passingScore))
                ));
            }
        } catch (e) {
            panel.innerHTML = `<div class="pdt-error">${M.loadEvaluationsFailed(escapeHtml(e.message))}</div>`;
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Builds the evaluation-criteria bar: a one-line summary (passing score + which prebuilt checks
     * apply) and an "Evaluation criteria" button that opens the editor.
     * @param {import('../services/AgentService.js').AiModel} model
     * @param {import('../services/AgentService.js').EvaluationCriteria} criteria
     * @returns {HTMLElement}
     * @private
     */
    _buildCriteriaBar(model, criteria) {
        const M = Config.MESSAGES.AGENTS;
        const checks = [];
        if (criteria.expectedResponse.applicable) {
            checks.push(criteria.expectedResponse.comparison === 'exact' ? M.evalCriteriaExact : M.evalCriteriaSimilarity);
        }
        if (criteria.responseQuality.applicable) {
            checks.push(M.evalCriteriaResponseQuality);
        }
        if (criteria.jsonCorrectness.applicable) {
            checks.push(M.evalCriteriaJson);
        }

        const bar = document.createElement('div');
        bar.className = 'pdt-eval-criteria-bar pdt-card';
        const info = document.createElement('div');
        info.className = 'pdt-eval-criteria-info';
        const score = criteria.passingScore !== null
            ? `<strong>${M.evalPassingScore}: ${criteria.passingScore}%</strong>`
            : `<strong>${M.evalPassingScore}: —</strong>`;
        info.innerHTML = `${score}<span class="pdt-eval-criteria-checks">${escapeHtml(checks.join(' · ') || M.evalCriteriaNone)}</span>`;

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'modern-button secondary';
        editBtn.textContent = M.evalCriteriaButton;
        editBtn.addEventListener('click', () => this._handleEditCriteria(model, criteria));

        bar.append(info, editBtn);
        return bar;
    }

    /**
     * Opens the evaluation-criteria editor: a passing-score slider and the three prebuilt checks
     * (expected response with exact/semantic comparison, response quality, JSON correctness).
     * @param {import('../services/AgentService.js').AiModel} model
     * @param {import('../services/AgentService.js').EvaluationCriteria} criteria
     * @private
     */
    _handleEditCriteria(model, criteria) {
        const M = Config.MESSAGES.AGENTS;
        const score = criteria.passingScore ?? 60;
        const content = document.createElement('div');
        content.className = 'pdt-eval-criteria-form';
        content.innerHTML = `
            <div class="pdt-setting-group">
                <label class="pdt-eval-score-label" for="pdt-eval-score">
                    ${M.evalPassingScore}: <span class="pdt-eval-score-out">${score}%</span>
                </label>
                <input type="range" id="pdt-eval-score" class="pdt-eval-score-range" min="1" max="100" value="${score}">
            </div>
            <div class="pdt-setting-group">
                <div class="pdt-setting-title">${M.evalPrebuiltCriteria}</div>
                <label class="pdt-eval-check">
                    <input type="checkbox" class="pdt-eval-expected" ${criteria.expectedResponse.applicable ? 'checked' : ''}>
                    ${M.evalCriteriaExpected}
                </label>
                <div class="pdt-eval-subradios">
                    <label class="pdt-eval-radio">
                        <input type="radio" name="pdt-eval-cmp" value="exact" ${criteria.expectedResponse.comparison === 'exact' ? 'checked' : ''}>
                        ${M.evalCriteriaExact}
                    </label>
                    <label class="pdt-eval-radio">
                        <input type="radio" name="pdt-eval-cmp" value="similarity" ${criteria.expectedResponse.comparison !== 'exact' ? 'checked' : ''}>
                        ${M.evalCriteriaSimilarity}
                    </label>
                </div>
                <label class="pdt-eval-check">
                    <input type="checkbox" class="pdt-eval-quality" ${criteria.responseQuality.applicable ? 'checked' : ''}>
                    ${M.evalCriteriaResponseQuality}
                </label>
                <label class="pdt-eval-check">
                    <input type="checkbox" class="pdt-eval-json" ${criteria.jsonCorrectness.applicable ? 'checked' : ''}>
                    ${M.evalCriteriaJson}
                </label>
            </div>
        `;

        const range = content.querySelector('.pdt-eval-score-range');
        const out = content.querySelector('.pdt-eval-score-out');
        range.addEventListener('input', () => {
            out.textContent = `${range.value}%`;
        });

        const expectedCb = content.querySelector('.pdt-eval-expected');
        const subradios = content.querySelector('.pdt-eval-subradios');
        const syncRadios = () => {
            subradios.style.display = expectedCb.checked ? '' : 'none';
        };
        expectedCb.addEventListener('change', syncRadios);
        syncRadios();

        // The editor replaces the prompt dialog (the app shows one modal at a time). Reopen the prompt
        // dialog on the Evaluations tab whenever the editor closes, so the user always lands back where
        // they were: Save persists first and then reopens (showing the new criteria); cancel/dismiss
        // reopens straight away. `onClose` fires on every close — Cancel, Close, backdrop, Esc, or after
        // Save — so the `saved` flag stops it from reopening twice on the Save path.
        let saved = false;
        DialogService.show(M.evalCriteriaTitle, content, (container) => {
            const values = {
                passingScore: Number(container.querySelector('.pdt-eval-score-range').value),
                expectedApplicable: container.querySelector('.pdt-eval-expected').checked,
                comparisonType: container.querySelector('input[name="pdt-eval-cmp"]:checked')?.value || 'similarity',
                responseQualityApplicable: container.querySelector('.pdt-eval-quality').checked,
                jsonApplicable: container.querySelector('.pdt-eval-json').checked
            };
            saved = true;
            this._saveCriteria(criteria, values).then(() => this._handleViewModel(model.id, 'evaluations'));
            return true;
        }, {
            okText: M.save,
            cancelText: M.cancel,
            onClose: () => {
                if (!saved) {
                    this._handleViewModel(model.id, 'evaluations');
                }
            }
        });
    }

    /**
     * Persists edited evaluation criteria. The caller ({@link _handleEditCriteria}) reopens the prompt
     * dialog afterwards — opening the editor closed it, the app showing one modal at a time — so a save
     * here just writes and notifies.
     * @param {import('../services/AgentService.js').EvaluationCriteria} criteria
     * @param {object} values - The edited criteria values.
     * @private
     */
    async _saveCriteria(criteria, values) {
        const M = Config.MESSAGES.AGENTS;
        try {
            BusyIndicator.set();
            await DataService.updateEvaluationCriteria(criteria.id, criteria.raw, values);
            NotificationService.show(M.criteriaSaved, 'success');
        } catch (e) {
            NotificationService.show(M.criteriaSaveFailed(escapeHtml(e.message)), 'error');
        } finally {
            BusyIndicator.clear();
        }
    }

    /**
     * Builds the Test cases section with a selection toolbar (select-all + Run all/selected +
     * Delete all/selected) and one selectable row per case.
     * @param {import('../services/AgentService.js').AiModel} model
     * @param {import('../services/AgentService.js').EvalTestCase[]} testCases
     * @param {import('../services/AgentService.js').EvaluationCriteria|null} criteria - Used for scoring.
     * @returns {HTMLElement}
     * @private
     */
    _buildTestCasesSection(model, testCases, criteria) {
        const M = Config.MESSAGES.AGENTS;
        const selected = new Set();
        const section = document.createElement('div');

        const toolbar = document.createElement('div');
        toolbar.className = 'pdt-eval-toolbar';
        const selectAll = document.createElement('input');
        selectAll.type = 'checkbox';
        selectAll.className = 'pdt-eval-select-all';
        selectAll.setAttribute('aria-label', M.evalSelectAll);
        const heading = document.createElement('span');
        heading.className = 'pdt-eval-toolbar-heading';
        heading.textContent = M.evalTestCasesHeading(testCases.length);

        // Run applies only to prompts (QuickTest). It is shown for prompts and disabled — with an
        // explanation — until the prompt is published; other model kinds get no Run button at all.
        let runBtn = null;
        if (model.kind === 'prompt') {
            runBtn = document.createElement('button');
            runBtn.type = 'button';
            runBtn.className = 'modern-button pdt-eval-run';
            if (!model.activeConfigId) {
                runBtn.disabled = true;
                runBtn.title = M.evalRunUnavailable;
            }
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'modern-button secondary pdt-eval-delete pdt-capi-delete-hover';
        toolbar.append(selectAll, heading, ...(runBtn ? [runBtn] : []), deleteBtn);

        const list = document.createElement('div');
        list.className = 'pdt-agent-eval-list';

        // Holds the inline "Running…" note during a run (mirrors the prompt Quick test) instead of a toast.
        const status = document.createElement('div');
        status.className = 'pdt-eval-run-status';

        const updateToolbar = () => {
            if (runBtn) {
                runBtn.textContent = selected.size ? M.evalRunSelected(selected.size) : M.evalRunAll;
            }
            deleteBtn.textContent = selected.size ? M.evalDeleteSelected(selected.size) : M.evalDeleteAll;
            selectAll.checked = testCases.length > 0 && selected.size === testCases.length;
            selectAll.indeterminate = selected.size > 0 && selected.size < testCases.length;
        };

        testCases.forEach((testCase) => {
            list.appendChild(this._buildTestCaseRow(testCase, selected, updateToolbar));
        });

        selectAll.addEventListener('change', () => {
            selected.clear();
            if (selectAll.checked) {
                testCases.forEach(tc => selected.add(tc.id));
            }
            list.querySelectorAll('.pdt-eval-select').forEach((cb) => {
                cb.checked = selectAll.checked;
            });
            updateToolbar();
        });

        if (runBtn) {
            runBtn.addEventListener('click', () => {
                const chosen = selected.size ? testCases.filter(tc => selected.has(tc.id)) : testCases;
                this._handleRunTests(model, criteria, chosen, { runBtn, deleteBtn, status });
            });
        }

        deleteBtn.addEventListener('click', () => {
            const ids = selected.size ? [...selected] : testCases.map(tc => tc.id);
            this._handleDeleteTestCases(model, ids, { runBtn, deleteBtn });
        });

        updateToolbar();
        section.append(toolbar, status, list);
        return section;
    }

    /**
     * Runs the given test cases against the prompt (create batch + runs, predict, grade, score,
     * complete), then refreshes the Evaluations tab to show the results. Like the prompt Quick test,
     * it runs directly — no confirm dialog — even though it calls the model (consuming AI Builder
     * credits). While it works, the toolbar buttons are disabled and an inline "Running…" note shows
     * in place (not a toast); the refresh at the end clears the note and restores fresh buttons.
     * @param {import('../services/AgentService.js').AiModel} model
     * @param {import('../services/AgentService.js').EvaluationCriteria|null} criteria
     * @param {import('../services/AgentService.js').EvalTestCase[]} testCases
     * @param {{runBtn?: HTMLButtonElement, deleteBtn?: HTMLButtonElement, status?: HTMLElement}} [ui]
     * @private
     */
    async _handleRunTests(model, criteria, testCases, ui = {}) {
        const M = Config.MESSAGES.AGENTS;
        if (!testCases.length) {
            return;
        }
        const { runBtn = null, deleteBtn = null, status = null } = ui;
        // Lock the toolbar and show an inline running note (mirrors the prompt Quick test) so the run
        // reads as busy in place rather than via a toast.
        if (runBtn) {
            runBtn.disabled = true;
        }
        if (deleteBtn) {
            deleteBtn.disabled = true;
        }
        if (status) {
            status.innerHTML = `<p class="pdt-note pdt-prompt-test-running">${M.runTestsRunning(testCases.length)}</p>`;
        }
        try {
            // Resolve the prompt's live configuration (the JSON QuickTest runs) once for the batch.
            const def = await DataService.getAiModelDefinition(model.id, model.activeConfigId);
            const entry = this._findPromptConfig(def.configurations);
            if (entry) {
                const cases = await this._collectRunCases(entry.text, testCases);
                const result = await DataService.runPromptTests({
                    model, activeConfigId: model.activeConfigId, promptConfigJson: entry.text, criteria, testCases: cases
                });
                NotificationService.show(M.runTestsDone(result.ran, result.passed), 'success');
            } else {
                NotificationService.show(M.noPromptSettings, 'warn');
            }
        } catch (e) {
            NotificationService.show(M.runTestsFailed(escapeHtml(e.message)), 'error');
        }
        // Refresh the Evaluations view so the new batch's results appear (this also clears the running
        // note and restores fresh, enabled toolbar buttons).
        this._handleViewModel(model.id, 'evaluations');
    }

    /**
     * Builds the run-ready test cases: each case's id + expected output + input values. Inputs are only
     * fetched when the prompt actually has input variables (the common no-input prompt skips the calls).
     * @param {string} promptConfigJson - The live prompt configuration.
     * @param {import('../services/AgentService.js').EvalTestCase[]} testCases
     * @returns {Promise<Array<{id: string, expectedOutput: string, inputs: Object.<string,string>}>>}
     * @private
     */
    async _collectRunCases(promptConfigJson, testCases) {
        let hasInputs = false;
        try {
            hasInputs = (JSON.parse(promptConfigJson).definitions?.inputs || []).length > 0;
        } catch {
            hasInputs = false;
        }
        const cases = [];
        for (const tc of testCases) {
            let inputs = {};
            if (hasInputs) {
                try {
                    const rows = await DataService.getTestCaseInputs(tc.id);
                    inputs = this._parseInputData(rows[0]?.raw);
                } catch {
                    inputs = {};
                }
            }
            cases.push({ id: tc.id, expectedOutput: tc.expectedOutput, inputs });
        }
        return cases;
    }

    /**
     * Parses a test case's raw `msdyn_inputdata` JSON into an input id → value map.
     * @param {string} raw
     * @returns {Object.<string, string>}
     * @private
     */
    _parseInputData(raw) {
        const map = {};
        try {
            const parsed = JSON.parse(raw || '[]');
            if (Array.isArray(parsed)) {
                parsed.forEach((item) => {
                    if (item && 'id' in item && !('type' in item)) {
                        map[item.id] = typeof item.value === 'string' ? item.value : '';
                    }
                });
            }
        } catch {
            // Leave the map empty on malformed input data.
        }
        return map;
    }

    /**
     * Deletes one or more test cases after confirmation, then reopens the dialog on the Evaluations
     * tab. (The confirm dialog closed the model dialog — one modal at a time — so we reopen rather than
     * refresh a detached panel.)
     * @param {import('../services/AgentService.js').AiModel} model
     * @param {string[]} ids - Test case GUIDs to delete.
     * @param {{runBtn?: HTMLButtonElement, deleteBtn?: HTMLButtonElement}} [ui]
     * @private
     */
    async _handleDeleteTestCases(model, ids, ui = {}) {
        const M = Config.MESSAGES.AGENTS;
        if (!ids.length) {
            return;
        }
        const { runBtn = null, deleteBtn = null } = ui;
        // Lock the toolbar as soon as delete is triggered so it can't be fired twice while the confirm
        // and the deletion run; a cancel or the post-delete refresh restores fresh, enabled buttons.
        if (runBtn) {
            runBtn.disabled = true;
        }
        if (deleteBtn) {
            deleteBtn.disabled = true;
        }
        const confirmMsg = ids.length === 1 ? M.deleteTestCaseConfirm : M.deleteTestCasesConfirm(ids.length);
        const confirmed = await showConfirmDialog(M.deleteTestCasesTitle, confirmMsg);
        // The confirm dialog replaced the model dialog, so reopen it on the Evaluations tab on every
        // path — cancel, success, or failure — rather than leaving the user with no dialog.
        if (confirmed) {
            try {
                BusyIndicator.set();
                await Promise.all(ids.map(id => DataService.deleteTestCase(id)));
                NotificationService.show(ids.length === 1 ? M.testCaseDeleted : M.testCasesDeleted(ids.length), 'success');
            } catch (e) {
                NotificationService.show(M.deleteTestCasesFailed(escapeHtml(e.message)), 'error');
            } finally {
                BusyIndicator.clear();
            }
        }
        this._handleViewModel(model.id, 'evaluations');
    }

    /**
     * Builds a titled section containing a list of pre-built row elements.
     * @param {string} headingText
     * @param {HTMLElement[]} rows
     * @returns {HTMLElement}
     * @private
     */
    _buildEvalListSection(headingText, rows) {
        const section = document.createElement('div');
        const heading = document.createElement('div');
        heading.className = 'pdt-agent-def-heading';
        heading.textContent = headingText;
        section.appendChild(heading);
        const list = document.createElement('div');
        list.className = 'pdt-agent-eval-list';
        rows.forEach(row => list.appendChild(row));
        section.appendChild(list);
        return section;
    }

    /**
     * Builds the latest-run hero card: the newest batch's status, timing and at-a-glance stats
     * (case count, average accuracy, duration, tokens, model).
     * @param {import('../services/AgentService.js').TestRunBatch} batch
     * @param {import('../services/AgentService.js').TestRun[]} runs - The batch's runs.
     * @param {number|null} passingScore - The passing score, when evaluation criteria exist.
     * @returns {HTMLElement}
     * @private
     */
    _buildEvalSummaryCard(batch, runs, passingScore) {
        const M = Config.MESSAGES.AGENTS;
        const avg = this._avgScore(runs);
        const counts = this._passFailCounts(runs, passingScore);
        const models = [...new Set(runs.map(r => r.modelName).filter(Boolean))];
        const tokens = runs.reduce((sum, r) => sum + (r.tokens || 0), 0);
        const duration = this._formatDuration(batch.startedOnRaw, batch.completedOnRaw);

        const stat = (value, label) =>
            `<div class="pdt-agent-runs-stat">
                <span class="pdt-agent-runs-stat-value">${escapeHtml(String(value))}</span>
                <span class="pdt-agent-runs-stat-label">${label}</span>
            </div>`;

        const card = document.createElement('div');
        card.className = 'pdt-agent-runs-summary pdt-eval-summary pdt-card';
        card.innerHTML = `
            <div class="pdt-eval-summary-head">
                <span class="pdt-eval-summary-title">${M.evalLatestRun}</span>
                ${this._evalStateBadge(batch.state, batch.statusLabel)}
                <span class="pdt-agent-eval-when">${escapeHtml(batch.completedOn || batch.startedOn || batch.createdOn || '—')}</span>
            </div>
            <div class="pdt-agent-runs-stats">
                ${stat(runs.length, M.evalCases)}
                ${stat(avg === null ? '—' : `${avg}`, M.evalAvgAccuracy)}
                ${counts ? stat(`${counts.pass}/${runs.length}`, M.evalPassed) : ''}
                ${duration ? stat(duration, M.evalDuration) : ''}
                ${tokens ? stat(tokens, M.testTokens) : ''}
            </div>
            ${models.length ? `<div class="pdt-agent-runs-summary-meta">${M.runModel}: ${escapeHtml(models.join(', '))}</div>` : ''}
            ${batch.errorMessage ? `<div class="pdt-error pdt-eval-summary-error">${escapeHtml(batch.errorMessage)}</div>` : ''}
        `;
        return card;
    }

    /**
     * Builds a selectable row for a single test case: a selection checkbox alongside an expandable
     * card (the checkbox lives outside the `<summary>` so selecting never toggles the card). The saved
     * inputs are loaded on first expand.
     * @param {import('../services/AgentService.js').EvalTestCase} testCase
     * @param {Set<string>} selected - Set of selected test case ids (mutated on toggle).
     * @param {Function} onSelectChange - Called after the selection changes (refreshes the toolbar).
     * @returns {HTMLElement}
     * @private
     */
    _buildTestCaseRow(testCase, selected, onSelectChange) {
        const M = Config.MESSAGES.AGENTS;
        const row = document.createElement('div');
        row.className = 'pdt-eval-tc-row';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'pdt-eval-select';
        checkbox.setAttribute('aria-label', M.evalSelectCase(testCase.name));
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                selected.add(testCase.id);
            } else {
                selected.delete(testCase.id);
            }
            onSelectChange();
        });

        const details = document.createElement('details');
        details.className = 'pdt-agent-eval-row';
        const summary = document.createElement('summary');
        // The preview span is always present (even when empty) so it can be kept in sync as the
        // expected output is edited below.
        summary.innerHTML = `
            <span class="pdt-agent-eval-name">${escapeHtml(testCase.name)}</span>
            <span class="pdt-eval-expected-preview">${escapeHtml(this._truncate(testCase.expectedOutput || '', 60))}</span>
            <span class="pdt-agent-eval-when">${escapeHtml(testCase.modifiedOn || testCase.createdOn || '')}</span>
        `;
        details.appendChild(summary);
        const previewEl = summary.querySelector('.pdt-eval-expected-preview');

        const body = document.createElement('div');
        body.className = 'pdt-agent-eval-body';
        if (testCase.description && testCase.description !== testCase.name) {
            const desc = document.createElement('p');
            desc.className = 'pdt-note';
            desc.textContent = testCase.description;
            body.appendChild(desc);
        }
        // Expected output is editable — the maker portal lets you set/adjust the expected response.
        const expectedLabel = document.createElement('div');
        expectedLabel.className = 'pdt-agent-run-output-label';
        expectedLabel.textContent = M.evalExpectedOutput;
        body.append(expectedLabel, this._buildEditableSection(testCase.expectedOutput || '', {
            editable: true,
            language: 'text',
            onSave: async (value) => {
                await DataService.updateTestCaseExpectedOutput(testCase.id, value);
                testCase.expectedOutput = value;
                previewEl.textContent = this._truncate(value || '', 60);
            }
        }));
        const inputsSlot = document.createElement('div');
        inputsSlot.className = 'pdt-eval-inputs-slot';
        body.appendChild(inputsSlot);
        details.appendChild(body);

        let loaded = false;
        details.addEventListener('toggle', async () => {
            if (!details.open || loaded) {
                return;
            }
            loaded = true;
            inputsSlot.innerHTML = `<p class="pdt-note">${M.evalLoadingInputs}</p>`;
            try {
                const inputs = await DataService.getTestCaseInputs(testCase.id);
                inputsSlot.textContent = '';
                inputsSlot.appendChild(this._buildTestCaseInputs(inputs));
            } catch (e) {
                inputsSlot.innerHTML = `<div class="pdt-error">${M.evalLoadInputsFailed(escapeHtml(e.message))}</div>`;
                // Allow a re-expand to retry after a transient failure.
                loaded = false;
            }
        });

        row.append(checkbox, details);
        return row;
    }

    /**
     * Builds the parsed-inputs block for a test case (the `{token}` values a run feeds the prompt).
     * @param {import('../services/AgentService.js').TestCaseInput[]} inputs
     * @returns {HTMLElement}
     * @private
     */
    _buildTestCaseInputs(inputs) {
        const M = Config.MESSAGES.AGENTS;
        const wrap = document.createElement('div');
        const values = inputs.flatMap(input => input.values);
        if (!values.length) {
            // No input variables — show nothing rather than a note (the section is simply omitted).
            return wrap;
        }
        const label = document.createElement('div');
        label.className = 'pdt-agent-run-output-label';
        label.textContent = M.evalInputs;
        wrap.appendChild(label);
        const list = document.createElement('div');
        list.className = 'pdt-eval-input-list';
        values.forEach(value => {
            const row = document.createElement('div');
            row.className = 'pdt-eval-input-row';
            row.innerHTML = `
                ${value.name ? `<span class="pdt-eval-input-name">${escapeHtml(value.name)}</span>` : ''}
                <span class="pdt-eval-input-value">${escapeHtml(value.value)}</span>
            `;
            list.appendChild(row);
        });
        wrap.appendChild(list);
        return wrap;
    }

    /**
     * Builds an expandable row for a single test-run batch. The per-case runs (and their mini summary)
     * are loaded on first expand — unless already cached (e.g. the latest batch, loaded for the hero).
     * @param {import('../services/AgentService.js').TestRunBatch} batch
     * @param {Map<string, import('../services/AgentService.js').TestRun[]>} runCache
     * @param {Map<string, string>} caseNames - Test case id → name, a fallback for naming run rows.
     * @param {number|null} passingScore - The passing score, when evaluation criteria exist.
     * @returns {HTMLElement}
     * @private
     */
    _buildBatchRow(batch, runCache, caseNames, passingScore) {
        const M = Config.MESSAGES.AGENTS;
        const details = document.createElement('details');
        details.className = 'pdt-agent-eval-row';
        const summary = document.createElement('summary');
        // A run is identified by *when* it happened — the auto-generated batch name ("<prompt> -
        // <timestamp>") is noise inside the prompt's own dialog, so it becomes a hover tooltip and the
        // completion time leads (bold, left). The at-a-glance stats and the status badge trail on the
        // right, matching the Runs tab (badge trailing).
        const when = batch.completedOn || batch.startedOn || batch.createdOn || '—';
        summary.innerHTML = `
            <span class="pdt-agent-eval-name pdt-eval-batch-name" title="${escapeHtml(batch.name)}">${escapeHtml(when)}</span>
            ${this._buildBatchInlineStats(batch, runCache.get(batch.id), passingScore)}
            ${this._evalStateBadge(batch.state, batch.statusLabel)}
        `;
        details.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'pdt-agent-eval-body pdt-eval-batch-body';
        details.appendChild(body);

        const render = (runs) => {
            body.textContent = '';
            if (batch.errorMessage) {
                const err = document.createElement('div');
                err.className = 'pdt-error';
                err.textContent = batch.errorMessage;
                body.appendChild(err);
            }
            if (!runs.length) {
                body.insertAdjacentHTML('beforeend', `<p class="pdt-note">${M.evalNoRuns}</p>`);
                return;
            }
            // The collapsed row's inline stats already summarize the batch — the body is just the runs.
            const list = document.createElement('div');
            list.className = 'pdt-eval-run-list';
            runs.forEach(run => list.appendChild(this._buildTestRunItem(run, caseNames, passingScore)));
            body.appendChild(list);
        };

        let rendered = false;
        details.addEventListener('toggle', async () => {
            if (!details.open || rendered) {
                return;
            }
            rendered = true;
            if (runCache.has(batch.id)) {
                render(runCache.get(batch.id));
                return;
            }
            body.innerHTML = `<p class="pdt-note">${M.evalLoadingRuns}</p>`;
            try {
                const runs = await DataService.getTestBatchRuns(batch.id);
                runCache.set(batch.id, runs);
                render(runs);
            } catch (e) {
                body.innerHTML = `<div class="pdt-error">${M.evalLoadRunsFailed(escapeHtml(e.message))}</div>`;
                // Allow a re-expand to retry after a transient failure.
                rendered = false;
            }
        });
        return details;
    }

    /**
     * Builds the collapsed-row inline stats for a batch (cases · avg · pass/fail · duration), shown
     * only when the batch's runs are already loaded. The average is a coloured score chip (green /
     * amber / red against the passing score). This is the whole at-a-glance summary — the expanded
     * body no longer repeats it. Returns '' when the runs aren't loaded yet.
     * @param {import('../services/AgentService.js').TestRunBatch} batch - Supplies the run duration.
     * @param {import('../services/AgentService.js').TestRun[]|undefined} runs
     * @param {number|null} passingScore
     * @returns {string} HTML fragment.
     * @private
     */
    _buildBatchInlineStats(batch, runs, passingScore) {
        if (!runs || !runs.length) {
            return '';
        }
        const M = Config.MESSAGES.AGENTS;
        const avg = this._avgScore(runs);
        const counts = this._passFailCounts(runs, passingScore);
        const duration = this._formatDuration(batch.startedOnRaw, batch.completedOnRaw);
        // Built as HTML: text bits are escaped; the average is a coloured score chip.
        const bits = [escapeHtml(M.evalCasesCount(runs.length))];
        if (avg !== null) {
            bits.push(`${escapeHtml(M.evalAvgLabel)} ${this._scoreChip(avg, passingScore)}`);
        }
        if (counts) {
            bits.push(escapeHtml(M.evalPassShort(counts.pass, runs.length)));
        }
        if (duration) {
            bits.push(escapeHtml(duration));
        }
        return `<span class="pdt-eval-batch-inline">${bits.join(' · ')}</span>`;
    }

    /**
     * Builds a single test-run card: the case name, its accuracy score, model/tokens, and the
     * expected vs actual output side by side.
     * @param {import('../services/AgentService.js').TestRun} run
     * @param {Map<string, string>} [caseNames] - Test case id → name fallback (run name is blank).
     * @param {number|null} [passingScore] - The passing score, when evaluation criteria exist.
     * @returns {HTMLElement}
     * @private
     */
    _buildTestRunItem(run, caseNames, passingScore) {
        const M = Config.MESSAGES.AGENTS;
        const item = document.createElement('div');
        item.className = 'pdt-eval-run-item pdt-card';

        const caseName = run.testCaseName || caseNames?.get(run.testCaseId) || M.evalUnnamedCase;
        const scored = run.accuracyScore !== null;
        const passBadge = (scored && passingScore !== null && passingScore !== undefined)
            ? this._passFailBadge(run.accuracyScore >= passingScore)
            : '';
        const head = document.createElement('div');
        head.className = 'pdt-eval-run-head';
        head.innerHTML = `
            <span class="pdt-eval-run-name">${escapeHtml(caseName)}</span>
            ${passBadge}
            ${scored ? this._scoreChip(run.accuracyScore, passingScore) : ''}
            ${run.modelName ? `<span class="pdt-capi-badge pdt-capi-badge-managed">${escapeHtml(run.modelName)}</span>` : ''}
            ${run.tokens !== null ? `<span class="pdt-eval-run-tokens">${M.evalTokensShort(run.tokens)}</span>` : ''}
        `;
        item.appendChild(head);

        if (run.errorMessage) {
            const err = document.createElement('div');
            err.className = 'pdt-error';
            err.textContent = run.errorMessage;
            item.appendChild(err);
        }

        const io = document.createElement('div');
        io.className = 'pdt-eval-io';
        io.append(
            this._buildIoColumn(M.evalExpected, run.expectedOutput),
            this._buildIoColumn(M.evalActual, run.actualOutput)
        );
        item.appendChild(io);

        if (run.comment) {
            const comment = document.createElement('p');
            comment.className = 'pdt-note';
            comment.textContent = run.comment;
            item.appendChild(comment);
        }
        return item;
    }

    /**
     * Builds one labelled output column (expected or actual) for a test-run card.
     * @param {string} label
     * @param {string} value
     * @returns {HTMLElement}
     * @private
     */
    _buildIoColumn(label, value) {
        const col = document.createElement('div');
        col.className = 'pdt-eval-io-col';
        const heading = document.createElement('div');
        heading.className = 'pdt-agent-run-output-label';
        heading.textContent = label;
        col.appendChild(heading);
        if (value) {
            col.appendChild(UIFactory.createCopyableCodeBlock(value, 'text'));
        } else {
            col.insertAdjacentHTML('beforeend', `<p class="pdt-note pdt-eval-io-empty">${Config.MESSAGES.AGENTS.evalNoOutput}</p>`);
        }
        return col;
    }

    /**
     * Builds a status badge (Completed / Running / Failed) for a batch. Prefers the Dataverse
     * formatted status label, falling back to the derived state.
     * @param {'completed'|'running'|'failed'} state
     * @param {string} label - The formatted status-reason label, if any.
     * @returns {string} Badge HTML.
     * @private
     */
    _evalStateBadge(state, label) {
        const M = Config.MESSAGES.AGENTS;
        const fallback = { completed: M.evalStateCompleted, running: M.evalStateRunning, failed: M.evalStateFailed };
        const text = label || fallback[state] || state;
        const cls = state === 'completed'
            ? 'pdt-eval-badge-completed'
            : (state === 'failed' ? 'pdt-eval-badge-failed' : 'pdt-eval-badge-running');
        return `<span class="pdt-capi-badge ${cls}">${escapeHtml(text)}</span>`;
    }

    /**
     * Builds a coloured accuracy-score chip. When a passing score is known the chip is green (pass) or
     * red (fail) against it; otherwise it falls back to a neutral three-band colour scale (display aid).
     * @param {number} score - Accuracy score (0–100).
     * @param {number|null} [passingScore] - The passing score, when evaluation criteria exist.
     * @returns {string} Chip HTML.
     * @private
     */
    _scoreChip(score, passingScore) {
        const rounded = Math.round(score);
        let band;
        if (passingScore !== null && passingScore !== undefined) {
            band = rounded >= passingScore ? 'high' : 'low';
        } else {
            band = rounded >= 70 ? 'high' : (rounded >= 40 ? 'mid' : 'low');
        }
        return `<span class="pdt-eval-score pdt-eval-score-${band}">${rounded}</span>`;
    }

    /**
     * Builds a Pass/Fail badge.
     * @param {boolean} pass
     * @returns {string} Badge HTML.
     * @private
     */
    _passFailBadge(pass) {
        const M = Config.MESSAGES.AGENTS;
        return pass
            ? `<span class="pdt-capi-badge pdt-eval-badge-pass">${M.evalPass}</span>`
            : `<span class="pdt-capi-badge pdt-eval-badge-fail">${M.evalFail}</span>`;
    }

    /**
     * Counts how many scored runs pass/fail against the passing score. Returns null when there is no
     * passing score or no scored runs (so callers can omit pass/fail entirely).
     * @param {import('../services/AgentService.js').TestRun[]} runs
     * @param {number|null} passingScore
     * @returns {{pass: number, fail: number}|null}
     * @private
     */
    _passFailCounts(runs, passingScore) {
        if (passingScore === null || passingScore === undefined) {
            return null;
        }
        const scored = runs.filter(run => run.accuracyScore !== null);
        if (!scored.length) {
            return null;
        }
        const pass = scored.filter(run => run.accuracyScore >= passingScore).length;
        return { pass, fail: scored.length - pass };
    }

    /**
     * Averages the non-null accuracy scores across a batch's runs (rounded), or null when none scored.
     * @param {import('../services/AgentService.js').TestRun[]} runs
     * @returns {number|null}
     * @private
     */
    _avgScore(runs) {
        const scored = runs.map(run => run.accuracyScore).filter(score => score !== null);
        if (!scored.length) {
            return null;
        }
        return Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length);
    }

    /**
     * Formats the elapsed time between two ISO timestamps.
     * @param {string} startIso
     * @param {string} endIso
     * @returns {string} Formatted duration, or '' when either bound is missing/invalid.
     * @private
     */
    _formatDuration(startIso, endIso) {
        if (!startIso || !endIso) {
            return '';
        }
        const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
        if (!Number.isFinite(ms) || ms < 0) {
            return '';
        }
        return this._formatDurationSeconds(Math.round(ms / 1000));
    }

    /**
     * Formats a whole-second duration as `m:ss`, or `h:mm:ss` once it reaches an hour.
     * @param {number} totalSeconds
     * @returns {string}
     * @private
     */
    _formatDurationSeconds(totalSeconds) {
        if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
            return '';
        }
        const pad = (n) => String(n).padStart(2, '0');
        const seconds = totalSeconds % 60;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const hours = Math.floor(totalSeconds / 3600);
        return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
    }

    /**
     * Truncates a string to a maximum length, appending an ellipsis when cut.
     * @param {string} text
     * @param {number} max
     * @returns {string}
     * @private
     */
    _truncate(text, max) {
        const str = String(text ?? '');
        return str.length > max ? `${str.slice(0, max - 1)}…` : str;
    }

    // ═══════════════════════════════════════════════════════════
    // CROSS-AGENT SEARCH VIEW
    // ═══════════════════════════════════════════════════════════

    /**
     * Renders the Search sub-view shell (a single keyword box + a results region).
     * @private
     */
    _renderSearchView() {
        const M = Config.MESSAGES.AGENTS;
        this.ui.host.innerHTML = `
            <div class="pdt-toolbar flex-shrink-0">
                <input type="text" class="pdt-input pdt-agents-cross-search" style="flex: 1;"
                       placeholder="${M.crossSearchPlaceholder}" aria-label="${M.crossSearchPlaceholder}">
            </div>
            <div id="pdt-agents-search-results" class="pdt-agents-search-results"></div>
        `;
        const input = this.ui.host.querySelector('.pdt-agents-cross-search');
        if (this._lastSearchTerm) {
            input.value = this._lastSearchTerm;
            this._runComponentSearch();
        }
    }

    /**
     * Runs a cross-agent component search for the current keyword and renders grouped results.
     * @private
     */
    async _runComponentSearch() {
        const M = Config.MESSAGES.AGENTS;
        const input = this.ui.host.querySelector('.pdt-agents-cross-search');
        const results = this.ui.host.querySelector('#pdt-agents-search-results');
        if (!input || !results) {
            return;
        }
        const term = input.value.trim();
        this._lastSearchTerm = term;
        if (term.length < 2) {
            results.innerHTML = `<p class="pdt-note">${M.searchPrompt}</p>`;
            return;
        }
        results.innerHTML = `<p class="pdt-note">${M.searching}</p>`;
        try {
            if (!this.agents) {
                this.agents = await DataService.getAgents();
            }
            const matches = await DataService.searchAgentComponents(term);
            this._renderSearchResults(results, matches, term);
        } catch (e) {
            results.innerHTML = `<div class="pdt-error">${M.searchFailed(escapeHtml(e.message))}</div>`;
        }
    }

    /**
     * Renders cross-agent search matches grouped by their owning agent.
     * @param {HTMLElement} results
     * @param {import('../services/AgentService.js').SearchMatch[]} matches
     * @param {string} term
     * @private
     */
    _renderSearchResults(results, matches, term) {
        const M = Config.MESSAGES.AGENTS;
        if (!matches.length) {
            results.innerHTML = `<p class="pdt-note">${M.searchNoResults(escapeHtml(term))}</p>`;
            return;
        }
        const byAgent = new Map();
        matches.forEach(match => {
            const list = byAgent.get(match.parentBotId) || [];
            list.push(match);
            byAgent.set(match.parentBotId, list);
        });

        const frag = document.createDocumentFragment();
        const heading = document.createElement('div');
        heading.className = 'pdt-agent-def-heading';
        heading.textContent = M.searchResultsCount(matches.length);
        frag.appendChild(heading);
        byAgent.forEach((items, botId) => {
            const agent = this.agents?.find(a => a.id === botId);
            frag.appendChild(this._buildSearchAgentGroup(agent, items));
        });
        results.textContent = '';
        results.appendChild(frag);
    }

    /**
     * Builds a grouped result card for one agent's matching components.
     * @param {import('../services/AgentService.js').Agent|undefined} agent
     * @param {import('../services/AgentService.js').SearchMatch[]} items
     * @returns {HTMLElement}
     * @private
     */
    _buildSearchAgentGroup(agent, items) {
        const M = Config.MESSAGES.AGENTS;
        const group = document.createElement('div');
        group.className = 'pdt-agents-search-group pdt-card';
        if (agent) {
            group.dataset.agentId = agent.id;
            group.dataset.agentName = agent.name;
        }

        const header = document.createElement('div');
        header.className = 'pdt-agents-search-group-header';
        header.innerHTML = `
            <span class="pdt-agent-name">${escapeHtml(agent ? agent.name : M.searchUnknownAgent)}</span>
            <span class="pdt-capi-badge pdt-capi-badge-action">${items.length}</span>
        `;
        if (agent) {
            const openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.className = 'modern-button secondary';
            openBtn.dataset.action = 'view-def';
            openBtn.textContent = M.searchOpenAgent;
            header.appendChild(openBtn);
        }
        group.appendChild(header);

        const list = document.createElement('div');
        list.className = 'pdt-agents-search-matches';
        items.forEach(match => {
            const row = document.createElement('div');
            row.className = 'pdt-agents-search-match';
            row.innerHTML = `
                <span class="pdt-capi-badge pdt-capi-badge-managed">${escapeHtml(match.componentTypeLabel)}</span>
                <span class="pdt-agents-search-match-name">${escapeHtml(match.name)}</span>
                ${match.snippet ? `<span class="pdt-agents-search-snippet">${escapeHtml(match.snippet)}</span>` : ''}
            `;
            list.appendChild(row);
        });
        group.appendChild(list);
        return group;
    }

    // ═══════════════════════════════════════════════════════════
    // TEMPLATES WORKBENCH (Library | Generator | Review)
    // ═══════════════════════════════════════════════════════════

    /**
     * Renders the Templates workbench shell: a segmented control (Library | Generator | Review),
     * the shared agent-type select, and a body host, then renders the active segment. All segment
     * state lives on the instance, so switching segments or views never loses work.
     *
     * The select sits beside the tablist rather than inside it (a tablist may only contain tabs)
     * and outside the body host, so it survives every segment switch.
     * @private
     */
    _renderTemplatesView() {
        const M = Config.MESSAGES.AGENTS;
        this.ui.host.innerHTML = `
            <div class="pdt-templates-header flex-shrink-0">
                <div class="pdt-sub-tabs pdt-templates-mode" role="tablist" aria-label="${M.templatesView}">
                    <button type="button" class="pdt-sub-tab" data-action="tpl-mode" data-mode="library" role="tab">${M.templatesLibraryTab}</button>
                    <button type="button" class="pdt-sub-tab" data-action="tpl-mode" data-mode="generator" role="tab">${M.templatesGeneratorTab}</button>
                    <button type="button" class="pdt-sub-tab" data-action="tpl-mode" data-mode="review" role="tab">${M.templatesReviewTab}</button>
                </div>
                <select class="pdt-input pdt-templates-kind" aria-label="${M.agentTypeLabel}" title="${M.agentTypeTitle}">
                    <option value="any">${M.agentTypeAny}</option>
                    <option value="classic">${M.agentTypeClassic}</option>
                    <option value="modern">${M.agentTypeModern}</option>
                </select>
            </div>
            <div id="pdt-templates-body" class="pdt-templates-body"></div>
        `;
        this._syncTemplatesKindSelect();
        this._renderTemplatesMode();
    }

    /**
     * Switches the agent experience every segment respects, then re-derives the active one.
     * @param {string} kind - 'any', 'classic', or 'modern'.
     * @private
     */
    _handleTemplatesKindChange(kind) {
        const next = normalizeAgentKind(kind);
        if (next === this._tplState.kind) {
            return;
        }
        // The Generator form holds text the user has typed but not yet committed to state, so it is
        // read before anything can re-render. The form is kind-invariant today (a kind change only
        // recomposes the output), but this keeps the ordering safe if that ever changes.
        if (this._tplState.mode === 'generator') {
            this._syncGenStateFromForm();
        }
        this._tplState.kind = next;
        this._applyTemplatesKind();
    }

    /**
     * Re-applies the current agent experience to whichever segment is showing. No segment caches
     * the kind — they all read `_tplState.kind` at use time — so this only needs to re-derive.
     * @private
     */
    _applyTemplatesKind() {
        if (this._tplState.mode === 'generator') {
            this._renderGeneratorPanel(this.ui.host.querySelector('#pdt-templates-body'));
        } else if (this._tplState.mode === 'review') {
            this._runInstructionReview();
        } else {
            this._refreshTemplateCards();
            this._renderSubcategoryChips();
            this._filterTemplates();
        }
    }

    /**
     * Mirrors the shared agent-type select to the current experience. Never disabled: selecting an
     * agent picks the type for the user, but the choice always stays theirs to change.
     * @private
     */
    _syncTemplatesKindSelect() {
        const select = this.ui.host?.querySelector('.pdt-templates-kind');
        if (select) {
            select.value = this._tplState.kind;
        }
    }

    /**
     * Renders the active workbench segment into the body host and syncs the segment pills.
     * @private
     */
    _renderTemplatesMode() {
        this.ui.host.querySelectorAll('.pdt-templates-mode .pdt-sub-tab').forEach(btn => {
            const isActive = btn.dataset.mode === this._tplState.mode;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', String(isActive));
        });
        const body = this.ui.host.querySelector('#pdt-templates-body');
        if (!body) {
            return;
        }
        if (this._tplState.mode === 'generator') {
            this._renderGeneratorPanel(body);
        } else if (this._tplState.mode === 'review') {
            this._renderReviewPanel(body);
        } else {
            this._renderTemplatesLibrary(body);
        }
    }

    /**
     * Switches the active workbench segment.
     * @param {'library'|'generator'|'review'} mode
     * @private
     */
    _handleTemplatesMode(mode) {
        if (!mode || mode === this._tplState.mode) {
            return;
        }
        this._tplState.mode = mode;
        this._renderTemplatesMode();
    }

    // ─── Library ────────────────────────────────────────────────

    /**
     * Renders the Library segment: category select + subcategory chips + search + card grid,
     * restoring the persisted filters.
     * @param {HTMLElement} body
     * @private
     */
    _renderTemplatesLibrary(body) {
        const M = Config.MESSAGES.AGENTS;
        const categoryOptions = AGENT_TEMPLATE_CATEGORIES
            .map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
            .join('');
        body.innerHTML = `
            <div class="pdt-toolbar flex-shrink-0">
                <select class="pdt-input pdt-templates-category" style="flex: 1;" aria-label="${M.templateCategoryAll}">
                    <option value="">${M.templateCategoryAll}</option>
                    ${categoryOptions}
                </select>
                <input type="text" class="pdt-input pdt-templates-search"
                       placeholder="${M.templateSearchPlaceholder}" aria-label="${M.templateSearchPlaceholder}" style="flex: 2;">
            </div>
            <div id="pdt-templates-subcats" class="pdt-template-subcat-row flex-shrink-0"></div>
            <p class="pdt-note flex-shrink-0">${M.templatesIntro}</p>
            <div id="pdt-templates-list" class="pdt-agents-list pdt-card-grid"></div>
        `;
        body.querySelector('.pdt-templates-category').value = this._tplState.category;
        body.querySelector('.pdt-templates-search').value = this._tplState.search;
        this._renderSubcategoryChips();
        this._renderTemplateCards();
        this._filterTemplates();
    }

    /**
     * Renders the subcategory chip row for the selected category (hidden when no category is
     * selected). Each chip carries its template count and aria-pressed state.
     * @private
     */
    _renderSubcategoryChips() {
        const M = Config.MESSAGES.AGENTS;
        const row = this.ui.host.querySelector('#pdt-templates-subcats');
        if (!row) {
            return;
        }
        const category = this._tplState.category;
        const subcats = AGENT_TEMPLATE_SUBCATEGORIES[category] || [];
        if (!subcats.length) {
            row.innerHTML = '';
            row.style.display = 'none';
            return;
        }
        row.style.display = '';
        // Counts are scoped by agent type too, so a chip never advertises cards the filter hides.
        const counts = {};
        let total = 0;
        AGENT_TEMPLATES.forEach(t => {
            if (t.category === category && this._kindAllows(templateApplies(t))) {
                counts[t.subcategory] = (counts[t.subcategory] || 0) + 1;
                total += 1;
            }
        });
        const chip = (value, label, count) => {
            const active = this._tplState.subcategory === value;
            return `<button type="button" class="pdt-template-subcat-chip${active ? ' active' : ''}"
                data-action="tpl-subcat" data-subcat="${escapeHtml(value)}" aria-pressed="${active}">${escapeHtml(label)} (${count})</button>`;
        };
        row.innerHTML = chip('', M.templateSubcategoryAll, total)
            + subcats.map(sub => chip(sub, sub, counts[sub] || 0)).join('');
    }

    /**
     * Applies a subcategory chip selection and refilters.
     * @param {HTMLElement} btn - The clicked chip.
     * @private
     */
    _handleSubcatChip(btn) {
        this._tplState.subcategory = btn.dataset.subcat || '';
        this._renderSubcategoryChips();
        this._filterTemplates();
    }

    /**
     * Handles a category change: resets the subcategory, re-renders the chips, and refilters.
     * @private
     */
    _handleTemplateCategoryChange() {
        this._tplState.category = this.ui.host.querySelector('.pdt-templates-category')?.value || '';
        this._tplState.subcategory = '';
        this._renderSubcategoryChips();
        this._filterTemplates();
    }

    /**
     * Renders all template cards into the list.
     * @private
     */
    _renderTemplateCards() {
        const list = this.ui.host.querySelector('#pdt-templates-list');
        if (!list) {
            return;
        }
        const frag = document.createDocumentFragment();
        AGENT_TEMPLATES.forEach(template => frag.appendChild(this._createTemplateCard(template)));
        list.textContent = '';
        list.appendChild(frag);
    }

    /**
     * Creates a card for a single template: title with the description beneath it, plus badges.
     * The whole header is the toggle (no footer button) — clicking or pressing Enter/Space on it
     * expands one combined panel (placeholder inputs when the template has them, plus the copyable
     * content). Keywords are folded into the search index so searching by symptom
     * ("hallucination") finds the cure.
     * @param {import('../constants/agentTemplates.js').AgentTemplate} template
     * @returns {HTMLElement}
     * @private
     */
    _createTemplateCard(template) {
        const applies = templateApplies(template);
        const card = document.createElement('div');
        card.className = 'pdt-agent-card pdt-template-card pdt-card';
        card.dataset.templateId = template.id;
        card.dataset.category = template.category;
        card.dataset.subcategory = template.subcategory || '';
        card.dataset.applies = applies;
        card.dataset.searchTerm = this._templateSearchIndex(template);

        const panelId = `pdt-tpl-panel-${template.id}`;
        card.innerHTML = `
            <div class="pdt-card-header pdt-agent-header pdt-template-header" data-action="tpl-toggle"
                 role="button" tabindex="0" aria-expanded="false" aria-controls="${panelId}">
                <div class="pdt-template-head">
                    <div class="pdt-template-head-main">
                        <span class="pdt-agent-name">${escapeHtml(template.title)}</span>
                        <p class="pdt-template-desc">${escapeHtml(template.description)}</p>
                    </div>
                    <div class="pdt-agent-badges">
                        <span class="pdt-capi-badge pdt-capi-badge-function">${escapeHtml(template.category)}</span>
                        ${template.subcategory ? `<span class="pdt-capi-badge pdt-template-badge-subcat">${escapeHtml(template.subcategory)}</span>` : ''}
                        ${this._useBadgeHtml(templateUse(template))}
                        ${this._scopeBadgeHtml(applies)}
                    </div>
                </div>
            </div>
            <div class="pdt-card-body">
                <div class="pdt-template-expand" id="${panelId}" role="region" style="display: none;"></div>
            </div>
        `;
        return card;
    }

    /**
     * The searchable text for a card, built from the content the current agent experience actually
     * shows — so a search only ever finds text the user could copy from the card in front of them.
     * @param {import('../constants/agentTemplates.js').AgentTemplate} template
     * @returns {string} Lowercased search index.
     * @private
     */
    _templateSearchIndex(template) {
        return [
            template.title, template.description, template.category, template.subcategory || '',
            ...(template.keywords || []), this._templateContent(template)
        ].join(' ').toLowerCase();
    }

    /**
     * The "Classic only" / "Modern only" badge for an experience-specific template. Rendered for
     * every card and hidden by CSS once a type is chosen, so a kind switch is one class toggle on
     * the container rather than 200 DOM writes.
     * @param {'both'|'classic'|'modern'} applies
     * @returns {string} Badge markup, or an empty string when the template applies to both.
     * @private
     */
    _useBadgeHtml(use) {
        if (use === 'instructions') {
            return ''; // the default expectation — a badge here would be noise on 133 cards
        }
        const M = Config.MESSAGES.AGENTS;
        const isConfig = use === 'config';
        const label = isConfig ? M.templateUseConfig : M.templateUseGuidance;
        const title = isConfig ? M.templateUseConfigTitle : M.templateUseGuidanceTitle;
        return `<span class="pdt-capi-badge pdt-use-badge ${use}" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`;
    }

    /**
     * The "Classic only" / "Modern only" badge for an experience-specific template. Rendered for
     * every card and hidden by CSS once a type is chosen.
     * @param {'both'|'classic'|'modern'} applies
     * @returns {string} Badge markup, or an empty string when the template applies to both.
     * @private
     */
    _scopeBadgeHtml(applies) {
        if (applies === 'both') {
            return '';
        }
        const M = Config.MESSAGES.AGENTS;
        const isModern = applies === 'modern';
        const label = isModern ? M.agentScopeModern : M.agentScopeClassic;
        const title = isModern ? M.agentScopeModernTitle : M.agentScopeClassicTitle;
        return `<span class="pdt-capi-badge pdt-scope-badge ${applies}" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`;
    }

    /**
     * Resolves the template behind a card element.
     * @param {HTMLElement|null} card
     * @returns {import('../constants/agentTemplates.js').AgentTemplate|null}
     * @private
     */
    _findTemplate(card) {
        return AGENT_TEMPLATES.find(t => t.id === card?.dataset.templateId) || null;
    }

    /**
     * Toggles a card's single expand panel, building it lazily on first open and flipping the
     * header's aria-expanded + open-state class.
     * @param {HTMLElement} actionEl - An element inside the card (the header, or a descendant of it).
     * @private
     */
    _handleTemplateToggle(actionEl) {
        const card = actionEl.closest('.pdt-template-card');
        const template = this._findTemplate(card);
        const host = card?.querySelector('.pdt-template-expand');
        // The header is the toggle; resolve it from the card so a click on any of its children
        // (title, description, badge) drives the same state.
        const header = card?.querySelector('.pdt-template-header');
        if (!template || !host || !header) {
            return;
        }
        if (!host.childElementCount) {
            this._buildTemplateExpand(card, template);
        }
        const willShow = host.style.display === 'none';
        host.style.display = willShow ? '' : 'none';
        header.setAttribute('aria-expanded', String(willShow));
        card.classList.toggle('pdt-template-card--open', willShow);
    }

    /**
     * Builds a card's expand panel: the placeholder inputs (when the template has {tokens}) above
     * the copyable content block. The block carries its own copy button (top-right) and is rebuilt
     * as inputs change so it always copies the current, substituted text.
     * @param {HTMLElement} card
     * @param {import('../constants/agentTemplates.js').AgentTemplate} template
     * @private
     */
    _buildTemplateExpand(card, template) {
        const host = card.querySelector('.pdt-template-expand');
        const tokens = extractTemplateTokens(this._templateContent(template));
        if (tokens.length) {
            host.appendChild(this._buildCustomizeGrid(template, tokens));
        }
        const preview = document.createElement('div');
        preview.className = 'pdt-template-preview';
        host.appendChild(preview);
        this._renderTemplatePreview(card, template);
    }

    /**
     * Builds the placeholder-input grid, restoring any values already entered for this template.
     * @param {import('../constants/agentTemplates.js').AgentTemplate} template
     * @param {string[]} tokens
     * @returns {HTMLElement}
     * @private
     */
    _buildCustomizeGrid(template, tokens) {
        const grid = document.createElement('div');
        grid.className = 'pdt-template-customize-grid';
        const saved = this._customizeValues.get(template.id) || {};
        tokens.forEach(token => {
            const label = document.createElement('label');
            label.className = 'pdt-template-customize-field';
            const caption = document.createElement('span');
            caption.textContent = token;
            caption.title = token;
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'pdt-input pdt-template-customize-input';
            input.dataset.token = token;
            input.value = saved[token] || '';
            label.append(caption, input);
            grid.appendChild(label);
        });
        return grid;
    }

    /**
     * (Re)builds the copyable content block with the current placeholder values applied, so its
     * built-in copy button always copies the substituted text.
     * @param {HTMLElement} card
     * @param {import('../constants/agentTemplates.js').AgentTemplate} template
     * @private
     */
    _renderTemplatePreview(card, template) {
        const host = card.querySelector('.pdt-template-preview');
        if (!host) {
            return;
        }
        host.textContent = '';
        host.appendChild(UIFactory.createCopyableCodeBlock(this._customizedContent(template), 'text'));
    }

    /**
     * Stores a placeholder input's value and refreshes the card's content block.
     * @param {HTMLInputElement} input
     * @private
     */
    _handleCustomizeInput(input) {
        const card = input.closest('.pdt-template-card');
        const template = this._findTemplate(card);
        if (!template) {
            return;
        }
        const values = this._customizeValues.get(template.id) || {};
        values[input.dataset.token] = input.value;
        this._customizeValues.set(template.id, values);
        this._renderTemplatePreview(card, template);
    }

    /**
     * The template's raw content for the current agent experience — the modern variant when there
     * is one, with slash references backticked.
     * @param {import('../constants/agentTemplates.js').AgentTemplate} template
     * @returns {string}
     * @private
     */
    _templateContent(template) {
        return templateContent(template, this._tplState.kind);
    }

    /**
     * The template's content for the current agent experience, with the user's placeholder values
     * applied.
     * @param {import('../constants/agentTemplates.js').AgentTemplate} template
     * @returns {string}
     * @private
     */
    _customizedContent(template) {
        return applyTemplateTokens(this._templateContent(template), this._customizeValues.get(template.id) || {});
    }

    /**
     * Whether a template is in scope for the workbench's agent experience.
     * @param {'both'|'classic'|'modern'} applies
     * @returns {boolean}
     * @private
     */
    _kindAllows(applies) {
        return appliesToKind(applies || 'both', this._tplState.kind);
    }

    /**
     * Filters template cards by search term, category, subcategory, and agent experience.
     *
     * Search and category are re-read from the DOM (they are only ever set there); the agent type
     * deliberately is NOT — it is authoritative from state, because a loaded agent can lock the
     * control and Review sets it without a user gesture.
     * @private
     */
    _filterTemplates() {
        const search = this.ui.host?.querySelector('.pdt-templates-search');
        const category = this.ui.host?.querySelector('.pdt-templates-category');
        this._tplState.search = search?.value || '';
        this._tplState.category = category?.value || '';
        const term = this._tplState.search.toLowerCase().trim();
        const cat = this._tplState.category;
        const subcat = this._tplState.subcategory;
        const cards = this.ui.host?.querySelectorAll('.pdt-template-card');
        if (!cards?.length) {
            return;
        }
        let visible = 0;
        let scopedOut = 0;
        cards.forEach(card => {
            const matchesFilters = (card.dataset.searchTerm || '').includes(term)
                && (!cat || card.dataset.category === cat)
                && (!subcat || card.dataset.subcategory === subcat);
            const inKind = this._kindAllows(card.dataset.applies);
            card.style.display = matchesFilters && inKind ? '' : 'none';
            if (matchesFilters && inKind) {
                visible += 1;
            } else if (matchesFilters) {
                scopedOut += 1;
            }
        });
        const list = this.ui.host?.querySelector('#pdt-templates-list');
        if (list) {
            list.classList.toggle('pdt-hide-scope-badges', this._tplState.kind !== 'any');
            this._toggleFilterEmptyState(list, 'pdt-templates-empty', visible === 0, this._templateEmptyMessage(scopedOut));
        }
    }

    /**
     * The empty-state message: "nothing matches" reads as a dead end when the truth is that the
     * matches exist but belong to the other agent experience.
     * @param {number} scopedOut - How many cards matched the filters but not the agent type.
     * @returns {string}
     * @private
     */
    _templateEmptyMessage(scopedOut) {
        const M = Config.MESSAGES.AGENTS;
        return scopedOut > 0 ? M.noTemplatesForKind(this._agentKindContext()) : M.noTemplates;
    }

    /**
     * Re-derives what each card carries from the current agent experience: its search index, and
     * the expand panel when the user has already opened it. Panels are built once and cached, so a
     * kind switch would otherwise leave classic content on screen under a modern selection.
     * @private
     */
    _refreshTemplateCards() {
        this.ui.host?.querySelectorAll('.pdt-template-card').forEach(card => {
            const template = this._findTemplate(card);
            if (!template) {
                return;
            }
            // The index follows the shown content, so it has to move with the experience too.
            card.dataset.searchTerm = this._templateSearchIndex(template);
            const host = card.querySelector('.pdt-template-expand');
            if (!host?.childElementCount) {
                return;
            }
            host.textContent = '';
            this._buildTemplateExpand(card, template);
        });
    }

    // ─── Generator (instruction builder) ────────────────────────

    /**
     * The generator's default selections.
     * @returns {object}
     * @private
     */
    _defaultGenState() {
        const firstRole = GENERATOR_BLOCKS.roles[0];
        return {
            role: firstRole.id,
            customRole: '',
            company: '',
            product: '',
            audience: '',
            tone: 'default',
            capabilities: [...firstRole.defaultCapabilities],
            tools: [],
            escalation: 'none',
            guardrails: [],
            outputFormat: 'default',
            agentId: '',
            agentComponents: null,
            agentToolIds: []
        };
    }

    /**
     * The Generator's one-line note, which states what the composed output will actually contain
     * for the selected agent experience.
     * @returns {string}
     * @private
     */
    _generatorIntro() {
        const M = Config.MESSAGES.AGENTS;
        if (this._tplState.kind === 'classic') {
            return M.generatorIntroClassic;
        }
        return this._tplState.kind === 'modern' ? M.generatorIntroModern : M.generatorIntroAny;
    }

    /**
     * Renders the Generator segment: the form column and the sticky live-output column.
     * @param {HTMLElement} body
     * @private
     */
    _renderGeneratorPanel(body) {
        const M = Config.MESSAGES.AGENTS;
        if (!this._genState) {
            this._genState = this._defaultGenState();
        }
        body.innerHTML = `
            <p class="pdt-note flex-shrink-0">${this._generatorIntro()}</p>
            <div class="pdt-generator-grid">
                <div class="pdt-generator-form"></div>
                <div class="pdt-generator-output">
                    <div class="pdt-agent-def-heading">${M.generatorOutputHeading}</div>
                    <pre class="pdt-generator-output-pre"><code></code></pre>
                    <p class="pdt-note pdt-generator-length"></p>
                    <div class="pdt-agent-actions-group pdt-generator-actions">
                        <button type="button" class="modern-button secondary" data-action="gen-reset">${M.generatorReset}</button>
                        <button type="button" class="modern-button secondary" data-action="gen-download">${M.generatorDownload}</button>
                        <button type="button" class="modern-button" data-action="gen-copy">${M.generatorCopy}</button>
                    </div>
                </div>
            </div>
        `;
        this._buildGeneratorForm(body.querySelector('.pdt-generator-form'));
        this._updateGeneratorOutput();
    }

    /**
     * Builds the generator form sections from GENERATOR_BLOCKS, restoring the persisted state.
     * @param {HTMLElement} form
     * @private
     */
    _buildGeneratorForm(form) {
        const M = Config.MESSAGES.AGENTS;
        const g = this._genState;

        form.appendChild(this._genSection(M.generatorRoleLabel, this._genRoleSelect(g.role)));
        if (g.role === 'custom') {
            const custom = document.createElement('textarea');
            custom.className = 'pdt-input pdt-generator-text pdt-generator-custom-role';
            custom.rows = 2;
            custom.placeholder = M.generatorCustomRolePlaceholder;
            custom.setAttribute('aria-label', M.generatorCustomRolePlaceholder);
            custom.value = g.customRole;
            form.appendChild(custom);
        }

        form.appendChild(this._genSection(M.generatorCompanyLabel,
            this._genText('pdt-generator-company', M.generatorCompanyPlaceholder, g.company)));
        form.appendChild(this._genSection(M.generatorProductLabel,
            this._genText('pdt-generator-product', M.generatorProductPlaceholder, g.product)));
        form.appendChild(this._genSection(M.generatorAudienceLabel,
            this._genText('pdt-generator-audience', M.generatorAudiencePlaceholder, g.audience)));

        form.appendChild(this._genSection(M.generatorToneLabel,
            this._genSelect('pdt-generator-tone', GENERATOR_BLOCKS.tones, g.tone)));
        form.appendChild(this._genSection(M.generatorFormatLabel,
            this._genSelect('pdt-generator-format', GENERATOR_BLOCKS.outputFormats, g.outputFormat)));
        form.appendChild(this._genSection(M.generatorCapabilitiesLabel,
            this._genMultiDropdown('pdt-generator-capability', GENERATOR_BLOCKS.capabilities, g.capabilities)));

        form.appendChild(this._buildGeneratorToolsSection());

        form.appendChild(this._genSection(M.generatorEscalationLabel,
            this._genSelect('pdt-generator-escalation', GENERATOR_BLOCKS.escalation, g.escalation)));
        form.appendChild(this._genSection(M.generatorGuardrailsLabel,
            this._genMultiDropdown('pdt-generator-guardrail', GENERATOR_BLOCKS.guardrails, g.guardrails)));
    }

    /**
     * Builds the tool-hints section: an agent select ("ground in one of your agents") and either
     * the agent's REAL tools/knowledge (checked by name, referenced as /Name) or the generic
     * tool blocks.
     * @returns {HTMLElement}
     * @private
     */
    _buildGeneratorToolsSection() {
        const M = Config.MESSAGES.AGENTS;
        const g = this._genState;
        const content = document.createElement('div');

        const agentSelect = document.createElement('select');
        agentSelect.className = 'pdt-input pdt-generator-select pdt-generator-agent';
        agentSelect.setAttribute('aria-label', M.generatorAgentLabel);
        this._populateAgentSelect(agentSelect, M.generatorAgentNone, g.agentId, true);
        content.appendChild(agentSelect);

        if (g.agentId && g.agentComponents?.length) {
            // A field-level hint, not a panel note: the panel's one .pdt-note is its intro.
            const hint = document.createElement('p');
            hint.className = 'pdt-generator-section-hint';
            hint.textContent = M.generatorAgentToolsNote;
            content.appendChild(hint);
            content.appendChild(this._genMultiDropdown(
                'pdt-generator-agenttool', this._agentComponentItems(g.agentComponents), g.agentToolIds
            ));
        } else {
            content.appendChild(this._genMultiDropdown('pdt-generator-tool', GENERATOR_BLOCKS.tools, g.tools));
        }
        return this._genSection(M.generatorToolsLabel, content);
    }

    /**
     * Builds a titled generator form section.
     * @param {string} labelText
     * @param {HTMLElement} contentEl
     * @returns {HTMLElement}
     * @private
     */
    _genSection(labelText, contentEl) {
        const section = document.createElement('div');
        section.className = 'pdt-generator-section';
        const title = document.createElement('div');
        title.className = 'pdt-generator-section-title';
        title.textContent = labelText;
        section.append(title, contentEl);
        return section;
    }

    /**
     * Builds the role select with the presets grouped into optgroups by domain.
     * @param {string} selectedId
     * @returns {HTMLSelectElement}
     * @private
     */
    _genRoleSelect(selectedId) {
        const select = document.createElement('select');
        select.className = 'pdt-input pdt-generator-select pdt-generator-role';
        const groups = new Map();
        GENERATOR_BLOCKS.roles.forEach(role => {
            const key = role.group || '';
            if (!groups.has(key)) {
                groups.set(key, document.createElement('optgroup'));
                groups.get(key).label = key;
            }
            const option = document.createElement('option');
            option.value = role.id;
            option.textContent = role.label;
            groups.get(key).appendChild(option);
        });
        groups.forEach(optgroup => select.appendChild(optgroup));
        select.value = selectedId;
        return select;
    }

    /**
     * Builds a generator select from a block list.
     * @param {string} cls - Marker class.
     * @param {Array<{id: string, label: string}>} options
     * @param {string} selectedId
     * @returns {HTMLSelectElement}
     * @private
     */
    _genSelect(cls, options, selectedId) {
        const select = document.createElement('select');
        select.className = `pdt-input pdt-generator-select ${cls}`;
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.id;
            option.textContent = opt.label;
            select.appendChild(option);
        });
        select.value = selectedId;
        return select;
    }

    /**
     * The component kinds an instruction can reference on a given agent. Scoped to the agent being
     * grounded in, not to the workbench type: a classic agent has topics whichever experience you
     * happen to be composing for. Whether a topic may be *referenced* is a separate question, and
     * the composer answers it.
     * @param {Agent} [agent] - The agent being grounded in.
     * @returns {string[]}
     * @private
     */
    _referableComponentKinds(agent) {
        const kinds = ['action', 'knowledge', 'connectedAgent'];
        return agent?.isModern ? kinds : [...kinds, 'topic'];
    }

    /**
     * Turns an agent's components into picker items, grouped by kind and carrying their description.
     *
     * The description is shown because it — not the name — is what the orchestrator routes on, so a
     * missing one, or two components sharing one, is the usual cause of the agent calling the wrong
     * thing. Both are marked here, where the maker is already looking at the list.
     * @param {AgentComponent[]} components
     * @returns {Array<{id: string, label: string, hint: string, group: string, warning: string}>}
     * @private
     */
    _agentComponentItems(components) {
        const M = Config.MESSAGES.AGENTS;
        const seen = new Map();
        components.forEach(component => {
            const key = getComponentDescription(component).trim().toLowerCase();
            if (key) {
                seen.set(key, (seen.get(key) || 0) + 1);
            }
        });
        return components.map(component => {
            const description = getComponentDescription(component).trim();
            const key = description.toLowerCase();
            let warning = '';
            if (!description) {
                warning = M.generatorComponentNoDescription;
            } else if (seen.get(key) > 1) {
                warning = M.generatorComponentDuplicateDescription;
            }
            return {
                id: component.id,
                label: component.name,
                hint: description,
                group: this._componentKindLabel(getComponentKind(component)),
                warning
            };
        });
    }

    /**
     * The display label for a routing-target kind.
     * @param {string} kind
     * @returns {string}
     * @private
     */
    _componentKindLabel(kind) {
        const M = Config.MESSAGES.AGENTS;
        return {
            action: M.generatorGroupTools,
            knowledge: M.generatorGroupKnowledge,
            topic: M.generatorGroupTopics,
            connectedAgent: M.generatorGroupAgents
        }[kind] || M.generatorGroupTools;
    }

    /**
     * Builds a multi-select dropdown (details/summary with a checkbox list inside), so every
     * generator field presents as a dropdown. The summary shows the live selection count. Items may
     * carry a `group` heading, a `hint` shown under the label, and a `warning` marker.
     * @param {string} cls - Marker class for the checkboxes.
     * @param {Array<{id: string, label: string, hint?: string, group?: string, warning?: string}>} items
     * @param {string[]} checkedIds
     * @returns {HTMLElement}
     * @private
     */
    _genMultiDropdown(cls, items, checkedIds) {
        const details = document.createElement('details');
        details.className = 'pdt-generator-multi';
        const summary = document.createElement('summary');
        summary.className = 'pdt-input pdt-generator-multi-summary';
        details.appendChild(summary);
        const panel = document.createElement('div');
        panel.className = 'pdt-generator-multi-panel pdt-generator-checks';
        let lastGroup = null;
        items.forEach(item => {
            if (item.group && item.group !== lastGroup) {
                const heading = document.createElement('div');
                heading.className = 'pdt-generator-check-group';
                heading.textContent = item.group;
                panel.appendChild(heading);
                lastGroup = item.group;
            }
            const label = document.createElement('label');
            label.className = 'pdt-generator-check-label';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = `pdt-generator-check ${cls}`;
            input.value = item.id;
            input.checked = (checkedIds || []).includes(item.id);
            const caption = document.createElement('span');
            caption.className = 'pdt-generator-check-text';
            const name = document.createElement('span');
            name.textContent = item.label;
            caption.appendChild(name);
            if (item.warning) {
                const flag = document.createElement('span');
                flag.className = 'pdt-generator-check-warning';
                flag.textContent = item.warning;
                caption.appendChild(flag);
            }
            if (item.hint) {
                const hint = document.createElement('span');
                hint.className = 'pdt-generator-check-hint';
                hint.textContent = item.hint;
                caption.appendChild(hint);
            }
            label.append(input, caption);
            panel.appendChild(label);
        });
        details.appendChild(panel);
        this._setMultiSummary(details);
        return details;
    }

    /**
     * Updates a multi-select dropdown's summary to its current selection count.
     * @param {HTMLElement} details - The `.pdt-generator-multi` element.
     * @private
     */
    _setMultiSummary(details) {
        const summary = details.querySelector('.pdt-generator-multi-summary');
        if (summary) {
            const count = details.querySelectorAll('.pdt-generator-check:checked').length;
            summary.textContent = Config.MESSAGES.AGENTS.generatorSelectedCount(count);
        }
    }

    /**
     * Builds a generator text input.
     * @param {string} cls - Marker class.
     * @param {string} placeholder
     * @param {string} value
     * @returns {HTMLInputElement}
     * @private
     */
    _genText(cls, placeholder, value) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = `pdt-input pdt-generator-text ${cls}`;
        input.placeholder = placeholder;
        input.setAttribute('aria-label', placeholder);
        input.value = value;
        return input;
    }

    /**
     * Fills an agent `<select>` from the cached agents list (loading it once if needed).
     * @param {HTMLSelectElement} select
     * @param {string} noneLabel - Label for the empty option.
     * @param {string} selectedId
     * @private
     */
    async _populateAgentSelect(select, noneLabel, selectedId, showKind = false) {
        const M = Config.MESSAGES.AGENTS;
        select.innerHTML = `<option value="">${escapeHtml(noneLabel)}</option>`;
        try {
            if (!this.agents) {
                this.agents = await DataService.getAgents();
            }
        } catch {
            return; // Leave only the generic option — the workbench still works without agents.
        }
        (this.agents || []).forEach(agent => {
            const option = document.createElement('option');
            option.value = agent.id;
            // The Review list tags each agent with its experience, since that decides which rules run.
            option.textContent = showKind
                ? `${agent.name} (${agent.isModern ? M.agentTagModern : M.agentTagClassic})`
                : agent.name;
            select.appendChild(option);
        });
        if (selectedId) {
            select.value = selectedId;
        }
    }

    /**
     * Routes a generator form change: role changes re-apply preset defaults, agent changes load
     * that agent's tools, everything else just recomposes the output.
     * @param {HTMLElement} target
     * @private
     */
    _handleGeneratorFormChange(target) {
        if (target.matches('.pdt-generator-role')) {
            this._syncGenStateFromForm();
            this._genState.role = target.value;
            const preset = GENERATOR_BLOCKS.roles.find(r => r.id === target.value);
            if (preset?.defaultCapabilities?.length) {
                this._genState.capabilities = [...preset.defaultCapabilities];
            }
            this._renderGeneratorPanel(this.ui.host.querySelector('#pdt-templates-body'));
            return;
        }
        if (target.matches('.pdt-generator-agent')) {
            this._handleGeneratorAgentChange(target.value);
            return;
        }
        const multi = target.closest('.pdt-generator-multi');
        if (multi) {
            this._setMultiSummary(multi);
        }
        this._updateGeneratorOutput();
    }

    /**
     * Loads (and caches) the selected agent's tools/knowledge for grounding the tool hints in the
     * agent's REAL component names. Components are fetched only when the agent changes.
     * @param {string} agentId
     * @private
     */
    async _handleGeneratorAgentChange(agentId) {
        const M = Config.MESSAGES.AGENTS;
        this._syncGenStateFromForm();
        const g = this._genState;
        g.agentId = agentId || '';
        g.agentComponents = null;
        g.agentToolIds = [];
        if (agentId) {
            try {
                BusyIndicator.set();
                const components = await DataService.getAgentComponents(agentId);
                this._applyAgentKind(agentId);
                const referable = this._referableComponentKinds((this.agents || []).find(a => a.id === agentId));
                const order = ['action', 'knowledge', 'topic', 'connectedAgent'];
                g.agentComponents = (components || [])
                    .filter(c => referable.includes(getComponentKind(c)))
                    .sort((a, b) => order.indexOf(getComponentKind(a)) - order.indexOf(getComponentKind(b)));
                // Only tools and knowledge are pre-selected. Topics and connected agents are opt-in:
                // an agent can have dozens, and naming them all produces the tool inventory the
                // docs warn against ("add instructions only where the right choice is ambiguous").
                g.agentToolIds = g.agentComponents
                    .filter(c => ['action', 'knowledge'].includes(getComponentKind(c)))
                    .map(c => c.id);
                if (!g.agentComponents.length) {
                    NotificationService.show(M.generatorAgentNoTools, 'info');
                }
            } catch (e) {
                NotificationService.show(M.generatorAgentLoadFailed(escapeHtml(e.message)), 'error');
                g.agentId = '';
            } finally {
                BusyIndicator.clear();
            }
        }
        this._applyAgentKind(g.agentId);
        this._renderGeneratorPanel(this.ui.host.querySelector('#pdt-templates-body'));
        this._syncTemplatesKindSelect();
    }

    /**
     * Picks the workbench experience for the user when they select an agent. Never locks anything —
     * the control stays theirs to change afterwards.
     * @param {string} agentId - The selected agent, or '' when cleared (which leaves the type alone).
     * @param {boolean} [authoritative=false] - True for Review's loaded agent, whose instructions
     *   are the thing being checked; false for the Generator's tool-hints grounding.
     * @private
     */
    _applyAgentKind(agentId, authoritative = false) {
        const kind = this._agentKindOf(agentId);
        if (!kind) {
            return;
        }
        // Review's agent always picks: the box holds that agent's own instructions, so checking
        // them against the other experience would be meaningless. The Generator's agent only lends
        // its tool names, so it fills a type that is still unset and never overwrites a choice.
        if (authoritative || this._tplState.kind === 'any') {
            this._tplState.kind = kind;
        }
    }

    /**
     * The experience of a known agent.
     * @param {string} [agentId]
     * @returns {'classic'|'modern'|''} '' when there is no such agent to read it from.
     * @private
     */
    _agentKindOf(agentId) {
        if (!agentId) {
            return '';
        }
        const agent = (this.agents || []).find(a => a.id === agentId);
        if (!agent) {
            return '';
        }
        return agent.isModern ? 'modern' : 'classic';
    }

    /**
     * Reads the generator form into the persisted state.
     * @private
     */
    _syncGenStateFromForm() {
        const host = this.ui.host;
        const g = this._genState;
        if (!g || !host?.querySelector('.pdt-generator-form')) {
            return;
        }
        const value = (selector) => host.querySelector(selector)?.value ?? '';
        const checked = (selector) => [...host.querySelectorAll(`${selector}:checked`)].map(i => i.value);
        // Only read the custom-role box when it is present (role === 'custom'). Reading its actual
        // value — including empty — lets the user clear it, while leaving g.customRole untouched when
        // the field is absent for a non-custom role (a blanket `value() || g.customRole` would keep a
        // stale purpose in the output after the box was emptied).
        const customRoleEl = host.querySelector('.pdt-generator-custom-role');
        if (customRoleEl) {
            g.customRole = customRoleEl.value;
        }
        g.company = value('.pdt-generator-company');
        g.product = value('.pdt-generator-product');
        g.audience = value('.pdt-generator-audience');
        g.tone = value('.pdt-generator-tone') || 'default';
        g.outputFormat = value('.pdt-generator-format') || 'default';
        g.capabilities = checked('.pdt-generator-capability');
        g.guardrails = checked('.pdt-generator-guardrail');
        g.escalation = value('.pdt-generator-escalation') || 'none';
        if (g.agentId && g.agentComponents?.length) {
            g.agentToolIds = checked('.pdt-generator-agenttool');
        } else {
            g.tools = checked('.pdt-generator-tool');
        }
    }

    /**
     * Collects the current selections in the shape composeInstructions expects. Real agent tools
     * take full precedence over the generic tool blocks.
     * @returns {import('../constants/generatorBlocks.js').GeneratorSelections}
     * @private
     */
    _collectGeneratorSelections() {
        this._syncGenStateFromForm();
        const g = this._genState;
        const agentTools = (g.agentComponents || [])
            .filter(c => g.agentToolIds.includes(c.id))
            .map(c => ({ name: c.name, kind: getComponentKind(c) }));
        return {
            role: g.role, customRole: g.customRole,
            company: g.company, product: g.product, audience: g.audience,
            tone: g.tone, capabilities: g.capabilities, tools: g.tools, agentTools,
            escalation: g.escalation, guardrails: g.guardrails, outputFormat: g.outputFormat,
            // The experience is workbench state, not generator state: a Reset must not flip the
            // shared control.
            kind: this._tplState.kind
        };
    }

    /**
     * Recomposes the instruction output and the length feedback line.
     * @private
     */
    _updateGeneratorOutput() {
        const M = Config.MESSAGES.AGENTS;
        const code = this.ui.host?.querySelector('.pdt-generator-output-pre code');
        if (!code || !this._genState) {
            return;
        }
        this._generatorText = composeInstructions(this._collectGeneratorSelections());
        code.textContent = this._generatorText;
        const lengthEl = this.ui.host.querySelector('.pdt-generator-length');
        if (lengthEl) {
            const hint = this._generatorText.length > 2000 ? ` — ${M.generatorLengthHint}` : '';
            lengthEl.textContent = `${M.generatorLength(this._generatorText.length)}${hint}`;
        }
    }

    /**
     * Copies the composed instructions.
     * @private
     */
    _handleGeneratorCopy() {
        copyToClipboard(this._generatorText || '', Config.MESSAGES.AGENTS.generatorCopied);
    }

    /**
     * Downloads the composed instructions as a markdown file named after the role preset.
     * @private
     */
    _handleGeneratorDownload() {
        const role = this._genState?.role || 'agent';
        // The kind is in the name so downloading both experiences doesn't overwrite the first file.
        downloadText(this._generatorText || '', `instructions-${role}-${this._tplState.kind}.md`);
    }

    /**
     * Resets the generator's own form to its defaults. The agent type is workbench-wide, not part
     * of this form, so Reset leaves it exactly where the user had it.
     * @private
     */
    _handleGeneratorReset() {
        this._genState = this._defaultGenState();
        this._renderGeneratorPanel(this.ui.host.querySelector('#pdt-templates-body'));
    }

    // ─── Review (instruction checker) ───────────────────────────

    /**
     * Renders the Review segment: paste box + load-from-agent select + agent-type select + findings
     * host, restoring the persisted text.
     * @param {HTMLElement} body
     * @private
     */
    _renderReviewPanel(body) {
        const M = Config.MESSAGES.AGENTS;
        body.innerHTML = `
            <p class="pdt-note flex-shrink-0">${M.reviewIntro}</p>
            <div class="pdt-toolbar pdt-toolbar-wrap flex-shrink-0">
                <select class="pdt-input pdt-review-agent" style="flex: 2;" aria-label="${M.reviewLoadAgentLabel}">
                    <option value="">${M.reviewLoadAgentNone}</option>
                </select>
                <button type="button" class="modern-button secondary" data-action="review-example" title="${M.reviewLoadExample}">${M.reviewLoadExample}</button>
                <button type="button" class="modern-button secondary" data-action="review-open-agent" style="display: none;">${M.reviewOpenAgent}</button>
            </div>
            <textarea class="pdt-input pdt-review-text" rows="10"
                placeholder="${M.reviewPlaceholder}" aria-label="${M.reviewPlaceholder}"></textarea>
            <div class="pdt-review-findings"></div>
        `;
        body.querySelector('.pdt-review-text').value = this._reviewText;
        this._populateAgentSelect(body.querySelector('.pdt-review-agent'), M.reviewLoadAgentNone, this._reviewAgentId, true);
        this._syncReviewButtons();
        this._runInstructionReview();
    }

    /**
     * Tracks edits to the review box. While no agent is selected the text is the user's own, so it
     * is remembered and restored if they load an agent and then clear the selection again.
     * @param {string} value
     * @private
     */
    _handleReviewTextInput(value) {
        this._reviewText = value;
        if (!this._reviewAgentId) {
            this._pastedReviewText = value;
        }
        this.reviewDebounced();
    }

    /**
     * The human-readable phrase for the workbench's agent experience ("a classic agent").
     * @returns {string}
     * @private
     */
    _agentKindContext() {
        const M = Config.MESSAGES.AGENTS;
        if (this._tplState.kind === 'classic') {
            return M.agentContextClassic;
        }
        return this._tplState.kind === 'modern' ? M.agentContextModern : M.agentContextAny;
    }

    /**
     * Runs the docs-grounded review rules over the current text and renders the findings (or an
     * all-clear note).
     * @private
     */
    _runInstructionReview() {
        const M = Config.MESSAGES.AGENTS;
        const host = this.ui.host?.querySelector('.pdt-review-findings');
        if (!host) {
            return;
        }
        host.textContent = '';
        const text = this._reviewText.trim();
        if (!text) {
            return;
        }
        const kind = this._tplState.kind;
        const context = this._agentKindContext();
        const findings = reviewInstructions(text, { kind, resources: this._reviewResources });
        if (!findings.length) {
            host.innerHTML = `<p class="pdt-note pdt-review-allclear">${escapeHtml(M.reviewAllClear(countReviewRules(kind), context))}</p>`;
            return;
        }
        const heading = document.createElement('div');
        heading.className = 'pdt-agent-def-heading';
        heading.textContent = M.reviewFindingsHeading(findings.length, context);
        host.appendChild(heading);
        findings.forEach(finding => host.appendChild(this._createReviewFindingRow(finding)));
    }

    /**
     * Builds one finding row: severity chip, remediation, the documented reason, and a meta line
     * with the Learn link. Experience-specific rules are badged, but only while reviewing against
     * "any agent type" — once a kind is chosen the badge would just repeat the selection.
     * @param {import('../constants/generatorBlocks.js').ReviewFinding} finding
     * @returns {HTMLElement}
     * @private
     */
    _createReviewFindingRow(finding) {
        const M = Config.MESSAGES.AGENTS;
        const row = document.createElement('div');
        row.className = `pdt-review-finding pdt-review-finding--${finding.severity}`;
        const severity = document.createElement('span');
        severity.className = 'pdt-review-finding-severity';
        severity.textContent = M.reviewSeverity(finding.severity);
        const details = document.createElement('div');
        details.className = 'pdt-review-finding-text';
        const message = document.createElement('div');
        message.className = 'pdt-review-finding-message';
        message.textContent = finding.message;
        const reason = document.createElement('div');
        reason.className = 'pdt-review-finding-reason';
        reason.textContent = finding.reason;
        details.append(message, reason);

        const meta = document.createElement('div');
        meta.className = 'pdt-review-finding-meta';
        if (finding.applies !== 'both' && this._tplState.kind === 'any') {
            const isModern = finding.applies === 'modern';
            const scope = document.createElement('span');
            scope.className = `pdt-capi-badge pdt-scope-badge ${finding.applies}`;
            scope.textContent = isModern ? M.agentScopeModern : M.agentScopeClassic;
            scope.title = isModern ? M.agentScopeModernTitle : M.agentScopeClassicTitle;
            meta.appendChild(scope);
        }
        if (finding.docUrl) {
            const link = document.createElement('a');
            link.className = 'pdt-external-link pdt-review-finding-doc';
            link.href = finding.docUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = M.reviewDocLink;
            meta.appendChild(link);
        }
        if (meta.childElementCount) {
            details.appendChild(meta);
        }
        row.append(severity, details);
        return row;
    }

    /**
     * Loads the selected agent's instructions into the review box — from the modern configuration
     * (agentSettings.instructions) or the legacy Custom GPT component. The agent's experience and
     * its configured resources come along, so the review runs the right rules and can tell when the
     * instructions name a tool the agent doesn't have.
     * @param {string} agentId
     * @private
     */
    async _handleReviewLoadAgent(agentId) {
        const M = Config.MESSAGES.AGENTS;
        const wasAgentSourced = !!this._reviewAgentId;
        this._reviewAgentId = agentId || '';
        this._syncReviewButtons();
        if (!agentId) {
            // Clearing the agent gives the user their own text back, not the agent's leftovers.
            this._revertReviewToPastedText();
            return;
        }
        if (!wasAgentSourced) {
            this._pastedReviewText = this._reviewText;
        }
        // Selections can outrun their responses; only the newest one may touch the panel.
        const token = ++this._reviewLoadToken;
        try {
            BusyIndicator.set();
            const [configuration, components] = await Promise.all([
                DataService.getAgentConfiguration(agentId).catch(() => null),
                DataService.getAgentComponents(agentId).catch(() => [])
            ]);
            if (token !== this._reviewLoadToken) {
                return;
            }
            let instructions = extractAgentInstructions(configuration);
            if (!instructions.trim()) {
                const comp = (components || []).find(isInstructionsComponent);
                instructions = comp?.data || comp?.content || '';
            }
            if (!instructions.trim()) {
                // Keep the selection, but never leave the previous source's text under a new name.
                NotificationService.show(M.reviewNoInstructions, 'info');
                this._setReviewText('');
            } else {
                this._setReviewText(instructions);
            }
            this._setReviewScope(agentId, this._collectAgentResources(components));
        } catch (e) {
            if (token !== this._reviewLoadToken) {
                return;
            }
            NotificationService.show(M.reviewLoadFailed(escapeHtml(e.message)), 'error');
            // Nothing loaded, so don't leave a half-applied agent selected.
            this._reviewAgentId = '';
            this._syncReviewButtons();
            this._revertReviewToPastedText();
        } finally {
            if (token === this._reviewLoadToken) {
                BusyIndicator.clear();
            }
        }
    }

    /**
     * Drops back to reviewing the user's own text against every rule — used when the selection is
     * cleared and when a load fails, so the panel never shows one agent's name over another's text.
     * @private
     */
    _revertReviewToPastedText() {
        const select = this.ui.host?.querySelector('.pdt-review-agent');
        if (select) {
            select.value = '';
        }
        this._setReviewText(this._pastedReviewText);
        this._setReviewScope('', []);
    }

    /**
     * Writes the review box and keeps the component's copy of the text in step.
     * @param {string} text
     * @private
     */
    _setReviewText(text) {
        this._reviewText = text || '';
        const textarea = this.ui.host?.querySelector('.pdt-review-text');
        if (textarea) {
            textarea.value = this._reviewText;
        }
    }

    /**
     * Points the review at an agent and its resource list, picking that agent's experience for the
     * workbench and re-running the rules. Clearing the agent ('') leaves the type as it stands —
     * it was chosen for the user, and unpicking an agent is no reason to take it away again.
     * @param {string} agentId - The agent the review text came from, or '' when cleared.
     * @param {string[]} resources - Configured resource names ([] disables the unresolved-name check).
     * @private
     */
    _setReviewScope(agentId, resources) {
        this._reviewResources = resources || [];
        this._applyAgentKind(agentId, true);
        this._syncTemplatesKindSelect();
        this._runInstructionReview();
    }

    /**
     * Collects the names instructions can legitimately reference: tools, topics, knowledge sources
     * and connected agents. Both the display name and the schema name's trailing segment count —
     * makers reference either.
     * @param {AgentComponent[]} components
     * @returns {string[]}
     * @private
     */
    _collectAgentResources(components) {
        const referable = new Set(['action', 'topic', 'knowledge', 'connectedAgent']);
        const names = new Set();
        (components || []).forEach(component => {
            if (!referable.has(getComponentKind(component))) {
                return;
            }
            if (component.name) {
                names.add(component.name);
            }
            const segment = String(component.schemaName || '').split('.').pop();
            if (segment) {
                names.add(segment);
            }
        });
        return [...names];
    }

    /**
     * Syncs the Review toolbar buttons to the source of the text: "Open agent definition" only
     * when the text came from an agent, "Load example" only when no agent is selected.
     * @private
     */
    _syncReviewButtons() {
        const openBtn = this.ui.host?.querySelector('[data-action="review-open-agent"]');
        if (openBtn) {
            openBtn.style.display = this._reviewAgentId ? '' : 'none';
        }
        const exampleBtn = this.ui.host?.querySelector('[data-action="review-example"]');
        if (exampleBtn) {
            exampleBtn.style.display = this._reviewAgentId ? 'none' : '';
        }
    }

    /**
     * Fills the review box with the deliberately flawed sample so the checker's findings can be
     * seen instantly.
     * @private
     */
    _handleReviewExample() {
        this._reviewAgentId = '';
        this._setReviewText(REVIEW_SAMPLE);
        // The sample replaces whatever was pasted, so it becomes the text to restore later.
        this._pastedReviewText = REVIEW_SAMPLE;
        const agentSelect = this.ui.host?.querySelector('.pdt-review-agent');
        if (agentSelect) {
            agentSelect.value = '';
        }
        this._syncReviewButtons();
        // The sample belongs to no agent, so the resource check switches off — but the agent type
        // is the user's choice and stays put; a Review button must not re-scope the whole workbench.
        this._reviewResources = [];
        this._syncTemplatesKindSelect();
        this._runInstructionReview();
    }

    /**
     * Jumps from review findings to the reviewed agent's definition dialog.
     * @private
     */
    _handleReviewOpenAgent() {
        const agent = (this.agents || []).find(a => a.id === this._reviewAgentId);
        if (agent) {
            this._handleViewDefinition(agent.id, agent.name);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // SHARED HELPERS
    // ═══════════════════════════════════════════════════════════

    /**
     * Builds a read-only code block (when not editable) or an editable textarea with Save/Undo.
     * @param {string} value - The initial value.
     * @param {object} opts
     * @param {boolean} opts.editable - Whether the section is editable.
     * @param {'json'|'text'} [opts.language='json'] - Language for the read-only code block.
     * @param {boolean} [opts.validateJson=false] - Validate JSON before saving.
     * @param {(value: string) => Promise<any>} opts.onSave - Persists the new value.
     * @returns {HTMLElement}
     * @private
     */
    _buildEditableSection(value, { editable, language = 'json', validateJson = false, onSave, editor = null, synced = false }) {
        if (!editable) {
            return UIFactory.createCopyableCodeBlock(value, language);
        }
        const wrapper = document.createElement('div');
        wrapper.className = 'pdt-agent-edit';

        const textarea = document.createElement('textarea');
        textarea.className = 'pdt-input pdt-agent-edit-textarea';
        // Prose (text) wraps so long lines stay visible; code/JSON keeps its no-wrap horizontal scroll.
        if (language === 'text') {
            textarea.classList.add('pdt-agent-edit-textarea--wrap');
        }
        textarea.spellcheck = false;
        textarea.value = value;
        wrapper.appendChild(textarea);

        if (synced) {
            // Editable, but persisted through another section it is kept in sync with (see
            // {@link _wireInstructionSync}) — so it gets no Save/Undo of its own here.
            return wrapper;
        }
        if (editor) {
            // Footer mode: the shared dialog footer renders Save / Save & Publish / Undo for all sections.
            // Read `original` back from the textarea (it normalizes CRLF -> LF) so it isn't falsely dirty.
            editor.register({ textarea, original: textarea.value, validateJson, onSave });
        } else {
            // Inline mode: per-section Save / Undo with dirty-aware styling.
            wrapper.appendChild(this._buildInlineEditActions(textarea, { validateJson, onSave }));
        }
        return wrapper;
    }

    /**
     * Builds inline Save/Undo actions for a textarea: Save turns primary (blue) and Undo appears only
     * when there are unsaved changes; Undo reverts.
     * @param {HTMLTextAreaElement} textarea
     * @param {{validateJson: boolean, onSave: (value: string) => Promise<any>}} opts
     * @returns {HTMLElement}
     * @private
     */
    _buildInlineEditActions(textarea, { validateJson, onSave }) {
        const M = Config.MESSAGES.AGENTS;
        const actions = document.createElement('div');
        actions.className = 'pdt-agent-edit-actions';
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.textContent = M.save;
        const undoBtn = document.createElement('button');
        undoBtn.type = 'button';
        undoBtn.className = 'modern-button secondary';
        undoBtn.textContent = M.undo;
        actions.append(saveBtn, undoBtn);

        let original = textarea.value;
        const refresh = () => {
            const dirty = textarea.value !== original;
            saveBtn.className = dirty ? 'modern-button' : 'modern-button secondary';
            saveBtn.disabled = !dirty;
            undoBtn.style.display = dirty ? '' : 'none';
        };
        refresh();
        textarea.addEventListener('input', refresh);
        undoBtn.addEventListener('click', () => {
            textarea.value = original;
            refresh();
        });
        saveBtn.addEventListener('click', async () => {
            const newVal = textarea.value;
            if (validateJson) {
                try {
                    JSON.parse(newVal);
                } catch {
                    NotificationService.show(M.invalidJson, 'error');
                    return;
                }
            }
            saveBtn.disabled = true;
            try {
                BusyIndicator.set();
                await onSave(newVal);
                original = newVal;
                refresh();
                NotificationService.show(M.saved, 'success');
            } catch (e) {
                NotificationService.show(M.saveFailed(escapeHtml(e.message)), 'error');
                refresh();
            } finally {
                BusyIndicator.clear();
            }
        });
        return actions;
    }

    /**
     * Creates a shared editor controller for the definition dialog: a footer with Save / Save & Publish
     * / Undo that tracks all registered editable sections (Overview, Components, Configuration).
     * @param {Agent} agent
     * @param {{onStateChanged?: () => Promise<void>|void}} [opts] - `onStateChanged` fires after any
     *   successful save or publish, so dependent panels can re-read what changed.
     * @returns {{footerEl: HTMLElement, register: (section: object) => void}}
     * @private
     */
    _createDefinitionEditor(agent, { onStateChanged = null } = {}) {
        const M = Config.MESSAGES.AGENTS;
        const sections = [];

        const footer = document.createElement('div');
        footer.className = 'pdt-agent-footer-actions';
        const savePublishBtn = document.createElement('button');
        savePublishBtn.type = 'button';
        savePublishBtn.className = 'modern-button';
        savePublishBtn.textContent = M.saveAndPublish;
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'modern-button secondary';
        saveBtn.textContent = M.save;
        saveBtn.disabled = true;
        const undoBtn = document.createElement('button');
        undoBtn.type = 'button';
        undoBtn.className = 'modern-button secondary';
        undoBtn.textContent = M.undo;
        undoBtn.style.display = 'none';
        footer.append(savePublishBtn, saveBtn, undoBtn);

        const isDirty = () => sections.some(s => s.textarea.value !== s.original);
        const update = () => {
            const dirty = isDirty();
            saveBtn.className = dirty ? 'modern-button' : 'modern-button secondary';
            saveBtn.disabled = !dirty;
            undoBtn.style.display = dirty ? '' : 'none';
        };

        /**
         * Locks the footer actions for the duration of an in-flight save/publish. Without this the
         * clicked button stays active until the write finishes, so the click looks ignored; it also
         * lets a second click fire a duplicate write, and lets Undo rewrite a textarea that
         * `saveDirty` has not read yet. Always paired with `setBusy(false)` before `update()`, which
         * then restores Save from the real dirty state.
         * @param {boolean} busy
         */
        const setBusy = (busy) => {
            savePublishBtn.disabled = busy;
            saveBtn.disabled = busy;
            undoBtn.disabled = busy;
        };

        const saveDirty = async () => {
            const dirtySections = sections.filter(s => s.textarea.value !== s.original);
            for (const s of dirtySections) {
                if (s.validateJson) {
                    try {
                        JSON.parse(s.textarea.value);
                    } catch {
                        NotificationService.show(M.invalidJson, 'error');
                        return false;
                    }
                }
            }
            for (const s of dirtySections) {
                await s.onSave(s.textarea.value);
                s.original = s.textarea.value;
            }
            return true;
        };

        saveBtn.addEventListener('click', async () => {
            setBusy(true);
            try {
                BusyIndicator.set();
                if (await saveDirty()) {
                    NotificationService.show(M.saved, 'success');
                    await onStateChanged?.();
                }
            } catch (e) {
                NotificationService.show(M.saveFailed(escapeHtml(e.message)), 'error');
            } finally {
                setBusy(false);
                update();
                BusyIndicator.clear();
            }
        });

        savePublishBtn.addEventListener('click', async () => {
            const confirmed = await showConfirmDialog(M.publishConfirmTitle, M.publishConfirm(escapeHtml(agent.name)));
            if (!confirmed) {
                return;
            }
            setBusy(true);
            NotificationService.show(M.publishing, 'info');
            try {
                BusyIndicator.set();
                if (isDirty() && !(await saveDirty())) {
                    return;
                }
                const before = await DataService.getAgentPublishState(agent.id).catch(() => null);
                const previous = before?.publishedOnRaw || agent.publishedOnRaw || '';
                await DataService.publishAgent(agent.id);

                if (await this._waitForPublish(agent.id, previous)) {
                    NotificationService.show(M.published, 'success');
                } else {
                    NotificationService.show(M.publishUnconfirmed, 'info');
                    this._watchPublishInBackground(agent, previous, onStateChanged).catch(() => {});
                }
            } catch (e) {
                NotificationService.show(M.publishFailed(escapeHtml(e.message)), 'error');
            } finally {
                setBusy(false);
                update();
                await onStateChanged?.();
                BusyIndicator.clear();
            }
        });

        undoBtn.addEventListener('click', () => {
            sections.forEach(s => {
                s.textarea.value = s.original;
                // Notify dependents (e.g. the synced instructions view) that the value was reverted.
                s.textarea.dispatchEvent(new Event('input', { bubbles: true }));
            });
            update();
        });

        return {
            footerEl: footer,
            register(section) {
                sections.push(section);
                section.textarea.addEventListener('input', update);
                update();
            }
        };
    }

    /**
     * Pretty-prints a JSON string, falling back to the raw text if it is not valid JSON.
     * @param {string} jsonString
     * @returns {string}
     * @private
     */
    _prettyJson(jsonString) {
        try {
            return JSON.stringify(JSON.parse(jsonString), null, 2);
        } catch {
            return jsonString;
        }
    }

    /**
     * Returns true when a string parses as a JSON object/array.
     * @param {string} str
     * @returns {boolean}
     * @private
     */
    _looksLikeJson(str) {
        if (typeof str !== 'string') {
            return false;
        }
        const trimmed = str.trim();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            return false;
        }
        try {
            JSON.parse(trimmed);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Loads the solutions list (once) and populates the solution filter for a scope.
     * @param {'agents'|'prompts'} scope
     * @private
     */
    async _ensureSolutionsAndPopulate(scope) {
        const items = scope === 'prompts' ? (this.aiModels || []) : (this.agents || []);

        // A record's own solutionid points to the invisible "Active" layer, so it is NOT what the
        // other tabs show. Resolve the real membership from solutioncomponent and cache it per item.
        const unresolved = items.filter(i => i.solutionIds === undefined);
        if (unresolved.length) {
            try {
                const memberships = await DataService.getSolutionMemberships(unresolved.map(i => i.id));
                unresolved.forEach(i => {
                    i.solutionIds = memberships[i.id] || [];
                });
            } catch {
                unresolved.forEach(i => {
                    i.solutionIds = [];
                });
            }
        }

        // Resolve display names for every solution referenced by membership (includes Default/Active).
        const allIds = [...new Set(items.flatMap(i => i.solutionIds || []))];
        const missing = allIds.filter(id => !this.solutionsMap[id]);
        if (missing.length) {
            try {
                Object.assign(this.solutionsMap, await DataService.getAgentSolutionNames(missing));
            } catch {
                // Fall back to the labeled short id in the dropdown.
            }
        }

        // Reflect membership onto the already-rendered cards so the dropdown filter can match.
        items.forEach(i => {
            const card = this.ui.host?.querySelector(`[data-agent-id="${i.id}"], [data-model-id="${i.id}"]`);
            if (card) {
                card.dataset.solutionIds = (i.solutionIds || []).join(' ');
            }
        });

        this._populateSolutionFilter(scope);
    }

    /**
     * Rebuilds a solution-filter <select> with an "All" option plus one option per id (sorted by
     * label, named from solutionsMap with a labeled short id as a last resort), preserving the
     * current selection. Shared by the Agents/Prompts and Workflows dropdowns.
     * @param {HTMLSelectElement} select - The dropdown to fill.
     * @param {string[]} ids - Solution GUIDs (any order; deduped and sorted here).
     * @private
     */
    _fillSolutionSelect(select, ids) {
        const M = Config.MESSAGES.AGENTS;
        // Only list solutions that resolved to a visible name — this drops the invisible "Active"
        // working layer (which getAgentSolutionNames intentionally does not resolve).
        const visible = [...new Set(ids)].filter(id => this.solutionsMap[id]);
        const sorted = visible.sort((a, b) => this.solutionsMap[a].localeCompare(this.solutionsMap[b]));
        const current = select.value;
        select.innerHTML = `<option value="">${M.solutionFilterAll}</option>`;
        sorted.forEach(id => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = this.solutionsMap[id];
            select.appendChild(option);
        });
        if (current && sorted.includes(current)) {
            select.value = current;
        }
    }

    /**
     * Fills the solution dropdown for a scope with the solutions that actually contain items
     * (resolved from solutioncomponent membership, including the Default/Active solution).
     * @param {'agents'|'prompts'} scope
     * @private
     */
    _populateSolutionFilter(scope) {
        const select = this.ui.host?.querySelector(`.pdt-agents-solution[data-scope="${scope}"]`);
        if (!select) {
            return;
        }
        const items = scope === 'prompts' ? (this.aiModels || []) : (this.agents || []);
        this._fillSolutionSelect(select, items.flatMap(i => i.solutionIds || []));
    }

    /**
     * Filters the visible cards in the active view by search term and selected solution.
     * @private
     */
    _filterCards() {
        const scope = this.activeView === 'prompts' ? 'prompts' : 'agents';
        const search = this.ui.host?.querySelector(`.pdt-agents-search[data-scope="${scope}"]`);
        const solutionSelect = this.ui.host?.querySelector(`.pdt-agents-solution[data-scope="${scope}"]`);
        const term = search?.value?.toLowerCase().trim() || '';
        const solutionId = solutionSelect?.value || '';

        const cards = this.ui.host?.querySelectorAll('.pdt-agent-card');
        if (!cards?.length) {
            return;
        }
        let visible = 0;
        cards.forEach(card => {
            const matchesSearch = (card.dataset.searchTerm || '').includes(term);
            const matchesSolution = !solutionId
                || (card.dataset.solutionIds || '').split(' ').filter(Boolean).includes(solutionId);
            const match = matchesSearch && matchesSolution;
            card.style.display = match ? '' : 'none';
            if (match) {
                visible += 1;
            }
        });

        const list = this.ui.host?.querySelector('#pdt-agents-list, #pdt-models-list');
        if (list) {
            const message = scope === 'prompts'
                ? Config.MESSAGES.AGENTS.noModelsMatch
                : Config.MESSAGES.AGENTS.noAgentsMatch;
            this._toggleFilterEmptyState(list, 'pdt-agent-cards-empty', visible === 0, message);
        }
    }

    /**
     * Shows or removes a shared "no match" empty-state note inside a filterable list.
     * @param {HTMLElement} list - The container holding the filtered items.
     * @param {string} cssClass - Unique marker class for the note element.
     * @param {boolean} show - Whether the empty-state should be visible.
     * @param {string} message - The note text.
     * @private
     */
    _toggleFilterEmptyState(list, cssClass, show, message) {
        let note = list.querySelector(`.${cssClass}`);
        if (show) {
            if (!note) {
                note = document.createElement('p');
                note.className = `pdt-note ${cssClass}`;
                list.appendChild(note);
            }
            // Assigned every time: the reason a list is empty can change while the note is showing.
            note.textContent = message;
        } else if (note) {
            note.remove();
        }
    }

    /**
     * Resolves the Power Platform environment id (for portal deep links). The model-driven client
     * context does not expose it, so DataService reads it once from the Web API and caches it.
     * @returns {Promise<string|null>}
     * @private
     */
    _getEnvironmentId() {
        return DataService.getEnvironmentId();
    }

    /**
     * Opens an agent in the Copilot Studio maker portal.
     *
     * The route depends on the agent experience. The portal serves a modern generative agent from
     * `/agents/{botid}` and a classic topic-based one from `/bots/{botid}/overview` — different
     * segment *and* different suffix. Linking everything to the classic route sent modern agents to
     * a page the portal doesn't serve for them.
     * @param {string} agentId - The bot GUID.
     * @private
     */
    async _openInCopilotStudio(agentId) {
        if (!agentId) {
            return;
        }
        const envId = await this._getEnvironmentId();
        if (!envId) {
            window.open('https://copilotstudio.microsoft.com/', '_blank');
            return;
        }
        // Unknown kind falls back to the modern route, which is what a new agent is today.
        const agent = this.agents?.find(a => a.id === agentId);
        const path = agent && !agent.isModern
            ? `bots/${agentId}/overview`
            : `agents/${agentId}`;
        window.open(`https://copilotstudio.microsoft.com/environments/${envId}/${path}`, '_blank');
    }

    /**
     * Opens an AI Builder item in the Power Apps maker portal. GPT prompts are solution-scoped
     * (…/aibuilder/solutions/{solutionId}/prompts/{id}); trained/prebuilt models use the flat
     * …/aibuilder/models/{id} path. Prompts are resolved under the visible Default solution, which
     * always contains them, so the link does not depend on a hidden system solution.
     * @param {string} modelId
     * @private
     */
    async _openInAiBuilder(modelId) {
        if (!modelId) {
            return;
        }
        const envId = await this._getEnvironmentId();
        if (!envId) {
            window.open('https://make.powerapps.com/', '_blank');
            return;
        }
        const base = `https://make.powerapps.com/environments/${envId}/aibuilder`;
        const model = this.aiModels?.find(m => m.id === modelId) || {};

        // GPT prompts open in their solution-scoped editor. Classified on the template's invariant
        // unique name, never on the lookup's localizable display name.
        if (isPromptTemplate(model.templateName)) {
            const solutionId = await DataService.getDefaultSolutionId();
            window.open(solutionId ? `${base}/solutions/${solutionId}/prompts/${modelId}` : `${base}/models`, '_blank');
            return;
        }

        // Custom (unmanaged) models have an editor page at /models/{id}/editor; prebuilt managed
        // system templates do not, so land those on the models list (no "Couldn't load model").
        window.open(model.isManaged ? `${base}/models` : `${base}/models/${modelId}/editor`, '_blank');
    }
}
