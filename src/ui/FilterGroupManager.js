/**
 * @file FilterGroupManager
 * @description Manages filter groups with inter-group operators for both WebAPI and FetchXML tabs.
 * @module ui/FilterGroupManager
 */

import { ICONS } from '../assets/Icons.js';
import { filterOperatorsFor, findFilterOperator, shouldShowOperatorValue } from '../helpers/index.js';
import { MetadataHelpers } from '../helpers/metadata.helpers.js';

/**
 * The default, type-agnostic value editor. Shared by initial render and by the reset applied
 * when an attribute is cleared, so the two cannot drift apart.
 * @private @type {string}
 */
const PLAIN_VALUE_INPUT_HTML =
    '<input type="text" class="pdt-input" data-prop="value" placeholder="Value" style="width: 100%;">';

/**
 * Editor for operators whose argument is a count rather than a column value, such as
 * "Last X Days". The column may be a date, but the value is a number, so the column's own
 * date picker would be the wrong control.
 * @private @type {string}
 */
const NUMERIC_VALUE_INPUT_HTML =
    '<input type="number" min="1" step="1" class="pdt-input" data-prop="value" placeholder="Number" style="width: 100%;">';

/**
 * Editors for operators that dictate their own argument type, keyed by the operator's `arg`.
 *
 * These override the column's editor. "Last X Days" needs a count even on a date column, and the
 * whole-day functions need a date without a time — asking for a time the function ignores just
 * invites the question of which time to enter.
 * @private @type {Object<string, {type: string, html: string}>}
 */
const OPERATOR_ARG_INPUTS = {
    number: { type: 'number', html: NUMERIC_VALUE_INPUT_HTML },
    date: {
        type: 'date',
        html: '<input type="date" class="pdt-input" data-prop="value" style="width: 100%;">'
    }
};

/**
 * Manages filter groups and conditions for query builders.
 * Provides a unified interface for WebAPI and FetchXML tabs to create filter UI.
 * @class FilterGroupManager
 */
export class FilterGroupManager {
    /**
     * Creates a FilterGroupManager instance.
     * @param {Object} config - Configuration object
     * @param {Map<HTMLElement, {event: string, handler: Function}>} config.handlers - Dynamic handlers map for cleanup
     * @param {Function} config.getEntityContext - Async function that returns entity name for column browser
     * @param {Function} config.renderValueInput - Async function that renders smart value input (attr, conditionGroup, getEntityContext)
     * @param {Function} [config.getAttributeMetadata] - Async function that returns attribute metadata by name (attrName, entityName)
     * @param {boolean} [config.showNotOperator=false] - Whether to show NOT operator (WebAPI only)
     * @param {string} [config.operatorFilter='fetch'] - Which operators to use: 'fetch' or 'odata'
     * @param {Function} [config.onUpdate] - Optional callback when filters change (for WebAPI preview)
     */
    constructor(config) {
        this.handlers = config.handlers;
        this.getEntityContext = config.getEntityContext;
        this.renderValueInput = config.renderValueInput;
        this.getAttributeMetadata = config.getAttributeMetadata || null;
        this.showNotOperator = config.showNotOperator ?? false;
        this.operatorFilter = config.operatorFilter || 'fetch';
        this.onUpdate = config.onUpdate || (() => { });
    }

    /**
     * Add a filter group with its own filter type (AND/OR/NOT) and conditions.
     * @param {HTMLElement} container - Parent container for filter groups
     * @param {boolean} [isFirst=false] - Whether this is the first filter group
     */
    addFilterGroup(container, isFirst = false) {
        if (!isFirst && container) {
            const separator = document.createElement('div');
            separator.className = 'pdt-filter-group-separator';
            separator.innerHTML = `
                <div class="pdt-filter-group-operator">
                    <select class="pdt-select pdt-select-narrow" data-prop="inter-group-operator">
                        <option value="and" selected>AND</option>
                        <option value="or">OR</option>
                    </select>
                </div>
            `;
            const operatorSelect = separator.querySelector('[data-prop="inter-group-operator"]');
            const operatorChangeHandler = () => this.onUpdate();
            operatorSelect.addEventListener('change', operatorChangeHandler);
            this.handlers.set(operatorSelect, { event: 'change', handler: operatorChangeHandler });

            container.appendChild(separator);
        }

        const filterGroup = document.createElement('div');
        filterGroup.className = 'pdt-filter-group';

        const filterTypeOptions = this.showNotOperator
            ? '<option value="and" selected>AND</option><option value="or">OR</option><option value="not">NOT</option>'
            : '<option value="and" selected>AND</option><option value="or">OR</option>';

        filterGroup.innerHTML = `
            <div class="pdt-filter-group-header">
                <label class="pdt-filter-group-label">Filter Group</label>
                <div class="pdt-filter-group-header-controls">
                    <select class="pdt-select pdt-select-medium" data-prop="filter-type">
                        ${filterTypeOptions}
                    </select>
                    <button class="modern-button danger secondary pdt-filter-group-remove" title="Remove filter group">Remove Group</button>
                </div>
            </div>
            <div class="pdt-filter-group-conditions"></div>
            <button class="modern-button secondary pdt-filter-group-add-condition mt-10">Add Condition</button>
        `;

        const conditionsContainer = filterGroup.querySelector('.pdt-filter-group-conditions');
        const removeGroupBtn = filterGroup.querySelector('.pdt-filter-group-remove');
        const addConditionBtn = filterGroup.querySelector('.pdt-filter-group-add-condition');
        const filterTypeSelect = filterGroup.querySelector('[data-prop="filter-type"]');

        const updateRemoveButtonState = () => {
            removeGroupBtn.disabled = false;
        };

        updateRemoveButtonState();

        const addConditionHandler = () => {
            this.addCondition(conditionsContainer, false);
            if (isFirst) {
                updateRemoveButtonState();
            }
            this.onUpdate();
        };
        addConditionBtn.addEventListener('click', addConditionHandler);
        this.handlers.set(addConditionBtn, { event: 'click', handler: addConditionHandler });

        const removeGroupHandler = () => {
            if (filterGroup._observer) {
                filterGroup._observer.disconnect();
                filterGroup._observer = null;
            }

            if (filterGroup._inputHandler) {
                conditionsContainer.removeEventListener('input', filterGroup._inputHandler);
                filterGroup._inputHandler = null;
            }

            filterGroup.querySelectorAll('.browse-condition-attr, .pdt-condition-remove, [data-prop="operator"]').forEach(el => {
                if (this.handlers.has(el)) {
                    const { event, handler } = this.handlers.get(el);
                    el.removeEventListener(event, handler);
                    this.handlers.delete(el);
                }
            });

            const previousSibling = filterGroup.previousElementSibling;
            if (previousSibling && previousSibling.classList.contains('pdt-filter-group-separator')) {
                const operatorSelect = previousSibling.querySelector('[data-prop="inter-group-operator"]');
                if (operatorSelect && this.handlers.has(operatorSelect)) {
                    const { event, handler } = this.handlers.get(operatorSelect);
                    operatorSelect.removeEventListener(event, handler);
                    this.handlers.delete(operatorSelect);
                }
                previousSibling.remove();
            }

            filterGroup.remove();
            this.onUpdate();
        };
        removeGroupBtn.addEventListener('click', removeGroupHandler);
        this.handlers.set(removeGroupBtn, { event: 'click', handler: removeGroupHandler });

        const filterTypeChangeHandler = () => this.onUpdate();
        filterTypeSelect.addEventListener('change', filterTypeChangeHandler);
        this.handlers.set(filterTypeSelect, { event: 'change', handler: filterTypeChangeHandler });

        if (container) {
            container.appendChild(filterGroup);
        }

        this.addCondition(conditionsContainer, true);

        if (isFirst) {
            const observer = new MutationObserver(() => updateRemoveButtonState());
            observer.observe(conditionsContainer, { childList: true, subtree: true, characterData: true });

            filterGroup._observer = observer;
            const inputHandler = () => updateRemoveButtonState();
            conditionsContainer.addEventListener('input', inputHandler);
            filterGroup._inputHandler = inputHandler;
        }
    }

    /**
     * Add a condition row to a filter group.
     * @param {HTMLElement} container - The conditions container within a filter group
     * @param {boolean} [isFirst=false] - Whether this is the first condition in the group
     */
    addCondition(container, isFirst = false) {
        const conditionGroup = this._createConditionElement(isFirst);
        const elements = this._getConditionElements(conditionGroup);

        this._setupBrowseButton(elements, conditionGroup, isFirst);
        this._setupAttributeAutoDetection(elements, conditionGroup, isFirst);
        this._setupRemoveButton(elements, container);
        this._setupOperatorChange(elements);

        container.appendChild(conditionGroup);
    }

    /**
     * Create the DOM element for a condition row.
     * @private
     * @returns {HTMLElement} The condition row element
     */
    _createConditionElement() {
        const conditionGroup = document.createElement('div');
        conditionGroup.className = 'pdt-condition-grid';

        // No column is known yet, so only type-agnostic operators are offered. Type-specific ones
        // are added by _applyOperatorOptions once the column resolves.
        const optionsHtml = this._buildOperatorOptions(null);

        conditionGroup.innerHTML = `
            <div class="pdt-input-with-button">
                <input type="text" class="pdt-input" data-prop="attribute" placeholder="Attribute">
                <button class="pdt-input-btn browse-condition-attr" title="Browse columns">${ICONS.inspector}</button>
            </div>
            <select class="pdt-select" data-prop="operator">${optionsHtml}</select>
            <div class="pdt-value-container">${PLAIN_VALUE_INPUT_HTML}</div>
            <button class="modern-button danger secondary pdt-condition-remove">X</button>`;

        return conditionGroup;
    }

    /**
     * Builds the operator `<option>` markup for a column type.
     * @private
     * @param {string|null} attrType - Resolved column category, or null when unknown
     * @returns {string} Option markup
     */
    _buildOperatorOptions(attrType) {
        return filterOperatorsFor(this.operatorFilter, attrType)
            .map(op => `<option value="${op[this.operatorFilter]}">${op.text}</option>`)
            .join('');
    }

    /**
     * Narrows a column's metadata to the category used for operator filtering.
     *
     * Handles both shapes the callers supply: the compact attribute map (`{type: 'date'}`) and raw
     * Dataverse metadata (`AttributeTypeName.Value === 'DateTimeType'`).
     * @private
     * @param {Object|null} attr - Column metadata
     * @returns {string|null} Category, or null when it has no type-specific operators
     */
    _resolveOperatorCategory(attr) {
        if (!attr) {
            return null;
        }
        if (typeof attr.type === 'string') {
            return attr.type;
        }

        const typeName = attr.AttributeTypeName?.Value || attr.AttributeType || '';
        return /datetime/i.test(typeName) ? 'date' : null;
    }

    /**
     * Rebuilds the operator list for the resolved column type.
     *
     * Keeps the current selection when it is still offered; otherwise falls back to the first
     * option, so a date function can never be left selected on a column that has no such
     * operator.
     * @private
     * @param {Object} elements - Condition elements
     * @param {Object|null} attr - Column metadata, or null when the column is unknown
     */
    _applyOperatorOptions(elements, attr) {
        const { operatorSelect } = elements;
        if (!operatorSelect) {
            return;
        }

        const previous = operatorSelect.value;
        operatorSelect.innerHTML = this._buildOperatorOptions(this._resolveOperatorCategory(attr));

        const stillOffered = [...operatorSelect.options].some(o => o.value === previous);
        operatorSelect.value = stillOffered ? previous : (operatorSelect.options[0]?.value ?? '');

        if (!stillOffered) {
            // The operator changed underneath the user, so the value editor must follow it.
            this._applyOperatorState(elements);
        }
    }

    /**
     * Replaces a type-specific editor with the plain one, leaving an already-plain editor alone.
     *
     * Detection re-runs on every keystroke, so an unconditional reset would wipe whatever the
     * user is typing into the value box each time. Only the first pass, which discards the
     * previous column's picker or dropdown, needs to touch it.
     * @private
     * @param {Object} elements - Condition elements
     */
    _resetTypeSpecificValueInput(elements) {
        const current = elements.conditionGroup.querySelector('[data-prop="value"]');
        const isPlainText = current?.tagName === 'INPUT'
            && (current.type === 'text' || !current.type);

        if (!isPlainText) {
            this._resetValueInput(elements);
        }
    }

    /**
     * Restores the plain text value editor, discarding any type-specific input.
     *
     * Needed when the attribute is cleared: a picklist or lookup editor left behind would keep
     * offering values from a column the condition no longer references.
     * @private
     * @param {Object} elements - Condition elements
     */
    _resetValueInput(elements) {
        const { valueContainer } = elements;
        if (!valueContainer) {
            return;
        }

        valueContainer.innerHTML = PLAIN_VALUE_INPUT_HTML;
        this._applyOperatorState(elements);
        this.onUpdate();
    }

    /**
     * Get all interactive elements from a condition row.
     * @private
     * @param {HTMLElement} conditionGroup - The condition row element
     * @returns {Object} Object containing all interactive elements
     */
    _getConditionElements(conditionGroup) {
        return {
            conditionGroup,
            operatorSelect: conditionGroup.querySelector('[data-prop="operator"]'),
            valueContainer: conditionGroup.querySelector('.pdt-value-container'),
            attributeInput: conditionGroup.querySelector('[data-prop="attribute"]'),
            removeBtn: conditionGroup.querySelector('button.pdt-condition-remove'),
            browseBtn: conditionGroup.querySelector('.browse-condition-attr')
        };
    }

    /**
     * Setup the browse button handler for column selection.
     * @private
     * @param {Object} elements - Condition elements
     * @param {HTMLElement} conditionGroup - The condition row element
     * @param {boolean} isFirst - Whether this is the first condition
     */
    _setupBrowseButton(elements, conditionGroup, isFirst) {
        const { attributeInput, browseBtn } = elements;

        const browseHandler = async () => {
            await MetadataHelpers.showColumnBrowser(
                () => this.getEntityContext(),
                async (attr) => {
                    attributeInput.value = attr.LogicalName;
                    conditionGroup._attrMetadata = attr;
                    this._applyOperatorOptions(elements, attr);
                    await this.renderValueInput(attr, conditionGroup, this.getEntityContext);
                    // Re-apply operator state to the new value input
                    this._applyOperatorState(elements);
                    if (isFirst) {
                        this._updateRemoveButtonState(elements);
                    }
                    this.onUpdate();
                }
            );
        };

        if (browseBtn) {
            browseBtn.addEventListener('click', browseHandler);
            this.handlers.set(browseBtn, { event: 'click', handler: browseHandler });
        }
    }

    /**
     * Setup auto-detection of attribute types when manually entered.
     * @private
     * @param {Object} elements - Condition elements
     * @param {HTMLElement} conditionGroup - The condition row element
     * @param {boolean} isFirst - Whether this is the first condition
     */
    _setupAttributeAutoDetection(elements, conditionGroup, isFirst) {
        const { attributeInput } = elements;
        let isLoadingMetadata = false;
        let debounceTimer = null;

        const detectAttributeType = async () => {
            const attrName = attributeInput.value.trim().toLowerCase();

            if (!attrName) {
                this._resetValueInput(elements);
                this._applyOperatorOptions(elements, null);
            } else if (attrName.length > 2 && this.getAttributeMetadata && !isLoadingMetadata) {
                isLoadingMetadata = true;
                let resolved = null;
                try {
                    const entityName = await this.getEntityContext();
                    if (entityName) {
                        resolved = await this.getAttributeMetadata(attrName, entityName);
                    }
                } catch (_error) {
                    // Silently fail - keep text input if metadata not available
                } finally {
                    isLoadingMetadata = false;
                }

                // Applied even when the column did not resolve. Otherwise a name that matches
                // nothing leaves the previous column's type-specific operators in the list.
                this._applyOperatorOptions(elements, resolved);
                conditionGroup._attrMetadata = resolved || null;

                if (resolved) {
                    try {
                        await this.renderValueInput(resolved, conditionGroup, this.getEntityContext);
                        // Re-apply operator state to the new value input
                        this._applyOperatorState(elements);
                        this.onUpdate();
                    } catch (_error) {
                        // Keep whatever editor is present if rendering fails
                    }
                } else {
                    // The editor has to go with the operators: a date picker left behind belongs
                    // to a column this condition no longer names.
                    this._resetTypeSpecificValueInput(elements);
                }
            }

            if (isFirst) {
                this._updateRemoveButtonState(elements);
            }
        };

        const debouncedHandler = () => {
            if (isFirst) {
                this._updateRemoveButtonState(elements);
            }
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => detectAttributeType(), 300);
        };

        const handleEnterKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(debounceTimer);
                detectAttributeType();
            }
        };

        attributeInput.addEventListener('blur', detectAttributeType);
        attributeInput.addEventListener('input', debouncedHandler);
        attributeInput.addEventListener('keydown', handleEnterKey);
        this.handlers.set(attributeInput, { event: 'blur', handler: detectAttributeType });

        if (isFirst) {
            const valueInput = conditionGroup.querySelector('[data-prop="value"]');
            if (valueInput) {
                const valueInputHandler = () => this._updateRemoveButtonState(elements);
                valueInput.addEventListener('input', valueInputHandler);
            }
        }
    }

    /**
     * Setup the remove button handler.
     * @private
     * @param {Object} elements - Condition elements
     * @param {HTMLElement} container - The conditions container
     */
    _setupRemoveButton(elements, container) {
        const { conditionGroup, attributeInput, valueContainer, operatorSelect, removeBtn, browseBtn } = elements;

        const removeHandler = () => {
            if (container && container.querySelectorAll('.pdt-condition-grid').length === 1) {
                attributeInput.value = '';
                valueContainer.innerHTML = '<input type="text" class="pdt-input" data-prop="value" placeholder="Value" style="width: 100%;">';
                operatorSelect.selectedIndex = 0;
                removeBtn.disabled = true;
                this.onUpdate();
                return;
            }

            if (browseBtn && this.handlers.has(browseBtn)) {
                const { event, handler } = this.handlers.get(browseBtn);
                browseBtn.removeEventListener(event, handler);
                this.handlers.delete(browseBtn);
            }

            conditionGroup.remove();
            this.onUpdate();
        };

        if (removeBtn) {
            removeBtn.addEventListener('click', removeHandler);
            this.handlers.set(removeBtn, { event: 'click', handler: removeHandler });
        }
    }

    /**
     * Setup the operator change handler.
     * @private
     * @param {Object} elements - Condition elements
     */
    _setupOperatorChange(elements) {
        const { operatorSelect } = elements;

        const operatorChangeHandler = () => {
            this._syncValueInputToOperator(elements);
            // Shares _applyOperatorState rather than repeating the disabled/placeholder rules.
            this._applyOperatorState(elements);
            this.onUpdate();
        };

        if (operatorSelect) {
            operatorSelect.addEventListener('change', operatorChangeHandler);
            this.handlers.set(operatorSelect, { event: 'change', handler: operatorChangeHandler });
        }
    }

    /**
     * Swaps the value editor when the operator expects a different kind of value than the column.
     *
     * "Last X Days" takes a count, so a date column's picker is wrong for it; switching back to a
     * normal operator restores the column's own editor.
     *
     * Runs synchronously so the caller's disabled and placeholder handling is not delayed. When a
     * column editor has to be rebuilt, a plain input goes in immediately and the metadata-driven
     * control replaces it once ready.
     * @private
     * @param {Object} elements - Condition elements
     */
    _syncValueInputToOperator(elements) {
        const { conditionGroup, valueContainer, operatorSelect } = elements;
        if (!valueContainer) {
            return;
        }

        const definition = findFilterOperator(operatorSelect?.value, this.operatorFilter);
        const wanted = OPERATOR_ARG_INPUTS[definition?.arg];

        const current = conditionGroup.querySelector('[data-prop="value"]');
        const currentType = current?.tagName === 'INPUT' ? (current.type || 'text') : null;

        if (wanted) {
            // Switching between two operators with the same argument keeps the typed value.
            if (currentType !== wanted.type) {
                valueContainer.innerHTML = wanted.html;
            }
            return;
        }

        // The operator wants whatever the column itself uses, so only an editor this method
        // forced earlier needs replacing.
        const wasForced = Object.values(OPERATOR_ARG_INPUTS).some(i => i.type === currentType);
        if (!wasForced) {
            return;
        }

        valueContainer.innerHTML = PLAIN_VALUE_INPUT_HTML;

        const attr = conditionGroup._attrMetadata;
        if (attr && this.renderValueInput) {
            Promise.resolve(this.renderValueInput(attr, conditionGroup, this.getEntityContext))
                .then(() => this._applyOperatorState(elements))
                .catch(() => { /* the plain editor above is already usable */ });
        }
    }

    /**
     * Update the remove button state.
     * @private
     * @param {Object} elements - Condition elements
     */
    _updateRemoveButtonState(elements) {
        const { removeBtn } = elements;
        removeBtn.disabled = false;
    }

    /**
     * Apply operator state to the value input (disabled for null operators).
     * This should be called after the value input is re-rendered.
     * @private
     * @param {Object} elements - Condition elements
     */
    _applyOperatorState(elements) {
        const { conditionGroup, operatorSelect } = elements;
        const shouldShow = shouldShowOperatorValue(operatorSelect?.value);
        const currentValueInput = conditionGroup.querySelector('[data-prop="value"]');

        if (currentValueInput) {
            currentValueInput.disabled = !shouldShow;
            if (currentValueInput.tagName === 'INPUT') {
                const op = operatorSelect?.value;
                if (op === 'in' || op === 'not-in') {
                    currentValueInput.placeholder = 'val1,val2,val3';
                } else {
                    currentValueInput.placeholder = shouldShow ? 'Value' : 'N/A';
                }
            }
            if (!shouldShow) {
                currentValueInput.value = '';
            }
        }
    }

    /**
     * Extract filter groups from a container. Each group has its own filter type, conditions, and inter-group operator.
     * @param {HTMLElement|null} container - The filters container
     * @returns {Array<{filterType: string, filters: Array<{attr: string, op: string, value: string}>, interGroupOperator?: string}>} - Array of filter group objects
     */
    extractFilterGroups(container) {
        if (!container) {
            return [];
        }

        const result = [];
        const children = Array.from(container.children);
        let currentInterGroupOp = null;

        for (const child of children) {
            if (child.classList.contains('pdt-filter-group-separator')) {
                currentInterGroupOp = child.querySelector('[data-prop="inter-group-operator"]')?.value || 'and';
            } else if (child.classList.contains('pdt-filter-group')) {
                const filterType = child.querySelector('[data-prop="filter-type"]')?.value || 'and';
                const filters = [...child.querySelectorAll('.pdt-condition-grid')].map(row => {
                    const valueInput = row.querySelector('[data-prop="value"]');
                    let value = '';

                    if (valueInput?.classList?.contains('pdt-multiselect-dropdown')) {
                        const checkedBoxes = valueInput.querySelectorAll('input[type="checkbox"]:checked');
                        const values = Array.from(checkedBoxes).map(cb => cb.value);
                        value = values.join(',');
                    } else if (valueInput?.value !== undefined) {
                        value = valueInput.value.trim();
                    }

                    return {
                        attr: row.querySelector('[data-prop="attribute"]')?.value.trim() || '',
                        op: row.querySelector('[data-prop="operator"]')?.value || '',
                        value: value
                    };
                }).filter(f => f.attr && f.op);

                const group = { filterType, filters };
                if (currentInterGroupOp) {
                    group.interGroupOperator = currentInterGroupOp;
                }

                if (filters.length > 0) {
                    result.push(group);
                }

                currentInterGroupOp = null;
            }
        }

        return result;
    }
}
