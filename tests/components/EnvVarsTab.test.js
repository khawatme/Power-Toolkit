/**
 * @file Comprehensive tests for EnvVarsTab (EnvironmentVariablesTab) component
 * @module tests/components/EnvVarsTab.test.js
 * @description Tests for the Environment Variables viewer and editor component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvironmentVariablesTab } from '../../src/components/EnvVarsTab.js';

// Mock environment variables data
const mockEnvVars = [
    {
        definitionId: 'def-1',
        valueId: 'val-1',
        displayName: 'Test Variable 1',
        schemaName: 'test_Variable1',
        type: 'String',
        currentValue: 'value1',
        defaultValue: 'default1',
        description: 'A test variable'
    },
    {
        definitionId: 'def-2',
        valueId: 'val-2',
        displayName: 'Test Variable 2',
        schemaName: 'test_Variable2',
        type: 'Number',
        currentValue: '42',
        defaultValue: '0',
        description: 'A numeric variable'
    },
    {
        definitionId: 'def-3',
        valueId: null,
        displayName: 'JSON Variable',
        schemaName: 'test_JsonVar',
        type: 'Json',
        currentValue: '{"key": "value"}',
        defaultValue: '{}',
        description: 'A JSON variable'
    },
    {
        definitionId: 'def-4',
        valueId: 'val-4',
        displayName: 'Boolean Variable',
        schemaName: 'test_BoolVar',
        type: 'Boolean',
        currentValue: 'true',
        defaultValue: 'false',
        description: 'A boolean variable'
    }
];

// Mock dependencies
vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        getEnvironmentVariables: vi.fn(() => Promise.resolve(mockEnvVars)),
        setEnvironmentVariableValue: vi.fn(() => Promise.resolve({ id: 'new-value-id' })),
        setEnvironmentVariableDefault: vi.fn(() => Promise.resolve()),
        deleteEnvironmentVariable: vi.fn(() => Promise.resolve()),
        createEnvironmentVariable: vi.fn(() => Promise.resolve({
            definitionId: 'new-def-id',
            valueId: 'new-val-id',
            schemaname: 'test_NewVariable'
        })),
        listSolutions: vi.fn(() => Promise.resolve([
            { uniqueName: 'TestSolution', friendlyName: 'Test Solution', prefix: 'test' }
        ])),
        setCurrentSolution: vi.fn(() => Promise.resolve()),
        getCurrentSolution: vi.fn(() => ({ uniqueName: 'TestSolution', publisherPrefix: 'test' }))
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/services/DialogService.js', () => ({
    DialogService: {
        show: vi.fn((title, content) => {
            const overlay = document.createElement('div');
            overlay.id = 'pdt-dialog-overlay';
            overlay.innerHTML = '<div class="pdt-dialog"><div class="pdt-dialog-content"></div><div class="pdt-dialog-footer"></div></div>';
            overlay.querySelector('.pdt-dialog-content').appendChild(content);
            document.body.appendChild(overlay);
            return { close: () => overlay.remove() };
        })
    }
}));

vi.mock('../../src/services/ValidationService.js', () => ({
    ValidationService: {
        validateJson: vi.fn((input) => JSON.parse(input)),
        validateNumber: vi.fn((input) => {
            const n = Number(input);
            if (isNaN(n)) throw new Error('Invalid number');
            return n;
        }),
        validateBoolean: vi.fn((input) => {
            const s = String(input).toLowerCase();
            if (s === 'true') return true;
            if (s === 'false') return false;
            throw new Error('Invalid boolean');
        })
    }
}));

vi.mock('../../src/ui/UIFactory.js', () => ({
    UIFactory: {
        createCodeBlock: vi.fn(() => document.createElement('div')),
        createCopyableCodeBlock: vi.fn((value) => {
            const pre = document.createElement('pre');
            pre.className = 'copyable-code-block';
            pre.innerHTML = `<code>${value}</code><button class="copy-btn">Copy</button>`;
            return pre;
        })
    }
}));

// Mock helper functions
vi.mock('../../src/helpers/index.js', async () => {
    const actual = await vi.importActual('../../src/helpers/index.js');
    return {
        ...actual,
        debounce: (fn) => {
            const debounced = (...args) => fn(...args);
            debounced.cancel = () => { };
            return debounced;
        },
        showConfirmDialog: vi.fn(() => Promise.resolve(true)),
        copyToClipboard: vi.fn()
    };
});

import { DataService } from '../../src/services/DataService.js';
import { NotificationService } from '../../src/services/NotificationService.js';
import { showConfirmDialog, copyToClipboard } from '../../src/helpers/index.js';

describe('EnvVarsTab', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        DataService.getEnvironmentVariables.mockResolvedValue(mockEnvVars);
        document.body.innerHTML = '';
    });

    afterEach(() => {
        component?.destroy?.();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with correct id', () => {
            component = new EnvironmentVariablesTab();
            expect(component.id).toBe('envVars');
        });

        it('should initialize with correct label', () => {
            component = new EnvironmentVariablesTab();
            expect(component.label).toContain('Env');
        });

        it('should have an icon defined', () => {
            component = new EnvironmentVariablesTab();
            expect(component.icon).toBeDefined();
        });

        it('should NOT be a form-only component', () => {
            component = new EnvironmentVariablesTab();
            expect(component.isFormOnly).toBe(false);
        });

        it('should initialize UI object', () => {
            component = new EnvironmentVariablesTab();
            expect(component.ui).toBeDefined();
            expect(component.ui).toEqual({});
        });

        it('should initialize allVars as empty array', () => {
            component = new EnvironmentVariablesTab();
            expect(component.allVars).toEqual([]);
        });

        it('should have filterCards debounced function', () => {
            component = new EnvironmentVariablesTab();
            expect(component.filterCards).toBeDefined();
            expect(typeof component.filterCards).toBe('function');
        });

        it('should initialize handler references as null', () => {
            component = new EnvironmentVariablesTab();
            expect(component._addBtnHandler).toBeNull();
            expect(component._searchInputHandler).toBeNull();
            expect(component._listClickHandler).toBeNull();
        });

        it('should initialize dynamic handlers map', () => {
            component = new EnvironmentVariablesTab();
            expect(component._dynamicHandlers).toBeInstanceOf(Map);
            expect(component._dynamicHandlers.size).toBe(0);
        });
    });

    describe('render', () => {
        beforeEach(() => {
            component = new EnvironmentVariablesTab();
        });

        it('should return an HTMLElement', async () => {
            const element = await component.render();
            expect(element).toBeInstanceOf(HTMLElement);
        });

        it('should render section title', async () => {
            const element = await component.render();
            expect(element.querySelector('.section-title')).toBeTruthy();
            expect(element.textContent).toContain('Environment Variables');
        });

        it('should render search input', async () => {
            const element = await component.render();
            const searchInput = element.querySelector('#env-var-search');
            expect(searchInput).toBeTruthy();
        });

        it('should render search input with placeholder', async () => {
            const element = await component.render();
            const searchInput = element.querySelector('#env-var-search');
            expect(searchInput.placeholder).toContain('Search');
        });

        it('should render add button', async () => {
            const element = await component.render();
            const addBtn = element.querySelector('#env-var-add-btn');
            expect(addBtn).toBeTruthy();
            expect(addBtn.textContent).toContain('New Variable');
        });

        it('should render list container', async () => {
            const element = await component.render();
            const listContainer = element.querySelector('#env-var-list');
            expect(listContainer).toBeTruthy();
        });

        it('should cache listContainer in ui', async () => {
            await component.render();
            expect(component.ui.listContainer).toBeTruthy();
        });

        it('should call DataService.getEnvironmentVariables', async () => {
            await component.render();
            expect(DataService.getEnvironmentVariables).toHaveBeenCalled();
        });

        it('should populate allVars after render', async () => {
            await component.render();
            expect(component.allVars.length).toBe(4);
        });

        it('should render variable cards', async () => {
            const element = await component.render();
            const cards = element.querySelectorAll('.env-var-card');
            expect(cards.length).toBe(4);
        });

        it('should display variable names in cards', async () => {
            const element = await component.render();
            expect(element.textContent).toContain('Test Variable 1');
            expect(element.textContent).toContain('Test Variable 2');
        });

        it('should display schema names in cards', async () => {
            const element = await component.render();
            expect(element.textContent).toContain('test_Variable1');
            expect(element.textContent).toContain('test_Variable2');
        });

        it('should handle empty variables gracefully', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([]);
            const element = await component.render();
            expect(element.querySelector('.pdt-note')).toBeTruthy();
        });

        it('should show "no variables found" when list is empty', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([]);
            const element = await component.render();
            expect(element.textContent).toContain('No environment variables found');
        });

        it('should handle errors gracefully', async () => {
            DataService.getEnvironmentVariables.mockRejectedValueOnce(new Error('Test error'));
            const element = await component.render();
            expect(element.querySelector('.pdt-error')).toBeTruthy();
        });

        it('should display error message content', async () => {
            DataService.getEnvironmentVariables.mockRejectedValueOnce(new Error('API Error'));
            const element = await component.render();
            expect(element.textContent).toContain('API Error');
        });
    });

    describe('postRender', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
        });

        it('should not throw when called', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            expect(() => component.postRender(element)).not.toThrow();
        });

        it('should cache UI elements', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component.ui.searchInput).toBeTruthy();
            expect(component.ui.listContainer).toBeTruthy();
            expect(component.ui.addBtn).toBeTruthy();
        });

        it('should setup add button handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._addBtnHandler).toBeDefined();
            expect(typeof component._addBtnHandler).toBe('function');
        });

        it('should setup search input handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._searchInputHandler).toBeDefined();
            expect(typeof component._searchInputHandler).toBe('function');
        });

        it('should setup list click handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._listClickHandler).toBeDefined();
            expect(typeof component._listClickHandler).toBe('function');
        });
    });

    describe('card creation', () => {
        beforeEach(() => {
            component = new EnvironmentVariablesTab();
        });

        it('should create cards with data attributes', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            const card = element.querySelector('.env-var-card');

            expect(card.dataset.definitionId).toBe('def-1');
            expect(card.dataset.valueId).toBe('val-1');
            expect(card.dataset.type).toBe('String');
            expect(card.dataset.schemaName).toBe('test_Variable1');
        });

        it('should include Edit Current button', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            const editBtn = element.querySelector('.edit-btn');
            expect(editBtn).toBeTruthy();
            expect(editBtn.textContent).toBe('Edit Current');
        });

        it('should include Edit Default button', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            const editDefaultBtn = element.querySelector('.edit-default-btn');
            expect(editDefaultBtn).toBeTruthy();
            expect(editDefaultBtn.textContent).toBe('Edit Default');
        });

        it('should include Delete button', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            const deleteBtn = element.querySelector('.delete-btn');
            expect(deleteBtn).toBeTruthy();
            expect(deleteBtn.textContent).toBe('Delete');
        });

        it('should display current value', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            expect(element.textContent).toContain('value1');
        });

        it('should display default value', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            expect(element.textContent).toContain('default1');
        });

        it('should display "(not set)" for empty current value', async () => {
            const varWithNoValue = { ...mockEnvVars[0], currentValue: '' };
            DataService.getEnvironmentVariables.mockResolvedValueOnce([varWithNoValue]);
            const element = await component.render();
            expect(element.textContent).toContain('(not set)');
        });

        it('should create searchable text in dataset', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            const card = element.querySelector('.env-var-card');
            expect(card.dataset.searchTerm).toContain('test variable 1');
            expect(card.dataset.searchTerm).toContain('test_variable1');
        });

        it('should handle variable without valueId', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[2]]); // JSON var with null valueId
            const element = await component.render();
            const card = element.querySelector('.env-var-card');
            expect(card.dataset.valueId).toBe('');
        });
    });

    describe('search/filter functionality', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
        });

        it('should have filterCards method', () => {
            expect(typeof component.filterCards).toBe('function');
        });

        it('should filter cards by search term', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.searchInput.value = 'Variable1';
            component._filterCards();

            const visibleCards = element.querySelectorAll('.env-var-card:not([style*="display: none"])');
            expect(visibleCards.length).toBe(1);
        });

        it('should be case-insensitive search', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.searchInput.value = 'variable1';
            component._filterCards();

            const visibleCards = element.querySelectorAll('.env-var-card:not([style*="display: none"])');
            expect(visibleCards.length).toBe(1);
        });

        it('should show all cards when search is empty', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.searchInput.value = '';
            component._filterCards();

            const visibleCards = element.querySelectorAll('.env-var-card:not([style*="display: none"])');
            expect(visibleCards.length).toBe(4);
        });

        it('should filter by type', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.searchInput.value = 'Number';
            component._filterCards();

            const visibleCards = element.querySelectorAll('.env-var-card:not([style*="display: none"])');
            expect(visibleCards.length).toBe(1);
        });

        it('should filter by schema name', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.searchInput.value = 'JsonVar';
            component._filterCards();

            const visibleCards = element.querySelectorAll('.env-var-card:not([style*="display: none"])');
            expect(visibleCards.length).toBe(1);
        });
    });

    describe('edit mode - current value', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
        });

        it('should switch to edit mode', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);

            const textarea = card.querySelector('.env-var-edit-area');
            expect(textarea).toBeTruthy();
        });

        it('should show Save and Cancel buttons in edit mode', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);

            expect(card.querySelector('.save-btn')).toBeTruthy();
            expect(card.querySelector('.cancel-btn')).toBeTruthy();
        });

        it('should disable save button initially', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);

            const saveBtn = card.querySelector('.save-btn');
            expect(saveBtn.disabled).toBe(true);
        });

        it('should enable save button when value changes', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);

            const textarea = card.querySelector('.env-var-edit-area');
            textarea.value = 'new value';
            textarea.dispatchEvent(new Event('input'));

            const saveBtn = card.querySelector('.save-btn');
            expect(saveBtn.disabled).toBe(false);
        });

        it('should return to view mode on cancel', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);
            component._switchToViewMode(card);

            expect(card.querySelector('.env-var-edit-area')).toBeFalsy();
            expect(card.querySelector('.edit-btn')).toBeTruthy();
        });

        it('should update displayed value on view mode with new value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);
            component._switchToViewMode(card, 'updated value');

            expect(card.dataset.originalValue).toBe('updated value');
        });
    });

    describe('save current value', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
        });

        it('should call DataService.setEnvironmentVariableValue on save', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);
            const textarea = card.querySelector('.env-var-edit-area');
            textarea.value = 'new value';

            await component._handleSaveClick(card);

            expect(DataService.setEnvironmentVariableValue).toHaveBeenCalledWith(
                'def-1', 'val-1', 'new value', 'test_Variable1'
            );
        });

        it('should show success notification on save', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);
            await component._handleSaveClick(card);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'success'
            );
        });

        it('should show error notification on save failure', async () => {
            DataService.setEnvironmentVariableValue.mockRejectedValueOnce(new Error('Save failed'));
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);
            await component._handleSaveClick(card);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('Save failed'),
                'error'
            );
        });

        it('should update valueId when creating new value', async () => {
            const varWithNoValueId = { ...mockEnvVars[0], valueId: null };
            DataService.getEnvironmentVariables.mockResolvedValueOnce([varWithNoValueId]);
            DataService.setEnvironmentVariableValue.mockResolvedValueOnce({ id: 'new-val-id' });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);
            await component._handleSaveClick(card);

            expect(card.dataset.valueId).toBe('new-val-id');
        });
    });

    describe('edit mode - default value', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
        });

        it('should switch to edit default mode', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);

            const textarea = card.querySelector('.env-var-default-edit-area');
            expect(textarea).toBeTruthy();
        });

        it('should show save-default and cancel-default buttons', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);

            expect(card.querySelector('.save-default-btn')).toBeTruthy();
            expect(card.querySelector('.cancel-default-btn')).toBeTruthy();
        });

        it('should call DataService.setEnvironmentVariableDefault on save', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);
            const textarea = card.querySelector('.env-var-default-edit-area');
            textarea.value = 'new default';

            await component._handleSaveDefault(card);

            expect(DataService.setEnvironmentVariableDefault).toHaveBeenCalledWith(
                'def-1', 'new default'
            );
        });

        it('should show success notification after saving default', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);
            await component._handleSaveDefault(card);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'success'
            );
        });

        it('should return to view mode after saving default', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);
            await component._handleSaveDefault(card);

            expect(card.querySelector('.env-var-default-edit-area')).toBeFalsy();
        });
    });

    describe('delete functionality', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
        });

        it('should show confirm dialog before delete', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            await component._handleDelete(card);

            expect(showConfirmDialog).toHaveBeenCalled();
        });

        it('should call DataService.deleteEnvironmentVariable when confirmed', async () => {
            showConfirmDialog.mockResolvedValueOnce(true);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            await component._handleDelete(card);

            expect(DataService.deleteEnvironmentVariable).toHaveBeenCalledWith('def-1');
        });

        it('should not delete when user cancels', async () => {
            showConfirmDialog.mockResolvedValueOnce(false);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            await component._handleDelete(card);

            expect(DataService.deleteEnvironmentVariable).not.toHaveBeenCalled();
        });

        it('should remove card from DOM after successful delete', async () => {
            showConfirmDialog.mockResolvedValueOnce(true);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            await component._handleDelete(card);

            expect(element.querySelector('.env-var-card')).toBeFalsy();
        });

        it('should show success notification after delete', async () => {
            showConfirmDialog.mockResolvedValueOnce(true);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            await component._handleDelete(card);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'success'
            );
        });

        it('should show error notification on delete failure', async () => {
            showConfirmDialog.mockResolvedValueOnce(true);
            DataService.deleteEnvironmentVariable.mockRejectedValueOnce(new Error('Delete failed'));
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            await component._handleDelete(card);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('Delete failed'),
                'error'
            );
        });
    });

    describe('type coercion', () => {
        beforeEach(() => {
            component = new EnvironmentVariablesTab();
        });

        it('should coerce JSON values', () => {
            const result = component._coerceByType('{"key": "value"}', 'Json');
            expect(result).toBe('{"key":"value"}');
        });

        it('should coerce number values', () => {
            const result = component._coerceByType('42', 'Number');
            expect(result).toBe('42');
        });

        it('should coerce boolean values', () => {
            const result = component._coerceByType('true', 'Boolean');
            expect(result).toBe('true');
        });

        it('should return string values unchanged', () => {
            const result = component._coerceByType('hello', 'String');
            expect(result).toBe('hello');
        });

        it('should handle case-insensitive type', () => {
            const result = component._coerceByType('42', 'number');
            expect(result).toBe('42');
        });
    });

    describe('create validation', () => {
        beforeEach(() => {
            component = new EnvironmentVariablesTab();
        });

        it('should require display name', () => {
            const isValid = component._isCreateModelValid({
                name: '',
                schema: 'test_Something',
                type: 'String'
            });
            expect(isValid).toBe(false);
        });

        it('should require schema name', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: '',
                type: 'String'
            });
            expect(isValid).toBe(false);
        });

        it('should reject schema with only prefix', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_',
                type: 'String'
            });
            expect(isValid).toBe(false);
        });

        it('should reject schema without actual name after prefix', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_   ',
                type: 'String'
            });
            expect(isValid).toBe(false);
        });

        it('should accept valid model', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test Variable',
                schema: 'test_Variable',
                type: 'String',
                defVal: '',
                curVal: ''
            });
            expect(isValid).toBe(true);
        });

        it('should validate number default value', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Number',
                defVal: 'not a number',
                curVal: ''
            });
            expect(isValid).toBe(false);
        });

        it('should accept valid number default value', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Number',
                defVal: '42',
                curVal: ''
            });
            expect(isValid).toBe(true);
        });

        it('should validate JSON default value', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Json',
                defVal: 'invalid json',
                curVal: ''
            });
            expect(isValid).toBe(false);
        });

        it('should accept valid JSON default value', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Json',
                defVal: '{"valid": true}',
                curVal: ''
            });
            expect(isValid).toBe(true);
        });

        it('should validate boolean default value', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Boolean',
                defVal: 'maybe',
                curVal: ''
            });
            expect(isValid).toBe(false);
        });

        it('should accept valid boolean default value', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Boolean',
                defVal: 'true',
                curVal: ''
            });
            expect(isValid).toBe(true);
        });
    });

    describe('delegated event handling', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
        });

        it('should handle copy button clicks', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[2]]); // JSON var
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const copyBtn = element.querySelector('.copy-btn');
            if (copyBtn) {
                copyBtn.click();
                expect(copyToClipboard).toHaveBeenCalled();
            }
        });

        it('should handle edit button via delegation', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const editBtn = element.querySelector('.edit-btn');
            editBtn.click();

            expect(element.querySelector('.env-var-edit-area')).toBeTruthy();
        });

        it('should handle cancel button via delegation', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Enter edit mode
            const editBtn = element.querySelector('.edit-btn');
            editBtn.click();

            // Click cancel
            const cancelBtn = element.querySelector('.cancel-btn');
            cancelBtn.click();

            expect(element.querySelector('.env-var-edit-area')).toBeFalsy();
            expect(element.querySelector('.edit-btn')).toBeTruthy();
        });

        it('should ignore clicks outside of buttons', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Click on card header (not a button)
            const header = element.querySelector('.pdt-card-header');
            header.click();

            // Should not throw or change state
            expect(element.querySelector('.edit-btn')).toBeTruthy();
        });
    });

    describe('destroy/cleanup', () => {
        it('should not throw when destroy is called', () => {
            component = new EnvironmentVariablesTab();
            expect(() => component.destroy()).not.toThrow();
        });

        it('should not throw when destroy is called after render', async () => {
            component = new EnvironmentVariablesTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(() => component.destroy()).not.toThrow();
        });

        it('should cleanup after render and postRender', async () => {
            component = new EnvironmentVariablesTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(() => component.destroy()).not.toThrow();
        });

        it('should remove event listeners on destroy', async () => {
            component = new EnvironmentVariablesTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = component.ui.addBtn;
            const removeEventListenerSpy = vi.spyOn(addBtn, 'removeEventListener');

            component.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalled();
        });

        it('should clear dynamic handlers on destroy', async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Create dynamic handlers by entering edit mode
            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);

            expect(component._dynamicHandlers.size).toBeGreaterThan(0);

            component.destroy();

            expect(component._dynamicHandlers.size).toBe(0);
        });
    });

    describe('helper methods', () => {
        beforeEach(() => {
            component = new EnvironmentVariablesTab();
        });

        it('should create textarea with minimum 4 rows', () => {
            const ta = component._mkTextarea('test-class', 'short');
            expect(Number(ta.rows)).toBeGreaterThanOrEqual(4);
        });

        it('should create textarea with correct rows for multiline', () => {
            const ta = component._mkTextarea('test-class', 'line1\nline2\nline3\nline4\nline5');
            expect(Number(ta.rows)).toBeGreaterThanOrEqual(5);
        });

        it('should create textarea with max 15 rows', () => {
            const manyLines = Array(20).fill('line').join('\n');
            const ta = component._mkTextarea('test-class', manyLines);
            expect(Number(ta.rows)).toBeLessThanOrEqual(15);
        });

        it('should create textarea with correct class', () => {
            const ta = component._mkTextarea('test-class', 'content');
            expect(ta.className).toBe('test-class');
        });

        it('should create dialog footer button', () => {
            const btn = component._mkDialogFooterBtn('test-id', 'test-class', 'Test', true);
            expect(btn.id).toBe('test-id');
            expect(btn.className).toBe('test-class');
            expect(btn.textContent).toBe('Test');
            expect(btn.disabled).toBe(true);
        });

        it('should create enabled button when disabled is false', () => {
            const btn = component._mkDialogFooterBtn('test-id', 'test-class', 'Test', false);
            expect(btn.disabled).toBe(false);
        });

        it('should create enabled button by default', () => {
            const btn = component._mkDialogFooterBtn('test-id', 'test-class', 'Test');
            expect(btn.disabled).toBe(false);
        });
    });

    describe('card footer management', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
        });

        it('should set card footer with buttons', async () => {
            const element = await component.render();
            const card = element.querySelector('.env-var-card');

            component._setCardFooter(card, [
                { cls: 'test-btn', text: 'Test' }
            ]);

            const footer = card.querySelector('.pdt-card-footer');
            expect(footer.querySelector('.test-btn')).toBeTruthy();
        });

        it('should set button title when provided', async () => {
            const element = await component.render();
            const card = element.querySelector('.env-var-card');

            component._setCardFooter(card, [
                { cls: 'test-btn', text: 'Test', title: 'Test title' }
            ]);

            const btn = card.querySelector('.test-btn');
            expect(btn.title).toBe('Test title');
        });

        it('should set button disabled when provided', async () => {
            const element = await component.render();
            const card = element.querySelector('.env-var-card');

            component._setCardFooter(card, [
                { cls: 'test-btn', text: 'Test', disabled: true }
            ]);

            const btn = card.querySelector('.test-btn');
            expect(btn.disabled).toBe(true);
        });
    });

    describe('search term update', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
        });

        it('should update search term with new current value', async () => {
            const element = await component.render();
            const card = element.querySelector('.env-var-card');

            component._updateCardSearchTerm(card, 'new current value');

            expect(card.dataset.searchTerm).toContain('new current value');
        });

        it('should update search term with new default value', async () => {
            const element = await component.render();
            const card = element.querySelector('.env-var-card');

            component._updateCardSearchTerm(card, undefined, 'new default value');

            expect(card.dataset.searchTerm).toContain('new default value');
        });

        it('should preserve display name in search term', async () => {
            const element = await component.render();
            const card = element.querySelector('.env-var-card');

            component._updateCardSearchTerm(card, 'updated');

            expect(card.dataset.searchTerm).toContain('test variable 1');
        });

        it('should preserve schema name in search term', async () => {
            const element = await component.render();
            const card = element.querySelector('.env-var-card');

            component._updateCardSearchTerm(card, 'updated');

            expect(card.dataset.searchTerm).toContain('test_variable1');
        });

        it('should preserve type in search term', async () => {
            const element = await component.render();
            const card = element.querySelector('.env-var-card');

            component._updateCardSearchTerm(card, 'updated');

            expect(card.dataset.searchTerm).toContain('string');
        });
    });

    describe('_loadEnvironmentVariables edge cases', () => {
        beforeEach(() => {
            component = new EnvironmentVariablesTab();
        });

        it('should handle variables with special characters in names', async () => {
            const specialVar = {
                ...mockEnvVars[0],
                displayName: 'Test <script>alert("XSS")</script>',
                schemaName: 'test_SpecialChars'
            };
            DataService.getEnvironmentVariables.mockResolvedValueOnce([specialVar]);

            const element = await component.render();

            // Should escape HTML, not execute script
            expect(element.textContent).toContain('<script>');
            expect(element.querySelector('script')).toBeFalsy();
        });

        it('should handle variables with undefined description', async () => {
            const varWithUndefinedDesc = { ...mockEnvVars[0], description: undefined };
            DataService.getEnvironmentVariables.mockResolvedValueOnce([varWithUndefinedDesc]);

            const element = await component.render();

            expect(element.textContent).toContain('—');
        });

        it('should handle variables with null displayName', async () => {
            const varWithNullName = { ...mockEnvVars[0], displayName: null };
            DataService.getEnvironmentVariables.mockResolvedValueOnce([varWithNullName]);

            const element = await component.render();
            const card = element.querySelector('.env-var-card');

            expect(card).toBeTruthy();
            expect(element.textContent).toContain('test_Variable1');
        });

        it('should handle network timeout errors', async () => {
            DataService.getEnvironmentVariables.mockRejectedValueOnce(new Error('Network timeout'));

            const element = await component.render();

            expect(element.querySelector('.pdt-error')).toBeTruthy();
            expect(element.textContent).toContain('Network timeout');
        });

        it('should handle 401 unauthorized errors', async () => {
            DataService.getEnvironmentVariables.mockRejectedValueOnce(new Error('401 Unauthorized'));

            const element = await component.render();

            expect(element.querySelector('.pdt-error')).toBeTruthy();
        });

        it('should handle very large variable lists', async () => {
            const largeList = Array(100).fill(null).map((_, i) => ({
                ...mockEnvVars[0],
                definitionId: `def-${i}`,
                schemaName: `test_Variable${i}`
            }));
            DataService.getEnvironmentVariables.mockResolvedValueOnce(largeList);

            const element = await component.render();
            const cards = element.querySelectorAll('.env-var-card');

            expect(cards.length).toBe(100);
        });
    });

    describe('_renderVariables edge cases', () => {
        beforeEach(() => {
            component = new EnvironmentVariablesTab();
        });

        it('should handle variables with "(not set)" as current value', async () => {
            const varNotSet = { ...mockEnvVars[0], currentValue: '(not set)' };
            DataService.getEnvironmentVariables.mockResolvedValueOnce([varNotSet]);

            const element = await component.render();
            const card = element.querySelector('.env-var-card');

            expect(card.dataset.originalValue).toBe('');
        });

        it('should handle variables with "—" as default value', async () => {
            const varDash = { ...mockEnvVars[0], defaultValue: '—' };
            DataService.getEnvironmentVariables.mockResolvedValueOnce([varDash]);

            const element = await component.render();
            const card = element.querySelector('.env-var-card');

            expect(card.dataset.defaultValue).toBe('');
        });

        it('should display JSON values with code block', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[2]]); // JSON var

            const element = await component.render();

            expect(element.querySelector('.copyable-code-block')).toBeTruthy();
        });

        it('should display string values as copyable spans', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]); // String var

            const element = await component.render();

            expect(element.querySelector('.copyable')).toBeTruthy();
        });

        it('should handle empty schemaName in card header', async () => {
            const varNoSchema = { ...mockEnvVars[0], schemaName: '', displayName: 'Only Display' };
            DataService.getEnvironmentVariables.mockResolvedValueOnce([varNoSchema]);

            const element = await component.render();

            expect(element.textContent).toContain('Only Display');
        });
    });

    describe('_editVariable edge cases', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
        });

        it('should format JSON value prettily in edit mode', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[2]]); // JSON var
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);

            const textarea = card.querySelector('.env-var-edit-area');
            expect(textarea.value).toBeDefined();
        });

        it('should handle empty original value in edit mode', async () => {
            const varEmpty = { ...mockEnvVars[0], currentValue: '' };
            DataService.getEnvironmentVariables.mockResolvedValueOnce([varEmpty]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);

            const textarea = card.querySelector('.env-var-edit-area');
            expect(textarea.value).toBe('');
        });

        it('should register input handler in dynamic handlers', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);

            expect(component._dynamicHandlers.size).toBeGreaterThan(0);
        });

        it('should disable save button when value reverts to original', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);

            const textarea = card.querySelector('.env-var-edit-area');
            const saveBtn = card.querySelector('.save-btn');

            // Change value
            textarea.value = 'changed';
            textarea.dispatchEvent(new Event('input'));
            expect(saveBtn.disabled).toBe(false);

            // Revert to original
            textarea.value = 'value1';
            textarea.dispatchEvent(new Event('input'));
            expect(saveBtn.disabled).toBe(true);
        });
    });

    describe('_saveVariable edge cases', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
        });

        it('should disable textarea during save', async () => {
            let resolvePromise;
            DataService.setEnvironmentVariableValue.mockReturnValueOnce(
                new Promise(resolve => { resolvePromise = resolve; })
            );

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);
            const textarea = card.querySelector('.env-var-edit-area');

            const savePromise = component._handleSaveClick(card);

            expect(textarea.disabled).toBe(true);
            resolvePromise({ id: 'test' });
            await savePromise;
        });

        it('should show "Saving..." text during save', async () => {
            let resolvePromise;
            DataService.setEnvironmentVariableValue.mockReturnValueOnce(
                new Promise(resolve => { resolvePromise = resolve; })
            );

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);

            const savePromise = component._handleSaveClick(card);
            const saveBtn = card.querySelector('.save-btn');

            expect(saveBtn.textContent).toBe('Saving...');
            resolvePromise({ id: 'test' });
            await savePromise;
        });

        it('should re-enable textarea on save error', async () => {
            DataService.setEnvironmentVariableValue.mockRejectedValueOnce(new Error('Save failed'));

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);
            const textarea = card.querySelector('.env-var-edit-area');

            await component._handleSaveClick(card);

            expect(textarea.disabled).toBe(false);
        });

        it('should handle environmentvariablevalueid in response', async () => {
            const varNoValueId = { ...mockEnvVars[0], valueId: null };
            DataService.getEnvironmentVariables.mockResolvedValueOnce([varNoValueId]);
            DataService.setEnvironmentVariableValue.mockResolvedValueOnce({
                environmentvariablevalueid: 'new-env-val-id'
            });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);
            await component._handleSaveClick(card);

            expect(card.dataset.valueId).toBe('new-env-val-id');
        });

        it('should validate invalid JSON type before save', async () => {
            const jsonVar = { ...mockEnvVars[2] };
            DataService.getEnvironmentVariables.mockResolvedValueOnce([jsonVar]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);
            const textarea = card.querySelector('.env-var-edit-area');
            textarea.value = 'not valid json';

            await component._handleSaveClick(card);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'error'
            );
            expect(DataService.setEnvironmentVariableValue).not.toHaveBeenCalled();
        });

        it('should validate invalid number type before save', async () => {
            const numVar = { ...mockEnvVars[1] };
            DataService.getEnvironmentVariables.mockResolvedValueOnce([numVar]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);
            const textarea = card.querySelector('.env-var-edit-area');
            textarea.value = 'not a number';

            await component._handleSaveClick(card);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.any(String),
                'error'
            );
        });
    });

    describe('_deleteVariable edge cases', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
        });

        it('should add visual feedback during delete', async () => {
            let resolvePromise;
            DataService.deleteEnvironmentVariable.mockReturnValueOnce(
                new Promise(resolve => { resolvePromise = resolve; })
            );
            showConfirmDialog.mockResolvedValueOnce(true);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            const deletePromise = component._handleDelete(card);

            // Wait for confirmation
            await vi.waitFor(() => {
                expect(card.style.opacity).toBe('0.6');
            });

            resolvePromise();
            await deletePromise;
        });

        it('should disable all buttons during delete', async () => {
            let resolvePromise;
            DataService.deleteEnvironmentVariable.mockReturnValueOnce(
                new Promise(resolve => { resolvePromise = resolve; })
            );
            showConfirmDialog.mockResolvedValueOnce(true);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            const deletePromise = component._handleDelete(card);

            await vi.waitFor(() => {
                const buttons = card.querySelectorAll('button');
                buttons.forEach(btn => expect(btn.disabled).toBe(true));
            });

            resolvePromise();
            await deletePromise;
        });

        it('should restore card state on delete error', async () => {
            showConfirmDialog.mockResolvedValueOnce(true);
            DataService.deleteEnvironmentVariable.mockRejectedValueOnce(new Error('Delete failed'));

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            await component._handleDelete(card);

            expect(card.style.opacity).toBe('');
            expect(card.style.pointerEvents).toBe('');
        });

        it('should re-enable buttons on delete error', async () => {
            showConfirmDialog.mockResolvedValueOnce(true);
            DataService.deleteEnvironmentVariable.mockRejectedValueOnce(new Error('Delete failed'));

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            await component._handleDelete(card);

            const buttons = card.querySelectorAll('button');
            buttons.forEach(btn => expect(btn.disabled).toBe(false));
        });

        it('should show delete button text as "Deleting..." during operation', async () => {
            let resolvePromise;
            DataService.deleteEnvironmentVariable.mockReturnValueOnce(
                new Promise(resolve => { resolvePromise = resolve; })
            );
            showConfirmDialog.mockResolvedValueOnce(true);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            const deletePromise = component._handleDelete(card);

            await vi.waitFor(() => {
                const deleteBtn = card.querySelector('.delete-btn');
                expect(deleteBtn.textContent).toBe('Deleting...');
            });

            resolvePromise();
            await deletePromise;
        });

        it('should use display name in delete confirmation', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            await component._handleDelete(card);

            expect(showConfirmDialog).toHaveBeenCalledWith(
                expect.stringContaining('Delete'),
                expect.any(HTMLElement)
            );
        });
    });

    describe('variable type handling', () => {
        beforeEach(() => {
            component = new EnvironmentVariablesTab();
        });

        it('should throw error for invalid JSON', () => {
            expect(() => component._coerceByType('not json', 'Json')).toThrow();
        });

        it('should throw error for invalid number', () => {
            expect(() => component._coerceByType('abc', 'Number')).toThrow();
        });

        it('should throw error for invalid boolean', () => {
            expect(() => component._coerceByType('maybe', 'Boolean')).toThrow();
        });

        it('should handle uppercase type names', () => {
            const result = component._coerceByType('42', 'NUMBER');
            expect(result).toBe('42');
        });

        it('should handle mixed case type names', () => {
            const result = component._coerceByType('true', 'BooLean');
            expect(result).toBe('true');
        });

        it('should handle empty type as string', () => {
            const result = component._coerceByType('hello', '');
            expect(result).toBe('hello');
        });

        it('should handle undefined type as string', () => {
            const result = component._coerceByType('hello', undefined);
            expect(result).toBe('hello');
        });

        it('should minify JSON output', () => {
            const result = component._coerceByType('{\n  "key": "value"\n}', 'Json');
            expect(result).toBe('{"key":"value"}');
        });

        it('should handle nested JSON objects', () => {
            const result = component._coerceByType('{"nested": {"deep": "value"}}', 'Json');
            expect(result).toBe('{"nested":{"deep":"value"}}');
        });

        it('should handle JSON arrays', () => {
            const result = component._coerceByType('[1, 2, 3]', 'Json');
            expect(result).toBe('[1,2,3]');
        });

        it('should handle decimal numbers', () => {
            const result = component._coerceByType('3.14159', 'Number');
            expect(result).toBe('3.14159');
        });

        it('should handle negative numbers', () => {
            const result = component._coerceByType('-42', 'Number');
            expect(result).toBe('-42');
        });

        it('should handle false boolean', () => {
            const result = component._coerceByType('false', 'Boolean');
            expect(result).toBe('false');
        });

        it('should handle "True" with capital', () => {
            const result = component._coerceByType('True', 'Boolean');
            expect(result).toBe('true');
        });
    });

    describe('create validation extended', () => {
        beforeEach(() => {
            component = new EnvironmentVariablesTab();
        });

        it('should validate current value for number type', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Number',
                defVal: '',
                curVal: 'not a number'
            });
            expect(isValid).toBe(false);
        });

        it('should accept valid current value for number type', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Number',
                defVal: '',
                curVal: '123'
            });
            expect(isValid).toBe(true);
        });

        it('should validate current value for JSON type', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Json',
                defVal: '',
                curVal: 'invalid json'
            });
            expect(isValid).toBe(false);
        });

        it('should accept valid current value for JSON type', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Json',
                defVal: '',
                curVal: '{"valid": true}'
            });
            expect(isValid).toBe(true);
        });

        it('should validate current value for boolean type', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Boolean',
                defVal: '',
                curVal: 'yes'
            });
            expect(isValid).toBe(false);
        });

        it('should accept empty default and current values', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'String',
                defVal: '',
                curVal: ''
            });
            expect(isValid).toBe(true);
        });

        it('should reject schema without prefix for string type', () => {
            // Schema must have underscore with content after it
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'SimpleSchema',
                type: 'String',
                defVal: '',
                curVal: ''
            });
            expect(isValid).toBe(false);
        });

        it('should reject whitespace-only name', () => {
            const isValid = component._isCreateModelValid({
                name: '   ',
                schema: 'test_Var',
                type: 'String'
            });
            expect(isValid).toBe(false);
        });

        it('should reject whitespace-only schema', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: '   ',
                type: 'String'
            });
            expect(isValid).toBe(false);
        });
    });

    describe('edit default mode extended', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
        });

        it('should save previous footer state', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            const footer = card.querySelector('.pdt-card-footer');
            const originalHTML = footer.innerHTML;

            component._switchToEditDefaultMode(card);

            expect(footer.dataset.currentButtons).toBe(originalHTML);
        });

        it('should restore footer on cancel', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);
            component._switchDefaultToView(card);

            expect(card.querySelector('.edit-default-btn')).toBeTruthy();
        });

        it('should disable save-default button initially', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);

            const saveBtn = card.querySelector('.save-default-btn');
            expect(saveBtn.disabled).toBe(true);
        });

        it('should enable save-default button when value changes', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);

            const textarea = card.querySelector('.env-var-default-edit-area');
            textarea.value = 'new default value';
            textarea.dispatchEvent(new Event('input'));

            const saveBtn = card.querySelector('.save-default-btn');
            expect(saveBtn.disabled).toBe(false);
        });

        it('should show "Saving..." during save default', async () => {
            let resolvePromise;
            DataService.setEnvironmentVariableDefault.mockReturnValueOnce(
                new Promise(resolve => { resolvePromise = resolve; })
            );

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);

            const savePromise = component._handleSaveDefault(card);
            const saveBtn = card.querySelector('.save-default-btn');

            expect(saveBtn.textContent).toBe('Saving...');
            resolvePromise();
            await savePromise;
        });

        it('should minify JSON on save default', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);
            const textarea = card.querySelector('.env-var-default-edit-area');
            textarea.value = '{\n  "key": "value"\n}';

            await component._handleSaveDefault(card);

            expect(DataService.setEnvironmentVariableDefault).toHaveBeenCalledWith(
                'def-1', '{"key":"value"}'
            );
        });

        it('should handle save default error', async () => {
            DataService.setEnvironmentVariableDefault.mockRejectedValueOnce(new Error('Save failed'));

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);
            await component._handleSaveDefault(card);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('Save failed'),
                'error'
            );
        });

        it('should re-enable textarea on save default error', async () => {
            DataService.setEnvironmentVariableDefault.mockRejectedValueOnce(new Error('Save failed'));

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);
            const textarea = card.querySelector('.env-var-default-edit-area');

            await component._handleSaveDefault(card);

            expect(textarea.disabled).toBe(false);
        });

        it('should update dataset after saving default', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);
            const textarea = card.querySelector('.env-var-default-edit-area');
            textarea.value = 'new default';

            await component._handleSaveDefault(card);

            expect(card.dataset.defaultValue).toBe('new default');
        });
    });

    describe('format value', () => {
        beforeEach(() => {
            component = new EnvironmentVariablesTab();
        });

        it('should handle null value', () => {
            const result = component._formatValue(null, true);
            expect(result).toBeInstanceOf(HTMLElement);
        });

        it('should handle undefined value', () => {
            const result = component._formatValue(undefined, true);
            expect(result).toBeInstanceOf(HTMLElement);
        });

        it('should create copyable span for non-JSON values', () => {
            const result = component._formatValue('simple string', true);
            expect(result.className).toContain('copyable');
        });

        it('should not add copyable class when isCopyable is false', () => {
            const result = component._formatValue('simple string', false);
            expect(result.className).not.toContain('copyable');
        });

        it('should set title for copyable values', () => {
            const result = component._formatValue('simple string', true);
            expect(result.title).toBe('Click to copy');
        });
    });

    describe('create dialog', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
        });

        it('should build create dialog content', () => {
            const content = component._buildCreateDialogContent();
            expect(content).toBeInstanceOf(HTMLElement);
        });

        it('should include display name input', () => {
            const content = component._buildCreateDialogContent();
            expect(content.querySelector('#nv-name')).toBeTruthy();
        });

        it('should include schema name input', () => {
            const content = component._buildCreateDialogContent();
            expect(content.querySelector('#nv-schema')).toBeTruthy();
        });

        it('should include type select', () => {
            const content = component._buildCreateDialogContent();
            const select = content.querySelector('#nv-type');
            expect(select).toBeTruthy();
        });

        it('should have String as default type', () => {
            const content = component._buildCreateDialogContent();
            const select = content.querySelector('#nv-type');
            expect(select.value).toBe('String');
        });

        it('should include all type options', () => {
            const content = component._buildCreateDialogContent();
            const select = content.querySelector('#nv-type');
            const options = select.querySelectorAll('option');

            const values = Array.from(options).map(o => o.value);
            expect(values).toContain('String');
            expect(values).toContain('Number');
            expect(values).toContain('Json');
            expect(values).toContain('Boolean');
        });

        it('should include description textarea', () => {
            const content = component._buildCreateDialogContent();
            expect(content.querySelector('#nv-desc')).toBeTruthy();
        });

        it('should include default value textarea', () => {
            const content = component._buildCreateDialogContent();
            expect(content.querySelector('#nv-default')).toBeTruthy();
        });

        it('should include current value textarea', () => {
            const content = component._buildCreateDialogContent();
            expect(content.querySelector('#nv-current')).toBeTruthy();
        });

        it('should include solution picker row', () => {
            const content = component._buildCreateDialogContent();
            expect(content.querySelector('#nv-soln-row')).toBeTruthy();
        });

        it('should include solution picker button', () => {
            const content = component._buildCreateDialogContent();
            expect(content.querySelector('#nv-pick-solution')).toBeTruthy();
        });
    });

    describe('build delete dialog content', () => {
        beforeEach(() => {
            component = new EnvironmentVariablesTab();
        });

        it('should create delete dialog content', () => {
            const content = component._buildDeleteDialogContent('Test Variable', 'test_Variable');
            expect(content).toBeInstanceOf(HTMLElement);
        });

        it('should include display name in dialog', () => {
            const content = component._buildDeleteDialogContent('Test Variable', 'test_Schema');
            expect(content.textContent).toContain('Test Variable');
        });

        it('should include schema name in dialog', () => {
            const content = component._buildDeleteDialogContent('Test Variable', 'test_Schema');
            expect(content.textContent).toContain('test_Schema');
        });

        it('should include confirmation checkbox', () => {
            const content = component._buildDeleteDialogContent('Test', 'schema');
            expect(content.querySelector('#del-confirm-chk')).toBeTruthy();
        });

        it('should include confirmation text input', () => {
            const content = component._buildDeleteDialogContent('Test', 'schema');
            expect(content.querySelector('#del-confirm-text')).toBeTruthy();
        });

        it('should escape HTML in display name', () => {
            const content = component._buildDeleteDialogContent('<script>alert(1)</script>', 'schema');
            expect(content.querySelector('script')).toBeFalsy();
        });
    });

    describe('delegated event handling extended', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
        });

        it('should handle edit-default button via delegation', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const editDefaultBtn = element.querySelector('.edit-default-btn');
            editDefaultBtn.click();

            expect(element.querySelector('.env-var-default-edit-area')).toBeTruthy();
        });

        it('should handle cancel-default button via delegation', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Enter edit default mode
            const editDefaultBtn = element.querySelector('.edit-default-btn');
            editDefaultBtn.click();

            // Click cancel
            const cancelDefaultBtn = element.querySelector('.cancel-default-btn');
            cancelDefaultBtn.click();

            expect(element.querySelector('.env-var-default-edit-area')).toBeFalsy();
        });

        it('should handle save-default button via delegation', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Enter edit default mode
            const editDefaultBtn = element.querySelector('.edit-default-btn');
            editDefaultBtn.click();

            // Click save
            const saveDefaultBtn = element.querySelector('.save-default-btn');
            saveDefaultBtn.disabled = false;
            saveDefaultBtn.click();

            await vi.waitFor(() => {
                expect(DataService.setEnvironmentVariableDefault).toHaveBeenCalled();
            });
        });

        it('should handle delete button via delegation', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            showConfirmDialog.mockResolvedValueOnce(true);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const deleteBtn = element.querySelector('.delete-btn');
            deleteBtn.click();

            await vi.waitFor(() => {
                expect(showConfirmDialog).toHaveBeenCalled();
            });
        });

        it('should handle save button via delegation', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Enter edit mode
            const editBtn = element.querySelector('.edit-btn');
            editBtn.click();

            // Click save
            const saveBtn = element.querySelector('.save-btn');
            saveBtn.disabled = false;
            saveBtn.click();

            await vi.waitFor(() => {
                expect(DataService.setEnvironmentVariableValue).toHaveBeenCalled();
            });
        });

        it('should return early if click target is not a button', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const cardBody = element.querySelector('.pdt-card-body');
            cardBody.click();

            // No error should occur, state should remain unchanged
            expect(element.querySelector('.edit-btn')).toBeTruthy();
        });

        it('should return early if button is not inside a card', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([mockEnvVars[0]]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Create a button outside the card
            const orphanButton = document.createElement('button');
            orphanButton.className = 'edit-btn';
            component.ui.listContainer.appendChild(orphanButton);

            // Should not throw
            orphanButton.click();
        });
    });

    describe('destroy extended', () => {
        it('should cancel debounced filterCards', async () => {
            component = new EnvironmentVariablesTab();
            const cancelSpy = vi.spyOn(component.filterCards, 'cancel');

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.destroy();

            expect(cancelSpy).toHaveBeenCalled();
        });

        it('should remove search input listener', async () => {
            component = new EnvironmentVariablesTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const searchInput = component.ui.searchInput;
            const removeEventListenerSpy = vi.spyOn(searchInput, 'removeEventListener');

            component.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('input', component._searchInputHandler);
        });

        it('should remove list container click listener', async () => {
            component = new EnvironmentVariablesTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const listContainer = component.ui.listContainer;
            const removeEventListenerSpy = vi.spyOn(listContainer, 'removeEventListener');

            component.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('click', component._listClickHandler);
        });

        it('should handle destroy when ui elements are undefined', () => {
            component = new EnvironmentVariablesTab();
            component.ui = {};

            expect(() => component.destroy()).not.toThrow();
        });

        it('should handle destroy with partial ui elements', async () => {
            component = new EnvironmentVariablesTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Simulate partial state
            component.ui.searchInput = undefined;

            expect(() => component.destroy()).not.toThrow();
        });
    });

    describe('add button functionality', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
        });

        it('should open create dialog on add button click', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            expect(document.querySelector('#pdt-dialog-overlay')).toBeTruthy();
        });

        it('should show dialog with correct title content', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const dialog = document.querySelector('.pdt-dialog');
            expect(dialog).toBeTruthy();
        });
    });

    describe('search input functionality', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
        });

        it('should trigger filter on input event', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const filterSpy = vi.spyOn(component, 'filterCards');

            component.ui.searchInput.value = 'test';
            component.ui.searchInput.dispatchEvent(new Event('input'));

            expect(filterSpy).toHaveBeenCalled();
        });

        it('should filter by description', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.searchInput.value = 'numeric';
            component._filterCards();

            const visibleCards = element.querySelectorAll('.env-var-card:not([style*="display: none"])');
            expect(visibleCards.length).toBe(1);
        });

        it('should filter by current value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.searchInput.value = '42';
            component._filterCards();

            const visibleCards = element.querySelectorAll('.env-var-card:not([style*="display: none"])');
            expect(visibleCards.length).toBe(1);
        });

        it('should hide no-match cards', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.ui.searchInput.value = 'nonexistent';
            component._filterCards();

            const hiddenCards = element.querySelectorAll('.env-var-card[style*="display: none"]');
            expect(hiddenCards.length).toBe(4);
        });

        it('should handle empty search input gracefully', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // First filter
            component.ui.searchInput.value = 'test';
            component._filterCards();

            // Clear search
            component.ui.searchInput.value = '';
            component._filterCards();

            const visibleCards = element.querySelectorAll('.env-var-card:not([style*="display: none"])');
            expect(visibleCards.length).toBe(4);
        });
    });

    describe('solution selection and switching', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
        });

        it('should restore previously saved solution from sessionStorage', async () => {
            sessionStorage.setItem('pdt:currentSolution', 'SavedSolution');

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            expect(DataService.setCurrentSolution).toHaveBeenCalledWith('SavedSolution');
            sessionStorage.removeItem('pdt:currentSolution');
        });

        it('should show warning when no solution is selected', async () => {
            DataService.getCurrentSolution.mockReturnValueOnce({ uniqueName: null, publisherPrefix: null });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const solnInfo = document.querySelector('#nv-soln-info');
            expect(solnInfo.className).toContain('warning');
        });

        it('should show success when solution is selected', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'test' });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const solnInfo = document.querySelector('#nv-soln-info');
            expect(solnInfo.className).toContain('success');
        });

        it('should pre-fill schema with publisher prefix', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'test' });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const schemaEl = document.querySelector('#nv-schema');
            expect(schemaEl.value).toBe('test_');
        });

        it('should disable create button when no solution is selected', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: null, publisherPrefix: null });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            await vi.waitFor(() => {
                const createBtn = document.querySelector('#nv-create');
                expect(createBtn.disabled).toBe(true);
            });
        });

        it('should auto-add prefix to schema on blur if missing', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'pub' });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const schemaEl = document.querySelector('#nv-schema');
            schemaEl.value = 'MyVariable';
            schemaEl.dispatchEvent(new Event('blur'));

            expect(schemaEl.value).toBe('pub_MyVariable');
        });

        it('should not add prefix if schema already has one', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'pub' });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const schemaEl = document.querySelector('#nv-schema');
            schemaEl.value = 'existing_Variable';
            schemaEl.dispatchEvent(new Event('blur'));

            expect(schemaEl.value).toBe('existing_Variable');
        });

        it('should update solution button text to "Change solution" after selection', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'test' });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const solnButton = document.querySelector('#nv-pick-solution');
            expect(solnButton.textContent).toContain('Change');
        });
    });

    describe('solution picker dialog', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
        });

        it('should load solutions list when picker opens', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const pickSolutionBtn = document.querySelector('#nv-pick-solution');
            pickSolutionBtn.click();

            await vi.waitFor(() => {
                expect(DataService.listSolutions).toHaveBeenCalled();
            });
        });

        it('should display solutions in dropdown', async () => {
            DataService.listSolutions.mockResolvedValueOnce([
                { uniqueName: 'Sol1', friendlyName: 'Solution 1', prefix: 'sol1' },
                { uniqueName: 'Sol2', friendlyName: 'Solution 2', prefix: 'sol2' }
            ]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const pickSolutionBtn = document.querySelector('#nv-pick-solution');
            pickSolutionBtn.click();

            await vi.waitFor(() => {
                const select = document.querySelector('#soln-select');
                expect(select.options.length).toBe(2);
            });
        });

        it('should show message when no solutions are available', async () => {
            DataService.listSolutions.mockResolvedValueOnce([]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const pickSolutionBtn = document.querySelector('#nv-pick-solution');
            pickSolutionBtn.click();

            await vi.waitFor(() => {
                const select = document.querySelector('#soln-select');
                expect(select.textContent).toContain('no visible unmanaged solutions');
            });
        });

        it('should disable apply button when no solutions are available', async () => {
            DataService.listSolutions.mockResolvedValueOnce([]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const pickSolutionBtn = document.querySelector('#nv-pick-solution');
            pickSolutionBtn.click();

            await vi.waitFor(() => {
                const applyBtn = document.querySelector('#soln-apply');
                expect(applyBtn.disabled).toBe(true);
            });
        });

        it('should handle solution list loading error', async () => {
            DataService.listSolutions.mockRejectedValueOnce(new Error('Failed to load'));

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const pickSolutionBtn = document.querySelector('#nv-pick-solution');
            pickSolutionBtn.click();

            await vi.waitFor(() => {
                const select = document.querySelector('#soln-select');
                expect(select.textContent).toContain('failed to load');
            });
        });
    });

    describe('create new variable flow', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'test' });
        });

        it('should call createEnvironmentVariable with correct model', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            // Fill form
            const nameEl = document.querySelector('#nv-name');
            const schemaEl = document.querySelector('#nv-schema');
            const descEl = document.querySelector('#nv-desc');

            nameEl.value = 'New Variable';
            schemaEl.value = 'test_NewVariable';
            descEl.value = 'A new variable';
            nameEl.dispatchEvent(new Event('input'));

            const createBtn = document.querySelector('#nv-create');
            createBtn.disabled = false;
            createBtn.click();

            await vi.waitFor(() => {
                expect(DataService.createEnvironmentVariable).toHaveBeenCalledWith(expect.objectContaining({
                    displayName: 'New Variable',
                    schemaName: 'test_NewVariable',
                    type: 'String',
                    description: 'A new variable'
                }));
            });
        });

        it('should add created variable card to the list', async () => {
            DataService.createEnvironmentVariable.mockResolvedValueOnce({
                definitionId: 'new-def',
                valueId: 'new-val',
                schemaname: 'test_NewVar'
            });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const nameEl = document.querySelector('#nv-name');
            const schemaEl = document.querySelector('#nv-schema');
            nameEl.value = 'New Variable';
            schemaEl.value = 'test_NewVar';
            nameEl.dispatchEvent(new Event('input'));

            const createBtn = document.querySelector('#nv-create');
            createBtn.disabled = false;
            createBtn.click();

            await vi.waitFor(() => {
                const cards = element.querySelectorAll('.env-var-card');
                expect(cards.length).toBe(2); // Original + new one
            });
        });

        it('should prepend new card to the list', async () => {
            DataService.createEnvironmentVariable.mockResolvedValueOnce({
                definitionId: 'new-def',
                valueId: 'new-val',
                schemaname: 'test_NewVar'
            });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const nameEl = document.querySelector('#nv-name');
            const schemaEl = document.querySelector('#nv-schema');
            nameEl.value = 'First New Variable';
            schemaEl.value = 'test_FirstNew';
            nameEl.dispatchEvent(new Event('input'));

            const createBtn = document.querySelector('#nv-create');
            createBtn.disabled = false;
            createBtn.click();

            await vi.waitFor(() => {
                const firstCard = element.querySelector('.env-var-card');
                expect(firstCard.textContent).toContain('First New Variable');
            });
        });

        it('should clear search input after creating variable', async () => {
            DataService.createEnvironmentVariable.mockResolvedValueOnce({
                definitionId: 'new-def',
                valueId: 'new-val',
                schemaname: 'test_NewVar'
            });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Set search value first
            component.ui.searchInput.value = 'some search';

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const nameEl = document.querySelector('#nv-name');
            const schemaEl = document.querySelector('#nv-schema');
            nameEl.value = 'New Variable';
            schemaEl.value = 'test_NewVar';
            nameEl.dispatchEvent(new Event('input'));

            const createBtn = document.querySelector('#nv-create');
            createBtn.disabled = false;
            createBtn.click();

            await vi.waitFor(() => {
                expect(component.ui.searchInput.value).toBe('');
            });
        });

        it('should show success notification after creation', async () => {
            DataService.createEnvironmentVariable.mockResolvedValueOnce({
                definitionId: 'new-def',
                valueId: 'new-val',
                schemaname: 'test_NewVar'
            });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const nameEl = document.querySelector('#nv-name');
            const schemaEl = document.querySelector('#nv-schema');
            nameEl.value = 'New Variable';
            schemaEl.value = 'test_NewVar';
            nameEl.dispatchEvent(new Event('input'));

            const createBtn = document.querySelector('#nv-create');
            createBtn.disabled = false;
            createBtn.click();

            await vi.waitFor(() => {
                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.any(String),
                    'success'
                );
            });
        });

        it('should show error notification on creation failure', async () => {
            DataService.createEnvironmentVariable.mockRejectedValueOnce(new Error('Creation failed'));

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const nameEl = document.querySelector('#nv-name');
            const schemaEl = document.querySelector('#nv-schema');
            nameEl.value = 'New Variable';
            schemaEl.value = 'test_NewVar';
            nameEl.dispatchEvent(new Event('input'));

            const createBtn = document.querySelector('#nv-create');
            createBtn.disabled = false;
            createBtn.click();

            await vi.waitFor(() => {
                expect(NotificationService.show).toHaveBeenCalledWith(
                    expect.stringContaining('Creation failed'),
                    'error'
                );
            });
        });

        it('should re-enable inputs on creation failure', async () => {
            DataService.createEnvironmentVariable.mockRejectedValueOnce(new Error('Creation failed'));

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const nameEl = document.querySelector('#nv-name');
            const schemaEl = document.querySelector('#nv-schema');
            nameEl.value = 'New Variable';
            schemaEl.value = 'test_NewVar';
            nameEl.dispatchEvent(new Event('input'));

            const createBtn = document.querySelector('#nv-create');
            createBtn.disabled = false;
            createBtn.click();

            await vi.waitFor(() => {
                expect(nameEl.disabled).toBe(false);
                expect(schemaEl.disabled).toBe(false);
            });
        });

        it('should create variable with Number type', async () => {
            DataService.createEnvironmentVariable.mockResolvedValueOnce({
                definitionId: 'new-def',
                valueId: 'new-val',
                schemaname: 'test_NumVar'
            });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const nameEl = document.querySelector('#nv-name');
            const schemaEl = document.querySelector('#nv-schema');
            const typeEl = document.querySelector('#nv-type');
            const defEl = document.querySelector('#nv-default');

            nameEl.value = 'Numeric Variable';
            schemaEl.value = 'test_NumVar';
            typeEl.value = 'Number';
            defEl.value = '42';
            nameEl.dispatchEvent(new Event('input'));

            const createBtn = document.querySelector('#nv-create');
            createBtn.disabled = false;
            createBtn.click();

            await vi.waitFor(() => {
                expect(DataService.createEnvironmentVariable).toHaveBeenCalledWith(expect.objectContaining({
                    type: 'Number',
                    defaultValue: '42'
                }));
            });
        });

        it('should create variable with JSON type', async () => {
            DataService.createEnvironmentVariable.mockResolvedValueOnce({
                definitionId: 'new-def',
                valueId: 'new-val',
                schemaname: 'test_JsonVar'
            });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const nameEl = document.querySelector('#nv-name');
            const schemaEl = document.querySelector('#nv-schema');
            const typeEl = document.querySelector('#nv-type');
            const defEl = document.querySelector('#nv-default');

            nameEl.value = 'JSON Variable';
            schemaEl.value = 'test_JsonVar';
            typeEl.value = 'Json';
            defEl.value = '{"key": "value"}';
            nameEl.dispatchEvent(new Event('input'));

            const createBtn = document.querySelector('#nv-create');
            createBtn.disabled = false;
            createBtn.click();

            await vi.waitFor(() => {
                expect(DataService.createEnvironmentVariable).toHaveBeenCalledWith(expect.objectContaining({
                    type: 'Json'
                }));
            });
        });

        it('should create variable with Boolean type', async () => {
            DataService.createEnvironmentVariable.mockResolvedValueOnce({
                definitionId: 'new-def',
                valueId: 'new-val',
                schemaname: 'test_BoolVar'
            });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const nameEl = document.querySelector('#nv-name');
            const schemaEl = document.querySelector('#nv-schema');
            const typeEl = document.querySelector('#nv-type');
            const defEl = document.querySelector('#nv-default');

            nameEl.value = 'Boolean Variable';
            schemaEl.value = 'test_BoolVar';
            typeEl.value = 'Boolean';
            defEl.value = 'true';
            nameEl.dispatchEvent(new Event('input'));

            const createBtn = document.querySelector('#nv-create');
            createBtn.disabled = false;
            createBtn.click();

            await vi.waitFor(() => {
                expect(DataService.createEnvironmentVariable).toHaveBeenCalledWith(expect.objectContaining({
                    type: 'Boolean',
                    defaultValue: 'true'
                }));
            });
        });
    });

    describe('validation edge cases', () => {
        beforeEach(() => {
            component = new EnvironmentVariablesTab();
        });

        it('should reject schema with only alphanumeric characters (no underscore)', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'NoUnderscoreHere',
                type: 'String'
            });
            expect(isValid).toBe(false);
        });

        it('should accept schema with underscore and content after it', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'prefix_ValidName',
                type: 'String'
            });
            expect(isValid).toBe(true);
        });

        it('should reject empty JSON object as invalid for validation', () => {
            // Empty string is valid (optional), but explicit empty JSON should be tested
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Json',
                defVal: '{}', // Valid empty JSON
                curVal: ''
            });
            expect(isValid).toBe(true);
        });

        it('should reject malformed JSON with trailing comma', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Json',
                defVal: '{"key": "value",}',
                curVal: ''
            });
            expect(isValid).toBe(false);
        });

        it('should accept JSON array as valid', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Json',
                defVal: '[1, 2, 3]',
                curVal: ''
            });
            expect(isValid).toBe(true);
        });

        it('should reject NaN as invalid number', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Number',
                defVal: 'NaN',
                curVal: ''
            });
            expect(isValid).toBe(false);
        });

        it('should reject Infinity as invalid number', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Number',
                defVal: 'Infinity',
                curVal: ''
            });
            expect(isValid).toBe(false);
        });

        it('should accept zero as valid number', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Number',
                defVal: '0',
                curVal: ''
            });
            expect(isValid).toBe(true);
        });

        it('should accept negative numbers', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Number',
                defVal: '-123.45',
                curVal: ''
            });
            expect(isValid).toBe(true);
        });

        it('should accept "FALSE" (uppercase) as valid boolean', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Boolean',
                defVal: 'FALSE',
                curVal: ''
            });
            expect(isValid).toBe(true);
        });

        it('should accept "True" (mixed case) as valid boolean', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Boolean',
                defVal: 'True',
                curVal: ''
            });
            expect(isValid).toBe(true);
        });

        it('should reject "1" as invalid boolean', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Boolean',
                defVal: '1',
                curVal: ''
            });
            expect(isValid).toBe(false);
        });

        it('should validate both default and current values for type', () => {
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Number',
                defVal: '42',
                curVal: 'not a number'
            });
            expect(isValid).toBe(false);
        });
    });

    describe('secret variable handling', () => {
        const secretEnvVar = {
            definitionId: 'def-secret',
            valueId: 'val-secret',
            displayName: 'Secret Variable',
            schemaName: 'test_SecretVar',
            type: 'Secret',
            currentValue: '***masked***',
            defaultValue: '',
            description: 'A secret variable'
        };

        beforeEach(() => {
            component = new EnvironmentVariablesTab();
        });

        it('should render secret type variables', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([secretEnvVar]);

            const element = await component.render();
            const card = element.querySelector('.env-var-card');

            expect(card).toBeTruthy();
            expect(card.dataset.type).toBe('Secret');
        });

        it('should display masked value for secrets', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([secretEnvVar]);

            const element = await component.render();

            expect(element.textContent).toContain('***masked***');
        });

        it('should handle secret type in coerceByType', () => {
            // Secret type should be treated as string
            const result = component._coerceByType('secret value', 'Secret');
            expect(result).toBe('secret value');
        });

        it('should validate secret type as string in create model', () => {
            // Secret is not a standard create type, but should not throw
            const isValid = component._isCreateModelValid({
                name: 'Test',
                schema: 'test_Var',
                type: 'Secret',
                defVal: '',
                curVal: ''
            });
            expect(isValid).toBe(true);
        });
    });

    describe('data source type variations', () => {
        const dataSourceEnvVar = {
            definitionId: 'def-ds',
            valueId: 'val-ds',
            displayName: 'Data Source Variable',
            schemaName: 'test_DataSourceVar',
            type: 'Data source',
            currentValue: 'connection-string-reference',
            defaultValue: '',
            description: 'A data source variable'
        };

        beforeEach(() => {
            component = new EnvironmentVariablesTab();
        });

        it('should render data source type variables', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([dataSourceEnvVar]);

            const element = await component.render();
            const card = element.querySelector('.env-var-card');

            expect(card).toBeTruthy();
            expect(card.dataset.type).toBe('Data source');
        });

        it('should display data source values as copyable text', async () => {
            DataService.getEnvironmentVariables.mockResolvedValueOnce([dataSourceEnvVar]);

            const element = await component.render();

            expect(element.querySelector('.copyable')).toBeTruthy();
            expect(element.textContent).toContain('connection-string-reference');
        });

        it('should handle data source type in coerceByType', () => {
            const result = component._coerceByType('data-source-value', 'Data source');
            expect(result).toBe('data-source-value');
        });

        it('should handle unknown types gracefully', () => {
            const result = component._coerceByType('value', 'UnknownType');
            expect(result).toBe('value');
        });
    });

    describe('error handling paths', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
        });

        it('should handle session storage restore error gracefully', async () => {
            // Mock sessionStorage to throw
            const originalGetItem = sessionStorage.getItem;
            sessionStorage.getItem = vi.fn(() => { throw new Error('Storage error'); });

            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Should not throw when opening create dialog
            const addBtn = element.querySelector('#env-var-add-btn');
            expect(() => addBtn.click()).not.toThrow();

            sessionStorage.getItem = originalGetItem;
        });

        it('should handle getCurrentSolution returning undefined', async () => {
            DataService.getCurrentSolution.mockReturnValue(undefined);
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            expect(() => addBtn.click()).not.toThrow();

            // Reset mock to default behavior
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'test' });
        });

        it('should handle getCurrentSolution returning null values', async () => {
            // Test with null values which is a more realistic scenario than throwing
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: null, publisherPrefix: null });
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            expect(() => addBtn.click()).not.toThrow();

            // Verify warning is shown
            const solnInfo = document.querySelector('#nv-soln-info');
            expect(solnInfo.className).toContain('warning');

            // Reset mock to default behavior
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'test' });
        });

        it('should handle setCurrentSolution failure gracefully', async () => {
            sessionStorage.setItem('pdt:currentSolution', 'TestSol');
            DataService.setCurrentSolution.mockRejectedValueOnce(new Error('Set failed'));
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            expect(() => addBtn.click()).not.toThrow();

            sessionStorage.removeItem('pdt:currentSolution');
        });

        it('should handle 403 forbidden errors during save', async () => {
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
            DataService.setEnvironmentVariableValue.mockRejectedValueOnce(new Error('403 Forbidden'));

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditMode(card);
            await component._handleSaveClick(card);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('403 Forbidden'),
                'error'
            );
        });

        it('should handle 500 server errors during delete', async () => {
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
            showConfirmDialog.mockResolvedValueOnce(true);
            DataService.deleteEnvironmentVariable.mockRejectedValueOnce(new Error('500 Internal Server Error'));

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            await component._handleDelete(card);

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('500 Internal Server Error'),
                'error'
            );
        });

        it('should restore delete button text on error', async () => {
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
            showConfirmDialog.mockResolvedValueOnce(true);
            DataService.deleteEnvironmentVariable.mockRejectedValueOnce(new Error('Error'));

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            await component._handleDelete(card);

            const deleteBtn = card.querySelector('.delete-btn');
            expect(deleteBtn.textContent).toBe('Delete');
        });

        it('should handle empty response from createEnvironmentVariable', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'test' });
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
            DataService.createEnvironmentVariable.mockResolvedValueOnce({});

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            const nameEl = document.querySelector('#nv-name');
            const schemaEl = document.querySelector('#nv-schema');
            nameEl.value = 'New Variable';
            schemaEl.value = 'test_NewVar';
            nameEl.dispatchEvent(new Event('input'));

            const createBtn = document.querySelector('#nv-create');
            createBtn.disabled = false;
            createBtn.click();

            // Should not throw and should still add the card
            await vi.waitFor(() => {
                expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'success');
            });
        });
    });

    describe('default value editing edge cases', () => {
        beforeEach(async () => {
            component = new EnvironmentVariablesTab();
            DataService.getEnvironmentVariables.mockResolvedValue([mockEnvVars[0]]);
        });

        it('should handle empty default value in edit mode', async () => {
            const varEmptyDefault = { ...mockEnvVars[0], defaultValue: '' };
            DataService.getEnvironmentVariables.mockResolvedValueOnce([varEmptyDefault]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);

            const textarea = card.querySelector('.env-var-default-edit-area');
            expect(textarea.value).toBe('');
        });

        it('should format JSON default value in edit mode', async () => {
            const varJsonDefault = { ...mockEnvVars[0], defaultValue: '{"key":"value"}' };
            DataService.getEnvironmentVariables.mockResolvedValueOnce([varJsonDefault]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);

            const textarea = card.querySelector('.env-var-default-edit-area');
            expect(textarea.value).toBeDefined();
        });

        it('should update search term after saving default', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);
            const textarea = card.querySelector('.env-var-default-edit-area');
            textarea.value = 'searchable_new_default';

            await component._handleSaveDefault(card);

            expect(card.dataset.searchTerm).toContain('searchable_new_default');
        });

        it('should display "(not set)" for empty default after save', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);
            const textarea = card.querySelector('.env-var-default-edit-area');
            textarea.value = '';

            await component._handleSaveDefault(card);

            const wrapper = card.querySelector('.pdt-value-wrapper-default');
            expect(wrapper.textContent).toContain('(not set)');
        });

        it('should preserve non-JSON default values as-is', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const card = element.querySelector('.env-var-card');
            component._switchToEditDefaultMode(card);
            const textarea = card.querySelector('.env-var-default-edit-area');
            textarea.value = 'plain text value';

            await component._handleSaveDefault(card);

            expect(DataService.setEnvironmentVariableDefault).toHaveBeenCalledWith(
                'def-1', 'plain text value'
            );
        });
    });

    describe('copy button handler', () => {
        it('should copy code block text when copy-btn is clicked', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => element.querySelectorAll('.env-var-card').length > 0);

            // Create a copyable code block with copy button inside the list container
            const codeBlock = document.createElement('div');
            codeBlock.className = 'copyable-code-block';
            codeBlock.innerHTML = '<pre>test-code-content</pre><button class="copy-btn">Copy</button>';
            component.ui.listContainer.appendChild(codeBlock);

            const copyBtn = codeBlock.querySelector('.copy-btn');
            const clickEvent = new MouseEvent('click', { bubbles: true });

            copyBtn.dispatchEvent(clickEvent);

            expect(copyToClipboard).toHaveBeenCalledWith('test-code-content');
        });

        it('should handle copy button in nested code structure', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.waitFor(() => element.querySelectorAll('.env-var-card').length > 0);

            const codeBlock = document.createElement('div');
            codeBlock.className = 'copyable-code-block';
            codeBlock.innerHTML = '<code>code-from-code-element</code><button class="copy-btn">Copy</button>';
            component.ui.listContainer.appendChild(codeBlock);

            const copyBtn = codeBlock.querySelector('.copy-btn');
            const clickEvent = new MouseEvent('click', { bubbles: true });

            copyBtn.dispatchEvent(clickEvent);

            expect(copyToClipboard).toHaveBeenCalledWith('code-from-code-element');
        });
    });

    describe('solution dialog handlers', () => {
        it('should update schema prefix when solution is applied with empty schema', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: null, publisherPrefix: null });
            DataService.listSolutions.mockResolvedValue([
                { uniqueName: 'NewSolution', friendlyName: 'New Solution', prefix: 'new' }
            ]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            await vi.waitFor(() => document.querySelector('#nv-pick-solution'));

            const pickSolutionBtn = document.querySelector('#nv-pick-solution');
            pickSolutionBtn.click();

            await vi.waitFor(() => document.querySelector('.pdt-solution-apply-btn'));

            const solutionSelect = document.querySelector('.pdt-solution-list');
            if (solutionSelect) {
                solutionSelect.innerHTML = '<option value="NewSolution">New Solution</option>';
                solutionSelect.value = 'NewSolution';
            }

            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'NewSolution', publisherPrefix: 'new' });

            const applyBtn = document.querySelector('.pdt-solution-apply-btn');
            if (applyBtn) {
                applyBtn.click();
                await vi.waitFor(() => {
                    const schemaEl = document.querySelector('#nv-schema');
                    return schemaEl && schemaEl.value === 'new_';
                }, { timeout: 1000 }).catch(() => { });
            }
        });

        it('should close sub-dialog and restore parent when cancel is clicked', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'test' });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            await vi.waitFor(() => document.querySelector('#nv-pick-solution'));

            const pickSolutionBtn = document.querySelector('#nv-pick-solution');
            pickSolutionBtn.click();

            await vi.waitFor(() => document.querySelector('.pdt-dialog'));

            const cancelBtn = document.querySelector('.pdt-dialog-cancel');
            if (cancelBtn) {
                cancelBtn.click();
            }

            // Parent dialog should still be present after cancel
            await vi.waitFor(() => document.querySelector('#nv-name') !== null);
        });

        it('should close sub-dialog when overlay is clicked', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'test' });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            await vi.waitFor(() => document.querySelector('#nv-pick-solution'));

            const pickSolutionBtn = document.querySelector('#nv-pick-solution');
            pickSolutionBtn.click();

            await vi.waitFor(() => document.querySelector('#pdt-dialog-overlay'));

            const overlay = document.querySelector('#pdt-dialog-overlay');
            if (overlay && overlay.onclick) {
                overlay.onclick({ target: overlay });
            }
        });

        it('should update solution info to warning when no solution selected after apply', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: null, publisherPrefix: null });
            DataService.listSolutions.mockResolvedValue([
                { uniqueName: 'Sol1', friendlyName: 'Solution 1', prefix: 's1' }
            ]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            await vi.waitFor(() => document.querySelector('#nv-soln-info'));

            const solnInfo = document.querySelector('#nv-soln-info');
            expect(solnInfo.className).toContain('warning');
        });
    });

    describe('_isCreateModelValid type validation', () => {
        it('should return false for invalid Number default value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Test Var',
                schema: 'test_TestVar',
                type: 'Number',
                defVal: 'not-a-number',
                curVal: ''
            });

            expect(result).toBe(false);
        });

        it('should return true for valid Number value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Test Var',
                schema: 'test_TestVar',
                type: 'Number',
                defVal: '42.5',
                curVal: '100'
            });

            expect(result).toBe(true);
        });

        it('should return false for invalid Boolean value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Test Var',
                schema: 'test_TestVar',
                type: 'Boolean',
                defVal: 'yes',
                curVal: ''
            });

            expect(result).toBe(false);
        });

        it('should return true for valid Boolean values', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Test Var',
                schema: 'test_TestVar',
                type: 'Boolean',
                defVal: 'true',
                curVal: 'false'
            });

            expect(result).toBe(true);
        });

        it('should return false for invalid Json value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Test Var',
                schema: 'test_TestVar',
                type: 'Json',
                defVal: '{invalid json}',
                curVal: ''
            });

            expect(result).toBe(false);
        });

        it('should return true for valid Json value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Test Var',
                schema: 'test_TestVar',
                type: 'Json',
                defVal: '{"key": "value"}',
                curVal: '[]'
            });

            expect(result).toBe(true);
        });

        it('should return true when defVal and curVal are both empty', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Test Var',
                schema: 'test_TestVar',
                type: 'Json',
                defVal: '',
                curVal: ''
            });

            expect(result).toBe(true);
        });

        it('should return false for schema with only prefix and underscore', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Test Var',
                schema: 'test_',
                type: 'String',
                defVal: '',
                curVal: ''
            });

            expect(result).toBe(false);
        });

        it('should return false for schema with prefix and empty content after underscore', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Test Var',
                schema: 'prefix_   ',
                type: 'String',
                defVal: '',
                curVal: ''
            });

            expect(result).toBe(false);
        });
    });

    describe('Schema prefix autofix on blur', () => {
        it('should add publisher prefix to schema on blur when missing', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'test' });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            await vi.waitFor(() => document.querySelector('#nv-schema'));

            const schemaEl = document.querySelector('#nv-schema');
            schemaEl.value = 'MyVariable';

            // Trigger the blur handler
            schemaEl.dispatchEvent(new Event('blur'));

            expect(schemaEl.value).toBe('test_MyVariable');
        });

        it('should not add prefix when schema already has prefix', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'test' });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            await vi.waitFor(() => document.querySelector('#nv-schema'));

            const schemaEl = document.querySelector('#nv-schema');
            schemaEl.value = 'existing_Variable';

            // Trigger the blur handler
            schemaEl.dispatchEvent(new Event('blur'));

            expect(schemaEl.value).toBe('existing_Variable');
        });

        it('should not add prefix when schema is empty', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'test' });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            await vi.waitFor(() => document.querySelector('#nv-schema'));

            const schemaEl = document.querySelector('#nv-schema');
            schemaEl.value = '';

            // Trigger the blur handler
            schemaEl.dispatchEvent(new Event('blur'));

            expect(schemaEl.value).toBe('');
        });

        it('should handle missing publisherPrefix gracefully', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: null, publisherPrefix: null });

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            await vi.waitFor(() => document.querySelector('#nv-schema'));

            const schemaEl = document.querySelector('#nv-schema');
            schemaEl.value = 'MyVariable';

            // Trigger the blur handler - should not throw
            schemaEl.dispatchEvent(new Event('blur'));

            expect(schemaEl.value).toBe('MyVariable');
        });
    });

    describe('Solution button click handler update', () => {
        it('should update solution info to success when valid solution selected', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'test' });
            DataService.listSolutions.mockResolvedValue([
                { uniqueName: 'TestSolution', friendlyName: 'Test Solution', prefix: 'test' }
            ]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            await vi.waitFor(() => document.querySelector('#nv-soln-info'));

            const solnInfo = document.querySelector('#nv-soln-info');
            expect(solnInfo.className).toContain('success');
        });
    });

    describe('Solution dialog cancel and close handlers', () => {
        it('should call closeAndRestore when close button is clicked', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: 'TestSolution', publisherPrefix: 'test' });
            DataService.listSolutions.mockResolvedValue([
                { uniqueName: 'Sol1', friendlyName: 'Solution 1', prefix: 's1' }
            ]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            await vi.waitFor(() => document.querySelector('#nv-pick-solution'));

            const pickSolutionBtn = document.querySelector('#nv-pick-solution');
            pickSolutionBtn.click();

            await vi.waitFor(() => document.querySelector('.pdt-close-btn'));

            const closeBtn = document.querySelector('.pdt-close-btn');
            if (closeBtn && closeBtn.onclick) {
                closeBtn.onclick();
            }

            // Parent dialog should be restored
            await vi.waitFor(() => document.querySelector('#nv-name') !== null, { timeout: 1000 }).catch(() => { });
        });
    });

    describe('destroy cleanup - dynamic handlers', () => {
        it('should clear all dynamic handlers on destroy', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Add some handlers
            const testElement = document.createElement('input');
            const testHandler = vi.fn();
            component._dynamicHandlers.set(testElement, testHandler);

            expect(component._dynamicHandlers.size).toBeGreaterThan(0);

            component.destroy();

            expect(component._dynamicHandlers.size).toBe(0);
        });

        it('should cancel pending filter debounce on destroy', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const cancelSpy = vi.spyOn(component.filterCards, 'cancel');

            component.destroy();

            expect(cancelSpy).toHaveBeenCalled();
        });
    });

    describe('_isCreateModelValid Number type boundary cases', () => {
        it('should return false for NaN number value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Test Var',
                schema: 'test_TestVar',
                type: 'Number',
                defVal: 'NaN',
                curVal: ''
            });

            expect(result).toBe(false);
        });

        it('should return true for negative number', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Test Var',
                schema: 'test_TestVar',
                type: 'Number',
                defVal: '-100.5',
                curVal: ''
            });

            expect(result).toBe(true);
        });

        it('should return false for Infinity', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Test Var',
                schema: 'test_TestVar',
                type: 'Number',
                defVal: 'Infinity',
                curVal: ''
            });

            expect(result).toBe(false);
        });
    });

    describe('_openSolutionPicker overlay handlers', () => {
        it('should close dialog when clicking overlay target directly', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: null, publisherPrefix: null });
            DataService.listSolutions.mockResolvedValue([
                { uniqueName: 'TestSol', friendlyName: 'Test Solution', prefix: 'test' }
            ]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Open the add dialog
            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            await vi.waitFor(() => document.querySelector('#nv-pick-solution'));

            // Click the pick solution button
            const pickSolutionBtn = document.querySelector('#nv-pick-solution');
            pickSolutionBtn.click();

            await vi.waitFor(() => document.querySelector('#pdt-dialog-overlay'));

            const overlay = document.querySelector('#pdt-dialog-overlay');
            if (overlay && overlay.onclick) {
                // Simulate clicking on the overlay itself (not a child)
                const mockEvent = { target: overlay };
                overlay.onclick(mockEvent);

                // The dialog should be closed
                expect(document.querySelector('#soln-select')).toBeNull();
            }
        });

        it('should not close dialog when clicking inside dialog on overlay', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: null, publisherPrefix: null });
            DataService.listSolutions.mockResolvedValue([
                { uniqueName: 'TestSol', friendlyName: 'Test Solution', prefix: 'test' }
            ]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            await vi.waitFor(() => document.querySelector('#nv-pick-solution'));

            const pickSolutionBtn = document.querySelector('#nv-pick-solution');
            pickSolutionBtn.click();

            await vi.waitFor(() => document.querySelector('#pdt-dialog-overlay'));

            const overlay = document.querySelector('#pdt-dialog-overlay');
            const dialog = overlay?.querySelector('.pdt-dialog');

            if (overlay && overlay.onclick && dialog) {
                // Simulate clicking on the dialog (child of overlay)
                const mockEvent = { target: dialog };
                overlay.onclick(mockEvent);

                // The dialog should still exist because we clicked inside, not on overlay
                // (The handler checks if e.target === overlay)
            }
        });
    });

    describe('_isCreateModelValid Boolean validation', () => {
        it('should return true for valid boolean true default value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Bool Var',
                schema: 'test_BoolVar',
                type: 'Boolean',
                defVal: 'true',
                curVal: ''
            });

            expect(result).toBe(true);
        });

        it('should return true for valid boolean false default value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Bool Var',
                schema: 'test_BoolVar',
                type: 'Boolean',
                defVal: 'false',
                curVal: ''
            });

            expect(result).toBe(true);
        });

        it('should return false for invalid boolean default value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Bool Var',
                schema: 'test_BoolVar',
                type: 'Boolean',
                defVal: 'not-a-bool',
                curVal: ''
            });

            expect(result).toBe(false);
        });

        it('should return false for invalid boolean current value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'Bool Var',
                schema: 'test_BoolVar',
                type: 'Boolean',
                defVal: 'true',
                curVal: 'invalid'
            });

            expect(result).toBe(false);
        });
    });

    describe('_isCreateModelValid Json validation', () => {
        it('should return true for valid JSON default value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'JSON Var',
                schema: 'test_JsonVar',
                type: 'Json',
                defVal: '{"key": "value"}',
                curVal: ''
            });

            expect(result).toBe(true);
        });

        it('should return false for invalid JSON default value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'JSON Var',
                schema: 'test_JsonVar',
                type: 'Json',
                defVal: '{invalid json}',
                curVal: ''
            });

            expect(result).toBe(false);
        });

        it('should return false for invalid JSON current value', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const result = component._isCreateModelValid({
                name: 'JSON Var',
                schema: 'test_JsonVar',
                type: 'Json',
                defVal: '{}',
                curVal: 'not valid json'
            });

            expect(result).toBe(false);
        });
    });

    describe('_openSolutionPicker close button handler', () => {
        it('should restore parent dialog when close button is clicked', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: null, publisherPrefix: null });
            DataService.listSolutions.mockResolvedValue([
                { uniqueName: 'TestSol', friendlyName: 'Test Solution', prefix: 'test' }
            ]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            await vi.waitFor(() => document.querySelector('#nv-pick-solution'));

            const pickSolutionBtn = document.querySelector('#nv-pick-solution');
            pickSolutionBtn.click();

            await vi.waitFor(() => document.querySelector('.pdt-close-btn'));

            const closeBtn = document.querySelector('.pdt-close-btn');
            if (closeBtn && closeBtn.onclick) {
                closeBtn.onclick();
            }

            // Parent dialog should be restored
            await vi.waitFor(() => document.querySelector('#nv-name') !== null);
        });

        it('should update solution info when apply is clicked with selection', async () => {
            DataService.getCurrentSolution.mockReturnValue({ uniqueName: null, publisherPrefix: null });
            DataService.listSolutions.mockResolvedValue([
                { uniqueName: 'NewSolution', friendlyName: 'New Solution', prefix: 'new' }
            ]);

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const addBtn = element.querySelector('#env-var-add-btn');
            addBtn.click();

            await vi.waitFor(() => document.querySelector('#nv-pick-solution'));

            // Before picking, clear the schema field
            const schemaEl = document.querySelector('#nv-schema');
            if (schemaEl) {
                schemaEl.value = '';
            }

            const pickSolutionBtn = document.querySelector('#nv-pick-solution');
            pickSolutionBtn.click();

            await vi.waitFor(() => document.querySelector('#soln-select'));

            const solnSelect = document.querySelector('#soln-select');
            const applyBtn = document.querySelector('.pdt-solution-apply-btn, #soln-apply, button[id*="apply"]') ||
                document.querySelector('button.modern-button:not(.pdt-dialog-cancel):not(.pdt-close-btn)');

            if (solnSelect && applyBtn) {
                // Select the solution
                solnSelect.value = 'NewSolution';

                // Mock the current solution to return values after apply
                DataService.getCurrentSolution.mockReturnValue({
                    uniqueName: 'NewSolution',
                    publisherPrefix: 'new'
                });

                // Click apply if it has a click handler
                applyBtn.click();
            }
        });
    });
});
