/**
 * @file Copilot Studio agent, transcript, and AI Builder model operations service.
 * @module services/AgentService
 * @description Handles fetching, inspecting, and managing the AI artifacts that Copilot Studio
 * and AI Builder persist in Dataverse:
 * - Copilot Studio agents (the `bot` table) and their components (the `botcomponent` table:
 *   topics, instructions, knowledge sources, tools).
 * - Agent conversation transcripts (the `conversationtranscript` table) for run/session debugging.
 * - AI Builder prompts and models (the `msdyn_aimodel` table).
 *
 * All reads/writes go through the same session-based Web API used elsewhere in the toolkit,
 * so no external endpoints, tokens, or manifest changes are required.
 *
 * Verified against the official Dataverse entity references (bot, botcomponent,
 * conversationtranscript, msdyn_aimodel) — see the "Microsoft Docs First" project rule.
 */

/** Prefer header that asks Dataverse to include formatted (display) values for choices/lookups/dates. */
const FORMATTED_VALUE_HEADER = {
    Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
};

/** Suffix used to read a formatted (display) value annotation from a Web API record. */
const FV = '@OData.Community.Display.V1.FormattedValue';

/**
 * Definition columns on `msdyn_aiconfiguration` that are safe to edit. The remaining payload
 * columns (`msdyn_modelperformance`, `msdyn_modelrundataspecification`) are produced by the
 * training service — editing them corrupts the model without changing behaviour.
 * @type {Set<string>}
 */
const EDITABLE_CONFIG_COLUMNS = new Set([
    'msdyn_customconfiguration',
    'msdyn_runconfiguration',
    'msdyn_databinding'
]);

/**
 * Payload columns read from `msdyn_aiconfiguration`, in display order, with their section labels.
 * @type {Array<{column: string, label: string}>}
 */
const CONFIG_PAYLOAD_COLUMNS = [
    { column: 'msdyn_customconfiguration', label: 'Configuration' },
    { column: 'msdyn_runconfiguration', label: 'Run configuration' },
    { column: 'msdyn_databinding', label: 'Data binding' },
    { column: 'msdyn_modelrundataspecification', label: 'Input / output schema' },
    { column: 'msdyn_modelperformance', label: 'Model performance' },
    { column: 'msdyn_schedulingoptions', label: 'Schedule' }
];

/**
 * Invariant `msdyn_aitemplate.msdyn_uniquename` values whose models are GPT prompts rather than
 * trained/prebuilt models. The maker portal splits its own UI on exactly this distinction (its
 * models list filters `msdyn_TemplateId/msdyn_uniquename ne 'GptPowerPrompt'`), and prompts open
 * under a different, solution-scoped editor route.
 * @type {Set<string>}
 */
const PROMPT_TEMPLATE_NAMES = new Set([
    'GptPowerPrompt',
    'DataversePromptColumn',
    'IntelligentApprovalPrompt',
    'GptPromptEngineering'
]);

/** Base64 prefix of a gzip stream (`1f 8b 08`) — AI Builder compresses some payload columns. */
const GZIP_BASE64_PREFIX = 'H4sI';

/**
 * Fallback labels for `msdyn_aiconfiguration.statuscode`, used when the formatted-value
 * annotation is absent. Verified from the AI Configuration entity reference.
 * @type {Object.<number, string>}
 */
const AI_CONFIG_STATUS_LABELS = {
    0: 'Draft', 1: 'Training', 2: 'Cancelling', 3: 'Publishing', 4: 'Unpublishing',
    5: 'Deleting', 6: 'Trained', 7: 'Published', 8: 'Scheduled', 9: 'Train failed',
    10: 'Publish failed', 11: 'Unpublish failed', 12: 'Cancel failed', 13: 'Delete failed',
    14: 'Unsuccessful training'
};

/** `msdyn_aiconfiguration.statecode` value meaning the iteration failed. */
const AI_CONFIG_STATE_FAILED = 3;

/**
 * `msdyn_aiconfiguration.statecode` value meaning the iteration finished training (Done). A Done
 * configuration can't be trained again in place — the `Train` action rejects it — so it must be
 * retrained by cloning a new training iteration (see {@link retrainAiConfiguration}).
 */
export const AI_CONFIG_STATE_DONE = 2;

/** `msdyn_aiconfiguration.statuscode` reached once a publish lands. */
export const AI_CONFIG_STATUS_PUBLISHED = 7;

/**
 * The `Source` envelope AI Builder sends with `AIModelPublish`. Dataverse records it against the
 * run for consumption reporting, so it is sent verbatim.
 */
const AI_PUBLISH_SOURCE = '{ "consumptionSource": "Api", "partnerSource": "AIBuilder", "consumptionSourceVersion": "GptApiClient"}';

/** The `source` envelope sent with a QuickTest run. */
const AI_QUICKTEST_SOURCE = '{ "consumptionSource": "Api", "partnerSource": "MicrosoftCopilotStudio", "consumptionSourceVersion": "GptApiClient"}';

/** The default scheduled-prediction options a first publish sets (runs the model as a prediction). */
const AI_PREDICTION_SCHEDULE = '{"schemaVersion":2,"prediction":{"recurrence":{"frequency":"Minutely","interval":1}}}';

/** `msdyn_aiconfiguration.msdyn_type` — a training configuration is the one that can be trained. */
export const AI_CONFIG_TYPE_TRAINING = 190690000;
/** `msdyn_aiconfiguration.msdyn_type` — a run configuration is the one that gets published. */
export const AI_CONFIG_TYPE_RUN = 190690001;
/** `msdyn_aiconfiguration.statuscode` while a training run is in flight. */
export const AI_CONFIG_STATUS_TRAINING = 1;

/** Dataverse's open-type marker, required on every object inside a QuickTest request. */
const EXPANDO = '#Microsoft.Dynamics.CRM.expando';

/**
 * The AI Builder Test hub's **grader** configuration. This is a hardcoded system prompt (identical
 * across environments — it is a literal constant in the maker portal's own source) that scores a
 * response's semantic similarity and quality. It is invoked with a `QuickTest` whose request carries
 * `{ExpectedOutput, PromptText, TestCaseInput, TestCaseResponse}` and returns the sub-scores as JSON.
 */
const AI_EVAL_GRADER_CONFIG_ID = '73244ddc-555f-4d8f-83b4-703cad48dbab';
/** Fallback evaluation configuration used when a prompt has none of its own (hardcoded id). */
const AI_EVAL_DEFAULT_CONFIG_ID = 'd80fd3a0-030b-476b-b38b-37e692de14d6';
const AI_EVAL_DEFAULT_CONFIG_NAME = 'Default Prompt Evaluation Configuration';
/** The default evaluation criteria the portal seeds a new/default configuration with. */
const AI_EVAL_DEFAULT_CRITERIA = JSON.stringify({
    version: '0.0',
    configurationType: 'GptPromptPredefinedEvaluationCriteria',
    passingScore: 70,
    value: {
        expectedResponseCheck: { isApplicable: false },
        responseQuality: { isApplicable: true },
        jsonCorrectness: { isApplicable: false }
    }
});
/** Default passing score when a criteria payload omits one. */
const AI_EVAL_DEFAULT_PASSING_SCORE = 70;
/** Shared status reasons for msdyn_aitestrun / msdyn_aitestrunbatch / msdyn_aievaluationrun. */
const AI_TEST_STATUS_INPROGRESS = 1;
const AI_TEST_STATUS_SUCCEEDED = 4;
const AI_TEST_STATUS_FAILED = 5;

/**
 * Labels for the `botcomponent.componenttype` choice. Used as a fallback when the
 * formatted-value annotation is not returned. Verified from the botcomponent entity reference.
 * @type {Object.<number, string>}
 */
const COMPONENT_TYPE_LABELS = {
    0: 'Topic',
    1: 'Skill',
    2: 'Bot variable',
    3: 'Bot entity',
    4: 'Dialog',
    5: 'Trigger',
    6: 'Language understanding',
    7: 'Language generation',
    8: 'Dialog schema',
    9: 'Topic (V2)',
    10: 'Bot translations (V2)',
    11: 'Bot entity (V2)',
    12: 'Bot variable (V2)',
    13: 'Skill (V2)',
    14: 'Bot File Attachment',
    15: 'Custom GPT',
    16: 'Knowledge Source',
    17: 'External Trigger',
    18: 'Copilot Settings',
    19: 'Test Case'
};

/** componenttype value for the "Custom GPT" component, which holds the agent's instructions. */
const COMPONENT_TYPE_CUSTOM_GPT = 15;

/**
 * Classifies an agent as a modern generative "agent" vs a classic topic-based bot, from the bot's
 * `template`. Copilot Studio's own list uses this: the declarative agent framework (which GitHub
 * Copilot also builds on) provisions from a `cliagent-*` template, while classic bots use `empty-*`
 * and other topic templates. Same signal as Copilot Studio's "Powered by" column.
 * @param {string} template - The bot `template` value (e.g. "cliagent-1.0.0", "empty-1.0.0").
 * @returns {{ modern: boolean, key: 'modern'|'classic' }}
 */
export function classifyAgentKind(template) {
    const modern = /^cliagent\b/i.test(String(template || '').trim());
    return { modern, key: modern ? 'modern' : 'classic' };
}

/**
 * @typedef {object} Agent
 * @property {string} id - The bot GUID (botid).
 * @property {string} name - Display name of the agent.
 * @property {string} schemaName - Unique schema name.
 * @property {number} statecode - 0=Active, 1=Inactive.
 * @property {string} stateLabel - Formatted status label (Active/Inactive).
 * @property {string} statusLabel - Formatted status-reason label (Provisioned, etc.).
 * @property {boolean} isManaged - Whether the agent is part of a managed solution.
 * @property {string} owner - Owner display name.
 * @property {string} language - Formatted authoring language label.
 * @property {string} authMode - Formatted authentication mode label.
 * @property {string} createdOn - Formatted creation date.
 * @property {string} modifiedOn - Formatted modification date.
 * @property {string} publishedOn - Formatted last-published date.
 * @property {string} template - The provisioning template (e.g. "cliagent-1.0.0", "empty-1.0.0").
 * @property {boolean} isModern - True for a modern generative agent; false for a classic bot.
 */

/**
 * @typedef {object} AgentComponent
 * @property {string} id - The botcomponent GUID.
 * @property {string} name - Component display name.
 * @property {string} schemaName - Component schema name.
 * @property {number} componentType - The componenttype choice value.
 * @property {string} componentTypeLabel - Human-readable component type.
 * @property {string} description - Searchable description text.
 * @property {string} content - The component content/metadata (JSON), when present.
 * @property {string} data - The component OBI data (often YAML), when present.
 * @property {boolean} isManaged - Whether the component is part of a managed solution.
 * @property {number} statecode - 0=Active, 1=Inactive.
 * @property {string} modifiedOn - Formatted last-modified date.
 * @property {string} modifiedOnRaw - ISO last-modified date (for sorting).
 * @property {string} modifiedBy - Name of the user who last modified the component.
 */

/**
 * @typedef {object} TranscriptSummary
 * @property {string} id - The conversationtranscript GUID.
 * @property {string} name - Transcript name.
 * @property {string} schemaType - Source schema type (PVA, Omni-Channel, OBI, etc.).
 * @property {string} startTime - Formatted conversation start time.
 * @property {string} createdOn - Formatted creation date.
 * @property {string} content - The conversation/session `content` JSON (loaded with the list so the
 *   row can summarize the session and render the conversation without a second fetch).
 */

/**
 * @typedef {object} AiModel
 * @property {string} id - The msdyn_aimodel GUID.
 * @property {string} name - Model/prompt display name.
 * @property {number} statecode - 0=Inactive, 1=Active.
 * @property {string} stateLabel - Formatted status label.
 * @property {boolean} isManaged - Whether the model is part of a managed solution.
 * @property {string} owner - Owner display name.
 * @property {string} template - Formatted template (model type) label.
 * @property {string} templateName - Invariant template unique name (e.g. `GptPowerPrompt`).
 * @property {string} templateId - The msdyn_aitemplate GUID (required by AIModelPublish).
 * @property {'prompt'|'prebuilt'|'custom'} kind - Model family derived from the template.
 * @property {string} kindLabel - Human-readable family label.
 * @property {string} activeConfigId - GUID of the published run configuration ('' when none).
 * @property {ModelStatus} configStatus - State of the model's latest configuration iteration.
 * @property {boolean} hasRetrain - Whether an automatic retrain workflow is attached.
 * @property {string} createdOn - Formatted creation date.
 * @property {string} modifiedOn - Formatted modification date.
 */

/**
 * @typedef {object} AiConfigSection
 * @property {string} column - The Dataverse column the text came from (and saves back to).
 * @property {string} label - Display label for the section.
 * @property {string} text - The (decompressed, non-empty) payload.
 * @property {'json'|'text'} language - Syntax hint for the code block.
 * @property {boolean} editable - Whether this column is safe to edit (definition columns only).
 * @property {boolean} compressed - True when the raw column held a gzip+base64 payload.
 */

/**
 * @typedef {object} AiConfiguration
 * @property {string} id - The msdyn_aiconfiguration GUID.
 * @property {string} name - Raw configuration name (usually `{modelId}_{timestamp}`).
 * @property {string} type - Formatted `msdyn_type` label.
 * @property {number} typeCode - 190690000=TrainingConfiguration, 190690001=RunConfiguration.
 * @property {string} version - Iteration as `major.minor` (e.g. "3.0").
 * @property {string} status - Formatted `statuscode` label (Draft/Trained/Published/TrainFailed…).
 * @property {number} statusCode - Raw `statuscode`.
 * @property {number} stateCode - Raw `statecode` (0=Draft, 1=InProgress, 2=Done, 3=Failed).
 * @property {boolean} isActive - True when this is the model's published run configuration.
 * @property {boolean} isFailed - True when `statecode` is 3 (Failed).
 * @property {AiConfigError|null} lastError - Parsed `msdyn_lasterrors`, when present.
 * @property {string} lastRunOn - Formatted last train/run date.
 * @property {AiConfigSection[]} sections - One entry per non-empty payload column.
 */

/**
 * @typedef {object} AiConfigError
 * @property {string} code - Error code (e.g. `InternalError`).
 * @property {string} message - Error message, falling back to the code when the API sends null.
 * @property {string} type - Error type (e.g. `Error`).
 * @property {string} dateTime - ISO timestamp of the failure.
 * @property {string[]} innerErrors - Flattened inner error messages.
 */

/**
 * @typedef {object} AiBuilderRun
 * @property {string} id - The msdyn_aievent GUID.
 * @property {string} output - The run's text output.
 * @property {boolean} quickTest - True for an interactive quick test, false for an automation run.
 * @property {string} dataType - The input data type (e.g. Text).
 * @property {string} processingStatus - Formatted processing-status label.
 * @property {string} status - Formatted status-reason label.
 * @property {string} processedOn - Formatted processing date.
 * @property {string} createdOn - Formatted creation date.
 * @property {string} createdOnRaw - ISO creation date (for sorting).
 * @property {number|null} consumption - Credits consumed (from the msdyn_creditconsumed column, falling back to event data).
 * @property {number|null} units - Message units consumed (from event data, when present).
 * @property {string} featureName - The metered feature name (from event data).
 * @property {string} llmModelName - The underlying LLM model (from event data).
 * @property {string} consumptionSource - Where the run was consumed (PowerApps, PowerAutomation, API, MCS).
 * @property {string} createdBy - Name of the user (or service) that ran it.
 */

/**
 * @typedef {object} TestRunBatch
 * @property {string} id - The msdyn_aitestrunbatch GUID.
 * @property {string} name - Batch (run) name.
 * @property {string} description - Batch description.
 * @property {string} statusLabel - Formatted batch-run-status label.
 * @property {'completed'|'running'|'failed'} state - Derived lifecycle state.
 * @property {number|null} accuracyScore - Batch-level aggregate accuracy (often null until computed).
 * @property {string} startedOnRaw - Raw ISO start time.
 * @property {string} completedOnRaw - Raw ISO completion time.
 * @property {string} startedOn - Formatted start time.
 * @property {string} completedOn - Formatted completion time.
 * @property {string} createdOn - Formatted creation date.
 * @property {string} createdOnRaw - Raw ISO creation date.
 * @property {string} errorMessage - Error message, if the batch failed.
 */

/**
 * @typedef {object} TestRun
 * @property {string} id - The msdyn_aitestrun GUID.
 * @property {string} testCaseId - The related msdyn_aitestcase GUID.
 * @property {string} testCaseName - The related test case name (formatted lookup value).
 * @property {string} configId - The msdyn_aiconfiguration the run used.
 * @property {string} expectedOutput - The expected output for the case.
 * @property {string} actualOutput - The model's actual output.
 * @property {number|null} accuracyScore - Per-run accuracy score (0–100).
 * @property {number|null} tokens - Tokens consumed, from the response metadata.
 * @property {string} modelName - Underlying LLM model name, from the response metadata.
 * @property {string} modelType - Model type (default/reasoning), from the response metadata.
 * @property {string} statusLabel - Formatted test-run-status label.
 * @property {'completed'|'running'|'failed'} state - Derived lifecycle state.
 * @property {string} startedOnRaw - Raw ISO start time.
 * @property {string} completedOnRaw - Raw ISO completion time.
 * @property {string} errorMessage - Error message, if the run failed.
 * @property {string} comment - Free-text reviewer comment.
 */

/**
 * @typedef {object} TestCaseInput
 * @property {string} id - The msdyn_aitestcaseinput GUID.
 * @property {string} name - Input row name.
 * @property {string} raw - Raw msdyn_inputdata JSON string.
 * @property {Array<{name: string, value: string}>} values - Parsed input variable name/value pairs.
 * @property {string} modifiedOn - Formatted modification date.
 */

/**
 * @typedef {object} EvaluationCriteria
 * @property {string} id - The msdyn_aievaluationconfiguration GUID (target of the criteria PATCH).
 * @property {number|null} passingScore - Passing score (1–100); a run passes when its score reaches it.
 * @property {{applicable: boolean, comparison: 'exact'|'similarity'}} expectedResponse - Expected-response check.
 * @property {{applicable: boolean}} responseQuality - Response-quality check.
 * @property {{applicable: boolean}} jsonCorrectness - JSON-correctness check.
 * @property {string} raw - Raw msdyn_evaluationcriteria JSON (preserved on edit for round-tripping).
 */

/**
 * @typedef {object} SearchMatch
 * @property {string} id - The botcomponent GUID.
 * @property {string} name - Component name.
 * @property {string} schemaName - Component schema name.
 * @property {number} componentType - The componenttype choice value.
 * @property {string} componentTypeLabel - Human-readable component type.
 * @property {string} parentBotId - The owning agent's bot GUID.
 * @property {string} snippet - A short context snippet (instruction match) or the description.
 */

/**
 * @typedef {object} AgentUsage
 * @property {number} sampled - Number of transcripts summarized.
 * @property {boolean} capped - True when the sample hit the cap (more sessions may exist).
 * @property {number} last7 - Sessions created in the last 7 days.
 * @property {number} last30 - Sessions created in the last 30 days.
 * @property {Array<{channel: string, count: number}>} byChannel - Per-channel session counts (desc).
 * @property {Array<{date: string, count: number}>} daily - Session counts for the last 14 days (oldest first).
 */

/**
 * @typedef {object} EvalTestCase
 * @property {string} id - The msdyn_aitestcase GUID.
 * @property {string} name - Test case name.
 * @property {string} description - Test case description.
 * @property {string} expectedOutput - The expected output payload.
 * @property {string} source - The test case source.
 * @property {string} state - Formatted test-case state label.
 * @property {string} createdOn - Formatted creation date.
 * @property {string} modifiedOn - Formatted modification date.
 */

export const AgentService = {
    // ═══════════════════════════════════════════════════════════
    // AGENTS (bot table)
    // ═══════════════════════════════════════════════════════════

    /**
     * Retrieves all Copilot Studio agents in the environment.
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @returns {Promise<Agent[]>} Array of agent objects, newest first.
     */
    async getAgents(retrieveMultipleRecords) {
        // Note: lookup/owner columns must be selected via their `_<name>_value` form in OData $select.
        const query =
            '?$select=botid,name,schemaname,statecode,statuscode,language,authenticationmode,' +
            'ismanaged,template,_ownerid_value,createdon,modifiedon,publishedon,_publishedby_value' +
            '&$orderby=modifiedon desc';

        const response = await retrieveMultipleRecords('bots', query, FORMATTED_VALUE_HEADER);
        return (response.entities || []).map(_mapAgentEntity);
    },

    /**
     * Retrieves the authoring components (topics, instructions, knowledge, tools) of an agent.
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @param {string} botId - The bot GUID.
     * @returns {Promise<AgentComponent[]>} Array of component objects, ordered by type.
     */
    async getAgentComponents(retrieveMultipleRecords, botId) {
        if (!botId) {
            return [];
        }
        const query =
            '?$select=botcomponentid,name,schemaname,componenttype,description,content,data,ismanaged,' +
            'statecode,modifiedon,_modifiedby_value' +
            `&$filter=_parentbotid_value eq ${botId}` +
            '&$orderby=componenttype asc,name asc';

        const response = await retrieveMultipleRecords('botcomponents', query, FORMATTED_VALUE_HEADER);
        return (response.entities || []).map(_mapAgentComponentEntity);
    },

    /**
     * Searches components across ALL agents in the environment for a keyword. Three passes: a fast
     * server-side `contains` on component name/description, a client-side scan of every legacy
     * agent's instruction text (the Custom GPT component body, which `contains` can't reliably
     * index), and a client-side scan of every modern agent's instructions (which live in the bot
     * `configuration`, not in any component). Each pass is independent so one failing does not hide
     * the others.
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @param {string} keyword - The search term (minimum 2 characters).
     * @returns {Promise<SearchMatch[]>} Distinct component matches across agents.
     */
    async searchAgentComponents(retrieveMultipleRecords, keyword) {
        const term = String(keyword || '').trim();
        if (term.length < 2) {
            return [];
        }
        const odataTerm = term.replace(/'/g, "''");
        const matches = new Map();

        // 1) Names + descriptions across all agents (server-side contains).
        try {
            const query =
                '?$select=botcomponentid,name,schemaname,componenttype,description,_parentbotid_value' +
                `&$filter=contains(name,'${odataTerm}') or contains(description,'${odataTerm}')&$top=200`;
            const response = await retrieveMultipleRecords('botcomponents', query, FORMATTED_VALUE_HEADER);
            (response.entities || []).forEach(c => matches.set(c.botcomponentid, _mapSearchMatch(c, '')));
        } catch {
            // contains() filter unavailable; the body scan below still runs.
        }

        // 2) Full instruction text (Custom GPT body) — client-side scan of a bounded set.
        try {
            const query =
                '?$select=botcomponentid,name,schemaname,componenttype,data,content,_parentbotid_value' +
                `&$filter=componenttype eq ${COMPONENT_TYPE_CUSTOM_GPT}&$top=500`;
            const response = await retrieveMultipleRecords('botcomponents', query, FORMATTED_VALUE_HEADER);
            const lower = term.toLowerCase();
            (response.entities || []).forEach(c => {
                if (matches.has(c.botcomponentid)) {
                    return;
                }
                const body = `${c.data || ''}\n${c.content || ''}`;
                if (body.toLowerCase().includes(lower)) {
                    matches.set(c.botcomponentid, _mapSearchMatch(c, buildSnippet(body, term)));
                }
            });
        } catch {
            // Instruction bodies unavailable in this environment.
        }

        // 3) Modern agents (template `cliagent-*`) keep their instructions in the bot
        //    `configuration` (agentSettings.instructions), not in any component — scan those too.
        try {
            const query = '?$select=botid,name,configuration&$top=200';
            const response = await retrieveMultipleRecords('bots', query);
            const lower = term.toLowerCase();
            (response.entities || []).forEach(bot => {
                const instructions = extractAgentInstructions(bot.configuration);
                if (instructions.toLowerCase().includes(lower)) {
                    matches.set(`cfg-${bot.botid}`, {
                        id: `cfg-${bot.botid}`,
                        name: bot.name || '(unnamed agent)',
                        schemaName: '',
                        componentType: null,
                        componentTypeLabel: 'Instructions',
                        parentBotId: bot.botid,
                        snippet: buildSnippet(instructions, term)
                    });
                }
            });
        } catch {
            // Bot configurations unavailable in this environment.
        }

        return [...matches.values()];
    },

    /**
     * Activates or deactivates an agent component (PATCH its statecode).
     * @param {Function} updateRecord - Bound DataService.updateRecord.
     * @param {string} componentId - The botcomponent GUID.
     * @param {boolean} activate - True to activate (statecode 0), false to deactivate (statecode 1).
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async setComponentState(updateRecord, componentId, activate) {
        return updateRecord('botcomponents', componentId, { statecode: activate ? 0 : 1 });
    },

    /**
     * Updates a single field (`data` or `content`) of an agent component.
     * @param {Function} updateRecord - Bound DataService.updateRecord.
     * @param {string} componentId - The botcomponent GUID.
     * @param {'data'|'content'} field - The field to update.
     * @param {string} value - The new value.
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async updateAgentComponent(updateRecord, componentId, field, value) {
        return updateRecord('botcomponents', componentId, { [field]: value });
    },

    /**
     * Updates an agent's configuration JSON (the `configuration` column).
     * @param {Function} updateRecord - Bound DataService.updateRecord.
     * @param {string} botId - The bot GUID.
     * @param {string} configuration - The new configuration string.
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async updateAgentConfiguration(updateRecord, botId, configuration) {
        return updateRecord('bots', botId, { configuration });
    },

    /**
     * Publishes an agent so authoring changes take effect (bound PvaPublish action, no parameters).
     *
     * Queues the publish and returns a body that carries no success signal — verified against a live
     * org, a successful publish returns the same empty `{PublishedBotContentId: '',
     * PublishBotJobResponse: null}` as a no-op. Do not branch on it; poll
     * {@link AgentService.getAgentPublishState} instead.
     * @param {Function} webApiFetch - Bound DataService web API fetch ('POST', path, query, body).
     * @param {string} botId - The bot GUID.
     * @returns {Promise<object>} The raw PvaPublishResponse (informational only).
     */
    // eslint-disable-next-line require-await
    async publishAgent(webApiFetch, botId) {
        return webApiFetch('POST', `bots(${botId})/Microsoft.Dynamics.CRM.PvaPublish`, '', {});
    },

    /**
     * Reads an agent's `publishedon` — the authoritative signal that a publish landed, since
     * PvaPublish completes asynchronously. Returns both the raw ISO value (for comparisons) and the
     * formatted value (for display), matching the shape used by the agent list.
     * @param {Function} webApiFetch - Bound DataService web API fetch ('GET', path, query, body, headers).
     * @param {string} botId - The bot GUID.
     * @returns {Promise<{publishedOnRaw: string, publishedOn: string}>} Empty strings when never published.
     */
    async getAgentPublishState(webApiFetch, botId) {
        if (!botId) {
            return { publishedOnRaw: '', publishedOn: '' };
        }
        const record = await webApiFetch(
            'GET', `bots(${botId})`, '?$select=publishedon', null, FORMATTED_VALUE_HEADER
        );
        return {
            publishedOnRaw: record?.publishedon || '',
            publishedOn: record?.[`publishedon${FV}`] || record?.publishedon || ''
        };
    },

    /**
     * Resolves the resources an agent's components link to (the agent's "tools"): cloud/agent flows,
     * AI models, and plugin operations. Derived from the botcomponent many-to-many relationships.
     * Each link type is queried independently so one failure does not hide the others.
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @param {string} botId - The bot GUID.
     * @returns {Promise<{flows: Array<{id: string, name: string, statecode: number}>, models: Array<{id: string, name: string}>, tools: Array<{id: string, name: string}>}>}
     */
    async getAgentLinks(retrieveMultipleRecords, botId) {
        const result = { flows: [], models: [], tools: [] };
        if (!botId) {
            return result;
        }

        // Flows + AI models (safe, well-known columns).
        try {
            const query =
                '?$select=botcomponentid' +
                '&$expand=botcomponent_workflow($select=workflowid,name,statecode),' +
                'botcomponent_msdyn_aimodel($select=msdyn_aimodelid,msdyn_name)' +
                `&$filter=_parentbotid_value eq ${botId}`;
            const response = await retrieveMultipleRecords('botcomponents', query, FORMATTED_VALUE_HEADER);
            const flows = new Map();
            const models = new Map();
            (response.entities || []).forEach(c => {
                (c.botcomponent_workflow || []).forEach(w => flows.set(w.workflowid, {
                    id: w.workflowid, name: w.name || '(unnamed flow)', statecode: w.statecode
                }));
                (c.botcomponent_msdyn_aimodel || []).forEach(m => models.set(m.msdyn_aimodelid, {
                    id: m.msdyn_aimodelid, name: m.msdyn_name || '(unnamed model)'
                }));
            });
            result.flows = [...flows.values()];
            result.models = [...models.values()];
        } catch {
            // Linked flows/models unavailable in this environment.
        }

        // Plugin operations / tools (column names vary by version; avoid $select).
        try {
            const query =
                '?$select=botcomponentid&$expand=botcomponent_aipluginoperation' +
                `&$filter=_parentbotid_value eq ${botId}`;
            const response = await retrieveMultipleRecords('botcomponents', query, FORMATTED_VALUE_HEADER);
            const tools = new Map();
            (response.entities || []).forEach(c => {
                (c.botcomponent_aipluginoperation || []).forEach(p => {
                    const id = p.aipluginoperationid || p.msdyn_aipluginoperationid;
                    if (id) {
                        tools.set(id, { id, name: p.name || p.msdyn_name || '(tool)' });
                    }
                });
            });
            result.tools = [...tools.values()];
        } catch {
            // Linked plugin tools unavailable in this environment.
        }

        return result;
    },

    /**
     * Retrieves the Copilot Studio agent flows ("Workflows") in the environment. These are modern
     * workflows with modernflowtype = 1 (CopilotStudioFlow) — the standalone flows shown under
     * "Workflows" in Copilot Studio and opened at /agent-flows/{id}. Unlike {@link AgentService.getAgentLinks},
     * this lists every agent flow directly rather than only the ones a specific bot links as a tool.
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @returns {Promise<Array<AgentFlow>>} Agent flows ordered by most recently modified.
     */
    async getAgentFlows(retrieveMultipleRecords) {
        const query =
            '?$select=workflowid,name,description,modifiedon,createdon,statecode,statuscode,category,type,modernflowtype,ismanaged,_ownerid_value,_createdby_value' +
            '&$filter=category eq 5 and type eq 1 and modernflowtype eq 1 and (statecode eq 0 or statecode eq 1)' +
            '&$orderby=modifiedon desc';
        const response = await retrieveMultipleRecords('workflows', query, FORMATTED_VALUE_HEADER);
        return (response.entities || []).map(_mapAgentFlowEntity);
    },

    /**
     * Retrieves the raw configuration JSON of an agent (the `configuration` column).
     * @param {Function} retrieveRecord - Bound DataService.retrieveRecord.
     * @param {string} botId - The bot GUID.
     * @returns {Promise<string|null>} The configuration JSON string, or null.
     */
    async getAgentConfiguration(retrieveRecord, botId) {
        if (!botId) {
            return null;
        }
        const record = await retrieveRecord('bots', botId, '?$select=configuration');
        return record?.configuration || null;
    },

    /**
     * Activates or deactivates an agent by updating its state.
     * Only `statecode` is set (0=Active, 1=Inactive); Dataverse resolves the matching default
     * `statuscode`. This avoids hard-coding a status-reason that could violate the bot table's
     * allowed state transitions.
     * @param {Function} updateRecord - Bound DataService.updateRecord.
     * @param {string} botId - The bot GUID.
     * @param {boolean} activate - True to activate (statecode 0), false to deactivate (statecode 1).
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async setAgentState(updateRecord, botId, activate) {
        return updateRecord('bots', botId, { statecode: activate ? 0 : 1 });
    },

    /**
     * Deletes an agent via the PvaDeleteBot bound action — the same call Copilot Studio makes.
     * A raw `DELETE /bots(id)` fails once an agent has authoring components (Dataverse returns
     * `0x8004f01f` "referenced by N components"); PvaDeleteBot deprovisions the bot and cascades
     * its components. The `deprovisionbotondelete` tag matches the portal's own request.
     * @param {Function} webApiFetch - Bound DataService web API fetch ('POST', path, query, body).
     * @param {string} botId - The bot GUID.
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async deleteAgent(webApiFetch, botId) {
        return webApiFetch('POST', `bots(${botId})/Microsoft.Dynamics.CRM.PvaDeleteBot`, '?tag=deprovisionbotondelete', {});
    },

    /**
     * Deletes an AI Builder model or prompt. Unlike an agent, a model is removed with a plain
     * `DELETE /msdyn_aimodels(id)` — its configurations cascade with it.
     * @param {Function} deleteRecord - Bound DataService.deleteRecord.
     * @param {string} modelId - The msdyn_aimodel GUID.
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async deleteAiModel(deleteRecord, modelId) {
        return deleteRecord('msdyn_aimodel', modelId);
    },

    /**
     * Deletes a single test case with a plain `DELETE /msdyn_aitestcases(id)`. Its inputs cascade.
     * @param {Function} deleteRecord - Bound DataService.deleteRecord.
     * @param {string} testCaseId - The msdyn_aitestcase GUID.
     * @returns {Promise<object>}
     * @throws {Error} When no id is given.
     */
    // eslint-disable-next-line require-await
    async deleteTestCase(deleteRecord, testCaseId) {
        if (!testCaseId) {
            throw new Error('A test case id is required.');
        }
        return deleteRecord('msdyn_aitestcase', testCaseId);
    },

    /**
     * Updates a test case's expected output — the maker portal's editable "Expected response". PATCHes
     * `msdyn_expectedoutput` on the `msdyn_aitestcase` record.
     * @param {Function} updateRecord - Bound DataService.updateRecord.
     * @param {string} testCaseId - The msdyn_aitestcase GUID.
     * @param {string} expectedOutput - The new expected output.
     * @returns {Promise<object>}
     * @throws {Error} When no test case id is given.
     */
    // eslint-disable-next-line require-await
    async updateTestCaseExpectedOutput(updateRecord, testCaseId, expectedOutput) {
        if (!testCaseId) {
            throw new Error('A test case id is required.');
        }
        return updateRecord('msdyn_aitestcases', testCaseId, { msdyn_expectedoutput: expectedOutput ?? '' });
    },

    /**
     * Saves a prompt's evaluation criteria (passing score + which prebuilt checks apply) by PATCHing
     * `msdyn_evaluationcriteria` on its `msdyn_aievaluationconfiguration`. The existing raw JSON is the
     * base, so unknown fields survive the edit.
     * @param {Function} updateRecord - Bound DataService.updateRecord.
     * @param {string} configId - The msdyn_aievaluationconfiguration GUID.
     * @param {string} raw - The current raw criteria JSON (preserved).
     * @param {object} values - Edited values (passingScore, expectedApplicable, comparisonType, responseQualityApplicable, jsonApplicable).
     * @returns {Promise<object>}
     * @throws {Error} When no configuration id is given.
     */
    // eslint-disable-next-line require-await
    async updateEvaluationCriteria(updateRecord, configId, raw, values) {
        if (!configId) {
            throw new Error('An evaluation configuration id is required.');
        }
        const payload = buildEvaluationCriteriaPayload(raw, values);
        return updateRecord('msdyn_aievaluationconfigurations', configId, { msdyn_evaluationcriteria: payload });
    },

    // ═══════════════════════════════════════════════════════════
    // TRANSCRIPTS (conversationtranscript table)
    // ═══════════════════════════════════════════════════════════

    /**
     * Retrieves recent conversation transcripts for an agent (newest first).
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @param {string} botId - The bot GUID.
     * @param {number} [top=50] - Maximum number of transcripts to return.
     * @returns {Promise<TranscriptSummary[]>} Array of transcript summaries.
     */
    async getTranscripts(retrieveMultipleRecords, botId, top = 50) {
        if (!botId) {
            return [];
        }
        // `content` (the conversation/session JSON) is selected with the list so each row can show its
        // engagement, outcome, turn count, duration and locale up front — one round-trip instead of a
        // fetch per row on expand. The richer session-analytics query (getAgentUsage) still omits it.
        const query =
            '?$select=conversationtranscriptid,name,schematype,conversationstarttime,createdon,content' +
            `&$filter=_bot_conversationtranscriptid_value eq ${botId}` +
            `&$orderby=createdon desc&$top=${top}`;

        const response = await retrieveMultipleRecords('conversationtranscripts', query, FORMATTED_VALUE_HEADER);
        return (response.entities || []).map(_mapTranscriptEntity);
    },

    /**
     * Retrieves the full content (the conversation/run JSON) of a single transcript.
     * @param {Function} retrieveRecord - Bound DataService.retrieveRecord.
     * @param {string} transcriptId - The conversationtranscript GUID.
     * @returns {Promise<string|null>} The transcript content JSON string, or null.
     */
    async getTranscriptContent(retrieveRecord, transcriptId) {
        if (!transcriptId) {
            return null;
        }
        const record = await retrieveRecord('conversationtranscripts', transcriptId, '?$select=content');
        return record?.content || null;
    },

    /**
     * Computes Dataverse-native session analytics for an agent from its conversation transcripts:
     * total sessions (sampled), recent-window counts, per-channel breakdown, and a 14-day series.
     * The richer engagement/satisfaction metrics remain in Copilot Studio (the gateway).
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @param {string} botId - The bot GUID.
     * @param {number} [sampleSize=500] - Maximum number of recent transcripts to summarize.
     * @returns {Promise<AgentUsage>} The usage summary.
     */
    async getAgentUsage(retrieveMultipleRecords, botId, sampleSize = 500) {
        if (!botId) {
            return summarizeAgentUsage([], sampleSize);
        }
        const query =
            '?$select=conversationtranscriptid,schematype,createdon' +
            `&$filter=_bot_conversationtranscriptid_value eq ${botId}` +
            `&$orderby=createdon desc&$top=${sampleSize}`;
        const response = await retrieveMultipleRecords('conversationtranscripts', query, FORMATTED_VALUE_HEADER);
        return summarizeAgentUsage(response.entities || [], sampleSize);
    },

    // ═══════════════════════════════════════════════════════════
    // AI BUILDER MODELS / PROMPTS (msdyn_aimodel table)
    // ═══════════════════════════════════════════════════════════

    /**
     * Retrieves all AI Builder models and prompts in the environment.
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @returns {Promise<AiModel[]>} Array of AI model objects, newest first.
     */
    async getAiModels(retrieveMultipleRecords) {
        // Note: lookup/owner columns must be selected via their `_<name>_value` form in OData $select.
        // The template is expanded rather than read from the lookup's formatted value: the formatted
        // value is the template's *localizable* display name, while `msdyn_uniquename` is the
        // invariant discriminator the maker portal itself filters on (e.g. `ne 'GptPowerPrompt'`).
        const query =
            '?$select=msdyn_aimodelid,msdyn_name,statecode,statuscode,ismanaged,_ownerid_value,' +
            '_msdyn_templateid_value,_msdyn_activerunconfigurationid_value,_msdyn_retrainworkflowid_value,' +
            'createdon,modifiedon' +
            // Configurations are expanded newest-version-first so the card can badge the model with
            // the state of its latest iteration without a request per model.
            '&$expand=msdyn_TemplateId($select=msdyn_aitemplateid,msdyn_uniquename,msdyn_resourceinfo),' +
            'msdyn_aimodel_msdyn_aiconfiguration($select=msdyn_aiconfigurationid,msdyn_type,' +
            'msdyn_majoriterationnumber,msdyn_minoriterationnumber,statecode,statuscode;' +
            '$orderby=msdyn_majoriterationnumber desc,msdyn_minoriterationnumber desc)' +
            '&$orderby=modifiedon desc';

        const response = await retrieveMultipleRecords('msdyn_aimodels', query, FORMATTED_VALUE_HEADER);
        return (response.entities || []).map(_mapAiModelEntity);
    },

    /**
     * Retrieves an AI Builder model's definition. The real definition lives in the related
     * `msdyn_aiconfiguration` record(s), which are *versioned*: a model keeps every iteration and
     * only the one referenced by `msdyn_aimodel.msdyn_activerunconfigurationid` is live. Each
     * payload column is returned as its own section so an edit saves back to the column it came
     * from. `msdyn_aimodel.msdyn_modelcreationcontext` is used only as a fallback.
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @param {Function} retrieveRecord - Bound DataService.retrieveRecord.
     * @param {string} modelId - The msdyn_aimodel GUID.
     * @param {string} [activeConfigId] - The model's published run configuration id, when known.
     * @returns {Promise<{configurations: AiConfiguration[], creationContext: string|null}>}
     */
    async getAiModelDefinition(retrieveMultipleRecords, retrieveRecord, modelId, activeConfigId = '') {
        if (!modelId) {
            return { configurations: [], creationContext: null };
        }

        let configurations = [];
        try {
            const query =
                '?$select=msdyn_aiconfigurationid,msdyn_name,msdyn_type,msdyn_majoriterationnumber,' +
                'msdyn_minoriterationnumber,statecode,statuscode,msdyn_lasterrors,msdyn_lasttrainorrundate,' +
                'msdyn_customconfiguration,msdyn_runconfiguration,msdyn_databinding,' +
                'msdyn_modelrundataspecification,msdyn_modelperformance,msdyn_schedulingoptions' +
                `&$filter=_msdyn_aimodelid_value eq ${modelId}` +
                '&$orderby=msdyn_majoriterationnumber desc,msdyn_minoriterationnumber desc';
            const response = await retrieveMultipleRecords('msdyn_aiconfigurations', query, FORMATTED_VALUE_HEADER);
            configurations = await Promise.all(
                (response.entities || []).map(c => _mapAiConfigurationEntity(c, activeConfigId))
            );
            // Keep configurations that carry a payload OR a failure worth reporting — a failed
            // training run with empty columns is exactly what a user opens this dialog to find.
            configurations = configurations.filter(c => c.sections.length || c.lastError || c.isFailed);
        } catch {
            // The AI Configuration table may be inaccessible in some environments; fall back below.
        }

        let creationContext = null;
        if (!configurations.length) {
            const record = await retrieveRecord('msdyn_aimodels', modelId, '?$select=msdyn_modelcreationcontext');
            const raw = String(record?.msdyn_modelcreationcontext || '').trim();
            // AI Builder writes a literal "{}" for models created without a context — rendering an
            // empty object as "the definition" is worse than saying there is none.
            creationContext = raw && raw !== '{}' && raw !== '[]' ? raw : null;
        }

        return { configurations, creationContext };
    },

    /**
     * Updates a single payload column on an AI Builder configuration. The column must be named
     * explicitly: the displayed text can come from any of the definition columns, and blindly
     * PATCHing `msdyn_customconfiguration` would write one column's content into another.
     * @param {Function} updateRecord - Bound DataService.updateRecord.
     * @param {string} configId - The msdyn_aiconfiguration GUID.
     * @param {string} value - The new column value.
     * @param {string} [column='msdyn_customconfiguration'] - Target column (must be editable).
     * @returns {Promise<object>}
     * @throws {Error} When the column is not an editable definition column.
     */
    // eslint-disable-next-line require-await
    async updateAiConfiguration(updateRecord, configId, value, column = 'msdyn_customconfiguration') {
        if (!EDITABLE_CONFIG_COLUMNS.has(column)) {
            throw new Error(`Column "${column}" is not editable.`);
        }
        return updateRecord('msdyn_aiconfigurations', configId, { [column]: value });
    },

    /**
     * Saves a GPT prompt's configuration through the `AIModelPublish` action.
     *
     * Prompts cannot be saved with a direct PATCH: a platform plugin rejects a write to
     * `msdyn_customconfiguration` on a prompt configuration with
     * `InvalidArgument: Unexpected parameter(s) msdyn_customconfiguration`. AI Builder instead calls
     * this action, which mints a *new* run configuration from a caller-supplied GUID and publishes
     * it. (Trained models are different — those really are saved by PATCHing the columns.)
     *
     * The action returns the model still pointing at the **previous** run configuration: publishing
     * is asynchronous, so the returned id must be polled with {@link getAiConfigurationStatus}
     * until it reports Published.
     * @param {Function} webApiFetch - Bound DataService web API fetch ('POST', path, query, body).
     * @param {{id: string, name: string, templateId: string}} model - The prompt's model record.
     * @param {string} customConfiguration - The full GptDynamicPrompt JSON to publish.
     * @returns {Promise<string>} The new run configuration GUID to poll.
     * @throws {Error} When the model is missing the ids the action requires.
     */
    async publishAiPrompt(webApiFetch, model, customConfiguration) {
        if (!model?.id || !model?.templateId) {
            throw new Error('A model id and template id are required to publish a prompt.');
        }
        const runConfigurationId = _newGuid();
        await webApiFetch('POST', 'AIModelPublish', '', {
            CustomConfiguration: customConfiguration,
            ModelId: model.id,
            ModelName: model.name || '',
            RunConfigurationId: runConfigurationId,
            TemplateId: model.templateId,
            RunConfiguration: '',
            Source: AI_PUBLISH_SOURCE
        });
        return runConfigurationId;
    },

    /**
     * Saves a prompt under a new name as an independent copy, via `AIModelPublish`. Supplying a
     * *new* `ModelId` (rather than the source's) makes the action create a new model instead of
     * publishing over the original — this is exactly how AI Builder's "Save as" works.
     * @param {Function} webApiFetch - Bound DataService web API fetch ('POST', path, query, body).
     * @param {{templateId: string}} model - The source prompt's model (only its template is reused).
     * @param {string} name - The new model's display name.
     * @param {string} customConfiguration - The prompt configuration JSON to copy.
     * @returns {Promise<{modelId: string, runConfigurationId: string}>} The new model and its run config.
     * @throws {Error} When the template id or name is missing.
     */
    async saveAsAiPrompt(webApiFetch, model, name, customConfiguration) {
        if (!model?.templateId) {
            throw new Error('A template id is required to copy a prompt.');
        }
        if (!name?.trim()) {
            throw new Error('A name is required.');
        }
        const modelId = _newGuid();
        const runConfigurationId = _newGuid();
        await webApiFetch('POST', 'AIModelPublish', '', {
            CustomConfiguration: customConfiguration,
            ModelId: modelId,
            ModelName: name.trim(),
            RunConfigurationId: runConfigurationId,
            TemplateId: model.templateId,
            RunConfiguration: '',
            Source: AI_PUBLISH_SOURCE
        });
        return { modelId, runConfigurationId };
    },

    /**
     * Runs a prompt against the LLM without saving it, via the bound `QuickTest` action — the same
     * call AI Builder's Test panel makes. The configuration is sent inline, so unsaved edits can be
     * tried before publishing.
     * For a code-interpreter prompt the model normally generates fresh Python each run. Passing
     * `reuse` (a previous run's `code` + `signature`) inlines that code so the service executes it
     * as-is — AI Builder's "Test without regenerating". Without `reuse`, any `code`/`signature` is
     * stripped so the model always regenerates, matching the portal's plain "Test".
     * @param {Function} webApiFetch - Bound DataService web API fetch ('POST', path, query, body).
     * @param {string} configId - The msdyn_aiconfiguration GUID to test against.
     * @param {string} customConfiguration - The GptDynamicPrompt JSON to run.
     * @param {{code: string, signature: string}|null} [reuse] - Code to run without regenerating.
     * @param {Object.<string, string|{base64Encoded: string}>|null} [inputs] - Input-variable values
     *   (id → value), spread into the request so a prompt with `{token}` inputs runs with those
     *   values (used by Run tests). A file input takes `{base64Encoded}`; see
     *   {@link _quickTestInputValue}.
     * @param {boolean} [regenerate=false] - Drop the stored code so the model writes fresh Python.
     *   Used when the input values changed, since code planned around the previous ones (a PDF
     *   parser, say) need not suit the new ones.
     * @returns {Promise<QuickTestResult>}
     * @throws {Error} When the configuration is missing or not valid JSON.
     */
    async quickTestAiConfiguration(webApiFetch, configId, customConfiguration, reuse = null, inputs = null, regenerate = false) {
        if (!configId) {
            throw new Error('A configuration id is required to run a test.');
        }
        const parsed = JSON.parse(customConfiguration);
        if (reuse?.code) {
            parsed.code = reuse.code;
            parsed.signature = reuse.signature || '';
        } else if (regenerate) {
            // Omitting these is what asks for fresh Python.
            delete parsed.code;
            delete parsed.signature;
        }
        // Otherwise the configuration's own code/signature travel with it and the service runs them
        // as-is. Deleting them on every run made the model rewrite the Python each time, so repeat
        // runs of an unchanged prompt each returned something different — one extracting the PDF
        // text, the next dumping its raw bytes. The maker portal keeps the code it has and asks for
        // new code only when the run differs, which is why its runs are stable down to the log line
        // numbers.
        _stripTestOnlyMetadata(parsed);
        const requestv2 = { '@odata.type': EXPANDO, $customConfig: toExpando(parsed) };
        if (inputs && typeof inputs === 'object') {
            Object.entries(inputs).forEach(([id, value]) => {
                requestv2[id] = _quickTestInputValue(value);
            });
        }
        const response = await webApiFetch(
            'POST', `msdyn_aiconfigurations(${configId})/Microsoft.Dynamics.CRM.QuickTest`, '',
            { version: '2.0', source: AI_QUICKTEST_SOURCE, requestv2 }
        );
        return parseQuickTestResult(response);
    },

    /**
     * Starts training for a configuration via the bound `Train` action. Training is asynchronous:
     * the action returns `InProgress` and the configuration's `statuscode` moves 1 (Training) → 6
     * (Trained) or 9 (Train failed), so the caller polls {@link getAiConfigurationStatus}.
     * @param {Function} webApiFetch - Bound DataService web API fetch ('POST', path, query, body).
     * @param {string} configId - The msdyn_aiconfiguration GUID to train.
     * @returns {Promise<{status: string, error: string}>}
     * @throws {Error} When no configuration id is given.
     */
    async trainAiConfiguration(webApiFetch, configId) {
        if (!configId) {
            throw new Error('A configuration id is required to start training.');
        }
        const response = await webApiFetch(
            'POST', `msdyn_aiconfigurations(${configId})/Microsoft.Dynamics.CRM.Train`, '', { version: '1.0' }
        );
        return parseTrainResponse(response);
    },

    /**
     * Retrains a model by cloning its trained training configuration into a **new** training iteration
     * and training that. A configuration that already trained (statecode Done) can't be trained again
     * in place — the `Train` action rejects it with `Invalid state/status Done (2)/Trained (6)` — so
     * the maker portal (and this method) mints a new iteration from the source's databinding and
     * custom configuration, links it to the model, then trains it. This preserves the previous trained
     * version and its performance.
     *
     * `msdyn_AIModelId` targets **msdyn_aimodel** per the Web API schema, so it binds to
     * `/msdyn_aimodels(...)`. (The portal sends `/msdyn_aiconfigurations(...)`, which Dataverse
     * tolerates by resolving the GUID through the navigation property, but the schema-correct set is
     * used here.) `msdyn_CreatedFromConfigurationId` records the lineage back to the source iteration.
     * @param {Function} webApiFetch - Bound DataService web API fetch ('POST', path, query, body).
     * @param {{id: string}} model - The AI model whose iteration is being retrained.
     * @param {{id: string, databinding?: string, customConfiguration?: string}} source - The trained
     *   training configuration to clone from.
     * @returns {Promise<{configId: string, status: string, error: string}>} The new configuration id
     *   and the `Train` outcome to poll.
     * @throws {Error} When the model or source ids are missing.
     */
    async retrainAiConfiguration(webApiFetch, model, source) {
        if (!model?.id) {
            throw new Error('A model id is required to retrain.');
        }
        if (!source?.id) {
            throw new Error('A source configuration is required to retrain.');
        }
        const newConfigId = _newGuid();
        const payload = {
            msdyn_aiconfigurationid: newConfigId,
            msdyn_type: AI_CONFIG_TYPE_TRAINING,
            statecode: 0,
            msdyn_name: `${model.id}_${new Date().toISOString()}`,
            'msdyn_AIModelId@odata.bind': `/msdyn_aimodels(${model.id})`,
            'msdyn_CreatedFromConfigurationId@odata.bind': `/msdyn_aiconfigurations(${source.id})`
        };
        if (source.databinding) {
            payload.msdyn_databinding = source.databinding;
        }
        if (source.customConfiguration) {
            payload.msdyn_customconfiguration = source.customConfiguration;
        }
        await webApiFetch('POST', 'msdyn_aiconfigurations', '', payload);

        const response = await webApiFetch(
            'POST', `msdyn_aiconfigurations(${newConfigId})/Microsoft.Dynamics.CRM.Train`, '', { version: '1.0' }
        );
        return { configId: newConfigId, ...parseTrainResponse(response) };
    },

    /**
     * Runs a trained classification model against a piece of text via the bound `QuickTest` action —
     * the "Quick test" the maker portal offers. Unlike a prompt (which sends its whole configuration),
     * a classifier sends only the text, and the result is a list of suggested tags with confidence
     * scores (see {@link parseClassifierResult}).
     * @param {Function} webApiFetch - Bound DataService web API fetch ('POST', path, query, body).
     * @param {string} configId - The msdyn_aiconfiguration GUID to test (the published run config).
     * @param {string} text - The text to classify.
     * @returns {Promise<ClassifierResult>}
     * @throws {Error} When no configuration id is given.
     */
    async quickTestModel(webApiFetch, configId, text) {
        if (!configId) {
            throw new Error('A configuration id is required to run a test.');
        }
        const response = await webApiFetch(
            'POST', `msdyn_aiconfigurations(${configId})/Microsoft.Dynamics.CRM.QuickTest`, '',
            { version: '2.0', requestv2: { '@odata.type': EXPANDO, 'text@odata.type': '#String', text: String(text ?? '') } }
        );
        return parseModelTestResult(response);
    },

    /**
     * Unpublishes a published run configuration — the maker portal's "Unpublish". This is the
     * config-bound `UnpublishAIConfiguration` action (the documented counterpart to
     * `PublishAIConfiguration`), which unpublishes the configuration regardless of whether it is in
     * the `Published` (7) or `Scheduled` (8) status. The model-bound `UnschedulePrediction` only
     * removes an *active* scheduled prediction, so it rejects a config still in `Published` (7)
     * ("Invalid state/status Done (2)/Published (7)"). The `version` parameter is documented as
     * "Not used" but required; the action returns its status as a JSON string, like `Train`.
     * @param {Function} webApiFetch - Bound DataService web API fetch ('POST', path, query, body).
     * @param {string} configId - The published run configuration (msdyn_aiconfiguration) GUID.
     * @returns {Promise<{status: string, error: string}>}
     * @throws {Error} When no configuration id is given.
     */
    async unpublishAiConfiguration(webApiFetch, configId) {
        if (!configId) {
            throw new Error('A configuration id is required to unpublish.');
        }
        const response = await webApiFetch(
            'POST', `msdyn_aiconfigurations(${configId})/Microsoft.Dynamics.CRM.UnpublishAIConfiguration`, '', { version: '1.0' }
        );
        return parseTrainResponse(response);
    },

    /**
     * Publishes a trained model's last-trained version — the maker portal's "Publish". This is a
     * two-step flow: (1) create a new **run** configuration (msdyn_type 190690001) bound to the model
     * and to the training configuration (`msdyn_TrainedModelAIConfigurationPareId`), reusing the
     * output data-binding and scheduling of the model's existing run configuration; (2) call
     * `PublishAIConfiguration` on the new run config. The run config's output binding (the results
     * table + tag/score columns) is created once at first publish, so it is cloned from the prior run
     * config rather than reconstructed — which is why a `template` is required.
     * The run config's output binding (the results table + tag/score columns) is created once, so a
     * **republish** clones it from the existing run config; a **first publish** (no prior run config)
     * derives it from the training binding — the prediction input is the training input minus the
     * label (`tags`) attribute, and the output binds the `new_tc_<modelId>` results table with its
     * fixed `new_tags`/`new_confidence_Level` columns.
     * @param {Function} webApiFetch - Bound DataService web API fetch ('POST', path, query, body).
     * @param {{id: string}} model - The AI model being published.
     * @param {string} trainingConfigId - The trained (training) configuration to publish.
     * @param {{databinding?: string, schedulingoptions?: string, trainingDatabinding?: string}} options
     *   - `databinding`/`schedulingoptions`: the prior run config's payload to clone (republish);
     *   `trainingDatabinding`: the training config's binding used to derive a first publish.
     * @returns {Promise<{configId: string, status: string, error: string}>}
     * @throws {Error} When the model or training config is missing, or the binding can't be resolved.
     */
    async publishTrainedModel(webApiFetch, model, trainingConfigId, options) {
        if (!model?.id) {
            throw new Error('A model id is required to publish.');
        }
        if (!trainingConfigId) {
            throw new Error('A trained configuration is required to publish.');
        }
        const databinding = options?.databinding || _deriveRunDatabinding(model.id, options?.trainingDatabinding);
        if (!databinding) {
            throw new Error('Could not resolve the prediction binding for this model.');
        }
        const payload = {
            msdyn_type: AI_CONFIG_TYPE_RUN,
            statecode: 0,
            msdyn_name: `${model.id}_${new Date().toISOString()}`,
            msdyn_databinding: databinding,
            msdyn_schedulingoptions: options?.schedulingoptions || AI_PREDICTION_SCHEDULE,
            'msdyn_AIModelId@odata.bind': `/msdyn_aimodels(${model.id})`,
            'msdyn_TrainedModelAIConfigurationPareId@odata.bind': `/msdyn_aiconfigurations(${trainingConfigId})`
        };
        const created = await webApiFetch('POST', 'msdyn_aiconfigurations', '', payload);
        const runConfigId = created?.msdyn_aiconfigurationid || created?.id;
        if (!runConfigId) {
            throw new Error('Publish did not return a run configuration id.');
        }
        const response = await webApiFetch(
            'POST', `msdyn_aiconfigurations(${runConfigId})/Microsoft.Dynamics.CRM.PublishAIConfiguration`, '', { version: '1.0' }
        );
        return { configId: runConfigId, ...parseTrainResponse(response) };
    },

    /**
     * Reads a configuration's publish status — the authoritative signal that an `AIModelPublish`
     * landed, since the action itself completes before the publish does.
     * @param {Function} retrieveRecord - Bound DataService.retrieveRecord.
     * @param {string} configId - The msdyn_aiconfiguration GUID.
     * @returns {Promise<{statusCode: number|null, status: string, isPublished: boolean}>}
     */
    async getAiConfigurationStatus(retrieveRecord, configId) {
        if (!configId) {
            return { statusCode: null, status: '', isPublished: false };
        }
        const record = await retrieveRecord('msdyn_aiconfigurations', configId, '?$select=statuscode');
        const statusCode = typeof record?.statuscode === 'number' ? record.statuscode : null;
        return {
            statusCode,
            status: AI_CONFIG_STATUS_LABELS[statusCode] || '',
            isPublished: statusCode === AI_CONFIG_STATUS_PUBLISHED
        };
    },

    // ═══════════════════════════════════════════════════════════
    // AI BUILDER RUNS & EVALUATIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * Retrieves recent AI Builder run/events for a model (quick tests + automation runs). These are
     * the real execution records AI Builder writes to the `msdyn_aievent` table (output, consumption,
     * processing status, dates).
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @param {string} modelId - The msdyn_aimodel GUID.
     * @param {number} [top=25] - Maximum number of runs to return.
     * @returns {Promise<AiBuilderRun[]>} Array of run objects, newest first.
     */
    async getAiBuilderRuns(retrieveMultipleRecords, modelId, top = 25) {
        if (!modelId) {
            return [];
        }
        // `msdyn_datainfo` (the input that was run — often large) is fetched per-row on expand via
        // getAiBuilderRunInput, so the list stays light.
        const query =
            '?$select=msdyn_aieventid,msdyn_name,msdyn_output,msdyn_quicktest,msdyn_datatype,' +
            'msdyn_processingstatus,msdyn_processingdate,msdyn_creditconsumed,msdyn_consumptionsource,' +
            'msdyn_eventdata,statecode,statuscode,createdon,_msdyn_aiconfigurationid_value,_createdby_value' +
            `&$filter=_msdyn_aimodelid_value eq ${modelId}` +
            `&$orderby=createdon desc&$top=${top}`;

        const response = await retrieveMultipleRecords('msdyn_aievents', query, FORMATTED_VALUE_HEADER);
        return (response.entities || []).map(_mapAiEventEntity);
    },

    /**
     * Retrieves the input a run was executed against (the `msdyn_datainfo` column of a single
     * `msdyn_aievent`). It is fetched lazily — the column can be large (a full conversation transcript
     * for a transcript-classification model) — so it is kept out of the run list query.
     * @param {Function} retrieveRecord - Bound DataService.retrieveRecord.
     * @param {string} eventId - The msdyn_aievent GUID.
     * @returns {Promise<string|null>} The raw `msdyn_datainfo` JSON string, or null.
     */
    async getAiBuilderRunInput(retrieveRecord, eventId) {
        if (!eventId) {
            return null;
        }
        const record = await retrieveRecord('msdyn_aievents', eventId, '?$select=msdyn_datainfo');
        return record?.msdyn_datainfo || null;
    },

    /**
     * Resolves the AI Builder **Test hub** artifacts for a model/prompt: the reusable test cases and
     * the history of test-run batches. This is the same data the maker portal's "Test hub" and "Test
     * results" views read — a prompt's saved test cases (each with an expected output) and every batch
     * run against them. Both tables key off the polymorphic `msdyn_aiobjectid` (a Uniqueidentifier, so
     * the GUID is unquoted). Each query is independent so a table missing in an older environment does
     * not hide the rest. Per-case inputs and per-batch runs are loaded on demand
     * ({@link AgentService.getTestCaseInputs} / {@link AgentService.getTestBatchRuns}).
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @param {string} objectId - The AI object GUID (msdyn_aimodelid).
     * @returns {Promise<{testCases: EvalTestCase[], batches: TestRunBatch[], criteria: EvaluationCriteria|null}>}
     */
    async getPromptEvaluations(retrieveMultipleRecords, objectId) {
        const result = { testCases: [], batches: [], criteria: null };
        if (!objectId) {
            return result;
        }

        // Test cases — the reusable definitions (name + expected output).
        try {
            const query =
                '?$select=msdyn_aitestcaseid,msdyn_name,msdyn_description,msdyn_expectedoutput,' +
                'msdyn_source,msdyn_testcasestate,statecode,createdon,modifiedon' +
                `&$filter=msdyn_aiobjectid eq ${objectId}&$orderby=createdon desc`;
            const response = await retrieveMultipleRecords('msdyn_aitestcases', query, FORMATTED_VALUE_HEADER);
            result.testCases = (response.entities || []).map(_mapTestCaseEntity);
        } catch {
            // Test case table unavailable in this environment.
        }

        // Test-run batches — one per execution of the test set, newest first.
        try {
            const query =
                '?$select=msdyn_aitestrunbatchid,msdyn_name,msdyn_description,msdyn_batchrunstatus,' +
                'msdyn_startedon,msdyn_completedon,msdyn_accuracyscore,' +
                'msdyn_errormessage,statecode,statuscode,createdon' +
                `&$filter=msdyn_aiobjectid eq ${objectId}&$orderby=createdon desc&$top=50`;
            const response = await retrieveMultipleRecords('msdyn_aitestrunbatches', query, FORMATTED_VALUE_HEADER);
            result.batches = (response.entities || []).map(_mapTestBatchEntity);
        } catch {
            // Test-run batch table unavailable in this environment.
        }

        // Evaluation criteria — the passing score + which prebuilt checks apply. This is what turns
        // a run's accuracy score into a pass/fail (pass = score >= passingScore).
        try {
            const query =
                '?$select=msdyn_aievaluationconfigurationid,msdyn_evaluationcriteria' +
                `&$filter=msdyn_aiobjectid eq ${objectId}&$top=1`;
            const response = await retrieveMultipleRecords('msdyn_aievaluationconfigurations', query, FORMATTED_VALUE_HEADER);
            const first = (response.entities || [])[0];
            result.criteria = first ? _mapEvaluationCriteria(first) : null;
        } catch {
            // Evaluation configuration table unavailable in this environment.
        }

        return result;
    },

    /**
     * Loads the saved input rows for a single test case (the `{token}` values a run feeds the prompt).
     * A prompt with no input variables has an empty `msdyn_inputdata` (`[]`).
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @param {string} testCaseId - The msdyn_aitestcase GUID.
     * @returns {Promise<TestCaseInput[]>}
     */
    async getTestCaseInputs(retrieveMultipleRecords, testCaseId) {
        if (!testCaseId) {
            return [];
        }
        const query =
            '?$select=msdyn_aitestcaseinputid,msdyn_name,msdyn_inputdata,modifiedon' +
            `&$filter=_msdyn_aitestcaseid_value eq ${testCaseId}&$orderby=modifiedon desc`;
        const response = await retrieveMultipleRecords('msdyn_aitestcaseinputs', query, FORMATTED_VALUE_HEADER);
        return (response.entities || []).map(_mapTestCaseInputEntity);
    },

    /**
     * Loads the individual test runs inside a batch — one per test case, each carrying the actual
     * output, accuracy score and response metadata (tokens, model name/type).
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @param {string} batchId - The msdyn_aitestrunbatch GUID.
     * @returns {Promise<TestRun[]>}
     */
    async getTestBatchRuns(retrieveMultipleRecords, batchId) {
        if (!batchId) {
            return [];
        }
        const query =
            '?$select=msdyn_aitestrunid,msdyn_name,msdyn_expectedoutput,msdyn_actualoutput,' +
            'msdyn_accuracyscore,msdyn_additionalresponsemetadata,msdyn_testrunstatus,' +
            'msdyn_configurationid,msdyn_startedon,msdyn_completedon,msdyn_errormessage,' +
            'msdyn_comment,_msdyn_aitestcaseid_value' +
            `&$filter=(_msdyn_aitestrunbatchid_value eq ${batchId})&$orderby=createdon asc`;
        const response = await retrieveMultipleRecords('msdyn_aitestruns', query, FORMATTED_VALUE_HEADER);
        return (response.entities || []).map(_mapTestRunEntity);
    },

    /**
     * Runs a prompt's test cases exactly as the AI Builder Test hub does — creating a batch, one run
     * per case, calling the prompt (QuickTest) for each, grading the result against the evaluation
     * criteria (a second QuickTest against the system grader when semantic/quality scoring applies),
     * and writing the scores back. Runs are executed sequentially; the batch is completed at the end.
     *
     * This is a write operation that consumes AI Builder credits (two model calls per graded case).
     * @param {object} deps - Bound DataService primitives.
     * @param {Function} deps.createRecord - Creates a record, resolving to `{id}`.
     * @param {Function} deps.updateRecord - Patches a record.
     * @param {Function} deps.retrieveMultipleRecords - Queries records.
     * @param {Function} deps.webApiFetch - Raw web API fetch ('POST', path, query, body).
     * @param {Function} deps.quickTest - Bound DataService.quickTestAiConfiguration(configId, json).
     * @param {object} params
     * @param {{id: string, name: string}} params.model - The prompt's model.
     * @param {string} params.activeConfigId - The published run configuration to test against.
     * @param {string} params.promptConfigJson - The live GptDynamicPrompt JSON (for prediction + grader).
     * @param {import('./AgentService.js').EvaluationCriteria|null} params.criteria - The prompt's criteria (or null → default).
     * @param {Array<{id: string, expectedOutput: string, inputs?: Object.<string,string>}>} params.testCases
     * @returns {Promise<{batchId: string, ran: number, passed: number, failed: number}>}
     * @throws {Error} When no runnable test cases are given.
     */
    async runPromptTests(deps, params) {
        const { createRecord, updateRecord, retrieveMultipleRecords, webApiFetch, quickTest } = deps;
        const { model, activeConfigId, promptConfigJson, criteria, testCases } = params;
        if (!testCases?.length) {
            throw new Error('No test cases to run.');
        }
        const now = () => new Date().toISOString();
        let promptItems = [];
        try {
            promptItems = JSON.parse(promptConfigJson || '{}').prompt || [];
        } catch {
            promptItems = [];
        }

        // 1. Create the batch (in progress).
        const batchName = `${model.name || 'Prompt'} - ${Date.now()}`;
        const batch = await createRecord('msdyn_aitestrunbatches', {
            msdyn_startedon: now(),
            msdyn_batchrunstatus: AI_TEST_STATUS_INPROGRESS,
            msdyn_description: batchName,
            msdyn_aiobjectid: model.id,
            msdyn_aiobjecttype: 'AIPrompt',
            msdyn_name: batchName
        });
        const batchId = batch.id;

        // 2. Resolve the evaluation configuration (the prompt's own, or the shared default).
        const evalConfig = await _resolveEvaluationConfig(retrieveMultipleRecords, createRecord, model.id, criteria);

        // 3. Create a run per case (in progress).
        const runs = [];
        for (const testCase of testCases) {
            const created = await createRecord('msdyn_aitestruns', {
                msdyn_name: ' ',
                msdyn_expectedoutput: testCase.expectedOutput || '',
                msdyn_actualoutput: '',
                msdyn_startedon: now(),
                msdyn_testrunstatus: AI_TEST_STATUS_INPROGRESS,
                msdyn_configurationid: activeConfigId,
                msdyn_errormessage: '',
                'msdyn_AITestCaseId@odata.bind': `/msdyn_aitestcases(${testCase.id})`,
                'msdyn_AITestRunBatchId@odata.bind': `/msdyn_aitestrunbatches(${batchId})`
            });
            runs.push({ runId: created.id, testCase });
        }

        // 4. Execute each run sequentially.
        let passed = 0;
        let failed = 0;
        for (const { runId, testCase } of runs) {
            try {
                // Pass this case's input values so an input-variable prompt runs with them, and ask
                // for fresh code each time: every case feeds different values, and code planned
                // around the previous case's need not suit this one.
                const prediction = await quickTest(activeConfigId, promptConfigJson, null, testCase.inputs || {}, true);
                if (!prediction.succeeded) {
                    throw new Error(prediction.error || 'Prediction failed.');
                }
                const actualOutput = prediction.text;
                const tokens = _evalTokenUnits(prediction.promptTokens, prediction.completionTokens, prediction.modelType, prediction.modelName);
                const metadata = JSON.stringify({ tokens, modelName: prediction.modelName, modelType: prediction.modelType });

                const score = await _scoreTestRun(
                    { createRecord, updateRecord, webApiFetch },
                    { runId, evalConfig, testCase, promptItems, actualOutput }
                );

                const patch = {
                    msdyn_actualoutput: actualOutput,
                    msdyn_additionalresponsemetadata: metadata,
                    msdyn_testrunstatus: AI_TEST_STATUS_SUCCEEDED,
                    msdyn_completedon: now()
                };
                if (score !== null) {
                    patch.msdyn_accuracyscore = String(score);
                    if (score >= (evalConfig?.passingScore ?? AI_EVAL_DEFAULT_PASSING_SCORE)) {
                        passed += 1;
                    }
                }
                await updateRecord('msdyn_aitestruns', runId, patch);
            } catch {
                failed += 1;
                await updateRecord('msdyn_aitestruns', runId, {
                    msdyn_testrunstatus: AI_TEST_STATUS_FAILED,
                    msdyn_completedon: now()
                });
            }
        }

        // 5. Complete the batch.
        await updateRecord('msdyn_aitestrunbatches', batchId, {
            msdyn_completedon: now(),
            msdyn_batchrunstatus: failed ? AI_TEST_STATUS_FAILED : AI_TEST_STATUS_SUCCEEDED
        });

        return { batchId, ran: runs.length, passed, failed };
    },

    /**
     * Resolves display labels for specific solutions by id, in chunks (to keep the OData filter
     * short). Used to name the solutions that {@link AgentService.getSolutionMemberships} returns.
     * Resolves only **visible** solutions (`isvisible eq true`), so the invisible "Active" working
     * layer is omitted — matching the Power Automate and Solution Layers tabs.
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @param {string[]} ids - Solution GUIDs to resolve.
     * @returns {Promise<Object.<string, string>>} Map of visible solution id → "Display Name (uniquename)" label.
     */
    async getSolutionNamesByIds(retrieveMultipleRecords, ids) {
        const names = {};
        const unique = [...new Set((ids || []).filter(Boolean))];
        const CHUNK_SIZE = 20;

        for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
            const chunk = unique.slice(i, i + CHUNK_SIZE);
            const idFilter = chunk.map(id => `solutionid eq ${id}`).join(' or ');
            try {
                const response = await retrieveMultipleRecords(
                    'solutions',
                    `?$select=solutionid,friendlyname,uniquename&$filter=(${idFilter}) and isvisible eq true`
                );
                (response.entities || []).forEach(s => {
                    names[s.solutionid] = formatSolutionLabel(s.friendlyname, s.uniquename, s.solutionid);
                });
            } catch {
                // Leave this chunk unresolved; the caller falls back gracefully.
            }
        }
        return names;
    },

    /**
     * Resolves the real solution membership of records via the `solutioncomponent` table. A record's
     * own `solutionid` column points to the invisible "Active" working layer, so it does NOT reflect
     * the visible Default/custom/managed solutions the other tabs show — `solutioncomponent` does.
     * Keyed by `objectid`, so it works for any component type (bots, AI models, workflows, …) without
     * needing per-type component-type codes.
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @param {string[]} objectIds - Record GUIDs to resolve membership for.
     * @returns {Promise<Object.<string, string[]>>} Map of record id → the solution GUIDs it belongs to.
     */
    async getSolutionMemberships(retrieveMultipleRecords, objectIds) {
        const map = {};
        const unique = [...new Set((objectIds || []).filter(Boolean))];
        const CHUNK_SIZE = 20;

        for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
            const chunk = unique.slice(i, i + CHUNK_SIZE);
            const filter = chunk.map(id => `objectid eq ${id}`).join(' or ');
            try {
                const response = await retrieveMultipleRecords(
                    'solutioncomponents',
                    `?$select=objectid,_solutionid_value&$filter=${filter}`
                );
                (response.entities || []).forEach(sc => {
                    const oid = sc.objectid;
                    const sid = sc._solutionid_value;
                    if (!oid || !sid) {
                        return;
                    }
                    (map[oid] = map[oid] || []);
                    if (!map[oid].includes(sid)) {
                        map[oid].push(sid);
                    }
                });
            } catch {
                // Leave this chunk unresolved; the caller falls back to no membership.
            }
        }
        return map;
    }
};

/**
 * Formats a solution into the "Display Name (uniquename)" label used by the solution-scoped tabs.
 * Collapses to a single token when the friendly name is missing or equals the unique name, so the
 * non-visible "Active" working solution shows as "Active" rather than the redundant "Active (Active)".
 * @param {string} friendlyname - Solution friendly (display) name.
 * @param {string} uniquename - Solution unique (schema) name.
 * @param {string} solutionid - Solution GUID (last-resort fallback).
 * @returns {string} Display label.
 */
export function formatSolutionLabel(friendlyname, uniquename, solutionid) {
    const display = friendlyname || uniquename || solutionid;
    return uniquename && uniquename !== display ? `${display} (${uniquename})` : display;
}

/**
 * Returns true if a component is the Custom GPT component that holds the agent instructions.
 * Only legacy agents (template `empty-*`, `gPTSettings`) carry this; modern agents keep their
 * instructions inline in the bot `configuration` — see {@link extractAgentInstructions}.
 * @param {AgentComponent} component
 * @returns {boolean}
 */
export function isInstructionsComponent(component) {
    return component?.componentType === COMPONENT_TYPE_CUSTOM_GPT;
}

/**
 * Extracts the agent's instruction text from the bot `configuration` JSON. Modern Copilot Studio
 * agents (template `cliagent-*`) store the system prompt at
 * `agentSettings.instructions.segments[].value` rather than in a Custom GPT (type 15) component.
 * The stored value is often wrapped in a Markdown code fence, which is stripped for display.
 * @param {string|object|null} configuration - The bot `configuration` column (JSON string or object).
 * @returns {string} The concatenated instruction text, or an empty string when none is present.
 */
export function extractAgentInstructions(configuration) {
    if (!configuration) {
        return '';
    }
    let cfg;
    try {
        cfg = typeof configuration === 'string' ? JSON.parse(configuration) : configuration;
    } catch {
        return '';
    }
    const segments = cfg?.agentSettings?.instructions?.segments;
    if (!Array.isArray(segments) || !segments.length) {
        return '';
    }
    const text = segments
        .map(seg => (typeof seg?.value === 'string' ? seg.value : ''))
        .join('')
        .trim();
    return _stripCodeFence(text);
}

/**
 * Removes a single wrapping Markdown code fence (```` ``` ```` … ```` ``` ````), preserving the inner text.
 * @param {string} text
 * @returns {string}
 * @private
 */
function _stripCodeFence(text) {
    const match = text.match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
    return match ? match[1].trim() : text;
}

/**
 * Reports whether a modern agent's instructions can be safely edited as plain text. True only when
 * every instruction segment is plain text (has a string `value`). Instructions that embed a reference
 * segment (e.g. a `VariableSegment`, which has no `value`) can't round-trip through a plain-text
 * editor without losing the reference, so those stay read-only and are edited as raw configuration.
 * @param {string|object|null} configuration - The bot `configuration` (JSON string or object).
 * @returns {boolean}
 */
export function agentInstructionsEditable(configuration) {
    if (!configuration) {
        return false;
    }
    let cfg;
    try {
        cfg = typeof configuration === 'string' ? JSON.parse(configuration) : configuration;
    } catch {
        return false;
    }
    const segments = cfg?.agentSettings?.instructions?.segments;
    if (!Array.isArray(segments) || !segments.length) {
        return false;
    }
    return segments.every(seg => typeof seg?.value === 'string');
}

/**
 * Writes edited instruction text back into a modern agent's bot `configuration`, replacing
 * `agentSettings.instructions.segments` with a single static segment carrying the new text. The
 * wrapping Markdown code fence is preserved when the stored value used one — so the round-trip of
 * {@link extractAgentInstructions} → edit → `applyAgentInstructions` leaves an unchanged prompt byte
 * for byte. Only call this for instructions that pass {@link agentInstructionsEditable}; every other
 * field of the configuration is left untouched.
 * @param {string|object} configuration - The bot `configuration` (JSON string or object).
 * @param {string} editedText - The edited instruction text (without the code fence).
 * @returns {string} The updated configuration JSON string.
 * @throws {Error} When the configuration has no instruction segments to write to.
 */
export function applyAgentInstructions(configuration, editedText) {
    // Deep-clone via JSON (the configuration is pure JSON) so a passed-in object isn't mutated.
    const cfg = typeof configuration === 'string'
        ? JSON.parse(configuration)
        : JSON.parse(JSON.stringify(configuration));
    const instructions = cfg?.agentSettings?.instructions;
    if (!instructions || !Array.isArray(instructions.segments)) {
        throw new Error('This agent has no editable instructions in its configuration.');
    }
    // Preserve the wrapping code fence (with its info string) when the stored value used one.
    const rawJoined = instructions.segments
        .map(seg => (typeof seg?.value === 'string' ? seg.value : ''))
        .join('')
        .trim();
    const fence = rawJoined.match(/^(```[^\n]*)\n[\s\S]*\n?```$/);
    instructions.segments = [{
        $kind: 'StaticSegment',
        value: fence ? `${fence[1]}\n${editedText}\n\`\`\`` : editedText
    }];
    return JSON.stringify(cfg);
}

/**
 * Extracts the model a modern agent runs on from the bot `configuration`
 * (`agentSettings.model.series`, e.g. "GPT5Chat"). Empty for legacy agents that don't record it.
 * @param {string|object|null} configuration - The bot `configuration` column (JSON string or object).
 * @returns {string} The model series, or an empty string.
 */
export function extractAgentModel(configuration) {
    if (!configuration) {
        return '';
    }
    let cfg;
    try {
        cfg = typeof configuration === 'string' ? JSON.parse(configuration) : configuration;
    } catch {
        return '';
    }
    return String(cfg?.agentSettings?.model?.series || '').trim();
}

/** Component types that map to a kind regardless of schema name. */
const KIND_BY_TYPE = { 15: 'instructions', 16: 'knowledge', 19: 'test' };

/**
 * Returns true if a component is a connected (child) agent. Modern agents store this as an
 * `.action.` component whose data is a `ConnectedAgentTool` (carrying a `botSchemaName` that points
 * at the child); older agents use `.agent.` or `.InvokeConnectedAgentTaskAction.`.
 * @param {string} schemaKind - The middle segment of the component schema name.
 * @param {string} payload - The component `data`/`content`.
 * @returns {boolean}
 */
function isConnectedAgent(schemaKind, payload) {
    return schemaKind === 'agent'
        || schemaKind === 'InvokeConnectedAgentTaskAction'
        || /\bkind:\s*ConnectedAgentTool\b/.test(payload);
}

/**
 * Classifies a component into a meaningful kind. Component type 9 ("Topic V2") is reused by
 * Copilot Studio for topics, actions/tools, AND connected (child) agents — distinguishable by the
 * middle segment of the schema name (e.g. `prefix_bot123.agent.Name`) or the component data.
 * @param {AgentComponent} component
 * @returns {'instructions'|'knowledge'|'test'|'connectedAgent'|'action'|'trigger'|'topic'|'other'}
 */
export function getComponentKind(component) {
    if (!component) {
        return 'other';
    }
    const type = component.componentType;
    if (KIND_BY_TYPE[type]) {
        return KIND_BY_TYPE[type];
    }
    const schemaKind = String(component.schemaName || '').split('.')[1] || '';
    const payload = String(component.data || component.content || '');
    if (isConnectedAgent(schemaKind, payload)) {
        return 'connectedAgent';
    }
    if (schemaKind === 'action' || schemaKind === 'skill') {
        return 'action'; // tools & skills (e.g. `.skill.` = an InlineAgentSkill)
    }
    if (schemaKind === 'ExternalTriggerComponent' || type === 5 || type === 17) {
        return 'trigger';
    }
    if (schemaKind === 'topic' || type === 0 || type === 9) {
        return 'topic';
    }
    if (type === 1 || type === 13) {
        return 'action'; // skills act as tools
    }
    return 'other';
}

/**
 * Returns the most meaningful description for a component. Falls back to a `description:` line in the
 * component's `data`/`content` payload (e.g. an inline connected agent's `beginDialog.description`)
 * when the dedicated description column is empty.
 * @param {AgentComponent} component
 * @returns {string} The description, or an empty string.
 */
export function getComponentDescription(component) {
    if (component?.description) {
        return component.description;
    }
    const payload = String(component?.data || component?.content || '');
    const match = payload.match(/^\s*description:\s*(.+)$/m);
    return match ? match[1].trim() : '';
}

/**
 * Extracts the child agent's schema name from a connected-agent component's `data`
 * (`kind: ConnectedAgentTool` … `botSchemaName: <schema>`). Used to resolve the connection to a
 * known agent in the environment (more reliable than the component's display name).
 * @param {AgentComponent} component
 * @returns {string} The child agent's schema name, or an empty string.
 */
export function extractConnectedAgentSchema(component) {
    const payload = String(component?.data || component?.content || '');
    const match = payload.match(/botSchemaName:\s*(\S+)/);
    return match ? match[1].trim() : '';
}

/**
 * Extracts the child agent's display name from a connected-agent component's `data`
 * (`modelDisplayName: <name>` in a legacy InvokeConnectedAgentTaskAction). Useful when the
 * component's own name has drifted from the target after a rename, but the embedded
 * `modelDisplayName` still carries the real name.
 * @param {AgentComponent} component
 * @returns {string} The child agent's display name, or an empty string.
 */
export function extractConnectedAgentName(component) {
    const payload = String(component?.data || component?.content || '');
    const match = payload.match(/^\s*modelDisplayName:\s*(.+)$/m);
    return match ? match[1].trim() : '';
}

/**
 * Extracts a human-readable prompt from a GptDynamicPrompt configuration JSON (the format AI Builder
 * uses for custom prompts). Literal segments are concatenated; every non-literal segment becomes a
 * `{placeholder}`.
 *
 * `data` segments — the Dataverse columns the prompt is grounded on — carry the friendly binding in
 * `text` (e.g. "Project.Text in DE"). They are the subject of most prompts, so dropping them
 * silently rewrites the prompt ("Translate {Project.Text in DE} to english" → "Translate  to
 * english").
 * @param {string} configText - The `msdyn_customconfiguration` JSON string.
 * @returns {string|null} The readable prompt text, or null if not a recognizable prompt.
 */
export function extractPromptText(configText) {
    try {
        const parsed = JSON.parse(configText);
        if (!Array.isArray(parsed?.prompt)) {
            return null;
        }
        const inputLabels = _promptInputLabels(parsed);
        const text = parsed.prompt.map(seg => {
            if (seg?.type === 'literal') {
                return seg.text || '';
            }
            const token = _promptSegmentLabel(seg, inputLabels);
            return token ? `{${token}}` : '';
        }).join('');
        return text.trim() ? text : null;
    } catch {
        return null;
    }
}

/**
 * Maps a GptDynamicPrompt config's declared inputs to their friendly labels (`id` → display text),
 * so an `inputVariable` segment can be shown as "Text input" rather than the raw id "Text_20input".
 * @param {object} parsed - The parsed configuration.
 * @returns {Object.<string, string>}
 * @private
 */
function _promptInputLabels(parsed) {
    const inputs = Array.isArray(parsed?.definitions?.inputs) ? parsed.definitions.inputs : [];
    return inputs.reduce((map, input) => {
        if (input?.id) {
            map[input.id] = input.text || input.id;
        }
        return map;
    }, {});
}

/**
 * The friendly token label for a non-literal prompt segment (an input variable's declared label, a
 * data binding's or formula's text, falling back to the id). Returns '' for a literal.
 * @param {object} seg - A prompt segment.
 * @param {Object.<string, string>} inputLabels - id → label, from {@link _promptInputLabels}.
 * @returns {string}
 * @private
 */
function _promptSegmentLabel(seg, inputLabels) {
    if (!seg || seg.type === 'literal' || !seg.type) {
        return '';
    }
    if (seg.type === 'inputVariable') {
        return inputLabels[seg.id] || seg.id || '';
    }
    return seg.text || seg.id || '';
}

/**
 * Rebuilds a GptDynamicPrompt's `prompt` array from friendly text edited in the dialog. Text between
 * `{tokens}` becomes literal segments; each `{token}` maps back to the original non-literal segment
 * with that label (preserving its type/id/binding), and an unrecognised token is kept as literal
 * text so nothing is silently lost. This is the inverse of {@link extractPromptText}.
 * @param {string} editedText - The edited prompt text (with `{token}` placeholders).
 * @param {object} parsed - The current parsed configuration (source of the original segments).
 * @returns {Array<object>} The rebuilt `prompt` array.
 */
export function rebuildPromptSegments(editedText, parsed) {
    const inputLabels = _promptInputLabels(parsed);
    const byLabel = {};
    (Array.isArray(parsed?.prompt) ? parsed.prompt : []).forEach(seg => {
        const label = _promptSegmentLabel(seg, inputLabels);
        if (label && !(label in byLabel)) {
            byLabel[label] = seg;
        }
    });

    const segments = [];
    const pushLiteral = (text) => {
        if (!text) {
            return;
        }
        const last = segments[segments.length - 1];
        if (last && last.type === 'literal') {
            last.text += text;
        } else {
            segments.push({ type: 'literal', text });
        }
    };

    const pattern = /\{([^}]*)\}/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(String(editedText))) !== null) {
        pushLiteral(editedText.slice(lastIndex, match.index));
        const label = match[1];
        if (byLabel[label]) {
            segments.push({ ...byLabel[label] });
        } else {
            // Unknown token — keep the literal braces rather than dropping the user's text.
            pushLiteral(match[0]);
        }
        lastIndex = pattern.lastIndex;
    }
    pushLiteral(editedText.slice(lastIndex));
    return segments;
}

/**
 * Applies friendly prompt text back into a configuration, replacing only its `prompt` array and
 * leaving every other field (definitions, settings, model parameters, code) untouched.
 * @param {string} configText - The current configuration JSON.
 * @param {string} editedText - The edited prompt text.
 * @returns {string} The updated configuration JSON.
 * @throws {SyntaxError} When the configuration is not valid JSON.
 */
export function applyPromptText(configText, editedText) {
    const parsed = JSON.parse(configText);
    parsed.prompt = rebuildPromptSegments(editedText, parsed);
    return JSON.stringify(parsed);
}

/**
 * @typedef {object} PromptMetadata
 * @property {string} modelType - The LLM the prompt runs on (e.g. `gpt-41-mini`).
 * @property {number|null} temperature - Sampling temperature, when configured.
 * @property {number|null} recordRetrievalLimit - Max grounding records read per run.
 * @property {string} contentModerationLevel - Moderation level (Low / Moderate / High).
 * @property {boolean|null} preserveRecordLinks - "Include links in the response".
 * @property {boolean} codeInterpreter - True when the code-interpreter runtime is enabled.
 * @property {string} code - Stored generated Python (code-interpreter prompts, after publish).
 * @property {string} signature - The stored code's signature (needed to re-run without regenerating).
 * @property {string[]} outputFormats - Declared output formats (e.g. `["text"]`).
 * @property {Array<{name: string, type: string, filters: string[]}>} dataSources - Grounding sources.
 * @property {Array<{name: string, type: string}>} inputs - Declared input variables.
 * @property {Array<{name: string, content: string}>} formulas - Power Fx formulas the prompt embeds.
 */

/**
 * Extracts the execution settings of a GptDynamicPrompt configuration — which model it runs on, how
 * it is tuned, and which Dataverse tables it is grounded on. All of this sits alongside the prompt
 * text in `msdyn_customconfiguration` and is invisible in the raw JSON at a glance.
 * @param {string} configText - The `msdyn_customconfiguration` JSON string.
 * @returns {PromptMetadata|null} Parsed metadata, or null when the config is not a prompt.
 */
export function extractPromptMetadata(configText) {
    try {
        const parsed = JSON.parse(configText);
        if (!Array.isArray(parsed?.prompt)) {
            return null;
        }
        const definitions = parsed.definitions || {};
        const settings = parsed.settings || {};
        return {
            modelType: parsed.modelParameters?.modelType || '',
            temperature: _numOrNull(parsed.modelParameters?.gptParameters?.temperature),
            recordRetrievalLimit: _numOrNull(settings.recordRetrievalLimit),
            contentModerationLevel: settings.contentModerationLevel || '',
            preserveRecordLinks: typeof settings.shouldPreserveRecordLinks === 'boolean'
                ? settings.shouldPreserveRecordLinks
                : null,
            codeInterpreter: settings.runtime === 'codeinterpreter',
            // A published code-interpreter prompt stores the generated Python and its signature.
            code: parsed.code || '',
            signature: parsed.signature || '',
            outputFormats: Array.isArray(definitions.output?.formats) ? definitions.output.formats : [],
            formulas: (Array.isArray(definitions.formulas) ? definitions.formulas : []).map(f => ({
                name: f?.displayName || f?.id || '',
                content: f?.content || ''
            })),
            dataSources: (Array.isArray(definitions.data) ? definitions.data : []).map(source => ({
                name: source?.displayName || source?.id || '',
                type: source?.type || '',
                filters: (Array.isArray(source?.filters) ? source.filters : [])
                    .map(f => `${f?.attribute || ''} ${_filterOperator(f?.filterType)} {${f?.value || ''}}`.trim())
                    .filter(Boolean)
            })),
            inputs: (Array.isArray(definitions.inputs) ? definitions.inputs : []).map(input => ({
                name: input?.text || input?.id || '',
                type: input?.type || ''
            }))
        };
    } catch {
        return null;
    }
}

/**
 * Maps a prompt filter type to a readable operator.
 * @param {string} filterType
 * @returns {string}
 * @private
 */
function _filterOperator(filterType) {
    switch (filterType) {
        case 'equal': return '=';
        case 'notEqual': return '≠';
        case 'contains': return 'contains';
        default: return filterType || '=';
    }
}

/**
 * Parses `msdyn_aiconfiguration.msdyn_lasterrors` — the failure record AI Builder writes when a
 * training or publish iteration fails. The API sends `message: null` for platform-side failures, so
 * the code is used as the message in that case.
 * @param {string} lastErrors - The raw `msdyn_lasterrors` JSON.
 * @returns {AiConfigError|null} The parsed error, or null when there is none.
 */
export function parseAiConfigErrors(lastErrors) {
    try {
        const parsed = JSON.parse(lastErrors);
        const overall = parsed?.overallError || parsed;
        if (!overall?.code && !overall?.message) {
            return null;
        }
        return {
            code: overall.code || '',
            message: overall.message || overall.code || '',
            type: overall.type || '',
            dateTime: overall.dateTime || '',
            innerErrors: (Array.isArray(overall.innerErrors) ? overall.innerErrors : [])
                .map(e => e?.message || e?.code || '')
                .filter(Boolean)
        };
    } catch {
        return null;
    }
}

/**
 * @typedef {object} DataBindingSummary
 * @property {string} entity - Logical name of the table the model reads.
 * @property {string} labelAttribute - The column being predicted, when the binding names one.
 * @property {string} labelDataType - Data type of the predicted column.
 * @property {number} attributeCount - Number of bound columns (features).
 * @property {Array<{schemaName: string, role: string}>} columns - The bound columns: each Dataverse
 *   column and the model role it fills (`Label`, `text`, `tags`, `id`, …; '' when unspecified).
 * @property {number} relatedSelected - Related entities actually included.
 * @property {number} relatedTotal - Related entities offered by the binding.
 * @property {string} query - The FetchXML the binding runs, when it defines one.
 */

/**
 * Summarizes `msdyn_aiconfiguration.msdyn_databinding` — the table, predicted column and feature
 * set a model is bound to. The raw JSON runs to tens of kilobytes for a table like `systemuser`,
 * so the summary is what makes it readable.
 * @param {string} databinding - The raw `msdyn_databinding` JSON.
 * @returns {DataBindingSummary|null} The summary, or null when the payload is not a binding.
 */
export function summarizeDataBinding(databinding) {
    try {
        const input = JSON.parse(databinding)?.input;
        if (!input?.schemaName) {
            return null;
        }
        const attributes = Array.isArray(input.attributes) ? input.attributes : [];
        const label = attributes.find(a => a?.specificationName === 'Label');
        const related = Array.isArray(input.relatedEntities) ? input.relatedEntities : [];
        const query = Object.values(input.queries || {})
            .map(q => q?.query || '')
            .find(q => q.trim()) || '';
        return {
            entity: input.schemaName,
            labelAttribute: label?.schemaName || '',
            labelDataType: label?.dataType || '',
            attributeCount: attributes.length,
            columns: attributes
                .map(a => ({ schemaName: a?.schemaName || '', role: a?.specificationName || '' }))
                .filter(a => a.schemaName),
            relatedSelected: related.filter(r => r?.isSelected).length,
            relatedTotal: related.length,
            query
        };
    } catch {
        return null;
    }
}

/**
 * Derives a classifier's **run** (prediction) data-binding for a first publish, from its training
 * binding. The prediction reads the same table but drops the label (`tags`) attribute it was trained
 * on, and writes to the model's results table `new_tc_<modelId>` (fixed `new_tags` / `new_confidence_Level`
 * columns) — mirroring the payload the maker portal's first Publish sends. Pure; returns '' when the
 * training binding can't be parsed. (A republish clones the existing run config instead.)
 * @param {string} modelId - The msdyn_aimodel GUID.
 * @param {string} trainingDatabinding - The training config's `msdyn_databinding` JSON.
 * @returns {string} The derived run data-binding JSON, or '' when it can't be built.
 * @private
 */
function _deriveRunDatabinding(modelId, trainingDatabinding) {
    let input;
    try {
        input = JSON.parse(trainingDatabinding)?.input;
    } catch {
        return '';
    }
    if (!input?.schemaName) {
        return '';
    }
    // Prediction input = training input minus the label the model was trained to predict.
    const attributes = (Array.isArray(input.attributes) ? input.attributes : [])
        .filter(attribute => attribute?.specificationName !== 'tags' && attribute?.specificationName !== 'Label');
    return JSON.stringify({
        schemaVersion: 2,
        input: { schemaName: input.schemaName, attributes },
        output: {
            relatedEntities: [{
                specificationName: 'results',
                schemaName: `new_tc_${String(modelId).replace(/-/g, '_')}`,
                attributes: [
                    { schemaName: 'new_tags', specificationName: 'type' },
                    { schemaName: 'new_confidence_Level', specificationName: 'score' }
                ]
            }]
        }
    });
}

/**
 * @typedef {object} PerfMetric
 * @property {string} name - Raw metric name (e.g. `weightedF1`, `precision`).
 * @property {number} value - Raw numeric value.
 * @property {string} type - Dataverse metric type (`Percentage`, `Numerical`, …).
 * @property {string} display - Display-formatted value (`94.7%`, `112`).
 * @property {number|null} pct - The 0–100 percentage (for colouring), or null when not a percentage.
 */

/**
 * @typedef {object} PerfCategory
 * @property {string} category - The dimension the metrics group by (e.g. `tag`), '' when absent.
 * @property {PerfMetric[]} metrics - The category's metrics.
 */

/**
 * @typedef {object} ModelPerformance
 * @property {PerfMetric[]} headline - Global scores (weighted / macro F1, accuracy).
 * @property {PerfCategory[]} categories - Per-category metric groups.
 */

/**
 * Parses a trained model's `msdyn_modelperformance` JSON into normalized, display-formatted metrics.
 * The payload carries a top-level `metrics` array (the global scores) and a `details` array of
 * per-category groups, each with its own `metrics`. Values are formatted by their Dataverse `type`:
 * a `Percentage` is a 0–1 fraction shown as a percent, a `Numerical` is shown as-is. Distribution
 * entries (whose value is an object, not a number) are dropped — they belong in the raw JSON. Pure.
 * @param {string|object} content - The raw `msdyn_modelperformance` JSON.
 * @returns {ModelPerformance|null} The normalized performance, or null when absent/unparseable.
 */
export function parseModelPerformance(content) {
    let parsed;
    try {
        parsed = typeof content === 'string' ? JSON.parse(content) : content;
    } catch {
        return null;
    }
    const headline = _mapPerfMetrics(parsed?.metrics);
    const categories = (Array.isArray(parsed?.details) ? parsed.details : [])
        .map(detail => ({ category: _str(detail?.category), metrics: _mapPerfMetrics(detail?.metrics) }))
        .filter(category => category.metrics.length);
    if (!headline.length && !categories.length) {
        return null;
    }
    return { headline, categories };
}

/**
 * Maps a raw performance `metrics` array to normalized, display-formatted metrics, dropping entries
 * whose value is not a single number (the distribution dictionaries).
 * @param {Array} metrics
 * @returns {PerfMetric[]}
 * @private
 */
function _mapPerfMetrics(metrics) {
    if (!Array.isArray(metrics)) {
        return [];
    }
    return metrics
        .filter(metric => metric && typeof metric.name === 'string' && typeof metric.value === 'number')
        .map(_mapPerfMetric);
}

/**
 * Normalizes and formats one performance metric.
 * @param {{name: string, value: number, type: string}} metric
 * @returns {PerfMetric}
 * @private
 */
function _mapPerfMetric(metric) {
    const type = _str(metric.type);
    const value = metric.value;
    const isPct = type === 'Percentage';
    // A Percentage is a 0–1 fraction; guard the rare 0–100 form so it isn't multiplied twice.
    const pct = isPct ? (value <= 1 ? value * 100 : value) : null;
    const display = isPct
        ? `${_roundTo(pct, 1)}%`
        : (Number.isInteger(value) ? String(value) : String(_roundTo(value, 2)));
    return { name: metric.name, value, type, display, pct };
}

/**
 * Rounds a number to the given number of decimal places.
 * @param {number} value
 * @param {number} places
 * @returns {number}
 * @private
 */
function _roundTo(value, places) {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
}

/**
 * Removes the editor-only fields the maker portal strips before running a test.
 *
 * `quickTestValue` is the saved **Sample data** for an input: it belongs to the authoring
 * experience, and sending it would put a stray sample into the configuration the code generator
 * reasons about. `type: "text"` is likewise absent from the portal's request — text is the default,
 * and the observed payload is the contract being matched here.
 * @param {object} config - The parsed configuration, mutated in place.
 * @private
 */
function _stripTestOnlyMetadata(config) {
    const inputs = config?.definitions?.inputs;
    if (!Array.isArray(inputs)) {
        return;
    }
    inputs.forEach(input => {
        delete input.quickTestValue;
        if (input.type === 'text') {
            delete input.type;
        }
    });
}

/**
 * Shapes one QuickTest input value the way the maker portal sends it.
 *
 * A text input travels as a plain string. A file input travels **inline** as an expando carrying
 * only `base64Encoded` — no file name and no mime type, which the service infers from the bytes.
 * (The generated Python reads files via `read_multiple_files_from_input(input, RequestId, …)`, but
 * that is server-side plumbing: nothing is uploaded separately.)
 * @param {string|{base64Encoded: string}} value - A text value, or a file's base64 contents.
 * @returns {string|object} The value as the request expects it.
 * @private
 */
function _quickTestInputValue(value) {
    if (value && typeof value === 'object' && typeof value.base64Encoded === 'string') {
        return { '@odata.type': EXPANDO, base64Encoded: value.base64Encoded };
    }
    return value;
}

/**
 * Annotates a plain value with the `@odata.type` markers Dataverse requires for an open ("expando")
 * type. Every object is tagged, and every array gets a sibling `<key>@odata.type` naming its element
 * type — the annotation must precede its value, which is why keys are written in that order.
 *
 * Empty strings and empty arrays are dropped: AI Builder omits them from the request it sends, and
 * matching that payload exactly is safer than guessing what the service tolerates. `null` is kept
 * (the observed request sends `runtime: null`).
 * @param {*} value - Parsed JSON value.
 * @returns {*} The annotated value.
 */
export function toExpando(value) {
    if (Array.isArray(value)) {
        return value.map(toExpando);
    }
    if (!value || typeof value !== 'object') {
        return value;
    }
    const out = { '@odata.type': EXPANDO };
    for (const [key, raw] of Object.entries(value)) {
        if (raw === '' || (Array.isArray(raw) && raw.length === 0)) {
            continue;
        }
        if (Array.isArray(raw)) {
            const holdsObjects = raw.some(item => item && typeof item === 'object');
            out[`${key}@odata.type`] = holdsObjects ? `#Collection(${EXPANDO.slice(1)})` : '#Collection(String)';
        }
        out[key] = toExpando(raw);
    }
    return out;
}

/**
 * @typedef {object} QuickTestResult
 * @property {string} status - `operationStatus` (e.g. `Success`).
 * @property {boolean} succeeded - True when the run completed successfully.
 * @property {string} text - The generated output.
 * @property {string} mimeType - The output's media type (e.g. `text/markdown`).
 * @property {string} modelName - The exact LLM build that answered (e.g. `gpt-41-2025-04-14`).
 * @property {string} finishReason - Why generation stopped (e.g. `stop`).
 * @property {number|null} totalTokens - Total tokens consumed.
 * @property {number|null} promptTokens - Tokens spent on the prompt.
 * @property {number|null} completionTokens - Tokens spent on the completion.
 * @property {number|null} credits - AI Builder credits charged.
 * @property {number|null} copilotCredits - Copilot credits charged.
 * @property {string} thoughtSteps - Reasoning trace (reasoning models).
 * @property {string} code - Generated Python (code-interpreter runtime).
 * @property {string} signature - Signature of the generated code (to re-run without regenerating).
 * @property {string} logs - Execution logs (code-interpreter runtime).
 * @property {string} planning - The interpreter's plan (`codeThinking.PlanningOutput`).
 * @property {string} promptFixes - Suggested prompt fixes (`codeThinking.PromptFixes`).
 * @property {string} dataUsed - Grounding records the run read (JSON string).
 * @property {string} error - Error message when the run failed.
 */

/**
 * Parses a `QuickTest` response. The useful payload sits under `responsev2.predictionOutput`;
 * `response` (v1) is null for prompt runs. Which fields are present depends on the runtime — a
 * reasoning model returns `modelName` and token counts, while the code interpreter returns the
 * generated `code`, execution `logs` and its planning trace instead — so every field is optional.
 * @param {object} response - The raw action response.
 * @returns {QuickTestResult}
 */
export function parseQuickTestResult(response) {
    const result = response?.responsev2 || {};
    const output = result.predictionOutput || {};
    const thinking = output.codeThinking || {};
    const dataUsed = _str(output.dataUsed);
    return {
        status: _str(result.operationStatus),
        succeeded: result.operationStatus === 'Success',
        text: _str(output.text),
        mimeType: _firstString(output.mimetype, output.textMimeType),
        modelName: _str(output.modelName),
        modelType: _str(output.modelType),
        finishReason: _str(output.finishReason),
        totalTokens: _numOrNull(output.totalTokens),
        promptTokens: _numOrNull(output.promptTokens),
        completionTokens: _numOrNull(output.completionTokens),
        credits: _numOrNull(output.costAsAiBuilderCredits),
        copilotCredits: _numOrNull(output.costAsCopilotCredits),
        thoughtSteps: _str(output.thoughtSteps),
        code: _str(output.code),
        // Carried so a follow-up run can reuse this exact code without regenerating it.
        signature: _str(output.signature),
        logs: _str(output.logs),
        planning: _str(thinking.PlanningOutput),
        promptFixes: _str(thinking.PromptFixes),
        // "[]" means nothing was read — treat that as empty so the UI can hide the section.
        dataUsed: dataUsed.trim() === '[]' ? '' : dataUsed,
        error: _firstString(result.error?.message, result.error?.code)
    };
}

/**
 * One thing a model predicted — a category with its confidence, or a named field with its value.
 * @typedef {object} ModelPrediction
 * @property {string} label - The category, tag or field name.
 * @property {number|null} score - Confidence 0–1, when the model reported one.
 * @property {string} value - The extracted value, for field-style outputs ('' otherwise).
 */

/**
 * @typedef {object} ModelTestResult
 * @property {string} status - `operationStatus` (e.g. `Success`).
 * @property {boolean} succeeded - True when the run completed successfully.
 * @property {ModelPrediction[]} predictions - What the model returned (empty when it returned none).
 * @property {'scores'|'labels'|'other'|'none'} shape - Which documented output shape was recognized;
 *   `other` means the payload didn't match one, and `raw` carries it verbatim.
 * @property {string} raw - The prediction output as JSON, for the `other` shape.
 * @property {string} predictionId - The prediction's id, useful for correlating with the Runs list.
 * @property {number|null} credits - AI Builder credits charged.
 * @property {number|null} copilotCredits - Copilot credits charged.
 * @property {string} error - Error message when the run failed.
 */

/**
 * Parses a `QuickTest` response. The action is documented generically — "Uses AI to make a
 * prediction" — and `predictionOutput` is an untyped expando whose shape depends on the model:
 *
 * - **scores** — `results[]` of `{type, score}`. Category classification and object detection.
 *   An empty array is a real answer: the model matched nothing.
 * - **labels** — `labels{}` keyed by field name, each `{value, confidence}`. Document processing;
 *   the documented Power Automate accessor is `predictionOutput/labels/<Name>/value`.
 * - **other** — anything else is kept verbatim rather than reported as "nothing found", so a model
 *   type this parser hasn't met still shows what it actually returned.
 *
 * Pure. Predictions come back highest-confidence first.
 * @param {object} response - The raw action response.
 * @returns {ModelTestResult}
 */
export function parseModelTestResult(response) {
    const result = response?.responsev2 || {};
    const output = result.predictionOutput || {};
    const { predictions, shape } = _parsePredictionOutput(output);

    return {
        status: _str(result.operationStatus),
        succeeded: result.operationStatus === 'Success',
        predictions,
        shape,
        // Only carried for an unrecognized payload — there is nothing to fall back to otherwise.
        raw: shape === 'other' ? _safeJson(output) : '',
        predictionId: _str(result.predictionId),
        credits: _numOrNull(output.costAsAiBuilderCredits),
        copilotCredits: _numOrNull(output.costAsCopilotCredits),
        error: _firstString(result.error?.message, result.error?.code)
    };
}

/**
 * Reads whichever documented prediction shape the payload uses.
 * @param {object} output - `responsev2.predictionOutput`.
 * @returns {{predictions: ModelPrediction[], shape: 'scores'|'labels'|'other'|'none'}}
 * @private
 */
function _parsePredictionOutput(output) {
    if (Array.isArray(output.results)) {
        const predictions = output.results
            .filter(entry => entry && (typeof entry.score === 'number' || entry.type !== undefined))
            .map(entry => ({
                label: _classifierTagLabel(entry.type),
                score: _numOrNull(entry.score),
                value: ''
            }))
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        return { predictions, shape: 'scores' };
    }

    if (output.labels && typeof output.labels === 'object') {
        const predictions = Object.entries(output.labels)
            // The expando carries `@odata.type` annotation keys alongside the real fields.
            .filter(([key]) => !key.includes('@'))
            .map(([label, field]) => ({
                label,
                score: _numOrNull(field?.confidence),
                value: _str(field?.value ?? field)
            }));
        return { predictions, shape: 'labels' };
    }

    // An empty expando (just the @odata.type annotation and the cost fields) is "nothing returned";
    // anything with real content we don't recognize is handed back raw.
    const meaningful = Object.keys(output).filter(key => !key.includes('@')
        && key !== 'costAsAiBuilderCredits' && key !== 'costAsCopilotCredits');
    return { predictions: [], shape: meaningful.length ? 'other' : 'none' };
}

/**
 * Serializes a value to readable JSON, falling back to its string form.
 * @param {any} value - The value.
 * @returns {string} JSON text.
 * @private
 */
function _safeJson(value) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return _str(value);
    }
}

/**
 * Derives a readable tag label from a classifier result's `type`. Most classifiers report the tag
 * name directly; some encode it as a JSON object, so a name-ish field is preferred when the value
 * parses as JSON. Pure.
 * @param {string} type
 * @returns {string}
 * @private
 */
function _classifierTagLabel(type) {
    const raw = _str(type);
    if (raw.startsWith('{')) {
        try {
            const parsed = JSON.parse(raw);
            return _str(parsed.BotName || parsed.name || parsed.displayName || parsed.label) || raw;
        } catch {
            return raw;
        }
    }
    return raw;
}

/**
 * Coerces a value to a string, mapping nullish to ''.
 * @param {*} value
 * @returns {string}
 * @private
 */
function _str(value) {
    if (typeof value === 'string') {
        return value;
    }
    return value === null || value === undefined ? '' : String(value);
}

/**
 * Returns the first non-empty string among its arguments, or ''.
 * @param {...*} values
 * @returns {string}
 * @private
 */
function _firstString(...values) {
    const found = values.find(v => typeof v === 'string' && v);
    return found || '';
}

/**
 * Parses a `Train` response. The action returns its status as a JSON *string* in `response`.
 * @param {object} response - The raw action response.
 * @returns {{status: string, error: string}}
 */
export function parseTrainResponse(response) {
    try {
        const parsed = JSON.parse(response?.response ?? '');
        return {
            status: parsed?.operationStatus || '',
            error: parsed?.error?.message || parsed?.error?.code || ''
        };
    } catch {
        return { status: '', error: '' };
    }
}

/**
 * @typedef {object} ModelStatus
 * @property {'live'|'failed'|'published'|'draft'|''} state - Coarse state, for badge styling.
 * @property {string} status - The configuration's status label (empty when unknown).
 * @property {string} configId - The configuration the status came from.
 * @property {string} version - That configuration's `major.minor` version.
 */

/**
 * Summarizes a model's headline status from its configurations: the newest run configuration, or
 * the newest training configuration when the model has never produced one. Reports `live` when that
 * configuration is the model's published run configuration.
 * @param {Array<object>} configurations - Raw expanded `msdyn_aiconfiguration` records.
 * @param {string} [activeConfigId] - The model's `_msdyn_activerunconfigurationid_value`.
 * @returns {ModelStatus}
 */
export function summarizeModelStatus(configurations, activeConfigId = '') {
    const configs = (Array.isArray(configurations) ? configurations : []).filter(Boolean);
    if (!configs.length) {
        return { state: '', status: '', configId: '', version: '' };
    }
    const byVersion = [...configs].sort((a, b) =>
        (b.msdyn_majoriterationnumber || 0) - (a.msdyn_majoriterationnumber || 0)
        || (b.msdyn_minoriterationnumber || 0) - (a.msdyn_minoriterationnumber || 0));
    const latest = byVersion.find(c => c.msdyn_type === AI_CONFIG_TYPE_RUN)
        || byVersion.find(c => c.msdyn_type === AI_CONFIG_TYPE_TRAINING)
        || byVersion[0];

    const configId = latest.msdyn_aiconfigurationid || '';
    const version = `${latest.msdyn_majoriterationnumber || 0}.${latest.msdyn_minoriterationnumber || 0}`;
    const status = AI_CONFIG_STATUS_LABELS[latest.statuscode] || '';
    let state = 'draft';
    if (activeConfigId && configId === activeConfigId) {
        state = 'live';
    } else if (latest.statecode === AI_CONFIG_STATE_FAILED) {
        state = 'failed';
    } else if (latest.statuscode === AI_CONFIG_STATUS_PUBLISHED) {
        state = 'published';
    }
    return { state, status, configId, version };
}

/**
 * Merges edited prompt settings back into a GptDynamicPrompt configuration, preserving every field
 * the editor does not own (the prompt segments, definitions, `code` and `signature`).
 * @param {string} configText - The current `msdyn_customconfiguration` JSON.
 * @param {{temperature: number, recordRetrievalLimit: number, preserveRecordLinks: boolean, codeInterpreter: boolean, contentModerationLevel: string}} settings
 * @returns {string} The updated configuration JSON.
 * @throws {SyntaxError} When the configuration is not valid JSON.
 */
export function applyPromptSettings(configText, settings) {
    const parsed = JSON.parse(configText);
    return JSON.stringify({
        ...parsed,
        modelParameters: {
            ...(parsed.modelParameters || {}),
            gptParameters: {
                ...(parsed.modelParameters?.gptParameters || {}),
                temperature: settings.temperature
            }
        },
        settings: {
            ...(parsed.settings || {}),
            recordRetrievalLimit: settings.recordRetrievalLimit,
            shouldPreserveRecordLinks: settings.preserveRecordLinks,
            // AI Builder stores the code-interpreter toggle as a runtime name, not a boolean.
            runtime: settings.codeInterpreter ? 'codeinterpreter' : null,
            contentModerationLevel: settings.contentModerationLevel
        }
    });
}

/**
 * Returns true when an AI Builder template produces GPT prompts rather than trained/prebuilt
 * models. Prompts open under a different, solution-scoped route in the maker portal.
 * @param {string} uniqueName - The invariant `msdyn_aitemplate.msdyn_uniquename` value.
 * @returns {boolean}
 */
export function isPromptTemplate(uniqueName) {
    return PROMPT_TEMPLATE_NAMES.has(uniqueName);
}

/**
 * Classifies an AI Builder template into the family the maker portal treats it as. Classification
 * uses the invariant `msdyn_uniquename`, never the template lookup's formatted value — that is a
 * localizable display name and breaks on non-English organizations.
 * @param {string} uniqueName - The `msdyn_aitemplate.msdyn_uniquename` value.
 * @param {string} [resourceInfo] - The template's `msdyn_resourceinfo` JSON.
 * @returns {{kind: 'prompt'|'prebuilt'|'custom', label: string}}
 */
export function classifyAiTemplate(uniqueName, resourceInfo = '') {
    if (PROMPT_TEMPLATE_NAMES.has(uniqueName)) {
        return { kind: 'prompt', label: 'Prompt' };
    }
    // `ModelStorageType` is the discriminator, not `ResourceType`: a trainable template stores a
    // per-model artifact ("Value" inline, "Reference" out-of-band), while a prebuilt template
    // stores nothing ("None") because every model shares one hosted Azure AI service. Several
    // trainable templates (DocumentScanning, TextClassificationV2) are `CognitiveService`, so
    // classifying on ResourceType alone mislabels them as prebuilt.
    let info = {};
    try {
        info = JSON.parse(resourceInfo) || {};
    } catch {
        info = {};
    }
    const storesModel = info.ModelStorageType === 'Value' || info.ModelStorageType === 'Reference';
    const isTrainable = storesModel || info.ResourceType === 'PythonVirtualEnvironment';
    return isTrainable
        ? { kind: 'custom', label: 'Custom model' }
        : { kind: 'prebuilt', label: 'Prebuilt model' };
}

/**
 * Decompresses a payload column when AI Builder stored it gzip+base64 encoded (some
 * `msdyn_modelrundataspecification` values are). Returns the value untouched when it is plain text
 * or cannot be decoded, so a decoding failure never hides the column.
 * @param {string} text - The raw column value.
 * @returns {Promise<{text: string, compressed: boolean}>}
 */
export async function decodeMaybeGzip(text) {
    const value = String(text || '');
    const canDecompress = typeof DecompressionStream !== 'undefined'
        && typeof Response !== 'undefined'
        && typeof atob !== 'undefined';
    if (!value.trim().startsWith(GZIP_BASE64_PREFIX) || !canDecompress) {
        return { text: value, compressed: false };
    }
    try {
        const binary = atob(value.trim());
        const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
        const stream = new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'));
        return { text: await new Response(stream).text(), compressed: true };
    } catch {
        return { text: value, compressed: false };
    }
}

/**
 * @typedef {object} EvaluationGraderLabel
 * @property {string} name - Label name (e.g. "Invoice").
 * @property {string} description - Label description (e.g. "IN5").
 * @property {string} outcome - Expected outcome ("Pass" / "Fail").
 */

/**
 * @typedef {object} EvaluationGrader
 * @property {string} kind - Grader kind (e.g. "PromptGrader").
 * @property {string} name - Grader display name.
 * @property {string} instructions - The grading prompt/instructions.
 * @property {EvaluationGraderLabel[]} labels - The outcome labels the grader assigns.
 */

/**
 * Parses a Copilot Studio evaluation test set (a Test Case component's `data` — an `EvaluationSet`
 * in YAML) into its graders and their labels. Only the test-set DEFINITION lives in Dataverse
 * (same-origin); the run results/scores are served by the cross-origin Copilot Studio service.
 * Line-based (no YAML dependency), matching the codebase's other component-data parsing. Single-line
 * scalar values only, which is what Copilot Studio emits for these fields.
 * @param {string} data - The component `data` payload.
 * @returns {{graders: EvaluationGrader[]}|null} Parsed graders, or null when not an EvaluationSet.
 */
export function parseEvaluationSet(data) {
    const text = String(data || '');
    if (!/^\s*kind:\s*EvaluationSet/im.test(text) && !/^\s*graders:/m.test(text)) {
        return null;
    }

    const graders = [];
    let grader = null;
    let label = null;
    let inLabels = false;
    let labelIndent = null;

    const splitKV = (s) => {
        const i = s.indexOf(':');
        return i === -1 ? null : { key: s.slice(0, i).trim().toLowerCase(), value: s.slice(i + 1).trim() };
    };
    const assign = (kv) => {
        if (!kv) {
            return;
        }
        if (label) {
            if (['name', 'description', 'outcome'].includes(kv.key)) {
                label[kv.key] = kv.value;
            }
        } else if (grader) {
            if (['kind', 'name', 'instructions'].includes(kv.key)) {
                grader[kv.key] = kv.value;
            }
        }
    };

    for (const raw of text.split(/\r?\n/)) {
        if (!raw.trim()) {
            continue;
        }
        const indent = raw.length - raw.trimStart().length;
        let content = raw.trim();
        const isItem = content.startsWith('- ');
        if (isItem) {
            content = content.slice(2).trim();
        }

        if (isItem) {
            if (inLabels && (labelIndent === null || indent >= labelIndent)) {
                labelIndent = labelIndent === null ? indent : labelIndent;
                label = { name: '', description: '', outcome: '' };
                grader?.labels.push(label);
            } else {
                grader = { kind: '', name: '', instructions: '', labels: [] };
                graders.push(grader);
                inLabels = false;
                labelIndent = null;
                label = null;
            }
            assign(splitKV(content));
            continue;
        }

        if (/^labels:/i.test(content)) {
            inLabels = true;
            labelIndent = null;
            label = null;
            continue;
        }
        assign(splitKV(content));
    }

    return graders.length ? { graders } : null;
}

/**
 * @typedef {object} EvaluationCaseTurn
 * @property {string} role - The speaker ("user" or "agent").
 * @property {string} text - The turn text.
 */

/**
 * Parses a Copilot Studio evaluation *test case* (a Test Case component's `data` — a
 * `MultiTurnEvaluationCase` in YAML) into its ordered conversation turns. Each activity carries a
 * `from.role` and a `text` list; this pairs each role with its first text line. Line/regex-based
 * (no YAML dependency), matching the codebase's other component-data parsing.
 * @param {string} data - The component `data` payload.
 * @returns {{turns: EvaluationCaseTurn[]}|null} The turns, or null when not an evaluation case.
 */
export function parseEvaluationCase(data) {
    const text = String(data || '');
    if (!/^\s*kind:\s*\w*EvaluationCase\b/im.test(text)) {
        return null;
    }
    const turns = [];
    const re = /role:\s*(\w+)[\s\S]*?text:[\s\S]*?-\s*([^\n\r]+)/g;
    let match;
    while ((match = re.exec(text)) !== null) {
        turns.push({ role: match[1].trim(), text: match[2].trim() });
    }
    return turns.length ? { turns } : null;
}

/**
 * @typedef {object} TranscriptTurn
 * @property {'user'|'agent'} role - The speaker.
 * @property {string} text - The message text.
 */

/**
 * Parses a conversation transcript's `content` JSON into its ordered message turns. The content is
 * a Bot Framework activity log; `message` activities carry the visible conversation. Copilot Studio
 * writes `from.role` as a number (0 = agent, 1 = user — per the transcript reference), while the
 * raw Bot Framework schema uses the strings 'user'/'bot'; both are handled. Pure.
 * @param {string|object|null} content - The conversationtranscript `content` column.
 * @returns {{turns: TranscriptTurn[]}|null} The turns, or null when no readable messages exist.
 */
export function parseTranscriptConversation(content) {
    let parsed;
    try {
        parsed = typeof content === 'string' ? JSON.parse(content) : content;
    } catch {
        return null;
    }
    const activities = Array.isArray(parsed?.activities) ? parsed.activities : [];
    const turns = activities
        .filter(a => a?.type === 'message' && typeof a.text === 'string' && a.text.trim())
        .map(a => ({ role: _normalizeTranscriptRole(a.from?.role), text: a.text.trim() }));
    return turns.length ? { turns } : null;
}

/**
 * Normalizes a transcript activity's `from.role` to 'user' or 'agent'.
 * Copilot Studio writes 0 (agent) / 1 (user); the Bot Framework schema uses 'bot'/'user'.
 * @param {number|string|undefined} role
 * @returns {'user'|'agent'}
 * @private
 */
function _normalizeTranscriptRole(role) {
    return role === 1 || String(role).toLowerCase() === 'user' ? 'user' : 'agent';
}

/**
 * @typedef {object} TranscriptSession
 * @property {string} type - The raw session type (`engaged` / `unengaged`), '' when absent.
 * @property {boolean} engaged - True when the session reached an engaged state (the user entered a
 *   custom or Escalate topic); false for an unengaged session (opened but no real interaction).
 * @property {string} outcome - Session outcome: `Resolved`, `Escalated`, `Abandoned`, or `None`
 *   (unengaged sessions are always `None`); '' when absent.
 * @property {string} outcomeReason - Extra detail on the outcome (e.g. `NoError`).
 * @property {number|null} turnCount - Total turns (each a user message or one agent response).
 * @property {boolean|null} impliedSuccess - For a resolved session: true when resolved by the agent's
 *   own logic (no user confirmation), false when the user confirmed success; null when not applicable.
 * @property {string} startTime - Session start time (ISO), when present.
 * @property {string} endTime - Session end time (ISO), when present.
 * @property {boolean} isDesignMode - True when the conversation came from the Copilot Studio test pane.
 * @property {string} locale - The conversation locale, when present.
 */

/**
 * Parses a transcript's session-level metadata from its `SessionInfo` and `ConversationInfo` trace
 * activities — the engagement state, outcome, turn count and whether it was a test-pane conversation.
 * These summarize a session that the message turns alone don't explain (an unengaged session carries
 * no messages at all). Field names and values follow the Copilot Studio conversation-transcript
 * reference. Pure.
 * @param {string|object|null} content - The conversationtranscript `content` column.
 * @returns {TranscriptSession|null} The session metadata, or null when neither trace is present.
 */
export function parseTranscriptSession(content) {
    let parsed;
    try {
        parsed = typeof content === 'string' ? JSON.parse(content) : content;
    } catch {
        return null;
    }
    const activities = Array.isArray(parsed?.activities) ? parsed.activities : [];
    const session = activities.find(a => a?.valueType === 'SessionInfo')?.value;
    const conversation = activities.find(a => a?.valueType === 'ConversationInfo')?.value;
    if (!session && !conversation) {
        return null;
    }
    const type = _str(session?.type);
    return {
        type,
        engaged: type.toLowerCase() === 'engaged',
        outcome: _str(session?.outcome),
        outcomeReason: _str(session?.outcomeReason),
        turnCount: _numOrNull(session?.turnCount),
        impliedSuccess: typeof session?.impliedSuccess === 'boolean' ? session.impliedSuccess : null,
        startTime: _str(session?.startTimeUtc),
        endTime: _str(session?.endTimeUtc),
        isDesignMode: conversation?.isDesignMode === true,
        locale: _str(conversation?.locale)
    };
}

/**
 * Counts an agent's components that have changed since it was last published — i.e. its unpublished
 * authoring changes. When the agent was never published (`publishedOnRaw` empty), every component
 * counts as unpublished. Pure.
 * @param {Array<{modifiedOnRaw?: string}>} components - The agent's components.
 * @param {string} publishedOnRaw - The bot's raw ISO `publishedon`, or '' when never published.
 * @returns {number} The count of components modified after the last publish.
 */
export function countUnpublishedComponents(components, publishedOnRaw) {
    const list = Array.isArray(components) ? components : [];
    if (!publishedOnRaw) {
        return list.length;
    }
    const published = new Date(publishedOnRaw).getTime();
    if (Number.isNaN(published)) {
        return 0;
    }
    return list.filter(c => {
        const modified = c?.modifiedOnRaw ? new Date(c.modifiedOnRaw).getTime() : NaN;
        return !Number.isNaN(modified) && modified > published;
    }).length;
}

/**
 * Summarizes an agent's makeup as ordered per-kind counts (its "anatomy") — topics, tools, knowledge,
 * connected agents, triggers, tests, and other. Instructions (shown on the Overview) are excluded.
 * Pure; empty kinds are omitted.
 * @param {AgentComponent[]} components - The agent's components.
 * @returns {Array<{kind: string, count: number}>} Ordered non-empty kind counts.
 */
export function summarizeAgentComposition(components) {
    const order = ['topic', 'connectedAgent', 'action', 'knowledge', 'trigger', 'test', 'other'];
    const counts = {};
    (Array.isArray(components) ? components : []).forEach(c => {
        const kind = getComponentKind(c);
        if (kind === 'instructions') {
            return;
        }
        counts[kind] = (counts[kind] || 0) + 1;
    });
    return order.filter(kind => counts[kind]).map(kind => ({ kind, count: counts[kind] }));
}

/**
 * Parses the `msdyn_eventdata` JSON of an AI Builder event into a consumption/model summary.
 * @param {string} eventData - The raw msdyn_eventdata JSON string.
 * @returns {{featureName: string, units: number|null, consumption: number|null, llmModelName: string, consumptionSource: string, partnerSource: string}}
 */
export function parseAiEventData(eventData) {
    const empty = {
        featureName: '', units: null, consumption: null, llmModelName: '',
        consumptionSource: '', partnerSource: ''
    };
    try {
        const parsed = JSON.parse(eventData);
        const consumption = parsed?.messageConsumption || {};
        return {
            featureName: consumption.featureName || '',
            units: typeof consumption.units === 'number' ? consumption.units : null,
            consumption: typeof consumption.consumption === 'number' ? consumption.consumption : null,
            llmModelName: parsed?.llmModelName || '',
            consumptionSource: parsed?.consumptionSource || '',
            partnerSource: parsed?.partnerSource || ''
        };
    } catch {
        return empty;
    }
}

/**
 * Builds a short, single-line context snippet around the first occurrence of a term in a text.
 * @param {string} text - The text to extract from.
 * @param {string} term - The search term.
 * @param {number} [radius=70] - Characters of context to include on each side.
 * @returns {string} The snippet (with ellipses), or an empty string if the term is not found.
 */
export function buildSnippet(text, term, radius = 70) {
    const haystack = String(text || '');
    const index = haystack.toLowerCase().indexOf(String(term || '').toLowerCase());
    if (index === -1) {
        return '';
    }
    const start = Math.max(0, index - radius);
    const end = Math.min(haystack.length, index + term.length + radius);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < haystack.length ? '…' : '';
    return `${prefix}${haystack.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
}

/**
 * Maps a raw Dataverse botcomponent search hit to a SearchMatch object.
 * @param {object} component - The raw entity record.
 * @param {string} snippet - The instruction snippet (when matched in the body).
 * @returns {SearchMatch}
 * @private
 */
function _mapSearchMatch(component, snippet) {
    return {
        id: component.botcomponentid,
        name: component.name || '(unnamed component)',
        schemaName: component.schemaname || '',
        componentType: component.componenttype,
        componentTypeLabel: component[`componenttype${FV}`]
            || COMPONENT_TYPE_LABELS[component.componenttype]
            || 'Component',
        parentBotId: component._parentbotid_value || '',
        snippet: snippet || component.description || ''
    };
}

/**
 * Summarizes a list of conversation transcript records into agent session analytics. Pure function:
 * counts recent-window sessions, groups by channel (schematype), and builds a 14-day daily series.
 * @param {Array<{createdon?: string, schematype?: string}>} records - Transcript metadata records.
 * @param {number} [sampleSize=500] - The cap used when fetching (to flag truncation).
 * @returns {AgentUsage}
 */
export function summarizeAgentUsage(records, sampleSize = 500) {
    const list = Array.isArray(records) ? records : [];
    const now = Date.now();
    const DAY = 86400000;
    let last7 = 0;
    let last30 = 0;
    const channelMap = new Map();
    const dailyMap = new Map();

    list.forEach(record => {
        const created = record?.createdon ? new Date(record.createdon).getTime() : NaN;
        if (!Number.isNaN(created)) {
            const ageDays = (now - created) / DAY;
            if (ageDays <= 7) {
                last7 += 1;
            }
            if (ageDays <= 30) {
                last30 += 1;
            }
            if (ageDays <= 14) {
                const key = new Date(created).toISOString().slice(0, 10);
                dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
            }
        }
        const channel = record?.schematype || 'Unknown';
        channelMap.set(channel, (channelMap.get(channel) || 0) + 1);
    });

    const byChannel = [...channelMap.entries()]
        .map(([channel, count]) => ({ channel, count }))
        .sort((a, b) => b.count - a.count);

    const daily = [];
    for (let i = 13; i >= 0; i -= 1) {
        const key = new Date(now - i * DAY).toISOString().slice(0, 10);
        daily.push({ date: key, count: dailyMap.get(key) || 0 });
    }

    return { sampled: list.length, capped: list.length >= sampleSize, last7, last30, byChannel, daily };
}

/**
 * Maps a raw Dataverse bot entity to an Agent object.
 * @param {object} bot - The raw entity record.
 * @returns {Agent}
 * @private
 */
function _mapAgentEntity(bot) {
    return {
        id: bot.botid,
        name: bot.name || '(unnamed agent)',
        schemaName: bot.schemaname || '',
        statecode: bot.statecode,
        stateLabel: bot[`statecode${FV}`] || _getAgentStateLabel(bot.statecode),
        statusLabel: bot[`statuscode${FV}`] || '',
        isManaged: bot.ismanaged === true,
        owner: bot[`_ownerid_value${FV}`] || '',
        language: bot[`language${FV}`] || '',
        authMode: bot[`authenticationmode${FV}`] || '',
        createdOn: bot[`createdon${FV}`] || bot.createdon || '',
        modifiedOn: bot[`modifiedon${FV}`] || bot.modifiedon || '',
        publishedOn: bot[`publishedon${FV}`] || bot.publishedon || '',
        publishedOnRaw: bot.publishedon || '',
        publishedBy: bot[`_publishedby_value${FV}`] || '',
        template: bot.template || '',
        isModern: classifyAgentKind(bot.template).modern
    };
}

/**
 * @typedef {object} AgentFlow
 * @property {string} id - The workflow GUID.
 * @property {string} name - Display name of the agent flow.
 * @property {string} description - User-provided description.
 * @property {number} statecode - 0=Draft/Off, 1=Activated/On.
 * @property {string} stateLabel - Formatted state label.
 * @property {boolean} isManaged - Whether the flow is from a managed solution.
 * @property {string} owner - Owner display name.
 * @property {string} createdOn - Formatted creation date.
 * @property {string} modifiedOn - Formatted modification date.
 * @property {string} createdBy - Creator display name.
 */

/**
 * Maps a raw Dataverse workflow entity (Copilot Studio agent flow) to an AgentFlow object.
 * @param {object} flow - The raw workflow record.
 * @returns {AgentFlow}
 * @private
 */
function _mapAgentFlowEntity(flow) {
    return {
        id: flow.workflowid,
        name: flow.name || '(unnamed flow)',
        description: flow.description || '',
        statecode: flow.statecode,
        stateLabel: flow[`statecode${FV}`] || '',
        isManaged: flow.ismanaged === true,
        owner: flow[`_ownerid_value${FV}`] || '',
        createdOn: flow[`createdon${FV}`] || flow.createdon || '',
        modifiedOn: flow[`modifiedon${FV}`] || flow.modifiedon || '',
        createdBy: flow[`_createdby_value${FV}`] || ''
    };
}

/**
 * Maps a raw Dataverse botcomponent entity to an AgentComponent object.
 * @param {object} component - The raw entity record.
 * @returns {AgentComponent}
 * @private
 */
function _mapAgentComponentEntity(component) {
    return {
        id: component.botcomponentid,
        name: component.name || '(unnamed component)',
        schemaName: component.schemaname || '',
        componentType: component.componenttype,
        componentTypeLabel: component[`componenttype${FV}`]
            || COMPONENT_TYPE_LABELS[component.componenttype]
            || 'Component',
        description: component.description || '',
        content: component.content || '',
        data: component.data || '',
        isManaged: component.ismanaged === true,
        statecode: component.statecode,
        modifiedOn: component[`modifiedon${FV}`] || component.modifiedon || '',
        modifiedOnRaw: component.modifiedon || '',
        modifiedBy: component[`_modifiedby_value${FV}`] || ''
    };
}

/**
 * Maps a raw Dataverse conversationtranscript entity to a TranscriptSummary object.
 * @param {object} transcript - The raw entity record.
 * @returns {TranscriptSummary}
 * @private
 */
function _mapTranscriptEntity(transcript) {
    return {
        id: transcript.conversationtranscriptid,
        name: transcript.name || '(unnamed transcript)',
        schemaType: transcript.schematype || '',
        startTime: transcript[`conversationstarttime${FV}`] || transcript.conversationstarttime || '',
        createdOn: transcript[`createdon${FV}`] || transcript.createdon || '',
        content: transcript.content || ''
    };
}

/**
 * Maps a raw Dataverse msdyn_aimodel entity to an AiModel object.
 * @param {object} model - The raw entity record.
 * @returns {AiModel}
 * @private
 */
function _mapAiModelEntity(model) {
    const template = model.msdyn_TemplateId || {};
    const templateName = template.msdyn_uniquename || '';
    const { kind, label } = classifyAiTemplate(templateName, template.msdyn_resourceinfo);
    const activeConfigId = model._msdyn_activerunconfigurationid_value || '';
    return {
        configStatus: summarizeModelStatus(model.msdyn_aimodel_msdyn_aiconfiguration, activeConfigId),
        id: model.msdyn_aimodelid,
        name: model.msdyn_name || '(unnamed model)',
        statecode: model.statecode,
        stateLabel: model[`statecode${FV}`] || _getAiModelStateLabel(model.statecode),
        isManaged: model.ismanaged === true,
        owner: model[`_ownerid_value${FV}`] || '',
        // Prefer the invariant unique name; the lookup's formatted value is a localized fallback.
        template: templateName || model[`_msdyn_templateid_value${FV}`] || '',
        templateName,
        // Required by AIModelPublish when saving a prompt.
        templateId: template.msdyn_aitemplateid || model._msdyn_templateid_value || '',
        kind,
        kindLabel: label,
        activeConfigId,
        hasRetrain: Boolean(model._msdyn_retrainworkflowid_value),
        createdOn: model[`createdon${FV}`] || model.createdon || '',
        modifiedOn: model[`modifiedon${FV}`] || model.modifiedon || ''
    };
}

/**
 * Maps a raw Dataverse msdyn_aiconfiguration entity to an AiConfiguration object, splitting every
 * non-empty payload column into its own section (each one decompressed when needed).
 * @param {object} config - The raw entity record.
 * @param {string} activeConfigId - The parent model's published run configuration id.
 * @returns {Promise<AiConfiguration>}
 * @private
 */
async function _mapAiConfigurationEntity(config, activeConfigId) {
    const id = config.msdyn_aiconfigurationid;
    const isManaged = config.ismanaged === true;
    const sections = [];
    for (const { column, label } of CONFIG_PAYLOAD_COLUMNS) {
        const raw = config[column];
        if (!raw || !String(raw).trim()) {
            continue;
        }
        const { text, compressed } = await decodeMaybeGzip(raw);
        sections.push({
            column,
            label,
            text,
            language: _looksLikeJson(text) ? 'json' : 'text',
            // A compressed column round-trips through decode on read; saving plain text back would
            // corrupt it, so those stay read-only regardless of the column.
            editable: EDITABLE_CONFIG_COLUMNS.has(column) && !isManaged && !compressed,
            compressed
        });
    }

    const major = typeof config.msdyn_majoriterationnumber === 'number' ? config.msdyn_majoriterationnumber : 0;
    const minor = typeof config.msdyn_minoriterationnumber === 'number' ? config.msdyn_minoriterationnumber : 0;
    return {
        id,
        name: config.msdyn_name || '',
        type: config[`msdyn_type${FV}`] || '',
        typeCode: config.msdyn_type,
        version: `${major}.${minor}`,
        status: config[`statuscode${FV}`] || AI_CONFIG_STATUS_LABELS[config.statuscode] || '',
        statusCode: config.statuscode,
        stateCode: config.statecode,
        isActive: Boolean(activeConfigId) && activeConfigId === id,
        isFailed: config.statecode === AI_CONFIG_STATE_FAILED,
        lastError: parseAiConfigErrors(config.msdyn_lasterrors),
        lastRunOn: config[`msdyn_lasttrainorrundate${FV}`] || config.msdyn_lasttrainorrundate || '',
        sections
    };
}

/**
 * Generates a v4 GUID for a record the caller creates by id (AI Builder's publish action expects
 * the new run configuration's id in the request).
 * @returns {string}
 * @private
 */
function _newGuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Returns true when a string parses as a JSON object or array.
 * @param {string} value
 * @returns {boolean}
 * @private
 */
function _looksLikeJson(value) {
    const trimmed = String(value || '').trim();
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
 * Maps a raw Dataverse msdyn_aievent entity to an AiBuilderRun object.
 * @param {object} event - The raw entity record.
 * @returns {AiBuilderRun}
 * @private
 */
function _mapAiEventEntity(event) {
    const meta = parseAiEventData(event.msdyn_eventdata);
    // Credits are recorded in the dedicated `msdyn_creditconsumed` integer column. The
    // `msdyn_eventdata` JSON is only a fallback — GPT-prompt runs don't carry a `messageConsumption`
    // block there, which is why credits previously showed 0.
    const creditConsumed = typeof event.msdyn_creditconsumed === 'number' ? event.msdyn_creditconsumed : null;
    return {
        id: event.msdyn_aieventid,
        output: event.msdyn_output || '',
        quickTest: event.msdyn_quicktest === true,
        dataType: event.msdyn_datatype || '',
        processingStatus: event[`msdyn_processingstatus${FV}`] || '',
        status: event[`statuscode${FV}`] || '',
        processedOn: event[`msdyn_processingdate${FV}`] || event.msdyn_processingdate || '',
        createdOn: event[`createdon${FV}`] || event.createdon || '',
        createdOnRaw: event.createdon || '',
        consumption: creditConsumed !== null ? creditConsumed : meta.consumption,
        units: meta.units,
        featureName: meta.featureName,
        llmModelName: meta.llmModelName,
        consumptionSource: event[`msdyn_consumptionsource${FV}`] || meta.consumptionSource || '',
        createdBy: event[`_createdby_value${FV}`] || ''
    };
}

/**
 * Derives a batch/run lifecycle state from its error and completion timestamp. Robust to the exact
 * `msdyn_batchrunstatus`/`msdyn_testrunstatus` option-set integer (which varies): an error means
 * failed, a completion timestamp means completed, otherwise it is still running.
 * @param {string} errorMessage - The record's error message (empty when none).
 * @param {string} completedOn - The record's raw completion timestamp (falsy when not finished).
 * @returns {'completed'|'running'|'failed'}
 * @private
 */
function _deriveRunState(errorMessage, completedOn, statusValue) {
    if (errorMessage || statusValue === AI_TEST_STATUS_FAILED) {
        return 'failed';
    }
    return completedOn ? 'completed' : 'running';
}

/**
 * Maps a raw Dataverse msdyn_aitestrunbatch entity to a TestRunBatch object.
 * @param {object} batch - The raw entity record.
 * @returns {TestRunBatch}
 * @private
 */
function _mapTestBatchEntity(batch) {
    const error = batch.msdyn_errormessage || '';
    const completedOnRaw = batch.msdyn_completedon || '';
    return {
        id: batch.msdyn_aitestrunbatchid,
        name: batch.msdyn_name || '(unnamed run)',
        description: batch.msdyn_description || '',
        statusLabel: batch[`msdyn_batchrunstatus${FV}`] || '',
        state: _deriveRunState(error, completedOnRaw, batch.msdyn_batchrunstatus),
        accuracyScore: _numOrNull(batch.msdyn_accuracyscore),
        startedOnRaw: batch.msdyn_startedon || '',
        completedOnRaw,
        startedOn: batch[`msdyn_startedon${FV}`] || batch.msdyn_startedon || '',
        completedOn: batch[`msdyn_completedon${FV}`] || completedOnRaw || '',
        createdOn: batch[`createdon${FV}`] || batch.createdon || '',
        createdOnRaw: batch.createdon || '',
        errorMessage: error
    };
}

/**
 * Maps a raw Dataverse msdyn_aitestrun entity to a TestRun object. The `msdyn_additionalresponse
 * metadata` column holds a small JSON blob ({tokens, modelName, modelType}) that is parsed defensively.
 * @param {object} run - The raw entity record.
 * @returns {TestRun}
 * @private
 */
function _mapTestRunEntity(run) {
    let meta = {};
    try {
        meta = JSON.parse(run.msdyn_additionalresponsemetadata || '{}') || {};
    } catch {
        meta = {};
    }
    const error = run.msdyn_errormessage || '';
    return {
        id: run.msdyn_aitestrunid,
        testCaseId: run._msdyn_aitestcaseid_value || '',
        testCaseName: run[`_msdyn_aitestcaseid_value${FV}`] || '',
        configId: run.msdyn_configurationid || '',
        expectedOutput: run.msdyn_expectedoutput || '',
        actualOutput: run.msdyn_actualoutput || '',
        accuracyScore: _numOrNull(run.msdyn_accuracyscore),
        tokens: _numOrNull(meta.tokens),
        modelName: typeof meta.modelName === 'string' ? meta.modelName : '',
        modelType: typeof meta.modelType === 'string' ? meta.modelType : '',
        statusLabel: run[`msdyn_testrunstatus${FV}`] || '',
        state: _deriveRunState(error, run.msdyn_completedon || '', run.msdyn_testrunstatus),
        startedOnRaw: run.msdyn_startedon || '',
        completedOnRaw: run.msdyn_completedon || '',
        errorMessage: error,
        comment: run.msdyn_comment || ''
    };
}

/**
 * Maps a raw Dataverse msdyn_aitestcaseinput entity to a TestCaseInput object. `msdyn_inputdata` is a
 * JSON array of the prompt's input variables; it is parsed defensively into name/value pairs.
 * @param {object} input - The raw entity record.
 * @returns {TestCaseInput}
 * @private
 */
function _mapTestCaseInputEntity(input) {
    const raw = input.msdyn_inputdata || '';
    let values = [];
    try {
        const parsed = JSON.parse(raw || '[]');
        if (Array.isArray(parsed)) {
            values = parsed.map(item => {
                if (item && typeof item === 'object') {
                    const name = item.name ?? item.key ?? item.variable ?? '';
                    const value = item.value ?? item.text ?? item.data ?? '';
                    return { name: String(name), value: typeof value === 'string' ? value : JSON.stringify(value) };
                }
                return { name: '', value: String(item) };
            });
        }
    } catch {
        values = [];
    }
    return {
        id: input.msdyn_aitestcaseinputid,
        name: input.msdyn_name || '',
        raw,
        values,
        modifiedOn: input[`modifiedon${FV}`] || input.modifiedon || ''
    };
}

/**
 * Maps a raw Dataverse msdyn_aievaluationconfiguration entity to an EvaluationCriteria object by
 * parsing its `msdyn_evaluationcriteria` JSON (defensively).
 * @param {object} config - The raw entity record.
 * @returns {EvaluationCriteria}
 * @private
 */
function _mapEvaluationCriteria(config) {
    const raw = config.msdyn_evaluationcriteria || '';
    let parsed = {};
    try {
        parsed = JSON.parse(raw || '{}') || {};
    } catch {
        parsed = {};
    }
    const value = (parsed.value && typeof parsed.value === 'object') ? parsed.value : {};
    const expected = (value.expectedResponseCheck && typeof value.expectedResponseCheck === 'object') ? value.expectedResponseCheck : {};
    return {
        id: config.msdyn_aievaluationconfigurationid,
        passingScore: _numOrNull(parsed.passingScore),
        expectedResponse: {
            applicable: expected.isApplicable === true,
            comparison: expected.comparisonType === 'exact' ? 'exact' : 'similarity'
        },
        responseQuality: { applicable: (value.responseQuality || {}).isApplicable === true },
        jsonCorrectness: { applicable: (value.jsonCorrectness || {}).isApplicable === true },
        raw
    };
}

/**
 * Builds the `msdyn_evaluationcriteria` JSON string for a criteria PATCH. The existing raw JSON is the
 * base so unknown fields (and the `version` / `configurationType` markers) survive the edit; only the
 * passing score and the three prebuilt-check flags are overwritten from the edited values.
 * @param {string} raw - The current raw criteria JSON.
 * @param {{passingScore: number, expectedApplicable: boolean, comparisonType: string, responseQualityApplicable: boolean, jsonApplicable: boolean}} values
 * @returns {string} The JSON string to PATCH.
 */
export function buildEvaluationCriteriaPayload(raw, values) {
    let base = {};
    try {
        base = JSON.parse(raw || '{}') || {};
    } catch {
        base = {};
    }
    const value = (base.value && typeof base.value === 'object') ? base.value : {};
    const expected = (value.expectedResponseCheck && typeof value.expectedResponseCheck === 'object') ? value.expectedResponseCheck : {};
    const score = Math.min(100, Math.max(1, Math.round(Number(values.passingScore) || 0)));
    return JSON.stringify({
        ...base,
        version: base.version || '0.0',
        configurationType: base.configurationType || 'GptPromptPredefinedEvaluationCriteria',
        passingScore: score,
        value: {
            ...value,
            expectedResponseCheck: {
                ...expected,
                isApplicable: Boolean(values.expectedApplicable),
                comparisonType: values.comparisonType === 'exact' ? 'exact' : 'similarity'
            },
            responseQuality: { ...(value.responseQuality || {}), isApplicable: Boolean(values.responseQualityApplicable) },
            jsonCorrectness: { ...(value.jsonCorrectness || {}), isApplicable: Boolean(values.jsonApplicable) }
        }
    });
}

/**
 * Returns true when the string parses as JSON. Used for the JSON-correctness check.
 * @param {string} str
 * @returns {boolean}
 * @private
 */
function _isValidJson(str) {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * Computes the "billing" token units the Test hub records in a run's metadata:
 * `ceil(prompt*n/1000) + ceil(completion*i/1000)`, where the multipliers depend on the model tier.
 * (Ported verbatim from the AI Builder Test hub source.)
 * @param {number} promptTokens
 * @param {number} completionTokens
 * @param {string} modelType
 * @param {string} modelName
 * @returns {number}
 * @private
 */
function _evalTokenUnits(promptTokens, completionTokens, modelType, modelName) {
    const heavy = modelType === 'reasoningadvanced' || modelName === 'o1-2024-12-17';
    const medium = modelType === 'advanced' || modelType === 'byom' || modelName === 'gpt-4o';
    const promptRate = heavy ? 140 : (medium ? 20 : 1);
    const completionRate = heavy ? 560 : (medium ? 60 : 3);
    return Math.ceil((promptTokens || 0) * promptRate / 1000) + Math.ceil((completionTokens || 0) * completionRate / 1000);
}

/**
 * Rebuilds the flattened prompt text the grader is fed: literal segments verbatim, input-variable
 * segments replaced by the test case's value for that input.
 * @param {Array<{type: string, id?: string, text?: string}>} promptItems - The config's `prompt` array.
 * @param {Object.<string, string>} inputs - Input id → value for this test case.
 * @returns {string}
 * @private
 */
function _buildEvalPromptText(promptItems, inputs) {
    return (promptItems || []).map((item) => {
        if (item.type === 'inputVariable') {
            return String(inputs?.[item.id] ?? '');
        }
        if (item.type === 'literal') {
            return String(item.text ?? '');
        }
        // Data / Power Fx / other segments are omitted, matching the portal's grader input.
        return '';
    }).join('');
}

/**
 * Computes an evaluation's overall score: the rounded average of the *applicable* sub-scores
 * (exact match, semantic similarity, response quality, JSON correctness), or null when none apply.
 * @param {object} result - The `result` object built by {@link buildEvaluationResult}.
 * @returns {number|null}
 */
export function computeEvalFinalScore(result) {
    let sum = 0;
    let count = 0;
    const add = (check) => {
        if (check?.isApplicable) {
            sum += check.finalScore || 0;
            count += 1;
        }
    };
    add(result.exactMatch);
    add(result.semanticSimilarity);
    add(result.responseQuality);
    add(result.jsonCorrectness);
    return count > 0 ? Math.round(sum / count) : null;
}

/**
 * Decides whether the server-side grader must be invoked for a given criteria: only when semantic
 * similarity or response quality applies (exact match and JSON correctness are computed locally).
 * Response quality is treated as applicable by default when neither expected-response nor
 * JSON-correctness checks apply — mirroring the portal.
 * @param {object} criteria - The parsed evaluation criteria (with a `value` object).
 * @returns {boolean}
 */
export function evalNeedsGrader(criteria) {
    const value = criteria?.value || {};
    const expected = value.expectedResponseCheck || { isApplicable: false };
    const json = value.jsonCorrectness || { isApplicable: false };
    const quality = value.responseQuality || { isApplicable: false };
    const qualityApplies = (expected.isApplicable || json.isApplicable) ? quality.isApplicable : true;
    return (expected.isApplicable && expected.comparisonType === 'similarity') || qualityApplies;
}

/**
 * Assembles the `msdyn_evaluationresult` payload for a single run from the criteria, the expected and
 * actual outputs, and the grader's sub-scores. Exact-match and JSON-correctness are scored here;
 * semantic-similarity and response-quality are copied from the grader result. Sets `finalScore` (the
 * average of applicable checks) and `passedEvaluation` (finalScore ≥ passing score).
 * Ported from the AI Builder Test hub source so the toolkit produces the same scores as the portal.
 * @param {object} criteria - Parsed evaluation criteria (`{passingScore, value:{...}}`).
 * @param {string} expected - The test case's expected output.
 * @param {string} actualOutput - The model's actual output.
 * @param {{semanticSimilarity?: object, responseQuality?: object}} graderResult - The grader's JSON.
 * @returns {{criteria: object, result: object}}
 */
export function buildEvaluationResult(criteria, expected, actualOutput, graderResult) {
    const value = criteria?.value || {};
    const expectedCheck = value.expectedResponseCheck || { isApplicable: false };
    const jsonCheck = value.jsonCorrectness || { isApplicable: false };
    const qualityCheck = value.responseQuality || { isApplicable: false };
    // Response quality is forced on when neither of the other expected/JSON checks apply.
    const effectiveQuality = (expectedCheck.isApplicable || jsonCheck.isApplicable)
        ? qualityCheck
        : { ...qualityCheck, isApplicable: true };

    const out = { criteria, result: {} };
    const actual = String(actualOutput ?? '');
    const grader = graderResult || {};

    _applyExpectedResponseScore(out.result, {
        expectedCheck, effectiveQuality, jsonCheck, expected, actual, grader
    });

    if (effectiveQuality.isApplicable) {
        const rq = grader.responseQuality;
        out.result.responseQuality = {
            isApplicable: true,
            finalScore: (rq && rq.isApplicable) ? Number(rq.finalScore) : 0,
            scoreExplanation: rq?.scoreExplanation ?? {}
        };
    }

    if (jsonCheck.isApplicable) {
        out.result.jsonCorrectness = { isApplicable: true, finalScore: _isValidJson(actual) ? 100 : 0 };
    }

    const finalScore = computeEvalFinalScore(out.result);
    if (finalScore !== null) {
        out.result.finalScore = finalScore;
        out.result.passedEvaluation = finalScore >= (criteria?.passingScore ?? AI_EVAL_DEFAULT_PASSING_SCORE);
    }
    return out;
}

/**
 * Fills the expected-response portion of an evaluation result: an exact-match score (computed here),
 * a semantic-similarity score (from the grader), or a "no score" note when no expected output exists.
 * @param {object} result - The result object being assembled (mutated).
 * @param {object} ctx - `{expectedCheck, effectiveQuality, jsonCheck, expected, actual, grader}`.
 * @private
 */
function _applyExpectedResponseScore(result, ctx) {
    const { expectedCheck, effectiveQuality, jsonCheck, expected, actual, grader } = ctx;
    const exp = String(expected ?? '').trim();
    if (expectedCheck.isApplicable && exp) {
        if (expectedCheck.comparisonType === 'exact') {
            result.exactMatch = { isApplicable: true, finalScore: exp === actual.trim() ? 100 : 0 };
        } else if (expectedCheck.comparisonType === 'similarity') {
            const ss = grader.semanticSimilarity;
            result.semanticSimilarity = {
                isApplicable: true,
                finalScore: (ss && ss.isApplicable) ? Number(ss.finalScore) : 0,
                scoreExplanation: ss?.scoreExplanation ?? ''
            };
        }
    } else if (expectedCheck.isApplicable && !effectiveQuality.isApplicable && !jsonCheck.isApplicable) {
        result.noScoreExplanation = 'No score when no expected response is provided.';
    }
}

/**
 * Formats an evaluation-run name timestamp the way the portal does (localized 12-hour clock).
 * @returns {string}
 * @private
 */
function _evalRunTimestamp() {
    return new Date().toLocaleString('en-US', {
        month: '2-digit', day: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
}

/**
 * Resolves the evaluation configuration to score a run against: the prompt's own criteria when it has
 * one, otherwise the shared default configuration (fetched, or created if it does not yet exist).
 * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
 * @param {Function} createRecord - Bound DataService.createRecord.
 * @param {string} objectId - The model id (unused for the default; kept for symmetry/logging).
 * @param {import('./AgentService.js').EvaluationCriteria|null} criteria - The prompt's criteria, if any.
 * @returns {Promise<{id: string, criteriaObj: object, passingScore: number}>}
 * @private
 */
async function _resolveEvaluationConfig(retrieveMultipleRecords, createRecord, objectId, criteria) {
    if (criteria?.id) {
        let criteriaObj = {};
        try {
            criteriaObj = JSON.parse(criteria.raw || '{}') || {};
        } catch {
            criteriaObj = {};
        }
        return { id: criteria.id, criteriaObj, passingScore: criteria.passingScore ?? AI_EVAL_DEFAULT_PASSING_SCORE };
    }

    try {
        const response = await retrieveMultipleRecords(
            'msdyn_aievaluationconfigurations',
            '?$select=msdyn_aievaluationconfigurationid,msdyn_evaluationcriteria' +
            `&$filter=msdyn_aievaluationconfigurationid eq ${AI_EVAL_DEFAULT_CONFIG_ID}`
        );
        const existing = (response.entities || [])[0];
        if (existing) {
            let criteriaObj = {};
            try {
                criteriaObj = JSON.parse(existing.msdyn_evaluationcriteria || '{}') || {};
            } catch {
                criteriaObj = {};
            }
            return {
                id: existing.msdyn_aievaluationconfigurationid,
                criteriaObj,
                passingScore: criteriaObj.passingScore ?? AI_EVAL_DEFAULT_PASSING_SCORE
            };
        }
    } catch {
        // Fall through to create the default.
    }

    await createRecord('msdyn_aievaluationconfigurations', {
        msdyn_aievaluationconfigurationid: AI_EVAL_DEFAULT_CONFIG_ID,
        msdyn_aiobjectid: '00000000-0000-0000-0000-000000000000',
        msdyn_aiobjecttype: 'AIPrompt',
        msdyn_name: AI_EVAL_DEFAULT_CONFIG_NAME,
        msdyn_configurationstate: 0,
        msdyn_evaluationcriteria: AI_EVAL_DEFAULT_CRITERIA
    });
    return { id: AI_EVAL_DEFAULT_CONFIG_ID, criteriaObj: JSON.parse(AI_EVAL_DEFAULT_CRITERIA), passingScore: AI_EVAL_DEFAULT_PASSING_SCORE };
}

/**
 * Invokes the system grader (a QuickTest against the hardcoded grader configuration) to score a
 * response's semantic similarity and quality against the expected output.
 * @param {Function} webApiFetch - Raw web API fetch ('POST', path, query, body).
 * @param {{expected: string, promptText: string, testCaseInput: string, actualOutput: string}} inputs
 * @returns {Promise<{semanticSimilarity?: object, responseQuality?: object}>}
 * @private
 */
async function _gradePromptResponse(webApiFetch, inputs) {
    const response = await webApiFetch(
        'POST', `msdyn_aiconfigurations(${AI_EVAL_GRADER_CONFIG_ID})/Microsoft.Dynamics.CRM.QuickTest`, '',
        {
            version: '2.0',
            source: AI_PUBLISH_SOURCE,
            requestv2: {
                '@odata.type': EXPANDO,
                ExpectedOutput: inputs.expected ?? '',
                PromptText: inputs.promptText ?? '',
                TestCaseInput: inputs.testCaseInput ?? '{}',
                TestCaseResponse: inputs.actualOutput ?? ''
            }
        }
    );
    const text = response?.responsev2?.predictionOutput?.text || '{}';
    try {
        return JSON.parse(text) || {};
    } catch {
        return {};
    }
}

/**
 * Scores a single test run: creates an evaluation run, grades the response when required, and writes
 * the assembled result back. Returns the numeric final score (or null when nothing applied).
 * @param {object} deps - `{createRecord, updateRecord, webApiFetch}` bound primitives.
 * @param {object} params - `{runId, evalConfig, testCase, promptItems, actualOutput}`.
 * @returns {Promise<number|null>}
 * @private
 */
async function _scoreTestRun(deps, params) {
    const { createRecord, updateRecord, webApiFetch } = deps;
    const { runId, evalConfig, testCase, promptItems, actualOutput } = params;
    if (!evalConfig?.id) {
        return null;
    }
    const criteriaObj = evalConfig.criteriaObj || {};
    const evalRun = await createRecord('msdyn_aievaluationruns', {
        msdyn_name: `Evaluation Run ${_evalRunTimestamp()}`,
        msdyn_airunobjectid: runId,
        msdyn_airunobjecttype: 'AITestRun',
        msdyn_evaluationresult: '',
        msdyn_startedon: new Date().toISOString(),
        msdyn_runstatus: AI_TEST_STATUS_INPROGRESS,
        msdyn_errormessage: '',
        'msdyn_AIEvaluationConfigurationId@odata.bind': `/msdyn_aievaluationconfigurations(${evalConfig.id})`
    });

    let grader = {};
    if (evalNeedsGrader(criteriaObj)) {
        const inputs = testCase.inputs || {};
        grader = await _gradePromptResponse(webApiFetch, {
            expected: testCase.expectedOutput || '',
            promptText: _buildEvalPromptText(promptItems, inputs),
            testCaseInput: JSON.stringify(inputs),
            actualOutput
        });
    }

    const evalResult = buildEvaluationResult(criteriaObj, testCase.expectedOutput || '', actualOutput, grader);
    await updateRecord('msdyn_aievaluationruns', evalRun.id, {
        msdyn_evaluationresult: JSON.stringify(evalResult),
        msdyn_runstatus: AI_TEST_STATUS_SUCCEEDED
    });
    return evalResult.result.finalScore ?? null;
}

/**
 * Maps a raw Dataverse msdyn_aitestcase entity to an EvalTestCase object.
 * @param {object} testCase - The raw entity record.
 * @returns {EvalTestCase}
 * @private
 */
function _mapTestCaseEntity(testCase) {
    return {
        id: testCase.msdyn_aitestcaseid,
        name: testCase.msdyn_name || '(unnamed test case)',
        description: testCase.msdyn_description || '',
        expectedOutput: testCase.msdyn_expectedoutput || '',
        source: testCase.msdyn_source || '',
        state: testCase[`msdyn_testcasestate${FV}`] || testCase[`statecode${FV}`] || '',
        createdOn: testCase[`createdon${FV}`] || testCase.createdon || '',
        modifiedOn: testCase[`modifiedon${FV}`] || testCase.modifiedon || ''
    };
}

/**
 * Returns the value if it is a finite number, otherwise null.
 * @param {*} value
 * @returns {number|null}
 * @private
 */
function _numOrNull(value) {
    return typeof value === 'number' ? value : null;
}

/**
 * Fallback state label for an agent when the formatted value is not returned.
 * Bot statecode: 0=Active, 1=Inactive.
 * @param {number} statecode
 * @returns {string}
 * @private
 */
function _getAgentStateLabel(statecode) {
    switch (statecode) {
        case 0: return 'Active';
        case 1: return 'Inactive';
        default: return 'Unknown';
    }
}

/**
 * Fallback state label for an AI model when the formatted value is not returned.
 * msdyn_aimodel statecode: 0=Inactive, 1=Active (reversed compared to the bot table).
 * @param {number} statecode
 * @returns {string}
 * @private
 */
function _getAiModelStateLabel(statecode) {
    switch (statecode) {
        case 0: return 'Inactive';
        case 1: return 'Active';
        default: return 'Unknown';
    }
}
