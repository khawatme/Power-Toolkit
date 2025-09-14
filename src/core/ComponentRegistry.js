/**
 * @file Manages the registration and retrieval of all available components.
 * @module core/ComponentRegistry
 * @description A central registry for all feature tab components. This allows the application
 * to dynamically discover and load features without being tightly coupled to them.
 */

/**
 * A map to store component instances, keyed by their unique ID.
 * @private
 * @type {Map<string, import('./BaseComponent.js').BaseComponent>}
 */
const components = new Map();

/**
 * The ComponentRegistry provides methods to manage UI components.
 * Its single responsibility is to act as a directory for all feature modules.
 * @namespace
 */
export const ComponentRegistry = {
    /**
     * Adds a component instance to the registry.
     * @param {import('./BaseComponent.js').BaseComponent} component - The component instance to register.
     */
    register(component) {
        if (!component || !component.id) {
            console.error("PDT Error: Attempted to register an invalid component.", component);
            return;
        }
        
        if (components.has(component.id)) {
            console.warn(`PDT Warning: A component with ID '${component.id}' is already registered. Overwriting.`);
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
     * Retrieves all registered components as an array.
     * @returns {import('./BaseComponent.js').BaseComponent[]} An array of all component instances.
     */
    getAll() {
        return Array.from(components.values());
    }
};