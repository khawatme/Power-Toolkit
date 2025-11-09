/**
 * @file String manipulation and HTML utilities.
 * @module helpers/string.helpers
 * @description Provides safe string operations, HTML escaping, syntax highlighting, and text formatting.
 */

import { Config } from '../constants/index.js';

/**
 * String and HTML utility functions.
 * @namespace StringHelpers
 */
export const StringHelpers = {
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
                if (attribute) {
                    return `<span class="csharp-attribute">${attribute}</span>`;
                }
                if (comment) {
                    return `<span class="json-comment">${comment}</span>`;
                }
                if (string) {
                    return `<span class="json-string">${string}</span>`;
                }
                if (keyword) {
                    return `<span class="json-key">${keyword}</span>`;
                }
                if (constant) {
                    return `<span class="json-boolean">${constant}</span>`;
                }
                if (number) {
                    return `<span class="json-number">${number}</span>`;
                }
                return match;
            });
        } else { // Default to JavaScript
            return escaped.replace(/(^\s*\/\*[\s\S]*?\*\/|^\s*\/\/[^\r\n]*)|("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")|(\b(function|var|let|const|if|else|return|try|catch|new|typeof|arguments|this)\b)|(\b(true|false|null|undefined)\b)|(-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
                (match, comment, string, keyword, constant, number) => {
                    if (comment) {
                        return `<span class="json-comment">${comment}</span>`;
                    }
                    if (string) {
                        return `<span class="json-string">${string}</span>`;
                    }
                    if (keyword) {
                        return `<span class="json-key">${keyword}</span>`;
                    }
                    if (constant) {
                        return `<span class="json-boolean">${constant}</span>`;
                    }
                    if (number) {
                        return `<span class="json-number">${number}</span>`;
                    }
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
            const tab = Config.XML_INDENT || '  '; // 2 spaces
            xmlStr.split(/>\s*</).forEach(node => {
                if (node.match(/^\/\w/)) {
                    indent = indent.substring(tab.length);
                }
                formatted += `${indent}<${node}>\r\n`;
                if (node.match(/^<?\w[^>]*[^\/]$/)) {
                    indent += tab;
                }
            });
            return formatted.substring(1, formatted.length - 3);
        } catch (_e) {
            // Silent - XML formatting is best-effort, return original if it fails
            return xmlStr;
        }
    },

    /**
     * Applies basic syntax highlighting to a plugin trace log message for better readability.
     * @param {string} message - The raw trace message string.
     * @returns {string} An HTML string with syntax highlighting applied.
     */
    highlightTraceMessage(message) {
        if (!message) {
            return '';
        }

        let highlighted = this.escapeHtml(message);

        // Highlight strings in quotes
        highlighted = highlighted.replace(/"([^"]*)"/g, '"<span class="trace-string">$1</span>"');
        // Highlight GUIDs
        highlighted = highlighted.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '<span class="trace-guid">$&</span>');
        // Highlight keywords (like 'Exception:', 'Error Code:')
        highlighted = highlighted.replace(/(Exception:|Error Code:|Message:|--)/g, '<span class="trace-keyword">$&</span>');
        // Highlight numbers (standalone)
        highlighted = highlighted.replace(/\b\d+\b/g, '<span class="trace-number">$&</span>');
        // Highlight specific error messages
        highlighted = highlighted.replace(/at Microsoft.Xrm.Sdk.ServiceProxy/g, '<span class="trace-error-msg">$&</span>');

        return highlighted;
    },

    /**
     * Creates a centered header with an accent-colored word for branding.
     * Commonly used for app titles and branded headers.
     * @param {string} prefix - The text before the accent word
     * @param {string} accentWord - The word to be highlighted with accent color
     * @param {string} [subtitle=''] - Optional subtitle text (e.g., version info)
     * @returns {string} HTML string for the centered header
     * @example
     * const header = StringHelpers.createCenteredHeader('Power-', 'Toolkit', 'Version 1.0.0');
     */
    createCenteredHeader(prefix, accentWord, subtitle = '') {
        const subtitleHtml = subtitle ? `<p>${this.escapeHtml(subtitle)}</p>` : '';
        return `<h2>${this.escapeHtml(prefix)}<span class="accent">${this.escapeHtml(accentWord)}</span></h2>${subtitleHtml}`;
    },

    /**
     * Creates an external link with proper security attributes and styling.
     * Automatically adds target="_blank" and rel="noopener noreferrer" for security.
     * @param {string} url - The URL for the link
     * @param {string} text - The display text for the link
     * @param {string} [color='var(--pro-accent-light)'] - The CSS color for the link
     * @returns {string} HTML string for the external link
     * @example
     * const link = StringHelpers.createExternalLink('https://github.com', 'GitHub');
     */
    createExternalLink(url, text, color = 'var(--pro-accent-light)') {
        return `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="pdt-external-link" style="color: ${color};">${this.escapeHtml(text)}</a>`;
    },

    /**
     * Regular expression pattern for matching GUIDs (RFC 4122 compliant).
     * @type {RegExp}
     */
    GUID_REGEX: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,

    /**
     * Extracts the first GUID found in a string.
     * @param {string} text - The text to search for a GUID
     * @returns {string|null} The first GUID found, or null if none found
     * @example
     * const guid = StringHelpers.extractGuidFromString('https://api.crm.dynamics.com/api/data/v9.2/accounts(12345678-1234-1234-1234-123456789abc)');
     * // Returns: '12345678-1234-1234-1234-123456789abc'
     */
    extractGuidFromString(text) {
        if (!text || typeof text !== 'string') {
            return null;
        }
        const match = text.match(this.GUID_REGEX);
        return match ? match[0] : null;
    }
};
