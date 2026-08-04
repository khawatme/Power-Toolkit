/**
 * @file Tests for AgentService
 * @module tests/services/AgentService.test.js
 * @description Tests for the Copilot Studio agent, transcript, and AI Builder model service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentService, isInstructionsComponent, extractAgentInstructions, agentInstructionsEditable, applyAgentInstructions, extractAgentModel, getComponentKind, getComponentDescription, classifyAgentKind, extractConnectedAgentSchema, extractConnectedAgentName, extractPromptText, applyPromptText, rebuildPromptSegments, extractPromptMetadata, parseAiConfigErrors, summarizeDataBinding, parseModelPerformance, classifyAiTemplate, isPromptTemplate, decodeMaybeGzip, toExpando, parseQuickTestResult, parseModelTestResult, parseTrainResponse, summarizeModelStatus, applyPromptSettings, parseAiEventData, parseEvaluationSet, parseEvaluationCase, parseTranscriptConversation, parseTranscriptSession, countUnpublishedComponents, summarizeAgentComposition, summarizeAgentUsage, buildSnippet, formatSolutionLabel, buildEvaluationCriteriaPayload, buildEvaluationResult, computeEvalFinalScore, evalNeedsGrader } from '../../src/services/AgentService.js';

const FV = '@OData.Community.Display.V1.FormattedValue';

describe('AgentService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getAgents', () => {
        it('should map bot entities to agent objects using formatted values', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [
                    {
                        botid: 'bot-1',
                        name: 'Sales Copilot',
                        schemaname: 'new_salescopilot',
                        statecode: 0,
                        [`statecode${FV}`]: 'Active',
                        [`statuscode${FV}`]: 'Provisioned',
                        ismanaged: false,
                        [`_ownerid_value${FV}`]: 'John Doe',
                        [`language${FV}`]: 'English',
                        [`authenticationmode${FV}`]: 'Integrated',
                        [`createdon${FV}`]: '1/1/2026',
                        [`modifiedon${FV}`]: '1/5/2026',
                        [`publishedon${FV}`]: '1/5/2026',
                        template: 'cliagent-1.0.0'
                    }
                ]
            });

            const result = await AgentService.getAgents(retrieveMultipleRecords);

            expect(retrieveMultipleRecords).toHaveBeenCalledWith('bots', expect.any(String), expect.any(Object));
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                id: 'bot-1',
                name: 'Sales Copilot',
                schemaName: 'new_salescopilot',
                statecode: 0,
                stateLabel: 'Active',
                statusLabel: 'Provisioned',
                isManaged: false,
                owner: 'John Doe',
                language: 'English',
                authMode: 'Integrated',
                createdOn: '1/1/2026',
                modifiedOn: '1/5/2026',
                publishedOn: '1/5/2026',
                publishedOnRaw: '',
                publishedBy: '',
                template: 'cliagent-1.0.0',
                isModern: true
            });
        });

        it('should classify agents as modern (cliagent template) or classic (everything else)', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [
                    { botid: 'bot-modern', name: 'Contoso Support', template: 'cliagent-1.0.0', statecode: 0 },
                    { botid: 'bot-classic', name: 'Classic Bot', template: 'empty-1.0.0', statecode: 0 },
                    { botid: 'bot-none', name: 'No Template', statecode: 0 }
                ]
            });

            const result = await AgentService.getAgents(retrieveMultipleRecords);

            expect(result[0].isModern).toBe(true);
            expect(result[1].isModern).toBe(false);
            expect(result[2].isModern).toBe(false);
            expect(result[2].template).toBe('');
        });

        it('should select the template column for the "Powered by" classification', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({ entities: [] });
            await AgentService.getAgents(retrieveMultipleRecords);
            expect(retrieveMultipleRecords.mock.calls[0][1]).toContain('template');
        });

        it('should fall back to a computed state label when annotation is missing', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ botid: 'bot-2', name: 'HR Bot', statecode: 1, ismanaged: true }]
            });

            const result = await AgentService.getAgents(retrieveMultipleRecords);

            expect(result[0].stateLabel).toBe('Inactive');
            expect(result[0].isManaged).toBe(true);
        });

        it('should use a placeholder name when name is missing', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ botid: 'bot-3', statecode: 0 }]
            });

            const result = await AgentService.getAgents(retrieveMultipleRecords);

            expect(result[0].name).toBe('(unnamed agent)');
        });

        it('should request the bots entity set and order by modifiedon', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({ entities: [] });

            await AgentService.getAgents(retrieveMultipleRecords);

            const query = retrieveMultipleRecords.mock.calls[0][1];
            expect(query).toContain('$select=botid');
            expect(query).toContain('$orderby=modifiedon desc');
        });

        it('should select the owner lookup via its _value form (not the logical name)', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({ entities: [] });

            await AgentService.getAgents(retrieveMultipleRecords);

            const query = retrieveMultipleRecords.mock.calls[0][1];
            expect(query).toContain('_ownerid_value');
            expect(query).not.toMatch(/[,=]ownerid(?![_a-z])/); // never the bare lookup name in $select
        });

        it('should return an empty array when no entities are returned', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({});
            const result = await AgentService.getAgents(retrieveMultipleRecords);
            expect(result).toEqual([]);
        });
    });

    describe('getAgentComponents', () => {
        it('should map botcomponent entities and filter by parent bot', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [
                    {
                        botcomponentid: 'c-1',
                        name: 'Instructions',
                        schemaname: 'gpt',
                        componenttype: 15,
                        [`componenttype${FV}`]: 'Custom GPT',
                        data: 'You are helpful.'
                    }
                ]
            });

            const result = await AgentService.getAgentComponents(retrieveMultipleRecords, 'bot-1');

            const query = retrieveMultipleRecords.mock.calls[0][1];
            expect(retrieveMultipleRecords).toHaveBeenCalledWith('botcomponents', expect.any(String), expect.any(Object));
            expect(query).toContain('_parentbotid_value eq bot-1');
            expect(result[0]).toMatchObject({
                id: 'c-1',
                name: 'Instructions',
                componentType: 15,
                componentTypeLabel: 'Custom GPT',
                data: 'You are helpful.'
            });
        });

        it('should fall back to a component-type label map when annotation is missing', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ botcomponentid: 'c-2', name: 'Greeting', componenttype: 0 }]
            });

            const result = await AgentService.getAgentComponents(retrieveMultipleRecords, 'bot-1');

            expect(result[0].componentTypeLabel).toBe('Topic');
        });

        it('should return an empty array when botId is missing', async () => {
            const retrieveMultipleRecords = vi.fn();
            const result = await AgentService.getAgentComponents(retrieveMultipleRecords, '');
            expect(result).toEqual([]);
            expect(retrieveMultipleRecords).not.toHaveBeenCalled();
        });
    });

    describe('getAgentConfiguration', () => {
        it('should return the configuration string', async () => {
            const retrieveRecord = vi.fn().mockResolvedValue({ configuration: '{"x":1}' });
            const result = await AgentService.getAgentConfiguration(retrieveRecord, 'bot-1');
            expect(retrieveRecord).toHaveBeenCalledWith('bots', 'bot-1', expect.any(String));
            expect(result).toBe('{"x":1}');
        });

        it('should return null when no botId is provided', async () => {
            const retrieveRecord = vi.fn();
            const result = await AgentService.getAgentConfiguration(retrieveRecord, '');
            expect(result).toBeNull();
            expect(retrieveRecord).not.toHaveBeenCalled();
        });

        it('should return null when configuration is empty', async () => {
            const retrieveRecord = vi.fn().mockResolvedValue({ configuration: null });
            const result = await AgentService.getAgentConfiguration(retrieveRecord, 'bot-1');
            expect(result).toBeNull();
        });
    });

    describe('setAgentState', () => {
        it('should activate an agent with statecode 0 only', async () => {
            const updateRecord = vi.fn().mockResolvedValue({ ok: true });
            const result = await AgentService.setAgentState(updateRecord, 'bot-1', true);
            expect(updateRecord).toHaveBeenCalledWith('bots', 'bot-1', { statecode: 0 });
            expect(result).toEqual({ ok: true });
        });

        it('should deactivate an agent with statecode 1 only', async () => {
            const updateRecord = vi.fn().mockResolvedValue({});
            await AgentService.setAgentState(updateRecord, 'bot-1', false);
            expect(updateRecord).toHaveBeenCalledWith('bots', 'bot-1', { statecode: 1 });
        });

        it('should propagate errors', async () => {
            const updateRecord = vi.fn().mockRejectedValue(new Error('nope'));
            await expect(AgentService.setAgentState(updateRecord, 'bot-1', true)).rejects.toThrow('nope');
        });
    });

    describe('deleteAgent', () => {
        it('should POST the PvaDeleteBot bound action with the deprovision tag', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({ ok: true });
            const result = await AgentService.deleteAgent(webApiFetch, 'bot-1');
            expect(webApiFetch).toHaveBeenCalledWith(
                'POST',
                'bots(bot-1)/Microsoft.Dynamics.CRM.PvaDeleteBot',
                '?tag=deprovisionbotondelete',
                {}
            );
            expect(result).toEqual({ ok: true });
        });

        it('should propagate errors', async () => {
            const webApiFetch = vi.fn().mockRejectedValue(new Error('locked'));
            await expect(AgentService.deleteAgent(webApiFetch, 'bot-1')).rejects.toThrow('locked');
        });
    });

    describe('deleteAiModel', () => {
        it('should delete the msdyn_aimodel record directly (configs cascade)', async () => {
            const deleteRecord = vi.fn().mockResolvedValue({ ok: true });
            const result = await AgentService.deleteAiModel(deleteRecord, 'model-1');
            expect(deleteRecord).toHaveBeenCalledWith('msdyn_aimodel', 'model-1');
            expect(result).toEqual({ ok: true });
        });
    });

    describe('getTranscripts', () => {
        it('should map transcripts and filter by the bot lookup', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [
                    {
                        conversationtranscriptid: 't-1',
                        name: 'Conversation 1',
                        schematype: 'PVA',
                        content: '{"activities":[]}',
                        [`conversationstarttime${FV}`]: '1/1/2026 10:00',
                        [`createdon${FV}`]: '1/1/2026'
                    }
                ]
            });

            const result = await AgentService.getTranscripts(retrieveMultipleRecords, 'bot-1', 25);

            const query = retrieveMultipleRecords.mock.calls[0][1];
            expect(retrieveMultipleRecords).toHaveBeenCalledWith('conversationtranscripts', expect.any(String), expect.any(Object));
            expect(query).toContain('_bot_conversationtranscriptid_value eq bot-1');
            expect(query).toContain('$top=25');
            // Content rides along with the list so each row can summarize its session up front.
            expect(query).toContain('content');
            expect(result[0]).toEqual({
                id: 't-1',
                name: 'Conversation 1',
                schemaType: 'PVA',
                content: '{"activities":[]}',
                startTime: '1/1/2026 10:00',
                createdOn: '1/1/2026'
            });
        });

        it('should default the top parameter to 50', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({ entities: [] });
            await AgentService.getTranscripts(retrieveMultipleRecords, 'bot-1');
            expect(retrieveMultipleRecords.mock.calls[0][1]).toContain('$top=50');
        });

        it('should return an empty array when botId is missing', async () => {
            const retrieveMultipleRecords = vi.fn();
            const result = await AgentService.getTranscripts(retrieveMultipleRecords, '');
            expect(result).toEqual([]);
            expect(retrieveMultipleRecords).not.toHaveBeenCalled();
        });
    });

    describe('getTranscriptContent', () => {
        it('should return the transcript content', async () => {
            const retrieveRecord = vi.fn().mockResolvedValue({ content: '{"messages":[]}' });
            const result = await AgentService.getTranscriptContent(retrieveRecord, 't-1');
            expect(result).toBe('{"messages":[]}');
        });

        it('should return null when no id is provided', async () => {
            const retrieveRecord = vi.fn();
            const result = await AgentService.getTranscriptContent(retrieveRecord, '');
            expect(result).toBeNull();
            expect(retrieveRecord).not.toHaveBeenCalled();
        });
    });

    describe('getAiModels', () => {
        it('should map msdyn_aimodel entities with reversed state semantics', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [
                    {
                        msdyn_aimodelid: 'm-1',
                        msdyn_name: 'Receipt Processing',
                        statecode: 1,
                        [`statecode${FV}`]: 'Active',
                        ismanaged: false,
                        [`_ownerid_value${FV}`]: 'Jane',
                        msdyn_TemplateId: {
                            msdyn_aitemplateid: 'tpl-1',
                            msdyn_uniquename: 'GptPowerPrompt',
                            msdyn_resourceinfo: '{"ResourceType":"CognitiveService"}'
                        },
                        _msdyn_activerunconfigurationid_value: 'cfg-live',
                        _msdyn_retrainworkflowid_value: null,
                        [`createdon${FV}`]: '1/1/2026',
                        [`modifiedon${FV}`]: '1/2/2026'
                    }
                ]
            });

            const result = await AgentService.getAiModels(retrieveMultipleRecords);

            expect(retrieveMultipleRecords).toHaveBeenCalledWith('msdyn_aimodels', expect.any(String), expect.any(Object));
            expect(result[0]).toEqual({
                configStatus: { state: '', status: '', configId: '', version: '' },
                id: 'm-1',
                name: 'Receipt Processing',
                statecode: 1,
                stateLabel: 'Active',
                isManaged: false,
                owner: 'Jane',
                template: 'GptPowerPrompt',
                templateName: 'GptPowerPrompt',
                templateId: 'tpl-1',
                kind: 'prompt',
                kindLabel: 'Prompt',
                activeConfigId: 'cfg-live',
                hasRetrain: false,
                createdOn: '1/1/2026',
                modifiedOn: '1/2/2026'
            });
        });

        it('should fall back to a reversed state label when annotation is missing', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ msdyn_aimodelid: 'm-2', msdyn_name: 'Draft', statecode: 0 }]
            });

            const result = await AgentService.getAiModels(retrieveMultipleRecords);

            expect(result[0].stateLabel).toBe('Inactive');
        });

        it('should classify a trained model from the template resource info', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{
                    msdyn_aimodelid: 'm-3',
                    msdyn_TemplateId: {
                        msdyn_uniquename: 'BinaryClassification',
                        msdyn_resourceinfo: '{"ResourceType":"PythonVirtualEnvironment","ModelStorageType":"Value"}'
                    },
                    _msdyn_retrainworkflowid_value: 'wf-1'
                }]
            });

            const result = await AgentService.getAiModels(retrieveMultipleRecords);

            expect(result[0].kind).toBe('custom');
            expect(result[0].hasRetrain).toBe(true);
        });

        it('should fall back to the localized template label when the expand is absent', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ msdyn_aimodelid: 'm-4', [`_msdyn_templateid_value${FV}`]: 'Prédiction' }]
            });

            const result = await AgentService.getAiModels(retrieveMultipleRecords);

            expect(result[0].template).toBe('Prédiction');
            expect(result[0].templateName).toBe('');
        });

        it('should expand the template so classification uses the invariant unique name', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({ entities: [] });

            await AgentService.getAiModels(retrieveMultipleRecords);

            const query = retrieveMultipleRecords.mock.calls[0][1];
            expect(query).toContain('_ownerid_value');
            expect(query).toContain('_msdyn_activerunconfigurationid_value');
            expect(query).toContain('$expand=msdyn_TemplateId($select=msdyn_aitemplateid,msdyn_uniquename,msdyn_resourceinfo)');
            expect(query).not.toMatch(/[,=]msdyn_templateid(?![_a-z])/);
        });

        it('should expand configurations newest-first so cards can badge the latest status', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{
                    msdyn_aimodelid: 'm-5',
                    _msdyn_activerunconfigurationid_value: 'run-1',
                    msdyn_aimodel_msdyn_aiconfiguration: [
                        { msdyn_aiconfigurationid: 'run-1', msdyn_type: 190690001, msdyn_majoriterationnumber: 2, statuscode: 7, statecode: 2 },
                        { msdyn_aiconfigurationid: 'run-0', msdyn_type: 190690001, msdyn_majoriterationnumber: 1, statuscode: 0, statecode: 0 }
                    ]
                }]
            });

            const result = await AgentService.getAiModels(retrieveMultipleRecords);

            const query = retrieveMultipleRecords.mock.calls[0][1];
            expect(query).toContain('msdyn_aimodel_msdyn_aiconfiguration($select=');
            expect(query).toContain('$orderby=msdyn_majoriterationnumber desc,msdyn_minoriterationnumber desc');
            expect(result[0].configStatus).toEqual({
                state: 'live', status: 'Published', configId: 'run-1', version: '2.0'
            });
        });
    });

    describe('classifyAiTemplate', () => {
        it.each([
            'GptPowerPrompt',
            'DataversePromptColumn',
            'IntelligentApprovalPrompt',
            'GptPromptEngineering'
        ])('should classify %s as a prompt', (uniqueName) => {
            expect(classifyAiTemplate(uniqueName).kind).toBe('prompt');
            expect(isPromptTemplate(uniqueName)).toBe(true);
        });

        it('should classify a template that stores no model artifact as prebuilt', () => {
            const info = '{"ResourceType":"CognitiveService","CognitiveInfo":{"CognitiveType":"InvoiceProcessing"}, "ModelStorageType":"None"}';
            expect(classifyAiTemplate('InvoiceProcessing', info).kind).toBe('prebuilt');
        });

        it('should classify a PythonVirtualEnvironment template as a custom model', () => {
            const info = '{"ResourceType":"PythonVirtualEnvironment"}';
            expect(classifyAiTemplate('BinaryClassification', info).kind).toBe('custom');
        });

        it.each([
            ['TextClassificationV2', 'Value'],
            ['DocumentScanning', 'Reference']
        ])('should classify trainable CognitiveService template %s as a custom model', (name, storage) => {
            // These are trained per-model despite being CognitiveService — ModelStorageType is what
            // separates a stored model artifact from a shared hosted service.
            const info = `{"ResourceType":"CognitiveService","ModelStorageType":"${storage}"}`;
            expect(classifyAiTemplate(name, info).kind).toBe('custom');
        });

        it('should not treat a localized display name as a prompt', () => {
            expect(isPromptTemplate('Invite de commande')).toBe(false);
        });

        it('should tolerate unparsable resource info', () => {
            expect(classifyAiTemplate('Whatever', 'not json').kind).toBe('prebuilt');
        });
    });

    describe('getAiModelDefinition', () => {
        /** Builds a raw msdyn_aiconfiguration record with sensible defaults. */
        const config = (overrides = {}) => ({
            msdyn_aiconfigurationid: 'cfg-1',
            msdyn_name: 'Run',
            msdyn_type: 190690001,
            [`msdyn_type${FV}`]: 'RunConfiguration',
            msdyn_majoriterationnumber: 1,
            msdyn_minoriterationnumber: 0,
            statecode: 0,
            statuscode: 0,
            ...overrides
        });

        it('should return one section per non-empty payload column', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [config({
                    msdyn_customconfiguration: '{"prompt":[]}',
                    msdyn_databinding: '{"input":{"schemaName":"account"}}'
                })]
            });

            const result = await AgentService.getAiModelDefinition(retrieveMultipleRecords, vi.fn(), 'm-1');

            const [section, binding] = result.configurations[0].sections;
            expect(section.column).toBe('msdyn_customconfiguration');
            expect(section.text).toBe('{"prompt":[]}');
            expect(section.language).toBe('json');
            // The old `||` chain hid the data binding behind the custom configuration.
            expect(binding.column).toBe('msdyn_databinding');
        });

        it('should order iterations newest-version-first and flag the live one', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [
                    config({ msdyn_aiconfigurationid: 'cfg-live', msdyn_majoriterationnumber: 3, statuscode: 7, statecode: 2, msdyn_customconfiguration: 'v3' }),
                    config({ msdyn_aiconfigurationid: 'cfg-old', msdyn_majoriterationnumber: 1, msdyn_customconfiguration: 'v1' })
                ]
            });

            const result = await AgentService.getAiModelDefinition(retrieveMultipleRecords, vi.fn(), 'm-1', 'cfg-live');

            const query = retrieveMultipleRecords.mock.calls[0][1];
            expect(query).toContain('$orderby=msdyn_majoriterationnumber desc,msdyn_minoriterationnumber desc');
            expect(result.configurations[0].version).toBe('3.0');
            expect(result.configurations[0].isActive).toBe(true);
            expect(result.configurations[0].status).toBe('Published');
            expect(result.configurations[1].isActive).toBe(false);
        });

        it('should keep a failed iteration even when it carries no payload', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [config({
                    statecode: 3,
                    statuscode: 9,
                    msdyn_lasterrors: '{"overallError":{"code":"InternalError","message":null,"dateTime":"2026-07-23T20:39:49Z"}}'
                })]
            });

            const result = await AgentService.getAiModelDefinition(retrieveMultipleRecords, vi.fn(), 'm-1');

            expect(result.configurations).toHaveLength(1);
            expect(result.configurations[0].isFailed).toBe(true);
            expect(result.configurations[0].status).toBe('Train failed');
            expect(result.configurations[0].lastError.message).toBe('InternalError');
        });

        it('should mark model-produced columns read-only and definition columns editable', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [config({
                    msdyn_customconfiguration: 'cfg',
                    msdyn_modelperformance: 'perf'
                })]
            });

            const result = await AgentService.getAiModelDefinition(retrieveMultipleRecords, vi.fn(), 'm-1');

            const byColumn = Object.fromEntries(result.configurations[0].sections.map(s => [s.column, s]));
            expect(byColumn.msdyn_customconfiguration.editable).toBe(true);
            expect(byColumn.msdyn_modelperformance.editable).toBe(false);
        });

        it('should not allow editing a managed configuration', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [config({ ismanaged: true, msdyn_customconfiguration: 'cfg' })]
            });

            const result = await AgentService.getAiModelDefinition(retrieveMultipleRecords, vi.fn(), 'm-1');

            expect(result.configurations[0].sections[0].editable).toBe(false);
        });

        it('should fall back to modelcreationcontext when no configuration exists', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({ entities: [] });
            const retrieveRecord = vi.fn().mockResolvedValue({ msdyn_modelcreationcontext: '{"ctx":1}' });

            const result = await AgentService.getAiModelDefinition(retrieveMultipleRecords, retrieveRecord, 'm-1');

            expect(result.configurations).toEqual([]);
            expect(result.creationContext).toBe('{"ctx":1}');
        });

        it('should treat an empty creation context object as no definition', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({ entities: [] });
            const retrieveRecord = vi.fn().mockResolvedValue({ msdyn_modelcreationcontext: '{}' });

            const result = await AgentService.getAiModelDefinition(retrieveMultipleRecords, retrieveRecord, 'm-1');

            expect(result.creationContext).toBeNull();
        });

        it('should fall back gracefully when the AI configuration query throws', async () => {
            const retrieveMultipleRecords = vi.fn().mockRejectedValue(new Error('no access'));
            const retrieveRecord = vi.fn().mockResolvedValue({ msdyn_modelcreationcontext: 'ctx' });

            const result = await AgentService.getAiModelDefinition(retrieveMultipleRecords, retrieveRecord, 'm-1');

            expect(result.creationContext).toBe('ctx');
        });

        it('should return empty when no modelId is provided', async () => {
            const result = await AgentService.getAiModelDefinition(vi.fn(), vi.fn(), '');
            expect(result).toEqual({ configurations: [], creationContext: null });
        });
    });

    describe('updateAiConfiguration', () => {
        it('should patch the column the text was read from', async () => {
            const updateRecord = vi.fn().mockResolvedValue({});

            await AgentService.updateAiConfiguration(updateRecord, 'cfg-1', '{"a":1}', 'msdyn_databinding');

            expect(updateRecord).toHaveBeenCalledWith('msdyn_aiconfigurations', 'cfg-1', {
                msdyn_databinding: '{"a":1}'
            });
        });

        it('should default to the custom configuration column', async () => {
            const updateRecord = vi.fn().mockResolvedValue({});

            await AgentService.updateAiConfiguration(updateRecord, 'cfg-1', 'x');

            expect(updateRecord).toHaveBeenCalledWith('msdyn_aiconfigurations', 'cfg-1', {
                msdyn_customconfiguration: 'x'
            });
        });

        it('should refuse to write a column that is not an editable definition column', async () => {
            const updateRecord = vi.fn();

            await expect(
                AgentService.updateAiConfiguration(updateRecord, 'cfg-1', 'x', 'msdyn_modelperformance')
            ).rejects.toThrow(/not editable/);
            expect(updateRecord).not.toHaveBeenCalled();
        });
    });

    describe('publishAiPrompt', () => {
        const model = { id: 'model-1', name: 'Prompt to print Hello', templateId: 'tpl-1' };

        it('should post AIModelPublish with a freshly minted run configuration id', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({});

            const runConfigurationId = await AgentService.publishAiPrompt(webApiFetch, model, '{"prompt":[]}');

            const [method, path, query, body] = webApiFetch.mock.calls[0];
            expect(method).toBe('POST');
            expect(path).toBe('AIModelPublish');
            expect(query).toBe('');
            expect(body).toEqual({
                CustomConfiguration: '{"prompt":[]}',
                ModelId: 'model-1',
                ModelName: 'Prompt to print Hello',
                RunConfigurationId: runConfigurationId,
                TemplateId: 'tpl-1',
                RunConfiguration: '',
                Source: expect.stringContaining('AIBuilder')
            });
            expect(runConfigurationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });

        it('should mint a distinct id per publish', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({});

            const first = await AgentService.publishAiPrompt(webApiFetch, model, 'a');
            const second = await AgentService.publishAiPrompt(webApiFetch, model, 'b');

            expect(first).not.toBe(second);
        });

        it('should never PATCH msdyn_customconfiguration for a prompt', async () => {
            // A platform plugin rejects that write with
            // "InvalidArgument: Unexpected parameter(s) msdyn_customconfiguration".
            const webApiFetch = vi.fn().mockResolvedValue({});

            await AgentService.publishAiPrompt(webApiFetch, model, '{}');

            expect(webApiFetch).not.toHaveBeenCalledWith('PATCH', expect.anything(), expect.anything(), expect.anything());
        });

        it('should require the ids the action depends on', async () => {
            const webApiFetch = vi.fn();

            await expect(AgentService.publishAiPrompt(webApiFetch, { id: 'm-1' }, '{}')).rejects.toThrow(/template id/);
            await expect(AgentService.publishAiPrompt(webApiFetch, null, '{}')).rejects.toThrow();
            expect(webApiFetch).not.toHaveBeenCalled();
        });
    });

    describe('toExpando', () => {
        it('should tag every object and name each array element type', () => {
            const result = toExpando({
                prompt: [{ type: 'literal', text: 'hi' }],
                definitions: { output: { formats: ['text'] } }
            });

            expect(result['@odata.type']).toBe('#Microsoft.Dynamics.CRM.expando');
            expect(result['prompt@odata.type']).toBe('#Collection(Microsoft.Dynamics.CRM.expando)');
            expect(result.prompt[0]['@odata.type']).toBe('#Microsoft.Dynamics.CRM.expando');
            expect(result.definitions.output['formats@odata.type']).toBe('#Collection(String)');
        });

        it('should write each annotation immediately before its value', () => {
            // OData requires the control information to precede the property it annotates.
            const keys = Object.keys(toExpando({ prompt: [{ a: 1 }] }));
            expect(keys.indexOf('prompt@odata.type')).toBeLessThan(keys.indexOf('prompt'));
        });

        it('should drop empty strings and empty arrays but keep null', () => {
            const result = toExpando({
                code: '',
                signature: '',
                definitions: { inputs: [], formulas: [], output: { formats: ['text'] } },
                settings: { runtime: null, recordRetrievalLimit: 30, shouldPreserveRecordLinks: null }
            });

            expect(result).not.toHaveProperty('code');
            expect(result).not.toHaveProperty('signature');
            expect(result.definitions).not.toHaveProperty('inputs');
            expect(result.definitions).not.toHaveProperty('formulas');
            expect(result.settings.runtime).toBeNull();
            expect(result.settings.recordRetrievalLimit).toBe(30);
        });

        it('should keep zero and false', () => {
            const result = toExpando({ temperature: 0, enableExtendedExecution: false });
            expect(result.temperature).toBe(0);
            expect(result.enableExtendedExecution).toBe(false);
        });
    });

    describe('quickTestAiConfiguration', () => {
        const config = JSON.stringify({
            version: 'GptDynamicPrompt-2',
            prompt: [{ type: 'literal', text: 'print Hello!' }],
            definitions: { inputs: [], output: { formats: ['text'] } },
            modelParameters: { modelType: 'gpt-41', gptParameters: { temperature: 0 } },
            settings: { recordRetrievalLimit: 30, shouldPreserveRecordLinks: null, runtime: null },
            code: '',
            signature: ''
        });

        it('should post the bound QuickTest action with an expando-wrapped config', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({ responsev2: { operationStatus: 'Success' } });

            await AgentService.quickTestAiConfiguration(webApiFetch, 'cfg-1', config);

            const [method, path, query, body] = webApiFetch.mock.calls[0];
            expect(method).toBe('POST');
            expect(path).toBe('msdyn_aiconfigurations(cfg-1)/Microsoft.Dynamics.CRM.QuickTest');
            expect(query).toBe('');
            expect(body.version).toBe('2.0');
            expect(body.source).toContain('MicrosoftCopilotStudio');
            expect(body.requestv2['@odata.type']).toBe('#Microsoft.Dynamics.CRM.expando');
            expect(body.requestv2.$customConfig.version).toBe('GptDynamicPrompt-2');
            // Empty definitions and empty code/signature are omitted, as AI Builder omits them.
            expect(body.requestv2.$customConfig.definitions).not.toHaveProperty('inputs');
            expect(body.requestv2.$customConfig).not.toHaveProperty('code');
        });

        it('should spread a text input as a plain string', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({ responsev2: { operationStatus: 'Success' } });

            await AgentService.quickTestAiConfiguration(webApiFetch, 'cfg-1', config, null, {
                Text_20input: 'TEST Sample Data'
            });

            const [, , , body] = webApiFetch.mock.calls[0];
            expect(body.requestv2.Text_20input).toBe('TEST Sample Data');
        });

        it('should send a file input inline as an expando carrying base64Encoded', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({ responsev2: { operationStatus: 'Success' } });

            await AgentService.quickTestAiConfiguration(webApiFetch, 'cfg-1', config, null, {
                Document_20input: { base64Encoded: 'JVBERi0xLjQK' }
            });

            const [, , , body] = webApiFetch.mock.calls[0];
            expect(body.requestv2.Document_20input).toEqual({
                '@odata.type': '#Microsoft.Dynamics.CRM.expando',
                base64Encoded: 'JVBERi0xLjQK'
            });
        });

        it('should return the parsed prediction output', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({
                response: null,
                responsev2: {
                    operationStatus: 'Success',
                    predictionId: 'pred-1',
                    predictionOutput: {
                        text: 'Hello!', modelName: 'gpt-41-2025-04-14', finishReason: 'stop',
                        totalTokens: 1017, promptTokens: 1014, completionTokens: 3,
                        costAsAiBuilderCredits: 22, costAsCopilotCredits: 3.0
                    }
                }
            });

            const result = await AgentService.quickTestAiConfiguration(webApiFetch, 'cfg-1', config);

            expect(result.succeeded).toBe(true);
            expect(result.text).toBe('Hello!');
            expect(result.modelName).toBe('gpt-41-2025-04-14');
            expect(result.totalTokens).toBe(1017);
            expect(result.credits).toBe(22);
        });

        it('should keep the configuration\'s own code so repeat runs stay stable', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({ responsev2: { operationStatus: 'Success' } });
            const withCode = JSON.stringify({ prompt: [], code: 'stored code', signature: 'sig' });

            await AgentService.quickTestAiConfiguration(webApiFetch, 'cfg-1', withCode);

            // Deleting these made the model rewrite the Python on every run, so an unchanged prompt
            // returned a different answer each time.
            const sent = webApiFetch.mock.calls[0][3].requestv2.$customConfig;
            expect(sent.code).toBe('stored code');
            expect(sent.signature).toBe('sig');
        });

        it('should strip the saved Sample data from the inputs it sends', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({ responsev2: { operationStatus: 'Success' } });
            const withSample = JSON.stringify({
                prompt: [],
                definitions: {
                    inputs: [
                        { id: 'Document_20input', text: 'Document input', type: 'document' },
                        { id: 'Text_20input', text: 'Text input', type: 'text', quickTestValue: 'TEST Sample Data' }
                    ]
                }
            });

            await AgentService.quickTestAiConfiguration(webApiFetch, 'cfg-1', withSample);

            const sent = webApiFetch.mock.calls[0][3].requestv2.$customConfig;
            // Matches the portal's payload: no editor-only Sample data, and no default text type.
            expect(sent.definitions.inputs[1]).not.toHaveProperty('quickTestValue');
            expect(sent.definitions.inputs[1]).not.toHaveProperty('type');
            expect(sent.definitions.inputs[0].type).toBe('document');
        });

        it('should drop the stored code when asked to regenerate', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({ responsev2: { operationStatus: 'Success' } });
            const withCode = JSON.stringify({ prompt: [], code: 'stored code', signature: 'sig' });

            await AgentService.quickTestAiConfiguration(webApiFetch, 'cfg-1', withCode, null, null, true);

            const sent = webApiFetch.mock.calls[0][3].requestv2.$customConfig;
            expect(sent).not.toHaveProperty('code');
            expect(sent).not.toHaveProperty('signature');
        });

        it('should prefer reused code over regenerating', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({ responsev2: { operationStatus: 'Success' } });
            const withCode = JSON.stringify({ prompt: [], code: 'stored code', signature: 'sig' });

            await AgentService.quickTestAiConfiguration(
                webApiFetch, 'cfg-1', withCode, { code: 'reused', signature: 'sig-2' }, null, true
            );

            expect(webApiFetch.mock.calls[0][3].requestv2.$customConfig.code).toBe('reused');
        });

        it('should not mutate the caller\'s configuration text', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({ responsev2: { operationStatus: 'Success' } });
            const original = JSON.stringify({
                prompt: [],
                definitions: { inputs: [{ id: 'Text_20input', text: 'Text input', type: 'text', quickTestValue: 'keep me' }] }
            });

            await AgentService.quickTestAiConfiguration(webApiFetch, 'cfg-1', original);

            expect(JSON.parse(original).definitions.inputs[0].quickTestValue).toBe('keep me');
        });

        it('should inline reused code so it runs without regenerating', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({ responsev2: { operationStatus: 'Success' } });

            await AgentService.quickTestAiConfiguration(
                webApiFetch, 'cfg-1', '{"prompt":[]}', { code: 'print(1)', signature: 'sig-1' }
            );

            const sent = webApiFetch.mock.calls[0][3].requestv2.$customConfig;
            expect(sent.code).toBe('print(1)');
            expect(sent.signature).toBe('sig-1');
        });

        it('should reject an invalid configuration before calling the API', async () => {
            const webApiFetch = vi.fn();

            await expect(AgentService.quickTestAiConfiguration(webApiFetch, 'cfg-1', 'not json')).rejects.toThrow();
            await expect(AgentService.quickTestAiConfiguration(webApiFetch, '', '{}')).rejects.toThrow(/configuration id/);
            expect(webApiFetch).not.toHaveBeenCalled();
        });
    });

    describe('parseQuickTestResult', () => {
        it('should surface a failed run\'s error', () => {
            const result = parseQuickTestResult({
                responsev2: { operationStatus: 'Invalid', error: { code: 'InvalidArgument', message: 'Bad prompt' } }
            });
            expect(result.succeeded).toBe(false);
            expect(result.error).toBe('Bad prompt');
        });

        it('should extract a reasoning model\'s tokens and credits', () => {
            const result = parseQuickTestResult({
                responsev2: {
                    operationStatus: 'Success',
                    predictionOutput: {
                        text: 'Hello!', modelName: 'gpt-41-2025-04-14', finishReason: 'stop',
                        totalTokens: 1017, promptTokens: 1014, completionTokens: 3, thoughtSteps: 'thinking...',
                        costAsAiBuilderCredits: 22, costAsCopilotCredits: 3.0
                    }
                }
            });
            expect(result.totalTokens).toBe(1017);
            expect(result.credits).toBe(22);
            expect(result.copilotCredits).toBe(3);
            expect(result.thoughtSteps).toBe('thinking...');
        });

        it('should extract the code interpreter\'s code, logs, plan and mime type', () => {
            const result = parseQuickTestResult({
                responsev2: {
                    operationStatus: 'Success',
                    predictionOutput: {
                        text: '# Hello', mimetype: 'text/markdown', finishReason: 'stop',
                        code: 'print("hi")', logs: 'INFO - done', dataUsed: '[]',
                        costAsAiBuilderCredits: 0, costAsCopilotCredits: 0,
                        codeThinking: { PlanningOutput: 'the plan', PromptFixes: 'none needed' }
                    }
                }
            });
            expect(result.mimeType).toBe('text/markdown');
            expect(result.code).toBe('print("hi")');
            expect(result.logs).toBe('INFO - done');
            expect(result.planning).toBe('the plan');
            expect(result.promptFixes).toBe('none needed');
            // An empty "[]" data-used array is hidden.
            expect(result.dataUsed).toBe('');
        });

        it('should carry the code signature so a follow-up run can reuse it', () => {
            const result = parseQuickTestResult({
                responsev2: {
                    operationStatus: 'Success',
                    predictionOutput: { text: 'x', code: 'print(1)', signature: 'AQAAsig==' }
                }
            });
            expect(result.signature).toBe('AQAAsig==');
        });

        it('should keep non-empty grounding data', () => {
            const result = parseQuickTestResult({
                responsev2: { operationStatus: 'Success', predictionOutput: { dataUsed: '[{"id":"1"}]' } }
            });
            expect(result.dataUsed).toBe('[{"id":"1"}]');
        });

        it('should tolerate an empty response', () => {
            expect(parseQuickTestResult({}).succeeded).toBe(false);
            expect(parseQuickTestResult(null).text).toBe('');
        });
    });

    describe('saveAsAiPrompt', () => {
        const model = { id: 'source-1', name: 'Prompt to print Hello', templateId: 'tpl-1' };

        it('should publish a new model with fresh, distinct ids', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({});

            const { modelId, runConfigurationId } = await AgentService.saveAsAiPrompt(
                webApiFetch, model, 'Prompt to print Hello (copy)', '{"prompt":[]}'
            );

            const [method, path, , body] = webApiFetch.mock.calls[0];
            expect(method).toBe('POST');
            expect(path).toBe('AIModelPublish');
            expect(body.ModelName).toBe('Prompt to print Hello (copy)');
            // A NEW model id — not the source's — is what makes the action create a copy.
            expect(body.ModelId).toBe(modelId);
            expect(modelId).not.toBe('source-1');
            expect(body.TemplateId).toBe('tpl-1');
            expect(body.RunConfigurationId).toBe(runConfigurationId);
            expect(modelId).not.toBe(runConfigurationId);
        });

        it('should trim the name', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({});
            await AgentService.saveAsAiPrompt(webApiFetch, model, '  Spaced  ', '{}');
            expect(webApiFetch.mock.calls[0][3].ModelName).toBe('Spaced');
        });

        it('should require a template id and a name', async () => {
            const webApiFetch = vi.fn();
            await expect(AgentService.saveAsAiPrompt(webApiFetch, { id: 'x' }, 'n', '{}')).rejects.toThrow(/template id/);
            await expect(AgentService.saveAsAiPrompt(webApiFetch, model, '  ', '{}')).rejects.toThrow(/name/);
            expect(webApiFetch).not.toHaveBeenCalled();
        });
    });

    describe('trainAiConfiguration', () => {
        it('should post the bound Train action and parse its stringified status', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({
                response: '{"operationStatus":"InProgress","error":null,"predictionId":null}'
            });

            const result = await AgentService.trainAiConfiguration(webApiFetch, 'cfg-1');

            expect(webApiFetch).toHaveBeenCalledWith(
                'POST', 'msdyn_aiconfigurations(cfg-1)/Microsoft.Dynamics.CRM.Train', '', { version: '1.0' }
            );
            expect(result).toEqual({ status: 'InProgress', error: '' });
        });

        it('should surface an error returned inside the response string', () => {
            expect(parseTrainResponse({ response: '{"operationStatus":"Invalid","error":{"message":"No data"}}' }))
                .toEqual({ status: 'Invalid', error: 'No data' });
        });

        it('should tolerate an unparsable response', () => {
            expect(parseTrainResponse({ response: 'nope' })).toEqual({ status: '', error: '' });
            expect(parseTrainResponse({})).toEqual({ status: '', error: '' });
        });

        it('should require a configuration id', async () => {
            const webApiFetch = vi.fn();
            await expect(AgentService.trainAiConfiguration(webApiFetch, '')).rejects.toThrow(/configuration id/);
            expect(webApiFetch).not.toHaveBeenCalled();
        });
    });

    describe('retrainAiConfiguration', () => {
        it('should clone a new training iteration (schema-correct model bind + lineage) then train it', async () => {
            const webApiFetch = vi.fn()
                .mockResolvedValueOnce({}) // create
                .mockResolvedValueOnce({ response: '{"operationStatus":"InProgress","error":null}' }); // train

            const result = await AgentService.retrainAiConfiguration(
                webApiFetch,
                { id: 'model-1' },
                { id: 'cfg-src', databinding: '{"input":{}}', customConfiguration: '{"language":"en"}' }
            );

            // 1) Create a new training configuration cloned from the source.
            const [method, path, , payload] = webApiFetch.mock.calls[0];
            expect(method).toBe('POST');
            expect(path).toBe('msdyn_aiconfigurations');
            expect(payload.msdyn_type).toBe(190690000);
            expect(payload.msdyn_databinding).toBe('{"input":{}}');
            expect(payload.msdyn_customconfiguration).toBe('{"language":"en"}');
            // msdyn_AIModelId targets msdyn_aimodel per the Web API schema.
            expect(payload['msdyn_AIModelId@odata.bind']).toBe('/msdyn_aimodels(model-1)');
            expect(payload['msdyn_CreatedFromConfigurationId@odata.bind']).toBe('/msdyn_aiconfigurations(cfg-src)');
            const newId = payload.msdyn_aiconfigurationid;
            expect(newId).toBeTruthy();

            // 2) Train the *new* configuration, and return its id + parsed outcome.
            expect(webApiFetch.mock.calls[1][1]).toBe(`msdyn_aiconfigurations(${newId})/Microsoft.Dynamics.CRM.Train`);
            expect(result).toEqual({ configId: newId, status: 'InProgress', error: '' });
        });

        it('should require a model id and a source configuration', async () => {
            const webApiFetch = vi.fn();
            await expect(AgentService.retrainAiConfiguration(webApiFetch, {}, { id: 'c' })).rejects.toThrow(/model id/);
            await expect(AgentService.retrainAiConfiguration(webApiFetch, { id: 'm' }, {})).rejects.toThrow(/source configuration/);
            expect(webApiFetch).not.toHaveBeenCalled();
        });
    });

    describe('quickTestModel', () => {
        it('should send only the text (as an expando) and parse the scored predictions', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({
                responsev2: {
                    operationStatus: 'Success',
                    predictionId: 'pred-1',
                    predictionOutput: {
                        costAsAiBuilderCredits: 20, costAsCopilotCredits: 1.5,
                        results: [
                            { type: 'Billing', score: 0.42 },
                            { type: '{"BotName":"cr297_bot645100"}', score: 0.93 }
                        ]
                    }
                }
            });

            const result = await AgentService.quickTestModel(webApiFetch, 'run-1', 'Where is my order?');

            expect(webApiFetch).toHaveBeenCalledWith(
                'POST', 'msdyn_aiconfigurations(run-1)/Microsoft.Dynamics.CRM.QuickTest', '',
                { version: '2.0', requestv2: { '@odata.type': '#Microsoft.Dynamics.CRM.expando', 'text@odata.type': '#String', text: 'Where is my order?' } }
            );
            // Highest confidence first; a JSON-encoded label is shown by its readable name.
            expect(result.predictions).toEqual([
                { label: 'cr297_bot645100', score: 0.93, value: '' },
                { label: 'Billing', score: 0.42, value: '' }
            ]);
            expect(result).toMatchObject({
                succeeded: true, shape: 'scores', credits: 20, copilotCredits: 1.5, predictionId: 'pred-1'
            });
        });

        it('should require a configuration id', async () => {
            const webApiFetch = vi.fn();
            await expect(AgentService.quickTestModel(webApiFetch, '', 'x')).rejects.toThrow(/configuration id/);
            expect(webApiFetch).not.toHaveBeenCalled();
        });
    });

    describe('parseModelTestResult', () => {
        /**
         * Wraps a prediction output in the action's response envelope.
         * @param {object} predictionOutput - The payload.
         * @returns {object} The response.
         */
        const respond = (predictionOutput) => ({
            responsev2: { operationStatus: 'Success', predictionOutput }
        });

        it('should report an empty results array as a real answer, not an error', () => {
            const parsed = parseModelTestResult(respond({ results: [] }));

            expect(parsed.succeeded).toBe(true);
            expect(parsed.shape).toBe('scores');
            expect(parsed.predictions).toEqual([]);
        });

        it('should read the document-processing labels shape', () => {
            // Docs: the Power Automate accessor is predictionOutput/labels/<Name>/value.
            const parsed = parseModelTestResult(respond({
                labels: {
                    'labels@odata.type': '#Microsoft.Dynamics.CRM.expando',
                    Total: { value: '42.00', confidence: 0.91 },
                    Vendor: { value: 'Contoso' }
                }
            }));

            expect(parsed.shape).toBe('labels');
            expect(parsed.predictions).toEqual([
                { label: 'Total', score: 0.91, value: '42.00' },
                { label: 'Vendor', score: null, value: 'Contoso' }
            ]);
        });

        it('should hand back an unrecognized payload verbatim rather than call it empty', () => {
            const parsed = parseModelTestResult(respond({ boundingBoxes: [{ x: 1 }] }));

            expect(parsed.shape).toBe('other');
            expect(parsed.predictions).toEqual([]);
            expect(parsed.raw).toContain('boundingBoxes');
        });

        it('should distinguish "returned nothing" from an unrecognized payload', () => {
            const parsed = parseModelTestResult(respond({
                '@odata.type': '#Microsoft.Dynamics.CRM.expando',
                costAsAiBuilderCredits: 20
            }));

            expect(parsed.shape).toBe('none');
            expect(parsed.raw).toBe('');
            expect(parsed.credits).toBe(20);
        });

        it('should carry the failure message when the run did not succeed', () => {
            const parsed = parseModelTestResult({
                responsev2: { operationStatus: 'Failed', error: { message: 'Model not published' } }
            });

            expect(parsed.succeeded).toBe(false);
            expect(parsed.error).toBe('Model not published');
        });

        it('should tolerate a missing response', () => {
            expect(() => parseModelTestResult(null)).not.toThrow();
            expect(parseModelTestResult(null).predictions).toEqual([]);
        });
    });

    describe('unpublishAiConfiguration', () => {
        it('should POST the config-bound UnpublishAIConfiguration action', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({ response: '{"operationStatus":"Success","error":null}' });
            const result = await AgentService.unpublishAiConfiguration(webApiFetch, 'run-1');
            expect(webApiFetch).toHaveBeenCalledWith(
                'POST', 'msdyn_aiconfigurations(run-1)/Microsoft.Dynamics.CRM.UnpublishAIConfiguration', '', { version: '1.0' }
            );
            expect(result).toEqual({ status: 'Success', error: '' });
        });

        it('should surface an error returned in the action response body', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({
                response: '{"operationStatus":"Error","error":{"message":"Invalid state"}}'
            });
            const result = await AgentService.unpublishAiConfiguration(webApiFetch, 'run-1');
            expect(result.error).toBe('Invalid state');
        });

        it('should require a configuration id', async () => {
            const webApiFetch = vi.fn();
            await expect(AgentService.unpublishAiConfiguration(webApiFetch, '')).rejects.toThrow(/configuration id/);
            expect(webApiFetch).not.toHaveBeenCalled();
        });
    });

    describe('publishTrainedModel', () => {
        it('should create a run config cloned from the template then PublishAIConfiguration on it', async () => {
            const webApiFetch = vi.fn()
                .mockResolvedValueOnce({ id: 'new-run' }) // create (id from OData-EntityId)
                .mockResolvedValueOnce({ response: '{"operationStatus":"InProgress","error":null}' }); // publish

            const result = await AgentService.publishTrainedModel(
                webApiFetch, { id: 'model-1' }, 'train-9',
                { databinding: '{"input":{},"output":{}}', schedulingoptions: '{"prediction":{}}' }
            );

            const [, path, , payload] = webApiFetch.mock.calls[0];
            expect(path).toBe('msdyn_aiconfigurations');
            expect(payload.msdyn_type).toBe(190690001);
            expect(payload.msdyn_databinding).toBe('{"input":{},"output":{}}');
            expect(payload.msdyn_schedulingoptions).toBe('{"prediction":{}}');
            expect(payload['msdyn_AIModelId@odata.bind']).toBe('/msdyn_aimodels(model-1)');
            expect(payload['msdyn_TrainedModelAIConfigurationPareId@odata.bind']).toBe('/msdyn_aiconfigurations(train-9)');
            // Then publish the newly created run config.
            expect(webApiFetch.mock.calls[1][1]).toBe('msdyn_aiconfigurations(new-run)/Microsoft.Dynamics.CRM.PublishAIConfiguration');
            expect(result).toEqual({ configId: 'new-run', status: 'InProgress', error: '' });
        });

        it('should derive the prediction binding for a first publish (no prior run config)', async () => {
            const webApiFetch = vi.fn()
                .mockResolvedValueOnce({ id: 'new-run' })
                .mockResolvedValueOnce({ response: '{"operationStatus":"InProgress"}' });
            const trainingBinding = JSON.stringify({ input: { schemaName: 'conversationtranscript', attributes: [
                { specificationName: 'text', schemaName: 'content', requiredLevel: 'ApplicationRequired' },
                { specificationName: 'tags', schemaName: 'metadata', requiredLevel: 'ApplicationRequired' },
                { specificationName: 'id', schemaName: 'conversationtranscriptid', requiredLevel: 'ApplicationRequired' }
            ] } });

            await AgentService.publishTrainedModel(webApiFetch, { id: 'ab-cd' }, 'train-9', { trainingDatabinding: trainingBinding });

            const binding = JSON.parse(webApiFetch.mock.calls[0][3].msdyn_databinding);
            // Prediction input drops the label (tags); output binds the results table with fixed columns.
            expect(binding.input.attributes.map(a => a.specificationName)).toEqual(['text', 'id']);
            expect(binding.output.relatedEntities[0].schemaName).toBe('new_tc_ab_cd');
            expect(binding.output.relatedEntities[0].attributes).toEqual([
                { schemaName: 'new_tags', specificationName: 'type' },
                { schemaName: 'new_confidence_Level', specificationName: 'score' }
            ]);
            // A first publish sets the default prediction schedule.
            expect(webApiFetch.mock.calls[0][3].msdyn_schedulingoptions).toContain('recurrence');
        });

        it('should require the model, training config, and a resolvable binding', async () => {
            const webApiFetch = vi.fn();
            await expect(AgentService.publishTrainedModel(webApiFetch, { id: 'm' }, 'train-9', {})).rejects.toThrow(/binding/);
            await expect(AgentService.publishTrainedModel(webApiFetch, { id: 'm' }, '', { databinding: '{}' })).rejects.toThrow(/trained configuration/);
            expect(webApiFetch).not.toHaveBeenCalled();
        });
    });

    describe('summarizeModelStatus', () => {
        const runConfig = (over = {}) => ({
            msdyn_aiconfigurationid: 'run-1', msdyn_type: 190690001,
            msdyn_majoriterationnumber: 3, msdyn_minoriterationnumber: 0, statuscode: 7, statecode: 2, ...over
        });
        const trainConfig = (over = {}) => ({
            msdyn_aiconfigurationid: 'train-1', msdyn_type: 190690000,
            msdyn_majoriterationnumber: 1, msdyn_minoriterationnumber: 0, statuscode: 0, statecode: 0, ...over
        });

        it('should report the published run configuration as live', () => {
            const result = summarizeModelStatus([runConfig(), trainConfig()], 'run-1');
            expect(result).toEqual({ state: 'live', status: 'Published', configId: 'run-1', version: '3.0' });
        });

        it('should prefer the newest run configuration over an older one', () => {
            const result = summarizeModelStatus([
                runConfig({ msdyn_aiconfigurationid: 'old', msdyn_majoriterationnumber: 1 }),
                runConfig({ msdyn_aiconfigurationid: 'new', msdyn_majoriterationnumber: 4, statuscode: 0, statecode: 0 })
            ], '');
            expect(result.configId).toBe('new');
            expect(result).toMatchObject({ state: 'draft', status: 'Draft', version: '4.0' });
        });

        it('should fall back to the training configuration when there is no run configuration', () => {
            const result = summarizeModelStatus([trainConfig({ statuscode: 9, statecode: 3 })], '');
            expect(result).toEqual({ state: 'failed', status: 'Train failed', configId: 'train-1', version: '1.0' });
        });

        it('should report a published-but-superseded configuration as published, not live', () => {
            const result = summarizeModelStatus([runConfig()], 'a-different-config');
            expect(result.state).toBe('published');
        });

        it('should return an empty status for a model with no configurations', () => {
            expect(summarizeModelStatus([], 'x')).toEqual({ state: '', status: '', configId: '', version: '' });
            expect(summarizeModelStatus(null).state).toBe('');
        });
    });

    describe('applyPromptSettings', () => {
        const config = JSON.stringify({
            version: 'GptDynamicPrompt-2',
            prompt: [{ type: 'literal', text: 'hi' }],
            definitions: { output: { formats: ['text'] } },
            modelParameters: { modelType: 'gpt-41-mini', gptParameters: { temperature: 0 } },
            settings: { recordRetrievalLimit: 30, runtime: null },
            code: 'keep me',
            signature: 'sig'
        });
        const settings = {
            temperature: 0.3,
            recordRetrievalLimit: 230,
            contentModerationLevel: 'High',
            preserveRecordLinks: true,
            codeInterpreter: true
        };

        it('should write the edited settings into the configuration', () => {
            const result = JSON.parse(applyPromptSettings(config, settings));
            expect(result.modelParameters.gptParameters.temperature).toBe(0.3);
            expect(result.settings.recordRetrievalLimit).toBe(230);
            expect(result.settings.contentModerationLevel).toBe('High');
            expect(result.settings.shouldPreserveRecordLinks).toBe(true);
            // The toggle is stored as a runtime name, not a boolean.
            expect(result.settings.runtime).toBe('codeinterpreter');
        });

        it('should clear the runtime when the code interpreter is turned off', () => {
            const result = JSON.parse(applyPromptSettings(config, { ...settings, codeInterpreter: false }));
            expect(result.settings.runtime).toBeNull();
        });

        it('should preserve everything the settings editor does not own', () => {
            const result = JSON.parse(applyPromptSettings(config, settings));
            expect(result.prompt).toEqual([{ type: 'literal', text: 'hi' }]);
            expect(result.definitions).toEqual({ output: { formats: ['text'] } });
            expect(result.modelParameters.modelType).toBe('gpt-41-mini');
            expect(result.code).toBe('keep me');
            expect(result.signature).toBe('sig');
        });

        it('should throw on an unparsable configuration', () => {
            expect(() => applyPromptSettings('not json', settings)).toThrow();
        });
    });

    describe('getAiConfigurationStatus', () => {
        it('should report Published only for statuscode 7', async () => {
            const retrieveRecord = vi.fn().mockResolvedValue({ statuscode: 7 });

            const result = await AgentService.getAiConfigurationStatus(retrieveRecord, 'cfg-1');

            expect(retrieveRecord).toHaveBeenCalledWith('msdyn_aiconfigurations', 'cfg-1', '?$select=statuscode');
            expect(result).toEqual({ statusCode: 7, status: 'Published', isPublished: true });
        });

        it('should report Publishing as not yet published', async () => {
            const retrieveRecord = vi.fn().mockResolvedValue({ statuscode: 3 });

            const result = await AgentService.getAiConfigurationStatus(retrieveRecord, 'cfg-1');

            expect(result).toEqual({ statusCode: 3, status: 'Publishing', isPublished: false });
        });

        it('should not call the API without a configuration id', async () => {
            const retrieveRecord = vi.fn();

            const result = await AgentService.getAiConfigurationStatus(retrieveRecord, '');

            expect(result).toEqual({ statusCode: null, status: '', isPublished: false });
            expect(retrieveRecord).not.toHaveBeenCalled();
        });
    });

    describe('formatSolutionLabel', () => {
        it('should format as "Display Name (uniquename)" when they differ', () => {
            expect(formatSolutionLabel('My Solution', 'mysol', 's1')).toBe('My Solution (mysol)');
        });

        it('should collapse to a single token when friendly equals unique', () => {
            expect(formatSolutionLabel('Active', 'Active', 's1')).toBe('Active');
        });

        it('should fall back to the unique name when no friendly name', () => {
            expect(formatSolutionLabel('', 'custom_sol', 's1')).toBe('custom_sol');
        });

        it('should fall back to the id when nothing else is available', () => {
            expect(formatSolutionLabel('', '', 's1')).toBe('s1');
        });
    });

    describe('getSolutionNamesByIds', () => {
        it('should resolve labels for visible solution ids only', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [
                    { solutionid: 's1', friendlyname: 'My Solution', uniquename: 'mysol' },
                    { solutionid: 's2', friendlyname: '', uniquename: 'custom_sol' }
                ]
            });
            const result = await AgentService.getSolutionNamesByIds(retrieveMultipleRecords, ['s1', 's2', 's1']);
            expect(result).toEqual({ s1: 'My Solution (mysol)', s2: 'custom_sol' });
            // De-duplicated, single chunk, and restricted to visible solutions (hides "Active").
            expect(retrieveMultipleRecords).toHaveBeenCalledTimes(1);
            const query = retrieveMultipleRecords.mock.calls[0][1];
            expect(query).toContain('solutionid eq s1');
            expect(query).toContain('isvisible eq true');
        });

        it('should return an empty map for no ids and not query', async () => {
            const retrieveMultipleRecords = vi.fn();
            const result = await AgentService.getSolutionNamesByIds(retrieveMultipleRecords, []);
            expect(result).toEqual({});
            expect(retrieveMultipleRecords).not.toHaveBeenCalled();
        });

        it('should tolerate a query failure and return what it resolved', async () => {
            const retrieveMultipleRecords = vi.fn().mockRejectedValue(new Error('no access'));
            const result = await AgentService.getSolutionNamesByIds(retrieveMultipleRecords, ['s1']);
            expect(result).toEqual({});
        });
    });

    describe('getSolutionMemberships', () => {
        it('should map each record id to the solutions it belongs to (via solutioncomponent)', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [
                    { objectid: 'bot-1', _solutionid_value: 'sol-default' },
                    { objectid: 'bot-1', _solutionid_value: 'sol-custom' },
                    { objectid: 'bot-2', _solutionid_value: 'sol-default' }
                ]
            });

            const result = await AgentService.getSolutionMemberships(retrieveMultipleRecords, ['bot-1', 'bot-2', 'bot-1']);

            expect(retrieveMultipleRecords).toHaveBeenCalledWith('solutioncomponents', expect.any(String));
            const query = retrieveMultipleRecords.mock.calls[0][1];
            expect(query).toContain('objectid eq bot-1');
            expect(query).toContain('_solutionid_value');
            expect(result).toEqual({
                'bot-1': ['sol-default', 'sol-custom'],
                'bot-2': ['sol-default']
            });
        });

        it('should return an empty map for no ids and not query', async () => {
            const retrieveMultipleRecords = vi.fn();
            const result = await AgentService.getSolutionMemberships(retrieveMultipleRecords, []);
            expect(result).toEqual({});
            expect(retrieveMultipleRecords).not.toHaveBeenCalled();
        });

        it('should tolerate a query failure and return what it resolved', async () => {
            const retrieveMultipleRecords = vi.fn().mockRejectedValue(new Error('no access'));
            const result = await AgentService.getSolutionMemberships(retrieveMultipleRecords, ['bot-1']);
            expect(result).toEqual({});
        });
    });

    describe('updateAgentComponent', () => {
        it('should PATCH the given field of a botcomponent', async () => {
            const updateRecord = vi.fn().mockResolvedValue({});
            await AgentService.updateAgentComponent(updateRecord, 'c1', 'data', 'yaml-text');
            expect(updateRecord).toHaveBeenCalledWith('botcomponents', 'c1', { data: 'yaml-text' });
        });
    });

    describe('setComponentState', () => {
        it('should activate a component with statecode 0', async () => {
            const updateRecord = vi.fn().mockResolvedValue({});
            await AgentService.setComponentState(updateRecord, 'c1', true);
            expect(updateRecord).toHaveBeenCalledWith('botcomponents', 'c1', { statecode: 0 });
        });

        it('should deactivate a component with statecode 1', async () => {
            const updateRecord = vi.fn().mockResolvedValue({});
            await AgentService.setComponentState(updateRecord, 'c1', false);
            expect(updateRecord).toHaveBeenCalledWith('botcomponents', 'c1', { statecode: 1 });
        });
    });

    describe('updateAgentConfiguration', () => {
        it('should PATCH the bot configuration', async () => {
            const updateRecord = vi.fn().mockResolvedValue({});
            await AgentService.updateAgentConfiguration(updateRecord, 'bot-1', '{"a":1}');
            expect(updateRecord).toHaveBeenCalledWith('bots', 'bot-1', { configuration: '{"a":1}' });
        });
    });

    describe('updateAiConfiguration', () => {
        it('should PATCH the customconfiguration of an AI configuration', async () => {
            const updateRecord = vi.fn().mockResolvedValue({});
            await AgentService.updateAiConfiguration(updateRecord, 'cfg-1', '{"prompt":[]}');
            expect(updateRecord).toHaveBeenCalledWith('msdyn_aiconfigurations', 'cfg-1', { msdyn_customconfiguration: '{"prompt":[]}' });
        });
    });

    describe('publishAgent', () => {
        it('should POST the bound PvaPublish action with no parameters', async () => {
            const webApiFetch = vi.fn().mockResolvedValue({});
            await AgentService.publishAgent(webApiFetch, 'bot-1');
            expect(webApiFetch).toHaveBeenCalledWith('POST', 'bots(bot-1)/Microsoft.Dynamics.CRM.PvaPublish', '', {});
        });
    });

    describe('getAgentLinks', () => {
        it('should aggregate distinct flows, models, and tools from component expands', async () => {
            const retrieveMultipleRecords = vi.fn()
                .mockResolvedValueOnce({
                    entities: [
                        {
                            botcomponentid: 'c1',
                            botcomponent_workflow: [{ workflowid: 'w1', name: 'Flow A', statecode: 1 }],
                            botcomponent_msdyn_aimodel: [{ msdyn_aimodelid: 'm1', msdyn_name: 'Model A' }]
                        },
                        {
                            botcomponentid: 'c2',
                            botcomponent_workflow: [{ workflowid: 'w1', name: 'Flow A', statecode: 1 }]
                        }
                    ]
                })
                .mockResolvedValueOnce({
                    entities: [{ botcomponentid: 'c1', botcomponent_aipluginoperation: [{ aipluginoperationid: 'p1', name: 'Tool A' }] }]
                });

            const result = await AgentService.getAgentLinks(retrieveMultipleRecords, 'bot-1');

            expect(result.flows).toEqual([{ id: 'w1', name: 'Flow A', statecode: 1 }]); // deduped
            expect(result.models).toEqual([{ id: 'm1', name: 'Model A' }]);
            expect(result.tools).toEqual([{ id: 'p1', name: 'Tool A' }]);
        });

        it('should return empty arrays when botId is missing', async () => {
            const result = await AgentService.getAgentLinks(vi.fn(), '');
            expect(result).toEqual({ flows: [], models: [], tools: [] });
        });

        it('should degrade gracefully when the flows/models query fails', async () => {
            const retrieveMultipleRecords = vi.fn()
                .mockRejectedValueOnce(new Error('no expand'))
                .mockResolvedValueOnce({
                    entities: [{ botcomponent_aipluginoperation: [{ aipluginoperationid: 'p1', name: 'Tool A' }] }]
                });

            const result = await AgentService.getAgentLinks(retrieveMultipleRecords, 'bot-1');

            expect(result.flows).toEqual([]);
            expect(result.models).toEqual([]);
            expect(result.tools).toEqual([{ id: 'p1', name: 'Tool A' }]);
        });
    });

    describe('getAgentFlows', () => {
        it('should query Copilot Studio agent flows (modernflowtype=1) and map them', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{
                    workflowid: 'wf-1',
                    name: 'Power-Toolkit Workflow',
                    description: 'Emails on new mail',
                    statecode: 1,
                    ismanaged: false,
                    'statecode@OData.Community.Display.V1.FormattedValue': 'Activated',
                    '_ownerid_value@OData.Community.Display.V1.FormattedValue': 'Mohammed Khawatme',
                    '_createdby_value@OData.Community.Display.V1.FormattedValue': 'Mohammed Khawatme',
                    'createdon@OData.Community.Display.V1.FormattedValue': '6/1/2026 8:00 AM',
                    'modifiedon@OData.Community.Display.V1.FormattedValue': '6/2/2026 9:44 AM'
                }]
            });

            const result = await AgentService.getAgentFlows(retrieveMultipleRecords);

            expect(retrieveMultipleRecords).toHaveBeenCalledWith('workflows', expect.any(String), expect.any(Object));
            const query = retrieveMultipleRecords.mock.calls[0][1];
            expect(query).toContain('category eq 5');
            expect(query).toContain('type eq 1');
            expect(query).toContain('modernflowtype eq 1');
            expect(query).toContain('ismanaged');
            expect(query).toContain('_createdby_value');
            expect(query).toContain('$orderby=modifiedon desc');
            expect(result).toEqual([{
                id: 'wf-1',
                name: 'Power-Toolkit Workflow',
                description: 'Emails on new mail',
                statecode: 1,
                stateLabel: 'Activated',
                isManaged: false,
                owner: 'Mohammed Khawatme',
                createdOn: '6/1/2026 8:00 AM',
                modifiedOn: '6/2/2026 9:44 AM',
                createdBy: 'Mohammed Khawatme'
            }]);
        });

        it('should return an empty array when there are no agent flows', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({ entities: [] });
            const result = await AgentService.getAgentFlows(retrieveMultipleRecords);
            expect(result).toEqual([]);
        });

        it('should fall back to the unnamed label when a flow has no name', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({ entities: [{ workflowid: 'wf-2', statecode: 0 }] });
            const result = await AgentService.getAgentFlows(retrieveMultipleRecords);
            expect(result[0].name).toBe('(unnamed flow)');
        });
    });

    describe('isInstructionsComponent', () => {
        it('should return true for the Custom GPT component type', () => {
            expect(isInstructionsComponent({ componentType: 15 })).toBe(true);
        });

        it('should return false for other component types', () => {
            expect(isInstructionsComponent({ componentType: 0 })).toBe(false);
            expect(isInstructionsComponent(null)).toBe(false);
        });
    });

    describe('getComponentKind', () => {
        it('should disambiguate type 9 by the schema-name kind segment', () => {
            expect(getComponentKind({ componentType: 9, schemaName: 'cr_bot645.agent.Agent' })).toBe('connectedAgent');
            expect(getComponentKind({ componentType: 9, schemaName: 'cr_bot645.InvokeConnectedAgentTaskAction.AgentA' })).toBe('connectedAgent');
            expect(getComponentKind({ componentType: 9, schemaName: 'cr_bot645.action.AddRow' })).toBe('action');
            expect(getComponentKind({ componentType: 9, schemaName: 'cr_bot645.skill.testskill_oII' })).toBe('action');
            expect(getComponentKind({ componentType: 9, schemaName: 'cr_bot645.topic.Greeting' })).toBe('topic');
        });

        it('should treat a modern ConnectedAgentTool action as a connected agent, not a tool', () => {
            // Modern connected agents are `.action.` components — the discriminator is in the data.
            expect(getComponentKind({
                componentType: 9,
                schemaName: 'cr297_parent.action.cr297_hrassistant_czg8r6_PvS7xcLu',
                data: 'kind: ConnectedAgentTool\r\nhistoryType:\r\n  kind: ConversationHistory\r\n\r\nbotSchemaName: cr297_hrassistant_czg8r6'
            })).toBe('connectedAgent');
            // A plain action with other data stays a tool.
            expect(getComponentKind({
                componentType: 9, schemaName: 'cr297_parent.action.AddRow', data: 'kind: SomeOtherAction'
            })).toBe('action');
        });

        it('should classify reliably by component type', () => {
            expect(getComponentKind({ componentType: 15, schemaName: 'cr_bot645.gpt.default' })).toBe('instructions');
            expect(getComponentKind({ componentType: 16, schemaName: 'cr_bot645.topic.kb' })).toBe('knowledge');
            expect(getComponentKind({ componentType: 17, schemaName: 'cr_bot645.ExternalTriggerComponent.x' })).toBe('trigger');
            expect(getComponentKind({ componentType: 19, schemaName: 'cr_bot645.test.EvalSet' })).toBe('test');
        });

        it('should default type 9 with no known kind to topic', () => {
            expect(getComponentKind({ componentType: 9, schemaName: '' })).toBe('topic');
        });
    });

    describe('extractAgentInstructions', () => {
        it('should read instructions from a modern agent configuration and strip the code fence', () => {
            const configuration = JSON.stringify({
                $kind: 'BotConfiguration',
                agentSettings: {
                    $kind: 'AgentSettings',
                    instructions: {
                        $kind: 'Instructions',
                        segments: [{ $kind: 'StaticSegment', value: '```\nYou are the HR Assistant.\nBe concise.\n```' }]
                    }
                }
            });
            expect(extractAgentInstructions(configuration)).toBe('You are the HR Assistant.\nBe concise.');
        });

        it('should concatenate multiple segments and ignore non-string values', () => {
            const configuration = JSON.stringify({
                agentSettings: { instructions: { segments: [
                    { $kind: 'StaticSegment', value: 'Part one. ' },
                    { $kind: 'VariableSegment' },
                    { $kind: 'StaticSegment', value: 'Part two.' }
                ] } }
            });
            expect(extractAgentInstructions(configuration)).toBe('Part one. Part two.');
        });

        it('should accept an already-parsed configuration object', () => {
            const cfg = { agentSettings: { instructions: { segments: [{ value: 'Inline text' }] } } };
            expect(extractAgentInstructions(cfg)).toBe('Inline text');
        });

        it('should return an empty string for legacy/empty/invalid configurations', () => {
            expect(extractAgentInstructions(null)).toBe('');
            expect(extractAgentInstructions('not json')).toBe('');
            expect(extractAgentInstructions('{"gPTSettings":{"defaultSchemaName":"x.gpt.default"}}')).toBe('');
            expect(extractAgentInstructions('{"agentSettings":{"instructions":{"segments":[]}}}')).toBe('');
        });
    });

    describe('agentInstructionsEditable', () => {
        it('is true when every instruction segment is plain text', () => {
            const cfg = { agentSettings: { instructions: { segments: [
                { $kind: 'StaticSegment', value: '```\nBe helpful.\n```' }
            ] } } };
            expect(agentInstructionsEditable(cfg)).toBe(true);
        });

        it('is false when any segment is a reference (no string value)', () => {
            const cfg = { agentSettings: { instructions: { segments: [
                { $kind: 'StaticSegment', value: 'Part one ' },
                { $kind: 'VariableSegment' }
            ] } } };
            expect(agentInstructionsEditable(cfg)).toBe(false);
        });

        it('is false for legacy / empty / invalid configurations', () => {
            expect(agentInstructionsEditable(null)).toBe(false);
            expect(agentInstructionsEditable('not json')).toBe(false);
            expect(agentInstructionsEditable('{"agentSettings":{"instructions":{"segments":[]}}}')).toBe(false);
        });
    });

    describe('applyAgentInstructions', () => {
        it('writes edited text back as one static segment, preserving the fence and other fields', () => {
            const configuration = JSON.stringify({
                $kind: 'BotConfiguration',
                agentSettings: {
                    model: { series: 'GPT5Chat' },
                    instructions: { $kind: 'Instructions', segments: [{ $kind: 'StaticSegment', value: '```\nOld.\n```' }] }
                }
            });
            const updated = JSON.parse(applyAgentInstructions(configuration, 'New instructions.'));
            expect(updated.agentSettings.instructions.segments).toEqual([
                { $kind: 'StaticSegment', value: '```\nNew instructions.\n```' }
            ]);
            expect(updated.agentSettings.model.series).toBe('GPT5Chat');
            expect(updated.$kind).toBe('BotConfiguration');
        });

        it('round-trips extract → apply back to the original stored value', () => {
            const configuration = JSON.stringify({
                agentSettings: { instructions: { segments: [{ $kind: 'StaticSegment', value: '```\nYou are the HR Assistant.\n```' }] } }
            });
            const updated = JSON.parse(applyAgentInstructions(configuration, extractAgentInstructions(configuration)));
            expect(updated.agentSettings.instructions.segments[0].value).toBe('```\nYou are the HR Assistant.\n```');
        });

        it('stores plain text when the original had no code fence', () => {
            const configuration = JSON.stringify({ agentSettings: { instructions: { segments: [{ value: 'plain' }] } } });
            const updated = JSON.parse(applyAgentInstructions(configuration, 'edited'));
            expect(updated.agentSettings.instructions.segments[0].value).toBe('edited');
        });

        it('does not mutate a passed-in configuration object', () => {
            const cfg = { agentSettings: { instructions: { segments: [{ $kind: 'StaticSegment', value: 'old' }] } } };
            applyAgentInstructions(cfg, 'new');
            expect(cfg.agentSettings.instructions.segments[0].value).toBe('old');
        });

        it('throws when the configuration has no instruction segments', () => {
            expect(() => applyAgentInstructions('{"agentSettings":{}}', 'x')).toThrow();
        });
    });

    describe('extractAgentModel', () => {
        it('should read the model series from a modern agent configuration', () => {
            const cfg = JSON.stringify({ agentSettings: { model: { $kind: 'ModelConfig', series: 'GPT5Chat' } } });
            expect(extractAgentModel(cfg)).toBe('GPT5Chat');
            expect(extractAgentModel({ agentSettings: { model: { series: 'GPT4o' } } })).toBe('GPT4o');
        });

        it('should return an empty string when absent or invalid', () => {
            expect(extractAgentModel(null)).toBe('');
            expect(extractAgentModel('not json')).toBe('');
            expect(extractAgentModel('{"gPTSettings":{}}')).toBe('');
        });
    });

    describe('extractConnectedAgentSchema', () => {
        it('should pull the child agent schema name from a ConnectedAgentTool', () => {
            const component = { data: 'kind: ConnectedAgentTool\r\nhistoryType:\r\n  kind: ConversationHistory\r\n\r\nbotSchemaName: cr297_hrassistant_czg8r6' };
            expect(extractConnectedAgentSchema(component)).toBe('cr297_hrassistant_czg8r6');
        });

        it('should return an empty string when there is no botSchemaName', () => {
            expect(extractConnectedAgentSchema({ data: 'kind: InlineAgentSkill' })).toBe('');
            expect(extractConnectedAgentSchema({})).toBe('');
        });
    });

    describe('classifyAgentKind', () => {
        it('should classify a cliagent template as modern', () => {
            expect(classifyAgentKind('cliagent-1.0.0')).toEqual({ modern: true, key: 'modern' });
            expect(classifyAgentKind('CLIAGENT-2.0.0')).toEqual({ modern: true, key: 'modern' });
        });

        it('should classify other/empty templates as classic', () => {
            expect(classifyAgentKind('empty-1.0.0')).toEqual({ modern: false, key: 'classic' });
            expect(classifyAgentKind('')).toEqual({ modern: false, key: 'classic' });
            expect(classifyAgentKind(null)).toEqual({ modern: false, key: 'classic' });
        });
    });

    describe('extractConnectedAgentName', () => {
        it('should pull the child agent name from a legacy modelDisplayName', () => {
            const component = { data: 'kind: TaskDialog\nmodelDisplayName: Power-Toolkit Agent As\naction:\n  kind: InvokeConnectedAgentTaskAction' };
            expect(extractConnectedAgentName(component)).toBe('Power-Toolkit Agent As');
        });

        it('should return an empty string when there is no modelDisplayName', () => {
            expect(extractConnectedAgentName({ data: 'kind: ConnectedAgentTool' })).toBe('');
            expect(extractConnectedAgentName({})).toBe('');
        });
    });

    describe('getComponentDescription', () => {
        it('should return the description column when present', () => {
            expect(getComponentDescription({ description: 'Column desc', data: '' })).toBe('Column desc');
        });

        it('should fall back to a description line in the data YAML (inline connected agent)', () => {
            const data = 'kind: AgentDialog\r\nbeginDialog:\r\n  kind: OnToolSelected\r\n  description: Test child agent\r\nsettings:\r\n  instructions: hi';
            expect(getComponentDescription({ description: '', data })).toBe('Test child agent');
        });

        it('should return an empty string when no description is found', () => {
            expect(getComponentDescription({ description: '', data: 'kind: AgentDialog' })).toBe('');
        });
    });

    describe('extractPromptText', () => {
        it('should reconstruct readable text from GptDynamicPrompt segments', () => {
            const config = JSON.stringify({
                prompt: [
                    { type: 'literal', text: 'Summarize: ' },
                    { type: 'inputVariable', id: 'Input' },
                    { type: 'literal', text: ' now' }
                ]
            });
            expect(extractPromptText(config)).toBe('Summarize: {Input} now');
        });

        it('should keep the bound Dataverse column a data segment refers to', () => {
            // Real AI Builder payload: dropping the `data` segment rewrote the prompt as
            // "Translate   to english", losing the column the prompt is actually about.
            const config = JSON.stringify({
                prompt: [
                    { type: 'literal', text: 'Translate  ' },
                    { type: 'data', id: 'pt_project.pt_textde', text: 'Project.Text in DE' },
                    { type: 'literal', text: ' to english' }
                ]
            });
            expect(extractPromptText(config)).toBe('Translate  {Project.Text in DE} to english');
        });

        it('should fall back to a data segment id when it carries no label', () => {
            const config = JSON.stringify({
                prompt: [{ type: 'data', id: 'pt_project.pt_textde' }]
            });
            expect(extractPromptText(config)).toBe('{pt_project.pt_textde}');
        });

        it('should render powerFx and document-input segments as placeholders', () => {
            const config = JSON.stringify({
                prompt: [
                    { type: 'literal', text: 'print Hello! ' },
                    { type: 'inputVariable', id: 'Document_20input' },
                    { type: 'literal', text: ' ' },
                    { type: 'powerFx', id: 'Power_20Fx_20formula', text: 'Power Fx formula' }
                ]
            });
            expect(extractPromptText(config)).toBe('print Hello! {Document_20input} {Power Fx formula}');
        });

        it('should show an input variable\'s friendly label when declared', () => {
            const config = JSON.stringify({
                prompt: [
                    { type: 'literal', text: 'Hi ' },
                    { type: 'inputVariable', id: 'Text_20input' }
                ],
                definitions: { inputs: [{ id: 'Text_20input', text: 'Text input' }] }
            });
            expect(extractPromptText(config)).toBe('Hi {Text input}');
        });

        it('should return null for JSON without a prompt array', () => {
            expect(extractPromptText('{"foo":1}')).toBeNull();
        });

        it('should return null for invalid JSON', () => {
            expect(extractPromptText('not json')).toBeNull();
        });
    });

    describe('applyPromptText / rebuildPromptSegments', () => {
        const config = JSON.stringify({
            prompt: [
                { type: 'literal', text: 'Translate  ' },
                { type: 'data', id: 'pt_project.pt_textde', text: 'Project.Text in DE' },
                { type: 'literal', text: ' to english' },
                { type: 'inputVariable', id: 'Text_20input' }
            ],
            definitions: { inputs: [{ id: 'Text_20input', text: 'Text input' }] },
            settings: { recordRetrievalLimit: 30 }
        });

        it('should round-trip unchanged text back to equivalent segments', () => {
            const text = extractPromptText(config);
            const rebuilt = JSON.parse(applyPromptText(config, text)).prompt;
            expect(rebuilt).toEqual([
                { type: 'literal', text: 'Translate  ' },
                { type: 'data', id: 'pt_project.pt_textde', text: 'Project.Text in DE' },
                { type: 'literal', text: ' to english' },
                { type: 'inputVariable', id: 'Text_20input' }
            ]);
        });

        it('should apply an edit to the literal wording, preserving the tokens\' segments', () => {
            const edited = 'Convert {Project.Text in DE} into English for {Text input}';
            const rebuilt = JSON.parse(applyPromptText(config, edited)).prompt;
            expect(rebuilt).toEqual([
                { type: 'literal', text: 'Convert ' },
                { type: 'data', id: 'pt_project.pt_textde', text: 'Project.Text in DE' },
                { type: 'literal', text: ' into English for ' },
                { type: 'inputVariable', id: 'Text_20input' }
            ]);
        });

        it('should keep an unrecognised token as literal text rather than dropping it', () => {
            const rebuilt = rebuildPromptSegments('Hello {Unknown} world', { prompt: [] });
            expect(rebuilt).toEqual([{ type: 'literal', text: 'Hello {Unknown} world' }]);
        });

        it('should leave every other field of the config untouched', () => {
            const updated = JSON.parse(applyPromptText(config, 'Just text'));
            expect(updated.definitions).toEqual({ inputs: [{ id: 'Text_20input', text: 'Text input' }] });
            expect(updated.settings).toEqual({ recordRetrievalLimit: 30 });
            expect(updated.prompt).toEqual([{ type: 'literal', text: 'Just text' }]);
        });

        it('should throw on an unparsable configuration', () => {
            expect(() => applyPromptText('not json', 'x')).toThrow();
        });
    });

    describe('extractPromptMetadata', () => {
        const promptConfig = JSON.stringify({
            version: 'GptDynamicPrompt-2',
            prompt: [{ type: 'literal', text: 'Translate' }],
            definitions: {
                inputs: [{ id: 'PromptColumnRecordId', text: 'PromptColumnRecordId', type: 'text' }],
                data: [{
                    id: 'pt_project',
                    displayName: 'Project',
                    type: 'dataverseTable',
                    filters: [{ filterType: 'equal', attribute: 'pt_projectid', value: 'PromptColumnRecordId' }]
                }],
                output: { formats: ['text'] }
            },
            modelParameters: { modelType: 'gpt-41-mini', gptParameters: { temperature: 0 } },
            settings: { recordRetrievalLimit: 30 }
        });

        it('should extract the LLM and its tuning', () => {
            const meta = extractPromptMetadata(promptConfig);
            expect(meta.modelType).toBe('gpt-41-mini');
            expect(meta.temperature).toBe(0);
            expect(meta.recordRetrievalLimit).toBe(30);
            expect(meta.outputFormats).toEqual(['text']);
        });

        it('should extract the advanced prompt settings', () => {
            const config = JSON.stringify({
                prompt: [{ type: 'literal', text: 'x' }],
                modelParameters: { modelType: 'gpt-5-chat', gptParameters: { temperature: 0.3 } },
                settings: {
                    recordRetrievalLimit: 230,
                    shouldPreserveRecordLinks: true,
                    runtime: 'codeinterpreter',
                    enableExtendedExecution: false,
                    contentModerationLevel: 'High'
                }
            });

            const meta = extractPromptMetadata(config);
            expect(meta.modelType).toBe('gpt-5-chat');
            expect(meta.temperature).toBe(0.3);
            expect(meta.recordRetrievalLimit).toBe(230);
            expect(meta.contentModerationLevel).toBe('High');
            expect(meta.preserveRecordLinks).toBe(true);
            expect(meta.codeInterpreter).toBe(true);
        });

        it('should leave record links null and code interpreter false when unset', () => {
            const meta = extractPromptMetadata(promptConfig);
            expect(meta.preserveRecordLinks).toBeNull();
            expect(meta.codeInterpreter).toBe(false);
            expect(meta.contentModerationLevel).toBe('');
        });

        it('should expose stored generated code and its signature', () => {
            const config = JSON.stringify({
                prompt: [{ type: 'literal', text: 'x' }],
                settings: { runtime: 'codeinterpreter' },
                code: 'print("hi")',
                signature: 'AQAAsig=='
            });
            const meta = extractPromptMetadata(config);
            expect(meta.code).toBe('print("hi")');
            expect(meta.signature).toBe('AQAAsig==');
        });

        it('should extract embedded Power Fx formulas', () => {
            const config = JSON.stringify({
                prompt: [{ type: 'powerFx', id: 'Power_20Fx_20formula', text: 'Power Fx formula' }],
                definitions: {
                    formulas: [{ id: 'Power_20Fx_20formula', type: 'powerFx', displayName: 'Power Fx formula', content: 'With({h: Hour(Now())}, "hi")' }]
                }
            });

            expect(extractPromptMetadata(config).formulas).toEqual([
                { name: 'Power Fx formula', content: 'With({h: Hour(Now())}, "hi")' }
            ]);
        });

        it('should extract the grounding data sources with readable filters', () => {
            const meta = extractPromptMetadata(promptConfig);
            expect(meta.dataSources).toEqual([{
                name: 'Project',
                type: 'dataverseTable',
                filters: ['pt_projectid = {PromptColumnRecordId}']
            }]);
        });

        it('should extract declared inputs', () => {
            expect(extractPromptMetadata(promptConfig).inputs).toEqual([
                { name: 'PromptColumnRecordId', type: 'text' }
            ]);
        });

        it('should return null when the config is not a prompt', () => {
            expect(extractPromptMetadata('{"foo":1}')).toBeNull();
            expect(extractPromptMetadata('not json')).toBeNull();
        });

        it('should tolerate a prompt with no definitions block', () => {
            const meta = extractPromptMetadata('{"prompt":[]}');
            expect(meta.dataSources).toEqual([]);
            expect(meta.temperature).toBeNull();
        });
    });

    describe('parseAiConfigErrors', () => {
        it('should parse an overallError and use the code when the message is null', () => {
            const raw = '{"overallError":{"dateTime":"2026-07-23T20:39:49.17Z","type":"Error","code":"InternalError","message":null,"innerErrors":[]}}';
            expect(parseAiConfigErrors(raw)).toEqual({
                code: 'InternalError',
                message: 'InternalError',
                type: 'Error',
                dateTime: '2026-07-23T20:39:49.17Z',
                innerErrors: []
            });
        });

        it('should flatten inner error messages', () => {
            const raw = JSON.stringify({
                overallError: { code: 'Bad', message: 'Bad thing', innerErrors: [{ message: 'root cause' }, { code: 'X' }] }
            });
            expect(parseAiConfigErrors(raw).innerErrors).toEqual(['root cause', 'X']);
        });

        it('should return null for empty, absent or unparsable errors', () => {
            expect(parseAiConfigErrors(null)).toBeNull();
            expect(parseAiConfigErrors('{}')).toBeNull();
            expect(parseAiConfigErrors('not json')).toBeNull();
        });

        it('should treat the literal string "null" as no error', () => {
            // AI Builder writes the four-character string "null" into this column after a save.
            expect(parseAiConfigErrors('null')).toBeNull();
        });
    });

    describe('summarizeDataBinding', () => {
        it('should summarize the bound table, predicted column and feature count', () => {
            const raw = JSON.stringify({
                schemaVersion: 2,
                input: {
                    schemaName: 'systemuser',
                    queries: { global: { type: 'fetchXml', query: '' } },
                    attributes: [
                        { specificationName: 'Label', dataType: 'Picklist', schemaName: 'accessmode' },
                        { schemaName: 'firstname' },
                        { schemaName: 'lastname' }
                    ],
                    relatedEntities: [
                        { schemaName: 'business_unit_system_users', isSelected: false },
                        { schemaName: 'queue_system_user', isSelected: true }
                    ]
                }
            });

            expect(summarizeDataBinding(raw)).toEqual({
                entity: 'systemuser',
                labelAttribute: 'accessmode',
                labelDataType: 'Picklist',
                attributeCount: 3,
                columns: [
                    { schemaName: 'accessmode', role: 'Label' },
                    { schemaName: 'firstname', role: '' },
                    { schemaName: 'lastname', role: '' }
                ],
                relatedSelected: 1,
                relatedTotal: 2,
                query: ''
            });
        });

        it('should surface the FetchXML a dataset binding runs', () => {
            const raw = JSON.stringify({
                input: {
                    schemaName: 'msdyn_aibdatasetfile',
                    queries: { train: { type: 'fetchXml', query: '<fetch><entity name="x"/></fetch>' } }
                }
            });

            const summary = summarizeDataBinding(raw);
            expect(summary.entity).toBe('msdyn_aibdatasetfile');
            expect(summary.query).toContain('<fetch>');
            expect(summary.attributeCount).toBe(0);
        });

        it('should omit the predicted column for a binding that names no Label', () => {
            // Text classification binds text/tags/id instead of a Label — and ships no `queries`
            // or `relatedEntities` keys at all.
            const raw = JSON.stringify({
                schemaVersion: 2,
                input: {
                    schemaName: 'systemuser',
                    attributes: [
                        { specificationName: 'text', schemaName: 'internalemailaddress' },
                        { specificationName: 'tags', schemaName: 'fullname' },
                        { specificationName: 'id', schemaName: 'systemuserid' }
                    ]
                }
            });

            expect(summarizeDataBinding(raw)).toEqual({
                entity: 'systemuser',
                labelAttribute: '',
                labelDataType: '',
                attributeCount: 3,
                columns: [
                    { schemaName: 'internalemailaddress', role: 'text' },
                    { schemaName: 'fullname', role: 'tags' },
                    { schemaName: 'systemuserid', role: 'id' }
                ],
                relatedSelected: 0,
                relatedTotal: 0,
                query: ''
            });
        });

        it('should return null when the payload is not a binding', () => {
            expect(summarizeDataBinding('{"prompt":[]}')).toBeNull();
            expect(summarizeDataBinding('not json')).toBeNull();
        });
    });

    describe('parseModelPerformance', () => {
        // A trimmed real Text Classification payload: global scores + one per-tag detail.
        const raw = JSON.stringify({
            metrics: [
                { isGlobalScore: true, name: 'weightedF1', value: 0.9473684430122375, type: 'Percentage' },
                { isGlobalScore: false, name: 'macroF1', value: 0.9473683834075928, type: 'Percentage' },
                { isGlobalScore: false, name: 'accuracy', value: 0.9024389982223511, type: 'Percentage' }
            ],
            details: [{
                id: '{"BotName":"cr297_bot645100","BatchId":0}',
                category: 'tag',
                metrics: [
                    { name: 'numberOfCasesTotal', value: 112, type: 'Numerical' },
                    { name: 'numberOfCasesTestSet', value: 37, type: 'Numerical' },
                    { name: 'f1Score', value: 0.9473683834075928, type: 'Percentage' },
                    { name: 'precision', value: 0.9230769276618958, type: 'Percentage' },
                    { name: 'recall', value: 0.9729729890823364, type: 'Percentage' },
                    { name: 'grade', value: 2, type: 'Numerical' },
                    { name: 'numberOfFalsePositives', value: 3, type: 'Numerical' },
                    { name: 'falsePositiveTrueLabelDistribution', value: {}, type: 'DictionaryPercentageList' }
                ]
            }]
        });

        it('should normalize global scores, formatting percentages and keeping the 0–100 value for colouring', () => {
            const perf = parseModelPerformance(raw);
            expect(perf.headline.map(m => m.name)).toEqual(['weightedF1', 'macroF1', 'accuracy']);
            const accuracy = perf.headline.find(m => m.name === 'accuracy');
            expect(accuracy.display).toBe('90.2%');
            expect(accuracy.pct).toBeCloseTo(90.24, 1);
        });

        it('should map the per-category metrics, format counts as-is, and drop distribution dictionaries', () => {
            const perf = parseModelPerformance(raw);
            expect(perf.categories).toHaveLength(1);
            const category = perf.categories[0];
            expect(category.category).toBe('tag');
            const byName = Object.fromEntries(category.metrics.map(m => [m.name, m]));
            // Percentage → percent string; Numerical → as-is; non-numeric (distribution) → dropped.
            expect(byName.precision.display).toBe('92.3%');
            expect(byName.numberOfCasesTotal.display).toBe('112');
            expect(byName.numberOfCasesTotal.pct).toBeNull();
            expect(byName.falsePositiveTrueLabelDistribution).toBeUndefined();
        });

        it('should return null for empty, unparseable, or non-performance payloads', () => {
            expect(parseModelPerformance('not json')).toBeNull();
            expect(parseModelPerformance(null)).toBeNull();
            expect(parseModelPerformance('{}')).toBeNull();
            expect(parseModelPerformance(JSON.stringify({ metrics: [], details: [] }))).toBeNull();
        });
    });

    describe('decodeMaybeGzip', () => {
        it('should pass plain text through untouched', async () => {
            expect(await decodeMaybeGzip('{"a":1}')).toEqual({ text: '{"a":1}', compressed: false });
        });

        it('should return an empty string for a nullish value', async () => {
            expect(await decodeMaybeGzip(null)).toEqual({ text: '', compressed: false });
        });

        it('should decompress a gzip+base64 payload', async () => {
            // Same gzip+base64 encoding AI Builder uses for msdyn_modelrundataspecification.
            const packed = 'H4sIAAAAAAAACqtWKk7OSM1NDEstKs7Mz1OyMqoFAMb4J3ITAAAA';
            const result = await decodeMaybeGzip(packed);
            expect(result.compressed).toBe(true);
            expect(result.text).toBe('{"schemaVersion":2}');
        });

        it('should return the raw value when a gzip-looking payload cannot be decoded', async () => {
            const result = await decodeMaybeGzip('H4sInot-valid-base64!!');
            expect(result).toEqual({ text: 'H4sInot-valid-base64!!', compressed: false });
        });
    });

    describe('parseEvaluationSet', () => {
        const yaml = [
            'kind: EvaluationSet',
            'graders:',
            '  - kind: PromptGrader',
            '    name: Power-Toolkit Test set',
            '    instructions: what is the last created invoice',
            '    labels:',
            '      - name: Invoice',
            '        description: IN5',
            '        outcome: Pass',
            '',
            '      - name: Contract',
            '        description: C6',
            '        outcome: Fail'
        ].join('\n');

        it('should parse graders and their pass/fail labels', () => {
            const result = parseEvaluationSet(yaml);
            expect(result.graders).toHaveLength(1);
            const grader = result.graders[0];
            expect(grader.kind).toBe('PromptGrader');
            expect(grader.name).toBe('Power-Toolkit Test set');
            expect(grader.instructions).toBe('what is the last created invoice');
            expect(grader.labels).toEqual([
                { name: 'Invoice', description: 'IN5', outcome: 'Pass' },
                { name: 'Contract', description: 'C6', outcome: 'Fail' }
            ]);
        });

        it('should handle multiple graders', () => {
            const multi = yaml + '\n  - kind: PromptGrader\n    name: Second\n    instructions: check tone';
            const result = parseEvaluationSet(multi);
            expect(result.graders).toHaveLength(2);
            expect(result.graders[1].name).toBe('Second');
            expect(result.graders[1].labels).toEqual([]);
        });

        it('should return null for non-EvaluationSet data', () => {
            expect(parseEvaluationSet('kind: AgentDialog\nbeginDialog:')).toBeNull();
            expect(parseEvaluationSet('')).toBeNull();
            expect(parseEvaluationSet(null)).toBeNull();
        });
    });

    describe('parseEvaluationCase', () => {
        const yaml = [
            'kind: MultiTurnEvaluationCase',
            'source: Generated',
            'activities:',
            '  - activity:',
            '      value:',
            '        from:',
            '          role: user',
            '',
            '      text:',
            '        - Who do I contact for payroll issues?',
            '',
            '  - activity:',
            '      value:',
            '        from:',
            '          role: agent',
            '',
            '      text:',
            '        - Payroll issues are handled by our HR Assistant.',
            'extensionData:',
            '  displayOrder: "1783969402157"'
        ].join('\r\n');

        it('should parse a multi-turn evaluation case into ordered role/text turns', () => {
            const result = parseEvaluationCase(yaml);
            expect(result.turns).toEqual([
                { role: 'user', text: 'Who do I contact for payroll issues?' },
                { role: 'agent', text: 'Payroll issues are handled by our HR Assistant.' }
            ]);
        });

        it('should return null for an EvaluationSet or unrelated data', () => {
            expect(parseEvaluationCase('kind: EvaluationSet\ngraders:\n  - kind: GeneralQualityGrader')).toBeNull();
            expect(parseEvaluationCase('kind: InlineAgentSkill')).toBeNull();
            expect(parseEvaluationCase('')).toBeNull();
            expect(parseEvaluationCase(null)).toBeNull();
        });
    });

    describe('countUnpublishedComponents', () => {
        it('should count components modified after the last publish', () => {
            const comps = [
                { modifiedOnRaw: '2026-07-05T10:00:00Z' },
                { modifiedOnRaw: '2026-07-05T12:00:00Z' },
                { modifiedOnRaw: '2026-07-01T09:00:00Z' }
            ];
            expect(countUnpublishedComponents(comps, '2026-07-04T00:00:00Z')).toBe(2);
        });

        it('should treat every component as unpublished when never published', () => {
            expect(countUnpublishedComponents([{ modifiedOnRaw: 'x' }, {}], '')).toBe(2);
        });

        it('should return 0 for empty or invalid inputs', () => {
            expect(countUnpublishedComponents([], '2026-01-01T00:00:00Z')).toBe(0);
            expect(countUnpublishedComponents(null, '2026-01-01T00:00:00Z')).toBe(0);
        });
    });

    describe('getAgentPublishState', () => {
        it('should return raw and formatted publishedon', async () => {
            const webApiFetch = vi.fn(() => Promise.resolve({
                publishedon: '2026-07-22T10:00:00Z',
                'publishedon@OData.Community.Display.V1.FormattedValue': '7/22/2026 10:00 AM'
            }));
            const result = await AgentService.getAgentPublishState(webApiFetch, 'bot-1');
            expect(result).toEqual({ publishedOnRaw: '2026-07-22T10:00:00Z', publishedOn: '7/22/2026 10:00 AM' });
        });

        it('should fall back to the raw value when no formatted value is returned', async () => {
            const webApiFetch = vi.fn(() => Promise.resolve({ publishedon: '2026-07-22T10:00:00Z' }));
            const result = await AgentService.getAgentPublishState(webApiFetch, 'bot-1');
            expect(result.publishedOn).toBe('2026-07-22T10:00:00Z');
        });

        it('should return empty strings for an unpublished agent', async () => {
            const webApiFetch = vi.fn(() => Promise.resolve({}));
            expect(await AgentService.getAgentPublishState(webApiFetch, 'bot-1'))
                .toEqual({ publishedOnRaw: '', publishedOn: '' });
        });

        it('should not call the API without a bot id', async () => {
            const webApiFetch = vi.fn();
            expect(await AgentService.getAgentPublishState(webApiFetch, ''))
                .toEqual({ publishedOnRaw: '', publishedOn: '' });
            expect(webApiFetch).not.toHaveBeenCalled();
        });
    });

    describe('summarizeAgentComposition', () => {
        it('should count components by kind (excluding instructions) in order', () => {
            const comps = [
                { componentType: 15 },
                { componentType: 9, schemaName: 'x.topic.A' },
                { componentType: 9, schemaName: 'x.topic.B' },
                { componentType: 16 },
                { componentType: 19 },
                { schemaName: 'x.action.Tool' }
            ];
            expect(summarizeAgentComposition(comps)).toEqual([
                { kind: 'topic', count: 2 },
                { kind: 'action', count: 1 },
                { kind: 'knowledge', count: 1 },
                { kind: 'test', count: 1 }
            ]);
        });

        it('should return an empty array when there are no components', () => {
            expect(summarizeAgentComposition([])).toEqual([]);
            expect(summarizeAgentComposition(null)).toEqual([]);
        });
    });

    describe('parseAiEventData', () => {
        it('should extract consumption, units, feature, and model from event data', () => {
            const eventData = JSON.stringify({
                messageConsumption: { featureName: 'Text and generative AI tools (basic)', units: 2, consumption: 0.2 },
                consumptionSource: 'Api',
                partnerSource: 'Dataverse',
                llmModelName: 'gpt-4o-mini'
            });
            expect(parseAiEventData(eventData)).toEqual({
                featureName: 'Text and generative AI tools (basic)',
                units: 2,
                consumption: 0.2,
                llmModelName: 'gpt-4o-mini',
                consumptionSource: 'Api',
                partnerSource: 'Dataverse'
            });
        });

        it('should return null numerics and empty strings for invalid JSON', () => {
            expect(parseAiEventData('not json')).toEqual({
                featureName: '', units: null, consumption: null, llmModelName: '',
                consumptionSource: '', partnerSource: ''
            });
        });

        it('should tolerate missing messageConsumption', () => {
            const result = parseAiEventData('{}');
            expect(result.units).toBeNull();
            expect(result.consumption).toBeNull();
            expect(result.featureName).toBe('');
        });
    });

    describe('getAiBuilderRuns', () => {
        it('should map msdyn_aievent records to run objects with parsed event data', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [
                    {
                        msdyn_aieventid: 'ev-1',
                        msdyn_output: 'Hello',
                        msdyn_quicktest: true,
                        msdyn_datatype: 'Text',
                        [`msdyn_processingstatus${FV}`]: 'Succeeded',
                        [`statuscode${FV}`]: 'Active',
                        [`msdyn_processingdate${FV}`]: '5/31/2026',
                        createdon: '2026-05-31T14:18:19Z',
                        [`createdon${FV}`]: '5/31/2026',
                        [`_createdby_value${FV}`]: 'Mohammed Khawatme',
                        msdyn_eventdata: JSON.stringify({
                            messageConsumption: { featureName: 'Basic', units: 2, consumption: 0.2 },
                            llmModelName: 'gpt-4o'
                        })
                    }
                ]
            });

            const result = await AgentService.getAiBuilderRuns(retrieveMultipleRecords, 'model-1');

            expect(retrieveMultipleRecords).toHaveBeenCalledWith('msdyn_aievents', expect.stringContaining('_msdyn_aimodelid_value eq model-1'), expect.any(Object));
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                id: 'ev-1',
                output: 'Hello',
                quickTest: true,
                dataType: 'Text',
                processingStatus: 'Succeeded',
                status: 'Active',
                units: 2,
                consumption: 0.2,
                featureName: 'Basic',
                llmModelName: 'gpt-4o',
                createdBy: 'Mohammed Khawatme'
            });
        });

        it('should take credits from the msdyn_creditconsumed column and map the consumption source', async () => {
            // GPT-prompt runs have no messageConsumption block in event data; credits live in the
            // dedicated msdyn_creditconsumed column instead.
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [
                    {
                        msdyn_aieventid: 'ev-credit',
                        msdyn_creditconsumed: 4,
                        [`msdyn_consumptionsource${FV}`]: 'PowerApps',
                        msdyn_eventdata: '{}',
                        createdon: '2026-06-02T10:31:47Z'
                    }
                ]
            });

            const result = await AgentService.getAiBuilderRuns(retrieveMultipleRecords, 'model-1');

            expect(retrieveMultipleRecords).toHaveBeenCalledWith(
                'msdyn_aievents',
                expect.stringContaining('msdyn_creditconsumed'),
                expect.any(Object)
            );
            expect(result[0]).toMatchObject({
                id: 'ev-credit',
                consumption: 4,
                consumptionSource: 'PowerApps'
            });
        });

        it('should prefer the credit column over an event-data consumption value', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [
                    {
                        msdyn_aieventid: 'ev-both',
                        msdyn_creditconsumed: 3,
                        msdyn_eventdata: JSON.stringify({ messageConsumption: { consumption: 0.2, units: 2 } })
                    }
                ]
            });

            const result = await AgentService.getAiBuilderRuns(retrieveMultipleRecords, 'model-1');

            // Credits from the column win; units still come from event data.
            expect(result[0].consumption).toBe(3);
            expect(result[0].units).toBe(2);
        });

        it('should return an empty array when modelId is missing', async () => {
            const retrieveMultipleRecords = vi.fn();
            const result = await AgentService.getAiBuilderRuns(retrieveMultipleRecords, '');
            expect(result).toEqual([]);
            expect(retrieveMultipleRecords).not.toHaveBeenCalled();
        });

        it('should honor the top parameter', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({ entities: [] });
            await AgentService.getAiBuilderRuns(retrieveMultipleRecords, 'model-1', 5);
            expect(retrieveMultipleRecords).toHaveBeenCalledWith('msdyn_aievents', expect.stringContaining('$top=5'), expect.any(Object));
        });
    });

    describe('getAiBuilderRunInput', () => {
        it('should retrieve a run\'s input (msdyn_datainfo)', async () => {
            const retrieveRecord = vi.fn().mockResolvedValue({ msdyn_datainfo: '{"activities":[]}' });
            const result = await AgentService.getAiBuilderRunInput(retrieveRecord, 'ev-1');
            expect(retrieveRecord).toHaveBeenCalledWith('msdyn_aievents', 'ev-1', expect.stringContaining('msdyn_datainfo'));
            expect(result).toBe('{"activities":[]}');
        });

        it('should return null when the id is missing or the column is empty', async () => {
            const retrieveRecord = vi.fn().mockResolvedValue({ msdyn_datainfo: null });
            expect(await AgentService.getAiBuilderRunInput(retrieveRecord, '')).toBeNull();
            expect(retrieveRecord).not.toHaveBeenCalled();
            expect(await AgentService.getAiBuilderRunInput(retrieveRecord, 'ev-1')).toBeNull();
        });
    });

    describe('getPromptEvaluations', () => {
        it('should aggregate test cases and run batches', async () => {
            const retrieveMultipleRecords = vi.fn()
                .mockResolvedValueOnce({ entities: [{ msdyn_aitestcaseid: 'tc-1', msdyn_name: 'Case A', msdyn_expectedoutput: 'Hello' }] })
                .mockResolvedValueOnce({ entities: [{ msdyn_aitestrunbatchid: 'b-1', msdyn_name: 'Batch A', msdyn_completedon: '2026-07-25T00:27:23Z' }] });

            const result = await AgentService.getPromptEvaluations(retrieveMultipleRecords, 'obj-1');

            expect(result.testCases).toEqual([expect.objectContaining({ id: 'tc-1', name: 'Case A', expectedOutput: 'Hello' })]);
            expect(result.batches).toEqual([expect.objectContaining({ id: 'b-1', name: 'Batch A', state: 'completed' })]);
        });

        it('should not quote the Uniqueidentifier object filter on either table', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({ entities: [] });
            await AgentService.getPromptEvaluations(retrieveMultipleRecords, 'obj-1');

            const calls = retrieveMultipleRecords.mock.calls;
            const caseCall = calls.find(c => c[0] === 'msdyn_aitestcases');
            const batchCall = calls.find(c => c[0] === 'msdyn_aitestrunbatches');
            expect(caseCall[1]).toContain('msdyn_aiobjectid eq obj-1');
            expect(batchCall[1]).toContain('msdyn_aiobjectid eq obj-1');
            expect(caseCall[1]).not.toContain("'obj-1'");
        });

        it('should remain resilient when one table fails', async () => {
            const retrieveMultipleRecords = vi.fn()
                .mockRejectedValueOnce(new Error('no test case table'))
                .mockResolvedValueOnce({ entities: [{ msdyn_aitestrunbatchid: 'b-1', msdyn_name: 'Batch A' }] });

            const result = await AgentService.getPromptEvaluations(retrieveMultipleRecords, 'obj-1');

            expect(result.testCases).toEqual([]);
            expect(result.batches).toHaveLength(1);
        });

        it('should return empty collections when objectId is missing', async () => {
            const retrieveMultipleRecords = vi.fn();
            const result = await AgentService.getPromptEvaluations(retrieveMultipleRecords, '');
            expect(result).toEqual({ testCases: [], batches: [], criteria: null });
            expect(retrieveMultipleRecords).not.toHaveBeenCalled();
        });

        it('should derive batch state (failed when an error is present, running when not completed)', async () => {
            const retrieveMultipleRecords = vi.fn()
                .mockResolvedValueOnce({ entities: [] })
                .mockResolvedValueOnce({ entities: [
                    { msdyn_aitestrunbatchid: 'b-fail', msdyn_errormessage: 'boom', msdyn_completedon: '2026-07-25T00:27:23Z' },
                    { msdyn_aitestrunbatchid: 'b-run', msdyn_completedon: null }
                ] });

            const result = await AgentService.getPromptEvaluations(retrieveMultipleRecords, 'obj-1');

            expect(result.batches[0].state).toBe('failed');
            expect(result.batches[1].state).toBe('running');
        });
    });

    describe('getTestCaseInputs', () => {
        it('should parse msdyn_inputdata into name/value pairs', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{
                    msdyn_aitestcaseinputid: 'in-1',
                    msdyn_name: 'test name',
                    msdyn_inputdata: '[{"name":"topic","value":"Climate change"}]'
                }]
            });

            const result = await AgentService.getTestCaseInputs(retrieveMultipleRecords, 'tc-1');

            expect(retrieveMultipleRecords).toHaveBeenCalledWith('msdyn_aitestcaseinputs', expect.stringContaining('_msdyn_aitestcaseid_value eq tc-1'), expect.any(Object));
            expect(result[0].values).toEqual([{ name: 'topic', value: 'Climate change' }]);
        });

        it('should tolerate an empty input array and malformed JSON', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [
                    { msdyn_aitestcaseinputid: 'in-empty', msdyn_inputdata: '[]' },
                    { msdyn_aitestcaseinputid: 'in-bad', msdyn_inputdata: 'not json' }
                ]
            });

            const result = await AgentService.getTestCaseInputs(retrieveMultipleRecords, 'tc-1');

            expect(result[0].values).toEqual([]);
            expect(result[1].values).toEqual([]);
        });

        it('should return an empty array without a test case id', async () => {
            const retrieveMultipleRecords = vi.fn();
            expect(await AgentService.getTestCaseInputs(retrieveMultipleRecords, '')).toEqual([]);
            expect(retrieveMultipleRecords).not.toHaveBeenCalled();
        });
    });

    describe('getTestBatchRuns', () => {
        it('should map a run with parsed response metadata (tokens, model)', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{
                    msdyn_aitestrunid: 'r-1',
                    msdyn_expectedoutput: 'Hello',
                    msdyn_actualoutput: 'Hello, how can I help?',
                    msdyn_accuracyscore: 43,
                    msdyn_additionalresponsemetadata: '{"tokens":3,"modelName":"gpt-41-mini-2025-04-14","modelType":"default"}',
                    _msdyn_aitestcaseid_value: 'tc-1',
                    [`_msdyn_aitestcaseid_value${FV}`]: 'Case A',
                    msdyn_completedon: '2026-07-25T00:27:23Z'
                }]
            });

            const result = await AgentService.getTestBatchRuns(retrieveMultipleRecords, 'b-1');

            expect(retrieveMultipleRecords).toHaveBeenCalledWith('msdyn_aitestruns', expect.stringContaining('_msdyn_aitestrunbatchid_value eq b-1'), expect.any(Object));
            expect(result[0]).toEqual(expect.objectContaining({
                id: 'r-1', accuracyScore: 43, tokens: 3, modelName: 'gpt-41-mini-2025-04-14',
                modelType: 'default', actualOutput: 'Hello, how can I help?', testCaseName: 'Case A', state: 'completed'
            }));
        });

        it('should tolerate missing/malformed response metadata', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ msdyn_aitestrunid: 'r-2', msdyn_additionalresponsemetadata: 'oops' }]
            });

            const result = await AgentService.getTestBatchRuns(retrieveMultipleRecords, 'b-1');

            expect(result[0]).toEqual(expect.objectContaining({ id: 'r-2', tokens: null, modelName: '', accuracyScore: null }));
        });

        it('should derive a failed state from testrunstatus 5 even without an error message', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ msdyn_aitestrunid: 'r-x', msdyn_testrunstatus: 5, msdyn_completedon: '2026-07-25T00:00:00Z' }]
            });
            const result = await AgentService.getTestBatchRuns(retrieveMultipleRecords, 'b-1');
            expect(result[0].state).toBe('failed');
        });

        it('should return an empty array without a batch id', async () => {
            const retrieveMultipleRecords = vi.fn();
            expect(await AgentService.getTestBatchRuns(retrieveMultipleRecords, '')).toEqual([]);
            expect(retrieveMultipleRecords).not.toHaveBeenCalled();
        });
    });

    describe('getPromptEvaluations criteria', () => {
        it('should parse the evaluation criteria (passing score + prebuilt checks)', async () => {
            const retrieveMultipleRecords = vi.fn()
                .mockResolvedValueOnce({ entities: [] })
                .mockResolvedValueOnce({ entities: [] })
                .mockResolvedValueOnce({ entities: [{
                    msdyn_aievaluationconfigurationid: 'crit-1',
                    msdyn_evaluationcriteria: '{"passingScore":64,"value":{"expectedResponseCheck":{"isApplicable":true,"comparisonType":"exact"},"responseQuality":{"isApplicable":false},"jsonCorrectness":{"isApplicable":true}}}'
                }] });

            const result = await AgentService.getPromptEvaluations(retrieveMultipleRecords, 'obj-1');

            expect(result.criteria).toEqual({
                id: 'crit-1',
                passingScore: 64,
                expectedResponse: { applicable: true, comparison: 'exact' },
                responseQuality: { applicable: false },
                jsonCorrectness: { applicable: true },
                raw: expect.stringContaining('passingScore')
            });
        });

        it('should leave criteria null when no configuration exists', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({ entities: [] });
            const result = await AgentService.getPromptEvaluations(retrieveMultipleRecords, 'obj-1');
            expect(result.criteria).toBeNull();
        });
    });

    describe('buildEvaluationCriteriaPayload', () => {
        it('should overwrite score + checks while preserving version/configurationType', () => {
            const raw = '{"version":"0.0","configurationType":"GptPromptPredefinedEvaluationCriteria","passingScore":50,"value":{"expectedResponseCheck":{"isApplicable":false,"comparisonType":"similarity"},"responseQuality":{"isApplicable":true},"jsonCorrectness":{"isApplicable":false}}}';
            const out = JSON.parse(buildEvaluationCriteriaPayload(raw, {
                passingScore: 60, expectedApplicable: true, comparisonType: 'exact',
                responseQualityApplicable: false, jsonApplicable: true
            }));
            expect(out.version).toBe('0.0');
            expect(out.configurationType).toBe('GptPromptPredefinedEvaluationCriteria');
            expect(out.passingScore).toBe(60);
            expect(out.value.expectedResponseCheck).toEqual({ isApplicable: true, comparisonType: 'exact' });
            expect(out.value.responseQuality).toEqual({ isApplicable: false });
            expect(out.value.jsonCorrectness).toEqual({ isApplicable: true });
        });

        it('should clamp the passing score to 1–100 and default markers from empty raw', () => {
            const low = JSON.parse(buildEvaluationCriteriaPayload('', { passingScore: 0 }));
            const high = JSON.parse(buildEvaluationCriteriaPayload('not json', { passingScore: 250 }));
            expect(low.passingScore).toBe(1);
            expect(high.passingScore).toBe(100);
            expect(low.version).toBe('0.0');
            expect(low.configurationType).toBe('GptPromptPredefinedEvaluationCriteria');
        });
    });

    describe('updateEvaluationCriteria', () => {
        it('should PATCH the built criteria payload onto the configuration', async () => {
            const updateRecord = vi.fn().mockResolvedValue({});
            await AgentService.updateEvaluationCriteria(updateRecord, 'crit-1', '{"passingScore":50}', {
                passingScore: 70, expectedApplicable: true, comparisonType: 'similarity',
                responseQualityApplicable: true, jsonApplicable: false
            });
            expect(updateRecord).toHaveBeenCalledWith('msdyn_aievaluationconfigurations', 'crit-1', expect.objectContaining({
                msdyn_evaluationcriteria: expect.stringContaining('"passingScore":70')
            }));
        });

        it('should throw without a configuration id', async () => {
            await expect(AgentService.updateEvaluationCriteria(vi.fn(), '', '{}', {})).rejects.toThrow();
        });
    });

    describe('deleteTestCase', () => {
        it('should DELETE the test case', async () => {
            const deleteRecord = vi.fn().mockResolvedValue({});
            await AgentService.deleteTestCase(deleteRecord, 'tc-1');
            expect(deleteRecord).toHaveBeenCalledWith('msdyn_aitestcase', 'tc-1');
        });

        it('should throw without a test case id', async () => {
            await expect(AgentService.deleteTestCase(vi.fn(), '')).rejects.toThrow();
        });
    });

    describe('updateTestCaseExpectedOutput', () => {
        it('should PATCH msdyn_expectedoutput on the test case', async () => {
            const updateRecord = vi.fn().mockResolvedValue({});
            await AgentService.updateTestCaseExpectedOutput(updateRecord, 'tc-1', 'New expected');
            expect(updateRecord).toHaveBeenCalledWith('msdyn_aitestcases', 'tc-1', { msdyn_expectedoutput: 'New expected' });
        });

        it('should coerce a null/undefined value to an empty string', async () => {
            const updateRecord = vi.fn().mockResolvedValue({});
            await AgentService.updateTestCaseExpectedOutput(updateRecord, 'tc-1', undefined);
            expect(updateRecord).toHaveBeenCalledWith('msdyn_aitestcases', 'tc-1', { msdyn_expectedoutput: '' });
        });

        it('should throw without a test case id', async () => {
            await expect(AgentService.updateTestCaseExpectedOutput(vi.fn(), '', 'x')).rejects.toThrow();
        });
    });

    describe('evaluation scoring (buildEvaluationResult / computeEvalFinalScore / evalNeedsGrader)', () => {
        const similarityQualityCriteria = {
            passingScore: 60,
            value: {
                expectedResponseCheck: { isApplicable: true, comparisonType: 'similarity' },
                responseQuality: { isApplicable: true },
                jsonCorrectness: { isApplicable: false }
            }
        };

        it('should average the applicable grader sub-scores and pass against the passing score', () => {
            const grader = {
                semanticSimilarity: { isApplicable: true, finalScore: 50 },
                responseQuality: { isApplicable: true, finalScore: 76 }
            };
            const out = buildEvaluationResult(similarityQualityCriteria, 'Hello', 'Hello, how can I help?', grader);
            // avg(50, 76) = 63 ≥ 60 → pass (matches the portal exactly).
            expect(out.result.finalScore).toBe(63);
            expect(out.result.passedEvaluation).toBe(true);
            expect(out.result.semanticSimilarity.finalScore).toBe(50);
            expect(out.result.responseQuality.finalScore).toBe(76);
        });

        it('should score exact match client-side without a grader', () => {
            const criteria = {
                passingScore: 100,
                value: {
                    expectedResponseCheck: { isApplicable: true, comparisonType: 'exact' },
                    responseQuality: { isApplicable: false },
                    jsonCorrectness: { isApplicable: false }
                }
            };
            expect(buildEvaluationResult(criteria, 'Hello', 'Hello', {}).result.exactMatch.finalScore).toBe(100);
            expect(buildEvaluationResult(criteria, 'Hello', 'Hi', {}).result.exactMatch.finalScore).toBe(0);
        });

        it('should score JSON correctness client-side', () => {
            const criteria = {
                passingScore: 70,
                value: {
                    expectedResponseCheck: { isApplicable: false },
                    responseQuality: { isApplicable: false },
                    jsonCorrectness: { isApplicable: true }
                }
            };
            expect(buildEvaluationResult(criteria, '', '{"a":1}', {}).result.jsonCorrectness.finalScore).toBe(100);
            expect(buildEvaluationResult(criteria, '', 'not json', {}).result.jsonCorrectness.finalScore).toBe(0);
        });

        it('computeEvalFinalScore averages only applicable checks', () => {
            expect(computeEvalFinalScore({ exactMatch: { isApplicable: true, finalScore: 100 }, responseQuality: { isApplicable: false, finalScore: 0 } })).toBe(100);
            expect(computeEvalFinalScore({})).toBeNull();
        });

        it('evalNeedsGrader is true for semantic/quality and false for exact-only', () => {
            expect(evalNeedsGrader(similarityQualityCriteria)).toBe(true);
            expect(evalNeedsGrader({ value: { expectedResponseCheck: { isApplicable: true, comparisonType: 'exact' }, responseQuality: { isApplicable: false }, jsonCorrectness: { isApplicable: true } } })).toBe(false);
        });
    });

    describe('runPromptTests', () => {
        const makeDeps = (quickText) => {
            let seq = 0;
            return {
                createRecord: vi.fn(() => Promise.resolve({ id: `id-${seq++}` })),
                updateRecord: vi.fn(() => Promise.resolve({})),
                retrieveMultipleRecords: vi.fn(() => Promise.resolve({ entities: [] })),
                webApiFetch: vi.fn(() => Promise.resolve({
                    responsev2: { predictionOutput: { text: '{"semanticSimilarity":{"isApplicable":true,"finalScore":50},"responseQuality":{"isApplicable":true,"finalScore":76}}' } }
                })),
                quickTest: vi.fn(() => Promise.resolve({
                    succeeded: true, text: quickText, promptTokens: 1290, completionTokens: 8,
                    modelName: 'gpt-5-chat-2025-07-14', modelType: 'reasoning'
                }))
            };
        };

        it('creates a batch + run, predicts, grades and scores, then completes the batch', async () => {
            const deps = makeDeps('Hello, how can I help?');
            const criteria = {
                id: 'crit-1', passingScore: 60,
                raw: JSON.stringify({ passingScore: 60, value: { expectedResponseCheck: { isApplicable: true, comparisonType: 'similarity' }, responseQuality: { isApplicable: true }, jsonCorrectness: { isApplicable: false } } })
            };
            const result = await AgentService.runPromptTests(deps, {
                model: { id: 'm-1', name: 'Hello prompt' },
                activeConfigId: 'cfg-1',
                promptConfigJson: JSON.stringify({ prompt: [{ type: 'literal', text: 'print Hello' }], definitions: { inputs: [] } }),
                criteria,
                testCases: [{ id: 'tc-1', expectedOutput: 'Hello', inputs: {} }]
            });

            expect(result).toEqual({ batchId: 'id-0', ran: 1, passed: 1, failed: 0 });
            // batch, run, eval-run all created
            expect(deps.createRecord).toHaveBeenCalledWith('msdyn_aitestrunbatches', expect.objectContaining({ msdyn_batchrunstatus: 1, msdyn_aiobjecttype: 'AIPrompt' }));
            expect(deps.createRecord).toHaveBeenCalledWith('msdyn_aitestruns', expect.objectContaining({ msdyn_testrunstatus: 1 }));
            expect(deps.createRecord).toHaveBeenCalledWith('msdyn_aievaluationruns', expect.objectContaining({ msdyn_airunobjecttype: 'AITestRun' }));
            // grader QuickTest fired against the hardcoded grader config
            expect(deps.webApiFetch).toHaveBeenCalledWith('POST', expect.stringContaining('73244ddc-555f-4d8f-83b4-703cad48dbab'), '', expect.any(Object));
            // the test run is patched with the computed accuracy score (avg 50/76 = 63)
            expect(deps.updateRecord).toHaveBeenCalledWith('msdyn_aitestruns', expect.any(String), expect.objectContaining({ msdyn_accuracyscore: '63', msdyn_testrunstatus: 4 }));
        });

        it('passes case inputs to the prediction and substitutes them into the grader PromptText', async () => {
            const deps = makeDeps('Answer');
            const criteria = {
                id: 'crit-1', passingScore: 60,
                raw: JSON.stringify({ passingScore: 60, value: { expectedResponseCheck: { isApplicable: true, comparisonType: 'similarity' }, responseQuality: { isApplicable: false }, jsonCorrectness: { isApplicable: false } } })
            };
            await AgentService.runPromptTests(deps, {
                model: { id: 'm-1', name: 'P' }, activeConfigId: 'cfg-1',
                promptConfigJson: JSON.stringify({ prompt: [{ type: 'literal', text: 'Q: ' }, { type: 'inputVariable', id: 'topic' }], definitions: { inputs: [{ id: 'topic' }] } }),
                criteria,
                testCases: [{ id: 'tc-1', expectedOutput: 'Answer', inputs: { topic: 'Climate' } }]
            });
            // The prediction is invoked with the case's input map, asking for code planned around it.
            expect(deps.quickTest).toHaveBeenCalledWith('cfg-1', expect.any(String), null, { topic: 'Climate' }, true);
            // The grader's PromptText flattens literals + substituted inputs; TestCaseInput carries the map.
            const graderCall = deps.webApiFetch.mock.calls.find(c => String(c[1]).includes('73244ddc'));
            expect(graderCall[3].requestv2.PromptText).toBe('Q: Climate');
            expect(graderCall[3].requestv2.TestCaseInput).toBe('{"topic":"Climate"}');
        });

        it('marks a run failed when the prediction fails, and fails the batch', async () => {
            const deps = makeDeps('');
            deps.quickTest = vi.fn(() => Promise.resolve({ succeeded: false, error: 'boom' }));
            const result = await AgentService.runPromptTests(deps, {
                model: { id: 'm-1', name: 'P' }, activeConfigId: 'cfg-1',
                promptConfigJson: '{"prompt":[],"definitions":{"inputs":[]}}', criteria: null,
                testCases: [{ id: 'tc-1', expectedOutput: 'Hello', inputs: {} }]
            });
            expect(result.failed).toBe(1);
            expect(deps.updateRecord).toHaveBeenCalledWith('msdyn_aitestruns', expect.any(String), expect.objectContaining({ msdyn_testrunstatus: 5 }));
            expect(deps.updateRecord).toHaveBeenCalledWith('msdyn_aitestrunbatches', expect.any(String), expect.objectContaining({ msdyn_batchrunstatus: 5 }));
        });

        it('throws when there are no test cases', async () => {
            await expect(AgentService.runPromptTests(makeDeps('x'), { model: { id: 'm' }, testCases: [] })).rejects.toThrow();
        });
    });

    describe('summarizeAgentUsage', () => {
        const isoDaysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();

        it('should count recent-window sessions and group by channel', () => {
            const records = [
                { createdon: isoDaysAgo(1), schematype: 'PVA' },
                { createdon: isoDaysAgo(3), schematype: 'PVA' },
                { createdon: isoDaysAgo(10), schematype: 'OmniChannel' },
                { createdon: isoDaysAgo(40), schematype: 'PVA' }
            ];
            const usage = summarizeAgentUsage(records);
            expect(usage.sampled).toBe(4);
            expect(usage.last7).toBe(2);
            expect(usage.last30).toBe(3);
            expect(usage.byChannel).toEqual([{ channel: 'PVA', count: 3 }, { channel: 'OmniChannel', count: 1 }]);
            expect(usage.daily).toHaveLength(14);
        });

        it('should flag capped when the sample hits the cap and default Unknown channel', () => {
            const records = [{ createdon: isoDaysAgo(1) }, { createdon: isoDaysAgo(2) }];
            const usage = summarizeAgentUsage(records, 2);
            expect(usage.capped).toBe(true);
            expect(usage.byChannel).toEqual([{ channel: 'Unknown', count: 2 }]);
        });

        it('should handle an empty or invalid list', () => {
            expect(summarizeAgentUsage([]).sampled).toBe(0);
            expect(summarizeAgentUsage(null).sampled).toBe(0);
            expect(summarizeAgentUsage([]).daily).toHaveLength(14);
        });
    });

    describe('getAgentUsage', () => {
        it('should query transcripts by bot and summarize them', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({
                entities: [{ createdon: new Date().toISOString(), schematype: 'PVA' }]
            });
            const usage = await AgentService.getAgentUsage(retrieveMultipleRecords, 'bot-1');
            expect(retrieveMultipleRecords).toHaveBeenCalledWith('conversationtranscripts', expect.stringContaining('_bot_conversationtranscriptid_value eq bot-1'), expect.any(Object));
            expect(usage.sampled).toBe(1);
            expect(usage.last7).toBe(1);
        });

        it('should return an empty summary when botId is missing', async () => {
            const retrieveMultipleRecords = vi.fn();
            const usage = await AgentService.getAgentUsage(retrieveMultipleRecords, '');
            expect(usage.sampled).toBe(0);
            expect(retrieveMultipleRecords).not.toHaveBeenCalled();
        });
    });

    describe('buildSnippet', () => {
        it('should extract a context window around the term with ellipses', () => {
            const text = 'You are a helpful assistant. Always handle refund requests with empathy and escalate when needed.';
            const snippet = buildSnippet(text, 'refund', 15);
            expect(snippet).toContain('refund');
            expect(snippet.startsWith('…')).toBe(true);
            expect(snippet.endsWith('…')).toBe(true);
        });

        it('should be case-insensitive and collapse whitespace', () => {
            expect(buildSnippet('Hello\n\n  WORLD here', 'world', 20)).toContain('WORLD');
        });

        it('should return empty string when the term is absent', () => {
            expect(buildSnippet('nothing here', 'refund')).toBe('');
            expect(buildSnippet('', 'x')).toBe('');
        });
    });

    describe('searchAgentComponents', () => {
        it('should merge name/description hits with instruction-body hits and dedupe', async () => {
            const retrieveMultipleRecords = vi.fn()
                // Pass 1: server-side name/description contains
                .mockResolvedValueOnce({
                    entities: [
                        { botcomponentid: 'c1', name: 'Refund topic', componenttype: 0, [`componenttype${FV}`]: 'Topic', description: 'Handles refunds', _parentbotid_value: 'bot-1' }
                    ]
                })
                // Pass 2: Custom GPT bodies (type 15)
                .mockResolvedValueOnce({
                    entities: [
                        { botcomponentid: 'c1', name: 'Refund topic', componenttype: 15, data: 'refund body', _parentbotid_value: 'bot-1' }, // dup -> skipped
                        { botcomponentid: 'c2', name: 'Sales GPT', componenttype: 15, data: 'Always process a refund within 30 days.', _parentbotid_value: 'bot-2' }
                    ]
                });

            const result = await AgentService.searchAgentComponents(retrieveMultipleRecords, 'refund');

            expect(result).toHaveLength(2);
            const ids = result.map(r => r.id);
            expect(ids).toEqual(['c1', 'c2']);
            const bodyHit = result.find(r => r.id === 'c2');
            expect(bodyHit.parentBotId).toBe('bot-2');
            expect(bodyHit.snippet).toContain('refund');
        });

        it('should return an empty array for terms shorter than 2 characters', async () => {
            const retrieveMultipleRecords = vi.fn();
            expect(await AgentService.searchAgentComponents(retrieveMultipleRecords, 'a')).toEqual([]);
            expect(retrieveMultipleRecords).not.toHaveBeenCalled();
        });

        it('should escape single quotes in the OData contains filter', async () => {
            const retrieveMultipleRecords = vi.fn().mockResolvedValue({ entities: [] });
            await AgentService.searchAgentComponents(retrieveMultipleRecords, "O'Brien");
            const firstCall = retrieveMultipleRecords.mock.calls[0];
            expect(firstCall[1]).toContain("contains(name,'O''Brien')");
        });

        it('should find modern-agent instructions stored in the bot configuration (third pass)', async () => {
            const cfg = JSON.stringify({
                agentSettings: { instructions: { segments: [{ value: '```\nAlways offer a refund politely.\n```' }] } }
            });
            const retrieveMultipleRecords = vi.fn()
                .mockResolvedValueOnce({ entities: [] }) // Pass 1: names/descriptions
                .mockResolvedValueOnce({ entities: [] }) // Pass 2: Custom GPT bodies
                .mockResolvedValueOnce({ entities: [
                    { botid: 'bot-9', name: 'Modern Agent', configuration: cfg },
                    { botid: 'bot-8', name: 'Other Agent', configuration: '{}' } // no instructions → no match
                ] });

            const result = await AgentService.searchAgentComponents(retrieveMultipleRecords, 'refund');

            expect(retrieveMultipleRecords.mock.calls[2][0]).toBe('bots');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                id: 'cfg-bot-9',
                name: 'Modern Agent',
                componentTypeLabel: 'Instructions',
                parentBotId: 'bot-9'
            });
            expect(result[0].snippet.toLowerCase()).toContain('refund');
        });
    });

    describe('parseTranscriptConversation', () => {
        it('should parse message activities with Copilot Studio numeric roles (1 = user, 0 = agent)', () => {
            const content = JSON.stringify({
                activities: [
                    { type: 'message', from: { id: 'u1', role: 1 }, text: 'How do I reset my password?' },
                    { type: 'message', from: { id: 'bot', role: 0 }, text: 'Go to the reset portal.' }
                ]
            });
            expect(parseTranscriptConversation(content)).toEqual({
                turns: [
                    { role: 'user', text: 'How do I reset my password?' },
                    { role: 'agent', text: 'Go to the reset portal.' }
                ]
            });
        });

        it('should parse Bot Framework string roles (user/bot)', () => {
            const content = JSON.stringify({
                activities: [
                    { type: 'message', from: { id: 'u1', role: 'user' }, text: 'Hi' },
                    { type: 'message', from: { id: 'bot', role: 'bot' }, text: 'Hello!' }
                ]
            });
            expect(parseTranscriptConversation(content)).toEqual({
                turns: [{ role: 'user', text: 'Hi' }, { role: 'agent', text: 'Hello!' }]
            });
        });

        it('should ignore non-message activities and blank texts', () => {
            const content = JSON.stringify({
                activities: [
                    { type: 'event', from: { role: 0 }, text: 'SetPVAContext' },
                    { type: 'trace', from: { role: 0 }, text: 'internal' },
                    { type: 'message', from: { role: 1 }, text: '   ' },
                    { type: 'message', from: { role: 1 }, text: 'Real question' }
                ]
            });
            expect(parseTranscriptConversation(content)).toEqual({
                turns: [{ role: 'user', text: 'Real question' }]
            });
        });

        it('should return null for unreadable or message-less content', () => {
            expect(parseTranscriptConversation('not json')).toBeNull();
            expect(parseTranscriptConversation('{"foo":1}')).toBeNull();
            expect(parseTranscriptConversation(null)).toBeNull();
            expect(parseTranscriptConversation(JSON.stringify({ activities: [] }))).toBeNull();
        });
    });

    describe('parseTranscriptSession', () => {
        it('should parse an unengaged, message-less session (SessionInfo + ConversationInfo)', () => {
            const content = JSON.stringify({
                activities: [
                    { valueType: 'ConversationInfo', type: 'trace', value: { isDesignMode: false, locale: '' } },
                    { type: 'event', from: { role: 1 }, name: 'pvaSetContext' },
                    {
                        valueType: 'SessionInfo', type: 'trace', value: {
                            startTimeUtc: '2026-07-25T17:30:53Z', endTimeUtc: '2026-07-25T17:30:53Z',
                            type: 'Unengaged', outcome: 'None', turnCount: 0, impliedSuccess: false, outcomeReason: 'NoError'
                        }
                    }
                ]
            });
            expect(parseTranscriptSession(content)).toEqual({
                type: 'Unengaged', engaged: false, outcome: 'None', outcomeReason: 'NoError',
                turnCount: 0, impliedSuccess: false, startTime: '2026-07-25T17:30:53Z',
                endTime: '2026-07-25T17:30:53Z', isDesignMode: false, locale: ''
            });
        });

        it('should flag an engaged, resolved, design-mode (test pane) session', () => {
            const content = JSON.stringify({
                activities: [
                    { valueType: 'ConversationInfo', type: 'trace', value: { isDesignMode: true, locale: 'en-US' } },
                    {
                        valueType: 'SessionInfo', type: 'trace', value: {
                            type: 'Engaged', outcome: 'Resolved', turnCount: 4, impliedSuccess: true,
                            startTimeUtc: '2026-07-22T16:30:00Z', endTimeUtc: '2026-07-22T16:31:30Z'
                        }
                    }
                ]
            });
            const session = parseTranscriptSession(content);
            expect(session.engaged).toBe(true);
            expect(session.outcome).toBe('Resolved');
            expect(session.turnCount).toBe(4);
            expect(session.impliedSuccess).toBe(true);
            expect(session.isDesignMode).toBe(true);
            expect(session.locale).toBe('en-US');
        });

        it('should return null when neither SessionInfo nor ConversationInfo is present', () => {
            expect(parseTranscriptSession('not json')).toBeNull();
            expect(parseTranscriptSession(null)).toBeNull();
            expect(parseTranscriptSession(JSON.stringify({ activities: [{ type: 'message', text: 'hi' }] }))).toBeNull();
        });

        it('should default missing numeric/boolean fields to null', () => {
            const content = JSON.stringify({
                activities: [{ valueType: 'SessionInfo', type: 'trace', value: { type: 'Unengaged' } }]
            });
            const session = parseTranscriptSession(content);
            expect(session.turnCount).toBeNull();
            expect(session.impliedSuccess).toBeNull();
            expect(session.isDesignMode).toBe(false);
        });

        it('should parse ConversationInfo alone (no SessionInfo) with an empty engagement type', () => {
            const content = JSON.stringify({
                activities: [{ valueType: 'ConversationInfo', type: 'trace', value: { isDesignMode: true, locale: 'en-US' } }]
            });
            const session = parseTranscriptSession(content);
            expect(session).not.toBeNull();
            // No SessionInfo → no engagement claim (empty type); the UI suppresses the badge on this.
            expect(session.type).toBe('');
            expect(session.isDesignMode).toBe(true);
            expect(session.locale).toBe('en-US');
        });
    });
});
