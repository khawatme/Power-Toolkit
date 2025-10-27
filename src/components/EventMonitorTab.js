/**
 * @file Form Event Monitor component.
 * @module components/EventMonitorTab
 * @description A live log of form events (OnLoad, OnSave, OnChange) as they happen.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
import { appendLogEntry, clearContainer } from '../helpers/index.js';
import { Config } from '../constants/index.js';

/**
 * @callback LogFunction
 * @param {string} className - The CSS class for the log entry type.
 * @param {string} message - The primary log message.
 * @param {object} [context] - The execution context from the event, if available.
 */

/**
 * A component that attaches to the current form's events (OnLoad, OnSave, OnChange)
 * and provides a live, auto-scrolling log of when they are triggered. It ensures
 * all attached listeners are cleaned up when the component is destroyed.
 * @extends {BaseComponent}
 * @property {boolean} isMonitoring - Tracks if the component is actively listening for events.
 * @property {Array<object>} attachedHandlers - An array that stores references to all attached
 * event handlers for later removal.
 */
export class EventMonitorTab extends BaseComponent {
    /**
     * Initializes the EventMonitorTab component.
     */
    constructor() {
        super('eventMonitor', 'Event Monitor', ICONS.eventMonitor, true);
        this.isMonitoring = false;
        this.attachedHandlers = [];
    }

    /** @private */ _maxLogEntries = 500;
    /** @private */ _clearBtnHandler = null;

    /** @private */
    _safeArray(v) { return Array.isArray(v) ? v : []; }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="section-title">Form Event Monitor</div>
            <div class="pdt-toolbar">
                <span id="live-status-indicator" class="live-indicator is-live" aria-hidden="true"></span>
                <span id="monitoring-status" aria-live="polite" role="status"></span>
                <button id="clear-log-btn" class="modern-button secondary ml-auto">Clear Log</button>
            </div>
            <div id="event-log-container" role="log" aria-live="polite" aria-relevant="additions"></div>`;
        return container;
    }

    /**
     * Attaches event listeners and starts monitoring after the component is added to the DOM.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        const logContainer = element.querySelector('#event-log-container');
        const statusEl = element.querySelector('#monitoring-status');

        const logEvent = (className, message, context) => {
            if (!logContainer) return;
            try {
                // Try to surface useful context without risking errors
                const src = context?.getEventSource?.();
                const attrName = src?.getName?.();
                const depth = context?.getDepth?.();
                let extra = '';
                // Save mode, when present (only on OnSave)
                const saveMode = context?.getEventArgs?.()?.getSaveMode?.();
                if (typeof saveMode === 'number') extra += ` [mode:${saveMode}]`;
                if (typeof depth === 'number') extra += ` [depth:${depth}]`;
                const fullMessage = attrName ? `${message}: ${attrName}${extra}` : `${message}${extra}`;
                appendLogEntry(logContainer, className, fullMessage, this._maxLogEntries);
            } catch (err) {
                appendLogEntry(logContainer, 'log-entry-warn', `${message} (context unavailable)`, this._maxLogEntries);
            }
        };

        // Clear button
        const clearBtn = element.querySelector('#clear-log-btn');
        this._clearBtnHandler = () => {
            if (!logContainer) return;
            clearContainer(logContainer);
            statusEl.textContent = Config.MESSAGES.EVENT_MONITOR.cleared;
            // Revert back to monitoring status after a brief moment
            setTimeout(() => {
                if (statusEl) statusEl.textContent = Config.MESSAGES.EVENT_MONITOR.monitoring;
            }, 2000);
        };
        clearBtn?.addEventListener('click', this._clearBtnHandler);

        // Start monitoring (guarded)
        this._startMonitoring(logEvent);
        statusEl.textContent = Config.MESSAGES.EVENT_MONITOR.monitoring;

        // Add initial info message
        appendLogEntry(logContainer, 'log-entry-warn',
            'Event Monitor started. Note: OnLoad event may have already fired. Modify a field or save the form to see new events.',
            this._maxLogEntries);
    }

    /**
     * Cleans up all attached event listeners when the component is destroyed.
     */
    destroy() {
        try {
            this._stopMonitoring();
            // Remove the clear handler if it was set (query from the current root if available)
            const root = document.querySelector('[data-component-id="eventMonitor"]') || document;
            const clearBtn = root.querySelector?.('#clear-log-btn');
            if (clearBtn && this._clearBtnHandler) {
                clearBtn.removeEventListener('click', this._clearBtnHandler);
            }
        } catch { }
    }

    /**
     * Attaches listeners to all relevant form and attribute events.
     * @param {LogFunction} logFunction - The function to call when an event fires.
     * @private
     */
    _startMonitoring(logFunction) {
        // Always stop monitoring first to ensure clean state
        // This handles cases where the tab is switched without dispose being called
        this._stopMonitoring();

        let handlersAdded = 0;

        try {
            const onLoadHandler = (ctx) => logFunction('log-entry-load', 'Form OnLoad', ctx);
            PowerAppsApiService.addOnLoad?.(onLoadHandler);
            this.attachedHandlers.push({ type: 'load', handler: onLoadHandler });
            handlersAdded++;
        } catch (e) {
            // Silent - event handler attachment failure is not critical
        }

        try {
            const onSaveHandler = (ctx) => logFunction('log-entry-save', 'Form OnSave', ctx);
            PowerAppsApiService.addOnSave?.(onSaveHandler);
            this.attachedHandlers.push({ type: 'save', handler: onSaveHandler });
            handlersAdded++;
        } catch (e) {
            // Silent - event handler attachment failure is not critical
        }

        // Attributes can be missing early; guard and iterate safely
        const attrs = this._safeArray(PowerAppsApiService.getAllAttributes?.());
        attrs.forEach(attr => {
            try {
                if (typeof attr?.addOnChange === 'function') {
                    const onChangeHandler = (ctx) => logFunction('log-entry-change', 'Attribute OnChange', ctx);
                    attr.addOnChange(onChangeHandler);
                    this.attachedHandlers.push({ type: 'change', attr, handler: onChangeHandler });
                    handlersAdded++;
                }
            } catch (e) {
                // Silent - individual attribute handler failures are not critical
            }
        });

        this.isMonitoring = true;
    }

    /**
     * Detaches all previously attached event listeners from the form context.
     * This is a critical cleanup step to prevent memory leaks and performance
     * degradation when the tool is closed or the user navigates away.
     * @private
     */
    _stopMonitoring() {
        // Detach regardless of isMonitoring, in case state got out of sync
        try {
            this.attachedHandlers.forEach(item => {
                try {
                    if (item.type === 'load') PowerAppsApiService.removeOnLoad?.(item.handler);
                    else if (item.type === 'save') PowerAppsApiService.removeOnSave?.(item.handler);
                    else if (item.type === 'change') item.attr?.removeOnChange?.(item.handler);
                } catch { }
            });
        } catch (e) {
            // Silent - cleanup errors are handled gracefully
        } finally {
            this.attachedHandlers = [];
            this.isMonitoring = false;
        }
    }
}