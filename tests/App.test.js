/**
 * @file Tests for App module
 * @module tests/App
 * @description Comprehensive tests for the main application controller
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock all dependencies BEFORE importing App
vi.mock('../src/core/Store.js', () => ({
    Store: {
        init: vi.fn(),
        getState: vi.fn(() => ({
            theme: 'light',
            tabSettings: [],
            dimensions: { width: 800, height: 600 },
            impersonationUserId: null,
            isMinimized: false
        })),
        setState: vi.fn(),
        subscribe: vi.fn()
    }
}));

vi.mock('../src/core/UIManager.js', () => ({
    UIManager: {
        init: vi.fn(),
        showDialog: vi.fn(),
        updateNavTabs: vi.fn(),
        refreshActiveTab: vi.fn(),
        dialog: null,
        activeTabId: null
    }
}));

vi.mock('../src/core/ComponentRegistry.js', () => ({
    ComponentRegistry: {
        register: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn(() => []),
        has: vi.fn(() => false)
    }
}));

vi.mock('../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: true,
        addOnLoad: vi.fn(),
        removeOnLoad: vi.fn(),
        getFormContext: vi.fn(),
        getEntityName: vi.fn(() => 'account'),
        getFormId: vi.fn(() => '12345-67890')
    }
}));

// Mock all component imports using class syntax (required for `new` keyword)
vi.mock('../src/components/InspectorTab.js', () => ({
    InspectorTab: class { constructor() { this.id = 'inspector'; this.label = 'Inspector'; } }
}));

vi.mock('../src/components/FormColumnsTab.js', () => ({
    FormColumnsTab: class { constructor() { this.id = 'formColumns'; this.label = 'Form Columns'; } }
}));

vi.mock('../src/components/AutomationTab.js', () => ({
    AutomationTab: class { constructor() { this.id = 'automation'; this.label = 'Automation'; } }
}));

vi.mock('../src/components/EventMonitorTab.js', () => ({
    EventMonitorTab: class { constructor() { this.id = 'eventMonitor'; this.label = 'Event Monitor'; } }
}));

vi.mock('../src/components/PluginContextTab.js', () => ({
    PluginContextTab: class { constructor() { this.id = 'pluginContext'; this.label = 'Plugin Context'; } }
}));

vi.mock('../src/components/WebApiExplorerTab.js', () => ({
    WebApiExplorerTab: class { constructor() { this.id = 'webApi'; this.label = 'Web API'; } }
}));

vi.mock('../src/components/FetchXmlTesterTab.js', () => ({
    FetchXmlTesterTab: class { constructor() { this.id = 'fetchXml'; this.label = 'FetchXML'; } }
}));

vi.mock('../src/components/EnvVarsTab.js', () => ({
    EnvironmentVariablesTab: class { constructor() { this.id = 'envVars'; this.label = 'Env Vars'; } }
}));

vi.mock('../src/components/PluginTraceLogTab.js', () => ({
    PluginTraceLogTab: class { constructor() { this.id = 'pluginTrace'; this.label = 'Plugin Traces'; } }
}));

vi.mock('../src/components/UserContextTab.js', () => ({
    UserContextTab: class { constructor() { this.id = 'userContext'; this.label = 'User Context'; } }
}));

vi.mock('../src/components/CodeHubTab.js', () => ({
    CodeHubTab: class { constructor() { this.id = 'codeHub'; this.label = 'Code Hub'; } }
}));

vi.mock('../src/components/PerformanceTab.js', () => ({
    PerformanceTab: class { constructor() { this.id = 'performance'; this.label = 'Performance'; } }
}));

vi.mock('../src/components/SettingsTab.js', () => ({
    SettingsTab: class { constructor() { this.id = 'settings'; this.label = 'Settings'; } }
}));

vi.mock('../src/components/HelpTab.js', () => ({
    HelpTab: class { constructor() { this.id = 'help'; this.label = 'Help'; } }
}));

vi.mock('../src/components/AboutTab.js', () => ({
    AboutTab: class { constructor() { this.id = 'about'; this.label = 'About'; } }
}));

vi.mock('../src/components/ImpersonateTab.js', () => ({
    ImpersonateTab: class { constructor() { this.id = 'impersonate'; this.label = 'Impersonate'; } }
}));

vi.mock('../src/components/MetadataBrowserTab.js', () => ({
    MetadataBrowserTab: class { constructor() { this.id = 'metadataBrowser'; this.label = 'Metadata'; } }
}));

vi.mock('../src/components/SolutionLayersTab.js', () => ({
    SolutionLayersTab: class { constructor() { this.id = 'solutionLayers'; this.label = 'Solution Layers'; } }
}));

// Import after mocks
import { App } from '../src/App.js';
import { Store } from '../src/core/Store.js';
import { UIManager } from '../src/core/UIManager.js';
import { ComponentRegistry } from '../src/core/ComponentRegistry.js';
import { PowerAppsApiService } from '../src/services/PowerAppsApiService.js';
import { Config } from '../src/constants/index.js';

describe('App', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset window flags
        delete window[Config.MAIN.windowInitializedFlag];
        delete window.ProToolkit_UpdateNav;
        // Reset UIManager state
        UIManager.dialog = null;
        UIManager.activeTabId = null;
        // Clear any existing toolkit containers
        document.body.innerHTML = '';
    });

    afterEach(() => {
        delete window[Config.MAIN.windowInitializedFlag];
        delete window.ProToolkit_UpdateNav;
        document.body.innerHTML = '';
    });

    describe('init', () => {
        it('should initialize Store', () => {
            App.init();
            expect(Store.init).toHaveBeenCalled();
        });

        it('should initialize UIManager', () => {
            App.init();
            expect(UIManager.init).toHaveBeenCalled();
        });

        it('should call showDialog on UIManager', () => {
            App.init();
            expect(UIManager.showDialog).toHaveBeenCalled();
        });

        it('should register all components before initializing UI', () => {
            App.init();
            // 18 components should be registered
            expect(ComponentRegistry.register).toHaveBeenCalledTimes(18);
        });

        it('should set window initialized flag', () => {
            App.init();
            expect(window[Config.MAIN.windowInitializedFlag]).toBe(true);
        });

        it('should create ProToolkit_UpdateNav function on window', () => {
            App.init();
            expect(window.ProToolkit_UpdateNav).toBeDefined();
            expect(typeof window.ProToolkit_UpdateNav).toBe('function');
        });

        it('should add global onLoad handler via PowerAppsApiService', () => {
            App.init();
            expect(PowerAppsApiService.addOnLoad).toHaveBeenCalled();
        });

        describe('when already initialized', () => {
            it('should not reinitialize if flag is set', () => {
                window[Config.MAIN.windowInitializedFlag] = true;

                App.init();

                // Should not call Store.init if already initialized
                expect(Store.init).not.toHaveBeenCalled();
            });

            it('should show existing dialog if hidden', () => {
                window[Config.MAIN.windowInitializedFlag] = true;

                // Create a mock existing container
                const existingContainer = document.createElement('div');
                existingContainer.className = Config.MAIN.appContainerClass;
                existingContainer.style.display = 'none';
                document.body.appendChild(existingContainer);

                App.init();

                expect(existingContainer.style.display).toBe('flex');
            });

            it('should handle case when no existing container found', () => {
                window[Config.MAIN.windowInitializedFlag] = true;

                // No existing container in DOM
                expect(() => App.init()).not.toThrow();
            });
        });
    });

    describe('ProToolkit_UpdateNav', () => {
        it('should call updateNavTabs when dialog exists', () => {
            App.init();
            UIManager.dialog = document.createElement('div');

            window.ProToolkit_UpdateNav();

            expect(UIManager.updateNavTabs).toHaveBeenCalled();
        });

        it('should not call updateNavTabs when dialog is null', () => {
            App.init();
            UIManager.dialog = null;

            // Clear previous calls from init
            vi.clearAllMocks();

            window.ProToolkit_UpdateNav();

            expect(UIManager.updateNavTabs).not.toHaveBeenCalled();
        });
    });

    describe('global onLoad handler', () => {
        it('should update nav tabs when called', () => {
            App.init();

            // Get the handler that was passed to addOnLoad
            const handler = PowerAppsApiService.addOnLoad.mock.calls[0][0];

            // Clear mocks to track handler calls
            vi.clearAllMocks();

            // Call the handler
            handler();

            expect(UIManager.updateNavTabs).toHaveBeenCalled();
        });

        it('should refresh active tab when dialog and activeTabId exist', () => {
            App.init();

            // Get the handler that was passed to addOnLoad
            const handler = PowerAppsApiService.addOnLoad.mock.calls[0][0];

            // Set up dialog and activeTabId
            UIManager.dialog = document.createElement('div');
            UIManager.activeTabId = 'inspector';

            // Clear mocks
            vi.clearAllMocks();

            // Call the handler
            handler();

            expect(UIManager.refreshActiveTab).toHaveBeenCalledWith(false);
        });

        it('should not refresh active tab when dialog is null', () => {
            App.init();

            // Get the handler that was passed to addOnLoad
            const handler = PowerAppsApiService.addOnLoad.mock.calls[0][0];

            UIManager.dialog = null;
            UIManager.activeTabId = 'inspector';

            vi.clearAllMocks();

            handler();

            expect(UIManager.refreshActiveTab).not.toHaveBeenCalled();
        });

        it('should not refresh active tab when activeTabId is null', () => {
            App.init();

            // Get the handler that was passed to addOnLoad
            const handler = PowerAppsApiService.addOnLoad.mock.calls[0][0];

            UIManager.dialog = document.createElement('div');
            UIManager.activeTabId = null;

            vi.clearAllMocks();

            handler();

            expect(UIManager.refreshActiveTab).not.toHaveBeenCalled();
        });
    });

    describe('_registerComponents', () => {
        it('should register form-specific components', () => {
            App.init();

            // Check that form-specific components were registered
            const registeredIds = ComponentRegistry.register.mock.calls.map(
                call => call[0].id
            );

            expect(registeredIds).toContain('inspector');
            expect(registeredIds).toContain('formColumns');
            expect(registeredIds).toContain('automation');
            expect(registeredIds).toContain('eventMonitor');
            expect(registeredIds).toContain('pluginContext');
            expect(registeredIds).toContain('performance');
        });

        it('should register global components', () => {
            App.init();

            const registeredIds = ComponentRegistry.register.mock.calls.map(
                call => call[0].id
            );

            expect(registeredIds).toContain('impersonate');
            expect(registeredIds).toContain('metadataBrowser');
            expect(registeredIds).toContain('solutionLayers');
            expect(registeredIds).toContain('webApi');
            expect(registeredIds).toContain('fetchXml');
            expect(registeredIds).toContain('envVars');
            expect(registeredIds).toContain('pluginTrace');
            expect(registeredIds).toContain('userContext');
            expect(registeredIds).toContain('codeHub');
        });

        it('should register utility components', () => {
            App.init();

            const registeredIds = ComponentRegistry.register.mock.calls.map(
                call => call[0].id
            );

            expect(registeredIds).toContain('settings');
            expect(registeredIds).toContain('help');
            expect(registeredIds).toContain('about');
        });

        it('should register exactly 18 components', () => {
            App.init();

            expect(ComponentRegistry.register).toHaveBeenCalledTimes(18);
        });

        it('should register components with proper structure', () => {
            App.init();

            // Each registered component should have id and label
            ComponentRegistry.register.mock.calls.forEach(call => {
                const component = call[0];
                expect(component).toHaveProperty('id');
                expect(component).toHaveProperty('label');
                expect(typeof component.id).toBe('string');
                expect(typeof component.label).toBe('string');
            });
        });
    });

    describe('initialization order', () => {
        it('should register components before Store.init', () => {
            const callOrder = [];

            ComponentRegistry.register.mockImplementation(() => {
                callOrder.push('register');
            });
            Store.init.mockImplementation(() => {
                callOrder.push('store');
            });
            UIManager.init.mockImplementation(() => {
                callOrder.push('ui');
            });

            App.init();

            // All registrations should come before store init
            const firstStoreIndex = callOrder.indexOf('store');
            const lastRegisterIndex = callOrder.lastIndexOf('register');

            expect(lastRegisterIndex).toBeLessThan(firstStoreIndex);
        });

        it('should initialize Store before UIManager', () => {
            const callOrder = [];

            Store.init.mockImplementation(() => {
                callOrder.push('store');
            });
            UIManager.init.mockImplementation(() => {
                callOrder.push('ui');
            });

            App.init();

            const storeIndex = callOrder.indexOf('store');
            const uiIndex = callOrder.indexOf('ui');

            expect(storeIndex).toBeLessThan(uiIndex);
        });

        it('should call showDialog after UIManager.init', () => {
            const callOrder = [];

            UIManager.init.mockImplementation(() => {
                callOrder.push('init');
            });
            UIManager.showDialog.mockImplementation(() => {
                callOrder.push('show');
            });

            App.init();

            const initIndex = callOrder.indexOf('init');
            const showIndex = callOrder.indexOf('show');

            expect(initIndex).toBeLessThan(showIndex);
        });
    });

    describe('App object structure', () => {
        it('should have init method', () => {
            expect(App.init).toBeDefined();
            expect(typeof App.init).toBe('function');
        });

        it('should have _registerComponents method', () => {
            expect(App._registerComponents).toBeDefined();
            expect(typeof App._registerComponents).toBe('function');
        });

        it('should be a namespace object', () => {
            expect(typeof App).toBe('object');
        });
    });

    describe('edge cases', () => {
        it('should handle multiple rapid init calls', () => {
            App.init();
            App.init();
            App.init();

            // After first init, subsequent calls should be no-ops
            // Store.init should only be called once
            expect(Store.init).toHaveBeenCalledTimes(1);
        });

        it('should handle init when DOM is empty', () => {
            document.body.innerHTML = '';
            expect(() => App.init()).not.toThrow();
        });

        it('should handle init with existing elements in DOM', () => {
            document.body.innerHTML = '<div id="existing">Content</div>';
            expect(() => App.init()).not.toThrow();
        });
    });
});
