/**
 * @file Browser extension background script (Service Worker for Chrome/Edge, Event Page for Firefox).
 * @description Handles the extension's action button click, intelligently deciding whether to
 * inject the tool for the first time or simply un-hide the existing UI.
 * 
 * Cross-browser compatible: Works with Chrome, Edge, and Firefox.
 */

/**
 * Unified browser API - uses `browser` namespace (Firefox) or `chrome` namespace (Chrome/Edge).
 * Firefox supports the `chrome` namespace for compatibility, but `browser` is preferred.
 * @type {typeof chrome}
 */
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

/**
 * Detect if running in Firefox.
 * @returns {boolean} True if Firefox.
 */
const isFirefox = () => typeof browser !== 'undefined' && typeof browser.runtime?.getBrowserInfo === 'function';

/**
 * Injects the main toolkit script into the page.
 * @param {number} tabId - The ID of the tab to inject the script into.
 */
async function launchToolkit(tabId) {
    try {
        const response = await fetch(browserAPI.runtime.getURL('power-toolkit.js'));
        const scriptContent = await response.text();
        await browserAPI.scripting.executeScript({
            target: { tabId: tabId },
            world: 'MAIN',
            func: (code) => {
                const SCRIPT_ID = 'power-toolkit-script-module';
                if (document.getElementById(SCRIPT_ID)) return;
                const script = document.createElement('script');
                script.id = SCRIPT_ID;
                script.type = 'module';
                script.textContent = code;
                (document.head || document.documentElement).appendChild(script);
            },
            args: [scriptContent]
        });
    } catch (e) {
        console.error("Power-Toolkit: Failed to load or inject the main script.", e);
    }
}

/**
 * Shows a temporary error badge on the extension icon.
 * @param {number} tabId - The ID of the tab to show the feedback on.
 */
async function showInactiveError(tabId) {
    await browserAPI.action.setBadgeText({ tabId: tabId, text: '!' });
    await browserAPI.action.setBadgeBackgroundColor({ tabId: tabId, color: '#f44336' });
    await browserAPI.action.setTitle({ tabId: tabId, title: 'Power-Toolkit: Not a valid Power Apps page.' });
    setTimeout(async () => {
        await browserAPI.action.setBadgeText({ tabId: tabId, text: '' });
        await browserAPI.action.setTitle({ tabId: tabId, title: 'Launch Power-Toolkit' });
    }, 3000);
}

/**
 * This function is injected into the target page to perform two actions:
 * 1. Clean up any pre-existing instances of the toolkit from the DOM.
 * 2. Probe the window and its frames to determine if it's a valid host environment
 * (a Model-Driven App or Maker Portal) where the toolkit can be loaded.
 * @returns {'CAN_LOAD' | 'CANNOT_LOAD'} A status indicating if the environment is valid.
 */
function probeAndShow() {
    const SCRIPT_ID = 'power-toolkit-script-module';
    const DIALOG_SELECTOR = '.powerapps-dev-toolkit';

    const cleanup = (win) => {
        try {
            win.document.querySelector(DIALOG_SELECTOR)?.remove();
            win.document.getElementById(SCRIPT_ID)?.remove();
            if (win.PDT_INITIALIZED) win.PDT_INITIALIZED = false;
        } catch (e) {
            // Fails silently on cross-origin iframes, which is expected.
        }
    };
    
    cleanup(window);
    for (let i = 0; i < window.frames.length; i++) {
        cleanup(window.frames[i]);
    }

    const isModelDrivenApp = (win) => typeof win.Xrm?.Utility !== 'undefined';
    
    if (isModelDrivenApp(window)) return 'CAN_LOAD';
    for (let i = 0; i < window.frames.length; i++) {
        try {
            if (isModelDrivenApp(window.frames[i])) return 'CAN_LOAD';
        } catch (e) { /* ignore */ }
    }
    
    const isMakerPortal = () => !!window.MsCrmMscrmControls;
    if(isMakerPortal()){
          return 'CAN_LOAD';
    }

    return 'CANNOT_LOAD';
}

/**
 * Check if a URL is a restricted browser page.
 * @param {string} url - The URL to check.
 * @returns {boolean} True if the URL is restricted.
 */
function isRestrictedUrl(url) {
    if (!url) return true;
    // Chrome/Edge restricted pages
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return true;
    if (url.startsWith('edge://') || url.startsWith('extension://')) return true;
    // Firefox restricted pages
    if (url.startsWith('about:') || url.startsWith('moz-extension://')) return true;
    return false;
}

/**
 * The main listener for when the user clicks the extension's toolbar icon.
 * It injects the `probeAndShow` function to check the page's validity and then
 * either launches the toolkit or shows a temporary error badge.
 */
browserAPI.action.onClicked.addListener(async (tab) => {
    if (isRestrictedUrl(tab.url)) {
        await showInactiveError(tab.id);
        return;
    }

    try {
        const results = await browserAPI.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            world: 'MAIN',
            func: probeAndShow
        });

        // Find the first successful result from any frame.
        const status = results.find(r => r.result === 'CAN_LOAD')?.result || 'CANNOT_LOAD';

        if (status === 'CAN_LOAD') {
            await launchToolkit(tab.id);
        } else {
            await showInactiveError(tab.id);
        }
    } catch (e) {
        console.error(`Power-Toolkit: Could not execute script on ${tab.url}. Error: ${e.message}`);
        await showInactiveError(tab.id);
    }
});