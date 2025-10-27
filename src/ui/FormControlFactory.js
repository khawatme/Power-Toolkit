/**
 * @file Factory for creating HTML form input elements based on Dataverse attribute types.
 * @module ui/FormControlFactory
 * @description Provides a function that generates the appropriate HTML input control
 * for a given Power Apps field type, pre-populated with its current value.
 */

import { escapeHtml } from '../helpers/index.js';
import { Config } from '../constants/index.js';

/**
 * Represents the Xrm.Attributes.Attribute object from the Power Apps Client API.
 * @typedef {import('../../../node_modules/@types/xrm/index.d.ts').Xrm.Attributes.Attribute} XrmAttribute
 */

/**
 * A helper function to format a Date object or a date string into a string suitable for an <input type="datetime-local">.
 * @param {Date | string | null} dateValue - The date to format.
 * @returns {string} The formatted date string (e.g., "2025-09-03T14:30").
 * @private
 */
function _toLocalISOString(dateValue) {
    if (!dateValue) return "";

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return "";

    const tzoffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.valueOf() - tzoffset).toISOString().slice(0, -1);

    return localISOTime.substring(0, 16);
}

/**
 * A factory for creating HTML form controls.
 * @namespace
 */
export const FormControlFactory = {
    /**
     * Creates an HTML string for a form input control tailored to the specific
     * Dataverse attribute type. It generates user-friendly controls like dropdowns
     * for booleans and optionsets, and includes a "Clear Value" option for
     * non-required fields.
     * @param {string} attrType - The attribute type from the Xrm API (e.g., 'memo', 'boolean', 'optionset').
     * @param {any} currentValue - The current value of the attribute to pre-populate the control.
     * @param {XrmAttribute} [attribute] - The full attribute object, required for generating optionsets.
     * @returns {string} The HTML string for the generated form control.
     */
    create(attrType, currentValue, attribute) {
        switch (attrType) {
            case 'memo':
                return `<textarea id="pdt-prompt-input" class="pdt-textarea" rows="4">${escapeHtml(currentValue ?? "")}</textarea>`;

            case 'boolean':
                return `<select id="pdt-prompt-input" class="pdt-select">
                            <option value="true" ${currentValue === true ? 'selected' : ''}>True</option>
                            <option value="false" ${currentValue === false ? 'selected' : ''}>False</option>
                            <option value="null" ${currentValue === null ? 'selected' : ''}>${Config.FORM_CONTROL_LABELS.clearValue}</option>
                        </select>`;

            case 'optionset':
            case 'multiselectoptionset':
                if (attribute && typeof attribute.getOptions === 'function') {
                    const isRequired = attribute.getRequiredLevel?.() === Config.FORM_CONTROL_LABELS.requiredLevel.required;
                    const options = attribute.getOptions();

                    let optionsHtml = isRequired ? '' : `<option value="null" ${currentValue === null ? 'selected' : ''}>${Config.FORM_CONTROL_LABELS.clearValue}</option>`;

                    optionsHtml += options.map(opt => {
                        if (opt.value === null) return "";
                        const isSelected = String(opt.value) === String(currentValue);
                        return `<option value="${opt.value}" ${isSelected ? 'selected' : ''}>${escapeHtml(opt.text)} (${opt.value})</option>`;
                    }).join('');

                    return `<select id="pdt-prompt-input" class="pdt-select">${optionsHtml}</select>`;
                }
                // Fallback for optionsets without the full attribute object
                return `<input type="text" id="pdt-prompt-input" class="pdt-input" value="${escapeHtml(currentValue ?? "")}" placeholder="${Config.FORM_CONTROL_LABELS.optionsetPlaceholder}">`;

            case 'datetime':
                return `<input type="datetime-local" id="pdt-prompt-input" class="pdt-input" value="${_toLocalISOString(currentValue)}">`;

            case 'money':
            case 'decimal':
            case 'double':
            case 'integer':
            case 'bigint':
                return `<input type="number" id="pdt-prompt-input" class="pdt-input" value="${currentValue ?? ""}" step="any">`;

            // Lookup types (customer, owner, lookup) are typically read-only in this context
            // but provide a text input for edge cases where they might be editable
            case 'lookup':
            case 'customer':
            case 'owner':
                return `<input type="text" id="pdt-prompt-input" class="pdt-input" value="${escapeHtml(currentValue ?? "")}" readonly>`;

            default: // Handles 'string' and other types
                return `<input type="text" id="pdt-prompt-input" class="pdt-input" value="${escapeHtml(currentValue ?? "")}">`;
        }
    }
};