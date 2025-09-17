/**
 * @file Code Hub component.
 * @module components/CodeHubTab
 * @description A searchable, best-practice library of modern JavaScript code snippets for Power Apps.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { UIFactory } from '../ui/UIFactory.js';
import { Helpers } from '../utils/Helpers.js';

/**
 * @typedef {object} CodeSnippet
 * @property {string} t - The title of the snippet.
 * @property {string} d - A brief description of the snippet's purpose.
 * @property {string} c - The raw code content of the snippet.
 */

/**
 * @typedef {object} SnippetCategory
 * @property {string} description - A summary of the snippet category.
 * @property {CodeSnippet[]} snippets - An array of code snippets in this category.
 */

/**
 * A UI component that provides a searchable library of best-practice
 * JavaScript code snippets for Power Apps development.
 * @extends {BaseComponent}
 * @property {Object.<string, SnippetCategory>} snippets - The collection of all code snippets, organized by category.
 */
export class CodeHubTab extends BaseComponent {
    /**
     * Initializes the CodeHubTab, loads snippets, and debounces the filter function.
     */
    constructor() {
        super('codeHub', 'Code Hub', ICONS.codeHub);
        this.ui = {};
        this.snippets = this._getCodeSnippets();
        this.filterSnippets = Helpers.debounce(this._filterSnippets, 250);
    }

    /**
     * Renders the component's HTML structure using the accordion layout.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');

        const title = document.createElement('div');
        title.className = 'section-title';
        title.textContent = 'Code Hub';

        const toolbar = document.createElement('div');
        toolbar.className = 'pdt-toolbar';
        toolbar.innerHTML = `<input type="text" id="codehub-search" class="pdt-input" placeholder="Search snippets (e.g., 'subgrid', 'async')..." style="flex-grow: 1;">`;

        const contentHost = document.createElement('div');
        contentHost.className = 'pdt-content-host';

        const fragment = document.createDocumentFragment();

        Object.keys(this.snippets).forEach(categoryName => {
            const categoryData = this.snippets[categoryName]; // Get the category object
            
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'codehub-category';

            const headerDiv = document.createElement('div');
            headerDiv.className = 'codehub-category-header';
            // Add the description paragraph to the header
            headerDiv.innerHTML = `<div>
                                    <h4>${categoryName}</h4>
                                    <p class="codehub-category-description">${categoryData.description}</p>
                                </div>`;
            
            const list = document.createElement('ul');
            list.className = 'pdt-list codehub-list';

            // Loop through the snippets array inside the category object
            categoryData.snippets.forEach(s => {
                const searchText = `${s.t} ${s.d} ${s.c}`.toLowerCase();
                const listItem = document.createElement('li');
                listItem.className = 'codehub-snippet';
                listItem.dataset.searchText = Helpers.escapeHtml(searchText);
                
                const title = document.createElement('strong');
                title.textContent = s.t;
                
                const description = document.createElement('p');
                description.className = 'pdt-note';
                description.textContent = s.d;

                const codeBlockElement = UIFactory.createCopyableCodeBlock(s.c, 'javascript');

                listItem.append(title, description, codeBlockElement);
                list.appendChild(listItem);
            });

            categoryDiv.append(headerDiv, list);
            fragment.appendChild(categoryDiv);
        });

        contentHost.appendChild(fragment);
        container.append(title, toolbar, contentHost);

        return container;
    }
    
    /**
     * Attaches event listeners for search and accordion functionality.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        this.ui.searchInput = element.querySelector('#codehub-search');
        this.ui.container = element;
        this.ui.searchInput.addEventListener('keyup', () => this.filterSnippets());

        // Add back the accordion click handler
        element.addEventListener('click', (e) => {
            const header = e.target.closest('.codehub-category-header');
            if (header) {
                header.parentElement.classList.toggle('expanded');
            }
        });
    }

    /**
     * Filters snippets and categories based on the search term, expanding categories with matches.
     * @private
     */
    _filterSnippets() {
        const term = this.ui.searchInput.value.toLowerCase();
        this.ui.container.querySelectorAll('.codehub-category').forEach(category => {
            let hasVisibleSnippets = false;
            category.querySelectorAll('.codehub-snippet').forEach(snippet => {
                const isMatch = (snippet.dataset.searchText || '').includes(term);
                snippet.style.display = isMatch ? '' : 'none';
                if (isMatch) hasVisibleSnippets = true;
            });
            category.style.display = hasVisibleSnippets ? '' : 'none';

            // If searching, expand the categories to show the matches.
            if (term && hasVisibleSnippets) {
                category.classList.add('expanded');
            } else if (!term) {
                category.classList.remove('expanded');
            }
        });
    }

    /**
     * Contains the raw data for all code snippets, organized by category.
     * @returns {Object.<string, SnippetCategory>} An object where each key is a
     * category name and the value is a SnippetCategory object.
     * @private
     */
    _getCodeSnippets() {
        // t = title, d = description, c = code
        return {
            "Form Context (Basics)": {
                description: "Core functions for interacting with form data and attributes.",
                snippets: [
                    {
                        t: "Get/Set Field Value",
                        d: "Get or set the value of a string, number, or optionset field using the form context.",
                        c: `function onFieldChange(executionContext) {\n    const formContext = executionContext.getFormContext();\n    \n    // Get value\n    const telephone = formContext.getAttribute("telephone1").getValue();\n    console.log(telephone);\n\n    // Set value\n    formContext.getAttribute("description").setValue("This is the new value.");\n}`
                    }, {
                        t: "Get/Set Lookup Value",
                        d: "Read or set a lookup (foreign key) field's value.",
                        c: `function onLookupChange(executionContext) {\n    const formContext = executionContext.getFormContext();\n    const lookupAttr = formContext.getAttribute("primarycontactid");\n\n    // Get lookup value (returns an array)\n    const contact = lookupAttr.getValue();\n    if (contact && contact[0]) {\n        const id = contact[0].id;\n        const name = contact[0].name;\n        const entityType = contact[0].entityType;\n        console.log(\`Contact: \${name} (\${id})\`);\n    }\n\n    // Set lookup value\n    const newLookup = [{\n        id: "{GUID-HERE}",\n        name: "New Contact Name",\n        entityType: "contact"\n    }];\n    lookupAttr.setValue(newLookup);\n}`
                    }, {
                        t: "Set Required Level",
                        d: "Make a field required, recommended, or optional.",
                        c: `function onLoad(executionContext) {\n    const formContext = executionContext.getFormContext();\n\n    // Set as required\n    formContext.getAttribute("fax").setRequiredLevel("required");\n\n    // Set as recommended\n    formContext.getAttribute("emailaddress1").setRequiredLevel("recommended");\n\n    // Remove required level\n    formContext.getAttribute("telephone1").setRequiredLevel("none");\n}`
                    }
                ]
            },
            "UI (Tabs, Sections, Notifications)": {
                description: "Functions for controlling the user interface elements on a form.",
                snippets: [
                    {
                        t: "Show/Hide a Control",
                        d: "Control the visibility of a field on the form.",
                        c: `function onSomeCondition(executionContext) {\n    const formContext = executionContext.getFormContext();\n    const control = formContext.getControl("fax");\n\n    // Hide the control\n    control.setVisible(false);\n\n    // Show the control\n    control.setVisible(true);\n}`
                    }, {
                        t: "Show/Hide a Tab or Section",
                        d: "Control the visibility of entire tabs or sections on the form.",
                        c: `function onLoad(executionContext) {\n    const formContext = executionContext.getFormContext();\n    \n    // Get a tab by its name (check form properties)\n    const detailsTab = formContext.ui.tabs.get("DETAILS_TAB");\n    if (detailsTab) {\n        detailsTab.setVisible(false);\n    }\n\n    // Get a section by its name\n    const addressSection = detailsTab.sections.get("ADDRESS");\n    if (addressSection) {\n        addressSection.setVisible(true);\n    }\n}`
                    }, {
                        t: "Show a Form Notification",
                        d: "Display an information, warning, or error message at the top of the form.",
                        c: `function showNotification(executionContext) {\n    const formContext = executionContext.getFormContext();\n\n    // Show an ERROR notification for 5 seconds\n    formContext.ui.setFormNotification("This is an error message.", "ERROR", "myUniqueId");\n    setTimeout(() => formContext.ui.clearFormNotification("myUniqueId"), 5000);\n\n    // Show a WARNING or INFO notification\n    // formContext.ui.setFormNotification("This is a warning.", "WARNING", "myWarningId");\n    // formContext.ui.setFormNotification("This is an info message.", "INFO", "myInfoId");\n}`
                    },
                ]
            },
            "Web API (async/await)": {
                description: "Modern, asynchronous methods for creating, reading, updating, and deleting records.",
                snippets: [
                    {
                        t: "Retrieve a Record",
                        d: "Get data from a single record using its ID.",
                        c: `async function getAccountName(accountId) {\n    try {\n        const account = await Xrm.WebApi.retrieveRecord("account", accountId, "?$select=name,telephone1");\n        console.log(account.name);\n        return account.name;\n    } catch (error) {\n        console.error(error.message);\n    }\n}`
                    }, {
                        t: "Retrieve Multiple Records",
                        d: "Query for a set of records using OData filters.",
                        c: `async function getActiveContacts(accountId) {\n    const options = \`?$select=fullname,emailaddress1&$filter=statecode eq 0 and _parentcustomerid_value eq \${accountId}\`;\n    try {\n        const result = await Xrm.WebApi.retrieveMultipleRecords("contact", options);\n        for (const contact of result.entities) {\n            console.log(contact.fullname);\n        }\n        return result.entities;\n    } catch (error) {\n        console.error(error.message);\n    }\n}`
                    }, {
                        t: "Create a Record",
                        d: "Create a new record in a Dataverse table.",
                        c: `async function createAccount(data) {\n    // data = { name: "Sample Account", telephone1: "555-1234" }\n    try {\n        const result = await Xrm.WebApi.createRecord("account", data);\n        console.log("Account created with ID: " + result.id);\n        return result.id;\n    } catch (error) {\n        console.error(error.message);\n    }\n}`
                    }, {
                        t: "Update a Record",
                        d: "Update columns on an existing record.",
                        c: `async function updateAccount(accountId, data) {\n    // data = { telephone1: "555-9999", "primarycontactid@odata.bind": "/contacts(GUID)" }\n    try {\n        const result = await Xrm.WebApi.updateRecord("account", accountId, data);\n        console.log("Account updated. ID: " + result.id);\n    } catch (error) {\n        console.error(error.message);\n    }\n}`
                    }
                ]
            },
            "Subgrids": {
                description: "Code snippets for interacting with subgrids on a form.",
                snippets: [{
                    t: "Refresh a Subgrid",
                    d: "Force a subgrid on the form to refresh its data.",
                    c: `function refreshContactsGrid(executionContext) {\n    const formContext = executionContext.getFormContext();\n    const gridContext = formContext.getControl("Contacts"); // Get control by subgrid name\n    if (gridContext) {\n        gridContext.refresh();\n    }\n}`
                }, {
                    t: "Get Selected Subgrid Rows",
                    d: "Get the data for all currently selected rows in a subgrid.",
                    c: `function getSelectedContacts(executionContext) {\n    const formContext = executionContext.getFormContext();\n    const gridContext = formContext.getControl("Contacts");\n    if (gridContext) {\n        const selectedRows = gridContext.getGrid().getSelectedRows();\n        selectedRows.forEach(row => {\n            console.log(\`Selected Row ID: \${row.getId()}\`);\n            const contactName = row.data.entity.attributes.get("fullname").getValue();\n            console.log(\`Contact Name: \${contactName}\`);\n        });\n    }\n}`
                }]
            },
            "Navigation": {
                description: "Functions to navigate within the application or open new windows.",
                snippets: [{
                    t: "Open a New Record Form",
                    d: "Open the 'create' form for a new record, with pre-filled default values.",
                    c: `function openNewContact() {\n    const entityName = "contact";\n    const defaultValues = {\n        firstname: "John",\n        lastname: "Doe"\n    };\n    Xrm.Navigation.openForm({ entityName: entityName, useQuickCreateForm: true }, defaultValues).then(\n        (result) => console.log("Contact created with ID:", result.savedEntityReference[0].id),\n        (error) => console.error(error)\n    );\n}`
                }]
            }
        };
    }
}