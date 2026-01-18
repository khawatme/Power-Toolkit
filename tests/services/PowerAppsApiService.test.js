/**
 * @file Tests for PowerAppsApiService
 * @module tests/services/PowerAppsApiService.test.js
 * @description Test suite for Xrm API wrapper and form context access
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Helper to create a complete Xrm mock with form context
const createFullXrmMock = (options = {}) => {
    const formType = options.formType ?? 2; // 2 = Update form by default
    return {
        Page: {
            data: {
                entity: {
                    getEntityName: vi.fn(() => options.entityName || 'contact'),
                    getId: vi.fn(() => options.entityId || '{12345678-1234-1234-1234-123456789012}'),
                    attributes: {
                        get: vi.fn(() => options.attributes || [])
                    }
                },
                refresh: vi.fn(() => Promise.resolve()),
            },
            ui: {
                getFormType: vi.fn(() => formType),
                form: {
                    getId: vi.fn(() => options.formId || '{form-id-1234}'),
                },
                controls: {
                    get: vi.fn(() => options.controls || [])
                },
                tabs: {
                    get: vi.fn(() => options.tabs || [])
                }
            },
            getAttribute: vi.fn((name) => ({
                getName: vi.fn(() => name),
                getValue: vi.fn(() => 'test value')
            })),
            getControl: vi.fn((name) => ({
                getName: vi.fn(() => name),
                getVisible: vi.fn(() => true)
            }))
        },
        Utility: {
            getGlobalContext: vi.fn(() => ({
                getClientUrl: vi.fn(() => 'https://org.crm.dynamics.com'),
                getVersion: vi.fn(() => '9.2.0.0'),
                userSettings: {
                    userId: '{user-id-1234}',
                    userName: 'Test User',
                    languageId: 1033,
                },
                organizationSettings: {
                    uniqueName: 'testorg',
                },
                client: {
                    getClient: vi.fn(() => 'Web'),
                    getFormFactor: vi.fn(() => 1),
                },
            })),
        },
        WebApi: {
            online: {
                retrieveMultipleRecords: vi.fn(() => Promise.resolve({ entities: [] })),
                retrieveRecord: vi.fn(() => Promise.resolve({})),
                createRecord: vi.fn(() => Promise.resolve({ id: '12345678-1234-1234-1234-123456789012' })),
                updateRecord: vi.fn(() => Promise.resolve({})),
                deleteRecord: vi.fn(() => Promise.resolve({})),
            },
        },
    };
};

// Store original Xrm to restore after each test
let originalXrm;

describe('PowerAppsApiService', () => {
    let PowerAppsApiService;

    beforeEach(async () => {
        // Save original
        originalXrm = global.Xrm;
        // Set up full Xrm mock with valid form context
        global.Xrm = createFullXrmMock();
        global.GetGlobalContext = vi.fn(() => global.Xrm.Utility.getGlobalContext());

        vi.resetModules();
        const module = await import('../../src/services/PowerAppsApiService.js');
        PowerAppsApiService = module.PowerAppsApiService;
    });

    afterEach(() => {
        // Restore original Xrm
        global.Xrm = originalXrm;
    });

    describe('isFormContextAvailable', () => {
        it('should return true when Xrm.Page is available', async () => {
            expect(PowerAppsApiService.isFormContextAvailable).toBe(true);
        });

        it('should return false when Xrm.Page is not available', async () => {
            global.Xrm = {};

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.isFormContextAvailable).toBe(false);
        });

        it('should return false when Xrm.Page.data is missing', async () => {
            global.Xrm = { Page: { ui: { getFormType: () => 2 } } };

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.isFormContextAvailable).toBe(false);
        });

        it('should return false when formType is 0 (undefined form)', async () => {
            global.Xrm = createFullXrmMock({ formType: 0 });

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.isFormContextAvailable).toBe(false);
        });
    });

    describe('getFormContext', () => {
        it('should return Xrm.Page when available', async () => {
            const formContext = PowerAppsApiService.getFormContext();
            expect(formContext).toBeTruthy();
            expect(formContext).toBe(global.Xrm.Page);
        });

        it('should return null when form context is not available', async () => {
            global.Xrm = {};

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            const formContext = service.getFormContext();
            expect(formContext).toBeNull();
        });
    });

    describe('getGlobalContext', () => {
        it('should return global context from Xrm.Utility', () => {
            const context = PowerAppsApiService.getGlobalContext();
            expect(context).toBeDefined();
            expect(context.getClientUrl).toBeDefined();
        });
    });

    describe('getEntityName', () => {
        it('should return current form entity name', () => {
            const entityName = PowerAppsApiService.getEntityName();
            expect(entityName).toBe('contact');
        });

        it('should return null when form context is not available', async () => {
            global.Xrm = {};

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            const entityName = service.getEntityName();
            expect(entityName).toBeNull();
        });
    });

    describe('getEntityId', () => {
        it('should return current record ID', () => {
            const entityId = PowerAppsApiService.getEntityId();
            expect(entityId).toBeTruthy();
        });
    });

    describe('getFormType', () => {
        it('should return form type when on a form', () => {
            const formType = PowerAppsApiService.getFormType();
            expect(formType).toBe(2); // Update form
        });

        it('should return 0 when not on a form', async () => {
            global.Xrm = {};

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            const formType = service.getFormType();
            expect(formType).toBe(0);
        });
    });

    describe('getAllAttributes', () => {
        it('should retrieve form attributes', () => {
            const attributes = PowerAppsApiService.getAllAttributes();
            expect(Array.isArray(attributes)).toBe(true);
        });

        it('should return empty array when not on form', async () => {
            global.Xrm = {};

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            const attributes = service.getAllAttributes();
            expect(Array.isArray(attributes)).toBe(true);
            expect(attributes).toHaveLength(0);
        });
    });

    describe('getAllControls', () => {
        it('should retrieve form controls', () => {
            const controls = PowerAppsApiService.getAllControls();
            expect(Array.isArray(controls)).toBe(true);
        });
    });

    describe('getAllTabs', () => {
        it('should retrieve form tabs', () => {
            const tabs = PowerAppsApiService.getAllTabs();
            expect(Array.isArray(tabs)).toBe(true);
        });

        it('should return empty array when not on form', async () => {
            global.Xrm = {};

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            const tabs = service.getAllTabs();
            expect(Array.isArray(tabs)).toBe(true);
            expect(tabs).toHaveLength(0);
        });
    });

    describe('getFormId', () => {
        it('should return form ID when on a form', () => {
            const formId = PowerAppsApiService.getFormId();
            expect(formId).toBeTruthy();
        });

        it('should return null when not on a form', async () => {
            global.Xrm = {};

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            const formId = service.getFormId();
            expect(formId).toBeNull();
        });
    });

    describe('refreshForm', () => {
        it('should call refresh with save parameter when on form', async () => {
            await PowerAppsApiService.refreshForm(true);
            expect(global.Xrm.Page.data.refresh).toHaveBeenCalled();
        });

        it('should return resolved promise when not on form', async () => {
            global.Xrm = {};

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            const result = await service.refreshForm(true);
            expect(result).toBeUndefined();
        });
    });

    describe('event handlers', () => {
        it('should add onLoad handler when on form', () => {
            global.Xrm.Page.data.addOnLoad = vi.fn();
            const handler = vi.fn();

            PowerAppsApiService.addOnLoad(handler);
            expect(global.Xrm.Page.data.addOnLoad).toHaveBeenCalledWith(handler);
        });

        it('should not add onLoad handler when not on form', async () => {
            global.Xrm = {};

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            const handler = vi.fn();
            expect(() => service.addOnLoad(handler)).not.toThrow();
        });

        it('should remove onLoad handler when on form', () => {
            global.Xrm.Page.data.removeOnLoad = vi.fn();
            const handler = vi.fn();

            PowerAppsApiService.removeOnLoad(handler);
            expect(global.Xrm.Page.data.removeOnLoad).toHaveBeenCalledWith(handler);
        });

        it('should not throw when removing onLoad handler when not on form', async () => {
            global.Xrm = {};

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            const handler = vi.fn();
            expect(() => service.removeOnLoad(handler)).not.toThrow();
        });

        it('should add onSave handler when on form', () => {
            global.Xrm.Page.data.entity.addOnSave = vi.fn();
            const handler = vi.fn();

            PowerAppsApiService.addOnSave(handler);
            expect(global.Xrm.Page.data.entity.addOnSave).toHaveBeenCalledWith(handler);
        });

        it('should not add onSave handler when not on form', async () => {
            global.Xrm = {};

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            const handler = vi.fn();
            expect(() => service.addOnSave(handler)).not.toThrow();
        });

        it('should remove onSave handler when on form', () => {
            global.Xrm.Page.data.entity.removeOnSave = vi.fn();
            const handler = vi.fn();

            PowerAppsApiService.removeOnSave(handler);
            expect(global.Xrm.Page.data.entity.removeOnSave).toHaveBeenCalledWith(handler);
        });

        it('should not throw when removing onSave handler when not on form', async () => {
            global.Xrm = {};

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            const handler = vi.fn();
            expect(() => service.removeOnSave(handler)).not.toThrow();
        });
    });

    describe('getPerformanceInfo', () => {
        it('should return performance info when available', () => {
            window.Xrm = {
                Performance: {
                    getPerformanceInfo: vi.fn(() => ({ totalTime: 1000 }))
                }
            };

            const info = PowerAppsApiService.getPerformanceInfo();
            expect(info).toEqual({ totalTime: 1000 });
        });

        it('should return undefined when performance API is not available', () => {
            window.Xrm = {};

            const info = PowerAppsApiService.getPerformanceInfo();
            expect(info).toBeUndefined();
        });
    });

    describe('getEntityMetadata', () => {
        it('should call Xrm.Utility.getEntityMetadata', async () => {
            global.Xrm.Utility.getEntityMetadata = vi.fn(() => Promise.resolve({ LogicalName: 'account' }));

            const metadata = await PowerAppsApiService.getEntityMetadata('account');
            expect(global.Xrm.Utility.getEntityMetadata).toHaveBeenCalledWith('account', []);
            expect(metadata).toEqual({ LogicalName: 'account' });
        });
    });


    describe('_getCorrectXrmContext - iframe fallback', () => {
        it('should return Xrm from current window when Xrm.Page.data exists', async () => {
            // This tests line 44 - the fallback return Xrm statement
            global.Xrm = createFullXrmMock();

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            // The context should be found and methods should work
            expect(service.isFormContextAvailable).toBe(true);
            expect(service.getEntityName()).toBe('contact');
        });

        it('should search through iframes when current window Xrm.Page.data is missing', async () => {
            // Set up Xrm without Page.data in main window
            global.Xrm = { Utility: { getGlobalContext: vi.fn() } };

            // Mock window.frames with an iframe that has valid Xrm context
            const iframeXrm = createFullXrmMock({ entityName: 'account' });
            const mockFrames = [{ Xrm: iframeXrm }];
            Object.defineProperty(window, 'frames', {
                value: mockFrames,
                writable: true,
                configurable: true
            });
            mockFrames.length = 1;

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.isFormContextAvailable).toBe(true);
            expect(service.getEntityName()).toBe('account');
        });

        it('should ignore iframes with cross-origin errors and continue searching', async () => {
            // Set up Xrm without valid Page.data
            global.Xrm = { Utility: { getGlobalContext: vi.fn() } };

            // Mock frames - first throws error, which should be caught and ignored
            const mockFrames = {
                length: 1,
                0: {
                    get Xrm() {
                        throw new DOMException('Blocked by CORS');
                    }
                }
            };
            Object.defineProperty(window, 'frames', {
                value: mockFrames,
                writable: true,
                configurable: true
            });

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            // Should not throw, but form context won't be available
            // This tests that cross-origin errors are caught (line 30)
            expect(service.isFormContextAvailable).toBe(false);
        });

        it('should fallback to base Xrm when no valid form context found in any frame', async () => {
            // Set up base Xrm without full form context (for views/dashboards)
            global.Xrm = {
                Utility: {
                    getGlobalContext: vi.fn(() => ({ getClientUrl: () => 'https://test.crm.dynamics.com' })),
                    getEntityMetadata: vi.fn(() => Promise.resolve({}))
                }
            };

            // No frames with valid context
            Object.defineProperty(window, 'frames', {
                value: { length: 0 },
                writable: true,
                configurable: true
            });

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            // Should fallback but form context unavailable
            expect(service.isFormContextAvailable).toBe(false);
            // But getGlobalContext should still work via the base Xrm
            expect(service.getGlobalContext()).toBeDefined();
        });
    });

    describe('isFormContextAvailable - exception handling', () => {
        it('should return false when getFormType throws an error', async () => {
            // Create mock that throws when accessing getFormType
            global.Xrm = {
                Page: {
                    data: {},
                    ui: {
                        getFormType: () => {
                            throw new Error('Form type not available');
                        }
                    }
                }
            };

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.isFormContextAvailable).toBe(false);
        });

        it('should return false when Page.ui throws during access', async () => {
            global.Xrm = {
                Page: {
                    data: {},
                    get ui() {
                        throw new Error('UI access denied');
                    }
                }
            };

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.isFormContextAvailable).toBe(false);
        });

        it('should return false when any property in the chain throws', async () => {
            global.Xrm = {
                get Page() {
                    throw new Error('Page not accessible');
                }
            };

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.isFormContextAvailable).toBe(false);
        });
    });

    describe('getEntityId - empty ID handling', () => {
        it('should return default empty string when form context is not available', async () => {
            // This specifically tests line 89 - the early return when isFormContextAvailable is false
            global.Xrm = {};

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.getEntityId()).toBe('');
        });

        it('should return empty string when entity getId returns empty string', async () => {
            // Need to set entityId directly on the mock's function to override default
            global.Xrm = createFullXrmMock();
            global.Xrm.Page.data.entity.getId = vi.fn(() => '');

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.getEntityId()).toBe('');
        });

        it('should return empty string when entity getId returns null', async () => {
            global.Xrm = createFullXrmMock();
            global.Xrm.Page.data.entity.getId = vi.fn(() => null);

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.getEntityId()).toBe('');
        });

        it('should return empty string when entity getId returns undefined', async () => {
            global.Xrm = createFullXrmMock();
            global.Xrm.Page.data.entity.getId = vi.fn(() => undefined);

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.getEntityId()).toBe('');
        });

        it('should normalize valid GUID correctly', async () => {
            global.Xrm = createFullXrmMock({ entityId: '{ABCD1234-5678-90AB-CDEF-1234567890AB}' });

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            const entityId = service.getEntityId();
            expect(entityId).toBe('abcd1234-5678-90ab-cdef-1234567890ab');
        });
    });

    describe('getFormContext - error handling', () => {
        it('should return null and log error when getFormContext throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            // We need to make the isFormContextAvailable check pass,
            // but then _getCorrectXrmContext().Page throw in the same call
            // Use Object.defineProperty to make isFormContextAvailable return true
            // while Page access throws

            global.Xrm = createFullXrmMock();

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            // Override the isFormContextAvailable getter to return true
            // and then make Page throw on next access
            Object.defineProperty(service, 'isFormContextAvailable', {
                get: () => {
                    // Make Xrm.Page throw on next access
                    Object.defineProperty(global.Xrm, 'Page', {
                        get() {
                            throw new Error('Page context corrupted');
                        },
                        configurable: true
                    });
                    return true;
                },
                configurable: true
            });

            const result = service.getFormContext();
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should catch and handle runtime exceptions in getFormContext', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            // Set up Xrm that will cause issues during getFormContext
            global.Xrm = {
                Page: {
                    data: {
                        entity: {}
                    },
                    ui: {
                        getFormType: () => 2,
                        form: { getId: () => '{form-id}' }
                    }
                },
                Utility: { getGlobalContext: vi.fn() }
            };

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            // Make the Page getter throw after first access
            let accessCount = 0;
            Object.defineProperty(global.Xrm, 'Page', {
                get() {
                    accessCount++;
                    if (accessCount > 2) {
                        throw new Error('Context invalidated');
                    }
                    return {
                        data: { entity: {} },
                        ui: { getFormType: () => 2, form: { getId: () => '{form-id}' } }
                    };
                },
                configurable: true
            });

            const result = service.getFormContext();
            // Should handle gracefully
            expect(result === null || result !== undefined).toBe(true);

            consoleSpy.mockRestore();
        });
    });

    describe('getFormId - edge cases', () => {
        it('should return null when form.getId returns null', async () => {
            global.Xrm = createFullXrmMock();
            global.Xrm.Page.ui.form.getId = vi.fn(() => null);

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.getFormId()).toBeNull();
        });

        it('should return null when form.getId returns empty string', async () => {
            global.Xrm = createFullXrmMock();
            global.Xrm.Page.ui.form.getId = vi.fn(() => '');

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.getFormId()).toBeNull();
        });

        it('should return null when ui.form is undefined', async () => {
            global.Xrm = createFullXrmMock();
            global.Xrm.Page.ui.form = undefined;

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.getFormId()).toBeNull();
        });

        it('should normalize form ID with braces', async () => {
            global.Xrm = createFullXrmMock({ formId: '{ABCD-1234-EFGH}' });

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            const formId = service.getFormId();
            expect(formId).not.toContain('{');
            expect(formId).not.toContain('}');
        });
    });

    describe('getAllControls - edge cases', () => {
        it('should return empty array when not on form', async () => {
            global.Xrm = {};

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            const controls = service.getAllControls();
            expect(Array.isArray(controls)).toBe(true);
            expect(controls).toHaveLength(0);
        });

        it('should return controls array when on form', async () => {
            const mockControls = [
                { getName: () => 'firstname' },
                { getName: () => 'lastname' }
            ];
            global.Xrm = createFullXrmMock({ controls: mockControls });

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            const controls = service.getAllControls();
            expect(controls).toHaveLength(2);
        });
    });

    describe('refreshForm - various scenarios', () => {
        it('should pass false to refresh when save is false', async () => {
            global.Xrm = createFullXrmMock();

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            await service.refreshForm(false);
            expect(global.Xrm.Page.data.refresh).toHaveBeenCalledWith(false);
        });

        it('should handle refresh rejection gracefully', async () => {
            global.Xrm = createFullXrmMock();
            global.Xrm.Page.data.refresh = vi.fn(() => Promise.reject(new Error('Refresh failed')));

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            await expect(service.refreshForm(true)).rejects.toThrow('Refresh failed');
        });
    });

    describe('getPerformanceInfo - additional edge cases', () => {
        it('should return undefined when Xrm.Performance is undefined', () => {
            window.Xrm = { Performance: undefined };

            const info = PowerAppsApiService.getPerformanceInfo();
            expect(info).toBeUndefined();
        });

        it('should return performance data with all metrics', () => {
            const perfData = {
                totalTime: 1500,
                formLoadTime: 800,
                networkTime: 300,
                renderTime: 400
            };
            window.Xrm = {
                Performance: {
                    getPerformanceInfo: vi.fn(() => perfData)
                }
            };

            const info = PowerAppsApiService.getPerformanceInfo();
            expect(info).toEqual(perfData);
            expect(info.totalTime).toBe(1500);
        });
    });

    describe('Multiple form types', () => {
        it('should return correct form type for CREATE form', async () => {
            global.Xrm = createFullXrmMock({ formType: 1 });

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.getFormType()).toBe(1);
        });

        it('should return correct form type for READ_ONLY form', async () => {
            global.Xrm = createFullXrmMock({ formType: 3 });

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.getFormType()).toBe(3);
        });

        it('should return correct form type for QUICK_CREATE form', async () => {
            global.Xrm = createFullXrmMock({ formType: 5 });

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.getFormType()).toBe(5);
        });

        it('should return correct form type for BULK_EDIT form', async () => {
            global.Xrm = createFullXrmMock({ formType: 6 });

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.getFormType()).toBe(6);
        });
    });

    describe('getEntityMetadata - error handling', () => {
        it('should propagate errors from getEntityMetadata', async () => {
            global.Xrm.Utility.getEntityMetadata = vi.fn(() =>
                Promise.reject(new Error('Entity not found'))
            );

            await expect(PowerAppsApiService.getEntityMetadata('nonexistent'))
                .rejects.toThrow('Entity not found');
        });

        it('should work with different entity names', async () => {
            global.Xrm.Utility.getEntityMetadata = vi.fn((name) =>
                Promise.resolve({ LogicalName: name, DisplayName: name.toUpperCase() })
            );

            const metadata = await PowerAppsApiService.getEntityMetadata('opportunity');
            expect(global.Xrm.Utility.getEntityMetadata).toHaveBeenCalledWith('opportunity', []);
            expect(metadata.LogicalName).toBe('opportunity');
        });
    });

    describe('Window frames edge cases', () => {
        it('should handle empty frames array', async () => {
            global.Xrm = { Utility: { getGlobalContext: vi.fn() } };
            Object.defineProperty(window, 'frames', {
                value: { length: 0 },
                writable: true,
                configurable: true
            });

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.isFormContextAvailable).toBe(false);
        });

        it('should handle frames with null Xrm', async () => {
            global.Xrm = { Utility: { getGlobalContext: vi.fn() } };
            const mockFrames = {
                length: 1,
                0: { Xrm: null }
            };
            Object.defineProperty(window, 'frames', {
                value: mockFrames,
                writable: true,
                configurable: true
            });

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.isFormContextAvailable).toBe(false);
        });

        it('should handle frames with Xrm but no Page', async () => {
            global.Xrm = { Utility: { getGlobalContext: vi.fn() } };
            const mockFrames = {
                length: 1,
                0: { Xrm: { Utility: {} } }
            };
            Object.defineProperty(window, 'frames', {
                value: mockFrames,
                writable: true,
                configurable: true
            });

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.isFormContextAvailable).toBe(false);
        });

        it('should handle frames with Xrm.Page but no data', async () => {
            global.Xrm = { Utility: { getGlobalContext: vi.fn() } };
            const mockFrames = {
                length: 1,
                0: { Xrm: { Page: { ui: {} } } }
            };
            Object.defineProperty(window, 'frames', {
                value: mockFrames,
                writable: true,
                configurable: true
            });

            vi.resetModules();
            const module = await import('../../src/services/PowerAppsApiService.js');
            const service = module.PowerAppsApiService;

            expect(service.isFormContextAvailable).toBe(false);
        });
    });
});
