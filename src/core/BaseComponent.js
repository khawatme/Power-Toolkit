/**
 * @file Abstract base class for all UI components (tabs) in the Power-Toolkit.
 * @module core/BaseComponent
 * @description Defines the common interface and constructor for all feature tabs.
 * This ensures that the UIManager can treat all components uniformly. It should not be instantiated directly.
 */

import { UIFactory } from '../ui/UIFactory.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
import { Config } from '../constants/index.js';

/**
 * Represents the abstract base for a feature tab component.
 * @abstract
 */
export class BaseComponent {
    /**
     * Initializes a new component. This constructor should be called via `super()` in subclasses.
     * @param {string} id - A unique identifier for the component (e.g., 'inspector').
     * @param {string} label - The user-facing name of the tab (e.g., 'Inspector').
     * @param {string} icon - The SVG string for the tab's icon.
     * @param {boolean} [isFormOnly=false] - True if this tab should only be enabled on a record form.
     */
    constructor(id, label, icon, isFormOnly = Config.BASE_COMPONENT_DEFAULTS.isFormOnly) {
        // Enforce the abstract nature of this class, preventing direct instantiation.
        if (new.target === BaseComponent) {
            throw new TypeError(Config.BASE_COMPONENT_ERRORS.abstractInstantiation);
        }
        this.id = id;
        this.label = label;
        this.icon = icon;
        this.isFormOnly = isFormOnly;
    }

    /**
     * Renders the component's main content. **Subclasses must override this method.**
     *
     * The base implementation serves two purposes: it provides a fallback error message
     * if not overridden, and it handles the disabling of form-only tabs when not in a
     * form context.
     *
     * @async
     * @returns {Promise<HTMLElement>} A promise that resolves to the root HTML element of the component.
     */
    async render() {
        // If a form-only component is loaded outside a form context, show a standard message and stop.
        if (this.isFormOnly && !PowerAppsApiService.isFormContextAvailable) {
            return UIFactory.createFormDisabledMessage();
        }

        // This serves as a placeholder and a reminder for developers to implement the method.
        const el = document.createElement('div');
        el.innerHTML = `<p class="pdt-error">${Config.BASE_COMPONENT_ERRORS.renderNotImplemented(this.label)}</p>`;
        return el;
    }

    /**
     * A lifecycle hook called after the component's rendered content has been added to the DOM.
     * Subclasses can override this method to attach event listeners or perform other DOM manipulations
     * that require the element to be present in the document.
     *
     * @param {HTMLElement} element - The root element of the component that was just rendered.
     */
    postRender(element) {
        // This is a "no-op" (no operation) by default. Subclasses can override if needed.
    }

    /**
     * A lifecycle hook for cleaning up the component.
     * This is called when the main dialog is closed or the component is being completely reloaded.
     * Subclasses should override this to remove event listeners, clear intervals/timeouts, or release any other resources.
     */
    destroy() {
        // This is a "no-op" by default. Subclasses can override if they need to perform cleanup.
    }
}