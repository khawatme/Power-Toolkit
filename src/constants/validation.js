/**
 * Validation error messages and rules.
 * @module constants/validation
 */

/**
 * Validation error messages for centralized error handling.
 * @type {Object.<string, Function|string>}
 */
export const VALIDATION_ERRORS = {
    invalidGuid: (fieldName = 'ID') => `${fieldName} must be a valid GUID`,
    invalidNumber: (fieldName = 'value') => `${fieldName} must be a valid number`,
    invalidBoolean: (fieldName = 'value') => `${fieldName} must be 'true' or 'false'`,
    invalidJson: (fieldName = 'value') => `${fieldName} must be valid JSON`,
    invalidDateFormat: (format) => `Invalid date format. Expected format: ${format}`,
    requiredParameter: (paramName) => `${paramName} is required`,
    invalidPatchGuid: 'A valid GUID is required for PATCH requests',
    invalidDeleteGuid: 'A valid GUID is required for DELETE requests',
    tableSelectionRequired: 'Please select a table first',
    formIdNotFound: 'Could not identify the current Form ID',
    formXmlNotFound: 'Retrieved form data but it did not contain a \'formxml\' definition'
};
