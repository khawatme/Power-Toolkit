/**
 * @file Service for creating and managing modal dialogs.
 * @module services/DialogService
 * @description Provides a standardized way to show confirmation or prompt dialogs to the user.
 * It's theme-aware and uses a flexible callback system.
 */

import { Store } from '../core/Store.js';
import { Config } from '../constants/index.js';

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
        document.getElementById(Config.DIALOG_OVERLAY_ID)?.remove();

        const dialogOverlay = document.createElement('div');
        dialogOverlay.id = Config.DIALOG_OVERLAY_ID;
        dialogOverlay.className = Config.DIALOG_CLASSES.overlay;

        if (Store.getState().theme === 'light') {
            dialogOverlay.classList.add('light-mode');
        }

        dialogOverlay.innerHTML = `
            <div class="${Config.DIALOG_CLASSES.dialog}" role="dialog" aria-modal="true" aria-labelledby="${Config.DIALOG_CLASSES.title}">
                <div class="${Config.DIALOG_CLASSES.header}">
                    <h3 id="${Config.DIALOG_CLASSES.title}">${title}</h3>
                    <button class="${Config.DIALOG_CLASSES.iconBtn} ${Config.DIALOG_CLASSES.closeBtn}" aria-label="Close dialog">&times;</button>
                </div>
                <div class="${Config.DIALOG_CLASSES.content}"></div>
                <div class="${Config.DIALOG_CLASSES.footer}">
                    ${callback ? `<button class="modern-button ${Config.DIALOG_CLASSES.okBtn}">OK</button>` : ''}
                    <button class="modern-button secondary ${Config.DIALOG_CLASSES.cancelBtn}">Close</button>
                </div>
            </div>`;

        const contentContainer = dialogOverlay.querySelector(`.${Config.DIALOG_CLASSES.content}`);
        if (typeof contentHTML === 'string') {
            contentContainer.innerHTML = contentHTML;
        } else if (contentHTML instanceof HTMLElement) {
            contentContainer.appendChild(contentHTML);
        }

        document.body.appendChild(dialogOverlay);

        const okButton = dialogOverlay.querySelector(`.${Config.DIALOG_CLASSES.okBtn}`);
        const cancelButton = dialogOverlay.querySelector(`.${Config.DIALOG_CLASSES.cancelBtn}`);
        const closeButton = dialogOverlay.querySelector(`.${Config.DIALOG_CLASSES.closeBtn}`);

        const close = () => {
            dialogOverlay.remove();
            document.removeEventListener('keydown', handleEscKey);
        };

        const handleEscKey = (e) => {
            if (e.key === 'Escape') close();
        };

        // Add ESC key support for accessibility
        document.addEventListener('keydown', handleEscKey);

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