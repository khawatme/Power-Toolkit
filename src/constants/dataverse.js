/**
 * Microsoft Dataverse and Dynamics 365 specific constants.
 * @module constants/dataverse
 */

/**
 * Dataverse Web API endpoints that should not be pluralized or mapped to entity sets.
 * These are special functions, actions, or metadata endpoints.
 * @type {string[]}
 */
export const DATAVERSE_SPECIAL_ENDPOINTS = [
    'RetrieveUserPrivileges',
    'AddSolutionComponent',
    'RemoveSolutionComponent',
    'PublishAll',
    'PublishXml',
    'CloneSolution',
    'EntityDefinitions',
    'entities',
    'privileges'
];

/**
 * Dataverse attribute/value type names used in Plugin SDK format.
 * These __type values are used in IPluginExecutionContext.
 * @type {Object.<string, string>}
 */
export const DATAVERSE_TYPES = {
    ENTITY: 'Entity',
    ENTITY_REFERENCE: 'EntityReference',
    MONEY: 'Money',
    OPTION_SET_VALUE: 'OptionSetValue',
    OPTION_SET_VALUE_COLLECTION: 'OptionSetValueCollection',
    ENTITY_COLLECTION: 'EntityCollection',
    PARAMETER_COLLECTION: 'ParameterCollection',
    ATTRIBUTE_COLLECTION: 'AttributeCollection',
    DATE_TIME: 'DateTime'
};

/**
 * System-generated and read-only fields that should be filtered out
 * when creating new records or generating code samples.
 * @type {string[]}
 */
export const SYSTEM_FIELDS = [
    'createdon',
    'createdby',
    'modifiedon',
    'modifiedby',
    'versionnumber',
    'overriddencreatedon',
    'importsequencenumber',
    'timezoneruleversionnumber',
    'utcconversiontimezonecode',
    'createdbyname',
    'modifiedbyname',
    'createdonbehalfby',
    'modifiedonbehalfby',
    'ownerid',
    'owningbusinessunit',
    'owninguser',
    'owningteam'
];

/**
 * Common field data types in Dataverse/Dynamics 365.
 * Used for field type detection and conversion.
 * @type {Object.<string, string>}
 */
export const FIELD_TYPES = {
    STRING: 'string',
    MEMO: 'memo',
    INTEGER: 'integer',
    DECIMAL: 'decimal',
    DOUBLE: 'double',
    MONEY: 'money',
    BOOLEAN: 'boolean',
    DATETIME: 'datetime',
    LOOKUP: 'lookup',
    PICKLIST: 'picklist',
    MULTI_SELECT_PICKLIST: 'multiselectpicklist',
    OWNER: 'owner',
    CUSTOMER: 'customer',
    UNIQUEIDENTIFIER: 'uniqueidentifier',
    STATE: 'state',
    STATUS: 'status'
};

/**
 * Dynamics 365 form type constants.
 * @see https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/formcontext-ui/getformtype
 * @type {Object.<string, number>}
 */
export const FORM_TYPES = {
    UNDEFINED: 0,
    CREATE: 1,
    UPDATE: 2,
    READ_ONLY: 3,
    DISABLED: 4,
    QUICK_CREATE: 5,
    BULK_EDIT: 6
};

/**
 * Default return values for PowerApps API service methods when context is unavailable.
 * @type {Object}
 */
export const POWERAPPS_API_DEFAULTS = {
    formType: 0,
    formId: null,
    entityName: null,
    entityId: '',
    emptyArray: [],
    promise: Promise.resolve()
};

/**
 * Error messages for PowerApps API service.
 * @type {Object.<string, string>}
 */
export const POWERAPPS_API_ERRORS = {
    formContextFailed: 'Power-Toolkit Error: Failed to get formContext.'
};

/**
 * Environment variable type mappings for Dataverse environmentvariabledefinition.type field.
 * Maps friendly type names to Dataverse option values.
 * @type {Object.<string, {value: number, label: string}>}
 */
export const ENV_VAR_TYPES = {
    string: { value: 100000000, label: 'String' },
    number: { value: 100000001, label: 'Number' },
    boolean: { value: 100000002, label: 'Boolean' },
    json: { value: 100000003, label: 'JSON' }
};

/**
 * Commonly used Dataverse entity logical names.
 * Centralizes entity name strings to avoid typos and enable refactoring.
 * @type {Object.<string, string>}
 */
export const ENTITY_NAMES = {
    WORKFLOW: 'workflow',
    WORKFLOWS: 'workflows',
    SYSTEMFORM: 'systemform',
    SYSTEMFORMS: 'systemforms',
    ENVIRONMENT_VARIABLE_DEFINITION: 'environmentvariabledefinition',
    ENVIRONMENT_VARIABLE_DEFINITIONS: 'environmentvariabledefinitions',
    ENVIRONMENT_VARIABLE_VALUE: 'environmentvariablevalue',
    ENVIRONMENT_VARIABLE_VALUES: 'environmentvariablevalues',
    PLUGINTRACELOG: 'plugintracelog',
    PLUGINTRACELOGS: 'plugintracelogs',
    ENTITY_DEFINITIONS: 'EntityDefinitions',
    SYSTEMUSER: 'systemuser',
    SYSTEMUSERS: 'systemusers'
};

/**
 * HTTP request headers commonly used with Dataverse Web API.
 * @type {Object.<string, Object.<string, string>>}
 */
export const WEB_API_HEADERS = {
    /** Standard OData headers for all Dataverse requests */
    STANDARD: {
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=utf-8'
    },
    /** Header for including formatted values in responses */
    FORMATTED_VALUES: {
        'Prefer': 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
    },
    /** Header name for impersonation */
    IMPERSONATION_HEADER: 'MSCRMCallerID'
};

/**
 * Error detection strings for metadata and permission errors.
 * @type {Object.<string, string[]>}
 */
export const ERROR_INDICATORS = {
    FORBIDDEN: ['Status 403', 'prvReadEntity'],
    UNAUTHORIZED: ['Status 401', 'Unauthorized'],
    NOT_FOUND: ['Status 404', 'Not Found']
};

/**
 * Cache key prefixes for different data types.
 * Ensures cache keys are unique and organized.
 * @type {Object.<string, string>}
 */
export const CACHE_KEY_PREFIXES = {
    ATTRIBUTES: 'attrs_',
    ENTITY_DEFINITIONS: 'entityDefinitions',
    USER_CONTEXT: 'userContext'
};
