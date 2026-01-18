/**
 * @file Comprehensive Tests for FormInspectionService
 * @module tests/services/FormInspectionService.test.js
 * @description Tests for form hierarchy, columns, and event handler inspection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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
                entities: [{ formid: 'form-id-123' }]
            });
            const retrieveRecord = vi.fn().mockResolvedValue({ formxml: formXml });

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

        it('should return null when form has no formxml', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ formid: 'form-id-123' }]
            });
            const retrieveRecord = vi.fn().mockResolvedValue({ formxml: null });

            const result = await FormInspectionService.getFormEventHandlersForEntity(
                retrieveMultipleRecords, retrieveRecord, 'account'
            );

            expect(result).toBeNull();
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
                entities: [{ formid: 'form-id-123' }]
            });
            const retrieveRecord = vi.fn().mockResolvedValue({ formxml: formXml });

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
});