/**
 * @file Help & User Guide component.
 * @module components/HelpTab
 * @description Displays a searchable, accordion-style user guide for the toolkit's features.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { Helpers } from '../utils/Helpers.js';

export class HelpTab extends BaseComponent {
    /**
     * Initializes the HelpTab component.
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
     * Contains the raw text content for all help topics.
     * @returns {object} An object where keys are topic IDs and values are content objects.
     * @private
     */
    _getHelpContent() {
        return {
            globalActions: {
                title: 'Global Actions (Header Buttons)',
                summary: 'Quickly access powerful tools like God Mode, form reset, and theme toggling.',
                content: 'The header provides quick access to powerful actions. <strong>God Mode</strong> unlocks all fields, removes required validations, and makes all hidden UI elements visible on a form. <strong>Reset Form</strong> discards all unsaved changes on the current form. <strong>Refresh Tool</strong> clears the tool\'s internal cache and reloads the current tab. <strong>Toggle Theme</strong> switches between light and dark mode.'
            },
            inspector: {
                title: 'Inspector',
                summary: "View and edit the form's UI component hierarchy in real-time.",
                content: 'The Inspector provides a live, hierarchical tree view of every UI component on the current form (Tabs > Sections > Controls). Expand each level to see properties like the logical name and the current value. For editable fields, the value is underlined—click it to open a dialog and change the value in real-time. This is extremely useful for testing how the form reacts to different data inputs.'
            },
            formColumns: {
                title: 'Form Columns',
                summary: 'A searchable table of all data columns on the form or in the record.',
                content: "This tab provides a flat table of every data column (attribute). The 'Form Columns' view shows only attributes present on the form layout, allowing for live editing. The 'Record Columns' view shows all attributes for the saved record, fetched via the Web API. You can sort, search, and click any cell to copy its value."
            },
            automation: {
                title: 'Form Automation',
                summary: 'See all active Business Rules and OnLoad/OnSave JavaScript events.',
                content: "This tab reveals the automated logic running on the form. It lists all active Business Rules for the current table and all JavaScript functions registered on the form's OnLoad and OnSave events. This helps you quickly identify which scripts and rules are firing, which is essential for debugging unexpected form behavior."
            },
            eventMonitor: {
                title: 'Event Monitor',
                summary: 'A live console that logs form events like OnLoad, OnSave, and OnChange.',
                content: "The Event Monitor is a live console that logs form events as they happen. It captures the initial Form OnLoad, every field's OnChange event (showing which field was changed), and the Form OnSave event. This is invaluable for debugging client-side scripts and understanding the sequence of events."
            },
            pluginContext: {
                title: 'Plugin Context',
                summary: 'Simulate the data context (Target, Pre/Post Images) sent to server-side plugins.',
                content: 'This tool simulates the data context that would be sent to a server-side plugin for Create, Update, or Delete operations. Based on the current form data, it generates the JSON for `InputParameters["Target"]`, `PreEntityImages["preimage"]`, and `PostEntityImages["postimage"]`. This is extremely useful for generating test data for C# unit tests.'
            },
            performance: {
                title: 'Performance',
                summary: 'Analyze the form load time and see a breakdown of the form\'s complexity.',
                content: 'This tab displays key performance metrics for the current form load, including the total load time and a breakdown of server, network, and client processing time. It also shows a summary of the form\'s composition, such as the number of tabs, controls, and OnChange events, which can help identify overly complex forms.'
            },
            apiExplorer: {
                title: 'WebAPI Explorer',
                summary: 'A client to execute GET, POST, PATCH, and DELETE requests against the Web API.',
                content: 'A powerful tool to directly query the Dataverse Web API. The simplified `GET` method helps you build OData queries easily, while `POST`, `PATCH`, and `DELETE` allow you to create, update, or delete records. Results can be viewed in a clean table format or as raw JSON.'
            },
            fetchXmlTester: {
                title: 'FetchXML Tester',
                summary: 'Build, edit, and execute FetchXML queries and view the results.',
                content: 'A dedicated tester for FetchXML. Use the simple Builder for basic queries and joins, or write/paste complex queries into the XML Editor. Execute against the database and see the results immediately in a table or as JSON. Use the built-in templates to get started quickly.'
            },
            traces: {
                title: 'Plugin Traces',
                summary: 'View and filter server-side Plugin Trace Logs in real-time.',
                content: 'A real-time viewer for server-side code. It fetches the latest Plugin Trace Logs and supports live polling to show new traces as they are created. You can filter by class name or message on the server, and perform a local text search to quickly find the trace you need. The output is syntax-highlighted for readability.'
            },
            envVars: {
                title: 'Env Variables',
                summary: 'View all Environment Variables and their current values for this solution.',
                content: 'This tab displays a list of all Environment Variable Definitions in your environment. For each variable, it shows the schema name, type, default value, and, most importantly, the current value if one has been set.'
            },
            userContext: {
                title: 'User Context',
                summary: 'Displays detailed information about the current user, session, and organization.',
                content: 'Provides a quick overview of the current session context. This includes the current user\'s name, ID, and security roles, as well as details about the client (web, mobile, etc.) and the organization, such as its version and unique name.'
            },
            codeHub: {
                title: 'Code Hub',
                summary: 'A searchable library of useful JavaScript code snippets for Power Apps.',
                content: 'A static library of commonly used JavaScript snippets for form scripting and Web API calls. You can quickly search for snippets related to field manipulation, form operations, or API requests, and copy them directly to your clipboard.'
            },
            settings: {
                title: 'Settings',
                summary: 'Configure the Power-Toolkit by reordering tabs, hiding features, and managing settings.',
                content: 'This tab allows you to customize the Power-Toolkit. You can drag and drop tabs to reorder the navigation and use the toggles to hide any tabs you don\'t use. You can also export your settings to a file or import them on another machine.'
            }
        };
    }
}