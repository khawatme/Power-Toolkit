/**
 * @file BulkTouchService - Shared service for bulk touch operations.
 * @module services/BulkTouchService
 * @description Provides the touch configuration dialog and batch execution logic
 */

import { Store } from '../core/Store.js';
import { ICONS } from '../assets/Icons.js';
import { DataService } from './DataService.js';
import { NotificationService } from './NotificationService.js';
import { PowerAppsApiService } from './PowerAppsApiService.js';
import { escapeHtml, showColumnBrowser } from '../helpers/index.js';
import { ErrorParser } from '../utils/parsers/ErrorParser.js';
import { Config } from '../constants/index.js';

/**
 * Shared service for bulk touch (update-without-change) operations.
 * @class BulkTouchService
 */
export class BulkTouchService {
    /**
     * Displays the touch configuration dialog for field selection.
     * @param {string} logicalName - Entity logical name
     * @param {Object} metadata - Entity metadata (must include PrimaryNameAttribute)
     * @returns {Promise<Array<{field: string, useCustomValue: boolean, customValue: any}>|null>} Touch configs or null if cancelled
     */
    static showTouchConfigDialog(logicalName, metadata) {
        const primaryNameAttr = metadata.PrimaryNameAttribute || 'name';

        return new Promise((resolve) => {
            const overlay = BulkTouchService._createDialogOverlay(primaryNameAttr);
            document.body.appendChild(overlay);

            const fieldsContainer = overlay.querySelector('#touch-fields-container');
            const addFieldBtn = overlay.querySelector('#touch-add-field-btn');
            const confirmBtn = overlay.querySelector('#touch-confirm-btn');
            const cancelBtn = overlay.querySelector('#touch-cancel-btn');

            BulkTouchService._addFieldRow(logicalName, fieldsContainer, primaryNameAttr, 'current', '', true);

            addFieldBtn.addEventListener('click', () => {
                BulkTouchService._addFieldRow(logicalName, fieldsContainer, '', 'current', '', false);
            });

            confirmBtn.addEventListener('click', () => {
                BulkTouchService._handleConfirm(fieldsContainer, overlay, resolve);
            });

            const closeBtn = overlay.querySelector('.pdt-dialog-close');
            BulkTouchService._bindCancelHandlers(overlay, cancelBtn, resolve, closeBtn);

            const focusDelay = Config.TOUCH_DIALOG?.focusDelay || 100;
            setTimeout(() => {
                const firstInput = overlay.querySelector('.field-name-input');
                if (firstInput) {
                    firstInput.select();
                }
            }, focusDelay);
        });
    }

    /**
     * Prepares batch PATCH operations for touch.
     * @param {Array<Object>} records - Records to touch
     * @param {string} primaryKey - Primary key attribute name
     * @param {Array<{field: string, useCustomValue: boolean, customValue: any}>} touchConfig - Touch field configs
     * @param {string} entitySet - Entity set name for API calls
     * @returns {{allOperations: Array, totalFailCount: number, allErrors: Array}}
     */
    static prepareTouchOperations(records, primaryKey, touchConfig, entitySet) {
        const allOperations = [];
        let totalFailCount = 0;
        const allErrors = [];

        for (const record of records) {
            const recordId = record[primaryKey];
            if (!recordId) {
                totalFailCount++;
                allErrors.push({ index: allOperations.length, error: Config.MESSAGES.WEB_API.noPrimaryKeyFound });
                continue;
            }

            const data = BulkTouchService._buildTouchData(record, touchConfig);
            allOperations.push({
                method: 'PATCH',
                entitySet,
                id: recordId,
                data
            });
        }

        return { allOperations, totalFailCount, allErrors };
    }

    /**
     * Executes batch touch operations with progress reporting.
     * @param {Array<{method: string, entitySet: string, id: string, data: Object}>} operations - Batch operations
     * @param {Function} [progressCallback] - Progress callback (processed, total)
     * @returns {Promise<{successCount: number, failCount: number, errors: Array}>}
     */
    static async executeBatchOperations(operations, progressCallback) {
        const CONCURRENCY = Config.DATAVERSE_BATCH?.CONCURRENCY || 5;
        const PROGRESS_UPDATE_THRESHOLD = Config.DATAVERSE_BATCH?.PROGRESS_UPDATE_THRESHOLD || 10;
        const total = operations.length;
        let processed = 0;
        let lastProgressUpdate = 0;
        let totalSuccessCount = 0;
        let totalFailCount = 0;
        const allErrors = [];

        for (let i = 0; i < operations.length; i += CONCURRENCY) {
            const chunk = operations.slice(i, i + CONCURRENCY);

            const results = await Promise.allSettled(
                chunk.map(async (op, chunkIndex) => {
                    const globalIndex = i + chunkIndex;
                    try {
                        if (op.method === 'PATCH') {
                            await DataService.updateRecord(op.entitySet, op.id, op.data);
                            return { success: true, index: globalIndex };
                        }
                        return { success: false, index: globalIndex, error: 'Unknown method' };
                    } catch (error) {
                        return {
                            success: false,
                            index: globalIndex,
                            error: ErrorParser.extract(error)
                        };
                    }
                })
            );

            results.forEach((result) => {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        totalSuccessCount++;
                    } else {
                        totalFailCount++;
                        allErrors.push({ index: result.value.index, error: result.value.error });
                    }
                } else {
                    totalFailCount++;
                    allErrors.push({ index: processed + results.indexOf(result), error: result.reason?.message || 'Unknown error' });
                }
            });

            processed += chunk.length;

            if (progressCallback && (processed - lastProgressUpdate >= PROGRESS_UPDATE_THRESHOLD || processed === total)) {
                progressCallback(processed, total);
                lastProgressUpdate = processed;
            }
        }

        return { successCount: totalSuccessCount, failCount: totalFailCount, errors: allErrors };
    }

    /**
     * Creates the touch dialog overlay DOM structure.
     * @private
     * @param {string} primaryNameAttr - Primary name attribute
     * @returns {HTMLElement} Dialog overlay
     */
    static _createDialogOverlay(primaryNameAttr) {
        const overlay = document.createElement('div');
        overlay.id = 'pdt-touch-config-dialog';
        overlay.className = 'pdt-dialog-overlay';

        if (Store.getState().theme === 'light') {
            overlay.classList.add('light-mode');
        }

        overlay.innerHTML = `
            <div class="pdt-dialog pdt-dialog-large">
                <div class="pdt-dialog-header">
                    <h3>${Config.MESSAGES.WEB_API.touchDialogTitle}</h3>
                    <button class="pdt-dialog-close" aria-label="Close">&times;</button>
                </div>
                <div class="pdt-dialog-body">
                    <div class="pdt-note mb-15">
                        <p>${Config.MESSAGES.WEB_API.touchDialogInstructions}</p>
                        <p class="mt-5">${Config.MESSAGES.WEB_API.touchDialogTip(escapeHtml(primaryNameAttr))}</p>
                    </div>
                    <div id="touch-fields-container"></div>
                    <div class="pdt-toolbar pdt-touch-add-toolbar">
                        <button id="touch-add-field-btn" class="modern-button secondary">
                            ${Config.MESSAGES.WEB_API.touchDialogAddButton}
                        </button>
                    </div>
                </div>
                <div class="pdt-dialog-footer">
                    <button id="touch-confirm-btn" class="modern-button primary">${Config.MESSAGES.WEB_API.touchDialogConfirmButton}</button>
                    <button id="touch-cancel-btn" class="modern-button secondary">${Config.MESSAGES.WEB_API.touchDialogCancelButton}</button>
                </div>
            </div>
        `;
        return overlay;
    }

    /**
     * Adds a field row to the touch configuration dialog.
     * @private
     * @param {string} logicalName - Entity logical name
     * @param {HTMLElement} fieldsContainer - Container for field rows
     * @param {string} fieldName - Initial field name
     * @param {string} valueMode - 'current' or 'custom'
     * @param {string} customValue - Initial custom value
     * @param {boolean} isFirst - Whether this is the first row
     */
    static _addFieldRow(logicalName, fieldsContainer, fieldName = '', valueMode = 'current', customValue = '', isFirst = false) {
        const rowId = `touch-row-${Date.now()}-${Math.random()}`;
        const row = BulkTouchService._createFieldRowHTML(fieldsContainer, rowId, fieldName, valueMode, customValue, isFirst);
        fieldsContainer.appendChild(row);
        BulkTouchService._bindFieldRowHandlers(logicalName, fieldsContainer, row, rowId, isFirst);
    }

    /**
     * Creates field row HTML element.
     * @private
     * @param {HTMLElement} fieldsContainer - Container for rows
     * @param {string} rowId - Unique row ID
     * @param {string} fieldName - Field name
     * @param {string} valueMode - Value mode
     * @param {string} customValue - Custom value
     * @param {boolean} isFirst - Whether removable
     * @returns {HTMLElement} Field row element
     */
    static _createFieldRowHTML(fieldsContainer, rowId, fieldName, valueMode, customValue, isFirst) {
        const row = document.createElement('div');
        row.className = 'pdt-builder-group mb-15';
        row.dataset.rowId = rowId;
        row.innerHTML = `
            <div class="pdt-section-header">
                ${Config.MESSAGES.WEB_API.touchDialogFieldLabel(fieldsContainer.children.length + 1)}
                ${!isFirst ? `<button class="modern-button secondary pdt-touch-remove-btn" title="${Config.MESSAGES.WEB_API.touchDialogRemoveButton}">${Config.MESSAGES.WEB_API.touchDialogRemoveButton}</button>` : ''}
            </div>
            <div class="pdt-builder-content">
                <div class="pdt-form-row">
                    <label class="pdt-label">${Config.MESSAGES.WEB_API.touchDialogColumnLabel}</label>
                    <div class="flex-1 gap-10">
                        <input type="text" class="pdt-input field-name-input flex-1" value="${escapeHtml(fieldName)}" placeholder="${Config.MESSAGES.WEB_API.touchDialogPlaceholder}">
                        <button class="pdt-input-btn browse-field-btn" title="${Config.MESSAGES.WEB_API.touchDialogBrowseTitle}">${ICONS.inspector}</button>
                    </div>
                </div>
                <div class="pdt-form-row mt-10">
                    <label class="pdt-label">${Config.MESSAGES.WEB_API.touchDialogValueModeLabel}</label>
                    <div class="flex-1">
                        <label class="pdt-radio-label">
                            <input type="radio" name="value-mode-${rowId}" value="current" ${valueMode === 'current' ? 'checked' : ''}>
                            <span>${Config.MESSAGES.WEB_API.touchDialogKeepValue}</span>
                        </label>
                        <label class="pdt-radio-label mt-5">
                            <input type="radio" name="value-mode-${rowId}" value="custom" ${valueMode === 'custom' ? 'checked' : ''}>
                            <span>${Config.MESSAGES.WEB_API.touchDialogSetValue}</span>
                        </label>
                        <input type="text" class="pdt-input custom-value-input mt-5" value="${escapeHtml(customValue)}" placeholder="${Config.MESSAGES.WEB_API.touchDialogCustomPlaceholder}" ${valueMode === 'current' ? 'disabled' : ''}>
                    </div>
                </div>
            </div>
        `;
        return row;
    }

    /**
     * Binds event handlers for a touch field row.
     * @private
     * @param {string} logicalName - Entity logical name
     * @param {HTMLElement} fieldsContainer - Container for rows
     * @param {HTMLElement} row - Field row element
     * @param {string} rowId - Unique row ID
     * @param {boolean} isFirst - Whether first row
     */
    static _bindFieldRowHandlers(logicalName, fieldsContainer, row, rowId, isFirst) {
        const fieldInput = row.querySelector('.field-name-input');
        const customValueInput = row.querySelector('.custom-value-input');
        const browseBtn = row.querySelector('.browse-field-btn');
        const radioButtons = row.querySelectorAll(`input[name="value-mode-${rowId}"]`);
        const removeBtn = row.querySelector('.pdt-touch-remove-btn');

        radioButtons.forEach(radio => {
            radio.addEventListener('change', () => {
                customValueInput.disabled = radio.value !== 'custom';
                if (radio.value === 'custom') {
                    customValueInput.focus();
                }
            });
        });

        browseBtn.addEventListener('click', () => {
            BulkTouchService._handleFieldBrowse(logicalName, fieldInput);
        });

        if (removeBtn && !isFirst) {
            removeBtn.addEventListener('click', () => {
                BulkTouchService._handleFieldRemove(fieldsContainer, row);
            });
        }
    }

    /**
     * Handles browse button click.
     * @private
     * @param {string} logicalName - Entity logical name
     * @param {HTMLElement} fieldInput - Field input element
     */
    static _handleFieldBrowse(logicalName, fieldInput) {
        try {
            showColumnBrowser(
                async () => {
                    await PowerAppsApiService.getEntityMetadata(logicalName);
                    return logicalName;
                },
                (attr) => {
                    fieldInput.value = attr.LogicalName;
                }
            );
        } catch (err) {
            NotificationService.show(err.message || Config.MESSAGES.WEB_API.touchDialogBrowseFailed, 'error');
        }
    }

    /**
     * Handles field row removal.
     * @private
     * @param {HTMLElement} fieldsContainer - Container for rows
     * @param {HTMLElement} row - Row to remove
     */
    static _handleFieldRemove(fieldsContainer, row) {
        row.remove();
        Array.from(fieldsContainer.children).forEach((r, idx) => {
            const header = r.querySelector('.pdt-section-header');
            const fieldNum = header.childNodes[0];
            fieldNum.textContent = Config.MESSAGES.WEB_API.touchDialogFieldLabel(idx + 1);
        });
    }

    /**
     * Handles confirm button click.
     * @private
     * @param {HTMLElement} fieldsContainer - Container for rows
     * @param {HTMLElement} overlay - Dialog overlay
     * @param {Function} resolve - Promise resolve function
     */
    static _handleConfirm(fieldsContainer, overlay, resolve) {
        const rows = fieldsContainer.querySelectorAll('.pdt-builder-group');
        const fields = [];

        for (const row of rows) {
            const fieldInput = row.querySelector('.field-name-input');
            const field = fieldInput.value.trim();

            if (!field) {
                NotificationService.show(Config.MESSAGES.WEB_API.touchFieldNameRequired, 'warning');
                fieldInput.focus();
                return;
            }

            const rowId = row.dataset.rowId;
            const selectedMode = row.querySelector(`input[name="value-mode-${rowId}"]:checked`).value;
            const useCustomValue = selectedMode === 'custom';
            const customValueInput = row.querySelector('.custom-value-input');
            const customValue = useCustomValue ? customValueInput.value : null;

            if (useCustomValue && !customValue) {
                NotificationService.show(Config.MESSAGES.WEB_API.touchCustomValueRequired, 'warning');
                customValueInput.focus();
                return;
            }

            fields.push({ field, useCustomValue, customValue });
        }

        if (fields.length === 0) {
            NotificationService.show(Config.MESSAGES.WEB_API.touchNoFieldsConfigured, 'warning');
            return;
        }

        overlay.remove();
        resolve(fields);
    }

    /**
     * Binds cancel/close handlers for the dialog.
     * @private
     * @param {HTMLElement} overlay - Dialog overlay
     * @param {HTMLElement} cancelBtn - Cancel button
     * @param {Function} resolve - Promise resolve function
     * @param {HTMLElement} [closeBtn] - Close button
     */
    /* eslint-disable no-use-before-define */
    static _bindCancelHandlers(overlay, cancelBtn, resolve, closeBtn) {
        let cleaned = false;

        const handleCancel = () => {
            if (cleaned) {
                return;
            }
            cleaned = true;
            document.removeEventListener('keydown', handleEsc);
            overlay.removeEventListener('click', handleOverlayClick);
            cancelBtn.removeEventListener('click', handleCancel);
            if (closeBtn) {
                closeBtn.removeEventListener('click', handleCancel);
            }
            overlay.remove();
            resolve(null);
        };

        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            }
        };

        const handleOverlayClick = (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        };

        cancelBtn.addEventListener('click', handleCancel);
        if (closeBtn) {
            closeBtn.addEventListener('click', handleCancel);
        }
        overlay.addEventListener('click', handleOverlayClick);
        document.addEventListener('keydown', handleEsc);
    }
    /* eslint-enable no-use-before-define */

    /**
     * Builds the touch data payload for a single record.
     * @private
     * @param {Object} record - Source record
     * @param {Array<{field: string, useCustomValue: boolean, customValue: any}>} touchConfig - Field configs
     * @returns {Object} Data payload for PATCH
     */
    static _buildTouchData(record, touchConfig) {
        const data = {};
        for (const config of touchConfig) {
            let touchValue;
            if (config.useCustomValue) {
                touchValue = config.customValue;
            } else {
                touchValue = record[config.field] ?? record[config.field.toLowerCase()] ?? null;
            }
            data[config.field] = touchValue;
        }
        return data;
    }
}
