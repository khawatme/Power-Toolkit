/**
 * @file Business rule and workflow automation service
 * @module services/AutomationService
 * @description Handles business rule operations and automation queries
 */

import { PowerAppsApiService } from './PowerAppsApiService.js';

export const AutomationService = {
    /**
     * Get all business rules for a specific entity.
     * @param {Function} executeFetchXml - DataService FetchXML execution function
     * @param {string} entityName - Entity logical name
     * @returns {Promise<Array<object>>} Business rule definitions
     */
    async getBusinessRulesForEntity(executeFetchXml, entityName) {
        if (!entityName) {
            return [];
        }

        const entityMetadata = await PowerAppsApiService.getEntityMetadata(entityName);

        if (!entityMetadata || !entityMetadata.ObjectTypeCode) {
            console.warn(`Could not retrieve metadata for entity: ${entityName}`);
            return [];
        }

        const objectTypeCode = entityMetadata.ObjectTypeCode;

        const fetchXml = `
            <fetch>
              <entity name="workflow">
                <attribute name="name" />
                <attribute name="workflowid" />
                <attribute name="scope" />
                <attribute name="clientdata" />
                <attribute name="type" />
                <attribute name="parentworkflowid" />
                <attribute name="statuscode" />
                <attribute name="description" />
                <filter type="and">
                  <condition attribute="category" operator="eq" value="2" />
                  <condition attribute="primaryentity" operator="eq" value="${objectTypeCode}" />
                </filter>
              </entity>
            </fetch>`;

        const headers = { 'Prefer': 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' };
        const response = await executeFetchXml('workflows', fetchXml, headers);

        if (!response.entities || response.entities.length === 0) {
            return [];
        }

        // Separate definitions (type=1) from activations (type=2)
        const definitions = response.entities.filter(rule => rule.type === 1);
        const activations = response.entities.filter(rule => rule.type === 2);

        // Build set of active definition IDs
        const activeDefinitionIds = new Set(
            activations
                .filter(act => act.statuscode === 2)
                .map(act => act._parentworkflowid_value)
        );

        return definitions.map(def => ({
            name: def.name,
            id: def.workflowid,
            scope: def['scope@OData.Community.Display.V1.FormattedValue'] || 'Unknown',
            isActive: activeDefinitionIds.has(def.workflowid),
            clientData: def.clientdata,
            description: def.description
        }));
    },

    /**
     * Activate or deactivate a business rule.
     * @param {Function} updateRecord - DataService update function
     * @param {string} ruleId - Business rule workflow ID
     * @param {boolean} activate - True to activate, false to deactivate
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async setBusinessRuleState(updateRecord, ruleId, activate) {
        const state = activate
            ? { statecode: 1, statuscode: 2 } // Activated
            : { statecode: 0, statuscode: 1 }; // Draft

        return updateRecord('workflows', ruleId, state);
    },

    /**
     * Delete a business rule.
     * @param {Function} deleteRecord - DataService delete function
     * @param {string} ruleId - Business rule workflow ID
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async deleteBusinessRule(deleteRecord, ruleId) {
        return deleteRecord('workflows', ruleId);
    }
};
