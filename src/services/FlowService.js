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
 */

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

        // Build filter conditions for workflow IDs
        const conditions = componentIds
            .map(id => `<condition attribute="workflowid" operator="eq" value="${id}" />`)
            .join('\n                  ');

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
                <attribute name="ismanaged" />
                <attribute name="createdon" />
                <attribute name="modifiedon" />
                <attribute name="ownerid" />
                <attribute name="createdby" />
                <filter type="and">
                  <condition attribute="category" operator="eq" value="5" />
                  <condition attribute="type" operator="eq" value="1" />
                  <filter type="or">
                    ${conditions}
                  </filter>
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
        clientData: null
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
