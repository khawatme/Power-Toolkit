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

/**
 * Resolve entity logical name to entity set name for Web API.
 * @private
 * @param {string} logicalName - Entity logical name or path
 * @param {Function} getEntitySetName - Metadata service function
 * @returns {string} Resolved entity set name or path
 */
function _resolveEntitySetName(logicalName, getEntitySetName) {
    const isSpecialCall = Config.DATAVERSE_SPECIAL_ENDPOINTS.some(e => logicalName.startsWith(e));
    if (isSpecialCall) {
        return logicalName;
    }

    const hasRecordId = logicalName.includes('(') && logicalName.includes(')');

    if (!hasRecordId) {
        const resolvedSetName = getEntitySetName(logicalName);
        if (resolvedSetName) {
            return resolvedSetName;
        }
        return logicalName.endsWith('s') ? logicalName : `${logicalName}s`;
    }

    const match = logicalName.match(/^([^(]+)(\(.+\))$/);
    if (!match) {
        return logicalName;
    }

    const [, entityName, idPart] = match;
    const resolvedSetName = getEntitySetName(entityName);

    if (resolvedSetName) {
        return `${resolvedSetName}${idPart}`;
    }

    return entityName.endsWith('s') ? logicalName : `${entityName}s${idPart}`;
}

/**
 * Build Web API URL with query string.
 * @private
 * @param {string} baseUrl - Base API URL
 * @param {string} resource - Resource path
 * @param {string} queryString - Query string
 * @returns {string} Complete URL
 */
function _buildApiUrl(baseUrl, resource, queryString) {
    let qs = queryString || '';
    if (qs && !qs.startsWith('?')) {
        qs = `?${qs}`;
    }
    return `${baseUrl}/${resource}${qs}`;
}

/**
 * Build request headers with impersonation support.
 * @private
 * @param {HeadersInit} customHeaders - Custom headers
 * @param {string|null} impersonatedUserId - User ID for impersonation
 * @returns {HeadersInit} Complete headers object
 */
function _buildRequestHeaders(customHeaders, impersonatedUserId) {
    const headers = {
        ...Config.WEB_API_HEADERS.STANDARD,
        ...customHeaders
    };

    if (impersonatedUserId) {
        headers[Config.WEB_API_HEADERS.IMPERSONATION_HEADER] = impersonatedUserId;
    }

    return headers;
}

/**
 * Parse response and extract data or ID.
 * @private
 * @param {Response} resp - Fetch response
 * @param {string} text - Response body text
 * @returns {object} Parsed response data
 */
function _parseResponse(resp, text) {
    if (text) {
        return JSON.parse(text);
    }

    const id = resp.headers.get('OData-EntityId')?.match(/\(([^)]+)\)/)?.[1];
    if (id) {
        return { id };
    }

    return {};
}

/**
 * Generate a unique identifier for batch boundaries.
 * Uses crypto.randomUUID() when available, falls back to custom implementation.
 * @private
 * @returns {string} Unique identifier
 */
function _generateUniqueId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
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

        const resource = _resolveEntitySetName(logicalName, getEntitySetName);
        const url = _buildApiUrl(baseUrl, resource, queryString);
        const headers = _buildRequestHeaders(customHeaders, impersonatedUserId);

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
        return _parseResponse(resp, text);
    },

    /**
     * Retrieve multiple records.
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string} entity - Entity name
     * @param {string} options - Query options
     * @param {HeadersInit} customHeaders - Custom headers
     * @returns {Promise<{entities: any[], nextLink?: string, count?: number}>}
     */
    async retrieveMultipleRecords(webApiFetch, entity, options, customHeaders = {}) {
        const result = await webApiFetch('GET', entity, options, null, customHeaders);
        const response = {
            entities: result.value || [],
            nextLink: result['@odata.nextLink']
        };

        if (result['@odata.count'] !== undefined) {
            response.count = result['@odata.count'];
        }

        return response;
    },

    /**
     * Retrieve a single record.
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string} entity - Entity logical name or entity set name
     * @param {string} id - Record ID
     * @param {string} options - Query options
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
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
    // eslint-disable-next-line require-await
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
    // eslint-disable-next-line require-await
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
    // eslint-disable-next-line require-await
    async deleteRecord(webApiFetch, entity, id) {
        return webApiFetch('DELETE', `${entity}(${id})`);
    },

    /**
     * Execute FetchXML query.
     * @param {Function} webApiFetch - Web API fetch function
     * @param {string} entityName - Entity name
     * @param {string} fetchXml - FetchXML query
     * @param {HeadersInit} customHeaders - Custom headers
     * @returns {Promise<{entities: any[], pagingCookie?: string, moreRecords?: boolean}>}
     */
    async executeFetchXml(webApiFetch, entityName, fetchXml, customHeaders = {}) {
        const result = await webApiFetch(
            'GET',
            entityName,
            `?fetchXml=${encodeURIComponent(fetchXml)}`,
            null,
            customHeaders
        );
        return {
            entities: result.value || [],
            pagingCookie: result['@Microsoft.Dynamics.CRM.fetchxmlpagingcookie'],
            moreRecords: result['@Microsoft.Dynamics.CRM.morerecords'] || false
        };
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
            ...Config.WEB_API_HEADERS.STANDARD,
            'Prefer': `odata.maxpagesize=${pageSize}`
        };

        if (impersonatedUserId) {
            headers[Config.WEB_API_HEADERS.IMPERSONATION_HEADER] = impersonatedUserId;
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
    },

    /**
     * Execute a batch of operations using OData $batch endpoint.
     * This bundles multiple PATCH/POST/DELETE operations into a single HTTP request.
     *
     * @param {Array<{method: 'PATCH'|'POST'|'DELETE', entitySet: string, id?: string, data?: object}>} operations - Array of operations
     * @param {string|null} impersonatedUserId - Impersonation user ID
     * @returns {Promise<{successCount: number, failCount: number, errors: Array<{index: number, error: string}>}>}
     * @throws {Error} If operations array exceeds Dataverse limit of 1000
     */
    async executeBatch(operations, impersonatedUserId = null) {
        if (!operations || operations.length === 0) {
            return { successCount: 0, failCount: 0, errors: [] };
        }

        if (operations.length > 1000) {
            throw new Error(`Batch operation limit exceeded: ${operations.length} operations provided, maximum is 1000`);
        }

        const globalContext = PowerAppsApiService.getGlobalContext();
        const baseUrl = `${globalContext.getClientUrl()}/api/data/v9.2`;
        const batchUrl = `${baseUrl}/$batch`;
        const batchBoundary = `batch_${_generateUniqueId()}`;

        const parts = [];

        for (const op of operations) {
            let resourcePath = op.entitySet;
            if (op.id) {
                resourcePath = `${op.entitySet}(${op.id})`;
            }

            const requestLines = [];
            requestLines.push(`${op.method} /api/data/v9.2/${resourcePath} HTTP/1.1`);
            requestLines.push('Content-Type: application/json; type=entry');
            requestLines.push('');

            if (op.data) {
                const jsonData = JSON.stringify(op.data);
                requestLines.push(jsonData);
            }

            const requestContent = requestLines.join('\r\n');

            const part = [
                `--${batchBoundary}`,
                'Content-Type: application/http',
                'Content-Transfer-Encoding: binary',
                '',
                requestContent
            ].join('\r\n');

            parts.push(part);
        }

        const batchBody = parts.join('\r\n') + '\r\n' + `--${batchBoundary}--` + '\r\n';

        const headers = {
            ...Config.WEB_API_HEADERS.STANDARD,
            'Content-Type': `multipart/mixed; boundary="${batchBoundary}"`,
            'Prefer': 'odata.continue-on-error'
        };

        if (impersonatedUserId) {
            headers[Config.WEB_API_HEADERS.IMPERSONATION_HEADER] = impersonatedUserId;
        }

        const resp = await fetch(batchUrl, {
            method: 'POST',
            headers,
            body: batchBody
        });

        const responseText = await resp.text();

        let successCount = 0;
        let failCount = 0;
        const errors = [];
        const statusMatches = [...responseText.matchAll(/HTTP\/1\.\d\s+(\d{3})\s+[^\r\n]+/g)];

        statusMatches.forEach((match, index) => {
            const statusCode = parseInt(match[1], 10);
            if (statusCode >= 200 && statusCode < 300) {
                successCount++;
            } else {
                failCount++;
                const afterStatus = responseText.substring(match.index);
                const errorMessageMatch = afterStatus.match(/"message"\s*:\s*"([^"]+)"/);
                errors.push({
                    index,
                    error: errorMessageMatch ? errorMessageMatch[1] : `HTTP ${statusCode}`
                });
            }
        });

        if (statusMatches.length === 0 && resp.ok) {
            successCount = operations.length;
        } else if (statusMatches.length === 0 && !resp.ok) {
            failCount = operations.length;
            const errorBody = responseText.substring(0, 500);
            errors.push({ index: -1, error: `Batch request failed: HTTP ${resp.status}. ${errorBody}` });
        }

        return { successCount, failCount, errors };
    }
};
