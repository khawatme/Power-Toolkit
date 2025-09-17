/**
 * @file Form Automation component.
 * @module components/AutomationTab
 * @description This component allows users to view and manage Business Rules for any table in the environment.
 * It also displays the statically-defined Form Event Handlers if the tool is opened on a record form.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { DataService } from '../services/DataService.js';
import { Helpers } from '../utils/Helpers.js';
import { DialogService } from '../services/DialogService.js';
import { UIFactory } from '../ui/UIFactory.js';
import { NotificationService } from '../services/NotificationService.js';
import { js_beautify } from 'js-beautify';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
import { MetadataBrowserDialog } from '../ui/MetadataBrowserDialog.js';

/**
 * A component for viewing and managing form automation assets like Business Rules
 * and Form Event Handlers for any table in the environment.
 * @extends {BaseComponent}
 */
export class AutomationTab extends BaseComponent {
    /**
     * Initializes the AutomationTab component.
     */
    constructor() {
        // The tab is not form-only, as the business rule viewer can be used anywhere.
        super('automation', 'Form Automation', ICONS.automation, false);
        this.ui = {};
        this.rules = [];
        this.selectedEntity = null;
    }

    /**
     * Renders the component's initial HTML structure, including placeholders for the entity selector and lists.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div id="br-container">
                <div class="section-title">Business Rules</div>
                <div class="pdt-toolbar" style="margin-bottom: 15px;">
                    <label style="flex-shrink: 0; margin-right: 10px;">Table:</label>
                    
                    <div class="pdt-input-with-button" style="flex-grow: 1;">
                        
                        <input type="text" id="br-entity-input" class="pdt-input" placeholder="Type a table name and press Enter, or browse...">
                        
                        <button id="br-browse-entity-btn" class="pdt-input-btn" title="Browse tables">${ICONS.inspector}</button>
                    </div>
                </div>
                <div id="br-list-container">
                    <p class="pdt-note">Please select a table to view its business rules.</p>
                </div>
            </div>
            <div id="events-container" style="margin-top: 20px;">
                <div class="section-title">Form Event Handlers</div>
            </div>`;
        return container;
    }

    /**
     * Caches UI elements, attaches event listeners, and initializes the component's data and state.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        this.ui = {
            brContainer: element.querySelector('#br-container'),
            brListContainer: element.querySelector('#br-list-container'),
            eventsContainer: element.querySelector('#events-container'),
            entityInput: element.querySelector('#br-entity-input'),
            browseBtn: element.querySelector('#br-browse-entity-btn'),
        };
        
        this._initialize();

        this.ui.browseBtn.addEventListener('click', () => {
            MetadataBrowserDialog.show('entity', (selectedEntity) => {
                this.ui.entityInput.value = selectedEntity.LogicalName;
                this.selectedEntity = selectedEntity.LogicalName;
                this._loadAllAutomationsForEntity(this.selectedEntity);
            });
        });

        this.ui.entityInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                const entityName = e.target.value.trim();
                if (entityName) {
                    this.selectedEntity = entityName;
                    this._loadAllAutomationsForEntity(this.selectedEntity);
                }
            }
        });

        this.ui.brListContainer.addEventListener('click', (e) => {
            const actionButton = e.target.closest('button[data-action]');
            const header = e.target.closest('.pdt-br-header');
            if (actionButton) {
                e.stopPropagation();
                this._handleActionClick(actionButton);
            } else if (header) {
                this._toggleRuleDetails(header);
            }
        });
    }

    /**
     * Sets up the initial state of the tab, loading the entity list for the selector
     * and displaying data for the current context if available.
     * @private
     */
    async _initialize() {
        // Set the default message, ensuring the section is visible
        this.ui.eventsContainer.querySelector('.section-title').insertAdjacentHTML(
            'afterend',
            '<p class="pdt-note">Select a table to view its main form event handlers.</p>'
        );

        const currentEntity = PowerAppsApiService.getEntityName();
        if (currentEntity) {
            this.ui.entityInput.value = currentEntity;
            this.selectedEntity = currentEntity;
            this._loadAllAutomationsForEntity(currentEntity);
        }
    }

    /**
     * Renders the list of business rules using a programmatic, accordion-style layout.
     * @private
     */
    _renderBusinessRules() {
        const container = this.ui.brListContainer;
        const rules = this.rules;
        
        if (rules.length === 0) {
            container.innerHTML = '<p class="pdt-note">No business rules found for this table.</p>';
            return;
        }
        
        const fragment = document.createDocumentFragment();
        rules.forEach(r => {
            const itemContainer = document.createElement('div');
            itemContainer.className = 'pdt-br-item';
            itemContainer.dataset.ruleId = r.id;

            const statusBadge = `<span class="pdt-status-badge ${r.isActive ? 'active' : 'inactive'}">${r.isActive ? 'Active' : 'Inactive'}</span>`;
            const name = `<span>${Helpers.escapeHtml(r.name)}</span>`;
            const id = `<span class="code-like">${r.id}</span>`;
            const description = r.description ? `<div class="pdt-list-item-description">${Helpers.escapeHtml(r.description)}</div>` : '';
            const actionButtons = r.isActive
                ? `<button class="pdt-list-action-btn action-deactivate" data-action="deactivate" data-rule-id="${r.id}">Deactivate</button>`
                : `<button class="pdt-list-action-btn action-activate" data-action="activate" data-rule-id="${r.id}">Activate</button><button class="pdt-list-action-btn action-delete" data-action="delete" data-rule-id="${r.id}">Delete</button>`;

            itemContainer.innerHTML = `
                <div class="pdt-br-header">
                    ${statusBadge}
                    <div class="pdt-list-item-content">
                        <div class="pdt-list-item-header">${name}${id}</div>
                        ${description}
                    </div>
                    <div class="pdt-list-item-actions">${actionButtons}</div>
                </div>
                <div class="pdt-br-details"></div>`;
            
            fragment.appendChild(itemContainer);
        });
        container.innerHTML = '';
        container.appendChild(fragment);
    }

    /**
     * Toggles the visibility of a business rule's logic panel.
     * The rule's underlying JavaScript code is fetched and formatted on the first expansion.
     * @param {HTMLElement} header - The header element of the rule that was clicked.
     * @private
     */
    _toggleRuleDetails(header) {
        const detailsPanel = header.nextElementSibling;
        if (!detailsPanel || !detailsPanel.classList.contains('pdt-br-details')) return;

        if (detailsPanel.innerHTML === '') {
            const ruleId = header.closest('[data-rule-id]').dataset.ruleId;
            const rule = this.rules.find(r => r.id === ruleId);
            if (rule && rule.clientData) {
                const xmlDoc = new DOMParser().parseFromString(rule.clientData, "text/xml");
                const clientCode = xmlDoc.querySelector("clientcode")?.textContent || "Could not parse logic.";
                const formattedCode = js_beautify(clientCode, { indent_size: 2, space_in_empty_paren: true });
                detailsPanel.appendChild(UIFactory.createCopyableCodeBlock(formattedCode, 'javascript'));
            }
        }
        
        const isExpanded = detailsPanel.style.maxHeight && detailsPanel.style.maxHeight !== '0px';
        if (isExpanded) {
            detailsPanel.style.maxHeight = '0px';
        } else {
            detailsPanel.style.maxHeight = `${detailsPanel.scrollHeight}px`;
        }
    }
    
    /**
     * Handles a click on an action button (Activate, Deactivate, Delete).
     * @param {HTMLButtonElement} button - The button that was clicked.
     * @private
     */
    _handleActionClick(button) {
        const action = button.dataset.action;
        const ruleId = button.dataset.ruleId;

        if (action === 'delete') {
            DialogService.show('Confirm Deletion', '<p>Are you sure you want to permanently delete this business rule?</p><p class="pdt-text-error">This action cannot be undone.</p>',
                async () => {
                    button.textContent = '...';
                    button.disabled = true;
                    try {
                        await DataService.deleteBusinessRule(ruleId);
                        NotificationService.show('Business rule deleted.', 'success');
                        await this._refreshBusinessRules();
                    } catch (e) { this._handleApiError(e); }
                }
            );
            return;
        }

        button.textContent = '...';
        button.disabled = true;
        (async () => {
            try {
                if (action === 'activate') {
                    await DataService.setBusinessRuleState(ruleId, true);
                    NotificationService.show('Business rule activated.', 'success');
                } else if (action === 'deactivate') {
                    await DataService.setBusinessRuleState(ruleId, false);
                    NotificationService.show('Business rule deactivated.', 'success');
                }
                await this._refreshBusinessRules();
            } catch (e) { this._handleApiError(e); }
        })();
    }
    
    /**
     * Provides user-friendly notifications for specific API errors and refreshes the UI.
     * @param {Error} error - The error object from a failed API call.
     * @private
     */
    _handleApiError(error) {
        const message = error.message || '';
        if (message.includes('another [Import] running')) {
            NotificationService.show('System is locked by a solution import. Please try again later.', 'warn');
        } else {
            NotificationService.show(`Action failed: ${message}`, 'error');
        }
        this._refreshBusinessRules(false);
    }

    /**
     * Clears the cache for the current entity's rules and re-renders the list.
     * @param {boolean} [showLoading=true] - If true, displays a "Refreshing..." message.
     * @private
     */
    async _refreshBusinessRules(showLoading = true) {
        if (!this.selectedEntity) return;
        if (showLoading) {
            this.ui.brListContainer.innerHTML = `<p class="pdt-note">Refreshing rules for ${this.selectedEntity}...</p>`;
        }
        try {
            DataService.clearCache(`businessRules_${this.selectedEntity}`);
            this.rules = await DataService.getBusinessRulesForEntity(this.selectedEntity);
            this._renderBusinessRules();
        } catch (e) {
            this.ui.brListContainer.innerHTML = `<div class="pdt-error">Error refreshing business rules: ${e.message}</div>`;
        }
    }
    
    /**
     * Loads all automation assets (rules and handlers) for the selected entity in parallel.
     * @param {string} entityName - The logical name of the entity.
     * @private
     */
    async _loadAllAutomationsForEntity(entityName) {
        // Set loading state for both sections
        this.ui.brListContainer.innerHTML = `<p class="pdt-note">Loading rules for ${entityName}...</p>`;
        this.ui.eventsContainer.innerHTML = `<div class="section-title">Form Event Handlers</div><p class="pdt-note">Loading form handlers for ${entityName}...</p>`;

        try {
            // Fetch both sets of data concurrently for better performance
            const [rules, events] = await Promise.all([
                DataService.getBusinessRulesForEntity(entityName),
                DataService.getFormEventHandlersForEntity(entityName)
            ]);

            // Render the results
            this.rules = rules;
            this._renderBusinessRules();
            this._renderFormEvents(this.ui.eventsContainer, events);

        } catch (error) {
            const errorHtml = `<div class="pdt-error">Error loading automations: ${error.message}</div>`;
            this.ui.brListContainer.innerHTML = errorHtml;
            this.ui.eventsContainer.innerHTML = `<div class="section-title">Form Event Handlers</div>${errorHtml}`;
        }
    }

    /**
     * Renders the lists of OnLoad and OnSave event handlers.
     * @param {HTMLElement} container - The container element.
     * @param {object|null} events - The object containing OnLoad and OnSave handlers.
     * @private
     */
    _renderFormEvents(container, events) {
        if (events === null) {
            container.innerHTML = `<div class="section-title">Form Event Handlers</div><p class="pdt-note">Could not retrieve form definition or no main form found.</p>`;
            return;
        }

        const renderHandlers = (handlerList) => {
            if (!handlerList || handlerList.length === 0) return '<p class="pdt-note">No handlers configured.</p>';
            return `<ul class="pdt-list">${handlerList.map(h => `<li class="pdt-list-item-condensed"><span><strong>${Helpers.escapeHtml(h.function)}</strong> from <span class="code-like">${Helpers.escapeHtml(h.library)}</span></span></li>`).join('')}</ul>`;
        };

        const content = `
            <h4 class="pdt-section-header">OnLoad</h4>
            ${renderHandlers(events.OnLoad)}
            <h4 class="pdt-section-header" style="margin-top: 15px;">OnSave</h4>
            ${renderHandlers(events.OnSave)}
            <p class="pdt-note" style="margin-top: 15px;">Note: This list shows handlers from the table's main form definition.</p>`;
        
        container.innerHTML = `<div class="section-title">Form Event Handlers</div>${content}`;
    }
}