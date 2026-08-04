/**
 * @file Power Automate cloud flow operations service.
 * @module services/FlowService
 * @description Handles fetching, activating, deactivating, and deleting cloud flows
 * stored in the Dataverse workflow table (category=5).
 */

/**
 * @typedef {object} CloudFlow
 * @property {string} id - The workflow GUID.
 * @property {string} name - Display name of the flow.
 * @property {string} description - User-provided description.
 * @property {number} statecode - 0=Draft/Off, 1=Activated/On, 2=Suspended.
 * @property {string} stateLabel - Formatted state label.
 * @property {boolean} isManaged - Whether the flow is from a managed solution.
 * @property {string} owner - Owner display name.
 * @property {string} createdOn - Formatted creation date.
 * @property {string} modifiedOn - Formatted modification date.
 * @property {string} createdBy - Creator display name.
 * @property {string|null} clientData - JSON-encoded flow definition.
 * @property {string} solutionId - The solution GUID this flow belongs to.
 * @property {number} modernFlowType - The modernflowtype option (1 = Copilot Studio agent flow).
 * @property {boolean} isAgentFlow - True when this is a Copilot Studio agent flow (modernflowtype=1).
 */

/**
 * @typedef {object} FlowRun
 * @property {string} id - The flowrun GUID (flowrunid).
 * @property {string} runId - The run name (Logic App run id) used in portal deep links.
 * @property {string} status - Raw run status (e.g. 'Succeeded', 'Failed', 'Cancelled', 'Running').
 * @property {string} statusKey - Normalized lowercase status key for styling ('succeeded'|'failed'|'cancelled'|'running'|'other').
 * @property {string} triggerType - Raw trigger type (e.g. 'Automated', 'Scheduled', 'Manual').
 * @property {string} startTime - Raw ISO start time.
 * @property {string} startTimeLabel - Formatted, locale-aware start time.
 * @property {string} endTime - Raw ISO end time.
 * @property {string} endTimeLabel - Formatted, locale-aware end time.
 * @property {number|null} durationMs - Run duration in milliseconds.
 * @property {string} durationText - Human-friendly duration (e.g. '1.2s', '2m 3s').
 * @property {string} errorCode - Error code when the run failed (e.g. 'ActionFailed').
 * @property {string} errorMessage - Human-readable message parsed from the run's rollup error JSON.
 * @property {string} errorRaw - The raw run-level error text (JSON) as stored, for reference.
 * @property {boolean} isPrimary - Whether this run is a primary (parent) run.
 * @property {string} parentRunId - Parent run id when this is a child run.
 * @property {number|null} modernFlowType - The modernflowtype option (1 = Copilot Studio agent flow).
 */

/**
 * @typedef {object} FlowRunLog
 * @property {string} id - The flowlog GUID (flowlogid).
 * @property {string} name - Log name (typically the action/step name).
 * @property {string} typeLabel - Formatted log type label.
 * @property {string} levelLabel - Formatted log level label (Verbose/Debug/Info/Warning/Error).
 * @property {number|null} durationMs - Action duration in milliseconds.
 * @property {string} durationText - Human-friendly duration.
 * @property {number|null} logIndex - Order of the log within the run.
 * @property {string} data - The logged JSON data (raw string).
 * @property {string} createdOn - Raw ISO created-on time.
 */

/** Prefer header that returns OData formatted (display) values alongside raw values. */
const _FORMATTED_VALUES_HEADER = { 'Prefer': 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' };

export const FlowService = {
    /**
     * Retrieves all solutions that contain cloud flows.
     * @param {Function} webApiFetch - Bound WebApiService.webApiFetch function.
     * @returns {Promise<Array<{solutionid: string, friendlyname: string, uniquename: string, ismanaged: boolean}>>}
     */
    async getSolutionsWithFlows(webApiFetch) {
        // Get all visible solutions
        const query = '$select=solutionid,friendlyname,uniquename,ismanaged&$filter=isvisible eq true&$orderby=friendlyname asc';
        const result = await webApiFetch('GET', 'solution', query);
        const allSolutions = result.value || [];

        // Get solution components of type 29 (workflow) to find which solutions have flows
        const scQuery = '$select=solutioncomponentid,_solutionid_value,objectid&$filter=componenttype eq 29';
        const scResult = await webApiFetch('GET', 'solutioncomponent', scQuery);
        const solutionComponents = scResult.value || [];

        // Build a set of solution IDs that contain workflow components
        const solutionIdsWithFlows = new Set(
            solutionComponents.map(sc => sc._solutionid_value)
        );

        return allSolutions.filter(s => solutionIdsWithFlows.has(s.solutionid));
    },

    /**
     * Retrieves cloud flows (Modern Flows) belonging to a specific solution.
     * @param {Function} executeFetchXml - Bound DataService.executeFetchXml function.
     * @param {Function} webApiFetch - Bound WebApiService.webApiFetch function.
     * @param {string} solutionId - The solution GUID.
     * @returns {Promise<CloudFlow[]>} Array of cloud flow objects.
     */
    async getCloudFlowsBySolution(executeFetchXml, webApiFetch, solutionId) {
        // Get workflow component object IDs for this solution
        const scQuery = `$select=objectid&$filter=componenttype eq 29 and _solutionid_value eq ${solutionId}`;
        const scResult = await webApiFetch('GET', 'solutioncomponent', scQuery);
        const componentIds = (scResult.value || []).map(sc => sc.objectid);

        if (componentIds.length === 0) {
            return [];
        }

        const CHUNK_SIZE = 100;
        const headers = { 'Prefer': 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' };
        const flows = [];

        for (let i = 0; i < componentIds.length; i += CHUNK_SIZE) {
            const values = componentIds
                .slice(i, i + CHUNK_SIZE)
                .map(id => `<value>${id}</value>`)
                .join('');

            const fetchXml = `
            <fetch>
              <entity name="workflow">
                <attribute name="name" />
                <attribute name="workflowid" />
                <attribute name="description" />
                <attribute name="statecode" />
                <attribute name="statuscode" />
                <attribute name="category" />
                <attribute name="type" />
                <attribute name="modernflowtype" />
                <attribute name="ismanaged" />
                <attribute name="createdon" />
                <attribute name="modifiedon" />
                <attribute name="ownerid" />
                <attribute name="createdby" />
                <filter type="and">
                  <condition attribute="category" operator="eq" value="5" />
                  <condition attribute="type" operator="eq" value="1" />
                  <condition attribute="workflowid" operator="in">${values}</condition>
                </filter>
                <order attribute="name" />
              </entity>
            </fetch>`;

            const response = await executeFetchXml('workflows', fetchXml, headers);
            flows.push(...(response.entities || []).map(flow => _mapFlowEntity(flow)));
        }

        flows.sort((a, b) => a.name.localeCompare(b.name));
        return flows;
    },

    /**
     * Retrieves all cloud flows (Modern Flows) from the environment.
     * Queries the workflow table with category=5 (Modern Flow) and type=1 (Definition).
     * @param {Function} executeFetchXml - Bound DataService.executeFetchXml function.
     * @returns {Promise<CloudFlow[]>} Array of cloud flow objects.
     */
    async getCloudFlows(executeFetchXml) {
        const fetchXml = `
            <fetch>
              <entity name="workflow">
                <attribute name="name" />
                <attribute name="workflowid" />
                <attribute name="description" />
                <attribute name="statecode" />
                <attribute name="statuscode" />
                <attribute name="category" />
                <attribute name="type" />
                <attribute name="modernflowtype" />
                <attribute name="ismanaged" />
                <attribute name="createdon" />
                <attribute name="modifiedon" />
                <attribute name="ownerid" />
                <attribute name="createdby" />
                <filter type="and">
                  <condition attribute="category" operator="eq" value="5" />
                  <condition attribute="type" operator="eq" value="1" />
                </filter>
                <order attribute="name" />
              </entity>
            </fetch>`;

        const headers = { 'Prefer': 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' };
        const response = await executeFetchXml('workflows', fetchXml, headers);

        if (!response.entities || response.entities.length === 0) {
            return [];
        }

        return response.entities.map(flow => _mapFlowEntity(flow));
    },

    /**
     * Retrieves the full flow definition (clientdata) for a specific flow.
     * @param {Function} executeFetchXml - Bound DataService.executeFetchXml function.
     * @param {string} flowId - The workflow GUID.
     * @returns {Promise<string|null>} The clientdata JSON string, or null.
     */
    async getFlowDefinition(executeFetchXml, flowId) {
        const fetchXml = `
            <fetch top="1">
              <entity name="workflow">
                <attribute name="clientdata" />
                <filter type="and">
                  <condition attribute="workflowid" operator="eq" value="${flowId}" />
                </filter>
              </entity>
            </fetch>`;

        const response = await executeFetchXml('workflows', fetchXml);
        const entity = response.entities?.[0];
        return entity?.clientdata || null;
    },

    /**
     * Activates or deactivates a cloud flow.
     * @param {Function} updateRecord - Bound DataService.updateRecord function.
     * @param {string} flowId - The workflow GUID.
     * @param {boolean} activate - True to turn on, false to turn off.
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async setFlowState(updateRecord, flowId, activate) {
        const state = activate
            ? { statecode: 1, statuscode: 2 } // Activated (On)
            : { statecode: 0, statuscode: 1 }; // Draft (Off)

        return updateRecord('workflows', flowId, state);
    },

    /**
     * Updates the flow definition (clientdata) for an unmanaged flow.
     * @param {Function} updateRecord - Bound DataService.updateRecord function.
     * @param {string} flowId - The workflow GUID.
     * @param {string} clientData - The new clientdata JSON string.
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async updateFlowDefinition(updateRecord, flowId, clientData) {
        return updateRecord('workflows', flowId, { clientdata: clientData });
    },

    /**
     * Deletes a cloud flow.
     * @param {Function} deleteRecord - Bound DataService.deleteRecord function.
     * @param {string} flowId - The workflow GUID.
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async deleteFlow(deleteRecord, flowId) {
        return deleteRecord('workflows', flowId);
    },

    /**
     * Retrieves the run history for a cloud flow from the Dataverse `flowrun` elastic table.
     * Run history is only stored for solution cloud flows and only while the environment's
     * `Organization.FlowRunTimeToLiveInSeconds` is greater than zero (default retention 28 days).
     * @param {Function} webApiFetch - Bound WebApiService.webApiFetch function.
     * @param {string} workflowId - The workflow (flow) GUID.
     * @param {{top?: number, status?: string}} [options] - Query options.
     * @returns {Promise<FlowRun[]>} Runs ordered most-recent first.
     */
    async getFlowRuns(webApiFetch, workflowId, { top = 50, status } = {}) {
        const filters = [`_workflow_value eq ${workflowId}`];
        if (status) {
            filters.push(`status eq '${status.replace(/'/g, "''")}'`);
        }
        const select = '$select=name,status,triggertype,starttime,endtime,duration,errorcode,errormessage,isprimary,parentrunid,modernflowtype,createdon';
        const filter = `$filter=${filters.join(' and ')}`;
        const top$ = `$top=${top}`;

        // Elastic tables don't always accept ordering by every column; prefer starttime but fall
        // back to createdon (always supported) so a single unsupported $orderby never breaks runs.
        let response;
        try {
            response = await webApiFetch('GET', 'flowrun', `${select}&${filter}&$orderby=starttime desc&${top$}`, null, _FORMATTED_VALUES_HEADER);
        } catch {
            response = await webApiFetch('GET', 'flowrun', `${select}&${filter}&$orderby=createdon desc&${top$}`, null, _FORMATTED_VALUES_HEADER);
        }

        return (response.value || []).map(_mapFlowRun);
    },

    /**
     * Retrieves the per-action logs for a specific flow run from the `flowlog` elastic table.
     * Cloud-flow log coverage is best-effort (the table is shared with desktop flows), so this
     * degrades gracefully to an empty array when no logs exist or the caller lacks read access.
     * @param {Function} webApiFetch - Bound WebApiService.webApiFetch function.
     * @param {string} flowRunId - The flowrun GUID (flowrunid).
     * @param {{top?: number}} [options] - Query options.
     * @returns {Promise<FlowRunLog[]>} Logs ordered by their index within the run.
     */
    async getFlowRunLogs(webApiFetch, flowRunId, { top = 200 } = {}) {
        const select = '$select=name,type,level,duration,logindex,data,createdon';
        const filter = `$filter=_cloudflowrunid_value eq ${flowRunId}`;
        const top$ = `$top=${top}`;

        try {
            let response;
            try {
                response = await webApiFetch('GET', 'flowlog', `${select}&${filter}&$orderby=logindex asc&${top$}`, null, _FORMATTED_VALUES_HEADER);
            } catch {
                response = await webApiFetch('GET', 'flowlog', `${select}&${filter}&${top$}`, null, _FORMATTED_VALUES_HEADER);
            }
            return (response.value || []).map(_mapFlowLog);
        } catch {
            return [];
        }
    }
};

/**
 * Maps a raw Dataverse workflow entity to a CloudFlow object.
 * @param {object} flow - The raw entity record.
 * @returns {CloudFlow}
 * @private
 */
function _mapFlowEntity(flow) {
    return {
        id: flow.workflowid,
        name: flow.name || '(unnamed)',
        description: flow.description || '',
        statecode: flow.statecode,
        stateLabel: flow['statecode@OData.Community.Display.V1.FormattedValue'] || _getStateLabel(flow.statecode),
        isManaged: flow.ismanaged === true,
        owner: flow['_ownerid_value@OData.Community.Display.V1.FormattedValue'] || '',
        createdOn: flow['createdon@OData.Community.Display.V1.FormattedValue'] || flow.createdon || '',
        modifiedOn: flow['modifiedon@OData.Community.Display.V1.FormattedValue'] || flow.modifiedon || '',
        createdBy: flow['_createdby_value@OData.Community.Display.V1.FormattedValue'] || '',
        clientData: null,
        modernFlowType: flow.modernflowtype ?? null,
        isAgentFlow: flow.modernflowtype === 1
    };
}

/**
 * Fallback state label when formatted values are not returned.
 * @param {number} statecode
 * @returns {string}
 * @private
 */
function _getStateLabel(statecode) {
    switch (statecode) {
        case 0: return 'Draft';
        case 1: return 'Activated';
        case 2: return 'Suspended';
        default: return 'Unknown';
    }
}

/**
 * Maps a raw `flowrun` record to a FlowRun object.
 * @param {object} run - The raw entity record.
 * @returns {FlowRun}
 * @private
 */
function _mapFlowRun(run) {
    const durationMs = _toNumberOrNull(run.duration);
    const status = run.status || '';
    const error = _parseRunError(run.errormessage, run.errorcode);
    return {
        id: run.flowrunid,
        runId: run.name || '',
        status,
        statusKey: _normalizeStatusKey(status),
        triggerType: run.triggertype || '',
        startTime: run.starttime || '',
        startTimeLabel: run['starttime@OData.Community.Display.V1.FormattedValue'] || run.starttime || '',
        endTime: run.endtime || '',
        endTimeLabel: run['endtime@OData.Community.Display.V1.FormattedValue'] || run.endtime || '',
        durationMs,
        durationText: _formatDuration(durationMs),
        errorCode: error.code,
        errorMessage: error.message,
        errorRaw: error.raw,
        isPrimary: run.isprimary === 1 || run.isprimary === true,
        parentRunId: run.parentrunid || '',
        modernFlowType: run.modernflowtype ?? null
    };
}

/**
 * Parses a flowrun's rollup error. Power Automate stores the run-level error as a JSON string
 * (`{ code, message, messageTemplate }`) — extract a clean message + code and keep the raw text.
 * Note: this rollup is always the generic terminal error (e.g. 'ActionFailed'); the real per-action
 * error is not stored on `flowrun`, and `flowlog` (the per-action table) is an elastic unowned child
 * that the same-origin Web API cannot read. The authoritative failing-action detail is portal-only.
 * @param {string} rawMessage - The raw `errormessage` value.
 * @param {string} rawCode - The raw `errorcode` value.
 * @returns {{code: string, message: string, raw: string}}
 * @private
 */
function _parseRunError(rawMessage, rawCode) {
    const code = rawCode || '';
    const raw = rawMessage || '';
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
        try {
            const obj = JSON.parse(trimmed);
            return {
                code: obj.code || code,
                message: obj.message || obj.messageTemplate || '',
                raw
            };
        } catch {
            // Not valid JSON — fall through and use the raw string as the message.
        }
    }
    return { code, message: raw, raw };
}

/**
 * Maps a raw `flowlog` record to a FlowRunLog object.
 * @param {object} log - The raw entity record.
 * @returns {FlowRunLog}
 * @private
 */
function _mapFlowLog(log) {
    const durationMs = _toNumberOrNull(log.duration);
    return {
        id: log.flowlogid,
        name: log.name || '',
        typeLabel: log['type@OData.Community.Display.V1.FormattedValue'] || '',
        levelLabel: log['level@OData.Community.Display.V1.FormattedValue'] || '',
        durationMs,
        durationText: _formatDuration(durationMs),
        logIndex: _toNumberOrNull(log.logindex),
        data: log.data || '',
        createdOn: log.createdon || ''
    };
}

/**
 * Normalizes a raw run status into a lowercase key used for styling.
 * @param {string} status
 * @returns {string} One of 'succeeded'|'failed'|'cancelled'|'running'|'other'.
 * @private
 */
function _normalizeStatusKey(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'succeeded' || s === 'success') {
        return 'succeeded';
    }
    if (s === 'failed' || s === 'failure') {
        return 'failed';
    }
    if (s === 'cancelled' || s === 'canceled' || s === 'aborted') {
        return 'cancelled';
    }
    if (s === 'running' || s === 'started' || s === 'waiting' || s === 'resuming') {
        return 'running';
    }
    return 'other';
}

/**
 * Coerces a value to a finite number, or null when not numeric.
 * @param {*} value
 * @returns {number|null}
 * @private
 */
function _toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * Formats a millisecond duration into a compact, human-friendly string.
 * @param {number|null} ms
 * @returns {string} e.g. '850 ms', '1.2s', '2m 3s', '1h 4m'. Empty string when unknown.
 * @private
 */
function _formatDuration(ms) {
    if (ms === null || ms === undefined) {
        return '';
    }
    if (ms < 1000) {
        return `${ms} ms`;
    }
    const totalSeconds = ms / 1000;
    if (totalSeconds < 60) {
        return `${totalSeconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    if (minutes < 60) {
        return `${minutes}m ${seconds}s`;
    }
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `${hours}h ${remMinutes}m`;
}
