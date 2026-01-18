/**
 * @file Tests for StyleManager
 * @module tests/ui/StyleManager.test.js
 * @description Test suite for style management
 */

import { describe, it, expect } from 'vitest';
import { StyleManager } from '../../src/ui/StyleManager.js';

describe('StyleManager', () => {
    describe('init', () => {
        it('should have init method', () => {
            expect(StyleManager.init).toBeDefined();
            expect(typeof StyleManager.init).toBe('function');
        });

        it('should call init without throwing', () => {
            expect(() => StyleManager.init()).not.toThrow();
        });
    });
});
