/**
 * @file "Buy Me a Coffee" support component.
 * @module components/coffeeTab
 * @description A static tab that provides a link for users to support the tool's development.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';

export class CoffeeTab extends BaseComponent {
    /**
     * Initializes the CoffeeTab component.
     */
    constructor() {
        super('coffee', 'Support', ICONS.coffee);
    }

    /**
     * Renders the component's static HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.style.textAlign = 'center';
        container.style.paddingTop = '50px';
        container.innerHTML = `
            <div style="font-size:48px; margin-bottom:20px;">☕</div>
            <div class="section-title" style="border:none; text-align:center; font-size:1.5em;">Enjoying the Power-Toolkit?</div>
            <p class="pdt-note" style="max-width:400px; margin:0 auto 30px auto;">If this tool saves you time, please consider showing your support. A coffee helps fuel future development and new features!</p>
            <a href="https://www.buymeacoffee.com/Khawatme" target="_blank" rel="noopener noreferrer" class="modern-button" style="font-size:1.1em; padding:12px 24px;">Buy me a coffee</a>`;
        return container;
    }
}