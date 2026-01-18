/**
 * @file Command Bar Analysis Service for comparing ribbon/command visibility between users
 * @module services/CommandBarAnalysisService
 * @description Provides functionality to analyze ribbon commands, display rules, and enable rules
 * to determine which commands would be visible to different users based on their security privileges.
 */

/* global atob, DecompressionStream, Response */

import { WebApiService } from './WebApiService.js';
import { MetadataService } from './MetadataService.js';
import { PowerAppsApiService } from './PowerAppsApiService.js';
import { SecurityAnalysisService } from './SecurityAnalysisService.js';
import { NotificationService } from './NotificationService.js';
import { Config } from '../constants/index.js';

/**
 * @typedef {Object} RibbonDiff
 * @property {string} ribbondiffid - Unique identifier
 * @property {string} solutionid - Solution that owns this diff
 * @property {string} diffid - The diff identifier (command/rule ID)
 * @property {string} rdx - The ribbon diff XML content
 * @property {string|null} entity - Entity logical name or null for global
 * @property {number} difftype - Type of diff (0=Command, 1=Button, 2=Rule, 3=LocLabel, etc.)
 * @property {string} tabid - Tab identifier
 * @property {boolean} ismanaged - Whether from managed solution
 */

/**
 * @typedef {Object} CommandDefinition
 * @property {string} id - Command unique identifier
 * @property {string} name - Display name (from LocLabel if available)
 * @property {string} solutionName - Name of solution that defines this
 * @property {string} publisherName - Publisher name
 * @property {Array<DisplayRule>} displayRules - Display rules for this command
 * @property {Array<EnableRule>} enableRules - Enable rules for this command
 * @property {string|null} entity - Entity this applies to (null = global)
 * @property {boolean} isManaged - From managed solution
 */

/**
 * @typedef {Object} DisplayRule
 * @property {string} id - Rule identifier
 * @property {string} type - Rule type (EntityPrivilegeRule, FormStateRule, etc.)
 * @property {Object} parameters - Rule-specific parameters
 * @property {boolean|null} evaluationResult - Result for current user (null if unknown)
 */

/**
 * @typedef {Object} EnableRule
 * @property {string} id - Rule identifier
 * @property {string} type - Rule type
 * @property {Object} parameters - Rule-specific parameters
 * @property {boolean|null} evaluationResult - Result for current user (null if unknown)
 */

/**
 * @typedef {Object} CommandComparison
 * @property {string} commandId - Command identifier
 * @property {string} commandName - Display name
 * @property {string} entity - Entity or 'All Entities'
 * @property {boolean} visibleToCurrentUser - Whether current user can see this
 * @property {boolean} visibleToTargetUser - Whether target user can see this
 * @property {Array<string>} currentUserBlockedBy - Rules blocking current user
 * @property {Array<string>} targetUserBlockedBy - Rules blocking target user
 * @property {string} difference - 'same' | 'only-current' | 'only-target'
 */

/**
 * Common privilege-based display rules used in Dynamics 365/Power Apps ribbons.
 * These are the standard rules that depend on security privileges.
 */
const PRIVILEGE_BASED_RULES = {
    // Create privileges
    'Mscrm.CreateSelectedEntityPermission': { privilege: 'Create', depth: 'Basic' },
    'Mscrm.CanSavePrimary': { privilege: 'Write', depth: 'Basic' },
    // Write privileges
    'Mscrm.CanWritePrimary': { privilege: 'Write', depth: 'Basic' },
    'Mscrm.CanWriteSelected': { privilege: 'Write', depth: 'Basic' },
    'Mscrm.WritePrimaryEntityPermission': { privilege: 'Write', depth: 'Basic' },
    'Mscrm.WriteSelectedEntityPermission': { privilege: 'Write', depth: 'Basic' },
    // Delete privileges
    'Mscrm.CanDeletePrimary': { privilege: 'Delete', depth: 'Basic' },
    'Mscrm.DeletePrimaryEntityPermission': { privilege: 'Delete', depth: 'Basic' },
    'Mscrm.DeleteSelectedEntityPermission': { privilege: 'Delete', depth: 'Basic' },
    // Assign privileges
    'Mscrm.AssignSelectedEntityPermission': { privilege: 'Assign', depth: 'Basic' },
    // Share privileges
    'Mscrm.SharePrimaryPermission': { privilege: 'Share', depth: 'Basic' },
    'Mscrm.ShareSelectedEntityPermission': { privilege: 'Share', depth: 'Basic' },
    // Read privileges
    'Mscrm.ReadPrimaryEntityPermission': { privilege: 'Read', depth: 'Basic' },
    'Mscrm.ReadSelectedEntityPermission': { privilege: 'Read', depth: 'Basic' }
};

/**
 * Display rules that always hide commands (used to identify hidden commands).
 */
const ALWAYS_HIDE_RULES = [
    'Mscrm.HideOnModern',
    'Mscrm.HideOnCommandBar'
];

/**
 * Display rules that always show commands on modern UI.
 */
const ALWAYS_SHOW_RULES = [
    'Mscrm.ShowOnlyOnModern'
];

/**
 * Form state rules - can be evaluated if we know the form context.
 */
const FORM_STATE_RULES = {
    'Mscrm.IsFormReadOnly': { requiresForm: true, state: 'ReadOnly' },
    'Mscrm.IsFormCreate': { requiresForm: true, state: 'Create' },
    'Mscrm.IsFormExisting': { requiresForm: true, state: 'Existing' },
    'Mscrm.IsFormDisabled': { requiresForm: true, state: 'Disabled' }
};

/**
 * Selection count rules - depends on grid selection.
 */
const SELECTION_COUNT_RULES = [
    'Mscrm.SelectionCountExactlyOne',
    'Mscrm.SelectionCountRule',
    'Mscrm.SelectionCountAtLeastOne',
    'Mscrm.NoRecordsSelected'
];

/**
 * Organization setting rules - requires org settings check.
 */
const ORG_SETTING_RULES = [
    'Mscrm.IsSharepointEnabled',
    'Mscrm.IsSOPIntegrationEnabled',
    'Mscrm.IsFiscalCalendarDefined'
];

/**
 * Miscellaneous privilege rules (non-entity specific).
 */
const MISC_PRIVILEGE_RULES = {
    'Mscrm.CanExportToExcel': { privilege: 'prvExportToExcel' },
    'Mscrm.CanMailMerge': { privilege: 'prvMailMerge' },
    'Mscrm.CanGoOffline': { privilege: 'prvGoOffline' },
    'Mscrm.CanBulkDelete': { privilege: 'prvBulkDelete' }
};

/**
 * Custom rule - requires JavaScript evaluation.
 */
const CUSTOM_RULE_PATTERN = /CustomRule/i;

/**
 * Value rule - requires form field value check.
 */
const VALUE_RULE_PATTERN = /ValueRule/i;

/**
 * Record privilege rule - requires specific record ownership check.
 */
const RECORD_PRIVILEGE_RULE_PATTERN = /RecordPrivilegeRule/i;

/**
 * Comprehensive list of standard/OOTB command buttons with known privilege requirements.
 * These are built-in commands that exist in the default ribbon definitions.
 * Each command specifies: id, name, requiredPrivilege, context, and optional entity properties.
 */
const STANDARD_COMMANDS = [
    // ========================================
    // FORM COMMANDS - Main form command bar
    // ========================================
    {
        id: 'Mscrm.SavePrimaryRecord',
        name: 'Save',
        requiredPrivilege: 'Write',
        context: 'Form',
        description: 'Save the current record'
    },
    {
        id: 'Mscrm.SaveAndClose',
        name: 'Save & Close',
        requiredPrivilege: 'Write',
        context: 'Form',
        description: 'Save and close the form'
    },
    {
        id: 'Mscrm.SaveAndNew',
        name: 'Save & New',
        requiredPrivilege: 'Create',
        context: 'Form',
        description: 'Save current and create new record'
    },
    {
        id: 'Mscrm.DeletePrimaryRecord',
        name: 'Delete',
        requiredPrivilege: 'Delete',
        context: 'Form',
        description: 'Delete the current record'
    },
    {
        id: 'Mscrm.AssignPrimaryRecord',
        name: 'Assign',
        requiredPrivilege: 'Assign',
        context: 'Form',
        description: 'Assign the record to another user/team'
    },
    {
        id: 'Mscrm.SharePrimaryRecord',
        name: 'Share',
        requiredPrivilege: 'Share',
        context: 'Form',
        description: 'Share the record with other users/teams'
    },
    {
        id: 'Mscrm.DeactivatePrimaryRecord',
        name: 'Deactivate',
        requiredPrivilege: 'Write',
        context: 'Form',
        description: 'Deactivate the current record'
    },
    {
        id: 'Mscrm.ActivatePrimaryRecord',
        name: 'Activate',
        requiredPrivilege: 'Write',
        context: 'Form',
        description: 'Activate an inactive record'
    },
    {
        id: 'Mscrm.RefreshPrimaryRecord',
        name: 'Refresh',
        requiredPrivilege: 'Read',
        context: 'Form',
        description: 'Refresh form data'
    },
    {
        id: 'Mscrm.Form.AddConnection',
        name: 'Connect',
        requiredPrivilege: 'Append',
        context: 'Form',
        entityProperty: 'IsConnectionsEnabled',
        description: 'Add a connection to another record'
    },
    {
        id: 'Mscrm.AddNoteFromForm',
        name: 'Add Note',
        requiredPrivilege: 'Create',
        context: 'Form',
        entityProperty: 'HasNotes',
        relatedEntity: 'annotation',
        description: 'Add a note to the record'
    },
    {
        id: 'Mscrm.AddActivityFromForm',
        name: 'Add Activity',
        requiredPrivilege: 'Create',
        context: 'Form',
        entityProperty: 'HasActivities',
        description: 'Add an activity to the record'
    },
    {
        id: 'Mscrm.Form.EmailALink',
        name: 'Email a Link',
        requiredPrivilege: 'Read',
        context: 'Form',
        description: 'Email a link to this record'
    },
    {
        id: 'Mscrm.Form.CopyShortcut',
        name: 'Copy Link',
        requiredPrivilege: 'Read',
        context: 'Form',
        description: 'Copy record URL to clipboard'
    },
    {
        id: 'Mscrm.RunWorkflow',
        name: 'Run Workflow',
        requiredPrivilege: 'Read',
        context: 'Form',
        description: 'Run a workflow on the record'
    },
    {
        id: 'Mscrm.Form.StartDialog',
        name: 'Start Dialog',
        requiredPrivilege: 'Read',
        context: 'Form',
        description: 'Start a dialog process'
    },
    {
        id: 'Mscrm.Form.WordTemplates',
        name: 'Word Templates',
        requiredPrivilege: 'Read',
        context: 'Form',
        description: 'Generate Word document from template'
    },
    {
        id: 'Mscrm.Form.ExcelTemplates',
        name: 'Excel Templates',
        requiredPrivilege: 'Read',
        context: 'Form',
        description: 'Export to Excel template'
    },

    // ========================================
    // GRID COMMANDS - Homepage grid/list view
    // ========================================
    {
        id: 'Mscrm.NewRecordFromGrid',
        name: 'New',
        requiredPrivilege: 'Create',
        context: 'HomePageGrid',
        description: 'Create a new record'
    },
    {
        id: 'Mscrm.DeleteSelectedRecord',
        name: 'Delete',
        requiredPrivilege: 'Delete',
        context: 'HomePageGrid',
        selectionRequired: true,
        description: 'Delete selected record(s)'
    },
    {
        id: 'Mscrm.EditSelectedRecord',
        name: 'Edit',
        requiredPrivilege: 'Write',
        context: 'HomePageGrid',
        selectionRequired: true,
        description: 'Edit selected record'
    },
    {
        id: 'Mscrm.ActivateSelectedRecord',
        name: 'Activate',
        requiredPrivilege: 'Write',
        context: 'HomePageGrid',
        selectionRequired: true,
        description: 'Activate selected record(s)'
    },
    {
        id: 'Mscrm.DeactivateSelectedRecord',
        name: 'Deactivate',
        requiredPrivilege: 'Write',
        context: 'HomePageGrid',
        selectionRequired: true,
        description: 'Deactivate selected record(s)'
    },
    {
        id: 'Mscrm.AssignSelectedRecord',
        name: 'Assign',
        requiredPrivilege: 'Assign',
        context: 'HomePageGrid',
        selectionRequired: true,
        description: 'Assign selected record to user/team'
    },
    {
        id: 'Mscrm.ShareSelectedRecord',
        name: 'Share',
        requiredPrivilege: 'Share',
        context: 'HomePageGrid',
        selectionRequired: true,
        description: 'Share selected record with users/teams'
    },
    {
        id: 'Mscrm.ExportToExcel',
        name: 'Export to Excel',
        requiredPrivilege: 'Read',
        context: 'HomePageGrid',
        miscPrivilege: 'prvExportToExcel',
        description: 'Export grid data to Excel'
    },
    {
        id: 'Mscrm.ImportFromExcel',
        name: 'Import from Excel',
        requiredPrivilege: 'Create',
        context: 'HomePageGrid',
        miscPrivilege: 'prvImportExportData',
        description: 'Import data from Excel'
    },
    {
        id: 'Mscrm.RefreshGrid',
        name: 'Refresh',
        requiredPrivilege: 'Read',
        context: 'HomePageGrid',
        description: 'Refresh the grid data'
    },
    {
        id: 'Mscrm.OpenCharts',
        name: 'Show Chart',
        requiredPrivilege: 'Read',
        context: 'HomePageGrid',
        description: 'Show/hide chart pane'
    },
    {
        id: 'Mscrm.Grid.RunWorkflow',
        name: 'Run Workflow',
        requiredPrivilege: 'Read',
        context: 'HomePageGrid',
        selectionRequired: true,
        description: 'Run workflow on selected records'
    },
    {
        id: 'Mscrm.Grid.AddConnection',
        name: 'Connect',
        requiredPrivilege: 'Append',
        context: 'HomePageGrid',
        entityProperty: 'IsConnectionsEnabled',
        selectionRequired: true,
        description: 'Add connection to selected record'
    },
    {
        id: 'Mscrm.MergeSelectedRecord',
        name: 'Merge',
        requiredPrivilege: 'Write',
        context: 'HomePageGrid',
        selectionRequired: true,
        selectionCount: 2,
        description: 'Merge two records into one'
    },
    {
        id: 'Mscrm.Grid.EmailALink',
        name: 'Email a Link',
        requiredPrivilege: 'Read',
        context: 'HomePageGrid',
        selectionRequired: true,
        description: 'Email a link to selected record'
    },
    {
        id: 'Mscrm.Grid.CopyShortcut',
        name: 'Copy Link',
        requiredPrivilege: 'Read',
        context: 'HomePageGrid',
        selectionRequired: true,
        description: 'Copy record URL to clipboard'
    },

    // View management commands
    {
        id: 'Mscrm.CreateView',
        name: 'Create View',
        requiredPrivilege: 'Create',
        context: 'HomePageGrid',
        entityOverride: 'savedquery',
        description: 'Create a new personal view'
    },
    {
        id: 'Mscrm.EditView',
        name: 'Edit View',
        requiredPrivilege: 'Write',
        context: 'HomePageGrid',
        entityOverride: 'savedquery',
        description: 'Edit the current view'
    },
    {
        id: 'Mscrm.DeleteView',
        name: 'Delete View',
        requiredPrivilege: 'Delete',
        context: 'HomePageGrid',
        entityOverride: 'savedquery',
        description: 'Delete a personal view'
    },
    {
        id: 'Mscrm.SaveAsView',
        name: 'Save View As',
        requiredPrivilege: 'Create',
        context: 'HomePageGrid',
        entityOverride: 'userquery',
        description: 'Save current filters as a new view'
    },

    // ========================================
    // SUBGRID COMMANDS - Related records grid
    // ========================================
    {
        id: 'Mscrm.AddNewRecordFromSubGrid',
        name: 'Add New',
        requiredPrivilege: 'Create',
        context: 'SubGrid',
        description: 'Create a new related record'
    },
    {
        id: 'Mscrm.AddExistingRecordFromSubGrid',
        name: 'Add Existing',
        requiredPrivilege: 'Append',
        context: 'SubGrid',
        description: 'Associate an existing record'
    },
    {
        id: 'Mscrm.DeleteSelectedFromSubGrid',
        name: 'Delete',
        requiredPrivilege: 'Delete',
        context: 'SubGrid',
        selectionRequired: true,
        description: 'Delete selected related record'
    },
    {
        id: 'Mscrm.RemoveSelectedFromSubGrid',
        name: 'Remove',
        requiredPrivilege: 'Append',
        context: 'SubGrid',
        selectionRequired: true,
        description: 'Remove record association (N:N)'
    },
    {
        id: 'Mscrm.EditSelectedFromSubGrid',
        name: 'Edit',
        requiredPrivilege: 'Write',
        context: 'SubGrid',
        selectionRequired: true,
        description: 'Edit selected related record'
    },

    // ========================================
    // ACTIVITY COMMANDS - Activity-specific
    // ========================================
    {
        id: 'Mscrm.CreateTask',
        name: 'Task',
        requiredPrivilege: 'Create',
        context: 'HomePageGrid',
        entityOverride: 'task',
        description: 'Create a new task'
    },
    {
        id: 'Mscrm.CreateEmail',
        name: 'Email',
        requiredPrivilege: 'Create',
        context: 'HomePageGrid',
        entityOverride: 'email',
        description: 'Create a new email'
    },
    {
        id: 'Mscrm.CreatePhoneCall',
        name: 'Phone Call',
        requiredPrivilege: 'Create',
        context: 'HomePageGrid',
        entityOverride: 'phonecall',
        description: 'Create a new phone call'
    },
    {
        id: 'Mscrm.CreateAppointment',
        name: 'Appointment',
        requiredPrivilege: 'Create',
        context: 'HomePageGrid',
        entityOverride: 'appointment',
        description: 'Create a new appointment'
    },
    {
        id: 'Mscrm.CreateLetter',
        name: 'Letter',
        requiredPrivilege: 'Create',
        context: 'HomePageGrid',
        entityOverride: 'letter',
        description: 'Create a new letter'
    },
    {
        id: 'Mscrm.CreateFax',
        name: 'Fax',
        requiredPrivilege: 'Create',
        context: 'HomePageGrid',
        entityOverride: 'fax',
        description: 'Create a new fax'
    },

    // ========================================
    // QUEUE COMMANDS - Queue-specific
    // ========================================
    {
        id: 'Mscrm.AddToQueue',
        name: 'Add to Queue',
        requiredPrivilege: 'Write',
        context: 'HomePageGrid',
        entityProperty: 'IsValidForQueue',
        selectionRequired: true,
        description: 'Add record to a queue'
    },
    {
        id: 'Mscrm.RouteToQueue',
        name: 'Route',
        requiredPrivilege: 'Write',
        context: 'HomePageGrid',
        entityProperty: 'IsValidForQueue',
        selectionRequired: true,
        description: 'Route record to a queue'
    },
    {
        id: 'Mscrm.PickFromQueue',
        name: 'Pick',
        requiredPrivilege: 'Write',
        context: 'HomePageGrid',
        entityProperty: 'IsValidForQueue',
        selectionRequired: true,
        description: 'Pick item from queue to work on'
    },
    {
        id: 'Mscrm.ReleaseToQueue',
        name: 'Release',
        requiredPrivilege: 'Write',
        context: 'HomePageGrid',
        entityProperty: 'IsValidForQueue',
        selectionRequired: true,
        description: 'Release item back to queue'
    },

    // ========================================
    // REPORT/DOCUMENT COMMANDS
    // ========================================
    {
        id: 'Mscrm.RunReport',
        name: 'Run Report',
        requiredPrivilege: 'Read',
        context: 'HomePageGrid',
        description: 'Run a report'
    },
    {
        id: 'Mscrm.Form.RunReport',
        name: 'Run Report',
        requiredPrivilege: 'Read',
        context: 'Form',
        description: 'Run a report from form'
    },
    {
        id: 'Mscrm.MailMerge',
        name: 'Mail Merge',
        requiredPrivilege: 'Read',
        context: 'HomePageGrid',
        entityProperty: 'IsMailMergeEnabled',
        description: 'Perform mail merge'
    },

    // ========================================
    // DUPLICATE DETECTION
    // ========================================
    {
        id: 'Mscrm.DetectDuplicates',
        name: 'Detect Duplicates',
        requiredPrivilege: 'Read',
        context: 'HomePageGrid',
        entityProperty: 'IsDuplicateDetectionEnabled',
        description: 'Detect duplicate records'
    },
    {
        id: 'Mscrm.Form.DetectDuplicates',
        name: 'Detect Duplicates',
        requiredPrivilege: 'Read',
        context: 'Form',
        entityProperty: 'IsDuplicateDetectionEnabled',
        description: 'Detect duplicates of current record'
    }
];

/**
 * Entity metadata properties that affect command visibility.
 * These properties determine if certain commands are available.
 */
const ENTITY_PROPERTIES_FOR_COMMANDS = [
    'HasNotes',              // Enables note/annotation commands
    'HasActivities',         // Enables activity commands
    'IsConnectionsEnabled',  // Enables connection commands
    'IsValidForQueue',       // Enables queue commands
    'IsMailMergeEnabled',    // Enables mail merge
    'IsDuplicateDetectionEnabled', // Enables duplicate detection
    'IsActivity',            // Is this an activity entity
    'IsValidForAdvancedFind' // Can appear in Advanced Find
];

/**
 * Command Bar Analysis Service - analyzes ribbon commands and compares visibility between users.
 */
/**
 * Cache for ribbon XML to avoid repeated slow API calls.
 * Key: `${entityLogicalName}:${locationFilter}`, Value: { xml: string, timestamp: number }
 */
const ribbonCache = new Map();

/**
 * Cache expiry time in milliseconds (10 minutes).
 */
const RIBBON_CACHE_EXPIRY_MS = 10 * 60 * 1000;

export const CommandBarAnalysisService = {

    /**
     * RibbonLocationFilters enum values for RetrieveEntityRibbon function.
     * Form = 1, HomepageGrid = 2, SubGrid = 4, All = 7
     */
    RIBBON_LOCATION_FILTERS: {
        Form: 'Form',
        HomepageGrid: 'HomepageGrid',
        SubGrid: 'SubGrid',
        All: 'All'
    },

    /**
     * Retrieves the complete ribbon definition for an entity using the RetrieveEntityRibbon function.
     * This returns ALL commands including OOTB, unmanaged, and custom commands.
     * Results are cached for 10 minutes to avoid repeated slow API calls.
     * @param {string} entityLogicalName - Entity logical name
     * @param {string} locationFilter - Location filter: 'Form' | 'HomepageGrid' | 'SubGrid' | 'All'
     * @param {Function} [getEntitySetName] - Entity set name resolver (unused, kept for API compatibility)
     * @param {boolean} [skipCache=false] - If true, bypass cache and force fresh retrieval
     * @returns {Promise<string|null>} The ribbon XML string, or null on error
     * @async
     */
    async retrieveEntityRibbon(entityLogicalName, locationFilter = 'All', _getEntitySetName = MetadataService.getEntitySetName, skipCache = false) {
        if (!entityLogicalName) {
            NotificationService.show('Entity name required for ribbon retrieval', 'warning');
            return null;
        }

        // Check cache first
        const cacheKey = `${entityLogicalName}:${locationFilter}`;
        if (!skipCache) {
            const cached = ribbonCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < RIBBON_CACHE_EXPIRY_MS) {
                // Using cached ribbon
                return cached.xml;
            }
        }

        try {
            // Call RetrieveEntityRibbon unbound function
            // The response contains CompressedEntityXml which is base64-encoded gzipped XML
            const globalContext = PowerAppsApiService.getGlobalContext();
            const baseUrl = `${globalContext.getClientUrl()}/api/data/v9.2`;
            const url = `${baseUrl}/RetrieveEntityRibbon(EntityName='${entityLogicalName}',RibbonLocationFilter=Microsoft.Dynamics.CRM.RibbonLocationFilters'${locationFilter}')`;

            const resp = await fetch(url, {
                method: 'GET',
                headers: Config.WEB_API_HEADERS.STANDARD
            });

            if (!resp.ok) {
                const body = await resp.text();
                throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${body}`);
            }

            const response = await resp.json();

            if (response?.CompressedEntityXml) {
                // Decompress the base64-encoded gzipped XML
                const decompressed = await this._decompressRibbonXml(response.CompressedEntityXml);

                // Store in cache
                ribbonCache.set(cacheKey, {
                    xml: decompressed,
                    timestamp: Date.now()
                });

                return decompressed;
            }

            return null;
        } catch (error) {
            NotificationService.show(`Failed to retrieve entity ribbon: ${error.message}`, 'error');
            return null;
        }
    },

    /**
     * Clears the ribbon cache for a specific entity or all entities.
     * @param {string|null} entityLogicalName - Entity to clear, or null to clear all
     */
    clearRibbonCache(entityLogicalName = null) {
        if (entityLogicalName) {
            for (const key of ribbonCache.keys()) {
                if (key.startsWith(`${entityLogicalName}:`)) {
                    ribbonCache.delete(key);
                }
            }
        } else {
            ribbonCache.clear();
        }
    },

    /**
     * Attempts to evaluate a custom JavaScript rule by calling the function.
     * This only works for the current user context - we cannot evaluate for the target user.
     * @param {string} library - JavaScript library name (e.g., 'SomeNamespace.SomeClass')
     * @param {string} functionName - Function name to call
     * @param {Object} primaryControl - Primary control (form context)
     * @returns {Object} Result with { evaluated, result, error }
     */
    tryEvaluateCustomRule(library, functionName, primaryControl = null) {
        const result = {
            evaluated: false,
            result: null,
            error: null,
            reason: 'Not evaluated'
        };

        if (!functionName) {
            result.reason = 'No function name provided';
            return result;
        }

        try {
            // Try to resolve the function from global scope
            const fullPath = library ? `${library}.${functionName}` : functionName;
            const parts = fullPath.split('.');

            let fn = window;
            for (const part of parts) {
                if (fn && typeof fn === 'object' && part in fn) {
                    fn = fn[part];
                } else {
                    result.reason = `Function ${fullPath} not found in global scope`;
                    return result;
                }
            }

            if (typeof fn !== 'function') {
                result.reason = `${fullPath} is not a function`;
                return result;
            }

            // Try to call the function
            // Custom rules typically receive primaryControl as the first parameter
            const context = primaryControl || PowerAppsApiService.getFormContext?.() || null;
            const ruleResult = fn(context);

            result.evaluated = true;
            result.result = Boolean(ruleResult);
            result.reason = ruleResult ? 'Rule passed' : 'Rule returned false';

        } catch (error) {
            result.error = error.message;
            result.reason = `Error evaluating: ${error.message}`;
        }

        return result;
    },

    /**
     * Decompresses base64-encoded gzipped ribbon XML.
     * @param {string} compressedBase64 - Base64-encoded gzipped content
     * @returns {Promise<string|null>} Decompressed XML string
     * @private
     * @async
     */
    async _decompressRibbonXml(compressedBase64) {
        try {
            // Decode base64 to binary
            const binaryString = atob(compressedBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Use DecompressionStream to decompress gzip
            const blob = new Blob([bytes]);
            const ds = new DecompressionStream('gzip');
            const decompressedStream = blob.stream().pipeThrough(ds);
            const decompressedBlob = await new Response(decompressedStream).blob();
            const text = await decompressedBlob.text();

            return text;
        } catch (error) {
            NotificationService.show(`Failed to decompress ribbon XML: ${error.message}`, 'error');
            return null;
        }
    },

    /**
     * Parses ribbon XML to extract all command buttons with their display/enable rules.
     * @param {string} ribbonXml - The ribbon XML string
     * @param {string} context - Context filter: 'Form' | 'HomePageGrid' | 'SubGrid'
     * @returns {Array<Object>} Array of parsed command definitions
     */
    parseRibbonXmlForCommands(ribbonXml, context = 'HomePageGrid') {
        if (!ribbonXml) {
            return [];
        }

        const commands = [];

        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(ribbonXml, 'text/xml');
            const buttons = xmlDoc.querySelectorAll('Button');

            buttons.forEach(button => {
                const commandId = button.getAttribute('Command');
                const buttonId = button.getAttribute('Id') || commandId;
                const labelText = button.getAttribute('LabelText') ||
                    button.getAttribute('Alt') ||
                    this._extractLabelFromId(buttonId);

                if (!commandId) {
                    return;
                }

                const commandDef = xmlDoc.querySelector(`CommandDefinition[Id="${commandId}"]`);
                const displayRules = this._extractRulesFromCommand(commandDef, 'DisplayRule', xmlDoc);
                const enableRules = this._extractRulesFromCommand(commandDef, 'EnableRule', xmlDoc);
                const matchesContext = this._commandMatchesContext(buttonId, context);

                if (!matchesContext) {
                    return;
                }

                commands.push({
                    id: commandId,
                    buttonId: buttonId,
                    name: labelText,
                    displayRules: displayRules,
                    enableRules: enableRules,
                    isOOTB: commandId.startsWith('Mscrm.') || buttonId.startsWith('Mscrm.'),
                    allRules: [...displayRules, ...enableRules]
                });
            });

            const commandDefs = xmlDoc.querySelectorAll('CommandDefinition');
            commandDefs.forEach(cmdDef => {
                const commandId = cmdDef.getAttribute('Id');
                if (!commandId) {
                    return;
                }

                if (commands.some(c => c.id === commandId)) {
                    return;
                }

                const matchesContext = this._commandMatchesContext(commandId, context);
                if (!matchesContext) {
                    return;
                }

                const displayRules = this._extractRulesFromCommand(cmdDef, 'DisplayRule', xmlDoc);
                const enableRules = this._extractRulesFromCommand(cmdDef, 'EnableRule', xmlDoc);

                commands.push({
                    id: commandId,
                    buttonId: commandId,
                    name: this._extractLabelFromId(commandId),
                    displayRules: displayRules,
                    enableRules: enableRules,
                    isOOTB: commandId.startsWith('Mscrm.'),
                    allRules: [...displayRules, ...enableRules]
                });
            });

        } catch (error) {
            NotificationService.show(`Failed to parse ribbon XML: ${error.message}`, 'error');
        }

        return commands;
    },

    /**
     * Extracts rule references from a command definition.
     * @param {Element|null} commandDef - The CommandDefinition element
     * @param {string} ruleType - 'DisplayRule' or 'EnableRule'
     * @param {Document} xmlDoc - The full XML document (for rule lookups)
     * @returns {Array<Object>} Array of rule objects with id and details
     * @private
     */
    _extractRulesFromCommand(commandDef, ruleType, xmlDoc) {
        const rules = [];
        if (!commandDef) {
            return rules;
        }

        // Find rule references within the command
        const ruleRefs = commandDef.querySelectorAll(`${ruleType}s ${ruleType}`);
        ruleRefs.forEach(ref => {
            const ruleId = ref.getAttribute('Id');
            if (!ruleId) {
                return;
            }

            // Try to find the full rule definition
            const ruleDef = xmlDoc.querySelector(`${ruleType}Definition[Id="${ruleId}"]`) ||
                xmlDoc.querySelector(`${ruleType}[Id="${ruleId}"]`);

            const ruleDetails = this._parseRuleDefinition(ruleDef, ruleId);
            rules.push({
                id: ruleId,
                type: ruleDetails.type,
                details: ruleDetails,
                isCustom: !ruleId.startsWith('Mscrm.')
            });
        });

        return rules;
    },

    /**
     * Parses a rule definition element to extract its type and parameters.
     * @param {Element|null} ruleDef - The rule definition element
     * @param {string} ruleId - The rule ID (fallback for identification)
     * @returns {Object} Rule details
     * @private
     */
    _parseRuleDefinition(ruleDef, ruleId) {
        const details = {
            type: 'Unknown',
            privilege: null,
            entityName: null,
            isJavaScript: false,
            functionName: null,
            parameters: []
        };

        if (!ruleDef) {
            // Try to infer from rule ID
            if (PRIVILEGE_BASED_RULES[ruleId]) {
                details.type = 'EntityPrivilegeRule';
                details.privilege = PRIVILEGE_BASED_RULES[ruleId].privilege;
            } else if (ALWAYS_HIDE_RULES.includes(ruleId)) {
                details.type = 'AlwaysHide';
            } else if (ruleId.includes('CustomRule') || !ruleId.startsWith('Mscrm.')) {
                details.type = 'CustomRule';
                details.isJavaScript = true;
            }
            return details;
        }

        // Check for EntityPrivilegeRule
        const privilegeRule = ruleDef.querySelector('EntityPrivilegeRule');
        if (privilegeRule) {
            details.type = 'EntityPrivilegeRule';
            details.privilege = privilegeRule.getAttribute('PrivilegeType') ||
                privilegeRule.getAttribute('AppliesTo');
            details.entityName = privilegeRule.getAttribute('EntityName');
            return details;
        }

        // Check for CustomRule (JavaScript)
        const customRule = ruleDef.querySelector('CustomRule');
        if (customRule) {
            details.type = 'CustomRule';
            details.isJavaScript = true;
            details.functionName = customRule.getAttribute('FunctionName');
            details.library = customRule.getAttribute('Library');
            // Extract parameters
            const params = customRule.querySelectorAll('CrmParameter, StringParameter');
            params.forEach(p => {
                details.parameters.push({
                    type: p.tagName,
                    name: p.getAttribute('Name'),
                    value: p.getAttribute('Value')
                });
            });
            return details;
        }

        // Check for FormStateRule
        const formStateRule = ruleDef.querySelector('FormStateRule');
        if (formStateRule) {
            details.type = 'FormStateRule';
            details.state = formStateRule.getAttribute('State');
            return details;
        }

        // Check for SelectionCountRule
        const selectionRule = ruleDef.querySelector('SelectionCountRule');
        if (selectionRule) {
            details.type = 'SelectionCountRule';
            details.count = selectionRule.getAttribute('Minimum') ||
                selectionRule.getAttribute('Maximum');
            return details;
        }

        // Check for ValueRule
        const valueRule = ruleDef.querySelector('ValueRule');
        if (valueRule) {
            details.type = 'ValueRule';
            details.field = valueRule.getAttribute('Field');
            details.value = valueRule.getAttribute('Value');
            return details;
        }

        // Check for OrRule/AndRule containing other rules
        const orRule = ruleDef.querySelector('OrRule');
        const andRule = ruleDef.querySelector('AndRule');
        if (orRule || andRule) {
            details.type = orRule ? 'OrRule' : 'AndRule';
            details.isComposite = true;
        }

        return details;
    },

    /**
     * Determines if a command matches the specified context based on its ID.
     * @param {string} commandId - The command ID
     * @param {string} context - 'Form' | 'HomePageGrid' | 'SubGrid'
     * @returns {boolean} True if command matches context
     * @private
     */
    _commandMatchesContext(commandId, context) {
        const id = commandId.toLowerCase();

        // Form-specific commands
        if (context === 'Form') {
            return id.includes('form') ||
                id.includes('primary') ||
                id.includes('record') ||
                (!id.includes('grid') && !id.includes('subgrid') && !id.includes('homepage'));
        }

        // SubGrid-specific commands
        if (context === 'SubGrid') {
            return id.includes('subgrid') ||
                id.includes('associated') ||
                (id.includes('selected') && !id.includes('homepage'));
        }

        // HomePageGrid commands
        if (context === 'HomePageGrid') {
            return id.includes('grid') ||
                id.includes('homepage') ||
                id.includes('selected') ||
                id.includes('new') ||
                (!id.includes('form') && !id.includes('subgrid'));
        }

        return true;
    },

    /**
     * Extracts a human-readable label from a command ID.
     * @param {string} id - Command ID
     * @returns {string} Human-readable name
     * @private
     */
    _extractLabelFromId(id) {
        if (!id) {
            return 'Unknown';
        }

        // Remove common prefixes
        let name = id
            .replace(/^Mscrm\./i, '')
            .replace(/^Grid\./i, '')
            .replace(/^Form\./i, '')
            .replace(/^SubGrid\./i, '');

        // Split by dots and take the last meaningful part
        const parts = name.split('.');
        name = parts[parts.length - 1];

        // Convert camelCase/PascalCase to spaces
        name = name.replace(/([a-z])([A-Z])/g, '$1 $2');

        return name;
    },

    /**
     * Fetches all solutions in the environment.
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array<{solutionid: string, uniquename: string, friendlyname: string, publisherid: string}>>}
     * @async
     */
    async getSolutions(getEntitySetName = MetadataService.getEntitySetName) {
        try {
            const response = await WebApiService.webApiFetch(
                'GET',
                'solutions?$select=solutionid,uniquename,friendlyname,_publisherid_value,modifiedon',
                '',
                null,
                {},
                getEntitySetName
            );
            return (response?.value || []).map(s => ({
                solutionid: s.solutionid,
                uniquename: s.uniquename,
                friendlyname: s.friendlyname,
                publisherid: s._publisherid_value,
                modifiedon: s.modifiedon
            }));
        } catch (error) {
            NotificationService.show(`Failed to fetch solutions: ${error.message}`, 'error');
            return [];
        }
    },

    /**
     * Fetches all publishers in the environment.
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array<{publisherid: string, uniquename: string, friendlyname: string}>>}
     * @async
     */
    async getPublishers(getEntitySetName = MetadataService.getEntitySetName) {
        try {
            const response = await WebApiService.webApiFetch(
                'GET',
                'publishers?$select=publisherid,uniquename,friendlyname',
                '',
                null,
                {},
                getEntitySetName
            );
            return response?.value || [];
        } catch (error) {
            NotificationService.show(`Failed to fetch publishers: ${error.message}`, 'error');
            return [];
        }
    },

    /**
     * Fetches ribbon diffs for a specific entity and context.
     * @param {string|null} entityLogicalName - Entity logical name or null for global
     * @param {string} context - Context type: 'Form', 'HomePageGrid', 'SubGrid'
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array<RibbonDiff>>}
     * @async
     */
    async getRibbonDiffs(entityLogicalName, context = 'HomePageGrid', getEntitySetName = MetadataService.getEntitySetName) {
        try {
            // Build filter based on entity and context
            // difftype: 0=CustomAction, 1=HideCustomAction, 2=EnableRule, 3=LocLabel, etc.
            const tabIdFilter = `contains(tabid, '${context}')`;
            let entityFilter;

            if (entityLogicalName) {
                entityFilter = `(entity eq '${entityLogicalName}' or entity eq null)`;
            } else {
                entityFilter = 'entity eq null';
            }

            const filter = `${tabIdFilter} and ${entityFilter}`;

            const response = await WebApiService.webApiFetch(
                'GET',
                `ribbondiffs?$filter=${encodeURIComponent(filter)}&$select=ribbondiffid,solutionid,diffid,rdx,entity,difftype,tabid,ismanaged`,
                '',
                null,
                {},
                getEntitySetName
            );

            return response?.value || [];
        } catch (error) {
            NotificationService.show(`Failed to fetch ribbon diffs: ${error.message}`, 'error');
            return [];
        }
    },

    /**
     * Fetches hidden custom actions for a specific context.
     * These are commands that have been explicitly hidden.
     * @param {string|null} entityLogicalName - Entity logical name
     * @param {string} context - Context (Form, HomePageGrid, SubGrid)
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array<RibbonDiff>>}
     * @async
     */
    async getHiddenCustomActions(entityLogicalName, context = 'HomePageGrid', getEntitySetName = MetadataService.getEntitySetName) {
        try {
            const entityFilter = entityLogicalName
                ? `(entity eq '${entityLogicalName}' or entity eq null)`
                : 'entity eq null';

            const filter = `contains(rdx,'<HideCustomAction') and contains(tabid, '${context}') and difftype eq 0 and ${entityFilter}`;

            const response = await WebApiService.webApiFetch(
                'GET',
                `ribbondiffs?$filter=${encodeURIComponent(filter)}&$select=ribbondiffid,solutionid,diffid,rdx,entity`,
                '',
                null,
                {},
                getEntitySetName
            );

            return response?.value || [];
        } catch (error) {
            NotificationService.show(`Failed to fetch hidden actions: ${error.message}`, 'error');
            return [];
        }
    },

    /**
     * Fetches modern commanding (appaction) definitions for a specific context.
     * Modern commands are stored in the appaction table (introduced in newer Power Apps versions).
     * @param {string|null} entityLogicalName - Entity logical name
     * @param {string} context - Context (Form, HomePageGrid, SubGrid)
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array<Object>>}
     * @async
     */
    async getModernCommands(entityLogicalName, context = 'HomePageGrid', getEntitySetName = MetadataService.getEntitySetName) {
        try {
            // Map context to location enum values (0=Form, 1=Grid, 2=SubGrid, etc.)
            const locationMap = {
                'Form': 0,
                'HomePageGrid': 1,
                'SubGrid': 2
            };
            const location = locationMap[context] ?? 1;

            let filter = `location eq ${location} and statecode eq 0`;
            if (entityLogicalName) {
                filter += ` and (contextvalue eq '${entityLogicalName}' or context eq 2)`;
            } else {
                filter += ' and context eq 2';
            }

            const response = await WebApiService.webApiFetch(
                'GET',
                `appactions?$filter=${encodeURIComponent(filter)}&$select=appactionid,name,uniquename,buttonlabeltext,location,context,contextvalue,type,hidden,visibilitytype,visibilityformulafunctionname,solutionid,statecode,ismanaged`,
                '',
                null,
                {},
                getEntitySetName
            );

            return response?.value || [];
        } catch (_error) {
            NotificationService.show('Modern commands not available (appaction table may not exist in this environment)', 'warning');
            return [];
        }
    },

    /**
     * Parses ribbon diff XML to extract display and enable rules.
     * @param {string} rdx - The ribbon diff XML content
     * @returns {{displayRules: Array<string>, enableRules: Array<string>}}
     */
    parseRibbonDiffXml(rdx) {
        const displayRulesSet = new Set();
        const enableRulesSet = new Set();

        if (!rdx) {
            return { displayRules: [], enableRules: [] };
        }

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rdx, 'text/xml');

            // Extract all DisplayRule references (Set automatically handles duplicates)
            const displayRuleNodes = doc.querySelectorAll('DisplayRule');
            displayRuleNodes.forEach(node => {
                const id = node.getAttribute('Id');
                if (id) {
                    displayRulesSet.add(id);
                }
            });

            // Extract all EnableRule references
            const enableRuleNodes = doc.querySelectorAll('EnableRule');
            enableRuleNodes.forEach(node => {
                const id = node.getAttribute('Id');
                if (id) {
                    enableRulesSet.add(id);
                }
            });
        } catch (error) {
            NotificationService.show(`Failed to parse ribbon diff XML: ${error.message}`, 'error');
        }

        return { displayRules: Array.from(displayRulesSet), enableRules: Array.from(enableRulesSet) };
    },

    /**
     * Evaluates whether a privilege-based rule would pass for a user's privileges.
     * @param {string} ruleId - The rule identifier
     * @param {Object} userPrivileges - User's entity privileges object
     * @param {Object} _context - Additional context (formState, selection, etc.) - unused currently
     * @returns {{passes: boolean, reason: string, canEvaluate: boolean}}
     */
    evaluatePrivilegeRule(ruleId, userPrivileges, _context = {}) {
        // Check always-hide rules
        if (ALWAYS_HIDE_RULES.includes(ruleId)) {
            return { passes: false, reason: 'Rule always hides on modern UI', canEvaluate: true };
        }

        // Check always-show rules
        if (ALWAYS_SHOW_RULES.includes(ruleId)) {
            return { passes: true, reason: 'Rule always shows on modern UI', canEvaluate: true };
        }

        // Check privilege-based rules
        const privilegeConfig = PRIVILEGE_BASED_RULES[ruleId];
        if (privilegeConfig) {
            const privilegeKey = privilegeConfig.privilege.toLowerCase();
            const hasPrivilege = userPrivileges?.[privilegeKey]?.hasPrivilege ?? userPrivileges?.[privilegeKey] ?? false;

            return {
                passes: hasPrivilege,
                reason: hasPrivilege
                    ? `User has ${privilegeConfig.privilege} privilege`
                    : `User lacks ${privilegeConfig.privilege} privilege`,
                canEvaluate: true
            };
        }

        // Check form state rules
        const formStateRule = FORM_STATE_RULES[ruleId];
        if (formStateRule) {
            return {
                passes: true, // Assume passes for comparison purposes
                reason: `Form state rule: ${formStateRule.state} (context-dependent)`,
                canEvaluate: false
            };
        }

        // Check selection count rules
        if (SELECTION_COUNT_RULES.includes(ruleId)) {
            return {
                passes: true,
                reason: 'Selection count rule (context-dependent)',
                canEvaluate: false
            };
        }

        // Check org setting rules
        if (ORG_SETTING_RULES.includes(ruleId)) {
            return {
                passes: true,
                reason: 'Organization setting rule (applies to all users)',
                canEvaluate: false
            };
        }

        // Check miscellaneous privilege rules
        const miscPriv = MISC_PRIVILEGE_RULES[ruleId];
        if (miscPriv) {
            return {
                passes: true, // Would need to query specific miscellaneous privileges
                reason: `Miscellaneous privilege: ${miscPriv.privilege} (requires additional check)`,
                canEvaluate: false
            };
        }

        // Check for custom rules
        if (CUSTOM_RULE_PATTERN.test(ruleId)) {
            return {
                passes: true,
                reason: 'Custom JavaScript rule (cannot evaluate server-side)',
                canEvaluate: false
            };
        }

        // Check for value rules
        if (VALUE_RULE_PATTERN.test(ruleId)) {
            return {
                passes: true,
                reason: 'Value rule (depends on form field values)',
                canEvaluate: false
            };
        }

        // Check for record privilege rules
        if (RECORD_PRIVILEGE_RULE_PATTERN.test(ruleId)) {
            return {
                passes: true,
                reason: 'Record privilege rule (depends on specific record ownership)',
                canEvaluate: false
            };
        }

        // Unknown rule - cannot evaluate
        return {
            passes: true,
            reason: 'Custom/unknown rule - cannot evaluate',
            canEvaluate: false
        };
    },

    /**
     * Fetches entity metadata properties that affect command visibility.
     * @param {string} entityLogicalName - Entity logical name
     * @returns {Promise<Object>} Entity properties object
     * @private
     * @async
     */
    async _getEntityMetadataForCommands(entityLogicalName) {
        if (!entityLogicalName) {
            return {};
        }

        try {
            const selectProps = ENTITY_PROPERTIES_FOR_COMMANDS.join(',');
            const response = await WebApiService.webApiFetch(
                'GET',
                `EntityDefinitions(LogicalName='${entityLogicalName}')?$select=${selectProps}`,
                '',
                null,
                {}
            );

            return {
                HasNotes: response?.HasNotes ?? false,
                HasActivities: response?.HasActivities ?? false,
                IsConnectionsEnabled: response?.IsConnectionsEnabled ?? false,
                IsValidForQueue: response?.IsValidForQueue ?? false,
                IsMailMergeEnabled: response?.IsMailMergeEnabled ?? false,
                IsDuplicateDetectionEnabled: response?.IsDuplicateDetectionEnabled ?? false,
                IsActivity: response?.IsActivity ?? false,
                IsValidForAdvancedFind: response?.IsValidForAdvancedFind ?? true
            };
        } catch (error) {
            NotificationService.show(`Failed to get entity metadata: ${error.message}`, 'warning');
            return {};
        }
    },

    /**
     * Checks misc privileges for a user (e.g., prvExportToExcel, prvRunWorkflow).
     * @param {string|null} userId - User ID (null for current user)
     * @param {Array<string>} privileges - List of privilege names to check
     * @returns {Promise<Object>} Map of privilege name to boolean
     * @private
     * @async
     */
    async _checkMiscPrivileges(userId, privileges) {
        if (!privileges || privileges.length === 0) {
            return {};
        }

        const result = {};
        const gc = PowerAppsApiService.getGlobalContext();
        const effectiveUserId = userId || gc?.userSettings?.userId?.replace(/[{}]/g, '');

        if (!effectiveUserId) {
            for (const priv of privileges) {
                result[priv] = true;
            }
            return result;
        }

        // Check privileges in parallel
        const checks = privileges.map(async (priv) => {
            try {
                const response = await this._checkUserPrivilegeByName(effectiveUserId, priv);
                return { priv, hasPrivilege: response.hasPrivilege };
            } catch {
                return { priv, hasPrivilege: true };
            }
        });

        const results = await Promise.all(checks);
        for (const { priv, hasPrivilege } of results) {
            result[priv] = hasPrivilege;
        }

        return result;
    },

    /**
     * Gets security roles for a user.
     * @param {string|null} userId - User ID (null for current user)
     * @param {Function} getEntitySetName - Entity set name resolver
     * @returns {Promise<Array<{id: string, name: string}>>} Array of role objects
     * @private
     * @async
     */
    async _getUserSecurityRoles(userId, getEntitySetName = MetadataService.getEntitySetName) {
        try {
            const gc = PowerAppsApiService.getGlobalContext();
            const effectiveUserId = userId || gc?.userSettings?.userId?.replace(/[{}]/g, '');

            if (!effectiveUserId) {
                return [];
            }

            const response = await WebApiService.webApiFetch(
                'GET',
                `systemusers(${effectiveUserId})/systemuserroles_association?$select=roleid,name`,
                '',
                null,
                {},
                getEntitySetName
            );

            return (response?.value || []).map(r => ({
                id: r.roleid,
                name: r.name
            }));
        } catch (error) {
            NotificationService.show(`Failed to get user roles: ${error.message}`, 'warning');
            return [];
        }
    },

    /**
     * Gets team memberships for a user.
     * @param {string|null} userId - User ID (null for current user)
     * @param {Function} getEntitySetName - Entity set name resolver
     * @returns {Promise<Array<{id: string, name: string}>>} Array of team objects
     * @private
     * @async
     */
    async _getUserTeams(userId, getEntitySetName = MetadataService.getEntitySetName) {
        try {
            const gc = PowerAppsApiService.getGlobalContext();
            const effectiveUserId = userId || gc?.userSettings?.userId?.replace(/[{}]/g, '');

            if (!effectiveUserId) {
                return [];
            }

            const response = await WebApiService.webApiFetch(
                'GET',
                `systemusers(${effectiveUserId})/teammembership_association?$select=teamid,name`,
                '',
                null,
                {},
                getEntitySetName
            );

            return (response?.value || []).map(t => ({
                id: t.teamid,
                name: t.name
            }));
        } catch (error) {
            NotificationService.show(`Failed to get user teams: ${error.message}`, 'warning');
            return [];
        }
    },

    /**
     * Compares security context between two users (roles and teams).
     * @param {Array} currentUserRoles - Current user's roles
     * @param {Array} targetUserRoles - Target user's roles
     * @param {Array} currentUserTeams - Current user's teams
     * @param {Array} targetUserTeams - Target user's teams
     * @returns {Object} Comparison result with matching and differing items
     * @private
     */
    _compareSecurityContext(currentUserRoles, targetUserRoles, currentUserTeams, targetUserTeams) {
        const currentRoleIds = new Set(currentUserRoles.map(r => r.id));
        const targetRoleIds = new Set(targetUserRoles.map(r => r.id));
        const currentTeamIds = new Set(currentUserTeams.map(t => t.id));
        const targetTeamIds = new Set(targetUserTeams.map(t => t.id));

        // Find role differences
        const rolesOnlyCurrent = currentUserRoles.filter(r => !targetRoleIds.has(r.id));
        const rolesOnlyTarget = targetUserRoles.filter(r => !currentRoleIds.has(r.id));
        const rolesShared = currentUserRoles.filter(r => targetRoleIds.has(r.id));

        // Find team differences
        const teamsOnlyCurrent = currentUserTeams.filter(t => !targetTeamIds.has(t.id));
        const teamsOnlyTarget = targetUserTeams.filter(t => !currentTeamIds.has(t.id));
        const teamsShared = currentUserTeams.filter(t => targetTeamIds.has(t.id));

        const rolesMatch = rolesOnlyCurrent.length === 0 && rolesOnlyTarget.length === 0;
        const teamsMatch = teamsOnlyCurrent.length === 0 && teamsOnlyTarget.length === 0;

        return {
            rolesMatch,
            teamsMatch,
            securityContextMatch: rolesMatch && teamsMatch,
            roles: {
                shared: rolesShared,
                onlyCurrent: rolesOnlyCurrent,
                onlyTarget: rolesOnlyTarget
            },
            teams: {
                shared: teamsShared,
                onlyCurrent: teamsOnlyCurrent,
                onlyTarget: teamsOnlyTarget
            }
        };
    },

    /**
     * Collects misc privileges needed for standard commands in a given context.
     * @param {string} context - The context (Form, HomePageGrid, SubGrid)
     * @returns {Array<string>} List of misc privilege names
     * @private
     */
    _collectMiscPrivilegesForContext(context) {
        const miscPrivilegesNeeded = new Set();
        for (const cmd of STANDARD_COMMANDS) {
            if (cmd.context === context && cmd.miscPrivilege) {
                miscPrivilegesNeeded.add(cmd.miscPrivilege);
            }
        }
        return Array.from(miscPrivilegesNeeded);
    },

    /**
     * Fetches all data needed for command visibility comparison in parallel.
     * @param {string|null} currentUserId - Current user ID (null for current user)
     * @param {string} targetUserId - Target user ID
     * @param {string|null} entityLogicalName - Entity logical name
     * @param {string} context - Context (Form, HomePageGrid, SubGrid)
     * @param {Array<string>} miscPrivilegesList - List of misc privileges to check
     * @param {Function} getEntitySetName - Entity set name resolver
     * @returns {Promise<Object>} All fetched data
     * @private
     * @async
     */
    async _fetchComparisonData(currentUserId, targetUserId, entityLogicalName, context, miscPrivilegesList, getEntitySetName) {
        const [
            solutions,
            publishers,
            ribbonDiffs,
            modernCommands,
            hiddenActions,
            currentUserPrivileges,
            targetUserPrivileges,
            entityMetadata,
            currentUserMiscPrivileges,
            targetUserMiscPrivileges,
            currentUserRoles,
            targetUserRoles,
            currentUserTeams,
            targetUserTeams
        ] = await Promise.all([
            this.getSolutions(getEntitySetName),
            this.getPublishers(getEntitySetName),
            this.getRibbonDiffs(entityLogicalName, context, getEntitySetName),
            this.getModernCommands(entityLogicalName, context, getEntitySetName),
            this.getHiddenCustomActions(entityLogicalName, context, getEntitySetName),
            this._getUserEntityPrivileges(currentUserId, entityLogicalName, getEntitySetName),
            this._getUserEntityPrivileges(targetUserId, entityLogicalName, getEntitySetName),
            this._getEntityMetadataForCommands(entityLogicalName),
            this._checkMiscPrivileges(currentUserId, miscPrivilegesList),
            this._checkMiscPrivileges(targetUserId, miscPrivilegesList),
            this._getUserSecurityRoles(currentUserId, getEntitySetName),
            this._getUserSecurityRoles(targetUserId, getEntitySetName),
            this._getUserTeams(currentUserId, getEntitySetName),
            this._getUserTeams(targetUserId, getEntitySetName)
        ]);

        return {
            solutions,
            publishers,
            ribbonDiffs,
            modernCommands,
            hiddenActions,
            currentUserPrivileges,
            targetUserPrivileges,
            entityMetadata,
            currentUserMiscPrivileges,
            targetUserMiscPrivileges,
            currentUserRoles,
            targetUserRoles,
            currentUserTeams,
            targetUserTeams
        };
    },

    /**
     * Builds lookup maps for solutions, publishers, and hidden commands.
     * @param {Array} solutions - Solutions array
     * @param {Array} publishers - Publishers array
     * @param {Array} hiddenActions - Hidden actions array
     * @returns {Object} Lookup maps
     * @private
     */
    _buildLookupMaps(solutions, publishers, hiddenActions) {
        const solutionMap = new Map(solutions.map(s => [s.solutionid, s]));
        const publisherMap = new Map(publishers.map(p => [p.publisherid, p]));

        const hiddenCommandIds = new Set();
        hiddenActions.forEach(action => {
            const match = action.rdx?.match(/HideActionId="([^"]+)"/);
            if (match) {
                hiddenCommandIds.add(match[1]);
            }
        });

        return { solutionMap, publisherMap, hiddenCommandIds };
    },

    /**
     * Checks if entity property requirement is met for a standard command.
     * @param {Object} stdCmd - Standard command object
     * @param {Object} entityMetadata - Entity metadata
     * @returns {{met: boolean, reason: string|null}} Property check result
     * @private
     */
    _checkEntityPropertyRequirement(stdCmd, entityMetadata) {
        if (!stdCmd.entityProperty) {
            return { met: true, reason: null };
        }

        const met = entityMetadata[stdCmd.entityProperty] === true;
        const reason = met ? null : `Entity does not have ${stdCmd.entityProperty}`;
        return { met, reason };
    },

    /**
     * Evaluates privilege visibility for both users.
     * @param {Object} stdCmd - Standard command object
     * @param {Object} currentUserPrivileges - Current user privileges
     * @param {Object} targetUserPrivileges - Target user privileges
     * @param {Object} currentUserMiscPrivileges - Current user misc privileges
     * @param {Object} targetUserMiscPrivileges - Target user misc privileges
     * @returns {{currentCanSee: boolean, targetCanSee: boolean, currentBlocked: Array, targetBlocked: Array}} Visibility evaluation
     * @private
     */
    _evaluateStandardCommandVisibility(stdCmd, currentUserPrivileges, targetUserPrivileges, currentUserMiscPrivileges, targetUserMiscPrivileges) {
        const privilegeKey = stdCmd.requiredPrivilege.toLowerCase();
        const currentHasPriv = currentUserPrivileges?.[privilegeKey]?.hasPrivilege ?? false;
        const targetHasPriv = targetUserPrivileges?.[privilegeKey]?.hasPrivilege ?? false;

        let currentHasMiscPriv = true;
        let targetHasMiscPriv = true;
        if (stdCmd.miscPrivilege) {
            currentHasMiscPriv = currentUserMiscPrivileges[stdCmd.miscPrivilege] ?? true;
            targetHasMiscPriv = targetUserMiscPrivileges[stdCmd.miscPrivilege] ?? true;
        }

        const currentCanSee = currentHasPriv && currentHasMiscPriv;
        const targetCanSee = targetHasPriv && targetHasMiscPriv;

        const currentBlocked = [];
        const targetBlocked = [];
        if (!currentHasPriv) {
            currentBlocked.push(`Missing ${stdCmd.requiredPrivilege} privilege`);
        }
        if (!currentHasMiscPriv) {
            currentBlocked.push(`Missing ${stdCmd.miscPrivilege}`);
        }
        if (!targetHasPriv) {
            targetBlocked.push(`Missing ${stdCmd.requiredPrivilege} privilege`);
        }
        if (!targetHasMiscPriv) {
            targetBlocked.push(`Missing ${stdCmd.miscPrivilege}`);
        }

        return { currentCanSee, targetCanSee, currentBlocked, targetBlocked };
    },

    /**
     * Builds a standard command comparison object.
     * @param {Object} stdCmd - Standard command
     * @param {string|null} entityLogicalName - Entity logical name
     * @param {boolean} currentCanSee - Current user visibility
     * @param {boolean} targetCanSee - Target user visibility
     * @param {Array} currentBlocked - Current user blocked reasons
     * @param {Array} targetBlocked - Target user blocked reasons
     * @param {string} difference - Difference type
     * @returns {Object} Command comparison object
     * @private
     */
    _buildStandardCommandObject(stdCmd, entityLogicalName, currentCanSee, targetCanSee, currentBlocked, targetBlocked, difference) {
        return {
            commandId: stdCmd.id,
            commandName: stdCmd.name,
            description: stdCmd.description,
            entity: entityLogicalName || 'All Entities',
            solutionName: 'System (OOTB)',
            publisherName: 'Microsoft',
            isManaged: true,
            isStandardCommand: true,
            visibleToCurrentUser: currentCanSee,
            visibleToTargetUser: targetCanSee,
            currentUserBlockedBy: currentBlocked,
            targetUserBlockedBy: targetBlocked,
            difference,
            rules: [stdCmd.requiredPrivilege, stdCmd.miscPrivilege, stdCmd.entityProperty].filter(Boolean),
            selectionRequired: stdCmd.selectionRequired || false
        };
    },

    /**
     * Determines the visibility difference between two users.
     * @param {boolean} currentCanSee - Current user can see
     * @param {boolean} targetCanSee - Target user can see
     * @returns {string} Difference type: 'same', 'only-current', or 'only-target'
     * @private
     */
    _determineVisibilityDifference(currentCanSee, targetCanSee) {
        if (currentCanSee && !targetCanSee) {
            return 'only-current';
        }
        if (!currentCanSee && targetCanSee) {
            return 'only-target';
        }
        return 'same';
    },

    /**
     * Processes standard OOTB commands for the comparison.
     * @param {string} context - Context (Form, HomePageGrid, SubGrid)
     * @param {Set} hiddenCommandIds - Set of hidden command IDs
     * @param {Set} processedCommands - Set to track processed commands
     * @param {Object} entityMetadata - Entity metadata
     * @param {Object} currentUserPrivileges - Current user privileges
     * @param {Object} targetUserPrivileges - Target user privileges
     * @param {Object} currentUserMiscPrivileges - Current user misc privileges
     * @param {Object} targetUserMiscPrivileges - Target user misc privileges
     * @param {string|null} entityLogicalName - Entity logical name
     * @returns {Array} Array of command comparison objects
     * @private
     */
    _processStandardCommands(
        context, hiddenCommandIds, processedCommands, entityMetadata,
        currentUserPrivileges, targetUserPrivileges,
        currentUserMiscPrivileges, targetUserMiscPrivileges, entityLogicalName
    ) {
        const commandComparisons = [];

        for (const stdCmd of STANDARD_COMMANDS) {
            if (stdCmd.context !== context || processedCommands.has(stdCmd.id) || hiddenCommandIds.has(stdCmd.id)) {
                continue;
            }

            processedCommands.add(stdCmd.id);

            // Check entity property requirement
            const propertyCheck = this._checkEntityPropertyRequirement(stdCmd, entityMetadata);
            if (!propertyCheck.met) {
                commandComparisons.push(
                    this._buildStandardCommandObject(stdCmd, entityLogicalName, false, false, [propertyCheck.reason], [propertyCheck.reason], 'same')
                );
                continue;
            }

            // Evaluate visibility for both users
            const visibility = this._evaluateStandardCommandVisibility(
                stdCmd,
                currentUserPrivileges,
                targetUserPrivileges,
                currentUserMiscPrivileges,
                targetUserMiscPrivileges
            );

            const difference = this._determineVisibilityDifference(visibility.currentCanSee, visibility.targetCanSee);

            commandComparisons.push(
                this._buildStandardCommandObject(
                    stdCmd,
                    entityLogicalName,
                    visibility.currentCanSee,
                    visibility.targetCanSee,
                    visibility.currentBlocked,
                    visibility.targetBlocked,
                    difference
                )
            );
        }

        return commandComparisons;
    },

    /**
     * Evaluates rules for ribbon diff command.
     * @param {Array} allRules - All rules to evaluate
     * @param {Object} currentUserPrivileges - Current user privileges
     * @param {Object} targetUserPrivileges - Target user privileges
     * @returns {{currentCanSee: boolean, targetCanSee: boolean, currentBlocked: Array, targetBlocked: Array, hasCustomRules: boolean, customRuleDetails: Array}} Rule evaluation result
     * @private
     */
    _evaluateRibbonDiffRules(allRules, currentUserPrivileges, targetUserPrivileges) {
        const currentUserBlocked = [];
        const targetUserBlocked = [];
        let currentUserCanSee = true;
        let targetUserCanSee = true;
        let hasCustomRules = false;
        const customRuleDetails = [];

        for (const ruleId of allRules) {
            const currentResult = this.evaluatePrivilegeRule(ruleId, currentUserPrivileges);
            const targetResult = this.evaluatePrivilegeRule(ruleId, targetUserPrivileges);

            if (currentResult.canEvaluate && targetResult.canEvaluate) {
                if (!currentResult.passes) {
                    currentUserCanSee = false;
                    currentUserBlocked.push(`${ruleId}: ${currentResult.reason}`);
                }
                if (!targetResult.passes) {
                    targetUserCanSee = false;
                    targetUserBlocked.push(`${ruleId}: ${targetResult.reason}`);
                }
            } else {
                hasCustomRules = true;
                customRuleDetails.push({
                    ruleId,
                    reason: currentResult.reason
                });
            }
        }

        return { currentUserCanSee, targetUserCanSee, currentUserBlocked, targetUserBlocked, hasCustomRules, customRuleDetails };
    },

    /**
     * Applies security context differences to blocked arrays.
     * @param {Object} securityComparison - Security context comparison
     * @param {Array} currentUserBlocked - Current user blocked array
     * @param {Array} targetUserBlocked - Target user blocked array
     * @private
     */
    _applySecurityContextBlocking(securityComparison, currentUserBlocked, targetUserBlocked) {
        if (securityComparison.roles.onlyCurrent.length > 0) {
            currentUserBlocked.push(`Has roles: ${securityComparison.roles.onlyCurrent.map(r => r.name).join(', ')}`);
        }
        if (securityComparison.roles.onlyTarget.length > 0) {
            targetUserBlocked.push(`Has roles: ${securityComparison.roles.onlyTarget.map(r => r.name).join(', ')}`);
        }
        if (securityComparison.teams.onlyCurrent.length > 0) {
            currentUserBlocked.push(`Member of teams: ${securityComparison.teams.onlyCurrent.map(t => t.name).join(', ')}`);
        }
        if (securityComparison.teams.onlyTarget.length > 0) {
            targetUserBlocked.push(`Member of teams: ${securityComparison.teams.onlyTarget.map(t => t.name).join(', ')}`);
        }
    },

    /**
     * Determines evaluation method and difference for ribbon diff commands.
     * @param {boolean} hasCustomRules - Whether command has custom rules
     * @param {boolean} currentUserCanSee - Current user visibility
     * @param {boolean} targetUserCanSee - Target user visibility
     * @param {Object} securityComparison - Security context comparison
     * @returns {{evaluationMethod: string, difference: string}} Evaluation result
     * @private
     */
    _determineRibbonDiffDifference(hasCustomRules, currentUserCanSee, targetUserCanSee, securityComparison) {
        let difference = 'same';
        let evaluationMethod = 'privilege-based';

        if (hasCustomRules) {
            if (securityComparison.securityContextMatch) {
                evaluationMethod = 'security-context-match';
            } else {
                evaluationMethod = 'security-context-differs';
            }
        }

        if (currentUserCanSee && !targetUserCanSee) {
            difference = 'only-current';
        } else if (!currentUserCanSee && targetUserCanSee) {
            difference = 'only-target';
        } else if (hasCustomRules && !securityComparison.securityContextMatch) {
            difference = 'potential-difference';
        }

        return { evaluationMethod, difference };
    },

    /**
     * Builds a ribbon diff command comparison object.
     * @param {string} commandId - Command ID
     * @param {string} commandName - Command name
     * @param {Object} diff - Ribbon diff object
     * @param {boolean} currentUserCanSee - Current user visibility
     * @param {boolean} targetUserCanSee - Target user visibility
     * @param {Array} currentUserBlocked - Current user blocked reasons
     * @param {Array} targetUserBlocked - Target user blocked reasons
     * @param {string} difference - Difference type
     * @param {Array} allRules - All rules
     * @param {boolean} hasCustomRules - Has custom rules flag
     * @param {Array} customRuleDetails - Custom rule details
     * @param {string} evaluationMethod - Evaluation method
     * @param {Map} solutionMap - Solution map
     * @param {Map} publisherMap - Publisher map
     * @returns {Object} Command comparison object
     * @private
     */
    _buildRibbonDiffCommandObject(
        commandId, commandName, diff, currentUserCanSee, targetUserCanSee,
        currentUserBlocked, targetUserBlocked, difference, allRules,
        hasCustomRules, customRuleDetails, evaluationMethod,
        solutionMap, publisherMap
    ) {
        const solution = solutionMap.get(diff.solutionid);
        const publisher = solution ? publisherMap.get(solution.publisherid) : null;

        return {
            commandId,
            commandName,
            entity: diff.entity || 'All Entities',
            solutionName: solution?.friendlyname || 'Unknown',
            publisherName: publisher?.friendlyname || 'Unknown',
            isManaged: diff.ismanaged,
            isStandardCommand: false,
            visibleToCurrentUser: currentUserCanSee,
            visibleToTargetUser: targetUserCanSee,
            currentUserBlockedBy: currentUserBlocked,
            targetUserBlockedBy: targetUserBlocked,
            difference,
            rules: allRules,
            hasCustomRules,
            customRuleDetails,
            evaluationMethod
        };
    },

    /**
     * Processes ribbon diff commands for the comparison.
     * @param {Array} ribbonDiffs - Ribbon diffs
     * @param {Set} hiddenCommandIds - Set of hidden command IDs
     * @param {Set} processedCommands - Set to track processed commands
     * @param {Object} currentUserPrivileges - Current user privileges
     * @param {Object} targetUserPrivileges - Target user privileges
     * @param {Object} securityComparison - Security context comparison
     * @param {Map} solutionMap - Solution map
     * @param {Map} publisherMap - Publisher map
     * @returns {Array} Array of command comparison objects
     * @private
     */
    _processRibbonDiffCommands(
        ribbonDiffs, hiddenCommandIds, processedCommands,
        currentUserPrivileges, targetUserPrivileges, securityComparison,
        solutionMap, publisherMap
    ) {
        const commandComparisons = [];

        for (const diff of ribbonDiffs) {
            const commandId = diff.diffid;

            if (processedCommands.has(commandId) || hiddenCommandIds.has(commandId)) {
                continue;
            }

            processedCommands.add(commandId);

            const { displayRules, enableRules } = this.parseRibbonDiffXml(diff.rdx);
            const allRules = [...displayRules, ...enableRules];

            // Evaluate all rules
            const ruleEval = this._evaluateRibbonDiffRules(allRules, currentUserPrivileges, targetUserPrivileges);

            // Apply security context blocking if needed
            if (ruleEval.hasCustomRules && !securityComparison.securityContextMatch) {
                this._applySecurityContextBlocking(securityComparison, ruleEval.currentUserBlocked, ruleEval.targetUserBlocked);
            }

            // Determine evaluation method and difference
            const result = this._determineRibbonDiffDifference(
                ruleEval.hasCustomRules,
                ruleEval.currentUserCanSee,
                ruleEval.targetUserCanSee,
                securityComparison
            );

            commandComparisons.push(
                this._buildRibbonDiffCommandObject(
                    commandId,
                    this._extractCommandName(diff.rdx, commandId),
                    diff,
                    ruleEval.currentUserCanSee,
                    ruleEval.targetUserCanSee,
                    ruleEval.currentUserBlocked,
                    ruleEval.targetUserBlocked,
                    result.difference,
                    allRules,
                    ruleEval.hasCustomRules,
                    ruleEval.customRuleDetails,
                    result.evaluationMethod,
                    solutionMap,
                    publisherMap
                )
            );
        }

        return commandComparisons;
    },

    /**
     * Determines visibility rules for modern command.
     * @param {Object} appAction - App action object
     * @returns {{hasVisibilityFormula: boolean, hasClassicRules: boolean, hasVisibilityRules: boolean}} Visibility rules info
     * @private
     */
    _determineModernCommandVisibilityRules(appAction) {
        const hasVisibilityFormula = appAction.visibilitytype === 1 && !!appAction.visibilityformulafunctionname;
        const hasClassicRules = appAction.visibilitytype === 2;
        const hasVisibilityRules = hasVisibilityFormula || hasClassicRules;
        return { hasVisibilityFormula, hasClassicRules, hasVisibilityRules };
    },

    /**
     * Builds modern command comparison object.
     * @param {string} commandId - Command ID
     * @param {Object} appAction - App action object
     * @param {string} difference - Difference type
     * @param {Array} currentUserBlocked - Current user blocked reasons
     * @param {Array} targetUserBlocked - Target user blocked reasons
     * @param {boolean} hasVisibilityFormula - Has visibility formula flag
     * @param {boolean} hasClassicRules - Has classic rules flag
     * @param {boolean} hasVisibilityRules - Has visibility rules flag
     * @param {Map} solutionMap - Solution map
     * @param {Map} publisherMap - Publisher map
     * @returns {Object} Command comparison object
     * @private
     */
    _buildModernCommandObject(
        commandId, appAction, difference, currentUserBlocked, targetUserBlocked,
        hasVisibilityFormula, hasClassicRules, hasVisibilityRules,
        solutionMap, publisherMap
    ) {
        const solution = solutionMap.get(appAction.solutionid);
        const publisher = solution ? publisherMap.get(solution.publisherid) : null;

        return {
            commandId,
            commandName: appAction.buttonlabeltext || appAction.name || appAction.uniquename,
            entity: appAction.contextvalue || 'All Entities',
            solutionName: solution?.friendlyname || 'Active',
            publisherName: publisher?.friendlyname || 'Default Publisher',
            isManaged: appAction.ismanaged || false,
            isStandardCommand: false,
            isModernCommand: true,
            visibleToCurrentUser: difference !== 'only-target',
            visibleToTargetUser: difference !== 'only-current',
            currentUserBlockedBy: currentUserBlocked,
            targetUserBlockedBy: targetUserBlocked,
            difference,
            rules: hasVisibilityFormula
                ? ['Visibility Formula']
                : hasClassicRules ? ['Classic Rules'] : [],
            hasCustomRules: hasVisibilityRules,
            customRuleDetails: hasVisibilityFormula
                ? [{ ruleId: 'VisibilityFormula', reason: 'Power Fx expression' }]
                : hasClassicRules
                    ? [{ ruleId: 'ClassicRules', reason: 'Legacy ribbon rules' }]
                    : [],
            evaluationMethod: hasVisibilityFormula
                ? 'power-fx-formula'
                : hasClassicRules ? 'classic-rules' : 'always-visible'
        };
    },

    /**
     * Processes modern commands for the comparison.
     * @param {Array} modernCommands - Modern commands (appaction)
     * @param {Set} hiddenCommandIds - Set of hidden command IDs
     * @param {Set} processedCommands - Set to track processed commands
     * @param {Object} securityComparison - Security context comparison
     * @param {Map} solutionMap - Solution map
     * @param {Map} publisherMap - Publisher map
     * @returns {Array} Array of command comparison objects
     * @private
     */
    _processModernCommands(
        modernCommands, hiddenCommandIds, processedCommands,
        securityComparison, solutionMap, publisherMap
    ) {
        const commandComparisons = [];

        for (const appAction of modernCommands) {
            const commandId = appAction.uniquename || appAction.appactionid;

            if (processedCommands.has(commandId) || hiddenCommandIds.has(commandId) || appAction.hidden) {
                continue;
            }

            processedCommands.add(commandId);

            const visibilityRules = this._determineModernCommandVisibilityRules(appAction);

            let difference = 'same';
            const currentUserBlocked = [];
            const targetUserBlocked = [];

            if (visibilityRules.hasVisibilityRules && !securityComparison.securityContextMatch) {
                difference = 'potential-difference';
                this._applySecurityContextBlocking(securityComparison, currentUserBlocked, targetUserBlocked);
            }

            commandComparisons.push(
                this._buildModernCommandObject(
                    commandId,
                    appAction,
                    difference,
                    currentUserBlocked,
                    targetUserBlocked,
                    visibilityRules.hasVisibilityFormula,
                    visibilityRules.hasClassicRules,
                    visibilityRules.hasVisibilityRules,
                    solutionMap,
                    publisherMap
                )
            );
        }

        return commandComparisons;
    },

    /**
     * Builds comprehensive summary of command comparison results.
     * @param {Array} commandComparisons - Array of command comparisons
     * @param {Set} hiddenCommandIds - Set of hidden command IDs
     * @param {string} context - Context
     * @param {string|null} entityLogicalName - Entity logical name
     * @param {Object} securityComparison - Security context comparison
     * @returns {Object} Summary object
     * @private
     */
    _buildComparisonSummary(commandComparisons, hiddenCommandIds, context, entityLogicalName, securityComparison) {
        const ootbCount = commandComparisons.filter(c => c.isStandardCommand).length;
        const customCount = commandComparisons.filter(c => !c.isStandardCommand).length;
        const managedCount = commandComparisons.filter(c => c.isManaged).length;
        const unmanagedCount = commandComparisons.filter(c => !c.isManaged && !c.isStandardCommand).length;
        const potentialDiffs = commandComparisons.filter(c => c.difference === 'potential-difference').length;

        return {
            totalCommands: commandComparisons.length,
            ootbCommands: ootbCount,
            customCommands: customCount,
            managedCommands: managedCount,
            unmanagedCommands: unmanagedCount,
            differences: commandComparisons.filter(c => c.difference === 'only-current' || c.difference === 'only-target').length,
            potentialDifferences: potentialDiffs,
            onlyCurrentUser: commandComparisons.filter(c => c.difference === 'only-current').length,
            onlyTargetUser: commandComparisons.filter(c => c.difference === 'only-target').length,
            sameVisibility: commandComparisons.filter(c => c.difference === 'same').length,
            hiddenCommands: hiddenCommandIds.size,
            context,
            entity: entityLogicalName || 'Global',
            securityComparison: {
                rolesMatch: securityComparison.rolesMatch,
                teamsMatch: securityComparison.teamsMatch,
                sharedRoles: securityComparison.roles.shared.length,
                rolesOnlyCurrent: securityComparison.roles.onlyCurrent,
                rolesOnlyTarget: securityComparison.roles.onlyTarget,
                sharedTeams: securityComparison.teams.shared.length,
                teamsOnlyCurrent: securityComparison.teams.onlyCurrent,
                teamsOnlyTarget: securityComparison.teams.onlyTarget
            }
        };
    },

    /**
     * Compares command bar visibility between two users for a specific entity.
     * Analyzes OOTB standard commands, custom ribbon commands, and dynamically retrieved commands.
     * @param {string} targetUserId - The user ID to compare against
     * @param {string|null} entityLogicalName - Entity to analyze (null for global)
     * @param {string} context - Context: 'Form' | 'HomePageGrid' | 'SubGrid'
     * @param {string|null} [comparisonUserId=null] - Comparison user ID (null for current user)
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<{commands: Array<CommandComparison>, summary: Object}>}
     * @async
     */
    async compareCommandBarVisibility(targetUserId, entityLogicalName, context = 'HomePageGrid', comparisonUserId = null, getEntitySetName = MetadataService.getEntitySetName) {
        try {
            const currentUserId = comparisonUserId;
            const miscPrivilegesList = this._collectMiscPrivilegesForContext(context);

            const data = await this._fetchComparisonData(
                currentUserId,
                targetUserId,
                entityLogicalName,
                context,
                miscPrivilegesList,
                getEntitySetName
            );

            const securityComparison = this._compareSecurityContext(
                data.currentUserRoles,
                data.targetUserRoles,
                data.currentUserTeams,
                data.targetUserTeams
            );

            const { solutionMap, publisherMap, hiddenCommandIds } = this._buildLookupMaps(
                data.solutions,
                data.publishers,
                data.hiddenActions
            );

            const processedCommands = new Set();

            // Process all command types
            const standardCommands = this._processStandardCommands(
                context,
                hiddenCommandIds,
                processedCommands,
                data.entityMetadata,
                data.currentUserPrivileges,
                data.targetUserPrivileges,
                data.currentUserMiscPrivileges,
                data.targetUserMiscPrivileges,
                entityLogicalName
            );

            const ribbonDiffCommands = this._processRibbonDiffCommands(
                data.ribbonDiffs,
                hiddenCommandIds,
                processedCommands,
                data.currentUserPrivileges,
                data.targetUserPrivileges,
                securityComparison,
                solutionMap,
                publisherMap
            );

            const modernCommandsList = this._processModernCommands(
                data.modernCommands,
                hiddenCommandIds,
                processedCommands,
                securityComparison,
                solutionMap,
                publisherMap
            );

            // Combine all commands
            const commandComparisons = [...standardCommands, ...ribbonDiffCommands, ...modernCommandsList];

            // Sort by difference priority
            commandComparisons.sort((a, b) => {
                const order = { 'only-current': 0, 'only-target': 1, 'potential-difference': 2, 'same': 3 };
                const orderDiff = (order[a.difference] ?? 3) - (order[b.difference] ?? 3);
                if (orderDiff !== 0) {
                    return orderDiff;
                }
                return a.commandId.localeCompare(b.commandId);
            });

            const summary = this._buildComparisonSummary(
                commandComparisons,
                hiddenCommandIds,
                context,
                entityLogicalName,
                securityComparison
            );

            return { commands: commandComparisons, summary };
        } catch (error) {
            NotificationService.show(`Command visibility comparison failed: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Extract command name from ribbon diff XML
     * @param {string} rdx - The ribbon diff XML content
     * @param {string} fallbackId - Fallback command ID if extraction fails
     * @returns {string} The extracted command name or fallback
     * @private
     */
    _extractCommandName(rdx, diffid) {
        if (!rdx) {
            return diffid;
        }

        try {
            // Try to extract LabelText from Button definitions
            const labelMatch = rdx.match(/LabelText="([^"]+)"/);
            if (labelMatch) {
                return labelMatch[1];
            }

            // Try to extract from LocLabel Title
            const titleMatch = rdx.match(/description="([^"]+)"/);
            if (titleMatch) {
                return titleMatch[1];
            }

            // Try to get button ID and make it readable
            const buttonMatch = diffid.match(/\.([^.]+)$/);
            if (buttonMatch) {
                return buttonMatch[1].replace(/([A-Z])/g, ' $1').trim();
            }
        } catch (_e) {
            // Fallback to diffid
        }

        return diffid;
    },

    /**
     * Gets entity privileges for a user using the RetrieveUserPrivilegeByPrivilegeName function.
     * This method properly includes privileges inherited from team memberships.
     * @param {string|null} userId - User ID (null for current user)
     * @param {string|null} entityLogicalName - Entity to check
     * @param {Function} [getEntitySetName] - Entity set name resolver (unused, kept for compatibility)
     * @returns {Promise<Object>} Privileges object with hasPrivilege flags
     * @private
     * @async
     */
    async _getUserEntityPrivileges(userId, entityLogicalName, getEntitySetName) {
        try {
            // Get current user ID if not provided
            if (!userId) {
                const gc = PowerAppsApiService.getGlobalContext();
                if (gc?.userSettings?.userId) {
                    userId = gc.userSettings.userId.replace(/[{}]/g, '');
                } else {
                    // Return empty privileges if we can't determine user ID
                    const privilegeVerbs = ['Read', 'Create', 'Write', 'Delete', 'Append', 'AppendTo', 'Assign', 'Share'];
                    const privileges = {};
                    for (const verb of privilegeVerbs) {
                        privileges[verb.toLowerCase()] = { hasPrivilege: false, depth: null };
                    }
                    return privileges;
                }
            }

            return await SecurityAnalysisService.getUserEntityPrivileges(userId, entityLogicalName, getEntitySetName);
        } catch (error) {
            NotificationService.show(`Failed to get user privileges: ${error.message}`, 'error');
            const privilegeVerbs = ['Read', 'Create', 'Write', 'Delete', 'Append', 'AppendTo', 'Assign', 'Share'];
            const privileges = {};
            for (const verb of privilegeVerbs) {
                privileges[verb.toLowerCase()] = { hasPrivilege: false, depth: null };
            }
            return privileges;
        }
    },

    /**
     * Gets the current page context (Form, Grid, etc.).
     * @returns {string} The context type
     */
    getCurrentContext() {
        try {
            if (PowerAppsApiService.isFormContextAvailable) {
                return 'Form';
            }

            // Check URL for grid context
            const url = window.location.href;
            if (url.includes('/main.aspx') && url.includes('pagetype=entitylist')) {
                return 'HomePageGrid';
            }

            // Default to grid
            return 'HomePageGrid';
        } catch (_e) {
            return 'HomePageGrid';
        }
    },

    /**
     * Gets the current entity context.
     * @returns {string|null} Entity logical name or null
     */
    getCurrentEntity() {
        try {
            if (PowerAppsApiService.isFormContextAvailable) {
                return PowerAppsApiService.getEntityName();
            }

            // Try to extract from URL
            const url = window.location.href;
            const entityMatch = url.match(/[?&]etn=([^&]+)/);
            if (entityMatch) {
                return entityMatch[1];
            }

            return null;
        } catch (_e) {
            return null;
        }
    },

    /**
     * Fetches security roles for a user.
     * @param {string} userId - The user ID
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array<{roleid: string, name: string}>>}
     * @async
     */
    async getUserRoles(userId, getEntitySetName = MetadataService.getEntitySetName) {
        try {
            // Query systemuserroles_association and roles
            const response = await WebApiService.webApiFetch(
                'GET',
                `systemusers(${userId})?$select=systemuserid&$expand=systemuserroles_association($select=roleid,name)`,
                '',
                null,
                {},
                getEntitySetName
            );

            return response?.systemuserroles_association || [];
        } catch (error) {
            NotificationService.show(`Failed to fetch user roles: ${error.message}`, 'error');
            return [];
        }
    },

    /**
     * Fetches team memberships for a user.
     * @param {string} userId - The user ID
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array<{teamid: string, name: string}>>}
     * @async
     */
    async getUserTeams(userId, getEntitySetName = MetadataService.getEntitySetName) {
        try {
            const response = await WebApiService.webApiFetch(
                'GET',
                `systemusers(${userId})?$select=systemuserid&$expand=teammembership_association($select=teamid,name)`,
                '',
                null,
                {},
                getEntitySetName
            );

            return response?.teammembership_association || [];
        } catch (error) {
            NotificationService.show(`Failed to fetch user teams: ${error.message}`, 'error');
            return [];
        }
    },

    /**
     * Compares security context between two users (roles, teams, business units).
     * @param {string} targetUserId - The target user ID to compare
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<{currentUser: Object, targetUser: Object, differences: Object}>}
     * @async
     */
    async compareUserSecurityContext(targetUserId, getEntitySetName = MetadataService.getEntitySetName) {
        try {
            // Get current user ID
            const gc = PowerAppsApiService.getGlobalContext();
            const currentUserId = gc?.userSettings?.userId?.replace(/[{}]/g, '');

            if (!currentUserId) {
                throw new Error('Could not determine current user ID');
            }

            // Fetch roles and teams in parallel
            const [
                currentUserRoles,
                targetUserRoles,
                currentUserTeams,
                targetUserTeams
            ] = await Promise.all([
                this.getUserRoles(currentUserId, getEntitySetName),
                this.getUserRoles(targetUserId, getEntitySetName),
                this.getUserTeams(currentUserId, getEntitySetName),
                this.getUserTeams(targetUserId, getEntitySetName)
            ]);

            // Compare roles
            const currentRoleIds = new Set(currentUserRoles.map(r => r.roleid));
            const targetRoleIds = new Set(targetUserRoles.map(r => r.roleid));
            const rolesOnlyCurrent = currentUserRoles.filter(r => !targetRoleIds.has(r.roleid));
            const rolesOnlyTarget = targetUserRoles.filter(r => !currentRoleIds.has(r.roleid));
            const rolesBoth = currentUserRoles.filter(r => targetRoleIds.has(r.roleid));

            // Compare teams
            const currentTeamIds = new Set(currentUserTeams.map(t => t.teamid));
            const targetTeamIds = new Set(targetUserTeams.map(t => t.teamid));
            const teamsOnlyCurrent = currentUserTeams.filter(t => !targetTeamIds.has(t.teamid));
            const teamsOnlyTarget = targetUserTeams.filter(t => !currentTeamIds.has(t.teamid));
            const teamsBoth = currentUserTeams.filter(t => targetTeamIds.has(t.teamid));

            return {
                currentUser: {
                    userId: currentUserId,
                    roles: currentUserRoles,
                    teams: currentUserTeams
                },
                targetUser: {
                    userId: targetUserId,
                    roles: targetUserRoles,
                    teams: targetUserTeams
                },
                differences: {
                    roles: {
                        onlyCurrent: rolesOnlyCurrent,
                        onlyTarget: rolesOnlyTarget,
                        both: rolesBoth,
                        hasDifferences: rolesOnlyCurrent.length > 0 || rolesOnlyTarget.length > 0
                    },
                    teams: {
                        onlyCurrent: teamsOnlyCurrent,
                        onlyTarget: teamsOnlyTarget,
                        both: teamsBoth,
                        hasDifferences: teamsOnlyCurrent.length > 0 || teamsOnlyTarget.length > 0
                    }
                }
            };
        } catch (error) {
            NotificationService.show(`Failed to compare security context: ${error.message}`, 'error');
            throw error;
        }
    }
};

export default CommandBarAnalysisService;
