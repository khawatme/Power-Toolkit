/**
 * @file Formatting Helpers Tests
 * @description Comprehensive tests for formatting utilities
 */

import { describe, it, expect } from 'vitest';
import { FormattingHelpers } from '../../src/helpers/formatting.helpers.js';

describe('FormattingHelpers', () => {
    describe('formatDisplayValue', () => {
        it('should return "null" for null values', () => {
            expect(FormattingHelpers.formatDisplayValue(null)).toBe('null');
        });

        it('should return "undefined" for undefined values', () => {
            expect(FormattingHelpers.formatDisplayValue(undefined)).toBe('undefined');
        });

        it('should format lookup values', () => {
            const lookupValue = [{ name: 'Test Account', id: '123' }];
            const attribute = {
                getAttributeType: () => 'lookup'
            };
            expect(FormattingHelpers.formatDisplayValue(lookupValue, attribute)).toBe('Test Account');
        });

        it('should use getText() when available', () => {
            const attribute = {
                getText: () => 'Formatted Text',
                getAttributeType: () => 'string'
            };
            expect(FormattingHelpers.formatDisplayValue('raw', attribute)).toBe('Formatted Text');
        });

        it('should handle array getText() results', () => {
            const attribute = {
                getText: () => ['Option 1', 'Option 2'],
                getAttributeType: () => 'multiselect'
            };
            expect(FormattingHelpers.formatDisplayValue([1, 2], attribute)).toBe('Option 1, Option 2');
        });

        it('should handle Date objects', () => {
            const date = new Date('2024-01-01T12:00:00');
            const result = FormattingHelpers.formatDisplayValue(date);
            expect(result).toContain('2024');
        });

        it('should format arrays with length info', () => {
            expect(FormattingHelpers.formatDisplayValue([1, 2, 3])).toBe('[3 items]');
            expect(FormattingHelpers.formatDisplayValue([])).toBe('[Empty Array]');
        });

        it('should convert primitives to strings', () => {
            expect(FormattingHelpers.formatDisplayValue(123)).toBe('123');
            expect(FormattingHelpers.formatDisplayValue(true)).toBe('true');
            expect(FormattingHelpers.formatDisplayValue('test')).toBe('test');
        });

        it('should handle subgrid controls', () => {
            expect(FormattingHelpers.formatDisplayValue('value', null, 'subgrid')).toBe('value');
        });
    });

    describe('formatValuePreview', () => {
        it('should return empty string for null/undefined', () => {
            expect(FormattingHelpers.formatValuePreview(null)).toBe('');
            expect(FormattingHelpers.formatValuePreview(undefined)).toBe('');
        });

        it('should return strings as-is', () => {
            expect(FormattingHelpers.formatValuePreview('test')).toBe('test');
        });

        it('should convert primitives to strings', () => {
            expect(FormattingHelpers.formatValuePreview(123)).toBe('123');
            expect(FormattingHelpers.formatValuePreview(true)).toBe('true');
        });

        it('should stringify objects', () => {
            const obj = { name: 'test', value: 123 };
            const result = FormattingHelpers.formatValuePreview(obj);
            expect(result).toContain('name');
            expect(result).toContain('test');
        });

        it('should truncate long values', () => {
            const longObj = { data: 'x'.repeat(300) };
            const result = FormattingHelpers.formatValuePreview(longObj, 100);
            expect(result.length).toBeLessThanOrEqual(100);
            expect(result).toContain('…');
        });

        it('should use default maxLength of 200', () => {
            const longString = JSON.stringify({ data: 'x'.repeat(300) });
            const result = FormattingHelpers.formatValuePreview(JSON.parse(longString));
            expect(result.length).toBeLessThanOrEqual(200);
        });

        it('should handle circular references gracefully', () => {
            const circular = { a: 1 };
            circular.self = circular;
            const result = FormattingHelpers.formatValuePreview(circular);
            expect(result).toBe('[object Object]');
        });
    });

    describe('formatMilliseconds', () => {
        it('should format valid milliseconds', () => {
            expect(FormattingHelpers.formatMilliseconds(123)).toBe('123 ms');
            expect(FormattingHelpers.formatMilliseconds(0)).toBe('0 ms');
            expect(FormattingHelpers.formatMilliseconds(1000)).toBe('1000 ms');
        });

        it('should round decimal values', () => {
            expect(FormattingHelpers.formatMilliseconds(123.7)).toBe('124 ms');
            expect(FormattingHelpers.formatMilliseconds(123.4)).toBe('123 ms');
        });

        it('should handle invalid values', () => {
            expect(FormattingHelpers.formatMilliseconds(NaN)).toBe('0 ms');
            expect(FormattingHelpers.formatMilliseconds(Infinity)).toBe('0 ms');
            expect(FormattingHelpers.formatMilliseconds(undefined)).toBe('0 ms');
        });

        it('should handle string numbers', () => {
            expect(FormattingHelpers.formatMilliseconds('123')).toBe('123 ms');
        });
    });

    describe('formatJsonIfValid', () => {
        it('should format valid JSON object', () => {
            const json = '{"name":"test","value":123}';
            const result = FormattingHelpers.formatJsonIfValid(json);
            expect(result).toContain('\n');
            expect(result).toContain('"name"');
        });

        it('should format valid JSON array', () => {
            const json = '[1,2,3]';
            const result = FormattingHelpers.formatJsonIfValid(json);
            expect(result).toContain('\n');
        });

        it('should return original value for invalid JSON', () => {
            const invalid = 'not json';
            expect(FormattingHelpers.formatJsonIfValid(invalid)).toBe(invalid);
        });

        it('should handle null and undefined', () => {
            expect(FormattingHelpers.formatJsonIfValid(null)).toBe('');
            expect(FormattingHelpers.formatJsonIfValid(undefined)).toBe('');
        });

        it('should return non-JSON strings as-is', () => {
            expect(FormattingHelpers.formatJsonIfValid('plain text')).toBe('plain text');
        });
    });

    describe('normalizeForJsonCompare', () => {
        it('should minify JSON objects', () => {
            const json = '{"name": "test", "value": 123}';
            const result = FormattingHelpers.normalizeForJsonCompare(json);
            expect(result).toBe('{"name":"test","value":123}');
        });

        it('should minify JSON arrays', () => {
            const json = '[1, 2, 3]';
            const result = FormattingHelpers.normalizeForJsonCompare(json);
            expect(result).toBe('[1,2,3]');
        });

        it('should return non-JSON strings trimmed', () => {
            expect(FormattingHelpers.normalizeForJsonCompare('  plain text  ')).toBe('plain text');
        });

        it('should handle null and undefined', () => {
            expect(FormattingHelpers.normalizeForJsonCompare(null)).toBe('');
            expect(FormattingHelpers.normalizeForJsonCompare(undefined)).toBe('');
        });
    });

    describe('roundToDecimal', () => {
        it('should round to 2 decimal places by default', () => {
            expect(FormattingHelpers.roundToDecimal(1.2345)).toBe(1.23);
            expect(FormattingHelpers.roundToDecimal(1.2367)).toBe(1.24);
        });

        it('should round to custom decimal places', () => {
            expect(FormattingHelpers.roundToDecimal(1.2345, 1)).toBe(1.2);
            expect(FormattingHelpers.roundToDecimal(1.2367, 3)).toBe(1.237);
        });

        it('should handle whole numbers', () => {
            expect(FormattingHelpers.roundToDecimal(5, 2)).toBe(5);
        });

        it('should handle zero', () => {
            expect(FormattingHelpers.roundToDecimal(0, 2)).toBe(0);
        });
    });

    describe('safeNumber', () => {
        it('should convert valid numbers', () => {
            expect(FormattingHelpers.safeNumber(123)).toBe(123);
            expect(FormattingHelpers.safeNumber('456')).toBe(456);
        });

        it('should return 0 for invalid values', () => {
            expect(FormattingHelpers.safeNumber(NaN)).toBe(0);
            expect(FormattingHelpers.safeNumber(Infinity)).toBe(0);
            expect(FormattingHelpers.safeNumber(undefined)).toBe(0);
            expect(FormattingHelpers.safeNumber('abc')).toBe(0);
        });

        it('should handle negative numbers', () => {
            expect(FormattingHelpers.safeNumber(-123)).toBe(-123);
        });
    });

    describe('calculatePercentages', () => {
        it('should calculate percentages from parts', () => {
            const result = FormattingHelpers.calculatePercentages({ a: 25, b: 75 });
            expect(result.a).toBe(25);
            expect(result.b).toBe(75);
        });

        it('should ensure total is 100%', () => {
            const result = FormattingHelpers.calculatePercentages({ a: 33, b: 33, c: 34 });
            const total = result.a + result.b + result.c;
            expect(total).toBe(100);
        });

        it('should handle zero total', () => {
            const result = FormattingHelpers.calculatePercentages({ a: 0, b: 0 });
            expect(result.a).toBe(0);
            expect(result.b).toBe(0);
        });

        it('should round to custom decimal places', () => {
            const result = FormattingHelpers.calculatePercentages({ a: 33.333, b: 66.667 }, 1);
            expect(result.a).toBeCloseTo(33.3, 1);
        });
    });

    describe('createInfoGrid', () => {
        it('should create HTML grid from rows', () => {
            const rows = [
                { label: 'Name', value: 'John Doe' },
                { label: 'Email', value: 'john@example.com' }
            ];
            const result = FormattingHelpers.createInfoGrid(rows);
            expect(result).toContain('<strong>Name:</strong>');
            expect(result).toContain('<span>John Doe</span>');
            expect(result).toContain('Email');
        });

        it('should escape HTML in labels and values', () => {
            const rows = [
                { label: '<script>', value: '<b>test</b>' }
            ];
            const result = FormattingHelpers.createInfoGrid(rows);
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        it('should handle HTML values when isHtml is true', () => {
            const rows = [
                { label: 'Link', value: '<a href="#">Click</a>', isHtml: true }
            ];
            const result = FormattingHelpers.createInfoGrid(rows);
            expect(result).toContain('<a href="#">Click</a>');
        });

        it('should return empty string for empty array', () => {
            expect(FormattingHelpers.createInfoGrid([])).toBe('');
        });

        it('should return empty string for null/undefined', () => {
            expect(FormattingHelpers.createInfoGrid(null)).toBe('');
            expect(FormattingHelpers.createInfoGrid(undefined)).toBe('');
        });
    });

    describe('formatJsonIfValid - catch block', () => {
        it('should return original value for malformed JSON that looks like JSON', () => {
            // String that looks like JSON (starts with { and ends with }) but is invalid
            const malformed = '{invalid json content}';
            expect(FormattingHelpers.formatJsonIfValid(malformed)).toBe(malformed);
        });

        it('should return original value for malformed array-like JSON', () => {
            // String that looks like a JSON array but is invalid
            const malformed = '[invalid, array, content]';
            expect(FormattingHelpers.formatJsonIfValid(malformed)).toBe(malformed);
        });

        it('should return original value for JSON with trailing comma', () => {
            const malformed = '{"key": "value",}';
            expect(FormattingHelpers.formatJsonIfValid(malformed)).toBe(malformed);
        });
    });

    describe('normalizeForJsonCompare - catch block', () => {
        it('should return trimmed value for malformed JSON that looks like JSON', () => {
            // String that looks like JSON but is invalid, should trigger catch block
            const malformed = '{broken: json}';
            expect(FormattingHelpers.normalizeForJsonCompare(malformed)).toBe(malformed);
        });

        it('should return trimmed value for malformed array-like JSON', () => {
            const malformed = '[1, 2, }';
            expect(FormattingHelpers.normalizeForJsonCompare(malformed)).toBe(malformed);
        });

        it('should return trimmed value when JSON parse throws', () => {
            const malformed = '{"unclosed": "string}';
            expect(FormattingHelpers.normalizeForJsonCompare(malformed)).toBe(malformed);
        });
    });
});
