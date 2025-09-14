/**
 * @file Main application controller for the Power-Toolkit.
 * @module App
 * @description This file is responsible for initializing the application, registering all
 * the components (tabs), and starting the UI. It acts as the central assembler for the toolkit.
 */

// Core Modules
import { Store } from './core/Store.js';
import { UIManager } from './core/UIManager.js';
import { ComponentRegistry } from './core/ComponentRegistry.js';

// All Feature Tab Components
import { InspectorTab } from './components/InspectorTab.js';
import { FormColumnsTab } from './components/FormColumnsTab.js';
import { AutomationTab } from './components/AutomationTab.js';
import { EventMonitorTab } from './components/EventMonitorTab.js';
import { PluginContextTab } from './components/PluginContextTab.js';
import { WebApiExplorerTab } from './components/WebApiExplorerTab.js';
import { FetchXmlTesterTab } from './components/FetchXmlTesterTab.js';
import { EnvironmentVariablesTab } from './components/EnvVarsTab.js';
import { PluginTraceLogTab } from './components/PluginTraceLogTab.js';
import { UserContextTab } from './components/UserContextTab.js';
import { CodeHubTab } from './components/CodeHubTab.js';
import { PerformanceTab } from './components/PerformanceTab.js';
import { SettingsTab } from './components/SettingsTab.js';
import { HelpTab } from './components/HelpTab.js';
import { AboutTab } from './components/AboutTab.js';
import { ImpersonateTab } from './components/ImpersonateTab.js';
import { MetadataBrowserTab } from './components/MetadataBrowserTab.js';
import { CoffeeTab } from './components/CoffeeTab.js';

/**
 * The main application object.
 * @namespace
 */
export const App = {
    /**
     * Initializes and starts the Power-Toolkit application.
     */
    init() {
        // Prevent multiple instances of the tool from running simultaneously.
        if (window.PDT_INITIALIZED) {
            const existingTool = document.querySelector('.powerapps-dev-toolkit');
            if (existingTool) {
                existingTool.style.display = 'flex'; // Simply un-hide if already present
            }
            return;
        }

        // Register all available feature components.
        this._registerComponents();

        // Initialize core services in the correct order.
        Store.init();       // 1. Load settings and state from localStorage.
        UIManager.init();   // 2. Subscribe the UI Manager to state changes.

        // Display the main application window.
        UIManager.showDialog();
        
        // Expose a global function for the background script to call for context updates.
        window.ProToolkit_UpdateNav = () => {
            if (UIManager.dialog) { // Only run if the UI is actually initialized
                UIManager.updateNavTabs();
            }
        };

        // Set a global flag to indicate the tool is running.
        window.PDT_INITIALIZED = true;
        console.log("Power-Toolkit Initialized.");
    },

    /**
     * Instantiates and registers all feature components with the ComponentRegistry.
     * To add a new tab, import its class and register it here.
     * @private
     */
    _registerComponents() {
        // Form-Specific Components
        ComponentRegistry.register(new InspectorTab());
        ComponentRegistry.register(new FormColumnsTab());
        ComponentRegistry.register(new AutomationTab());
        ComponentRegistry.register(new EventMonitorTab());
        ComponentRegistry.register(new PluginContextTab());
        ComponentRegistry.register(new PerformanceTab());

        // Global Components (available on forms and views)
        ComponentRegistry.register(new ImpersonateTab());
        ComponentRegistry.register(new MetadataBrowserTab());
        ComponentRegistry.register(new WebApiExplorerTab());
        ComponentRegistry.register(new FetchXmlTesterTab());
        ComponentRegistry.register(new EnvironmentVariablesTab());
        ComponentRegistry.register(new PluginTraceLogTab());
        ComponentRegistry.register(new UserContextTab());
        ComponentRegistry.register(new CodeHubTab());
        
        // Utility Components
        ComponentRegistry.register(new SettingsTab());
        ComponentRegistry.register(new HelpTab());
        ComponentRegistry.register(new AboutTab());
        // ComponentRegistry.register(new CoffeeTab());
    }
};