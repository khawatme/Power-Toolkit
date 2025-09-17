/**
 * @file Help & User Guide component.
 * @module components/HelpTab
 * @description Displays a searchable, accordion-style user guide for the toolkit's features.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { Helpers } from '../utils/Helpers.js';

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
    }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
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
        const searchInput = element.querySelector('#help-search');
        const cardContainer = element.querySelector('#help-card-container');
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
            cardContainer.appendChild(card);
        }

        // Attach a debounced search listener for performance
        searchInput.addEventListener('keyup', Helpers.debounce(() => {
            const term = searchInput.value.toLowerCase().trim();
            cardContainer.querySelectorAll('.help-card').forEach(card => {
                const cardText = card.textContent.toLowerCase();
                card.style.display = cardText.includes(term) ? 'block' : 'none';
            });
        }, 250));

        // Use event delegation for the accordion click handler
        cardContainer.addEventListener('click', (e) => {
            const card = e.target.closest('.help-card');
            if (card) {
                this._toggleAccordion(card, cardContainer);
            }
        });
    }
    
    /**
     * Toggles the accordion state for a clicked help card.
     * @param {HTMLElement} card - The card that was clicked.
     * @param {HTMLElement} container - The parent container of all cards.
     * @private
     */
    _toggleAccordion(card, container) {
        const details = card.querySelector('.help-card-details');
        const isExpanded = card.classList.contains('expanded');

        // Collapse all other expanded cards first
        container.querySelectorAll('.help-card.expanded').forEach(openCard => {
            if (openCard !== card) {
                openCard.classList.remove('expanded');
                openCard.querySelector('.help-card-details').style.maxHeight = '0px';
            }
        });

        // Toggle the clicked card
        if (isExpanded) {
            card.classList.remove('expanded');
            details.style.maxHeight = '0px';
        } else {
            card.classList.add('expanded');
            // Set max-height to the element's full scrollable height for a smooth transition
            details.style.maxHeight = details.scrollHeight + 'px';
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
            globalActions: {
                title: 'Global Actions (Header Buttons)',
                summary: 'Access powerful tools like God Mode, form reset, and theme toggling.',
                content: 'The header provides quick access to powerful actions. <strong>God Mode</strong> unlocks all fields, removes required validations, and makes hidden UI elements visible on the form. <strong>Reset Form</strong> discards all unsaved changes by reloading the form data. <strong>Refresh Tool</strong> clears the tool\'s internal cache and reloads the current tab. <strong>Toggle Theme</strong> switches between light and dark mode.'
            },
            inspector: {
                title: 'Inspector',
                summary: 'View and edit the form\'s UI component hierarchy in real-time.',
                content: 'The Inspector provides a live, hierarchical tree view of every UI component on the current form (Tabs > Sections > Controls). Expand each level to see properties and current values. For editable fields, the value is underlined—click it to open a dialog and perform **live editing**. This is extremely useful for testing how the form reacts to different data inputs without having to write code.'
            },
            formColumns: {
                title: 'Form Columns',
                summary: 'A searchable table of all data columns on the form or in the record.',
                content: "This tab provides a flat table of every data column (attribute). The <strong>'Form Columns'</strong> view shows live data from the `Xrm.Page` context, allowing for real-time editing. The <strong>'Record Columns'</strong> view shows all attributes for the saved record, fetched via the Web API. You can sort, search, and hover over a row to **highlight the control** on the main form."
            },
            automation: {
                title: 'Form Automation',
                summary: 'View, manage, and inspect Business Rules and JavaScript event handlers.',
                content: "This tab reveals the automated logic on a table. The **Business Rules** section shows all rules (both active and inactive) for any table you select. You can **Activate, Deactivate, and Delete** rules directly, and click on any rule to expand it and see its underlying JavaScript logic with syntax highlighting. The **Form Event Handlers** section shows all `OnLoad` and `OnSave` functions configured in the form designer."
            },
            eventMonitor: {
                title: 'Event Monitor',
                summary: 'A live console that logs form events like OnLoad, OnSave, and OnChange.',
                content: "The Event Monitor is a live console that logs form events as they happen. It captures the initial Form `OnLoad`, every field's `OnChange` event (showing which field was changed), and the Form `OnSave` event. This is invaluable for debugging client-side scripts and understanding the sequence of events."
            },
            pluginContext: {
                title: 'Plugin Context',
                summary: 'Simulate the data context (Target, Pre/Post Images) sent to server-side plugins.',
                content: 'This tool simulates the data context that would be sent to a server-side plugin for `Create`, `Update`, or `Delete` operations. Based on the current form data, it generates the JSON for `InputParameters["Target"]`, `PreEntityImages["preimage"]`, and `PostEntityImages["postimage"]`. It also includes a button to generate a complete C# unit test snippet for the **FakeXrmEasy** framework.'
            },
            impersonate: {
                title: 'Impersonate',
                summary: 'Test security roles by executing all API requests as another user.',
                content: "This powerful feature allows you to test what your application looks and behaves like for a user with different security roles. Search for and select a user to begin impersonation. While active, **all server-side requests** made by this tool (WebAPI Explorer, FetchXML, Plugin Traces, etc.) will be executed as that user. A yellow indicator will appear in the header. The **User Context** tab will also update to show the impersonated user's details. To stop, simply click 'Clear'."
            },
            metadataBrowser: {
                title: 'Metadata Browser',
                summary: 'A complete, searchable dictionary of all tables and columns in the environment.',
                content: 'A standalone browser for exploring the Dataverse schema. The left panel shows a searchable list of all tables (entities) the current user can see. Clicking a table loads its columns (attributes) into the right panel. You can click any table or column to see a dialog with all of its detailed metadata properties (e.g., `SchemaName`, `IsManaged`, `ObjectTypeCode`). The panels are also resizable.'
            },
            apiExplorer: {
                title: 'WebAPI Explorer',
                summary: 'A client to execute GET, POST, PATCH, and DELETE requests against the Web API.',
                content: 'A powerful tool to directly query the Dataverse Web API. The simplified `GET` method helps you build OData queries easily, while `POST`, `PATCH`, and `DELETE` allow you to create, update, or delete records. Use the **Browse** buttons to search for table and column names instead of typing them manually. Results can be viewed in a table or as raw JSON.'
            },
            fetchXmlTester: {
                title: 'FetchXML Tester',
                summary: 'Build, edit, and execute FetchXML queries and view the results.',
                content: 'A dedicated tester for FetchXML. Use the simple **Builder** for basic queries and joins, or write/paste complex queries into the **XML Editor**. Execute against the database and see the results immediately in a table or as JSON. Use the built-in templates to get started quickly.'
            },
            traces: {
                title: 'Plugin Traces',
                summary: 'View and filter server-side Plugin Trace Logs in real-time.',
                content: 'A real-time viewer for server-side code. It fetches the latest Plugin Trace Logs and supports **live polling** to show new traces as they are created. You can filter by class name or message content on the server, and perform a local text search to quickly find the trace you need.'
            },
            envVars: {
                title: 'Env Variables',
                summary: 'View and edit all Environment Variables and their current values.',
                content: 'This tab displays a list of all Environment Variable Definitions in your environment. For each variable, it shows the schema name, type, default value, and, most importantly, the **current value**. You can click the **Edit** button to update the current value directly from the tool.'
            },
            userContext: {
                title: 'User Context',
                summary: 'Displays detailed information about the current (or impersonated) user and session.',
                content: 'Provides a quick overview of the current session context. This includes the user\'s name, ID, and **complete security roles** (including those from teams), as well as details about the client and the organization. When impersonation is active, this tab automatically updates to show the context of the **impersonated user**.'
            },
            codeHub: {
                title: 'Code Hub',
                summary: 'A searchable library of useful JavaScript code snippets for Power Apps.',
                content: 'A static library of commonly used JavaScript snippets for form scripting and Web API calls. You can quickly search for snippets and copy them directly to your clipboard.'
            },
            performance: {
                title: 'Performance',
                summary: 'Analyze the form load time and see a breakdown of the form\'s complexity.',
                content: 'This tab displays key performance metrics for the current form load, including the total load time and a breakdown of server, network, and client processing time. It also shows a summary of the form\'s composition, such as the number of controls and events.'
            },
            settings: {
                title: 'Settings',
                summary: 'Configure the Power-Toolkit by reordering tabs, hiding features, and managing settings.',
                content: 'This tab allows you to customize the Power-Toolkit. You can **drag and drop** tabs to reorder the navigation and use the toggles to hide any tabs you don\'t use. You can also **export** your settings to a file or **import** them on another machine.'
            },
            about: {
                title: 'About',
                summary: 'Displays version information and details about the author.',
                content: 'This section shows the current version of the Power-Toolkit, the author\'s name, and links to connect with them.'
            }
        };
    }
}