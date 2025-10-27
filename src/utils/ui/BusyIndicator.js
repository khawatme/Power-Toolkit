/**
 * @file BusyIndicator
 * @description Provides UI feedback during async operations
 * @module utils/ui/BusyIndicator
 */

import { Config } from '../../constants/index.js';

export class BusyIndicator {
    /**
     * Show busy state on button and result container
     * @param {HTMLButtonElement} executeBtn - The execute button to disable
     * @param {HTMLElement} resultRoot - The result container to update
     * @param {string} label - The loading message
     */
    static set(executeBtn, resultRoot, label = Config.MESSAGES.UI.loading) {
        if (executeBtn) {
            executeBtn.disabled = true;
            executeBtn.textContent = label;
        }
        if (resultRoot) {
            resultRoot.innerHTML = `
                <div class="pdt-toolbar" style="justify-content: space-between;">
                    <h4 class="section-title" style="margin:0; border:none;">${Config.MESSAGES.UI.resultLoading}</h4>
                </div>
                <div class="pdt-table-wrapper" aria-busy="true">
                    <p class="pdt-note">${Config.MESSAGES.UI.pleaseWait}</p>
                </div>
            `;
        }
    }

    /**
     * Clear busy state and restore button to default
     * @param {HTMLButtonElement} executeBtn - The execute button to re-enable
     */
    static clear(executeBtn) {
        if (executeBtn) {
            executeBtn.disabled = false;
            executeBtn.textContent = Config.MESSAGES.UI.execute;
        }
    }
}
