/**
 * @file Dialog and modal utilities.
 * @module helpers/dialog.helpers
 * @description Provides utilities for creating and managing dialog boxes.
 */

import { DialogService } from '../services/DialogService.js';
import { Config } from '../constants/index.js';

/**
 * Dialog utility functions.
 * @namespace DialogHelpers
 */
export const DialogHelpers = {
    /**
     * Shows a confirmation dialog that returns a promise resolving to true (OK) or false (Cancel).
     * Uses DialogService and monitors DOM for dialog closure to handle cancel/dismiss.
     * @param {string} title - The dialog title.
     * @param {string|HTMLElement} content - The dialog content (HTML string or element).
     * @returns {Promise<boolean>} Promise resolving to true if user clicks OK, false otherwise.
     */
    showConfirmDialog(title, content) {
        return new Promise(resolve => {
            let done = false;
            const onOk = () => {
                if (!done) {
                    done = true;
                    resolve(true);
                }
            };
            DialogService.show(title, content, onOk);

            // Monitor for dialog closure (cancel/dismiss)
            const obs = new MutationObserver(() => {
                if (!document.getElementById(Config.DIALOG_OVERLAY_ID)) {
                    if (!done) {
                        done = true;
                        resolve(false);
                    }
                    obs.disconnect();
                }
            });
            obs.observe(document.body, { childList: true });
        });
    }
};
