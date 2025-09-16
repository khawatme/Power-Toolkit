/**
 * @file Abstraction layer for the Power Apps Xrm object.
 * @module services/PowerappsApiService
 * @description All interactions with the global Xrm object are handled through this service.
 * It now actively finds the correct Xrm context on every call to ensure it's
 * always interacting with the fully initialized form or view context.
 */

/**
 * Finds the correct Xrm object, searching through iframes if necessary.
 * This function is called frequently to ensure the context is always fresh,
 * as the user can navigate between views and forms.
 * @private
 * @returns {object} The correct Xrm object with a full context.
 */
function _getCorrectXrmContext() {
    // Heuristic: The "correct" Xrm context is the one that has form data.
    // Check the current window's Xrm object first.
    if (typeof Xrm !== 'undefined' && Xrm.Page && Xrm.Page.data) {
        return Xrm;
    }

    // If not found, search through all accessible iframes.
    for (let i = 0; i < window.frames.length; i++) {
        try {
            if (window.frames[i].Xrm && window.frames[i].Xrm.Page && window.frames[i].Xrm.Page.data) {
                return window.frames[i].Xrm;
            }
        } catch (e) {
            // Ignore potential cross-origin errors
        }
    }
    
    // As a fallback for non-form pages (views, dashboards), return the base Xrm object.
    return Xrm;
}

/**
 * A wrapper for the Xrm client API, providing safe access to its methods
 * by always using the correct, fully-initialized context.
 * @namespace PowerAppsApiService
 */
export const PowerAppsApiService = {
    /**
     * A getter that dynamically checks if the full form context is available.
     * @type {boolean}
     */
    get isFormContextAvailable() {
        try {
            const x = _getCorrectXrmContext();
            return !!(x && x.Page && x.Page.data && x.Page.ui && x.Page.ui.getFormType() > 0);
        } catch (e) {
            return false;
        }
    },

    // --- All other methods remain the same but now use the dynamic _getCorrectXrmContext() ---
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

    getGlobalContext: () => _getCorrectXrmContext().Utility.getGlobalContext(),
    getPerformanceInfo: () => window.Xrm?.Performance?.getPerformanceInfo(),
    getEntityMetadata: (entityName) => _getCorrectXrmContext().Utility.getEntityMetadata(entityName, []),

    getFormContext() {
        try {
            return PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page : null;
        } catch (e) {
            console.error("Power-Toolkit Error: Failed to get formContext.", e);
            return null;
        }
    }
};