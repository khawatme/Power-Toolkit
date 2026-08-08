/**
 * @file Data access layer orchestrator for the application.
 * @module services/DataService
 * @description Orchestrates data operations by delegating to domain-specific services.
 * Maintains backward compatibility while following separation of concerns.
 * All components should request data through this service.
 */

import { PowerAppsApiService } from './PowerAppsApiService.js';
import { MetadataService } from './MetadataService.js';
import { EnvironmentVariableService } from './EnvironmentVariableService.js';
import { FormInspectionService } from './FormInspectionService.js';
import { FlowService } from './FlowService.js';
import { AgentService } from './AgentService.js';
import { OrganizationService } from './OrganizationService.js';
import { AutomationService } from './AutomationService.js';
import { WebApiService } from './WebApiService.js';
import { NotificationService } from './NotificationService.js';
import { Config } from '../constants/index.js';
import { UIManager } from '../core/UIManager.js';
import { Store } from '../core/Store.js';
import { isOdataProperty } from '../helpers/index.js';

/**
 * @typedef {object} EnvironmentVariable
 * @property {string} definitionId - The GUID of the variable definition.
 * @property {string|null} valueId - The GUID of the variable's current value record.
 * @property {string} schemaName - The schema name (e.g., "new_MyVariable").
 * @property {string} displayName - The user-friendly display name.
 * @property {string} type - The data type of the variable.
 * @property {string} defaultValue - The default value.
 * @property {string} currentValue - The current overridden value.
 */

/**
 * @typedef {object} FormColumn
 * @property {string} displayName - The user-friendly label of the column.
 * @property {string} logicalName - The schema name of the column.
 * @property {any} value - The current value of the column on the form.
 * @property {string} type - The attribute type (e.g., "string", "lookup").
 * @property {boolean} isDirty - True if the column's value has been changed.
 * @property {string} requiredLevel - The required level ('none', 'required', 'recommended').
 * @property {Xrm.Attributes.Attribute} attribute - The underlying Xrm.Attribute object.
 * @property {boolean} [onForm] - True if the column is present on the form (used in 'all record columns' view).
 * @property {boolean} [isSystem] - True if the column is a system-managed property (used in 'all record columns' view).
 */

/** @private @type {string|null} The GUID of the user currently being impersonated. */
let _impersonatedUserId = null;
/** @private @type {string|null} The full name of the user currently being impersonated. */
let _impersonatedUserName = null;
/** @private @type {string|null|undefined} Cached Power Platform environment id (undefined = not yet fetched). */
let _environmentId;
/** @private @type {string|null|undefined} Cached Default solution id (undefined = not yet fetched). */
let _defaultSolutionId;

/**
 * Core Web API fetch with impersonation support.
 * @private
 * @param {string} method - HTTP method
 * @param {string} logicalName - Entity logical name
 * @param {string} queryString - Query string
 * @param {object|null} data - Request body
 * @param {HeadersInit} customHeaders - Custom headers
 * @returns {Promise<object>}
 */
function _webApiFetch(method, logicalName, queryString = '', data = null, customHeaders = {}) {
    return _dispatch(_impersonatedUserId, _webApiFetch, method, logicalName, queryString, data, customHeaders);
}

/**
 * Core Web API fetch that never impersonates, whatever the current impersonation state.
 *
 * Impersonation is a lens on the *data*, not on the tool itself. Looking up who is being
 * impersonated, or listing users to switch to, has to keep working even when the impersonated user
 * cannot read the systemuser table — otherwise impersonating a user with no security roles returns
 * 403 from the very screen you would use to switch away from them.
 * @private
 * @param {string} method - HTTP method
 * @param {string} logicalName - Entity logical name
 * @param {string} queryString - Query string
 * @param {object|null} data - Request body
 * @param {HeadersInit} customHeaders - Custom headers
 * @returns {Promise<object>}
 */
function _webApiFetchAsSelf(method, logicalName, queryString = '', data = null, customHeaders = {}) {
    return _dispatch(null, _webApiFetchAsSelf, method, logicalName, queryString, data, customHeaders);
}

/**
 * Shared body of {@link _webApiFetch} and {@link _webApiFetchAsSelf}.
 * @private
 * @param {string|null} callerId - User to impersonate, or null to run as the signed-in user
 * @param {Function} self - The wrapper being dispatched, reused for the metadata pre-load
 * @param {string} method - HTTP method
 * @param {string} logicalName - Entity logical name
 * @param {string} queryString - Query string
 * @param {object|null} data - Request body
 * @param {HeadersInit} customHeaders - Custom headers
 * @returns {Promise<object>}
 */
async function _dispatch(callerId, self, method, logicalName, queryString, data, customHeaders) {
    // Ensure entity metadata is loaded for name resolution.
    // Skip only for EntityDefinitions to avoid recursion
    if (!logicalName.startsWith('EntityDefinitions')) {
        await MetadataService.loadEntityMetadata(self, callerId);
    }

    // Use arrow functions to defer DataService reference until runtime
    const getEntitySetName = (name) => {
        // eslint-disable-next-line no-use-before-define
        return DataService?.getEntitySetName
            // eslint-disable-next-line no-use-before-define
            ? DataService.getEntitySetName(name)
            : MetadataService.getEntitySetName(name);
    };
    const getLogicalName = (setName) => {
        return MetadataService.getLogicalName(setName);
    };
    return WebApiService.webApiFetch(
        method,
        logicalName,
        queryString,
        data,
        customHeaders,
        getEntitySetName,
        getLogicalName,
        callerId
    );
}

/** @private @type {Map<string, any>} Caches the results of data-fetching operations. */
const _cache = new Map();

/**
 * Cached organization-diagnostics promise. Org-level settings don't change within a session, and four
 * features read them (Plugin Traces, Transcripts, Run History, Agent Activity), so we fetch once and
 * share the result. Best-effort: a failure resets the cache so a later call can retry, and — unlike
 * {@link _fetch} — it never shows a toast, so every caller degrades silently.
 * @private @type {Promise<import('./OrganizationService.js').OrganizationDiagnostics>|null}
 */
let _orgDiagnosticsPromise = null;

/**
 * Generic caching helper.
 * @private
 * @param {string} key
 * @param {Function} fetcher
 * @param {boolean} [bypassCache=false]
 * @returns {Promise<any>}
 */
async function _fetch(key, fetcher, bypassCache = false) {
    if (!bypassCache && _cache.has(key)) {
        return _cache.get(key);
    }
    try {
        const data = await fetcher();
        _cache.set(key, data);
        return data;
    } catch (error) {
        const userMessage = `Data fetch failed for '${key}'.`;
        NotificationService.show(userMessage, 'error');
        console.error(`DataService fetch failed for key '${key}':`, error);
        throw new Error(userMessage);
    }
}

/**
 * The public interface for the DataService, providing methods for data access and manipulation.
 * @namespace DataService
 */
export const DataService = {
    /**
     * Sets the "current solution" by unique name and caches its publisher prefix.
     * Call this once from your app boot or a solution selector.
     */
    // eslint-disable-next-line require-await
    async setCurrentSolution(uniqueName) {
        return EnvironmentVariableService.setCurrentSolution(uniqueName, this.retrieveMultipleRecords.bind(this));
    },

    /** Returns { uniqueName, publisherPrefix } or nulls */
    getCurrentSolution() {
        return EnvironmentVariableService.getCurrentSolution();
    },

    deleteEnvironmentVariable(definitionId) {
        return EnvironmentVariableService.deleteEnvironmentVariable(
            this.retrieveRecord.bind(this),
            this.deleteRecord.bind(this),
            definitionId
        );
    },

    /**
     * Adds a component to a solution (Dataverse AddSolutionComponent).
     * @param {string} solutionUniqueName
     * @param {string} componentId - GUID
     * @param {number} componentType - 380=EnvVarDefinition, 381=EnvVarValue
     * @param {boolean} [addRequired=false]
     */
    async addSolutionComponent(solutionUniqueName, componentId, componentType, addRequired = false) {
        if (!solutionUniqueName) {
            return;
        }
        const payload = {
            ComponentId: componentId,
            ComponentType: componentType,
            SolutionUniqueName: solutionUniqueName,
            AddRequiredComponents: !!addRequired,
            DoNotIncludeSubcomponents: true,
            IncludedComponentSettingsValues: []
        };
        // Action endpoint
        await _webApiFetch('POST', 'AddSolutionComponent', '', payload);
    },

    /**
    * Lists visible unmanaged solutions with publisher prefix for user selection.
    * @returns {Promise<Array<{uniqueName:string,friendlyName:string,prefix:string}>>}
    */
    async listSolutions() {
        const q =
            '?$select=uniquename,friendlyname' +
            '&$filter=ismanaged eq false and isvisible eq true' +
            '&$expand=publisherid($select=customizationprefix)' +
            '&$orderby=friendlyname asc';
        const r = await DataService.retrieveMultipleRecords('solution', q);
        const rows = r?.entities || [];
        return rows.map(s => ({
            uniqueName: s.uniquename,
            friendlyName: s.friendlyname,
            prefix: s.publisherid?.customizationprefix || ''
        }));
    },

    /**
     * Starts impersonating a specified user for all subsequent API calls.
     * @param {string} userId - The GUID of the user to impersonate.
     * @param {string} userName - The full name of the user to impersonate.
     */
    setImpersonation(userId, userName) {
        _impersonatedUserId = userId;
        _impersonatedUserName = userName;
        UIManager.showImpersonationIndicator(userName);
        NotificationService.show(Config.MESSAGES.DATA_SERVICE.impersonationStarted, 'success');
        // Preserve entity set name mappings - they're system-level metadata, not user-specific
        this.clearCache(null, true);
        Store.setState({ impersonationUserId: userId });
    },

    /**
     * Stops impersonation and reverts to the logged-in user's context.
     */
    clearImpersonation() {
        _impersonatedUserId = null;
        _impersonatedUserName = null;
        UIManager.showImpersonationIndicator(null);
        NotificationService.show(Config.MESSAGES.DATA_SERVICE.impersonationEnded, 'info');
        // Preserve entity set name mappings - they're system-level metadata, not user-specific
        this.clearCache(null, true);
        Store.setState({ impersonationUserId: null });
    },

    /**
     * Gets the current impersonation status.
     * @returns {{isImpersonating: boolean, userId: string|null, userName: string|null}}
     */
    getImpersonationInfo() {
        return { isImpersonating: !!_impersonatedUserId, userId: _impersonatedUserId, userName: _impersonatedUserName };
    },

    /**
     * Activates or deactivates a business rule by updating its state.
     * @param {string} ruleId - The GUID of the business rule's definition record.
     * @param {boolean} activate - True to activate, false to deactivate.
     * @returns {Promise<object>}
     */
    setBusinessRuleState(ruleId, activate) {
        return AutomationService.setBusinessRuleState(this.updateRecord.bind(this), ruleId, activate);
    },

    /**
     * Deletes a business rule record.
     * @param {string} ruleId - The GUID of the business rule's definition record.
     * @returns {Promise<object>}
     */
    deleteBusinessRule(ruleId) {
        return AutomationService.deleteBusinessRule(this.deleteRecord.bind(this), ruleId);
    },

    /**
     * Retrieves all solutions that contain cloud flows.
     * @returns {Promise<Array<{solutionid: string, friendlyname: string, uniquename: string, ismanaged: boolean}>>}
     */
    getSolutionsWithFlows() {
        return FlowService.getSolutionsWithFlows(_webApiFetch);
    },

    /**
     * Retrieves cloud flows belonging to a specific solution.
     * @param {string} solutionId - The solution GUID.
     * @returns {Promise<import('./FlowService.js').CloudFlow[]>}
     */
    getCloudFlowsBySolution(solutionId) {
        return FlowService.getCloudFlowsBySolution(this.executeFetchXml.bind(this), _webApiFetch, solutionId);
    },

    /**
     * Retrieves all cloud flows (Modern Flows, category=5) from the environment.
     * @returns {Promise<import('./FlowService.js').CloudFlow[]>}
     */
    getCloudFlows() {
        return FlowService.getCloudFlows(this.executeFetchXml.bind(this));
    },

    /**
     * Retrieves the full flow definition (clientdata) for a specific flow.
     * @param {string} flowId - The workflow GUID.
     * @returns {Promise<string|null>}
     */
    getFlowDefinition(flowId) {
        return FlowService.getFlowDefinition(this.executeFetchXml.bind(this), flowId);
    },

    /**
     * Activates or deactivates a cloud flow.
     * @param {string} flowId - The workflow GUID.
     * @param {boolean} activate - True to turn on, false to turn off.
     * @returns {Promise<object>}
     */
    setFlowState(flowId, activate) {
        return FlowService.setFlowState(this.updateRecord.bind(this), flowId, activate);
    },

    /**
     * Deletes a cloud flow.
     * @param {string} flowId - The workflow GUID.
     * @returns {Promise<object>}
     */
    deleteFlow(flowId) {
        return FlowService.deleteFlow(this.deleteRecord.bind(this), flowId);
    },

    /**
     * Updates the flow definition (clientdata) for an unmanaged flow.
     * @param {string} flowId - The workflow GUID.
     * @param {string} clientData - The new clientdata JSON string.
     * @returns {Promise<object>}
     */
    updateFlowDefinition(flowId, clientData) {
        return FlowService.updateFlowDefinition(this.updateRecord.bind(this), flowId, clientData);
    },

    /**
     * Retrieves the run history for a cloud flow from the Dataverse `flowrun` table.
     * @param {string} workflowId - The workflow (flow) GUID.
     * @param {{top?: number, status?: string}} [options] - Query options.
     * @returns {Promise<import('./FlowService.js').FlowRun[]>}
     */
    getFlowRuns(workflowId, options = {}) {
        return FlowService.getFlowRuns(_webApiFetch, workflowId, options);
    },

    /**
     * Retrieves the per-action logs for a specific flow run from the `flowlog` table.
     * @param {string} flowRunId - The flowrun GUID.
     * @param {{top?: number}} [options] - Query options.
     * @returns {Promise<import('./FlowService.js').FlowRunLog[]>}
     */
    getFlowRunLogs(flowRunId, options = {}) {
        return FlowService.getFlowRunLogs(_webApiFetch, flowRunId, options);
    },

    /**
     * Retrieves environment-level diagnostic settings (plugin trace logging level, Copilot Studio
     * transcript recording, cloud-flow run retention) from the organization table. Used to explain
     * otherwise-silent empty states across tabs.
     * @returns {Promise<import('./OrganizationService.js').OrganizationDiagnostics>}
     */
    getOrganizationDiagnostics() {
        if (!_orgDiagnosticsPromise) {
            _orgDiagnosticsPromise = OrganizationService
                .getDiagnosticSettings(this.retrieveMultipleRecords.bind(this))
                .catch(err => {
                    _orgDiagnosticsPromise = null; // allow a retry on the next call after a failure
                    throw err;
                });
        }
        return _orgDiagnosticsPromise;
    },

    /**
     * Changes the environment-wide plug-in trace logging level (Off / Exception / All) and keeps the
     * shared diagnostics cache truthful, so every tab that explains itself with this setting agrees
     * with what the user just chose without a refetch.
     * @param {number} level - One of `PLUGIN_TRACE_LOG_SETTING` (0 = Off, 1 = Exception, 2 = All).
     * @returns {Promise<void>}
     * @throws {Error} When the organization row is unreadable, the level is invalid, or the caller
     * lacks the privilege to write organization settings.
     */
    async setPluginTraceLogSetting(level) {
        const diagnostics = await this.getOrganizationDiagnostics();
        await OrganizationService.setPluginTraceLogSetting(
            this.updateRecordAsSelf.bind(this),
            diagnostics.organizationId,
            level
        );
        diagnostics.pluginTraceLogSetting = level;
    },

    /**
     * Retrieves all Copilot Studio agents (the `bot` table) in the environment.
     * @returns {Promise<import('./AgentService.js').Agent[]>}
     */
    getAgents() {
        return AgentService.getAgents(this.retrieveMultipleRecords.bind(this));
    },

    /**
     * Retrieves the authoring components (topics, instructions, knowledge, tools) of an agent.
     * @param {string} botId - The bot GUID.
     * @returns {Promise<import('./AgentService.js').AgentComponent[]>}
     */
    getAgentComponents(botId) {
        return AgentService.getAgentComponents(this.retrieveMultipleRecords.bind(this), botId);
    },

    /**
     * Searches components across all agents for a keyword (names/descriptions + instruction bodies).
     * @param {string} keyword - The search term (minimum 2 characters).
     * @returns {Promise<import('./AgentService.js').SearchMatch[]>}
     */
    searchAgentComponents(keyword) {
        return AgentService.searchAgentComponents(this.retrieveMultipleRecords.bind(this), keyword);
    },

    /**
     * Retrieves the raw configuration JSON of an agent.
     * @param {string} botId - The bot GUID.
     * @returns {Promise<string|null>}
     */
    getAgentConfiguration(botId) {
        return AgentService.getAgentConfiguration(this.retrieveRecord.bind(this), botId);
    },

    /**
     * Activates or deactivates a Copilot Studio agent.
     * @param {string} botId - The bot GUID.
     * @param {boolean} activate - True to activate, false to deactivate.
     * @returns {Promise<object>}
     */
    setAgentState(botId, activate) {
        return AgentService.setAgentState(this.updateRecord.bind(this), botId, activate);
    },

    /**
     * Deletes a Copilot Studio agent (via the PvaDeleteBot bound action, cascading its components).
     * @param {string} botId - The bot GUID.
     * @returns {Promise<object>}
     */
    deleteAgent(botId) {
        return AgentService.deleteAgent(_webApiFetch, botId);
    },

    /**
     * Deletes an AI Builder model or prompt (the `msdyn_aimodel` table).
     * @param {string} modelId - The msdyn_aimodel GUID.
     * @returns {Promise<object>}
     */
    deleteAiModel(modelId) {
        return AgentService.deleteAiModel(this.deleteRecord.bind(this), modelId);
    },

    /**
     * Retrieves recent conversation transcripts for an agent.
     * @param {string} botId - The bot GUID.
     * @param {number} [top=50] - Maximum number of transcripts.
     * @returns {Promise<import('./AgentService.js').TranscriptSummary[]>}
     */
    getAgentTranscripts(botId, top = 50) {
        return AgentService.getTranscripts(this.retrieveMultipleRecords.bind(this), botId, top);
    },

    /**
     * Retrieves the full content (conversation/run JSON) of a single transcript.
     * @param {string} transcriptId - The conversationtranscript GUID.
     * @returns {Promise<string|null>}
     */
    getTranscriptContent(transcriptId) {
        return AgentService.getTranscriptContent(this.retrieveRecord.bind(this), transcriptId);
    },

    /**
     * Computes Dataverse-native session analytics for an agent from its conversation transcripts.
     * @param {string} botId - The bot GUID.
     * @param {number} [sampleSize=500] - Maximum number of recent transcripts to summarize.
     * @returns {Promise<import('./AgentService.js').AgentUsage>}
     */
    getAgentUsage(botId, sampleSize = 500) {
        return AgentService.getAgentUsage(this.retrieveMultipleRecords.bind(this), botId, sampleSize);
    },

    /**
     * Retrieves all AI Builder models and prompts (the `msdyn_aimodel` table).
     * @returns {Promise<import('./AgentService.js').AiModel[]>}
     */
    getAiModels() {
        return AgentService.getAiModels(this.retrieveMultipleRecords.bind(this));
    },

    /**
     * Retrieves an AI Builder model's definition (from its related msdyn_aiconfiguration record(s)).
     * @param {string} modelId - The msdyn_aimodel GUID.
     * @returns {Promise<{configurations: Array<{id: string, name: string, type: string, text: string}>, creationContext: string|null}>}
     */
    getAiModelDefinition(modelId, activeConfigId) {
        return AgentService.getAiModelDefinition(
            this.retrieveMultipleRecords.bind(this),
            this.retrieveRecord.bind(this),
            modelId,
            activeConfigId
        );
    },

    /**
     * Retrieves recent AI Builder runs/events for a model (the `msdyn_aievent` table).
     * @param {string} modelId - The msdyn_aimodel GUID.
     * @param {number} [top=25] - Maximum number of runs.
     * @returns {Promise<import('./AgentService.js').AiBuilderRun[]>}
     */
    getAiBuilderRuns(modelId, top = 25) {
        return AgentService.getAiBuilderRuns(this.retrieveMultipleRecords.bind(this), modelId, top);
    },

    /**
     * Retrieves the input (msdyn_datainfo) a single AI Builder run executed against.
     * @param {string} eventId - The msdyn_aievent GUID.
     * @returns {Promise<string|null>}
     */
    getAiBuilderRunInput(eventId) {
        return AgentService.getAiBuilderRunInput(this.retrieveRecord.bind(this), eventId);
    },

    /**
     * Resolves AI Builder Test hub artifacts — the reusable test cases and the history of test-run
     * batches — for a model/prompt, keyed by the polymorphic `msdyn_aiobjectid`.
     * @param {string} objectId - The AI object GUID (msdyn_aimodelid).
     * @returns {Promise<{testCases: Array, batches: Array}>}
     */
    getPromptEvaluations(objectId) {
        return AgentService.getPromptEvaluations(this.retrieveMultipleRecords.bind(this), objectId);
    },

    /**
     * Loads the saved input rows for a single test case.
     * @param {string} testCaseId - The msdyn_aitestcase GUID.
     * @returns {Promise<import('./AgentService.js').TestCaseInput[]>}
     */
    getTestCaseInputs(testCaseId) {
        return AgentService.getTestCaseInputs(this.retrieveMultipleRecords.bind(this), testCaseId);
    },

    /**
     * Loads the individual test runs inside a test-run batch.
     * @param {string} batchId - The msdyn_aitestrunbatch GUID.
     * @returns {Promise<import('./AgentService.js').TestRun[]>}
     */
    getTestBatchRuns(batchId) {
        return AgentService.getTestBatchRuns(this.retrieveMultipleRecords.bind(this), batchId);
    },

    /**
     * Saves a prompt's evaluation criteria (passing score + prebuilt checks).
     * @param {string} configId - The msdyn_aievaluationconfiguration GUID.
     * @param {string} raw - The current raw criteria JSON (preserved).
     * @param {object} values - Edited criteria values.
     * @returns {Promise<object>}
     */
    updateEvaluationCriteria(configId, raw, values) {
        return AgentService.updateEvaluationCriteria(this.updateRecord.bind(this), configId, raw, values);
    },

    /**
     * Deletes a single test case.
     * @param {string} testCaseId - The msdyn_aitestcase GUID.
     * @returns {Promise<object>}
     */
    deleteTestCase(testCaseId) {
        return AgentService.deleteTestCase(this.deleteRecord.bind(this), testCaseId);
    },

    /**
     * Updates a test case's expected output (PATCH msdyn_expectedoutput on msdyn_aitestcase).
     * @param {string} testCaseId - The msdyn_aitestcase GUID.
     * @param {string} expectedOutput - The new expected output.
     * @returns {Promise<object>}
     */
    updateTestCaseExpectedOutput(testCaseId, expectedOutput) {
        return AgentService.updateTestCaseExpectedOutput(this.updateRecord.bind(this), testCaseId, expectedOutput);
    },

    /**
     * Runs a prompt's test cases (create batch + runs, predict, grade, score, complete) exactly as the
     * AI Builder Test hub does. Consumes AI Builder credits.
     * @param {object} params - `{model, activeConfigId, promptConfigJson, criteria, testCases}`.
     * @returns {Promise<{batchId: string, ran: number, passed: number, failed: number}>}
     */
    runPromptTests(params) {
        return AgentService.runPromptTests({
            createRecord: this.createRecord.bind(this),
            updateRecord: this.updateRecord.bind(this),
            retrieveMultipleRecords: this.retrieveMultipleRecords.bind(this),
            webApiFetch: _webApiFetch,
            quickTest: this.quickTestAiConfiguration.bind(this)
        }, params);
    },

    /**
     * Updates a single field (`data` or `content`) of an agent component.
     * @param {string} componentId - The botcomponent GUID.
     * @param {'data'|'content'} field - The field to update.
     * @param {string} value - The new value.
     * @returns {Promise<object>}
     */
    updateAgentComponent(componentId, field, value) {
        return AgentService.updateAgentComponent(this.updateRecord.bind(this), componentId, field, value);
    },

    /**
     * Updates an agent's configuration JSON.
     * @param {string} botId - The bot GUID.
     * @param {string} configuration - The new configuration string.
     * @returns {Promise<object>}
     */
    updateAgentConfiguration(botId, configuration) {
        return AgentService.updateAgentConfiguration(this.updateRecord.bind(this), botId, configuration);
    },

    /**
     * Updates one payload column on an AI Builder model's configuration (often the prompt).
     * @param {string} configId - The msdyn_aiconfiguration GUID.
     * @param {string} value - The new column value.
     * @param {string} [column] - The column to write (defaults to `msdyn_customconfiguration`).
     * @returns {Promise<object>}
     */
    updateAiModelConfiguration(configId, value, column) {
        return AgentService.updateAiConfiguration(this.updateRecord.bind(this), configId, value, column);
    },

    /**
     * Publishes a GPT prompt's configuration via the AIModelPublish action (prompts reject a direct
     * PATCH of msdyn_customconfiguration).
     * @param {{id: string, name: string, templateId: string}} model - The prompt's model record.
     * @param {string} customConfiguration - The full GptDynamicPrompt JSON.
     * @returns {Promise<string>} The new run configuration GUID to poll for publish completion.
     */
    publishAiPrompt(model, customConfiguration) {
        return AgentService.publishAiPrompt(_webApiFetch, model, customConfiguration);
    },

    /**
     * Reads an AI configuration's publish status (AIModelPublish completes asynchronously).
     * @param {string} configId - The msdyn_aiconfiguration GUID.
     * @returns {Promise<{statusCode: number|null, status: string, isPublished: boolean}>}
     */
    getAiConfigurationStatus(configId) {
        return AgentService.getAiConfigurationStatus(this.retrieveRecord.bind(this), configId);
    },

    /**
     * Saves a prompt under a new name as an independent copy (AI Builder's "Save as").
     * @param {{templateId: string}} model - The source prompt's model.
     * @param {string} name - The new model's display name.
     * @param {string} customConfiguration - The prompt configuration JSON to copy.
     * @returns {Promise<{modelId: string, runConfigurationId: string}>}
     */
    saveAsAiPrompt(model, name, customConfiguration) {
        return AgentService.saveAsAiPrompt(_webApiFetch, model, name, customConfiguration);
    },

    /**
     * Runs a prompt configuration against the LLM without saving it (AI Builder's QuickTest).
     * @param {string} configId - The msdyn_aiconfiguration GUID to test against.
     * @param {string} customConfiguration - The GptDynamicPrompt JSON to run.
     * @param {{code: string, signature: string}|null} [reuse] - Code to run without regenerating.
     * @param {Object.<string, string|{base64Encoded: string}>|null} [inputs] - Input-variable values.
     * @param {boolean} [regenerate] - Drop the stored code so the model writes fresh Python.
     * @returns {Promise<import('./AgentService.js').QuickTestResult>}
     */
    quickTestAiConfiguration(configId, customConfiguration, reuse, inputs, regenerate) {
        return AgentService.quickTestAiConfiguration(_webApiFetch, configId, customConfiguration, reuse, inputs, regenerate);
    },

    /**
     * Starts training for an AI configuration. Training is asynchronous — poll
     * {@link getAiConfigurationStatus} for the outcome.
     * @param {string} configId - The msdyn_aiconfiguration GUID to train.
     * @returns {Promise<{status: string, error: string}>}
     */
    trainAiConfiguration(configId) {
        return AgentService.trainAiConfiguration(_webApiFetch, configId);
    },

    /**
     * Retrains a model by cloning its trained training configuration into a new iteration and training
     * that (a Done configuration can't be trained again in place).
     * @param {{id: string}} model - The AI model being retrained.
     * @param {{id: string, databinding?: string, customConfiguration?: string}} source - The trained
     *   training configuration to clone.
     * @returns {Promise<{configId: string, status: string, error: string}>}
     */
    retrainAiConfiguration(model, source) {
        return AgentService.retrainAiConfiguration(_webApiFetch, model, source);
    },

    /**
     * Runs a trained classification model's Quick test against a piece of text.
     * @param {string} configId - The msdyn_aiconfiguration GUID to test.
     * @param {string} text - The text to classify.
     * @returns {Promise<import('./AgentService.js').ClassifierResult>}
     */
    quickTestModel(configId, text) {
        return AgentService.quickTestModel(_webApiFetch, configId, text);
    },

    /**
     * Unpublishes a published run configuration (the config-bound UnpublishAIConfiguration action).
     * @param {string} configId - The published run configuration (msdyn_aiconfiguration) GUID.
     * @returns {Promise<{status: string, error: string}>}
     */
    unpublishAiConfiguration(configId) {
        return AgentService.unpublishAiConfiguration(_webApiFetch, configId);
    },

    /**
     * Publishes a trained model's last-trained version (create run config + PublishAIConfiguration).
     * @param {{id: string}} model - The AI model.
     * @param {string} trainingConfigId - The trained configuration to publish.
     * @param {{databinding?: string, schedulingoptions?: string, trainingDatabinding?: string}} options
     *   - The prior run config to clone (republish), or the training binding to derive a first publish.
     * @returns {Promise<{configId: string, status: string, error: string}>}
     */
    publishTrainedModel(model, trainingConfigId, options) {
        return AgentService.publishTrainedModel(_webApiFetch, model, trainingConfigId, options);
    },

    /**
     * Activates or deactivates an agent component.
     * @param {string} componentId - The botcomponent GUID.
     * @param {boolean} activate - True to activate, false to deactivate.
     * @returns {Promise<object>}
     */
    setAgentComponentState(componentId, activate) {
        return AgentService.setComponentState(this.updateRecord.bind(this), componentId, activate);
    },

    /**
     * Publishes an agent so authoring changes take effect (PvaPublish). Asynchronous — the response
     * only reports whether the publish was accepted; confirm with {@link getAgentPublishedOn}.
     * @param {string} botId - The bot GUID.
     * @returns {Promise<{PublishedBotContentId?: string, PublishBotJobResponse?: object|null}>}
     */
    publishAgent(botId) {
        return AgentService.publishAgent(_webApiFetch, botId);
    },

    /**
     * Reads an agent's `publishedon`, raw and formatted, to confirm an asynchronous publish landed.
     * @param {string} botId - The bot GUID.
     * @returns {Promise<{publishedOnRaw: string, publishedOn: string}>}
     */
    getAgentPublishState(botId) {
        return AgentService.getAgentPublishState(_webApiFetch, botId);
    },

    /**
     * Resolves the flows, AI models, and tools an agent links to (for the map and Workflows view).
     * @param {string} botId - The bot GUID.
     * @returns {Promise<{flows: Array<{id: string, name: string, statecode: number}>, models: Array<{id: string, name: string}>, tools: Array<{id: string, name: string}>}>}
     */
    getAgentLinks(botId) {
        return AgentService.getAgentLinks(this.retrieveMultipleRecords.bind(this), botId);
    },

    /**
     * Retrieves the Copilot Studio agent flows ("Workflows", modernflowtype=1) in the environment.
     * @returns {Promise<Array<{id: string, name: string, description: string, statecode: number, stateLabel: string, isManaged: boolean, owner: string, createdOn: string, modifiedOn: string, createdBy: string}>>}
     */
    getAgentFlows() {
        return AgentService.getAgentFlows(this.retrieveMultipleRecords.bind(this));
    },

    /**
     * Resolves the Power Platform environment id (for maker/Copilot Studio deep links). The model-driven
     * client context does not expose it, so it is read once from the Web API and cached for the session.
     * @returns {Promise<string|null>} The environment GUID, or null if unavailable.
     */
    async getEnvironmentId() {
        if (_environmentId !== undefined) {
            return _environmentId;
        }
        try {
            const response = await _webApiFetch('GET', "RetrieveCurrentOrganization(AccessType='Default')");
            _environmentId = response?.Detail?.EnvironmentId || null;
        } catch {
            _environmentId = null;
        }
        return _environmentId;
    },

    /**
     * Resolves the id of the visible "Default" solution, cached for the session. Used to build
     * solution-scoped AI Builder prompt URLs (every prompt with membership is in Default).
     * @returns {Promise<string|null>} The Default solution GUID, or null if unavailable.
     */
    async getDefaultSolutionId() {
        if (_defaultSolutionId !== undefined) {
            return _defaultSolutionId;
        }
        try {
            const response = await this.retrieveMultipleRecords(
                'solutions',
                "?$select=solutionid&$filter=uniquename eq 'Default'&$top=1"
            );
            _defaultSolutionId = response.entities?.[0]?.solutionid || null;
        } catch {
            _defaultSolutionId = null;
        }
        return _defaultSolutionId;
    },

    /**
     * Resolves display labels for the solutions that contain agents/models/flows (the ids come from
     * {@link DataService.getSolutionMemberships}).
     * @param {string[]} ids - Solution GUIDs.
     * @returns {Promise<Object.<string, string>>} Map of solution id → "Display Name (uniquename)" label.
     */
    getAgentSolutionNames(ids) {
        return AgentService.getSolutionNamesByIds(this.retrieveMultipleRecords.bind(this), ids);
    },

    /**
     * Resolves the real solution membership (via solutioncomponent) for the given record ids.
     * @param {string[]} ids - Record GUIDs (bots, AI models, …).
     * @returns {Promise<Object.<string, string[]>>} Map of record id → solution GUIDs.
     */
    getSolutionMemberships(ids) {
        return AgentService.getSolutionMemberships(this.retrieveMultipleRecords.bind(this), ids);
    },

    /**
     * Creates or updates an Environment Variable Value.
     * @param {string} definitionId - The ID of the variable definition.
     * @param {string|null} valueId - The ID of the existing value record, or null if creating a new one.
     * @param {string} newValue - The new value to set.
     * @param {string} definitionSchemaName - Schema name of the definition
     * @returns {Promise<object>}
     */
    setEnvironmentVariableValue(definitionId, valueId, newValue, definitionSchemaName) {
        return EnvironmentVariableService.setEnvironmentVariableValue(
            this.updateRecord.bind(this),
            _webApiFetch,
            definitionId,
            valueId,
            newValue,
            definitionSchemaName
        );
    },

    /**
     * Updates the DEFAULT (definition-level) value of an environment variable.
     * @param {string} definitionId
     * @param {string} newDefault
     * @returns {Promise<object>}
     */
    setEnvironmentVariableDefault(definitionId, newDefault) {
        return EnvironmentVariableService.setEnvironmentVariableDefault(
            this.updateRecord.bind(this),
            definitionId,
            newDefault
        );
    },

    /**
     * Creates a new Environment Variable (definition) and optional current value (value row).
     * @param {{displayName:string, schemaName:string, type:'String'|'Number'|'Boolean'|'Json', defaultValue?:string, currentValue?:string}} input
     * @returns {Promise<{definitionId:string, valueId?:string}>}
     */
    createEnvironmentVariable(input) {
        return EnvironmentVariableService.createEnvironmentVariable(
            this.createRecord.bind(this),
            _webApiFetch,
            this.addSolutionComponent.bind(this),
            input
        );
    },

    /**
     * Fetches entity definitions, filtering them based on the impersonated user's permissions if applicable.
     * @param {boolean} [bypassCache=false] - Force a refresh instead of serving the cached definitions.
     * @returns {Promise<Array<object>>}
     */
    getEntityDefinitions(bypassCache = false) {
        return MetadataService.getEntityDefinitions(_webApiFetch, _impersonatedUserId, bypassCache);
    },

    /**
     * Fetches attribute definitions for a specific entity.
     * @param {string} entityLogicalName
     * @returns {Promise<Array<object>>}
     */
    getAttributeDefinitions(entityLogicalName) {
        return MetadataService.getAttributeDefinitions(_webApiFetch, entityLogicalName);
    },

    /**
     * Gets entity set name from logical name.
     * @param {string} logicalName
     * @returns {string|null}
     */
    getEntitySetName(logicalName) {
        return MetadataService.getEntitySetName(logicalName);
    },

    /**
     * Gets entity by set name.
     * @param {string} entitySetName
     * @returns {Promise<{LogicalName:string, EntitySetName:string}|null>}
     */
    getEntityBySetName(entitySetName) {
        return MetadataService.getEntityBySetName(_webApiFetch, _impersonatedUserId, entitySetName);
    },

    /**
     * Gets entity by logical name or set name.
     * @param {string} nameOrSet
     * @returns {Promise<{LogicalName:string, EntitySetName:string}|null>}
     */
    getEntityByAny(nameOrSet) {
        return MetadataService.getEntityByAny(_webApiFetch, _impersonatedUserId, nameOrSet);
    },

    /**
     * Gets full entity definition including PrimaryNameAttribute.
     * @async
     * @param {string} entityLogicalName - Entity logical name
     * @returns {Promise<Object|null>} Full entity definition object
     */
    getEntityDefinition(entityLogicalName) {
        return MetadataService.getEntityDefinition(_webApiFetch, _impersonatedUserId, entityLogicalName);
    },

    /**
     * Returns a compact attribute map for quick type inference.
     * @param {string} entityLogicalName
     * @returns {Promise<Map<string, {type:string, targets?:string[]}>>}
     */
    getAttributeMap(entityLogicalName) {
        return MetadataService.getAttributeMap(_webApiFetch, entityLogicalName);
    },

    /**
     * Returns a map of lookup attribute names to their navigation property names.
     * Used for correctly formatting @odata.bind fields in create/update requests.
     * @async
     * @param {string} entityLogicalName - Entity logical name
     * @returns {Promise<Map<string, string>>} Map of attributeLogicalName → navigationPropertyName
     */
    getNavigationPropertyMap(entityLogicalName) {
        return MetadataService.getNavigationPropertyMap(_webApiFetch, entityLogicalName);
    },

    /**
     * Get optionset options for a picklist attribute.
     * @async
     * @param {string} entityLogicalName - Entity logical name
     * @param {string} attributeLogicalName - Attribute logical name
     * @returns {Promise<Array<{value: number, label: string}>>}
     */
    getPicklistOptions(entityLogicalName, attributeLogicalName) {
        return MetadataService.getPicklistOptions(_webApiFetch, entityLogicalName, attributeLogicalName);
    },

    /**
     * Get boolean options (true/false labels) for a boolean attribute.
     * @async
     * @param {string} entityLogicalName - Entity logical name
     * @param {string} attributeLogicalName - Attribute logical name
     * @returns {Promise<{trueLabel: string, falseLabel: string}>}
     */
    getBooleanOptions(entityLogicalName, attributeLogicalName) {
        return MetadataService.getBooleanOptions(_webApiFetch, entityLogicalName, attributeLogicalName);
    },

    /**
     * Get type-specific metadata for a single attribute (options, limits, ranges).
     * @async
     * @param {string} entityLogicalName - Entity logical name
     * @param {string} attributeLogicalName - Attribute logical name
     * @param {string} attributeTypeName - The attribute's `AttributeTypeName.Value`
     * @returns {Promise<object|null>}
     */
    getAttributeDetail(entityLogicalName, attributeLogicalName, attributeTypeName) {
        return MetadataService.getAttributeDetail(_webApiFetch, entityLogicalName, attributeLogicalName, attributeTypeName);
    },

    // --- Standard Web API Methods ---
    /**
     * Retrieve multiple records.
     * @param {string} entity
     * @param {string} options
     * @param {HeadersInit} [customHeaders={}]
     * @returns {Promise<{entities:any[], nextLink?:string}>}
     */
    retrieveMultipleRecords(entity, options, customHeaders = {}) {
        return WebApiService.retrieveMultipleRecords(_webApiFetch, entity, options, customHeaders);
    },

    /**
     * Retrieve multiple records as the signed-in user, ignoring any active impersonation.
     * Use this only for the tool's own bookkeeping — picking who to impersonate next, or resolving
     * an impersonated user's name — never for data the caller is asking to see through the
     * impersonated user's eyes.
     * @param {string} entity
     * @param {string} options
     * @returns {Promise<{entities:any[], nextLink?:string}>}
     */
    retrieveMultipleRecordsAsSelf(entity, options) {
        return WebApiService.retrieveMultipleRecords(_webApiFetchAsSelf, entity, options, {});
    },

    /**
     * Fetch the next page of records using a nextLink URL.
     * Impersonated like every other read — otherwise page 1 and page 2 of the same result set would
     * come back as two different users.
     * @async
     * @param {string} nextLinkUrl - Full OData nextLink URL
     * @returns {Promise<{entities:any[], nextLink?:string}>}
     */
    async fetchNextLink(nextLinkUrl) {
        const json = await WebApiService.fetchAbsolute(nextLinkUrl, _impersonatedUserId);
        return {
            entities: json.value || [],
            nextLink: json['@odata.nextLink']
        };
    },

    /**
     * Retrieve a single record.
     * @param {string} entity
     * @param {string} id
     * @param {string} [options]
     * @returns {Promise<object>}
     */
    retrieveRecord(entity, id, options = '') {
        return WebApiService.retrieveRecord(_webApiFetch, entity, id, options);
    },

    /**
     * Create a record.
     * @param {string} entity
     * @param {object} data
     * @param {HeadersInit} [customHeaders={}] - Custom headers (e.g. MSCRM.SolutionUniqueName)
     * @returns {Promise<object>} `{ id }` when available or response JSON
     */
    createRecord(entity, data, customHeaders = {}) {
        return WebApiService.createRecord(_webApiFetch, entity, data, customHeaders);
    },

    /**
     * Update (PATCH) a record.
     * @param {string} entity
     * @param {string} id
     * @param {object} data
     * @returns {Promise<object>}
     */
    updateRecord(entity, id, data) {
        return WebApiService.updateRecord(_webApiFetch, entity, id, data);
    },

    /**
     * Update (PATCH) a record as the signed-in user, ignoring any active impersonation.
     * Use this only for the tool's own settings — changing how the environment behaves for everyone
     * (e.g. the plug-in trace logging level) is an act of the person at the keyboard, not something to
     * attribute to the user they happen to be viewing data as.
     * @param {string} entity
     * @param {string} id
     * @param {object} data
     * @returns {Promise<object>}
     */
    updateRecordAsSelf(entity, id, data) {
        return WebApiService.updateRecord(_webApiFetchAsSelf, entity, id, data);
    },

    /**
     * Delete a record.
     * @param {string} entity
     * @param {string} id
     * @returns {Promise<object>}
     */
    deleteRecord(entity, id) {
        return WebApiService.deleteRecord(_webApiFetch, entity, id);
    },

    /**
     * Execute a batch of operations using OData $batch endpoint.
     * Bundles multiple PATCH/POST/DELETE into a single HTTP request for maximum performance.
     * Dataverse supports up to 1000 operations per batch.
     * @param {Array<{method: 'PATCH'|'POST'|'DELETE', entitySet: string, id?: string, data?: object}>} operations - Array of operations
     * @returns {Promise<{successCount: number, failCount: number, errors: Array<{index: number, error: string}>}>}
     */
    executeBatch(operations) {
        return WebApiService.executeBatch(operations, _impersonatedUserId);
    },

    /**
     * Execute FetchXML and return `{ entities }`.
     * @param {string} entityName
     * @param {string} fetchXml
     * @param {HeadersInit} [customHeaders={}]
     * @returns {Promise<{entities:any[]}>}}
     */
    executeFetchXml(entityName, fetchXml, customHeaders = {}) {
        return WebApiService.executeFetchXml(_webApiFetch, entityName, fetchXml, customHeaders);
    },

    /**
     * Clears all internal data and metadata caches.
     * @param {string|null} [key=null]
     * @param {boolean} [preserveEntityNames=false] - When true, preserves entity set name mappings
     */
    clearCache(key = null, preserveEntityNames = false) {
        if (key) {
            _cache.delete(key);
        } else {
            _cache.clear();
            MetadataService.clearCache(null, preserveEntityNames);
        }
    },

    /**
     * Fetches Environment Variable definitions and values.
     * @param {boolean} [bypassCache=false]
     * @returns {Promise<EnvironmentVariable[]>}
     */
    getEnvironmentVariables(_bypassCache = false) {
        return EnvironmentVariableService.getEnvironmentVariables(this.retrieveMultipleRecords.bind(this));
    },

    /**
     * Gets the complete UI hierarchy (Tabs > Sections > Controls) from the current form context.
     * @param {boolean} [bypassCache=false]
     * @returns {Array<object>}
     */
    getFormHierarchy(bypassCache = false) {
        return FormInspectionService.getFormHierarchy(PowerAppsApiService, bypassCache);
    },

    /**
     * Gets a detailed list of all columns present on the current form.
     * @param {boolean} [bypassCache=false]
     * @returns {Promise<FormColumn[]>}
     */
    getFormColumns(bypassCache = false) {
        return FormInspectionService.getFormColumns(PowerAppsApiService, bypassCache);
    },

    /**
     * Gets event handlers (OnLoad, OnSave) from the current form's XML.
     * @param {boolean} [bypassCache=false]
     * @returns {Promise<object|null>}
     */
    getFormEventHandlers() {
        return FormInspectionService.getFormEventHandlers(this.retrieveRecord.bind(this));
    },

    /**
     * Gets business rules for a specific entity.
     * @param {string} entityName
     * @returns {Promise<Array<object>>}
     */
    getBusinessRulesForEntity(entityName) {
        return AutomationService.getBusinessRulesForEntity(
            this.executeFetchXml.bind(this),
            entityName
        );
    },

    /**
     * Gets the event handlers from the primary main form of an entity.
     * @param {string} entityName
     * @param {boolean} [bypassCache=false]
     * @returns {Promise<object|null>}
     */
    getFormEventHandlersForEntity(entityName, _bypassCache = false) {
        return FormInspectionService.getFormEventHandlersForEntity(
            this.retrieveMultipleRecords.bind(this),
            this.retrieveRecord.bind(this),
            entityName
        );
    },

    /**
     * Reads the source of every JavaScript library the entity's forms load, for the performance
     * review's script rules.
     * @param {string} entityName - The table's logical name
     * @returns {Promise<{scripts: Array<{name: string, source: string}>, skipped: string[]}>}
     */
    getFormScriptSources(entityName) {
        return FormInspectionService.getFormScriptSources(
            this.retrieveMultipleRecords.bind(this),
            this.retrieveRecord.bind(this),
            entityName
        );
    },

    /**
     * Gets a web resource by its name.
     * @param {string} webResourceName - The name of the web resource (e.g., 'new_/scripts/account.js')
     * @returns {Promise<{id: string, name: string, content: string, webresourcetype: number}|null>} Web resource data or null
     */
    getWebResourceByName(webResourceName) {
        return FormInspectionService.getWebResourceByName(
            this.retrieveMultipleRecords.bind(this),
            webResourceName
        );
    },

    /**
     * Updates a web resource's content.
     * @param {string} webResourceId - The GUID of the web resource
     * @param {string} content - The new content (plain text)
     * @returns {Promise<void>}
     */
    updateWebResourceContent(webResourceId, content) {
        return FormInspectionService.updateWebResourceContent(
            this.updateRecord.bind(this),
            webResourceId,
            content
        );
    },

    /**
     * Publishes a web resource.
     * @param {string} webResourceId - The GUID of the web resource
     * @returns {Promise<void>}
     */
    publishWebResource(webResourceId) {
        return FormInspectionService.publishWebResource(
            _webApiFetch,
            webResourceId
        );
    },

    /**
     * Retrieves all columns for the current record by merging form attributes with a full Web API retrieve.
     * @param {boolean} [bypassCache=false]
     * @returns {Promise<FormColumn[]>}
     */
    getAllRecordColumns(_bypassCache = false) {
        return FormInspectionService.getAllRecordColumns(
            this.retrieveRecord.bind(this),
            this.getFormColumns.bind(this),
            isOdataProperty,
            () => MetadataService.loadEntityMetadata(_webApiFetch, _impersonatedUserId),
            this.getEntitySetName.bind(this),
            (entityLogicalName, bypassCache) => MetadataService.getAttributeDefinitions(_webApiFetch, entityLogicalName, bypassCache)
        );
    },

    /**
     * Gets performance metrics for the current form load.
     * @param {boolean} [bypassCache=false]
     * @returns {object}
     */
    getPerformanceDetails(bypassCache = false) {
        return FormInspectionService.getPerformanceDetails(PowerAppsApiService, bypassCache);
    },

    /**
     * Extracts client information from global context.
     * @param {object} gc - Global context
     * @returns {object} Client information
     * @private
     */
    _getClientInfo(gc) {
        return {
            type: gc.client.getClient(),
            formFactor: ['Unknown', 'Desktop', 'Tablet', 'Phone'][gc.client.getFormFactor()],
            isOffline: gc.client.isOffline(),
            appUrl: gc.getClientUrl()
        };
    },

    /**
     * Extracts organization information from global context.
     * @param {object} gc - Global context
     * @returns {object} Organization information
     * @private
     */
    _getOrganizationInfo(gc) {
        return {
            name: gc.organizationSettings.uniqueName,
            id: gc.organizationSettings.organizationId,
            version: gc.getVersion(),
            isAutoSave: gc.organizationSettings.isAutoSaveEnabled
        };
    },

    /**
     * Extracts session information from global context.
     * @param {object} gc - Global context
     * @returns {object} Session information
     * @private
     */
    _getSessionInfo(gc) {
        const appProps = gc.getCurrentAppProperties?.();
        return {
            timestamp: new Date().toISOString(),
            sessionId: gc.client.getSessionId?.() || 'N/A',
            tenantId: appProps?.tenantId || 'N/A',
            objectId: appProps?.objectId || 'N/A',
            buildName: appProps?.appModuleBuildNumber || 'N/A',
            organizationId: gc.organizationSettings.organizationId,
            uniqueName: gc.organizationSettings.uniqueName,
            instanceUrl: gc.getClientUrl(),
            environmentId: appProps?.environmentId || 'N/A',
            clusterEnvironment: appProps?.clusterEnvironment || 'N/A',
            clusterCategory: appProps?.clusterCategory || 'N/A',
            clusterGeoName: appProps?.clusterGeoName || 'N/A',
            clusterUriSuffix: appProps?.clusterUriSuffix || 'N/A'
        };
    },

    /**
     * Gets current user information from global context.
     * @param {object} gc - Global context
     * @returns {object} User information
     * @private
     */
    _getCurrentUserInfo(gc) {
        const roles = gc.userSettings.roles.getAll().map(r => ({
            id: r.id.replace(/[{}]/g, ''),
            name: r.name
        }));
        return {
            name: gc.userSettings.userName,
            id: gc.userSettings.userId.replace(/[{}]/g, ''),
            language: gc.userSettings.languageId,
            roles
        };
    },

    /**
     * Gets user information for an impersonated user.
     * @param {string} userId - User ID
     * @returns {Promise<object>} User information
     * @private
     * @async
     */
    async _getImpersonatedUserInfo(userId) {
        // Read as the signed-in user: describing who is being impersonated must not require the
        // impersonated user to hold prvReadUser. A user with no roles cannot even read their own
        // systemuser record, and reading their roles through their own eyes would report "none"
        // for a permission failure.
        const userData = await WebApiService.retrieveRecord(_webApiFetchAsSelf, 'systemusers', userId, '?$select=fullname,systemuserid');

        // Fetch direct roles (full records) and team memberships in parallel
        // We need all fields to access _parentrootroleid_value which is the consistent root role ID
        const [directRolesResponse, teamsResponse] = await Promise.all([
            _webApiFetchAsSelf('GET', `systemusers(${userId})/systemuserroles_association`),
            _webApiFetchAsSelf('GET', `systemusers(${userId})/teammembership_association?$select=teamid`)
        ]);

        // Use _parentrootroleid_value (root role ID) if available, otherwise use roleid
        const directRoles = directRolesResponse.value?.map(r => ({
            id: r._parentrootroleid_value || r.roleid,
            name: r.name
        })) || [];
        const teamIds = teamsResponse.value?.map(t => t.teamid) || [];

        let teamRoles = [];
        if (teamIds.length > 0) {
            const teamRoleResults = await Promise.all(
                teamIds.map(teamId => _webApiFetchAsSelf('GET', `teams(${teamId})/teamroles_association`))
            );
            teamRoles = teamRoleResults.flatMap(result =>
                result.value?.map(r => ({
                    id: r._parentrootroleid_value || r.roleid,
                    name: r.name
                })) || []
            );
        }

        // Deduplicate and sort roles
        const uniqueRoles = Array.from(
            new Map([...directRoles, ...teamRoles].map(r => [r.id, r])).values()
        ).sort((a, b) => a.name.localeCompare(b.name));

        return {
            name: userData.fullname,
            id: userData.systemuserid,
            language: 'N/A (Impersonated)',
            roles: uniqueRoles
        };
    },

    /**
     * Gets an enhanced user/client/org context object.
     * @param {boolean} [bypassCache=false]
     * @returns {object}
     */
    getEnhancedUserContext: (bypassCache = false) => _fetch('userContext', async () => {
        const gc = PowerAppsApiService.getGlobalContext();
        const userInfo = _impersonatedUserId
            ? await DataService._getImpersonatedUserInfo(_impersonatedUserId)
            : DataService._getCurrentUserInfo(gc);

        return {
            user: userInfo,
            client: DataService._getClientInfo(gc),
            organization: DataService._getOrganizationInfo(gc),
            session: DataService._getSessionInfo(gc)
        };
    }, bypassCache),

    /**
     * Fetch a page of Plugin Trace Logs (server-side pagination aware).
     * @param {string} options
     * @param {number} pageSize
     * @returns {Promise<{entities:any[], nextLink?:string}>}
     */
    getPluginTraceLogs(options, pageSize) {
        return WebApiService.getPluginTraceLogs(options, pageSize, _impersonatedUserId);
    }
};
