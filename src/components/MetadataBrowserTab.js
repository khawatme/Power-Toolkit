/**
 * @file A standalone Dataverse metadata browser component.
 * @module components/MetadataBrowserTab
 * @description Provides a two-panel UI to browse and search for tables (entities)
 * and their corresponding columns (attributes), with a detailed view for each item.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { DataService } from '../services/DataService.js';
import { debounce, escapeHtml, filterODataProperties, generateSortableTableHeaders, getMetadataDisplayName, sortArrayByColumn, toggleSortState } from '../helpers/index.js';
import { UIHelpers } from '../helpers/ui.helpers.js';
import { DialogService } from '../services/DialogService.js';
import { Store } from '../core/Store.js';
import { Config } from '../constants/index.js';

const _debounce = debounce || ((fn, wait = 200) => {
    let t;
    const debouncedFn = (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(null, args), wait);
    };
    debouncedFn.cancel = () => {
        clearTimeout(t);
        t = null;
    };
    return debouncedFn;
});

/**
 * A component that provides a master-detail view for browsing Dataverse metadata.
 * It is reactive to impersonation changes via the central store.
 * @class MetadataBrowserTab
 * @extends {BaseComponent}
 * @property {object} ui - A cache for frequently accessed UI elements.
 * @property {Array<object>} allEntities - The complete, filtered list of entity definitions.
 * @property {object|null} selectedEntity - The metadata for the currently selected entity.
 * @property {Array<object>} selectedEntityAttributes - The attribute definitions for the selected entity.
 * @property {Function|null} unsubscribe - The function to call to unsubscribe from store updates.
 * @property {{column: string, direction: 'asc'|'desc'}} entitySortState - Current sort state for the entity table.
 * @property {{column: string, direction: 'asc'|'desc'}} attributeSortState - Current sort state for the attribute table.
 */
export class MetadataBrowserTab extends BaseComponent {
    /**
     * Initializes the MetadataBrowserTab component.
     */
    constructor() {
        super('metadataBrowser', 'Metadata Browser', ICONS.metadata);
        this.ui = {};
        this.allEntities = [];
        this.selectedEntity = null;
        this.selectedEntityAttributes = [];
        this.unsubscribe = null;
        /** @private */ this._loadToken = 0;
        /** @private */ this._attrLoadToken = 0;
        /** @private */ this._persistKey = 'pdt-metadata:lastEntity';

        // Event handler references for cleanup
        /** @private {Function|null} */ this._entitySearchHandler = null;
        /** @private {Function|null} */ this._attributeSearchHandler = null;
        /** @private {Function|null} */ this._entityListClickHandler = null;
        /** @private {Function|null} */ this._entityListKeydownHandler = null;
        /** @private {Function|null} */ this._attributeListClickHandler = null;
        /** @private {Function|null} */ this._attributeListKeydownHandler = null;
        /** @private {Function|null} */ this._resizerMousedownHandler = null;
        /** @private {Function|null} */ this._handleEntitySort = null;
        /** @private {Function|null} */ this._handleAttributeSort = null;
        /** @private {Object|null} */ this._activeDragHandlers = null;
        this.entitySortState = { column: '_displayName', direction: 'asc' };
        this.attributeSortState = { column: '_displayName', direction: 'asc' };

        // Map to track dynamically created event handlers for proper cleanup
        // Each entry: element -> {event: 'click', handler: Function}
        /** @private @type {Map<HTMLElement, {event: string, handler: Function}>} */
        this._dynamicHandlers = new Map();
    }

    /**
     * Renders the component's two-panel HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.className = 'pdt-full-height-column';

        container.innerHTML = `
            <div class="section-title flex-shrink-0">Metadata Browser</div>
            
            <div class="pdt-metadata-browser">
                <div class="pdt-metadata-panel entities">
                    <div class="pdt-metadata-panel-header">
                        <input type="text" id="pdt-entity-search" class="pdt-input" placeholder="${Config.COMMON_PLACEHOLDERS.searchTables}">
                    </div>
                    <div id="pdt-entity-list-container" class="pdt-metadata-panel-body">
                        <p class="pdt-note">Loading tables...</p>
                    </div>
                </div>

                <div class="pdt-resizer" id="pdt-metadata-resizer"></div>

                <div class="pdt-metadata-panel attributes">
                    <div class="pdt-metadata-panel-header">
                        <input type="text" id="pdt-attribute-search" class="pdt-input" placeholder="Search columns..." disabled>
                    </div>
                    <div id="pdt-attribute-list-container" class="pdt-metadata-panel-body">
                        <p class="pdt-note">Select a table to view its columns.</p>
                    </div>
                </div>
                
            </div>
        `;
        return container;
    }

    /**
     * Caches UI elements, subscribes to the central store for impersonation changes,
     * triggers the initial data load, and attaches event listeners for search and selection.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        this.ui = {
            container: element,
            entitySearch: element.querySelector('#pdt-entity-search'),
            entityList: element.querySelector('#pdt-entity-list-container'),
            attributeSearch: element.querySelector('#pdt-attribute-search'),
            attributeList: element.querySelector('#pdt-attribute-list-container'),
            resizer: element.querySelector('#pdt-metadata-resizer') // <-- ADD THIS LINE
        };

        // Subscribe to store changes to react to impersonation.
        this.unsubscribe = Store.subscribe((newState, oldState) => {
            if (newState.impersonationUserId !== oldState.impersonationUserId) {
                this._loadData();
            }
        });

        // Initial data load.
        this._loadData();

        // Store debounced handlers for cleanup
        this._entitySearchHandler = _debounce(() => this._filterEntityList(), 200);
        this._attributeSearchHandler = _debounce(() => this._filterAttributeList(), 200);

        this.ui.entitySearch.addEventListener('keyup', this._entitySearchHandler);
        this.ui.attributeSearch.addEventListener('keyup', this._attributeSearchHandler);

        // Helper to handle sorting (stored as instance property to avoid closure leak)
        this._handleEntitySort = (header) => {
            const sortKey = header.dataset.sortKey;
            toggleSortState(this.entitySortState, sortKey);
            this._filterEntityList();
        };

        // Store event handlers for cleanup
        this._entityListClickHandler = (e) => {
            // Handle header clicks for sorting
            const header = e.target.closest('th[data-sort-key]');
            if (header) {
                this._handleEntitySort(header);
                return;
            }

            const row = e.target.closest('tr[data-logical-name]');
            if (row) {
                const logicalName = row.dataset.logicalName;
                this._handleEntitySelect(logicalName);
                const entity = this.allEntities.find(e => e.LogicalName === row.dataset.logicalName);
                if (entity) {
                    const title = getMetadataDisplayName(entity);
                    this._showMetadataDetailsDialog(`Table Details: ${title}`, entity);
                }
                this.ui.entityList.querySelectorAll('tr').forEach(r => r.classList.remove('active'));
                row.classList.add('active');
            }
        };

        this._entityListKeydownHandler = (e) => {
            const header = e.target.closest('th[data-sort-key]');
            if (header && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                this._handleEntitySort(header);
            }
        };

        this.ui.entityList.addEventListener('click', this._entityListClickHandler);
        this.ui.entityList.addEventListener('keydown', this._entityListKeydownHandler);

        // Helper to handle sorting (stored as instance property to avoid closure leak)
        this._handleAttributeSort = (header) => {
            const sortKey = header.dataset.sortKey;
            toggleSortState(this.attributeSortState, sortKey);
            this._filterAttributeList();
        };

        this._attributeListClickHandler = (e) => {
            // Handle header clicks for sorting
            const header = e.target.closest('th[data-sort-key]');
            if (header) {
                this._handleAttributeSort(header);
                return;
            }

            const row = e.target.closest('tr[data-logical-name]');
            if (row) {
                const attribute = this.selectedEntityAttributes.find(a => a.LogicalName === row.dataset.logicalName);
                if (attribute) {
                    const title = getMetadataDisplayName(attribute);
                    this._showMetadataDetailsDialog(`Column Details: ${title}`, attribute);
                }
            }
        };

        this._attributeListKeydownHandler = (e) => {
            const header = e.target.closest('th[data-sort-key]');
            if (header && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                this._handleAttributeSort(header);
            }
        };

        this.ui.attributeList.addEventListener('click', this._attributeListClickHandler);
        this.ui.attributeList.addEventListener('keydown', this._attributeListKeydownHandler);

        // Setup panel resizer
        this._makePanelsResizable();
    }

    /**
     * Sets up the resizable panels by attaching drag handlers to the resizer element.
     * @private
     */
    _makePanelsResizable() {
        if (!this.ui.resizer) {
            return;
        }

        // Store resizer handler for cleanup
        this._resizerMousedownHandler = (e) => {
            e.preventDefault();

            const startX = e.clientX;
            const startWidth = this.ui.resizer.previousElementSibling.offsetWidth;

            const handleDrag = (moveEvent) => {
                const newWidth = startWidth + (moveEvent.clientX - startX);
                if (newWidth > 200 && newWidth < (this.ui.container.offsetWidth - 200)) {
                    this.ui.resizer.previousElementSibling.style.flexBasis = `${newWidth}px`;
                }
            };

            const stopDrag = () => {
                document.removeEventListener('mousemove', handleDrag);
                document.removeEventListener('mouseup', stopDrag);
                document.body.style.cursor = '';
                this._activeDragHandlers = null; // Clear reference after cleanup
            };

            // Store active drag handlers for potential mid-drag cleanup
            this._activeDragHandlers = { handleDrag, stopDrag };

            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', stopDrag);
            document.body.style.cursor = 'col-resize';
        };

        this.ui.resizer.addEventListener('mousedown', this._resizerMousedownHandler);
    }

    /**
     * Lifecycle hook for cleaning up resources, including event listeners and store subscription, to prevent memory leaks.
     */
    destroy() {
        // Unsubscribe from store
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        // Remove search handlers
        if (this.ui.entitySearch && this._entitySearchHandler) {
            this.ui.entitySearch.removeEventListener('keyup', this._entitySearchHandler);
            // Cancel any pending debounced entity search
            if (this._entitySearchHandler.cancel) {
                this._entitySearchHandler.cancel();
            }
        }
        if (this.ui.attributeSearch && this._attributeSearchHandler) {
            this.ui.attributeSearch.removeEventListener('keyup', this._attributeSearchHandler);
            // Cancel any pending debounced attribute search
            if (this._attributeSearchHandler.cancel) {
                this._attributeSearchHandler.cancel();
            }
        }

        // Remove list handlers
        if (this.ui.entityList) {
            if (this._entityListClickHandler) {
                this.ui.entityList.removeEventListener('click', this._entityListClickHandler);
            }
            if (this._entityListKeydownHandler) {
                this.ui.entityList.removeEventListener('keydown', this._entityListKeydownHandler);
            }
        }

        if (this.ui.attributeList) {
            if (this._attributeListClickHandler) {
                this.ui.attributeList.removeEventListener('click', this._attributeListClickHandler);
            }
            if (this._attributeListKeydownHandler) {
                this.ui.attributeList.removeEventListener('keydown', this._attributeListKeydownHandler);
            }
        }

        // Remove resizer handler
        if (this.ui.resizer && this._resizerMousedownHandler) {
            this.ui.resizer.removeEventListener('mousedown', this._resizerMousedownHandler);
        }

        // Clean up active drag handlers if destroy is called during a drag operation
        if (this._activeDragHandlers) {
            document.removeEventListener('mousemove', this._activeDragHandlers.handleDrag);
            document.removeEventListener('mouseup', this._activeDragHandlers.stopDrag);
            document.body.style.cursor = ''; // Reset cursor
            this._activeDragHandlers = null;
        }

        // Clean up all dynamically created handlers (notification close buttons, etc.)
        for (const [element, { event, handler }] of this._dynamicHandlers.entries()) {
            element.removeEventListener(event, handler);
        }
        this._dynamicHandlers.clear();

        // Destroy any column-resize handlers for the entity/attribute tables
        try {
            const entityTable = this.ui.entityList.querySelector('table.pdt-table');
            if (entityTable) {
                UIHelpers.destroyColumnResize(entityTable);
            }
            const attrTable = this.ui.attributeList.querySelector('table.pdt-table');
            if (attrTable) {
                UIHelpers.destroyColumnResize(attrTable);
            }
        } catch (_) {
            // ignore
        }
    }

    /**
     * Fetches entity definitions based on the current impersonation state and renders them to the UI.
     * Also displays a one-time warning if impersonation is active.
     * @private
     */
    async _loadData() {
        const myToken = ++this._loadToken;

        this.ui.entityList.innerHTML = `<p class="pdt-note">${Config.MESSAGES.METADATA_BROWSER.loadingTables}</p>`;
        this.ui.attributeList.innerHTML = `<p class="pdt-note">${Config.MESSAGES.METADATA_BROWSER.selectTable}</p>`;
        this.ui.attributeSearch.value = '';
        this.ui.attributeSearch.disabled = true;

        // Impersonation notice (unchanged behavior)
        const impersonationInfo = DataService.getImpersonationInfo?.() || {};
        const warningDismissed = sessionStorage.getItem('pdt-impersonation-warning-dismissed') === 'true';
        if (impersonationInfo.isImpersonating && !warningDismissed) {
            const notification = document.createElement('div');
            notification.className = 'pdt-note';
            notification.style.cssText = 'display:flex;align-items:center;gap:15px;margin:0 10px 10px';
            notification.innerHTML = `
      <span style="font-size:1.5em;">ℹ️</span>
      <div style="text-align:left;flex-grow:1;">
        <strong>Impersonation Active:</strong> Permission checks may generate expected errors in the console.
      </div>
      <button class="pdt-icon-btn pdt-close-btn" title="Dismiss" style="width:28px;height:28px;flex-shrink:0">&times;</button>`;
            const closeBtn = notification.querySelector('.pdt-close-btn');
            const notificationCloseHandler = (e) => {
                e.stopPropagation();
                sessionStorage.setItem('pdt-impersonation-warning-dismissed', 'true');
                notification.remove();
                // Clean up this handler
                if (closeBtn && this._dynamicHandlers.has(closeBtn)) {
                    closeBtn.removeEventListener('click', notificationCloseHandler);
                    this._dynamicHandlers.delete(closeBtn);
                }
            };
            if (closeBtn) {
                closeBtn.addEventListener('click', notificationCloseHandler);
                this._dynamicHandlers.set(closeBtn, { event: 'click', handler: notificationCloseHandler });
            }
            this.ui.entityList.prepend(notification);
        }

        try {
            const entities = await DataService.getEntityDefinitions();
            if (myToken !== this._loadToken) {
                return;
            } // stale
            this.allEntities = entities || [];
            this._renderEntityList(this.allEntities);

            // Try to restore the last selected entity
            const last = sessionStorage.getItem(this._persistKey);
            if (last && this.allEntities.some(e => e.LogicalName === last)) {
                this._handleEntitySelect(last); // async, race-safe in its own method
                // visually select the row
                const row = this.ui.entityList.querySelector(`tr[data-logical-name="${last}"]`);
                row?.classList.add('active');
            }
        } catch (e) {
            if (myToken !== this._loadToken) {
                return;
            }
            this.ui.entityList.innerHTML = `<div class="pdt-error">${Config.MESSAGES.METADATA_BROWSER.loadTablesFailed(escapeHtml(e.message || String(e)))}</div>`;
        }
    }

    /**
     * Handles the selection of an entity from the list by loading its attributes.
     * @param {string} logicalName - The logical name of the selected entity.
     * @private
     */
    async _handleEntitySelect(logicalName) {
        const myToken = ++this._attrLoadToken;

        this.selectedEntity = this.allEntities.find(e => e.LogicalName === logicalName) || null;
        if (!this.selectedEntity) {
            return;
        }

        // Persist selection
        sessionStorage.setItem(this._persistKey, logicalName);

        this.ui.attributeSearch.disabled = false;
        this.ui.attributeSearch.placeholder = `Search columns in ${this.selectedEntity.LogicalName}...`;
        this.ui.attributeList.innerHTML = `<p class="pdt-note">${Config.MESSAGES.METADATA_BROWSER.loadingColumns}</p>`;

        try {
            const attrs = await DataService.getAttributeDefinitions(logicalName);
            if (myToken !== this._attrLoadToken) {
                return;
            } // stale
            this.selectedEntityAttributes = attrs || [];
            this._renderAttributeList(this.selectedEntityAttributes);
        } catch (e) {
            if (myToken !== this._attrLoadToken) {
                return;
            }
            this.ui.attributeList.innerHTML = `<div class="pdt-error">${Config.MESSAGES.METADATA_BROWSER.loadColumnsFailed(escapeHtml(e.message || String(e)))}</div>`;
        }
    }

    /**
     * Renders the list of entities into the entity panel.
     * @param {Array<object>} entities - The array of entity definitions to render.
     * @private
     */
    _renderEntityList(entities) {
        const listContainer = this.ui.entityList;

        // Create a shallow copy with computed _displayName to avoid mutating original objects
        const validEntities = entities
            .filter(item => item && item.LogicalName)
            .map(item => ({
                ...item,
                _displayName: getMetadataDisplayName(item)
            }));

        sortArrayByColumn(validEntities, this.entitySortState.column, this.entitySortState.direction);

        const rows = validEntities.map(item => `
            <tr class="copyable-cell" data-logical-name="${item.LogicalName}" title="Click to view details and load columns">
                <td>${item._displayName}</td>
                <td class="code-like">${item.LogicalName}</td>
            </tr>`).join('');

        const headers = [
            { key: '_displayName', label: 'Display Name' },
            { key: 'LogicalName', label: 'Logical Name' }
        ];
        const headerHtml = generateSortableTableHeaders(headers, this.entitySortState);

        const tableHTML = `
            <table class="pdt-table">
                <thead>${headerHtml}</thead>
                <tbody>${rows}</tbody>
            </table>`;

        const loadingMessage = listContainer.querySelector('p.pdt-note');
        const existingTable = listContainer.querySelector('table');

        if (existingTable) {
            // If a table already exists (e.g., from a search filter), just update its content.
            existingTable.querySelector('thead').innerHTML = headerHtml;
            existingTable.querySelector('tbody').innerHTML = rows;
        } else if (loadingMessage) {
            // If the loading message is present, replace it with the new table.
            loadingMessage.outerHTML = tableHTML;
        } else {
            // As a fallback, append the table if no other content is present.
            listContainer.insertAdjacentHTML('beforeend', tableHTML);
        }

        // Initialize column resizing
        const table = listContainer.querySelector('table.pdt-table');
        if (table) {
            table.setAttribute('data-resize-mode', 'shift');
            UIHelpers.initColumnResize(table);
        }
    }

    /**
     * Renders the list of attributes for the selected entity into the attribute panel.
     * @param {Array<object>} attributes - The array of attribute definitions to render.
     * @private
     */
    _renderAttributeList(attributes) {
        // Create a shallow copy with computed _displayName to avoid mutating original objects
        const validAttributes = attributes
            .filter(item => item && item.LogicalName)
            .map(item => ({
                ...item,
                _displayName: getMetadataDisplayName(item)
            }));

        sortArrayByColumn(validAttributes, this.attributeSortState.column, this.attributeSortState.direction);

        const rows = validAttributes.map(item => `
            <tr class="copyable-cell" data-logical-name="${item.LogicalName}" title="Click to view details">
                <td>${item._displayName}</td>
                <td class="code-like">${item.LogicalName}</td>
                <td>${item.AttributeType}</td>
            </tr>`).join('');

        const headers = [
            { key: '_displayName', label: 'Display Name' },
            { key: 'LogicalName', label: 'Logical Name' },
            { key: 'AttributeType', label: 'Type' }
        ];
        const headerHtml = generateSortableTableHeaders(headers, this.attributeSortState);

        this.ui.attributeList.innerHTML = `
            <table class="pdt-table">
                <thead>${headerHtml}</thead>
                <tbody>${rows}</tbody>
            </table>`;

        // Initialize column resizing
        const table = this.ui.attributeList.querySelector('table.pdt-table');
        if (table) {
            table.setAttribute('data-resize-mode', 'shift');
            UIHelpers.initColumnResize(table);
        }
    }

    /**
     * Filters the displayed entity list based on the search input's value.
     * @private
     */
    _filterEntityList() {
        const term = this.ui.entitySearch.value.toLowerCase();
        const filtered = this.allEntities.filter(e => {
            const displayName = getMetadataDisplayName(e).toLowerCase();
            return displayName.includes(term) || e.LogicalName.toLowerCase().includes(term);
        });
        this._renderEntityList(filtered);
    }

    /**
     * Filters the displayed attribute list based on the search input's value.
     * @private
     */
    _filterAttributeList() {
        const term = this.ui.attributeSearch.value.toLowerCase();
        const filtered = this.selectedEntityAttributes.filter(a => {
            const displayName = getMetadataDisplayName(a).toLowerCase();
            return displayName.includes(term) || a.LogicalName.toLowerCase().includes(term);
        });
        this._renderAttributeList(filtered);
    }

    /**
     * Creates and shows a dialog with a filterable grid of a metadata object's properties.
     * @param {string} title - The title for the dialog window.
     * @param {object} metadataObject - The entity or attribute metadata object to display.
     * @private
     */
    _showMetadataDetailsDialog(title, metadataObject) {
        const content = document.createElement('div');
        content.innerHTML = `
            <input type="text" class="pdt-input" placeholder="Filter properties..." style="margin-bottom: 15px;">
            <div class="info-grid" style="height: 50vh;"></div>
        `;
        const grid = content.querySelector('.info-grid');
        const searchInput = content.querySelector('input');

        // Filter and sort the properties
        const properties = filterODataProperties(metadataObject);

        // Create and append the grid rows
        properties.forEach(([key, value]) => {
            const strong = document.createElement('strong');
            strong.textContent = `${key}:`;
            const span = document.createElement('span');
            span.className = 'copyable';
            span.title = 'Click to copy';
            span.textContent = value;
            grid.append(strong, span);
        });

        // Attach the live filter listener
        const filterHandler = debounce(() => {
            const term = searchInput.value.toLowerCase();
            for (let i = 0; i < grid.children.length; i += 2) {
                const labelEl = grid.children[i];
                const valueEl = grid.children[i + 1];
                const isMatch = labelEl.textContent.toLowerCase().includes(term) || valueEl.textContent.toLowerCase().includes(term);
                const display = isMatch ? '' : 'none';
                labelEl.style.display = display;
                valueEl.style.display = display;
            }
        }, 200);

        searchInput.addEventListener('keyup', filterHandler);

        const dialog = DialogService.show(title, content);

        // Override dialog close to cancel pending debounced filter
        const originalClose = dialog.close;
        dialog.close = () => {
            if (filterHandler?.cancel) {
                filterHandler.cancel();
            }
            originalClose();
        };
    }
}