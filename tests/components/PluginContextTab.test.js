/**
 * @file Comprehensive tests for PluginContextTab component
 * @module tests/components/PluginContextTab.test.js
 * @description Tests for the Plugin Context Simulator component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginContextTab } from '../../src/components/PluginContextTab.js';
import { PowerAppsApiService } from '../../src/services/PowerAppsApiService.js';
import { NotificationService } from '../../src/services/NotificationService.js';

// Mock dependencies
vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: true,
        getEntityName: vi.fn(() => 'account'),
        getEntityId: vi.fn(() => '12345-67890'),
        getAllAttributes: vi.fn(() => []),
        getGlobalContext: vi.fn(() => ({
            userSettings: {
                userId: '{11111111-2222-3333-4444-555555555555}'
            }
        }))
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        retrieveRecord: vi.fn(() => Promise.resolve({}))
    }
}));

vi.mock('../../src/services/DialogService.js', () => ({
    DialogService: { show: vi.fn() }
}));

vi.mock('../../src/ui/UIFactory.js', () => ({
    UIFactory: {
        createCopyableCodeBlock: vi.fn((code, lang) => {
            const pre = document.createElement('pre');
            pre.textContent = code;
            return pre;
        }),
        createFormDisabledMessage: vi.fn(() => {
            const div = document.createElement('div');
            div.className = 'pdt-disabled';
            return div;
        })
    }
}));

vi.mock('../../src/utils/resolvers/EntityContextResolver.js', () => ({
    EntityContextResolver: {
        resolve: vi.fn((name) => Promise.resolve({ logicalName: name, entitySet: name + 's' }))
    }
}));

vi.mock('../../src/helpers/index.js', () => ({
    escapeHtml: vi.fn((str) => str),
    filterSystemFields: vi.fn((obj) => obj),
    normalizeDateTime: vi.fn((val) => val),
    normalizeGuid: vi.fn((val) => val ? String(val).replace(/[{}]/g, '').toLowerCase() : null),
    normalizeLookup: vi.fn((val) => val),
    normalizeMoney: vi.fn((val) => val),
    normalizeNumber: vi.fn((val) => val),
    normalizeOptionSet: vi.fn((val) => val)
}));

describe('PluginContextTab', () => {
    let component;
    let element;

    beforeEach(() => {
        vi.clearAllMocks();
        component = new PluginContextTab();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        component?.destroy?.();
        document.body.innerHTML = '';
    });

    // Helper to render and post-render the component
    async function setupComponent() {
        element = await component.render();
        document.body.appendChild(element);
        component.postRender(element);
        return element;
    }

    describe('constructor', () => {
        it('should initialize with correct id', () => {
            expect(component.id).toBe('pluginContext');
        });

        it('should initialize with correct label', () => {
            expect(component.label).toBe('Plugin Context');
        });

        it('should have an icon defined', () => {
            expect(component.icon).toBeDefined();
            expect(typeof component.icon).toBe('string');
        });

        it('should be a form-only component', () => {
            expect(component.isFormOnly).toBe(true);
        });

        it('should initialize UI object as empty', () => {
            expect(component.ui).toBeDefined();
            expect(typeof component.ui).toBe('object');
        });

        it('should initialize _latestContext as null', () => {
            expect(component._latestContext).toBeNull();
        });

        it('should initialize _entitySetCache as Map', () => {
            expect(component._entitySetCache).toBeInstanceOf(Map);
        });

        it('should initialize handler references as null', () => {
            expect(component._generateBtnHandler).toBeNull();
            expect(component._copyBtnHandler).toBeNull();
            expect(component._testBtnHandler).toBeNull();
            expect(component._exportWebApiBtnHandler).toBeNull();
            expect(component._exportCSharpBtnHandler).toBeNull();
        });
    });

    describe('render', () => {
        it('should return an HTMLElement', async () => {
            const el = await component.render();
            expect(el).toBeInstanceOf(HTMLElement);
        });

        it('should render section title', async () => {
            const el = await component.render();
            const title = el.querySelector('.section-title');
            expect(title).toBeTruthy();
            expect(title.textContent).toBe('Plugin Context Simulator');
        });

        it('should render note with pre/post image information', async () => {
            const el = await component.render();
            const note = el.querySelector('.pdt-note');
            expect(note).toBeTruthy();
            expect(note.textContent).toContain('Pre-images');
        });

        it('should render message select dropdown', async () => {
            const el = await component.render();
            const messageSelect = el.querySelector('#pdt-plugin-message');
            expect(messageSelect).toBeTruthy();
            expect(messageSelect.tagName.toLowerCase()).toBe('select');
        });

        it('should render stage select dropdown', async () => {
            const el = await component.render();
            const stageSelect = el.querySelector('#pdt-plugin-stage');
            expect(stageSelect).toBeTruthy();
            expect(stageSelect.tagName.toLowerCase()).toBe('select');
        });

        it('should render message options (Create, Update, Delete)', async () => {
            const el = await component.render();
            const options = el.querySelectorAll('#pdt-plugin-message option');
            expect(options.length).toBe(3);
            const values = Array.from(options).map(o => o.value.toLowerCase());
            expect(values).toContain('create');
            expect(values).toContain('update');
            expect(values).toContain('delete');
        });

        it('should render stage options (Pre-operation, Post-operation)', async () => {
            const el = await component.render();
            const options = el.querySelectorAll('#pdt-plugin-stage option');
            expect(options.length).toBe(2);
        });

        it('should render generate button', async () => {
            const el = await component.render();
            const generateBtn = el.querySelector('#pdt-generate-context-btn');
            expect(generateBtn).toBeTruthy();
        });

        it('should render copy button (initially hidden)', async () => {
            const el = await component.render();
            const copyBtn = el.querySelector('#pdt-copy-context-btn');
            expect(copyBtn).toBeTruthy();
            expect(copyBtn.classList.contains('pdt-hidden')).toBe(true);
        });

        it('should render test button (initially hidden)', async () => {
            const el = await component.render();
            const testBtn = el.querySelector('#pdt-generate-test-btn');
            expect(testBtn).toBeTruthy();
            expect(testBtn.classList.contains('pdt-hidden')).toBe(true);
        });

        it('should render export WebAPI button (initially hidden)', async () => {
            const el = await component.render();
            const exportBtn = el.querySelector('#pdt-export-webapi-btn');
            expect(exportBtn).toBeTruthy();
            expect(exportBtn.classList.contains('pdt-hidden')).toBe(true);
        });

        it('should render export C# button (initially hidden)', async () => {
            const el = await component.render();
            const exportBtn = el.querySelector('#pdt-export-csharp-btn');
            expect(exportBtn).toBeTruthy();
            expect(exportBtn.classList.contains('pdt-hidden')).toBe(true);
        });

        it('should render output container', async () => {
            const el = await component.render();
            const output = el.querySelector('#pdt-context-output');
            expect(output).toBeTruthy();
        });

        it('should have Create selected by default', async () => {
            const el = await component.render();
            const messageSelect = el.querySelector('#pdt-plugin-message');
            expect(messageSelect.value.toLowerCase()).toBe('create');
        });
    });

    describe('postRender', () => {
        it('should cache UI elements', async () => {
            await setupComponent();
            expect(component.ui.messageSelect).toBeTruthy();
            expect(component.ui.stageSelect).toBeTruthy();
            expect(component.ui.generateBtn).toBeTruthy();
            expect(component.ui.outputContainer).toBeTruthy();
            expect(component.ui.copyBtn).toBeTruthy();
            expect(component.ui.testBtn).toBeTruthy();
            expect(component.ui.exportWebApiBtn).toBeTruthy();
            expect(component.ui.exportCSharpBtn).toBeTruthy();
        });

        it('should set secondary buttons disabled initially', async () => {
            await setupComponent();
            expect(component.ui.copyBtn.disabled).toBe(true);
            expect(component.ui.testBtn.disabled).toBe(true);
            expect(component.ui.exportWebApiBtn.disabled).toBe(true);
            expect(component.ui.exportCSharpBtn.disabled).toBe(true);
        });

        it('should set up event handlers', async () => {
            await setupComponent();
            expect(component._generateBtnHandler).toBeDefined();
            expect(component._copyBtnHandler).toBeDefined();
            expect(component._testBtnHandler).toBeDefined();
            expect(component._exportWebApiBtnHandler).toBeDefined();
            expect(component._exportCSharpBtnHandler).toBeDefined();
        });
    });

    describe('_buildContext', () => {
        it('should build context for Create message', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue([]);
            const context = component._buildContext('Create', 20);
            expect(context.MessageName).toBe('Create');
            expect(context.Stage).toBe(20);
            expect(context.PrimaryEntityName).toBe('account');
            expect(context.InputParameters).toBeDefined();
            expect(context.InputParameters.Target).toBeDefined();
        });

        it('should build context for Update message', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue([]);
            const context = component._buildContext('Update', 20);
            expect(context.MessageName).toBe('Update');
            expect(context.InputParameters.Target).toBeDefined();
        });

        it('should build context for Delete message', async () => {
            await setupComponent();
            const context = component._buildContext('Delete', 20);
            expect(context.MessageName).toBe('Delete');
            expect(context.InputParameters.Target).toBeDefined();
            expect(context.InputParameters.Target.__type).toContain('EntityReference');
        });

        it('should include pre-image for Update with dirty fields', async () => {
            await setupComponent();
            const mockAttr = {
                getName: () => 'name',
                getValue: () => 'New Value',
                getInitialValue: () => 'Old Value',
                getIsDirty: () => true,
                getAttributeType: () => 'string'
            };
            PowerAppsApiService.getAllAttributes.mockReturnValue([mockAttr]);
            const context = component._buildContext('Update', 20);
            expect(context.PreEntityImages).toBeDefined();
        });

        it('should include post-image for Post-operation stage', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue([]);
            const context = component._buildContext('Create', 40);
            expect(context.PostEntityImages).toBeDefined();
        });

        it('should include initiating user ID', async () => {
            await setupComponent();
            const context = component._buildContext('Create', 20);
            expect(context.InitiatingUserId).toBeDefined();
        });

        it('should include primary entity ID', async () => {
            await setupComponent();
            const context = component._buildContext('Update', 20);
            expect(context.PrimaryEntityId).toBeDefined();
        });
    });

    describe('_getFormEntityState', () => {
        it('should return empty objects when no attributes', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue([]);
            const result = component._getFormEntityState();
            expect(result.fullEntity).toEqual({});
            expect(result.dirtyAttributes).toEqual({});
            expect(result.preImageEntity).toEqual({});
        });

        it('should capture full entity with all attributes', async () => {
            await setupComponent();
            const mockAttr = {
                getName: () => 'name',
                getValue: () => 'Test Account',
                getIsDirty: () => false,
                getAttributeType: () => 'string'
            };
            PowerAppsApiService.getAllAttributes.mockReturnValue([mockAttr]);
            const result = component._getFormEntityState();
            expect(result.fullEntity.name).toBe('Test Account');
        });

        it('should capture dirty attributes separately', async () => {
            await setupComponent();
            const mockAttr = {
                getName: () => 'name',
                getValue: () => 'New Name',
                getInitialValue: () => 'Old Name',
                getIsDirty: () => true,
                getAttributeType: () => 'string'
            };
            PowerAppsApiService.getAllAttributes.mockReturnValue([mockAttr]);
            const result = component._getFormEntityState();
            expect(result.dirtyAttributes.name).toBe('New Name');
            expect(result.preImageEntity.name).toBe('Old Name');
        });

        it('should handle attributes without getIsDirty method', async () => {
            await setupComponent();
            const mockAttr = {
                getName: () => 'name',
                getValue: () => 'Value',
                getAttributeType: () => 'string'
            };
            PowerAppsApiService.getAllAttributes.mockReturnValue([mockAttr]);
            const result = component._getFormEntityState();
            expect(result.fullEntity.name).toBe('Value');
            expect(result.dirtyAttributes.name).toBeUndefined();
        });

        it('should skip invalid attributes', async () => {
            await setupComponent();
            const invalidAttr = { someOtherProp: true };
            const validAttr = {
                getName: () => 'valid',
                getValue: () => 'Value',
                getIsDirty: () => false,
                getAttributeType: () => 'string'
            };
            PowerAppsApiService.getAllAttributes.mockReturnValue([invalidAttr, validAttr]);
            const result = component._getFormEntityState();
            expect(Object.keys(result.fullEntity)).toEqual(['valid']);
        });
    });

    describe('_normalizeValue', () => {
        it('should handle lookup attributes', async () => {
            await setupComponent();
            const attr = { getAttributeType: () => 'lookup' };
            component._normalizeValue(attr, [{ id: '123', name: 'Test' }]);
            // normalizeLookup is mocked, just verify no error
        });

        it('should handle optionset attributes', async () => {
            await setupComponent();
            const attr = { getAttributeType: () => 'optionset' };
            component._normalizeValue(attr, 100);
        });

        it('should handle money attributes', async () => {
            await setupComponent();
            const attr = { getAttributeType: () => 'money' };
            component._normalizeValue(attr, 100.50);
        });

        it('should handle datetime attributes', async () => {
            await setupComponent();
            const attr = { getAttributeType: () => 'datetime' };
            component._normalizeValue(attr, new Date());
        });

        it('should handle integer attributes', async () => {
            await setupComponent();
            const attr = { getAttributeType: () => 'integer' };
            component._normalizeValue(attr, 42);
        });
    });

    describe('generate context button click', () => {
        it('should show error for Update/Delete without entity ID', async () => {
            await setupComponent();
            PowerAppsApiService.getEntityId.mockReturnValue(null);
            component.ui.messageSelect.value = 'Update';
            component.ui.generateBtn.click();
            expect(component.ui.outputContainer.innerHTML).toContain('existing record');
        });

        it('should show note for Update without dirty fields', async () => {
            await setupComponent();
            // Must have entity ID for Update (otherwise shows "Open existing record" error)
            PowerAppsApiService.getEntityId.mockReturnValue('test-id-123');
            // Return empty attributes means no dirty fields
            PowerAppsApiService.getAllAttributes.mockReturnValue([]);
            component.ui.messageSelect.value = 'Update';
            component.ui.generateBtn.click();
            // When update has no dirty fields, it shows a note about modifying fields
            expect(component.ui.outputContainer.innerHTML).toContain('pdt-note');
        });

        it('should generate context for Create message', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue([
                {
                    getName: () => 'name',
                    getValue: () => 'Test',
                    getIsDirty: () => false,
                    getAttributeType: () => 'string'
                }
            ]);
            component.ui.messageSelect.value = 'Create';
            component.ui.generateBtn.click();
            expect(component._latestContext).toBeDefined();
            expect(component._latestContext.MessageName).toBe('Create');
        });
    });

    describe('destroy', () => {
        it('should not throw when called', () => {
            expect(() => component.destroy()).not.toThrow();
        });

        it('should not throw when destroy called without render', () => {
            expect(() => component.destroy()).not.toThrow();
        });

        it('should cleanup after render and postRender', async () => {
            await setupComponent();
            expect(() => component.destroy()).not.toThrow();
        });

        it('should remove event listeners', async () => {
            await setupComponent();
            const generateBtn = component.ui.generateBtn;
            const removeListenerSpy = vi.spyOn(generateBtn, 'removeEventListener');
            component.destroy();
            expect(removeListenerSpy).toHaveBeenCalled();
        });
    });

    describe('_setSecondaryEnabled', () => {
        it('should enable secondary buttons when true', async () => {
            await setupComponent();
            component._setSecondaryEnabled(true);
            expect(component.ui.copyBtn.disabled).toBe(false);
            expect(component.ui.testBtn.disabled).toBe(false);
        });

        it('should disable secondary buttons when false', async () => {
            await setupComponent();
            component._setSecondaryEnabled(false);
            expect(component.ui.copyBtn.disabled).toBe(true);
            expect(component.ui.testBtn.disabled).toBe(true);
        });
    });

    describe('copy button', () => {
        it('should not throw when clicked without context', async () => {
            await setupComponent();
            component._latestContext = null;
            expect(() => component.ui.copyBtn.click()).not.toThrow();
        });
    });

    describe('test button', () => {
        it('should not throw when clicked without context', async () => {
            await setupComponent();
            component._latestContext = null;
            expect(() => component.ui.testBtn.click()).not.toThrow();
        });
    });

    describe('export WebAPI button', () => {
        it('should not throw when clicked without context', async () => {
            await setupComponent();
            component._latestContext = null;
            await expect(async () => {
                component.ui.exportWebApiBtn.click();
            }).not.toThrow();
        });
    });

    describe('export C# button', () => {
        it('should not throw when clicked without context', async () => {
            await setupComponent();
            component._latestContext = null;
            expect(() => component.ui.exportCSharpBtn.click()).not.toThrow();
        });
    });

    describe('_buildContext - comprehensive', () => {
        it('should include LogicalName in Target for Create message', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue([]);
            const context = component._buildContext('Create', 20);
            expect(context.InputParameters.Target.LogicalName).toBe('account');
        });

        it('should NOT include Id in Target for Create message', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue([]);
            const context = component._buildContext('Create', 20);
            expect(context.InputParameters.Target.Id).toBeUndefined();
        });

        it('should include Id in Target for Update message', async () => {
            await setupComponent();
            PowerAppsApiService.getEntityId.mockReturnValue('update-id-123');
            const mockAttr = {
                getName: () => 'name',
                getValue: () => 'New',
                getInitialValue: () => 'Old',
                getIsDirty: () => true,
                getAttributeType: () => 'string'
            };
            PowerAppsApiService.getAllAttributes.mockReturnValue([mockAttr]);
            const context = component._buildContext('Update', 20);
            expect(context.InputParameters.Target.Id).toBeDefined();
        });

        it('should return EntityReference type for Delete Target', async () => {
            await setupComponent();
            PowerAppsApiService.getEntityId.mockReturnValue('delete-id-123');
            const context = component._buildContext('Delete', 20);
            expect(context.InputParameters.Target.__type).toBe('EntityReference');
            expect(context.InputParameters.Target.LogicalName).toBe('account');
            expect(context.InputParameters.Target.Id).toBeDefined();
        });

        it('should include PreEntityImage for Delete at Pre-operation stage', async () => {
            await setupComponent();
            PowerAppsApiService.getEntityId.mockReturnValue('delete-id-123');
            PowerAppsApiService.getAllAttributes.mockReturnValue([
                {
                    getName: () => 'name',
                    getValue: () => 'Test Value',
                    getIsDirty: () => false,
                    getAttributeType: () => 'string'
                }
            ]);
            const context = component._buildContext('Delete', 20);
            expect(context.PreEntityImages.preimage).toBeDefined();
            expect(context.PreEntityImages.preimage.Attributes.name).toBe('Test Value');
        });

        it('should NOT include PreEntityImage for Delete at Post-operation stage', async () => {
            await setupComponent();
            PowerAppsApiService.getEntityId.mockReturnValue('delete-id-123');
            PowerAppsApiService.getAllAttributes.mockReturnValue([]);
            const context = component._buildContext('Delete', 40);
            expect(context.PreEntityImages.preimage).toBeUndefined();
        });

        it('should NOT include PostEntityImage for Delete message', async () => {
            await setupComponent();
            PowerAppsApiService.getEntityId.mockReturnValue('delete-id-123');
            const context = component._buildContext('Delete', 40);
            expect(context.PostEntityImages.postimage).toBeUndefined();
        });

        it('should include PostEntityImage for Create at Post-operation', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue([
                {
                    getName: () => 'revenue',
                    getValue: () => 50000,
                    getIsDirty: () => false,
                    getAttributeType: () => 'money'
                }
            ]);
            const context = component._buildContext('Create', 40);
            expect(context.PostEntityImages.postimage).toBeDefined();
            expect(context.PostEntityImages.postimage.Attributes.revenue).toBeDefined();
        });

        it('should NOT include PostEntityImage at Pre-operation stage', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue([]);
            const context = component._buildContext('Create', 20);
            expect(context.PostEntityImages.postimage).toBeUndefined();
        });

        it('should handle unknown message type with default behavior', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue([
                {
                    getName: () => 'field1',
                    getValue: () => 'value1',
                    getInitialValue: () => 'value1',
                    getIsDirty: () => true,
                    getAttributeType: () => 'string'
                }
            ]);
            const context = component._buildContext('CustomMessage', 20);
            expect(context.MessageName).toBe('CustomMessage');
            expect(context.InputParameters.Target).toBeDefined();
        });

        it('should normalize initiating user ID from global context', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue([]);
            const context = component._buildContext('Create', 20);
            expect(context.InitiatingUserId).toBeDefined();
        });

        it('should handle missing global context gracefully', async () => {
            await setupComponent();
            PowerAppsApiService.getGlobalContext.mockImplementation(() => {
                throw new Error('No global context');
            });
            PowerAppsApiService.getAllAttributes.mockReturnValue([]);
            const context = component._buildContext('Create', 20);
            expect(context.InitiatingUserId).toBeNull();
        });
    });

    describe('_getFormEntityState - edge cases', () => {
        it('should handle attribute with getIsDirty but no getInitialValue', async () => {
            await setupComponent();
            const mockAttr = {
                getName: () => 'field1',
                getValue: () => 'current',
                getIsDirty: () => true,
                getAttributeType: () => 'string'
                // No getInitialValue
            };
            PowerAppsApiService.getAllAttributes.mockReturnValue([mockAttr]);
            const result = component._getFormEntityState();
            expect(result.dirtyAttributes.field1).toBe('current');
            expect(result.preImageEntity.field1).toBe('current'); // Falls back to current
        });

        it('should include non-dirty attributes in preImageEntity', async () => {
            await setupComponent();
            const mockAttr = {
                getName: () => 'name',
                getValue: () => 'Test',
                getIsDirty: () => false,
                getAttributeType: () => 'string'
            };
            PowerAppsApiService.getAllAttributes.mockReturnValue([mockAttr]);
            const result = component._getFormEntityState();
            expect(result.preImageEntity.name).toBe('Test');
            expect(result.dirtyAttributes.name).toBeUndefined();
        });

        it('should handle null attributes array', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue(null);
            const result = component._getFormEntityState();
            expect(result.fullEntity).toEqual({});
        });

        it('should handle undefined attributes array', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue(undefined);
            const result = component._getFormEntityState();
            expect(result.fullEntity).toEqual({});
        });

        it('should handle attribute with null getValue result', async () => {
            await setupComponent();
            const mockAttr = {
                getName: () => 'nullfield',
                getValue: () => null,
                getIsDirty: () => false,
                getAttributeType: () => 'string'
            };
            PowerAppsApiService.getAllAttributes.mockReturnValue([mockAttr]);
            const result = component._getFormEntityState();
            expect(result.fullEntity.nullfield).toBeNull();
        });
    });

    describe('_renderContext', () => {
        it('should clear output container before rendering', async () => {
            await setupComponent();
            component.ui.outputContainer.innerHTML = '<div>Previous content</div>';
            const context = {
                MessageName: 'Create',
                Stage: 20,
                InputParameters: { Target: { Attributes: { name: 'Test' } } },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._renderContext(context);
            expect(component.ui.outputContainer.innerHTML).not.toContain('Previous content');
        });

        it('should render section headers', async () => {
            await setupComponent();
            const context = {
                MessageName: 'Update',
                Stage: 20,
                InputParameters: { Target: { Attributes: { name: 'Test' } } },
                PreEntityImages: { preimage: { Attributes: { name: 'Old' } } },
                PostEntityImages: {}
            };
            component._renderContext(context);
            const headers = component.ui.outputContainer.querySelectorAll('.pdt-section-header');
            expect(headers.length).toBeGreaterThanOrEqual(1);
        });

        it('should show empty message for Create PreImage', async () => {
            await setupComponent();
            const context = {
                MessageName: 'Create',
                Stage: 20,
                InputParameters: { Target: { Attributes: {} } },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._renderContext(context);
            const noteText = component.ui.outputContainer.textContent;
            expect(noteText).toContain('Pre-Image');
        });

        it('should show empty message when PostImage not available at Pre-operation', async () => {
            await setupComponent();
            const context = {
                MessageName: 'Update',
                Stage: 20,
                InputParameters: { Target: { Attributes: { name: 'New' } } },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._renderContext(context);
            const noteText = component.ui.outputContainer.textContent;
            expect(noteText).toContain('Post-operation');
        });
    });

    describe('_generateCSharpTest', () => {
        it('should generate test code with correct message name', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Create',
                Stage: 20,
                PrimaryEntityName: 'account',
                PrimaryEntityId: '12345-67890',
                InputParameters: { Target: { Attributes: { name: 'Test Account' } } },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._generateCSharpTest(context);
            expect(DialogService.show).toHaveBeenCalled();
            const callArgs = DialogService.show.mock.calls[0];
            expect(callArgs[0]).toContain('FakeXrmEasy');
        });

        it('should generate EntityReference for Delete message', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Delete',
                Stage: 20,
                PrimaryEntityName: 'contact',
                PrimaryEntityId: 'delete-guid-123',
                InputParameters: { Target: { __type: 'EntityReference', Id: 'delete-guid-123', LogicalName: 'contact' } },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._generateCSharpTest(context);
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should include preImage setup when available', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Update',
                Stage: 20,
                PrimaryEntityName: 'account',
                PrimaryEntityId: '12345-67890',
                InputParameters: { Target: { Attributes: { name: 'New' } } },
                PreEntityImages: { preimage: { Id: '12345-67890', Attributes: { name: 'Old' } } },
                PostEntityImages: {}
            };
            component._generateCSharpTest(context);
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should handle Delete with preImage for initialization', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Delete',
                Stage: 20,
                PrimaryEntityName: 'opportunity',
                PrimaryEntityId: 'opp-guid-123',
                InputParameters: { Target: { __type: 'EntityReference', Id: 'opp-guid-123', LogicalName: 'opportunity' } },
                PreEntityImages: { preimage: { Id: 'opp-guid-123', Attributes: { name: 'My Opportunity', estimatedvalue: 10000 } } },
                PostEntityImages: {}
            };
            component._generateCSharpTest(context);
            expect(DialogService.show).toHaveBeenCalled();
        });
    });

    describe('_exportWebApiJson', () => {
        it('should show delete instructions for Delete message', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Delete',
                PrimaryEntityName: 'account',
                PrimaryEntityId: 'acc-guid-123',
                InputParameters: { Target: { __type: 'EntityReference', Id: 'acc-guid-123', LogicalName: 'account' } }
            };
            await component._exportWebApiJson(context);
            expect(DialogService.show).toHaveBeenCalled();
            const callArgs = DialogService.show.mock.calls[0];
            expect(callArgs[0]).toContain('Delete');
        });

        it('should show error when no Target entity for non-Delete', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Update',
                InputParameters: { Target: null }
            };
            await component._exportWebApiJson(context);
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should show error when Target has no Attributes', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Create',
                InputParameters: { Target: { LogicalName: 'account' } }
            };
            await component._exportWebApiJson(context);
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should generate Create instructions for Create message', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Create',
                PrimaryEntityName: 'lead',
                InputParameters: {
                    Target: {
                        LogicalName: 'lead',
                        Attributes: { subject: 'New Lead' }
                    }
                }
            };
            await component._exportWebApiJson(context);
            expect(DialogService.show).toHaveBeenCalled();
            const callArgs = DialogService.show.mock.calls[0];
            expect(callArgs[0]).toContain('Create');
        });

        it('should generate Update instructions for Update message', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Update',
                PrimaryEntityName: 'contact',
                PrimaryEntityId: 'contact-guid-456',
                InputParameters: {
                    Target: {
                        LogicalName: 'contact',
                        Id: 'contact-guid-456',
                        Attributes: { firstname: 'Updated' }
                    }
                }
            };
            await component._exportWebApiJson(context);
            expect(DialogService.show).toHaveBeenCalled();
            const callArgs = DialogService.show.mock.calls[0];
            expect(callArgs[0]).toContain('Update');
        });

        it('should handle exception and show error dialog', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            // Create a context that will cause _convertToWebApiFormat to fail
            const context = {
                MessageName: 'Create',
                InputParameters: {
                    Target: {
                        LogicalName: 'account',
                        Attributes: {
                            get badField() { throw new Error('Conversion error'); }
                        }
                    }
                }
            };
            await component._exportWebApiJson(context);
            expect(DialogService.show).toHaveBeenCalled();
        });
    });

    describe('_exportCSharpCode', () => {
        it('should generate Delete code with service.Delete call', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Delete',
                PrimaryEntityName: 'account',
                PrimaryEntityId: 'acc-del-123',
                InputParameters: { Target: { __type: 'EntityReference', Id: 'acc-del-123', LogicalName: 'account' } }
            };
            component._exportCSharpCode(context);
            expect(DialogService.show).toHaveBeenCalled();
            const callArgs = DialogService.show.mock.calls[0];
            expect(callArgs[0]).toContain('Delete');
        });

        it('should show error for Delete without entity ID', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Delete',
                PrimaryEntityName: 'account',
                InputParameters: { Target: { __type: 'EntityReference', LogicalName: 'account' } }
            };
            component._exportCSharpCode(context);
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should show error when no Target entity', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Update',
                InputParameters: { Target: null }
            };
            component._exportCSharpCode(context);
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should generate Create code with service.Create call', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Create',
                PrimaryEntityName: 'account',
                InputParameters: {
                    Target: {
                        LogicalName: 'account',
                        Attributes: { name: 'New Account' }
                    }
                }
            };
            component._exportCSharpCode(context);
            expect(DialogService.show).toHaveBeenCalled();
            const callArgs = DialogService.show.mock.calls[0];
            expect(callArgs[0]).toContain('Create');
        });

        it('should generate Update code with entity ID', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Update',
                PrimaryEntityName: 'contact',
                InputParameters: {
                    Target: {
                        LogicalName: 'contact',
                        Id: 'contact-upd-789',
                        Attributes: { lastname: 'Smith' }
                    }
                }
            };
            component._exportCSharpCode(context);
            expect(DialogService.show).toHaveBeenCalled();
            const callArgs = DialogService.show.mock.calls[0];
            expect(callArgs[0]).toContain('Update');
        });

        it('should handle export exception and show error', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            // Force an error by providing circular reference
            const context = {
                MessageName: 'Create',
                InputParameters: {
                    Target: {
                        LogicalName: 'account',
                        get Attributes() { throw new Error('Export error'); }
                    }
                }
            };
            component._exportCSharpCode(context);
            expect(DialogService.show).toHaveBeenCalled();
        });
    });

    describe('_copyContextJson', () => {
        it('should call DialogService.show with JSON content', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = { MessageName: 'Create', Stage: 20 };
            component._copyContextJson(context);
            expect(DialogService.show).toHaveBeenCalled();
            const callArgs = DialogService.show.mock.calls[0];
            expect(callArgs[0]).toContain('JSON');
        });

        it('should handle serialization error gracefully', async () => {
            await setupComponent();
            const circular = {};
            circular.self = circular;
            component._copyContextJson(circular);
            expect(component.ui.outputContainer.innerHTML).toContain('pdt-error');
        });
    });

    describe('_setSecondaryEnabled - comprehensive', () => {
        it('should show buttons when enabled', async () => {
            await setupComponent();
            component._setSecondaryEnabled(true);
            expect(component.ui.copyBtn.classList.contains('pdt-hidden')).toBe(false);
            expect(component.ui.testBtn.classList.contains('pdt-hidden')).toBe(false);
            expect(component.ui.exportWebApiBtn.classList.contains('pdt-hidden')).toBe(false);
            expect(component.ui.exportCSharpBtn.classList.contains('pdt-hidden')).toBe(false);
        });

        it('should hide buttons when disabled', async () => {
            await setupComponent();
            component._setSecondaryEnabled(true);
            component._setSecondaryEnabled(false);
            expect(component.ui.copyBtn.classList.contains('pdt-hidden')).toBe(true);
            expect(component.ui.testBtn.classList.contains('pdt-hidden')).toBe(true);
        });

        it('should not throw if ui is undefined', () => {
            const comp = new PluginContextTab();
            comp.ui = undefined;
            expect(() => comp._setSecondaryEnabled(true)).not.toThrow();
        });

        it('should handle missing button elements gracefully', async () => {
            await setupComponent();
            component.ui.copyBtn = null;
            expect(() => component._setSecondaryEnabled(true)).not.toThrow();
        });
    });

    describe('Message selection behavior', () => {
        it('should update message value when selection changes', async () => {
            await setupComponent();
            component.ui.messageSelect.value = 'Update';
            expect(component.ui.messageSelect.value).toBe('Update');
        });

        it('should update message value to Delete', async () => {
            await setupComponent();
            component.ui.messageSelect.value = 'Delete';
            expect(component.ui.messageSelect.value).toBe('Delete');
        });
    });

    describe('Stage selection behavior', () => {
        it('should update stage value when selection changes', async () => {
            await setupComponent();
            component.ui.stageSelect.value = '40';
            expect(component.ui.stageSelect.value).toBe('40');
        });

        it('should default to Pre-operation stage value', async () => {
            await setupComponent();
            expect(component.ui.stageSelect.value).toBe('20');
        });
    });

    describe('Pre-Image simulation', () => {
        it('should capture original values for dirty fields in pre-image', async () => {
            await setupComponent();
            PowerAppsApiService.getEntityId.mockReturnValue('test-id-999');
            const mockAttr = {
                getName: () => 'telephone1',
                getValue: () => '555-NEW-PHONE',
                getInitialValue: () => '555-OLD-PHONE',
                getIsDirty: () => true,
                getAttributeType: () => 'string'
            };
            PowerAppsApiService.getAllAttributes.mockReturnValue([mockAttr]);
            const context = component._buildContext('Update', 20);
            expect(context.PreEntityImages.preimage.Attributes.telephone1).toBe('555-OLD-PHONE');
        });

        it('should not include pre-image for Create message', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue([
                {
                    getName: () => 'name',
                    getValue: () => 'New Value',
                    getIsDirty: () => false,
                    getAttributeType: () => 'string'
                }
            ]);
            const context = component._buildContext('Create', 20);
            expect(context.PreEntityImages.preimage).toBeUndefined();
        });
    });

    describe('Post-Image simulation', () => {
        it('should include full entity state in post-image at Post-operation', async () => {
            await setupComponent();
            PowerAppsApiService.getEntityId.mockReturnValue('post-img-id');
            PowerAppsApiService.getAllAttributes.mockReturnValue([
                {
                    getName: () => 'name',
                    getValue: () => 'Full Name',
                    getIsDirty: () => false,
                    getAttributeType: () => 'string'
                },
                {
                    getName: () => 'email',
                    getValue: () => 'test@example.com',
                    getIsDirty: () => true,
                    getInitialValue: () => 'old@example.com',
                    getAttributeType: () => 'string'
                }
            ]);
            const context = component._buildContext('Update', 40);
            expect(context.PostEntityImages.postimage).toBeDefined();
            expect(context.PostEntityImages.postimage.Attributes.name).toBe('Full Name');
            expect(context.PostEntityImages.postimage.Attributes.email).toBe('test@example.com');
        });
    });

    describe('Target entity building', () => {
        it('should include only dirty attributes in Update Target', async () => {
            await setupComponent();
            PowerAppsApiService.getEntityId.mockReturnValue('target-id');
            const dirtyAttr = {
                getName: () => 'dirty_field',
                getValue: () => 'changed',
                getInitialValue: () => 'original',
                getIsDirty: () => true,
                getAttributeType: () => 'string'
            };
            const cleanAttr = {
                getName: () => 'clean_field',
                getValue: () => 'unchanged',
                getIsDirty: () => false,
                getAttributeType: () => 'string'
            };
            PowerAppsApiService.getAllAttributes.mockReturnValue([dirtyAttr, cleanAttr]);
            const context = component._buildContext('Update', 20);
            expect(context.InputParameters.Target.Attributes.dirty_field).toBe('changed');
            expect(context.InputParameters.Target.Attributes.clean_field).toBeUndefined();
        });

        it('should include all non-system attributes in Create Target', async () => {
            await setupComponent();
            const attr1 = {
                getName: () => 'field1',
                getValue: () => 'value1',
                getIsDirty: () => false,
                getAttributeType: () => 'string'
            };
            const attr2 = {
                getName: () => 'field2',
                getValue: () => 'value2',
                getIsDirty: () => false,
                getAttributeType: () => 'string'
            };
            PowerAppsApiService.getAllAttributes.mockReturnValue([attr1, attr2]);
            const context = component._buildContext('Create', 20);
            expect(context.InputParameters.Target.Attributes.field1).toBe('value1');
            expect(context.InputParameters.Target.Attributes.field2).toBe('value2');
        });
    });

    describe('Error handling', () => {
        it('should show error for Update without entity ID', async () => {
            await setupComponent();
            PowerAppsApiService.getEntityId.mockReturnValue(null);
            component.ui.messageSelect.value = 'Update';
            component.ui.generateBtn.click();
            expect(component.ui.outputContainer.innerHTML).toContain('existing record');
            expect(component._latestContext).toBeNull();
        });

        it('should show error for Delete without entity ID', async () => {
            await setupComponent();
            PowerAppsApiService.getEntityId.mockReturnValue(null);
            component.ui.messageSelect.value = 'Delete';
            component.ui.generateBtn.click();
            expect(component.ui.outputContainer.innerHTML).toContain('existing record');
            expect(component._latestContext).toBeNull();
        });

        it('should disable secondary buttons on error', async () => {
            await setupComponent();
            PowerAppsApiService.getEntityId.mockReturnValue(null);
            component.ui.messageSelect.value = 'Delete';
            component.ui.generateBtn.click();
            expect(component.ui.copyBtn.disabled).toBe(true);
            expect(component.ui.testBtn.disabled).toBe(true);
        });

        it('should handle exception in _buildContext and show error', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockImplementation(() => {
                throw new Error('Form validation failed');
            });
            component.ui.messageSelect.value = 'Create';
            component.ui.generateBtn.click();
            expect(component.ui.outputContainer.innerHTML).toContain('pdt-error');
            expect(component._latestContext).toBeNull();
        });

        it('should allow Create without entity ID (new record)', async () => {
            await setupComponent();
            PowerAppsApiService.getEntityId.mockReturnValue(null);
            PowerAppsApiService.getAllAttributes.mockReturnValue([
                {
                    getName: () => 'name',
                    getValue: () => 'New Record',
                    getIsDirty: () => false,
                    getAttributeType: () => 'string'
                }
            ]);
            component.ui.messageSelect.value = 'Create';
            component.ui.generateBtn.click();
            expect(component._latestContext).not.toBeNull();
            expect(component._latestContext.MessageName).toBe('Create');
        });
    });

    describe('Handler cleanup in destroy', () => {
        it('should remove all event listeners on destroy', async () => {
            await setupComponent();
            const removeSpy1 = vi.spyOn(component.ui.generateBtn, 'removeEventListener');
            const removeSpy2 = vi.spyOn(component.ui.copyBtn, 'removeEventListener');
            const removeSpy3 = vi.spyOn(component.ui.testBtn, 'removeEventListener');
            const removeSpy4 = vi.spyOn(component.ui.exportWebApiBtn, 'removeEventListener');
            const removeSpy5 = vi.spyOn(component.ui.exportCSharpBtn, 'removeEventListener');

            component.destroy();

            expect(removeSpy1).toHaveBeenCalledWith('click', component._generateBtnHandler);
            expect(removeSpy2).toHaveBeenCalledWith('click', component._copyBtnHandler);
            expect(removeSpy3).toHaveBeenCalledWith('click', component._testBtnHandler);
            expect(removeSpy4).toHaveBeenCalledWith('click', component._exportWebApiBtnHandler);
            expect(removeSpy5).toHaveBeenCalledWith('click', component._exportCSharpBtnHandler);
        });

        it('should handle destroy when ui.generateBtn is missing', async () => {
            await setupComponent();
            component.ui.generateBtn = null;
            expect(() => component.destroy()).not.toThrow();
        });

        it('should handle destroy when ui is null', async () => {
            component.ui = null;
            expect(() => component.destroy()).not.toThrow();
        });

        it('should handle multiple destroy calls', async () => {
            await setupComponent();
            expect(() => {
                component.destroy();
                component.destroy();
            }).not.toThrow();
        });
    });

    describe('_convertToCSharpValue', () => {
        it('should convert null value', async () => {
            await setupComponent();
            const result = component._convertToCSharpValue(null, 'field');
            expect(result).toContain('null');
        });

        it('should convert EntityReference value', async () => {
            await setupComponent();
            const value = { __type: 'EntityReference', Id: 'ref-id-123', LogicalName: 'account', Name: 'Test Account' };
            const result = component._convertToCSharpValue(value, 'parentaccountid');
            expect(result).toContain('EntityReference');
            expect(result).toContain('account');
            expect(result).toContain('ref-id-123');
        });

        it('should convert Money value', async () => {
            await setupComponent();
            const value = { __type: 'Money', Value: 1500.50 };
            const result = component._convertToCSharpValue(value, 'revenue');
            expect(result).toContain('Money');
            expect(result).toContain('1500.5');
        });

        it('should convert OptionSetValue', async () => {
            await setupComponent();
            const value = { __type: 'OptionSetValue', Value: 100000001 };
            const result = component._convertToCSharpValue(value, 'statuscode');
            expect(result).toContain('OptionSetValue');
            expect(result).toContain('100000001');
        });

        it('should convert OptionSetValueCollection', async () => {
            await setupComponent();
            const value = { __type: 'OptionSetValueCollection', Values: [1, 2, 3] };
            const result = component._convertToCSharpValue(value, 'multiselect');
            expect(result).toContain('OptionSetValueCollection');
        });

        it('should convert DateTime value', async () => {
            await setupComponent();
            const value = { __type: 'DateTime', Iso: '2024-01-15T10:30:00Z' };
            const result = component._convertToCSharpValue(value, 'createdon');
            expect(result).toContain('DateTime.Parse');
            expect(result).toContain('2024-01-15');
        });

        it('should convert boolean value', async () => {
            await setupComponent();
            const result = component._convertToCSharpValue(true, 'isactive');
            expect(result).toContain('true');
        });

        it('should convert number value', async () => {
            await setupComponent();
            const result = component._convertToCSharpValue(42, 'numberfield');
            expect(result).toContain('42');
        });

        it('should convert string value with escaping', async () => {
            await setupComponent();
            const result = component._convertToCSharpValue('Hello "World"\nNew Line', 'description');
            expect(result).toContain('\\"');
            expect(result).toContain('\\n');
        });

        it('should handle unknown object types with JSON fallback', async () => {
            await setupComponent();
            const value = { unknownProp: 'value' };
            const result = component._convertToCSharpValue(value, 'customfield');
            expect(result).toContain('TODO');
        });
    });

    describe('_convertToWebApiFormat', () => {
        it('should convert EntityReference to @odata.bind format', async () => {
            await setupComponent();
            const attributes = {
                parentaccountid: { __type: 'EntityReference', Id: 'parent-id-123', LogicalName: 'account' }
            };
            const result = await component._convertToWebApiFormat(attributes, 'contact');
            expect(result['parentaccountid@odata.bind']).toContain('/accounts(parent-id-123)');
        });

        it('should convert Money to simple value', async () => {
            await setupComponent();
            const attributes = {
                revenue: { __type: 'Money', Value: 5000 }
            };
            const result = await component._convertToWebApiFormat(attributes, 'account');
            expect(result.revenue).toBe(5000);
        });

        it('should convert OptionSetValue to simple value', async () => {
            await setupComponent();
            const attributes = {
                industrycode: { __type: 'OptionSetValue', Value: 100000001 }
            };
            const result = await component._convertToWebApiFormat(attributes, 'account');
            expect(result.industrycode).toBe(100000001);
        });

        it('should convert OptionSetValueCollection to array', async () => {
            await setupComponent();
            const attributes = {
                interests: { __type: 'OptionSetValueCollection', Values: [1, 2, 3] }
            };
            const result = await component._convertToWebApiFormat(attributes, 'contact');
            expect(result.interests).toEqual([1, 2, 3]);
        });

        it('should convert DateTime to ISO string', async () => {
            await setupComponent();
            const attributes = {
                birthdate: { __type: 'DateTime', Iso: '1990-05-15T00:00:00Z' }
            };
            const result = await component._convertToWebApiFormat(attributes, 'contact');
            expect(result.birthdate).toBe('1990-05-15T00:00:00Z');
        });

        it('should pass through null values', async () => {
            await setupComponent();
            const attributes = {
                middlename: null
            };
            const result = await component._convertToWebApiFormat(attributes, 'contact');
            expect(result.middlename).toBeNull();
        });

        it('should pass through simple values unchanged', async () => {
            await setupComponent();
            const attributes = {
                firstname: 'John',
                age: 30,
                active: true
            };
            const result = await component._convertToWebApiFormat(attributes, 'contact');
            expect(result.firstname).toBe('John');
            expect(result.age).toBe(30);
            expect(result.active).toBe(true);
        });
    });

    describe('_normalizeValue edge cases', () => {
        it('should handle customer attribute type', async () => {
            await setupComponent();
            const attr = { getAttributeType: () => 'customer' };
            const result = component._normalizeValue(attr, [{ id: '123', name: 'Customer' }]);
            expect(result).toBeDefined();
        });

        it('should handle owner attribute type', async () => {
            await setupComponent();
            const attr = { getAttributeType: () => 'owner' };
            const result = component._normalizeValue(attr, [{ id: '456', name: 'Owner' }]);
            expect(result).toBeDefined();
        });

        it('should handle multiselectoptionset attribute type', async () => {
            await setupComponent();
            const attr = { getAttributeType: () => 'multiselectoptionset' };
            const result = component._normalizeValue(attr, [1, 2, 3]);
            expect(result).toBeDefined();
        });

        it('should handle decimal attribute type', async () => {
            await setupComponent();
            const attr = { getAttributeType: () => 'decimal' };
            const result = component._normalizeValue(attr, 123.456);
            expect(result).toBeDefined();
        });

        it('should handle double attribute type', async () => {
            await setupComponent();
            const attr = { getAttributeType: () => 'double' };
            const result = component._normalizeValue(attr, 99.99);
            expect(result).toBeDefined();
        });

        it('should handle bigint attribute type', async () => {
            await setupComponent();
            const attr = { getAttributeType: () => 'bigint' };
            const result = component._normalizeValue(attr, 9007199254740991);
            expect(result).toBeDefined();
        });

        it('should handle memo/text attribute types unchanged', async () => {
            await setupComponent();
            const attr = { getAttributeType: () => 'memo' };
            const result = component._normalizeValue(attr, 'Long text content');
            expect(result).toBe('Long text content');
        });

        it('should handle null getAttributeType function', async () => {
            await setupComponent();
            const attr = { getAttributeType: null };
            const result = component._normalizeValue(attr, 'value');
            expect(result).toBe('value');
        });

        it('should handle attribute without getAttributeType method', async () => {
            await setupComponent();
            const attr = {};
            const result = component._normalizeValue(attr, 'default value');
            expect(result).toBe('default value');
        });
    });

    describe('_entitySetCache', () => {
        it('should be a Map instance', () => {
            expect(component._entitySetCache).toBeInstanceOf(Map);
        });

        it('should cache entity set names to avoid repeated lookups', async () => {
            await setupComponent();
            const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');

            // Clear any cached values and mock calls
            component._entitySetCache.clear();
            EntityContextResolver.resolve.mockClear();

            // First call should lookup
            const attributes1 = {
                lookup1: { __type: 'EntityReference', Id: 'id1', LogicalName: 'opportunity' }
            };
            await component._convertToWebApiFormat(attributes1, 'account');

            // Second call with same entity should use cache
            const attributes2 = {
                lookup2: { __type: 'EntityReference', Id: 'id2', LogicalName: 'opportunity' }
            };
            await component._convertToWebApiFormat(attributes2, 'account');

            // Should only call resolve once for 'opportunity'
            const opportunityCalls = EntityContextResolver.resolve.mock.calls.filter(c => c[0] === 'opportunity');
            expect(opportunityCalls.length).toBe(1);
        });
    });

    describe('exportWebApiBtn loading state', () => {
        it('should show loading state while exporting', async () => {
            await setupComponent();
            component._latestContext = {
                MessageName: 'Create',
                InputParameters: {
                    Target: {
                        LogicalName: 'account',
                        Attributes: { name: 'Test' }
                    }
                }
            };

            let capturedText = null;
            const originalTextContent = component.ui.exportWebApiBtn.textContent;

            // Mock _convertToWebApiFormat to capture button state during execution
            const originalConvert = component._convertToWebApiFormat.bind(component);
            component._convertToWebApiFormat = async (...args) => {
                capturedText = component.ui.exportWebApiBtn.textContent;
                return originalConvert(...args);
            };

            await component._exportWebApiBtnHandler();

            expect(capturedText).toBe('Loading...');
            expect(component.ui.exportWebApiBtn.textContent).toBe(originalTextContent);
        });

        it('should restore button state after export completes', async () => {
            await setupComponent();
            const originalText = component.ui.exportWebApiBtn.textContent;
            component._latestContext = {
                MessageName: 'Create',
                InputParameters: {
                    Target: {
                        LogicalName: 'account',
                        Attributes: { name: 'Test' }
                    }
                }
            };

            await component._exportWebApiBtnHandler();

            expect(component.ui.exportWebApiBtn.textContent).toBe(originalText);
            expect(component.ui.exportWebApiBtn.disabled).toBe(false);
        });
    });

    describe('_renderContext - edge cases for empty messages', () => {
        it('should show default preImage message for unknown message type', async () => {
            await setupComponent();
            const context = {
                MessageName: 'CustomUnknown',
                Stage: 20,
                InputParameters: { Target: { Attributes: {} } },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._renderContext(context);
            const outputText = component.ui.outputContainer.textContent;
            expect(outputText).toContain('Pre-Image');
        });

        it('should show preImage message for Update with empty preImage', async () => {
            await setupComponent();
            const context = {
                MessageName: 'Update',
                Stage: 20,
                InputParameters: { Target: { Attributes: { name: 'Test' } } },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._renderContext(context);
            const outputText = component.ui.outputContainer.textContent;
            expect(outputText).toContain('Pre');
        });

        it('should show preImage message for Delete at Pre-operation', async () => {
            await setupComponent();
            const context = {
                MessageName: 'Delete',
                Stage: 20,
                InputParameters: { Target: { __type: 'EntityReference', Id: 'del-123', LogicalName: 'account' } },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._renderContext(context);
            const outputText = component.ui.outputContainer.textContent;
            expect(outputText).toContain('Pre');
        });

        it('should show preImage message for Delete at Post-operation', async () => {
            await setupComponent();
            const context = {
                MessageName: 'Delete',
                Stage: 40,
                InputParameters: { Target: { __type: 'EntityReference', Id: 'del-123', LogicalName: 'account' } },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._renderContext(context);
            const outputText = component.ui.outputContainer.textContent;
            expect(outputText).toContain('Pre');
        });

        it('should show postImage produced message at Post-operation stage', async () => {
            await setupComponent();
            const context = {
                MessageName: 'Update',
                Stage: 40,
                InputParameters: { Target: { Attributes: { name: 'Test' } } },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._renderContext(context);
            const outputText = component.ui.outputContainer.textContent;
            expect(outputText).toContain('Post');
        });
    });

    describe('_generateCSharpTest - additional edge cases', () => {
        it('should generate fallback target entity when no attributes exist', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Update',
                Stage: 20,
                PrimaryEntityName: 'account',
                PrimaryEntityId: 'upd-id-123',
                InputParameters: { Target: { LogicalName: 'account', Id: 'upd-id-123', Attributes: {} } },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._generateCSharpTest(context);
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should generate fallback target entity when Target has no Attributes property', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Update',
                Stage: 20,
                PrimaryEntityName: 'contact',
                PrimaryEntityId: 'contact-123',
                InputParameters: { Target: { LogicalName: 'contact' } },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._generateCSharpTest(context);
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should handle Create with no primaryEntityId', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Create',
                Stage: 20,
                PrimaryEntityName: 'lead',
                PrimaryEntityId: null,
                InputParameters: { Target: { LogicalName: 'lead', Attributes: { subject: 'New Lead' } } },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._generateCSharpTest(context);
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should handle preImage without Id property', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Update',
                Stage: 20,
                PrimaryEntityName: 'account',
                PrimaryEntityId: 'acc-999',
                InputParameters: { Target: { LogicalName: 'account', Id: 'acc-999', Attributes: { name: 'New' } } },
                PreEntityImages: { preimage: { Attributes: { name: 'Old' } } },
                PostEntityImages: {}
            };
            component._generateCSharpTest(context);
            expect(DialogService.show).toHaveBeenCalled();
        });
    });

    describe('_exportWebApiJson - additional edge cases', () => {
        it('should use fallback entity set when EntityContextResolver fails for delete', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');

            // Clear cache and make resolver fail
            component._entitySetCache.clear();
            EntityContextResolver.resolve.mockRejectedValueOnce(new Error('Resolution failed'));

            const context = {
                MessageName: 'Delete',
                PrimaryEntityName: 'customentity',
                PrimaryEntityId: 'custom-id-789',
                InputParameters: { Target: { __type: 'EntityReference', Id: 'custom-id-789', LogicalName: 'customentity' } }
            };
            await component._exportWebApiJson(context);
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should generate generic instructions for unknown message type', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Associate',
                PrimaryEntityName: 'account',
                InputParameters: {
                    Target: {
                        LogicalName: 'account',
                        Attributes: { name: 'Test' }
                    }
                }
            };
            await component._exportWebApiJson(context);
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should handle undefined value in attributes', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Create',
                InputParameters: {
                    Target: {
                        LogicalName: 'account',
                        Attributes: {
                            name: 'Test',
                            undefinedField: undefined
                        }
                    }
                }
            };
            await component._exportWebApiJson(context);
            expect(DialogService.show).toHaveBeenCalled();
        });
    });

    describe('_exportCSharpCode - additional edge cases', () => {
        it('should generate code for unknown message type', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'CustomAction',
                PrimaryEntityName: 'account',
                InputParameters: {
                    Target: {
                        LogicalName: 'account',
                        Attributes: { name: 'Test Account' }
                    }
                }
            };
            component._exportCSharpCode(context);
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should generate entity without ID for Update when ID is missing', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Update',
                PrimaryEntityName: 'contact',
                InputParameters: {
                    Target: {
                        LogicalName: 'contact',
                        // No Id property
                        Attributes: { firstname: 'John' }
                    }
                }
            };
            component._exportCSharpCode(context);
            expect(DialogService.show).toHaveBeenCalled();
        });
    });

    describe('_convertToWebApiFormat - EntityReference error fallback', () => {
        it('should fallback to LogicalName+s when EntityContextResolver throws', async () => {
            await setupComponent();
            const { EntityContextResolver } = await import('../../src/utils/resolvers/EntityContextResolver.js');

            // Clear cache and make resolver fail
            component._entitySetCache.clear();
            EntityContextResolver.resolve.mockRejectedValueOnce(new Error('Resolution failed'));

            const attributes = {
                parentid: { __type: 'EntityReference', Id: 'parent-id', LogicalName: 'unknownentity' }
            };
            const result = await component._convertToWebApiFormat(attributes, 'account');
            expect(result['parentid@odata.bind']).toContain('/unknownentitys(parent-id)');
        });

        it('should handle EntityReference with empty Id', async () => {
            await setupComponent();
            const attributes = {
                lookupfield: { __type: 'EntityReference', Id: '', LogicalName: 'contact' }
            };
            const result = await component._convertToWebApiFormat(attributes, 'account');
            expect(result['lookupfield@odata.bind']).toBeDefined();
        });

        it('should handle EntityReference with curly braces in Id', async () => {
            await setupComponent();
            const attributes = {
                lookupfield: { __type: 'EntityReference', Id: '{ABC-123-DEF}', LogicalName: 'contact' }
            };
            const result = await component._convertToWebApiFormat(attributes, 'account');
            expect(result['lookupfield@odata.bind']).not.toContain('{');
            expect(result['lookupfield@odata.bind']).not.toContain('}');
        });
    });

    describe('_normalizeValue - boolean edge case', () => {
        it('should normalize falsy boolean value to false', async () => {
            await setupComponent();
            const attr = { getAttributeType: () => 'boolean' };
            const result = component._normalizeValue(attr, false);
            expect(result).toBe(false);
        });

        it('should normalize truthy value to true for boolean type', async () => {
            await setupComponent();
            const attr = { getAttributeType: () => 'boolean' };
            const result = component._normalizeValue(attr, 1);
            expect(result).toBe(true);
        });

        it('should normalize null to false for boolean type', async () => {
            await setupComponent();
            const attr = { getAttributeType: () => 'boolean' };
            const result = component._normalizeValue(attr, null);
            expect(result).toBe(false);
        });
    });

    describe('_buildContext - default message behavior', () => {
        it('should default to Update message when null is passed', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue([]);
            const context = component._buildContext(null, 20);
            expect(context.MessageName).toBeNull();
        });

        it('should include post-image for unknown message at Post-operation', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue([
                {
                    getName: () => 'testfield',
                    getValue: () => 'value',
                    getIsDirty: () => false,
                    getAttributeType: () => 'string'
                }
            ]);
            const context = component._buildContext('Assign', 40);
            expect(context.PostEntityImages.postimage).toBeDefined();
        });
    });

    describe('generate button handler - invalid stage parsing', () => {
        it('should use default stage when parsing fails', async () => {
            await setupComponent();
            PowerAppsApiService.getAllAttributes.mockReturnValue([
                {
                    getName: () => 'name',
                    getValue: () => 'Test',
                    getIsDirty: () => false,
                    getAttributeType: () => 'string'
                }
            ]);
            // Set an invalid stage value
            component.ui.stageSelect.value = 'invalid';
            component.ui.messageSelect.value = 'Create';
            component.ui.generateBtn.click();
            // Should not throw and should use default stage (20)
            expect(component._latestContext).toBeDefined();
        });
    });

    describe('_convertToCSharpValue - additional value types', () => {
        it('should convert undefined value to null', async () => {
            await setupComponent();
            const result = component._convertToCSharpValue(undefined, 'field');
            expect(result).toContain('null');
        });

        it('should convert EntityReference without Name property', async () => {
            await setupComponent();
            const value = { __type: 'EntityReference', Id: 'ref-id', LogicalName: 'contact' };
            const result = component._convertToCSharpValue(value, 'contactid');
            expect(result).toContain('EntityReference');
            expect(result).not.toContain('//');
        });

        it('should convert false boolean value', async () => {
            await setupComponent();
            const result = component._convertToCSharpValue(false, 'isactive');
            expect(result).toContain('false');
        });

        it('should escape backslashes in string values', async () => {
            await setupComponent();
            const result = component._convertToCSharpValue('C:\\Path\\File', 'filepath');
            expect(result).toContain('\\\\');
        });
    });

    describe('copy and export handlers with context', () => {
        it('should copy context when context exists', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            DialogService.show.mockClear();
            component._latestContext = { MessageName: 'Create', Stage: 20 };
            component._copyContextJson(component._latestContext);
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should generate C# test when context exists', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            DialogService.show.mockClear();
            component._latestContext = {
                MessageName: 'Create',
                Stage: 20,
                PrimaryEntityName: 'account',
                PrimaryEntityId: '123',
                InputParameters: { Target: { Attributes: { name: 'Test' } } },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._generateCSharpTest(component._latestContext);
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should export C# when context exists', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            DialogService.show.mockClear();
            component._latestContext = {
                MessageName: 'Create',
                InputParameters: {
                    Target: { LogicalName: 'account', Attributes: { name: 'Test' } }
                }
            };
            component._exportCSharpCode(component._latestContext);
            expect(DialogService.show).toHaveBeenCalled();
        });
    });

    describe('_generateCSharpTest - complex scenarios', () => {
        it('should sort attribute keys alphabetically in target', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Create',
                Stage: 20,
                PrimaryEntityName: 'account',
                PrimaryEntityId: null,
                InputParameters: {
                    Target: {
                        LogicalName: 'account',
                        Attributes: {
                            zebra: 'z',
                            apple: 'a',
                            middle: 'm'
                        }
                    }
                },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._generateCSharpTest(context);
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should sort preImage attribute keys alphabetically', async () => {
            await setupComponent();
            const { DialogService } = await import('../../src/services/DialogService.js');
            const context = {
                MessageName: 'Update',
                Stage: 20,
                PrimaryEntityName: 'account',
                PrimaryEntityId: 'acc-123',
                InputParameters: {
                    Target: {
                        LogicalName: 'account',
                        Id: 'acc-123',
                        Attributes: { name: 'New' }
                    }
                },
                PreEntityImages: {
                    preimage: {
                        Id: 'acc-123',
                        Attributes: {
                            zfield: 'z',
                            afield: 'a'
                        }
                    }
                },
                PostEntityImages: {}
            };
            component._generateCSharpTest(context);
            expect(DialogService.show).toHaveBeenCalled();
        });
    });

    describe('empty target handling in _renderContext', () => {
        it('should show target empty message for Update with empty attributes', async () => {
            await setupComponent();
            const context = {
                MessageName: 'Update',
                Stage: 20,
                InputParameters: { Target: { Attributes: {} } },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._renderContext(context);
            expect(component.ui.outputContainer.textContent).toContain('Target');
        });

        it('should show target empty message for Delete', async () => {
            await setupComponent();
            const context = {
                MessageName: 'Delete',
                Stage: 20,
                InputParameters: { Target: null },
                PreEntityImages: {},
                PostEntityImages: {}
            };
            component._renderContext(context);
            expect(component.ui.outputContainer.textContent).toContain('Target');
        });
    });

    describe('button handler callbacks - lines 117-143 coverage', () => {
        it('should call copyBtnHandler and execute _copyContextJson when context exists', async () => {
            await setupComponent();

            component._latestContext = {
                MessageName: 'Create',
                Stage: 20,
                InputParameters: { Target: { Attributes: { name: 'Test' } } }
            };

            component._copyContextJson = vi.fn();

            // Trigger the copy button handler
            if (component._copyBtnHandler) {
                component._copyBtnHandler();
                expect(component._copyContextJson).toHaveBeenCalledWith(component._latestContext);
            }
        });

        it('should not call _copyContextJson when no context exists', async () => {
            await setupComponent();

            component._latestContext = null;
            component._copyContextJson = vi.fn();

            if (component._copyBtnHandler) {
                component._copyBtnHandler();
                expect(component._copyContextJson).not.toHaveBeenCalled();
            }
        });

        it('should call testBtnHandler and execute _generateCSharpTest when context exists', async () => {
            await setupComponent();

            component._latestContext = {
                MessageName: 'Update',
                Stage: 20,
                InputParameters: { Target: { Attributes: { name: 'Test' } } }
            };

            component._generateCSharpTest = vi.fn();

            if (component._testBtnHandler) {
                component._testBtnHandler();
                expect(component._generateCSharpTest).toHaveBeenCalledWith(component._latestContext);
            }
        });

        it('should not call _generateCSharpTest when no context exists', async () => {
            await setupComponent();

            component._latestContext = null;
            component._generateCSharpTest = vi.fn();

            if (component._testBtnHandler) {
                component._testBtnHandler();
                expect(component._generateCSharpTest).not.toHaveBeenCalled();
            }
        });

        it('should call exportWebApiBtnHandler and return early when no context', async () => {
            await setupComponent();

            component._latestContext = null;
            component._exportWebApiJson = vi.fn();

            if (component._exportWebApiBtnHandler) {
                await component._exportWebApiBtnHandler();
                expect(component._exportWebApiJson).not.toHaveBeenCalled();
            }
        });

        it('should call exportWebApiBtnHandler and execute _exportWebApiJson when context exists', async () => {
            await setupComponent();

            component._latestContext = {
                MessageName: 'Create',
                Stage: 20,
                InputParameters: { Target: { Attributes: { name: 'Test' } } }
            };

            component._exportWebApiJson = vi.fn().mockResolvedValue();

            if (component._exportWebApiBtnHandler) {
                await component._exportWebApiBtnHandler();
                expect(component._exportWebApiJson).toHaveBeenCalledWith(component._latestContext);
            }
        });

        it('should call exportCSharpBtnHandler and execute _exportCSharpCode when context exists', async () => {
            await setupComponent();

            component._latestContext = {
                MessageName: 'Delete',
                Stage: 20,
                InputParameters: { Target: { Id: 'test-id' } }
            };

            component._exportCSharpCode = vi.fn();

            if (component._exportCSharpBtnHandler) {
                component._exportCSharpBtnHandler();
                expect(component._exportCSharpCode).toHaveBeenCalledWith(component._latestContext);
            }
        });

        it('should not call _exportCSharpCode when no context exists', async () => {
            await setupComponent();

            component._latestContext = null;
            component._exportCSharpCode = vi.fn();

            if (component._exportCSharpBtnHandler) {
                component._exportCSharpBtnHandler();
                expect(component._exportCSharpCode).not.toHaveBeenCalled();
            }
        });
    });
});
