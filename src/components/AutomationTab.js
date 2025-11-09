/**
 * @file Form Automation component.
 * @module components/AutomationTab
 * @description This component allows users to view and manage Business Rules for any table in the environment.
 * It also displays the statically-defined Form Event Handlers if the tool is opened on a record form.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { DataService } from '../services/DataService.js';
import { Config } from '../constants/index.js';
import { escapeHtml } from '../helpers/index.js';
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
        /** @private */ this._loadToken = 0;

        // bound handlers for add/remove
        /** @private */ this._onBrowseClick = null;
        /** @private */ this._onEntityKeyup = null;
        /** @private */ this._onListClick = null;
        /** @private */ this._onResize = null;
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
                <div class="pdt-toolbar mb-15">
                    <label style="flex-shrink: 0; margin-right: 10px;">Table:</label>
                    
                    <div class="pdt-input-with-button flex-grow">
                        
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
            browseBtn: element.querySelector('#br-browse-entity-btn')
        };

        this._initialize();

        this._onBrowseClick = () => {
            MetadataBrowserDialog.show('entity', (selectedEntity) => {
                this.ui.entityInput.value = selectedEntity.LogicalName;
                this.selectedEntity = selectedEntity.LogicalName;
                this._loadAllAutomationsForEntity(this.selectedEntity);
            });
        };
        this.ui.browseBtn.addEventListener('click', this._onBrowseClick);

        this._onEntityKeyup = (e) => {
            if (e.key === 'Enter') {
                const entityName = e.target.value.trim();
                if (entityName) {
                    this.selectedEntity = entityName;
                    this._loadAllAutomationsForEntity(this.selectedEntity);
                }
            }
        };
        this.ui.entityInput.addEventListener('keyup', this._onEntityKeyup);

        this._onListClick = (e) => {
            const actionButton = e.target.closest('button[data-action]');
            const header = e.target.closest('.pdt-br-header');
            if (actionButton) {
                e.stopPropagation();
                this._handleActionClick(actionButton);
            } else if (header) {
                this._toggleRuleDetails(header);
            }
        };
        this.ui.brListContainer.addEventListener('click', this._onListClick);

        // keep expanded panels sized correctly on viewport changes
        this._onResize = () => {
            this.ui.brListContainer
                .querySelectorAll('.pdt-br-details')
                .forEach(p => {
                    if (p.style.maxHeight && p.style.maxHeight !== '0px') {
                        p.style.maxHeight = `${p.scrollHeight}px`;
                    }
                });
        };
        window.addEventListener('resize', this._onResize);
    }

    destroy() {
        try {
            if (this.ui?.browseBtn && this._onBrowseClick) {
                this.ui.browseBtn.removeEventListener('click', this._onBrowseClick);
            }
            if (this.ui?.entityInput && this._onEntityKeyup) {
                this.ui.entityInput.removeEventListener('keyup', this._onEntityKeyup);
            }
            if (this.ui?.brListContainer && this._onListClick) {
                this.ui.brListContainer.removeEventListener('click', this._onListClick);
            }
            if (this._onResize) {
                window.removeEventListener('resize', this._onResize);
            }
        } catch { /* no-op */ }
    }

    /** @private */
    _setLoadingUI(isLoading) {
        if (!this.ui) {
            return;
        }
        this.ui.entityInput.disabled = !!isLoading;
        this.ui.browseBtn.disabled = !!isLoading;
    }

    /**
     * Sets up the initial state of the tab, loading the entity list for the selector
     * and displaying data for the current context if available.
     * @private
     */
    async _initialize() {
        // Set the default message, ensuring the section is visible
        if (!this.ui.eventsContainer.querySelector('.pdt-note')) {
            this.ui.eventsContainer.querySelector('.section-title')?.insertAdjacentHTML(
                'afterend',
                '<p class="pdt-note">Select a table to view its main form event handlers.</p>'
            );
        }

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

        rules.sort((a, b) => {
            if (!!b.isActive - !!a.isActive) {
                return (!!b.isActive - !!a.isActive);
            }
            return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
        });

        if (rules.length === 0) {
            container.innerHTML = `<p class="pdt-note">${Config.MESSAGES.AUTOMATION.noRulesFound}</p>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        rules.forEach(r => {
            const itemContainer = document.createElement('div');
            itemContainer.className = 'pdt-br-item';
            itemContainer.dataset.ruleId = r.id;

            const statusBadge = `<span class="pdt-status-badge ${r.isActive ? 'active' : 'inactive'}">${r.isActive ? 'Active' : 'Inactive'}</span>`;
            const name = `<span>${escapeHtml(r.name)}</span>`;
            const id = `<span class="code-like">${escapeHtml(r.id)}</span>`;
            const description = r.description ? `<div class="pdt-list-item-description">${escapeHtml(r.description)}</div>` : '';
            const actionButtons = r.isActive
                ? `<button class="pdt-list-action-btn action-deactivate" data-action="deactivate" data-rule-id="${escapeHtml(r.id)}">Deactivate</button>`
                : `<button class="pdt-list-action-btn action-activate" data-action="activate" data-rule-id="${escapeHtml(r.id)}">Activate</button><button class="pdt-list-action-btn action-delete" data-action="delete" data-rule-id="${escapeHtml(r.id)}">Delete</button>`;

            itemContainer.innerHTML = `
                <div class="pdt-br-header" role="button" aria-expanded="false">
                    ${statusBadge}
                    <div class="pdt-list-item-content">
                    <div class="pdt-list-item-header">${name}${id}</div>
                    ${description}
                    </div>
                    <div class="pdt-list-item-actions">${actionButtons}</div>
                </div>
                <div class="pdt-br-details" aria-hidden="true"></div>`;

            fragment.appendChild(itemContainer);
        });
        container.textContent = '';
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
        if (!detailsPanel || !detailsPanel.classList.contains('pdt-br-details')) {
            return;
        }

        // Close any other open panels (single-open accordion)
        this.ui.brListContainer.querySelectorAll('.pdt-br-details').forEach(p => {
            if (p !== detailsPanel && p.style.maxHeight && p.style.maxHeight !== '0px') {
                p.style.maxHeight = '0px';
                const h = p.previousElementSibling;
                if (h?.classList.contains('pdt-br-header')) {
                    h.setAttribute('aria-expanded', 'false');
                }
                p.setAttribute('aria-hidden', 'true');
            }
        });

        if (detailsPanel.innerHTML === '') {
            const ruleId = header.closest('[data-rule-id]').dataset.ruleId;
            const rule = this.rules.find(r => r.id === ruleId);
            if (rule && rule.clientData) {
                try {
                    const xmlDoc = new DOMParser().parseFromString(rule.clientData, 'text/xml');
                    const parserError = xmlDoc.querySelector('parsererror');
                    if (parserError) {
                        throw new Error('Invalid rule XML.');
                    }
                    const clientCode = xmlDoc.querySelector('clientcode')?.textContent || 'No <clientcode> found in rule payload.';
                    let formatted = clientCode;
                    try {
                        formatted = js_beautify(clientCode, { indent_size: 2, space_in_empty_paren: true });
                    } catch { }
                    detailsPanel.appendChild(UIFactory.createCopyableCodeBlock(formatted, 'javascript'));
                } catch (err) {
                    const msg = escapeHtml(err?.message || String(err));
                    detailsPanel.innerHTML = `<p class="pdt-note">Unable to parse rule logic. ${msg}</p>`;
                }
            } else {
                detailsPanel.innerHTML = '<p class="pdt-note">This rule has no client logic payload.</p>';
            }
        }

        const isExpanded = detailsPanel.style.maxHeight && detailsPanel.style.maxHeight !== '0px';
        if (isExpanded) {
            detailsPanel.style.maxHeight = '0px';
            header.setAttribute('aria-expanded', 'false');
            detailsPanel.setAttribute('aria-hidden', 'true');
        } else {
            requestAnimationFrame(() => {
                detailsPanel.style.maxHeight = `${detailsPanel.scrollHeight}px`;
                header.setAttribute('aria-expanded', 'true');
                detailsPanel.setAttribute('aria-hidden', 'false');
            });
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
            DialogService.show(
                Config.DIALOG_TITLES.confirmDelete,
                '<p>Are you sure you want to permanently delete this business rule?</p><p class="pdt-text-error">This action cannot be undone.</p>',
                async () => {
                    const previous = button.textContent;
                    button.textContent = '...';
                    button.disabled = true;
                    try {
                        await DataService.deleteBusinessRule(ruleId);
                        NotificationService.show(Config.MESSAGES.AUTOMATION.ruleDeleted, 'success');
                        await this._refreshBusinessRules();
                    } catch (e) {
                        NotificationService.show(Config.MESSAGES.AUTOMATION.deleteFailed(e.message), 'error');
                        button.textContent = previous;
                        button.disabled = false;
                    }
                }
            );
            return;
        }

        const previous = button.textContent;
        button.textContent = '...';
        button.disabled = true;
        (async () => {
            try {
                if (action === 'activate') {
                    await DataService.setBusinessRuleState(ruleId, true);
                    NotificationService.show(Config.MESSAGES.AUTOMATION.ruleActivated, 'success');
                } else if (action === 'deactivate') {
                    await DataService.setBusinessRuleState(ruleId, false);
                    NotificationService.show(Config.MESSAGES.AUTOMATION.ruleDeactivated, 'success');
                }
                await this._refreshBusinessRules();
            } catch (e) {
                if (action === 'activate') {
                    NotificationService.show(Config.MESSAGES.AUTOMATION.activateFailed(e.message), 'error');
                } else if (action === 'deactivate') {
                    NotificationService.show(Config.MESSAGES.AUTOMATION.deactivateFailed(e.message), 'error');
                }
                button.textContent = previous;
                button.disabled = false;
            }
        })();
    }

    /**
     * Clears the cache for the current entity's rules and re-renders the list.
     * @param {boolean} [showLoading=true] - If true, displays a "Refreshing..." message.
     * @private
     */
    async _refreshBusinessRules(showLoading = true) {
        if (!this.selectedEntity) {
            return;
        }
        const myToken = ++this._loadToken;
        if (showLoading) {
            this.ui.brListContainer.innerHTML = `<p class="pdt-note">${Config.MESSAGES.AUTOMATION.refreshingRules(this.selectedEntity)}</p>`;
        }
        this._setLoadingUI(true);
        try {
            try {
                DataService.clearCache(`businessRules_${this.selectedEntity}`);
            } catch { }
            this.rules = await DataService.getBusinessRulesForEntity(this.selectedEntity);
            if (myToken !== this._loadToken) {
                return;
            }
            this._renderBusinessRules();
        } catch (e) {
            if (myToken !== this._loadToken) {
                return;
            }
            this.ui.brListContainer.innerHTML = `<div class="pdt-error">${Config.MESSAGES.AUTOMATION.refreshFailed(escapeHtml(e.message || String(e)))}</div>`;
        } finally {
            if (myToken === this._loadToken) {
                this._setLoadingUI(false);
            }
        }
    }

    /**
     * Loads all automation assets (rules and handlers) for the selected entity in parallel.
     * @param {string} entityName - The logical name of the entity.
     * @private
     */
    async _loadAllAutomationsForEntity(entityName) {
        const myToken = ++this._loadToken;

        this.ui.brListContainer.innerHTML = `<p class="pdt-note">${Config.MESSAGES.AUTOMATION.loadingRules(entityName)}</p>`;
        this.ui.eventsContainer.innerHTML = `<div class="section-title">Form Event Handlers</div><p class="pdt-note">${Config.MESSAGES.AUTOMATION.loadingHandlers(entityName)}</p>`;
        this._setLoadingUI(true);

        try {
            // Validate entity exists first
            const entityDef = await DataService.getEntityByAny(entityName);
            if (!entityDef) {
                throw new Error(`Table "${entityName}" not found. Please check the name and try again.`);
            }

            const [rules, events] = await Promise.all([
                DataService.getBusinessRulesForEntity(entityDef.LogicalName),
                DataService.getFormEventHandlersForEntity(entityDef.LogicalName)
            ]);

            if (myToken !== this._loadToken) {
                return;
            }

            this.rules = rules;
            this._renderBusinessRules();
            this._renderFormEvents(this.ui.eventsContainer, events);
        } catch (error) {
            if (myToken !== this._loadToken) {
                return;
            }
            const errorMsg = error.message || String(error);
            NotificationService.show(`Failed to load automations: ${errorMsg}`, 'error');

            // Show clean "no data" state instead of error messages
            this.rules = [];
            this._renderBusinessRules();
            this._renderFormEvents(this.ui.eventsContainer, null);
        } finally {
            if (myToken === this._loadToken) {
                this._setLoadingUI(false);
            }
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
            container.innerHTML = `<div class="section-title">Form Event Handlers</div><p class="pdt-note">${Config.MESSAGES.AUTOMATION.noFormDefinition}</p>`;
            return;
        }

        const renderHandlers = (handlerList) => {
            if (!handlerList || handlerList.length === 0) {
                return '<p class="pdt-note">No handlers configured.</p>';
            }
            return `<ul class="pdt-list">${handlerList.map(h => {
                const fn = escapeHtml(h.function ?? '');
                const lib = escapeHtml(h.library ?? '');
                return `<li class="pdt-list-item-condensed"><span><strong>${fn}</strong> from <span class="code-like">${lib}</span></span></li>`;
            }).join('')}</ul>`;
        };

        const content = `
            <h4 class="pdt-section-header">OnLoad</h4>
            ${renderHandlers(events.OnLoad)}
            <h4 class="pdt-section-header mt-15">OnSave</h4>
            ${renderHandlers(events.OnSave)}
            <p class="pdt-note mt-15">Note: This list shows handlers from the table's main form definition.</p>`;

        container.innerHTML = `<div class="section-title">Form Event Handlers</div>${content}`;
    }
}