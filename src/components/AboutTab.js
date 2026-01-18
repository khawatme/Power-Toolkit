/**
 * @file About component.
 * @module components/AboutTab
 * @description Displays information about the Power-Toolkit, its author, and the license.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { Config } from '../constants/index.js';
import { DialogService } from '../services/DialogService.js';
import { StringHelpers } from '../helpers/index.js';

/**
 * A component that displays information about the application, including
 * version, author, and license details.
 * @extends {BaseComponent}
 */
export class AboutTab extends BaseComponent {
    /**
     * Initializes the AboutTab component, setting its ID, title, and icon.
     */
    constructor() {
        super('about', 'About', ICONS.about);

        // Handler reference for cleanup
        /** @private {Function|null} */ this._licenseBtnHandler = null;
        /** @private {HTMLElement|null} */ this._licenseBtn = null;
    }

    /**
     * Renders the component's static HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    // eslint-disable-next-line require-await
    async render() {
        const container = document.createElement('div');

        container.innerHTML = `
            <div class="section-title">About Power-Toolkit</div>
            
            <section class="pdt-card mt-15" aria-label="Application Info">
                <header class="pdt-card-header">
                    <span class="pdt-card-emoji" aria-hidden="true">⚡</span> Application
                </header>
                <div class="pdt-card-body">
                    <div class="pdt-about-app-info">
                        <h2 class="pdt-about-title"><span>Power</span>-Toolkit</h2>
                        <p class="pdt-about-version">Version ${Config.TOOL_VERSION}</p>
                        <p class="pdt-about-description">
                            A comprehensive developer toolkit for Microsoft Power Platform. Streamline your development workflow with advanced debugging, inspection, and productivity tools.
                        </p>
                    </div>
                </div>
            </section>

            <section class="pdt-card mt-15" aria-label="Developer Info">
                <header class="pdt-card-header">
                    <span class="pdt-card-emoji" aria-hidden="true">👨‍💻</span> Developer
                </header>
                <div class="pdt-card-body">
                    <div class="info-grid">
                        <strong>Author:</strong><span>${StringHelpers.escapeHtml(Config.DEVELOPER_NAME)}</span>
                        <strong>LinkedIn:</strong>${StringHelpers.createExternalLink('https://linkedin.com/in/khawatme', 'Connect with Mohammed')}
                    </div>
                </div>
            </section>

            <section class="pdt-card mt-15" aria-label="Resources">
                <header class="pdt-card-header">
                    <span class="pdt-card-emoji" aria-hidden="true">📚</span> Resources
                </header>
                <div class="pdt-card-body">
                    <div class="info-grid">
                        <strong>GitHub:</strong>${StringHelpers.createExternalLink('https://github.com/khawatme/Power-Toolkit', 'View on GitHub')}
                        <strong>Documentation:</strong>${StringHelpers.createExternalLink('https://github.com/khawatme/Power-Toolkit#readme', 'Read the Docs')}
                        <strong>Report Issue:</strong>${StringHelpers.createExternalLink('https://github.com/khawatme/Power-Toolkit/issues/new', 'Submit a Bug Report')}
                    </div>
                </div>
            </section>

            <section class="pdt-card mt-15" aria-label="What's New">
                <header class="pdt-card-header">
                    <span class="pdt-card-emoji" aria-hidden="true">🆕</span> What's New in ${Config.TOOL_VERSION}
                </header>
                <div class="pdt-card-body">
                    <ul class="pdt-changelog-list">
                        <li><strong>Server-Side Pagination:</strong> Handle 5000+ record queries with automatic pagination in both WebAPI Explorer and FetchXML Tester. Load more incrementally or fetch all records at once.</li>
                        <li><strong>Smart Value Inputs:</strong> Intelligent input controls that auto-detect attribute types (boolean dropdowns, picklists, date pickers, lookups) for easier query building.</li>
                        <li><strong>Filter Group Manager:</strong> Build complex queries with multiple filter groups using AND/OR/NOT logic across WebAPI and FetchXML tabs.</li>
                        <li><strong>Bulk Operations (WebAPI):</strong> Update, delete, or touch multiple records at once with filter conditions and progress tracking.</li>
                        <li><strong>File Upload Service:</strong> Upload files to Dataverse file columns with chunked upload support for files of any size.</li>
                        <li><strong>Field Builder Mode (WebAPI):</strong> Visual field editor as an alternative to JSON mode for POST/PATCH operations with auto-populated required fields.</li>
                        <li><strong>Nested Joins (FetchXML):</strong> Build multi-level relationship chains with parent-child join management.</li>
                        <li><strong>Show Logical Names:</strong> New Inspector button to display logical names for tabs, sections, and controls directly on forms with click-to-copy functionality.</li>
                        <li><strong>Advanced Security Analysis (Impersonate):</strong> Deep-dive into user permissions with security role comparison, field security profiles, privilege analysis, and business unit hierarchy visualization to troubleshoot access issues.</li>
                        <li><strong>Command Bar Visibility Comparison (Impersonate):</strong> Analyze and compare which command bar buttons are visible between different users to troubleshoot permission issues on forms and grids.</li>
                        <li><strong>Comprehensive Testing:</strong> Full test coverage with Vitest framework ensuring code quality and reliability.</li>
                    </ul>
                    <details class="pdt-changelog-details" style="cursor: pointer;">
                        <summary style="cursor: pointer; user-select: none;"><strong> Previous Releases</strong></summary>
                        <div style="margin-top: 1rem;">
                            <details class="pdt-changelog-details" style="cursor: pointer; margin-left: 1rem;">
                                <summary style="cursor: pointer; user-select: none;"><strong>Version 3.0.0</strong></summary>
                                <ul class="pdt-changelog-list" style="margin-top: 0.5rem;">
                                    <li>Solution Layers Tab: New tab to view and manage solution components with active customizations.</li>
                                    <li>Resizable Table Columns: All data tables now support column resizing.</li>
                                    <li>Enhanced Form Inspection: Improved form context detection and better handling of form-only features.</li>
                                    <li>Performance Improvements: Faster tab switching and better memory management.</li>
                                </ul>
                            </details>
                            <details class="pdt-changelog-details" style="cursor: pointer; margin-left: 1rem; margin-top: 0.5rem;">
                                <summary style="cursor: pointer; user-select: none;"><strong>Version 2.1.0</strong></summary>
                                <ul class="pdt-changelog-list" style="margin-top: 0.5rem;">
                                    <li>Minimize/Restore: Minimize button added to header, double-click header or press Ctrl/Cmd+M to minimize.</li>
                                    <li>Metadata Browser: Click column headers to sort tables by Display Name or Logical Name.</li>
                                    <li>Performance: Improved memory management and faster tab switching.</li>
                                </ul>
                            </details>
                            <details class="pdt-changelog-details" style="cursor: pointer; margin-left: 1rem; margin-top: 0.5rem;">
                                <summary style="cursor: pointer; user-select: none;"><strong>Version 2.0.0</strong></summary>
                                <ul class="pdt-changelog-list" style="margin-top: 0.5rem;">
                                    <li>Environment Variables: Edit and save Current Values directly in addition to Default Values.</li>
                                    <li>Environment Variables: Enhanced search to include display names and types.</li>
                                    <li>Form Columns: Option set values now display as "Label (Value)" format for better clarity.</li>
                                    <li>Form Columns: Edit icons now always visible for better discoverability.</li>
                                    <li>Plugin Context: Progressive disclosure - secondary buttons appear only after generating context.</li>
                                    <li>Plugin Context: Helpful message when trying to generate Update context without changes.</li>
                                    <li>User Context: Security roles now display with their Role IDs for easy reference.</li>
                                    <li>User Context: Streamlined layout with improved information architecture.</li>
                                    <li>Result Tables: Fixed horizontal scrollbar visibility for better navigation.</li>
                                    <li>About Tab: Modern card-based design with better organization.</li>
                                </ul>
                            </details>
                        </div>
                    </details>
                </div>
            </section>

            <div class="pdt-about-footer">
                <button id="view-license-btn" class="modern-button secondary">View License</button>
            </div>
        `;
        return container;
    }

    /**
     * Attaches the 'click' event handler to the license button.
     * @param {HTMLElement} element - The root element of the component, which contains the button.
     */
    postRender(element) {
        this._licenseBtn = element.querySelector('#view-license-btn');
        this._licenseBtnHandler = () => {
            DialogService.show(Config.DIALOG_TITLES.license, `<pre class="pdt-license-text">${Config.LICENSE_TEXT}</pre>`);
        };
        if (this._licenseBtn) {
            this._licenseBtn.addEventListener('click', this._licenseBtnHandler);
        }
    }

    /**
     * Lifecycle hook for cleaning up event listeners to prevent memory leaks.
     */
    destroy() {
        if (this._licenseBtn && this._licenseBtnHandler) {
            this._licenseBtn.removeEventListener('click', this._licenseBtnHandler);
        }
    }
}