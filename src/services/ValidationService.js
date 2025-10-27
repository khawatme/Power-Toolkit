/**
 * @file Centralized validation service.
 * @module services/ValidationService
 * @description Provides validation methods with consistent error messaging.
 */

import { isValidGuid } from '../helpers/index.js';
import { Config } from '../constants/index.js';

/**
 * Centralized validation service for input validation with consistent error handling.
 * @namespace ValidationService
 */
export const ValidationService = {
    /**
     * Validates that a value is a valid GUID.
     * @param {string} value - The value to validate
     * @param {string} [fieldName='ID'] - The field name for error messages
     * @throws {Error} If the value is not a valid GUID
     */
    validateGuid(value, fieldName = 'ID') {
        if (!isValidGuid(value)) {
            throw new Error(Config.VALIDATION_ERRORS.invalidGuid(fieldName));
        }
    },

    /**
     * Validates and converts a value to a number.
     * @param {*} value - The value to validate and convert
     * @param {string} [fieldName='value'] - The field name for error messages
     * @returns {number} The validated number
     * @throws {Error} If the value cannot be converted to a valid number
     */
    validateNumber(value, fieldName = 'value') {
        const num = Number(value);
        if (!Number.isFinite(num)) {
            throw new Error(Config.VALIDATION_ERRORS.invalidNumber(fieldName));
        }
        return num;
    },

    /**
     * Validates and converts a value to a boolean.
     * @param {*} value - The value to validate and convert
     * @param {string} [fieldName='value'] - The field name for error messages
     * @returns {boolean} The validated boolean
     * @throws {Error} If the value is not 'true' or 'false'
     */
    validateBoolean(value, fieldName = 'value') {
        const str = String(value).trim().toLowerCase();
        if (str !== 'true' && str !== 'false') {
            throw new Error(Config.VALIDATION_ERRORS.invalidBoolean(fieldName));
        }
        return str === 'true';
    },

    /**
     * Validates and parses a JSON string.
     * @param {string} value - The JSON string to validate
     * @param {string} [fieldName='value'] - The field name for error messages
     * @returns {*} The parsed JSON object
     * @throws {Error} If the value is not valid JSON
     */
    validateJson(value, fieldName = 'value') {
        try {
            return JSON.parse(value);
        } catch (e) {
            throw new Error(Config.VALIDATION_ERRORS.invalidJson(fieldName));
        }
    },

    /**
     * Validates that a required parameter is provided.
     * @param {*} value - The value to check
     * @param {string} paramName - The parameter name for error messages
     * @throws {Error} If the value is null, undefined, or empty string
     */
    validateRequired(value, paramName) {
        if (value == null || value === '') {
            throw new Error(Config.VALIDATION_ERRORS.requiredParameter(paramName));
        }
    },

    /**
     * Validates a date format.
     * @param {string} value - The date string to validate
     * @param {string} format - The expected format description
     * @throws {Error} If the date format is invalid
     */
    validateDateFormat(value, format) {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            throw new Error(Config.VALIDATION_ERRORS.invalidDateFormat(format));
        }
        return date;
    }
};
