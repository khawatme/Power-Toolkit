/**
 * @file Manages the main UI dialog, including its creation, state, and interactions.
 * @module core/UIManager
 * @description This is the primary controller for the visual aspect of the toolkit.
 * It builds the main window, handles dragging/resizing, renders navigation,
 * and orchestrates the display of tab components.
 */

import { Store } from './Store.js';
import { StyleManager } from '../ui/StyleManager.js';
import { Config } from '../constants/index.js';
import { ICONS } from '../assets/Icons.js';
import { ComponentRegistry } from './ComponentRegistry.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
import { DataService } from '../services/DataService.js';
import { NotificationService } from '../services/NotificationService.js';
import { MinimizeService } from '../services/MinimizeService.js';
import { copyToClipboard, debounce, escapeHtml } from '../helpers/index.js';

/**
 * Manages all aspects of the main user interface.
 * @namespace
 * @property {HTMLElement|null} dialog - A reference to the main dialog element.
 * @property {string|null} activeTabId - The ID of the currently visible tab.
 * @property {Map<string, HTMLElement>} renderedTabs - A cache for rendered tab content to avoid re-rendering.
 * @property {Function|null} _globalClickHandler - Global click handler for copyable elements.
 */
export const UIManager = {
    dialog: null,
    activeTabId: null,
    renderedTabs: new Map(), // Cache for rendered tab content to avoid re-rendering
    _globalClickHandler: null, // Global click event handler for cleanup

    /**
     * Shows or hides the impersonation status indicator in the main dialog header.
     * @param {string|null} userName - The name of the user being impersonated, or null to hide the indicator.
     * @returns {void}
     */
    showImpersonationIndicator(userName) {
        if (!this.dialog) {
            return;
        }
        const indicator = this.dialog.querySelector('#pdt-impersonation-indicator');
        if (userName) {
            indicator.innerHTML = `<span class="pdt-badge" style="padding: 5px; border-radius: 5px; background-color: var(--pro-warn); color: #000;">👤 Impersonating: ${escapeHtml(userName)}</span>`;
        } else {
            indicator.textContent = '';
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
            // Re-render header buttons if header button settings change
            if (JSON.stringify(newState.headerButtonSettings) !== JSON.stringify(oldState.headerButtonSettings)) {
                this._updateHeaderButtons();
            }
            // Minimize state changes are handled internally by MinimizeService
        });
    },

    /**
     * Updates the header buttons based on current settings.
     * @private
     */
    _updateHeaderButtons() {
        if (!this.dialog) {
            return;
        }

        const headerControls = this.dialog.querySelector('.pdt-header-controls');
        if (!headerControls) {
            return;
        }

        const closeBtn = headerControls.querySelector('.pdt-close-btn');
        headerControls.innerHTML = '';
        headerControls.innerHTML = this._renderHeaderButtons();

        if (closeBtn) {
            headerControls.appendChild(closeBtn);
        } else {
            const newCloseBtn = document.createElement('button');
            newCloseBtn.className = 'pdt-icon-btn pdt-close-btn';
            newCloseBtn.title = 'Close';
            newCloseBtn.innerHTML = '&times;';
            newCloseBtn.onclick = () => this._handleClose();
            headerControls.appendChild(newCloseBtn);
        }

        this._attachHeaderButtonListeners();

        const minimizeBtn = headerControls.querySelector('.pdt-minimize-btn');
        if (minimizeBtn) {
            MinimizeService.init(this.dialog);
        }
    },

    /**
     * Attaches event listeners to header buttons.
     * Used when header buttons are dynamically updated.
     * @private
     */
    _attachHeaderButtonListeners() {
        const controls = {
            theme: this.dialog.querySelector('.pdt-theme-toggle'),
            refresh: this.dialog.querySelector('.pdt-refresh-btn'),
            godMode: this.dialog.querySelector('.pdt-god-mode-btn'),
            reset: this.dialog.querySelector('.pdt-reset-form-btn'),
            showLogical: this.dialog.querySelector('.pdt-show-logical-btn'),
            hideLogical: this.dialog.querySelector('.pdt-hide-logical-btn')
        };

        if (controls.theme) {
            controls.theme.onclick = () => this._handleThemeToggle();
        }
        if (controls.refresh) {
            controls.refresh.onclick = () => this.refreshActiveTab();
        }
        if (controls.godMode) {
            controls.godMode.onclick = () => this._handleGodMode();
        }
        if (controls.reset) {
            controls.reset.onclick = () => this._handleResetForm();
        }
        if (controls.showLogical) {
            controls.showLogical.onclick = () => this._handleShowLogical();
        }
        if (controls.hideLogical) {
            controls.hideLogical.onclick = () => this._handleHideLogical();
        }
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
                    <h1><span>Power</span>-Toolkit</h1>
                    <div id="pdt-impersonation-indicator"></div>
                </div>
                <div class="pdt-header-controls">
                    ${this._renderHeaderButtons()}
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
        MinimizeService.init(this.dialog);
        this.updateNavTabs();
    },

    /**
     * Gets the button configuration mapping for header buttons.
     * @returns {Object} A map of button IDs to their configuration.
     * @private
     */
    _getHeaderButtonConfig() {
        return {
            showLogical: {
                className: 'pdt-show-logical-btn',
                title: 'Show Logical Names',
                icon: ICONS.showLogical
            },
            hideLogical: {
                className: 'pdt-hide-logical-btn',
                title: 'Hide Logical Names',
                icon: ICONS.hideLogical
            },
            resetForm: {
                className: 'pdt-reset-form-btn',
                title: 'Reset Form (Discard Changes)',
                icon: ICONS.reset
            },
            godMode: {
                className: 'pdt-god-mode-btn',
                title: 'Activate God Mode',
                icon: ICONS.gmode
            },
            refresh: {
                className: 'pdt-refresh-btn',
                title: 'Refresh Tool & Clear Cache',
                icon: ICONS.refresh
            },
            theme: {
                className: 'pdt-theme-toggle',
                title: 'Toggle Theme',
                icon: ICONS.theme
            },
            minimize: {
                className: 'pdt-minimize-btn',
                title: 'Minimize',
                icon: ICONS.minimize
            }
        };
    },

    /**
     * Renders header buttons based on user settings.
     * @returns {string} HTML string for header buttons.
     * @private
     */
    _renderHeaderButtons() {
        const headerButtonSettings = Store.getState().headerButtonSettings;
        const buttonConfig = this._getHeaderButtonConfig();

        return headerButtonSettings
            .filter(setting => setting.visible)
            .filter(setting => {
                if (setting.formOnly && !PowerAppsApiService.isFormContextAvailable) {
                    return false;
                }
                return true;
            })
            .map(setting => {
                const config = buttonConfig[setting.id];
                if (!config) {
                    return '';
                }
                return `<button class="pdt-icon-btn ${config.className}" title="${config.title}">${config.icon}</button>`;
            })
            .join('');
    },

    /**
     * Re-renders the navigation tabs based on the current settings in the store.
     * It intelligently determines which tab to activate after the update.
     * @returns {void}
     */
    updateNavTabs() {
        const tabsContainer = this.dialog.querySelector('.pdt-nav-tabs');
        const contentArea = this.dialog.querySelector('.pdt-content');
        if (!tabsContainer || !contentArea) {
            return;
        } // Guard clause

        const previouslyActiveTabId = this.activeTabId;
        tabsContainer.textContent = '';

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
            if (!setting.visible || !component) {
                return;
            }
            // This is the core logic that now runs every time
            if (component.isFormOnly && !PowerAppsApiService.isFormContextAvailable) {
                return;
            }

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

    /**
     * Clears the tool's internal data cache and forces a re-render of the active tab.
     * @param {boolean} [showNotification=true] - If true, a success notification is shown.
     * @private
     */
    refreshActiveTab(showNotification = true) {
        if (showNotification) {
            DataService.clearCache();
            NotificationService.show(Config.MESSAGES.UI_MANAGER.cacheCleared, 'success');
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

    /**
     * Manages the visibility of tab content. It hides the previously active tab,
     * shows the selected one (retrieving from cache if possible), and handles the
     * initial render and postRender lifecycle for new tabs.
     * @param {string} componentId - The ID of the component to show.
     * @private
     */
    async _showTab(componentId) {
        if (!componentId || !this.dialog) {
            return;
        }
        const component = ComponentRegistry.get(componentId);
        if (!component) {
            return;
        }

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
                contentWrapper.textContent = '';
                contentWrapper.appendChild(content);
                component.postRender(contentWrapper);
            } catch (e) {
                contentWrapper.innerHTML = `<div class="pdt-error">Error rendering tab: ${e.message}</div>`;
                NotificationService.show(Config.MESSAGES.UI_MANAGER.renderFailed(component.label), 'error');
                console.error(`Failed to render ${component.label}:`, e);
            }
        }
    },

    /**
     * Attaches event listeners for the main UI controls, including the close, theme, and refresh buttons.
     * Buttons are only attached if they exist (user may have hidden them via settings).
     * @private
     */
    _attachEventListeners() {
        const controls = {
            close: this.dialog.querySelector('.pdt-close-btn'),
            theme: this.dialog.querySelector('.pdt-theme-toggle'),
            refresh: this.dialog.querySelector('.pdt-refresh-btn'),
            godMode: this.dialog.querySelector('.pdt-god-mode-btn'),
            reset: this.dialog.querySelector('.pdt-reset-form-btn'),
            showLogical: this.dialog.querySelector('.pdt-show-logical-btn'),
            hideLogical: this.dialog.querySelector('.pdt-hide-logical-btn')
            // Note: minimize button handled by MinimizeService
        };

        // Close button is always present
        controls.close.onclick = () => this._handleClose();

        // Attach handlers only if buttons exist (they may be hidden via settings)
        if (controls.theme) {
            controls.theme.onclick = () => this._handleThemeToggle();
        }
        if (controls.refresh) {
            controls.refresh.onclick = () => this.refreshActiveTab();
        }
        // Minimize button event listener is handled by MinimizeService.init()

        // Form-only buttons - attach handlers if they exist (they're already filtered out if form context unavailable)
        if (controls.godMode) {
            controls.godMode.onclick = () => this._handleGodMode();
        }
        if (controls.reset) {
            controls.reset.onclick = () => this._handleResetForm();
        }
        if (controls.showLogical) {
            controls.showLogical.onclick = () => this._handleShowLogical();
        }
        if (controls.hideLogical) {
            controls.hideLogical.onclick = () => this._handleHideLogical();
        }

        // Store global click handler for cleanup
        this._globalClickHandler = (e) => {
            if (!e.target.closest(`.powerapps-dev-toolkit, #${Config.DIALOG_OVERLAY_ID}`)) {
                return;
            }
            const copyable = e.target.closest('.copyable');
            if (copyable) {
                copyToClipboard(copyable.textContent, `Copied: ${copyable.textContent}`);
            }
        };
        document.addEventListener('click', this._globalClickHandler);
    },

    /**
     * Applies the saved dimensions and position from the store to the dialog,
     * with boundary checks to ensure it remains visible within the viewport.
     * @private
     */
    _applySavedDimensions() {
        const state = Store.getState();
        const isMinimized = state.isMinimized;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // If minimized, use minimized banner width or fall back to default
        if (isMinimized && state.minimizedBannerWidth) {
            const width = parseInt(state.minimizedBannerWidth, 10);
            this.dialog.style.width = Math.min(width, vw - 20) + 'px';
            // Height will be handled by CSS when minimized class is applied
            const top = state.preMinimizedDimensions?.top ? parseInt(state.preMinimizedDimensions.top, 10) : vh * 0.05;
            const left = state.preMinimizedDimensions?.left ? parseInt(state.preMinimizedDimensions.left, 10) : vw * 0.125;
            this.dialog.style.top = Math.max(0, Math.min(top, vh - 50)) + 'px';
            this.dialog.style.left = Math.max(0, Math.min(left, vw - 150)) + 'px';
        } else {
            // Not minimized, use regular dimensions
            const savedDims = state.dimensions;
            const width = savedDims.width ? parseInt(savedDims.width, 10) : vw * 0.75;
            const height = savedDims.height ? parseInt(savedDims.height, 10) : vh * 0.85;
            const top = savedDims.top ? parseInt(savedDims.top, 10) : vh * 0.05;
            const left = savedDims.left ? parseInt(savedDims.left, 10) : vw * 0.125;

            this.dialog.style.width = Math.min(width, vw - 20) + 'px';
            this.dialog.style.height = Math.min(height, vh - 20) + 'px';
            this.dialog.style.top = Math.max(0, Math.min(top, vh - 50)) + 'px';
            this.dialog.style.left = Math.max(0, Math.min(left, vw - 150)) + 'px';
        }
    },

    /**
     * Saves the current dialog dimensions to the store based on the minimized state.
     * When minimized, saves the banner width and position.
     * When restored, saves the full dimensions including height.
     * @private
     * @returns {void}
     */
    _saveCurrentDimensions() {
        if (!this.dialog) {
            return;
        }

        const isMinimized = Store.getState().isMinimized;

        if (isMinimized) {
            // When minimized, save the banner width
            Store.setState({
                minimizedBannerWidth: this.dialog.style.width,
                preMinimizedDimensions: {
                    ...Store.getState().preMinimizedDimensions,
                    top: this.dialog.style.top,
                    left: this.dialog.style.left
                }
            });
        } else {
            // When not minimized, save full dimensions
            Store.setState({
                dimensions: {
                    width: this.dialog.style.width,
                    height: this.dialog.style.height,
                    top: this.dialog.style.top,
                    left: this.dialog.style.left
                }
            });
        }
    },

    /**
     * Implements the logic for making the main dialog draggable via its header and
     * resizable via a `ResizeObserver`. It includes boundary checks to keep the
     * dialog on-screen and debounces saving the dimensions to the store.
     * @private
     */
    _makeDraggableAndResizable() {
        const header = this.dialog.querySelector('.pdt-header');
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        const elementDrag = (e) => {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            let newTop = this.dialog.offsetTop - pos2;
            let newLeft = this.dialog.offsetLeft - pos1;

            // --- NEW: Boundary Checks to keep the dialog on screen ---
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const headerHeight = header.offsetHeight || 50; // Height of the draggable header
            const minVisibleWidth = 150; // Ensure at least this much is visible horizontally

            // Constrain the new position to keep the dialog accessible
            newTop = Math.max(0, Math.min(newTop, vh - headerHeight));
            newLeft = Math.max(-this.dialog.offsetWidth + minVisibleWidth, Math.min(newLeft, vw - minVisibleWidth));

            this.dialog.style.top = `${newTop}px`;
            this.dialog.style.left = `${newLeft}px`;
        };

        const saveDimensions = debounce(() => {
            this._saveCurrentDimensions();
        }, 500);

        // Store reference for cleanup
        this._saveDimensions = saveDimensions;

        const closeDragElement = () => {
            document.onmouseup = null;
            document.onmousemove = null;
            document.body.style.cursor = '';
            saveDimensions();
        };

        header.onmousedown = (e) => {
            if (e.target.closest('.pdt-header-controls')) {
                return;
            }
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.body.style.cursor = 'move';
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        };

        header.ondblclick = (e) => {
            if (e.target.closest('.pdt-header-controls')) {
                return;
            }
            MinimizeService.toggle();
        };

        const resizeObserver = new ResizeObserver(saveDimensions);
        resizeObserver.observe(this.dialog);
    },

    /**
     * Toggles the application's theme between 'light' and 'dark' and updates the central store.
     * @private
     */
    _handleThemeToggle() {
        const newTheme = Store.getState().theme === 'light' ? 'dark' : 'light';
        Store.setState({ theme: newTheme });
    },

    /**
     * Toggles the `light-mode` class on the main dialog based on the current theme state.
     * @param {'light'|'dark'} theme - The theme to apply.
     * @private
     */
    _handleThemeChange(theme) {
        this.dialog?.classList.toggle('light-mode', theme === 'light');
    },

    /**
     * Activates "God Mode" by removing disabled/required attributes and showing hidden controls.
     * @private
     */
    _handleGodMode() {
        let unlocked = 0, required = 0, shown = 0;
        PowerAppsApiService.getAllControls().forEach(c => {
            try {
                if (c.getDisabled()) {
                    c.setDisabled(false); unlocked++;
                }
                if (c.getVisible && !c.getVisible()) {
                    c.setVisible(true); shown++;
                }
                const a = c.getAttribute();
                if (a?.getRequiredLevel() === 'required') {
                    a.setRequiredLevel('none'); required++;
                }
            } catch (_e) { /* Safely ignore */ }
        });
        NotificationService.show(Config.MESSAGES.UI_MANAGER.godModeSuccess(unlocked, required, shown), 'success');
    },

    /**
     * Resets all unsaved changes on the current form by calling the `refresh` API.
     * @private
     */
    async _handleResetForm() {
        if (!PowerAppsApiService.getEntityId()) {
            NotificationService.show(Config.MESSAGES.UI_MANAGER.cannotResetNew, 'warn');
            return;
        }
        try {
            await PowerAppsApiService.refreshForm(false);
            NotificationService.show(Config.MESSAGES.UI_MANAGER.formReset, 'success');
        } catch (e) {
            NotificationService.show(Config.MESSAGES.UI_MANAGER.resetFailed(e.message), 'error');
        }
    },

    /**
     * Shows logical names as overlay badges on form tabs, sections, and controls.
     * Overlays are positioned above elements on the left side and are clickable to copy.
     * @private
     */
    _handleShowLogical() {
        const formContext = PowerAppsApiService.getFormContext();
        if (!formContext?.ui) {
            return;
        }

        this._handleHideLogical(true);
        this._logicalOverlays = [];

        let tabCount = 0;
        let sectionCount = 0;
        let controlCount = 0;

        const tabs = formContext.ui.tabs?.get?.() || [];
        tabs.forEach(tab => {
            const tabName = tab.getName();
            const tabElement = document.querySelector(`li[data-id="tablist-${tabName}"]`) ||
                document.querySelector(`[data-id="${tabName}"]`) ||
                document.querySelector(`[id*="${tabName}"]`);

            if (tabElement) {
                this._addLogicalOverlay(tabElement, tabName, 'tab');
                tabCount++;
            }

            const sections = tab.sections?.get?.() || [];
            sections.forEach(section => {
                const sectionName = section.getName();
                const sectionElement = document.querySelector(`section[data-id="${sectionName}"]`) ||
                    document.querySelector(`[data-id="${sectionName}"]`) ||
                    document.querySelector(`div[data-control-name="${sectionName}"]`);

                if (sectionElement) {
                    this._addLogicalOverlay(sectionElement, sectionName, 'section');
                    sectionCount++;
                }

                const controls = section.controls?.get?.() || [];
                const processedControls = new Set();

                controls.forEach(control => {
                    const controlName = control.getName();

                    let displayName = controlName;
                    const compositeControlSuffix = '_compositionLinkControl_';
                    if (controlName.includes(compositeControlSuffix)) {
                        displayName = controlName.split(compositeControlSuffix)[1] || controlName;
                    }

                    if (processedControls.has(displayName)) {
                        return;
                    }
                    processedControls.add(displayName);

                    const controlElement = document.querySelector(`div[data-control-name="${controlName}"]`) ||
                        document.querySelector(`[data-lp-id*="${controlName}"]`) ||
                        document.querySelector(`[data-id="${controlName}"]`);

                    if (controlElement) {
                        this._addLogicalOverlay(controlElement, displayName, 'control');
                        controlCount++;
                    }
                });
            });
        });

        NotificationService.show(
            Config.MESSAGES.UI_MANAGER.logicalNamesShown(tabCount, sectionCount, controlCount),
            'success'
        );
    },

    /**
     * Adds a logical name overlay to a form element, positioned inside it at top-left.
     * @param {HTMLElement} element - The DOM element to attach the overlay to.
     * @param {string} logicalName - The logical name to display.
     * @param {'tab'|'section'|'control'} type - The type of element for styling.
     * @private
     */
    _addLogicalOverlay(element, logicalName, type) {
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.position === 'static') {
            element.style.position = 'relative';
            element.dataset.pdtOriginalPosition = 'static';
        }

        const overlay = document.createElement('span');
        overlay.className = `pdt-form-logical-overlay pdt-logical-${type}`;
        overlay.textContent = logicalName;
        overlay.title = 'Click to copy';

        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            copyToClipboard(logicalName, Config.MESSAGES.UI_MANAGER.logicalNameCopied(logicalName));
        });

        element.appendChild(overlay);
    },

    /**
     * Removes all logical name overlays from the form.
     * @param {boolean} [silent=false] - If true, don't show notification.
     * @private
     */
    _handleHideLogical(silent = false) {
        const overlays = document.querySelectorAll('.pdt-form-logical-overlay');

        if (overlays.length === 0 && !silent) {
            NotificationService.show(Config.MESSAGES.UI_MANAGER.logicalNamesAlreadyHidden, 'info');
            return;
        }

        overlays.forEach(overlay => {
            const parent = overlay.parentElement;
            if (parent?.dataset.pdtOriginalPosition === 'static') {
                parent.style.position = '';
                delete parent.dataset.pdtOriginalPosition;
            }
            overlay.remove();
        });

        if (!silent) {
            NotificationService.show(Config.MESSAGES.UI_MANAGER.logicalNamesHidden, 'success');
        }
    },

    /**
     * Hides the main dialog from view without destroying it.
     * @private
     */
    _hideDialog() {
        if (this.dialog) {
            this.dialog.style.display = 'none';
        }
    },

    /**
     * Fully cleans up and removes the toolkit from the page.
     * It calls the `destroy()` lifecycle hook on all active components, removes the
     * main dialog from the DOM, and resets state to allow for a clean re-initialization.
     * @private
     */
    _handleClose() {
        try {
            // Immediately save the final dimensions to the store before closing.
            // This ensures the last position is always remembered, even without a drag/resize.
            try {
                this._saveCurrentDimensions();
            } catch (_err) {
                // Silently handle state saving errors
            }

            // Hide dialog immediately for better UX
            if (this.dialog) {
                this.dialog.style.display = 'none';
            }

            // Cancel any pending debounced dimension save
            if (this._saveDimensions?.cancel) {
                this._saveDimensions.cancel();
            }

            // Use requestAnimationFrame to defer cleanup and prevent race conditions with Power Apps SDK
            requestAnimationFrame(() => {
                try {
                    // Clean up all component event listeners
                    const components = ComponentRegistry.getAll();
                    components.forEach(c => {
                        try {
                            c.destroy();
                        } catch (_err) {
                            // Silently handle per-component cleanup errors
                        }
                    });

                    // Clean up MinimizeService
                    try {
                        MinimizeService.destroy();
                    } catch (_err) {
                        // Silently handle MinimizeService cleanup errors
                    }

                    // Remove global click listener
                    if (this._globalClickHandler) {
                        try {
                            document.removeEventListener('click', this._globalClickHandler);
                        } catch (_err) {
                            // Silently handle event listener removal errors
                        }
                        this._globalClickHandler = null;
                    }

                    // Remove the main UI dialog from the page.
                    if (this.dialog && this.dialog.parentNode) {
                        try {
                            this.dialog.remove();
                        } catch (_err) {
                            // Silently handle DOM removal errors
                        }
                        this.dialog = null;
                    }

                    // Reset all internal state for a clean re-initialization.
                    this.renderedTabs.clear();
                    this.activeTabId = null;

                    try {
                        DataService.clearCache();
                    } catch (_err) {
                        // Silently handle cache clearing errors
                    }

                    // Reset the global flag to allow the tool to be launched again.
                    delete window[Config.MAIN.windowInitializedFlag];

                    // Find and remove the injected script tag using the correct ID to allow for re-injection.
                    const scriptTag = document.getElementById('power-toolkit-script-module');
                    if (scriptTag && scriptTag.parentNode) {
                        try {
                            scriptTag.remove();
                        } catch (_err) {
                            // Silently handle script tag removal errors
                        }
                    }
                } catch (_cleanupError) {
                    // Final catch-all for any unexpected errors during deferred cleanup
                    // This prevents any errors from propagating to Power Apps SDK
                }
            });
        } catch (_error) {
            // Catch any synchronous errors to prevent them from propagating to Power Apps SDK
            // The toolkit is closing anyway, so we silently handle these errors
        }
    }
};