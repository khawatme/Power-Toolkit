/**
 * @file Validation and type-checking utilities.
 * @module helpers/validation.helpers
 * @description Provides validation functions for GUIDs, JSON, and other data types.
 */

import { ValidationService } from '../services/ValidationService.js';

/**
 * Validation utility functions.
 * @namespace ValidationHelpers
 */
export const ValidationHelpers = {
    /**
     * Validates if a string is a valid GUID.
     * @param {string} guid - The string to test.
     * @returns {boolean} True if the string is a valid GUID.
     */
    isValidGuid(guid) {
        return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(guid);
    },

    /**
     * Checks if a string looks like JSON (object or array).
     * @param {string} str - The string to check.
     * @returns {boolean} True if string starts with { or [ and ends with } or ].
     */
    isJsonString(str) {
        const trimmed = String(str ?? '').trim();
        return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'));
    },

    /**
     * Checks if a property key is a system-generated OData property.
     * @param {string} key - The property key to check.
     * @returns {boolean} True if the key is a system property (e.g., starts with '_' or contains '@odata').
     */
    isOdataProperty(key) {
        return key.startsWith('_') || /@odata/i.test(key);
    },

    /**
     * Determines if a property name represents a system-generated field based on common patterns.
     * Checks for OData metadata fields, formatted value annotations, and other system properties.
     * @param {string} propertyName - The property name to check.
     * @returns {boolean} True if the property appears to be a system field, false otherwise.
     */
    isSystemProperty(propertyName) {
        const name = String(propertyName || '');
        return name.startsWith('@odata.')
            || name === 'odata.etag'
            || name === '@odata.context'
            || name.endsWith('@OData.Community.Display.V1.FormattedValue')
            || name.includes('@Microsoft.Dynamics.CRM.');
    },

    /**
     * Parses the value from an HTML input/select element into the correct data type for the Xrm API.
     * @param {HTMLElement} input - The input or select element.
     * @param {string} type - The target Dataverse data type (e.g., 'integer', 'datetime', 'boolean').
     * @returns {string|number|boolean|Date|null} The parsed value in the correct type.
     * @throws {Error} If the value is invalid for the target type (e.g., non-numeric string for an integer field).
     */
    parseInputValue(input, type) {
        const value = input.value;

        switch (type) {
            case 'integer': {
                if (value === null || value === '') {
                    return null;
                }
                return ValidationService.validateNumber(value, 'Input value');
            }
            case 'decimal':
            case 'money':
            case 'double': {
                if (value === null || value === '') {
                    return null;
                }
                return ValidationService.validateNumber(value, 'Input value');
            }
            case 'datetime': {
                if (value === null || value === '') {
                    return null;
                }
                return ValidationService.validateDateFormat(value, 'Input value');
            }
            case 'optionset': {
                if (value === 'null') {
                    return null;
                }
                const num = parseInt(value, 10);
                return isNaN(num) ? null : num;
            }
            case 'boolean': {
                if (value === 'null') {
                    return null;
                }
                return value === 'true';
            }
            default:
                return value;
        }
    },

    /**
     * Attaches a keydown listener to an input that triggers an action on 'Enter'.
     * Returns the handler function so it can be removed later for cleanup.
     * @param {HTMLInputElement} inputElement - The input element.
     * @param {Function} action - The function to execute.
     * @returns {Function|null} The event handler function for later removal, or null if inputElement is invalid.
     */
    addEnterKeyListener(inputElement, action) {
        if (inputElement) {
            const handler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    action();
                }
            };
            inputElement.addEventListener('keydown', handler);
            return handler;
        }
        return null;
    }
};
