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
async function _webApiFetch(method, logicalName, queryString = '', data = null, customHeaders = {}) {
    return WebApiService.webApiFetch(
        method,
        logicalName,
        queryString,
        data,
        customHeaders,
        DataService.getEntitySetName,
        _impersonatedUserId
    );
}

/** @private @type {Map<string, any>} Caches the results of data-fetching operations. */
const _cache = new Map();

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
        if (!solutionUniqueName) return;
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
        this.clearCache();
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
        this.clearCache();
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
     * @param {boolean} [includeHidden=false]
     * @returns {Promise<Array<object>>}
     */
    getEntityDefinitions(includeHidden = false) {
        return MetadataService.getEntityDefinitions(_webApiFetch, _impersonatedUserId, includeHidden);
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
     * Returns a compact attribute map for quick type inference.
     * @param {string} entityLogicalName
     * @returns {Promise<Map<string, {type:string, targets?:string[]}>>}
     */
    getAttributeMap(entityLogicalName) {
        return MetadataService.getAttributeMap(_webApiFetch, entityLogicalName);
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
     * @returns {Promise<object>} `{ id }` when available or response JSON
     */
    createRecord(entity, data) {
        return WebApiService.createRecord(_webApiFetch, entity, data);
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
     * Delete a record.
     * @param {string} entity
     * @param {string} id
     * @returns {Promise<object>}
     */
    deleteRecord(entity, id) {
        return WebApiService.deleteRecord(_webApiFetch, entity, id);
    },

    /**
     * Execute FetchXML and return `{ entities }`.
     * @param {string} entityName
     * @param {string} fetchXml
     * @param {HeadersInit} [customHeaders={}]
     * @returns {Promise<{entities:any[]}>}
     */
    executeFetchXml(entityName, fetchXml, customHeaders = {}) {
        return WebApiService.executeFetchXml(_webApiFetch, entityName, fetchXml, customHeaders);
    },

    /**
     * Clears all internal data and metadata caches.
     * @param {string|null} [key=null]
     */
    clearCache(key = null) {
        if (key) {
            _cache.delete(key);
        } else {
            _cache.clear();
            MetadataService.clearCache();
        }
    },

    /**
     * Fetches Environment Variable definitions and values.
     * @param {boolean} [bypassCache=false]
     * @returns {Promise<EnvironmentVariable[]>}
     */
    getEnvironmentVariables(bypassCache = false) {
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
    getFormEventHandlers(bypassCache = false) {
        return FormInspectionService.getFormEventHandlers(PowerAppsApiService, bypassCache);
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
    getFormEventHandlersForEntity(entityName, bypassCache = false) {
        return FormInspectionService.getFormEventHandlersForEntity(
            this.retrieveMultipleRecords.bind(this),
            this.retrieveRecord.bind(this),
            entityName
        );
    },

    /**
     * Retrieves all columns for the current record by merging form attributes with a full Web API retrieve.
     * @param {boolean} [bypassCache=false]
     * @returns {Promise<FormColumn[]>}
     */
    getAllRecordColumns(bypassCache = false) {
        return FormInspectionService.getAllRecordColumns(
            this.retrieveRecord.bind(this),
            this.getFormColumns.bind(this),
            isOdataProperty,
            () => MetadataService.loadEntityMetadata(_webApiFetch, _impersonatedUserId),
            this.getEntitySetName.bind(this)
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
     * Gets an enhanced user/client/org context object.
     * @param {boolean} [bypassCache=false]
     * @returns {object}
     */
    getEnhancedUserContext: (bypassCache = false) => _fetch('userContext', async () => {
        const gc = PowerAppsApiService.getGlobalContext();
        const clientInfo = {
            type: gc.client.getClient(),
            formFactor: ['Unknown', 'Desktop', 'Tablet', 'Phone'][gc.client.getFormFactor()],
            isOffline: gc.client.isOffline(),
            appUrl: gc.getClientUrl()
        };
        const orgInfo = {
            name: gc.organizationSettings.uniqueName,
            id: gc.organizationSettings.organizationId,
            version: gc.getVersion(),
            isAutoSave: gc.organizationSettings.isAutoSaveEnabled
        };

        // Session information
        const sessionInfo = {
            timestamp: new Date().toISOString(),
            sessionId: gc.client.getSessionId?.() || 'N/A',
            tenantId: gc.getCurrentAppProperties?.()?.tenantId || 'N/A',
            objectId: gc.getCurrentAppProperties?.()?.objectId || 'N/A',
            buildName: gc.getCurrentAppProperties?.()?.appModuleBuildNumber || 'N/A',
            organizationId: gc.organizationSettings.organizationId,
            uniqueName: gc.organizationSettings.uniqueName,
            instanceUrl: gc.getClientUrl(),
            environmentId: gc.getCurrentAppProperties?.()?.environmentId || 'N/A',
            clusterEnvironment: gc.getCurrentAppProperties?.()?.clusterEnvironment || 'N/A',
            clusterCategory: gc.getCurrentAppProperties?.()?.clusterCategory || 'N/A',
            clusterGeoName: gc.getCurrentAppProperties?.()?.clusterGeoName || 'N/A',
            clusterUriSuffix: gc.getCurrentAppProperties?.()?.clusterUriSuffix || 'N/A'
        };

        let userInfo;

        if (!_impersonatedUserId) {
            const roles = gc.userSettings.roles.getAll().map(r => ({ id: r.id.replace(/[{}]/g, ''), name: r.name }));
            userInfo = {
                name: gc.userSettings.userName,
                id: gc.userSettings.userId.replace(/[{}]/g, ''),
                language: gc.userSettings.languageId,
                roles
            };
        } else {
            const userData = await DataService.retrieveRecord('systemusers', _impersonatedUserId, '?$select=fullname,systemuserid');

            const directRolesResponse = await _webApiFetch('GET', `systemusers(${_impersonatedUserId})/systemuserroles_association?$select=name,roleid`);
            const directRoles = directRolesResponse.value?.map(r => ({ id: r.roleid, name: r.name })) || [];

            const teamsResponse = await _webApiFetch('GET', `systemusers(${_impersonatedUserId})/teammembership_association?$select=teamid`);
            const teamIds = teamsResponse.value?.map(t => t.teamid) || [];
            let teamRoles = [];
            if (teamIds.length > 0) {
                const teamRolePromises = teamIds.map(teamId =>
                    _webApiFetch('GET', `teams(${teamId})/teamroles_association?$select=name,roleid`)
                );
                const teamRoleResults = await Promise.all(teamRolePromises);
                teamRoles = teamRoleResults.flatMap(result => result.value?.map(r => ({ id: r.roleid, name: r.name })) || []);
            }
            // Deduplicate by role ID
            const allRolesMap = new Map();
            [...directRoles, ...teamRoles].forEach(role => {
                if (!allRolesMap.has(role.id)) {
                    allRolesMap.set(role.id, role);
                }
            });

            userInfo = {
                name: userData.fullname,
                id: userData.systemuserid,
                language: 'N/A (Impersonated)',
                roles: Array.from(allRolesMap.values()).sort((a, b) => a.name.localeCompare(b.name))
            };
        }

        return { user: userInfo, client: clientInfo, organization: orgInfo, session: sessionInfo };
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
