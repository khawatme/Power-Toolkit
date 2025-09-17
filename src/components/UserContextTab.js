/**
 * @file User Context display component.
 * @module components/UserContextTab
 * @description Displays comprehensive details about the current (or impersonated) user, client session, and organization.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { DataService } from '../services/DataService.js';
import { Helpers } from '../utils/Helpers.js';
import { Store } from '../core/Store.js';

/**
 * A component that displays comprehensive details about the current session, including
 * the user's settings and security roles, client information, and organization details.
 * It reactively updates when the impersonated user changes.
 * @extends {BaseComponent}
 */
export class UserContextTab extends BaseComponent {
    /**
     * Initializes the UserContextTab component.
     */
    constructor() {
        super('userContext', 'User Context', ICONS.user);
        /** @type {Function|null} The function to call to unsubscribe from store updates. */
        this.unsubscribe = null;
        /** @type {object} A cache for frequently accessed UI elements. */
        this.ui = {};
    }

    /**
     * Renders the component's initial container. The data will be loaded in postRender.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `<p class="pdt-note">Loading user context...</p>`;
        return container;
    }

    /**
     * Attaches event listeners, subscribes to the store, and triggers the initial data load.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        this.ui.container = element;
        
        this.unsubscribe = Store.subscribe((newState, oldState) => {
            if (newState.impersonationUserId !== oldState.impersonationUserId) {
                this._loadData();
            }
        });

        element.addEventListener('click', (e) => {
            const target = e.target.closest('.copyable');
            if (target) {
                Helpers.copyToClipboard(target.textContent, `Copied: ${target.textContent}`);
            }
        });

        this._loadData();
    }

    /**
     * Unsubscribes from the store to prevent memory leaks when the component is destroyed.
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    /**
     * Fetches the complete user, client, and organization context from the DataService,
     * always bypassing the cache to ensure it reflects the current impersonation state.
     * It then renders the data into a series of information cards.
     * @private
     */
    async _loadData() {
        this.ui.container.innerHTML = `<p class="pdt-note">Loading user context...</p>`;
        try {
            // Bypass the cache to ensure we get the correct context after an impersonation change.
            const context = await DataService.getEnhancedUserContext(true);
            
            const userData = {
                "Name": `<span>${Helpers.escapeHtml(context.user.name)}</span>`,
                "User ID": `<span class="copyable code-like" title="Click to copy">${Helpers.escapeHtml(context.user.id)}</span>`,
                "Language ID": `<span>${context.user.language}</span>`
            };
            const clientData = {
                "Client Type": `<span>${Helpers.escapeHtml(context.client.type)}</span>`,
                "Form Factor": `<span>${Helpers.escapeHtml(context.client.formFactor)}</span>`,
                "Is Offline": `<span>${context.client.isOffline}</span>`,
                "App URL": `<span class="copyable" title="Click to copy">${Helpers.escapeHtml(context.client.appUrl)}</span>`
            };
            const orgData = {
                "Org Name": `<span>${Helpers.escapeHtml(context.organization.name)}</span>`,
                "Org ID": `<span class="copyable code-like" title="Click to copy">${Helpers.escapeHtml(context.organization.id)}</span>`,
                "Version": `<span>${Helpers.escapeHtml(context.organization.version)}</span>`,
                "Auto-Save On": `<span>${context.organization.isAutoSave}</span>`
            };

            const rolesHtml = context.user.roles.map(r => `<li>${Helpers.escapeHtml(r)}</li>`).join('');
            const rolesFooter = `<div class="pdt-card-body"><h4 class="pdt-section-header">Security Roles (${context.user.roles.length})</h4><ul class="pdt-role-list">${rolesHtml}</ul></div>`;

            this.ui.container.innerHTML = `
                <div class="section-title">User & Session Context</div>
                ${this._createCardHtml('User Settings', '👤', userData, rolesFooter)}
                ${this._createCardHtml('Client & Session', '💻', clientData)}
                ${this._createCardHtml('Organization Details', '🏢', orgData)}
            `;
        } catch (e) {
            this.ui.container.innerHTML = `<div class="pdt-error">Could not retrieve user context: ${e.message}</div>`;
        }
    }

    /**
     * Creates the HTML for a styled information card.
     * @param {string} title - The title for the card header.
     * @param {string} icon - The emoji icon for the card header.
     * @param {Object.<string, string>} data - An object of key-value pairs, where the value is a pre-formatted HTML string.
     * @param {string} [footerHtml=''] - Optional HTML to append after the main body.
     * @returns {string} The complete HTML string for the card.
     * @private
     */
    _createCardHtml(title, icon, data, footerHtml = '') {
        const gridRows = Object.entries(data).map(([key, value]) => `<strong>${key}:</strong>${value}`).join('');
        return `
            <div class="pdt-card" style="margin-top: 15px;">
                <div class="pdt-card-header">${icon} ${title}</div>
                <div class="pdt-card-body"><div class="info-grid">${gridRows}</div></div>
                ${footerHtml}
            </div>`;
    }
}