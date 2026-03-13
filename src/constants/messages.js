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
    noVariablesFound: 'No environment variables found in this environment.',
    selectSolutionBeforeCreate: 'Please select a solution before creating an environment variable.',
    selectSolutionButton: 'Select solution…',
    changeSolutionButton: 'Change solution…',
    noSolutionSelected: 'No current solution selected. The variable will be created but not added to a solution.',
    solutionSelected: (uniqueName, publisherPrefix) => `Will be added to solution: <strong>${uniqueName}</strong> (prefix: ${publisherPrefix || 'n/a'})`,
    solutionWarning: (message) => `<strong>⚠ ${message}</strong>`,
    solutionSuccess: '✓'
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
    noFormDefinition: 'Could not retrieve form definition or no main form found.',
    noHandlersFound: 'No event handlers found on this form.',
    noHandlersHelpInfo: 'If your handlers are configured but not appearing: Ensure <strong>Async onLoad/onSave handler</strong> features are enabled in <strong>App Settings → Features</strong>.',
    openInEditor: 'Open in Editor',
    openEditorFailed: 'Unable to open business rule editor.',
    editWebResource: 'Edit Web Resource',
    webResourceSaved: 'Web resource saved successfully.',
    webResourceSaveFailed: (error) => `Failed to save web resource: ${error}`,
    webResourceLoadFailed: (error) => `Failed to load web resource: ${error}`,
    webResourceNotFound: 'Web resource not found.',

    webResourceReadOnly: 'Read-only — this web resource is managed or not customizable.',
    webResourcePublished: 'Web resource published successfully.',
    webResourcePublishFailed: (error) => `Failed to publish web resource: ${error}`,
    publishAndSave: 'Save & Publish',
    saveOnly: 'Save',
    loadingWebResource: 'Loading web resource...',
    uploadFile: 'Upload File',
    uploadFileHint: 'Drag & drop a file here, or click to browse',
    uploadFileAccept: '.js,.ts,.html,.htm,.css,.xml,.json,.txt',
    fileLoaded: (name) => `File "${name}" loaded into editor.`,
    fileReadFailed: (error) => `Failed to read file: ${error}`,
    orSeparator: 'or'
};

/**
 * FetchXML Tester tab messages.
 */
export const FETCHXML = {
    generated: 'FetchXML generated successfully.',
    generating: 'Generating...',
    cannotBeEmpty: 'Table name cannot be empty.',
    noEntityName: 'Could not determine entity name from selection.',
    formatFailed: (error) => `Failed to format FetchXML: ${error}`,
    enterLinkToTableName: 'Please enter a "Link to Table" name for this join before browsing its columns',
    enterLinkEntityTableName: 'Please enter the link-entity table name first.',
    countFailed: (error) => `Failed to get count: ${error}`,
    countNotAvailable: 'Count not available in response.',
    selectJoinParent: 'Please select which table to join from (parent).',
    parentJoinRequiresTableName: 'Parent join must have a table name.',
    nestedJoinInfo: 'Nested joins allow you to chain relationships (e.g., Account → Contact → Lead).',
    cannotRemoveJoin: (count) => `Cannot remove this join - ${count} nested join(s) depend on it.`,
    paginationWarning: (count) => `Showing ${count} records. More data is available (5000 record limit per page).`,
    allRecordsLoaded: (count) => `All records loaded (${count} total).`,
    loadingAllRecords: (count, pages) => `Loaded ${count} records (${pages} page${pages > 1 ? 's' : ''})...`,
    loadAllSuccess: (count, pages) => `Loaded all ${count} records (${pages} page${pages > 0 ? 's' : ''}).`,
    bannerTitle: '⚠️ More Records Available',
    bannerLoadingTitle: '⏳ Loading All Records...',
    resolveEntityFailed: (error) => `Could not resolve entity name: ${error}`,
    // Touch operations
    touchProgress: (current, total) => `Touching records... (${current}/${total})`,
    touchSuccess: (count) => `Successfully touched ${count} record${count !== 1 ? 's' : ''}.`,
    touchFailed: (success, failed, total) => `Touched ${success}/${total} records. ${failed} failed.`,
    touchCancelled: 'Touch operation cancelled.',
    touchReloadSuccess: (count) => `Successfully touched ${count} record${count !== 1 ? 's' : ''}. Re-executing query to show updated data.`,
    noRecordsSelected: 'No records selected. Please select at least one record.',
    // Aggregate queries
    addAggregate: 'Add Aggregate',
    addGroupBy: 'Add Group By',
    addSection: 'Add...',
    addFilter: 'Filter',
    addJoin: 'Join',
    addAggregateMenu: 'Aggregate',
    addGroupByMenu: 'Group By',
    removeAggregate: 'Remove',
    removeGroupBy: 'Remove',
    aggregateColumnPlaceholder: 'e.g., revenue',
    aggregateAliasPlaceholder: 'e.g., TotalRevenue',
    groupByColumnPlaceholder: 'e.g., address1_city',
    groupByAliasPlaceholder: 'e.g., City',
    aggregateColumnRequired: 'Please enter a column name for all aggregate rows.',
    aggregateAliasRequired: 'Please enter an alias for all aggregate rows.',
    groupByAliasRequired: 'Please enter an alias for all group by rows.',
    groupByRequiresAggregate: 'Please add at least one aggregate column before adding a Group By.',
    removeSection: 'Remove Section',
    aggregateSectionTitle: 'Aggregate Columns',
    groupBySectionTitle: 'Group By Columns',
    // Converter
    convertTo: 'Convert',
    convertPlaceholder: 'Converted output will appear here. Select a format above.',
    convertCopied: 'Converted code copied to clipboard.',
    convertNoXml: 'Please enter or generate FetchXML first.',
    convertFailed: (error) => `Conversion failed: ${error}`,
    convertFormatCSharp: 'C# QueryExpression',
    convertFormatJavaScript: 'JavaScript Xrm',
    convertFormatOData: 'OData',
    convertFormatSQL: 'SQL',
    convertFormatPowerAutomate: 'Power Automate',
    convertFormatWebApiUrl: 'Web API URL'
};

/**
 * Web API Explorer tab messages.
 */
export const WEB_API = {
    requestSuccess: 'Request executed successfully.',
    invalidJson: 'Invalid JSON in request body.',
    buildUrlFailed: (error) => `Failed to build API URL: ${error}`,
    enterValidTable: 'Please enter a valid table name.',
    countFailed: (error) => `Failed to get count: ${error}`,
    countNotAvailable: 'Count not available in response. The query may need adjustment.',
    executing: 'Executing…',
    counting: 'Counting...',
    countingProgress: (count) => `Counting... (${count})`,
    countLimitWarning: (count) => `⚠️ Count stopped at ${count} records (100 page limit). Actual count may be higher.`,
    countSuccess: (count, pages) => `Found ${count} records across ${pages} page${pages > 1 ? 's' : ''}.`,
    paginationWarning: (count) => `Showing ${count} records. More data is available (5000 record limit per page).`,
    allRecordsLoaded: (count) => `All records loaded (${count} total).`,
    loadingAllRecords: (count, pages) => `Loaded ${count} records (${pages} page${pages > 1 ? 's' : ''})...`,
    loadAllSuccess: (count, pages) => `Loaded all ${count} records (${pages} page${pages > 0 ? 's' : ''}).`,
    bannerTitle: '⚠️ More Records Available',
    bannerLoadingTitle: '⏳ Loading All Records...',
    findingRecords: 'Finding matching records...',
    // Field builder errors
    noFieldsProvided: 'No fields provided. Add at least one field or switch to JSON mode.',
    noPrimaryKeyFound: 'No primary key found',
    noSuitableField: 'No suitable field to update',
    // Required fields
    requiredFieldsPopulated: (count) => `Added ${count} required field${count !== 1 ? 's' : ''} to request body.`,
    requiredFieldsLoadFailed: (error) => `Failed to load required fields: ${error}`,
    reloadRecordsFailed: (error) => `Failed to reload records: ${error}`,
    noRequiredFields: 'This table has no required fields for create operations.',
    // Bulk operations
    bulkUpdateConfirm: (count) => `Update ${count} record${count !== 1 ? 's' : ''} matching the filter conditions?`,
    bulkDeleteConfirm: (count) => `Delete ${count} record${count !== 1 ? 's' : ''} matching the filter conditions? This action cannot be undone.`,
    bulkTouchConfirm: (count) => `Touch (update without changes) ${count} selected record${count !== 1 ? 's' : ''}?`,
    confirmBulkUpdate: 'Confirm Bulk Update',
    confirmBulkDelete: 'Confirm Bulk Delete',
    confirmDelete: 'Confirm Delete',
    deleteRecordConfirm: (id, entitySet) => `<p>Delete record <code>${id}</code> from <strong>${entitySet}</strong>?</p><p class="pdt-text-error">This action cannot be undone.</p>`,
    bulkUpdateProgress: (current, total) => `Updating records... (${current}/${total})`,
    bulkDeleteProgress: (current, total) => `Deleting records... (${current}/${total})`,
    bulkTouchProgress: (current, total) => `Touching records... (${current}/${total})`,
    bulkUpdateSuccess: (count) => `Successfully updated ${count} record${count !== 1 ? 's' : ''}.`,
    bulkDeleteSuccess: (count) => `Successfully deleted ${count} record${count !== 1 ? 's' : ''}.`,
    bulkTouchSuccess: (count) => `Successfully touched ${count} record${count !== 1 ? 's' : ''}.`,
    bulkTouchReloadSuccess: (count) => `Successfully touched ${count} record${count !== 1 ? 's' : ''}. Reloaded with updated values.`,
    reloadingRecords: 'Reloading records...',
    bulkUpdateFailed: (success, failed, total) => `Updated ${success}/${total} records. ${failed} failed.`,
    bulkDeleteFailed: (success, failed, total) => `Deleted ${success}/${total} records. ${failed} failed.`,
    bulkTouchFailed: (success, failed, total) => `Touched ${success}/${total} records. ${failed} failed.`,
    bulkOperationCancelled: 'Bulk operation cancelled.',
    noRecordsSelected: 'No records selected. Please select at least one record.',
    noRecordsMatched: 'No records match the filter conditions.',
    bulkModeInfo: 'Add filter conditions to update/delete multiple records at once.',
    bulkUpdateInfo: 'Add filter conditions to update multiple records at once.',
    bulkDeleteInfo: 'Add filter conditions to delete multiple records at once.',
    idOrConditionsRequired: 'Either provide a Record ID or add filter conditions for bulk operation.',
    openRecord: 'Open',
    openRecordTitle: 'Open record in Dynamics 365',
    // Touch dialog
    touchDialogTitle: 'Configure Bulk Touch Operation',
    touchDialogInstructions: 'Select which fields to update. This will trigger <strong>modifiedon/modifiedby</strong> updates and any associated plugins or workflows.',
    touchDialogTip: (primaryNameAttr) => `<strong>Tip:</strong> Default field is <code>${primaryNameAttr}</code> (Primary Name Attribute)`,
    touchDialogColumnLabel: 'Column Name:',
    touchDialogValueModeLabel: 'Value Mode:',
    touchDialogKeepValue: 'Keep current value',
    touchDialogSetValue: 'Set custom value:',
    touchDialogPlaceholder: 'e.g., name, description',
    touchDialogCustomPlaceholder: 'Enter custom value',
    touchDialogFieldLabel: (index) => `Field ${index}`,
    touchDialogRemoveButton: 'Remove',
    touchDialogAddButton: '+ Add Field',
    touchDialogConfirmButton: 'Confirm & Touch Records',
    touchDialogCancelButton: 'Cancel',
    touchDialogBrowseTitle: 'Browse columns',
    touchDialogBrowseFailed: 'Failed to browse columns',
    touchFieldNameRequired: 'Please enter a field name for all fields or remove empty ones',
    touchCustomValueRequired: 'Please enter a custom value or select "Keep current value"',
    touchNoFieldsConfigured: 'Please add at least one field',
    // Required fields auto-populate
    loadingRequiredFields: 'Loading required fields...',
    noRequiredFields: 'No required fields found for this table.',
    requiredFieldsPopulated: (count) => `Populated ${count} required field${count !== 1 ? 's' : ''}.`,
    // Body mode labels
    jsonModeLabel: 'JSON Mode',
    fieldBuilderLabel: 'Field Builder'
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
    godModeSuccess: (unlocked, required, shown) => `God Mode: ${unlocked} fields unlocked, ${required} required fields cleared, ${shown} hidden fields shown.`,
    cannotResetNew: 'Cannot reset a new (unsaved) record form.',
    formReset: 'Form reset successfully.',
    resetFailed: (error) => `Error resetting form: ${error}`,
    logicalNamesShown: (tabs, sections, controls) => `Showing logical names: ${tabs} tabs, ${sections} sections, ${controls} controls.`,
    logicalNamesHidden: 'Logical names removed from form.',
    logicalNamesAlreadyHidden: 'No logical names to remove.',
    logicalNameCopied: (name) => `Copied: ${name}`
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
    openRecord: 'Open',
    openRecordTitle: 'Open record in Dynamics 365',
    noSearchResults: 'No results match your search.',
    hideSystemTooltip: 'Hides system-generated fields (e.g., @odata.*, metadata) from results.',
    resultHint: 'Select records to touch or export. Click Open to view a record in Dynamics 365.'
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
    loadFailed: (error) => `Could not load form columns: ${error}`,
    noFormColumns: 'No form columns matched your search.',
    noRecordColumns: 'No record columns were returned by the API.',
    noColumnsPrefix: 'No columns to display.'
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
    resetSuccess: 'Settings reset to defaults.',
    headerButtonsTitle: 'Header Buttons Configuration',
    headerButtonsDescription: 'Drag to reorder header buttons. Use the toggle to show or hide them.',
    headerButtonFormOnly: '(Form only)',
    tabFormOnly: '(Form only)'
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
    noRoles: 'No roles found.',
    noTeams: 'No team memberships found.'
};

/**
 * Performance tab messages.
 */
export const PERFORMANCE = {
    loading: 'Loading performance metrics...',
    loadFailed: (error) => `Could not retrieve performance metrics: ${error}`,
    noIssues: 'No significant issues detected for this form.'
};

/**
 * Impersonate tab messages.
 */
export const IMPERSONATE = {
    searchPlaceholder: 'Search for a user by ID, name, or email...',
    searching: 'Searching...',
    searchFailed: (error) => `Error searching for users: ${error}`,
    noUsersFound: 'No active users found matching your search.',
    // Sub-tab labels
    userImpersonationTab: 'User Impersonation',
    securityAnalysisTab: 'Security Analysis',
    impersonationDescription: 'Select a user to execute all subsequent Web API requests from within this tool (e.g., in the Metadata Browser, WebAPI Explorer, FetchXML Tester and User Context) on their behalf.',
    // Security Analysis messages
    securityAnalysisTitle: 'Security Analysis',
    analyzeButton: 'Analyze Security',
    analyzing: 'Analyzing...',
    analyzeFailed: (error) => `Failed to analyze security: ${error}`,
    openAdminCenter: 'Open Admin Center',
    openEntra: 'Open Microsoft Entra',
    // Role comparison
    roleComparisonTitle: 'Role Comparison',
    yourRoles: 'Your Roles',
    userRoles: 'User Roles',
    commonRoles: 'Roles In Common',
    yourOnlyRoles: 'Roles Only You Have',
    userOnlyRoles: 'Roles Only User Has',
    noRolesFound: 'No roles found.',
    inheritedFromTeam: '(via team)',
    // Entity privileges
    entityPrivilegesTitle: 'Entity Privileges',
    privilegeRead: 'Read',
    privilegeCreate: 'Create',
    privilegeWrite: 'Write',
    privilegeDelete: 'Delete',
    privilegeAppend: 'Append',
    privilegeAppendTo: 'Append To',
    privilegeAssign: 'Assign',
    privilegeShare: 'Share',
    privilegeAllowed: 'Allowed',
    privilegeNotAllowed: 'Not Allowed',
    privilegeGrantedBy: 'Granted by:',
    privilegeMultipleRoles: (count) => `+${count} more`,
    noEntityContext: 'Open a record form to see entity-specific privileges.',
    // Field security
    fieldSecurityTitle: 'Field Security',
    fieldSecurityProfiles: 'Field Security Profiles',
    securedColumnsTitle: 'Secured Columns',
    columnName: 'Column',
    canRead: 'Read',
    canCreate: 'Create',
    canUpdate: 'Update',
    noFieldSecurityProfiles: 'User has no field security profiles.',
    noSecuredColumns: 'No secured columns for this entity.',
    // Teams
    teamsTitle: 'Team Memberships',
    noTeams: 'User is not a member of any teams.',
    // Team Comparison
    teamComparisonTitle: 'Team Membership Comparison',
    teamMembershipsInCommon: 'Team Memberships In Common',
    teamMembershipsOnlyYou: 'Team Memberships Only You Have',
    teamMembershipsOnlyUser: (userName) => `Team Memberships Only ${userName} Has`,
    noCommonTeams: 'No common team memberships.',
    noUniqueTeams: 'None.',
    // Status
    selectUserFirst: 'Select a user from User Impersonation to analyze their security settings.',
    loadingAnalysis: 'Loading security analysis...',
    // Live Impersonation
    liveImpersonationButton: 'Live Mode',
    stopLiveButton: 'Stop Live Mode',
    // Command Bar Comparison
    commandBarComparisonTitle: 'Command Bar Visibility',
    compareCommandsButton: 'Compare Commands',
    comparingCommands: 'Analyzing...',
    commandComparisonFailed: (error) => `Failed to analyze command bar: ${error}`,
    noCommandDifferences: 'No command visibility differences found based on security privileges.',
    commandDifferencesSummary: (total, different) => `Analyzed ${total} commands with privilege-based rules. Found ${different} difference${different !== 1 ? 's' : ''}.`,
    onlyYouCanSee: 'Only You Can See',
    onlyUserCanSee: 'Only User Can See',
    bothCanSee: 'Both Can See',
    commandContext: 'Context',
    commandEntity: 'Entity',
    commandSolution: 'Solution',
    commandBlockedBy: 'Blocked by',
    commandVisibleTo: 'Visible to',
    commandName: 'Command',
    commandIdCopied: 'Command ID copied to clipboard',
    commandFormContext: 'Form',
    commandGridContext: 'Grid',
    commandGlobalContext: 'All Entities',
    commandRulesAnalyzed: 'rules analyzed',
    hiddenByCustomization: 'Hidden by customization',
    commandComparisonNote: 'This analysis compares command visibility based on entity privileges (Create, Read, Write, Delete, Assign, Share), security roles, and team memberships.',
    selectEntityForCommands: 'Open a form or grid to compare entity-specific commands.',
    compareWith: 'Compare with:',
    compareWithCurrentUser: 'You (Current User)',
    compareWithAnotherUser: 'Another User...',
    selectComparisonUser: 'Select user to compare with',
    comparisonUserSelected: (userName) => `Comparing with: ${userName}`
};

/**
 * Live Impersonation mode messages.
 */
export const LIVE_IMPERSONATION = {
    noUserSelected: 'Please select a user to impersonate first.',
    startFailed: (error) => `Failed to start live impersonation: ${error}`,
    started: (userName) => `Live impersonation started for ${userName}. Navigate around to see differences.`,
    stopped: 'Live impersonation stopped.',
    // Panel UI
    panelTitle: 'Live Impersonation Monitor',
    viewingAs: 'Viewing as',
    minimize: 'Minimize',
    expand: 'Expand',
    stop: 'Stop',
    stopButton: 'Stop live impersonation',
    // Summary stats
    differences: 'Differences',
    accessDenied: 'Access Denied',
    hiddenRecords: 'Hidden Records',
    hiddenFields: 'Hidden Fields',
    // Actions
    clearResults: 'Clear',
    copyReport: 'Copy Report',
    reportCopied: 'Impersonation report copied to clipboard.',
    // Status
    waitingForActivity: 'Navigate around the app to detect differences...',
    noDifferencesYet: 'No differences detected yet. Keep navigating...',
    noAccess: 'Access Denied',
    recordsHidden: 'records hidden from user',
    fieldsHidden: 'Fields hidden',
    unknownDifference: 'Unknown difference detected',
    // Tooltips
    liveButtonTitle: 'Start live impersonation mode - intercepts all API calls to show real-time differences',
    liveButtonActiveTitle: 'Live impersonation is active. Click to stop.'
};

/**
 * Event Monitor tab messages.
 */
export const EVENT_MONITOR = {
    monitoring: 'Monitoring form events...',
    cleared: 'Event log cleared.'
};

/**
 * Power Automate Flows tab messages.
 */
export const POWER_AUTOMATE_FLOWS = {
    loading: 'Loading cloud flows...',
    loadFailed: (error) => `Failed to load cloud flows: ${error}`,
    noFlowsFound: 'No cloud flows found in this solution.',
    flowActivated: 'Flow turned on successfully.',
    flowDeactivated: 'Flow turned off successfully.',
    flowDeleted: 'Flow deleted successfully.',
    flowSaved: 'Flow definition saved successfully.',
    flowSaveFailed: (error) => `Failed to save flow definition: ${error}`,
    activateFailed: (error) => `Failed to turn on flow: ${error}`,
    deactivateFailed: (error) => `Failed to turn off flow: ${error}`,
    deleteFailed: (error) => `Failed to delete flow: ${error}`,
    deleteConfirm: (name) => `<p>Delete flow <strong>${name}</strong>?</p><p class="pdt-text-error">This action cannot be undone.</p>`,
    deleteConfirmTitle: 'Confirm Delete Flow',
    managedFlowWarning: 'This flow is managed and cannot be modified.',
    managedEditWarning: '⚠️ This is a managed flow. Changes will create an unmanaged solution layer.',
    expandAll: 'Expand All',
    collapseAll: 'Collapse All',
    statusOn: 'On',
    statusOff: 'Off',
    statusSuspended: 'Suspended',
    statusDraft: 'Draft',
    typeAutomated: 'Automated',
    typeInstant: 'Instant',
    typeScheduled: 'Scheduled',
    openInPortal: 'Open in Power Automate',
    viewDefinition: 'View/Edit Definition',
    turnOn: 'Turn On',
    turnOff: 'Turn Off',
    flowDefinitionTitle: (name) => `Flow Definition: ${name}`,
    tabJson: 'JSON',
    tabVisual: 'Visual',
    triggerLabel: 'Trigger',
    actionLabel: 'Action',
    conditionLabel: 'Condition',
    scopeLabel: 'Scope',
    foreachLabel: 'For Each',
    switchLabel: 'Switch',
    doUntilLabel: 'Do Until',
    composeLabel: 'Compose',
    httpLabel: 'HTTP Request',
    responseLabel: 'Response',
    terminateLabel: 'Terminate',
    waitLabel: 'Delay',
    initVarLabel: 'Initialize Variable',
    setVarLabel: 'Set Variable',
    incrementVarLabel: 'Increment Variable',
    appendStringLabel: 'Append to String',
    appendArrayLabel: 'Append to Array',
    parseJsonLabel: 'Parse JSON',
    connectorLabel: 'Connector',
    scopeActionsCount: (count) => `${count} action${count !== 1 ? 's' : ''}`,
    branchesCount: (count) => `${count} branch${count !== 1 ? 'es' : ''}`,
    caseLabel: 'Case',
    defaultCaseLabel: 'Default',
    parallelBranch: 'Parallel Branch',
    runAfterLabel: 'Run after',
    noDefinition: 'No flow definition available.',
    refreshFlows: 'Refresh',
    selectSolution: 'Select a solution to view its flows.',
    loadingSolutions: 'Loading solutions...',
    loadSolutionsFailed: (error) => `Failed to load solutions: ${error}`,
    noSolutions: 'No solutions with cloud flows found.',
    deleteFlow: 'Delete',
    editDefinition: 'Edit JSON',
    saveDefinition: 'Save',
    undoChanges: 'Undo',
    cancelEdit: 'Cancel',
    invalidJson: 'Invalid JSON. Please fix syntax errors before saving.',
    unmanagedLabel: 'Unmanaged',
    managedLabel: 'Managed',
    nodeInputsLabel: 'Inputs',
    nodeNoInputs: 'No editable inputs',
    clickToEdit: 'Click to edit'
};

/**
 * Solution Layers tab messages.
 */
export const SOLUTION_LAYERS = {
    selectSolution: 'Select a solution to view its components.',
    noSolutions: 'No solutions found.',
    noComponents: 'No components found matching the current filters.',
    noActiveCustomizations: 'No active customizations found in this solution.',
    layerDeleted: 'Active customization removed successfully.',
    loadSolutionsFailed: (error) => `Failed to load solutions: ${error}`,
    loadComponentsFailed: (error) => `Failed to load solution components: ${error}`,
    deleteLayerFailed: (error) => `Failed to remove active customization: ${error}`,
    deleteLayerSuccess: 'Layer deleted successfully.',
    loadingComponents: 'Loading solution components...'
};


