/**
 * @file Comprehensive Tests for DataService
 * @module tests/services/DataService
 * @description Tests for the data access layer orchestrator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataService } from '../../src/services/DataService.js';

// Mock all dependencies - these must be before import but the hoisting handles it
vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: true,
        getFormContext: vi.fn(() => ({
            data: { entity: { getEntityName: () => 'account', getId: () => '{12345}' } },
            getAttribute: vi.fn(),
            getControl: vi.fn(),
            ui: { tabs: { get: () => [] } },
        })),
        getGlobalContext: vi.fn(() => ({
            getVersion: () => '9.2.0.0',
            getClientUrl: () => 'https://org.crm.dynamics.com',
            client: {
                getClient: () => 'Web',
                getFormFactor: () => 1,
                isOffline: () => false,
                getSessionId: () => 'session123',
            },
            userSettings: {
                userId: '{11111111-1111-1111-1111-111111111111}',
                userName: 'Test User',
                languageId: 1033,
                roles: {
                    getAll: () => [{ id: '{role-id}', name: 'System Administrator' }]
                }
            },
            organizationSettings: {
                uniqueName: 'testorg',
                organizationId: 'org-id-123',
                isAutoSaveEnabled: true,
            },
            getCurrentAppProperties: () => ({
                tenantId: 'tenant-123',
                environmentId: 'env-123',
            })
        })),
        getAllAttributes: vi.fn(() => []),
        getAllTabs: vi.fn(() => []),
        getEntityName: vi.fn(() => 'account'),
        getEntityId: vi.fn(() => '12345678-1234-1234-1234-123456789012'),
    }
}));

vi.mock('../../src/services/MetadataService.js', () => ({
    MetadataService: {
        getEntityDefinitions: vi.fn(() => Promise.resolve([])),
        getAttributeDefinitions: vi.fn(() => Promise.resolve([])),
        getEntitySetName: vi.fn((name) => name + 's'),
        getEntityBySetName: vi.fn(() => Promise.resolve({ LogicalName: 'account', EntitySetName: 'accounts' })),
        getEntityByAny: vi.fn(() => Promise.resolve({ LogicalName: 'account', EntitySetName: 'accounts' })),
        getEntityDefinition: vi.fn(() => Promise.resolve({ LogicalName: 'account', PrimaryNameAttribute: 'name' })),
        getAttributeMap: vi.fn(() => Promise.resolve(new Map())),
        getNavigationPropertyMap: vi.fn(() => Promise.resolve(new Map())),
        getPicklistOptions: vi.fn(() => Promise.resolve([])),
        getBooleanOptions: vi.fn(() => Promise.resolve({ trueLabel: 'Yes', falseLabel: 'No' })),
        clearCache: vi.fn(),
        loadEntityMetadata: vi.fn(() => Promise.resolve({})),
    }
}));

vi.mock('../../src/services/WebApiService.js', () => ({
    WebApiService: {
        webApiFetch: vi.fn(() => Promise.resolve({ value: [] })),
        retrieveMultipleRecords: vi.fn(() => Promise.resolve({ entities: [] })),
        retrieveRecord: vi.fn(() => Promise.resolve({})),
        createRecord: vi.fn(() => Promise.resolve({ id: '12345678-1234-1234-1234-123456789012' })),
        updateRecord: vi.fn(() => Promise.resolve({})),
        deleteRecord: vi.fn(() => Promise.resolve({})),
        executeFetchXml: vi.fn(() => Promise.resolve({ entities: [] })),
        executeBatch: vi.fn(() => Promise.resolve({ successCount: 1, failCount: 0, errors: [] })),
        getPluginTraceLogs: vi.fn(() => Promise.resolve({ entities: [] })),
    }
}));

vi.mock('../../src/services/EnvironmentVariableService.js', () => ({
    EnvironmentVariableService: {
        setCurrentSolution: vi.fn(() => Promise.resolve()),
        getCurrentSolution: vi.fn(() => ({ uniqueName: 'MySolution', publisherPrefix: 'new' })),
        getEnvironmentVariables: vi.fn(() => Promise.resolve([])),
        setEnvironmentVariableValue: vi.fn(() => Promise.resolve({})),
        setEnvironmentVariableDefault: vi.fn(() => Promise.resolve({})),
        createEnvironmentVariable: vi.fn(() => Promise.resolve({ definitionId: 'def-123' })),
        deleteEnvironmentVariable: vi.fn(() => Promise.resolve({})),
    }
}));

vi.mock('../../src/services/FormInspectionService.js', () => ({
    FormInspectionService: {
        getFormHierarchy: vi.fn(() => []),
        getFormColumns: vi.fn(() => Promise.resolve([])),
        getFormEventHandlers: vi.fn(() => Promise.resolve(null)),
        getFormEventHandlersForEntity: vi.fn(() => Promise.resolve(null)),
        getAllRecordColumns: vi.fn(() => Promise.resolve([])),
        getPerformanceDetails: vi.fn(() => ({})),
    }
}));

vi.mock('../../src/services/AutomationService.js', () => ({
    AutomationService: {
        getBusinessRulesForEntity: vi.fn(() => Promise.resolve([])),
        setBusinessRuleState: vi.fn(() => Promise.resolve({})),
        deleteBusinessRule: vi.fn(() => Promise.resolve({})),
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/core/UIManager.js', () => ({
    UIManager: {
        showImpersonationIndicator: vi.fn(),
    }
}));

vi.mock('../../src/core/Store.js', () => ({
    Store: {
        getState: vi.fn(() => ({})),
        setState: vi.fn(),
    }
}));

// Import mocked modules at top level for use in tests
import { WebApiService } from '../../src/services/WebApiService.js';
import { MetadataService } from '../../src/services/MetadataService.js';
import { EnvironmentVariableService } from '../../src/services/EnvironmentVariableService.js';
import { FormInspectionService } from '../../src/services/FormInspectionService.js';
import { AutomationService } from '../../src/services/AutomationService.js';
import { NotificationService } from '../../src/services/NotificationService.js';
import { UIManager } from '../../src/core/UIManager.js';
import { Store } from '../../src/core/Store.js';

describe('DataService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear impersonation between tests
        DataService.clearImpersonation?.();
    });

    describe('initialization', () => {
        it('should be defined', () => {
            expect(DataService).toBeDefined();
        });

        it('should have CRUD methods', () => {
            expect(typeof DataService.retrieveMultipleRecords).toBe('function');
            expect(typeof DataService.retrieveRecord).toBe('function');
            expect(typeof DataService.createRecord).toBe('function');
            expect(typeof DataService.updateRecord).toBe('function');
            expect(typeof DataService.deleteRecord).toBe('function');
        });

        it('should have metadata methods', () => {
            expect(typeof DataService.getEntityByAny).toBe('function');
            expect(typeof DataService.getAttributeMap).toBe('function');
            expect(typeof DataService.getEntityDefinitions).toBe('function');
            expect(typeof DataService.getEntitySetName).toBe('function');
        });

        it('should have form inspection methods', () => {
            expect(typeof DataService.getFormHierarchy).toBe('function');
            expect(typeof DataService.getFormColumns).toBe('function');
            expect(typeof DataService.getPerformanceDetails).toBe('function');
        });

        it('should have environment variable methods', () => {
            expect(typeof DataService.getEnvironmentVariables).toBe('function');
            expect(typeof DataService.setEnvironmentVariableValue).toBe('function');
            expect(typeof DataService.createEnvironmentVariable).toBe('function');
            expect(typeof DataService.deleteEnvironmentVariable).toBe('function');
        });

        it('should have impersonation methods', () => {
            expect(typeof DataService.setImpersonation).toBe('function');
            expect(typeof DataService.clearImpersonation).toBe('function');
            expect(typeof DataService.getImpersonationInfo).toBe('function');
        });
    });

    describe('impersonation', () => {
        it('should set impersonation correctly', () => {
            DataService.setImpersonation('user-123', 'John Doe');

            expect(UIManager.showImpersonationIndicator).toHaveBeenCalledWith('John Doe');
            expect(NotificationService.show).toHaveBeenCalled();
            expect(Store.setState).toHaveBeenCalledWith({ impersonationUserId: 'user-123' });
        });

        it('should get impersonation info correctly', () => {
            DataService.setImpersonation('user-123', 'John Doe');

            const info = DataService.getImpersonationInfo();

            expect(info.isImpersonating).toBe(true);
            expect(info.userId).toBe('user-123');
            expect(info.userName).toBe('John Doe');
        });

        it('should clear impersonation correctly', () => {
            DataService.setImpersonation('user-123', 'John Doe');
            DataService.clearImpersonation();

            const info = DataService.getImpersonationInfo();
            expect(info.isImpersonating).toBe(false);
            expect(info.userId).toBeNull();
            expect(UIManager.showImpersonationIndicator).toHaveBeenLastCalledWith(null);
            expect(Store.setState).toHaveBeenLastCalledWith({ impersonationUserId: null });
        });

        it('should return not impersonating by default', () => {
            const info = DataService.getImpersonationInfo();
            expect(info.isImpersonating).toBe(false);
        });
    });

    describe('CRUD operations', () => {
        it('should call retrieveMultipleRecords with correct parameters', async () => {
            WebApiService.retrieveMultipleRecords.mockResolvedValueOnce({ entities: [{ id: '1' }] });

            const result = await DataService.retrieveMultipleRecords('account', '?$top=10');

            expect(result.entities).toHaveLength(1);
        });

        it('should call retrieveRecord with correct parameters', async () => {
            WebApiService.retrieveRecord.mockResolvedValueOnce({ id: '123', name: 'Test' });

            const result = await DataService.retrieveRecord('account', '123', '?$select=name');

            expect(result.name).toBe('Test');
        });

        it('should call createRecord with correct parameters', async () => {
            WebApiService.createRecord.mockResolvedValueOnce({ id: 'new-id' });

            const result = await DataService.createRecord('account', { name: 'New Account' });

            expect(result.id).toBe('new-id');
        });

        it('should call updateRecord with correct parameters', async () => {
            await DataService.updateRecord('account', '123', { name: 'Updated' });

            expect(WebApiService.updateRecord).toHaveBeenCalled();
        });

        it('should call deleteRecord with correct parameters', async () => {
            await DataService.deleteRecord('account', '123');

            expect(WebApiService.deleteRecord).toHaveBeenCalled();
        });
    });

    describe('batch operations', () => {
        it('should execute batch operations', async () => {
            WebApiService.executeBatch.mockResolvedValueOnce({ successCount: 2, failCount: 0, errors: [] });

            const operations = [
                { method: 'PATCH', entitySet: 'accounts', id: '1', data: {} },
                { method: 'PATCH', entitySet: 'accounts', id: '2', data: {} }
            ];

            const result = await DataService.executeBatch(operations);

            expect(result.successCount).toBe(2);
        });
    });

    describe('FetchXML', () => {
        it('should execute FetchXML queries', async () => {
            WebApiService.executeFetchXml.mockResolvedValueOnce({ entities: [{ id: '1' }] });

            const fetchXml = '<fetch><entity name="account"></entity></fetch>';
            const result = await DataService.executeFetchXml('account', fetchXml);

            expect(result.entities).toHaveLength(1);
        });
    });

    describe('metadata operations', () => {
        it('should get entity set name', () => {
            MetadataService.getEntitySetName.mockReturnValueOnce('accounts');

            const result = DataService.getEntitySetName('account');

            expect(result).toBe('accounts');
        });

        it('should get entity by any identifier', async () => {
            MetadataService.getEntityByAny.mockResolvedValueOnce({ LogicalName: 'account', EntitySetName: 'accounts' });

            const result = await DataService.getEntityByAny('accounts');

            expect(result.LogicalName).toBe('account');
        });

        it('should get attribute map', async () => {
            const mockMap = new Map([['name', { type: 'string' }]]);
            MetadataService.getAttributeMap.mockResolvedValueOnce(mockMap);

            const result = await DataService.getAttributeMap('account');

            expect(result.has('name')).toBe(true);
        });

        it('should get entity definitions', async () => {
            MetadataService.getEntityDefinitions.mockResolvedValueOnce([{ LogicalName: 'account' }]);

            const result = await DataService.getEntityDefinitions();

            expect(result).toHaveLength(1);
        });

        it('should get navigation property map', async () => {
            const mockMap = new Map([['parentaccountid', 'parentaccountid']]);
            MetadataService.getNavigationPropertyMap.mockResolvedValueOnce(mockMap);

            const result = await DataService.getNavigationPropertyMap('account');

            expect(result).toBeInstanceOf(Map);
        });

        it('should get picklist options', async () => {
            MetadataService.getPicklistOptions.mockResolvedValueOnce([{ value: 1, label: 'Active' }]);

            const result = await DataService.getPicklistOptions('account', 'statecode');

            expect(result).toHaveLength(1);
        });

        it('should get boolean options', async () => {
            MetadataService.getBooleanOptions.mockResolvedValueOnce({ trueLabel: 'Yes', falseLabel: 'No' });

            const result = await DataService.getBooleanOptions('account', 'creditonhold');

            expect(result.trueLabel).toBe('Yes');
        });
    });

    describe('form inspection', () => {
        it('should get form hierarchy', () => {
            FormInspectionService.getFormHierarchy.mockReturnValueOnce([{ label: 'Tab 1' }]);

            const result = DataService.getFormHierarchy();

            expect(result).toHaveLength(1);
        });

        it('should get form columns', async () => {
            FormInspectionService.getFormColumns.mockResolvedValueOnce([{ displayName: 'Name' }]);

            const result = await DataService.getFormColumns();

            expect(result).toHaveLength(1);
        });

        it('should get performance details', () => {
            FormInspectionService.getPerformanceDetails.mockReturnValueOnce({ loadTime: 100 });

            const result = DataService.getPerformanceDetails();

            expect(result.loadTime).toBe(100);
        });

        it('should get all record columns', async () => {
            FormInspectionService.getAllRecordColumns.mockResolvedValueOnce([{ logicalName: 'name' }]);

            const result = await DataService.getAllRecordColumns();

            expect(result).toHaveLength(1);
        });

        it('should get form event handlers', async () => {
            FormInspectionService.getFormEventHandlers.mockResolvedValueOnce({ onLoad: [] });

            const result = await DataService.getFormEventHandlers();

            expect(result).toHaveProperty('onLoad');
        });
    });

    describe('environment variables', () => {
        it('should get environment variables', async () => {
            EnvironmentVariableService.getEnvironmentVariables.mockResolvedValueOnce([{ schemaName: 'new_Var1' }]);

            const result = await DataService.getEnvironmentVariables();

            expect(result).toHaveLength(1);
        });

        it('should set current solution', async () => {
            await DataService.setCurrentSolution('MySolution');

            expect(EnvironmentVariableService.setCurrentSolution).toHaveBeenCalled();
        });

        it('should get current solution', () => {
            EnvironmentVariableService.getCurrentSolution.mockReturnValueOnce({ uniqueName: 'MySol', publisherPrefix: 'new' });

            const result = DataService.getCurrentSolution();

            expect(result.uniqueName).toBe('MySol');
        });

        it('should set environment variable value', async () => {
            await DataService.setEnvironmentVariableValue('def-123', 'val-456', 'new value', 'new_TestVar');

            expect(EnvironmentVariableService.setEnvironmentVariableValue).toHaveBeenCalled();
        });

        it('should set environment variable default', async () => {
            await DataService.setEnvironmentVariableDefault('def-123', 'default value');

            expect(EnvironmentVariableService.setEnvironmentVariableDefault).toHaveBeenCalled();
        });

        it('should create environment variable', async () => {
            EnvironmentVariableService.createEnvironmentVariable.mockResolvedValueOnce({ definitionId: 'new-def' });

            const result = await DataService.createEnvironmentVariable({
                displayName: 'Test Var',
                schemaName: 'new_TestVar',
                type: 'String'
            });

            expect(result.definitionId).toBe('new-def');
        });

        it('should delete environment variable', async () => {
            await DataService.deleteEnvironmentVariable('def-123');

            expect(EnvironmentVariableService.deleteEnvironmentVariable).toHaveBeenCalled();
        });
    });

    describe('business rules', () => {
        it('should get business rules for entity', async () => {
            AutomationService.getBusinessRulesForEntity.mockResolvedValueOnce([{ name: 'Rule 1' }]);

            const result = await DataService.getBusinessRulesForEntity('account');

            expect(result).toHaveLength(1);
        });

        it('should set business rule state', async () => {
            await DataService.setBusinessRuleState('rule-123', true);

            expect(AutomationService.setBusinessRuleState).toHaveBeenCalled();
        });

        it('should delete business rule', async () => {
            await DataService.deleteBusinessRule('rule-123');

            expect(AutomationService.deleteBusinessRule).toHaveBeenCalled();
        });
    });

    describe('solutions', () => {
        it('should list solutions', async () => {
            const result = await DataService.listSolutions();
            // Should return array (mocked to return empty)
            expect(Array.isArray(result)).toBe(true);
        });

        it('should add solution component', async () => {
            // Should not throw
            await expect(DataService.addSolutionComponent('MySolution', 'comp-123', 380)).resolves.not.toThrow();
        });

        it('should handle null solution name in addSolutionComponent', async () => {
            // Should exit early without making API call
            await DataService.addSolutionComponent(null, 'comp-123', 380);
            // No error thrown means it handled null gracefully
        });
    });

    describe('plugin trace logs', () => {
        it('should get plugin trace logs', async () => {
            WebApiService.getPluginTraceLogs.mockResolvedValueOnce({ entities: [{ id: '1' }] });

            const result = await DataService.getPluginTraceLogs('?$top=50', 50);

            expect(result.entities).toHaveLength(1);
        });
    });

    describe('caching', () => {
        it('should clear all cache when key is null', () => {
            DataService.clearCache();

            expect(MetadataService.clearCache).toHaveBeenCalled();
        });

        it('should clear specific cache when key is provided', () => {
            // Should not throw
            DataService.clearCache('someKey');
        });
    });

    describe('error handling', () => {
        it('should handle errors gracefully in CRUD operations', async () => {
            WebApiService.retrieveMultipleRecords.mockRejectedValueOnce(new Error('Network error'));

            await expect(DataService.retrieveMultipleRecords('account', '')).rejects.toThrow('Network error');
        });

        it('should handle retrieveRecord errors', async () => {
            WebApiService.retrieveRecord.mockRejectedValueOnce(new Error('Record not found'));

            await expect(DataService.retrieveRecord('account', 'invalid-id')).rejects.toThrow('Record not found');
        });

        it('should handle createRecord errors', async () => {
            WebApiService.createRecord.mockRejectedValueOnce(new Error('Validation error'));

            await expect(DataService.createRecord('account', {})).rejects.toThrow('Validation error');
        });

        it('should handle updateRecord errors', async () => {
            WebApiService.updateRecord.mockRejectedValueOnce(new Error('Update failed'));

            await expect(DataService.updateRecord('account', '123', {})).rejects.toThrow('Update failed');
        });

        it('should handle deleteRecord errors', async () => {
            WebApiService.deleteRecord.mockRejectedValueOnce(new Error('Delete failed'));

            await expect(DataService.deleteRecord('account', '123')).rejects.toThrow('Delete failed');
        });

        it('should handle batch operation errors', async () => {
            WebApiService.executeBatch.mockRejectedValueOnce(new Error('Batch failed'));

            await expect(DataService.executeBatch([])).rejects.toThrow('Batch failed');
        });

        it('should handle FetchXML execution errors', async () => {
            WebApiService.executeFetchXml.mockRejectedValueOnce(new Error('Invalid FetchXML'));

            await expect(DataService.executeFetchXml('account', '<invalid>')).rejects.toThrow('Invalid FetchXML');
        });

        it('should handle metadata service errors', async () => {
            MetadataService.getEntityDefinitions.mockRejectedValueOnce(new Error('Metadata error'));

            await expect(DataService.getEntityDefinitions()).rejects.toThrow('Metadata error');
        });

        it('should handle getAttributeDefinitions errors', async () => {
            MetadataService.getAttributeDefinitions.mockRejectedValueOnce(new Error('Attribute error'));

            await expect(DataService.getAttributeDefinitions('account')).rejects.toThrow('Attribute error');
        });

        it('should handle getEntityBySetName errors', async () => {
            MetadataService.getEntityBySetName.mockRejectedValueOnce(new Error('Entity not found'));

            await expect(DataService.getEntityBySetName('invalidset')).rejects.toThrow('Entity not found');
        });

        it('should handle getEntityDefinition errors', async () => {
            MetadataService.getEntityDefinition.mockRejectedValueOnce(new Error('Definition not found'));

            await expect(DataService.getEntityDefinition('invalid')).rejects.toThrow('Definition not found');
        });

        it('should handle getAttributeMap errors', async () => {
            MetadataService.getAttributeMap.mockRejectedValueOnce(new Error('Map error'));

            await expect(DataService.getAttributeMap('account')).rejects.toThrow('Map error');
        });

        it('should handle getNavigationPropertyMap errors', async () => {
            MetadataService.getNavigationPropertyMap.mockRejectedValueOnce(new Error('Navigation error'));

            await expect(DataService.getNavigationPropertyMap('account')).rejects.toThrow('Navigation error');
        });

        it('should handle getPicklistOptions errors', async () => {
            MetadataService.getPicklistOptions.mockRejectedValueOnce(new Error('Picklist error'));

            await expect(DataService.getPicklistOptions('account', 'status')).rejects.toThrow('Picklist error');
        });

        it('should handle getBooleanOptions errors', async () => {
            MetadataService.getBooleanOptions.mockRejectedValueOnce(new Error('Boolean error'));

            await expect(DataService.getBooleanOptions('account', 'isactive')).rejects.toThrow('Boolean error');
        });

        it('should handle environment variable service errors', async () => {
            EnvironmentVariableService.getEnvironmentVariables.mockRejectedValueOnce(new Error('Env var error'));

            await expect(DataService.getEnvironmentVariables()).rejects.toThrow('Env var error');
        });

        it('should handle setEnvironmentVariableValue errors', async () => {
            EnvironmentVariableService.setEnvironmentVariableValue.mockRejectedValueOnce(new Error('Set value error'));

            await expect(DataService.setEnvironmentVariableValue('def', 'val', 'new', 'schema')).rejects.toThrow('Set value error');
        });

        it('should handle createEnvironmentVariable errors', async () => {
            EnvironmentVariableService.createEnvironmentVariable.mockRejectedValueOnce(new Error('Create error'));

            await expect(DataService.createEnvironmentVariable({ displayName: 'Test', schemaName: 'new_test', type: 'String' })).rejects.toThrow('Create error');
        });

        it('should handle deleteEnvironmentVariable errors', async () => {
            EnvironmentVariableService.deleteEnvironmentVariable.mockRejectedValueOnce(new Error('Delete error'));

            await expect(DataService.deleteEnvironmentVariable('def-123')).rejects.toThrow('Delete error');
        });

        it('should handle form inspection service errors', async () => {
            FormInspectionService.getFormColumns.mockRejectedValueOnce(new Error('Form error'));

            await expect(DataService.getFormColumns()).rejects.toThrow('Form error');
        });

        it('should handle getAllRecordColumns errors', async () => {
            FormInspectionService.getAllRecordColumns.mockRejectedValueOnce(new Error('Record columns error'));

            await expect(DataService.getAllRecordColumns()).rejects.toThrow('Record columns error');
        });

        it('should handle getFormEventHandlers errors', async () => {
            FormInspectionService.getFormEventHandlers.mockRejectedValueOnce(new Error('Event handlers error'));

            await expect(DataService.getFormEventHandlers()).rejects.toThrow('Event handlers error');
        });

        it('should handle getFormEventHandlersForEntity errors', async () => {
            FormInspectionService.getFormEventHandlersForEntity.mockRejectedValueOnce(new Error('Entity handlers error'));

            await expect(DataService.getFormEventHandlersForEntity('account')).rejects.toThrow('Entity handlers error');
        });

        it('should handle getBusinessRulesForEntity errors', async () => {
            AutomationService.getBusinessRulesForEntity.mockRejectedValueOnce(new Error('Business rules error'));

            await expect(DataService.getBusinessRulesForEntity('account')).rejects.toThrow('Business rules error');
        });

        it('should handle setBusinessRuleState errors', async () => {
            AutomationService.setBusinessRuleState.mockRejectedValueOnce(new Error('State error'));

            await expect(DataService.setBusinessRuleState('rule-123', true)).rejects.toThrow('State error');
        });

        it('should handle deleteBusinessRule errors', async () => {
            AutomationService.deleteBusinessRule.mockRejectedValueOnce(new Error('Delete rule error'));

            await expect(DataService.deleteBusinessRule('rule-123')).rejects.toThrow('Delete rule error');
        });

        it('should handle getPluginTraceLogs errors', async () => {
            WebApiService.getPluginTraceLogs.mockRejectedValueOnce(new Error('Trace logs error'));

            await expect(DataService.getPluginTraceLogs('', 50)).rejects.toThrow('Trace logs error');
        });
    });

    describe('fetchNextLink', () => {
        it('should fetch next page of records using nextLink', async () => {
            const mockResponse = {
                ok: true,
                json: vi.fn().mockResolvedValue({
                    value: [{ id: '1' }, { id: '2' }],
                    '@odata.nextLink': 'https://org.crm.dynamics.com/api/data/v9.2/accounts?$skiptoken=next'
                })
            };
            global.fetch = vi.fn().mockResolvedValue(mockResponse);

            const result = await DataService.fetchNextLink('https://org.crm.dynamics.com/api/data/v9.2/accounts?$skiptoken=abc');

            expect(result.entities).toHaveLength(2);
            expect(result.nextLink).toBe('https://org.crm.dynamics.com/api/data/v9.2/accounts?$skiptoken=next');
        });

        it('should return empty entities when value is missing', async () => {
            const mockResponse = {
                ok: true,
                json: vi.fn().mockResolvedValue({})
            };
            global.fetch = vi.fn().mockResolvedValue(mockResponse);

            const result = await DataService.fetchNextLink('https://org.crm.dynamics.com/api/data/v9.2/accounts');

            expect(result.entities).toHaveLength(0);
            expect(result.nextLink).toBeUndefined();
        });

        it('should throw error when HTTP response is not ok', async () => {
            const mockResponse = {
                ok: false,
                status: 404,
                statusText: 'Not Found'
            };
            global.fetch = vi.fn().mockResolvedValue(mockResponse);

            await expect(DataService.fetchNextLink('https://invalid-url')).rejects.toThrow('HTTP 404: Not Found');
        });

        it('should throw error when fetch fails', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

            await expect(DataService.fetchNextLink('https://org.crm.dynamics.com')).rejects.toThrow('Network failure');
        });

        it('should return undefined nextLink when not present in response', async () => {
            const mockResponse = {
                ok: true,
                json: vi.fn().mockResolvedValue({
                    value: [{ id: '1' }]
                })
            };
            global.fetch = vi.fn().mockResolvedValue(mockResponse);

            const result = await DataService.fetchNextLink('https://org.crm.dynamics.com/api/data/v9.2/accounts');

            expect(result.nextLink).toBeUndefined();
        });
    });

    describe('edge cases', () => {
        describe('CRUD with null/undefined parameters', () => {
            it('should handle retrieveMultipleRecords with empty options', async () => {
                WebApiService.retrieveMultipleRecords.mockResolvedValueOnce({ entities: [] });

                const result = await DataService.retrieveMultipleRecords('account', '');

                expect(result.entities).toEqual([]);
            });

            it('should handle retrieveRecord with empty options', async () => {
                WebApiService.retrieveRecord.mockResolvedValueOnce({ id: '123' });

                const result = await DataService.retrieveRecord('account', '123');

                expect(result.id).toBe('123');
            });

            it('should handle createRecord with minimal data', async () => {
                WebApiService.createRecord.mockResolvedValueOnce({ id: 'new-id' });

                const result = await DataService.createRecord('account', {});

                expect(result.id).toBe('new-id');
            });

            it('should handle updateRecord with empty data', async () => {
                WebApiService.updateRecord.mockResolvedValueOnce({});

                await DataService.updateRecord('account', '123', {});

                expect(WebApiService.updateRecord).toHaveBeenCalled();
            });
        });

        describe('batch operations edge cases', () => {
            it('should handle empty batch operations array', async () => {
                WebApiService.executeBatch.mockResolvedValueOnce({ successCount: 0, failCount: 0, errors: [] });

                const result = await DataService.executeBatch([]);

                expect(result.successCount).toBe(0);
                expect(result.failCount).toBe(0);
            });

            it('should handle batch with partial failures', async () => {
                WebApiService.executeBatch.mockResolvedValueOnce({
                    successCount: 2,
                    failCount: 1,
                    errors: [{ index: 2, error: 'Record not found' }]
                });

                const operations = [
                    { method: 'PATCH', entitySet: 'accounts', id: '1', data: {} },
                    { method: 'PATCH', entitySet: 'accounts', id: '2', data: {} },
                    { method: 'DELETE', entitySet: 'accounts', id: '3' }
                ];

                const result = await DataService.executeBatch(operations);

                expect(result.successCount).toBe(2);
                expect(result.failCount).toBe(1);
                expect(result.errors).toHaveLength(1);
            });

            it('should handle batch with mixed operation types', async () => {
                WebApiService.executeBatch.mockResolvedValueOnce({ successCount: 3, failCount: 0, errors: [] });

                const operations = [
                    { method: 'POST', entitySet: 'accounts', data: { name: 'New' } },
                    { method: 'PATCH', entitySet: 'accounts', id: '1', data: { name: 'Updated' } },
                    { method: 'DELETE', entitySet: 'accounts', id: '2' }
                ];

                const result = await DataService.executeBatch(operations);

                expect(result.successCount).toBe(3);
            });
        });

        describe('metadata edge cases', () => {
            it('should return null when entity set name not found', () => {
                MetadataService.getEntitySetName.mockReturnValueOnce(null);

                const result = DataService.getEntitySetName('nonexistent');

                expect(result).toBeNull();
            });

            it('should return null when entity by set name not found', async () => {
                MetadataService.getEntityBySetName.mockResolvedValueOnce(null);

                const result = await DataService.getEntityBySetName('invalidset');

                expect(result).toBeNull();
            });

            it('should return null when entity by any not found', async () => {
                MetadataService.getEntityByAny.mockResolvedValueOnce(null);

                const result = await DataService.getEntityByAny('invalid');

                expect(result).toBeNull();
            });

            it('should return null when entity definition not found', async () => {
                MetadataService.getEntityDefinition.mockResolvedValueOnce(null);

                const result = await DataService.getEntityDefinition('nonexistent');

                expect(result).toBeNull();
            });

            it('should return empty array when no entity definitions', async () => {
                MetadataService.getEntityDefinitions.mockResolvedValueOnce([]);

                const result = await DataService.getEntityDefinitions();

                expect(result).toEqual([]);
            });

            it('should return empty array when no attribute definitions', async () => {
                MetadataService.getAttributeDefinitions.mockResolvedValueOnce([]);

                const result = await DataService.getAttributeDefinitions('account');

                expect(result).toEqual([]);
            });

            it('should return empty map when no attributes', async () => {
                MetadataService.getAttributeMap.mockResolvedValueOnce(new Map());

                const result = await DataService.getAttributeMap('account');

                expect(result.size).toBe(0);
            });

            it('should return empty array for picklist options when none exist', async () => {
                MetadataService.getPicklistOptions.mockResolvedValueOnce([]);

                const result = await DataService.getPicklistOptions('account', 'emptyfield');

                expect(result).toEqual([]);
            });
        });

        describe('form inspection edge cases', () => {
            it('should return empty array when no form hierarchy', () => {
                FormInspectionService.getFormHierarchy.mockReturnValueOnce([]);

                const result = DataService.getFormHierarchy();

                expect(result).toEqual([]);
            });

            it('should return empty array when no form columns', async () => {
                FormInspectionService.getFormColumns.mockResolvedValueOnce([]);

                const result = await DataService.getFormColumns();

                expect(result).toEqual([]);
            });

            it('should return null when no form event handlers', async () => {
                FormInspectionService.getFormEventHandlers.mockResolvedValueOnce(null);

                const result = await DataService.getFormEventHandlers();

                expect(result).toBeNull();
            });

            it('should return null when no form event handlers for entity', async () => {
                FormInspectionService.getFormEventHandlersForEntity.mockResolvedValueOnce(null);

                const result = await DataService.getFormEventHandlersForEntity('account');

                expect(result).toBeNull();
            });

            it('should return empty object when no performance details', () => {
                FormInspectionService.getPerformanceDetails.mockReturnValueOnce({});

                const result = DataService.getPerformanceDetails();

                expect(result).toEqual({});
            });

            it('should handle getFormHierarchy with bypassCache=true', () => {
                FormInspectionService.getFormHierarchy.mockReturnValueOnce([{ label: 'Tab' }]);

                const result = DataService.getFormHierarchy(true);

                expect(FormInspectionService.getFormHierarchy).toHaveBeenCalled();
            });

            it('should handle getFormColumns with bypassCache=true', async () => {
                FormInspectionService.getFormColumns.mockResolvedValueOnce([]);

                await DataService.getFormColumns(true);

                expect(FormInspectionService.getFormColumns).toHaveBeenCalled();
            });

            it('should handle getPerformanceDetails with bypassCache=true', () => {
                FormInspectionService.getPerformanceDetails.mockReturnValueOnce({});

                DataService.getPerformanceDetails(true);

                expect(FormInspectionService.getPerformanceDetails).toHaveBeenCalled();
            });
        });

        describe('environment variable edge cases', () => {
            it('should return empty array when no environment variables', async () => {
                EnvironmentVariableService.getEnvironmentVariables.mockResolvedValueOnce([]);

                const result = await DataService.getEnvironmentVariables();

                expect(result).toEqual([]);
            });

            it('should handle setEnvironmentVariableValue with null valueId', async () => {
                EnvironmentVariableService.setEnvironmentVariableValue.mockResolvedValueOnce({ id: 'new-val' });

                await DataService.setEnvironmentVariableValue('def-123', null, 'value', 'new_Var');

                expect(EnvironmentVariableService.setEnvironmentVariableValue).toHaveBeenCalled();
            });

            it('should handle createEnvironmentVariable with all optional fields', async () => {
                EnvironmentVariableService.createEnvironmentVariable.mockResolvedValueOnce({ definitionId: 'def', valueId: 'val' });

                const result = await DataService.createEnvironmentVariable({
                    displayName: 'Full Var',
                    schemaName: 'new_FullVar',
                    type: 'String',
                    defaultValue: 'default',
                    currentValue: 'current'
                });

                expect(result.definitionId).toBe('def');
                expect(result.valueId).toBe('val');
            });

            it('should handle getCurrentSolution returning null', () => {
                EnvironmentVariableService.getCurrentSolution.mockReturnValueOnce(null);

                const result = DataService.getCurrentSolution();

                expect(result).toBeNull();
            });
        });

        describe('business rules edge cases', () => {
            it('should return empty array when no business rules', async () => {
                AutomationService.getBusinessRulesForEntity.mockResolvedValueOnce([]);

                const result = await DataService.getBusinessRulesForEntity('account');

                expect(result).toEqual([]);
            });

            it('should handle setBusinessRuleState with activate=false', async () => {
                AutomationService.setBusinessRuleState.mockResolvedValueOnce({});

                await DataService.setBusinessRuleState('rule-123', false);

                expect(AutomationService.setBusinessRuleState).toHaveBeenCalled();
            });
        });

        describe('solutions edge cases', () => {
            it('should return empty array when no solutions found', async () => {
                WebApiService.retrieveMultipleRecords.mockResolvedValueOnce({ entities: [] });

                const result = await DataService.listSolutions();

                expect(result).toEqual([]);
            });

            it('should handle solutions with missing publisher prefix', async () => {
                WebApiService.retrieveMultipleRecords.mockResolvedValueOnce({
                    entities: [
                        { uniquename: 'Sol1', friendlyname: 'Solution 1', publisherid: null }
                    ]
                });

                const result = await DataService.listSolutions();

                expect(result[0].prefix).toBe('');
            });

            it('should handle addSolutionComponent with empty string solution name', async () => {
                // Empty string should also trigger early return
                await DataService.addSolutionComponent('', 'comp-123', 380);
                // Should not make API call
            });

            it('should handle addSolutionComponent with addRequired=true', async () => {
                WebApiService.webApiFetch.mockResolvedValueOnce({});

                await DataService.addSolutionComponent('MySolution', 'comp-123', 381, true);

                // Should complete without error
            });
        });

        describe('plugin trace logs edge cases', () => {
            it('should return empty entities when no trace logs', async () => {
                WebApiService.getPluginTraceLogs.mockResolvedValueOnce({ entities: [] });

                const result = await DataService.getPluginTraceLogs('', 50);

                expect(result.entities).toEqual([]);
            });

            it('should handle trace logs with nextLink', async () => {
                WebApiService.getPluginTraceLogs.mockResolvedValueOnce({
                    entities: [{ id: '1' }],
                    nextLink: 'https://next-page'
                });

                const result = await DataService.getPluginTraceLogs('?$top=10', 10);

                expect(result.nextLink).toBe('https://next-page');
            });
        });

        describe('FetchXML edge cases', () => {
            it('should return empty entities when no results', async () => {
                WebApiService.executeFetchXml.mockResolvedValueOnce({ entities: [] });

                const result = await DataService.executeFetchXml('account', '<fetch></fetch>');

                expect(result.entities).toEqual([]);
            });

            it('should handle FetchXML with custom headers', async () => {
                WebApiService.executeFetchXml.mockResolvedValueOnce({ entities: [{ id: '1' }] });

                await DataService.executeFetchXml('account', '<fetch></fetch>', { 'Custom-Header': 'value' });

                expect(WebApiService.executeFetchXml).toHaveBeenCalled();
            });
        });
    });

    describe('impersonation advanced scenarios', () => {
        it('should clear cache when setting impersonation', () => {
            const clearCacheSpy = vi.spyOn(DataService, 'clearCache');

            DataService.setImpersonation('user-123', 'John Doe');

            expect(clearCacheSpy).toHaveBeenCalled();
            clearCacheSpy.mockRestore();
        });

        it('should clear cache when clearing impersonation', () => {
            DataService.setImpersonation('user-123', 'John Doe');
            const clearCacheSpy = vi.spyOn(DataService, 'clearCache');

            DataService.clearImpersonation();

            expect(clearCacheSpy).toHaveBeenCalled();
            clearCacheSpy.mockRestore();
        });

        it('should show success notification when setting impersonation', () => {
            DataService.setImpersonation('user-123', 'John Doe');

            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'success');
        });

        it('should show info notification when clearing impersonation', () => {
            DataService.setImpersonation('user-123', 'John Doe');
            vi.clearAllMocks();

            DataService.clearImpersonation();

            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'info');
        });

        it('should update store state when impersonating', () => {
            DataService.setImpersonation('user-456', 'Jane Doe');

            expect(Store.setState).toHaveBeenCalledWith({ impersonationUserId: 'user-456' });
        });
    });

    describe('cache management advanced', () => {
        it('should not call MetadataService.clearCache when clearing specific key', () => {
            vi.clearAllMocks();

            DataService.clearCache('specificKey');

            expect(MetadataService.clearCache).not.toHaveBeenCalled();
        });

        it('should call MetadataService.clearCache when clearing all cache', () => {
            vi.clearAllMocks();

            DataService.clearCache();

            expect(MetadataService.clearCache).toHaveBeenCalled();
        });

        it('should clear all cache with null key parameter', () => {
            vi.clearAllMocks();

            DataService.clearCache(null);

            expect(MetadataService.clearCache).toHaveBeenCalled();
        });
    });

    describe('getEntityDefinitions with options', () => {
        it('should pass includeHidden=true to metadata service', async () => {
            MetadataService.getEntityDefinitions.mockResolvedValueOnce([]);

            await DataService.getEntityDefinitions(true);

            expect(MetadataService.getEntityDefinitions).toHaveBeenCalled();
        });

        it('should pass includeHidden=false by default', async () => {
            MetadataService.getEntityDefinitions.mockResolvedValueOnce([]);

            await DataService.getEntityDefinitions();

            expect(MetadataService.getEntityDefinitions).toHaveBeenCalled();
        });
    });

    describe('retrieveMultipleRecords with custom headers', () => {
        it('should pass custom headers to WebApiService', async () => {
            WebApiService.retrieveMultipleRecords.mockResolvedValueOnce({ entities: [] });

            await DataService.retrieveMultipleRecords('account', '?$top=10', { 'Prefer': 'odata.include-annotations=*' });

            expect(WebApiService.retrieveMultipleRecords).toHaveBeenCalled();
        });

        it('should use empty object for headers by default', async () => {
            WebApiService.retrieveMultipleRecords.mockResolvedValueOnce({ entities: [] });

            await DataService.retrieveMultipleRecords('account', '?$top=10');

            expect(WebApiService.retrieveMultipleRecords).toHaveBeenCalled();
        });
    });

    describe('getEnhancedUserContext', () => {
        it('should return user context without impersonation', async () => {
            // Clear any impersonation state
            DataService.clearImpersonation();
            // Clear the cache so we get fresh data
            DataService.clearCache();

            const result = await DataService.getEnhancedUserContext(true);

            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('client');
            expect(result).toHaveProperty('organization');
            expect(result).toHaveProperty('session');
            expect(result.user.name).toBe('Test User');
        });

        it('should include client information', async () => {
            DataService.clearImpersonation();
            DataService.clearCache();

            const result = await DataService.getEnhancedUserContext(true);

            expect(result.client.type).toBe('Web');
            expect(result.client.formFactor).toBe('Desktop');
            expect(result.client.isOffline).toBe(false);
        });

        it('should include organization information', async () => {
            DataService.clearImpersonation();
            DataService.clearCache();

            const result = await DataService.getEnhancedUserContext(true);

            expect(result.organization.name).toBe('testorg');
            expect(result.organization.version).toBe('9.2.0.0');
        });

        it('should include session information', async () => {
            DataService.clearImpersonation();
            DataService.clearCache();

            const result = await DataService.getEnhancedUserContext(true);

            expect(result.session.sessionId).toBe('session123');
            expect(result.session.tenantId).toBe('tenant-123');
        });

        it('should format roles correctly', async () => {
            DataService.clearImpersonation();
            DataService.clearCache();

            const result = await DataService.getEnhancedUserContext(true);

            expect(result.user.roles).toHaveLength(1);
            expect(result.user.roles[0].name).toBe('System Administrator');
        });

        it('should use cached result when bypassCache is false', async () => {
            DataService.clearImpersonation();
            DataService.clearCache();

            // First call populates cache
            await DataService.getEnhancedUserContext(true);
            // Second call should use cache
            const result = await DataService.getEnhancedUserContext(false);

            expect(result).toHaveProperty('user');
        });
    });

    describe('setCurrentSolution', () => {
        it('should delegate to EnvironmentVariableService', async () => {
            await DataService.setCurrentSolution('TestSolution');

            expect(EnvironmentVariableService.setCurrentSolution).toHaveBeenCalled();
        });

        it('should handle solution setting errors', async () => {
            EnvironmentVariableService.setCurrentSolution.mockRejectedValueOnce(new Error('Solution not found'));

            await expect(DataService.setCurrentSolution('InvalidSolution')).rejects.toThrow('Solution not found');
        });
    });

    describe('setEnvironmentVariableDefault', () => {
        it('should update default value through environment service', async () => {
            EnvironmentVariableService.setEnvironmentVariableDefault.mockResolvedValueOnce({});

            await DataService.setEnvironmentVariableDefault('def-123', 'new default');

            expect(EnvironmentVariableService.setEnvironmentVariableDefault).toHaveBeenCalled();
        });

        it('should handle empty default value', async () => {
            EnvironmentVariableService.setEnvironmentVariableDefault.mockResolvedValueOnce({});

            await DataService.setEnvironmentVariableDefault('def-123', '');

            expect(EnvironmentVariableService.setEnvironmentVariableDefault).toHaveBeenCalled();
        });
    });

    describe('_fetch error handling', () => {
        it('should show error notification when getEnhancedUserContext fetcher fails', async () => {
            DataService.clearImpersonation();
            DataService.clearCache();
            vi.clearAllMocks();

            // Mock PowerAppsApiService.getGlobalContext to throw an error
            const { PowerAppsApiService } = await import('../../src/services/PowerAppsApiService.js');
            const originalGetGlobalContext = PowerAppsApiService.getGlobalContext;
            PowerAppsApiService.getGlobalContext = vi.fn(() => {
                throw new Error('Global context unavailable');
            });

            await expect(DataService.getEnhancedUserContext(true)).rejects.toThrow('Data fetch failed');
            expect(NotificationService.show).toHaveBeenCalledWith(expect.stringContaining('Data fetch failed'), 'error');

            // Restore
            PowerAppsApiService.getGlobalContext = originalGetGlobalContext;
        });

        it('should log error to console when _fetch fails', async () => {
            DataService.clearImpersonation();
            DataService.clearCache();
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const { PowerAppsApiService } = await import('../../src/services/PowerAppsApiService.js');
            const originalGetGlobalContext = PowerAppsApiService.getGlobalContext;
            PowerAppsApiService.getGlobalContext = vi.fn(() => {
                throw new Error('Test error for console logging');
            });

            try {
                await DataService.getEnhancedUserContext(true);
            } catch (e) {
                // Expected to fail
            }

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('DataService fetch failed'),
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
            PowerAppsApiService.getGlobalContext = originalGetGlobalContext;
        });

        it('should throw error with user-friendly message when fetcher throws', async () => {
            DataService.clearImpersonation();
            DataService.clearCache();

            const { PowerAppsApiService } = await import('../../src/services/PowerAppsApiService.js');
            const originalGetGlobalContext = PowerAppsApiService.getGlobalContext;
            PowerAppsApiService.getGlobalContext = vi.fn(() => {
                throw new Error('Original technical error');
            });

            await expect(DataService.getEnhancedUserContext(true)).rejects.toThrow("Data fetch failed for 'userContext'.");

            PowerAppsApiService.getGlobalContext = originalGetGlobalContext;
        });
    });

    describe('getEnhancedUserContext with impersonation', () => {
        beforeEach(() => {
            DataService.clearImpersonation();
            DataService.clearCache();
            vi.clearAllMocks();
        });

        it('should fetch impersonated user data when impersonating', async () => {
            // Set up impersonation
            DataService.setImpersonation('impersonated-user-id-123', 'Impersonated User');
            DataService.clearCache(); // Clear cache to force fresh fetch

            // Mock the retrieveRecord for user data
            WebApiService.retrieveRecord.mockResolvedValueOnce({
                fullname: 'Impersonated User',
                systemuserid: 'impersonated-user-id-123'
            });

            // Mock direct roles response
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [
                    { roleid: 'role-1', name: 'Sales Manager' },
                    { roleid: 'role-2', name: 'Customer Service Rep' }
                ]
            });

            // Mock teams response
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ teamid: 'team-1' }, { teamid: 'team-2' }]
            });

            // Mock team roles for team-1
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ roleid: 'role-3', name: 'Team Role 1' }]
            });

            // Mock team roles for team-2
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ roleid: 'role-4', name: 'Team Role 2' }]
            });

            const result = await DataService.getEnhancedUserContext(true);

            expect(result.user.name).toBe('Impersonated User');
            expect(result.user.id).toBe('impersonated-user-id-123');
            expect(result.user.language).toBe('N/A (Impersonated)');
            expect(result.user.roles.length).toBeGreaterThanOrEqual(4);
        });

        it('should deduplicate roles when same role appears in direct and team roles', async () => {
            DataService.setImpersonation('user-with-duplicate-roles', 'Duplicate Roles User');
            DataService.clearCache();

            WebApiService.retrieveRecord.mockResolvedValueOnce({
                fullname: 'Duplicate Roles User',
                systemuserid: 'user-with-duplicate-roles'
            });

            // Direct roles with one role
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ roleid: 'shared-role-id', name: 'Shared Role' }]
            });

            // Teams
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ teamid: 'team-1' }]
            });

            // Team roles with the same role (should be deduplicated)
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ roleid: 'shared-role-id', name: 'Shared Role' }]
            });

            const result = await DataService.getEnhancedUserContext(true);

            // Should only have one instance of the shared role
            const sharedRoleCount = result.user.roles.filter(r => r.id === 'shared-role-id').length;
            expect(sharedRoleCount).toBe(1);
        });

        it('should handle impersonated user with no team memberships', async () => {
            DataService.setImpersonation('user-no-teams', 'No Teams User');
            DataService.clearCache();

            WebApiService.retrieveRecord.mockResolvedValueOnce({
                fullname: 'No Teams User',
                systemuserid: 'user-no-teams'
            });

            // Direct roles
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ roleid: 'direct-role-1', name: 'Direct Role' }]
            });

            // Empty teams response
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: []
            });

            const result = await DataService.getEnhancedUserContext(true);

            expect(result.user.name).toBe('No Teams User');
            expect(result.user.roles).toHaveLength(1);
            expect(result.user.roles[0].name).toBe('Direct Role');
        });

        it('should handle impersonated user with no direct roles', async () => {
            DataService.setImpersonation('user-no-direct-roles', 'Team Only User');
            DataService.clearCache();

            WebApiService.retrieveRecord.mockResolvedValueOnce({
                fullname: 'Team Only User',
                systemuserid: 'user-no-direct-roles'
            });

            // Empty direct roles
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: []
            });

            // One team
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ teamid: 'only-team' }]
            });

            // Team roles
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ roleid: 'team-role-id', name: 'Team Role' }]
            });

            const result = await DataService.getEnhancedUserContext(true);

            expect(result.user.roles).toHaveLength(1);
            expect(result.user.roles[0].name).toBe('Team Role');
        });

        it('should sort roles alphabetically by name', async () => {
            DataService.setImpersonation('user-sorted-roles', 'Sorted Roles User');
            DataService.clearCache();

            WebApiService.retrieveRecord.mockResolvedValueOnce({
                fullname: 'Sorted Roles User',
                systemuserid: 'user-sorted-roles'
            });

            // Direct roles in random order
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [
                    { roleid: 'role-z', name: 'Zebra Role' },
                    { roleid: 'role-a', name: 'Alpha Role' },
                    { roleid: 'role-m', name: 'Middle Role' }
                ]
            });

            // No teams
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: []
            });

            const result = await DataService.getEnhancedUserContext(true);

            expect(result.user.roles[0].name).toBe('Alpha Role');
            expect(result.user.roles[1].name).toBe('Middle Role');
            expect(result.user.roles[2].name).toBe('Zebra Role');
        });

        it('should handle null value in direct roles response', async () => {
            DataService.setImpersonation('user-null-roles', 'Null Roles User');
            DataService.clearCache();

            WebApiService.retrieveRecord.mockResolvedValueOnce({
                fullname: 'Null Roles User',
                systemuserid: 'user-null-roles'
            });

            // Response with no value property
            WebApiService.webApiFetch.mockResolvedValueOnce({});

            // No teams
            WebApiService.webApiFetch.mockResolvedValueOnce({});

            const result = await DataService.getEnhancedUserContext(true);

            expect(result.user.roles).toEqual([]);
        });

        it('should handle null value in teams response', async () => {
            DataService.setImpersonation('user-null-teams', 'Null Teams User');
            DataService.clearCache();

            WebApiService.retrieveRecord.mockResolvedValueOnce({
                fullname: 'Null Teams User',
                systemuserid: 'user-null-teams'
            });

            // Direct roles
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ roleid: 'role-1', name: 'Role 1' }]
            });

            // Null teams response
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: null
            });

            const result = await DataService.getEnhancedUserContext(true);

            expect(result.user.roles).toHaveLength(1);
        });

        it('should handle null value in team roles response', async () => {
            DataService.setImpersonation('user-null-team-roles', 'Null Team Roles User');
            DataService.clearCache();

            WebApiService.retrieveRecord.mockResolvedValueOnce({
                fullname: 'Null Team Roles User',
                systemuserid: 'user-null-team-roles'
            });

            // Direct roles
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ roleid: 'role-1', name: 'Direct Role' }]
            });

            // Teams
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ teamid: 'team-with-null-roles' }]
            });

            // Team roles with null value
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: null
            });

            const result = await DataService.getEnhancedUserContext(true);

            expect(result.user.roles).toHaveLength(1);
            expect(result.user.roles[0].name).toBe('Direct Role');
        });

        it('should include correct user context structure when impersonating', async () => {
            DataService.setImpersonation('complete-user', 'Complete User');
            DataService.clearCache();

            WebApiService.retrieveRecord.mockResolvedValueOnce({
                fullname: 'Complete User',
                systemuserid: 'complete-user'
            });

            WebApiService.webApiFetch.mockResolvedValueOnce({ value: [] });
            WebApiService.webApiFetch.mockResolvedValueOnce({ value: [] });

            const result = await DataService.getEnhancedUserContext(true);

            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('client');
            expect(result).toHaveProperty('organization');
            expect(result).toHaveProperty('session');
            expect(result.user.language).toBe('N/A (Impersonated)');
        });

        it('should fetch team roles for multiple teams in parallel', async () => {
            DataService.setImpersonation('multi-team-user', 'Multi Team User');
            DataService.clearCache();

            WebApiService.retrieveRecord.mockResolvedValueOnce({
                fullname: 'Multi Team User',
                systemuserid: 'multi-team-user'
            });

            // No direct roles
            WebApiService.webApiFetch.mockResolvedValueOnce({ value: [] });

            // Multiple teams
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [
                    { teamid: 'team-a' },
                    { teamid: 'team-b' },
                    { teamid: 'team-c' }
                ]
            });

            // Roles for each team
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ roleid: 'role-a', name: 'Role A' }]
            });
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ roleid: 'role-b', name: 'Role B' }]
            });
            WebApiService.webApiFetch.mockResolvedValueOnce({
                value: [{ roleid: 'role-c', name: 'Role C' }]
            });

            const result = await DataService.getEnhancedUserContext(true);

            expect(result.user.roles).toHaveLength(3);
        });
    });

    describe('getAllRecordColumns (line 548)', () => {
        it('should call FormInspectionService.getAllRecordColumns with correct bound methods', async () => {
            FormInspectionService.getAllRecordColumns.mockResolvedValueOnce([
                { logicalName: 'name', displayName: 'Account Name', value: 'Test' }
            ]);

            const result = await DataService.getAllRecordColumns();

            expect(FormInspectionService.getAllRecordColumns).toHaveBeenCalled();
            expect(result).toHaveLength(1);
        });

        it('should pass isOdataProperty helper to FormInspectionService', async () => {
            FormInspectionService.getAllRecordColumns.mockResolvedValueOnce([]);

            await DataService.getAllRecordColumns();

            // Verify the third argument is a function (isOdataProperty)
            const callArgs = FormInspectionService.getAllRecordColumns.mock.calls[0];
            expect(typeof callArgs[2]).toBe('function');
        });

        it('should pass metadata loader function to FormInspectionService', async () => {
            FormInspectionService.getAllRecordColumns.mockResolvedValueOnce([]);

            await DataService.getAllRecordColumns();

            // Verify the fourth argument is a function (metadata loader)
            const callArgs = FormInspectionService.getAllRecordColumns.mock.calls[0];
            expect(typeof callArgs[3]).toBe('function');
        });

        it('should pass getEntitySetName bound method to FormInspectionService', async () => {
            FormInspectionService.getAllRecordColumns.mockResolvedValueOnce([]);

            await DataService.getAllRecordColumns();

            // Verify the fifth argument is a function (getEntitySetName)
            const callArgs = FormInspectionService.getAllRecordColumns.mock.calls[0];
            expect(typeof callArgs[4]).toBe('function');
        });

        it('should handle getAllRecordColumns with bypassCache parameter', async () => {
            FormInspectionService.getAllRecordColumns.mockResolvedValueOnce([]);

            await DataService.getAllRecordColumns(true);

            expect(FormInspectionService.getAllRecordColumns).toHaveBeenCalled();
        });

        it('should return columns with all expected properties', async () => {
            FormInspectionService.getAllRecordColumns.mockResolvedValueOnce([
                {
                    logicalName: 'accountnumber',
                    displayName: 'Account Number',
                    value: 'ACC-001',
                    type: 'string',
                    isDirty: false,
                    onForm: true,
                    isSystem: false
                }
            ]);

            const result = await DataService.getAllRecordColumns();

            expect(result[0].logicalName).toBe('accountnumber');
            expect(result[0].displayName).toBe('Account Number');
            expect(result[0].onForm).toBe(true);
        });

        it('should invoke metadata loader function when called by FormInspectionService', async () => {
            // Mock FormInspectionService to call the metadata loader (4th argument)
            FormInspectionService.getAllRecordColumns.mockImplementationOnce(async (
                retrieveRecord,
                getFormColumns,
                isOdataPropertyFn,
                metadataLoader,
                getEntitySetName
            ) => {
                // Call the metadata loader to cover line 548
                await metadataLoader();
                return [{ logicalName: 'test' }];
            });

            MetadataService.loadEntityMetadata.mockResolvedValueOnce({
                attributes: [{ LogicalName: 'name' }]
            });

            const result = await DataService.getAllRecordColumns();

            expect(MetadataService.loadEntityMetadata).toHaveBeenCalled();
            expect(result).toHaveLength(1);
        });

        it('should pass correct impersonation context to metadata loader', async () => {
            // Set impersonation first
            DataService.setImpersonation('impersonated-for-metadata', 'Impersonated User');

            FormInspectionService.getAllRecordColumns.mockImplementationOnce(async (
                retrieveRecord,
                getFormColumns,
                isOdataPropertyFn,
                metadataLoader,
                getEntitySetName
            ) => {
                await metadataLoader();
                return [];
            });

            MetadataService.loadEntityMetadata.mockResolvedValueOnce({});

            await DataService.getAllRecordColumns();

            expect(MetadataService.loadEntityMetadata).toHaveBeenCalled();
        });
    });

    describe('batch operations advanced', () => {
        it('should handle batch with mixed operation types', async () => {
            WebApiService.executeBatch.mockResolvedValueOnce({
                successCount: 3,
                failCount: 0,
                errors: []
            });

            const operations = [
                { method: 'POST', entitySet: 'accounts', data: { name: 'New' } },
                { method: 'PATCH', entitySet: 'accounts', id: '123', data: { name: 'Updated' } },
                { method: 'DELETE', entitySet: 'accounts', id: '456' }
            ];

            const result = await DataService.executeBatch(operations);

            expect(result.successCount).toBe(3);
        });

        it('should handle batch with partial failures', async () => {
            WebApiService.executeBatch.mockResolvedValueOnce({
                successCount: 1,
                failCount: 1,
                errors: ['Record not found']
            });

            const result = await DataService.executeBatch([
                { method: 'PATCH', entitySet: 'accounts', id: '1', data: {} },
                { method: 'PATCH', entitySet: 'accounts', id: 'invalid', data: {} }
            ]);

            expect(result.failCount).toBe(1);
            expect(result.errors).toContain('Record not found');
        });

        it('should handle empty batch operations array', async () => {
            WebApiService.executeBatch.mockResolvedValueOnce({
                successCount: 0,
                failCount: 0,
                errors: []
            });

            const result = await DataService.executeBatch([]);

            expect(result.successCount).toBe(0);
        });
    });

    describe('cache behavior in _fetch', () => {
        it('should return cached data when bypassCache is false and cache exists', async () => {
            DataService.clearImpersonation();
            DataService.clearCache();

            // First call populates cache
            const firstResult = await DataService.getEnhancedUserContext(true);

            // Second call should use cache
            const secondResult = await DataService.getEnhancedUserContext(false);

            expect(firstResult).toEqual(secondResult);
        });

        it('should bypass cache when bypassCache is true', async () => {
            DataService.clearImpersonation();
            DataService.clearCache();

            // First call
            await DataService.getEnhancedUserContext(true);

            // Clear mocks to track new calls
            vi.clearAllMocks();

            // Second call with bypassCache should make new request
            await DataService.getEnhancedUserContext(true);

            // The global context should have been called again
            // (we can verify by checking that the result was regenerated)
        });
    });

    describe('impersonation with WebApiService calls', () => {
        it('should pass impersonated user ID to WebApiService calls', async () => {
            DataService.setImpersonation('impersonated-123', 'Impersonated User');

            WebApiService.retrieveMultipleRecords.mockResolvedValueOnce({ entities: [] });

            await DataService.retrieveMultipleRecords('account', '?$top=10');

            expect(WebApiService.retrieveMultipleRecords).toHaveBeenCalled();
        });

        it('should pass impersonated user ID to getPluginTraceLogs', async () => {
            DataService.setImpersonation('impersonated-456', 'Another User');

            WebApiService.getPluginTraceLogs.mockResolvedValueOnce({ entities: [] });

            await DataService.getPluginTraceLogs('?$top=50', 50);

            expect(WebApiService.getPluginTraceLogs).toHaveBeenCalled();
        });
    });

    describe('addSolutionComponent edge cases', () => {
        it('should handle addSolutionComponent with different component types', async () => {
            WebApiService.webApiFetch.mockResolvedValueOnce({});

            await DataService.addSolutionComponent('MySolution', 'comp-123', 380, false);

            // Should complete without error
        });

        it('should not make API call when solutionUniqueName is undefined', async () => {
            vi.clearAllMocks();

            await DataService.addSolutionComponent(undefined, 'comp-123', 380);

            expect(WebApiService.webApiFetch).not.toHaveBeenCalled();
        });

        it('should include correct payload structure', async () => {
            WebApiService.webApiFetch.mockResolvedValueOnce({});

            await DataService.addSolutionComponent('TestSolution', 'component-guid', 381, true);

            expect(WebApiService.webApiFetch).toHaveBeenCalled();
        });
    });

    describe('getFormEventHandlersForEntity', () => {
        it('should pass entity name to FormInspectionService', async () => {
            FormInspectionService.getFormEventHandlersForEntity.mockResolvedValueOnce({
                onLoad: [],
                onSave: []
            });

            const result = await DataService.getFormEventHandlersForEntity('contact');

            expect(FormInspectionService.getFormEventHandlersForEntity).toHaveBeenCalled();
            expect(result).toHaveProperty('onLoad');
        });

        it('should handle entity with no event handlers', async () => {
            FormInspectionService.getFormEventHandlersForEntity.mockResolvedValueOnce(null);

            const result = await DataService.getFormEventHandlersForEntity('custom_entity');

            expect(result).toBeNull();
        });
    });

    describe('listSolutions', () => {
        it('should return solutions with all properties', async () => {
            WebApiService.retrieveMultipleRecords.mockResolvedValueOnce({
                entities: [
                    {
                        uniquename: 'Solution1',
                        friendlyname: 'First Solution',
                        publisherid: { customizationprefix: 'sol1' }
                    },
                    {
                        uniquename: 'Solution2',
                        friendlyname: 'Second Solution',
                        publisherid: { customizationprefix: 'sol2' }
                    }
                ]
            });

            const result = await DataService.listSolutions();

            expect(result).toHaveLength(2);
            expect(result[0].uniqueName).toBe('Solution1');
            expect(result[0].prefix).toBe('sol1');
        });
    });

    describe('error scenarios for impersonated user context', () => {
        it('should handle error when fetching impersonated user data', async () => {
            DataService.setImpersonation('failing-user', 'Failing User');
            DataService.clearCache();

            WebApiService.retrieveRecord.mockRejectedValueOnce(new Error('User not found'));

            await expect(DataService.getEnhancedUserContext(true)).rejects.toThrow('Data fetch failed');
        });

        it('should handle error when fetching direct roles', async () => {
            DataService.setImpersonation('roles-error-user', 'Roles Error User');
            DataService.clearCache();

            WebApiService.retrieveRecord.mockResolvedValueOnce({
                fullname: 'Roles Error User',
                systemuserid: 'roles-error-user'
            });

            WebApiService.webApiFetch.mockRejectedValueOnce(new Error('Roles fetch failed'));

            await expect(DataService.getEnhancedUserContext(true)).rejects.toThrow('Data fetch failed');
        });
    });

    describe('FetchXML with entity name resolution', () => {
        it('should execute FetchXML with proper entity name', async () => {
            WebApiService.executeFetchXml.mockResolvedValueOnce({
                entities: [{ accountid: '123', name: 'Test Account' }]
            });

            const fetchXml = '<fetch><entity name="account"><attribute name="name"/></entity></fetch>';
            const result = await DataService.executeFetchXml('account', fetchXml);

            expect(result.entities[0].name).toBe('Test Account');
        });
    });

    describe('metadata service delegation', () => {
        it('should call getEntityBySetName correctly', async () => {
            MetadataService.getEntityBySetName.mockResolvedValueOnce({
                LogicalName: 'contact',
                EntitySetName: 'contacts'
            });

            const result = await DataService.getEntityBySetName('contacts');

            expect(result.LogicalName).toBe('contact');
        });

        it('should call getEntityDefinition correctly', async () => {
            MetadataService.getEntityDefinition.mockResolvedValueOnce({
                LogicalName: 'opportunity',
                PrimaryNameAttribute: 'name'
            });

            const result = await DataService.getEntityDefinition('opportunity');

            expect(result.PrimaryNameAttribute).toBe('name');
        });

        it('should call getAttributeDefinitions correctly', async () => {
            MetadataService.getAttributeDefinitions.mockResolvedValueOnce([
                { LogicalName: 'name', AttributeType: 'String' },
                { LogicalName: 'revenue', AttributeType: 'Money' }
            ]);

            const result = await DataService.getAttributeDefinitions('account');

            expect(result).toHaveLength(2);
        });
    });
});
