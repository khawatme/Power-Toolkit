/**
 * @file Factory for creating common UI elements.
 * @module ui/UIFactory
 * @description Provides functions that generate standardized, reusable HTML components,
 * such as formatted code blocks and informational messages.
 */

import { Helpers } from '../utils/Helpers.js';

/**
 * A factory for creating common UI elements.
 * @namespace
 */
export const UIFactory = {
    /**
     * Creates a pre-formatted code block with syntax highlighting and a "Copy" button.
     * @param {string | object} code - The code string or object to display.
     * @param {'json' | 'javascript' | 'csharp' | 'xml' | 'text'} [language='json'] - The language for syntax highlighting.
     * @returns {HTMLDivElement} The container element for the code block.
     */
    createCopyableCodeBlock(code, language = 'json') {
        const container = document.createElement('div');
        container.className = 'copyable-code-block';

        const button = document.createElement('button');
        button.textContent = 'Copy';

        const pre = document.createElement('pre');
        const codeElement = document.createElement('code');
        pre.appendChild(codeElement);
        
        let codeToCopy = code;
        let codeToDisplay = '';

        // Format and highlight the code based on the specified language.
        if (language === 'json') {
            try {
                const jsonObject = typeof code === 'string' ? JSON.parse(code || '""') : code;
                codeToCopy = JSON.stringify(jsonObject, null, 2);
                codeToDisplay = Helpers.highlightJson(codeToCopy);
            } catch (e) {
                // Fallback if JSON is invalid
                codeToCopy = String(code);
                codeToDisplay = Helpers.escapeHtml(codeToCopy);
            }
        } else if (language === 'xml') {
            codeToCopy = Helpers.formatXml(String(code));
            codeToDisplay = Helpers.escapeHtml(codeToCopy);
        } else {
            // Fallback for javascript, csharp, text, etc.
            codeToCopy = String(code);
            codeToDisplay = Helpers.escapeHtml(codeToCopy);
        }

        codeElement.innerHTML = codeToDisplay;
        
        button.onclick = (e) => {
            e.stopPropagation();
            Helpers.copyToClipboard(codeToCopy, 'Code snippet copied!');
        };

        container.append(button, pre);
        return container;
    },

    /**
     * Creates a standardized message element for features that are only available on a form.
     * @returns {HTMLDivElement} The container element for the message.
     */
    createFormDisabledMessage() {
        const el = document.createElement('div');
        el.className = 'pdt-form-disabled-message';
        el.innerHTML = `<div class="icon">📄</div><h3>Form Context Required</h3><p>This feature is only available when viewing a record form.</p>`;
        return el;
    }
};