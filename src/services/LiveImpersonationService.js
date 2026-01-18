/**
 * @file Live Impersonation Service for real-time API request interception
 * @module services/LiveImpersonationService
 * @description Provides live impersonation functionality that intercepts all Dataverse
 * API requests, makes shadow requests with impersonation headers, and compares results
 * to show what the impersonated user can/cannot see in real-time.
 */

import { Config } from '../constants/index.js';
import { WebApiService } from './WebApiService.js';

/**
 * @typedef {Object} ComparisonResult
 * @property {string} url - The API URL that was called
 * @property {string} method - HTTP method (GET, POST, etc.)
 * @property {Date} timestamp - When the comparison was made
 * @property {boolean} userCanAccess - Whether impersonated user can access
 * @property {Array<string>} hiddenRecords - Record IDs hidden from impersonated user
 * @property {Array<string>} hiddenFields - Field names hidden from impersonated user
 * @property {string|null} error - Error message if user cannot access
 */

/**
 * Service for managing live impersonation mode with real-time request interception.
 * @class LiveImpersonationService
 */
class LiveImpersonationServiceClass {
    constructor() {
        /**
         * Whether live impersonation is currently active
         * @type {boolean}
         */
        this.isActive = false;

        /**
         * The user ID being impersonated
         * @type {string|null}
         */
        this.impersonatedUserId = null;

        /**
         * The Azure AD Object ID for impersonation (faster)
         * @type {string|null}
         */
        this.azureAdObjectId = null;

        /**
         * The display name of impersonated user
         * @type {string|null}
         */
        this.impersonatedUserName = null;

        /**
         * Array of comparison results for display
         * @type {ComparisonResult[]}
         */
        this.comparisonResults = [];

        /**
         * Maximum number of results to keep in memory
         * @type {number}
         */
        this.maxResults = 50;

        /**
         * Original fetch function reference
         * @type {Function|null}
         * @private
         */
        this._originalFetch = null;

        /**
         * Original XMLHttpRequest.open reference
         * @type {Function|null}
         * @private
         */
        this._originalXHROpen = null;

        /**
         * Original XMLHttpRequest.send reference
         * @type {Function|null}
         * @private
         */
        this._originalXHRSend = null;

        /**
         * Callback function for UI updates
         * @type {Function|null}
         */
        this.onComparisonUpdate = null;

        /**
         * Callback function for status changes
         * @type {Function|null}
         */
        this.onStatusChange = null;

        /**
         * Set of URLs currently being processed (to avoid infinite loops)
         * @type {Set<string>}
         * @private
         */
        this._processingUrls = new Set();

        /**
         * Callback function for command bar context changes
         * @type {Function|null}
         */
        this.onCommandBarContextChange = null;

        /**
         * Current page URL (to detect navigation)
         * @type {string|null}
         * @private
         */
        this._currentPageUrl = null;

        /**
         * Interval ID for URL monitoring
         * @type {number|null}
         * @private
         */
        this._urlMonitorInterval = null;

        /**
         * Last detected entity and context
         * @type {Object|null}
         * @private
         */
        this._lastContext = null;
    }

    /**
     * Starts live impersonation mode.
     * @param {string} userId - The Dataverse user ID to impersonate
     * @param {string} userName - The display name of the user
     * @returns {Promise<boolean>} Whether activation was successful
     * @async
     */
    async start(userId, userName) {
        if (this.isActive) {
            this.stop();
        }

        if (!userId) {
            throw new Error(Config.MESSAGES.LIVE_IMPERSONATION.noUserSelected);
        }

        try {
            this.impersonatedUserId = userId.replace(/[{}]/g, '');
            this.impersonatedUserName = userName || 'Unknown User';

            await this._fetchAzureAdObjectId();
            this._originalFetch = window.fetch;

            if (typeof window !== 'undefined' && typeof window.XMLHttpRequest !== 'undefined' && window.XMLHttpRequest.prototype) {
                this._originalXHROpen = window.XMLHttpRequest.prototype.open;
                this._originalXHRSend = window.XMLHttpRequest.prototype.send;
            }

            this._installFetchInterceptor();
            this._installXHRInterceptor();
            this._startUrlMonitoring();

            this.isActive = true;
            this.comparisonResults = [];

            if (this.onStatusChange) {
                this.onStatusChange(true, this.impersonatedUserName);
            }

            return true;
        } catch (error) {
            this._cleanup();
            throw error;
        }
    }

    /**
     * Stops live impersonation mode and restores original functions.
     */
    stop() {
        if (!this.isActive) {
            return;
        }

        this._stopUrlMonitoring();
        this._cleanup();
        this.isActive = false;
        this.impersonatedUserId = null;
        this.azureAdObjectId = null;
        this.impersonatedUserName = null;
        this._lastContext = null;

        if (this.onStatusChange) {
            this.onStatusChange(false, null);
        }
    }

    /**
     * Clears comparison results.
     */
    clearResults() {
        this.comparisonResults = [];
        if (this.onComparisonUpdate) {
            this.onComparisonUpdate(this.comparisonResults);
        }
    }

    /**
     * Fetches the Azure AD Object ID for the impersonated user.
     * @private
     * @async
     */
    async _fetchAzureAdObjectId() {
        try {
            const response = await WebApiService.webApiFetch(
                'GET',
                `systemusers(${this.impersonatedUserId})?$select=azureactivedirectoryobjectid`,
                '',
                null,
                {},
                null,
                null
            );
            this.azureAdObjectId = response?.azureactivedirectoryobjectid || null;
        } catch (_e) {
            this.azureAdObjectId = null;
        }
    }

    /**
     * Gets the impersonation headers to use.
     * @returns {Object} Headers object with appropriate impersonation header
     * @private
     */
    _getImpersonationHeaders() {
        if (this.azureAdObjectId) {
            return { [Config.WEB_API_HEADERS.CALLER_OBJECT_ID_HEADER]: this.azureAdObjectId };
        }
        return { [Config.WEB_API_HEADERS.IMPERSONATION_HEADER]: this.impersonatedUserId };
    }

    /**
     * Installs the fetch interceptor.
     * @private
     */
    _installFetchInterceptor() {
        const self = this;
        const originalFetch = this._originalFetch;

        window.fetch = async function(input, init) {
            let url;
            try {
                url = typeof input === 'string' ? input : input?.url;
                if (!url) {
                    return originalFetch.call(window, input, init);
                }
            } catch (_e) {
                return originalFetch.call(window, input, init);
            }

            if (!self._isDataverseApiCall(url) || self._processingUrls.has(url)) {
                return originalFetch.call(window, input, init);
            }

            let adminResponse;
            try {
                adminResponse = await originalFetch.call(window, input, init);
            } catch (error) {
                // If original request fails, just propagate the error
                throw error;
            }

            const method = init?.method?.toUpperCase() || 'GET';
            if (method !== 'GET') {
                return adminResponse;
            }

            const contentType = adminResponse.headers?.get('content-type') || '';
            if (!adminResponse.ok || !contentType.includes('application/json')) {
                return adminResponse;
            }

            try {
                self._makeComparisonRequest(url, method, adminResponse.clone());
            } catch (_e) {
                // Comparison failed, but return original response
            }

            return adminResponse;
        };
    }

    /**
     * Installs the XMLHttpRequest interceptor.
     * @private
     */
    _installXHRInterceptor() {
        if (typeof window === 'undefined' || typeof window.XMLHttpRequest === 'undefined') {
            return;
        }

        const self = this;
        const originalOpen = this._originalXHROpen;
        const originalSend = this._originalXHRSend;

        try {
            window.XMLHttpRequest.prototype.open = function(method, url, ...args) {
                this._liveImpersonationUrl = url;
                this._liveImpersonationMethod = method;
                return originalOpen.call(this, method, url, ...args);
            };

            window.XMLHttpRequest.prototype.send = function(body) {
                const xhr = this;
                const url = this._liveImpersonationUrl;
                const method = this._liveImpersonationMethod?.toUpperCase() || 'GET';

                // Only intercept Dataverse API GET calls
                if (url && self._isDataverseApiCall(url) && method === 'GET' && !self._processingUrls.has(url)) {
                    xhr.addEventListener('load', () => {
                        try {
                            if (xhr.status >= 200 && xhr.status < 300) {
                                const contentType = xhr.getResponseHeader('content-type') || '';
                                if (!contentType.includes('application/json')) {
                                    return;
                                }

                                if (!xhr.responseText || xhr.responseText.trim() === '') {
                                    return;
                                }

                                const adminData = JSON.parse(xhr.responseText);
                                self._makeComparisonRequestFromData(url, method, adminData);
                            }
                        } catch (_e) {
                            // Silently ignore parsing errors - expected for some responses
                        }
                    });
                }

                return originalSend.call(this, body);
            };
        } catch (_e) {
            // Silent fallback if XHR interception fails
        }
    }

    /**
     * Checks if a URL is a Dataverse API call.
     * @param {string} url - The URL to check
     * @returns {boolean} Whether it's a Dataverse API call
     * @private
     */
    _isDataverseApiCall(url) {
        if (!url) {
            return false;
        }

        const patterns = [
            /\/api\/data\/v[\d.]+\//i,
            /\.crm[\d]*\.dynamics\.com\/api\/data\//i,
            /\.dynamics\.com\/api\/data\//i
        ];

        return patterns.some(pattern => pattern.test(url));
    }

    /**
     * Makes a comparison request using fetch response.
     * @param {string} url - The API URL
     * @param {string} method - HTTP method
     * @param {Response} adminResponse - The admin's response (cloned)
     * @private
     * @async
     */
    async _makeComparisonRequest(url, method, adminResponse) {
        this._processingUrls.add(url);

        try {
            if (!adminResponse || !adminResponse.clone) {
                return;
            }

            const responseClone = adminResponse.clone();

            const text = await responseClone.text();
            if (!text || text.trim() === '') {
                return;
            }

            const firstChar = text.trim()[0];
            if (firstChar !== '{' && firstChar !== '[') {
                return;
            }

            const adminData = JSON.parse(text);
            await this._makeComparisonRequestFromData(url, method, adminData);
        } catch (_error) {
            // Silently ignore non-JSON responses and parsing errors
        } finally {
            this._processingUrls.delete(url);
        }
    }
    /**
     * Makes a comparison request from parsed data.
     * @param {string} url - The API URL
     * @param {string} method - HTTP method
     * @param {Object} adminData - The admin's parsed response data
     * @private
     * @async
     */
    async _makeComparisonRequestFromData(url, method, adminData) {
        this._processingUrls.add(url);

        try {
            const impersonationHeaders = this._getImpersonationHeaders();

            let userData = null;
            let userError = null;
            let userCanAccess = true;

            try {
                const response = await this._originalFetch.call(window, url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'OData-MaxVersion': '4.0',
                        'OData-Version': '4.0',
                        ...impersonationHeaders
                    }
                });

                if (!response.ok) {
                    userCanAccess = false;
                    userError = `HTTP ${response.status}: ${response.statusText}`;
                } else {
                    userData = await this._parseJsonResponse(response);
                    if (userData === null) {
                        userCanAccess = false;
                        userError = 'Invalid JSON response';
                    }
                }
            } catch (error) {
                userCanAccess = false;
                userError = error.message;
            }

            const comparison = this._compareResponses(url, method, adminData, userData, userCanAccess, userError);

            if (comparison.hasDifferences) {
                this._addComparisonResult(comparison);
            }

        } catch (_e) {
            // Silent fallback on comparison error
        } finally {
            this._processingUrls.delete(url);
        }
    }

    /**
     * Parses JSON response with validation.
     * @param {Response} response - The fetch response
     * @returns {Promise<Object|null>} Parsed JSON or null if invalid
     * @private
     * @async
     */
    async _parseJsonResponse(response) {
        const contentType = response.headers?.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            return null;
        }

        const text = await response.text();
        if (!text || !text.trim()) {
            return null;
        }

        const firstChar = text.trim()[0];
        if (firstChar !== '{' && firstChar !== '[') {
            return null;
        }

        try {
            return JSON.parse(text);
        } catch (_parseError) {
            return null;
        }
    }

    /**
     * Compares admin and user responses.
     * @param {string} url - The API URL
     * @param {string} method - HTTP method
     * @param {Object} adminData - Admin's response data
     * @param {Object|null} userData - User's response data
     * @param {boolean} userCanAccess - Whether user could access
     * @param {string|null} userError - Error message if access denied
     * @returns {ComparisonResult} The comparison result
     * @private
     */
    // eslint-disable-next-line complexity
    _compareResponses(url, method, adminData, userData, userCanAccess, userError) {
        const result = {
            url: this._simplifyUrl(url),
            fullUrl: url,
            method,
            timestamp: new Date(),
            userCanAccess,
            error: userError,
            hiddenRecords: [],
            hiddenFields: [],
            hasDifferences: false,
            entityName: this._extractEntityName(url),
            recordId: this._extractRecordId(url),
            adminCount: null,
            userCount: null,
            hiddenCount: 0
        };

        if (!userCanAccess) {
            result.hasDifferences = true;
            return result;
        }

        if (!userData) {
            return result;
        }

        if (adminData.value && Array.isArray(adminData.value)) {
            const adminTotalCount = adminData['@odata.count'] ?? adminData['@Microsoft.Dynamics.CRM.totalrecordcount'] ?? null;
            const userTotalCount = userData['@odata.count'] ?? userData['@Microsoft.Dynamics.CRM.totalrecordcount'] ?? null;

            result.adminCount = adminTotalCount;
            result.userCount = userTotalCount;

            if (adminTotalCount !== null && userTotalCount !== null) {
                const hiddenByCount = adminTotalCount - userTotalCount;
                if (hiddenByCount > 0) {
                    result.hiddenCount = hiddenByCount;
                    result.hasDifferences = true;
                }
            }

            const adminIds = new Set(adminData.value.map(r => this._getRecordId(r)));
            const userIds = new Set((userData.value || []).map(r => this._getRecordId(r)));

            for (const id of adminIds) {
                if (!userIds.has(id)) {
                    result.hiddenRecords.push(id);
                }
            }

            if (result.hiddenCount === 0 && result.hiddenRecords.length > 0) {
                result.hiddenCount = result.hiddenRecords.length;
                result.hasDifferences = true;
            }

            if (result.hiddenCount > 0) {
                result.hasDifferences = true;
            }
        }

        if (!adminData.value) {
            const adminFields = this._getFieldNames(adminData);
            const userFields = this._getFieldNames(userData);

            for (const field of adminFields) {
                if (!userFields.includes(field)) {
                    result.hiddenFields.push(field);
                }
            }

            if (result.hiddenFields.length > 0) {
                result.hasDifferences = true;
            }
        }

        return result;
    }

    /**
     * Extracts the primary key value from a record.
     * @param {Object} record - The record object
     * @returns {string} The record ID
     * @private
     */
    _getRecordId(record) {
        for (const [key, value] of Object.entries(record)) {
            if (key.endsWith('id') && typeof value === 'string') {
                if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
                    return value;
                }
                // Also accept simple IDs (for tests and non-standard scenarios)
                if (value) {
                    return value;
                }
            }
        }
        return JSON.stringify(record).substring(0, 50);
    }

    /**
     * Gets field names from a record, excluding OData annotations.
     * @param {Object} data - The record data
     * @returns {string[]} Array of field names
     * @private
     */
    _getFieldNames(data) {
        return Object.keys(data).filter(key => {
            if (key.startsWith('@') || key.startsWith('_') || key.includes('@')) {
                return false;
            }
            return true;
        });
    }

    /**
     * Simplifies a URL for display.
     * @param {string} url - The full URL
     * @returns {string} Simplified URL
     * @private
     */
    _simplifyUrl(url) {
        try {
            const match = url.match(/\/api\/data\/v[\d.]+\/(.+)/);
            return match ? match[1].split('?')[0] : url;
        } catch {
            return url;
        }
    }

    /**
     * Extracts entity name from URL.
     * @param {string} url - The API URL
     * @returns {string} Entity name
     * @private
     */
    _extractEntityName(url) {
        try {
            const match = url.match(/\/api\/data\/v[\d.]+\/([a-z_]+)/i);
            return match ? match[1] : 'Unknown';
        } catch {
            return 'Unknown';
        }
    }

    /**
     * Extracts record ID from URL.
     * @param {string} url - The API URL
     * @returns {string|null} Record ID or null
     * @private
     */
    _extractRecordId(url) {
        try {
            const match = url.match(/\(([0-9a-f-]{36})\)/i);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }

    /**
     * Adds a comparison result to the list.
     * @param {ComparisonResult} result - The comparison result
     * @private
     */
    _addComparisonResult(result) {
        this.comparisonResults.unshift(result);

        if (this.comparisonResults.length > this.maxResults) {
            this.comparisonResults = this.comparisonResults.slice(0, this.maxResults);
        }

        if (this.onComparisonUpdate) {
            this.onComparisonUpdate(this.comparisonResults);
        }
    }

    /**
     * Cleans up and restores original functions.
     * @private
     */
    _cleanup() {
        if (this._originalFetch) {
            window.fetch = this._originalFetch;
            this._originalFetch = null;
        }

        if (typeof window !== 'undefined' && typeof window.XMLHttpRequest !== 'undefined' && window.XMLHttpRequest.prototype) {
            if (this._originalXHROpen) {
                window.XMLHttpRequest.prototype.open = this._originalXHROpen;
                this._originalXHROpen = null;
            }

            if (this._originalXHRSend) {
                window.XMLHttpRequest.prototype.send = this._originalXHRSend;
                this._originalXHRSend = null;
            }
        }

        this._processingUrls.clear();
    }

    /**
     * Gets a summary of current differences.
     * @returns {Object} Summary object
     */
    getSummary() {
        const accessDenied = this.comparisonResults.filter(r => !r.userCanAccess).length;
        const hiddenRecords = this.comparisonResults.reduce((sum, r) => {
            return sum + (r.hiddenCount > 0 ? r.hiddenCount : r.hiddenRecords.length);
        }, 0);
        const hiddenFields = this.comparisonResults.reduce((sum, r) => sum + r.hiddenFields.length, 0);

        return {
            totalDifferences: this.comparisonResults.length,
            accessDenied,
            hiddenRecords,
            hiddenFields
        };
    }

    /**
     * Starts URL monitoring to detect navigation and trigger automatic command comparison.
     * @private
     */
    _startUrlMonitoring() {
        this._currentPageUrl = window.location.href;
        this._lastContext = this._detectPageContext();
        this._urlMonitorInterval = setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== this._currentPageUrl) {
                this._currentPageUrl = currentUrl;
                this._onNavigationDetected();
            }
        }, 500);
    }

    /**
     * Stops URL monitoring.
     * @private
     */
    _stopUrlMonitoring() {
        if (this._urlMonitorInterval) {
            clearInterval(this._urlMonitorInterval);
            this._urlMonitorInterval = null;
        }
        this._currentPageUrl = null;
    }

    /**
     * Called when navigation is detected.
     * @private
     */
    _onNavigationDetected() {
        setTimeout(() => {
            const newContext = this._detectPageContext();

            if (this._hasContextChanged(this._lastContext, newContext)) {
                this._lastContext = newContext;

                if (newContext && (newContext.isForm || newContext.isGrid) && this.onCommandBarContextChange) {
                    this.onCommandBarContextChange(newContext);
                }
            }
        }, 1000); // Wait 1 second for page to load
    }

    /**
     * Detects the current page context (form or grid).
     * @returns {Object|null} Context object or null
     * @private
     */
    _detectPageContext() {
        try {
            const url = window.location.href;

            if (url.includes('/main.aspx') && url.includes('etn=') && url.includes('id=')) {
                const entityMatch = url.match(/etn=([^&]+)/);
                const entity = entityMatch ? entityMatch[1] : null;
                return {
                    type: 'Form',
                    entity,
                    isForm: true,
                    isGrid: false
                };
            }

            if (url.includes('/main.aspx') && url.includes('etn=') && url.includes('viewid=')) {
                const entityMatch = url.match(/etn=([^&]+)/);
                const entity = entityMatch ? entityMatch[1] : null;
                return {
                    type: 'Grid',
                    entity,
                    isForm: false,
                    isGrid: true
                };
            }

            if (typeof Xrm !== 'undefined' && Xrm.Page) {
                const entityName = Xrm.Page.data?.entity?.getEntityName?.();
                if (entityName) {
                    return {
                        type: 'Form',
                        entity: entityName,
                        isForm: true,
                        isGrid: false
                    };
                }
            }

            return null;
        } catch (_e) {
            return null;
        }
    }

    /**
     * Checks if the context has changed.
     * @param {Object|null} oldContext - Previous context
     * @param {Object|null} newContext - New context
     * @returns {boolean} Whether context has changed
     * @private
     */
    _hasContextChanged(oldContext, newContext) {
        if (!oldContext && newContext) {
            return true;
        }
        if (oldContext && !newContext) {
            return false;
        }
        if (!oldContext && !newContext) {
            return false;
        }

        return oldContext.entity !== newContext.entity || oldContext.type !== newContext.type;
    }
}

export const LiveImpersonationService = new LiveImpersonationServiceClass();
