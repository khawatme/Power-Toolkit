/**
 * @file Tests for EnvironmentVariableService
 * @module tests/services/EnvironmentVariableService.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnvironmentVariableService } from '../../src/services/EnvironmentVariableService.js';

// Mock ValidationService
vi.mock('../../src/services/ValidationService.js', () => ({
    ValidationService: {
        validateRequired: vi.fn((v) => v),
        validateNumber: vi.fn((v) => parseFloat(v)),
        validateBoolean: vi.fn((v) => v === 'true'),
        validateJson: vi.fn((v) => JSON.parse(v))
    }
}));

describe('EnvironmentVariableService', () => {
    const mockRetrieveMultiple = vi.fn();
    const mockUpdateRecord = vi.fn();
    const mockCreateRecord = vi.fn();
    const mockDeleteRecord = vi.fn();
    const mockRetrieveRecord = vi.fn();
    const mockWebApiFetch = vi.fn();
    const mockAddSolutionComponent = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('setCurrentSolution', () => {
        it('should set current solution and publisher prefix', async () => {
            mockRetrieveMultiple.mockResolvedValue({
                entities: [{
                    uniquename: 'TestSolution',
                    publisherid: { customizationprefix: 'new' }
                }]
            });

            await EnvironmentVariableService.setCurrentSolution('TestSolution', mockRetrieveMultiple);

            const solution = EnvironmentVariableService.getCurrentSolution();
            expect(solution).toBeDefined();
        });
    });

    describe('getCurrentSolution', () => {
        it('should return current solution info', () => {
            const solution = EnvironmentVariableService.getCurrentSolution();
            expect(solution).toBeDefined();
        });
    });

    describe('getEnvironmentVariables', () => {
        it('should retrieve environment variables', async () => {
            mockRetrieveMultiple.mockResolvedValue({
                entities: [
                    {
                        environmentvariabledefinitionid: 'def-123',
                        environmentvariabledefinition_environmentvariablevalue: [
                            { environmentvariablevalueid: 'val-456', value: 'test-value' }
                        ],
                        schemaname: 'new_TestVar',
                        displayname: 'Test Variable',
                        type: 100000000
                    }
                ]
            });

            await expect(async () => {
                await EnvironmentVariableService.getEnvironmentVariables(mockRetrieveMultiple);
            }).not.toThrow();
        });

        it('should handle empty results', async () => {
            mockRetrieveMultiple.mockResolvedValue({ entities: [] });

            const result = await EnvironmentVariableService.getEnvironmentVariables(mockRetrieveMultiple);
            expect(result).toEqual([]);
        });
    });

    describe('setEnvironmentVariableValue', () => {
        it('should update environment variable current value', async () => {
            mockUpdateRecord.mockResolvedValue(true);

            await EnvironmentVariableService.setEnvironmentVariableValue(
                mockUpdateRecord,
                mockWebApiFetch,
                'def-123',
                'val-456',
                'new value',
                'new_TestVar'
            );

            expect(mockUpdateRecord).toHaveBeenCalled();
        });

        it('should create new value if valueId is null', async () => {
            mockWebApiFetch.mockResolvedValue({ environmentvariablevalueid: 'val-new' });

            await EnvironmentVariableService.setEnvironmentVariableValue(
                mockUpdateRecord,
                mockWebApiFetch,
                'def-123',
                null,
                'new value',
                'new_TestVar'
            );

            expect(mockWebApiFetch).toHaveBeenCalled();
        });
    });

    describe('setEnvironmentVariableDefault', () => {
        it('should update environment variable default value', async () => {
            mockUpdateRecord.mockResolvedValue(true);

            await EnvironmentVariableService.setEnvironmentVariableDefault(
                mockUpdateRecord,
                'def-123',
                'default value'
            );

            expect(mockUpdateRecord).toHaveBeenCalled();
        });
    });

    describe('createEnvironmentVariable', () => {
        it('should create new environment variable', async () => {
            mockCreateRecord.mockResolvedValue('def-new');
            mockWebApiFetch.mockResolvedValue({ environmentvariablevalueid: 'val-new' });
            mockAddSolutionComponent.mockResolvedValue(true);

            const input = {
                displayName: 'New Variable',
                schemaName: 'new_NewVar',
                type: 'string',
                description: 'Test description',
                defaultValue: 'default',
                currentValue: 'current'
            };

            await EnvironmentVariableService.createEnvironmentVariable(
                mockCreateRecord,
                mockWebApiFetch,
                mockAddSolutionComponent,
                input
            );

            expect(mockCreateRecord).toHaveBeenCalled();
        });

        it('should handle null value for normalization (early return path)', async () => {
            mockCreateRecord.mockResolvedValue({ id: 'def-new' });
            mockAddSolutionComponent.mockResolvedValue(true);

            await EnvironmentVariableService.setCurrentSolution(null, mockRetrieveMultiple);

            const input = {
                displayName: 'Test Variable',
                schemaName: 'new_TestVar',
                type: 'number',
                defaultValue: null, // null triggers early return in _normalizeEnvVarValueByType
                currentValue: undefined // undefined triggers early return
            };

            const result = await EnvironmentVariableService.createEnvironmentVariable(
                mockCreateRecord,
                mockWebApiFetch,
                mockAddSolutionComponent,
                input
            );

            expect(result.definitionId).toBe('def-new');
            expect(mockWebApiFetch).not.toHaveBeenCalled(); // no value created
        });
    });

    describe('deleteEnvironmentVariable', () => {
        it('should delete environment variable definition', async () => {
            mockRetrieveRecord.mockResolvedValue({
                environmentvariabledefinitionid: 'def-123'
            });
            mockDeleteRecord.mockResolvedValue(true);

            await EnvironmentVariableService.deleteEnvironmentVariable(
                mockRetrieveRecord,
                mockDeleteRecord,
                'def-123'
            );

            expect(mockDeleteRecord).toHaveBeenCalled();
        });

        it('should delete all value records before deleting definition', async () => {
            mockRetrieveRecord.mockResolvedValue({
                environmentvariabledefinitionid: 'def-123',
                environmentvariabledefinition_environmentvariablevalue: [
                    { environmentvariablevalueid: 'val-1' },
                    { environmentvariablevalueid: 'val-2' }
                ]
            });
            mockDeleteRecord.mockResolvedValue(true);

            await EnvironmentVariableService.deleteEnvironmentVariable(
                mockRetrieveRecord,
                mockDeleteRecord,
                'def-123'
            );

            expect(mockDeleteRecord).toHaveBeenCalledWith('environmentvariablevalue', 'val-1');
            expect(mockDeleteRecord).toHaveBeenCalledWith('environmentvariablevalue', 'val-2');
            expect(mockDeleteRecord).toHaveBeenCalledWith('environmentvariabledefinition', 'def-123');
            expect(mockDeleteRecord).toHaveBeenCalledTimes(3);
        });

        it('should skip value records without environmentvariablevalueid', async () => {
            mockRetrieveRecord.mockResolvedValue({
                environmentvariabledefinitionid: 'def-123',
                environmentvariabledefinition_environmentvariablevalue: [
                    { environmentvariablevalueid: null },
                    { environmentvariablevalueid: 'val-2' }
                ]
            });
            mockDeleteRecord.mockResolvedValue(true);

            await EnvironmentVariableService.deleteEnvironmentVariable(
                mockRetrieveRecord,
                mockDeleteRecord,
                'def-123'
            );

            expect(mockDeleteRecord).toHaveBeenCalledWith('environmentvariablevalue', 'val-2');
            expect(mockDeleteRecord).toHaveBeenCalledWith('environmentvariabledefinition', 'def-123');
            expect(mockDeleteRecord).toHaveBeenCalledTimes(2);
        });

        it('should handle null environmentvariabledefinition_environmentvariablevalue array', async () => {
            mockRetrieveRecord.mockResolvedValue({
                environmentvariabledefinitionid: 'def-123',
                environmentvariabledefinition_environmentvariablevalue: null
            });
            mockDeleteRecord.mockResolvedValue(true);

            await EnvironmentVariableService.deleteEnvironmentVariable(
                mockRetrieveRecord,
                mockDeleteRecord,
                'def-123'
            );

            expect(mockDeleteRecord).toHaveBeenCalledWith('environmentvariabledefinition', 'def-123');
            expect(mockDeleteRecord).toHaveBeenCalledTimes(1);
        });
    });

    describe('setCurrentSolution edge cases', () => {
        it('should clear solution context when uniqueName is null', async () => {
            await EnvironmentVariableService.setCurrentSolution(null, mockRetrieveMultiple);

            const solution = EnvironmentVariableService.getCurrentSolution();
            expect(solution.uniqueName).toBeNull();
            expect(solution.publisherPrefix).toBeNull();
        });

        it('should handle empty entities array when setting solution', async () => {
            mockRetrieveMultiple.mockResolvedValue({
                entities: []
            });

            await EnvironmentVariableService.setCurrentSolution('NonExistentSolution', mockRetrieveMultiple);

            const solution = EnvironmentVariableService.getCurrentSolution();
            expect(solution.uniqueName).toBe('NonExistentSolution');
            expect(solution.publisherPrefix).toBeNull();
        });

        it('should handle missing publisherid in solution entity', async () => {
            mockRetrieveMultiple.mockResolvedValue({
                entities: [{
                    uniquename: 'TestSolution'
                    // no publisherid
                }]
            });

            await EnvironmentVariableService.setCurrentSolution('TestSolution', mockRetrieveMultiple);

            const solution = EnvironmentVariableService.getCurrentSolution();
            expect(solution.uniqueName).toBe('TestSolution');
            expect(solution.publisherPrefix).toBeNull();
        });

        it('should handle null customizationprefix in publisherid', async () => {
            mockRetrieveMultiple.mockResolvedValue({
                entities: [{
                    uniquename: 'TestSolution',
                    publisherid: { customizationprefix: null }
                }]
            });

            await EnvironmentVariableService.setCurrentSolution('TestSolution', mockRetrieveMultiple);

            const solution = EnvironmentVariableService.getCurrentSolution();
            expect(solution.publisherPrefix).toBeNull();
        });
    });

    describe('getEnvironmentVariables edge cases', () => {
        it('should use formatted type value when available', async () => {
            mockRetrieveMultiple.mockResolvedValue({
                entities: [
                    {
                        environmentvariabledefinitionid: 'def-123',
                        environmentvariabledefinition_environmentvariablevalue: [],
                        schemaname: 'new_TestVar',
                        type: 100000000,
                        'type@OData.Community.Display.V1.FormattedValue': 'String'
                    }
                ]
            });

            const result = await EnvironmentVariableService.getEnvironmentVariables(mockRetrieveMultiple);
            expect(result[0].type).toBe('String');
        });

        it('should use displayname when available, fallback to schemaname', async () => {
            mockRetrieveMultiple.mockResolvedValue({
                entities: [
                    {
                        environmentvariabledefinitionid: 'def-123',
                        environmentvariabledefinition_environmentvariablevalue: [],
                        schemaname: 'new_TestVar',
                        displayname: null,
                        type: 100000000
                    }
                ]
            });

            const result = await EnvironmentVariableService.getEnvironmentVariables(mockRetrieveMultiple);
            expect(result[0].displayName).toBe('new_TestVar');
        });

        it('should handle missing value in environmentvariablevalue', async () => {
            mockRetrieveMultiple.mockResolvedValue({
                entities: [
                    {
                        environmentvariabledefinitionid: 'def-123',
                        environmentvariabledefinition_environmentvariablevalue: [
                            { environmentvariablevalueid: 'val-456' }
                            // no value property
                        ],
                        schemaname: 'new_TestVar',
                        type: 100000000
                    }
                ]
            });

            const result = await EnvironmentVariableService.getEnvironmentVariables(mockRetrieveMultiple);
            expect(result[0].currentValue).toBe('(not set)');
        });

        it('should handle defaultvalue as empty dash when not set', async () => {
            mockRetrieveMultiple.mockResolvedValue({
                entities: [
                    {
                        environmentvariabledefinitionid: 'def-123',
                        environmentvariabledefinition_environmentvariablevalue: [],
                        schemaname: 'new_TestVar',
                        defaultvalue: null,
                        type: 100000000
                    }
                ]
            });

            const result = await EnvironmentVariableService.getEnvironmentVariables(mockRetrieveMultiple);
            expect(result[0].defaultValue).toBe('—');
        });

        it('should return Unknown for unknown type option value', async () => {
            mockRetrieveMultiple.mockResolvedValue({
                entities: [
                    {
                        environmentvariabledefinitionid: 'def-123',
                        environmentvariabledefinition_environmentvariablevalue: [],
                        schemaname: 'new_TestVar',
                        type: 999999999 // unknown type value
                    }
                ]
            });

            const result = await EnvironmentVariableService.getEnvironmentVariables(mockRetrieveMultiple);
            expect(result[0].type).toBe('Unknown');
        });
    });

    describe('createEnvironmentVariable edge cases', () => {
        it('should create variable without default or current value', async () => {
            mockCreateRecord.mockResolvedValue({ id: 'def-new' });
            mockAddSolutionComponent.mockResolvedValue(true);

            // First set up a solution context
            mockRetrieveMultiple.mockResolvedValue({
                entities: [{
                    uniquename: 'MySolution',
                    publisherid: { customizationprefix: 'new' }
                }]
            });
            await EnvironmentVariableService.setCurrentSolution('MySolution', mockRetrieveMultiple);

            const input = {
                displayName: 'New Variable',
                schemaName: 'TestVar', // without prefix
                type: 'string',
                description: 'Test description'
                // no defaultValue, no currentValue
            };

            const result = await EnvironmentVariableService.createEnvironmentVariable(
                mockCreateRecord,
                mockWebApiFetch,
                mockAddSolutionComponent,
                input
            );

            expect(result.definitionId).toBe('def-new');
            expect(result.schemaname).toBe('new_TestVar');
            expect(mockWebApiFetch).not.toHaveBeenCalled(); // no value created
        });

        it('should handle schemaName that already has prefix', async () => {
            mockCreateRecord.mockResolvedValue({ id: 'def-new' });
            mockAddSolutionComponent.mockResolvedValue(true);

            // First set up a solution context
            mockRetrieveMultiple.mockResolvedValue({
                entities: [{
                    uniquename: 'MySolution',
                    publisherid: { customizationprefix: 'custom' }
                }]
            });
            await EnvironmentVariableService.setCurrentSolution('MySolution', mockRetrieveMultiple);

            const input = {
                displayName: 'New Variable',
                schemaName: 'existing_TestVar', // already has prefix
                type: 'string'
            };

            const result = await EnvironmentVariableService.createEnvironmentVariable(
                mockCreateRecord,
                mockWebApiFetch,
                mockAddSolutionComponent,
                input
            );

            expect(result.schemaname).toBe('existing_TestVar'); // prefix not added again
        });

        it('should not add to solution when no solution context', async () => {
            mockCreateRecord.mockResolvedValue({ id: 'def-new' });

            // Clear solution context
            await EnvironmentVariableService.setCurrentSolution(null, mockRetrieveMultiple);

            const input = {
                displayName: 'New Variable',
                schemaName: 'TestVar',
                type: 'string'
            };

            await EnvironmentVariableService.createEnvironmentVariable(
                mockCreateRecord,
                mockWebApiFetch,
                mockAddSolutionComponent,
                input
            );

            expect(mockAddSolutionComponent).not.toHaveBeenCalled();
        });

        it('should handle number type and normalize value', async () => {
            mockCreateRecord.mockResolvedValue({ id: 'def-new' });
            mockWebApiFetch.mockResolvedValue({ id: 'val-new' });
            mockAddSolutionComponent.mockResolvedValue(true);

            // Set up solution context
            mockRetrieveMultiple.mockResolvedValue({
                entities: [{
                    uniquename: 'MySolution',
                    publisherid: { customizationprefix: 'new' }
                }]
            });
            await EnvironmentVariableService.setCurrentSolution('MySolution', mockRetrieveMultiple);

            const input = {
                displayName: 'Number Variable',
                schemaName: 'NumVar',
                type: 'number',
                defaultValue: '42.5',
                currentValue: '100'
            };

            await EnvironmentVariableService.createEnvironmentVariable(
                mockCreateRecord,
                mockWebApiFetch,
                mockAddSolutionComponent,
                input
            );

            expect(mockCreateRecord).toHaveBeenCalled();
        });

        it('should handle boolean type and normalize value', async () => {
            mockCreateRecord.mockResolvedValue({ id: 'def-new' });
            mockWebApiFetch.mockResolvedValue({ id: 'val-new' });
            mockAddSolutionComponent.mockResolvedValue(true);

            await EnvironmentVariableService.setCurrentSolution(null, mockRetrieveMultiple);

            const input = {
                displayName: 'Boolean Variable',
                schemaName: 'new_BoolVar',
                type: 'boolean',
                defaultValue: 'true',
                currentValue: 'false'
            };

            await EnvironmentVariableService.createEnvironmentVariable(
                mockCreateRecord,
                mockWebApiFetch,
                mockAddSolutionComponent,
                input
            );

            expect(mockCreateRecord).toHaveBeenCalled();
        });

        it('should handle json type and normalize value', async () => {
            mockCreateRecord.mockResolvedValue({ id: 'def-new' });
            mockWebApiFetch.mockResolvedValue({ id: 'val-new' });
            mockAddSolutionComponent.mockResolvedValue(true);

            await EnvironmentVariableService.setCurrentSolution(null, mockRetrieveMultiple);

            const input = {
                displayName: 'JSON Variable',
                schemaName: 'new_JsonVar',
                type: 'json',
                defaultValue: '{"key": "value"}',
                currentValue: '{"foo": "bar"}'
            };

            await EnvironmentVariableService.createEnvironmentVariable(
                mockCreateRecord,
                mockWebApiFetch,
                mockAddSolutionComponent,
                input
            );

            expect(mockCreateRecord).toHaveBeenCalled();
        });

        it('should return valueId from webApiFetch response with environmentvariablevalueid', async () => {
            mockCreateRecord.mockResolvedValue({ id: 'def-new' });
            mockWebApiFetch.mockResolvedValue({ environmentvariablevalueid: 'val-id-123' });
            mockAddSolutionComponent.mockResolvedValue(true);

            await EnvironmentVariableService.setCurrentSolution(null, mockRetrieveMultiple);

            const input = {
                displayName: 'Test Variable',
                schemaName: 'new_TestVar',
                type: 'string',
                currentValue: 'test'
            };

            const result = await EnvironmentVariableService.createEnvironmentVariable(
                mockCreateRecord,
                mockWebApiFetch,
                mockAddSolutionComponent,
                input
            );

            expect(result.valueId).toBe('val-id-123');
        });

        it('should handle null result from webApiFetch for valueId', async () => {
            mockCreateRecord.mockResolvedValue({ id: 'def-new' });
            mockWebApiFetch.mockResolvedValue(null);
            mockAddSolutionComponent.mockResolvedValue(true);

            await EnvironmentVariableService.setCurrentSolution(null, mockRetrieveMultiple);

            const input = {
                displayName: 'Test Variable',
                schemaName: 'new_TestVar',
                type: 'string',
                currentValue: 'test'
            };

            const result = await EnvironmentVariableService.createEnvironmentVariable(
                mockCreateRecord,
                mockWebApiFetch,
                mockAddSolutionComponent,
                input
            );

            expect(result.valueId).toBeNull();
        });

        it('should use environmentvariabledefinitionid from createRecord response', async () => {
            mockCreateRecord.mockResolvedValue({ environmentvariabledefinitionid: 'def-guid' });
            mockAddSolutionComponent.mockResolvedValue(true);

            await EnvironmentVariableService.setCurrentSolution(null, mockRetrieveMultiple);

            const input = {
                displayName: 'Test Variable',
                schemaName: 'new_TestVar',
                type: 'string'
            };

            const result = await EnvironmentVariableService.createEnvironmentVariable(
                mockCreateRecord,
                mockWebApiFetch,
                mockAddSolutionComponent,
                input
            );

            expect(result.definitionId).toBe('def-guid');
        });

        it('should handle empty string schemaName', async () => {
            mockCreateRecord.mockResolvedValue({ id: 'def-new' });
            mockAddSolutionComponent.mockResolvedValue(true);

            await EnvironmentVariableService.setCurrentSolution(null, mockRetrieveMultiple);

            const input = {
                displayName: 'Test Variable',
                schemaName: '',
                type: 'string'
            };

            const result = await EnvironmentVariableService.createEnvironmentVariable(
                mockCreateRecord,
                mockWebApiFetch,
                mockAddSolutionComponent,
                input
            );

            expect(result.schemaname).toBe('');
        });

        it('should handle null schemaName', async () => {
            mockCreateRecord.mockResolvedValue({ id: 'def-new' });
            mockAddSolutionComponent.mockResolvedValue(true);

            await EnvironmentVariableService.setCurrentSolution(null, mockRetrieveMultiple);

            const input = {
                displayName: 'Test Variable',
                schemaName: null,
                type: 'string'
            };

            const result = await EnvironmentVariableService.createEnvironmentVariable(
                mockCreateRecord,
                mockWebApiFetch,
                mockAddSolutionComponent,
                input
            );

            expect(result.schemaname).toBe('');
        });

        it('should handle unknown type defaulting to string option value', async () => {
            mockCreateRecord.mockResolvedValue({ id: 'def-new' });
            mockAddSolutionComponent.mockResolvedValue(true);

            await EnvironmentVariableService.setCurrentSolution(null, mockRetrieveMultiple);

            const input = {
                displayName: 'Test Variable',
                schemaName: 'new_TestVar',
                type: 'unknowntype' // unknown type
            };

            await EnvironmentVariableService.createEnvironmentVariable(
                mockCreateRecord,
                mockWebApiFetch,
                mockAddSolutionComponent,
                input
            );

            // Should use string type value (100000000)
            expect(mockCreateRecord).toHaveBeenCalledWith(
                'environmentvariabledefinition',
                expect.objectContaining({ type: 100000000 })
            );
        });

        it('should handle null type defaulting to string option value', async () => {
            mockCreateRecord.mockResolvedValue({ id: 'def-new' });
            mockAddSolutionComponent.mockResolvedValue(true);

            await EnvironmentVariableService.setCurrentSolution(null, mockRetrieveMultiple);

            const input = {
                displayName: 'Test Variable',
                schemaName: 'new_TestVar',
                type: null
            };

            await EnvironmentVariableService.createEnvironmentVariable(
                mockCreateRecord,
                mockWebApiFetch,
                mockAddSolutionComponent,
                input
            );

            // Should use string type value (100000000)
            expect(mockCreateRecord).toHaveBeenCalledWith(
                'environmentvariabledefinition',
                expect.objectContaining({ type: 100000000 })
            );
        });
    });

    describe('setEnvironmentVariableValue edge cases', () => {
        it('should call updateRecord with correct payload when valueId exists', async () => {
            mockUpdateRecord.mockResolvedValue(true);

            await EnvironmentVariableService.setEnvironmentVariableValue(
                mockUpdateRecord,
                mockWebApiFetch,
                'def-123',
                'val-456',
                'updated value',
                'new_TestVar'
            );

            expect(mockUpdateRecord).toHaveBeenCalledWith(
                'environmentvariablevalue',
                'val-456',
                { value: 'updated value' }
            );
        });

        it('should call webApiFetch with correct payload when valueId is null', async () => {
            mockWebApiFetch.mockResolvedValue({ environmentvariablevalueid: 'val-new' });

            await EnvironmentVariableService.setEnvironmentVariableValue(
                mockUpdateRecord,
                mockWebApiFetch,
                'def-123',
                null,
                'new value',
                'new_TestVar'
            );

            expect(mockWebApiFetch).toHaveBeenCalledWith(
                'POST',
                'environmentvariablevalue',
                '',
                {
                    value: 'new value',
                    schemaname: 'new_TestVar',
                    'EnvironmentVariableDefinitionId@odata.bind': '/environmentvariabledefinitions(def-123)'
                }
            );
        });
    });

    describe('setEnvironmentVariableDefault edge cases', () => {
        it('should call updateRecord with correct payload', async () => {
            mockUpdateRecord.mockResolvedValue(true);

            await EnvironmentVariableService.setEnvironmentVariableDefault(
                mockUpdateRecord,
                'def-123',
                'new default'
            );

            expect(mockUpdateRecord).toHaveBeenCalledWith(
                'environmentvariabledefinition',
                'def-123',
                { defaultvalue: 'new default' }
            );
        });
    });
});
