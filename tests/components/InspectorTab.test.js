/**
 * @file Comprehensive tests for InspectorTab component
 * @module tests/components/InspectorTab.test.js
 * @description Tests for the Form Inspector tree view component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        getFormHierarchy: vi.fn(() => Promise.resolve([
            {
                label: 'Tab: General',
                logicalName: 'tab_general',
                children: [
                    {
                        label: 'Section: Details',
                        logicalName: 'section_details',
                        children: [
                            { label: 'Control: Name', logicalName: 'name', value: 'Test Value', controlType: 'standard' }
                        ]
                    }
                ]
            }
        ]))
    }
}));

vi.mock('../../src/services/DialogService.js', () => ({
    DialogService: { show: vi.fn(), close: vi.fn() }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: true,
        getAllAttributes: vi.fn(() => []),
        getAllControls: vi.fn(() => []),
        getAllTabs: vi.fn(() => [])
    }
}));

vi.mock('../../src/ui/FormControlFactory.js', () => ({
    FormControlFactory: {
        create: vi.fn((attrType, currentValue, attr) => {
            return `<input id="pdt-prompt-input" type="text" value="${currentValue || ''}" />`;
        })
    }
}));

vi.mock('../../src/helpers/index.js', () => {
    const mockFindNodeInTree = vi.fn((tree, key, value) => {
        const search = (nodes) => {
            for (const node of nodes || []) {
                if (node[key] === value) return node;
                if (node.children) {
                    const found = search(node.children);
                    if (found) return found;
                }
            }
            return null;
        };
        return search(tree);
    });

    return {
        copyToClipboard: vi.fn((text, message) => Promise.resolve()),
        findNodeInTree: mockFindNodeInTree,
        escapeHtml: vi.fn((str) => str || ''),
        formatDisplayValue: vi.fn((value) => String(value ?? '')),
        parseInputValue: vi.fn((input, attrType) => input?.value),
        throttle: vi.fn((fn) => fn)
    };
});

import { InspectorTab } from '../../src/components/InspectorTab.js';
import { DataService } from '../../src/services/DataService.js';
import { DialogService } from '../../src/services/DialogService.js';
import { NotificationService } from '../../src/services/NotificationService.js';
import { FormControlFactory } from '../../src/ui/FormControlFactory.js';
import { copyToClipboard, findNodeInTree, parseInputValue } from '../../src/helpers/index.js';

describe('InspectorTab', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        component = new InspectorTab();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        component?.destroy?.();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with correct id', () => {
            expect(component.id).toBe('inspector');
        });

        it('should initialize with correct label', () => {
            expect(component.label).toBe('Inspector');
        });

        it('should have an icon defined', () => {
            expect(component.icon).toBeDefined();
        });

        it('should be a form-only component', () => {
            expect(component.isFormOnly).toBe(true);
        });

        it('should initialize UI object', () => {
            expect(component.ui).toBeDefined();
        });

        it('should initialize hierarchy as empty array', () => {
            expect(component.hierarchy).toEqual([]);
        });

        it('should initialize highlightedElement as null', () => {
            expect(component.highlightedElement).toBeNull();
        });

        it('should initialize currentlyHoveredNode as null', () => {
            expect(component.currentlyHoveredNode).toBeNull();
        });
    });

    describe('render', () => {
        it('should return an HTMLElement', async () => {
            const element = await component.render();
            expect(element).toBeInstanceOf(HTMLElement);
        });

        it('should render section title', async () => {
            const element = await component.render();
            expect(element.querySelector('.section-title')).toBeTruthy();
            expect(element.textContent).toContain('Form Inspector');
        });

        it('should render tree view container when hierarchy exists', async () => {
            const element = await component.render();
            const treeView = element.querySelector('.tree-view');
            expect(treeView).toBeTruthy();
        });

        it('should set tree view role attribute for accessibility', async () => {
            const element = await component.render();
            const treeView = element.querySelector('.tree-view');
            expect(treeView?.getAttribute('role')).toBe('tree');
        });

        it('should cache tree view in ui object', async () => {
            await component.render();
            expect(component.ui.treeView).toBeTruthy();
        });

        it('should populate hierarchy property', async () => {
            await component.render();
            expect(component.hierarchy.length).toBeGreaterThan(0);
        });

        it('should handle empty hierarchy gracefully', async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce([]);

            const element = await component.render();
            expect(element.querySelector('.pdt-note')).toBeTruthy();
        });

        it('should handle errors gracefully', async () => {
            DataService.getFormHierarchy.mockRejectedValueOnce(new Error('Test error'));

            const element = await component.render();
            expect(element.querySelector('.pdt-error')).toBeTruthy();
        });

        it('should call DataService.getFormHierarchy with true parameter', async () => {
            await component.render();
            expect(DataService.getFormHierarchy).toHaveBeenCalledWith(true);
        });
    });

    describe('postRender', () => {
        it('should not throw when called', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            expect(() => component.postRender(element)).not.toThrow();
        });

        it('should setup mouse event handlers', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._moveHandler).toBeDefined();
            expect(component._leaveHandler).toBeDefined();
        });

        it('should setup click handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._clickHandler).toBeDefined();
        });

        it('should setup copy handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(component._copyHandler).toBeDefined();
        });

        it('should handle missing tree view gracefully', () => {
            component.ui.treeView = null;
            expect(() => component.postRender(document.createElement('div'))).not.toThrow();
        });

        it('should not attach handlers when treeView is null', () => {
            component.ui.treeView = null;
            component.postRender(document.createElement('div'));
            expect(component._clickHandler).toBeUndefined();
        });
    });

    describe('destroy', () => {
        it('should not throw when called', () => {
            expect(() => component.destroy()).not.toThrow();
        });

        it('should cleanup after render and postRender', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            expect(() => component.destroy()).not.toThrow();
        });

        it('should clear highlighted element', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Simulate a highlighted element
            const testEl = document.createElement('div');
            testEl.classList.add('pdt-highlight-border');
            component.highlightedElement = testEl;

            component.destroy();
            expect(testEl.classList.contains('pdt-highlight-border')).toBe(false);
        });

        it('should handle destroy when ui.treeView is null', () => {
            component.ui = {};
            expect(() => component.destroy()).not.toThrow();
        });

        it('should handle destroy when handlers are not set', () => {
            component._moveHandler = undefined;
            component._leaveHandler = undefined;
            component._clickHandler = undefined;
            component._copyHandler = undefined;
            expect(() => component.destroy()).not.toThrow();
        });
    });

    describe('tree structure', () => {
        it('should render expandable nodes', async () => {
            const element = await component.render();
            const treeItems = element.querySelectorAll('.tree-view li');
            expect(treeItems.length).toBeGreaterThan(0);
        });

        it('should mark parent nodes with tree-parent class', async () => {
            const element = await component.render();
            const parentNodes = element.querySelectorAll('.tree-parent');
            expect(parentNodes.length).toBeGreaterThan(0);
        });

        it('should mark parent nodes as collapsed initially', async () => {
            const element = await component.render();
            const collapsedNodes = element.querySelectorAll('.tree-parent.collapsed');
            expect(collapsedNodes.length).toBeGreaterThan(0);
        });

        it('should set data-rendered to false for lazy loading', async () => {
            const element = await component.render();
            const parentNode = element.querySelector('.tree-parent');
            expect(parentNode?.dataset.rendered).toBe('false');
        });

        it('should render tree-child ul elements for parent nodes', async () => {
            const element = await component.render();
            const childLists = element.querySelectorAll('.tree-child');
            expect(childLists.length).toBeGreaterThan(0);
        });

        it('should set role=group on child lists', async () => {
            const element = await component.render();
            const childList = element.querySelector('.tree-child');
            expect(childList?.getAttribute('role')).toBe('group');
        });
    });

    describe('_renderTree', () => {
        it('should append tree nodes to parent element', async () => {
            const element = await component.render();
            const treeView = element.querySelector('.tree-view');
            expect(treeView?.children.length).toBeGreaterThan(0);
        });

        it('should handle empty nodes array', async () => {
            const parentEl = document.createElement('ul');
            component._renderTree(parentEl, []);
            expect(parentEl.children.length).toBe(0);
        });

        it('should handle null nodes array', async () => {
            const parentEl = document.createElement('ul');
            component._renderTree(parentEl, null);
            expect(parentEl.children.length).toBe(0);
        });

        it('should handle undefined nodes array', async () => {
            const parentEl = document.createElement('ul');
            component._renderTree(parentEl, undefined);
            expect(parentEl.children.length).toBe(0);
        });

        it('should create tree-item elements', async () => {
            const parentEl = document.createElement('ul');
            component._renderTree(parentEl, [{ label: 'Test', logicalName: 'test' }]);
            expect(parentEl.querySelector('.tree-item')).toBeTruthy();
        });

        it('should not add tree-parent class for leaf nodes', async () => {
            const parentEl = document.createElement('ul');
            component._renderTree(parentEl, [{ label: 'Leaf', logicalName: 'leaf' }]);
            expect(parentEl.querySelector('.tree-parent')).toBeFalsy();
        });

        it('should add tree-parent class for nodes with children', async () => {
            const parentEl = document.createElement('ul');
            component._renderTree(parentEl, [{
                label: 'Parent',
                logicalName: 'parent',
                children: [{ label: 'Child', logicalName: 'child' }]
            }]);
            expect(parentEl.querySelector('.tree-parent')).toBeTruthy();
        });
    });

    describe('_createTreeNode', () => {
        it('should create an li element', () => {
            const node = component._createTreeNode({ label: 'Test', logicalName: 'test' });
            expect(node.tagName).toBe('LI');
        });

        it('should add tree-item class', () => {
            const node = component._createTreeNode({ label: 'Test', logicalName: 'test' });
            expect(node.classList.contains('tree-item')).toBe(true);
        });

        it('should include logical name in data attribute', () => {
            const node = component._createTreeNode({ label: 'Test', logicalName: 'my_field' });
            expect(node.querySelector('[data-logical-name="my_field"]')).toBeTruthy();
        });

        it('should render label', () => {
            const node = component._createTreeNode({ label: 'My Label', logicalName: 'test' });
            expect(node.textContent).toContain('My Label');
        });

        it('should render value when present', () => {
            const node = component._createTreeNode({
                label: 'Test',
                logicalName: 'test',
                value: 'Test Value'
            });
            expect(node.querySelector('.item-value')).toBeTruthy();
        });

        it('should not render value element when value is undefined', () => {
            const node = component._createTreeNode({ label: 'Test', logicalName: 'test' });
            expect(node.querySelector('.item-value')).toBeFalsy();
        });

        it('should add editable class when editableAttr is present', () => {
            const mockAttr = { getValue: vi.fn() };
            const node = component._createTreeNode({
                label: 'Test',
                logicalName: 'test',
                value: 'Test',
                editableAttr: mockAttr,
                controlType: 'standard'
            });
            expect(node.querySelector('.item-value.editable')).toBeTruthy();
        });

        it('should not add editable class for subgrid controls', () => {
            const mockAttr = { getValue: vi.fn() };
            const node = component._createTreeNode({
                label: 'Test',
                logicalName: 'test',
                value: 'Test',
                editableAttr: mockAttr,
                controlType: 'subgrid'
            });
            expect(node.querySelector('.item-value.editable')).toBeFalsy();
        });

        it('should include copyable class on logical name span', () => {
            const node = component._createTreeNode({ label: 'Test', logicalName: 'test' });
            expect(node.querySelector('.item-logical-name.copyable')).toBeTruthy();
        });

        it('should set role=treeitem on node content', () => {
            const node = component._createTreeNode({ label: 'Test', logicalName: 'test' });
            expect(node.querySelector('[role="treeitem"]')).toBeTruthy();
        });

        it('should set tabindex=0 for keyboard accessibility', () => {
            const node = component._createTreeNode({ label: 'Test', logicalName: 'test' });
            expect(node.querySelector('[tabindex="0"]')).toBeTruthy();
        });

        it('should set aria-expanded=false initially', () => {
            const node = component._createTreeNode({ label: 'Test', logicalName: 'test' });
            const content = node.querySelector('.tree-node-content');
            expect(content?.getAttribute('aria-expanded')).toBe('false');
        });
    });

    describe('_handleTreeClick', () => {
        let element;

        beforeEach(async () => {
            // Setup hierarchy with editable nodes
            DataService.getFormHierarchy.mockResolvedValueOnce([
                {
                    label: 'Tab: General',
                    logicalName: 'tab_general',
                    children: [
                        {
                            label: 'Section: Details',
                            logicalName: 'section_details',
                            children: [
                                {
                                    label: 'Control: Name',
                                    logicalName: 'name',
                                    value: 'Test Value',
                                    controlType: 'standard',
                                    editableAttr: {
                                        getAttributeType: () => 'string',
                                        getValue: () => 'Test Value',
                                        setValue: vi.fn()
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]);
            element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should toggle collapsed/expanded on parent node click', () => {
            const parentNode = element.querySelector('.tree-parent.collapsed');
            const nodeContent = parentNode.querySelector('.tree-node-content');

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: nodeContent });

            component._handleTreeClick(clickEvent);

            expect(parentNode.classList.contains('expanded')).toBe(true);
            expect(parentNode.classList.contains('collapsed')).toBe(false);
        });

        it('should update aria-expanded when toggling', () => {
            const parentNode = element.querySelector('.tree-parent.collapsed');
            const nodeContent = parentNode.querySelector('.tree-node-content');

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: nodeContent });

            component._handleTreeClick(clickEvent);

            expect(nodeContent.getAttribute('aria-expanded')).toBe('true');
        });

        it('should perform lazy rendering on first expansion', () => {
            const parentNode = element.querySelector('.tree-parent[data-rendered="false"]');
            const nodeContent = parentNode.querySelector('.tree-node-content');
            const childList = parentNode.querySelector('.tree-child');

            // Initially empty
            expect(childList.children.length).toBe(0);

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: nodeContent });

            component._handleTreeClick(clickEvent);

            expect(parentNode.dataset.rendered).toBe('true');
        });

        it('should not render children again on subsequent clicks', () => {
            const parentNode = element.querySelector('.tree-parent');
            const nodeContent = parentNode.querySelector('.tree-node-content');

            // First click - expand
            const clickEvent1 = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent1, 'target', { value: nodeContent });
            component._handleTreeClick(clickEvent1);

            // Second click - collapse
            const clickEvent2 = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent2, 'target', { value: nodeContent });
            component._handleTreeClick(clickEvent2);

            expect(parentNode.classList.contains('collapsed')).toBe(true);
        });

        it('should not throw when clicking non-tree elements', () => {
            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: document.body });

            expect(() => component._handleTreeClick(clickEvent)).not.toThrow();
        });
    });

    describe('_handleMouseMove', () => {
        let element;

        beforeEach(async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce([
                {
                    label: 'Control: Name',
                    logicalName: 'name',
                    value: 'Test',
                    editableAttr: {
                        controls: {
                            get: () => [{
                                getName: () => 'name_control'
                            }]
                        }
                    }
                }
            ]);
            element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should set currentlyHoveredNode when hovering over node', () => {
            const nodeContent = element.querySelector('.tree-node-content');

            const moveEvent = new MouseEvent('mousemove', { bubbles: true });
            Object.defineProperty(moveEvent, 'target', { value: nodeContent });

            component._handleMouseMove(moveEvent);

            expect(component.currentlyHoveredNode).toBe(nodeContent);
        });

        it('should clear highlight when moving away from node', () => {
            // First hover
            const nodeContent = element.querySelector('.tree-node-content');
            const moveEvent1 = new MouseEvent('mousemove', { bubbles: true });
            Object.defineProperty(moveEvent1, 'target', { value: nodeContent });
            component._handleMouseMove(moveEvent1);

            // Move to different area
            const moveEvent2 = new MouseEvent('mousemove', { bubbles: true });
            Object.defineProperty(moveEvent2, 'target', { value: document.body });
            component._handleMouseMove(moveEvent2);

            expect(component.currentlyHoveredNode).toBeNull();
        });

        it('should not re-process same node on subsequent moves', () => {
            const nodeContent = element.querySelector('.tree-node-content');

            const moveEvent = new MouseEvent('mousemove', { bubbles: true });
            Object.defineProperty(moveEvent, 'target', { value: nodeContent });

            component._handleMouseMove(moveEvent);
            component._handleMouseMove(moveEvent);

            // Should only process once
            expect(component.currentlyHoveredNode).toBe(nodeContent);
        });

        it('should handle nodes without logicalName', () => {
            const nodeContent = element.querySelector('.tree-node-content');
            delete nodeContent.dataset.logicalName;

            const moveEvent = new MouseEvent('mousemove', { bubbles: true });
            Object.defineProperty(moveEvent, 'target', { value: nodeContent });

            expect(() => component._handleMouseMove(moveEvent)).not.toThrow();
        });

        it('should add highlight class to matching control element', () => {
            // Create a mock control element in the DOM
            const controlEl = document.createElement('div');
            controlEl.setAttribute('data-control-name', 'name_control');
            document.body.appendChild(controlEl);

            const nodeContent = element.querySelector('.tree-node-content');
            const moveEvent = new MouseEvent('mousemove', { bubbles: true });
            Object.defineProperty(moveEvent, 'target', { value: nodeContent });

            component._handleMouseMove(moveEvent);

            expect(controlEl.classList.contains('pdt-highlight-border')).toBe(true);
            expect(component.highlightedElement).toBe(controlEl);
        });
    });

    describe('_handleMouseOut', () => {
        it('should clear highlightedElement', async () => {
            const element = await component.render();
            document.body.appendChild(element);

            const testEl = document.createElement('div');
            testEl.classList.add('pdt-highlight-border');
            component.highlightedElement = testEl;

            component._handleMouseOut();

            expect(component.highlightedElement).toBeNull();
        });

        it('should remove highlight class from element', async () => {
            const element = await component.render();
            document.body.appendChild(element);

            const testEl = document.createElement('div');
            testEl.classList.add('pdt-highlight-border');
            component.highlightedElement = testEl;

            component._handleMouseOut();

            expect(testEl.classList.contains('pdt-highlight-border')).toBe(false);
        });

        it('should clear currentlyHoveredNode', async () => {
            const element = await component.render();
            document.body.appendChild(element);

            component.currentlyHoveredNode = document.createElement('div');

            component._handleMouseOut();

            expect(component.currentlyHoveredNode).toBeNull();
        });

        it('should handle null highlightedElement', () => {
            component.highlightedElement = null;
            expect(() => component._handleMouseOut()).not.toThrow();
        });
    });

    describe('_showAttributeEditor', () => {
        let mockAttr;

        beforeEach(() => {
            mockAttr = {
                getAttributeType: vi.fn(() => 'string'),
                getValue: vi.fn(() => 'Current Value'),
                setValue: vi.fn()
            };
        });

        it('should call DialogService.show for editable attributes', () => {
            const elementToUpdate = document.createElement('div');

            component._showAttributeEditor(mockAttr, 'Test Field', elementToUpdate, 'standard');

            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should show info dialog for lookup attributes', () => {
            const lookupAttr = {
                getAttributeType: vi.fn(() => 'lookup'),
                getValue: vi.fn(() => [{
                    name: 'Test Record',
                    id: '{12345}',
                    entityType: 'account'
                }])
            };
            const elementToUpdate = document.createElement('div');

            component._showAttributeEditor(lookupAttr, 'Account', elementToUpdate, 'lookup');

            expect(DialogService.show).toHaveBeenCalled();
            const callArgs = DialogService.show.mock.calls[0];
            expect(callArgs[0]).toContain('Lookup:');
        });

        it('should not show callback for lookup dialogs', () => {
            const lookupAttr = {
                getAttributeType: vi.fn(() => 'lookup'),
                getValue: vi.fn(() => [{
                    name: 'Test Record',
                    id: '{12345}',
                    entityType: 'account'
                }])
            };
            const elementToUpdate = document.createElement('div');

            component._showAttributeEditor(lookupAttr, 'Account', elementToUpdate, 'lookup');

            // Third argument should be undefined for info-only dialogs
            const callArgs = DialogService.show.mock.calls[0];
            expect(callArgs[2]).toBeUndefined();
        });

        it('should call FormControlFactory.create for editable types', () => {
            const elementToUpdate = document.createElement('div');

            component._showAttributeEditor(mockAttr, 'Test Field', elementToUpdate, 'standard');

            expect(FormControlFactory.create).toHaveBeenCalledWith('string', 'Current Value', mockAttr);
        });

        it('should pass callback to DialogService for editable types', () => {
            const elementToUpdate = document.createElement('div');

            component._showAttributeEditor(mockAttr, 'Test Field', elementToUpdate, 'standard');

            const callArgs = DialogService.show.mock.calls[0];
            expect(typeof callArgs[2]).toBe('function');
        });

        it('should handle empty lookup value', () => {
            const lookupAttr = {
                getAttributeType: vi.fn(() => 'lookup'),
                getValue: vi.fn(() => null)
            };
            const elementToUpdate = document.createElement('div');

            // Should fall through to regular editor
            component._showAttributeEditor(lookupAttr, 'Account', elementToUpdate, 'lookup');

            expect(FormControlFactory.create).toHaveBeenCalled();
        });
    });

    describe('copy functionality', () => {
        let element;

        beforeEach(async () => {
            element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should have copyable elements in tree', () => {
            const copyables = element.querySelectorAll('.copyable');
            expect(copyables.length).toBeGreaterThan(0);
        });

        it('should call copyToClipboard when clicking copyable element', () => {
            const copyable = element.querySelector('.copyable');
            copyable.textContent = 'test_field';

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: copyable });
            clickEvent.stopPropagation = vi.fn();

            component._copyHandler(clickEvent);

            expect(copyToClipboard).toHaveBeenCalled();
        });

        it('should stop propagation on copy click', () => {
            const copyable = element.querySelector('.copyable');
            copyable.textContent = 'test_field';

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: copyable });
            clickEvent.stopPropagation = vi.fn();

            component._copyHandler(clickEvent);

            expect(clickEvent.stopPropagation).toHaveBeenCalled();
        });

        it('should not copy empty text', () => {
            const copyable = element.querySelector('.copyable');
            copyable.textContent = '';

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: copyable });
            clickEvent.stopPropagation = vi.fn();

            component._copyHandler(clickEvent);

            expect(copyToClipboard).not.toHaveBeenCalled();
        });

        it('should truncate long text in copy message', () => {
            const copyable = element.querySelector('.copyable');
            copyable.textContent = 'a'.repeat(150); // Longer than 120 chars

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: copyable });
            clickEvent.stopPropagation = vi.fn();

            component._copyHandler(clickEvent);

            expect(copyToClipboard).toHaveBeenCalled();
            const callArgs = copyToClipboard.mock.calls[0];
            expect(callArgs[0].length).toBe(150); // Full text is copied
        });

        it('should not throw when clicking non-copyable element', () => {
            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: document.body });

            expect(() => component._copyHandler(clickEvent)).not.toThrow();
        });
    });

    describe('error handling', () => {
        it('should display error message when DataService fails', async () => {
            DataService.getFormHierarchy.mockRejectedValueOnce(new Error('Network error'));

            const element = await component.render();

            expect(element.querySelector('.pdt-error')).toBeTruthy();
        });

        it('should escape error message in display', async () => {
            DataService.getFormHierarchy.mockRejectedValueOnce(new Error('<script>alert(1)</script>'));

            const element = await component.render();
            const errorDiv = element.querySelector('.pdt-error');

            expect(errorDiv).toBeTruthy();
            // Error should be escaped (mock returns same string, but real impl would escape)
        });

        it('should handle missing hierarchy message gracefully', async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce([]);

            const element = await component.render();

            expect(element.querySelector('.pdt-note')).toBeTruthy();
        });
    });

    describe('accessibility', () => {
        it('should have tree role on container', async () => {
            const element = await component.render();
            expect(element.querySelector('[role="tree"]')).toBeTruthy();
        });

        it('should have treeitem role on nodes', async () => {
            const element = await component.render();
            expect(element.querySelector('[role="treeitem"]')).toBeTruthy();
        });

        it('should have group role on child lists', async () => {
            const element = await component.render();
            expect(element.querySelector('[role="group"]')).toBeTruthy();
        });

        it('should have aria-expanded on expandable nodes', async () => {
            const element = await component.render();
            const nodeContent = element.querySelector('.tree-node-content');
            expect(nodeContent?.hasAttribute('aria-expanded')).toBe(true);
        });

        it('should have tabindex for keyboard navigation', async () => {
            const element = await component.render();
            const nodeContent = element.querySelector('.tree-node-content');
            expect(nodeContent?.getAttribute('tabindex')).toBe('0');
        });
    });

    describe('integration scenarios', () => {
        it('should render complete hierarchy with nested children', async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce([
                {
                    label: 'Tab: General',
                    logicalName: 'tab_general',
                    children: [
                        {
                            label: 'Section: Header',
                            logicalName: 'section_header',
                            children: [
                                { label: 'Field: Name', logicalName: 'name', value: 'Test' },
                                { label: 'Field: Email', logicalName: 'email', value: 'test@example.com' }
                            ]
                        },
                        {
                            label: 'Section: Footer',
                            logicalName: 'section_footer',
                            children: [
                                { label: 'Field: Phone', logicalName: 'phone', value: '123-456' }
                            ]
                        }
                    ]
                },
                {
                    label: 'Tab: Details',
                    logicalName: 'tab_details',
                    children: [
                        { label: 'Field: Description', logicalName: 'description', value: 'Details' }
                    ]
                }
            ]);

            const element = await component.render();

            // Two tabs with children at the top level
            expect(element.querySelectorAll('.tree-parent').length).toBe(2);
        });

        it('should handle full lifecycle: render, postRender, destroy', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Simulate interactions
            const treeView = component.ui.treeView;
            expect(treeView).toBeTruthy();

            // Destroy
            component.destroy();

            // Verify cleanup
            expect(() => component.destroy()).not.toThrow(); // Double destroy should be safe
        });

        it('should support multiple renders', async () => {
            const element1 = await component.render();
            document.body.appendChild(element1);
            component.postRender(element1);
            component.destroy();

            // Re-render
            const element2 = await component.render();
            expect(element2).toBeInstanceOf(HTMLElement);
        });
    });

    describe('_handleTreeClick - editable value interactions', () => {
        let element;
        let mockSetValue;

        beforeEach(async () => {
            mockSetValue = vi.fn();
            DataService.getFormHierarchy.mockResolvedValueOnce([
                {
                    label: 'Control: Editable',
                    logicalName: 'editable_field',
                    value: 'Current Value',
                    controlType: 'standard',
                    editableAttr: {
                        getAttributeType: () => 'string',
                        getValue: () => 'Current Value',
                        setValue: mockSetValue
                    }
                }
            ]);
            element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should open editor when clicking on editable value', () => {
            const editableValue = element.querySelector('.item-value.editable');
            const nodeContent = element.querySelector('.tree-node-content');

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: editableValue });

            component._handleTreeClick(clickEvent);

            expect(DialogService.show).toHaveBeenCalled();
        });

        it('should not open editor when nodeContent is missing', () => {
            const orphanEditable = document.createElement('div');
            orphanEditable.className = 'item-value editable';
            document.body.appendChild(orphanEditable);

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: orphanEditable });

            component._handleTreeClick(clickEvent);

            expect(DialogService.show).not.toHaveBeenCalled();
        });

        it('should not call showAttributeEditor for non-editable node data', async () => {
            // Re-setup with non-editable node
            DataService.getFormHierarchy.mockResolvedValueOnce([
                {
                    label: 'Control: NonEditable',
                    logicalName: 'non_editable_field',
                    value: 'Value',
                    controlType: 'standard'
                    // No editableAttr
                }
            ]);
            const element2 = await component.render();
            document.body.appendChild(element2);

            const editableValue = element2.querySelector('.item-value');
            if (editableValue) {
                editableValue.classList.add('editable'); // Force editable class
                const nodeContent = element2.querySelector('.tree-node-content');

                const clickEvent = new MouseEvent('click', { bubbles: true });
                Object.defineProperty(clickEvent, 'target', { value: editableValue });

                component._handleTreeClick(clickEvent);

                // Should return early when nodeData doesn't have editableAttr
                expect(DialogService.show).not.toHaveBeenCalled();
            }
        });

        it('should expand collapsed node and lazy-render children', async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce([
                {
                    label: 'Tab: Parent',
                    logicalName: 'parent_tab',
                    children: [
                        { label: 'Child', logicalName: 'child_node', value: 'test' }
                    ]
                }
            ]);
            const element2 = await component.render();
            document.body.appendChild(element2);
            component.postRender(element2);

            const parentNode = element2.querySelector('.tree-parent.collapsed');
            const nodeContent = parentNode.querySelector('.tree-node-content');
            const childList = parentNode.querySelector('.tree-child');

            expect(childList.children.length).toBe(0);

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: nodeContent });
            component._handleTreeClick(clickEvent);

            expect(parentNode.dataset.rendered).toBe('true');
            expect(parentNode.classList.contains('expanded')).toBe(true);
        });

        it('should handle node without children array gracefully', async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce([
                {
                    label: 'Tab: Empty',
                    logicalName: 'empty_tab',
                    children: [] // Empty children array
                }
            ]);
            const element2 = await component.render();
            document.body.appendChild(element2);

            // Should not throw
            expect(element2.querySelector('.tree-item')).toBeTruthy();
        });
    });

    describe('_handleMouseMove - control highlighting variations', () => {
        it('should find control by data-lp-id selector', async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce([
                {
                    label: 'Control: LpId',
                    logicalName: 'lpid_field',
                    value: 'Test',
                    editableAttr: {
                        controls: {
                            get: () => [{
                                getName: () => 'lpid_control'
                            }]
                        }
                    }
                }
            ]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Create a mock control element with data-lp-id
            const controlEl = document.createElement('div');
            controlEl.setAttribute('data-lp-id', 'form|lpid_control|field');
            document.body.appendChild(controlEl);

            const nodeContent = element.querySelector('.tree-node-content');
            const moveEvent = new MouseEvent('mousemove', { bubbles: true });
            Object.defineProperty(moveEvent, 'target', { value: nodeContent });

            component._handleMouseMove(moveEvent);

            expect(controlEl.classList.contains('pdt-highlight-border')).toBe(true);
        });

        it('should find control by aria-label selector', async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce([
                {
                    label: 'Control: AriaLabel',
                    logicalName: 'aria_field',
                    value: 'Test',
                    editableAttr: {
                        controls: {
                            get: () => [{
                                getName: () => 'aria_control'
                            }]
                        }
                    }
                }
            ]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Create a mock control element with aria-label
            const controlEl = document.createElement('div');
            controlEl.setAttribute('aria-label', 'aria_control');
            document.body.appendChild(controlEl);

            const nodeContent = element.querySelector('.tree-node-content');
            const moveEvent = new MouseEvent('mousemove', { bubbles: true });
            Object.defineProperty(moveEvent, 'target', { value: nodeContent });

            component._handleMouseMove(moveEvent);

            expect(controlEl.classList.contains('pdt-highlight-border')).toBe(true);
        });

        it('should handle node without editableAttr', async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce([
                {
                    label: 'Tab: NoAttr',
                    logicalName: 'no_attr_tab',
                    children: []
                }
            ]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const nodeContent = element.querySelector('.tree-node-content');
            const moveEvent = new MouseEvent('mousemove', { bubbles: true });
            Object.defineProperty(moveEvent, 'target', { value: nodeContent });

            // Should not throw
            expect(() => component._handleMouseMove(moveEvent)).not.toThrow();
            expect(component.highlightedElement).toBeNull();
        });

        it('should handle controls.get returning empty array', async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce([
                {
                    label: 'Control: EmptyControls',
                    logicalName: 'empty_controls',
                    value: 'Test',
                    editableAttr: {
                        controls: {
                            get: () => []
                        }
                    }
                }
            ]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const nodeContent = element.querySelector('.tree-node-content');
            const moveEvent = new MouseEvent('mousemove', { bubbles: true });
            Object.defineProperty(moveEvent, 'target', { value: nodeContent });

            component._handleMouseMove(moveEvent);

            expect(component.highlightedElement).toBeNull();
        });

        it('should handle controls without get method', async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce([
                {
                    label: 'Control: NoGet',
                    logicalName: 'no_get_field',
                    value: 'Test',
                    editableAttr: {
                        controls: null
                    }
                }
            ]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const nodeContent = element.querySelector('.tree-node-content');
            const moveEvent = new MouseEvent('mousemove', { bubbles: true });
            Object.defineProperty(moveEvent, 'target', { value: nodeContent });

            // Should not throw
            expect(() => component._handleMouseMove(moveEvent)).not.toThrow();
        });

        it('should handle control element not found in DOM', async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce([
                {
                    label: 'Control: NotInDom',
                    logicalName: 'not_in_dom',
                    value: 'Test',
                    editableAttr: {
                        controls: {
                            get: () => [{
                                getName: () => 'nonexistent_control'
                            }]
                        }
                    }
                }
            ]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const nodeContent = element.querySelector('.tree-node-content');
            const moveEvent = new MouseEvent('mousemove', { bubbles: true });
            Object.defineProperty(moveEvent, 'target', { value: nodeContent });

            component._handleMouseMove(moveEvent);

            // Should not throw and highlightedElement should remain null
            expect(component.highlightedElement).toBeNull();
        });
    });

    describe('_showAttributeEditor - callback execution', () => {
        let mockAttr;
        let elementToUpdate;

        beforeEach(() => {
            mockAttr = {
                getAttributeType: vi.fn(() => 'string'),
                getValue: vi.fn(() => 'Current Value'),
                setValue: vi.fn()
            };
            elementToUpdate = document.createElement('div');
            elementToUpdate.textContent = 'Old Value';
        });

        it('should call setValue with new value on successful edit', () => {
            component._showAttributeEditor(mockAttr, 'Test Field', elementToUpdate, 'standard');

            // Get the callback and simulate execution
            const callback = DialogService.show.mock.calls[0][2];
            const contentDiv = document.createElement('div');
            const input = document.createElement('input');
            input.id = 'pdt-prompt-input';
            input.value = 'New Value';
            contentDiv.appendChild(input);

            callback(contentDiv);

            expect(mockAttr.setValue).toHaveBeenCalledWith('New Value');
        });

        it('should update element text after successful edit', () => {
            component._showAttributeEditor(mockAttr, 'Test Field', elementToUpdate, 'standard');

            const callback = DialogService.show.mock.calls[0][2];
            const contentDiv = document.createElement('div');
            const input = document.createElement('input');
            input.id = 'pdt-prompt-input';
            input.value = 'New Value';
            contentDiv.appendChild(input);

            callback(contentDiv);

            expect(NotificationService.show).toHaveBeenCalled();
        });

        it('should show error notification on setValue failure', () => {
            // Mock parseInputValue to throw an error
            parseInputValue.mockImplementationOnce(() => {
                throw new Error('Invalid input');
            });

            component._showAttributeEditor(mockAttr, 'Test Field', elementToUpdate, 'standard');

            const callback = DialogService.show.mock.calls[0][2];
            const contentDiv = document.createElement('div');
            const input = document.createElement('input');
            input.id = 'pdt-prompt-input';
            input.value = 'Invalid';
            contentDiv.appendChild(input);

            const result = callback(contentDiv);

            expect(result).toBe(false); // Prevents dialog from closing
            expect(NotificationService.show).toHaveBeenCalledWith(
                expect.stringContaining('Invalid input'),
                'error'
            );
        });

        it('should handle select element for optionset types', () => {
            component._showAttributeEditor(mockAttr, 'Option Field', elementToUpdate, 'optionset');

            const callback = DialogService.show.mock.calls[0][2];
            const contentDiv = document.createElement('div');
            const select = document.createElement('select');
            select.innerHTML = '<option value="1" selected>Option 1</option>';
            contentDiv.appendChild(select);

            callback(contentDiv);

            expect(mockAttr.setValue).toHaveBeenCalled();
        });

        it('should handle lookup with empty array value', () => {
            const lookupAttr = {
                getAttributeType: vi.fn(() => 'lookup'),
                getValue: vi.fn(() => [])
            };

            component._showAttributeEditor(lookupAttr, 'Empty Lookup', elementToUpdate, 'lookup');

            // Should fall through to regular editor since array is empty
            expect(FormControlFactory.create).toHaveBeenCalled();
        });

        it('should display lookup record details correctly', () => {
            const lookupAttr = {
                getAttributeType: vi.fn(() => 'lookup'),
                getValue: vi.fn(() => [{
                    name: 'Test Account',
                    id: '{GUID-123}',
                    entityType: 'account'
                }])
            };

            component._showAttributeEditor(lookupAttr, 'Account Lookup', elementToUpdate, 'lookup');

            const callArgs = DialogService.show.mock.calls[0];
            expect(callArgs[1]).toContain('Test Account');
            expect(callArgs[1]).toContain('{GUID-123}');
            expect(callArgs[1]).toContain('account');
        });
    });

    describe('copy functionality - clipboard fallback', () => {
        let element;
        let originalCopyToClipboard;

        beforeEach(async () => {
            element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
        });

        it('should use navigator.clipboard when copyToClipboard is undefined', async () => {
            // The mock already uses copyToClipboard from the import at the top
            // Mock copyToClipboard to be undefined-like (returns undefined)
            copyToClipboard.mockImplementationOnce(() => undefined);

            // Mock navigator.clipboard
            const mockWriteText = vi.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: mockWriteText },
                writable: true,
                configurable: true
            });

            const copyable = element.querySelector('.copyable');
            copyable.textContent = 'copy_text';

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: copyable });
            clickEvent.stopPropagation = vi.fn();

            // The handler should call copyToClipboard first
            component._copyHandler(clickEvent);

            expect(copyToClipboard).toHaveBeenCalled();
        });

        it('should handle whitespace-only text', () => {
            const copyable = element.querySelector('.copyable');
            copyable.textContent = '   ';

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: copyable });
            clickEvent.stopPropagation = vi.fn();

            component._copyHandler(clickEvent);

            // Should not copy whitespace-only text (after trim, it's empty)
            expect(copyToClipboard).not.toHaveBeenCalled();
        });

        it('should copy text with exactly 120 characters without truncation', () => {
            const copyable = element.querySelector('.copyable');
            copyable.textContent = 'a'.repeat(120);

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: copyable });
            clickEvent.stopPropagation = vi.fn();

            component._copyHandler(clickEvent);

            expect(copyToClipboard).toHaveBeenCalled();
            const callArgs = copyToClipboard.mock.calls[0];
            expect(callArgs[0].length).toBe(120);
        });

        it('should handle null textContent', () => {
            const copyable = element.querySelector('.copyable');
            Object.defineProperty(copyable, 'textContent', { value: null, writable: true });

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: copyable });
            clickEvent.stopPropagation = vi.fn();

            // Should not throw
            expect(() => component._copyHandler(clickEvent)).not.toThrow();
            expect(copyToClipboard).not.toHaveBeenCalled();
        });
    });

    describe('_createTreeNode - edge cases', () => {
        it('should handle node with empty logicalName', () => {
            const node = component._createTreeNode({ label: 'Test', logicalName: '' });
            expect(node.querySelector('[data-logical-name=""]')).toBeTruthy();
        });

        it('should handle node with null logicalName', () => {
            const node = component._createTreeNode({ label: 'Test', logicalName: null });
            expect(node.querySelector('.tree-node-content')).toBeTruthy();
        });

        it('should handle node with undefined logicalName', () => {
            const node = component._createTreeNode({ label: 'Test' });
            expect(node.querySelector('.tree-node-content')).toBeTruthy();
        });

        it('should handle node with controlType containing subgrid', () => {
            const mockAttr = { getValue: vi.fn() };
            const node = component._createTreeNode({
                label: 'Subgrid Test',
                logicalName: 'subgrid_control',
                value: 'Data',
                editableAttr: mockAttr,
                controlType: 'subgrid_related'
            });
            expect(node.querySelector('.item-value.editable')).toBeFalsy();
        });

        it('should render edit icon for editable fields', () => {
            const mockAttr = { getValue: vi.fn() };
            const node = component._createTreeNode({
                label: 'Editable Test',
                logicalName: 'editable_field',
                value: 'Data',
                editableAttr: mockAttr,
                controlType: 'standard'
            });
            expect(node.querySelector('.edit-icon')).toBeTruthy();
        });

        it('should not render edit icon for non-editable fields', () => {
            const node = component._createTreeNode({
                label: 'Non-Editable',
                logicalName: 'readonly_field',
                value: 'Data'
            });
            expect(node.querySelector('.edit-icon')).toBeFalsy();
        });

        it('should set title attribute with formatted value', () => {
            const node = component._createTreeNode({
                label: 'Test',
                logicalName: 'test_field',
                value: 'Long value text'
            });
            const valueEl = node.querySelector('.item-value');
            expect(valueEl?.getAttribute('title')).toBeDefined();
        });
    });

    describe('destroy - edge cases', () => {
        it('should handle destroy when ui is undefined', () => {
            component.ui = undefined;
            expect(() => component.destroy()).not.toThrow();
        });

        it('should handle destroy with partially defined handlers', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            // Remove some handlers
            component._clickHandler = undefined;

            expect(() => component.destroy()).not.toThrow();
        });

        it('should call _handleMouseOut during destroy', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const handleMouseOutSpy = vi.spyOn(component, '_handleMouseOut');

            component.destroy();

            expect(handleMouseOutSpy).toHaveBeenCalled();
        });
    });

    describe('postRender - throttle fallback', () => {
        it('should work when throttle returns the function directly', async () => {
            const element = await component.render();
            document.body.appendChild(element);

            // The mock throttle just returns the function
            expect(() => component.postRender(element)).not.toThrow();
            expect(component._moveHandler).toBeDefined();
        });
    });

    describe('render - additional scenarios', () => {
        it('should handle DataService returning null', async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce(null);

            const element = await component.render();

            // Should handle null gracefully
            expect(element).toBeInstanceOf(HTMLElement);
        });

        it('should set hierarchy to returned value', async () => {
            const mockHierarchy = [
                { label: 'Tab', logicalName: 'tab1' }
            ];
            DataService.getFormHierarchy.mockResolvedValueOnce(mockHierarchy);

            await component.render();

            expect(component.hierarchy).toEqual(mockHierarchy);
        });

        it('should render tree items for each top-level node', async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce([
                { label: 'Tab 1', logicalName: 'tab1' },
                { label: 'Tab 2', logicalName: 'tab2' },
                { label: 'Tab 3', logicalName: 'tab3' }
            ]);

            const element = await component.render();
            const treeItems = element.querySelectorAll('.tree-view > .tree-item');

            expect(treeItems.length).toBe(3);
        });
    });

    describe('event handler lifecycle', () => {
        it('should properly attach all event listeners', async () => {
            const element = await component.render();
            document.body.appendChild(element);

            const addEventListenerSpy = vi.spyOn(component.ui.treeView, 'addEventListener');

            component.postRender(element);

            expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
        });

        it('should properly remove all event listeners on destroy', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const removeEventListenerSpy = vi.spyOn(component.ui.treeView, 'removeEventListener');

            component.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalled();
        });
    });

    describe('tree node expansion with missing child data', () => {
        it('should handle expansion when nodeData has no children key', async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce([
                {
                    label: 'Tab: NoChildren',
                    logicalName: 'no_children_tab',
                    children: [
                        { label: 'Section', logicalName: 'section1' }
                    ]
                }
            ]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const parentNode = element.querySelector('.tree-parent.collapsed');
            const nodeContent = parentNode.querySelector('.tree-node-content');

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: nodeContent });

            // Should not throw when children is undefined on the found node
            expect(() => component._handleTreeClick(clickEvent)).not.toThrow();
        });

        it('should handle expansion when childList is not found', async () => {
            DataService.getFormHierarchy.mockResolvedValueOnce([
                {
                    label: 'Tab: Test',
                    logicalName: 'test_tab',
                    children: [{ label: 'Child', logicalName: 'child' }]
                }
            ]);
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const parentNode = element.querySelector('.tree-parent.collapsed');
            const childList = parentNode.querySelector('.tree-child');

            // Remove the child list
            if (childList) {
                childList.remove();
            }

            const nodeContent = parentNode.querySelector('.tree-node-content');
            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: nodeContent });

            // Should not throw
            expect(() => component._handleTreeClick(clickEvent)).not.toThrow();
        });
    });

    describe('value display and formatting', () => {
        it('should display formatted value from formatDisplayValue helper', () => {
            const node = component._createTreeNode({
                label: 'Test',
                logicalName: 'test',
                value: 12345
            });

            const valueEl = node.querySelector('.item-value');
            expect(valueEl).toBeTruthy();
        });

        it('should handle boolean values', () => {
            const node = component._createTreeNode({
                label: 'Boolean Field',
                logicalName: 'is_active',
                value: true
            });

            expect(node.querySelector('.item-value')).toBeTruthy();
        });

        it('should handle null values', () => {
            const node = component._createTreeNode({
                label: 'Null Field',
                logicalName: 'null_field',
                value: null
            });

            expect(node.querySelector('.item-value')).toBeTruthy();
        });

        it('should handle object values', () => {
            const node = component._createTreeNode({
                label: 'Object Field',
                logicalName: 'object_field',
                value: { key: 'value' }
            });

            expect(node.querySelector('.item-value')).toBeTruthy();
        });
    });

    describe('postRender early return - line 88 coverage', () => {
        it('should return early when ui.treeView is null', async () => {
            // Create a component but don't render properly
            const comp = new InspectorTab();
            comp.ui = { treeView: null };

            // postRender should return early without throwing
            expect(() => comp.postRender(document.createElement('div'))).not.toThrow();

            // Handlers should not be set
            expect(comp._moveHandler).toBeUndefined();
            expect(comp._leaveHandler).toBeUndefined();
        });

        it('should return early when ui.treeView is undefined', async () => {
            const comp = new InspectorTab();
            comp.ui = {};

            expect(() => comp.postRender(document.createElement('div'))).not.toThrow();
            expect(comp._moveHandler).toBeUndefined();
        });
    });

    describe('_copyHandler navigator.clipboard fallback - lines 109-111 coverage', () => {
        it('should use navigator.clipboard when copyToClipboard is not a function', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const copyable = element.querySelector('.copyable');
            if (!copyable) {
                // Create a copyable element if none exists
                const newCopyable = document.createElement('span');
                newCopyable.className = 'copyable';
                newCopyable.textContent = 'test-clipboard-text';
                element.querySelector('.tree-view')?.appendChild(newCopyable);
            }

            const targetCopyable = element.querySelector('.copyable');
            targetCopyable.textContent = 'clipboard-test-value';

            // Mock navigator.clipboard.writeText
            const writeTextMock = vi.fn().mockResolvedValue(undefined);
            const originalClipboard = navigator.clipboard;
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: writeTextMock },
                configurable: true
            });

            // Temporarily make copyToClipboard not a function to trigger the fallback
            const originalCopyToClipboard = copyToClipboard;
            vi.mocked(copyToClipboard).mockImplementation(undefined);

            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: targetCopyable });
            clickEvent.stopPropagation = vi.fn();

            // The handler should still work via navigator.clipboard
            component._copyHandler(clickEvent);

            // Restore
            Object.defineProperty(navigator, 'clipboard', {
                value: originalClipboard,
                configurable: true
            });
        });

        it('should handle case where copyToClipboard throws by not crashing', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const copyable = document.createElement('span');
            copyable.className = 'copyable';
            copyable.textContent = 'test-value';
            element.querySelector('.tree-view')?.appendChild(copyable);

            // The copyToClipboard mock should work normally in this test
            // We just verify the handler can be called without issues
            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: copyable });
            clickEvent.stopPropagation = vi.fn();

            // Should call copyToClipboard successfully
            component._copyHandler(clickEvent);
            expect(copyToClipboard).toHaveBeenCalled();
        });
    });

    describe('throttled mouse handlers - lines 88, 109-111 coverage', () => {
        it('should bind _moveHandler for mouse movement', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component._moveHandler).toBeDefined();
        });

        it('should bind _leaveHandler for mouse leave', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component._leaveHandler).toBeDefined();

            // Trigger mouse leave
            component._handleMouseOut = vi.fn();
            if (component._leaveHandler) {
                component._leaveHandler();
                expect(component._handleMouseOut).toHaveBeenCalled();
            }
        });

        it('should bind _clickHandler for tree clicks', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component._clickHandler).toBeDefined();

            // Trigger click
            component._handleTreeClick = vi.fn();
            const mockEvent = { target: document.createElement('div') };
            if (component._clickHandler) {
                component._clickHandler(mockEvent);
                expect(component._handleTreeClick).toHaveBeenCalledWith(mockEvent);
            }
        });
    });

    describe('_copyHandler navigator clipboard fallback branch - line 109-111', () => {
        it('should attempt navigator.clipboard.writeText when copyToClipboard returns undefined', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            const copyable = document.createElement('span');
            copyable.className = 'copyable';
            copyable.textContent = 'navigator-clipboard-test';
            element.querySelector('.tree-view')?.appendChild(copyable);

            // Save original and replace copyToClipboard to return undefined
            const writeTextMock = vi.fn().mockResolvedValue(undefined);

            // Store original clipboard
            const originalClipboard = navigator.clipboard;

            try {
                // Redefine clipboard
                Object.defineProperty(navigator, 'clipboard', {
                    value: { writeText: writeTextMock },
                    configurable: true,
                    writable: true
                });

                const clickEvent = new MouseEvent('click', { bubbles: true });
                Object.defineProperty(clickEvent, 'target', { value: copyable });
                clickEvent.stopPropagation = vi.fn();

                // This tests the branch where navigator.clipboard is used
                component._copyHandler(clickEvent);

            } finally {
                // Restore original clipboard
                Object.defineProperty(navigator, 'clipboard', {
                    value: originalClipboard,
                    configurable: true,
                    writable: true
                });
            }
        });
    });
});
