/**
 * @file Help & User Guide component.
 * @module components/HelpTab
 * @description Displays a searchable, accordion-style user guide for the toolkit's features.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { debounce, toggleElementHeight } from '../helpers/index.js';

/**
 * A UI component that displays a searchable, accordion-style user guide for the toolkit.
 * @extends {BaseComponent}
 */
export class HelpTab extends BaseComponent {
    /**
     * Initializes the HelpTab component, setting its ID, title, and icon.
     */
    constructor() {
        super('help', 'Help / Guide', ICONS.help);

        // Handler references for cleanup
        /** @private {HTMLElement|null} */ this._searchInput = null;
        /** @private {HTMLElement|null} */ this._cardContainer = null;
        /** @private {Function|null} */ this._searchHandler = null;
        /** @private {Function|null} */ this._cardClickHandler = null;
    }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    // eslint-disable-next-line require-await
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="section-title">User Guide</div>
            <div class="pdt-toolbar">
                <input type="text" id="help-search" class="pdt-input" placeholder="Search topics (e.g., 'god mode', 'logical name')...">
            </div>
            <div id="help-card-container"></div>`;
        return container;
    }

    /**
     * Attaches event listeners and populates the help content after rendering.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        this._searchInput = element.querySelector('#help-search');
        this._cardContainer = element.querySelector('#help-card-container');
        const helpContent = this._getHelpContent();

        // Dynamically create and append help cards from the content object
        for (const key in helpContent) {
            const item = helpContent[key];
            const card = document.createElement('div');
            card.className = 'help-card';
            card.dataset.topicId = key;
            card.innerHTML = `
                <h4>${item.title}</h4>
                <p>${item.summary}</p>
                <div class="help-card-details"><p>${item.content}</p></div>`;
            this._cardContainer.appendChild(card);
        }

        // Store handlers for cleanup
        this._searchHandler = debounce(() => {
            const term = this._searchInput.value.toLowerCase().trim();
            this._cardContainer.querySelectorAll('.help-card').forEach(card => {
                const cardText = card.textContent.toLowerCase();
                card.style.display = cardText.includes(term) ? 'block' : 'none';
            });
        }, 250);

        this._cardClickHandler = (e) => {
            const card = e.target.closest('.help-card');
            if (card) {
                this._toggleAccordion(card, this._cardContainer);
            }
        };

        // Attach listeners
        // 'input' rather than 'keyup' so a pasted term filters without a further keystroke.
        this._searchInput.addEventListener('input', this._searchHandler);
        this._cardContainer.addEventListener('click', this._cardClickHandler);
    }

    /**
     * Toggles the accordion state for a clicked help card.
     * @param {HTMLElement} card - The card that was clicked.
     * @param {HTMLElement} container - The parent container of all cards.
     * @private
     */
    _toggleAccordion(card, container) {
        const details = card.querySelector('.help-card-details');

        // Collapse all other expanded cards first (excluding the clicked one)
        container.querySelectorAll('.help-card.expanded').forEach(openCard => {
            if (openCard !== card) {
                openCard.classList.remove('expanded');
                const openDetails = openCard.querySelector('.help-card-details');
                if (openDetails) {
                    toggleElementHeight(openDetails);
                }
            }
        });

        // Toggle the clicked card
        card.classList.toggle('expanded');
        if (details) {
            toggleElementHeight(details);
        }
    }

    /**
     * Represents a single help topic.
     * @typedef {object} HelpTopic
     * @property {string} title - The main title of the help topic.
     * @property {string} summary - A short, one-sentence summary for the collapsed view.
     * @property {string} content - The full HTML content for the expanded view.
     */

    /**
     * Represents the entire collection of help content.
     * @typedef {Object.<string, HelpTopic>} HelpContent
     */
    _getHelpContent() {
        return {
            gettingStarted: {
                title: 'Getting Started',
                summary: 'How the toolkit runs, and which tabs need an open record form.',
                content: 'The toolkit runs entirely in your browser session. Every request it makes uses your own credentials against the environment you already have open — nothing is sent anywhere else.<br><br><strong>Moving the panel:</strong> Drag the header to reposition it, and double-click the header (or press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>M</kbd>) to minimize.<br><br><strong>Where each tab works:</strong> Five tabs read the live form context and are disabled elsewhere — <strong>Inspector</strong>, <strong>Form Columns</strong>, <strong>Event Monitor</strong>, <strong>Plugin Context</strong> and <strong>Performance</strong>. Every other tab works anywhere in the environment, including on dashboards and list views. A few features inside those tabs still light up only on a form — the <strong>Current record</strong> button in WebAPI Explorer, for example.<br><br><strong>💡 Tip:</strong> Search this guide with the box above, and reorder or hide tabs you never open under <strong>Settings</strong>.'
            },
            globalActions: {
                title: 'Global Actions (Header Buttons)',
                summary: 'Access powerful tools like Show/Hide Logical Names, God Mode, form reset, and theme toggling.',
                content: 'The header provides quick access to powerful actions.<br> <strong>Show Logical Names</strong> displays logical names as overlay badges on form tabs, sections, and controls - click any badge to copy the name.<br> <strong>Hide Logical Names</strong> removes all the logical name overlays from the form.<br> <strong>God Mode</strong> unlocks all fields, removes required validations, and makes hidden UI elements visible on the form.<br> <strong>Reset Form</strong> discards all unsaved changes by reloading the form data.<br> <strong>Refresh Tool</strong> clears the tool\'s internal cache and reloads the current tab.<br> <strong>Toggle Theme</strong> switches between light and dark mode.<br><br><strong>💡 Tip:</strong> You can customize which header buttons are visible and their order in the <strong>Settings</strong> tab under "Header Buttons".'
            },
            inspector: {
                title: 'Inspector',
                summary: 'View and edit the form\'s UI component hierarchy in real-time.',
                content: 'The Inspector provides a live, hierarchical tree view of every UI component on the current form (Tabs > Sections > Controls). Expand each level to see properties and current values. For editable fields, the value is underlined—click it to open a dialog and perform <strong>live editing</strong>. This is extremely useful for testing how the form reacts to different data inputs without having to write code.'
            },
            formColumns: {
                title: 'Form Columns',
                summary: 'A searchable table of all data columns on the form or in the record.',
                content: "This tab provides a flat table of every data column (attribute). The <strong>'Form Columns'</strong> view shows live data from the `Xrm.Page` context, allowing for real-time editing. The <strong>'Record Columns'</strong> view shows all attributes for the saved record, fetched via the Web API. You can sort, search, and hover over a row to <strong>highlight the control</strong> on the main form."
            },
            eventMonitor: {
                title: 'Event Monitor',
                summary: 'A live console that logs form events like OnLoad, OnSave, and OnChange.',
                content: "The Event Monitor is a live console that logs form events as they happen. It captures the initial Form `OnLoad`, every field's `OnChange` event (showing which field was changed), and the Form `OnSave` event. This is invaluable for debugging client-side scripts and understanding the sequence of events."
            },
            pluginContext: {
                title: 'Plugin Context',
                summary: 'Simulate the data context (Target, Pre/Post Images) sent to server-side plugins.',
                content: 'This tool simulates the data context that would be sent to a server-side plugin for `Create`, `Update`, or `Delete` operations. Based on the current form data, it generates the JSON for `InputParameters["Target"]`, `PreEntityImages["preimage"]`, and `PostEntityImages["postimage"]`. It also includes a button to generate a complete C# unit test snippet for the <strong>FakeXrmEasy</strong> framework.'
            },
            performance: {
                title: 'Performance',
                summary: 'Measure the form load, then review the form against Microsoft\'s documented performance guidance.',
                content: 'Total load time with a server / network / client breakdown, plus the form\'s composition — tabs, sections, controls, and OnChange handlers.<br><br><strong>Performance Review:</strong> Checks the form against Microsoft\'s published guidance. Each finding is graded High, Medium or Low, names what it found on this form, and links to the Microsoft Learn page behind it. Covered: the documented mobile limits (5 tabs, 75 columns, 10 subgrids), the data-driven controls on the default tab that always initialize on load, and which phase of the load dominates.<br><br><strong>Scan form scripts:</strong> Reads the table\'s unmanaged form libraries and adds the client-scripting rules — synchronous requests, <code>window.top</code>, the OData v2.0 endpoint, leftover <code>console</code> calls, new windows, and uncleaned timers or listeners. Managed libraries are skipped: you can\'t change them.<br><br><strong>💡 Tip:</strong> Until you scan, the script rules are skipped rather than passed — the all-clear says how many rules actually ran.'
            },
            automation: {
                title: 'Form Automation',
                summary: 'View, manage, and inspect Business Rules and JavaScript event handlers. Edit and upload web resource scripts directly from the toolkit.',
                content: 'The automated logic on a table.<br><br><strong>Business Rules:</strong> Every rule, active or inactive, for any table you select — Activate, Deactivate, Open, or Delete from the list, and expand one to read the JavaScript it compiles to.<br><br><strong>Form Event Handlers:</strong> The <code>OnLoad</code>, <code>OnSave</code> and <code>OnChange</code> functions from the form designer, plus anything else under <strong>Other Events</strong>. Every form type that can carry handlers is read — <strong>Main, Quick View, Quick Create and Card</strong> — and a note says which were scanned. Badges: the form a handler lives on (shared handlers show a count, hover for names), <strong>System</strong> for platform-registered vs <strong>Form</strong> for designer-added, and <strong>Off</strong> when it\'s disabled.<br><br><strong>Form Libraries:</strong> The JavaScript these forms load — useful when a library is registered but nothing from it is wired to an event.<br><br><strong>Web Resource Editor:</strong> The edit button opens a handler\'s script in a built-in editor. Unmanaged resources can be edited or replaced by dropping in a <code>.js</code> file, then <strong>Save</strong> or <strong>Save &amp; Publish</strong>. Managed and hidden ones open read-only behind a lock banner.<br><br><strong>💡 Tip:</strong> <strong>Save &amp; Publish</strong> makes a script change live without leaving the toolkit.'
            },
            powerAutomateFlows: {
                title: 'Power Automate',
                summary: 'View, manage, edit, and control Power Automate cloud flows without leaving the toolkit.',
                content: 'Lists every solution-aware <strong>cloud flow</strong> in the environment with its status, owner, and dates.<br><br><strong>Turn On/Off:</strong> Toggle a flow\'s state from its card. Managed flows are read-only.<br><strong>View / Edit Definition:</strong> Two views — <strong>Visual</strong> (triggers, actions, branches, and each step\'s clickable <strong>run-after</strong> dots: toggle conditions, add or remove predecessors, then Save/Undo) and <strong>JSON</strong> (syntax-highlighted, editable with Save for unmanaged flows).<br><strong>Run History:</strong> A sub-view (or the <strong>Runs</strong> button on a card) listing a flow\'s recent runs — colour-coded status, trigger, duration, and error details — with a success-rate summary, status filter, <strong>Live</strong> auto-refresh, and per-run portal links. Stored for solution flows only, kept ~28 days.<br><strong>Open / Delete:</strong> Open a flow in its native designer — Power Automate, or Copilot Studio for <em>Agent flows</em> — or delete unmanaged flows.<br><br><strong>💡 Tip:</strong> In Run History, filter to <em>Failed</em> and turn on <strong>Live</strong> while debugging a flow.'
            },
            agents: {
                title: 'AI Workbench',
                summary: 'Inspect and manage Copilot Studio agents and workflows, their conversation transcripts, and AI Builder models — all stored in Dataverse.',
                content: 'Everything Copilot Studio and AI Builder store in Dataverse — agents and their transcripts, plus AI Builder prompts and models — in one place (<code>bot</code>, <code>botcomponent</code>, <code>conversationtranscript</code>, <code>msdyn_aimodel</code>).'
                    + '<br><br><strong>Agents:</strong> One card per agent, each with three independent badges:<br>• <strong>Draft / Published</strong> — Copilot Studio\'s real publish status (from <code>publishedon</code>)<br>• <strong>Active / Inactive</strong> — the Dataverse record state<br>• <strong>Powered by</strong> — <strong>GitHub Copilot</strong> (modern, generative) vs <strong>Standard</strong> (classic, topic-based), from the bot <code>template</code><br>From the card: activate/deactivate, export as JSON, open in Copilot Studio, or delete (unmanaged).'
                    + '<br><br><strong>View Definition:</strong> One tabbed dialog per agent:<br>• <strong>Overview</strong> — the agent\'s instructions, editable in place for unmanaged agents whether they live in a Custom GPT component (classic) or the bot configuration (modern), plus its model<br>• <strong>Map</strong> — topics, tools, knowledge, triggers, and expandable connected agents<br>• <strong>Components</strong> — grouped and togglable; test sets show their graders and Pass/Fail labels, test cases their expected conversation<br>• <strong>Activity</strong> — lifecycle, publish readiness, and session analytics<br>• <strong>Transcripts</strong> — each conversation led by a session summary (engaged/unengaged, outcome, turn count, and a <strong>Test-pane</strong> badge for test-canvas chats), then the readable User/Agent turns; a message-less unengaged session is explained rather than left blank; kept ~30 days<br>• <strong>Configuration</strong> — the full JSON<br>Unmanaged agents are editable, saved with one footer <strong>Save &amp; Publish</strong>.'
                    + '<br><br><strong>Workflows:</strong> The environment\'s Copilot Studio workflows — toggle, edit definitions, delete (unmanaged), or open in Copilot Studio.'
                    + '<br><br><strong>Prompts &amp; Models:</strong> One card per AI Builder prompt or model, badged by <strong>family</strong> (Prompt, Custom model, Prebuilt model) and by its latest configuration\'s <strong>state</strong> (Live, Published, Draft, Training, Train failed). Each card notes whether a version is published and whether an automatic retrain is scheduled, opens the item in AI Builder, and deletes unmanaged items (with confirmation).'
                    + '<br><br><strong>Definition:</strong> A failed training run shows its parsed error, and each payload column — configuration, run configuration, data binding — is edited and saved separately.<br>• <strong>Prompts</strong> render as readable text with their grounded Dataverse columns intact.<br>• <strong>Trained models</strong> are organized like the maker portal — a <strong>Published version</strong> (the one that actually runs), the <strong>Last trained version</strong>, and older iterations under a read-only <strong>History</strong> (those can\'t be trained, published, or edited). Each shows the bound table, the predicted column, and which columns were bound, plus a <strong>Model performance</strong> panel: an accuracy gauge with the per-category precision / recall / F1 metrics and a <strong>Download detailed metrics</strong> export.'
                    + '<br><br><strong>Editing a prompt:</strong> Only the <strong>live</strong> version is editable; older versions collapse into <strong>Version history</strong>, mirroring AI Builder — you publish a new version rather than edit a past one. Two tabs edit the <em>same</em> live configuration and stay in sync:<br>• <strong>Prompt</strong> — the prompt as plain, editable text. Words in <code>{braces}</code> are inputs (Dataverse columns and formulas the model fills in) and stay intact as you reword around them. An <strong>Advanced</strong> disclosure exposes the raw JSON; a code-interpreter prompt also shows its generated Python read-only.<br>• <strong>Settings</strong> — the tuning options (temperature, content moderation, record-retrieval limit, response links, code interpreter), each with a one-line description.<br>One footer <strong>Save</strong> persists both tabs together, staying disabled until something changes, with <strong>Undo</strong> alongside. <strong>Save as</strong> copies the prompt under a new name as an independent model.'
                    + '<br><br><strong>Test (prompts):</strong> Run the prompt without changing it. Each run is kept as a row in a log, newest first, so you can compare outputs as you tweak the wording. If the prompt declares <strong>input variables</strong>, a field appears for each — fill them in and the run uses those values, exactly as a live request would. Every result shows:<br>• the output and its media type<br>• the exact LLM build that answered, and the finish reason<br>• the token breakdown and both AI Builder and Copilot credits it cost<br>• any grounding records it read, under <strong>Data used</strong><br>A code-interpreter run also reveals the generated Python, its logs and plan; a plain reasoning run shows its thought steps instead. Once a run has generated code, <strong>Test without regenerating</strong> re-runs that exact code — faster and deterministic — instead of asking the model to write it again.'
                    + '<br><br><strong>Working with a trained model:</strong> Each version carries the maker-portal actions, all kept inside the dialog:<br>• <strong>Train / Retrain</strong> — start training and watch the status until it settles as Trained or Train failed. A trained iteration can\'t be retrained in place, so <strong>Retrain</strong> clones a fresh training iteration and starts it (an untrained draft simply trains).<br>• <strong>Quick test</strong> — run the model on sample text inline. Each run is kept as a row with its predictions and confidence; an output the toolkit doesn\'t recognize is shown as-is rather than reported as empty.<br>• <strong>Publish / Unpublish</strong> — publish the last-trained version, or unpublish the live one. Only one version can be live at a time, so <strong>Publish</strong> appears only once nothing is published.'
                    + '<br><br><strong>Runs:</strong> Recent executions (quick tests and automation) with their output — and, when the run recorded one, the input it executed against — plus the LLM model, units and credit cost, a usage summary, and a 14-day trend.'
                    + '<br><br><strong>Evaluations:</strong> The AI Builder <strong>Test hub</strong> for the prompt — the same data the maker portal shows:<br>• <strong>Evaluation criteria</strong> — the passing score and which prebuilt checks apply (expected response, exact or semantic; response quality; JSON correctness). Its button opens an editor to set the passing score (1–100%) and toggle the checks.<br>• <strong>Latest run</strong> — a card summarizing the newest batch: cases, average accuracy, pass count, duration, model.<br>• <strong>Test cases</strong> — each saved case with its expected output, <strong>editable in place</strong>; select one, several, or all to <strong>Run</strong> or <strong>delete</strong> (or Run all / Delete all), and expand a case for its input variables.<br>• <strong>Run</strong> — executes the prompt against each case just like the maker portal: it predicts the answer, then grades it against the criteria (semantic similarity and response quality via the same server-side grader; exact-match and JSON checks computed locally) and writes back a scored batch. It runs directly — no confirmation, with progress shown in place — and calls the model, so it uses AI Builder credits.<br>• <strong>Run history</strong> — every batch, newest first, each row showing case count, average accuracy, and pass count; expand one for per-case <strong>expected vs actual</strong> output, a <strong>Pass/Fail</strong> against the passing score, the accuracy score, and the model and tokens used.'
                    + '<br><br><strong>Templates:</strong> A three-part authoring workbench, all of it scoped by one <strong>Agent type</strong> control in the header — Microsoft\'s guidance genuinely differs between <strong>Classic</strong> (topic-based) and <strong>Modern</strong> (instructions-first, the new experience), and selecting an agent picks the matching type for you (you can always change it).<br>• <strong>Library</strong> — 200+ copy-ready scaffolds, sub-categorized (instructions by industry, patterns, orchestration, topics, tools including MCP, knowledge, guardrails, evaluation test sets) and searchable by problem language; click a card to expand it, fill its placeholders, and copy the result. Every instruction scaffold passes the Review checker as-is; cards badged <strong>Maker checklist</strong> are steps to follow in the editor and <strong>Definition</strong> ones belong in a topic or test set, not in an agent\'s instructions. Choosing a type hides the scaffolds that don\'t apply (all the topic ones vanish for modern) and rewrites tool references to the syntax that experience actually uses.<br>• <strong>Generator</strong> — compose a full instruction set live from role presets, tone, capabilities, tools (optionally grounded in <em>your</em> agents\' real tool names), escalation, and guardrails; modern output adds an explicit tone and output contract. Copy or download it.<br>• <strong>Review</strong> — paste instructions (or load them from an agent) and get findings against Microsoft\'s instruction-writing guidance, each linking to the Learn page behind it; loading an agent also flags tools or topics the instructions name that the agent doesn\'t actually have.'
                    + '<br><br><strong>Search:</strong> One box across every agent\'s component names, descriptions, and instructions, grouped by agent.'
                    + '<br><br><strong>💡 Tip:</strong> Run scores and engagement analytics live in Copilot Studio — the toolkit shows what Dataverse stores.'
            },
            impersonate: {
                title: 'Impersonate',
                summary: 'Test security roles by executing all API requests as another user and analyze security differences.',
                content: "Test what the app does for a user with different security roles. Pick a user and <strong>every server-side request the tool makes</strong> — WebAPI Explorer, FetchXML, Plugin Traces — runs as them, with a yellow indicator in the header.<br><br><strong>Analyze Security</strong> compares your access with theirs: entity privileges on the current table, field security profiles and column permissions, team memberships, and a role comparison marking each role <strong>Direct</strong> or <strong>via team</strong>.<br><br><strong>Compare Commands</strong> shows which ribbon buttons each user can see and which rule blocks the others — the same ribbon metadata as Command Checker (<code>&ribbondebug=true</code>). Commands gated by custom JavaScript or Power Fx are listed under <strong>Cannot be determined</strong>, because those rules only run in that user's own session.<br><br><strong>Quick Check</strong> summarizes what the impersonated user would get on the page you're on: table privileges, the form they'd actually open, columns hidden by field security, access to the record, the apps they can open, and role-scoped views. It's read-only and covers one page, so press it again after navigating. It can't see business rules, form scripts, or anything that hides fields at runtime.<br><br><strong>Note:</strong> Needs the <strong>prvActOnBehalfOfAnotherUser</strong> privilege (Delegate role) assigned directly, not via a team. Impersonated requests use the <strong>intersection</strong> of your privileges and theirs, so a non-administrator can under-report what that user could really do."
            },
            metadataBrowser: {
                title: 'Metadata Browser',
                summary: 'A complete, searchable dictionary of all tables and columns in the environment.',
                content: 'A standalone browser for exploring the Dataverse schema. The left panel shows a searchable list of all tables (entities) the current user can see. Clicking a table loads its columns (attributes) into the right panel. You can click any table or column to see a dialog with all of its detailed metadata properties (e.g., <code>SchemaName</code>, <code>IsManaged</code>, <code>ObjectTypeCode</code>), led by a <strong>Key Facts</strong> summary.<br><br><strong>Choices and lookups:</strong> A choice column lists its options with their values, and a lookup column lists the tables it can point at — including polymorphic lookups such as <code>customerid</code> and <code>ownerid</code>, which target more than one table. Option and target labels are copyable with a click.'
            },
            solutionLayers: {
                title: 'Solution Layers',
                summary: 'View and manage solution components with active unmanaged customizations.',
                content: 'This tab helps you identify and manage customization layers in your environment. Select a solution to view all components that have active unmanaged customizations sitting on top of managed components. You can search and filter by component type (Entity, Attribute, Form, View, etc.). For unmanaged active layers, you can <strong>delete</strong> them to remove your customization and reveal the managed version beneath. This is especially useful for cleaning up customizations or resolving conflicts after importing managed solutions.'
            },
            apiExplorer: {
                title: 'WebAPI Explorer',
                summary: 'A client to execute GET, POST, PATCH, and DELETE requests against the Web API.',
                content: 'A powerful tool to directly query the Dataverse Web API.<br><br><strong>GET Requests:</strong> Build OData queries with $select, $filter, $expand, $orderby, and $top options. Use <strong>Filter Groups</strong> to create complex queries with AND/OR/NOT logic. The <strong>Browse</strong> buttons let you search for table and column names. Results can be viewed in a table or as raw JSON, with sortable columns.<br><strong>Date filters:</strong> Date columns offer Dataverse\'s own date functions — <em>On</em>, <em>On or After</em>, <em>Today</em>, <em>This Month</em>, <em>Last X Days</em> and more — so a "created today" filter doesn\'t depend on you guessing the right timestamp. <strong>Get Count</strong> reports the true total for the query rather than stopping at Top Count.<br><strong>Current record:</strong> On a record form, this button fills in the table you are looking at and filters to that record\'s id, using the table\'s real primary key from metadata. It replaces any filters already in the builder.<br><br><strong>POST/PATCH (Create/Update):</strong> Choose between <strong>JSON mode</strong> (paste/edit raw JSON) or <strong>Field Builder mode</strong> (visual field editor). Field Builder auto-detects attribute types and provides smart inputs (picklists, booleans, date pickers, lookups). Use <strong>Populate Required</strong> to auto-fill mandatory fields with placeholder values.<br><br><strong>Bulk Operations:</strong> Leave the Record ID empty and add filter groups to perform bulk PATCH (update multiple records) or bulk DELETE. Progress tracking shows real-time status.<br><br><strong>Touch Records:</strong> Select rows in the result table and click <strong>Touch</strong> to update a field (like modifiedon) without changing data—useful for triggering plugins or workflows.<br><br><strong>File Uploads:</strong> For file columns, the Field Builder provides a file picker that supports chunked uploads for files of any size.<br><br><strong>Pagination:</strong> When queries return more than 5000 records, use <strong>Load More</strong> or <strong>Load All</strong> to fetch additional pages.<br><br><strong>💡 Tip:</strong> Enable <strong>Hide System Fields</strong> in the toolbar to filter out OData properties like @odata.etag from results.'
            },
            fetchXmlTester: {
                title: 'FetchXML Tester',
                summary: 'Build, edit, execute, and convert FetchXML queries with joins, filter groups, and aggregate queries.',
                content: 'A dedicated tester for FetchXML queries with both visual building and XML editing capabilities.<br><br><strong>Builder Mode:</strong> Start with the simple Builder for basic queries. Select a table, add columns with the <strong>Add Column</strong> button, and use <strong>Add Filter Group</strong> to create conditions with AND/OR logic. Add <strong>linked entities (joins)</strong> with the builder—it automatically detects lookup relationships.<br><br><strong>Nested Joins:</strong> Click on a linked entity to add child joins, building multi-level relationship chains (e.g., Account → Contact → SystemUser).<br><br><strong>Aggregate Queries:</strong> Use <strong>Add Aggregate</strong> to add aggregate columns (count, sum, avg, min, max) and <strong>Add Group By</strong> to group results. When aggregate or group-by rows are present, the builder automatically generates aggregate FetchXML with the <code>aggregate="true"</code> attribute. Use the Order field with an alias to sort aggregate results.<br><br><strong>Record Selection &amp; Touch:</strong> Results include checkboxes for selecting records. Use the <strong>Touch</strong> button to perform bulk touch operations on selected records. The <strong>Export</strong> button exports only selected records when a selection is active.<br><br><strong>XML Editor:</strong> Switch to the <strong>XML Editor</strong> for complex queries or to paste FetchXML from other tools. The editor provides syntax highlighting and <strong>Format XML</strong> for proper indentation.<br><strong>Templates:</strong> Use built-in templates including aggregate query examples to quickly start with common query patterns.<br><br><strong>Convert To:</strong> In the XML Editor, click the <strong>Convert To</strong> button in the toolbar to open the conversion panel. Convert your FetchXML to <strong>C# QueryExpression</strong> (uses FetchExpression for aggregate queries), <strong>JavaScript Xrm.WebApi</strong> (OData for simple queries, FetchXML for complex), <strong>OData</strong> query strings, <strong>SQL</strong> (T-SQL with JOINs and GROUP BY), <strong>Power Automate</strong> ("List rows" action configuration), or <strong>Web API URL</strong> (ready-to-use URL with encoded FetchXML). Click a format button and copy the output with one click.<br><br><strong>Pagination:</strong> For large result sets, use <strong>Load More</strong> or <strong>Load All</strong> to fetch additional pages beyond the 5000 record limit.<br><br><strong>💡 Tip:</strong> Enable <strong>Hide System Fields</strong> to filter out OData annotations and focus on your data. Click column headers to sort results.'
            },
            customApi: {
                title: 'Custom APIs',
                summary: 'Browse, create, manage, test, and generate code for Dataverse Custom APIs — all within a single solution-scoped tab.',
                content: 'A full-featured Custom API management tool. Start by selecting a solution from the dropdown to scope all operations to that solution\'s publisher prefix.<br><br><strong>Browser View:</strong> Displays all Custom APIs in a searchable card grid. Each card shows the unique name, type (Action / Function), binding type (Global, Entity-bound, Collection-bound), bound entity, processing type (Sync / Async), and the associated plug-in. Click <strong>Expand</strong> to reveal all request parameters and response properties with their data types and optional/required flags. Unmanaged APIs show <strong>Edit</strong> and <strong>Delete</strong> buttons. Use <strong>New API</strong> to create a Custom API with deep-insert of parameters and response properties in a single request.<br><br><strong>Tester View:</strong> Select any Custom API from the dropdown. The tester automatically determines:<br>• HTTP method — GET for Functions, POST for Actions<br>• Endpoint URL — correctly formatted for Global, Entity-bound, and Collection-bound APIs<br>• Parameter inputs — type-aware fields (text, number, boolean, date, EntityReference) for every required and optional parameter<br><br>Add custom request headers (e.g. <code>MSCRM.SuppressDuplicateDetection: true</code>) before executing. The response panel shows HTTP status, elapsed time, response size, formatted body (JSON / XML / Raw), and full response headers — each with a one-click copy button.<br><br><strong>Code Generation:</strong> After executing or selecting an API, the Code Generation panel produces ready-to-use snippets in four languages:<br>• <strong>JavaScript</strong> — using the native <code>fetch</code> API with proper OData headers<br>• <strong>C# (SDK)</strong> — using <code>OrganizationRequest</code> and <code>IOrganizationService</code><br>• <strong>HTTP</strong> — a raw HTTP request you can paste into Postman or Bruno<br>• <strong>Power Automate</strong> — a pre-configured "Perform an unbound/bound action" step JSON<br><br><strong>Export / Import:</strong> Export any Custom API definition (including all parameters and response properties) as a portable JSON file. Import a previously exported file into any environment to recreate the API in one click.<br><br><strong>Execution History:</strong> Tracks the last 20 executions with the API name, HTTP method, status code, and elapsed time. Click any history entry to re-populate the tester.<br><br><strong>💡 Tips:</strong><br>• Click <strong>Test</strong> on any Browser card to jump straight to the Tester with that API pre-selected.<br>• Filter the card grid by typing part of the API name, plugin, or bound entity in the search box.'
            },
            envVars: {
                title: 'Env Variables',
                summary: 'View, create, edit, and delete Environment Variables and their current values directly from the toolkit.',
                content: 'This tab displays all Environment Variable Definitions in your environment. For each variable it shows the schema name, type, default value, and current value.<br><br><strong>New Variable:</strong> Click <strong>New Variable</strong> in the toolbar to create a brand new Environment Variable Definition. The dialog validates the schema name format before saving.<br><strong>Edit:</strong> Click the <strong>Edit</strong> button on any card to update the current value directly from the toolkit — no need to open the Power Apps maker portal.<br><strong>Delete:</strong> Remove environment variables you no longer need (with confirmation). Managed variables cannot be deleted.<br><br><strong>💡 Tip:</strong> Current values are stored separately from default values in Dataverse. Editing here sets or updates the current value override without touching the default.'
            },
            traces: {
                title: 'Plugin Traces',
                summary: 'View and filter server-side Plugin Trace Logs in real-time.',
                content: 'A real-time viewer for Plugin Trace Logs, with <strong>live polling</strong> for new traces. Filter server-side by <strong>outcome</strong> (All / Errors only / Success only), class name, date range, or message content, then search locally within the results.<br><br><strong>Logging level:</strong> The banner reports the environment\'s current level, and the dropdown beside it switches between <em>Off</em>, <em>Exception</em> and <em>All</em> without a trip to System Settings. It writes the org-wide setting, so it needs write access to the Organization table and affects everyone — and it applies to plug-ins that run after it, not to traces already recorded.<br><br><strong>💡 Tip:</strong> An empty list usually means logging is Off, or the traces aged out — a daily job deletes anything older than <strong>24 hours</strong>. Microsoft also switches logging off on its own if the trace table passes 100 GB, so a level you set to <em>All</em> can come back as <em>Off</em>.'
            },
            userContext: {
                title: 'User Context',
                summary: 'Displays detailed information about the current (or impersonated) user and session.',
                content: 'Provides a quick overview of the current session context. This includes the user\'s name, ID, <strong>team memberships</strong>, and <strong>complete security roles</strong> (including those from teams), as well as details about the client and the organization. Team memberships are displayed with their type (Owner, Access, etc.) and all IDs are <strong>copyable by clicking</strong>. When impersonation is active, this tab automatically updates to show the context of the <strong>impersonated user</strong>.'
            },
            codeHub: {
                title: 'Code Hub',
                summary: 'A searchable, categorized library of modern Client API code snippets for model-driven apps.',
                content: 'A curated library of Client API (JavaScript) snippets for model-driven app development — each with a description, search tags, and one-click copy. Snippets follow <strong>current best practices</strong>: <code>formContext</code> from <code>executionContext</code>, <code>async/await</code>.<br><br>Categories: <strong>Form Context</strong> (values, handlers, required level, form type), <strong>Save &amp; Lifecycle</strong> (save-if-dirty, prevent save, save mode / block auto-save), <strong>UI</strong> (tabs, sections, form &amp; control notifications), <strong>Lookup Filters</strong> (PreSearch + custom filter), <strong>Business Process Flow</strong>, <strong>Web API</strong> (CRUD, associate, actions/functions, batch, <code>@odata.bind</code>, FetchXML, formatted values), <strong>Navigation &amp; Dialogs</strong> (openForm, navigateTo, custom &amp; <em>generative</em> pages, alerts/confirms), <strong>Grids &amp; Subgrids</strong>, <strong>App &amp; Side Panes</strong> (<code>Xrm.App</code> global notifications and side panes), and <strong>Utilities</strong> (global context, roles).<br><br>Type to filter across titles, tags, and code; matching categories expand automatically. Reviewed against Microsoft Learn Client API reference.'
            },
            settings: {
                title: 'Settings',
                summary: 'Configure the Power-Toolkit by reordering tabs, coloring them, hiding features, and managing settings.',
                content: 'This tab allows you to customize the Power-Toolkit. You can <strong>drag and drop</strong> tabs to reorder the navigation and use the toggles to hide any tabs you don\'t use.<br><br><strong>Tab colors:</strong> The swatch on each row gives that tab an accent color in the navigation — an edge bar and a tinted icon, so the tabs you use most are findable at a glance. The <strong>×</strong> clears it. Colors travel with Export/Import and are cleared by Reset.<br><br>The <strong>Header Buttons</strong> section lets you configure which header buttons are visible and their display order. Drag to reorder, and use the toggles to show or hide individual buttons. Note that some buttons (like Show Logical Names, God Mode, etc.) are only available on form pages.<br><br>Use the <strong>Export</strong> button to save your settings to a file, or <strong>Import</strong> to load settings on another machine. Click <strong>Reset</strong> to restore all settings to their defaults.'
            },
            about: {
                title: 'About',
                summary: 'Version information, the changelog, and links to the project.',
                content: 'Shows the version of the Power-Toolkit you are running, the author, and links to GitHub, the documentation, and the issue tracker.<br><br><strong>What\'s New</strong> lists everything that changed in this release, grouped by tab, with every earlier release folded under <strong>Previous Releases</strong>. Worth a read after an update — it is the quickest way to find out why something now behaves differently.'
            }
        };
    }

    /**
     * Lifecycle hook for cleaning up event listeners to prevent memory leaks.
     */
    destroy() {
        if (this._searchInput) {
            this._searchInput.removeEventListener('input', this._searchHandler);
        }
        // Cancel any pending debounced search
        if (this._searchHandler?.cancel) {
            this._searchHandler.cancel();
        }
        if (this._cardContainer) {
            this._cardContainer.removeEventListener('click', this._cardClickHandler);
        }
    }
}