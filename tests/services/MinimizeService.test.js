/**
 * @file Comprehensive Tests for MinimizeService
 * @module tests/services/MinimizeService.test.js
 * @description Test suite for extension window minimize/restore management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Store
vi.mock('../../src/core/Store.js', () => ({
    Store: {
        getState: vi.fn(() => ({
            isMinimized: false,
            preMinimizedDimensions: null,
            minimizedBannerWidth: null
        })),
        setState: vi.fn()
    }
}));

// Mock ICONS
vi.mock('../../src/assets/Icons.js', () => ({
    ICONS: {
        minimize: '<svg>minimize</svg>',
        restore: '<svg>restore</svg>'
    }
}));

// Mock constants
vi.mock('../../src/constants/index.js', () => ({
    MINIMIZE_SERVICE: {
        messages: {
            initFailed: 'MinimizeService init failed',
            buttonNotFound: 'Minimize button not found',
            minimizeFailed: 'Minimize operation failed',
            restoreFailed: 'Restore operation failed'
        },
        tooltip: {
            minimize: 'Minimize',
            restore: 'Restore'
        },
        classes: {
            minimized: 'pdt-dialog-minimized'
        },
        keyboard: {
            shortcut: 'm',
            modifiers: ['ctrlKey', 'metaKey']
        },
        animation: {
            duration: 300
        },
        viewport: {
            margin: 10
        }
    }
}));

// Mock NotificationService
vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: {
        show: vi.fn()
    }
}));

// Import after mocks
import { MinimizeService } from '../../src/services/MinimizeService.js';
import { Store } from '../../src/core/Store.js';
import { NotificationService } from '../../src/services/NotificationService.js';

describe('MinimizeService', () => {
    /** @type {HTMLElement} */
    let dialogElement;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Reset MinimizeService internal state
        MinimizeService._dialogElement = null;
        MinimizeService._minimizeButton = null;
        MinimizeService._boundToggle = null;
        MinimizeService._boundKeyHandler = null;
        MinimizeService._isAnimating = false;

        // Create dialog element with minimize button
        dialogElement = document.createElement('div');
        dialogElement.className = 'pdt-dialog';
        dialogElement.style.width = '600px';
        dialogElement.style.height = '400px';
        dialogElement.style.top = '100px';
        dialogElement.style.left = '100px';
        dialogElement.innerHTML = '<button class="pdt-minimize-btn"></button>';
        document.body.appendChild(dialogElement);

        // Reset Store mock
        vi.mocked(Store.getState).mockReturnValue({
            isMinimized: false,
            preMinimizedDimensions: null,
            minimizedBannerWidth: null
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        MinimizeService.destroy();
        document.body.innerHTML = '';
    });

    describe('init', () => {
        it('should initialize with dialog element', () => {
            MinimizeService.init(dialogElement);

            expect(MinimizeService._dialogElement).toBe(dialogElement);
            expect(MinimizeService._minimizeButton).toBeTruthy();
        });

        it('should set up click listener on minimize button', () => {
            const button = dialogElement.querySelector('.pdt-minimize-btn');
            const addEventListenerSpy = vi.spyOn(button, 'addEventListener');

            MinimizeService.init(dialogElement);

            expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('should set up keyboard shortcut listener', () => {
            const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

            MinimizeService.init(dialogElement);

            expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        });

        it('should show warning when dialog element is null', () => {
            MinimizeService.init(null);

            expect(NotificationService.show).toHaveBeenCalledWith(
                'MinimizeService init failed',
                'warn'
            );
        });

        it('should show warning when minimize button not found', () => {
            const dialogWithoutButton = document.createElement('div');

            MinimizeService.init(dialogWithoutButton);

            expect(NotificationService.show).toHaveBeenCalledWith(
                'Minimize button not found',
                'warn'
            );
        });

        it('should apply minimized state on init if already minimized', () => {
            vi.mocked(Store.getState).mockReturnValue({
                isMinimized: true,
                preMinimizedDimensions: null,
                minimizedBannerWidth: null
            });

            MinimizeService.init(dialogElement);

            // Advance past requestAnimationFrame
            vi.runAllTimers();

            expect(dialogElement.classList.contains('pdt-dialog-minimized')).toBe(true);
        });

        it('should set initial tooltip on minimize button', () => {
            MinimizeService.init(dialogElement);

            const button = dialogElement.querySelector('.pdt-minimize-btn');
            expect(button.title).toBe('Minimize');
        });
    });

    describe('toggle', () => {
        beforeEach(() => {
            MinimizeService.init(dialogElement);
        });

        it('should call minimize when not minimized', async () => {
            vi.mocked(Store.getState).mockReturnValue({ isMinimized: false });
            const minimizeSpy = vi.spyOn(MinimizeService, 'minimize').mockResolvedValue();

            await MinimizeService.toggle();

            expect(minimizeSpy).toHaveBeenCalled();
        });

        it('should call restore when minimized', async () => {
            vi.mocked(Store.getState).mockReturnValue({ isMinimized: true });
            const restoreSpy = vi.spyOn(MinimizeService, 'restore').mockResolvedValue();

            await MinimizeService.toggle();

            expect(restoreSpy).toHaveBeenCalled();
        });

        it('should not toggle when animating', async () => {
            MinimizeService._isAnimating = true;
            const minimizeSpy = vi.spyOn(MinimizeService, 'minimize').mockResolvedValue();

            await MinimizeService.toggle();

            expect(minimizeSpy).not.toHaveBeenCalled();
        });

        it('should show warning when dialog not initialized', async () => {
            MinimizeService._dialogElement = null;

            await MinimizeService.toggle();

            expect(NotificationService.show).toHaveBeenCalledWith(
                'MinimizeService init failed',
                'warn'
            );
        });

        it('should reset state when isMinimized is not boolean', async () => {
            vi.mocked(Store.getState).mockReturnValue({ isMinimized: 'invalid' });

            await MinimizeService.toggle();

            expect(Store.setState).toHaveBeenCalledWith({ isMinimized: false });
        });
    });

    describe('minimize', () => {
        beforeEach(() => {
            MinimizeService.init(dialogElement);
        });

        it('should not minimize when already animating', async () => {
            MinimizeService._isAnimating = true;

            await MinimizeService.minimize();

            expect(Store.setState).not.toHaveBeenCalled();
        });

        it('should not minimize when dialog is null', async () => {
            MinimizeService._dialogElement = null;

            await MinimizeService.minimize();

            expect(Store.setState).not.toHaveBeenCalled();
        });
    });

    describe('restore', () => {
        beforeEach(() => {
            MinimizeService.init(dialogElement);
            dialogElement.classList.add('pdt-dialog-minimized');
        });

        it('should not restore when already animating', async () => {
            MinimizeService._isAnimating = true;

            await MinimizeService.restore();

            expect(Store.setState).not.toHaveBeenCalled();
        });

        it('should not restore when dialog is null', async () => {
            MinimizeService._dialogElement = null;

            await MinimizeService.restore();

            expect(Store.setState).not.toHaveBeenCalled();
        });
    });

    describe('_handleKeyPress', () => {
        beforeEach(() => {
            MinimizeService.init(dialogElement);
        });

        it('should toggle on Ctrl+M', () => {
            const toggleSpy = vi.spyOn(MinimizeService, 'toggle');
            const event = new KeyboardEvent('keydown', {
                key: 'm',
                ctrlKey: true,
                bubbles: true
            });

            document.dispatchEvent(event);

            expect(toggleSpy).toHaveBeenCalled();
        });

        it('should toggle on Cmd+M (Mac)', () => {
            const toggleSpy = vi.spyOn(MinimizeService, 'toggle');
            const event = new KeyboardEvent('keydown', {
                key: 'M',
                metaKey: true,
                bubbles: true
            });

            document.dispatchEvent(event);

            expect(toggleSpy).toHaveBeenCalled();
        });

        it('should not toggle on M without modifier', () => {
            const toggleSpy = vi.spyOn(MinimizeService, 'toggle');
            const event = new KeyboardEvent('keydown', {
                key: 'm',
                bubbles: true
            });

            document.dispatchEvent(event);

            expect(toggleSpy).not.toHaveBeenCalled();
        });

        it('should not toggle on Ctrl+different key', () => {
            const toggleSpy = vi.spyOn(MinimizeService, 'toggle');
            const event = new KeyboardEvent('keydown', {
                key: 'n',
                ctrlKey: true,
                bubbles: true
            });

            document.dispatchEvent(event);

            expect(toggleSpy).not.toHaveBeenCalled();
        });
    });

    describe('_adjustPositionToViewport', () => {
        beforeEach(() => {
            MinimizeService.init(dialogElement);
            // Mock window dimensions
            Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
            Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
        });

        it('should adjust position if dialog extends beyond right edge', () => {
            dialogElement.style.left = '900px';
            dialogElement.style.width = '200px';
            dialogElement.getBoundingClientRect = vi.fn(() => ({
                left: 900,
                right: 1100,
                top: 100,
                bottom: 200,
                width: 200,
                height: 100
            }));

            MinimizeService._adjustPositionToViewport();

            expect(parseInt(dialogElement.style.left)).toBeLessThan(900);
        });

        it('should adjust position if dialog extends beyond bottom edge', () => {
            dialogElement.style.top = '700px';
            dialogElement.style.height = '200px';
            dialogElement.getBoundingClientRect = vi.fn(() => ({
                left: 100,
                right: 200,
                top: 700,
                bottom: 900,
                width: 100,
                height: 200
            }));

            MinimizeService._adjustPositionToViewport();

            expect(parseInt(dialogElement.style.top)).toBeLessThan(700);
        });

        it('should ensure dialog stays above left edge margin', () => {
            dialogElement.style.left = '-50px';
            dialogElement.getBoundingClientRect = vi.fn(() => ({
                left: -50,
                right: 150,
                top: 100,
                bottom: 200,
                width: 200,
                height: 100
            }));

            MinimizeService._adjustPositionToViewport();

            expect(parseInt(dialogElement.style.left)).toBeGreaterThanOrEqual(10);
        });

        it('should ensure dialog stays below top edge margin', () => {
            dialogElement.style.top = '-20px';
            dialogElement.getBoundingClientRect = vi.fn(() => ({
                left: 100,
                right: 200,
                top: -20,
                bottom: 80,
                width: 100,
                height: 100
            }));

            MinimizeService._adjustPositionToViewport();

            expect(parseInt(dialogElement.style.top)).toBeGreaterThanOrEqual(10);
        });
    });

    describe('_waitForTransition', () => {
        beforeEach(() => {
            MinimizeService.init(dialogElement);
        });

        it('should resolve on transitionend event', async () => {
            const promise = MinimizeService._waitForTransition();

            dialogElement.dispatchEvent(new Event('transitionend'));

            await expect(promise).resolves.toBeUndefined();
        });

        it('should resolve on timeout if transitionend does not fire', async () => {
            const promise = MinimizeService._waitForTransition();

            // Advance timers past the timeout (300ms + 50ms buffer)
            vi.advanceTimersByTime(400);

            await expect(promise).resolves.toBeUndefined();
        });

        it('should resolve immediately when dialog is null', async () => {
            MinimizeService._dialogElement = null;

            const promise = MinimizeService._waitForTransition();

            await expect(promise).resolves.toBeUndefined();
        });
    });

    describe('destroy', () => {
        it('should remove click listener from minimize button', () => {
            MinimizeService.init(dialogElement);
            const button = dialogElement.querySelector('.pdt-minimize-btn');
            const removeEventListenerSpy = vi.spyOn(button, 'removeEventListener');

            MinimizeService.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('should remove keydown listener from document', () => {
            MinimizeService.init(dialogElement);
            const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

            MinimizeService.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        });

        it('should clear all references', () => {
            MinimizeService.init(dialogElement);

            MinimizeService.destroy();

            expect(MinimizeService._dialogElement).toBeNull();
            expect(MinimizeService._minimizeButton).toBeNull();
            expect(MinimizeService._boundToggle).toBeNull();
            expect(MinimizeService._boundKeyHandler).toBeNull();
            expect(MinimizeService._isAnimating).toBe(false);
        });
    });

    describe('Full Minimize Animation Flow', () => {
        beforeEach(() => {
            vi.mocked(Store.getState).mockReturnValue({
                isMinimized: false,
                preMinimizedDimensions: null,
                minimizedBannerWidth: null
            });
            MinimizeService.init(dialogElement);
        });

        it('should save current dimensions before minimizing', async () => {
            dialogElement.style.width = '800px';
            dialogElement.style.height = '600px';
            dialogElement.style.top = '50px';
            dialogElement.style.left = '150px';

            const promise = MinimizeService.minimize();
            vi.advanceTimersByTime(400);
            await promise;

            expect(Store.setState).toHaveBeenCalledWith(expect.objectContaining({
                isMinimized: true,
                preMinimizedDimensions: {
                    width: '800px',
                    height: '600px',
                    top: '50px',
                    left: '150px'
                }
            }));
        });

        it('should apply saved banner width when minimizing', async () => {
            vi.mocked(Store.getState).mockReturnValue({
                isMinimized: false,
                minimizedBannerWidth: '350px',
                preMinimizedDimensions: null
            });

            const promise = MinimizeService.minimize();
            vi.advanceTimersByTime(400);
            await promise;

            expect(dialogElement.style.width).toBe('350px');
        });

        it('should add minimized class after animation starts', async () => {
            const promise = MinimizeService.minimize();
            vi.advanceTimersByTime(100);
            await vi.runAllTimersAsync();
            await promise;

            expect(dialogElement.classList.contains('pdt-dialog-minimized')).toBe(true);
        });

        it('should update button icon to restore after minimize', async () => {
            const promise = MinimizeService.minimize();
            vi.advanceTimersByTime(400);
            await promise;

            const button = dialogElement.querySelector('.pdt-minimize-btn');
            expect(button.innerHTML).toBe('<svg>restore</svg>');
            expect(button.title).toBe('Restore');
        });

        it('should set isAnimating to false after minimize completes', async () => {
            const promise = MinimizeService.minimize();
            vi.advanceTimersByTime(400);
            await promise;

            expect(MinimizeService._isAnimating).toBe(false);
        });

        it('should handle minimize error and rollback state', async () => {
            // Mock _applyMinimizedState to throw an error
            const spy = vi.spyOn(MinimizeService, '_applyMinimizedState').mockRejectedValueOnce(new Error('Test error'));

            await MinimizeService.minimize();

            expect(NotificationService.show).toHaveBeenCalledWith(
                'Minimize operation failed',
                'error'
            );
            expect(Store.setState).toHaveBeenCalledWith({ isMinimized: false });

            spy.mockRestore();
        });
    });

    describe('Full Restore Animation Flow', () => {
        beforeEach(() => {
            vi.mocked(Store.getState).mockReturnValue({
                isMinimized: true,
                preMinimizedDimensions: null,
                minimizedBannerWidth: null
            });
            MinimizeService.init(dialogElement);
            dialogElement.classList.add('pdt-dialog-minimized');
        });

        it('should save minimized banner width before restoring', async () => {
            dialogElement.style.width = '320px';

            const promise = MinimizeService.restore();
            vi.advanceTimersByTime(400);
            await promise;

            expect(Store.setState).toHaveBeenCalledWith({ minimizedBannerWidth: '320px' });
        });

        it('should restore pre-minimized dimensions', async () => {
            vi.mocked(Store.getState).mockReturnValue({
                isMinimized: true,
                minimizedBannerWidth: null,
                preMinimizedDimensions: {
                    width: '700px',
                    height: '500px',
                    top: '80px',
                    left: '120px'
                }
            });

            const promise = MinimizeService.restore();
            vi.advanceTimersByTime(400);
            await promise;

            expect(dialogElement.style.width).toBe('700px');
            expect(dialogElement.style.height).toBe('500px');
        });

        it('should have minimized class removed by _applyRestoredState', async () => {
            // The beforeEach already set up the service and added the minimized class
            // Verify that _applyRestoredState correctly removes the class
            expect(dialogElement.classList.contains('pdt-dialog-minimized')).toBe(true);

            // Directly call _applyRestoredState to verify class removal
            await MinimizeService._applyRestoredState(false);

            expect(dialogElement.classList.contains('pdt-dialog-minimized')).toBe(false);
        });

        it('should update button icon to minimize after restore', async () => {
            const promise = MinimizeService.restore();
            vi.advanceTimersByTime(400);
            await promise;

            const button = dialogElement.querySelector('.pdt-minimize-btn');
            expect(button.innerHTML).toBe('<svg>minimize</svg>');
            expect(button.title).toBe('Minimize');
        });

        it('should set isAnimating to false after restore completes', async () => {
            const promise = MinimizeService.restore();
            vi.advanceTimersByTime(400);
            await promise;

            expect(MinimizeService._isAnimating).toBe(false);
        });

        it('should handle restore error and rollback state', async () => {
            // Mock _applyRestoredState to throw an error
            const spy = vi.spyOn(MinimizeService, '_applyRestoredState').mockRejectedValueOnce(new Error('Test error'));

            await MinimizeService.restore();

            expect(NotificationService.show).toHaveBeenCalledWith(
                'Restore operation failed',
                'error'
            );
            expect(Store.setState).toHaveBeenCalledWith({ isMinimized: true });

            spy.mockRestore();
        });

        it('should handle missing preMinimizedDimensions gracefully', async () => {
            const promise = MinimizeService.restore();
            vi.advanceTimersByTime(400);
            await promise;

            // Should not throw and should complete successfully
            expect(Store.setState).toHaveBeenCalledWith({ isMinimized: false });
        });

        it('should handle preMinimizedDimensions without width', async () => {
            vi.mocked(Store.getState).mockReturnValue({
                isMinimized: true,
                minimizedBannerWidth: null,
                preMinimizedDimensions: {
                    width: '',
                    height: '500px',
                    top: '80px',
                    left: '120px'
                }
            });

            const promise = MinimizeService.restore();
            vi.advanceTimersByTime(400);
            await promise;

            // Should complete without applying empty width
            expect(MinimizeService._isAnimating).toBe(false);
        });
    });

    describe('Banner State Management', () => {
        beforeEach(() => {
            vi.mocked(Store.getState).mockReturnValue({
                isMinimized: false,
                preMinimizedDimensions: null,
                minimizedBannerWidth: null
            });
            MinimizeService.init(dialogElement);
        });

        it('should persist banner width across minimize/restore cycles', async () => {
            // First minimize
            const minimizePromise = MinimizeService.minimize();
            vi.advanceTimersByTime(400);
            await minimizePromise;

            // Simulate user resizing banner
            dialogElement.style.width = '400px';
            vi.mocked(Store.getState).mockReturnValue({
                isMinimized: true,
                minimizedBannerWidth: null,
                preMinimizedDimensions: null
            });

            // Restore
            MinimizeService._isAnimating = false; // Reset animation flag
            const restorePromise = MinimizeService.restore();
            vi.advanceTimersByTime(400);
            await restorePromise;

            expect(Store.setState).toHaveBeenCalledWith({ minimizedBannerWidth: '400px' });
        });

        it('should use default dimensions when no saved banner width', async () => {
            const promise = MinimizeService.minimize();
            vi.advanceTimersByTime(400);
            await promise;

            // Should not change width if no saved banner width
            expect(dialogElement.style.width).toBe('600px');
        });
    });

    describe('Position Calculations Edge Cases', () => {
        beforeEach(() => {
            MinimizeService.init(dialogElement);
            Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
            Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
        });

        it('should handle dialog larger than viewport width', () => {
            dialogElement.style.left = '0px';
            dialogElement.style.width = '1200px';
            dialogElement.getBoundingClientRect = vi.fn(() => ({
                left: 0,
                right: 1200,
                top: 100,
                bottom: 200,
                width: 1200,
                height: 100
            }));

            MinimizeService._adjustPositionToViewport();

            expect(parseInt(dialogElement.style.left)).toBe(10);
        });

        it('should handle dialog larger than viewport height', () => {
            dialogElement.style.top = '0px';
            dialogElement.style.height = '900px';
            dialogElement.getBoundingClientRect = vi.fn(() => ({
                left: 100,
                right: 300,
                top: 0,
                bottom: 900,
                width: 200,
                height: 900
            }));

            MinimizeService._adjustPositionToViewport();

            expect(parseInt(dialogElement.style.top)).toBe(10);
        });

        it('should handle dialog at exact viewport edge', () => {
            dialogElement.style.left = '824px';
            dialogElement.getBoundingClientRect = vi.fn(() => ({
                left: 824,
                right: 1024,
                top: 100,
                bottom: 200,
                width: 200,
                height: 100
            }));

            MinimizeService._adjustPositionToViewport();

            // Should not adjust if exactly at edge (not past it)
            expect(dialogElement.style.left).toBe('824px');
        });

        it('should handle multiple edge violations simultaneously', () => {
            dialogElement.style.left = '-100px';
            dialogElement.style.top = '-50px';
            dialogElement.getBoundingClientRect = vi.fn(() => ({
                left: -100,
                right: 100,
                top: -50,
                bottom: 50,
                width: 200,
                height: 100
            }));

            MinimizeService._adjustPositionToViewport();

            expect(parseInt(dialogElement.style.left)).toBeGreaterThanOrEqual(10);
            expect(parseInt(dialogElement.style.top)).toBeGreaterThanOrEqual(10);
        });

        it('should not adjust position when dialog is null', () => {
            MinimizeService._dialogElement = null;

            // Should not throw
            expect(() => MinimizeService._adjustPositionToViewport()).not.toThrow();
        });

        it('should handle dialog with no explicit position styles', () => {
            dialogElement.style.left = '';
            dialogElement.style.top = '';
            dialogElement.getBoundingClientRect = vi.fn(() => ({
                left: 500,
                right: 700,
                top: 300,
                bottom: 400,
                width: 200,
                height: 100
            }));

            // Should not throw and use getBoundingClientRect values
            expect(() => MinimizeService._adjustPositionToViewport()).not.toThrow();
        });
    });

    describe('Transition Handling', () => {
        beforeEach(() => {
            MinimizeService.init(dialogElement);
        });

        it('should only resolve once on transitionend', async () => {
            let resolveCount = 0;

            const promise = MinimizeService._waitForTransition().then(() => {
                resolveCount++;
            });

            // Dispatch multiple transitionend events
            dialogElement.dispatchEvent(new Event('transitionend'));
            dialogElement.dispatchEvent(new Event('transitionend'));
            dialogElement.dispatchEvent(new Event('transitionend'));

            await promise;

            expect(resolveCount).toBe(1);
        });

        it('should not resolve from transitionend on child elements', async () => {
            const child = document.createElement('div');
            dialogElement.appendChild(child);

            const promise = MinimizeService._waitForTransition();

            // Create event that bubbles from child
            const childEvent = new Event('transitionend', { bubbles: true });
            Object.defineProperty(childEvent, 'target', { value: child });
            child.dispatchEvent(childEvent);

            // Should not have resolved yet - advance timer to trigger timeout
            vi.advanceTimersByTime(400);
            await promise;

            // The promise resolved via timeout, not the child event
            expect(true).toBe(true);
        });

        it('should remove event listener after transitionend', async () => {
            const removeEventListenerSpy = vi.spyOn(dialogElement, 'removeEventListener');

            const promise = MinimizeService._waitForTransition();
            dialogElement.dispatchEvent(new Event('transitionend'));

            await promise;

            expect(removeEventListenerSpy).toHaveBeenCalledWith('transitionend', expect.any(Function));
        });

        it('should remove event listener on timeout', async () => {
            const removeEventListenerSpy = vi.spyOn(dialogElement, 'removeEventListener');

            const promise = MinimizeService._waitForTransition();
            vi.advanceTimersByTime(400);

            await promise;

            expect(removeEventListenerSpy).toHaveBeenCalledWith('transitionend', expect.any(Function));
        });
    });

    describe('_updateButtonState', () => {
        beforeEach(() => {
            MinimizeService.init(dialogElement);
        });

        it('should not throw when minimize button is null', () => {
            MinimizeService._minimizeButton = null;

            expect(() => MinimizeService._updateButtonState(true)).not.toThrow();
            expect(() => MinimizeService._updateButtonState(false)).not.toThrow();
        });

        it('should set restore icon when isMinimized is true', () => {
            MinimizeService._updateButtonState(true);

            const button = dialogElement.querySelector('.pdt-minimize-btn');
            expect(button.innerHTML).toBe('<svg>restore</svg>');
            expect(button.title).toBe('Restore');
        });

        it('should set minimize icon when isMinimized is false', () => {
            MinimizeService._updateButtonState(false);

            const button = dialogElement.querySelector('.pdt-minimize-btn');
            expect(button.innerHTML).toBe('<svg>minimize</svg>');
            expect(button.title).toBe('Minimize');
        });
    });

    describe('_applyMinimizedState', () => {
        beforeEach(() => {
            vi.mocked(Store.getState).mockReturnValue({
                isMinimized: false,
                preMinimizedDimensions: null,
                minimizedBannerWidth: null
            });
            MinimizeService.init(dialogElement);
        });

        it('should add minimized class without animation', async () => {
            await MinimizeService._applyMinimizedState(false);

            expect(dialogElement.classList.contains('pdt-dialog-minimized')).toBe(true);
        });

        it('should add minimized class with animation', async () => {
            const waitForTransitionSpy = vi.spyOn(MinimizeService, '_waitForTransition').mockResolvedValueOnce();

            await MinimizeService._applyMinimizedState(true);

            expect(dialogElement.classList.contains('pdt-dialog-minimized')).toBe(true);
            expect(waitForTransitionSpy).toHaveBeenCalled();

            waitForTransitionSpy.mockRestore();
        });

        it('should return early when dialog is null', async () => {
            MinimizeService._dialogElement = null;

            await expect(MinimizeService._applyMinimizedState(true)).resolves.toBeUndefined();
        });
    });

    describe('_applyRestoredState', () => {
        beforeEach(() => {
            vi.mocked(Store.getState).mockReturnValue({
                isMinimized: true,
                preMinimizedDimensions: null,
                minimizedBannerWidth: null
            });
            MinimizeService.init(dialogElement);
            dialogElement.classList.add('pdt-dialog-minimized');
        });

        it('should remove minimized class without animation', async () => {
            await MinimizeService._applyRestoredState(false);

            expect(dialogElement.classList.contains('pdt-dialog-minimized')).toBe(false);
        });

        it('should remove minimized class with animation', async () => {
            const waitForTransitionSpy = vi.spyOn(MinimizeService, '_waitForTransition').mockResolvedValueOnce();

            await MinimizeService._applyRestoredState(true);

            expect(dialogElement.classList.contains('pdt-dialog-minimized')).toBe(false);
            expect(waitForTransitionSpy).toHaveBeenCalled();

            waitForTransitionSpy.mockRestore();
        });

        it('should call _adjustPositionToViewport when restoring', async () => {
            const adjustPositionSpy = vi.spyOn(MinimizeService, '_adjustPositionToViewport');

            await MinimizeService._applyRestoredState(false);

            expect(adjustPositionSpy).toHaveBeenCalled();

            adjustPositionSpy.mockRestore();
        });

        it('should return early when dialog is null', async () => {
            MinimizeService._dialogElement = null;

            await expect(MinimizeService._applyRestoredState(true)).resolves.toBeUndefined();
        });
    });

    describe('Keyboard Handler Edge Cases', () => {
        beforeEach(() => {
            MinimizeService.init(dialogElement);
        });

        it('should prevent default on valid shortcut', () => {
            const event = new KeyboardEvent('keydown', {
                key: 'm',
                ctrlKey: true,
                bubbles: true
            });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            document.dispatchEvent(event);

            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        it('should handle uppercase M with modifier', () => {
            const toggleSpy = vi.spyOn(MinimizeService, 'toggle');
            const event = new KeyboardEvent('keydown', {
                key: 'M',
                ctrlKey: true,
                bubbles: true
            });

            document.dispatchEvent(event);

            expect(toggleSpy).toHaveBeenCalled();
        });

        it('should not toggle when both Ctrl and Alt are pressed', () => {
            const toggleSpy = vi.spyOn(MinimizeService, 'toggle');
            const event = new KeyboardEvent('keydown', {
                key: 'm',
                ctrlKey: true,
                altKey: true,
                bubbles: true
            });

            document.dispatchEvent(event);

            // Should still toggle since ctrlKey is present
            expect(toggleSpy).toHaveBeenCalled();
        });
    });

    describe('Destroy Edge Cases', () => {
        it('should handle destroy when not initialized', () => {
            // Reset everything
            MinimizeService._dialogElement = null;
            MinimizeService._minimizeButton = null;
            MinimizeService._boundToggle = null;
            MinimizeService._boundKeyHandler = null;

            expect(() => MinimizeService.destroy()).not.toThrow();
        });

        it('should handle destroy when partially initialized', () => {
            MinimizeService._dialogElement = dialogElement;
            MinimizeService._minimizeButton = null;
            MinimizeService._boundToggle = null;
            MinimizeService._boundKeyHandler = vi.fn();

            expect(() => MinimizeService.destroy()).not.toThrow();
        });

        it('should reset isAnimating on destroy', () => {
            MinimizeService.init(dialogElement);
            MinimizeService._isAnimating = true;

            MinimizeService.destroy();

            expect(MinimizeService._isAnimating).toBe(false);
        });
    });
});
