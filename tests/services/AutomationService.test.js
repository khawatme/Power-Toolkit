import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutomationService } from '../../src/services/AutomationService.js';

// Mock PowerApps API
vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        getEntityMetadata: vi.fn()
    }
}));

describe('AutomationService', () => {
    describe('getBusinessRulesForEntity', () => {
        it('should return empty array if no entity name provided', async () => {
            const executeFetchXml = vi.fn();
            const result = await AutomationService.getBusinessRulesForEntity(executeFetchXml, '');

            expect(result).toEqual([]);
            expect(executeFetchXml).not.toHaveBeenCalled();
        });

        it('should return empty array if entity metadata not found', async () => {
            const { PowerAppsApiService } = await import('../../src/services/PowerAppsApiService.js');
            PowerAppsApiService.getEntityMetadata.mockResolvedValue(null);

            const executeFetchXml = vi.fn();
            const result = await AutomationService.getBusinessRulesForEntity(executeFetchXml, 'account');

            expect(result).toEqual([]);
        });

        it('should fetch business rules for valid entity', async () => {
            const { PowerAppsApiService } = await import('../../src/services/PowerAppsApiService.js');
            PowerAppsApiService.getEntityMetadata.mockResolvedValue({
                ObjectTypeCode: 1
            });

            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [
                    {
                        name: 'Test Rule',
                        workflowid: '123',
                        type: 1,
                        scope: 0,
                        'scope@OData.Community.Display.V1.FormattedValue': 'Organization'
                    }
                ]
            });

            const result = await AutomationService.getBusinessRulesForEntity(executeFetchXml, 'account');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Test Rule');
            expect(result[0].id).toBe('123');
        });

        it('should separate definitions from activations', async () => {
            const { PowerAppsApiService } = await import('../../src/services/PowerAppsApiService.js');
            PowerAppsApiService.getEntityMetadata.mockResolvedValue({
                ObjectTypeCode: 1
            });

            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [
                    {
                        name: 'Test Rule Definition',
                        workflowid: 'def-123',
                        type: 1,
                        scope: 0,
                        'scope@OData.Community.Display.V1.FormattedValue': 'Organization'
                    },
                    {
                        name: 'Test Rule Activation',
                        workflowid: 'act-123',
                        type: 2,
                        statuscode: 2,
                        _parentworkflowid_value: 'def-123'
                    }
                ]
            });

            const result = await AutomationService.getBusinessRulesForEntity(executeFetchXml, 'account');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('def-123');
            expect(result[0].isActive).toBe(true);
        });

        it('should mark rule as inactive if no activation', async () => {
            const { PowerAppsApiService } = await import('../../src/services/PowerAppsApiService.js');
            PowerAppsApiService.getEntityMetadata.mockResolvedValue({
                ObjectTypeCode: 1
            });

            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [
                    {
                        name: 'Inactive Rule',
                        workflowid: 'def-456',
                        type: 1,
                        scope: 0
                    }
                ]
            });

            const result = await AutomationService.getBusinessRulesForEntity(executeFetchXml, 'account');

            expect(result[0].isActive).toBe(false);
        });

        it('should return empty array if no entities returned', async () => {
            const { PowerAppsApiService } = await import('../../src/services/PowerAppsApiService.js');
            PowerAppsApiService.getEntityMetadata.mockResolvedValue({
                ObjectTypeCode: 1
            });

            const executeFetchXml = vi.fn().mockResolvedValue({ entities: [] });

            const result = await AutomationService.getBusinessRulesForEntity(executeFetchXml, 'account');

            expect(result).toEqual([]);
        });

        it('should return empty array if metadata has no ObjectTypeCode', async () => {
            const { PowerAppsApiService } = await import('../../src/services/PowerAppsApiService.js');
            PowerAppsApiService.getEntityMetadata.mockResolvedValue({
                LogicalName: 'account'
            });

            const executeFetchXml = vi.fn();
            const result = await AutomationService.getBusinessRulesForEntity(executeFetchXml, 'account');

            expect(result).toEqual([]);
            expect(executeFetchXml).not.toHaveBeenCalled();
        });

        it('should handle null entityName', async () => {
            const executeFetchXml = vi.fn();
            const result = await AutomationService.getBusinessRulesForEntity(executeFetchXml, null);

            expect(result).toEqual([]);
            expect(executeFetchXml).not.toHaveBeenCalled();
        });

        it('should handle undefined entityName', async () => {
            const executeFetchXml = vi.fn();
            const result = await AutomationService.getBusinessRulesForEntity(executeFetchXml, undefined);

            expect(result).toEqual([]);
            expect(executeFetchXml).not.toHaveBeenCalled();
        });

        it('should use Unknown scope when formatted value is missing', async () => {
            const { PowerAppsApiService } = await import('../../src/services/PowerAppsApiService.js');
            PowerAppsApiService.getEntityMetadata.mockResolvedValue({
                ObjectTypeCode: 1
            });

            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [
                    {
                        name: 'Rule Without Scope',
                        workflowid: 'rule-123',
                        type: 1,
                        scope: 0
                    }
                ]
            });

            const result = await AutomationService.getBusinessRulesForEntity(executeFetchXml, 'account');

            expect(result[0].scope).toBe('Unknown');
        });

        it('should handle activation with non-active statuscode', async () => {
            const { PowerAppsApiService } = await import('../../src/services/PowerAppsApiService.js');
            PowerAppsApiService.getEntityMetadata.mockResolvedValue({
                ObjectTypeCode: 1
            });

            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [
                    {
                        name: 'Test Rule',
                        workflowid: 'def-789',
                        type: 1,
                        scope: 0
                    },
                    {
                        name: 'Test Activation',
                        workflowid: 'act-789',
                        type: 2,
                        statuscode: 1,
                        _parentworkflowid_value: 'def-789'
                    }
                ]
            });

            const result = await AutomationService.getBusinessRulesForEntity(executeFetchXml, 'account');

            expect(result[0].isActive).toBe(false);
        });

        it('should include description and clientData in result', async () => {
            const { PowerAppsApiService } = await import('../../src/services/PowerAppsApiService.js');
            PowerAppsApiService.getEntityMetadata.mockResolvedValue({
                ObjectTypeCode: 1
            });

            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [
                    {
                        name: 'Rule With Details',
                        workflowid: 'rule-detail',
                        type: 1,
                        scope: 0,
                        description: 'This is a test rule',
                        clientdata: '<some>xml</some>'
                    }
                ]
            });

            const result = await AutomationService.getBusinessRulesForEntity(executeFetchXml, 'account');

            expect(result[0].description).toBe('This is a test rule');
            expect(result[0].clientData).toBe('<some>xml</some>');
        });

        it('should handle response without entities property', async () => {
            const { PowerAppsApiService } = await import('../../src/services/PowerAppsApiService.js');
            PowerAppsApiService.getEntityMetadata.mockResolvedValue({
                ObjectTypeCode: 1
            });

            const executeFetchXml = vi.fn().mockResolvedValue({});

            const result = await AutomationService.getBusinessRulesForEntity(executeFetchXml, 'account');

            expect(result).toEqual([]);
        });
    });

    describe('setBusinessRuleState', () => {
        it('should activate a business rule with correct state values', async () => {
            const updateRecord = vi.fn().mockResolvedValue({ success: true });
            const ruleId = 'rule-123';

            const result = await AutomationService.setBusinessRuleState(updateRecord, ruleId, true);

            expect(updateRecord).toHaveBeenCalledWith('workflows', 'rule-123', {
                statecode: 1,
                statuscode: 2
            });
            expect(result).toEqual({ success: true });
        });

        it('should deactivate a business rule with correct state values', async () => {
            const updateRecord = vi.fn().mockResolvedValue({ success: true });
            const ruleId = 'rule-456';

            const result = await AutomationService.setBusinessRuleState(updateRecord, ruleId, false);

            expect(updateRecord).toHaveBeenCalledWith('workflows', 'rule-456', {
                statecode: 0,
                statuscode: 1
            });
            expect(result).toEqual({ success: true });
        });

        it('should propagate updateRecord error on activation failure', async () => {
            const updateRecord = vi.fn().mockRejectedValue(new Error('Update failed'));
            const ruleId = 'rule-789';

            await expect(AutomationService.setBusinessRuleState(updateRecord, ruleId, true))
                .rejects.toThrow('Update failed');
        });

        it('should propagate updateRecord error on deactivation failure', async () => {
            const updateRecord = vi.fn().mockRejectedValue(new Error('Deactivation failed'));
            const ruleId = 'rule-999';

            await expect(AutomationService.setBusinessRuleState(updateRecord, ruleId, false))
                .rejects.toThrow('Deactivation failed');
        });

        it('should handle truthy activate value', async () => {
            const updateRecord = vi.fn().mockResolvedValue({});

            await AutomationService.setBusinessRuleState(updateRecord, 'rule-id', 1);

            expect(updateRecord).toHaveBeenCalledWith('workflows', 'rule-id', {
                statecode: 1,
                statuscode: 2
            });
        });

        it('should handle falsy activate value', async () => {
            const updateRecord = vi.fn().mockResolvedValue({});

            await AutomationService.setBusinessRuleState(updateRecord, 'rule-id', 0);

            expect(updateRecord).toHaveBeenCalledWith('workflows', 'rule-id', {
                statecode: 0,
                statuscode: 1
            });
        });
    });

    describe('deleteBusinessRule', () => {
        it('should delete a business rule by ID', async () => {
            const deleteRecord = vi.fn().mockResolvedValue({ success: true });
            const ruleId = 'rule-to-delete';

            const result = await AutomationService.deleteBusinessRule(deleteRecord, ruleId);

            expect(deleteRecord).toHaveBeenCalledWith('workflows', 'rule-to-delete');
            expect(result).toEqual({ success: true });
        });

        it('should propagate deleteRecord error on failure', async () => {
            const deleteRecord = vi.fn().mockRejectedValue(new Error('Delete failed'));
            const ruleId = 'rule-error';

            await expect(AutomationService.deleteBusinessRule(deleteRecord, ruleId))
                .rejects.toThrow('Delete failed');
        });

        it('should return the result from deleteRecord', async () => {
            const deleteRecord = vi.fn().mockResolvedValue({
                deleted: true,
                recordId: 'rule-deleted'
            });

            const result = await AutomationService.deleteBusinessRule(deleteRecord, 'rule-deleted');

            expect(result).toEqual({ deleted: true, recordId: 'rule-deleted' });
        });

        it('should handle undefined result from deleteRecord', async () => {
            const deleteRecord = vi.fn().mockResolvedValue(undefined);

            const result = await AutomationService.deleteBusinessRule(deleteRecord, 'rule-id');

            expect(result).toBeUndefined();
        });
    });
});
