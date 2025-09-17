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

    /**
     * Gets the form type for the current page.
     * @returns {number} The form type (e.g., 2 for Update, 1 for Create), or 0 if not on a form.
     */
    getFormType: () => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.ui.getFormType() : 0,
    
    /**
     * Gets the GUID of the current form definition.
     * @returns {string|null} The form's GUID, or null if not on a form.
     */
    getFormId: () => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.ui.form?.getId()?.replace(/[{}]/g, '') ?? null : null,
    
    /**
     * Gets the logical name of the table for the current form.
     * @returns {string|null} The entity's logical name, or null if not on a form.
     */
    getEntityName: () => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.data.entity.getEntityName() : null,
    
    /**
     * Gets the GUID of the record currently displayed on the form.
     * @returns {string} The record's GUID, or an empty string if on a new record form.
     */
    getEntityId: () => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.data.entity.getId()?.replace(/[{}]/g, '') ?? '' : '',
    
    /**
     * Gets all attribute objects from the current form.
     * @returns {Xrm.Attributes.Attribute[]} An array of all attribute objects, or an empty array if not on a form.
     */
    getAllAttributes: () => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.data.entity.attributes.get() : [],
    
    /**
     * Gets all control objects from the current form.
     * @returns {Xrm.Controls.Control[]} An array of all control objects, or an empty array if not on a form.
     */
    getAllControls: () => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.ui.controls.get() : [],
    
    /**
     * Gets all tab objects from the current form.
     * @returns {Xrm.Controls.Tab[]} An array of all tab objects, or an empty array if not on a form.
     */
    getAllTabs: () => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.ui.tabs.get() : [],
    
    /**
     * Refreshes the form data, optionally saving changes first.
     * @param {boolean} save - True to save dirty data before refreshing.
     * @returns {Promise<void>} A promise that resolves when the refresh is complete.
     */
    refreshForm: (save) => PowerAppsApiService.isFormContextAvailable ? _getCorrectXrmContext().Page.data.refresh(save) : Promise.resolve(),

    /**
     * Adds a handler to the form's OnLoad event.
     * @param {(context: Xrm.Events.EventContext) => void} handler - The function to add.
     * @returns {void}
     */
    addOnLoad: (handler) => {
        if (PowerAppsApiService.isFormContextAvailable) {
            _getCorrectXrmContext().Page.data.addOnLoad(handler);
        }
    },
    
    /**
     * Removes a handler from the form's OnLoad event.
     * @param {(context: Xrm.Events.EventContext) => void} handler - The function to remove.
     * @returns {void}
     */
    removeOnLoad: (handler) => {
        if (PowerAppsApiService.isFormContextAvailable) {
            _getCorrectXrmContext().Page.data.removeOnLoad(handler);
        }
    },
    
    /**
     * Adds a handler to the form's OnSave event.
     * @param {(context: Xrm.Events.SaveEventContext) => void} handler - The function to add.
     * @returns {void}
     */
    addOnSave: (handler) => {
        if (PowerAppsApiService.isFormContextAvailable) {
            _getCorrectXrmContext().Page.data.entity.addOnSave(handler);
        }
    },
    
    /**
     * Removes a handler from the form's OnSave event.
     * @param {(context: Xrm.Events.SaveEventContext) => void} handler - The function to remove.
     * @returns {void}
     */
    removeOnSave: (handler) => {
        if (PowerAppsApiService.isFormContextAvailable) {
            _getCorrectXrmContext().Page.data.entity.removeOnSave(handler);
        }
    },

    /**
     * Gets the global context object, which contains user, client, and organization details.
     * @returns {Xrm.GlobalContext} The global context.
     */
    getGlobalContext: () => _getCorrectXrmContext().Utility.getGlobalContext(),
    
    /**
     * Gets the performance timing information for the current page load.
     * @returns {object|null} The performance information object, or null if the API is not available.
     */
    getPerformanceInfo: () => window.Xrm?.Performance?.getPerformanceInfo(),
    
    /**
     * Gets the metadata for a specific table.
     * @param {string} entityName - The logical name of the table.
     * @returns {Promise<object>} A promise that resolves with the entity metadata object.
     */
    getEntityMetadata: (entityName) => _getCorrectXrmContext().Utility.getEntityMetadata(entityName, []),

    /**
     * Gets the complete form context (`Xrm.Page`) object.
     * @returns {Xrm.Page|null} The form context object, or null if not available.
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