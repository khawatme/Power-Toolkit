/**
 * @file FilterGroupManager
 * @description Manages filter groups with inter-group operators for both WebAPI and FetchXML tabs.
 * @module ui/FilterGroupManager
 */

import { ICONS } from '../assets/Icons.js';
import { FILTER_OPERATORS, shouldShowOperatorValue } from '../helpers/index.js';
import { MetadataHelpers } from '../helpers/metadata.helpers.js';

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

        const optionsHtml = FILTER_OPERATORS
            .filter(op => op[this.operatorFilter])
            .map(op => `<option value="${op[this.operatorFilter]}">${op.text}</option>`)
            .join('');

        conditionGroup.innerHTML = `
            <div class="pdt-input-with-button">
                <input type="text" class="pdt-input" data-prop="attribute" placeholder="Attribute">
                <button class="pdt-input-btn browse-condition-attr" title="Browse columns">${ICONS.inspector}</button>
            </div>
            <select class="pdt-select" data-prop="operator">${optionsHtml}</select>
            <div class="pdt-value-container">
                <input type="text" class="pdt-input" data-prop="value" placeholder="Value" style="width: 100%;">
            </div>
            <button class="modern-button danger secondary pdt-condition-remove">X</button>`;

        return conditionGroup;
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
                    await this.renderValueInput(attr, conditionGroup, this.getEntityContext);
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

            if (attrName && attrName.length > 2 && this.getAttributeMetadata && !isLoadingMetadata) {
                isLoadingMetadata = true;
                try {
                    const entityName = await this.getEntityContext();
                    if (entityName) {
                        const attr = await this.getAttributeMetadata(attrName, entityName);
                        if (attr) {
                            await this.renderValueInput(attr, conditionGroup, this.getEntityContext);
                            this.onUpdate();
                        }
                    }
                } catch (_error) {
                    // Silently fail - keep text input if metadata not available
                } finally {
                    isLoadingMetadata = false;
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
        const { conditionGroup, operatorSelect } = elements;

        const operatorChangeHandler = () => {
            const shouldShow = shouldShowOperatorValue(operatorSelect.value);
            const currentValueInput = conditionGroup.querySelector('[data-prop="value"]');

            if (currentValueInput) {
                currentValueInput.disabled = !shouldShow;
                if (currentValueInput.tagName === 'INPUT') {
                    currentValueInput.placeholder = shouldShow ? 'Value' : 'N/A';
                }
                if (!shouldShow) {
                    currentValueInput.value = '';
                }
            }
            this.onUpdate();
        };

        if (operatorSelect) {
            operatorSelect.addEventListener('change', operatorChangeHandler);
            this.handlers.set(operatorSelect, { event: 'change', handler: operatorChangeHandler });
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
