/**
 * @file User Impersonation component with Security Analysis.
 * @module components/ImpersonateTab
 * @description Allows developers to execute Web API requests as another user
 * and analyze their security settings to troubleshoot permission issues.
 * Features two sub-tabs: User Impersonation and Security Analysis.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { DataService } from '../services/DataService.js';
import { SecurityAnalysisService } from '../services/SecurityAnalysisService.js';
import { LiveImpersonationService } from '../services/LiveImpersonationService.js';
import { CommandBarAnalysisService } from '../services/CommandBarAnalysisService.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
import { NotificationService } from '../services/NotificationService.js';
import { LiveComparisonPanel } from '../ui/LiveComparisonPanel.js';
import { addEnterKeyListener, escapeHtml, escapeODataString, generateSortableTableHeaders, sortArrayByColumn, toggleSortState, copyToClipboard } from '../helpers/index.js';
import { UIHelpers } from '../helpers/ui.helpers.js';
import { Config } from '../constants/index.js';

/**
 * A component that allows developers to search for and impersonate another
 * user, causing all subsequent API requests made by the tool to be executed
 * on behalf of that user. Also provides security analysis to compare permissions
 * between the current user and the impersonated user.
 *
 * Features two sub-tabs:
 * - User Impersonation: Search and select users to impersonate
 * - Security Analysis: Compare permissions and troubleshoot access issues
 *
 * @extends {BaseComponent}
 * @property {object} ui - A cache for frequently accessed UI elements.
 * @property {Array<object>} lastSearchResults - Caches the most recent user search results.
 * @property {{column: string, direction: 'asc'|'desc'}} sortState - The current sort state of the results table.
 * @property {object|null} securityAnalysis - Cached security analysis results.
 * @property {'impersonation'|'security'} activeSubTab - The currently active sub-tab.
 */
export class ImpersonateTab extends BaseComponent {
    constructor() {
        super('impersonate', 'Impersonate', ICONS.impersonate);
        this.ui = {};
        this.lastSearchResults = []; // Cache for sorting
        this.sortState = { column: 'fullname', direction: 'asc' }; // Initial sort state
        this.securityAnalysis = null; // Cached security analysis
        this.activeSubTab = 'impersonation'; // Default to impersonation tab
        this.comparisonUser = null; // null = compare with current user, or {userId, userName} for custom user

        // Event handler references for cleanup
        /** @private {Function|null} */ this._handleSearch = null;
        /** @private {Function|null} */ this._enterKeyHandler = null;
        /** @private {Function|null} */ this._handleResultsClick = null;
        /** @private {Function|null} */ this._handleStatusClick = null;
        /** @private {Function|null} */ this._handleSecurityActionsClick = null;
        /** @private {Function|null} */ this._handleSubTabClick = null;
        /** @private {Function|null} */ this._handleCompareUserChange = null;
        /** @private {Function|null} */ this._handleSecurityAnalysisClick = null;
    }

    /**
     * Renders the component's static HTML structure with sub-tabs for
     * User Impersonation and Security Analysis.
     * @returns {Promise<HTMLElement>} A promise that resolves with the component's root element.
     */
    // eslint-disable-next-line require-await
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="section-title">Impersonate & Security</div>
            <div id="impersonation-status-container" class="mt-15"></div>
            
            <div class="pdt-content-host">
                <div class="pdt-sub-tabs">
                    <button id="impersonate-tab-impersonation" class="pdt-sub-tab active">${Config.MESSAGES.IMPERSONATE.userImpersonationTab}</button>
                    <button id="impersonate-tab-security" class="pdt-sub-tab">${Config.MESSAGES.IMPERSONATE.securityAnalysisTab}</button>
                </div>
                
                <!-- User Impersonation Sub-Tab Content -->
                <div id="impersonate-content-impersonation">
                    <p class="pdt-note">
                        ${Config.MESSAGES.IMPERSONATE.impersonationDescription}
                    </p>
                    <div class="pdt-toolbar">
                        <input type="text" id="impersonate-search-input" class="pdt-input flex-grow" placeholder="Search for a user by name...">
                        <button id="impersonate-search-btn" class="modern-button">Search</button>
                    </div>
                    <div id="impersonate-results-container" class="pdt-table-wrapper"></div>
                </div>
                
                <!-- Security Analysis Sub-Tab Content -->
                <div id="impersonate-content-security" style="display:none;">
                    <div class="pdt-compare-user-selector" style="display:none;">
                        <label class="pdt-label">${Config.MESSAGES.IMPERSONATE.compareWith}</label>
                        <select id="compare-user-select" class="pdt-select">
                            <option value="current">${Config.MESSAGES.IMPERSONATE.compareWithCurrentUser}</option>
                            <option value="custom">${Config.MESSAGES.IMPERSONATE.compareWithAnotherUser}</option>
                        </select>
                    </div>
                    <div id="security-analysis-actions" class="pdt-toolbar pdt-security-actions">
                        <button id="analyze-security-btn" class="modern-button" disabled title="${Config.MESSAGES.IMPERSONATE.selectUserFirst}">
                            ${Config.MESSAGES.IMPERSONATE.analyzeButton}
                        </button>
                        <button id="compare-commands-btn" class="modern-button" disabled title="${Config.MESSAGES.IMPERSONATE.commandBarComparisonTitle}">
                            ${Config.MESSAGES.IMPERSONATE.compareCommandsButton}
                        </button>
                        <!-- Live Mode button hidden until feature is stable. See LiveImpersonationService.js -->
                        <button id="live-impersonation-btn" class="modern-button pdt-live-btn-toggle" disabled title="${Config.MESSAGES.LIVE_IMPERSONATION.liveButtonTitle}" style="display:none">
                            ${Config.MESSAGES.IMPERSONATE.liveImpersonationButton}
                        </button>
                        <button id="open-admin-center-btn" class="modern-button secondary" title="Open Power Platform Admin Center">
                            ${Config.MESSAGES.IMPERSONATE.openAdminCenter}
                        </button>
                        <button id="open-entra-btn" class="modern-button secondary" title="Open Microsoft Entra Admin Center">
                            ${Config.MESSAGES.IMPERSONATE.openEntra}
                        </button>
                    </div>
                    <div id="security-analysis-content" class="pdt-security-analysis-content">
                        <p class="pdt-note">${Config.MESSAGES.IMPERSONATE.selectUserFirst}</p>
                    </div>
                </div>
            </div>`;
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
            // Sub-tab elements
            subTabImpersonation: element.querySelector('#impersonate-tab-impersonation'),
            subTabSecurity: element.querySelector('#impersonate-tab-security'),
            contentImpersonation: element.querySelector('#impersonate-content-impersonation'),
            contentSecurity: element.querySelector('#impersonate-content-security'),
            // Impersonation tab elements
            searchInput: element.querySelector('#impersonate-search-input'),
            searchBtn: element.querySelector('#impersonate-search-btn'),
            resultsContainer: element.querySelector('#impersonate-results-container'),
            // Security Analysis tab elements
            analyzeBtn: element.querySelector('#analyze-security-btn'),
            compareCommandsBtn: element.querySelector('#compare-commands-btn'),
            compareUserSelector: element.querySelector('.pdt-compare-user-selector'),
            compareUserSelect: element.querySelector('#compare-user-select'),
            liveBtn: element.querySelector('#live-impersonation-btn'),
            openAdminCenterBtn: element.querySelector('#open-admin-center-btn'),
            securityAnalysisContent: element.querySelector('#security-analysis-content'),
            securityActionsContainer: element.querySelector('#security-analysis-actions')
        };

        // Store bound event handlers for cleanup
        this._handleSearch = () => this._performSearch();
        this._handleSubTabClick = (e) => this._onSubTabClick(e);
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
                this._enableSecurityAnalysis(true);
                // Automatically switch to Security Analysis sub-tab
                this._switchSubTab('security');
            }
        };
        this._handleStatusClick = (e) => {
            if (e.target.id === 'impersonate-clear-btn') {
                // Stop live impersonation if active
                if (LiveImpersonationService.isActive) {
                    LiveImpersonationService.stop();
                    LiveComparisonPanel.hide();
                    this._updateLiveButtonState(false);
                }
                DataService.clearImpersonation();
                this._updateStatus();
                this._enableSecurityAnalysis(false);
                this._renderSecurityAnalysisPlaceholder();
            }
        };
        this._handleSecurityActionsClick = (e) => this._onSecurityActionClick(e);
        this._handleSecurityAnalysisClick = (e) => {
            // Handle copyable ID clicks
            const copyableId = e.target.closest('.pdt-copyable-id');
            if (copyableId) {
                const id = copyableId.textContent.trim();
                copyToClipboard(id, `Copied: ${id}`);
            }
        };

        // Sub-tab click handlers
        this.ui.subTabImpersonation.addEventListener('click', this._handleSubTabClick);
        this.ui.subTabSecurity.addEventListener('click', this._handleSubTabClick);

        this.ui.searchBtn.addEventListener('click', this._handleSearch);
        this._enterKeyHandler = addEnterKeyListener(this.ui.searchInput, this._handleSearch);
        this.ui.resultsContainer.addEventListener('click', this._handleResultsClick);
        this.ui.statusContainer.addEventListener('click', this._handleStatusClick);
        this.ui.securityActionsContainer.addEventListener('click', this._handleSecurityActionsClick);
        this.ui.securityAnalysisContent.addEventListener('click', this._handleSecurityAnalysisClick);

        // Comparison user selector change handler
        this._handleCompareUserChange = (e) => this._onCompareUserChange(e);
        this.ui.compareUserSelect.addEventListener('change', this._handleCompareUserChange);

        this._updateStatus();

        // Enable security analysis if already impersonating
        const info = DataService.getImpersonationInfo();
        this._enableSecurityAnalysis(info.isImpersonating);
    }

    /**
     * Programmatically switches to a specific sub-tab.
     * @param {string} subTab - The sub-tab to switch to ('impersonation' or 'security')
     * @private
     */
    _switchSubTab(subTab) {
        const isImpersonationTab = subTab === 'impersonation';

        this.ui.subTabImpersonation.classList.toggle('active', isImpersonationTab);
        this.ui.subTabSecurity.classList.toggle('active', !isImpersonationTab);

        this.ui.contentImpersonation.style.display = isImpersonationTab ? 'block' : 'none';
        this.ui.contentSecurity.style.display = isImpersonationTab ? 'none' : 'block';

        this.activeSubTab = subTab;
    }

    /**
     * Handles sub-tab switching between User Impersonation and Security Analysis.
     * @param {Event} e - The click event
     * @private
     */
    _onSubTabClick(e) {
        const target = e.target.closest('.pdt-sub-tab');
        if (!target) {
            return;
        }

        const subTab = target.id === 'impersonate-tab-impersonation' ? 'impersonation' : 'security';
        this._switchSubTab(subTab);
    }

    /**
     * Lifecycle hook for cleaning up event listeners to prevent memory leaks.
     */
    destroy() {
        // Define cleanup pairs: [element key, handler key, event type]
        const cleanupPairs = [
            ['subTabImpersonation', '_handleSubTabClick', 'click'],
            ['subTabSecurity', '_handleSubTabClick', 'click'],
            ['searchBtn', '_handleSearch', 'click'],
            ['searchInput', '_enterKeyHandler', 'keydown'],
            ['resultsContainer', '_handleResultsClick', 'click'],
            ['statusContainer', '_handleStatusClick', 'click'],
            ['securityActionsContainer', '_handleSecurityActionsClick', 'click'],
            ['securityAnalysisContent', '_handleSecurityAnalysisClick', 'click'],
            ['compareUserSelect', '_handleCompareUserChange', 'change']
        ];

        // Clean up all event listeners
        for (const [elemKey, handlerKey, eventType] of cleanupPairs) {
            if (this.ui[elemKey] && this[handlerKey]) {
                this.ui[elemKey].removeEventListener(eventType, this[handlerKey]);
            }
        }

        // Destroy column resizers on results table
        try {
            const table = this.ui.resultsContainer?.querySelector('table.pdt-table');
            if (table) {
                UIHelpers.destroyColumnResize(table);
            }
        } catch (_e) {
            // Intentionally ignored - cancel action
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

        // Initialize column resizing
        const table = this.ui.resultsContainer.querySelector('table.pdt-table');
        if (table) {
            table.setAttribute('data-resize-mode', 'shift');
            UIHelpers.initColumnResize(table);
        }
    }

    /**
     * Enables or disables the security analysis buttons based on impersonation state.
     * @param {boolean} enabled - Whether to enable the buttons
     * @private
     */
    _enableSecurityAnalysis(enabled) {
        if (this.ui.analyzeBtn) {
            this.ui.analyzeBtn.disabled = !enabled;
            this.ui.analyzeBtn.title = enabled
                ? 'Analyze security settings for the impersonated user'
                : 'Select a user to analyze';
        }
        if (this.ui.compareCommandsBtn) {
            this.ui.compareCommandsBtn.disabled = !enabled;
            this.ui.compareCommandsBtn.title = enabled
                ? Config.MESSAGES.IMPERSONATE.commandBarComparisonTitle
                : 'Select a user first';
        }
        // Show/hide comparison user selector
        if (this.ui.compareUserSelector) {
            this.ui.compareUserSelector.style.display = enabled ? 'flex' : 'none';
        }
        if (this.ui.liveBtn) {
            // Don't disable if live impersonation is currently active
            if (!LiveImpersonationService.isActive) {
                this.ui.liveBtn.disabled = !enabled;
            }
            this.ui.liveBtn.title = enabled
                ? Config.MESSAGES.LIVE_IMPERSONATION.liveButtonTitle
                : 'Select a user first';
        }
    }

    /**
     * Renders a placeholder message in the security analysis content area.
     * @private
     */
    _renderSecurityAnalysisPlaceholder() {
        if (this.ui.securityAnalysisContent) {
            this.ui.securityAnalysisContent.innerHTML = `
                <p class="pdt-note">${Config.MESSAGES.IMPERSONATE.selectUserFirst}</p>`;
        }
        this.securityAnalysis = null;
    }

    /**
     * Handles click events on the security analysis action buttons.
     * @param {Event} e - The click event
     * @private
     */
    _onSecurityActionClick(e) {
        const target = e.target.closest('button');
        if (!target) {
            return;
        }

        switch (target.id) {
            case 'analyze-security-btn':
                this._performSecurityAnalysis();
                break;
            case 'compare-commands-btn':
                this._performCommandBarAnalysis();
                break;
            case 'live-impersonation-btn':
                this._toggleLiveImpersonation();
                break;
            case 'open-admin-center-btn':
                this._openAdminCenter();
                break;
            case 'open-entra-btn':
                this._openEntra();
                break;
        }
    }

    /**
     * Opens the Power Platform Admin Center in a new tab.
     * @private
     */
    _openAdminCenter() {
        const link = SecurityAnalysisService.generateAdminCenterLink();
        window.open(link, '_blank');
    }

    /**
     * Opens the Microsoft Entra Admin Center in a new tab.
     * @private
     */
    _openEntra() {
        const link = SecurityAnalysisService.generateEntraLink();
        window.open(link, '_blank');
    }

    /**
     * Handles comparison user selection change.
     * @param {Event} e - The change event
     * @private
     * @async
     */
    async _onCompareUserChange(e) {
        const value = e.target.value;

        if (value === 'current') {
            this.comparisonUser = null;
            NotificationService.show('Comparing with current user', 'info');
        } else if (value === 'custom') {
            await this._showComparisonUserPicker();
        }
    }

    /**
     * Shows a user picker dialog to select a custom comparison user.
     * @private
     * @async
     */
    async _showComparisonUserPicker() {
        try {
            // Fetch all active users using DataService
            const filterClause = 'isdisabled eq false and azureactivedirectoryobjectid ne null';
            const options = `?$select=fullname,systemuserid,domainname&$filter=${filterClause}&$orderby=fullname&$top=500`;

            const result = await DataService.retrieveMultipleRecords('systemuser', options);
            const users = result.entities;

            if (!users || users.length === 0) {
                NotificationService.show('No users found', 'warning');
                this.ui.compareUserSelect.value = 'current';
                return;
            }

            // Create simple user picker dialog
            const dialog = document.createElement('div');
            dialog.className = 'pdt-dialog-overlay';
            dialog.innerHTML = `
                <div class="pdt-dialog">
                    <div class="pdt-dialog-header">
                        <h3>${Config.MESSAGES.IMPERSONATE.selectComparisonUser}</h3>
                        <button class="pdt-dialog-close" aria-label="Close">×</button>
                    </div>
                    <div class="pdt-dialog-body">
                        <input type="text" id="comparison-user-search" class="pdt-input" placeholder="Search users..." />
                        <div id="comparison-user-list" class="pdt-user-list" style="max-height: 400px; overflow-y: auto; margin-top: 10px;">
                            ${users.map(u => `
                                <div class="pdt-user-item" data-user-id="${escapeHtml(u.systemuserid)}" data-user-name="${escapeHtml(u.fullname)}">
                                    <div class="pdt-user-name">${escapeHtml(u.fullname)}</div>
                                    <div class="pdt-user-email">${escapeHtml(u.domainname || '')}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);

            // Handle search filtering
            const searchInput = dialog.querySelector('#comparison-user-search');
            const userList = dialog.querySelector('#comparison-user-list');
            const userItems = Array.from(dialog.querySelectorAll('.pdt-user-item'));

            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                userItems.forEach(item => {
                    const name = item.dataset.userName.toLowerCase();
                    item.style.display = name.includes(query) ? 'block' : 'none';
                });
            });

            // Handle user selection
            const selectPromise = new Promise((resolve) => {
                userList.addEventListener('click', (e) => {
                    const item = e.target.closest('.pdt-user-item');
                    if (item) {
                        resolve({
                            userId: item.dataset.userId,
                            userName: item.dataset.userName
                        });
                    }
                });

                dialog.querySelector('.pdt-dialog-close').addEventListener('click', () => {
                    resolve(null);
                });

                dialog.addEventListener('click', (e) => {
                    if (e.target === dialog) {
                        resolve(null);
                    }
                });
            });

            const selected = await selectPromise;
            document.body.removeChild(dialog);

            if (selected) {
                this.comparisonUser = selected;
                NotificationService.show(Config.MESSAGES.IMPERSONATE.comparisonUserSelected(selected.userName), 'success');
            } else {
                // User cancelled, reset to current user
                this.ui.compareUserSelect.value = 'current';
                this.comparisonUser = null;
            }

        } catch (error) {
            NotificationService.show(`Failed to load users: ${error.message}`, 'error');
            this.ui.compareUserSelect.value = 'current';
            this.comparisonUser = null;
        }
    }

    /**
     * Toggles live impersonation mode on/off.
     * @private
     * @async
     */
    async _toggleLiveImpersonation() {
        if (LiveImpersonationService.isActive) {
            // Stop live impersonation
            LiveImpersonationService.stop();
            LiveComparisonPanel.hide();
            this._updateLiveButtonState(false);
            NotificationService.show(Config.MESSAGES.LIVE_IMPERSONATION.stopped, 'info');
        } else {
            // Start live impersonation
            const info = DataService.getImpersonationInfo();
            if (!info.isImpersonating) {
                NotificationService.show(Config.MESSAGES.LIVE_IMPERSONATION.noUserSelected, 'warning');
                return;
            }

            try {
                this.ui.liveBtn.disabled = true;

                // Determine comparison user name for display
                const comparisonUserName = this.comparisonUser ? this.comparisonUser.userName : 'You';

                await LiveImpersonationService.start(info.userId, info.userName);

                // Show panel with appropriate label
                const panelLabel = comparisonUserName === 'You'
                    ? `Comparing: ${info.userName} vs You`
                    : `Comparing: ${info.userName} vs ${comparisonUserName}`;
                LiveComparisonPanel.show(panelLabel);

                this._updateLiveButtonState(true);
                NotificationService.show(
                    Config.MESSAGES.LIVE_IMPERSONATION.started(info.userName),
                    'success'
                );
            } catch (error) {
                console.error('[ImpersonateTab] Live impersonation failed:', error);
                NotificationService.show(
                    Config.MESSAGES.LIVE_IMPERSONATION.startFailed(error.message),
                    'error'
                );
            } finally {
                this.ui.liveBtn.disabled = false;
            }
        }
    }

    /**
     * Updates the Live Impersonation button appearance based on active state.
     * @param {boolean} isActive - Whether live impersonation is active
     * @private
     */
    _updateLiveButtonState(isActive) {
        if (!this.ui.liveBtn) {
            return;
        }

        if (isActive) {
            this.ui.liveBtn.classList.add('pdt-live-active');
            this.ui.liveBtn.textContent = Config.MESSAGES.IMPERSONATE.stopLiveButton;
            this.ui.liveBtn.title = Config.MESSAGES.LIVE_IMPERSONATION.liveButtonActiveTitle;
        } else {
            this.ui.liveBtn.classList.remove('pdt-live-active');
            this.ui.liveBtn.textContent = Config.MESSAGES.IMPERSONATE.liveImpersonationButton;
            this.ui.liveBtn.title = Config.MESSAGES.LIVE_IMPERSONATION.liveButtonTitle;
        }
    }

    /**
     * Performs a security analysis comparing the current user with the impersonated user.
     * @async
     * @private
     */
    async _performSecurityAnalysis() {
        const info = DataService.getImpersonationInfo();
        if (!info.isImpersonating) {
            return;
        }

        const analyzeBtn = this.ui.analyzeBtn;
        const originalText = analyzeBtn.textContent;

        try {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = Config.MESSAGES.IMPERSONATE.analyzing;
            this.ui.securityAnalysisContent.innerHTML = `
                <p class="pdt-note">${Config.MESSAGES.IMPERSONATE.loadingAnalysis}</p>`;

            // Get current entity context if available
            const entityLogicalName = PowerAppsApiService.isFormContextAvailable
                ? PowerAppsApiService.getEntityName()
                : null;

            // Determine which users to compare
            const targetUserId = info.userId;
            const targetUserName = info.userName;
            const comparisonUserId = this.comparisonUser ? this.comparisonUser.userId : null; // null = current user
            const comparisonUserName = this.comparisonUser ? this.comparisonUser.userName : 'You';

            // Perform security comparison
            this.securityAnalysis = await SecurityAnalysisService.compareUserSecurity(
                targetUserId,
                entityLogicalName,
                comparisonUserId
            );

            this._renderSecurityAnalysis(targetUserName, comparisonUserName, entityLogicalName);

        } catch (error) {
            console.error('[ImpersonateTab] Security analysis failed:', error);
            this.ui.securityAnalysisContent.innerHTML = `
                <div class="pdt-error">${Config.MESSAGES.IMPERSONATE.analyzeFailed(escapeHtml(error.message))}</div>`;
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = originalText;
        }
    }

    /**
     * Renders the complete security analysis results.
     * @param {string} targetUserName - The target user's name (impersonated user)
     * @param {string} comparisonUserName - The comparison user's name ('You' or custom user name)
     * @param {string|null} entityLogicalName - The current entity (if on a form)
     * @private
     */
    _renderSecurityAnalysis(targetUserName, comparisonUserName, entityLogicalName) {
        const analysis = this.securityAnalysis;
        if (!analysis) {
            return;
        }

        const content = [];

        // Entity Privileges Section (only if on a form)
        if (entityLogicalName && analysis.entityPrivileges) {
            content.push(this._renderEntityPrivileges(
                entityLogicalName, targetUserName, comparisonUserName,
                analysis.entityPrivileges, analysis.comparisonUserEntityPrivileges
            ));
        }

        // Field Security Section
        content.push(this._renderFieldSecurity(
            targetUserName, comparisonUserName,
            analysis.targetUserFieldProfiles, analysis.comparisonUserFieldProfiles
        ));

        // Team Membership Comparison Section
        content.push(this._renderTeamComparison(targetUserName, comparisonUserName, analysis));

        // Role Comparison Section
        content.push(this._renderRoleComparison(targetUserName, comparisonUserName, analysis));

        this.ui.securityAnalysisContent.innerHTML = content.join('');
    }

    /**
     * Renders the team membership comparison section.
     * @param {string} targetUserName - The target user's name (impersonated user)
     * @param {string} comparisonUserName - The comparison user's name ('You' or custom user name)
     * @param {Object} analysis - The security analysis object
     * @returns {string} HTML string
     * @private
     */
    _renderTeamComparison(targetUserName, comparisonUserName, analysis) {
        const renderTeamList = (teams, emptyMessage) => {
            if (!teams || teams.length === 0) {
                return `<p class="pdt-note pdt-note--small">${emptyMessage}</p>`;
            }
            return `<ul class="pdt-list">
                ${teams.map(t => `
                    <li class="pdt-list-item">
                        <div class="pdt-item-content">
                            <span class="pdt-item-name">${escapeHtml(t.name)}</span>
                            <code class="pdt-copyable-id" title="Click to copy ID">${escapeHtml(t.teamid)}</code>
                        </div>
                        <span class="pdt-badge-small">${escapeHtml(t.teamtype || 'Team')}</span>
                    </li>
                `).join('')}
            </ul>`;
        };

        // Get teams from analysis
        const currentUserTeams = analysis.currentUserTeams || [];
        const targetUserTeams = analysis.targetUserTeams || [];

        // Find common and unique teams
        const currentTeamIds = new Set(currentUserTeams.map(t => t.teamid));
        const targetTeamIds = new Set(targetUserTeams.map(t => t.teamid));

        const teamsInCommon = currentUserTeams.filter(t => targetTeamIds.has(t.teamid));
        const teamsOnlyYou = currentUserTeams.filter(t => !targetTeamIds.has(t.teamid));
        const teamsOnlyUser = targetUserTeams.filter(t => !currentTeamIds.has(t.teamid));

        return `
            <div class="pdt-security-card">
                <h4 class="pdt-section-header">${Config.MESSAGES.IMPERSONATE.teamComparisonTitle}</h4>
                <div class="pdt-role-comparison-stack">
                    <div class="pdt-role-section">
                        <h5 class="pdt-role-section-header pdt-role-section-header--common">
                            ${Config.MESSAGES.IMPERSONATE.teamMembershipsInCommon} (${teamsInCommon.length})
                        </h5>
                        ${renderTeamList(teamsInCommon, Config.MESSAGES.IMPERSONATE.noCommonTeams)}
                    </div>
                    <div class="pdt-role-section">
                        <h5 class="pdt-role-section-header pdt-role-section-header--you">
                            ${comparisonUserName === 'You' ? Config.MESSAGES.IMPERSONATE.teamMembershipsOnlyYou : `${comparisonUserName}'s Only Teams`} (${teamsOnlyYou.length})
                        </h5>
                        ${renderTeamList(teamsOnlyYou, Config.MESSAGES.IMPERSONATE.noUniqueTeams)}
                    </div>
                    <div class="pdt-role-section">
                        <h5 class="pdt-role-section-header pdt-role-section-header--user">
                            ${Config.MESSAGES.IMPERSONATE.teamMembershipsOnlyUser(targetUserName)} (${teamsOnlyUser.length})
                        </h5>
                        ${renderTeamList(teamsOnlyUser, Config.MESSAGES.IMPERSONATE.noUniqueTeams)}
                    </div>
                </div>
            </div>`;
    }

    /**
     * Renders the role comparison section.
     * @param {string} targetUserName - The target user's name (impersonated user)
     * @param {string} comparisonUserName - The comparison user's name ('You' or custom user name)
     * @param {Object} analysis - The security analysis object
     * @returns {string} HTML string
     * @private
     */
    _renderRoleComparison(targetUserName, comparisonUserName, analysis) {
        const renderRoleList = (roles, emptyMessage) => {
            if (!roles || roles.length === 0) {
                return `<p class="pdt-note pdt-note--small">${emptyMessage}</p>`;
            }
            return `<ul class="pdt-list">
                ${roles.map(r => {
                let badgeHtml = '<span class="pdt-badge-small">Direct</span>';

                if (r.isInherited && r.teams && r.teams.length > 0) {
                    // Create a colored badge for each team
                    const teamBadges = r.teams.map((team) => {
                        const colorIndex = this._getColorIndexForString(team.teamName);
                        return `<span class="pdt-badge-small pdt-badge-team pdt-badge-color-${colorIndex}" title="${escapeHtml(team.teamName)}">${escapeHtml(team.teamName)}</span>`;
                    }).join(' ');
                    badgeHtml = teamBadges;
                } else if (r.isInherited) {
                    badgeHtml = `<span class="pdt-badge-small">${Config.MESSAGES.IMPERSONATE.inheritedFromTeam}</span>`;
                }

                return `<li class="pdt-list-item">
                        <div class="pdt-item-content">
                            <span class="pdt-item-name">${escapeHtml(r.name)}</span>
                            <code class="pdt-copyable-id" title="Click to copy ID">${escapeHtml(r.roleid)}</code>
                        </div>
                        <div class="pdt-badge-group">${badgeHtml}</div>
                    </li>`;
            }).join('')}
            </ul>`;
        };

        return `
            <div class="pdt-security-card">
                <h4 class="pdt-section-header">${Config.MESSAGES.IMPERSONATE.roleComparisonTitle}</h4>
                <div class="pdt-role-comparison-stack">
                    <div class="pdt-role-section">
                        <h5 class="pdt-role-section-header pdt-role-section-header--common">
                            ${Config.MESSAGES.IMPERSONATE.commonRoles} (${analysis.commonRoles.length})
                        </h5>
                        ${renderRoleList(analysis.commonRoles, Config.MESSAGES.IMPERSONATE.noRolesFound)}
                    </div>
                    <div class="pdt-role-section">
                        <h5 class="pdt-role-section-header pdt-role-section-header--you">
                            ${comparisonUserName === 'You' ? Config.MESSAGES.IMPERSONATE.yourOnlyRoles : `${comparisonUserName}'s Only Roles`} (${analysis.currentUserOnlyRoles.length})
                        </h5>
                        ${renderRoleList(analysis.currentUserOnlyRoles, Config.MESSAGES.IMPERSONATE.noRolesFound)}
                    </div>
                    <div class="pdt-role-section">
                        <h5 class="pdt-role-section-header pdt-role-section-header--user">
                            ${targetUserName}'s Only Roles (${analysis.targetUserOnlyRoles.length})
                        </h5>
                        ${renderRoleList(analysis.targetUserOnlyRoles, Config.MESSAGES.IMPERSONATE.noRolesFound)}
                    </div>
                </div>
            </div>`;
    }

    /**
     * Generates depth badge HTML with icon and color.
     * @param {string|null} depth - The depth level (e.g., "Global (Org)", "Local (BU)", etc.)
     * @returns {string} HTML string for depth badge
     * @private
     */
    _getDepthBadgeHtml(depth) {
        if (!depth) {
            return '';
        }

        const depthLower = depth.toLowerCase();
        let icon = '';
        let colorClass = '';
        let shortText = '';

        if (depthLower.includes('global') || depthLower.includes('organization')) {
            icon = '🌐';
            colorClass = 'pdt-depth-global';
            shortText = 'Organization';
        } else if (depthLower.includes('deep') || depthLower.includes('parent')) {
            icon = '👥';
            colorClass = 'pdt-depth-deep';
            shortText = 'Deep';
        } else if (depthLower.includes('local') || depthLower.includes('bu')) {
            icon = '🏢';
            colorClass = 'pdt-depth-local';
            shortText = 'Business Unit';
        } else if (depthLower.includes('basic') || depthLower.includes('user')) {
            icon = '👤';
            colorClass = 'pdt-depth-basic';
            shortText = 'User';
        } else {
            return `<span class="pdt-depth-badge pdt-depth-none">${escapeHtml(depth)}</span>`;
        }

        return `<span class="pdt-depth-badge ${colorClass}" title="${escapeHtml(depth)}">${icon} ${shortText}</span>`;
    }

    /**
     * Renders the entity privileges section with comparison.
     * @param {string} entityLogicalName - The entity logical name
     * @param {string} targetUserName - The target user's name
     * @param {string} comparisonUserName - The comparison user's name
     * @param {Object} targetPrivileges - The target user's privileges object
     * @param {Object} comparisonPrivileges - The comparison user's privileges object
     * @returns {string} HTML string
     * @private
     */
    _renderEntityPrivileges(entityLogicalName, targetUserName, comparisonUserName, targetPrivileges, comparisonPrivileges) {
        const privilegeItems = [
            { key: 'read', label: Config.MESSAGES.IMPERSONATE.privilegeRead },
            { key: 'create', label: Config.MESSAGES.IMPERSONATE.privilegeCreate },
            { key: 'write', label: Config.MESSAGES.IMPERSONATE.privilegeWrite },
            { key: 'delete', label: Config.MESSAGES.IMPERSONATE.privilegeDelete },
            { key: 'append', label: Config.MESSAGES.IMPERSONATE.privilegeAppend },
            { key: 'appendto', label: Config.MESSAGES.IMPERSONATE.privilegeAppendTo },
            { key: 'assign', label: Config.MESSAGES.IMPERSONATE.privilegeAssign },
            { key: 'share', label: Config.MESSAGES.IMPERSONATE.privilegeShare }
        ];

        // eslint-disable-next-line complexity
        const privilegeHtml = privilegeItems.map(item => {
            // Get privileges for both users
            const targetPrivData = targetPrivileges[item.key];
            const targetHasPriv = typeof targetPrivData === 'object' ? targetPrivData?.hasPrivilege : targetPrivData;
            const targetDepth = typeof targetPrivData === 'object' ? targetPrivData?.depth : null;

            const comparisonPrivData = comparisonPrivileges?.[item.key];
            const comparisonHasPriv = typeof comparisonPrivData === 'object' ? comparisonPrivData?.hasPrivilege : comparisonPrivData;
            const comparisonDepth = typeof comparisonPrivData === 'object' ? comparisonPrivData?.depth : null;

            // Determine status
            const hasDifference = targetHasPriv !== comparisonHasPriv;
            let rowClass = '';
            if (hasDifference) {
                rowClass = 'pdt-privilege-row--different';
            } else if (targetHasPriv && comparisonHasPriv) {
                // Both have the privilege
                rowClass = 'pdt-privilege-row--both-have';
            } else if (!targetHasPriv && !comparisonHasPriv) {
                // Both don't have the privilege
                rowClass = 'pdt-privilege-row--both-lack';
            }

            // Format privilege status with depth badges
            const targetStatusIcon = targetHasPriv ? '✓' : '✗';
            const targetDepthBadge = targetHasPriv ? this._getDepthBadgeHtml(targetDepth) : '';

            const comparisonStatusIcon = comparisonHasPriv ? '✓' : '✗';
            const comparisonDepthBadge = comparisonHasPriv ? this._getDepthBadgeHtml(comparisonDepth) : '';

            return `
                <div class="pdt-privilege-row ${rowClass}">
                    <div class="pdt-privilege-name">${item.label}</div>
                    <div class="pdt-privilege-comparison">
                        <div class="pdt-privilege-user">
                            <span class="pdt-privilege-user-label">${escapeHtml(targetUserName)}:</span>
                            <div class="pdt-privilege-status">
                                <span class="pdt-privilege-icon ${targetHasPriv ? 'pdt-privilege--allowed' : 'pdt-privilege--denied'}">
                                    ${targetStatusIcon}
                                </span>
                                ${targetDepthBadge}
                            </div>
                        </div>
                        <div class="pdt-privilege-user">
                            <span class="pdt-privilege-user-label">${escapeHtml(comparisonUserName)}:</span>
                            <div class="pdt-privilege-status">
                                <span class="pdt-privilege-icon ${comparisonHasPriv ? 'pdt-privilege--allowed' : 'pdt-privilege--denied'}">
                                    ${comparisonStatusIcon}
                                </span>
                                ${comparisonDepthBadge}
                            </div>
                        </div>
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="pdt-security-card">
                <h4 class="pdt-section-header">
                    ${Config.MESSAGES.IMPERSONATE.entityPrivilegesTitle}: 
                    <code>${escapeHtml(entityLogicalName)}</code>
                </h4>
                <div class="pdt-privilege-comparison-grid">
                    ${privilegeHtml}
                </div>
            </div>`;
    }

    /**
     * Renders the field security section with comparison.
     * @param {string} targetUserName - The target user's name
     * @param {string} comparisonUserName - The comparison user's name
     * @param {Array} targetFieldProfiles - The target user's field security profiles
     * @param {Array} comparisonFieldProfiles - The comparison user's field security profiles
     * @param {string|null} entityLogicalName - The current entity
     * @returns {string} HTML string
     * @private
     */
    _renderFieldSecurity(targetUserName, comparisonUserName, targetFieldProfiles, comparisonFieldProfiles) {
        const hasTargetProfiles = targetFieldProfiles && targetFieldProfiles.length > 0;
        const hasComparisonProfiles = comparisonFieldProfiles && comparisonFieldProfiles.length > 0;

        if (!hasTargetProfiles && !hasComparisonProfiles) {
            return `
                <div class="pdt-security-card">
                    <h4 class="pdt-section-header">${Config.MESSAGES.IMPERSONATE.fieldSecurityTitle}</h4>
                    <p class="pdt-note">${Config.MESSAGES.IMPERSONATE.noFieldSecurityProfiles}</p>
                </div>`;
        }

        let content = `
            <div class="pdt-security-card">
                <h4 class="pdt-section-header">${Config.MESSAGES.IMPERSONATE.fieldSecurityTitle}</h4>
                <div class="pdt-field-security-comparison">`;

        // Target user profiles
        if (hasTargetProfiles) {
            const targetProfilesList = targetFieldProfiles.map(p => {
                const inheritedBadge = p.isInherited
                    ? '<span class="pdt-badge-small pdt-badge--inherited" title="Inherited from team">Team</span>'
                    : '';
                const columnBadge = p.permissions?.length > 0
                    ? `<span class="pdt-badge-small">${p.permissions.length} columns</span>`
                    : '';

                // Render column permissions if available
                let columnsHtml = '';
                if (p.permissions && p.permissions.length > 0) {
                    const permissionRows = p.permissions.map(perm => {
                        const canRead = perm.canread === 4 ? '✓' : '✗';
                        const canCreate = perm.cancreate === 4 ? '✓' : '✗';
                        const canUpdate = perm.canupdate === 4 ? '✓' : '✗';
                        return `
                            <tr>
                                <td>${escapeHtml(perm.attributelogicalname)}</td>
                                <td class="pdt-permission-cell ${perm.canread === 4 ? 'pdt-permission-yes' : 'pdt-permission-no'}">${canRead}</td>
                                <td class="pdt-permission-cell ${perm.cancreate === 4 ? 'pdt-permission-yes' : 'pdt-permission-no'}">${canCreate}</td>
                                <td class="pdt-permission-cell ${perm.canupdate === 4 ? 'pdt-permission-yes' : 'pdt-permission-no'}">${canUpdate}</td>
                            </tr>`;
                    }).join('');

                    columnsHtml = `
                        <div class="pdt-field-permissions-table">
                            <table class="pdt-table">
                                <thead>
                                    <tr>
                                        <th>Column</th>
                                        <th>Read</th>
                                        <th>Create</th>
                                        <th>Update</th>
                                    </tr>
                                </thead>
                                <tbody>${permissionRows}</tbody>
                            </table>
                        </div>`;
                }

                return `
                    <li class="pdt-profile-item">
                        <div class="pdt-profile-header">
                            <span class="pdt-profile-name">${escapeHtml(p.name)}</span>
                            ${inheritedBadge}
                            ${columnBadge}
                        </div>
                        ${columnsHtml}
                    </li>`;
            }).join('');

            content += `
                <div class="pdt-field-user-section">
                    <h5 class="pdt-subsection-header">${escapeHtml(targetUserName)}'s Field Security Profiles</h5>
                    <ul class="pdt-profile-list">${targetProfilesList}</ul>
                </div>`;
        }

        // Comparison user profiles
        if (hasComparisonProfiles) {
            const comparisonProfilesList = comparisonFieldProfiles.map(p => {
                const inheritedBadge = p.isInherited
                    ? '<span class="pdt-badge-small pdt-badge--inherited" title="Inherited from team">Team</span>'
                    : '';
                const columnBadge = p.permissions?.length > 0
                    ? `<span class="pdt-badge-small">${p.permissions.length} columns</span>`
                    : '';

                // Render column permissions if available
                let columnsHtml = '';
                if (p.permissions && p.permissions.length > 0) {
                    const permissionRows = p.permissions.map(perm => {
                        const canRead = perm.canread === 4 ? '✓' : '✗';
                        const canCreate = perm.cancreate === 4 ? '✓' : '✗';
                        const canUpdate = perm.canupdate === 4 ? '✓' : '✗';
                        return `
                            <tr>
                                <td>${escapeHtml(perm.attributelogicalname)}</td>
                                <td class="pdt-permission-cell ${perm.canread === 4 ? 'pdt-permission-yes' : 'pdt-permission-no'}">${canRead}</td>
                                <td class="pdt-permission-cell ${perm.cancreate === 4 ? 'pdt-permission-yes' : 'pdt-permission-no'}">${canCreate}</td>
                                <td class="pdt-permission-cell ${perm.canupdate === 4 ? 'pdt-permission-yes' : 'pdt-permission-no'}">${canUpdate}</td>
                            </tr>`;
                    }).join('');

                    columnsHtml = `
                        <div class="pdt-field-permissions-table">
                            <table class="pdt-table">
                                <thead>
                                    <tr>
                                        <th>Column</th>
                                        <th>Read</th>
                                        <th>Create</th>
                                        <th>Update</th>
                                    </tr>
                                </thead>
                                <tbody>${permissionRows}</tbody>
                            </table>
                        </div>`;
                }

                return `
                    <li class="pdt-profile-item">
                        <div class="pdt-profile-header">
                            <span class="pdt-profile-name">${escapeHtml(p.name)}</span>
                            ${inheritedBadge}
                            ${columnBadge}
                        </div>
                        ${columnsHtml}
                    </li>`;
            }).join('');

            const comparisonLabel = comparisonUserName === 'You'
                ? 'Your Field Security Profiles'
                : `${escapeHtml(comparisonUserName)}'s Field Security Profiles`;

            content += `
                <div class="pdt-field-user-section">
                    <h5 class="pdt-subsection-header">${comparisonLabel}</h5>
                    <ul class="pdt-profile-list">${comparisonProfilesList}</ul>
                </div>`;
        }

        content += '</div></div>';
        return content;
    }

    /**
     * Performs command bar visibility analysis comparing current user with impersonated user.
     * @async
     * @private
     */
    async _performCommandBarAnalysis() {
        const info = DataService.getImpersonationInfo();
        if (!info.isImpersonating) {
            return;
        }

        const compareBtn = this.ui.compareCommandsBtn;
        const originalText = compareBtn.textContent;

        try {
            compareBtn.disabled = true;
            compareBtn.textContent = Config.MESSAGES.IMPERSONATE.comparingCommands;
            this.ui.securityAnalysisContent.innerHTML = `
                <p class="pdt-note">${Config.MESSAGES.IMPERSONATE.loadingAnalysis}</p>`;

            // Get current context (Form or Grid)
            const context = CommandBarAnalysisService.getCurrentContext();
            const entityLogicalName = CommandBarAnalysisService.getCurrentEntity();

            // Determine which users to compare
            const targetUserId = info.userId;
            const targetUserName = info.userName;
            const comparisonUserId = this.comparisonUser ? this.comparisonUser.userId : null; // null = current user
            const comparisonUserName = this.comparisonUser ? this.comparisonUser.userName : 'You';

            // Perform command visibility comparison
            const comparison = await CommandBarAnalysisService.compareCommandBarVisibility(
                targetUserId,
                entityLogicalName,
                context,
                comparisonUserId
            );

            // Render results with appropriate labels
            this._renderCommandBarComparison(comparison, targetUserName, comparisonUserName, entityLogicalName, context);

        } catch (error) {
            console.error('[ImpersonateTab] Command bar analysis failed:', error);
            this.ui.securityAnalysisContent.innerHTML = `
                <div class="pdt-error">${Config.MESSAGES.IMPERSONATE.commandComparisonFailed(escapeHtml(error.message))}</div>`;
        } finally {
            compareBtn.disabled = false;
            compareBtn.textContent = originalText;
        }
    }

    /**
     * Renders command bar comparison results.
     * @param {Object} comparison - The comparison result object
     * @param {string} targetUserName - The target user's name (impersonated user)
     * @param {string} comparisonUserName - The comparison user's name ('You' or custom user name)
     * @param {string|null} entityLogicalName - The current entity
     * @param {string} context - The context (Form, HomePageGrid, etc.)
     * @private
     */
    _renderCommandBarComparison(comparison, targetUserName, comparisonUserName, entityLogicalName, context) {
        const { commands, summary } = comparison;

        // Build summary section
        const contextLabel = context === 'Form'
            ? Config.MESSAGES.IMPERSONATE.commandFormContext
            : Config.MESSAGES.IMPERSONATE.commandGridContext;
        const entityLabel = entityLogicalName || Config.MESSAGES.IMPERSONATE.commandGlobalContext;

        let content = `
            <div class="pdt-security-card">
                <h4 class="pdt-section-header">${Config.MESSAGES.IMPERSONATE.commandBarComparisonTitle}</h4>
                <div class="pdt-command-summary">
                    <div class="pdt-command-context">
                        <span class="pdt-label">${Config.MESSAGES.IMPERSONATE.commandContext}:</span>
                        <span class="pdt-value">${contextLabel}</span>
                        <span class="pdt-label ml-15">${Config.MESSAGES.IMPERSONATE.commandEntity}:</span>
                        <span class="pdt-value"><code>${escapeHtml(entityLabel)}</code></span>
                    </div>
                    <p class="pdt-note pdt-note--small mt-10">
                        ${Config.MESSAGES.IMPERSONATE.commandComparisonNote}
                    </p>
                </div>`;

        // Show summary stats
        if (summary.totalCommands === 0) {
            content += `
                <p class="pdt-note">${Config.MESSAGES.IMPERSONATE.noCommandDifferences}</p>
            </div>`;
            this.ui.securityAnalysisContent.innerHTML = content;
            return;
        }

        // Count OOTB vs custom commands
        const ootbCount = commands.filter(c => c.isStandardCommand).length;
        const customCount = commands.filter(c => !c.isStandardCommand).length;
        const managedCount = summary.managedCommands || 0;
        const unmanagedCount = summary.unmanagedCommands || 0;

        content += `
            <div class="pdt-command-stats mt-10">
                <span class="pdt-stat">
                    📊 Analyzed <strong>${summary.totalCommands}</strong> commands:
                    <span class="pdt-badge--ootb pdt-inline-badge">${ootbCount} OOTB</span>
                    ${customCount > 0 ? `<span class="pdt-inline-badge">${customCount} Custom</span>` : ''}
                    ${managedCount > 0 ? `<span class="pdt-badge-small" title="From managed solutions">📦 ${managedCount} managed</span>` : ''}
                    ${unmanagedCount > 0 ? `<span class="pdt-badge-small" title="Unmanaged customizations">✏️ ${unmanagedCount} unmanaged</span>` : ''}
                </span>
            </div>
            <div class="pdt-command-stats mt-5">
                ${summary.differences > 0 ? `<span class="pdt-stat pdt-stat--highlight">
                    ⚠️ Found <strong>${summary.differences}</strong> definite difference${summary.differences !== 1 ? 's' : ''} in command visibility
                </span>` : `<span class="pdt-stat pdt-stat--success">
                    ✓ No definite differences found
                </span>`}
                ${summary.potentialDifferences > 0 ? `<span class="pdt-stat pdt-stat--warning ml-10">
                    ⚡ ${summary.potentialDifferences} potential difference${summary.potentialDifferences !== 1 ? 's' : ''} (custom rules)
                </span>` : ''}
            </div>`;

        // Separate commands by difference type
        const definiteDifferences = commands.filter(c => c.difference === 'only-current' || c.difference === 'only-target');
        const potentialDifferences = commands.filter(c => c.difference === 'potential-difference');
        const sameCommands = commands.filter(c => c.difference === 'same');

        // Show definite differences
        if (definiteDifferences.length > 0) {
            content += `
                <details class="pdt-command-differences mt-15" open>
                    <summary class="pdt-details-summary pdt-details-summary--danger">
                        ⚠️ Definite Differences (${definiteDifferences.length})
                    </summary>
                    <p class="pdt-note pdt-note--small mt-5">These commands have confirmed different visibility based on privileges.</p>
                    <div class="pdt-command-list">
                        ${definiteDifferences.map(cmd => this._renderCommandItem(cmd, targetUserName, comparisonUserName, false)).join('')}
                    </div>
                </details>`;
        }

        // Show potential differences (custom rules with different security context)
        if (potentialDifferences.length > 0) {
            content += `
                <details class="pdt-command-potential mt-15" open>
                    <summary class="pdt-details-summary">
                        ⚡ Potential Differences - Custom Rules (${potentialDifferences.length})
                    </summary>
                    <p class="pdt-note pdt-note--small mt-5">
                        These commands use custom JavaScript rules and the users have different security roles/teams.
                        The actual visibility may differ based on what these rules check.
                    </p>
                    <div class="pdt-command-list">
                        ${potentialDifferences.map(cmd => this._renderCommandItem(cmd, targetUserName, comparisonUserName, true)).join('')}
                    </div>
                </details>`;
        }

        // Optionally show same commands in a collapsed section
        if (sameCommands.length > 0) {
            content += `
                <details class="pdt-command-same mt-15">
                    <summary class="pdt-details-summary pdt-details-summary--success">
                        ✓ Commands with Same Visibility (${sameCommands.length})
                    </summary>
                    <div class="pdt-command-list">
                        ${sameCommands.map(cmd => this._renderCommandItem(cmd, targetUserName, comparisonUserName, true)).join('')}
                    </div>
                </details>`;
        }

        content += '</div>';
        this.ui.securityAnalysisContent.innerHTML = content;

        // Add click handlers for command IDs to copy
        this.ui.securityAnalysisContent.querySelectorAll('.pdt-command-id, .pdt-command-id-small').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
                const commandId = el.textContent;
                copyToClipboard(commandId, Config.MESSAGES.IMPERSONATE.commandIdCopied);
            });
        });
    }

    /**
     * Renders a single command item with full details.
     * @param {Object} cmd - The command comparison object
     * @param {string} targetUserName - The target user's name (impersonated user)
     * @param {string} comparisonUserName - The comparison user's name ('You' or custom user name)
     * @param {boolean} hideBlockedBy - Whether to hide the blocked by section (for potential differences)
     * @returns {string} HTML string
     * @private
     */
    _renderCommandItem(cmd, targetUserName, comparisonUserName, hideBlockedBy = false) {
        let differenceClass, differenceLabel, differenceIcon;

        if (cmd.difference === 'only-current') {
            differenceClass = 'pdt-command-item--only-you';
            differenceLabel = comparisonUserName === 'You' ? Config.MESSAGES.IMPERSONATE.onlyYouCanSee : `Only ${comparisonUserName} Can See`;
            differenceIcon = '👤';
        } else if (cmd.difference === 'only-target') {
            differenceClass = 'pdt-command-item--only-user';
            differenceLabel = `Only ${targetUserName} Can See`;
            differenceIcon = '👥';
        } else if (cmd.difference === 'potential-difference') {
            differenceClass = 'pdt-command-item--potential';
            differenceLabel = 'Potential difference (custom rules)';
            differenceIcon = '⚡';
        } else {
            differenceClass = 'pdt-command-item--same';
            differenceLabel = 'Same visibility';
            differenceIcon = '✓';
        }

        // Build source badge - distinguish OOTB from custom
        let sourceType;
        if (cmd.isStandardCommand) {
            sourceType = '<span class="pdt-badge-small pdt-badge--ootb">OOTB</span>';
        } else if (cmd.isModernCommand) {
            // Modern commanding (new framework)
            if (cmd.isManaged) {
                sourceType = `<span class="pdt-badge-small pdt-badge--modern">⚡ Modern</span><span class="pdt-badge-small pdt-badge--managed">📦 ${escapeHtml(cmd.solutionName)}</span>`;
            } else {
                sourceType = `<span class="pdt-badge-small pdt-badge--modern">⚡ Modern</span><span class="pdt-badge-small pdt-badge--unmanaged">✏️ ${escapeHtml(cmd.solutionName)}</span>`;
            }
        } else if (cmd.isManaged) {
            sourceType = `<span class="pdt-badge-small pdt-badge--managed">📦 ${escapeHtml(cmd.solutionName)}</span>`;
        } else {
            sourceType = `<span class="pdt-badge-small pdt-badge--unmanaged">✏️ ${escapeHtml(cmd.solutionName)}</span>`;
        }

        // Show which rules block the user who can't see this command (only for definite differences)
        const blockedBy = cmd.difference === 'only-current'
            ? cmd.targetUserBlockedBy
            : cmd.currentUserBlockedBy;

        // Make it clear WHO is blocked
        const blockedByLabel = cmd.difference === 'only-current'
            ? `${escapeHtml(targetUserName)} is blocked by:`
            : `${escapeHtml(comparisonUserName)} ${comparisonUserName === 'You' ? 'are' : 'is'} blocked by:`;

        const blockedByHtml = !hideBlockedBy && blockedBy && blockedBy.length > 0
            ? `<div class="pdt-command-blocked">
                   ${blockedByLabel} ${blockedBy.slice(0, 3).map(rule => escapeHtml(rule)).join(', ')}${blockedBy.length > 3 ? ` +${blockedBy.length - 3} more` : ''}
               </div>`
            : '';

        return `
            <div class="pdt-command-item ${differenceClass}">
                <div class="pdt-command-header">
                    <div class="pdt-command-header-left">
                        <span class="pdt-command-name">${escapeHtml(cmd.commandName)}</span>
                        <code class="pdt-command-id" title="Click to copy">${escapeHtml(cmd.commandId)}</code>
                    </div>
                    <div class="pdt-command-header-right">
                        <span class="pdt-command-difference">${differenceIcon} ${differenceLabel}</span>
                    </div>
                </div>
                <div class="pdt-command-meta">
                    ${sourceType}
                    ${cmd.selectionRequired ? '<span class="pdt-badge-small pdt-badge--info" title="Requires record selection">Selection Required</span>' : ''}
                </div>
                ${blockedByHtml}
            </div>`;
    }

    /**
     * Renders a command item with custom JavaScript rules details.
     * @param {Object} cmd - The command comparison object with customRules
     * @returns {string} HTML string
     * @private
     */
    _renderCommandWithCustomRules(cmd) {
        const sourceType = cmd.isStandardCommand
            ? '<span class="pdt-badge-small pdt-badge--ootb">OOTB</span>'
            : `<span class="pdt-badge-small">${escapeHtml(cmd.solutionName || 'Custom')}</span>`;

        // Separate evaluated and unevaluated custom rules
        const evaluatedRules = cmd.customRules?.filter(r => r.evaluated) || [];
        const unevaluatedRules = cmd.customRules?.filter(r => !r.evaluated) || [];

        // Render custom rules details
        let customRulesHtml = '';
        if (cmd.customRules && cmd.customRules.length > 0) {
            let rulesContent = '';

            if (evaluatedRules.length > 0) {
                const evalItems = evaluatedRules.map(rule => {
                    const resultIcon = rule.result ? '✅' : '❌';
                    const functionInfo = rule.functionName
                        ? `<code class="pdt-code-inline">${escapeHtml(rule.functionName)}()</code>`
                        : `<span>${escapeHtml(rule.id)}</span>`;
                    const libraryInfo = rule.library
                        ? `<span class="pdt-text-small pdt-text-muted"> from ${escapeHtml(rule.library)}</span>`
                        : '';
                    return `<li>${resultIcon} ${functionInfo}${libraryInfo} = <strong>${rule.result ? 'true' : 'false'}</strong></li>`;
                }).join('');
                rulesContent += `
                    <div class="pdt-rules-group">
                        <span class="pdt-label pdt-label--success">✅ Evaluated (${evaluatedRules.length}):</span>
                        <ul class="pdt-custom-rules-list pdt-custom-rules-list--evaluated">${evalItems}</ul>
                    </div>`;
            }

            if (unevaluatedRules.length > 0) {
                const unevalItems = unevaluatedRules.map(rule => {
                    const functionInfo = rule.functionName
                        ? `<code class="pdt-code-inline">${escapeHtml(rule.functionName)}()</code>`
                        : `<span class="pdt-text-muted">${escapeHtml(rule.id)}</span>`;
                    const libraryInfo = rule.library
                        ? `<span class="pdt-text-small pdt-text-muted"> from ${escapeHtml(rule.library)}</span>`
                        : '';
                    const reason = rule.reason
                        ? `<span class="pdt-text-small pdt-text-muted"> - ${escapeHtml(rule.reason)}</span>`
                        : '';
                    return `<li>⚠️ ${functionInfo}${libraryInfo}${reason}</li>`;
                }).join('');
                rulesContent += `
                    <div class="pdt-rules-group">
                        <span class="pdt-label pdt-label--warning">⚠️ Could Not Evaluate (${unevaluatedRules.length}):</span>
                        <ul class="pdt-custom-rules-list pdt-custom-rules-list--unevaluated">${unevalItems}</ul>
                    </div>`;
            }

            customRulesHtml = `<div class="pdt-custom-rules-details">${rulesContent}</div>`;
        }

        // Determine the badge based on evaluation status
        let statusBadge = '🔧 Custom Rules';
        if (evaluatedRules.length > 0 && unevaluatedRules.length === 0) {
            // All rules evaluated
            const allPassed = evaluatedRules.every(r => r.result);
            statusBadge = allPassed ? '✅ All Rules Passed' : '❌ Rule Failed';
        } else if (evaluatedRules.length > 0) {
            statusBadge = '⚠️ Partially Evaluated';
        }

        return `
            <div class="pdt-command-item pdt-command-item--custom-rules">
                <div class="pdt-command-header">
                    <span class="pdt-command-name">${escapeHtml(cmd.commandName)}</span>
                    <span class="pdt-command-difference">${statusBadge}</span>
                </div>
                <div class="pdt-command-details">
                    <code class="pdt-command-id" title="Click to copy">${escapeHtml(cmd.commandId)}</code>
                    ${sourceType}
                </div>
                ${customRulesHtml}
            </div>`;
    }

    /**
     * Renders a compact command item for the "same visibility" section.
     * @param {Object} cmd - The command comparison object
     * @returns {string} HTML string
     * @private
     */
    _renderCommandItemCompact(cmd) {
        const visibleClass = cmd.visibleToCurrentUser ? 'pdt-visible' : 'pdt-hidden';
        const visibleIcon = cmd.visibleToCurrentUser ? '✓' : '✗';
        const sourceType = cmd.isStandardCommand
            ? '<span class="pdt-badge-small pdt-badge--ootb">OOTB</span>'
            : '';

        // Build blocked reasons inline for hidden commands
        let blockedInfo = '';
        if (!cmd.visibleToCurrentUser && cmd.currentUserBlockedBy && cmd.currentUserBlockedBy.length > 0) {
            const reasons = cmd.currentUserBlockedBy.slice(0, 2).join('; ');
            blockedInfo = `<span class="pdt-blocked-reason" title="${escapeHtml(cmd.currentUserBlockedBy.join(', '))}">(${escapeHtml(reasons)})</span>`;
        }

        return `
            <div class="pdt-command-item-compact ${visibleClass}">
                <span class="pdt-command-status">${visibleIcon}</span>
                <span class="pdt-command-name">${escapeHtml(cmd.commandName)}</span>
                ${sourceType}
                <code class="pdt-command-id-small">${escapeHtml(cmd.commandId)}</code>
                ${blockedInfo}
            </div>`;
    }

    /**
     * Generates a consistent color index (0-7) for a string using FNV-1a hash.
     * @param {string} str - The string to hash
     * @returns {number} Color index from 0-7
     * @private
     */
    _getColorIndexForString(str) {
        let hash = 2166136261;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24); // FNV prime multiply
        }
        return (hash >>> 0) % 8;
    }
}