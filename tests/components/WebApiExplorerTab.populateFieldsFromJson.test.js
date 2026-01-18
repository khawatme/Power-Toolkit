/**
 * @file Tests for WebApiExplorerTab field builder JSON conversion functionality
 * @module tests/components/WebApiExplorerTab.populateFieldsFromJson.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        getAttributeDefinitions: vi.fn(),
        getNavigationPropertyMap: vi.fn()
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: {
        show: vi.fn()
    }
}));

vi.mock('../../src/ui/SmartValueInput.js', () => ({
    SmartValueInput: {
        render: vi.fn().mockResolvedValue(undefined),
        LOOKUP_TYPES: ['lookup', 'customer', 'owner']
    }
}));

vi.mock('../../src/utils/resolvers/EntityContextResolver.js', () => ({
    EntityContextResolver: {
        resolve: vi.fn(),
        getAttrMap: vi.fn()
    }
}));

import { WebApiExplorerTab } from '../../src/components/WebApiExplorerTab.js';
import { DataService } from '../../src/services/DataService.js';
import { SmartValueInput } from '../../src/ui/SmartValueInput.js';
import { EntityContextResolver } from '../../src/utils/resolvers/EntityContextResolver.js';

describe('WebApiExplorerTab - Field Builder JSON Conversion', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';

        // Mock EntityContextResolver
        EntityContextResolver.resolve.mockResolvedValue({
            entitySet: 'accounts',
            logicalName: 'account'
        });
        EntityContextResolver.getAttrMap.mockResolvedValue(new Map());
    });

    afterEach(() => {
        component?.cleanup?.();
        component = null;
    });

    describe('_populateFieldsFromJson', () => {
        beforeEach(async () => {
            component = new WebApiExplorerTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender?.(element);
        });

        it('should populate field builder from simple JSON object', async () => {
            const json = {
                name: 'Test Account',
                revenue: 1000000
            };

            DataService.getAttributeDefinitions.mockResolvedValue([
                { LogicalName: 'name', AttributeType: 'String' },
                { LogicalName: 'revenue', AttributeType: 'Money' }
            ]);

            await component._populateFieldsFromJson(json, 'POST');

            const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
            expect(rows.length).toBe(2);

            const firstAttr = rows[0].querySelector('[data-prop="field-attribute"]');
            expect(firstAttr.value).toBe('name');

            const secondAttr = rows[1].querySelector('[data-prop="field-attribute"]');
            expect(secondAttr.value).toBe('revenue');
        });

        it('should handle null values as empty strings', async () => {
            const json = {
                name: 'Test',
                description: null
            };

            DataService.getAttributeDefinitions.mockResolvedValue([
                { LogicalName: 'name', AttributeType: 'String' },
                { LogicalName: 'description', AttributeType: 'Memo' }
            ]);

            await component._populateFieldsFromJson(json, 'POST');

            const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
            const descValue = rows[1].querySelector('[data-prop="field-value"]');
            expect(descValue.value).toBe('');
        });

        it('should render appropriate input for optionset fields', async () => {
            const json = {
                statuscode: 1
            };

            DataService.getAttributeDefinitions.mockResolvedValue([
                { LogicalName: 'statuscode', AttributeType: 'Picklist' }
            ]);

            // Need to set entity input for _ensureEntityContext to work
            component.ui.postEntityInput.value = 'account';

            await component._populateFieldsFromJson(json, 'POST');

            expect(SmartValueInput.render).toHaveBeenCalled();
            const renderCall = SmartValueInput.render.mock.calls[0][0];
            expect(renderCall.attr.LogicalName).toBe('statuscode');
        });

        it('should handle multiselect fields correctly', async () => {
            const json = {
                myfield: '100000000,100000001'
            };

            DataService.getAttributeDefinitions.mockResolvedValue([
                { LogicalName: 'myfield', AttributeType: 'MultiSelectPicklist' }
            ]);

            // Need to set entity input
            component.ui.postEntityInput.value = 'account';

            // Mock SmartValueInput to create a multiselect dropdown
            SmartValueInput.render.mockImplementation(({ valueContainer }) => {
                valueContainer.innerHTML = `
                    <div class="pdt-multiselect-dropdown" data-prop="field-value">
                        <div class="pdt-multiselect-trigger">
                            <span class="pdt-multiselect-text">-- Select options --</span>
                        </div>
                        <div class="pdt-multiselect-options">
                            <label class="pdt-multiselect-option">
                                <input type="checkbox" value="100000000" data-label="Option 1">
                                <span>Option 1</span>
                            </label>
                            <label class="pdt-multiselect-option">
                                <input type="checkbox" value="100000001" data-label="Option 2">
                                <span>Option 2</span>
                            </label>
                        </div>
                    </div>
                `;
            });

            await component._populateFieldsFromJson(json, 'POST');

            const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
            expect(rows.length).toBeGreaterThan(0);

            const multiselectDiv = rows[0].querySelector('.pdt-multiselect-dropdown');
            expect(multiselectDiv).toBeTruthy();

            if (multiselectDiv) {
                const checkedBoxes = multiselectDiv.querySelectorAll('input[type="checkbox"]:checked');
                expect(checkedBoxes.length).toBe(2);
            }
        });

        it('should handle empty JSON object by adding one empty field', async () => {
            const json = {};

            await component._populateFieldsFromJson(json, 'POST');

            const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
            expect(rows.length).toBe(1);
        });

        it('should work when entity metadata is not available', async () => {
            const json = {
                name: 'Test',
                value: 123
            };

            DataService.getAttributeDefinitions.mockRejectedValue(new Error('Metadata not found'));

            await component._populateFieldsFromJson(json, 'POST');

            const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
            expect(rows.length).toBe(2);

            // Should still set attribute names and values
            const firstAttr = rows[0].querySelector('[data-prop="field-attribute"]');
            expect(firstAttr.value).toBe('name');

            const firstValue = rows[0].querySelector('[data-prop="field-value"]');
            expect(firstValue.value).toBe('Test');
        });

        it('should handle PATCH method correctly', async () => {
            const json = {
                name: 'Updated Name'
            };

            DataService.getAttributeDefinitions.mockResolvedValue([
                { LogicalName: 'name', AttributeType: 'String' }
            ]);

            await component._populateFieldsFromJson(json, 'PATCH');

            const rows = component.ui.patchFieldsContainer.querySelectorAll('.pdt-field-grid');
            expect(rows.length).toBe(1);

            const attrInput = rows[0].querySelector('[data-prop="field-attribute"]');
            expect(attrInput.value).toBe('name');
        });

        it('should handle object values by converting to JSON string', async () => {
            const json = {
                complexfield: { nested: 'value', count: 5 }
            };

            DataService.getAttributeDefinitions.mockResolvedValue([]);

            await component._populateFieldsFromJson(json, 'POST');

            const rows = component.ui.postFieldsContainer.querySelectorAll('.pdt-field-grid');
            const valueInput = rows[0].querySelector('[data-prop="field-value"]');
            expect(valueInput.value).toBe(JSON.stringify({ nested: 'value', count: 5 }));
        });
    });

    describe('_fetchEntityMetadataForJson', () => {
        beforeEach(async () => {
            component = new WebApiExplorerTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender?.(element);
        });

        it('should fetch entity context and attributes successfully', async () => {
            component.ui.postEntityInput.value = 'account';

            EntityContextResolver.resolve.mockResolvedValue({
                entitySet: 'accounts',
                logicalName: 'account'
            });

            DataService.getAttributeDefinitions.mockResolvedValue([
                { LogicalName: 'name', AttributeType: 'String' }
            ]);

            const result = await component._fetchEntityMetadataForJson('POST');

            expect(result.entityContext).toBeTruthy();
            expect(result.attributes).toHaveLength(1);
        });

        it('should return null values when metadata fetch fails', async () => {
            component.ui.postEntityInput.value = '';

            const result = await component._fetchEntityMetadataForJson('POST');

            expect(result.entityContext).toBeNull();
            expect(result.attributes).toBeNull();
        });
    });

    describe('_setMultiselectValue', () => {
        beforeEach(async () => {
            component = new WebApiExplorerTab();
        });

        it('should set multiselect values from array', () => {
            const multiselectDiv = document.createElement('div');
            multiselectDiv.className = 'pdt-multiselect-dropdown';
            multiselectDiv.innerHTML = `
                <div class="pdt-multiselect-trigger">
                    <span class="pdt-multiselect-text">-- Select options --</span>
                </div>
                <div class="pdt-multiselect-options">
                    <label><input type="checkbox" value="1" data-label="Option 1"><span>Option 1</span></label>
                    <label><input type="checkbox" value="2" data-label="Option 2"><span>Option 2</span></label>
                    <label><input type="checkbox" value="3" data-label="Option 3"><span>Option 3</span></label>
                </div>
            `;

            component._setMultiselectValue(multiselectDiv, [1, 3]);

            const checkedBoxes = multiselectDiv.querySelectorAll('input[type="checkbox"]:checked');
            expect(checkedBoxes.length).toBe(2);
            expect(checkedBoxes[0].value).toBe('1');
            expect(checkedBoxes[1].value).toBe('3');

            const textDisplay = multiselectDiv.querySelector('.pdt-multiselect-text');
            expect(textDisplay.textContent).toBe('2 options selected');
        });

        it('should set multiselect values from comma-separated string', () => {
            const multiselectDiv = document.createElement('div');
            multiselectDiv.innerHTML = `
                <div class="pdt-multiselect-trigger">
                    <span class="pdt-multiselect-text">-- Select options --</span>
                </div>
                <div class="pdt-multiselect-options">
                    <label><input type="checkbox" value="100" data-label="Opt 100"><span>Opt 100</span></label>
                    <label><input type="checkbox" value="200" data-label="Opt 200"><span>Opt 200</span></label>
                </div>
            `;

            component._setMultiselectValue(multiselectDiv, '100,200');

            const checkedBoxes = multiselectDiv.querySelectorAll('input[type="checkbox"]:checked');
            expect(checkedBoxes.length).toBe(2);
        });

        it('should set single value for multiselect', () => {
            const multiselectDiv = document.createElement('div');
            multiselectDiv.innerHTML = `
                <div class="pdt-multiselect-trigger">
                    <span class="pdt-multiselect-text">-- Select options --</span>
                </div>
                <div class="pdt-multiselect-options">
                    <label><input type="checkbox" value="42" data-label="Single Option"><span>Single</span></label>
                </div>
            `;

            component._setMultiselectValue(multiselectDiv, 42);

            const checkedBox = multiselectDiv.querySelector('input[type="checkbox"]:checked');
            expect(checkedBox).toBeTruthy();
            expect(checkedBox.value).toBe('42');

            const textDisplay = multiselectDiv.querySelector('.pdt-multiselect-text');
            expect(textDisplay.textContent).toBe('Single Option');
        });

        it('should handle null value gracefully', () => {
            component._setMultiselectValue(null, [1, 2]);
            // Should not throw
        });

        it('should show default text when no values match', () => {
            const multiselectDiv = document.createElement('div');
            multiselectDiv.innerHTML = `
                <div class="pdt-multiselect-trigger">
                    <span class="pdt-multiselect-text">-- Select options --</span>
                </div>
                <div class="pdt-multiselect-options">
                    <label><input type="checkbox" value="1" data-label="Option 1"><span>Option 1</span></label>
                </div>
            `;

            component._setMultiselectValue(multiselectDiv, [999]);

            const textDisplay = multiselectDiv.querySelector('.pdt-multiselect-text');
            expect(textDisplay.textContent).toBe('-- Select options --');
        });
    });

    describe('_setFieldValueByType', () => {
        beforeEach(async () => {
            component = new WebApiExplorerTab();
        });

        it('should set null value as empty string', () => {
            const row = document.createElement('div');
            row.innerHTML = '<input type="text" data-prop="field-value">';

            component._setFieldValueByType(row, null);

            const input = row.querySelector('[data-prop="field-value"]');
            expect(input.value).toBe('');
        });

        it('should handle SELECT element', () => {
            const row = document.createElement('div');
            const select = document.createElement('select');
            select.dataset.prop = 'field-value';
            select.innerHTML = '<option value="1">One</option><option value="2">Two</option>';
            row.appendChild(select);

            component._setFieldValueByType(row, 2);

            expect(select.value).toBe('2');
        });

        it('should handle object value by converting to JSON', () => {
            const row = document.createElement('div');
            row.innerHTML = '<input type="text" data-prop="field-value">';

            component._setFieldValueByType(row, { key: 'value' });

            const input = row.querySelector('[data-prop="field-value"]');
            expect(input.value).toBe('{"key":"value"}');
        });

        it('should handle primitive values', () => {
            const row = document.createElement('div');
            row.innerHTML = '<input type="text" data-prop="field-value">';

            component._setFieldValueByType(row, 'Test String');

            const input = row.querySelector('[data-prop="field-value"]');
            expect(input.value).toBe('Test String');
        });

        it('should dispatch change event after setting value', () => {
            const row = document.createElement('div');
            row.innerHTML = '<input type="text" data-prop="field-value">';

            const input = row.querySelector('[data-prop="field-value"]');
            const changeSpy = vi.fn();
            input.addEventListener('change', changeSpy);

            component._setFieldValueByType(row, 'test');

            expect(changeSpy).toHaveBeenCalled();
        });
    });

    describe('_setFieldValueFallback', () => {
        beforeEach(async () => {
            component = new WebApiExplorerTab();
        });

        it('should set null value as empty string', () => {
            const row = document.createElement('div');
            row.innerHTML = '<input type="text" data-prop="field-value">';

            component._setFieldValueFallback(row, null);

            const input = row.querySelector('[data-prop="field-value"]');
            expect(input.value).toBe('');
        });

        it('should convert object to JSON string', () => {
            const row = document.createElement('div');
            row.innerHTML = '<input type="text" data-prop="field-value">';

            component._setFieldValueFallback(row, { nested: 'data' });

            const input = row.querySelector('[data-prop="field-value"]');
            expect(input.value).toBe('{"nested":"data"}');
        });

        it('should handle primitive values', () => {
            const row = document.createElement('div');
            row.innerHTML = '<input type="text" data-prop="field-value">';

            component._setFieldValueFallback(row, 'Simple Text');

            const input = row.querySelector('[data-prop="field-value"]');
            expect(input.value).toBe('Simple Text');
        });

        it('should handle missing value input gracefully', () => {
            const row = document.createElement('div');
            // No input element

            expect(() => {
                component._setFieldValueFallback(row, 'test');
            }).not.toThrow();
        });
    });

    describe('_getFieldsFromBuilder - empty field handling', () => {
        beforeEach(async () => {
            component = new WebApiExplorerTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender?.(element);
        });

        it('should include fields with empty values', () => {
            // Create a field row with attribute name but no value
            component._addFieldUI(true, 'POST');
            const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
            const attrInput = row.querySelector('[data-prop="field-attribute"]');
            const valueInput = row.querySelector('[data-prop="field-value"]');

            attrInput.value = 'testfield';
            valueInput.value = '';

            const fields = component._getFieldsFromBuilder('POST');

            expect(fields).toHaveProperty('testfield');
            // Empty string values are returned as empty string, not null (default parser behavior)
            expect(fields.testfield).toBe('');
        });

        it('should include fields with values', () => {
            component._addFieldUI(true, 'POST');
            const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
            const attrInput = row.querySelector('[data-prop="field-attribute"]');
            const valueInput = row.querySelector('[data-prop="field-value"]');

            attrInput.value = 'name';
            valueInput.value = 'Test Name';

            const fields = component._getFieldsFromBuilder('POST');

            expect(fields).toHaveProperty('name');
            expect(fields.name).toBe('Test Name');
        });

        it('should not include fields without attribute name', () => {
            component._addFieldUI(true, 'POST');
            const row = component.ui.postFieldsContainer.querySelector('.pdt-field-grid');
            const valueInput = row.querySelector('[data-prop="field-value"]');

            valueInput.value = 'Some Value';

            const fields = component._getFieldsFromBuilder('POST');

            expect(Object.keys(fields)).toHaveLength(0);
        });
    });
});
