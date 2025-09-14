/**
 * @file Generic, reusable utility functions for the application.
 * @module utils/Helpers
 * @description This file contains a collection of stateless helper functions for common tasks
 * such as string manipulation, event handling, and data formatting.
 */

import { NotificationService } from '../services/NotificationService.js';

/**
 * A collection of helper functions.
 * @namespace
 */
export const Helpers = {
    /**
     * A master list of filter operators and their corresponding values for FetchXML and OData.
     * This ensures consistency between the FetchXML Tester and WebAPI Explorer.
     * @type {Array<{text: string, fetch: string|null, odata: string|null}>}
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
     * Copies a string to the user's clipboard. Shows a success or error notification.
     * @param {string} text - The text to copy.
     * @param {string} successMessage - The message to show on successful copy.
     */
    async copyToClipboard(text, successMessage) {
        try {
            // Use the modern, secure Clipboard API if available
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for older browsers or insecure contexts
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
     * Wraps JSON parts in spans with specific classes for CSS-based syntax highlighting.
     * @param {string} jsonString - The JSON string to highlight.
     * @returns {string} An HTML string with syntax highlighting.
     */
    highlightJson(jsonString) {
        if (typeof jsonString !== 'string') {
            jsonString = JSON.stringify(jsonString, undefined, 2);
        }
        jsonString = jsonString.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return jsonString.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
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
    },

    /**
     * Pretty-prints an XML string with basic indentation.
     * @param {string} xmlStr - The XML string to format.
     * @returns {string} The formatted XML string.
     */
    formatXml(xmlStr) {
        try {
            let formatted = '', indent = '';
            const tab = '  '; // 2 spaces for indentation
            xmlStr.split(/>\s*</).forEach(node => {
                if (node.match(/^\/\w/)) indent = indent.substring(tab.length); // Decrease indent
                formatted += `${indent}<${node}>\r\n`;
                if (node.match(/^<?\w[^>]*[^\/]$/)) indent += tab; // Increase indent
            });
            return formatted.substring(1, formatted.length - 3);
        } catch (e) {
            console.warn("Could not format XML, likely invalid.", e);
            return xmlStr; // Return original on error
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
     * Formats a raw attribute value for clean display in the UI.
     * @param {*} value - The raw value from `attribute.getValue()`.
     * @param {Xrm.Attributes.Attribute} [attribute] - The optional attribute object.
     * @param {string} [controlType] - The type of the control displaying the value.
     * @returns {string} A user-friendly string representation of the value.
     */
    formatDisplayValue(value, attribute, controlType) {
        if (value === null) return "null";
        if (value === undefined) return "undefined";

        if (controlType && controlType.includes('subgrid')) {
            return String(value); 
        }

        // Instead of just checking the type, we now also check if the .getText method actually exists.
        if (attribute && typeof attribute.getText === 'function') {
            const textValue = attribute.getText();
            // For multiselect optionsets, getText() returns an array of strings.
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
     * Parses the value from an HTML input or select element into the correct data type.
     * @param {HTMLElement} input - The input or select element.
     * @param {string} type - The target data type (e.g., 'integer', 'datetime', 'boolean').
     * @returns {string|number|boolean|Date|null} The parsed value in the correct type.
     * @throws {Error} If the value is invalid for the target type.
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
                // This is the corrected logic for optionsets.
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
     * Triggers a browser download for a JSON object.
     * @param {object} data - The JSON object to download.
     * @param {string} filename - The desired filename.
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
     * @returns {boolean} True if the key is a system property.
     */
    isOdataProperty(key) {
        // A property is considered a system property if it starts with '_' or contains '@odata' (case-insensitive).
        return key.startsWith('_') || /@odata/i.test(key);
    },

    /**
     * Applies basic syntax highlighting to a plugin trace log message.
     * @param {string} message - The raw trace message string.
     * @returns {string} An HTML string with syntax highlighting.
     */
    highlightTraceMessage(message) {
        if (!message) return '';
        
        // Escape HTML to prevent XSS
        let highlighted = Helpers.escapeHtml(message);

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