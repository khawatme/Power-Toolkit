/**
 * @file Settings management component.
 * @module components/SettingsTab
 * @description Allows users to configure the toolkit by reordering/hiding tabs and managing settings.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { Store } from '../core/Store.js';
import { ComponentRegistry } from '../core/ComponentRegistry.js';
import { Config } from '../constants/index.js';
import { NotificationService } from '../services/NotificationService.js';
import { throttle, clearContainer, downloadJson, createFileInputElement, readJsonFile, showConfirmDialog } from '../helpers/index.js';

/**
 * A component for configuring the toolkit's UI and behavior. It allows users to
 * reorder and toggle the visibility of tabs via drag-and-drop and provides
 * functionality to import, export, and reset all user settings.
 * @extends {BaseComponent}
 * @property {HTMLElement|null} draggedItem - The list item element currently being dragged.
 * @property {Function} throttledDragOver - A throttled version of the dragover handler for performance.
 * @property {Function} throttledHeaderDragOver - A throttled version of the header buttons dragover handler.
 */
export class SettingsTab extends BaseComponent {
    /**
     * Initializes the SettingsTab component.
     */
    constructor() {
        super('settings', 'Settings', ICONS.settings);
        this.draggedItem = null;
        this.headerDraggedItem = null;
        // Bind and throttle the dragover handlers for performance
        this.throttledDragOver = throttle(this._handleDragOver.bind(this), 100);
        this.throttledHeaderDragOver = throttle(this._handleHeaderDragOver.bind(this), 100);

        // DOM element references for cleanup
        /** @private {HTMLElement|null} */ this._listElement = null;
        /** @private {HTMLElement|null} */ this._headerListElement = null;
        /** @private {HTMLElement|null} */ this._exportBtn = null;
        /** @private {HTMLElement|null} */ this._importBtn = null;
        /** @private {HTMLElement|null} */ this._resetBtn = null;

        // Event handler references for cleanup
        /** @private {Function|null} */ this._handleVisibilityChangeBound = null;
        /** @private {Function|null} */ this._handleDragStartBound = null;
        /** @private {Function|null} */ this._handleDragEndBound = null;
        /** @private {Function|null} */ this._handleHeaderVisibilityChangeBound = null;
        /** @private {Function|null} */ this._handleHeaderDragStartBound = null;
        /** @private {Function|null} */ this._handleHeaderDragEndBound = null;
        /** @private {Function|null} */ this._handleExport = null;
        /** @private {Function|null} */ this._handleImport = null;
        /** @private {Function|null} */ this._handleReset = null;
    }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    // eslint-disable-next-line require-await
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="section-title">Toolkit Settings</div>
            <div class="pdt-toolbar pdt-toolbar-start">
                <button id="pdt-export-settings" class="modern-button secondary">Export Settings</button>
                <button id="pdt-import-settings" class="modern-button secondary">Import Settings</button>
                <button id="pdt-reset-settings" class="modern-button ml-auto">Reset All Settings</button>
            </div>
            <div class="section-title">${Config.MESSAGES.SETTINGS.headerButtonsTitle}</div>
            <p class="pdt-note">${Config.MESSAGES.SETTINGS.headerButtonsDescription}</p>
            <ul id="header-button-settings-list"></ul>
            <div class="section-title">Tab Configuration</div>
            <p class="pdt-note">Drag to reorder tabs. Use the toggle to show or hide them.</p>
            <ul id="tab-settings-list"></ul>`;

        this._renderList(container.querySelector('#tab-settings-list'));
        this._renderHeaderButtonList(container.querySelector('#header-button-settings-list'));
        return container;
    }

    /**
     * Attaches event listeners after the component is added to the DOM.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        this._listElement = element.querySelector('#tab-settings-list');
        this._headerListElement = element.querySelector('#header-button-settings-list');
        this._exportBtn = element.querySelector('#pdt-export-settings');
        this._importBtn = element.querySelector('#pdt-import-settings');
        this._resetBtn = element.querySelector('#pdt-reset-settings');

        // Store bound event handlers for cleanup
        this._handleVisibilityChangeBound = (e) => this._handleVisibilityChange(e);
        this._handleDragStartBound = (e) => this._handleDragStart(e);
        this._handleDragEndBound = (e) => this._handleDragEnd(e);
        this._handleHeaderVisibilityChangeBound = (e) => this._handleHeaderVisibilityChange(e);
        this._handleHeaderDragStartBound = (e) => this._handleHeaderDragStart(e);
        this._handleHeaderDragEndBound = (e) => this._handleHeaderDragEnd(e);
        this._handleExport = () => this._exportSettings();
        this._handleImport = () => this._importSettings();
        this._handleReset = () => this._resetAllSettings();

        // Tab settings list events
        this._listElement.addEventListener('change', this._handleVisibilityChangeBound);
        this._listElement.addEventListener('dragstart', this._handleDragStartBound);
        this._listElement.addEventListener('dragend', this._handleDragEndBound);
        this._listElement.addEventListener('dragover', this.throttledDragOver);

        // Header buttons list events
        this._headerListElement.addEventListener('change', this._handleHeaderVisibilityChangeBound);
        this._headerListElement.addEventListener('dragstart', this._handleHeaderDragStartBound);
        this._headerListElement.addEventListener('dragend', this._handleHeaderDragEndBound);
        this._headerListElement.addEventListener('dragover', this.throttledHeaderDragOver);

        this._exportBtn.onclick = this._handleExport;
        this._importBtn.onclick = this._handleImport;
        this._resetBtn.onclick = this._handleReset;
    }

    /**
     * Lifecycle hook for cleaning up event listeners to prevent memory leaks.
     */
    destroy() {
        if (this._listElement) {
            this._listElement.removeEventListener('change', this._handleVisibilityChangeBound);
            this._listElement.removeEventListener('dragstart', this._handleDragStartBound);
            this._listElement.removeEventListener('dragend', this._handleDragEndBound);
            this._listElement.removeEventListener('dragover', this.throttledDragOver);
        }
        if (this._headerListElement) {
            this._headerListElement.removeEventListener('change', this._handleHeaderVisibilityChangeBound);
            this._headerListElement.removeEventListener('dragstart', this._handleHeaderDragStartBound);
            this._headerListElement.removeEventListener('dragend', this._handleHeaderDragEndBound);
            this._headerListElement.removeEventListener('dragover', this.throttledHeaderDragOver);
        }
        // Cancel any pending throttled dragover
        if (this.throttledDragOver?.cancel) {
            this.throttledDragOver.cancel();
        }
        if (this.throttledHeaderDragOver?.cancel) {
            this.throttledHeaderDragOver.cancel();
        }
        if (this._exportBtn) {
            this._exportBtn.onclick = null;
        }
        if (this._importBtn) {
            this._importBtn.onclick = null;
        }
        if (this._resetBtn) {
            this._resetBtn.onclick = null;
        }
    }

    /**
     * Renders the list of configurable header buttons.
     * @param {HTMLUListElement} listElement - The <ul> element to populate.
     * @private
     */
    _renderHeaderButtonList(listElement) {
        const headerButtonSettings = Store.getState().headerButtonSettings;
        clearContainer(listElement);
        headerButtonSettings.forEach(setting => {
            const li = document.createElement('li');
            li.dataset.buttonId = setting.id;
            li.draggable = true;

            const formOnlyBadge = setting.formOnly ? `<span class="pdt-badge-small">${Config.MESSAGES.SETTINGS.headerButtonFormOnly}</span>` : '';

            li.innerHTML = `
                <span class="drag-handle" style="cursor:grab;">☰</span>
                <span>${setting.label} ${formOnlyBadge}</span>
                <label class="pdt-toggle-label ml-auto">
                    <span class="pdt-toggle-switch">
                        <input type="checkbox" class="header-button-visibility-toggle" 
                            ${setting.visible ? 'checked' : ''}>
                        <span class="pdt-toggle-slider"></span>
                    </span>
                </label>`;
            listElement.appendChild(li);
        });
    }

    /**
     * Handles changes to a header button's visibility toggle.
     * @param {Event} e - The change event object from the input checkbox.
     * @private
     */
    _handleHeaderVisibilityChange(e) {
        if (!e.target.classList.contains('header-button-visibility-toggle')) {
            return;
        }

        const buttonId = e.target.closest('li').dataset.buttonId;
        const newSettings = Store.getState().headerButtonSettings.map(setting =>
            setting.id === buttonId ? { ...setting, visible: e.target.checked } : setting
        );
        Store.setState({ headerButtonSettings: newSettings });
    }

    /**
     * Handles the start of a drag operation for header buttons.
     * @param {DragEvent} e - The dragstart event object.
     * @private
     */
    _handleHeaderDragStart(e) {
        if (e.target.draggable) {
            this.headerDraggedItem = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        } else {
            e.preventDefault();
        }
    }

    /**
     * Handles the end of a drag operation for header buttons.
     * @param {DragEvent} e - The dragend event object.
     * @private
     */
    _handleHeaderDragEnd(e) {
        if (this.headerDraggedItem) {
            this.headerDraggedItem.classList.remove('dragging');
            this._saveHeaderButtonOrder(e.currentTarget);
            this.headerDraggedItem = null;
        }
    }

    /**
     * Handles the dragover event for header buttons.
     * @param {DragEvent} e - The dragover event object.
     * @private
     */
    _handleHeaderDragOver(e) {
        e.preventDefault();
        const list = e.currentTarget;
        const afterElement = this._getDragAfterElement(list, e.clientY);
        if (this.headerDraggedItem) {
            if (afterElement === null || afterElement === undefined) {
                list.appendChild(this.headerDraggedItem);
            } else {
                list.insertBefore(this.headerDraggedItem, afterElement);
            }
        }
    }

    /**
     * Saves the new order of header buttons to the central store.
     * @param {HTMLUListElement} listElement - The list element containing the reordered buttons.
     * @private
     */
    _saveHeaderButtonOrder(listElement) {
        const newOrderedIds = [...listElement.querySelectorAll('li')].map(li => li.dataset.buttonId);
        const currentSettings = Store.getState().headerButtonSettings;
        const settingsMap = new Map(currentSettings.map(s => [s.id, s]));
        const newSettings = newOrderedIds.map(id => settingsMap.get(id)).filter(Boolean);
        Store.setState({ headerButtonSettings: newSettings });
    }

    /**
     * Renders the list of configurable tabs.
     * @param {HTMLUListElement} listElement - The <ul> element to populate.
     * @private
     */
    _renderList(listElement) {
        const tabSettings = Store.getState().tabSettings;
        clearContainer(listElement);
        tabSettings.forEach(setting => {
            const component = ComponentRegistry.get(setting.id);
            if (component) {
                const li = document.createElement('li');
                li.dataset.tabId = component.id;
                // The settings tab itself cannot be hidden or reordered.
                const isUnconfigurable = component.id === 'settings';
                li.draggable = !isUnconfigurable;
                li.style.opacity = isUnconfigurable ? '0.7' : '1';

                const formOnlyBadge = component.isFormOnly ? `<span class="pdt-badge-small">${Config.MESSAGES.SETTINGS.tabFormOnly}</span>` : '';

                li.innerHTML = `
                    <span class="drag-handle" style="cursor:${isUnconfigurable ? 'not-allowed' : 'grab'};">☰</span>
                    <span>${component.label} ${formOnlyBadge}</span>
                    <label class="pdt-toggle-label ml-auto">
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
        if (!e.target.classList.contains('tab-visibility-toggle')) {
            return;
        }

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
            if (afterElement === null || afterElement === undefined) {
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
                tabSettings: Store.getState().tabSettings,
                headerButtonSettings: Store.getState().headerButtonSettings
            };
            downloadJson(settingsToExport, 'pdt-settings.json');
            NotificationService.show(Config.MESSAGES.SETTINGS.exportSuccess, 'success');
        } catch (e) {
            NotificationService.show(Config.MESSAGES.SETTINGS.exportFailed(e.message), 'error');
        }
    }

    /**
     * Opens a file dialog for the user to select a settings JSON file, then parses
     * and applies the settings from that file to the application's state.
     * @private
     */
    // eslint-disable-next-line require-await
    async _importSettings() {
        const input = createFileInputElement({
            accept: '.json',
            onChange: async (e) => {
                const file = e.target.files[0];
                if (!file) {
                    return;
                }

                try {
                    const imported = await readJsonFile(file);
                    const newState = {};
                    if (imported.tabSettings) {
                        newState.tabSettings = imported.tabSettings;
                    }
                    if (imported.headerButtonSettings) {
                        newState.headerButtonSettings = imported.headerButtonSettings;
                    }
                    if (imported.theme) {
                        newState.theme = imported.theme;
                    }

                    if (Object.keys(newState).length > 0) {
                        Store.setState(newState);
                        this._renderList(document.getElementById('tab-settings-list'));
                        this._renderHeaderButtonList(document.getElementById('header-button-settings-list'));
                        NotificationService.show(Config.MESSAGES.SETTINGS.importSuccess, 'success');
                    } else {
                        NotificationService.show(Config.MESSAGES.SETTINGS.invalidSettings, 'error');
                    }
                } catch (err) {
                    NotificationService.show(Config.MESSAGES.SETTINGS.importFailed(err.message), 'error');
                }
            }
        });
        input.click();
    }

    /**
     * Displays a confirmation dialog and, if confirmed, resets all application
     * settings in the store to their original default values.
     * @private
     */
    async _resetAllSettings() {
        const confirmed = await showConfirmDialog(
            'Reset All Settings',
            'Are you sure you want to reset all settings to their default values? This will reset the tab order, header button order, visibility, and theme.'
        );

        if (confirmed) {
            Store.resetToDefaults();

            // Manually re-render the lists inside this settings tab.
            // The main navigation will update automatically via the store subscription.
            this._renderList(document.getElementById('tab-settings-list'));
            this._renderHeaderButtonList(document.getElementById('header-button-settings-list'));
            NotificationService.show(Config.MESSAGES.SETTINGS.resetSuccess, 'success');
        }
    }
}