/**
 * @file Environment Variable management service
 * @module services/EnvironmentVariableService
 * @description Handles CRUD operations for Dataverse environment variables
 */

import { Config } from '../constants/index.js';
import { ValidationService } from './ValidationService.js';

/** @private Current solution context */
let _currentSolutionUniqueName = null;
/** @private Current publisher prefix */
let _currentPublisherPrefix = null;

/**
 * Map friendly type string → Dataverse option value.
 * @private
 * @param {string} typeStr - Type string (string, number, boolean, json)
 * @returns {number} Dataverse option value
 */
function _mapEnvVarTypeToOption(typeStr) {
    const t = String(typeStr || '').toLowerCase();
    const typeConfig = Config.ENV_VAR_TYPES[t];
    return typeConfig ? typeConfig.value : Config.ENV_VAR_TYPES.string.value;
}

/**
 * Ensure schema name has publisher prefix.
 * @private
 * @param {string} schema - Schema name
 * @param {string} fallbackPrefix - Publisher prefix
 * @returns {string} Prefixed schema name
 */
function _ensurePrefixedSchema(schema, fallbackPrefix) {
    const s = String(schema || '').trim();
    if (!s) return s;
    const hasPrefix = s.includes('_') && /^[a-zA-Z0-9]+_/.test(s);
    if (hasPrefix) return s;
    const p = String(fallbackPrefix || '').trim();
    return p ? `${p}_${s}` : s;
}

/**
 * Normalize and validate environment variable value by type.
 * @private
 * @param {string} type - Variable type (string, number, boolean, json)
 * @param {string} raw - Raw value
 * @returns {string} Normalized value
 */
function _normalizeEnvVarValueByType(type, raw) {
    if (raw == null || raw === '') return '';
    const t = String(type || '').toLowerCase();
    const v = String(raw).trim();

    if (t === 'number') {
        const n = ValidationService.validateNumber(v, 'Environment variable value');
        return String(n);
    }
    if (t === 'boolean') {
        const b = ValidationService.validateBoolean(v, 'Environment variable value');
        return String(b);
    }
    if (t === 'json') {
        const parsed = ValidationService.validateJson(v, 'Environment variable value');
        return JSON.stringify(parsed);
    }
    return v; // string
}

/**
 * Format environment variable type option value to display label.
 * @private
 * @param {number} rawValue - Option value
 * @param {string} formatted - Pre-formatted value from OData
 * @returns {string} Type label
 */
function _formatEnvVarTypeOption(rawValue, formatted) {
    if (formatted) return formatted;
    for (const [key, config] of Object.entries(Config.ENV_VAR_TYPES)) {
        if (config.value === rawValue) return config.label;
    }
    return 'Unknown';
}

/**
 * @typedef {object} EnvironmentVariable
 * @property {string} definitionId - The GUID of the variable definition
 * @property {string|null} valueId - The GUID of the variable's current value record
 * @property {string} schemaName - The schema name (e.g., "new_MyVariable")
 * @property {string} displayName - The user-friendly display name
 * @property {string} type - The data type of the variable
 * @property {string} defaultValue - The default value
 * @property {string} currentValue - The current overridden value
 * @property {string} description - Variable description
 */

export const EnvironmentVariableService = {
    /**
     * Set the current solution context by fetching solution details.
     * @param {string|null} uniqueName - Solution unique name
     * @param {Function} retrieveMultipleRecords - DataService retrieve function
     * @returns {Promise<void>}
     */
    async setCurrentSolution(uniqueName, retrieveMultipleRecords) {
        _currentSolutionUniqueName = uniqueName;
        _currentPublisherPrefix = null;

        if (!uniqueName) return;

        // Fetch solution to get publisher prefix
        const query = `?$select=uniquename&$filter=uniquename eq '${uniqueName}'&$expand=publisherid($select=customizationprefix)`;
        const result = await retrieveMultipleRecords('solution', query);

        if (result?.entities?.length > 0) {
            _currentPublisherPrefix = result.entities[0].publisherid?.customizationprefix || null;
        }
    },

    /**
     * Get current solution context.
     * @returns {{uniqueName: string|null, publisherPrefix: string|null}}
     */
    getCurrentSolution() {
        return { uniqueName: _currentSolutionUniqueName, publisherPrefix: _currentPublisherPrefix };
    },

    /**
     * Fetch all environment variables with values.
     * @param {Function} retrieveMultipleRecords - DataService retrieve function
     * @returns {Promise<EnvironmentVariable[]>}
     */
    async getEnvironmentVariables(retrieveMultipleRecords) {
        const options =
            '?$select=schemaname,displayname,type,defaultvalue,description,environmentvariabledefinitionid' +
            '&$expand=environmentvariabledefinition_environmentvariablevalue($select=value,environmentvariablevalueid)';
        const headers = { 'Prefer': 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' };
        const response = await retrieveMultipleRecords('environmentvariabledefinition', options, headers);

        return response.entities.map(d => ({
            definitionId: d.environmentvariabledefinitionid,
            valueId: d.environmentvariabledefinition_environmentvariablevalue[0]?.environmentvariablevalueid,
            schemaName: d.schemaname,
            displayName: d.displayname || d.schemaname,
            type: _formatEnvVarTypeOption(d.type, d['type@OData.Community.Display.V1.FormattedValue']),
            defaultValue: d.defaultvalue || '—',
            currentValue: d.environmentvariabledefinition_environmentvariablevalue[0]?.value ?? '(not set)',
            description: d.description || ''
        }));
    },

    /**
     * Create or update an environment variable value.
     * @param {Function} updateRecord - DataService update function
     * @param {Function} webApiFetch - DataService web API fetch function
     * @param {string} definitionId - Variable definition ID
     * @param {string|null} valueId - Existing value ID or null
     * @param {string} newValue - New value
     * @param {string} definitionSchemaName - Definition schema name
     * @returns {Promise<object>}
     */
    async setEnvironmentVariableValue(updateRecord, webApiFetch, definitionId, valueId, newValue, definitionSchemaName) {
        const payload = { value: newValue };

        if (valueId) {
            return updateRecord('environmentvariablevalue', valueId, payload);
        }

        // Create new value record
        const createPayload = {
            value: newValue,
            schemaname: definitionSchemaName,
            "EnvironmentVariableDefinitionId@odata.bind": `/environmentvariabledefinitions(${definitionId})`
        };
        return webApiFetch('POST', 'environmentvariablevalue', '', createPayload);
    },

    /**
     * Update the default value of an environment variable definition.
     * @param {Function} updateRecord - DataService update function
     * @param {string} definitionId - Definition ID
     * @param {string} newDefault - New default value
     * @returns {Promise<object>}
     */
    async setEnvironmentVariableDefault(updateRecord, definitionId, newDefault) {
        return updateRecord('environmentvariabledefinition', definitionId, {
            defaultvalue: newDefault
        });
    },

    /**
     * Create a new environment variable with optional current value.
     * @param {Function} createRecord - DataService create function
     * @param {Function} webApiFetch - DataService web API fetch function
     * @param {Function} addSolutionComponent - DataService add solution component function
     * @param {object} input - Variable definition
     * @param {string} input.displayName - Display name
     * @param {string} input.schemaName - Schema name
     * @param {string} input.type - Type (String, Number, Boolean, Json)
     * @param {string} [input.description] - Description
     * @param {string} [input.defaultValue] - Default value
     * @param {string} [input.currentValue] - Current value
     * @returns {Promise<{definitionId:string, valueId?:string, schemaname:string}>}
     */
    async createEnvironmentVariable(createRecord, webApiFetch, addSolutionComponent, input) {
        const { uniqueName, publisherPrefix } = this.getCurrentSolution();
        const schema = _ensurePrefixedSchema(input.schemaName, publisherPrefix);

        const defVal = input.defaultValue ? _normalizeEnvVarValueByType(input.type, input.defaultValue) : '';
        const curVal = input.currentValue ? _normalizeEnvVarValueByType(input.type, input.currentValue) : '';

        const payloadDef = {
            displayname: input.displayName,
            schemaname: schema,
            description: input.description || '',
            type: _mapEnvVarTypeToOption(input.type),
        };
        if (defVal !== '') payloadDef.defaultvalue = defVal;

        // Create definition
        const defResult = await createRecord('environmentvariabledefinition', payloadDef);
        const definitionId = defResult.id || defResult.environmentvariabledefinitionid;

        // Add to solution (component type 380 = environment variable definition)
        if (uniqueName) {
            await addSolutionComponent(uniqueName, definitionId, 380, false);
        }

        // Create current value if provided
        let valueId = null;
        if (curVal !== '') {
            const valPayload = {
                value: curVal,
                schemaname: schema,
                "EnvironmentVariableDefinitionId@odata.bind": `/environmentvariabledefinitions(${definitionId})`
            };
            const valResult = await webApiFetch('POST', 'environmentvariablevalue', '', valPayload);
            valueId = valResult?.id || valResult?.environmentvariablevalueid || null;
        }

        return { definitionId, valueId, schemaname: schema };
    },

    /**
     * Delete an environment variable and all its value records.
     * @param {Function} retrieveRecord - DataService retrieve function
     * @param {Function} deleteRecord - DataService delete function
     * @param {string} definitionId - Definition ID
     * @returns {Promise<void>}
     */
    async deleteEnvironmentVariable(retrieveRecord, deleteRecord, definitionId) {
        ValidationService.validateRequired(definitionId, 'definitionId');

        // Get definition with expanded values
        const rec = await retrieveRecord(
            'environmentvariabledefinition',
            definitionId,
            '?$select=environmentvariabledefinitionid' +
            '&$expand=environmentvariabledefinition_environmentvariablevalue($select=environmentvariablevalueid)'
        );

        // Delete all value records first
        const values = rec?.environmentvariabledefinition_environmentvariablevalue || [];
        for (const v of values) {
            if (v.environmentvariablevalueid) {
                await deleteRecord('environmentvariablevalue', v.environmentvariablevalueid);
            }
        }

        // Delete definition
        await deleteRecord('environmentvariabledefinition', definitionId);
    }
};
