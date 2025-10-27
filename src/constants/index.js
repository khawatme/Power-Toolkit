/**
 * Central export point for all application constants.
 * Provides backward compatibility with the old Config object.
 * @module constants
 */

// Import all constants from individual modules
import * as App from './app.js';
import * as Dataverse from './dataverse.js';
import * as Plugin from './plugin.js';
import * as Storage from './storage.js';
import * as UI from './ui.js';
import * as Validation from './validation.js';
import * as Messages from './messages.js';

// Re-export everything as named exports for tree-shaking
export * from './app.js';
export * from './dataverse.js';
export * from './plugin.js';
export * from './storage.js';
export * from './ui.js';
export * from './validation.js';
export * from './messages.js';

/**
 * Unified configuration object that provides all application constants.
 * This object aggregates constants from individual modules for convenient access.
 * 
 * For tree-shaking optimization, you can use named imports:
 * @example
 * // Optimized (tree-shakeable)
 * import { TOOL_VERSION, MESSAGES } from '../constants';
 * 
 * // Also supported (convenience)
 * import { Config } from '../constants';
 * console.log(Config.TOOL_VERSION);
 */
export const Config = {
    // App metadata
    TOOL_VERSION: App.TOOL_VERSION,
    DEVELOPER_NAME: App.DEVELOPER_NAME,
    LICENSE_TEXT: App.LICENSE_TEXT,
    MAIN: App.MAIN,
    BASE_COMPONENT_DEFAULTS: App.BASE_COMPONENT_DEFAULTS,
    BASE_COMPONENT_ERRORS: App.BASE_COMPONENT_ERRORS,
    COMPONENT_REGISTRY_MESSAGES: App.COMPONENT_REGISTRY_MESSAGES,

    // Dataverse constants
    DATAVERSE_SPECIAL_ENDPOINTS: Dataverse.DATAVERSE_SPECIAL_ENDPOINTS,
    DATAVERSE_TYPES: Dataverse.DATAVERSE_TYPES,
    SYSTEM_FIELDS: Dataverse.SYSTEM_FIELDS,
    FIELD_TYPES: Dataverse.FIELD_TYPES,
    FORM_TYPES: Dataverse.FORM_TYPES,
    POWERAPPS_API_DEFAULTS: Dataverse.POWERAPPS_API_DEFAULTS,
    POWERAPPS_API_ERRORS: Dataverse.POWERAPPS_API_ERRORS,
    ENV_VAR_TYPES: Dataverse.ENV_VAR_TYPES,
    ENTITY_NAMES: Dataverse.ENTITY_NAMES,
    WEB_API_HEADERS: Dataverse.WEB_API_HEADERS,
    ERROR_INDICATORS: Dataverse.ERROR_INDICATORS,
    CACHE_KEY_PREFIXES: Dataverse.CACHE_KEY_PREFIXES,

    // Plugin constants
    PLUGIN_MESSAGES: Plugin.PLUGIN_MESSAGES,
    PLUGIN_STAGES: Plugin.PLUGIN_STAGES,

    // Storage constants
    STORAGE_KEYS: Storage.STORAGE_KEYS,

    // UI constants
    DIALOG_OVERLAY_ID: UI.DIALOG_OVERLAY_ID,
    XML_INDENT: UI.XML_INDENT,
    DIALOG_CLASSES: UI.DIALOG_CLASSES,
    DIALOG_TITLES: UI.DIALOG_TITLES,
    NOTIFICATION_CONTAINER_ID: UI.NOTIFICATION_CONTAINER_ID,
    NOTIFICATION_COLORS: UI.NOTIFICATION_COLORS,
    NOTIFICATION_TIMINGS: UI.NOTIFICATION_TIMINGS,
    NOTIFICATION_STYLES: UI.NOTIFICATION_STYLES,
    FORM_CONTROL_LABELS: UI.FORM_CONTROL_LABELS,
    METADATA_BROWSER_DIALOG: UI.METADATA_BROWSER_DIALOG,
    UI_FACTORY: UI.UI_FACTORY,
    COMMON_PLACEHOLDERS: UI.COMMON_PLACEHOLDERS,

    // Validation constants
    VALIDATION_ERRORS: Validation.VALIDATION_ERRORS,

    // Messages (grouped under MESSAGES for backward compatibility)
    MESSAGES: {
        COMMON: Messages.COMMON,
        UI: Messages.UI,
        ENV_VARS: Messages.ENV_VARS,
        AUTOMATION: Messages.AUTOMATION,
        FETCHXML: Messages.FETCHXML,
        WEB_API: Messages.WEB_API,
        DATA_SERVICE: Messages.DATA_SERVICE,
        UI_MANAGER: Messages.UI_MANAGER,
        FORM_COLUMNS: Messages.FORM_COLUMNS,
        INSPECTOR: Messages.INSPECTOR,
        SETTINGS: Messages.SETTINGS,
        HELPERS: Messages.HELPERS,
        PLUGIN_CONTEXT: Messages.PLUGIN_CONTEXT,
        PLUGIN_TRACE: Messages.PLUGIN_TRACE,
        METADATA_BROWSER: Messages.METADATA_BROWSER,
        USER_CONTEXT: Messages.USER_CONTEXT,
        PERFORMANCE: Messages.PERFORMANCE,
        IMPERSONATE: Messages.IMPERSONATE,
        EVENT_MONITOR: Messages.EVENT_MONITOR
    }
};
