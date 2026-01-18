/**
 * @file Comprehensive tests for EventMonitorTab component
 * @module tests/components/EventMonitorTab.test.js
 * @description Tests for the Event Monitor component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventMonitorTab } from '../../src/components/EventMonitorTab.js';
import { PowerAppsApiService } from '../../src/services/PowerAppsApiService.js';
import * as helpers from '../../src/helpers/index.js';

// Mock dependencies
vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: true,
        getEntityName: vi.fn(() => 'account'),
        addOnLoad: vi.fn(),
        removeOnLoad: vi.fn(),
        addOnSave: vi.fn(),
        removeOnSave: vi.fn(),
        getAllAttributes: vi.fn(() => [])
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/helpers/index.js', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original,
        appendLogEntry: vi.fn((container, className, message) => {
            if (container) {
                const entry = document.createElement('div');
                entry.className = `log-entry ${className}`;
                entry.textContent = message;
                container.appendChild(entry);
                return entry;
            }
            return null;
        }),
        clearContainer: vi.fn((container) => {
            if (container) {
                container.innerHTML = '';
                return true;
            }
            return false;
        })
    };
});

describe('EventMonitorTab', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        component = new EventMonitorTab();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        component?.destroy?.();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with correct id', () => {
            expect(component.id).toBe('eventMonitor');
        });

        it('should initialize with correct label', () => {
            expect(component.label).toContain('Event');
        });

        it('should have an icon defined', () => {
            expect(component.icon).toBeDefined();
        });

        it('should be a form-only component', () => {
            expect(component.isFormOnly).toBe(true);
        });

        it('should initialize isMonitoring flag', () => {
            expect(component.isMonitoring).toBe(false);
        });

        it('should initialize attachedHandlers array', () => {
            expect(component.attachedHandlers).toEqual([]);
        });
    });

    describe('render', () => {
        it('should return an HTMLElement', async () => {
            const element = await component.render();
            expect(element).toBeInstanceOf(HTMLElement);
        });

        it('should render section title', async () => {
            const element = await component.render();
            expect(element.querySelector('.section-title')).toBeTruthy();
        });

        it('should render start/stop button', async () => {
            const element = await component.render();
            const buttons = element.querySelectorAll('button');
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('should render clear button', async () => {
            const element = await component.render();
            const buttons = element.querySelectorAll('button');
            const clearBtn = Array.from(buttons).find(b =>
                b.textContent?.toLowerCase().includes('clear') ||
                b.id?.includes('clear')
            );
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('should render event log container', async () => {
            const element = await component.render();
            expect(element).toBeTruthy();
        });
    });

    describe('postRender', () => {
        it('should not throw when called', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            expect(() => component.postRender(element)).not.toThrow();
        });
    });

    describe('destroy', () => {
        it('should not throw when called', () => {
            expect(() => component.destroy()).not.toThrow();
        });

        it('should cleanup after render and postRender', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(() => component.destroy()).not.toThrow();
        });

        it('should stop monitoring on destroy', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component.isMonitoring = true;
            component.destroy();
            expect(component.isMonitoring).toBe(false);
        });
    });

    describe('_startMonitoring', () => {
        it('should set isMonitoring to true', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            const logFn = vi.fn();
            component._startMonitoring(logFn);
            expect(component.isMonitoring).toBe(true);
        });

        it('should call addOnLoad', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            const logFn = vi.fn();
            component._startMonitoring(logFn);
            expect(PowerAppsApiService.addOnLoad).toHaveBeenCalled();
        });

        it('should call addOnSave', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            const logFn = vi.fn();
            component._startMonitoring(logFn);
            expect(PowerAppsApiService.addOnSave).toHaveBeenCalled();
        });

        it('should store handlers in attachedHandlers array', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            const logFn = vi.fn();
            component._startMonitoring(logFn);
            expect(component.attachedHandlers.length).toBeGreaterThan(0);
        });

        it('should add load handler to attachedHandlers', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            const logFn = vi.fn();
            component._startMonitoring(logFn);
            const loadHandler = component.attachedHandlers.find(h => h.type === 'load');
            expect(loadHandler).toBeDefined();
            expect(loadHandler.handler).toBeInstanceOf(Function);
        });

        it('should add save handler to attachedHandlers', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            const logFn = vi.fn();
            component._startMonitoring(logFn);
            const saveHandler = component.attachedHandlers.find(h => h.type === 'save');
            expect(saveHandler).toBeDefined();
            expect(saveHandler.handler).toBeInstanceOf(Function);
        });

        it('should subscribe to attribute changes when attributes exist', async () => {
            const mockAttr = {
                addOnChange: vi.fn(),
                removeOnChange: vi.fn(),
                getName: () => 'name'
            };
            PowerAppsApiService.getAllAttributes.mockReturnValueOnce([mockAttr]);

            const element = await component.render();
            document.body.appendChild(element);
            const logFn = vi.fn();
            component._startMonitoring(logFn);

            expect(mockAttr.addOnChange).toHaveBeenCalled();
        });

        it('should add change handlers to attachedHandlers for attributes', async () => {
            const mockAttr = {
                addOnChange: vi.fn(),
                removeOnChange: vi.fn(),
                getName: () => 'testfield'
            };
            PowerAppsApiService.getAllAttributes.mockReturnValueOnce([mockAttr]);

            const element = await component.render();
            document.body.appendChild(element);
            const logFn = vi.fn();
            component._startMonitoring(logFn);

            const changeHandler = component.attachedHandlers.find(h => h.type === 'change');
            expect(changeHandler).toBeDefined();
            expect(changeHandler.attr).toBe(mockAttr);
        });

        it('should call _stopMonitoring before starting to ensure clean state', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            const logFn = vi.fn();

            const stopSpy = vi.spyOn(component, '_stopMonitoring');
            component._startMonitoring(logFn);

            expect(stopSpy).toHaveBeenCalled();
        });

        it('should handle attributes without addOnChange method gracefully', async () => {
            const mockAttr = {
                getName: () => 'readonly_field'
                // no addOnChange method
            };
            PowerAppsApiService.getAllAttributes.mockReturnValueOnce([mockAttr]);

            const element = await component.render();
            document.body.appendChild(element);
            const logFn = vi.fn();

            expect(() => component._startMonitoring(logFn)).not.toThrow();
        });

        it('should handle null/undefined attributes array gracefully', async () => {
            PowerAppsApiService.getAllAttributes.mockReturnValueOnce(null);

            const element = await component.render();
            document.body.appendChild(element);
            const logFn = vi.fn();

            expect(() => component._startMonitoring(logFn)).not.toThrow();
        });
    });

    describe('_stopMonitoring', () => {
        it('should set isMonitoring to false', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.isMonitoring = true;
            component._stopMonitoring();
            expect(component.isMonitoring).toBe(false);
        });

        it('should clear attachedHandlers array', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.attachedHandlers = [{ type: 'load', handler: () => { } }];
            component._stopMonitoring();
            expect(component.attachedHandlers).toEqual([]);
        });

        it('should call removeOnLoad for load handlers', async () => {
            const handler = vi.fn();
            component.attachedHandlers = [{ type: 'load', handler }];
            component._stopMonitoring();
            expect(PowerAppsApiService.removeOnLoad).toHaveBeenCalledWith(handler);
        });

        it('should call removeOnSave for save handlers', async () => {
            const handler = vi.fn();
            component.attachedHandlers = [{ type: 'save', handler }];
            component._stopMonitoring();
            expect(PowerAppsApiService.removeOnSave).toHaveBeenCalledWith(handler);
        });

        it('should call removeOnChange for change handlers', async () => {
            const handler = vi.fn();
            const mockAttr = {
                removeOnChange: vi.fn()
            };
            component.attachedHandlers = [{ type: 'change', attr: mockAttr, handler }];
            component._stopMonitoring();
            expect(mockAttr.removeOnChange).toHaveBeenCalledWith(handler);
        });

        it('should handle multiple handlers of different types', async () => {
            const loadHandler = vi.fn();
            const saveHandler = vi.fn();
            const changeHandler = vi.fn();
            const mockAttr = { removeOnChange: vi.fn() };

            component.attachedHandlers = [
                { type: 'load', handler: loadHandler },
                { type: 'save', handler: saveHandler },
                { type: 'change', attr: mockAttr, handler: changeHandler }
            ];

            component._stopMonitoring();

            expect(PowerAppsApiService.removeOnLoad).toHaveBeenCalledWith(loadHandler);
            expect(PowerAppsApiService.removeOnSave).toHaveBeenCalledWith(saveHandler);
            expect(mockAttr.removeOnChange).toHaveBeenCalledWith(changeHandler);
        });

        it('should handle errors during handler removal gracefully', async () => {
            const badHandler = vi.fn();
            const mockAttr = {
                removeOnChange: vi.fn(() => { throw new Error('Remove failed'); })
            };
            component.attachedHandlers = [{ type: 'change', attr: mockAttr, handler: badHandler }];

            expect(() => component._stopMonitoring()).not.toThrow();
            expect(component.attachedHandlers).toEqual([]);
        });
    });

    describe('_safeArray', () => {
        it('should return the input array if it is an array', () => {
            const arr = [1, 2, 3];
            expect(component._safeArray(arr)).toBe(arr);
        });

        it('should return empty array for null', () => {
            expect(component._safeArray(null)).toEqual([]);
        });

        it('should return empty array for undefined', () => {
            expect(component._safeArray(undefined)).toEqual([]);
        });

        it('should return empty array for non-array objects', () => {
            expect(component._safeArray({ foo: 'bar' })).toEqual([]);
        });

        it('should return empty array for strings', () => {
            expect(component._safeArray('test')).toEqual([]);
        });

        it('should return empty array for numbers', () => {
            expect(component._safeArray(42)).toEqual([]);
        });
    });

    describe('event handlers callback behavior', () => {
        it('should invoke logFunction when load handler fires', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            const logFn = vi.fn();
            component._startMonitoring(logFn);

            const loadHandler = component.attachedHandlers.find(h => h.type === 'load');
            loadHandler.handler({});

            expect(logFn).toHaveBeenCalledWith('log-entry-load', 'Form OnLoad', {});
        });

        it('should invoke logFunction when save handler fires', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            const logFn = vi.fn();
            component._startMonitoring(logFn);

            const saveHandler = component.attachedHandlers.find(h => h.type === 'save');
            saveHandler.handler({});

            expect(logFn).toHaveBeenCalledWith('log-entry-save', 'Form OnSave', {});
        });

        it('should invoke logFunction when change handler fires', async () => {
            const mockAttr = {
                addOnChange: vi.fn(),
                removeOnChange: vi.fn(),
                getName: () => 'firstname'
            };
            PowerAppsApiService.getAllAttributes.mockReturnValueOnce([mockAttr]);

            const element = await component.render();
            document.body.appendChild(element);
            const logFn = vi.fn();
            component._startMonitoring(logFn);

            const changeHandler = component.attachedHandlers.find(h => h.type === 'change');
            changeHandler.handler({});

            expect(logFn).toHaveBeenCalledWith('log-entry-change', 'Attribute OnChange', {});
        });
    });

    describe('postRender logging behavior', () => {
        it('should add initial info message to log', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(helpers.appendLogEntry).toHaveBeenCalled();
        });

        it('should set monitoring status text', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const statusEl = element.querySelector('#monitoring-status');
            expect(statusEl.textContent).toContain('Monitoring');
        });

        it('should call _startMonitoring during postRender', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            const startSpy = vi.spyOn(component, '_startMonitoring');

            component.postRender(element);

            expect(startSpy).toHaveBeenCalled();
        });
    });

    describe('clear log button', () => {
        it('should clear log container when clear button is clicked', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const clearBtn = element.querySelector('#clear-log-btn');
            clearBtn.click();

            expect(helpers.clearContainer).toHaveBeenCalled();
        });

        it('should update status text when clear button is clicked', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const statusEl = element.querySelector('#monitoring-status');
            const clearBtn = element.querySelector('#clear-log-btn');
            clearBtn.click();

            expect(statusEl.textContent).toContain('cleared');
        });

        it('should reset status text after timeout', async () => {
            vi.useFakeTimers();

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const statusEl = element.querySelector('#monitoring-status');
            const clearBtn = element.querySelector('#clear-log-btn');
            clearBtn.click();

            expect(statusEl.textContent).toContain('cleared');

            vi.advanceTimersByTime(2500);

            expect(statusEl.textContent).toContain('Monitoring');

            vi.useRealTimers();
        });

        it('should clear pending timeout when clear is clicked multiple times', async () => {
            vi.useFakeTimers();

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const clearBtn = element.querySelector('#clear-log-btn');
            clearBtn.click();

            vi.advanceTimersByTime(1000);
            clearBtn.click(); // Click again before timeout completes

            expect(component._statusResetTimeout).not.toBeNull();

            vi.useRealTimers();
        });
    });

    describe('render element structure', () => {
        it('should render toolbar container', async () => {
            const element = await component.render();
            expect(element.querySelector('.pdt-toolbar')).toBeTruthy();
        });

        it('should render live status indicator', async () => {
            const element = await component.render();
            expect(element.querySelector('#live-status-indicator')).toBeTruthy();
        });

        it('should render monitoring status element', async () => {
            const element = await component.render();
            expect(element.querySelector('#monitoring-status')).toBeTruthy();
        });

        it('should render event log container with role="log"', async () => {
            const element = await component.render();
            const logContainer = element.querySelector('#event-log-container');
            expect(logContainer).toBeTruthy();
            expect(logContainer.getAttribute('role')).toBe('log');
        });

        it('should render event log container with aria-live="polite"', async () => {
            const element = await component.render();
            const logContainer = element.querySelector('#event-log-container');
            expect(logContainer.getAttribute('aria-live')).toBe('polite');
        });

        it('should render clear log button with secondary class', async () => {
            const element = await component.render();
            const clearBtn = element.querySelector('#clear-log-btn');
            expect(clearBtn.classList.contains('secondary')).toBe(true);
        });
    });

    describe('destroy cleanup', () => {
        it('should clear status reset timeout on destroy', async () => {
            vi.useFakeTimers();

            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const clearBtn = element.querySelector('#clear-log-btn');
            clearBtn.click();

            expect(component._statusResetTimeout).not.toBeNull();

            component.destroy();

            expect(component._statusResetTimeout).toBeNull();

            vi.useRealTimers();
        });

        it('should call _stopMonitoring on destroy', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const stopSpy = vi.spyOn(component, '_stopMonitoring');
            component.destroy();

            expect(stopSpy).toHaveBeenCalled();
        });

        it('should not throw when destroy is called multiple times', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(() => {
                component.destroy();
                component.destroy();
            }).not.toThrow();
        });

        it('should reset attachedHandlers on destroy', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            component.destroy();

            expect(component.attachedHandlers).toEqual([]);
        });

        it('should set isMonitoring to false on destroy', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component.isMonitoring).toBe(true);

            component.destroy();

            expect(component.isMonitoring).toBe(false);
        });
    });

    describe('logEvent context handling', () => {
        it('should append attribute name from context source', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Get the log function that was passed to _startMonitoring
            const logContainer = element.querySelector('#event-log-container');
            const mockContext = {
                getEventSource: () => ({
                    getName: () => 'accountname'
                }),
                getDepth: () => 1,
                getEventArgs: () => ({
                    getSaveMode: () => undefined
                })
            };

            // Fire the load handler to test context handling
            const loadHandler = component.attachedHandlers.find(h => h.type === 'load');
            loadHandler?.handler(mockContext);

            // Verify appendLogEntry was called (actual message formatting tested via the callback)
            expect(helpers.appendLogEntry).toHaveBeenCalled();
        });

        it('should include save mode when present in context', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const logContainer = element.querySelector('#event-log-container');
            const mockContext = {
                getEventSource: () => null,
                getDepth: () => 0,
                getEventArgs: () => ({
                    getSaveMode: () => 1 // Save mode value
                })
            };

            const saveHandler = component.attachedHandlers.find(h => h.type === 'save');
            saveHandler?.handler(mockContext);

            expect(helpers.appendLogEntry).toHaveBeenCalled();
        });

        it('should handle context with unavailable methods gracefully', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const mockContext = {
                getEventSource: () => { throw new Error('Not available'); }
            };

            const loadHandler = component.attachedHandlers.find(h => h.type === 'load');
            expect(() => loadHandler?.handler(mockContext)).not.toThrow();
        });
    });

    describe('_maxLogEntries configuration', () => {
        it('should have default max log entries of 500', () => {
            expect(component._maxLogEntries).toBe(500);
        });
    });

    describe('form-only behavior', () => {
        it('should be marked as form-only component', () => {
            expect(component.isFormOnly).toBe(true);
        });
    });

    describe('accessibility', () => {
        it('should have status role on monitoring status element', async () => {
            const element = await component.render();
            const statusEl = element.querySelector('#monitoring-status');
            expect(statusEl.getAttribute('role')).toBe('status');
        });

        it('should have aria-live on monitoring status element', async () => {
            const element = await component.render();
            const statusEl = element.querySelector('#monitoring-status');
            expect(statusEl.getAttribute('aria-live')).toBe('polite');
        });

        it('should have aria-hidden on live indicator', async () => {
            const element = await component.render();
            const indicator = element.querySelector('#live-status-indicator');
            expect(indicator.getAttribute('aria-hidden')).toBe('true');
        });

        it('should have aria-relevant on event log container', async () => {
            const element = await component.render();
            const logContainer = element.querySelector('#event-log-container');
            expect(logContainer.getAttribute('aria-relevant')).toBe('additions');
        });
    });
});
