/**
 * @file A standalone Dataverse metadata browser component.
 * @module components/MetadataBrowserTab
 * @description Provides a two-panel UI to browse and search for tables (entities)
 * and their corresponding columns (attributes), with a detailed view for each item.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { DataService } from '../services/DataService.js';
import { Helpers } from '../utils/Helpers.js';
import { DialogService } from '../services/DialogService.js';

/**
 * A component that provides a master-detail view for browsing Dataverse metadata.
 * @class MetadataBrowserTab
 * @extends {BaseComponent}
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
    }

    /**
     * Renders the component's two-panel HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.className = 'pdt-metadata-browser';
        container.innerHTML = `
            <div class="pdt-metadata-panel entities">
                <div class="pdt-metadata-panel-header">
                    <input type="text" id="pdt-entity-search" class="pdt-input" placeholder="Search tables...">
                </div>
                <div id="pdt-entity-list-container" class="pdt-metadata-panel-body">
                    <p class="pdt-note">Loading tables...</p>
                </div>
            </div>
            <div class="pdt-metadata-panel attributes">
                <div class="pdt-metadata-panel-header">
                    <input type="text" id="pdt-attribute-search" class="pdt-input" placeholder="Search columns..." disabled>
                </div>
                <div id="pdt-attribute-list-container" class="pdt-metadata-panel-body">
                    <p class="pdt-note">Select a table to view its columns.</p>
                </div>
            </div>`;
        return container;
    }

    /**
     * Caches UI elements, fetches initial data, and attaches event listeners.
     * @param {HTMLElement} element - The root element of the component.
     */
    async postRender(element) {
        this.ui = {
            entitySearch: element.querySelector('#pdt-entity-search'),
            entityList: element.querySelector('#pdt-entity-list-container'),
            attributeSearch: element.querySelector('#pdt-attribute-search'),
            attributeList: element.querySelector('#pdt-attribute-list-container')
        };

        this.ui.entitySearch.addEventListener('keyup', Helpers.debounce(() => this._filterEntityList(), 200));
        this.ui.attributeSearch.addEventListener('keyup', Helpers.debounce(() => this._filterAttributeList(), 200));

        this.ui.entityList.addEventListener('click', (e) => {
            const row = e.target.closest('tr[data-logical-name]');
            if (row) {
                const logicalName = row.dataset.logicalName;
                this._handleEntitySelect(logicalName);
                const entity = this.allEntities.find(e => e.LogicalName === logicalName);
                if (entity) this._showEntityDetails(entity);
                this.ui.entityList.querySelectorAll('tr').forEach(r => r.classList.remove('active'));
                row.classList.add('active');
            }
        });

        this.ui.attributeList.addEventListener('click', (e) => {
            const row = e.target.closest('tr[data-logical-name]');
            if (row) {
                const logicalName = row.dataset.logicalName;
                const attribute = this.selectedEntityAttributes.find(a => a.LogicalName === logicalName);
                if (attribute) this._showAttributeDetails(attribute);
            }
        });

        try {
            this.allEntities = await DataService.getEntityDefinitions();
            this._renderEntityList(this.allEntities);
        } catch (e) {
            this.ui.entityList.innerHTML = `<div class="pdt-error">Could not load tables: ${e.message}</div>`;
        }
    }

    /**
     * Handles the selection of an entity from the list by loading its attributes.
     * @param {string} logicalName - The logical name of the selected entity.
     * @private
     */
    async _handleEntitySelect(logicalName) {
        this.selectedEntity = this.allEntities.find(e => e.LogicalName === logicalName);
        if (!this.selectedEntity) return;

        this.ui.attributeSearch.disabled = false;
        this.ui.attributeSearch.placeholder = `Search columns in ${this.selectedEntity.LogicalName}...`;
        this.ui.attributeList.innerHTML = `<p class="pdt-note">Loading columns...</p>`;
        
        try {
            this.selectedEntityAttributes = await DataService.getAttributeDefinitions(logicalName);
            this._renderAttributeList(this.selectedEntityAttributes);
        } catch (e) {
            this.ui.attributeList.innerHTML = `<div class="pdt-error">Could not load columns: ${e.message}</div>`;
        }
    }

    /**
     * Renders the list of entities into its container.
     * @param {Array<object>} entities - The array of entity definitions to render.
     * @private
     */
    _renderEntityList(entities) {
        const validEntities = entities.filter(item => item && item.LogicalName);
        const getDisplayName = item => item.DisplayName?.UserLocalizedLabel?.Label || item.SchemaName;
        validEntities.sort((a,b) => (getDisplayName(a) || '').localeCompare(getDisplayName(b) || ''));
        
        const rows = validEntities.map(item => `
            <tr class="copyable-cell" data-logical-name="${item.LogicalName}" title="Click to view details and load columns">
                <td>${getDisplayName(item)}</td>
                <td class="code-like">${item.LogicalName}</td>
            </tr>`).join('');
        this.ui.entityList.innerHTML = `
            <table class="pdt-table">
                <thead><tr><th>Display Name</th><th>Logical Name</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
    }

    /**
     * Renders the list of attributes for the selected entity into its container.
     * @param {Array<object>} attributes - The array of attribute definitions to render.
     * @private
     */
    _renderAttributeList(attributes) {
        const validAttributes = attributes.filter(item => item && item.LogicalName);
        const getDisplayName = item => item.DisplayName?.UserLocalizedLabel?.Label || item.SchemaName;
        validAttributes.sort((a,b) => (getDisplayName(a) || '').localeCompare(getDisplayName(b) || ''));

        const rows = validAttributes.map(item => `
            <tr class="copyable-cell" data-logical-name="${item.LogicalName}" title="Click to view details">
                <td>${getDisplayName(item)}</td>
                <td class="code-like">${item.LogicalName}</td>
                <td>${item.AttributeType}</td>
            </tr>`).join('');
        this.ui.attributeList.innerHTML = `
            <table class="pdt-table">
                <thead><tr><th>Display Name</th><th>Logical Name</th><th>Type</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
    }

    /**
     * Filters the entity list based on the search input.
     * @private
     */
    _filterEntityList() {
        const term = this.ui.entitySearch.value.toLowerCase();
        const getDisplayName = item => (item.DisplayName?.UserLocalizedLabel?.Label || item.SchemaName).toLowerCase();
        const filtered = this.allEntities.filter(e => 
            getDisplayName(e).includes(term) || e.LogicalName.toLowerCase().includes(term)
        );
        this._renderEntityList(filtered);
    }

    /**
     * Filters the attribute list based on the search input.
     * @private
     */
    _filterAttributeList() {
        const term = this.ui.attributeSearch.value.toLowerCase();
        const getDisplayName = item => (item.DisplayName?.UserLocalizedLabel?.Label || item.SchemaName).toLowerCase();
        const filtered = this.selectedEntityAttributes.filter(a =>
            getDisplayName(a).includes(term) || a.LogicalName.toLowerCase().includes(term)
        );
        this._renderAttributeList(filtered);
    }

    /**
     * Shows a dialog with a searchable list of all available simple properties for an entity.
     * @param {object} entity - The entity metadata object.
     * @private
     */
    _showEntityDetails(entity) {
        const title = entity.DisplayName?.UserLocalizedLabel?.Label || entity.SchemaName;
        
        const content = document.createElement('div');
        content.innerHTML = `
            <input type="text" class="pdt-input" placeholder="Filter properties..." style="margin-bottom: 15px;">
            <div class="info-grid" style="grid-template-columns: max-content 1fr; max-height: 50vh; overflow-y: auto;"></div>
        `;

        const grid = content.querySelector('.info-grid');
        const searchInput = content.querySelector('input');

        const properties = Object.entries(entity)
            .filter(([key, value]) => value !== null && typeof value !== 'object' && !key.startsWith('@odata'))
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

        properties.forEach(([key, value]) => {
            const strong = document.createElement('strong');
            strong.textContent = `${key}:`;
            const span = document.createElement('span');
            span.className = 'copyable';
            span.title = 'Click to copy';
            span.textContent = value;
            grid.append(strong, span);
        });

        searchInput.addEventListener('keyup', Helpers.debounce(() => {
            const term = searchInput.value.toLowerCase();
            for (let i = 0; i < grid.children.length; i += 2) {
                const labelEl = grid.children[i];
                const valueEl = grid.children[i + 1];
                const isMatch = labelEl.textContent.toLowerCase().includes(term) || valueEl.textContent.toLowerCase().includes(term);
                const display = isMatch ? '' : 'none';
                labelEl.style.display = display;
                valueEl.style.display = display;
            }
        }, 200));

        DialogService.show(`Table Details: ${title}`, content);
    }

    /**
     * Shows a dialog with a searchable list of all available simple properties for an attribute.
     * @param {object} attribute - The attribute metadata object.
     * @private
     */
    _showAttributeDetails(attribute) {
        const title = attribute.DisplayName?.UserLocalizedLabel?.Label || attribute.SchemaName;
        
        const content = document.createElement('div');
        content.innerHTML = `
            <input type="text" class="pdt-input" placeholder="Filter properties..." style="margin-bottom: 15px;">
            <div class="info-grid" style="grid-template-columns: max-content 1fr; max-height: 50vh; overflow-y: auto;"></div>
        `;

        const grid = content.querySelector('.info-grid');
        const searchInput = content.querySelector('input');
        
        const properties = Object.entries(attribute)
            .filter(([key, value]) => value !== null && typeof value !== 'object' && !key.startsWith('@odata'))
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
        
        properties.forEach(([key, value]) => {
            const strong = document.createElement('strong');
            strong.textContent = `${key}:`;
            const span = document.createElement('span');
            span.className = 'copyable';
            span.title = 'Click to copy';
            span.textContent = value;
            grid.append(strong, span);
        });

        searchInput.addEventListener('keyup', Helpers.debounce(() => {
            const term = searchInput.value.toLowerCase();
            for (let i = 0; i < grid.children.length; i += 2) {
                const labelEl = grid.children[i];
                const valueEl = grid.children[i + 1];
                const isMatch = labelEl.textContent.toLowerCase().includes(term) || valueEl.textContent.toLowerCase().includes(term);
                const display = isMatch ? '' : 'none';
                labelEl.style.display = display;
                valueEl.style.display = display;
            }
        }, 200));

        DialogService.show(`Column Details: ${title}`, content);
    }
}