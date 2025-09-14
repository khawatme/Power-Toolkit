/**
 * @file Data access layer for the application.
 * @module services/DataService
 * @description Handles all data retrieval, shaping, caching, and impersonation logic.
 */

import { PowerAppsApiService } from './PowerAppsApiService.js';
import { NotificationService } from './NotificationService.js';
import { Helpers } from '../utils/Helpers.js';
import { UIManager } from '../core/UIManager.js';

const _cache = new Map();
let _impersonatedUserId = null;
let _impersonatedUserName = null;
const _entitySetNameCache = new Map();
let _isMetadataLoaded = false;

/**
 * Normalizes an object's keys to PascalCase to handle API inconsistencies.
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
 * This is done once and cached to avoid repeated lookups.
 * @private
 */
async function _loadEntityMetadata() {
    if (_isMetadataLoaded) return;
    try {
        // Use _webApiFetch with a hardcoded, known-correct collection name that bypasses the lookup.
        const response = await _webApiFetch('GET', 'EntityDefinitions', '?$select=LogicalName,EntitySetName');
        if (response && response.value) {
            response.value.forEach(entity => {
                _entitySetNameCache.set(entity.LogicalName, entity.EntitySetName);
            });
            // Add special cases that don't appear in standard entity metadata
            _entitySetNameCache.set('plugintracelog', 'plugintracelogs');
            _isMetadataLoaded = true;
            console.log("PDT: Entity metadata loaded and cached.");
        }
    } catch (e) {
        console.error("PDT: Failed to load entity metadata.", e);
        NotificationService.show("Could not load entity metadata for API calls.", "error");
    }
}

/**
 * A private, central function for executing Web API requests using the native fetch API.
 * This now includes logic to resolve the correct entity set name.
 * @private
 */
async function _webApiFetch(method, collection, options = '', data = null) {
    const globalContext = PowerAppsApiService.getGlobalContext();
    let entitySetName = collection;

    // For requests that use an entity name, resolve it to the correct entity set name.
    const specialCollections = ['EntityDefinitions'];
    if (!specialCollections.includes(collection.split('(')[0])) {
        await _loadEntityMetadata(); // Ensure metadata is available
        const logicalName = collection.split('(')[0];
        const resolvedSetName = _entitySetNameCache.get(logicalName);
        if (resolvedSetName) {
            entitySetName = collection.replace(logicalName, resolvedSetName);
        } else {
            // Fallback for custom entities not yet in metadata cache; this is a best-effort guess.
            console.warn(`PDT: Entity set name for '${logicalName}' not in cache. Using provided name or guessing plural.`);
            if (!logicalName.endsWith('s')) {
                 entitySetName = collection.replace(logicalName, `${logicalName}s`);
            }
        }
    }

    const queryString = (options && !options.startsWith('?')) ? `?${options}` : (options || '');
    const apiUrl = `${globalContext.getClientUrl()}/api/data/v9.2/${entitySetName}${queryString}`;

    const headers = {
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=utf-8'
    };
    if (_impersonatedUserId) { headers['MSCRMCallerID'] = _impersonatedUserId; }
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
 * A generic fetch utility with built-in caching and error handling.
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
 * A shared function to parse form XML and extract both events and business rules.
 * @private
 */
const _getAutomationsFromFormXml = async (bypassCache) => {
    return _fetch('formAutomations', async () => {
        const formId = PowerAppsApiService.getFormId();
        if (!formId) return null;
        const formXmlResult = await _webApiFetch("GET", `systemform(${formId})`, "?$select=formxml");
        if (!formXmlResult?.formxml) return null;
        const xmlDoc = new DOMParser().parseFromString(formXmlResult.formxml, "text/xml");
        const automations = { OnLoad: [], OnSave: [], BusinessRules: [] };
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
        xmlDoc.querySelectorAll("form > businessrules > businessrule").forEach(node => {
            const ruleName = node.getAttribute("name");
            const ruleId = node.getAttribute("id");
            const isEnabled = node.querySelector("IsEnabled")?.getAttribute("id") === 'true';
            if (ruleName && isEnabled) {
                automations.BusinessRules.push({
                    name: ruleName,
                    id: ruleId,
                    scope: 'Form',
                    isActive: isEnabled
                });
            }
        });
        return automations;
    }, bypassCache);
};

export const DataService = {
    // --- IMPERSONATION METHODS ---
    setImpersonation(userId, userName) {
        _impersonatedUserId = userId;
        _impersonatedUserName = userName;
        UIManager.showImpersonationIndicator(userName);
        NotificationService.show(`Impersonation started for ${userName}.`, 'success');
        this.clearCache();
    },
    clearImpersonation() {
        _impersonatedUserId = null;
        _impersonatedUserName = null;
        UIManager.showImpersonationIndicator(null);
        NotificationService.show('Impersonation cleared.', 'info');
        this.clearCache();
    },
    getImpersonationInfo() {
        return {
            isImpersonating: !!_impersonatedUserId,
            userId: _impersonatedUserId,
            userName: _impersonatedUserName
        };
    },
    
    /**
     * Creates or updates an Environment Variable Value.
     * @param {string} definitionId - The ID of the variable definition.
     * @param {string|null} valueId - The ID of the existing value record, or null if it doesn't exist.
     * @param {string} newValue - The new value to set.
     * @returns {Promise<object>}
     */
    async setEnvironmentVariableValue(definitionId, valueId, newValue) {
        const payload = { value: newValue };

        if (valueId) {
            // Value exists, so update it (PATCH).
            return DataService.updateRecord('environmentvariablevalue', valueId, payload);
        } else {
            // No value exists, so create a new one (POST).
            // We need to link it to the definition.
            payload["environmentvariabledefinitionid@odata.bind"] = `/environmentvariabledefinitions(${definitionId})`;
            return DataService.createRecord('environmentvariablevalue', payload);
        }
    },

    // --- Metadata METHODS ---
    /**
     * Fetches and caches the definitions for all entities in the environment.
     * @param {boolean} [bypassCache=false] - Whether to bypass the cache.
     * @returns {Promise<Array<object>>}
     */
    getEntityDefinitions: (bypassCache = false) => {
        return _fetch('entityDefinitions', async () => {
            const response = await _webApiFetch('GET', 'EntityDefinitions');
            if (!response || !response.value) return [];

            const definitions = response.value.map(_normalizeObjectKeys);
            
            definitions.forEach(def => _entitySetNameCache.set(def.LogicalName, def.EntitySetName));
            _isMetadataLoaded = true;
            
            return definitions;
        }, bypassCache);
    },

    /**
     * Fetches and caches the attribute definitions for a specific entity.
     * @param {string} entityLogicalName - The logical name of the entity.
     * @param {boolean} [bypassCache=false] - Whether to bypass the cache.
     * @returns {Promise<Array<object>>}
     */
    getAttributeDefinitions: (entityLogicalName, bypassCache = false) => {
        const key = `attrs_${entityLogicalName}`;
        return _fetch(key, async () => {
            const response = await _webApiFetch('GET', `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes`);
            if (!response || !response.value) return [];
            return response.value.map(_normalizeObjectKeys);
        }, bypassCache);
    },

    // --- WEB API METHODS ---
    retrieveMultipleRecords: (entity, options) => _webApiFetch('GET', entity, options).then(r => ({ entities: r.value, nextLink: r["@odata.nextLink"] })),
    retrieveRecord: (entity, id, options) => _webApiFetch('GET', `${entity}(${id})`, options),
    createRecord: (entity, data) => _webApiFetch('POST', entity, '', data),
    updateRecord: (entity, id, data) => _webApiFetch('PATCH', `${entity}(${id})`, '', data),
    deleteRecord: (entity, id) => _webApiFetch('DELETE', `${entity}(${id})`),
    executeFetchXml: (entityName, fetchXml) => _webApiFetch('GET', entityName, `?fetchXml=${encodeURIComponent(fetchXml)}`).then(r => ({ entities: r.value })),

    /**
     * Clears all internal caches, forcing a full data and metadata refresh on the next request.
     * This is critical for features like impersonation to work correctly.
     * @param {string|null} [key=null] - An optional specific key to clear from the main cache.
     */
    clearCache(key = null) {
        if (key) {
            _cache.delete(key);
            console.log(`PDT Cache cleared for: ${key}.`);
        } else {
            // This is the crucial change: clear all three internal caches.
            _cache.clear();
            _entitySetNameCache.clear();
            _isMetadataLoaded = false;
            console.log(`PDT Cache cleared completely.`);
        }
    },

    getEnvironmentVariables: (bypassCache = false) => _fetch('envVars', async () => {
        // Fetch the definition ID and the value ID for updating
        const options = "?$select=schemaname,displayname,type,defaultvalue,environmentvariabledefinitionid&$expand=environmentvariabledefinition_environmentvariablevalue($select=value,environmentvariablevalueid)";
        const response = await DataService.retrieveMultipleRecords("environmentvariabledefinition", options);
        return response.entities.map(d => ({
            definitionId: d.environmentvariabledefinitionid,
            valueId: d.environmentvariabledefinition_environmentvariablevalue[0]?.environmentvariablevalueid,
            schemaName: d.schemaname,
            displayName: d.displayname,
            type: d["type@OData.Community.Display.V1.FormattedValue"] || 'Unknown',
            defaultValue: d.defaultvalue || '—',
            currentValue: d.environmentvariabledefinition_environmentvariablevalue[0]?.value ?? '(not set)'
        }));
    }, bypassCache),

    getFormHierarchy: (bypassCache = false) => _fetch('formHierarchy', () => {
        const tabs = PowerAppsApiService.getAllTabs();
        if (!tabs?.length) return [];
        const mapControl = ctrl => {
            try {
                const controlType = ctrl.getControlType();
                let value = `[${controlType}]`;
                let editableAttr = null;
                if (ctrl.getAttribute) {
                    const attr = ctrl.getAttribute();
                    if (attr) {
                        value = attr.getValue();
                        editableAttr = attr;
                    } else {
                        value = '[No Attribute]';
                    }
                } else if (controlType.includes('subgrid')) {
                    const grid = ctrl.getGrid();
                    value = `Entity: ${ctrl.getEntityName()} | Records: ${grid.getTotalRecordCount()}`;
                }
                return { label: ctrl.getLabel(), logicalName: ctrl.getName(), value, editableAttr, controlType };
            } catch (e) {
                return { label: ctrl?.getName?.() || 'Errored Control', logicalName: `Error: ${e.message}`, value: '—' };
            }
        };
        const mapSection = section => ({
            label: `Section: ${section.getLabel()}`,
            logicalName: section.getName(),
            children: (section.controls?.get() || []).map(mapControl)
        });
        return tabs.map(tab => ({
            label: `Tab: ${tab.getLabel()}`,
            logicalName: tab.getName(),
            children: (tab.sections?.get() || []).map(mapSection)
        }));
    }, bypassCache),

    getFormColumns: (bypassCache = false) => _fetch('formColumns', () => {
        return PowerAppsApiService.getAllAttributes().map(attribute => {
            let displayName = attribute.getName();
            if (attribute.controls.getLength() > 0) {
                displayName = attribute.controls.get(0).getLabel();
            }
            return {
                displayName: displayName,
                logicalName: attribute.getName(),
                value: Helpers.formatDisplayValue(attribute.getValue(), attribute),
                type: attribute.getAttributeType(),
                isDirty: attribute.getIsDirty(),
                requiredLevel: attribute.getRequiredLevel(),
                attribute: attribute
            };
        });
    }, bypassCache),

    getFormEventHandlers: async (bypassCache = false) => {
        const automations = await _getAutomationsFromFormXml(bypassCache);
        return automations ? { OnLoad: automations.OnLoad, OnSave: automations.OnSave } : null;
    },

    getBusinessRulesForCurrentEntity: async (bypassCache = false) => {
        const automations = await _getAutomationsFromFormXml(bypassCache);
        return automations ? automations.BusinessRules : [];
    },

    /**
     * Retrieves all columns for the current record by merging form attributes with a full Web API retrieve.
     * @param {boolean} [bypassCache=false] - If true, re-fetches the data from the server.
     * @returns {Promise<Array<object>>} A promise that resolves to the merged list of all columns.
     */
    getAllRecordColumns: (bypassCache = false) => _fetch('allRecordColumns', async () => {
        const entityName = PowerAppsApiService.getEntityName();
        const entityId = PowerAppsApiService.getEntityId();
        if (!entityId) return DataService.getFormColumns(bypassCache); // Fallback for unsaved records

        const [formData, recordData] = await Promise.all([
            DataService.getFormColumns(bypassCache),
            DataService.retrieveRecord(entityName, entityId)
        ]);

        const formColumnMap = new Map(formData.map(c => [c.logicalName, c]));
        const allColumns = [];

        for (const key in recordData) {
            const isSystem = Helpers.isOdataProperty(key); 
            const formColumn = formColumnMap.get(key);
            
            if (formColumn) {
                // Column is on the form, use its data and mark it as such
                allColumns.push({ ...formColumn, onForm: true, isSystem });
                formColumnMap.delete(key); // Remove from map to track what's left
            } else {
                // Column is not on the form, create a new entry for it
                allColumns.push({
                    displayName: key,
                    logicalName: key,
                    value: Helpers.formatDisplayValue(recordData[key]),
                    type: typeof recordData[key],
                    isDirty: false,
                    requiredLevel: 'none',
                    attribute: null,
                    onForm: false,
                    isSystem
                });
            }
        }

        // Add any remaining columns from the form that weren't in the Web API response
        for (const formColumn of formColumnMap.values()) {
            allColumns.push({ ...formColumn, onForm: true, isSystem: false });
        }
        
        return allColumns;
    }, bypassCache),

    getPerformanceDetails: (bypassCache = false) => _fetch('perfDetails', () => {
        const perfInfo = PowerAppsApiService.getPerformanceInfo();
        const details = { totalLoadTime: "N/A", isApiAvailable: false, breakdown: { network: 0, server: 0, client: 0 } };
        if (perfInfo?.FCL) {
            const totalLoad = perfInfo.FCL;
            const network = perfInfo.Network || 0;
            const server = perfInfo.Server || 0;
            details.isApiAvailable = true;
            details.totalLoadTime = totalLoad.toFixed(0);
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

    getEnhancedUserContext: (bypassCache = false) => _fetch('userContext', () => {
        const gc = PowerAppsApiService.getGlobalContext();
        const roles = gc.userSettings.roles.getAll().map(r => r.name);
        return {
            user: { name: gc.userSettings.userName, id: gc.userSettings.userId.replace(/[{}]/g, ''), language: gc.userSettings.languageId, roles },
            client: { type: gc.client.getClient(), formFactor: ['Unknown', 'Desktop', 'Tablet', 'Phone'][gc.client.getFormFactor()], isOffline: gc.client.isOffline(), appUrl: gc.getClientUrl() },
            organization: { name: gc.organizationSettings.uniqueName, id: gc.organizationSettings.organizationId, version: gc.getVersion(), isAutoSave: gc.organizationSettings.isAutoSaveEnabled }
        };
    }, bypassCache),
    
    getPluginTraceLogs: (options) => _webApiFetch('GET', 'plugintracelogs', options).then(r => ({ entities: r.value, nextLink: r["@odata.nextLink"] }))
};