/**
 * @file Centralized state management for the application.
 * @module core/Store
 * @description Handles the application's shared state, persistence to localStorage,
 * and a publish-subscribe system for components to react to state changes.
 */

import { Config } from '../constants/index.js';
// Imported from the module rather than the helpers barrel: the barrel pulls in the service layer,
// which would make the store depend on it.
import { normalizeHexColor } from '../helpers/color.helpers.js';

/**
 * Represents the configuration for a single feature tab.
 * @typedef {object} TabSetting
 * @property {string} id - The unique identifier for the tab component.
 * @property {boolean} visible - Whether the tab is currently visible in the UI.
 * @property {boolean} formOnly - Whether the tab should only be enabled on a record form.
 * @property {string|null} [color] - Optional `#rrggbb` accent for the tab, or null for none.
 */

/**
 * Represents the configuration for a single header button.
 * @typedef {object} HeaderButtonSetting
 * @property {string} id - The unique identifier for the header button.
 * @property {string} label - The display label for the button.
 * @property {boolean} visible - Whether the button is currently visible in the header.
 * @property {boolean} formOnly - Whether the button only works on a record form.
 */

/**
 * Represents the entire shared state of the application.
 * @typedef {object} AppState
 * @property {'light'|'dark'} theme - The current UI theme.
 * @property {TabSetting[]} tabSettings - The ordered list of tab configurations.
 * @property {HeaderButtonSetting[]} headerButtonSettings - The ordered list of header button configurations.
 * @property {object} dimensions - The saved dimensions (width/height) of the main dialog.
 * @property {string|null} impersonationUserId - The GUID of the currently impersonated user, if any.
 * @property {boolean} isMinimized - Whether the dialog is currently in minimized state.
 */

// --- Private state and listeners ---
let _state = {};
const _listeners = new Set();

/**
 * An array of state keys that should be persisted to localStorage.
 * To make a new piece of state persist, simply add its key to this array.
 * @private
 * @type {string[]}
 * @note Currently unused but kept for future persistence features
 */
// const PERSISTABLE_STATE_KEYS = ['theme', 'tabSettings', 'headerButtonSettings', 'dimensions', 'isMinimized'];

/**
 * Defines the default configuration for all available header buttons.
 * The order here determines the default display order.
 * @returns {Array<HeaderButtonSetting>} The default configuration for all header buttons.
 * @private
 */
function getDefaultHeaderButtonSettings() {
    return [
        { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
        { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
        { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
        { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
        { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
        { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
        { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
    ];
}

/**
 * Defines the default configuration for all available tabs.
 * @returns {Array<object>} The default configuration for all tabs.
 * @private
 */
function getDefaultTabSettings() {
    return [
        { id: 'inspector', visible: true, formOnly: true },
        { id: 'formColumns', visible: true, formOnly: true },
        { id: 'eventMonitor', visible: true, formOnly: true },
        { id: 'pluginContext', visible: true, formOnly: true },
        { id: 'performance', visible: true, formOnly: true },
        { id: 'automation', visible: true, formOnly: true },
        { id: 'powerAutomateFlows', visible: true, formOnly: false },
        { id: 'agents', visible: true, formOnly: false },
        { id: 'impersonate', visible: true, formOnly: false },
        { id: 'metadataBrowser', visible: true, formOnly: false },
        { id: 'solutionLayers', visible: true, formOnly: false },
        { id: 'apiExplorer', visible: true, formOnly: false },
        { id: 'fetchXmlTester', visible: true, formOnly: false },
        { id: 'customApi', visible: true, formOnly: false },
        { id: 'envVars', visible: true, formOnly: false },
        { id: 'traces', visible: true, formOnly: false },
        { id: 'userContext', visible: true, formOnly: false },
        { id: 'codeHub', visible: true, formOnly: false },
        { id: 'settings', visible: true, formOnly: false },
        { id: 'help', visible: true, formOnly: false },
        { id: 'coffee', visible: true, formOnly: false },
        { id: 'about', visible: true, formOnly: false }
    ];
}

/**
 * Returns tab settings with every color normalized to `#rrggbb` or null.
 *
 * Tab settings arrive from localStorage and from imported settings files, so the color has to be
 * validated before it can reach a stylesheet — an arbitrary string would otherwise be written
 * straight into a CSS custom property.
 * @param {Array<TabSetting>} settings - Raw tab settings.
 * @returns {Array<TabSetting>} Settings with sanitized colors.
 */
function sanitizeTabColors(settings) {
    if (!Array.isArray(settings)) {
        return [];
    }
    return settings.map(setting => ({ ...setting, color: normalizeHexColor(setting?.color) }));
}

/**
 * Manages the application's state.
 * @namespace
 */
export const Store = {
    /**
     * Normalizes the colors on a set of tab settings.
     * Exposed so callers handling untrusted settings (an imported file) can sanitize before saving.
     * @param {Array<TabSetting>} settings - Raw tab settings.
     * @returns {Array<TabSetting>} Settings with sanitized colors.
     */
    sanitizeTabColors(settings) {
        return sanitizeTabColors(settings);
    },

    /**
     * Gets the current state.
     * @returns {AppState} The current state object.
     */
    init() {
        const defaultSettings = getDefaultTabSettings();
        const savedSettingsRaw = localStorage.getItem(Config.STORAGE_KEYS.tabSettings);
        let finalSettings = defaultSettings;

        if (savedSettingsRaw) {
            try {
                const savedSettings = JSON.parse(savedSettingsRaw);
                const defaultMap = new Map(defaultSettings.map(s => [s.id, s]));
                const relevantSettings = savedSettings.filter(s => defaultMap.has(s.id));
                const relevantIds = new Set(relevantSettings.map(s => s.id));
                defaultSettings.forEach(def => {
                    if (!relevantIds.has(def.id)) {
                        relevantSettings.push(def);
                    }
                });
                finalSettings = relevantSettings;
            } catch (_e) {
                // Settings parse error is handled gracefully by falling back to defaults
            }
        }
        finalSettings = sanitizeTabColors(finalSettings);

        // Load header button settings
        const defaultHeaderSettings = getDefaultHeaderButtonSettings();
        const savedHeaderSettingsRaw = localStorage.getItem(Config.STORAGE_KEYS.headerButtonSettings);
        let finalHeaderSettings = defaultHeaderSettings;

        if (savedHeaderSettingsRaw) {
            try {
                const savedHeaderSettings = JSON.parse(savedHeaderSettingsRaw);
                const defaultHeaderMap = new Map(defaultHeaderSettings.map(s => [s.id, s]));
                const relevantHeaderSettings = savedHeaderSettings.filter(s => defaultHeaderMap.has(s.id));
                const relevantHeaderIds = new Set(relevantHeaderSettings.map(s => s.id));
                defaultHeaderSettings.forEach(def => {
                    if (!relevantHeaderIds.has(def.id)) {
                        relevantHeaderSettings.push(def);
                    }
                });
                finalHeaderSettings = relevantHeaderSettings;
            } catch (_e) {
                // Header settings parse error is handled gracefully by falling back to defaults
            }
        }

        _state = {
            theme: localStorage.getItem(Config.STORAGE_KEYS.theme) || 'dark',
            tabSettings: finalSettings,
            headerButtonSettings: finalHeaderSettings,
            dimensions: JSON.parse(localStorage.getItem(Config.STORAGE_KEYS.dimensions) || '{}'),
            impersonationUserId: null,
            isMinimized: JSON.parse(localStorage.getItem(Config.STORAGE_KEYS.isMinimized) || 'false'),
            preMinimizedDimensions: JSON.parse(localStorage.getItem(Config.STORAGE_KEYS.preMinimizedDimensions) || '{}'),
            minimizedBannerWidth: localStorage.getItem(Config.STORAGE_KEYS.minimizedBannerWidth) || null
        };
    },

    /**
     * Subscribes a listener function to state changes.
     * @param {(newState: AppState, oldState: AppState) => void} listener - The callback function to execute on state change.
     * @returns {() => void} An unsubscribe function to clean up the listener.
     */
    subscribe(listener) {
        _listeners.add(listener);
        return () => _listeners.delete(listener);
    },

    /**
     * Updates the state, persists it to localStorage, and notifies all listeners.
     * @param {Partial<AppState>} newState - An object with the new state properties to merge.
     * @returns {void}
     */
    setState(newState) {
        const oldState = { ..._state };
        // Every path that changes tab settings funnels through here — imports, the settings tab,
        // drag-and-drop — so sanitizing colors once at this choke point means no caller can put an
        // unvalidated value into the state or into localStorage.
        const nextState = newState.tabSettings !== undefined
            ? { ...newState, tabSettings: sanitizeTabColors(newState.tabSettings) }
            : newState;
        _state = { ..._state, ...nextState };

        // Persist specific state changes to localStorage using explicit, correct keys.
        if (nextState.theme !== undefined) {
            localStorage.setItem(Config.STORAGE_KEYS.theme, nextState.theme);
        }
        if (nextState.tabSettings !== undefined) {
            localStorage.setItem(Config.STORAGE_KEYS.tabSettings, JSON.stringify(nextState.tabSettings));
        }
        if (nextState.headerButtonSettings !== undefined) {
            localStorage.setItem(Config.STORAGE_KEYS.headerButtonSettings, JSON.stringify(nextState.headerButtonSettings));
        }
        if (nextState.dimensions !== undefined) {
            localStorage.setItem(Config.STORAGE_KEYS.dimensions, JSON.stringify(nextState.dimensions));
        }
        if (nextState.isMinimized !== undefined) {
            localStorage.setItem(Config.STORAGE_KEYS.isMinimized, JSON.stringify(nextState.isMinimized));
        }
        if (nextState.preMinimizedDimensions !== undefined) {
            localStorage.setItem(Config.STORAGE_KEYS.preMinimizedDimensions, JSON.stringify(nextState.preMinimizedDimensions));
        }
        if (nextState.minimizedBannerWidth !== undefined) {
            localStorage.setItem(Config.STORAGE_KEYS.minimizedBannerWidth, nextState.minimizedBannerWidth);
        }

        _listeners.forEach(listener => listener(_state, oldState));
    },

    /**
     * Gets the current state.
     * @returns {AppState} The current state object.
     */
    getState() {
        return _state;
    },

    /**
     * Resets all persistable state properties to their original default values and
     * clears them from localStorage.
     * @returns {void}
     */
    resetToDefaults() {
        const defaultSettings = getDefaultTabSettings();
        const defaultHeaderSettings = getDefaultHeaderButtonSettings();
        const defaultState = {
            theme: 'dark',
            tabSettings: defaultSettings,
            headerButtonSettings: defaultHeaderSettings,
            dimensions: {},
            isMinimized: false,
            preMinimizedDimensions: {},
            minimizedBannerWidth: null
        };

        // Clear all persisted items from localStorage explicitly.
        localStorage.removeItem('pdt-tab-settings');
        localStorage.removeItem('pdt-header-button-settings');
        localStorage.removeItem('pdt-theme');
        localStorage.removeItem('pdt-dimensions');
        localStorage.removeItem('pdt-is-minimized');
        localStorage.removeItem('pdt-pre-minimized-dimensions');
        localStorage.removeItem('pdt-minimized-banner-width');

        // Use setState with the full default state to ensure all listeners are properly notified.
        this.setState(defaultState);
    }
};