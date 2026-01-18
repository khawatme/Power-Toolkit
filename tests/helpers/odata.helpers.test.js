/**
 * @file OData Helpers Tests
 * @description Comprehensive tests for OData query and API utilities
 */

import { describe, it, expect } from 'vitest';
import { ODataHelpers } from '../../src/helpers/odata.helpers.js';

describe('ODataHelpers', () => {
    describe('FILTER_OPERATORS', () => {
        it('should have all standard operators', () => {
            const operators = ODataHelpers.FILTER_OPERATORS;

            expect(operators.find(op => op.text === 'Equals')).toBeTruthy();
            expect(operators.find(op => op.text === 'Not Equals')).toBeTruthy();
            expect(operators.find(op => op.text === 'Contains')).toBeTruthy();
            expect(operators.find(op => op.text === 'Greater Than')).toBeTruthy();
        });

        it('should have correct fetch/odata mappings', () => {
            const equals = ODataHelpers.FILTER_OPERATORS.find(op => op.text === 'Equals');
            expect(equals.fetch).toBe('eq');
            expect(equals.odata).toBe('eq');
        });

        it('should have null operators', () => {
            const isNull = ODataHelpers.FILTER_OPERATORS.find(op => op.text === 'Is Null');
            expect(isNull.fetch).toBe('null');
            expect(isNull.odata).toBe('eq null');
        });
    });

    describe('escapeODataString', () => {
        it('should double single quotes', () => {
            expect(ODataHelpers.escapeODataString("O'Brien")).toBe("O''Brien");
        });

        it('should handle multiple quotes', () => {
            expect(ODataHelpers.escapeODataString("It's a 'test'")).toBe("It''s a ''test''");
        });

        it('should handle empty strings', () => {
            expect(ODataHelpers.escapeODataString('')).toBe('');
        });

        it('should handle null/undefined', () => {
            expect(ODataHelpers.escapeODataString(null)).toBe('');
            expect(ODataHelpers.escapeODataString(undefined)).toBe('');
        });

        it('should not escape other characters', () => {
            expect(ODataHelpers.escapeODataString('Test & <script>')).toBe('Test & <script>');
        });

        it('should convert non-strings to strings', () => {
            expect(ODataHelpers.escapeODataString(123)).toBe('123');
        });
    });

    describe('formatODataValue', () => {
        it('should format booleans', () => {
            expect(ODataHelpers.formatODataValue(true)).toBe('true');
            expect(ODataHelpers.formatODataValue('TRUE')).toBe('true');
            expect(ODataHelpers.formatODataValue('False')).toBe('false');
        });

        it('should format GUIDs without quotes', () => {
            const guid = '123e4567-e89b-12d3-a456-426614174000';
            expect(ODataHelpers.formatODataValue(guid)).toBe(guid);
        });

        it('should format numbers without quotes', () => {
            expect(ODataHelpers.formatODataValue(42)).toBe('42');
            expect(ODataHelpers.formatODataValue('123')).toBe('123');
            expect(ODataHelpers.formatODataValue(3.14)).toBe('3.14');
        });

        it('should format dates with quotes', () => {
            const result = ODataHelpers.formatODataValue('2024-01-15');
            expect(result).toContain("'");
            expect(result).toContain('2024');
        });

        it('should format strings with quotes', () => {
            expect(ODataHelpers.formatODataValue('test')).toBe("'test'");
        });

        it('should escape quotes in strings', () => {
            expect(ODataHelpers.formatODataValue("O'Brien")).toBe("'O''Brien'");
        });

        it('should handle zero', () => {
            expect(ODataHelpers.formatODataValue(0)).toBe('0');
        });
    });

    describe('shouldShowOperatorValue', () => {
        it('should return false for null operators', () => {
            expect(ODataHelpers.shouldShowOperatorValue('null')).toBe(false);
            expect(ODataHelpers.shouldShowOperatorValue('not-null')).toBe(false);
            expect(ODataHelpers.shouldShowOperatorValue('eq null')).toBe(false);
            expect(ODataHelpers.shouldShowOperatorValue('ne null')).toBe(false);
        });

        it('should return true for other operators', () => {
            expect(ODataHelpers.shouldShowOperatorValue('eq')).toBe(true);
            expect(ODataHelpers.shouldShowOperatorValue('ne')).toBe(true);
            expect(ODataHelpers.shouldShowOperatorValue('contains')).toBe(true);
            expect(ODataHelpers.shouldShowOperatorValue('gt')).toBe(true);
        });

        it('should handle case insensitively', () => {
            expect(ODataHelpers.shouldShowOperatorValue('NULL')).toBe(false);
            expect(ODataHelpers.shouldShowOperatorValue('NOT-NULL')).toBe(false);
        });

        it('should return true for null/undefined input', () => {
            expect(ODataHelpers.shouldShowOperatorValue(null)).toBe(true);
            expect(ODataHelpers.shouldShowOperatorValue(undefined)).toBe(true);
            expect(ODataHelpers.shouldShowOperatorValue('')).toBe(true);
        });
    });

    describe('buildODataFilterClauses', () => {
        it('should build simple filter clauses', () => {
            const filters = { name: 'test' };
            const result = ODataHelpers.buildODataFilterClauses(filters);

            expect(result).toContain("$filter=");
            expect(result).toContain("contains(name, 'test')");
        });

        it('should combine multiple filters with AND', () => {
            const filters = { name: 'test', city: 'Seattle' };
            const result = ODataHelpers.buildODataFilterClauses(filters);

            expect(result).toContain("contains(name, 'test')");
            expect(result).toContain("contains(city, 'Seattle')");
            expect(result).toContain(' and ');
        });

        it('should skip empty/null values', () => {
            const filters = { name: 'test', empty: '', nullValue: null };
            const result = ODataHelpers.buildODataFilterClauses(filters);

            expect(result).toContain('name');
            expect(result).not.toContain('empty');
            expect(result).not.toContain('nullValue');
        });

        it('should trim whitespace', () => {
            const filters = { name: '  test  ' };
            const result = ODataHelpers.buildODataFilterClauses(filters);

            expect(result).toContain("'test'");
        });

        it('should escape quotes in values', () => {
            const filters = { name: "O'Brien" };
            const result = ODataHelpers.buildODataFilterClauses(filters);

            expect(result).toContain("O''Brien");
        });

        it('should return empty string for null/undefined input', () => {
            expect(ODataHelpers.buildODataFilterClauses(null)).toBe('');
            expect(ODataHelpers.buildODataFilterClauses(undefined)).toBe('');
        });

        it('should return empty string for empty object', () => {
            expect(ODataHelpers.buildODataFilterClauses({})).toBe('');
        });

        it('should return empty string for object with only empty values', () => {
            const filters = { name: '', city: '   ' };
            expect(ODataHelpers.buildODataFilterClauses(filters)).toBe('');
        });
    });

    describe('normalizeApiResponse', () => {
        it('should handle array responses', () => {
            const response = [{ id: 1 }, { id: 2 }];
            const result = ODataHelpers.normalizeApiResponse(response);

            expect(result.entities).toEqual(response);
        });

        it('should handle responses with value property', () => {
            const response = { value: [{ id: 1 }, { id: 2 }] };
            const result = ODataHelpers.normalizeApiResponse(response);

            expect(result.entities).toEqual(response.value);
        });

        it('should handle responses with entities property', () => {
            const response = { entities: [{ id: 1 }, { id: 2 }] };
            const result = ODataHelpers.normalizeApiResponse(response);

            expect(result).toEqual(response);
        });

        it('should handle single object responses', () => {
            const response = { id: 1, name: 'Test' };
            const result = ODataHelpers.normalizeApiResponse(response);

            expect(result.entities).toEqual([response]);
        });

        it('should handle null/undefined responses', () => {
            expect(ODataHelpers.normalizeApiResponse(null).entities).toEqual([]);
            expect(ODataHelpers.normalizeApiResponse(undefined).entities).toEqual([]);
        });

        it('should handle empty arrays', () => {
            const result = ODataHelpers.normalizeApiResponse([]);
            expect(result.entities).toEqual([]);
        });

        it('should preserve additional response properties', () => {
            const response = {
                entities: [{ id: 1 }],
                '@odata.context': 'context',
                '@odata.count': 1
            };
            const result = ODataHelpers.normalizeApiResponse(response);

            expect(result['@odata.context']).toBe('context');
            expect(result['@odata.count']).toBe(1);
        });
    });

    describe('integration tests', () => {
        it('should work together for building filters', () => {
            const filters = { name: "O'Brien", status: 'Active' };
            const filterClause = ODataHelpers.buildODataFilterClauses(filters);

            expect(filterClause).toContain("$filter=");
            expect(filterClause).toContain("contains(name, 'O''Brien')");
            expect(filterClause).toContain("contains(status, 'Active')");
            expect(filterClause).toContain(" and ");
        });

        it('should handle complex value formatting', () => {
            const values = [
                { input: true, expected: 'true' },
                { input: 123, expected: '123' },
                { input: "test's", expected: "'test''s'" },
                { input: '123e4567-e89b-12d3-a456-426614174000', expected: '123e4567-e89b-12d3-a456-426614174000' }
            ];

            values.forEach(({ input, expected }) => {
                expect(ODataHelpers.formatODataValue(input)).toBe(expected);
            });
        });
    });

    describe('filterODataProperties', () => {
        it('should filter out null values', () => {
            const obj = { name: 'Test', nullProp: null, age: 25 };
            const result = ODataHelpers.filterODataProperties(obj);

            expect(result).toEqual([['age', 25], ['name', 'Test']]);
        });

        it('should filter out object values', () => {
            const obj = {
                name: 'Test',
                nested: { inner: 'value' },
                id: 1
            };
            const result = ODataHelpers.filterODataProperties(obj);

            expect(result).toEqual([['id', 1], ['name', 'Test']]);
        });

        it('should filter out array values', () => {
            const obj = {
                name: 'Test',
                items: [1, 2, 3],
                active: true
            };
            const result = ODataHelpers.filterODataProperties(obj);

            expect(result).toEqual([['active', true], ['name', 'Test']]);
        });

        it('should filter out @odata metadata properties', () => {
            const obj = {
                name: 'Test',
                '@odata.context': 'http://example.com',
                '@odata.etag': 'W/"12345"',
                id: 1
            };
            const result = ODataHelpers.filterODataProperties(obj);

            expect(result).toEqual([['id', 1], ['name', 'Test']]);
        });

        it('should sort results alphabetically by key', () => {
            const obj = { zeta: 'z', alpha: 'a', beta: 'b' };
            const result = ODataHelpers.filterODataProperties(obj);

            expect(result).toEqual([['alpha', 'a'], ['beta', 'b'], ['zeta', 'z']]);
        });

        it('should return empty array for null input', () => {
            expect(ODataHelpers.filterODataProperties(null)).toEqual([]);
        });

        it('should return empty array for undefined input', () => {
            expect(ODataHelpers.filterODataProperties(undefined)).toEqual([]);
        });

        it('should return empty array for non-object input', () => {
            expect(ODataHelpers.filterODataProperties('string')).toEqual([]);
            expect(ODataHelpers.filterODataProperties(123)).toEqual([]);
            expect(ODataHelpers.filterODataProperties(true)).toEqual([]);
        });

        it('should keep string, number, and boolean values', () => {
            const obj = {
                str: 'text',
                num: 42,
                bool: false,
                zero: 0,
                emptyStr: ''
            };
            const result = ODataHelpers.filterODataProperties(obj);

            expect(result).toEqual([
                ['bool', false],
                ['emptyStr', ''],
                ['num', 42],
                ['str', 'text'],
                ['zero', 0]
            ]);
        });

        it('should handle empty object', () => {
            expect(ODataHelpers.filterODataProperties({})).toEqual([]);
        });

        it('should handle object with only filtered properties', () => {
            const obj = {
                '@odata.context': 'context',
                nested: { a: 1 },
                nullValue: null
            };
            expect(ODataHelpers.filterODataProperties(obj)).toEqual([]);
        });
    });

    describe('FILTER_OPERATORS - extended', () => {
        it('should have correct count of operators', () => {
            expect(ODataHelpers.FILTER_OPERATORS.length).toBe(16);
        });

        it('should have comparison operators with matching fetch/odata values', () => {
            const gt = ODataHelpers.FILTER_OPERATORS.find(op => op.text === 'Greater Than');
            expect(gt.fetch).toBe('gt');
            expect(gt.odata).toBe('gt');

            const le = ODataHelpers.FILTER_OPERATORS.find(op => op.text === 'Less or Equal');
            expect(le.fetch).toBe('le');
            expect(le.odata).toBe('le');
        });

        it('should have operators with null odata values for FetchXML-only', () => {
            const like = ODataHelpers.FILTER_OPERATORS.find(op => op.text === 'Like');
            expect(like.fetch).toBe('like');
            expect(like.odata).toBeNull();

            const inOp = ODataHelpers.FILTER_OPERATORS.find(op => op.text === 'In');
            expect(inOp.fetch).toBe('in');
            expect(inOp.odata).toBeNull();
        });

        it('should have operators with null fetch values for OData-only', () => {
            const contains = ODataHelpers.FILTER_OPERATORS.find(op => op.text === 'Contains');
            expect(contains.fetch).toBeNull();
            expect(contains.odata).toBe('contains');

            const startsWith = ODataHelpers.FILTER_OPERATORS.find(op => op.text === 'Starts With');
            expect(startsWith.fetch).toBeNull();
            expect(startsWith.odata).toBe('startswith');
        });

        it('should have Not Contains operator', () => {
            const notContains = ODataHelpers.FILTER_OPERATORS.find(op => op.text === 'Not Contains');
            expect(notContains).toBeTruthy();
            expect(notContains.odata).toBe('not contains');
        });
    });

    describe('formatODataValue - extended edge cases', () => {
        it('should handle negative numbers', () => {
            expect(ODataHelpers.formatODataValue(-42)).toBe('-42');
            expect(ODataHelpers.formatODataValue('-100')).toBe('-100');
        });

        it('should handle decimal numbers', () => {
            expect(ODataHelpers.formatODataValue(0.001)).toBe('0.001');
            expect(ODataHelpers.formatODataValue('3.14159')).toBe('3.14159');
        });

        it('should handle uppercase GUID', () => {
            const guid = 'ABCDEF00-1234-5678-90AB-CDEF12345678';
            expect(ODataHelpers.formatODataValue(guid)).toBe(guid);
        });

        it('should handle mixed case GUID', () => {
            const guid = 'AbCdEf00-1234-5678-90aB-CdEf12345678';
            expect(ODataHelpers.formatODataValue(guid)).toBe(guid);
        });

        it('should handle ISO date strings', () => {
            const result = ODataHelpers.formatODataValue('2024-06-15T14:30:00.000Z');
            expect(result).toContain("'");
            expect(result).toContain('2024-06-15');
        });

        it('should handle strings that look like partial GUIDs as strings', () => {
            const partialGuid = '123e4567-e89b-12d3';
            const result = ODataHelpers.formatODataValue(partialGuid);
            expect(result).toContain("'");
        });

        it('should handle empty string', () => {
            expect(ODataHelpers.formatODataValue('')).toBe('0');
        });

        it('should handle string with only spaces as number', () => {
            // Note: '   ' parses as Number('') = 0 in JS
            const result = ODataHelpers.formatODataValue('   ');
            expect(result).toBe('0');
        });

        it('should handle special characters in strings', () => {
            expect(ODataHelpers.formatODataValue('test@domain.com')).toBe("'test@domain.com'");
            expect(ODataHelpers.formatODataValue('value with spaces')).toBe("'value with spaces'");
        });
    });

    describe('normalizeApiResponse - extended edge cases', () => {
        it('should handle response with empty value array', () => {
            const response = { value: [] };
            const result = ODataHelpers.normalizeApiResponse(response);
            expect(result.entities).toEqual([]);
        });

        it('should handle response with non-array value property', () => {
            const response = { value: 'not an array' };
            const result = ODataHelpers.normalizeApiResponse(response);
            expect(result.entities).toEqual([response]);
        });

        it('should handle response with empty entities array', () => {
            const response = { entities: [] };
            const result = ODataHelpers.normalizeApiResponse(response);
            expect(result.entities).toEqual([]);
        });

        it('should handle response with non-array entities property', () => {
            const response = { entities: 'not an array' };
            const result = ODataHelpers.normalizeApiResponse(response);
            expect(result.entities).toEqual([response]);
        });

        it('should handle deeply nested objects as single entity', () => {
            const response = {
                id: 1,
                details: {
                    nested: {
                        value: 'deep'
                    }
                }
            };
            const result = ODataHelpers.normalizeApiResponse(response);
            expect(result.entities).toEqual([response]);
        });

        it('should handle primitives by wrapping in array', () => {
            const numResult = ODataHelpers.normalizeApiResponse(42);
            expect(numResult.entities).toEqual([42]);

            const strResult = ODataHelpers.normalizeApiResponse('test');
            expect(strResult.entities).toEqual(['test']);

            const boolResult = ODataHelpers.normalizeApiResponse(true);
            expect(boolResult.entities).toEqual([true]);
        });
    });

    describe('buildODataFilterClauses - extended edge cases', () => {
        it('should handle non-object inputs', () => {
            expect(ODataHelpers.buildODataFilterClauses('string')).toBe('');
            expect(ODataHelpers.buildODataFilterClauses(123)).toBe('');
            expect(ODataHelpers.buildODataFilterClauses(true)).toBe('');
            expect(ODataHelpers.buildODataFilterClauses([])).toBe('');
        });

        it('should handle numeric values as strings', () => {
            const filters = { count: 42 };
            const result = ODataHelpers.buildODataFilterClauses(filters);
            expect(result).toContain("contains(count, '42')");
        });

        it('should handle boolean values as strings', () => {
            const filters = { active: true };
            const result = ODataHelpers.buildODataFilterClauses(filters);
            expect(result).toContain("contains(active, 'true')");
        });

        it('should handle special characters in filter values', () => {
            const filters = { email: 'test@example.com' };
            const result = ODataHelpers.buildODataFilterClauses(filters);
            expect(result).toContain("contains(email, 'test@example.com')");
        });

        it('should handle undefined values by skipping them', () => {
            const filters = { name: 'test', missing: undefined };
            const result = ODataHelpers.buildODataFilterClauses(filters);
            expect(result).toContain('name');
            expect(result).not.toContain('missing');
        });

        it('should produce correct filter format prefix', () => {
            const filters = { name: 'test' };
            const result = ODataHelpers.buildODataFilterClauses(filters);
            expect(result.startsWith('&$filter=')).toBe(true);
        });
    });

    describe('shouldShowOperatorValue - extended edge cases', () => {
        it('should handle whitespace around operators', () => {
            expect(ODataHelpers.shouldShowOperatorValue('  null  ')).toBe(false);
            expect(ODataHelpers.shouldShowOperatorValue(' eq null ')).toBe(false);
        });

        it('should return true for all standard comparison operators', () => {
            const comparisonOps = ['eq', 'ne', 'gt', 'ge', 'lt', 'le'];
            comparisonOps.forEach(op => {
                expect(ODataHelpers.shouldShowOperatorValue(op)).toBe(true);
            });
        });

        it('should return true for function operators', () => {
            expect(ODataHelpers.shouldShowOperatorValue('contains')).toBe(true);
            expect(ODataHelpers.shouldShowOperatorValue('startswith')).toBe(true);
            expect(ODataHelpers.shouldShowOperatorValue('endswith')).toBe(true);
        });
    });

    describe('escapeODataString - extended edge cases', () => {
        it('should handle strings with only quotes', () => {
            expect(ODataHelpers.escapeODataString("'''")).toBe("''''''");
        });

        it('should handle non-string inputs by converting to string', () => {
            expect(ODataHelpers.escapeODataString(true)).toBe('true');
            // Note: false is falsy, so returns '' per implementation
            expect(ODataHelpers.escapeODataString(false)).toBe('');
            // Note: 0 is falsy, so returns '' per implementation
            expect(ODataHelpers.escapeODataString(0)).toBe('');
        });

        it('should handle truthy non-string values', () => {
            expect(ODataHelpers.escapeODataString(123)).toBe('123');
            expect(ODataHelpers.escapeODataString(-1)).toBe('-1');
            expect(ODataHelpers.escapeODataString([])).toBe('');
            expect(ODataHelpers.escapeODataString({})).toBe('[object Object]');
        });

        it('should handle unicode characters', () => {
            expect(ODataHelpers.escapeODataString('日本語')).toBe('日本語');
            expect(ODataHelpers.escapeODataString('émojis 🎉')).toBe('émojis 🎉');
        });

        it('should preserve newlines and tabs', () => {
            expect(ODataHelpers.escapeODataString('line1\nline2')).toBe('line1\nline2');
            expect(ODataHelpers.escapeODataString('col1\tcol2')).toBe('col1\tcol2');
        });
    });
});
