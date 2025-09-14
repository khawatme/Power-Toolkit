/**
 * @file Abstraction layer for the Power Apps Xrm object.
 * @module services/PowerappsApiService
 * @description All interactions with the global Xrm object are handled through this service.
 * It now actively finds the correct Xrm context (even within iframes) to ensure it's
 * always interacting with the fully initialized form or view context.
 */

let _correctXrm = null;

/**
 * Finds and caches the correct Xrm object, searching through iframes if necessary.
 * The full form context often lives inside an iframe, while the top-level window
 * may only have a lightweight version of Xrm. This function ensures we always
 * use the context that contains the rich form and metadata APIs.
 * @private
 * @returns {object} The correct Xrm object with a full context.
 */
function _getCorrectXrmContext() {
    if (_correctXrm) {
        return _correctXrm;
    }

    // Heuristic: The "correct" Xrm context is the one that has form data.
    // Check the current window's Xrm object first.
    if (typeof Xrm !== 'undefined' && Xrm.Page && Xrm.Page.data) {
        _correctXrm = Xrm;
        return _correctXrm;
    }

    // If not found, search through all accessible iframes.
    for (let i = 0; i < window.frames.length; i++) {
        try {
            if (window.frames[i].Xrm && window.frames[i].Xrm.Page && window.frames[i].Xrm.Page.data) {
                _correctXrm = window.frames[i].Xrm;
                console.log("PDT: Found correct Xrm context in an iframe.");
                return _correctXrm;
            }
        } catch (e) {
            // Ignore potential cross-origin errors
        }
    }
    
    // As a fallback for non-form pages (views, dashboards), return the base Xrm object.
    console.log("PDT: No form context found, using base Xrm object.");
    _correctXrm = Xrm;
    return _correctXrm;
}

/**
 * A wrapper for the Xrm client API, providing safe access to its methods
 * by always using the correct, fully-initialized context.
 * @namespace
 */
export const PowerAppsApiService = {
    /**
     * Clears the cached Xrm context object, forcing a re-evaluation on the next call.
     */
    clearCache() {
        _correctXrm = null;
    },
    
    /**
     * A getter that dynamically checks if the full form context is available.
     * @type {boolean}
     */
    get isFormContextAvailable() {
        const x = _getCorrectXrmContext();
        return !!(x && x.Page && x.Page.data && x.Page.ui.getFormType() > 0);
    },

    // --- Form Context Methods ---
    getFormType: () => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.ui.getFormType() : 0,
    getFormId: () => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.ui.form?.getId()?.replace(/[{}]/g, '') ?? null : null,
    getEntityName: () => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.data.entity.getEntityName() : null,
    getEntityId: () => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.data.entity.getId()?.replace(/[{}]/g, '') ?? '' : '',
    getAllAttributes: () => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.data.entity.attributes.get() : [],
    getAllControls: () => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.ui.controls.get() : [],
    getAllTabs: () => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.ui.tabs.get() : [],
    refreshForm: (save) => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.data.refresh(save) : Promise.resolve(),

    // --- Event Handler Methods ---
    addOnLoad: (handler) => {
        if (PowerAppsApiService.isFormContextAvailable) {
            _getCorrectXrmContext().Page.data.addOnLoad(handler);
        }
    },
    removeOnLoad: (handler) => {
        if (PowerAppsApiService.isFormContextAvailable) {
            _getCorrectXrmContext().Page.data.removeOnLoad(handler);
        }
    },
    addOnSave: (handler) => {
        if (PowerAppsApiService.isFormContextAvailable) {
            _getCorrectXrmContext().Page.data.entity.addOnSave(handler);
        }
    },
    removeOnSave: (handler) => {
        if (PowerAppsApiService.isFormContextAvailable) {
            _getCorrectXrmContext().Page.data.entity.removeOnSave(handler);
        }
    },

    // --- Utility & Performance Methods ---
    getGlobalContext: () => _getCorrectXrmContext().Utility.getGlobalContext(),
    getPerformanceInfo: () => window.Xrm?.Performance?.getPerformanceInfo(),

    /**
     * Retrieves the form context from the correct frame.
     * @returns {object|null} The form context object or null if not available.
     */
    getFormContext() {
        try {
            return PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page : null;
        } catch (e) {
            console.error("Power-Toolkit Error: Failed to get formContext.", e);
            return null;
        }
    }
};