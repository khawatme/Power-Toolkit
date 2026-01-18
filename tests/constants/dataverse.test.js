/**
 * @file Tests for Dataverse constants
 * @module tests/constants/dataverse.test.js
 */

import { describe, it, expect } from 'vitest';
import {
    DATAVERSE_SPECIAL_ENDPOINTS,
    DATAVERSE_TYPES,
    ENTITY_NAMES,
    FIELD_TYPES,
    FORM_TYPES,
    ENV_VAR_TYPES
} from '../../src/constants/dataverse.js';

describe('Dataverse Constants', () => {

    describe('DATAVERSE_SPECIAL_ENDPOINTS', () => {
        it('should be an array', () => {
            expect(Array.isArray(DATAVERSE_SPECIAL_ENDPOINTS)).toBe(true);
        });

        it('should contain EntityDefinitions', () => {
            expect(DATAVERSE_SPECIAL_ENDPOINTS).toContain('EntityDefinitions');
        });

        it('should contain privileges', () => {
            expect(DATAVERSE_SPECIAL_ENDPOINTS).toContain('privileges');
        });

        it('should contain roleprivilegescollection', () => {
            expect(DATAVERSE_SPECIAL_ENDPOINTS).toContain('roleprivilegescollection');
        });
    });

    describe('DATAVERSE_TYPES', () => {
        it('should define ENTITY type', () => {
            expect(DATAVERSE_TYPES.ENTITY).toBe('Entity');
        });

        it('should define ENTITY_REFERENCE type', () => {
            expect(DATAVERSE_TYPES.ENTITY_REFERENCE).toBe('EntityReference');
        });

        it('should define MONEY type', () => {
            expect(DATAVERSE_TYPES.MONEY).toBe('Money');
        });

        it('should define OPTION_SET_VALUE type', () => {
            expect(DATAVERSE_TYPES.OPTION_SET_VALUE).toBe('OptionSetValue');
        });
    });

    describe('ENTITY_NAMES', () => {
        it('should define WORKFLOW entity name', () => {
            expect(ENTITY_NAMES.WORKFLOW).toBe('workflow');
        });

        it('should define SYSTEMUSER entity name', () => {
            expect(ENTITY_NAMES.SYSTEMUSER).toBe('systemuser');
        });

        it('should define ENVIRONMENT_VARIABLE_DEFINITION entity name', () => {
            expect(ENTITY_NAMES.ENVIRONMENT_VARIABLE_DEFINITION).toBe('environmentvariabledefinition');
        });
    });

    describe('FIELD_TYPES', () => {
        it('should define STRING type', () => {
            expect(FIELD_TYPES.STRING).toBe('string');
        });

        it('should define LOOKUP type', () => {
            expect(FIELD_TYPES.LOOKUP).toBe('lookup');
        });

        it('should define BOOLEAN type', () => {
            expect(FIELD_TYPES.BOOLEAN).toBe('boolean');
        });

        it('should define DATETIME type', () => {
            expect(FIELD_TYPES.DATETIME).toBe('datetime');
        });
    });

    describe('FORM_TYPES', () => {
        it('should define UNDEFINED as 0', () => {
            expect(FORM_TYPES.UNDEFINED).toBe(0);
        });

        it('should define CREATE as 1', () => {
            expect(FORM_TYPES.CREATE).toBe(1);
        });

        it('should define UPDATE as 2', () => {
            expect(FORM_TYPES.UPDATE).toBe(2);
        });

        it('should define READ_ONLY as 3', () => {
            expect(FORM_TYPES.READ_ONLY).toBe(3);
        });

        it('should define QUICK_CREATE as 5', () => {
            expect(FORM_TYPES.QUICK_CREATE).toBe(5);
        });
    });

    describe('ENV_VAR_TYPES', () => {
        it('should define string type with correct value', () => {
            expect(ENV_VAR_TYPES.string.value).toBe(100000000);
            expect(ENV_VAR_TYPES.string.label).toBe('String');
        });

        it('should define number type with correct value', () => {
            expect(ENV_VAR_TYPES.number.value).toBe(100000001);
            expect(ENV_VAR_TYPES.number.label).toBe('Number');
        });

        it('should define boolean type with correct value', () => {
            expect(ENV_VAR_TYPES.boolean.value).toBe(100000002);
            expect(ENV_VAR_TYPES.boolean.label).toBe('Boolean');
        });

        it('should define json type with correct value', () => {
            expect(ENV_VAR_TYPES.json.value).toBe(100000003);
            expect(ENV_VAR_TYPES.json.label).toBe('JSON');
        });
    });
});
