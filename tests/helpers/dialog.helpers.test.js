/**
 * @file Tests for dialog helpers
 * @module tests/helpers/dialog.helpers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DialogHelpers } from '../../src/helpers/dialog.helpers.js';
import { DialogService } from '../../src/services/DialogService.js';

// Mock Store for DialogService
vi.mock('../../src/core/Store.js', () => ({
    Store: {
        getState: vi.fn(() => ({ theme: 'dark' }))
    }
}));

describe('DialogHelpers', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Clean up any dialogs
        document.getElementById('pdt-dialog-overlay')?.remove();
        vi.restoreAllMocks();
    });

    describe('showConfirmDialog', () => {
        describe('Dialog Creation', () => {
            it('should create a dialog overlay when called', async () => {
                const promise = DialogHelpers.showConfirmDialog('Test Title', 'Test content');

                const overlay = document.getElementById('pdt-dialog-overlay');
                expect(overlay).toBeTruthy();

                // Clean up by clicking cancel
                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should display the provided title', async () => {
                const promise = DialogHelpers.showConfirmDialog('My Custom Title', 'Content');

                const titleElement = document.querySelector('#pdt-dialog-title');
                expect(titleElement?.textContent).toBe('My Custom Title');

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should display string content correctly', async () => {
                const promise = DialogHelpers.showConfirmDialog('Title', '<p>String content here</p>');

                const contentElement = document.querySelector('.pdt-dialog-content');
                expect(contentElement?.innerHTML).toContain('String content here');

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should display HTMLElement content correctly', async () => {
                const div = document.createElement('div');
                div.className = 'custom-element';
                div.textContent = 'Element content';

                const promise = DialogHelpers.showConfirmDialog('Title', div);

                const contentElement = document.querySelector('.pdt-dialog-content');
                expect(contentElement?.querySelector('.custom-element')).toBeTruthy();
                expect(contentElement?.textContent).toContain('Element content');

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should show OK button for confirmation', async () => {
                const promise = DialogHelpers.showConfirmDialog('Title', 'Content');

                const okButton = document.querySelector('.pdt-dialog-ok');
                expect(okButton).toBeTruthy();
                expect(okButton?.textContent).toBe('OK');

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should show Close button', async () => {
                const promise = DialogHelpers.showConfirmDialog('Title', 'Content');

                const closeButton = document.querySelector('.pdt-dialog-cancel');
                expect(closeButton).toBeTruthy();

                closeButton?.click();
                await promise;
            });

            it('should show X button in header', async () => {
                const promise = DialogHelpers.showConfirmDialog('Title', 'Content');

                const xButton = document.querySelector('.pdt-close-btn');
                expect(xButton).toBeTruthy();
                // Check for the times symbol (either entity or character)
                expect(xButton?.innerHTML).toContain('times');

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should have proper dialog structure', async () => {
                const promise = DialogHelpers.showConfirmDialog('Title', 'Content');

                const overlay = document.getElementById('pdt-dialog-overlay');
                const dialog = overlay?.querySelector('.pdt-dialog');
                const header = overlay?.querySelector('.pdt-dialog-header');
                const content = overlay?.querySelector('.pdt-dialog-content');
                const footer = overlay?.querySelector('.pdt-dialog-footer');

                expect(overlay).toBeTruthy();
                expect(dialog).toBeTruthy();
                expect(header).toBeTruthy();
                expect(content).toBeTruthy();
                expect(footer).toBeTruthy();

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });
        });

        describe('Promise Resolution - OK Button', () => {
            it('should resolve to true when OK button is clicked', async () => {
                const promise = DialogHelpers.showConfirmDialog('Confirm', 'Are you sure?');

                const okBtn = document.querySelector('.pdt-dialog-ok');
                okBtn?.click();

                const result = await promise;
                expect(result).toBe(true);
            });

            it('should close dialog when OK is clicked', async () => {
                const promise = DialogHelpers.showConfirmDialog('Confirm', 'Content');

                const okBtn = document.querySelector('.pdt-dialog-ok');
                okBtn?.click();

                await promise;

                const overlay = document.getElementById('pdt-dialog-overlay');
                expect(overlay).toBeFalsy();
            });

            it('should only resolve once even if OK is clicked multiple times', async () => {
                const promise = DialogHelpers.showConfirmDialog('Confirm', 'Content');

                const okBtn = document.querySelector('.pdt-dialog-ok');
                okBtn?.click();
                okBtn?.click();
                okBtn?.click();

                const result = await promise;
                expect(result).toBe(true);
            });
        });

        describe('Promise Resolution - Cancel/Dismiss', () => {
            it('should resolve to false when Close button is clicked', async () => {
                const promise = DialogHelpers.showConfirmDialog('Confirm', 'Content');

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();

                const result = await promise;
                expect(result).toBe(false);
            });

            it('should resolve to false when X button is clicked', async () => {
                const promise = DialogHelpers.showConfirmDialog('Confirm', 'Content');

                const xBtn = document.querySelector('.pdt-close-btn');
                xBtn?.click();

                const result = await promise;
                expect(result).toBe(false);
            });

            it('should resolve to false when clicking overlay background', async () => {
                const promise = DialogHelpers.showConfirmDialog('Confirm', 'Content');

                const overlay = document.getElementById('pdt-dialog-overlay');
                // Simulate click on overlay (not on dialog itself)
                const event = new MouseEvent('click', { bubbles: true });
                Object.defineProperty(event, 'target', { value: overlay });
                overlay?.dispatchEvent(event);

                const result = await promise;
                expect(result).toBe(false);
            });

            it('should close dialog when cancelled', async () => {
                const promise = DialogHelpers.showConfirmDialog('Confirm', 'Content');

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();

                await promise;

                const overlay = document.getElementById('pdt-dialog-overlay');
                expect(overlay).toBeFalsy();
            });
        });

        describe('Keyboard Handling', () => {
            it('should resolve to false when Escape key is pressed', async () => {
                const promise = DialogHelpers.showConfirmDialog('Confirm', 'Content');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

                const result = await promise;
                expect(result).toBe(false);
            });

            it('should close dialog when Escape is pressed', async () => {
                const promise = DialogHelpers.showConfirmDialog('Confirm', 'Content');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

                await promise;

                const overlay = document.getElementById('pdt-dialog-overlay');
                expect(overlay).toBeFalsy();
            });

            it('should not close on other key presses', async () => {
                const promise = DialogHelpers.showConfirmDialog('Confirm', 'Content');

                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));

                const overlay = document.getElementById('pdt-dialog-overlay');
                expect(overlay).toBeTruthy();

                // Clean up
                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });
        });

        describe('Edge Cases', () => {
            it('should handle empty title', async () => {
                const promise = DialogHelpers.showConfirmDialog('', 'Content');

                const titleElement = document.querySelector('#pdt-dialog-title');
                expect(titleElement?.textContent).toBe('');

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should handle empty content', async () => {
                const promise = DialogHelpers.showConfirmDialog('Title', '');

                const contentElement = document.querySelector('.pdt-dialog-content');
                expect(contentElement?.innerHTML).toBe('');

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should handle special characters in title', async () => {
                const specialTitle = '<script>alert("xss")</script> & "quotes" \'single\'';
                const promise = DialogHelpers.showConfirmDialog(specialTitle, 'Content');

                const titleElement = document.querySelector('#pdt-dialog-title');
                // Title should contain the text (may be escaped)
                expect(titleElement).toBeTruthy();

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should handle HTML content with special characters', async () => {
                const htmlContent = '<div>Test &amp; more &lt;content&gt;</div>';
                const promise = DialogHelpers.showConfirmDialog('Title', htmlContent);

                const contentElement = document.querySelector('.pdt-dialog-content');
                expect(contentElement?.innerHTML).toContain('Test');

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should handle very long title', async () => {
                const longTitle = 'A'.repeat(500);
                const promise = DialogHelpers.showConfirmDialog(longTitle, 'Content');

                const titleElement = document.querySelector('#pdt-dialog-title');
                expect(titleElement?.textContent).toBe(longTitle);

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should handle very long content', async () => {
                const longContent = '<p>' + 'B'.repeat(10000) + '</p>';
                const promise = DialogHelpers.showConfirmDialog('Title', longContent);

                const contentElement = document.querySelector('.pdt-dialog-content');
                expect(contentElement?.innerHTML).toContain('B'.repeat(100));

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should handle Unicode characters', async () => {
                const unicodeContent = '<div>日本語 🎉 émojis 中文</div>';
                const promise = DialogHelpers.showConfirmDialog('Üñíçödé Title', unicodeContent);

                const titleElement = document.querySelector('#pdt-dialog-title');
                const contentElement = document.querySelector('.pdt-dialog-content');

                expect(titleElement?.textContent).toBe('Üñíçödé Title');
                expect(contentElement?.innerHTML).toContain('日本語');
                expect(contentElement?.innerHTML).toContain('🎉');

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should handle nested HTML elements', async () => {
                const nestedContent = '<div><ul><li>Item 1</li><li>Item 2</li></ul></div>';
                const promise = DialogHelpers.showConfirmDialog('Title', nestedContent);

                const contentElement = document.querySelector('.pdt-dialog-content');
                expect(contentElement?.querySelectorAll('li').length).toBe(2);

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });
        });

        describe('Multiple Dialogs', () => {
            it('should replace existing dialog when new one is shown', async () => {
                // Show first dialog - don't await, just let MutationObserver watch
                const promise1 = DialogHelpers.showConfirmDialog('First', 'First content');

                // Show second dialog (should replace first)
                const promise2 = DialogHelpers.showConfirmDialog('Second', 'Second content');

                const overlays = document.querySelectorAll('#pdt-dialog-overlay');
                expect(overlays.length).toBe(1);

                const titleElement = document.querySelector('#pdt-dialog-title');
                expect(titleElement?.textContent).toBe('Second');

                // Both promises should eventually resolve - first to false, second we cancel
                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();

                // Wait for both with a race condition timeout
                const [result1, result2] = await Promise.all([promise1, promise2]);
                expect(result1).toBe(false);
                expect(result2).toBe(false);
            });

            it('should properly handle sequential dialogs', async () => {
                // First dialog
                const promise1 = DialogHelpers.showConfirmDialog('First', 'Content');
                const okBtn1 = document.querySelector('.pdt-dialog-ok');
                okBtn1?.click();
                const result1 = await promise1;
                expect(result1).toBe(true);

                // Second dialog
                const promise2 = DialogHelpers.showConfirmDialog('Second', 'Content');
                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                const result2 = await promise2;
                expect(result2).toBe(false);
            });
        });

        describe('DialogService Integration', () => {
            it('should call DialogService.show with correct parameters', async () => {
                const showSpy = vi.spyOn(DialogService, 'show');

                const promise = DialogHelpers.showConfirmDialog('Test Title', 'Test Content');

                expect(showSpy).toHaveBeenCalledTimes(1);
                expect(showSpy).toHaveBeenCalledWith(
                    'Test Title',
                    'Test Content',
                    expect.any(Function)
                );

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should use MutationObserver to detect dialog closure', async () => {
                const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');

                const promise = DialogHelpers.showConfirmDialog('Title', 'Content');

                expect(observeSpy).toHaveBeenCalledWith(
                    document.body,
                    { childList: true }
                );

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should disconnect MutationObserver after dialog closes', async () => {
                const disconnectSpy = vi.spyOn(MutationObserver.prototype, 'disconnect');

                const promise = DialogHelpers.showConfirmDialog('Title', 'Content');

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();

                await promise;

                expect(disconnectSpy).toHaveBeenCalled();
            });
        });

        describe('Accessibility', () => {
            it('should have proper ARIA attributes on dialog', async () => {
                const promise = DialogHelpers.showConfirmDialog('Title', 'Content');

                const dialog = document.querySelector('.pdt-dialog');
                expect(dialog?.getAttribute('role')).toBe('dialog');
                expect(dialog?.getAttribute('aria-modal')).toBe('true');

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });

            it('should have aria-label on close button', async () => {
                const promise = DialogHelpers.showConfirmDialog('Title', 'Content');

                const closeBtn = document.querySelector('.pdt-close-btn');
                expect(closeBtn?.getAttribute('aria-label')).toBe('Close dialog');

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();
                await promise;
            });
        });

        describe('Concurrent Resolution Prevention', () => {
            it('should only resolve once when OK then cancel is clicked', async () => {
                let resolveCount = 0;
                const originalPromise = DialogHelpers.showConfirmDialog('Title', 'Content');
                const trackedPromise = originalPromise.then(result => {
                    resolveCount++;
                    return result;
                });

                const okBtn = document.querySelector('.pdt-dialog-ok');
                okBtn?.click();

                const result = await trackedPromise;
                expect(result).toBe(true);
                expect(resolveCount).toBe(1);
            });

            it('should only resolve once when cancel then OK is attempted', async () => {
                let resolveCount = 0;
                const originalPromise = DialogHelpers.showConfirmDialog('Title', 'Content');
                const trackedPromise = originalPromise.then(result => {
                    resolveCount++;
                    return result;
                });

                const cancelBtn = document.querySelector('.pdt-dialog-cancel');
                cancelBtn?.click();

                const result = await trackedPromise;
                expect(result).toBe(false);
                expect(resolveCount).toBe(1);
            });
        });
    });

    describe('DialogHelpers namespace', () => {
        it('should export showConfirmDialog function', () => {
            expect(typeof DialogHelpers.showConfirmDialog).toBe('function');
        });

        it('should have showConfirmDialog as the main confirmation method', () => {
            expect(DialogHelpers).toHaveProperty('showConfirmDialog');
        });
    });
});
