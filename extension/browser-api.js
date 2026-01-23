/**
 * @file Cross-browser API wrapper for Chrome/Firefox/Edge compatibility.
 * @description Provides a unified API that works across all major browsers.
 * Uses the browser.* namespace if available (Firefox), falls back to chrome.* (Chrome/Edge).
 * 
 * Firefox uses Promise-based APIs natively via browser.*
 * Chrome uses callback-based APIs via chrome.* but also supports Promises in MV3
 * 
 * This wrapper normalizes the API access pattern for seamless cross-browser operation.
 */

/**
 * Detect the current browser environment.
 * @returns {'firefox'|'chrome'|'edge'|'unknown'} The detected browser type.
 */
function detectBrowser() {
    if (typeof browser !== 'undefined' && browser.runtime?.getBrowserInfo) {
        return 'firefox';
    }
    if (navigator.userAgent.includes('Edg/')) {
        return 'edge';
    }
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        return 'chrome';
    }
    return 'unknown';
}

/**
 * The unified browser API object.
 * Prefers `browser` (Firefox) and falls back to `chrome` (Chrome/Edge).
 * @type {typeof chrome}
 */
const browserAPI = (() => {
    // Firefox provides both `browser` and `chrome`, but `browser` is the native Promise-based API
    if (typeof browser !== 'undefined' && browser.runtime) {
        return browser;
    }
    // Chrome and Edge use `chrome` namespace
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        return chrome;
    }
    // Fallback for testing or unsupported environments
    console.warn('[BrowserAPI] No browser extension API detected');
    return null;
})();

/**
 * Check if the current environment is Firefox.
 * @returns {boolean} True if running in Firefox.
 */
function isFirefox() {
    return typeof browser !== 'undefined' && 
           typeof browser.runtime !== 'undefined' &&
           typeof browser.runtime.getBrowserInfo === 'function';
}

/**
 * Check if the current environment is Chrome or Edge (Chromium-based).
 * @returns {boolean} True if running in Chrome or Edge.
 */
function isChromium() {
    return !isFirefox() && typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined';
}

/**
 * Get the extension's runtime URL for a resource.
 * @param {string} path - The relative path to the resource.
 * @returns {string} The full runtime URL.
 */
function getExtensionURL(path) {
    return browserAPI?.runtime?.getURL(path) || '';
}

/**
 * Execute a script in the specified tab.
 * Handles differences between Chrome and Firefox scripting APIs.
 * 
 * @param {Object} options - Script execution options.
 * @param {number} options.tabId - The tab ID to execute in.
 * @param {boolean} [options.allFrames=false] - Whether to execute in all frames.
 * @param {Function} [options.func] - The function to execute.
 * @param {Array} [options.args] - Arguments to pass to the function.
 * @param {'MAIN'|'ISOLATED'} [options.world='MAIN'] - The execution world.
 * @returns {Promise<Array>} The execution results.
 */
async function executeScript(options) {
    const { tabId, allFrames = false, func, args = [], world = 'MAIN' } = options;
    
    const scriptOptions = {
        target: { tabId, allFrames },
        func,
        args
    };
    
    // Firefox 128+ supports world: 'MAIN', older versions don't
    // Chrome has had this since MV3 launch
    if (world === 'MAIN') {
        scriptOptions.world = 'MAIN';
    }
    
    try {
        return await browserAPI.scripting.executeScript(scriptOptions);
    } catch (error) {
        if (world === 'MAIN' && scriptOptions.world) {
            console.warn('[BrowserAPI] world: MAIN not supported, falling back to ISOLATED', error);
            delete scriptOptions.world;
            return await browserAPI.scripting.executeScript(scriptOptions);
        }
        throw error;
    }
}

/**
 * Set the badge text on the extension icon.
 * @param {Object} details - Badge details.
 * @param {number} details.tabId - The tab ID.
 * @param {string} details.text - The badge text.
 * @returns {Promise<void>}
 */
async function setBadgeText(details) {
    return browserAPI?.action?.setBadgeText(details);
}

/**
 * Set the badge background color on the extension icon.
 * @param {Object} details - Color details.
 * @param {number} details.tabId - The tab ID.
 * @param {string|Array<number>} details.color - The color (CSS string or RGBA array).
 * @returns {Promise<void>}
 */
async function setBadgeBackgroundColor(details) {
    return browserAPI?.action?.setBadgeBackgroundColor(details);
}

/**
 * Set the extension icon title/tooltip.
 * @param {Object} details - Title details.
 * @param {number} details.tabId - The tab ID.
 * @param {string} details.title - The title text.
 * @returns {Promise<void>}
 */
async function setActionTitle(details) {
    return browserAPI?.action?.setTitle(details);
}

/**
 * Add a listener for when the extension action is clicked.
 * @param {Function} callback - The callback function receiving the tab object.
 */
function onActionClicked(callback) {
    browserAPI?.action?.onClicked?.addListener(callback);
}

// Export for ES modules (when used as module)
// These are also available globally when loaded as a script
export {
    browserAPI,
    detectBrowser,
    isFirefox,
    isChromium,
    getExtensionURL,
    executeScript,
    setBadgeText,
    setBadgeBackgroundColor,
    setActionTitle,
    onActionClicked
};
