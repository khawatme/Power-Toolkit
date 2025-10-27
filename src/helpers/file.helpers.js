/**
 * @file File I/O and clipboard utilities.
 * @module helpers/file.helpers
 * @description Provides utilities for file operations, clipboard access, and downloads.
 */

import { NotificationService } from '../services/NotificationService.js';
import { Config } from '../constants/index.js';

/**
 * File I/O utility functions.
 * @namespace FileHelpers
 */
export const FileHelpers = {
    /**
     * Copies a string to the user's clipboard using the modern Clipboard API with a
     * fallback to the legacy `execCommand` for older browsers or insecure contexts.
     * Shows a success or error notification.
     * @param {string} text - The text to copy.
     * @param {string} successMessage - The message to show on successful copy.
     * @returns {Promise<void>}
     */
    async copyToClipboard(text, successMessage) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            NotificationService.show(successMessage, 'success');
        } catch (err) {
            NotificationService.show(Config.MESSAGES.HELPERS.copyFailed, 'error');
            console.error('Copy to clipboard failed:', err);
        }
    },

    /**
     * Triggers a browser download for a given JavaScript object by converting it to a JSON file.
     * @param {object} data - The JSON object to download.
     * @param {string} filename - The desired filename for the downloaded file.
     * @returns {void}
     */
    downloadJson(data, filename) {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Creates a file input element for file selection with specified options.
     * Useful for import/upload functionality across tabs.
     * @param {Object} options - Configuration options.
     * @param {string} [options.accept] - File types to accept (e.g., '.json', 'image/*').
     * @param {boolean} [options.multiple=false] - Allow multiple file selection.
     * @param {Function} options.onChange - Callback function when files are selected.
     * @returns {HTMLInputElement} - Configured file input element.
     */
    createFileInputElement(options = {}) {
        const input = document.createElement('input');
        input.type = 'file';
        if (options.accept) input.accept = options.accept;
        if (options.multiple) input.multiple = true;
        if (options.onChange) input.onchange = options.onChange;
        return input;
    },

    /**
     * Reads a file and parses it as JSON using Promise-based FileReader.
     * @param {File} file - The file object to read.
     * @returns {Promise<any>} - Promise that resolves with parsed JSON data.
     */
    readJsonFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    resolve(data);
                } catch (error) {
                    reject(new Error(`Invalid JSON: ${error.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
};
