/**
 * @file Form Performance analysis component.
 * @module components/PerformanceTab
 * @description This tab displays key form load performance metrics and an overview of the form's complexity.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { DataService } from '../services/DataService.js';

/**
 * @typedef {object} PerformanceMetrics
 * @property {string} totalLoadTime - The total form load time in milliseconds.
 * @property {boolean} isApiAvailable - True if the modern Xrm.Performance API was used.
 * @property {object} breakdown - Detailed breakdown of load times.
 * @property {number} breakdown.network - Network time in ms.
 * @property {number} breakdown.server - Server processing time in ms.
 * @property {number} breakdown.client - Client-side execution time in ms.
 * @property {object} uiCounts - Counts of various UI elements on the form.
 * @property {number} uiCounts.tabs - Number of tabs.
 * @property {number} uiCounts.sections - Number of sections.
 * @property {number} uiCounts.controls - Number of controls.
 * @property {number} uiCounts.onChange - Number of OnChange event handlers.
 */

export class PerformanceTab extends BaseComponent {
    /**
     * Initializes the PerformanceTab component.
     */
    constructor() {
        super('performance', 'Performance', ICONS.performance, true);
    }

    /**
     * Renders the component's HTML structure by fetching and displaying performance data.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `<p class="pdt-note">Loading performance metrics...</p>`;

        try {
            /** @type {PerformanceMetrics} */
            const metrics = await DataService.getPerformanceDetails();
            
            // Build the two main sections of the tab using helper methods
            const loadTimeHtml = this._renderLoadTime(metrics);
            const compositionHtml = this._renderComposition(metrics);

            container.innerHTML = loadTimeHtml + compositionHtml;
        } catch (e) {
            container.innerHTML = `<div class="pdt-error">Could not retrieve performance metrics: ${e.message}</div>`;
        }
        
        return container;
    }

    /**
     * Renders the HTML for the Form Load Time section.
     * @param {PerformanceMetrics} metrics - The performance data object.
     * @returns {string} The HTML string for the section.
     * @private
     */
    _renderLoadTime(metrics) {
        const { totalLoadTime, breakdown, isApiAvailable } = metrics;
        
        // Calculate percentages for the breakdown bar, handling division by zero.
        const totalBreakdown = breakdown.network + breakdown.server + breakdown.client;
        const serverPct = totalBreakdown > 0 ? (breakdown.server / totalBreakdown * 100) : 0;
        const networkPct = totalBreakdown > 0 ? (breakdown.network / totalBreakdown * 100) : 0;
        const clientPct = 100 - serverPct - networkPct; // Use subtraction to ensure it always sums to 100

        const breakdownHtml = isApiAvailable ? `
            <div class="pdt-perf-bar" title="Server: ${breakdown.server.toFixed(0)}ms | Network: ${breakdown.network.toFixed(0)}ms | Client: ${breakdown.client.toFixed(0)}ms">
                <div class="pdt-perf-server" style="width:${serverPct}%;" title="Server: ${breakdown.server.toFixed(0)}ms"></div>
                <div class="pdt-perf-network" style="width:${networkPct}%;" title="Network: ${breakdown.network.toFixed(0)}ms"></div>
                <div class="pdt-perf-client" style="width:${clientPct}%;" title="Client: ${breakdown.client.toFixed(0)}ms"></div>
            </div>
            <div class="pdt-perf-legend">
                <span><i class="pdt-perf-server"></i> Server</span>
                <span><i class="pdt-perf-network"></i> Network</span>
                <span><i class="pdt-perf-client"></i> Client</span>
            </div>
            ` : `<p class="pdt-note">Detailed breakdown is only available via the Xrm.Performance API.</p>`;

        return `
            <div class="section-title">Form Load Time</div>
            <div class="pdt-perf-card">
                <div class="pdt-perf-total-time">${totalLoadTime}<span>ms</span></div>
                <div class="pdt-perf-total-label">${isApiAvailable ? 'Full Component Library Load (FCL)' : 'Page Navigation Time (Fallback)'}</div>
                ${breakdownHtml}
            </div>`;
    }

    /**
     * Renders the HTML for the Form Composition section.
     * @param {PerformanceMetrics} metrics - The performance data object.
     * @returns {string} The HTML string for the section.
     * @private
     */
    _renderComposition(metrics) {
        const { uiCounts } = metrics;
        const statCards = [
            { label: 'Tabs', value: uiCounts.tabs },
            { label: 'Sections', value: uiCounts.sections },
            { label: 'Controls', value: uiCounts.controls },
            { label: 'OnChange Events', value: uiCounts.onChange }
        ];

        const cardsHtml = statCards.map(card => `
            <div class="pdt-stat-card">
                <div class="pdt-stat-value">${card.value}</div>
                <div class="pdt-stat-label">${card.label}</div>
            </div>`).join('');

        return `
            <div class="section-title">Form Composition</div>
            <div class="pdt-grid-4">${cardsHtml}</div>`;
    }
}