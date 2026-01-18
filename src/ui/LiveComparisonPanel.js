/**
 * @file Live Comparison Panel - Floating UI for real-time impersonation differences
 * @module ui/LiveComparisonPanel
 * @description Provides a floating panel that displays real-time differences between
 * admin and impersonated user views during live impersonation mode.
 */

import { Config } from '../constants/index.js';
import { LiveImpersonationService } from '../services/LiveImpersonationService.js';
import { ComponentRegistry } from '../core/ComponentRegistry.js';
import { escapeHtml, copyToClipboard } from '../helpers/index.js';

/**
 * Floating panel for displaying live impersonation comparison results.
 * @class LiveComparisonPanelClass
 */
class LiveComparisonPanelClass {
    constructor() {
        /**
         * The panel element
         * @type {HTMLElement|null}
         */
        this.panel = null;

        /**
         * Whether the panel is currently visible
         * @type {boolean}
         */
        this.isVisible = false;

        /**
         * Whether the panel is minimized
         * @type {boolean}
         */
        this.isMinimized = false;

        /**
         * UI element references
         * @type {Object}
         */
        this.ui = {};

        /**
         * Bound event handlers for cleanup
         * @private
         */
        this._dragHandler = null;
        this._dragEndHandler = null;
    }

    /**
     * Shows the comparison panel.
     * @param {string} userName - Name of the impersonated user
     */
    show(userName) {
        if (!this.panel) {
            this._createPanel();
        }

        this.ui.userName.textContent = userName || 'Unknown User';
        this.ui.resultsList.innerHTML = `<li class="pdt-live-empty">${Config.MESSAGES.LIVE_IMPERSONATION.waitingForActivity}</li>`;
        this._updateSummary({ totalDifferences: 0, accessDenied: 0, hiddenRecords: 0, hiddenFields: 0 });

        this.panel.style.display = 'flex';
        this.isVisible = true;
        this.isMinimized = false;
        this._updateMinimizeState();

        LiveImpersonationService.onComparisonUpdate = (results) => this._updateResults(results);
    }

    /**
     * Hides the comparison panel.
     */
    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
        }
        this.isVisible = false;
        LiveImpersonationService.onComparisonUpdate = null;
    }

    /**
     * Destroys the panel and cleans up.
     */
    destroy() {
        this.hide();
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        this.panel = null;
        this.ui = {};
    }

    /**
     * Creates the floating panel DOM structure.
     * @private
     */
    _createPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'pdt-live-comparison-panel';
        this.panel.className = 'pdt-live-panel';
        this.panel.innerHTML = `
            <div class="pdt-live-header" id="pdt-live-header">
                <div class="pdt-live-header-left">
                    <div class="pdt-live-title">
                        <span>${Config.MESSAGES.LIVE_IMPERSONATION.panelTitle}</span>
                    </div>
                    <div class="pdt-live-user">
                        ${Config.MESSAGES.LIVE_IMPERSONATION.viewingAs}: <strong id="pdt-live-username"></strong>
                    </div>
                </div>
                <div class="pdt-live-controls">
                    <button id="pdt-live-minimize" class="pdt-live-btn" title="${Config.MESSAGES.LIVE_IMPERSONATION.minimize}">−</button>
                    <button id="pdt-live-stop" class="pdt-live-btn pdt-live-btn-stop" title="${Config.MESSAGES.LIVE_IMPERSONATION.stopButton}">${Config.MESSAGES.LIVE_IMPERSONATION.stop}</button>
                </div>
            </div>
            <div class="pdt-live-body" id="pdt-live-body">
                <div class="pdt-live-summary">
                    <div class="pdt-live-stat">
                        <span class="pdt-live-stat-value" id="pdt-live-total">0</span>
                        <span class="pdt-live-stat-label">${Config.MESSAGES.LIVE_IMPERSONATION.differences}</span>
                    </div>
                    <div class="pdt-live-stat pdt-live-stat-error">
                        <span class="pdt-live-stat-value" id="pdt-live-denied">0</span>
                        <span class="pdt-live-stat-label">${Config.MESSAGES.LIVE_IMPERSONATION.accessDenied}</span>
                    </div>
                    <div class="pdt-live-stat pdt-live-stat-warning">
                        <span class="pdt-live-stat-value" id="pdt-live-records">0</span>
                        <span class="pdt-live-stat-label">${Config.MESSAGES.LIVE_IMPERSONATION.hiddenRecords}</span>
                    </div>
                    <div class="pdt-live-stat pdt-live-stat-info">
                        <span class="pdt-live-stat-value" id="pdt-live-fields">0</span>
                        <span class="pdt-live-stat-label">${Config.MESSAGES.LIVE_IMPERSONATION.hiddenFields}</span>
                    </div>
                </div>
                <div class="pdt-live-actions">
                    <button id="pdt-live-clear" class="pdt-button pdt-button--secondary pdt-button--small">
                        ${Config.MESSAGES.LIVE_IMPERSONATION.clearResults}
                    </button>
                    <button id="pdt-live-copy" class="pdt-button pdt-button--secondary pdt-button--small">
                        ${Config.MESSAGES.LIVE_IMPERSONATION.copyReport}
                    </button>
                </div>
                <ul class="pdt-live-results" id="pdt-live-results"></ul>
            </div>
        `;

        document.body.appendChild(this.panel);

        this.ui = {
            header: this.panel.querySelector('#pdt-live-header'),
            body: this.panel.querySelector('#pdt-live-body'),
            userName: this.panel.querySelector('#pdt-live-username'),
            resultsList: this.panel.querySelector('#pdt-live-results'),
            totalStat: this.panel.querySelector('#pdt-live-total'),
            deniedStat: this.panel.querySelector('#pdt-live-denied'),
            recordsStat: this.panel.querySelector('#pdt-live-records'),
            fieldsStat: this.panel.querySelector('#pdt-live-fields'),
            minimizeBtn: this.panel.querySelector('#pdt-live-minimize'),
            stopBtn: this.panel.querySelector('#pdt-live-stop'),
            clearBtn: this.panel.querySelector('#pdt-live-clear'),
            copyBtn: this.panel.querySelector('#pdt-live-copy')
        };

        this._attachEventListeners();
    }

    /**
     * Attaches event listeners to panel controls.
     * @private
     */
    _attachEventListeners() {
        this.ui.minimizeBtn.addEventListener('click', () => {
            this.isMinimized = !this.isMinimized;
            this._updateMinimizeState();
        });

        this.ui.stopBtn.addEventListener('click', () => {
            LiveImpersonationService.stop();
            this.hide();

            const impersonateTab = ComponentRegistry.get('impersonate');
            if (impersonateTab && typeof impersonateTab._updateLiveButtonState === 'function') {
                impersonateTab._updateLiveButtonState(false);
            }
        });

        this.ui.clearBtn.addEventListener('click', () => {
            LiveImpersonationService.clearResults();
        });

        this.ui.copyBtn.addEventListener('click', () => {
            this._copyReport();
        });

        this._makeDraggable();
    }

    /**
     * Makes the panel draggable by its header.
     * @private
     */
    _makeDraggable() {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        this.ui.header.style.cursor = 'move';

        this.ui.header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') {
                return;
            }

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = this.panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;

            this.panel.style.transition = 'none';
        });

        this._dragHandler = (e) => {
            if (!isDragging) {
                return;
            }

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            const newLeft = Math.max(0, Math.min(window.innerWidth - 100, startLeft + deltaX));
            const newTop = Math.max(0, Math.min(window.innerHeight - 50, startTop + deltaY));

            this.panel.style.left = `${newLeft}px`;
            this.panel.style.top = `${newTop}px`;
            this.panel.style.right = 'auto';
            this.panel.style.bottom = 'auto';
        };

        this._dragEndHandler = () => {
            isDragging = false;
            this.panel.style.transition = '';
        };

        document.addEventListener('mousemove', this._dragHandler);
        document.addEventListener('mouseup', this._dragEndHandler);
    }

    /**
     * Updates the minimize/expand state.
     * @private
     */
    _updateMinimizeState() {
        if (this.isMinimized) {
            this.ui.body.style.display = 'none';
            this.ui.minimizeBtn.textContent = '+';
            this.ui.minimizeBtn.title = Config.MESSAGES.LIVE_IMPERSONATION.expand;
        } else {
            this.ui.body.style.display = 'block';
            this.ui.minimizeBtn.textContent = '−';
            this.ui.minimizeBtn.title = Config.MESSAGES.LIVE_IMPERSONATION.minimize;
        }
    }

    /**
     * Updates the summary statistics.
     * @param {Object} summary - Summary object from service
     * @private
     */
    _updateSummary(summary) {
        this.ui.totalStat.textContent = summary.totalDifferences;
        this.ui.deniedStat.textContent = summary.accessDenied;
        this.ui.recordsStat.textContent = summary.hiddenRecords;
        this.ui.fieldsStat.textContent = summary.hiddenFields;
    }

    /**
     * Updates the results list.
     * @param {ComparisonResult[]} results - Array of comparison results
     * @private
     */
    _updateResults(results) {
        this._updateSummary(LiveImpersonationService.getSummary());

        if (results.length === 0) {
            this.ui.resultsList.innerHTML = `<li class="pdt-live-empty">${Config.MESSAGES.LIVE_IMPERSONATION.noDifferencesYet}</li>`;
            return;
        }

        this.ui.resultsList.innerHTML = results.map(result => this._renderResultItem(result)).join('');
    }

    /**
     * Renders a single result item.
     * @param {ComparisonResult} result - The comparison result
     * @returns {string} HTML string
     * @private
     */
    _renderResultItem(result) {
        const time = result.timestamp.toLocaleTimeString();
        const entity = escapeHtml(result.entityName);

        let icon, typeClass, details;
        const hiddenCount = result.hiddenCount > 0 ? result.hiddenCount : result.hiddenRecords.length;

        if (!result.userCanAccess) {
            icon = '🚫';
            typeClass = 'pdt-live-item-error';
            details = `<span class="pdt-live-error">${escapeHtml(result.error || Config.MESSAGES.LIVE_IMPERSONATION.noAccess)}</span>`;
        } else if (hiddenCount > 0) {
            icon = '📋';
            typeClass = 'pdt-live-item-warning';
            // Show total count difference if available
            if (result.adminCount !== null && result.userCount !== null) {
                details = `<span class="pdt-live-warning">${hiddenCount} ${Config.MESSAGES.LIVE_IMPERSONATION.recordsHidden} (${result.userCount}/${result.adminCount})</span>`;
            } else {
                details = `<span class="pdt-live-warning">${hiddenCount} ${Config.MESSAGES.LIVE_IMPERSONATION.recordsHidden}</span>`;
            }
        } else if (result.hiddenFields.length > 0) {
            icon = '🔒';
            typeClass = 'pdt-live-item-info';
            const fieldsList = result.hiddenFields.slice(0, 5).map(f => escapeHtml(f)).join(', ');
            const more = result.hiddenFields.length > 5 ? ` +${result.hiddenFields.length - 5} more` : '';
            details = `<span class="pdt-live-info">${Config.MESSAGES.LIVE_IMPERSONATION.fieldsHidden}: ${fieldsList}${more}</span>`;
        } else {
            icon = '⚠️';
            typeClass = 'pdt-live-item-warning';
            details = `<span class="pdt-live-warning">${Config.MESSAGES.LIVE_IMPERSONATION.unknownDifference}</span>`;
        }

        return `
            <li class="pdt-live-item ${typeClass}" title="${escapeHtml(result.fullUrl)}">
                <span class="pdt-live-item-icon">${icon}</span>
                <div class="pdt-live-item-content">
                    <div class="pdt-live-item-header">
                        <span class="pdt-live-item-entity">${entity}</span>
                        <span class="pdt-live-item-time">${time}</span>
                    </div>
                    <div class="pdt-live-item-url">${escapeHtml(result.url)}</div>
                    <div class="pdt-live-item-details">${details}</div>
                </div>
            </li>
        `;
    }

    /**
     * Copies a formatted report to clipboard.
     * @private
     */
    _copyReport() {
        const results = LiveImpersonationService.comparisonResults;
        const summary = LiveImpersonationService.getSummary();
        const userName = LiveImpersonationService.impersonatedUserName;

        let report = 'Live Impersonation Report\n';
        report += '========================\n';
        report += `User: ${userName}\n`;
        report += `Generated: ${new Date().toISOString()}\n\n`;
        report += 'Summary:\n';
        report += `- Total Differences: ${summary.totalDifferences}\n`;
        report += `- Access Denied: ${summary.accessDenied}\n`;
        report += `- Hidden Records: ${summary.hiddenRecords}\n`;
        report += `- Hidden Fields: ${summary.hiddenFields}\n\n`;
        report += 'Details:\n';
        report += '---------\n';

        results.forEach((result, index) => {
            report += `\n${index + 1}. ${result.entityName} (${result.timestamp.toLocaleTimeString()})\n`;
            report += `   URL: ${result.url}\n`;

            const hiddenCount = result.hiddenCount > 0 ? result.hiddenCount : result.hiddenRecords.length;

            if (!result.userCanAccess) {
                report += `   Status: ACCESS DENIED - ${result.error}\n`;
            } else if (hiddenCount > 0) {
                if (result.adminCount !== null && result.userCount !== null) {
                    report += `   Hidden Records: ${hiddenCount} (User sees ${result.userCount} of ${result.adminCount})\n`;
                } else {
                    report += `   Hidden Records: ${hiddenCount}\n`;
                }
                if (result.hiddenRecords.length > 0) {
                    report += `   Sample Record IDs: ${result.hiddenRecords.slice(0, 10).join(', ')}${result.hiddenRecords.length > 10 ? '...' : ''}\n`;
                }
            } else if (result.hiddenFields.length > 0) {
                report += `   Hidden Fields: ${result.hiddenFields.join(', ')}\n`;
            }
        });

        copyToClipboard(report, Config.MESSAGES.LIVE_IMPERSONATION.reportCopied);
    }
}

export const LiveComparisonPanel = new LiveComparisonPanelClass();
