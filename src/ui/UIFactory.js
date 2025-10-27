/**
 * @file Factory for creating common UI elements.
 * @module ui/UIFactory
 * @description Provides functions that generate standardized, reusable HTML components,
 * such as formatted code blocks and informational messages.
 */

import { Config } from '../constants/index.js';
import { escapeHtml, highlightCode, formatXml, copyToClipboard } from '../helpers/index.js';

/**
 * A factory for creating common UI elements.
 * @namespace
 */
export const UIFactory = {
    /**
     * Creates a pre-formatted, "prettified" code block with syntax highlighting
     * and a "Copy" button. It automatically formats JSON and XML for readability.
     * @param {string | object} code - The code string or object to display.
     * @param {'json' | 'javascript' | 'csharp' | 'xml' | 'text'} [language='json'] - The language for syntax highlighting.
     * @returns {HTMLDivElement} The container element for the code block.
     */
    createCopyableCodeBlock(code, language = 'json') {
        const container = document.createElement('div');
        container.className = 'copyable-code-block';

        const button = document.createElement('button');
        button.textContent = Config.UI_FACTORY.copyButtonText;

        const pre = document.createElement('pre');
        const codeElement = document.createElement('code');
        pre.appendChild(codeElement);

        let codeToCopy = typeof code === 'string' ? code : JSON.stringify(code, null, 2);
        let codeToDisplay = '';

        switch (language) {
            case 'json':
                try { codeToCopy = JSON.stringify(JSON.parse(codeToCopy), null, 2); } catch (e) { /* Ignore parse error */ }
                codeToDisplay = highlightCode(codeToCopy, 'json');
                break;
            case 'xml':
                codeToCopy = formatXml(codeToCopy);
                codeToDisplay = escapeHtml(codeToCopy);
                break;
            case 'javascript':
                codeToDisplay = highlightCode(codeToCopy, 'javascript');
                break;
            case 'csharp':
            case 'text':
                // Fallback to plain text for unsupported or un-highlighted languages
                codeToDisplay = escapeHtml(codeToCopy);
                break;
            default:
                // Default to JS highlighting for any other case
                codeToDisplay = highlightCode(codeToCopy, 'javascript');
                break;
        }

        codeElement.innerHTML = codeToDisplay;

        button.onclick = (e) => {
            e.stopPropagation();
            copyToClipboard(codeToCopy, Config.UI_FACTORY.copySuccessMessage);
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
        el.innerHTML = `<div class="icon">${Config.UI_FACTORY.formDisabledIcon}</div><h3>${Config.UI_FACTORY.formDisabledTitle}</h3><p>${Config.UI_FACTORY.formDisabledMessage}</p>`;
        return el;
    }
};