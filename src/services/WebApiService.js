/**
 * @file Core Web API CRUD operations
 * @module services/WebApiService
 * @description Low-level Web API methods for Dataverse operations
 */

import { PowerAppsApiService } from './PowerAppsApiService.js';
import { Config } from '../constants/index.js';

/**
 * Read response body safely, handling empty responses.
 * @private
 * @param {Response} resp - Fetch response object
 * @returns {Promise<string>}
 */
async function _readBodySafe(resp) {
    try {
        const text = await resp.text();
        return text || '';
    } catch {
        return '';
    }
}

/**
 * Build HTTP error object with details.
 * @private
 * @param {Response} resp - Fetch response
 * @param {string} body - Response body text
 * @returns {Error}
 */
function _buildHttpError(resp, body) {
    const error = new Error(`HTTP ${resp.status} ${resp.statusText}`);
    error.status = resp.status;
    error.statusText = resp.statusText;
    error.response = { status: resp.status, statusText: resp.statusText, data: body };
    return error;
}

export const WebApiService = {
    /**
     * Core Web API fetch with impersonation support.
     * @param {string} method - HTTP method (GET, POST, PATCH, DELETE)
     * @param {string} logicalName - Entity logical name or special endpoint
     * @param {string} queryString - Query string (e.g., '?$select=name')
     * @param {object|null} data - Request body for POST/PATCH
     * @param {HeadersInit} customHeaders - Additional headers
     * @param {Function} getEntitySetName - Metadata service function
     * @param {string|null} impersonatedUserId - User ID for impersonation
     * @returns {Promise<object>}
     */
    async webApiFetch(method, logicalName, queryString = '', data = null, customHeaders = {}, getEntitySetName, impersonatedUserId = null) {
        const globalContext = PowerAppsApiService.getGlobalContext();
        const baseUrl = `${globalContext.getClientUrl()}/api/data/v9.2`;

        // Check for special endpoints that don't need entity set resolution
        const isSpecialCall = Config.DATAVERSE_SPECIAL_ENDPOINTS.some(e => logicalName.startsWith(e));

        // Check if path already includes record ID (e.g., "systemform(guid)" or "systemforms(guid)")
        const hasRecordId = logicalName.includes('(') && logicalName.includes(')');

        let resource = logicalName;

        if (!isSpecialCall && !hasRecordId) {
            // Simple entity name without ID - convert normally
            const resolvedSetName = getEntitySetName(logicalName);
            if (resolvedSetName) {
                resource = resolvedSetName;
            } else if (!logicalName.endsWith('s')) {
                resource = `${logicalName}s`; // Fallback pluralization
            }
        } else if (!isSpecialCall && hasRecordId) {
            // Path with ID like "systemform(guid)" - extract entity name, convert it, then re-append ID
            const match = logicalName.match(/^([^(]+)(\(.+\))$/);
            if (match) {
                const [, entityName, idPart] = match;
                const resolvedSetName = getEntitySetName(entityName);
                if (resolvedSetName) {
                    resource = `${resolvedSetName}${idPart}`;
                } else if (!entityName.endsWith('s')) {
                    resource = `${entityName}s${idPart}`; // Fallback pluralization
                }
                // else: already correct (like "systemforms(guid)"), use as-is
            }
        }

        let qs = queryString || '';
        if (qs && !qs.startsWith('?')) {
            qs = `?${qs}`;
        }

        const url = `${baseUrl}/${resource}${qs}`;

        const headers = {
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json; charset=utf-8',
            ...customHeaders
        };

        if (impersonatedUserId) {
            headers['MSCRMCallerID'] = impersonatedUserId;
        }

        const fetchOptions = { method, headers };
        if (data) {
            fetchOptions.body = JSON.stringify(data);
        }

        const resp = await fetch(url, fetchOptions);

        if (!resp.ok) {
            const body = await _readBodySafe(resp);
            throw _buildHttpError(resp, body);
        }

        const text = await resp.text();
        if (text) {
            const json = JSON.parse(text);
            return json;
        }

        // Handle 204 No Content or empty responses
        const id = resp.headers.get('OData-EntityId')?.match(/\(([^)]+)\)/)?.[1];
        if (id) return { id };

        return {};
    },

    /**
     * Retrieve multiple records.
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string} entity - Entity name
     * @param {string} options - Query options
     * @param {HeadersInit} customHeaders - Custom headers
     * @returns {Promise<{entities: any[], nextLink?: string}>}
     */
    async retrieveMultipleRecords(webApiFetch, entity, options, customHeaders = {}) {
        const result = await webApiFetch('GET', entity, options, null, customHeaders);
        return {
            entities: result.value || [],
            nextLink: result['@odata.nextLink']
        };
    },

    /**
     * Retrieve a single record.
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string} entity - Entity logical name or entity set name
     * @param {string} id - Record ID
     * @param {string} options - Query options
     * @returns {Promise<object>}
     */
    async retrieveRecord(webApiFetch, entity, id, options = '') {
        return webApiFetch('GET', `${entity}(${id})`, options);
    },

    /**
     * Create a record.
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string} entity - Entity name
     * @param {object} data - Record data
     * @returns {Promise<object>}
     */
    async createRecord(webApiFetch, entity, data) {
        return webApiFetch('POST', entity, '', data);
    },

    /**
     * Update a record (PATCH).
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string} entity - Entity name
     * @param {string} id - Record ID
     * @param {object} data - Update data
     * @returns {Promise<object>}
     */
    async updateRecord(webApiFetch, entity, id, data) {
        return webApiFetch('PATCH', `${entity}(${id})`, '', data);
    },

    /**
     * Delete a record.
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string} entity - Entity name
     * @param {string} id - Record ID
     * @returns {Promise<object>}
     */
    async deleteRecord(webApiFetch, entity, id) {
        return webApiFetch('DELETE', `${entity}(${id})`);
    },

    /**
     * Execute FetchXML query.
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string} entityName - Entity name
     * @param {string} fetchXml - FetchXML query
     * @param {HeadersInit} customHeaders - Custom headers
     * @returns {Promise<{entities: any[]}>}
     */
    async executeFetchXml(webApiFetch, entityName, fetchXml, customHeaders = {}) {
        const result = await webApiFetch(
            'GET',
            entityName,
            `?fetchXml=${encodeURIComponent(fetchXml)}`,
            null,
            customHeaders
        );
        return { entities: result.value || [] };
    },

    /**
     * Get plugin trace logs with pagination support.
     * @param {string} options - Query options
     * @param {number} pageSize - Page size
     * @param {string|null} impersonatedUserId - Impersonation ID
     * @returns {Promise<{entities: any[], nextLink?: string}>}
     */
    async getPluginTraceLogs(options, pageSize, impersonatedUserId = null) {
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
            'Prefer': `odata.maxpagesize=${pageSize}`
        };

        if (impersonatedUserId) {
            headers['MSCRMCallerID'] = impersonatedUserId;
        }

        const resp = await fetch(apiUrl, { method: 'GET', headers });

        if (!resp.ok) {
            const body = await _readBodySafe(resp);
            throw _buildHttpError(resp, body);
        }

        const text = await resp.text();
        const json = text ? JSON.parse(text) : { value: [] };

        return {
            entities: json.value || [],
            nextLink: json['@odata.nextLink']
        };
    }
};
