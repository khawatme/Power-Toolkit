/**
 * @file Settings management component.
 * @module components/SettingsTab
 * @description Allows users to configure the toolkit by reordering/hiding tabs and managing settings.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { Store } from '../core/Store.js';
import { ComponentRegistry } from '../core/ComponentRegistry.js';
import { Config } from '../utils/Config.js';
import { NotificationService } from '../services/NotificationService.js';
import { DialogService } from '../services/DialogService.js';
import { Helpers } from '../utils/Helpers.js';

/**
 * A component for configuring the toolkit's UI and behavior. It allows users to
 * reorder and toggle the visibility of tabs via drag-and-drop and provides
 * functionality to import, export, and reset all user settings.
 * @extends {BaseComponent}
 * @property {HTMLElement|null} draggedItem - The list item element currently being dragged.
 * @property {Function} throttledDragOver - A throttled version of the dragover handler for performance.
 */
export class SettingsTab extends BaseComponent {
    /**
     * Initializes the SettingsTab component.
     */
    constructor() {
        super('settings', 'Settings', ICONS.settings);
        this.draggedItem = null;
        // Bind and throttle the dragover handler for performance
        this.throttledDragOver = Helpers.throttle(this._handleDragOver.bind(this), 100);
    }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="section-title">Toolkit Settings</div>
            <div class="pdt-toolbar" style="justify-content:flex-start;">
                <button id="pdt-export-settings" class="modern-button secondary">Export Settings</button>
                <button id="pdt-import-settings" class="modern-button secondary">Import Settings</button>
                <button id="pdt-reset-settings" class="modern-button danger" style="margin-left:auto;">Reset All Settings</button>
            </div>
            <div class="section-title">Tab Configuration</div>
            <p class="pdt-note">Drag to reorder tabs. Use the toggle to show or hide them.</p>
            <ul id="tab-settings-list"></ul>`;
            
        this._renderList(container.querySelector('#tab-settings-list'));
        return container;
    }

    /**
     * Attaches event listeners after the component is added to the DOM.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        const list = element.querySelector('#tab-settings-list');
        list.addEventListener('change', e => this._handleVisibilityChange(e));
        list.addEventListener('dragstart', e => this._handleDragStart(e));
        list.addEventListener('dragend', e => this._handleDragEnd(e));
        list.addEventListener('dragover', this.throttledDragOver);

        element.querySelector('#pdt-export-settings').onclick = () => this._exportSettings();
        element.querySelector('#pdt-import-settings').onclick = () => this._importSettings();
        element.querySelector('#pdt-reset-settings').onclick = () => this._resetAllSettings();
    }
    
    /**
     * Renders the list of configurable tabs.
     * @param {HTMLUListElement} listElement - The <ul> element to populate.
     * @private
     */
    _renderList(listElement) {
        const tabSettings = Store.getState().tabSettings;
        listElement.innerHTML = '';
        tabSettings.forEach(setting => {
            const component = ComponentRegistry.get(setting.id);
            if (component) {
                const li = document.createElement('li');
                li.dataset.tabId = component.id;
                // The settings tab itself cannot be hidden or reordered.
                const isUnconfigurable = component.id === 'settings';
                li.draggable = !isUnconfigurable;
                li.style.opacity = isUnconfigurable ? '0.7' : '1';

                li.innerHTML = `
                    <span class="drag-handle" style="cursor:${isUnconfigurable ? 'not-allowed' : 'grab'};">☰</span>
                    <span>${component.label}</span>
                    <label class="pdt-toggle-label" style="margin-left:auto;">
                        <span class="pdt-toggle-switch">
                            <input type="checkbox" class="tab-visibility-toggle" 
                                ${setting.visible ? 'checked' : ''} 
                                ${isUnconfigurable ? 'disabled' : ''}>
                            <span class="pdt-toggle-slider"></span>
                        </span>
                    </label>`;
                listElement.appendChild(li);
            }
        });
    }

    /**
     * Handles changes to a tab's visibility toggle.
     * @param {Event} e - The change event object from the input checkbox.
     * @private
     */
    _handleVisibilityChange(e) {
        if (!e.target.classList.contains('tab-visibility-toggle')) return;
        
        const tabId = e.target.closest('li').dataset.tabId;
        const newSettings = Store.getState().tabSettings.map(setting =>
            setting.id === tabId ? { ...setting, visible: e.target.checked } : setting
        );
        Store.setState({ tabSettings: newSettings });
    }

    /**
     * Handles the start of a drag operation, caching the dragged item and applying a visual style.
     * @param {DragEvent} e - The dragstart event object.
     * @private
     */
    _handleDragStart(e) {
        if (e.target.draggable) {
            this.draggedItem = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0); // Timeout for visual effect
        } else {
            e.preventDefault();
        }
    }

    /**
     * Handles the end of a drag operation, cleaning up styles and saving the new tab order.
     * @param {DragEvent} e - The dragend event object.
     * @private
     */
    _handleDragEnd(e) {
        if (this.draggedItem) {
            this.draggedItem.classList.remove('dragging');
            this._saveNewOrder(e.currentTarget);
            this.draggedItem = null;
        }
    }

    /**
     * Handles the dragover event, calculating the dragged item's new position in the list in real-time.
     * This handler is throttled to prevent excessive calculations during the drag.
     * @param {DragEvent} e - The dragover event object.
     * @private
     */
    _handleDragOver(e) {
        e.preventDefault();
        const list = e.currentTarget;
        const afterElement = this._getDragAfterElement(list, e.clientY);
        if (this.draggedItem) {
            if (afterElement == null) {
                list.appendChild(this.draggedItem);
            } else {
                list.insertBefore(this.draggedItem, afterElement);
            }
        }
    }

    /**
     * Saves the new order of tabs to the central store after a drag-and-drop operation.
     * @param {HTMLUListElement} listElement - The list element containing the reordered tabs.
     * @private
     */
    _saveNewOrder(listElement) {
        const newOrderedIds = [...listElement.querySelectorAll('li')].map(li => li.dataset.tabId);
        const currentSettings = Store.getState().tabSettings;
        const settingsMap = new Map(currentSettings.map(s => [s.id, s]));
        const newSettings = newOrderedIds.map(id => settingsMap.get(id)).filter(Boolean);
        Store.setState({ tabSettings: newSettings });
    }

    /**
     * Calculates which list element the dragged item should be placed before.
     * It determines this by finding the draggable element closest to the cursor's
     * vertical position (y-coordinate).
     * @param {HTMLUListElement} container - The list container.
     * @param {number} y - The cursor's vertical position.
     * @returns {HTMLElement|null} The element to insert before, or null if it should be last.
     * @private
     */
    _getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    /**
     * Gathers all current settings from the store and initiates a JSON file download.
     * @private
     */
    _exportSettings() {
        try {
            const settingsToExport = {
                version: Config.TOOL_VERSION,
                theme: Store.getState().theme,
                tabSettings: Store.getState().tabSettings
            };
            Helpers.downloadJson(settingsToExport, 'pdt-settings.json');
            NotificationService.show('Settings exported successfully.', 'success');
        } catch (e) {
            NotificationService.show(`Error exporting settings: ${e.message}`, 'error');
        }
    }

    /**
     * Opens a file dialog for the user to select a settings JSON file, then parses
     * and applies the settings from that file to the application's state.
     * @private
     */
    _importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = readerEvent => {
                try {
                    const imported = JSON.parse(readerEvent.target.result);
                    let newState = {};
                    if (imported.tabSettings) newState.tabSettings = imported.tabSettings;
                    if (imported.theme) newState.theme = imported.theme;
                    
                    if(Object.keys(newState).length > 0) {
                        Store.setState(newState);
                        this._renderList(document.getElementById('tab-settings-list'));
                        NotificationService.show('Settings imported successfully.', 'success');
                    } else {
                        NotificationService.show('Import failed: File does not contain valid settings.', 'error');
                    }
                } catch (err) {
                    NotificationService.show(`Error importing settings: ${err.message}`, 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    /**
     * Displays a confirmation dialog and, if confirmed, resets all application
     * settings in the store to their original default values.
     * @private
     */
    _resetAllSettings() {
        DialogService.show('Reset All Settings', '<p>Are you sure you want to reset all settings to their default values? This will reset the tab order, visibility, and theme.</p>', () => {
            // Use the new, clean method to reset the state.
            Store.resetToDefaults();
            
            // Manually re-render the list inside this settings tab.
            // The main navigation will update automatically via the store subscription.
            this._renderList(document.getElementById('tab-settings-list'));
            NotificationService.show('All settings have been reset.', 'success');
        });
    }
}