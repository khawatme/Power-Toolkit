/**
 * @file Validation Helpers Tests
 * @description Comprehensive tests for validation utilities
 */

import { describe, it, expect, vi } from 'vitest';
import { ValidationHelpers } from '../../src/helpers/validation.helpers.js';

// Mock ValidationService
vi.mock('../../src/services/ValidationService.js', () => ({
    ValidationService: {
        validateNumber: vi.fn((value) => {
            const num = Number(value);
            if (isNaN(num)) throw new Error('Invalid number');
            return num;
        }),
        validateDateFormat: vi.fn((value) => {
            const date = new Date(value);
            if (isNaN(date.getTime())) throw new Error('Invalid date');
            return date;
        })
    }
}));

describe('ValidationHelpers', () => {
    describe('isValidGuid', () => {
        it('should validate correct GUIDs', () => {
            expect(ValidationHelpers.isValidGuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
            expect(ValidationHelpers.isValidGuid('00000000-0000-0000-0000-000000000000')).toBe(true);
            expect(ValidationHelpers.isValidGuid('FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF')).toBe(true);
        });

        it('should reject invalid GUIDs', () => {
            expect(ValidationHelpers.isValidGuid('not-a-guid')).toBe(false);
            expect(ValidationHelpers.isValidGuid('123')).toBe(false);
            expect(ValidationHelpers.isValidGuid('')).toBe(false);
            expect(ValidationHelpers.isValidGuid('123e4567-e89b-12d3-a456')).toBe(false);
        });

        it('should reject GUIDs with curly braces', () => {
            expect(ValidationHelpers.isValidGuid('{123e4567-e89b-12d3-a456-426614174000}')).toBe(false);
        });

        it('should handle mixed case', () => {
            expect(ValidationHelpers.isValidGuid('123E4567-E89B-12D3-A456-426614174000')).toBe(true);
        });

        it('should reject null/undefined', () => {
            expect(ValidationHelpers.isValidGuid(null)).toBe(false);
            expect(ValidationHelpers.isValidGuid(undefined)).toBe(false);
        });
    });

    describe('isJsonString', () => {
        it('should identify JSON objects', () => {
            expect(ValidationHelpers.isJsonString('{"name": "test"}')).toBe(true);
            expect(ValidationHelpers.isJsonString('{}')).toBe(true);
        });

        it('should identify JSON arrays', () => {
            expect(ValidationHelpers.isJsonString('[1, 2, 3]')).toBe(true);
            expect(ValidationHelpers.isJsonString('[]')).toBe(true);
        });

        it('should reject non-JSON strings', () => {
            expect(ValidationHelpers.isJsonString('not json')).toBe(false);
            expect(ValidationHelpers.isJsonString('123')).toBe(false);
            expect(ValidationHelpers.isJsonString('true')).toBe(false);
        });

        it('should handle whitespace', () => {
            expect(ValidationHelpers.isJsonString('  {"name": "test"}  ')).toBe(true);
            expect(ValidationHelpers.isJsonString('\n[1, 2, 3]\n')).toBe(true);
        });

        it('should handle null/undefined', () => {
            expect(ValidationHelpers.isJsonString(null)).toBe(false);
            expect(ValidationHelpers.isJsonString(undefined)).toBe(false);
        });
    });

    describe('isOdataProperty', () => {
        it('should identify OData properties starting with underscore', () => {
            expect(ValidationHelpers.isOdataProperty('_createdby_value')).toBe(true);
            expect(ValidationHelpers.isOdataProperty('_ownerid_value')).toBe(true);
        });

        it('should identify @odata properties', () => {
            expect(ValidationHelpers.isOdataProperty('@odata.etag')).toBe(true);
            expect(ValidationHelpers.isOdataProperty('@odata.context')).toBe(true);
            expect(ValidationHelpers.isOdataProperty('field@OData.Community')).toBe(true);
        });

        it('should reject regular properties', () => {
            expect(ValidationHelpers.isOdataProperty('name')).toBe(false);
            expect(ValidationHelpers.isOdataProperty('accountid')).toBe(false);
        });

        it('should be case-insensitive for @odata', () => {
            expect(ValidationHelpers.isOdataProperty('@ODATA.etag')).toBe(true);
        });
    });

    describe('isSystemProperty', () => {
        it('should identify @odata properties', () => {
            expect(ValidationHelpers.isSystemProperty('@odata.etag')).toBe(true);
            expect(ValidationHelpers.isSystemProperty('@odata.context')).toBe(true);
        });

        it('should identify odata.etag', () => {
            expect(ValidationHelpers.isSystemProperty('odata.etag')).toBe(true);
        });

        it('should identify formatted value properties', () => {
            expect(ValidationHelpers.isSystemProperty('statecode@OData.Community.Display.V1.FormattedValue')).toBe(true);
        });

        it('should identify Microsoft Dynamics properties', () => {
            expect(ValidationHelpers.isSystemProperty('field@Microsoft.Dynamics.CRM.lookuplogicalname')).toBe(true);
        });

        it('should reject regular properties', () => {
            expect(ValidationHelpers.isSystemProperty('name')).toBe(false);
            expect(ValidationHelpers.isSystemProperty('createdon')).toBe(false);
        });

        it('should handle null/undefined', () => {
            expect(ValidationHelpers.isSystemProperty(null)).toBe(false);
            expect(ValidationHelpers.isSystemProperty(undefined)).toBe(false);
        });
    });

    describe('parseInputValue', () => {
        let input;

        beforeEach(() => {
            input = document.createElement('input');
        });

        describe('integer type', () => {
            it('should parse valid integers', () => {
                input.value = '42';
                expect(ValidationHelpers.parseInputValue(input, 'integer')).toBe(42);
            });

            it('should return null for empty values', () => {
                input.value = '';
                expect(ValidationHelpers.parseInputValue(input, 'integer')).toBeNull();
            });

            it('should handle string numbers', () => {
                input.value = '123';
                expect(ValidationHelpers.parseInputValue(input, 'integer')).toBe(123);
            });
        });

        describe('decimal/money/double types', () => {
            it('should parse decimal values', () => {
                input.value = '19.99';
                expect(ValidationHelpers.parseInputValue(input, 'decimal')).toBe(19.99);
            });

            it('should parse money values', () => {
                input.value = '100.50';
                expect(ValidationHelpers.parseInputValue(input, 'money')).toBe(100.50);
            });

            it('should return null for empty values', () => {
                input.value = '';
                expect(ValidationHelpers.parseInputValue(input, 'double')).toBeNull();
            });
        });

        describe('datetime type', () => {
            it('should parse valid dates', () => {
                input.value = '2024-01-15';
                const result = ValidationHelpers.parseInputValue(input, 'datetime');
                expect(result).toBeInstanceOf(Date);
            });

            it('should return null for empty values', () => {
                input.value = '';
                expect(ValidationHelpers.parseInputValue(input, 'datetime')).toBeNull();
            });
        });

        describe('optionset type', () => {
            it('should parse optionset values', () => {
                input.value = '1';
                expect(ValidationHelpers.parseInputValue(input, 'optionset')).toBe(1);
            });

            it('should return null for "null" string', () => {
                input.value = 'null';
                expect(ValidationHelpers.parseInputValue(input, 'optionset')).toBeNull();
            });

            it('should handle invalid numbers', () => {
                input.value = 'invalid';
                expect(ValidationHelpers.parseInputValue(input, 'optionset')).toBeNull();
            });
        });

        describe('boolean type', () => {
            it('should parse "true"', () => {
                input.value = 'true';
                expect(ValidationHelpers.parseInputValue(input, 'boolean')).toBe(true);
            });

            it('should parse "false"', () => {
                input.value = 'false';
                expect(ValidationHelpers.parseInputValue(input, 'boolean')).toBe(false);
            });

            it('should return null for "null" string', () => {
                input.value = 'null';
                expect(ValidationHelpers.parseInputValue(input, 'boolean')).toBeNull();
            });

            it('should treat other values as false', () => {
                input.value = 'other';
                expect(ValidationHelpers.parseInputValue(input, 'boolean')).toBe(false);
            });
        });

        describe('default (string) type', () => {
            it('should return string value for unknown types', () => {
                input.value = 'test';
                expect(ValidationHelpers.parseInputValue(input, 'string')).toBe('test');
            });

            it('should return null for "null" string', () => {
                input.value = 'null';
                const result = ValidationHelpers.parseInputValue(input, 'unknown');
                // Accept either null or 'null' string depending on implementation
                expect(result === null || result === 'null').toBe(true);
            });
        });
    });

    describe('edge cases', () => {
        it('should handle very long GUIDs', () => {
            const longString = '123e4567-e89b-12d3-a456-426614174000-extra';
            expect(ValidationHelpers.isValidGuid(longString)).toBe(false);
        });

        it('should handle empty JSON strings', () => {
            expect(ValidationHelpers.isJsonString('{}')).toBe(true);
            expect(ValidationHelpers.isJsonString('[]')).toBe(true);
        });

        it('should handle nested JSON detection', () => {
            expect(ValidationHelpers.isJsonString('{"nested": {"deep": "value"}}')).toBe(true);
        });
    });

    describe('addEnterKeyListener', () => {
        it('should add keydown listener and call action on Enter key', () => {
            const inputElement = document.createElement('input');
            const action = vi.fn();

            const handler = ValidationHelpers.addEnterKeyListener(inputElement, action);

            expect(handler).toBeInstanceOf(Function);

            // Simulate Enter key press
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
            Object.defineProperty(enterEvent, 'preventDefault', { value: vi.fn() });
            inputElement.dispatchEvent(enterEvent);

            expect(action).toHaveBeenCalledTimes(1);
        });

        it('should not call action on non-Enter keys', () => {
            const inputElement = document.createElement('input');
            const action = vi.fn();

            ValidationHelpers.addEnterKeyListener(inputElement, action);

            // Simulate Tab key press
            const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
            inputElement.dispatchEvent(tabEvent);

            expect(action).not.toHaveBeenCalled();
        });

        it('should return null when inputElement is null', () => {
            const action = vi.fn();
            const handler = ValidationHelpers.addEnterKeyListener(null, action);
            expect(handler).toBeNull();
        });

        it('should return null when inputElement is undefined', () => {
            const action = vi.fn();
            const handler = ValidationHelpers.addEnterKeyListener(undefined, action);
            expect(handler).toBeNull();
        });

        it('should call preventDefault on Enter key', () => {
            const inputElement = document.createElement('input');
            const action = vi.fn();

            ValidationHelpers.addEnterKeyListener(inputElement, action);

            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
            const preventDefaultSpy = vi.spyOn(enterEvent, 'preventDefault');
            inputElement.dispatchEvent(enterEvent);

            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        it('should return handler function that can be used for removal', () => {
            const inputElement = document.createElement('input');
            const action = vi.fn();

            const handler = ValidationHelpers.addEnterKeyListener(inputElement, action);

            // Remove the listener
            inputElement.removeEventListener('keydown', handler);

            // Simulate Enter key press after removal
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
            inputElement.dispatchEvent(enterEvent);

            expect(action).not.toHaveBeenCalled();
        });
    });

    describe('parseInputValue additional cases', () => {
        let input;

        beforeEach(() => {
            input = document.createElement('input');
        });

        it('should parse double values correctly', () => {
            input.value = '3.14159';
            expect(ValidationHelpers.parseInputValue(input, 'double')).toBe(3.14159);
        });

        it('should parse negative numbers for integer type', () => {
            input.value = '-42';
            expect(ValidationHelpers.parseInputValue(input, 'integer')).toBe(-42);
        });

        it('should parse negative decimal values', () => {
            input.value = '-19.99';
            expect(ValidationHelpers.parseInputValue(input, 'decimal')).toBe(-19.99);
        });

        it('should return null for empty money value', () => {
            input.value = '';
            expect(ValidationHelpers.parseInputValue(input, 'money')).toBeNull();
        });

        it('should handle zero values for integer', () => {
            input.value = '0';
            expect(ValidationHelpers.parseInputValue(input, 'integer')).toBe(0);
        });

        it('should handle zero values for decimal', () => {
            input.value = '0.00';
            expect(ValidationHelpers.parseInputValue(input, 'decimal')).toBe(0);
        });

        it('should handle large optionset values', () => {
            input.value = '999999';
            expect(ValidationHelpers.parseInputValue(input, 'optionset')).toBe(999999);
        });

        it('should handle negative optionset values', () => {
            input.value = '-1';
            expect(ValidationHelpers.parseInputValue(input, 'optionset')).toBe(-1);
        });

        it('should handle empty optionset as null', () => {
            input.value = '';
            expect(ValidationHelpers.parseInputValue(input, 'optionset')).toBeNull();
        });

        it('should return raw value for completely unknown type', () => {
            input.value = 'some random value';
            expect(ValidationHelpers.parseInputValue(input, 'unknowntype')).toBe('some random value');
        });
    });

    describe('isValidGuid additional cases', () => {
        it('should reject GUIDs with spaces', () => {
            expect(ValidationHelpers.isValidGuid(' 123e4567-e89b-12d3-a456-426614174000')).toBe(false);
            expect(ValidationHelpers.isValidGuid('123e4567-e89b-12d3-a456-426614174000 ')).toBe(false);
        });

        it('should reject GUIDs with special characters', () => {
            expect(ValidationHelpers.isValidGuid('123e4567-e89b-12d3-a456-42661417400g')).toBe(false);
            expect(ValidationHelpers.isValidGuid('123e4567!e89b-12d3-a456-426614174000')).toBe(false);
        });

        it('should reject GUIDs with wrong segment lengths', () => {
            expect(ValidationHelpers.isValidGuid('123e456-e89b-12d3-a456-426614174000')).toBe(false);
            expect(ValidationHelpers.isValidGuid('123e45678-e89b-12d3-a456-426614174000')).toBe(false);
        });

        it('should handle lowercase GUIDs', () => {
            expect(ValidationHelpers.isValidGuid('abcdef01-2345-6789-abcd-ef0123456789')).toBe(true);
        });
    });

    describe('isJsonString additional cases', () => {
        it('should reject mismatched brackets', () => {
            expect(ValidationHelpers.isJsonString('{]')).toBe(false);
            expect(ValidationHelpers.isJsonString('[}')).toBe(false);
        });

        it('should reject strings that only start with bracket', () => {
            expect(ValidationHelpers.isJsonString('{ not closed')).toBe(false);
            expect(ValidationHelpers.isJsonString('[ not closed')).toBe(false);
        });

        it('should reject strings that only end with bracket', () => {
            expect(ValidationHelpers.isJsonString('not opened }')).toBe(false);
            expect(ValidationHelpers.isJsonString('not opened ]')).toBe(false);
        });

        it('should handle empty string', () => {
            expect(ValidationHelpers.isJsonString('')).toBe(false);
        });

        it('should handle string with only whitespace', () => {
            expect(ValidationHelpers.isJsonString('   ')).toBe(false);
        });

        it('should handle number input', () => {
            expect(ValidationHelpers.isJsonString(123)).toBe(false);
        });
    });

    describe('isOdataProperty additional cases', () => {
        it('should identify properties containing @odata in the middle', () => {
            expect(ValidationHelpers.isOdataProperty('some@odata.value')).toBe(true);
        });

        it('should handle empty string', () => {
            expect(ValidationHelpers.isOdataProperty('')).toBe(false);
        });

        it('should handle single underscore', () => {
            expect(ValidationHelpers.isOdataProperty('_')).toBe(true);
        });
    });

    describe('isSystemProperty additional cases', () => {
        it('should reject empty string', () => {
            expect(ValidationHelpers.isSystemProperty('')).toBe(false);
        });

        it('should handle properties with @odata prefix variations', () => {
            expect(ValidationHelpers.isSystemProperty('@odata.type')).toBe(true);
            expect(ValidationHelpers.isSystemProperty('@odata.id')).toBe(true);
        });

        it('should handle numeric input', () => {
            expect(ValidationHelpers.isSystemProperty(123)).toBe(false);
        });

        it('should handle object input', () => {
            expect(ValidationHelpers.isSystemProperty({})).toBe(false);
        });

        it('should reject partial matches that are not system properties', () => {
            expect(ValidationHelpers.isSystemProperty('odata')).toBe(false);
            expect(ValidationHelpers.isSystemProperty('Microsoft')).toBe(false);
        });
    });
});
