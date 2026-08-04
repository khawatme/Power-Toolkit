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

/** @private Dataverse has no Customer/Owner/PartyList metadata type - all are LookupAttributeMetadata. */
const LOOKUP_TYPES = new Set(['LookupType', 'CustomerType', 'OwnerType', 'PartyListType']);

/** @private @type {Set<string>} */
const CHOICE_TYPES = new Set(['PicklistType', 'MultiSelectPicklistType', 'StateType', 'StatusType']);

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
        /** @private */ this._detailDialogToken = 0;
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
    // eslint-disable-next-line require-await
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
                        <p class="pdt-note">${Config.MESSAGES.METADATA_BROWSER.loadingTables}</p>
                    </div>
                </div>

                <div class="pdt-resizer" id="pdt-metadata-resizer"></div>

                <div class="pdt-metadata-panel attributes">
                    <div class="pdt-metadata-panel-header">
                        <input type="text" id="pdt-attribute-search" class="pdt-input" placeholder="${Config.MESSAGES.METADATA_BROWSER.searchColumns}" disabled>
                    </div>
                    <div id="pdt-attribute-list-container" class="pdt-metadata-panel-body">
                        <p class="pdt-note">${Config.MESSAGES.METADATA_BROWSER.selectTable}</p>
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

        // 'input' rather than 'keyup': a paste from the context menu, a drag-drop or an
        // autofill changes the value without ever firing a key event.
        this.ui.entitySearch.addEventListener('input', this._entitySearchHandler);
        this.ui.attributeSearch.addEventListener('input', this._attributeSearchHandler);

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
            if (!row) {
                return;
            }

            const logicalName = row.dataset.logicalName;

            // Re-selecting the current table would reload it and discard the column search.
            if (logicalName !== this.selectedEntity?.LogicalName) {
                this._handleEntitySelect(logicalName);
                this.ui.entityList.querySelectorAll('tr').forEach(r => {
                    r.classList.remove('active');
                    r.setAttribute('aria-pressed', 'false');
                });
                row.classList.add('active');
                row.setAttribute('aria-pressed', 'true');
            }

            // The info button sits inside the row, so the selection above already started
            // loading columns - they are ready behind the dialog once it is dismissed.
            if (e.target.closest('.pdt-metadata-info-btn')) {
                const entity = this.allEntities.find(ent => ent.LogicalName === logicalName);
                if (entity) {
                    this._showMetadataDetailsDialog(
                        Config.MESSAGES.METADATA_BROWSER.tableDetailsTitle(getMetadataDisplayName(entity)),
                        entity
                    );
                }
            }
        };

        this._entityListKeydownHandler = (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') {
                return;
            }

            const header = e.target.closest('th[data-sort-key]');
            if (header) {
                e.preventDefault();
                this._handleEntitySort(header);
                return;
            }

            // Rows are role="button", so they must respond to Enter/Space like the click path.
            if (e.target.matches('tr[data-logical-name]')) {
                e.preventDefault();
                this._entityListClickHandler(e);
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
                    this._showMetadataDetailsDialog(
                        Config.MESSAGES.METADATA_BROWSER.columnDetailsTitle(getMetadataDisplayName(attribute)),
                        attribute,
                        { entityLogicalName: this.selectedEntity?.LogicalName }
                    );
                }
            }
        };

        this._attributeListKeydownHandler = (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') {
                return;
            }

            const header = e.target.closest('th[data-sort-key]');
            if (header) {
                e.preventDefault();
                this._handleAttributeSort(header);
                return;
            }

            if (e.target.matches('tr[data-logical-name]')) {
                e.preventDefault();
                this._attributeListClickHandler(e);
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
     * Unsubscribe from store updates
     * @private
     */
    _cleanupStoreSubscription() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    /**
     * Remove search input handlers
     * @private
     */
    _removeSearchHandlers() {
        if (this.ui.entitySearch && this._entitySearchHandler) {
            this.ui.entitySearch.removeEventListener('input', this._entitySearchHandler);
            if (this._entitySearchHandler.cancel) {
                this._entitySearchHandler.cancel();
            }
        }
        if (this.ui.attributeSearch && this._attributeSearchHandler) {
            this.ui.attributeSearch.removeEventListener('input', this._attributeSearchHandler);
            if (this._attributeSearchHandler.cancel) {
                this._attributeSearchHandler.cancel();
            }
        }
    }

    /**
     * Remove list click and keydown handlers
     * @private
     */
    _removeListHandlers() {
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
    }

    /**
     * Remove resizer handler
     * @private
     */
    _removeResizerHandler() {
        if (this.ui.resizer && this._resizerMousedownHandler) {
            this.ui.resizer.removeEventListener('mousedown', this._resizerMousedownHandler);
        }
    }

    /**
     * Clean up active drag handlers
     * @private
     */
    _cleanupActiveDragHandlers() {
        if (this._activeDragHandlers) {
            document.removeEventListener('mousemove', this._activeDragHandlers.handleDrag);
            document.removeEventListener('mouseup', this._activeDragHandlers.stopDrag);
            document.body.style.cursor = '';
            this._activeDragHandlers = null;
        }
    }

    /**
     * Clean up dynamic handlers
     * @private
     */
    _cleanupDynamicHandlers() {
        for (const [element, { event, handler }] of this._dynamicHandlers.entries()) {
            element.removeEventListener(event, handler);
        }
        this._dynamicHandlers.clear();
    }

    /**
     * Destroy column resize handlers
     * @private
     */
    _destroyColumnResizeHandlers() {
        try {
            const entityTable = this.ui.entityList?.querySelector('table.pdt-table');
            if (entityTable) {
                UIHelpers.destroyColumnResize(entityTable);
            }
            const attrTable = this.ui.attributeList?.querySelector('table.pdt-table');
            if (attrTable) {
                UIHelpers.destroyColumnResize(attrTable);
            }
        } catch (_) {
            // Intentionally ignored - cleanup is best-effort
        }
    }

    /**
     * Cleanup method called when component is destroyed
     */
    destroy() {
        this._cleanupStoreSubscription();
        this._removeSearchHandlers();
        this._removeListHandlers();
        this._removeResizerHandler();
        this._cleanupActiveDragHandlers();
        this._cleanupDynamicHandlers();
        this._destroyColumnResizeHandlers();
    }

    /**
     * Fetches entity definitions based on the current impersonation state and renders them to the UI.
     * Also displays a one-time warning if impersonation is active.
     * @private
     */
    async _loadData() {
        const myToken = ++this._loadToken;

        // The reset below detaches any impersonation notice from a previous run; without
        // this its listener entry would pin a detached node in the map.
        this._cleanupDynamicHandlers();

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
                // visually select the row (escaped: the value comes from sessionStorage)
                const row = this.ui.entityList.querySelector(`tr[data-logical-name="${CSS.escape(last)}"]`);
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

        // The search box is live while the fetch runs, so stale columns must go first or
        // filtering would render the previous table's data.
        this.selectedEntityAttributes = [];

        // A term left over from the previous table would contradict the full list rendered below.
        this.ui.attributeSearch.value = '';
        this.ui.attributeSearch.disabled = false;
        this.ui.attributeSearch.placeholder = Config.MESSAGES.METADATA_BROWSER.searchColumnsIn(this.selectedEntity.LogicalName);
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

        const M = Config.MESSAGES.METADATA_BROWSER;
        const selectedName = this.selectedEntity?.LogicalName;

        const rows = validEntities.map(item => {
            const logicalName = escapeHtml(item.LogicalName);
            // Keep the highlight on the selected table when the list is re-rendered by a search.
            const activeClass = item.LogicalName === selectedName ? ' active' : '';
            return `
            <tr class="copyable-cell${activeClass}" data-logical-name="${logicalName}" title="${escapeHtml(M.selectTableRowHint)}" role="button" tabindex="0" aria-pressed="${activeClass ? 'true' : 'false'}">
                <td>
                    <button type="button" class="pdt-metadata-info-btn" title="${escapeHtml(M.viewTableDetails)}" aria-label="${escapeHtml(M.viewTableDetails)}">&#9432;</button>
                    ${escapeHtml(item._displayName)}
                </td>
                <td class="code-like">${logicalName}</td>
            </tr>`;
        }).join('');

        const headers = [
            { key: '_displayName', label: M.labelDisplayName },
            { key: 'LogicalName', label: M.labelLogicalName }
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

        const M = Config.MESSAGES.METADATA_BROWSER;

        const rows = validAttributes.map(item => `
            <tr class="copyable-cell" data-logical-name="${escapeHtml(item.LogicalName)}" title="${escapeHtml(M.viewColumnDetails)}" role="button" tabindex="0">
                <td>${escapeHtml(item._displayName)}</td>
                <td class="code-like">${escapeHtml(item.LogicalName)}</td>
                <td>${escapeHtml(item.AttributeType)}</td>
            </tr>`).join('');

        const headers = [
            { key: '_displayName', label: M.labelDisplayName },
            { key: 'LogicalName', label: M.labelLogicalName },
            { key: 'AttributeType', label: M.labelType }
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
     *
     * Column dialogs additionally get a key-facts block and, for choice and lookup columns,
     * the option values or target tables. Those live on derived metadata types that the raw
     * property grid cannot show, because it only renders scalar values.
     * @param {string} title - The title for the dialog window.
     * @param {object} metadataObject - The entity or attribute metadata object to display.
     * @param {{entityLogicalName: string}|null} [attributeContext=null] - Set when opened from a column row.
     * @returns {{close: Function}} The dialog handle.
     * @private
     */
    _showMetadataDetailsDialog(title, metadataObject, attributeContext = null) {
        const M = Config.MESSAGES.METADATA_BROWSER;
        const content = document.createElement('div');
        content.className = 'pdt-metadata-details';

        const isColumn = Boolean(attributeContext?.entityLogicalName);
        let keyFactsGrid = null;
        let typeSection = null;

        if (isColumn) {
            const keyFacts = this._buildKeyFactsSection(metadataObject);
            keyFactsGrid = keyFacts.querySelector('.info-grid');
            content.appendChild(keyFacts);

            typeSection = document.createElement('div');
            typeSection.className = 'pdt-metadata-section';
            content.appendChild(typeSection);
        }

        // --- All properties (raw scalar grid) ---
        const propsSection = document.createElement('div');
        propsSection.className = 'pdt-metadata-section';

        if (isColumn) {
            const propsTitle = document.createElement('div');
            propsTitle.className = 'pdt-metadata-section-title';
            propsTitle.textContent = M.allPropertiesTitle;
            propsSection.appendChild(propsTitle);
        }

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'pdt-input';
        searchInput.placeholder = M.filterProperties;
        searchInput.style.marginBottom = '15px';

        const grid = document.createElement('div');
        grid.className = 'info-grid';

        propsSection.append(searchInput, grid);
        content.appendChild(propsSection);

        this._appendFacts(grid, filterODataProperties(metadataObject));

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

        searchInput.addEventListener('input', filterHandler);

        // A newer dialog (or any close) invalidates an in-flight type lookup.
        const myToken = ++this._detailDialogToken;
        let isOpen = true;

        const dialog = DialogService.show(title, content, null, {
            onClose: () => {
                isOpen = false;
                if (filterHandler?.cancel) {
                    filterHandler.cancel();
                }
            }
        });

        if (isColumn) {
            this._fillTypeSection(
                typeSection,
                keyFactsGrid,
                metadataObject,
                attributeContext.entityLogicalName,
                () => isOpen && myToken === this._detailDialogToken
            );
        }

        return dialog;
    }

    /**
     * Builds the key-facts block for a column, surfacing the label-and-managed-property
     * values that the raw scalar grid drops.
     * @param {object} attribute - The attribute metadata object.
     * @returns {HTMLElement} The section element.
     * @private
     */
    _buildKeyFactsSection(attribute) {
        const M = Config.MESSAGES.METADATA_BROWSER;

        const section = document.createElement('div');
        section.className = 'pdt-metadata-section';

        const heading = document.createElement('div');
        heading.className = 'pdt-metadata-section-title';
        heading.textContent = M.keyFactsTitle;

        const grid = document.createElement('div');
        grid.className = 'info-grid';

        section.append(heading, grid);

        const typeName = attribute.AttributeTypeName?.Value;
        const typeLabel = typeName && typeName !== attribute.AttributeType
            ? `${attribute.AttributeType} (${typeName})`
            : attribute.AttributeType;

        this._appendFacts(grid, [
            [M.labelDisplayName, getMetadataDisplayName(attribute)],
            [M.labelLogicalName, attribute.LogicalName],
            [M.labelType, typeLabel],
            [M.labelRequired, attribute.RequiredLevel?.Value],
            [M.labelDescription, attribute.Description?.UserLocalizedLabel?.Label]
        ]);

        return section;
    }

    /**
     * Appends label/value pairs to an info-grid, skipping empty values.
     * @param {HTMLElement} grid - The info-grid element.
     * @param {Array<[string, *]>} facts - Label/value pairs.
     * @private
     */
    _appendFacts(grid, facts) {
        facts.forEach(([label, value]) => {
            if (value === null || value === undefined || value === '') {
                return;
            }
            const strong = document.createElement('strong');
            strong.textContent = `${label}:`;
            const span = document.createElement('span');
            span.className = 'copyable';
            span.title = Config.MESSAGES.METADATA_BROWSER.clickToCopy;
            span.textContent = String(value);
            grid.append(strong, span);
        });
    }

    /**
     * Fills the type-specific section of a column dialog.
     *
     * Lookup targets arrive with the column list, so they render immediately. Everything
     * else needs a cast request for its derived metadata type, which is fetched lazily and
     * discarded if the dialog closed in the meantime.
     * @param {HTMLElement} section - The section to fill.
     * @param {HTMLElement} keyFactsGrid - The key-facts grid, for types that only add facts.
     * @param {object} attribute - The attribute metadata object.
     * @param {string} entityLogicalName - The owning table's logical name.
     * @param {Function} isCurrent - Returns false once the dialog is closed or replaced.
     * @private
     */
    async _fillTypeSection(section, keyFactsGrid, attribute, entityLogicalName, isCurrent) {
        const M = Config.MESSAGES.METADATA_BROWSER;
        const typeName = attribute.AttributeTypeName?.Value || '';

        if (LOOKUP_TYPES.has(typeName)) {
            this._renderLookupTargets(section, attribute.Targets || []);
            return;
        }

        const isChoice = CHOICE_TYPES.has(typeName);
        const isBoolean = typeName === 'BooleanType';

        section.textContent = '';
        this._appendNote(section, M.loadingDetails);

        let detail = null;
        try {
            detail = await DataService.getAttributeDetail(entityLogicalName, attribute.LogicalName, typeName);
        } catch (_e) {
            detail = null;
        }

        if (!isCurrent()) {
            return;
        }
        section.textContent = '';

        if (!detail) {
            // Types with nothing extra to show get no section at all; only the ones that
            // should have had options explain themselves.
            if (isChoice || isBoolean) {
                this._appendNote(section, M.detailsUnavailable);
            }
            return;
        }

        if (isChoice) {
            this._renderChoiceOptions(section, detail.Options || []);
            return;
        }

        if (isBoolean) {
            this._renderChoiceOptions(section, detail.Options || [], M.booleanValuesTitle);
            return;
        }

        // Numeric and text types contribute extra key facts rather than a section of their own.
        this._appendFacts(keyFactsGrid, [
            [M.labelMaxLength, detail.MaxLength],
            [M.labelPrecision, detail.Precision],
            [M.labelRange, this._formatRange(detail)],
            [M.labelFormat, detail.Format],
            [M.labelDateBehavior, detail.DateTimeBehavior?.Value]
        ]);
    }

    /**
     * Renders the target tables of a lookup column as chips.
     * @param {HTMLElement} section - The section to fill.
     * @param {string[]} targets - Target table logical names.
     * @private
     */
    _renderLookupTargets(section, targets) {
        const M = Config.MESSAGES.METADATA_BROWSER;
        section.textContent = '';

        const heading = document.createElement('div');
        heading.className = 'pdt-metadata-section-title';
        heading.textContent = targets.length > 1
            ? M.lookupTargetsPolymorphic(targets.length)
            : M.lookupTargetsTitle(targets.length);
        section.appendChild(heading);

        if (!targets.length) {
            this._appendNote(section, M.noTargets);
            return;
        }

        const group = document.createElement('div');
        group.className = 'pdt-metadata-targets';
        targets.forEach(target => {
            const chip = document.createElement('span');
            chip.className = 'pdt-badge-small copyable';
            chip.title = M.clickToCopy;
            chip.textContent = target;
            group.appendChild(chip);
        });
        section.appendChild(group);
    }

    /**
     * Renders option value/label pairs as a compact table.
     * @param {HTMLElement} section - The section to fill.
     * @param {Array<{value: number, label: string}>} options - The parsed options.
     * @param {string} [titleOverride] - Heading to use instead of the choice-options heading.
     * @private
     */
    _renderChoiceOptions(section, options, titleOverride) {
        const M = Config.MESSAGES.METADATA_BROWSER;
        section.textContent = '';

        const heading = document.createElement('div');
        heading.className = 'pdt-metadata-section-title';
        heading.textContent = titleOverride || M.choiceOptionsTitle(options.length);
        section.appendChild(heading);

        if (!options.length) {
            this._appendNote(section, M.noOptions);
            return;
        }

        const table = document.createElement('table');
        table.className = 'pdt-table pdt-metadata-options';

        const headRow = document.createElement('tr');
        [M.optionValueHeader, M.optionLabelHeader].forEach(label => {
            const th = document.createElement('th');
            th.textContent = label;
            headRow.appendChild(th);
        });
        const thead = document.createElement('thead');
        thead.appendChild(headRow);

        const tbody = document.createElement('tbody');
        options.forEach(option => {
            const tr = document.createElement('tr');

            const valueCell = document.createElement('td');
            valueCell.className = 'code-like copyable';
            valueCell.title = M.clickToCopy;
            valueCell.textContent = String(option.value);

            const labelCell = document.createElement('td');
            labelCell.className = 'copyable';
            labelCell.title = M.clickToCopy;
            labelCell.textContent = option.label;

            tr.append(valueCell, labelCell);
            tbody.appendChild(tr);
        });

        table.append(thead, tbody);
        section.appendChild(table);
    }

    /**
     * Formats a numeric attribute's allowed range, when it declares one.
     * @param {object} detail - Derived-type attribute metadata.
     * @returns {string|null} The formatted range, or null when unbounded.
     * @private
     */
    _formatRange(detail) {
        const { MinValue: min, MaxValue: max } = detail;
        if (min === null || min === undefined || max === null || max === undefined) {
            return null;
        }
        return Config.MESSAGES.METADATA_BROWSER.rangeValue(min, max);
    }

    /**
     * Appends a single-line note to a section.
     * @param {HTMLElement} section - The section to append to.
     * @param {string} text - The note text.
     * @private
     */
    _appendNote(section, text) {
        const note = document.createElement('p');
        note.className = 'pdt-note';
        note.textContent = text;
        section.appendChild(note);
    }
}