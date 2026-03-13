/**
 * @file Tests for BulkTouchService
 * @module tests/services/BulkTouchService
 * @description Tests for the shared bulk touch service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/core/Store.js', () => ({
    Store: {
        getState: vi.fn(() => ({ theme: 'dark' }))
    }
}));

vi.mock('../../src/assets/Icons.js', () => ({
    ICONS: { inspector: '<svg>inspect</svg>' }
}));

vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        updateRecord: vi.fn()
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        getEntityMetadata: vi.fn()
    }
}));

vi.mock('../../src/helpers/index.js', () => ({
    escapeHtml: vi.fn((s) => s),
    showColumnBrowser: vi.fn()
}));

vi.mock('../../src/utils/parsers/ErrorParser.js', () => ({
    ErrorParser: { extract: vi.fn((e) => e.message || 'Error') }
}));

vi.mock('../../src/constants/index.js', () => ({
    Config: {
        MESSAGES: {
            WEB_API: {
                touchDialogTitle: 'Touch Config',
                touchDialogInstructions: 'Instructions',
                touchDialogTip: vi.fn(() => 'Tip'),
                touchDialogAddButton: 'Add Field',
                touchDialogConfirmButton: 'Confirm',
                touchDialogCancelButton: 'Cancel',
                touchDialogFieldLabel: vi.fn((n) => `Field #${n}`),
                touchDialogRemoveButton: 'Remove',
                touchDialogColumnLabel: 'Column',
                touchDialogPlaceholder: 'e.g., name',
                touchDialogBrowseTitle: 'Browse',
                touchDialogValueModeLabel: 'Value Mode',
                touchDialogKeepValue: 'Keep current',
                touchDialogSetValue: 'Set custom',
                touchDialogCustomPlaceholder: 'Enter value',
                touchFieldNameRequired: 'Field name required',
                touchCustomValueRequired: 'Custom value required',
                touchNoFieldsConfigured: 'No fields configured',
                touchDialogBrowseFailed: 'Browse failed',
                noPrimaryKeyFound: 'No primary key'
            }
        },
        TOUCH_DIALOG: { focusDelay: 0 },
        DATAVERSE_BATCH: {
            CONCURRENCY: 2,
            PROGRESS_UPDATE_THRESHOLD: 1
        }
    }
}));

import { BulkTouchService } from '../../src/services/BulkTouchService.js';
import { DataService } from '../../src/services/DataService.js';

describe('BulkTouchService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('prepareTouchOperations', () => {
        it('should prepare PATCH operations for each record', () => {
            const records = [
                { accountid: 'id1', name: 'Account 1' },
                { accountid: 'id2', name: 'Account 2' }
            ];
            const touchConfig = [{ field: 'name', useCustomValue: false, customValue: null }];

            const result = BulkTouchService.prepareTouchOperations(records, 'accountid', touchConfig, 'accounts');

            expect(result.allOperations).toHaveLength(2);
            expect(result.totalFailCount).toBe(0);
            expect(result.allErrors).toHaveLength(0);
            expect(result.allOperations[0]).toEqual({
                method: 'PATCH',
                entitySet: 'accounts',
                id: 'id1',
                data: { name: 'Account 1' }
            });
        });

        it('should count records without primary key as failures', () => {
            const records = [
                { accountid: 'id1', name: 'Account 1' },
                { name: 'No ID Account' }
            ];
            const touchConfig = [{ field: 'name', useCustomValue: false, customValue: null }];

            const result = BulkTouchService.prepareTouchOperations(records, 'accountid', touchConfig, 'accounts');

            expect(result.allOperations).toHaveLength(1);
            expect(result.totalFailCount).toBe(1);
            expect(result.allErrors).toHaveLength(1);
        });

        it('should use custom values when useCustomValue is true', () => {
            const records = [{ accountid: 'id1', name: 'Old Name' }];
            const touchConfig = [{ field: 'name', useCustomValue: true, customValue: 'New Name' }];

            const result = BulkTouchService.prepareTouchOperations(records, 'accountid', touchConfig, 'accounts');

            expect(result.allOperations[0].data).toEqual({ name: 'New Name' });
        });

        it('should handle multiple fields in touch config', () => {
            const records = [{ accountid: 'id1', name: 'Test', telephone1: '555-1234' }];
            const touchConfig = [
                { field: 'name', useCustomValue: false, customValue: null },
                { field: 'telephone1', useCustomValue: true, customValue: '555-9999' }
            ];

            const result = BulkTouchService.prepareTouchOperations(records, 'accountid', touchConfig, 'accounts');

            expect(result.allOperations[0].data).toEqual({
                name: 'Test',
                telephone1: '555-9999'
            });
        });

        it('should handle empty records array', () => {
            const result = BulkTouchService.prepareTouchOperations([], 'accountid', [{ field: 'name', useCustomValue: false }], 'accounts');

            expect(result.allOperations).toHaveLength(0);
            expect(result.totalFailCount).toBe(0);
        });
    });

    describe('executeBatchOperations', () => {
        it('should execute all PATCH operations successfully', async () => {
            DataService.updateRecord.mockResolvedValue({});

            const operations = [
                { method: 'PATCH', entitySet: 'accounts', id: 'id1', data: { name: 'Test' } },
                { method: 'PATCH', entitySet: 'accounts', id: 'id2', data: { name: 'Test2' } }
            ];

            const result = await BulkTouchService.executeBatchOperations(operations);

            expect(result.successCount).toBe(2);
            expect(result.failCount).toBe(0);
            expect(result.errors).toHaveLength(0);
            expect(DataService.updateRecord).toHaveBeenCalledTimes(2);
        });

        it('should track failures when operations throw', async () => {
            DataService.updateRecord
                .mockResolvedValueOnce({})
                .mockRejectedValueOnce(new Error('Server error'));

            const operations = [
                { method: 'PATCH', entitySet: 'accounts', id: 'id1', data: { name: 'Test' } },
                { method: 'PATCH', entitySet: 'accounts', id: 'id2', data: { name: 'Test2' } }
            ];

            const result = await BulkTouchService.executeBatchOperations(operations);

            expect(result.successCount).toBe(1);
            expect(result.failCount).toBe(1);
        });

        it('should call progress callback', async () => {
            DataService.updateRecord.mockResolvedValue({});

            const operations = [
                { method: 'PATCH', entitySet: 'accounts', id: 'id1', data: { name: 'Test' } }
            ];
            const progressCb = vi.fn();

            await BulkTouchService.executeBatchOperations(operations, progressCb);

            expect(progressCb).toHaveBeenCalled();
        });

        it('should handle unknown method as failure', async () => {
            const operations = [
                { method: 'DELETE', entitySet: 'accounts', id: 'id1', data: {} }
            ];

            const result = await BulkTouchService.executeBatchOperations(operations);

            expect(result.failCount).toBe(1);
        });

        it('should handle empty operations array', async () => {
            const result = await BulkTouchService.executeBatchOperations([]);

            expect(result.successCount).toBe(0);
            expect(result.failCount).toBe(0);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('showTouchConfigDialog', () => {
        it('should create dialog overlay in document', () => {
            const metadata = { PrimaryNameAttribute: 'name' };
            // Don't await - just trigger dialog creation
            const promise = BulkTouchService.showTouchConfigDialog('account', metadata);

            const overlay = document.getElementById('pdt-touch-config-dialog');
            expect(overlay).toBeTruthy();
            expect(overlay.querySelector('#touch-fields-container')).toBeTruthy();
            expect(overlay.querySelector('#touch-confirm-btn')).toBeTruthy();
            expect(overlay.querySelector('#touch-cancel-btn')).toBeTruthy();

            // Cancel to resolve promise
            overlay.querySelector('#touch-cancel-btn').click();
            return promise.then(result => {
                expect(result).toBeNull();
            });
        });

        it('should resolve null when cancel is clicked', async () => {
            const metadata = { PrimaryNameAttribute: 'name' };
            const promise = BulkTouchService.showTouchConfigDialog('account', metadata);

            const overlay = document.getElementById('pdt-touch-config-dialog');
            overlay.querySelector('#touch-cancel-btn').click();

            const result = await promise;
            expect(result).toBeNull();
        });

        it('should resolve null when close button is clicked', async () => {
            const metadata = { PrimaryNameAttribute: 'name' };
            const promise = BulkTouchService.showTouchConfigDialog('account', metadata);

            const overlay = document.getElementById('pdt-touch-config-dialog');
            overlay.querySelector('.pdt-dialog-close').click();

            const result = await promise;
            expect(result).toBeNull();
        });

        it('should add initial field row prefilled with primary name attribute', () => {
            const metadata = { PrimaryNameAttribute: 'fullname' };
            const promise = BulkTouchService.showTouchConfigDialog('contact', metadata);

            const overlay = document.getElementById('pdt-touch-config-dialog');
            const fieldInput = overlay.querySelector('.field-name-input');
            expect(fieldInput.value).toBe('fullname');

            overlay.querySelector('#touch-cancel-btn').click();
            return promise;
        });

        it('should add new field row when Add Field is clicked', () => {
            const metadata = { PrimaryNameAttribute: 'name' };
            const promise = BulkTouchService.showTouchConfigDialog('account', metadata);

            const overlay = document.getElementById('pdt-touch-config-dialog');
            const addBtn = overlay.querySelector('#touch-add-field-btn');
            const container = overlay.querySelector('#touch-fields-container');

            expect(container.children.length).toBe(1);
            addBtn.click();
            expect(container.children.length).toBe(2);

            overlay.querySelector('#touch-cancel-btn').click();
            return promise;
        });

        it('should resolve with field configs on confirm', async () => {
            const metadata = { PrimaryNameAttribute: 'name' };
            const promise = BulkTouchService.showTouchConfigDialog('account', metadata);

            const overlay = document.getElementById('pdt-touch-config-dialog');
            overlay.querySelector('#touch-confirm-btn').click();

            const result = await promise;
            expect(result).toEqual([
                { field: 'name', useCustomValue: false, customValue: null }
            ]);
        });
    });
});
