/**
 * @file Tests for AgentsTab component
 * @module tests/components/AgentsTab.test.js
 * @description Tests for the AI Workbench component (agents, workflows, transcripts, AI models).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockAgents = [
    {
        id: 'bot-1', name: 'Sales Copilot', schemaName: 'new_salescopilot',
        statecode: 0, stateLabel: 'Active', statusLabel: 'Provisioned', isManaged: false,
        owner: 'John Doe', language: 'English', authMode: 'Integrated',
        createdOn: '1/1/2026', modifiedOn: '1/5/2026', publishedOn: '1/5/2026',
        publishedOnRaw: '2026-01-05T16:00:00Z', publishedBy: 'John Doe', solutionId: 'sol-1',
        template: 'cliagent-1.0.0', isModern: true
    },
    {
        id: 'bot-2', name: 'HR Bot', schemaName: 'new_hrbot',
        statecode: 1, stateLabel: 'Inactive', statusLabel: 'Deprovisioned', isManaged: true,
        owner: 'Admin', language: 'English', authMode: 'None',
        createdOn: '2/1/2026', modifiedOn: '2/3/2026', publishedOn: '',
        publishedOnRaw: '', publishedBy: '', solutionId: 'sol-2',
        template: 'empty-1.0.0', isModern: false
    }
];

const mockComponents = [
    // Instructions use CRLF on purpose: a textarea normalizes to LF, so the footer must not be "dirty" on load.
    { id: 'c-1', name: 'Instructions', schemaName: 'cr_bot645.gpt.default', componentType: 15, componentTypeLabel: 'Custom GPT', description: '', content: '', data: 'You are a helpful sales agent.\r\nBe concise.', isManaged: false, statecode: 0 },
    { id: 'c-2', name: 'Greeting', schemaName: 'cr_bot645.topic.Greeting', componentType: 9, componentTypeLabel: 'Topic (V2)', description: 'Says hello', content: '{}', data: '', isManaged: false, statecode: 0, modifiedOn: '6/4/2026', modifiedOnRaw: '2026-06-04T08:51:00Z', modifiedBy: 'John Doe' },
    { id: 'c-3', name: 'Product KB', schemaName: 'cr_bot645.topic.kb', componentType: 16, componentTypeLabel: 'Knowledge Source', description: '', content: '', data: '', isManaged: false, statecode: 0 },
    { id: 'c-4', name: 'Agent', schemaName: 'cr_bot645.agent.SubAgent', componentType: 9, componentTypeLabel: 'Topic (V2)', description: '', content: '', data: 'kind: AgentDialog\r\nbeginDialog:\r\n  description: Test child agent\r\nsettings:\r\n  instructions: hi', isManaged: false, statecode: 0 },
    // A connection to a separately published agent (component name = target agent's display name 'HR Bot')
    { id: 'c-5', name: 'HR Bot', schemaName: 'cr_bot645.InvokeConnectedAgentTaskAction.HRBot', componentType: 9, componentTypeLabel: 'Topic (V2)', description: '', content: '', data: '', isManaged: false, statecode: 0 },
    // A test/evaluation component (componenttype 19) with a real EvaluationSet definition
    { id: 'c-6', name: 'Eval Test Set', schemaName: 'cr_bot645.test.EvalSet', componentType: 19, componentTypeLabel: 'Test Case', description: '', content: '', data: 'kind: EvaluationSet\ngraders:\n  - kind: PromptGrader\n    name: Power-Toolkit Test set\n    instructions: what is the last created invoice\n    labels:\n      - name: Invoice\n        description: IN5\n        outcome: Pass\n      - name: Contract\n        description: C6\n        outcome: Fail', isManaged: false, statecode: 0 }
];

// Content now rides with the transcript list, so the row can summarize the session up front. This
// sample is an engaged, resolved, 2-turn conversation lasting 1:32 in en-US.
const mockTranscriptContent = JSON.stringify({
    activities: [
        { valueType: 'ConversationInfo', type: 'trace', value: { isDesignMode: false, locale: 'en-US' } },
        { type: 'message', from: { role: 1 }, text: 'Hello' },
        { type: 'message', from: { role: 0 }, text: 'Hi there!' },
        {
            valueType: 'SessionInfo', type: 'trace', value: {
                type: 'Engaged', outcome: 'Resolved', turnCount: 2, impliedSuccess: true,
                startTimeUtc: '2026-01-01T10:00:00Z', endTimeUtc: '2026-01-01T10:01:32Z'
            }
        }
    ]
});
const mockTranscripts = [
    { id: 't-1', name: 'Conversation 1', schemaType: 'PVA', content: mockTranscriptContent, startTime: '1/1/2026 10:00', createdOn: '1/1/2026' }
];

const mockModels = [
    {
        id: 'm-1', name: 'Receipt Processing', statecode: 1, stateLabel: 'Active', isManaged: false,
        owner: 'Jane', template: 'GptPowerPrompt', templateName: 'GptPowerPrompt', templateId: 'tpl-1',
        kind: 'prompt', kindLabel: 'Prompt', activeConfigId: 'cfg-1', hasRetrain: false,
        configStatus: { state: 'live', status: 'Published', configId: 'cfg-1', version: '1.0' },
        createdOn: '1/1/2026', modifiedOn: '1/2/2026', solutionId: 'sol-1'
    }
];

/** A configuration iteration in the shape getAiModelDefinition now returns. */
const mockPromptConfig = {
    id: 'cfg-1',
    name: 'Run',
    type: 'RunConfiguration',
    typeCode: 190690001,
    version: '1.0',
    status: 'Published',
    statusCode: 7,
    stateCode: 2,
    isActive: true,
    isFailed: false,
    lastError: null,
    lastRunOn: '1/2/2026',
    sections: [{
        column: 'msdyn_customconfiguration',
        label: 'Configuration',
        text: JSON.stringify({
            prompt: [{ type: 'literal', text: 'Extract totals from ' }, { type: 'inputVariable', id: 'Receipt' }],
            modelParameters: { modelType: 'gpt-41-mini', gptParameters: { temperature: 0 } }
        }),
        language: 'json',
        editable: true,
        compressed: false
    }]
};

vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        // Return fresh copies — the component caches solution membership on each item, and sharing
        // the same objects across tests would leak that cache (and matches real per-load records).
        getAgents: vi.fn(() => Promise.resolve(mockAgents.map(a => ({ ...a })))),
        getAgentComponents: vi.fn(() => Promise.resolve(mockComponents)),
        searchAgentComponents: vi.fn(() => Promise.resolve([
            { id: 'c-2', name: 'Greeting Topic', schemaName: 'cr_bot.topic.greeting', componentType: 0, componentTypeLabel: 'Topic', parentBotId: 'bot-1', snippet: '…always greet the customer…' }
        ])),
        getAgentConfiguration: vi.fn(() => Promise.resolve('{"name":"Sales Copilot"}')),
        setAgentState: vi.fn(() => Promise.resolve()),
        deleteAgent: vi.fn(() => Promise.resolve()),
        deleteAiModel: vi.fn(() => Promise.resolve()),
        getAgentTranscripts: vi.fn(() => Promise.resolve(mockTranscripts)),
        getTranscriptContent: vi.fn(() => Promise.resolve('{"messages":[]}')),
        getAgentUsage: vi.fn(() => Promise.resolve({
            sampled: 12, capped: false, last7: 3, last30: 9,
            byChannel: [{ channel: 'PVA', count: 8 }, { channel: 'OmniChannel', count: 4 }],
            daily: Array.from({ length: 14 }, (_, i) => ({ date: `2026-06-${String(i + 1).padStart(2, '0')}`, count: i % 3 }))
        })),
        getAiModels: vi.fn(() => Promise.resolve(mockModels.map(m => ({ ...m })))),
        getAiModelDefinition: vi.fn(() => Promise.resolve({
            configurations: [structuredClone(mockPromptConfig)],
            creationContext: null
        })),
        getAgentSolutionNames: vi.fn(() => Promise.resolve({
            'sol-1': 'Solution One (solutionone)',
            'sol-2': 'Solution Two (solutiontwo)'
        })),
        getSolutionMemberships: vi.fn(() => Promise.resolve({
            'bot-1': ['sol-1'], 'bot-2': ['sol-2'], 'm-1': ['sol-1'],
            'wf-1': ['sol-1'], 'wf-2': ['sol-2']
        })),
        updateAgentComponent: vi.fn(() => Promise.resolve()),
        updateAgentConfiguration: vi.fn(() => Promise.resolve()),
        // PvaPublish is async: it reports acceptance, and `publishedon` confirms it landed.
        publishAgent: vi.fn(() => Promise.resolve({ PublishedBotContentId: 'content-1', PublishBotJobResponse: null })),
        // Implementation is (re)established in beforeEach — tests that override it with the
        // persistent mockResolvedValue would otherwise leak into later tests, since clearAllMocks
        // resets calls but not implementations.
        getAgentPublishState: vi.fn(),
        getAgentLinks: vi.fn(() => Promise.resolve({ flows: [{ id: 'w1', name: 'Tool Flow', statecode: 1 }], models: [], tools: [{ id: 'p1', name: 'Lookup Tool' }] })),
        getAgentFlows: vi.fn(() => Promise.resolve([
            { id: 'wf-1', name: 'Power-Toolkit Workflow', description: 'On new mail', statecode: 1, stateLabel: 'Activated', isManaged: false, owner: 'Mohammed Khawatme', createdOn: '6/1/2026', modifiedOn: '6/2/2026 9:44 AM', createdBy: 'Mohammed Khawatme' },
            { id: 'wf-2', name: 'Order Sync', description: '', statecode: 0, stateLabel: 'Draft', isManaged: true, owner: 'Jane', createdOn: '5/1/2026', modifiedOn: '6/1/2026', createdBy: 'Jane' }
        ])),
        getFlowDefinition: vi.fn(() => Promise.resolve('{"properties":{"definition":{}}}')),
        setFlowState: vi.fn(() => Promise.resolve()),
        deleteFlow: vi.fn(() => Promise.resolve()),
        getEnvironmentId: vi.fn(() => Promise.resolve('env-abc-123')),
        getDefaultSolutionId: vi.fn(() => Promise.resolve('sol-default')),
        updateAiModelConfiguration: vi.fn(() => Promise.resolve()),
        publishAiPrompt: vi.fn(() => Promise.resolve('new-run-cfg')),
        saveAsAiPrompt: vi.fn(() => Promise.resolve({ modelId: 'copy-1', runConfigurationId: 'copy-run-1' })),
        getAiConfigurationStatus: vi.fn(() => Promise.resolve({ statusCode: 7, status: 'Published', isPublished: true })),
        quickTestAiConfiguration: vi.fn(() => Promise.resolve({
            status: 'Success', succeeded: true, text: 'Hello!', mimeType: 'text/markdown',
            modelName: 'gpt-41-2025-04-14', finishReason: 'stop', totalTokens: 1017, promptTokens: 1014,
            completionTokens: 3, credits: 22, copilotCredits: 3, thoughtSteps: '', code: 'print("hi")',
            signature: 'AQAAsig==', logs: 'INFO - done', planning: 'the plan', promptFixes: '',
            dataUsed: '', error: ''
        })),
        trainAiConfiguration: vi.fn(() => Promise.resolve({ status: 'InProgress', error: '' })),
        retrainAiConfiguration: vi.fn(() => Promise.resolve({ configId: 'new-iter-cfg', status: 'InProgress', error: '' })),
        quickTestModel: vi.fn(() => Promise.resolve({
            succeeded: true,
            shape: 'scores',
            predictions: [
                { label: 'Billing', score: 0.93, value: '' },
                { label: 'Support', score: 0.41, value: '' }
            ],
            raw: '', predictionId: 'pred-1', credits: 20, copilotCredits: 1.5, status: 'Success', error: ''
        })),
        unpublishAiConfiguration: vi.fn(() => Promise.resolve({ status: 'Success', error: '' })),
        publishTrainedModel: vi.fn(() => Promise.resolve({ configId: 'new-run', status: 'InProgress', error: '' })),
        setAgentComponentState: vi.fn(() => Promise.resolve()),
        getAiBuilderRuns: vi.fn(() => Promise.resolve([
            {
                id: 'ev-1', output: 'Hello', quickTest: true, dataType: 'Text',
                processingStatus: 'Succeeded', status: 'Active', processedOn: '5/31/2026', createdOn: '5/31/2026',
                createdOnRaw: '2026-05-31T14:18:19Z', consumption: 0.2, units: 2, featureName: 'Basic',
                llmModelName: 'gpt-4o', createdBy: 'Mohammed Khawatme'
            }
        ])),
        getAiBuilderRunInput: vi.fn(() => Promise.resolve(JSON.stringify({
            activities: [
                { type: 'message', from: { role: 1 }, text: 'Where is my order?' },
                { type: 'message', from: { role: 0 }, text: 'Let me check that for you.' }
            ]
        }))),
        getPromptEvaluations: vi.fn(() => Promise.resolve({
            testCases: [{ id: 'tc-1', name: 'Case A', description: '', expectedOutput: 'Hello', source: 'Manual', state: 'Active', createdOn: '1/1/2026', modifiedOn: '1/1/2026' }],
            batches: [{
                id: 'b-1', name: 'Batch A', description: '', statusLabel: '', state: 'completed', accuracyScore: null,
                startedOnRaw: '2026-07-25T00:27:18Z', completedOnRaw: '2026-07-25T00:27:23Z',
                startedOn: '7/25/2026', completedOn: '7/25/2026', createdOn: '7/25/2026', createdOnRaw: '2026-07-25T00:27:17Z',
                errorMessage: ''
            }],
            criteria: {
                id: 'crit-1', passingScore: 60,
                expectedResponse: { applicable: true, comparison: 'similarity' },
                responseQuality: { applicable: true }, jsonCorrectness: { applicable: false },
                raw: '{"version":"0.0","configurationType":"GptPromptPredefinedEvaluationCriteria","passingScore":60}'
            }
        })),
        getTestCaseInputs: vi.fn(() => Promise.resolve([
            { id: 'in-1', name: 'test name', raw: '[]', values: [], modifiedOn: '7/25/2026' }
        ])),
        getTestBatchRuns: vi.fn(() => Promise.resolve([
            {
                id: 'r-1', testCaseId: 'tc-1', testCaseName: 'Case A', configId: 'cfg-1',
                expectedOutput: 'Hello', actualOutput: 'Hello, how can I help?', accuracyScore: 43,
                tokens: 3, modelName: 'gpt-41-mini-2025-04-14', modelType: 'default', statusLabel: '',
                state: 'completed', startedOnRaw: '2026-07-25T00:27:18Z', completedOnRaw: '2026-07-25T00:27:23Z',
                errorMessage: '', comment: ''
            }
        ])),
        updateEvaluationCriteria: vi.fn(() => Promise.resolve({})),
        deleteTestCase: vi.fn(() => Promise.resolve({})),
        updateTestCaseExpectedOutput: vi.fn(() => Promise.resolve({})),
        runPromptTests: vi.fn(() => Promise.resolve({ batchId: 'b-new', ran: 1, passed: 1, failed: 0 })),
        getOrganizationDiagnostics: vi.fn(() => Promise.resolve({
            pluginTraceLogSetting: null, transcriptRecordingBlocked: false,
            transcriptAccessBlocked: false, flowRunRetentionSeconds: null
        }))
    }
}));

vi.mock('../../src/ui/UIFactory.js', () => ({
    UIFactory: {
        createFormDisabledMessage: vi.fn(() => document.createElement('div')),
        createCopyableCodeBlock: vi.fn((code) => {
            const el = document.createElement('div');
            el.className = 'copyable-code-block';
            const button = document.createElement('button'); // real one wires copy; mock just needs the affordance
            const pre = document.createElement('pre');
            pre.textContent = typeof code === 'string' ? code : JSON.stringify(code);
            el.append(button, pre);
            return el;
        })
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/services/DialogService.js', () => ({
    DialogService: {
        // Mirrors the real dialog structure (overlay id + content + footer with a Close button)
        // so footer-action injection works in tests.
        show: vi.fn((title, content, callback = null, options = {}) => {
            document.getElementById('pdt-dialog-overlay')?.remove();
            const overlay = document.createElement('div');
            overlay.id = 'pdt-dialog-overlay';
            const contentDiv = document.createElement('div');
            contentDiv.className = 'pdt-dialog-content';
            if (typeof content === 'string') {
                contentDiv.innerHTML = content;
            } else {
                contentDiv.appendChild(content);
            }
            const footer = document.createElement('div');
            footer.className = 'pdt-dialog-footer';
            // Mirror the real dialog: any close (OK, Cancel, backdrop, Esc) removes the overlay and
            // fires the optional onClose hook exactly once.
            const close = () => {
                overlay.remove();
                if (typeof options.onClose === 'function') { options.onClose(); }
            };
            // Mirror the real dialog: an OK button appears only when a callback is supplied, and
            // closes unless the callback returns false.
            if (callback) {
                const ok = document.createElement('button');
                ok.className = 'pdt-dialog-ok';
                ok.textContent = options.okText || 'OK';
                ok.onclick = () => { if (callback(contentDiv) !== false) { close(); } };
                footer.appendChild(ok);
            }
            const cancel = document.createElement('button');
            cancel.className = 'pdt-dialog-cancel';
            cancel.textContent = options.cancelText || 'Close';
            cancel.onclick = close;
            footer.appendChild(cancel);
            overlay.append(contentDiv, footer);
            document.body.appendChild(overlay);
            return { close };
        })
    }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: false,
        getGlobalContext: vi.fn(() => ({
            getClientUrl: () => 'https://org.crm.dynamics.com',
            getCurrentAppProperties: () => ({ environmentId: 'env-abc-123' })
        }))
    }
}));

vi.mock('../../src/utils/ui/BusyIndicator.js', () => ({
    BusyIndicator: { set: vi.fn(), clear: vi.fn() }
}));

vi.mock('../../src/helpers/index.js', () => ({
    debounce: (fn) => {
        const debounced = (...args) => fn.apply(null, args);
        debounced.cancel = vi.fn();
        return debounced;
    },
    escapeHtml: (str) => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    showConfirmDialog: vi.fn(() => Promise.resolve(true)),
    copyToClipboard: vi.fn(() => Promise.resolve()),
    downloadJson: vi.fn(),
    downloadText: vi.fn(),
    // Mirrors the real helper: the file's bytes as base64, with no data-URL prefix.
    readBase64File: vi.fn(async (file) => btoa(await file.text()))
}));

import { AgentsTab } from '../../src/components/AgentsTab.js';
import { DataService } from '../../src/services/DataService.js';
import { NotificationService } from '../../src/services/NotificationService.js';
import { DialogService } from '../../src/services/DialogService.js';
import { PowerAppsApiService } from '../../src/services/PowerAppsApiService.js';
import { UIFactory } from '../../src/ui/UIFactory.js';
import { showConfirmDialog, downloadJson, downloadText, copyToClipboard } from '../../src/helpers/index.js';
import { Config } from '../../src/constants/index.js';
import { AGENT_TEMPLATES } from '../../src/constants/agentTemplates.js';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Renders the tab, attaches it to the DOM, runs postRender, and waits for the
 * initial agents load to settle.
 */
async function renderTab() {
    const tab = new AgentsTab();
    const el = await tab.render();
    document.body.appendChild(el);
    tab.postRender(el);
    await flush();
    return { tab, el };
}

describe('AgentsTab', () => {
    let tab;

    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        window.open = vi.fn();
        // Default publish-state reads: the first is the pre-publish value, later ones show
        // `publishedon` having moved — how the component confirms an async publish landed.
        DataService.getAgentPublishState.mockImplementation(() => Promise.resolve(
            DataService.getAgentPublishState.mock.calls.length <= 1
                ? { publishedOnRaw: '2026-06-02T09:44:00Z', publishedOn: '6/2/2026 9:44 AM' }
                : { publishedOnRaw: '2026-07-22T10:00:00Z', publishedOn: '7/22/2026 10:00 AM' }
        ));
    });

    afterEach(() => {
        tab?.destroy?.();
        tab = null;
    });

    describe('constructor', () => {
        it('should initialize with the correct id and label', () => {
            tab = new AgentsTab();
            // The id must stay 'agents' — saved tab order/visibility is keyed by it.
            expect(tab.id).toBe('agents');
            expect(tab.label).toBe('AI Workbench');
        });

        it('should not be form-only', () => {
            tab = new AgentsTab();
            expect(tab.isFormOnly).toBe(false);
        });

        it('should start on the agents view with empty caches', () => {
            tab = new AgentsTab();
            expect(tab.activeView).toBe('agents');
            expect(tab.agents).toBeNull();
            expect(tab.aiModels).toBeNull();
        });
    });

    describe('render', () => {
        it('should return an HTMLElement with the sub-tabs and a host', async () => {
            tab = new AgentsTab();
            const el = await tab.render();
            expect(el).toBeInstanceOf(HTMLElement);
            expect(el.querySelectorAll('.pdt-sub-tab')).toHaveLength(5);
            expect(el.querySelector('#pdt-agents-host')).toBeTruthy();
        });
    });

    describe('agents view', () => {
        it('should load and render agent cards on postRender', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            expect(DataService.getAgents).toHaveBeenCalled();
            expect(ctx.el.querySelectorAll('.pdt-agent-card')).toHaveLength(2);
        });

        it('should render a delete button only for unmanaged agents', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const cards = ctx.el.querySelectorAll('.pdt-agent-card');
            // bot-1 (unmanaged) has a delete button; bot-2 (managed) does not
            expect(cards[0].querySelector('[data-action="delete"]')).toBeTruthy();
            expect(cards[1].querySelector('[data-action="delete"]')).toBeNull();
        });

        it('should show Published for an agent with a publish timestamp and Draft without one', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const cards = ctx.el.querySelectorAll('.pdt-agent-card');
            // bot-1 has publishedOn '1/5/2026' → Published; bot-2 has '' → Draft
            const publishedBadge = cards[0].querySelector('.pdt-agent-publish-badge');
            const draftBadge = cards[1].querySelector('.pdt-agent-publish-badge');
            expect(publishedBadge.classList.contains('published')).toBe(true);
            expect(publishedBadge.textContent).toBe('Published');
            expect(draftBadge.classList.contains('draft')).toBe(true);
            expect(draftBadge.textContent).toBe('Draft');
        });

        it('should show a "Powered by" kind badge (modern vs classic) on each card', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const cards = ctx.el.querySelectorAll('.pdt-agent-card');
            // bot-1 template cliagent-* → modern; bot-2 empty-* → classic
            const modernBadge = cards[0].querySelector('.pdt-agent-kind-badge');
            const classicBadge = cards[1].querySelector('.pdt-agent-kind-badge');
            expect(modernBadge.classList.contains('modern')).toBe(true);
            expect(modernBadge.textContent).toBe('GitHub Copilot');
            expect(classicBadge.classList.contains('classic')).toBe(true);
            expect(classicBadge.textContent).toBe('Standard');
        });

        it('should render publish state independent of record state (active Draft is possible)', async () => {
            // The imported-agent case: statecode Active but never published → Active + Draft.
            DataService.getAgents.mockResolvedValueOnce([
                { ...mockAgents[0], statecode: 0, stateLabel: 'Active', publishedOn: '' }
            ]);
            const ctx = await renderTab();
            tab = ctx.tab;
            const card = ctx.el.querySelector('.pdt-agent-card');
            expect(card.querySelector('.pdt-agent-publish-badge').textContent).toBe('Draft');
            expect(card.querySelector('.pdt-agent-state-badge').textContent).toBe('Active');
        });

        it('should deactivate an active agent when toggle is clicked', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const toggleBtn = ctx.el.querySelector('.pdt-agent-card [data-action="toggle"]');
            toggleBtn.click();
            await flush();
            expect(DataService.setAgentState).toHaveBeenCalledWith('bot-1', false);
            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'success');
        });

        it('should update only the record-state badge on toggle, leaving the publish badge intact', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const card = ctx.el.querySelector('.pdt-agent-card'); // bot-1: Active + Published
            card.querySelector('[data-action="toggle"]').click();
            await flush();
            // Record-state badge flips to Inactive; publish badge stays Published.
            expect(card.querySelector('.pdt-agent-state-badge').classList.contains('inactive')).toBe(true);
            expect(card.querySelector('.pdt-agent-publish-badge').textContent).toBe('Published');
            expect(card.querySelector('.pdt-agent-publish-badge').classList.contains('published')).toBe(true);
        });

        it('should delete an unmanaged agent after confirmation', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const deleteBtn = ctx.el.querySelector('.pdt-agent-card [data-action="delete"]');
            deleteBtn.click();
            await flush();
            expect(showConfirmDialog).toHaveBeenCalled();
            expect(DataService.deleteAgent).toHaveBeenCalledWith('bot-1');
        });

        it('should open the agent in Copilot Studio', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const openBtn = ctx.el.querySelector('.pdt-agent-card [data-action="open-studio"]');
            openBtn.click();
            await flush();
            expect(window.open).toHaveBeenCalledWith(
                expect.stringContaining('copilotstudio.microsoft.com'),
                '_blank'
            );
            expect(window.open).toHaveBeenCalledWith(expect.stringContaining('bot-1'), '_blank');
        });

        it('should open the definition dialog with components and configuration', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const viewBtn = ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]');
            viewBtn.click();
            await flush();
            expect(DataService.getAgentComponents).toHaveBeenCalledWith('bot-1');
            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should export an agent definition bundle as JSON', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="export-agent"]').click();
            await flush();
            expect(DataService.getAgentComponents).toHaveBeenCalledWith('bot-1');
            expect(downloadJson).toHaveBeenCalledTimes(1);
            const [bundle, filename] = downloadJson.mock.calls[0];
            expect(filename).toContain('agent-');
            expect(bundle.agent.id).toBe('bot-1');
            expect(bundle.tool).toBe('Power-Toolkit');
            expect(Array.isArray(bundle.components)).toBe(true);
            expect(bundle.components.length).toBe(mockComponents.length);
            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'success');
        });

        it('should filter cards by the search term', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const search = ctx.el.querySelector('.pdt-agents-search');
            search.value = 'hr';
            search.dispatchEvent(new Event('input', { bubbles: true }));
            const cards = ctx.el.querySelectorAll('.pdt-agent-card');
            expect(cards[0].style.display).toBe('none'); // Sales Copilot hidden
            expect(cards[1].style.display).toBe(''); // HR Bot visible
        });
    });

    describe('prompt test inputs', () => {
        // Shape taken from a live msdyn_customconfiguration: a document input, a text input with
        // saved sample data, and a Power Fx formula (which lives outside definitions.inputs).
        const CONFIG = JSON.stringify({
            version: 'GptDynamicPrompt-2',
            prompt: [
                { type: 'inputVariable', id: 'Text_20input' },
                { type: 'inputVariable', id: 'Document_20input' },
                { type: 'powerFx', id: 'Power_20Fx_20formula', text: 'Power Fx formula' }
            ],
            definitions: {
                inputs: [
                    { id: 'Document_20input', text: 'Document input', type: 'document' },
                    { id: 'Text_20input', text: 'Text input', type: 'text', quickTestValue: 'TEST Sample Data' }
                ],
                formulas: [{ id: 'Power_20Fx_20formula', type: 'powerFx', displayName: 'Power Fx formula', content: 'Now()' }]
            }
        });

        const parse = async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            return tab._parsePromptInputs(CONFIG);
        };

        it('should keep each input\'s declared type', async () => {
            const defs = await parse();
            expect(defs.map(d => d.type)).toEqual(['document', 'text']);
        });

        it('should keep the saved sample data', async () => {
            const defs = await parse();
            expect(defs.find(d => d.id === 'Text_20input').sample).toBe('TEST Sample Data');
        });

        it('should not treat a Power Fx formula as an input', async () => {
            const defs = await parse();
            expect(defs.some(d => d.id === 'Power_20Fx_20formula')).toBe(false);
        });

        it('should default a typeless input to text', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const config = JSON.stringify({ definitions: { inputs: [{ id: 'A', text: 'A' }] } });
            expect(tab._parsePromptInputs(config)[0].type).toBe('text');
        });

        it('should prefill a text field with its sample data', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const fields = new Map();
            tab._buildQuickTestInputs(tab._parsePromptInputs(CONFIG), fields);

            expect(fields.get('Text_20input').value).toBe('TEST Sample Data');
        });

        it('should offer a file picker for a document input', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const fields = new Map();
            tab._buildQuickTestInputs(tab._parsePromptInputs(CONFIG), fields);

            expect(fields.get('Document_20input').type).toBe('file');
            expect(fields.get('Text_20input').type).toBe('text');
        });

        it('should accept the Office formats the code interpreter can read', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const fields = new Map();
            tab._buildQuickTestInputs(tab._parsePromptInputs(CONFIG), fields, true);

            const accept = fields.get('Document_20input').accept;
            ['.png', '.jpg', '.jpeg', '.pdf', '.xlsx', '.docx', '.pptx']
                .forEach(ext => expect(accept).toContain(ext));
        });

        it('should offer only images and PDF without the code interpreter', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const fields = new Map();
            tab._buildQuickTestInputs(tab._parsePromptInputs(CONFIG), fields, false);

            const accept = fields.get('Document_20input').accept;
            expect(accept).toContain('.pdf');
            ['.xlsx', '.docx', '.pptx'].forEach(ext => expect(accept).not.toContain(ext));
        });

        describe('the 25 MB limit', () => {
            const fileField = (name, size) => ({ type: 'file', files: [{ name, size }] });
            const MB = 1024 * 1024;

            it('should allow files that together stay under the limit', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const fields = new Map([['a', fileField('a.pdf', 12 * MB)], ['b', fileField('b.pdf', 12 * MB)]]);

                expect(() => tab._assertPromptFilesWithinLimit(fields)).not.toThrow();
            });

            it('should reject files that only exceed the limit together', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                // The documented cap is 25 MB across all files, so neither one alone is too big.
                const fields = new Map([['a', fileField('a.pdf', 20 * MB)], ['b', fileField('b.pdf', 20 * MB)]]);

                expect(() => tab._assertPromptFilesWithinLimit(fields)).toThrow('2 files');
            });

            it('should name the file when a single one is too big', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const fields = new Map([['a', fileField('huge.pdf', 26 * MB)]]);

                expect(() => tab._assertPromptFilesWithinLimit(fields)).toThrow('huge.pdf');
            });

            it('should ignore text inputs and empty pickers', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const fields = new Map([
                    ['t', { type: 'text', value: 'x'.repeat(100) }],
                    ['d', { type: 'file', files: [] }]
                ]);

                expect(() => tab._assertPromptFilesWithinLimit(fields)).not.toThrow();
            });
        });

        describe('file picker chrome', () => {
            /** Builds the picker for the document input and returns its parts. */
            const buildPicker = (t) => {
                const fields = new Map();
                const container = t._buildPromptFilePicker({ id: 'Document_20input', type: 'document' }, 'f1', fields);
                return {
                    container,
                    input: fields.get('Document_20input'),
                    name: container.querySelector('.pdt-file-name'),
                    choose: container.querySelector('.pdt-file-select-btn'),
                    remove: container.querySelector('.pdt-prompt-test-file-remove')
                };
            };

            /**
             * Puts a file on the input and fires the change the picker listens for. Mirrors the
             * browser rule that setting `value` to '' also empties the FileList, which is how the
             * remove button clears a choice.
             */
            const choose = (input, fileName) => {
                let files = [new File(['x'], fileName, { type: 'application/pdf' })];
                Object.defineProperty(input, 'files', { configurable: true, get: () => files });
                Object.defineProperty(input, 'value', {
                    configurable: true,
                    get: () => (files.length ? `C:\\fakepath\\${files[0].name}` : ''),
                    set: (next) => {
                        if (!next) {
                            files = [];
                        }
                    }
                });
                input.dispatchEvent(new Event('change'));
            };

            it('should hide the native control in favour of a toolkit button', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const { input, choose: btn } = buildPicker(tab);

                expect(input.hidden).toBe(true);
                expect(btn.className).toContain('modern-button');
            });

            it('should start with no file chosen and no remove action', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const { name, remove } = buildPicker(tab);

                expect(name.textContent).toBe('No file chosen');
                expect(remove.hidden).toBe(true);
            });

            it('should show the file name and a remove action once chosen', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const parts = buildPicker(tab);

                choose(parts.input, 'contract.pdf');

                expect(parts.name.textContent).toBe('contract.pdf');
                expect(parts.remove.hidden).toBe(false);
                expect(parts.choose.textContent).toBe('Replace');
            });

            it('should clear the chosen file when removed', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const parts = buildPicker(tab);
                choose(parts.input, 'contract.pdf');

                parts.remove.click();

                expect(parts.input.value).toBe('');
                expect(parts.name.textContent).toBe('No file chosen');
                expect(parts.remove.hidden).toBe(true);
                expect(parts.choose.textContent).toBe('Choose file');
            });

            it('should label the remove action for screen readers', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const { remove } = buildPicker(tab);

                expect(remove.getAttribute('aria-label')).toBe('Remove file');
            });

            it('should name the picker after the input it belongs to', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const fields = new Map();
                const container = tab._buildPromptFilePicker(
                    { id: 'Document_20input', label: 'Document input', type: 'document' }, 'f1', fields
                );

                expect(container.getAttribute('role')).toBe('group');
                expect(container.getAttribute('aria-label')).toBe('Document input');
            });

            it('should not point the visible label at the hidden control', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const fields = new Map();
                const row = tab._buildQuickTestInputRow(
                    { id: 'Document_20input', label: 'Document input', type: 'document', sample: '' }, 'f1', fields
                );

                expect(row.querySelector('label').hasAttribute('for')).toBe(false);
            });

            it('should move focus to Choose after removing the file', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const parts = buildPicker(tab);
                document.body.appendChild(parts.container);
                choose(parts.input, 'contract.pdf');

                parts.remove.click();

                expect(document.activeElement).toBe(parts.choose);
            });
        });

        describe('deciding when to regenerate the code', () => {
            const textField = (value) => ({ type: 'text', value });
            const fileField = (name, size) => ({ type: 'file', files: [{ name, size }] });

            it('should read as unchanged when nothing was touched', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const fields = new Map([['Text_20input', textField('a')]]);

                const first = tab._promptInputsFingerprint(fields);

                expect(tab._promptInputsFingerprint(fields)).toBe(first);
            });

            it('should read as unchanged when the same file is picked again', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const before = tab._promptInputsFingerprint(new Map([['d', fileField('doc.pdf', 76536)]]));
                const after = tab._promptInputsFingerprint(new Map([['d', fileField('doc.pdf', 76536)]]));

                expect(after).toBe(before);
            });

            it('should read as changed when the text value changes', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const before = tab._promptInputsFingerprint(new Map([['t', textField('TEST Sample Data')]]));
                const after = tab._promptInputsFingerprint(new Map([['t', textField('TEST Sample Data!')]]));

                expect(after).not.toBe(before);
            });

            it('should read as changed when a different file is picked', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const before = tab._promptInputsFingerprint(new Map([['d', fileField('doc.pdf', 76536)]]));
                const after = tab._promptInputsFingerprint(new Map([['d', fileField('other.pdf', 12)]]));

                expect(after).not.toBe(before);
            });

            it('should read as changed when a file is removed', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const before = tab._promptInputsFingerprint(new Map([['d', fileField('doc.pdf', 76536)]]));
                const after = tab._promptInputsFingerprint(new Map([['d', { type: 'file', files: [] }]]));

                expect(after).not.toBe(before);
            });
        });

        describe('reading a value for the request', () => {
            const fileField = (file) => ({ type: 'file', files: file ? [file] : [] });

            it('should send a chosen file inline as base64', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                const file = new File(['%PDF-1.4'], 'doc.pdf', { type: 'application/pdf' });

                const value = await tab._readPromptInputValue(fileField(file));

                expect(value).toEqual({ base64Encoded: expect.any(String) });
                expect(atob(value.base64Encoded)).toBe('%PDF-1.4');
            });

            it('should omit an input whose picker is empty', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                expect(await tab._readPromptInputValue(fileField(null))).toBeUndefined();
            });

            it('should return a text field\'s value unchanged', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                expect(await tab._readPromptInputValue({ type: 'text', value: 'hi' })).toBe('hi');
            });
        });
    });

    describe('prompts view', () => {
        it('should load AI models when switching to the prompts view', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            expect(DataService.getAiModels).toHaveBeenCalled();
            expect(ctx.el.querySelector('[data-model-id="m-1"]')).toBeTruthy();
        });

        it('should open the AI model details dialog and load its definition', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            expect(DialogService.show).toHaveBeenCalled();
            // The model's published configuration id is passed so the live iteration can be flagged.
            expect(DataService.getAiModelDefinition).toHaveBeenCalledWith('m-1', 'cfg-1');
            // The GptDynamicPrompt is shown as friendly, editable prompt text with {tokens}.
            const promptTa = document.querySelector('.pdt-agent-prompt-textarea');
            expect(promptTa.value).toBe('Extract totals from {Receipt}');
        });

        describe('classifier Quick test panel', () => {
            /**
             * Builds the Quick-test panel off a rendered tab.
             * @returns {Promise<HTMLElement>} The panel element.
             */
            const buildPanel = async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                return tab._buildClassifierTest({ id: 'cfg-1' });
            };

            it('should use the same hero layout as the prompt Test panel', async () => {
                const panel = await buildPanel();

                const hero = panel.querySelector('.pdt-prompt-test-hero');
                expect(hero).toBeTruthy();
                expect(hero.querySelector('.pdt-prompt-card-title').textContent).toBe('Quick test');
                // The action sits in the hero, right-hand side, like Test does.
                expect(hero.querySelector('.pdt-prompt-test-actions [data-action="run-quick-test"]')).toBeTruthy();
            });

            it('should put the input in a card and the results in a runs list', async () => {
                const panel = await buildPanel();

                expect(panel.querySelector('.pdt-prompt-card .pdt-agent-prompt-textarea')).toBeTruthy();
                expect(panel.querySelector('.pdt-agent-test-runs')).toBeTruthy();
                expect(panel.querySelector('.pdt-prompt-test-empty')).toBeTruthy();
            });

            it('should run the classifier with the entered text', async () => {
                const panel = await buildPanel();
                panel.querySelector('textarea').value = 'some text';

                panel.querySelector('[data-action="run-quick-test"]').click();
                await flush();

                expect(DataService.quickTestModel).toHaveBeenCalledWith('cfg-1', 'some text');
            });
        });

        it('should title the dialog by what the item actually is, not "AI Model"', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();

            const title = DialogService.show.mock.calls.at(-1)[0];
            expect(title).toContain('Prompt:');
            expect(title).not.toContain('AI Model:');
        });

        it('should label the iteration with its version and mark the live one', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            const heading = document.querySelector('.pdt-prompt-statusbar');
            expect(heading.textContent).toContain('Version 1.0');
            expect(heading.textContent).toContain('Published');
            expect(document.querySelector('.pdt-agent-config.is-active')).toBeTruthy();
        });

        it('should show the config JSON in Definition and the settings controls in the Settings tab', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            // The friendly prompt is primary; the raw JSON is tucked into the Advanced disclosure.
            expect(document.querySelector('.pdt-agent-prompt-textarea')).toBeTruthy();
            const textarea = document.querySelector('.pdt-agent-model-context .pdt-agent-edit-textarea');
            expect(textarea.value).toContain('gpt-41-mini');
            expect(document.querySelector('.pdt-agent-model-context [data-setting="temperature"]')).toBeNull();
            // Settings tab holds the friendly controls, grouped.
            document.querySelector('[data-tab="settings"]').click();
            await flush();
            expect(document.querySelector('[data-setting="temperature"]')).toBeTruthy();
            expect(document.querySelector('[data-setting="codeInterpreter"]')).toBeTruthy();
            expect(document.querySelector('.pdt-setting-group')).toBeTruthy();
        });

        it('should publish a prompt-text edit made in the friendly editor, keeping its tokens', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();

            const promptTa = document.querySelector('.pdt-agent-prompt-textarea');
            promptTa.value = 'Get totals from {Receipt}';
            promptTa.dispatchEvent(new Event('input', { bubbles: true }));
            [...document.querySelectorAll('.pdt-dialog-footer button')].find(b => b.textContent === 'Save').click();
            await flush();

            const published = JSON.parse(DataService.publishAiPrompt.mock.calls[0][1]);
            expect(published.prompt).toEqual([
                { type: 'literal', text: 'Get totals from ' },
                { type: 'inputVariable', id: 'Receipt' }
            ]);
        });

        it('should keep the friendly prompt and the raw JSON in sync', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();

            // Editing the raw JSON updates the friendly prompt text.
            const rawTa = document.querySelector('.pdt-agent-model-context .pdt-agent-edit-textarea');
            const cfg = JSON.parse(rawTa.value);
            cfg.prompt = [{ type: 'literal', text: 'Brand new prompt' }];
            rawTa.value = JSON.stringify(cfg);
            rawTa.dispatchEvent(new Event('input', { bubbles: true }));

            expect(document.querySelector('.pdt-agent-prompt-textarea').value).toBe('Brand new prompt');
        });

        it('should collapse older versions into a version-history section', async () => {
            DataService.getAiModelDefinition.mockResolvedValueOnce({
                configurations: [
                    { ...structuredClone(mockPromptConfig), id: 'cfg-1', version: '2.0', isActive: true },
                    { ...structuredClone(mockPromptConfig), id: 'cfg-0', version: '1.0', isActive: false }
                ],
                creationContext: null
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();

            const history = document.querySelector('.pdt-agent-version-history');
            expect(history).toBeTruthy();
            expect(history.querySelector('.pdt-agent-history-count').textContent).toBe('1');
            // The live version is edited above; the history holds the one older version.
            expect(history.querySelectorAll('.pdt-agent-config').length).toBe(1);
        });

        it('should show each version\'s last-run date inline in its heading (live and history), not as a note', async () => {
            DataService.getAiModelDefinition.mockResolvedValueOnce({
                configurations: [
                    { ...structuredClone(mockPromptConfig), id: 'cfg-1', version: '2.0', isActive: true, lastRunOn: '1/2/2026' },
                    { ...structuredClone(mockPromptConfig), id: 'cfg-0', version: '1.0', isActive: false, lastRunOn: '1/1/2026' }
                ],
                creationContext: null
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();

            // Live version: the date sits in the heading lead (beneath the version number).
            const liveLead = document.querySelector('.pdt-agent-config.is-active .pdt-agent-config-lead');
            expect(liveLead.querySelector('.pdt-agent-config-version').textContent).toContain('2.0');
            expect(liveLead.querySelector('.pdt-agent-config-date').textContent).toContain('1/2/2026');
            // Badges live on the right of the same heading, not in the lead column.
            const liveHeading = document.querySelector('.pdt-agent-config.is-active .pdt-agent-config-heading-inner');
            expect(liveHeading.querySelector('.pdt-agent-config-badges')).toBeTruthy();

            // History version: date shown the same inline way — and the old standalone note is gone.
            const historyRow = document.querySelector('.pdt-agent-version-history .pdt-agent-config');
            expect(historyRow.querySelector('.pdt-agent-config-date').textContent).toContain('1/1/2026');
            expect(document.querySelector('.pdt-agent-config-when')).toBeNull();
        });

        it('should surface a failed training iteration with its parsed error', async () => {
            DataService.getAiModelDefinition.mockResolvedValueOnce({
                configurations: [{
                    ...structuredClone(mockPromptConfig),
                    version: '1.0',
                    status: 'Train failed',
                    isActive: false,
                    isFailed: true,
                    lastError: { code: 'InternalError', message: 'InternalError', type: 'Error', dateTime: '', innerErrors: [] },
                    sections: []
                }],
                creationContext: null
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            const error = document.querySelector('.pdt-agent-config-error');
            expect(error).toBeTruthy();
            expect(error.textContent).toContain('InternalError');
        });

        /** Clicks the shared footer Save button (dirty-aware) in the model dialog. */
        const clickFooterSave = () => {
            [...document.querySelectorAll('.pdt-dialog-footer button')]
                .find(b => b.textContent === 'Save').click();
        };

        it('should publish the live version via the footer Save button', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            const textarea = document.querySelector('.pdt-agent-model-context .pdt-agent-edit-textarea');
            expect(textarea).toBeTruthy(); // model m-1 is unmanaged -> live version is editable
            textarea.value = '{"prompt":[]}';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            clickFooterSave();
            await flush();
            // A prompt is saved through AIModelPublish: PATCHing msdyn_customconfiguration on a
            // prompt configuration is rejected with "Unexpected parameter(s)".
            expect(DataService.updateAiModelConfiguration).not.toHaveBeenCalled();
            expect(DataService.publishAiPrompt).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'm-1', templateId: 'tpl-1' }),
                '{"prompt":[]}'
            );
        });

        it('should keep the footer Save disabled until there is a change', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            const saveBtn = [...document.querySelectorAll('.pdt-dialog-footer button')].find(b => b.textContent === 'Save');
            expect(saveBtn.disabled).toBe(true);
            const textarea = document.querySelector('.pdt-agent-model-context .pdt-agent-edit-textarea');
            textarea.value = '{"prompt":[]}';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            expect(saveBtn.disabled).toBe(false);
            // Undo appears once dirty and reverts the edit.
            const undoBtn = [...document.querySelectorAll('.pdt-dialog-footer button')].find(b => b.textContent === 'Undo');
            expect(undoBtn.style.display).not.toBe('none');
            undoBtn.click();
            expect(saveBtn.disabled).toBe(true);
        });

        it('should poll the new run configuration until the prompt publish lands', async () => {
            DataService.getAiConfigurationStatus
                .mockResolvedValueOnce({ statusCode: 3, status: 'Publishing', isPublished: false })
                .mockResolvedValueOnce({ statusCode: 7, status: 'Published', isPublished: true });
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            // Resolve the poll delay immediately so the test does not wait on a real timer.
            const originalWait = tab._waitForPromptPublish.bind(tab);
            tab._waitForPromptPublish = (id) => originalWait(id, { intervalMs: 0, wait: () => Promise.resolve() });

            const textarea = document.querySelector('.pdt-agent-model-context .pdt-agent-edit-textarea');
            textarea.value = '{"prompt":[]}';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            clickFooterSave();
            await flush();

            expect(DataService.getAiConfigurationStatus).toHaveBeenCalledWith('new-run-cfg');
            // The publish moved the model onto the new configuration.
            expect(tab.aiModels[0].activeConfigId).toBe('new-run-cfg');
        });

        it('should badge the card with the latest configuration status', async () => {
            DataService.getAiModels.mockResolvedValueOnce([{
                ...mockModels[0],
                configStatus: { state: 'failed', status: 'Train failed', configId: 'cfg-x', version: '1.0' }
            }]);
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            const badge = ctx.el.querySelector('.pdt-capi-badge-config-failed');
            expect(badge.textContent).toBe('Train failed');
        });

        it('should badge a live model with the Live label', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            expect(ctx.el.querySelector('.pdt-capi-badge-config-live')).toBeTruthy();
        });

        it('should expose Settings and Test tabs for an editable prompt', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            const tabs = [...document.querySelectorAll('.pdt-agent-def-tabs .pdt-sub-tab')].map(t => t.dataset.tab);
            expect(tabs).toEqual(['definition', 'settings', 'test', 'runs', 'evaluations']);
        });

        it('should order the footer Save as, Save, Undo, Close (Undo hidden until dirty)', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            const buttons = [...document.querySelectorAll('.pdt-dialog-footer button')];
            expect(buttons.map(b => b.textContent)).toEqual(['Save as', 'Save', 'Undo', 'Close']);
            // Undo is hidden until there are unsaved changes, so the visible footer reads "Save as, Save, Close".
            expect(buttons.find(b => b.textContent === 'Undo').style.display).toBe('none');
        });

        it('should not offer a Settings or Test tab for a trained model', async () => {
            DataService.getAiModels.mockResolvedValueOnce([{
                ...mockModels[0], kind: 'custom', kindLabel: 'Custom model', templateName: 'BinaryClassification'
            }]);
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            const tabs = [...document.querySelectorAll('.pdt-agent-def-tabs .pdt-sub-tab')].map(t => t.dataset.tab);
            expect(tabs).toEqual(['definition', 'runs', 'evaluations']);
        });

        it('should publish a settings change made in the Settings tab', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            document.querySelector('[data-tab="settings"]').click();
            await flush();

            document.querySelector('[data-setting="temperature"]').value = '0.7';
            document.querySelector('[data-setting="codeInterpreter"]').checked = true;
            // A settings change folds into the live config (the single source of truth).
            document.querySelector('.pdt-agent-settings').dispatchEvent(new Event('change', { bubbles: true }));
            clickFooterSave();
            await flush();

            expect(DataService.publishAiPrompt).toHaveBeenCalled();
            const published = JSON.parse(DataService.publishAiPrompt.mock.calls[0][1]);
            expect(published.modelParameters.gptParameters.temperature).toBe(0.7);
            expect(published.settings.runtime).toBe('codeinterpreter');
            // The prompt itself must survive a settings-only change.
            expect(published.prompt).toEqual([
                { type: 'literal', text: 'Extract totals from ' },
                { type: 'inputVariable', id: 'Receipt' }
            ]);
        });

        it('should save a Definition edit and a Settings change together in one Save', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();

            // Edit the prompt in the Definition tab's JSON...
            const textarea = document.querySelector('.pdt-agent-model-context .pdt-agent-edit-textarea');
            const cfg = JSON.parse(textarea.value);
            cfg.prompt = [{ type: 'literal', text: 'Changed' }];
            textarea.value = JSON.stringify(cfg);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            // ...and change a setting in the Settings tab.
            document.querySelector('[data-tab="settings"]').click();
            await flush();
            document.querySelector('[data-setting="temperature"]').value = '0.9';
            document.querySelector('.pdt-agent-settings').dispatchEvent(new Event('change', { bubbles: true }));

            clickFooterSave();
            await flush();

            // One Save publishes both edits merged into the same config.
            const published = JSON.parse(DataService.publishAiPrompt.mock.calls[0][1]);
            expect(published.prompt).toEqual([{ type: 'literal', text: 'Changed' }]);
            expect(published.modelParameters.gptParameters.temperature).toBe(0.9);
        });

        it('should run a quick test and show the output with its cost', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            document.querySelector('[data-tab="test"]').click();
            await flush();
            document.querySelector('[data-action="run-quick-test"]').click();
            await flush();

            // Third arg is the reuse payload — null for a plain run (regenerate); fourth is the inputs
            // map — null when the prompt declares no input variables.
            // A first run keeps whatever code the configuration carries, so it does not regenerate.
            expect(DataService.quickTestAiConfiguration).toHaveBeenCalledWith('cfg-1', expect.any(String), null, null, false);
            const result = document.querySelector('.pdt-agent-test-runs').textContent;
            expect(result).toContain('gpt-41-2025-04-14');
            expect(result).toContain('1017');
        });

        it('should show "Running…" in the results area while a test runs, then swap in the result', async () => {
            let resolveRun;
            DataService.quickTestAiConfiguration.mockReturnValueOnce(new Promise(r => { resolveRun = r; }));
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            document.querySelector('[data-tab="test"]').click();
            await flush();

            const list = document.querySelector('.pdt-agent-test-runs');
            // Before running: the empty-state guidance ("…each run is kept so you can compare") sits in
            // the results area.
            expect(list.querySelector('.pdt-prompt-test-empty').textContent).toContain('compare');

            document.querySelector('[data-action="run-quick-test"]').click();
            await flush();
            // While running: the hint is replaced by the "Running…" note in the results area (not a
            // small label by the buttons).
            expect(list.querySelector('.pdt-prompt-test-empty')).toBeNull();
            expect(list.querySelector('.pdt-prompt-test-running')?.textContent).toContain('Running');

            resolveRun({
                succeeded: true, text: 'Hi', mimeType: 'text/plain', modelName: 'gpt-4o', finishReason: 'stop',
                totalTokens: 5, promptTokens: 4, completionTokens: 1, credits: 1, copilotCredits: 0, code: ''
            });
            await flush();
            // After: the Running note is gone and a result row is shown.
            expect(list.querySelector('.pdt-prompt-test-running')).toBeNull();
            expect(list.querySelector('.pdt-agent-run-row')).toBeTruthy();
        });

        it('should ignore further clicks while a test is already running', async () => {
            let resolveRun;
            DataService.quickTestAiConfiguration.mockReturnValueOnce(new Promise(r => { resolveRun = r; }));
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            document.querySelector('[data-tab="test"]').click();
            await flush();
            DataService.quickTestAiConfiguration.mockClear();

            // Every run costs credits, so a second click mid-run must not start another.
            const runBtn = document.querySelector('[data-action="run-quick-test"]');
            runBtn.click();
            await flush();
            runBtn.click();
            await flush();

            expect(DataService.quickTestAiConfiguration).toHaveBeenCalledTimes(1);

            resolveRun({ succeeded: true, text: 'Hi', code: '' });
            await flush();
            expect(runBtn.disabled).toBe(false);
        });

        it('should render an input field per declared input variable and run with their values', async () => {
            const withInputs = () => ({
                configurations: [{
                    ...structuredClone(mockPromptConfig),
                    sections: [{
                        column: 'msdyn_customconfiguration', label: 'Configuration',
                        text: JSON.stringify({
                            prompt: [{ type: 'literal', text: 'Answer ' }, { type: 'inputVariable', id: 'Question' }],
                            definitions: { inputs: [{ id: 'Question', text: 'Your question', type: 'Text' }] },
                            modelParameters: { modelType: 'gpt-41-mini', gptParameters: { temperature: 0 } }
                        }),
                        language: 'json', editable: true, compressed: false
                    }]
                }]
            });
            // Two loads: the Definition tab, then the Test tab (each re-fetches).
            DataService.getAiModelDefinition.mockResolvedValueOnce(withInputs()).mockResolvedValueOnce(withInputs());
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            document.querySelector('[data-tab="test"]').click();
            await flush();

            // The declared input is shown as a labelled field.
            const field = document.querySelector('.pdt-prompt-test-inputs .pdt-prompt-test-input-field');
            expect(field).toBeTruthy();
            expect(document.querySelector('.pdt-prompt-test-input-label').textContent).toBe('Your question');

            // Filling it and running sends the value keyed by the input's id.
            field.value = 'What is 2 + 2?';
            document.querySelector('[data-action="run-quick-test"]').click();
            await flush();
            expect(DataService.quickTestAiConfiguration).toHaveBeenLastCalledWith(
                'cfg-1', expect.any(String), null, { Question: 'What is 2 + 2?' }, false
            );
        });

        it('should not render an input form when the prompt declares no input variables', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            document.querySelector('[data-tab="test"]').click();
            await flush();

            // The default prompt declares no definitions.inputs, so no form is shown.
            expect(document.querySelector('.pdt-prompt-test-inputs')).toBeNull();
        });

        it('should show the code interpreter\'s generated code, logs and plan', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            document.querySelector('[data-tab="test"]').click();
            await flush();
            document.querySelector('[data-action="run-quick-test"]').click();
            await flush();

            const sections = [...document.querySelectorAll('.pdt-agent-test-runs details summary')].map(s => s.textContent);
            expect(sections).toContain('Generated code');
            expect(sections).toContain('Execution logs');
            expect(sections).toContain('Plan');
            expect(document.querySelector('.pdt-agent-test-runs').textContent).toContain('print("hi")');
        });

        it('should accumulate test runs as a log instead of replacing the previous one', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            document.querySelector('[data-tab="test"]').click();
            await flush();

            const runBtn = document.querySelector('[data-action="run-quick-test"]');
            runBtn.click();
            await flush();
            runBtn.click();
            await flush();

            // Two runs → two rows, newest first and the only one expanded.
            const rows = document.querySelectorAll('.pdt-agent-test-runs > .pdt-agent-run-row');
            expect(rows).toHaveLength(2);
            expect(rows[0].open).toBe(true);
            expect(rows[1].open).toBe(false);
        });

        it('should refresh the Runs tab after a test when Runs was already loaded', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            // Open Runs first so it is cached, then run a test from the Test tab.
            document.querySelector('[data-tab="runs"]').click();
            await flush();
            DataService.getAiBuilderRuns.mockClear();
            document.querySelector('[data-tab="test"]').click();
            await flush();
            document.querySelector('[data-action="run-quick-test"]').click();
            await flush();

            // A test writes a new run event, so the cached Runs list is reloaded.
            expect(DataService.getAiBuilderRuns).toHaveBeenCalledWith('m-1');
        });

        it('should offer "Test without regenerating" after a run generates code, and reuse it', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            document.querySelector('[data-tab="test"]').click();
            await flush();

            const reuseBtn = document.querySelector('[data-action="run-quick-test-reuse"]');
            // Hidden until a run produces code (the base config has none stored).
            expect(reuseBtn.style.display).toBe('none');

            document.querySelector('[data-action="run-quick-test"]').click();
            await flush();
            expect(reuseBtn.style.display).toBe('');

            reuseBtn.click();
            await flush();
            // The reuse run sends back the previously generated code + signature (no inputs declared).
            expect(DataService.quickTestAiConfiguration).toHaveBeenLastCalledWith(
                'cfg-1', expect.any(String), { code: 'print("hi")', signature: 'AQAAsig==' }, null, false
            );
        });

        it('should show the stored generated code read-only in the definition', async () => {
            DataService.getAiModelDefinition.mockResolvedValueOnce({
                configurations: [{
                    ...structuredClone(mockPromptConfig),
                    sections: [{
                        column: 'msdyn_customconfiguration', label: 'Configuration',
                        text: JSON.stringify({
                            prompt: [{ type: 'literal', text: 'hi' }],
                            settings: { runtime: 'codeinterpreter' },
                            code: 'print("stored code")', signature: 'sig'
                        }),
                        language: 'json', editable: true, compressed: false
                    }]
                }],
                creationContext: null
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();

            const summaries = [...document.querySelectorAll('.pdt-agent-model-context details summary')].map(s => s.textContent);
            expect(summaries).toContain('Generated code');
            expect(document.querySelector('.pdt-agent-model-context').textContent).toContain('print("stored code")');
        });

        it('should enable "Test without regenerating" immediately when code is already stored', async () => {
            const coded = () => ({
                configurations: [{
                    ...structuredClone(mockPromptConfig),
                    sections: [{
                        column: 'msdyn_customconfiguration', label: 'Configuration',
                        text: JSON.stringify({
                            prompt: [{ type: 'literal', text: 'hi' }],
                            settings: { runtime: 'codeinterpreter' },
                            code: 'print("stored")', signature: 'stored-sig'
                        }),
                        language: 'json', editable: true, compressed: false
                    }]
                }],
                creationContext: null
            });
            // Two loads: the Definition tab, then the Test tab (each re-fetches).
            DataService.getAiModelDefinition.mockResolvedValueOnce(coded()).mockResolvedValueOnce(coded());
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            document.querySelector('[data-tab="test"]').click();
            await flush();

            const reuseBtn = document.querySelector('[data-action="run-quick-test-reuse"]');
            expect(reuseBtn.style.display).not.toBe('none');
            reuseBtn.click();
            await flush();
            expect(DataService.quickTestAiConfiguration).toHaveBeenLastCalledWith(
                'cfg-1', expect.any(String), { code: 'print("stored")', signature: 'stored-sig' }, null, false
            );
        });

        it('should reload the definition after a prompt is saved', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            DataService.getAiModelDefinition.mockClear();

            const textarea = document.querySelector('.pdt-agent-model-context .pdt-agent-edit-textarea');
            textarea.value = '{"prompt":[]}';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            clickFooterSave();
            await flush();

            // The definition is re-fetched so the dialog shows the freshly published version.
            expect(DataService.getAiModelDefinition).toHaveBeenCalledWith('m-1', 'new-run-cfg');
        });

        it('should copy a prompt under a new name via Save as', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();

            document.querySelector('.pdt-agent-saveas-btn').click();
            await flush();
            const input = document.querySelector('.pdt-dialog-prompt input');
            expect(input.value).toBe('Receipt Processing (copy)');
            input.value = 'My Copy';
            document.querySelector('.pdt-dialog-ok').click();
            await flush();

            expect(DataService.saveAsAiPrompt).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'm-1' }), 'My Copy', expect.any(String)
            );
        });

        it('should reject an empty Save as name and keep the dialog open', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();

            document.querySelector('.pdt-agent-saveas-btn').click();
            await flush();
            document.querySelector('.pdt-dialog-prompt input').value = '   ';
            document.querySelector('.pdt-dialog-ok').click();
            await flush();

            expect(DataService.saveAsAiPrompt).not.toHaveBeenCalled();
            expect(document.querySelector('.pdt-dialog-prompt')).toBeTruthy();
        });

        it('should not offer Save as for a trained model', async () => {
            DataService.getAiModels.mockResolvedValueOnce([{
                ...mockModels[0], kind: 'custom', kindLabel: 'Custom model', templateName: 'BinaryClassification'
            }]);
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            expect(document.querySelector('.pdt-agent-saveas-btn')).toBeNull();
        });

        it('should delete an unmanaged prompt/model from its card after confirmation', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            const card = ctx.el.querySelector('[data-model-id="m-1"]');
            card.querySelector('[data-action="delete-model"]').click();
            await flush();

            expect(showConfirmDialog).toHaveBeenCalled();
            expect(DataService.deleteAiModel).toHaveBeenCalledWith('m-1');
            // The card is removed and the model drops out of the cached list.
            expect(ctx.el.querySelector('[data-model-id="m-1"]')).toBeNull();
            expect(tab.aiModels).toHaveLength(0);
        });

        it('should not delete when the confirmation is cancelled', async () => {
            showConfirmDialog.mockResolvedValueOnce(false);
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-model-id="m-1"] [data-action="delete-model"]').click();
            await flush();

            expect(DataService.deleteAiModel).not.toHaveBeenCalled();
            expect(ctx.el.querySelector('[data-model-id="m-1"]')).toBeTruthy();
        });

        it('should not offer Delete on a managed prompt/model', async () => {
            DataService.getAiModels.mockResolvedValueOnce([{ ...mockModels[0], isManaged: true }]);
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            expect(ctx.el.querySelector('[data-action="delete-model"]')).toBeNull();
        });

        it('should disable the Delete button while deleting, and re-enable it on failure', async () => {
            let rejectDelete;
            DataService.deleteAiModel.mockReturnValueOnce(new Promise((_, reject) => { rejectDelete = reject; }));
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            const btn = ctx.el.querySelector('[data-model-id="m-1"] [data-action="delete-model"]');
            btn.click();
            await flush();
            // Locked while the delete is in flight, so it can't fire twice.
            expect(btn.disabled).toBe(true);

            rejectDelete(new Error('locked'));
            await flush();
            // The delete failed, so the card stays and the button is usable again.
            expect(ctx.el.querySelector('[data-model-id="m-1"]')).toBeTruthy();
            expect(btn.disabled).toBe(false);
        });

        it('should report a failed quick test as an error', async () => {
            DataService.quickTestAiConfiguration.mockResolvedValueOnce({
                status: 'Invalid', succeeded: false, text: '', error: 'Bad prompt',
                modelName: '', finishReason: '', totalTokens: null, promptTokens: null,
                completionTokens: null, credits: null
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            document.querySelector('[data-tab="test"]').click();
            await flush();
            document.querySelector('[data-action="run-quick-test"]').click();
            await flush();

            expect(document.querySelector('.pdt-agent-test-runs .pdt-error').textContent).toContain('Bad prompt');
        });

        it('should save a trained model\'s data-binding edit back to the data-binding column', async () => {
            // A trained model still edits each column in place (per-section Save); only prompts use
            // the shared footer editor.
            DataService.getAiModels.mockResolvedValueOnce([{
                ...mockModels[0], kind: 'custom', kindLabel: 'Custom model', templateName: 'BinaryClassification'
            }]);
            DataService.getAiModelDefinition.mockResolvedValueOnce({
                configurations: [{
                    ...structuredClone(mockPromptConfig),
                    isActive: true, typeCode: 190690001, // the Published version — editable
                    sections: [{
                        column: 'msdyn_databinding',
                        label: 'Data binding',
                        text: '{"input":{"schemaName":"account"}}',
                        language: 'json',
                        editable: true,
                        compressed: false
                    }]
                }],
                creationContext: null
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            const textarea = document.querySelector('.pdt-agent-model-context .pdt-agent-edit-textarea');
            textarea.value = '{"input":{"schemaName":"contact"}}';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            [...document.querySelectorAll('.pdt-agent-model-context .pdt-agent-edit-actions button')]
                .find(b => b.textContent === 'Save').click();
            await flush();
            expect(DataService.updateAiModelConfiguration).toHaveBeenCalledWith(
                'cfg-1', '{"input":{"schemaName":"contact"}}', 'msdyn_databinding'
            );
        });

        it('should show a model\'s bound columns with friendly input labels (hiding the record id)', async () => {
            DataService.getAiModels.mockResolvedValueOnce([{
                ...mockModels[0], kind: 'custom', kindLabel: 'Custom model', templateName: 'TextClassificationV2'
            }]);
            DataService.getAiModelDefinition.mockResolvedValueOnce({
                configurations: [{
                    ...structuredClone(mockPromptConfig),
                    isActive: true, typeCode: 190690000,
                    sections: [{
                        column: 'msdyn_databinding', label: 'Data binding',
                        text: JSON.stringify({ input: { schemaName: 'conversationtranscript', attributes: [
                            { specificationName: 'text', schemaName: 'content' },
                            { specificationName: 'tags', schemaName: 'metadata' },
                            { specificationName: 'id', schemaName: 'conversationtranscriptid' }
                        ] } }),
                        language: 'json', editable: true, compressed: false
                    }]
                }],
                creationContext: null
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();

            const grid = document.querySelector('.pdt-agent-model-context .pdt-agent-info-grid');
            // Known input roles become friendly labelled rows.
            const labels = [...grid.querySelectorAll('strong')].map(s => s.textContent);
            expect(labels).toContain('Text input:');
            expect(labels).toContain('Tags input:');
            expect(grid.textContent).toContain('content');
            expect(grid.textContent).toContain('metadata');
            // The record-id role is hidden (not a bound "input" the user cares about).
            expect(grid.textContent).not.toContain('conversationtranscriptid');
        });

        /** A custom model whose config carries a `msdyn_modelperformance` section. */
        function trainedModelWithPerformance(perfText) {
            DataService.getAiModels.mockResolvedValueOnce([{
                ...mockModels[0], kind: 'custom', kindLabel: 'Custom model', templateName: 'TextClassificationV2'
            }]);
            DataService.getAiModelDefinition.mockResolvedValueOnce({
                configurations: [{
                    ...structuredClone(mockPromptConfig),
                    isActive: true, typeCode: 190690000,
                    sections: [{
                        column: 'msdyn_modelperformance', label: 'Model performance',
                        text: perfText, language: 'json', editable: false, compressed: false
                    }]
                }],
                creationContext: null
            });
        }

        async function openModel(ctx) {
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
        }

        it('should render a trained model\'s performance as a friendly panel (tiles + coloured chips) with raw JSON below', async () => {
            trainedModelWithPerformance(JSON.stringify({
                metrics: [
                    { isGlobalScore: true, name: 'weightedF1', value: 0.9473684430122375, type: 'Percentage' },
                    { isGlobalScore: false, name: 'accuracy', value: 0.9024389982223511, type: 'Percentage' }
                ],
                details: [{
                    id: '{"BotName":"x"}', category: 'tag',
                    metrics: [
                        { name: 'numberOfCasesTotal', value: 112, type: 'Numerical' },
                        { name: 'numberOfCasesTestSet', value: 37, type: 'Numerical' },
                        { name: 'precision', value: 0.9230769276618958, type: 'Percentage' },
                        { name: 'recall', value: 0.9729729890823364, type: 'Percentage' },
                        { name: 'f1Score', value: 0.9473683834075928, type: 'Percentage' },
                        { name: 'grade', value: 2, type: 'Numerical' }
                    ]
                }]
            }));
            const ctx = await renderTab();
            tab = ctx.tab;
            await openModel(ctx);

            const panel = document.querySelector('.pdt-model-perf');
            expect(panel).toBeTruthy();
            // Accuracy leads as a radial gauge: rounded score in the ring, coloured green (>= 80%).
            const gauge = panel.querySelector('.pdt-perf-gauge');
            expect(gauge.querySelector('.pdt-perf-gauge-value').textContent).toBe('90');
            expect(gauge.querySelector('.pdt-perf-gauge-arc-high')).toBeTruthy();
            expect(panel.querySelector('.pdt-perf-gauge-label').textContent).toBe('Accuracy');
            // The remaining global score (Weighted F1) sits beside it as a stat tile.
            expect([...panel.querySelectorAll('.pdt-agent-runs-stat')].some(t => t.textContent.includes('Weighted F1'))).toBe(true);
            // Precision / Recall / F1 as coloured chips.
            const chipLabels = [...panel.querySelectorAll('.pdt-model-perf-chips .pdt-model-perf-metric-label')]
                .map(l => l.textContent);
            expect(chipLabels).toEqual(['Precision', 'Recall', 'F1 score']);
            expect(panel.querySelector('.pdt-model-perf-chips .pdt-eval-score-high')).toBeTruthy();
            // Coverage line, and grade in the secondary grid (not a chip).
            expect(panel.querySelector('.pdt-model-perf-coverage').textContent).toBe('112 cases · 37 in test set');
            expect(panel.querySelector('.pdt-model-perf-grid').textContent).toContain('Grade');
            // Headline chip on the section summary + raw JSON tucked below.
            const section = document.querySelector('.pdt-model-perf-section');
            expect(section.querySelector('summary .pdt-model-perf-summary-chip').textContent).toBe('90.2%');
            expect(section.querySelector('.pdt-agent-raw-config .copyable-code-block')).toBeTruthy();
            // A "Download detailed metrics" action (the raw performance JSON) is offered.
            expect(section.querySelector('.pdt-model-perf-download').textContent).toBe('Download detailed metrics');
        });

        it('should fall back to the raw JSON section when the performance payload is not parseable', async () => {
            trainedModelWithPerformance('not json');
            const ctx = await renderTab();
            tab = ctx.tab;
            await openModel(ctx);

            expect(document.querySelector('.pdt-model-perf')).toBeNull();
            const rawSummary = [...document.querySelectorAll('.pdt-agent-model-context .pdt-agent-raw-config > summary')]
                .find(s => s.textContent.includes('Model performance'));
            expect(rawSummary).toBeTruthy();
        });

        it('should train a Draft training configuration in place and report the outcome', async () => {
            DataService.getAiModels.mockResolvedValueOnce([{
                ...mockModels[0], id: 'm-trained', kind: 'custom', kindLabel: 'Custom model',
                templateName: 'BinaryClassification', activeConfigId: ''
            }]);
            DataService.getAiModelDefinition.mockResolvedValueOnce({
                configurations: [{
                    ...structuredClone(mockPromptConfig),
                    id: 'train-cfg', typeCode: 190690000, type: 'TrainingConfiguration',
                    isActive: false, status: 'Draft', stateCode: 0, // never trained → Train in place
                    sections: [{
                        column: 'msdyn_customconfiguration', label: 'Configuration',
                        text: '[]', language: 'json', editable: true, compressed: false
                    }]
                }],
                creationContext: null
            });
            DataService.getAiConfigurationStatus.mockResolvedValueOnce({
                statusCode: 6, status: 'Trained', isPublished: false
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();

            const trainBtn = [...document.querySelectorAll('.pdt-model-version-actions button')].find(b => b.textContent === 'Train');
            expect(trainBtn).toBeTruthy();
            trainBtn.click();
            await flush();

            expect(DataService.trainAiConfiguration).toHaveBeenCalledWith('train-cfg');
            expect(DataService.retrainAiConfiguration).not.toHaveBeenCalled();
            expect(document.querySelector('.pdt-model-version-actions .pdt-agent-train-status').textContent).toContain('Trained');
        });

        it('should retrain a trained (Done) configuration by cloning a new iteration', async () => {
            DataService.getAiModels.mockResolvedValueOnce([{
                ...mockModels[0], id: 'm-trained', name: 'Category Classification',
                kind: 'custom', kindLabel: 'Custom model', templateName: 'TextClassificationV2', activeConfigId: ''
            }]);
            DataService.getAiModelDefinition.mockResolvedValueOnce({
                configurations: [{
                    ...structuredClone(mockPromptConfig),
                    id: 'trained-cfg', typeCode: 190690000, type: 'TrainingConfiguration',
                    isActive: false, status: 'Trained', statusCode: 6, stateCode: 2, // Done → Retrain
                    sections: [
                        { column: 'msdyn_databinding', label: 'Data binding', text: '{"input":{"schemaName":"conversationtranscript"}}', language: 'json', editable: true, compressed: false },
                        { column: 'msdyn_customconfiguration', label: 'Configuration', text: '{"language":"en"}', language: 'json', editable: true, compressed: false }
                    ]
                }],
                creationContext: null
            });
            DataService.getAiConfigurationStatus.mockResolvedValueOnce({
                statusCode: 6, status: 'Trained', isPublished: false
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();

            const btn = [...document.querySelectorAll('.pdt-model-version-actions button')].find(b => b.textContent === 'Retrain');
            expect(btn).toBeTruthy(); // Done config offers Retrain, not Train
            btn.click();
            await flush();

            // Clones a new iteration from this config's databinding + customconfiguration, not train-in-place.
            expect(DataService.retrainAiConfiguration).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'm-trained' }),
                { id: 'trained-cfg', databinding: '{"input":{"schemaName":"conversationtranscript"}}', customConfiguration: '{"language":"en"}' }
            );
            expect(DataService.trainAiConfiguration).not.toHaveBeenCalled();
            // A retrain refreshes the dialog so the new iteration appears (re-fetches the definition).
            expect(DataService.getAiModelDefinition).toHaveBeenCalledTimes(2);
        });

        it('should organize a trained model into Published / Last trained / read-only History', async () => {
            const cfg = (over) => ({
                ...structuredClone(mockPromptConfig), stateCode: 2, statusCode: 6,
                sections: [{ column: 'msdyn_customconfiguration', label: 'Configuration', text: '{"language":"en"}', language: 'json', editable: true, compressed: false }],
                ...over
            });
            DataService.getAiModels.mockResolvedValueOnce([{
                ...mockModels[0], id: 'm-trained', kind: 'custom', kindLabel: 'Custom model', templateName: 'TextClassificationV2'
            }]);
            DataService.getAiModelDefinition.mockResolvedValueOnce({
                configurations: [ // newest-first: published run config, latest training config, older training config
                    cfg({ id: 'run-2', version: '3.0', isActive: true, typeCode: 190690001, status: 'Published' }),
                    cfg({ id: 'train-2', version: '2.0', isActive: false, typeCode: 190690000, status: 'Trained' }),
                    cfg({ id: 'train-1', version: '1.0', isActive: false, typeCode: 190690000, status: 'Trained' })
                ],
                creationContext: null
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();

            const context = document.querySelector('.pdt-agent-model-context');
            expect([...context.querySelectorAll('.pdt-agent-version-heading')].map(h => h.textContent))
                .toEqual(['Published version', 'Last trained version']);
            // The Last trained (training) version keeps its Retrain button; it lives outside History.
            expect(context.querySelector('.pdt-agent-version-history .pdt-model-version-actions')).toBeNull();
            expect([...context.querySelectorAll('.pdt-model-version-actions button')].some(b => b.textContent === 'Retrain')).toBe(true);
            // The one older iteration collapses into a read-only History (no Train/Retrain, no editors).
            const history = context.querySelector('.pdt-agent-version-history');
            expect(history.querySelector('.pdt-agent-history-count').textContent).toBe('1');
            expect(history.querySelectorAll('.pdt-agent-config')).toHaveLength(1);
            expect(history.querySelector('.pdt-agent-edit-actions')).toBeNull();
        });

        /** A published trained model: a Published run config (with a binding template) + a Last-trained config. */
        function trainedModelWithVersions() {
            DataService.getAiModels.mockResolvedValueOnce([{
                ...mockModels[0], id: 'm-trained', kind: 'custom', kindLabel: 'Custom model',
                templateName: 'TextClassificationV2', activeConfigId: 'run-1'
            }]);
            DataService.getAiModelDefinition.mockResolvedValueOnce({
                configurations: [
                    { ...structuredClone(mockPromptConfig), id: 'run-1', version: '3.0', isActive: true, typeCode: 190690001, stateCode: 2, statusCode: 7, status: 'Published',
                        sections: [
                            { column: 'msdyn_databinding', label: 'Data binding', text: '{"input":{},"output":{"relatedEntities":[]}}', language: 'json', editable: false, compressed: false },
                            { column: 'msdyn_schedulingoptions', label: 'Schedule', text: '{"prediction":{}}', language: 'json', editable: false, compressed: false }
                        ] },
                    { ...structuredClone(mockPromptConfig), id: 'train-2', version: '2.0', isActive: false, typeCode: 190690000, stateCode: 2, statusCode: 6, status: 'Trained',
                        sections: [{ column: 'msdyn_customconfiguration', label: 'Configuration', text: '{"language":"en"}', language: 'json', editable: true, compressed: false }] }
                ],
                creationContext: null
            });
        }
        /** An unpublished trained model: the prior run config is now inactive + a Last-trained config.
         *  Only one run config can be live, so Publish appears on the Last-trained only in this state. */
        function trainedModelUnpublished() {
            DataService.getAiModels.mockResolvedValueOnce([{
                ...mockModels[0], id: 'm-trained', kind: 'custom', kindLabel: 'Custom model',
                templateName: 'TextClassificationV2', activeConfigId: ''
            }]);
            DataService.getAiModelDefinition.mockResolvedValueOnce({
                configurations: [
                    { ...structuredClone(mockPromptConfig), id: 'run-1', version: '3.0', isActive: false, typeCode: 190690001, stateCode: 2, statusCode: 6, status: 'Trained',
                        sections: [
                            { column: 'msdyn_databinding', label: 'Data binding', text: '{"input":{},"output":{"relatedEntities":[]}}', language: 'json', editable: false, compressed: false },
                            { column: 'msdyn_schedulingoptions', label: 'Schedule', text: '{"prediction":{}}', language: 'json', editable: false, compressed: false }
                        ] },
                    { ...structuredClone(mockPromptConfig), id: 'train-2', version: '2.0', isActive: false, typeCode: 190690000, stateCode: 2, statusCode: 6, status: 'Trained',
                        sections: [{ column: 'msdyn_customconfiguration', label: 'Configuration', text: '{"language":"en"}', language: 'json', editable: true, compressed: false }] }
                ],
                creationContext: null
            });
        }
        async function openTrainedModel(ctx) {
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
        }
        const versionButton = (label) => [...document.querySelectorAll('.pdt-model-version-actions button')].find(b => b.textContent === label);

        it('should run a classifier Quick test inline and show suggested tags with confidence', async () => {
            trainedModelWithVersions();
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTrainedModel(ctx);

            // The tester stays hidden until the user opens Quick test.
            expect(document.querySelector('.pdt-model-quicktest').hidden).toBe(true);
            versionButton('Quick test').click(); // reveal the inline tester
            const panel = document.querySelector('.pdt-model-quicktest');
            expect(panel.hidden).toBe(false);
            panel.querySelector('.pdt-model-quicktest-text').value = 'Where is my order?';
            [...panel.querySelectorAll('button')].find(b => b.textContent === 'Test').click();
            await flush();

            expect(DataService.quickTestModel).toHaveBeenCalledWith('run-1', 'Where is my order?');
            // The result lands as a run row, like the prompt Test panel.
            const run = panel.querySelector('.pdt-agent-run-row');
            expect(run).toBeTruthy();
            const tags = [...run.querySelectorAll('.pdt-model-tag')];
            expect(tags[0].querySelector('.pdt-model-tag-name').textContent).toBe('Billing');
            expect(tags[0].querySelector('.pdt-eval-score').textContent).toBe('93%');
            expect(run.querySelector('summary').textContent).toContain('20 credits');
        });

        it('should stack each Quick test run newest-first instead of overwriting the last', async () => {
            trainedModelWithVersions();
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTrainedModel(ctx);
            versionButton('Quick test').click();
            const panel = document.querySelector('.pdt-model-quicktest');
            const runTest = () => [...panel.querySelectorAll('button')].find(b => b.textContent === 'Test').click();

            panel.querySelector('.pdt-model-quicktest-text').value = 'first';
            runTest();
            await flush();
            DataService.quickTestModel.mockResolvedValueOnce({
                succeeded: true, shape: 'scores',
                predictions: [{ label: 'Second', score: 0.5, value: '' }],
                raw: '', predictionId: 'pred-2', credits: 20, copilotCredits: 1.5, status: 'Success', error: ''
            });
            panel.querySelector('.pdt-model-quicktest-text').value = 'second';
            runTest();
            await flush();

            const runs = [...panel.querySelectorAll('.pdt-agent-run-row')];
            expect(runs).toHaveLength(2);
            expect(runs[0].textContent).toContain('Second');
        });

        it('should collapse the previous Quick test run so only the newest is expanded', async () => {
            // Matches the prompt Test panel, which would otherwise leave every run open.
            trainedModelWithVersions();
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTrainedModel(ctx);
            versionButton('Quick test').click();
            const panel = document.querySelector('.pdt-model-quicktest');
            const runTest = () => [...panel.querySelectorAll('button')].find(b => b.textContent === 'Test').click();

            panel.querySelector('.pdt-model-quicktest-text').value = 'first';
            runTest();
            await flush();
            panel.querySelector('.pdt-model-quicktest-text').value = 'second';
            runTest();
            await flush();

            const runs = [...panel.querySelectorAll('.pdt-agent-run-row')];
            expect(runs[0].open).toBe(true);
            expect(runs[1].open).toBe(false);
        });

        it('should say the model returned nothing rather than leaving the result blank', async () => {
            trainedModelWithVersions();
            DataService.quickTestModel.mockResolvedValueOnce({
                succeeded: true, shape: 'scores', predictions: [],
                raw: '', predictionId: '', credits: 20, copilotCredits: null, status: 'Success', error: ''
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTrainedModel(ctx);
            versionButton('Quick test').click();
            const panel = document.querySelector('.pdt-model-quicktest');
            panel.querySelector('.pdt-model-quicktest-text').value = 'asdasf';
            [...panel.querySelectorAll('button')].find(b => b.textContent === 'Test').click();
            await flush();

            expect(panel.querySelector('.pdt-agent-run-row').textContent)
                .toContain('The model returned nothing for this input');
        });

        it('should show an unrecognized prediction payload verbatim', async () => {
            trainedModelWithVersions();
            DataService.quickTestModel.mockResolvedValueOnce({
                succeeded: true, shape: 'other', predictions: [],
                raw: '{\n  "boundingBoxes": []\n}',
                predictionId: '', credits: null, copilotCredits: null, status: 'Success', error: ''
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTrainedModel(ctx);
            versionButton('Quick test').click();
            const panel = document.querySelector('.pdt-model-quicktest');
            panel.querySelector('.pdt-model-quicktest-text').value = 'x';
            [...panel.querySelectorAll('button')].find(b => b.textContent === 'Test').click();
            await flush();

            expect(panel.querySelector('.pdt-agent-run-row').textContent).toContain('boundingBoxes');
        });

        it('should publish the last-trained version once nothing is published, reusing the prior run config\'s binding template', async () => {
            trainedModelUnpublished();
            DataService.getAiConfigurationStatus.mockResolvedValueOnce({ statusCode: 7, status: 'Published', isPublished: true });
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTrainedModel(ctx);

            versionButton('Publish').click();
            await flush();

            expect(DataService.publishTrainedModel).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'm-trained' }),
                'train-2',
                { databinding: '{"input":{},"output":{"relatedEntities":[]}}', schedulingoptions: '{"prediction":{}}', trainingDatabinding: '' }
            );
            // A publish refreshes the dialog so the new run config appears.
            expect(DataService.getAiModelDefinition).toHaveBeenCalledTimes(2);
        });

        it('should not offer Publish on the last-trained version while another config is published', async () => {
            // Dataverse allows only one live run config ("AnotherRunConfigAlreadyPublished"), so the
            // Last-trained version can be published only after the current one is unpublished.
            trainedModelWithVersions();
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTrainedModel(ctx);

            expect(versionButton('Publish')).toBeUndefined();
            // Unpublish is offered on the Published version instead.
            expect(versionButton('Unpublish')).toBeDefined();
        });

        it('should unpublish the published run config only after a confirm click', async () => {
            trainedModelWithVersions();
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTrainedModel(ctx);

            const btn = versionButton('Unpublish');
            btn.click(); // first click arms the confirm
            expect(btn.textContent).toBe('Confirm unpublish');
            expect(DataService.unpublishAiConfiguration).not.toHaveBeenCalled();
            btn.click(); // second click runs it
            await flush();
            // Unpublish targets the published run config (run-1), not the model.
            expect(DataService.unpublishAiConfiguration).toHaveBeenCalledWith('run-1');
        });

        it('should not offer Train on a prompt', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            // Prompts render their own definition (no trained-model version actions / Train button).
            expect(document.querySelector('.pdt-model-version-actions')).toBeNull();
            expect([...document.querySelectorAll('button')].some(b => b.textContent === 'Train')).toBe(false);
        });

        it('should warn before patching a trained model\'s live iteration', async () => {
            // Trained models really are saved by PATCHing the record, so overwriting the live
            // iteration is a genuine hazard — unlike a prompt, which publishes a new version.
            DataService.getAiModels.mockResolvedValueOnce([{
                ...mockModels[0], id: 'm-trained', templateName: 'BinaryClassification',
                kind: 'custom', kindLabel: 'Custom model'
            }]);
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            const note = document.querySelector('.pdt-agent-config-warning');
            expect(note.textContent).toContain('saves over the live version');
        });

        it('should lazy-load AI Builder runs when the Runs tab is opened', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            expect(DataService.getAiBuilderRuns).not.toHaveBeenCalled(); // not loaded until the tab is opened
            const runsTab = [...document.querySelectorAll('.pdt-agent-def-tabs .pdt-sub-tab')]
                .find(b => b.dataset.tab === 'runs');
            runsTab.click();
            await flush();
            expect(DataService.getAiBuilderRuns).toHaveBeenCalledWith('m-1');
            expect(document.querySelector('.pdt-agent-runs-list .pdt-agent-run-row')).toBeTruthy();
            // Consumption summary card is rendered with the quick-test/automation split
            const summary = document.querySelector('.pdt-agent-runs-summary');
            expect(summary).toBeTruthy();
            expect(summary.textContent).toContain('gpt-4o'); // the LLM model used
            // Usage-trends section with the per-feature breakdown
            const trends = document.querySelector('.pdt-agent-runs-trends');
            expect(trends).toBeTruthy();
            expect(trends.textContent).toContain('Basic'); // the metered feature
        });

        it('should show a run\'s Run by and lazy-load its Input on expand', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            [...document.querySelectorAll('.pdt-agent-def-tabs .pdt-sub-tab')]
                .find(b => b.dataset.tab === 'runs').click();
            await flush();

            const row = document.querySelector('.pdt-agent-runs-list .pdt-agent-run-row');
            // Run by appears in the run's detail grid.
            expect(row.querySelector('.pdt-agent-run-body').textContent).toContain('Mohammed Khawatme');
            // Input isn't fetched until the run is expanded.
            expect(DataService.getAiBuilderRunInput).not.toHaveBeenCalled();

            row.open = true;
            row.dispatchEvent(new Event('toggle'));
            await flush();
            expect(DataService.getAiBuilderRunInput).toHaveBeenCalledWith('ev-1');
            // The input parses as a transcript, so it renders as a readable conversation with raw JSON below.
            const turns = row.querySelectorAll('.pdt-agent-run-input .pdt-eval-turn');
            expect(turns).toHaveLength(2);
            expect(turns[0].textContent).toContain('Where is my order?');
            expect(row.querySelector('.pdt-agent-run-input details.pdt-agent-raw-config')).toBeTruthy();
        });

        it('should show only the output (no Input section, no note) when a run has no input', async () => {
            DataService.getAiBuilderRunInput.mockResolvedValueOnce(null);
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            [...document.querySelectorAll('.pdt-agent-def-tabs .pdt-sub-tab')]
                .find(b => b.dataset.tab === 'runs').click();
            await flush();

            const row = document.querySelector('.pdt-agent-runs-list .pdt-agent-run-row');
            row.open = true;
            row.dispatchEvent(new Event('toggle'));
            await flush();
            // No input → the whole Input section is dropped (no note, no input slot), leaving the Output.
            expect(row.querySelector('.pdt-agent-run-input-section')).toBeNull();
            expect(row.querySelector('.pdt-agent-run-input')).toBeNull();
            expect(row.querySelector('.copyable-code-block pre').textContent).toBe('Hello');
        });

        it('should say a run recorded no output rather than dropping the Output section', async () => {
            // A run showing only its Input reads as a rendering failure; an empty output has to say so.
            DataService.getAiBuilderRuns.mockResolvedValueOnce([{
                id: 'ev-2', output: '', quickTest: true, dataType: 'Text',
                processingStatus: 'Succeeded', status: 'Active', processedOn: '5/31/2026', createdOn: '5/31/2026',
                llmModelName: '', units: null, consumption: null, consumptionSource: '', featureName: '', createdBy: ''
            }]);
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            [...document.querySelectorAll('.pdt-agent-def-tabs .pdt-sub-tab')]
                .find(b => b.dataset.tab === 'runs').click();
            await flush();

            const row = document.querySelector('.pdt-agent-runs-list .pdt-agent-run-row');
            expect(row.textContent).toContain('Output');
            expect(row.querySelector('.pdt-agent-run-no-output').textContent)
                .toBe('This run recorded no output.');
        });

        it('should not attach the Input section until the input resolves (no flash before load)', async () => {
            let resolveInput;
            DataService.getAiBuilderRunInput.mockReturnValueOnce(new Promise((res) => { resolveInput = res; }));
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            [...document.querySelectorAll('.pdt-agent-def-tabs .pdt-sub-tab')]
                .find(b => b.dataset.tab === 'runs').click();
            await flush();

            const row = document.querySelector('.pdt-agent-runs-list .pdt-agent-run-row');
            row.open = true;
            row.dispatchEvent(new Event('toggle'));
            await flush();
            // While the input is still loading, the Input section is absent — so it can't flash and vanish.
            expect(row.querySelector('.pdt-agent-run-input-section')).toBeNull();

            resolveInput(JSON.stringify({ activities: [{ type: 'message', from: { role: 1 }, text: 'Hi' }] }));
            await flush();
            // Once it resolves with input, the section appears (after the meta grid, before the Output).
            expect(row.querySelector('.pdt-agent-run-input-section')).toBeTruthy();
            expect(row.querySelector('.pdt-agent-run-input .pdt-eval-turn')).toBeTruthy();
        });

        const openEvaluationsTab = async (ctx) => {
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="view-model"]').click();
            await flush();
            [...document.querySelectorAll('.pdt-agent-def-tabs .pdt-sub-tab')]
                .find(b => b.dataset.tab === 'evaluations').click();
            await flush();
        };

        it('should render the Test hub view (latest-run summary + rows) when the Evaluations tab is opened', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            expect(DataService.getPromptEvaluations).toHaveBeenCalledWith('m-1');
            // The newest batch's runs are eager-loaded to build the latest-run hero.
            expect(DataService.getTestBatchRuns).toHaveBeenCalledWith('b-1');
            const summary = document.querySelector('.pdt-eval-summary');
            expect(summary).toBeTruthy();
            expect(summary.textContent).toContain('gpt-41-mini-2025-04-14');
            // Both the test-cases and run-history sections render expandable rows.
            expect(document.querySelectorAll('.pdt-agent-eval-row').length).toBeGreaterThan(1);
        });

        it('should lazy-load a test case inputs on expand', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            const testCaseRow = document.querySelector('.pdt-agent-eval-row');
            testCaseRow.open = true;
            testCaseRow.dispatchEvent(new Event('toggle'));
            await flush();
            expect(DataService.getTestCaseInputs).toHaveBeenCalledWith('tc-1');
        });

        it('should not render a note when a test case has no input variables', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            const testCaseRow = document.querySelector('.pdt-agent-eval-row');
            testCaseRow.open = true;
            testCaseRow.dispatchEvent(new Event('toggle'));
            await flush();
            const slot = testCaseRow.querySelector('.pdt-eval-inputs-slot');
            // Empty inputs render nothing — no "no input variables" note, no input list.
            expect(slot.querySelector('.pdt-note')).toBeNull();
            expect(slot.querySelector('.pdt-eval-input-list')).toBeNull();
            expect(slot.textContent.trim()).toBe('');
        });

        it('should edit and save a test case expected output', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            const testCaseRow = document.querySelector('.pdt-agent-eval-row');
            const textarea = testCaseRow.querySelector('.pdt-agent-edit-textarea');
            expect(textarea).toBeTruthy();
            expect(textarea.value).toBe('Hello');
            // Prose wraps rather than scrolling horizontally, so long expected outputs stay readable.
            expect(textarea.classList.contains('pdt-agent-edit-textarea--wrap')).toBe(true);

            textarea.value = 'Hello world';
            textarea.dispatchEvent(new Event('input'));
            const saveBtn = [...testCaseRow.querySelectorAll('button')].find(b => b.textContent === 'Save');
            saveBtn.click();
            await flush();

            expect(DataService.updateTestCaseExpectedOutput).toHaveBeenCalledWith('tc-1', 'Hello world');
            // The summary preview stays in sync with the saved value.
            expect(testCaseRow.querySelector('.pdt-eval-expected-preview').textContent).toContain('Hello world');
        });

        it('should render per-case results (score + expected vs actual) when a batch is expanded', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            const batchRow = [...document.querySelectorAll('.pdt-agent-eval-row')]
                .find(r => r.querySelector('.pdt-eval-batch-name'));
            batchRow.open = true;
            batchRow.dispatchEvent(new Event('toggle'));
            await flush();
            const item = batchRow.querySelector('.pdt-eval-run-item');
            expect(item).toBeTruthy();
            expect(item.querySelector('.pdt-eval-score').textContent).toBe('43');
            expect(item.textContent).toContain('Hello, how can I help?');
        });

        it('should summarize a batch inline (cases · coloured avg · pass/fail · duration) and drop the in-body summary bar', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);

            const batchRow = [...document.querySelectorAll('.pdt-agent-eval-row')]
                .find(r => r.querySelector('.pdt-eval-batch-name'));
            const inline = batchRow.querySelector('.pdt-eval-batch-inline');
            expect(inline).toBeTruthy();
            // Average is a coloured score chip (43 < passing 60 → low/red), not plain text.
            const chip = inline.querySelector('.pdt-eval-score');
            expect(chip.textContent).toBe('43');
            expect(chip.classList.contains('pdt-eval-score-low')).toBe(true);
            // Cases, pass/fail and the newly added duration (5s → 0:05) all read inline.
            expect(inline.textContent).toContain('1 case');
            expect(inline.textContent).toContain('0/1 passed');
            expect(inline.textContent).toContain('0:05');

            // Expanding shows only the run cards — the old in-body summary bar is gone.
            batchRow.open = true;
            batchRow.dispatchEvent(new Event('toggle'));
            await flush();
            expect(batchRow.querySelector('.pdt-eval-run-item')).toBeTruthy();
            expect(batchRow.querySelector('.pdt-eval-batch-summary')).toBeNull();
        });

        it('should fall back to the test case name when the run lookup name is blank', async () => {
            // A run's own name is blank; the lookup formatted value may be absent, so the loaded
            // test cases (tc-1 → "Case A") must still name the row.
            // Only the hero triggers a run fetch here (the expand hits the cache), so a single Once is
            // consumed within the test and cannot leak into later tests (beforeEach only clears calls).
            DataService.getTestBatchRuns.mockResolvedValueOnce([{
                id: 'r-1', testCaseId: 'tc-1', testCaseName: '', configId: 'cfg-1',
                expectedOutput: 'Hello', actualOutput: 'Hi', accuracyScore: 80, tokens: null,
                modelName: '', modelType: '', statusLabel: '', state: 'completed',
                startedOnRaw: '', completedOnRaw: '', errorMessage: '', comment: ''
            }]);
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            const batchRow = [...document.querySelectorAll('.pdt-agent-eval-row')]
                .find(r => r.querySelector('.pdt-eval-batch-name'));
            batchRow.open = true;
            batchRow.dispatchEvent(new Event('toggle'));
            await flush();
            expect(batchRow.querySelector('.pdt-eval-run-name').textContent).toBe('Case A');
        });

        it('should show an empty state when a model has no tests', async () => {
            DataService.getPromptEvaluations.mockResolvedValueOnce({ testCases: [], batches: [], criteria: null });
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            expect(document.querySelector('.pdt-eval-summary')).toBeNull();
            expect(document.querySelector('.pdt-agent-def-panel .pdt-note')).toBeTruthy();
        });

        it('should mark a run Pass/Fail against the criteria passing score', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            const batchRow = [...document.querySelectorAll('.pdt-agent-eval-row')]
                .find(r => r.querySelector('.pdt-eval-batch-name'));
            batchRow.open = true;
            batchRow.dispatchEvent(new Event('toggle'));
            await flush();
            // Score 43 < passing 60 → Fail.
            const item = batchRow.querySelector('.pdt-eval-run-item');
            expect(item.querySelector('.pdt-eval-badge-fail')).toBeTruthy();
            expect(item.querySelector('.pdt-eval-badge-pass')).toBeNull();
        });

        it('should render the evaluation-criteria bar and save edits via updateEvaluationCriteria', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            const bar = document.querySelector('.pdt-eval-criteria-bar');
            expect(bar).toBeTruthy();
            expect(bar.textContent).toContain('60%');
            bar.querySelector('.modern-button').click();
            await flush();
            // The editor dialog is open; confirm with OK fires the save.
            document.querySelector('.pdt-dialog-ok').click();
            await flush();
            expect(DataService.updateEvaluationCriteria).toHaveBeenCalledWith('crit-1', expect.any(String), expect.objectContaining({
                passingScore: expect.any(Number)
            }));
        });

        it('should delete all test cases from the toolbar when none are selected', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            const runBtn = document.querySelector('.pdt-eval-run');
            const deleteBtn = document.querySelector('.pdt-eval-delete');
            expect(deleteBtn.textContent).toBe('Delete all');
            vi.spyOn(tab, '_handleViewModel').mockImplementation(() => {});
            deleteBtn.click();
            // The toolbar locks as soon as delete is triggered (before the confirm resolves).
            expect(deleteBtn.disabled).toBe(true);
            expect(runBtn.disabled).toBe(true);
            await flush();
            expect(showConfirmDialog).toHaveBeenCalled();
            expect(DataService.deleteTestCase).toHaveBeenCalledWith('tc-1');
        });

        it('should delete only the selected test case', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            const checkbox = document.querySelector('.pdt-eval-tc-row .pdt-eval-select');
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
            const deleteBtn = document.querySelector('.pdt-eval-delete');
            expect(deleteBtn.textContent).toBe('Delete selected (1)');
            deleteBtn.click();
            await flush();
            expect(DataService.deleteTestCase).toHaveBeenCalledWith('tc-1');
        });

        it('should run all test cases directly from the toolbar (with the live config + criteria)', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            const runBtn = document.querySelector('.pdt-eval-run');
            const deleteBtn = document.querySelector('.pdt-eval-delete');
            expect(runBtn.disabled).toBe(false);
            expect(runBtn.textContent).toBe('Run all');
            const reopen = vi.spyOn(tab, '_handleViewModel').mockImplementation(() => {});
            runBtn.click();
            await flush();
            // Runs directly, like the prompt Quick test — no confirm dialog, no toast.
            expect(showConfirmDialog).not.toHaveBeenCalled();
            expect(NotificationService.show).not.toHaveBeenCalledWith(expect.stringContaining('Running'), 'info');
            // Feedback is inline: the toolbar buttons lock and a running note shows in place.
            expect(runBtn.disabled).toBe(true);
            expect(deleteBtn.disabled).toBe(true);
            expect(document.querySelector('.pdt-eval-run-status .pdt-prompt-test-running')).toBeTruthy();
            expect(DataService.runPromptTests).toHaveBeenCalledWith(expect.objectContaining({
                activeConfigId: 'cfg-1',
                promptConfigJson: expect.any(String),
                criteria: expect.objectContaining({ id: 'crit-1' }),
                testCases: [expect.objectContaining({ id: 'tc-1', expectedOutput: 'Hello' })]
            }));
            // The Evaluations view refreshes afterward so the new batch's results appear.
            expect(reopen).toHaveBeenCalledWith('m-1', 'evaluations');
        });

        it('should disable Run when the prompt has no published configuration', async () => {
            DataService.getAiModels.mockResolvedValueOnce([{ ...mockModels[0], activeConfigId: '' }]);
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            expect(document.querySelector('.pdt-eval-run').disabled).toBe(true);
        });

        // Opening the criteria editor / a confirm dialog closes the prompt dialog (one modal at a time),
        // so every exit — including cancel — must reopen it, or the user is left staring at the page.
        it('should reopen the prompt dialog when the evaluation-criteria editor is cancelled', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            document.querySelector('.pdt-eval-criteria-bar .modern-button').click();
            await flush();
            const reopen = vi.spyOn(tab, '_handleViewModel').mockImplementation(() => {});
            document.querySelector('.pdt-dialog-cancel').click();
            await flush();
            expect(DataService.updateEvaluationCriteria).not.toHaveBeenCalled();
            expect(reopen).toHaveBeenCalledWith('m-1', 'evaluations');
        });

        it('should reopen the prompt dialog when a test-case delete is cancelled', async () => {
            showConfirmDialog.mockResolvedValueOnce(false);
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            const reopen = vi.spyOn(tab, '_handleViewModel').mockImplementation(() => {});
            document.querySelector('.pdt-eval-delete').click();
            await flush();
            expect(DataService.deleteTestCase).not.toHaveBeenCalled();
            expect(reopen).toHaveBeenCalledWith('m-1', 'evaluations');
        });

        it('should not offer Run for a non-prompt model (but still allows delete)', async () => {
            DataService.getAiModels.mockResolvedValueOnce([{ ...mockModels[0], kind: 'custom', kindLabel: 'Custom model' }]);
            const ctx = await renderTab();
            tab = ctx.tab;
            await openEvaluationsTab(ctx);
            expect(document.querySelector('.pdt-eval-run')).toBeNull();
            expect(document.querySelector('.pdt-eval-delete')).toBeTruthy();
        });
    });

    describe('solution filter', () => {
        it('should populate the dropdown from real solutioncomponent membership', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await flush();
            const select = ctx.el.querySelector('.pdt-agents-solution[data-scope="agents"]');
            // Membership comes from solutioncomponent, not the record's own (Active-layer) solutionid.
            expect(DataService.getSolutionMemberships).toHaveBeenCalled();
            // 2 solutions across the agents' membership + the "All" option
            expect(select.querySelectorAll('option')).toHaveLength(3);
        });

        it('should label solutions as "Display Name (uniquename)" like the other tabs', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await flush();
            const select = ctx.el.querySelector('.pdt-agents-solution[data-scope="agents"]');
            const option = [...select.options].find(o => o.value === 'sol-1');
            expect(option.textContent).toBe('Solution One (solutionone)');
        });

        it('should filter agent cards by selected solution (membership-based)', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await flush();
            const select = ctx.el.querySelector('.pdt-agents-solution[data-scope="agents"]');
            select.value = 'sol-2';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            const cards = ctx.el.querySelectorAll('.pdt-agent-card');
            expect(cards[0].style.display).toBe('none'); // bot-1 (member of sol-1) hidden
            expect(cards[1].style.display).toBe(''); // bot-2 (member of sol-2) visible
        });

        it('should hide a non-visible (Active) solution from the dropdown', async () => {
            // The agent is a member of an invisible solution; getAgentSolutionNames resolves only
            // visible solutions, so it returns nothing for it → it must not appear as an option.
            DataService.getAgents.mockResolvedValueOnce([{ ...mockAgents[0] }]);
            DataService.getSolutionMemberships.mockResolvedValueOnce({ 'bot-1': ['sol-active'] });
            DataService.getAgentSolutionNames.mockResolvedValueOnce({});

            const ctx = await renderTab();
            tab = ctx.tab;
            await flush();
            await flush();

            expect(DataService.getAgentSolutionNames).toHaveBeenCalledWith(['sol-active']);
            const select = ctx.el.querySelector('.pdt-agents-solution[data-scope="agents"]');
            expect([...select.options].find(o => o.value === 'sol-active')).toBeUndefined();
            // Only the "All" option remains.
            expect(select.querySelectorAll('option')).toHaveLength(1);
        });
    });

    describe('editing & publishing', () => {
        const footerButton = (label) => [...document.querySelectorAll('.pdt-agent-footer-actions button')]
            .find(b => b.textContent === label);

        it('should save edited instructions via the footer Save button', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            const textarea = document.querySelector('.pdt-agent-edit-textarea');
            expect(textarea).toBeTruthy();
            // Footer editor lives beside the Close button (no inline buttons in the agent dialog)
            const saveBtn = footerButton('Save');
            expect(saveBtn).toBeTruthy();
            expect(saveBtn.disabled).toBe(true); // disabled until there are changes

            textarea.value = 'Updated instructions';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            expect(saveBtn.disabled).toBe(false); // becomes enabled (blue) when dirty
            saveBtn.click();
            await flush();
            expect(DataService.updateAgentComponent).toHaveBeenCalledWith('c-1', 'data', 'Updated instructions');
        });

        it('should deactivate the footer actions immediately on Save, before the write resolves', async () => {
            // Hold the write open so the in-flight state is observable.
            let resolveSave;
            DataService.updateAgentComponent.mockReturnValueOnce(new Promise(r => {
                resolveSave = r;
            }));
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            const textarea = document.querySelector('.pdt-agent-edit-textarea');
            const saveBtn = footerButton('Save');
            const savePublish = footerButton('Save & Publish');
            const undoBtn = footerButton('Undo');

            textarea.value = 'Updated instructions';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            expect(saveBtn.disabled).toBe(false);

            saveBtn.click();
            // Synchronously after the click: the click is acknowledged even though the write is
            // still pending and Undo is still on screen (it used to stay active until Undo hid).
            expect(saveBtn.disabled).toBe(true);
            expect(savePublish.disabled).toBe(true);
            expect(undoBtn.disabled).toBe(true);
            expect(undoBtn.style.display).toBe('');

            resolveSave({});
            await flush();
            // Saved: no longer dirty, so Save stays inactive and Undo hides — but both controls are
            // unlocked again rather than left stuck disabled.
            expect(saveBtn.disabled).toBe(true);
            expect(undoBtn.style.display).toBe('none');
            expect(undoBtn.disabled).toBe(false);
            expect(savePublish.disabled).toBe(false);
        });

        it('should re-enable Save when the write fails so the edit can be retried', async () => {
            DataService.updateAgentComponent.mockRejectedValueOnce(new Error('boom'));
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            const textarea = document.querySelector('.pdt-agent-edit-textarea');
            const saveBtn = footerButton('Save');
            textarea.value = 'Updated instructions';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            saveBtn.click();
            expect(saveBtn.disabled).toBe(true);

            await flush();
            // Still dirty after the failure, so the button returns to its active state.
            expect(saveBtn.disabled).toBe(false);
            expect(footerButton('Undo').style.display).toBe('');
        });

        it('should deactivate the footer actions immediately on Save & Publish, before it resolves', async () => {
            let resolvePublish;
            DataService.publishAgent.mockReturnValueOnce(new Promise(r => {
                resolvePublish = r;
            }));
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            const savePublish = footerButton('Save & Publish');
            savePublish.click();
            await flush(); // the confirmation is awaited before the lock is applied

            expect(savePublish.disabled).toBe(true);
            expect(footerButton('Undo').disabled).toBe(true);

            resolvePublish({});
            await flush();
            expect(savePublish.disabled).toBe(false);
        });

        it('should announce that publishing started, before the publish resolves', async () => {
            let resolvePublish;
            DataService.publishAgent.mockReturnValueOnce(new Promise(r => {
                resolvePublish = r;
            }));
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            footerButton('Save & Publish').click();
            await flush(); // confirmation resolves; the publish is now in flight

            expect(NotificationService.show).toHaveBeenCalledWith(
                Config.MESSAGES.AGENTS.publishing, 'info'
            );
            // The outcome is not claimed yet — only that the work started.
            expect(NotificationService.show).not.toHaveBeenCalledWith(
                Config.MESSAGES.AGENTS.published, 'success'
            );

            resolvePublish({});
            await flush();
            expect(NotificationService.show).toHaveBeenCalledWith(
                Config.MESSAGES.AGENTS.published, 'success'
            );
        });

        it('should not announce publishing when the confirmation is cancelled', async () => {
            showConfirmDialog.mockResolvedValueOnce(false);
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            footerButton('Save & Publish').click();
            await flush();

            expect(NotificationService.show).not.toHaveBeenCalledWith(
                Config.MESSAGES.AGENTS.publishing, 'info'
            );
            expect(DataService.publishAgent).not.toHaveBeenCalled();
        });

        it('should let modern-agent instructions be edited in place and saved back into the configuration', async () => {
            // No Custom GPT (type 15) component — a modern agent keeps instructions in configuration.
            DataService.getAgentComponents.mockResolvedValueOnce([
                { id: 'c-2', name: 'Greeting', schemaName: 'cr_bot645.topic.Greeting', componentType: 9, componentTypeLabel: 'Topic (V2)', description: '', content: '', data: '', isManaged: false, statecode: 0 }
            ]);
            DataService.getAgentConfiguration.mockResolvedValueOnce(JSON.stringify({
                agentSettings: {
                    model: { series: 'GPT5Chat' },
                    instructions: { segments: [{ $kind: 'StaticSegment', value: '```\nYou are the HR Assistant.\n```' }] }
                }
            }));
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            const overview = document.querySelector('.pdt-agent-def-panel');
            // Editable: an editable textarea (not a read-only code block), with the storage note + model.
            expect(document.querySelector('.pdt-agent-instructions-source').textContent).toContain('agent configuration');
            const textarea = overview.querySelector('.pdt-agent-edit-textarea');
            expect(textarea).toBeTruthy();
            expect(textarea.value).toContain('You are the HR Assistant.');
            expect(overview.querySelector('.pdt-agent-model').textContent).toContain('GPT5Chat');

            // Saving through the footer splices the edit back into agentSettings.instructions (fence and
            // other config fields preserved) and PATCHes the whole configuration.
            textarea.value = 'You are the HR Assistant. Be concise.';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            footerButton('Save').click();
            await flush();
            expect(DataService.updateAgentConfiguration).toHaveBeenCalledWith('bot-1', expect.any(String));
            const saved = JSON.parse(DataService.updateAgentConfiguration.mock.calls[0][1]);
            expect(saved.agentSettings.instructions.segments).toEqual([
                { $kind: 'StaticSegment', value: '```\nYou are the HR Assistant. Be concise.\n```' }
            ]);
            expect(saved.agentSettings.model.series).toBe('GPT5Chat');
        });

        it('should keep the modern instructions and the Configuration JSON in sync both ways', async () => {
            DataService.getAgentComponents.mockResolvedValueOnce([
                { id: 'c-2', name: 'Greeting', schemaName: 'cr_bot645.topic.Greeting', componentType: 9, componentTypeLabel: 'Topic (V2)', description: '', content: '', data: '', isManaged: false, statecode: 0 }
            ]);
            DataService.getAgentConfiguration.mockResolvedValueOnce(JSON.stringify({
                agentSettings: {
                    model: { series: 'GPT5Chat' },
                    instructions: { segments: [{ $kind: 'StaticSegment', value: '```\nYou are the HR Assistant.\n```' }] }
                }
            }));
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            const instrTa = document.querySelector('.pdt-agent-instructions-sync');
            const configTa = [...document.querySelectorAll('.pdt-agent-edit-textarea')].find(t => t !== instrTa);
            expect(instrTa).toBeTruthy();
            expect(configTa).toBeTruthy();

            // Editing the instructions updates the Configuration JSON live (the source of truth),
            // leaving every other config field intact.
            instrTa.value = 'Be brief and cite policy.';
            instrTa.dispatchEvent(new Event('input', { bubbles: true }));
            const afterInstrEdit = JSON.parse(configTa.value);
            expect(afterInstrEdit.agentSettings.instructions.segments[0].value).toBe('```\nBe brief and cite policy.\n```');
            expect(afterInstrEdit.agentSettings.model.series).toBe('GPT5Chat');

            // Editing the raw Configuration JSON re-derives the friendly instructions.
            const cfg = JSON.parse(configTa.value);
            cfg.agentSettings.instructions.segments = [{ $kind: 'StaticSegment', value: '```\nFrom the JSON side.\n```' }];
            configTa.value = JSON.stringify(cfg, null, 2);
            configTa.dispatchEvent(new Event('input', { bubbles: true }));
            expect(instrTa.value).toBe('From the JSON side.');
        });

        it('should not eat a trailing newline typed into the modern instructions box', async () => {
            // Regression: the config->instructions echo re-derives through extractAgentInstructions, whose
            // trim() would strip a trailing newline/space the moment it is typed (caret jump, lost Enter).
            DataService.getAgentComponents.mockResolvedValueOnce([
                { id: 'c-2', name: 'Greeting', schemaName: 'cr_bot645.topic.Greeting', componentType: 9, componentTypeLabel: 'Topic (V2)', description: '', content: '', data: '', isManaged: false, statecode: 0 }
            ]);
            DataService.getAgentConfiguration.mockResolvedValueOnce(JSON.stringify({
                agentSettings: {
                    instructions: { segments: [{ $kind: 'StaticSegment', value: '```\nYou are the HR Assistant.\n```' }] }
                }
            }));
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            const instrTa = document.querySelector('.pdt-agent-instructions-sync');
            instrTa.value = 'First line\n';
            instrTa.dispatchEvent(new Event('input', { bubbles: true }));
            // The keystroke survives — the instructions box keeps exactly what was typed.
            expect(instrTa.value).toBe('First line\n');
        });

        it('should keep modern instructions read-only when they embed a reference segment', async () => {
            DataService.getAgentComponents.mockResolvedValueOnce([
                { id: 'c-2', name: 'Greeting', schemaName: 'cr_bot645.topic.Greeting', componentType: 9, componentTypeLabel: 'Topic (V2)', description: '', content: '', data: '', isManaged: false, statecode: 0 }
            ]);
            DataService.getAgentConfiguration.mockResolvedValueOnce(JSON.stringify({
                agentSettings: {
                    instructions: { segments: [
                        { $kind: 'StaticSegment', value: 'Greet the user by name: ' },
                        { $kind: 'VariableSegment' }
                    ] }
                }
            }));
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            const overview = document.querySelector('.pdt-agent-def-panel');
            // A reference segment can't round-trip through plain text — stays read-only, pointing to Config.
            expect(overview.querySelector('.pdt-agent-edit-textarea')).toBeNull();
            expect(overview.querySelector('.copyable-code-block')).toBeTruthy();
            expect(document.querySelector('.pdt-agent-instructions-source').textContent).toContain('Configuration tab');
        });

        it('should Save & Publish an unmanaged agent after confirmation', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            const savePublish = footerButton('Save & Publish');
            expect(savePublish).toBeTruthy();
            savePublish.click();
            await flush();
            expect(showConfirmDialog).toHaveBeenCalled();
            expect(DataService.publishAgent).toHaveBeenCalledWith('bot-1');
        });

        it('should report success only once publishedon has moved', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            footerButton('Save & Publish').click();
            await flush();

            expect(NotificationService.show).toHaveBeenCalledWith(
                Config.MESSAGES.AGENTS.published, 'success'
            );
        });

        it('should report success on the empty body PvaPublish returns even when it succeeds', async () => {
            // Verified against a live org: a successful publish returns the same empty result as a
            // no-op, so the response must not gate the outcome — only publishedon may.
            DataService.publishAgent.mockResolvedValueOnce({
                PublishedBotContentId: '', PublishBotJobResponse: null
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            footerButton('Save & Publish').click();
            await flush();

            expect(NotificationService.show).toHaveBeenCalledWith(
                Config.MESSAGES.AGENTS.published, 'success'
            );
        });

        it('should report an unconfirmed publish when publishedon does not move', async () => {
            DataService.getAgentPublishState.mockResolvedValue({
                publishedOnRaw: '2026-06-02T09:44:00Z', publishedOn: '6/2/2026 9:44 AM'
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            // Single attempt with no delay, so the timeout path is exercised without real waiting.
            const landed = await tab._waitForPublish('bot-1', '2026-06-02T09:44:00Z', {
                attempts: 1, intervalMs: 0
            });
            expect(landed).toBe(false);
        });

        it('should surface the unconfirmed notice rather than a failure when publishedon stalls', async () => {
            // Narrow the poll budget so the stalled path resolves without a real 30s wait.
            const budget = Config.AGENT_PUBLISH;
            const restore = { ...budget };
            Object.assign(budget, { maxPollingAttempts: 1, pollingInterval: 0 });
            DataService.getAgentPublishState.mockResolvedValue({
                publishedOnRaw: '2026-06-02T09:44:00Z', publishedOn: '6/2/2026 9:44 AM'
            });
            try {
                const ctx = await renderTab();
                tab = ctx.tab;
                ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
                await flush();
                footerButton('Save & Publish').click();
                await flush();

                expect(NotificationService.show).toHaveBeenCalledWith(
                    Config.MESSAGES.AGENTS.publishUnconfirmed, 'info'
                );
                expect(NotificationService.show).not.toHaveBeenCalledWith(
                    expect.stringContaining('Failed to publish'), 'error'
                );
            } finally {
                Object.assign(budget, restore);
            }
        });

        it('should announce a publish that lands after the foreground wait', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const onStateChanged = vi.fn();
            DataService.getAgentPublishState.mockResolvedValue({
                publishedOnRaw: '2026-07-22T19:14:16Z', publishedOn: '7/22/2026 7:14 PM'
            });

            await tab._watchPublishInBackground({ id: 'bot-1', name: 'HR Agent' }, '', onStateChanged);

            expect(NotificationService.show).toHaveBeenCalledWith(
                Config.MESSAGES.AGENTS.published, 'success'
            );
            expect(onStateChanged).toHaveBeenCalled();
        });

        it('should stop a background publish watch that was running when the tab was destroyed', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const onStateChanged = vi.fn();
            const watch = tab._watchPublishInBackground({ id: 'bot-1', name: 'HR Agent' }, '', onStateChanged);
            tab.destroy();
            await watch;

            expect(onStateChanged).not.toHaveBeenCalled();
            expect(NotificationService.show).not.toHaveBeenCalledWith(
                Config.MESSAGES.AGENTS.published, 'success'
            );
        });

        it('should still confirm publishes after a Refresh destroys and re-renders the tab', async () => {
            // Refresh calls destroy() on this same instance and re-renders it, so an abort flag that
            // was never reset would silently stop every later publish from ever being confirmed.
            const ctx = await renderTab();
            tab = ctx.tab;
            tab.destroy();

            const landed = await tab._waitForPublish('bot-1', '2026-01-05T16:00:00Z', {
                attempts: 1, intervalMs: 0
            });
            expect(landed).toBe(true);
        });

        it('should not read an existing timestamp as a fresh publish when the baseline read fails', async () => {
            // The pre-publish read is what the poll compares against; losing it must not make an
            // already-published agent report success the instant polling starts.
            const budget = Config.AGENT_PUBLISH;
            const restore = { ...budget };
            Object.assign(budget, { maxPollingAttempts: 1, pollingInterval: 0, backgroundPollingAttempts: 1 });
            DataService.getAgentPublishState
                .mockRejectedValueOnce(new Error('network'))
                .mockResolvedValue({ publishedOnRaw: '2026-01-05T16:00:00Z', publishedOn: '1/5/2026' });
            try {
                const ctx = await renderTab();
                tab = ctx.tab;
                ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
                await flush();
                footerButton('Save & Publish').click();
                await flush();

                // bot-1's publishedOnRaw is 2026-01-05T16:00:00Z — unchanged, so not a publish.
                expect(NotificationService.show).not.toHaveBeenCalledWith(
                    Config.MESSAGES.AGENTS.published, 'success'
                );
                expect(NotificationService.show).toHaveBeenCalledWith(
                    Config.MESSAGES.AGENTS.publishUnconfirmed, 'info'
                );
            } finally {
                Object.assign(budget, restore);
            }
        });

        it('should keep polling through a transient read failure', async () => {
            DataService.getAgentPublishState
                .mockRejectedValueOnce(new Error('network'))
                .mockResolvedValueOnce({ publishedOnRaw: '2026-07-22T10:00:00Z', publishedOn: '7/22/2026' });
            const ctx = await renderTab();
            tab = ctx.tab;
            const landed = await tab._waitForPublish('bot-1', '2026-06-02T09:44:00Z', {
                attempts: 3, intervalMs: 0
            });
            expect(landed).toBe(true);
        });

        it('should re-read agent state on save even from another sub-tab', async () => {
            // The flow that used to show a stale "no unpublished changes": save from Overview, then
            // open Activity. State is now re-read on save regardless of which sub-tab is showing.
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            DataService.getAgentComponents.mockClear();

            const textarea = document.querySelector('.pdt-agent-edit-textarea');
            textarea.value = 'changed instructions';
            textarea.dispatchEvent(new Event('input'));
            footerButton('Save').click();
            await flush();

            expect(DataService.getAgentComponents).toHaveBeenCalledWith('bot-1');
            expect(DataService.getAgentPublishState).toHaveBeenCalledWith('bot-1');

            document.querySelector('.pdt-agent-def-tabs [data-tab="activity"]').click();
            await flush();
            expect(document.querySelector('.pdt-agent-publish-status')).toBeTruthy();
        });

        it('should refresh the Activity panel in place when it is already open', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            document.querySelector('.pdt-agent-def-tabs [data-tab="activity"]').click();
            await flush();
            DataService.getAgentComponents.mockClear();

            const textarea = document.querySelector('.pdt-agent-edit-textarea');
            textarea.value = 'changed instructions';
            textarea.dispatchEvent(new Event('input'));
            footerButton('Save').click();
            await flush();

            expect(DataService.getAgentComponents).toHaveBeenCalledWith('bot-1');
        });

        it('should flip the card badge from Draft to Published without opening Activity', async () => {
            // Must start from Draft — an already-published agent makes this assertion vacuous. And
            // the badge has to sync from the default (Overview) sub-tab: it is agent-level state, so
            // it cannot depend on the Activity panel being on screen.
            DataService.getAgents.mockResolvedValueOnce([
                { ...mockAgents[0], publishedOn: '', publishedOnRaw: '' }
            ]);
            const ctx = await renderTab();
            tab = ctx.tab;
            const badge = ctx.el.querySelector('.pdt-agent-card .pdt-agent-publish-badge');
            expect(badge.textContent).toBe(Config.MESSAGES.AGENTS.publishStateDraft);

            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            footerButton('Save & Publish').click();
            await flush();

            expect(badge.textContent).toBe(Config.MESSAGES.AGENTS.publishStatePublished);
            expect(badge.className).toContain('published');
        });

        it('should refresh the card badge for a publish confirmed in the background', async () => {
            DataService.getAgents.mockResolvedValueOnce([
                { ...mockAgents[0], publishedOn: '', publishedOnRaw: '' }
            ]);
            const budget = Config.AGENT_PUBLISH;
            const restore = { ...budget };
            // Force the foreground wait to give up, so the background watch is what confirms it.
            Object.assign(budget, { maxPollingAttempts: 1, pollingInterval: 0, backgroundPollingAttempts: 1 });
            DataService.getAgentPublishState
                .mockResolvedValueOnce({ publishedOnRaw: '', publishedOn: '' })
                .mockResolvedValueOnce({ publishedOnRaw: '', publishedOn: '' })
                .mockResolvedValue({ publishedOnRaw: '2026-07-22T19:14:16Z', publishedOn: '7/22/2026 7:14 PM' });
            try {
                const ctx = await renderTab();
                tab = ctx.tab;
                const badge = ctx.el.querySelector('.pdt-agent-card .pdt-agent-publish-badge');
                ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
                await flush();
                footerButton('Save & Publish').click();
                await flush();

                expect(NotificationService.show).toHaveBeenCalledWith(
                    Config.MESSAGES.AGENTS.publishUnconfirmed, 'info'
                );
                expect(badge.textContent).toBe(Config.MESSAGES.AGENTS.publishStatePublished);
            } finally {
                Object.assign(budget, restore);
            }
        });

        it('should not show footer editor actions for managed agents', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            // Open definition for bot-2 (managed) — the second card
            ctx.el.querySelectorAll('.pdt-agent-card')[1].querySelector('[data-action="view-def"]').click();
            await flush();
            expect(document.querySelector('.pdt-agent-footer-actions')).toBeNull();
        });

        it('should activate/deactivate a component via its toggle', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            const toggle = document.querySelector('.pdt-agent-component-toggle');
            expect(toggle).toBeTruthy();
            expect(toggle.textContent).toBe('Deactivate'); // component is Active (statecode 0)
            toggle.click();
            await flush();
            expect(DataService.setAgentComponentState).toHaveBeenCalled();
        });

        it('should pretty-print minified JSON in an editable component payload', async () => {
            DataService.getAgentComponents.mockResolvedValueOnce([
                {
                    id: 'c-json', name: 'JSON Topic', schemaName: 'cr_bot645.topic.Json', componentType: 9,
                    componentTypeLabel: 'Topic (V2)', description: '', content: '',
                    data: '{"kind":"Topic","steps":[{"id":"a"},{"id":"b"}]}',
                    isManaged: false, statecode: 0
                }
            ]);
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            const textarea = document.querySelector('.pdt-agent-edit-textarea');
            expect(textarea).toBeTruthy();
            expect(textarea.value).toContain('\n');            // not one minified line
            expect(textarea.value).toContain('  "kind": "Topic"'); // indented
        });

        it('should group test components under a Tests & evaluations section', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            const headings = [...document.querySelectorAll('.pdt-agent-def-heading')].map(h => h.textContent);
            expect(headings.some(h => h.startsWith('Tests & evaluations'))).toBe(true);
        });

        it('should surface the evaluation test-set graders and pass/fail labels', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            const summary = document.querySelector('.pdt-eval-summary');
            expect(summary).toBeTruthy();
            expect(summary.textContent).toContain('Power-Toolkit Test set');
            expect(summary.textContent).toContain('what is the last created invoice');

            const labelRows = summary.querySelectorAll('.pdt-eval-labels tbody tr');
            expect(labelRows.length).toBe(2);
            const badges = summary.querySelectorAll('.pdt-eval-labels .pdt-status-badge');
            expect([...badges].map(b => b.textContent)).toEqual(['Pass', 'Fail']);
            expect(badges[0].classList.contains('active')).toBe(true);   // Pass = green
            expect(badges[1].classList.contains('inactive')).toBe(true); // Fail = red
        });

        it('should explain a label-less grader (GeneralQualityGrader) instead of rendering blank', async () => {
            DataService.getAgentComponents.mockResolvedValueOnce([
                { id: 'c-set', name: 'Power-Toolkit Test set', schemaName: 'mspva_set', componentType: 19, componentTypeLabel: 'Test Case', description: '', content: '',
                    data: 'kind: EvaluationSet\r\ngraders:\r\n  - kind: GeneralQualityGrader', isManaged: false, statecode: 0 }
            ]);
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            const summary = document.querySelector('.pdt-eval-summary');
            expect(summary).toBeTruthy();
            expect(summary.textContent).toContain('General quality grader'); // friendly kind label
            expect(summary.querySelector('.pdt-eval-labels')).toBeNull();     // no pass/fail table
            expect(summary.querySelector('.pdt-eval-nolabels')).toBeTruthy(); // self-explaining note
        });

        it('should render a MultiTurnEvaluationCase as an expected conversation', async () => {
            DataService.getAgentComponents.mockResolvedValueOnce([
                { id: 'c-case', name: 'Who do I contact for payroll issues?', schemaName: 'mspva_case1', componentType: 19, componentTypeLabel: 'Test Case', description: '', content: '',
                    data: 'kind: MultiTurnEvaluationCase\r\nactivities:\r\n  - activity:\r\n      value:\r\n        from:\r\n          role: user\r\n      text:\r\n        - Who do I contact for payroll issues?\r\n  - activity:\r\n      value:\r\n        from:\r\n          role: agent\r\n      text:\r\n        - Payroll issues are handled by our HR Assistant.', isManaged: false, statecode: 0 }
            ]);
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            const turns = document.querySelectorAll('.pdt-eval-turn');
            expect(turns.length).toBe(2);
            expect(turns[0].classList.contains('pdt-eval-turn--user')).toBe(true);
            expect(turns[0].textContent).toContain('Who do I contact for payroll issues?');
            expect(turns[1].classList.contains('pdt-eval-turn--agent')).toBe(true);
            expect(turns[1].textContent).toContain('Payroll issues are handled by our HR Assistant.');
        });
    });

    describe('agent definition dialog — accessible tabs (WAI-ARIA)', () => {
        async function openAgentDialog(ctx) {
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            return document.querySelector('.pdt-agent-def-tabs');
        }

        it('should expose the sub-tabs as an ARIA tablist with a roving tabindex', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const tabBar = await openAgentDialog(ctx);
            expect(tabBar.getAttribute('role')).toBe('tablist');
            [...tabBar.querySelectorAll('.pdt-sub-tab')].forEach(t => expect(t.getAttribute('role')).toBe('tab'));

            const overview = tabBar.querySelector('[data-tab="overview"]');
            const map = tabBar.querySelector('[data-tab="map"]');
            expect(overview.getAttribute('aria-selected')).toBe('true');
            expect(overview.tabIndex).toBe(0);
            expect(map.getAttribute('aria-selected')).toBe('false');
            expect(map.tabIndex).toBe(-1);
        });

        it('should link each tab to its panel (aria-controls / role=tabpanel / aria-labelledby)', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const tabBar = await openAgentDialog(ctx);
            const overview = tabBar.querySelector('[data-tab="overview"]');
            const panel = document.getElementById(overview.getAttribute('aria-controls'));
            expect(panel).toBeTruthy();
            expect(panel.getAttribute('role')).toBe('tabpanel');
            expect(panel.getAttribute('aria-labelledby')).toBe(overview.id);
        });

        it('should move focus and activate the next tab on ArrowRight', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const tabBar = await openAgentDialog(ctx);
            const overview = tabBar.querySelector('[data-tab="overview"]');
            const map = tabBar.querySelector('[data-tab="map"]');
            overview.focus();
            tabBar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
            await flush();

            expect(document.activeElement).toBe(map);
            expect(map.classList.contains('active')).toBe(true);
            expect(map.getAttribute('aria-selected')).toBe('true');
            expect(map.tabIndex).toBe(0);
            expect(overview.getAttribute('aria-selected')).toBe('false');
            expect(overview.tabIndex).toBe(-1);
        });

        it('should jump to the last tab on End and back to the first on Home', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const tabBar = await openAgentDialog(ctx);
            const tabs = [...tabBar.querySelectorAll('.pdt-sub-tab')];
            const first = tabs[0];
            const last = tabs[tabs.length - 1];

            first.focus();
            tabBar.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
            await flush();
            expect(document.activeElement).toBe(last);
            expect(last.getAttribute('aria-selected')).toBe('true');

            tabBar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
            await flush();
            expect(document.activeElement).toBe(first);
            expect(first.getAttribute('aria-selected')).toBe('true');
        });
    });

    describe('transcripts sub-tab (agent definition dialog)', () => {
        /** Opens bot-1's definition dialog and activates its Transcripts sub-tab. */
        async function openTranscriptsTab(ctx) {
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            const tabEl = [...document.querySelectorAll('.pdt-agent-def-tabs .pdt-sub-tab')]
                .find(t => t.dataset.tab === 'transcripts');
            expect(tabEl).toBeTruthy();
            tabEl.click();
            await flush();
        }

        it('should lazily load transcripts for the open agent when the sub-tab is activated', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTranscriptsTab(ctx);
            expect(DataService.getAgentTranscripts).toHaveBeenCalledWith('bot-1');
            expect(document.querySelector('[data-transcript-id="t-1"]')).toBeTruthy();
        });

        /** Expands a transcript <details> row (jsdom doesn't fire `toggle` on its own). */
        function expandTranscriptRow(row) {
            row.open = true;
            row.dispatchEvent(new Event('toggle'));
        }

        it('should summarize each transcript on the collapsed row: bold date, meta line, session + source badges', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTranscriptsTab(ctx);

            const row = document.querySelector('.pdt-agent-transcript-row');
            expect(row.tagName).toBe('DETAILS');
            // The date leads (in place of the opaque GUID name).
            expect(row.querySelector('.pdt-agent-transcript-when').textContent).toBe('1/1/2026 10:00');
            // At-a-glance meta under the date — visible before expanding.
            expect(row.querySelector('.pdt-agent-transcript-submeta').textContent).toBe('2 turns · 1:32 · en-US');
            // Session + source badges on the right — not hidden until expand.
            const badges = row.querySelector('.pdt-agent-transcript-summary-badges');
            expect(badges.textContent).toContain('Engaged');
            expect(badges.textContent).toContain('Resolved');
            expect(badges.textContent).toContain('PVA');
            // No separate View/Hide button any more.
            expect(row.querySelector('[data-action="view-transcript"]')).toBeNull();
            // The (heavy) body isn't built until the row is opened.
            expect(row.querySelector('.pdt-agent-transcript-body').children.length).toBe(0);
        });

        it('should expand a transcript inline (not in a nested dialog) using the content already loaded', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTranscriptsTab(ctx);
            DialogService.show.mockClear(); // opening the agent dialog already called it once

            const row = document.querySelector('.pdt-agent-transcript-row');
            expandTranscriptRow(row);
            await flush();

            const body = row.querySelector('.pdt-agent-transcript-body');
            expect(body.querySelector('.copyable-code-block')).toBeTruthy();
            expect(UIFactory.createCopyableCodeBlock).toHaveBeenCalled();
            // Content came with the list — expanding needs no per-row fetch.
            expect(DataService.getTranscriptContent).not.toHaveBeenCalled();
            // Must NOT open a second dialog — that would destroy the agent definition dialog.
            expect(DialogService.show).not.toHaveBeenCalled();

            // Re-opening does not rebuild the body (it was rendered once).
            row.open = false;
            row.dispatchEvent(new Event('toggle'));
            expandTranscriptRow(row);
            await flush();
            expect(body.querySelectorAll('.copyable-code-block')).toHaveLength(1);
        });

        it('should explain a blocked environment when no transcripts return', async () => {
            DataService.getAgentTranscripts.mockResolvedValueOnce([]);
            DataService.getOrganizationDiagnostics.mockResolvedValueOnce({
                pluginTraceLogSetting: null, transcriptRecordingBlocked: true,
                transcriptAccessBlocked: false, flowRunRetentionSeconds: null
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTranscriptsTab(ctx);
            const reason = document.querySelector('.pdt-agent-transcripts-reason');
            expect(reason).toBeTruthy();
            expect(reason.textContent).toContain('turned off');
        });

        it('should give the generic reasons when transcripts are empty but recording is allowed', async () => {
            DataService.getAgentTranscripts.mockResolvedValueOnce([]);
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTranscriptsTab(ctx);
            const reason = document.querySelector('.pdt-agent-transcripts-reason');
            expect(reason).toBeTruthy();
            // The generic (not blocked) reason — distinct from the "recording is turned off" note.
            expect(reason.textContent).toContain('written in batches');
        });

        it('should retry the load on re-open when the first attempt failed', async () => {
            DataService.getAgentTranscripts.mockRejectedValueOnce(new Error('boom'));
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTranscriptsTab(ctx);
            expect(document.querySelector('.pdt-agent-transcripts-list .pdt-error')).toBeTruthy();

            // Switch away, then back — the failed load should not be latched, so it retries.
            document.querySelector('.pdt-agent-def-tabs .pdt-sub-tab[data-tab="overview"]').click();
            document.querySelector('.pdt-agent-def-tabs .pdt-sub-tab[data-tab="transcripts"]').click();
            await flush();
            expect(DataService.getAgentTranscripts).toHaveBeenCalledTimes(2);
            expect(document.querySelector('[data-transcript-id="t-1"]')).toBeTruthy();
        });

        it('should render a readable conversation (role 1 = user, 0 = agent) with the raw JSON collapsed', async () => {
            DataService.getAgentTranscripts.mockResolvedValueOnce([{
                id: 't-1', name: 'Conversation 1', schemaType: 'PVA', startTime: '1/1/2026 10:00', createdOn: '1/1/2026',
                content: JSON.stringify({
                    activities: [
                        { type: 'message', from: { id: 'u1', role: 1 }, text: 'How do I reset my password?' },
                        { type: 'event', from: { id: 'bot', role: 0 }, text: 'SetPVAContext' },
                        { type: 'message', from: { id: 'bot', role: 0 }, text: 'Go to the reset portal.' }
                    ]
                })
            }]);
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTranscriptsTab(ctx);
            const row = document.querySelector('.pdt-agent-transcript-row');
            expandTranscriptRow(row);
            await flush();

            const turns = row.querySelectorAll('.pdt-agent-transcript-body .pdt-eval-turn');
            expect(turns).toHaveLength(2); // the event activity is not part of the conversation
            expect(turns[0].classList.contains('pdt-eval-turn--user')).toBe(true);
            expect(turns[0].textContent).toContain('How do I reset my password?');
            expect(turns[1].classList.contains('pdt-eval-turn--agent')).toBe(true);
            expect(turns[1].textContent).toContain('Go to the reset portal.');
            // The raw JSON stays available, collapsed below the conversation.
            const raw = row.querySelector('.pdt-agent-transcript-body details.pdt-agent-raw-config');
            expect(raw).toBeTruthy();
            expect(raw.querySelector('.copyable-code-block')).toBeTruthy();
        });

        it('should badge an unengaged, message-less session on the row and explain the empty body', async () => {
            DataService.getAgentTranscripts.mockResolvedValueOnce([{
                id: 't-1', name: 'Conversation 1', schemaType: 'PVA', startTime: '1/1/2026 10:00', createdOn: '1/1/2026',
                content: JSON.stringify({
                    activities: [
                        { valueType: 'ConversationInfo', type: 'trace', value: { isDesignMode: false, locale: '' } },
                        { type: 'event', from: { role: 1 }, name: 'pvaSetContext' },
                        {
                            valueType: 'SessionInfo', type: 'trace', value: {
                                type: 'Unengaged', outcome: 'None', turnCount: 0, impliedSuccess: false,
                                startTimeUtc: '2026-07-25T17:30:53Z', endTimeUtc: '2026-07-25T17:30:53Z'
                            }
                        }
                    ]
                })
            }]);
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTranscriptsTab(ctx);

            // Engagement badge is on the collapsed row summary.
            const row = document.querySelector('.pdt-agent-transcript-row');
            expect(row.querySelector('.pdt-agent-transcript-summary-badges').textContent).toContain('Unengaged');

            expandTranscriptRow(row);
            await flush();
            // No message turns — but the empty conversation is explained, not left as opaque JSON.
            expect(row.querySelectorAll('.pdt-agent-transcript-body .pdt-eval-turn')).toHaveLength(0);
            expect(row.querySelector('.pdt-agent-transcript-empty-note').textContent).toContain('Unengaged session');
            // The raw JSON is still available, collapsed.
            expect(row.querySelector('.pdt-agent-transcript-body details.pdt-agent-raw-config')).toBeTruthy();
        });

        it('should badge an engaged, resolved, test-pane session on the row above its turns', async () => {
            DataService.getAgentTranscripts.mockResolvedValueOnce([{
                id: 't-1', name: 'Conversation 1', schemaType: 'PVA', startTime: '1/1/2026 10:00', createdOn: '1/1/2026',
                content: JSON.stringify({
                    activities: [
                        { valueType: 'ConversationInfo', type: 'trace', value: { isDesignMode: true, locale: 'en-US' } },
                        { type: 'message', from: { role: 1 }, text: 'Book a room' },
                        { type: 'message', from: { role: 0 }, text: 'Sure, for when?' },
                        {
                            valueType: 'SessionInfo', type: 'trace', value: {
                                type: 'Engaged', outcome: 'Resolved', turnCount: 2, impliedSuccess: true
                            }
                        }
                    ]
                })
            }]);
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTranscriptsTab(ctx);

            const row = document.querySelector('.pdt-agent-transcript-row');
            const badges = row.querySelector('.pdt-agent-transcript-summary-badges');
            expect(badges.textContent).toContain('Engaged');
            expect(badges.textContent).toContain('Resolved');
            expect(badges.textContent).toContain('Test pane');
            expect(row.querySelector('.pdt-agent-transcript-submeta').textContent).toContain('2 turns');

            expandTranscriptRow(row);
            await flush();
            // The conversation renders in the body.
            expect(row.querySelectorAll('.pdt-agent-transcript-body .pdt-eval-turn')).toHaveLength(2);
        });

        it('should not claim engagement on a record without SessionInfo (e.g. an early split batch)', async () => {
            // ConversationInfo (written at conversation start) but no SessionInfo (written at session
            // end, in a later 1 MB batch) — plus real messages.
            DataService.getAgentTranscripts.mockResolvedValueOnce([{
                id: 't-1', name: 'Conversation 1', schemaType: 'PVA', startTime: '1/1/2026 10:00', createdOn: '1/1/2026',
                content: JSON.stringify({
                    activities: [
                        { valueType: 'ConversationInfo', type: 'trace', value: { isDesignMode: true, locale: 'en-US' } },
                        { type: 'message', from: { role: 1 }, text: 'First batch message' }
                    ]
                })
            }]);
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTranscriptsTab(ctx);

            const row = document.querySelector('.pdt-agent-transcript-row');
            const badges = row.querySelector('.pdt-agent-transcript-summary-badges');
            // Test-pane badge (from ConversationInfo) but NO engagement claim without SessionInfo.
            expect(badges.textContent).toContain('Test pane');
            expect(badges.textContent).not.toContain('Engaged');
            expect(badges.textContent).not.toContain('Unengaged');

            expandTranscriptRow(row);
            await flush();
            // The message still renders.
            expect(row.querySelectorAll('.pdt-agent-transcript-body .pdt-eval-turn')).toHaveLength(1);
        });

        it('should fall back to raw JSON when the content is neither a readable conversation nor a session', async () => {
            DataService.getAgentTranscripts.mockResolvedValueOnce([{
                id: 't-1', name: 'Conversation 1', schemaType: 'PVA', startTime: '1/1/2026 10:00', createdOn: '1/1/2026',
                content: JSON.stringify({ foo: 'bar' })
            }]);
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTranscriptsTab(ctx);

            const row = document.querySelector('.pdt-agent-transcript-row');
            // No session metadata — the row still shows the date and the source badge, no meta line.
            expect(row.querySelector('.pdt-agent-transcript-submeta')).toBeNull();
            expect(row.querySelector('.pdt-agent-transcript-summary-badges').textContent).toContain('PVA');

            expandTranscriptRow(row);
            await flush();
            // Raw JSON shown on its own — no conversation turns, no empty note.
            expect(row.querySelector('.pdt-agent-transcript-body .copyable-code-block')).toBeTruthy();
            expect(row.querySelectorAll('.pdt-agent-transcript-body .pdt-eval-turn')).toHaveLength(0);
        });

        it('should show the empty-content note when a transcript has no content', async () => {
            DataService.getAgentTranscripts.mockResolvedValueOnce([{
                id: 't-1', name: 'Conversation 1', schemaType: 'PVA', startTime: '1/1/2026 10:00', createdOn: '1/1/2026',
                content: ''
            }]);
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTranscriptsTab(ctx);

            const row = document.querySelector('.pdt-agent-transcript-row');
            expandTranscriptRow(row);
            await flush();
            expect(row.querySelector('.pdt-agent-transcript-body .pdt-note').textContent).toContain('no content');
        });
    });

    describe('management edge cases', () => {
        it('should activate an inactive (managed) agent via its toggle', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const cards = ctx.el.querySelectorAll('.pdt-agent-card');
            cards[1].querySelector('[data-action="toggle"]').click(); // bot-2 is inactive
            await flush();
            expect(DataService.setAgentState).toHaveBeenCalledWith('bot-2', true);
        });

        it('should show an error notification when a toggle fails', async () => {
            DataService.setAgentState.mockRejectedValueOnce(new Error('locked'));
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="toggle"]').click();
            await flush();
            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
        });

        it('should not delete when the confirmation is cancelled', async () => {
            showConfirmDialog.mockResolvedValueOnce(false);
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="delete"]').click();
            await flush();
            expect(DataService.deleteAgent).not.toHaveBeenCalled();
        });

        it('should refresh the agents list', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-action="refresh-agents"]').click();
            await flush();
            expect(DataService.getAgents).toHaveBeenCalledTimes(2);
        });

        it('should open a GPT prompt at the solution-scoped AI Builder prompts URL', async () => {
            // mockModels[0] template 'Custom Prompt' → treated as a prompt.
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="open-aibuilder"]').click();
            await flush();
            expect(DataService.getDefaultSolutionId).toHaveBeenCalled();
            expect(window.open).toHaveBeenCalledWith(
                expect.stringContaining('/aibuilder/solutions/sol-default/prompts/m-1'),
                '_blank'
            );
        });

        it('should open a custom (unmanaged) model at its /editor page', async () => {
            DataService.getAiModels.mockResolvedValueOnce([
                { id: 'mdl-9', name: 'My Custom Model', statecode: 0, stateLabel: 'Active', isManaged: false, owner: 'Jane', template: 'TextClassificationV2', templateName: 'TextClassificationV2', kind: 'custom', kindLabel: 'Custom model', createdOn: '1/1/2026', modifiedOn: '1/2/2026' }
            ]);
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="open-aibuilder"]').click();
            await flush();
            expect(window.open).toHaveBeenCalledWith(
                expect.stringContaining('/aibuilder/models/mdl-9/editor'),
                '_blank'
            );
        });

        it('should land a prebuilt (managed) model on the AI Builder models list', async () => {
            DataService.getAiModels.mockResolvedValueOnce([
                { id: 'mdl-pre', name: 'Invoice Processing', statecode: 0, stateLabel: 'Active', isManaged: true, owner: 'SYSTEM', template: 'InvoiceProcessing', templateName: 'InvoiceProcessing', kind: 'prebuilt', kindLabel: 'Prebuilt model', createdOn: '1/1/2026', modifiedOn: '1/2/2026' }
            ]);
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="prompts"]').click();
            await flush();
            ctx.el.querySelector('[data-action="open-aibuilder"]').click();
            await flush();
            expect(window.open).toHaveBeenCalledWith(
                expect.stringMatching(/\/aibuilder\/models$/),
                '_blank'
            );
        });

        it('should open a modern agent on the /agents/ route with no /overview suffix', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-agent-id="bot-1"] [data-action="open-studio"]').click();
            await flush();

            expect(window.open).toHaveBeenCalledWith(
                'https://copilotstudio.microsoft.com/environments/env-abc-123/agents/bot-1',
                '_blank'
            );
        });

        it('should open a classic agent on the /bots/ route with the /overview suffix', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-agent-id="bot-2"] [data-action="open-studio"]').click();
            await flush();

            expect(window.open).toHaveBeenCalledWith(
                'https://copilotstudio.microsoft.com/environments/env-abc-123/bots/bot-2/overview',
                '_blank'
            );
        });

        it('should fall back to the base Copilot Studio URL when the environment id is unavailable', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            DataService.getEnvironmentId.mockResolvedValueOnce(null);
            ctx.el.querySelector('.pdt-agent-card [data-action="open-studio"]').click();
            await flush();
            expect(window.open).toHaveBeenCalledWith('https://copilotstudio.microsoft.com/', '_blank');
        });
    });

    describe('agent flows view', () => {
        it('should list all Copilot Studio agent flows directly (no agent selection needed)', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="flows"]').click();
            await flush();
            expect(DataService.getAgentFlows).toHaveBeenCalled();
            expect(ctx.el.querySelector('#pdt-flows-agent-select')).toBeNull();
            expect(ctx.el.querySelector('[data-flow-id="wf-1"]')).toBeTruthy();
            expect(ctx.el.querySelector('[data-flow-id="wf-2"]')).toBeTruthy();
        });

        it('should render each agent flow as a Power Automate-style card (info grid)', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="flows"]').click();
            await flush();
            const card = ctx.el.querySelector('[data-flow-id="wf-1"]');
            expect(card.classList.contains('pdt-flow-card')).toBe(true);
            expect(card.querySelector('.pdt-flow-info-grid')).toBeTruthy();
            // The card surfaces the same details as the Power Automate flow card.
            expect(card.querySelector('.pdt-flow-id').textContent).toContain('wf-1');
            expect(card.textContent).toContain('Mohammed Khawatme'); // owner / created by
        });

        it('should populate the solution dropdown and filter agent flows by solution', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="flows"]').click();
            await flush();
            const solSelect = ctx.el.querySelector('.pdt-agent-flows-solution');
            expect(DataService.getSolutionMemberships).toHaveBeenCalled();
            // sol-1 + sol-2 across the two flows, plus the "All" option.
            expect(solSelect.querySelectorAll('option')).toHaveLength(3);

            solSelect.value = 'sol-2';
            solSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();
            expect(ctx.el.querySelector('[data-flow-id="wf-2"]').style.display).toBe('');
            expect(ctx.el.querySelector('[data-flow-id="wf-1"]').style.display).toBe('none');
        });

        it('should arrange the agent flow cards in a spaced grid', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="flows"]').click();
            await flush();
            // pdt-card-grid provides the gap between cards (was missing).
            expect(ctx.el.querySelector('#pdt-flows-list').classList.contains('pdt-card-grid')).toBe(true);
        });

        it('should filter the agent flows by the search box', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="flows"]').click();
            await flush();
            const search = ctx.el.querySelector('.pdt-agent-flows-search');
            search.value = 'order';
            search.dispatchEvent(new Event('input', { bubbles: true }));
            await flush();
            expect(ctx.el.querySelector('[data-flow-id="wf-2"]').style.display).toBe('');
            expect(ctx.el.querySelector('[data-flow-id="wf-1"]').style.display).toBe('none');
        });

        it('should view a flow definition and open it in Copilot Studio', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="flows"]').click();
            await flush();
            ctx.el.querySelector('[data-flow-id="wf-1"] [data-action="flow-view-def"]').click();
            await flush();
            expect(DataService.getFlowDefinition).toHaveBeenCalledWith('wf-1');
            expect(DialogService.show).toHaveBeenCalled();

            ctx.el.querySelector('[data-flow-id="wf-1"] [data-action="flow-open"]').click();
            await flush();
            expect(window.open).toHaveBeenCalledWith(
                expect.stringContaining('copilotstudio.microsoft.com'),
                '_blank'
            );
            expect(window.open).toHaveBeenCalledWith(expect.stringContaining('/agent-flows/wf-1'), '_blank');
        });

        it('should activate/deactivate an agent flow in place', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="flows"]').click();
            await flush();
            // wf-1 is on (statecode 1) → toggling turns it off.
            ctx.el.querySelector('[data-flow-id="wf-1"] [data-action="flow-toggle"]').click();
            await flush();
            expect(DataService.setFlowState).toHaveBeenCalledWith('wf-1', false);
            const card = ctx.el.querySelector('[data-flow-id="wf-1"]');
            expect(card.dataset.statecode).toBe('0');
            expect(card.querySelector('.pdt-status-badge').classList.contains('inactive')).toBe(true);
        });

        it('should delete an unmanaged agent flow after confirmation', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="flows"]').click();
            await flush();
            ctx.el.querySelector('[data-flow-id="wf-1"] [data-action="flow-delete"]').click();
            await flush();
            expect(showConfirmDialog).toHaveBeenCalled();
            expect(DataService.deleteFlow).toHaveBeenCalledWith('wf-1');
            expect(ctx.el.querySelector('[data-flow-id="wf-1"]')).toBeNull();
        });

        it('should not offer delete for managed agent flows', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="flows"]').click();
            await flush();
            // wf-2 is managed → no delete button, but toggle/open/view remain.
            expect(ctx.el.querySelector('[data-flow-id="wf-2"] [data-action="flow-delete"]')).toBeNull();
            expect(ctx.el.querySelector('[data-flow-id="wf-2"] [data-action="flow-toggle"]')).toBeTruthy();
        });
    });

    describe('templates view', () => {
        it('should render template cards', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="templates"]').click();
            await flush();
            expect(ctx.el.querySelectorAll('.pdt-template-card').length).toBeGreaterThan(0);
        });

        it('should filter templates by category', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="templates"]').click();
            await flush();
            const category = ctx.el.querySelector('.pdt-templates-category');
            category.value = 'Topic';
            category.dispatchEvent(new Event('change', { bubbles: true }));
            const visible = [...ctx.el.querySelectorAll('.pdt-template-card')].filter(c => c.style.display !== 'none');
            const hidden = [...ctx.el.querySelectorAll('.pdt-template-card')].filter(c => c.style.display === 'none');
            expect(visible.every(c => c.dataset.category === 'Topic')).toBe(true);
            expect(hidden.length).toBeGreaterThan(0);
        });

        it('should show an empty-state note when no templates match, and remove it when they do', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="templates"]').click();
            await flush();
            const search = ctx.el.querySelector('.pdt-templates-search');
            search.value = 'zzz-no-such-template';
            search.dispatchEvent(new Event('input', { bubbles: true }));
            const note = ctx.el.querySelector('.pdt-templates-empty');
            expect(note).toBeTruthy();
            expect(note.textContent).toMatch(/no templates/i);
            // Clearing the search restores matches and removes the note.
            search.value = '';
            search.dispatchEvent(new Event('input', { bubbles: true }));
            expect(ctx.el.querySelector('.pdt-templates-empty')).toBeNull();
        });
    });

    describe('templates workbench (Library | Generator | Review)', () => {
        /** Opens the Templates view. */
        async function openTemplates(ctx) {
            ctx.el.querySelector('[data-view="templates"]').click();
            await flush();
        }

        /** Switches the workbench segment. */
        async function switchMode(ctx, mode) {
            ctx.el.querySelector(`.pdt-templates-mode [data-mode="${mode}"]`).click();
            await flush();
        }

        /** Picks an agent experience on the shared workbench control. */
        function chooseKind(ctx, kind) {
            const select = ctx.el.querySelector('.pdt-templates-kind');
            select.value = kind;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return select;
        }

        const visibleCards = (ctx) => [...ctx.el.querySelectorAll('.pdt-template-card')]
            .filter(c => c.style.display !== 'none');

        describe('shared agent type', () => {
            it('should default to any type and show every template, badging the scoped ones', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);

                expect(ctx.el.querySelector('.pdt-templates-kind').value).toBe('any');
                expect(visibleCards(ctx).length).toBe(AGENT_TEMPLATES.length);
                const topicCard = ctx.el.querySelector('[data-template-id="topic-fallback"]');
                expect(topicCard.dataset.applies).toBe('classic');
                expect(topicCard.querySelector('.pdt-scope-badge').textContent).toBe('Classic only');
            });

            it('should hide templates that do not apply to the chosen type', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);

                chooseKind(ctx, 'modern');
                expect(visibleCards(ctx).some(c => c.dataset.applies === 'classic')).toBe(false);
                expect(ctx.el.querySelector('[data-template-id="topic-fallback"]').style.display).toBe('none');
                expect(ctx.el.querySelector('[data-template-id="instr-m365-declarative"]').style.display).not.toBe('none');

                chooseKind(ctx, 'classic');
                expect(ctx.el.querySelector('[data-template-id="topic-fallback"]').style.display).not.toBe('none');
                expect(ctx.el.querySelector('[data-template-id="instr-m365-declarative"]').style.display).toBe('none');
            });

            it('should stop showing the scope badge once a type is chosen', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);
                const list = ctx.el.querySelector('#pdt-templates-list');

                chooseKind(ctx, 'classic');
                expect(list.classList.contains('pdt-hide-scope-badges')).toBe(true);
                chooseKind(ctx, 'any');
                expect(list.classList.contains('pdt-hide-scope-badges')).toBe(false);
            });

            it('should scope the subcategory counts so a chip never advertises a hidden card', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);

                const category = ctx.el.querySelector('.pdt-templates-category');
                category.value = 'Topic';
                category.dispatchEvent(new Event('change', { bubbles: true }));
                expect(ctx.el.querySelector('.pdt-template-subcat-chip').textContent).toMatch(/All \(22\)/);

                chooseKind(ctx, 'modern');
                expect(ctx.el.querySelector('.pdt-template-subcat-chip').textContent).toMatch(/All \(0\)/);
            });

            it('should explain an empty list caused by the agent type, and update the note when it changes', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);

                // Trigger phrases only exist in the classic experience, so every match is scoped out.
                const search = ctx.el.querySelector('.pdt-templates-search');
                search.value = 'trigger phrases:';
                search.dispatchEvent(new Event('input', { bubbles: true }));
                chooseKind(ctx, 'modern');

                const note = ctx.el.querySelector('.pdt-templates-empty');
                expect(note.textContent).toMatch(/apply to a modern agent/i);

                // The note must re-render its text, not keep the first message it was created with.
                search.value = 'zzz-no-such-template';
                search.dispatchEvent(new Event('input', { bubbles: true }));
                expect(ctx.el.querySelector('.pdt-templates-empty').textContent).toBe('No templates match your search.');
            });

            it('should rewrite an already-open card when the type changes', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);

                const card = ctx.el.querySelector('[data-template-id="instr-order-tracking"]');
                card.querySelector('.pdt-template-header').click();
                expect(card.querySelector('.pdt-template-preview').textContent).toContain('/{');

                chooseKind(ctx, 'modern');
                const preview = card.querySelector('.pdt-template-preview').textContent;
                expect(preview).not.toContain('/{');
                expect(preview).toContain('`{');
            });

            it('should only find text the current experience actually shows', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);

                // "Adaptive Card" survives only in pattern-tables-lists' classic content.
                const search = ctx.el.querySelector('.pdt-templates-search');
                search.value = 'adaptive cards note';
                search.dispatchEvent(new Event('input', { bubbles: true }));
                expect(ctx.el.querySelector('[data-template-id="pattern-tables-lists"]').style.display).not.toBe('none');

                chooseKind(ctx, 'modern');
                expect(ctx.el.querySelector('[data-template-id="pattern-tables-lists"]').style.display).toBe('none');
            });

            // The tool-hints picker lends an agent's tool names; it does not decide what you are
            // authoring. So it fills a blank choice and never overrides a real one.
            it('should let a grounding agent fill an unset type but never overrule a chosen one', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);
                await switchMode(ctx, 'generator');
                await flush();

                // No preference yet, so the grounding agent supplies one — without locking it.
                const genAgent = ctx.el.querySelector('.pdt-generator-agent');
                genAgent.value = 'bot-1'; // modern
                genAgent.dispatchEvent(new Event('change', { bubbles: true }));
                await flush();
                expect(tab._tplState.kind).toBe('modern');
                expect(ctx.el.querySelector('.pdt-templates-kind').disabled).toBe(false);

                // An explicit choice now outranks it, and a later classic agent must not undo it.
                chooseKind(ctx, 'modern');
                ctx.el.querySelector('.pdt-generator-agent').value = 'bot-2'; // classic
                ctx.el.querySelector('.pdt-generator-agent').dispatchEvent(new Event('change', { bubbles: true }));
                await flush();
                expect(tab._tplState.kind).toBe('modern');
                expect(ctx.el.querySelector('.pdt-templates-kind').value).toBe('modern');
                // The tool names still come from the agent that was picked.
                expect(ctx.el.querySelector('.pdt-generator-agent').value).toBe('bot-2');
            });

            it('should leave the agent type alone when the Generator form is reset', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);
                await switchMode(ctx, 'generator');
                await flush();

                const agentSelect = ctx.el.querySelector('.pdt-generator-agent');
                agentSelect.value = 'bot-1';
                agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
                await flush();
                expect(tab._tplState.kind).toBe('modern');

                // Reset clears the Generator's own form; the type is workbench-wide, so it stays.
                ctx.el.querySelector('[data-action="gen-reset"]').click();
                await flush();
                expect(tab._tplState.kind).toBe('modern');
                expect(ctx.el.querySelector('.pdt-templates-kind').disabled).toBe(false);
            });

            // A loaded agent picks the type for you; it never takes the control away.
            it('should let the type be changed while an agent is loaded in Review', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);
                await switchMode(ctx, 'review');
                await flush();

                DataService.getAgentConfiguration.mockResolvedValueOnce(null);
                const reviewAgent = ctx.el.querySelector('.pdt-review-agent');
                reviewAgent.value = 'bot-2'; // classic
                reviewAgent.dispatchEvent(new Event('change', { bubbles: true }));
                await flush();
                expect(tab._tplState.kind).toBe('classic');
                expect(ctx.el.querySelector('.pdt-templates-kind').disabled).toBe(false);

                chooseKind(ctx, 'modern');
                expect(tab._tplState.kind).toBe('modern');
            });

            it('should keep the picked type when an agent selection is cleared', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);
                await switchMode(ctx, 'review');
                await flush();

                DataService.getAgentConfiguration.mockResolvedValueOnce(null);
                const reviewAgent = ctx.el.querySelector('.pdt-review-agent');
                reviewAgent.value = 'bot-2';
                reviewAgent.dispatchEvent(new Event('change', { bubbles: true }));
                await flush();
                expect(tab._tplState.kind).toBe('classic');

                // Unpicking the agent is no reason to undo a type that was already chosen.
                ctx.el.querySelector('.pdt-review-agent').value = '';
                ctx.el.querySelector('.pdt-review-agent').dispatchEvent(new Event('change', { bubbles: true }));
                await flush();
                expect(tab._tplState.kind).toBe('classic');
                expect(ctx.el.querySelector('.pdt-templates-kind').value).toBe('classic');
            });

            it('should serve the hand-written modern variant when there is one', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);
                chooseKind(ctx, 'modern');

                const card = ctx.el.querySelector('[data-template-id="pattern-grounding-only"]');
                card.querySelector('.pdt-template-header').click();
                expect(card.querySelector('.pdt-template-preview').textContent).not.toContain('Allow ungrounded responses');
            });

            it('should survive a switch away from the Templates view', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);
                chooseKind(ctx, 'modern');

                ctx.el.querySelector('[data-view="agents"]').click();
                await flush();
                await openTemplates(ctx);
                expect(ctx.el.querySelector('.pdt-templates-kind').value).toBe('modern');
                expect(ctx.el.querySelector('[data-template-id="topic-fallback"]').style.display).toBe('none');
            });
        });

        describe('agent type across segments', () => {
            it('should compose the Generator output for the chosen type', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);
                chooseKind(ctx, 'modern');
                await switchMode(ctx, 'generator');

                const output = () => ctx.el.querySelector('.pdt-generator-output-pre code').textContent;
                expect(output()).toContain('# Self-check');
                expect(output()).toContain('# Output');

                chooseKind(ctx, 'classic');
                expect(output()).not.toContain('# Output');
            });

            it('should keep text the user typed when the type changes mid-edit', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);
                await switchMode(ctx, 'generator');

                const company = ctx.el.querySelector('.pdt-generator-company');
                company.value = 'Contoso';
                company.dispatchEvent(new Event('input', { bubbles: true }));

                chooseKind(ctx, 'modern');
                expect(ctx.el.querySelector('.pdt-generator-output-pre code').textContent).toContain('Contoso');
                expect(ctx.el.querySelector('.pdt-generator-company').value).toBe('Contoso');
            });

            it('should carry the detected type into the other segments, still editable', async () => {
                const ctx = await renderTab();
                tab = ctx.tab;
                await openTemplates(ctx);
                await switchMode(ctx, 'review');
                await flush();

                const agentSelect = ctx.el.querySelector('.pdt-review-agent');
                agentSelect.value = 'bot-1'; // cliagent-* → modern
                agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
                await flush();

                await switchMode(ctx, 'library');
                const kindSelect = ctx.el.querySelector('.pdt-templates-kind');
                expect(kindSelect.value).toBe('modern');
                expect(kindSelect.disabled).toBe(false);
                expect(ctx.el.querySelector('[data-template-id="topic-fallback"]').style.display).toBe('none');

                // And it can still be overridden from the Library, agent or no agent.
                chooseKind(ctx, 'classic');
                expect(ctx.el.querySelector('[data-template-id="topic-fallback"]').style.display).not.toBe('none');
            });
        });

        it('should render subcategory chips with counts when a category is chosen, and reset on change', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);

            const row = ctx.el.querySelector('#pdt-templates-subcats');
            expect(row.style.display).toBe('none'); // hidden until a category is chosen

            const category = ctx.el.querySelector('.pdt-templates-category');
            category.value = 'Topic';
            category.dispatchEvent(new Event('change', { bubbles: true }));

            const chips = [...ctx.el.querySelectorAll('.pdt-template-subcat-chip')];
            expect(chips.length).toBeGreaterThan(2);
            expect(chips[0].textContent).toMatch(/All \(\d+\)/);
            const sysChip = chips.find(c => c.dataset.subcat === 'System Topics');
            expect(sysChip.textContent).toMatch(/System Topics \(\d+\)/);

            sysChip.click();
            const visible = [...ctx.el.querySelectorAll('.pdt-template-card')].filter(c => c.style.display !== 'none');
            expect(visible.length).toBeGreaterThan(0);
            expect(visible.every(c => c.dataset.subcategory === 'System Topics')).toBe(true);
            expect(ctx.el.querySelector('.pdt-template-subcat-chip[data-subcat="System Topics"]').getAttribute('aria-pressed')).toBe('true');

            // Changing category resets the subcategory selection.
            category.value = 'Tool';
            category.dispatchEvent(new Event('change', { bubbles: true }));
            expect(tab._tplState.subcategory).toBe('');
        });

        it('should find templates by problem-language keywords (e.g. "hallucination")', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            const search = ctx.el.querySelector('.pdt-templates-search');
            search.value = 'hallucination';
            search.dispatchEvent(new Event('input', { bubbles: true }));
            const visible = [...ctx.el.querySelectorAll('.pdt-template-card')].filter(c => c.style.display !== 'none');
            expect(visible.length).toBeGreaterThan(0);
            expect(visible.some(c => c.dataset.templateId === 'pattern-grounding-only')).toBe(true);
        });

        it('should lazily reveal one combined panel with the content block from the header', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            const card = ctx.el.querySelector('[data-template-id="instr-customer-service"]');

            const expand = card.querySelector('.pdt-template-expand');
            expect(expand.childElementCount).toBe(0); // lazy — nothing built yet
            expect(expand.style.display).toBe('none');

            // No footer button — the header itself is the control.
            expect(card.querySelector('.pdt-card-footer')).toBeNull();
            const header = card.querySelector('.pdt-template-header');
            expect(header.getAttribute('role')).toBe('button');
            expect(header.getAttribute('tabindex')).toBe('0');
            expect(header.getAttribute('aria-expanded')).toBe('false');
            expect(header.getAttribute('aria-controls')).toBe(expand.id);

            header.click();
            expect(expand.style.display).not.toBe('none');
            expect(header.getAttribute('aria-expanded')).toBe('true');
            expect(card.classList.contains('pdt-template-card--open')).toBe(true);
            // The panel carries the copyable content block (which owns its own copy button).
            const block = card.querySelector('.pdt-template-preview .copyable-code-block');
            expect(block).toBeTruthy();
            expect(block.textContent).toContain('customer service agent');

            header.click();
            expect(expand.style.display).toBe('none');
            expect(header.getAttribute('aria-expanded')).toBe('false');
            expect(card.classList.contains('pdt-template-card--open')).toBe(false);
        });

        it('should toggle the panel when a child of the header is clicked', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            const card = ctx.el.querySelector('[data-template-id="instr-customer-service"]');
            const expand = card.querySelector('.pdt-template-expand');

            card.querySelector('.pdt-template-desc').click();
            expect(expand.style.display).not.toBe('none');

            card.querySelector('.pdt-agent-name').click();
            expect(expand.style.display).toBe('none');
        });

        it('should toggle the panel with Enter and Space on the header', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            const card = ctx.el.querySelector('[data-template-id="instr-customer-service"]');
            const header = card.querySelector('.pdt-template-header');
            const expand = card.querySelector('.pdt-template-expand');

            header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            expect(expand.style.display).not.toBe('none');
            expect(header.getAttribute('aria-expanded')).toBe('true');

            header.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
            expect(expand.style.display).toBe('none');
            expect(header.getAttribute('aria-expanded')).toBe('false');

            // Other keys leave it alone.
            header.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
            expect(expand.style.display).toBe('none');
        });

        it('should fill placeholders in the same panel and rebuild the copyable block live', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            const card = ctx.el.querySelector('[data-template-id="instr-customer-service"]');
            card.querySelector('.pdt-template-header').click();

            const inputs = [...card.querySelectorAll('.pdt-template-customize-input')];
            expect(inputs.length).toBeGreaterThan(0);
            const companyInput = inputs.find(i => i.dataset.token === 'Company');
            companyInput.value = 'Contoso';
            companyInput.dispatchEvent(new Event('input', { bubbles: true }));

            // The content block is rebuilt with the substituted text, and it carries its own copy
            // button (top-right) — so copying always yields the current, substituted text.
            const block = card.querySelector('.pdt-template-preview .copyable-code-block');
            expect(block.textContent).toContain('customer service agent for Contoso');
            expect(block.querySelector('button')).toBeTruthy();
        });

        it('should compose instructions live in the Generator and support copy/download/reset', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'generator');

            const output = ctx.el.querySelector('.pdt-generator-output-pre code');
            expect(output.textContent).toContain('# Role');
            expect(output.textContent).toContain('customer service agent'); // first preset

            const company = ctx.el.querySelector('.pdt-generator-company');
            company.value = 'Contoso';
            company.dispatchEvent(new Event('input', { bubbles: true }));
            expect(output.textContent).toContain('Contoso');

            const guardrail = [...ctx.el.querySelectorAll('.pdt-generator-guardrail')].find(i => i.value === 'privacy-pii');
            guardrail.checked = true;
            guardrail.dispatchEvent(new Event('change', { bubbles: true }));
            expect(output.textContent).toContain('# Safety');

            ctx.el.querySelector('[data-action="gen-copy"]').click();
            expect(copyToClipboard).toHaveBeenCalledWith(expect.stringContaining('# Role'), expect.any(String));
            ctx.el.querySelector('[data-action="gen-download"]').click();
            expect(downloadText).toHaveBeenCalledWith(expect.stringContaining('# Role'), 'instructions-customer-service-any.md');

            ctx.el.querySelector('[data-action="gen-reset"]').click();
            await flush();
            expect(ctx.el.querySelector('.pdt-generator-company').value).toBe('');
        });

        it('should preserve generator state when switching segments away and back', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'generator');
            const company = ctx.el.querySelector('.pdt-generator-company');
            company.value = 'Contoso';
            company.dispatchEvent(new Event('input', { bubbles: true }));

            await switchMode(ctx, 'library');
            expect(ctx.el.querySelector('.pdt-template-card')).toBeTruthy();
            await switchMode(ctx, 'generator');
            expect(ctx.el.querySelector('.pdt-generator-company').value).toBe('Contoso');
        });

        it('should reveal a purpose box for the Custom role and use it in the output', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'generator');

            const role = ctx.el.querySelector('.pdt-generator-role');
            role.value = 'custom';
            role.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            const purpose = ctx.el.querySelector('.pdt-generator-custom-role');
            expect(purpose).toBeTruthy();
            purpose.value = 'Help suppliers track purchase order approvals.';
            purpose.dispatchEvent(new Event('input', { bubbles: true }));
            expect(ctx.el.querySelector('.pdt-generator-output-pre code').textContent)
                .toContain('Help suppliers track purchase order approvals.');
        });

        it('should let the Custom role purpose be cleared instead of retaining the old value', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'generator');

            const role = ctx.el.querySelector('.pdt-generator-role');
            role.value = 'custom';
            role.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            const purpose = ctx.el.querySelector('.pdt-generator-custom-role');
            purpose.value = 'Track purchase order approvals.';
            purpose.dispatchEvent(new Event('input', { bubbles: true }));
            expect(ctx.el.querySelector('.pdt-generator-output-pre code').textContent)
                .toContain('Track purchase order approvals.');

            // Emptying the box must drop the purpose from the output — not keep the stale value.
            purpose.value = '';
            purpose.dispatchEvent(new Event('input', { bubbles: true }));
            const output = ctx.el.querySelector('.pdt-generator-output-pre code').textContent;
            expect(output).not.toContain('Track purchase order approvals.');
            expect(output).toContain('{Describe this agent\'s purpose}');
        });

        it('should ground tool hints in a real agent\'s components with exact-name references', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'generator');
            await flush(); // agent select population

            const agentSelect = ctx.el.querySelector('.pdt-generator-agent');
            agentSelect.value = 'bot-1'; // template cliagent-* → modern
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            expect(DataService.getAgentComponents).toHaveBeenCalledWith('bot-1');
            // bot-1's knowledge component "Product KB" becomes a checked, exact-name tool hint.
            const agentTool = ctx.el.querySelector('.pdt-generator-agenttool');
            expect(agentTool).toBeTruthy();
            expect(agentTool.checked).toBe(true);
            // Grounding in a modern agent composes that agent's syntax, not the classic default.
            const output = ctx.el.querySelector('.pdt-generator-output-pre code').textContent;
            expect(output).toContain('`Product KB`');
            expect(output).not.toContain('/Product KB');
        });

        it('should offer the whole routing surface, grouped, with each description shown', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'generator');
            await flush();

            DataService.getAgentComponents.mockResolvedValueOnce([
                { id: 'a1', name: 'Get order status', schemaName: 'p.action.Get', componentType: 9, description: 'Reads live order status.' },
                { id: 'k1', name: 'Product KB', schemaName: 'p.topic.kb', componentType: 16, description: 'Product manuals.' },
                { id: 'g1', name: 'HR Bot', schemaName: 'p.agent.HRBot', componentType: 9, description: 'Answers HR questions.' }
            ]);
            const agentSelect = ctx.el.querySelector('.pdt-generator-agent');
            agentSelect.value = 'bot-1';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            const groups = [...ctx.el.querySelectorAll('.pdt-generator-check-group')].map(g => g.textContent);
            expect(groups).toEqual(['Tools', 'Knowledge', 'Connected agents']);
            const hints = [...ctx.el.querySelectorAll('.pdt-generator-check-hint')].map(h => h.textContent);
            expect(hints).toContain('Reads live order status.');

            // Connected agents are opt-in; ticking one phrases it as routing, not as a tool call.
            const agentBox = [...ctx.el.querySelectorAll('.pdt-generator-agenttool')].find(i => i.value === 'g1');
            agentBox.checked = true;
            agentBox.dispatchEvent(new Event('change', { bubbles: true }));
            expect(ctx.el.querySelector('.pdt-generator-output-pre code').textContent)
                .toContain('Route {intent} to `HR Bot`');
        });

        // Widening the picker must not widen the default: an agent can have dozens of topics, and
        // naming them all is the tool inventory the docs warn against.
        it('should pre-select only tools and knowledge, leaving topics opt-in', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'generator');
            await flush();

            DataService.getAgentComponents.mockResolvedValueOnce([
                { id: 'a1', name: 'Get order', schemaName: 'p.action.Get', componentType: 9, description: 'Reads orders.' },
                { id: 'k1', name: 'Product KB', schemaName: 'p.topic.kb', componentType: 16, description: 'Manuals.' },
                { id: 't1', name: 'Greeting', schemaName: 'p.topic.Greeting', componentType: 9, description: 'Says hello.' },
                { id: 't2', name: 'Farewell', schemaName: 'p.topic.Bye', componentType: 9, description: 'Says bye.' }
            ]);
            const agentSelect = ctx.el.querySelector('.pdt-generator-agent');
            agentSelect.value = 'bot-2'; // classic, so its topics are offered
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            expect(tab._genState.agentComponents).toHaveLength(4);
            expect(tab._genState.agentToolIds).toEqual(['a1', 'k1']);
            const output = ctx.el.querySelector('.pdt-generator-output-pre code').textContent;
            expect(output).toContain('Get order');
            expect(output).not.toContain('Greeting');

            // Opting a topic in adds exactly that one line.
            const topicBox = [...ctx.el.querySelectorAll('.pdt-generator-agenttool')].find(i => i.value === 't1');
            topicBox.checked = true;
            topicBox.dispatchEvent(new Event('change', { bubbles: true }));
            expect(ctx.el.querySelector('.pdt-generator-output-pre code').textContent).toContain('Greeting topic');
        });

        it('should flag components whose description would misroute the agent', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'generator');
            await flush();

            DataService.getAgentComponents.mockResolvedValueOnce([
                { id: 'a1', name: 'Lookup A', schemaName: 'p.action.A', componentType: 9, description: '' },
                { id: 'a2', name: 'Lookup B', schemaName: 'p.action.B', componentType: 9, description: 'Looks things up.' },
                { id: 'a3', name: 'Lookup C', schemaName: 'p.action.C', componentType: 9, description: 'Looks things up.' }
            ]);
            const agentSelect = ctx.el.querySelector('.pdt-generator-agent');
            agentSelect.value = 'bot-1';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            const warnings = [...ctx.el.querySelectorAll('.pdt-generator-check-warning')].map(w => w.textContent);
            expect(warnings).toHaveLength(3);
            expect(warnings[0]).toMatch(/no description/i);
            expect(warnings[1]).toMatch(/same description/i);
            expect(warnings[2]).toMatch(/same description/i);
        });

        // Modern agents have no topics, so offering one would generate a reference to something
        // that cannot exist.
        it('should offer topics for a classic agent and never for a modern one', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'generator');
            await flush();

            const topicComponent = { id: 't1', name: 'Greeting', schemaName: 'p.topic.Greeting', componentType: 9, description: 'Says hello.' };
            DataService.getAgentComponents.mockResolvedValueOnce([topicComponent]);
            const agentSelect = ctx.el.querySelector('.pdt-generator-agent');
            agentSelect.value = 'bot-1'; // modern — a modern agent has no topics to offer
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();
            expect(tab._genState.agentComponents).toEqual([]);

            DataService.getAgentComponents.mockResolvedValueOnce([topicComponent]);
            ctx.el.querySelector('.pdt-generator-agent').value = 'bot-2'; // classic — offers its topic
            ctx.el.querySelector('.pdt-generator-agent').dispatchEvent(new Event('change', { bubbles: true }));
            await flush();
            expect(tab._genState.agentComponents.map(c => c.name)).toEqual(['Greeting']);
            expect([...ctx.el.querySelectorAll('.pdt-generator-check-group')].map(g => g.textContent)).toEqual(['Topics']);
        });

        // Offering a topic and referencing one are different questions: a classic agent has topics
        // to offer, but composing for modern must not emit a reference to one.
        it('should drop topic references when composing for a modern agent', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'generator');
            await flush();

            DataService.getAgentComponents.mockResolvedValueOnce([
                { id: 't1', name: 'Greeting', schemaName: 'p.topic.Greeting', componentType: 9, description: 'Says hello.' },
                { id: 'a1', name: 'Get order', schemaName: 'p.action.Get', componentType: 9, description: 'Reads orders.' }
            ]);
            const agentSelect = ctx.el.querySelector('.pdt-generator-agent');
            agentSelect.value = 'bot-2'; // classic agent, so both are offered
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            const topicBox = [...ctx.el.querySelectorAll('.pdt-generator-agenttool')].find(i => i.value === 't1');
            topicBox.checked = true;
            topicBox.dispatchEvent(new Event('change', { bubbles: true }));

            const output = () => ctx.el.querySelector('.pdt-generator-output-pre code').textContent;
            expect(output()).toContain('Greeting topic');

            chooseKind(ctx, 'modern');
            expect(output()).not.toContain('Greeting');
            expect(output()).toContain('`Get order`');
        });

        it('should adopt the grounding agent\'s experience while leaving the choice open', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'generator');
            await flush();

            const kindSelect = ctx.el.querySelector('.pdt-templates-kind');
            expect(kindSelect.disabled).toBe(false);

            const agentSelect = ctx.el.querySelector('.pdt-generator-agent');
            expect([...agentSelect.options].map(o => o.textContent)).toContain('Sales Copilot (Modern)');
            agentSelect.value = 'bot-1';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            expect(tab._tplState.kind).toBe('modern');
            // Never locked from here — the tool-hints picker only lends tool names.
            expect(ctx.el.querySelector('.pdt-templates-kind').disabled).toBe(false);

            // Clearing the agent leaves the type it picked — it is a setting now, not a side effect.
            ctx.el.querySelector('.pdt-generator-agent').value = '';
            ctx.el.querySelector('.pdt-generator-agent').dispatchEvent(new Event('change', { bubbles: true }));
            await flush();
            expect(tab._tplState.kind).toBe('modern');
            expect(ctx.el.querySelector('.pdt-templates-kind').disabled).toBe(false);
        });

        it('should review pasted instructions against the docs rules with severity badges', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');

            const textarea = ctx.el.querySelector('.pdt-review-text');
            textarea.value = 'Format citations as footnotes. Ask the user to type it in the typing box.';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            const findings = [...ctx.el.querySelectorAll('.pdt-review-finding')];
            expect(findings.length).toBeGreaterThanOrEqual(2);
            expect(findings[0].classList.contains('pdt-review-finding--error')).toBe(true);
            expect(findings[0].textContent).toContain('Error');

            textarea.value = 'Answer order questions from the connected knowledge.';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            expect(ctx.el.querySelector('.pdt-review-allclear')).toBeTruthy();
        });

        it('should fill Review with the built-in flawed example on demand', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');

            ctx.el.querySelector('[data-action="review-example"]').click();
            expect(ctx.el.querySelector('.pdt-review-text').value).toContain('Format citations');
            const findings = [...ctx.el.querySelectorAll('.pdt-review-finding')];
            expect(findings.length).toBeGreaterThanOrEqual(5);
        });

        it('should load an agent\'s instructions into Review and offer the definition shortcut', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');
            await flush(); // agent select population

            const openBtn = ctx.el.querySelector('[data-action="review-open-agent"]');
            const exampleBtn = ctx.el.querySelector('[data-action="review-example"]');
            expect(openBtn.style.display).toBe('none');
            expect(exampleBtn.style.display).not.toBe('none'); // example offered while no agent selected

            const agentSelect = ctx.el.querySelector('.pdt-review-agent');
            agentSelect.value = 'bot-1';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            // bot-1's legacy Custom GPT component holds the instructions (config has none).
            expect(ctx.el.querySelector('.pdt-review-text').value).toContain('You are a helpful sales agent.');
            expect(openBtn.style.display).not.toBe('none');
            expect(exampleBtn.style.display).toBe('none'); // example hidden once an agent is the source

            openBtn.click();
            await flush();
            expect(document.querySelector('#pdt-dialog-overlay')).toBeTruthy();
        });

        it('should let pasted text be reviewed as a classic or a modern agent', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');

            const kindSelect = ctx.el.querySelector('.pdt-templates-kind');
            expect(kindSelect.value).toBe('any');
            expect([...kindSelect.options].map(o => o.value)).toEqual(['any', 'classic', 'modern']);

            const textarea = ctx.el.querySelector('.pdt-review-text');
            textarea.value = "If you don't know the answer, say exactly: sorry, no idea.";
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            const fallbackShown = () => [...ctx.el.querySelectorAll('.pdt-review-finding')]
                .some(f => /Fallback system topic/i.test(f.textContent));
            expect(fallbackShown()).toBe(true);

            // A modern agent has no topics, so the classic-only advice must not be offered.
            kindSelect.value = 'modern';
            kindSelect.dispatchEvent(new Event('change', { bubbles: true }));
            expect(fallbackShown()).toBe(false);

            kindSelect.value = 'classic';
            kindSelect.dispatchEvent(new Event('change', { bubbles: true }));
            expect(fallbackShown()).toBe(true);
        });

        it('should badge experience-specific findings only while reviewing any agent type', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');

            const textarea = ctx.el.querySelector('.pdt-review-text');
            textarea.value = "If you don't know the answer, say exactly: sorry, no idea.";
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            const badge = ctx.el.querySelector('.pdt-scope-badge');
            expect(badge.textContent).toBe('Classic only');
            expect(ctx.el.querySelector('.pdt-agent-def-heading').textContent).toContain('any agent type');

            const kindSelect = ctx.el.querySelector('.pdt-templates-kind');
            kindSelect.value = 'classic';
            kindSelect.dispatchEvent(new Event('change', { bubbles: true }));
            expect(ctx.el.querySelector('.pdt-scope-badge')).toBeNull();
            expect(ctx.el.querySelector('.pdt-agent-def-heading').textContent).toContain('a classic agent');
        });

        it('should link each finding to the Microsoft Learn page behind the rule', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');

            const textarea = ctx.el.querySelector('.pdt-review-text');
            textarea.value = 'Format citations as footnotes at the end.';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            const link = ctx.el.querySelector('.pdt-review-finding-doc');
            expect(link.href).toContain('learn.microsoft.com');
            expect(link.target).toBe('_blank');
            expect(link.rel).toBe('noopener noreferrer');
        });

        it('should state how many checks passed on an all-clear', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');

            const textarea = ctx.el.querySelector('.pdt-review-text');
            textarea.value = 'Answer order questions from the connected knowledge.';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            expect(ctx.el.querySelector('.pdt-review-allclear').textContent)
                .toMatch(/passed all \d+ checks for any agent type/i);
        });

        it('should set the agent type from the loaded agent (modern vs classic)', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');
            await flush();

            const agentSelect = ctx.el.querySelector('.pdt-review-agent');
            const kindSelect = ctx.el.querySelector('.pdt-templates-kind');

            agentSelect.value = 'bot-1'; // template cliagent-* → modern
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();
            expect(kindSelect.value).toBe('modern');
            expect(tab._tplState.kind).toBe('modern');

            DataService.getAgentConfiguration.mockResolvedValueOnce(null);
            agentSelect.value = 'bot-2'; // template empty-* → classic
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();
            expect(kindSelect.value).toBe('classic');

            // Clearing the selection drops the agent's resources; the type it picked stays.
            agentSelect.value = '';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();
            expect(kindSelect.value).toBe('classic');
            expect(tab._reviewResources).toEqual([]);
        });

        it('should tag each agent in the Review list with its experience', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');
            await flush();

            const labels = [...ctx.el.querySelectorAll('.pdt-review-agent option')].map(o => o.textContent);
            expect(labels).toContain('Sales Copilot (Modern)');
            expect(labels).toContain('HR Bot (Classic)');
        });

        // The type is only ever pre-selected for the user — the control is never taken away.
        it('should never disable the agent-type select', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');
            await flush();

            const kindSelect = ctx.el.querySelector('.pdt-templates-kind');
            const agentSelect = ctx.el.querySelector('.pdt-review-agent');
            expect(kindSelect.disabled).toBe(false);

            agentSelect.value = 'bot-1';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();
            expect(kindSelect.value).toBe('modern');
            expect(kindSelect.disabled).toBe(false);

            agentSelect.value = '';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();
            expect(kindSelect.disabled).toBe(false);
        });

        it('should keep the detected type after leaving and returning to the Review segment', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');
            await flush();

            const agentSelect = ctx.el.querySelector('.pdt-review-agent');
            agentSelect.value = 'bot-1';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            await switchMode(ctx, 'library');
            await switchMode(ctx, 'review');
            await flush();
            expect(ctx.el.querySelector('.pdt-templates-kind').value).toBe('modern');
        });

        it('should give the user their own text back when the agent selection is cleared', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');
            await flush();

            const textarea = ctx.el.querySelector('.pdt-review-text');
            textarea.value = 'My own draft instructions.';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            const agentSelect = ctx.el.querySelector('.pdt-review-agent');
            agentSelect.value = 'bot-1';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();
            expect(textarea.value).toContain('You are a helpful sales agent.');

            agentSelect.value = '';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();
            expect(textarea.value).toBe('My own draft instructions.');
            expect(tab._reviewText).toBe('My own draft instructions.');
        });

        it('should clear the box when nothing was pasted before the agent was loaded', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');
            await flush();

            const agentSelect = ctx.el.querySelector('.pdt-review-agent');
            agentSelect.value = 'bot-1';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            agentSelect.value = '';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();
            expect(ctx.el.querySelector('.pdt-review-text').value).toBe('');
            expect(ctx.el.querySelector('.pdt-review-finding')).toBeNull();
        });

        it('should not overwrite the pasted text when switching between two agents', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');
            await flush();

            const textarea = ctx.el.querySelector('.pdt-review-text');
            textarea.value = 'My own draft instructions.';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            const agentSelect = ctx.el.querySelector('.pdt-review-agent');
            agentSelect.value = 'bot-1';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();
            DataService.getAgentConfiguration.mockResolvedValueOnce(null);
            agentSelect.value = 'bot-2';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            agentSelect.value = '';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();
            expect(textarea.value).toBe('My own draft instructions.');
        });

        it('should empty the box, not keep stale text, when the agent has no instructions', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');
            await flush();

            const textarea = ctx.el.querySelector('.pdt-review-text');
            textarea.value = 'Format citations as footnotes.';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            expect(ctx.el.querySelector('.pdt-review-finding')).toBeTruthy();

            DataService.getAgentConfiguration.mockResolvedValueOnce(null);
            DataService.getAgentComponents.mockResolvedValueOnce([]);
            const agentSelect = ctx.el.querySelector('.pdt-review-agent');
            agentSelect.value = 'bot-1';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            expect(NotificationService.show).toHaveBeenCalledWith(expect.stringMatching(/no instructions/i), 'info');
            expect(textarea.value).toBe('');
            expect(ctx.el.querySelector('.pdt-review-finding')).toBeNull();
            // The selection still stands, so its type stays picked — and stays editable.
            expect(ctx.el.querySelector('.pdt-templates-kind').value).toBe('modern');
            expect(ctx.el.querySelector('.pdt-templates-kind').disabled).toBe(false);
        });

        it('should undo the selection and restore the pasted text when a load fails', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');
            await flush();

            const textarea = ctx.el.querySelector('.pdt-review-text');
            textarea.value = 'My own draft instructions.';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            DataService.getAgentConfiguration.mockImplementationOnce(() => {
                throw new Error('network down');
            });
            const agentSelect = ctx.el.querySelector('.pdt-review-agent');
            agentSelect.value = 'bot-1';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            expect(NotificationService.show).toHaveBeenCalledWith(expect.stringMatching(/network down/), 'error');
            expect(agentSelect.value).toBe('');
            expect(textarea.value).toBe('My own draft instructions.');
            expect(ctx.el.querySelector('.pdt-templates-kind').disabled).toBe(false);
        });

        it('should ignore a slow agent load that lands after a newer selection', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');
            await flush();

            let releaseFirst;
            DataService.getAgentConfiguration
                .mockImplementationOnce(() => new Promise(resolve => {
                    releaseFirst = () => resolve(null);
                }))
                .mockImplementationOnce(() => Promise.resolve(null));
            DataService.getAgentComponents
                .mockResolvedValueOnce([{ id: 'x', schemaName: 'a.gpt.d', componentType: 15, data: 'FIRST agent text.' }])
                .mockResolvedValueOnce([{ id: 'y', schemaName: 'b.gpt.d', componentType: 15, data: 'SECOND agent text.' }]);

            const agentSelect = ctx.el.querySelector('.pdt-review-agent');
            agentSelect.value = 'bot-1';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            agentSelect.value = 'bot-2';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();
            expect(ctx.el.querySelector('.pdt-review-text').value).toBe('SECOND agent text.');

            releaseFirst();
            await flush();
            expect(ctx.el.querySelector('.pdt-review-text').value).toBe('SECOND agent text.');
            expect(ctx.el.querySelector('.pdt-templates-kind').value).toBe('classic'); // bot-2's type held
        });

        it('should flag instructions that reference a tool the loaded agent does not have', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');
            await flush();

            DataService.getAgentConfiguration.mockResolvedValueOnce(null);
            DataService.getAgentComponents.mockResolvedValueOnce([
                {
                    id: 'c-1', name: 'Instructions', schemaName: 'cr_bot.gpt.default', componentType: 15,
                    data: 'For refunds, use /Refund_Bot. For greetings, use /Greeting.'
                },
                { id: 'c-2', name: 'Greeting', schemaName: 'cr_bot.topic.Greeting', componentType: 9, data: '' }
            ]);

            const agentSelect = ctx.el.querySelector('.pdt-review-agent');
            agentSelect.value = 'bot-1';
            agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await flush();

            const findings = [...ctx.el.querySelectorAll('.pdt-review-finding')];
            const unresolved = findings.find(f => /not configured on this agent/i.test(f.textContent));
            expect(unresolved.textContent).toContain('Refund_Bot');
            expect(unresolved.textContent).not.toContain('/Greeting'); // that topic does exist
        });

        // The example is a Review-local demo; with the agent type now shared by all three segments,
        // that button must not silently re-scope the Library and the Generator.
        it('should review the built-in example without changing the shared agent type', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openTemplates(ctx);
            await switchMode(ctx, 'review');
            await flush();

            const kindSelect = ctx.el.querySelector('.pdt-templates-kind');
            kindSelect.value = 'modern';
            kindSelect.dispatchEvent(new Event('change', { bubbles: true }));

            ctx.el.querySelector('[data-action="review-example"]').click();
            expect(kindSelect.value).toBe('modern');
            expect(tab._tplState.kind).toBe('modern');
            expect(tab._reviewResources).toEqual([]);
            expect(ctx.el.querySelector('.pdt-review-text').value).toContain('Format citations');
        });
    });

    describe('card filtering', () => {
        it('should show an empty-state note when no agents match, and remove it when they do', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            const search = ctx.el.querySelector('.pdt-agents-search[data-scope="agents"]');
            search.value = 'zzz-no-such-agent';
            tab._filterCards();
            const note = ctx.el.querySelector('.pdt-agent-cards-empty');
            expect(note).toBeTruthy();
            expect(note.textContent).toMatch(/no agents match/i);
            search.value = '';
            tab._filterCards();
            expect(ctx.el.querySelector('.pdt-agent-cards-empty')).toBeNull();
        });
    });

    describe('agent map', () => {
        /** Opens bot-1's definition dialog and activates its Map sub-tab (built lazily on open). */
        async function openMapTab(ctx) {
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            [...document.querySelectorAll('.pdt-agent-def-tabs .pdt-sub-tab')]
                .find(t => t.dataset.tab === 'map')
                .click();
            await flush();
        }

        it('should not fetch a connected agent\'s components until the Map tab is opened (lazy)', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            // The main agent's components load up front, but building the map — which auto-expands
            // connected agents — is deferred, so the connected child is not fetched yet.
            expect(document.querySelector('.pdt-agent-map-node')).toBeNull();
            expect(DataService.getAgentComponents).not.toHaveBeenCalledWith('bot-2');

            [...document.querySelectorAll('.pdt-agent-def-tabs .pdt-sub-tab')]
                .find(t => t.dataset.tab === 'map')
                .click();
            await flush();
            expect(document.querySelector('.pdt-agent-map-node')).toBeTruthy();
            expect(DataService.getAgentComponents).toHaveBeenCalledWith('bot-2');
        });

        it('should render the map with the agent node and a connected-agent chip', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openMapTab(ctx);
            expect(document.querySelector('.pdt-agent-map-node')).toBeTruthy();
            // The connected agent (schemaName `.agent.`) is surfaced, with its description from the YAML as a tooltip
            const agentChip = [...document.querySelectorAll('.pdt-agent-map-chip')].find(c => c.textContent === 'Agent');
            expect(agentChip).toBeTruthy();
            expect(agentChip.title).toBe('Test child agent');
        });

        it('should group components into a Connected agents section', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openMapTab(ctx);
            const headings = [...document.querySelectorAll('.pdt-agent-def-heading')].map(h => h.textContent);
            expect(headings.some(h => h.startsWith('Connected agents'))).toBe(true);
        });

        it('should let a connected published agent be opened (navigate) and expanded by default', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openMapTab(ctx);

            // 'HR Bot' (InvokeConnectedAgentTaskAction) resolves to cached agent bot-2 -> expandable node
            const openBtn = document.querySelector('.pdt-agent-map-open');
            expect(openBtn).toBeTruthy();

            // Top-level connected agents expand by default: the child structure is loaded on open.
            expect(DataService.getAgentComponents).toHaveBeenCalledWith('bot-2');
            expect(document.querySelector('.pdt-agent-map-children .pdt-agent-map-node')).toBeTruthy();

            // Collapsing then re-expanding does not reload (already loaded).
            DataService.getAgentComponents.mockClear();
            const expandBtn = document.querySelector('.pdt-agent-map-expand');
            expandBtn.click();
            await flush();
            expect(document.querySelector('.pdt-agent-map-children').style.display).toBe('none');
            expandBtn.click();
            await flush();
            expect(DataService.getAgentComponents).not.toHaveBeenCalled();

            // Open: navigates the dialog to that agent
            openBtn.click();
            await flush();
            expect(DataService.getAgentComponents).toHaveBeenCalledWith('bot-2');
        });

        it('should surface a modern ConnectedAgentTool as a connected agent, resolved by botSchemaName', async () => {
            // A modern connection is an `.action.` component; its display name intentionally does NOT
            // match any agent, so resolution must come from the `botSchemaName` in the data (→ bot-2).
            DataService.getAgentComponents.mockResolvedValueOnce([
                { id: 'c-ca', name: 'HR (connected)', schemaName: 'cr297_parent.action.new_hrbot_x', componentType: 9, componentTypeLabel: 'Topic (V2)', description: '', content: '', data: 'kind: ConnectedAgentTool\r\nhistoryType:\r\n  kind: ConversationHistory\r\n\r\nbotSchemaName: new_hrbot', isManaged: false, statecode: 0 }
            ]);
            const ctx = await renderTab();
            tab = ctx.tab;
            await openMapTab(ctx);

            // It lands in the Connected agents branch (not Tools), with an Open button resolved to bot-2.
            const branchLabels = [...document.querySelectorAll('.pdt-agent-map-branch-label')].map(l => l.textContent);
            expect(branchLabels.some(l => l.startsWith('Connected agents'))).toBe(true);
            const openBtn = document.querySelector('.pdt-agent-map-open');
            expect(openBtn).toBeTruthy();

            DataService.getAgentComponents.mockClear();
            openBtn.click();
            await flush();
            expect(DataService.getAgentComponents).toHaveBeenCalledWith('bot-2');
        });

        it('should resolve a legacy connection whose botSchemaName drops the environment suffix', () => {
            // Legacy InvokeConnectedAgentTaskAction references the "friendly" schema (no `_<suffix>`),
            // while the real bot carries the suffix — a boundary-safe prefix match bridges the two.
            tab = new AgentsTab();
            tab.agents = [
                { id: 'bot-9', name: 'Power-Toolkit Agent As', schemaName: 'cr297_powertoolkitagenta_ab12cd' }
            ];
            const legacy = {
                name: 'Power-Toolkit Agent A',
                data: 'kind: TaskDialog\naction:\n  kind: InvokeConnectedAgentTaskAction\n  botSchemaName: cr297_PowerToolkitAgentA'
            };
            // Neither the exact schema nor the display name matches, but the suffix-tolerant match does.
            expect(tab._findConnectedAgent(legacy)).toEqual(expect.objectContaining({ id: 'bot-9' }));

            // The `_` boundary keeps a friendly schema from matching an unrelated longer schema.
            tab.agents = [{ id: 'bot-x', name: 'X', schemaName: 'cr297_powertoolkitagentabc_ab12cd' }];
            expect(tab._findConnectedAgent(legacy)).toBeNull();
        });

        it('should resolve a drifted legacy connection via the embedded modelDisplayName', () => {
            // The connection reference is stale: neither its botSchemaName nor the component name
            // matches the target (renamed "Agent A" -> "Agent As"), but the embedded modelDisplayName
            // still carries the real name.
            tab = new AgentsTab();
            tab.agents = [
                { id: 'bot-9', name: 'Power-Toolkit Agent As', schemaName: 'cr297_pta_zzz' }
            ];
            const drifted = {
                name: 'Power-Toolkit Agent A',
                data: 'kind: TaskDialog\nmodelDisplayName: Power-Toolkit Agent As\naction:\n  kind: InvokeConnectedAgentTaskAction\n  botSchemaName: cr297_totallydifferent'
            };
            expect(tab._findConnectedAgent(drifted)).toEqual(expect.objectContaining({ id: 'bot-9' }));
        });

        it('should flag an orphaned connection (botSchemaName not in the environment) as unresolved', async () => {
            // A real connection whose target bot does not exist in this environment.
            DataService.getAgentComponents.mockResolvedValueOnce([
                { id: 'c-orphan', name: 'Power-Toolkit Agent A', schemaName: 'cr297_parent.InvokeConnectedAgentTaskAction.PTA', componentType: 9, componentTypeLabel: 'Topic (V2)', description: '', content: '', data: 'kind: TaskDialog\nmodelDisplayName: Power-Toolkit Agent As\naction:\n  kind: InvokeConnectedAgentTaskAction\n  botSchemaName: cr297_missingagent', isManaged: false, statecode: 0 }
            ]);
            const ctx = await renderTab();
            tab = ctx.tab;
            await openMapTab(ctx);

            const orphan = document.querySelector('.pdt-agent-map-chip--unresolved');
            expect(orphan).toBeTruthy();
            expect(orphan.textContent).toBe('Power-Toolkit Agent A');
            expect(orphan.title).toContain('cr297_missingagent');
            // It is a non-interactive span, not an openable link.
            expect(orphan.tagName).toBe('SPAN');
        });
    });

    describe('activity', () => {
        /** Opens bot-1's definition dialog and activates its Activity sub-tab. */
        async function openActivityTab(ctx) {
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            [...document.querySelectorAll('.pdt-agent-def-tabs .pdt-sub-tab')]
                .find(t => t.dataset.tab === 'activity')
                .click();
            await flush();
        }

        it('should show the Activity tab with a recent-changes timeline', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            const activityTab = [...document.querySelectorAll('.pdt-agent-def-tabs .pdt-sub-tab')]
                .find(t => t.dataset.tab === 'activity');
            expect(activityTab).toBeTruthy();
            // Recent component change is listed
            expect(document.querySelector('.pdt-agent-activity-row')).toBeTruthy();

            // The standalone "Open analytics" button was removed; the card's Open in Copilot Studio covers it.
            const analyticsBtn = [...document.querySelectorAll('.pdt-agent-def-panel button')]
                .find(b => b.textContent === 'Open analytics in Copilot Studio');
            expect(analyticsBtn).toBeUndefined();
        });

        it('should not query session analytics until the Activity tab is opened (lazy)', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();
            expect(DataService.getAgentUsage).not.toHaveBeenCalled();
        });

        it('should render Dataverse-native session analytics (stats, sparkline, channels)', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            await openActivityTab(ctx);

            expect(DataService.getAgentUsage).toHaveBeenCalledWith('bot-1');
            expect(DataService.getAgentUsage).toHaveBeenCalledTimes(1);
            // Re-opening the Activity tab must not refetch.
            [...document.querySelectorAll('.pdt-agent-def-tabs .pdt-sub-tab')]
                .find(t => t.dataset.tab === 'overview').click();
            [...document.querySelectorAll('.pdt-agent-def-tabs .pdt-sub-tab')]
                .find(t => t.dataset.tab === 'activity').click();
            await flush();
            expect(DataService.getAgentUsage).toHaveBeenCalledTimes(1);
            const usage = document.querySelector('.pdt-agent-usage');
            expect(usage).toBeTruthy();
            expect(usage.querySelectorAll('.pdt-agent-runs-stat-value')).toHaveLength(3); // sessions / 7d / 30d
            expect(usage.querySelectorAll('.pdt-agent-usage-spark-bar')).toHaveLength(14);
            expect(usage.textContent).toContain('PVA: 8');
        });

        it('should show publish readiness (unpublished changes since last publish) + Published by', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            // bot-1 published 2026-01-05; component c-2 modified 2026-06-04 → 1 unpublished change.
            const status = document.querySelector('.pdt-agent-publish-status');
            expect(status).toBeTruthy();
            expect(status.classList.contains('pdt-agent-publish-status--pending')).toBe(true);
            expect(status.textContent).toContain('1 unpublished change');
            // Published by is shown in the same (Activity) panel, and the changed component is tagged.
            const activityPanel = status.closest('.pdt-agent-def-panel');
            expect(activityPanel.textContent).toContain('Published by');
            expect(document.querySelector('.pdt-agent-unpublished-tag')).toBeTruthy();
        });

        it('should show the composition (per-kind counts, instructions excluded)', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('.pdt-agent-card [data-action="view-def"]').click();
            await flush();

            const comp = document.querySelector('.pdt-agent-composition');
            expect(comp).toBeTruthy();
            const badges = [...comp.querySelectorAll('.pdt-capi-badge')].map(b => b.textContent);
            expect(badges).toContain('Topic × 1');
            expect(badges).toContain('Connected agent × 2');
            expect(badges).toContain('Knowledge × 1');
            expect(badges).toContain('Test × 1');
            expect(badges.join(' ')).not.toContain('Instructions');
        });

        it('should explain an empty usage panel using the environment settings', async () => {
            DataService.getAgentUsage.mockResolvedValueOnce({
                sampled: 0, capped: false, last7: 0, last30: 0, byChannel: [], daily: []
            });
            DataService.getOrganizationDiagnostics.mockResolvedValueOnce({
                pluginTraceLogSetting: null, transcriptRecordingBlocked: true,
                transcriptAccessBlocked: false, flowRunRetentionSeconds: null
            });
            const ctx = await renderTab();
            tab = ctx.tab;
            await openActivityTab(ctx);

            const usage = document.querySelector('.pdt-agent-usage');
            expect(usage.textContent).toContain('turned off');
        });
    });

    describe('cross-agent search', () => {
        it('should search across agents and group matches by agent', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="search"]').click();
            await flush();
            const input = ctx.el.querySelector('.pdt-agents-cross-search');
            expect(input).toBeTruthy();
            input.value = 'greet';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await flush();
            expect(DataService.searchAgentComponents).toHaveBeenCalledWith('greet');
            const group = ctx.el.querySelector('.pdt-agents-search-group');
            expect(group).toBeTruthy();
            expect(group.dataset.agentId).toBe('bot-1');
            expect(group.textContent).toContain('Greeting Topic');
        });

        it('should open the matching agent definition from a result', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="search"]').click();
            await flush();
            const input = ctx.el.querySelector('.pdt-agents-cross-search');
            input.value = 'greet';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await flush();
            ctx.el.querySelector('.pdt-agents-search-group [data-action="view-def"]').click();
            await flush();
            expect(DialogService.show).toHaveBeenCalled();
            expect(DataService.getAgentComponents).toHaveBeenCalledWith('bot-1');
        });

        // The placeholder already says what to type, so repeating it underneath is noise.
        it('should not repeat the placeholder as a note before searching', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="search"]').click();
            await flush();

            expect(ctx.el.querySelector('#pdt-agents-search-results').textContent.trim()).toBe('');
            expect(ctx.el.querySelector('.pdt-agents-cross-search').placeholder)
                .toMatch(/type at least two characters/i);
        });

        it('should prompt when the term is too short and not call the service', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="search"]').click();
            await flush();
            const input = ctx.el.querySelector('.pdt-agents-cross-search');
            input.value = 'a';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await flush();
            expect(DataService.searchAgentComponents).not.toHaveBeenCalled();
            expect(ctx.el.querySelector('#pdt-agents-search-results .pdt-note')).toBeTruthy();
        });
    });

    describe('error handling', () => {
        it('should show an error message when agents fail to load', async () => {
            DataService.getAgents.mockRejectedValueOnce(new Error('boom'));
            const ctx = await renderTab();
            tab = ctx.tab;
            const list = ctx.el.querySelector('#pdt-agents-list');
            expect(list.querySelector('.pdt-error')).toBeTruthy();
        });
    });

    describe('cleanup', () => {
        it('should not throw when destroyed', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            expect(() => tab.destroy()).not.toThrow();
        });

        it('should handle destroy when never rendered', () => {
            tab = new AgentsTab();
            expect(() => tab.destroy()).not.toThrow();
        });

        // The header Refresh clears DataService's cache and re-renders this same instance, so the
        // tab's own arrays have to go with it — otherwise Refresh redraws stale data.
        it('should drop its data caches so a refresh re-reads from Dataverse', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            expect(DataService.getAgents).toHaveBeenCalledTimes(1);

            tab.destroy();
            expect(tab.agents).toBeNull();
            expect(tab.aiModels).toBeNull();
            expect(tab.agentFlows).toBeNull();

            const element = await tab.render();
            await tab.postRender(element);
            await flush();
            expect(DataService.getAgents).toHaveBeenCalledTimes(2);
        });

        // "Refresh Tool & Clear Cache" puts the tab back to how it opens, so nothing the user typed
        // or filtered in the previous session is left behind.
        it('should reset the workbench and the cross-agent search on a refresh', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="templates"]').click();
            await flush();

            const category = ctx.el.querySelector('.pdt-templates-category');
            category.value = 'Topic';
            category.dispatchEvent(new Event('change', { bubbles: true }));
            const templateSearch = ctx.el.querySelector('.pdt-templates-search');
            templateSearch.value = 'refund';
            templateSearch.dispatchEvent(new Event('input', { bubbles: true }));
            const kindSelect = ctx.el.querySelector('.pdt-templates-kind');
            kindSelect.value = 'modern';
            kindSelect.dispatchEvent(new Event('change', { bubbles: true }));

            ctx.el.querySelector('.pdt-templates-mode [data-mode="review"]').click();
            await flush();
            const textarea = ctx.el.querySelector('.pdt-review-text');
            textarea.value = 'Some pasted instructions.';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            tab._lastSearchTerm = 'greeting';
            tab._customizeValues.set('instr-customer-service', { Company: 'Contoso' });
            tab._generatorText = '# Role';

            tab.destroy();

            expect(tab._tplState).toEqual({ mode: 'library', category: '', subcategory: '', search: '', kind: 'any' });
            expect(tab._reviewText).toBe('');
            expect(tab._pastedReviewText).toBe('');
            expect(tab._reviewAgentId).toBe('');
            expect(tab._reviewResources).toEqual([]);
            expect(tab._genState).toBeNull();
            expect(tab._generatorText).toBe('');
            expect(tab._customizeValues.size).toBe(0);
            expect(tab._lastSearchTerm).toBe('');
            expect(tab.activeView).toBe('agents');
        });

        it('should come back on the agents view with empty fields after a refresh', async () => {
            const ctx = await renderTab();
            tab = ctx.tab;
            ctx.el.querySelector('[data-view="templates"]').click();
            await flush();
            const templateSearch = ctx.el.querySelector('.pdt-templates-search');
            templateSearch.value = 'refund';
            templateSearch.dispatchEvent(new Event('input', { bubbles: true }));

            tab.destroy();
            const element = await tab.render();
            await tab.postRender(element);
            await flush();

            expect(element.querySelector('.pdt-agents-list')).toBeTruthy(); // back on Agents
            element.querySelector('[data-view="templates"]').click();
            await flush();
            expect(element.querySelector('.pdt-templates-search').value).toBe('');
            expect(element.querySelector('.pdt-templates-category').value).toBe('');
            expect(element.querySelector('.pdt-templates-kind').value).toBe('any');
        });
    });
});
