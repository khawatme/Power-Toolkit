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
                        <strong>Documentation:</strong>${StringHelpers.createExternalLink('https://github.com/khawatme/Power-Toolkit/blob/main/docs/USER-GUIDE.md', 'Read the User Guide')}
                        <strong>Report Issue:</strong>${StringHelpers.createExternalLink('https://github.com/khawatme/Power-Toolkit/issues/new/choose', 'Submit a Bug Report')}
                    </div>
                </div>
            </section>

            <section class="pdt-card mt-15" aria-label="What's New">
                <header class="pdt-card-header">
                    <span class="pdt-card-emoji" aria-hidden="true">🆕</span> What's New in ${Config.TOOL_VERSION}
                </header>
                <div class="pdt-card-body">
                    ${this._buildChangelogHtml()}
                </div>
            </section>

            <div class="pdt-about-footer">
                <button id="view-license-btn" class="modern-button secondary">View License</button>
            </div>
        `;
        return container;
    }

    /**
     * Builds the changelog HTML for the What's New section.
     * @returns {string} The changelog HTML string.
     */
    _buildChangelogHtml() {
        return `
            ${this._buildCurrentReleaseHtml()}
            ${this._buildPreviousReleasesHtml()}
        `;
    }

    /**
     * Builds the HTML for the current release's changelog entries.
     * @returns {string} The current release changelog HTML string.
     */
    _buildCurrentReleaseHtml() {
        return `
            <p class="pdt-changelog-intro">This major release introduces the <strong>AI Workbench</strong>, rebuilds Form Automation and the Impersonate analysis, and sharpens every query and metadata tab.</p>

            <p class="pdt-changelog-group">AI Workbench <span class="pdt-badge-small">New tab</span></p>
            <ul class="pdt-changelog-list">
                <li><strong>Browse:</strong> Copilot Studio agents and workflows plus AI Builder prompts &amp; models, as solution-scoped cards with Draft/Published and Active/Inactive states, JSON export, portal deep links, and safe delete.</li>
                <li><strong>Agent dialog:</strong> Instructions &amp; model, an orchestration map of connected agents, grouped components, activity with publish readiness, readable transcripts, and the configuration JSON — editable with Save &amp; Publish for unmanaged agents.</li>
                <li><strong>Prompt editor:</strong> Edit a prompt as plain text with <code>{token}</code> placeholders intact, grouped settings, and one-click Test reporting finish reason, token breakdown, and AI Builder/Copilot credits.</li>
                <li><strong>Model versions:</strong> Every configuration iteration listed newest-first with a Live marker, and a failed training run shown with its error instead of a blank panel.</li>
                <li><strong>Template library:</strong> 200+ copy-ready Copilot Studio scaffolds with placeholder filling and problem-language search.</li>
                <li><strong>Instruction generator &amp; review:</strong> Compose an instruction set from 60+ role presets, or check existing instructions against Microsoft's guidance.</li>
                <li><strong>Cross-agent search:</strong> One box across every agent's component names, descriptions, and full instructions.</li>
            </ul>

            <p class="pdt-changelog-group">Power Automate Flows</p>
            <ul class="pdt-changelog-list">
                <li>Visual <code>runAfter</code> editor with status toggles, add/remove predecessors, and cycle-safe arrows.</li>
                <li>Run history — status, trigger, duration, per-action logs, success rate, and auto-refresh.</li>
                <li>Copilot Studio workflows get an <em>Agent flow</em> badge and open in Copilot Studio.</li>
                <li>Complex inputs such as <code>variables</code> arrays are editable field-by-field in visual mode.</li>
            </ul>

            <p class="pdt-changelog-group">Metadata Browser</p>
            <ul class="pdt-changelog-list">
                <li>Column Details now shows <strong>choice options</strong> and <strong>lookup targets</strong>, including polymorphic lookups such as <code>customerid</code> and <code>ownerid</code>.</li>
                <li>A Key Facts summary at the top, and copyable option and target labels.</li>
                <li>Fixed dialog sizing, nested scrollbars, and searching straight after pasting a name.</li>
            </ul>

            <p class="pdt-changelog-group">FetchXML Tester</p>
            <ul class="pdt-changelog-list">
                <li>Columns are detected as you type or paste, not only when picked from the dialog.</li>
                <li>Correct link-entity output for <code>exists</code>, <code>in</code>, and cross-apply link types.</li>
                <li>Aggregate, alias-clash, and link-limit errors are explained in plain language.</li>
                <li>Changing a join's table keeps the joins below it in sync.</li>
            </ul>

            <p class="pdt-changelog-group">WebAPI Explorer</p>
            <ul class="pdt-changelog-list">
                <li><strong>Date filters without guessing a time:</strong> Dataverse date functions — On, OnOrAfter, Today, This Month, Last X Days and more.</li>
                <li>Field values keep their type, so <code>123</code> and <code>null</code> stay text on a text column.</li>
                <li><strong>Get Count</strong> reports the true total instead of stopping at Top Count.</li>
                <li><strong>Current record:</strong> on a form, one button under GET fills in the table you are looking at and filters it to that record's id — the table's real primary key, read from metadata.</li>
                <li>Bulk update and delete refuse to run on an incomplete filter that would match every record.</li>
                <li>File uploads continue past a failure and name the file that failed.</li>
            </ul>

            <p class="pdt-changelog-group">Impersonate</p>
            <ul class="pdt-changelog-list">
                <li><strong>Quick Check:</strong> one button summarising what the impersonated user would get on the page you're on — table privileges, the form they'd actually open, columns field security hides, record access, the apps they can open by name, and role-scoped views. Works on forms and lists, and never touches the page.</li>
                <li><strong>Impersonation now covers writes it previously missed:</strong> paging, Custom API execution and file upload silently ran as you; page 2 of a result set could come from a different user than page 1.</li>
                <li>Command differences that depend on custom JavaScript or Power Fx are reported as "Cannot be determined" instead of "Same".</li>
                <li>Analyze Security and Compare Commands can no longer overlap and overwrite each other's results.</li>
                <li><strong>No more lock-out:</strong> the user search runs as you, so impersonating a user who can't read the user table no longer 403s every attempt to switch away.</li>
                <li>Search matches email and sign-in name, not just full name; a GUID matches the user or Entra object id.</li>
                <li><strong>Entity privileges are correct:</strong> read straight from table metadata and the platform's own privilege check, so admin and team-inherited access is reported instead of "No Access".</li>
                <li>A privilege that can't be read shows as Unknown rather than denied.</li>
                <li>Picking a user with no security roles warns you up front.</li>
                <li>Selecting a different user clears the previous user's analysis.</li>
            </ul>

            <p class="pdt-changelog-group">Plugin Traces</p>
            <ul class="pdt-changelog-list">
                <li>Outcome filter — All, Errors only, or Success only — applied server-side.</li>
                <li><strong>Change the logging level without leaving the tab:</strong> the banner now carries a <strong>Logging level</strong> dropdown — Off, Exception, or All — that writes the environment setting. Needs write access to the Organization table, and applies to plug-ins that run after it.</li>
            </ul>

            <p class="pdt-changelog-group">Form Automation</p>
            <ul class="pdt-changelog-list">
                <li><strong>The <code>formjson</code> reader actually reads now:</strong> Dataverse wraps every collection as <code>{"$type", "$values"}</code> and names the handler list <code>EventHandlers</code>, so the JSON side of the parser had been matching nothing at all since it was added. Handlers that live only in <code>formjson</code> were invisible.</li>
                <li><strong>Quick View, Quick Create and Card forms are included</strong> — previously only Main forms were read, so handlers on every other form kind were missing entirely.</li>
                <li><strong>Every handler names the form it lives on</strong>, and a script shared by several forms is listed once with the count instead of being merged into an anonymous pile.</li>
                <li><strong>Script libraries are found:</strong> the parser looked for elements that don't exist in the FormXML schema; it now reads <code>&lt;formLibraries&gt;</code>, where forms actually declare their JavaScript — each with a button that opens it in the web resource editor.</li>
                <li><strong>A function registered on two events is no longer swallowed:</strong> deduplication ignored the event, so the same function on OnLoad and OnSave showed up only once.</li>
                <li><strong>Honest badges:</strong> <em>Managed</em>/<em>Custom</em> became <em>System</em>/<em>Form</em> — the form definition records who registered a handler, not which solution it came from.</li>
                <li>A handler with no explicit <code>enabled</code> attribute is no longer shown as disabled.</li>
                <li>OnChange handlers are attributed to the column the event names, and a handler whose event can't be identified is listed under Other instead of being dropped.</li>
                <li>A note reports which forms were scanned, so "no handlers" says what it actually checked.</li>
            </ul>

            <p class="pdt-changelog-group">Performance</p>
            <ul class="pdt-changelog-list">
                <li><strong>Performance Review:</strong> the form is checked against Microsoft's published guidance instead of the toolkit's own opinions, and every finding <strong>links to the Microsoft Learn page behind it</strong>.</li>
                <li><strong>Scan form scripts:</strong> reads the table's unmanaged form libraries and adds the client-scripting rules — synchronous requests, <code>window.top</code>, the OData v2.0 endpoint, leftover <code>console</code> calls, new windows, and uncleaned timers or listeners.</li>
                <li>Until the scan runs, the script rules are <strong>skipped rather than passed</strong>, and the all-clear says how many rules actually ran.</li>
            </ul>

            <p class="pdt-changelog-group">Code Hub</p>
            <ul class="pdt-changelog-list">
                <li>Twelve new Client API snippets, including <strong>generative pages</strong>, <code>Xrm.App</code> side panes and global notifications, save-mode detection for blocking auto-save, <code>addOnLoad</code>, and FetchXML through <code>Xrm.WebApi</code>.</li>
                <li>Every snippet re-checked against the Microsoft Learn Client API reference.</li>
            </ul>

            <p class="pdt-changelog-group">Settings</p>
            <ul class="pdt-changelog-list">
                <li><strong>Give a tab its own color:</strong> each row in Tab Configuration has a color swatch. The tab then carries that color as an edge bar and a tinted icon in the navigation, so the one you reach for constantly is findable at a glance. Colors travel with <strong>Export</strong> / <strong>Import Settings</strong> and clear with <strong>Reset All Settings</strong>.</li>
            </ul>

            <p class="pdt-changelog-group">Across all tabs</p>
            <ul class="pdt-changelog-list">
                <li>Real server error messages instead of bare HTTP codes, with the stack-trace noise stripped.</li>
            </ul>
        `;
    }

    /**
     * Builds the HTML for all previous release entries in a collapsible section.
     * @returns {string} The previous releases changelog HTML string.
     */
    _buildPreviousReleasesHtml() {
        return `
            <details class="pdt-changelog-details">
                <summary><strong> Previous Releases</strong></summary>
                <div class="pdt-changelog-previous-releases">
                    <details class="pdt-changelog-version">
                        <summary><strong>Version 4.3.0</strong></summary>
                        <ul class="pdt-changelog-list">
                            <li><strong>Custom API Manager (New Tab):</strong> Full lifecycle management for Dataverse Custom APIs scoped by solution. Browse all APIs in a card grid with expandable parameters and response properties. Create new APIs with deep-insert of parameters/properties in a single request. Edit and delete unmanaged APIs directly from the browser.</li>
                            <li><strong>Custom API Tester:</strong> Select any Custom API to auto-populate the correct HTTP method, endpoint URL (Global, Entity-bound, Collection-bound), and type-aware parameter inputs. Add custom request headers, execute the API, and inspect the response — status, timing, size, body (JSON/XML/Raw), and headers — each with one-click copy.</li>
                            <li><strong>Code Generation (4 Languages):</strong> Instantly generate ready-to-use code snippets for any Custom API in JavaScript (fetch), C# (SDK), raw HTTP, and Power Automate action JSON formats.</li>
                            <li><strong>Export / Import:</strong> Export a Custom API definition (including all parameters and response properties) as a portable JSON file and import it into any other environment.</li>
                            <li><strong>Execution History:</strong> The last 20 API executions are tracked with method, status code, and elapsed time. Click any entry to re-populate the tester.</li>
                        </ul>
                    </details>
                    <details class="pdt-changelog-version">
                        <summary><strong>Version 4.2.2</strong></summary>
                        <ul class="pdt-changelog-list">
                            <li><strong>Form Inspector Fix (CSS Isolation):</strong> Fixed the Form Inspector tab showing only arrows without data on Email, Template, and other forms that load the RichTextEditor control. Host page CSS no longer interferes with the tree view.</li>
                            <li><strong>Safari CSS Compatibility:</strong> Added <code>-webkit-user-select</code> prefix across all stylesheets for full Safari and iOS Safari support.</li>
                        </ul>
                    </details>
                    <details class="pdt-changelog-version">
                        <summary><strong>Version 4.2.1</strong></summary>
                        <ul class="pdt-changelog-list">
                            <li><strong>FormJSON Handler Parsing (Form Automation):</strong> Form Automation now reads handlers from the modern <code>formjson</code> column, fixing missing handlers on forms created with the new Power Apps form designer.</li>
                            <li><strong>Managed/Custom Badges (Form Automation):</strong> Each event handler now displays a <em>Managed</em> or <em>Custom</em> badge, making it easy to distinguish system handlers from customizable ones.</li>
                            <li><strong>Handler Deduplication (Form Automation):</strong> Duplicate handlers across formxml and formjson sources are automatically merged.</li>
                            <li><strong>(Form Columns):</strong> Fixed a crash when opening the Form Columns tab after impersonating a user.</li>
                        </ul>
                    </details>
                    <details class="pdt-changelog-version">
                        <summary><strong>Version 4.2.0</strong></summary>
                        <ul class="pdt-changelog-list">
                            <li><strong>Power Automate Flows Tab:</strong> New tab to browse, activate/deactivate, delete, and open cloud flows directly from the toolkit with solution-based filtering and flow visualization.</li>
                            <li><strong>Web Resource Editing (Automation):</strong> Form event handlers in the Automation tab now allow editing web resources directly, enabling quick script updates without leaving the toolkit.</li>
                            <li><strong>Aggregate Queries (FetchXML):</strong> Build aggregate queries with count, sum, avg, min, max using the aggregate and groupby options.</li>
                            <li><strong>FetchXML Converter:</strong> Convert FetchXML to C# QueryExpression, JavaScript Xrm, OData, SQL, Power Automate, and Web API URL formats.</li>
                            <li><strong>Open Record Button:</strong> Result tables in FetchXML Tester and WebAPI Explorer now include an Open button to navigate directly to records.</li>
                            <li><strong>Record Selection (FetchXML):</strong> Select specific records from FetchXML results for export or touch operations.</li>
                            <li><strong>In Operator Fix (FetchXML):</strong> The "In" operator now correctly generates separate value elements for comma-separated values.</li>
                            <li><strong>Case-Insensitive Entity/Column Names:</strong> FetchXML and WebAPI Explorer now auto-resolve PascalCase names to correct logical names, preventing errors with mixed-case input.</li>
                            <li><strong>Solution Layers – Plugin Packages:</strong> Solution Layers tab now displays unmanaged layers for plugin packages.</li>
                        </ul>
                    </details>
                    <details class="pdt-changelog-version">
                        <summary><strong>Version 4.1.0</strong></summary>
                        <ul class="pdt-changelog-list">
                            <li>Firefox Extension: Cross-browser support with Firefox add-on alongside Chrome and Edge.</li>
                            <li>Browser API Abstraction: Unified browser extension API layer for seamless Chrome/Edge/Firefox compatibility.</li>
                        </ul>
                    </details>
                    <details class="pdt-changelog-version">
                        <summary><strong>Version 4.0.0</strong></summary>
                        <ul class="pdt-changelog-list">
                            <li>Server-Side Pagination: Handle 5000+ record queries with automatic pagination in both WebAPI Explorer and FetchXML Tester.</li>
                            <li>Smart Value Inputs: Auto-detect attribute types (boolean dropdowns, picklists, date pickers, lookups) for easier query building.</li>
                            <li>Filter Group Manager: Build complex queries with multiple filter groups using AND/OR/NOT logic.</li>
                            <li>Bulk Operations (WebAPI): Update, delete, or touch multiple records at once with progress tracking.</li>
                            <li>File Upload Service: Upload files to Dataverse file columns with chunked upload support.</li>
                            <li>Field Builder Mode (WebAPI): Visual field editor as an alternative to JSON mode for POST/PATCH.</li>
                            <li>Nested Joins (FetchXML): Build multi-level relationship chains with parent-child join management.</li>
                            <li>Show Logical Names: Inspector button to display and copy logical names for form elements.</li>
                            <li>Advanced Security Analysis (Impersonate): Deep-dive into user permissions with role comparison, field security profiles, and privilege analysis.</li>
                            <li>Command Bar Visibility Comparison (Impersonate): Compare command bar buttons between users to troubleshoot permissions.</li>
                            <li>Comprehensive Testing: Full test coverage with Vitest framework.</li>
                        </ul>
                    </details>
                    <details class="pdt-changelog-version">
                        <summary><strong>Version 3.0.0</strong></summary>
                        <ul class="pdt-changelog-list">
                            <li>Solution Layers Tab: New tab to view and manage solution components with active customizations.</li>
                            <li>Resizable Table Columns: All data tables now support column resizing.</li>
                            <li>Enhanced Form Inspection: Improved form context detection and better handling of form-only features.</li>
                            <li>Performance Improvements: Faster tab switching and better memory management.</li>
                        </ul>
                    </details>
                    <details class="pdt-changelog-version">
                        <summary><strong>Version 2.1.0</strong></summary>
                        <ul class="pdt-changelog-list">
                            <li>Minimize/Restore: Minimize button added to header, double-click header or press Ctrl/Cmd+M to minimize.</li>
                            <li>Metadata Browser: Click column headers to sort tables by Display Name or Logical Name.</li>
                            <li>Performance: Improved memory management and faster tab switching.</li>
                        </ul>
                    </details>
                    <details class="pdt-changelog-version">
                        <summary><strong>Version 2.0.0</strong></summary>
                        <ul class="pdt-changelog-list">
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
        `;
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