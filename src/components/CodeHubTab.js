/**
 * @file Code Hub component.
 * @module components/CodeHubTab
 * @description A searchable, static library of common and useful JavaScript code snippets for Power Apps.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { UIFactory } from '../ui/UIFactory.js';
import { Helpers } from '../utils/Helpers.js';

/**
 * @typedef {object} CodeSnippet
 * @property {string} t - The title of the snippet.
 * @property {string} d - The description of the snippet.
 * @property {string} c - The code content of the snippet.
 */

export class CodeHubTab extends BaseComponent {
    /**
     * Initializes the CodeHubTab component.
     */
    constructor() {
        super('codeHub', 'Code Hub', ICONS.codeHub);
        this.ui = {};
        this.snippets = this._getCodeSnippets();
        this.filterSnippets = Helpers.debounce(this._filterSnippets, 250);
    }

    /**
     * Renders the component's HTML structure with all the code snippets.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        
        const categoriesHtml = Object.keys(this.snippets).map(category => {
            const snippetsHtml = this.snippets[category].map(s => `
                <li class="codehub-snippet" data-search-text="${Helpers.escapeHtml((s.t + s.d + s.c).toLowerCase())}">
                    <strong>${s.t}</strong>
                    <p class="pdt-note">${s.d}</p>
                    ${this._createSnippetBlock(s.c)}
                </li>`
            ).join('');

            return `
                <div class="codehub-category">
                    <div class="codehub-category-header">
                        <h4 class="pdt-section-header">${category}</h4>
                    </div>
                    <ul class="pdt-list codehub-list">${snippetsHtml}</ul>
                </div>`;
        }).join('');

        container.innerHTML = `
            <div class="section-title">Code Snippet Hub</div>
            <div class="pdt-toolbar">
                <input type="text" id="codehub-search" class="pdt-input" placeholder="Search snippets..." style="flex-grow: 1;">
            </div>
            <div class="pdt-content-host">${categoriesHtml}</div>`;
            
        return container;
    }
    
    /**
     * Attaches event listeners after the component is added to the DOM.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        this.ui.searchInput = element.querySelector('#codehub-search');
        this.ui.container = element;

        element.addEventListener('click', (e) => {
            // Handle accordion toggling
            const header = e.target.closest('.codehub-category-header');
            if (header) {
                header.parentElement.classList.toggle('expanded');
                return;
            }

            // Handle copy button clicks (delegated)
            const button = e.target.closest('.copyable-code-block button');
            if (button) {
                const pre = button.parentElement.querySelector('pre');
                if (pre) {
                    Helpers.copyToClipboard(pre.textContent, 'Code snippet copied!');
                }
            }
        });

        this.ui.searchInput.addEventListener('keyup', () => this.filterSnippets());
    }

    /**
     * Creates a copyable code block with syntax highlighting.
     * @param {string} code - The raw JavaScript code.
     * @returns {string} The outerHTML of the created code block element.
     * @private
     */
    _createSnippetBlock(code) {
        // Use the new helper for JS syntax highlighting
        const highlightedHtml = Helpers.highlightJson(code);
        const codeBlock = UIFactory.createCopyableCodeBlock(code, 'javascript');
        
        // Replace the plain text in the <pre> tag with our highlighted HTML
        const preElement = codeBlock.querySelector('pre');
        if (preElement) preElement.innerHTML = highlightedHtml;
        
        return codeBlock.outerHTML;
    }

    /**
     * Filters snippets and categories based on the search term.
     * @private
     */
    _filterSnippets() {
        const term = this.ui.searchInput.value.toLowerCase();
        
        this.ui.container.querySelectorAll('.codehub-category').forEach(category => {
            let hasVisibleSnippets = false;
            category.querySelectorAll('.codehub-snippet').forEach(snippet => {
                const searchText = snippet.dataset.searchText || '';
                const isMatch = searchText.includes(term);
                snippet.style.display = isMatch ? '' : 'none';
                if (isMatch) {
                    hasVisibleSnippets = true;
                }
            });

            // Hide the entire category if no snippets match the search
            category.style.display = hasVisibleSnippets ? '' : 'none';
            // If searching, expand the category to show matches
            if (term && hasVisibleSnippets) {
                category.classList.add('expanded');
            } else if (!term) {
                category.classList.remove('expanded');
            }
        });
    }

    /**
     * Contains the raw data for all code snippets, organized by category.
     * @returns {object.<string, Array<CodeSnippet>>} An object containing all snippet data.
     * @private
     */
    _getCodeSnippets() {
        // 't' = title, 'd' = description, 'c' = code
        return {
            "Field Manipulation": [
                {
                    t: "Get/Set Value",
                    d: "Get or set the value of a string, number, or optionset field.",
                    c: `// Get value
const value = formContext.getAttribute("logicalname").getValue();

// Set value
formContext.getAttribute("logicalname").setValue("new value");`
                }, {
                    t: "Get/Set Lookup Value",
                    d: "Read or set a lookup field's value.",
                    c: `// Get lookup value (returns an array)
const lookupValue = formContext.getAttribute("lookupfield").getValue();
if (lookupValue && lookupValue[0]) {
    const id = lookupValue[0].id;
    const name = lookupValue[0].name;
    const entityType = lookupValue[0].entityType;
}

// Set lookup value
const newLookup = [{
    id: "{GUID-HERE}",
    name: "Record Name",
    entityType: "account"
}];
formContext.getAttribute("lookupfield").setValue(newLookup);`
                }, {
                    t: "Show/Hide/Disable Control",
                    d: "Control the visibility and enabled state of a form control.",
                    c: `const control = formContext.getControl("logicalname");

// Hide
control.setVisible(false);

// Show
control.setVisible(true);

// Disable
control.setDisabled(true);`
                }, {
                    t: "Set Required Level",
                    d: "Make a field required, recommended, or not required.",
                    c: `// Set as required
formContext.getAttribute("logicalname").setRequiredLevel("required");

// Set as recommended
formContext.getAttribute("logicalname").setRequiredLevel("recommended");

// Remove required level
formContext.getAttribute("logicalname").setRequiredLevel("none");`
                }
            ],
            "Form Operations": [
                {
                    t: "Add OnChange Handler",
                    d: "Execute a function when a field's value changes.",
                    c: `// Should be added in the form's OnLoad event
function onLoad(execContext) {
    const formContext = execContext.getFormContext();
    formContext.getAttribute("logicalname").addOnChange(myOnChangeFunction);
}

function myOnChangeFunction(execContext) {
    const formContext = execContext.getFormContext();
    const attribute = execContext.getEventSource();
    console.log(\`Field '\${attribute.getName()}' value changed!\`);
}`
                }, {
                    t: "Show Form Notification",
                    d: "Display a message at the top of the form.",
                    c: `// Show an ERROR notification for 5 seconds
formContext.ui.setFormNotification("This is an error message.", "ERROR", "myUniqueId");
window.setTimeout(() => formContext.ui.clearFormNotification("myUniqueId"), 5000);

// Show a WARNING notification
formContext.ui.setFormNotification("This is a warning.", "WARNING", "myWarningId");

// Show an INFO notification
formContext.ui.setFormNotification("This is an informational message.", "INFO", "myInfoId");`
                }, {
                    t: "Get Form Type",
                    d: "Check if the form is for Create, Update, Read Only, etc.",
                    c: `const formType = formContext.ui.getFormType();
// 1: Create, 2: Update, 3: Read Only, 4: Disabled, 6: Bulk Edit
if (formType === 1) {
    // Logic for a new record
}`
                }, {
                    t: "Save Form",
                    d: "Programmatically save the record with options.",
                    c: `// Save the form and stay on the page
formContext.data.save().then(
    () => console.log("Save successful"),
    (error) => console.log("Save failed: " + error.message)
);

// Save and close the form
formContext.data.save({ saveMode: 2 }); // 2 = saveandclose`
                }
            ],
            "Web API": [
                {
                    t: "Retrieve a Record (Async/Await)",
                    d: "Get data from a single record using its ID with modern async/await syntax.",
                    c: `async function getAccountName(accountId) {
    try {
        const account = await Xrm.WebApi.retrieveRecord("account", accountId, "?$select=name");
        console.log(account.name);
        return account.name;
    } catch (error) {
        console.error(error.message);
    }
}`
                }, {
                    t: "Retrieve Multiple Records (Async/Await)",
                    d: "Query for a set of records using OData filters with modern async/await syntax.",
                    c: `async function getContactsForAccount(accountId) {
    const options = \`?$select=fullname,emailaddress1&$filter=_parentcustomerid_value eq \${accountId}\`;
    try {
        const result = await Xrm.WebApi.retrieveMultipleRecords("contact", options);
        for (const contact of result.entities) {
            console.log(contact.fullname);
        }
        return result.entities;
    } catch (error) {
        console.error(error.message);
    }
}`
                }, {
                    t: "Create a Record",
                    d: "Create a new record in a Dataverse table.",
                    c: `const data = {
    "name": "Sample Account",
    "telephone1": "555-1234"
};

Xrm.WebApi.createRecord("account", data).then(
    function success(result) {
        console.log("Account created with ID: " + result.id);
    },
    function (error) {
        console.log(error.message);
    }
);`
                }
            ]
        };
    }
}