/**
 * @file ValidationService Tests
 * @description Comprehensive tests for validation service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationService } from '../../src/services/ValidationService.js';
import { isValidGuid } from '../../src/helpers/index.js';
import { Config } from '../../src/constants/index.js';

vi.mock('../../src/helpers/index.js', () => ({
    isValidGuid: vi.fn()
}));

vi.mock('../../src/constants/index.js', () => ({
    Config: {
        VALIDATION_ERRORS: {
            invalidGuid: vi.fn((field) => `Invalid GUID in ${field}`),
            invalidNumber: vi.fn((field) => `Invalid number in ${field}`),
            invalidBoolean: vi.fn((field) => `Invalid boolean in ${field}`),
            invalidJson: vi.fn((field) => `Invalid JSON in ${field}`),
            requiredParameter: vi.fn((param) => `${param} is required`),
            invalidDateFormat: vi.fn((format) => `Invalid date format: ${format}`)
        }
    }
}));

describe('ValidationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validateGuid', () => {
        it('should not throw for valid GUID', () => {
            isValidGuid.mockReturnValue(true);
            expect(() => ValidationService.validateGuid('12345678-1234-1234-1234-123456789abc'))
                .not.toThrow();
        });

        it('should throw for invalid GUID', () => {
            isValidGuid.mockReturnValue(false);
            expect(() => ValidationService.validateGuid('invalid-guid'))
                .toThrow('Invalid GUID in ID');
        });

        it('should use custom field name in error', () => {
            isValidGuid.mockReturnValue(false);
            expect(() => ValidationService.validateGuid('invalid', 'AccountId'))
                .toThrow('Invalid GUID in AccountId');
        });

        it('should use default field name', () => {
            isValidGuid.mockReturnValue(false);
            try {
                ValidationService.validateGuid('invalid');
            } catch {
                expect(Config.VALIDATION_ERRORS.invalidGuid).toHaveBeenCalledWith('ID');
            }
        });
    });

    describe('validateNumber', () => {
        it('should return valid number', () => {
            expect(ValidationService.validateNumber('42')).toBe(42);
            expect(ValidationService.validateNumber(42)).toBe(42);
        });

        it('should return valid negative number', () => {
            expect(ValidationService.validateNumber('-10')).toBe(-10);
        });

        it('should return valid float', () => {
            expect(ValidationService.validateNumber('3.14')).toBe(3.14);
        });

        it('should return zero', () => {
            expect(ValidationService.validateNumber('0')).toBe(0);
            expect(ValidationService.validateNumber(0)).toBe(0);
        });

        it('should throw for NaN', () => {
            expect(() => ValidationService.validateNumber('abc'))
                .toThrow('Invalid number in value');
        });

        it('should throw for Infinity', () => {
            expect(() => ValidationService.validateNumber(Infinity))
                .toThrow('Invalid number in value');
        });

        it('should return 0 for null', () => {
            expect(ValidationService.validateNumber(null)).toBe(0);
        });

        it('should throw for undefined', () => {
            expect(() => ValidationService.validateNumber(undefined))
                .toThrow('Invalid number in value');
        });

        it('should use custom field name in error', () => {
            expect(() => ValidationService.validateNumber('invalid', 'Price'))
                .toThrow('Invalid number in Price');
        });
    });

    describe('validateBoolean', () => {
        it('should return true for "true"', () => {
            expect(ValidationService.validateBoolean('true')).toBe(true);
        });

        it('should return false for "false"', () => {
            expect(ValidationService.validateBoolean('false')).toBe(false);
        });

        it('should handle uppercase', () => {
            expect(ValidationService.validateBoolean('TRUE')).toBe(true);
            expect(ValidationService.validateBoolean('FALSE')).toBe(false);
        });

        it('should handle mixed case', () => {
            expect(ValidationService.validateBoolean('TrUe')).toBe(true);
            expect(ValidationService.validateBoolean('FaLsE')).toBe(false);
        });

        it('should handle whitespace', () => {
            expect(ValidationService.validateBoolean('  true  ')).toBe(true);
            expect(ValidationService.validateBoolean('  false  ')).toBe(false);
        });

        it('should throw for "1"', () => {
            expect(() => ValidationService.validateBoolean('1'))
                .toThrow('Invalid boolean in value');
        });

        it('should throw for "0"', () => {
            expect(() => ValidationService.validateBoolean('0'))
                .toThrow('Invalid boolean in value');
        });

        it('should throw for invalid strings', () => {
            expect(() => ValidationService.validateBoolean('yes'))
                .toThrow('Invalid boolean in value');
        });

        it('should use custom field name in error', () => {
            expect(() => ValidationService.validateBoolean('invalid', 'IsActive'))
                .toThrow('Invalid boolean in IsActive');
        });
    });

    describe('validateJson', () => {
        it('should parse valid JSON object', () => {
            const result = ValidationService.validateJson('{"name": "test"}');
            expect(result).toEqual({ name: 'test' });
        });

        it('should parse valid JSON array', () => {
            const result = ValidationService.validateJson('[1, 2, 3]');
            expect(result).toEqual([1, 2, 3]);
        });

        it('should parse JSON with nested objects', () => {
            const json = '{"user": {"name": "John", "age": 30}}';
            const result = ValidationService.validateJson(json);
            expect(result).toEqual({ user: { name: 'John', age: 30 } });
        });

        it('should parse JSON with booleans', () => {
            const result = ValidationService.validateJson('{"active": true}');
            expect(result).toEqual({ active: true });
        });

        it('should parse JSON with null', () => {
            const result = ValidationService.validateJson('{"value": null}');
            expect(result).toEqual({ value: null });
        });

        it('should throw for invalid JSON', () => {
            expect(() => ValidationService.validateJson('{invalid}'))
                .toThrow('Invalid JSON in value');
        });

        it('should throw for malformed JSON', () => {
            expect(() => ValidationService.validateJson('{"key": "value"'))
                .toThrow('Invalid JSON in value');
        });

        it('should throw for plain strings', () => {
            expect(() => ValidationService.validateJson('not json'))
                .toThrow('Invalid JSON in value');
        });

        it('should use custom field name in error', () => {
            expect(() => ValidationService.validateJson('{bad}', 'Config'))
                .toThrow('Invalid JSON in Config');
        });
    });

    describe('validateRequired', () => {
        it('should not throw for valid string', () => {
            expect(() => ValidationService.validateRequired('test', 'param'))
                .not.toThrow();
        });

        it('should not throw for number', () => {
            expect(() => ValidationService.validateRequired(42, 'param'))
                .not.toThrow();
        });

        it('should not throw for zero', () => {
            expect(() => ValidationService.validateRequired(0, 'param'))
                .not.toThrow();
        });

        it('should not throw for false', () => {
            expect(() => ValidationService.validateRequired(false, 'param'))
                .not.toThrow();
        });

        it('should throw for null', () => {
            expect(() => ValidationService.validateRequired(null, 'userId'))
                .toThrow('userId is required');
        });

        it('should throw for undefined', () => {
            expect(() => ValidationService.validateRequired(undefined, 'userId'))
                .toThrow('userId is required');
        });

        it('should throw for empty string', () => {
            expect(() => ValidationService.validateRequired('', 'name'))
                .toThrow('name is required');
        });

        it('should not throw for whitespace string', () => {
            expect(() => ValidationService.validateRequired('  ', 'param'))
                .not.toThrow();
        });
    });

    describe('validateDateFormat', () => {
        it('should return Date object for valid date string', () => {
            const result = ValidationService.validateDateFormat('2023-01-01', 'YYYY-MM-DD');
            expect(result).toBeInstanceOf(Date);
            expect(result.getFullYear()).toBe(2023);
        });

        it('should handle ISO format', () => {
            const result = ValidationService.validateDateFormat('2023-12-25T10:30:00Z', 'ISO');
            expect(result).toBeInstanceOf(Date);
        });

        it('should handle various date formats', () => {
            const result1 = ValidationService.validateDateFormat('01/15/2023', 'MM/DD/YYYY');
            const result2 = ValidationService.validateDateFormat('15 Jan 2023', 'DD Mon YYYY');
            expect(result1).toBeInstanceOf(Date);
            expect(result2).toBeInstanceOf(Date);
        });

        it('should throw for invalid date string', () => {
            expect(() => ValidationService.validateDateFormat('not-a-date', 'YYYY-MM-DD'))
                .toThrow('Invalid date format: YYYY-MM-DD');
        });

        it('should throw for invalid date values', () => {
            expect(() => ValidationService.validateDateFormat('2023-13-40', 'YYYY-MM-DD'))
                .toThrow('Invalid date format: YYYY-MM-DD');
        });

        it('should throw for empty string', () => {
            expect(() => ValidationService.validateDateFormat('', 'YYYY-MM-DD'))
                .toThrow('Invalid date format: YYYY-MM-DD');
        });
    });

    describe('Error Messages', () => {
        it('should call Config.VALIDATION_ERRORS methods', () => {
            isValidGuid.mockReturnValue(false);
            
            try {
                ValidationService.validateGuid('test', 'MyField');
            } catch {
                expect(Config.VALIDATION_ERRORS.invalidGuid).toHaveBeenCalledWith('MyField');
            }
        });

        it('should use error factory for number validation', () => {
            try {
                ValidationService.validateNumber('abc', 'Count');
            } catch {
                expect(Config.VALIDATION_ERRORS.invalidNumber).toHaveBeenCalledWith('Count');
            }
        });

        it('should use error factory for boolean validation', () => {
            try {
                ValidationService.validateBoolean('yes', 'Flag');
            } catch {
                expect(Config.VALIDATION_ERRORS.invalidBoolean).toHaveBeenCalledWith('Flag');
            }
        });

        it('should use error factory for JSON validation', () => {
            try {
                ValidationService.validateJson('{bad}', 'Data');
            } catch {
                expect(Config.VALIDATION_ERRORS.invalidJson).toHaveBeenCalledWith('Data');
            }
        });

        it('should use error factory for required validation', () => {
            try {
                ValidationService.validateRequired(null, 'UserId');
            } catch {
                expect(Config.VALIDATION_ERRORS.requiredParameter).toHaveBeenCalledWith('UserId');
            }
        });

        it('should use error factory for date validation', () => {
            try {
                ValidationService.validateDateFormat('invalid', 'MM/DD/YYYY');
            } catch {
                expect(Config.VALIDATION_ERRORS.invalidDateFormat).toHaveBeenCalledWith('MM/DD/YYYY');
            }
        });
    });
});
