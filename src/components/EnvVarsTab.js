/**
 * @file Environment Variables viewer and editor component.
 * @module components/EnvVarsTab
 * @description Fetches, displays, and allows editing of all Environment Variables and their current values.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { DataService } from '../services/DataService.js';
import { UIFactory } from '../ui/UIFactory.js';
import { Helpers } from '../utils/Helpers.js';
import { NotificationService } from '../services/NotificationService.js';

/**
 * @typedef {import('../services/DataService.js').EnvironmentVariable} EnvironmentVariable
 */

export class EnvironmentVariablesTab extends BaseComponent {
    /**
     * Initializes the EnvironmentVariablesTab component.
     */
    constructor() {
        super('envVars', 'Env Variables', ICONS.envVars);
        this.ui = {};
        this.allVars = [];
        this.filterCards = Helpers.debounce(this._filterCards, 250);
    }

    /**
     * Renders the component's HTML structure by fetching and displaying environment variables.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="section-title">Environment Variables</div>
            <div class="pdt-toolbar">
                <input type="text" id="env-var-search" class="pdt-input" placeholder="Search by name, type, or value..." style="flex-grow: 1;">
            </div>
            <div id="env-var-list" class="pdt-content-host pdt-card-grid"><p class="pdt-note">Loading...</p></div>`;

        this.ui.listContainer = container.querySelector('#env-var-list');

        try {
            this.allVars = await DataService.getEnvironmentVariables();
            this.ui.listContainer.innerHTML = '';

            if (this.allVars.length === 0) {
                this.ui.listContainer.innerHTML = '<p class="pdt-note">No environment variables found in this environment.</p>';
            } else {
                const fragment = document.createDocumentFragment();
                this.allVars.forEach(v => {
                    fragment.appendChild(this._createCardElement(v));
                });
                this.ui.listContainer.appendChild(fragment);
            }
        } catch (e) {
            this.ui.listContainer.innerHTML = `<div class="pdt-error">Could not retrieve environment variables: ${e.message}</div>`;
        }

        return container;
    }

    /**
     * Caches UI elements and attaches a single delegated event listener for all card interactions.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        this.ui.searchInput = element.querySelector('#env-var-search');
        this.ui.listContainer = element.querySelector('#env-var-list');
        this.ui.searchInput.addEventListener('keyup', () => this.filterCards());
        
        this.ui.listContainer.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            const copyable = e.target.closest('.copyable');

            if (button) {
                if (button.matches('.copy-btn')) {
                    const codeBlock = button.closest('.copyable-code-block');
                    if (codeBlock) {
                        const codeElement = codeBlock.querySelector('pre, code');
                        if (codeElement) {
                            Helpers.copyToClipboard(codeElement.textContent);
                        }
                    }
                    return;
                }
                const card = button.closest('.env-var-card');
                if (button.matches('.edit-btn')) this._switchToEditMode(card);
                if (button.matches('.cancel-btn')) this._switchToViewMode(card);
                if (button.matches('.save-btn')) await this._handleSaveClick(card);
            }
        });
    }

    /**
     * Creates and returns a DOM element for a single environment variable card.
     * @param {EnvironmentVariable} variable - The environment variable data object.
     * @returns {HTMLElement} The fully constructed card element.
     * @private
     */
    _createCardElement(variable) {
        const card = document.createElement('div');
        card.className = 'env-var-card';

        // Consolidate searchable text generation
        const searchableText = [
            variable.displayName, variable.schemaName, variable.type,
            variable.currentValue, variable.defaultValue
        ].join(' ').toLowerCase();

        // Assign all data attributes for state management
        card.dataset.searchTerm = searchableText;
        card.dataset.definitionId = variable.definitionId;
        card.dataset.valueId = variable.valueId || '';
        card.dataset.originalValue = variable.currentValue ?? '';

        card.innerHTML = `
            <div class="pdt-card-header">${Helpers.escapeHtml(variable.displayName)}</div>
            <div class="pdt-card-body">
                <div class="info-grid">
                    <strong>Schema Name:</strong><span class="copyable code-like" title="Click to copy">${Helpers.escapeHtml(variable.schemaName)}</span>
                    <strong>Type:</strong><span>${Helpers.escapeHtml(variable.type)}</span>
                    <strong>Current Value:</strong><div class="pdt-value-wrapper"></div>
                    <strong>Default Value:</strong><div class="pdt-value-wrapper-default"></div>
                </div>
            </div>
            <div class="pdt-card-footer">
                <button class="modern-button secondary edit-btn">Edit</button>
            </div>
        `;

        // Append complex, interactive elements after the main structure is created
        const currentValueWrapper = card.querySelector('.pdt-value-wrapper');
        currentValueWrapper.appendChild(this._formatValue(variable.currentValue, true));

        const defaultValueWrapper = card.querySelector('.pdt-value-wrapper-default');
        defaultValueWrapper.appendChild(this._formatValue(variable.defaultValue, true));

        return card;
    }

    /**
     * Formats a value for display.
     * @param {string} value - The value to format.
     * @param {boolean} isCopyable - Whether the value should be copyable.
     * @returns {HTMLElement} The HTML element for the formatted value.
     * @private
     */
    _formatValue(value, isCopyable) {
        const valStr = String(value ?? '').trim();

        if ((valStr.startsWith('{') && valStr.endsWith('}')) || (valStr.startsWith('[') && valStr.endsWith(']'))) {
            try {
                JSON.parse(valStr);
                return UIFactory.createCopyableCodeBlock(valStr, 'json');
            } catch (e) { /* Fall through to display as plain text */ }
        }
        
        // For plain text, create and return a SPAN element
        const span = document.createElement('span');
        if (isCopyable) {
            span.className = 'copyable';
            span.title = 'Click to copy';
        }
        span.textContent = value;
        return span;
    }

    /**
     * Switches a card's UI to an editable state. Replaces the value display
     * with a textarea, pretty-prints JSON for editing, and sets up real-time
     * change detection to enable/disable the save button.
     * @param {HTMLElement} card - The card element to modify.
     * @private
     */
    _switchToEditMode(card) {
        const valueWrapper = card.querySelector('.info-grid .pdt-value-wrapper');
        const originalValue = card.dataset.originalValue === '(not set)' ? '' : card.dataset.originalValue;
        let valueToEdit = originalValue;

        // Pretty-print JSON for the editor, if applicable.
        const valStr = String(valueToEdit).trim();
        if ((valStr.startsWith('{') && valStr.endsWith('}')) || (valStr.startsWith('[') && valStr.endsWith(']'))) {
            try {
                valueToEdit = JSON.stringify(JSON.parse(valStr), null, 2);
            } catch (e) { /* use original string on parse error */ }
        }
        
        // Create the textarea programmatically and set its value directly to preserve newlines.
        const lineCount = (valueToEdit.match(/\n/g) || []).length + 1;
        const textarea = document.createElement('textarea');
        textarea.className = 'pdt-textarea env-var-edit-area';
        textarea.rows = Math.max(4, Math.min(lineCount, 15));
        textarea.value = valueToEdit;

        valueWrapper.innerHTML = '';
        valueWrapper.appendChild(textarea);
        
        const footer = card.querySelector('.pdt-card-footer');
        footer.innerHTML = `
            <button class="modern-button secondary cancel-btn">Cancel</button>
            <button class="modern-button save-btn" disabled>Save</button>
        `;
        const saveBtn = footer.querySelector('.save-btn');

        // Add an event listener to the textarea to enable/disable the save button on change.
        textarea.addEventListener('input', () => {
            let currentValue = textarea.value;
            let originalStoredValue = card.dataset.originalValue;
            
            // Normalize both values for a reliable comparison, ignoring whitespace differences in JSON.
            try {
                const currentParsed = JSON.parse(currentValue);
                const originalParsed = JSON.parse(originalStoredValue);
                currentValue = JSON.stringify(currentParsed);
                originalStoredValue = JSON.stringify(originalParsed);
            } catch (e) {
                currentValue = currentValue.trim();
                originalStoredValue = originalStoredValue === '(not set)' ? '' : originalStoredValue.trim();
            }
            
            saveBtn.disabled = (currentValue === originalStoredValue);
        });
    }

    /**
     * Switches a card's UI back to view-only mode.
     * @param {HTMLElement} card - The card element to revert.
     * @param {string} [newValue] - If provided, the card's display and underlying
     * `data-original-value` will be updated to this new value. Otherwise, it
     * reverts to its original state.
     * @private
     */
    _switchToViewMode(card, newValue) {
        const valueToDisplay = newValue !== undefined ? newValue : card.dataset.originalValue;
        
        const valueWrapper = card.querySelector('.info-grid .pdt-value-wrapper');
        valueWrapper.innerHTML = '';
        valueWrapper.appendChild(this._formatValue(valueToDisplay, true));

        const footer = card.querySelector('.pdt-card-footer');
        footer.innerHTML = `<button class="modern-button secondary edit-btn">Edit</button>`;
        
        // If a new value was saved, update the original value and searchable text
        if (newValue !== undefined) {
            card.dataset.originalValue = newValue;
            const schemaNameEl = card.querySelector('.info-grid .code-like');
            const newSearchTerm = (card.querySelector('.pdt-card-header').textContent + ' ' + schemaNameEl.textContent + ' ' + newValue).toLowerCase();
            card.dataset.searchTerm = newSearchTerm;
        }
    }

    /**
     * Handles the save button click, minifying JSON before saving and updating the UI.
     * @param {HTMLElement} card - The card element being saved.
     * @private
     */
    async _handleSaveClick(card) {
        const definitionId = card.dataset.definitionId;
        const valueId = card.dataset.valueId;
        const textarea = card.querySelector('.env-var-edit-area');
        let newValue = textarea.value.trim();

        // Before saving, check if the value is JSON and minify it to a compact string.
        try {
            // This will parse the pretty-printed JSON and re-stringify it without extra whitespace.
            const parsed = JSON.parse(newValue);
            newValue = JSON.stringify(parsed);
        } catch (e) {
            // If it's not valid JSON, we'll just save the trimmed text as is.
        }

        textarea.disabled = true;
        card.querySelector('.save-btn').textContent = 'Saving...';
        
        try {
            await DataService.setEnvironmentVariableValue(definitionId, valueId, newValue);
            NotificationService.show('Environment variable saved successfully.', 'success');
            this._switchToViewMode(card, newValue);
        } catch(e) {
            NotificationService.show(`Save failed: ${e.message}`, 'error');
            textarea.disabled = false;
            card.querySelector('.save-btn').textContent = 'Save';
        }
    }

    /**
     * Filters the displayed cards based on the search input's value.
     * @private
     */
    _filterCards() {
        const term = this.ui.searchInput.value.toLowerCase();
        this.ui.listContainer.querySelectorAll('.env-var-card').forEach(card => {
            const searchableText = card.dataset.searchTerm || '';
            card.style.display = searchableText.includes(term) ? '' : 'none';
        });
    }
}