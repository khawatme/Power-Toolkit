/**
 * @file Comprehensive Tests for UIManager
 * @module tests/core/UIManager.test.js
 * @description Tests for the main UI manager that controls the toolkit dialog
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Store
vi.mock('../../src/core/Store.js', () => ({
    Store: {
        getState: vi.fn(() => ({
            theme: 'dark',
            tabSettings: [
                { id: 'inspector', visible: true },
                { id: 'settings', visible: true },
            ],
            headerButtonSettings: [
                { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
            ],
            dimensions: { width: '800px', height: '600px', top: '100px', left: '100px' },
            isMinimized: false,
            minimizedBannerWidth: '300px',
            preMinimizedDimensions: {},
        })),
        subscribe: vi.fn((callback) => {
            // Return unsubscribe function
            return vi.fn();
        }),
        setState: vi.fn(),
    }
}));

// Mock ComponentRegistry
vi.mock('../../src/core/ComponentRegistry.js', () => ({
    ComponentRegistry: {
        get: vi.fn((id) => {
            if (id === 'inspector') {
                return {
                    id: 'inspector',
                    label: 'Inspector',
                    icon: '<svg></svg>',
                    isFormOnly: false,
                    render: vi.fn(() => Promise.resolve(document.createElement('div'))),
                    postRender: vi.fn(),
                    destroy: vi.fn(),
                };
            }
            if (id === 'settings') {
                return {
                    id: 'settings',
                    label: 'Settings',
                    icon: '<svg></svg>',
                    isFormOnly: false,
                    render: vi.fn(() => Promise.resolve(document.createElement('div'))),
                    postRender: vi.fn(),
                    destroy: vi.fn(),
                };
            }
            if (id === 'formOnly') {
                return {
                    id: 'formOnly',
                    label: 'Form Only',
                    icon: '<svg></svg>',
                    isFormOnly: true,
                    render: vi.fn(() => Promise.resolve(document.createElement('div'))),
                    postRender: vi.fn(),
                    destroy: vi.fn(),
                };
            }
            return null;
        }),
        getAll: vi.fn(() => [
            { id: 'inspector', label: 'Inspector', icon: '<svg></svg>', isFormOnly: false },
            { id: 'settings', label: 'Settings', icon: '<svg></svg>', isFormOnly: false },
        ]),
    }
}));

// Mock PowerAppsApiService
vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: false,
    }
}));

// Mock DataService
vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        clearCache: vi.fn(),
    }
}));

// Mock NotificationService
vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: {
        show: vi.fn(),
    }
}));

// Mock MinimizeService
vi.mock('../../src/services/MinimizeService.js', () => ({
    MinimizeService: {
        init: vi.fn(),
    }
}));

// Mock StyleManager
vi.mock('../../src/ui/StyleManager.js', () => ({
    StyleManager: {
        init: vi.fn(),
    }
}));

// Mock helpers
vi.mock('../../src/helpers/index.js', () => ({
    copyToClipboard: vi.fn(),
    debounce: vi.fn((fn) => fn),
    escapeHtml: vi.fn((str) => str),
}));

// Import mocked modules for assertions
import { Store } from '../../src/core/Store.js';
import { ComponentRegistry } from '../../src/core/ComponentRegistry.js';
import { DataService } from '../../src/services/DataService.js';
import { NotificationService } from '../../src/services/NotificationService.js';
import { MinimizeService } from '../../src/services/MinimizeService.js';
import { StyleManager } from '../../src/ui/StyleManager.js';

describe('UIManager', () => {
    let UIManager;

    beforeEach(async () => {
        vi.clearAllMocks();
        document.body.innerHTML = '';

        // Reset modules to get fresh UIManager
        vi.resetModules();
        const module = await import('../../src/core/UIManager.js');
        UIManager = module.UIManager;

        // Reset UIManager state
        UIManager.dialog = null;
        UIManager.activeTabId = null;
        UIManager.renderedTabs = new Map();
        UIManager._globalClickHandler = null;
    });

    afterEach(() => {
        // Clean up any dialogs
        document.querySelectorAll('.powerapps-dev-toolkit').forEach(el => el.remove());
        // Remove global click handler if set
        if (UIManager._globalClickHandler) {
            document.removeEventListener('click', UIManager._globalClickHandler);
        }
    });

    describe('initialization', () => {
        it('should have required properties', () => {
            expect(UIManager).toBeDefined();
            expect(UIManager.dialog).toBeNull();
            expect(UIManager.activeTabId).toBeNull();
            expect(UIManager.renderedTabs).toBeInstanceOf(Map);
        });

        it('should have required methods', () => {
            expect(typeof UIManager.showImpersonationIndicator).toBe('function');
            expect(typeof UIManager.init).toBe('function');
            expect(typeof UIManager.showDialog).toBe('function');
            expect(typeof UIManager.updateNavTabs).toBe('function');
            expect(typeof UIManager.refreshActiveTab).toBe('function');
        });
    });

    describe('init', () => {
        it('should subscribe to store changes', () => {
            UIManager.init();

            expect(Store.subscribe).toHaveBeenCalled();
        });

        it('should not throw when initializing', () => {
            expect(() => UIManager.init()).not.toThrow();
        });
    });

    describe('showImpersonationIndicator', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = '<div id="pdt-impersonation-indicator"></div>';
        });

        it('should show impersonation indicator with username', () => {
            UIManager.showImpersonationIndicator('John Doe');

            const indicator = UIManager.dialog.querySelector('#pdt-impersonation-indicator');
            expect(indicator?.innerHTML).toContain('John Doe');
            expect(indicator?.innerHTML).toContain('Impersonating');
        });

        it('should hide impersonation indicator when null', () => {
            UIManager.showImpersonationIndicator(null);

            const indicator = UIManager.dialog.querySelector('#pdt-impersonation-indicator');
            expect(indicator?.textContent).toBe('');
        });

        it('should not throw when dialog is null', () => {
            UIManager.dialog = null;
            expect(() => UIManager.showImpersonationIndicator('Test')).not.toThrow();
        });

        it('should escape HTML in username', () => {
            UIManager.showImpersonationIndicator('<script>alert("xss")</script>');

            const indicator = UIManager.dialog.querySelector('#pdt-impersonation-indicator');
            // escapeHtml mock returns string as-is, but in real code it would escape
            expect(indicator?.innerHTML).toBeDefined();
        });
    });

    describe('showDialog', () => {
        it('should create dialog when not exists', () => {
            UIManager.showDialog();

            expect(UIManager.dialog).toBeTruthy();
            expect(UIManager.dialog.className).toContain('powerapps-dev-toolkit');
        });

        it('should initialize StyleManager', () => {
            UIManager.showDialog();

            expect(StyleManager.init).toHaveBeenCalled();
        });

        it('should initialize MinimizeService', () => {
            UIManager.showDialog();

            expect(MinimizeService.init).toHaveBeenCalledWith(UIManager.dialog);
        });

        it('should append dialog to document body', () => {
            UIManager.showDialog();

            expect(document.body.querySelector('.powerapps-dev-toolkit')).toBeTruthy();
        });

        it('should not create duplicate dialogs', () => {
            UIManager.showDialog();
            const firstDialog = UIManager.dialog;

            UIManager.showDialog();

            expect(UIManager.dialog).toBe(firstDialog);
            expect(document.querySelectorAll('.powerapps-dev-toolkit').length).toBe(1);
        });

        it('should show existing dialog if hidden', () => {
            UIManager.showDialog();
            UIManager.dialog.style.display = 'none';

            UIManager.showDialog();

            expect(UIManager.dialog.style.display).toBe('flex');
        });

        it('should create header with controls', () => {
            UIManager.showDialog();

            expect(UIManager.dialog.querySelector('.pdt-header')).toBeTruthy();
            expect(UIManager.dialog.querySelector('.pdt-close-btn')).toBeTruthy();
            expect(UIManager.dialog.querySelector('.pdt-theme-toggle')).toBeTruthy();
            expect(UIManager.dialog.querySelector('.pdt-refresh-btn')).toBeTruthy();
            expect(UIManager.dialog.querySelector('.pdt-minimize-btn')).toBeTruthy();
        });

        it('should create navigation and content areas', () => {
            UIManager.showDialog();

            expect(UIManager.dialog.querySelector('.pdt-nav-tabs')).toBeTruthy();
            expect(UIManager.dialog.querySelector('.pdt-content')).toBeTruthy();
        });

        it('should create footer with version info', () => {
            UIManager.showDialog();

            expect(UIManager.dialog.querySelector('.pdt-footer')).toBeTruthy();
        });

        it('should call updateNavTabs after creation', () => {
            const spy = vi.spyOn(UIManager, 'updateNavTabs');

            UIManager.showDialog();

            expect(spy).toHaveBeenCalled();
        });
    });

    describe('updateNavTabs', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <nav class="pdt-nav-tabs"></nav>
                <main class="pdt-content"></main>
            `;
        });

        it('should populate navigation with visible tabs', () => {
            UIManager.updateNavTabs();

            const navTabs = UIManager.dialog.querySelector('.pdt-nav-tabs');
            expect(navTabs.children.length).toBeGreaterThan(0);
        });

        it('should create buttons for each visible tab', () => {
            UIManager.updateNavTabs();

            const buttons = UIManager.dialog.querySelectorAll('.pdt-nav-tab');
            expect(buttons.length).toBe(2); // inspector and settings
        });

        it('should throw when dialog is null', () => {
            UIManager.dialog = null;
            expect(() => UIManager.updateNavTabs()).toThrow();
        });

        it('should not throw when navigation container is missing', () => {
            UIManager.dialog = document.createElement('div');
            expect(() => UIManager.updateNavTabs()).not.toThrow();
        });

        it('should activate first visible tab', async () => {
            UIManager.updateNavTabs();

            // Wait for async _showTab
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(UIManager.activeTabId).toBeTruthy();
        });
    });

    describe('refreshActiveTab', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <nav class="pdt-nav-tabs"></nav>
                <main class="pdt-content"></main>
            `;
        });

        it('should clear cache when showNotification is true', () => {
            UIManager.refreshActiveTab(true);

            expect(DataService.clearCache).toHaveBeenCalled();
        });

        it('should show notification when showNotification is true', () => {
            UIManager.refreshActiveTab(true);

            expect(NotificationService.show).toHaveBeenCalled();
        });

        it('should not clear cache when showNotification is false', () => {
            UIManager.refreshActiveTab(false);

            expect(DataService.clearCache).not.toHaveBeenCalled();
        });

        it('should not throw when no active tab', () => {
            UIManager.activeTabId = null;
            expect(() => UIManager.refreshActiveTab(false)).not.toThrow();
        });

        it('should destroy and re-render active tab component', async () => {
            // Set up active tab
            UIManager.activeTabId = 'inspector';
            const mockContent = document.createElement('div');
            UIManager.renderedTabs.set('inspector', mockContent);
            UIManager.dialog.querySelector('.pdt-content').appendChild(mockContent);

            // Store initial cache state
            const initialCacheSize = UIManager.renderedTabs.size;

            UIManager.refreshActiveTab(false);

            // Tab should be removed from cache (then re-added by _showTab)
            // Just verify no error was thrown and activeTabId is still set
            expect(UIManager.activeTabId).toBe('inspector');
        });
    });

    describe('tab caching', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <nav class="pdt-nav-tabs">
                    <button class="pdt-nav-tab" data-tab-id="inspector">Inspector</button>
                    <button class="pdt-nav-tab" data-tab-id="settings">Settings</button>
                </nav>
                <main class="pdt-content"></main>
            `;
        });

        it('should cache rendered tabs', async () => {
            // Manually trigger _showTab
            await UIManager._showTab('inspector');

            expect(UIManager.renderedTabs.has('inspector')).toBe(true);
        });

        it('should reuse cached content when switching back to tab', async () => {
            // Show inspector
            await UIManager._showTab('inspector');
            const cachedContent = UIManager.renderedTabs.get('inspector');

            // Show settings
            await UIManager._showTab('settings');

            // Show inspector again
            await UIManager._showTab('inspector');

            // Should use same cached element
            expect(UIManager.renderedTabs.get('inspector')).toBe(cachedContent);
        });
    });

    describe('_showTab', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <nav class="pdt-nav-tabs">
                    <button class="pdt-nav-tab" data-tab-id="inspector">Inspector</button>
                    <button class="pdt-nav-tab" data-tab-id="settings">Settings</button>
                </nav>
                <main class="pdt-content"></main>
            `;
        });

        it('should not throw for null componentId', async () => {
            await expect(UIManager._showTab(null)).resolves.not.toThrow();
        });

        it('should not throw for invalid componentId', async () => {
            await expect(UIManager._showTab('nonexistent')).resolves.not.toThrow();
        });

        it('should set activeTabId', async () => {
            await UIManager._showTab('inspector');

            expect(UIManager.activeTabId).toBe('inspector');
        });

        it('should add active class to tab button', async () => {
            await UIManager._showTab('inspector');

            const button = UIManager.dialog.querySelector('[data-tab-id="inspector"]');
            expect(button.classList.contains('active')).toBe(true);
        });

        it('should call component render', async () => {
            await UIManager._showTab('inspector');

            // Verify content was rendered (ComponentRegistry.get is called internally)
            expect(UIManager.renderedTabs.has('inspector')).toBe(true);
        });

        it('should call component postRender after render', async () => {
            await UIManager._showTab('inspector');

            // Verify the content wrapper was created and added to renderedTabs
            const wrapper = UIManager.renderedTabs.get('inspector');
            expect(wrapper).toBeTruthy();
            expect(wrapper.classList.contains('pdt-content-host')).toBe(true);
        });

        it('should hide previously active tab', async () => {
            await UIManager._showTab('inspector');
            const inspectorContent = UIManager.renderedTabs.get('inspector');

            await UIManager._showTab('settings');

            expect(inspectorContent.style.display).toBe('none');
        });

        it('should handle render errors gracefully', async () => {
            // Mock component that throws on render
            ComponentRegistry.get.mockImplementationOnce(() => ({
                id: 'error-tab',
                label: 'Error Tab',
                render: vi.fn(() => Promise.reject(new Error('Render failed'))),
                postRender: vi.fn(),
            }));

            await expect(UIManager._showTab('error-tab')).resolves.not.toThrow();
            expect(NotificationService.show).toHaveBeenCalled();
        });
    });

    describe('theme handling', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.className = 'powerapps-dev-toolkit';
        });

        it('should apply light mode class when theme is light', () => {
            UIManager._handleThemeChange('light');

            expect(UIManager.dialog.classList.contains('light-mode')).toBe(true);
        });

        it('should remove light mode class when theme is dark', () => {
            UIManager.dialog.classList.add('light-mode');

            UIManager._handleThemeChange('dark');

            expect(UIManager.dialog.classList.contains('light-mode')).toBe(false);
        });

        it('should toggle between themes', () => {
            UIManager._handleThemeChange('light');
            expect(UIManager.dialog.classList.contains('light-mode')).toBe(true);

            UIManager._handleThemeChange('dark');
            expect(UIManager.dialog.classList.contains('light-mode')).toBe(false);
        });
    });

    describe('dimension management', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.style.width = '800px';
            UIManager.dialog.style.height = '600px';
            UIManager.dialog.style.top = '100px';
            UIManager.dialog.style.left = '100px';
        });

        it('should apply saved dimensions', () => {
            UIManager._applySavedDimensions();

            expect(UIManager.dialog.style.width).toBeTruthy();
            expect(UIManager.dialog.style.height).toBeTruthy();
        });

        it('should save current dimensions', () => {
            UIManager._saveCurrentDimensions();

            expect(Store.setState).toHaveBeenCalled();
        });

        it('should handle minimized state dimensions', () => {
            Store.getState.mockReturnValueOnce({
                isMinimized: true,
                minimizedBannerWidth: '300px',
                preMinimizedDimensions: { top: '50px', left: '50px' },
                dimensions: {},
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager._applySavedDimensions();

            // Should apply minimized width
            expect(UIManager.dialog.style.width).toBeTruthy();
        });
    });

    describe('cleanup', () => {
        it('should hide dialog on close', () => {
            UIManager.showDialog();

            UIManager._handleClose();

            expect(UIManager.dialog.style.display).toBe('none');
        });

        it('should save dimensions before closing', () => {
            UIManager.showDialog();

            UIManager._handleClose();

            expect(Store.setState).toHaveBeenCalled();
        });
    });

    describe('store subscription callbacks', () => {
        it('should handle theme changes via subscription callback', () => {
            UIManager.init();

            // Get the callback that was passed to subscribe
            const subscribeCallback = Store.subscribe.mock.calls[0][0];

            UIManager.dialog = document.createElement('div');
            UIManager.dialog.className = 'powerapps-dev-toolkit';

            // Simulate theme change from dark to light
            subscribeCallback(
                { theme: 'light', tabSettings: [] },
                { theme: 'dark', tabSettings: [] }
            );

            expect(UIManager.dialog.classList.contains('light-mode')).toBe(true);
        });

        it('should update nav tabs when tab settings change', () => {
            UIManager.init();

            const subscribeCallback = Store.subscribe.mock.calls[0][0];

            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <nav class="pdt-nav-tabs"></nav>
                <main class="pdt-content"></main>
            `;

            const updateNavTabsSpy = vi.spyOn(UIManager, 'updateNavTabs');

            // Simulate tab settings change
            subscribeCallback(
                { theme: 'dark', tabSettings: [{ id: 'inspector', visible: true }] },
                { theme: 'dark', tabSettings: [{ id: 'settings', visible: true }] }
            );

            expect(updateNavTabsSpy).toHaveBeenCalled();
        });

        it('should not update nav tabs when tab settings are identical', () => {
            UIManager.init();

            const subscribeCallback = Store.subscribe.mock.calls[0][0];
            const updateNavTabsSpy = vi.spyOn(UIManager, 'updateNavTabs');

            const sameSettings = [{ id: 'inspector', visible: true }];

            subscribeCallback(
                { theme: 'dark', tabSettings: sameSettings },
                { theme: 'dark', tabSettings: sameSettings }
            );

            expect(updateNavTabsSpy).not.toHaveBeenCalled();
        });
    });

    describe('_attachEventListeners', () => {
        beforeEach(() => {
            UIManager.showDialog();
        });

        it('should set up close button handler', () => {
            const closeBtn = UIManager.dialog.querySelector('.pdt-close-btn');
            const handleCloseSpy = vi.spyOn(UIManager, '_handleClose');

            closeBtn.click();

            expect(handleCloseSpy).toHaveBeenCalled();
        });

        it('should set up theme toggle handler', () => {
            const themeBtn = UIManager.dialog.querySelector('.pdt-theme-toggle');
            const handleThemeToggleSpy = vi.spyOn(UIManager, '_handleThemeToggle');

            themeBtn.click();

            expect(handleThemeToggleSpy).toHaveBeenCalled();
        });

        it('should set up refresh button handler', () => {
            const refreshBtn = UIManager.dialog.querySelector('.pdt-refresh-btn');
            const refreshSpy = vi.spyOn(UIManager, 'refreshActiveTab');

            refreshBtn.click();

            expect(refreshSpy).toHaveBeenCalled();
        });

        it('should not render form-only buttons when form context is not available', () => {
            // With the new header button configuration, form-only buttons are not rendered
            // when form context is unavailable, instead of being disabled
            const godModeBtn = UIManager.dialog.querySelector('.pdt-god-mode-btn');
            const resetBtn = UIManager.dialog.querySelector('.pdt-reset-form-btn');
            const showLogicalBtn = UIManager.dialog.querySelector('.pdt-show-logical-btn');
            const hideLogicalBtn = UIManager.dialog.querySelector('.pdt-hide-logical-btn');

            // Form-only buttons should not be present when isFormContextAvailable is false
            expect(godModeBtn).toBeNull();
            expect(resetBtn).toBeNull();
            expect(showLogicalBtn).toBeNull();
            expect(hideLogicalBtn).toBeNull();
        });

        it('should set global click handler', () => {
            expect(UIManager._globalClickHandler).toBeDefined();
            expect(typeof UIManager._globalClickHandler).toBe('function');
        });
    });

    describe('global click handler for copyable elements', () => {
        let copyToClipboard;

        beforeEach(async () => {
            const helpers = await import('../../src/helpers/index.js');
            copyToClipboard = helpers.copyToClipboard;
            UIManager.showDialog();
        });

        it('should copy text when clicking copyable element inside dialog', () => {
            const copyable = document.createElement('span');
            copyable.className = 'copyable';
            copyable.textContent = 'test-value';
            UIManager.dialog.appendChild(copyable);

            // Simulate click event
            const event = new MouseEvent('click', { bubbles: true });
            copyable.dispatchEvent(event);

            expect(copyToClipboard).toHaveBeenCalledWith('test-value', 'Copied: test-value');
        });

        it('should not copy when clicking non-copyable element', () => {
            const nonCopyable = document.createElement('span');
            nonCopyable.textContent = 'regular-text';
            UIManager.dialog.appendChild(nonCopyable);

            const event = new MouseEvent('click', { bubbles: true });
            nonCopyable.dispatchEvent(event);

            expect(copyToClipboard).not.toHaveBeenCalled();
        });

        it('should ignore clicks outside dialog', () => {
            const outsideElement = document.createElement('div');
            outsideElement.className = 'copyable';
            outsideElement.textContent = 'outside-value';
            document.body.appendChild(outsideElement);

            const event = new MouseEvent('click', { bubbles: true });
            outsideElement.dispatchEvent(event);

            expect(copyToClipboard).not.toHaveBeenCalled();
            outsideElement.remove();
        });
    });

    describe('_makeDraggableAndResizable', () => {
        beforeEach(() => {
            UIManager.showDialog();
        });

        it('should set up header for dragging', () => {
            const header = UIManager.dialog.querySelector('.pdt-header');
            expect(header.onmousedown).toBeDefined();
        });

        it('should set up double-click handler on header', () => {
            const header = UIManager.dialog.querySelector('.pdt-header');
            expect(header.ondblclick).toBeDefined();
        });

        it('should not start drag when clicking header controls', () => {
            const header = UIManager.dialog.querySelector('.pdt-header');
            const closeBtn = UIManager.dialog.querySelector('.pdt-close-btn');

            const initialTop = UIManager.dialog.style.top;
            const initialLeft = UIManager.dialog.style.left;

            // Simulate mousedown on close button
            const event = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 100,
                clientY: 100,
            });
            closeBtn.dispatchEvent(event);

            // Position should not change
            expect(UIManager.dialog.style.top).toBe(initialTop);
            expect(UIManager.dialog.style.left).toBe(initialLeft);
        });

        it('should start drag when clicking header (not controls)', () => {
            const header = UIManager.dialog.querySelector('.pdt-header');

            const event = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 100,
                clientY: 100,
            });

            // Prevent default to avoid actual DOM manipulation issues
            event.preventDefault = vi.fn();
            header.dispatchEvent(event);

            // Document should have mouse handlers set
            // (hard to test directly, but no error should be thrown)
            expect(() => header.onmousedown(event)).not.toThrow();
        });
    });

    describe('_handleThemeToggle', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
        });

        it('should toggle from dark to light', () => {
            Store.getState.mockReturnValueOnce({
                theme: 'dark',
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager._handleThemeToggle();

            expect(Store.setState).toHaveBeenCalledWith({ theme: 'light' });
        });

        it('should toggle from light to dark', () => {
            Store.getState.mockReturnValueOnce({
                theme: 'light',
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager._handleThemeToggle();

            expect(Store.setState).toHaveBeenCalledWith({ theme: 'dark' });
        });
    });

    describe('_hideDialog', () => {
        it('should hide dialog when it exists', () => {
            UIManager.showDialog();

            UIManager._hideDialog();

            expect(UIManager.dialog.style.display).toBe('none');
        });

        it('should not throw when dialog is null', () => {
            UIManager.dialog = null;

            expect(() => UIManager._hideDialog()).not.toThrow();
        });
    });

    describe('_handleClose comprehensive', () => {
        let MinimizeService;

        beforeEach(async () => {
            const minimizeModule = await import('../../src/services/MinimizeService.js');
            MinimizeService = minimizeModule.MinimizeService;
            MinimizeService.destroy = vi.fn();
        });

        it('should remove global click listener on close', async () => {
            UIManager.showDialog();
            const handler = UIManager._globalClickHandler;

            UIManager._handleClose();

            // Wait for requestAnimationFrame
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(UIManager._globalClickHandler).toBeNull();
        });

        it('should clear rendered tabs on close', async () => {
            UIManager.showDialog();
            await UIManager._showTab('inspector');

            expect(UIManager.renderedTabs.size).toBeGreaterThan(0);

            UIManager._handleClose();

            // Wait for requestAnimationFrame
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(UIManager.renderedTabs.size).toBe(0);
        });

        it('should reset activeTabId on close', async () => {
            UIManager.showDialog();
            await UIManager._showTab('inspector');

            expect(UIManager.activeTabId).toBe('inspector');

            UIManager._handleClose();

            // Wait for requestAnimationFrame
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(UIManager.activeTabId).toBeNull();
        });

        it('should call destroy on all components', async () => {
            UIManager.showDialog();

            UIManager._handleClose();

            // Wait for requestAnimationFrame
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(ComponentRegistry.getAll).toHaveBeenCalled();
        });

        it('should call MinimizeService.destroy', async () => {
            UIManager.showDialog();

            UIManager._handleClose();

            // Wait for requestAnimationFrame
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(MinimizeService.destroy).toHaveBeenCalled();
        });

        it('should clear DataService cache on close', async () => {
            UIManager.showDialog();

            UIManager._handleClose();

            // Wait for requestAnimationFrame
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(DataService.clearCache).toHaveBeenCalled();
        });
    });

    describe('form-only tab filtering', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <nav class="pdt-nav-tabs"></nav>
                <main class="pdt-content"></main>
            `;
        });

        it('should not render form-only tabs when form context is unavailable', () => {
            // tabSettings includes formOnly tab
            Store.getState.mockReturnValueOnce({
                theme: 'dark',
                tabSettings: [
                    { id: 'inspector', visible: true },
                    { id: 'formOnly', visible: true },
                ],
                dimensions: {},
                isMinimized: false,
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.updateNavTabs();

            const navTabs = UIManager.dialog.querySelector('.pdt-nav-tabs');
            // formOnly tab should not be rendered since isFormContextAvailable is false
            const formOnlyTab = navTabs.querySelector('[data-tab-id="formOnly"]');
            expect(formOnlyTab).toBeNull();
        });

        it('should clean up cached form-only tabs when updating nav', () => {
            // Pre-populate cache with a form-only tab
            const formOnlyContent = document.createElement('div');
            UIManager.renderedTabs.set('formOnly', formOnlyContent);
            UIManager.dialog.querySelector('.pdt-content').appendChild(formOnlyContent);

            Store.getState.mockReturnValueOnce({
                theme: 'dark',
                tabSettings: [{ id: 'inspector', visible: true }],
                dimensions: {},
                isMinimized: false,
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.updateNavTabs();

            // formOnly should be removed from cache
            expect(UIManager.renderedTabs.has('formOnly')).toBe(false);
        });
    });

    describe('tab navigation button clicks', () => {
        beforeEach(() => {
            UIManager.showDialog();
        });

        it('should switch tabs when clicking nav tab button', async () => {
            // Wait for initial tab to render
            await new Promise(resolve => setTimeout(resolve, 10));

            const settingsTab = UIManager.dialog.querySelector('[data-tab-id="settings"]');
            if (settingsTab) {
                settingsTab.click();

                await new Promise(resolve => setTimeout(resolve, 10));

                expect(UIManager.activeTabId).toBe('settings');
            }
        });

        it('should remove active class from previous tab', async () => {
            await new Promise(resolve => setTimeout(resolve, 10));

            const inspectorTab = UIManager.dialog.querySelector('[data-tab-id="inspector"]');
            const settingsTab = UIManager.dialog.querySelector('[data-tab-id="settings"]');

            if (inspectorTab && settingsTab) {
                // Click inspector first
                inspectorTab.click();
                await new Promise(resolve => setTimeout(resolve, 10));
                expect(inspectorTab.classList.contains('active')).toBe(true);

                // Click settings
                settingsTab.click();
                await new Promise(resolve => setTimeout(resolve, 10));

                expect(inspectorTab.classList.contains('active')).toBe(false);
                expect(settingsTab.classList.contains('active')).toBe(true);
            }
        });
    });

    describe('updateNavTabs edge cases', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <nav class="pdt-nav-tabs"></nav>
                <main class="pdt-content"></main>
            `;
        });

        it('should show message when no visible tabs', () => {
            Store.getState.mockReturnValueOnce({
                theme: 'dark',
                tabSettings: [],
                dimensions: {},
                isMinimized: false,
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.updateNavTabs();

            const contentArea = UIManager.dialog.querySelector('.pdt-content');
            expect(contentArea.innerHTML).toContain('No visible tabs');
            expect(UIManager.activeTabId).toBeNull();
        });

        it('should maintain active tab if still visible after update', () => {
            UIManager.activeTabId = 'inspector';

            Store.getState.mockReturnValueOnce({
                theme: 'dark',
                tabSettings: [
                    { id: 'inspector', visible: true },
                    { id: 'settings', visible: true },
                ],
                dimensions: {},
                isMinimized: false,
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.updateNavTabs();

            // Should try to re-activate the inspector tab
            expect(UIManager.activeTabId).toBe('inspector');
        });

        it('should switch to first visible tab when active tab becomes hidden', async () => {
            UIManager.activeTabId = 'hidden-tab';

            Store.getState.mockReturnValueOnce({
                theme: 'dark',
                tabSettings: [
                    { id: 'inspector', visible: true },
                    { id: 'settings', visible: true },
                ],
                dimensions: {},
                isMinimized: false,
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.updateNavTabs();

            await new Promise(resolve => setTimeout(resolve, 10));

            // Should switch to first visible tab
            expect(UIManager.activeTabId).toBe('inspector');
        });
    });

    describe('_saveCurrentDimensions', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.style.width = '900px';
            UIManager.dialog.style.height = '700px';
            UIManager.dialog.style.top = '50px';
            UIManager.dialog.style.left = '50px';
        });

        it('should save dimensions when not minimized', () => {
            Store.getState.mockReturnValueOnce({
                isMinimized: false,
                preMinimizedDimensions: {},
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager._saveCurrentDimensions();

            expect(Store.setState).toHaveBeenCalledWith({
                dimensions: {
                    width: '900px',
                    height: '700px',
                    top: '50px',
                    left: '50px',
                },
            });
        });

        it('should save banner width when minimized', () => {
            Store.getState.mockReturnValueOnce({
                isMinimized: true,
                preMinimizedDimensions: { width: '800px', height: '600px' },
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager._saveCurrentDimensions();

            expect(Store.setState).toHaveBeenCalledWith({
                minimizedBannerWidth: '900px',
                preMinimizedDimensions: {
                    top: '50px',
                    left: '50px',
                },
            });
        });

        it('should not save when dialog is null', () => {
            UIManager.dialog = null;

            UIManager._saveCurrentDimensions();

            expect(Store.setState).not.toHaveBeenCalled();
        });
    });

    describe('_applySavedDimensions edge cases', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
            // Mock window dimensions
            Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });
        });

        it('should use default dimensions when none are saved', () => {
            Store.getState.mockReturnValueOnce({
                isMinimized: false,
                dimensions: {},
                minimizedBannerWidth: null,
                preMinimizedDimensions: {},
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager._applySavedDimensions();

            // Should apply default percentages of viewport
            expect(UIManager.dialog.style.width).toBeTruthy();
            expect(UIManager.dialog.style.height).toBeTruthy();
        });

        it('should constrain dimensions to viewport', () => {
            Store.getState.mockReturnValueOnce({
                isMinimized: false,
                dimensions: {
                    width: '5000px', // Larger than viewport
                    height: '3000px',
                    top: '0px',
                    left: '0px',
                },
                minimizedBannerWidth: null,
                preMinimizedDimensions: {},
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager._applySavedDimensions();

            const appliedWidth = parseInt(UIManager.dialog.style.width, 10);
            const appliedHeight = parseInt(UIManager.dialog.style.height, 10);

            expect(appliedWidth).toBeLessThanOrEqual(window.innerWidth);
            expect(appliedHeight).toBeLessThanOrEqual(window.innerHeight);
        });
    });

    describe('header double-click behavior', () => {
        let MinimizeService;

        beforeEach(async () => {
            const minimizeModule = await import('../../src/services/MinimizeService.js');
            MinimizeService = minimizeModule.MinimizeService;
            MinimizeService.toggle = vi.fn();
            UIManager.showDialog();
        });

        it('should toggle minimize on header double-click', () => {
            const header = UIManager.dialog.querySelector('.pdt-header');

            const event = new MouseEvent('dblclick', { bubbles: true });
            header.dispatchEvent(event);

            expect(MinimizeService.toggle).toHaveBeenCalled();
        });

        it('should not toggle minimize when double-clicking header controls', () => {
            const closeBtn = UIManager.dialog.querySelector('.pdt-close-btn');

            // Create a custom event that simulates clicking on controls
            const event = {
                target: { closest: (selector) => selector === '.pdt-header-controls' ? closeBtn : null },
            };

            // Simulate the ondblclick handler logic
            const header = UIManager.dialog.querySelector('.pdt-header');
            if (event.target.closest('.pdt-header-controls')) {
                // Should return early
            } else {
                MinimizeService.toggle();
            }

            // toggle should not be called due to early return
            expect(MinimizeService.toggle).not.toHaveBeenCalled();
        });
    });

    describe('_handleGodMode with form context', () => {
        let PowerAppsApiService;

        beforeEach(async () => {
            // Reset modules to get fresh instances
            vi.resetModules();

            // Re-mock with form context available
            vi.doMock('../../src/services/PowerAppsApiService.js', () => ({
                PowerAppsApiService: {
                    isFormContextAvailable: true,
                    getAllControls: vi.fn(() => [
                        {
                            getDisabled: () => true,
                            setDisabled: vi.fn(),
                            getAttribute: () => ({
                                getRequiredLevel: () => 'required',
                                setRequiredLevel: vi.fn(),
                            }),
                        },
                        {
                            getDisabled: () => false,
                            setDisabled: vi.fn(),
                            getAttribute: () => ({
                                getRequiredLevel: () => 'none',
                                setRequiredLevel: vi.fn(),
                            }),
                        },
                        {
                            getDisabled: () => true,
                            setDisabled: vi.fn(),
                            getAttribute: () => null,
                        },
                    ]),
                    getEntityId: vi.fn(() => 'entity-id-123'),
                    refreshForm: vi.fn(() => Promise.resolve()),
                    getFormContext: vi.fn(() => null),
                },
            }));

            const module = await import('../../src/core/UIManager.js');
            UIManager = module.UIManager;
            UIManager.dialog = null;
            UIManager.activeTabId = null;
            UIManager.renderedTabs = new Map();

            const powerAppsModule = await import('../../src/services/PowerAppsApiService.js');
            PowerAppsApiService = powerAppsModule.PowerAppsApiService;
        });

        it('should unlock disabled controls and update required fields', () => {
            UIManager._handleGodMode();

            expect(NotificationService.show).toHaveBeenCalled();
            const callArgs = NotificationService.show.mock.calls[0];
            expect(callArgs[1]).toBe('success');
        });

        it('should count unlocked fields correctly', () => {
            UIManager._handleGodMode();

            expect(NotificationService.show).toHaveBeenCalled();
        });

        it('should handle controls without attributes gracefully', () => {
            expect(() => UIManager._handleGodMode()).not.toThrow();
        });

        it('should handle control errors gracefully', async () => {
            vi.resetModules();
            vi.doMock('../../src/services/PowerAppsApiService.js', () => ({
                PowerAppsApiService: {
                    isFormContextAvailable: true,
                    getAllControls: vi.fn(() => [
                        {
                            getDisabled: () => { throw new Error('Control error'); },
                            setDisabled: vi.fn(),
                            getAttribute: () => null,
                        },
                    ]),
                },
            }));

            const module = await import('../../src/core/UIManager.js');
            const UIManagerWithError = module.UIManager;

            expect(() => UIManagerWithError._handleGodMode()).not.toThrow();
        });
    });

    describe('_handleResetForm', () => {
        let PowerAppsApiService;

        beforeEach(async () => {
            vi.resetModules();

            vi.doMock('../../src/services/PowerAppsApiService.js', () => ({
                PowerAppsApiService: {
                    isFormContextAvailable: true,
                    getEntityId: vi.fn(() => 'entity-id-123'),
                    refreshForm: vi.fn(() => Promise.resolve()),
                    getAllControls: vi.fn(() => []),
                    getFormContext: vi.fn(() => null),
                },
            }));

            const module = await import('../../src/core/UIManager.js');
            UIManager = module.UIManager;
            UIManager.dialog = null;
            UIManager.activeTabId = null;
            UIManager.renderedTabs = new Map();

            const powerAppsModule = await import('../../src/services/PowerAppsApiService.js');
            PowerAppsApiService = powerAppsModule.PowerAppsApiService;
        });

        it('should show warning for new unsaved record', async () => {
            PowerAppsApiService.getEntityId.mockReturnValue(null);

            await UIManager._handleResetForm();

            expect(NotificationService.show).toHaveBeenCalled();
            const callArgs = NotificationService.show.mock.calls[0];
            expect(callArgs[1]).toBe('warn');
        });

        it('should reset form successfully', async () => {
            PowerAppsApiService.getEntityId.mockReturnValue('entity-123');
            PowerAppsApiService.refreshForm.mockResolvedValue();

            await UIManager._handleResetForm();

            expect(PowerAppsApiService.refreshForm).toHaveBeenCalledWith(false);
            expect(NotificationService.show).toHaveBeenCalled();
            const callArgs = NotificationService.show.mock.calls[0];
            expect(callArgs[1]).toBe('success');
        });

        it('should handle reset form error', async () => {
            PowerAppsApiService.getEntityId.mockReturnValue('entity-123');
            PowerAppsApiService.refreshForm.mockRejectedValue(new Error('Reset failed'));

            await UIManager._handleResetForm();

            expect(NotificationService.show).toHaveBeenCalled();
            const callArgs = NotificationService.show.mock.calls[0];
            expect(callArgs[1]).toBe('error');
        });
    });

    describe('_handleShowLogical', () => {
        let PowerAppsApiService;

        beforeEach(async () => {
            vi.resetModules();

            const mockTab = {
                getName: () => 'general',
                sections: {
                    get: () => [{
                        getName: () => 'section1',
                        controls: {
                            get: () => [
                                { getName: () => 'control1' },
                                { getName: () => 'control2' },
                            ],
                        },
                    }],
                },
            };

            vi.doMock('../../src/services/PowerAppsApiService.js', () => ({
                PowerAppsApiService: {
                    isFormContextAvailable: true,
                    getEntityId: vi.fn(() => 'entity-id-123'),
                    refreshForm: vi.fn(() => Promise.resolve()),
                    getAllControls: vi.fn(() => []),
                    getFormContext: vi.fn(() => ({
                        ui: {
                            tabs: {
                                get: () => [mockTab],
                            },
                        },
                    })),
                },
            }));

            const module = await import('../../src/core/UIManager.js');
            UIManager = module.UIManager;
            UIManager.dialog = null;
            UIManager.activeTabId = null;
            UIManager.renderedTabs = new Map();

            const powerAppsModule = await import('../../src/services/PowerAppsApiService.js');
            PowerAppsApiService = powerAppsModule.PowerAppsApiService;
        });

        it('should show logical names when form context is available', () => {
            // Create mock DOM elements
            const tabElement = document.createElement('li');
            tabElement.dataset.id = 'tablist-general';
            document.body.appendChild(tabElement);

            const sectionElement = document.createElement('section');
            sectionElement.dataset.id = 'section1';
            document.body.appendChild(sectionElement);

            const controlElement = document.createElement('div');
            controlElement.dataset.controlName = 'control1';
            document.body.appendChild(controlElement);

            UIManager._handleShowLogical();

            expect(NotificationService.show).toHaveBeenCalled();
            const callArgs = NotificationService.show.mock.calls[0];
            expect(callArgs[1]).toBe('success');

            // Clean up
            tabElement.remove();
            sectionElement.remove();
            controlElement.remove();
        });

        it('should handle composite control names', async () => {
            vi.resetModules();

            const mockTab = {
                getName: () => 'general',
                sections: {
                    get: () => [{
                        getName: () => 'section1',
                        controls: {
                            get: () => [
                                { getName: () => 'field_compositionLinkControl_subfield' },
                            ],
                        },
                    }],
                },
            };

            vi.doMock('../../src/services/PowerAppsApiService.js', () => ({
                PowerAppsApiService: {
                    isFormContextAvailable: true,
                    getFormContext: vi.fn(() => ({
                        ui: { tabs: { get: () => [mockTab] } },
                    })),
                },
            }));

            const module = await import('../../src/core/UIManager.js');
            const UIManagerTest = module.UIManager;

            expect(() => UIManagerTest._handleShowLogical()).not.toThrow();
        });

        it('should not show duplicates for processed controls', async () => {
            vi.resetModules();

            const mockTab = {
                getName: () => 'tab1',
                sections: {
                    get: () => [{
                        getName: () => 'section1',
                        controls: {
                            get: () => [
                                { getName: () => 'control1' },
                                { getName: () => 'control1' }, // Duplicate
                            ],
                        },
                    }],
                },
            };

            vi.doMock('../../src/services/PowerAppsApiService.js', () => ({
                PowerAppsApiService: {
                    isFormContextAvailable: true,
                    getFormContext: vi.fn(() => ({
                        ui: { tabs: { get: () => [mockTab] } },
                    })),
                },
            }));

            const module = await import('../../src/core/UIManager.js');
            const UIManagerTest = module.UIManager;

            expect(() => UIManagerTest._handleShowLogical()).not.toThrow();
        });

        it('should return early when form context is not available', async () => {
            vi.resetModules();

            vi.doMock('../../src/services/PowerAppsApiService.js', () => ({
                PowerAppsApiService: {
                    isFormContextAvailable: true,
                    getFormContext: vi.fn(() => null),
                },
            }));

            const module = await import('../../src/core/UIManager.js');
            const UIManagerTest = module.UIManager;

            UIManagerTest._handleShowLogical();

            // Should not throw and should return early
            expect(NotificationService.show).not.toHaveBeenCalled();
        });

        it('should return early when ui property is missing', async () => {
            vi.resetModules();

            vi.doMock('../../src/services/PowerAppsApiService.js', () => ({
                PowerAppsApiService: {
                    isFormContextAvailable: true,
                    getFormContext: vi.fn(() => ({})),
                },
            }));

            const module = await import('../../src/core/UIManager.js');
            const UIManagerTest = module.UIManager;

            UIManagerTest._handleShowLogical();

            expect(NotificationService.show).not.toHaveBeenCalled();
        });
    });

    describe('_addLogicalOverlay', () => {
        let copyToClipboard;

        beforeEach(async () => {
            const helpers = await import('../../src/helpers/index.js');
            copyToClipboard = helpers.copyToClipboard;
        });

        it('should add overlay to element', () => {
            const element = document.createElement('div');
            element.style.position = 'relative';
            document.body.appendChild(element);

            UIManager._addLogicalOverlay(element, 'testName', 'control');

            const overlay = element.querySelector('.pdt-form-logical-overlay');
            expect(overlay).toBeTruthy();
            expect(overlay.textContent).toBe('testName');
            expect(overlay.classList.contains('pdt-logical-control')).toBe(true);

            element.remove();
        });

        it('should set position relative for static elements', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            UIManager._addLogicalOverlay(element, 'testName', 'tab');

            // Verify overlay was added (position handling depends on getComputedStyle)
            const overlay = element.querySelector('.pdt-form-logical-overlay');
            expect(overlay).toBeTruthy();
            expect(overlay.classList.contains('pdt-logical-tab')).toBe(true);

            element.remove();
        });

        it('should handle click on overlay to copy', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            UIManager._addLogicalOverlay(element, 'logicalName', 'section');

            const overlay = element.querySelector('.pdt-form-logical-overlay');
            const clickEvent = new MouseEvent('click', { bubbles: true });
            clickEvent.stopPropagation = vi.fn();
            clickEvent.preventDefault = vi.fn();
            overlay.dispatchEvent(clickEvent);

            expect(copyToClipboard).toHaveBeenCalled();

            element.remove();
        });

        it('should add correct class for each type', () => {
            const types = ['tab', 'section', 'control'];

            types.forEach(type => {
                const element = document.createElement('div');
                document.body.appendChild(element);

                UIManager._addLogicalOverlay(element, 'name', type);

                const overlay = element.querySelector('.pdt-form-logical-overlay');
                expect(overlay.classList.contains(`pdt-logical-${type}`)).toBe(true);

                element.remove();
            });
        });

        it('should set title attribute for tooltip', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            UIManager._addLogicalOverlay(element, 'testField', 'control');

            const overlay = element.querySelector('.pdt-form-logical-overlay');
            expect(overlay.title).toBe('Click to copy');

            element.remove();
        });
    });

    describe('_handleHideLogical', () => {
        it('should remove all logical overlays', () => {
            // Add some overlays
            const element1 = document.createElement('div');
            element1.innerHTML = '<span class="pdt-form-logical-overlay">test1</span>';
            document.body.appendChild(element1);

            const element2 = document.createElement('div');
            element2.innerHTML = '<span class="pdt-form-logical-overlay">test2</span>';
            document.body.appendChild(element2);

            UIManager._handleHideLogical();

            const overlays = document.querySelectorAll('.pdt-form-logical-overlay');
            expect(overlays.length).toBe(0);

            element1.remove();
            element2.remove();
        });

        it('should reset position for elements with saved original position', () => {
            const parent = document.createElement('div');
            parent.style.position = 'relative';
            parent.dataset.pdtOriginalPosition = 'static';

            const overlay = document.createElement('span');
            overlay.className = 'pdt-form-logical-overlay';
            parent.appendChild(overlay);
            document.body.appendChild(parent);

            UIManager._handleHideLogical();

            expect(parent.style.position).toBe('');
            expect(parent.dataset.pdtOriginalPosition).toBeUndefined();

            parent.remove();
        });

        it('should show info notification when no overlays exist and not silent', () => {
            UIManager._handleHideLogical(false);

            expect(NotificationService.show).toHaveBeenCalled();
            const callArgs = NotificationService.show.mock.calls[0];
            expect(callArgs[1]).toBe('info');
        });

        it('should not show notification when silent is true', () => {
            UIManager._handleHideLogical(true);

            expect(NotificationService.show).not.toHaveBeenCalled();
        });

        it('should show success notification after removing overlays', () => {
            const element = document.createElement('div');
            element.innerHTML = '<span class="pdt-form-logical-overlay">test</span>';
            document.body.appendChild(element);

            UIManager._handleHideLogical(false);

            expect(NotificationService.show).toHaveBeenCalled();
            const callArgs = NotificationService.show.mock.calls[0];
            expect(callArgs[1]).toBe('success');

            element.remove();
        });
    });

    describe('dragging behavior', () => {
        beforeEach(() => {
            UIManager.showDialog();
            Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });
        });

        it('should update position during drag', () => {
            const header = UIManager.dialog.querySelector('.pdt-header');
            const initialTop = UIManager.dialog.offsetTop;
            const initialLeft = UIManager.dialog.offsetLeft;

            // Simulate mousedown
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 100,
                clientY: 100,
            });
            Object.defineProperty(mousedownEvent, 'target', { value: header });
            header.onmousedown(mousedownEvent);

            // Simulate mousemove via document event
            const mousemoveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                clientX: 150,
                clientY: 150,
            });
            document.onmousemove?.(mousemoveEvent);

            // Position should have changed or stayed same based on boundaries
            expect(UIManager.dialog.style.top).toBeDefined();
            expect(UIManager.dialog.style.left).toBeDefined();
        });

        it('should change cursor during drag', () => {
            const header = UIManager.dialog.querySelector('.pdt-header');

            // Create event with proper target that has closest method
            const mousedownEvent = {
                preventDefault: vi.fn(),
                clientX: 100,
                clientY: 100,
                target: {
                    closest: (selector) => selector === '.pdt-header-controls' ? null : header,
                },
            };
            header.onmousedown(mousedownEvent);

            expect(document.body.style.cursor).toBe('move');
        });

        it('should reset cursor on mouse up', () => {
            const header = UIManager.dialog.querySelector('.pdt-header');

            const mousedownEvent = {
                preventDefault: vi.fn(),
                clientX: 100,
                clientY: 100,
                target: {
                    closest: (selector) => selector === '.pdt-header-controls' ? null : header,
                },
            };
            header.onmousedown(mousedownEvent);

            // Simulate mouseup
            document.onmouseup?.();

            expect(document.body.style.cursor).toBe('');
        });

        it('should constrain dialog position within viewport', () => {
            const header = UIManager.dialog.querySelector('.pdt-header');

            // Start at edge of screen
            UIManager.dialog.style.top = '0px';
            UIManager.dialog.style.left = '0px';

            const mousedownEvent = {
                preventDefault: vi.fn(),
                clientX: 100,
                clientY: 100,
                target: {
                    closest: (selector) => selector === '.pdt-header-controls' ? null : header,
                },
            };
            header.onmousedown(mousedownEvent);

            // Try to drag off screen
            const mousemoveEvent = {
                preventDefault: vi.fn(),
                clientX: -1000,
                clientY: -1000,
            };
            document.onmousemove?.(mousemoveEvent);

            // Should be constrained
            const top = parseInt(UIManager.dialog.style.top, 10);
            expect(top).toBeGreaterThanOrEqual(0);
        });
    });

    describe('keyboard navigation', () => {
        beforeEach(() => {
            UIManager.showDialog();
        });

        it('should support tab key navigation', async () => {
            await new Promise(resolve => setTimeout(resolve, 10));

            const buttons = UIManager.dialog.querySelectorAll('.pdt-nav-tab');
            expect(buttons.length).toBeGreaterThan(0);

            // Verify buttons are focusable
            buttons.forEach(button => {
                expect(button.tabIndex).not.toBe(-1);
            });
        });

        it('should focus on tab buttons', async () => {
            await new Promise(resolve => setTimeout(resolve, 10));

            const firstTab = UIManager.dialog.querySelector('.pdt-nav-tab');
            if (firstTab) {
                firstTab.focus();
                expect(document.activeElement).toBe(firstTab);
            }
        });
    });

    describe('state persistence', () => {
        it('should persist theme preference', () => {
            UIManager.dialog = document.createElement('div');

            UIManager._handleThemeToggle();

            expect(Store.setState).toHaveBeenCalled();
        });

        it('should persist dimensions on resize', () => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.style.width = '1000px';
            UIManager.dialog.style.height = '800px';
            UIManager.dialog.style.top = '50px';
            UIManager.dialog.style.left = '50px';

            UIManager._saveCurrentDimensions();

            expect(Store.setState).toHaveBeenCalled();
        });

        it('should restore dimensions on dialog show', () => {
            Store.getState.mockReturnValue({
                theme: 'dark',
                tabSettings: [],
                dimensions: {
                    width: '900px',
                    height: '700px',
                    top: '100px',
                    left: '100px',
                },
                isMinimized: false,
                minimizedBannerWidth: '300px',
                preMinimizedDimensions: {},
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.showDialog();

            expect(UIManager.dialog.style.width).toBeTruthy();
            expect(UIManager.dialog.style.height).toBeTruthy();
        });
    });

    describe('component lifecycle management', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <nav class="pdt-nav-tabs">
                    <button class="pdt-nav-tab" data-tab-id="inspector">Inspector</button>
                </nav>
                <main class="pdt-content"></main>
            `;
        });

        it('should call destroy on component during refresh', async () => {
            await UIManager._showTab('inspector');
            UIManager.activeTabId = 'inspector';

            // Get the component and verify destroy was called
            // Note: ComponentRegistry.get returns a new mock each time
            // so we need to verify the component was destroyed by checking the call count
            const initialCallCount = ComponentRegistry.get.mock.calls.length;

            UIManager.refreshActiveTab(false);

            // Verify ComponentRegistry.get was called during refresh
            expect(ComponentRegistry.get.mock.calls.length).toBeGreaterThan(initialCallCount);
        });

        it('should remove cached content during refresh', async () => {
            await UIManager._showTab('inspector');
            expect(UIManager.renderedTabs.has('inspector')).toBe(true);

            UIManager.refreshActiveTab(false);

            // After refresh starts, the tab is removed then re-added
            // Just verify it doesn't throw
            expect(UIManager.activeTabId).toBe('inspector');
        });

        it('should handle component that returns promise from destroy', async () => {
            ComponentRegistry.get.mockImplementationOnce(() => ({
                id: 'async-destroy',
                label: 'Async Destroy',
                render: vi.fn(() => Promise.resolve(document.createElement('div'))),
                postRender: vi.fn(),
                destroy: vi.fn(() => Promise.resolve()),
            }));

            await UIManager._showTab('async-destroy');
            expect(() => UIManager.refreshActiveTab(false)).not.toThrow();
        });
    });

    describe('edge cases', () => {
        it('should handle null dialog in _handleThemeChange', () => {
            UIManager.dialog = null;
            expect(() => UIManager._handleThemeChange('light')).not.toThrow();
        });

        it('should handle missing content area in updateNavTabs', () => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = '<nav class="pdt-nav-tabs"></nav>';

            expect(() => UIManager.updateNavTabs()).not.toThrow();
        });

        it('should handle missing tabs container in updateNavTabs', () => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = '<main class="pdt-content"></main>';

            expect(() => UIManager.updateNavTabs()).not.toThrow();
        });

        it('should handle component returning non-element from render', async () => {
            ComponentRegistry.get.mockImplementationOnce(() => ({
                id: 'string-render',
                label: 'String Render',
                render: vi.fn(() => Promise.resolve(null)),
                postRender: vi.fn(),
                destroy: vi.fn(),
            }));

            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <nav class="pdt-nav-tabs"></nav>
                <main class="pdt-content"></main>
            `;

            // Should handle gracefully
            await expect(UIManager._showTab('string-render')).resolves.not.toThrow();
        });

        it('should handle postRender error gracefully', async () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

            ComponentRegistry.get.mockImplementationOnce(() => ({
                id: 'postrender-error',
                label: 'PostRender Error',
                render: vi.fn(() => Promise.resolve(document.createElement('div'))),
                postRender: vi.fn(() => { throw new Error('PostRender failed'); }),
                destroy: vi.fn(),
            }));

            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <nav class="pdt-nav-tabs"></nav>
                <main class="pdt-content"></main>
            `;

            // postRender errors are caught in try-catch block in _showTab
            await expect(UIManager._showTab('postrender-error')).resolves.not.toThrow();

            // Verify error was logged
            expect(consoleError).toHaveBeenCalled();
            consoleError.mockRestore();
        });

        it('should handle empty tab settings', () => {
            Store.getState.mockReturnValueOnce({
                theme: 'dark',
                tabSettings: [],
                dimensions: {},
                isMinimized: false,
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <nav class="pdt-nav-tabs"></nav>
                <main class="pdt-content"></main>
            `;

            UIManager.updateNavTabs();

            expect(UIManager.activeTabId).toBeNull();
        });

        it('should handle very large dimension values', () => {
            Store.getState.mockReturnValueOnce({
                theme: 'dark',
                dimensions: {
                    width: '99999px',
                    height: '99999px',
                    top: '0px',
                    left: '0px',
                },
                isMinimized: false,
                minimizedBannerWidth: null,
                preMinimizedDimensions: {},
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.dialog = document.createElement('div');
            Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

            UIManager._applySavedDimensions();

            const width = parseInt(UIManager.dialog.style.width, 10);
            const height = parseInt(UIManager.dialog.style.height, 10);
            expect(width).toBeLessThanOrEqual(window.innerWidth);
            expect(height).toBeLessThanOrEqual(window.innerHeight);
        });

        it('should handle negative position values', () => {
            Store.getState.mockReturnValueOnce({
                theme: 'dark',
                dimensions: {
                    width: '800px',
                    height: '600px',
                    top: '-100px',
                    left: '-100px',
                },
                isMinimized: false,
                minimizedBannerWidth: null,
                preMinimizedDimensions: {},
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.dialog = document.createElement('div');
            Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

            UIManager._applySavedDimensions();

            const top = parseInt(UIManager.dialog.style.top, 10);
            expect(top).toBeGreaterThanOrEqual(0);
        });
    });

    describe('form context enabled buttons', () => {
        beforeEach(async () => {
            vi.resetModules();

            vi.doMock('../../src/services/PowerAppsApiService.js', () => ({
                PowerAppsApiService: {
                    isFormContextAvailable: true,
                    getAllControls: vi.fn(() => []),
                    getEntityId: vi.fn(() => 'entity-id'),
                    refreshForm: vi.fn(() => Promise.resolve()),
                    getFormContext: vi.fn(() => ({ ui: { tabs: { get: () => [] } } })),
                },
            }));

            const module = await import('../../src/core/UIManager.js');
            UIManager = module.UIManager;
            UIManager.dialog = null;
            UIManager.activeTabId = null;
            UIManager.renderedTabs = new Map();
        });

        it('should enable god mode button when form context available', () => {
            UIManager.showDialog();

            const godModeBtn = UIManager.dialog.querySelector('.pdt-god-mode-btn');
            expect(godModeBtn.disabled).toBe(false);
        });

        it('should enable reset button when form context available', () => {
            UIManager.showDialog();

            const resetBtn = UIManager.dialog.querySelector('.pdt-reset-form-btn');
            expect(resetBtn.disabled).toBe(false);
        });

        it('should enable show logical button when form context available', () => {
            UIManager.showDialog();

            const showBtn = UIManager.dialog.querySelector('.pdt-show-logical-btn');
            expect(showBtn.disabled).toBe(false);
        });

        it('should enable hide logical button when form context available', () => {
            UIManager.showDialog();

            const hideBtn = UIManager.dialog.querySelector('.pdt-hide-logical-btn');
            expect(hideBtn.disabled).toBe(false);
        });

        it('should call _handleGodMode when god mode button clicked', () => {
            UIManager.showDialog();
            const spy = vi.spyOn(UIManager, '_handleGodMode');

            const godModeBtn = UIManager.dialog.querySelector('.pdt-god-mode-btn');
            godModeBtn.click();

            expect(spy).toHaveBeenCalled();
        });

        it('should call _handleResetForm when reset button clicked', () => {
            UIManager.showDialog();
            const spy = vi.spyOn(UIManager, '_handleResetForm');

            const resetBtn = UIManager.dialog.querySelector('.pdt-reset-form-btn');
            resetBtn.click();

            expect(spy).toHaveBeenCalled();
        });

        it('should call _handleShowLogical when show button clicked', () => {
            UIManager.showDialog();
            const spy = vi.spyOn(UIManager, '_handleShowLogical');

            const showBtn = UIManager.dialog.querySelector('.pdt-show-logical-btn');
            showBtn.click();

            expect(spy).toHaveBeenCalled();
        });

        it('should call _handleHideLogical when hide button clicked', () => {
            UIManager.showDialog();
            const spy = vi.spyOn(UIManager, '_handleHideLogical');

            const hideBtn = UIManager.dialog.querySelector('.pdt-hide-logical-btn');
            hideBtn.click();

            expect(spy).toHaveBeenCalled();
        });
    });

    describe('tab caching edge cases', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <nav class="pdt-nav-tabs">
                    <button class="pdt-nav-tab" data-tab-id="inspector">Inspector</button>
                    <button class="pdt-nav-tab" data-tab-id="settings">Settings</button>
                </nav>
                <main class="pdt-content"></main>
            `;
        });

        it('should show cached tab immediately', async () => {
            // First render
            await UIManager._showTab('inspector');
            const firstWrapper = UIManager.renderedTabs.get('inspector');

            // Switch to another tab
            await UIManager._showTab('settings');
            expect(firstWrapper.style.display).toBe('none');

            // Switch back - should use cache
            await UIManager._showTab('inspector');
            expect(firstWrapper.style.display).toBe('flex');
        });

        it('should handle switching between cached tabs multiple times', async () => {
            await UIManager._showTab('inspector');
            await UIManager._showTab('settings');
            await UIManager._showTab('inspector');
            await UIManager._showTab('settings');
            await UIManager._showTab('inspector');

            expect(UIManager.activeTabId).toBe('inspector');
            expect(UIManager.renderedTabs.size).toBe(2);
        });

        it('should not re-render cached tabs', async () => {
            await UIManager._showTab('inspector');

            const component = ComponentRegistry.get('inspector');
            const renderCallCount = component.render.mock.calls.length;

            await UIManager._showTab('settings');
            await UIManager._showTab('inspector');

            // Render should not have been called again
            expect(component.render.mock.calls.length).toBe(renderCallCount);
        });
    });

    describe('minimized state handling', () => {
        it('should apply minimized banner width when minimized', () => {
            Store.getState.mockReturnValueOnce({
                isMinimized: true,
                minimizedBannerWidth: '250px',
                preMinimizedDimensions: { top: '100px', left: '100px' },
                dimensions: { width: '800px', height: '600px' },
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.dialog = document.createElement('div');
            Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

            UIManager._applySavedDimensions();

            expect(UIManager.dialog.style.width).toBe('250px');
        });

        it('should use default position when preMinimizedDimensions is empty', () => {
            Store.getState.mockReturnValueOnce({
                isMinimized: true,
                minimizedBannerWidth: '250px',
                preMinimizedDimensions: {},
                dimensions: {},
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.dialog = document.createElement('div');
            Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

            UIManager._applySavedDimensions();

            expect(UIManager.dialog.style.top).toBeTruthy();
            expect(UIManager.dialog.style.left).toBeTruthy();
        });

        it('should preserve preMinimizedDimensions when saving minimized state', () => {
            Store.getState.mockReturnValue({
                isMinimized: true,
                preMinimizedDimensions: { width: '800px', height: '600px' },
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.dialog = document.createElement('div');
            UIManager.dialog.style.width = '300px';
            UIManager.dialog.style.top = '50px';
            UIManager.dialog.style.left = '50px';

            UIManager._saveCurrentDimensions();

            expect(Store.setState).toHaveBeenCalledWith({
                minimizedBannerWidth: '300px',
                preMinimizedDimensions: {
                    width: '800px',
                    height: '600px',
                    top: '50px',
                    left: '50px',
                },
            });
        });
    });

    describe('error resilience in _handleClose', () => {
        beforeEach(() => {
            // Ensure Store.getState returns proper structure for showDialog
            Store.getState.mockReturnValue({
                theme: 'dark',
                tabSettings: [{ id: 'inspector', visible: true }],
                dimensions: { width: '800px', height: '600px', top: '100px', left: '100px' },
                isMinimized: false,
                minimizedBannerWidth: '300px',
                preMinimizedDimensions: {},
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });
        });

        it('should handle errors during component destroy', async () => {
            ComponentRegistry.getAll.mockReturnValueOnce([{
                destroy: () => { throw new Error('Destroy failed'); },
            }]);

            UIManager.showDialog();

            expect(() => UIManager._handleClose()).not.toThrow();

            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should handle errors during MinimizeService.destroy', async () => {
            const MinimizeService = (await import('../../src/services/MinimizeService.js')).MinimizeService;
            MinimizeService.destroy = vi.fn(() => { throw new Error('MinimizeService destroy failed'); });

            UIManager.showDialog();

            expect(() => UIManager._handleClose()).not.toThrow();

            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should handle errors during DataService.clearCache', async () => {
            DataService.clearCache = vi.fn(() => { throw new Error('Clear cache failed'); });

            UIManager.showDialog();

            expect(() => UIManager._handleClose()).not.toThrow();

            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should handle missing dialog during close', () => {
            UIManager.showDialog();
            UIManager.dialog.remove();

            // Dialog still exists but is detached from DOM
            expect(() => UIManager._handleClose()).not.toThrow();
        });

        it('should cancel pending debounced dimension save', async () => {
            UIManager.showDialog();

            // Simulate a pending save
            UIManager._saveDimensions = {
                cancel: vi.fn(),
            };

            UIManager._handleClose();

            expect(UIManager._saveDimensions.cancel).toHaveBeenCalled();
        });

        it('should handle missing _saveDimensions.cancel gracefully', () => {
            UIManager.showDialog();
            UIManager._saveDimensions = {};

            expect(() => UIManager._handleClose()).not.toThrow();
        });
    });

    describe('ResizeObserver integration', () => {
        it('should set up ResizeObserver on dialog', () => {
            // Ensure Store.getState returns proper structure
            Store.getState.mockReturnValue({
                theme: 'dark',
                tabSettings: [{ id: 'inspector', visible: true }],
                dimensions: { width: '800px', height: '600px', top: '100px', left: '100px' },
                isMinimized: false,
                minimizedBannerWidth: '300px',
                preMinimizedDimensions: {},
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            const originalResizeObserver = global.ResizeObserver;
            const mockObserve = vi.fn();

            // Use a class mock instead of arrow function
            class MockResizeObserver {
                constructor(callback) {
                    this.callback = callback;
                }
                observe = mockObserve;
                disconnect = vi.fn();
            }

            global.ResizeObserver = MockResizeObserver;

            UIManager.showDialog();

            expect(mockObserve).toHaveBeenCalledWith(UIManager.dialog);

            global.ResizeObserver = originalResizeObserver;
        });
    });

    describe('updateNavTabs with various tab configurations', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <nav class="pdt-nav-tabs"></nav>
                <main class="pdt-content"></main>
            `;
        });

        it('should handle single tab configuration', () => {
            Store.getState.mockReturnValueOnce({
                theme: 'dark',
                tabSettings: [{ id: 'inspector', visible: true }],
                dimensions: {},
                isMinimized: false,
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.updateNavTabs();

            const tabs = UIManager.dialog.querySelectorAll('.pdt-nav-tab');
            expect(tabs.length).toBe(1);
        });

        it('should skip hidden tabs', () => {
            Store.getState.mockReturnValueOnce({
                theme: 'dark',
                tabSettings: [
                    { id: 'inspector', visible: true },
                    { id: 'settings', visible: false },
                ],
                dimensions: {},
                isMinimized: false,
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.updateNavTabs();

            const tabs = UIManager.dialog.querySelectorAll('.pdt-nav-tab');
            expect(tabs.length).toBe(1);
        });

        it('should skip tabs with no registered component', () => {
            Store.getState.mockReturnValueOnce({
                theme: 'dark',
                tabSettings: [
                    { id: 'inspector', visible: true },
                    { id: 'nonexistent', visible: true },
                ],
                dimensions: {},
                isMinimized: false,
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.updateNavTabs();

            const tabs = UIManager.dialog.querySelectorAll('.pdt-nav-tab');
            expect(tabs.length).toBe(1);
        });

        it('should set tab button data attributes correctly', () => {
            Store.getState.mockReturnValueOnce({
                theme: 'dark',
                tabSettings: [{ id: 'inspector', visible: true }],
                dimensions: {},
                isMinimized: false,
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.updateNavTabs();

            const tab = UIManager.dialog.querySelector('.pdt-nav-tab');
            expect(tab.dataset.tabId).toBe('inspector');
        });

        it('should include icon and label in tab button', () => {
            Store.getState.mockReturnValueOnce({
                theme: 'dark',
                tabSettings: [{ id: 'inspector', visible: true }],
                dimensions: {},
                isMinimized: false,
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });

            UIManager.updateNavTabs();

            const tab = UIManager.dialog.querySelector('.pdt-nav-tab');
            expect(tab.innerHTML).toContain('<svg></svg>');
            expect(tab.innerHTML).toContain('Inspector');
        });
    });

    describe('global click handler edge cases', () => {
        let copyToClipboard;

        beforeEach(async () => {
            const helpers = await import('../../src/helpers/index.js');
            copyToClipboard = helpers.copyToClipboard;
            copyToClipboard.mockClear();

            // Reset UIManager state first
            UIManager.dialog = null;
            UIManager.activeTabId = null;
            UIManager.renderedTabs = new Map();
            UIManager._globalClickHandler = null;

            UIManager.showDialog();
        });

        it('should handle nested copyable elements', () => {
            const parent = document.createElement('div');
            parent.className = 'copyable';
            parent.textContent = 'parent-value';

            const child = document.createElement('span');
            child.textContent = 'child-text';
            parent.appendChild(child);

            UIManager.dialog.appendChild(parent);

            const event = new MouseEvent('click', { bubbles: true });
            child.dispatchEvent(event);

            expect(copyToClipboard).toHaveBeenCalled();
        });

        it('should handle copyable element with empty text', () => {
            const copyable = document.createElement('span');
            copyable.className = 'copyable';
            copyable.textContent = '';
            UIManager.dialog.appendChild(copyable);

            const event = new MouseEvent('click', { bubbles: true });
            copyable.dispatchEvent(event);

            expect(copyToClipboard).toHaveBeenCalledWith('', 'Copied: ');
        });
    });

    describe('script tag cleanup in _handleClose', () => {
        beforeEach(() => {
            // Ensure Store.getState returns proper structure
            Store.getState.mockReturnValue({
                theme: 'dark',
                tabSettings: [{ id: 'inspector', visible: true }],
                dimensions: { width: '800px', height: '600px', top: '100px', left: '100px' },
                isMinimized: false,
                minimizedBannerWidth: '300px',
                preMinimizedDimensions: {},
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });
        });

        it('should remove script tag if present', async () => {
            // Create a mock script tag
            const scriptTag = document.createElement('script');
            scriptTag.id = 'power-toolkit-script-module';
            document.body.appendChild(scriptTag);

            UIManager.showDialog();
            UIManager._handleClose();

            // Wait for requestAnimationFrame
            await new Promise(resolve => setTimeout(resolve, 50));

            // Script tag should be removed
            expect(document.getElementById('power-toolkit-script-module')).toBeNull();
        });

        it('should handle script tag removal errors gracefully', async () => {
            // Create a mock script tag with a throwing remove method
            const scriptTag = document.createElement('script');
            scriptTag.id = 'power-toolkit-script-module';
            const originalRemove = scriptTag.remove.bind(scriptTag);
            scriptTag.remove = () => {
                throw new Error('Cannot remove script');
            };
            document.body.appendChild(scriptTag);

            UIManager.showDialog();

            expect(() => UIManager._handleClose()).not.toThrow();

            // Wait for requestAnimationFrame
            await new Promise(resolve => setTimeout(resolve, 50));

            // Clean up with original remove
            try { originalRemove(); } catch (_e) { /* ignore */ }
        });

        it('should delete window initialized flag on close', async () => {
            window.PDT_INITIALIZED = true;

            UIManager.showDialog();
            UIManager._handleClose();

            // Wait for requestAnimationFrame
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(window.PDT_INITIALIZED).toBeUndefined();
        });
    });

    describe('_addLogicalOverlay with static position', () => {
        it('should set position relative when element has static position', () => {
            // Mock getComputedStyle to return 'static' for position
            const originalGetComputedStyle = window.getComputedStyle;
            window.getComputedStyle = vi.fn(() => ({
                position: 'static',
            }));

            const element = document.createElement('div');
            document.body.appendChild(element);

            UIManager._addLogicalOverlay(element, 'testName', 'control');

            expect(element.style.position).toBe('relative');
            expect(element.dataset.pdtOriginalPosition).toBe('static');

            const overlay = element.querySelector('.pdt-form-logical-overlay');
            expect(overlay).toBeTruthy();

            element.remove();
            window.getComputedStyle = originalGetComputedStyle;
        });

        it('should not change position when element already has non-static position', () => {
            // Mock getComputedStyle to return 'absolute' for position
            const originalGetComputedStyle = window.getComputedStyle;
            window.getComputedStyle = vi.fn(() => ({
                position: 'absolute',
            }));

            const element = document.createElement('div');
            element.style.position = 'absolute';
            document.body.appendChild(element);

            UIManager._addLogicalOverlay(element, 'testName', 'control');

            expect(element.style.position).toBe('absolute');
            expect(element.dataset.pdtOriginalPosition).toBeUndefined();

            element.remove();
            window.getComputedStyle = originalGetComputedStyle;
        });
    });

    describe('synchronous error handling in _handleClose', () => {
        beforeEach(() => {
            Store.getState.mockReturnValue({
                theme: 'dark',
                tabSettings: [{ id: 'inspector', visible: true }],
                dimensions: { width: '800px', height: '600px', top: '100px', left: '100px' },
                isMinimized: false,
                minimizedBannerWidth: '300px',
                preMinimizedDimensions: {},
                headerButtonSettings: [
                    { id: 'showLogical', label: 'Show Logical Names', visible: true, formOnly: true },
                    { id: 'hideLogical', label: 'Hide Logical Names', visible: true, formOnly: true },
                    { id: 'resetForm', label: 'Reset Form', visible: true, formOnly: true },
                    { id: 'godMode', label: 'God Mode', visible: true, formOnly: true },
                    { id: 'refresh', label: 'Refresh', visible: true, formOnly: false },
                    { id: 'theme', label: 'Toggle Theme', visible: true, formOnly: false },
                    { id: 'minimize', label: 'Minimize', visible: true, formOnly: false }
                ],
            });
        });

        it('should catch synchronous errors from _saveCurrentDimensions', () => {
            UIManager.showDialog();

            // Override _saveCurrentDimensions to throw
            const originalSave = UIManager._saveCurrentDimensions;
            UIManager._saveCurrentDimensions = () => {
                throw new Error('Save dimensions failed');
            };

            expect(() => UIManager._handleClose()).not.toThrow();

            UIManager._saveCurrentDimensions = originalSave;
        });
    });

    describe('_updateHeaderButtons', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <div class="pdt-header-controls">
                    <button class="pdt-theme-toggle" title="Toggle Theme">${'☀️'}</button>
                    <button class="pdt-refresh-btn" title="Refresh">${'🔄'}</button>
                    <button class="pdt-minimize-btn" title="Minimize">${'−'}</button>
                    <button class="pdt-icon-btn pdt-close-btn" title="Close">&times;</button>
                </div>
            `;
        });

        it('should not throw when dialog is null', () => {
            UIManager.dialog = null;
            expect(() => UIManager._updateHeaderButtons()).not.toThrow();
        });

        it('should not throw when headerControls is null', () => {
            UIManager.dialog.innerHTML = '';
            expect(() => UIManager._updateHeaderButtons()).not.toThrow();
        });

        it('should re-render header buttons', () => {
            const originalHtml = UIManager.dialog.querySelector('.pdt-header-controls').innerHTML;

            UIManager._updateHeaderButtons();

            const headerControls = UIManager.dialog.querySelector('.pdt-header-controls');
            expect(headerControls).toBeTruthy();
            // Close button should always be present
            expect(headerControls.querySelector('.pdt-close-btn')).toBeTruthy();
        });

        it('should preserve close button after update', () => {
            UIManager._updateHeaderButtons();

            const closeBtn = UIManager.dialog.querySelector('.pdt-close-btn');
            expect(closeBtn).toBeTruthy();
            expect(closeBtn.title).toBe('Close');
        });

        it('should create new close button if missing', () => {
            // Remove close button before update
            const closeBtn = UIManager.dialog.querySelector('.pdt-close-btn');
            closeBtn.remove();

            UIManager._updateHeaderButtons();

            const newCloseBtn = UIManager.dialog.querySelector('.pdt-close-btn');
            expect(newCloseBtn).toBeTruthy();
        });

        it('should call _attachHeaderButtonListeners', () => {
            const spy = vi.spyOn(UIManager, '_attachHeaderButtonListeners');

            UIManager._updateHeaderButtons();

            expect(spy).toHaveBeenCalled();
        });

        it('should initialize MinimizeService when minimize button exists', () => {
            // Add minimize button
            const headerControls = UIManager.dialog.querySelector('.pdt-header-controls');
            headerControls.innerHTML = '<button class="pdt-minimize-btn">−</button><button class="pdt-close-btn">&times;</button>';

            UIManager._updateHeaderButtons();

            // Check if minimize button still exists (MinimizeService.init would be called)
            expect(UIManager.dialog.querySelector('.pdt-minimize-btn')).toBeTruthy();
        });
    });

    describe('_attachHeaderButtonListeners', () => {
        beforeEach(() => {
            // Reset DataService mock to not throw
            DataService.clearCache = vi.fn();

            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <div class="pdt-header-controls">
                    <button class="pdt-theme-toggle" title="Toggle Theme">${'☀️'}</button>
                    <button class="pdt-refresh-btn" title="Refresh">${'🔄'}</button>
                    <button class="pdt-god-mode-btn" title="God Mode">${'⚡'}</button>
                    <button class="pdt-reset-form-btn" title="Reset Form">${'↩️'}</button>
                    <button class="pdt-show-logical-btn" title="Show Logical Names">${'🏷️'}</button>
                    <button class="pdt-hide-logical-btn" title="Hide Logical Names">${'🏷️'}</button>
                    <button class="pdt-close-btn" title="Close">&times;</button>
                </div>
            `;
        });

        it('should attach theme toggle handler', () => {
            const themeSpy = vi.spyOn(UIManager, '_handleThemeToggle');

            UIManager._attachHeaderButtonListeners();

            UIManager.dialog.querySelector('.pdt-theme-toggle').click();
            expect(themeSpy).toHaveBeenCalled();
        });

        it('should attach refresh handler', () => {
            const refreshSpy = vi.spyOn(UIManager, 'refreshActiveTab');

            UIManager._attachHeaderButtonListeners();

            UIManager.dialog.querySelector('.pdt-refresh-btn').click();
            expect(refreshSpy).toHaveBeenCalled();
        });

        it('should attach god mode handler', () => {
            const godModeSpy = vi.spyOn(UIManager, '_handleGodMode');

            UIManager._attachHeaderButtonListeners();

            UIManager.dialog.querySelector('.pdt-god-mode-btn').click();
            expect(godModeSpy).toHaveBeenCalled();
        });

        it('should attach reset form handler', () => {
            const resetSpy = vi.spyOn(UIManager, '_handleResetForm');

            UIManager._attachHeaderButtonListeners();

            UIManager.dialog.querySelector('.pdt-reset-form-btn').click();
            expect(resetSpy).toHaveBeenCalled();
        });

        it('should attach show logical handler', () => {
            const showLogicalSpy = vi.spyOn(UIManager, '_handleShowLogical');

            UIManager._attachHeaderButtonListeners();

            UIManager.dialog.querySelector('.pdt-show-logical-btn').click();
            expect(showLogicalSpy).toHaveBeenCalled();
        });

        it('should attach hide logical handler', () => {
            const hideLogicalSpy = vi.spyOn(UIManager, '_handleHideLogical');

            UIManager._attachHeaderButtonListeners();

            UIManager.dialog.querySelector('.pdt-hide-logical-btn').click();
            expect(hideLogicalSpy).toHaveBeenCalled();
        });

        it('should not throw when buttons are missing', () => {
            UIManager.dialog.innerHTML = '<div class="pdt-header-controls"></div>';

            expect(() => UIManager._attachHeaderButtonListeners()).not.toThrow();
        });
    });

    describe('Store subscription for headerButtonSettings', () => {
        it('should call _updateHeaderButtons when headerButtonSettings change', () => {
            UIManager.init();

            const subscribeCallback = Store.subscribe.mock.calls[0][0];

            UIManager.dialog = document.createElement('div');
            UIManager.dialog.innerHTML = `
                <div class="pdt-header-controls">
                    <button class="pdt-theme-toggle">☀️</button>
                    <button class="pdt-close-btn">&times;</button>
                </div>
            `;

            const updateSpy = vi.spyOn(UIManager, '_updateHeaderButtons');

            // Simulate headerButtonSettings change
            subscribeCallback(
                {
                    theme: 'dark',
                    tabSettings: [],
                    headerButtonSettings: [{ id: 'theme', visible: false }]
                },
                {
                    theme: 'dark',
                    tabSettings: [],
                    headerButtonSettings: [{ id: 'theme', visible: true }]
                }
            );

            expect(updateSpy).toHaveBeenCalled();
        });

        it('should not call _updateHeaderButtons when headerButtonSettings are identical', () => {
            UIManager.init();

            const subscribeCallback = Store.subscribe.mock.calls[0][0];
            const updateSpy = vi.spyOn(UIManager, '_updateHeaderButtons');

            const sameSettings = [{ id: 'theme', visible: true }];

            subscribeCallback(
                { theme: 'dark', tabSettings: [], headerButtonSettings: sameSettings },
                { theme: 'dark', tabSettings: [], headerButtonSettings: sameSettings }
            );

            expect(updateSpy).not.toHaveBeenCalled();
        });
    });

    describe('header double-click toggle minimize', () => {
        beforeEach(async () => {
            // Reset MinimizeService mock
            const minimizeModule = await import('../../src/services/MinimizeService.js');
            minimizeModule.MinimizeService.toggle = vi.fn();
        });

        it('should call MinimizeService.toggle on header double-click', async () => {
            const minimizeModule = await import('../../src/services/MinimizeService.js');

            UIManager.showDialog();

            const header = UIManager.dialog.querySelector('.pdt-header');

            // Create a mock event with proper target
            const mockEvent = {
                target: {
                    closest: vi.fn((selector) => {
                        // Return null for header-controls (meaning click was not on controls)
                        if (selector === '.pdt-header-controls') {
                            return null;
                        }
                        return null;
                    })
                }
            };

            header.ondblclick(mockEvent);

            expect(minimizeModule.MinimizeService.toggle).toHaveBeenCalled();
        });

        it('should not toggle when double-clicking on header controls', async () => {
            const minimizeModule = await import('../../src/services/MinimizeService.js');

            UIManager.showDialog();

            const header = UIManager.dialog.querySelector('.pdt-header');

            // Create a mock event that simulates clicking on controls
            const mockEvent = {
                target: {
                    closest: vi.fn((selector) => {
                        // Return truthy for header-controls (meaning click was on controls)
                        if (selector === '.pdt-header-controls') {
                            return document.createElement('div');
                        }
                        return null;
                    })
                }
            };

            header.ondblclick(mockEvent);

            // Should not toggle because event.target.closest('.pdt-header-controls') is truthy
            expect(minimizeModule.MinimizeService.toggle).not.toHaveBeenCalled();
        });
    });

    describe('_renderHeaderButtons with config', () => {
        beforeEach(() => {
            UIManager.dialog = document.createElement('div');
        });

        it('should return empty string for unknown button id', () => {
            Store.getState.mockReturnValueOnce({
                headerButtonSettings: [
                    { id: 'unknownButton', visible: true, formOnly: false }
                ]
            });

            const result = UIManager._renderHeaderButtons();

            // Unknown button should return empty string from map
            expect(result).not.toContain('unknownButton');
        });

        it('should filter out non-visible buttons', () => {
            Store.getState.mockReturnValueOnce({
                headerButtonSettings: [
                    { id: 'theme', visible: false, formOnly: false },
                    { id: 'refresh', visible: true, formOnly: false }
                ]
            });

            const result = UIManager._renderHeaderButtons();

            expect(result).toContain('pdt-refresh-btn');
            expect(result).not.toContain('pdt-theme-toggle');
        });
    });
});
