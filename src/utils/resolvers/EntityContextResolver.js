/**
 * @file EntityContextResolver
 * @description Resolve entity context (entity set name, logical name, attribute metadata)
 * @module utils/resolvers/EntityContextResolver
 */

import { DataService } from '../../services/DataService.js';

export class EntityContextResolver {
    /** @type {Map<string, Map<string, {type:string, targets?:string[]}>>} */
    static _attrCache = new Map();

    /**
     * Accepts an entity set name OR a logical name and returns both.
     * @param {string} input
     * @returns {Promise<{ entitySet: string, logicalName: string }>}
     */
    static async resolve(input) {
        const def = await DataService.getEntityByAny(input);
        if (!def) {
            throw new Error(`Could not resolve entity for '${input}'.`);
        }
        return { entitySet: def.EntitySetName, logicalName: def.LogicalName };
    }

    /**
     * Get attribute map with a tiny in-memory cache.
     * @param {string} logicalName
     * @returns {Promise<Map<string, {type:string, targets?:string[]}>>}
     */
    static async getAttrMap(logicalName) {
        if (!this._attrCache.has(logicalName)) {
            const map = await DataService.getAttributeMap(logicalName);
            this._attrCache.set(logicalName, map);
        }
        return this._attrCache.get(logicalName);
    }

    /**
     * Invalidates the cached attribute map for a specific entity.
     * Use this to force a fresh fetch of entity metadata on the next getAttrMap call.
     * @param {string} logicalName - The logical name of the entity to invalidate
     * @returns {void}
     */
    static invalidate(logicalName) {
        this._attrCache.delete(logicalName);
    }
}
