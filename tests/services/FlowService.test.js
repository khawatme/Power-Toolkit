/**
 * @file Tests for FlowService
 * @module tests/services/FlowService.test.js
 * @description Tests for the Power Automate cloud flow operations service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlowService } from '../../src/services/FlowService.js';

describe('FlowService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getCloudFlows', () => {
        it('should return mapped flow objects for valid response', async () => {
            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [
                    {
                        workflowid: 'flow-1',
                        name: 'My Test Flow',
                        description: 'A test flow',
                        statecode: 1,
                        'statecode@OData.Community.Display.V1.FormattedValue': 'Activated',
                        ismanaged: false,
                        '_ownerid_value@OData.Community.Display.V1.FormattedValue': 'John Doe',
                        'createdon@OData.Community.Display.V1.FormattedValue': '1/1/2026',
                        'modifiedon@OData.Community.Display.V1.FormattedValue': '1/5/2026',
                        '_createdby_value@OData.Community.Display.V1.FormattedValue': 'Jane Doe',
                        createdon: '2026-01-01',
                        modifiedon: '2026-01-05'
                    }
                ]
            });

            const result = await FlowService.getCloudFlows(executeFetchXml);

            expect(executeFetchXml).toHaveBeenCalledWith('workflows', expect.any(String), expect.any(Object));
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                id: 'flow-1',
                name: 'My Test Flow',
                description: 'A test flow',
                statecode: 1,
                stateLabel: 'Activated',
                isManaged: false,
                owner: 'John Doe',
                createdOn: '1/1/2026',
                modifiedOn: '1/5/2026',
                createdBy: 'Jane Doe',
                clientData: null,
                modernFlowType: null,
                isAgentFlow: false
            });
        });

        it('should flag Copilot Studio agent flows via modernflowtype=1', async () => {
            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [
                    { workflowid: 'wf-agent', name: 'Agent Flow', modernflowtype: 1 },
                    { workflowid: 'wf-classic', name: 'Classic Flow', modernflowtype: 0 }
                ]
            });

            const result = await FlowService.getCloudFlows(executeFetchXml);

            expect(result.find(f => f.id === 'wf-agent').isAgentFlow).toBe(true);
            expect(result.find(f => f.id === 'wf-classic').isAgentFlow).toBe(false);
            // The query must request the modernflowtype attribute.
            expect(executeFetchXml.mock.calls[0][1]).toContain('modernflowtype');
        });

        it('should return empty array when no entities returned', async () => {
            const executeFetchXml = vi.fn().mockResolvedValue({ entities: [] });

            const result = await FlowService.getCloudFlows(executeFetchXml);

            expect(result).toEqual([]);
        });

        it('should return empty array when entities property is missing', async () => {
            const executeFetchXml = vi.fn().mockResolvedValue({});

            const result = await FlowService.getCloudFlows(executeFetchXml);

            expect(result).toEqual([]);
        });

        it('should use fallback state label when formatted value missing', async () => {
            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [
                    {
                        workflowid: 'flow-2',
                        name: 'Draft Flow',
                        statecode: 0,
                        ismanaged: true,
                        createdon: '2026-01-01',
                        modifiedon: '2026-01-01'
                    }
                ]
            });

            const result = await FlowService.getCloudFlows(executeFetchXml);

            expect(result[0].stateLabel).toBe('Draft');
            expect(result[0].isManaged).toBe(true);
        });

        it('should handle suspended state', async () => {
            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [{ workflowid: 'flow-s', name: 'Suspended', statecode: 2, createdon: '', modifiedon: '' }]
            });

            const result = await FlowService.getCloudFlows(executeFetchXml);

            expect(result[0].stateLabel).toBe('Suspended');
        });

        it('should handle unknown statecode fallback', async () => {
            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [{ workflowid: 'flow-u', name: 'Unknown', statecode: 99, createdon: '', modifiedon: '' }]
            });

            const result = await FlowService.getCloudFlows(executeFetchXml);

            expect(result[0].stateLabel).toBe('Unknown');
        });

        it('should use (unnamed) for flow without name', async () => {
            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [{ workflowid: 'flow-n', statecode: 0, createdon: '', modifiedon: '' }]
            });

            const result = await FlowService.getCloudFlows(executeFetchXml);

            expect(result[0].name).toBe('(unnamed)');
        });

        it('should include category=5 and type=1 in FetchXML', async () => {
            const executeFetchXml = vi.fn().mockResolvedValue({ entities: [] });

            await FlowService.getCloudFlows(executeFetchXml);

            const fetchXml = executeFetchXml.mock.calls[0][1];
            expect(fetchXml).toContain('value="5"');
            expect(fetchXml).toContain('value="1"');
        });

        it('should request formatted value annotations', async () => {
            const executeFetchXml = vi.fn().mockResolvedValue({ entities: [] });

            await FlowService.getCloudFlows(executeFetchXml);

            const headers = executeFetchXml.mock.calls[0][2];
            expect(headers.Prefer).toContain('odata.include-annotations');
        });

        it('should default empty strings for missing owner/dates', async () => {
            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [{ workflowid: 'flow-e', name: 'Empty', statecode: 0 }]
            });

            const result = await FlowService.getCloudFlows(executeFetchXml);

            expect(result[0].owner).toBe('');
            expect(result[0].createdOn).toBe('');
            expect(result[0].modifiedOn).toBe('');
            expect(result[0].createdBy).toBe('');
            expect(result[0].description).toBe('');
        });

        it('should set clientData to null (lazy loaded)', async () => {
            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [{ workflowid: 'flow-c', name: 'Test', statecode: 1, createdon: '', modifiedon: '' }]
            });

            const result = await FlowService.getCloudFlows(executeFetchXml);

            expect(result[0].clientData).toBeNull();
        });
    });

    describe('getFlowDefinition', () => {
        it('should return clientdata for a valid flow', async () => {
            const clientDataJson = '{"properties":{"definition":{"triggers":{}}}}';
            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [{ clientdata: clientDataJson }]
            });

            const result = await FlowService.getFlowDefinition(executeFetchXml, 'flow-123');

            expect(result).toBe(clientDataJson);
            const fetchXml = executeFetchXml.mock.calls[0][1];
            expect(fetchXml).toContain('flow-123');
        });

        it('should return null when no entity found', async () => {
            const executeFetchXml = vi.fn().mockResolvedValue({ entities: [] });

            const result = await FlowService.getFlowDefinition(executeFetchXml, 'flow-missing');

            expect(result).toBeNull();
        });

        it('should return null when clientdata is empty', async () => {
            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [{ clientdata: null }]
            });

            const result = await FlowService.getFlowDefinition(executeFetchXml, 'flow-null');

            expect(result).toBeNull();
        });

        it('should return null when response has no entities key', async () => {
            const executeFetchXml = vi.fn().mockResolvedValue({});

            const result = await FlowService.getFlowDefinition(executeFetchXml, 'flow-no-ent');

            expect(result).toBeNull();
        });
    });

    describe('setFlowState', () => {
        it('should activate a flow with correct state values', async () => {
            const updateRecord = vi.fn().mockResolvedValue({ success: true });

            const result = await FlowService.setFlowState(updateRecord, 'flow-on', true);

            expect(updateRecord).toHaveBeenCalledWith('workflows', 'flow-on', {
                statecode: 1,
                statuscode: 2
            });
            expect(result).toEqual({ success: true });
        });

        it('should deactivate a flow with correct state values', async () => {
            const updateRecord = vi.fn().mockResolvedValue({ success: true });

            const result = await FlowService.setFlowState(updateRecord, 'flow-off', false);

            expect(updateRecord).toHaveBeenCalledWith('workflows', 'flow-off', {
                statecode: 0,
                statuscode: 1
            });
            expect(result).toEqual({ success: true });
        });

        it('should propagate error on activation failure', async () => {
            const updateRecord = vi.fn().mockRejectedValue(new Error('Activate failed'));

            await expect(FlowService.setFlowState(updateRecord, 'flow-err', true))
                .rejects.toThrow('Activate failed');
        });

        it('should propagate error on deactivation failure', async () => {
            const updateRecord = vi.fn().mockRejectedValue(new Error('Deactivate failed'));

            await expect(FlowService.setFlowState(updateRecord, 'flow-err', false))
                .rejects.toThrow('Deactivate failed');
        });

        it('should handle truthy activate value', async () => {
            const updateRecord = vi.fn().mockResolvedValue({});
            await FlowService.setFlowState(updateRecord, 'flow-id', 1);
            expect(updateRecord).toHaveBeenCalledWith('workflows', 'flow-id', {
                statecode: 1, statuscode: 2
            });
        });

        it('should handle falsy activate value', async () => {
            const updateRecord = vi.fn().mockResolvedValue({});
            await FlowService.setFlowState(updateRecord, 'flow-id', 0);
            expect(updateRecord).toHaveBeenCalledWith('workflows', 'flow-id', {
                statecode: 0, statuscode: 1
            });
        });
    });

    describe('deleteFlow', () => {
        it('should delete a flow by ID', async () => {
            const deleteRecord = vi.fn().mockResolvedValue({ success: true });

            const result = await FlowService.deleteFlow(deleteRecord, 'flow-del');

            expect(deleteRecord).toHaveBeenCalledWith('workflows', 'flow-del');
            expect(result).toEqual({ success: true });
        });

        it('should propagate error on delete failure', async () => {
            const deleteRecord = vi.fn().mockRejectedValue(new Error('Delete failed'));

            await expect(FlowService.deleteFlow(deleteRecord, 'flow-err'))
                .rejects.toThrow('Delete failed');
        });

        it('should return undefined result when deleteRecord returns undefined', async () => {
            const deleteRecord = vi.fn().mockResolvedValue(undefined);

            const result = await FlowService.deleteFlow(deleteRecord, 'flow-undef');

            expect(result).toBeUndefined();
        });
    });

    describe('getSolutionsWithFlows', () => {
        it('should return only solutions that contain workflow components', async () => {
            const webApiFetch = vi.fn()
                .mockResolvedValueOnce({
                    value: [
                        { solutionid: 'sol-1', friendlyname: 'Solution 1', uniquename: 'sol1', ismanaged: false },
                        { solutionid: 'sol-2', friendlyname: 'Solution 2', uniquename: 'sol2', ismanaged: true },
                        { solutionid: 'sol-3', friendlyname: 'Solution 3', uniquename: 'sol3', ismanaged: false }
                    ]
                })
                .mockResolvedValueOnce({
                    value: [
                        { solutioncomponentid: 'sc-1', _solutionid_value: 'sol-1', objectid: 'flow-1' },
                        { solutioncomponentid: 'sc-2', _solutionid_value: 'sol-3', objectid: 'flow-2' }
                    ]
                });

            const result = await FlowService.getSolutionsWithFlows(webApiFetch);

            expect(result).toHaveLength(2);
            expect(result[0].solutionid).toBe('sol-1');
            expect(result[1].solutionid).toBe('sol-3');
        });

        it('should return empty array when no solutions exist', async () => {
            const webApiFetch = vi.fn()
                .mockResolvedValueOnce({ value: [] })
                .mockResolvedValueOnce({ value: [] });

            const result = await FlowService.getSolutionsWithFlows(webApiFetch);

            expect(result).toEqual([]);
        });

        it('should handle missing value in response', async () => {
            const webApiFetch = vi.fn()
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({});

            const result = await FlowService.getSolutionsWithFlows(webApiFetch);

            expect(result).toEqual([]);
        });

        it('should query solutioncomponents with componenttype=29', async () => {
            const webApiFetch = vi.fn()
                .mockResolvedValueOnce({ value: [{ solutionid: 'sol-1', friendlyname: 'S1', uniquename: 's1', ismanaged: false }] })
                .mockResolvedValueOnce({ value: [{ _solutionid_value: 'sol-1', objectid: 'flow-1' }] });

            await FlowService.getSolutionsWithFlows(webApiFetch);

            // Second call should be for solutioncomponents
            expect(webApiFetch).toHaveBeenCalledTimes(2);
            const secondCallQuery = webApiFetch.mock.calls[1][2];
            expect(secondCallQuery).toContain('componenttype eq 29');
        });
    });

    describe('getCloudFlowsBySolution', () => {
        it('should return flows for specified solution', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({
                value: [
                    { objectid: 'flow-1' },
                    { objectid: 'flow-2' }
                ]
            });

            const executeFetchXml = vi.fn().mockResolvedValue({
                entities: [
                    {
                        workflowid: 'flow-1',
                        name: 'Flow 1',
                        statecode: 1,
                        ismanaged: false,
                        createdon: '2026-01-01',
                        modifiedon: '2026-01-05'
                    },
                    {
                        workflowid: 'flow-2',
                        name: 'Flow 2',
                        statecode: 0,
                        ismanaged: true,
                        createdon: '2026-02-01',
                        modifiedon: '2026-02-05'
                    }
                ]
            });

            const result = await FlowService.getCloudFlowsBySolution(executeFetchXml, webApiFetch, 'sol-1');

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('flow-1');
            expect(result[1].id).toBe('flow-2');
        });

        it('should return empty array when solution has no workflow components', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({ value: [] });
            const executeFetchXml = vi.fn();

            const result = await FlowService.getCloudFlowsBySolution(executeFetchXml, webApiFetch, 'sol-empty');

            expect(result).toEqual([]);
            expect(executeFetchXml).not.toHaveBeenCalled();
        });

        it('should handle missing value property in solutioncomponent response', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({});
            const executeFetchXml = vi.fn();

            const result = await FlowService.getCloudFlowsBySolution(executeFetchXml, webApiFetch, 'sol-missing');

            expect(result).toEqual([]);
        });

        it('should query workflow ids in chunks for large solutions and merge the results', async () => {
            // 250 component ids → 3 chunks (100 / 100 / 50). A single query would blow the URL limit.
            const componentIds = Array.from({ length: 250 }, (_, i) => ({ objectid: `flow-${i}` }));
            const webApiFetch = vi.fn().mockResolvedValue({ value: componentIds });
            const executeFetchXml = vi.fn().mockImplementation((_entity, fetchXml) => {
                const count = (fetchXml.match(/<value>/g) || []).length;
                return Promise.resolve({
                    entities: Array.from({ length: count }, (_, i) => ({ workflowid: `w-${i}`, name: `Flow ${i}` }))
                });
            });

            const result = await FlowService.getCloudFlowsBySolution(executeFetchXml, webApiFetch, 'sol-big');

            expect(executeFetchXml).toHaveBeenCalledTimes(3);
            expect(result).toHaveLength(250);
            // Each chunk uses the compact `in` operator with <value> children, not one giant or-filter.
            expect(executeFetchXml.mock.calls[0][1]).toContain('operator="in"');
        });
    });

    describe('updateFlowDefinition', () => {
        it('should update the clientdata field for a flow', async () => {
            const updateRecord = vi.fn().mockResolvedValue({ success: true });
            const newJson = '{"properties":{"definition":{}}}';

            const result = await FlowService.updateFlowDefinition(updateRecord, 'flow-update', newJson);

            expect(updateRecord).toHaveBeenCalledWith('workflows', 'flow-update', {
                clientdata: newJson
            });
            expect(result).toEqual({ success: true });
        });

        it('should propagate error on update failure', async () => {
            const updateRecord = vi.fn().mockRejectedValue(new Error('Update failed'));

            await expect(FlowService.updateFlowDefinition(updateRecord, 'flow-err', '{}'))
                .rejects.toThrow('Update failed');
        });
    });

    describe('getFlowRuns', () => {
        it('should query flowrun filtered by the workflow id and map the results', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({
                value: [
                    {
                        flowrunid: 'run-1',
                        name: '08580000000',
                        status: 'Succeeded',
                        triggertype: 'Automated',
                        starttime: '2026-06-28T10:00:00Z',
                        'starttime@OData.Community.Display.V1.FormattedValue': '6/28/2026 10:00 AM',
                        endtime: '2026-06-28T10:00:02Z',
                        duration: 2000,
                        isprimary: 1,
                        modernflowtype: 0
                    }
                ]
            });

            const result = await FlowService.getFlowRuns(webApiFetch, 'wf-1');

            expect(webApiFetch).toHaveBeenCalledTimes(1);
            const [method, entity, query] = webApiFetch.mock.calls[0];
            expect(method).toBe('GET');
            expect(entity).toBe('flowrun');
            expect(query).toContain('_workflow_value eq wf-1');
            expect(query).toContain('$orderby=starttime desc');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                id: 'run-1',
                runId: '08580000000',
                status: 'Succeeded',
                statusKey: 'succeeded',
                triggerType: 'Automated',
                startTimeLabel: '6/28/2026 10:00 AM',
                durationMs: 2000,
                durationText: '2.0s',
                isPrimary: true
            });
        });

        it('should add a status filter when provided and escape single quotes', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({ value: [] });

            await FlowService.getFlowRuns(webApiFetch, 'wf-1', { status: 'Failed', top: 10 });

            const query = webApiFetch.mock.calls[0][2];
            expect(query).toContain("status eq 'Failed'");
            expect(query).toContain('$top=10');
        });

        it('should fall back to ordering by createdon when starttime ordering is rejected', async () => {
            const webApiFetch = vi.fn()
                .mockRejectedValueOnce(new Error('orderby not supported'))
                .mockResolvedValueOnce({ value: [{ flowrunid: 'r', name: 'r', status: 'Running' }] });

            const result = await FlowService.getFlowRuns(webApiFetch, 'wf-1');

            expect(webApiFetch).toHaveBeenCalledTimes(2);
            expect(webApiFetch.mock.calls[1][2]).toContain('$orderby=createdon desc');
            expect(result[0].statusKey).toBe('running');
        });

        it('should normalize known status variants and default unknown to other', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({
                value: [
                    { flowrunid: '1', name: '1', status: 'Cancelled' },
                    { flowrunid: '2', name: '2', status: 'Faulted' }
                ]
            });

            const result = await FlowService.getFlowRuns(webApiFetch, 'wf-1');

            expect(result[0].statusKey).toBe('cancelled');
            expect(result[1].statusKey).toBe('other');
        });

        it('should return an empty array when no runs exist', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({});

            const result = await FlowService.getFlowRuns(webApiFetch, 'wf-1');

            expect(result).toEqual([]);
        });

        it('should parse the JSON rollup errormessage into a clean message + code, keeping the raw text', async () => {
            const raw = '{\r\n  "code": "ActionFailed",\r\n  "message": "An action failed. No dependent actions succeeded.",\r\n  "messageTemplate": "An action failed. No dependent actions succeeded."\r\n}';
            const webApiFetch = vi.fn().mockResolvedValue({
                value: [{ flowrunid: 'run-x', name: 'run-x', status: 'Failed', errorcode: 'ActionFailed', errormessage: raw }]
            });

            const result = await FlowService.getFlowRuns(webApiFetch, 'wf-1');

            expect(result[0].errorCode).toBe('ActionFailed');
            expect(result[0].errorMessage).toBe('An action failed. No dependent actions succeeded.');
            expect(result[0].errorMessage).not.toContain('{');
            expect(result[0].errorRaw).toBe(raw);
        });

        it('should keep a non-JSON errormessage as-is', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({
                value: [{ flowrunid: 'r', name: 'r', status: 'Failed', errorcode: 'BadGateway', errormessage: 'Upstream timed out' }]
            });

            const result = await FlowService.getFlowRuns(webApiFetch, 'wf-1');

            expect(result[0].errorCode).toBe('BadGateway');
            expect(result[0].errorMessage).toBe('Upstream timed out');
        });
    });

    describe('getFlowRunLogs', () => {
        it('should query flowlog filtered by the run id and map the results', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({
                value: [
                    {
                        flowlogid: 'log-1',
                        name: 'Initialize variable',
                        'type@OData.Community.Display.V1.FormattedValue': 'CustomLog',
                        'level@OData.Community.Display.V1.FormattedValue': 'Info',
                        duration: 500,
                        logindex: 0,
                        data: '{"ok":true}'
                    }
                ]
            });

            const result = await FlowService.getFlowRunLogs(webApiFetch, 'run-1');

            const [method, entity, query] = webApiFetch.mock.calls[0];
            expect(method).toBe('GET');
            expect(entity).toBe('flowlog');
            expect(query).toContain('_cloudflowrunid_value eq run-1');
            expect(query).toContain('$orderby=logindex asc');
            expect(result[0]).toMatchObject({
                id: 'log-1',
                name: 'Initialize variable',
                typeLabel: 'CustomLog',
                levelLabel: 'Info',
                durationText: '500 ms',
                logIndex: 0,
                data: '{"ok":true}'
            });
        });

        it('should retry without ordering when the ordered query fails', async () => {
            const webApiFetch = vi.fn()
                .mockRejectedValueOnce(new Error('orderby rejected'))
                .mockResolvedValueOnce({ value: [{ flowlogid: 'l', name: 'l' }] });

            const result = await FlowService.getFlowRunLogs(webApiFetch, 'run-1');

            expect(webApiFetch).toHaveBeenCalledTimes(2);
            expect(result).toHaveLength(1);
        });

        it('should degrade to an empty array when the table is not accessible', async () => {
            const webApiFetch = vi.fn().mockRejectedValue(new Error('403 Forbidden'));

            const result = await FlowService.getFlowRunLogs(webApiFetch, 'run-1');

            expect(result).toEqual([]);
        });
    });
});
