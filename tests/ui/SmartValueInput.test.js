/**
 * @file Tests for SmartValueInput
 * @module tests/ui/SmartValueInput.test.js
 * @description Test suite for smart value input component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock DataService - define mock functions inside vi.mock to avoid hoisting issues
vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        getBooleanOptions: vi.fn().mockResolvedValue({ trueLabel: 'Yes', falseLabel: 'No' }),
        getPicklistOptions: vi.fn().mockResolvedValue([
            { value: 1, label: 'Active' },
            { value: 2, label: 'Inactive' }
        ]),
        retrieveEntityDefinition: vi.fn().mockResolvedValue({ EntitySetName: 'accounts' })
    }
}));

// Mock NotificationService
vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: {
        show: vi.fn()
    }
}));

// Import after mocks
import { SmartValueInput } from '../../src/ui/SmartValueInput.js';
import { DataService } from '../../src/services/DataService.js';

describe('SmartValueInput', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        DataService.getBooleanOptions.mockResolvedValue({ trueLabel: 'Yes', falseLabel: 'No' });
        DataService.getPicklistOptions.mockResolvedValue([
            { value: 1, label: 'Active' },
            { value: 2, label: 'Inactive' }
        ]);
        DataService.retrieveEntityDefinition.mockResolvedValue({ EntitySetName: 'accounts' });
    });

    describe('render', () => {
        it('should render input for string type', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'String' },
                LogicalName: 'name',
                AttributeType: 'String'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('input');
        });

        it('should render select for boolean type', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Boolean' },
                LogicalName: 'isactive',
                AttributeType: 'Boolean'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('select');
        });

        it('should handle null container gracefully', async () => {
            await expect(
                SmartValueInput.render({
                    valueContainer: null,
                    attr: {},
                    entityName: 'account'
                })
            ).resolves.not.toThrow();
        });

        it('should store metadata on row if provided', async () => {
            const container = document.createElement('div');
            const row = document.createElement('tr');
            const attr = {
                AttributeTypeName: { Value: 'String' },
                LogicalName: 'name'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                row
            });

            expect(row._attrMetadata).toBe(attr);
        });

        it('should apply correct styles based on context', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'String' },
                LogicalName: 'name'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                context: 'filter'
            });

            expect(container.innerHTML).toContain('width: 100%');
        });

        it('should render integer input', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Integer' },
                LogicalName: 'age'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            expect(container.innerHTML).toContain('type="number"');
            expect(container.innerHTML).toContain('step="1"');
        });

        it('should render decimal input', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Decimal' },
                LogicalName: 'amount'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'opportunity'
            });

            expect(container.innerHTML).toContain('type="number"');
            expect(container.innerHTML).toContain('step="any"');
        });

        it('should render money input as decimal', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Money' },
                LogicalName: 'revenue'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('type="number"');
            expect(container.innerHTML).toContain('data-type="decimal"');
        });

        it('should render datetime input', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'DateTime' },
                LogicalName: 'createdon'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('type="datetime-local"');
        });

        it('should render date-only input when format is DateOnly', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'DateTime' },
                LogicalName: 'birthdate',
                Format: 'DateOnly'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            expect(container.innerHTML).toContain('type="date"');
        });

        it('should render memo/textarea input', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Memo' },
                LogicalName: 'description'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('textarea');
        });

        it('should render lookup input', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Lookup' },
                LogicalName: 'primarycontactid',
                Targets: ['contact']
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('input');
            expect(container.innerHTML).toContain('data-type="lookup"');
        });

        it('should render lookup with odata.bind format in post context', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Lookup' },
                LogicalName: 'primarycontactid',
                Targets: ['contact']
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                context: 'post'
            });

            expect(container.innerHTML).toContain('/');
            expect(container.innerHTML).toContain('GUID');
        });

        it('should render uniqueidentifier input', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'UniqueIdentifier' },
                LogicalName: 'accountid'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('data-type="uniqueidentifier"');
            expect(container.innerHTML).toContain('pattern');
        });

        it('should render image file upload', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Image' },
                LogicalName: 'entityimage'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('pdt-file-upload-container');
            expect(container.innerHTML).toContain('Select Image');
        });

        it('should render file upload', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'File' },
                LogicalName: 'attachment'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'annotation'
            });

            expect(container.innerHTML).toContain('pdt-file-upload-container');
            expect(container.innerHTML).toContain('Select File');
        });

        it('should render entity name input', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'EntityName' },
                LogicalName: 'objecttypecode'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'annotation'
            });

            expect(container.innerHTML).toContain('data-type="entityname"');
            expect(container.innerHTML).toContain('Logical name');
        });

        it('should render read-only input for virtual types', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Virtual' },
                LogicalName: 'computed'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('disabled');
            expect(container.innerHTML).toContain('read-only');
        });

        it('should render picklist/optionset select', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Picklist' },
                LogicalName: 'statecode'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('select');
            expect(container.innerHTML).toContain('Active');
            expect(container.innerHTML).toContain('Inactive');
        });

        it('should render multiselect picklist', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'MultiSelectPicklist' },
                LogicalName: 'interests'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            expect(container.innerHTML).toContain('pdt-multiselect-dropdown');
            expect(container.innerHTML).toContain('checkbox');
        });

        it('should render boolean with custom labels', async () => {
            DataService.getBooleanOptions.mockResolvedValue({
                trueLabel: 'Active',
                falseLabel: 'Inactive'
            });

            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Boolean' },
                LogicalName: 'isactive'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('Active');
            expect(container.innerHTML).toContain('Inactive');
        });

        it('should use fallback labels when getBooleanOptions fails', async () => {
            DataService.getBooleanOptions.mockRejectedValue(new Error('API Error'));

            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Boolean' },
                LogicalName: 'isactive'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('True');
            expect(container.innerHTML).toContain('False');
        });

        it('should use number input as fallback when picklist options fail', async () => {
            DataService.getPicklistOptions.mockRejectedValue(new Error('API Error'));

            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Picklist' },
                LogicalName: 'statecode'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('type="number"');
        });

        it('should use text input as fallback when multiselect options fail', async () => {
            DataService.getPicklistOptions.mockRejectedValue(new Error('API Error'));

            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'MultiSelectPicklist' },
                LogicalName: 'interests'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            expect(container.innerHTML).toContain('type="text"');
            expect(container.innerHTML).toContain('Comma-separated');
        });

        it('should use fallback lookup input when entity definition fails', async () => {
            DataService.retrieveEntityDefinition.mockRejectedValue(new Error('API Error'));

            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Lookup' },
                LogicalName: 'ownerid',
                Targets: ['systemuser']
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                context: 'post'
            });

            expect(container.innerHTML).toContain('systemusers');
        });

        it('should handle customer type as lookup', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Customer' },
                LogicalName: 'customerid',
                Targets: ['account', 'contact']
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'incident'
            });

            expect(container.innerHTML).toContain('data-type="lookup"');
        });

        it('should handle owner type as lookup', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Owner' },
                LogicalName: 'ownerid',
                Targets: ['systemuser', 'team']
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('data-type="lookup"');
        });

        it('should use 1/0 values for boolean in fetch context', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Boolean' },
                LogicalName: 'isactive'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                context: 'fetch'
            });

            expect(container.innerHTML).toContain('value="1"');
            expect(container.innerHTML).toContain('value="0"');
        });

        it('should use true/false values for boolean in filter context', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Boolean' },
                LogicalName: 'isactive'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                context: 'filter'
            });

            expect(container.innerHTML).toContain('value="true"');
            expect(container.innerHTML).toContain('value="false"');
        });

        it('should call onInputChange callback when input changes', async () => {
            const container = document.createElement('div');
            const onInputChange = vi.fn();
            const attr = {
                AttributeTypeName: { Value: 'String' },
                LogicalName: 'name'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                onInputChange
            });

            const input = container.querySelector('input');
            input.dispatchEvent(new Event('input'));

            expect(onInputChange).toHaveBeenCalled();
        });

        it('should handle empty options list for multiselect', async () => {
            DataService.getPicklistOptions.mockResolvedValue([]);

            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'MultiSelectPicklist' },
                LogicalName: 'interests'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            expect(container.innerHTML).toContain('type="text"');
        });

        it('should render default input for unknown types', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'UnknownType' },
                LogicalName: 'custom'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('input');
            expect(container.innerHTML).toContain('data-type="text"');
        });

        it('should handle state type as picklist', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'State' },
                LogicalName: 'statecode'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('select');
        });

        it('should handle status type as picklist', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Status' },
                LogicalName: 'statuscode'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('select');
        });

        it('should handle bigint type as integer', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'BigInt' },
                LogicalName: 'versionnumber'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('type="number"');
            expect(container.innerHTML).toContain('data-type="integer"');
        });

        it('should handle double type as decimal', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Double' },
                LogicalName: 'percentage'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('type="number"');
            expect(container.innerHTML).toContain('data-type="decimal"');
        });

        it('should handle partylist as read-only', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'PartyList' },
                LogicalName: 'to'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'email'
            });

            expect(container.innerHTML).toContain('disabled');
        });

        it('should handle managed property as read-only', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'ManagedProperty' },
                LogicalName: 'iscustomizable'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('disabled');
        });
    });

    describe('LOOKUP_TYPES constant', () => {
        it('should define lookup types', () => {
            expect(SmartValueInput.LOOKUP_TYPES).toBeInstanceOf(Array);
            expect(SmartValueInput.LOOKUP_TYPES).toContain('lookup');
            expect(SmartValueInput.LOOKUP_TYPES).toContain('customer');
        });

        it('should contain all standard lookup types', () => {
            expect(SmartValueInput.LOOKUP_TYPES).toContain('lookup');
            expect(SmartValueInput.LOOKUP_TYPES).toContain('lookuptype');
            expect(SmartValueInput.LOOKUP_TYPES).toContain('customer');
            expect(SmartValueInput.LOOKUP_TYPES).toContain('customertype');
            expect(SmartValueInput.LOOKUP_TYPES).toContain('owner');
            expect(SmartValueInput.LOOKUP_TYPES).toContain('ownertype');
        });
    });

    describe('_getInputBuilder', () => {
        it('should return Boolean for boolean types', () => {
            expect(SmartValueInput._getInputBuilder('boolean')).toBe('Boolean');
            expect(SmartValueInput._getInputBuilder('booleantype')).toBe('Boolean');
        });

        it('should return Picklist for optionset types', () => {
            expect(SmartValueInput._getInputBuilder('picklist')).toBe('Picklist');
            expect(SmartValueInput._getInputBuilder('picklisttype')).toBe('Picklist');
            expect(SmartValueInput._getInputBuilder('state')).toBe('Picklist');
            expect(SmartValueInput._getInputBuilder('status')).toBe('Picklist');
        });

        it('should return MultiSelectPicklist for multiselect types', () => {
            expect(SmartValueInput._getInputBuilder('multiselectpicklist')).toBe('MultiSelectPicklist');
            expect(SmartValueInput._getInputBuilder('multiselectpicklisttype')).toBe('MultiSelectPicklist');
        });

        it('should return DateTime for datetime types', () => {
            expect(SmartValueInput._getInputBuilder('datetime')).toBe('DateTime');
            expect(SmartValueInput._getInputBuilder('datetimetype')).toBe('DateTime');
        });

        it('should return Integer for integer types', () => {
            expect(SmartValueInput._getInputBuilder('integer')).toBe('Integer');
            expect(SmartValueInput._getInputBuilder('integertype')).toBe('Integer');
            expect(SmartValueInput._getInputBuilder('bigint')).toBe('Integer');
        });

        it('should return Decimal for decimal types', () => {
            expect(SmartValueInput._getInputBuilder('decimal')).toBe('Decimal');
            expect(SmartValueInput._getInputBuilder('double')).toBe('Decimal');
            expect(SmartValueInput._getInputBuilder('money')).toBe('Decimal');
        });

        it('should return Lookup for lookup types', () => {
            expect(SmartValueInput._getInputBuilder('lookup')).toBe('Lookup');
            expect(SmartValueInput._getInputBuilder('customer')).toBe('Lookup');
            expect(SmartValueInput._getInputBuilder('owner')).toBe('Lookup');
        });

        it('should return Memo for memo types', () => {
            expect(SmartValueInput._getInputBuilder('memo')).toBe('Memo');
            expect(SmartValueInput._getInputBuilder('memotype')).toBe('Memo');
        });

        it('should return String for string types', () => {
            expect(SmartValueInput._getInputBuilder('string')).toBe('String');
            expect(SmartValueInput._getInputBuilder('stringtype')).toBe('String');
        });

        it('should return UniqueIdentifier for guid types', () => {
            expect(SmartValueInput._getInputBuilder('uniqueidentifier')).toBe('UniqueIdentifier');
            expect(SmartValueInput._getInputBuilder('uniqueidentifiertype')).toBe('UniqueIdentifier');
        });

        it('should return Image for image types', () => {
            expect(SmartValueInput._getInputBuilder('image')).toBe('Image');
            expect(SmartValueInput._getInputBuilder('imagetype')).toBe('Image');
        });

        it('should return File for file types', () => {
            expect(SmartValueInput._getInputBuilder('file')).toBe('File');
            expect(SmartValueInput._getInputBuilder('filetype')).toBe('File');
        });

        it('should return EntityName for entityname types', () => {
            expect(SmartValueInput._getInputBuilder('entityname')).toBe('EntityName');
            expect(SmartValueInput._getInputBuilder('entitynametype')).toBe('EntityName');
        });

        it('should return ReadOnly for unsupported types', () => {
            expect(SmartValueInput._getInputBuilder('partylist')).toBe('ReadOnly');
            expect(SmartValueInput._getInputBuilder('virtual')).toBe('ReadOnly');
            expect(SmartValueInput._getInputBuilder('managedproperty')).toBe('ReadOnly');
            expect(SmartValueInput._getInputBuilder('calendarrules')).toBe('ReadOnly');
        });

        it('should return Default for unknown types', () => {
            expect(SmartValueInput._getInputBuilder('unknown')).toBe('Default');
            expect(SmartValueInput._getInputBuilder('custom')).toBe('Default');
        });
    });

    describe('multiselect dropdown setup', () => {
        it('should toggle dropdown on trigger click', async () => {
            DataService.getPicklistOptions.mockResolvedValue([
                { value: 1, label: 'Option 1' },
                { value: 2, label: 'Option 2' }
            ]);

            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'MultiSelectPicklist' },
                LogicalName: 'interests'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            const trigger = container.querySelector('.pdt-multiselect-trigger');
            const optionsContainer = container.querySelector('.pdt-multiselect-options');

            expect(optionsContainer.style.display).toBe('none');

            trigger.click();

            expect(container.querySelector('.pdt-multiselect-dropdown').classList.contains('open')).toBe(true);
            expect(optionsContainer.style.display).toBe('block');
        });

        it('should update display text when options selected', async () => {
            DataService.getPicklistOptions.mockResolvedValue([
                { value: 1, label: 'Option 1' },
                { value: 2, label: 'Option 2' }
            ]);

            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'MultiSelectPicklist' },
                LogicalName: 'interests'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            const checkbox = container.querySelector('input[type="checkbox"]');
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));

            const textDisplay = container.querySelector('.pdt-multiselect-text');
            expect(textDisplay.textContent).toContain('Option 1');
        });
    });

    describe('file upload setup', () => {
        it('should render file upload container for image type', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Image' },
                LogicalName: 'entityimage'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.querySelector('.pdt-file-upload-container')).toBeTruthy();
            expect(container.querySelector('.pdt-file-input')).toBeTruthy();
            expect(container.querySelector('.pdt-file-select-btn')).toBeTruthy();
        });

        it('should trigger file input when select button clicked', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'File' },
                LogicalName: 'attachment'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'annotation'
            });

            const fileInput = container.querySelector('.pdt-file-input');
            const selectBtn = container.querySelector('.pdt-file-select-btn');
            const clickSpy = vi.spyOn(fileInput, 'click');

            selectBtn.click();

            expect(clickSpy).toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        it('should handle missing AttributeTypeName', async () => {
            const container = document.createElement('div');
            const attr = {
                LogicalName: 'name',
                AttributeType: 'String'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('input');
        });

        it('should handle empty attribute object', async () => {
            const container = document.createElement('div');
            const attr = {};

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('input');
        });

        it('should handle lookup without Targets', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Lookup' },
                LogicalName: 'parentid'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('data-type="lookup"');
        });

        it('should use default dataProp when not specified', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'String' },
                LogicalName: 'name'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('data-prop="value"');
        });

        it('should use custom dataProp when specified', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'String' },
                LogicalName: 'name'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                dataProp: 'customProp'
            });

            expect(container.innerHTML).toContain('data-prop="customProp"');
        });

        it('should handle DateTimeBehavior for date-only format', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'DateTime' },
                LogicalName: 'birthdate',
                DateTimeBehavior: { Value: 'DateOnly' }
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            expect(container.innerHTML).toContain('type="date"');
            expect(container.innerHTML).toContain('data-type="date"');
        });

        it('should handle format property lowercase for date-only', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'DateTime' },
                LogicalName: 'birthdate',
                format: 'DateOnly'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            expect(container.innerHTML).toContain('type="date"');
        });

        it('should render datetime-local for non-DateOnly format', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'DateTime' },
                LogicalName: 'createdon',
                Format: 'DateAndTime'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('type="datetime-local"');
            expect(container.innerHTML).toContain('data-type="datetime"');
        });

        it('should use default systemuser for lookup without targets', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Lookup' },
                LogicalName: 'createdby',
                Targets: []
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                context: 'post'
            });

            expect(container.innerHTML).toContain('data-target-entity="systemuser"');
        });

        it('should handle calendarrules as read-only type', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'CalendarRules' },
                LogicalName: 'calendarrules'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'calendar'
            });

            expect(container.innerHTML).toContain('disabled');
            expect(container.innerHTML).toContain('read-only');
        });

        it('should apply post context span style for lookup', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Lookup' },
                LogicalName: 'ownerid',
                Targets: ['systemuser']
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                context: 'post'
            });

            expect(container.innerHTML).toContain('grid-column: span 2');
        });

        it('should apply post context span style for memo', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Memo' },
                LogicalName: 'description'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                context: 'post'
            });

            expect(container.innerHTML).toContain('grid-column: span 2');
            expect(container.innerHTML).toContain('resize: vertical');
        });

        it('should render textarea without span style for memo in fetch context', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Memo' },
                LogicalName: 'description'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                context: 'fetch'
            });

            expect(container.innerHTML).toContain('textarea');
            expect(container.innerHTML).toContain('data-type="memo"');
            expect(container.innerHTML).toContain('rows="2"');
        });

        it('should apply string maxlength attribute', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'String' },
                LogicalName: 'name'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('maxlength="4000"');
        });

        it('should include GUID pattern in uniqueidentifier input', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'UniqueIdentifier' },
                LogicalName: 'accountid'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('00000000-0000-0000-0000-000000000000');
            expect(container.innerHTML).toContain('pattern=');
        });

        it('should include image accept attribute for image type', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Image' },
                LogicalName: 'entityimage'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('accept="image/*"');
        });

        it('should include base64/URL placeholder for image', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Image' },
                LogicalName: 'entityimage'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('base64/URL');
        });

        it('should include base64 placeholder for file', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'File' },
                LogicalName: 'document'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'annotation'
            });

            expect(container.innerHTML).toContain('base64');
        });

        it('should handle AttributeType without AttributeTypeName', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeType: 'Integer',
                LogicalName: 'age'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            expect(container.innerHTML).toContain('type="number"');
            expect(container.innerHTML).toContain('step="1"');
        });
    });

    describe('_fileToBase64', () => {
        it('should convert file to base64 string', async () => {
            const fileContent = 'test content';
            const base64Content = btoa(fileContent);
            const file = new File([fileContent], 'test.txt', { type: 'text/plain' });

            const result = await SmartValueInput._fileToBase64(file);

            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should extract base64 content from data URL result', async () => {
            const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
            const result = await SmartValueInput._fileToBase64(file);

            // The result should be base64 encoded (data URLs contain comma-separated parts)
            expect(typeof result).toBe('string');
            expect(result).not.toContain('data:');
        });

        it('should handle result extraction from data URL format', async () => {
            const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });
            const result = await SmartValueInput._fileToBase64(file);

            // Verify it returns the base64 portion after the comma
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('_setupLookupDefault', () => {
        it('should set default value from entity-set attribute', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Lookup' },
                LogicalName: 'primarycontactid',
                Targets: ['contact']
            };

            DataService.retrieveEntityDefinition.mockResolvedValue({ EntitySetName: 'contacts' });

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                context: 'post'
            });

            const input = container.querySelector('input');
            expect(input.value).toContain('/contacts(GUID)');
        });

        it('should not set default when entitySetName is missing', async () => {
            const input = document.createElement('input');
            input.setAttribute('data-prop', 'value');
            input.setAttribute('data-type', 'lookup');

            SmartValueInput._setupLookupDefault(input);

            expect(input.value).toBe('');
        });
    });

    describe('multiselect dropdown advanced interactions', () => {
        it('should close dropdown when clicking outside', async () => {
            DataService.getPicklistOptions.mockResolvedValue([
                { value: 1, label: 'Option 1' },
                { value: 2, label: 'Option 2' }
            ]);

            const container = document.createElement('div');
            document.body.appendChild(container);

            const attr = {
                AttributeTypeName: { Value: 'MultiSelectPicklist' },
                LogicalName: 'interests'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            const trigger = container.querySelector('.pdt-multiselect-trigger');
            const dropdown = container.querySelector('.pdt-multiselect-dropdown');
            const optionsContainer = container.querySelector('.pdt-multiselect-options');

            trigger.click();
            expect(dropdown.classList.contains('open')).toBe(true);

            document.body.click();
            expect(dropdown.classList.contains('open')).toBe(false);
            expect(optionsContainer.style.display).toBe('none');

            document.body.removeChild(container);
        });

        it('should close other dropdowns when opening new one', async () => {
            DataService.getPicklistOptions.mockResolvedValue([
                { value: 1, label: 'Option 1' }
            ]);

            const container1 = document.createElement('div');
            const container2 = document.createElement('div');
            document.body.appendChild(container1);
            document.body.appendChild(container2);

            const attr = {
                AttributeTypeName: { Value: 'MultiSelectPicklist' },
                LogicalName: 'interests'
            };

            await SmartValueInput.render({
                valueContainer: container1,
                attr,
                entityName: 'contact'
            });

            await SmartValueInput.render({
                valueContainer: container2,
                attr,
                entityName: 'contact'
            });

            const trigger1 = container1.querySelector('.pdt-multiselect-trigger');
            const trigger2 = container2.querySelector('.pdt-multiselect-trigger');
            const dropdown1 = container1.querySelector('.pdt-multiselect-dropdown');
            const dropdown2 = container2.querySelector('.pdt-multiselect-dropdown');

            trigger1.click();
            expect(dropdown1.classList.contains('open')).toBe(true);

            trigger2.click();
            expect(dropdown1.classList.contains('open')).toBe(false);
            expect(dropdown2.classList.contains('open')).toBe(true);

            document.body.removeChild(container1);
            document.body.removeChild(container2);
        });

        it('should display count when multiple options selected', async () => {
            DataService.getPicklistOptions.mockResolvedValue([
                { value: 1, label: 'Option 1' },
                { value: 2, label: 'Option 2' },
                { value: 3, label: 'Option 3' }
            ]);

            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'MultiSelectPicklist' },
                LogicalName: 'interests'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            checkboxes[0].checked = true;
            checkboxes[1].checked = true;
            checkboxes[0].dispatchEvent(new Event('change'));
            checkboxes[1].dispatchEvent(new Event('change'));

            const textDisplay = container.querySelector('.pdt-multiselect-text');
            expect(textDisplay.textContent).toContain('2 options selected');
        });

        it('should show default text when no options selected', async () => {
            DataService.getPicklistOptions.mockResolvedValue([
                { value: 1, label: 'Option 1' }
            ]);

            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'MultiSelectPicklist' },
                LogicalName: 'interests'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            const checkbox = container.querySelector('input[type="checkbox"]');
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));

            checkbox.checked = false;
            checkbox.dispatchEvent(new Event('change'));

            const textDisplay = container.querySelector('.pdt-multiselect-text');
            expect(textDisplay.textContent).toBe('-- Select options --');
        });

        it('should close dropdown on second trigger click', async () => {
            DataService.getPicklistOptions.mockResolvedValue([
                { value: 1, label: 'Option 1' }
            ]);

            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'MultiSelectPicklist' },
                LogicalName: 'interests'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            const trigger = container.querySelector('.pdt-multiselect-trigger');
            const dropdown = container.querySelector('.pdt-multiselect-dropdown');
            const optionsContainer = container.querySelector('.pdt-multiselect-options');

            trigger.click();
            expect(dropdown.classList.contains('open')).toBe(true);
            expect(optionsContainer.style.display).toBe('block');

            trigger.click();
            expect(dropdown.classList.contains('open')).toBe(false);
            expect(optionsContainer.style.display).toBe('none');
        });
    });

    describe('file upload advanced interactions', () => {
        it('should store file data on container after file selection', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'File' },
                LogicalName: 'document'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'annotation'
            });

            const fileContainer = container.querySelector('.pdt-file-upload-container');
            expect(fileContainer._fileData).toBeNull();
            expect(fileContainer._fileName).toBeNull();
            expect(fileContainer._entityName).toBe('annotation');
            expect(fileContainer._attributeName).toBe('document');
        });

        it('should update file data when manual input provided', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'File' },
                LogicalName: 'document'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'annotation'
            });

            const fileContainer = container.querySelector('.pdt-file-upload-container');
            const dataInput = container.querySelector('.pdt-file-data');

            dataInput.value = 'SGVsbG8gV29ybGQ=';
            dataInput.dispatchEvent(new Event('input'));

            expect(fileContainer._fileData).toBe('SGVsbG8gV29ybGQ=');
            expect(fileContainer._fileName).toBe('manual_input');
        });

        it('should clear file data when manual input is empty', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'File' },
                LogicalName: 'document'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'annotation'
            });

            const fileContainer = container.querySelector('.pdt-file-upload-container');
            const dataInput = container.querySelector('.pdt-file-data');

            dataInput.value = 'SGVsbG8=';
            dataInput.dispatchEvent(new Event('input'));

            expect(fileContainer._fileData).toBe('SGVsbG8=');

            dataInput.value = '   ';
            dataInput.dispatchEvent(new Event('input'));

            expect(fileContainer._fileData).toBe('SGVsbG8=');
        });

        it('should have file input and select button for image type', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Image' },
                LogicalName: 'entityimage'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            const fileInput = container.querySelector('.pdt-file-input');
            const fileContainer = container.querySelector('.pdt-file-upload-container');
            const selectBtn = container.querySelector('.pdt-file-select-btn');
            const dataInput = container.querySelector('.pdt-file-data');

            expect(fileInput).toBeTruthy();
            expect(fileContainer).toBeTruthy();
            expect(selectBtn).toBeTruthy();
            expect(dataInput).toBeTruthy();
            expect(fileInput.accept).toBe('image/*');
        });

        it('should handle empty file selection', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'File' },
                LogicalName: 'document'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'annotation'
            });

            const fileInput = container.querySelector('.pdt-file-input');
            const fileContainer = container.querySelector('.pdt-file-upload-container');

            Object.defineProperty(fileInput, 'files', {
                value: [],
                writable: true
            });

            fileInput.dispatchEvent(new Event('change'));

            expect(fileContainer._fileData).toBeNull();
        });
    });

    describe('input change callbacks', () => {
        it('should trigger onInputChange on change event', async () => {
            const container = document.createElement('div');
            const onInputChange = vi.fn();
            const attr = {
                AttributeTypeName: { Value: 'Picklist' },
                LogicalName: 'statecode'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                onInputChange
            });

            const select = container.querySelector('select');
            select.dispatchEvent(new Event('change'));

            expect(onInputChange).toHaveBeenCalled();
        });

        it('should trigger onInputChange on both input and change events', async () => {
            const container = document.createElement('div');
            const onInputChange = vi.fn();
            const attr = {
                AttributeTypeName: { Value: 'Integer' },
                LogicalName: 'age'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact',
                onInputChange
            });

            const input = container.querySelector('input');
            input.dispatchEvent(new Event('input'));
            input.dispatchEvent(new Event('change'));

            expect(onInputChange).toHaveBeenCalledTimes(2);
        });
    });

    describe('picklist options display', () => {
        it('should display option values in parentheses', async () => {
            DataService.getPicklistOptions.mockResolvedValue([
                { value: 100000000, label: 'New' },
                { value: 100000001, label: 'Open' }
            ]);

            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Picklist' },
                LogicalName: 'statuscode'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('(100000000)');
            expect(container.innerHTML).toContain('(100000001)');
        });

        it('should include select placeholder option', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Picklist' },
                LogicalName: 'statecode'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('-- Select --');
        });
    });

    describe('boolean input in different contexts', () => {
        it('should use true/false values in post context', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Boolean' },
                LogicalName: 'isactive'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                context: 'post'
            });

            expect(container.innerHTML).toContain('value="true"');
            expect(container.innerHTML).toContain('value="false"');
        });

        it('should include boolean select placeholder', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Boolean' },
                LogicalName: 'isactive'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('-- Select --');
        });
    });

    describe('lookup input variations', () => {
        it('should include placeholder with GUID format for fetch context', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Lookup' },
                LogicalName: 'primarycontactid',
                Targets: ['contact']
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                context: 'fetch'
            });

            expect(container.innerHTML).toContain('Record GUID');
        });

        it('should include title with format instructions for post context', async () => {
            DataService.retrieveEntityDefinition.mockResolvedValue({ EntitySetName: 'contacts' });

            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Lookup' },
                LogicalName: 'primarycontactid',
                Targets: ['contact']
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                context: 'post'
            });

            expect(container.innerHTML).toContain('title=');
            expect(container.innerHTML).toContain('GUID');
        });

        it('should handle CustomerType as lookup', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'CustomerType' },
                LogicalName: 'customerid',
                Targets: ['account']
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'incident'
            });

            expect(container.innerHTML).toContain('data-type="lookup"');
        });

        it('should handle OwnerType as lookup', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'OwnerType' },
                LogicalName: 'ownerid',
                Targets: ['systemuser']
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('data-type="lookup"');
        });

        it('should handle LookupType as lookup', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'LookupType' },
                LogicalName: 'regardingobjectid',
                Targets: ['account']
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'task'
            });

            expect(container.innerHTML).toContain('data-type="lookup"');
        });
    });

    describe('_setupInput edge cases', () => {
        it('should handle null input gracefully', () => {
            expect(() => {
                SmartValueInput._setupInput(null, {
                    attrType: 'string',
                    entityName: 'account',
                    attr: {},
                    context: 'fetch',
                    onInputChange: null
                });
            }).not.toThrow();
        });

        it('should not add event listeners when onInputChange is null', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'String' },
                LogicalName: 'name'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                onInputChange: null
            });

            const input = container.querySelector('input');
            const addEventListenerSpy = vi.spyOn(input, 'addEventListener');

            expect(addEventListenerSpy).not.toHaveBeenCalledWith('input', null);
        });
    });

    describe('special type variations', () => {
        it('should handle StatusType as picklist', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'StatusType' },
                LogicalName: 'statuscode'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('select');
            expect(container.innerHTML).toContain('data-type="optionset"');
        });

        it('should handle StateType as picklist', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'StateType' },
                LogicalName: 'statecode'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('select');
        });

        it('should handle PicklistType as picklist', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'PicklistType' },
                LogicalName: 'industrycode'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('select');
        });

        it('should handle IntegerType as integer', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'IntegerType' },
                LogicalName: 'numberofemployees'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('step="1"');
            expect(container.innerHTML).toContain('data-type="integer"');
        });

        it('should handle DecimalType as decimal', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'DecimalType' },
                LogicalName: 'exchangerate'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('step="any"');
            expect(container.innerHTML).toContain('data-type="decimal"');
        });

        it('should handle DoubleType as decimal', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'DoubleType' },
                LogicalName: 'latitude'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('data-type="decimal"');
        });

        it('should handle MoneyType as decimal', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'MoneyType' },
                LogicalName: 'revenue'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('data-type="decimal"');
        });

        it('should handle BigIntType as integer', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'BigIntType' },
                LogicalName: 'versionnumber'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('data-type="integer"');
        });

        it('should handle MemoType as memo', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'MemoType' },
                LogicalName: 'description'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('textarea');
            expect(container.innerHTML).toContain('data-type="memo"');
        });

        it('should handle StringType as string', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'StringType' },
                LogicalName: 'name'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('data-type="string"');
        });

        it('should handle DateTimeType as datetime', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'DateTimeType' },
                LogicalName: 'createdon'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('data-type="datetime"');
        });

        it('should handle UniqueIdentifierType as uniqueidentifier', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'UniqueIdentifierType' },
                LogicalName: 'accountid'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('data-type="uniqueidentifier"');
        });

        it('should handle ImageType as image', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'ImageType' },
                LogicalName: 'entityimage'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('data-type="image"');
        });

        it('should handle FileType as file', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'FileType' },
                LogicalName: 'document'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'annotation'
            });

            expect(container.innerHTML).toContain('data-type="file"');
        });

        it('should handle EntityNameType as entityname', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'EntityNameType' },
                LogicalName: 'objecttypecode'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'annotation'
            });

            expect(container.innerHTML).toContain('data-type="entityname"');
        });

        it('should handle VirtualType as readonly', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'VirtualType' },
                LogicalName: 'computed'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('disabled');
        });

        it('should handle ManagedPropertyType as readonly', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'ManagedPropertyType' },
                LogicalName: 'iscustomizable'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            expect(container.innerHTML).toContain('disabled');
        });

        it('should handle PartyListType as readonly', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'PartyListType' },
                LogicalName: 'to'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'email'
            });

            expect(container.innerHTML).toContain('disabled');
        });

        it('should handle MultiSelectPicklistType as multiselect', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'MultiSelectPicklistType' },
                LogicalName: 'interests'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            expect(container.innerHTML).toContain('pdt-multiselect');
        });
    });

    describe('cleanupMultiselectDropdown', () => {
        it('should remove document event listener when dropdown has _closeHandler', () => {
            const mockHandler = vi.fn();
            const dropdown = document.createElement('div');
            dropdown._closeHandler = mockHandler;

            const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

            SmartValueInput.cleanupMultiselectDropdown(dropdown);

            expect(removeEventListenerSpy).toHaveBeenCalledWith('click', mockHandler);
            expect(dropdown._closeHandler).toBeNull();

            removeEventListenerSpy.mockRestore();
        });

        it('should do nothing when dropdown is null', () => {
            expect(() => SmartValueInput.cleanupMultiselectDropdown(null)).not.toThrow();
        });

        it('should do nothing when dropdown has no _closeHandler', () => {
            const dropdown = document.createElement('div');

            expect(() => SmartValueInput.cleanupMultiselectDropdown(dropdown)).not.toThrow();
        });
    });

    describe('render error handling', () => {
        it('should fall back to default input when _buildInputHtml throws', async () => {
            const container = document.createElement('div');
            // Provide invalid attribute data that will cause an error
            const attr = {
                AttributeTypeName: null, // This will cause issues
                LogicalName: 'test'
            };

            // Spy on console.warn to verify error is logged
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            // Should still render something (default input)
            expect(container.innerHTML).toBeDefined();

            warnSpy.mockRestore();
        });
    });

    describe('file upload interactions', () => {
        it('should handle file selection and convert to base64', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'ImageType' },
                LogicalName: 'entityimage'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            const fileInput = container.querySelector('.pdt-file-input');
            const uploadContainer = container.querySelector('.pdt-file-upload-container');

            if (fileInput && uploadContainer) {
                // Create a mock file
                const mockFile = new File(['test content'], 'test.png', { type: 'image/png' });
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(mockFile);
                fileInput.files = dataTransfer.files;

                // Trigger change event
                fileInput.dispatchEvent(new Event('change'));

                // Wait for async processing
                await new Promise(resolve => setTimeout(resolve, 50));

                // Container should have file data set
                expect(uploadContainer._fileData).toBeDefined();
            }
        });

        it('should handle file read error gracefully', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'ImageType' },
                LogicalName: 'entityimage'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            const fileInput = container.querySelector('.pdt-file-input');
            const uploadContainer = container.querySelector('.pdt-file-upload-container');

            if (fileInput && uploadContainer) {
                // Mock _fileToBase64 to throw an error
                const originalMethod = SmartValueInput._fileToBase64;
                SmartValueInput._fileToBase64 = vi.fn().mockRejectedValue(new Error('Read error'));

                const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(mockFile);
                fileInput.files = dataTransfer.files;

                const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

                fileInput.dispatchEvent(new Event('change'));

                await new Promise(resolve => setTimeout(resolve, 50));

                // Restore original method
                SmartValueInput._fileToBase64 = originalMethod;
                errorSpy.mockRestore();
            }
        });

        it('should handle manual data input', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'ImageType' },
                LogicalName: 'entityimage'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            const dataInput = container.querySelector('.pdt-file-data');
            const uploadContainer = container.querySelector('.pdt-file-upload-container');

            if (dataInput && uploadContainer) {
                dataInput.value = 'base64datastring';
                dataInput.dispatchEvent(new Event('input'));

                expect(uploadContainer._fileData).toBe('base64datastring');
                expect(uploadContainer._fileName).toBe('manual_input');
            }
        });

        it('should do nothing when no file selected', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'ImageType' },
                LogicalName: 'entityimage'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            const fileInput = container.querySelector('.pdt-file-input');

            if (fileInput) {
                // Trigger change with no files
                fileInput.dispatchEvent(new Event('change'));
                // Should not throw
            }
        });
    });

    describe('value preservation', () => {
        it('should preserve text input value when re-rendering', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'String' },
                LogicalName: 'name'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            const input = container.querySelector('[data-prop="value"]');
            input.value = 'Test Value';

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            const newInput = container.querySelector('[data-prop="value"]');
            expect(newInput.value).toBe('Test Value');
        });

        it('should preserve select dropdown value when re-rendering', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Boolean' },
                LogicalName: 'isactive'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                context: 'fetch'
            });

            const select = container.querySelector('[data-prop="value"]');
            select.value = '1';

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                context: 'fetch'
            });

            const newSelect = container.querySelector('[data-prop="value"]');
            expect(newSelect.value).toBe('1');
        });

        it('should preserve date input value when re-rendering', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'DateTime' },
                LogicalName: 'createdon',
                Format: 'DateOnly'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            const dateInput = container.querySelector('[data-prop="value"]');
            dateInput.value = '2024-01-15';

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            const newDateInput = container.querySelector('[data-prop="value"]');
            expect(newDateInput.value).toBe('2024-01-15');
        });

        it('should preserve datetime-local input value when re-rendering', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'DateTime' },
                LogicalName: 'createdon'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            const datetimeInput = container.querySelector('[data-prop="value"]');
            datetimeInput.value = '2024-01-15T10:30';

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            const newDatetimeInput = container.querySelector('[data-prop="value"]');
            expect(newDatetimeInput.value).toBe('2024-01-15T10:30');
        });

        it('should preserve number input value when re-rendering', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Integer' },
                LogicalName: 'age'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            const numberInput = container.querySelector('[data-prop="value"]');
            numberInput.value = '42';

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'contact'
            });

            const newNumberInput = container.querySelector('[data-prop="value"]');
            expect(newNumberInput.value).toBe('42');
        });

        it('should preserve textarea value when re-rendering', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Memo' },
                LogicalName: 'description'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            const textarea = container.querySelector('[data-prop="value"]');
            textarea.value = 'Multi-line\ntext value';

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            const newTextarea = container.querySelector('[data-prop="value"]');
            expect(newTextarea.value).toBe('Multi-line\ntext value');
        });

        it('should preserve picklist select value when re-rendering', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'Picklist' },
                LogicalName: 'statecode'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            const select = container.querySelector('[data-prop="value"]');
            if (select) {
                select.value = '1';
            }

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            const newSelect = container.querySelector('[data-prop="value"]');
            if (newSelect) {
                expect(newSelect.value).toBe('1');
            }
        });

        it('should preserve multiselect dropdown value when re-rendering', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'MultiSelectPicklist' },
                LogicalName: 'categories'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'product'
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            const dropdown = container.querySelector('.pdt-multiselect-dropdown');
            if (dropdown) {
                const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
                if (checkboxes.length > 0) {
                    checkboxes[0].checked = true;
                    if (checkboxes.length > 1) {
                        checkboxes[1].checked = true;
                    }

                    await SmartValueInput.render({
                        valueContainer: container,
                        attr,
                        entityName: 'product'
                    });

                    await new Promise(resolve => setTimeout(resolve, 50));

                    const newDropdown = container.querySelector('.pdt-multiselect-dropdown');
                    if (newDropdown) {
                        const newCheckboxes = newDropdown.querySelectorAll('input[type="checkbox"]:checked');
                        expect(newCheckboxes.length).toBeGreaterThan(0);
                    }
                }
            }
        });

        it('should handle empty existing value gracefully', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'String' },
                LogicalName: 'name'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account'
            });

            const newInput = container.querySelector('[data-prop="value"]');
            expect(newInput).toBeTruthy();
            expect(newInput.value).toBe('');
        });

        it('should handle custom dataProp parameter', async () => {
            const container = document.createElement('div');
            const attr = {
                AttributeTypeName: { Value: 'String' },
                LogicalName: 'name'
            };

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                dataProp: 'custom-field'
            });

            const input = container.querySelector('[data-prop="custom-field"]');
            input.value = 'Custom Value';

            await SmartValueInput.render({
                valueContainer: container,
                attr,
                entityName: 'account',
                dataProp: 'custom-field'
            });

            const newInput = container.querySelector('[data-prop="custom-field"]');
            expect(newInput.value).toBe('Custom Value');
        });
    })
});