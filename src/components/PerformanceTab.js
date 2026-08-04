/**
 * @file Form Performance analysis component.
 * @module components/PerformanceTab
 * @description Displays key form load performance metrics — total load time, the server / network /
 * client breakdown, and form composition counts — then reviews the form against Microsoft's
 * documented performance guidance, linking every finding to the page it comes from.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { Config } from '../constants/index.js';
// Imported from the rule module rather than the barrel: test files mock constants/index.js
// partially, which would leave these undefined.
import {
    reviewFormPerformance,
    countFormPerformanceRules,
    toScannedScript
} from '../constants/formPerformanceRules.js';
import { DataService } from '../services/DataService.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
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

        /**
         * Scanned form libraries, or null while they have not been read. Null disables the script
         * rules rather than passing them, so an unscanned form never claims a clean bill of health.
         * @type {Array<{name: string, code: string}>|null}
         */
        this.scannedScripts = null;

        /** @type {{state: 'idle'|'busy'|'done'|'error', message: string}} */
        this.scanStatus = { state: 'idle', message: '' };

        // Handler references for cleanup
        /** @private {Function|null} */ this._scanHandler = null;
        /** @private {HTMLElement|null} */ this._scanBtn = null;
        /** @private {Function|null} */ this._refreshHandler = null;
        /** @private {HTMLElement|null} */ this._refreshBtn = null;
    }

    /**
     * Builds and returns the static container structure for this tab.
     * @returns {Promise<HTMLElement>} Root HTML container.
     */
    // eslint-disable-next-line require-await
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
        // A reload is a clean slate. The component is a registry singleton, so without this the
        // previous scan's findings would survive a Refresh and be reported against fresh metrics.
        this.scannedScripts = null;
        this.scanStatus = { state: 'idle', message: '' };

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
        host.appendChild(this._buildReviewSection(metrics));
    }

    /**
     * Re-renders only the review section, so a script scan doesn't rebuild the timing chart.
     * @private
     */
    _refreshReview() {
        const host = this.ui.content;
        const existing = host?.querySelector('.pdt-perf-review');
        if (!existing || !this.latestMetrics) {
            return;
        }
        existing.replaceWith(this._buildReviewSection(this.latestMetrics));
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
     * Builds the "Performance Review" section: the form checked against Microsoft's documented
     * guidance, with every finding linking to the page it comes from.
     * @param {PerformanceMetrics} metrics - Performance metrics.
     * @returns {HTMLElement} The section element.
     * @private
     */
    _buildReviewSection(metrics) {
        const M = Config.MESSAGES.PERFORMANCE;
        const withScripts = Array.isArray(this.scannedScripts);
        const findings = reviewFormPerformance({ ...metrics, scripts: this.scannedScripts ?? undefined });

        const section = document.createElement('section');
        section.className = 'pdt-perf-section pdt-perf-review';

        const header = document.createElement('div');
        header.className = 'section-title';
        header.textContent = M.reviewTitle;

        const counts = findings.reduce((acc, f) => {
            acc[f.severity] = (acc[f.severity] || 0) + 1;
            return acc;
        }, {});
        const summaryText = M.reviewSummary(counts.error || 0, counts.warn || 0, counts.info || 0);
        if (summaryText) {
            const summary = document.createElement('span');
            summary.className = 'pdt-badge-small pdt-perf-review-summary';
            summary.textContent = summaryText;
            header.appendChild(summary);
        }

        const intro = document.createElement('p');
        intro.className = 'pdt-note pdt-perf-review-intro';
        intro.textContent = M.reviewIntro;

        section.append(header, intro, this._buildScanControl());

        if (!findings.length) {
            const clean = document.createElement('p');
            clean.className = 'pdt-note';
            clean.textContent = M.reviewClean(countFormPerformanceRules(withScripts));
            section.appendChild(clean);
            return section;
        }

        const list = document.createElement('div');
        list.className = 'pdt-review-findings';
        findings.forEach(finding => list.appendChild(this._buildFindingRow(finding)));
        section.appendChild(list);

        return section;
    }

    /**
     * Builds one finding row: severity, what was found, why, and the Learn page behind it.
     * @param {import('../constants/formPerformanceRules.js').PerformanceFinding} finding - A finding.
     * @returns {HTMLElement} The row element.
     * @private
     */
    _buildFindingRow(finding) {
        const M = Config.MESSAGES.PERFORMANCE;
        const row = document.createElement('div');
        row.className = `pdt-review-finding pdt-review-finding--${finding.severity}`;

        const severity = document.createElement('span');
        severity.className = 'pdt-review-finding-severity';
        severity.textContent = M.severityLabel[finding.severity] || finding.severity;

        const details = document.createElement('div');
        details.className = 'pdt-review-finding-text';

        const message = document.createElement('div');
        message.className = 'pdt-review-finding-message';
        message.textContent = finding.message;

        const reason = document.createElement('div');
        reason.className = 'pdt-review-finding-reason';
        reason.textContent = finding.reason;

        details.append(message, reason);

        if (finding.docUrl) {
            const meta = document.createElement('div');
            meta.className = 'pdt-review-finding-meta';
            const link = document.createElement('a');
            link.className = 'pdt-external-link pdt-review-finding-doc';
            link.href = finding.docUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = M.docLink;
            link.title = M.docLinkTitle(finding.id);
            meta.appendChild(link);
            details.appendChild(meta);
        }

        row.append(severity, details);
        return row;
    }

    /**
     * Builds the script-scan control and its status line. The scan is a separate action because it
     * reads every form library over the network — the composition rules shouldn't wait for it.
     * @returns {HTMLElement} The toolbar element.
     * @private
     */
    _buildScanControl() {
        const M = Config.MESSAGES.PERFORMANCE;
        const isBusy = this.scanStatus.state === 'busy';

        const bar = document.createElement('div');
        bar.className = 'pdt-toolbar pdt-toolbar-end pdt-perf-scan-bar';

        // Status sits first so the buttons stay flush right, as everywhere else in the tool.
        if (this.scanStatus.message) {
            const status = document.createElement('span');
            status.className = 'pdt-perf-scan-status';
            status.setAttribute('role', 'status');
            if (this.scanStatus.state === 'error') {
                status.classList.add('is-error');
            }
            status.textContent = this.scanStatus.message;
            bar.appendChild(status);
        }

        const scanBtn = document.createElement('button');
        scanBtn.id = 'perf-scan-scripts';
        scanBtn.className = 'modern-button secondary';
        scanBtn.type = 'button';
        scanBtn.textContent = M.scanButton;
        scanBtn.title = M.scanButtonTitle;
        scanBtn.disabled = isBusy;
        this._scanBtn = scanBtn;
        this._scanHandler = () => this._handleScanScripts();
        scanBtn.addEventListener('click', this._scanHandler);

        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'perf-refresh';
        refreshBtn.className = 'modern-button secondary';
        refreshBtn.type = 'button';
        refreshBtn.textContent = M.refreshButton;
        refreshBtn.title = M.refreshButtonTitle;
        refreshBtn.disabled = isBusy;
        this._refreshBtn = refreshBtn;
        this._refreshHandler = () => this._loadAndRenderMetrics();
        refreshBtn.addEventListener('click', this._refreshHandler);

        bar.append(scanBtn, refreshBtn);
        return bar;
    }

    /**
     * Reads this table's form libraries and re-runs the review with the script rules enabled.
     * @private
     */
    async _handleScanScripts() {
        const M = Config.MESSAGES.PERFORMANCE;
        const entityName = PowerAppsApiService.getEntityName();

        if (!entityName) {
            this.scanStatus = { state: 'error', message: M.scanUnavailable };
            this._refreshReview();
            return;
        }

        this.scanStatus = { state: 'busy', message: M.scanning };
        this._refreshReview();

        try {
            const { scripts, skipped, system = 0 } = await DataService.getFormScriptSources(entityName);
            // An empty array still enables the script rules — "no libraries" is a real result, and
            // the rules correctly find nothing.
            this.scannedScripts = scripts.map(s => toScannedScript(s.name, s.source));

            const notes = [scripts.length ? M.scanned(scripts.length) : M.scanNoScripts];
            if (system) {
                notes.push(M.scanSystemSkipped(system));
            }
            if (skipped.length) {
                notes.push(M.scanSkipped(skipped.join(', ')));
            }
            this.scanStatus = { state: 'done', message: notes.join(' ') };
        } catch (error) {
            this.scannedScripts = null;
            this.scanStatus = { state: 'error', message: M.scanFailed(error.message) };
        }

        this._refreshReview();
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
            breakdown: this._normalizeBreakdown(raw?.breakdown),
            uiCounts: this._normalizeCounts(raw?.uiCounts),
            // Composition detail the review rules read. Passed through rather than normalized: they
            // are already plain tallies, and rebuilding them here would mean this component has to
            // know every control type the service tallies.
            controlTypes: raw?.controlTypes || {},
            defaultTab: raw?.defaultTab || null
        };
    }

    /**
     * Normalizes the load-time split to safe numbers.
     * @param {any} breakdown - Raw breakdown.
     * @returns {PerformanceBreakdown} Normalized breakdown.
     * @private
     */
    _normalizeBreakdown(breakdown) {
        return {
            network: safeNumber(breakdown?.network),
            server: safeNumber(breakdown?.server),
            client: safeNumber(breakdown?.client)
        };
    }

    /**
     * Normalizes the form composition counts to safe numbers.
     * @param {any} counts - Raw counts.
     * @returns {UiCounts} Normalized counts.
     * @private
     */
    _normalizeCounts(counts) {
        return {
            tabs: safeNumber(counts?.tabs),
            sections: safeNumber(counts?.sections),
            controls: safeNumber(counts?.controls),
            // Columns are counted separately from controls because the documented mobile limit is
            // stated in columns. Dropping this silently disabled the mobile-columns rule.
            columns: safeNumber(counts?.columns),
            onChange: safeNumber(counts?.onChange)
        };
    }

    /**
     * Sets loading indicator state.
     * @param {boolean} isLoading - True to show loading text.
     * @private
     */
    _setLoading(isLoading) {
        if (!this.ui.content) {
            return;
        }
        if (isLoading) {
            this.ui.content.innerHTML = `<p class="pdt-note">${Config.MESSAGES.PERFORMANCE.loading}</p>`;
        }
    }

    /**
     * Lifecycle hook for cleaning up event listeners to prevent memory leaks.
     */
    destroy() {
        if (this._scanBtn && this._scanHandler) {
            this._scanBtn.removeEventListener('click', this._scanHandler);
        }
        if (this._refreshBtn && this._refreshHandler) {
            this._refreshBtn.removeEventListener('click', this._refreshHandler);
        }
        this._scanBtn = null;
        this._scanHandler = null;
        this._refreshBtn = null;
        this._refreshHandler = null;
    }
}
