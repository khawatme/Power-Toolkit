/**
 * @file Dataverse-specific data normalization utilities.
 * @module helpers/dataverse.helpers
 * @description Provides normalization functions for Dataverse data types (lookups, option sets, dates, money, GUIDs).
 */

import { Config } from '../constants/index.js';

/**
 * Dataverse data normalization utility functions.
 * @namespace DataverseHelpers
 */
export const DataverseHelpers = {
    /**
     * Normalizes a GUID string by removing curly braces and converting to lowercase.
     * Useful for standardizing GUID formats across different systems.
     * @param {string|null|undefined} guidString - The GUID string to normalize.
     * @returns {string|null} The normalized GUID without braces, or null if invalid.
     */
    normalizeGuid(guidString) {
        if (!guidString) return null;
        const cleaned = String(guidString).replace(/[{}]/g, '').toLowerCase();
        return cleaned || null;
    },

    /**
     * Normalizes a lookup value from the Xrm API to a plugin-style EntityReference object.
     * @param {Array<{id: string, name: string, entityType: string}>|null} lookupValue - The lookup value from an Xrm attribute.
     * @returns {object|null} An EntityReference-like object with __type, Id, LogicalName, and Name, or null.
     */
    normalizeLookup(lookupValue) {
        if (!Array.isArray(lookupValue) || !lookupValue[0]) return null;
        const item = lookupValue[0];
        const cleanId = String(item.id || '').replace(/[{}]/g, '');
        return {
            __type: Config.DATAVERSE_TYPES.ENTITY_REFERENCE,
            Id: cleanId,
            LogicalName: item.entityType || item.etn || '',
            Name: item.name || ''
        };
    },

    /**
     * Normalizes an option set value to a plugin-style OptionSetValue object.
     * Handles both single and multi-select option sets.
     * @param {number|Array<number>|null} optionSetValue - The option set value(s).
     * @returns {object|null} An OptionSetValue or OptionSetValueCollection object, or null.
     */
    normalizeOptionSet(optionSetValue) {
        if (Array.isArray(optionSetValue)) {
            return { __type: Config.DATAVERSE_TYPES.OPTION_SET_VALUE_COLLECTION, Values: optionSetValue.slice() };
        }
        if (optionSetValue == null) return null;
        return { __type: Config.DATAVERSE_TYPES.OPTION_SET_VALUE, Value: Number(optionSetValue) };
    },

    /**
     * Normalizes a date value to a plugin-style DateTime object with ISO format.
     * @param {Date|string|number|null} dateValue - The date value to normalize.
     * @returns {object|null} A DateTime object with __type and Iso properties, or null.
     */
    normalizeDateTime(dateValue) {
        if (!dateValue) return null;
        try {
            const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
            return { __type: Config.DATAVERSE_TYPES.DATE_TIME, Iso: date.toISOString() };
        } catch {
            return null;
        }
    },

    /**
     * Normalizes a money value to a plugin-style Money object.
     * @param {number|string|null} moneyValue - The money value to normalize.
     * @returns {object|null} A Money object with __type and Value properties, or null.
     */
    normalizeMoney(moneyValue) {
        if (moneyValue == null || moneyValue === '') return null;
        const num = Number(moneyValue);
        return Number.isFinite(num) ? { __type: Config.DATAVERSE_TYPES.MONEY, Value: num } : null;
    },

    /**
     * Normalizes a numeric value, handling various numeric types consistently.
     * @param {number|string|null} numericValue - The numeric value to normalize.
     * @returns {number|null} The normalized number, or null if invalid.
     */
    normalizeNumber(numericValue) {
        if (numericValue == null || numericValue === '') return null;
        const num = Number(numericValue);
        return Number.isFinite(num) ? num : null;
    },

    /**
     * Filters out system fields from an attributes object.
     * System fields are defined in Config.SYSTEM_FIELDS and include common read-only
     * attributes like 'createdon', 'modifiedon', 'ownerid', etc.
     * @param {Object} attributes - Key-value pairs of entity attributes
     * @returns {Object} Filtered attributes without system fields
     * @example
     * const filtered = DataverseHelpers.filterSystemFields({ name: 'Test', createdon: '2024-01-01', customfield: 'Value' });
     * // Returns: { name: 'Test', customfield: 'Value' }
     */
    filterSystemFields(attributes) {
        const filtered = {};
        const systemFields = Config.SYSTEM_FIELDS || [];
        for (const [key, value] of Object.entries(attributes)) {
            if (!systemFields.includes(key.toLowerCase())) {
                filtered[key] = value;
            }
        }
        return filtered;
    }
};
