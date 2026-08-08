/**
 * @file Tests for PowerAutomateFlowsTab component
 * @module tests/components/PowerAutomateFlowsTab.test.js
 * @description Tests for the Power Automate Flows viewer and management component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock flow data
const mockFlows = [
    {
        id: 'flow-1',
        name: 'My Active Flow',
        description: 'Triggers on account update',
        statecode: 1,
        stateLabel: 'Activated',
        isManaged: false,
        owner: 'John Doe',
        createdOn: '1/1/2026',
        modifiedOn: '1/5/2026',
        createdBy: 'John Doe',
        clientData: null
    },
    {
        id: 'flow-2',
        name: 'My Draft Flow',
        description: '',
        statecode: 0,
        stateLabel: 'Draft',
        isManaged: false,
        owner: 'Jane Smith',
        createdOn: '2/1/2026',
        modifiedOn: '2/3/2026',
        createdBy: 'Jane Smith',
        clientData: null
    },
    {
        id: 'flow-3',
        name: 'Managed Solution Flow',
        description: 'From managed solution',
        statecode: 1,
        stateLabel: 'Activated',
        isManaged: true,
        owner: 'Admin',
        createdOn: '3/1/2026',
        modifiedOn: '3/1/2026',
        createdBy: 'Admin',
        clientData: null
    }
];

const mockSolutions = [
    { solutionid: 'sol-1', friendlyname: 'Solution One', uniquename: 'sol1', ismanaged: false },
    { solutionid: 'sol-2', friendlyname: 'Solution Two', uniquename: 'sol2', ismanaged: true }
];

const mockClientData = JSON.stringify({
    properties: {
        definition: {
            triggers: {
                manual: { type: 'Request', kind: 'Button', inputs: {} }
            },
            actions: {
                List_rows: {
                    runAfter: {},
                    type: 'OpenApiConnection',
                    inputs: { host: { operationId: 'ListRecords' }, parameters: { entityName: 'accounts' } }
                },
                Compose: {
                    runAfter: { List_rows: ['Succeeded'] },
                    type: 'Compose',
                    inputs: {}
                }
            }
        },
        connectionReferences: {}
    }
});

const mockRuns = [
    {
        id: 'run-1', runId: '08580001', status: 'Succeeded', statusKey: 'succeeded',
        triggerType: 'Automated', startTime: '2026-06-28T10:00:00Z', startTimeLabel: '6/28/2026 10:00 AM',
        endTime: '2026-06-28T10:00:02Z', endTimeLabel: '6/28/2026 10:00 AM', durationMs: 2000,
        durationText: '2.0s', errorCode: '', errorMessage: '', isPrimary: true, parentRunId: '', modernFlowType: 0
    },
    {
        id: 'run-2', runId: '08580002', status: 'Failed', statusKey: 'failed',
        triggerType: 'Manual', startTime: '2026-06-28T09:00:00Z', startTimeLabel: '6/28/2026 9:00 AM',
        endTime: '2026-06-28T09:00:01Z', endTimeLabel: '6/28/2026 9:00 AM', durationMs: 1000,
        durationText: '1.0s', errorCode: 'ActionFailed', errorMessage: 'Something broke', isPrimary: true, parentRunId: '', modernFlowType: 0
    }
];

// Mock dependencies
vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        getCloudFlows: vi.fn(() => Promise.resolve(mockFlows)),
        getCloudFlowsBySolution: vi.fn(() => Promise.resolve(mockFlows)),
        getSolutionsWithFlows: vi.fn(() => Promise.resolve(mockSolutions)),
        setFlowState: vi.fn(() => Promise.resolve()),
        deleteFlow: vi.fn(() => Promise.resolve()),
        getFlowDefinition: vi.fn(() => Promise.resolve(mockClientData)),
        updateFlowDefinition: vi.fn(() => Promise.resolve()),
        getEnvironmentId: vi.fn(() => Promise.resolve('env-abc-123')),
        getFlowRuns: vi.fn(() => Promise.resolve([])),
        getFlowRunLogs: vi.fn(() => Promise.resolve([])),
        getOrganizationDiagnostics: vi.fn(() => Promise.resolve({
            pluginTraceLogSetting: null, transcriptRecordingBlocked: false,
            transcriptAccessBlocked: false, flowRunRetentionSeconds: 2419200
        }))
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/services/DialogService.js', () => ({
    DialogService: {
        show: vi.fn((title, content) => {
            const overlay = document.createElement('div');
            overlay.id = 'pdt-dialog-overlay';
            overlay.innerHTML = '<div class="pdt-dialog"><div class="pdt-dialog-content"></div></div>';
            overlay.querySelector('.pdt-dialog-content').appendChild(content);
            document.body.appendChild(overlay);
            return { close: () => overlay.remove() };
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
    BusyIndicator: {
        set: vi.fn(),
        clear: vi.fn()
    }
}));

vi.mock('../../src/helpers/index.js', () => ({
    debounce: (fn) => {
        const debounced = (...args) => fn.apply(null, args);
        debounced.cancel = vi.fn();
        return debounced;
    },
    escapeHtml: (str) => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    showConfirmDialog: vi.fn(() => Promise.resolve(true)),
    copyToClipboard: vi.fn()
}));

vi.mock('../../src/ui/UIFactory.js', () => ({
    UIFactory: {
        createFormDisabledMessage: vi.fn(() => {
            const el = document.createElement('div');
            el.textContent = 'Form context required';
            return el;
        }),
        createCopyableCodeBlock: vi.fn((content) => {
            const el = document.createElement('pre');
            el.textContent = content;
            el.className = 'copyable-code-block';
            return el;
        })
    }
}));

import { PowerAutomateFlowsTab } from '../../src/components/PowerAutomateFlowsTab.js';
import { DataService } from '../../src/services/DataService.js';
import { NotificationService } from '../../src/services/NotificationService.js';
import { BusyIndicator } from '../../src/utils/ui/BusyIndicator.js';
import { showConfirmDialog } from '../../src/helpers/index.js';

/**
 * Helper to render the tab, attach to DOM, run postRender (loads solutions),
 * select a solution, and load flows.
 */
async function renderWithFlows() {
    const tab = new PowerAutomateFlowsTab();
    const el = await tab.render();
    document.body.appendChild(el);
    await tab.postRender(el);

    // Select first solution
    tab.ui.solutionSelect.value = 'sol-1';
    await tab._onSolutionSelected();

    return { tab, el };
}

describe('PowerAutomateFlowsTab', () => {
    /** @type {PowerAutomateFlowsTab} */
    let tab;

    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        DataService.getSolutionsWithFlows.mockResolvedValue(JSON.parse(JSON.stringify(mockSolutions)));
        DataService.getCloudFlowsBySolution.mockResolvedValue(JSON.parse(JSON.stringify(mockFlows)));
        DataService.getFlowDefinition.mockResolvedValue(mockClientData);
        DataService.setFlowState.mockResolvedValue(undefined);
        DataService.getFlowRuns.mockResolvedValue(JSON.parse(JSON.stringify(mockRuns)));
        DataService.getFlowRunLogs.mockResolvedValue([]);
        localStorage.clear();
    });

    afterEach(() => {
        tab?.destroy?.();
    });

    describe('constructor', () => {
        it('should initialize with correct id and label', () => {
            tab = new PowerAutomateFlowsTab();
            expect(tab.id).toBe('powerAutomateFlows');
            expect(tab.label).toBe('Power Automate');
            expect(tab.isFormOnly).toBe(false);
        });

        it('should initialize ui, allFlows, and solutions as empty', () => {
            tab = new PowerAutomateFlowsTab();
            expect(tab.ui).toEqual({});
            expect(tab.allFlows).toEqual([]);
            expect(tab.solutions).toEqual([]);
            expect(tab.selectedSolutionId).toBeNull();
        });
    });

    describe('render', () => {
        it('should return an HTMLElement', async () => {
            tab = new PowerAutomateFlowsTab();
            const el = await tab.render();
            expect(el).toBeInstanceOf(HTMLElement);
        });

        it('should contain solution select, search input, and refresh button', async () => {
            tab = new PowerAutomateFlowsTab();
            const el = await tab.render();
            expect(el.querySelector('#pdt-flow-solution-select')).not.toBeNull();
            expect(el.querySelector('#flow-search')).not.toBeNull();
            expect(el.querySelector('#flow-refresh-btn')).not.toBeNull();
        });

        it('should have disabled refresh button initially', async () => {
            tab = new PowerAutomateFlowsTab();
            const el = await tab.render();
            expect(el.querySelector('#flow-refresh-btn').disabled).toBe(true);
        });
    });

    describe('postRender', () => {
        it('should cache UI elements and load solutions', async () => {
            tab = new PowerAutomateFlowsTab();
            const el = await tab.render();
            document.body.appendChild(el);
            await tab.postRender(el);

            expect(tab.ui.solutionSelect).not.toBeNull();
            expect(tab.ui.searchInput).not.toBeNull();
            expect(tab.ui.listContainer).not.toBeNull();
            expect(tab.ui.refreshBtn).not.toBeNull();
            expect(DataService.getSolutionsWithFlows).toHaveBeenCalled();
        });

        it('should populate solution dropdown', async () => {
            tab = new PowerAutomateFlowsTab();
            const el = await tab.render();
            document.body.appendChild(el);
            await tab.postRender(el);

            const options = tab.ui.solutionSelect.querySelectorAll('option');
            // 1 placeholder + 2 solutions
            expect(options.length).toBe(3);
            expect(options[1].value).toBe('sol-1');
            expect(options[2].value).toBe('sol-2');
        });

        it('should show notification when no solutions found', async () => {
            DataService.getSolutionsWithFlows.mockResolvedValue([]);
            tab = new PowerAutomateFlowsTab();
            const el = await tab.render();
            document.body.appendChild(el);
            await tab.postRender(el);

            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'info');
        });

        it('should show error when solution loading fails', async () => {
            DataService.getSolutionsWithFlows.mockRejectedValue(new Error('API error'));
            tab = new PowerAutomateFlowsTab();
            const el = await tab.render();
            document.body.appendChild(el);
            await tab.postRender(el);

            expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'error');
        });
    });

    describe('solution selection', () => {
        it('should load flows when solution is selected', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            expect(DataService.getCloudFlowsBySolution).toHaveBeenCalledWith('sol-1');
        });

        it('should render flow cards after solution selection', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const cards = result.el.querySelectorAll('.pdt-flow-card');
            expect(cards.length).toBe(3);
        });

        it('should enable refresh button when solution is selected', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            expect(tab.ui.refreshBtn.disabled).toBe(false);
        });

        it('should clear flows and disable refresh when placeholder selected', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            tab.ui.solutionSelect.value = '';
            await tab._onSolutionSelected();

            expect(tab.allFlows).toEqual([]);
            expect(tab.ui.refreshBtn.disabled).toBe(true);
        });
    });

    describe('flow cards', () => {
        it('should display flow names in cards', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            expect(result.el.textContent).toContain('My Active Flow');
            expect(result.el.textContent).toContain('My Draft Flow');
            expect(result.el.textContent).toContain('Managed Solution Flow');
        });

        it('should show status badges', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const badges = result.el.querySelectorAll('.pdt-status-badge');
            expect(badges.length).toBe(3);
        });

        it('should show flow ID in info grid', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const flowId = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"] .pdt-flow-id');
            expect(flowId).not.toBeNull();
            expect(flowId.textContent).toBe('flow-1');
            expect(flowId.tagName).toBe('CODE');
            expect(flowId.classList.contains('copyable')).toBe(true);
        });

        it('should show On status for active flow', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const firstBadge = result.el.querySelector('.pdt-flow-card[data-statecode="1"] .pdt-status-badge');
            expect(firstBadge.classList.contains('active')).toBe(true);
        });

        it('should show Off status for draft flow', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const draftBadge = result.el.querySelector('.pdt-flow-card[data-statecode="0"] .pdt-status-badge');
            expect(draftBadge.classList.contains('inactive')).toBe(true);
        });

        it('should show Managed badge for managed flows', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const managedCard = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-3"]');
            expect(managedCard.querySelector('.pdt-capi-badge-managed')).not.toBeNull();
        });

        it('should show Unmanaged badge for unmanaged flows', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const unmanagedCard = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"]');
            expect(unmanagedCard.querySelector('.pdt-capi-badge-unmanaged')).not.toBeNull();
        });

        it('should set isManaged dataset attribute', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const managedCard = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-3"]');
            expect(managedCard.dataset.isManaged).toBe('true');

            const unmanagedCard = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"]');
            expect(unmanagedCard.dataset.isManaged).toBe('false');
        });

        it('should show toggle but not delete for managed flows', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const managedCard = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-3"]');
            expect(managedCard.querySelector('.flow-toggle-btn')).not.toBeNull();
            expect(managedCard.querySelector('.flow-delete-btn')).toBeNull();
        });

        it('should show toggle and delete buttons for unmanaged flows', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const unmanagedCard = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"]');
            expect(unmanagedCard.querySelector('.flow-toggle-btn')).not.toBeNull();
            expect(unmanagedCard.querySelector('.flow-delete-btn')).not.toBeNull();
        });

        it('should show view definition and open in portal for all flows', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const viewBtns = result.el.querySelectorAll('.flow-view-btn');
            const openBtns = result.el.querySelectorAll('.flow-open-btn');
            expect(viewBtns.length).toBe(3);
            expect(openBtns.length).toBe(3);
        });

        it('should show empty state when no flows in solution', async () => {
            DataService.getCloudFlowsBySolution.mockResolvedValue([]);
            const result = await renderWithFlows();
            tab = result.tab;

            expect(result.el.querySelector('.pdt-note')).not.toBeNull();
        });

        it('should show error state on fetch failure', async () => {
            DataService.getCloudFlowsBySolution.mockRejectedValue(new Error('Network error'));
            const result = await renderWithFlows();
            tab = result.tab;

            expect(result.el.querySelector('.pdt-error')).not.toBeNull();
            expect(result.el.textContent).toContain('Network error');
        });

        it('should display owner and dates in card body', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            expect(result.el.textContent).toContain('John Doe');
            expect(result.el.textContent).toContain('1/1/2026');
        });
    });

    describe('toggle flow state', () => {
        it('should disable toggle button during state change', async () => {
            let resolveToggle;
            DataService.setFlowState.mockImplementation(() => new Promise(resolve => { resolveToggle = resolve; }));
            const result = await renderWithFlows();
            tab = result.tab;

            const card = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"]');
            const toggleBtn = card.querySelector('.flow-toggle-btn');
            expect(toggleBtn.disabled).toBe(false);

            const togglePromise = tab._handleToggleState(card, 'flow-1');
            expect(toggleBtn.disabled).toBe(true);

            resolveToggle();
            await togglePromise;
            expect(toggleBtn.disabled).toBe(false);
        });

        it('should re-enable toggle button after failure', async () => {
            DataService.setFlowState.mockRejectedValue(new Error('fail'));
            const result = await renderWithFlows();
            tab = result.tab;

            const card = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"]');
            const toggleBtn = card.querySelector('.flow-toggle-btn');
            await tab._handleToggleState(card, 'flow-1');
            expect(toggleBtn.disabled).toBe(false);
        });

        it('should turn off an active flow when toggle clicked', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const toggleBtn = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"] .flow-toggle-btn');
            await toggleBtn.click();
            await vi.waitFor(() => {
                expect(DataService.setFlowState).toHaveBeenCalledWith('flow-1', false);
            });
        });

        it('should turn on a draft flow when toggle clicked', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const toggleBtn = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-2"] .flow-toggle-btn');
            await toggleBtn.click();
            await vi.waitFor(() => {
                expect(DataService.setFlowState).toHaveBeenCalledWith('flow-2', true);
            });
        });

        it('should update card badge after successful toggle', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const card = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"]');
            await tab._handleToggleState(card, 'flow-1');
            expect(card.dataset.statecode).toBe('0');
        });

        it('should show success notification after toggle', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const toggleBtn = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"] .flow-toggle-btn');
            await toggleBtn.click();
            await vi.waitFor(() => {
                expect(NotificationService.show).toHaveBeenCalled();
            });
        });

        it('should show error on toggle failure', async () => {
            DataService.setFlowState.mockRejectedValue(new Error('Permission denied'));
            const result = await renderWithFlows();
            tab = result.tab;

            const toggleBtn = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"] .flow-toggle-btn');
            await toggleBtn.click();
            await vi.waitFor(() => {
                expect(NotificationService.show).toHaveBeenCalledWith(expect.stringContaining('Permission denied'), 'error');
            });
        });

        it('should always clear BusyIndicator after toggle', async () => {
            DataService.setFlowState.mockRejectedValue(new Error('fail'));
            const result = await renderWithFlows();
            tab = result.tab;

            const toggleBtn = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"] .flow-toggle-btn');
            await toggleBtn.click();
            await vi.waitFor(() => {
                expect(BusyIndicator.clear).toHaveBeenCalled();
            });
        });
    });

    describe('delete flow', () => {
        it('should show confirmation dialog before deleting', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const deleteBtn = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"] .flow-delete-btn');
            await deleteBtn.click();
            await vi.waitFor(() => {
                expect(showConfirmDialog).toHaveBeenCalled();
            });
        });

        it('should delete flow and remove card on confirmation', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const deleteBtn = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"] .flow-delete-btn');
            await deleteBtn.click();
            await vi.waitFor(() => {
                expect(DataService.deleteFlow).toHaveBeenCalledWith('flow-1');
            });
        });

        it('should not delete when confirmation is cancelled', async () => {
            showConfirmDialog.mockResolvedValue(false);
            const result = await renderWithFlows();
            tab = result.tab;

            const deleteBtn = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"] .flow-delete-btn');
            await deleteBtn.click();
            await vi.waitFor(() => {
                expect(showConfirmDialog).toHaveBeenCalled();
            });
            expect(DataService.deleteFlow).not.toHaveBeenCalled();
        });

        it('should show error notification on delete failure', async () => {
            DataService.deleteFlow.mockRejectedValue(new Error('Cannot delete'));
            showConfirmDialog.mockResolvedValue(true);
            const result = await renderWithFlows();
            tab = result.tab;

            const deleteBtn = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"] .flow-delete-btn');
            await deleteBtn.click();
            await vi.waitFor(() => {
                expect(NotificationService.show).toHaveBeenCalledWith(expect.stringContaining('Cannot delete'), 'error');
            });
        });
    });

    describe('copyable flow ID', () => {
        it('should have copyable class and tabindex on flow ID', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const flowIdEl = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"] .pdt-flow-id.copyable');
            expect(flowIdEl).not.toBeNull();
            expect(flowIdEl.classList.contains('code-like')).toBe(true);
            expect(flowIdEl.getAttribute('tabindex')).toBe('0');
            expect(flowIdEl.getAttribute('title')).toBe('Click to copy');
        });
    });

    describe('view definition', () => {
        it('should fetch flow definition and open dialog', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            const viewBtn = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"] .flow-view-btn');
            await viewBtn.click();
            await vi.waitFor(() => {
                expect(DataService.getFlowDefinition).toHaveBeenCalledWith('flow-1');
            });
        });

        it('should show warn when no definition available', async () => {
            DataService.getFlowDefinition.mockResolvedValue(null);
            const result = await renderWithFlows();
            tab = result.tab;

            const viewBtn = result.el.querySelector('.pdt-flow-card[data-flow-id="flow-1"] .flow-view-btn');
            await viewBtn.click();
            await vi.waitFor(() => {
                expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'warn');
            });
        });

        it('should show JSON editor textarea for unmanaged flows', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-1', 'My Active Flow', false);

            expect(DialogService.show).toHaveBeenCalled();
            const container = DialogService.show.mock.calls[0][1];
            expect(container.querySelector('.pdt-flow-json-textarea')).not.toBeNull();
        });

        it('should have footer actions with disabled save for unmanaged flows', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-1', 'My Active Flow', false);

            const container = DialogService.show.mock.calls[0][1];
            expect(container._footerActions).toBeDefined();
            const saveBtn = container._footerActions.querySelector('.pdt-flow-save-btn');
            const undoBtn = container._footerActions.querySelector('.pdt-flow-undo-btn');
            expect(saveBtn).not.toBeNull();
            expect(saveBtn.disabled).toBe(true);
            expect(undoBtn).not.toBeNull();
            expect(undoBtn.style.display).toBe('none');
        });

        it('should enable save and show undo when json changes', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-1', 'My Active Flow', false);

            const container = DialogService.show.mock.calls[0][1];
            const textarea = container.querySelector('.pdt-flow-json-textarea');
            const saveBtn = container._footerActions.querySelector('.pdt-flow-save-btn');
            const undoBtn = container._footerActions.querySelector('.pdt-flow-undo-btn');

            // Switch to JSON tab first
            const jsonTab = container.querySelector('[data-tab="json"]');
            jsonTab.click();

            // Simulate text change
            textarea.value = '{"changed": true}';
            textarea.dispatchEvent(new Event('input'));

            expect(saveBtn.disabled).toBe(false);
            expect(undoBtn.style.display).toBe('');
        });

        it('should reset and disable save on undo click', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-1', 'My Active Flow', false);

            const container = DialogService.show.mock.calls[0][1];
            const textarea = container.querySelector('.pdt-flow-json-textarea');
            const saveBtn = container._footerActions.querySelector('.pdt-flow-save-btn');
            const undoBtn = container._footerActions.querySelector('.pdt-flow-undo-btn');
            const originalValue = textarea.value;

            // Switch to JSON tab first
            const jsonTab = container.querySelector('[data-tab="json"]');
            jsonTab.click();

            // Simulate change then undo
            textarea.value = '{"changed": true}';
            textarea.dispatchEvent(new Event('input'));
            undoBtn.click();

            expect(textarea.value).toBe(originalValue);
            expect(saveBtn.disabled).toBe(true);
            expect(undoBtn.style.display).toBe('none');
        });

        it('should have footer actions with warning note for managed flows', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-3', 'Managed Solution Flow', true);

            const container = DialogService.show.mock.calls[0][1];
            expect(container._footerActions).toBeDefined();
            const warning = container.querySelector('.pdt-flow-managed-warning');
            expect(warning).not.toBeNull();
        });

        it('should show editable textarea for managed flows', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-3', 'Managed Solution Flow', true);

            expect(DialogService.show).toHaveBeenCalled();
            const container = DialogService.show.mock.calls[0][1];
            expect(container.querySelector('.pdt-flow-json-textarea')).not.toBeNull();
        });

        it('should use wider definition container', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-1', 'My Active Flow', false);

            expect(DialogService.show).toHaveBeenCalled();
            const container = DialogService.show.mock.calls[0][1];
            expect(container.classList.contains('pdt-flow-definition-wide')).toBe(true);
        });
    });

    describe('filter', () => {
        it('should filter cards by search term', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            tab.ui.searchInput.value = 'active';
            tab._filterCards();

            const visibleCards = result.el.querySelectorAll('.pdt-flow-card:not([style*="display: none"])');
            expect(visibleCards.length).toBe(1);
        });

        it('should show all cards when search is empty', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            tab.ui.searchInput.value = '';
            tab._filterCards();

            const visibleCards = result.el.querySelectorAll('.pdt-flow-card:not([style*="display: none"])');
            expect(visibleCards.length).toBe(3);
        });
    });

    describe('refresh', () => {
        it('should reload flows for current solution', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            DataService.getCloudFlowsBySolution.mockResolvedValue([mockFlows[0]]);
            await tab._handleRefresh();

            expect(DataService.getCloudFlowsBySolution).toHaveBeenCalledTimes(2);
            const cards = result.el.querySelectorAll('.pdt-flow-card');
            expect(cards.length).toBe(1);
        });

        it('should not reload when no solution selected', async () => {
            tab = new PowerAutomateFlowsTab();
            const el = await tab.render();
            document.body.appendChild(el);
            await tab.postRender(el);

            DataService.getCloudFlowsBySolution.mockClear();
            await tab._handleRefresh();

            expect(DataService.getCloudFlowsBySolution).not.toHaveBeenCalled();
        });
    });

    describe('visual flow rendering', () => {
        it('should render trigger and action nodes', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: { manual: { type: 'Request', kind: 'Button', inputs: {} } },
                actions: {
                    ListRows: { runAfter: {}, type: 'OpenApiConnection', inputs: { host: { operationId: 'ListRecords' } } }
                }
            };

            const visual = tab._renderFlowVisual(definition);

            expect(visual.querySelectorAll('.pdt-flow-node').length).toBe(2);
            expect(visual.querySelectorAll('.pdt-flow-connector').length).toBeGreaterThan(0);
        });

        it('should reserve a right gutter and route join arrows as smooth lane curves (not over the nodes)', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: { When: { type: 'Recurrence', inputs: {} } },
                actions: {
                    A: { runAfter: {}, type: 'Compose', inputs: {} },
                    B: { runAfter: { A: ['Succeeded'] }, type: 'Compose', inputs: {} },
                    Join: { runAfter: { A: ['Succeeded'], B: ['Succeeded'] }, type: 'Compose', inputs: {} }
                }
            };

            const visual = tab._renderFlowVisual(definition);

            // One join → gutter = LANE_GAP * (1 + 1) + LANE_MARGIN = 22*2 + 28 = 72px.
            expect(visual.style.paddingRight).toBe('72px');
            // Two predecessors → two colour-matched edges, each a smooth curve (C) into a vertical lane (V).
            const edges = visual.querySelectorAll('path.pdt-flow-edge');
            expect(edges.length).toBe(2);
            const d = edges[0].getAttribute('d');
            expect(d).toContain('C');
            expect(d).toContain('V');
        });

        it('should NOT reserve a right gutter for a linear flow with no join arrows', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: { When: { type: 'Recurrence', inputs: {} } },
                actions: {
                    A: { runAfter: {}, type: 'Compose', inputs: {} },
                    B: { runAfter: { A: ['Succeeded'] }, type: 'Compose', inputs: {} }
                }
            };

            const visual = tab._renderFlowVisual(definition);

            expect(visual.style.paddingRight).toBe('');
        });

        it('should render condition branches', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: {},
                actions: {
                    CheckCondition: {
                        runAfter: {},
                        type: 'If',
                        actions: { TrueAction: { runAfter: {}, type: 'Compose', inputs: {} } },
                        else: { actions: { FalseAction: { runAfter: {}, type: 'Compose', inputs: {} } } }
                    }
                }
            };

            const visual = tab._renderFlowVisual(definition);

            expect(visual.querySelector('.pdt-flow-branches')).not.toBeNull();
            const branches = visual.querySelectorAll('.pdt-flow-branch');
            expect(branches.length).toBe(2);
        });

        it('should render scope with nested actions', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: {},
                actions: {
                    MyScope: {
                        runAfter: {},
                        type: 'Scope',
                        actions: {
                            InnerAction: { runAfter: {}, type: 'Compose', inputs: {} }
                        }
                    }
                }
            };

            const visual = tab._renderFlowVisual(definition);

            expect(visual.querySelector('.pdt-flow-scope-content')).not.toBeNull();
            const nestedNodes = visual.querySelectorAll('.pdt-flow-scope-content .pdt-flow-node');
            expect(nestedNodes.length).toBe(1);
        });

        it('should render foreach loops', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: {},
                actions: {
                    LoopItems: {
                        runAfter: {},
                        type: 'Foreach',
                        actions: {
                            ProcessItem: { runAfter: {}, type: 'Compose', inputs: {} }
                        }
                    }
                }
            };

            const visual = tab._renderFlowVisual(definition);

            expect(visual.querySelector('.pdt-flow-node--loop')).not.toBeNull();
        });

        it('should wrap scope/loop content in collapsible details', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: {},
                actions: {
                    MyScope: {
                        runAfter: {},
                        type: 'Scope',
                        actions: {
                            Inner: { runAfter: {}, type: 'Compose', inputs: {} }
                        }
                    }
                }
            };

            const visual = tab._renderFlowVisual(definition);
            const details = visual.querySelector('.pdt-flow-scope-details');
            const summary = visual.querySelector('.pdt-flow-scope-summary');

            expect(details).not.toBeNull();
            expect(details.open).toBe(true);
            expect(summary).not.toBeNull();
            expect(summary.textContent).toBe('1 action');
            expect(details.querySelector('.pdt-flow-scope-content')).not.toBeNull();
        });

        it('should wrap condition branches in collapsible details', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: {},
                actions: {
                    CheckCondition: {
                        runAfter: {},
                        type: 'If',
                        actions: { TrueAction: { runAfter: {}, type: 'Compose', inputs: {} } },
                        else: { actions: { FalseAction: { runAfter: {}, type: 'Compose', inputs: {} } } }
                    }
                }
            };

            const visual = tab._renderFlowVisual(definition);
            const conditionNode = visual.querySelector('.pdt-flow-node--condition');
            const details = conditionNode.querySelector('.pdt-flow-scope-details');
            const summary = conditionNode.querySelector('.pdt-flow-scope-summary');

            expect(details).not.toBeNull();
            expect(details.open).toBe(true);
            expect(summary.textContent).toBe('2 branches');
            expect(details.querySelector('.pdt-flow-branches')).not.toBeNull();
        });

        it('should render switch with cases', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: {},
                actions: {
                    SwitchAction: {
                        runAfter: {},
                        type: 'Switch',
                        cases: {
                            CaseA: { actions: { DoA: { runAfter: {}, type: 'Compose', inputs: {} } } },
                            CaseB: { actions: { DoB: { runAfter: {}, type: 'Compose', inputs: {} } } }
                        },
                        default: { actions: { DoDefault: { runAfter: {}, type: 'Compose', inputs: {} } } }
                    }
                }
            };

            const visual = tab._renderFlowVisual(definition);

            const branches = visual.querySelectorAll('.pdt-flow-branch');
            expect(branches.length).toBe(3);
        });

        it('should order actions by runAfter dependencies', () => {
            tab = new PowerAutomateFlowsTab();
            const actions = {
                Third: { runAfter: { Second: ['Succeeded'] }, type: 'Compose', inputs: {} },
                First: { runAfter: {}, type: 'Compose', inputs: {} },
                Second: { runAfter: { First: ['Succeeded'] }, type: 'Compose', inputs: {} }
            };

            const ordered = tab._getOrderedActions(actions);

            expect(ordered.map(a => a.name)).toEqual(['First', 'Second', 'Third']);
        });

        it('should show input summary for connector operations', () => {
            tab = new PowerAutomateFlowsTab();
            const step = { inputs: { host: { operationId: 'GetItem' } } };

            const summary = tab._getInputSummary(step);

            expect(summary).toBe('Operation: GetItem');
        });

        it('should render each runAfter predecessor as editable status toggles', () => {
            tab = new PowerAutomateFlowsTab();
            const node = tab._createFlowNode('Respond', {
                type: 'Response',
                runAfter: {
                    Create_a_Lead: ['Succeeded', 'Failed', 'TimedOut', 'Skipped'],
                    Send_Email: ['Succeeded']
                }
            }, 'action', false);

            const deps = node.querySelectorAll('.pdt-flow-node-runafter .pdt-flow-runafter-dep');
            expect(deps).toHaveLength(2);

            // Every predecessor shows all four status toggles; configured ones are checked.
            expect(deps[0].querySelector('.pdt-flow-runafter-name').textContent).toBe('Create_a_Lead');
            expect(deps[0].querySelectorAll('.pdt-runafter-toggle')).toHaveLength(4);
            expect([...deps[0].querySelectorAll('.pdt-runafter-toggle')].every(cb => cb.checked)).toBe(true);

            const sendToggles = [...deps[1].querySelectorAll('.pdt-runafter-toggle')];
            expect(sendToggles).toHaveLength(4);
            const checked = sendToggles.filter(cb => cb.checked);
            expect(checked).toHaveLength(1);
            expect(checked[0].dataset.status).toBe('Succeeded');
            expect(checked[0].getAttribute('aria-label')).toBe('Send_Email — Is successful');
        });

        it('should flag a step with more than one predecessor as a join', () => {
            tab = new PowerAutomateFlowsTab();
            const single = tab._createFlowNode('A', { runAfter: { X: ['Succeeded'] } }, 'action', false);
            const multi = tab._createFlowNode('B', { runAfter: { X: ['Succeeded'], Y: ['Failed'] } }, 'action', false);

            expect(single.querySelector('.pdt-flow-node-runafter--join')).toBeNull();
            expect(multi.querySelector('.pdt-flow-node-runafter--join')).toBeTruthy();
            expect(multi.querySelector('.pdt-flow-runafter-join').textContent).toBe('joins 2 steps');
        });

        it('should apply staged runAfter toggle edits to the parsed definition on save', () => {
            tab = new PowerAutomateFlowsTab();
            const step = { runAfter: { Create_a_Lead: ['Succeeded', 'Failed'] } };
            const node = tab._createFlowNode('Respond', step, 'action', false);
            const toggles = node.querySelectorAll('.pdt-runafter-toggle');

            [...toggles].find(cb => cb.dataset.status === 'Failed').checked = false;
            [...toggles].find(cb => cb.dataset.status === 'Skipped').checked = true;
            tab._applyRunAfterEdits(node);

            expect(step.runAfter.Create_a_Lead).toEqual(['Succeeded', 'Skipped']);
        });

        it('should drop a predecessor when all its statuses are unchecked', () => {
            tab = new PowerAutomateFlowsTab();
            const step = { runAfter: { OnlyDep: ['Succeeded'] } };
            const node = tab._createFlowNode('X', step, 'action', false);
            node.querySelectorAll('.pdt-runafter-toggle').forEach(cb => {
                cb.checked = false;
            });
            tab._applyRunAfterEdits(node);

            expect(step.runAfter.OnlyDep).toBeUndefined();
        });

        it('should remove a predecessor via its × button and drop it on save', () => {
            tab = new PowerAutomateFlowsTab();
            const step = { runAfter: { A: ['Succeeded'], B: ['Failed'] } };
            const node = tab._createFlowNode('C', step, 'action', false, ['A', 'B', 'C']);

            const removeA = node.querySelector('.pdt-flow-runafter-dep[data-dep="A"] .pdt-runafter-remove');
            tab._handleRunAfterRemove(removeA);
            expect(node.querySelector('.pdt-flow-runafter-dep[data-dep="A"]')).toBeNull();

            tab._applyRunAfterEdits(node);
            expect(step.runAfter).toEqual({ B: ['Failed'] });
        });

        it('should add a predecessor (defaulting to Succeeded) from the dropdown and persist it', () => {
            tab = new PowerAutomateFlowsTab();
            const step = { runAfter: { A: ['Succeeded'] } };
            const node = tab._createFlowNode('C', step, 'action', false, ['A', 'B', 'C']);
            const addSelect = node.querySelector('.pdt-runafter-add');

            // Only the other, not-yet-predecessor sibling (B) is offered.
            expect([...addSelect.options].map(o => o.value)).toEqual(['', 'B']);

            addSelect.value = 'B';
            tab._handleRunAfterAdd(addSelect);
            expect(node.querySelector('.pdt-flow-runafter-dep[data-dep="B"]')).toBeTruthy();
            // B is no longer offered once added.
            expect([...addSelect.options].map(o => o.value)).toEqual(['']);

            tab._applyRunAfterEdits(node);
            expect(step.runAfter).toEqual({ A: ['Succeeded'], B: ['Succeeded'] });
        });

        it('should offer only valid predecessors — never the trigger, never a cycle', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: { Recurrence: { type: 'Recurrence', inputs: {} } },
                actions: {
                    A: { runAfter: {}, type: 'Compose', inputs: {} },
                    B: { runAfter: { A: ['Succeeded'] }, type: 'Compose', inputs: {} },
                    C: { runAfter: { B: ['Succeeded'] }, type: 'Compose', inputs: {} }
                }
            };

            const visual = tab._renderFlowVisual(definition);
            const addOptions = (name) => {
                const sec = visual.querySelector(`[data-flow-node="${name}"]`).querySelector('.pdt-flow-node-runafter');
                return [...sec.querySelector('.pdt-runafter-add').options].map(o => o.value);
            };

            // C's options exclude the trigger (Recurrence) and its current predecessor (B) → only A.
            expect(addOptions('C')).toEqual(['', 'A']);
            // B's options exclude its descendant C (would create a cycle) and its predecessor A → none.
            expect(addOptions('B')).toEqual(['']);
        });

        it('should revert added/removed predecessors on undo (re-render from the definition)', () => {
            tab = new PowerAutomateFlowsTab();
            const step = { runAfter: { A: ['Succeeded'] } };
            const visualPanel = document.createElement('div');
            visualPanel.appendChild(tab._createFlowNode('C', step, 'action', false, ['A', 'B', 'C']));

            // Stage an add of B.
            const addSelect = visualPanel.querySelector('.pdt-runafter-add');
            addSelect.value = 'B';
            tab._handleRunAfterAdd(addSelect);
            expect(visualPanel.querySelector('.pdt-flow-runafter-dep[data-dep="B"]')).toBeTruthy();

            // Undo re-renders from step.runAfter (still just A), discarding the staged add.
            tab._handleDefinitionUndo({ activeTab: 'visual' }, document.createElement('textarea'), visualPanel, () => {});
            expect(visualPanel.querySelector('.pdt-flow-runafter-dep[data-dep="B"]')).toBeNull();
            expect(visualPanel.querySelector('.pdt-flow-runafter-dep[data-dep="A"]')).toBeTruthy();
        });

        it('should draw an SVG arrow from each predecessor into a join step', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: { When_email: { type: 'OpenApiConnection', inputs: {} } },
                actions: {
                    Create_a_Lead: { runAfter: {}, type: 'Compose', inputs: {} },
                    Send_Email: { runAfter: {}, type: 'Compose', inputs: {} },
                    Respond: { runAfter: { Create_a_Lead: ['Succeeded'], Send_Email: ['Failed'] }, type: 'Response', inputs: {} }
                }
            };

            const visual = tab._renderFlowVisual(definition);
            const edges = [...visual.querySelectorAll('.pdt-flow-edges path.pdt-flow-edge')];
            // One arrow per predecessor, each from the predecessor to the join node.
            expect(edges).toHaveLength(2);
            expect(edges.map(e => `${e.dataset.from}->${e.dataset.to}`).sort())
                .toEqual(['Create_a_Lead->Respond', 'Send_Email->Respond']);
            // Arrows carry a colour-matched arrowhead marker, and the same colour into this target.
            expect(edges[0].getAttribute('marker-end')).toContain('pdt-flow-arrowhead');
            expect(edges[0].dataset.colorIndex).toBe(edges[1].dataset.colorIndex);
            expect(edges[0].style.stroke).toBeTruthy();
        });

        it('should colour each target node\'s incoming arrows distinctly', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: { T: { type: 'X', inputs: {} } },
                actions: {
                    A: { runAfter: {}, type: 'Compose', inputs: {} },
                    B: { runAfter: {}, type: 'Compose', inputs: {} },
                    C: { runAfter: {}, type: 'Compose', inputs: {} },
                    Join1: { runAfter: { A: ['Succeeded'], B: ['Succeeded'] }, type: 'Compose', inputs: {} },
                    Join2: { runAfter: { B: ['Succeeded'], C: ['Succeeded'] }, type: 'Compose', inputs: {} }
                }
            };

            const visual = tab._renderFlowVisual(definition);
            const edges = [...visual.querySelectorAll('.pdt-flow-edge')];
            const colorsInto = (to) => [...new Set(edges.filter(e => e.dataset.to === to).map(e => e.dataset.colorIndex))];

            // Each target's incoming arrows share one colour…
            expect(colorsInto('Join1')).toHaveLength(1);
            expect(colorsInto('Join2')).toHaveLength(1);
            // …and the two targets use different colours.
            expect(colorsInto('Join1')[0]).not.toBe(colorsInto('Join2')[0]);
        });

        it('should not draw join edges for a single-predecessor step (keeps the inline connector)', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: { T: { type: 'X', inputs: {} } },
                actions: {
                    A: { runAfter: {}, type: 'Compose', inputs: {} },
                    B: { runAfter: { A: ['Succeeded'] }, type: 'Compose', inputs: {} }
                }
            };

            const visual = tab._renderFlowVisual(definition);
            expect(visual.querySelectorAll('.pdt-flow-edge')).toHaveLength(0);
            expect(visual.querySelectorAll('.pdt-flow-connector').length).toBeGreaterThan(0);
        });

        it('should show HTTP method and URI', () => {
            tab = new PowerAutomateFlowsTab();
            const step = { inputs: { method: 'GET', uri: 'https://api.example.com' } };

            const summary = tab._getInputSummary(step);

            expect(summary).toBe('GET https://api.example.com');
        });

        it('should show entity name for Dataverse operations', () => {
            tab = new PowerAutomateFlowsTab();
            const step = { inputs: { parameters: { entityName: 'accounts' } } };

            const summary = tab._getInputSummary(step);

            expect(summary).toBe('Table: accounts');
        });

        it('should return null for steps without inputs', () => {
            tab = new PowerAutomateFlowsTab();

            expect(tab._getInputSummary({})).toBeNull();
            expect(tab._getInputSummary({ inputs: {} })).toBeNull();
        });

        it('should show descriptive node labels for specific action types', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: {},
                actions: {
                    MyCompose: { runAfter: {}, type: 'Compose', inputs: { value: 'test' } },
                    MyHttp: { runAfter: { MyCompose: ['Succeeded'] }, type: 'Http', inputs: { method: 'GET', uri: 'https://example.com' } },
                    MyTerminate: { runAfter: { MyHttp: ['Succeeded'] }, type: 'Terminate', inputs: {} }
                }
            };

            const visual = tab._renderFlowVisual(definition);
            const labels = Array.from(visual.querySelectorAll('.pdt-flow-node-label')).map(el => el.textContent);

            expect(labels).toContain('Compose');
            expect(labels).toContain('HTTP Request');
            expect(labels).toContain('Terminate');
        });

        it('should make nodes with inputs clickable', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: {},
                actions: {
                    GetData: { runAfter: {}, type: 'OpenApiConnection', inputs: { host: { operationId: 'ListItems' } } }
                }
            };

            const visual = tab._renderFlowVisual(definition, false);
            const clickableNode = visual.querySelector('.pdt-flow-node--clickable');

            expect(clickableNode).not.toBeNull();
            expect(clickableNode.querySelector('.pdt-flow-edit-panel')).not.toBeNull();
        });

        it('should toggle edit panel on header click', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: {},
                actions: {
                    GetData: { runAfter: {}, type: 'Http', inputs: { method: 'POST', uri: 'https://api.test.com' } }
                }
            };

            const visual = tab._renderFlowVisual(definition, false);
            const node = visual.querySelector('.pdt-flow-node--clickable');
            const header = node.querySelector('.pdt-flow-node-header');
            const editPanel = node.querySelector('.pdt-flow-edit-panel');

            expect(editPanel.classList.contains('pdt-flow-edit-panel--open')).toBe(false);

            header.click();
            expect(editPanel.classList.contains('pdt-flow-edit-panel--open')).toBe(true);
            expect(node.classList.contains('pdt-flow-node--expanded')).toBe(true);

            header.click();
            expect(editPanel.classList.contains('pdt-flow-edit-panel--open')).toBe(false);
            expect(node.classList.contains('pdt-flow-node--expanded')).toBe(false);
        });

        it('should not make nodes without inputs clickable', () => {
            tab = new PowerAutomateFlowsTab();
            const definition = {
                triggers: {},
                actions: {
                    EmptyAction: { runAfter: {}, type: 'Compose', inputs: {} }
                }
            };

            const visual = tab._renderFlowVisual(definition, false);
            const clickableNode = visual.querySelector('.pdt-flow-node--clickable');

            expect(clickableNode).toBeNull();
        });
    });

    describe('node edit panel', () => {
        it('should build edit panel with editable inputs for unmanaged flows', () => {
            tab = new PowerAutomateFlowsTab();
            const step = {
                inputs: {
                    method: 'GET',
                    uri: 'https://api.example.com',
                    headers: { 'Content-Type': 'application/json' }
                }
            };

            const panel = tab._buildNodeEditPanel(step, false);

            expect(panel).not.toBeNull();
            expect(panel.classList.contains('pdt-flow-edit-panel')).toBe(true);
            const rows = panel.querySelectorAll('.pdt-flow-edit-row');
            expect(rows.length).toBe(3); // method, uri, headers.Content-Type
            const inputs = panel.querySelectorAll('.pdt-flow-edit-input');
            expect(inputs.length).toBe(3);
            expect(inputs[0].value).toBe('GET');
        });

        it('should build edit panel with editable inputs even for managed flows', () => {
            tab = new PowerAutomateFlowsTab();
            const step = {
                inputs: { method: 'GET', uri: 'https://api.example.com' }
            };

            const panel = tab._buildNodeEditPanel(step, true);

            expect(panel).not.toBeNull();
            const inputs = panel.querySelectorAll('.pdt-flow-edit-input');
            expect(inputs.length).toBe(2);
            expect(inputs[0].value).toBe('GET');
        });

        it('should return null when step has no inputs', () => {
            tab = new PowerAutomateFlowsTab();

            expect(tab._buildNodeEditPanel({}, false)).toBeNull();
            expect(tab._buildNodeEditPanel({ inputs: {} }, false)).toBeNull();
        });

        it('should show no-inputs message when inputs only have empty nested objects', () => {
            tab = new PowerAutomateFlowsTab();
            // _flattenInputs will return empty for inputs with only empty objects
            const step = { inputs: { nested: {} } };

            const panel = tab._buildNodeEditPanel(step, false);

            // Has inputs key but nested is empty, so _flattenInputs returns []
            expect(panel).not.toBeNull();
            const note = panel.querySelector('.pdt-note');
            expect(note).not.toBeNull();
        });

        it('should flatten nested inputs to dot-notation keys', () => {
            tab = new PowerAutomateFlowsTab();
            const inputs = {
                host: {
                    connectionName: 'shared_commondataservice',
                    operationId: 'CreateRecord'
                },
                parameters: {
                    entityName: 'accounts',
                    item: { name: 'Test' }
                }
            };

            const rows = tab._flattenInputs(inputs);

            expect(rows).toEqual([
                { key: 'host.connectionName', value: 'shared_commondataservice' },
                { key: 'host.operationId', value: 'CreateRecord' },
                { key: 'parameters.entityName', value: 'accounts' },
                { key: 'parameters.item.name', value: 'Test' }
            ]);
        });

        it('should stringify array values in edit panel', () => {
            tab = new PowerAutomateFlowsTab();
            const step = { inputs: { tags: ['a', 'b', 'c'] } };

            const panel = tab._buildNodeEditPanel(step, false);
            const input = panel.querySelector('.pdt-flow-edit-input');

            expect(input.value).toBe('["a","b","c"]');
        });

        it('should drill into arrays of objects so nested values are individually editable', () => {
            tab = new PowerAutomateFlowsTab();
            const inputs = { variables: [{ name: 'Endpoints', type: 'string', value: '"creates"' }] };

            const rows = tab._flattenInputs(inputs);

            expect(rows).toEqual([
                { key: 'variables.0.name', value: 'Endpoints' },
                { key: 'variables.0.type', value: 'string' },
                { key: 'variables.0.value', value: '"creates"' }
            ]);
        });

        it('should keep a primitive array as a single field (no drilling)', () => {
            tab = new PowerAutomateFlowsTab();
            expect(tab._flattenInputs({ tags: ['a', 'b', 'c'] })).toEqual([{ key: 'tags', value: ['a', 'b', 'c'] }]);
        });

        it('should save an edited nested array value to the right element without touching siblings', () => {
            tab = new PowerAutomateFlowsTab();
            const inputs = { variables: [{ name: 'Endpoints', type: 'string', value: '"creates"' }] };

            tab._setNestedValue(inputs, 'variables.0.value', '"updated"');

            expect(inputs.variables[0].value).toBe('"updated"');
            expect(inputs.variables[0].name).toBe('Endpoints');
            expect(inputs.variables[0].type).toBe('string');
        });

        it('should store step reference and original value on inputs', () => {
            tab = new PowerAutomateFlowsTab();
            const step = { inputs: { method: 'GET', uri: 'https://example.com' } };

            const panel = tab._buildNodeEditPanel(step, false);
            const inputs = panel.querySelectorAll('.pdt-flow-edit-input');

            expect(inputs[0]._stepRef).toBe(step);
            expect(inputs[0]._originalValue).toBe('GET');
            expect(inputs[1]._originalValue).toBe('https://example.com');
        });
    });

    describe('_setNestedValue', () => {
        it('should set a top-level string value', () => {
            tab = new PowerAutomateFlowsTab();
            const obj = { method: 'GET' };
            tab._setNestedValue(obj, 'method', 'POST');
            expect(obj.method).toBe('POST');
        });

        it('should set a deeply nested value', () => {
            tab = new PowerAutomateFlowsTab();
            const obj = { host: { connectionName: 'old' } };
            tab._setNestedValue(obj, 'host.connectionName', 'new');
            expect(obj.host.connectionName).toBe('new');
        });

        it('should preserve number type', () => {
            tab = new PowerAutomateFlowsTab();
            const obj = { retries: 3 };
            tab._setNestedValue(obj, 'retries', '5');
            expect(obj.retries).toBe(5);
        });

        it('should preserve boolean type', () => {
            tab = new PowerAutomateFlowsTab();
            const obj = { enabled: true };
            tab._setNestedValue(obj, 'enabled', 'false');
            expect(obj.enabled).toBe(false);
        });

        it('should parse array values from JSON', () => {
            tab = new PowerAutomateFlowsTab();
            const obj = { tags: ['a'] };
            tab._setNestedValue(obj, 'tags', '["x","y"]');
            expect(obj.tags).toEqual(['x', 'y']);
        });

        it('should create intermediate objects if missing', () => {
            tab = new PowerAutomateFlowsTab();
            const obj = {};
            tab._setNestedValue(obj, 'a.b.c', 'value');
            expect(obj.a.b.c).toBe('value');
        });
    });

    describe('visual save', () => {
        it('should enable save and show undo when visual inputs change', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-1', 'My Active Flow', false);

            const container = DialogService.show.mock.calls[0][1];
            const saveBtn = container._footerActions.querySelector('.pdt-flow-save-btn');
            const undoBtn = container._footerActions.querySelector('.pdt-flow-undo-btn');

            // Visual tab is active by default — find an editable input
            const editInput = container.querySelector('.pdt-flow-edit-input');
            if (editInput) {
                editInput.value = 'changed-value';
                editInput.dispatchEvent(new Event('input', { bubbles: true }));

                expect(saveBtn.disabled).toBe(false);
                expect(undoBtn.style.display).toBe('');
            }
        });

        it('should undo visual input changes', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-1', 'My Active Flow', false);

            const container = DialogService.show.mock.calls[0][1];
            const saveBtn = container._footerActions.querySelector('.pdt-flow-save-btn');
            const undoBtn = container._footerActions.querySelector('.pdt-flow-undo-btn');
            const editInput = container.querySelector('.pdt-flow-edit-input');

            if (editInput) {
                const originalValue = editInput._originalValue;
                editInput.value = 'changed-value';
                editInput.dispatchEvent(new Event('input', { bubbles: true }));

                undoBtn.click();

                expect(editInput.value).toBe(originalValue);
                expect(saveBtn.disabled).toBe(true);
                expect(undoBtn.style.display).toBe('none');
            }
        });

        it('should use flex display for JSON panel', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-1', 'Test Flow', false);

            const container = DialogService.show.mock.calls[0][1];
            const jsonPanel = container.querySelector('.pdt-flow-def-json');
            const jsonTabBtn = container.querySelector('[data-tab="json"]');

            jsonTabBtn.click();

            expect(jsonPanel.style.display).toBe('flex');
        });
    });

    describe('expand/collapse all', () => {
        it('should expand all edit panels and details on expand all click', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-1', 'My Active Flow', false);

            const container = DialogService.show.mock.calls[0][1];
            const expandBtn = container.querySelector('.pdt-flow-expand-all-btn');

            expandBtn.click();

            const openPanels = container.querySelectorAll('.pdt-flow-edit-panel--open');
            expect(openPanels.length).toBeGreaterThan(0);
        });

        it('should collapse all edit panels on collapse all click', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-1', 'My Active Flow', false);

            const container = DialogService.show.mock.calls[0][1];
            const expandBtn = container.querySelector('.pdt-flow-expand-all-btn');
            const collapseBtn = container.querySelector('.pdt-flow-collapse-all-btn');

            expandBtn.click();
            collapseBtn.click();

            const openPanels = container.querySelectorAll('.pdt-flow-edit-panel--open');
            expect(openPanels.length).toBe(0);
        });

        it('should close all scope details on collapse all', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-1', 'My Active Flow', false);

            const container = DialogService.show.mock.calls[0][1];
            const collapseBtn = container.querySelector('.pdt-flow-collapse-all-btn');

            collapseBtn.click();

            const openDetails = container.querySelectorAll('.pdt-flow-scope-details[open]');
            expect(openDetails.length).toBe(0);
        });
    });

    describe('managed flow editing', () => {
        it('should show managed warning note in JSON editor', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-3', 'Managed Solution Flow', true);

            const container = DialogService.show.mock.calls[0][1];
            const warning = container.querySelector('.pdt-flow-managed-warning');
            expect(warning).not.toBeNull();
            expect(warning.textContent).toContain('managed');
        });

        it('should not show warning note for unmanaged flows', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-1', 'My Active Flow', false);

            const container = DialogService.show.mock.calls[0][1];
            const warning = container.querySelector('.pdt-flow-managed-warning');
            expect(warning).toBeNull();
        });

        it('should have editable visual inputs for managed flows', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-3', 'Managed Solution Flow', true);

            const container = DialogService.show.mock.calls[0][1];
            const editInputs = container.querySelectorAll('.pdt-flow-edit-input');
            expect(editInputs.length).toBeGreaterThan(0);
        });

        it('should show warning note in visual panel above expand bar for managed flows', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-3', 'Managed Solution Flow', true);

            const container = DialogService.show.mock.calls[0][1];
            const visualPanel = container.querySelector('.pdt-flow-def-visual');
            const warning = visualPanel.querySelector('.pdt-flow-managed-warning');
            const expandBar = visualPanel.querySelector('.pdt-flow-expand-bar');
            expect(warning).not.toBeNull();
            expect(expandBar).not.toBeNull();
            // Warning should come before expand bar in DOM order
            expect(warning.compareDocumentPosition(expandBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });
    });

    describe('JSON editing', () => {
        it('should preserve JSON key order in formatting', () => {
            tab = new PowerAutomateFlowsTab();
            const json = '{"b":1,"a":2,"c":3}';
            const formatted = tab._formatJsonPreserveOrder(json);
            const parsed = JSON.parse(formatted);
            const keys = Object.keys(parsed);
            expect(keys).toEqual(['b', 'a', 'c']);
        });

        it('should return original string for invalid JSON', () => {
            tab = new PowerAutomateFlowsTab();
            const invalid = 'not json';
            expect(tab._formatJsonPreserveOrder(invalid)).toBe(invalid);
        });
    });

    describe('status helpers', () => {
        it('should return correct CSS classes for status', () => {
            tab = new PowerAutomateFlowsTab();
            expect(tab._getStatusClass(1)).toBe('active');
            expect(tab._getStatusClass(0)).toBe('inactive');
            expect(tab._getStatusClass(2)).toBe('pdt-flow-suspended');
        });
    });

    describe('open in portal', () => {
        it('should open Power Automate URL with real environment ID', async () => {
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            tab = new PowerAutomateFlowsTab();
            await tab._handleOpenInPortal('flow-123');
            expect(openSpy).toHaveBeenCalledWith(
                'https://make.powerautomate.com/environments/env-abc-123/flows/flow-123/details',
                '_blank'
            );
            openSpy.mockRestore();
        });

        it('should use fallback URL when environment ID not available', async () => {
            DataService.getEnvironmentId.mockResolvedValueOnce(null);
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            tab = new PowerAutomateFlowsTab();
            await tab._handleOpenInPortal('flow-456');
            expect(openSpy).toHaveBeenCalledWith(
                'https://make.powerautomate.com/flows/flow-456/details',
                '_blank'
            );
            openSpy.mockRestore();
        });
    });

    describe('agent flows (modernflowtype=1)', () => {
        const agentFlow = {
            id: 'af-1', name: 'Agent Flow', description: '', statecode: 1, stateLabel: 'Activated',
            isManaged: false, isAgentFlow: true, owner: 'Owner', createdOn: '1/1/2026',
            modifiedOn: '1/2/2026', createdBy: 'Owner'
        };

        it('should show an agent-flow badge only for Copilot Studio flows', () => {
            tab = new PowerAutomateFlowsTab();
            const agentCard = tab._createFlowCard(agentFlow);
            const classicCard = tab._createFlowCard({ ...agentFlow, isAgentFlow: false });
            expect(agentCard.querySelector('.pdt-capi-badge-agent-flow')).toBeTruthy();
            expect(classicCard.querySelector('.pdt-capi-badge-agent-flow')).toBeNull();
        });

        it('should label the Open button "Open in Copilot Studio" for agent flows', () => {
            tab = new PowerAutomateFlowsTab();
            const agentBtn = tab._createFlowCard(agentFlow).querySelector('.flow-open-btn');
            const classicBtn = tab._createFlowCard({ ...agentFlow, isAgentFlow: false }).querySelector('.flow-open-btn');
            expect(agentBtn.textContent.trim()).toBe('Open in Copilot Studio');
            expect(classicBtn.textContent.trim()).toBe('Open in Power Automate');
        });

        it('should open agent flows in Copilot Studio, not Power Automate', async () => {
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            tab = new PowerAutomateFlowsTab();
            tab.allFlows = [agentFlow];
            await tab._handleOpenInPortal('af-1');
            expect(openSpy).toHaveBeenCalledWith(
                expect.stringContaining('copilotstudio.microsoft.com'),
                '_blank'
            );
            expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('/agent-flows/af-1'), '_blank');
            openSpy.mockRestore();
        });
    });

    describe('_extractErrorMessage', () => {
        it('should extract detailed message from Dataverse error response', () => {
            tab = new PowerAutomateFlowsTab();
            const error = new Error('HTTP 400 Bad Request');
            error.response = {
                data: JSON.stringify({ error: { code: '0x80060888', message: 'The flow client data is invalid' } })
            };
            expect(tab._extractErrorMessage(error)).toBe('The flow client data is invalid');
        });

        it('should fall back to error.message when no response data', () => {
            tab = new PowerAutomateFlowsTab();
            const error = new Error('Network error');
            expect(tab._extractErrorMessage(error)).toBe('Network error');
        });

        it('should fall back when response.data is not valid JSON', () => {
            tab = new PowerAutomateFlowsTab();
            const error = new Error('HTTP 500 Internal Server Error');
            error.response = { data: 'not json' };
            expect(tab._extractErrorMessage(error)).toBe('HTTP 500 Internal Server Error');
        });

        it('should fall back when response.data JSON has no error.message', () => {
            tab = new PowerAutomateFlowsTab();
            const error = new Error('HTTP 403 Forbidden');
            error.response = { data: JSON.stringify({ status: 403 }) };
            expect(tab._extractErrorMessage(error)).toBe('HTTP 403 Forbidden');
        });

        it('should handle string errors gracefully', () => {
            tab = new PowerAutomateFlowsTab();
            expect(tab._extractErrorMessage('Something went wrong')).toBe('Something went wrong');
        });
    });

    describe('save button disabling', () => {
        it('should disable save and hide undo during save operation', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const { DataService } = await import('../../src/services/DataService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            // Setup: make the save take some time
            let resolveUpdate;
            DataService.updateFlowDefinition.mockReturnValue(new Promise(r => { resolveUpdate = r; }));

            await tab._handleViewDefinition('flow-1', 'My Active Flow', false);

            const container = DialogService.show.mock.calls[0][1];
            const saveBtn = container._footerActions.querySelector('.pdt-flow-save-btn');
            const undoBtn = container._footerActions.querySelector('.pdt-flow-undo-btn');
            const jsonTabBtn = container.querySelector('[data-tab="json"]');
            const textarea = container.querySelector('.pdt-flow-json-textarea');

            // Switch to JSON tab
            jsonTabBtn.click();

            // Make a change
            textarea.value = '{"changed": true}';
            textarea.dispatchEvent(new Event('input'));
            expect(saveBtn.disabled).toBe(false);

            // Click save — buttons should disable immediately
            const savePromise = saveBtn.click();
            expect(saveBtn.disabled).toBe(true);
            expect(undoBtn.style.display).toBe('none');

            // Resolve the update
            resolveUpdate();
            await savePromise;
        });

        it('should re-enable save on save failure', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const { DataService } = await import('../../src/services/DataService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            DataService.updateFlowDefinition.mockRejectedValueOnce(new Error('Save failed'));

            await tab._handleViewDefinition('flow-1', 'My Active Flow', false);

            const container = DialogService.show.mock.calls[0][1];
            const saveBtn = container._footerActions.querySelector('.pdt-flow-save-btn');
            const undoBtn = container._footerActions.querySelector('.pdt-flow-undo-btn');
            const jsonTabBtn = container.querySelector('[data-tab="json"]');
            const textarea = container.querySelector('.pdt-flow-json-textarea');

            // Switch to JSON tab and make a change
            jsonTabBtn.click();
            textarea.value = '{"changed": true}';
            textarea.dispatchEvent(new Event('input'));

            // Click save — should fail and re-enable buttons
            await saveBtn.click();

            // After failure, buttons should be re-enabled since state is still dirty
            expect(saveBtn.disabled).toBe(false);
            expect(undoBtn.style.display).toBe('');
        });

        it('should re-enable buttons when JSON parsing fails on save', async () => {
            const { DialogService } = await import('../../src/services/DialogService.js');
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewDefinition('flow-1', 'My Active Flow', false);

            const container = DialogService.show.mock.calls[0][1];
            const saveBtn = container._footerActions.querySelector('.pdt-flow-save-btn');
            const undoBtn = container._footerActions.querySelector('.pdt-flow-undo-btn');
            const jsonTabBtn = container.querySelector('[data-tab="json"]');
            const textarea = container.querySelector('.pdt-flow-json-textarea');

            // Switch to JSON tab and enter invalid JSON
            jsonTabBtn.click();
            textarea.value = 'not valid json';
            textarea.dispatchEvent(new Event('input'));

            // Click save — should fail JSON parse and re-enable buttons
            await saveBtn.click();

            expect(saveBtn.disabled).toBe(false);
            expect(undoBtn.style.display).toBe('');
        });
    });

    describe('destroy', () => {
        it('should remove event listeners without errors', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            expect(() => tab.destroy()).not.toThrow();
        });

        it('should handle destroy when not rendered', () => {
            tab = new PowerAutomateFlowsTab();
            expect(() => tab.destroy()).not.toThrow();
        });
    });

    describe('Run History sub-view', () => {
        /**
         * Renders the tab with a solution selected (shared dropdown), points the Run History flow
         * picker at flow-1, loads the (mocked) runs, and switches to the Run History sub-view.
         */
        async function renderRunsView() {
            const result = await renderWithFlows();
            const t = result.tab;
            t.ui.runFlowSelect.value = 'flow-1';
            await t._onRunFlowSelected();
            t._switchSubView('runs');
            return t;
        }

        it('should render the sub-tab switcher and a hidden runs panel by default', async () => {
            tab = new PowerAutomateFlowsTab();
            const el = await tab.render();
            expect(el.querySelector('.pdt-flow-subtabs')).not.toBeNull();
            expect(el.querySelector('[data-subview-panel="runs"]')).not.toBeNull();
            expect(el.querySelector('[data-subview-panel="runs"]').classList.contains('pdt-hidden')).toBe(true);
        });

        it('should keep the sub-tabs and Flows toolbar hidden until a solution is chosen', async () => {
            tab = new PowerAutomateFlowsTab();
            const el = await tab.render();
            document.body.appendChild(el);
            await tab.postRender(el);

            // No solution chosen yet → sub-tabs and the Flows search/refresh toolbar are hidden.
            expect(tab.ui.subTabs.classList.contains('pdt-hidden')).toBe(true);
            expect(tab.ui.flowsToolbar.classList.contains('pdt-hidden')).toBe(true);

            tab.ui.solutionSelect.value = 'sol-1';
            await tab._onSolutionSelected();
            expect(tab.ui.subTabs.classList.contains('pdt-hidden')).toBe(false);
            expect(tab.ui.flowsToolbar.classList.contains('pdt-hidden')).toBe(false);

            // Clearing the solution hides them again and returns to the Flows view.
            tab.ui.solutionSelect.value = '';
            await tab._onSolutionSelected();
            expect(tab.ui.subTabs.classList.contains('pdt-hidden')).toBe(true);
            expect(tab.ui.flowsToolbar.classList.contains('pdt-hidden')).toBe(true);
            expect(tab.activeSubView).toBe('flows');
        });

        it('should have a single shared solution dropdown (none inside the runs panel)', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            expect(tab.ui.runsPanel.querySelector('select#pdt-flow-solution-select')).toBeNull();
            expect(tab.ui.runsPanel.querySelector('#pdt-run-solution-select')).toBeNull();
            // The flow picker is populated from the already-loaded flows (no second solution choice).
            expect(tab.ui.runFlowSelect.querySelectorAll('option').length).toBe(mockFlows.length + 1);
        });

        it('should reveal the runs panel when the Run History sub-tab is activated', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            tab._switchSubView('runs');

            expect(tab.activeSubView).toBe('runs');
            expect(tab.ui.runsPanel.classList.contains('pdt-hidden')).toBe(false);
            expect(tab.ui.flowsPanel.classList.contains('pdt-hidden')).toBe(true);
        });

        it('should load runs once a flow is selected', async () => {
            tab = await renderRunsView();

            expect(DataService.getFlowRuns).toHaveBeenCalledWith('flow-1', expect.objectContaining({ top: 50 }));
            const rows = tab.ui.runList.querySelectorAll('.pdt-flow-run-row');
            expect(rows).toHaveLength(2);
            expect(rows[0].querySelector('.pdt-flow-run-status-badge').classList.contains('pdt-flow-run-status--succeeded')).toBe(true);
            expect(rows[1].querySelector('.pdt-flow-run-status-badge').classList.contains('pdt-flow-run-status--failed')).toBe(true);
        });

        it('should render a summary bar with the success rate', async () => {
            tab = await renderRunsView();

            expect(tab.ui.runSummary.classList.contains('pdt-hidden')).toBe(false);
            // 1 succeeded of 2 completed = 50%
            expect(tab.ui.runSummary.textContent).toContain('50%');
        });

        it('should re-query with the chosen status filter', async () => {
            tab = await renderRunsView();
            DataService.getFlowRuns.mockClear();

            tab.ui.runStatusFilter.value = 'Failed';
            await tab._handleRunStatusFilter();

            expect(DataService.getFlowRuns).toHaveBeenCalledWith('flow-1', expect.objectContaining({ status: 'Failed' }));
        });

        it('should lazily load action logs when a run row is expanded', async () => {
            tab = await renderRunsView();
            const row = tab.ui.runList.querySelector('.pdt-flow-run-row');

            await tab._handleRunExpand(row);

            expect(DataService.getFlowRunLogs).toHaveBeenCalledWith('run-1', expect.any(Object));
            expect(row.querySelector('.pdt-flow-run-details').classList.contains('pdt-hidden')).toBe(false);
        });

        it('should explain the portal-only detail and make the open button primary for a failed run', async () => {
            tab = await renderRunsView();
            const failedRow = tab.ui.runList.querySelectorAll('.pdt-flow-run-row')[1]; // run-2 (failed)

            await tab._handleRunExpand(failedRow);

            const details = failedRow.querySelector('.pdt-flow-run-details');
            expect(details.querySelector('.pdt-flow-run-portal-note')).toBeTruthy();
            const openBtn = details.querySelector('.pdt-flow-run-open-btn');
            expect(openBtn).toBeTruthy();
            expect(openBtn.classList.contains('secondary')).toBe(false); // primary for failed runs
        });

        it('should not show the portal note and keep the open button secondary for a non-failed run', async () => {
            tab = await renderRunsView();
            const okRow = tab.ui.runList.querySelector('.pdt-flow-run-row'); // run-1 (succeeded)

            await tab._handleRunExpand(okRow);

            const details = okRow.querySelector('.pdt-flow-run-details');
            expect(details.querySelector('.pdt-flow-run-portal-note')).toBeFalsy();
            expect(details.querySelector('.pdt-flow-run-open-btn').classList.contains('secondary')).toBe(true);
        });

        it('should show the empty/disabled note when no runs are returned', async () => {
            DataService.getFlowRuns.mockResolvedValue([]);
            tab = await renderRunsView();

            expect(tab.ui.runList.querySelector('.pdt-note')).not.toBeNull();
            expect(tab.ui.runSummary.classList.contains('pdt-hidden')).toBe(true);
        });

        it('should upgrade to a definitive "disabled" note when org run retention is 0', async () => {
            DataService.getFlowRuns.mockResolvedValue([]);
            DataService.getOrganizationDiagnostics.mockResolvedValue({
                pluginTraceLogSetting: null, transcriptRecordingBlocked: false,
                transcriptAccessBlocked: false, flowRunRetentionSeconds: 0
            });
            tab = await renderRunsView();
            // The retention read is best-effort (not awaited by _renderRuns) — let it resolve.
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(tab.ui.runList.textContent).toContain('turned OFF');
        });

        it('should open a specific run in the portal via deep link', async () => {
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            tab = await renderRunsView();

            await tab._handleOpenRun('08580001');

            expect(openSpy).toHaveBeenCalledWith(
                expect.stringContaining('/flows/flow-1/runs/08580001'),
                '_blank'
            );
            openSpy.mockRestore();
        });

        it('should poll for runs while Live is enabled and stop on destroy', async () => {
            vi.useFakeTimers();
            try {
                tab = await renderRunsView();
                DataService.getFlowRuns.mockClear();

                tab.ui.runLiveToggle.checked = true;
                tab._handleRunPolling(true);
                // Immediate refresh on enabling Live.
                expect(DataService.getFlowRuns).toHaveBeenCalledTimes(1);

                await vi.advanceTimersByTimeAsync(10000);
                expect(DataService.getFlowRuns).toHaveBeenCalledTimes(2);

                tab.destroy();
                await vi.advanceTimersByTimeAsync(20000);
                // No further polling after destroy.
                expect(DataService.getFlowRuns).toHaveBeenCalledTimes(2);
            } finally {
                vi.useRealTimers();
            }
        });

        it('should jump to the runs view for a specific flow via the card shortcut', async () => {
            const result = await renderWithFlows();
            tab = result.tab;

            await tab._handleViewRunsForFlow('flow-1');

            expect(tab.activeSubView).toBe('runs');
            expect(tab.selectedRunFlowId).toBe('flow-1');
            expect(DataService.getFlowRuns).toHaveBeenCalledWith('flow-1', expect.any(Object));
        });

        it('should auto-load the only flow\'s runs when the solution changes while on the runs view', async () => {
            const result = await renderWithFlows();
            tab = result.tab;
            tab._switchSubView('runs');
            DataService.getFlowRuns.mockClear();

            // A solution with exactly one flow should auto-select and load it immediately.
            DataService.getCloudFlowsBySolution.mockResolvedValue([JSON.parse(JSON.stringify(mockFlows[0]))]);
            tab.ui.solutionSelect.value = 'sol-2';
            await tab._onSolutionSelected();

            expect(tab.selectedRunFlowId).toBe('flow-1');
            expect(DataService.getFlowRuns).toHaveBeenCalledWith('flow-1', expect.any(Object));
        });

        it('should stop live polling and reset the toggle when leaving the runs view', async () => {
            vi.useFakeTimers();
            try {
                tab = await renderRunsView();
                tab.ui.runLiveToggle.checked = true;
                tab._handleRunPolling(true);
                DataService.getFlowRuns.mockClear();

                tab._switchSubView('flows');

                expect(tab.ui.runLiveToggle.checked).toBe(false);
                await vi.advanceTimersByTimeAsync(20000);
                expect(DataService.getFlowRuns).not.toHaveBeenCalled();
            } finally {
                vi.useRealTimers();
            }
        });
    });
});
