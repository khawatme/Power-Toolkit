/**
 * @file A reusable dialog for browsing and selecting Dataverse metadata (tables/columns).
 * @module ui/MetadataBrowserDialog
 */
import { DataService } from '../services/DataService.js';
import { DialogService } from '../services/DialogService.js';
import { debounce, escapeHtml, generateSortableTableHeaders, getMetadataDisplayName, sortArrayByColumn, toggleSortState, UIHelpers } from '../helpers/index.js';
import { Config } from '../constants/index.js';

/**
 * Callback function executed when a user selects a metadata item.
 * @callback MetadataSelectCallback
 * @param {object} selectedItem - The full metadata object for the selected entity or attribute.
 * @returns {void}
 */

export const MetadataBrowserDialog = {
    /**
     * Shows a searchable, filterable dialog to select a table (entity) or column (attribute).
     *
     * @param {'entity' | 'attribute'} type - The type of metadata to browse.
     * @param {MetadataSelectCallback} onSelect - The callback function executed with the selected metadata object.
     * @param {string} [entityLogicalName] - The logical name of the parent entity. This is required
     * when the `type` is 'attribute'.
     * @returns {Promise<void>}
     */
    async show(type, onSelect, entityLogicalName = null) {
        if (type === 'attribute' && !entityLogicalName) {
            DialogService.show(Config.METADATA_BROWSER_DIALOG.errorTitle, Config.METADATA_BROWSER_DIALOG.errorMessage);
            return;
        }

        const title = type === 'entity'
            ? Config.METADATA_BROWSER_DIALOG.titleEntity
            : Config.METADATA_BROWSER_DIALOG.titleAttribute(entityLogicalName);
        const placeholder = type === 'entity'
            ? Config.METADATA_BROWSER_DIALOG.placeholderEntity
            : Config.METADATA_BROWSER_DIALOG.placeholderAttribute;

        const dialogContent = document.createElement('div');
        dialogContent.className = 'pdt-full-height-column';
        dialogContent.style.height = '60vh';
        dialogContent.innerHTML = `
            <input type="text" id="pdt-metadata-search" class="pdt-input mb-15" placeholder="${placeholder}">
            <div id="pdt-metadata-list" class="pdt-table-wrapper flex-grow">
                ${Config.METADATA_BROWSER_DIALOG.loadingMessage}
            </div>
        `;

        const dialog = DialogService.show(title, dialogContent);

        const searchInput = dialogContent.querySelector('#pdt-metadata-search');
        const listContainer = dialogContent.querySelector('#pdt-metadata-list');
        let allItems = [];
        let enrichedItems = []; // Cached items with computed properties
        const sortState = { column: '_displayName', direction: 'asc' };

        try {
            allItems = type === 'entity'
                ? await DataService.getEntityDefinitions()
                : await DataService.getAttributeDefinitions(entityLogicalName);

            // Pre-compute display names and search index once to avoid repeated calculations
            enrichedItems = allItems.map(item => ({
                ...item,
                _displayName: getMetadataDisplayName(item),
                _searchIndex: (getMetadataDisplayName(item) + ' ' + item.LogicalName).toLowerCase()
            }));
        } catch (e) {
            listContainer.innerHTML = `<div class="pdt-error">Could not load metadata: ${e.message}</div>`;
            return;
        }

        /**
         * Filters items based on search term.
         * @param {string} searchTerm - The search term to filter by.
         * @returns {Array} Filtered items.
         */
        const getFilteredItems = (searchTerm) => {
            if (!searchTerm) {
                return enrichedItems;
            }
            const term = searchTerm.toLowerCase();
            return enrichedItems.filter(item => item._searchIndex.includes(term));
        };

        const renderList = (items) => {
            // Sort items by current sort state (items already have _displayName)
            sortArrayByColumn(items, sortState.column, sortState.direction);

            const rows = items.map(item => `
                <tr class="copyable-cell" data-logical-name="${item.LogicalName}" title="${Config.METADATA_BROWSER_DIALOG.clickToSelect}">
                    <td>${escapeHtml(item._displayName)}</td>
                    <td class="code-like">${item.LogicalName}</td>
                </tr>
            `).join('');

            const headers = [
                { key: '_displayName', label: Config.METADATA_BROWSER_DIALOG.headerDisplayName },
                { key: 'LogicalName', label: Config.METADATA_BROWSER_DIALOG.headerLogicalName }
            ];
            const headerHtml = generateSortableTableHeaders(headers, sortState);

            listContainer.innerHTML = `
                <table class="pdt-table">
                    <thead>${headerHtml}</thead>
                    <tbody>${rows}</tbody>
                </table>`;

            const table = listContainer.querySelector('table');
            if (table) {
                UIHelpers.initColumnResize(table);
            }
        };

        // Store event handlers for cleanup
        const handleSearchKeyup = debounce(() => {
            renderList(getFilteredItems(searchInput.value));
        }, 200);

        // Helper to handle sorting (used by both click and keyboard events)
        const handleSort = (header) => {
            const sortKey = header.dataset.sortKey;
            toggleSortState(sortState, sortKey);
            renderList(getFilteredItems(searchInput.value));
        };

        const handleListClick = (e) => {
            // Handle header clicks for sorting
            const header = e.target.closest('th[data-sort-key]');
            if (header) {
                handleSort(header);
                return;
            }

            const row = e.target.closest('tr[data-logical-name]');
            if (row) {
                const selectedItem = enrichedItems.find(item => item.LogicalName === row.dataset.logicalName);
                if (selectedItem) {
                    onSelect(selectedItem);
                    dialog.close();
                }
            }
        };

        const handleListKeydown = (e) => {
            const header = e.target.closest('th[data-sort-key]');
            if (header && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                handleSort(header);
            }
        };

        // Cleanup function to remove event listeners
        const cleanup = () => {
            if (searchInput && handleSearchKeyup) {
                searchInput.removeEventListener('keyup', handleSearchKeyup);
                // Cancel any pending debounced search
                if (handleSearchKeyup.cancel) {
                    handleSearchKeyup.cancel();
                }
            }
            if (listContainer) {
                listContainer.removeEventListener('click', handleListClick);
                listContainer.removeEventListener('keydown', handleListKeydown);

                const table = listContainer.querySelector('table');
                if (table) {
                    UIHelpers.destroyColumnResize(table);
                }
            }
        };

        // Override dialog close to include cleanup
        const originalClose = dialog.close;
        dialog.close = () => {
            cleanup();
            originalClose();
        };

        searchInput.addEventListener('keyup', handleSearchKeyup);
        listContainer.addEventListener('click', handleListClick);
        listContainer.addEventListener('keydown', handleListKeydown);

        renderList(enrichedItems);
    }
};