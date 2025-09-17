/**
 * @file A reusable dialog for browsing and selecting Dataverse metadata (tables/columns).
 * @module ui/MetadataBrowserDialog
 */
import { DataService } from '../services/DataService.js';
import { DialogService } from '../services/DialogService.js';
import { Helpers } from '../utils/Helpers.js';

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
            DialogService.show('Error', '<p>A table name must be provided before browsing for columns.</p>');
            return;
        }

        const title = type === 'entity' ? 'Select a Table' : `Select a Column for ${entityLogicalName}`;
        const placeholder = type === 'entity' ? 'Search for a table...' : 'Search for a column...';

        const dialogContent = document.createElement('div');
        dialogContent.style.display = 'flex';
        dialogContent.style.flexDirection = 'column';
        dialogContent.style.height = '60vh';
        dialogContent.innerHTML = `
            <input type="text" id="pdt-metadata-search" class="pdt-input" placeholder="${placeholder}" style="margin-bottom: 10px;">
            <div id="pdt-metadata-list" class="pdt-table-wrapper" style="flex-grow:1;">
                <p class="pdt-note">Loading metadata...</p>
            </div>
        `;

        const dialog = DialogService.show(title, dialogContent);
        
        const searchInput = dialogContent.querySelector('#pdt-metadata-search');
        const listContainer = dialogContent.querySelector('#pdt-metadata-list');
        let allItems = [];
        
        try {
            allItems = type === 'entity' 
                ? await DataService.getEntityDefinitions()
                : await DataService.getAttributeDefinitions(entityLogicalName);
        } catch (e) {
            listContainer.innerHTML = `<div class="pdt-error">Could not load metadata: ${e.message}</div>`;
            return;
        }

        const renderList = (items) => {
            const getDisplayName = item => item.DisplayName?.UserLocalizedLabel?.Label || item.SchemaName;
            // Sort items alphabetically by display name
            items.sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));

            const rows = items.map(item => `
                <tr class="copyable-cell" data-logical-name="${item.LogicalName}" title="Click to select">
                    <td>${getDisplayName(item)}</td>
                    <td class="code-like">${item.LogicalName}</td>
                </tr>
            `).join('');

            listContainer.innerHTML = `
                <table class="pdt-table">
                    <thead><tr><th>Display Name</th><th>Logical Name</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>`;
        };
        
        searchInput.addEventListener('keyup', Helpers.debounce(() => {
            const term = searchInput.value.toLowerCase();
            const getDisplayName = item => (item.DisplayName?.UserLocalizedLabel?.Label || item.SchemaName).toLowerCase();
            const filteredItems = allItems.filter(item => 
                getDisplayName(item).includes(term) ||
                item.LogicalName.toLowerCase().includes(term)
            );
            renderList(filteredItems);
        }, 200));

        listContainer.addEventListener('click', e => {
            const row = e.target.closest('tr[data-logical-name]');
            if (row) {
                const selectedItem = allItems.find(item => item.LogicalName === row.dataset.logicalName);
                if (selectedItem) {
                    onSelect(selectedItem);
                    dialog.close();
                }
            }
        });

        renderList(allItems);
    }
};