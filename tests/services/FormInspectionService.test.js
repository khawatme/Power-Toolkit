/**
 * @file Comprehensive Tests for FormInspectionService
 * @module tests/services/FormInspectionService.test.js
 * @description Tests for form hierarchy, columns, and event handler inspection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies first
vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        getAllTabs: vi.fn(() => []),
        getAllAttributes: vi.fn(() => []),
        getAllControls: vi.fn(() => []),
        getFormType: vi.fn(() => 1),
        getEntityName: vi.fn(() => 'account'),
        getEntityId: vi.fn(() => '12345678-1234-1234-1234-123456789012'),
        getPerformanceInfo: vi.fn(() => null)
    }
}));

vi.mock('../../src/services/ValidationService.js', () => ({
    ValidationService: {
        validateRequired: vi.fn((value, name, error) => {
            if (!value) throw new Error(error || `${name} is required`);
        })
    }
}));

vi.mock('../../src/helpers/index.js', () => ({
    formatDisplayValue: vi.fn((value) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }),
    inferDataverseType: vi.fn((value, propertyName) => {
        if (value === null || value === undefined) return 'unknown';
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'decimal';
        if (typeof value === 'string') return 'string';
        if (Array.isArray(value)) return 'array';
        return 'object';
    })
}));

vi.mock('../../src/constants/index.js', () => ({
    Config: {
        VALIDATION_ERRORS: {
            formIdNotFound: 'Form ID not found'
        }
    }
}));

// Import after mocks
import { FormInspectionService } from '../../src/services/FormInspectionService.js';
import { PowerAppsApiService } from '../../src/services/PowerAppsApiService.js';
import { ValidationService } from '../../src/services/ValidationService.js';

describe('FormInspectionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Reset Xrm mock to minimal state (don't set undefined - setup.js needs it)
        global.Xrm = {
            Page: null
        };
    });

    describe('getFormHierarchy', () => {
        it('should return empty array when no tabs', () => {
            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue([]);

            const result = FormInspectionService.getFormHierarchy();

            expect(result).toEqual([]);
        });

        it('should return empty array when tabs is falsy', () => {
            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue(null);

            const result = FormInspectionService.getFormHierarchy();

            expect(result).toEqual([]);
        });

        it('should map tabs to hierarchy structure', () => {
            const mockSection = {
                getLabel: vi.fn(() => 'Details'),
                getName: vi.fn(() => 'section_details'),
                controls: {
                    get: vi.fn(() => [])
                }
            };

            const mockTab = {
                getName: vi.fn(() => 'tab_general'),
                getLabel: vi.fn(() => 'General'),
                sections: {
                    get: vi.fn(() => [mockSection])
                }
            };

            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue([mockTab]);

            const result = FormInspectionService.getFormHierarchy();

            expect(result).toHaveLength(1);
            expect(result[0].label).toBe('Tab: General');
            expect(result[0].logicalName).toBe('tab_general');
            expect(result[0].children).toHaveLength(1);
            expect(result[0].children[0].label).toBe('Section: Details');
        });

        it('should map controls within sections', () => {
            const mockControl = {
                getName: vi.fn(() => 'name'),
                getLabel: vi.fn(() => 'Account Name'),
                getControlType: vi.fn(() => 'standard'),
                getAttribute: vi.fn(() => ({
                    getValue: vi.fn(() => 'Contoso')
                }))
            };

            const mockSection = {
                getLabel: vi.fn(() => 'Details'),
                getName: vi.fn(() => 'section_details'),
                controls: {
                    get: vi.fn(() => [mockControl])
                }
            };

            const mockTab = {
                getName: vi.fn(() => 'tab_general'),
                getLabel: vi.fn(() => 'General'),
                sections: {
                    get: vi.fn(() => [mockSection])
                }
            };

            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue([mockTab]);

            const result = FormInspectionService.getFormHierarchy();

            expect(result[0].children[0].children).toHaveLength(1);
            expect(result[0].children[0].children[0].label).toBe('Account Name');
            expect(result[0].children[0].children[0].logicalName).toBe('name');
            expect(result[0].children[0].children[0].value).toBe('Contoso');
        });

        it('should handle controls without getAttribute method', () => {
            const mockControl = {
                getName: vi.fn(() => 'webresource'),
                getLabel: vi.fn(() => 'Web Resource'),
                getControlType: vi.fn(() => 'webresource')
                // No getAttribute method
            };

            const mockSection = {
                getLabel: vi.fn(() => 'Resources'),
                getName: vi.fn(() => 'section_resources'),
                controls: { get: vi.fn(() => [mockControl]) }
            };

            const mockTab = {
                getName: vi.fn(() => 'tab_general'),
                getLabel: vi.fn(() => 'General'),
                sections: { get: vi.fn(() => [mockSection]) }
            };

            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue([mockTab]);

            const result = FormInspectionService.getFormHierarchy();

            expect(result[0].children[0].children[0].value).toBe('[webresource]');
        });

        it('should handle subgrid controls', () => {
            const mockControl = {
                getName: vi.fn(() => 'contacts_subgrid'),
                getLabel: vi.fn(() => 'Contacts'),
                getControlType: vi.fn(() => 'subgrid'),
                getEntityName: vi.fn(() => 'contact'),
                getGrid: vi.fn(() => ({
                    getTotalRecordCount: vi.fn(() => 5)
                }))
            };

            const mockSection = {
                getLabel: vi.fn(() => 'Related'),
                getName: vi.fn(() => 'section_related'),
                controls: { get: vi.fn(() => [mockControl]) }
            };

            const mockTab = {
                getName: vi.fn(() => 'tab_related'),
                getLabel: vi.fn(() => 'Related'),
                sections: { get: vi.fn(() => [mockSection]) }
            };

            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue([mockTab]);

            const result = FormInspectionService.getFormHierarchy();

            expect(result[0].children[0].children[0].value).toBe('Entity: contact | Records: 5');
        });

        it('should handle control with getAttribute returning null', () => {
            const mockControl = {
                getName: vi.fn(() => 'composite_control'),
                getLabel: vi.fn(() => 'Composite'),
                getControlType: vi.fn(() => 'composite'),
                getAttribute: vi.fn(() => null)
            };

            const mockSection = {
                getLabel: vi.fn(() => 'Info'),
                getName: vi.fn(() => 'section_info'),
                controls: { get: vi.fn(() => [mockControl]) }
            };

            const mockTab = {
                getName: vi.fn(() => 'tab_main'),
                getLabel: vi.fn(() => 'Main'),
                sections: { get: vi.fn(() => [mockSection]) }
            };

            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue([mockTab]);

            const result = FormInspectionService.getFormHierarchy();

            expect(result[0].children[0].children[0].value).toBe('[No Attribute]');
        });

        it('should handle control errors gracefully', () => {
            const mockControl = {
                getName: vi.fn(() => 'broken_control'),
                getLabel: vi.fn(() => { throw new Error('Control error'); }),
                getControlType: vi.fn(() => { throw new Error('Control error'); })
            };

            const mockSection = {
                getLabel: vi.fn(() => 'Section'),
                getName: vi.fn(() => 'section'),
                controls: { get: vi.fn(() => [mockControl]) }
            };

            const mockTab = {
                getName: vi.fn(() => 'tab'),
                getLabel: vi.fn(() => 'Tab'),
                sections: { get: vi.fn(() => [mockSection]) }
            };

            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue([mockTab]);

            const result = FormInspectionService.getFormHierarchy();

            expect(result[0].children[0].children[0].logicalName).toContain('Error:');
        });
    });

    describe('getFormColumns', () => {
        it('should return form columns with metadata', () => {
            const mockAttribute = {
                getName: vi.fn(() => 'name'),
                getAttributeType: vi.fn(() => 'string'),
                getValue: vi.fn(() => 'Test Account'),
                getIsDirty: vi.fn(() => false),
                getRequiredLevel: vi.fn(() => 'none'),
                controls: {
                    getLength: vi.fn(() => 1),
                    get: vi.fn(() => ({
                        getLabel: vi.fn(() => 'Account Name')
                    }))
                }
            };

            vi.spyOn(PowerAppsApiService, 'getAllAttributes').mockReturnValue([mockAttribute]);

            const result = FormInspectionService.getFormColumns();

            expect(result).toHaveLength(1);
            expect(result[0].displayName).toBe('Account Name');
            expect(result[0].logicalName).toBe('name');
            expect(result[0].type).toBe('string');
            expect(result[0].isDirty).toBe(false);
            expect(result[0].requiredLevel).toBe('none');
            expect(result[0].attribute).toBe(mockAttribute);
        });

        it('should use logical name as display name when no control label', () => {
            const mockAttribute = {
                getName: vi.fn(() => 'customfield'),
                getAttributeType: vi.fn(() => 'string'),
                getValue: vi.fn(() => 'value'),
                getIsDirty: vi.fn(() => false),
                getRequiredLevel: vi.fn(() => 'none'),
                controls: {
                    getLength: vi.fn(() => 0),
                    get: vi.fn(() => null)
                }
            };

            vi.spyOn(PowerAppsApiService, 'getAllAttributes').mockReturnValue([mockAttribute]);

            const result = FormInspectionService.getFormColumns();

            expect(result[0].displayName).toBe('customfield');
        });

        it('should handle empty attributes', () => {
            vi.spyOn(PowerAppsApiService, 'getAllAttributes').mockReturnValue([]);

            const result = FormInspectionService.getFormColumns();

            expect(result).toEqual([]);
        });

        it('should skip attributes that throw during processing', () => {
            const badAttribute = {
                getName: vi.fn(() => { throw new Error('Internal Xrm error'); })
            };
            const goodAttribute = {
                getName: vi.fn(() => 'safefield'),
                getAttributeType: vi.fn(() => 'string'),
                getValue: vi.fn(() => 'ok'),
                getIsDirty: vi.fn(() => false),
                getRequiredLevel: vi.fn(() => 'none'),
                controls: { getLength: vi.fn(() => 0) }
            };

            vi.spyOn(PowerAppsApiService, 'getAllAttributes').mockReturnValue([badAttribute, goodAttribute]);

            const result = FormInspectionService.getFormColumns();

            expect(result).toHaveLength(1);
            expect(result[0].logicalName).toBe('safefield');
        });

        it('should handle attributes with undefined controls', () => {
            const mockAttribute = {
                getName: vi.fn(() => 'nocontrols'),
                getAttributeType: vi.fn(() => 'string'),
                getValue: vi.fn(() => 'value'),
                getIsDirty: vi.fn(() => false),
                getRequiredLevel: vi.fn(() => 'none'),
                controls: undefined
            };

            vi.spyOn(PowerAppsApiService, 'getAllAttributes').mockReturnValue([mockAttribute]);

            const result = FormInspectionService.getFormColumns();

            expect(result).toHaveLength(1);
            expect(result[0].displayName).toBe('nocontrols');
            expect(result[0].logicalName).toBe('nocontrols');
        });

        it('should handle attributes with null controls', () => {
            const mockAttribute = {
                getName: vi.fn(() => 'nullcontrols'),
                getAttributeType: vi.fn(() => 'string'),
                getValue: vi.fn(() => 'value'),
                getIsDirty: vi.fn(() => false),
                getRequiredLevel: vi.fn(() => 'none'),
                controls: null
            };

            vi.spyOn(PowerAppsApiService, 'getAllAttributes').mockReturnValue([mockAttribute]);

            const result = FormInspectionService.getFormColumns();

            expect(result).toHaveLength(1);
            expect(result[0].displayName).toBe('nullcontrols');
        });

        it('should return dirty status for modified fields', () => {
            const mockAttribute = {
                getName: vi.fn(() => 'modifiedfield'),
                getAttributeType: vi.fn(() => 'string'),
                getValue: vi.fn(() => 'Modified Value'),
                getIsDirty: vi.fn(() => true),
                getRequiredLevel: vi.fn(() => 'required'),
                controls: { getLength: vi.fn(() => 0) }
            };

            vi.spyOn(PowerAppsApiService, 'getAllAttributes').mockReturnValue([mockAttribute]);

            const result = FormInspectionService.getFormColumns();

            expect(result[0].isDirty).toBe(true);
            expect(result[0].requiredLevel).toBe('required');
        });
    });

    describe('getAllRecordColumns', () => {
        it('should merge form columns with record data', async () => {
            const mockFormColumn = {
                displayName: 'Name',
                logicalName: 'name',
                value: 'Test',
                type: 'string',
                isDirty: false,
                requiredLevel: 'none',
                attribute: {}
            };

            const mockRecordData = {
                name: 'Test',
                createdon: '2024-01-01',
                '@odata.type': '#account'
            };

            const retrieveRecord = vi.fn().mockResolvedValue(mockRecordData);
            const getFormColumns = vi.fn().mockReturnValue([mockFormColumn]);
            const isOdataProperty = vi.fn((key) => key.startsWith('@'));
            const loadMetadata = vi.fn().mockResolvedValue();
            const getEntitySetName = vi.fn(() => 'accounts');
            const getAttributeDefinitions = vi.fn().mockResolvedValue([]);

            vi.spyOn(PowerAppsApiService, 'getEntityId').mockReturnValue('12345');

            const result = await FormInspectionService.getAllRecordColumns(
                retrieveRecord, getFormColumns, isOdataProperty, loadMetadata, getEntitySetName, getAttributeDefinitions
            );

            expect(result.length).toBeGreaterThan(0);
            expect(loadMetadata).toHaveBeenCalled();
            expect(getEntitySetName).toHaveBeenCalledWith('account');
        });

        it('should return form columns when no entity ID', async () => {
            const mockFormColumn = { displayName: 'Name', logicalName: 'name' };

            const getFormColumns = vi.fn().mockReturnValue([mockFormColumn]);

            vi.spyOn(PowerAppsApiService, 'getEntityId').mockReturnValue(null);

            const result = await FormInspectionService.getAllRecordColumns(
                vi.fn(), getFormColumns, vi.fn(), vi.fn(), vi.fn(), vi.fn()
            );

            expect(result).toEqual([mockFormColumn]);
            expect(getFormColumns).toHaveBeenCalled();
        });

        it('should mark OData properties as system', async () => {
            const mockFormColumn = {
                displayName: 'Name',
                logicalName: 'name',
                value: 'Test',
                type: 'string',
                isDirty: false,
                requiredLevel: 'none',
                attribute: {}
            };

            const mockRecordData = {
                name: 'Test',
                '@odata.context': 'https://org.crm.dynamics.com/$metadata#accounts'
            };

            const retrieveRecord = vi.fn().mockResolvedValue(mockRecordData);
            const getFormColumns = vi.fn().mockReturnValue([mockFormColumn]);
            const isOdataProperty = vi.fn((key) => key.startsWith('@'));
            const loadMetadata = vi.fn().mockResolvedValue();
            const getEntitySetName = vi.fn(() => 'accounts');
            const getAttributeDefinitions = vi.fn().mockResolvedValue([]);

            vi.spyOn(PowerAppsApiService, 'getEntityId').mockReturnValue('12345');

            const result = await FormInspectionService.getAllRecordColumns(
                retrieveRecord, getFormColumns, isOdataProperty, loadMetadata, getEntitySetName, getAttributeDefinitions
            );

            const odataColumn = result.find(c => c.logicalName === '@odata.context');
            expect(odataColumn).toBeDefined();
            expect(odataColumn.isSystem).toBe(true);
        });

        it('should add columns not on form with onForm: false', async () => {
            const mockRecordData = {
                hiddenfield: 'secret value'
            };

            const retrieveRecord = vi.fn().mockResolvedValue(mockRecordData);
            const getFormColumns = vi.fn().mockReturnValue([]);
            const isOdataProperty = vi.fn(() => false);
            const loadMetadata = vi.fn().mockResolvedValue();
            const getEntitySetName = vi.fn(() => 'accounts');
            const getAttributeDefinitions = vi.fn().mockResolvedValue([]);

            vi.spyOn(PowerAppsApiService, 'getEntityId').mockReturnValue('12345');

            const result = await FormInspectionService.getAllRecordColumns(
                retrieveRecord, getFormColumns, isOdataProperty, loadMetadata, getEntitySetName, getAttributeDefinitions
            );

            const hiddenColumn = result.find(c => c.logicalName === 'hiddenfield');
            expect(hiddenColumn).toBeDefined();
            expect(hiddenColumn.onForm).toBe(false);
        });
    });

    describe('getFormEventHandlers', () => {
        beforeEach(() => {
            // Mock Xrm for form ID retrieval
            global.Xrm = {
                Page: {
                    ui: {
                        formSelector: {
                            getCurrentItem: vi.fn(() => ({
                                getId: vi.fn(() => '{12345678-1234-1234-1234-123456789012}')
                            }))
                        }
                    }
                }
            };
        });

        it('should parse form event handlers from XML', async () => {
            const formXml = `
                <form>
                    <events>
                        <event name="onload">
                            <Handler libraryName="my_script.js" functionName="onLoad" enabled="true"/>
                        </event>
                        <event name="onsave">
                            <Handler libraryName="my_script.js" functionName="onSave" enabled="true"/>
                        </event>
                    </events>
                </form>
            `;

            const webApiFetch = vi.fn().mockResolvedValue({ formxml: formXml });

            const result = await FormInspectionService.getFormEventHandlers(webApiFetch);

            expect(result.OnLoad).toHaveLength(1);
            expect(result.OnLoad[0].library).toBe('my_script.js');
            expect(result.OnLoad[0].function).toBe('onLoad');
            expect(result.OnLoad[0].enabled).toBe(true);
            expect(result.OnSave).toHaveLength(1);
        });

        it('should return empty arrays when no event handlers', async () => {
            const formXml = '<form><events></events></form>';
            const webApiFetch = vi.fn().mockResolvedValue({ formxml: formXml });

            const result = await FormInspectionService.getFormEventHandlers(webApiFetch);

            expect(result.OnLoad).toEqual([]);
            expect(result.OnSave).toEqual([]);
        });

        it('should handle disabled handlers', async () => {
            const formXml = `
                <form>
                    <events>
                        <event name="onload">
                            <Handler libraryName="lib.js" functionName="disabled_fn" enabled="false"/>
                        </event>
                    </events>
                </form>
            `;

            const webApiFetch = vi.fn().mockResolvedValue({ formxml: formXml });

            const result = await FormInspectionService.getFormEventHandlers(webApiFetch);

            expect(result.OnLoad[0].enabled).toBe(false);
        });

        it('should throw when form ID not found', async () => {
            // Set Xrm.Page to null to simulate no form context
            global.Xrm = { Page: null };

            // Make ValidationService.validateRequired actually throw
            vi.mocked(ValidationService.validateRequired).mockImplementation((value, name, error) => {
                if (!value) throw new Error(error);
            });

            const webApiFetch = vi.fn();

            await expect(FormInspectionService.getFormEventHandlers(webApiFetch))
                .rejects.toThrow('Form ID not found');
        });
    });

    describe('getFormEventHandlersForEntity', () => {
        it('should retrieve event handlers for a specific entity', async () => {
            const formXml = `
                <form>
                    <events>
                        <event name="onload">
                            <Handler libraryName="entity_script.js" functionName="entityOnLoad" enabled="true"/>
                        </event>
                    </events>
                </form>
            `;

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-id-123', formxml: formXml }]
            });
            const retrieveRecord = vi.fn();

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, retrieveRecord, 'account'
            );

            expect(result.OnLoad).toHaveLength(1);
            expect(result.OnLoad[0].function).toBe('entityOnLoad');
        });

        it('should return null when no entity name provided', async () => {
            const result = await FormInspectionService.getFormEventHandlersForEntity(
                vi.fn(), vi.fn(), ''
            );

            expect(result).toBeNull();
        });

        it('should return null when no forms found for entity', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({ entities: [] });

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, vi.fn(), 'customentity'
            );

            expect(result).toBeNull();
        });

        it('should return empty automations when form has no formxml or formjson', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-id-123', formxml: null, formjson: null }]
            });
            const retrieveRecord = vi.fn();

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, retrieveRecord, 'account'
            );

            expect(result).not.toBeNull();
            expect(result.OnLoad).toEqual([]);
            expect(result.OnSave).toEqual([]);
        });
    });

    describe('getPerformanceDetails', () => {
        it('should return performance info from Power Apps API', () => {
            vi.spyOn(PowerAppsApiService, 'getPerformanceInfo').mockReturnValue({
                FCL: 1500,
                Network: 300,
                Server: 200
            });
            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue([]);
            vi.spyOn(PowerAppsApiService, 'getAllControls').mockReturnValue([]);
            vi.spyOn(PowerAppsApiService, 'getAllAttributes').mockReturnValue([]);

            const result = FormInspectionService.getPerformanceDetails();

            expect(result.isApiAvailable).toBe(true);
            expect(result.totalLoadTime).toBe('1500');
            expect(result.breakdown.network).toBe(300);
            expect(result.breakdown.server).toBe(200);
            expect(result.breakdown.client).toBe(1000); // 1500 - 300 - 200
        });

        it('should fall back to Navigation Timing API when FCL not available', () => {
            vi.spyOn(PowerAppsApiService, 'getPerformanceInfo').mockReturnValue(null);
            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue([]);
            vi.spyOn(PowerAppsApiService, 'getAllControls').mockReturnValue([]);
            vi.spyOn(PowerAppsApiService, 'getAllAttributes').mockReturnValue([]);

            // Mock window.performance
            global.performance = {
                getEntriesByType: vi.fn(() => [{
                    startTime: 0,
                    loadEventEnd: 2000
                }])
            };

            const result = FormInspectionService.getPerformanceDetails();

            expect(result.isApiAvailable).toBe(false);
            expect(result.totalLoadTime).toBe('2000');
        });

        it('should return N/A when no performance info available', () => {
            vi.spyOn(PowerAppsApiService, 'getPerformanceInfo').mockReturnValue(null);
            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue([]);
            vi.spyOn(PowerAppsApiService, 'getAllControls').mockReturnValue([]);
            vi.spyOn(PowerAppsApiService, 'getAllAttributes').mockReturnValue([]);

            global.performance = {
                getEntriesByType: vi.fn(() => [])
            };

            const result = FormInspectionService.getPerformanceDetails();

            expect(result.totalLoadTime).toBe('N/A');
        });

        it('should count UI elements', () => {
            const mockSection = {
                getLabel: vi.fn(() => 'Section'),
                getName: vi.fn(() => 'section'),
                controls: { get: vi.fn(() => []) }
            };

            const mockTab = {
                getName: vi.fn(() => 'tab'),
                getLabel: vi.fn(() => 'Tab'),
                sections: { get: vi.fn(() => [mockSection, mockSection]) }
            };

            const mockAttribute = {
                getOnChange: vi.fn(() => [() => { }])
            };

            vi.spyOn(PowerAppsApiService, 'getPerformanceInfo').mockReturnValue(null);
            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue([mockTab, mockTab]);
            vi.spyOn(PowerAppsApiService, 'getAllControls').mockReturnValue([{}, {}, {}]);
            vi.spyOn(PowerAppsApiService, 'getAllAttributes').mockReturnValue([mockAttribute]);

            global.performance = { getEntriesByType: vi.fn(() => []) };

            const result = FormInspectionService.getPerformanceDetails();

            expect(result.uiCounts.tabs).toBe(2);
            expect(result.uiCounts.sections).toBe(4); // 2 tabs * 2 sections each
            expect(result.uiCounts.controls).toBe(3);
            expect(result.uiCounts.onChange).toBe(1);
        });
    });

    describe('getPerformanceDetails composition snapshot', () => {
        /**
         * Builds a mock control.
         * @param {string} type - The value getControlType returns.
         * @returns {object} A control stub.
         */
        const control = (type) => ({ getControlType: vi.fn(() => type) });

        /**
         * Builds a mock tab.
         * @param {object} config - Tab configuration.
         * @param {string} config.name - Tab name.
         * @param {string} [config.label] - Tab label.
         * @param {string} [config.displayState] - 'expanded' or 'collapsed'.
         * @param {boolean} [config.visible] - Tab visibility.
         * @param {object[]} [config.controls] - Controls on the tab.
         * @returns {object} A tab stub.
         */
        const tab = ({ name, label = name, displayState = 'expanded', visible = true, controls = [] }) => ({
            getName: vi.fn(() => name),
            getLabel: vi.fn(() => label),
            getVisible: vi.fn(() => visible),
            getDisplayState: vi.fn(() => displayState),
            sections: { get: vi.fn(() => [{ controls: { get: vi.fn(() => controls) } }]) }
        });

        /**
         * Wires the Xrm stubs and runs the snapshot.
         * @param {object[]} tabs - Tab stubs.
         * @param {object[]} [allControls] - What getAllControls returns.
         * @returns {object} The performance details.
         */
        const snapshot = (tabs, allControls = []) => {
            vi.spyOn(PowerAppsApiService, 'getPerformanceInfo').mockReturnValue(null);
            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue(tabs);
            vi.spyOn(PowerAppsApiService, 'getAllControls').mockReturnValue(allControls);
            vi.spyOn(PowerAppsApiService, 'getAllAttributes').mockReturnValue([]);
            global.performance = { getEntriesByType: vi.fn(() => []) };
            return FormInspectionService.getPerformanceDetails();
        };

        it('should count columns from bound attributes, not from controls', () => {
            // The documented mobile limit is stated in columns; a subgrid is a control but not a
            // column, so counting controls would over-report.
            vi.spyOn(PowerAppsApiService, 'getPerformanceInfo').mockReturnValue(null);
            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue([]);
            vi.spyOn(PowerAppsApiService, 'getAllControls')
                .mockReturnValue([control('standard'), control('standard'), control('subgrid')]);
            vi.spyOn(PowerAppsApiService, 'getAllAttributes')
                .mockReturnValue([{ getOnChange: () => [] }, { getOnChange: () => [] }]);
            global.performance = { getEntriesByType: vi.fn(() => []) };

            const result = FormInspectionService.getPerformanceDetails();

            expect(result.uiCounts.controls).toBe(3);
            expect(result.uiCounts.columns).toBe(2);
        });

        it('should tally control types across the whole form', () => {
            const result = snapshot([], [control('standard'), control('subgrid'), control('subgrid')]);

            expect(result.controlTypes).toEqual({ standard: 1, subgrid: 2 });
        });

        it('should strip the component name from a custom control type', () => {
            // Xrm reports custom controls as "customsubgrid: MscrmControls.Grid.X".
            const result = snapshot([], [control('customsubgrid: MscrmControls.Grid.X')]);

            expect(result.controlTypes).toEqual({ customsubgrid: 1 });
        });

        it('should ignore a control that throws while reporting its type', () => {
            const broken = {
                getControlType: vi.fn(() => {
                    throw new Error('not ready');
                })
            };

            expect(() => snapshot([], [broken, control('standard')])).not.toThrow();
            expect(snapshot([], [broken, control('standard')]).controlTypes).toEqual({ standard: 1 });
        });

        it('should pick the first expanded visible tab as the default tab', () => {
            const result = snapshot([
                tab({ name: 'hidden', visible: false }),
                tab({ name: 'collapsed', displayState: 'collapsed' }),
                tab({ name: 'general', label: 'General' }),
                tab({ name: 'later' })
            ]);

            expect(result.defaultTab.name).toBe('general');
            expect(result.defaultTab.label).toBe('General');
        });

        it('should return no default tab when nothing is expanded', () => {
            const result = snapshot([tab({ name: 'a', displayState: 'collapsed' })]);

            expect(result.defaultTab).toBeNull();
        });

        it('should split the default tab controls into data-driven and deferrable', () => {
            const result = snapshot([
                tab({
                    name: 'general',
                    controls: [
                        control('standard'),
                        control('subgrid'),
                        control('quickform'),
                        control('iframe'),
                        control('webresource')
                    ]
                })
            ]);

            expect(result.defaultTab.controls).toBe(5);
            expect(result.defaultTab.dataControls).toEqual({ subgrid: 1, quickform: 1 });
            expect(result.defaultTab.deferrable).toEqual({ iframe: 1, webresource: 1 });
        });

        it('should count only the default tab, not the whole form', () => {
            const result = snapshot([
                tab({ name: 'general', controls: [control('subgrid')] }),
                tab({ name: 'other', controls: [control('subgrid'), control('subgrid')] })
            ]);

            expect(result.defaultTab.dataControls).toEqual({ subgrid: 1 });
        });

        it('should fall back to a readable label when the tab has none', () => {
            const bare = {
                getName: vi.fn(() => 'tab_1'),
                getLabel: vi.fn(() => ''),
                getVisible: vi.fn(() => true),
                getDisplayState: vi.fn(() => 'expanded'),
                sections: { get: vi.fn(() => []) }
            };

            expect(snapshot([bare]).defaultTab.label).toBe('tab_1');
        });

        it('should skip a tab that throws while reporting its display state', () => {
            const broken = {
                getVisible: vi.fn(() => true),
                getDisplayState: vi.fn(() => {
                    throw new Error('detached');
                })
            };
            const result = snapshot([broken, tab({ name: 'general' })]);

            expect(result.defaultTab.name).toBe('general');
        });
    });

    describe('getFormScriptSources', () => {
        beforeEach(() => {
            // Libraries is an array of plain strings — see _addLibrary. Mocking it as objects hid
            // a bug where every library was filtered out and the scan silently found nothing.
            vi.spyOn(FormInspectionService, 'getFormEventHandlersForEntity').mockResolvedValue({
                Libraries: ['new_/a.js', 'new_/b.js']
            });
        });

        // These spies replace the service's own methods, so they must be put back or every later
        // suite that calls the real ones inherits the stub.
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should return the source of every library', async () => {
            vi.spyOn(FormInspectionService, 'getWebResourceByName')
                .mockImplementation((_fn, name) => Promise.resolve({ name, content: `// ${name}` }));

            const result = await FormInspectionService.getFormScriptSources(vi.fn(), vi.fn(), 'account');

            expect(result.scripts).toHaveLength(2);
            expect(result.scripts[0]).toEqual({ name: 'new_/a.js', source: '// new_/a.js' });
            expect(result.skipped).toEqual([]);
        });

        it('should de-duplicate a library shared by several forms', async () => {
            FormInspectionService.getFormEventHandlersForEntity.mockResolvedValue({
                Libraries: ['new_/a.js', 'new_/a.js']
            });
            vi.spyOn(FormInspectionService, 'getWebResourceByName')
                .mockResolvedValue({ name: 'new_/a.js', content: 'x' });

            const result = await FormInspectionService.getFormScriptSources(vi.fn(), vi.fn(), 'account');

            expect(result.scripts).toHaveLength(1);
        });

        it('should report a library it could not read rather than treating it as clean', async () => {
            vi.spyOn(FormInspectionService, 'getWebResourceByName')
                .mockImplementation((_fn, name) => (name === 'new_/a.js'
                    ? Promise.resolve({ name, content: 'x' })
                    : Promise.resolve(null)));

            const result = await FormInspectionService.getFormScriptSources(vi.fn(), vi.fn(), 'account');

            expect(result.scripts).toHaveLength(1);
            expect(result.skipped).toEqual(['new_/b.js']);
        });

        it('should keep going when one library throws', async () => {
            vi.spyOn(FormInspectionService, 'getWebResourceByName')
                .mockImplementation((_fn, name) => (name === 'new_/a.js'
                    ? Promise.reject(new Error('403'))
                    : Promise.resolve({ name, content: 'x' })));

            const result = await FormInspectionService.getFormScriptSources(vi.fn(), vi.fn(), 'account');

            expect(result.skipped).toEqual(['new_/a.js']);
            expect(result.scripts).toHaveLength(1);
        });

        it('should return empty results when the forms load no libraries', async () => {
            FormInspectionService.getFormEventHandlersForEntity.mockResolvedValue({ Libraries: [] });

            const result = await FormInspectionService.getFormScriptSources(vi.fn(), vi.fn(), 'account');

            expect(result).toEqual({ scripts: [], skipped: [], system: 0 });
        });

        it('should read the libraries in parallel rather than one round trip at a time', async () => {
            let inFlight = 0;
            let peak = 0;
            vi.spyOn(FormInspectionService, 'getWebResourceByName')
                .mockImplementation(async (_fn, name) => {
                    inFlight += 1;
                    peak = Math.max(peak, inFlight);
                    await Promise.resolve();
                    inFlight -= 1;
                    return { name, content: 'x' };
                });

            await FormInspectionService.getFormScriptSources(vi.fn(), vi.fn(), 'account');

            expect(peak).toBe(2);
        });

        it('should keep the library order stable regardless of which read settles first', async () => {
            // Findings name the libraries they came from, so the order must not depend on latency.
            vi.spyOn(FormInspectionService, 'getWebResourceByName')
                .mockImplementation((_fn, name) => (name === 'new_/a.js'
                    // The first library resolves last.
                    ? new Promise(resolve => setTimeout(() => resolve({ name, content: 'x' }), 5))
                    : Promise.resolve({ name, content: 'x' })));

            const result = await FormInspectionService.getFormScriptSources(vi.fn(), vi.fn(), 'account');

            expect(result.scripts.map(s => s.name)).toEqual(['new_/a.js', 'new_/b.js']);
        });

        it('should skip managed libraries instead of reviewing code nobody can change', async () => {
            vi.spyOn(FormInspectionService, 'getWebResourceByName')
                .mockImplementation((_fn, name) => Promise.resolve({
                    name,
                    content: 'console.log(1);',
                    isManaged: name === 'new_/b.js'
                }));

            const result = await FormInspectionService.getFormScriptSources(vi.fn(), vi.fn(), 'account');

            expect(result.scripts.map(s => s.name)).toEqual(['new_/a.js']);
            expect(result.system).toBe(1);
            // A managed library is deliberately excluded, not an unreadable one.
            expect(result.skipped).toEqual([]);
        });

        it('should read the string library names the parser actually produces', async () => {
            // Regression: getFormEventHandlersForEntity returns Libraries as strings. Reading a
            // .name off them filtered every library out, so the scan always reported "no scripts".
            FormInspectionService.getFormEventHandlersForEntity.mockRestore();
            const retrieveMultiple = vi.fn().mockResolvedValue({
                entities: [{
                    formid: 'f1',
                    name: 'Main',
                    type: 2,
                    formxml: '<form><formLibraries><Library name="new_/real.js" /></formLibraries></form>'
                }]
            });
            vi.spyOn(FormInspectionService, 'getWebResourceByName')
                .mockResolvedValue({ name: 'new_/real.js', content: 'var a = 1;' });

            const result = await FormInspectionService.getFormScriptSources(
                retrieveMultiple, vi.fn(), 'account'
            );

            expect(result.scripts).toEqual([{ name: 'new_/real.js', source: 'var a = 1;' }]);
        });

        it('should treat an empty web resource as readable', async () => {
            FormInspectionService.getFormEventHandlersForEntity.mockResolvedValue({
                Libraries: ['new_/empty.js']
            });
            vi.spyOn(FormInspectionService, 'getWebResourceByName')
                .mockResolvedValue({ name: 'new_/empty.js', content: '' });

            const result = await FormInspectionService.getFormScriptSources(vi.fn(), vi.fn(), 'account');

            expect(result.scripts).toEqual([{ name: 'new_/empty.js', source: '' }]);
            expect(result.skipped).toEqual([]);
        });
    });

    describe('_getFormIdReliably edge cases', () => {
        it('should return null when Xrm throws an exception', async () => {
            // Set up Xrm to throw an error when accessing formSelector
            global.Xrm = {
                Page: {
                    ui: {
                        get formSelector() {
                            throw new Error('Access denied');
                        }
                    }
                }
            };

            const webApiFetch = vi.fn();

            // ValidationService should throw because formId is null due to exception
            vi.mocked(ValidationService.validateRequired).mockImplementation((value, name, error) => {
                if (!value) throw new Error(error);
            });

            await expect(FormInspectionService.getFormEventHandlers(webApiFetch))
                .rejects.toThrow('Form ID not found');
        });

        it('should return null when getId returns null', async () => {
            global.Xrm = {
                Page: {
                    ui: {
                        formSelector: {
                            getCurrentItem: vi.fn(() => ({
                                getId: vi.fn(() => null)
                            }))
                        }
                    }
                }
            };

            const webApiFetch = vi.fn();

            vi.mocked(ValidationService.validateRequired).mockImplementation((value, name, error) => {
                if (!value) throw new Error(error);
            });

            await expect(FormInspectionService.getFormEventHandlers(webApiFetch))
                .rejects.toThrow('Form ID not found');
        });

        it('should return null when getCurrentItem returns null', async () => {
            global.Xrm = {
                Page: {
                    ui: {
                        formSelector: {
                            getCurrentItem: vi.fn(() => null)
                        }
                    }
                }
            };

            const webApiFetch = vi.fn();

            vi.mocked(ValidationService.validateRequired).mockImplementation((value, name, error) => {
                if (!value) throw new Error(error);
            });

            await expect(FormInspectionService.getFormEventHandlers(webApiFetch))
                .rejects.toThrow('Form ID not found');
        });
    });

    describe('getAllRecordColumns additional edge cases', () => {
        it('should add form columns not in record data with isSystem false', async () => {
            // Form has a column that is NOT in the record data
            const mockFormColumn = {
                displayName: 'Custom Field',
                logicalName: 'customfield',
                value: 'Custom Value',
                type: 'string',
                isDirty: false,
                requiredLevel: 'none',
                attribute: {}
            };

            // Record data does NOT include 'customfield'
            const mockRecordData = {
                name: 'Test Account'
            };

            const retrieveRecord = vi.fn().mockResolvedValue(mockRecordData);
            const getFormColumns = vi.fn().mockReturnValue([mockFormColumn]);
            const isOdataProperty = vi.fn(() => false);
            const loadMetadata = vi.fn().mockResolvedValue();
            const getEntitySetName = vi.fn(() => 'accounts');
            const getAttributeDefinitions = vi.fn().mockResolvedValue([]);

            vi.spyOn(PowerAppsApiService, 'getEntityId').mockReturnValue('12345');

            const result = await FormInspectionService.getAllRecordColumns(
                retrieveRecord, getFormColumns, isOdataProperty, loadMetadata, getEntitySetName, getAttributeDefinitions
            );

            // The customfield should be added from formColumnMap.values()
            const customColumn = result.find(c => c.logicalName === 'customfield');
            expect(customColumn).toBeDefined();
            expect(customColumn.onForm).toBe(true);
            expect(customColumn.isSystem).toBe(false);
        });

        it('should use logical name as entitySetName when getEntitySetName returns null', async () => {
            const mockFormColumn = {
                displayName: 'Name',
                logicalName: 'name',
                value: 'Test',
                type: 'string',
                isDirty: false,
                requiredLevel: 'none',
                attribute: {}
            };

            const mockRecordData = { name: 'Test' };

            const retrieveRecord = vi.fn().mockResolvedValue(mockRecordData);
            const getFormColumns = vi.fn().mockReturnValue([mockFormColumn]);
            const isOdataProperty = vi.fn(() => false);
            const loadMetadata = vi.fn().mockResolvedValue();
            const getEntitySetName = vi.fn(() => null); // Returns null
            const getAttributeDefinitions = vi.fn().mockResolvedValue([]);

            vi.spyOn(PowerAppsApiService, 'getEntityName').mockReturnValue('account');
            vi.spyOn(PowerAppsApiService, 'getEntityId').mockReturnValue('12345');

            await FormInspectionService.getAllRecordColumns(
                retrieveRecord, getFormColumns, isOdataProperty, loadMetadata, getEntitySetName, getAttributeDefinitions
            );

            // Should fall back to 'account' (the logical name)
            expect(retrieveRecord).toHaveBeenCalledWith('account', '12345');
        });

        it('should use metadata types when available', async () => {
            const mockRecordData = {
                name: 'Test Account',
                address1_county: 'Test County'
            };

            const mockAttributeMetadata = [
                { LogicalName: 'name', AttributeType: 'String' },
                { LogicalName: 'address1_county', AttributeType: 'String' }
            ];

            const retrieveRecord = vi.fn().mockResolvedValue(mockRecordData);
            const getFormColumns = vi.fn().mockReturnValue([]);
            const isOdataProperty = vi.fn(() => false);
            const loadMetadata = vi.fn().mockResolvedValue();
            const getEntitySetName = vi.fn(() => 'accounts');
            const getAttributeDefinitions = vi.fn().mockResolvedValue(mockAttributeMetadata);

            vi.spyOn(PowerAppsApiService, 'getEntityId').mockReturnValue('12345');

            const result = await FormInspectionService.getAllRecordColumns(
                retrieveRecord, getFormColumns, isOdataProperty, loadMetadata, getEntitySetName, getAttributeDefinitions
            );

            const countyColumn = result.find(c => c.logicalName === 'address1_county');
            expect(countyColumn).toBeDefined();
            expect(countyColumn.type).toBe('string');
            expect(getAttributeDefinitions).toHaveBeenCalledWith('account', false);
        });

        it('should fall back to inferred type when metadata unavailable', async () => {
            const mockRecordData = {
                unknownfield: 'Test Value'
            };

            const mockAttributeMetadata = []; // No metadata for unknownfield

            const retrieveRecord = vi.fn().mockResolvedValue(mockRecordData);
            const getFormColumns = vi.fn().mockReturnValue([]);
            const isOdataProperty = vi.fn(() => false);
            const loadMetadata = vi.fn().mockResolvedValue();
            const getEntitySetName = vi.fn(() => 'accounts');
            const getAttributeDefinitions = vi.fn().mockResolvedValue(mockAttributeMetadata);

            vi.spyOn(PowerAppsApiService, 'getEntityId').mockReturnValue('12345');

            const result = await FormInspectionService.getAllRecordColumns(
                retrieveRecord, getFormColumns, isOdataProperty, loadMetadata, getEntitySetName, getAttributeDefinitions
            );

            const unknownColumn = result.find(c => c.logicalName === 'unknownfield');
            expect(unknownColumn).toBeDefined();
            expect(unknownColumn.type).toBe('string'); // Inferred from value
        });
    });

    describe('getFormEventHandlersForEntity onsave handlers', () => {
        it('should parse both onload and onsave handlers for entity', async () => {
            const formXml = `
                <form>
                    <events>
                        <event name="onload">
                            <Handler libraryName="load_script.js" functionName="onLoadHandler" enabled="true"/>
                        </event>
                        <event name="onsave">
                            <Handler libraryName="save_script.js" functionName="onSaveHandler" enabled="true"/>
                            <Handler libraryName="save_script.js" functionName="onSaveValidation" enabled="false"/>
                        </event>
                    </events>
                </form>
            `;

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-id-123', formxml: formXml }]
            });
            const retrieveRecord = vi.fn();

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, retrieveRecord, 'contact'
            );

            expect(result.OnLoad).toHaveLength(1);
            expect(result.OnLoad[0].function).toBe('onLoadHandler');

            expect(result.OnSave).toHaveLength(2);
            expect(result.OnSave[0].function).toBe('onSaveHandler');
            expect(result.OnSave[0].enabled).toBe(true);
            expect(result.OnSave[1].function).toBe('onSaveValidation');
            expect(result.OnSave[1].enabled).toBe(false);
        });
    });

    describe('getFormEventHandlersForEntity InternalHandlers and clientresources', () => {
        it('should capture handlers from InternalHandlers in non-standard events', async () => {
            const formXml = `
                <form>
                    <tabs><tab><columns><column><sections><section><rows><row>
                        <cell>
                            <control id="parentcustomerid" datafieldname="parentcustomerid" />
                            <events>
                                <event name="setadditionalparams" application="true" active="true">
                                    <InternalHandlers>
                                        <Handler functionName="AppCommon.Contact.Instance.parentcustomerid_setadditionalparams"
                                                 libraryName="AppCommon/Contact/Contact_main_system_library.js"
                                                 handlerUniqueId="76092dad-9a35-46d9-8e60-db497b408601"
                                                 enabled="true" passExecutionContext="true" />
                                    </InternalHandlers>
                                </event>
                            </events>
                        </cell>
                    </row></rows></section></sections></column></columns></tab></tabs>
                </form>
            `;

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-id-123', formxml: formXml }]
            });
            const retrieveRecord = vi.fn();

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, retrieveRecord, 'contact'
            );

            expect(result.Other).toHaveLength(1);
            expect(result.Other[0].function).toBe('AppCommon.Contact.Instance.parentcustomerid_setadditionalparams');
            expect(result.Other[0].library).toBe('AppCommon/Contact/Contact_main_system_library.js');
            expect(result.Other[0].field).toBe('parentcustomerid');
            expect(result.Other[0].eventType).toBe('setadditionalparams');
            expect(result.Other[0].enabled).toBe(true);
            expect(result.Other[0].internal).toBe(true);
        });

        it('should parse clientresources for internaljscriptfile entries', async () => {
            const formXml = `
                <form>
                    <clientresources>
                        <internalresources>
                            <clientincludes>
                                <internaljscriptfile src="$webresource:AppCommon/Contact/Contact_main_system_library.js" />
                            </clientincludes>
                        </internalresources>
                    </clientresources>
                </form>
            `;

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-id-123', formxml: formXml }]
            });
            const retrieveRecord = vi.fn();

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, retrieveRecord, 'contact'
            );

            expect(result.Libraries).toHaveLength(1);
            expect(result.Libraries[0]).toBe('AppCommon/Contact/Contact_main_system_library.js');
        });

        // The FormXML schema puts a form's script libraries in <formLibraries><Library name=…/>.
        it('should parse formLibraries entries — where the schema actually puts form scripts', async () => {
            const formXml = `
                <form>
                    <formLibraries>
                        <Library name="new_/scripts/account.js" libraryUniqueId="{11111111-1111-1111-1111-111111111111}" />
                        <Library name="new_/scripts/common.js" libraryUniqueId="{22222222-2222-2222-2222-222222222222}" />
                    </formLibraries>
                </form>
            `;

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-id-123', formxml: formXml }]
            });
            const retrieveRecord = vi.fn();

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, retrieveRecord, 'contact'
            );

            expect(result.Libraries).toHaveLength(2);
            expect(result.Libraries[0]).toBe('new_/scripts/account.js');
            expect(result.Libraries[1]).toBe('new_/scripts/common.js');
        });

        it('should not duplicate library entries', async () => {
            const formXml = `
                <form>
                    <formLibraries>
                        <Library name="my_script.js" libraryUniqueId="{11111111-1111-1111-1111-111111111111}" />
                    </formLibraries>
                    <clientresources>
                        <internalresources>
                            <clientincludes>
                                <internaljscriptfile src="$webresource:my_script.js" />
                            </clientincludes>
                        </internalresources>
                    </clientresources>
                </form>
            `;

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-id-123', formxml: formXml }]
            });
            const retrieveRecord = vi.fn();

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, retrieveRecord, 'contact'
            );

            expect(result.Libraries).toHaveLength(1);
            expect(result.Libraries[0]).toBe('my_script.js');
        });

        it('should capture non-standard form-level events in Other', async () => {
            const formXml = `
                <form>
                    <events>
                        <event name="onload">
                            <Handler libraryName="load.js" functionName="onLoad" enabled="true"/>
                        </event>
                        <event name="customaction">
                            <Handler libraryName="custom.js" functionName="onCustomAction" enabled="true"/>
                        </event>
                    </events>
                </form>
            `;

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-id-123', formxml: formXml }]
            });
            const retrieveRecord = vi.fn();

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, retrieveRecord, 'contact'
            );

            expect(result.OnLoad).toHaveLength(1);
            expect(result.Other).toHaveLength(1);
            expect(result.Other[0].function).toBe('onCustomAction');
            expect(result.Other[0].eventType).toBe('customaction');
        });

        it('should return empty Other and Libraries arrays for standard forms', async () => {
            const formXml = `
                <form>
                    <events>
                        <event name="onload">
                            <Handler libraryName="test.js" functionName="onLoad" enabled="true"/>
                        </event>
                    </events>
                </form>
            `;

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-id-123', formxml: formXml }]
            });
            const retrieveRecord = vi.fn();

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, retrieveRecord, 'contact'
            );

            expect(result.Other).toEqual([]);
            expect(result.Libraries).toEqual([]);
        });
    });

    describe('getFormEventHandlers InternalHandlers and clientresources', () => {
        it('should capture InternalHandlers in Other events', async () => {
            const formXml = `<form>
                <tabs><tab><columns><column><sections><section><rows><row>
                    <cell>
                        <control id="parentcustomerid" datafieldname="parentcustomerid" />
                        <events>
                            <event name="setadditionalparams" application="true" active="true">
                                <InternalHandlers>
                                    <Handler functionName="MyLib.setParams"
                                             libraryName="my_library.js"
                                             enabled="true" passExecutionContext="false" />
                                </InternalHandlers>
                            </event>
                        </events>
                    </cell>
                </row></rows></section></sections></column></columns></tab></tabs>
            </form>`;

            const webApiFetch = vi.fn(() => Promise.resolve({ formxml: formXml }));

            global.Xrm = {
                Page: {
                    ui: {
                        formSelector: {
                            getCurrentItem: () => ({
                                getId: () => 'form-789'
                            })
                        }
                    }
                }
            };

            const result = await FormInspectionService.getFormEventHandlers(webApiFetch);

            expect(result.Other).toHaveLength(1);
            expect(result.Other[0].function).toBe('MyLib.setParams');
            expect(result.Other[0].eventType).toBe('setadditionalparams');
            expect(result.Other[0].field).toBe('parentcustomerid');
        });

        it('should parse clientresources for Libraries', async () => {
            const formXml = `<form>
                <events></events>
                <clientresources>
                    <internalresources>
                        <clientincludes>
                            <internaljscriptfile src="$webresource:AppCommon/Contact/Contact_main_system_library.js" />
                        </clientincludes>
                    </internalresources>
                </clientresources>
            </form>`;

            const webApiFetch = vi.fn(() => Promise.resolve({ formxml: formXml }));

            global.Xrm = {
                Page: {
                    ui: {
                        formSelector: {
                            getCurrentItem: () => ({
                                getId: () => 'form-789'
                            })
                        }
                    }
                }
            };

            const result = await FormInspectionService.getFormEventHandlers(webApiFetch);

            expect(result.Libraries).toHaveLength(1);
            expect(result.Libraries[0]).toBe('AppCommon/Contact/Contact_main_system_library.js');
        });
    });

    describe('getFormEventHandlersForEntity formjson parsing', () => {
        it('should parse handlers from formjson Events array format', async () => {
            const formjson = JSON.stringify({
                Events: [
                    {
                        name: 'onload',
                        handlers: [
                            {
                                functionName: 'TestFormLogic.onLoad',
                                libraryName: '$webresource:pt_FormLogic.js',
                                enabled: true,
                                passExecutionContext: true,
                                parameters: ''
                            }
                        ]
                    },
                    {
                        name: 'onsave',
                        handlers: [
                            {
                                functionName: 'TestFormLogic.onSave',
                                libraryName: '$webresource:pt_FormLogic.js',
                                enabled: true,
                                passExecutionContext: false,
                                parameters: ''
                            }
                        ]
                    }
                ]
            });

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-id-json', formxml: '<form></form>', formjson }]
            });

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, vi.fn(), 'contact'
            );

            expect(result.OnLoad).toHaveLength(1);
            expect(result.OnLoad[0].function).toBe('TestFormLogic.onLoad');
            expect(result.OnLoad[0].library).toBe('pt_FormLogic.js');
            expect(result.OnLoad[0].enabled).toBe(true);
            expect(result.OnSave).toHaveLength(1);
            expect(result.OnSave[0].function).toBe('TestFormLogic.onSave');
            expect(result.OnSave[0].library).toBe('pt_FormLogic.js');
        });

        it('should parse handlers from formjson Events object format', async () => {
            const formjson = JSON.stringify({
                Events: {
                    onload: {
                        handlers: [
                            {
                                functionName: 'MyLib.onLoad',
                                libraryName: 'my_script.js',
                                enabled: true,
                                passExecutionContext: true
                            }
                        ]
                    }
                }
            });

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-id-json', formjson }]
            });

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, vi.fn(), 'account'
            );

            expect(result.OnLoad).toHaveLength(1);
            expect(result.OnLoad[0].function).toBe('MyLib.onLoad');
            expect(result.OnLoad[0].library).toBe('my_script.js');
        });

        it('should extract FormLibraries from formjson', async () => {
            const formjson = JSON.stringify({
                FormLibraries: {
                    $type: 'System.String[], mscorlib',
                    $values: ['$webresource:pt_FormLogic.js', 'other_script.js']
                }
            });

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-id-json', formjson }]
            });

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, vi.fn(), 'contact'
            );

            expect(result.Libraries).toHaveLength(2);
            expect(result.Libraries[0]).toBe('pt_FormLogic.js');
            expect(result.Libraries[1]).toBe('other_script.js');
        });

        it('should extract ClientResources from formjson', async () => {
            const formjson = JSON.stringify({
                ClientResources: {
                    $type: 'System.String[], mscorlib',
                    $values: ['$webresource:lib1.js', 'lib2.js']
                }
            });

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-id-json', formjson }]
            });

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, vi.fn(), 'contact'
            );

            expect(result.Libraries).toHaveLength(2);
            expect(result.Libraries[0]).toBe('lib1.js');
            expect(result.Libraries[1]).toBe('lib2.js');
        });

        // ───────────────────────────────────────────────────────────────
        // Real Dataverse formjson: a .NET-serialized descriptor tree where every collection is
        // {$type, $values} and handlers hang off `EventHandlers` carrying their own `EventName`.
        // Fixtures below mirror payloads captured from a live environment (contact + invoice main
        // forms) — hand-rolled plain-array shapes used to pass here while parsing nothing at all.
        // ───────────────────────────────────────────────────────────────
        describe('real formjson descriptor shape', () => {
            const values = (type, items) => ({
                $type: `Microsoft.Crm.ObjectModel.FormXmlToJsonUtil.Descriptors.${type}[], Microsoft.Crm.ObjectModel`,
                $values: items
            });

            const handler = (eventName, overrides = {}) => ({
                $type: 'Microsoft.Crm.ObjectModel.FormXmlToJsonUtil.Descriptors.EventHandlerDescriptor, Microsoft.Crm.ObjectModel',
                EventName: eventName,
                FunctionName: 'Contact.onLoad',
                LibraryName: '$webresource:new_/scripts/contact.js',
                HandlerUniqueId: '{5f5a0a9e-0000-0000-0000-000000000001}',
                Enabled: true,
                PassExecutionContext: true,
                Parameters: '',
                ...overrides
            });

            /**
             * Builds a formjson string in the exact wrapper shape Dataverse returns.
             * @param {{formHandlers?: Array, control?: object, libraries?: Array}} parts - Content to embed.
             * @returns {string} Serialized formjson.
             */
            const buildFormJson = ({ formHandlers = [], control = null, libraries = [] } = {}) => JSON.stringify({
                $type: 'Microsoft.Crm.ObjectModel.FormXmlToJsonUtil.Descriptors.Form, Microsoft.Crm.ObjectModel',
                FormId: '2d86b7bf-aa03-ef11-9f89-002248141b39',
                EntityLogicalName: null,
                Tabs: values('Tab', [{
                    $type: 'Microsoft.Crm.ObjectModel.FormXmlToJsonUtil.Descriptors.Tab, Microsoft.Crm.ObjectModel',
                    Name: 'SUMMARY_TAB',
                    Columns: values('Column', [{
                        Sections: values('Section', [{
                            Rows: values('Row', [{
                                Cells: values('Cell', [{
                                    Control: control || {
                                        $type: 'Microsoft.Crm.ObjectModel.FormXmlToJsonUtil.Descriptors.CustomControl, Microsoft.Crm.ObjectModel',
                                        DataFieldName: 'customerid',
                                        Id: 'customerid',
                                        EventHandlers: values('EventHandlerDescriptor', [])
                                    }
                                }])
                            }])
                        }])
                    }])
                }]),
                HiddenFields: values('Control', []),
                EventHandlers: values('EventHandlerDescriptor', formHandlers),
                FormLibraries: { $type: 'System.String[], mscorlib', $values: libraries },
                ClientResources: { $type: 'System.String[], mscorlib', $values: [] },
                FormType: 2
            });

            /**
             * Runs the entity parser over a single form definition.
             * @param {object} form - systemform row fields.
             * @returns {Promise<object>} Parsed automations.
             */
            const parse = (form) => FormInspectionService.getFormEventHandlersForEntity(
                vi.fn().mockResolvedValue({ entities: [{ formid: 'form-real', ...form }] }),
                vi.fn(),
                'contact'
            );

            it('should read form-level handlers out of the $values wrapper', async () => {
                const result = await parse({
                    formjson: buildFormJson({
                        formHandlers: [
                            handler('onload'),
                            handler('onsave', { FunctionName: 'Contact.onSave', PassExecutionContext: false })
                        ]
                    })
                });

                expect(result.OnLoad).toHaveLength(1);
                expect(result.OnLoad[0].function).toBe('Contact.onLoad');
                expect(result.OnLoad[0].library).toBe('new_/scripts/contact.js');
                expect(result.OnLoad[0].passContext).toBe(true);
                expect(result.OnSave).toHaveLength(1);
                expect(result.OnSave[0].function).toBe('Contact.onSave');
            });

            it('should read control handlers and attribute them to the column', async () => {
                const result = await parse({
                    formjson: buildFormJson({
                        control: {
                            $type: 'Microsoft.Crm.ObjectModel.FormXmlToJsonUtil.Descriptors.CustomControl, Microsoft.Crm.ObjectModel',
                            DataFieldName: 'm8_vatid',
                            Id: 'm8_vatid',
                            EventHandlers: values('EventHandlerDescriptor', [
                                handler('onchange', { FunctionName: 'Invoice.vatChanged' })
                            ])
                        }
                    })
                });

                expect(result.OnChange).toHaveLength(1);
                expect(result.OnChange[0].function).toBe('Invoice.vatChanged');
                expect(result.OnChange[0].field).toBe('m8_vatid');
            });

            it('should unwrap FormLibraries strings', async () => {
                const result = await parse({
                    formjson: buildFormJson({ libraries: ['$webresource:new_/scripts/contact.js', 'shared.js'] })
                });

                expect(result.Libraries).toEqual(['new_/scripts/contact.js', 'shared.js']);
            });

            it('should surface a handler whose event cannot be identified instead of dropping it', async () => {
                const result = await parse({
                    formjson: buildFormJson({
                        formHandlers: [{ FunctionName: 'Mystery.run', LibraryName: 'mystery.js' }]
                    })
                });

                expect(result.Other).toHaveLength(1);
                expect(result.Other[0].function).toBe('Mystery.run');
                expect(result.Other[0].eventType).toBe('unknown');
            });

            it('should treat a handler as enabled unless Enabled is explicitly false', async () => {
                const result = await parse({
                    formjson: buildFormJson({
                        formHandlers: [
                            handler('onload', { Enabled: undefined }),
                            handler('onsave', { FunctionName: 'Contact.onSave', Enabled: false })
                        ]
                    })
                });

                expect(result.OnLoad[0].enabled).toBe(true);
                expect(result.OnSave[0].enabled).toBe(false);
            });

            it('should parse a live form whose handler collections are all empty without error', async () => {
                const result = await parse({ formjson: buildFormJson() });

                expect(result.OnLoad).toEqual([]);
                expect(result.OnSave).toEqual([]);
                expect(result.OnChange).toEqual([]);
                expect(result.Other).toEqual([]);
                expect(result.Libraries).toEqual([]);
            });
        });

        it('should keep the same function registered on two different events', async () => {
            const formXml = `
                <form>
                    <events>
                        <event name="onload">
                            <Handler libraryName="shared.js" functionName="Form.init" enabled="true"/>
                        </event>
                        <event name="onsave">
                            <Handler libraryName="shared.js" functionName="Form.init" enabled="true"/>
                        </event>
                    </events>
                </form>
            `;

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                vi.fn().mockResolvedValue({ entities: [{ formid: 'form-1', formxml: formXml }] }),
                vi.fn(),
                'contact'
            );

            expect(result.OnLoad).toHaveLength(1);
            expect(result.OnSave).toHaveLength(1);
        });

        it('should treat a handler without an enabled attribute as enabled', async () => {
            const formXml = `
                <form>
                    <events>
                        <event name="onload">
                            <Handler libraryName="shared.js" functionName="Form.init"/>
                            <Handler libraryName="shared.js" functionName="Form.off" enabled="false"/>
                        </event>
                    </events>
                </form>
            `;

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                vi.fn().mockResolvedValue({ entities: [{ formid: 'form-1', formxml: formXml }] }),
                vi.fn(),
                'contact'
            );

            expect(result.OnLoad[0].enabled).toBe(true);
            expect(result.OnLoad[1].enabled).toBe(false);
        });

        it('should deduplicate handlers from formxml and formjson', async () => {
            const formXml = `
                <form>
                    <events>
                        <event name="onload">
                            <Handler libraryName="shared.js" functionName="onLoad" enabled="true"/>
                        </event>
                    </events>
                </form>
            `;
            const formjson = JSON.stringify({
                Events: [
                    {
                        name: 'onload',
                        handlers: [{ functionName: 'onLoad', libraryName: 'shared.js', enabled: true }]
                    }
                ]
            });

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-id-123', formxml: formXml, formjson }]
            });

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, vi.fn(), 'contact'
            );

            expect(result.OnLoad).toHaveLength(1);
        });

        describe('form coverage and attribution', () => {
            const onLoadXml = (fn, lib = 'shared.js') => `
                <form><events>
                    <event name="onload"><Handler libraryName="${lib}" functionName="${fn}" enabled="true"/></event>
                </events></form>
            `;

            it('should query every form kind that can carry handlers, not just Main', async () => {
                const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                    entities: [{ formid: 'f1', name: 'Information', type: 2, formxml: onLoadXml('a') }]
                });

                await FormInspectionService.getFormEventHandlersForEntity(
                    retrieveMultipleRecords, vi.fn(), 'contact'
                );

                const query = retrieveMultipleRecords.mock.calls[0][1];
                expect(query).toContain('type eq 2');
                expect(query).toContain('type eq 6');
                expect(query).toContain('type eq 7');
                expect(query).toContain('type eq 11');
                expect(query).toContain('$select=formid,name,type,formxml,formjson');
            });

            it('should escape a quote in the entity name rather than breaking the filter', async () => {
                const retrieveMultipleRecords = vi.fn().mockResolvedValue({ entities: [] });

                await FormInspectionService.getFormEventHandlersForEntity(
                    retrieveMultipleRecords, vi.fn(), "o'brien"
                );

                expect(retrieveMultipleRecords.mock.calls[0][1]).toContain("objecttypecode eq 'o''brien'");
            });

            it('should summarize the forms it scanned', async () => {
                const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                    entities: [
                        { formid: 'f1', name: 'Information', type: 2, formxml: onLoadXml('a') },
                        { formid: 'f2', name: 'Contact Card', type: 11, formxml: onLoadXml('b') }
                    ]
                });

                const result = await FormInspectionService.getFormEventHandlersForEntity(
                    retrieveMultipleRecords, vi.fn(), 'contact'
                );

                expect(result.forms).toEqual([
                    { id: 'f1', name: 'Information', type: 2, typeLabel: 'Main' },
                    { id: 'f2', name: 'Contact Card', type: 11, typeLabel: 'Card' }
                ]);
            });

            it('should fall back to the type label when a form has no name', async () => {
                const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                    entities: [{ formid: 'f1', type: 7, formxml: onLoadXml('a') }]
                });

                const result = await FormInspectionService.getFormEventHandlersForEntity(
                    retrieveMultipleRecords, vi.fn(), 'contact'
                );

                expect(result.forms[0].name).toBe('Quick Create');
            });

            it('should attribute each handler to the form it came from', async () => {
                const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                    entities: [
                        { formid: 'f1', name: 'Information', type: 2, formxml: onLoadXml('Contact.init') },
                        { formid: 'f2', name: 'Contact Card', type: 11, formxml: onLoadXml('Card.init') }
                    ]
                });

                const result = await FormInspectionService.getFormEventHandlersForEntity(
                    retrieveMultipleRecords, vi.fn(), 'contact'
                );

                expect(result.OnLoad).toHaveLength(2);
                expect(result.OnLoad[0].forms).toEqual(['Information']);
                expect(result.OnLoad[1].forms).toEqual(['Contact Card']);
            });

            it('should list a shared handler once, naming every form it appears on', async () => {
                const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                    entities: [
                        { formid: 'f1', name: 'Information', type: 2, formxml: onLoadXml('Contact.init') },
                        { formid: 'f2', name: 'Contact Card', type: 11, formxml: onLoadXml('Contact.init') },
                        { formid: 'f3', name: 'Quick Create Contact', type: 7, formxml: onLoadXml('Contact.init') }
                    ]
                });

                const result = await FormInspectionService.getFormEventHandlersForEntity(
                    retrieveMultipleRecords, vi.fn(), 'contact'
                );

                expect(result.OnLoad).toHaveLength(1);
                expect(result.OnLoad[0].forms).toEqual(['Information', 'Contact Card', 'Quick Create Contact']);
            });

            it('should not list the same form twice when both columns carry the handler', async () => {
                const formjson = JSON.stringify({
                    EventHandlers: {
                        $type: 'Microsoft.Crm.ObjectModel.FormXmlToJsonUtil.Descriptors.EventHandlerDescriptor[], Microsoft.Crm.ObjectModel',
                        $values: [{ EventName: 'onload', FunctionName: 'Contact.init', LibraryName: 'shared.js' }]
                    }
                });
                const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                    entities: [{ formid: 'f1', name: 'Information', type: 2, formxml: onLoadXml('Contact.init'), formjson }]
                });

                const result = await FormInspectionService.getFormEventHandlersForEntity(
                    retrieveMultipleRecords, vi.fn(), 'contact'
                );

                expect(result.OnLoad).toHaveLength(1);
                expect(result.OnLoad[0].forms).toEqual(['Information']);
            });
        });

        it('should aggregate handlers from multiple forms', async () => {
            const formXml1 = `
                <form><events>
                    <event name="onload">
                        <Handler libraryName="form1.js" functionName="onLoad1" enabled="true"/>
                    </event>
                </events></form>
            `;
            const formXml2 = `
                <form><events>
                    <event name="onload">
                        <Handler libraryName="form2.js" functionName="onLoad2" enabled="true"/>
                    </event>
                </events></form>
            `;

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [
                    { formid: 'form-1', formxml: formXml1 },
                    { formid: 'form-2', formxml: formXml2 }
                ]
            });

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, vi.fn(), 'account'
            );

            expect(result.OnLoad).toHaveLength(2);
            expect(result.formId).toBe('form-1');
        });

        it('should handle forms with only formjson and no formxml', async () => {
            const formjson = JSON.stringify({
                Events: [
                    {
                        name: 'onload',
                        handlers: [
                            { functionName: 'JsonOnly.onLoad', libraryName: 'json_script.js', enabled: true }
                        ]
                    }
                ],
                FormLibraries: [{ name: 'json_script.js' }]
            });

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-json-only', formjson }]
            });

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, vi.fn(), 'contact'
            );

            expect(result.OnLoad).toHaveLength(1);
            expect(result.OnLoad[0].function).toBe('JsonOnly.onLoad');
            expect(result.Libraries).toHaveLength(1);
            expect(result.Libraries[0]).toBe('json_script.js');
        });

        it('should skip invalid formjson gracefully', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-bad', formjson: 'not-valid-json{{{' }]
            });

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, vi.fn(), 'contact'
            );

            expect(result).not.toBeNull();
            expect(result.OnLoad).toEqual([]);
        });

        it('should normalize PascalCase handler properties from formjson', async () => {
            const formjson = JSON.stringify({
                Events: [
                    {
                        Name: 'onsave',
                        Handlers: [
                            {
                                FunctionName: 'MyApp.onSave',
                                LibraryName: '$webresource:my_app.js',
                                Enabled: true,
                                PassExecutionContext: true,
                                Parameters: 'param1'
                            }
                        ]
                    }
                ]
            });

            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-pascal', formjson }]
            });

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, vi.fn(), 'account'
            );

            expect(result.OnSave).toHaveLength(1);
            expect(result.OnSave[0].function).toBe('MyApp.onSave');
            expect(result.OnSave[0].library).toBe('my_app.js');
            expect(result.OnSave[0].enabled).toBe(true);
            expect(result.OnSave[0].passContext).toBe(true);
            expect(result.OnSave[0].parameters).toBe('param1');
        });
    });

    describe('getFormEventHandlers formjson parsing', () => {
        it('should parse formjson handlers on current form', async () => {
            const formjson = JSON.stringify({
                Events: [
                    {
                        name: 'onload',
                        handlers: [
                            { functionName: 'CurrentForm.onLoad', libraryName: 'current.js', enabled: true }
                        ]
                    }
                ]
            });

            const retrieveRecord = vi.fn(() => Promise.resolve({ formxml: '<form></form>', formjson }));

            global.Xrm = {
                Page: {
                    ui: {
                        formSelector: {
                            getCurrentItem: () => ({ getId: () => 'form-abc' })
                        }
                    }
                }
            };

            const result = await FormInspectionService.getFormEventHandlers(retrieveRecord);

            expect(result.OnLoad).toHaveLength(1);
            expect(result.OnLoad[0].function).toBe('CurrentForm.onLoad');
            // Takes a retrieveRecord function, matching how DataService actually calls it — it used
            // to be handed the PowerAppsApiService object and invoked as a function.
            expect(retrieveRecord).toHaveBeenCalledWith('systemform', 'form-abc', '?$select=formxml,formjson');
        });

        it('should accept form with only formjson and no formxml', async () => {
            const formjson = JSON.stringify({
                Events: [{ name: 'onsave', handlers: [{ functionName: 'App.onSave', libraryName: 'app.js', enabled: true }] }]
            });

            const webApiFetch = vi.fn(() => Promise.resolve({ formjson }));

            global.Xrm = {
                Page: {
                    ui: {
                        formSelector: {
                            getCurrentItem: () => ({ getId: () => 'form-xyz' })
                        }
                    }
                }
            };

            const result = await FormInspectionService.getFormEventHandlers(webApiFetch);

            expect(result.OnSave).toHaveLength(1);
            expect(result.OnSave[0].function).toBe('App.onSave');
        });
    });

    describe('getFormHierarchy control error edge cases', () => {
        it('should use Errored Control label when getName is not available', () => {
            // ctrl?.getName?.() will return undefined when getName is not a function
            const mockControl = {
                // No getName method at all
                getLabel: vi.fn(() => { throw new Error('Control error'); }),
                getControlType: vi.fn(() => { throw new Error('Control error'); })
            };

            const mockSection = {
                getLabel: vi.fn(() => 'Section'),
                getName: vi.fn(() => 'section'),
                controls: { get: vi.fn(() => [mockControl]) }
            };

            const mockTab = {
                getName: vi.fn(() => 'tab'),
                getLabel: vi.fn(() => 'Tab'),
                sections: { get: vi.fn(() => [mockSection]) }
            };

            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue([mockTab]);

            const result = FormInspectionService.getFormHierarchy();

            expect(result[0].children[0].children[0].label).toBe('Errored Control');
        });

        it('should handle section with no controls property', () => {
            const mockSection = {
                getLabel: vi.fn(() => 'Empty Section'),
                getName: vi.fn(() => 'section_empty'),
                controls: null
            };

            const mockTab = {
                getName: vi.fn(() => 'tab'),
                getLabel: vi.fn(() => 'Tab'),
                sections: { get: vi.fn(() => [mockSection]) }
            };

            vi.spyOn(PowerAppsApiService, 'getAllTabs').mockReturnValue([mockTab]);

            const result = FormInspectionService.getFormHierarchy();

            expect(result[0].children[0].children).toEqual([]);
        });
    });

    describe('getWebResourceByName', () => {
        it('should return null for empty web resource name', async () => {
            const retrieveMultiple = vi.fn();

            const result = await FormInspectionService.getWebResourceByName(retrieveMultiple, '');

            expect(result).toBeNull();
            expect(retrieveMultiple).not.toHaveBeenCalled();
        });

        it('should return null for null web resource name', async () => {
            const retrieveMultiple = vi.fn();

            const result = await FormInspectionService.getWebResourceByName(retrieveMultiple, null);

            expect(result).toBeNull();
        });

        it('should return null when web resource not found', async () => {
            const retrieveMultiple = vi.fn(() => Promise.resolve({ entities: [] }));

            const result = await FormInspectionService.getWebResourceByName(retrieveMultiple, 'nonexistent.js');

            expect(result).toBeNull();
        });

        it('should return web resource data when found', async () => {
            const mockContent = globalThis.btoa('function test() {}');
            const retrieveMultiple = vi.fn(() => Promise.resolve({
                entities: [{
                    webresourceid: 'wr-123',
                    name: 'test.js',
                    displayname: 'Test Script',
                    content: mockContent,
                    webresourcetype: 3
                }]
            }));

            const result = await FormInspectionService.getWebResourceByName(retrieveMultiple, 'test.js');

            expect(result).toEqual({
                id: 'wr-123',
                name: 'test.js',
                displayName: 'Test Script',
                content: 'function test() {}',
                webresourcetype: 3,
                isCustomizable: true,
                isHidden: false,
                isManaged: false
            });
        });

        it('should use name as displayName when displayname is not set', async () => {
            const retrieveMultiple = vi.fn(() => Promise.resolve({
                entities: [{
                    webresourceid: 'wr-123',
                    name: 'test.js',
                    displayname: null,
                    content: globalThis.btoa(''),
                    webresourcetype: 3
                }]
            }));

            const result = await FormInspectionService.getWebResourceByName(retrieveMultiple, 'test.js');

            expect(result.displayName).toBe('test.js');
        });

        it('should return empty string for content when not set', async () => {
            const retrieveMultiple = vi.fn(() => Promise.resolve({
                entities: [{
                    webresourceid: 'wr-123',
                    name: 'test.js',
                    displayname: 'Test',
                    content: null,
                    webresourcetype: 3
                }]
            }));

            const result = await FormInspectionService.getWebResourceByName(retrieveMultiple, 'test.js');

            expect(result.content).toBe('');
        });

        /** Stores `source` the way Dataverse does: base64 of its UTF-8 bytes. */
        const storedAs = (source) => Buffer.from(source, 'utf8').toString('base64');

        const readBack = async (base64) => {
            const retrieveMultiple = vi.fn(() => Promise.resolve({
                entities: [{ webresourceid: 'wr-1', name: 'test.js', content: base64, webresourcetype: 3 }]
            }));
            const result = await FormInspectionService.getWebResourceByName(retrieveMultiple, 'test.js');
            return result.content;
        };

        it('should decode UTF-8 content instead of returning raw bytes', async () => {
            // atob alone yields one character per byte, turning `café` into `cafÃ©`.
            expect(await readBack(storedAs('var s = "café — naïve";'))).toBe('var s = "café — naïve";');
        });

        it('should decode content outside the basic multilingual plane', async () => {
            expect(await readBack(storedAs('// 世界 🚀'))).toBe('// 世界 🚀');
        });

        it('should survive a read/write round trip without corrupting the file', async () => {
            // The bug that mattered: the editor read a script, the user saved it, and every
            // non-ASCII character was rewritten mangled — compounding on each save.
            const original = 'var msg = "café — 90% naïve";';
            const content = await readBack(storedAs(original));

            const updateRecord = vi.fn(() => Promise.resolve());
            await FormInspectionService.updateWebResourceContent(updateRecord, 'wr-1', content);

            expect(updateRecord.mock.calls[0][2].content).toBe(storedAs(original));
        });

        it('should fall back to the raw bytes when the content is not valid UTF-8', async () => {
            // A Windows-1252 file must not come back peppered with U+FFFD.
            const latin1 = Buffer.from([0x76, 0x61, 0x72, 0x20, 0xe9]).toString('base64');

            const content = await readBack(latin1);

            expect(content).toBe('var é');
            expect(content).not.toContain('�');
        });
    });

    describe('updateWebResourceContent', () => {
        it('should call updateRecord with base64 encoded content', async () => {
            const updateRecord = vi.fn(() => Promise.resolve());

            await FormInspectionService.updateWebResourceContent(updateRecord, 'wr-123', 'function test() {}');

            expect(updateRecord).toHaveBeenCalledWith('webresource', 'wr-123', {
                content: expect.any(String)
            });
        });

        it('should properly encode UTF-8 characters', async () => {
            const updateRecord = vi.fn(() => Promise.resolve());

            await FormInspectionService.updateWebResourceContent(updateRecord, 'wr-123', 'Hello 世界');

            const call = updateRecord.mock.calls[0];
            const encodedContent = call[2].content;
            const decodedContent = decodeURIComponent(escape(globalThis.atob(encodedContent)));

            expect(decodedContent).toBe('Hello 世界');
        });
    });

    describe('publishWebResource', () => {
        it('should call PublishXml with correct parameters', async () => {
            const webApiFetch = vi.fn(() => Promise.resolve());

            await FormInspectionService.publishWebResource(webApiFetch, 'wr-123');

            expect(webApiFetch).toHaveBeenCalledWith(
                'POST',
                'PublishXml',
                '',
                { ParameterXml: expect.stringContaining('wr-123') }
            );
        });

        it('should include webresource in the publish XML', async () => {
            const webApiFetch = vi.fn(() => Promise.resolve());

            await FormInspectionService.publishWebResource(webApiFetch, 'test-guid');

            const call = webApiFetch.mock.calls[0];
            expect(call[3].ParameterXml).toContain('<webresource>{test-guid}</webresource>');
        });
    });

    describe('getFormEventHandlers passContext and parameters', () => {
        it('should include passContext in handler data', async () => {
            const formXml = `<form>
                <events>
                    <event name="onload">
                        <Handler libraryName="test.js" functionName="onLoad" enabled="true" passExecutionContext="true" parameters="param1,param2"/>
                    </event>
                </events>
            </form>`;

            const webApiFetch = vi.fn(() => Promise.resolve({ formxml: formXml }));

            // Mock the form ID
            global.Xrm = {
                Page: {
                    ui: {
                        formSelector: {
                            getCurrentItem: () => ({
                                getId: () => 'form-123'
                            })
                        }
                    }
                }
            };

            const result = await FormInspectionService.getFormEventHandlers(webApiFetch);

            expect(result.OnLoad[0].passContext).toBe(true);
            expect(result.OnLoad[0].parameters).toBe('param1,param2');
        });

        it('should include formId in the returned object', async () => {
            const formXml = `<form><events></events></form>`;
            const webApiFetch = vi.fn(() => Promise.resolve({ formxml: formXml }));

            global.Xrm = {
                Page: {
                    ui: {
                        formSelector: {
                            getCurrentItem: () => ({
                                getId: () => 'form-456'
                            })
                        }
                    }
                }
            };

            const result = await FormInspectionService.getFormEventHandlers(webApiFetch);

            expect(result.formId).toBe('form-456');
        });
    });

    describe('getFormEventHandlers field-level events', () => {
        it('should parse OnChange handlers from field cells', async () => {
            const formXml = `<form>
                <events></events>
                <tabs>
                    <tab>
                        <columns>
                            <column>
                                <sections>
                                    <section>
                                        <rows>
                                            <row>
                                                <cell>
                                                    <control id="name" datafieldname="name" />
                                                    <events>
                                                        <event name="onchange">
                                                            <Handler libraryName="custom.js" functionName="onNameChange" enabled="true" passExecutionContext="true" />
                                                        </event>
                                                    </events>
                                                </cell>
                                            </row>
                                        </rows>
                                    </section>
                                </sections>
                            </column>
                        </columns>
                    </tab>
                </tabs>
            </form>`;

            const webApiFetch = vi.fn(() => Promise.resolve({ formxml: formXml }));

            global.Xrm = {
                Page: {
                    ui: {
                        formSelector: {
                            getCurrentItem: () => ({
                                getId: () => 'form-789'
                            })
                        }
                    }
                }
            };

            const result = await FormInspectionService.getFormEventHandlers(webApiFetch);

            expect(result.OnChange).toBeDefined();
            expect(result.OnChange.length).toBe(1);
            expect(result.OnChange[0].function).toBe('onNameChange');
            expect(result.OnChange[0].library).toBe('custom.js');
            expect(result.OnChange[0].field).toBe('name');
            expect(result.OnChange[0].passContext).toBe(true);
        });

        it('should return empty OnChange array when no field events', async () => {
            const formXml = `<form>
                <events>
                    <event name="onload">
                        <Handler libraryName="test.js" functionName="onLoad" enabled="true" />
                    </event>
                </events>
            </form>`;

            const webApiFetch = vi.fn(() => Promise.resolve({ formxml: formXml }));

            global.Xrm = {
                Page: {
                    ui: {
                        formSelector: {
                            getCurrentItem: () => ({
                                getId: () => 'form-123'
                            })
                        }
                    }
                }
            };

            const result = await FormInspectionService.getFormEventHandlers(webApiFetch);

            expect(result.OnChange).toBeDefined();
            expect(result.OnChange.length).toBe(0);
        });

        it('should handle multiple OnChange handlers across different fields', async () => {
            const formXml = `<form>
                <events></events>
                <tabs>
                    <tab>
                        <columns>
                            <column>
                                <sections>
                                    <section>
                                        <rows>
                                            <row>
                                                <cell>
                                                    <control id="firstname" datafieldname="firstname" />
                                                    <events>
                                                        <event name="onchange">
                                                            <Handler libraryName="custom.js" functionName="onFirstNameChange" enabled="true" />
                                                        </event>
                                                    </events>
                                                </cell>
                                                <cell>
                                                    <control id="lastname" datafieldname="lastname" />
                                                    <events>
                                                        <event name="onchange">
                                                            <Handler libraryName="custom.js" functionName="onLastNameChange" enabled="true" />
                                                        </event>
                                                    </events>
                                                </cell>
                                            </row>
                                        </rows>
                                    </section>
                                </sections>
                            </column>
                        </columns>
                    </tab>
                </tabs>
            </form>`;

            const webApiFetch = vi.fn(() => Promise.resolve({ formxml: formXml }));

            global.Xrm = {
                Page: {
                    ui: {
                        formSelector: {
                            getCurrentItem: () => ({
                                getId: () => 'form-123'
                            })
                        }
                    }
                }
            };

            const result = await FormInspectionService.getFormEventHandlers(webApiFetch);

            expect(result.OnChange.length).toBe(2);
            expect(result.OnChange[0].field).toBe('firstname');
            expect(result.OnChange[1].field).toBe('lastname');
        });

        it('should use control datafieldname as fallback when id is not set', async () => {
            const formXml = `<form>
                <events></events>
                <tabs>
                    <tab>
                        <columns>
                            <column>
                                <sections>
                                    <section>
                                        <rows>
                                            <row>
                                                <cell>
                                                    <control datafieldname="accountid" />
                                                    <events>
                                                        <event name="onchange">
                                                            <Handler libraryName="custom.js" functionName="onAccountChange" enabled="true" />
                                                        </event>
                                                    </events>
                                                </cell>
                                            </row>
                                        </rows>
                                    </section>
                                </sections>
                            </column>
                        </columns>
                    </tab>
                </tabs>
            </form>`;

            const webApiFetch = vi.fn(() => Promise.resolve({ formxml: formXml }));

            global.Xrm = {
                Page: {
                    ui: {
                        formSelector: {
                            getCurrentItem: () => ({
                                getId: () => 'form-123'
                            })
                        }
                    }
                }
            };

            const result = await FormInspectionService.getFormEventHandlers(webApiFetch);

            expect(result.OnChange[0].field).toBe('accountid');
        });
    });
});