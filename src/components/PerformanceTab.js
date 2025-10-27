/**
 * @file Form Performance analysis component.
 * @module components/PerformanceTab
 * @description Displays key form load performance metrics, including total load time,
 * detailed breakdown (server, network, client), form composition counts,
 * and intelligent insights based on configurable thresholds.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { Config } from '../constants/index.js';
import { DataService } from '../services/DataService.js';
import { clearContainer, escapeHtml, formatMilliseconds, calculatePercentages, safeNumber } from '../helpers/index.js';

/**
 * @typedef {object} PerformanceBreakdown
 * @property {number} network - Network time in milliseconds.
 * @property {number} server - Server-side processing time in milliseconds.
 * @property {number} client - Client-side rendering time in milliseconds.
 */

/**
 * @typedef {object} UiCounts
 * @property {number} tabs - Number of tabs on the form.
 * @property {number} sections - Number of sections.
 * @property {number} controls - Number of visible controls.
 * @property {number} onChange - Number of OnChange event handlers registered.
 */

/**
 * @typedef {object} PerformanceMetrics
 * @property {number|string} totalLoadTime - The total load time in milliseconds.
 * @property {boolean} isApiAvailable - Indicates whether the Xrm.Performance API is available.
 * @property {PerformanceBreakdown} breakdown - Breakdown of performance metrics.
 * @property {UiCounts} uiCounts - UI composition counts.
 */

/**
 * @typedef {object} PerfPercents
 * @property {number} serverPct - Server time percentage of total.
 * @property {number} networkPct - Network time percentage of total.
 * @property {number} clientPct - Client time percentage of total.
 */

/**
 * The PerformanceTab component provides a detailed overview of form performance.
 * It presents load-time breakdown, form complexity stats, and data-driven recommendations.
 * @extends {BaseComponent}
 */
export class PerformanceTab extends BaseComponent {
    /**
     * Initializes the PerformanceTab component.
     */
    constructor() {
        super('performance', 'Performance', ICONS.performance, true);

        /** @type {{container?: HTMLElement, content?: HTMLElement}} */
        this.ui = {};

        /** @type {PerformanceMetrics|null} */
        this.latestMetrics = null;

        /** @type {{totalMsWarn:number, totalMsBad:number, controlsWarn:number, onChangeWarn:number, tabsWarn:number, sectionsWarn:number}} */
        this.thresholds = {
            totalMsWarn: 2000,
            totalMsBad: 4000,
            controlsWarn: 200,
            onChangeWarn: 25,
            tabsWarn: 8,
            sectionsWarn: 30
        };
    }

    /**
     * Builds and returns the static container structure for this tab.
     * @returns {Promise<HTMLElement>} Root HTML container.
     */
    async render() {
        const root = document.createElement('div');

        const title = document.createElement('div');
        title.className = 'section-title';
        title.textContent = 'Form Performance';

        const content = document.createElement('div');
        content.className = 'pdt-content-host';
        content.innerHTML = `<p class="pdt-note">${Config.MESSAGES.PERFORMANCE.loading}</p>`;

        root.append(title, content);

        this.ui = { container: root, content };
        return root;
    }

    /**
     * Called when the component is inserted into the DOM.
     * Triggers the performance metrics fetch and renders results.
     * @param {HTMLElement} element - The root container.
     */
    async postRender(element) {
        this.ui.content = element.querySelector('.pdt-content-host');
        await this._loadAndRenderMetrics();
    }

    /**
     * Loads performance data via DataService and renders the tab contents.
     * @private
     */
    async _loadAndRenderMetrics() {
        this._setLoading(true);
        try {
            const rawMetrics = await DataService.getPerformanceDetails();
            this.latestMetrics = this._normalizeMetrics(rawMetrics);
            this._renderAll(this.latestMetrics);
        } catch (e) {
            this.ui.content.innerHTML = `<div class="pdt-error">${Config.MESSAGES.PERFORMANCE.loadFailed(e.message)}</div>`;
        } finally {
            this._setLoading(false);
        }
    }

    /**
     * Clears and renders all sections: Load Time, Composition, and Insights.
     * @param {PerformanceMetrics} metrics - Processed metrics.
     * @private
     */
    _renderAll(metrics) {
        const host = this.ui.content;
        clearContainer(host);

        host.appendChild(this._buildLoadTimeSection(metrics));
        host.appendChild(this._buildCompositionSection(metrics));
        host.appendChild(this._buildInsightsSection(metrics));
    }

    /**
     * Builds the "Form Load Time" section with breakdown visualization.
     * @param {PerformanceMetrics} metrics - Performance metrics object.
     * @returns {HTMLElement} The section element.
     * @private
     */
    _buildLoadTimeSection(metrics) {
        const section = document.createElement('section');
        section.className = 'pdt-perf-section';

        const header = document.createElement('div');
        header.className = 'section-title';
        header.textContent = 'Form Load Time';

        const card = document.createElement('div');
        card.className = 'pdt-perf-card';

        const total = document.createElement('div');
        total.className = 'pdt-perf-total-time';
        total.innerHTML = `${escapeHtml(String(metrics.totalLoadTime))}<span>ms</span>`;

        const label = document.createElement('div');
        label.className = 'pdt-perf-total-label';
        label.textContent = metrics.isApiAvailable
            ? 'Full Component Library Load (Xrm.Performance)'
            : 'Page Navigation Time (Fallback)';

        card.append(total, label);

        if (metrics.isApiAvailable && metrics.breakdown) {
            const percentages = calculatePercentages({
                server: metrics.breakdown.server || 0,
                network: metrics.breakdown.network || 0,
                client: metrics.breakdown.client || 0
            });
            const pct = {
                serverPct: percentages.server,
                networkPct: percentages.network,
                clientPct: percentages.client
            };
            const bar = this._buildPerfBar(metrics.breakdown, pct);
            card.appendChild(bar);
            card.appendChild(this._buildLegend());
        } else {
            const note = document.createElement('p');
            note.className = 'pdt-note';
            note.textContent = 'Detailed breakdown is only available when the Xrm.Performance API is available.';
            card.appendChild(note);
        }

        section.append(header, card);
        return section;
    }

    /**
     * Builds the horizontal bar visualization for performance breakdown.
     * @param {PerformanceBreakdown} breakdown - Performance breakdown.
     * @param {PerfPercents} pct - Percentages for each segment.
     * @returns {HTMLElement} The bar element.
     * @private
     */
    _buildPerfBar(breakdown, pct) {
        const bar = document.createElement('div');
        bar.className = 'pdt-perf-bar';
        bar.title = `Server: ${formatMilliseconds(breakdown.server)} | Network: ${formatMilliseconds(breakdown.network)} | Client: ${formatMilliseconds(breakdown.client)}`;

        bar.append(
            this._buildBarSegment('pdt-perf-server', pct.serverPct, `Server: ${formatMilliseconds(breakdown.server)}`),
            this._buildBarSegment('pdt-perf-network', pct.networkPct, `Network: ${formatMilliseconds(breakdown.network)}`),
            this._buildBarSegment('pdt-perf-client', pct.clientPct, `Client: ${formatMilliseconds(breakdown.client)}`)
        );

        return bar;
    }

    /**
     * Creates a single colored bar segment for the breakdown.
     * @param {string} className - CSS class for color.
     * @param {number} widthPct - Width percentage.
     * @param {string} title - Tooltip text.
     * @returns {HTMLDivElement} The segment element.
     * @private
     */
    _buildBarSegment(className, widthPct, title) {
        const seg = document.createElement('div');
        seg.className = className;
        seg.style.width = `${Math.max(0, Math.min(100, widthPct))}%`;
        seg.title = title;
        return seg;
    }

    /**
     * Builds the legend for the performance bar.
     * @returns {HTMLElement} The legend element.
     * @private
     */
    _buildLegend() {
        const legend = document.createElement('div');
        legend.className = 'pdt-perf-legend';
        legend.innerHTML = `
            <span><i class="pdt-perf-server"></i> Server</span>
            <span><i class="pdt-perf-network"></i> Network</span>
            <span><i class="pdt-perf-client"></i> Client</span>
        `;
        return legend;
    }

    /**
     * Builds the "Form Composition" section with stat cards.
     * @param {PerformanceMetrics} metrics - Performance metrics.
     * @returns {HTMLElement} The section element.
     * @private
     */
    _buildCompositionSection(metrics) {
        const section = document.createElement('section');
        section.className = 'pdt-perf-section';

        const header = document.createElement('div');
        header.className = 'section-title';
        header.textContent = 'Form Composition';

        const grid = document.createElement('div');
        grid.className = 'pdt-grid-4';

        const { uiCounts } = metrics;
        const cards = [
            { label: 'Tabs', value: uiCounts.tabs },
            { label: 'Sections', value: uiCounts.sections },
            { label: 'Controls', value: uiCounts.controls },
            { label: 'OnChange Events', value: uiCounts.onChange }
        ];

        cards.forEach(card => grid.appendChild(this._buildStatCard(card.value, card.label)));

        section.append(header, grid);
        return section;
    }

    /**
     * Creates a single statistic card (value + label).
     * @param {number} value - Numeric value.
     * @param {string} label - Display label.
     * @returns {HTMLElement} The stat card element.
     * @private
     */
    _buildStatCard(value, label) {
        const card = document.createElement('div');
        card.className = 'pdt-stat-card';
        card.innerHTML = `
            <div class="pdt-stat-value">${escapeHtml(String(value))}</div>
            <div class="pdt-stat-label">${escapeHtml(label)}</div>
        `;
        return card;
    }

    /**
     * Builds the "Insights & Recommendations" section.
     * @param {PerformanceMetrics} metrics - Performance metrics.
     * @returns {HTMLElement} The section element.
     * @private
     */
    _buildInsightsSection(metrics) {
        const insights = this._computeInsights(metrics);
        const section = document.createElement('section');
        section.className = 'pdt-perf-section';

        const header = document.createElement('div');
        header.className = 'section-title';
        header.textContent = 'Insights & Recommendations';

        if (!insights.length) {
            const note = document.createElement('p');
            note.className = 'pdt-note';
            note.textContent = 'No significant issues detected for this form.';
            section.append(header, note);
            return section;
        }

        const list = document.createElement('ul');
        list.className = 'pdt-note';
        insights.forEach(msg => {
            const li = document.createElement('li');
            li.textContent = msg;
            list.appendChild(li);
        });

        section.append(header, list);
        return section;
    }

    /**
     * Normalizes raw metrics into a consistent structure with safe numeric defaults.
     * @param {any} raw - Raw response from DataService.
     * @returns {PerformanceMetrics} Normalized metrics.
     * @private
     */
    _normalizeMetrics(raw) {
        return {
            totalLoadTime: safeNumber(raw?.totalLoadTime) || raw?.totalLoadTime || 0,
            isApiAvailable: !!raw?.isApiAvailable,
            breakdown: {
                network: safeNumber(raw?.breakdown?.network),
                server: safeNumber(raw?.breakdown?.server),
                client: safeNumber(raw?.breakdown?.client)
            },
            uiCounts: {
                tabs: safeNumber(raw?.uiCounts?.tabs),
                sections: safeNumber(raw?.uiCounts?.sections),
                controls: safeNumber(raw?.uiCounts?.controls),
                onChange: safeNumber(raw?.uiCounts?.onChange)
            }
        };
    }

    /**
     * Generates contextual recommendations based on metric thresholds.
     * @param {PerformanceMetrics} m - Metrics.
     * @returns {string[]} Recommendations.
     * @private
     */
    _computeInsights(m) {
        const tips = [];
        const t = this.thresholds;
        const total = Number(m.totalLoadTime) || 0;

        if (total >= t.totalMsBad) {
            tips.push(`Total load time (${total} ms) is critical. Optimize scripts, plugins, and minimize synchronous logic.`);
        } else if (total >= t.totalMsWarn) {
            tips.push(`Total load time (${total} ms) could be improved. Consider deferring non-essential initialization.`);
        }

        if (m.uiCounts.controls >= t.controlsWarn) {
            tips.push(`Form has ${m.uiCounts.controls} controls — consider splitting across tabs or forms.`);
        }
        if (m.uiCounts.onChange >= t.onChangeWarn) {
            tips.push(`Detected ${m.uiCounts.onChange} OnChange handlers — consolidate logic and avoid redundancy.`);
        }
        if (m.uiCounts.tabs >= t.tabsWarn) {
            tips.push(`Form has ${m.uiCounts.tabs} tabs — excessive tab count impacts load and usability.`);
        }
        if (m.uiCounts.sections >= t.sectionsWarn) {
            tips.push(`Form has ${m.uiCounts.sections} sections — consider grouping or removing non-critical layouts.`);
        }

        const { server, network, client } = m.breakdown || {};
        if (m.isApiAvailable && server > client && server > network)
            tips.push('Server-side processing dominates — review plugins and workflows triggered on load.');
        if (m.isApiAvailable && client > server && client > network)
            tips.push('Client rendering dominates — optimize scripts and avoid heavy loops on onLoad.');
        if (m.isApiAvailable && network > Math.max(server, client))
            tips.push('Network time dominates — minimize initial fetch size and enable column reduction.');

        return tips;
    }

    /**
     * Sets loading indicator state.
     * @param {boolean} isLoading - True to show loading text.
     * @private
     */
    _setLoading(isLoading) {
        if (!this.ui.content) return;
        if (isLoading) {
            this.ui.content.innerHTML = `<p class="pdt-note">${Config.MESSAGES.PERFORMANCE.loading}</p>`;
        }
    }
}
