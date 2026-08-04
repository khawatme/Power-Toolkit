/**
 * User-facing messages organized by component/feature area.
 * @module constants/messages
 */

/**
 * Common messages shared across multiple components.
 */
export const COMMON = {
    selectTableFirst: 'Please select a table first.',
    selectSolutionDropdown: '--- Select a Solution ---'
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
    formsScanned: (count, kinds) => `Scanned ${count} form${count === 1 ? '' : 's'} (${kinds}).`,
    handlerOnForms: (names) => `On ${names.length} forms: ${names.join(', ')}`,
    librariesTitle: 'Form Libraries',
    noLibraries: 'No script libraries are registered on these forms.',
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
    joinNotReachable: 'A join does not chain back to the primary table, so it would be left out. Check the "Join From" selections.',
    tooManyJoins: (max, count) => `A query can use at most ${max} joins, but this one has ${count}. Remove some joins or split the query.`,
    linkTypeReturnsNoColumns: (linkType) => `The "${linkType}" link type filters rows without returning columns, so the columns on that join were left out of the query.`,
    linkColumnsNotSupported: 'The "exists" and "in" link types cannot return columns. Remove the columns from that join, or switch it to "inner" or "matchfirstrowusingcrossapply".',
    linkTypeNeedsColumns: (linkType) => `The "${linkType}" link type returns columns without a table prefix, so it cannot return all columns. List the columns you need on that join.`,
    aliasClash: 'Two columns resolve to the same name in the results. This happens when a "matchfirstrowusingcrossapply" join returns all columns, because its column names carry no table prefix — list only the columns you need on that join.',
    linkLimitExceeded: (max) => `A query can use at most ${max} joins. Remove some link-entity elements or split the query.`,
    invalidTopCount: 'Top Count must be a whole number greater than 0.',
    invalidAggregateLimit: (max) => `Aggregate Limit must be a whole number between 1 and ${max.toLocaleString()}.`,
    aggregateLimitExceeded: (max) => `Query evaluated more than ${max.toLocaleString()} rows, which is the Dataverse aggregate limit. Add filters to narrow it, or set an Aggregate Limit to cap the rows evaluated.`,
    aggregateLimitPlaceholder: (max) => `Optional — cap rows evaluated (max ${max.toLocaleString()})`,
    aggregateLimitLabel: 'Aggregate Limit',
    aggregateTypeMismatch: 'This aggregate returns a whole number, but the column is a different type, so Dataverse rejects it. Count a different column — the primary key works for a row count — or use min/max/sum/avg on this one.',
    orderAliasNotFound: (value) => `Order "${value}" is not one of the aggregate or group-by aliases, so it was left out. Use an alias from the rows above.`,
    distinctCountTitle: 'Count unique values only. Applies to countcolumn.',
    distinctCountLabel: 'Distinct',
    intersectTitle: 'Join only, returning no columns from this table. Documents intent for many-to-many joins.',
    intersectLabel: 'Join only',
    utcTitle: 'Group dates in UTC instead of the user\'s time zone.',
    utcLabel: 'UTC',
    selectParentOption: '-- Select Parent --',
    primaryParentOption: (entity) => `${entity} (Primary)`,
    joinParentOption: (label, entity) => (entity ? `${label} (${entity})` : label),
    joinFallbackLabel: (number) => `Join #${number}`,
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
    tooManyConditions: (max, count) => `A query can use at most ${max} conditions, but this one has ${count}. Reduce the number of filter conditions.`,
    bulkFilterIncomplete: 'The filter is incomplete, so this would match every record in the table. Fill in a value for each condition before running a bulk operation.',
    bulkPartialMatch: 'More records match than one page can return, so only the records listed above will be affected. Run the operation again afterwards to continue.',
    invalidJson: 'Invalid JSON in request body.',
    fileUploadFailed: (fileName, error) => `Could not upload "${fileName}": ${error}`,
    fileUploadPartial: (failed, total) => `${failed} of ${total} files could not be uploaded. The record was saved.`,
    fileUploadNoRecordId: (count) => `The record was saved, but ${count === 1 ? 'the file was' : `all ${count} files were`} not uploaded because the new record's ID was not returned.`,
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
    // The warning is appended separately as emphasised text, so it is not repeated here.
    bulkDeleteConfirm: (count) => `Delete ${count} record${count !== 1 ? 's' : ''} matching the filter conditions?`,
    cannotBeUndone: 'This action cannot be undone.',
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

    // "Current record" shortcut (GET, form context only)
    currentRecordButton: 'Current record',
    currentRecordTitle: 'Fill in this form\'s table and filter to the record you are on',
    currentRecordUnavailable: 'This record has no ID yet — save it first, then try again.',
    currentRecordApplied: (table, attribute) => `Set to ${table}, filtered on ${attribute}. Any previous filter was replaced.`,
    currentRecordFailed: (error) => `Could not read the current record: ${error}`,
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
    tabFormOnly: '(Form only)',
    tabConfigurationDescription: 'Drag to reorder tabs. Use the toggle to show or hide them, and the swatch to give a tab a color you can spot at a glance.',
    tabColorTitle: (label) => `Pick a color for the ${label} tab`,
    tabColorClear: 'Remove color',
    tabColorClearTitle: (label) => `Remove the color from the ${label} tab`
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
    correlationCopied: 'Correlation ID Copied!',
    statusTitle: 'Filter by outcome',
    statusAll: 'All statuses',
    statusErrors: 'Errors only',
    statusSuccess: 'Success only',

    loggingOff: '⚠️ Trace logging is Off.',
    loggingException: 'Only plug-in executions that throw an exception are traced.',
    loggingAll: 'Every plug-in execution is traced.',

    // Logging-level control (writes organization.plugintracelogsetting)
    loggingLevelLabel: 'Logging level',
    loggingLevelTitle: 'Change the plug-in trace logging level for this environment',
    loggingLevelOff: 'Off',
    loggingLevelException: 'Exception',
    loggingLevelAll: 'All',
    loggingLevelUpdated: (level) => `Plug-in trace logging set to "${level}".`,
    loggingLevelFailed: (error) => `Could not change the logging level: ${error}`
};

/**
 * Metadata Browser tab messages.
 */
export const METADATA_BROWSER = {
    loadingTables: 'Loading tables...',
    selectTable: 'Select a table to view its columns.',
    loadTablesFailed: (error) => `Could not load tables: ${error}`,
    loadingColumns: 'Loading columns...',
    loadColumnsFailed: (error) => `Could not load columns: ${error}`,

    // Search / table UI
    searchColumns: 'Search columns...',
    searchColumnsIn: (table) => `Search columns in ${table}...`,
    tableDetailsTitle: (name) => `Table Details: ${name}`,
    columnDetailsTitle: (name) => `Column Details: ${name}`,
    viewTableDetails: 'View table details',
    viewColumnDetails: 'Click to view details',
    selectTableRowHint: 'Click to load columns',

    // Column details dialog - sections
    keyFactsTitle: 'Key Facts',
    choiceOptionsTitle: (count) => `Choice Options (${count})`,
    booleanValuesTitle: 'Boolean Values',
    lookupTargetsTitle: (count) => `Lookup Targets (${count})`,
    lookupTargetsPolymorphic: (count) => `Lookup Targets (polymorphic — ${count} tables)`,
    allPropertiesTitle: 'All Properties',
    loadingDetails: 'Loading column details...',

    // Column details dialog - key fact labels
    labelDisplayName: 'Display Name',
    labelLogicalName: 'Logical Name',
    labelDescription: 'Description',
    labelType: 'Type',
    labelRequired: 'Required',
    labelMaxLength: 'Max Length',
    labelPrecision: 'Precision',
    labelRange: 'Range',
    labelFormat: 'Format',
    labelDateBehavior: 'Date Behavior',
    optionValueHeader: 'Value',
    optionLabelHeader: 'Label',
    rangeValue: (min, max) => `${min} to ${max}`,
    clickToCopy: 'Click to copy',

    // Column details dialog - empty states (one line, one fact)
    noOptions: 'No options defined for this choice.',
    noTargets: 'No target tables returned — metadata read privileges may be limited.',
    detailsUnavailable: 'Type details unavailable — metadata read privileges may be limited.',
    filterProperties: 'Filter properties...'
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

    // Review section
    reviewTitle: 'Performance Review',
    reviewIntro: 'Checked against Microsoft\'s documented form performance guidance. Every finding links to the page it comes from.',
    reviewClean: (rules) => `No issues found — ${rules} rule${rules === 1 ? '' : 's'} checked.`,
    reviewSummary: (errors, warnings, infos) => [
        errors ? `${errors} high` : '',
        warnings ? `${warnings} medium` : '',
        infos ? `${infos} low` : ''
    ].filter(Boolean).join(' · '),
    severityLabel: { error: 'High', warn: 'Medium', info: 'Low' },
    docLink: 'Microsoft Learn',
    docLinkTitle: (id) => `Read the guidance behind "${id}" on Microsoft Learn`,

    // Toolbar
    refreshButton: 'Refresh',
    refreshButtonTitle: 'Re-read the form and run the review again',

    // Script scan
    scanButton: 'Scan form scripts',
    scanButtonTitle: 'Read this table\'s unmanaged form libraries and check them against the client-scripting best practices',
    scanning: 'Reading form libraries...',
    scanUnavailable: 'Script rules need a table context — open a record form to run them.',
    scanNoScripts: 'No unmanaged JavaScript libraries on this table\'s forms.',
    scanFailed: (error) => `Could not read the form libraries: ${error}`,
    scanned: (count) => `${count} librar${count === 1 ? 'y' : 'ies'} scanned.`,
    scanSystemSkipped: (count) => `${count} managed librar${count === 1 ? 'y' : 'ies'} skipped.`,
    scanSkipped: (names) => `Could not read ${names}.`
};

/**
 * Impersonate tab messages.
 */
export const IMPERSONATE = {
    sectionTitle: 'Impersonate & Security',
    searchPlaceholder: 'Search for a user by ID, name, or email...',
    searchButton: 'Search',
    searching: 'Searching...',
    searchFailed: (error) => `Error searching for users: ${error}`,
    searchTruncated: (limit) => `Showing the first ${limit} matches — narrow the search to see the rest.`,
    noUsersFound: 'No active users found matching your search.',
    userHasNoRoles: (userName) => `${userName} has no security roles — requests made as this user will fail with 403.`,
    columnFullName: 'Full Name',
    columnUserName: 'User Name',
    impersonateRowTitle: 'Click to impersonate this user',
    currentlyImpersonating: 'Currently impersonating:',
    clearButton: 'Clear',
    openAdminCenterTitle: 'Open Power Platform Admin Center',
    openEntraTitle: 'Open Microsoft Entra Admin Center',
    analyzeEnabledTitle: 'Analyze security settings for the impersonated user',
    selectUserToAnalyze: 'Select a user to analyze',
    selectUserShort: 'Select a user first',
    comparingWithCurrentUser: 'Comparing with current user',
    noUsersAvailable: 'No users found',
    loadUsersFailed: (error) => `Failed to load users: ${error}`,
    pickerSearchPlaceholder: 'Search users...',
    closeLabel: 'Close',
    youLabel: 'You',
    copyIdTitle: 'Click to copy ID',
    copiedId: (id) => `Copied: ${id}`,
    roleDirect: 'Direct',
    privilegeColumnHeader: 'Privilege',
    privilegeNoAccess: 'No Access',
    depthOrganization: 'Organization',
    depthDeep: 'Deep',
    depthBusinessUnit: 'Business Unit',
    depthUser: 'User',
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
    rolesOnlyUser: (userName) => `Roles Only ${userName} Has`,
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
    privilegesUnavailable: (userName) => `Privileges for ${userName} could not be read — the values below are unknown, not denied.`,
    privilegeUnknown: 'Unknown',
    // Field security
    fieldSecurityTitle: 'Field Security',
    fieldSecurityProfiles: 'Field Security Profiles',
    securedColumnsTitle: 'Secured Columns',
    columnName: 'Column',
    canRead: 'Read',
    canCreate: 'Create',
    canUpdate: 'Update',
    noFieldSecurityProfiles: 'User has no field security profiles.',
    yourFieldProfiles: 'Your Field Security Profiles',
    userFieldProfiles: (userName) => `${userName}'s Field Security Profiles`,
    columnCount: (count) => `${count} column${count !== 1 ? 's' : ''}`,
    teamBadge: 'Team',
    inheritedFromTeamTitle: 'Inherited from team',
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
    // Command Bar Comparison
    commandBarComparisonTitle: 'Command Bar Visibility',
    compareCommandsButton: 'Compare Commands',
    comparingCommands: 'Analyzing...',
    commandComparisonFailed: (error) => `Failed to analyze command bar: ${error}`,
    noCommandDifferences: 'No command visibility differences found based on security privileges.',
    commandDifferencesSummary: (total, different) => `Analyzed ${total} commands with privilege-based rules. Found ${different} difference${different !== 1 ? 's' : ''}.`,
    onlyYouCanSee: 'Only You Can See',
    onlyUserCanSee: 'Only User Can See',
    onlyUserCanSeeNamed: (userName) => `Only ${userName} Can See`,
    potentialDifferenceLabel: 'Potential difference (custom rules)',
    sameVisibilityLabel: 'Same visibility',
    undeterminedLabel: 'Cannot be determined',
    undeterminedCommandsTitle: (count) => `❔ Cannot be determined (${count})`,
    undeterminedCommandsNote: 'These commands are gated by custom JavaScript or a Power Fx formula that can only be evaluated inside the user\'s own session. Matching security roles does not make their outcome identical.',
    blockedByLabel: (userName) => `${userName} is blocked by:`,
    blockedByLabelSelf: 'You are blocked by:',
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
 * Quick Check messages — a read-only summary of what the impersonated user would see on the page
 * you are currently on. Everything renders in the toolkit's own panel; the host form is never
 * touched, so there is nothing to restore and nothing that can disturb the running app.
 */
export const QUICK_CHECK = {
    buttonLabel: 'Quick Check',
    buttonTitle: 'Summarise what the impersonated user would see on the page you are on',
    needsPage: 'Open a table form or list to run a Quick Check.',
    running: 'Checking...',
    failed: (error) => `Quick Check failed: ${error}`,

    headingForm: (entityName) => `Quick Check — ${entityName}, record on screen`,
    headingList: (entityName) => `Quick Check — ${entityName} list`,
    privilegesAllowed: (verbs) => `Can ${verbs}.`,
    privilegesDenied: (verbs) => `Cannot ${verbs}.`,
    privilegesNone: (userName) => `${userName} has no privileges on this table.`,
    tableReadOnly: (userName) => `This table is read-only for ${userName}.`,

    formSame: 'Same form as you.',
    formDiffers: (userName, formNames) => `${userName} would open a different form: ${formNames}`,
    formsAndMore: (names, count) => `${names} +${count} more`,
    formNone: (userName) => `${userName} has no main form for this table.`,

    recordFull: 'Full access to the record on screen.',
    recordNoRead: (userName) => `${userName} cannot open this record.`,
    recordNoWrite: (userName) => `${userName} can read this record but not save it.`,
    recordNotChecked: 'No saved record on screen to check.',

    columnsRestricted: (count, names) => `${count} column${count !== 1 ? 's' : ''} restricted by field security: ${names}`,
    columnsNone: 'No field security restrictions on this table.',

    appsVisible: (visible, total, names) => `${visible} of ${total} apps visible: ${names}`,
    appsVisibleUnnamed: (visible, total) => `${visible} of ${total} apps visible.`,
    appsNoneVisible: (total) => `None of the ${total} apps are visible to them.`,
    appsAndMore: (names, count) => `${names} +${count} more`,
    appsUndetermined: (count) => `${count} app${count !== 1 ? 's' : ''} have no role assignment — access undetermined.`,

    viewsHidden: (count) => `${count} role-scoped view${count !== 1 ? 's' : ''} hidden from them.`,
    viewsAllVisible: 'No views are restricted by security role here.',

    sectionUnavailable: (section) => `${section} could not be read.`,

    // Verb labels used to build the privilege summary
    verbs: {
        read: 'read',
        create: 'create',
        write: 'write',
        delete: 'delete',
        append: 'append',
        appendto: 'append to',
        assign: 'assign',
        share: 'share'
    }
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
    openInCopilotStudio: 'Open in Copilot Studio',
    viewDefinition: 'View/Edit',
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
    runAfterJoin: (count) => `joins ${count} steps`,
    runAfterRemove: (dep) => `Remove "${dep}" as a predecessor`,
    runAfterAddPlaceholder: '+ Run after another step…',
    runAfterSucceeded: 'Is successful',
    runAfterFailed: 'Has failed',
    runAfterTimedOut: 'Has timed out',
    runAfterSkipped: 'Is skipped',
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
    agentFlowLabel: 'Agent flow',
    agentFlowBadgeTitle: 'Copilot Studio agent flow (opens in Copilot Studio)',
    nodeInputsLabel: 'Inputs',
    nodeNoInputs: 'No editable inputs',
    clickToEdit: 'Click to edit',

    // --- Run History sub-view ---
    subTabFlows: 'Flows',
    subTabRuns: 'Run History',
    runsTitle: 'Run History',
    runsCardAction: 'Runs',
    selectFlowForRuns: 'Select a flow to view its run history.',
    selectFlowPlaceholder: '--- Select a flow ---',
    loadingRuns: 'Loading run history...',
    loadRunsFailed: (error) => `Failed to load run history: ${error}`,
    noRuns: 'No runs found for this flow.',
    runHistoryDisabledNote: 'No run history was returned. Run history is stored only for solution cloud flows, is retained for a limited period (28 days by default), and can be turned off per environment. The full, lossless run history is always available in the maker portal.',
    runHistoryDisabledConfirmed: 'Run history is turned OFF for this environment — the org run-retention is set to 0 seconds, so no cloud-flow runs are stored in Dataverse. An admin can enable it by setting a retention period (Power Platform Admin Center). The full run history is always available in the maker portal.',
    runSearchPlaceholder: 'Filter runs by status, trigger, run id, or error...',
    refreshRuns: 'Refresh',
    runStatusAll: 'All statuses',
    runStatusSucceeded: 'Succeeded',
    runStatusFailed: 'Failed',
    runStatusCancelled: 'Cancelled',
    runStatusRunning: 'Running',
    runFailuresChip: 'Failures only',
    runTriggerType: (type) => `Trigger: ${type}`,
    runStarted: (when) => `Started ${when}`,
    runDurationLabel: 'Duration',
    runStartLabel: 'Start',
    runEndLabel: 'End',
    runTriggerLabel: 'Trigger type',
    runIdLabel: 'Run id',
    runErrorCodeLabel: 'Error code',
    runErrorMessageLabel: 'Error',
    runParentLabel: 'Parent run id',
    runPrimaryLabel: 'Primary run',
    runLogsTitle: 'Action logs',
    runFailedDetailNote: 'This is the run-level summary error. Power Automate does not store the individual failing action in Dataverse for cloud flows — open the run in Power Automate to see exactly which action failed and its full error message.',
    openRun: 'Open run in portal',
    liveOn: 'Live',
    liveOff: 'Live',
    liveInterval5: '5s',
    liveInterval10: '10s',
    liveInterval30: '30s',
    // Run summary bar
    summaryTotal: (count) => `${count} run${count !== 1 ? 's' : ''}`,
    summarySuccessRate: (pct) => `${pct}% success`,
    summaryAvgDuration: (text) => `Avg ${text}`,
    summaryLastRun: (when) => `Last run ${when}`,
    summarySucceeded: 'Succeeded',
    summaryFailed: 'Failed',
    summaryCancelled: 'Cancelled',
    summaryRunning: 'Running'
};

/**
 * AI Workbench tab messages (Copilot Studio agents, workflows, transcripts, AI Builder models).
 */
export const AGENTS = {
    // Tab + sub-views
    title: 'AI Workbench',
    agentsView: 'Agents',
    promptsView: 'Prompts & Models',

    // Toolbar
    refresh: 'Refresh',
    agentSearchPlaceholder: 'Search by name, schema name, status, or owner...',
    promptSearchPlaceholder: 'Search by name, status, template, or owner...',
    solutionFilterAll: '--- All solutions ---',
    loadSolutionsFailed: (error) => `Failed to load solutions: ${error}`,

    // Loading / empty states
    loadingAgents: 'Loading Copilot Studio agents...',
    loadingTranscripts: 'Loading conversation transcripts...',
    loadingModels: 'Loading AI Builder models...',
    noAgents: 'No Copilot Studio agents found in this environment.',
    noModels: 'No AI Builder models or prompts found in this environment.',
    noAgentsMatch: 'No agents match the current filters.',
    noModelsMatch: 'No models or prompts match the current filters.',
    noComponents: 'No authoring components found for this agent.',
    noTranscripts: 'No conversation transcripts found for this agent.',
    transcriptsBlockedNote: 'No transcripts — recording is turned off for this environment by an org setting. An admin can enable it in the Power Platform admin center.',
    transcriptsEmptyReasons: 'No transcripts yet — they are written in batches after a chat, kept about 30 days.',
    transcriptsHeading: 'Conversation transcripts',

    // Errors
    loadAgentsFailed: (error) => `Failed to load agents: ${error}`,
    loadModelsFailed: (error) => `Failed to load AI Builder models: ${error}`,
    loadComponentsFailed: (error) => `Failed to load agent components: ${error}`,
    loadTranscriptsFailed: (error) => `Failed to load transcripts: ${error}`,

    // Badges
    managedLabel: 'Managed',
    unmanagedLabel: 'Unmanaged',
    agentKindModern: 'GitHub Copilot',
    agentKindClassic: 'Standard',
    agentKindModernTitle: 'Modern generative agent.',
    agentKindClassicTitle: 'Classic topic-based agent.',
    publishStatePublished: 'Published',
    publishStateDraft: 'Draft',
    publishStatePublishedTitle: (when) => `Published ${when} — the status Copilot Studio shows.`,
    publishStateDraftTitle: 'Never published — Copilot Studio shows this agent as Draft.',
    recordStateActiveTitle: 'Record state: Active — separate from publish state.',
    recordStateInactiveTitle: 'Record state: Inactive — separate from publish state.',

    // Card actions
    viewDefinition: 'View Definition',
    viewDetails: 'Details',
    exportAgent: 'Export',
    exportAgentTitle: 'Export the full agent definition as JSON',
    exported: 'Agent definition exported.',
    exportFailed: (error) => `Failed to export agent: ${error}`,
    openInStudio: 'Open in Copilot Studio',
    openInAiBuilder: 'Open in AI Builder',
    activate: 'Activate',
    deactivate: 'Deactivate',

    // Delete a prompt / AI model (DELETE msdyn_aimodels(id))
    deleteModel: 'Delete',
    deleteModelConfirmTitle: 'Delete prompt or model',
    deleteModelConfirm: (name) => `<p>Delete <strong>${name}</strong>?</p><p class="pdt-text-error">This permanently deletes it and all its versions. This can't be undone.</p>`,
    modelDeleted: 'Deleted successfully.',
    deleteModelFailed: (error) => `Failed to delete: ${error}`,
    deleteModelManaged: "Managed prompts and models can't be deleted here.",
    deleteAgent: 'Delete',

    // Manage results
    agentActivated: 'Agent record activated — this does not publish the agent.',
    agentDeactivated: 'Agent record deactivated — this does not unpublish the agent.',
    activateFailed: (error) => `Failed to activate agent: ${error}`,
    deactivateFailed: (error) => `Failed to deactivate agent: ${error}`,
    agentDeleted: 'Agent deleted successfully.',
    deleteFailed: (error) => `Failed to delete agent: ${error}`,
    deleteConfirmTitle: 'Confirm Delete Agent',
    deleteConfirm: (name) => `<p>Delete agent <strong>${name}</strong>?</p><p class="pdt-text-error">This permanently deletes the agent and its components. This action cannot be undone.</p>`,
    managedAgentNote: 'Managed agents cannot be deleted.',

    // Definition dialog
    definitionTitle: (name) => `Agent: ${name}`,
    tabOverview: 'Overview',
    tabComponents: 'Components',
    tabConfig: 'Configuration (JSON)',
    instructionsHeading: 'Instructions',
    noInstructions: 'This agent has no instructions defined.',
    instructionsFromConfig: 'From the agent configuration — editable on the Configuration tab.',
    instructionsInConfig: 'Stored in the agent configuration — saving updates it there.',
    instructionsHasReferences: 'These instructions embed variables — edit them on the Configuration tab to keep those intact.',
    modelLabel: 'Model',
    knowledgeHeading: 'Knowledge sources',
    topicsHeading: 'Topics',
    connectedAgentsHeading: 'Connected agents',
    actionsHeading: 'Tools',
    triggersHeading: 'Triggers',
    testsHeading: 'Tests & evaluations',
    otherComponentsHeading: 'Other components',
    // Component kind badges
    kindTopic: 'Topic',
    kindAction: 'Tool',
    kindConnectedAgent: 'Connected agent',
    kindKnowledge: 'Knowledge',
    kindTrigger: 'Trigger',
    kindTest: 'Test',
    kindOther: 'Component',
    evalGraderKind: (kind) => ({
        PromptGrader: 'Prompt grader',
        GeneralQualityGrader: 'General quality grader',
        GroundednessGrader: 'Groundedness grader',
        RelevanceGrader: 'Relevance grader'
    }[kind] || kind || 'Grader'),
    evalNoLabelsNote: 'This grader scores quality holistically — no pass/fail labels.',
    evalInstructionsLabel: 'Grading prompt',
    evalLabelHeader: 'Label',
    evalDescriptionHeader: 'Description',
    evalOutcomeHeader: 'Expected outcome',
    evalResultsNote: 'Definition only — run results and scores live in Copilot Studio.',
    evalCaseHeading: 'Expected conversation',
    evalRoleUser: 'User',
    evalRoleAgent: 'Agent',
    // Component activate / deactivate
    componentStateOn: 'Active',
    componentStateOff: 'Inactive',
    componentActivate: 'Activate',
    componentDeactivate: 'Deactivate',
    componentActivated: 'Component activated.',
    componentDeactivated: 'Component deactivated.',
    componentStateFailed: (error) => `Failed to change component state: ${error}`,
    noConfig: 'No configuration data available for this agent.',

    // Transcript content (expanded inline in the Transcripts sub-tab)
    transcriptEmpty: 'This transcript has no content.',
    transcriptRawJson: 'Raw transcript (JSON)',
    // Session summary (from the SessionInfo / ConversationInfo trace activities)
    transcriptSessionEngaged: 'Engaged',
    transcriptSessionUnengaged: 'Unengaged',
    transcriptSessionEngagedTitle: 'The user entered a topic — a real interaction.',
    transcriptSessionUnengagedTitle: 'The user opened the agent but didn\'t start a topic.',
    transcriptSessionTestPane: 'Test pane',
    transcriptSessionTestPaneTitle: 'This conversation came from the Copilot Studio test pane, not a real user.',
    transcriptOutcomeResolved: 'Resolved',
    transcriptOutcomeEscalated: 'Escalated',
    transcriptOutcomeAbandoned: 'Abandoned',
    transcriptOutcomeResolvedImpliedTitle: 'Resolved by the agent\'s own logic, without user confirmation.',
    transcriptOutcomeResolvedConfirmedTitle: 'The user confirmed the conversation was a success.',
    transcriptTurns: (count) => `${count} turn${count === 1 ? '' : 's'}`,
    transcriptSessionUnengagedNote: 'Unengaged session — the user opened the agent but didn\'t send a message.',
    transcriptSessionNoMessages: 'No messages were recorded for this session.',

    // AI model card
    templateLabel: 'Template',
    publishedLabel: 'Published',
    publishedYes: 'Yes',
    publishedNo: 'No — draft only',
    retrainLabel: 'Retrain',
    retrainScheduled: 'Scheduled',

    // AI model dialog
    // Titled by what the item actually is — "Prompt: …", "Custom model: …", "Prebuilt model: …" —
    // taken from the template classification rather than calling everything an AI Model.
    modelTitle: (name, kindLabel = 'AI Model') => `${kindLabel}: ${name}`,
    modelContextHeading: 'Model definition',
    noModelContext: 'No definition is available for this model in Dataverse.',

    // AI configuration iterations (msdyn_aiconfiguration)
    configVersion: (version) => `Version ${version}`,
    configActive: 'Live',
    configFailed: 'Training failed:',
    configLastRun: (when) => `Last trained or run ${when}.`,
    configEditLiveWarning: 'Editing this saves over the live version — AI Builder would create a new draft instead.',
    promptPublishPending: 'Prompt saved. Publishing is still finishing — reopen in a moment to see the new version.',
    sectionCompressed: (label) => `${label} (decompressed)`,

    // Prompt execution settings (GptDynamicPrompt)
    promptModel: 'Model',
    promptTemperature: 'Temperature',
    promptRecordLimit: 'Record limit',
    promptModeration: 'Content moderation',
    promptRecordLinks: 'Links in response',
    promptCodeInterpreter: 'Code interpreter',
    promptOutput: 'Output',
    promptDataSources: 'Grounded on',
    promptFormulas: 'Power Fx',
    enabled: 'Enabled',
    disabled: 'Disabled',

    // Model data binding (msdyn_databinding)
    bindingTable: 'Table',
    bindingPredicts: 'Predicts',
    bindingColumns: 'Columns',
    bindingRelated: 'Related tables',
    // Friendly labels for a model's known input roles (msdyn_databinding specificationName). The
    // record-id role is hidden and 'Label' is shown as "Predicts", so neither is mapped here.
    bindingRoleLabels: {
        text: 'Text input',
        tags: 'Tags input'
    },
    bindingRelatedCount: (selected, total) => `${selected} of ${total} included`,

    // Model performance (msdyn_modelperformance) — friendly metrics panel for trained models
    perfCoverage: (total, test) => `${total} cases · ${test} in test set`,
    perfCategoryHeading: (category) => `By ${category}`,
    perfRawJson: 'Raw performance (JSON)',
    // Friendly labels for known performance metric names; unknown names are humanized from camelCase.
    perfMetricLabels: {
        weightedF1: 'Weighted F1',
        macroF1: 'Macro F1',
        accuracy: 'Accuracy',
        f1Score: 'F1 score',
        precision: 'Precision',
        recall: 'Recall',
        accuracyBaseline: 'Accuracy (baseline)',
        acuracyBaseline: 'Accuracy (baseline)', // Dataverse ships this misspelling
        f1ScoreBaseline: 'F1 (baseline)',
        cohenKappa: "Cohen's κ",
        grade: 'Grade',
        numberOfCasesTotal: 'Total cases',
        numberOfCasesTestSet: 'Test-set cases',
        numberOfFalsePositives: 'False positives',
        numberOfFalseNegatives: 'False negatives'
    },
    loadingDetails: 'Loading model definition...',
    loadModelDetailsFailed: (error) => `Failed to load model details: ${error}`,
    tabDefinition: 'Definition',
    tabPrompt: 'Prompt',
    tabSettings: 'Settings',
    tabTest: 'Test',
    tabRuns: 'Runs',
    tabEvaluations: 'Evaluations',
    configUnknown: 'Unknown',

    // Prompt editor (Prompt tab)
    promptSectionTitle: 'Prompt',
    promptSectionHint: 'What you ask the model to do.',
    promptTokenHint: 'Text in <code class="code-like">{braces}</code> are inputs, Dataverse columns and formulas the model fills in — keep them to reuse that data.',
    promptAdvancedConfig: 'Advanced — raw configuration (JSON)',
    versionHistory: 'Version history',
    // Trained-model version organization (portal parity)
    versionPublished: 'Published version',
    versionLastTrained: 'Last trained version',

    // Prompt settings controls (Settings tab; edit the same live config as the Prompt tab)
    noPromptSettings: 'No prompt configuration found for this model.',
    settingsIntro: 'Tune how the prompt runs. Changes here and in the Prompt tab save together.',
    settingsGroupBehaviour: 'Model behaviour',
    settingsGroupGrounding: 'Grounding & data',
    settingsGroupAdvanced: 'Advanced',
    promptTemperatureHint: 'Lower is more focused and repeatable; higher is more creative.',
    promptModerationHint: 'How strictly content is filtered.',
    promptRecordLimitHint: 'Most Dataverse rows the prompt may read per run.',
    promptRecordLinksHint: 'Include links to the records used in the answer.',
    promptCodeInterpreterHint: 'Let the model write and run Python to compute the answer.',

    // Save as (AIModelPublish with a new model id)
    saveAs: 'Save as',
    saveAsTitle: 'Save prompt as a copy',
    saveAsLabel: 'Name for the new prompt',
    saveAsDefault: (name) => `${name} (copy)`,
    saveAsNameRequired: 'Please enter a name for the copy.',
    saveAsDone: (name) => `Saved a copy as "${name}".`,
    saveAsFailed: (error) => `Failed to save a copy: ${error}`,
    cancel: 'Cancel',

    // Quick test (msdyn_aiconfiguration QuickTest action)
    testHeading: 'Test this prompt',
    testEmpty: 'Run the prompt to see its output, tokens and cost here. Each run is kept so you can compare.',
    testRun: 'Run test',
    testReuse: 'Test without regenerating',
    testReuseHint: 'Re-run the last generated code instead of regenerating it (faster, deterministic).',
    testReusedBadge: 'Reused code',
    testRunning: 'Running the prompt…',
    testFailed: (error) => `Test failed: ${error}`,
    testFailedBadge: 'Failed',
    testCreditsShort: (credits) => `${credits} credit${credits === 1 ? '' : 's'}`,
    testOutputWith: (mimeType) => `Output (${mimeType})`,
    testFinishReason: 'Finish reason',
    testTokens: 'Tokens',
    testTokenBreakdown: (prompt, completion, total) => `${total} (${prompt} prompt + ${completion} completion)`,
    testAiCredits: 'AI Builder credits',
    testCopilotCredits: 'Copilot credits',
    testCode: 'Generated code',
    testLogs: 'Execution logs',
    testPlanning: 'Plan',
    testPromptFixes: 'Suggested prompt fixes',
    testThoughtSteps: 'Reasoning',
    testDataUsed: 'Data used',
    testInputsTitle: 'Inputs',
    testInputsHint: 'Give each input a value, then run.',
    testInputPlaceholder: 'Enter a value',
    testInputSampleTitle: 'Prefilled with the sample data saved on this prompt.',
    testInputTypeBadge: (type) => type.charAt(0).toUpperCase() + type.slice(1),
    // Office formats are only readable when the code interpreter is on, so they are offered only then.
    testInputFileAccept: '.png,.jpg,.jpeg,.pdf',
    testInputFileAcceptCode: '.png,.jpg,.jpeg,.pdf,.xlsx,.docx,.pptx',
    testInputFileHint: 'PNG, JPG, PDF — up to 25 MB.',
    testInputFileHintCode: 'PNG, JPG, PDF, XLSX, DOCX, PPTX — up to 25 MB.',
    testInputFileChoose: 'Choose file',
    testInputFileReplace: 'Replace',
    testInputFileRemove: 'Remove file',
    testInputFileNone: 'No file chosen',
    testInputFileTooLarge: (name) => `"${name}" is over the 25 MB limit.`,
    testInputFilesTooLarge: (count) => `Those ${count} files total more than the 25 MB limit.`,
    testInputFileFailed: (name) => `Could not read "${name}".`,

    // Training (msdyn_aiconfiguration Train action)
    trainButton: 'Train',
    retrainButton: 'Retrain',
    retrainHint: 'Trains a new version from the current data, keeping this trained version.',
    trainStarted: (status) => `Training started${status ? ` (${status})` : ''}...`,
    trainFinished: (status) => `Training finished: ${status}.`,
    trainStillRunning: 'Training is still running — reopen this model to see the result.',
    trainFailed: (error) => `Failed to start training: ${error}`,
    perfDownload: 'Download detailed metrics',

    // Classifier Quick test (inline tester on a version)
    quickTestButton: 'Quick test',
    quickTestHeading: 'Quick test',
    quickTestHint: 'Run the model on sample text without leaving the dialog.',
    quickTestPlaceholder: 'Enter text to test.',
    quickTestRun: 'Test',
    quickTestEmpty: 'Results will appear here.',
    quickTestPredictionCount: (count) => `${count} prediction${count === 1 ? '' : 's'}`,
    quickTestNoPredictions: 'The model returned nothing for this input.',
    quickTestRawOutput: 'Prediction output',
    quickTestPredictionId: 'Prediction id',
    quickTestRunning: 'Testing...',
    quickTestNeedsText: 'Enter some text to test.',
    quickTestFailed: (error) => `Quick test failed: ${error}`,

    // Publish / Unpublish a trained model version
    publishButton: 'Publish',
    publishStarted: 'Publishing...',
    publishFinished: 'Published.',
    publishFailed: (error) => `Failed to publish: ${error}`,
    unpublishButton: 'Unpublish',
    unpublishConfirm: 'Confirm unpublish',
    unpublishWarning: 'Apps using this model will lose access.',
    unpublished: 'Model unpublished.',
    unpublishFailed: (error) => `Failed to unpublish: ${error}`,

    // AI Builder runs (msdyn_aievent)
    loadingRuns: 'Loading AI Builder runs...',
    runsHeading: (count) => `Recent runs (${count})`,
    noRuns: 'No runs yet — quick tests and automation runs appear here once the prompt is used.',
    loadRunsFailed: (error) => `Failed to load AI Builder runs: ${error}`,
    runQuickTest: 'Quick test',
    runAutomation: 'Run',
    runModel: 'LLM model',
    runUnits: 'Units',
    runConsumption: 'Credits',
    runSource: 'Source',
    runDataType: 'Data type',
    runOutput: 'Output',
    runNoOutput: 'This run recorded no output.',
    runBy: 'Run by',
    // Run input (msdyn_datainfo) — fetched lazily when a run is expanded
    runInput: 'Input',
    runInputRawJson: 'Raw input (JSON)',
    runInputFailed: (error) => `Failed to load input: ${error}`,
    runsStatQuickTests: 'Quick tests',
    runsStatAutomation: 'Automation',
    runsStatModels: 'Models',
    runsTrendHeading: 'Runs over time (recent)',
    runsFeatureUnlabeled: 'Other',

    // Evaluations — AI Builder Test hub (msdyn_aitestcase / msdyn_aitestrunbatch / msdyn_aitestrun)
    loadingEvaluations: 'Loading tests...',
    loadEvaluationsFailed: (error) => `Failed to load tests: ${error}`,
    noEvaluations: 'No test cases or runs yet — add one in the AI Builder Test hub, then run it.',
    evalTestCasesHeading: (count) => `Test cases (${count})`,
    evalRunsHeading: (count) => `Run history (${count})`,
    evalExpectedOutput: 'Expected output',
    // Latest-run hero + batch summary
    evalLatestRun: 'Latest run',
    evalCases: 'Cases',
    evalAvgAccuracy: 'Avg accuracy',
    evalDuration: 'Duration',
    // Test case inputs (loaded on expand)
    evalInputs: 'Inputs',
    evalLoadingInputs: 'Loading inputs...',
    evalLoadInputsFailed: (error) => `Failed to load inputs: ${error}`,
    // Batch results (loaded on expand)
    evalLoadingRuns: 'Loading results...',
    evalLoadRunsFailed: (error) => `Failed to load results: ${error}`,
    evalNoRuns: 'No results recorded for this run.',
    evalUnnamedCase: '(test case)',
    evalTokensShort: (tokens) => `${tokens} token${tokens === 1 ? '' : 's'}`,
    // Expected vs actual columns
    evalExpected: 'Expected',
    evalActual: 'Actual',
    evalNoOutput: 'No output.',
    // Derived batch/run status labels (fallback when Dataverse omits the formatted value)
    evalStateCompleted: 'Completed',
    evalStateRunning: 'Running',
    evalStateFailed: 'Failed',
    // Pass/Fail (computed against the criteria's passing score)
    evalPass: 'Pass',
    evalFail: 'Fail',
    evalPassed: 'Passed',
    evalCasesCount: (count) => `${count} case${count === 1 ? '' : 's'}`,
    evalAvgLabel: 'avg',
    evalPassShort: (pass, total) => `${pass}/${total} passed`,
    // Evaluation criteria (msdyn_aievaluationconfiguration.msdyn_evaluationcriteria)
    evalCriteriaButton: 'Evaluation criteria',
    evalCriteriaTitle: 'Evaluation criteria',
    evalPassingScore: 'Passing score',
    evalPrebuiltCriteria: 'Prebuilt criteria',
    evalCriteriaExpected: 'Evaluate based on expected response',
    evalCriteriaExact: 'Exact match',
    evalCriteriaSimilarity: 'Semantic similarity',
    evalCriteriaResponseQuality: 'Response quality',
    evalCriteriaJson: 'JSON correctness',
    evalCriteriaNone: 'No checks enabled',
    criteriaSaved: 'Evaluation criteria saved.',
    criteriaSaveFailed: (error) => `Failed to save evaluation criteria: ${error}`,
    // Test case selection + delete (msdyn_aitestcase)
    evalSelectAll: 'Select all test cases',
    evalSelectCase: (name) => `Select ${name}`,
    evalDeleteAll: 'Delete all',
    evalDeleteSelected: (count) => `Delete selected (${count})`,
    deleteTestCasesTitle: 'Delete test cases',
    deleteTestCaseConfirm: 'Delete this test case? This cannot be undone.',
    deleteTestCasesConfirm: (count) => `Delete ${count} test cases? This cannot be undone.`,
    testCaseDeleted: 'Test case deleted.',
    testCasesDeleted: (count) => `${count} test cases deleted.`,
    deleteTestCasesFailed: (error) => `Failed to delete: ${error}`,
    // Run tests (create batch + runs, predict, grade, score — consumes AI Builder credits)
    evalRunAll: 'Run all',
    evalRunSelected: (count) => `Run selected (${count})`,
    evalRunUnavailable: 'Publish the prompt first to run tests.',
    runTestsRunning: (count) => `Running ${count} test case${count === 1 ? '' : 's'} against the prompt — this can take a moment.`,
    runTestsDone: (count, passed) => `Ran ${count} test case${count === 1 ? '' : 's'} — ${passed} passed.`,
    runTestsFailed: (error) => `Failed to run tests: ${error}`,

    // Editing + publishing
    save: 'Save',
    saveAndPublish: 'Save & Publish',
    undo: 'Undo',
    saved: 'Changes saved.',
    saveFailed: (error) => `Failed to save: ${error}`,
    invalidJson: 'Invalid JSON. Please fix syntax errors before saving.',
    publishing: 'Publishing agent — this can take a moment.',
    published: 'Agent published successfully.',
    publishFailed: (error) => `Failed to publish agent: ${error}`,
    publishUnconfirmed: 'Publish is taking longer than usual — you will be notified when it completes.',
    publishConfirmTitle: 'Publish Agent',
    publishConfirm: (name) => `<p>Publish <strong>${name}</strong>?</p><p>This makes saved authoring changes live for all users of this agent.</p>`,

    // Workflows view (Copilot Studio "Workflows" — modern workflows, modernflowtype=1)
    flowsView: 'Workflows',
    flowsSearchPlaceholder: 'Search workflows...',
    loadingFlows: 'Loading workflows...',
    noFlows: 'No Copilot Studio workflows found in this environment.',
    noFlowsMatch: 'No workflows match your search.',
    loadFlowsFailed: (error) => `Failed to load workflows: ${error}`,
    flowOpenInPortal: 'Open in Copilot Studio',
    flowViewDefinition: 'View Definition',
    flowStatusOn: 'On',
    flowStatusOff: 'Off',
    flowTurnOn: 'Turn On',
    flowTurnOff: 'Turn Off',
    flowDelete: 'Delete',
    flowManagedLabel: 'Managed',
    flowUnmanagedLabel: 'Unmanaged',
    flowActivated: 'Workflow activated.',
    flowDeactivated: 'Workflow deactivated.',
    flowToggleFailed: (error) => `Failed to update workflow: ${error}`,
    flowDeleteConfirmTitle: 'Delete Workflow',
    flowDeleteConfirm: (name) => `Delete "${name}"? This cannot be undone.`,
    flowDeleted: 'Workflow deleted.',
    flowDeleteFailed: (error) => `Failed to delete workflow: ${error}`,

    // Definition-dialog sub-tabs
    tabTranscripts: 'Transcripts',

    // Activity (definition dialog)
    tabActivity: 'Activity',
    activityLifecycle: 'Lifecycle',
    activityCreated: 'Created',
    activityModified: 'Last modified',
    activityPublished: 'Last published',
    activityPublishedBy: 'Published by',
    activityOwner: 'Owner',
    activityPublishStatus: 'Publish status',
    publishStatusDraft: 'Draft — never published',
    publishStatusUpToDate: 'Published — no unpublished changes',
    publishStatusPending: (n) => `${n} unpublished change${n === 1 ? '' : 's'} since last publish`,
    activityUnpublishedTag: 'Unpublished',
    activityUnpublishedTagTitle: 'Changed after the last publish.',
    activityCompositionHeading: 'Composition',
    activityRecentChanges: 'Recent changes',
    activityNoChanges: 'No component change history available.',
    activityUsageHeading: 'Usage & analytics',
    activityLoadingUsage: 'Loading session activity...',
    usageSessions: 'Sessions',
    usageLast7: 'Last 7 days',
    usageLast30: 'Last 30 days',
    // Env-aware empty-state variants (why Dataverse has no sessions).
    usageNoSessionsBlocked: 'No sessions — transcript recording is turned off for this environment by an org setting.',
    usageNoSessionsEnv: 'No sessions — transcripts are kept about 30 days.',
    usageUnavailable: 'Session activity is unavailable for this agent.',

    // Map (definition dialog)
    tabMap: 'Map',
    mapTopics: 'Topics',
    mapConnectedAgents: 'Connected agents',
    mapActions: 'Tools',
    mapKnowledge: 'Knowledge',
    mapTriggers: 'Triggers',
    mapEmpty: 'No structure to display for this agent.',
    mapOpenAgent: (name) => `Open ${name}`,
    mapUnresolvedAgent: (schema) => `Points to agent "${schema}", which isn't in this environment (deleted or not imported).`,
    loadingMap: 'Loading connected agent...',

    // Templates workbench (Library | Generator | Review)
    templatesView: 'Templates',
    templateSearchPlaceholder: 'Search templates (try a problem, e.g. "hallucination")...',
    templateCategoryAll: '--- All categories ---',
    noTemplates: 'No templates match your search.',
    templatesIntro: 'Copy-ready scaffolds for Copilot Studio — browse the Library, compose with the Generator, or check existing instructions with Review. Nothing here changes your agents.',
    templatesLibraryTab: 'Library',
    templatesGeneratorTab: 'Generator',
    templatesReviewTab: 'Review',
    templateSubcategoryAll: 'All',
    noTemplatesForKind: (context) => `No templates here apply to ${context} — the matching ones are for the other agent type.`,

    // Agent experience — shared by all three workbench segments. Distinct from agentKind* above,
    // which labels the agent cards' "Powered by" column.
    agentTypeLabel: 'Agent type',
    agentTypeTitle: 'Which guidance every segment follows. Selecting an agent picks it for you — change it any time.',
    agentTypeAny: '--- Any agent type ---',
    agentTypeClassic: 'Classic (topic-based)',
    agentTypeModern: 'Modern (instructions-first)',
    agentContextAny: 'any agent type',
    agentContextClassic: 'a classic agent',
    agentContextModern: 'a modern agent',
    agentScopeClassic: 'Classic only',
    agentScopeModern: 'Modern only',
    agentScopeClassicTitle: 'Only applies to classic, topic-based agents — modern agents have no topics.',
    agentScopeModernTitle: 'Only applies to modern, instructions-first agents (the declarative-agent guidance).',
    agentTagModern: 'Modern',
    agentTagClassic: 'Classic',

    // What a template is for — instruction text is the default and needs no badge.
    templateUseGuidance: 'Maker checklist',
    templateUseGuidanceTitle: 'Steps to follow in the Copilot Studio editor — not text to paste into your agent\'s instructions.',
    templateUseConfig: 'Definition',
    templateUseConfigTitle: 'A definition to paste into a topic or a test set — not into your agent\'s instructions.',

    // Generator (instruction builder)
    generatorIntroAny: 'Pick a role and options — the output uses classic /Tool references until you choose an agent type.',
    generatorIntroClassic: 'Pick a role and options — composed for a classic agent, with /Tool slash references.',
    generatorIntroModern: 'Pick a role and options — composed for a modern agent: backticked tool names, an output contract, and a self-check.',
    generatorRoleLabel: 'Role preset',
    generatorCompanyLabel: 'Company',
    generatorProductLabel: 'Product / service',
    generatorAudienceLabel: 'Audience',
    generatorToneLabel: 'Tone',
    generatorCapabilitiesLabel: 'Capabilities',
    generatorToolsLabel: 'Tool hints',
    generatorEscalationLabel: 'Escalation',
    generatorGuardrailsLabel: 'Guardrails',
    generatorFormatLabel: 'Response format',
    generatorSelectedCount: (n) => `${n} selected`,
    generatorAgentLabel: 'Ground in one of your agents (optional)',
    generatorAgentNone: '--- Generic tool hints ---',
    generatorAgentToolsNote: 'Pick the ones worth naming — the orchestrator routes on each description, shown below the name.',
    generatorGroupTools: 'Tools',
    generatorGroupKnowledge: 'Knowledge',
    generatorGroupTopics: 'Topics',
    generatorGroupAgents: 'Connected agents',
    generatorComponentNoDescription: 'No description — routing will rely on the name alone',
    generatorComponentDuplicateDescription: 'Same description as another component — the agent may call either',
    generatorAgentNoTools: 'This agent has no tools or knowledge sources to reference — using generic hints.',
    generatorAgentLoadFailed: (error) => `Failed to load the agent's tools: ${error}`,
    generatorCompanyPlaceholder: 'e.g. Contoso',
    generatorProductPlaceholder: 'e.g. Contoso Coffee machines',
    generatorAudiencePlaceholder: 'e.g. retail customers',
    generatorCustomRolePlaceholder: 'Describe what this agent does, e.g. "Help suppliers track purchase order approvals."',
    generatorOutputHeading: 'Composed instructions',
    generatorLength: (n) => `${n} characters`,
    generatorLengthHint: 'Long instructions degrade reliability — trim to the essentials and move reference material into knowledge.',
    generatorCopy: 'Copy',
    generatorCopied: 'Instructions copied.',
    generatorDownload: 'Download .md',
    generatorReset: 'Reset',

    // Review (instruction checker)
    reviewIntro: 'Paste agent instructions (or load them from an agent) — issues are flagged against Microsoft\'s guidance for the selected agent type.',
    reviewPlaceholder: 'Paste the agent instructions to review...',
    reviewLoadAgentLabel: 'Load from agent',
    reviewLoadAgentNone: '--- Select an agent ---',
    reviewLoadExample: 'Load example',
    reviewOpenAgent: 'Open agent definition',
    reviewDocLink: 'Microsoft Learn',
    reviewAllClear: (checks, context) => `No issues found — passed all ${checks} checks for ${context}.`,
    reviewFindingsHeading: (n, context) => `${n} finding${n === 1 ? '' : 's'} — checked as ${context}`,
    reviewSeverity: (severity) => ({ error: 'Error', warn: 'Warning', info: 'Info' }[severity] || severity),
    reviewNoInstructions: 'This agent has no instructions to review.',
    reviewLoadFailed: (error) => `Failed to load the agent's instructions: ${error}`,

    // Cross-agent search view
    searchView: 'Search',
    crossSearchPlaceholder: 'Type at least two characters to search across all agents (instructions, topics, knowledge, tools)...',
    // Shown only once typing has started and hidden the placeholder — never alongside it.
    searchPrompt: 'Type at least two characters to search.',
    searching: 'Searching agents...',
    searchFailed: (error) => `Search failed: ${error}`,
    searchNoResults: (term) => `No components match "${term}".`,
    searchResultsCount: (count) => `${count} match${count !== 1 ? 'es' : ''} found`,
    searchOpenAgent: 'Open agent',
    searchUnknownAgent: 'Unknown agent'
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

/**
 * Custom API Manager tab messages.
 */
export const CUSTOM_API = {
    // Browse view
    title: 'Custom API Manager',
    browserView: 'Browse',
    testerView: 'Tester',
    // Solution selector
    selectSolution: '--- Select a Solution ---',
    allSolutions: 'All APIs (no solution filter)',
    selectSolutionBody: 'Select a solution to view its Custom APIs.',
    loadingSolutions: 'Loading solutions...',
    solutionLoadFailed: 'Failed to load solutions.',
    searchPlaceholder: 'Search by name, description, or bound entity...',
    loading: 'Loading custom APIs...',
    loadFailed: (error) => `Failed to load custom APIs: ${error}`,
    noApisFound: 'No custom APIs found in this environment.',
    noSearchResults: 'No custom APIs match your search.',
    refreshed: 'Custom APIs refreshed.',
    // Stats
    totalApis: 'Total APIs',
    totalActions: 'Actions',
    totalFunctions: 'Functions',
    totalManaged: 'Managed',
    // Badges & labels
    actionLabel: 'Action',
    functionLabel: 'Function',
    globalLabel: 'Global',
    entityBoundLabel: 'Entity',
    collectionBoundLabel: 'Collection',
    managedBadge: 'Managed',
    unmanagedLabel: 'Unmanaged',
    privateLabel: 'Private',
    requiredLabel: 'Required',
    optionalLabel: 'Optional',
    // CRUD operations
    createSuccess: 'Custom API created successfully.',
    createFailed: (error) => `Failed to create custom API: ${error}`,
    updateSuccess: 'Custom API updated successfully.',
    updateFailed: (error) => `Failed to update custom API: ${error}`,
    deleteSuccess: 'Custom API deleted successfully.',
    deleteFailed: (error) => `Failed to delete custom API: ${error}`,
    deleteConfirm: (name) => `<p>Delete custom API <strong>${name}</strong>?</p><p class="pdt-text-error">This will also delete all request parameters and response properties. This action cannot be undone.</p>`,
    deleteConfirmTitle: 'Confirm Delete Custom API',
    cannotDeleteManaged: 'Cannot delete a managed custom API.',
    // Parameters & Properties
    addParamSuccess: 'Request parameter added.',
    addParamFailed: (error) => `Failed to add request parameter: ${error}`,
    paramDeleted: 'Request parameter deleted.',
    paramDeleteFailed: (error) => `Failed to delete request parameter: ${error}`,
    addPropSuccess: 'Response property added.',
    addPropFailed: (error) => `Failed to add response property: ${error}`,
    propDeleted: 'Response property deleted.',
    propDeleteFailed: (error) => `Failed to delete response property: ${error}`,
    paramDeleteConfirm: (name) => `Delete request parameter <strong>${name}</strong>?`,
    propDeleteConfirm: (name) => `Delete response property <strong>${name}</strong>?`,
    // Tester view
    testerTitle: 'API Tester',
    selectApiLabel: 'Select API',
    selectApiPlaceholder: '--- Select an API to test ---',
    endpointLabel: 'Endpoint',
    methodLabel: 'Method',
    parametersTitle: 'Request Parameters',
    targetRecordLabel: 'Target Record',
    recordIdLabel: 'Record ID',
    recordIdPlaceholder: 'Enter record GUID...',
    headersTitle: 'Custom Headers',
    executeBtn: 'Execute',
    executing: 'Executing...',
    executeSuccess: 'API executed successfully.',
    executeFailed: (error) => `Execution failed: ${error}`,
    bodyAutoGenerated: 'Auto-generated from parameter definitions',
    headersPreFilled: 'Standard OData headers (editable)',
    autoDetectBtn: 'Auto-Detect',
    autoDetectTooltip: 'Auto-detect record ID from current form',
    autoDetectSuccess: 'Record ID detected from current form.',
    noFormContext: 'No form context available for auto-detection.',
    // Code generation
    codeGenTitle: 'Code Snippets',
    copyAsJs: 'JavaScript',
    copyAsCSharp: 'C#',
    copyAsHttp: 'HTTP',
    copyAsPowerAutomate: 'Power Automate',
    copyCodeBtn: 'Copy',
    codeCopied: (lang) => `${lang} code copied to clipboard.`,
    bodyCopied: 'Response body copied to clipboard.',
    headersCopied: 'Response headers copied to clipboard.',
    // Card buttons
    expandBtn: 'Details',
    collapseBtn: 'Collapse',
    exportBtn: 'Export',
    exportTooltip: 'Export API definition as JSON',
    testBtn: 'Test',
    editBtn: 'Edit',
    deleteBtn: 'Delete',
    createBtn: 'New API',
    importBtn: 'Import',
    requestParams: 'Request Parameters',
    responseProps: 'Response Properties',
    noParams: 'No request parameters defined.',
    noProps: 'No response properties defined.',
    // Card info labels
    bindingLabel: 'Binding',
    boundEntityLabel: 'Bound Entity',
    processingLabel: 'Processing',
    pluginLabel: 'Plugin Type',
    logicalEntityNameLabel: 'Logical Entity Name',
    logicalEntityPlaceholder: 'For Entity/EntityRef types',
    // Export / Import
    exportSuccess: 'API definition exported.',
    importSuccess: 'Custom API imported successfully.',
    importFailed: (error) => `Failed to import custom API: ${error}`,
    importInvalid: 'Invalid import file: missing uniquename.',
    // History
    historyTitle: 'Execution History',
    historyEmpty: 'No executions yet.',
    historyClear: 'Clear History',
    historyCleared: 'Execution history cleared.',
    historyDetailTitle: 'Execution Detail',
    // Param/Prop edit
    editParamTitle: 'Edit Request Parameter',
    editPropTitle: 'Edit Response Property',
    paramUpdated: 'Request parameter updated.',
    paramUpdateFailed: (error) => `Failed to update request parameter: ${error}`,
    propUpdated: 'Response property updated.',
    propUpdateFailed: (error) => `Failed to update response property: ${error}`,
    // Form fields
    uniqueNameLabel: 'Unique Name',
    uniqueNamePlaceholder: 'e.g., myprefix_ProcessOrder',
    displayNameLabel: 'Display Name',
    displayNamePlaceholder: 'e.g., Process Order',
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'Describe what this API does...',
    bindingTypeLabel: 'Binding Type',
    boundEntityPlaceholder: 'e.g., salesorder',
    isFunctionLabel: 'Is Function (GET)',
    paramTypeLabel: 'Type',
    isPrivateLabel: 'Is Private',
    processingTypeLabel: 'Processing Step Type',
    privilegeNameLabel: 'Execute Privilege Name',
    privilegeNamePlaceholder: 'e.g., prvReadAccount',
    workflowEnabledLabel: 'Enabled for Workflow',
    // Create/Edit dialog
    createDialogTitle: 'Create Custom API',
    editDialogTitle: 'Edit Custom API',
    addParamTitle: 'Add Request Parameter',
    addPropTitle: 'Add Response Property',
    requiredFields: 'Please fill in all required fields.',
    immutableField: 'This field cannot be changed after creation.',
    immutableNotice: 'Note: Unique Name, Type, Binding Type, Bound Entity, and Processing Type cannot be changed after creation.',
    // Solution info in create dialogs
    selectSolutionBeforeCreate: 'Please select a solution before creating.',
    solutionSelected: (uniqueName, prefix) => `Will be added to solution: <strong>${uniqueName}</strong> (prefix: ${prefix || 'n/a'})`,
    solutionWarning: (message) => `<strong>⚠ ${message}</strong>`,
    solutionSuccess: '✓',
    solutionAddFailed: (name) => `API created but failed to add to solution "${name}". You can add it manually.`,
    // Tabs in tester
    paramsTab: 'Params',
    headersTab: 'Headers',
    bodyTab: 'Body',
    responseBodyTab: 'Response',
    responseHeadersTab: 'Headers',
    // Plugin type
    pluginTypeLabel: 'Plugin Type',
    pluginTypePlaceholder: 'Select a plugin type (optional)...',
    pluginTypeNone: '(None)',
    pluginTypeLoadFailed: 'Failed to load plugin types.',
    // Additional create dialog fields
    nameLabel: 'Name',
    namePlaceholder: 'Auto-generated from Custom API and Unique Name',
    // Export execution detail
    exportDetailBtn: 'Export',
    exportDetailSuccess: 'Execution detail exported.',
    // Create button
    createBtnText: 'Create',
    creating: 'Creating...',
    // Save button (edit dialogs)
    saveBtnText: 'Save',
    saving: 'Saving...',
    // Custom API auto-detect for param/prop dialogs
    customApiLabel: 'Custom API',
    // Import review
    importReviewTitle: 'Review Imported Custom API',
    // Unmanaged badge
    unmanagedBadge: 'Unmanaged',
    // Tester JSON validation
    invalidJsonParam: (name) => `Parameter "${name}" has invalid JSON.`,
    invalidIntegerParam: (name) => `Parameter "${name}" must be a whole number.`,
    invalidDecimalParam: (name) => `Parameter "${name}" must be a valid number.`,
    invalidGuidParam: (name) => `Parameter "${name}" must be a valid GUID (e.g., 00000000-0000-0000-0000-000000000000).`,
    invalidStringArrayParam: (name) => `Parameter "${name}" must be a valid JSON array (e.g., ["a","b"]) or comma-separated values.`,
    stringArrayPlaceholder: 'Comma-separated values (e.g., value1, value2)',
    // DateTime placeholder
    dateTimePlaceholder: 'Select date and time...',
    // Response body format tabs
    responseFormatJson: 'JSON',
    responseFormatXml: 'XML',
    responseFormatRaw: 'Raw',
    emptyResponse: '(empty response)'
};