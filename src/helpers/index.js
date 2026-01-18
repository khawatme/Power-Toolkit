/**
 * @file Central export point for all helper modules.
 * @module helpers
 * @description Provides barrel exports for all helper modules and maintains backward compatibility
 * with the legacy Helpers object.
 */

// Import all helper modules
export { StringHelpers } from './string.helpers.js';
export { ValidationHelpers } from './validation.helpers.js';
export { FormattingHelpers } from './formatting.helpers.js';
export { DataverseHelpers } from './dataverse.helpers.js';
export { ODataHelpers } from './odata.helpers.js';
export { UIHelpers } from './ui.helpers.js';
export { PerformanceHelpers } from './performance.helpers.js';
export { FileHelpers } from './file.helpers.js';
export { DOMHelpers } from './dom.helpers.js';
export { MetadataHelpers } from './metadata.helpers.js';
export { DialogHelpers } from './dialog.helpers.js';

import { StringHelpers } from './string.helpers.js';
import { ValidationHelpers } from './validation.helpers.js';
import { FormattingHelpers } from './formatting.helpers.js';
import { DataverseHelpers } from './dataverse.helpers.js';
import { ODataHelpers } from './odata.helpers.js';
import { UIHelpers } from './ui.helpers.js';
import { PerformanceHelpers } from './performance.helpers.js';
import { FileHelpers } from './file.helpers.js';
import { DOMHelpers } from './dom.helpers.js';
import { MetadataHelpers } from './metadata.helpers.js';
import { DialogHelpers } from './dialog.helpers.js';

/**
 * Legacy Helpers object for backward compatibility.
 * Combines all helper modules into a single namespace matching the original Helpers API.
 * @namespace Helpers
 * @deprecated Use specific helper modules instead (e.g., StringHelpers, ValidationHelpers).
 */
export const Helpers = {
    // ═══════════════════════════════════════════════════════════════════════════════
    // CONSTANTS (from ODataHelpers)
    // ═══════════════════════════════════════════════════════════════════════════════
    FILTER_OPERATORS: ODataHelpers.FILTER_OPERATORS,
    GUID_REGEX: StringHelpers.GUID_REGEX,

    // ═══════════════════════════════════════════════════════════════════════════════
    // STRING & HTML UTILITIES (from StringHelpers)
    // ═══════════════════════════════════════════════════════════════════════════════
    escapeHtml: StringHelpers.escapeHtml.bind(StringHelpers),
    highlightCode: StringHelpers.highlightCode.bind(StringHelpers),
    formatXml: StringHelpers.formatXml.bind(StringHelpers),
    highlightTraceMessage: StringHelpers.highlightTraceMessage.bind(StringHelpers),
    createCenteredHeader: StringHelpers.createCenteredHeader.bind(StringHelpers),
    createExternalLink: StringHelpers.createExternalLink.bind(StringHelpers),
    extractGuidFromString: StringHelpers.extractGuidFromString.bind(StringHelpers),

    // ═══════════════════════════════════════════════════════════════════════════════
    // VALIDATION UTILITIES (from ValidationHelpers)
    // ═══════════════════════════════════════════════════════════════════════════════
    isValidGuid: ValidationHelpers.isValidGuid.bind(ValidationHelpers),
    isJsonString: ValidationHelpers.isJsonString.bind(ValidationHelpers),
    isOdataProperty: ValidationHelpers.isOdataProperty.bind(ValidationHelpers),
    isSystemProperty: ValidationHelpers.isSystemProperty.bind(ValidationHelpers),
    parseInputValue: ValidationHelpers.parseInputValue.bind(ValidationHelpers),
    addEnterKeyListener: ValidationHelpers.addEnterKeyListener.bind(ValidationHelpers),

    // ═══════════════════════════════════════════════════════════════════════════════
    // FORMATTING UTILITIES (from FormattingHelpers)
    // ═══════════════════════════════════════════════════════════════════════════════
    formatDisplayValue: FormattingHelpers.formatDisplayValue.bind(FormattingHelpers),
    formatValuePreview: FormattingHelpers.formatValuePreview.bind(FormattingHelpers),
    formatMilliseconds: FormattingHelpers.formatMilliseconds.bind(FormattingHelpers),
    formatJsonIfValid: FormattingHelpers.formatJsonIfValid.bind(FormattingHelpers),
    normalizeForJsonCompare: FormattingHelpers.normalizeForJsonCompare.bind(FormattingHelpers),
    roundToDecimal: FormattingHelpers.roundToDecimal.bind(FormattingHelpers),
    safeNumber: FormattingHelpers.safeNumber.bind(FormattingHelpers),
    calculatePercentages: FormattingHelpers.calculatePercentages.bind(FormattingHelpers),
    createInfoGrid: FormattingHelpers.createInfoGrid.bind(FormattingHelpers),

    // ═══════════════════════════════════════════════════════════════════════════════
    // DATAVERSE UTILITIES (from DataverseHelpers)
    // ═══════════════════════════════════════════════════════════════════════════════
    normalizeGuid: DataverseHelpers.normalizeGuid.bind(DataverseHelpers),
    normalizeLookup: DataverseHelpers.normalizeLookup.bind(DataverseHelpers),
    normalizeOptionSet: DataverseHelpers.normalizeOptionSet.bind(DataverseHelpers),
    normalizeDateTime: DataverseHelpers.normalizeDateTime.bind(DataverseHelpers),
    normalizeMoney: DataverseHelpers.normalizeMoney.bind(DataverseHelpers),
    normalizeNumber: DataverseHelpers.normalizeNumber.bind(DataverseHelpers),
    filterSystemFields: DataverseHelpers.filterSystemFields.bind(DataverseHelpers),
    inferDataverseType: DataverseHelpers.inferDataverseType.bind(DataverseHelpers),

    // ═══════════════════════════════════════════════════════════════════════════════
    // ODATA UTILITIES (from ODataHelpers)
    // ═══════════════════════════════════════════════════════════════════════════════
    escapeODataString: ODataHelpers.escapeODataString.bind(ODataHelpers),
    formatODataValue: ODataHelpers.formatODataValue.bind(ODataHelpers),
    shouldShowOperatorValue: ODataHelpers.shouldShowOperatorValue.bind(ODataHelpers),
    buildODataFilterClauses: ODataHelpers.buildODataFilterClauses.bind(ODataHelpers),
    normalizeApiResponse: ODataHelpers.normalizeApiResponse.bind(ODataHelpers),
    filterODataProperties: ODataHelpers.filterODataProperties.bind(ODataHelpers),

    // ═══════════════════════════════════════════════════════════════════════════════
    // UI UTILITIES (from UIHelpers)
    // ═══════════════════════════════════════════════════════════════════════════════
    updatePaginationUI: UIHelpers.updatePaginationUI.bind(UIHelpers),
    toggleElementHeight: UIHelpers.toggleElementHeight.bind(UIHelpers),
    toggleAccordionCategory: UIHelpers.toggleAccordionCategory.bind(UIHelpers),
    setAllAccordionCategories: UIHelpers.setAllAccordionCategories.bind(UIHelpers),
    collapseAllAccordionItems: UIHelpers.collapseAllAccordionItems.bind(UIHelpers),
    buildSearchIndex: UIHelpers.buildSearchIndex.bind(UIHelpers),
    sortArrayByColumn: UIHelpers.sortArrayByColumn.bind(UIHelpers),
    toggleSortState: UIHelpers.toggleSortState.bind(UIHelpers),
    generateSortableTableHeaders: UIHelpers.generateSortableTableHeaders.bind(UIHelpers),

    // ═══════════════════════════════════════════════════════════════════════════════
    // PERFORMANCE UTILITIES (from PerformanceHelpers)
    // ═══════════════════════════════════════════════════════════════════════════════
    debounce: PerformanceHelpers.debounce.bind(PerformanceHelpers),
    throttle: PerformanceHelpers.throttle.bind(PerformanceHelpers),

    // ═══════════════════════════════════════════════════════════════════════════════
    // FILE UTILITIES (from FileHelpers)
    // ═══════════════════════════════════════════════════════════════════════════════
    copyToClipboard: FileHelpers.copyToClipboard.bind(FileHelpers),
    downloadJson: FileHelpers.downloadJson.bind(FileHelpers),
    createFileInputElement: FileHelpers.createFileInputElement.bind(FileHelpers),
    readJsonFile: FileHelpers.readJsonFile.bind(FileHelpers),

    // ═══════════════════════════════════════════════════════════════════════════════
    // DOM UTILITIES (from DOMHelpers)
    // ═══════════════════════════════════════════════════════════════════════════════
    appendLogEntry: DOMHelpers.appendLogEntry.bind(DOMHelpers),
    clearContainer: DOMHelpers.clearContainer.bind(DOMHelpers),
    findNodeInTree: DOMHelpers.findNodeInTree.bind(DOMHelpers),

    // ═══════════════════════════════════════════════════════════════════════════════
    // METADATA UTILITIES (from MetadataHelpers)
    // ═══════════════════════════════════════════════════════════════════════════════
    getMetadataDisplayName: MetadataHelpers.getMetadataDisplayName.bind(MetadataHelpers),

    // ═══════════════════════════════════════════════════════════════════════════════
    // DIALOG UTILITIES (from DialogHelpers)
    // ═══════════════════════════════════════════════════════════════════════════════
    showConfirmDialog: DialogHelpers.showConfirmDialog.bind(DialogHelpers)
};

// ═══════════════════════════════════════════════════════════════════════════════
// NAMED EXPORTS FOR COMMONLY USED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
// These enable tree-shaking and provide convenient access without using Helpers object

// Constants
export const FILTER_OPERATORS = ODataHelpers.FILTER_OPERATORS;
export const GUID_REGEX = StringHelpers.GUID_REGEX;

// String utilities
export const escapeHtml = StringHelpers.escapeHtml.bind(StringHelpers);
export const highlightCode = StringHelpers.highlightCode.bind(StringHelpers);
export const formatXml = StringHelpers.formatXml.bind(StringHelpers);
export const highlightTraceMessage = StringHelpers.highlightTraceMessage.bind(StringHelpers);
export const createCenteredHeader = StringHelpers.createCenteredHeader.bind(StringHelpers);
export const createExternalLink = StringHelpers.createExternalLink.bind(StringHelpers);
export const extractGuidFromString = StringHelpers.extractGuidFromString.bind(StringHelpers);

// Validation utilities
export const isValidGuid = ValidationHelpers.isValidGuid.bind(ValidationHelpers);
export const isJsonString = ValidationHelpers.isJsonString.bind(ValidationHelpers);
export const isOdataProperty = ValidationHelpers.isOdataProperty.bind(ValidationHelpers);
export const isSystemProperty = ValidationHelpers.isSystemProperty.bind(ValidationHelpers);
export const parseInputValue = ValidationHelpers.parseInputValue.bind(ValidationHelpers);
export const addEnterKeyListener = ValidationHelpers.addEnterKeyListener.bind(ValidationHelpers);

// Formatting utilities
export const formatDisplayValue = FormattingHelpers.formatDisplayValue.bind(FormattingHelpers);
export const formatValuePreview = FormattingHelpers.formatValuePreview.bind(FormattingHelpers);
export const formatMilliseconds = FormattingHelpers.formatMilliseconds.bind(FormattingHelpers);
export const formatJsonIfValid = FormattingHelpers.formatJsonIfValid.bind(FormattingHelpers);
export const normalizeForJsonCompare = FormattingHelpers.normalizeForJsonCompare.bind(FormattingHelpers);
export const roundToDecimal = FormattingHelpers.roundToDecimal.bind(FormattingHelpers);
export const safeNumber = FormattingHelpers.safeNumber.bind(FormattingHelpers);
export const calculatePercentages = FormattingHelpers.calculatePercentages.bind(FormattingHelpers);
export const createInfoGrid = FormattingHelpers.createInfoGrid.bind(FormattingHelpers);

// Dataverse utilities
export const normalizeGuid = DataverseHelpers.normalizeGuid.bind(DataverseHelpers);
export const normalizeLookup = DataverseHelpers.normalizeLookup.bind(DataverseHelpers);
export const normalizeOptionSet = DataverseHelpers.normalizeOptionSet.bind(DataverseHelpers);
export const normalizeDateTime = DataverseHelpers.normalizeDateTime.bind(DataverseHelpers);
export const normalizeMoney = DataverseHelpers.normalizeMoney.bind(DataverseHelpers);
export const normalizeNumber = DataverseHelpers.normalizeNumber.bind(DataverseHelpers);
export const filterSystemFields = DataverseHelpers.filterSystemFields.bind(DataverseHelpers);
export const inferDataverseType = DataverseHelpers.inferDataverseType.bind(DataverseHelpers);

// OData utilities
export const escapeODataString = ODataHelpers.escapeODataString.bind(ODataHelpers);
export const formatODataValue = ODataHelpers.formatODataValue.bind(ODataHelpers);
export const normalizeApiResponse = ODataHelpers.normalizeApiResponse.bind(ODataHelpers);
export const filterODataProperties = ODataHelpers.filterODataProperties.bind(ODataHelpers);
export const shouldShowOperatorValue = ODataHelpers.shouldShowOperatorValue.bind(ODataHelpers);
export const buildODataFilterClauses = ODataHelpers.buildODataFilterClauses.bind(ODataHelpers);

// UI utilities
export const updatePaginationUI = UIHelpers.updatePaginationUI.bind(UIHelpers);
export const toggleElementHeight = UIHelpers.toggleElementHeight.bind(UIHelpers);
export const toggleAccordionCategory = UIHelpers.toggleAccordionCategory.bind(UIHelpers);
export const setAllAccordionCategories = UIHelpers.setAllAccordionCategories.bind(UIHelpers);
export const collapseAllAccordionItems = UIHelpers.collapseAllAccordionItems.bind(UIHelpers);
export const buildSearchIndex = UIHelpers.buildSearchIndex.bind(UIHelpers);
export const sortArrayByColumn = UIHelpers.sortArrayByColumn.bind(UIHelpers);
export const toggleSortState = UIHelpers.toggleSortState.bind(UIHelpers);
export const generateSortableTableHeaders = UIHelpers.generateSortableTableHeaders.bind(UIHelpers);

// File utilities
export const copyToClipboard = FileHelpers.copyToClipboard.bind(FileHelpers);
export const downloadJson = FileHelpers.downloadJson.bind(FileHelpers);
export const createFileInputElement = FileHelpers.createFileInputElement.bind(FileHelpers);
export const readJsonFile = FileHelpers.readJsonFile.bind(FileHelpers);

// Performance utilities
export const debounce = PerformanceHelpers.debounce.bind(PerformanceHelpers);
export const throttle = PerformanceHelpers.throttle.bind(PerformanceHelpers);

// DOM utilities
export const appendLogEntry = DOMHelpers.appendLogEntry.bind(DOMHelpers);
export const clearContainer = DOMHelpers.clearContainer.bind(DOMHelpers);
export const findNodeInTree = DOMHelpers.findNodeInTree.bind(DOMHelpers);

// Metadata utilities
export const getMetadataDisplayName = MetadataHelpers.getMetadataDisplayName.bind(MetadataHelpers);
export const showColumnBrowser = MetadataHelpers.showColumnBrowser.bind(MetadataHelpers);

// Dialog utilities
export const showConfirmDialog = DialogHelpers.showConfirmDialog.bind(DialogHelpers);
