/**
 * @file User Context display component.
 * @module components/UserContextTab
 * @description Displays comprehensive details about the current (or impersonated) user, client session, and organization.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { DataService } from '../services/DataService.js';
import { escapeHtml, copyToClipboard } from '../helpers/index.js';
import { Config } from '../constants/index.js';
import { Store } from '../core/Store.js';

/**
 * @typedef {object} EnhancedUserContext
 * @property {{ id:string, name:string, language:string|number, roles:Array<{id:string, name:string}> }} user
 * @property {{ type:string, formFactor:string, isOffline:boolean, appUrl:string }} client
 * @property {{ id:string, name:string, version:string, isAutoSave:boolean }} organization
 * @property {{ timestamp:string, sessionId:string, tenantId:string, objectId:string, buildName:string, organizationId:string, uniqueName:string, instanceUrl:string, environmentId:string, clusterEnvironment:string, clusterCategory:string, clusterGeoName:string, clusterUriSuffix:string }} session
 */

/**
 * Displays comprehensive details about the current session, including user settings and roles,
 * client information, and organization details. Reactively updates when the impersonated user changes.
 * - Race-proof: uses AbortController to avoid out-of-order updates
 * - SOLID: small private helpers, single responsibilities
 * - Accessible: keyboard and semantics
 *
 * @extends {BaseComponent}
 */
export class UserContextTab extends BaseComponent {
    /**
     * Initializes the UserContextTab component.
     */
    constructor() {
        super('userContext', 'User Context', ICONS.user);
        /** @type {() => void | null} unsubscribe function from Store */
        this.unsubscribe = null;
        /** @type {Record<string, HTMLElement>} cached UI references */
        this.ui = {};

        // Event handler references for cleanup
        /** @private {Function|null} */ this._handleClick = null;
        /** @private {Function|null} */ this._handleKeydown = null;
        /** @type {AbortController|null} inflight loader */
        this._inflight = null;
    }

    /**
     * Renders the component's initial container. Data loads in postRender.
     * @returns {Promise<HTMLElement>} The root element.
     */
    async render() {
        const container = document.createElement('div');
        container.className = 'pdt-userctx-root';
        container.innerHTML = `<p class="pdt-note">${Config.MESSAGES.USER_CONTEXT.loading}</p>`;
        return container;
    }

    /**
     * Attaches event listeners, subscribes to the store, and triggers initial load.
     * @param {HTMLElement} element - Root element of the component.
     */
    postRender(element) {
        this.ui.container = element;

        // React to impersonation changes
        this.unsubscribe = Store.subscribe((newState, oldState) => {
            if (newState.impersonationUserId !== oldState.impersonationUserId) {
                this._loadData();
            }
        });

        // Copy-on-click (delegated)
        this._handleClick = (e) => {
            const target = /** @type {HTMLElement|null} */ (e.target && e.target.closest('.copyable'));
            if (target) {
                const text = (target.textContent || '').trim();
                if (text) {
                    copyToClipboard(text, `Copied: ${text}`);
                    e.stopPropagation();
                }
            }
        };
        element.addEventListener('click', this._handleClick);

        // Keyboard: allow Enter/Space to copy when focused
        this._handleKeydown = (e) => {
            const el = /** @type {HTMLElement|null} */ (e.target);
            if (!el || !el.classList?.contains('copyable')) {
                return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const text = (el.textContent || '').trim();
                if (text) {
                    copyToClipboard(text, `Copied: ${text}`);
                }
            }
        };
        element.addEventListener('keydown', this._handleKeydown);

        this._loadData();
    }

    /**
     * Unsubscribes and aborts inflight requests to prevent leaks when destroyed.
     */
    destroy() {
        // Remove event listeners
        if (this.ui.container && this._handleClick) {
            this.ui.container.removeEventListener('click', this._handleClick);
        }
        if (this.ui.container && this._handleKeydown) {
            this.ui.container.removeEventListener('keydown', this._handleKeydown);
        }

        // Unsubscribe from store
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        // Abort inflight requests
        if (this._inflight) {
            this._inflight.abort();
        }

        // Clear references
        this.unsubscribe = null;
        this._inflight = null;
        this._handleClick = null;
        this._handleKeydown = null;
    }

    /**
     * Fetches the complete user, client, and org context (bypass cache) and renders.
     * Race-proof via AbortController to avoid stale UI on quick changes.
     * @private
     */
    async _loadData() {
        // Abort any in-progress load
        if (this._inflight) {
            this._inflight.abort();
        }
        this._inflight = new AbortController();
        const { signal } = this._inflight;

        this._renderLoading();

        try {
            /** @type {EnhancedUserContext} */
            // DataService may ignore `signal` if unsupported; passing is harmless
            const context = await DataService.getEnhancedUserContext(true, { signal });
            if (signal.aborted) {
                return;
            }
            this._renderCards(context);
        } catch (e) {
            if (e?.name === 'AbortError') {
                return;
            }
            this.ui.container.innerHTML = `<div class="pdt-error">${Config.MESSAGES.USER_CONTEXT.loadFailed(escapeHtml(e.message || String(e)))}</div>`;
        } finally {
            this._inflight = null;
        }
    }

    /** Paints a lightweight loading state. @private */
    _renderLoading() {
        this.ui.container.innerHTML = `<p class="pdt-note">${Config.MESSAGES.USER_CONTEXT.loading}</p>`;
    }

    /**
     * Renders all context cards.
     * @param {EnhancedUserContext} ctx
     * @private
     */
    _renderCards(ctx) {
        const impersonated = Store.getState?.()?.impersonationUserId;
        const banner = impersonated
            ? `<div class="pdt-impersonation-banner" role="status" aria-live="polite">
           Impersonating user: <span class="code-like copyable" tabindex="0">${escapeHtml(impersonated)}</span>
         </div>`
            : '';

        const userData = this._kv({
            'Name': `<span>${escapeHtml(ctx.user.name)}</span>`,
            'User ID': `<span class="copyable code-like" title="Click to copy" tabindex="0">${escapeHtml(ctx.user.id)}</span>`,
            'Language ID': `<span>${escapeHtml(String(ctx.user.language))}</span>`
        });

        const clientData = this._kv({
            'Client Type': `<span>${escapeHtml(ctx.client.type)}</span>`,
            'Form Factor': `<span>${escapeHtml(ctx.client.formFactor)}</span>`,
            'Is Offline': `<span>${ctx.client.isOffline}</span>`,
            'App URL': `<span class="copyable" title="Click to copy" tabindex="0">${escapeHtml(ctx.client.appUrl)}</span>`
        });

        const orgData = this._kv({
            'Org Name': `<span>${escapeHtml(ctx.organization.name)}</span>`,
            'Org ID': `<span class="copyable code-like" title="Click to copy" tabindex="0">${escapeHtml(ctx.organization.id)}</span>`,
            'Version': `<span>${escapeHtml(ctx.organization.version)}</span>`,
            'Auto-Save On': `<span>${ctx.organization.isAutoSave}</span>`,
            'Timestamp': `<span class="copyable" title="Click to copy" tabindex="0">${escapeHtml(ctx.session.timestamp)}</span>`
        });

        const rolesSection = this._rolesSection(ctx.user.roles);

        this.ui.container.innerHTML = `
      <div class="section-title">User & Session Context</div>
      ${banner}
      ${this._card('User Settings', '👤', userData, rolesSection)}
      ${this._card('Client & Session', '💻', clientData)}
      ${this._card('Organization Details', '🏢', orgData)}
    `;
    }

    /**
     * Converts a map of label->HTML-value to grid rows markup.
     * @param {Record<string,string>} map
     * @returns {string}
     * @private
     */
    _kv(map) {
        return Object.entries(map)
            .map(([k, v]) => `<strong>${escapeHtml(k)}:</strong>${v}`)
            .join('');
    }

    /**
     * Renders the roles section as a footer body for the user card.
     * @param {Array<{id:string, name:string}>} roles
     * @returns {string} HTML
     * @private
     */
    _rolesSection(roles) {
        const count = Array.isArray(roles) ? roles.length : 0;
        const bodyTitle = `<h4 class="pdt-section-header">Security Roles (${count})</h4>`;
        if (!count) {
            return `<div class="pdt-card-body">${bodyTitle}<p class="pdt-note">${Config.MESSAGES.USER_CONTEXT.noRoles}</p></div>`;
        }
        const items = roles.map(r => `<li>
            <div>${escapeHtml(r.name)}</div>
            <div class="copyable code-like pdt-role-id" title="Click to copy role ID" tabindex="0">${escapeHtml(r.id)}</div>
        </li>`).join('');
        return `<div class="pdt-card-body">${bodyTitle}<ul class="pdt-role-list">${items}</ul></div>`;
    }

    /**
     * Creates a standard card with header, body (grid), and optional footer.
     * @param {string} title
     * @param {string} icon
     * @param {string} gridRowsHtml
     * @param {string} [footerHtml='']
     * @returns {string}
     * @private
     */
    _card(title, icon, gridRowsHtml, footerHtml = '') {
        return `
      <section class="pdt-card pdt-userctx-card" aria-label="${escapeHtml(title)}">
        <header class="pdt-card-header"><span class="pdt-card-emoji" aria-hidden="true">${icon}</span> ${escapeHtml(title)}</header>
        <div class="pdt-card-body"><div class="info-grid">${gridRowsHtml}</div></div>
        ${footerHtml}
      </section>
    `;
    }
}
