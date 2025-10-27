/**
 * @file Formatting and display utilities.
 * @module helpers/formatting.helpers
 * @description Provides functions for formatting values, dates, numbers, and creating display strings.
 */

/**
 * @typedef {import('../../../node_modules/@types/xrm/index.d.ts').Xrm.Attributes.Attribute} XrmAttribute
 */

/**
 * Formatting utility functions.
 * @namespace FormattingHelpers
 */
export const FormattingHelpers = {
    /**
     * Formats a raw attribute value for clean display in the UI, correctly handling lookups,
     * option sets, dates, and other complex types.
     * @param {*} value - The raw value from `attribute.getValue()`.
     * @param {XrmAttribute} [attribute] - The optional attribute object, used to get text values for option sets.
     * @param {string} [controlType] - The type of the control displaying the value.
     * @returns {string} A user-friendly string representation of the value.
     */
    formatDisplayValue(value, attribute, controlType) {
        if (value === null) return "null";
        if (value === undefined) return "undefined";

        if (controlType && controlType.includes('subgrid')) {
            return String(value);
        }

        if (attribute && typeof attribute.getText === 'function') {
            const textValue = attribute.getText();
            if (Array.isArray(textValue)) {
                return textValue.join(', ');
            }
            return textValue || String(value);
        }

        const attrType = attribute?.getAttributeType();

        if (attrType === 'lookup' && Array.isArray(value) && value[0]?.name) {
            return value[0].name;
        }

        if (Array.isArray(value)) {
            if (value.length === 0) return "[Empty Array]";
            return `[${value.length} items]`;
        }
        if (value instanceof Date) {
            return value.toLocaleString();
        }
        return String(value);
    },

    /**
     * Formats a value for display as a preview string, handling different data types appropriately.
     * Converts objects/arrays to compact JSON, truncates long strings, and handles primitives.
     * @param {*} value - The value to format for preview.
     * @param {number} [maxLength=200] - Maximum length for the preview string before truncation.
     * @returns {string} A formatted preview string suitable for display in UI.
     */
    formatValuePreview(value, maxLength = 200) {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        try {
            const json = JSON.stringify(value);
            return json.length > maxLength ? json.slice(0, maxLength - 1) + '…' : json;
        } catch {
            return String(value);
        }
    },

    /**
     * Formats a numeric value as milliseconds with "ms" label.
     * @param {number} milliseconds - The time value in milliseconds.
     * @returns {string} - Formatted string like "123 ms" or "0 ms" for invalid values.
     */
    formatMilliseconds(milliseconds) {
        const value = Number(milliseconds);
        return Number.isFinite(value) ? `${Math.round(value)} ms` : '0 ms';
    },

    /**
     * Pretty-prints JSON if valid, otherwise returns the original value.
     * Useful for displaying JSON in textareas with proper formatting.
     * @param {string} value - The value to format.
     * @returns {string} Pretty-printed JSON or original value.
     */
    formatJsonIfValid(value) {
        const val = String(value ?? '').trim();
        const isJson = (val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'));
        if (!isJson) return value ?? '';
        try {
            return JSON.stringify(JSON.parse(val), null, 2);
        } catch {
            return value ?? '';
        }
    },

    /**
     * Normalizes values for equality comparison, handling JSON whitespace differences.
     * Minifies JSON for comparison while preserving non-JSON strings as-is.
     * @param {string} value - The value to normalize.
     * @returns {string} Normalized value (minified JSON or trimmed string).
     */
    normalizeForJsonCompare(value) {
        const val = String(value ?? '').trim();
        const isJson = (val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'));
        if (isJson) {
            try {
                return JSON.stringify(JSON.parse(val));
            } catch {
                return val;
            }
        }
        return val;
    },

    /**
     * Rounds a number to a specified number of decimal places.
     * @param {number} value - The number to round.
     * @param {number} [decimalPlaces=2] - Number of decimal places (default: 2).
     * @returns {number} - Rounded number.
     */
    roundToDecimal(value, decimalPlaces = 2) {
        const multiplier = Math.pow(10, decimalPlaces);
        return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
    },

    /**
     * Safely converts a value to a number with fallback to 0.
     * @param {any} value - The value to convert.
     * @returns {number} - Converted number or 0 if not finite.
     */
    safeNumber(value) {
        return Number.isFinite(+value) ? +value : 0;
    },

    /**
     * Calculates percentage distribution from parts of a whole.
     * Returns object with percentage for each part, ensuring total is 100%.
     * @param {Object.<string, number>} parts - Object with part names as keys and values as numbers.
     * @param {number} [decimalPlaces=2] - Decimal places for rounding (default: 2).
     * @returns {Object.<string, number>} - Object with same keys, values as percentages.
     */
    calculatePercentages(parts, decimalPlaces = 2) {
        const keys = Object.keys(parts);
        const total = keys.reduce((sum, key) => sum + (parts[key] || 0), 0);

        if (total === 0) {
            return keys.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
        }

        const percentages = {};
        let sum = 0;

        keys.forEach((key, index) => {
            if (index === keys.length - 1) {
                // Last item gets remainder to ensure total is exactly 100%
                percentages[key] = this.roundToDecimal(Math.max(0, 100 - sum), decimalPlaces);
            } else {
                const pct = this.roundToDecimal((parts[key] / total) * 100, decimalPlaces);
                percentages[key] = pct;
                sum += pct;
            }
        });

        return percentages;
    },

    /**
     * Creates an info-grid HTML structure from an array of key-value pairs.
     * Used for displaying structured information in a grid layout.
     * @param {Array<{label: string, value: string, isHtml?: boolean}>} rows - Array of row objects with label and value
     * @returns {string} HTML string for the info-grid
     * @example
     * const html = FormattingHelpers.createInfoGrid([
     *   { label: 'Name', value: 'John Doe' },
     *   { label: 'Email', value: '<a href="mailto:john@example.com">john@example.com</a>', isHtml: true }
     * ]);
     */
    createInfoGrid(rows) {
        if (!rows || !Array.isArray(rows) || rows.length === 0) return '';

        // Import escapeHtml dynamically to avoid circular dependency
        const escapeHtml = (str) => {
            const p = document.createElement('p');
            p.textContent = String(str ?? '');
            return p.innerHTML;
        };

        return rows.map(row => {
            const value = row.isHtml ? row.value : escapeHtml(row.value);
            return `<strong>${escapeHtml(row.label)}:</strong><span>${value}</span>`;
        }).join('');
    }
};
