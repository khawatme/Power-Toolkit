/**
 * @file Performance optimization utilities.
 * @module helpers/performance.helpers
 * @description Provides debouncing and throttling functions for performance optimization.
 */

/**
 * Performance optimization utility functions.
 * @namespace PerformanceHelpers
 */
export const PerformanceHelpers = {
    /**
     * Creates a debounced function that delays invoking `func` until after `delay` milliseconds have elapsed.
     * @param {Function} func - The function to debounce.
     * @param {number} delay - The number of milliseconds to delay.
     * @returns {Function} The new debounced function.
     */
    debounce(func, delay) {
        let timeout;
        return function (...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    },

    /**
     * Creates a throttled function that only invokes `func` at most once per every `limit` milliseconds.
     * @param {Function} func - The function to throttle.
     * @param {number} limit - The throttle limit in milliseconds.
     * @returns {Function} The new throttled function.
     */
    throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};
