/**
 * @file Color helper utilities.
 * @module helpers/color.helpers
 * @description Pure functions for validating and normalizing user-chosen colors. Kept free of
 * imports so state modules can use them without pulling in the service layer.
 */

/** @private Six-digit hex, with an optional three-digit shorthand. */
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Checks whether a value is a hex color string (`#abc` or `#aabbcc`).
 * @param {any} value - The value to test.
 * @returns {boolean} True when the value is a well-formed hex color.
 * @example
 * isValidHexColor('#1e90ff'); // true
 * isValidHexColor('red');     // false
 */
export function isValidHexColor(value) {
    return typeof value === 'string' && HEX_COLOR_PATTERN.test(value.trim());
}

/**
 * Normalizes a color to lower-case `#rrggbb`, or null when it isn't a usable hex color.
 *
 * Anything that reaches a stylesheet has to come through here: tab colors arrive from an imported
 * settings file, so an unvalidated value would let that file put arbitrary CSS tokens (a `url()`,
 * for instance) into a rendered custom property.
 * @param {any} value - Raw color value from user input or an imported file.
 * @returns {string|null} Normalized `#rrggbb`, or null when the input is unusable.
 * @example
 * normalizeHexColor('#ABC');     // '#aabbcc'
 * normalizeHexColor(' #1E90FF'); // '#1e90ff'
 * normalizeHexColor('url(x)');   // null
 */
export function normalizeHexColor(value) {
    if (!isValidHexColor(value)) {
        return null;
    }
    const hex = value.trim().toLowerCase();
    if (hex.length === 4) {
        return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    return hex;
}
