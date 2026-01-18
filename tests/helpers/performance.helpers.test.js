/**
 * @file Tests for performance helpers
 * @module tests/helpers/performance.helpers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceHelpers } from '../../src/helpers/performance.helpers.js';

describe('Performance Helpers', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('debounce', () => {
        it('should debounce function calls', () => {
            const mockFn = vi.fn();
            const debounced = PerformanceHelpers.debounce(mockFn, 100);

            debounced();
            debounced();
            debounced();

            expect(mockFn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(100);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should pass arguments to the debounced function', () => {
            const mockFn = vi.fn();
            const debounced = PerformanceHelpers.debounce(mockFn, 50);

            debounced('arg1', 'arg2', 123);
            vi.advanceTimersByTime(50);

            expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 123);
        });

        it('should reset the delay when called again before timeout', () => {
            const mockFn = vi.fn();
            const debounced = PerformanceHelpers.debounce(mockFn, 100);

            debounced();
            vi.advanceTimersByTime(80);
            debounced();
            vi.advanceTimersByTime(80);

            expect(mockFn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(20);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should preserve context (this) in debounced function', () => {
            const mockFn = vi.fn();
            const debounced = PerformanceHelpers.debounce(mockFn, 50);
            const context = { value: 42 };

            debounced.call(context);
            vi.advanceTimersByTime(50);

            expect(mockFn.mock.contexts[0]).toBe(context);
        });

        it('should have a cancel method that clears pending timeout', () => {
            const mockFn = vi.fn();
            const debounced = PerformanceHelpers.debounce(mockFn, 100);

            debounced();
            debounced.cancel();
            vi.advanceTimersByTime(200);

            expect(mockFn).not.toHaveBeenCalled();
        });

        it('should handle zero delay', () => {
            const mockFn = vi.fn();
            const debounced = PerformanceHelpers.debounce(mockFn, 0);

            debounced();
            vi.advanceTimersByTime(0);

            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should handle very long delay', () => {
            const mockFn = vi.fn();
            const debounced = PerformanceHelpers.debounce(mockFn, 10000);

            debounced();
            vi.advanceTimersByTime(5000);
            expect(mockFn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(5000);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should silently handle errors in the debounced function', () => {
            const errorFn = vi.fn(() => {
                throw new Error('Test error');
            });
            const debounced = PerformanceHelpers.debounce(errorFn, 50);

            debounced();
            expect(() => vi.advanceTimersByTime(50)).not.toThrow();
            expect(errorFn).toHaveBeenCalledTimes(1);
        });

        it('should set timeout to null after execution', () => {
            const mockFn = vi.fn();
            const debounced = PerformanceHelpers.debounce(mockFn, 50);

            debounced();
            vi.advanceTimersByTime(50);

            // Calling cancel after execution should not cause issues
            expect(() => debounced.cancel()).not.toThrow();
        });
    });

    describe('throttle', () => {
        it('should throttle function calls', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 100);

            throttled();
            throttled();
            throttled();

            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should allow subsequent calls after limit expires', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 100);

            throttled();
            expect(mockFn).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(100);
            throttled();
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        it('should pass arguments to the throttled function', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 50);

            throttled('value1', 'value2', { key: 'data' });

            expect(mockFn).toHaveBeenCalledWith('value1', 'value2', { key: 'data' });
        });

        it('should preserve context (this) in throttled function', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 50);
            const context = { name: 'testContext' };

            throttled.call(context);

            expect(mockFn.mock.contexts[0]).toBe(context);
        });

        it('should execute immediately on first call', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 200);

            throttled();
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should block calls during throttle period', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 100);

            throttled();
            vi.advanceTimersByTime(50);
            throttled();
            throttled();

            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should have a cancel method that clears throttle state', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 100);

            throttled();
            expect(mockFn).toHaveBeenCalledTimes(1);

            throttled.cancel();
            throttled();
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        it('should reset inThrottle to false after timeout', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 100);

            throttled();
            expect(mockFn).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(100);

            // After timeout, should be able to call again
            throttled();
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        it('should handle zero limit', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 0);

            throttled();
            vi.advanceTimersByTime(0);
            throttled();

            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        it('should handle very long limit', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 60000);

            throttled();
            vi.advanceTimersByTime(30000);
            throttled();

            expect(mockFn).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(30000);
            throttled();

            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        it('should silently handle errors in the throttled function', () => {
            const errorFn = vi.fn(() => {
                throw new Error('Throttle test error');
            });
            const throttled = PerformanceHelpers.throttle(errorFn, 50);

            expect(() => throttled()).not.toThrow();
            expect(errorFn).toHaveBeenCalledTimes(1);
        });

        it('should set timeout to null after throttle period ends', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 100);

            throttled();
            vi.advanceTimersByTime(100);

            // Calling cancel after timeout should not cause issues
            expect(() => throttled.cancel()).not.toThrow();
        });

        it('should handle rapid sequential calls correctly', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 50);

            for (let i = 0; i < 10; i++) {
                throttled();
                vi.advanceTimersByTime(10);
            }

            // First call executes immediately, then one more after 50ms
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        it('should handle multiple throttle cycles', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 100);

            // First cycle
            throttled();
            expect(mockFn).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(100);

            // Second cycle
            throttled();
            expect(mockFn).toHaveBeenCalledTimes(2);

            vi.advanceTimersByTime(100);

            // Third cycle
            throttled();
            expect(mockFn).toHaveBeenCalledTimes(3);
        });

        it('should cancel and allow immediate call', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 100);

            throttled();
            expect(mockFn).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(30);
            throttled.cancel();

            // After cancel, inThrottle is reset, so next call executes immediately
            throttled();
            expect(mockFn).toHaveBeenCalledTimes(2);
        });
    });

    describe('edge cases', () => {
        it('debounce should handle function returning value (though async)', () => {
            const mockFn = vi.fn().mockReturnValue('result');
            const debounced = PerformanceHelpers.debounce(mockFn, 50);

            const result = debounced();
            vi.advanceTimersByTime(50);

            // Debounced function doesn't return synchronously
            expect(result).toBeUndefined();
            expect(mockFn).toHaveBeenCalled();
        });

        it('throttle should handle function returning value', () => {
            const mockFn = vi.fn().mockReturnValue('throttle result');
            const throttled = PerformanceHelpers.throttle(mockFn, 50);

            throttled();
            expect(mockFn).toHaveReturnedWith('throttle result');
        });

        it('should handle cancel being called multiple times on debounce', () => {
            const mockFn = vi.fn();
            const debounced = PerformanceHelpers.debounce(mockFn, 100);

            debounced();
            debounced.cancel();
            debounced.cancel();
            debounced.cancel();

            vi.advanceTimersByTime(200);
            expect(mockFn).not.toHaveBeenCalled();
        });

        it('should handle cancel being called multiple times on throttle', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 100);

            throttled();
            throttled.cancel();
            throttled.cancel();
            throttled.cancel();

            expect(() => throttled()).not.toThrow();
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        it('debounce should handle empty arguments', () => {
            const mockFn = vi.fn();
            const debounced = PerformanceHelpers.debounce(mockFn, 50);

            debounced();
            vi.advanceTimersByTime(50);

            expect(mockFn).toHaveBeenCalledWith();
        });

        it('throttle should handle empty arguments', () => {
            const mockFn = vi.fn();
            const throttled = PerformanceHelpers.throttle(mockFn, 50);

            throttled();

            expect(mockFn).toHaveBeenCalledWith();
        });
    });
});
