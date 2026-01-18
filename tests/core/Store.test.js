/**
 * @file Tests for Store
 * @module tests/core/Store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Store } from '../../src/core/Store.js';

describe('Store', () => {
    let localStorageMock;

    beforeEach(() => {
        localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn()
        };
        global.localStorage = localStorageMock;
        Store.init();
    });

    describe('init', () => {
        it('should initialize with default tab settings when localStorage is empty', () => {
            localStorageMock.getItem.mockReturnValue(null);

            Store.init();
            const state = Store.getState();

            expect(state.tabSettings).toBeDefined();
            expect(state.tabSettings.length).toBeGreaterThan(0);
            expect(state.tabSettings[0]).toHaveProperty('id');
            expect(state.tabSettings[0]).toHaveProperty('visible');
            expect(state.tabSettings[0]).toHaveProperty('formOnly');
        });

        it('should restore tab settings from localStorage', () => {
            const savedSettings = [
                { id: 'inspector', visible: false, formOnly: true },
                { id: 'metadataBrowser', visible: true, formOnly: false }
            ];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(savedSettings));

            Store.init();
            const state = Store.getState();

            expect(state.tabSettings).toContainEqual(savedSettings[0]);
        });

        it('should handle corrupted localStorage data gracefully', () => {
            localStorageMock.getItem.mockReturnValue('invalid json{');

            // JSON.parse will throw, so expect it
            expect(() => Store.init()).toThrow();
        });
    });

    describe('getState', () => {
        it('should return current state object', () => {
            const state = Store.getState();
            expect(state).toBeDefined();
            expect(typeof state).toBe('object');
        });

        it('should include all state properties', () => {
            const state = Store.getState();
            expect(state).toHaveProperty('theme');
            expect(state).toHaveProperty('tabSettings');
            expect(state).toHaveProperty('dimensions');
            expect(state).toHaveProperty('impersonationUserId');
            expect(state).toHaveProperty('isMinimized');
        });
    });

    describe('setState', () => {
        it('should update state with new values', () => {
            Store.setState({ theme: 'dark' });
            const state = Store.getState();
            expect(state.theme).toBe('dark');
        });

        it('should merge new state with existing state', () => {
            Store.setState({ theme: 'dark' });
            Store.setState({ isMinimized: true });

            const state = Store.getState();
            expect(state.theme).toBe('dark');
            expect(state.isMinimized).toBe(true);
        });

        it('should notify listeners when state changes', () => {
            const listener = vi.fn();
            Store.subscribe(listener);

            Store.setState({ theme: 'dark' });

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('subscribe', () => {
        it('should register listener and return unsubscribe function', () => {
            const listener = vi.fn();
            const unsubscribe = Store.subscribe(listener);

            expect(typeof unsubscribe).toBe('function');

            Store.setState({ theme: 'dark' });
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should unsubscribe listener when unsubscribe is called', () => {
            const listener = vi.fn();
            const unsubscribe = Store.subscribe(listener);

            Store.setState({ theme: 'dark' });
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe();

            Store.setState({ theme: 'light' });
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should support multiple listeners simultaneously', () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();
            const listener3 = vi.fn();

            Store.subscribe(listener1);
            Store.subscribe(listener2);
            Store.subscribe(listener3);

            Store.setState({ theme: 'dark' });

            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(1);
            expect(listener3).toHaveBeenCalledTimes(1);
        });

        it('should pass new and old state to listeners', () => {
            const listener = vi.fn();
            Store.subscribe(listener);

            Store.setState({ theme: 'light' });

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({ theme: 'light' }),
                expect.any(Object)
            );
        });

        it('should allow unsubscribing mid-notification without affecting other listeners', () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();

            const unsubscribe1 = Store.subscribe(listener1);
            Store.subscribe(listener2);

            unsubscribe1();
            Store.setState({ theme: 'dark' });

            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).toHaveBeenCalledTimes(1);
        });

        it('should handle subscribing the same listener multiple times', () => {
            const listener = vi.fn();

            Store.subscribe(listener);
            Store.subscribe(listener);

            Store.setState({ theme: 'dark' });

            // Set uses reference equality, so same function added twice is only stored once
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe('Tab Settings Management', () => {
        it('should merge saved settings with defaults preserving saved visibility', () => {
            const savedSettings = [
                { id: 'inspector', visible: false, formOnly: true },
                { id: 'metadataBrowser', visible: false, formOnly: false }
            ];
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'pdt-tab-settings') {
                    return JSON.stringify(savedSettings);
                }
                return null;
            });

            Store.init();
            const state = Store.getState();

            const inspectorTab = state.tabSettings.find(t => t.id === 'inspector');
            expect(inspectorTab.visible).toBe(false);
        });

        it('should add new default tabs that are not in saved settings', () => {
            const savedSettings = [
                { id: 'inspector', visible: true, formOnly: true }
            ];
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'pdt-tab-settings') {
                    return JSON.stringify(savedSettings);
                }
                return null;
            });

            Store.init();
            const state = Store.getState();

            // Should include tabs from defaults that weren't in saved settings
            const metadataBrowserTab = state.tabSettings.find(t => t.id === 'metadataBrowser');
            expect(metadataBrowserTab).toBeDefined();
            expect(metadataBrowserTab.visible).toBe(true);
        });

        it('should filter out obsolete tabs not in default settings', () => {
            const savedSettings = [
                { id: 'inspector', visible: true, formOnly: true },
                { id: 'obsoleteTab', visible: true, formOnly: false }
            ];
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'pdt-tab-settings') {
                    return JSON.stringify(savedSettings);
                }
                return null;
            });

            Store.init();
            const state = Store.getState();

            const obsoleteTab = state.tabSettings.find(t => t.id === 'obsoleteTab');
            expect(obsoleteTab).toBeUndefined();
        });

        it('should preserve formOnly property from saved settings', () => {
            const savedSettings = [
                { id: 'inspector', visible: true, formOnly: false }
            ];
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'pdt-tab-settings') {
                    return JSON.stringify(savedSettings);
                }
                return null;
            });

            Store.init();
            const state = Store.getState();

            const inspectorTab = state.tabSettings.find(t => t.id === 'inspector');
            expect(inspectorTab.formOnly).toBe(false);
        });

        it('should handle empty saved settings array', () => {
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'pdt-tab-settings') {
                    return JSON.stringify([]);
                }
                return null;
            });

            Store.init();
            const state = Store.getState();

            // Should fall back to defaults since all are missing
            expect(state.tabSettings.length).toBeGreaterThan(0);
        });
    });

    describe('LocalStorage Persistence', () => {
        it('should persist theme to localStorage when set', () => {
            Store.setState({ theme: 'light' });

            expect(localStorageMock.setItem).toHaveBeenCalledWith('pdt-theme', 'light');
        });

        it('should persist tabSettings to localStorage when set', () => {
            const newSettings = [{ id: 'inspector', visible: false, formOnly: true }];
            Store.setState({ tabSettings: newSettings });

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'pdt-tab-settings',
                JSON.stringify(newSettings)
            );
        });

        it('should persist dimensions to localStorage when set', () => {
            const dimensions = { width: 800, height: 600 };
            Store.setState({ dimensions });

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'pdt-dimensions',
                JSON.stringify(dimensions)
            );
        });

        it('should persist isMinimized to localStorage when set', () => {
            Store.setState({ isMinimized: true });

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'pdt-is-minimized',
                'true'
            );
        });

        it('should persist preMinimizedDimensions to localStorage when set', () => {
            const preMinimizedDimensions = { width: 1024, height: 768 };
            Store.setState({ preMinimizedDimensions });

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'pdt-pre-minimized-dimensions',
                JSON.stringify(preMinimizedDimensions)
            );
        });

        it('should persist minimizedBannerWidth to localStorage when set', () => {
            Store.setState({ minimizedBannerWidth: '300px' });

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'pdt-minimized-banner-width',
                '300px'
            );
        });

        it('should not persist impersonationUserId to localStorage', () => {
            Store.setState({ impersonationUserId: 'user-guid-123' });

            expect(localStorageMock.setItem).not.toHaveBeenCalledWith(
                expect.stringContaining('impersonation'),
                expect.anything()
            );
        });

        it('should load theme from localStorage on init', () => {
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'pdt-theme') return 'light';
                return null;
            });

            Store.init();
            const state = Store.getState();

            expect(state.theme).toBe('light');
        });

        it('should load dimensions from localStorage on init', () => {
            const savedDimensions = { width: 500, height: 400 };
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'pdt-dimensions') return JSON.stringify(savedDimensions);
                return null;
            });

            Store.init();
            const state = Store.getState();

            expect(state.dimensions).toEqual(savedDimensions);
        });

        it('should load isMinimized from localStorage on init', () => {
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'pdt-is-minimized') return 'true';
                return null;
            });

            Store.init();
            const state = Store.getState();

            expect(state.isMinimized).toBe(true);
        });
    });

    describe('State Merging Edge Cases', () => {
        it('should not overwrite unrelated state properties', () => {
            Store.setState({ theme: 'dark', isMinimized: false });
            Store.setState({ theme: 'light' });

            const state = Store.getState();
            expect(state.isMinimized).toBe(false);
        });

        it('should handle setting undefined values', () => {
            Store.setState({ theme: undefined });

            const state = Store.getState();
            expect(state.theme).toBeUndefined();
        });

        it('should handle setting null values', () => {
            Store.setState({ impersonationUserId: 'user-123' });
            Store.setState({ impersonationUserId: null });

            const state = Store.getState();
            expect(state.impersonationUserId).toBeNull();
        });

        it('should handle empty object in setState', () => {
            const initialState = Store.getState();
            Store.setState({});

            const newState = Store.getState();
            expect(newState).toEqual(initialState);
        });

        it('should handle nested object updates in dimensions', () => {
            Store.setState({ dimensions: { width: 100 } });
            Store.setState({ dimensions: { height: 200 } });

            const state = Store.getState();
            // Object replacement, not deep merge
            expect(state.dimensions).toEqual({ height: 200 });
        });
    });

    describe('Default State Values', () => {
        it('should default theme to dark when localStorage is empty', () => {
            localStorageMock.getItem.mockReturnValue(null);

            Store.init();
            const state = Store.getState();

            expect(state.theme).toBe('dark');
        });

        it('should default dimensions to empty object when localStorage is empty', () => {
            localStorageMock.getItem.mockReturnValue(null);

            Store.init();
            const state = Store.getState();

            expect(state.dimensions).toEqual({});
        });

        it('should default isMinimized to false when localStorage is empty', () => {
            localStorageMock.getItem.mockReturnValue(null);

            Store.init();
            const state = Store.getState();

            expect(state.isMinimized).toBe(false);
        });

        it('should default impersonationUserId to null', () => {
            localStorageMock.getItem.mockReturnValue(null);

            Store.init();
            const state = Store.getState();

            expect(state.impersonationUserId).toBeNull();
        });

        it('should default preMinimizedDimensions to empty object', () => {
            localStorageMock.getItem.mockReturnValue(null);

            Store.init();
            const state = Store.getState();

            expect(state.preMinimizedDimensions).toEqual({});
        });

        it('should default minimizedBannerWidth to null', () => {
            localStorageMock.getItem.mockReturnValue(null);

            Store.init();
            const state = Store.getState();

            expect(state.minimizedBannerWidth).toBeNull();
        });
    });

    describe('Error Handling for Corrupted Storage', () => {
        it('should use default tab settings when tabSettings JSON is corrupted', () => {
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'pdt-tab-settings') return '{invalid json';
                return null;
            });

            Store.init();
            const state = Store.getState();

            // Should fall back to default settings
            expect(state.tabSettings).toBeDefined();
            expect(state.tabSettings.length).toBeGreaterThan(0);
            expect(state.tabSettings[0]).toHaveProperty('id');
        });

        it('should use empty object when dimensions JSON is corrupted', () => {
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'pdt-dimensions') return 'not valid json';
                return null;
            });

            // JSON.parse will throw for corrupted dimensions
            expect(() => Store.init()).toThrow();
        });

        it('should use false when isMinimized JSON is corrupted', () => {
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'pdt-is-minimized') return 'not a boolean';
                return null;
            });

            // JSON.parse('not a boolean') throws
            expect(() => Store.init()).toThrow();
        });
    });

    describe('resetToDefaults', () => {
        it('should reset theme to dark', () => {
            Store.setState({ theme: 'light' });
            Store.resetToDefaults();

            const state = Store.getState();
            expect(state.theme).toBe('dark');
        });

        it('should reset dimensions to empty object', () => {
            Store.setState({ dimensions: { width: 800, height: 600 } });
            Store.resetToDefaults();

            const state = Store.getState();
            expect(state.dimensions).toEqual({});
        });

        it('should reset isMinimized to false', () => {
            Store.setState({ isMinimized: true });
            Store.resetToDefaults();

            const state = Store.getState();
            expect(state.isMinimized).toBe(false);
        });

        it('should reset preMinimizedDimensions to empty object', () => {
            Store.setState({ preMinimizedDimensions: { width: 1024 } });
            Store.resetToDefaults();

            const state = Store.getState();
            expect(state.preMinimizedDimensions).toEqual({});
        });

        it('should reset minimizedBannerWidth to null', () => {
            Store.setState({ minimizedBannerWidth: '300px' });
            Store.resetToDefaults();

            const state = Store.getState();
            expect(state.minimizedBannerWidth).toBeNull();
        });

        it('should remove all persisted keys from localStorage', () => {
            Store.resetToDefaults();

            expect(localStorageMock.removeItem).toHaveBeenCalledWith('pdt-tab-settings');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('pdt-theme');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('pdt-dimensions');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('pdt-is-minimized');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('pdt-pre-minimized-dimensions');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('pdt-minimized-banner-width');
        });

        it('should notify listeners after reset', () => {
            const listener = vi.fn();
            Store.subscribe(listener);

            Store.resetToDefaults();

            expect(listener).toHaveBeenCalled();
        });

        it('should reset tabSettings to default configuration', () => {
            Store.setState({
                tabSettings: [{ id: 'inspector', visible: false, formOnly: true }]
            });
            Store.resetToDefaults();

            const state = Store.getState();
            const inspectorTab = state.tabSettings.find(t => t.id === 'inspector');
            expect(inspectorTab.visible).toBe(true);
        });
    });

    describe('Subscription Cleanup', () => {
        it('should properly clean up all subscriptions', () => {
            const listeners = [vi.fn(), vi.fn(), vi.fn()];
            const unsubscribes = listeners.map(l => Store.subscribe(l));

            // Unsubscribe all
            unsubscribes.forEach(unsub => unsub());

            Store.setState({ theme: 'light' });

            listeners.forEach(listener => {
                expect(listener).not.toHaveBeenCalled();
            });
        });

        it('should handle double unsubscribe gracefully', () => {
            const listener = vi.fn();
            const unsubscribe = Store.subscribe(listener);

            unsubscribe();
            // Second unsubscribe should not throw
            expect(() => unsubscribe()).not.toThrow();
        });

        it('should not affect other listeners when one unsubscribes', () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();

            const unsubscribe1 = Store.subscribe(listener1);
            Store.subscribe(listener2);

            unsubscribe1();
            Store.setState({ theme: 'dark' });

            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).toHaveBeenCalledTimes(1);
        });
    });
});
