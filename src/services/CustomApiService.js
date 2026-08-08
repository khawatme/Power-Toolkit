/* global performance */

/**
 * @file Service for Custom API management and execution.
 * @module services/CustomApiService
 * @description Provides CRUD operations for Dataverse Custom APIs, request parameters,
 * and response properties. Includes execution and code generation.
 *
 * This service uses the browser's Performance API (`performance.now()`) to measure
 * the elapsed time of API executions. The global `performance` object is declared
 * at the top of this file to satisfy linting rules in environments where it is not
 * automatically recognised as a browser global.
 */

import { DataService } from './DataService.js';
import { WebApiService } from './WebApiService.js';
import { PowerAppsApiService } from './PowerAppsApiService.js';
import { MetadataService } from './MetadataService.js';
import { Config } from '../constants/index.js';

/**
 * @typedef {object} CustomApiDefinition
 * @property {string} customapiid
 * @property {string} uniquename
 * @property {string} displayname
 * @property {string} description
 * @property {number} bindingtype - 0=Global, 1=Entity, 2=EntityCollection
 * @property {string} boundentitylogicalname
 * @property {boolean} isfunction - true=Function(GET), false=Action(POST)
 * @property {boolean} isprivate
 * @property {number} allowedcustomprocessingsteptype
 * @property {string} executeprivilegename
 * @property {boolean} workflowsdkstepenabled
 * @property {boolean} ismanaged
 * @property {object} [PluginTypeId]
 * @property {CustomApiRequestParam[]} CustomAPIRequestParameters
 * @property {CustomApiResponseProp[]} CustomAPIResponseProperties
 */

/**
 * @typedef {object} CustomApiRequestParam
 * @property {string} customapirequestparameterid
 * @property {string} uniquename
 * @property {string} name
 * @property {string} displayname
 * @property {string} description
 * @property {number} type - 0-12 field type code
 * @property {boolean} isoptional
 * @property {string} logicalentityname
 */

/**
 * @typedef {object} CustomApiResponseProp
 * @property {string} customapiresponsepropertyid
 * @property {string} uniquename
 * @property {string} name
 * @property {string} displayname
 * @property {string} description
 * @property {number} type - 0-12 field type code
 * @property {string} logicalentityname
 */

/** @private Web API select columns for the customapi table */
const API_SELECT = [
    'customapiid', 'uniquename', 'name', 'allowedcustomprocessingsteptype',
    'bindingtype', 'boundentitylogicalname', 'description', 'displayname',
    'executeprivilegename', 'isfunction', 'isprivate', 'ismanaged',
    'workflowsdkstepenabled', '_plugintypeid_value'
].join(',');

/** @private Expand for request parameters */
const PARAM_EXPAND = 'CustomAPIRequestParameters($select=customapirequestparameterid,uniquename,name,displayname,description,type,logicalentityname,isoptional)';

/** @private Expand for response properties */
const PROP_EXPAND = 'CustomAPIResponseProperties($select=customapiresponsepropertyid,uniquename,name,displayname,description,type,logicalentityname)';

/** @private Expand for plugin type */
const PLUGIN_EXPAND = 'PluginTypeId($select=plugintypeid,typename,name,assemblyname)';

/**
 * Service for Custom API CRUD, execution, and code generation.
 * @namespace CustomApiService
 */
export const CustomApiService = {

    // ═══════════════════════════════════════════════════════════════
    // BROWSE / READ
    // ═══════════════════════════════════════════════════════════════

    /**
     * Fetches all Custom APIs with their request parameters and response properties.
     * @returns {Promise<CustomApiDefinition[]>}
     */
    async fetchAll() {
        const qs = `?$select=${API_SELECT}&$expand=${PARAM_EXPAND},${PROP_EXPAND},${PLUGIN_EXPAND}&$orderby=uniquename asc`;
        const result = await DataService.retrieveMultipleRecords('customapi', qs);
        return result?.entities || [];
    },

    /**
     * Fetches Custom APIs belonging to a specific solution via solutioncomponent.
     * @param {string} solutionId - Solution GUID
     * @returns {Promise<CustomApiDefinition[]>}
     */
    async fetchBySolution(solutionId) {
        // Fetch all solution component objectids and all Custom APIs in parallel,
        // then intersect client-side. This avoids relying on componenttype values
        // which vary by environment for Custom API entities.
        const [compResult, apiResult] = await Promise.all([
            DataService.retrieveMultipleRecords('solutioncomponent',
                `?$select=objectid&$filter=_solutionid_value eq '${solutionId}'`),
            DataService.retrieveMultipleRecords('customapi',
                `?$select=${API_SELECT}&$expand=${PARAM_EXPAND},${PROP_EXPAND},${PLUGIN_EXPAND}&$orderby=uniquename asc`)
        ]);
        const solutionIds = new Set((compResult?.entities || []).map(c => c.objectid));
        return (apiResult?.entities || []).filter(api => solutionIds.has(api.customapiid));
    },

    /**
     * Fetches a single Custom API by ID with full expansion.
     * @param {string} id - customapiid GUID
     * @returns {Promise<CustomApiDefinition>}
     */
    // eslint-disable-next-line require-await
    async fetchById(id) {
        const qs = `?$select=${API_SELECT}&$expand=${PARAM_EXPAND},${PROP_EXPAND},${PLUGIN_EXPAND}`;
        return DataService.retrieveRecord('customapi', id, qs);
    },

    // ═══════════════════════════════════════════════════════════════
    // CREATE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Creates a new Custom API with optional deep-insert of parameters and properties.
     * @param {object} definition - API definition fields
     * @param {CustomApiRequestParam[]} [params] - Request parameters to deep-insert
     * @param {CustomApiResponseProp[]} [props] - Response properties to deep-insert
     * @param {string} [solutionUniqueName=''] - Solution to create the API in
     * @returns {Promise<object>} Created API response
     */
    // eslint-disable-next-line require-await
    async create(definition, params = [], props = [], solutionUniqueName = '') {
        const payload = { ...definition };
        if (params.length > 0) {
            payload.CustomAPIRequestParameters = params;
        }
        if (props.length > 0) {
            payload.CustomAPIResponseProperties = props;
        }
        const headers = solutionUniqueName ? { 'MSCRM.SolutionUniqueName': solutionUniqueName } : {};
        return DataService.createRecord('customapi', payload, headers);
    },

    /**
     * Adds a request parameter to an existing Custom API.
     * @param {string} apiId - customapiid GUID
     * @param {object} param - Parameter definition
     * @param {string} [solutionUniqueName=''] - Solution to create the parameter in
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async addRequestParameter(apiId, param, solutionUniqueName = '') {
        const payload = {
            ...param,
            'CustomAPIId@odata.bind': `/customapis(${apiId})`
        };
        const headers = solutionUniqueName ? { 'MSCRM.SolutionUniqueName': solutionUniqueName } : {};
        return DataService.createRecord('customapirequestparameter', payload, headers);
    },

    /**
     * Adds a response property to an existing Custom API.
     * @param {string} apiId - customapiid GUID
     * @param {object} prop - Property definition
     * @param {string} [solutionUniqueName=''] - Solution to create the property in
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async addResponseProperty(apiId, prop, solutionUniqueName = '') {
        const payload = {
            ...prop,
            'CustomAPIId@odata.bind': `/customapis(${apiId})`
        };
        const headers = solutionUniqueName ? { 'MSCRM.SolutionUniqueName': solutionUniqueName } : {};
        return DataService.createRecord('customapiresponseproperty', payload, headers);
    },

    // ═══════════════════════════════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Updates mutable fields of a Custom API.
     * @param {string} id - customapiid GUID
     * @param {object} changes - Mutable field changes
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async update(id, changes) {
        return DataService.updateRecord('customapi', id, changes);
    },

    /**
     * Updates a request parameter's mutable fields.
     * @param {string} id - customapirequestparameterid GUID
     * @param {object} changes - Mutable field changes
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async updateRequestParameter(id, changes) {
        return DataService.updateRecord('customapirequestparameter', id, changes);
    },

    /**
     * Updates a response property's mutable fields.
     * @param {string} id - customapiresponsepropertyid GUID
     * @param {object} changes - Mutable field changes
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async updateResponseProperty(id, changes) {
        return DataService.updateRecord('customapiresponseproperty', id, changes);
    },

    // ═══════════════════════════════════════════════════════════════
    // DELETE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Deletes a Custom API (cascades to params/props).
     * @param {string} id - customapiid GUID
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async delete(id) {
        return DataService.deleteRecord('customapi', id);
    },

    /**
     * Deletes a request parameter.
     * @param {string} id - customapirequestparameterid GUID
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async deleteRequestParameter(id) {
        return DataService.deleteRecord('customapirequestparameter', id);
    },

    /**
     * Deletes a response property.
     * @param {string} id - customapiresponsepropertyid GUID
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line require-await
    async deleteResponseProperty(id) {
        return DataService.deleteRecord('customapiresponseproperty', id);
    },

    // ═══════════════════════════════════════════════════════════════
    // EXECUTE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Executes a Custom API.
     * @param {CustomApiDefinition} api - The API definition
     * @param {object} paramValues - Key-value map of parameter unique names to values
     * @param {string} [targetId] - Record ID for entity-bound APIs
     * @param {object} [customHeaders] - Additional HTTP headers
     * @returns {Promise<{status: number, statusText: string, body: *, headers: object, duration: number}>}
     */
    async execute(api, paramValues = {}, targetId = '', customHeaders = {}) {
        const startTime = performance.now();
        const globalContext = PowerAppsApiService.getGlobalContext();
        const baseUrl = `${globalContext.getClientUrl()}/api/data/v9.2`;
        const endpoint = this.buildEndpointUrl(api, targetId);
        const url = `${baseUrl}/${endpoint}`;
        const isFunction = api.isfunction;
        const method = isFunction ? 'GET' : 'POST';

        // Honour impersonation: "can this user run this API?" is the whole point of executing one
        // while impersonating, and answering it as the signed-in user is worse than not answering.
        const headers = WebApiService.buildHeaders(customHeaders, DataService.getImpersonationInfo().userId);

        const fetchOptions = { method, headers };

        if (isFunction) {
            // For functions, parameters go in the URL
            // Already handled by buildEndpointUrl with paramValues
            // Re-build with actual param values
            const funcUrl = `${baseUrl}/${this.buildEndpointUrl(api, targetId, paramValues)}`;
            const resp = await fetch(funcUrl, fetchOptions);
            const duration = Math.round(performance.now() - startTime);
            return this._parseExecutionResponse(resp, duration);
        }

        // For actions, parameters go in the body
        const body = this.buildRequestBody(api, paramValues);
        if (Object.keys(body).length > 0) {
            fetchOptions.body = JSON.stringify(body);
        }

        const resp = await fetch(url, fetchOptions);
        const duration = Math.round(performance.now() - startTime);
        return this._parseExecutionResponse(resp, duration);
    },

    /**
     * Parses the execution response into a structured result.
     * @private
     * @param {Response} resp - Fetch response
     * @param {number} duration - Duration in ms
     * @returns {Promise<{status: number, statusText: string, body: *, headers: object, duration: number, size: number}>}
     */
    async _parseExecutionResponse(resp, duration) {
        const responseHeaders = {};
        resp.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        let body = null;
        let size = 0;
        try {
            const text = await resp.text();
            size = new Blob([text]).size;
            body = text ? JSON.parse(text) : null;
        } catch {
            // body stays null for non-JSON responses
        }

        return {
            status: resp.status,
            statusText: resp.statusText,
            body,
            headers: responseHeaders,
            duration,
            size
        };
    },

    // ═══════════════════════════════════════════════════════════════
    // URL BUILDER
    // ═══════════════════════════════════════════════════════════════

    /**
     * Builds the correct endpoint URL for executing a Custom API.
     * Handles all binding types and function vs action patterns.
     * @param {CustomApiDefinition} api - The API definition
     * @param {string} [targetId] - Record ID for entity-bound APIs
     * @param {object} [paramValues] - Parameter values (used for functions in URL)
     * @returns {string} Relative endpoint path
     */
    buildEndpointUrl(api, targetId = '', paramValues = {}) {
        const name = api.uniquename;
        const binding = api.bindingtype;
        const isFunction = api.isfunction;
        const boundEntity = api.boundentitylogicalname;

        // Resolve entity set name from logical name
        let entitySet = '';
        if (boundEntity) {
            entitySet = MetadataService.getEntitySetName(boundEntity) || `${boundEntity}s`;
        }

        const qualifiedName = `Microsoft.Dynamics.CRM.${name}`;

        if (isFunction) {
            const paramStr = this._buildFunctionParams(api, paramValues);
            if (binding === 1 && targetId) {
                // Entity-bound function
                return `${entitySet}(${targetId})/${qualifiedName}(${paramStr})`;
            }
            if (binding === 2) {
                // EntityCollection-bound function
                return `${entitySet}/${qualifiedName}(${paramStr})`;
            }
            // Global function
            return `${name}(${paramStr})`;
        }

        // Action (POST)
        if (binding === 1 && targetId) {
            return `${entitySet}(${targetId})/${qualifiedName}`;
        }
        if (binding === 2) {
            return `${entitySet}/${qualifiedName}`;
        }
        // Global action
        return name;
    },

    /**
     * Builds function parameter string for URL.
     * Uses OData function call syntax with aliases.
     * @private
     * @param {CustomApiDefinition} api - The API definition
     * @param {object} paramValues - Parameter values
     * @returns {string} Parameter string for function URL
     */
    _buildFunctionParams(api, paramValues = {}) {
        const params = (api.CustomAPIRequestParameters || [])
            .filter(p => p.uniquename !== 'Target');

        if (params.length === 0) {
            return '';
        }

        const parts = [];
        params.forEach((p, i) => {
            const val = paramValues[p.uniquename];
            if (val !== undefined && val !== null && val !== '') {
                const alias = `@p${i}`;
                parts.push(`${p.uniquename}=${alias}`);
            }
        });

        if (parts.length === 0) {
            return '';
        }

        // Append alias values as query string would, but inline for simplicity
        let result = parts.join(',');
        params.forEach((p, i) => {
            const val = paramValues[p.uniquename];
            if (val !== undefined && val !== null && val !== '') {
                const alias = `@p${i}`;
                const encoded = this._encodeFunctionValue(val, p.type);
                result += (result.includes('?') ? '&' : '?') + `${alias}=${encoded}`;
            }
        });

        return result;
    },

    /**
     * Encodes a value for use in a function URL parameter.
     * @private
     * @param {*} value - The value to encode
     * @param {number} type - The parameter type code
     * @returns {string} Encoded value
     */
    _encodeFunctionValue(value, type) {
        switch (type) {
            case 10: // String
                return `'${encodeURIComponent(String(value))}'`;
            case 12: // Guid
                return String(value);
            case 0:  // Boolean
                return String(value).toLowerCase();
            case 1:  // DateTime
                return String(value);
            default:
                return encodeURIComponent(String(value));
        }
    },

    /**
     * Builds the JSON request body from parameter definitions and values.
     * @param {CustomApiDefinition} api - The API definition
     * @param {object} paramValues - Key-value map of parameter names to values
     * @returns {object} JSON body for POST
     */
    buildRequestBody(api, paramValues = {}) {
        const body = {};
        const params = api.CustomAPIRequestParameters || [];

        for (const param of params) {
            if (param.uniquename === 'Target') {
                continue;
            } // Target is in URL for bound APIs
            const val = paramValues[param.uniquename];
            if (val !== undefined && val !== null && val !== '') {
                body[param.uniquename] = this._coerceParamValue(val, param.type);
            }
        }

        return body;
    },

    /**
     * Coerces a parameter value to the correct type.
     * @private
     * @param {*} value - Raw value
     * @param {number} type - Parameter type code
     * @returns {*} Coerced value
     */
    _coerceParamValue(value, type) {
        switch (type) {
            case 0:  // Boolean
                return value === true || value === 'true';
            case 2: case 6: case 8: // Decimal, Float, Money
                return parseFloat(value) || 0;
            case 7: case 9: // Integer, Picklist
                return parseInt(value, 10) || 0;
            case 3: case 4: // Entity, EntityCollection
                return typeof value === 'string' ? JSON.parse(value) : value;
            case 5: // EntityReference
                if (typeof value === 'object') {
                    return value;
                }
                return typeof value === 'string' ? JSON.parse(value) : value;
            case 11: // StringArray
                if (Array.isArray(value)) {
                    return value;
                }
                if (typeof value === 'string') {
                    const trimmed = value.trim();
                    if (trimmed.startsWith('[')) {
                        return JSON.parse(trimmed);
                    }
                    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
                }
                return [value];
            default: // String, DateTime, Guid
                return value;
        }
    },

    /**
     * Generates an auto-populated parameter values object from API definition.
     * @param {CustomApiDefinition} api - The API definition
     * @returns {object} Default parameter values keyed by uniquename
     */
    generateDefaultParamValues(api) {
        const values = {};
        const params = api.CustomAPIRequestParameters || [];
        for (const param of params) {
            if (param.uniquename === 'Target') {
                continue;
            }
            // DateTime (type 1) gets a fresh timestamp instead of stale module-load value
            values[param.uniquename] = param.type === 1
                ? new Date().toISOString()
                : (Config.CUSTOM_API_TYPE_DEFAULTS[param.type] ?? '');
        }
        return values;
    },

    // ═══════════════════════════════════════════════════════════════
    // CODE GENERATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Generates a code snippet for calling this Custom API.
     * @param {CustomApiDefinition} api - The API definition
     * @param {object} paramValues - Parameter values
     * @param {'javascript'|'csharp'|'http'|'powerAutomate'} language - Target language
     * @param {string} [targetId] - Record ID for entity-bound APIs
     * @returns {string} Code snippet
     */
    generateCodeSnippet(api, paramValues = {}, language = 'javascript', targetId = '') {
        switch (language) {
            case 'javascript':
                return this._generateJavaScript(api, paramValues, targetId);
            case 'csharp':
                return this._generateCSharp(api, paramValues, targetId);
            case 'http':
                return this._generateHttp(api, paramValues, targetId);
            case 'powerAutomate':
                return this._generatePowerAutomate(api, paramValues, targetId);
            default:
                return this._generateJavaScript(api, paramValues, targetId);
        }
    },

    /**
     * Generates JavaScript fetch snippet.
     * @private
     */
    _generateJavaScript(api, paramValues, targetId) {
        const endpoint = this.buildEndpointUrl(api, targetId, paramValues);
        const method = api.isfunction ? 'GET' : 'POST';
        const body = api.isfunction ? null : this.buildRequestBody(api, paramValues);

        let code = `// Execute Custom API: ${api.uniquename}\n`;
        code += 'const url = Xrm.Utility.getGlobalContext().getClientUrl()\n';
        code += `    + "/api/data/v9.2/${endpoint}";\n\n`;
        code += 'const response = await fetch(url, {\n';
        code += `    method: "${method}",\n`;
        code += '    headers: {\n';
        code += '        "OData-MaxVersion": "4.0",\n';
        code += '        "OData-Version": "4.0",\n';
        code += '        "Accept": "application/json",\n';
        code += '        "Content-Type": "application/json; charset=utf-8"\n';
        code += '    }';
        if (body && Object.keys(body).length > 0) {
            code += `,\n    body: JSON.stringify(${JSON.stringify(body, null, 8).replace(/\n/g, '\n    ')})`;
        }
        code += '\n});\n\n';
        code += 'const result = await response.json();\nconsole.log(result);';
        return code;
    },

    /**
     * Generates C# SDK snippet.
     * @private
     */
    _generateCSharp(api, paramValues) {
        const body = this.buildRequestBody(api, paramValues);
        let code = `// Execute Custom API: ${api.uniquename}\n`;
        code += `var request = new OrganizationRequest("${api.uniquename}");\n`;

        for (const [key, val] of Object.entries(body)) {
            const csVal = typeof val === 'string' ? `"${val}"` :
                typeof val === 'boolean' ? val.toString().toLowerCase() :
                    JSON.stringify(val);
            code += `request["${key}"] = ${csVal};\n`;
        }

        code += '\nvar response = await service.ExecuteAsync(request);\n';

        const props = api.CustomAPIResponseProperties || [];
        if (props.length > 0) {
            code += '\n// Read response properties\n';
            for (const prop of props) {
                const csType = this._getCSharpType(prop.type);
                code += `var ${prop.uniquename} = (${csType})response["${prop.uniquename}"];\n`;
            }
        }
        return code;
    },

    /**
     * Maps Custom API field type to C# type name.
     * @private
     * @param {number} type
     * @returns {string}
     */
    _getCSharpType(type) {
        const map = {
            0: 'bool', 1: 'DateTime', 2: 'decimal', 3: 'Entity',
            4: 'EntityCollection', 5: 'EntityReference', 6: 'float',
            7: 'int', 8: 'Money', 9: 'OptionSetValue', 10: 'string',
            11: 'string[]', 12: 'Guid'
        };
        return map[type] || 'object';
    },

    /**
     * Generates raw HTTP snippet.
     * @private
     */
    _generateHttp(api, paramValues, targetId) {
        const endpoint = this.buildEndpointUrl(api, targetId, paramValues);
        const method = api.isfunction ? 'GET' : 'POST';
        const body = api.isfunction ? null : this.buildRequestBody(api, paramValues);

        let orgUri;
        try {
            orgUri = PowerAppsApiService.getGlobalContext()?.getClientUrl?.() || '[Organization URI]';
        } catch {
            orgUri = '[Organization URI]';
        }

        let code = `${method} ${orgUri}/api/data/v9.2/${endpoint} HTTP/1.1\n`;
        code += 'OData-MaxVersion: 4.0\n';
        code += 'OData-Version: 4.0\n';
        code += 'Accept: application/json\n';
        code += 'Content-Type: application/json; charset=utf-8\n';

        if (body && Object.keys(body).length > 0) {
            code += `\n${JSON.stringify(body, null, 2)}`;
        }
        return code;
    },

    /**
     * Generates Power Automate HTTP action JSON.
     * @private
     */
    _generatePowerAutomate(api, paramValues, targetId) {
        const endpoint = this.buildEndpointUrl(api, targetId, paramValues);
        const method = api.isfunction ? 'GET' : 'POST';
        const body = api.isfunction ? undefined : this.buildRequestBody(api, paramValues);

        const action = {
            type: 'OpenApiConnection',
            inputs: {
                host: { connectionName: 'shared_commondataserviceforapps' },
                method,
                path: `/api/data/v9.2/${endpoint}`,
                headers: {
                    'OData-MaxVersion': '4.0',
                    'OData-Version': '4.0',
                    'Content-Type': 'application/json'
                }
            }
        };

        if (body && Object.keys(body).length > 0) {
            action.inputs.body = body;
        }

        return JSON.stringify(action, null, 2);
    },

    // ═══════════════════════════════════════════════════════════════
    // EXPORT / IMPORT
    // ═══════════════════════════════════════════════════════════════

    /**
     * Exports a full Custom API definition as a portable JSON object.
     * @param {CustomApiDefinition} api - The API to export
     * @returns {object} Portable definition (without IDs)
     */
    exportDefinition(api) {
        return {
            uniquename: api.uniquename,
            name: api.name || '',
            displayname: api.displayname,
            description: api.description,
            bindingtype: api.bindingtype,
            boundentitylogicalname: api.boundentitylogicalname,
            isfunction: api.isfunction,
            isprivate: api.isprivate,
            allowedcustomprocessingsteptype: api.allowedcustomprocessingsteptype,
            executeprivilegename: api.executeprivilegename,
            workflowsdkstepenabled: api.workflowsdkstepenabled,
            requestParameters: (api.CustomAPIRequestParameters || []).map(p => ({
                uniquename: p.uniquename,
                name: p.name,
                displayname: p.displayname,
                description: p.description,
                type: p.type,
                isoptional: p.isoptional,
                logicalentityname: p.logicalentityname
            })),
            responseProperties: (api.CustomAPIResponseProperties || []).map(p => ({
                uniquename: p.uniquename,
                name: p.name,
                displayname: p.displayname,
                description: p.description,
                type: p.type,
                logicalentityname: p.logicalentityname
            }))
        };
    },

    /**
     * Imports a Custom API from an exported JSON definition.
     * @param {object} definition - Exported definition
     * @returns {Promise<object>} Create result
     */
    // eslint-disable-next-line require-await
    async importDefinition(definition) {
        const apiDef = {
            uniquename: definition.uniquename,
            displayname: definition.displayname,
            description: definition.description || '',
            bindingtype: definition.bindingtype || 0,
            boundentitylogicalname: definition.boundentitylogicalname || '',
            isfunction: definition.isfunction || false,
            isprivate: definition.isprivate || false,
            allowedcustomprocessingsteptype: definition.allowedcustomprocessingsteptype || 0,
            executeprivilegename: definition.executeprivilegename || '',
            workflowsdkstepenabled: definition.workflowsdkstepenabled || false
        };

        const params = (definition.requestParameters || []).map(p => ({
            uniquename: p.uniquename,
            name: p.name || `${definition.uniquename}.${p.uniquename}`,
            displayname: p.displayname || p.uniquename,
            description: p.description || '',
            type: p.type,
            isoptional: p.isoptional ?? false,
            logicalentityname: p.logicalentityname || ''
        }));

        const props = (definition.responseProperties || []).map(p => ({
            uniquename: p.uniquename,
            name: p.name || `${definition.uniquename}.${p.uniquename}`,
            displayname: p.displayname || p.uniquename,
            description: p.description || '',
            type: p.type,
            logicalentityname: p.logicalentityname || ''
        }));

        return this.create(apiDef, params, props);
    },

    // ═══════════════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Gets a human-readable label for a parameter type code.
     * @param {number} typeCode
     * @returns {string}
     */
    getTypeLabel(typeCode) {
        return Config.CUSTOM_API_FIELD_TYPES[typeCode] || `Unknown (${typeCode})`;
    },

    /**
     * Gets a human-readable label for a binding type code.
     * @param {number} bindingCode
     * @returns {string}
     */
    getBindingLabel(bindingCode) {
        return Config.CUSTOM_API_BINDING_TYPES[bindingCode] || `Unknown (${bindingCode})`;
    },

    /**
     * Gets a human-readable label for a processing step type code.
     * @param {number} processingCode
     * @returns {string}
     */
    getProcessingLabel(processingCode) {
        return Config.CUSTOM_API_PROCESSING_TYPES[processingCode] || `Unknown (${processingCode})`;
    },

    /**
     * Fetches available plugin types for the Plugin Type dropdown.
     * Fetches from a specific solution (if selected) or all available.
     * Uses Dataverse max page size since environments typically have fewer plugin types.
     * @param {string} [solutionId] - Optional solution GUID to filter by
     * @returns {Promise<Array<{plugintypeid: string, typename: string, name: string, assemblyname: string}>>}
     */
    async fetchPluginTypes(solutionId) {
        const top = Config.DATAVERSE_PAGINATION.MAX_PAGE_SIZE;
        const qs = `?$select=plugintypeid,typename,name,assemblyname,ismanaged&$filter=isworkflowactivity ne true&$orderby=typename asc&$top=${top}`;
        if (solutionId) {
            // Fetch from solution: get solutioncomponent objectids, then intersect with plugintypes
            const [compResult, pluginResult] = await Promise.all([
                DataService.retrieveMultipleRecords('solutioncomponent',
                    `?$select=objectid&$filter=_solutionid_value eq '${solutionId}' and componenttype eq 90`),
                DataService.retrieveMultipleRecords('plugintype', qs)
            ]);
            const solIds = new Set((compResult?.entities || []).map(c => c.objectid));
            return (pluginResult?.entities || []).filter(p => solIds.has(p.plugintypeid));
        }
        const result = await DataService.retrieveMultipleRecords('plugintype', qs);
        return result?.entities || [];
    }
};
