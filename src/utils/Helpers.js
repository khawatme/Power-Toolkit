/**
 * @file Generic, reusable utility functions for the application.
 * @module utils/Helpers
 * @description This file contains a collection of stateless helper functions for common tasks
 * such as string manipulation, event handling, and data formatting.
 */

import { NotificationService } from '../services/NotificationService.js';

/**
 * @typedef {import('../../../node_modules/@types/xrm/index.d.ts').Xrm.Attributes.Attribute} XrmAttribute
 */

/**
 * Defines the structure for a filter operator used in query builders.
 * @typedef {object} FilterOperator
 * @property {string} text - The user-friendly display text (e.g., "Equals").
 * @property {string|null} fetch - The corresponding operator for FetchXML (e.g., "eq").
 * @property {string|null} odata - The corresponding operator for OData Web API (e.g., "eq").
 */

/**
 * A collection of helper functions.
 * @namespace
 */
export const Helpers = {
    /**
     * A master list of filter operators and their corresponding values for FetchXML and OData.
     * @type {FilterOperator[]}
     */
    FILTER_OPERATORS: [
        { text: 'Equals', fetch: 'eq', odata: 'eq' },
        { text: 'Not Equals', fetch: 'neq', odata: 'ne' },
        { text: 'Like', fetch: 'like', odata: null },
        { text: 'Not Like', fetch: 'not-like', odata: null },
        { text: 'In', fetch: 'in', odata: null },
        { text: 'Not In', fetch: 'not-in', odata: null },
        { text: 'Is Null', fetch: 'null', odata: 'eq null' },
        { text: 'Is Not Null', fetch: 'not-null', odata: 'ne null' },
        { text: 'Contains', fetch: null, odata: 'contains' },
        { text: 'Not Contains', fetch: null, odata: 'not contains' },
        { text: 'Starts With', fetch: null, odata: 'startswith' },
        { text: 'Ends With', fetch: null, odata: 'endswith' },
        { text: 'Greater Than', fetch: 'gt', odata: 'gt' },
        { text: 'Greater or Equal', fetch: 'ge', odata: 'ge' },
        { text: 'Less Than', fetch: 'lt', odata: 'lt' },
        { text: 'Less or Equal', fetch: 'le', odata: 'le' },
    ],
    
    /**
     * Safely escapes HTML special characters in a string to prevent XSS.
     * @param {string} str - The string to escape.
     * @returns {string} The escaped HTML string.
     */
    escapeHtml(str) {
        const p = document.createElement('p');
        p.textContent = String(str ?? ''); // Use textContent to let the browser handle escaping
        return p.innerHTML;
    },

    /**
     * Copies a string to the user's clipboard using the modern Clipboard API with a
     * fallback to the legacy `execCommand` for older browsers or insecure contexts.
     * Shows a success or error notification.
     * @param {string} text - The text to copy.
     * @param {string} successMessage - The message to show on successful copy.
     * @returns {Promise<void>}
     */
    async copyToClipboard(text, successMessage) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            NotificationService.show(successMessage, 'success');
        } catch (err) {
            NotificationService.show('Failed to copy text.', 'error');
            console.error('Copy to clipboard failed:', err);
        }
    },

    /**
     * Applies basic, regex-based syntax highlighting to a code string.
     * This implementation is lightweight and dependency-free.
     * @param {string|object} codeString - The code string or JSON object to highlight.
     * @param {'javascript'|'json'|'csharp'} [language='javascript'] - The language to highlight.
     * @returns {string} An HTML string with syntax highlighting spans.
     */
    highlightCode(codeString, language = 'javascript') {
        if (typeof codeString !== 'string') {
            codeString = JSON.stringify(codeString, undefined, 2);
        }
        
        const escaped = this.escapeHtml(codeString);

        if (language === 'json') {
            return escaped.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
                let cls = 'json-number';
                if (/^"/.test(match)) {
                    cls = /:$/.test(match) ? 'json-key' : 'json-string';
                } else if (/true|false/.test(match)) {
                    cls = 'json-boolean';
                } else if (/null/.test(match)) {
                    cls = 'json-null';
                }
                return `<span class="${cls}">${match}</span>`;
            });
        } else if (language === 'csharp') {
            const csharpKeywords = 'public|private|protected|class|void|string|int|bool|var|new|void|get|set|if|else|return|try|catch|using|namespace|in|var|new|get|set';
            const csharpRegex = new RegExp(`(\\[[^\\]]+\\])|(\\/\\*[\\s\\S]*?\\*\\\/|\\\/\\\/[^\\r\\n]*)|(@"[^"]*"|"(?:\\\\.|[^"\\\\])*")|\\b(${csharpKeywords})\\b|\\b(true|false|null)\\b|(\\b-?\\d+\\.?\\d*\\b)`, 'g');
            
            return escaped.replace(csharpRegex, (match, attribute, comment, string, keyword, constant, number) => {
                if (attribute) return `<span class="csharp-attribute">${attribute}</span>`;
                if (comment) return `<span class="json-comment">${comment}</span>`;
                if (string) return `<span class="json-string">${string}</span>`;
                if (keyword) return `<span class="json-key">${keyword}</span>`;
                if (constant) return `<span class="json-boolean">${constant}</span>`;
                if (number) return `<span class="json-number">${number}</span>`;
                return match;
            });
        } else { // Default to JavaScript
            return escaped.replace(/(^\s*\/\*[\s\S]*?\*\/|^\s*\/\/[^\r\n]*)|("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")|(\b(function|var|let|const|if|else|return|try|catch|new|typeof|arguments|this)\b)|(\b(true|false|null|undefined)\b)|(-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, 
                (match, comment, string, keyword, constant, number) => {
                    if (comment) return `<span class="json-comment">${comment}</span>`;
                    if (string) return `<span class="json-string">${string}</span>`;
                    if (keyword) return `<span class="json-key">${keyword}</span>`;
                    if (constant) return `<span class="json-boolean">${constant}</span>`;
                    if (number) return `<span class="json-number">${number}</span>`;
                    return match;
                }
            );
        }
    },

    /**
     * Pretty-prints an XML string with basic indentation.
     * @param {string} xmlStr - The XML string to format.
     * @returns {string} The formatted XML string.
     */
    formatXml(xmlStr) {
        try {
            let formatted = '', indent = '';
            const tab = '  '; // 2 spaces
            xmlStr.split(/>\s*</).forEach(node => {
                if (node.match(/^\/\w/)) indent = indent.substring(tab.length);
                formatted += `${indent}<${node}>\r\n`;
                if (node.match(/^<?\w[^>]*[^\/]$/)) indent += tab;
            });
            return formatted.substring(1, formatted.length - 3);
        } catch (e) {
            console.warn("Could not format XML, likely invalid.", e);
            return xmlStr;
        }
    },

    /**
     * Creates a debounced function that delays invoking `func` until after `delay` milliseconds have elapsed.
     * @param {Function} func - The function to debounce.
     * @param {number} delay - The number of milliseconds to delay.
     * @returns {Function} The new debounced function.
     */
    debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    },

    /**
     * Creates a throttled function that only invokes `func` at most once per every `limit` milliseconds.
     * @param {Function} func - The function to throttle.
     * @param {number} limit - The throttle limit in milliseconds.
     * @returns {Function} The new throttled function.
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Validates if a string is a valid GUID.
     * @param {string} guid - The string to test.
     * @returns {boolean} True if the string is a valid GUID.
     */
    isValidGuid(guid) {
        return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(guid);
    },

    /**
     * Attaches a keydown listener to an input that triggers an action on 'Enter'.
     * @param {HTMLInputElement} inputElement - The input element.
     * @param {Function} action - The function to execute.
     * @returns {void}
     */
    addEnterKeyListener(inputElement, action) {
        if (inputElement) {
            inputElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    action();
                }
            });
        }
    },
    
    /**
     * Formats a raw attribute value for clean display in the UI, correctly handling lookups,
     * option sets, dates, and other complex types.
     * @param {*} value - The raw value from `attribute.getValue()`.
     * @param {XrmAttribute} [attribute] - The optional attribute object, used to get text values for option sets.
     * @param {string} [controlType] - The type of the control displaying the value.
     * @returns {string} A user-friendly string representation of the value.
     */
    formatDisplayValue(value, attribute, controlType) {
        if (value === null) return "null";
        if (value === undefined) return "undefined";

        if (controlType && controlType.includes('subgrid')) {
            return String(value); 
        }

        if (attribute && typeof attribute.getText === 'function') {
            const textValue = attribute.getText();
            if (Array.isArray(textValue)) {
                return textValue.join(', ');
            }
            return textValue || String(value);
        }
        
        const attrType = attribute?.getAttributeType();

        if (attrType === 'lookup' && Array.isArray(value) && value[0]?.name) {
              return value[0].name;
        }

        if (Array.isArray(value)) {
            if (value.length === 0) return "[Empty Array]";
            return `[${value.length} items]`;
        }
        if (value instanceof Date) {
            return value.toLocaleString();
        }
        return String(value);
    },

    /**
     * Parses the value from an HTML input/select element into the correct data type for the Xrm API.
     * @param {HTMLElement} input - The input or select element.
     * @param {string} type - The target Dataverse data type (e.g., 'integer', 'datetime', 'boolean').
     * @returns {string|number|boolean|Date|null} The parsed value in the correct type.
     * @throws {Error} If the value is invalid for the target type (e.g., non-numeric string for an integer field).
     */
    parseInputValue(input, type) {
        const value = input.value;

        switch (type) {
            case 'integer': {
                if (value === null || value === '') return null;
                const num = parseInt(value, 10);
                if (isNaN(num)) throw new Error("Invalid number format.");
                return num;
            }
            case 'decimal':
            case 'money':
            case 'double': {
                if (value === null || value === '') return null;
                const num = parseFloat(value);
                if (isNaN(num)) throw new Error("Invalid number format.");
                return num;
            }
            case 'datetime': {
                if (value === null || value === '') return null;
                const date = new Date(value);
                if (isNaN(date.getTime())) throw new Error("Invalid date format.");
                return date;
            }
            case 'optionset': {
                if (value === 'null') return null;
                const num = parseInt(value, 10);
                return isNaN(num) ? null : num;
            }
            case 'boolean': {
                if (value === 'null') return null;
                return value === 'true';
            }
            default:
                return value;
        }
    },

    /**
     * Triggers a browser download for a given JavaScript object by converting it to a JSON file.
     * @param {object} data - The JSON object to download.
     * @param {string} filename - The desired filename for the downloaded file.
     * @returns {void}
     */
    downloadJson(data, filename) {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Checks if a property key is a system-generated OData property.
     * @param {string} key - The property key to check.
     * @returns {boolean} True if the key is a system property (e.g., starts with '_' or contains '@odata').
     */
    isOdataProperty(key) {
        return key.startsWith('_') || /@odata/i.test(key);
    },

    /**
     * Applies basic syntax highlighting to a plugin trace log message for better readability.
     * @param {string} message - The raw trace message string.
     * @returns {string} An HTML string with syntax highlighting applied.
     */
    highlightTraceMessage(message) {
        if (!message) return '';
        
        let highlighted = this.escapeHtml(message);

        // Highlight strings in quotes
        highlighted = highlighted.replace(/"([^"]*)"/g, `"<span class="trace-string">$1</span>"`);
        // Highlight GUIDs
        highlighted = highlighted.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, `<span class="trace-guid">$&</span>`);
        // Highlight keywords (like 'Exception:', 'Error Code:')
        highlighted = highlighted.replace(/(Exception:|Error Code:|Message:|--)/g, `<span class="trace-keyword">$&</span>`);
        // Highlight numbers (standalone)
        highlighted = highlighted.replace(/\b\d+\b/g, `<span class="trace-number">$&</span>`);
        // Highlight specific error messages
        highlighted = highlighted.replace(/at Microsoft.Xrm.Sdk.ServiceProxy/g, `<span class="trace-error-msg">$&</span>`);

        return highlighted;
    }
};