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

        // Handler references for cleanup
        /** @private {Function|null} */ this._generateBtnHandler = null;
        /** @private {Function|null} */ this._copyBtnHandler = null;
        /** @private {Function|null} */ this._testBtnHandler = null;
        /** @private {Function|null} */ this._exportWebApiBtnHandler = null;
        /** @private {Function|null} */ this._exportCSharpBtnHandler = null;
    }

    /**
     * Renders the component's HTML structure.
     * @returns {Promise<HTMLElement>} The root element of the component.
     */
    // eslint-disable-next-line require-await
    async render() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="section-title">Plugin Context Simulator</div>
            <p class="pdt-note">
                <strong>Note:</strong> Pre-images are simulated using the field values from when the form first loaded, not necessarily the last saved state from the database. Post-images show the current form state and won't include server-side calculations, workflows, or auto-generated values.
            </p>
            
            <div class="pdt-toolbar mt-15">
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

            <div class="pdt-toolbar pdt-toolbar-end mt-15 gap-8 pdt-toolbar-wrap">
                <button id="pdt-generate-test-btn" class="modern-button secondary pdt-hidden" disabled>${Config.PLUGIN_CONTEXT_BUTTONS.TEST}</button>
                <button id="pdt-copy-context-btn" class="modern-button secondary pdt-hidden" disabled>${Config.PLUGIN_CONTEXT_BUTTONS.COPY}</button>
                <button id="pdt-export-webapi-btn" class="modern-button secondary pdt-hidden" disabled>${Config.PLUGIN_CONTEXT_BUTTONS.EXPORT_WEBAPI}</button>
                <button id="pdt-export-csharp-btn" class="modern-button secondary pdt-hidden" disabled>${Config.PLUGIN_CONTEXT_BUTTONS.EXPORT_CSHARP}</button>
                <button id="pdt-generate-context-btn" class="modern-button">${Config.PLUGIN_CONTEXT_BUTTONS.GENERATE}</button>
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

        // Store handlers for cleanup
        this._copyBtnHandler = () => {
            if (this._latestContext) {
                this._copyContextJson(this._latestContext);
            }
        };
        this._testBtnHandler = () => {
            if (this._latestContext) {
                this._generateCSharpTest(this._latestContext);
            }
        };
        this._exportWebApiBtnHandler = async () => {
            if (!this._latestContext) {
                return;
            }

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
        this._exportCSharpBtnHandler = () => {
            if (this._latestContext) {
                this._exportCSharpCode(this._latestContext);
            }
        };
        this._generateBtnHandler = () => {
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

        // Attach event listeners
        this.ui.copyBtn.addEventListener('click', this._copyBtnHandler);
        this.ui.testBtn.addEventListener('click', this._testBtnHandler);
        this.ui.exportWebApiBtn.addEventListener('click', this._exportWebApiBtnHandler);
        this.ui.exportCSharpBtn.addEventListener('click', this._exportCSharpBtnHandler);
        this.ui.generateBtn.addEventListener('click', this._generateBtnHandler);
    }

    destroy() {
        try {
            if (this.ui?.generateBtn) {
                this.ui.generateBtn.removeEventListener('click', this._generateBtnHandler);
            }
            if (this.ui?.copyBtn) {
                this.ui.copyBtn.removeEventListener('click', this._copyBtnHandler);
            }
            if (this.ui?.testBtn) {
                this.ui.testBtn.removeEventListener('click', this._testBtnHandler);
            }
            if (this.ui?.exportWebApiBtn) {
                this.ui.exportWebApiBtn.removeEventListener('click', this._exportWebApiBtnHandler);
            }
            if (this.ui?.exportCSharpBtn) {
                this.ui.exportCSharpBtn.removeEventListener('click', this._exportCSharpBtnHandler);
            }
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
            createSection(`PreEntityImages["${Config.PLUGIN_IMAGE_NAMES.PRE_IMAGE}"]`, context.PreEntityImages[Config.PLUGIN_IMAGE_NAMES.PRE_IMAGE], emptyMessages.preImage),
            createSection(`PostEntityImages["${Config.PLUGIN_IMAGE_NAMES.POST_IMAGE}"]`, context.PostEntityImages[Config.PLUGIN_IMAGE_NAMES.POST_IMAGE], emptyMessages.postImage)
        ];
        sections.forEach((section, index) => {
            if (index > 0) {
                section.classList.add('mt-15');
            }
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

        /** @type {PluginContext} */
        const context = {
            MessageName: message,
            Stage: stage,
            PrimaryEntityName: primaryName,
            PrimaryEntityId: primaryId,
            InitiatingUserId: this._getInitiatingUserId(),
            InputParameters: {},
            PreEntityImages: {},
            PostEntityImages: {}
        };

        const helpers = this._createContextHelpers(primaryName, primaryId);

        switch (msg) {
            case Config.PLUGIN_MESSAGES.CREATE.toLowerCase():
                this._populateCreateContext(context, fullEntity, primaryId, stage, helpers);
                break;
            case Config.PLUGIN_MESSAGES.UPDATE.toLowerCase():
                this._populateUpdateContext(context, fullEntity, dirtyAttributes, preImageEntity, primaryId, stage, helpers);
                break;
            case Config.PLUGIN_MESSAGES.DELETE.toLowerCase():
                this._populateDeleteContext(context, fullEntity, primaryId, stage, helpers);
                break;
            default:
                this._populateDefaultContext(context, fullEntity, dirtyAttributes, primaryId, stage, helpers);
        }

        return context;
    }

    /**
     * Get initiating user ID
     * @returns {string|null}
     * @private
     */
    _getInitiatingUserId() {
        try {
            return normalizeGuid(PowerAppsApiService.getGlobalContext?.().userSettings?.userId);
        } catch {
            return null;
        }
    }

    /**
     * Create helper functions for building entities
     * @param {string} primaryName - Entity logical name
     * @param {string} primaryId - Primary entity ID
     * @returns {object} Helper functions
     * @private
     */
    _createContextHelpers(primaryName, primaryId) {
        return {
            asEntity: (attrs, idOpt) => {
                const entity = { LogicalName: primaryName, Attributes: { ...attrs } };
                if (idOpt) {
                    entity.Id = idOpt;
                }
                return entity;
            },
            asEntityRef: () => ({
                __type: Config.DATAVERSE_TYPES.ENTITY_REFERENCE,
                Id: primaryId,
                LogicalName: primaryName
            })
        };
    }

    /**
     * Populate context for Create message
     * @private
     */
    _populateCreateContext(context, fullEntity, primaryId, stage, { asEntity }) {
        const filteredEntity = filterSystemFields(fullEntity);
        context.InputParameters.Target = asEntity(filteredEntity);
        if (stage === Config.PLUGIN_STAGES.POST_OPERATION.value) {
            context.PostEntityImages[Config.PLUGIN_IMAGE_NAMES.POST_IMAGE] = asEntity(fullEntity, primaryId || undefined);
        }
    }

    /**
     * Populate context for Update message
     * @private
     */
    _populateUpdateContext(context, fullEntity, dirtyAttributes, preImageEntity, primaryId, stage, { asEntity }) {
        const hasDirty = Object.keys(dirtyAttributes).length > 0;
        context.InputParameters.Target = asEntity(dirtyAttributes, primaryId || undefined);

        if (hasDirty) {
            context.PreEntityImages[Config.PLUGIN_IMAGE_NAMES.PRE_IMAGE] = asEntity(preImageEntity, primaryId || undefined);
        }
        if (stage === Config.PLUGIN_STAGES.POST_OPERATION.value) {
            context.PostEntityImages[Config.PLUGIN_IMAGE_NAMES.POST_IMAGE] = asEntity(fullEntity, primaryId || undefined);
        }
    }

    /**
     * Populate context for Delete message
     * @private
     */
    _populateDeleteContext(context, fullEntity, primaryId, stage, { asEntity, asEntityRef }) {
        context.InputParameters.Target = asEntityRef();
        if (stage === Config.PLUGIN_STAGES.PRE_OPERATION.value) {
            context.PreEntityImages[Config.PLUGIN_IMAGE_NAMES.PRE_IMAGE] = asEntity(fullEntity, primaryId || undefined);
        }
    }

    /**
     * Populate context for default/unknown message
     * @private
     */
    _populateDefaultContext(context, fullEntity, dirtyAttributes, primaryId, stage, { asEntity }) {
        context.InputParameters.Target = asEntity(dirtyAttributes, primaryId || undefined);
        if (stage === Config.PLUGIN_STAGES.POST_OPERATION.value) {
            context.PostEntityImages[Config.PLUGIN_IMAGE_NAMES.POST_IMAGE] = asEntity(fullEntity, primaryId || undefined);
        }
    }

    /**
     * Collect current, dirty, and pre-image states in one pass.
     * @returns {EntityState} Object containing:
     *   - fullEntity: all current attribute values (normalized)
     *   - dirtyAttributes: only changed attributes (normalized)
     *   - preImageEntity: attribute values before changes (normalized)
     * @private
     */
    _getFormEntityState() {
        const fullEntity = {};
        const dirtyAttributes = {};
        const preImageEntity = {};

        const attrs = PowerAppsApiService.getAllAttributes?.() || [];
        attrs.forEach(attr => {
            if (typeof attr?.getName !== 'function' || typeof attr?.getValue !== 'function') {
                return;
            }

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
        const primaryIdGuid = context.PrimaryEntityId ? `new Guid("${context.PrimaryEntityId}")` : 'Guid.NewGuid()';

        const target = context.InputParameters?.Target;
        const preImage = context.PreEntityImages?.[Config.PLUGIN_IMAGE_NAMES.PRE_IMAGE];

        const targetCode = this._buildTargetCode(target, entityName, messageLower);
        const preImageCode = this._buildPreImageCode(preImage, entityName);
        const deleteInitCode = this._buildDeleteInitCode(preImage, entityName, primaryIdGuid, messageLower);
        const assertionCode = this._buildAssertionCode(messageLower, entityName, primaryIdGuid);

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
    var fakedContext = new XrmFakedContext();${deleteInitCode}
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
    // TODO: Add your assertions here to verify the plugin's behavior.${assertionCode}
}`;

        DialogService.show('Generated C# Unit Test (FakeXrmEasy)', UIFactory.createCopyableCodeBlock(testCode.trim(), 'csharp'));
    }

    /**
     * Build Target entity/reference code
     * @private
     */
    _buildTargetCode(target, entityName, messageLower) {
        if (messageLower === Config.PLUGIN_MESSAGES.DELETE.toLowerCase()) {
            return `    var targetRef = new EntityReference("${entityName}", fakedPluginContext.PrimaryEntityId);\n    fakedPluginContext.InputParameters["Target"] = targetRef;\n`;
        }

        if (!target || !target.Attributes || Object.keys(target.Attributes).length === 0) {
            return `    var targetEntity = new Entity("${entityName}", fakedPluginContext.PrimaryEntityId);\n    fakedPluginContext.InputParameters["Target"] = targetEntity;\n`;
        }

        let code = '';
        if (messageLower === Config.PLUGIN_MESSAGES.CREATE.toLowerCase()) {
            code = `    var targetEntity = new Entity("${entityName}");\n`;
        } else {
            const targetId = target.Id ? `new Guid("${target.Id}")` : 'fakedPluginContext.PrimaryEntityId';
            code = `    var targetEntity = new Entity("${entityName}", ${targetId});\n`;
        }

        const sortedKeys = Object.keys(target.Attributes).sort();
        for (const key of sortedKeys) {
            const value = target.Attributes[key];
            const assignment = this._convertToCSharpValue(value, key);
            code += `    ${assignment.replace('entity[', 'targetEntity[')}\n`;
        }
        code += '    fakedPluginContext.InputParameters["Target"] = targetEntity;\n';
        return code;
    }

    /**
     * Build Pre-Image entity code
     * @private
     */
    _buildPreImageCode(preImage, entityName) {
        if (!preImage || !preImage.Attributes || Object.keys(preImage.Attributes).length === 0) {
            return '';
        }

        const preImageId = preImage.Id ? `new Guid("${preImage.Id}")` : 'fakedPluginContext.PrimaryEntityId';
        let code = '\n    // Pre-Image\n';
        code += `    var preImageEntity = new Entity("${entityName}", ${preImageId});\n`;

        const sortedKeys = Object.keys(preImage.Attributes).sort();
        for (const key of sortedKeys) {
            const value = preImage.Attributes[key];
            const assignment = this._convertToCSharpValue(value, key);
            code += `    ${assignment.replace('entity[', 'preImageEntity[')}\n`;
        }
        code += `    fakedPluginContext.PreEntityImages.Add("${Config.PLUGIN_IMAGE_NAMES.PRE_IMAGE}", preImageEntity);\n`;
        return code;
    }

    /**
     * Build Delete initialization code for FakeXrmEasy
     * @private
     */
    _buildDeleteInitCode(preImage, entityName, primaryIdGuid, messageLower) {
        if (messageLower !== Config.PLUGIN_MESSAGES.DELETE.toLowerCase()) {
            return '';
        }
        if (!preImage || !preImage.Attributes || Object.keys(preImage.Attributes).length === 0) {
            return '';
        }

        const attributes = Object.keys(preImage.Attributes).sort().map(key => {
            const value = preImage.Attributes[key];
            const assignment = this._convertToCSharpValue(value, key);
            return `    ${assignment.replace('entity[', 'existingEntity[')}`;
        }).join('\n');

        return `
    
    // For Delete testing, initialize the entity in the fake context first
    var existingEntity = new Entity("${entityName}", ${primaryIdGuid});
${attributes}
    fakedContext.Initialize(new[] { existingEntity });
`;
    }

    /**
     * Build assertion example code
     * @private
     */
    _buildAssertionCode(messageLower, entityName, primaryIdGuid) {
        if (messageLower === Config.PLUGIN_MESSAGES.DELETE.toLowerCase()) {
            return `
    // Example for Delete - verify related records were handled:
    // var relatedRecords = fakedContext.CreateQuery("related_entity")
    //     .Where(e => e.GetAttributeValue<EntityReference>("parentid").Id == ${primaryIdGuid})
    //     .ToList();
    // Assert.Empty(relatedRecords); // Verify cascading delete or cleanup`;
        }

        return `
    // Example:
    // var updatedEntity = fakedContext.GetOrganizationService()
    //     .Retrieve("${entityName}", fakedPluginContext.PrimaryEntityId, new ColumnSet(true));
    // Assert.Equal(expectedValue, updatedEntity["fieldname"]);`;
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

            // Handle Delete message
            if (message === Config.PLUGIN_MESSAGES.DELETE.toLowerCase()) {
                await this._exportWebApiDelete(target, ctx);
                return;
            }

            // Handle Create/Update messages
            if (!target || !target.Attributes) {
                DialogService.show(Config.DIALOG_TITLES.error, `<div class="pdt-error">${Config.MESSAGES.PLUGIN_CONTEXT.noTargetEntity}</div>`);
                return;
            }

            await this._exportWebApiCreateUpdate(target, ctx, message);
        } catch (e) {
            DialogService.show(Config.DIALOG_TITLES.error, `<div class="pdt-error">${Config.MESSAGES.PLUGIN_CONTEXT.exportWebApiFailed(escapeHtml(e.message || String(e)))}</div>`);
        }
    }

    /**
     * Export Web API JSON for Delete operation
     * @private
     */
    async _exportWebApiDelete(target, ctx) {
        const entityName = target?.LogicalName || ctx.PrimaryEntityName || 'entity';
        const recordId = target?.Id || ctx.PrimaryEntityId || '{record-id}';
        const cleanId = String(recordId).toLowerCase().replace(/[{}]/g, '');

        const entitySet = await this._getEntitySet(entityName);

        const instructions = `// Usage:\nconst recordId = "${cleanId}";\nXrm.WebApi.deleteRecord("${entityName}", recordId).then(\n    success => console.log("Deleted successfully"),\n    error => console.error(error.message)\n);\n\n// Or using fetch API:\n// DELETE https://[org].api.crm.dynamics.com/api/data/v9.2/${entitySet}(${cleanId})`;

        DialogService.show('Web API JSON (Delete)', UIFactory.createCopyableCodeBlock(instructions, 'javascript'));
    }

    /**
     * Export Web API JSON for Create/Update operation
     * @private
     */
    async _exportWebApiCreateUpdate(target, ctx, message) {
        const webApiData = await this._convertToWebApiFormat(target.Attributes, target.LogicalName);
        const entityName = target.LogicalName || 'entity';
        const fieldCount = Object.keys(webApiData).length;

        const { title, instructions } = this._buildWebApiInstructions(message, entityName, ctx.PrimaryEntityId, fieldCount);
        const jsonStr = JSON.stringify(webApiData, null, 2);
        const fullCode = `${instructions}\n\n// Data (${fieldCount} field${fieldCount !== 1 ? 's' : ''}):\nconst data = ${jsonStr};`;

        DialogService.show(title, UIFactory.createCopyableCodeBlock(fullCode, 'javascript'));
    }

    /**
     * Build Web API instructions for Create/Update
     * @private
     */
    _buildWebApiInstructions(message, entityName, primaryEntityId, _fieldCount) {
        let title = 'Web API JSON';
        let instructions = '';

        if (message === Config.PLUGIN_MESSAGES.CREATE.toLowerCase()) {
            title += ' (Create)';
            instructions = `// Usage:\nXrm.WebApi.createRecord("${entityName}", data).then(\n    success => console.log("Created ID:", success.id),\n    error => console.error(error.message)\n);`;
        } else if (message === Config.PLUGIN_MESSAGES.UPDATE.toLowerCase()) {
            title += ' (Update)';
            const recordId = primaryEntityId || '{record-id}';
            instructions = `// Usage:\nconst recordId = "${recordId}";\nXrm.WebApi.updateRecord("${entityName}", recordId, data).then(\n    success => console.log("Updated successfully"),\n    error => console.error(error.message)\n);`;
        } else {
            instructions = `// Usage with Xrm.WebApi or fetch() API\n// Entity: ${entityName}`;
        }

        return { title, instructions };
    }

    /**
     * Get entity set name from cache or resolve it
     * @private
     */
    async _getEntitySet(entityName) {
        let entitySet = this._entitySetCache.get(entityName);
        if (!entitySet) {
            try {
                const resolved = await EntityContextResolver.resolve(entityName);
                entitySet = resolved.entitySet;
                this._entitySetCache.set(entityName, entitySet);
            } catch (_e) {
                entitySet = entityName + 's'; // Fallback
            }
        }
        return entitySet;
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

            // Handle Delete message
            if (message === Config.PLUGIN_MESSAGES.DELETE.toLowerCase()) {
                this._exportCSharpDelete(target, ctx);
                return;
            }

            // Handle Create/Update messages
            if (!target || !target.Attributes) {
                DialogService.show(Config.DIALOG_TITLES.error, `<div class="pdt-error">${Config.MESSAGES.PLUGIN_CONTEXT.noTargetEntity}</div>`);
                return;
            }

            this._exportCSharpCreateUpdate(target, ctx, message);
        } catch (e) {
            DialogService.show(Config.DIALOG_TITLES.error, `<div class="pdt-error">${Config.MESSAGES.PLUGIN_CONTEXT.exportCSharpFailed(escapeHtml(e.message || String(e)))}</div>`);
        }
    }

    /**
     * Export C# code for Delete operation
     * @private
     */
    _exportCSharpDelete(target, ctx) {
        const entityName = target?.LogicalName || ctx.PrimaryEntityName || 'entity';
        const entityId = target?.Id || ctx.PrimaryEntityId;

        if (!entityId) {
            DialogService.show(Config.DIALOG_TITLES.error, `<div class="pdt-error">${Config.MESSAGES.PLUGIN_CONTEXT.noEntityId}</div>`);
            return;
        }

        const code = `// Generated by Power-Toolkit\n// Entity: ${entityName}\n// Mode: Delete\n\n// Execute the delete operation\nvar recordId = new Guid("${entityId}");\nservice.Delete("${entityName}", recordId);\nConsole.WriteLine($"Deleted {entityName} record with ID: {recordId}");`;
        const usings = '// Required using statements:\n// using Microsoft.Xrm.Sdk;\n// using System;\n\n';
        const fullCode = usings + code;

        DialogService.show('C# Organization Service Code (Delete)', UIFactory.createCopyableCodeBlock(fullCode, 'csharp'));
    }

    /**
     * Export C# code for Create/Update operation
     * @private
     */
    _exportCSharpCreateUpdate(target, ctx, message) {
        const entityName = target.LogicalName || 'entity';
        const entityId = target.Id;
        const attributes = target.Attributes;

        const entityInit = this._buildCSharpEntityInit(entityName, entityId, message);
        const attributesCode = this._buildCSharpAttributes(attributes);
        const serviceCall = this._buildCSharpServiceCall(message);

        const code = `// Generated by Power-Toolkit\n// Entity: ${entityName}\n// Mode: ${ctx.MessageName}\n\n${entityInit}\n${attributesCode}\n${serviceCall}`;
        const usings = '// Required using statements:\n// using Microsoft.Xrm.Sdk;\n// using Microsoft.Xrm.Sdk.Client;\n// using System;\n\n';
        const fullCode = usings + code;

        DialogService.show(`C# Organization Service Code (${ctx.MessageName})`, UIFactory.createCopyableCodeBlock(fullCode, 'csharp'));
    }

    /**
     * Build C# entity initialization code
     * @private
     */
    _buildCSharpEntityInit(entityName, entityId, message) {
        if (message === Config.PLUGIN_MESSAGES.CREATE.toLowerCase()) {
            return `var entity = new Entity("${entityName}");`;
        }
        if (message === Config.PLUGIN_MESSAGES.UPDATE.toLowerCase() && entityId) {
            return `var entity = new Entity("${entityName}", new Guid("${entityId}"))`;
        }
        return `var entity = new Entity("${entityName}");`;
    }

    /**
     * Build C# attributes assignment code
     * @private
     */
    _buildCSharpAttributes(attributes) {
        const sortedKeys = Object.keys(attributes).sort();
        const lines = sortedKeys.map(key => {
            const value = attributes[key];
            return this._convertToCSharpValue(value, key);
        });
        return lines.join('\n');
    }

    /**
     * Build C# service call code
     * @private
     */
    _buildCSharpServiceCall(message) {
        if (message === Config.PLUGIN_MESSAGES.CREATE.toLowerCase()) {
            return '\n// Execute the operation\nGuid newId = service.Create(entity);\nConsole.WriteLine($"Created record with ID: {newId}");';
        }
        if (message === Config.PLUGIN_MESSAGES.UPDATE.toLowerCase()) {
            return '\n// Execute the operation\nservice.Update(entity);\nConsole.WriteLine("Record updated successfully")';
        }
        return '\n// Execute the operation\n// Use service.Create(entity) or service.Update(entity)';
    }

    /**
     * Converts plugin-style attributes to Web API OData format.
     * @param {object} attributes - The attributes from the plugin context.
     * @param {string} entityName - The logical name of the entity.
     * @returns {Promise<object>} Web API formatted object.
     * @private
     */
    async _convertToWebApiFormat(attributes, _entityName) {
        const webApiData = {};

        for (const [key, value] of Object.entries(attributes)) {
            if (value === null || value === undefined) {
                webApiData[key] = null;
                continue;
            }

            if (value.__type === Config.DATAVERSE_TYPES.ENTITY_REFERENCE) {
                try {
                    let entitySet = this._entitySetCache.get(value.LogicalName);
                    if (!entitySet) {
                        const resolved = await EntityContextResolver.resolve(value.LogicalName);
                        entitySet = resolved.entitySet;
                        this._entitySetCache.set(value.LogicalName, entitySet);
                    }
                    const cleanId = String(value.Id || '').toLowerCase().replace(/[{}]/g, '');
                    webApiData[`${key}@odata.bind`] = `/${entitySet}(${cleanId})`;
                } catch (_e) {
                    const cleanId = String(value.Id || '').toLowerCase().replace(/[{}]/g, '');
                    webApiData[`${key}@odata.bind`] = `/${value.LogicalName}s(${cleanId})`;
                }
            } else if (value.__type === Config.DATAVERSE_TYPES.MONEY) {
                webApiData[key] = value.Value;
            } else if (value.__type === Config.DATAVERSE_TYPES.OPTION_SET_VALUE) {
                webApiData[key] = value.Value;
            } else if (value.__type === Config.DATAVERSE_TYPES.OPTION_SET_VALUE_COLLECTION && Array.isArray(value.Values)) {
                webApiData[key] = value.Values;
            } else if (value.__type === Config.DATAVERSE_TYPES.DATE_TIME) {
                webApiData[key] = value.Iso;
            } else {
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

        if (value.__type === Config.DATAVERSE_TYPES.ENTITY_REFERENCE) {
            const cleanId = String(value.Id || '').toLowerCase().replace(/[{}]/g, '');
            const logicalName = value.LogicalName || 'entity';
            const name = value.Name ? ` // ${value.Name}` : '';
            return `entity["${fieldName}"] = new EntityReference("${logicalName}", new Guid("${cleanId}"));${name}`;
        } if (value.__type === Config.DATAVERSE_TYPES.MONEY) {
            return `entity["${fieldName}"] = new Money(${value.Value}m);`;
        } if (value.__type === Config.DATAVERSE_TYPES.OPTION_SET_VALUE) {
            return `entity["${fieldName}"] = new OptionSetValue(${value.Value});`;
        } if (value.__type === Config.DATAVERSE_TYPES.OPTION_SET_VALUE_COLLECTION && Array.isArray(value.Values)) {
            const values = value.Values.map(v => `    new OptionSetValue(${v})`).join(',\n');
            return `entity["${fieldName}"] = new OptionSetValueCollection\n{\n${values}\n};`;
        } if (value.__type === Config.DATAVERSE_TYPES.DATE_TIME) {
            return `entity["${fieldName}"] = DateTime.Parse("${value.Iso}");`;
        } if (typeof value === 'boolean') {
            return `entity["${fieldName}"] = ${value.toString()};`;
        } if (typeof value === 'number') {
            return `entity["${fieldName}"] = ${value};`;
        } if (typeof value === 'string') {
            const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
            return `entity["${fieldName}"] = "${escaped}";`;
        }
        return `entity["${fieldName}"] = ${JSON.stringify(value)}; // TODO: Review this value`;

    }

    /**
     * Enables or disables the secondary toolbar buttons (Copy, Test, Export).
     * @param {boolean} enabled - Whether to enable the buttons.
     * @private
     */
    _setSecondaryEnabled(enabled) {
        if (!this.ui) {
            return;
        }
        const buttons = [this.ui.copyBtn, this.ui.testBtn, this.ui.exportWebApiBtn, this.ui.exportCSharpBtn];
        buttons.forEach(btn => {
            if (btn) {
                btn.disabled = !enabled;
                btn.classList.toggle('pdt-hidden', !enabled);
            }
        });
    }
}