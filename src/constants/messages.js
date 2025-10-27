/**
 * User-facing messages organized by component/feature area.
 * @module constants/messages
 */

/**
 * Common messages shared across multiple components.
 */
export const COMMON = {
    selectTableFirst: 'Please select a table first.'
};

/**
 * Environment Variables tab messages.
 */
export const ENV_VARS = {
    saved: 'Environment variable value saved.',
    deleted: 'Environment variable value deleted.',
    created: 'Environment variable value created.',
    defaultUpdated: 'Default value updated.',
    saveFailed: (error) => `Failed to save environment variable value: ${error}`,
    deleteFailed: (error) => `Failed to delete environment variable value: ${error}`,
    createFailed: (error) => `Failed to create environment variable value: ${error}`,
    invalidValue: (type, error) => `Invalid ${type} value: ${error}`,
    selectSolution: 'Please select a solution first.',
    loadFailed: (error) => `Could not retrieve environment variables: ${error}`,
    noVariablesFound: 'No environment variables found in this environment.'
};

/**
 * Automation/Business Rules tab messages.
 */
export const AUTOMATION = {
    ruleDeleted: 'Business rule deleted.',
    ruleActivated: 'Business rule activated.',
    ruleDeactivated: 'Business rule deactivated.',
    systemLocked: 'System is locked by a solution import. Please try again later.',
    actionFailed: (message) => `Action failed: ${message}`,
    deleteFailed: (error) => `Failed to delete business rule: ${error}`,
    activateFailed: (error) => `Failed to activate business rule: ${error}`,
    deactivateFailed: (error) => `Failed to deactivate business rule: ${error}`,
    noRulesFound: 'No business rules found for this table.',
    parseRuleLogicFailed: (message) => `Unable to parse rule logic. ${message}`,
    noClientLogic: 'This rule has no client logic payload.',
    refreshingRules: (entity) => `Refreshing rules for ${entity}...`,
    refreshFailed: (error) => `Error refreshing business rules: ${error}`,
    loadingRules: (entity) => `Loading rules for ${entity}...`,
    loadingHandlers: (entity) => `Loading form handlers for ${entity}...`,
    loadAutomationsFailed: (error) => `Error loading automations: ${error}`,
    noFormDefinition: 'Could not retrieve form definition or no main form found.'
};

/**
 * FetchXML Tester tab messages.
 */
export const FETCHXML = {
    generated: 'FetchXML generated successfully.',
    cannotBeEmpty: 'Table name cannot be empty.',
    noEntityName: 'Could not determine entity name from selection.',
    formatFailed: (error) => `Failed to format FetchXML: ${error}`
};

/**
 * Web API Explorer tab messages.
 */
export const WEB_API = {
    requestSuccess: 'Request executed successfully.',
    invalidJson: 'Invalid JSON in request body.',
    buildUrlFailed: (error) => `Failed to build API URL: ${error}`,
    enterValidTable: 'Please enter a valid table name.'
};

/**
 * Data Service messages.
 */
export const DATA_SERVICE = {
    metadataFailed: (error) => `Failed to retrieve metadata: ${error}`,
    lackPermissions: 'You lack sufficient permissions to perform impersonation.',
    impersonationStarted: 'Impersonation started.',
    impersonationEnded: 'Impersonation ended.',
    fetchFailed: (key) => `DataService fetch failed for key '${key}'.`,
    limitedMetadata: 'Impersonated user lacks metadata read permissions. Metadata Browser will be limited.'
};

/**
 * UI Manager messages.
 */
export const UI_MANAGER = {
    cacheCleared: 'Cache cleared successfully.',
    renderFailed: (component) => `Failed to render ${component}:`,
    godModeSuccess: (unlocked, required) => `God Mode: ${unlocked} fields unlocked, ${required} required fields updated.`,
    cannotResetNew: 'Cannot reset a new (unsaved) record form.',
    formReset: 'Form reset successfully.',
    resetFailed: (error) => `Error resetting form: ${error}`
};

/**
 * UI component messages (BusyIndicator, ResultPanel).
 */
export const UI = {
    loading: 'Executing…',
    resultLoading: 'Result (loading…)',
    pleaseWait: 'Loading, please wait…',
    execute: 'Execute',
    noRecords: 'No records returned.',
    hideSystemTooltip: 'Hides system-generated fields (e.g., @odata.*, metadata) from results.'
};

/**
 * Form Columns tab messages.
 */
export const FORM_COLUMNS = {
    updated: 'Field updated successfully.',
    updateFailed: (error) => `Update failed: ${error}`,
    noColumns: 'No columns to display for this form.',
    lookupEmpty: 'Lookup value is empty.',
    loading: (viewMode) => `Loading columns for '${viewMode}' view...`,
    loadFailed: (error) => `Could not load form columns: ${error}`
};

/**
 * Inspector tab messages.
 */
export const INSPECTOR = {
    fieldUpdated: 'Field updated successfully.',
    updateFailed: 'Failed to update field.',
    hierarchyLoadFailed: 'Could not load form hierarchy. This tool is designed for standard record forms.',
    loadFailed: (error) => `Error loading form hierarchy: ${error}`,
    copied: (preview) => `Copied: ${preview}`
};

/**
 * Settings tab messages.
 */
export const SETTINGS = {
    importSuccess: 'Settings imported successfully.',
    importFailed: (error) => `Error importing settings: ${error}`,
    exportSuccess: 'Settings exported successfully.',
    exportFailed: (error) => `Error exporting settings: ${error}`,
    invalidSettings: 'Import failed: File does not contain valid settings.',
    resetSuccess: 'Settings reset to defaults.'
};

/**
 * Helpers utility messages.
 */
export const HELPERS = {
    copyFailed: 'Copy to clipboard failed:'
};

/**
 * Plugin Context tab messages.
 */
export const PLUGIN_CONTEXT = {
    generateFailed: (error) => `Failed to generate plugin context: ${error}`,
    emptyTargetCreate: 'Target should include initial values for create.',
    emptyTargetUpdate: 'Target is empty. Change at least one field to populate Update.Target.',
    emptyTargetDelete: 'Target is an EntityReference (see "InputParameters[\'Target\']").',
    emptyPreImageCreate: 'Pre-Image is not applicable for Create.',
    emptyPreImageUpdate: 'Pre-Image appears when at least one field is dirty (simulated).',
    emptyPreImageDeletePre: 'Pre-Image should show the entity being deleted; if empty, the form had no readable fields.',
    emptyPreImageDeleteOther: 'Pre-Image is not available in this stage.',
    validationNoId: (message) => `${message} message requires an existing record ID. Please open an existing record.`,
    postImageNote: 'Note: Post-Image is simplified (current form data). In reality, it reflects server-side calculations, workflows, and system fields.',
    exportSuccess: 'Plugin context exported successfully',
    exportWebApiLoading: 'Loading...',
    exportWebApiError: 'Failed to convert context to Web API format',
    serializeFailed: (error) => `Could not serialize context: ${error}`,
    noTargetEntity: 'No target entity found in context.',
    exportWebApiFailed: (error) => `Could not export Web API JSON: ${error}`,
    noEntityId: 'No entity ID found for delete operation.',
    exportCSharpFailed: (error) => `Could not export C# code: ${error}`
};

/**
 * Plugin Trace Log tab messages.
 */
export const PLUGIN_TRACE = {
    loading: 'Loading...',
    loadFailed: 'Error loading traces. The Tracing service might be disabled.',
    noTracesFound: 'No plugin trace logs found for the current filter criteria.',
    correlationCopied: 'Correlation ID Copied!'
};

/**
 * Metadata Browser tab messages.
 */
export const METADATA_BROWSER = {
    loadingTables: 'Loading tables...',
    selectTable: 'Select a table to view its columns.',
    loadTablesFailed: (error) => `Could not load tables: ${error}`,
    loadingColumns: 'Loading columns...',
    loadColumnsFailed: (error) => `Could not load columns: ${error}`
};

/**
 * User Context tab messages.
 */
export const USER_CONTEXT = {
    loading: 'Loading user context...',
    loadFailed: (error) => `Could not retrieve user context: ${error}`,
    noRoles: 'No roles found.'
};

/**
 * Performance tab messages.
 */
export const PERFORMANCE = {
    loading: 'Loading performance metrics...',
    loadFailed: (error) => `Could not retrieve performance metrics: ${error}`
};

/**
 * Impersonate tab messages.
 */
export const IMPERSONATE = {
    searching: 'Searching...',
    searchFailed: (error) => `Error searching for users: ${error}`,
    noUsersFound: 'No active users found matching your search.'
};

/**
 * Event Monitor tab messages.
 */
export const EVENT_MONITOR = {
    monitoring: 'Monitoring form events...',
    cleared: 'Event log cleared.'
};
