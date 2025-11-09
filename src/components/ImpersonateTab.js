/**
 * @file User Impersonation component.
 * @module components/ImpersonateTab
 * @description Allows developers to execute Web API requests as another user.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { DataService } from '../services/DataService.js';
import { addEnterKeyListener, escapeHtml, escapeODataString, generateSortableTableHeaders, sortArrayByColumn, toggleSortState } from '../helpers/index.js';
import { Config } from '../constants/index.js';

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

        // Event handler references for cleanup
        /** @private {Function|null} */ this._handleSearch = null;
        /** @private {Function|null} */ this._enterKeyHandler = null;
        /** @private {Function|null} */ this._handleResultsClick = null;
        /** @private {Function|null} */ this._handleStatusClick = null;
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
            <div id="impersonation-status-container" class="mt-15"></div>
            <div class="pdt-toolbar">
                <input type="text" id="impersonate-search-input" class="pdt-input flex-grow" placeholder="Search for a user by name...">
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

        // Store bound event handlers for cleanup
        this._handleSearch = () => this._performSearch();
        this._handleResultsClick = (e) => {
            // Handle header clicks for sorting
            const header = e.target.closest('th[data-sort-key]');
            if (header) {
                const sortKey = header.dataset.sortKey;
                toggleSortState(this.sortState, sortKey);
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
        };
        this._handleStatusClick = (e) => {
            if (e.target.id === 'impersonate-clear-btn') {
                DataService.clearImpersonation();
                this._updateStatus();
            }
        };

        this.ui.searchBtn.addEventListener('click', this._handleSearch);
        this._enterKeyHandler = addEnterKeyListener(this.ui.searchInput, this._handleSearch);
        this.ui.resultsContainer.addEventListener('click', this._handleResultsClick);
        this.ui.statusContainer.addEventListener('click', this._handleStatusClick);

        this._updateStatus();
    }

    /**
     * Lifecycle hook for cleaning up event listeners to prevent memory leaks.
     */
    destroy() {
        if (this.ui.searchBtn && this._handleSearch) {
            this.ui.searchBtn.removeEventListener('click', this._handleSearch);
        }
        if (this.ui.searchInput && this._enterKeyHandler) {
            this.ui.searchInput.removeEventListener('keydown', this._enterKeyHandler);
        }
        if (this.ui.resultsContainer && this._handleResultsClick) {
            this.ui.resultsContainer.removeEventListener('click', this._handleResultsClick);
        }
        if (this.ui.statusContainer && this._handleStatusClick) {
            this.ui.statusContainer.removeEventListener('click', this._handleStatusClick);
        }
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
                    Currently impersonating: <strong>${escapeHtml(info.userName)}</strong>
                    <button id="impersonate-clear-btn" class="modern-button secondary ml-auto" style="padding: 4px 10px; font-size: 12px;">Clear</button>
                </div>`;
        } else {
            this.ui.statusContainer.textContent = '';
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

        // Show loading state
        this.ui.searchBtn.disabled = true;
        this.ui.searchBtn.textContent = Config.MESSAGES.IMPERSONATE.searching;
        this.ui.resultsContainer.innerHTML = `<p class="pdt-note">${Config.MESSAGES.IMPERSONATE.searching}</p>`;

        try {
            let filterClause = 'isdisabled eq false and azureactivedirectoryobjectid ne null';
            if (searchTerm) {
                const escapedTerm = escapeODataString(searchTerm);
                filterClause += ` and contains(fullname,'${escapedTerm}')`;
            }
            const options = `?$select=fullname,systemuserid,domainname&$filter=${filterClause}`;

            const result = await DataService.retrieveMultipleRecords('systemuser', options);
            this.lastSearchResults = result.entities; // Cache the results
            this.sortState = { column: 'fullname', direction: 'asc' }; // Reset sort on new search
            this._renderResults(); // Render the sorted results
        } catch (e) {
            this.ui.resultsContainer.innerHTML = `<div class="pdt-error">${Config.MESSAGES.IMPERSONATE.searchFailed(escapeHtml(e.message))}</div>`;
        } finally {
            // Reset button state
            this.ui.searchBtn.disabled = false;
            this.ui.searchBtn.textContent = 'Search';
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
            this.ui.resultsContainer.innerHTML = `<p class="pdt-note">${Config.MESSAGES.IMPERSONATE.noUsersFound}</p>`;
            return;
        }

        // Sort the cached results using the helper
        sortArrayByColumn(this.lastSearchResults, this.sortState.column, this.sortState.direction);

        const rows = this.lastSearchResults.map(user => `
            <tr class="copyable-cell" data-user-id="${user.systemuserid}" data-full-name="${escapeHtml(user.fullname)}" title="Click to impersonate this user">
                <td>${escapeHtml(user.fullname)}</td>
                <td class="code-like">${escapeHtml(user.domainname)}</td>
            </tr>
        `).join('');

        const headers = [
            { key: 'fullname', label: 'Full Name' },
            { key: 'domainname', label: 'User Name' }
        ];
        const headerHtml = generateSortableTableHeaders(headers, this.sortState);

        this.ui.resultsContainer.innerHTML = `
            <table class="pdt-table">
                <thead>${headerHtml}</thead>
                <tbody>${rows}</tbody>
            </table>`;
    }
}