/**
 * @file Tests for CustomApiService
 * @module tests/services/CustomApiService.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// MOCKS (MUST BE BEFORE IMPORTS)
// ═══════════════════════════════════════════════════════════════

vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        retrieveMultipleRecords: vi.fn().mockResolvedValue({ entities: [] }),
        retrieveRecord: vi.fn().mockResolvedValue({}),
        createRecord: vi.fn().mockResolvedValue({ id: 'new-id' }),
        updateRecord: vi.fn().mockResolvedValue({}),
        deleteRecord: vi.fn().mockResolvedValue({}),
        getImpersonationInfo: vi.fn(() => ({ isImpersonating: false, userId: null, userName: null }))
    }
}));

// Mirrors the real header builder so a missing impersonation header shows up as a failing
// assertion rather than an empty object that passes everything.
vi.mock('../../src/services/WebApiService.js', () => ({
    WebApiService: {
        buildHeaders: vi.fn((customHeaders = {}, impersonatedUserId = null) => ({
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            Accept: 'application/json',
            'Content-Type': 'application/json; charset=utf-8',
            ...customHeaders,
            ...(impersonatedUserId ? { MSCRMCallerID: impersonatedUserId } : {})
        }))
    }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        getGlobalContext: vi.fn().mockReturnValue({
            getClientUrl: vi.fn().mockReturnValue('https://org.crm.dynamics.com')
        })
    }
}));

vi.mock('../../src/services/MetadataService.js', () => ({
    MetadataService: {
        getEntitySetName: vi.fn().mockReturnValue('accounts')
    }
}));

vi.mock('../../src/constants/index.js', () => ({
    Config: {
        WEB_API_HEADERS: { STANDARD: { 'OData-MaxVersion': '4.0', 'OData-Version': '4.0', Accept: 'application/json', 'Content-Type': 'application/json; charset=utf-8' } },
        CUSTOM_API_FIELD_TYPES: { 0: 'Boolean', 1: 'DateTime', 2: 'Decimal', 3: 'Entity', 4: 'EntityCollection', 5: 'EntityReference', 6: 'Float', 7: 'Integer', 8: 'Money', 9: 'Picklist', 10: 'String', 11: 'StringArray', 12: 'Guid' },
        CUSTOM_API_BINDING_TYPES: { 0: 'Global', 1: 'Entity', 2: 'EntityCollection' },
        CUSTOM_API_PROCESSING_TYPES: { 0: 'None', 1: 'Async Only', 2: 'Sync and Async' },
        CUSTOM_API_TYPE_DEFAULTS: { 0: false, 7: 0, 10: '', 12: '00000000-0000-0000-0000-000000000000' },
        DATAVERSE_PAGINATION: { MAX_PAGE_SIZE: 5000 }
    }
}));

// ═══════════════════════════════════════════════════════════════
// IMPORTS (AFTER MOCKS)
// ═══════════════════════════════════════════════════════════════

import { CustomApiService } from '../../src/services/CustomApiService.js';
import { DataService } from '../../src/services/DataService.js';
import { MetadataService } from '../../src/services/MetadataService.js';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Creates a mock Custom API definition. */
function createMockApi(overrides = {}) {
    return {
        customapiid: 'api-001',
        uniquename: 'new_TestAction',
        displayname: 'Test Action',
        description: 'A test action',
        bindingtype: 0,
        boundentitylogicalname: '',
        isfunction: false,
        isprivate: false,
        ismanaged: false,
        allowedcustomprocessingsteptype: 0,
        executeprivilegename: '',
        workflowsdkstepenabled: false,
        PluginTypeId: null,
        CustomAPIRequestParameters: [],
        CustomAPIResponseProperties: [],
        ...overrides
    };
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

describe('CustomApiService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        DataService.getImpersonationInfo.mockReturnValue({
            isImpersonating: false, userId: null, userName: null
        });
    });

    // ═══════════════════════════════════════════════════════════
    // BROWSE / READ
    // ═══════════════════════════════════════════════════════════

    describe('fetchAll', () => {
        it('should call DataService.retrieveMultipleRecords with correct entity', async () => {
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [] });

            await CustomApiService.fetchAll();

            expect(DataService.retrieveMultipleRecords).toHaveBeenCalledWith(
                'customapi',
                expect.stringContaining('$select=')
            );
        });

        it('should include expand for parameters, properties, and plugin', async () => {
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [] });

            await CustomApiService.fetchAll();

            const qs = DataService.retrieveMultipleRecords.mock.calls[0][1];
            expect(qs).toContain('CustomAPIRequestParameters');
            expect(qs).toContain('CustomAPIResponseProperties');
            expect(qs).toContain('PluginTypeId');
        });

        it('should return entities array', async () => {
            const mockApis = [createMockApi(), createMockApi({ customapiid: 'api-002' })];
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: mockApis });

            const result = await CustomApiService.fetchAll();

            expect(result).toEqual(mockApis);
            expect(result).toHaveLength(2);
        });

        it('should return empty array when result is null', async () => {
            DataService.retrieveMultipleRecords.mockResolvedValue(null);

            const result = await CustomApiService.fetchAll();

            expect(result).toEqual([]);
        });

        it('should order by uniquename ascending', async () => {
            DataService.retrieveMultipleRecords.mockResolvedValue({ entities: [] });

            await CustomApiService.fetchAll();

            const qs = DataService.retrieveMultipleRecords.mock.calls[0][1];
            expect(qs).toContain('$orderby=uniquename asc');
        });
    });

    describe('fetchById', () => {
        it('should call DataService.retrieveRecord with correct entity and id', async () => {
            DataService.retrieveRecord.mockResolvedValue(createMockApi());

            await CustomApiService.fetchById('api-001');

            expect(DataService.retrieveRecord).toHaveBeenCalledWith(
                'customapi',
                'api-001',
                expect.stringContaining('$select=')
            );
        });

        it('should include expand in query', async () => {
            DataService.retrieveRecord.mockResolvedValue(createMockApi());

            await CustomApiService.fetchById('api-001');

            const qs = DataService.retrieveRecord.mock.calls[0][2];
            expect(qs).toContain('CustomAPIRequestParameters');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // CREATE
    // ═══════════════════════════════════════════════════════════

    describe('create', () => {
        it('should call DataService.createRecord with entity name', async () => {
            await CustomApiService.create({ uniquename: 'new_Api', displayname: 'Api' });

            expect(DataService.createRecord).toHaveBeenCalledWith(
                'customapi',
                expect.objectContaining({ uniquename: 'new_Api' }),
                {}
            );
        });

        it('should deep-insert request parameters when provided', async () => {
            const params = [{ uniquename: 'Param1', type: 10 }];
            await CustomApiService.create({ uniquename: 'new_Api' }, params);

            const payload = DataService.createRecord.mock.calls[0][1];
            expect(payload.CustomAPIRequestParameters).toEqual(params);
        });

        it('should deep-insert response properties when provided', async () => {
            const props = [{ uniquename: 'Prop1', type: 10 }];
            await CustomApiService.create({ uniquename: 'new_Api' }, [], props);

            const payload = DataService.createRecord.mock.calls[0][1];
            expect(payload.CustomAPIResponseProperties).toEqual(props);
        });

        it('should not include empty params/props arrays in payload', async () => {
            await CustomApiService.create({ uniquename: 'new_Api' });

            const payload = DataService.createRecord.mock.calls[0][1];
            expect(payload.CustomAPIRequestParameters).toBeUndefined();
            expect(payload.CustomAPIResponseProperties).toBeUndefined();
        });

        it('should pass MSCRM.SolutionUniqueName header when solutionUniqueName provided', async () => {
            await CustomApiService.create({ uniquename: 'new_Api' }, [], [], 'MySolution');

            expect(DataService.createRecord).toHaveBeenCalledWith(
                'customapi',
                expect.objectContaining({ uniquename: 'new_Api' }),
                { 'MSCRM.SolutionUniqueName': 'MySolution' }
            );
        });

        it('should pass empty headers when solutionUniqueName is empty', async () => {
            await CustomApiService.create({ uniquename: 'new_Api' }, [], [], '');

            expect(DataService.createRecord).toHaveBeenCalledWith(
                'customapi',
                expect.objectContaining({ uniquename: 'new_Api' }),
                {}
            );
        });
    });

    describe('addRequestParameter', () => {
        it('should create parameter with odata.bind to parent API', async () => {
            const param = { uniquename: 'InputName', type: 10 };
            await CustomApiService.addRequestParameter('api-001', param);

            expect(DataService.createRecord).toHaveBeenCalledWith(
                'customapirequestparameter',
                expect.objectContaining({
                    uniquename: 'InputName',
                    'CustomAPIId@odata.bind': '/customapis(api-001)'
                }),
                {}
            );
        });

        it('should pass MSCRM.SolutionUniqueName header when solutionUniqueName provided', async () => {
            const param = { uniquename: 'InputName', type: 10 };
            await CustomApiService.addRequestParameter('api-001', param, 'MySolution');

            expect(DataService.createRecord).toHaveBeenCalledWith(
                'customapirequestparameter',
                expect.objectContaining({ uniquename: 'InputName' }),
                { 'MSCRM.SolutionUniqueName': 'MySolution' }
            );
        });
    });

    describe('addResponseProperty', () => {
        it('should create property with odata.bind to parent API', async () => {
            const prop = { uniquename: 'OutputName', type: 10 };
            await CustomApiService.addResponseProperty('api-001', prop);

            expect(DataService.createRecord).toHaveBeenCalledWith(
                'customapiresponseproperty',
                expect.objectContaining({
                    uniquename: 'OutputName',
                    'CustomAPIId@odata.bind': '/customapis(api-001)'
                }),
                {}
            );
        });

        it('should pass MSCRM.SolutionUniqueName header when solutionUniqueName provided', async () => {
            const prop = { uniquename: 'OutputName', type: 10 };
            await CustomApiService.addResponseProperty('api-001', prop, 'MySolution');

            expect(DataService.createRecord).toHaveBeenCalledWith(
                'customapiresponseproperty',
                expect.objectContaining({ uniquename: 'OutputName' }),
                { 'MSCRM.SolutionUniqueName': 'MySolution' }
            );
        });
    });

    // ═══════════════════════════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════════════════════════

    describe('update', () => {
        it('should call DataService.updateRecord with correct params', async () => {
            await CustomApiService.update('api-001', { displayname: 'Updated' });

            expect(DataService.updateRecord).toHaveBeenCalledWith(
                'customapi', 'api-001', { displayname: 'Updated' }
            );
        });
    });

    describe('updateRequestParameter', () => {
        it('should update parameter record', async () => {
            await CustomApiService.updateRequestParameter('param-001', { description: 'New desc' });

            expect(DataService.updateRecord).toHaveBeenCalledWith(
                'customapirequestparameter', 'param-001', { description: 'New desc' }
            );
        });
    });

    describe('updateResponseProperty', () => {
        it('should update property record', async () => {
            await CustomApiService.updateResponseProperty('prop-001', { description: 'New desc' });

            expect(DataService.updateRecord).toHaveBeenCalledWith(
                'customapiresponseproperty', 'prop-001', { description: 'New desc' }
            );
        });
    });

    // ═══════════════════════════════════════════════════════════
    // DELETE
    // ═══════════════════════════════════════════════════════════

    describe('delete', () => {
        it('should delete the customapi record', async () => {
            await CustomApiService.delete('api-001');

            expect(DataService.deleteRecord).toHaveBeenCalledWith('customapi', 'api-001');
        });
    });

    describe('deleteRequestParameter', () => {
        it('should delete the parameter record', async () => {
            await CustomApiService.deleteRequestParameter('param-001');

            expect(DataService.deleteRecord).toHaveBeenCalledWith('customapirequestparameter', 'param-001');
        });
    });

    describe('deleteResponseProperty', () => {
        it('should delete the property record', async () => {
            await CustomApiService.deleteResponseProperty('prop-001');

            expect(DataService.deleteRecord).toHaveBeenCalledWith('customapiresponseproperty', 'prop-001');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // EXECUTE
    // ═══════════════════════════════════════════════════════════

    describe('execute', () => {
        let mockFetch;

        beforeEach(() => {
            mockFetch = vi.fn().mockResolvedValue({
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'application/json']]),
                text: vi.fn().mockResolvedValue('{"value": "ok"}')
            });
            vi.stubGlobal('fetch', mockFetch);
            vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) });
        });

        it('should use POST for actions', async () => {
            const api = createMockApi({ isfunction: false });

            await CustomApiService.execute(api);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('new_TestAction'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('should use GET for functions', async () => {
            const api = createMockApi({ isfunction: true });

            await CustomApiService.execute(api);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ method: 'GET' })
            );
        });

        it('should include custom headers', async () => {
            const api = createMockApi();

            await CustomApiService.execute(api, {}, '', { 'X-Custom': 'test' });

            const fetchOpts = mockFetch.mock.calls[0][1];
            expect(fetchOpts.headers['X-Custom']).toBe('test');
        });

        it('should execute an action as the impersonated user', async () => {
            // "Can this user run this API?" is the reason to execute one while impersonating;
            // answering as the signed-in user is worse than not answering.
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true, userId: 'user-123', userName: 'John Doe'
            });

            await CustomApiService.execute(createMockApi(), {});

            expect(mockFetch.mock.calls[0][1].headers.MSCRMCallerID).toBe('user-123');
        });

        it('should execute a function as the impersonated user', async () => {
            DataService.getImpersonationInfo.mockReturnValue({
                isImpersonating: true, userId: 'user-123', userName: 'John Doe'
            });

            await CustomApiService.execute(createMockApi({ isfunction: true }), {});

            expect(mockFetch.mock.calls[0][1].headers.MSCRMCallerID).toBe('user-123');
        });

        it('should send no impersonation header when not impersonating', async () => {
            await CustomApiService.execute(createMockApi(), {});

            expect(mockFetch.mock.calls[0][1].headers.MSCRMCallerID).toBeUndefined();
        });

        it('should include body for action with params', async () => {
            const api = createMockApi({
                CustomAPIRequestParameters: [
                    { uniquename: 'Name', type: 10, isoptional: false }
                ]
            });

            await CustomApiService.execute(api, { Name: 'test-value' });

            const fetchOpts = mockFetch.mock.calls[0][1];
            expect(fetchOpts.body).toContain('Name');
        });

        it('should return structured response with duration', async () => {
            vi.stubGlobal('performance', { now: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(150) });

            const api = createMockApi();
            const result = await CustomApiService.execute(api);

            expect(result).toHaveProperty('status', 200);
            expect(result).toHaveProperty('statusText', 'OK');
            expect(result).toHaveProperty('body');
            expect(result).toHaveProperty('duration');
            expect(result).toHaveProperty('headers');
        });

        it('should handle non-JSON responses gracefully', async () => {
            mockFetch.mockResolvedValue({
                status: 204,
                statusText: 'No Content',
                headers: new Map(),
                text: vi.fn().mockResolvedValue('')
            });

            const api = createMockApi();
            const result = await CustomApiService.execute(api);

            expect(result.status).toBe(204);
            expect(result.body).toBeNull();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // URL BUILDER
    // ═══════════════════════════════════════════════════════════

    describe('buildEndpointUrl', () => {
        it('should return action name for global action', () => {
            const api = createMockApi({ isfunction: false, bindingtype: 0 });

            const url = CustomApiService.buildEndpointUrl(api);

            expect(url).toBe('new_TestAction');
        });

        it('should return function name with parens for global function', () => {
            const api = createMockApi({
                uniquename: 'new_TestFunc',
                isfunction: true,
                bindingtype: 0,
                CustomAPIRequestParameters: []
            });

            const url = CustomApiService.buildEndpointUrl(api);

            expect(url).toBe('new_TestFunc()');
        });

        it('should return entity-bound action URL', () => {
            const api = createMockApi({
                isfunction: false,
                bindingtype: 1,
                boundentitylogicalname: 'account'
            });

            const url = CustomApiService.buildEndpointUrl(api, 'rec-001');

            expect(url).toBe('accounts(rec-001)/Microsoft.Dynamics.CRM.new_TestAction');
        });

        it('should return entity-bound function URL with parens', () => {
            const api = createMockApi({
                uniquename: 'new_TestFunc',
                isfunction: true,
                bindingtype: 1,
                boundentitylogicalname: 'account',
                CustomAPIRequestParameters: []
            });

            const url = CustomApiService.buildEndpointUrl(api, 'rec-001');

            expect(url).toBe('accounts(rec-001)/Microsoft.Dynamics.CRM.new_TestFunc()');
        });

        it('should return collection-bound action URL', () => {
            const api = createMockApi({
                isfunction: false,
                bindingtype: 2,
                boundentitylogicalname: 'account'
            });

            const url = CustomApiService.buildEndpointUrl(api);

            expect(url).toBe('accounts/Microsoft.Dynamics.CRM.new_TestAction');
        });

        it('should return collection-bound function URL', () => {
            const api = createMockApi({
                uniquename: 'new_TestFunc',
                isfunction: true,
                bindingtype: 2,
                boundentitylogicalname: 'account',
                CustomAPIRequestParameters: []
            });

            const url = CustomApiService.buildEndpointUrl(api);

            expect(url).toBe('accounts/Microsoft.Dynamics.CRM.new_TestFunc()');
        });

        it('should fallback entity set name when MetadataService returns null', () => {
            MetadataService.getEntitySetName.mockReturnValue(null);

            const api = createMockApi({
                isfunction: false,
                bindingtype: 1,
                boundentitylogicalname: 'myentity'
            });

            const url = CustomApiService.buildEndpointUrl(api, 'rec-001');

            expect(url).toContain('myentitys(');
        });

        it('should include function parameters in URL', () => {
            const api = createMockApi({
                uniquename: 'new_TestFunc',
                isfunction: true,
                bindingtype: 0,
                CustomAPIRequestParameters: [
                    { uniquename: 'Name', type: 10, isoptional: false }
                ]
            });

            const url = CustomApiService.buildEndpointUrl(api, '', { Name: 'hello' });

            expect(url).toContain('Name=@p0');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // REQUEST BODY BUILDER
    // ═══════════════════════════════════════════════════════════

    describe('buildRequestBody', () => {
        it('should return empty object when no params', () => {
            const api = createMockApi();

            const body = CustomApiService.buildRequestBody(api);

            expect(body).toEqual({});
        });

        it('should include provided parameter values', () => {
            const api = createMockApi({
                CustomAPIRequestParameters: [
                    { uniquename: 'Name', type: 10, isoptional: false },
                    { uniquename: 'Count', type: 7, isoptional: true }
                ]
            });

            const body = CustomApiService.buildRequestBody(api, { Name: 'test', Count: '5' });

            expect(body.Name).toBe('test');
            expect(body.Count).toBe(5);
        });

        it('should skip Target parameter', () => {
            const api = createMockApi({
                CustomAPIRequestParameters: [
                    { uniquename: 'Target', type: 5, isoptional: false },
                    { uniquename: 'Name', type: 10, isoptional: false }
                ]
            });

            const body = CustomApiService.buildRequestBody(api, { Target: 'id-123', Name: 'test' });

            expect(body.Target).toBeUndefined();
            expect(body.Name).toBe('test');
        });

        it('should skip empty/undefined parameter values', () => {
            const api = createMockApi({
                CustomAPIRequestParameters: [
                    { uniquename: 'Name', type: 10, isoptional: false },
                    { uniquename: 'Optional', type: 10, isoptional: true }
                ]
            });

            const body = CustomApiService.buildRequestBody(api, { Name: 'test' });

            expect(body.Name).toBe('test');
            expect(body.Optional).toBeUndefined();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // VALUE COERCION
    // ═══════════════════════════════════════════════════════════

    describe('_coerceParamValue', () => {
        it('should coerce Boolean from string', () => {
            expect(CustomApiService._coerceParamValue('true', 0)).toBe(true);
            expect(CustomApiService._coerceParamValue('false', 0)).toBe(false);
        });

        it('should coerce Boolean from boolean', () => {
            expect(CustomApiService._coerceParamValue(true, 0)).toBe(true);
        });

        it('should coerce Integer', () => {
            expect(CustomApiService._coerceParamValue('42', 7)).toBe(42);
        });

        it('should coerce Decimal/Float/Money', () => {
            expect(CustomApiService._coerceParamValue('3.14', 2)).toBeCloseTo(3.14);
            expect(CustomApiService._coerceParamValue('2.5', 6)).toBeCloseTo(2.5);
            expect(CustomApiService._coerceParamValue('100.50', 8)).toBeCloseTo(100.50);
        });

        it('should coerce Picklist', () => {
            expect(CustomApiService._coerceParamValue('3', 9)).toBe(3);
        });

        it('should parse Entity from JSON string', () => {
            const entity = '{"id": "abc"}';
            expect(CustomApiService._coerceParamValue(entity, 3)).toEqual({ id: 'abc' });
        });

        it('should return Entity object as-is', () => {
            const entity = { id: 'abc' };
            expect(CustomApiService._coerceParamValue(entity, 3)).toEqual({ id: 'abc' });
        });

        it('should parse EntityReference from JSON string', () => {
            const ref = '{"@odata.type": "Microsoft.Dynamics.CRM.account", "accountid": "123"}';
            const result = CustomApiService._coerceParamValue(ref, 5);
            expect(result).toHaveProperty('accountid', '123');
        });

        it('should return EntityReference object as-is', () => {
            const ref = { accountid: '123' };
            expect(CustomApiService._coerceParamValue(ref, 5)).toEqual(ref);
        });

        it('should parse StringArray from JSON', () => {
            expect(CustomApiService._coerceParamValue('["a","b"]', 11)).toEqual(['a', 'b']);
        });

        it('should return StringArray array as-is', () => {
            expect(CustomApiService._coerceParamValue(['a', 'b'], 11)).toEqual(['a', 'b']);
        });

        it('should wrap non-array StringArray value', () => {
            expect(CustomApiService._coerceParamValue(42, 11)).toEqual([42]);
        });

        it('should parse StringArray from comma-separated string', () => {
            expect(CustomApiService._coerceParamValue('a, b, c', 11)).toEqual(['a', 'b', 'c']);
        });

        it('should handle single value StringArray string', () => {
            expect(CustomApiService._coerceParamValue('a', 11)).toEqual(['a']);
        });

        it('should filter empty entries from StringArray', () => {
            expect(CustomApiService._coerceParamValue('a,,b', 11)).toEqual(['a', 'b']);
        });

        it('should return string for String type', () => {
            expect(CustomApiService._coerceParamValue('hello', 10)).toBe('hello');
        });

        it('should return value as-is for DateTime', () => {
            const dt = '2024-01-01T00:00:00Z';
            expect(CustomApiService._coerceParamValue(dt, 1)).toBe(dt);
        });

        it('should return value as-is for Guid', () => {
            const guid = '00000000-0000-0000-0000-000000000001';
            expect(CustomApiService._coerceParamValue(guid, 12)).toBe(guid);
        });

        it('should return 0 for non-numeric Integer input', () => {
            expect(CustomApiService._coerceParamValue('abc', 7)).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // CODE GENERATION
    // ═══════════════════════════════════════════════════════════

    describe('generateCodeSnippet', () => {
        it('should generate JavaScript snippet', () => {
            const api = createMockApi();
            const code = CustomApiService.generateCodeSnippet(api, {}, 'javascript');

            expect(code).toContain('fetch(url');
            expect(code).toContain('new_TestAction');
            expect(code).toContain('POST');
        });

        it('should generate C# snippet', () => {
            const api = createMockApi();
            const code = CustomApiService.generateCodeSnippet(api, {}, 'csharp');

            expect(code).toContain('OrganizationRequest');
            expect(code).toContain('new_TestAction');
        });

        it('should generate HTTP snippet', () => {
            const api = createMockApi();
            const code = CustomApiService.generateCodeSnippet(api, {}, 'http');

            expect(code).toContain('POST');
            expect(code).toContain('new_TestAction');
            expect(code).toContain('OData-MaxVersion');
        });

        it('should generate Power Automate snippet', () => {
            const api = createMockApi();
            const code = CustomApiService.generateCodeSnippet(api, {}, 'powerAutomate');

            expect(code).toContain('OpenApiConnection');
            expect(code).toContain('new_TestAction');
        });

        it('should default to JavaScript for unknown language', () => {
            const api = createMockApi();
            const code = CustomApiService.generateCodeSnippet(api, {}, 'unknown');

            expect(code).toContain('fetch(url');
        });

        it('should include parameter values in body for actions', () => {
            const api = createMockApi({
                CustomAPIRequestParameters: [
                    { uniquename: 'Name', type: 10, isoptional: false }
                ]
            });

            const code = CustomApiService.generateCodeSnippet(api, { Name: 'hello' }, 'javascript');

            expect(code).toContain('Name');
        });

        it('should generate GET for functions in JavaScript', () => {
            const api = createMockApi({ isfunction: true, CustomAPIRequestParameters: [] });

            const code = CustomApiService.generateCodeSnippet(api, {}, 'javascript');

            expect(code).toContain('GET');
        });

        it('should include response property reads in C#', () => {
            const api = createMockApi({
                CustomAPIResponseProperties: [
                    { uniquename: 'Result', type: 10, logicalentityname: '' }
                ]
            });

            const code = CustomApiService.generateCodeSnippet(api, {}, 'csharp');

            expect(code).toContain('response["Result"]');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // EXPORT / IMPORT
    // ═══════════════════════════════════════════════════════════

    describe('exportDefinition', () => {
        it('should export core fields without IDs', () => {
            const api = createMockApi({
                CustomAPIRequestParameters: [
                    { customapirequestparameterid: 'p1', uniquename: 'Param1', name: 'new_TestAction.Param1', displayname: 'Param1', description: '', type: 10, isoptional: false, logicalentityname: '' }
                ],
                CustomAPIResponseProperties: [
                    { customapiresponsepropertyid: 'r1', uniquename: 'Prop1', name: 'new_TestAction.Prop1', displayname: 'Prop1', description: '', type: 10, logicalentityname: '' }
                ]
            });

            const exported = CustomApiService.exportDefinition(api);

            expect(exported.uniquename).toBe('new_TestAction');
            expect(exported.customapiid).toBeUndefined();
            expect(exported.requestParameters).toHaveLength(1);
            expect(exported.requestParameters[0].customapirequestparameterid).toBeUndefined();
            expect(exported.responseProperties).toHaveLength(1);
            expect(exported.responseProperties[0].customapiresponsepropertyid).toBeUndefined();
        });

        it('should handle api with no params/props', () => {
            const api = createMockApi();

            const exported = CustomApiService.exportDefinition(api);

            expect(exported.requestParameters).toEqual([]);
            expect(exported.responseProperties).toEqual([]);
        });
    });

    describe('importDefinition', () => {
        it('should call create with parsed definition', async () => {
            const definition = {
                uniquename: 'imported_Api',
                displayname: 'Imported API',
                description: 'Test',
                requestParameters: [
                    { uniquename: 'Input1', type: 10 }
                ],
                responseProperties: [
                    { uniquename: 'Output1', type: 10 }
                ]
            };

            await CustomApiService.importDefinition(definition);

            expect(DataService.createRecord).toHaveBeenCalledWith(
                'customapi',
                expect.objectContaining({
                    uniquename: 'imported_Api',
                    CustomAPIRequestParameters: expect.arrayContaining([
                        expect.objectContaining({ uniquename: 'Input1' })
                    ]),
                    CustomAPIResponseProperties: expect.arrayContaining([
                        expect.objectContaining({ uniquename: 'Output1' })
                    ])
                }),
                {}
            );
        });

        it('should default optional fields', async () => {
            const definition = {
                uniquename: 'min_Api',
                displayname: 'Minimal'
            };

            await CustomApiService.importDefinition(definition);

            const payload = DataService.createRecord.mock.calls[0][1];
            expect(payload.bindingtype).toBe(0);
            expect(payload.isfunction).toBe(false);
            expect(payload.isprivate).toBe(false);
        });

        it('should auto-generate parameter name from api uniquename', async () => {
            const definition = {
                uniquename: 'my_Api',
                displayname: 'My API',
                requestParameters: [{ uniquename: 'Param1', type: 10 }]
            };

            await CustomApiService.importDefinition(definition);

            const payload = DataService.createRecord.mock.calls[0][1];
            expect(payload.CustomAPIRequestParameters[0].name).toBe('my_Api.Param1');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════════

    describe('getTypeLabel', () => {
        it('should return label for valid type code', () => {
            expect(CustomApiService.getTypeLabel(0)).toBe('Boolean');
            expect(CustomApiService.getTypeLabel(10)).toBe('String');
            expect(CustomApiService.getTypeLabel(12)).toBe('Guid');
        });

        it('should return Unknown for invalid type code', () => {
            expect(CustomApiService.getTypeLabel(99)).toBe('Unknown (99)');
        });
    });

    describe('getBindingLabel', () => {
        it('should return label for valid binding code', () => {
            expect(CustomApiService.getBindingLabel(0)).toBe('Global');
            expect(CustomApiService.getBindingLabel(1)).toBe('Entity');
            expect(CustomApiService.getBindingLabel(2)).toBe('EntityCollection');
        });

        it('should return Unknown for invalid code', () => {
            expect(CustomApiService.getBindingLabel(99)).toBe('Unknown (99)');
        });
    });

    describe('getProcessingLabel', () => {
        it('should return label for valid processing code', () => {
            expect(CustomApiService.getProcessingLabel(0)).toBe('None');
            expect(CustomApiService.getProcessingLabel(1)).toBe('Async Only');
        });

        it('should return Unknown for invalid code', () => {
            expect(CustomApiService.getProcessingLabel(99)).toBe('Unknown (99)');
        });
    });

    describe('generateDefaultParamValues', () => {
        it('should generate defaults for each parameter type', () => {
            const api = createMockApi({
                CustomAPIRequestParameters: [
                    { uniquename: 'Flag', type: 0 },
                    { uniquename: 'Count', type: 7 },
                    { uniquename: 'Name', type: 10 }
                ]
            });

            const defaults = CustomApiService.generateDefaultParamValues(api);

            expect(defaults.Flag).toBe(false);
            expect(defaults.Count).toBe(0);
            expect(defaults.Name).toBe('');
        });

        it('should generate fresh ISO timestamp for DateTime parameter', () => {
            const before = new Date().toISOString();
            const api = createMockApi({
                CustomAPIRequestParameters: [
                    { uniquename: 'ScheduledDate', type: 1 }
                ]
            });

            const defaults = CustomApiService.generateDefaultParamValues(api);
            const after = new Date().toISOString();

            expect(defaults.ScheduledDate).toBeTruthy();
            expect(defaults.ScheduledDate >= before).toBe(true);
            expect(defaults.ScheduledDate <= after).toBe(true);
        });

        it('should skip Target parameter', () => {
            const api = createMockApi({
                CustomAPIRequestParameters: [
                    { uniquename: 'Target', type: 5 },
                    { uniquename: 'Name', type: 10 }
                ]
            });

            const defaults = CustomApiService.generateDefaultParamValues(api);

            expect(defaults.Target).toBeUndefined();
            expect(defaults).toHaveProperty('Name');
        });

        it('should handle api with no params', () => {
            const api = createMockApi();

            const defaults = CustomApiService.generateDefaultParamValues(api);

            expect(defaults).toEqual({});
        });
    });
});
