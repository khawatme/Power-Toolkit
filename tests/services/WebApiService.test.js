/**
 * @file Comprehensive Tests for WebApiService
 * @module tests/services/WebApiService
 * @description Tests for low-level Web API CRUD operations and batch processing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebApiService } from '../../src/services/WebApiService.js';

describe('WebApiService', () => {
    // Mock webApiFetch function for use in tests
    let mockWebApiFetch;

    beforeEach(() => {
        vi.clearAllMocks();
        mockWebApiFetch = vi.fn();

        // Reset fetch to default successful behavior
        global.fetch.mockImplementation(() => createFetchResponse({ value: [] }));
    });

    describe('webApiFetch', () => {
        it('should make GET requests correctly', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({ value: [{ id: '1', name: 'Test' }] }));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            const result = await WebApiService.webApiFetch(
                'GET',
                'account',
                '?$select=name',
                null,
                {},
                mockGetEntitySetName,
                null
            );

            expect(global.fetch).toHaveBeenCalled();
            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[0]).toContain('accounts');
            expect(callArgs[0]).toContain('$select=name');
            expect(callArgs[1].method).toBe('GET');
        });

        it('should make POST requests with body correctly', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse(
                { id: '12345678-1234-1234-1234-123456789012' },
                { headers: { 'OData-EntityId': 'https://org.crm.dynamics.com/api/data/v9.2/accounts(12345678-1234-1234-1234-123456789012)' } }
            ));

            const mockGetEntitySetName = vi.fn((name) => name + 's');
            const data = { name: 'New Account' };

            await WebApiService.webApiFetch('POST', 'account', '', data, {}, mockGetEntitySetName, null);

            expect(global.fetch).toHaveBeenCalled();
            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[1].method).toBe('POST');
            expect(callArgs[1].body).toBe(JSON.stringify(data));
        });

        it('should make PATCH requests correctly', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({}));

            const mockGetEntitySetName = vi.fn((name) => name + 's');
            const data = { name: 'Updated Account' };

            await WebApiService.webApiFetch(
                'PATCH',
                'account(12345678-1234-1234-1234-123456789012)',
                '',
                data,
                {},
                mockGetEntitySetName,
                null
            );

            expect(global.fetch).toHaveBeenCalled();
            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[1].method).toBe('PATCH');
            expect(callArgs[1].body).toBe(JSON.stringify(data));
        });

        it('should make DELETE requests correctly', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse(null));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            await WebApiService.webApiFetch(
                'DELETE',
                'account(12345678-1234-1234-1234-123456789012)',
                '',
                null,
                {},
                mockGetEntitySetName,
                null
            );

            expect(global.fetch).toHaveBeenCalled();
            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[1].method).toBe('DELETE');
        });

        it('should add impersonation header when userId is provided', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({ value: [] }));

            const mockGetEntitySetName = vi.fn((name) => name + 's');
            const impersonatedUserId = '11111111-1111-1111-1111-111111111111';

            await WebApiService.webApiFetch('GET', 'account', '', null, {}, mockGetEntitySetName, impersonatedUserId);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[1].headers['MSCRMCallerID']).toBe(impersonatedUserId);
        });

        it('should not add impersonation header when userId is null', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({ value: [] }));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            await WebApiService.webApiFetch('GET', 'account', '', null, {}, mockGetEntitySetName, null);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[1].headers['MSCRMCallerID']).toBeUndefined();
        });

        it('should include custom headers', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({ value: [] }));

            const mockGetEntitySetName = vi.fn((name) => name + 's');
            const customHeaders = { 'Prefer': 'odata.include-annotations="*"' };

            await WebApiService.webApiFetch('GET', 'account', '', null, customHeaders, mockGetEntitySetName, null);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[1].headers['Prefer']).toBe('odata.include-annotations="*"');
        });

        it('should throw error on HTTP error response', async () => {
            global.fetch.mockImplementationOnce(() => createFetchError(404, 'Not Found'));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            await expect(
                WebApiService.webApiFetch('GET', 'account(invalid)', '', null, {}, mockGetEntitySetName, null)
            ).rejects.toThrow('HTTP 404 Not Found');
        });

        it('should include error details in thrown error', async () => {
            const odataError = { error: { message: 'Resource not found', code: '404' } };
            global.fetch.mockImplementationOnce(() => createFetchError(404, 'Not Found', odataError));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            try {
                await WebApiService.webApiFetch('GET', 'account(invalid)', '', null, {}, mockGetEntitySetName, null);
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error.status).toBe(404);
                expect(error.response).toBeDefined();
            }
        });

        it('should handle special endpoints without adding s suffix', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({ value: [] }));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            await WebApiService.webApiFetch('GET', 'EntityDefinitions', '', null, {}, mockGetEntitySetName, null);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[0]).toContain('EntityDefinitions');
            expect(callArgs[0]).not.toContain('EntityDefinitionss');
        });

        it('should handle queryString without leading ?', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({ value: [] }));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            await WebApiService.webApiFetch('GET', 'account', '$top=10', null, {}, mockGetEntitySetName, null);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[0]).toContain('?$top=10');
        });

        it('should handle queryString with leading ?', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({ value: [] }));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            await WebApiService.webApiFetch('GET', 'account', '?$top=10', null, {}, mockGetEntitySetName, null);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[0]).toContain('?$top=10');
            expect(callArgs[0]).not.toContain('??');
        });

        it('should extract ID from OData-EntityId header on create', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 204,
                statusText: 'No Content',
                headers: {
                    get: (name) => name === 'OData-EntityId'
                        ? 'https://org.crm.dynamics.com/api/data/v9.2/accounts(12345678-1234-1234-1234-123456789012)'
                        : null,
                },
                text: () => Promise.resolve(''),
            }));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            const result = await WebApiService.webApiFetch('POST', 'account', '', { name: 'Test' }, {}, mockGetEntitySetName, null);

            expect(result.id).toBe('12345678-1234-1234-1234-123456789012');
        });
    });

    describe('retrieveMultipleRecords', () => {
        it('should return entities array from response', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                value: [{ id: '1', name: 'Account 1' }, { id: '2', name: 'Account 2' }]
            });

            const result = await WebApiService.retrieveMultipleRecords(mockWebApiFetch, 'account', '?$top=10');

            expect(result.entities).toHaveLength(2);
            expect(result.entities[0].name).toBe('Account 1');
        });

        it('should return nextLink when present', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                value: [{ id: '1' }],
                '@odata.nextLink': 'https://org.crm.dynamics.com/api/data/v9.2/accounts?$top=10&$skiptoken=1'
            });

            const result = await WebApiService.retrieveMultipleRecords(mockWebApiFetch, 'account', '?$top=10');

            expect(result.nextLink).toBe('https://org.crm.dynamics.com/api/data/v9.2/accounts?$top=10&$skiptoken=1');
        });

        it('should return count when @odata.count is present', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                value: [{ id: '1' }],
                '@odata.count': 100
            });

            const result = await WebApiService.retrieveMultipleRecords(mockWebApiFetch, 'account', '?$count=true');

            expect(result.count).toBe(100);
        });

        it('should handle empty response', async () => {
            mockWebApiFetch.mockResolvedValueOnce({ value: [] });

            const result = await WebApiService.retrieveMultipleRecords(mockWebApiFetch, 'account', '');

            expect(result.entities).toEqual([]);
            expect(result.nextLink).toBeUndefined();
        });

        it('should pass custom headers', async () => {
            mockWebApiFetch.mockResolvedValueOnce({ value: [] });

            await WebApiService.retrieveMultipleRecords(mockWebApiFetch, 'account', '', { 'Prefer': 'maxpagesize=50' });

            expect(mockWebApiFetch).toHaveBeenCalledWith('GET', 'account', '', null, { 'Prefer': 'maxpagesize=50' });
        });
    });

    describe('retrieveRecord', () => {
        it('should retrieve single record by ID', async () => {
            mockWebApiFetch.mockResolvedValueOnce({ id: '123', name: 'Test Account' });

            const result = await WebApiService.retrieveRecord(mockWebApiFetch, 'account', '123', '?$select=name');

            expect(result.name).toBe('Test Account');
            expect(mockWebApiFetch).toHaveBeenCalledWith('GET', 'account(123)', '?$select=name');
        });

        it('should work without options', async () => {
            mockWebApiFetch.mockResolvedValueOnce({ id: '123' });

            await WebApiService.retrieveRecord(mockWebApiFetch, 'account', '123');

            expect(mockWebApiFetch).toHaveBeenCalledWith('GET', 'account(123)', '');
        });
    });

    describe('createRecord', () => {
        it('should create record and return ID', async () => {
            mockWebApiFetch.mockResolvedValueOnce({ id: '12345678-1234-1234-1234-123456789012' });

            const result = await WebApiService.createRecord(mockWebApiFetch, 'account', { name: 'New Account' });

            expect(result.id).toBe('12345678-1234-1234-1234-123456789012');
            expect(mockWebApiFetch).toHaveBeenCalledWith('POST', 'account', '', { name: 'New Account' });
        });
    });

    describe('updateRecord', () => {
        it('should update record by ID', async () => {
            mockWebApiFetch.mockResolvedValueOnce({});

            await WebApiService.updateRecord(mockWebApiFetch, 'account', '123', { name: 'Updated Name' });

            expect(mockWebApiFetch).toHaveBeenCalledWith('PATCH', 'account(123)', '', { name: 'Updated Name' });
        });
    });

    describe('deleteRecord', () => {
        it('should delete record by ID', async () => {
            mockWebApiFetch.mockResolvedValueOnce({});

            await WebApiService.deleteRecord(mockWebApiFetch, 'account', '123');

            expect(mockWebApiFetch).toHaveBeenCalledWith('DELETE', 'account(123)');
        });
    });

    describe('executeFetchXml', () => {
        it('should execute FetchXML query', async () => {
            mockWebApiFetch.mockResolvedValueOnce({ value: [{ id: '1', name: 'Test' }] });

            const fetchXml = '<fetch><entity name="account"><attribute name="name"/></entity></fetch>';
            const result = await WebApiService.executeFetchXml(mockWebApiFetch, 'account', fetchXml);

            expect(result.entities).toHaveLength(1);
            expect(mockWebApiFetch).toHaveBeenCalledWith(
                'GET',
                'account',
                expect.stringContaining('fetchXml='),
                null,
                {}
            );
        });

        it('should return paging cookie when present', async () => {
            mockWebApiFetch.mockResolvedValueOnce({
                value: [{ id: '1' }],
                '@Microsoft.Dynamics.CRM.fetchxmlpagingcookie': 'cookie123',
                '@Microsoft.Dynamics.CRM.morerecords': true
            });

            const result = await WebApiService.executeFetchXml(mockWebApiFetch, 'account', '<fetch></fetch>');

            expect(result.pagingCookie).toBe('cookie123');
            expect(result.moreRecords).toBe(true);
        });

        it('should URL-encode the FetchXML', async () => {
            mockWebApiFetch.mockResolvedValueOnce({ value: [] });

            const fetchXml = '<fetch><entity name="account"></entity></fetch>';
            await WebApiService.executeFetchXml(mockWebApiFetch, 'account', fetchXml);

            const callArgs = mockWebApiFetch.mock.calls[0];
            expect(callArgs[2]).toContain(encodeURIComponent('<fetch>'));
        });

        it('should pass custom headers', async () => {
            mockWebApiFetch.mockResolvedValueOnce({ value: [] });

            const customHeaders = { 'Prefer': 'odata.include-annotations="*"' };
            await WebApiService.executeFetchXml(mockWebApiFetch, 'account', '<fetch></fetch>', customHeaders);

            expect(mockWebApiFetch).toHaveBeenCalledWith(
                'GET',
                'account',
                expect.any(String),
                null,
                customHeaders
            );
        });
    });

    describe('getPluginTraceLogs', () => {
        it('should fetch plugin trace logs', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({
                value: [{ plugintracelogid: '1', messageblock: 'Test trace' }]
            }));

            const result = await WebApiService.getPluginTraceLogs('?$top=50', 50);

            expect(result.entities).toHaveLength(1);
            expect(result.entities[0].messageblock).toBe('Test trace');
        });

        it('should include page size in Prefer header', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({ value: [] }));

            await WebApiService.getPluginTraceLogs('', 100);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[1].headers['Prefer']).toBe('odata.maxpagesize=100');
        });

        it('should include impersonation header when provided', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({ value: [] }));

            await WebApiService.getPluginTraceLogs('', 50, '11111111-1111-1111-1111-111111111111');

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[1].headers['MSCRMCallerID']).toBe('11111111-1111-1111-1111-111111111111');
        });

        it('should return nextLink when present', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({
                value: [],
                '@odata.nextLink': 'https://org.crm.dynamics.com/api/data/v9.2/plugintracelogs?skiptoken=1'
            }));

            const result = await WebApiService.getPluginTraceLogs('', 50);

            expect(result.nextLink).toBe('https://org.crm.dynamics.com/api/data/v9.2/plugintracelogs?skiptoken=1');
        });

        it('should handle HTTP errors', async () => {
            global.fetch.mockImplementationOnce(() => createFetchError(401, 'Unauthorized'));

            await expect(WebApiService.getPluginTraceLogs('', 50)).rejects.toThrow('HTTP 401');
        });

        it('should handle queryString without leading ?', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({ value: [] }));

            await WebApiService.getPluginTraceLogs('$top=10', 50);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[0]).toContain('?$top=10');
        });
    });

    describe('executeBatch', () => {
        it('should return empty result for empty operations array', async () => {
            const result = await WebApiService.executeBatch([]);

            expect(result.successCount).toBe(0);
            expect(result.failCount).toBe(0);
            expect(result.errors).toEqual([]);
        });

        it('should return empty result for null operations', async () => {
            const result = await WebApiService.executeBatch(null);

            expect(result.successCount).toBe(0);
            expect(result.failCount).toBe(0);
        });

        it('should throw error when operations exceed 1000', async () => {
            const operations = Array(1001).fill({ method: 'PATCH', entitySet: 'accounts', id: '123', data: {} });

            await expect(WebApiService.executeBatch(operations)).rejects.toThrow('Batch operation limit exceeded');
        });

        it('should make batch request with correct boundary', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse('HTTP/1.1 200 OK'));

            const operations = [
                { method: 'PATCH', entitySet: 'accounts', id: '123', data: { name: 'Updated' } }
            ];

            await WebApiService.executeBatch(operations);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[0]).toContain('$batch');
            expect(callArgs[1].headers['Content-Type']).toContain('multipart/mixed; boundary=');
        });

        it('should count successful operations', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve(
                    '--batch_123\r\n' +
                    'Content-Type: application/http\r\n\r\n' +
                    'HTTP/1.1 204 No Content\r\n\r\n' +
                    '--batch_123\r\n' +
                    'Content-Type: application/http\r\n\r\n' +
                    'HTTP/1.1 204 No Content\r\n\r\n' +
                    '--batch_123--'
                ),
            }));

            const operations = [
                { method: 'PATCH', entitySet: 'accounts', id: '1', data: { name: 'A' } },
                { method: 'PATCH', entitySet: 'accounts', id: '2', data: { name: 'B' } }
            ];

            const result = await WebApiService.executeBatch(operations);

            expect(result.successCount).toBe(2);
            expect(result.failCount).toBe(0);
        });

        it('should count failed operations and collect errors', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve(
                    '--batch_123\r\n' +
                    'Content-Type: application/http\r\n\r\n' +
                    'HTTP/1.1 204 No Content\r\n\r\n' +
                    '--batch_123\r\n' +
                    'Content-Type: application/http\r\n\r\n' +
                    'HTTP/1.1 404 Not Found\r\n' +
                    '{"error":{"message":"Record not found"}}\r\n' +
                    '--batch_123--'
                ),
            }));

            const operations = [
                { method: 'PATCH', entitySet: 'accounts', id: '1', data: { name: 'A' } },
                { method: 'PATCH', entitySet: 'accounts', id: 'invalid', data: { name: 'B' } }
            ];

            const result = await WebApiService.executeBatch(operations);

            expect(result.successCount).toBe(1);
            expect(result.failCount).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].error).toContain('Record not found');
        });

        it('should include impersonation header when provided', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve('HTTP/1.1 204 No Content'),
            }));

            await WebApiService.executeBatch(
                [{ method: 'PATCH', entitySet: 'accounts', id: '1', data: {} }],
                '11111111-1111-1111-1111-111111111111'
            );

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[1].headers['MSCRMCallerID']).toBe('11111111-1111-1111-1111-111111111111');
        });

        it('should handle POST operations without id', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve('HTTP/1.1 201 Created'),
            }));

            const operations = [
                { method: 'POST', entitySet: 'accounts', data: { name: 'New Account' } }
            ];

            await WebApiService.executeBatch(operations);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[1].body).toContain('POST /api/data/v9.2/accounts');
            expect(callArgs[1].body).not.toContain('accounts(');
        });

        it('should handle DELETE operations', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve('HTTP/1.1 204 No Content'),
            }));

            const operations = [
                { method: 'DELETE', entitySet: 'accounts', id: '123' }
            ];

            await WebApiService.executeBatch(operations);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[1].body).toContain('DELETE /api/data/v9.2/accounts(123)');
        });

        it('should handle complete batch failure', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: false,
                status: 500,
                text: () => Promise.resolve('Internal Server Error'),
            }));

            const operations = [
                { method: 'PATCH', entitySet: 'accounts', id: '1', data: {} },
                { method: 'PATCH', entitySet: 'accounts', id: '2', data: {} }
            ];

            const result = await WebApiService.executeBatch(operations);

            expect(result.successCount).toBe(0);
            expect(result.failCount).toBe(2);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('error handling', () => {
        it('should handle network errors', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            await expect(
                WebApiService.webApiFetch('GET', 'account', '', null, {}, mockGetEntitySetName, null)
            ).rejects.toThrow('Network error');
        });

        it('should handle malformed JSON response', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: () => null },
                text: () => Promise.resolve('not valid json'),
            }));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            await expect(
                WebApiService.webApiFetch('GET', 'account', '', null, {}, mockGetEntitySetName, null)
            ).rejects.toThrow();
        });

        it('should handle empty response body on success', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 204,
                headers: { get: () => null },
                text: () => Promise.resolve(''),
            }));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            const result = await WebApiService.webApiFetch('DELETE', 'account(123)', '', null, {}, mockGetEntitySetName, null);

            expect(result).toEqual({});
        });
    });

    describe('entity set name resolution', () => {
        it('should use provided entity set name when available', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({ value: [] }));

            const mockGetEntitySetName = vi.fn((name) => {
                if (name === 'account') return 'accounts';
                return null;
            });

            await WebApiService.webApiFetch('GET', 'account', '', null, {}, mockGetEntitySetName, null);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[0]).toContain('accounts');
        });

        it('should fallback to adding s when entity set name not found', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({ value: [] }));

            const mockGetEntitySetName = vi.fn(() => null);

            await WebApiService.webApiFetch('GET', 'customentity', '', null, {}, mockGetEntitySetName, null);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[0]).toContain('customentitys');
        });

        it('should not double-add s if already ends with s', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({ value: [] }));

            const mockGetEntitySetName = vi.fn(() => null);

            await WebApiService.webApiFetch('GET', 'accounts', '', null, {}, mockGetEntitySetName, null);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[0]).toContain('accounts');
            expect(callArgs[0]).not.toContain('accountss');
        });

        it('should handle entity with record ID correctly', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({}));

            const mockGetEntitySetName = vi.fn((name) => {
                if (name === 'account') return 'accounts';
                return null;
            });

            await WebApiService.webApiFetch('GET', 'account(123)', '', null, {}, mockGetEntitySetName, null);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[0]).toContain('accounts(123)');
        });

        it('should handle entity with record ID when entity name already ends with s and no set name found', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({}));

            // Return null to trigger fallback logic
            const mockGetEntitySetName = vi.fn(() => null);

            await WebApiService.webApiFetch('GET', 'accounts(12345678-1234-1234-1234-123456789012)', '', null, {}, mockGetEntitySetName, null);

            const callArgs = global.fetch.mock.calls[0];
            // Should not double-add 's' since 'accounts' already ends with 's'
            expect(callArgs[0]).toContain('accounts(12345678-1234-1234-1234-123456789012)');
            expect(callArgs[0]).not.toContain('accountss');
        });

        it('should add s suffix to entity with record ID when entity does not end with s and no set name found', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({}));

            const mockGetEntitySetName = vi.fn(() => null);

            await WebApiService.webApiFetch('GET', 'contact(12345678-1234-1234-1234-123456789012)', '', null, {}, mockGetEntitySetName, null);

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[0]).toContain('contacts(12345678-1234-1234-1234-123456789012)');
        });

        it('should handle malformed entity path with parentheses that does not match pattern', async () => {
            global.fetch.mockImplementationOnce(() => createFetchResponse({}));

            const mockGetEntitySetName = vi.fn(() => null);

            // Malformed path - no match for regex pattern
            await WebApiService.webApiFetch('GET', '(invalidformat)', '', null, {}, mockGetEntitySetName, null);

            const callArgs = global.fetch.mock.calls[0];
            // Should return as-is when regex doesn't match
            expect(callArgs[0]).toContain('(invalidformat)');
        });
    });

    describe('UUID generation fallback', () => {
        it('should generate UUID using fallback when crypto.randomUUID is not available', async () => {
            // Use vi.stubGlobal to properly mock crypto
            const originalCrypto = global.crypto;
            vi.stubGlobal('crypto', undefined);

            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve('HTTP/1.1 204 No Content'),
            }));

            const operations = [
                { method: 'PATCH', entitySet: 'accounts', id: '123', data: { name: 'Test' } }
            ];

            const result = await WebApiService.executeBatch(operations);

            // Verify batch was called (which uses UUID generation)
            expect(global.fetch).toHaveBeenCalled();
            const callArgs = global.fetch.mock.calls[0];
            // Check that Content-Type contains a batch boundary (UUID was generated)
            expect(callArgs[1].headers['Content-Type']).toMatch(/multipart\/mixed; boundary="batch_[a-f0-9-]+"/);
            expect(result.successCount).toBe(1);

            // Restore original crypto
            vi.stubGlobal('crypto', originalCrypto);
        });

        it('should generate UUID using fallback when crypto exists but randomUUID is not a function', async () => {
            const originalCrypto = global.crypto;
            vi.stubGlobal('crypto', { randomUUID: undefined });

            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve('HTTP/1.1 204 No Content'),
            }));

            const operations = [
                { method: 'POST', entitySet: 'contacts', data: { firstname: 'Test' } }
            ];

            const result = await WebApiService.executeBatch(operations);

            expect(global.fetch).toHaveBeenCalled();
            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[1].headers['Content-Type']).toContain('multipart/mixed; boundary=');
            expect(result.successCount).toBe(1);

            vi.stubGlobal('crypto', originalCrypto);
        });

        it('should generate valid UUID format using fallback', async () => {
            const originalCrypto = global.crypto;
            vi.stubGlobal('crypto', {});

            global.fetch.mockImplementationOnce((url, options) => {
                // Extract the boundary from Content-Type header
                const contentType = options.headers['Content-Type'];
                const boundaryMatch = contentType.match(/boundary="batch_([^"]+)"/);
                expect(boundaryMatch).not.toBeNull();
                // Verify UUID-like format (8-4-4-4-12)
                const uuid = boundaryMatch[1];
                expect(uuid).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);

                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('HTTP/1.1 204 No Content'),
                });
            });

            await WebApiService.executeBatch([{ method: 'DELETE', entitySet: 'leads', id: '456' }]);

            vi.stubGlobal('crypto', originalCrypto);
        });
    });

    describe('batch error handling edge cases', () => {
        it('should handle batch failure with no status matches and non-ok response', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: false,
                status: 500,
                text: () => Promise.resolve('Server error occurred - no HTTP status lines in body'),
            }));

            const operations = [
                { method: 'PATCH', entitySet: 'accounts', id: '1', data: { name: 'A' } },
                { method: 'PATCH', entitySet: 'accounts', id: '2', data: { name: 'B' } },
                { method: 'PATCH', entitySet: 'accounts', id: '3', data: { name: 'C' } }
            ];

            const result = await WebApiService.executeBatch(operations);

            expect(result.successCount).toBe(0);
            expect(result.failCount).toBe(3); // All operations counted as failed
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].index).toBe(-1);
            expect(result.errors[0].error).toContain('Batch request failed: HTTP 500');
        });

        it('should include response body excerpt in batch failure error', async () => {
            const errorMessage = 'Detailed error message from server about what went wrong';
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: false,
                status: 503,
                text: () => Promise.resolve(errorMessage),
            }));

            const operations = [{ method: 'DELETE', entitySet: 'accounts', id: '1' }];

            const result = await WebApiService.executeBatch(operations);

            expect(result.errors[0].error).toContain('HTTP 503');
            expect(result.errors[0].error).toContain(errorMessage);
        });

        it('should truncate long error body to 500 characters', async () => {
            const longErrorMessage = 'A'.repeat(600);
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: false,
                status: 400,
                text: () => Promise.resolve(longErrorMessage),
            }));

            const operations = [{ method: 'PATCH', entitySet: 'accounts', id: '1', data: {} }];

            const result = await WebApiService.executeBatch(operations);

            // Error body should be truncated to 500 chars
            expect(result.errors[0].error.length).toBeLessThanOrEqual(500 + 50); // Account for prefix text
        });

        it('should handle mixed success and failure in batch with error messages', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve(
                    '--batch_123\r\n' +
                    'Content-Type: application/http\r\n\r\n' +
                    'HTTP/1.1 204 No Content\r\n\r\n' +
                    '--batch_123\r\n' +
                    'Content-Type: application/http\r\n\r\n' +
                    'HTTP/1.1 403 Forbidden\r\n' +
                    '{"error":{"message":"Access denied for this operation"}}\r\n' +
                    '--batch_123\r\n' +
                    'Content-Type: application/http\r\n\r\n' +
                    'HTTP/1.1 201 Created\r\n\r\n' +
                    '--batch_123--'
                ),
            }));

            const operations = [
                { method: 'PATCH', entitySet: 'accounts', id: '1', data: { name: 'Update1' } },
                { method: 'DELETE', entitySet: 'accounts', id: '2' },
                { method: 'POST', entitySet: 'accounts', data: { name: 'New' } }
            ];

            const result = await WebApiService.executeBatch(operations);

            expect(result.successCount).toBe(2);
            expect(result.failCount).toBe(1);
            expect(result.errors[0].error).toBe('Access denied for this operation');
        });

        it('should handle failure without message property in error', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve(
                    '--batch_123\r\n' +
                    'Content-Type: application/http\r\n\r\n' +
                    'HTTP/1.1 500 Internal Server Error\r\n\r\n' +
                    '--batch_123--'
                ),
            }));

            const operations = [{ method: 'PATCH', entitySet: 'accounts', id: '1', data: {} }];

            const result = await WebApiService.executeBatch(operations);

            expect(result.failCount).toBe(1);
            expect(result.errors[0].error).toBe('HTTP 500');
        });

        it('should assume all operations succeeded when no status codes but response is ok', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve('Some response without HTTP status lines'),
            }));

            const operations = [
                { method: 'PATCH', entitySet: 'accounts', id: '1', data: {} },
                { method: 'PATCH', entitySet: 'accounts', id: '2', data: {} }
            ];

            const result = await WebApiService.executeBatch(operations);

            expect(result.successCount).toBe(2);
            expect(result.failCount).toBe(0);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('getPluginTraceLogs edge cases', () => {
        it('should handle empty response text', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve(''),
                headers: { get: () => null }
            }));

            const result = await WebApiService.getPluginTraceLogs('', 50);

            expect(result.entities).toEqual([]);
        });

        it('should handle response without value property', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve('{}'),
                headers: { get: () => null }
            }));

            const result = await WebApiService.getPluginTraceLogs('', 50);

            expect(result.entities).toEqual([]);
        });
    });

    describe('webApiFetch response parsing', () => {
        it('should return id when OData-EntityId header present but body is empty', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 204,
                statusText: 'No Content',
                headers: {
                    get: (name) => name === 'OData-EntityId'
                        ? 'https://org.crm.dynamics.com/api/data/v9.2/contacts(abcd1234-abcd-1234-abcd-1234567890ab)'
                        : null,
                },
                text: () => Promise.resolve(''),
            }));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            const result = await WebApiService.webApiFetch('POST', 'contact', '', { firstname: 'John' }, {}, mockGetEntitySetName, null);

            expect(result.id).toBe('abcd1234-abcd-1234-abcd-1234567890ab');
        });

        it('should return empty object when no body and no OData-EntityId header', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 204,
                statusText: 'No Content',
                headers: {
                    get: () => null,
                },
                text: () => Promise.resolve(''),
            }));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            const result = await WebApiService.webApiFetch('DELETE', 'account(123)', '', null, {}, mockGetEntitySetName, null);

            expect(result).toEqual({});
        });
    });

    describe('error body reading edge cases', () => {
        it('should handle error response when text() throws an exception', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                headers: {
                    get: () => null,
                },
                text: () => Promise.reject(new Error('Failed to read body')),
            }));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            await expect(
                WebApiService.webApiFetch('GET', 'account', '', null, {}, mockGetEntitySetName, null)
            ).rejects.toThrow('HTTP 500 Internal Server Error');
        });

        it('should return empty body in error when text() fails', async () => {
            global.fetch.mockImplementationOnce(() => Promise.resolve({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                headers: {
                    get: () => null,
                },
                text: () => Promise.reject(new Error('Stream already read')),
            }));

            const mockGetEntitySetName = vi.fn((name) => name + 's');

            try {
                await WebApiService.webApiFetch('GET', 'missingrecord(123)', '', null, {}, mockGetEntitySetName, null);
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error.status).toBe(404);
                expect(error.response.data).toBe('');
            }
        });
    });
});
