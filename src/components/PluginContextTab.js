/**
 * @file Plugin Context Simulator component.
 * @module components/PluginContextTab
 * @description Simulates the server-side plugin context (Target, Pre/Post Images) based on the current form data.
 */

import { BaseComponent } from '../core/BaseComponent.js';
import { ICONS } from '../assets/Icons.js';
import { PowerAppsApiService } from '../services/PowerAppsApiService.js';
import { UIFactory } from '../ui/UIFactory.js';
import { DialogService } from '../services/DialogService.js';
import { escapeHtml, filterSystemFields, normalizeDateTime, normalizeGuid, normalizeLookup, normalizeMoney, normalizeNumber, normalizeOptionSet } from '../helpers/index.js';
import { EntityContextResolver } from '../utils/resolvers/EntityContextResolver.js';
import { NotificationService } from '../services/NotificationService.js';
import { Config } from '../constants/index.js';

/**
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

/**
 * A component that simulates the server-side plugin execution context based on the
 * current state of the form. It allows developers to generate and inspect the Target,
 * Pre-Image, and Post-Image for different messages and pipeline stages.
 * @extends {BaseComponent}
 */
export class PluginContextTab extends BaseComponent {
    /**
     * Initializes the PluginContextTab component.
     */
    constructor() {
        super('pluginContext', 'Plugin Context', ICONS.pluginContext, true);
        /** @type {object} Caches references to key UI elements. */
        this.ui = {};
        /** @private */ this._latestContext = null;
        /** @private Cache for EntitySetName lookups */ this._entitySetCache = new Map();
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
                <strong>Note:</strong> Pre-images are simulated using the field values from when the form first loaded, not necessarily the last saved state from the database. Post-images show the current form state and won't include server-side calculations, workflows, or auto-generated values.
            </p>
            
            <div class="pdt-form-grid mt-15">
                <label for="pdt-plugin-message">Message:</label>
                <select id="pdt-plugin-message" class="pdt-select">
                    <option value="${Config.PLUGIN_MESSAGES.CREATE}" selected>${Config.PLUGIN_MESSAGES.CREATE}</option>
                    <option value="${Config.PLUGIN_MESSAGES.UPDATE}">${Config.PLUGIN_MESSAGES.UPDATE}</option>
                    <option value="${Config.PLUGIN_MESSAGES.DELETE}">${Config.PLUGIN_MESSAGES.DELETE}</option>
                </select>
                <label for="pdt-plugin-stage">Stage:</label>
                <select id="pdt-plugin-stage" class="pdt-select">
                    <option value="${Config.PLUGIN_STAGES.PRE_OPERATION.value}" selected>${Config.PLUGIN_STAGES.PRE_OPERATION.label} (${Config.PLUGIN_STAGES.PRE_OPERATION.value})</option>
                    <option value="${Config.PLUGIN_STAGES.POST_OPERATION.value}">${Config.PLUGIN_STAGES.POST_OPERATION.label} (${Config.PLUGIN_STAGES.POST_OPERATION.value})</option>
                </select>
            </div>

            <div class="pdt-toolbar pdt-toolbar-end mt-15 gap-8" style="flex-wrap: wrap;">
                <button id="pdt-generate-test-btn" class="modern-button secondary" disabled style="display: none;">C# Unit Test</button>
                <button id="pdt-copy-context-btn" class="modern-button secondary" disabled style="display: none;">Full Context</button>
                <button id="pdt-export-webapi-btn" class="modern-button secondary" disabled style="display: none;">Web API JSON</button>
                <button id="pdt-export-csharp-btn" class="modern-button secondary" disabled style="display: none;">C# Code</button>
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
            outputContainer: element.querySelector('#pdt-context-output'),
            copyBtn: element.querySelector('#pdt-copy-context-btn'),
            testBtn: element.querySelector('#pdt-generate-test-btn'),
            exportWebApiBtn: element.querySelector('#pdt-export-webapi-btn'),
            exportCSharpBtn: element.querySelector('#pdt-export-csharp-btn')
        };

        // default disabled until a context is generated
        this._setSecondaryEnabled(false);

        // secondary toolbar buttons use the latest generated context
        this.ui.copyBtn.onclick = () => {
            if (this._latestContext) this._copyContextJson(this._latestContext);
        };
        this.ui.testBtn.onclick = () => {
            if (this._latestContext) this._generateCSharpTest(this._latestContext);
        };
        this.ui.exportWebApiBtn.onclick = async () => {
            if (!this._latestContext) return;

            const originalText = this.ui.exportWebApiBtn.textContent;
            try {
                this.ui.exportWebApiBtn.disabled = true;
                this.ui.exportWebApiBtn.textContent = 'Loading...';
                await this._exportWebApiJson(this._latestContext);
            } finally {
                this.ui.exportWebApiBtn.disabled = false;
                this.ui.exportWebApiBtn.textContent = originalText;
            }
        };
        this.ui.exportCSharpBtn.onclick = () => {
            if (this._latestContext) this._exportCSharpCode(this._latestContext);
        };

        this.ui.generateBtn.onclick = () => {
            try {
                const message = this.ui.messageSelect.value;
                const parsed = parseInt(this.ui.stageSelect.value, 10);
                const stage = Number.isFinite(parsed) ? parsed : Config.PLUGIN_STAGES.PRE_OPERATION.value;

                // Guard: Update/Delete need an existing Id
                const needsId = [
                    Config.PLUGIN_MESSAGES.UPDATE.toLowerCase(),
                    Config.PLUGIN_MESSAGES.DELETE.toLowerCase()
                ].includes(String(message).toLowerCase());
                const currentId = PowerAppsApiService.getEntityId?.();
                if (needsId && !currentId) {
                    this.ui.outputContainer.innerHTML = `
                <div class="pdt-error mt-15">
                    <strong>Open an existing record</strong> (one that has an Id) to simulate <em>${escapeHtml(message)}</em>.
                </div>`;
                    this._latestContext = null;
                    this._setSecondaryEnabled(false);
                    return;
                }

                const context = this._buildContext(message, stage);
                this._latestContext = context;

                // Check if Target has meaningful data for export
                const target = context.InputParameters?.Target;
                const hasData = target && (
                    target.__type === Config.DATAVERSE_TYPES.ENTITY_REFERENCE || // Delete has EntityReference
                    (target.Attributes && Object.keys(target.Attributes).length > 0) // Create/Update have attributes
                );

                // Special check for Update message with no changes
                const isUpdate = String(message).toLowerCase() === Config.PLUGIN_MESSAGES.UPDATE.toLowerCase();
                if (isUpdate && !hasData) {
                    this.ui.outputContainer.innerHTML = `
                <p class="pdt-note mt-15">
                    <strong>Note:</strong> To generate an <em>Update</em> context, please modify at least one field on the form first. The plugin context will include only the changed attributes (dirty fields) in the Target entity.
                </p>`;
                    this._latestContext = null;
                    this._setSecondaryEnabled(false);
                    return;
                }

                this._renderContext(context);
                this._setSecondaryEnabled(hasData);
            } catch (error) {
                NotificationService.show(Config.MESSAGES.PLUGIN_CONTEXT.generateFailed(error.message), 'error');
                const errorMessage = `
            <div class="pdt-error mt-15">
                <strong>Failed to Generate Context</strong>
                <p>The form may have tried to auto-save with invalid data, which interrupted the process. This is often caused by duplicate values (like the "Name already exists" error) or other server validation rule failures.</p>
                <p><strong>Suggestion:</strong> Resolve any form errors, save your changes manually, and then try generating the context again.</p>
                <hr>
                <p><strong>Details:</strong> ${escapeHtml(error.message || 'An unexpected error occurred.')}</p>
            </div>`;
                this.ui.outputContainer.innerHTML = errorMessage;
                this._latestContext = null;
                this._setSecondaryEnabled(false);
            }
        };
    }

    destroy() {
        try {
            if (this.ui?.generateBtn) this.ui.generateBtn.onclick = null;
            if (this.ui?.copyBtn) this.ui.copyBtn.onclick = null;
            if (this.ui?.testBtn) this.ui.testBtn.onclick = null;
        } catch { /* noop */ }
    }

    /**
     * Renders the generated context object to the UI.
     * @param {PluginContext} context - The generated context object.
     * @private
     */
    _renderContext(context) {
        this.ui.outputContainer.textContent = '';

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
            target: (() => {
                switch (context.MessageName?.toLowerCase()) {
                    case Config.PLUGIN_MESSAGES.UPDATE.toLowerCase(): return Config.MESSAGES.PLUGIN_CONTEXT.emptyTargetUpdate;
                    case Config.PLUGIN_MESSAGES.DELETE.toLowerCase(): return Config.MESSAGES.PLUGIN_CONTEXT.emptyTargetDelete;
                    case Config.PLUGIN_MESSAGES.CREATE.toLowerCase(): return Config.MESSAGES.PLUGIN_CONTEXT.emptyTargetCreate;
                    default: return 'Target not available for this message.';
                }
            })(),
            preImage: (() => {
                switch (context.MessageName?.toLowerCase()) {
                    case Config.PLUGIN_MESSAGES.UPDATE.toLowerCase(): return Config.MESSAGES.PLUGIN_CONTEXT.emptyPreImageUpdate;
                    case Config.PLUGIN_MESSAGES.DELETE.toLowerCase(): return context.Stage === Config.PLUGIN_STAGES.PRE_OPERATION.value
                        ? Config.MESSAGES.PLUGIN_CONTEXT.emptyPreImageDeletePre
                        : Config.MESSAGES.PLUGIN_CONTEXT.emptyPreImageDeleteOther;
                    case Config.PLUGIN_MESSAGES.CREATE.toLowerCase(): return Config.MESSAGES.PLUGIN_CONTEXT.emptyPreImageCreate;
                    default: return 'Pre-Image not available.';
                }
            })(),
            postImage: context.Stage === Config.PLUGIN_STAGES.POST_OPERATION.value
                ? 'No Post-Image was produced for this operation.'
                : 'Post-Image is only available in Post-operation (40).'
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

        this.ui.outputContainer.appendChild(detailsContainer);
    }

    /**
     * Build a server-like context for Create / Update / Delete and Pre(20)/Post(40) stages.
     * @private
     */
    _buildContext(message, stage) {
        const msg = String(message || 'Update').toLowerCase();
        const { fullEntity, dirtyAttributes, preImageEntity } = this._getFormEntityState();

        const primaryName = PowerAppsApiService.getEntityName?.() || '';
        const primaryId = normalizeGuid(PowerAppsApiService.getEntityId?.());
        let initiatingUser = null;
        try {
            initiatingUser = normalizeGuid(PowerAppsApiService.getGlobalContext?.().userSettings?.userId);
        } catch { /* no-op */ }

        /** @type {PluginContext} */
        const context = {
            MessageName: message,
            Stage: stage,
            PrimaryEntityName: primaryName,
            PrimaryEntityId: primaryId,
            InitiatingUserId: initiatingUser,
            InputParameters: {},
            PreEntityImages: {},
            PostEntityImages: {}
        };

        // Helper: construct an Entity-like object
        const asEntity = (attrs, idOpt) => {
            const entity = { LogicalName: primaryName, Attributes: { ...attrs } };
            if (idOpt) entity.Id = idOpt;
            return entity;
        };

        // Helper: EntityReference for Delete.Target
        const asEntityRef = () => ({
            __type: Config.DATAVERSE_TYPES.ENTITY_REFERENCE,
            Id: primaryId,
            LogicalName: primaryName
        });

        switch (msg) {
            case Config.PLUGIN_MESSAGES.CREATE.toLowerCase(): {
                // For Create, filter out system fields and NEVER include an ID
                const filteredEntity = filterSystemFields(fullEntity);
                context.InputParameters.Target = asEntity(filteredEntity); // No ID for Create
                if (stage === Config.PLUGIN_STAGES.POST_OPERATION.value) {
                    // Post-op post image: includes ID and system fields after creation
                    context.PostEntityImages.postimage = asEntity(fullEntity, primaryId || undefined);
                }
                break;
            }

            case Config.PLUGIN_MESSAGES.UPDATE.toLowerCase(): {
                // Target must contain ONLY changed attributes + Id
                const hasDirty = Object.keys(dirtyAttributes).length > 0;
                context.InputParameters.Target = asEntity(dirtyAttributes, primaryId || undefined);

                // Pre-image is available if you configured it; we simulate including the columns we "tracked"
                if (hasDirty) {
                    context.PreEntityImages.preimage = asEntity(preImageEntity, primaryId || undefined);
                }
                if (stage === Config.PLUGIN_STAGES.POST_OPERATION.value) {
                    // Post image is the final state
                    context.PostEntityImages.postimage = asEntity(fullEntity, primaryId || undefined);
                }
                break;
            }

            case Config.PLUGIN_MESSAGES.DELETE.toLowerCase(): {
                // Delete.Target is an EntityReference
                context.InputParameters.Target = asEntityRef();
                // Pre-image is available pre-op (20)
                if (stage === Config.PLUGIN_STAGES.PRE_OPERATION.value) {
                    context.PreEntityImages.preimage = asEntity(fullEntity, primaryId || undefined);
                }
                // No post-image for delete (entity no longer exists)
                break;
            }

            default: {
                // Unknown message -> safest fallback
                context.InputParameters.Target = asEntity(dirtyAttributes, primaryId || undefined);
                if (stage === Config.PLUGIN_STAGES.POST_OPERATION.value) {
                    context.PostEntityImages.postimage = asEntity(fullEntity, primaryId || undefined);
                }
            }
        }

        return context;
    }

    /**
     * Collect current, dirty, and pre-image states in one pass.
     * - fullEntity: all current attribute values (normalized)
     * - dirtyAttributes: only changed attributes (normalized)
     * - preImageEntity: attribute values *before* changes (normalized)
     * @returns {EntityState}
     * @private
     */
    _getFormEntityState() {
        const fullEntity = {};
        const dirtyAttributes = {};
        const preImageEntity = {};

        const attrs = PowerAppsApiService.getAllAttributes?.() || [];
        attrs.forEach(attr => {
            if (typeof attr?.getName !== 'function' || typeof attr?.getValue !== 'function') return;

            const ln = attr.getName();
            const curRaw = attr.getValue();
            const curNorm = this._normalizeValue(attr, curRaw);

            fullEntity[ln] = curNorm;

            const isDirty = typeof attr.getIsDirty === 'function' ? !!attr.getIsDirty() : false;
            if (isDirty) {
                // initial may be missing on some types, fall back to current if so
                const initRaw = (typeof attr.getInitialValue === 'function') ? attr.getInitialValue() : curRaw;
                const initNorm = this._normalizeValue(attr, initRaw);
                dirtyAttributes[ln] = curNorm;
                preImageEntity[ln] = initNorm;
            } else {
                // not dirty => current equals pre-image
                preImageEntity[ln] = curNorm;
            }
        });

        return { fullEntity, dirtyAttributes, preImageEntity };
    }

    /**
     * Generates a C# unit test snippet for the FakeXrmEasy framework.
     * Constructs the Target and Pre-Image entities with actual C# code using the SDK types.
     * @param {PluginContext} context - The generated context object.
     * @private
     */
    _generateCSharpTest(context) {
        const entityName = context.PrimaryEntityName;
        const message = String(context.MessageName || 'Update');
        const messageLower = message.toLowerCase();
        const primaryIdGuid = context.PrimaryEntityId ? `new Guid("${context.PrimaryEntityId}")` : "Guid.NewGuid()";

        const target = context.InputParameters?.Target;
        const preImage = context.PreEntityImages?.preimage;

        let targetCode = '';

        // For Delete, Target is an EntityReference
        if (messageLower === Config.PLUGIN_MESSAGES.DELETE.toLowerCase()) {
            targetCode = `    var targetRef = new EntityReference("${entityName}", fakedPluginContext.PrimaryEntityId);\n`;
            targetCode += `    fakedPluginContext.InputParameters["Target"] = targetRef;\n`;
        }
        // For Create/Update, Target is an Entity
        else if (target && target.Attributes && Object.keys(target.Attributes).length > 0) {
            // For Create, NEVER include ID in the entity initialization
            if (messageLower === Config.PLUGIN_MESSAGES.CREATE.toLowerCase()) {
                targetCode = `    var targetEntity = new Entity("${entityName}");\n`;
            } else {
                const targetId = target.Id ? `new Guid("${target.Id}")` : 'fakedPluginContext.PrimaryEntityId';
                targetCode = `    var targetEntity = new Entity("${entityName}", ${targetId});\n`;
            }

            const sortedKeys = Object.keys(target.Attributes).sort();
            for (const key of sortedKeys) {
                const value = target.Attributes[key];
                const assignment = this._convertToCSharpValue(value, key);
                // Replace entity["field"] with targetEntity["field"]
                targetCode += `    ${assignment.replace('entity[', 'targetEntity[')}\n`;
            }
            targetCode += `    fakedPluginContext.InputParameters["Target"] = targetEntity;\n`;
        } else {
            targetCode = `    var targetEntity = new Entity("${entityName}", fakedPluginContext.PrimaryEntityId);\n`;
            targetCode += `    fakedPluginContext.InputParameters["Target"] = targetEntity;\n`;
        }

        // Build Pre-Image entity code
        let preImageCode = '';
        if (preImage && preImage.Attributes && Object.keys(preImage.Attributes).length > 0) {
            const preImageId = preImage.Id ? `new Guid("${preImage.Id}")` : 'fakedPluginContext.PrimaryEntityId';
            preImageCode = `\n    // Pre-Image\n`;
            preImageCode += `    var preImageEntity = new Entity("${entityName}", ${preImageId});\n`;

            const sortedKeys = Object.keys(preImage.Attributes).sort();
            for (const key of sortedKeys) {
                const value = preImage.Attributes[key];
                const assignment = this._convertToCSharpValue(value, key);
                // Replace entity["field"] with preImageEntity["field"]
                preImageCode += `    ${assignment.replace('entity[', 'preImageEntity[')}\n`;
            }
            preImageCode += `    fakedPluginContext.PreEntityImages.Add("preimage", preImageEntity);\n`;
        }

        const testCode = `// Generated by Power-Toolkit for FakeXrmEasy
// Required NuGet packages:
//   - FakeXrmEasy.Core
//   - Microsoft.CrmSdk.CoreAssemblies
//   - xunit (or your preferred test framework)

using FakeXrmEasy;
using Microsoft.Xrm.Sdk;
using System;
using Xunit;

[Fact]
public void Should_Execute_${message}_Plugin_Successfully()
{
    // Arrange
    var fakedContext = new XrmFakedContext();${messageLower === Config.PLUGIN_MESSAGES.DELETE.toLowerCase() && preImage && preImage.Attributes && Object.keys(preImage.Attributes).length > 0 ? `
    
    // For Delete testing, initialize the entity in the fake context first
    var existingEntity = new Entity("${entityName}", ${primaryIdGuid});
${Object.keys(preImage.Attributes).sort().map(key => {
            const value = preImage.Attributes[key];
            const assignment = this._convertToCSharpValue(value, key);
            return `    ${assignment.replace('entity[', 'existingEntity[')}`;
        }).join('\n')}
    fakedContext.Initialize(new[] { existingEntity });
` : ''}
    var fakedPluginContext = fakedContext.GetDefaultPluginContext();
    fakedPluginContext.MessageName = "${message}";
    fakedPluginContext.Stage = ${context.Stage};
    fakedPluginContext.PrimaryEntityName = "${entityName}";
    fakedPluginContext.PrimaryEntityId = ${primaryIdGuid};

    // Target ${messageLower === Config.PLUGIN_MESSAGES.DELETE.toLowerCase() ? 'EntityReference' : 'Entity'}
${targetCode}${preImageCode}
    
    // Act
    fakedContext.ExecutePluginWith<YourPluginClass>(fakedPluginContext);

    // Assert
    // TODO: Add your assertions here to verify the plugin's behavior.${messageLower === Config.PLUGIN_MESSAGES.DELETE.toLowerCase() ? `
    // Example for Delete - verify related records were handled:
    // var relatedRecords = fakedContext.CreateQuery("related_entity")
    //     .Where(e => e.GetAttributeValue<EntityReference>("parentid").Id == ${primaryIdGuid})
    //     .ToList();
    // Assert.Empty(relatedRecords); // Verify cascading delete or cleanup` : `
    // Example:
    // var updatedEntity = fakedContext.GetOrganizationService()
    //     .Retrieve("${entityName}", fakedPluginContext.PrimaryEntityId, new ColumnSet(true));
    // Assert.Equal(expectedValue, updatedEntity["fieldname"]);`}
}`;

        DialogService.show('Generated C# Unit Test (FakeXrmEasy)', UIFactory.createCopyableCodeBlock(testCode.trim(), 'csharp'));
    }

    /** 
     * Convert a raw client attribute value into an SDK-ish object similar to server plugins. 
     * @private
     */
    _normalizeValue(attr, current) {
        const t = typeof attr?.getAttributeType === 'function' ? attr.getAttributeType() : null;

        switch (t) {
            case 'lookup':
            case 'customer':
            case 'owner':
                return normalizeLookup(current);
            case 'optionset':
            case 'multiselectoptionset':
                return normalizeOptionSet(current);
            case 'boolean':
                return !!current;
            case 'datetime':
                return normalizeDateTime(current);
            case 'money':
                return normalizeMoney(current);
            case 'decimal':
            case 'double':
            case 'integer':
            case 'bigint':
                return normalizeNumber(current);
            default:
                return current; // text, memo, etc.
        }
    }

    /** @private */
    _copyContextJson(ctx) {
        try {
            const pretty = JSON.stringify(ctx, null, 2);
            DialogService.show('Full Plugin Context (JSON)', UIFactory.createCopyableCodeBlock(pretty, 'json'));
        } catch (e) {
            this.ui.outputContainer.insertAdjacentHTML('beforeend',
                `<div class="pdt-error mt-15">${Config.MESSAGES.PLUGIN_CONTEXT.serializeFailed(escapeHtml(e.message || String(e)))}</div>`);
        }
    }

    /**
     * Converts the plugin context to Web API JSON format for use with Xrm.WebApi or REST API.
     * @param {PluginContext} ctx - The generated context object.
     * @private
     */
    async _exportWebApiJson(ctx) {
        try {
            const message = String(ctx.MessageName || 'Update').toLowerCase();
            const target = ctx.InputParameters?.Target;

            // Handle Delete message (Target is EntityReference, not Entity)
            if (message === Config.PLUGIN_MESSAGES.DELETE.toLowerCase()) {
                const entityName = target?.LogicalName || ctx.PrimaryEntityName || 'entity';
                const recordId = target?.Id || ctx.PrimaryEntityId || '{record-id}';
                const cleanId = String(recordId).toLowerCase().replace(/[{}]/g, '');

                // Get EntitySetName for proper Web API endpoint
                let entitySet = this._entitySetCache.get(entityName);
                if (!entitySet) {
                    try {
                        const resolved = await EntityContextResolver.resolve(entityName);
                        entitySet = resolved.entitySet;
                        this._entitySetCache.set(entityName, entitySet);
                    } catch (e) {
                        entitySet = entityName + 's'; // Fallback
                    }
                }

                const instructions = `// Usage:\nconst recordId = "${cleanId}";\nXrm.WebApi.deleteRecord("${entityName}", recordId).then(\n    success => console.log("Deleted successfully"),\n    error => console.error(error.message)\n);\n\n// Or using fetch API:\n// DELETE https://[org].api.crm.dynamics.com/api/data/v9.2/${entitySet}(${cleanId})`;

                DialogService.show('Web API JSON (Delete)', UIFactory.createCopyableCodeBlock(instructions, 'javascript'));
                return;
            }

            if (!target || !target.Attributes) {
                DialogService.show(Config.DIALOG_TITLES.error, `<div class="pdt-error">${Config.MESSAGES.PLUGIN_CONTEXT.noTargetEntity}</div>`);
                return;
            }

            const webApiData = await this._convertToWebApiFormat(target.Attributes, target.LogicalName);
            const entityName = target.LogicalName || 'entity';
            const fieldCount = Object.keys(webApiData).length;

            let title = 'Web API JSON';
            let instructions = '';

            if (message === Config.PLUGIN_MESSAGES.CREATE.toLowerCase()) {
                title += ' (Create)';
                instructions = `// Usage:\nXrm.WebApi.createRecord("${entityName}", data).then(\n    success => console.log("Created ID:", success.id),\n    error => console.error(error.message)\n);`;
            } else if (message === Config.PLUGIN_MESSAGES.UPDATE.toLowerCase()) {
                title += ' (Update)';
                const recordId = ctx.PrimaryEntityId || '{record-id}';
                instructions = `// Usage:\nconst recordId = "${recordId}";\nXrm.WebApi.updateRecord("${entityName}", recordId, data).then(\n    success => console.log("Updated successfully"),\n    error => console.error(error.message)\n);`;
            } else {
                instructions = `// Usage with Xrm.WebApi or fetch() API\n// Entity: ${entityName}`;
            }

            const jsonStr = JSON.stringify(webApiData, null, 2);
            const fullCode = `${instructions}\n\n// Data (${fieldCount} field${fieldCount !== 1 ? 's' : ''}):\nconst data = ${jsonStr};`;

            DialogService.show(title, UIFactory.createCopyableCodeBlock(fullCode, 'javascript'));
        } catch (e) {
            DialogService.show(Config.DIALOG_TITLES.error, `<div class="pdt-error">${Config.MESSAGES.PLUGIN_CONTEXT.exportWebApiFailed(escapeHtml(e.message || String(e)))}</div>`);
        }
    }

    /**
     * Converts the plugin context to C# Organization Service code.
     * @param {PluginContext} ctx - The generated context object.
     * @private
     */
    _exportCSharpCode(ctx) {
        try {
            const message = String(ctx.MessageName || 'Update').toLowerCase();
            const target = ctx.InputParameters?.Target;

            // Handle Delete message (Target is EntityReference, not Entity)
            if (message === Config.PLUGIN_MESSAGES.DELETE.toLowerCase()) {
                const entityName = target?.LogicalName || ctx.PrimaryEntityName || 'entity';
                const entityId = target?.Id || ctx.PrimaryEntityId;

                if (!entityId) {
                    DialogService.show(Config.DIALOG_TITLES.error, `<div class="pdt-error">${Config.MESSAGES.PLUGIN_CONTEXT.noEntityId}</div>`);
                    return;
                }

                const code = `// Generated by Power-Toolkit\n// Entity: ${entityName}\n// Mode: Delete\n\n// Execute the delete operation\nvar recordId = new Guid("${entityId}");\nservice.Delete("${entityName}", recordId);\nConsole.WriteLine($"Deleted {entityName} record with ID: {recordId}");`;

                const usings = `// Required using statements:\n// using Microsoft.Xrm.Sdk;\n// using System;\n\n`;
                const fullCode = usings + code;

                DialogService.show('C# Organization Service Code (Delete)', UIFactory.createCopyableCodeBlock(fullCode, 'csharp'));
                return;
            }

            if (!target || !target.Attributes) {
                DialogService.show(Config.DIALOG_TITLES.error, `<div class="pdt-error">${Config.MESSAGES.PLUGIN_CONTEXT.noTargetEntity}</div>`);
                return;
            }

            const entityName = target.LogicalName || 'entity';
            const entityId = target.Id;
            const attributes = target.Attributes;

            let code = `// Generated by Power-Toolkit\n// Entity: ${entityName}\n// Mode: ${ctx.MessageName}\n\n`;

            // Entity initialization
            if (message === Config.PLUGIN_MESSAGES.CREATE.toLowerCase()) {
                code += `var entity = new Entity("${entityName}");\n\n`;
            } else if (message === Config.PLUGIN_MESSAGES.UPDATE.toLowerCase() && entityId) {
                code += `var entity = new Entity("${entityName}", new Guid("${entityId}"));\n\n`;
            } else {
                code += `var entity = new Entity("${entityName}");\n\n`;
            }

            // Add attributes
            const sortedKeys = Object.keys(attributes).sort();
            for (const key of sortedKeys) {
                const value = attributes[key];
                const csharpValue = this._convertToCSharpValue(value, key);
                code += `${csharpValue}\n`;
            }

            // Add service call
            code += `\n// Execute the operation\n`;
            if (message === Config.PLUGIN_MESSAGES.CREATE.toLowerCase()) {
                code += `Guid newId = service.Create(entity);\nConsole.WriteLine($"Created record with ID: {newId}");`;
            } else if (message === Config.PLUGIN_MESSAGES.UPDATE.toLowerCase()) {
                code += `service.Update(entity);\nConsole.WriteLine("Record updated successfully");`;
            } else {
                code += `// Use service.Create(entity) or service.Update(entity)`;
            }

            // Add required using statements
            const usings = `// Required using statements:\n// using Microsoft.Xrm.Sdk;\n// using Microsoft.Xrm.Sdk.Client;\n// using System;\n\n`;
            const fullCode = usings + code;

            DialogService.show(`C# Organization Service Code (${ctx.MessageName})`, UIFactory.createCopyableCodeBlock(fullCode, 'csharp'));
        } catch (e) {
            DialogService.show(Config.DIALOG_TITLES.error, `<div class="pdt-error">${Config.MESSAGES.PLUGIN_CONTEXT.exportCSharpFailed(escapeHtml(e.message || String(e)))}</div>`);
        }
    }

    /**
     * Converts plugin-style attributes to Web API OData format.
     * @param {object} attributes - The attributes from the plugin context.
     * @param {string} entityName - The logical name of the entity.
     * @returns {Promise<object>} Web API formatted object.
     * @private
     */
    async _convertToWebApiFormat(attributes, entityName) {
        const webApiData = {};

        for (const [key, value] of Object.entries(attributes)) {
            if (value === null || value === undefined) {
                webApiData[key] = null;
                continue;
            }

            // EntityReference (lookup)
            if (value.__type === Config.DATAVERSE_TYPES.ENTITY_REFERENCE) {
                try {
                    // Check cache first
                    let entitySet = this._entitySetCache.get(value.LogicalName);
                    if (!entitySet) {
                        const resolved = await EntityContextResolver.resolve(value.LogicalName);
                        entitySet = resolved.entitySet;
                        this._entitySetCache.set(value.LogicalName, entitySet);
                    }
                    const cleanId = String(value.Id || '').toLowerCase().replace(/[{}]/g, '');
                    webApiData[`${key}@odata.bind`] = `/${entitySet}(${cleanId})`;
                } catch (e) {
                    // Fallback if metadata not available
                    const cleanId = String(value.Id || '').toLowerCase().replace(/[{}]/g, '');
                    webApiData[`${key}@odata.bind`] = `/${value.LogicalName}s(${cleanId})`;
                }
            }
            // Money
            else if (value.__type === Config.DATAVERSE_TYPES.MONEY) {
                webApiData[key] = value.Value;
            }
            // OptionSetValue
            else if (value.__type === Config.DATAVERSE_TYPES.OPTION_SET_VALUE) {
                webApiData[key] = value.Value;
            }
            // OptionSetValueCollection (multi-select)
            else if (value.__type === Config.DATAVERSE_TYPES.OPTION_SET_VALUE_COLLECTION && Array.isArray(value.Values)) {
                webApiData[key] = value.Values;
            }
            // DateTime
            else if (value.__type === Config.DATAVERSE_TYPES.DATE_TIME) {
                webApiData[key] = value.Iso;
            }
            // Primitive values (string, number, boolean)
            else {
                webApiData[key] = value;
            }
        }

        return webApiData;
    }

    /**
     * Converts a plugin-style value to C# code string.
     * @param {*} value - The value to convert.
     * @param {string} fieldName - The field name.
     * @returns {string} C# code string.
     * @private
     */
    _convertToCSharpValue(value, fieldName) {
        if (value === null || value === undefined) {
            return `entity["${fieldName}"] = null;`;
        }

        // EntityReference (lookup)
        if (value.__type === Config.DATAVERSE_TYPES.ENTITY_REFERENCE) {
            const cleanId = String(value.Id || '').toLowerCase().replace(/[{}]/g, '');
            const logicalName = value.LogicalName || 'entity';
            const name = value.Name ? ` // ${value.Name}` : '';
            return `entity["${fieldName}"] = new EntityReference("${logicalName}", new Guid("${cleanId}"));${name}`;
        }
        // Money
        else if (value.__type === Config.DATAVERSE_TYPES.MONEY) {
            return `entity["${fieldName}"] = new Money(${value.Value}m);`;
        }
        // OptionSetValue
        else if (value.__type === Config.DATAVERSE_TYPES.OPTION_SET_VALUE) {
            return `entity["${fieldName}"] = new OptionSetValue(${value.Value});`;
        }
        // OptionSetValueCollection (multi-select)
        else if (value.__type === Config.DATAVERSE_TYPES.OPTION_SET_VALUE_COLLECTION && Array.isArray(value.Values)) {
            const values = value.Values.map(v => `    new OptionSetValue(${v})`).join(',\n');
            return `entity["${fieldName}"] = new OptionSetValueCollection\n{\n${values}\n};`;
        }
        // DateTime
        else if (value.__type === Config.DATAVERSE_TYPES.DATE_TIME) {
            return `entity["${fieldName}"] = DateTime.Parse("${value.Iso}");`;
        }
        // Boolean
        else if (typeof value === 'boolean') {
            return `entity["${fieldName}"] = ${value.toString()};`;
        }
        // Number
        else if (typeof value === 'number') {
            return `entity["${fieldName}"] = ${value};`;
        }
        // String
        else if (typeof value === 'string') {
            const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
            return `entity["${fieldName}"] = "${escaped}";`;
        }
        // Unknown type
        else {
            return `entity["${fieldName}"] = ${JSON.stringify(value)}; // TODO: Review this value`;
        }
    }

    /**
     * Enables or disables the secondary toolbar buttons (Copy, Test, Export).
     * @param {boolean} enabled - Whether to enable the buttons.
     * @private
     */
    _setSecondaryEnabled(enabled) {
        if (!this.ui) return;
        const d = !enabled;
        const display = enabled ? '' : 'none';
        if (this.ui.copyBtn) {
            this.ui.copyBtn.disabled = d;
            this.ui.copyBtn.style.display = display;
        }
        if (this.ui.testBtn) {
            this.ui.testBtn.disabled = d;
            this.ui.testBtn.style.display = display;
        }
        if (this.ui.exportWebApiBtn) {
            this.ui.exportWebApiBtn.disabled = d;
            this.ui.exportWebApiBtn.style.display = display;
        }
        if (this.ui.exportCSharpBtn) {
            this.ui.exportCSharpBtn.disabled = d;
            this.ui.exportCSharpBtn.style.display = display;
        }
    }
}