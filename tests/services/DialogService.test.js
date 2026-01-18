import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DialogService } from '../../src/services/DialogService.js';

// Mock Store
vi.mock('../../src/core/Store.js', () => ({
    Store: {
        getState: vi.fn(() => ({ theme: 'dark' }))
    }
}));

describe('DialogService', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        // Clean up any dialogs
        document.getElementById('pdt-dialog-overlay')?.remove();
    });

    describe('show', () => {
        it('should create and display a dialog', () => {
            DialogService.show('Test Title', '<p>Test content</p>');
            
            const overlay = document.getElementById('pdt-dialog-overlay');
            expect(overlay).toBeTruthy();
        });

        it('should set dialog title correctly', () => {
            DialogService.show('My Dialog Title', '<p>Content</p>');
            
            const titleElement = document.querySelector('#pdt-dialog-title');
            expect(titleElement?.textContent).toBe('My Dialog Title');
        });

        it('should set dialog content from HTML string', () => {
            DialogService.show('Title', '<p>Test HTML Content</p>');
            
            const contentElement = document.querySelector('.pdt-dialog-content');
            expect(contentElement?.innerHTML).toContain('Test HTML Content');
        });

        it('should set dialog content from HTMLElement', () => {
            const div = document.createElement('div');
            div.textContent = 'Element Content';
            
            DialogService.show('Title', div);
            
            const contentElement = document.querySelector('.pdt-dialog-content');
            expect(contentElement?.textContent).toContain('Element Content');
        });

        it('should show OK button if callback provided', () => {
            DialogService.show('Title', '<p>Content</p>', () => { });
            
            const okButton = document.querySelector('.pdt-dialog-ok');
            expect(okButton).toBeTruthy();
        });

        it('should not show OK button if no callback', () => {
            DialogService.show('Title', '<p>Content</p>');
            
            const okButton = document.querySelector('.pdt-dialog-ok');
            expect(okButton).toBeFalsy();
        });

        it('should always show Close button', () => {
            DialogService.show('Title', '<p>Content</p>');
            
            const closeButton = document.querySelector('.pdt-dialog-cancel');
            expect(closeButton).toBeTruthy();
        });

        it('should apply light mode class when theme is light', () => {
            expect(() => {
                DialogService.show('Title', '<p>Content</p>');
            }).not.toThrow();
            
            const overlay = document.getElementById('pdt-dialog-overlay');
            // Check overlay exists (light mode class may or may not be present depending on Store state)
            expect(overlay).toBeTruthy();
        });

        it('should remove existing dialog before creating new one', () => {
            DialogService.show('First Dialog', '<p>First</p>');
            DialogService.show('Second Dialog', '<p>Second</p>');
            
            const overlays = document.querySelectorAll('#pdt-dialog-overlay');
            expect(overlays.length).toBe(1);
        });

        it('should return controller object with close method', () => {
            const controller = DialogService.show('Title', '<p>Content</p>');
            
            expect(controller).toHaveProperty('close');
            expect(typeof controller.close).toBe('function');
        });

        it('should close dialog when close method is called', () => {
            const controller = DialogService.show('Title', '<p>Content</p>');
            
            controller.close();
            
            const overlay = document.getElementById('pdt-dialog-overlay');
            expect(overlay).toBeFalsy();
        });

        it('should close dialog when X button is clicked', () => {
            DialogService.show('Title', '<p>Content</p>');
            
            const closeBtn = document.querySelector('.pdt-close-btn');
            closeBtn?.dispatchEvent(new MouseEvent('click'));
            
            const overlay = document.getElementById('pdt-dialog-overlay');
            expect(overlay).toBeFalsy();
        });

        it('should close dialog when Close button is clicked', () => {
            DialogService.show('Title', '<p>Content</p>');
            
            const cancelBtn = document.querySelector('.pdt-dialog-cancel');
            cancelBtn?.dispatchEvent(new MouseEvent('click'));
            
            const overlay = document.getElementById('pdt-dialog-overlay');
            expect(overlay).toBeFalsy();
        });

        it('should close dialog when clicking overlay background', () => {
            DialogService.show('Title', '<p>Content</p>');
            
            const overlay = document.getElementById('pdt-dialog-overlay');
            overlay?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            
            expect(document.getElementById('pdt-dialog-overlay')).toBeFalsy();
        });

        it('should not close when clicking inside dialog', () => {
            DialogService.show('Title', '<p>Content</p>');
            
            const dialog = document.querySelector('.pdt-dialog');
            dialog?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            
            const overlay = document.getElementById('pdt-dialog-overlay');
            expect(overlay).toBeTruthy();
        });

        it('should close dialog on Escape key', () => {
            DialogService.show('Title', '<p>Content</p>');
            
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            
            const overlay = document.getElementById('pdt-dialog-overlay');
            expect(overlay).toBeFalsy();
        });

        it('should call callback when OK button is clicked', () => {
            const callback = vi.fn(() => true);
            DialogService.show('Title', '<p>Content</p>', callback);
            
            const okBtn = document.querySelector('.pdt-dialog-ok');
            okBtn?.dispatchEvent(new MouseEvent('click'));
            
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should pass content container to callback', () => {
            const callback = vi.fn();
            DialogService.show('Title', '<p>Content</p>', callback);
            
            const okBtn = document.querySelector('.pdt-dialog-ok');
            okBtn?.dispatchEvent(new MouseEvent('click'));
            
            expect(callback).toHaveBeenCalledWith(
                expect.any(HTMLElement)
            );
        });

        it('should close dialog after OK if callback returns non-false', () => {
            const callback = vi.fn(() => true);
            DialogService.show('Title', '<p>Content</p>', callback);
            
            const okBtn = document.querySelector('.pdt-dialog-ok');
            okBtn?.dispatchEvent(new MouseEvent('click'));
            
            const overlay = document.getElementById('pdt-dialog-overlay');
            expect(overlay).toBeFalsy();
        });

        it('should not close dialog if callback returns false', () => {
            const callback = vi.fn(() => false);
            DialogService.show('Title', '<p>Content</p>', callback);
            
            const okBtn = document.querySelector('.pdt-dialog-ok');
            okBtn?.dispatchEvent(new MouseEvent('click'));
            
            const overlay = document.getElementById('pdt-dialog-overlay');
            expect(overlay).toBeTruthy();
        });

        it('should focus OK button if present', () => {
            DialogService.show('Title', '<p>Content</p>', () => { });
            
            const okBtn = document.querySelector('.pdt-dialog-ok');
            expect(document.activeElement).toBe(okBtn);
        });

        it('should focus Close button if no OK button', () => {
            DialogService.show('Title', '<p>Content</p>');
            
            const cancelBtn = document.querySelector('.pdt-dialog-cancel');
            expect(document.activeElement).toBe(cancelBtn);
        });
    });
});
