/**
 * @file Centralized state management for the application.
 * @module core/Store
 * @description Handles the application's shared state, persistence to localStorage,
 * and a publish-subscribe system for components to react to state changes.
 */

/**
 * Represents the configuration for a single feature tab.
 * @typedef {object} TabSetting
 * @property {string} id - The unique identifier for the tab component.
 * @property {boolean} visible - Whether the tab is currently visible in the UI.
 * @property {boolean} formOnly - Whether the tab should only be enabled on a record form.
 */

/**
 * Represents the entire shared state of the application.
 * @typedef {object} AppState
 * @property {'light'|'dark'} theme - The current UI theme.
 * @property {TabSetting[]} tabSettings - The ordered list of tab configurations.
 * @property {object} dimensions - The saved dimensions (width/height) of the main dialog.
 * @property {string|null} impersonationUserId - The GUID of the currently impersonated user, if any.
 */

// --- Private state and listeners ---
let _state = {};
const _listeners = new Set();

/**
 * An array of state keys that should be persisted to localStorage.
 * To make a new piece of state persist, simply add its key to this array.
 * @private
 * @type {string[]}
 */
const PERSISTABLE_STATE_KEYS = ['theme', 'tabSettings', 'dimensions'];

/**
 * Defines the default configuration for all available tabs.
 * @returns {Array<object>} The default configuration for all tabs.
 * @private
 */
function getDefaultTabSettings() {
    return [
        { id: 'inspector', visible: true, formOnly: true },
        { id: 'formColumns', visible: true, formOnly: true },
        { id: 'automation', visible: true, formOnly: true },
        { id: 'eventMonitor', visible: true, formOnly: true },
        { id: 'pluginContext', visible: true, formOnly: true },
        { id: 'impersonate', visible: true, formOnly: false },
        { id: 'metadataBrowser', visible: true, formOnly: false },
        { id: 'apiExplorer', visible: true, formOnly: false },
        { id: 'fetchXmlTester', visible: true, formOnly: false },
        { id: 'envVars', visible: true, formOnly: false },
        { id: 'traces', visible: true, formOnly: false },
        { id: 'userContext', visible: true, formOnly: false },
        { id: 'codeHub', visible: true, formOnly: false },
        { id: 'performance', visible: true, formOnly: true },
        { id: 'settings', visible: true, formOnly: false },
        { id: 'help', visible: true, formOnly: false },
        { id: 'coffee', visible: true, formOnly: false },
        { id: 'about', visible: true, formOnly: false },
    ];
}

/**
 * Manages the application's state.
 * @namespace
 */
export const Store = {
    /**
     * Gets the current state.
     * @returns {AppState} The current state object.
     */
    init() {
        const defaultSettings = getDefaultTabSettings();
        const savedSettingsRaw = localStorage.getItem('pdt-tab-settings');
        let finalSettings = defaultSettings;

        if (savedSettingsRaw) {
            try {
                const savedSettings = JSON.parse(savedSettingsRaw);
                const defaultMap = new Map(defaultSettings.map(s => [s.id, s]));
                let relevantSettings = savedSettings.filter(s => defaultMap.has(s.id));
                const relevantIds = new Set(relevantSettings.map(s => s.id));
                defaultSettings.forEach(def => {
                    if (!relevantIds.has(def.id)) {
                        relevantSettings.push(def);
                    }
                });
                finalSettings = relevantSettings;
            } catch (e) {
                console.error("PDT: Could not parse saved tab settings, reverting to default.", e);
            }
        }

        _state = {
            theme: localStorage.getItem('pdt-theme') || 'dark',
            tabSettings: finalSettings,
            dimensions: JSON.parse(localStorage.getItem('pdt-dimensions') || '{}'),
            impersonationUserId: null,
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
        _state = { ..._state, ...newState };

        // Persist specific state changes to localStorage using explicit, correct keys.
        if (newState.theme !== undefined) {
            localStorage.setItem('pdt-theme', newState.theme);
        }
        if (newState.tabSettings !== undefined) {
            localStorage.setItem('pdt-tab-settings', JSON.stringify(newState.tabSettings));
        }
        if (newState.dimensions !== undefined) {
            localStorage.setItem('pdt-dimensions', JSON.stringify(newState.dimensions));
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
        const defaultState = {
            theme: 'dark',
            tabSettings: defaultSettings,
            dimensions: {}
        };
        
        // Clear all persisted items from localStorage explicitly.
        localStorage.removeItem('pdt-tab-settings');
        localStorage.removeItem('pdt-theme');
        localStorage.removeItem('pdt-dimensions');

        // Use setState with the full default state to ensure all listeners are properly notified.
        this.setState(defaultState);
    }
};