/**
 * @file Solution Layers Tab - View and manage solution components with active customizations.
 * @module components/SolutionLayersTab
 * @description Provides UI to select a solution and view components that have active customizations.
 * Shows only components where the solution has actual customizations (not just inherited).
 * Includes filtering by component type and ability to delete active unmanaged components.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { SolutionLayersService } from '../services/SolutionLayersService.js';
import { NotificationService } from '../services/NotificationService.js';
import { escapeHtml, showConfirmDialog, UIHelpers } from '../helpers/index.js';
import { Config } from '../constants/index.js';

/**
 * A component that manages solution layers.
 * @class SolutionLayersTab
 * @extends {BaseComponent}
 */
export class SolutionLayersTab extends BaseComponent {
    /**
     * Initializes the SolutionLayersTab component.
     */
    constructor() {
        super('solutionLayers', 'Solution Layers', ICONS.layers);
        this.ui = {};
        this.solutions = [];
        this.selectedSolutionId = null;
        this.layers = [];
        this.allLayers = []; // Store all layers before filtering
        this.sortColumn = 'name'; // Default sort column
        this.sortDirection = 'asc'; // Default sort direction
        this.showOnlyDeletable = true; // Always filter for deletable active layers

        // Event handler references for cleanup
        /** @private {Function|null} */ this._solutionSelectHandler = null;
        /** @private {Function|null} */ this._refreshBtnHandler = null;
        /** @private {Function|null} */ this._layerListClickHandler = null;
        /** @private {Function|null} */ this._tableHeaderClickHandler = null;
        /** @private {Function|null} */ this._filterChangeHandler = null;
        /** @private {Function|null} */ this._searchHandler = null;
    }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    // eslint-disable-next-line require-await
    async render() {
        const container = document.createElement('div');
        container.className = 'pdt-full-height-column';

        container.innerHTML = `
            <div class="section-title flex-shrink-0">Solution Layers</div>
            
            <div class="pdt-toolbar">
                <select id="pdt-solution-select" class="pdt-input" style="flex: 2;">
                    <option value="">Select a solution...</option>
                </select>
                <input type="text" id="pdt-component-search" class="pdt-input" placeholder="Search components..." style="flex: 1;">
                <select id="pdt-component-type-filter" class="pdt-input" style="flex: 1;">
                    <option value="">All Component Types</option>
                </select>
                <button id="pdt-refresh-layers" class="modern-button" disabled>Refresh</button>
            </div>

            <div class="pdt-note">
                <strong>Note:</strong> This shows solution components with active unmanaged customizations that can be deleted. These are managed components where your unmanaged changes sit on top - deleting them removes your customization layer and reveals the managed version beneath.
            </div>

            <div id="pdt-layers-container" class="pdt-content-host">
                <p class="pdt-note">Select a solution to view its components.</p>
            </div>
        `;

        return container;
    }

    /**
     * Post-render initialization.
     * @param {HTMLElement} element - The root element of the component.
     */
    async postRender(element) {
        this.ui = {
            container: element,
            solutionSelect: element.querySelector('#pdt-solution-select'),
            componentSearch: element.querySelector('#pdt-component-search'),
            componentTypeFilter: element.querySelector('#pdt-component-type-filter'),
            refreshBtn: element.querySelector('#pdt-refresh-layers'),
            layersContainer: element.querySelector('#pdt-layers-container')
        };

        // Always filter to show only deletable active layers
        this.showOnlyDeletable = true;

        // Load solutions
        await this._loadSolutions();

        // Event handlers
        this._solutionSelectHandler = () => this._onSolutionSelected();
        this._refreshBtnHandler = () => this._onRefreshLayers();
        this._filterChangeHandler = () => this._applyFilters();
        this._searchHandler = () => this._applyFilters();

        this.ui.solutionSelect.addEventListener('change', this._solutionSelectHandler);
        this.ui.refreshBtn.addEventListener('click', this._refreshBtnHandler);
        this.ui.componentTypeFilter.addEventListener('change', this._filterChangeHandler);
        this.ui.componentSearch.addEventListener('input', this._searchHandler);
    }

    /**
     * Load available solutions.
     * @private
     */
    async _loadSolutions() {
        try {
            this.ui.solutionSelect.disabled = true;
            this.solutions = await SolutionLayersService.getSolutions();

            // Clear and populate dropdown
            this.ui.solutionSelect.innerHTML = '<option value="">Select a solution...</option>';

            this.solutions.forEach(solution => {
                const option = document.createElement('option');
                option.value = solution.solutionid;
                option.textContent = `${solution.friendlyname} (${solution.uniquename})`;
                this.ui.solutionSelect.appendChild(option);
            });

            this.ui.solutionSelect.disabled = false;

            if (this.solutions.length === 0) {
                NotificationService.show(Config.MESSAGES.SOLUTION_LAYERS.noSolutions || 'No solutions found', 'info');
            }
        } catch (error) {
            NotificationService.show(Config.MESSAGES.SOLUTION_LAYERS.loadSolutionsFailed(error.message), 'error');
            this.ui.layersContainer.innerHTML = `<p class="pdt-error">Failed to load solutions: ${escapeHtml(error.message)}</p>`;
        }
    }

    /**
     * Handle solution selection.
     * @private
     */
    async _onSolutionSelected() {
        this.selectedSolutionId = this.ui.solutionSelect.value;

        if (!this.selectedSolutionId) {
            this.ui.refreshBtn.disabled = true;
            this.layers = [];
            this.ui.layersContainer.innerHTML = '<p class="pdt-note">Select a solution to view its components.</p>';
            return;
        }

        this.ui.refreshBtn.disabled = false;
        await this._loadLayers();
    }

    /**
     * Refresh layers for the selected solution.
     * @private
     */
    async _onRefreshLayers() {
        if (!this.selectedSolutionId) {
            return;
        }
        await this._loadLayers();
    }

    /**
     * Load layers for the selected solution.
     * @private
     */
    async _loadLayers() {
        if (!this.selectedSolutionId) {
            return;
        }

        try {
            this.ui.layersContainer.innerHTML = '<p class="pdt-note">Loading layers...</p>';
            this.ui.refreshBtn.disabled = true;

            const selectedSolution = this.solutions.find(s => s.solutionid === this.selectedSolutionId);
            this.allLayers = await SolutionLayersService.getSolutionLayers(
                this.selectedSolutionId,
                selectedSolution?.uniquename
            );

            // Populate component type filter dropdown
            this._populateComponentTypeFilter();

            // Apply filters and render
            this._applyFilters();

            this.ui.refreshBtn.disabled = false;
        } catch (error) {
            NotificationService.show(Config.MESSAGES.SOLUTION_LAYERS.loadComponentsFailed(error.message), 'error');
            this.ui.layersContainer.innerHTML = `<p class="pdt-error">Failed to load layers: ${escapeHtml(error.message)}</p>`;
            this.ui.refreshBtn.disabled = false;
        }
    }

    /**
     * Populate the component type filter dropdown with available types.
     * @private
     */
    _populateComponentTypeFilter() {
        if (!this.allLayers || this.allLayers.length === 0) {
            return;
        }

        // Get unique component types using base type name (without entity suffix)
        const typeMap = new Map();
        this.allLayers.forEach(layer => {
            // Only include layers that can be deleted with active customizations
            if (layer.canBeDeleted && layer.hasActiveCustomization && !typeMap.has(layer.componentType)) {
                // Use baseComponentTypeName for dropdown display (without entity name)
                const displayName = layer.baseComponentTypeName || layer.componentTypeName || `Type ${layer.componentType}`;
                typeMap.set(layer.componentType, displayName);
            }
        });

        // Sort by type name
        const sortedTypes = Array.from(typeMap.entries()).sort((a, b) => {
            return a[1].localeCompare(b[1]);
        });

        // Populate dropdown
        this.ui.componentTypeFilter.innerHTML = '<option value="">All Component Types</option>';
        sortedTypes.forEach(([typeCode, typeName]) => {
            const option = document.createElement('option');
            option.value = typeCode;
            option.textContent = typeName;
            this.ui.componentTypeFilter.appendChild(option);
        });
    }

    /**
     * Get display name for a layer.
     * @private
     * @param {Object} layer - Layer object
     * @returns {string} Display name
     */
    _getDisplayName(layer) {
        return layer.msdyn_name || layer.msdyn_solutioncomponentname || 'N/A';
    }

    /**
     * Apply filters to the layer list.
     * @private
     */
    _applyFilters() {
        if (!this.allLayers) {
            return;
        }

        let filtered = [...this.allLayers];

        // Filter by search term
        const searchTerm = this.ui.componentSearch.value.toLowerCase().trim();
        if (searchTerm) {
            filtered = filtered.filter(layer => {
                const displayName = this._getDisplayName(layer).toLowerCase();
                const schemaName = (layer.schemaName || '').toLowerCase();
                return displayName.includes(searchTerm) || schemaName.includes(searchTerm);
            });
        }

        // Filter by component type (single-select)
        const selectedType = this.ui.componentTypeFilter.value;
        if (selectedType) {
            const typeCode = parseInt(selectedType);
            filtered = filtered.filter(layer => layer.componentType === typeCode);
        }

        // Filter by deletable only
        if (this.showOnlyDeletable) {
            filtered = filtered.filter(layer => layer.canBeDeleted && layer.hasActiveCustomization);
        }

        this.layers = filtered;
        this._renderLayers();
    }

    /**
     * Get sort CSS class for a column.
     * @private
     * @param {string} column - Column name
     * @returns {string} CSS class
     */
    _getSortClass(column) {
        if (this.sortColumn !== column) {
            return '';
        }
        return this.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc';
    }

    /**
     * Create table header.
     * @private
     * @returns {HTMLTableSectionElement} Table header element
     */
    _createTableHeader() {
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th class="pdt-table-col-num">#</th>
                <th class="pdt-sortable ${this._getSortClass('name')}" data-sort="name">Display Name</th>
                <th class="pdt-sortable pdt-table-col-schema ${this._getSortClass('schemaName')}" data-sort="schemaName">Schema Name</th>
                <th class="pdt-sortable pdt-table-col-type ${this._getSortClass('componentType')}" data-sort="componentType">Type</th>
                <th class="pdt-table-col-actions">Actions</th>
            </tr>
        `;
        return thead;
    }

    /**
     * Render the layers table.
     * @private
     */
    _renderLayers() {
        if (!this.layers || this.layers.length === 0) {
            // Check if there are any deletable active layers at all
            const hasDeletableLayers = this.allLayers && this.allLayers.some(layer =>
                layer.canBeDeleted && layer.hasActiveCustomization
            );
            const message = hasDeletableLayers
                ? Config.MESSAGES.SOLUTION_LAYERS.noComponents
                : Config.MESSAGES.SOLUTION_LAYERS.noActiveCustomizations;
            this.ui.layersContainer.innerHTML = `<p class="pdt-note">${message}</p>`;
            return;
        }

        const sortedLayers = this._sortLayers([...this.layers]);
        const table = document.createElement('table');
        table.className = 'pdt-table';

        const thead = this._createTableHeader();
        const tbody = document.createElement('tbody');
        tbody.id = 'pdt-layers-tbody';

        table.appendChild(thead);
        table.appendChild(tbody);

        this._tableHeaderClickHandler = (e) => this._handleSort(e);
        thead.addEventListener('click', this._tableHeaderClickHandler);

        sortedLayers.forEach((layer, index) => {
            tbody.appendChild(this._createTableRow(layer, index));
        });

        this.ui.layersContainer.innerHTML = '';
        this.ui.layersContainer.appendChild(table);

        // Initialize column resizers and behaviour to match other tables
        try {
            // Prefer shift mode by default so resizing pushes following columns
            table.setAttribute('data-resize-mode', 'shift');
            UIHelpers.initColumnResize(table);
        } catch (_) {
            // ignore if helper not available
        }

        // Attach delete handlers
        this._layerListClickHandler = (e) => this._handleLayerAction(e);
        tbody.addEventListener('click', this._layerListClickHandler);
    }

    /**
     * Handle sort click on table header.
     * @private
     * @param {MouseEvent} e - Click event
     */
    _handleSort(e) {
        const th = e.target.closest('.pdt-sortable');
        if (!th) {
            return;
        }

        const column = th.dataset.sort;
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        this._renderLayers();
    }

    /**
     * Create a table row for a layer.
     * @private
     * @param {Object} layer - Layer object
     * @param {number} index - Row index
     * @returns {HTMLTableRowElement} Table row element
     */
    _createTableRow(layer, index) {
        const row = document.createElement('tr');
        row.dataset.layerId = layer.msdyn_componentlayerid;

        const canDelete = layer.canBeDeleted && layer.hasActiveCustomization;
        const deleteButton = canDelete
            ? `<button class="modern-button danger pdt-delete-layer pdt-delete-layer-btn" data-component-id="${layer.objectId}" title="Remove Active Customization">Delete</button>`
            : '<span class="pdt-text-muted">—</span>';

        row.innerHTML = `
            <td class="pdt-text-center">${index + 1}</td>
            <td>${escapeHtml(this._getDisplayName(layer))}</td>
            <td class="code-like">${escapeHtml(layer.schemaName || 'N/A')}</td>
            <td>${escapeHtml(layer.componentTypeName || 'N/A')}</td>
            <td class="pdt-text-center">${deleteButton}</td>
        `;

        return row;
    }

    /**
     * Sort layers based on current sort column and direction.
     * @private
     * @param {Array} layers - Layers to sort
     * @returns {Array} Sorted layers
     */
    _sortLayers(layers) {
        return layers.sort((a, b) => {
            let aVal, bVal;

            switch (this.sortColumn) {
                case 'schemaName':
                    aVal = (a.schemaName || '').toLowerCase();
                    bVal = (b.schemaName || '').toLowerCase();
                    break;
                case 'name':
                    aVal = (a.msdyn_name || '').toLowerCase();
                    bVal = (b.msdyn_name || '').toLowerCase();
                    break;
                case 'componentType':
                    aVal = (a.componentTypeName || '').toLowerCase();
                    bVal = (b.componentTypeName || '').toLowerCase();
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) {
                return this.sortDirection === 'asc' ? -1 : 1;
            }
            if (aVal > bVal) {
                return this.sortDirection === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }

    /**
     * Create delete confirmation dialog content.
     * @private
     * @param {Object} layer - Layer object
     * @returns {HTMLElement} Dialog content element
     */
    _createDeleteConfirmDialog(layer) {
        const componentName = this._getDisplayName(layer);
        const schemaName = layer.schemaName || 'N/A';
        const componentTypeName = layer.componentTypeName || 'Component';

        const contentEl = document.createElement('div');
        contentEl.innerHTML = `
            <div class="pdt-warning">
                <strong>Delete Active Customization?</strong>
                <div class="pdt-dialog-details">
                    <strong>Component:</strong> ${escapeHtml(componentName)}<br/>
                    <strong>Schema Name:</strong> <span class="code-like">${escapeHtml(schemaName)}</span><br/>
                    <strong>Type:</strong> ${escapeHtml(componentTypeName)}
                </div>
                <div class="pdt-dialog-warning">
                    <span class="pdt-text-error">This will remove the unmanaged customization layer and reveal the managed version beneath. This action cannot be undone.</span>
                </div>
            </div>
        `;
        return contentEl;
    }

    /**
     * Handle layer actions (delete).
     * @private
     * @param {MouseEvent} e - Click event
     */
    async _handleLayerAction(e) {
        const deleteBtn = e.target.closest('.pdt-delete-layer');
        if (!deleteBtn) {
            return;
        }

        const componentId = deleteBtn.dataset.componentId;
        const layer = this.layers.find(l => l.objectId === componentId);

        if (!layer) {
            return;
        }

        const contentEl = this._createDeleteConfirmDialog(layer);

        const confirmed = await showConfirmDialog('Delete Active Customization', contentEl);
        if (!confirmed) {
            return;
        }

        try {
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Deleting...';

            // Delete the layer - this will throw if it fails
            await SolutionLayersService.deleteLayer(componentId, layer.componentType);

            // Successfully deleted - remove from UI without reloading
            NotificationService.show(Config.MESSAGES.SOLUTION_LAYERS.layerDeleted, 'success');

            // Remove from data arrays
            this.layers = this.layers.filter(l => l.objectId !== componentId);
            this.allLayers = this.allLayers.filter(l => l.objectId !== componentId);

            // Update the component type filter dropdown
            this._populateComponentTypeFilter();

            // Re-apply filters and render
            this._applyFilters();
        } catch (error) {
            NotificationService.show(Config.MESSAGES.SOLUTION_LAYERS.deleteLayerFailed(error.message), 'error');
            deleteBtn.disabled = false;
            deleteBtn.textContent = 'Delete';
        }
    }

    /**
     * Cleanup resources.
     */
    destroy() {
        // Remove event listeners
        if (this.ui.solutionSelect && this._solutionSelectHandler) {
            this.ui.solutionSelect.removeEventListener('change', this._solutionSelectHandler);
        }
        if (this.ui.refreshBtn && this._refreshBtnHandler) {
            this.ui.refreshBtn.removeEventListener('click', this._refreshBtnHandler);
        }
        if (this.ui.componentTypeFilter && this._filterChangeHandler) {
            this.ui.componentTypeFilter.removeEventListener('change', this._filterChangeHandler);
        }
        if (this.ui.componentSearch && this._searchHandler) {
            this.ui.componentSearch.removeEventListener('input', this._searchHandler);
        }
        if (this.ui.layersContainer && this._layerListClickHandler) {
            const tbody = this.ui.layersContainer.querySelector('#pdt-layers-tbody');
            if (tbody) {
                tbody.removeEventListener('click', this._layerListClickHandler);
            }
        }

        // Destroy table resizer handlers if any
        try {
            const table = this.ui.layersContainer && this.ui.layersContainer.querySelector('table.pdt-table');
            if (table) {
                UIHelpers.destroyColumnResize(table);
            }
        } catch (_) {
            // ignore
        }

        // Clear references
        this._solutionSelectHandler = null;
        this._refreshBtnHandler = null;
        this._layerListClickHandler = null;
        this._tableHeaderClickHandler = null;
        this._filterChangeHandler = null;
        this._searchHandler = null;
        this.ui = {};
        this.solutions = [];
        this.layers = [];
        this.allLayers = [];
        this.selectedSolutionId = null;
    }
}
