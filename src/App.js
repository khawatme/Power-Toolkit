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
import { PowerAppsApiService } from './services/PowerAppsApiService.js';
import { Config } from './constants/index.js';

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
import { SolutionLayersTab } from './components/SolutionLayersTab.js';

/**
 * The main application object.
 * @namespace
 */
export const App = {
    /**
     * Initializes the application. This function registers all components, loads state
     * from storage, starts the UI manager, and attaches global handlers for browser
     * navigation events. It also creates `window.ProToolkit_UpdateNav` for external scripts.
     * @returns {void}
     */
    init() {
        if (window[Config.MAIN.windowInitializedFlag]) {
            const existingTool = document.querySelector(`.${Config.MAIN.appContainerClass}`);
            if (existingTool) {
                existingTool.style.display = 'flex';
            }
            return;
        }

        this._registerComponents();

        Store.init();
        UIManager.init();

        UIManager.showDialog();

        window.ProToolkit_UpdateNav = () => {
            if (UIManager.dialog) {
                UIManager.updateNavTabs();
            }
        };

        const globalOnLoadHandler = () => {
            UIManager.updateNavTabs();
            if (UIManager.dialog && UIManager.activeTabId) {
                UIManager.refreshActiveTab(false);
            }
        };
        PowerAppsApiService.addOnLoad(globalOnLoadHandler);

        window[Config.MAIN.windowInitializedFlag] = true;
    },

    /**
     * Instantiates and registers all feature components with the ComponentRegistry.
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

        // Global Components
        ComponentRegistry.register(new ImpersonateTab());
        ComponentRegistry.register(new MetadataBrowserTab());
        ComponentRegistry.register(new SolutionLayersTab());
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
    }
};