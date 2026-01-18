/**
 * @file Metadata retrieval and caching service
 * @module services/MetadataService
 * @description Handles entity and attribute metadata operations with intelligent caching
 */

import { Config } from '../constants/index.js';
import { NotificationService } from './NotificationService.js';

/** @private @type {Map<string, string>} Caches logical name → entity set name */
const _entitySetNameCache = new Map();
/** @private @type {Map<string, string>} Caches entity set name → logical name */
const _entityBySetNameCache = new Map();
/** @private @type {boolean} Singleton flag for metadata loading */
let _isMetadataLoaded = false;
/** @private @type {Promise|null} Prevents concurrent metadata loading */
let _metadataPromise = null;
/** @private @type {Map<string, any>} Caches metadata fetch results */
const _metadataCache = new Map();

/**
 * Normalize keys to PascalCase for consistency between FetchXML and Web API.
 * @private
 * @param {object} obj
 * @returns {object}
 */
function _normalizeObjectKeys(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(_normalizeObjectKeys);
    }
    return Object.entries(obj).reduce((acc, [key, value]) => {
        const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
        acc[pascalKey] = _normalizeObjectKeys(value);
        return acc;
    }, {});
}

/**
 * Generic cached fetch helper for metadata operations.
 * @private
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Async function that retrieves the data
 * @param {boolean} bypassCache - Force refresh
 * @returns {Promise<any>}
 */
async function _fetch(key, fetchFn, bypassCache = false) {
    if (!bypassCache && _metadataCache.has(key)) {
        return _metadataCache.get(key);
    }
    const result = await fetchFn();
    _metadataCache.set(key, result);
    return result;
}

export const MetadataService = {
    /**
     * Fetch all entity metadata and cache set/logical name mappings (singleton pattern).
     * @private Internal use - called automatically by other metadata methods
     * @param {Function} webApiFetch - Web API fetch function from DataService
     * @param {string|null} impersonatedUserId - Current impersonation ID
     * @returns {Promise<void>}
     */
    // eslint-disable-next-line require-await
    async loadEntityMetadata(webApiFetch, impersonatedUserId = null) {
        if (_isMetadataLoaded) {
            return Promise.resolve();
        }
        if (_metadataPromise) {
            return _metadataPromise;
        }

        _metadataPromise = (async () => {
            try {
                const response = await webApiFetch('GET', 'EntityDefinitions', '?$select=LogicalName,EntitySetName');
                if (response && response.value) {
                    response.value.forEach(entity => {
                        _entitySetNameCache.set(entity.LogicalName, entity.EntitySetName);
                        _entityBySetNameCache.set(entity.EntitySetName, entity.LogicalName);
                    });
                    // Known exception for plugin trace logs
                    _entitySetNameCache.set('plugintracelog', 'plugintracelogs');
                    _isMetadataLoaded = true;
                }
            } catch (e) {
                // Check if it's a permission error (403 or prvReadEntity privilege)
                const is403Error = e.message?.includes('Status 403') || e.message?.includes('prvReadEntity');
                if (is403Error) {
                    if (impersonatedUserId) {
                        NotificationService.show(Config.MESSAGES.DATA_SERVICE.limitedMetadata, 'warn');
                    }
                    _isMetadataLoaded = true; // Mark as loaded to prevent infinite retry
                    return Promise.resolve(); // Silent failure for impersonated users without metadata permissions
                }
                throw e; // Re-throw other errors
            }
            return Promise.resolve(); // Explicit return for consistency
        })();

        return _metadataPromise;
    },

    /**
     * Get entity set name from logical name (uses cache).
     * @param {string} logicalName - Entity logical name
     * @returns {string|null} Entity set name or null
     */
    getEntitySetName(logicalName) {
        return _entitySetNameCache.get(logicalName) || null;
    },

    /**
     * Get logical name from entity set name (uses cache).
     * @param {string} entitySetName - Entity set name
     * @returns {string|null} Logical name or null
     */
    getLogicalName(entitySetName) {
        return _entityBySetNameCache.get(entitySetName) || null;
    },

    /**
     * Check if metadata has been loaded.
     * @returns {boolean}
     */
    isMetadataLoaded() {
        return _isMetadataLoaded;
    },

    /**
     * Fetch all entity definitions with permission filtering for impersonated users.
     * @param {Function} webApiFetch - Web API fetch function from DataService
     * @param {string|null} impersonatedUserId - Current impersonation ID
     * @param {boolean} bypassCache - Force refresh
     * @returns {Promise<Array<object>>}
     */
    // eslint-disable-next-line require-await
    async getEntityDefinitions(webApiFetch, impersonatedUserId = null, bypassCache = false) {
        return _fetch('entityDefinitions', async () => {
            try {
                const response = await webApiFetch('GET', 'EntityDefinitions');
                if (!response || !response.value) {
                    return [];
                }
                const allDefinitions = response.value;

                if (!impersonatedUserId) {
                    const definitions = allDefinitions.map(_normalizeObjectKeys);
                    definitions.forEach(def => _entitySetNameCache.set(def.LogicalName, def.EntitySetName));
                    _isMetadataLoaded = true;
                    return definitions;
                }

                // For impersonated users, test access to each entity
                const checkPromises = allDefinitions.map(async (def) => {
                    if (def.EntitySetName) {
                        try {
                            await webApiFetch('GET', def.EntitySetName, '$top=1');
                            return def;
                        } catch {
                            return null; // No access
                        }
                    }
                    return null;
                });

                const results = await Promise.all(checkPromises);
                const accessibleDefinitions = results.filter(Boolean);
                const definitions = accessibleDefinitions.map(_normalizeObjectKeys);
                definitions.forEach(def => {
                    _entitySetNameCache.set(def.LogicalName, def.EntitySetName);
                    _entityBySetNameCache.set(def.EntitySetName, def.LogicalName);
                });
                _isMetadataLoaded = true;
                return definitions;
            } catch (e) {
                const is403Error = e.message?.includes('Status 403') || e.message?.includes('prvReadEntity');
                if (is403Error) {
                    NotificationService.show(Config.MESSAGES.DATA_SERVICE.limitedMetadata, 'warn');
                    return [];
                }
                throw e;
            }
        }, bypassCache);
    },

    /**
     * Fetch attribute definitions for a specific entity.
     * @param {Function} webApiFetch - Web API fetch function from DataService
     * @param {string} entityLogicalName - Entity logical name
     * @param {boolean} bypassCache - Force refresh
     * @returns {Promise<Array<object>>}
     */
    // eslint-disable-next-line require-await
    async getAttributeDefinitions(webApiFetch, entityLogicalName, bypassCache = false) {
        const key = `attrs_${entityLogicalName}`;
        return _fetch(key, async () => {
            const response = await webApiFetch('GET', `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes`);
            return response?.value?.map(_normalizeObjectKeys) || [];
        }, bypassCache);
    },

    /**
     * Resolve entity by entity set name.
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string|null} impersonatedUserId - Current impersonation ID
     * @param {string} entitySetName - Entity set name to resolve
     * @returns {Promise<{LogicalName:string, EntitySetName:string}|null>}
     */
    async getEntityBySetName(webApiFetch, impersonatedUserId, entitySetName) {
        await this.loadEntityMetadata(webApiFetch, impersonatedUserId);
        const logical = _entityBySetNameCache.get(entitySetName);
        if (logical) {
            return { LogicalName: logical, EntitySetName: entitySetName };
        }

        // Not in cache - try fetching all definitions
        const defs = await this.getEntityDefinitions(webApiFetch, impersonatedUserId, true);
        const found = defs.find(d => d.EntitySetName === entitySetName);
        return found || null;
    },

    /**
     * Resolve entity by either set name or logical name.
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string|null} impersonatedUserId - Current impersonation ID
     * @param {string} nameOrSet - Entity set name or logical name
     * @returns {Promise<{LogicalName:string, EntitySetName:string}|null>}
     */
    async getEntityByAny(webApiFetch, impersonatedUserId, nameOrSet) {
        if (!nameOrSet) {
            return null;
        }

        // Try as entity set name first
        try {
            const bySet = await this.getEntityBySetName(webApiFetch, impersonatedUserId, nameOrSet);
            if (bySet) {
                return bySet;
            }
        } catch (_) { /* ignore */ }

        // Try all definitions
        const defs = await this.getEntityDefinitions(webApiFetch, impersonatedUserId);
        if (Array.isArray(defs)) {
            const hit = defs.find(e =>
                e?.LogicalName === nameOrSet || e?.EntitySetName === nameOrSet
            );
            if (hit) {
                return { LogicalName: hit.LogicalName, EntitySetName: hit.EntitySetName };
            }
        }

        return null;
    },

    /**
     * Get full entity definition including PrimaryNameAttribute.
     * @async
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string|null} impersonatedUserId - Current impersonation ID
     * @param {string} entityLogicalName - Entity logical name
     * @returns {Promise<Object|null>} Full entity definition object
     */
    async getEntityDefinition(webApiFetch, impersonatedUserId, entityLogicalName) {
        if (!entityLogicalName) {
            return null;
        }

        const defs = await this.getEntityDefinitions(webApiFetch, impersonatedUserId);
        if (Array.isArray(defs)) {
            const hit = defs.find(e => e?.LogicalName === entityLogicalName);
            if (hit) {
                return hit;
            }
        }

        try {
            const response = await webApiFetch(
                'GET',
                `EntityDefinitions(LogicalName='${entityLogicalName}')`,
                '?$select=LogicalName,EntitySetName,PrimaryNameAttribute,PrimaryIdAttribute,DisplayName'
            );
            return response ? _normalizeObjectKeys(response) : null;
        } catch {
            return null;
        }
    },

    /**
     * Get a compact attribute type map for an entity (useful for query building).
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string} entityLogicalName - Entity logical name
     * @param {boolean} bypassCache - Force refresh
     * @returns {Promise<Map<string, {type:string, targets?:string[]}>>}
     */
    async getAttributeMap(webApiFetch, entityLogicalName, bypassCache = false) {
        const defs = await this.getAttributeDefinitions(webApiFetch, entityLogicalName, bypassCache);
        const map = new Map();
        defs.forEach(d => {
            const ln = d.LogicalName;
            const t = (d.AttributeTypeName?.Value || d.AttributeType || '').toLowerCase();
            if (!ln) {
                return;
            }

            if (t.includes('lookup')) {
                map.set(ln, { type: 'lookup', targets: d.Targets || d.Target || [] });
            } else if (t.includes('boolean')) {
                map.set(ln, { type: 'boolean' });
            } else if (t.includes('picklist') || t.includes('state') || t.includes('status')) {
                map.set(ln, { type: 'optionset' });
            } else if (t.includes('datetime')) {
                map.set(ln, { type: 'date' });
            } else if (t.includes('integer') || t.includes('decimal') || t.includes('double') || t.includes('money')) {
                map.set(ln, { type: 'number' });
            } else {
                map.set(ln, { type: 'string' });
            }
        });
        return map;
    },

    /**
     * Get a map of lookup attribute logical names to navigation property names.
     * Used for correctly formatting @odata.bind fields in create/update requests.
     * @async
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string} entityLogicalName - Entity logical name
     * @param {boolean} bypassCache - Force refresh
     * @returns {Promise<Map<string, string>>} Map of attributeLogicalName → navigationPropertyName
     */
    // eslint-disable-next-line require-await
    async getNavigationPropertyMap(webApiFetch, entityLogicalName, bypassCache = false) {
        const key = `navProps_${entityLogicalName}`;
        return _fetch(key, async () => {
            const map = new Map();
            try {
                const response = await webApiFetch(
                    'GET',
                    `EntityDefinitions(LogicalName='${entityLogicalName}')/ManyToOneRelationships`,
                    '?$select=ReferencingAttribute,ReferencingEntityNavigationPropertyName'
                );
                if (response?.value) {
                    for (const rel of response.value) {
                        const attrName = rel.ReferencingAttribute;
                        const navPropName = rel.ReferencingEntityNavigationPropertyName;
                        if (attrName && navPropName) {
                            map.set(attrName.toLowerCase(), navPropName);
                        }
                    }
                }
            } catch (_e) {
                // Return empty map on failure
            }
            return map;
        }, bypassCache);
    },

    /**
     * Determine metadata type and expand clause for optionset.
     * @private
     */
    async _determineOptionsetMetadataType(webApiFetch, entityLogicalName, attributeLogicalName) {
        // Special handling for state and status
        if (attributeLogicalName === 'statecode') {
            return {
                metadataType: 'StateAttributeMetadata',
                expandClause: '?$expand=OptionSet($select=Options)'
            };
        }

        if (attributeLogicalName === 'statuscode') {
            return {
                metadataType: 'StatusAttributeMetadata',
                expandClause: '?$expand=OptionSet($select=Options)'
            };
        }

        // Detect if it's a multiselect picklist
        let metadataType = 'PicklistAttributeMetadata';
        try {
            const attrResponse = await webApiFetch(
                'GET',
                `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attributeLogicalName}')`,
                '?$select=AttributeTypeName'
            );
            const attrTypeName = attrResponse?.AttributeTypeName?.Value || '';
            if (attrTypeName === 'MultiSelectPicklistType') {
                metadataType = 'MultiSelectPicklistAttributeMetadata';
            }
        } catch (_e) {
            // Default to PicklistAttributeMetadata on error
        }

        return {
            metadataType,
            expandClause: '?$expand=OptionSet($select=Options),GlobalOptionSet($select=Options)'
        };
    },

    /**
     * Extract label from option metadata.
     * @private
     */
    _extractOptionLabel(opt) {
        return opt.Label?.UserLocalizedLabel?.Label ||
            opt.Label?.LocalizedLabels?.[0]?.Label ||
            `${opt.Value}`;
    },

    /**
     * Parse options from response data.
     * @private
     */
    _parseOptionSetData(response) {
        const options = [];
        const optionSetData = response?.OptionSet?.Options || response?.GlobalOptionSet?.Options || [];

        for (const opt of optionSetData) {
            if (opt.Value !== null && opt.Value !== undefined) {
                options.push({
                    value: opt.Value,
                    label: this._extractOptionLabel(opt)
                });
            }
        }

        return options;
    },

    /**
     * Get optionset options for a picklist attribute.
     * @async
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string} entityLogicalName - Entity logical name
     * @param {string} attributeLogicalName - Attribute logical name
     * @param {boolean} bypassCache - Force refresh
     * @returns {Promise<Array<{value: number, label: string}>>} Array of option value/label pairs
     */
    // eslint-disable-next-line require-await
    async getPicklistOptions(webApiFetch, entityLogicalName, attributeLogicalName, bypassCache = false) {
        const key = `optionset_${entityLogicalName}_${attributeLogicalName}`;
        return _fetch(key, async () => {
            try {
                const { metadataType, expandClause } = await this._determineOptionsetMetadataType(
                    webApiFetch,
                    entityLogicalName,
                    attributeLogicalName
                );

                const response = await webApiFetch(
                    'GET',
                    `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attributeLogicalName}')/Microsoft.Dynamics.CRM.${metadataType}`,
                    expandClause
                );

                return this._parseOptionSetData(response);
            } catch (_e) {
                // Return empty array on failure
                return [];
            }
        }, bypassCache);
    },

    /**
     * Get boolean options for a boolean attribute.
     * @async
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string} entityLogicalName - Entity logical name
     * @param {string} attributeLogicalName - Attribute logical name
     * @param {boolean} bypassCache - Force refresh
     * @returns {Promise<{trueLabel: string, falseLabel: string}>}
     */
    // eslint-disable-next-line require-await
    async getBooleanOptions(webApiFetch, entityLogicalName, attributeLogicalName, bypassCache = false) {
        const key = `boolean_${entityLogicalName}_${attributeLogicalName}`;
        return _fetch(key, async () => {
            try {
                const response = await webApiFetch(
                    'GET',
                    `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attributeLogicalName}')/Microsoft.Dynamics.CRM.BooleanAttributeMetadata`,
                    '?$expand=OptionSet'
                );

                const trueOption = response?.OptionSet?.TrueOption;
                const falseOption = response?.OptionSet?.FalseOption;

                return {
                    trueLabel: trueOption?.Label?.UserLocalizedLabel?.Label || 'True',
                    falseLabel: falseOption?.Label?.UserLocalizedLabel?.Label || 'False'
                };
            } catch (_e) {
                // Return default labels on failure
                return { trueLabel: 'True', falseLabel: 'False' };
            }
        }, bypassCache);
    },

    /**
     * Clear metadata cache (full or partial).
     * @param {string|null} key - Specific cache key or null for full clear
     */
    clearCache(key = null) {
        if (key) {
            _metadataCache.delete(key);
        } else {
            _metadataCache.clear();
            _entitySetNameCache.clear();
            _entityBySetNameCache.clear();
            _isMetadataLoaded = false;
            _metadataPromise = null;
        }
    }
};
