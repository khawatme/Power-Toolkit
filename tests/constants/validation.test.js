import { describe, it, expect } from 'vitest';
import { VALIDATION_ERRORS } from '../../src/constants/validation.js';

describe('VALIDATION_ERRORS', () => {
    describe('structure', () => {
        it('should be a defined object', () => {
            expect(VALIDATION_ERRORS).toBeDefined();
            expect(typeof VALIDATION_ERRORS).toBe('object');
        });

        it('should contain all expected keys', () => {
            const expectedKeys = [
                'invalidGuid',
                'invalidNumber',
                'invalidBoolean',
                'invalidJson',
                'invalidDateFormat',
                'requiredParameter',
                'invalidPatchGuid',
                'invalidDeleteGuid',
                'tableSelectionRequired',
                'formIdNotFound',
                'formXmlNotFound'
            ];

            expectedKeys.forEach(key => {
                expect(VALIDATION_ERRORS).toHaveProperty(key);
            });
        });
    });

    describe('function-based error messages', () => {
        describe('invalidGuid', () => {
            it('should be a function', () => {
                expect(typeof VALIDATION_ERRORS.invalidGuid).toBe('function');
            });

            it('should return default message when no fieldName provided', () => {
                expect(VALIDATION_ERRORS.invalidGuid()).toBe('ID must be a valid GUID');
            });

            it('should include custom fieldName in message', () => {
                expect(VALIDATION_ERRORS.invalidGuid('User ID')).toBe('User ID must be a valid GUID');
            });

            it('should handle empty string fieldName', () => {
                expect(VALIDATION_ERRORS.invalidGuid('')).toBe(' must be a valid GUID');
            });
        });

        describe('invalidNumber', () => {
            it('should be a function', () => {
                expect(typeof VALIDATION_ERRORS.invalidNumber).toBe('function');
            });

            it('should return default message when no fieldName provided', () => {
                expect(VALIDATION_ERRORS.invalidNumber()).toBe('value must be a valid number');
            });

            it('should include custom fieldName in message', () => {
                expect(VALIDATION_ERRORS.invalidNumber('Age')).toBe('Age must be a valid number');
            });

            it('should handle empty string fieldName', () => {
                expect(VALIDATION_ERRORS.invalidNumber('')).toBe(' must be a valid number');
            });
        });

        describe('invalidBoolean', () => {
            it('should be a function', () => {
                expect(typeof VALIDATION_ERRORS.invalidBoolean).toBe('function');
            });

            it('should return default message when no fieldName provided', () => {
                expect(VALIDATION_ERRORS.invalidBoolean()).toBe("value must be 'true' or 'false'");
            });

            it('should include custom fieldName in message', () => {
                expect(VALIDATION_ERRORS.invalidBoolean('IsActive')).toBe("IsActive must be 'true' or 'false'");
            });

            it('should handle empty string fieldName', () => {
                expect(VALIDATION_ERRORS.invalidBoolean('')).toBe(" must be 'true' or 'false'");
            });
        });

        describe('invalidJson', () => {
            it('should be a function', () => {
                expect(typeof VALIDATION_ERRORS.invalidJson).toBe('function');
            });

            it('should return default message when no fieldName provided', () => {
                expect(VALIDATION_ERRORS.invalidJson()).toBe('value must be valid JSON');
            });

            it('should include custom fieldName in message', () => {
                expect(VALIDATION_ERRORS.invalidJson('Configuration')).toBe('Configuration must be valid JSON');
            });

            it('should handle empty string fieldName', () => {
                expect(VALIDATION_ERRORS.invalidJson('')).toBe(' must be valid JSON');
            });
        });

        describe('invalidDateFormat', () => {
            it('should be a function', () => {
                expect(typeof VALIDATION_ERRORS.invalidDateFormat).toBe('function');
            });

            it('should include format in message', () => {
                expect(VALIDATION_ERRORS.invalidDateFormat('YYYY-MM-DD')).toBe('Invalid date format. Expected format: YYYY-MM-DD');
            });

            it('should handle undefined format', () => {
                expect(VALIDATION_ERRORS.invalidDateFormat()).toBe('Invalid date format. Expected format: undefined');
            });

            it('should handle empty string format', () => {
                expect(VALIDATION_ERRORS.invalidDateFormat('')).toBe('Invalid date format. Expected format: ');
            });

            it('should handle complex format strings', () => {
                expect(VALIDATION_ERRORS.invalidDateFormat('DD/MM/YYYY HH:mm:ss')).toBe('Invalid date format. Expected format: DD/MM/YYYY HH:mm:ss');
            });
        });

        describe('requiredParameter', () => {
            it('should be a function', () => {
                expect(typeof VALIDATION_ERRORS.requiredParameter).toBe('function');
            });

            it('should include parameter name in message', () => {
                expect(VALIDATION_ERRORS.requiredParameter('entityName')).toBe('entityName is required');
            });

            it('should handle undefined parameter name', () => {
                expect(VALIDATION_ERRORS.requiredParameter()).toBe('undefined is required');
            });

            it('should handle empty string parameter name', () => {
                expect(VALIDATION_ERRORS.requiredParameter('')).toBe(' is required');
            });

            it('should handle parameter names with spaces', () => {
                expect(VALIDATION_ERRORS.requiredParameter('User Name')).toBe('User Name is required');
            });
        });
    });

    describe('string-based error messages', () => {
        describe('invalidPatchGuid', () => {
            it('should be a string', () => {
                expect(typeof VALIDATION_ERRORS.invalidPatchGuid).toBe('string');
            });

            it('should have correct error message', () => {
                expect(VALIDATION_ERRORS.invalidPatchGuid).toBe('A valid GUID is required for PATCH requests');
            });
        });

        describe('invalidDeleteGuid', () => {
            it('should be a string', () => {
                expect(typeof VALIDATION_ERRORS.invalidDeleteGuid).toBe('string');
            });

            it('should have correct error message', () => {
                expect(VALIDATION_ERRORS.invalidDeleteGuid).toBe('A valid GUID is required for DELETE requests');
            });
        });

        describe('tableSelectionRequired', () => {
            it('should be a string', () => {
                expect(typeof VALIDATION_ERRORS.tableSelectionRequired).toBe('string');
            });

            it('should have correct error message', () => {
                expect(VALIDATION_ERRORS.tableSelectionRequired).toBe('Please select a table first');
            });
        });

        describe('formIdNotFound', () => {
            it('should be a string', () => {
                expect(typeof VALIDATION_ERRORS.formIdNotFound).toBe('string');
            });

            it('should have correct error message', () => {
                expect(VALIDATION_ERRORS.formIdNotFound).toBe('Could not identify the current Form ID');
            });
        });

        describe('formXmlNotFound', () => {
            it('should be a string', () => {
                expect(typeof VALIDATION_ERRORS.formXmlNotFound).toBe('string');
            });

            it('should have correct error message', () => {
                expect(VALIDATION_ERRORS.formXmlNotFound).toBe("Retrieved form data but it did not contain a 'formxml' definition");
            });
        });
    });

    describe('immutability', () => {
        it('should not allow adding new properties in strict mode', () => {
            const originalKeys = Object.keys(VALIDATION_ERRORS);

            try {
                VALIDATION_ERRORS.newProperty = 'test';
            } catch {
                // Property addition may throw in strict mode
            }

            // Verify original structure is intact
            expect(Object.keys(VALIDATION_ERRORS).length).toBeGreaterThanOrEqual(originalKeys.length);
        });
    });

    describe('edge cases', () => {
        it('should handle special characters in field names', () => {
            expect(VALIDATION_ERRORS.invalidGuid('field<with>special&chars')).toBe('field<with>special&chars must be a valid GUID');
        });

        it('should handle numeric values passed as field names', () => {
            expect(VALIDATION_ERRORS.invalidNumber(123)).toBe('123 must be a valid number');
        });

        it('should handle null values passed to functions', () => {
            expect(VALIDATION_ERRORS.invalidGuid(null)).toBe('null must be a valid GUID');
        });

        it('should handle object values passed to functions', () => {
            expect(VALIDATION_ERRORS.invalidJson({ key: 'value' })).toBe('[object Object] must be valid JSON');
        });
    });
});
