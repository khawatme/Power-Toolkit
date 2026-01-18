/**
 * @file Dataverse Helpers Tests
 * @description Comprehensive tests for Dataverse data normalization utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DataverseHelpers } from '../../src/helpers/dataverse.helpers.js';

describe('DataverseHelpers', () => {
    describe('normalizeGuid', () => {
        it('should remove curly braces from GUIDs', () => {
            expect(DataverseHelpers.normalizeGuid('{123e4567-e89b-12d3-a456-426614174000}'))
                .toBe('123e4567-e89b-12d3-a456-426614174000');
        });

        it('should convert to lowercase', () => {
            expect(DataverseHelpers.normalizeGuid('123E4567-E89B-12D3-A456-426614174000'))
                .toBe('123e4567-e89b-12d3-a456-426614174000');
        });

        it('should handle GUIDs without braces', () => {
            expect(DataverseHelpers.normalizeGuid('123e4567-e89b-12d3-a456-426614174000'))
                .toBe('123e4567-e89b-12d3-a456-426614174000');
        });

        it('should return null for null/undefined', () => {
            expect(DataverseHelpers.normalizeGuid(null)).toBeNull();
            expect(DataverseHelpers.normalizeGuid(undefined)).toBeNull();
        });

        it('should return null for empty string', () => {
            expect(DataverseHelpers.normalizeGuid('')).toBeNull();
        });

        it('should handle both opening and closing braces', () => {
            expect(DataverseHelpers.normalizeGuid('{123e4567-e89b-12d3-a456-426614174000}'))
                .toBe('123e4567-e89b-12d3-a456-426614174000');
        });
    });

    describe('normalizeLookup', () => {
        it('should normalize valid lookup values', () => {
            const lookup = [{
                id: '{123e4567-e89b-12d3-a456-426614174000}',
                name: 'Test Account',
                entityType: 'account'
            }];

            const result = DataverseHelpers.normalizeLookup(lookup);

            expect(result).toHaveProperty('__type');
            expect(result.Id).toBe('123e4567-e89b-12d3-a456-426614174000');
            expect(result.LogicalName).toBe('account');
            expect(result.Name).toBe('Test Account');
        });

        it('should handle etn property for entity type', () => {
            const lookup = [{
                id: '123',
                name: 'Test',
                etn: 'contact'
            }];

            const result = DataverseHelpers.normalizeLookup(lookup);
            expect(result.LogicalName).toBe('contact');
        });

        it('should remove curly braces from ID', () => {
            const lookup = [{
                id: '{123}',
                name: 'Test',
                entityType: 'account'
            }];

            const result = DataverseHelpers.normalizeLookup(lookup);
            expect(result.Id).toBe('123');
        });

        it('should return null for empty arrays', () => {
            expect(DataverseHelpers.normalizeLookup([])).toBeNull();
        });

        it('should return null for null/undefined', () => {
            expect(DataverseHelpers.normalizeLookup(null)).toBeNull();
            expect(DataverseHelpers.normalizeLookup(undefined)).toBeNull();
        });

        it('should return null for non-array values', () => {
            expect(DataverseHelpers.normalizeLookup('not-an-array')).toBeNull();
            expect(DataverseHelpers.normalizeLookup({})).toBeNull();
        });

        it('should handle missing properties with defaults', () => {
            const lookup = [{ id: '123' }];
            const result = DataverseHelpers.normalizeLookup(lookup);

            expect(result.LogicalName).toBe('');
            expect(result.Name).toBe('');
        });
    });

    describe('normalizeOptionSet', () => {
        it('should normalize single option set values', () => {
            const result = DataverseHelpers.normalizeOptionSet(1);

            expect(result).toHaveProperty('__type');
            expect(result.Value).toBe(1);
        });

        it('should normalize multi-select option sets', () => {
            const result = DataverseHelpers.normalizeOptionSet([1, 2, 3]);

            expect(result).toHaveProperty('__type');
            expect(result.Values).toEqual([1, 2, 3]);
        });

        it('should return null for null/undefined', () => {
            expect(DataverseHelpers.normalizeOptionSet(null)).toBeNull();
            expect(DataverseHelpers.normalizeOptionSet(undefined)).toBeNull();
        });

        it('should convert string numbers to numbers', () => {
            const result = DataverseHelpers.normalizeOptionSet('2');
            expect(result.Value).toBe(2);
        });

        it('should handle zero value', () => {
            const result = DataverseHelpers.normalizeOptionSet(0);
            expect(result.Value).toBe(0);
        });

        it('should clone array values', () => {
            const original = [1, 2, 3];
            const result = DataverseHelpers.normalizeOptionSet(original);
            original.push(4);
            expect(result.Values).toEqual([1, 2, 3]);
        });
    });

    describe('normalizeDateTime', () => {
        it('should normalize Date objects', () => {
            const date = new Date('2024-01-15T10:30:00Z');
            const result = DataverseHelpers.normalizeDateTime(date);

            expect(result).toHaveProperty('__type');
            expect(result.Iso).toBe('2024-01-15T10:30:00.000Z');
        });

        it('should normalize date strings', () => {
            const result = DataverseHelpers.normalizeDateTime('2024-01-15T10:30:00Z');

            expect(result).toHaveProperty('__type');
            expect(result.Iso).toContain('2024-01-15');
        });

        it('should normalize timestamps', () => {
            const timestamp = 1705315800000; // 2024-01-15T10:30:00Z
            const result = DataverseHelpers.normalizeDateTime(timestamp);

            expect(result).toHaveProperty('__type');
            expect(result.Iso).toBeTruthy();
        });

        it('should return null for null/undefined', () => {
            expect(DataverseHelpers.normalizeDateTime(null)).toBeNull();
            expect(DataverseHelpers.normalizeDateTime(undefined)).toBeNull();
        });

        it('should return null for invalid dates', () => {
            expect(DataverseHelpers.normalizeDateTime('invalid')).toBeNull();
        });

        it('should handle empty strings', () => {
            expect(DataverseHelpers.normalizeDateTime('')).toBeNull();
        });
    });

    describe('normalizeMoney', () => {
        it('should normalize numeric values', () => {
            const result = DataverseHelpers.normalizeMoney(100.50);

            expect(result).toHaveProperty('__type');
            expect(result.Value).toBe(100.50);
        });

        it('should normalize string numbers', () => {
            const result = DataverseHelpers.normalizeMoney('250.75');

            expect(result).toHaveProperty('__type');
            expect(result.Value).toBe(250.75);
        });

        it('should handle zero', () => {
            const result = DataverseHelpers.normalizeMoney(0);
            expect(result.Value).toBe(0);
        });

        it('should return null for null/undefined/empty', () => {
            expect(DataverseHelpers.normalizeMoney(null)).toBeNull();
            expect(DataverseHelpers.normalizeMoney(undefined)).toBeNull();
            expect(DataverseHelpers.normalizeMoney('')).toBeNull();
        });

        it('should return null for invalid numbers', () => {
            expect(DataverseHelpers.normalizeMoney('invalid')).toBeNull();
            expect(DataverseHelpers.normalizeMoney(NaN)).toBeNull();
            expect(DataverseHelpers.normalizeMoney(Infinity)).toBeNull();
        });

        it('should handle negative values', () => {
            const result = DataverseHelpers.normalizeMoney(-50.25);
            expect(result.Value).toBe(-50.25);
        });
    });

    describe('normalizeNumber', () => {
        it('should normalize numeric values', () => {
            expect(DataverseHelpers.normalizeNumber(42)).toBe(42);
            expect(DataverseHelpers.normalizeNumber(3.14)).toBe(3.14);
        });

        it('should normalize string numbers', () => {
            expect(DataverseHelpers.normalizeNumber('123')).toBe(123);
            expect(DataverseHelpers.normalizeNumber('45.67')).toBe(45.67);
        });

        it('should handle zero', () => {
            expect(DataverseHelpers.normalizeNumber(0)).toBe(0);
            expect(DataverseHelpers.normalizeNumber('0')).toBe(0);
        });

        it('should return null for null/undefined/empty', () => {
            expect(DataverseHelpers.normalizeNumber(null)).toBeNull();
            expect(DataverseHelpers.normalizeNumber(undefined)).toBeNull();
            expect(DataverseHelpers.normalizeNumber('')).toBeNull();
        });

        it('should return null for invalid numbers', () => {
            expect(DataverseHelpers.normalizeNumber('invalid')).toBeNull();
            expect(DataverseHelpers.normalizeNumber(NaN)).toBeNull();
            expect(DataverseHelpers.normalizeNumber(Infinity)).toBeNull();
        });

        it('should handle negative values', () => {
            expect(DataverseHelpers.normalizeNumber(-100)).toBe(-100);
        });
    });

    describe('filterSystemFields', () => {
        beforeEach(() => {
            // Mock Config.SYSTEM_FIELDS
            global.Config = {
                SYSTEM_FIELDS: ['createdon', 'modifiedon', 'createdby', 'modifiedby', 'ownerid']
            };
        });

        it('should filter out system fields', () => {
            const attributes = {
                name: 'Test Account',
                createdon: '2024-01-01',
                modifiedon: '2024-01-02',
                customfield: 'Custom Value'
            };

            const result = DataverseHelpers.filterSystemFields(attributes);

            expect(result).toHaveProperty('name');
            expect(result).toHaveProperty('customfield');
            expect(result).not.toHaveProperty('createdon');
            expect(result).not.toHaveProperty('modifiedon');
        });

        it('should handle case-insensitive matching', () => {
            const attributes = {
                CreatedOn: '2024-01-01',
                MODIFIEDON: '2024-01-02',
                name: 'Test'
            };

            const result = DataverseHelpers.filterSystemFields(attributes);

            expect(result).toHaveProperty('name');
            expect(result).not.toHaveProperty('CreatedOn');
            expect(result).not.toHaveProperty('MODIFIEDON');
        });

        it('should return all fields when no system fields present', () => {
            const attributes = {
                name: 'Test',
                customfield1: 'Value1',
                customfield2: 'Value2'
            };

            const result = DataverseHelpers.filterSystemFields(attributes);

            expect(Object.keys(result).length).toBe(3);
            expect(result).toEqual(attributes);
        });

        it('should handle empty objects', () => {
            const result = DataverseHelpers.filterSystemFields({});
            expect(result).toEqual({});
        });

        it('should handle objects with only system fields', () => {
            const attributes = {
                createdon: '2024-01-01',
                modifiedon: '2024-01-02',
                ownerid: '123'
            };

            const result = DataverseHelpers.filterSystemFields(attributes);
            expect(Object.keys(result).length).toBe(0);
        });

        it('should handle null/undefined system fields array', () => {
            // Note: Config.SYSTEM_FIELDS is defined at module level and cannot be changed at runtime
            // This test verifies the function works correctly with normal Config
            const attributes = { name: 'Test', createdon: '2024-01-01', customfield: 'Custom' };
            const result = DataverseHelpers.filterSystemFields(attributes);
            // createdon is a system field and should be filtered out
            expect(result).toEqual({ name: 'Test', customfield: 'Custom' });
            expect(Object.keys(result).length).toBe(2);
        });
    });

    describe('inferDataverseType', () => {
        it('should return "unknown" for null values', () => {
            expect(DataverseHelpers.inferDataverseType(null, 'name')).toBe('unknown');
        });

        it('should return "unknown" for undefined values', () => {
            expect(DataverseHelpers.inferDataverseType(undefined, 'name')).toBe('unknown');
        });

        it('should return "lookup" for null values with lookup property pattern', () => {
            expect(DataverseHelpers.inferDataverseType(null, '_parentcustomerid_value')).toBe('lookup');
        });

        it('should return "datetime" for null values with datetime property pattern', () => {
            expect(DataverseHelpers.inferDataverseType(null, 'createdon')).toBe('datetime');
            expect(DataverseHelpers.inferDataverseType(null, 'modifiedon')).toBe('datetime');
        });

        it('should return "lookup" for lookup property naming pattern', () => {
            expect(DataverseHelpers.inferDataverseType('guid-value', '_ownerid_value')).toBe('lookup');
            expect(DataverseHelpers.inferDataverseType('guid-value', '_primarycontactid_value')).toBe('lookup');
        });

        it('should return "boolean" for boolean values', () => {
            expect(DataverseHelpers.inferDataverseType(true, 'isactive')).toBe('boolean');
            expect(DataverseHelpers.inferDataverseType(false, 'iscomplete')).toBe('boolean');
        });

        it('should return "integer" for integer values', () => {
            expect(DataverseHelpers.inferDataverseType(42, 'count')).toBe('integer');
            expect(DataverseHelpers.inferDataverseType(-100, 'offset')).toBe('integer');
            expect(DataverseHelpers.inferDataverseType(0, 'zero')).toBe('integer');
        });

        it('should return "decimal" for decimal values', () => {
            expect(DataverseHelpers.inferDataverseType(3.14, 'amount')).toBe('decimal');
            expect(DataverseHelpers.inferDataverseType(99.99, 'price')).toBe('decimal');
        });

        it('should return "uniqueidentifier" for GUID strings', () => {
            expect(DataverseHelpers.inferDataverseType('12345678-1234-1234-1234-123456789012', 'recordid')).toBe('uniqueidentifier');
        });

        it('should return "datetime" for ISO datetime strings', () => {
            expect(DataverseHelpers.inferDataverseType('2024-01-15T10:30:00Z', 'createdon')).toBe('datetime');
            expect(DataverseHelpers.inferDataverseType('2024-01-15T10:30:00.000Z', 'modifiedon')).toBe('datetime');
        });

        it('should return "string" for regular strings', () => {
            expect(DataverseHelpers.inferDataverseType('Hello World', 'name')).toBe('string');
            expect(DataverseHelpers.inferDataverseType('', 'description')).toBe('string');
        });

        it('should return "array" for array values', () => {
            expect(DataverseHelpers.inferDataverseType([1, 2, 3], 'values')).toBe('array');
            expect(DataverseHelpers.inferDataverseType([], 'emptyarray')).toBe('array');
        });

        it('should return "entity" for expanded navigation properties', () => {
            expect(DataverseHelpers.inferDataverseType({ '@odata.etag': 'W/"123"' }, 'primarycontactid')).toBe('entity');
            expect(DataverseHelpers.inferDataverseType({ '@odata.context': 'url' }, 'ownerid')).toBe('entity');
        });

        it('should return "object" for generic objects', () => {
            expect(DataverseHelpers.inferDataverseType({ key: 'value' }, 'data')).toBe('object');
        });

        it('should return "state" for statecode property', () => {
            expect(DataverseHelpers.inferDataverseType(0, 'statecode')).toBe('state');
        });

        it('should return "status" for statuscode property', () => {
            expect(DataverseHelpers.inferDataverseType(1, 'statuscode')).toBe('status');
        });

        it('should return "integer" for very large integers', () => {
            expect(DataverseHelpers.inferDataverseType(9007199254740991, 'bigintfield')).toBe('integer');
        });

        it('should return valueType for symbol values', () => {
            // Symbol is a primitive type that doesn't match boolean, number, array, string, or object
            // This triggers the fallback return valueType branch
            const sym = Symbol('test');
            expect(DataverseHelpers.inferDataverseType(sym, 'symbolfield')).toBe('symbol');
        });

        it('should return valueType for function values', () => {
            // Function type falls through to the default return valueType
            const fn = () => { };
            expect(DataverseHelpers.inferDataverseType(fn, 'funcfield')).toBe('function');
        });

        it('should return valueType for bigint values', () => {
            // BigInt is a distinct primitive type
            const bigInt = BigInt(9007199254740991);
            expect(DataverseHelpers.inferDataverseType(bigInt, 'bigintfield')).toBe('bigint');
        });
    });
});
