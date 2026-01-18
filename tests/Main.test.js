/**
 * @file Tests for Main module
 * @module tests/Main
 * @description Comprehensive tests for the application entry point and initialization logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Create module-level variables to track mock state
let appInitCalled = false;
let appInitCallCount = 0;

// Mock dependencies BEFORE any imports
vi.mock('../src/App.js', () => ({
    App: {
        init: vi.fn(() => {
            appInitCalled = true;
            appInitCallCount++;
        })
    }
}));

// Import Config for access to constants
import { Config } from '../src/constants/index.js';
import { App } from '../src/App.js';

describe('Main', () => {
    // Store original Xrm
    let originalXrm;
    let originalAlert;
    let originalConsoleError;

    beforeEach(() => {
        // Reset tracking variables
        appInitCalled = false;
        appInitCallCount = 0;
        vi.clearAllMocks();

        // Store originals
        originalXrm = global.Xrm;
        originalAlert = global.alert;
        originalConsoleError = console.error;

        // Reset window flags
        delete window[Config.MAIN.windowInitializedFlag];
        delete window[Config.MAIN.windowVersionFlag];

        // Mock alert
        global.alert = vi.fn();
        console.error = vi.fn();

        // Clear DOM
        document.body.innerHTML = '';

        // Reset timers
        vi.useFakeTimers();
    });

    afterEach(() => {
        // Restore originals
        global.Xrm = originalXrm;
        global.alert = originalAlert;
        console.error = originalConsoleError;

        // Clean up flags
        delete window[Config.MAIN.windowInitializedFlag];
        delete window[Config.MAIN.windowVersionFlag];

        // Clear DOM
        document.body.innerHTML = '';

        // Restore timers
        vi.useRealTimers();
        vi.clearAllTimers();
    });

    describe('singleton check', () => {
        it('should prevent reinitialization when already initialized with same version', async () => {
            // Set up as if already initialized
            window[Config.MAIN.windowInitializedFlag] = true;
            window[Config.MAIN.windowVersionFlag] = Config.TOOL_VERSION;

            // Create existing dialog
            const existingDialog = document.createElement('div');
            existingDialog.className = Config.MAIN.appContainerClass;
            existingDialog.style.display = 'none';
            document.body.appendChild(existingDialog);

            // Dynamically import to trigger IIFE
            vi.resetModules();
            await import('../src/Main.js');

            // Dialog should be shown
            expect(existingDialog.style.display).toBe('flex');

            // App.init should NOT be called (singleton check prevents it)
            expect(App.init).not.toHaveBeenCalled();
        });

        it('should remove existing container when version changes', async () => {
            // Set up with old version
            window[Config.MAIN.windowInitializedFlag] = true;
            window[Config.MAIN.windowVersionFlag] = '0.0.1'; // Old version

            // Create existing dialog
            const existingDialog = document.createElement('div');
            existingDialog.className = Config.MAIN.appContainerClass;
            document.body.appendChild(existingDialog);

            // Set up Xrm for successful init
            global.Xrm = {
                Page: {
                    data: {},
                    ui: {
                        getFormType: () => 2
                    }
                },
                Utility: {}
            };

            // Reset modules and import
            vi.resetModules();
            await import('../src/Main.js');

            // Old container should be removed
            expect(document.querySelector(`.${Config.MAIN.appContainerClass}`)).toBeNull();

            // Version flag should be updated
            expect(window[Config.MAIN.windowVersionFlag]).toBe(Config.TOOL_VERSION);
        });
    });

    describe('Xrm polling mechanism', () => {
        it('should poll for Xrm object when not immediately available', async () => {
            // Start with no Xrm
            delete global.Xrm;

            // Reset modules
            vi.resetModules();
            const importPromise = import('../src/Main.js');

            // Advance timer for first poll
            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

            // Still no Xrm, should not have called App.init
            expect(App.init).not.toHaveBeenCalled();

            // Now make Xrm available
            global.Xrm = {
                Page: {
                    data: {},
                    ui: {
                        getFormType: () => 2
                    }
                },
                Utility: {}
            };

            // Advance timer for next poll
            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

            // Should have called App.init
            expect(App.init).toHaveBeenCalled();
        });

        it('should show error after max polling attempts', async () => {
            // No Xrm available
            delete global.Xrm;

            // Reset modules
            vi.resetModules();
            const importPromise = import('../src/Main.js');

            // Advance past all polling attempts
            const totalPollingTime = Config.MAIN.pollingInterval * (Config.MAIN.maxPollingAttempts + 1);
            await vi.advanceTimersByTimeAsync(totalPollingTime);

            // Should have shown error alert
            expect(global.alert).toHaveBeenCalledWith(Config.MAIN.errors.xrmNotFound);
            expect(console.error).toHaveBeenCalledWith(Config.MAIN.errors.xrmNotFound);
        });

        it('should stop polling once Xrm is found', async () => {
            // Start with Xrm available
            global.Xrm = {
                Page: {
                    data: {},
                    ui: {
                        getFormType: () => 2
                    }
                },
                Utility: {}
            };

            vi.resetModules();
            await import('../src/Main.js');

            // Advance timer
            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

            // App.init should have been called exactly once
            expect(App.init).toHaveBeenCalledTimes(1);

            // Advance more time - should not call again
            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval * 5);
            expect(App.init).toHaveBeenCalledTimes(1);
        });
    });

    describe('safeInitialize function', () => {
        describe('when Xrm.Page.data exists with loaded form', () => {
            it('should initialize immediately when form type > 0', async () => {
                global.Xrm = {
                    Page: {
                        data: {},
                        ui: {
                            getFormType: () => 2 // Update form
                        }
                    },
                    Utility: {}
                };

                vi.resetModules();
                await import('../src/Main.js');

                await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

                expect(App.init).toHaveBeenCalled();
            });

            it('should wait for OnLoad when form type is 0', async () => {
                const onLoadHandlers = [];

                global.Xrm = {
                    Page: {
                        data: {
                            addOnLoad: vi.fn((handler) => {
                                onLoadHandlers.push(handler);
                            }),
                            removeOnLoad: vi.fn()
                        },
                        ui: {
                            getFormType: () => 0 // Undefined form type
                        }
                    },
                    Utility: {}
                };

                vi.resetModules();
                await import('../src/Main.js');

                await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

                // Should have registered onLoad handler
                expect(global.Xrm.Page.data.addOnLoad).toHaveBeenCalled();

                // App.init should not be called yet
                expect(App.init).not.toHaveBeenCalled();

                // Simulate OnLoad event
                onLoadHandlers.forEach(handler => handler());

                // Now App.init should be called
                expect(App.init).toHaveBeenCalled();
            });

            it('should remove OnLoad handler after initialization', async () => {
                let registeredHandler = null;

                global.Xrm = {
                    Page: {
                        data: {
                            addOnLoad: vi.fn((handler) => {
                                registeredHandler = handler;
                            }),
                            removeOnLoad: vi.fn()
                        },
                        ui: {
                            getFormType: () => 0
                        }
                    },
                    Utility: {}
                };

                vi.resetModules();
                await import('../src/Main.js');

                await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

                // Call the registered handler
                if (registeredHandler) {
                    registeredHandler();
                }

                // Handler should be removed
                expect(global.Xrm.Page.data.removeOnLoad).toHaveBeenCalled();
            });
        });

        describe('when only Xrm.Utility exists (non-form page)', () => {
            it('should initialize with delay', async () => {
                global.Xrm = {
                    Utility: {}
                };

                vi.resetModules();
                await import('../src/Main.js');

                // Initial poll finds Xrm
                await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

                // App.init not called yet due to delay
                expect(App.init).not.toHaveBeenCalled();

                // Wait for the init delay
                await vi.advanceTimersByTimeAsync(Config.MAIN.initDelay);

                // Now should be called
                expect(App.init).toHaveBeenCalled();
            });
        });

        describe('when Xrm exists but no usable context', () => {
            it('should throw error when Xrm has no Page or Utility', async () => {
                global.Xrm = {};

                vi.resetModules();
                await import('../src/Main.js');

                await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

                // Should show error
                expect(console.error).toHaveBeenCalledWith(
                    Config.MAIN.errors.startupFailed,
                    expect.any(Error)
                );
                expect(global.alert).toHaveBeenCalled();
            });

            it('should show startup error alert with message', async () => {
                global.Xrm = {};

                vi.resetModules();
                await import('../src/Main.js');

                await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

                // Alert should contain error message
                expect(global.alert).toHaveBeenCalledWith(
                    expect.stringContaining('Power-Toolkit could not start')
                );
            });
        });
    });

    describe('error handling', () => {
        it('should catch and display initialization errors', async () => {
            // Make App.init throw an error
            App.init.mockImplementationOnce(() => {
                throw new Error('Test initialization error');
            });

            global.Xrm = {
                Page: {
                    data: {},
                    ui: {
                        getFormType: () => 2
                    }
                },
                Utility: {}
            };

            vi.resetModules();
            await import('../src/Main.js');

            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

            // Should have logged error
            expect(console.error).toHaveBeenCalledWith(
                Config.MAIN.errors.startupFailed,
                expect.any(Error)
            );

            // Should have shown alert
            expect(global.alert).toHaveBeenCalledWith(
                expect.stringContaining('Test initialization error')
            );
        });

        it('should handle errors gracefully without crashing', async () => {
            App.init.mockImplementationOnce(() => {
                throw new Error('Crash test');
            });

            global.Xrm = {
                Page: {
                    data: {},
                    ui: {
                        getFormType: () => 2
                    }
                },
                Utility: {}
            };

            vi.resetModules();

            // Should not throw
            await expect(import('../src/Main.js')).resolves.not.toThrow();

            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);
        });
    });

    describe('IIFE behavior', () => {
        it('should use strict mode', async () => {
            // The IIFE uses 'use strict' - this test verifies it doesn't cause issues
            global.Xrm = {
                Page: {
                    data: {},
                    ui: {
                        getFormType: () => 2
                    }
                },
                Utility: {}
            };

            vi.resetModules();
            await expect(import('../src/Main.js')).resolves.toBeDefined();
        });

        it('should not pollute global namespace', async () => {
            global.Xrm = {
                Page: {
                    data: {},
                    ui: {
                        getFormType: () => 2
                    }
                },
                Utility: {}
            };

            // Count properties before
            const propsBefore = Object.keys(window).length;

            vi.resetModules();
            await import('../src/Main.js');

            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

            // Only expected properties should be added (flags set by the module)
            const propsAfter = Object.keys(window).length;

            // Should only add the initialized flag and version flag (max 2 + what App.init adds)
            expect(propsAfter - propsBefore).toBeLessThanOrEqual(3);
        });
    });

    describe('version management', () => {
        it('should set version flag on initialization', async () => {
            global.Xrm = {
                Page: {
                    data: {},
                    ui: {
                        getFormType: () => 2
                    }
                },
                Utility: {}
            };

            vi.resetModules();
            await import('../src/Main.js');

            expect(window[Config.MAIN.windowVersionFlag]).toBe(Config.TOOL_VERSION);
        });
    });

    describe('Config constants usage', () => {
        it('should use correct polling interval from Config', () => {
            expect(Config.MAIN.pollingInterval).toBeDefined();
            expect(typeof Config.MAIN.pollingInterval).toBe('number');
            expect(Config.MAIN.pollingInterval).toBeGreaterThan(0);
        });

        it('should use correct max polling attempts from Config', () => {
            expect(Config.MAIN.maxPollingAttempts).toBeDefined();
            expect(typeof Config.MAIN.maxPollingAttempts).toBe('number');
            expect(Config.MAIN.maxPollingAttempts).toBeGreaterThan(0);
        });

        it('should use correct init delay from Config', () => {
            expect(Config.MAIN.initDelay).toBeDefined();
            expect(typeof Config.MAIN.initDelay).toBe('number');
            expect(Config.MAIN.initDelay).toBeGreaterThan(0);
        });

        it('should use correct error messages from Config', () => {
            expect(Config.MAIN.errors.xrmNotAvailable).toBeDefined();
            expect(Config.MAIN.errors.startupFailed).toBeDefined();
            expect(Config.MAIN.errors.xrmNotFound).toBeDefined();
        });

        it('should use correct alert messages from Config', () => {
            expect(Config.MAIN.alerts.startupError).toBeDefined();
            expect(typeof Config.MAIN.alerts.startupError).toBe('function');
            expect(Config.MAIN.alerts.startupError('test')).toContain('test');
        });

        it('should use correct class names from Config', () => {
            expect(Config.MAIN.appContainerClass).toBeDefined();
            expect(typeof Config.MAIN.appContainerClass).toBe('string');
        });
    });

    describe('form context scenarios', () => {
        it('should handle create form (type 1)', async () => {
            global.Xrm = {
                Page: {
                    data: {},
                    ui: {
                        getFormType: () => 1 // Create
                    }
                },
                Utility: {}
            };

            vi.resetModules();
            await import('../src/Main.js');

            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

            expect(App.init).toHaveBeenCalled();
        });

        it('should handle update form (type 2)', async () => {
            global.Xrm = {
                Page: {
                    data: {},
                    ui: {
                        getFormType: () => 2 // Update
                    }
                },
                Utility: {}
            };

            vi.resetModules();
            await import('../src/Main.js');

            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

            expect(App.init).toHaveBeenCalled();
        });

        it('should handle read-only form (type 3)', async () => {
            global.Xrm = {
                Page: {
                    data: {},
                    ui: {
                        getFormType: () => 3 // Read-only
                    }
                },
                Utility: {}
            };

            vi.resetModules();
            await import('../src/Main.js');

            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

            expect(App.init).toHaveBeenCalled();
        });

        it('should handle disabled form (type 4)', async () => {
            global.Xrm = {
                Page: {
                    data: {},
                    ui: {
                        getFormType: () => 4 // Disabled
                    }
                },
                Utility: {}
            };

            vi.resetModules();
            await import('../src/Main.js');

            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

            expect(App.init).toHaveBeenCalled();
        });

        it('should handle quick create form (type 5)', async () => {
            global.Xrm = {
                Page: {
                    data: {},
                    ui: {
                        getFormType: () => 5 // Quick create
                    }
                },
                Utility: {}
            };

            vi.resetModules();
            await import('../src/Main.js');

            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

            expect(App.init).toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        it('should handle Xrm.Page without ui property', async () => {
            global.Xrm = {
                Page: {
                    data: {}
                    // No ui property
                },
                Utility: {}
            };

            vi.resetModules();
            await import('../src/Main.js');

            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

            // Should handle gracefully, possibly via OnLoad or error
            // The important thing is it doesn't crash
        });

        it('should handle Xrm.Page.ui without getFormType', async () => {
            global.Xrm = {
                Page: {
                    data: {
                        addOnLoad: vi.fn(),
                        removeOnLoad: vi.fn()
                    },
                    ui: {}
                    // No getFormType
                },
                Utility: {}
            };

            vi.resetModules();
            await import('../src/Main.js');

            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);

            // Should handle gracefully via OnLoad path
            expect(global.Xrm.Page.data.addOnLoad).toHaveBeenCalled();
        });

        it('should handle null Xrm.Page.data', async () => {
            global.Xrm = {
                Page: {
                    data: null
                },
                Utility: {}
            };

            vi.resetModules();
            await import('../src/Main.js');

            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);
            await vi.advanceTimersByTimeAsync(Config.MAIN.initDelay);

            // Should fall back to Utility path
            expect(App.init).toHaveBeenCalled();
        });

        it('should handle undefined Xrm.Page', async () => {
            global.Xrm = {
                Page: undefined,
                Utility: {}
            };

            vi.resetModules();
            await import('../src/Main.js');

            await vi.advanceTimersByTimeAsync(Config.MAIN.pollingInterval);
            await vi.advanceTimersByTimeAsync(Config.MAIN.initDelay);

            // Should fall back to Utility path
            expect(App.init).toHaveBeenCalled();
        });
    });
});
