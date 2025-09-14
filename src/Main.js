/**
 * @file Application entry point.
 * @module Main
 * @description This file is the main entry point for the Power-Toolkit. It contains the IIFE
 * wrapper and includes a robust, polling-based initialization logic to safely start the
 * application within various Power Apps host environments.
 */

import { App } from './App.js';
import { Config } from './utils/Config.js';

(function () {
    'use strict';

    // --- Singleton Check ---
    if (window.PDT_INITIALIZED && window.PDT_VERSION === Config.TOOL_VERSION) {
        console.log(`Power-Toolkit v${Config.TOOL_VERSION} is already running.`);
        const existingDialog = document.querySelector('.powerapps-dev-toolkit');
        if (existingDialog) {
            existingDialog.style.display = 'flex';
        }
        return;
    }
    document.querySelector('.powerapps-dev-toolkit')?.remove();
    window.PDT_VERSION = Config.TOOL_VERSION;

    // --- Safe Initialization Logic ---
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
            setTimeout(() => App.init(), 250);
        }
        else {
            throw new Error("Xrm context is not available on this page. This tool is for Power Apps Model-Driven Apps.");
        }
    }

    // --- Polling Mechanism to wait for Xrm ---
    let attempts = 0;
    const maxAttempts = 20; // Try for 5 seconds (20 * 250ms)
    const intervalId = setInterval(() => {
        attempts++;
        if (typeof Xrm !== 'undefined') {
            clearInterval(intervalId);
            try {
                safeInitialize();
            } catch(e) {
                console.error("Power-Toolkit startup failed:", e);
                alert(`Power-Toolkit could not start. Check the console for errors.\n\nError: ${e.message}`);
            }
        } else if (attempts >= maxAttempts) {
            clearInterval(intervalId);
            const errorMessage = "Power-Toolkit could not start: The Xrm object was not found. Please ensure you are on a valid Power Apps page (like a Model-Driven App form/view or the Maker Portal) and try again.";
            console.error(errorMessage);
            alert(errorMessage);
        }
    }, 250);

})();