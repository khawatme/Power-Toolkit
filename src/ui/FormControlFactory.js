/**
 * @file Factory for creating HTML form input elements based on Dataverse attribute types.
 * @module ui/FormControlFactory
 * @description Provides a function that generates the appropriate HTML input control
 * for a given Power Apps field type, pre-populated with its current value.
 */

import { Helpers } from '../utils/Helpers.js';

/**
 * A helper function to format a Date object or a date string into a string suitable for an <input type="datetime-local">.
 * @param {Date | string | null} dateValue - The date to format.
 * @returns {string} The formatted date string (e.g., "2025-09-03T14:30").
 * @private
 */
function _toLocalISOString(dateValue) {
    if (!dateValue) return "";
    
    // --- FIX: This now correctly handles both Date objects and date strings from the Web API ---
    const date = new Date(dateValue);
    // Check if the date is valid after parsing
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
     * Creates an HTML string for a form input control based on the Dataverse attribute type.
     * @param {string} attrType - The attribute type from the Xrm API (e.g., 'memo', 'boolean', 'datetime').
     * @param {any} currentValue - The current value of the attribute to pre-populate the control.
     * @param {Xrm.Attributes.Attribute} [attribute] - The full attribute object, used for optionsets and required level checks.
     * @returns {string} The HTML string for the generated form control.
     */
    create(attrType, currentValue, attribute) {
        switch (attrType) {
            case 'memo':
                return `<textarea id="pdt-prompt-input" class="pdt-textarea" rows="4">${Helpers.escapeHtml(currentValue ?? "")}</textarea>`;

            case 'boolean':
                return `<select id="pdt-prompt-input" class="pdt-select">
                            <option value="true" ${currentValue === true ? 'selected' : ''}>True</option>
                            <option value="false" ${currentValue === false ? 'selected' : ''}>False</option>
                            <option value="null" ${currentValue === null ? 'selected' : ''}>--- (Clear Value) ---</option>
                        </select>`;
            
            case 'optionset':
                if (attribute && typeof attribute.getOptions === 'function') {
                    const isRequired = attribute.getRequiredLevel() === 'required';
                    const options = attribute.getOptions();
                    
                    // Start with a Null/Clear option at the top if the field is not required.
                    let optionsHtml = isRequired ? '' : `<option value="null" ${currentValue === null ? 'selected' : ''}>--- (Clear Value) ---</option>`;
                    
                    // Add the actual options from the attribute, skipping any null value from the API.
                    optionsHtml += options.map(opt => {
                        if (opt.value === null) return ""; 
                        const isSelected = String(opt.value) === String(currentValue);
                        return `<option value="${opt.value}" ${isSelected ? 'selected' : ''}>${Helpers.escapeHtml(opt.text)}</option>`;
                    }).join('');
                    
                    return `<select id="pdt-prompt-input" class="pdt-select">${optionsHtml}</select>`;
                }
                return `<input type="text" id="pdt-prompt-input" class="pdt-input" value="${Helpers.escapeHtml(currentValue ?? "")}" placeholder="Enter integer value...">`;

            case 'datetime':
                return `<input type="datetime-local" id="pdt-prompt-input" class="pdt-input" value="${_toLocalISOString(currentValue)}">`;

            case 'money':
            case 'decimal':
            case 'double':
            case 'integer':
                return `<input type="number" id="pdt-prompt-input" class="pdt-input" value="${currentValue ?? ""}" step="any">`;

            default: // Handles 'string'
                return `<input type="text" id="pdt-prompt-input" class="pdt-input" value="${Helpers.escapeHtml(currentValue ?? "")}">`;
        }
    }
};