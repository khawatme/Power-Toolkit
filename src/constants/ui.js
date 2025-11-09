/**
 * UI-related constants including dialogs, notifications, and form controls.
 * @module constants/ui
 */

/**
 * Dialog overlay element ID used throughout the application.
 * @type {string}
 */
export const DIALOG_OVERLAY_ID = 'pdt-dialog-overlay';

/**
 * XML formatting indentation (2 spaces).
 * @type {string}
 */
export const XML_INDENT = '  ';

/**
 * CSS class names used for dialog components.
 * @type {Object.<string, string>}
 */
export const DIALOG_CLASSES = {
    overlay: 'pdt-dialog-overlay',
    dialog: 'pdt-dialog',
    header: 'pdt-dialog-header',
    title: 'pdt-dialog-title',
    closeBtn: 'pdt-close-btn',
    iconBtn: 'pdt-icon-btn',
    content: 'pdt-dialog-content',
    footer: 'pdt-dialog-footer',
    okBtn: 'pdt-dialog-ok',
    cancelBtn: 'pdt-dialog-cancel'
};

/**
 * Dialog title constants used throughout the application.
 * @type {Object.<string, string>}
 */
export const DIALOG_TITLES = {
    error: 'Error',
    confirm: 'Confirm',
    info: 'Information',
    warning: 'Warning',
    confirmDelete: 'Confirm Deletion',
    selectTable: 'Select a Table',
    selectColumn: 'Select a Column',
    selectSolution: 'Select Solution',
    newEnvVar: 'New Environment Variable',
    editValue: 'Edit Value',
    editLookup: 'Edit Lookup',
    csharpTest: 'C# Test Harness',
    jsonExport: 'JSON Export',
    license: 'MIT License',
    tableRequired: 'Select a Table First',
    invalidTableName: 'Invalid Table Name',
    tableNameRequired: 'Table Name Required',
    propertyInspector: 'Property Inspector'
};

/**
 * Minimize service configuration and constants.
 * @type {Object}
 */
export const MINIMIZE_SERVICE = {
    classes: {
        minimized: 'pdt-minimized'
    },
    tooltip: {
        minimize: 'Minimize',
        restore: 'Restore'
    },
    animation: {
        duration: 250
    },
    viewport: {
        margin: 20  // Minimum distance from viewport edges (px)
    },
    keyboard: {
        shortcut: 'm',  // Key for keyboard shortcut (Ctrl/Cmd + M)
        modifiers: ['ctrlKey', 'metaKey']  // Required modifier keys
    },
    messages: {
        minimizeFailed: 'Failed to minimize toolkit. Please try again.',
        restoreFailed: 'Failed to restore toolkit. Please try again.',
        initFailed: 'Failed to initialize minimize feature.',
        buttonNotFound: 'Minimize button not found in dialog.'
    }
};

/**
 * Notification container element ID.
 * @type {string}
 */
export const NOTIFICATION_CONTAINER_ID = 'pdt-notification-container';

/**
 * Color mappings for notification types using CSS custom properties.
 * @type {Object.<string, string>}
 */
export const NOTIFICATION_COLORS = {
    success: 'var(--pro-success)',
    error: 'var(--pro-error)',
    warn: 'var(--pro-warn)',
    info: '#333333'
};

/**
 * Timing values for notification animations in milliseconds.
 * @type {Object.<string, number>}
 */
export const NOTIFICATION_TIMINGS = {
    duration: 3500,        // How long notification is visible
    fadeIn: 10,            // Delay before fade-in animation starts
    fadeOut: 500           // Duration of fade-out transition
};

/**
 * Style configuration for notification container.
 * @type {Object.<string, string|number>}
 */
export const NOTIFICATION_STYLES = {
    zIndex: 10002,
    padding: '20px',
    gap: '10px'
};

/**
 * Form control factory constants for input placeholders and labels.
 * @type {Object.<string, string>}
 */
export const FORM_CONTROL_LABELS = {
    clearValue: '--- (Clear Value) ---',
    optionsetPlaceholder: 'Enter integer value...',
    requiredLevel: {
        required: 'required',
        none: 'none'
    }
};

/**
 * Metadata browser dialog constants for titles and messages.
 * @type {Object.<string, string|Function>}
 */
export const METADATA_BROWSER_DIALOG = {
    errorTitle: 'Error',
    errorMessage: '<p>A table name must be provided before browsing for columns.</p>',
    loadingMessage: '<p class="pdt-note">Loading metadata...</p>',
    titleEntity: 'Select a Table',
    titleAttribute: (entityName) => `Select a Column for ${entityName}`,
    placeholderEntity: 'Search for a table...',
    placeholderAttribute: 'Search for a column...',
    headerDisplayName: 'Display Name',
    headerLogicalName: 'Logical Name',
    clickToSelect: 'Click to select'
};

/**
 * UI Factory constants for UI elements and messages.
 * @type {Object.<string, string>}
 */
export const UI_FACTORY = {
    copyButtonText: 'Copy',
    copySuccessMessage: 'Code snippet copied!',
    formDisabledIcon: '📄',
    formDisabledTitle: 'Form Context Required',
    formDisabledMessage: 'This feature is only available when viewing a record form.'
};

/**
 * Commonly-reused placeholder text for input fields.
 * @type {Object.<string, string>}
 */
export const COMMON_PLACEHOLDERS = {
    searchTables: 'Search tables...',
    searchColumns: 'Search columns...',
    entityExample: 'e.g., account',
    contactExample: 'e.g., contact',
    guid: '00000000-0000-0000-0000-000000000000',
    attribute: 'Attribute',
    value: 'Value',
    optional: '(optional)',
    searchByName: 'Type Name contains...',
    searchByContent: 'Trace content contains...'
};
