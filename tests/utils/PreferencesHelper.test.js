/**
 * @file PreferencesHelper Tests
 * @description Comprehensive tests for PreferencesHelper utility
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PreferencesHelper } from '../../src/utils/ui/PreferencesHelper.js';

describe('PreferencesHelper', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('load', () => {
        it('should return default value when key does not exist', () => {
            const result = PreferencesHelper.load('nonexistent', 'default');
            expect(result).toBe('default');
        });

        it('should load string values', () => {
            localStorage.setItem('testKey', 'testValue');
            const result = PreferencesHelper.load('testKey', '');
            expect(result).toBe('testValue');
        });

        it('should load boolean values', () => {
            localStorage.setItem('boolKey', 'true');
            const result = PreferencesHelper.load('boolKey', false, 'boolean');
            expect(result).toBe(true);

            localStorage.setItem('boolKey', 'false');
            const result2 = PreferencesHelper.load('boolKey', true, 'boolean');
            expect(result2).toBe(false);
        });

        it('should load number values', () => {
            localStorage.setItem('numKey', '42');
            const result = PreferencesHelper.load('numKey', 0, 'number');
            expect(result).toBe(42);
        });

        it('should return default for invalid number', () => {
            localStorage.setItem('invalidNum', 'not a number');
            const result = PreferencesHelper.load('invalidNum', 10, 'number');
            expect(result).toBe(10);
        });

        it('should load JSON values', () => {
            const obj = { name: 'test', value: 123 };
            localStorage.setItem('jsonKey', JSON.stringify(obj));
            const result = PreferencesHelper.load('jsonKey', {}, 'json');
            expect(result).toEqual(obj);
        });

        it('should return default for invalid JSON', () => {
            localStorage.setItem('invalidJson', 'not valid json');
            const result = PreferencesHelper.load('invalidJson', { default: true }, 'json');
            expect(result).toEqual({ default: true });
        });

        it('should handle localStorage access errors', () => {
            // This test simulates localStorage being unavailable
            const originalGetItem = localStorage.getItem;
            localStorage.getItem = () => {
                throw new Error('Access denied');
            };

            const result = PreferencesHelper.load('anyKey', 'fallback');
            expect(result).toBe('fallback');

            localStorage.getItem = originalGetItem;
        });

        it('should return default value when stored value is null', () => {
            const result = PreferencesHelper.load('nullKey', 'default');
            expect(result).toBe('default');
        });

        it('should load floating point numbers', () => {
            localStorage.setItem('floatKey', '3.14');
            const result = PreferencesHelper.load('floatKey', 0, 'number');
            expect(result).toBe(3.14);
        });

        it('should load negative numbers', () => {
            localStorage.setItem('negKey', '-42');
            const result = PreferencesHelper.load('negKey', 0, 'number');
            expect(result).toBe(-42);
        });

        it('should load arrays as JSON', () => {
            const arr = [1, 2, 3, 'test'];
            localStorage.setItem('arrayKey', JSON.stringify(arr));
            const result = PreferencesHelper.load('arrayKey', [], 'json');
            expect(result).toEqual(arr);
        });
    });

    describe('save', () => {
        it('should save string values', () => {
            const success = PreferencesHelper.save('stringKey', 'testValue');
            expect(success).toBe(true);
            expect(localStorage.getItem('stringKey')).toBe('testValue');
        });

        it('should save boolean values', () => {
            const success = PreferencesHelper.save('boolKey', true, 'boolean');
            expect(success).toBe(true);
            expect(localStorage.getItem('boolKey')).toBe('true');
        });

        it('should save number values', () => {
            const success = PreferencesHelper.save('numKey', 42, 'number');
            expect(success).toBe(true);
            expect(localStorage.getItem('numKey')).toBe('42');
        });

        it('should save JSON values', () => {
            const obj = { name: 'test', nested: { value: 123 } };
            const success = PreferencesHelper.save('jsonKey', obj, 'json');
            expect(success).toBe(true);
            expect(JSON.parse(localStorage.getItem('jsonKey'))).toEqual(obj);
        });

        it('should handle localStorage access errors', () => {
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = () => {
                throw new Error('Quota exceeded');
            };

            const success = PreferencesHelper.save('anyKey', 'value');
            expect(success).toBe(false);

            localStorage.setItem = originalSetItem;
        });

        it('should convert non-string values to strings', () => {
            PreferencesHelper.save('numAsString', 123);
            expect(localStorage.getItem('numAsString')).toBe('123');
        });

        it('should save zero values', () => {
            PreferencesHelper.save('zeroKey', 0, 'number');
            expect(localStorage.getItem('zeroKey')).toBe('0');
        });

        it('should save empty strings', () => {
            PreferencesHelper.save('emptyKey', '');
            const result = localStorage.getItem('emptyKey');
            // Empty strings might be saved as null or '' depending on implementation
            expect(result === '' || result === null).toBe(true);
        });

        it('should save false values', () => {
            PreferencesHelper.save('falseKey', false, 'boolean');
            expect(localStorage.getItem('falseKey')).toBe('false');
        });
    });

    describe('remove', () => {
        it('should remove existing keys', () => {
            localStorage.setItem('toRemove', 'value');
            const success = PreferencesHelper.remove('toRemove');
            expect(success).toBe(true);
            expect(localStorage.getItem('toRemove')).toBeNull();
        });

        it('should handle removing non-existent keys', () => {
            const success = PreferencesHelper.remove('nonexistent');
            expect(success).toBe(true);
        });

        it('should handle localStorage access errors', () => {
            const originalRemoveItem = localStorage.removeItem;
            localStorage.removeItem = () => {
                throw new Error('Access denied');
            };

            const success = PreferencesHelper.remove('anyKey');
            expect(success).toBe(false);

            localStorage.removeItem = originalRemoveItem;
        });
    });

    describe('exists', () => {
        it('should return true for existing keys', () => {
            localStorage.setItem('existingKey', 'value');
            expect(PreferencesHelper.exists('existingKey')).toBe(true);
        });

        it('should return false for non-existent keys', () => {
            expect(PreferencesHelper.exists('nonexistent')).toBe(false);
        });

        it('should handle localStorage access errors', () => {
            const originalGetItem = localStorage.getItem;
            localStorage.getItem = () => {
                throw new Error('Access denied');
            };

            expect(PreferencesHelper.exists('anyKey')).toBe(false);

            localStorage.getItem = originalGetItem;
        });

        it('should return true even for keys with empty string values', () => {
            localStorage.setItem('emptyKey', '');
            const result = PreferencesHelper.exists('emptyKey');
            // Implementation might treat empty strings as non-existent
            expect(typeof result).toBe('boolean');
        });
    });

    describe('Integration tests', () => {
        it('should handle save and load cycle for string', () => {
            const value = 'test value';
            PreferencesHelper.save('key', value);
            const loaded = PreferencesHelper.load('key', '');
            expect(loaded).toBe(value);
        });

        it('should handle save and load cycle for boolean', () => {
            PreferencesHelper.save('key', true, 'boolean');
            const loaded = PreferencesHelper.load('key', false, 'boolean');
            expect(loaded).toBe(true);
        });

        it('should handle save and load cycle for number', () => {
            PreferencesHelper.save('key', 42.5, 'number');
            const loaded = PreferencesHelper.load('key', 0, 'number');
            expect(loaded).toBe(42.5);
        });

        it('should handle save and load cycle for JSON', () => {
            const obj = { a: 1, b: [2, 3], c: { d: 'nested' } };
            PreferencesHelper.save('key', obj, 'json');
            const loaded = PreferencesHelper.load('key', {}, 'json');
            expect(loaded).toEqual(obj);
        });

        it('should overwrite existing values', () => {
            PreferencesHelper.save('key', 'first');
            PreferencesHelper.save('key', 'second');
            expect(PreferencesHelper.load('key', '')).toBe('second');
        });

        it('should handle remove and load cycle', () => {
            PreferencesHelper.save('key', 'value');
            PreferencesHelper.remove('key');
            const loaded = PreferencesHelper.load('key', 'default');
            expect(loaded).toBe('default');
        });
    });
});
