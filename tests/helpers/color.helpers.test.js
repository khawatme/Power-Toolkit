/**
 * @file Tests for color helpers
 * @module tests/helpers/color.helpers.test.js
 */

import { describe, it, expect } from 'vitest';
import { isValidHexColor, normalizeHexColor } from '../../src/helpers/color.helpers.js';

describe('color.helpers', () => {
    describe('isValidHexColor', () => {
        it('should accept six-digit hex', () => {
            expect(isValidHexColor('#1e90ff')).toBe(true);
        });

        it('should accept three-digit shorthand', () => {
            expect(isValidHexColor('#abc')).toBe(true);
        });

        it('should accept uppercase and surrounding whitespace', () => {
            expect(isValidHexColor(' #1E90FF ')).toBe(true);
        });

        it('should reject named colors and functional notation', () => {
            expect(isValidHexColor('red')).toBe(false);
            expect(isValidHexColor('rgb(1,2,3)')).toBe(false);
            expect(isValidHexColor('url(https://example.test/x.png)')).toBe(false);
        });

        it('should reject malformed hex', () => {
            expect(isValidHexColor('#12345')).toBe(false);
            expect(isValidHexColor('#1234567')).toBe(false);
            expect(isValidHexColor('#gggggg')).toBe(false);
            expect(isValidHexColor('1e90ff')).toBe(false);
        });

        it('should reject non-strings', () => {
            expect(isValidHexColor(null)).toBe(false);
            expect(isValidHexColor(undefined)).toBe(false);
            expect(isValidHexColor(123)).toBe(false);
            expect(isValidHexColor({})).toBe(false);
        });
    });

    describe('normalizeHexColor', () => {
        it('should lower-case and trim', () => {
            expect(normalizeHexColor(' #1E90FF ')).toBe('#1e90ff');
        });

        it('should expand three-digit shorthand', () => {
            expect(normalizeHexColor('#ABC')).toBe('#aabbcc');
        });

        it('should return null for anything that is not a hex color', () => {
            expect(normalizeHexColor('red')).toBeNull();
            expect(normalizeHexColor('')).toBeNull();
            expect(normalizeHexColor(null)).toBeNull();
            expect(normalizeHexColor(undefined)).toBeNull();
        });

        // A tab color ends up in a CSS custom property, so a value carrying CSS tokens has to be
        // rejected outright rather than passed through.
        it('should reject a value that smuggles CSS tokens', () => {
            expect(normalizeHexColor('#fff; background: url(https://evil.test/x)')).toBeNull();
            expect(normalizeHexColor('url(https://evil.test/x)')).toBeNull();
            expect(normalizeHexColor('var(--pro-accent)')).toBeNull();
        });
    });
});
