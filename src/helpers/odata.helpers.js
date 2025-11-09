/**
 * @file OData query and API utilities.
 * @module helpers/odata.helpers
 * @description Provides utilities for OData query building, value formatting, and API response normalization.
 */

/**
 * Defines the structure for a filter operator used in query builders.
 * @typedef {object} FilterOperator
 * @property {string} text - The user-friendly display text (e.g., "Equals").
 * @property {string|null} fetch - The corresponding operator for FetchXML (e.g., "eq").
 * @property {string|null} odata - The corresponding operator for OData Web API (e.g., "eq").
 */

/**
 * OData query and API utility functions.
 * @namespace ODataHelpers
 */
export const ODataHelpers = {
    /**
     * A master list of filter operators and their corresponding values for FetchXML and OData.
     * @type {FilterOperator[]}
     */
    FILTER_OPERATORS: [
        { text: 'Equals', fetch: 'eq', odata: 'eq' },
        { text: 'Not Equals', fetch: 'neq', odata: 'ne' },
        { text: 'Like', fetch: 'like', odata: null },
        { text: 'Not Like', fetch: 'not-like', odata: null },
        { text: 'In', fetch: 'in', odata: null },
        { text: 'Not In', fetch: 'not-in', odata: null },
        { text: 'Is Null', fetch: 'null', odata: 'eq null' },
        { text: 'Is Not Null', fetch: 'not-null', odata: 'ne null' },
        { text: 'Contains', fetch: null, odata: 'contains' },
        { text: 'Not Contains', fetch: null, odata: 'not contains' },
        { text: 'Starts With', fetch: null, odata: 'startswith' },
        { text: 'Ends With', fetch: null, odata: 'endswith' },
        { text: 'Greater Than', fetch: 'gt', odata: 'gt' },
        { text: 'Greater or Equal', fetch: 'ge', odata: 'ge' },
        { text: 'Less Than', fetch: 'lt', odata: 'lt' },
        { text: 'Less or Equal', fetch: 'le', odata: 'le' }
    ],

    /**
     * Escapes special characters in a string for safe use in OData query strings.
     * Handles single quotes by doubling them (OData standard).
     * @param {string} str - The string to escape.
     * @returns {string} The escaped string safe for OData queries.
     */
    escapeODataString(str) {
        if (!str) {
            return '';
        }
        // Double single quotes for OData (standard escaping)
        return String(str).replace(/'/g, "''");
    },

    /**
     * Formats a value for OData query strings by detecting its type.
     * Handles booleans, GUIDs, numbers, dates, and strings with proper escaping.
     * @param {*} value - The value to format.
     * @returns {string} The formatted OData value string.
     */
    formatODataValue(value) {
        const str = String(value);

        // Quote helper for string values
        const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;

        // Boolean
        if (/^(true|false)$/i.test(str)) {
            return str.toLowerCase();
        }

        // GUID - use simple regex check
        const isGuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);
        if (isGuid) {
            return str;
        }

        // Number
        if (!Number.isNaN(Number(str))) {
            return String(Number(str));
        }

        // Date
        if (!Number.isNaN(Date.parse(str))) {
            return quote(new Date(str).toISOString());
        }

        // String (default)
        return quote(str);
    },

    /**
     * Determines if a value input should be shown for a given OData operator.
     * Null and not-null operators don't require value input.
     * @param {string} operator - The OData operator (e.g., 'eq', 'null', 'ne null').
     * @returns {boolean} True if value input should be shown, false otherwise.
     */
    shouldShowOperatorValue(operator) {
        if (!operator) {
            return true;
        }
        const op = String(operator).toLowerCase().trim();
        return op !== 'null' && op !== 'not-null' && op !== 'eq null' && op !== 'ne null';
    },

    /**
     * Builds OData filter clauses from an object of filter key-value pairs.
     * Uses 'contains' operator for non-empty string values.
     * @param {Object<string, string>} filters - Object with property names as keys and filter values.
     * @returns {string} OData filter query parameter (e.g., "&$filter=contains(name, 'test')") or empty string.
     */
    buildODataFilterClauses(filters) {
        if (!filters || typeof filters !== 'object') {
            return '';
        }

        const clauses = [];
        for (const [key, value] of Object.entries(filters)) {
            const trimmed = String(value || '').trim();
            if (trimmed) {
                clauses.push(`contains(${key}, '${this.escapeODataString(trimmed)}')`);
            }
        }
        return clauses.length ? `&$filter=${clauses.join(' and ')}` : '';
    },

    /**
     * Normalizes varied Web API responses into a consistent { entities: [] } shape for display.
     * Handles arrays, objects with value property, objects with entities property, and single objects.
     * @param {*} response - The API response (can be array, object with value/entities, or single object).
     * @returns {{entities: Array}} Normalized response with entities array.
     */
    normalizeApiResponse(response) {
        if (response === null || response === undefined) {
            return { entities: [] };
        }
        if (Array.isArray(response)) {
            return { entities: response };
        }
        if (Array.isArray(response?.value)) {
            return { entities: response.value };
        }
        if (Array.isArray(response?.entities)) {
            return response;
        }
        return { entities: [response] };
    },

    /**
     * Filters out OData system properties from an object, returning only user-relevant properties.
     * Removes properties starting with '@odata' and properties with null or object values.
     * @param {object} obj - The object to filter.
     * @returns {Array<[string, *]>} An array of [key, value] tuples for display-worthy properties.
     */
    filterODataProperties(obj) {
        if (!obj || typeof obj !== 'object') {
            return [];
        }

        return Object.entries(obj)
            .filter(([key, value]) => {
                // Exclude null values
                if (value === null) {
                    return false;
                }
                // Exclude object/array values (typically nested metadata)
                if (typeof value === 'object') {
                    return false;
                }
                // Exclude OData metadata properties
                if (key.startsWith('@odata')) {
                    return false;
                }
                return true;
            })
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
    }
};
