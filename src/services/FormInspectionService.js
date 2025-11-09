/**
 * @file Form inspection and column management service
 * @module services/FormInspectionService
 * @description Handles form hierarchy, columns, and event handler inspection
 */

import { PowerAppsApiService } from './PowerAppsApiService.js';
import { ValidationService } from './ValidationService.js';
import { formatDisplayValue } from '../helpers/index.js';
import { Config } from '../constants/index.js';

/**
 * Get form ID reliably across different Dynamics versions.
 * @private
 * @returns {string|null} Form ID without braces
 */
function _getFormIdReliably() {
    try {
        if (typeof Xrm !== 'undefined' && Xrm.Page && Xrm.Page.ui && Xrm.Page.ui.formSelector) {
            const currentItem = Xrm.Page.ui.formSelector.getCurrentItem();
            if (currentItem) {
                const formId = currentItem.getId();
                return formId ? formId.replace(/[{}]/g, '') : null;
            }
        }
        return null;
    } catch (_e) {
        return null;
    }
}

/**
 * @typedef {object} FormColumn
 * @property {string} displayName - The user-friendly label of the column
 * @property {string} logicalName - The schema name of the column
 * @property {any} value - The current value of the column on the form
 * @property {string} type - The attribute type (e.g., "string", "lookup")
 * @property {boolean} isDirty - True if the column's value has been changed
 * @property {string} requiredLevel - The required level ('none', 'required', 'recommended')
 * @property {Xrm.Attributes.Attribute} attribute - The underlying Xrm.Attribute object
 * @property {boolean} [onForm] - True if the column is present on the form
 * @property {boolean} [isSystem] - True if the column is a system-managed property
 */

export const FormInspectionService = {
    /**
     * Get the complete UI hierarchy (Tabs > Sections > Controls) from the current form.
     * @returns {Array<object>} Hierarchical form structure
     */
    getFormHierarchy() {
        const tabs = PowerAppsApiService.getAllTabs();
        if (!tabs?.length) {
            return [];
        }

        const mapControl = ctrl => {
            try {
                const controlType = ctrl.getControlType();
                let value = `[${controlType}]`;
                let editableAttr = null;

                if (ctrl.getAttribute) {
                    const attr = ctrl.getAttribute();
                    if (attr) {
                        value = attr.getValue();
                        editableAttr = attr;
                    } else {
                        value = '[No Attribute]';
                    }
                } else if (controlType.includes('subgrid')) {
                    value = `Entity: ${ctrl.getEntityName()} | Records: ${ctrl.getGrid().getTotalRecordCount()}`;
                }

                return {
                    label: ctrl.getLabel(),
                    logicalName: ctrl.getName(),
                    value,
                    editableAttr,
                    controlType
                };
            } catch (e) {
                return {
                    label: ctrl?.getName?.() || 'Errored Control',
                    logicalName: `Error: ${e.message}`,
                    value: '—'
                };
            }
        };

        const mapSection = section => ({
            label: `Section: ${section.getLabel()}`,
            logicalName: section.getName(),
            children: (section.controls?.get() || []).map(mapControl)
        });

        return tabs.map(tab => ({
            label: `Tab: ${tab.getLabel()}`,
            logicalName: tab.getName(),
            children: (tab.sections?.get?.() || []).map(mapSection)
        }));
    },

    /**
     * Get all columns present on the current form with their metadata.
     * @returns {FormColumn[]} Array of form columns
     */
    getFormColumns() {
        return PowerAppsApiService.getAllAttributes().map(attribute => {
            let displayName = attribute.getName();
            if (attribute.controls.getLength() > 0) {
                displayName = attribute.controls.get(0).getLabel();
            }

            return {
                displayName,
                logicalName: attribute.getName(),
                value: formatDisplayValue(attribute.getValue(), attribute),
                type: attribute.getAttributeType(),
                isDirty: attribute.getIsDirty(),
                requiredLevel: attribute.getRequiredLevel(),
                attribute
            };
        });
    },

    /**
     * Get all record columns by merging form attributes with full record data.
     * @param {Function} retrieveRecord - DataService retrieve function
     * @param {Function} getFormColumns - Form columns getter
     * @param {Function} isOdataProperty - Helper to identify OData properties
     * @param {Function} loadMetadata - Metadata service function to ensure metadata is loaded
     * @param {Function} getEntitySetName - Metadata service function to convert logical name to entity set name
     * @returns {Promise<FormColumn[]>} All columns with metadata
     */
    async getAllRecordColumns(retrieveRecord, getFormColumns, isOdataProperty, loadMetadata, getEntitySetName) {
        const entityLogicalName = PowerAppsApiService.getEntityName();
        const entityId = PowerAppsApiService.getEntityId();

        if (!entityId) {
            return getFormColumns();
        }

        // Ensure metadata is loaded before converting entity names
        await loadMetadata();

        // Convert logical name to entity set name for Web API
        const entitySetName = getEntitySetName(entityLogicalName) || entityLogicalName;

        const [formData, recordData] = await Promise.all([
            Promise.resolve(getFormColumns()),
            retrieveRecord(entitySetName, entityId)
        ]);

        const formColumnMap = new Map(formData.map(c => [c.logicalName, c]));
        const allColumns = [];

        // Process all record properties
        for (const key in recordData) {
            const isSystem = isOdataProperty(key);
            const formColumn = formColumnMap.get(key);

            if (formColumn) {
                allColumns.push({ ...formColumn, onForm: true, isSystem });
                formColumnMap.delete(key);
            } else {
                allColumns.push({
                    displayName: key,
                    logicalName: key,
                    value: formatDisplayValue(recordData[key]),
                    type: typeof recordData[key],
                    isDirty: false,
                    requiredLevel: 'none',
                    attribute: null,
                    onForm: false,
                    isSystem
                });
            }
        }

        // Add remaining form columns not in record data
        for (const formColumn of formColumnMap.values()) {
            allColumns.push({ ...formColumn, onForm: true, isSystem: false });
        }

        return allColumns;
    },

    /**
     * Get event handlers (OnLoad, OnSave) from current form's XML.
     * @param {Function} webApiFetch - DataService web API fetch function
     * @returns {Promise<{OnLoad: Array, OnSave: Array}>} Event handlers
     */
    async getFormEventHandlers(webApiFetch) {
        const formId = _getFormIdReliably();
        ValidationService.validateRequired(formId, 'Form ID', Config.VALIDATION_ERRORS.formIdNotFound);

        const formXmlResult = await webApiFetch('GET', `systemforms(${formId})`, '?$select=formxml');
        ValidationService.validateRequired(
            formXmlResult?.formxml,
            'formxml',
            "Retrieved form data but it did not contain a 'formxml' definition."
        );

        const xmlDoc = new DOMParser().parseFromString(formXmlResult.formxml, 'text/xml');
        const automations = { OnLoad: [], OnSave: [] };

        xmlDoc.querySelectorAll('form > events > event').forEach(node => {
            const eventName = node.getAttribute('name');
            const handlers = Array.from(node.querySelectorAll('Handler')).map(h => ({
                library: h.getAttribute('libraryName'),
                function: h.getAttribute('functionName'),
                enabled: h.getAttribute('enabled') === 'true'
            }));

            if (eventName === 'onload') {
                automations.OnLoad.push(...handlers);
            }
            if (eventName === 'onsave') {
                automations.OnSave.push(...handlers);
            }
        });

        return automations;
    },

    /**
     * Get form event handlers for a specific entity (not current form).
     * @param {Function} retrieveMultipleRecords - DataService retrieve multiple function
     * @param {Function} retrieveRecord - DataService retrieve function
     * @param {string} entityName - Entity logical name
     * @returns {Promise<{OnLoad: Array, OnSave: Array}|null>} Event handlers or null
     */
    async getFormEventHandlersForEntity(retrieveMultipleRecords, retrieveRecord, entityName) {
        if (!entityName) {
            return null;
        }

        // Get main form for entity
        const formQueryOptions = `?$filter=objecttypecode eq '${entityName}' and type eq 2&$select=formid&$top=1`;
        const formResult = await retrieveMultipleRecords('systemform', formQueryOptions);

        if (!formResult?.entities?.length) {
            return null;
        }

        const formId = formResult.entities[0].formid;
        const formRecord = await retrieveRecord('systemform', formId, '?$select=formxml');

        if (!formRecord?.formxml) {
            return null;
        }

        const xmlDoc = new DOMParser().parseFromString(formRecord.formxml, 'text/xml');
        const automations = { OnLoad: [], OnSave: [] };

        xmlDoc.querySelectorAll('form > events > event').forEach(node => {
            const eventName = node.getAttribute('name');
            const handlers = Array.from(node.querySelectorAll('Handler')).map(h => ({
                library: h.getAttribute('libraryName'),
                function: h.getAttribute('functionName'),
                enabled: h.getAttribute('enabled') === 'true'
            }));

            if (eventName === 'onload') {
                automations.OnLoad.push(...handlers);
            }
            if (eventName === 'onsave') {
                automations.OnSave.push(...handlers);
            }
        });

        return automations;
    },

    /**
     * Get performance metrics for current form load.
     * @returns {object} Performance details
     */
    getPerformanceDetails() {
        const perfInfo = PowerAppsApiService.getPerformanceInfo();
        const details = {
            totalLoadTime: 'N/A',
            isApiAvailable: false,
            breakdown: { network: 0, server: 0, client: 0 }
        };

        if (perfInfo?.FCL) {
            const totalLoad = perfInfo.FCL;
            const network = perfInfo.Network || 0;
            const server = perfInfo.Server || 0;

            details.isApiAvailable = true;
            details.totalLoadTime = totalLoad.toFixed(0);
            details.breakdown = {
                network,
                server,
                client: Math.max(0, totalLoad - network - server)
            };
        } else if (window.performance?.getEntriesByType) {
            const navEntry = window.performance.getEntriesByType('navigation')[0];
            if (navEntry) {
                details.totalLoadTime = (navEntry.loadEventEnd - navEntry.startTime).toFixed(0);
            }
        }

        const allTabs = PowerAppsApiService.getAllTabs();
        details.uiCounts = {
            tabs: allTabs.length,
            sections: allTabs.reduce((acc, tab) => acc + (tab.sections?.get?.().length || 0), 0),
            controls: PowerAppsApiService.getAllControls().length,
            onChange: PowerAppsApiService.getAllAttributes().reduce(
                (acc, attr) => acc + (attr.getOnChange?.().length || 0), 0
            )
        };

        return details;
    }
};
