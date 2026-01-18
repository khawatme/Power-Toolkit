/**
 * @file Comprehensive tests for AutomationTab component
 * @module tests/components/AutomationTab.test.js
 * @description Tests for the Automation (Business Rules) component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutomationTab } from '../../src/components/AutomationTab.js';

// Mock business rules data
const mockRules = [
    {
        id: 'rule-1',
        name: 'Active Rule',
        description: 'A test active rule',
        isActive: true,
        clientData: '<rule><clientcode>function test() { return true; }</clientcode></rule>'
    },
    {
        id: 'rule-2',
        name: 'Inactive Rule',
        description: 'A test inactive rule',
        isActive: false,
        clientData: '<rule><clientcode>function inactive() { return false; }</clientcode></rule>'
    }
];

const mockEventHandlers = {
    OnLoad: [
        { function: 'onLoadHandler', library: 'account_main.js' }
    ],
    OnSave: [
        { function: 'onSaveHandler', library: 'account_main.js' }
    ]
};

// Mock dependencies
vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        executeFetchXml: vi.fn(() => Promise.resolve({ entities: [] })),
        updateRecord: vi.fn(() => Promise.resolve()),
        getFormEventHandlers: vi.fn(() => Promise.resolve({ OnLoad: [], OnSave: [] })),
        getBusinessRulesForEntity: vi.fn(() => Promise.resolve([])),
        getFormEventHandlersForEntity: vi.fn(() => Promise.resolve({ OnLoad: [], OnSave: [] })),
        setBusinessRuleState: vi.fn(() => Promise.resolve()),
        deleteBusinessRule: vi.fn(() => Promise.resolve()),
        getEntityByAny: vi.fn(() => Promise.resolve({ LogicalName: 'account', DisplayName: 'Account' })),
        clearCache: vi.fn()
    }
}));

vi.mock('../../src/services/AutomationService.js', () => ({
    AutomationService: {
        getBusinessRulesForEntity: vi.fn(() => Promise.resolve([])),
        toggleBusinessRule: vi.fn(() => Promise.resolve())
    }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: true,
        getEntityName: vi.fn(() => 'account'),
        getFormId: vi.fn(() => '12345-67890')
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/services/DialogService.js', () => ({
    DialogService: {
        show: vi.fn((title, content, onConfirm) => {
            // Auto-confirm for tests
            if (onConfirm) onConfirm();
        })
    }
}));

vi.mock('../../src/ui/MetadataBrowserDialog.js', () => ({
    MetadataBrowserDialog: {
        show: vi.fn((type, callback) => callback({ LogicalName: 'contact' }))
    }
}));

vi.mock('js-beautify', () => ({
    js_beautify: vi.fn((code) => code)
}));

import { DataService } from '../../src/services/DataService.js';
import { NotificationService } from '../../src/services/NotificationService.js';
import { PowerAppsApiService } from '../../src/services/PowerAppsApiService.js';
import { MetadataBrowserDialog } from '../../src/ui/MetadataBrowserDialog.js';
import { DialogService } from '../../src/services/DialogService.js';

describe('AutomationTab', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        DataService.getBusinessRulesForEntity.mockResolvedValue([]);
        DataService.getFormEventHandlersForEntity.mockResolvedValue({ OnLoad: [], OnSave: [] });
        DataService.getEntityByAny.mockResolvedValue({ LogicalName: 'account', DisplayName: 'Account' });
        document.body.innerHTML = '';
    });

    afterEach(() => {
        component?.destroy?.();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with correct id', () => {
            component = new AutomationTab();
            expect(component.id).toBe('automation');
        });

        it('should initialize with correct label', () => {
            component = new AutomationTab();
            expect(component.label).toContain('Automation');
        });

        it('should have an icon defined', () => {
            component = new AutomationTab();
            expect(component.icon).toBeDefined();
        });

        it('should NOT be a form-only component', () => {
            component = new AutomationTab();
            expect(component.isFormOnly).toBe(false);
        });

        it('should initialize UI object as empty', () => {
            component = new AutomationTab();
            expect(component.ui).toEqual({});
        });

        it('should initialize rules as empty array', () => {
            component = new AutomationTab();
            expect(component.rules).toEqual([]);
        });

        it('should initialize selectedEntity as null', () => {
            component = new AutomationTab();
            expect(component.selectedEntity).toBeNull();
        });

        it('should initialize handler references as null', () => {
            component = new AutomationTab();
            expect(component._onBrowseClick).toBeNull();
            expect(component._onEntityKeyup).toBeNull();
            expect(component._onListClick).toBeNull();
            expect(component._onResize).toBeNull();
        });

        it('should initialize load token as 0', () => {
            component = new AutomationTab();
            expect(component._loadToken).toBe(0);
        });
    });

    describe('render', () => {
        beforeEach(() => {
            component = new AutomationTab();
        });

        it('should return an HTMLElement', async () => {
            const element = await component.render();
            expect(element).toBeInstanceOf(HTMLElement);
        });

        it('should render Business Rules section title', async () => {
            const element = await component.render();
            const titles = element.querySelectorAll('.section-title');
            expect(titles.length).toBeGreaterThan(0);
            expect(titles[0].textContent).toContain('Business Rules');
        });

        it('should render entity input', async () => {
            const element = await component.render();
            const input = element.querySelector('#br-entity-input');
            expect(input).toBeTruthy();
            expect(input.placeholder).toContain('table name');
        });

        it('should render browse entity button', async () => {
            const element = await component.render();
            const browseBtn = element.querySelector('#br-browse-entity-btn');
            expect(browseBtn).toBeTruthy();
        });

        it('should render business rules list container', async () => {
            const element = await component.render();
            const listContainer = element.querySelector('#br-list-container');
            expect(listContainer).toBeTruthy();
        });

        it('should render Form Event Handlers section', async () => {
            const element = await component.render();
            const eventsContainer = element.querySelector('#events-container');
            expect(eventsContainer).toBeTruthy();
            expect(eventsContainer.textContent).toContain('Form Event Handlers');
        });

        it('should show default message in list container', async () => {
            const element = await component.render();
            const note = element.querySelector('#br-list-container .pdt-note');
            expect(note).toBeTruthy();
            expect(note.textContent).toContain('select a table');
        });
    });

    describe('postRender', () => {
        beforeEach(() => {
            component = new AutomationTab();
        });

        it('should not throw when called', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            expect(() => component.postRender(element)).not.toThrow();
        });

        it('should cache UI elements', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component.ui.brContainer).toBeTruthy();
            expect(component.ui.brListContainer).toBeTruthy();
            expect(component.ui.eventsContainer).toBeTruthy();
            expect(component.ui.entityInput).toBeTruthy();
            expect(component.ui.browseBtn).toBeTruthy();
        });

        it('should set up browse click handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component._onBrowseClick).toBeInstanceOf(Function);
        });

        it('should set up entity keyup handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component._onEntityKeyup).toBeInstanceOf(Function);
        });

        it('should set up list click handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component._onListClick).toBeInstanceOf(Function);
        });

        it('should set up resize handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component._onResize).toBeInstanceOf(Function);
        });

        it('should pre-populate entity input from form context', async () => {
            PowerAppsApiService.getEntityName.mockReturnValue('account');
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Wait for async initialization
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(component.ui.entityInput.value).toBe('account');
        });
    });

    describe('entity selection via browse', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should open MetadataBrowserDialog on browse click', async () => {
            component.ui.browseBtn.click();
            expect(MetadataBrowserDialog.show).toHaveBeenCalledWith('entity', expect.any(Function));
        });

        it('should update entity input after selection', async () => {
            component.ui.browseBtn.click();
            // Wait for callback
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(component.ui.entityInput.value).toBe('contact');
        });

        it('should update selectedEntity after selection', async () => {
            component.ui.browseBtn.click();
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(component.selectedEntity).toBe('contact');
        });
    });

    describe('entity selection via keyboard', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should load rules on Enter key', async () => {
            component.ui.entityInput.value = 'contact';
            const event = new KeyboardEvent('keyup', { key: 'Enter' });
            component.ui.entityInput.dispatchEvent(event);

            await new Promise(resolve => setTimeout(resolve, 100));
            expect(DataService.getEntityByAny).toHaveBeenCalledWith('contact');
        });

        it('should not load on other keys', async () => {
            DataService.getBusinessRulesForEntity.mockClear();
            component.ui.entityInput.value = 'contact';
            const event = new KeyboardEvent('keyup', { key: 'a' });
            component.ui.entityInput.dispatchEvent(event);

            await new Promise(resolve => setTimeout(resolve, 50));
            // Should not trigger additional load
        });
    });

    describe('business rules rendering', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should show no rules message when empty', () => {
            component.rules = [];
            component._renderBusinessRules();
            expect(component.ui.brListContainer.textContent).toContain('No');
        });

        it('should render rule items', () => {
            component.rules = mockRules;
            component._renderBusinessRules();

            const items = component.ui.brListContainer.querySelectorAll('.pdt-br-item');
            expect(items.length).toBe(2);
        });

        it('should show active status badge for active rules', () => {
            component.rules = mockRules;
            component._renderBusinessRules();

            const activeBadge = component.ui.brListContainer.querySelector('.pdt-status-badge.active');
            expect(activeBadge).toBeTruthy();
            expect(activeBadge.textContent).toContain('Active');
        });

        it('should show inactive status badge for inactive rules', () => {
            component.rules = mockRules;
            component._renderBusinessRules();

            const inactiveBadge = component.ui.brListContainer.querySelector('.pdt-status-badge.inactive');
            expect(inactiveBadge).toBeTruthy();
            expect(inactiveBadge.textContent).toContain('Inactive');
        });

        it('should show deactivate button for active rules', () => {
            component.rules = mockRules;
            component._renderBusinessRules();

            const deactivateBtn = component.ui.brListContainer.querySelector('[data-action="deactivate"]');
            expect(deactivateBtn).toBeTruthy();
        });

        it('should show activate button for inactive rules', () => {
            component.rules = mockRules;
            component._renderBusinessRules();

            const activateBtn = component.ui.brListContainer.querySelector('[data-action="activate"]');
            expect(activateBtn).toBeTruthy();
        });

        it('should show delete button for inactive rules', () => {
            component.rules = mockRules;
            component._renderBusinessRules();

            const deleteBtn = component.ui.brListContainer.querySelector('[data-action="delete"]');
            expect(deleteBtn).toBeTruthy();
        });

        it('should sort active rules first', () => {
            component.rules = [mockRules[1], mockRules[0]]; // Inactive first
            component._renderBusinessRules();

            const items = component.ui.brListContainer.querySelectorAll('.pdt-br-item');
            const firstBadge = items[0].querySelector('.pdt-status-badge');
            expect(firstBadge.classList.contains('active')).toBe(true);
        });
    });

    describe('rule details toggle', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component.rules = mockRules;
            component._renderBusinessRules();
        });

        it('should expand details on header click', () => {
            const header = component.ui.brListContainer.querySelector('.pdt-br-header');
            if (header) {
                component._toggleRuleDetails(header);
                expect(header.getAttribute('aria-expanded')).toBe('true');
            }
        });

        it('should collapse details on second click', () => {
            const header = component.ui.brListContainer.querySelector('.pdt-br-header');
            if (header) {
                component._toggleRuleDetails(header);
                component._toggleRuleDetails(header);
                expect(header.getAttribute('aria-expanded')).toBe('false');
            }
        });

        it('should render content in details', () => {
            const header = component.ui.brListContainer.querySelector('.pdt-br-header');
            if (header) {
                component._toggleRuleDetails(header);
                const details = header.nextElementSibling;
                // Details should have some content
                expect(details.innerHTML).not.toBe('');
            }
        });
    });

    describe('action button handling', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component.selectedEntity = 'account';
            component.rules = mockRules;
            component._renderBusinessRules();
        });

        it('should activate rule on activate click', async () => {
            const activateBtn = component.ui.brListContainer.querySelector('[data-action="activate"]');
            if (activateBtn) {
                await component._handleActionClick(activateBtn);
                expect(DataService.setBusinessRuleState).toHaveBeenCalledWith('rule-2', true);
            }
        });

        it('should deactivate rule on deactivate click', async () => {
            const deactivateBtn = component.ui.brListContainer.querySelector('[data-action="deactivate"]');
            if (deactivateBtn) {
                await component._handleActionClick(deactivateBtn);
                expect(DataService.setBusinessRuleState).toHaveBeenCalledWith('rule-1', false);
            }
        });

        it('should show confirmation dialog on delete click', async () => {
            const deleteBtn = component.ui.brListContainer.querySelector('[data-action="delete"]');
            if (deleteBtn) {
                await component._handleActionClick(deleteBtn);
                expect(DialogService.show).toHaveBeenCalled();
            }
        });

        it('should delete rule after confirmation', async () => {
            const deleteBtn = component.ui.brListContainer.querySelector('[data-action="delete"]');
            if (deleteBtn) {
                await component._handleActionClick(deleteBtn);
                // DialogService.show is mocked to auto-confirm
                expect(DataService.deleteBusinessRule).toHaveBeenCalledWith('rule-2');
            }
        });

        it('should show success notification on activation', async () => {
            const activateBtn = component.ui.brListContainer.querySelector('[data-action="activate"]');
            if (activateBtn) {
                await component._handleActionClick(activateBtn);
                await new Promise(resolve => setTimeout(resolve, 50));
                expect(NotificationService.show).toHaveBeenCalledWith(expect.any(String), 'success');
            }
        });

        it('should handle activation error', async () => {
            DataService.setBusinessRuleState.mockRejectedValueOnce(new Error('Activation failed'));
            const activateBtn = component.ui.brListContainer.querySelector('[data-action="activate"]');
            if (activateBtn) {
                // Trigger action
                component._handleActionClick(activateBtn);
                await new Promise(resolve => setTimeout(resolve, 100));
                expect(NotificationService.show).toHaveBeenCalledWith(expect.stringContaining('failed'), 'error');
            }
        });
    });

    describe('form events rendering', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should render OnLoad handlers', () => {
            component._renderFormEvents(component.ui.eventsContainer, mockEventHandlers);
            expect(component.ui.eventsContainer.textContent).toContain('OnLoad');
            expect(component.ui.eventsContainer.textContent).toContain('onLoadHandler');
        });

        it('should render OnSave handlers', () => {
            component._renderFormEvents(component.ui.eventsContainer, mockEventHandlers);
            expect(component.ui.eventsContainer.textContent).toContain('OnSave');
            expect(component.ui.eventsContainer.textContent).toContain('onSaveHandler');
        });

        it('should show no handlers message when empty', () => {
            component._renderFormEvents(component.ui.eventsContainer, { OnLoad: [], OnSave: [] });
            expect(component.ui.eventsContainer.textContent).toContain('No handlers');
        });

        it('should handle null events', () => {
            component._renderFormEvents(component.ui.eventsContainer, null);
            expect(component.ui.eventsContainer.textContent).toContain('form definition');
        });
    });

    describe('loading UI state', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should disable entity input when loading', () => {
            component._setLoadingUI(true);
            expect(component.ui.entityInput.disabled).toBe(true);
        });

        it('should disable browse button when loading', () => {
            component._setLoadingUI(true);
            expect(component.ui.browseBtn.disabled).toBe(true);
        });

        it('should enable inputs when loading complete', () => {
            component._setLoadingUI(true);
            component._setLoadingUI(false);
            expect(component.ui.entityInput.disabled).toBe(false);
            expect(component.ui.browseBtn.disabled).toBe(false);
        });
    });

    describe('destroy', () => {
        it('should not throw when called without render', () => {
            component = new AutomationTab();
            expect(() => component.destroy()).not.toThrow();
        });

        it('should not throw when called after render', async () => {
            component = new AutomationTab();
            const element = await component.render();
            expect(() => component.destroy()).not.toThrow();
        });

        it('should cleanup after render and postRender', async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(() => component.destroy()).not.toThrow();
        });

        it('should remove event listeners without throwing', async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Should not throw even when called multiple times
            expect(() => {
                component.destroy();
                component.destroy();
            }).not.toThrow();
        });
    });

    describe('resize handler', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component.rules = mockRules;
            component._renderBusinessRules();
        });

        it('should be registered on window', () => {
            expect(component._onResize).toBeInstanceOf(Function);
        });

        it('should not throw when called', () => {
            // Trigger resize without expanded panels
            expect(() => component._onResize()).not.toThrow();
        });
    });

    describe('_loadAllAutomationsForEntity', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should load rules and events for valid entity', async () => {
            DataService.getEntityByAny.mockResolvedValue({ LogicalName: 'account', DisplayName: 'Account' });
            DataService.getBusinessRulesForEntity.mockResolvedValue(mockRules);
            DataService.getFormEventHandlersForEntity.mockResolvedValue(mockEventHandlers);

            await component._loadAllAutomationsForEntity('account');

            expect(DataService.getEntityByAny).toHaveBeenCalledWith('account');
            expect(DataService.getBusinessRulesForEntity).toHaveBeenCalledWith('account');
            expect(DataService.getFormEventHandlersForEntity).toHaveBeenCalledWith('account');
            expect(component.rules).toEqual(mockRules);
        });

        it('should show loading message while fetching', async () => {
            let resolveRules;
            DataService.getBusinessRulesForEntity.mockReturnValue(new Promise(r => { resolveRules = r; }));
            DataService.getFormEventHandlersForEntity.mockResolvedValue({ OnLoad: [], OnSave: [] });

            const loadPromise = component._loadAllAutomationsForEntity('contact');

            expect(component.ui.brListContainer.textContent).toContain('Loading');

            resolveRules([]);
            await loadPromise;
        });

        it('should handle entity not found error', async () => {
            DataService.getEntityByAny.mockResolvedValue(null);

            await component._loadAllAutomationsForEntity('nonexistent');

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('Error loading automations'),
                'error'
            );
        });

        it('should handle API error gracefully', async () => {
            DataService.getEntityByAny.mockRejectedValue(new Error('Network error'));

            await component._loadAllAutomationsForEntity('account');

            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('Network error'),
                'error'
            );
            expect(component.rules).toEqual([]);
        });

        it('should increment load token to prevent stale data', async () => {
            const initialToken = component._loadToken;

            DataService.getEntityByAny.mockResolvedValue({ LogicalName: 'account' });
            DataService.getBusinessRulesForEntity.mockResolvedValue([]);
            DataService.getFormEventHandlersForEntity.mockResolvedValue({ OnLoad: [], OnSave: [] });

            await component._loadAllAutomationsForEntity('account');

            expect(component._loadToken).toBeGreaterThan(initialToken);
        });

        it('should cancel pending load when new load starts', async () => {
            let resolveFirst;
            DataService.getEntityByAny.mockResolvedValue({ LogicalName: 'account' });
            DataService.getBusinessRulesForEntity.mockReturnValueOnce(new Promise(r => { resolveFirst = r; }));
            DataService.getBusinessRulesForEntity.mockResolvedValueOnce([{ id: 'new-rule', name: 'New', isActive: true }]);
            DataService.getFormEventHandlersForEntity.mockResolvedValue({ OnLoad: [], OnSave: [] });

            // Start first load
            const firstLoad = component._loadAllAutomationsForEntity('account');
            const firstToken = component._loadToken;

            // Start second load before first completes
            await component._loadAllAutomationsForEntity('contact');

            // Complete first load
            resolveFirst([{ id: 'old-rule', name: 'Old', isActive: false }]);
            await firstLoad;

            // Token should have changed, second load wins
            expect(component._loadToken).toBeGreaterThan(firstToken);
        });

        it('should disable UI during load', async () => {
            let resolveRules;
            DataService.getEntityByAny.mockResolvedValue({ LogicalName: 'account' });
            DataService.getBusinessRulesForEntity.mockReturnValue(new Promise(r => { resolveRules = r; }));
            DataService.getFormEventHandlersForEntity.mockResolvedValue({ OnLoad: [], OnSave: [] });

            const loadPromise = component._loadAllAutomationsForEntity('account');

            expect(component.ui.entityInput.disabled).toBe(true);
            expect(component.ui.browseBtn.disabled).toBe(true);

            resolveRules([]);
            await loadPromise;

            expect(component.ui.entityInput.disabled).toBe(false);
            expect(component.ui.browseBtn.disabled).toBe(false);
        });

        it('should re-enable UI after error', async () => {
            DataService.getEntityByAny.mockRejectedValue(new Error('Failed'));

            await component._loadAllAutomationsForEntity('account');

            expect(component.ui.entityInput.disabled).toBe(false);
            expect(component.ui.browseBtn.disabled).toBe(false);
        });
    });

    describe('_refreshBusinessRules', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component.selectedEntity = 'account';
        });

        it('should do nothing if no entity selected', async () => {
            component.selectedEntity = null;
            DataService.getBusinessRulesForEntity.mockClear();

            await component._refreshBusinessRules();

            expect(DataService.getBusinessRulesForEntity).not.toHaveBeenCalled();
        });

        it('should show refreshing message when showLoading is true', async () => {
            let resolveRules;
            DataService.getBusinessRulesForEntity.mockReturnValue(new Promise(r => { resolveRules = r; }));

            const refreshPromise = component._refreshBusinessRules(true);

            expect(component.ui.brListContainer.textContent).toContain('Refreshing');

            resolveRules([]);
            await refreshPromise;
        });

        it('should not show refreshing message when showLoading is false', async () => {
            component.ui.brListContainer.innerHTML = '<div>Existing content</div>';
            let resolveRules;
            DataService.getBusinessRulesForEntity.mockReturnValue(new Promise(r => { resolveRules = r; }));

            const refreshPromise = component._refreshBusinessRules(false);

            // Should not overwrite with "Refreshing" message
            expect(component.ui.brListContainer.innerHTML).toContain('Existing content');

            resolveRules([]);
            await refreshPromise;
        });

        it('should clear cache before fetching', async () => {
            DataService.getBusinessRulesForEntity.mockResolvedValue([]);

            await component._refreshBusinessRules();

            expect(DataService.clearCache).toHaveBeenCalledWith('businessRules_account');
        });

        it('should update rules array with fetched data', async () => {
            DataService.getBusinessRulesForEntity.mockResolvedValue(mockRules);

            await component._refreshBusinessRules();

            expect(component.rules).toEqual(mockRules);
        });

        it('should handle refresh error', async () => {
            DataService.getBusinessRulesForEntity.mockRejectedValue(new Error('Refresh failed'));

            await component._refreshBusinessRules();

            expect(component.ui.brListContainer.innerHTML).toContain('Error');
            expect(component.ui.brListContainer.innerHTML).toContain('Refresh failed');
        });

        it('should increment load token on each refresh call', async () => {
            DataService.getBusinessRulesForEntity.mockResolvedValue([]);

            const initialToken = component._loadToken;
            await component._refreshBusinessRules();
            const secondToken = component._loadToken;
            await component._refreshBusinessRules();
            const thirdToken = component._loadToken;

            expect(secondToken).toBeGreaterThan(initialToken);
            expect(thirdToken).toBeGreaterThan(secondToken);
        });
    });

    describe('_renderBusinessRules sorting', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should sort rules with active first', () => {
            component.rules = [
                { id: '1', name: 'Z Rule', isActive: false },
                { id: '2', name: 'A Rule', isActive: true },
                { id: '3', name: 'M Rule', isActive: true }
            ];
            component._renderBusinessRules();

            const items = component.ui.brListContainer.querySelectorAll('.pdt-br-item');
            const firstItem = items[0];
            expect(firstItem.querySelector('.pdt-status-badge').classList.contains('active')).toBe(true);
        });

        it('should sort active rules alphabetically', () => {
            component.rules = [
                { id: '1', name: 'Zebra Rule', isActive: true },
                { id: '2', name: 'Alpha Rule', isActive: true }
            ];
            component._renderBusinessRules();

            const items = component.ui.brListContainer.querySelectorAll('.pdt-br-item');
            expect(items[0].textContent).toContain('Alpha');
            expect(items[1].textContent).toContain('Zebra');
        });

        it('should sort inactive rules alphabetically after active', () => {
            component.rules = [
                { id: '1', name: 'Zeta Inactive', isActive: false },
                { id: '2', name: 'Alpha Inactive', isActive: false },
                { id: '3', name: 'Active Rule', isActive: true }
            ];
            component._renderBusinessRules();

            const items = component.ui.brListContainer.querySelectorAll('.pdt-br-item');
            expect(items[0].textContent).toContain('Active Rule');
            expect(items[1].textContent).toContain('Alpha Inactive');
            expect(items[2].textContent).toContain('Zeta Inactive');
        });

        it('should handle rules with null names', () => {
            component.rules = [
                { id: '1', name: null, isActive: true },
                { id: '2', name: 'Named Rule', isActive: true }
            ];

            expect(() => component._renderBusinessRules()).not.toThrow();
        });
    });

    describe('_toggleRuleDetails edge cases', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should handle header without sibling details panel', () => {
            const orphanHeader = document.createElement('div');
            orphanHeader.className = 'pdt-br-header';
            component.ui.brListContainer.appendChild(orphanHeader);

            expect(() => component._toggleRuleDetails(orphanHeader)).not.toThrow();
        });

        it('should handle invalid sibling element', () => {
            const header = document.createElement('div');
            header.className = 'pdt-br-header';
            const nonDetails = document.createElement('div');
            nonDetails.className = 'other-class';

            const container = document.createElement('div');
            container.appendChild(header);
            container.appendChild(nonDetails);
            component.ui.brListContainer.appendChild(container);

            expect(() => component._toggleRuleDetails(header)).not.toThrow();
        });

        it('should close other open panels when opening new one', async () => {
            component.rules = mockRules;
            component._renderBusinessRules();

            const headers = component.ui.brListContainer.querySelectorAll('.pdt-br-header');
            const firstDetails = headers[0].nextElementSibling;
            const secondDetails = headers[1].nextElementSibling;

            // Manually set first panel as expanded (simulating open state)
            firstDetails.style.maxHeight = '100px';
            headers[0].setAttribute('aria-expanded', 'true');
            firstDetails.setAttribute('aria-hidden', 'false');

            // Open second panel - first should close
            component._toggleRuleDetails(headers[1]);

            // Wait for requestAnimationFrame
            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(headers[0].getAttribute('aria-expanded')).toBe('false');
        });

        it('should handle rule without clientData', () => {
            component.rules = [{ id: 'no-data', name: 'No Data Rule', isActive: true }];
            component._renderBusinessRules();

            const header = component.ui.brListContainer.querySelector('.pdt-br-header');
            component._toggleRuleDetails(header);

            const details = header.nextElementSibling;
            expect(details.textContent).toContain('no client logic');
        });

        it('should handle invalid XML in clientData', () => {
            component.rules = [{
                id: 'bad-xml',
                name: 'Bad XML Rule',
                isActive: true,
                clientData: '<invalid><unclosed'
            }];
            component._renderBusinessRules();

            const header = component.ui.brListContainer.querySelector('.pdt-br-header');
            component._toggleRuleDetails(header);

            const details = header.nextElementSibling;
            expect(details.textContent).toContain('Unable to parse');
        });

        it('should handle XML without clientcode element', () => {
            component.rules = [{
                id: 'no-clientcode',
                name: 'No Clientcode Rule',
                isActive: true,
                clientData: '<rule><other>content</other></rule>'
            }];
            component._renderBusinessRules();

            const header = component.ui.brListContainer.querySelector('.pdt-br-header');
            component._toggleRuleDetails(header);

            const details = header.nextElementSibling;
            expect(details.textContent).toContain('No <clientcode> found');
        });
    });

    describe('_handleActionClick edge cases', () => {
        let rulesWithBoth;

        beforeEach(async () => {
            // Prevent auto-initialization from overwriting our test data
            PowerAppsApiService.getEntityName.mockReturnValue(null);

            // Ensure we have both active and inactive rules
            rulesWithBoth = [
                { id: 'active-rule', name: 'Active Rule', isActive: true },
                { id: 'inactive-rule', name: 'Inactive Rule', isActive: false }
            ];

            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Wait for any async initialization to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            component.selectedEntity = 'account';
            component.rules = rulesWithBoth;
            component._renderBusinessRules();
        });

        it('should show loading state on button during action', async () => {
            DataService.setBusinessRuleState.mockResolvedValue();
            DataService.getBusinessRulesForEntity.mockResolvedValue(rulesWithBoth);

            const deactivateBtn = component.ui.brListContainer.querySelector('[data-action="deactivate"]');
            expect(deactivateBtn).toBeTruthy();

            // The action is async, button state changes immediately
            component._handleActionClick(deactivateBtn);

            // Button should show loading state synchronously
            expect(deactivateBtn.textContent).toBe('...');
            expect(deactivateBtn.disabled).toBe(true);

            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should restore button state on activation error', async () => {
            DataService.setBusinessRuleState.mockRejectedValue(new Error('Activation error'));

            const activateBtn = component.ui.brListContainer.querySelector('[data-action="activate"]');
            expect(activateBtn).toBeTruthy();
            const originalText = activateBtn.textContent;

            component._handleActionClick(activateBtn);
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(activateBtn.textContent).toBe(originalText);
            expect(activateBtn.disabled).toBe(false);
        });

        it('should restore button state on deactivation error', async () => {
            DataService.setBusinessRuleState.mockRejectedValue(new Error('Deactivation error'));

            const deactivateBtn = component.ui.brListContainer.querySelector('[data-action="deactivate"]');
            expect(deactivateBtn).toBeTruthy();
            const originalText = deactivateBtn.textContent;

            component._handleActionClick(deactivateBtn);
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(deactivateBtn.textContent).toBe(originalText);
            expect(deactivateBtn.disabled).toBe(false);
            expect(NotificationService.show).toHaveBeenCalledWith(expect.stringContaining('deactivate'), 'error');
        });

        it('should restore button state on delete error', async () => {
            DataService.deleteBusinessRule.mockRejectedValue(new Error('Delete error'));

            const deleteBtn = component.ui.brListContainer.querySelector('[data-action="delete"]');
            expect(deleteBtn).toBeTruthy();
            const originalText = deleteBtn.textContent;

            component._handleActionClick(deleteBtn);
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(deleteBtn.textContent).toBe(originalText);
            expect(deleteBtn.disabled).toBe(false);
        });

        it('should refresh rules after successful activation', async () => {
            DataService.setBusinessRuleState.mockResolvedValue();
            DataService.getBusinessRulesForEntity.mockResolvedValue(rulesWithBoth);

            const activateBtn = component.ui.brListContainer.querySelector('[data-action="activate"]');
            expect(activateBtn).toBeTruthy();
            component._handleActionClick(activateBtn);
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(DataService.getBusinessRulesForEntity).toHaveBeenCalled();
        });

        it('should refresh rules after successful deletion', async () => {
            DataService.deleteBusinessRule.mockResolvedValue();
            DataService.getBusinessRulesForEntity.mockResolvedValue([]);

            const deleteBtn = component.ui.brListContainer.querySelector('[data-action="delete"]');
            expect(deleteBtn).toBeTruthy();
            component._handleActionClick(deleteBtn);
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(DataService.getBusinessRulesForEntity).toHaveBeenCalled();
        });
    });

    describe('_initialize behavior', () => {
        it('should auto-load rules for current entity from form context', async () => {
            PowerAppsApiService.getEntityName.mockReturnValue('opportunity');
            DataService.getEntityByAny.mockResolvedValue({ LogicalName: 'opportunity' });
            DataService.getBusinessRulesForEntity.mockResolvedValue([]);
            DataService.getFormEventHandlersForEntity.mockResolvedValue({ OnLoad: [], OnSave: [] });

            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(component.ui.entityInput.value).toBe('opportunity');
            expect(component.selectedEntity).toBe('opportunity');
            expect(DataService.getBusinessRulesForEntity).toHaveBeenCalledWith('opportunity');
        });

        it('should not auto-load if no entity in form context', async () => {
            PowerAppsApiService.getEntityName.mockReturnValue(null);
            DataService.getBusinessRulesForEntity.mockClear();

            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(component.ui.entityInput.value).toBe('');
            expect(DataService.getBusinessRulesForEntity).not.toHaveBeenCalled();
        });

        it('should add default message to events container if missing', async () => {
            PowerAppsApiService.getEntityName.mockReturnValue(null);

            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(component.ui.eventsContainer.textContent).toContain('Select a table');
        });
    });

    describe('_setLoadingUI edge cases', () => {
        it('should not throw if ui is not defined', () => {
            component = new AutomationTab();
            component.ui = null;

            expect(() => component._setLoadingUI(true)).not.toThrow();
        });

        it('should throw if ui elements are undefined', () => {
            component = new AutomationTab();
            component.ui = {};

            // The implementation accesses ui.entityInput.disabled which throws if entityInput is undefined
            expect(() => component._setLoadingUI(true)).toThrow();
        });
    });

    describe('entity input keyboard handling', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should not load on empty entity name', async () => {
            DataService.getEntityByAny.mockClear();

            component.ui.entityInput.value = '   ';
            const event = new KeyboardEvent('keyup', { key: 'Enter' });
            component.ui.entityInput.dispatchEvent(event);

            await new Promise(resolve => setTimeout(resolve, 50));
            expect(DataService.getEntityByAny).not.toHaveBeenCalled();
        });

        it('should trim entity name before loading', async () => {
            DataService.getEntityByAny.mockResolvedValue({ LogicalName: 'lead' });
            DataService.getBusinessRulesForEntity.mockResolvedValue([]);
            DataService.getFormEventHandlersForEntity.mockResolvedValue({ OnLoad: [], OnSave: [] });

            component.ui.entityInput.value = '  lead  ';
            const event = new KeyboardEvent('keyup', { key: 'Enter' });
            component.ui.entityInput.dispatchEvent(event);

            await new Promise(resolve => setTimeout(resolve, 100));
            expect(component.selectedEntity).toBe('lead');
        });

        it('should ignore non-Enter keys', async () => {
            DataService.getEntityByAny.mockClear();

            component.ui.entityInput.value = 'account';
            ['Tab', 'Escape', 'ArrowDown', 'a', '1'].forEach(key => {
                const event = new KeyboardEvent('keyup', { key });
                component.ui.entityInput.dispatchEvent(event);
            });

            await new Promise(resolve => setTimeout(resolve, 50));
            expect(DataService.getEntityByAny).not.toHaveBeenCalled();
        });
    });

    describe('list click delegation', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component.selectedEntity = 'account';
            component.rules = mockRules;
            component._renderBusinessRules();
        });

        it('should stop propagation on action button click', () => {
            const activateBtn = component.ui.brListContainer.querySelector('[data-action="activate"]');
            const clickEvent = new MouseEvent('click', { bubbles: true });
            const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');

            activateBtn.dispatchEvent(clickEvent);

            expect(stopPropagationSpy).toHaveBeenCalled();
        });

        it('should toggle details on header click', async () => {
            const header = component.ui.brListContainer.querySelector('.pdt-br-header');
            header.click();

            // Wait for requestAnimationFrame used in _toggleRuleDetails
            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(header.getAttribute('aria-expanded')).toBe('true');
        });

        it('should not toggle details when clicking action button', () => {
            const header = component.ui.brListContainer.querySelector('.pdt-br-header');
            const activateBtn = header.querySelector('[data-action]') ||
                component.ui.brListContainer.querySelector('[data-action="deactivate"]');

            activateBtn.click();

            // Header should not be expanded due to stopPropagation
            expect(header.getAttribute('aria-expanded')).toBe('false');
        });
    });

    describe('resize handler with expanded panels', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            component.rules = mockRules;
            component._renderBusinessRules();
        });

        it('should update maxHeight of expanded panels', () => {
            const header = component.ui.brListContainer.querySelector('.pdt-br-header');
            component._toggleRuleDetails(header);

            const details = header.nextElementSibling;

            // Simulate that panel has content and is expanded
            Object.defineProperty(details, 'scrollHeight', { value: 200, configurable: true });
            details.style.maxHeight = '100px';

            component._onResize();

            expect(details.style.maxHeight).toBe('200px');
        });

        it('should not update collapsed panels', () => {
            const header = component.ui.brListContainer.querySelector('.pdt-br-header');
            const details = header.nextElementSibling;
            details.style.maxHeight = '0px';

            component._onResize();

            expect(details.style.maxHeight).toBe('0px');
        });
    });

    describe('_renderFormEvents edge cases', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should handle handlers with missing function property', () => {
            component._renderFormEvents(component.ui.eventsContainer, {
                OnLoad: [{ library: 'test.js' }],
                OnSave: []
            });

            expect(component.ui.eventsContainer.innerHTML).toContain('test.js');
        });

        it('should handle handlers with missing library property', () => {
            component._renderFormEvents(component.ui.eventsContainer, {
                OnLoad: [{ function: 'onLoad' }],
                OnSave: []
            });

            expect(component.ui.eventsContainer.innerHTML).toContain('onLoad');
        });

        it('should render both OnLoad and OnSave sections', () => {
            component._renderFormEvents(component.ui.eventsContainer, {
                OnLoad: [{ function: 'loadFn', library: 'load.js' }],
                OnSave: [{ function: 'saveFn', library: 'save.js' }]
            });

            expect(component.ui.eventsContainer.innerHTML).toContain('OnLoad');
            expect(component.ui.eventsContainer.innerHTML).toContain('OnSave');
            expect(component.ui.eventsContainer.innerHTML).toContain('loadFn');
            expect(component.ui.eventsContainer.innerHTML).toContain('saveFn');
        });

        it('should show note about main form definition', () => {
            component._renderFormEvents(component.ui.eventsContainer, mockEventHandlers);

            expect(component.ui.eventsContainer.textContent).toContain('main form');
        });

        it('should handle undefined handler arrays', () => {
            component._renderFormEvents(component.ui.eventsContainer, {});

            expect(component.ui.eventsContainer.textContent).toContain('No handlers');
        });
    });

    describe('rule item structure', () => {
        beforeEach(async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should include rule ID in data attribute', () => {
            component.rules = [{ id: 'unique-id-123', name: 'Test', isActive: true }];
            component._renderBusinessRules();

            const item = component.ui.brListContainer.querySelector('.pdt-br-item');
            expect(item.dataset.ruleId).toBe('unique-id-123');
        });

        it('should display rule description if present', () => {
            component.rules = [{
                id: '1',
                name: 'Test Rule',
                description: 'This is a test description',
                isActive: true
            }];
            component._renderBusinessRules();

            expect(component.ui.brListContainer.textContent).toContain('This is a test description');
        });

        it('should not display description element if absent', () => {
            component.rules = [{ id: '1', name: 'Test Rule', isActive: true }];
            component._renderBusinessRules();

            const description = component.ui.brListContainer.querySelector('.pdt-list-item-description');
            expect(description).toBeNull();
        });

        it('should escape HTML in rule names', () => {
            component.rules = [{
                id: '1',
                name: '<script>alert("xss")</script>',
                isActive: true
            }];
            component._renderBusinessRules();

            expect(component.ui.brListContainer.innerHTML).not.toContain('<script>');
            expect(component.ui.brListContainer.innerHTML).toContain('&lt;script&gt;');
        });

        it('should escape HTML in rule descriptions', () => {
            component.rules = [{
                id: '1',
                name: 'Test',
                description: '<img onerror="alert(1)" src="">',
                isActive: true
            }];
            component._renderBusinessRules();

            // The description should be HTML-escaped, meaning <img> becomes &lt;img&gt;
            expect(component.ui.brListContainer.innerHTML).toContain('&lt;img');
            // And it should NOT contain an actual img element
            expect(component.ui.brListContainer.querySelector('img')).toBeNull();
        });

        it('should set correct aria attributes on header', () => {
            component.rules = mockRules;
            component._renderBusinessRules();

            const header = component.ui.brListContainer.querySelector('.pdt-br-header');
            expect(header.getAttribute('role')).toBe('button');
            expect(header.getAttribute('aria-expanded')).toBe('false');
        });

        it('should set aria-hidden on details panel', () => {
            component.rules = mockRules;
            component._renderBusinessRules();

            const details = component.ui.brListContainer.querySelector('.pdt-br-details');
            expect(details.getAttribute('aria-hidden')).toBe('true');
        });
    });

    describe('destroy cleanup', () => {
        it('should handle missing event handler references', async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Null out handlers before destroy
            component._onBrowseClick = null;
            component._onEntityKeyup = null;

            expect(() => component.destroy()).not.toThrow();
        });

        it('should handle partially initialized UI', async () => {
            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Remove some UI elements
            component.ui.browseBtn = null;
            component.ui.entityInput = null;

            expect(() => component.destroy()).not.toThrow();
        });
    });

    describe('stale request handling', () => {
        beforeEach(async () => {
            // Prevent auto-initialization
            PowerAppsApiService.getEntityName.mockReturnValue(null);

            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should not render results from stale _refreshBusinessRules call', async () => {
            component.selectedEntity = 'account';

            // Create a delayed resolve for first call
            let resolveFirst;
            DataService.getBusinessRulesForEntity
                .mockReturnValueOnce(new Promise(r => { resolveFirst = r; }))
                .mockResolvedValueOnce([{ id: 'second', name: 'Second Call Result', isActive: true }]);

            // Start first refresh
            const firstRefresh = component._refreshBusinessRules();

            // Start second refresh before first completes
            const secondRefresh = component._refreshBusinessRules();
            await secondRefresh;

            // Complete first call with different data
            resolveFirst([{ id: 'first', name: 'First Call Result', isActive: false }]);
            await firstRefresh;

            // Second call result should be rendered, not first
            expect(component.ui.brListContainer.textContent).toContain('Second Call Result');
            expect(component.ui.brListContainer.textContent).not.toContain('First Call Result');
        });

        it('should not render error from stale _refreshBusinessRules call', async () => {
            component.selectedEntity = 'account';

            let rejectFirst;
            DataService.getBusinessRulesForEntity
                .mockReturnValueOnce(new Promise((_, reject) => { rejectFirst = reject; }))
                .mockResolvedValueOnce([{ id: 'success', name: 'Success', isActive: true }]);

            // Start first refresh that will fail
            const firstRefresh = component._refreshBusinessRules();

            // Start second refresh that succeeds
            const secondRefresh = component._refreshBusinessRules();
            await secondRefresh;

            // First call fails
            rejectFirst(new Error('Stale error'));
            await firstRefresh;

            // Error from first call should not appear
            expect(component.ui.brListContainer.textContent).not.toContain('Error');
            expect(component.ui.brListContainer.textContent).toContain('Success');
        });

        it('should not render results from stale _loadAllAutomationsForEntity call', async () => {
            DataService.getEntityByAny.mockResolvedValue({ LogicalName: 'account' });

            let resolveFirst;
            DataService.getBusinessRulesForEntity
                .mockReturnValueOnce(new Promise(r => { resolveFirst = r; }))
                .mockResolvedValueOnce([{ id: 'second', name: 'Second Load', isActive: true }]);
            DataService.getFormEventHandlersForEntity.mockResolvedValue({ OnLoad: [], OnSave: [] });

            // Start first load
            const firstLoad = component._loadAllAutomationsForEntity('account');

            // Start second load before first completes
            const secondLoad = component._loadAllAutomationsForEntity('contact');
            await secondLoad;

            // Complete first load
            resolveFirst([{ id: 'first', name: 'First Load', isActive: false }]);
            await firstLoad;

            // Second load result should be rendered
            expect(component.ui.brListContainer.textContent).toContain('Second Load');
            expect(component.ui.brListContainer.textContent).not.toContain('First Load');
        });

        it('should not set loading UI from stale finally block in _refreshBusinessRules', async () => {
            component.selectedEntity = 'account';

            let resolveFirst;
            DataService.getBusinessRulesForEntity
                .mockReturnValueOnce(new Promise(r => { resolveFirst = r; }))
                .mockResolvedValueOnce([]);

            // Start first refresh
            const firstRefresh = component._refreshBusinessRules();

            // Start second refresh and complete it
            const secondRefresh = component._refreshBusinessRules();
            await secondRefresh;

            // Disable UI again to simulate new operation starting
            component._setLoadingUI(true);

            // Complete first call
            resolveFirst([]);
            await firstRefresh;

            // UI should still be disabled from our manual set, not re-enabled by stale finally
            expect(component.ui.entityInput.disabled).toBe(true);
        });
    });

    describe('_toggleRuleDetails expansion animation', () => {
        beforeEach(async () => {
            PowerAppsApiService.getEntityName.mockReturnValue(null);

            component = new AutomationTab();
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await new Promise(resolve => setTimeout(resolve, 50));

            component.rules = mockRules;
            component._renderBusinessRules();
        });

        it('should expand panel on first toggle and set aria attributes', async () => {
            const header = component.ui.brListContainer.querySelector('.pdt-br-header');
            const details = header.nextElementSibling;

            // Initial state
            expect(header.getAttribute('aria-expanded')).toBe('false');
            expect(details.getAttribute('aria-hidden')).toBe('true');

            // Toggle to expand
            component._toggleRuleDetails(header);

            // Wait for requestAnimationFrame
            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(header.getAttribute('aria-expanded')).toBe('true');
            expect(details.getAttribute('aria-hidden')).toBe('false');
        });

        it('should collapse previously expanded panel', async () => {
            const header = component.ui.brListContainer.querySelector('.pdt-br-header');
            const details = header.nextElementSibling;

            // Manually set the panel as expanded (simulating post-animation state)
            details.style.maxHeight = '200px';
            header.setAttribute('aria-expanded', 'true');
            details.setAttribute('aria-hidden', 'false');

            // Collapse by toggling
            component._toggleRuleDetails(header);

            expect(header.getAttribute('aria-expanded')).toBe('false');
            expect(details.getAttribute('aria-hidden')).toBe('true');
            expect(details.style.maxHeight).toBe('0px');
        });
    });
});
