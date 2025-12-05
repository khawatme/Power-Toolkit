/**
 * Application metadata and core configuration.
 * @module constants/app
 */

/**
 * The current version number of the toolkit.
 * @type {string}
 */
export const TOOL_VERSION = '3.0.0';

/**
 * The name of the application's author.
 * @type {string}
 */
export const DEVELOPER_NAME = 'Mohammed Khawatme';

/**
 * The MIT license text for the application.
 * @type {string}
 */
export const LICENSE_TEXT = `MIT License

Copyright (c) 2025 Mohammed Khawatme

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

/**
 * Main.js startup and initialization constants.
 * @type {Object}
 */
export const MAIN = {
    appContainerClass: 'powerapps-dev-toolkit',
    windowInitializedFlag: 'PDT_INITIALIZED',
    windowVersionFlag: 'PDT_VERSION',
    pollingInterval: 250,
    maxPollingAttempts: 20,
    initDelay: 250,
    errors: {
        xrmNotAvailable: 'Xrm context is not available on this page. This tool is for Power Apps Model-Driven Apps.',
        startupFailed: 'Power-Toolkit startup failed:',
        xrmNotFound: 'Power-Toolkit could not start: The Xrm object was not found. Please ensure you are on a valid Power Apps page (like a Model-Driven App form/view or the Maker Portal) and try again.'
    },
    alerts: {
        startupError: (message) => `Power-Toolkit could not start. Check the console for errors.\n\nError: ${message}`
    }
};

/**
 * Default configuration values for BaseComponent.
 * @type {Object}
 */
export const BASE_COMPONENT_DEFAULTS = {
    isFormOnly: false
};

/**
 * Error messages for BaseComponent.
 * @type {Object}
 */
export const BASE_COMPONENT_ERRORS = {
    abstractInstantiation: 'Cannot construct BaseComponent instances directly. Please extend this class.',
    renderNotImplemented: (label) => `Render method for <strong>${label}</strong> has not been implemented.`
};

/**
 * Console messages for ComponentRegistry.
 * @type {Object.<string, string|Function>}
 */
export const COMPONENT_REGISTRY_MESSAGES = {
    invalidComponent: 'PDT Error: Attempted to register an invalid component.',
    duplicateComponent: (id) => `PDT Warning: A component with ID '${id}' is already registered. Overwriting.`
};
