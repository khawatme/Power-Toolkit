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
    if (!dateValue) {
        return '';
    }

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
        return '';
    }

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
        const controlCreators = {
            memo: () => this._createTextarea(currentValue),
            boolean: () => this._createBooleanSelect(currentValue),
            optionset: () => this._createOptionsetSelect(currentValue, attribute),
            multiselectoptionset: () => this._createOptionsetSelect(currentValue, attribute),
            datetime: () => this._createDatetimeInput(currentValue),
            money: () => this._createNumberInput(currentValue),
            decimal: () => this._createNumberInput(currentValue),
            double: () => this._createNumberInput(currentValue),
            integer: () => this._createNumberInput(currentValue),
            bigint: () => this._createNumberInput(currentValue),
            lookup: () => this._createReadonlyInput(currentValue),
            customer: () => this._createReadonlyInput(currentValue),
            owner: () => this._createReadonlyInput(currentValue)
        };

        const creator = controlCreators[attrType];
        return creator ? creator() : this._createTextInput(currentValue);
    },

    /**
     * Create textarea control
     * @private
     */
    _createTextarea(value) {
        return `<textarea id="pdt-prompt-input" class="pdt-textarea" rows="4" spellcheck="false">${escapeHtml(value ?? '')}</textarea>`;
    },

    /**
     * Create boolean select control
     * @private
     */
    _createBooleanSelect(value) {
        return `<select id="pdt-prompt-input" class="pdt-select">
                    <option value="true" ${value === true ? 'selected' : ''}>True</option>
                    <option value="false" ${value === false ? 'selected' : ''}>False</option>
                    <option value="null" ${value === null ? 'selected' : ''}>${Config.FORM_CONTROL_LABELS.clearValue}</option>
                </select>`;
    },

    /**
     * Create optionset select control
     * @private
     */
    _createOptionsetSelect(value, attribute) {
        if (attribute && typeof attribute.getOptions === 'function') {
            const isRequired = attribute.getRequiredLevel?.() === Config.FORM_CONTROL_LABELS.requiredLevel.required;
            const options = attribute.getOptions();

            let optionsHtml = isRequired ? '' : `<option value="null" ${value === null ? 'selected' : ''}>${Config.FORM_CONTROL_LABELS.clearValue}</option>`;

            optionsHtml += options.map(opt => {
                if (opt.value === null) {
                    return '';
                }
                const isSelected = String(opt.value) === String(value);
                return `<option value="${opt.value}" ${isSelected ? 'selected' : ''}>${escapeHtml(opt.text)} (${opt.value})</option>`;
            }).join('');

            return `<select id="pdt-prompt-input" class="pdt-select">${optionsHtml}</select>`;
        }
        // Fallback for optionsets without the full attribute object
        return `<input type="text" id="pdt-prompt-input" class="pdt-input" value="${escapeHtml(value ?? '')}" placeholder="${Config.FORM_CONTROL_LABELS.optionsetPlaceholder}">`;
    },

    /**
     * Create datetime input control
     * @private
     */
    _createDatetimeInput(value) {
        return `<input type="datetime-local" id="pdt-prompt-input" class="pdt-input" value="${_toLocalISOString(value)}">`;
    },

    /**
     * Create number input control
     * @private
     */
    _createNumberInput(value) {
        return `<input type="number" id="pdt-prompt-input" class="pdt-input" value="${value ?? ''}" step="any">`;
    },

    /**
     * Create readonly input control
     * @private
     */
    _createReadonlyInput(value) {
        return `<input type="text" id="pdt-prompt-input" class="pdt-input" value="${escapeHtml(value ?? '')}" readonly>`;
    },

    /**
     * Create text input control (default)
     * @private
     */
    _createTextInput(value) {
        return `<input type="text" id="pdt-prompt-input" class="pdt-input" value="${escapeHtml(value ?? '')}">`;
    }
};