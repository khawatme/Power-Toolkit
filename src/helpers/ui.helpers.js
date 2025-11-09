/**
 * @file UI manipulation and interaction utilities.
 * @module helpers/ui.helpers
 * @description Provides utilities for accordion controls, pagination, table sorting, and UI state management.
 */

/**
 * UI manipulation utility functions.
 * @namespace UIHelpers
 */
export const UIHelpers = {
    /**
     * Updates pagination UI elements with current page state.
     * @param {HTMLButtonElement} prevBtn - Previous page button element.
     * @param {HTMLButtonElement} nextBtn - Next page button element.
     * @param {HTMLElement} pageInfo - Page info text element.
     * @param {number} currentPage - Current page number (1-indexed).
     * @param {boolean} hasNext - Whether there is a next page available.
     */
    updatePaginationUI(prevBtn, nextBtn, pageInfo, currentPage, hasNext) {
        if (pageInfo) {
            pageInfo.textContent = `Page ${currentPage}`;
        }
        if (prevBtn) {
            prevBtn.disabled = currentPage === 1;
        }
        if (nextBtn) {
            nextBtn.disabled = !hasNext;
        }
    },

    /**
     * Toggles an element's height with smooth animation using maxHeight.
     * Useful for expand/collapse effects on details sections.
     * @param {HTMLElement} element - The element to toggle.
     */
    toggleElementHeight(element) {
        if (!element) {
            return;
        }
        const isOpen = element.style.maxHeight && element.style.maxHeight !== '0px';
        element.style.maxHeight = isOpen ? '0px' : `${element.scrollHeight}px`;
    },

    /**
     * Toggles an accordion category's expanded/collapsed state.
     * Manages both CSS class and ARIA attributes for accessibility.
     * @param {HTMLElement} categoryElement - The category element to toggle.
     * @param {string} headerSelector - CSS selector for the header within the category (default: '.codehub-category-header').
     * @returns {boolean} - True if expanded, false if collapsed.
     */
    toggleAccordionCategory(categoryElement, headerSelector = '.codehub-category-header') {
        if (!categoryElement) {
            return false;
        }
        const isExpanded = categoryElement.classList.toggle('expanded');
        const header = categoryElement.querySelector(headerSelector);
        if (header) {
            header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        }
        return isExpanded;
    },

    /**
     * Sets all accordion categories to expanded or collapsed state.
     * Useful for "Expand All" / "Collapse All" functionality.
     * @param {HTMLElement} container - The container element with categories.
     * @param {string} categorySelector - CSS selector for category elements.
     * @param {boolean} expand - True to expand all, false to collapse all.
     * @param {string} headerSelector - CSS selector for headers within categories (default: '.codehub-category-header').
     */
    setAllAccordionCategories(container, categorySelector, expand, headerSelector = '.codehub-category-header') {
        if (!container) {
            return;
        }
        container.querySelectorAll(categorySelector).forEach(cat => {
            if (expand) {
                cat.classList.add('expanded');
            } else {
                cat.classList.remove('expanded');
            }
            const header = cat.querySelector(headerSelector);
            if (header) {
                header.setAttribute('aria-expanded', expand ? 'true' : 'false');
            }
        });
    },

    /**
     * Collapses all accordion items within a container.
     * Removes 'expanded' class and sets maxHeight to 0 for smooth collapse animation.
     * @param {HTMLElement} container - The container element with accordion items.
     * @param {string} itemSelector - CSS selector for accordion items (e.g., '.help-card').
     * @param {string} detailsSelector - CSS selector for the expandable content within each item.
     */
    collapseAllAccordionItems(container, itemSelector, detailsSelector) {
        if (!container) {
            return;
        }
        container.querySelectorAll(`${itemSelector}.expanded`).forEach(item => {
            item.classList.remove('expanded');
            const details = item.querySelector(detailsSelector);
            if (details) {
                details.style.maxHeight = '0px';
            }
        });
    },

    /**
     * Builds a searchable index string from multiple text fields.
     * Combines fields into lowercase string for case-insensitive searching.
     * @param {Array<string>} fields - Array of text values to include in search index.
     * @returns {string} - Lowercase concatenated search index.
     */
    buildSearchIndex(...fields) {
        return fields.filter(f => f).join(' ').toLowerCase();
    },

    /**
     * Sorts an array of objects by a specified column/property in ascending or descending order.
     * Uses case-insensitive localeCompare for string comparisons.
     * @param {Array<object>} array - The array to sort (will be sorted in-place).
     * @param {string} column - The property/column name to sort by.
     * @param {'asc'|'desc'} direction - The sort direction ('asc' for ascending, 'desc' for descending).
     * @returns {Array<object>} The sorted array (same reference as input).
     */
    sortArrayByColumn(array, column, direction = 'asc') {
        if (!Array.isArray(array) || array.length === 0) {
            return array;
        }

        const multiplier = direction === 'asc' ? 1 : -1;
        array.sort((a, b) => {
            const valA = a[column];
            const valB = b[column];

            // Handle null/undefined values
            if ((valA === null || valA === undefined) && (valB === null || valB === undefined)) {
                return 0;
            }
            if (valA === null || valA === undefined) {
                return 1 * multiplier;
            }
            if (valB === null || valB === undefined) {
                return -1 * multiplier;
            }

            // Use localeCompare for string comparison
            return String(valA).localeCompare(String(valB), undefined, { sensitivity: 'base' }) * multiplier;
        });

        return array;
    },

    /**
     * Updates a sort state object when a column is clicked, toggling direction for the same column
     * or resetting to 'asc' for a new column.
     * @param {{column: string, direction: 'asc'|'desc'}} sortState - The current sort state object.
     * @param {string} newColumn - The column being clicked/selected.
     * @returns {{column: string, direction: 'asc'|'desc'}} The updated sort state (same reference).
     */
    toggleSortState(sortState, newColumn) {
        if (sortState.column === newColumn) {
            // Toggle direction for the same column
            sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // New column, reset to ascending
            sortState.column = newColumn;
            sortState.direction = 'asc';
        }
        return sortState;
    },

    /**
     * Generates HTML for sortable table headers with sort direction indicators.
     * @param {Array<{key: string, label: string}>} headers - Array of header definitions.
     * @param {{column: string, direction: 'asc'|'desc'}} sortState - Current sort state.
     * @returns {string} HTML string for table header row.
     */
    generateSortableTableHeaders(headers, sortState) {
        if (!Array.isArray(headers)) {
            return '';
        }

        // Import escapeHtml dynamically to avoid circular dependency
        const escapeHtml = (str) => {
            const p = document.createElement('p');
            p.textContent = String(str ?? '');
            return p.innerHTML;
        };

        const headerCells = headers.map(header => {
            const isSorted = sortState.column === header.key;
            const sortClass = isSorted ? `sort-${sortState.direction}` : '';
            const ariaSort = isSorted
                ? (sortState.direction === 'asc' ? 'ascending' : 'descending')
                : 'none';

            return `<th class="${sortClass}" data-sort-key="${escapeHtml(header.key)}" aria-sort="${ariaSort}" tabindex="0" role="button" aria-label="Sort by ${escapeHtml(header.label)}">${escapeHtml(header.label)}</th>`;
        }).join('');

        return `<tr>${headerCells}</tr>`;
    }
};
