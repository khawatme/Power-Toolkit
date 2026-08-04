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
import { CommandBarAnalysisService } from '../services/CommandBarAnalysisService.js';
import { QuickCheckService } from '../services/QuickCheckService.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
import { NotificationService } from '../services/NotificationService.js';
import { addEnterKeyListener, escapeHtml, escapeODataString, generateSortableTableHeaders, sortArrayByColumn, toggleSortState, copyToClipboard } from '../helpers/index.js';
import { UIHelpers } from '../helpers/ui.helpers.js';
import { Config } from '../constants/index.js';

/**
 * Columns a free-text user search matches on. `domainname` is the sign-in name and
 * `internalemailaddress` the primary email — searching name alone made the "ID, name, or email"
 * placeholder a lie.
 * @private
 * @type {string[]}
 */
const USER_SEARCH_COLUMNS = ['fullname', 'domainname', 'internalemailaddress'];

/**
 * Matches a bare GUID, so an id search can target the record key instead of a text column.
 * @private
 */
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cap on users returned per search. Large tenants hold thousands of users and the results are
 * rendered as one HTML string, so an unbounded query stalls the panel. Results are ordered by name,
 * so the cap is deterministic and the user is told when it bites.
 * @private
 */
const USER_SEARCH_LIMIT = 250;

/**
 * Cap on users loaded into the comparison-user picker. Higher than {@link USER_SEARCH_LIMIT}
 * because the picker filters the loaded page client-side instead of re-querying.
 * @private
 */
const PICKER_USER_LIMIT = 500;

/** Most alternative form names to list before summarising the tail. @private */
const MAX_NAMED_FORMS = 3;

/** Most app names to list before summarising the tail. @private */
const MAX_NAMED_APPS = 6;

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
        /** @private {number} Guards against an older search overwriting a newer one. */
        this._searchToken = 0;
        /** @private {boolean} True while Analyze Security or Compare Commands is running. */
        this._analysisInFlight = false;
        /** @private {number} Identifies the newest analysis, so a stale one cannot render. */
        this._analysisToken = 0;
        /** @private {boolean} True while a Quick Check is running. */
        this._quickCheckInFlight = false;
        /** @private {number} Identifies the newest Quick Check, so a stale one cannot render. */
        this._quickCheckToken = 0;
        /** @private {Function|null} Resolves an open comparison-user picker, so destroy() can close it. */
        this._closeComparisonUserPicker = null;

        // Event handler references for cleanup
        /** @private {Function|null} */ this._handleSearch = null;
        /** @private {Function|null} */ this._enterKeyHandler = null;
        /** @private {Function|null} */ this._handleResultsClick = null;
        /** @private {Function|null} */ this._handleResultsKeydown = null;
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
            <div class="section-title">${Config.MESSAGES.IMPERSONATE.sectionTitle}</div>
            <div id="impersonation-status-container" class="mt-15" role="status" aria-live="polite"></div>

            <div class="pdt-content-host">
                <div class="pdt-sub-tabs" role="tablist">
                    <button id="impersonate-tab-impersonation" class="pdt-sub-tab active" role="tab" aria-selected="true" aria-controls="impersonate-content-impersonation">${Config.MESSAGES.IMPERSONATE.userImpersonationTab}</button>
                    <button id="impersonate-tab-security" class="pdt-sub-tab" role="tab" aria-selected="false" aria-controls="impersonate-content-security">${Config.MESSAGES.IMPERSONATE.securityAnalysisTab}</button>
                </div>

                <!-- User Impersonation Sub-Tab Content -->
                <div id="impersonate-content-impersonation" role="tabpanel" aria-labelledby="impersonate-tab-impersonation">
                    <p class="pdt-note">
                        ${Config.MESSAGES.IMPERSONATE.impersonationDescription}
                    </p>
                    <div class="pdt-toolbar">
                        <input type="text" id="impersonate-search-input" class="pdt-input flex-grow" placeholder="${Config.MESSAGES.IMPERSONATE.searchPlaceholder}">
                        <button id="impersonate-search-btn" class="modern-button">${Config.MESSAGES.IMPERSONATE.searchButton}</button>
                    </div>
                    <div id="impersonate-results-container" class="pdt-table-wrapper"></div>
                </div>
                
                <!-- Security Analysis Sub-Tab Content -->
                <div id="impersonate-content-security" role="tabpanel" aria-labelledby="impersonate-tab-security" style="display:none;">
                    <div class="pdt-compare-user-selector" style="display:none;">
                        <label class="pdt-label">${Config.MESSAGES.IMPERSONATE.compareWith}</label>
                        <select id="compare-user-select" class="pdt-select">
                            <option value="current">${Config.MESSAGES.IMPERSONATE.compareWithCurrentUser}</option>
                            <option value="custom">${Config.MESSAGES.IMPERSONATE.compareWithAnotherUser}</option>
                        </select>
                    </div>
                    <div id="quick-check-panel" class="pdt-quick-check-panel" role="status" aria-live="polite"></div>
                    <div id="security-analysis-actions" class="pdt-toolbar pdt-security-actions">
                        <button id="quick-check-btn" class="modern-button" disabled title="${Config.MESSAGES.QUICK_CHECK.buttonTitle}" aria-controls="quick-check-panel">
                            ${Config.MESSAGES.QUICK_CHECK.buttonLabel}
                        </button>
                        <button id="analyze-security-btn" class="modern-button" disabled title="${Config.MESSAGES.IMPERSONATE.selectUserFirst}">
                            ${Config.MESSAGES.IMPERSONATE.analyzeButton}
                        </button>
                        <button id="compare-commands-btn" class="modern-button" disabled title="${Config.MESSAGES.IMPERSONATE.commandBarComparisonTitle}">
                            ${Config.MESSAGES.IMPERSONATE.compareCommandsButton}
                        </button>
                        <button id="open-admin-center-btn" class="modern-button secondary" title="${Config.MESSAGES.IMPERSONATE.openAdminCenterTitle}">
                            ${Config.MESSAGES.IMPERSONATE.openAdminCenter}
                        </button>
                        <button id="open-entra-btn" class="modern-button secondary" title="${Config.MESSAGES.IMPERSONATE.openEntraTitle}">
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
            openAdminCenterBtn: element.querySelector('#open-admin-center-btn'),
            securityAnalysisContent: element.querySelector('#security-analysis-content'),
            securityActionsContainer: element.querySelector('#security-analysis-actions'),
            quickCheckBtn: element.querySelector('#quick-check-btn'),
            quickCheckPanel: element.querySelector('#quick-check-panel')
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
                this._selectUser(row);
            }
        };
        this._handleResultsKeydown = (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') {
                return;
            }
            const row = e.target.closest('tr[data-user-id]');
            if (row) {
                e.preventDefault();
                this._selectUser(row);
            }
        };
        this._handleStatusClick = (e) => {
            if (e.target.id === 'impersonate-clear-btn') {
                // The Quick Check on screen describes a user we are about to stop impersonating.
                this._resetQuickCheck();
                DataService.clearImpersonation();
                this._updateStatus();
                this._enableSecurityAnalysis(false);
                this._renderSecurityAnalysisPlaceholder();
                // The comparison target only made sense against the user we just stopped
                // impersonating, and its selector is now hidden — leaving it set would silently
                // apply to whoever is picked next.
                this.comparisonUser = null;
                this.ui.compareUserSelect.value = 'current';
            }
        };
        this._handleSecurityActionsClick = (e) => this._onSecurityActionClick(e);
        this._handleSecurityAnalysisClick = (e) => {
            // One delegated handler for every copyable token in the panel; the command list is
            // re-rendered often, so per-element listeners would have to be re-attached each time.
            const commandId = e.target.closest('.pdt-command-id');
            if (commandId) {
                copyToClipboard(commandId.textContent.trim(), Config.MESSAGES.IMPERSONATE.commandIdCopied);
                return;
            }

            const copyableId = e.target.closest('.pdt-copyable-id');
            if (copyableId) {
                const id = copyableId.textContent.trim();
                copyToClipboard(id, Config.MESSAGES.IMPERSONATE.copiedId(id));
            }
        };

        // Sub-tab click handlers
        this.ui.subTabImpersonation.addEventListener('click', this._handleSubTabClick);
        this.ui.subTabSecurity.addEventListener('click', this._handleSubTabClick);

        this.ui.searchBtn.addEventListener('click', this._handleSearch);
        this._enterKeyHandler = addEnterKeyListener(this.ui.searchInput, this._handleSearch);
        this.ui.resultsContainer.addEventListener('click', this._handleResultsClick);
        this.ui.resultsContainer.addEventListener('keydown', this._handleResultsKeydown);
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
        this.ui.subTabImpersonation.setAttribute('aria-selected', String(isImpersonationTab));
        this.ui.subTabSecurity.setAttribute('aria-selected', String(!isImpersonationTab));

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
        // Settle any open comparison-user picker so its dialog is torn down with the tab.
        this._closeComparisonUserPicker?.();

        // Define cleanup pairs: [element key, handler key, event type]
        const cleanupPairs = [
            ['subTabImpersonation', '_handleSubTabClick', 'click'],
            ['subTabSecurity', '_handleSubTabClick', 'click'],
            ['searchBtn', '_handleSearch', 'click'],
            ['searchInput', '_enterKeyHandler', 'keydown'],
            ['resultsContainer', '_handleResultsClick', 'click'],
            ['resultsContainer', '_handleResultsKeydown', 'keydown'],
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
                    ${Config.MESSAGES.IMPERSONATE.currentlyImpersonating} <strong>${escapeHtml(info.userName)}</strong>
                    <button id="impersonate-clear-btn" class="modern-button secondary ml-auto" style="padding: 4px 10px; font-size: 12px;">${Config.MESSAGES.IMPERSONATE.clearButton}</button>
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

        // Enter fires the search regardless of the disabled button, so two searches can overlap and
        // the slower one would win. Only the newest token is allowed to touch the results.
        const token = ++this._searchToken;

        // Show loading state
        this.ui.searchBtn.disabled = true;
        this.ui.searchBtn.textContent = Config.MESSAGES.IMPERSONATE.searching;
        this.ui.resultsContainer.innerHTML = `<p class="pdt-note">${Config.MESSAGES.IMPERSONATE.searching}</p>`;

        try {
            const options = `?$select=fullname,systemuserid,domainname&$filter=${this._buildUserSearchFilter(searchTerm)}&$orderby=fullname&$top=${USER_SEARCH_LIMIT}`;

            // Deliberately un-impersonated: the user picker must keep working while impersonating
            // someone who cannot read the systemuser table, or there is no way back.
            const result = await DataService.retrieveMultipleRecordsAsSelf('systemuser', options);
            if (token !== this._searchToken) {
                return;
            }
            this.lastSearchResults = result.entities; // Cache the results
            this.sortState = { column: 'fullname', direction: 'asc' }; // Reset sort on new search
            this._renderResults(); // Render the sorted results
        } catch (e) {
            if (token !== this._searchToken) {
                return;
            }
            this.ui.resultsContainer.innerHTML = `<div class="pdt-error">${Config.MESSAGES.IMPERSONATE.searchFailed(escapeHtml(e.message))}</div>`;
        } finally {
            if (token === this._searchToken) {
                // Reset button state
                this.ui.searchBtn.disabled = false;
                this.ui.searchBtn.textContent = Config.MESSAGES.IMPERSONATE.searchButton;
            }
        }
    }

    /**
     * Starts impersonating the user a results row stands for.
     * @param {HTMLElement} row - The results row carrying the user's id and name
     * @private
     */
    _selectUser(row) {
        const userId = row.dataset.userId;
        const fullName = row.dataset.fullName;
        // Any Quick Check on screen describes the previous user; drop it before switching.
        this._resetQuickCheck();
        DataService.setImpersonation(userId, fullName);
        this._updateStatus();
        this._enableSecurityAnalysis(true);
        // The panel still holds the previous user's findings; keeping them would attribute one
        // user's roles and privileges to another.
        this._renderSecurityAnalysisPlaceholder();
        this._warnIfUserHasNoRoles(userId, fullName);
        // Automatically switch to Security Analysis sub-tab
        this._switchSubTab('security');
    }

    /**
     * Clears the Quick Check panel, so a result never outlives the user it describes.
     * Cached table-scoped answers are dropped with it.
     * @returns {void}
     * @private
     */
    _resetQuickCheck() {
        // Invalidates any run still in flight, so its result cannot land in the cleared panel.
        this._quickCheckToken++;
        QuickCheckService.clearCache();
        if (this.ui.quickCheckPanel) {
            this.ui.quickCheckPanel.textContent = '';
        }
    }

    /**
     * Runs a Quick Check for the page currently open and renders it.
     *
     * On demand rather than on a timer: the result is a snapshot of one page, and its heading names
     * the page it was taken on, so a stale panel is self-evident rather than misleading.
     * @returns {Promise<void>}
     * @private
     * @async
     */
    async _runQuickCheck() {
        const info = DataService.getImpersonationInfo();
        if (!info.isImpersonating || this._quickCheckInFlight) {
            return;
        }

        const token = ++this._quickCheckToken;
        this._quickCheckInFlight = true;
        this.ui.quickCheckBtn.disabled = true;
        this.ui.quickCheckPanel.innerHTML = `<p class="pdt-note">${Config.MESSAGES.QUICK_CHECK.running}</p>`;

        try {
            const pageContext = await this._readPageContext();
            if (!pageContext) {
                this.ui.quickCheckPanel.innerHTML = `<p class="pdt-note">${Config.MESSAGES.QUICK_CHECK.needsPage}</p>`;
                return;
            }

            const result = await QuickCheckService.buildCheck(info.userId, pageContext);
            if (token === this._quickCheckToken) {
                this._renderQuickCheck(result, info.userName);
            }
        } catch (error) {
            console.error('[ImpersonateTab] Quick Check failed:', error);
            if (token === this._quickCheckToken) {
                this.ui.quickCheckPanel.innerHTML = `<div class="pdt-error">${escapeHtml(Config.MESSAGES.QUICK_CHECK.failed(error.message))}</div>`;
            }
        } finally {
            this._quickCheckInFlight = false;
            this.ui.quickCheckBtn.disabled = !DataService.getImpersonationInfo().isImpersonating;
        }
    }

    /**
     * Describes the page currently open, on a record form or a table list.
     * @returns {Promise<{entityLogicalName: string, entitySetName: string, recordId: string|null, formId: string|null}|null>}
     *   Null when the page is not a table form or list
     * @private
     * @async
     */
    async _readPageContext() {
        // Reuses the same resolver the command-bar comparison uses, so a list page resolves its
        // table from the URL when there is no form context.
        const entityLogicalName = CommandBarAnalysisService.getCurrentEntity();
        if (!entityLogicalName) {
            return null;
        }

        const onForm = PowerAppsApiService.isFormContextAvailable;
        return {
            entityLogicalName,
            entitySetName: await DataService.getEntitySetName(entityLogicalName),
            recordId: onForm ? PowerAppsApiService.getEntityId() : null,
            formId: onForm ? PowerAppsApiService.getFormId() : null
        };
    }

    /**
     * Renders the Quick Check result as a short list of one-line facts.
     * @param {Object|null} result - The result model
     * @param {string} userName - The impersonated user's display name
     * @returns {void}
     * @private
     */
    _renderQuickCheck(result, userName) {
        if (!this.ui.quickCheckPanel) {
            return;
        }
        if (!result) {
            this.ui.quickCheckPanel.innerHTML = `<p class="pdt-note">${Config.MESSAGES.QUICK_CHECK.needsPage}</p>`;
            return;
        }

        const messages = Config.MESSAGES.QUICK_CHECK;
        const facts = [
            ...this._quickCheckPrivilegeFacts(result, userName, messages),
            this._quickCheckFormFact(result, userName, messages),
            this._quickCheckRecordFact(result, userName, messages),
            this._quickCheckColumnFact(result, messages),
            this._quickCheckAppFact(result, messages),
            this._quickCheckViewFact(result, messages)
        ].filter(Boolean);

        // The heading names the page this snapshot was taken on, so a result left on screen after
        // navigating reads as stale rather than as the answer for where you now are. Keyed on the
        // form section, not on the record: an unsaved record still has no id, and calling that a
        // list would mislabel every create form.
        const heading = result.form?.notApplicable
            ? messages.headingList(result.entityLogicalName)
            : messages.headingForm(result.entityLogicalName);

        this.ui.quickCheckPanel.innerHTML = `
            <p class="pdt-quick-check-heading">${escapeHtml(heading)}</p>
            ${facts.map(fact => `<p class="pdt-note">${escapeHtml(fact)}</p>`).join('')}`;
    }

    /**
     * Summarises the user's table privileges — what they can do, what they cannot, and the
     * read-only case called out on its own because it is the one people look for.
     * @param {Object} result - The result model
     * @param {string} userName - The impersonated user's display name
     * @param {Object} messages - QUICK_CHECK messages
     * @returns {string[]} Zero to three facts
     * @private
     */
    _quickCheckPrivilegeFacts(result, userName, messages) {
        const privileges = result.privileges;
        if (privileges?.unavailable) {
            return [messages.sectionUnavailable('Table privileges')];
        }

        const allowed = [];
        const denied = [];
        for (const [verb, label] of Object.entries(messages.verbs)) {
            (privileges?.[verb]?.hasPrivilege ? allowed : denied).push(label);
        }

        if (allowed.length === 0) {
            return [messages.privilegesNone(userName)];
        }

        const facts = [messages.privilegesAllowed(allowed.join(', '))];
        if (denied.length > 0) {
            facts.push(messages.privilegesDenied(denied.join(', ')));
        }
        if (!privileges?.write?.hasPrivilege) {
            facts.push(messages.tableReadOnly(userName));
        }
        return facts;
    }

    /**
     * One-line summary of which form the user would get.
     * @param {Object} result - The result model
     * @param {string} userName - The impersonated user's display name
     * @param {Object} messages - QUICK_CHECK messages
     * @returns {string} A single fact, or empty when not on a form
     * @private
     */
    _quickCheckFormFact(result, userName, messages) {
        if (result.form?.notApplicable) {
            return '';
        }
        if (result.form?.unavailable) {
            return messages.sectionUnavailable('Forms');
        }
        if (result.form?.matchesCurrent) {
            return messages.formSame;
        }
        const names = (result.form?.availableForms || []).map(f => f.name);
        if (names.length === 0) {
            return messages.formNone(userName);
        }
        const shown = names.slice(0, MAX_NAMED_FORMS).join(', ');
        const remaining = names.length - MAX_NAMED_FORMS;
        return messages.formDiffers(userName, remaining > 0 ? messages.formsAndMore(shown, remaining) : shown);
    }

    /**
     * One-line summary of access to the record on screen.
     * @param {Object} result - The result model
     * @param {string} userName - The impersonated user's display name
     * @param {Object} messages - QUICK_CHECK messages
     * @returns {string} A single fact
     * @private
     */
    _quickCheckRecordFact(result, userName, messages) {
        if (result.record?.unavailable) {
            return messages.sectionUnavailable('Record access');
        }
        if (!result.record?.checked) {
            return messages.recordNotChecked;
        }
        if (!result.record.canRead) {
            return messages.recordNoRead(userName);
        }
        return result.record.canWrite ? messages.recordFull : messages.recordNoWrite(userName);
    }

    /**
     * One-line summary of field security restrictions, naming the columns.
     * @param {Object} result - The result model
     * @param {Object} messages - QUICK_CHECK messages
     * @returns {string} A single fact
     * @private
     */
    _quickCheckColumnFact(result, messages) {
        if (result.securedColumns?.unavailable) {
            return messages.sectionUnavailable('Field security');
        }
        const names = [...(result.securedColumns?.columns?.keys() || [])];
        return names.length
            ? messages.columnsRestricted(names.length, names.join(', '))
            : messages.columnsNone;
    }

    /**
     * One-line summary of app visibility.
     * @param {Object} result - The result model
     * @param {Object} messages - QUICK_CHECK messages
     * @returns {string} A single fact
     * @private
     */
    _quickCheckAppFact(result, messages) {
        if (result.apps?.unavailable) {
            return messages.sectionUnavailable('Apps');
        }
        const { visible = [], hidden = [], undetermined = [] } = result.apps || {};
        const total = visible.length + hidden.length + undetermined.length;
        if (!total) {
            return '';
        }

        // An app with no display name would otherwise throw on localeCompare and take the whole
        // panel down over a cosmetic detail. The count always comes from the apps themselves, never
        // from the names, so a missing label can never turn into "no access".
        const names = visible
            .map(app => String(app?.name || app?.uniquename || '').trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
        const shown = names.slice(0, MAX_NAMED_APPS).join(', ');
        const remaining = names.length - MAX_NAMED_APPS;

        let summary;
        if (visible.length === 0) {
            summary = messages.appsNoneVisible(total);
        } else if (names.length === 0) {
            summary = messages.appsVisibleUnnamed(visible.length, total);
        } else {
            summary = messages.appsVisible(
                visible.length,
                total,
                remaining > 0 ? messages.appsAndMore(shown, remaining) : shown
            );
        }

        return undetermined.length
            ? `${summary} ${messages.appsUndetermined(undetermined.length)}`
            : summary;
    }

    /**
     * One-line summary of role-scoped view visibility.
     * @param {Object} result - The result model
     * @param {Object} messages - QUICK_CHECK messages
     * @returns {string} A single fact
     * @private
     */
    _quickCheckViewFact(result, messages) {
        if (result.views?.unavailable) {
            return messages.sectionUnavailable('Views');
        }
        if (!result.views?.restricted?.length) {
            return messages.viewsAllVisible;
        }
        return messages.viewsHidden(result.views.hidden.length);
    }

    /**
     * Warns when the newly impersonated user holds no security role at all.
     *
     * Such a user cannot read even their own systemuser record, so every request the tool makes on
     * their behalf comes back 403 — including from other tabs. Naming the cause up front beats
     * leaving the developer to decode `prvReadUser` errors later.
     * @param {string} userId - The impersonated user's ID
     * @param {string} userName - The impersonated user's display name
     * @returns {Promise<void>}
     * @private
     * @async
     */
    async _warnIfUserHasNoRoles(userId, userName) {
        try {
            if (!await SecurityAnalysisService.hasAnySecurityRole(userId)) {
                NotificationService.show(Config.MESSAGES.IMPERSONATE.userHasNoRoles(userName), 'warn');
            }
        } catch {
            // Only a courtesy warning; a failed check must not disturb the selection itself.
        }
    }

    /**
     * Builds the OData `$filter` for a user search.
     * A bare GUID targets the user's id or their Entra object id; anything else is matched as a
     * substring against every column in {@link USER_SEARCH_COLUMNS}.
     * @param {string} searchTerm - The trimmed search input, possibly empty
     * @returns {string} The filter clause
     * @private
     */
    _buildUserSearchFilter(searchTerm) {
        // Application users have no Entra object id and cannot be impersonated interactively.
        const base = 'isdisabled eq false and azureactivedirectoryobjectid ne null';
        if (!searchTerm) {
            return base;
        }

        if (GUID_PATTERN.test(searchTerm)) {
            return `${base} and (systemuserid eq ${searchTerm} or azureactivedirectoryobjectid eq ${searchTerm})`;
        }

        const term = escapeODataString(searchTerm);
        const matches = USER_SEARCH_COLUMNS.map(column => `contains(${column},'${term}')`).join(' or ');
        return `${base} and (${matches})`;
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
            <tr class="copyable-cell" data-user-id="${escapeHtml(user.systemuserid)}" data-full-name="${escapeHtml(user.fullname)}" tabindex="0" title="${Config.MESSAGES.IMPERSONATE.impersonateRowTitle}">
                <td>${escapeHtml(user.fullname)}</td>
                <td class="code-like">${escapeHtml(user.domainname || '')}</td>
            </tr>
        `).join('');

        const headers = [
            { key: 'fullname', label: Config.MESSAGES.IMPERSONATE.columnFullName },
            { key: 'domainname', label: Config.MESSAGES.IMPERSONATE.columnUserName }
        ];
        const headerHtml = generateSortableTableHeaders(headers, this.sortState);

        // The query is capped, so a full page means there are probably more matches behind it.
        const truncatedNote = this.lastSearchResults.length >= USER_SEARCH_LIMIT
            ? `<p class="pdt-note">${Config.MESSAGES.IMPERSONATE.searchTruncated(USER_SEARCH_LIMIT)}</p>`
            : '';

        this.ui.resultsContainer.innerHTML = `
            ${truncatedNote}
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
                ? Config.MESSAGES.IMPERSONATE.analyzeEnabledTitle
                : Config.MESSAGES.IMPERSONATE.selectUserToAnalyze;
        }
        if (this.ui.compareCommandsBtn) {
            this.ui.compareCommandsBtn.disabled = !enabled;
            this.ui.compareCommandsBtn.title = enabled
                ? Config.MESSAGES.IMPERSONATE.commandBarComparisonTitle
                : Config.MESSAGES.IMPERSONATE.selectUserShort;
        }
        // Show/hide comparison user selector
        if (this.ui.compareUserSelector) {
            this.ui.compareUserSelector.style.display = enabled ? 'flex' : 'none';
        }
        if (this.ui.quickCheckBtn) {
            // Works on a record form and on a table list; only a page with no table at all is out
            // of scope, and _runQuickCheck says so rather than the button being dead. A check
            // already running keeps the button down — finishing an analysis must not re-arm it.
            this.ui.quickCheckBtn.disabled = !enabled || this._quickCheckInFlight;
            this.ui.quickCheckBtn.title = enabled
                ? Config.MESSAGES.QUICK_CHECK.buttonTitle
                : Config.MESSAGES.IMPERSONATE.selectUserShort;
        }
        if (!enabled) {
            this._resetQuickCheck();
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
            case 'quick-check-btn':
                this._runQuickCheck();
                break;
            case 'analyze-security-btn':
                this._performSecurityAnalysis();
                break;
            case 'compare-commands-btn':
                this._performCommandBarAnalysis();
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
            NotificationService.show(Config.MESSAGES.IMPERSONATE.comparingWithCurrentUser, 'info');
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
            // The picker filters client-side, so it loads a page up front rather than re-querying.
            const options = `?$select=fullname,systemuserid,domainname&$filter=${this._buildUserSearchFilter('')}&$orderby=fullname&$top=${PICKER_USER_LIMIT}`;

            // As-self for the same reason as the main search: picking who to compare against must
            // not depend on the impersonated user's privileges.
            const result = await DataService.retrieveMultipleRecordsAsSelf('systemuser', options);
            const users = result.entities;

            if (!users || users.length === 0) {
                NotificationService.show(Config.MESSAGES.IMPERSONATE.noUsersAvailable, 'warn');
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
                        <button class="pdt-dialog-close" aria-label="${Config.MESSAGES.IMPERSONATE.closeLabel}">×</button>
                    </div>
                    <div class="pdt-dialog-body">
                        <input type="text" id="comparison-user-search" class="pdt-input" placeholder="${Config.MESSAGES.IMPERSONATE.pickerSearchPlaceholder}" />
                        ${users.length >= PICKER_USER_LIMIT ? `<p class="pdt-note">${Config.MESSAGES.IMPERSONATE.searchTruncated(PICKER_USER_LIMIT)}</p>` : ''}
                        <div id="comparison-user-list" class="pdt-user-list" style="max-height: 400px; overflow-y: auto; margin-top: 10px;">
                            ${users.map(u => `
                                <div class="pdt-user-item" data-user-id="${escapeHtml(u.systemuserid)}" data-user-name="${escapeHtml(u.fullname)}" data-user-email="${escapeHtml(u.domainname || '')}">
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
                const query = e.target.value.trim().toLowerCase();
                userItems.forEach(item => {
                    const haystack = `${item.dataset.userName} ${item.dataset.userEmail}`.toLowerCase();
                    item.style.display = haystack.includes(query) ? 'block' : 'none';
                });
            });

            // Handle user selection
            let escapeHandler = null;
            const selected = await new Promise((resolve) => {
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

                escapeHandler = (e) => {
                    if (e.key === 'Escape') {
                        resolve(null);
                    }
                };
                document.addEventListener('keydown', escapeHandler);

                // Closing the tab while the picker is open must settle the promise, or the dialog
                // stays on screen forever with nothing left to dismiss it.
                this._closeComparisonUserPicker = () => resolve(null);
            });

            document.removeEventListener('keydown', escapeHandler);
            this._closeComparisonUserPicker = null;
            dialog.remove();

            if (selected) {
                this.comparisonUser = selected;
                NotificationService.show(Config.MESSAGES.IMPERSONATE.comparisonUserSelected(selected.userName), 'success');
            } else {
                // User cancelled, reset to current user
                this.ui.compareUserSelect.value = 'current';
                this.comparisonUser = null;
            }

        } catch (error) {
            NotificationService.show(Config.MESSAGES.IMPERSONATE.loadUsersFailed(error.message), 'error');
            this.ui.compareUserSelect.value = 'current';
            this.comparisonUser = null;
        }
    }

    /**
     * Performs a security analysis comparing the current user with the impersonated user.
     * @async
     * @private
     */
    async _performSecurityAnalysis() {
        const info = DataService.getImpersonationInfo();
        if (!info.isImpersonating || this._analysisInFlight) {
            return;
        }

        const analyzeBtn = this.ui.analyzeBtn;
        const originalText = analyzeBtn.textContent;
        const token = this._beginAnalysis();

        try {
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
            const comparisonUserName = this._comparisonUserLabel();

            // Perform security comparison
            this.securityAnalysis = await SecurityAnalysisService.compareUserSecurity(
                targetUserId,
                entityLogicalName,
                comparisonUserId
            );

            if (this._isCurrentAnalysis(token)) {
                this._renderSecurityAnalysis(targetUserName, comparisonUserName, entityLogicalName, !this.comparisonUser);
            }

        } catch (error) {
            console.error('[ImpersonateTab] Security analysis failed:', error);
            if (this._isCurrentAnalysis(token)) {
                this.ui.securityAnalysisContent.innerHTML = `
                    <div class="pdt-error">${Config.MESSAGES.IMPERSONATE.analyzeFailed(escapeHtml(error.message))}</div>`;
            }
        } finally {
            analyzeBtn.textContent = originalText;
            this._endAnalysis(token);
        }
    }

    /**
     * Claims the shared analysis slot.
     *
     * Analyze Security and Compare Commands both render into the same panel and each fires dozens of
     * requests, so they must not overlap: a slow one finishing last would overwrite the newer result.
     * @returns {number} The token identifying this run
     * @private
     */
    _beginAnalysis() {
        this._analysisInFlight = true;
        this.ui.analyzeBtn.disabled = true;
        this.ui.compareCommandsBtn.disabled = true;
        return ++this._analysisToken;
    }

    /**
     * Whether the given run is still the one whose output belongs on screen.
     * @param {number} token - Token from {@link _beginAnalysis}
     * @returns {boolean} True when this run's result is still current
     * @private
     */
    _isCurrentAnalysis(token) {
        return token === this._analysisToken;
    }

    /**
     * Releases the analysis slot, restoring the buttons to what impersonation state allows.
     * @param {number} token - Token from {@link _beginAnalysis}
     * @returns {void}
     * @private
     */
    _endAnalysis(token) {
        if (!this._isCurrentAnalysis(token)) {
            return;
        }
        this._analysisInFlight = false;
        // Impersonation may have been cleared while the analysis ran; re-enabling unconditionally
        // would offer buttons that have nothing to analyse.
        this._enableSecurityAnalysis(DataService.getImpersonationInfo().isImpersonating);
    }

    /**
     * The display name of whoever the impersonated user is being compared against.
     * @returns {string} The chosen user's name, or the label for the signed-in user
     * @private
     */
    _comparisonUserLabel() {
        return this.comparisonUser ? this.comparisonUser.userName : Config.MESSAGES.IMPERSONATE.youLabel;
    }

    /**
     * Renders the complete security analysis results.
     * @param {string} targetUserName - The target user's name (impersonated user)
     * @param {string} comparisonUserName - The comparison user's display name
     * @param {string|null} entityLogicalName - The current entity (if on a form)
     * @param {boolean} [isSelf=false] - True when comparing against the signed-in user. Passed
     *   explicitly rather than inferred from the name, which broke for a user actually called "You".
     * @private
     */
    _renderSecurityAnalysis(targetUserName, comparisonUserName, entityLogicalName, isSelf = false) {
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
        } else {
            // Without a form there is no table to report on. Say so, rather than leave a section
            // silently missing.
            content.push(`
                <div class="pdt-security-card">
                    <h4 class="pdt-section-header">${Config.MESSAGES.IMPERSONATE.entityPrivilegesTitle}</h4>
                    <p class="pdt-note">${Config.MESSAGES.IMPERSONATE.noEntityContext}</p>
                </div>`);
        }

        // Field Security Section
        content.push(this._renderFieldSecurity(
            targetUserName, comparisonUserName,
            analysis.targetUserFieldProfiles, analysis.comparisonUserFieldProfiles,
            isSelf
        ));

        // Team Membership Comparison Section
        content.push(this._renderTeamComparison(targetUserName, comparisonUserName, analysis, isSelf));

        // Role Comparison Section
        content.push(this._renderRoleComparison(targetUserName, comparisonUserName, analysis, isSelf));

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
    _renderTeamComparison(targetUserName, comparisonUserName, analysis, isSelf = false) {
        // Display names come from the systemuser table and can contain markup.
        const target = escapeHtml(targetUserName);
        const comparison = escapeHtml(comparisonUserName);

        const renderTeamList = (teams, emptyMessage) => {
            if (!teams || teams.length === 0) {
                return `<p class="pdt-note pdt-note--small">${emptyMessage}</p>`;
            }
            return `<ul class="pdt-list">
                ${teams.map(t => `
                    <li class="pdt-list-item">
                        <div class="pdt-item-content">
                            <span class="pdt-item-name">${escapeHtml(t.name)}</span>
                            <code class="pdt-copyable-id" title="${Config.MESSAGES.IMPERSONATE.copyIdTitle}">${escapeHtml(t.teamid)}</code>
                        </div>
                        <span class="pdt-badge-small">${escapeHtml(t.teamtype || Config.MESSAGES.IMPERSONATE.teamBadge)}</span>
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
                            ${isSelf ? Config.MESSAGES.IMPERSONATE.teamMembershipsOnlyYou : Config.MESSAGES.IMPERSONATE.teamMembershipsOnlyUser(comparison)} (${teamsOnlyYou.length})
                        </h5>
                        ${renderTeamList(teamsOnlyYou, Config.MESSAGES.IMPERSONATE.noUniqueTeams)}
                    </div>
                    <div class="pdt-role-section">
                        <h5 class="pdt-role-section-header pdt-role-section-header--user">
                            ${Config.MESSAGES.IMPERSONATE.teamMembershipsOnlyUser(target)} (${teamsOnlyUser.length})
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
    _renderRoleComparison(targetUserName, comparisonUserName, analysis, isSelf = false) {
        // Display names come from the systemuser table and can contain markup.
        const target = escapeHtml(targetUserName);
        const comparison = escapeHtml(comparisonUserName);

        const renderRoleList = (roles, emptyMessage) => {
            if (!roles || roles.length === 0) {
                return `<p class="pdt-note pdt-note--small">${emptyMessage}</p>`;
            }
            return `<ul class="pdt-list">
                ${roles.map(r => {
                let badgeHtml = `<span class="pdt-badge-small">${Config.MESSAGES.IMPERSONATE.roleDirect}</span>`;

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
                            <code class="pdt-copyable-id" title="${Config.MESSAGES.IMPERSONATE.copyIdTitle}">${escapeHtml(r.roleid)}</code>
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
                            ${isSelf ? Config.MESSAGES.IMPERSONATE.yourOnlyRoles : Config.MESSAGES.IMPERSONATE.rolesOnlyUser(comparison)} (${analysis.currentUserOnlyRoles.length})
                        </h5>
                        ${renderRoleList(analysis.currentUserOnlyRoles, Config.MESSAGES.IMPERSONATE.noRolesFound)}
                    </div>
                    <div class="pdt-role-section">
                        <h5 class="pdt-role-section-header pdt-role-section-header--user">
                            ${Config.MESSAGES.IMPERSONATE.rolesOnlyUser(target)} (${analysis.targetUserOnlyRoles.length})
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
            shortText = Config.MESSAGES.IMPERSONATE.depthOrganization;
        } else if (depthLower.includes('deep') || depthLower.includes('parent')) {
            icon = '👥';
            colorClass = 'pdt-depth-deep';
            shortText = Config.MESSAGES.IMPERSONATE.depthDeep;
        } else if (depthLower.includes('local') || depthLower.includes('bu')) {
            icon = '🏢';
            colorClass = 'pdt-depth-local';
            shortText = Config.MESSAGES.IMPERSONATE.depthBusinessUnit;
        } else if (depthLower.includes('basic') || depthLower.includes('user')) {
            icon = '👤';
            colorClass = 'pdt-depth-basic';
            shortText = Config.MESSAGES.IMPERSONATE.depthUser;
        } else {
            return `<span class="pdt-depth-badge pdt-depth-none">${escapeHtml(depth)}</span>`;
        }

        return `<span class="pdt-depth-badge ${colorClass}" title="${escapeHtml(depth)}">${icon} ${shortText}</span>`;
    }

    /**
     * Renders the roles that grant a specific privilege.
     * @param {Array<string>} roles - Array of role names that grant this privilege
     * @returns {string} HTML string showing roles or empty string if no roles
     * @private
     */
    _renderPrivilegeRoles(roles) {
        if (!roles || roles.length === 0) {
            return '';
        }

        const MAX_VISIBLE_ROLES = 3;
        const visibleRoles = roles.slice(0, MAX_VISIBLE_ROLES);
        const remainingCount = roles.length - MAX_VISIBLE_ROLES;

        let rolesHtml = visibleRoles
            .map(role => `<span class="pdt-priv-role" title="${escapeHtml(role)}">${escapeHtml(role)}</span>`)
            .join('');

        if (remainingCount > 0) {
            const remainingRoles = roles.slice(MAX_VISIBLE_ROLES).join('\n');
            rolesHtml += `<span class="pdt-priv-role pdt-priv-role--more" title="${escapeHtml(remainingRoles)}">${Config.MESSAGES.IMPERSONATE.privilegeMultipleRoles(remainingCount)}</span>`;
        }

        return `<div class="pdt-priv-roles">${rolesHtml}</div>`;
    }

    /**
     * Renders a single privilege cell for the table.
     * @param {Object|boolean} privData - Privilege data object or boolean
     * @param {boolean} hasPriv - Whether the user has this privilege
     * @param {boolean} [unknown=false] - True when the lookup failed, so neither ✓ nor ✗ is true
     * @returns {string} HTML string for the cell
     * @private
     */
    _renderPrivilegeCell(privData, hasPriv, unknown = false) {
        if (unknown) {
            return `
                <td class="pdt-priv-cell pdt-priv-cell--unknown">
                    <span class="pdt-priv-indicator pdt-priv-indicator--unknown">?</span>
                    <span class="pdt-priv-label">${Config.MESSAGES.IMPERSONATE.privilegeUnknown}</span>
                </td>`;
        }

        if (!hasPriv) {
            return `
                <td class="pdt-priv-cell pdt-priv-cell--denied">
                    <span class="pdt-priv-indicator pdt-priv-indicator--denied">✗</span>
                    <span class="pdt-priv-label">${Config.MESSAGES.IMPERSONATE.privilegeNoAccess}</span>
                </td>`;
        }

        const depth = typeof privData === 'object' ? privData?.depth : null;
        const roles = typeof privData === 'object' ? (privData?.roles || []) : [];
        const depthBadge = this._getDepthBadgeHtml(depth);
        const rolesHtml = this._renderPrivilegeRoles(roles);

        return `
            <td class="pdt-priv-cell pdt-priv-cell--allowed">
                <div class="pdt-priv-cell-content">
                    <div class="pdt-priv-main">
                        <span class="pdt-priv-indicator pdt-priv-indicator--allowed">✓</span>
                        ${depthBadge}
                    </div>
                    ${rolesHtml}
                </div>
            </td>`;
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


        const targetUnknown = !!targetPrivileges?.unavailable;
        const comparisonUnknown = !!comparisonPrivileges?.unavailable;

        const privilegeRows = privilegeItems.map(item => {
            // Get privileges for both users
            const targetPrivData = targetPrivileges[item.key];
            const targetHasPriv = typeof targetPrivData === 'object' ? targetPrivData?.hasPrivilege : targetPrivData;

            const comparisonPrivData = comparisonPrivileges?.[item.key];
            const comparisonHasPriv = typeof comparisonPrivData === 'object' ? comparisonPrivData?.hasPrivilege : comparisonPrivData;

            // Determine row class based on comparison. An unknown side can't be compared, so leave
            // the row unstyled rather than claim a difference we didn't measure.
            let rowClass = '';
            if (targetUnknown || comparisonUnknown) {
                rowClass = '';
            } else if (targetHasPriv !== comparisonHasPriv) {
                rowClass = 'pdt-priv-row--different';
            } else if (targetHasPriv && comparisonHasPriv) {
                rowClass = 'pdt-priv-row--both-have';
            } else {
                rowClass = 'pdt-priv-row--both-lack';
            }

            return `
                <tr class="pdt-priv-row ${rowClass}">
                    <td class="pdt-priv-name">${item.label}</td>
                    ${this._renderPrivilegeCell(targetPrivData, targetHasPriv, targetUnknown)}
                    ${this._renderPrivilegeCell(comparisonPrivData, comparisonHasPriv, comparisonUnknown)}
                </tr>`;
        }).join('');

        // A failed lookup is not a denial. Say which side is unknown so nobody reads an outage as
        // a permission problem.
        const unavailableFor = [
            targetPrivileges?.unavailable ? targetUserName : null,
            comparisonPrivileges?.unavailable ? comparisonUserName : null
        ].filter(Boolean);
        const unavailableNote = unavailableFor.length
            ? `<p class="pdt-note">${escapeHtml(Config.MESSAGES.IMPERSONATE.privilegesUnavailable(unavailableFor.join(' and ')))}</p>`
            : '';

        return `
            <div class="pdt-security-card">
                <h4 class="pdt-section-header">
                    ${Config.MESSAGES.IMPERSONATE.entityPrivilegesTitle}:
                    <code>${escapeHtml(entityLogicalName)}</code>
                </h4>
                ${unavailableNote}
                <div class="pdt-priv-table-wrapper">
                    <table class="pdt-priv-table">
                        <thead>
                            <tr>
                                <th class="pdt-priv-header-name">${Config.MESSAGES.IMPERSONATE.privilegeColumnHeader}</th>
                                <th class="pdt-priv-header-user">
                                    <span class="pdt-priv-user-icon">👤</span>
                                    ${escapeHtml(targetUserName)}
                                </th>
                                <th class="pdt-priv-header-user">
                                    <span class="pdt-priv-user-icon">👤</span>
                                    ${escapeHtml(comparisonUserName)}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            ${privilegeRows}
                        </tbody>
                    </table>
                </div>
            </div>`;
    }

    /**
     * Renders one user's field security profiles, including per-column permissions when the
     * analysis was scoped to a table.
     * @param {Array} profiles - The user's field security profiles
     * @returns {string} HTML string for the profile list
     * @private
     */
    _renderFieldProfileList(profiles) {
        return profiles.map(p => {
            const inheritedBadge = p.isInherited
                ? `<span class="pdt-badge-small pdt-badge--inherited" title="${Config.MESSAGES.IMPERSONATE.inheritedFromTeamTitle}">${Config.MESSAGES.IMPERSONATE.teamBadge}</span>`
                : '';
            const columnBadge = p.permissions?.length > 0
                ? `<span class="pdt-badge-small">${Config.MESSAGES.IMPERSONATE.columnCount(p.permissions.length)}</span>`
                : '';

            let columnsHtml = '';
            if (p.permissions && p.permissions.length > 0) {
                const permissionRows = p.permissions.map(perm => `
                    <tr>
                        <td>${escapeHtml(perm.attributelogicalname)}</td>
                        ${this._renderFieldPermissionCell(perm.canread)}
                        ${this._renderFieldPermissionCell(perm.cancreate)}
                        ${this._renderFieldPermissionCell(perm.canupdate)}
                    </tr>`).join('');

                columnsHtml = `
                    <div class="pdt-field-permissions-table">
                        <table class="pdt-table">
                            <thead>
                                <tr>
                                    <th>${Config.MESSAGES.IMPERSONATE.columnName}</th>
                                    <th>${Config.MESSAGES.IMPERSONATE.canRead}</th>
                                    <th>${Config.MESSAGES.IMPERSONATE.canCreate}</th>
                                    <th>${Config.MESSAGES.IMPERSONATE.canUpdate}</th>
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
    }

    /**
     * Renders one allowed/denied cell of a field permission row.
     * @param {number} value - The permission value; 4 means allowed
     * @returns {string} HTML string for the cell
     * @private
     */
    _renderFieldPermissionCell(value) {
        const allowed = value === 4;
        return `<td class="pdt-permission-cell ${allowed ? 'pdt-permission-yes' : 'pdt-permission-no'}">${allowed ? '✓' : '✗'}</td>`;
    }

    /**
     * Renders the field security section with comparison.
     * @param {string} targetUserName - The target user's name
     * @param {string} comparisonUserName - The comparison user's display name
     * @param {Array} targetFieldProfiles - The target user's field security profiles
     * @param {Array} comparisonFieldProfiles - The comparison user's field security profiles
     * @param {boolean} [isSelf=false] - True when comparing against the signed-in user
     * @returns {string} HTML string
     * @private
     */
    _renderFieldSecurity(targetUserName, comparisonUserName, targetFieldProfiles, comparisonFieldProfiles, isSelf = false) {
        const hasTargetProfiles = targetFieldProfiles && targetFieldProfiles.length > 0;
        const hasComparisonProfiles = comparisonFieldProfiles && comparisonFieldProfiles.length > 0;

        if (!hasTargetProfiles && !hasComparisonProfiles) {
            return `
                <div class="pdt-security-card">
                    <h4 class="pdt-section-header">${Config.MESSAGES.IMPERSONATE.fieldSecurityTitle}</h4>
                    <p class="pdt-note">${Config.MESSAGES.IMPERSONATE.noFieldSecurityProfiles}</p>
                </div>`;
        }

        const section = (heading, profiles) => `
            <div class="pdt-field-user-section">
                <h5 class="pdt-subsection-header">${heading}</h5>
                <ul class="pdt-profile-list">${this._renderFieldProfileList(profiles)}</ul>
            </div>`;

        const targetSection = hasTargetProfiles
            ? section(Config.MESSAGES.IMPERSONATE.userFieldProfiles(escapeHtml(targetUserName)), targetFieldProfiles)
            : '';

        const comparisonHeading = isSelf
            ? Config.MESSAGES.IMPERSONATE.yourFieldProfiles
            : Config.MESSAGES.IMPERSONATE.userFieldProfiles(escapeHtml(comparisonUserName));
        const comparisonSection = hasComparisonProfiles
            ? section(comparisonHeading, comparisonFieldProfiles)
            : '';

        return `
            <div class="pdt-security-card">
                <h4 class="pdt-section-header">${Config.MESSAGES.IMPERSONATE.fieldSecurityTitle}</h4>
                <div class="pdt-field-security-comparison">${targetSection}${comparisonSection}</div>
            </div>`;
    }

    /**
     * Performs command bar visibility analysis comparing current user with impersonated user.
     * @async
     * @private
     */
    async _performCommandBarAnalysis() {
        const info = DataService.getImpersonationInfo();
        if (!info.isImpersonating || this._analysisInFlight) {
            return;
        }

        const compareBtn = this.ui.compareCommandsBtn;
        const originalText = compareBtn.textContent;
        const token = this._beginAnalysis();

        try {
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
            const comparisonUserName = this._comparisonUserLabel();

            // Perform command visibility comparison
            const comparison = await CommandBarAnalysisService.compareCommandBarVisibility(
                targetUserId,
                entityLogicalName,
                context,
                comparisonUserId
            );

            // Render results with appropriate labels
            if (this._isCurrentAnalysis(token)) {
                this._renderCommandBarComparison(comparison, targetUserName, comparisonUserName, entityLogicalName, context, !this.comparisonUser);
            }

        } catch (error) {
            console.error('[ImpersonateTab] Command bar analysis failed:', error);
            if (this._isCurrentAnalysis(token)) {
                this.ui.securityAnalysisContent.innerHTML = `
                    <div class="pdt-error">${Config.MESSAGES.IMPERSONATE.commandComparisonFailed(escapeHtml(error.message))}</div>`;
            }
        } finally {
            compareBtn.textContent = originalText;
            this._endAnalysis(token);
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
    _renderCommandBarComparison(comparison, targetUserName, comparisonUserName, entityLogicalName, context, isSelf = false) {
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
        const undetermined = commands.filter(c => c.difference === 'undetermined');
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
                        ${definiteDifferences.map(cmd => this._renderCommandItem(cmd, targetUserName, comparisonUserName, false, isSelf)).join('')}
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
                        ${potentialDifferences.map(cmd => this._renderCommandItem(cmd, targetUserName, comparisonUserName, true, isSelf)).join('')}
                    </div>
                </details>`;
        }

        // Commands gated by a rule neither user's session could evaluate
        if (undetermined.length > 0) {
            content += `
                <details class="pdt-command-undetermined mt-15">
                    <summary class="pdt-details-summary">
                        ${Config.MESSAGES.IMPERSONATE.undeterminedCommandsTitle(undetermined.length)}
                    </summary>
                    <p class="pdt-note pdt-note--small mt-5">
                        ${Config.MESSAGES.IMPERSONATE.undeterminedCommandsNote}
                    </p>
                    <div class="pdt-command-list">
                        ${undetermined.map(cmd => this._renderCommandItem(cmd, targetUserName, comparisonUserName, true, isSelf)).join('')}
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
                        ${sameCommands.map(cmd => this._renderCommandItem(cmd, targetUserName, comparisonUserName, true, isSelf)).join('')}
                    </div>
                </details>`;
        }

        content += '</div>';
        this.ui.securityAnalysisContent.innerHTML = content;
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
    _renderCommandItem(cmd, targetUserName, comparisonUserName, hideBlockedBy = false, isSelf = false) {
        // Display names come from the systemuser table and can contain markup.
        const target = escapeHtml(targetUserName);
        const comparison = escapeHtml(comparisonUserName);

        let differenceClass, differenceLabel, differenceIcon;

        if (cmd.difference === 'only-current') {
            differenceClass = 'pdt-command-item--only-you';
            differenceLabel = isSelf
                ? Config.MESSAGES.IMPERSONATE.onlyYouCanSee
                : Config.MESSAGES.IMPERSONATE.onlyUserCanSeeNamed(comparison);
            differenceIcon = '👤';
        } else if (cmd.difference === 'only-target') {
            differenceClass = 'pdt-command-item--only-user';
            differenceLabel = Config.MESSAGES.IMPERSONATE.onlyUserCanSeeNamed(target);
            differenceIcon = '👥';
        } else if (cmd.difference === 'potential-difference') {
            differenceClass = 'pdt-command-item--potential';
            differenceLabel = Config.MESSAGES.IMPERSONATE.potentialDifferenceLabel;
            differenceIcon = '⚡';
        } else if (cmd.difference === 'undetermined') {
            differenceClass = 'pdt-command-item--undetermined';
            differenceLabel = Config.MESSAGES.IMPERSONATE.undeterminedLabel;
            differenceIcon = '❔';
        } else {
            differenceClass = 'pdt-command-item--same';
            differenceLabel = Config.MESSAGES.IMPERSONATE.sameVisibilityLabel;
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
            ? Config.MESSAGES.IMPERSONATE.blockedByLabel(target)
            : (isSelf
                ? Config.MESSAGES.IMPERSONATE.blockedByLabelSelf
                : Config.MESSAGES.IMPERSONATE.blockedByLabel(comparison));

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