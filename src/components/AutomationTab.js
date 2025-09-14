/**
 * @file Form Automation component.
 * @module components/AutomationTab
 * @description Displays active Business Rules and Form Event Handlers for the current form.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { DataService } from '../services/DataService.js';
import { Helpers } from '../utils/Helpers.js';

export class AutomationTab extends BaseComponent {
    /**
     * Initializes the AutomationTab component.
     */
    constructor() {
        super('automation', 'Form Automation', ICONS.automation, true);
        /** @type {object} Caches references to key UI elements. */
        this.ui = {};
    }

    /**
     * Renders the component's HTML structure by fetching and displaying automation data.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div id="br-container">
                <div class="section-title">Active Business Rules</div>
                <p class="pdt-note">Loading business rules...</p>
            </div>
            <div id="events-container" style="margin-top: 20px;">
                <div class="section-title">Form Event Handlers</div>
                <p class="pdt-note">Loading event handlers...</p>
            </div>`;

        // Cache UI containers
        this.ui.brContainer = container.querySelector('#br-container');
        this.ui.eventsContainer = container.querySelector('#events-container');
        
        // Fetch data in parallel and wait for both to complete
        try {
            const [rules, events] = await Promise.all([
                DataService.getBusinessRulesForCurrentEntity(),
                DataService.getFormEventHandlers()
            ]);
            
            this._renderBusinessRules(this.ui.brContainer, rules);
            this._renderFormEvents(this.ui.eventsContainer, events);
        } catch (error) {
            container.innerHTML = `<div class="pdt-error">Error loading form automation data: ${error.message}</div>`;
            console.error("Power-Toolkit Error:", error);
        }

        return container;
    }

    /**
     * Renders the list of Business Rules, filtering for active ones and showing their scope.
     * @param {HTMLElement} container - The container element for this section.
     * @param {Array<object>} rules - The array of all business rule data for the entity.
     * @private
     */
    _renderBusinessRules(container, rules) {
        // FIX: Explicitly filter for active business rules.
        const activeRules = rules.filter(r => r.isActive);

        let content;
        if (activeRules.length > 0) {
            const rulesHtml = activeRules.map(r => {
                const statusIcon = r.isActive ? '🟢' : '🔴';
                const scopeIcon = r.scope === 'Form' ? '📄' : '💿';
                const scopeTitle = r.scope === 'Form' ? `Scoped to this form (${r.formName || 'Unknown'})` : 'Scoped to the entire table (All Forms)';
                
                return `
                    <li class="pdt-list-item">
                        <span title="${r.isActive ? 'Active' : 'Inactive'}">${statusIcon}</span>
                        <span>${Helpers.escapeHtml(r.name)}</span>
                        <span class="pdt-badge" title="${scopeTitle}">${scopeIcon} ${Helpers.escapeHtml(r.scope)}</span>
                    </li>`;
            }).join('');
            content = `<ul class="pdt-list">${rulesHtml}</ul>`;
        } else {
            content = '<p class="pdt-note">No active business rules found for this table.</p>';
        }
        
        container.innerHTML = `<div class="section-title">Active Business Rules</div>${content}`;
    }

    /**
     * Renders the lists of OnLoad and OnSave event handlers.
     * @param {HTMLElement} container - The container element for this section.
     * @param {object|null} events - The object containing OnLoad and OnSave handlers.
     * @private
     */
    _renderFormEvents(container, events) {
        if (events === null) {
            container.innerHTML = `<div class="section-title">Form Event Handlers</div><p class="pdt-note">Could not retrieve form definition. This may not be a standard record form.</p>`;
            return;
        }
        
        const renderHandlers = (handlerList) => {
            if (!handlerList || handlerList.length === 0) {
                return '<p class="pdt-note">No handlers configured.</p>';
            }
            return `<ul class="pdt-list">${handlerList.map(h => `
                <li class="pdt-list-item-condensed">
                    <span title="${h.enabled ? 'Enabled' : 'Disabled'}">${h.enabled ? '🟢' : '🔴'}</span>
                    <span><strong>${Helpers.escapeHtml(h.function)}</strong> from <span class="code-like">${Helpers.escapeHtml(h.library)}</span></span>
                </li>`
            ).join('')}</ul>`;
        };

        const content = `
            <h4 class="pdt-section-header">OnLoad</h4>
            ${renderHandlers(events.OnLoad)}
            <h4 class="pdt-section-header" style="margin-top: 15px;">OnSave</h4>
            ${renderHandlers(events.OnSave)}
            <p class="pdt-note" style="margin-top: 15px;">Note: This list shows handlers from the form definition and does not include handlers added dynamically via code.</p>
        `;
        container.innerHTML = `<div class="section-title">Form Event Handlers</div>${content}`;
    }
}