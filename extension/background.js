/**
 * @file Chrome extension service worker.
 * @description Handles the extension's action button click, intelligently deciding whether to
 * inject the tool for the first time or simply un-hide the existing UI.
 */

/**
 * Injects the main toolkit script into the page.
 * @param {number} tabId - The ID of the tab to inject the script into.
 */
async function launchToolkit(tabId) {
    try {
        const response = await fetch(chrome.runtime.getURL('power-toolkit.js'));
        const scriptContent = await response.text();
        await chrome.scripting.executeScript({
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
        console.error("power-Toolkit: Failed to load or inject the main script.", e);
    }
}

/**
 * Shows a temporary error badge on the extension icon.
 * @param {number} tabId - The ID of the tab to show the feedback on.
 */
async function showInactiveError(tabId) {
    await chrome.action.setBadgeText({ tabId: tabId, text: '!' });
    await chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#f44336' });
    await chrome.action.setTitle({ tabId: tabId, title: 'Power-Toolkit: Not a valid Power Apps page.' });
    setTimeout(async () => {
        await chrome.action.setBadgeText({ tabId: tabId, text: '' });
        await chrome.action.setTitle({ tabId: tabId, title: 'Launch Power-Toolkit' });
    }, 3000);
}

/**
 * This function, when injected, first destroys any existing instance of the tool across all frames,
 * then checks if the current page is a valid host environment.
 * It will never return 'ALREADY_LOADED', forcing a fresh launch every time.
 */
function probeAndShow() {
    const SCRIPT_ID = 'power-toolkit-script-module';
    const DIALOG_SELECTOR = '.powerapps-dev-toolkit';

    // A function to clean a given window context (either the main window or an iframe).
    const cleanup = (win) => {
        try {
            win.document.querySelector(DIALOG_SELECTOR)?.remove();
            win.document.getElementById(SCRIPT_ID)?.remove();
            if (win.PDT_INITIALIZED) win.PDT_INITIALIZED = false;
        } catch (e) {
            // Fails silently on cross-origin iframes, which is expected.
        }
    };
    
    // Clean the top window and all accessible iframes.
    cleanup(window);
    for (let i = 0; i < window.frames.length; i++) {
        cleanup(window.frames[i]);
    }

    // Now, probe for a valid context.
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
 * Main listener for the extension icon click.
 */
chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.url || tab.url.startsWith('chrome://')) {
        await showInactiveError(tab.id);
        return;
    }

    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true }, // Check all frames for maker portal context
            world: 'MAIN',
            func: probeAndShow
        });

        // Find the first successful result from any frame.
        const status = results.find(r => r.result === 'ALREADY_LOADED' || r.result === 'CAN_LOAD')?.result || 'CANNOT_LOAD';

        if (status === 'ALREADY_LOADED') {
            return;
        } else if (status === 'CAN_LOAD') {
            await launchToolkit(tab.id);
        } else {
            await showInactiveError(tab.id);
        }
    } catch (e) {
        console.error(`Power-Toolkit: Could not execute script on ${tab.url}. Error: ${e.message}`);
        await showInactiveError(tab.id);
    }
});