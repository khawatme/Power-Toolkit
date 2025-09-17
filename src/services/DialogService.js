/**
 * @file Service for creating and managing modal dialogs.
 * @module services/DialogService
 * @description Provides a standardized way to show confirmation or prompt dialogs to the user.
 * It's theme-aware and uses a flexible callback system.
 */

import { Store } from '../core/Store.js';

/**
 * A callback function that is executed when the 'OK' button is clicked.
 * @callback DialogOkCallback
 * @param {HTMLElement} contentContainer - The dialog's content container element, useful for retrieving input values.
 * @returns {boolean|void} Return `false` to prevent the dialog from closing automatically, for example, on a validation error.
 */

/**
 * Provides methods for displaying modal dialog windows.
 * @namespace
 */
export const DialogService = {
    /**
     * Shows a modal dialog, handles its lifecycle, and returns a controller object.
     * The dialog is theme-aware and supports both string and element content.
     *
     * @param {string} title - The title to display in the dialog header.
     * @param {string | HTMLElement} content - The HTML string or DOM element to display in the dialog's body.
     * @param {DialogOkCallback} [callback] - An optional function to call when the 'OK' button is clicked.
     * If this function is provided, an 'OK' button will be rendered.
     * @returns {{close: () => void}} An object with a `close` method to programmatically close the dialog.
     */
    show(title, contentHTML, callback = null) {
        document.getElementById('pdt-dialog-overlay')?.remove();

        const dialogOverlay = document.createElement('div');
        dialogOverlay.id = 'pdt-dialog-overlay';
        dialogOverlay.className = 'pdt-dialog-overlay';

        if (Store.getState().theme === 'light') {
            dialogOverlay.classList.add('light-mode');
        }

        dialogOverlay.innerHTML = `
            <div class="pdt-dialog" role="dialog" aria-modal="true" aria-labelledby="pdt-dialog-title">
                <div class="pdt-dialog-header">
                    <h3 id="pdt-dialog-title">${title}</h3>
                    <button class="pdt-icon-btn pdt-close-btn" aria-label="Close dialog">&times;</button>
                </div>
                <div class="pdt-dialog-content"></div>
                <div class="pdt-dialog-footer">
                    ${callback ? '<button class="modern-button pdt-dialog-ok">OK</button>' : ''}
                    <button class="modern-button secondary pdt-dialog-cancel">Close</button>
                </div>
            </div>`;

        const contentContainer = dialogOverlay.querySelector('.pdt-dialog-content');
        if (typeof contentHTML === 'string') {
            contentContainer.innerHTML = contentHTML;
        } else if (contentHTML instanceof HTMLElement) {
            contentContainer.appendChild(contentHTML);
        }

        document.body.appendChild(dialogOverlay);

        const okButton = dialogOverlay.querySelector('.pdt-dialog-ok');
        const cancelButton = dialogOverlay.querySelector('.pdt-dialog-cancel');
        const closeButton = dialogOverlay.querySelector('.pdt-close-btn');

        const close = () => dialogOverlay.remove();

        closeButton.onclick = close;
        cancelButton.onclick = close;
        dialogOverlay.onclick = (e) => {
            if (e.target === dialogOverlay) close();
        };

        if (callback && okButton) {
            okButton.onclick = () => {
                if (callback(contentContainer) !== false) {
                    close();
                }
            };
        }
        
        (okButton || cancelButton)?.focus();

        // Return the close function so the calling component can control the dialog.
        return { close };
    }
};