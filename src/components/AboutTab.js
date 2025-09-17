/**
 * @file About component.
 * @module components/AboutTab
 * @description Displays information about the Power-Toolkit, its author, and the license.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { Config } from '../utils/Config.js';
import { DialogService } from '../services/DialogService.js';

/**
 * A component that displays information about the application, including
 * version, author, and license details.
 * @extends {BaseComponent}
 */
export class AboutTab extends BaseComponent {
    /**
     * Initializes the AboutTab component, setting its ID, title, and icon.
     */
    constructor() {
        super('about', 'About', ICONS.about);
    }

    /**
     * Renders the component's static HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div style="text-align: center; padding-top: 20px;">
                <h2 style="color: var(--pro-text-primary); border:none; font-size: 1.8em; font-weight: 600; margin-bottom: 0;">Power-<span style="color: var(--pro-accent);">Toolkit</span></h2>
                <p style="color: var(--pro-text-secondary);">Version ${Config.TOOL_VERSION}</p>
            </div>
            <div class="info-grid info-grid-about" style="max-width: 400px; margin: 20px auto;">
                <strong>Author:</strong><span>${Config.DEVELOPER_NAME}</span>
                <strong>LinkedIn:</strong><a href="https://linkedin.com/in/khawatme" target="_blank" rel="noopener noreferrer" style="color: var(--pro-accent-light);">Connect with Mohammed</a>
            </div>
            <div style="text-align:center; margin-top: 30px;">
                <button id="view-license-btn" class="modern-button secondary">View License</button>
            </div>`;
        return container;
    }

    /**
     * Attaches the 'click' event handler to the license button.
     * @param {HTMLElement} element - The root element of the component, which contains the button.
     */
    postRender(element) {
        element.querySelector('#view-license-btn').onclick = () => {
            const licenseText = `MIT License

Copyright (c) 2025 ${Config.DEVELOPER_NAME}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
            DialogService.show('MIT License', `<pre style="white-space:pre-wrap; font-size: 12px; padding-inline: 20px;">${licenseText}</pre>`);
        };
    }
}