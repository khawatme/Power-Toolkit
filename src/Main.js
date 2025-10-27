/**
 * @file Application entry point.
 * @module Main
 * @description This file is the main entry point for the Power-Toolkit. It contains the IIFE
 * wrapper and includes a robust, polling-based initialization logic to safely start the
 * application within various Power Apps host environments.
 */

import { App } from './App.js';
import { Config } from './constants/index.js';

/**
 * @description An IIFE (Immediately Invoked Function Expression) to create a private scope
 * for the application's startup logic, preventing pollution of the global namespace.
 */
(function () {
    'use strict';

    // --- Singleton Check ---
    if (window[Config.MAIN.windowInitializedFlag] && window[Config.MAIN.windowVersionFlag] === Config.TOOL_VERSION) {
        const existingDialog = document.querySelector(`.${Config.MAIN.appContainerClass}`);
        if (existingDialog) {
            existingDialog.style.display = 'flex';
        }
        return;
    }
    document.querySelector(`.${Config.MAIN.appContainerClass}`)?.remove();
    window[Config.MAIN.windowVersionFlag] = Config.TOOL_VERSION;

    /**
     * Determines the correct moment to initialize the application based on the state
     * of the `Xrm` object. It handles fully-loaded forms, partially-loaded forms (by
     * waiting for OnLoad), and non-form pages like views.
     * @private
     * @throws {Error} If a usable Xrm context cannot be found.
     */
    function safeInitialize() {
        if (typeof Xrm !== 'undefined' && Xrm.Page?.data) {
            if (Xrm.Page.ui?.getFormType?.() > 0) {
                App.init();
            } else {
                const initOnLoad = () => {
                    App.init();
                    Xrm.Page.data.removeOnLoad(initOnLoad);
                };
                Xrm.Page.data.addOnLoad(initOnLoad);
            }
        }
        else if (typeof Xrm !== 'undefined' && Xrm.Utility) {
            setTimeout(() => App.init(), Config.MAIN.initDelay);
        }
        else {
            throw new Error(Config.MAIN.errors.xrmNotAvailable);
        }
    }

    // --- Polling Mechanism to wait for Xrm ---
    let attempts = 0;
    const maxAttempts = Config.MAIN.maxPollingAttempts;
    const intervalId = setInterval(() => {
        attempts++;
        if (typeof Xrm !== 'undefined') {
            clearInterval(intervalId);
            try {
                safeInitialize();
            } catch (e) {
                console.error(Config.MAIN.errors.startupFailed, e);
                alert(Config.MAIN.alerts.startupError(e.message));
            }
        } else if (attempts >= maxAttempts) {
            clearInterval(intervalId);
            const errorMessage = Config.MAIN.errors.xrmNotFound;
            console.error(errorMessage);
            alert(errorMessage);
        }
    }, Config.MAIN.pollingInterval);

})();