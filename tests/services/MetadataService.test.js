/**
 * @file Comprehensive Tests for MetadataService
 * @module tests/services/MetadataService
 * @description Tests for entity/attribute metadata retrieval and caching
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock NotificationService
vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: {
        show: vi.fn()
    }
}));

// Mock Config
vi.mock('../../src/constants/index.js', () => ({
    Config: {
        MESSAGES: {
            DATA_SERVICE: {
                limitedMetadata: 'Limited metadata access due to permissions.'
            }
        }
    }
}));

// Import after mocks
import { MetadataService } from '../../src/services/MetadataService.js';
import { NotificationService } from '../../src/services/NotificationService.js';

describe('MetadataService', () => {
    /** @type {vi.Mock} */
    let mockWebApiFetch;

    beforeEach(() => {
        vi.clearAllMocks();
        // Clear all caches before each test
        MetadataService.clearCache();

        // Create mock Web API fetch function
        mockWebApiFetch = vi.fn();
    });

    afterEach(() => {
        // Ensure cache is clean after each test
        MetadataService.clearCache();
    });

    describe('loadEntityMetadata', () => {
        it('should load entity metadata successfully', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { LogicalName: 'account', EntitySetName: 'accounts' },
                    { LogicalName: 'contact', EntitySetName: 'contacts' }
                ]
            });

            await MetadataService.loadEntityMetadata(mockWebApiFetch);

            expect(mockWebApiFetch).toHaveBeenCalledWith(
                'GET',
                'EntityDefinitions',
                '?$select=LogicalName,EntitySetName'
            );
            expect(MetadataService.isMetadataLoaded()).toBe(true);
        });

        it('should cache entity set name mappings after loading', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { LogicalName: 'account', EntitySetName: 'accounts' }
                ]
            });

            await MetadataService.loadEntityMetadata(mockWebApiFetch);

            expect(MetadataService.getEntitySetName('account')).toBe('accounts');
            expect(MetadataService.getLogicalName('accounts')).toBe('account');
        });

        it('should not reload if already loaded (singleton pattern)', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [{ LogicalName: 'account', EntitySetName: 'accounts' }]
            });

            await MetadataService.loadEntityMetadata(mockWebApiFetch);
            await MetadataService.loadEntityMetadata(mockWebApiFetch);

            // Should only be called once
            expect(mockWebApiFetch).toHaveBeenCalledTimes(1);
        });

        it('should handle 403 permission error for impersonated users', async () => {
            const error = new Error('Status 403: Forbidden');
            mockWebApiFetch.mockRejectedValue(error);

            // Should not throw - silently handles permission error
            await MetadataService.loadEntityMetadata(mockWebApiFetch, 'impersonated-user-id');

            expect(MetadataService.isMetadataLoaded()).toBe(true);
            expect(NotificationService.show).toHaveBeenCalledWith(
                'Limited metadata access due to permissions.',
                'warn'
            );
        });

        it('should add plugintracelog exception mapping', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: []
            });

            await MetadataService.loadEntityMetadata(mockWebApiFetch);

            expect(MetadataService.getEntitySetName('plugintracelog')).toBe('plugintracelogs');
        });
    });

    describe('getEntitySetName / getLogicalName', () => {
        beforeEach(async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { LogicalName: 'account', EntitySetName: 'accounts' },
                    { LogicalName: 'opportunity', EntitySetName: 'opportunities' }
                ]
            });
            await MetadataService.loadEntityMetadata(mockWebApiFetch);
        });

        it('should return entity set name from logical name', () => {
            expect(MetadataService.getEntitySetName('account')).toBe('accounts');
            expect(MetadataService.getEntitySetName('opportunity')).toBe('opportunities');
        });

        it('should return logical name from entity set name', () => {
            expect(MetadataService.getLogicalName('accounts')).toBe('account');
            expect(MetadataService.getLogicalName('opportunities')).toBe('opportunity');
        });

        it('should return null for unknown entity', () => {
            expect(MetadataService.getEntitySetName('nonexistent')).toBeNull();
            expect(MetadataService.getLogicalName('nonexistents')).toBeNull();
        });
    });

    describe('isMetadataLoaded', () => {
        it('should return false before loading', () => {
            expect(MetadataService.isMetadataLoaded()).toBe(false);
        });

        it('should return true after loading', async () => {
            mockWebApiFetch.mockResolvedValue({ value: [] });
            await MetadataService.loadEntityMetadata(mockWebApiFetch);

            expect(MetadataService.isMetadataLoaded()).toBe(true);
        });
    });

    describe('getEntityDefinitions', () => {
        it('should fetch all entity definitions', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { LogicalName: 'account', EntitySetName: 'accounts', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } },
                    { LogicalName: 'contact', EntitySetName: 'contacts', DisplayName: { UserLocalizedLabel: { Label: 'Contact' } } }
                ]
            });

            const result = await MetadataService.getEntityDefinitions(mockWebApiFetch);

            expect(result).toHaveLength(2);
            expect(result[0].LogicalName).toBe('account');
        });

        it('should normalize object keys to PascalCase', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { logicalName: 'account', entitySetName: 'accounts' }
                ]
            });

            const result = await MetadataService.getEntityDefinitions(mockWebApiFetch);

            // Keys should be normalized to PascalCase
            expect(result[0].LogicalName).toBe('account');
            expect(result[0].EntitySetName).toBe('accounts');
        });

        it('should cache entity definitions', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [{ LogicalName: 'account', EntitySetName: 'accounts' }]
            });

            await MetadataService.getEntityDefinitions(mockWebApiFetch);
            await MetadataService.getEntityDefinitions(mockWebApiFetch);

            // Should be cached - only one call
            expect(mockWebApiFetch).toHaveBeenCalledTimes(1);
        });

        it('should bypass cache when requested', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [{ LogicalName: 'account', EntitySetName: 'accounts' }]
            });

            await MetadataService.getEntityDefinitions(mockWebApiFetch);
            await MetadataService.getEntityDefinitions(mockWebApiFetch, null, true);

            // Should be called twice due to bypass
            expect(mockWebApiFetch).toHaveBeenCalledTimes(2);
        });

        it('should return empty array on 403 error', async () => {
            const error = new Error('Status 403: prvReadEntity privilege required');
            mockWebApiFetch.mockRejectedValue(error);

            const result = await MetadataService.getEntityDefinitions(mockWebApiFetch);

            expect(result).toEqual([]);
            expect(NotificationService.show).toHaveBeenCalled();
        });

        it('should return empty array when response has no value', async () => {
            mockWebApiFetch.mockResolvedValue(null);

            const result = await MetadataService.getEntityDefinitions(mockWebApiFetch);

            expect(result).toEqual([]);
        });
    });

    describe('getAttributeDefinitions', () => {
        it('should fetch attribute definitions for an entity', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { LogicalName: 'name', AttributeType: 'String' },
                    { LogicalName: 'accountid', AttributeType: 'Uniqueidentifier' }
                ]
            });

            const result = await MetadataService.getAttributeDefinitions(mockWebApiFetch, 'account');

            expect(result).toHaveLength(2);
            expect(result[0].LogicalName).toBe('name');
            expect(mockWebApiFetch).toHaveBeenCalledWith(
                'GET',
                "EntityDefinitions(LogicalName='account')/Attributes"
            );
        });

        it('should cache attribute definitions by entity', async () => {
            mockWebApiFetch.mockResolvedValue({ value: [{ LogicalName: 'name' }] });

            await MetadataService.getAttributeDefinitions(mockWebApiFetch, 'account');
            await MetadataService.getAttributeDefinitions(mockWebApiFetch, 'account');

            expect(mockWebApiFetch).toHaveBeenCalledTimes(1);
        });

        it('should return empty array when no value in response', async () => {
            mockWebApiFetch.mockResolvedValue({});

            const result = await MetadataService.getAttributeDefinitions(mockWebApiFetch, 'account');

            expect(result).toEqual([]);
        });
    });

    describe('getEntityBySetName', () => {
        it('should resolve entity from cache', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [{ LogicalName: 'account', EntitySetName: 'accounts' }]
            });
            await MetadataService.loadEntityMetadata(mockWebApiFetch);

            const result = await MetadataService.getEntityBySetName(mockWebApiFetch, null, 'accounts');

            expect(result).toEqual({ LogicalName: 'account', EntitySetName: 'accounts' });
        });

        it('should return null for unknown entity set name', async () => {
            mockWebApiFetch.mockResolvedValue({ value: [] });
            await MetadataService.loadEntityMetadata(mockWebApiFetch);

            // Need a different mock for getEntityDefinitions
            mockWebApiFetch.mockResolvedValue({ value: [] });

            const result = await MetadataService.getEntityBySetName(mockWebApiFetch, null, 'unknownentities');

            expect(result).toBeNull();
        });
    });

    describe('getEntityByAny', () => {
        beforeEach(async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { LogicalName: 'account', EntitySetName: 'accounts' },
                    { LogicalName: 'contact', EntitySetName: 'contacts' }
                ]
            });
        });

        it('should resolve entity by set name', async () => {
            const result = await MetadataService.getEntityByAny(mockWebApiFetch, null, 'accounts');

            expect(result).toEqual({ LogicalName: 'account', EntitySetName: 'accounts' });
        });

        it('should resolve entity by logical name', async () => {
            const result = await MetadataService.getEntityByAny(mockWebApiFetch, null, 'contact');

            expect(result).toEqual({ LogicalName: 'contact', EntitySetName: 'contacts' });
        });

        it('should return null for empty input', async () => {
            const result = await MetadataService.getEntityByAny(mockWebApiFetch, null, '');

            expect(result).toBeNull();
        });

        it('should return null for unknown entity', async () => {
            // First call for set name resolution
            mockWebApiFetch.mockResolvedValueOnce({ value: [] });
            // Second call for definitions
            mockWebApiFetch.mockResolvedValueOnce({ value: [] });

            const result = await MetadataService.getEntityByAny(mockWebApiFetch, null, 'nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('getEntityDefinition', () => {
        it('should return entity definition from cached definitions', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { LogicalName: 'account', EntitySetName: 'accounts', PrimaryNameAttribute: 'name' }
                ]
            });

            const result = await MetadataService.getEntityDefinition(mockWebApiFetch, null, 'account');

            expect(result.LogicalName).toBe('account');
            expect(result.PrimaryNameAttribute).toBe('name');
        });

        it('should return null for empty input', async () => {
            const result = await MetadataService.getEntityDefinition(mockWebApiFetch, null, '');

            expect(result).toBeNull();
        });

        it('should fetch directly if not in cache', async () => {
            // First call for definitions returns empty
            mockWebApiFetch.mockResolvedValueOnce({ value: [] });
            // Second call for direct fetch
            mockWebApiFetch.mockResolvedValueOnce({
                LogicalName: 'customentity',
                EntitySetName: 'customentities',
                PrimaryNameAttribute: 'customname'
            });

            const result = await MetadataService.getEntityDefinition(mockWebApiFetch, null, 'customentity');

            expect(result.LogicalName).toBe('customentity');
        });

        it('should return null when fetch fails', async () => {
            mockWebApiFetch.mockResolvedValueOnce({ value: [] });
            mockWebApiFetch.mockRejectedValueOnce(new Error('Not found'));

            const result = await MetadataService.getEntityDefinition(mockWebApiFetch, null, 'nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('getAttributeMap', () => {
        it('should create attribute type map for entity', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { LogicalName: 'name', AttributeTypeName: { Value: 'StringType' } },
                    { LogicalName: 'parentaccountid', AttributeTypeName: { Value: 'LookupType' }, Targets: ['account'] },
                    { LogicalName: 'revenue', AttributeTypeName: { Value: 'MoneyType' } },
                    { LogicalName: 'industrycode', AttributeTypeName: { Value: 'PicklistType' } },
                    { LogicalName: 'donotcall', AttributeTypeName: { Value: 'BooleanType' } },
                    { LogicalName: 'createdon', AttributeTypeName: { Value: 'DateTimeType' } }
                ]
            });

            const map = await MetadataService.getAttributeMap(mockWebApiFetch, 'account');

            expect(map.get('name')).toEqual({ type: 'string' });
            expect(map.get('parentaccountid')).toEqual({ type: 'lookup', targets: ['account'] });
            expect(map.get('revenue')).toEqual({ type: 'number' });
            expect(map.get('industrycode')).toEqual({ type: 'optionset' });
            expect(map.get('donotcall')).toEqual({ type: 'boolean' });
            expect(map.get('createdon')).toEqual({ type: 'date' });
        });

        it('should handle state and status attributes as optionset', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { LogicalName: 'statecode', AttributeTypeName: { Value: 'StateType' } },
                    { LogicalName: 'statuscode', AttributeTypeName: { Value: 'StatusType' } }
                ]
            });

            const map = await MetadataService.getAttributeMap(mockWebApiFetch, 'account');

            expect(map.get('statecode')).toEqual({ type: 'optionset' });
            expect(map.get('statuscode')).toEqual({ type: 'optionset' });
        });

        it('should skip attributes without logical name', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { LogicalName: 'valid', AttributeTypeName: { Value: 'StringType' } },
                    { AttributeTypeName: { Value: 'StringType' } } // Missing LogicalName
                ]
            });

            const map = await MetadataService.getAttributeMap(mockWebApiFetch, 'account');

            expect(map.size).toBe(1);
            expect(map.has('valid')).toBe(true);
        });
    });

    describe('getNavigationPropertyMap', () => {
        it('should return map of lookup attributes to navigation properties', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { ReferencingAttribute: 'parentaccountid', ReferencingEntityNavigationPropertyName: 'parentaccountid' },
                    { ReferencingAttribute: 'primarycontactid', ReferencingEntityNavigationPropertyName: 'primarycontactid_contact' }
                ]
            });

            const map = await MetadataService.getNavigationPropertyMap(mockWebApiFetch, 'account');

            expect(map.get('parentaccountid')).toBe('parentaccountid');
            expect(map.get('primarycontactid')).toBe('primarycontactid_contact');
        });

        it('should handle empty response', async () => {
            mockWebApiFetch.mockResolvedValue({});

            const map = await MetadataService.getNavigationPropertyMap(mockWebApiFetch, 'account');

            expect(map.size).toBe(0);
        });

        it('should return empty map on error', async () => {
            mockWebApiFetch.mockRejectedValue(new Error('Failed'));

            const map = await MetadataService.getNavigationPropertyMap(mockWebApiFetch, 'account');

            expect(map.size).toBe(0);
        });
    });

    describe('getPicklistOptions', () => {
        it('should fetch picklist options for an attribute', async () => {
            // First call for attribute type detection
            mockWebApiFetch.mockResolvedValueOnce({
                AttributeTypeName: { Value: 'PicklistType' }
            });
            // Second call for options
            mockWebApiFetch.mockResolvedValueOnce({
                OptionSet: {
                    Options: [
                        { Value: 1, Label: { UserLocalizedLabel: { Label: 'Active' } } },
                        { Value: 2, Label: { UserLocalizedLabel: { Label: 'Inactive' } } }
                    ]
                }
            });

            const options = await MetadataService.getPicklistOptions(mockWebApiFetch, 'account', 'industrycode');

            expect(options).toHaveLength(2);
            expect(options[0]).toEqual({ value: 1, label: 'Active' });
            expect(options[1]).toEqual({ value: 2, label: 'Inactive' });
        });

        it('should handle statecode special case', async () => {
            mockWebApiFetch.mockResolvedValue({
                OptionSet: {
                    Options: [
                        { Value: 0, Label: { UserLocalizedLabel: { Label: 'Active' } } }
                    ]
                }
            });

            const options = await MetadataService.getPicklistOptions(mockWebApiFetch, 'account', 'statecode');

            expect(options).toHaveLength(1);
            expect(mockWebApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining('StateAttributeMetadata'),
                expect.any(String)
            );
        });

        it('should handle statuscode special case', async () => {
            mockWebApiFetch.mockResolvedValue({
                OptionSet: {
                    Options: [
                        { Value: 1, Label: { UserLocalizedLabel: { Label: 'Open' } } }
                    ]
                }
            });

            const options = await MetadataService.getPicklistOptions(mockWebApiFetch, 'account', 'statuscode');

            expect(options).toHaveLength(1);
            expect(mockWebApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining('StatusAttributeMetadata'),
                expect.any(String)
            );
        });

        it('should use GlobalOptionSet as fallback', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                AttributeTypeName: { Value: 'PicklistType' }
            });
            mockWebApiFetch.mockResolvedValueOnce({
                GlobalOptionSet: {
                    Options: [
                        { Value: 100, Label: { LocalizedLabels: [{ Label: 'Global Option' }] } }
                    ]
                }
            });

            const options = await MetadataService.getPicklistOptions(mockWebApiFetch, 'account', 'globalattr');

            expect(options).toHaveLength(1);
            expect(options[0].label).toBe('Global Option');
        });

        it('should return empty array on error', async () => {
            mockWebApiFetch.mockRejectedValue(new Error('Failed'));

            const options = await MetadataService.getPicklistOptions(mockWebApiFetch, 'account', 'badattr');

            expect(options).toEqual([]);
        });

        it('should use value as label fallback when no label', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                AttributeTypeName: { Value: 'PicklistType' }
            });
            mockWebApiFetch.mockResolvedValueOnce({
                OptionSet: {
                    Options: [
                        { Value: 999 } // No Label property
                    ]
                }
            });

            const options = await MetadataService.getPicklistOptions(mockWebApiFetch, 'account', 'nolabel');

            expect(options[0].label).toBe('999');
        });
    });

    describe('getBooleanOptions', () => {
        it('should fetch boolean options for an attribute', async () => {
            mockWebApiFetch.mockResolvedValue({
                OptionSet: {
                    TrueOption: { Label: { UserLocalizedLabel: { Label: 'Yes' } } },
                    FalseOption: { Label: { UserLocalizedLabel: { Label: 'No' } } }
                }
            });

            const options = await MetadataService.getBooleanOptions(mockWebApiFetch, 'account', 'donotcall');

            expect(options.trueLabel).toBe('Yes');
            expect(options.falseLabel).toBe('No');
        });

        it('should return default labels when labels missing', async () => {
            mockWebApiFetch.mockResolvedValue({
                OptionSet: {}
            });

            const options = await MetadataService.getBooleanOptions(mockWebApiFetch, 'account', 'boolattr');

            expect(options.trueLabel).toBe('True');
            expect(options.falseLabel).toBe('False');
        });

        it('should return default labels on error', async () => {
            mockWebApiFetch.mockRejectedValue(new Error('Failed'));

            const options = await MetadataService.getBooleanOptions(mockWebApiFetch, 'account', 'badattr');

            expect(options.trueLabel).toBe('True');
            expect(options.falseLabel).toBe('False');
        });
    });

    describe('clearCache', () => {
        beforeEach(async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [{ LogicalName: 'account', EntitySetName: 'accounts' }]
            });
            await MetadataService.loadEntityMetadata(mockWebApiFetch);
        });

        it('should clear all caches when called without key', () => {
            expect(MetadataService.isMetadataLoaded()).toBe(true);
            expect(MetadataService.getEntitySetName('account')).toBe('accounts');

            MetadataService.clearCache();

            expect(MetadataService.isMetadataLoaded()).toBe(false);
            expect(MetadataService.getEntitySetName('account')).toBeNull();
        });

        it('should clear specific cache key when provided', async () => {
            // First load entity definitions to cache them
            await MetadataService.getEntityDefinitions(mockWebApiFetch);

            // Clear just the entity definitions
            MetadataService.clearCache('entityDefinitions');

            // Metadata should still be loaded
            expect(MetadataService.isMetadataLoaded()).toBe(true);
        });
    });

    describe('getEntityDefinitions - impersonated user access testing', () => {
        it('should test entity access for impersonated users and filter accessible entities', async () => {
            // Mock entity definitions response
            mockWebApiFetch.mockResolvedValueOnce({
                value: [
                    { LogicalName: 'account', EntitySetName: 'accounts' },
                    { LogicalName: 'contact', EntitySetName: 'contacts' },
                    { LogicalName: 'opportunity', EntitySetName: 'opportunities' }
                ]
            });

            // Mock access tests: account succeeds, contact fails, opportunity succeeds
            mockWebApiFetch.mockResolvedValueOnce({ value: [] }); // accounts - accessible
            mockWebApiFetch.mockRejectedValueOnce(new Error('403 Forbidden')); // contacts - no access
            mockWebApiFetch.mockResolvedValueOnce({ value: [] }); // opportunities - accessible

            const result = await MetadataService.getEntityDefinitions(mockWebApiFetch, 'impersonated-user-123');

            // Should only return accessible entities
            expect(result).toHaveLength(2);
            expect(result.map(r => r.LogicalName)).toContain('account');
            expect(result.map(r => r.LogicalName)).toContain('opportunity');
            expect(result.map(r => r.LogicalName)).not.toContain('contact');
        });

        it('should filter out entities with no EntitySetName for impersonated users', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                value: [
                    { LogicalName: 'account', EntitySetName: 'accounts' },
                    { LogicalName: 'internalentity', EntitySetName: null }, // No EntitySetName
                    { LogicalName: 'contact', EntitySetName: '' } // Empty EntitySetName
                ]
            });

            // Only accounts should be tested
            mockWebApiFetch.mockResolvedValueOnce({ value: [] }); // accounts accessible

            const result = await MetadataService.getEntityDefinitions(mockWebApiFetch, 'impersonated-user-456');

            expect(result).toHaveLength(1);
            expect(result[0].LogicalName).toBe('account');
        });

        it('should cache entity set name and logical name mappings for impersonated users', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                value: [
                    { LogicalName: 'account', EntitySetName: 'accounts' }
                ]
            });
            mockWebApiFetch.mockResolvedValueOnce({ value: [] }); // Access check passes

            await MetadataService.getEntityDefinitions(mockWebApiFetch, 'impersonated-user-789');

            expect(MetadataService.getEntitySetName('account')).toBe('accounts');
            expect(MetadataService.getLogicalName('accounts')).toBe('account');
        });

        it('should return empty array when all entities fail access check for impersonated user', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                value: [
                    { LogicalName: 'secretentity', EntitySetName: 'secretentities' }
                ]
            });
            mockWebApiFetch.mockRejectedValueOnce(new Error('403 Forbidden'));

            const result = await MetadataService.getEntityDefinitions(mockWebApiFetch, 'impersonated-no-access');

            expect(result).toHaveLength(0);
        });

        it('should handle mixed accessible and inaccessible entities for impersonated users', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                value: [
                    { LogicalName: 'lead', EntitySetName: 'leads' },
                    { LogicalName: 'account', EntitySetName: 'accounts' },
                    { LogicalName: 'systemuser', EntitySetName: 'systemusers' },
                    { LogicalName: 'team', EntitySetName: 'teams' }
                ]
            });

            // Simulate access checks - alternating success/failure
            mockWebApiFetch.mockResolvedValueOnce({ value: [] }); // leads accessible
            mockWebApiFetch.mockRejectedValueOnce(new Error('No access')); // accounts no access
            mockWebApiFetch.mockResolvedValueOnce({ value: [] }); // systemusers accessible
            mockWebApiFetch.mockRejectedValueOnce(new Error('No access')); // teams no access

            const result = await MetadataService.getEntityDefinitions(mockWebApiFetch, 'impersonated-mixed');

            expect(result).toHaveLength(2);
            expect(result.map(r => r.LogicalName)).toEqual(['lead', 'systemuser']);
        });

        it('should not perform entity access checks when impersonatedUserId is null', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                value: [
                    { LogicalName: 'account', EntitySetName: 'accounts' },
                    { LogicalName: 'contact', EntitySetName: 'contacts' }
                ]
            });

            const result = await MetadataService.getEntityDefinitions(mockWebApiFetch, null);

            // Should return all entities without additional access checks
            expect(result).toHaveLength(2);
            expect(mockWebApiFetch).toHaveBeenCalledTimes(1); // Only the initial fetch
        });

        it('should mark metadata as loaded after processing impersonated user definitions', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                value: [
                    { LogicalName: 'account', EntitySetName: 'accounts' }
                ]
            });
            mockWebApiFetch.mockResolvedValueOnce({ value: [] });

            await MetadataService.getEntityDefinitions(mockWebApiFetch, 'impersonated-metadata-check');

            expect(MetadataService.isMetadataLoaded()).toBe(true);
        });
    });

    describe('getEntityDefinitions - 403 error with prvReadEntity (line 180)', () => {
        it('should handle prvReadEntity privilege error message', async () => {
            const error = new Error('prvReadEntity privilege is required');
            mockWebApiFetch.mockRejectedValue(error);

            const result = await MetadataService.getEntityDefinitions(mockWebApiFetch, null);

            expect(result).toEqual([]);
            expect(NotificationService.show).toHaveBeenCalledWith(
                'Limited metadata access due to permissions.',
                'warn'
            );
        });

        it('should handle combined 403 and prvReadEntity message', async () => {
            const error = new Error('Status 403: prvReadEntity permission denied');
            mockWebApiFetch.mockRejectedValue(error);

            const result = await MetadataService.getEntityDefinitions(mockWebApiFetch);

            expect(result).toEqual([]);
            expect(NotificationService.show).toHaveBeenCalled();
        });

        it('should re-throw non-403 errors', async () => {
            const error = new Error('Network connection failed');
            mockWebApiFetch.mockRejectedValue(error);

            await expect(MetadataService.getEntityDefinitions(mockWebApiFetch))
                .rejects.toThrow('Network connection failed');
        });

        it('should re-throw server errors that are not permission related', async () => {
            const error = new Error('Status 500: Internal Server Error');
            mockWebApiFetch.mockRejectedValue(error);

            await expect(MetadataService.getEntityDefinitions(mockWebApiFetch))
                .rejects.toThrow('Status 500');
        });

        it('should handle error without message property gracefully', async () => {
            const error = { code: 'NETWORK_ERROR' }; // Error without message
            mockWebApiFetch.mockRejectedValue(error);

            // Should re-throw since it's not a recognized 403 error
            await expect(MetadataService.getEntityDefinitions(mockWebApiFetch))
                .rejects.toEqual({ code: 'NETWORK_ERROR' });
        });
    });

    describe('_determineOptionsetMetadataType - catch block (line 389)', () => {
        it('should default to PicklistAttributeMetadata when attribute type detection fails', async () => {
            // First call: type detection fails
            mockWebApiFetch.mockRejectedValueOnce(new Error('Attribute not found'));
            // Second call: optionset fetch succeeds
            mockWebApiFetch.mockResolvedValueOnce({
                OptionSet: {
                    Options: [
                        { Value: 1, Label: { UserLocalizedLabel: { Label: 'Option 1' } } }
                    ]
                }
            });

            const result = await MetadataService.getPicklistOptions(
                mockWebApiFetch,
                'account',
                'unknownpicklist'
            );

            expect(result).toHaveLength(1);
            expect(result[0].label).toBe('Option 1');
            // Verify it used PicklistAttributeMetadata (default) path
            expect(mockWebApiFetch).toHaveBeenLastCalledWith(
                'GET',
                expect.stringContaining('PicklistAttributeMetadata'),
                expect.any(String)
            );
        });

        it('should return default picklist options when attribute type detection fails', async () => {
            mockWebApiFetch.mockRejectedValueOnce(new Error('Detection failed'));
            mockWebApiFetch.mockResolvedValueOnce({
                OptionSet: { Options: [] }
            });

            const options = await MetadataService.getPicklistOptions(mockWebApiFetch, 'account', 'badattr');

            // Should return empty array on detection failure
            expect(Array.isArray(options)).toBe(true);
            expect(mockWebApiFetch).toHaveBeenCalledWith(
                'GET',
                expect.stringContaining('PicklistAttributeMetadata'),
                expect.any(String)
            );
        });

        it('should handle MultiSelectPicklistType correctly when detected', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                AttributeTypeName: { Value: 'MultiSelectPicklistType' }
            });
            mockWebApiFetch.mockResolvedValueOnce({
                OptionSet: {
                    Options: [
                        { Value: 100, Label: { UserLocalizedLabel: { Label: 'Multi Option' } } }
                    ]
                }
            });

            const result = await MetadataService.getPicklistOptions(
                mockWebApiFetch,
                'account',
                'multiselectattr'
            );

            expect(result[0].label).toBe('Multi Option');
            expect(mockWebApiFetch).toHaveBeenLastCalledWith(
                'GET',
                expect.stringContaining('MultiSelectPicklistAttributeMetadata'),
                expect.any(String)
            );
        });

        it('should handle empty AttributeTypeName value', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                AttributeTypeName: { Value: '' }
            });
            mockWebApiFetch.mockResolvedValueOnce({
                OptionSet: {
                    Options: [
                        { Value: 5, Label: { UserLocalizedLabel: { Label: 'Empty Type Option' } } }
                    ]
                }
            });

            const result = await MetadataService.getPicklistOptions(
                mockWebApiFetch,
                'account',
                'emptytype'
            );

            expect(result).toHaveLength(1);
            // Should default to PicklistAttributeMetadata
            expect(mockWebApiFetch).toHaveBeenLastCalledWith(
                'GET',
                expect.stringContaining('PicklistAttributeMetadata'),
                expect.any(String)
            );
        });

        it('should handle null AttributeTypeName response', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                AttributeTypeName: null
            });
            mockWebApiFetch.mockResolvedValueOnce({
                OptionSet: { Options: [] }
            });

            const result = await MetadataService.getPicklistOptions(
                mockWebApiFetch,
                'account',
                'nulltype'
            );

            expect(result).toEqual([]);
        });

        it('should handle undefined response from attribute type query', async () => {
            mockWebApiFetch.mockResolvedValueOnce(undefined);
            mockWebApiFetch.mockResolvedValueOnce({
                OptionSet: {
                    Options: [{ Value: 1, Label: { UserLocalizedLabel: { Label: 'Test' } } }]
                }
            });

            const result = await MetadataService.getPicklistOptions(
                mockWebApiFetch,
                'account',
                'undefinedresponse'
            );

            expect(result).toHaveLength(1);
        });
    });

    describe('getPicklistOptions - additional edge cases', () => {
        it('should handle options with null Value correctly', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                AttributeTypeName: { Value: 'PicklistType' }
            });
            mockWebApiFetch.mockResolvedValueOnce({
                OptionSet: {
                    Options: [
                        { Value: null, Label: { UserLocalizedLabel: { Label: 'Null Option' } } },
                        { Value: 1, Label: { UserLocalizedLabel: { Label: 'Valid Option' } } }
                    ]
                }
            });

            const result = await MetadataService.getPicklistOptions(
                mockWebApiFetch,
                'account',
                'nullvalue'
            );

            // Should skip null value option
            expect(result).toHaveLength(1);
            expect(result[0].value).toBe(1);
        });

        it('should handle options with undefined Value correctly', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                AttributeTypeName: { Value: 'PicklistType' }
            });
            mockWebApiFetch.mockResolvedValueOnce({
                OptionSet: {
                    Options: [
                        { Label: { UserLocalizedLabel: { Label: 'No Value' } } }, // undefined Value
                        { Value: 2, Label: { UserLocalizedLabel: { Label: 'Has Value' } } }
                    ]
                }
            });

            const result = await MetadataService.getPicklistOptions(
                mockWebApiFetch,
                'account',
                'undefinedvalue'
            );

            expect(result).toHaveLength(1);
            expect(result[0].value).toBe(2);
        });

        it('should handle empty OptionSet in response', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                AttributeTypeName: { Value: 'PicklistType' }
            });
            mockWebApiFetch.mockResolvedValueOnce({
                OptionSet: {}
            });

            const result = await MetadataService.getPicklistOptions(
                mockWebApiFetch,
                'account',
                'emptyoptionset'
            );

            expect(result).toEqual([]);
        });

        it('should handle missing OptionSet and GlobalOptionSet', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                AttributeTypeName: { Value: 'PicklistType' }
            });
            mockWebApiFetch.mockResolvedValueOnce({});

            const result = await MetadataService.getPicklistOptions(
                mockWebApiFetch,
                'account',
                'nooptionset'
            );

            expect(result).toEqual([]);
        });

        it('should use LocalizedLabels fallback when UserLocalizedLabel is missing', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                AttributeTypeName: { Value: 'PicklistType' }
            });
            mockWebApiFetch.mockResolvedValueOnce({
                OptionSet: {
                    Options: [
                        {
                            Value: 10,
                            Label: {
                                LocalizedLabels: [{ Label: 'Localized Label' }]
                            }
                        }
                    ]
                }
            });

            const result = await MetadataService.getPicklistOptions(
                mockWebApiFetch,
                'account',
                'localizedlabel'
            );

            expect(result[0].label).toBe('Localized Label');
        });

        it('should cache optionset results', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                AttributeTypeName: { Value: 'PicklistType' }
            });
            mockWebApiFetch.mockResolvedValueOnce({
                OptionSet: {
                    Options: [{ Value: 1, Label: { UserLocalizedLabel: { Label: 'Cached' } } }]
                }
            });

            await MetadataService.getPicklistOptions(mockWebApiFetch, 'account', 'cachedattr');
            await MetadataService.getPicklistOptions(mockWebApiFetch, 'account', 'cachedattr');

            // Should only be called twice (type detection + fetch), not four times
            expect(mockWebApiFetch).toHaveBeenCalledTimes(2);
        });

        it('should bypass cache when requested', async () => {
            mockWebApiFetch.mockResolvedValue({
                AttributeTypeName: { Value: 'PicklistType' }
            });
            mockWebApiFetch.mockResolvedValueOnce({
                OptionSet: { Options: [{ Value: 1, Label: { UserLocalizedLabel: { Label: 'First' } } }] }
            });
            mockWebApiFetch.mockResolvedValueOnce({
                OptionSet: { Options: [{ Value: 2, Label: { UserLocalizedLabel: { Label: 'Second' } } }] }
            });

            await MetadataService.getPicklistOptions(mockWebApiFetch, 'account', 'bypassattr');
            await MetadataService.getPicklistOptions(mockWebApiFetch, 'account', 'bypassattr', true);

            // Should be called more times due to bypass
            expect(mockWebApiFetch.mock.calls.length).toBeGreaterThan(2);
        });
    });

    describe('loadEntityMetadata - additional scenarios', () => {
        it('should return existing promise if already loading', async () => {
            // Slow response to simulate concurrent calls
            let resolveFirst;
            const slowPromise = new Promise(resolve => { resolveFirst = resolve; });
            mockWebApiFetch.mockReturnValueOnce(slowPromise);

            const promise1 = MetadataService.loadEntityMetadata(mockWebApiFetch);
            const promise2 = MetadataService.loadEntityMetadata(mockWebApiFetch);

            // Resolve and complete
            resolveFirst({ value: [] });
            await Promise.all([promise1, promise2]);

            // Should only have been called once - proving the same promise was reused
            expect(mockWebApiFetch).toHaveBeenCalledTimes(1);
        });

        it('should not notify for 403 error without impersonatedUserId', async () => {
            const error = new Error('Status 403: Forbidden');
            mockWebApiFetch.mockRejectedValue(error);

            await MetadataService.loadEntityMetadata(mockWebApiFetch, null);

            // Should not show notification for non-impersonated users
            expect(NotificationService.show).not.toHaveBeenCalled();
            expect(MetadataService.isMetadataLoaded()).toBe(true);
        });

        it('should re-throw non-permission errors from loadEntityMetadata', async () => {
            const error = new Error('Network timeout');
            mockWebApiFetch.mockRejectedValue(error);

            await expect(MetadataService.loadEntityMetadata(mockWebApiFetch))
                .rejects.toThrow('Network timeout');
        });

        it('should handle null response from EntityDefinitions', async () => {
            mockWebApiFetch.mockResolvedValue(null);

            await MetadataService.loadEntityMetadata(mockWebApiFetch);

            // Should not throw, should just not set any cache
            expect(MetadataService.isMetadataLoaded()).toBe(false);
        });

        it('should handle response without value property', async () => {
            mockWebApiFetch.mockResolvedValue({ data: [] });

            await MetadataService.loadEntityMetadata(mockWebApiFetch);

            expect(MetadataService.isMetadataLoaded()).toBe(false);
        });
    });

    describe('getAttributeDefinitions - additional scenarios', () => {
        it('should handle null response', async () => {
            mockWebApiFetch.mockResolvedValue(null);

            const result = await MetadataService.getAttributeDefinitions(mockWebApiFetch, 'account');

            expect(result).toEqual([]);
        });

        it('should normalize attribute keys to PascalCase', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { logicalName: 'name', attributeType: 'String' }
                ]
            });

            const result = await MetadataService.getAttributeDefinitions(mockWebApiFetch, 'account');

            expect(result[0].LogicalName).toBe('name');
            expect(result[0].AttributeType).toBe('String');
        });

        it('should cache by entity name', async () => {
            mockWebApiFetch.mockResolvedValue({ value: [{ LogicalName: 'name' }] });

            await MetadataService.getAttributeDefinitions(mockWebApiFetch, 'account');
            await MetadataService.getAttributeDefinitions(mockWebApiFetch, 'contact');

            // Should be called twice - different entities
            expect(mockWebApiFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('getAttributeMap - additional type mappings', () => {
        it('should handle AttributeType fallback when AttributeTypeName is missing', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { LogicalName: 'field1', AttributeType: 'String' }
                ]
            });

            const map = await MetadataService.getAttributeMap(mockWebApiFetch, 'account');

            expect(map.get('field1')).toEqual({ type: 'string' });
        });

        it('should handle integer type', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { LogicalName: 'count', AttributeTypeName: { Value: 'IntegerType' } }
                ]
            });

            const map = await MetadataService.getAttributeMap(mockWebApiFetch, 'account');

            expect(map.get('count')).toEqual({ type: 'number' });
        });

        it('should handle decimal type', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { LogicalName: 'rate', AttributeTypeName: { Value: 'DecimalType' } }
                ]
            });

            const map = await MetadataService.getAttributeMap(mockWebApiFetch, 'account');

            expect(map.get('rate')).toEqual({ type: 'number' });
        });

        it('should handle double type', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { LogicalName: 'latitude', AttributeTypeName: { Value: 'DoubleType' } }
                ]
            });

            const map = await MetadataService.getAttributeMap(mockWebApiFetch, 'account');

            expect(map.get('latitude')).toEqual({ type: 'number' });
        });

        it('should use Target fallback for lookup targets', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { LogicalName: 'ownerid', AttributeTypeName: { Value: 'LookupType' }, Target: 'systemuser' }
                ]
            });

            const map = await MetadataService.getAttributeMap(mockWebApiFetch, 'account');

            expect(map.get('ownerid')).toEqual({ type: 'lookup', targets: 'systemuser' });
        });
    });

    describe('getNavigationPropertyMap - additional scenarios', () => {
        it('should skip entries without ReferencingAttribute', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { ReferencingEntityNavigationPropertyName: 'navprop' }, // Missing ReferencingAttribute
                    { ReferencingAttribute: 'valid', ReferencingEntityNavigationPropertyName: 'validnav' }
                ]
            });

            const map = await MetadataService.getNavigationPropertyMap(mockWebApiFetch, 'account');

            expect(map.size).toBe(1);
            expect(map.get('valid')).toBe('validnav');
        });

        it('should skip entries without ReferencingEntityNavigationPropertyName', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { ReferencingAttribute: 'nonavprop' }, // Missing navigation property
                    { ReferencingAttribute: 'complete', ReferencingEntityNavigationPropertyName: 'completenav' }
                ]
            });

            const map = await MetadataService.getNavigationPropertyMap(mockWebApiFetch, 'account');

            expect(map.size).toBe(1);
            expect(map.get('complete')).toBe('completenav');
        });

        it('should lowercase attribute names in map keys', async () => {
            mockWebApiFetch.mockResolvedValue({
                value: [
                    { ReferencingAttribute: 'ParentAccountId', ReferencingEntityNavigationPropertyName: 'parentaccountid' }
                ]
            });

            const map = await MetadataService.getNavigationPropertyMap(mockWebApiFetch, 'account');

            expect(map.get('parentaccountid')).toBe('parentaccountid');
            expect(map.get('ParentAccountId')).toBeUndefined();
        });

        it('should return empty map on fetch failure', async () => {
            mockWebApiFetch.mockRejectedValue(new Error('Fetch failed'));

            const map = await MetadataService.getNavigationPropertyMap(mockWebApiFetch, 'account');

            // Should return empty map on failure
            expect(map).toBeInstanceOf(Map);
            expect(map.size).toBe(0);
        });
    });

    describe('getBooleanOptions - additional scenarios', () => {
        it('should handle FalseOption with LocalizedLabels fallback', async () => {
            mockWebApiFetch.mockResolvedValue({
                OptionSet: {
                    TrueOption: { Label: { LocalizedLabels: [{ Label: 'Enabled' }] } },
                    FalseOption: { Label: { LocalizedLabels: [{ Label: 'Disabled' }] } }
                }
            });

            const options = await MetadataService.getBooleanOptions(mockWebApiFetch, 'account', 'isactive');

            // LocalizedLabels is not the primary path, so defaults should be used
            expect(options.trueLabel).toBe('True');
            expect(options.falseLabel).toBe('False');
        });

        it('should handle missing TrueOption', async () => {
            mockWebApiFetch.mockResolvedValue({
                OptionSet: {
                    FalseOption: { Label: { UserLocalizedLabel: { Label: 'No' } } }
                }
            });

            const options = await MetadataService.getBooleanOptions(mockWebApiFetch, 'account', 'partial');

            expect(options.trueLabel).toBe('True');
            expect(options.falseLabel).toBe('No');
        });

        it('should handle missing FalseOption', async () => {
            mockWebApiFetch.mockResolvedValue({
                OptionSet: {
                    TrueOption: { Label: { UserLocalizedLabel: { Label: 'Yes' } } }
                }
            });

            const options = await MetadataService.getBooleanOptions(mockWebApiFetch, 'account', 'partial');

            expect(options.trueLabel).toBe('Yes');
            expect(options.falseLabel).toBe('False');
        });

        it('should return default labels on fetch failure', async () => {
            mockWebApiFetch.mockRejectedValue(new Error('Boolean fetch failed'));

            const options = await MetadataService.getBooleanOptions(mockWebApiFetch, 'account', 'failedattr');

            // Should return default labels on failure
            expect(options).toEqual({ trueLabel: 'True', falseLabel: 'False' });
        });

        it('should cache boolean options by entity and attribute', async () => {
            mockWebApiFetch.mockResolvedValue({
                OptionSet: {
                    TrueOption: { Label: { UserLocalizedLabel: { Label: 'Yes' } } },
                    FalseOption: { Label: { UserLocalizedLabel: { Label: 'No' } } }
                }
            });

            await MetadataService.getBooleanOptions(mockWebApiFetch, 'account', 'isactive');
            await MetadataService.getBooleanOptions(mockWebApiFetch, 'account', 'isactive');

            expect(mockWebApiFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('getEntityByAny - error handling', () => {
        it('should catch and ignore errors from getEntityBySetName', async () => {
            // Make first call throw (getEntityBySetName path)
            mockWebApiFetch.mockRejectedValueOnce(new Error('Set name lookup failed'));
            // Then provide definitions for fallback
            mockWebApiFetch.mockResolvedValueOnce({
                value: [
                    { LogicalName: 'account', EntitySetName: 'accounts' }
                ]
            });

            const result = await MetadataService.getEntityByAny(mockWebApiFetch, null, 'account');

            expect(result).toEqual({ LogicalName: 'account', EntitySetName: 'accounts' });
        });
    });
});
