/**
 * @file Manages the registration and retrieval of all available components.
 * @module core/ComponentRegistry
 * @description A central registry for all feature tab components. This allows the application
 * to dynamically discover and load features without being tightly coupled to them.
 */

import { Config } from '../constants/index.js';
import { NotificationService } from '../services/NotificationService.js';

/**
 * A map to store component instances, keyed by their unique ID.
 * @private
 * @type {Map<string, import('./BaseComponent.js').BaseComponent>}
 */
const components = new Map();

/**
 * Validates if a component is valid for registration.
 * @private
 * @param {any} component - The component to validate.
 * @returns {boolean} True if the component is valid, false otherwise.
 */
function _isValidComponent(component) {
    return component && component.id;
}

/**
 * The ComponentRegistry provides methods to manage UI components.
 * Its single responsibility is to act as a directory for all feature modules.
 * @namespace
 */
export const ComponentRegistry = {
    /**
     * Adds a component instance to the registry.
     * @param {import('./BaseComponent.js').BaseComponent} component - The component instance to register.
     * @returns {void}
     */
    register(component) {
        if (!_isValidComponent(component)) {
            NotificationService.show(Config.COMPONENT_REGISTRY_MESSAGES.invalidComponent, 'error');
            return;
        }

        if (components.has(component.id)) {
            NotificationService.show(Config.COMPONENT_REGISTRY_MESSAGES.duplicateComponent(component.id), 'warn');
        }
        components.set(component.id, component);
    },

    /**
     * Retrieves a component instance by its ID.
     * @param {string} id - The unique ID of the component to retrieve.
     * @returns {import('./BaseComponent.js').BaseComponent | undefined} The component instance, or undefined if not found.
     */
    get(id) {
        return components.get(id);
    },

    /**
     * Checks if a component with the given ID is registered.
     * @param {string} id - The unique ID of the component to check.
     * @returns {boolean} True if the component is registered, false otherwise.
     */
    has(id) {
        return components.has(id);
    },

    /**
     * Retrieves all registered components as an array.
     * @returns {import('./BaseComponent.js').BaseComponent[]} An array of all registered component instances.
     */
    getAll() {
        return Array.from(components.values());
    }
};