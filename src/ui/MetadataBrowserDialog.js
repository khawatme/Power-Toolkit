/**
 * @file A reusable dialog for browsing and selecting Dataverse metadata (tables/columns).
 * @module ui/MetadataBrowserDialog
 */
import { DataService } from '../services/DataService.js';
import { DialogService } from '../services/DialogService.js';
import { debounce, escapeHtml, getMetadataDisplayName, sortArrayByColumn } from '../helpers/index.js';
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

        try {
            allItems = type === 'entity'
                ? await DataService.getEntityDefinitions()
                : await DataService.getAttributeDefinitions(entityLogicalName);
        } catch (e) {
            listContainer.innerHTML = `<div class="pdt-error">Could not load metadata: ${e.message}</div>`;
            return;
        }

        const renderList = (items) => {
            // Add temporary _displayName property for sorting
            items.forEach(item => {
                item._displayName = getMetadataDisplayName(item);
            });

            // Sort items alphabetically by display name
            sortArrayByColumn(items, '_displayName', 'asc');

            const rows = items.map(item => `
                <tr class="copyable-cell" data-logical-name="${item.LogicalName}" title="${Config.METADATA_BROWSER_DIALOG.clickToSelect}">
                    <td>${escapeHtml(item._displayName)}</td>
                    <td class="code-like">${item.LogicalName}</td>
                </tr>
            `).join('');

            listContainer.innerHTML = `
                <table class="pdt-table">
                    <thead><tr><th>${Config.METADATA_BROWSER_DIALOG.headerDisplayName}</th><th>${Config.METADATA_BROWSER_DIALOG.headerLogicalName}</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>`;
        };

        searchInput.addEventListener('keyup', debounce(() => {
            const term = searchInput.value.toLowerCase();
            const filteredItems = allItems.filter(item => {
                const displayName = getMetadataDisplayName(item).toLowerCase();
                return displayName.includes(term) || item.LogicalName.toLowerCase().includes(term);
            });
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