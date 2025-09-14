/**
 * @file Plugin Context Simulator component.
 * @module components/PluginContextTab
 * @description Simulates the server-side plugin context (Target, Pre/Post Images) based on the current form data.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../utils/Icons.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
import { UIFactory } from '../ui/UIFactory.js';
import { DialogService } from '../services/DialogService.js';
import { Helpers } from '../utils/Helpers.js';

/**
 * Type definitions for the objects used in this component.
 * @typedef {object} EntityState
 * @property {object} fullEntity - An object representing all current field values.
 * @property {object} dirtyAttributes - An object representing only the changed field values.
 * @property {object} preImageEntity - An object simulating the pre-image with original values for dirty fields.
 *
 * @typedef {object} PluginContext
 * @property {string} MessageName - The name of the plugin message (e.g., 'Create', 'Update').
 * @property {number} Stage - The pipeline stage (e.g., 20 for Pre-operation).
 * @property {string} PrimaryEntityName - The logical name of the primary entity.
 * @property {string} PrimaryEntityId - The GUID of the record.
 * @property {string} InitiatingUserId - The GUID of the initiating user.
 * @property {object} InputParameters - The input parameters for the message.
 * @property {object} PreEntityImages - The collection of pre-entity images.
 * @property {object} PostEntityImages - The collection of post-entity images.
 */

export class PluginContextTab extends BaseComponent {
    /**
     * Initializes the PluginContextTab component.
     */
    constructor() {
        super('pluginContext', 'Plugin Context', ICONS.pluginContext, true);
        /** @type {object} Caches references to key UI elements. */
        this.ui = {};
    }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="section-title">Plugin Context Simulator</div>
            <p class="pdt-note">
                <strong>Note:</strong> Pre-images are simulated using the field values from when the form first loaded, not necessarily the last saved state from the database.
            </p>
            
            <div class="pdt-form-grid" style="margin-top: 15px;">
                <label for="pdt-plugin-message">Message:</label>
                <select id="pdt-plugin-message" class="pdt-select">
                    <option selected>Update</option>
                    <option>Create</option>
                    <option>Delete</option>
                </select>
                <label for="pdt-plugin-stage">Stage:</label>
                <select id="pdt-plugin-stage" class="pdt-select">
                    <option value="20" selected>Pre-operation (20)</option>
                    <option value="40">Post-operation (40)</option>
                </select>
            </div>

            <div class="pdt-toolbar" style="margin-top: 15px; justify-content:flex-end;">
                <button id="pdt-generate-context-btn" class="modern-button">Generate Context</button>
            </div>
            <div id="pdt-context-output"></div>`;
        return container;
    }

    /**
     * Caches UI elements and attaches a robust event listener after the component is added to the DOM.
     * @param {HTMLElement} element - The root element of the component.
     */
    postRender(element) {
        this.ui = {
            messageSelect: element.querySelector('#pdt-plugin-message'),
            stageSelect: element.querySelector('#pdt-plugin-stage'),
            generateBtn: element.querySelector('#pdt-generate-context-btn'),
            outputContainer: element.querySelector('#pdt-context-output')
        };

        this.ui.generateBtn.onclick = () => {
            try {
                const message = this.ui.messageSelect.value;
                const stage = parseInt(this.ui.stageSelect.value, 10);
                const context = this._buildContext(message, stage);
                this._renderContext(context);
            } catch (error) {
                console.error("Power-Toolkit Error generating context:", error);
                const errorMessage = `
                    <div class="pdt-error" style="margin-top: 15px;">
                        <strong>Failed to Generate Context</strong>
                        <p>The form may have tried to auto-save with invalid data, which interrupted the process. This is often caused by duplicate values (like the "Name already exists" error) or other server validation rule failures.</p>
                        <p><strong>Suggestion:</strong> Resolve any form errors, save your changes manually, and then try generating the context again.</p>
                        <hr>
                        <p><strong>Details:</strong> ${error.message || 'An unexpected error occurred.'}</p>
                    </div>`;
                this.ui.outputContainer.innerHTML = errorMessage;
            }
        };
    }

    /**
     * Renders the generated context object to the UI.
     * @param {PluginContext} context - The generated context object.
     * @private
     */
    _renderContext(context) {
        this.ui.outputContainer.innerHTML = ''; 

        const createSection = (title, data, emptyMessage) => {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'pdt-context-section';
            if (!data || Object.keys(data).length === 0) {
                sectionDiv.innerHTML = `<h4 class="pdt-section-header">${title}</h4><p class="pdt-note">${emptyMessage}</p>`;
                return sectionDiv;
            }
            sectionDiv.innerHTML = `<h4 class="pdt-section-header">${title}</h4>`;
            sectionDiv.appendChild(UIFactory.createCopyableCodeBlock(JSON.stringify(data, null, 2), 'json'));
            return sectionDiv;
        };
        
        const emptyMessages = {
            target: context.MessageName === 'Update' 
                ? 'Target is empty. Change a field on the form to see it populated.' 
                : 'Target is not applicable for this message.',
            preImage: context.MessageName === 'Update'
                ? 'Pre-Image is only generated when at least one field is updated.'
                : 'Pre-Image is not available for this message in the Pre-operation stage.',
            postImage: 'Post-Image is only available in a Post-operation (40) stage.'
        };
        
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'pdt-context-details';
        const sections = [
            createSection('InputParameters["Target"]', context.InputParameters.Target, emptyMessages.target),
            createSection('PreEntityImages["preimage"]', context.PreEntityImages.preimage, emptyMessages.preImage),
            createSection('PostEntityImages["postimage"]', context.PostEntityImages.postimage, emptyMessages.postImage)
        ];
        sections.forEach((section, index) => {
            if (index > 0) section.style.marginTop = '15px';
            detailsContainer.appendChild(section);
        });
        
        const testButton = document.createElement('button');
        testButton.id = 'pdt-generate-test-btn';
        testButton.className = 'modern-button secondary';
        testButton.textContent = 'Generate C# Unit Test';
        testButton.style.marginBottom = '15px';
        testButton.onclick = () => this._generateCSharpTest(context);

        this.ui.outputContainer.appendChild(testButton);
        this.ui.outputContainer.appendChild(detailsContainer);
    }
    
    /**
     * Builds the simulated context object based on the current form state.
     * @param {string} message - The plugin message (e.g., 'Create', 'Update').
     * @param {number} stage - The plugin stage (e.g., 20 for Pre-operation).
     * @returns {PluginContext} The simulated context object.
     * @private
     */
    _buildContext(message, stage) {
        const { fullEntity, dirtyAttributes, preImageEntity } = this._getFormEntityState();
        const context = {
            MessageName: message,
            Stage: stage,
            PrimaryEntityName: PowerAppsApiService.getEntityName(),
            PrimaryEntityId: PowerAppsApiService.getEntityId(),
            InitiatingUserId: PowerAppsApiService.getGlobalContext().userSettings.userId.replace(/[{}]/g, ''),
            InputParameters: {},
            PreEntityImages: {},
            PostEntityImages: {}
        };
        
        switch (message.toLowerCase()) {
            case 'create':
                context.InputParameters.Target = fullEntity;
                if (stage === 40) context.PostEntityImages.postimage = { ...fullEntity, id: context.PrimaryEntityId };
                break;
            case 'update':
                context.InputParameters.Target = dirtyAttributes;
                if (Object.keys(dirtyAttributes).length > 0) {
                     context.PreEntityImages.preimage = preImageEntity;
                }
                if (stage === 40) context.PostEntityImages.postimage = fullEntity;
                break;
            case 'delete':
                context.InputParameters.Target = { '@odata.type': 'Microsoft.Dynamics.CRM.entityreference', id: context.PrimaryEntityId, entityType: context.PrimaryEntityName };
                if (stage === 20) context.PreEntityImages.preimage = fullEntity;
                break;
        }
        return context;
    }

    /**
     * Collects the current state of all attributes on the form in a single pass.
     * @returns {EntityState} An object containing the full entity, dirty attributes, and pre-image.
     * @private
     */
    _getFormEntityState() {
        const fullEntity = {};
        const dirtyAttributes = {};
        const preImageEntity = {};

        PowerAppsApiService.getAllAttributes().forEach(attr => {
            if (typeof attr.getValue !== 'function') return;
            const logicalName = attr.getName();
            const currentValue = attr.getValue();
            fullEntity[logicalName] = currentValue;

            if (attr.getIsDirty()) {
                dirtyAttributes[logicalName] = currentValue;
                // FIX: Defensively check if getInitialValue exists before calling it.
                preImageEntity[logicalName] = (typeof attr.getInitialValue === 'function')
                    ? attr.getInitialValue()
                    : null; // Fallback to null if the method doesn't exist for this attribute type.
            } else {
                preImageEntity[logicalName] = currentValue;
            }
        });

        return { fullEntity, dirtyAttributes, preImageEntity };
    }
    
    /**
     * Generates a C# unit test snippet for FakeXrmEasy based on the context.
     * @param {PluginContext} context - The generated context object.
     * @private
     */
    _generateCSharpTest(context) {
        const entityName = context.PrimaryEntityName;
        const targetJson = JSON.stringify(context.InputParameters.Target || {}, null, 2).replace(/"/g, '""');
        const preImageJson = JSON.stringify(context.PreEntityImages.preimage || {}, null, 2).replace(/"/g, '""');
        const primaryIdGuid = context.PrimaryEntityId ? `new Guid("${context.PrimaryEntityId}")` : "Guid.NewGuid()";

        const testCode = `// Generated by Power-Toolkit for FakeXrmEasy
[Fact]
public void Should_Execute_Plugin_Successfully()
{
    // Arrange
    var fakedContext = new XrmFakedContext();
    var fakedPluginContext = fakedContext.GetDefaultPluginContext();
    fakedPluginContext.MessageName = "${context.MessageName}";
    fakedPluginContext.Stage = ${context.Stage};
    fakedPluginContext.PrimaryEntityName = "${entityName}";
    fakedPluginContext.PrimaryEntityId = ${primaryIdGuid};

    // --- InputParameters["Target"] ---
    // TODO: Manually construct the Target entity from the JSON below.
    // Complex types like EntityReference, OptionSetValue, etc., will need specific setup.
    // var targetJson = @"${targetJson}";
    var targetEntity = new Entity("${entityName}", fakedPluginContext.PrimaryEntityId);
    // Example: targetEntity["new_fieldname"] = "some value";
    fakedPluginContext.InputParameters["Target"] = targetEntity;

    // --- PreEntityImages["preimage"] ---
    if (@"${preImageJson}" != "{}")
    {
        // TODO: Manually construct the Pre-Image entity from the JSON below.
        // var preImageJson = @"${preImageJson}";
        var preImage = new Entity("${entityName}", fakedPluginContext.PrimaryEntityId);
        // Example: preImage["new_fieldname"] = "original value";
        fakedPluginContext.PreEntityImages.Add("preimage", preImage);
    }
    
    // Act
    // fakedContext.ExecutePluginWith<YourPluginClass>(fakedPluginContext);

    // Assert
    // TODO: Add your assertions here to verify the plugin's behavior.
}`;
        
        DialogService.show('Generated C# Unit Test (FakeXrmEasy)', UIFactory.createCopyableCodeBlock(testCode.trim(), 'csharp'));
    }
}