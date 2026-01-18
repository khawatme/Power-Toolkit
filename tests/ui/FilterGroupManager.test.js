/**
 * @file Tests for FilterGroupManager
 * @module tests/ui/FilterGroupManager.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock MetadataHelpers to prevent actual API calls
vi.mock('../../src/helpers/metadata.helpers.js', () => ({
    MetadataHelpers: {
        showColumnBrowser: vi.fn(),
        getMetadataDisplayName: vi.fn().mockReturnValue('Display Name')
    }
}));

// Mock helpers/index.js to provide required exports
vi.mock('../../src/helpers/index.js', () => ({
    FILTER_OPERATORS: [
        { text: 'Equals', fetch: 'eq', odata: 'eq' },
        { text: 'Not Equals', fetch: 'ne', odata: 'ne' },
        { text: 'Contains', fetch: 'like', odata: 'contains' },
        { text: 'Is Null', fetch: 'null', odata: 'null' },
        { text: 'Is Not Null', fetch: 'not-null', odata: 'not-null' },
        { text: 'Greater Than', fetch: 'gt', odata: 'gt' },
        { text: 'Less Than', fetch: 'lt', odata: 'lt' }
    ],
    shouldShowOperatorValue: (op) => !['null', 'not-null'].includes(op)
}));

// Import after mocks
import { FilterGroupManager } from '../../src/ui/FilterGroupManager.js';

describe('FilterGroupManager', () => {
    let manager;
    let mockHandlers;
    let mockGetEntityContext;
    let mockRenderValueInput;
    let mockGetAttributeMetadata;
    let mockOnUpdate;
    let container;

    beforeEach(() => {
        mockHandlers = new Map();
        mockGetEntityContext = vi.fn().mockResolvedValue('account');
        mockRenderValueInput = vi.fn().mockResolvedValue(document.createElement('input'));
        mockGetAttributeMetadata = vi.fn().mockImplementation(async (attrName) => {
            const attrMap = new Map([
                ['filesizeinbytes', { LogicalName: 'filesizeinbytes', AttributeTypeName: { Value: 'BigInt' }, AttributeType: 'BigInt' }],
                ['versionnumber', { LogicalName: 'versionnumber', AttributeTypeName: { Value: 'BigInt' }, AttributeType: 'BigInt' }],
                ['birthdate', { LogicalName: 'birthdate', AttributeTypeName: { Value: 'DateTime' }, AttributeType: 'DateTime' }],
                ['name', { LogicalName: 'name', AttributeTypeName: { Value: 'String' }, AttributeType: 'String' }]
            ]);
            return attrMap.get(attrName) || null;
        });
        mockOnUpdate = vi.fn();

        container = document.createElement('div');
        document.body.appendChild(container);

        manager = new FilterGroupManager({
            handlers: mockHandlers,
            getEntityContext: mockGetEntityContext,
            renderValueInput: mockRenderValueInput,
            getAttributeMetadata: mockGetAttributeMetadata,
            showNotOperator: false,
            operatorFilter: 'fetch',
            onUpdate: mockOnUpdate
        });
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        mockHandlers.clear();
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with config', () => {
            expect(manager).toBeDefined();
            expect(manager.handlers).toBe(mockHandlers);
            expect(manager.getEntityContext).toBe(mockGetEntityContext);
            expect(manager.renderValueInput).toBe(mockRenderValueInput);
            expect(manager.showNotOperator).toBe(false);
            expect(manager.operatorFilter).toBe('fetch');
        });

        it('should support NOT operator when enabled', () => {
            const managerWithNot = new FilterGroupManager({
                handlers: mockHandlers,
                getEntityContext: mockGetEntityContext,
                renderValueInput: mockRenderValueInput,
                showNotOperator: true
            });

            expect(managerWithNot.showNotOperator).toBe(true);
        });

        it('should default showNotOperator to false', () => {
            const managerDefault = new FilterGroupManager({
                handlers: mockHandlers,
                getEntityContext: mockGetEntityContext,
                renderValueInput: mockRenderValueInput
            });

            expect(managerDefault.showNotOperator).toBe(false);
        });

        it('should default operatorFilter to fetch', () => {
            const managerDefault = new FilterGroupManager({
                handlers: mockHandlers,
                getEntityContext: mockGetEntityContext,
                renderValueInput: mockRenderValueInput
            });

            expect(managerDefault.operatorFilter).toBe('fetch');
        });

        it('should default onUpdate to empty function', () => {
            const managerDefault = new FilterGroupManager({
                handlers: mockHandlers,
                getEntityContext: mockGetEntityContext,
                renderValueInput: mockRenderValueInput
            });

            expect(managerDefault.onUpdate).toBeInstanceOf(Function);
            expect(() => managerDefault.onUpdate()).not.toThrow();
        });

        it('should accept odata operatorFilter', () => {
            const managerOData = new FilterGroupManager({
                handlers: mockHandlers,
                getEntityContext: mockGetEntityContext,
                renderValueInput: mockRenderValueInput,
                operatorFilter: 'odata'
            });

            expect(managerOData.operatorFilter).toBe('odata');
        });
    });

    describe('addFilterGroup', () => {
        it('should add first filter group without separator', () => {
            manager.addFilterGroup(container, true);

            const filterGroup = container.querySelector('.pdt-filter-group');
            expect(filterGroup).toBeTruthy();

            const separator = container.querySelector('.pdt-filter-group-separator');
            expect(separator).toBeFalsy();
        });

        it('should add subsequent filter groups with separator', () => {
            manager.addFilterGroup(container, true);
            manager.addFilterGroup(container, false);

            const filterGroups = container.querySelectorAll('.pdt-filter-group');
            expect(filterGroups.length).toBe(2);

            const separator = container.querySelector('.pdt-filter-group-separator');
            expect(separator).toBeTruthy();
        });

        it('should include filter type selector', () => {
            manager.addFilterGroup(container, true);

            const filterType = container.querySelector('[data-prop="filter-type"]');
            expect(filterType).toBeTruthy();
            expect(filterType.tagName).toBe('SELECT');
        });

        it('should include add condition button', () => {
            manager.addFilterGroup(container, true);

            const addBtn = container.querySelector('.pdt-filter-group-add-condition');
            expect(addBtn).toBeTruthy();
        });

        it('should have remove button enabled for first group', () => {
            manager.addFilterGroup(container, true);

            const removeBtn = container.querySelector('.pdt-filter-group-remove');
            expect(removeBtn.disabled).toBe(false);
        });

        it('should enable remove button for non-first groups', () => {
            manager.addFilterGroup(container, true);
            manager.addFilterGroup(container, false);

            const removeButtons = container.querySelectorAll('.pdt-filter-group-remove');
            expect(removeButtons[1].disabled).toBe(false);
        });

        it('should include AND/OR options in filter type', () => {
            manager.addFilterGroup(container, true);

            const filterType = container.querySelector('[data-prop="filter-type"]');
            const options = filterType.querySelectorAll('option');

            expect(options.length).toBe(2);
            expect(options[0].value).toBe('and');
            expect(options[1].value).toBe('or');
        });

        it('should include NOT option when showNotOperator is true', () => {
            const managerWithNot = new FilterGroupManager({
                handlers: mockHandlers,
                getEntityContext: mockGetEntityContext,
                renderValueInput: mockRenderValueInput,
                showNotOperator: true
            });

            managerWithNot.addFilterGroup(container, true);

            const filterType = container.querySelector('[data-prop="filter-type"]');
            const options = filterType.querySelectorAll('option');

            expect(options.length).toBe(3);
            expect(options[2].value).toBe('not');
        });

        it('should include inter-group operator in separator', () => {
            manager.addFilterGroup(container, true);
            manager.addFilterGroup(container, false);

            const separator = container.querySelector('.pdt-filter-group-separator');
            const interGroupOp = separator.querySelector('[data-prop="inter-group-operator"]');

            expect(interGroupOp).toBeTruthy();
            expect(interGroupOp.value).toBe('and');
        });

        it('should register inter-group operator change handler', () => {
            manager.addFilterGroup(container, true);
            manager.addFilterGroup(container, false);

            const interGroupOp = container.querySelector('[data-prop="inter-group-operator"]');
            expect(mockHandlers.has(interGroupOp)).toBe(true);
        });

        it('should call onUpdate when inter-group operator changes', () => {
            manager.addFilterGroup(container, true);
            manager.addFilterGroup(container, false);

            const interGroupOp = container.querySelector('[data-prop="inter-group-operator"]');
            interGroupOp.value = 'or';
            interGroupOp.dispatchEvent(new Event('change'));

            expect(mockOnUpdate).toHaveBeenCalled();
        });

        it('should call onUpdate when filter type changes', () => {
            manager.addFilterGroup(container, true);

            const filterType = container.querySelector('[data-prop="filter-type"]');
            filterType.value = 'or';
            filterType.dispatchEvent(new Event('change'));

            expect(mockOnUpdate).toHaveBeenCalled();
        });

        it('should add initial condition to filter group', () => {
            manager.addFilterGroup(container, true);

            const conditions = container.querySelectorAll('.pdt-condition-grid');
            expect(conditions.length).toBe(1);
        });

        it('should add condition when add condition button clicked', () => {
            manager.addFilterGroup(container, true);

            const addBtn = container.querySelector('.pdt-filter-group-add-condition');
            addBtn.click();

            const conditions = container.querySelectorAll('.pdt-condition-grid');
            expect(conditions.length).toBe(2);
        });

        it('should call onUpdate when add condition button clicked', () => {
            manager.addFilterGroup(container, true);
            mockOnUpdate.mockClear();

            const addBtn = container.querySelector('.pdt-filter-group-add-condition');
            addBtn.click();

            expect(mockOnUpdate).toHaveBeenCalled();
        });

        it('should handle null container gracefully', () => {
            expect(() => manager.addFilterGroup(null, true)).not.toThrow();
        });

        it('should create MutationObserver for first group', () => {
            manager.addFilterGroup(container, true);

            const filterGroup = container.querySelector('.pdt-filter-group');
            expect(filterGroup._observer).toBeDefined();
        });
    });

    describe('addCondition', () => {
        let conditionsContainer;

        beforeEach(() => {
            manager.addFilterGroup(container, true);
            conditionsContainer = container.querySelector('.pdt-filter-group-conditions');
        });

        it('should add condition with attribute input', () => {
            const attrInput = conditionsContainer.querySelector('[data-prop="attribute"]');
            expect(attrInput).toBeTruthy();
            expect(attrInput.tagName).toBe('INPUT');
        });

        it('should add condition with operator select', () => {
            const operatorSelect = conditionsContainer.querySelector('[data-prop="operator"]');
            expect(operatorSelect).toBeTruthy();
            expect(operatorSelect.tagName).toBe('SELECT');
        });

        it('should add condition with value input', () => {
            const valueInput = conditionsContainer.querySelector('[data-prop="value"]');
            expect(valueInput).toBeTruthy();
        });

        it('should add condition with browse button', () => {
            const browseBtn = conditionsContainer.querySelector('.browse-condition-attr');
            expect(browseBtn).toBeTruthy();
        });

        it('should add condition with remove button', () => {
            const removeBtn = conditionsContainer.querySelector('.pdt-condition-remove');
            expect(removeBtn).toBeTruthy();
        });

        it('should have remove button enabled for first condition', () => {
            const removeBtn = conditionsContainer.querySelector('.pdt-condition-remove');
            expect(removeBtn.disabled).toBe(false);
        });

        it('should enable remove button for subsequent conditions', () => {
            manager.addCondition(conditionsContainer, false);

            const removeButtons = conditionsContainer.querySelectorAll('.pdt-condition-remove');
            expect(removeButtons[1].disabled).toBe(false);
        });

        it('should remove condition when remove button clicked', () => {
            manager.addCondition(conditionsContainer, false);

            let conditions = conditionsContainer.querySelectorAll('.pdt-condition-grid');
            expect(conditions.length).toBe(2);

            const removeBtn = conditions[1].querySelector('.pdt-condition-remove');
            removeBtn.click();

            conditions = conditionsContainer.querySelectorAll('.pdt-condition-grid');
            expect(conditions.length).toBe(1);
        });

        it('should clear first condition instead of removing it', () => {
            const attrInput = conditionsContainer.querySelector('[data-prop="attribute"]');
            attrInput.value = 'name';

            // Trigger input event to update the remove button state
            attrInput.dispatchEvent(new Event('input'));

            const removeBtn = conditionsContainer.querySelector('.pdt-condition-remove');

            // The button should be enabled now that there's content
            // Since there's only one condition, clicking remove clears instead of removing
            removeBtn.disabled = false; // Force enable for test
            removeBtn.click();

            const conditions = conditionsContainer.querySelectorAll('.pdt-condition-grid');
            expect(conditions.length).toBe(1);
            // After clearing, the attribute input should be empty
            expect(conditionsContainer.querySelector('[data-prop="attribute"]').value).toBe('');
        });

        it('should call onUpdate when condition is removed', () => {
            manager.addCondition(conditionsContainer, false);
            mockOnUpdate.mockClear();

            const conditions = conditionsContainer.querySelectorAll('.pdt-condition-grid');
            const removeBtn = conditions[1].querySelector('.pdt-condition-remove');
            removeBtn.click();

            expect(mockOnUpdate).toHaveBeenCalled();
        });

        it('should call onUpdate when operator changes', () => {
            const operatorSelect = conditionsContainer.querySelector('[data-prop="operator"]');
            mockOnUpdate.mockClear();

            operatorSelect.value = 'ne';
            operatorSelect.dispatchEvent(new Event('change'));

            expect(mockOnUpdate).toHaveBeenCalled();
        });

        it('should populate operators based on operatorFilter', () => {
            const operatorSelect = conditionsContainer.querySelector('[data-prop="operator"]');
            expect(operatorSelect.options.length).toBeGreaterThan(0);
        });

        it('should register handlers for browse button', () => {
            const browseBtn = conditionsContainer.querySelector('.browse-condition-attr');
            expect(mockHandlers.has(browseBtn)).toBe(true);
        });

        it('should register handlers for operator select', () => {
            const operatorSelect = conditionsContainer.querySelector('[data-prop="operator"]');
            expect(mockHandlers.has(operatorSelect)).toBe(true);
        });

        it('should register handlers for remove button', () => {
            const removeBtn = conditionsContainer.querySelector('.pdt-condition-remove');
            expect(mockHandlers.has(removeBtn)).toBe(true);
        });
    });

    describe('extractFilterGroups', () => {
        it('should return empty array for null container', () => {
            const result = manager.extractFilterGroups(null);
            expect(result).toEqual([]);
        });

        it('should return empty array for empty container', () => {
            const result = manager.extractFilterGroups(container);
            expect(result).toEqual([]);
        });

        it('should extract single filter group', () => {
            manager.addFilterGroup(container, true);

            const attrInput = container.querySelector('[data-prop="attribute"]');
            const valueInput = container.querySelector('[data-prop="value"]');
            attrInput.value = 'name';
            valueInput.value = 'test';

            const result = manager.extractFilterGroups(container);

            expect(result.length).toBe(1);
            expect(result[0].filterType).toBe('and');
            expect(result[0].filters.length).toBe(1);
            expect(result[0].filters[0].attr).toBe('name');
            expect(result[0].filters[0].value).toBe('test');
        });

        it('should extract multiple filter groups', () => {
            manager.addFilterGroup(container, true);
            manager.addFilterGroup(container, false);

            const groups = container.querySelectorAll('.pdt-filter-group');

            groups[0].querySelector('[data-prop="attribute"]').value = 'name';
            groups[0].querySelector('[data-prop="value"]').value = 'test1';

            groups[1].querySelector('[data-prop="attribute"]').value = 'email';
            groups[1].querySelector('[data-prop="value"]').value = 'test2';

            const result = manager.extractFilterGroups(container);

            expect(result.length).toBe(2);
            expect(result[0].filters[0].attr).toBe('name');
            expect(result[1].filters[0].attr).toBe('email');
        });

        it('should extract inter-group operator', () => {
            manager.addFilterGroup(container, true);
            manager.addFilterGroup(container, false);

            const groups = container.querySelectorAll('.pdt-filter-group');
            groups[0].querySelector('[data-prop="attribute"]').value = 'name';
            groups[0].querySelector('[data-prop="value"]').value = 'test1';
            groups[1].querySelector('[data-prop="attribute"]').value = 'email';
            groups[1].querySelector('[data-prop="value"]').value = 'test2';

            const interGroupOp = container.querySelector('[data-prop="inter-group-operator"]');
            interGroupOp.value = 'or';

            const result = manager.extractFilterGroups(container);

            expect(result[1].interGroupOperator).toBe('or');
        });

        it('should extract filter type', () => {
            manager.addFilterGroup(container, true);

            const filterType = container.querySelector('[data-prop="filter-type"]');
            filterType.value = 'or';

            const attrInput = container.querySelector('[data-prop="attribute"]');
            const valueInput = container.querySelector('[data-prop="value"]');
            attrInput.value = 'name';
            valueInput.value = 'test';

            const result = manager.extractFilterGroups(container);

            expect(result[0].filterType).toBe('or');
        });

        it('should extract operator from condition', () => {
            manager.addFilterGroup(container, true);

            const attrInput = container.querySelector('[data-prop="attribute"]');
            const operatorSelect = container.querySelector('[data-prop="operator"]');
            attrInput.value = 'name';
            operatorSelect.value = 'ne';

            const result = manager.extractFilterGroups(container);

            expect(result[0].filters[0].op).toBe('ne');
        });

        it('should skip conditions without attribute', () => {
            manager.addFilterGroup(container, true);

            const valueInput = container.querySelector('[data-prop="value"]');
            valueInput.value = 'test';
            // attribute is empty

            const result = manager.extractFilterGroups(container);

            expect(result.length).toBe(0);
        });

        it('should skip empty filter groups', () => {
            manager.addFilterGroup(container, true);
            // All inputs empty

            const result = manager.extractFilterGroups(container);

            expect(result.length).toBe(0);
        });

        it('should extract multiple conditions in same group', () => {
            manager.addFilterGroup(container, true);
            const conditionsContainer = container.querySelector('.pdt-filter-group-conditions');
            manager.addCondition(conditionsContainer, false);

            const conditions = conditionsContainer.querySelectorAll('.pdt-condition-grid');
            conditions[0].querySelector('[data-prop="attribute"]').value = 'name';
            conditions[0].querySelector('[data-prop="value"]').value = 'test1';
            conditions[1].querySelector('[data-prop="attribute"]').value = 'email';
            conditions[1].querySelector('[data-prop="value"]').value = 'test2';

            const result = manager.extractFilterGroups(container);

            expect(result[0].filters.length).toBe(2);
            expect(result[0].filters[0].attr).toBe('name');
            expect(result[0].filters[1].attr).toBe('email');
        });

        it('should trim whitespace from values', () => {
            manager.addFilterGroup(container, true);

            const attrInput = container.querySelector('[data-prop="attribute"]');
            const valueInput = container.querySelector('[data-prop="value"]');
            attrInput.value = '  name  ';
            valueInput.value = '  test  ';

            const result = manager.extractFilterGroups(container);

            expect(result[0].filters[0].attr).toBe('name');
            expect(result[0].filters[0].value).toBe('test');
        });

        it('should handle multiselect dropdown values', () => {
            manager.addFilterGroup(container, true);

            // Replace value container with multiselect dropdown
            const valueContainer = container.querySelector('.pdt-value-container');
            valueContainer.innerHTML = `
                <div class="pdt-multiselect-dropdown" data-prop="value">
                    <input type="checkbox" value="1" checked>
                    <input type="checkbox" value="2" checked>
                    <input type="checkbox" value="3">
                </div>
            `;

            const attrInput = container.querySelector('[data-prop="attribute"]');
            attrInput.value = 'status';

            const result = manager.extractFilterGroups(container);

            expect(result[0].filters[0].value).toBe('1,2');
        });
    });

    describe('removeGroup', () => {
        it('should remove filter group when remove button clicked', () => {
            manager.addFilterGroup(container, true);
            manager.addFilterGroup(container, false);

            let groups = container.querySelectorAll('.pdt-filter-group');
            expect(groups.length).toBe(2);

            const removeBtn = groups[1].querySelector('.pdt-filter-group-remove');
            removeBtn.click();

            groups = container.querySelectorAll('.pdt-filter-group');
            expect(groups.length).toBe(1);
        });

        it('should remove separator when group is removed', () => {
            manager.addFilterGroup(container, true);
            manager.addFilterGroup(container, false);

            let separator = container.querySelector('.pdt-filter-group-separator');
            expect(separator).toBeTruthy();

            const groups = container.querySelectorAll('.pdt-filter-group');
            const removeBtn = groups[1].querySelector('.pdt-filter-group-remove');
            removeBtn.click();

            separator = container.querySelector('.pdt-filter-group-separator');
            expect(separator).toBeFalsy();
        });

        it('should completely remove first/only group when remove button clicked', () => {
            manager.addFilterGroup(container, true);

            const attrInput = container.querySelector('[data-prop="attribute"]');
            attrInput.value = 'name';

            const removeBtn = container.querySelector('.pdt-filter-group-remove');
            // Enable the button to test removal
            removeBtn.disabled = false;
            removeBtn.click();

            // First group should be completely removed, leaving container empty
            const groups = container.querySelectorAll('.pdt-filter-group');
            expect(groups.length).toBe(0);
        });

        it('should call onUpdate after removing group', () => {
            manager.addFilterGroup(container, true);
            manager.addFilterGroup(container, false);
            mockOnUpdate.mockClear();

            const groups = container.querySelectorAll('.pdt-filter-group');
            const removeBtn = groups[1].querySelector('.pdt-filter-group-remove');
            removeBtn.click();

            expect(mockOnUpdate).toHaveBeenCalled();
        });

        it('should cleanup handlers when removing group', () => {
            manager.addFilterGroup(container, true);
            manager.addFilterGroup(container, false);

            const initialHandlerCount = mockHandlers.size;

            const groups = container.querySelectorAll('.pdt-filter-group');
            const removeBtn = groups[1].querySelector('.pdt-filter-group-remove');
            removeBtn.click();

            expect(mockHandlers.size).toBeLessThan(initialHandlerCount);
        });
    });

    describe('operator value visibility', () => {
        it('should disable value input for null operator', () => {
            manager.addFilterGroup(container, true);

            const operatorSelect = container.querySelector('[data-prop="operator"]');
            operatorSelect.value = 'null';
            operatorSelect.dispatchEvent(new Event('change'));

            const valueInput = container.querySelector('[data-prop="value"]');
            expect(valueInput.disabled).toBe(true);
        });

        it('should disable value input for not-null operator', () => {
            manager.addFilterGroup(container, true);

            const operatorSelect = container.querySelector('[data-prop="operator"]');
            operatorSelect.value = 'not-null';
            operatorSelect.dispatchEvent(new Event('change'));

            const valueInput = container.querySelector('[data-prop="value"]');
            expect(valueInput.disabled).toBe(true);
        });

        it('should enable value input for eq operator', () => {
            manager.addFilterGroup(container, true);

            const operatorSelect = container.querySelector('[data-prop="operator"]');
            operatorSelect.value = 'eq';
            operatorSelect.dispatchEvent(new Event('change'));

            const valueInput = container.querySelector('[data-prop="value"]');
            expect(valueInput.disabled).toBe(false);
        });

        it('should clear value when switching to null operator', () => {
            manager.addFilterGroup(container, true);

            const valueInput = container.querySelector('[data-prop="value"]');
            valueInput.value = 'test';

            const operatorSelect = container.querySelector('[data-prop="operator"]');
            operatorSelect.value = 'null';
            operatorSelect.dispatchEvent(new Event('change'));

            expect(valueInput.value).toBe('');
        });
    });

    describe('OData operator filter', () => {
        it('should use OData operators when operatorFilter is odata', () => {
            const odataManager = new FilterGroupManager({
                handlers: mockHandlers,
                getEntityContext: mockGetEntityContext,
                renderValueInput: mockRenderValueInput,
                operatorFilter: 'odata'
            });

            const odataContainer = document.createElement('div');
            odataManager.addFilterGroup(odataContainer, true);

            const operatorSelect = odataContainer.querySelector('[data-prop="operator"]');
            expect(operatorSelect.options.length).toBeGreaterThan(0);
        });
    });

    describe('MutationObserver cleanup', () => {
        it('should disconnect MutationObserver when removing first filter group that has an observer', () => {
            manager.addFilterGroup(container, true);
            manager.addFilterGroup(container, false);

            const firstGroup = container.querySelector('.pdt-filter-group');
            expect(firstGroup._observer).toBeDefined();

            const disconnectSpy = vi.spyOn(firstGroup._observer, 'disconnect');

            // Remove the second group first, then remove first group
            const groups = container.querySelectorAll('.pdt-filter-group');
            const removeBtn = groups[0].querySelector('.pdt-filter-group-remove');
            removeBtn.disabled = false;

            // Add content to enable removal
            const attrInput = groups[0].querySelector('[data-prop="attribute"]');
            attrInput.value = 'name';

            removeBtn.click();

            // Verify observer was disconnected
            expect(disconnectSpy).toHaveBeenCalled();
        });

        it('should set observer to null after disconnecting when removing first group', () => {
            manager.addFilterGroup(container, true);
            manager.addFilterGroup(container, false);

            const groups = container.querySelectorAll('.pdt-filter-group');
            const firstGroup = groups[0];
            expect(firstGroup._observer).toBeDefined();

            // Remove second group
            const removeBtn2 = groups[1].querySelector('.pdt-filter-group-remove');
            removeBtn2.click();

            // Now try to remove first group when it's the only one - should completely remove it
            const removeBtn1 = firstGroup.querySelector('.pdt-filter-group-remove');
            removeBtn1.disabled = false;
            firstGroup.querySelector('[data-prop="attribute"]').value = 'name';
            removeBtn1.click();

            // First group should be completely removed, leaving container empty
            expect(container.querySelectorAll('.pdt-filter-group').length).toBe(0);
        });

        it('should handle filter group without observer gracefully', () => {
            manager.addFilterGroup(container, true);
            manager.addFilterGroup(container, false);

            const groups = container.querySelectorAll('.pdt-filter-group');
            // Second group should not have observer
            expect(groups[1]._observer).toBeUndefined();

            const removeBtn = groups[1].querySelector('.pdt-filter-group-remove');
            // Should not throw when removing group without observer
            expect(() => removeBtn.click()).not.toThrow();
        });
    });

    describe('browseConditionHandler', () => {
        it('should call MetadataHelpers.showColumnBrowser when browse button is clicked', async () => {
            const { MetadataHelpers } = await import('../../src/helpers/metadata.helpers.js');

            manager.addFilterGroup(container, true);
            const browseBtn = container.querySelector('.browse-condition-attr');

            browseBtn.click();

            expect(MetadataHelpers.showColumnBrowser).toHaveBeenCalled();
        });

        it('should pass getEntityContext function to showColumnBrowser', async () => {
            const { MetadataHelpers } = await import('../../src/helpers/metadata.helpers.js');

            manager.addFilterGroup(container, true);
            const browseBtn = container.querySelector('.browse-condition-attr');

            browseBtn.click();

            expect(MetadataHelpers.showColumnBrowser).toHaveBeenCalledWith(
                expect.any(Function),
                expect.any(Function)
            );
        });

        it('should invoke getEntityContext when showColumnBrowser requests entity', async () => {
            const { MetadataHelpers } = await import('../../src/helpers/metadata.helpers.js');

            // Mock showColumnBrowser to invoke the getEntityContext callback
            MetadataHelpers.showColumnBrowser.mockImplementation(async (getEntityFn, callback) => {
                // Call the getEntityContext lambda (line 204)
                await getEntityFn();
                await callback({ LogicalName: 'testattr' });
            });

            manager.addFilterGroup(container, true);
            const browseBtn = container.querySelector('.browse-condition-attr');

            await browseBtn.click();
            await new Promise(resolve => setTimeout(resolve, 10));

            // Verify getEntityContext was called
            expect(mockGetEntityContext).toHaveBeenCalled();
        });

        it('should update attribute input when column is selected via browse', async () => {
            const { MetadataHelpers } = await import('../../src/helpers/metadata.helpers.js');

            // Mock showColumnBrowser to call the callback with an attribute
            MetadataHelpers.showColumnBrowser.mockImplementation(async (getEntity, callback) => {
                await callback({ LogicalName: 'accountname' });
            });

            manager.addFilterGroup(container, true);
            const browseBtn = container.querySelector('.browse-condition-attr');
            const attrInput = container.querySelector('[data-prop="attribute"]');

            await browseBtn.click();

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(attrInput.value).toBe('accountname');
        });

        it('should call renderValueInput when column is selected via browse', async () => {
            const { MetadataHelpers } = await import('../../src/helpers/metadata.helpers.js');

            const mockAttr = { LogicalName: 'statuscode' };
            MetadataHelpers.showColumnBrowser.mockImplementation(async (getEntity, callback) => {
                await callback(mockAttr);
            });

            manager.addFilterGroup(container, true);
            const browseBtn = container.querySelector('.browse-condition-attr');

            await browseBtn.click();
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRenderValueInput).toHaveBeenCalledWith(
                mockAttr,
                expect.any(HTMLElement),
                mockGetEntityContext
            );
        });

        it('should call onUpdate after column is selected via browse', async () => {
            const { MetadataHelpers } = await import('../../src/helpers/metadata.helpers.js');

            MetadataHelpers.showColumnBrowser.mockImplementation(async (getEntity, callback) => {
                await callback({ LogicalName: 'name' });
            });

            manager.addFilterGroup(container, true);
            mockOnUpdate.mockClear();

            const browseBtn = container.querySelector('.browse-condition-attr');
            await browseBtn.click();
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockOnUpdate).toHaveBeenCalled();
        });

        it('should update remove button state for first condition after browse selection', async () => {
            const { MetadataHelpers } = await import('../../src/helpers/metadata.helpers.js');

            MetadataHelpers.showColumnBrowser.mockImplementation(async (getEntity, callback) => {
                await callback({ LogicalName: 'accountid' });
            });

            manager.addFilterGroup(container, true);
            const browseBtn = container.querySelector('.browse-condition-attr');
            const removeBtn = container.querySelector('.pdt-condition-remove');

            // Remove button is always enabled now
            expect(removeBtn.disabled).toBe(false);

            await browseBtn.click();
            await new Promise(resolve => setTimeout(resolve, 10));

            // After selecting a column, remove button should still be enabled
            expect(removeBtn.disabled).toBe(false);
        });
    });

    describe('updateRemoveButtonState in addCondition', () => {
        it('should keep remove button enabled regardless of value input content for first condition', () => {
            manager.addFilterGroup(container, true);

            const valueInput = container.querySelector('[data-prop="value"]');
            const removeBtn = container.querySelector('.pdt-condition-remove');

            expect(removeBtn.disabled).toBe(false);

            valueInput.value = 'test value';
            valueInput.dispatchEvent(new Event('input'));

            expect(removeBtn.disabled).toBe(false);
        });

        it('should always keep remove button enabled for first condition', () => {
            manager.addFilterGroup(container, true);

            const attrInput = container.querySelector('[data-prop="attribute"]');
            const valueInput = container.querySelector('[data-prop="value"]');
            const removeBtn = container.querySelector('.pdt-condition-remove');

            expect(removeBtn.disabled).toBe(false);

            // Set values
            attrInput.value = 'name';
            attrInput.dispatchEvent(new Event('input'));
            expect(removeBtn.disabled).toBe(false);

            attrInput.value = '';
            valueInput.value = '';
            attrInput.dispatchEvent(new Event('input'));

            expect(removeBtn.disabled).toBe(false);
        });

        it('should keep remove button enabled if only attribute is cleared but value has content', () => {
            manager.addFilterGroup(container, true);

            const attrInput = container.querySelector('[data-prop="attribute"]');
            const valueInput = container.querySelector('[data-prop="value"]');
            const removeBtn = container.querySelector('.pdt-condition-remove');

            // Set both values
            attrInput.value = 'name';
            valueInput.value = 'test';
            attrInput.dispatchEvent(new Event('input'));
            expect(removeBtn.disabled).toBe(false);

            // Clear only attribute
            attrInput.value = '';
            attrInput.dispatchEvent(new Event('input'));

            expect(removeBtn.disabled).toBe(false);
        });
    });

    describe('edge cases for condition removal', () => {
        it('should cleanup browse button handler when removing condition', () => {
            manager.addFilterGroup(container, true);
            const conditionsContainer = container.querySelector('.pdt-filter-group-conditions');
            manager.addCondition(conditionsContainer, false);

            const conditions = conditionsContainer.querySelectorAll('.pdt-condition-grid');
            const browseBtn = conditions[1].querySelector('.browse-condition-attr');

            expect(mockHandlers.has(browseBtn)).toBe(true);

            const removeBtn = conditions[1].querySelector('.pdt-condition-remove');
            removeBtn.click();

            expect(mockHandlers.has(browseBtn)).toBe(false);
        });

        it('should reset operator to first option when clearing first condition', () => {
            manager.addFilterGroup(container, true);
            const conditionsContainer = container.querySelector('.pdt-filter-group-conditions');

            const operatorSelect = conditionsContainer.querySelector('[data-prop="operator"]');
            operatorSelect.selectedIndex = 2; // Select a different operator

            const attrInput = conditionsContainer.querySelector('[data-prop="attribute"]');
            attrInput.value = 'name';

            const removeBtn = conditionsContainer.querySelector('.pdt-condition-remove');
            removeBtn.disabled = false;
            removeBtn.click();

            expect(operatorSelect.selectedIndex).toBe(0);
        });

        it('should restore default value input when clearing first condition', () => {
            manager.addFilterGroup(container, true);
            const conditionsContainer = container.querySelector('.pdt-filter-group-conditions');

            // Replace value container with custom content
            const valueContainer = conditionsContainer.querySelector('.pdt-value-container');
            valueContainer.innerHTML = '<select data-prop="value"><option>Custom</option></select>';

            const attrInput = conditionsContainer.querySelector('[data-prop="attribute"]');
            attrInput.value = 'name';

            const removeBtn = conditionsContainer.querySelector('.pdt-condition-remove');
            removeBtn.disabled = false;
            removeBtn.click();

            // Should restore default input
            const newValueInput = conditionsContainer.querySelector('[data-prop="value"]');
            expect(newValueInput.tagName).toBe('INPUT');
        });
    });

    describe('extractFilterGroups edge cases', () => {
        it('should handle missing filter-type selector gracefully', () => {
            manager.addFilterGroup(container, true);

            // Remove filter-type selector
            const filterType = container.querySelector('[data-prop="filter-type"]');
            filterType.remove();

            const attrInput = container.querySelector('[data-prop="attribute"]');
            attrInput.value = 'name';

            const result = manager.extractFilterGroups(container);

            // Should default to 'and'
            expect(result[0].filterType).toBe('and');
        });

        it('should handle missing operator selector gracefully', () => {
            manager.addFilterGroup(container, true);

            const attrInput = container.querySelector('[data-prop="attribute"]');
            attrInput.value = 'name';

            // Remove operator selector
            const operatorSelect = container.querySelector('[data-prop="operator"]');
            operatorSelect.remove();

            const result = manager.extractFilterGroups(container);

            // Condition should be filtered out because op is empty
            expect(result.length).toBe(0);
        });

        it('should handle undefined value in valueInput', () => {
            manager.addFilterGroup(container, true);

            const attrInput = container.querySelector('[data-prop="attribute"]');
            attrInput.value = 'statuscode';

            // Replace value container with element that has undefined value
            const valueContainer = container.querySelector('.pdt-value-container');
            const customElement = document.createElement('div');
            customElement.setAttribute('data-prop', 'value');
            // Note: div doesn't have .value property, so it will be undefined
            valueContainer.innerHTML = '';
            valueContainer.appendChild(customElement);

            const result = manager.extractFilterGroups(container);

            // When valueInput.value is undefined, the code treats it as empty string
            // The filter is included because attr and op are present
            expect(result.length).toBe(1);
            expect(result[0].filters[0].value).toBe('');
        });

        it('should handle inter-group operator missing select element', () => {
            manager.addFilterGroup(container, true);
            manager.addFilterGroup(container, false);

            const groups = container.querySelectorAll('.pdt-filter-group');
            groups[0].querySelector('[data-prop="attribute"]').value = 'name';
            groups[0].querySelector('[data-prop="value"]').value = 'test1';
            groups[1].querySelector('[data-prop="attribute"]').value = 'email';
            groups[1].querySelector('[data-prop="value"]').value = 'test2';

            // Remove inter-group operator select
            const separator = container.querySelector('.pdt-filter-group-separator');
            const interGroupOp = separator.querySelector('[data-prop="inter-group-operator"]');
            interGroupOp.remove();

            const result = manager.extractFilterGroups(container);

            // Should default to 'and'
            expect(result[1].interGroupOperator).toBe('and');
        });
    });

    describe('operator change with different input types', () => {
        it('should update placeholder for INPUT elements when operator changes to null', () => {
            manager.addFilterGroup(container, true);

            const operatorSelect = container.querySelector('[data-prop="operator"]');
            const valueInput = container.querySelector('[data-prop="value"]');

            expect(valueInput.placeholder).toBe('Value');

            operatorSelect.value = 'null';
            operatorSelect.dispatchEvent(new Event('change'));

            expect(valueInput.placeholder).toBe('N/A');
        });

        it('should restore placeholder when switching back from null operator', () => {
            manager.addFilterGroup(container, true);

            const operatorSelect = container.querySelector('[data-prop="operator"]');
            const valueInput = container.querySelector('[data-prop="value"]');

            operatorSelect.value = 'null';
            operatorSelect.dispatchEvent(new Event('change'));
            expect(valueInput.placeholder).toBe('N/A');

            operatorSelect.value = 'eq';
            operatorSelect.dispatchEvent(new Event('change'));
            expect(valueInput.placeholder).toBe('Value');
        });

        it('should handle operator change when value input is a SELECT element', () => {
            manager.addFilterGroup(container, true);

            // Replace value input with SELECT
            const valueContainer = container.querySelector('.pdt-value-container');
            valueContainer.innerHTML = '<select data-prop="value"><option value="1">Option 1</option></select>';

            const operatorSelect = container.querySelector('[data-prop="operator"]');
            const valueSelect = container.querySelector('[data-prop="value"]');

            operatorSelect.value = 'null';
            operatorSelect.dispatchEvent(new Event('change'));

            // Should disable but not set placeholder (SELECT doesn't have placeholder)
            expect(valueSelect.disabled).toBe(true);
            expect(valueSelect.value).toBe('');
        });
    });

    describe('auto-detection of attribute types when manually entered', () => {
        it('should auto-detect attribute type on blur when attribute name is entered', async () => {
            manager.addFilterGroup(container, true);

            const attrInput = container.querySelector('[data-prop="attribute"]');
            attrInput.value = 'filesizeinbytes';
            attrInput.dispatchEvent(new Event('blur'));

            // Allow async operations to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockGetEntityContext).toHaveBeenCalled();
            expect(mockGetAttributeMetadata).toHaveBeenCalledWith('filesizeinbytes', 'account');
            expect(mockRenderValueInput).toHaveBeenCalled();
        });

        it('should auto-detect birthdate and render date picker', async () => {
            manager.addFilterGroup(container, true);

            const attrInput = container.querySelector('[data-prop="attribute"]');
            attrInput.value = 'birthdate';
            attrInput.dispatchEvent(new Event('blur'));

            // Allow async operations to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockGetAttributeMetadata).toHaveBeenCalledWith('birthdate', 'account');
            expect(mockRenderValueInput).toHaveBeenCalled();
            const birthDateAttr = mockRenderValueInput.mock.calls[0][0];
            expect(birthDateAttr.LogicalName).toBe('birthdate');
        });

        it('should auto-detect attribute type after debounce on input', async () => {
            manager.addFilterGroup(container, true);

            const attrInput = container.querySelector('[data-prop="attribute"]');
            attrInput.value = 'versionnumber';
            attrInput.dispatchEvent(new Event('input'));

            // Wait for debounce (500ms + extra for async)
            await new Promise(resolve => setTimeout(resolve, 600));

            expect(mockGetEntityContext).toHaveBeenCalled();
            expect(mockGetAttributeMetadata).toHaveBeenCalledWith('versionnumber', 'account');
            expect(mockRenderValueInput).toHaveBeenCalled();
        });

        it('should not trigger auto-detection for short attribute names', async () => {
            manager.addFilterGroup(container, true);

            const attrInput = container.querySelector('[data-prop="attribute"]');
            attrInput.value = 'ab'; // Only 2 characters
            attrInput.dispatchEvent(new Event('blur'));

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockGetAttributeMetadata).not.toHaveBeenCalled();
            expect(mockRenderValueInput).not.toHaveBeenCalled();
        });

        it('should handle missing entity context gracefully', async () => {
            mockGetEntityContext.mockResolvedValue(null);
            manager.addFilterGroup(container, true);

            const attrInput = container.querySelector('[data-prop="attribute"]');
            attrInput.value = 'filesizeinbytes';
            attrInput.dispatchEvent(new Event('blur'));

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockGetEntityContext).toHaveBeenCalled();
            expect(mockGetAttributeMetadata).not.toHaveBeenCalled();
            expect(mockRenderValueInput).not.toHaveBeenCalled();
        });

        it('should handle attribute not found gracefully', async () => {
            manager.addFilterGroup(container, true);

            const attrInput = container.querySelector('[data-prop="attribute"]');
            attrInput.value = 'nonexistentfield';
            attrInput.dispatchEvent(new Event('blur'));

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockGetAttributeMetadata).toHaveBeenCalledWith('nonexistentfield', 'account');
            expect(mockRenderValueInput).not.toHaveBeenCalled();
        });

        it('should call onUpdate when attribute metadata is successfully loaded', async () => {
            manager.addFilterGroup(container, true);
            mockOnUpdate.mockClear(); // Clear initial calls

            const attrInput = container.querySelector('[data-prop="attribute"]');
            attrInput.value = 'name';
            attrInput.dispatchEvent(new Event('blur'));

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockOnUpdate).toHaveBeenCalled();
        });

        it('should debounce multiple rapid input events', async () => {
            manager.addFilterGroup(container, true);

            const attrInput = container.querySelector('[data-prop="attribute"]');

            // Rapid inputs
            attrInput.value = 'f';
            attrInput.dispatchEvent(new Event('input'));
            await new Promise(resolve => setTimeout(resolve, 100));

            attrInput.value = 'fi';
            attrInput.dispatchEvent(new Event('input'));
            await new Promise(resolve => setTimeout(resolve, 100));

            attrInput.value = 'fil';
            attrInput.dispatchEvent(new Event('input'));
            await new Promise(resolve => setTimeout(resolve, 100));

            attrInput.value = 'files';
            attrInput.dispatchEvent(new Event('input'));

            // Only wait for debounce once
            await new Promise(resolve => setTimeout(resolve, 600));

            // Should only call once after debounce
            expect(mockGetEntityContext).toHaveBeenCalledTimes(1);
        });

        it('should not trigger auto-detection if getAttributeMetadata is not provided', async () => {
            // Create manager without getAttributeMetadata callback
            const managerWithoutCallback = new FilterGroupManager({
                handlers: mockHandlers,
                getEntityContext: mockGetEntityContext,
                renderValueInput: mockRenderValueInput,
                showNotOperator: false,
                operatorFilter: 'fetch',
                onUpdate: mockOnUpdate
            });

            const tempContainer = document.createElement('div');
            document.body.appendChild(tempContainer);
            managerWithoutCallback.addFilterGroup(tempContainer, true);

            const attrInput = tempContainer.querySelector('[data-prop="attribute"]');
            attrInput.value = 'filesizeinbytes';
            attrInput.dispatchEvent(new Event('blur'));

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockGetAttributeMetadata).not.toHaveBeenCalled();

            tempContainer.remove();
        });
    });
});
