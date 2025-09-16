/**
 * @file Manages the main UI dialog, including its creation, state, and interactions.
 * @module core/UIManager
 * @description This is the primary controller for the visual aspect of the toolkit.
 * It builds the main window, handles dragging/resizing, renders navigation,
 * and orchestrates the display of tab components.
 */

import { Store } from './Store.js';
import { StyleManager } from '../ui/StyleManager.js';
import { Config } from '../utils/Config.js';
import { ICONS } from '../utils/Icons.js';
import { ComponentRegistry } from './ComponentRegistry.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
import { DataService } from '../services/DataService.js';
import { NotificationService } from '../services/NotificationService.js';
import { Helpers } from '../utils/Helpers.js';

/**
 * Manages all aspects of the main user interface.
 * @namespace
 */
export const UIManager = {
    dialog: null,
    activeTabId: null,
    renderedTabs: new Map(), // Cache for rendered tab content to avoid re-rendering

    showImpersonationIndicator(userName) {
        if (!this.dialog) return;
        const indicator = this.dialog.querySelector('#pdt-impersonation-indicator');
        if (userName) {
            indicator.innerHTML = `<span class="pdt-badge" style="padding: 5px; border-radius: 5px; background-color: var(--pro-warn); color: #000;">👤 Impersonating: ${Helpers.escapeHtml(userName)}</span>`;
        } else {
            indicator.innerHTML = '';
        }
    },

    /**
     * Initializes the UIManager and subscribes to state changes from the store.
     */
    init() {
        Store.subscribe((newState, oldState) => {
            if (newState.theme !== oldState.theme) {
                this._handleThemeChange(newState.theme);
            }
            // Re-render navigation if tab settings (order or visibility) change
            if (JSON.stringify(newState.tabSettings) !== JSON.stringify(oldState.tabSettings)) {
                this.updateNavTabs();
            }
        });
    },

    /**
     * Creates and displays the main toolkit dialog if it doesn't exist, or shows it if it's hidden.
     */
    showDialog() {
        if (this.dialog) {
            this.dialog.style.display = 'flex';
            return;
        }

        StyleManager.init(); // Ensures the style module is loaded and CSS is injected

        this.dialog = document.createElement('div');
        this.dialog.className = 'powerapps-dev-toolkit';
        this._handleThemeChange(Store.getState().theme);
        this._applySavedDimensions();

        this.dialog.innerHTML = `
            <div class="pdt-header">
                <div style="display:flex; align-items:center; gap:10px;">
                    <h1>Power-<span>Toolkit</span></h1>
                    <div id="pdt-impersonation-indicator"></div>
                </div>
                <div class="pdt-header-controls">
                    <button class="pdt-icon-btn pdt-reset-form-btn" title="Reset Form (Discard Changes)">${ICONS.reset}</button>
                    <button class="pdt-icon-btn pdt-god-mode-btn" title="Activate God Mode">${ICONS.gmode}</button>
                    <button class="pdt-icon-btn pdt-refresh-btn" title="Refresh Tool & Clear Cache">${ICONS.refresh}</button>
                    <button class="pdt-icon-btn pdt-theme-toggle" title="Toggle Theme">${ICONS.theme}</button>
                    <button class="pdt-icon-btn pdt-close-btn" title="Close">&times;</button>
                </div>
            </div>
            <div class="pdt-main-body">
                <nav class="pdt-nav-tabs"></nav>
                <main class="pdt-content"></main>
            </div>
            <footer class="pdt-footer">
                <div>Version ${Config.TOOL_VERSION}</div>
                <div>${Config.DEVELOPER_NAME}</div>
            </footer>`;

        document.body.appendChild(this.dialog);

        this._makeDraggableAndResizable();
        this._attachEventListeners();
        this.updateNavTabs();
    },

    updateNavTabs() {
        const tabsContainer = this.dialog.querySelector('.pdt-nav-tabs');
        const contentArea = this.dialog.querySelector('.pdt-content');
        if (!tabsContainer || !contentArea) return; // Guard clause

        const previouslyActiveTabId = this.activeTabId;
        tabsContainer.innerHTML = '';

        // Clean up the content of any form-only tabs that are about to be hidden
        this.renderedTabs.forEach((contentElement, tabId) => {
            const component = ComponentRegistry.get(tabId);
            if (component?.isFormOnly && !PowerAppsApiService.isFormContextAvailable) {
                contentElement.remove();
                this.renderedTabs.delete(tabId);
            }
        });

        const tabSettings = Store.getState().tabSettings;
        let firstVisibleTabId = null;
        let isPreviouslyActiveTabStillVisible = false;

        tabSettings.forEach(setting => {
            const component = ComponentRegistry.get(setting.id);
            if (!setting.visible || !component) return;
            // This is the core logic that now runs every time
            if (component.isFormOnly && !PowerAppsApiService.isFormContextAvailable) return;

            firstVisibleTabId = firstVisibleTabId || component.id;
            if (component.id === previouslyActiveTabId) {
                isPreviouslyActiveTabStillVisible = true;
            }

            const tabButton = document.createElement('button');
            tabButton.className = 'pdt-nav-tab';
            tabButton.dataset.tabId = component.id;
            tabButton.innerHTML = `${component.icon}<span>${component.label}</span>`;
            tabButton.onclick = () => this._showTab(component.id);
            tabsContainer.appendChild(tabButton);
        });

        const tabToActivate = isPreviouslyActiveTabStillVisible ? previouslyActiveTabId : firstVisibleTabId;

        if (tabToActivate) {
            this._showTab(tabToActivate);
        } else {
            contentArea.innerHTML = '<p class="pdt-note">No visible tabs for this context.</p>';
            this.activeTabId = null;
        }
    },

    async _showTab(componentId) {
        if (!componentId || !this.dialog) return;
        const component = ComponentRegistry.get(componentId);
        if (!component) return;

        if (this.activeTabId && this.renderedTabs.has(this.activeTabId)) {
            this.renderedTabs.get(this.activeTabId).style.display = 'none';
        }

        this.dialog.querySelectorAll('.pdt-nav-tab').forEach(t => t.classList.remove('active'));
        this.dialog.querySelector(`[data-tab-id="${componentId}"]`)?.classList.add('active');
        this.activeTabId = componentId;

        const contentArea = this.dialog.querySelector('.pdt-content');
        if (this.renderedTabs.has(componentId)) {
            this.renderedTabs.get(componentId).style.display = 'flex';
        } else {
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'pdt-content-host';
            contentWrapper.innerHTML = '<div>Loading...</div>';
            contentArea.appendChild(contentWrapper);
            this.renderedTabs.set(componentId, contentWrapper);

            try {
                const content = await component.render();
                contentWrapper.innerHTML = '';
                contentWrapper.appendChild(content);
                component.postRender(contentWrapper);
            } catch (e) {
                contentWrapper.innerHTML = `<div class="pdt-error">Error rendering tab: ${e.message}</div>`;
                console.error(`Failed to render ${component.label}:`, e);
            }
        }
    },

    /**
     * Attaches event listeners for the main UI controls, including the close, theme, and refresh buttons.
     * @private
     */
    _attachEventListeners() {
        const controls = {
            close: this.dialog.querySelector('.pdt-close-btn'),
            theme: this.dialog.querySelector('.pdt-theme-toggle'),
            refresh: this.dialog.querySelector('.pdt-refresh-btn'),
            godMode: this.dialog.querySelector('.pdt-god-mode-btn'),
            reset: this.dialog.querySelector('.pdt-reset-form-btn')
        };

        // This is the critical change. The close button now performs a full cleanup.
        controls.close.onclick = () => this._handleClose();
        
        controls.theme.onclick = () => this._handleThemeToggle();
        controls.refresh.onclick = () => this._handleRefresh();

        if (!PowerAppsApiService.isFormContextAvailable) {
            controls.godMode.disabled = true;
            controls.reset.disabled = true;
        } else {
            controls.godMode.onclick = () => this._handleGodMode();
            controls.reset.onclick = () => this._handleResetForm();
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.powerapps-dev-toolkit, #pdt-dialog-overlay')) {
                return;
            }
            const copyable = e.target.closest('.copyable');
            if (copyable) {
                Helpers.copyToClipboard(copyable.textContent, 'Copied to clipboard!');
            }
        });
    },

    _applySavedDimensions() {
        const savedDims = Store.getState().dimensions;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let width = savedDims.width ? parseInt(savedDims.width, 10) : vw * 0.75;
        let height = savedDims.height ? parseInt(savedDims.height, 10) : vh * 0.85;
        let top = savedDims.top ? parseInt(savedDims.top, 10) : vh * 0.05;
        let left = savedDims.left ? parseInt(savedDims.left, 10) : vw * 0.125;

        this.dialog.style.width = Math.min(width, vw - 20) + 'px';
        this.dialog.style.height = Math.min(height, vh - 20) + 'px';
        this.dialog.style.top = Math.max(0, Math.min(top, vh - 50)) + 'px';
        this.dialog.style.left = Math.max(0, Math.min(left, vw - 150)) + 'px';
    },

    _makeDraggableAndResizable() {
        const header = this.dialog.querySelector('.pdt-header');
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        const elementDrag = (e) => {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            this.dialog.style.top = `${this.dialog.offsetTop - pos2}px`;
            this.dialog.style.left = `${this.dialog.offsetLeft - pos1}px`;
        };

        const saveDimensions = Helpers.debounce(() => {
            Store.setState({ dimensions: {
                width: this.dialog.style.width,
                height: this.dialog.style.height,
                top: this.dialog.style.top,
                left: this.dialog.style.left,
            }});
        }, 500);

        const closeDragElement = () => {
            document.onmouseup = null;
            document.onmousemove = null;
            saveDimensions();
        };

        header.onmousedown = (e) => {
            if (e.target.closest('.pdt-header-controls')) return;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        };

        const resizeObserver = new ResizeObserver(saveDimensions);
        resizeObserver.observe(this.dialog);
    },

    _handleThemeToggle() {
        const newTheme = Store.getState().theme === 'light' ? 'dark' : 'light';
        Store.setState({ theme: newTheme });
    },

    _handleThemeChange(theme) {
        this.dialog?.classList.toggle('light-mode', theme === 'light');
    },

    _handleRefresh(showNotification = true) {
        if (showNotification) {
            DataService.clearCache();
            NotificationService.show('Cache cleared. Reloading current tab.', 'success');
        }

        if (this.activeTabId) {
            const component = ComponentRegistry.get(this.activeTabId);
            if (component) {
                component.destroy();
            }
            
            this.renderedTabs.get(this.activeTabId)?.remove();
            this.renderedTabs.delete(this.activeTabId);

            this._showTab(this.activeTabId);
        }
    },

    _handleGodMode() {
        let unlocked = 0, required = 0;
        PowerAppsApiService.getAllControls().forEach(c => {
            try {
                if (c.getDisabled()) { c.setDisabled(false); unlocked++; }
                const a = c.getAttribute();
                if (a?.getRequiredLevel() === 'required') { a.setRequiredLevel('none'); required++; }
            } catch (e) { /* Safely ignore */ }
        });
        NotificationService.show(`God Mode: ${unlocked} fields unlocked, ${required} required fields updated.`, 'success');
    },

    async _handleResetForm() {
        if (!PowerAppsApiService.getEntityId()) {
            NotificationService.show("Cannot reset a new, unsaved record.", 'warn');
            return;
        }
        try {
            await PowerAppsApiService.refreshForm(false);
            NotificationService.show('Form has been reset.', 'success');
        } catch (e) {
            NotificationService.show(`Error resetting form: ${e.message}`, 'error');
        }
    },

    _hideDialog() {
        if (this.dialog) {
            this.dialog.style.display = 'none';
        }
    },

    /**
     * Performs a full cleanup and removal of the toolkit from the page.
     * This method saves the final UI dimensions, iterates through all registered
     * components to call their destroy() methods, and removes the main dialog
     * and its script tag from the DOM to allow for a clean re-initialization.
     * @private
     */
    _handleClose() {
        // Immediately save the final dimensions to the store before closing.
        // This ensures the last position is always remembered, even without a drag/resize.
        if (this.dialog) {
            Store.setState({
                dimensions: {
                    width: this.dialog.style.width,
                    height: this.dialog.style.height,
                    top: this.dialog.style.top,
                    left: this.dialog.style.left,
                }
            });
        }
        
        // Perform a robust cleanup of all active components. This is wrapped in a
        // try...catch to ensure that if one component's destroy() method fails,
        // it does not prevent the others from being cleaned up.
        try {
            const components = ComponentRegistry.getAll();
            components.forEach(c => c.destroy());
            console.log(`Power-Toolkit: Destroyed ${components.length} components.`);
        } catch (error) {
            console.warn("Power-Toolkit: A non-critical error occurred during component cleanup.", error);
        }
        
        // Remove the main UI dialog from the page.
        if (this.dialog) {
            this.dialog.remove();
            this.dialog = null;
        }
        
        // Reset all internal state for a clean re-initialization.
        this.renderedTabs.clear();
        this.activeTabId = null;
        DataService.clearCache();
        
        // Reset the global flag to allow the tool to be launched again.
        window.PDT_INITIALIZED = false;

        // Find and remove the injected script tag using the correct ID to allow for re-injection.
        const scriptTag = document.getElementById('power-toolkit-script-module');
        if (scriptTag) {
            scriptTag.remove();
        }
    }
};