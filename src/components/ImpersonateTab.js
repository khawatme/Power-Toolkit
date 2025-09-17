/**
 * @file User Impersonation component.
 * @module components/ImpersonateTab
 * @description Allows developers to execute Web API requests as another user.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { DataService } from '../services/DataService.js';
import { Helpers } from '../utils/Helpers.js';

/**
 * A component that allows developers to search for and impersonate another
 * user, causing all subsequent API requests made by the tool to be executed
 * on behalf of that user.
 * @extends {BaseComponent}
 * @property {object} ui - A cache for frequently accessed UI elements.
 * @property {Array<object>} lastSearchResults - Caches the most recent user search results.
 * @property {{column: string, direction: 'asc'|'desc'}} sortState - The current sort state of the results table.
 */
export class ImpersonateTab extends BaseComponent {
    constructor() {
        super('impersonate', 'Impersonate', ICONS.impersonate);
        this.ui = {};
        this.lastSearchResults = []; // Cache for sorting
        this.sortState = { column: 'fullname', direction: 'asc' }; // Initial sort state
    }

    /**
     * Renders the component's static HTML structure, including the search bar
     * and containers for the status message and results table.
     * @returns {Promise<HTMLElement>} A promise that resolves with the component's root element.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="section-title">User Impersonation</div>
            <p class="pdt-note">
                Select a user to execute all subsequent Web API requests from within this tool (e.g., in the Metadata Browser, WebAPI Explorer,FetchXML Tester and User Context) on their behalf. This is useful for testing security roles.
            </p>
            <div id="impersonation-status-container" style="margin-top: 15px;"></div>
            <div class="pdt-toolbar">
                <input type="text" id="impersonate-search-input" class="pdt-input" placeholder="Search for a user by name..." style="flex-grow:1;">
                <button id="impersonate-search-btn" class="modern-button">Search</button>
            </div>
            <div id="impersonate-results-container" class="pdt-table-wrapper"></div>`;
        return container;
    }

    /**
     * Caches UI elements, attaches event listeners for search and impersonation actions,
     * and performs the initial status update after the component is added to the DOM.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
            this.ui = {
                statusContainer: element.querySelector('#impersonation-status-container'),
                searchInput: element.querySelector('#impersonate-search-input'),
                searchBtn: element.querySelector('#impersonate-search-btn'),
                resultsContainer: element.querySelector('#impersonate-results-container')
            };

            this.ui.searchBtn.onclick = () => this._performSearch();
            Helpers.addEnterKeyListener(this.ui.searchInput, () => this._performSearch());

            this.ui.resultsContainer.addEventListener('click', e => {
                // Handle header clicks for sorting
                const header = e.target.closest('th[data-sort-key]');
                if (header) {
                    const sortKey = header.dataset.sortKey;
                    if (this.sortState.column === sortKey) {
                        this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        this.sortState.column = sortKey;
                        this.sortState.direction = 'asc';
                    }
                    this._renderResults(); // Re-render with new sort order
                    return;
                }
                
                // Handle row clicks for impersonation
                const row = e.target.closest('tr[data-user-id]');
                if (row) {
                    const userId = row.dataset.userId;
                    const fullName = row.dataset.fullName;
                    DataService.setImpersonation(userId, fullName);
                    this._updateStatus();
                }
            });
            
            this.ui.statusContainer.addEventListener('click', e => {
                if (e.target.id === 'impersonate-clear-btn') {
                    DataService.clearImpersonation();
                    this._updateStatus();
                }
            });

            this._updateStatus();
        }

    /**
     * Updates the status container to reflect the current impersonation state.
     * Displays a banner with the impersonated user's name and a "Clear" button,
     * or clears the container if no impersonation is active.
     * @private
     */
    _updateStatus() {
        const info = DataService.getImpersonationInfo();
        if (info.isImpersonating) {
            this.ui.statusContainer.innerHTML = `
                <div class="pdt-note" style="border-left-color: var(--pro-warn);">
                    Currently impersonating: <strong>${Helpers.escapeHtml(info.userName)}</strong>
                    <button id="impersonate-clear-btn" class="modern-button secondary" style="margin-left:auto; padding: 4px 10px; font-size: 12px;">Clear</button>
                </div>`;
        } else {
            this.ui.statusContainer.innerHTML = '';
        }
    }

    /**
     * Executes a search for users based on the input field's value.
     * Fetches enabled users, caches the results, resets the sort state,
     * and triggers a re-render of the results table.
     * @async
     * @private
     */
    async _performSearch() {
        const searchTerm = this.ui.searchInput.value.trim();

        this.ui.resultsContainer.innerHTML = `<p class="pdt-note">Searching...</p>`;
        try {
            let filterClause = "isdisabled eq false";
            if (searchTerm) {
                filterClause += ` and contains(fullname,'${searchTerm}')`;
            }
            const options = `?$select=fullname,systemuserid,domainname&$filter=${filterClause}`;
            
            const result = await DataService.retrieveMultipleRecords('systemuser', options);
            this.lastSearchResults = result.entities; // Cache the results
            this.sortState = { column: 'fullname', direction: 'asc' }; // Reset sort on new search
            this._renderResults(); // Render the sorted results
        } catch (e) {
            this.ui.resultsContainer.innerHTML = `<div class="pdt-error">Error searching for users: ${e.message}</div>`;
        }
    }

    /**
     * Renders the user search results into a sortable HTML table.
     * It sorts the `lastSearchResults` array based on the current `sortState`
     * before generating the table rows.
     * @private
     */
    _renderResults() {
        if (!this.lastSearchResults || this.lastSearchResults.length === 0) {
            this.ui.resultsContainer.innerHTML = `<p class="pdt-note">No active users found matching your search.</p>`;
            return;
        }

        // Sort the cached results based on the current sortState
        const { column, direction } = this.sortState;
        const dir = direction === 'asc' ? 1 : -1;
        this.lastSearchResults.sort((a, b) => {
            return String(a[column] || '').localeCompare(String(b[column] || '')) * dir;
        });

        const rows = this.lastSearchResults.map(user => `
            <tr class="copyable-cell" data-user-id="${user.systemuserid}" data-full-name="${Helpers.escapeHtml(user.fullname)}" title="Click to impersonate this user">
                <td>${Helpers.escapeHtml(user.fullname)}</td>
                <td class="code-like">${Helpers.escapeHtml(user.domainname)}</td>
            </tr>
        `).join('');

        const headers = [
            { key: 'fullname', label: 'Full Name' },
            { key: 'domainname', label: 'User Name' }
        ];
        const headerHtml = headers.map(h => {
            const isSorted = this.sortState.column === h.key;
            const sortClass = isSorted ? `sort-${this.sortState.direction}` : '';
            return `<th class="${sortClass}" data-sort-key="${h.key}">${h.label}</th>`;
        }).join('');

        this.ui.resultsContainer.innerHTML = `
            <table class="pdt-table">
                <thead>
                    <tr>${headerHtml}</tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;
    }
}