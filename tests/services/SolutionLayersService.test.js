/**
 * @file Tests for SolutionLayersService
 * @module tests/services/SolutionLayersService.test.js
 * @description Test suite for solution component layer operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockWebApiService = {
    webApiFetch: vi.fn()
};

const mockMetadataService = {
    getEntitySetName: vi.fn((name) => name + 's')
};

vi.mock('../../src/services/WebApiService.js', () => ({
    WebApiService: mockWebApiService
}));

vi.mock('../../src/services/MetadataService.js', () => ({
    MetadataService: mockMetadataService
}));

describe('SolutionLayersService', () => {
    let SolutionLayersService;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        const module = await import('../../src/services/SolutionLayersService.js');
        SolutionLayersService = module.SolutionLayersService;
    });

    describe('getSolutions', () => {
        it('should fetch all solutions', async () => {
            const mockSolutions = {
                value: [
                    { solutionid: '1', friendlyname: 'Solution 1', uniquename: 'sol1', ismanaged: false },
                    { solutionid: '2', friendlyname: 'Solution 2', uniquename: 'sol2', ismanaged: true }
                ]
            };

            mockWebApiService.webApiFetch.mockResolvedValue(mockSolutions);

            const result = await SolutionLayersService.getSolutions();

            expect(result).toHaveLength(2);
            expect(result[0].friendlyname).toBe('Solution 1');
        });

        it('should return empty array when no solutions found', async () => {
            mockWebApiService.webApiFetch.mockResolvedValue({});

            const result = await SolutionLayersService.getSolutions();

            expect(result).toEqual([]);
        });

        it('should handle errors when fetching solutions', async () => {
            mockWebApiService.webApiFetch.mockRejectedValue(new Error('API Error'));

            await expect(SolutionLayersService.getSolutions()).rejects.toThrow('Failed to retrieve solutions');
        });
    });

    describe('getSolutionLayers', () => {
        it('should fetch solution layers for a solution', async () => {
            const mockPublisherResult = {
                value: [{ publisherid: { friendlyname: 'My Publisher' } }]
            };
            const mockLayers = {
                value: [
                    {
                        msdyn_solutioncomponentsummaryid: 'comp-1',
                        msdyn_name: 'Component 1',
                        msdyn_componenttype: 1,
                        msdyn_displayname: 'Account Entity'
                    }
                ]
            };

            mockWebApiService.webApiFetch
                .mockResolvedValueOnce(mockPublisherResult)
                .mockResolvedValueOnce(mockLayers)
                .mockResolvedValue({ value: [] }); // Child queries

            const result = await SolutionLayersService.getSolutionLayers('solution-id', 'solutionname', false);

            expect(Array.isArray(result)).toBe(true);
        });

        it('should return empty array when no components found', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [] }) // Publisher query
                .mockResolvedValueOnce({ value: [] }); // Components query

            const result = await SolutionLayersService.getSolutionLayers('solution-id', 'solutionname', false);

            expect(result).toEqual([]);
        });

        it('should handle publisher fetch errors gracefully', async () => {
            mockWebApiService.webApiFetch
                .mockRejectedValueOnce(new Error('Publisher error'))
                .mockResolvedValueOnce({ value: [] }); // Components query

            const result = await SolutionLayersService.getSolutionLayers('solution-id', 'solutionname', false);

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle errors when fetching layers', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [] }) // Publisher query
                .mockRejectedValueOnce(new Error('API Error')); // Components query

            await expect(
                SolutionLayersService.getSolutionLayers('id', 'name', false)
            ).rejects.toThrow();
        });
    });

    describe('_extractComponentTypeName', () => {
        it('should return Form for componentType 60', () => {
            const component = { msdyn_componenttype: 60, msdyn_componenttypename: 'SystemForm' };
            const result = SolutionLayersService._extractComponentTypeName(component);
            expect(result).toBe('Form');
        });

        it('should return Form for componentType 24', () => {
            const component = { msdyn_componenttype: 24, msdyn_componenttypename: 'SystemForm' };
            const result = SolutionLayersService._extractComponentTypeName(component);
            expect(result).toBe('Form');
        });

        it('should return View for componentType 26', () => {
            const component = { msdyn_componenttype: 26, msdyn_componenttypename: 'SavedQuery' };
            const result = SolutionLayersService._extractComponentTypeName(component);
            expect(result).toBe('View');
        });

        it('should return Attribute for componentType 2', () => {
            const component = { msdyn_componenttype: 2, msdyn_componenttypename: 'Attribute' };
            const result = SolutionLayersService._extractComponentTypeName(component);
            expect(result).toBe('Attribute');
        });

        it('should return Chart for componentType 59', () => {
            const component = { msdyn_componenttype: 59, msdyn_componenttypename: 'Chart' };
            const result = SolutionLayersService._extractComponentTypeName(component);
            expect(result).toBe('Chart');
        });

        it('should handle Customization.Type_ prefix', () => {
            const component = { msdyn_componenttype: 99, msdyn_componenttypename: 'Customization.Type_99' };
            const result = SolutionLayersService._extractComponentTypeName(component);
            expect(result).toBe('99');
        });

        it('should fallback to Type N for unknown types without name', () => {
            const component = { msdyn_componenttype: 999, msdyn_componenttypename: null };
            const result = SolutionLayersService._extractComponentTypeName(component);
            expect(result).toBe('Type 999');
        });

        it('should use provided type name for known types', () => {
            const component = { msdyn_componenttype: 61, msdyn_componenttypename: 'WebResource' };
            const result = SolutionLayersService._extractComponentTypeName(component);
            expect(result).toBe('WebResource');
        });
    });

    describe('_getSolutionComponentName', () => {
        it('should return Entity for componentType 1', () => {
            const result = SolutionLayersService._getSolutionComponentName(1);
            expect(result).toBe('Entity');
        });

        it('should return Attribute for componentType 2', () => {
            const result = SolutionLayersService._getSolutionComponentName(2);
            expect(result).toBe('Attribute');
        });

        it('should return SystemForm for componentType 24', () => {
            const result = SolutionLayersService._getSolutionComponentName(24);
            expect(result).toBe('SystemForm');
        });

        it('should return SavedQuery for componentType 26', () => {
            const result = SolutionLayersService._getSolutionComponentName(26);
            expect(result).toBe('SavedQuery');
        });

        it('should return Workflow for componentType 29', () => {
            const result = SolutionLayersService._getSolutionComponentName(29);
            expect(result).toBe('Workflow');
        });

        it('should return WebResource for componentType 61', () => {
            const result = SolutionLayersService._getSolutionComponentName(61);
            expect(result).toBe('WebResource');
        });

        it('should return EnvironmentVariableDefinition for componentType 380', () => {
            const result = SolutionLayersService._getSolutionComponentName(380);
            expect(result).toBe('EnvironmentVariableDefinition');
        });

        it('should return null for unsupported component types', () => {
            const result = SolutionLayersService._getSolutionComponentName(9999);
            expect(result).toBeNull();
        });
    });

    describe('canDeleteComponentType', () => {
        it('should return true for Entity type (1)', () => {
            expect(SolutionLayersService.canDeleteComponentType(1)).toBe(true);
        });

        it('should return true for SystemForm type (24)', () => {
            expect(SolutionLayersService.canDeleteComponentType(24)).toBe(true);
        });

        it('should return true for WebResource type (61)', () => {
            expect(SolutionLayersService.canDeleteComponentType(61)).toBe(true);
        });

        it('should return false for unsupported component types', () => {
            expect(SolutionLayersService.canDeleteComponentType(9999)).toBe(false);
        });
    });

    describe('deleteLayer', () => {
        it('should delete layer for supported component type', async () => {
            mockWebApiService.webApiFetch.mockResolvedValue({});

            await SolutionLayersService.deleteLayer('component-id', 1);

            expect(mockWebApiService.webApiFetch).toHaveBeenCalled();
            const [method, url] = mockWebApiService.webApiFetch.mock.calls[0];
            expect(method).toBe('GET');
            expect(url).toContain('RemoveActiveCustomizations');
            expect(url).toContain('Entity');
            expect(url).toContain('component-id');
        });

        it('should throw error for unsupported component type', async () => {
            await expect(
                SolutionLayersService.deleteLayer('component-id', 9999)
            ).rejects.toThrow('does not support RemoveActiveCustomizations');
        });

        it('should handle API errors when deleting', async () => {
            mockWebApiService.webApiFetch.mockRejectedValue(new Error('Delete failed'));

            await expect(
                SolutionLayersService.deleteLayer('component-id', 1)
            ).rejects.toThrow('Failed to delete layer');
        });

        it('should delete Attribute component type (2)', async () => {
            mockWebApiService.webApiFetch.mockResolvedValue({});

            await SolutionLayersService.deleteLayer('attr-id', 2);

            const [, url] = mockWebApiService.webApiFetch.mock.calls[0];
            expect(url).toContain('Attribute');
        });

        it('should delete SystemForm component type (24)', async () => {
            mockWebApiService.webApiFetch.mockResolvedValue({});

            await SolutionLayersService.deleteLayer('form-id', 24);

            const [, url] = mockWebApiService.webApiFetch.mock.calls[0];
            expect(url).toContain('SystemForm');
        });

        it('should delete WebResource component type (61)', async () => {
            mockWebApiService.webApiFetch.mockResolvedValue({});

            await SolutionLayersService.deleteLayer('webres-id', 61);

            const [, url] = mockWebApiService.webApiFetch.mock.calls[0];
            expect(url).toContain('WebResource');
        });

        it('should delete Workflow component type (29)', async () => {
            mockWebApiService.webApiFetch.mockResolvedValue({});

            await SolutionLayersService.deleteLayer('workflow-id', 29);

            const [, url] = mockWebApiService.webApiFetch.mock.calls[0];
            expect(url).toContain('Workflow');
        });

        it('should delete PluginAssembly component type (91)', async () => {
            mockWebApiService.webApiFetch.mockResolvedValue({});

            await SolutionLayersService.deleteLayer('plugin-id', 91);

            const [, url] = mockWebApiService.webApiFetch.mock.calls[0];
            expect(url).toContain('PluginAssembly');
        });

        it('should delete EnvironmentVariableDefinition component type (380)', async () => {
            mockWebApiService.webApiFetch.mockResolvedValue({});

            await SolutionLayersService.deleteLayer('envvar-id', 380);

            const [, url] = mockWebApiService.webApiFetch.mock.calls[0];
            expect(url).toContain('EnvironmentVariableDefinition');
        });
    });

    describe('getSolutionLayers - component processing', () => {
        it('should extract display name from msdyn_displayname field', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ publisherid: { friendlyname: 'Publisher' } }] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'comp-1',
                        msdyn_displayname: 'My Display Name',
                        msdyn_componenttype: 61
                    }]
                })
                .mockResolvedValue({ value: [] });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', false);

            expect(result[0].name).toBe('My Display Name');
        });

        it('should fallback to msdyn_schemaname when displayname is a GUID', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ publisherid: { friendlyname: 'Publisher' } }] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'comp-1',
                        msdyn_displayname: '12345678-1234-1234-1234-123456789012',
                        msdyn_schemaname: 'MySchemaName',
                        msdyn_componenttype: 61
                    }]
                })
                .mockResolvedValue({ value: [] });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', false);

            expect(result[0].name).toBe('MySchemaName');
        });

        it('should fallback to msdyn_componentlogicalname when all names are GUIDs', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ publisherid: { friendlyname: 'Publisher' } }] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'comp-1',
                        msdyn_displayname: '12345678-1234-1234-1234-123456789012',
                        msdyn_schemaname: '12345678-1234-1234-1234-123456789013',
                        msdyn_name: '12345678-1234-1234-1234-123456789014',
                        msdyn_componentlogicalname: 'account',
                        msdyn_componenttype: 1
                    }]
                })
                .mockResolvedValue({ value: [] });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', false);

            expect(result[0].name).toBe('account');
        });

        it('should use Unnamed Component when all name fields are missing', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ publisherid: { friendlyname: 'Publisher' } }] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'comp-1',
                        msdyn_componenttype: 61
                    }]
                })
                .mockResolvedValue({ value: [] });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', false);

            expect(result[0].name).toBe('Unnamed Component');
        });

        it('should parse componentLogicalName with dot notation', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ publisherid: { friendlyname: 'Publisher' } }] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'comp-1',
                        msdyn_displayname: 'Account ID',
                        msdyn_componentlogicalname: 'account.accountid',
                        msdyn_componenttype: 2
                    }]
                })
                .mockResolvedValue({ value: [] });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', false);

            expect(result[0].logicalName).toBe('accountid');
            expect(result[0].componentTypeName).toContain('account');
        });

        it('should mark managed components as deletable', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ publisherid: { friendlyname: 'Publisher' } }] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'comp-1',
                        msdyn_displayname: 'Test Entity',
                        msdyn_componenttype: 1,
                        msdyn_ismanaged: true
                    }]
                })
                .mockResolvedValue({ value: [] });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', true);

            expect(result[0].canBeDeleted).toBe(true);
        });

        it('should not mark unmanaged components as deletable', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ publisherid: { friendlyname: 'Publisher' } }] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'comp-1',
                        msdyn_displayname: 'Test Entity',
                        msdyn_componenttype: 1,
                        msdyn_ismanaged: false
                    }]
                })
                .mockResolvedValue({ value: [] });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', false);

            expect(result[0].canBeDeleted).toBe(false);
        });

        it('should use Unknown Publisher when publisherid is missing', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{}] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'comp-1',
                        msdyn_displayname: 'Test',
                        msdyn_componenttype: 1
                    }]
                })
                .mockResolvedValue({ value: [] });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', false);

            expect(result[0].publisherName).toBe('Unknown Publisher');
        });

        it('should handle Entity components with schemaName as logical name', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ publisherid: { friendlyname: 'Publisher' } }] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'comp-1',
                        msdyn_displayname: 'Account',
                        msdyn_schemaname: 'account',
                        msdyn_componenttype: 1
                    }]
                })
                .mockResolvedValue({ value: [] });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', false);

            expect(result[0].componentTypeName).toBe('Entity (account)');
        });
    });

    describe('getSolutionLayers - child components', () => {
        it('should fetch child components for entities', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ publisherid: { friendlyname: 'Publisher' } }] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'entity-1',
                        msdyn_displayname: 'Account',
                        msdyn_schemaname: 'account',
                        msdyn_componenttype: 1
                    }]
                })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'attr-1',
                        msdyn_displayname: 'Account Name',
                        msdyn_componenttype: 2,
                        msdyn_primaryentityname: 'account'
                    }]
                });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', false);

            expect(result.length).toBeGreaterThan(1);
            expect(result.some(c => c.componentType === 2)).toBe(true);
        });

        it('should skip entities without valid logical names', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ publisherid: { friendlyname: 'Publisher' } }] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'entity-1',
                        msdyn_displayname: 'Unknown Entity',
                        msdyn_componenttype: 1
                        // No schemaName or logicalName
                    }]
                })
                .mockResolvedValue({ value: [] });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', false);

            expect(result).toHaveLength(1);
        });

        it('should handle errors when fetching child components gracefully', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ publisherid: { friendlyname: 'Publisher' } }] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'entity-1',
                        msdyn_displayname: 'Account',
                        msdyn_schemaname: 'account',
                        msdyn_componenttype: 1
                    }]
                })
                .mockRejectedValueOnce(new Error('Child fetch error'));

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', false);

            expect(result).toHaveLength(1);
            expect(result[0].componentType).toBe(1);
        });

        it('should transform child components with correct parent entity', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ publisherid: { friendlyname: 'Publisher' } }] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'entity-1',
                        msdyn_displayname: 'Contact',
                        msdyn_schemaname: 'contact',
                        msdyn_componenttype: 1
                    }]
                })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'form-1',
                        msdyn_displayname: 'Main Form',
                        msdyn_componenttype: 60,
                        msdyn_primaryentityname: 'contact'
                    }]
                });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', false);

            const form = result.find(c => c.componentType === 60);
            expect(form.componentTypeName).toContain('contact');
        });
    });

    describe('_getSolutionComponentName - additional types', () => {
        it('should return Relationship for componentType 3', () => {
            const result = SolutionLayersService._getSolutionComponentName(3);
            expect(result).toBe('Relationship');
        });

        it('should return AttributePicklistValue for componentType 4', () => {
            const result = SolutionLayersService._getSolutionComponentName(4);
            expect(result).toBe('AttributePicklistValue');
        });

        it('should return LocalizedLabel for componentType 7', () => {
            const result = SolutionLayersService._getSolutionComponentName(7);
            expect(result).toBe('LocalizedLabel');
        });

        it('should return OptionSet for componentType 9', () => {
            const result = SolutionLayersService._getSolutionComponentName(9);
            expect(result).toBe('OptionSet');
        });

        it('should return EntityRelationship for componentType 10', () => {
            const result = SolutionLayersService._getSolutionComponentName(10);
            expect(result).toBe('EntityRelationship');
        });

        it('should return Role for componentType 20', () => {
            const result = SolutionLayersService._getSolutionComponentName(20);
            expect(result).toBe('Role');
        });

        it('should return RolePrivilege for componentType 21', () => {
            const result = SolutionLayersService._getSolutionComponentName(21);
            expect(result).toBe('RolePrivilege');
        });

        it('should return SiteMap for componentType 62', () => {
            const result = SolutionLayersService._getSolutionComponentName(62);
            expect(result).toBe('SiteMap');
        });

        it('should return CustomControl for componentType 66', () => {
            const result = SolutionLayersService._getSolutionComponentName(66);
            expect(result).toBe('CustomControl');
        });

        it('should return FieldSecurityProfile for componentType 70', () => {
            const result = SolutionLayersService._getSolutionComponentName(70);
            expect(result).toBe('FieldSecurityProfile');
        });

        it('should return FieldPermission for componentType 71', () => {
            const result = SolutionLayersService._getSolutionComponentName(71);
            expect(result).toBe('FieldPermission');
        });

        it('should return PluginType for componentType 90', () => {
            const result = SolutionLayersService._getSolutionComponentName(90);
            expect(result).toBe('PluginType');
        });

        it('should return SdkMessageProcessingStep for componentType 92', () => {
            const result = SolutionLayersService._getSolutionComponentName(92);
            expect(result).toBe('SdkMessageProcessingStep');
        });

        it('should return Connector for componentType 371', () => {
            const result = SolutionLayersService._getSolutionComponentName(371);
            expect(result).toBe('Connector');
        });

        it('should return Connector for componentType 372', () => {
            const result = SolutionLayersService._getSolutionComponentName(372);
            expect(result).toBe('Connector');
        });

        it('should return EnvironmentVariableValue for componentType 381', () => {
            const result = SolutionLayersService._getSolutionComponentName(381);
            expect(result).toBe('EnvironmentVariableValue');
        });

        it('should return AIConfiguration for componentType 402', () => {
            const result = SolutionLayersService._getSolutionComponentName(402);
            expect(result).toBe('AIConfiguration');
        });

        it('should return AppModule for componentType 10021', () => {
            const result = SolutionLayersService._getSolutionComponentName(10021);
            expect(result).toBe('AppModule');
        });
    });

    describe('canDeleteComponentType - additional types', () => {
        it('should return true for Attribute type (2)', () => {
            expect(SolutionLayersService.canDeleteComponentType(2)).toBe(true);
        });

        it('should return true for Relationship type (3)', () => {
            expect(SolutionLayersService.canDeleteComponentType(3)).toBe(true);
        });

        it('should return true for OptionSet type (9)', () => {
            expect(SolutionLayersService.canDeleteComponentType(9)).toBe(true);
        });

        it('should return true for Role type (20)', () => {
            expect(SolutionLayersService.canDeleteComponentType(20)).toBe(true);
        });

        it('should return true for SavedQuery type (26)', () => {
            expect(SolutionLayersService.canDeleteComponentType(26)).toBe(true);
        });

        it('should return true for Workflow type (29)', () => {
            expect(SolutionLayersService.canDeleteComponentType(29)).toBe(true);
        });

        it('should return true for Form type (60)', () => {
            expect(SolutionLayersService.canDeleteComponentType(60)).toBe(true);
        });

        it('should return true for PluginAssembly type (91)', () => {
            expect(SolutionLayersService.canDeleteComponentType(91)).toBe(true);
        });

        it('should return true for Connector type (371)', () => {
            expect(SolutionLayersService.canDeleteComponentType(371)).toBe(true);
        });

        it('should return true for EnvironmentVariableDefinition type (380)', () => {
            expect(SolutionLayersService.canDeleteComponentType(380)).toBe(true);
        });

        it('should return false for random unsupported type', () => {
            expect(SolutionLayersService.canDeleteComponentType(12345)).toBe(false);
        });
    });

    describe('_extractComponentTypeName - edge cases', () => {
        it('should return msdyn_typename if available for unknown types', () => {
            const component = { msdyn_componenttype: 999, msdyn_componenttypename: null, msdyn_typename: 'CustomType' };
            const result = SolutionLayersService._extractComponentTypeName(component);
            expect(result).toBe('Type 999');
        });

        it('should handle empty componenttypename', () => {
            const component = { msdyn_componenttype: 50, msdyn_componenttypename: '' };
            const result = SolutionLayersService._extractComponentTypeName(component);
            expect(result).toBe('Type 50');
        });

        it('should strip Customization.Type_ prefix correctly', () => {
            const component = { msdyn_componenttype: 123, msdyn_componenttypename: 'Customization.Type_CustomEntity' };
            const result = SolutionLayersService._extractComponentTypeName(component);
            expect(result).toBe('CustomEntity');
        });

        it('should return provided name for regular component types', () => {
            const component = { msdyn_componenttype: 61, msdyn_componenttypename: 'WebResource' };
            const result = SolutionLayersService._extractComponentTypeName(component);
            expect(result).toBe('WebResource');
        });
    });

    describe('getSolutions - edge cases', () => {
        it('should handle null value in response', async () => {
            mockWebApiService.webApiFetch.mockResolvedValue({ value: null });

            const result = await SolutionLayersService.getSolutions();

            expect(result).toEqual([]);
        });

        it('should return solutions with all expected fields', async () => {
            const mockSolutions = {
                value: [
                    { solutionid: 'abc-123', friendlyname: 'Test Solution', uniquename: 'testsol', ismanaged: true }
                ]
            };

            mockWebApiService.webApiFetch.mockResolvedValue(mockSolutions);

            const result = await SolutionLayersService.getSolutions();

            expect(result[0]).toHaveProperty('solutionid');
            expect(result[0]).toHaveProperty('friendlyname');
            expect(result[0]).toHaveProperty('uniquename');
            expect(result[0]).toHaveProperty('ismanaged');
        });

        it('should wrap original error message in getSolutions', async () => {
            mockWebApiService.webApiFetch.mockRejectedValue(new Error('Network timeout'));

            await expect(SolutionLayersService.getSolutions()).rejects.toThrow('Failed to retrieve solutions: Network timeout');
        });
    });

    describe('getSolutionLayers - empty responses and edge cases', () => {
        it('should handle null value in components response', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [] })
                .mockResolvedValueOnce({ value: null });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', false);

            expect(result).toEqual([]);
        });

        it('should wrap original error message in getSolutionLayers', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [] })
                .mockRejectedValueOnce(new Error('Connection refused'));

            await expect(
                SolutionLayersService.getSolutionLayers('sol-id', 'solname', false)
            ).rejects.toThrow('Failed to retrieve solution components: Connection refused');
        });

        it('should use objectId as fallback for component id', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ publisherid: { friendlyname: 'Publisher' } }] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_objectid: 'object-id-123',
                        msdyn_displayname: 'Test Component',
                        msdyn_componenttype: 61
                    }]
                })
                .mockResolvedValue({ value: [] });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', false);

            expect(result[0].id).toBe('object-id-123');
        });

        it('should preserve all component metadata fields', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ publisherid: { friendlyname: 'Test Publisher' } }] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'comp-1',
                        msdyn_displayname: 'Test Component',
                        msdyn_componenttype: 61,
                        msdyn_ismanaged: true,
                        msdyn_iscustomizable: true,
                        msdyn_statusname: 'Published',
                        msdyn_modifiedon: '2025-01-01',
                        msdyn_createdon: '2024-01-01',
                        msdyn_description: 'Component description',
                        msdyn_hasactivecustomization: true,
                        msdyn_total: 3
                    }]
                })
                .mockResolvedValue({ value: [] });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', true);

            expect(result[0].isManaged).toBe(true);
            expect(result[0].isCustomizable).toBe(true);
            expect(result[0].status).toBe('Published');
            expect(result[0].modifiedOn).toBe('2025-01-01');
            expect(result[0].createdOn).toBe('2024-01-01');
            expect(result[0].description).toBe('Component description');
            expect(result[0].hasActiveCustomization).toBe(true);
            expect(result[0].totalLayers).toBe(3);
            expect(result[0].publisherName).toBe('Test Publisher');
        });

        it('should use default status when statusname is missing', async () => {
            mockWebApiService.webApiFetch
                .mockResolvedValueOnce({ value: [{ publisherid: { friendlyname: 'Publisher' } }] })
                .mockResolvedValueOnce({
                    value: [{
                        msdyn_solutioncomponentsummaryid: 'comp-1',
                        msdyn_displayname: 'Test',
                        msdyn_componenttype: 1
                    }]
                })
                .mockResolvedValue({ value: [] });

            const result = await SolutionLayersService.getSolutionLayers('sol-id', 'solname', false);

            expect(result[0].status).toBe('Active');
        });
    });
});
