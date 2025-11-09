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
     * @returns {Function} The debounced function with a cancel method.
     */
    debounce(func, delay) {
        let timeout;
        const debounced = function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                timeout = null;
                try {
                    func.apply(context, args);
                } catch (_err) {
                    // Silently handle errors if function executes after cleanup
                }
            }, delay);
        };

        // Add cancel method to clear pending timeout
        debounced.cancel = function() {
            clearTimeout(timeout);
            timeout = null;
        };

        return debounced;
    },

    /**
     * Creates a throttled function that only invokes `func` at most once per every `limit` milliseconds.
     * @param {Function} func - The function to throttle.
     * @param {number} limit - The throttle limit in milliseconds.
     * @returns {Function} The throttled function with a cancel method.
     */
    throttle(func, limit) {
        let inThrottle;
        let timeout;
        const throttled = function(...args) {
            const context = this;
            if (!inThrottle) {
                try {
                    func.apply(context, args);
                } catch (_err) {
                    // Silently handle errors if function executes after cleanup
                }
                inThrottle = true;
                timeout = setTimeout(() => {
                    inThrottle = false;
                    timeout = null;
                }, limit);
            }
        };

        // Add cancel method to clear pending timeout
        throttled.cancel = function() {
            clearTimeout(timeout);
            timeout = null;
            inThrottle = false;
        };

        return throttled;
    }
};
