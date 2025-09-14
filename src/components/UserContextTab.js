/**
 * @file User Context display component.
 * @module components/UserContextTab
 * @description Displays comprehensive details about the current user, client session, and organization.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { DataService } from '../services/DataService.js';
import { Helpers } from '../utils/Helpers.js';

/**
 * @typedef {object} UserContextData
 * @property {object} user - Information about the current user.
 * @property {string} user.name - The user's full name.
 * @property {string} user.id - The user's GUID.
 * @property {number} user.language - The user's language ID (LCID).
 * @property {Array<string>} user.roles - A list of the user's security role names.
 * @property {object} client - Information about the client session.
 * @property {string} client.type - The type of client (e.g., 'Web').
 * @property {string} client.formFactor - The form factor ('Desktop', 'Tablet', 'Phone').
 * @property {boolean} client.isOffline - Whether the client is currently offline.
 * @property {string} client.appUrl - The URL of the current application.
 * @property {object} organization - Information about the Dataverse organization.
 * @property {string} organization.name - The unique name of the organization.
 * @property {string} organization.id - The organization's GUID.
 * @property {string} organization.version - The version number of the organization.
 * @property {boolean} organization.isAutoSave - Whether auto-save is enabled for the organization.
 */

export class UserContextTab extends BaseComponent {
    /**
     * Initializes the UserContextTab component.
     */
    constructor() {
        super('userContext', 'User Context', ICONS.user);
    }

    /**
     * Renders the component's HTML structure by fetching and displaying context data.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `<p class="pdt-note">Loading user context...</p>`;

        try {
            /** @type {UserContextData} */
            const context = await DataService.getEnhancedUserContext();
            
            // Create data maps for each card
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
            const rolesFooter = `
                <div class="pdt-card-body">
                    <h4 class="pdt-section-header">Security Roles (${context.user.roles.length})</h4>
                    <ul class="pdt-role-list">${rolesHtml}</ul>
                </div>`;

            // Build the final HTML using the reusable card helper
            container.innerHTML = `
                <div class="section-title">User & Session Context</div>
                ${this._createCardHtml('User Settings', '👤', userData, rolesFooter)}
                ${this._createCardHtml('Client & Session', '💻', clientData)}
                ${this._createCardHtml('Organization Details', '🏢', orgData)}
            `;

        } catch (e) {
            container.innerHTML = `<div class="pdt-error">Could not retrieve user context: ${e.message}</div>`;
        }

        return container;
    }

    /**
     * Attaches a single delegated event listener for all copyable fields.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        element.addEventListener('click', (e) => {
            const target = e.target.closest('.copyable');
            if (target) {
                Helpers.copyToClipboard(target.textContent, 'Copied to clipboard!');
            }
        });
    }

    /**
     * Creates the HTML for a styled information card.
     * @param {string} title - The title for the card header.
     * @param {string} icon - The emoji icon for the card header.
     * @param {object} data - An object of key-value pairs to display in an info grid.
     * @param {string} [footerHtml=''] - Optional HTML to append after the main body.
     * @returns {string} The complete HTML string for the card.
     * @private
     */
    _createCardHtml(title, icon, data, footerHtml = '') {
        const gridRows = Object.entries(data).map(([key, value]) => `<strong>${key}:</strong>${value}`).join('');
        
        return `
            <div class="pdt-card" style="margin-top: 15px;">
                <div class="pdt-card-header">${icon} ${title}</div>
                <div class="pdt-card-body">
                    <div class="info-grid">${gridRows}</div>
                </div>
                ${footerHtml}
            </div>`;
    }
}