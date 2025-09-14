/**
 * @file Form Event Monitor component.
 * @module components/EventMonitorTab
 * @description A live log of form events (OnLoad, OnSave, OnChange) as they happen.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';

export class EventMonitorTab extends BaseComponent {
    /**
     * Initializes the EventMonitorTab component.
     */
    constructor() {
        super('eventMonitor', 'Event Monitor', ICONS.eventMonitor, true);
        this.isMonitoring = false;
        this.attachedHandlers = [];
    }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="section-title">Form Event Monitor</div>
            <div class="pdt-toolbar">
                <span id="monitoring-status"></span>
                <button id="clear-log-btn" class="modern-button secondary" style="margin-left: auto;">Clear Log</button>
            </div>
            <div id="event-log-container"></div>`;
        return container;
    }

    /**
     * Attaches event listeners and starts monitoring after the component is added to the DOM.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        // 1. Get a direct reference to the container. This variable will be "captured" by the functions below.
        const logContainer = element.querySelector('#event-log-container');
        
        // 2. Define the logging function locally. It now uses the `logContainer` variable directly.
        const logEvent = (className, message, context) => {
            if (!logContainer) return;

            const attr = context?.getEventSource?.();
            const attrName = attr?.getName?.();
            const fullMessage = attrName ? `${message}: ${attrName}` : message;

            const entry = document.createElement('div');
            entry.className = `log-entry ${className}`;
            entry.textContent = `[${new Date().toLocaleTimeString()}] ${fullMessage}`;
            
            logContainer.appendChild(entry);
            logContainer.scrollTop = logContainer.scrollHeight;
        };

        // 3. The "Clear Log" button also uses the local `logContainer` reference.
        element.querySelector('#clear-log-btn').onclick = () => {
            if (logContainer) {
                while (logContainer.firstChild) {
                    logContainer.removeChild(logContainer.firstChild);
                }
            }
        };

        // 4. Pass the self-contained `logEvent` function to the monitoring logic.
        this._startMonitoring(logEvent);
        element.querySelector('#monitoring-status').textContent = '🟢 Monitoring form events...';
    }

    /**
     * Cleans up all attached event listeners when the component is destroyed.
     */
    destroy() {
        this._stopMonitoring();
    }

    /**
     * Attaches listeners to all relevant form and attribute events.
     * @param {Function} logFunction - The function to call when an event fires.
     * @private
     */
    _startMonitoring(logFunction) {
        if (this.isMonitoring) return;
        
        this._stopMonitoring();

        const onLoadHandler = (context) => logFunction('log-entry-load', 'Form OnLoad', context);
        PowerAppsApiService.addOnLoad(onLoadHandler);
        this.attachedHandlers.push({ type: 'load', handler: onLoadHandler });

        const onSaveHandler = (context) => logFunction('log-entry-save', 'Form OnSave', context);
        PowerAppsApiService.addOnSave(onSaveHandler);
        this.attachedHandlers.push({ type: 'save', handler: onSaveHandler });

        PowerAppsApiService.getAllAttributes().forEach(attr => {
            if (typeof attr.addOnChange === 'function') {
                const onChangeHandler = (context) => logFunction('log-entry-change', 'Attribute OnChange', context);
                attr.addOnChange(onChangeHandler);
                this.attachedHandlers.push({ type: 'change', attr, handler: onChangeHandler });
            }
        });

        this.isMonitoring = true;
    }

    /**
     * Detaches all previously attached event listeners to prevent memory leaks.
     * @private
     */
    _stopMonitoring() {
        if (!this.isMonitoring) return;

        try {
            this.attachedHandlers.forEach(item => {
                switch (item.type) {
                    case 'load':
                        PowerAppsApiService.removeOnLoad(item.handler);
                        break;
                    case 'save':
                        PowerAppsApiService.removeOnSave(item.handler);
                        break;
                    case 'change':
                        if (item.attr && typeof item.attr.removeOnChange === 'function') {
                            item.attr.removeOnChange(item.handler);
                        }
                        break;
                }
            });
            console.log('PDT Event Monitor stopped and all listeners detached.');
        } catch (e) {
            console.warn("PDT Event Monitor: A non-critical error occurred while removing listeners.", e);
        }
        
        this.attachedHandlers = [];
        this.isMonitoring = false;
    }
}