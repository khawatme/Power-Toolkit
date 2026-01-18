/**
 * @file Utility for rendering smart value inputs based on attribute metadata.
 * @module ui/SmartValueInput
 */

import { StringHelpers } from '../helpers/string.helpers.js';
import { DataService } from '../services/DataService.js';
import { NotificationService } from '../services/NotificationService.js';

const { escapeHtml } = StringHelpers;

/**
 * Renders smart value inputs based on attribute type and metadata.
 * Supports boolean dropdowns, picklists, date pickers, number inputs, and lookups.
 */
export class SmartValueInput {
    /**
     * Lookup attribute types.
     * @constant {string[]}
     */
    static LOOKUP_TYPES = ['lookup', 'lookuptype', 'customer', 'customertype', 'owner', 'ownertype'];
    /**
     * Render a smart value input based on attribute type.
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.valueContainer - Container element for the value input
     * @param {Object} options.attr - Attribute metadata object
     * @param {string} options.entityName - Entity logical name
     * @param {string} [options.dataProp='value'] - Data property name for the input
     * @param {string} [options.context='fetch'] - Context: 'fetch', 'filter', or 'post'
     * @param {HTMLElement} [options.row] - Optional row element to attach metadata to
     * @param {Function} [options.onInputChange] - Optional callback when input changes
     * @returns {Promise<void>}
     */
    static async render({
        valueContainer,
        attr,
        entityName,
        dataProp = 'value',
        context = 'fetch',
        row = null,
        onInputChange = null
    }) {
        if (!valueContainer) {
            return;
        }

        const { attrType, attrName } = this._extractAttributeMetadata(attr);

        if (row) {
            row._attrMetadata = attr;
        }

        const { styleAttr, spanStyle } = this._buildStyleAttributes(context);
        const existingValue = this._captureExistingValue(valueContainer, dataProp);

        const inputHtml = await this._buildInputHtmlSafe({
            attrType,
            attrName,
            entityName,
            attr,
            dataProp,
            styleAttr,
            spanStyle,
            context
        });

        valueContainer.innerHTML = inputHtml;
        const newInput = valueContainer.querySelector(`[data-prop="${dataProp}"]`);

        this._restoreValue(newInput, existingValue);

        this._setupInput(newInput, {
            attrType,
            entityName,
            attr,
            context,
            onInputChange
        });
    }

    /**
     * Extract and normalize attribute metadata.
     * @param {Object} attr - Attribute metadata object
     * @returns {{attrType: string, attrName: string}} Normalized attribute metadata
     * @private
     */
    static _extractAttributeMetadata(attr) {
        const attrType = (attr.AttributeTypeName?.Value || attr.AttributeType || '').toLowerCase();
        const attrName = attr.LogicalName || '';
        return { attrType, attrName };
    }

    /**
     * Build style attributes based on rendering context.
     * @param {string} context - Context: 'fetch', 'filter', or 'post'
     * @returns {{styleAttr: string, spanStyle: string}} Style attribute strings
     * @private
     */
    static _buildStyleAttributes(context) {
        const styleAttr = context === 'filter' ? ' style="width: 100%;"' : '';
        const spanStyle = context === 'post' ? ' style="grid-column: span 2;"' : '';
        return { styleAttr, spanStyle };
    }

    /**
     * Capture existing input value before re-rendering.
     * @param {HTMLElement} container - Container element
     * @param {string} dataProp - Data property name
     * @returns {string} Existing value or empty string
     * @private
     */
    static _captureExistingValue(container, dataProp) {
        const existingInput = container.querySelector(`[data-prop="${dataProp}"]`);

        if (!existingInput) {
            return '';
        }

        if (existingInput.classList?.contains('pdt-multiselect-dropdown')) {
            const checkboxes = existingInput.querySelectorAll('input[type="checkbox"]:checked');
            const values = Array.from(checkboxes).map(cb => cb.value);
            return values.join(',');
        }

        return existingInput.value || '';
    }

    /**
     * Build input HTML with error handling.
     * @param {Object} params - Build parameters
     * @returns {Promise<string>} Input HTML string
     * @private
     */
    static async _buildInputHtmlSafe(params) {
        try {
            return await this._buildInputHtml(params);
        } catch (_e) {
            return this._buildDefaultInput(params.dataProp, params.styleAttr);
        }
    }

    /**
     * Restore previously entered value to new input element.
     * @param {HTMLElement|null} input - New input element
     * @param {string} value - Value to restore
     * @private
     */
    static _restoreValue(input, value) {
        if (!value || !input) {
            return;
        }

        if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
            input.value = value;
        } else if (input.tagName === 'SELECT') {
            input.value = value;
        } else if (input.classList?.contains('pdt-multiselect-dropdown')) {
            this._restoreMultiselectValue(input, value);
        }
    }

    /**
     * Setup input element after rendering.
     * @private
     */
    static _setupInput(input, { attrType, entityName, attr, context, onInputChange }) {
        if (!input) {
            return;
        }

        if (input.classList?.contains('pdt-multiselect-dropdown')) {
            this._setupMultiselectDropdown(input);
        }

        if (input.classList?.contains('pdt-file-upload-container')) {
            this._setupFileUpload(input, entityName, attr);
        }

        if (context === 'post' && SmartValueInput.LOOKUP_TYPES.includes(attrType)) {
            this._setupLookupDefault(input);
        }

        if (onInputChange) {
            input.addEventListener('input', onInputChange);
            input.addEventListener('change', onInputChange);
        }
    }

    /**
     * Setup default value for lookup in post context.
     * @private
     */
    static _setupLookupDefault(input) {
        const entitySetName = input.getAttribute('data-entity-set');
        if (entitySetName) {
            input.value = `/${entitySetName}(GUID)`;
        }
    }

    /**
     * Setup multiselect dropdown interactions.
     * @private
     */
    static _setupMultiselectDropdown(dropdown) {
        const trigger = dropdown.querySelector('.pdt-multiselect-trigger');
        const optionsContainer = dropdown.querySelector('.pdt-multiselect-options');
        const checkboxes = dropdown.querySelectorAll('.pdt-multiselect-option input[type="checkbox"]');
        const textDisplay = dropdown.querySelector('.pdt-multiselect-text');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('open');

            document.querySelectorAll('.pdt-multiselect-dropdown.open').forEach(dd => {
                if (dd !== dropdown) {
                    dd.classList.remove('open');
                    dd.querySelector('.pdt-multiselect-options').style.display = 'none';
                }
            });

            if (isOpen) {
                dropdown.classList.remove('open');
                optionsContainer.style.display = 'none';
            } else {
                dropdown.classList.add('open');
                optionsContainer.style.display = 'block';
            }
        });

        const updateDisplay = () => {
            const selected = Array.from(checkboxes).filter(cb => cb.checked);
            if (selected.length === 0) {
                textDisplay.textContent = '-- Select options --';
            } else if (selected.length === 1) {
                textDisplay.textContent = selected[0].dataset.label;
            } else {
                textDisplay.textContent = `${selected.length} options selected`;
            }
        };

        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateDisplay);
        });

        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
                optionsContainer.style.display = 'none';
            }
        };
        document.addEventListener('click', closeDropdown);

        dropdown._closeHandler = closeDropdown;
    }

    /**
     * Restore multiselect dropdown value from comma-separated string.
     * @param {HTMLElement} dropdown - The multiselect dropdown element
     * @param {string} value - Comma-separated values to restore
     * @private
     */
    static _restoreMultiselectValue(dropdown, value) {
        if (!dropdown || !value) {
            return;
        }

        const checkboxes = dropdown.querySelectorAll('.pdt-multiselect-option input[type="checkbox"]');
        const textDisplay = dropdown.querySelector('.pdt-multiselect-text');
        const selectedValues = value.split(',').map(v => v.trim()).filter(v => v);

        checkboxes.forEach(checkbox => {
            if (selectedValues.includes(checkbox.value)) {
                checkbox.checked = true;
            }
        });

        if (textDisplay) {
            const selectedCheckboxes = Array.from(checkboxes).filter(cb => cb.checked);
            if (selectedCheckboxes.length === 0) {
                textDisplay.textContent = '-- Select options --';
            } else if (selectedCheckboxes.length === 1) {
                textDisplay.textContent = selectedCheckboxes[0].dataset.label;
            } else {
                textDisplay.textContent = `${selectedCheckboxes.length} options selected`;
            }
        }
    }

    /**
     * Cleanup document-level event listeners for a multiselect dropdown.
     * Call this when removing a dropdown to prevent memory leaks.
     * @param {HTMLElement} dropdown - The dropdown element to cleanup
     */
    static cleanupMultiselectDropdown(dropdown) {
        if (dropdown && dropdown._closeHandler) {
            document.removeEventListener('click', dropdown._closeHandler);
            dropdown._closeHandler = null;
        }
    }

    /**
     * Setup file upload interactions.
     * @private
     */
    static _setupFileUpload(container, entityName, attr) {
        const fileInput = container.querySelector('.pdt-file-input');
        const selectBtn = container.querySelector('.pdt-file-select-btn');
        const fileNameSpan = container.querySelector('.pdt-file-name');
        const dataInput = container.querySelector('.pdt-file-data');

        container._fileData = null;
        container._fileName = null;
        container._entityName = entityName;
        container._attributeName = attr?.LogicalName;

        selectBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0];
            if (!file) {
                return;
            }

            try {
                const base64 = await this._fileToBase64(file);

                container._fileData = base64;
                container._fileName = file.name;
                container._mimeType = file.type;

                fileNameSpan.textContent = file.name;
                fileNameSpan.title = file.name;
                dataInput.value = '';
            } catch (error) {
                NotificationService.show(`Error reading file: ${error.message}`, 'error');
            }
        });

        dataInput.addEventListener('input', () => {
            if (dataInput.value.trim()) {
                container._fileData = dataInput.value.trim();
                container._fileName = 'manual_input';
                fileNameSpan.textContent = '';
            }
        });
    }

    /**
     * Convert file to base64 string.
     * @private
     */
    static _fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1] || reader.result;
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Map attribute type to input builder method.
     * @private
     */
    static _getInputBuilder(attrType) {
        if (['boolean', 'booleantype'].includes(attrType)) {
            return 'Boolean';
        }

        if (['picklist', 'picklisttype', 'state', 'statetype', 'status', 'statustype'].includes(attrType)) {
            return 'Picklist';
        }

        if (['multiselectpicklist', 'multiselectpicklisttype'].includes(attrType)) {
            return 'MultiSelectPicklist';
        }

        if (['datetime', 'datetimetype'].includes(attrType)) {
            return 'DateTime';
        }

        if (['integer', 'integertype', 'bigint', 'biginttype'].includes(attrType)) {
            return 'Integer';
        }

        if (['decimal', 'decimaltype', 'double', 'doubletype', 'money', 'moneytype'].includes(attrType)) {
            return 'Decimal';
        }

        if (['lookup', 'lookuptype', 'customer', 'customertype', 'owner', 'ownertype'].includes(attrType)) {
            return 'Lookup';
        }

        if (['memo', 'memotype'].includes(attrType)) {
            return 'Memo';
        }

        if (['string', 'stringtype'].includes(attrType)) {
            return 'String';
        }

        if (['uniqueidentifier', 'uniqueidentifiertype'].includes(attrType)) {
            return 'UniqueIdentifier';
        }

        if (['image', 'imagetype'].includes(attrType)) {
            return 'Image';
        }

        if (['file', 'filetype'].includes(attrType)) {
            return 'File';
        }

        if (['entityname', 'entitynametype'].includes(attrType)) {
            return 'EntityName';
        }

        if (['partylist', 'partylisttype', 'virtual', 'virtualtype', 'managedproperty', 'managedpropertytype', 'calendarrules'].includes(attrType)) {
            return 'ReadOnly';
        }
        return 'Default';
    }

    /**
     * Build input HTML based on attribute type.
     * @private
     * @returns {Promise<string>}
     */
    static _buildInputHtml({ attrType, attrName, entityName, attr, dataProp, styleAttr, spanStyle, context }) {
        const builderType = this._getInputBuilder(attrType);
        switch (builderType) {
            case 'Boolean':
                return this._buildBooleanInput(entityName, attrName, dataProp, styleAttr, context);
            case 'Picklist':
                return this._buildPicklistInput(entityName, attrName, dataProp, styleAttr, context);
            case 'MultiSelectPicklist':
                return this._buildMultiSelectPicklistInput(entityName, attrName, dataProp, styleAttr, context);
            case 'DateTime':
                return this._buildDateTimeInput(attr, dataProp, styleAttr);
            case 'Integer':
                return this._buildIntegerInput(dataProp, styleAttr);
            case 'Decimal':
                return this._buildDecimalInput(dataProp, styleAttr);
            case 'Lookup':
                return this._buildLookupInput(attr, dataProp, styleAttr, spanStyle, context);
            case 'Memo':
                return this._buildMemoInput(dataProp, spanStyle);
            case 'String':
                return this._buildStringInput(dataProp, styleAttr);
            case 'UniqueIdentifier':
                return this._buildUniqueIdentifierInput(dataProp, styleAttr);
            case 'Image':
                return this._buildImageInput(dataProp, styleAttr);
            case 'File':
                return this._buildFileInput(dataProp, styleAttr);
            case 'EntityName':
                return this._buildEntityNameInput(dataProp, styleAttr);
            case 'ReadOnly':
                return this._buildReadOnlyInput(dataProp, styleAttr, attrType);
            default:
                return this._buildDefaultInput(dataProp, styleAttr);
        }
    }

    /**
     * Build boolean input with custom labels.
     * @private
     */
    static async _buildBooleanInput(entityName, attrName, dataProp, styleAttr, context) {
        try {
            const boolOptions = await DataService.getBooleanOptions(entityName, attrName);
            const trueValue = context === 'fetch' ? '1' : 'true';
            const falseValue = context === 'fetch' ? '0' : 'false';
            const trueLabel = boolOptions.trueLabel || 'True';
            const falseLabel = boolOptions.falseLabel || 'False';

            return `
                <select class="pdt-select" data-prop="${dataProp}" data-type="boolean"${styleAttr}>
                    <option value="">-- Select --</option>
                    <option value="${trueValue}">${escapeHtml(trueLabel)}</option>
                    <option value="${falseValue}">${escapeHtml(falseLabel)}</option>
                </select>`;
        } catch {
            const trueValue = context === 'fetch' ? '1' : 'true';
            const falseValue = context === 'fetch' ? '0' : 'false';
            return `
                <select class="pdt-select" data-prop="${dataProp}" data-type="boolean"${styleAttr}>
                    <option value="">-- Select --</option>
                    <option value="${trueValue}">True</option>
                    <option value="${falseValue}">False</option>
                </select>`;
        }
    }

    /**
     * Build picklist/optionset input.
     * @private
     */
    static async _buildPicklistInput(entityName, attrName, dataProp, styleAttr, _context) {
        try {
            const options = await DataService.getPicklistOptions(entityName, attrName);
            let optionsHtml = '<option value="">-- Select --</option>';
            for (const opt of options) {
                optionsHtml += `<option value="${opt.value}">${escapeHtml(opt.label)} (${opt.value})</option>`;
            }
            return `<select class="pdt-select" data-prop="${dataProp}" data-type="optionset"${styleAttr}>${optionsHtml}</select>`;
        } catch {
            return `<input type="number" class="pdt-input" data-prop="${dataProp}" placeholder="Option Value"${styleAttr}>`;
        }
    }

    /**
     * Build multi-select picklist input with dropdown UI.
     * @private
     */
    static async _buildMultiSelectPicklistInput(entityName, attrName, dataProp, styleAttr, _context) {
        try {
            const options = await DataService.getPicklistOptions(entityName, attrName);
            if (options.length === 0) {
                return `<input type="text" class="pdt-input" data-prop="${dataProp}" data-type="multiselectpicklist" placeholder="Comma-separated values"${styleAttr}>`;
            }

            let html = `<div class="pdt-multiselect-dropdown" data-prop="${dataProp}" data-type="multiselectpicklist"${styleAttr}>`;
            html += `<div class="pdt-multiselect-trigger">
                <span class="pdt-multiselect-text">-- Select options --</span>
                <span class="pdt-multiselect-arrow">▼</span>
            </div>`;
            html += '<div class="pdt-multiselect-options" style="display: none;">';

            for (const opt of options) {
                html += `
                    <label class="pdt-multiselect-option">
                        <input type="checkbox" value="${opt.value}" data-label="${escapeHtml(opt.label)}">
                        <span>${escapeHtml(opt.label)} (${opt.value})</span>
                    </label>`;
            }

            html += '</div></div>';
            return html;
        } catch {
            return `<input type="text" class="pdt-input" data-prop="${dataProp}" data-type="multiselectpicklist" placeholder="Comma-separated values"${styleAttr}>`;
        }
    }

    /**
     * Build datetime input.
     * Handles both DateOnly (date) and DateTime (datetime-local) fields.
     * @private
     */
    static _buildDateTimeInput(attr, dataProp, styleAttr) {
        const format = attr?.Format || attr?.format || attr?.DateTimeBehavior?.Value || '';
        const isDateOnly = format === 'DateOnly';

        if (isDateOnly) {
            return `<input type="date" class="pdt-input" data-prop="${dataProp}" data-type="date"${styleAttr}>`;
        }
        return `<input type="datetime-local" class="pdt-input" data-prop="${dataProp}" data-type="datetime"${styleAttr}>`;
    }

    /**
     * Build integer input.
     * @private
     */
    static _buildIntegerInput(dataProp, styleAttr) {
        return `<input type="number" class="pdt-input" data-prop="${dataProp}" data-type="integer" step="1" placeholder="Whole number"${styleAttr}>`;
    }

    /**
     * Build decimal input.
     * @private
     */
    static _buildDecimalInput(dataProp, styleAttr) {
        return `<input type="number" class="pdt-input" data-prop="${dataProp}" data-type="decimal" step="any" placeholder="Decimal number"${styleAttr}>`;
    }

    /**
     * Build lookup input with entity-specific formatting.
     * @private
     */
    static async _buildLookupInput(attr, dataProp, styleAttr, spanStyle, context) {
        const targets = attr.Targets || [];
        const targetEntity = targets[0] || 'systemuser';

        if (context === 'post') {
            try {
                const { EntitySetName } = await DataService.retrieveEntityDefinition(targetEntity);
                const entitySetName = EntitySetName || targetEntity + 's';
                const placeholder = `Insert GUID between () - e.g., /${entitySetName}(12345678-1234-1234-1234-123456789012)`;
                const title = `Paste the record GUID inside the parentheses. Format: /${entitySetName}(YOUR-GUID-HERE)`;
                const defaultValue = `/${entitySetName}(GUID)`;
                return `<input type="text" class="pdt-input" data-prop="${dataProp}" data-type="lookup" data-target-entity="${targetEntity}" data-entity-set="${entitySetName}" placeholder="${placeholder}" value="${defaultValue}" title="${title}"${spanStyle}>`;
            } catch (_error) {
                const fallbackEntitySet = targetEntity + 's';
                const fallbackPlaceholder = `Insert GUID between () - e.g., /${fallbackEntitySet}(12345678-1234-1234-1234-123456789012)`;
                const fallbackTitle = `Paste the record GUID inside the parentheses. Format: /${fallbackEntitySet}(YOUR-GUID-HERE)`;
                const fallbackValue = `/${fallbackEntitySet}(GUID)`;
                return `<input type="text" class="pdt-input" data-prop="${dataProp}" data-type="lookup" data-target-entity="${targetEntity}" data-entity-set="${fallbackEntitySet}" placeholder="${fallbackPlaceholder}" value="${fallbackValue}" title="${fallbackTitle}"${spanStyle}>`;
            }
        }

        return `<input type="text" class="pdt-input" data-prop="${dataProp}" data-type="lookup" data-target-entity="${targetEntity}" placeholder="Record GUID"${styleAttr}>`;
    }

    /**
     * Build memo/multiline text input.
     * @private
     */
    static _buildMemoInput(dataProp, spanStyle) {
        let styleAttr = spanStyle || '';
        if (styleAttr) {
            const styleContent = styleAttr.replace(/^\s*style="|"$/g, '').trim();
            styleAttr = ` style="${styleContent} resize: vertical;"`;
        } else {
            styleAttr = ' class="pdt-textarea-resizable"';
        }
        return `<textarea class="pdt-input" data-prop="${dataProp}" data-type="memo" rows="2" placeholder="Text value"${styleAttr}></textarea>`;
    }
    /**
     * Build string/single-line text input.
     * @private
     */
    static _buildStringInput(dataProp, styleAttr) {
        return `<input type="text" class="pdt-input" data-prop="${dataProp}" data-type="string" maxlength="4000" placeholder="Text value"${styleAttr}>`;
    }

    /**
     * Build uniqueidentifier/GUID input.
     * @private
     */
    static _buildUniqueIdentifierInput(dataProp, styleAttr) {
        return `<input type="text" class="pdt-input" data-prop="${dataProp}" data-type="uniqueidentifier" placeholder="00000000-0000-0000-0000-000000000000" pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"${styleAttr}>`;
    }

    /**
     * Build image field input (base64 or URL).
     * @private
     */
    static _buildImageInput(dataProp, styleAttr) {
        return `<div class="pdt-file-upload-container" data-prop="${dataProp}" data-type="image"${styleAttr}>
            <input type="file" class="pdt-file-input" accept="image/*" style="display:none">
            <button type="button" class="modern-button secondary pdt-file-select-btn">Select Image</button>
            <span class="pdt-file-name"></span>
            <input type="text" class="pdt-input pdt-file-data" placeholder="Or paste base64/URL" style="margin-top: 8px;">
        </div>`;
    }

    /**
     * Build file field input with file picker.
     * @private
     */
    static _buildFileInput(dataProp, styleAttr) {
        return `<div class="pdt-file-upload-container" data-prop="${dataProp}" data-type="file"${styleAttr}>
            <input type="file" class="pdt-file-input" style="display:none">
            <button type="button" class="modern-button secondary pdt-file-select-btn">Select File</button>
            <span class="pdt-file-name"></span>
            <input type="text" class="pdt-input pdt-file-data" placeholder="Or paste base64" style="margin-top: 8px;">
        </div>`;
    }

    /**
     * Build entity name picklist input.
     * @private
     */
    static _buildEntityNameInput(dataProp, styleAttr) {
        return `<input type="text" class="pdt-input" data-prop="${dataProp}" data-type="entityname" placeholder="Logical name (e.g., account)"${styleAttr}>`;
    }

    /**
     * Build read-only/unsupported field input.
     * @private
     */
    static _buildReadOnlyInput(dataProp, styleAttr, attrType) {
        return `<input type="text" class="pdt-input" data-prop="${dataProp}" data-type="readonly" placeholder="${attrType} (read-only/unsupported)" disabled${styleAttr}>`;
    }
    /**
     * Build default text input.
     * @private
     */
    static _buildDefaultInput(dataProp, styleAttr) {
        return `<input type="text" class="pdt-input" data-prop="${dataProp}" data-type="text" placeholder="Value"${styleAttr}>`;
    }
}
