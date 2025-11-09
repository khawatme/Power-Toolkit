/**
 * @file DOM manipulation and tree utilities.
 * @module helpers/dom.helpers
 * @description Provides utilities for DOM manipulation, tree searching, and element management.
 */

/**
 * DOM manipulation utility functions.
 * @namespace DOMHelpers
 */
export const DOMHelpers = {
    /**
     * Appends a timestamped log entry to a container with automatic trimming and auto-scrolling.
     * Useful for event monitors, trace logs, and other streaming log displays.
     * @param {HTMLElement} container - The container element to append the log entry to.
     * @param {string} className - CSS class name(s) for styling the log entry.
     * @param {string} message - The log message text.
     * @param {number} [maxEntries=500] - Maximum number of log entries to keep (older entries are removed).
     * @param {boolean} [autoScroll=true] - Whether to auto-scroll to the bottom after adding entry.
     * @returns {HTMLElement|null} The created log entry element, or null if container is invalid.
     */
    appendLogEntry(container, className, message, maxEntries = 500, autoScroll = true) {
        if (!container) {
            return null;
        }

        const entry = document.createElement('div');
        entry.className = `log-entry ${className}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        container.appendChild(entry);

        // Trim from the top if we exceed the cap
        while (container.childElementCount > maxEntries) {
            container.removeChild(container.firstElementChild);
        }

        if (autoScroll) {
            container.scrollTop = container.scrollHeight;
        }

        return entry;
    },

    /**
     * Clears all child elements from a container.
     * @param {HTMLElement} container - The container element to clear.
     * @returns {boolean} True if cleared successfully, false if container is invalid.
     */
    clearContainer(container) {
        if (!container) {
            return false;
        }
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        return true;
    },

    /**
     * Recursively searches a tree structure for a node matching a specified property value.
     * @param {Array<object>} nodes - The array of tree nodes to search.
     * @param {string} propertyName - The name of the property to match (e.g., 'logicalName', 'id').
     * @param {*} value - The value to search for.
     * @param {string} [childrenKey='children'] - The property name that contains child nodes.
     * @returns {object|null} The found node object, or null if not found.
     */
    findNodeInTree(nodes, propertyName, value, childrenKey = 'children') {
        if (!Array.isArray(nodes)) {
            return null;
        }

        for (const node of nodes) {
            if (node[propertyName] === value) {
                return node;
            }
            if (node[childrenKey]) {
                const found = this.findNodeInTree(node[childrenKey], propertyName, value, childrenKey);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }
};
