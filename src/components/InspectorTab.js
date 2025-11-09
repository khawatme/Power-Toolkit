/**
 * @file Form Inspector component.
 * @module components/InspectorTab
 * @description This tab provides a real-time, interactive tree view of the form's UI hierarchy.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { DataService } from '../services/DataService.js';
import { DialogService } from '../services/DialogService.js';
import { Config } from '../constants/index.js';
import { FormControlFactory } from '../ui/FormControlFactory.js';
import { copyToClipboard, escapeHtml, findNodeInTree, formatDisplayValue, parseInputValue, throttle } from '../helpers/index.js';
import { NotificationService } from '../services/NotificationService.js';

/**
 * Represents a single node in the form's UI hierarchy tree.
 * @typedef {object} TreeNode
 * @property {string} label - The display label for the node (e.g., "Tab: SUMMARY").
 * @property {string} logicalName - The logical name of the underlying component (e.g., "tab_2_section_1").
 * @property {any} [value] - The current value of the component, if applicable.
 * @property {Xrm.Attributes.Attribute} [editableAttr] - The Xrm.Attribute object, if the node represents an editable field.
 * @property {string} [controlType] - The type of the control (e.g., "standard", "lookup", "subgrid").
 * @property {TreeNode[]} [children] - An array of child nodes for parent components like tabs and sections.
 */

/**
 * A component that provides a real-time, interactive, and lazy-loaded tree view
 * of the current form's UI hierarchy (Tabs > Sections > Controls).
 * @extends {BaseComponent}
 * @property {TreeNode[]} hierarchy - Caches the complete form UI hierarchy data.
 * @property {HTMLElement|null} highlightedElement - The DOM element on the main form that is currently highlighted.
 * @property {object} ui - A cache for frequently accessed UI elements.
 */
export class InspectorTab extends BaseComponent {
    /**
     * Initializes a new instance of the InspectorTab class.
     */
    constructor() {
        super('inspector', 'Inspector', ICONS.inspector, true);

        /** @type {HTMLElement|null} The DOM element on the form currently highlighted. */
        this.highlightedElement = null;
        /** @type {HTMLElement|null} The tree node element currently being hovered over. */
        this.currentlyHoveredNode = null;
        /** @type {Array<object>} Caches the form's UI hierarchy data. */
        this.hierarchy = [];
        /** @type {object} Caches references to key UI elements. */
        this.ui = {};
    }

    /**
     * Renders the initial HTML structure of the component.
     * @returns {Promise<HTMLElement>} A promise that resolves with the component's root element.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = '<div class="section-title">Form Inspector</div>';

        try {
            this.hierarchy = await DataService.getFormHierarchy(true);
            if (this.hierarchy.length === 0) {
                container.innerHTML += `<p class='pdt-note'>${Config.MESSAGES.INSPECTOR.hierarchyLoadFailed}</p>`;
            } else {
                const treeContainer = document.createElement('ul');
                treeContainer.className = 'tree-view';
                treeContainer.setAttribute('role', 'tree');
                this.ui.treeView = treeContainer; // Cache the tree container
                container.appendChild(treeContainer);
                this._renderTree(treeContainer, this.hierarchy);
            }
        } catch (error) {
            container.innerHTML += `<div class="pdt-error">${Config.MESSAGES.INSPECTOR.loadFailed(escapeHtml(error.message))}</div>`;
        }
        return container;
    }

    /**
     * Attaches event listeners after the component is rendered.
     * @param {HTMLElement} _element - The root element of the component.
     */
    postRender(_element) {
        if (!this.ui.treeView) {
            return;
        }

        const throttledMove = throttle?.(e => this._handleMouseMove(e), 50)
            || ((e) => this._handleMouseMove(e));

        this._moveHandler = throttledMove;
        this._leaveHandler = () => this._handleMouseOut();
        this._clickHandler = (e) => this._handleTreeClick(e);

        this._copyHandler = (e) => {
            const copyEl = e.target.closest('.copyable');
            if (!copyEl) {
                return;
            }

            const txt = (copyEl.textContent || '').trim();
            if (!txt) {
                return;
            }

            const preview = txt.length > 120 ? txt.slice(0, 117) + '…' : txt;

            if (typeof copyToClipboard === 'function') {
                copyToClipboard(txt, Config.MESSAGES.INSPECTOR.copied(preview));
            } else if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(txt)
                    .then(() => NotificationService.show(Config.MESSAGES.INSPECTOR.copied(preview), 'info'))
                    .catch(() => {/* ignore */ });
            }
            e.stopPropagation();
        };

        this.ui.treeView.addEventListener('click', this._clickHandler);
        this.ui.treeView.addEventListener('click', this._copyHandler, true);
        this.ui.treeView.addEventListener('mousemove', this._moveHandler);
        this.ui.treeView.addEventListener('mouseleave', this._leaveHandler);
    }

    /**
     * Cleans up event listeners and resources when the component is disposed.
     * Removes all attached event handlers and clears any active highlights on the form.
     */
    destroy() {
        this._handleMouseOut?.();

        try {
            if (this.ui?.treeView) {
                if (this._moveHandler) {
                    this.ui.treeView.removeEventListener('mousemove', this._moveHandler);
                }
                if (this._leaveHandler) {
                    this.ui.treeView.removeEventListener('mouseleave', this._leaveHandler);
                }
                if (this._clickHandler) {
                    this.ui.treeView.removeEventListener('click', this._clickHandler);
                }
                if (this._copyHandler) {
                    this.ui.treeView.removeEventListener('click', this._copyHandler, true);
                }
            }
        } catch { }
    }

    /**
     * Handles click events on the tree view. It triggers the value editor for
     * editable fields or toggles the expand/collapse state for parent nodes.
     * It also initiates lazy-loading of child nodes on first expansion.
     * @param {MouseEvent} e - The click event object.
     * @private
     */
    _handleTreeClick(e) {
        const editable = e.target.closest('.item-value.editable');
        const nodeContent = e.target.closest('.tree-node-content');

        // Handle editing a value
        if (editable && nodeContent) {
            const logicalName = nodeContent.dataset.logicalName;
            const nodeData = findNodeInTree(this.hierarchy, 'logicalName', logicalName);
            if (nodeData && nodeData.editableAttr) {
                this._showAttributeEditor(nodeData.editableAttr, nodeData.label, editable, nodeData.controlType);
            }
            return;
        }

        // Handle expanding/collapsing a parent node
        const parentNode = e.target.closest('.tree-parent');
        if (parentNode && nodeContent && parentNode.contains(nodeContent)) {
            // --- LAZY RENDERING LOGIC ---
            // If expanding for the first time, render its children.
            if (parentNode.classList.contains('collapsed') && parentNode.dataset.rendered === 'false') {
                const logicalName = nodeContent.dataset.logicalName;
                const nodeData = findNodeInTree(this.hierarchy, 'logicalName', logicalName);
                const childList = parentNode.querySelector('.tree-child');
                if (nodeData && childList) {
                    this._renderTree(childList, nodeData.children ?? []);
                    parentNode.dataset.rendered = 'true';
                }
            }
            // --- END LAZY RENDERING LOGIC ---

            parentNode.classList.toggle('collapsed');
            parentNode.classList.toggle('expanded');
            const content = parentNode.querySelector('.tree-node-content');
            if (content) {
                content.setAttribute('aria-expanded', String(parentNode.classList.contains('expanded')));
            }
        }
    }

    /**
     * Handles mouse movement over the tree to highlight corresponding fields on the form.
     * This version uses the Xrm API to find a reliable selector for the control.
     * @param {MouseEvent} event - The mousemove event object.
     * @private
     */
    _handleMouseMove(event) {
        const nodeContent = event.target.closest('.tree-node-content');
        if (nodeContent === this.currentlyHoveredNode) {
            return;
        }

        this._handleMouseOut();
        if (!nodeContent) {
            return;
        }

        this.currentlyHoveredNode = nodeContent;
        const logicalName = nodeContent.dataset.logicalName;
        if (!logicalName) {
            return;
        }

        // Find the node data in our hierarchy to get the Xrm.Attribute object.
        const nodeData = findNodeInTree(this.hierarchy, 'logicalName', logicalName);
        if (!nodeData || !nodeData.editableAttr) {
            return;
        }

        // Get all controls associated with this attribute on the form.
        const controls = nodeData.editableAttr.controls?.get?.() || [];
        if (controls.length > 0) {
            const control = controls[0];
            const controlName = control.getName();

            const controlElement =
                document.querySelector(`div[data-control-name="${controlName}"]`)
                || document.querySelector(`[data-lp-id*="${controlName}"]`)
                || document.querySelector(`[aria-label="${controlName}"]`);

            if (controlElement) {
                controlElement.classList.add('pdt-highlight-border');
                this.highlightedElement = controlElement;
            }
        }
    }

    /**
     * Clears any active form field highlighting when the mouse leaves the tree.
     * @private
     */
    _handleMouseOut() {
        if (this.highlightedElement) {
            this.highlightedElement.classList.remove('pdt-highlight-border');
            this.highlightedElement = null;
        }
        this.currentlyHoveredNode = null;
    }

    /**
     * Renders the direct children for a given set of nodes into a parent element.
     * This is now non-recursive to support lazy loading.
     * @param {HTMLElement} parentEl - The `<ul>` element to append children to.
     * @param {Array<object>} nodes - The array of node objects to render.
     * @private
     */
    _renderTree(parentEl, nodes) {
        (nodes ?? []).forEach(node => {
            const li = this._createTreeNode(node);
            if (node.children?.length > 0) {
                li.classList.add('tree-parent', 'collapsed');
                li.dataset.rendered = 'false';

                const childList = document.createElement('ul');
                childList.className = 'tree-child';
                childList.setAttribute('role', 'group');
                li.appendChild(childList);
            }
            parentEl.appendChild(li);
        });
    }

    /**
     * Creates a single tree node `<li>` element from a data object.
     * @param {object} node - The data object for the node.
     * @returns {HTMLElement} The created `<li>` element.
     * @private
     */
    _createTreeNode(node) {
        const listItem = document.createElement('li');
        listItem.className = 'tree-item';

        const valueStr = formatDisplayValue(node.value, node.editableAttr, node.controlType);
        const isEditable = !!node.editableAttr && !node.controlType?.includes('subgrid');

        const valueHtml = node.value !== undefined
            ? `<div class="item-value ${isEditable ? 'editable' : ''}" title="${escapeHtml(valueStr)}">
                ${isEditable ? `<span class="edit-icon">${ICONS.edit}</span>` : ''}
                ${escapeHtml(valueStr)}
              </div>`
            : '';

        listItem.innerHTML = `
    <div class="tree-node-content"
         data-logical-name="${escapeHtml(node.logicalName || '')}"
         role="treeitem"
         tabindex="0"
         aria-expanded="false">
      <div class="item-details">
        <span class="item-label">${escapeHtml(node.label)}</span>
        <span class="item-logical-name copyable" title="Click to copy">${escapeHtml(node.logicalName || '')}</span>
      </div>
      ${valueHtml}
    </div>`;

        return listItem;
    }

    /**
     * Displays a dialog to edit an attribute's value.
     * @param {Xrm.Attributes.Attribute} attr - The form attribute object from the API.
     * @param {string} label - The display label of the attribute.
     * @param {HTMLElement} elementToUpdate - The tree node's value element to update on success.
     * @private
     */
    _showAttributeEditor(attr, label, elementToUpdate, controlType) {
        const attrType = attr.getAttributeType();
        const currentValue = attr.getValue();

        // Handle lookups as a special info-only dialog
        if (attrType === 'lookup' && currentValue?.[0]) {
            const item = currentValue[0];
            const contentHtml = `<div class="info-grid">
                    <strong>Record Name:</strong><span class="copyable">${escapeHtml(item.name)}</span>
                    <strong>Record ID:</strong><span class="copyable">${escapeHtml(item.id)}</span>
                    <strong>Table:</strong><span class="copyable">${escapeHtml(item.entityType)}</span>
                </div>`;
            DialogService.show(`Lookup: ${escapeHtml(label)}`, contentHtml);
            return;
        }

        // Handle all other editable types by creating a form control.
        // We pass the full `attr` object so the factory can build an optionset dropdown.
        const inputHtml = FormControlFactory.create(attrType, currentValue, attr);
        const contentHtml = `<p>Enter new value for <strong>${escapeHtml(label)}</strong>.</p>${inputHtml}`;

        DialogService.show(`Edit: ${escapeHtml(label)}`, contentHtml, (contentDiv) => {
            const input = contentDiv.querySelector('#pdt-prompt-input, select');
            try {
                const newValue = parseInputValue(input, attrType);
                attr.setValue(newValue);
                NotificationService.show(Config.MESSAGES.INSPECTOR.fieldUpdated, 'success');

                // Update the UI in the tree view with the newly formatted value.
                const formattedNewValue = formatDisplayValue(attr.getValue(), attr, controlType);
                elementToUpdate.textContent = formattedNewValue;
                elementToUpdate.title = formattedNewValue;
            } catch (e) {
                NotificationService.show(`${Config.MESSAGES.INSPECTOR.updateFailed} ${e.message}`, 'error');
                return false; // Prevent dialog from closing on error
            }
        });
    }
}