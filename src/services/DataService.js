/**
 * @file Data access layer for the application.
 * @module services/DataService
 * @description Handles all data retrieval from Dataverse, caching, impersonation logic,
 * and abstraction of the Web API. All components should request data through this service.
 */

import { PowerAppsApiService } from './PowerAppsApiService.js';
import { NotificationService } from './NotificationService.js';
import { Helpers } from '../utils/Helpers.js';
import { UIManager } from '../core/UIManager.js';
import { Store } from '../core/Store.js';

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

/** @private @type {Map<string, any>} Caches the results of data-fetching operations. */
const _cache = new Map();
/** @private @type {string|null} The GUID of the user currently being impersonated. */
let _impersonatedUserId = null;
/** @private @type {string|null} The full name of the user currently being impersonated. */
let _impersonatedUserName = null;
/** @private @type {Map<string, string>} Caches the mapping of entity logical names to entity set names. */
const _entitySetNameCache = new Map();
/** @private @type {boolean} A flag to ensure entity metadata is only fetched once per session. */
let _isMetadataLoaded = false;
/** @private @type {Promise|null} A promise that represents the in-flight metadata loading operation, to prevent race conditions. */
let _metadataPromise = null;

/**
 * Normalizes an object's keys to PascalCase to handle API inconsistencies (e.g., FetchXML vs. Web API).
 * @param {object} obj - The object to normalize.
 * @returns {object} A new object with PascalCased keys.
 * @private
 */
function _normalizeObjectKeys(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(_normalizeObjectKeys);
    
    return Object.entries(obj).reduce((acc, [key, value]) => {
        const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
        acc[pascalKey] = _normalizeObjectKeys(value); // Recursively normalize nested objects
        return acc;
    }, {});
}

/**
 * Fetches all entity metadata to map logical names to entity set names.
 * Uses a singleton promise pattern to prevent race conditions from parallel requests.
 * @private
 * @returns {Promise<void>}
 */
async function _loadEntityMetadata() {
    if (_isMetadataLoaded) return;
    if (_metadataPromise) return _metadataPromise; // If loading, return the existing promise to wait on.

    _metadataPromise = (async () => {
        try {
            const response = await _webApiFetch('GET', 'EntityDefinitions', '?$select=LogicalName,EntitySetName');
            if (response && response.value) {
                response.value.forEach(entity => {
                    _entitySetNameCache.set(entity.LogicalName, entity.EntitySetName);
                });
                _entitySetNameCache.set('plugintracelog', 'plugintracelogs');
                _isMetadataLoaded = true;
                console.log("PDT: Entity metadata loaded and cached ONCE.");
            }
        } catch (e) {
            console.error("PDT: Failed to load entity metadata.", e);
            _metadataPromise = null; // Allow a retry if the request fails.
            throw e;
        }
    })();
    
    return _metadataPromise;
}

/**
 * A centralized gateway for Dataverse Web API requests, handling entity name resolution,
 * impersonation, and standardized error parsing.
 *
 * @async
 * @private
 * @param {'GET'|'POST'|'PATCH'|'DELETE'} method - The HTTP verb for the request.
 * @param {string} collection - An entity logical name (e.g., 'account') or resource path (e.g., 'accounts(guid)').
 * @param {string} [options] - OData query options (e.g., '?$select=name').
 * @param {object} [data] - The JSON payload for POST or PATCH requests.
 * @param {HeadersInit} [customHeaders] - Optional custom request headers.
 * @returns {Promise<object>} A promise resolving with the API response. Returns `{id}` on create (201)
 * or `{status: 204}` on success with no content.
 * @throws {Error} Throws a detailed error on a non-successful HTTP status.
 *
 * @example
 * Retrieves the name and revenue of the top 3 accounts
 * const { value } = await _webApiFetch('GET', 'account', '?$select=name,revenue&$top=3');
 */
async function _webApiFetch(method, collection, options = '', data = null, customHeaders = {}) {
    const globalContext = PowerAppsApiService.getGlobalContext();
    let entitySetName = collection;

    const specialFunctions = ['RetrieveUserPrivileges'];
    const specialCollections = ['EntityDefinitions', 'entities', 'privileges'];
    
    const logicalName = collection.split('(')[0];
    const isSpecialCall = specialFunctions.includes(logicalName) || specialCollections.includes(logicalName);

    if (!isSpecialCall) {
        await _loadEntityMetadata();
        const resolvedSetName = _entitySetNameCache.get(logicalName);
        if (resolvedSetName) {
            entitySetName = collection.replace(logicalName, resolvedSetName);
        } else {
            if (!logicalName.endsWith('s')) {
                 entitySetName = collection.replace(logicalName, `${logicalName}s`);
            }
        }
    }

    let queryString = options || '';
    if (queryString && !queryString.startsWith('?')) {
        queryString = `?${queryString}`;
    }
    
    const apiUrl = `${globalContext.getClientUrl()}/api/data/v9.2/${entitySetName}${queryString}`;

    const headers = {
        'OData-MaxVersion': '4.0', 'OData-Version': '4.0', 'Accept': 'application/json',
        'Content-Type': 'application/json; charset=utf-8'
    };
    if (_impersonatedUserId) { headers['MSCRMCallerID'] = _impersonatedUserId; }
    
    Object.assign(headers, customHeaders); // Merge custom headers

    const fetchOptions = { method, headers };
    if (data) { fetchOptions.body = JSON.stringify(data); }
    
    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
        try {
            const errorData = await response.json();
            throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
        } catch (e) {
            throw new Error(`API Error: ${response.statusText} (Status ${response.status})`);
        }
    }

    if (response.status === 204) { return { status: 204 }; }
    if (response.status === 201) {
        const odataId = response.headers.get("OData-EntityId");
        const id = odataId.match(/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})/i)[0];
        return { id: id };
    }

    return response.json();
}

/**
 * A generic caching utility for data-fetching functions.
 * @param {string} key - The unique key for the cache entry.
 * @param {Function} fetcher - An async function that fetches the data if it's not in the cache.
 * @param {boolean} [bypassCache=false] - If true, ignores the cached value and re-fetches.
 * @returns {Promise<any>} The cached or newly fetched data.
 * @private
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
        const userMessage = `Data fetch failed for '${key}'. Check console for details.`;
        NotificationService.show(userMessage, 'error');
        console.error(`DataService fetch failed for key '${key}':`, error);
        throw new Error(userMessage);
    }
}

/**
 * Reliably gets the current form's ID, with null checks for context.
 * @returns {string|null} The form GUID or null if not found.
 * @private
 */
function _getFormIdReliably() {
    try {
        if (typeof Xrm !== 'undefined' && Xrm.Page && Xrm.Page.ui && Xrm.Page.ui.formSelector) {
            const currentItem = Xrm.Page.ui.formSelector.getCurrentItem();
            if (currentItem) {
                const formId = currentItem.getId();
                // Return the ID without the curly braces {}
                return formId ? formId.replace(/[{}]/g, "") : null;
            }
        }
        return null;
    } catch (e) {
        console.error("PDT: Error in _getFormIdReliably:", e);
        return null;
    }
}

/**
 * A shared function to parse form XML and extract both events and business rules.
 * @param {boolean} bypassCache - Whether to bypass the cache for this operation.
 * @returns {Promise<object|null>} An object containing automation details, or null if not on a form.
 * @private
 */
const _getAutomationsFromFormXml = async (bypassCache) => {
    return _fetch('formEventHandlers', async () => {
        const formId = _getFormIdReliably();
        if (!formId) {
            throw new Error("Could not identify the current Form ID. Please ensure this tool is opened on a record form.");
        }
        
        const formXmlResult = await _webApiFetch("GET", `systemforms(${formId})`, "?$select=formxml");

        if (!formXmlResult?.formxml) {
            throw new Error("Retrieved form data but it did not contain a 'formxml' definition.");
        }
        
        const xmlDoc = new DOMParser().parseFromString(formXmlResult.formxml, "text/xml");
        const automations = { OnLoad: [], OnSave: [] };
        xmlDoc.querySelectorAll("form > events > event").forEach(node => {
            const eventName = node.getAttribute("name");
            const handlers = Array.from(node.querySelectorAll("Handler")).map(h => ({
                library: h.getAttribute("libraryName"),
                function: h.getAttribute("functionName"),
                enabled: h.getAttribute("enabled") === 'true'
            }));
            if (eventName === 'onload') automations.OnLoad.push(...handlers);
            if (eventName === 'onsave') automations.OnSave.push(...handlers);
        });
        return automations;
    }, bypassCache);
};

/**
 * The public interface for the DataService, providing methods for data access and manipulation.
 * @namespace DataService
 */
export const DataService = {
    /**
     * Starts impersonating a specified user for all subsequent API calls.
     * @param {string} userId - The GUID of the user to impersonate.
     * @param {string} userName - The full name of the user to impersonate.
     */
    setImpersonation(userId, userName) {
        _impersonatedUserId = userId;
        _impersonatedUserName = userName;
        UIManager.showImpersonationIndicator(userName);
        NotificationService.show(`Impersonation started for ${userName}.`, 'success');
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
        NotificationService.show('Impersonation cleared.', 'info');
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
        const state = activate 
            ? { statecode: 1, statuscode: 2 } // State: Activated, Status: Activated
            : { statecode: 0, statuscode: 1 }; // State: Draft, Status: Draft
        return this.updateRecord('workflows', ruleId, state);
    },

    /**
     * Deletes a business rule record.
     * @param {string} ruleId - The GUID of the business rule's definition record.
     * @returns {Promise<object>}
     */
    deleteBusinessRule(ruleId) {
        return this.deleteRecord('workflows', ruleId);
    },

    /**
     * Creates or updates an Environment Variable Value.
     * @param {string} definitionId - The ID of the variable definition.
     * @param {string|null} valueId - The ID of the existing value record, or null if creating a new one.
     * @param {string} newValue - The new value to set.
     * @returns {Promise<object>} The result of the create or update operation.
     */
    async setEnvironmentVariableValue(definitionId, valueId, newValue) {
        const payload = { value: newValue };
        if (valueId) {
            return DataService.updateRecord('environmentvariablevalue', valueId, payload);
        }
        payload["environmentvariabledefinitionid@odata.bind"] = `/environmentvariabledefinitions(${definitionId})`;
        return DataService.createRecord('environmentvariablevalue', payload);
    },

    /**
     * Fetches entity definitions, filtering them based on the impersonated user's permissions if applicable.
     * @param {boolean} [bypassCache=false] - If true, re-fetches from the server.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of entity definitions.
     */
    getEntityDefinitions: (bypassCache = false) => {
        return _fetch('entityDefinitions', async () => {
            const response = await _webApiFetch('GET', 'EntityDefinitions');
            if (!response || !response.value) return [];
            const allDefinitions = response.value;

            if (!_impersonatedUserId) {
                const definitions = allDefinitions.map(_normalizeObjectKeys);
                definitions.forEach(def => _entitySetNameCache.set(def.LogicalName, def.EntitySetName));
                _isMetadataLoaded = true;
                return definitions;
            }

            const checkPromises = allDefinitions.map(async (def) => {
                if (def.EntitySetName) {
                    try {
                        await _webApiFetch('GET', def.EntitySetName, '$top=1');
                        return def;
                    } catch (error) {
                        return null;
                    }
                }
                return null;
            });

            const results = await Promise.all(checkPromises);
            const accessibleDefinitions = results.filter(Boolean);

            const definitions = accessibleDefinitions.map(_normalizeObjectKeys);
            definitions.forEach(def => _entitySetNameCache.set(def.LogicalName, def.EntitySetName));
            _isMetadataLoaded = true;
            return definitions;
        }, bypassCache);
    },

    /**
     * Fetches attribute definitions for a specific entity.
     * @param {string} entityLogicalName - The logical name of the entity.
     * @param {boolean} [bypassCache=false] - If true, re-fetches from the server.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of attribute definitions.
     */
    getAttributeDefinitions: (entityLogicalName, bypassCache = false) => {
        const key = `attrs_${entityLogicalName}`;
        return _fetch(key, async () => {
            const response = await _webApiFetch('GET', `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes`);
            return response?.value?.map(_normalizeObjectKeys) || [];
        }, bypassCache);
    },

    // --- Standard Web API Methods ---
    retrieveMultipleRecords: (entity, options, customHeaders = {}) => 
    _webApiFetch('GET', entity, options, null, false, customHeaders)
        .then(r => ({ entities: r.value, nextLink: r["@odata.nextLink"] })),
    retrieveRecord: (entity, id, options) => _webApiFetch('GET', `${entity}(${id})`, options),
    createRecord: (entity, data) => _webApiFetch('POST', entity, '', data),
    updateRecord: (entity, id, data) => _webApiFetch('PATCH', `${entity}(${id})`, '', data),
    deleteRecord: (entity, id) => _webApiFetch('DELETE', `${entity}(${id})`),
    executeFetchXml: (entityName, fetchXml, customHeaders = {}) => 
    _webApiFetch('GET', entityName, `?fetchXml=${encodeURIComponent(fetchXml)}`, null, false, customHeaders)
        .then(r => ({ entities: r.value })),

    /**
     * Clears all internal data and metadata caches.
     * @param {string|null} [key=null] - An optional specific key to clear from the main data cache.
     */
    clearCache(key = null) {
        if (key) {
            _cache.delete(key);
        } else {
            _cache.clear();
            _entitySetNameCache.clear();
            _isMetadataLoaded = false;
            _metadataPromise = null;
        }
    },

    /**
     * Fetches all Environment Variable definitions and their current values.
     * @param {boolean} [bypassCache=false] - If true, re-fetches from the server.
     * @returns {Promise<EnvironmentVariable[]>} A promise that resolves to an array of environment variables.
     */
    getEnvironmentVariables: (bypassCache = false) => _fetch('envVars', async () => {
        const options = "?$select=schemaname,displayname,type,defaultvalue,environmentvariabledefinitionid&$expand=environmentvariabledefinition_environmentvariablevalue($select=value,environmentvariablevalueid)";
        const response = await DataService.retrieveMultipleRecords("environmentvariabledefinition", options);
        return response.entities.map(d => ({
            definitionId: d.environmentvariabledefinitionid,
            valueId: d.environmentvariabledefinition_environmentvariablevalue[0]?.environmentvariablevalueid,
            schemaName: d.schemaname, displayName: d.displayname,
            type: d["type@OData.Community.Display.V1.FormattedValue"] || 'Unknown',
            defaultValue: d.defaultvalue || '—',
            currentValue: d.environmentvariabledefinition_environmentvariablevalue[0]?.value ?? '(not set)'
        }));
    }, bypassCache),

    /**
     * Gets the complete UI hierarchy (Tabs > Sections > Controls) from the current form context.
     * @param {boolean} [bypassCache=false] - If true, re-evaluates the form hierarchy.
     * @returns {Array<object>}
     */
    getFormHierarchy: (bypassCache = false) => _fetch('formHierarchy', () => {
        const tabs = PowerAppsApiService.getAllTabs();
        if (!tabs?.length) return [];
        const mapControl = ctrl => {
            try {
                const controlType = ctrl.getControlType(); let value = `[${controlType}]`; let editableAttr = null;
                if (ctrl.getAttribute) {
                    const attr = ctrl.getAttribute(); if (attr) { value = attr.getValue(); editableAttr = attr; } else { value = '[No Attribute]'; }
                } else if (controlType.includes('subgrid')) { value = `Entity: ${ctrl.getEntityName()} | Records: ${ctrl.getGrid().getTotalRecordCount()}`; }
                return { label: ctrl.getLabel(), logicalName: ctrl.getName(), value, editableAttr, controlType };
            } catch (e) { return { label: ctrl?.getName?.() || 'Errored Control', logicalName: `Error: ${e.message}`, value: '—' }; }
        };
        const mapSection = section => ({ label: `Section: ${section.getLabel()}`, logicalName: section.getName(), children: (section.controls?.get() || []).map(mapControl) });
        return tabs.map(tab => ({ label: `Tab: ${tab.getLabel()}`, logicalName: tab.getName(), children: (tab.sections?.get() || []).map(mapSection) }));
    }, bypassCache),

    /**
     * Gets a detailed list of all columns (attributes) present on the current form.
     * @param {boolean} [bypassCache=false] - If true, re-evaluates the form attributes.
     * @returns {Promise<FormColumn[]>} A promise that resolves to an array of form column objects.
     */
    getFormColumns: (bypassCache = false) => _fetch('formColumns', () => {
        return PowerAppsApiService.getAllAttributes().map(attribute => {
            let displayName = attribute.getName();
            if (attribute.controls.getLength() > 0) { displayName = attribute.controls.get(0).getLabel(); }
            return {
                displayName: displayName, logicalName: attribute.getName(),
                value: Helpers.formatDisplayValue(attribute.getValue(), attribute), type: attribute.getAttributeType(),
                isDirty: attribute.getIsDirty(), requiredLevel: attribute.getRequiredLevel(), attribute: attribute
            };
        });
    }, bypassCache),

    /**
     * Gets the list of event handlers (OnLoad, OnSave) from the form's definition XML.
     * @param {boolean} [bypassCache=false] - If true, re-fetches the form XML.
     * @returns {Promise<object|null>}
     */
    getFormEventHandlers: async (bypassCache = false) => {
        return _getAutomationsFromFormXml(bypassCache);
    },

    /**
     * Gets all business rule definitions (active and inactive) for a specific entity.
     * @param {string} entityName - The logical name of the entity.
     * @returns {Promise<Array<object>>}
     */
    getBusinessRulesForEntity: (entityName) => {
        // Create a unique cache key for each entity's business rules.
        const cacheKey = `businessRules_${entityName}`;
        return _fetch(cacheKey, async () => {
            if (!entityName) return [];
            
            const entityMetadata = await PowerAppsApiService.getEntityMetadata(entityName);
            const objectTypeCode = entityMetadata.ObjectTypeCode;

            const fetchXml = `
                <fetch>
                <entity name="workflow">
                    <attribute name="name" /><attribute name="workflowid" /><attribute name="scope" />
                    <attribute name="clientdata" /><attribute name="type" /><attribute name="parentworkflowid" />
                    <attribute name="statuscode" /><attribute name="description" />
                    <filter type="and">
                    <condition attribute="category" operator="eq" value="2" />
                    <condition attribute="primaryentity" operator="eq" value="${objectTypeCode}" />
                    </filter>
                </entity>
                </fetch>`;
            
            const headers = { 'Prefer': 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' };
            const response = await DataService.executeFetchXml("workflows", fetchXml, headers);

            if (!response.entities || response.entities.length === 0) return [];

            const definitions = response.entities.filter(rule => rule.type === 1);
            const activations = response.entities.filter(rule => rule.type === 2);
            const activeDefinitionIds = new Set(
                activations.filter(act => act.statuscode === 2).map(act => act._parentworkflowid_value)
            );
            
            return definitions.map(def => ({
                name: def.name, id: def.workflowid,
                scope: def['scope@OData.Community.Display.V1.FormattedValue'] || 'Unknown',
                isActive: activeDefinitionIds.has(def.workflowid),
                clientData: def.clientdata, description: def.description
            }));
        });
    },

/**
     * Gets the event handlers from the primary main form of a specified entity.
     * @param {string} entityName - The logical name of the entity.
     * @param {boolean} [bypassCache=false] - If true, re-fetches from the server.
     * @returns {Promise<object|null>} An object with OnLoad/OnSave handlers, or null if not found.
     */
    getFormEventHandlersForEntity: async (entityName, bypassCache = false) => {
        const cacheKey = `formEventHandlers_${entityName}`;
        return _fetch(cacheKey, async () => {
            if (!entityName) return null;

            // NOTE: The entity name must be in single quotes for the OData query.
            const formQueryOptions = `?$filter=objecttypecode eq '${entityName}' and type eq 2&$select=formid&$top=1`;
            const formResult = await DataService.retrieveMultipleRecords("systemform", formQueryOptions);

            if (!formResult?.entities?.length) {
                return null;
            }
            const formId = formResult.entities[0].formid;

            // Retrieve the FormXML for that form
            const formRecord = await DataService.retrieveRecord("systemform", formId, "?$select=formxml");
            if (!formRecord?.formxml) {
                return null; // Form record found, but no XML content
            }

            // Parse the FormXML to extract event handlers
            const xmlDoc = new DOMParser().parseFromString(formRecord.formxml, "text/xml");
            const automations = { OnLoad: [], OnSave: [] };
            xmlDoc.querySelectorAll("form > events > event").forEach(node => {
                const eventName = node.getAttribute("name");
                const handlers = Array.from(node.querySelectorAll("Handler")).map(h => ({
                    library: h.getAttribute("libraryName"),
                    function: h.getAttribute("functionName"),
                    enabled: h.getAttribute("enabled") === 'true'
                }));
                if (eventName === 'onload') automations.OnLoad.push(...handlers);
                if (eventName === 'onsave') automations.OnSave.push(...handlers);
            });
            return automations;

        }, bypassCache);
    },

    /**
     * Retrieves all columns for the current record by merging form attributes with a full Web API retrieve.
     * @param {boolean} [bypassCache=false] - If true, re-fetches the data from the server.
     * @returns {Promise<FormColumn[]>} A promise that resolves to the merged list of all columns.
     */
    getAllRecordColumns: (bypassCache = false) => _fetch('allRecordColumns', async () => {
        const entityName = PowerAppsApiService.getEntityName();
        const entityId = PowerAppsApiService.getEntityId();
        if (!entityId) return DataService.getFormColumns(bypassCache);

        const [formData, recordData] = await Promise.all([ DataService.getFormColumns(bypassCache), DataService.retrieveRecord(entityName, entityId) ]);
        const formColumnMap = new Map(formData.map(c => [c.logicalName, c]));
        const allColumns = [];

        for (const key in recordData) {
            const isSystem = Helpers.isOdataProperty(key); const formColumn = formColumnMap.get(key);
            if (formColumn) {
                allColumns.push({ ...formColumn, onForm: true, isSystem }); formColumnMap.delete(key);
            } else {
                allColumns.push({
                    displayName: key, logicalName: key, value: Helpers.formatDisplayValue(recordData[key]),
                    type: typeof recordData[key], isDirty: false, requiredLevel: 'none',
                    attribute: null, onForm: false, isSystem
                });
            }
        }
        for (const formColumn of formColumnMap.values()) { allColumns.push({ ...formColumn, onForm: true, isSystem: false }); }
        return allColumns;
    }, bypassCache),

    /**
     * Gets performance metrics for the current form load.
     * @param {boolean} [bypassCache=false] - If true, re-evaluates performance timings.
     * @returns {object}
     */
    getPerformanceDetails: (bypassCache = false) => _fetch('perfDetails', () => {
        const perfInfo = PowerAppsApiService.getPerformanceInfo();
        const details = { totalLoadTime: "N/A", isApiAvailable: false, breakdown: { network: 0, server: 0, client: 0 } };
        if (perfInfo?.FCL) {
            const totalLoad = perfInfo.FCL; const network = perfInfo.Network || 0; const server = perfInfo.Server || 0;
            details.isApiAvailable = true; details.totalLoadTime = totalLoad.toFixed(0);
            details.breakdown = { network, server, client: Math.max(0, totalLoad - network - server) };
        } else if (window.performance?.getEntriesByType) {
            const navEntry = window.performance.getEntriesByType("navigation")[0];
            if (navEntry) details.totalLoadTime = (navEntry.loadEventEnd - navEntry.startTime).toFixed(0);
        }
        const allTabs = PowerAppsApiService.getAllTabs();
        details.uiCounts = {
            tabs: allTabs.length,
            sections: allTabs.reduce((acc, tab) => acc + (tab.sections?.get?.().length || 0), 0),
            controls: PowerAppsApiService.getAllControls().length,
            onChange: PowerAppsApiService.getAllAttributes().reduce((acc, attr) => acc + (attr.getOnChange?.().length || 0), 0)
        };
        return details;
    }, bypassCache),

    /**
     * Gets a comprehensive object detailing the current user, client, and organization context.
     * @param {boolean} [bypassCache=false] - If true, re-evaluates the context.
     * @returns {object}
     */
    getEnhancedUserContext: (bypassCache = false) => _fetch('userContext', async () => {
        const gc = PowerAppsApiService.getGlobalContext();
        const clientInfo = { type: gc.client.getClient(), formFactor: ['Unknown', 'Desktop', 'Tablet', 'Phone'][gc.client.getFormFactor()], isOffline: gc.client.isOffline(), appUrl: gc.getClientUrl() };
        const orgInfo = { name: gc.organizationSettings.uniqueName, id: gc.organizationSettings.organizationId, version: gc.getVersion(), isAutoSave: gc.organizationSettings.isAutoSaveEnabled };
        
        let userInfo;

        if (!_impersonatedUserId) {
            // No impersonation, use the fast client-side context for the logged-in user.
            const roles = gc.userSettings.roles.getAll().map(r => r.name);
            userInfo = { name: gc.userSettings.userName, id: gc.userSettings.userId.replace(/[{}]/g, ''), language: gc.userSettings.languageId, roles };
        } else {
            // Impersonation is active, fetch all details from the server.
            const userData = await DataService.retrieveRecord('systemusers', _impersonatedUserId, "?$select=fullname,systemuserid");

            // Get roles assigned directly to the user.
            const directRolesResponse = await _webApiFetch('GET', `systemusers(${_impersonatedUserId})/systemuserroles_association?$select=name`);
            const directRoles = directRolesResponse.value?.map(r => r.name) || [];

            // Get roles inherited from the user's teams.
            const teamsResponse = await _webApiFetch('GET', `systemusers(${_impersonatedUserId})/teammembership_association?$select=teamid`);
            const teamIds = teamsResponse.value?.map(t => t.teamid) || [];
            let teamRoles = [];

            if (teamIds.length > 0) {
                const teamRolePromises = teamIds.map(teamId => 
                    _webApiFetch('GET', `teams(${teamId})/teamroles_association?$select=name`)
                );
                const teamRoleResults = await Promise.all(teamRolePromises);
                teamRoles = teamRoleResults.flatMap(result => result.value?.map(r => r.name) || []);
            }

            // Combine, de-duplicate, and sort the roles.
            const allRolesSet = new Set([...directRoles, ...teamRoles]);
            
            userInfo = {
                name: userData.fullname,
                id: userData.systemuserid,
                language: 'N/A (Impersonated)', 
                roles: Array.from(allRolesSet).sort()
            };
        }

        return { user: userInfo, client: clientInfo, organization: orgInfo };
    }, bypassCache),
    
    /**
     * Fetches a page of Plugin Trace Logs from the server.
     * @param {string} options - The OData query options for filtering and ordering.
     * @returns {Promise<object>}
     */
    getPluginTraceLogs: async (options, pageSize) => {
        const globalContext = PowerAppsApiService.getGlobalContext();
        
        let queryString = options || '';
        if (queryString && !queryString.startsWith('?')) {
            queryString = `?${queryString}`;
        }
        const apiUrl = `${globalContext.getClientUrl()}/api/data/v9.2/plugintracelogs${queryString}`;

        const headers = {
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json; charset=utf-8',
            'Prefer': `odata.maxpagesize=${pageSize}` // This header forces server-side pagination.
        };
        if (_impersonatedUserId) {
            headers['MSCRMCallerID'] = _impersonatedUserId;
        }
        
        const fetchOptions = {
            method: 'GET',
            headers: headers
        };
        
        const response = await fetch(apiUrl, fetchOptions);

        if (!response.ok) {
            try {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
            } catch (e) {
                throw new Error(`API Error: ${response.statusText} (Status ${response.status})`);
            }
        }

        const result = await response.json();
        return { entities: result.value, nextLink: result["@odata.nextLink"] };
    },
};