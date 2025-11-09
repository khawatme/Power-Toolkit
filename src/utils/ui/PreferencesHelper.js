/**
 * @file PreferencesHelper
 * @description Centralized localStorage preference management
 * @module utils/ui/PreferencesHelper
 */

/**
 * Centralized helper for managing user preferences in localStorage.
 * @namespace PreferencesHelper
 */
export const PreferencesHelper = {
    /**
     * Load a preference from localStorage with type conversion.
     * @param {string} key - The localStorage key
     * @param {*} defaultValue - The default value if key doesn't exist
     * @param {'string'|'boolean'|'number'|'json'} [type='string'] - The expected type
     * @returns {*} The preference value or default
     */
    load(key, defaultValue, type = 'string') {
        try {
            const saved = localStorage.getItem(key);
            if (saved === null) {
                return defaultValue;
            }

            switch (type) {
            case 'boolean':
                return saved === 'true';
            case 'number':
                const num = Number(saved);
                return isNaN(num) ? defaultValue : num;
            case 'json':
                try {
                    return JSON.parse(saved);
                } catch {
                    return defaultValue;
                }
            default:
                return saved;
            }
        } catch (_e) {
            // localStorage access might be blocked or quota exceeded
            return defaultValue;
        }
    },

    /**
     * Save a preference to localStorage.
     * @param {string} key - The localStorage key
     * @param {*} value - The value to save
     * @param {'string'|'boolean'|'number'|'json'} [type='string'] - The value type
     * @returns {boolean} True if saved successfully, false otherwise
     */
    save(key, value, type = 'string') {
        try {
            let valueToStore = value;

            if (type === 'json') {
                valueToStore = JSON.stringify(value);
            } else {
                valueToStore = String(value);
            }

            localStorage.setItem(key, valueToStore);
            return true;
        } catch (_e) {
            // localStorage access might be blocked or quota exceeded
            return false;
        }
    },

    /**
     * Remove a preference from localStorage.
     * @param {string} key - The localStorage key
     * @returns {boolean} True if removed successfully, false otherwise
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (_e) {
            return false;
        }
    },

    /**
     * Check if a preference exists in localStorage.
     * @param {string} key - The localStorage key
     * @returns {boolean} True if the key exists
     */
    exists(key) {
        try {
            return localStorage.getItem(key) !== null;
        } catch (_e) {
            return false;
        }
    }
};
