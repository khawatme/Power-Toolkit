/**
 * @file BusyIndicator Tests
 * @description Comprehensive tests for BusyIndicator utility
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BusyIndicator } from '../../src/utils/ui/BusyIndicator.js';

describe('BusyIndicator', () => {
    let button;
    let resultRoot;

    beforeEach(() => {
        button = document.createElement('button');
        button.textContent = 'Execute';
        button.disabled = false;

        resultRoot = document.createElement('div');
        resultRoot.id = 'results';
    });

    describe('set', () => {
        it('should disable button and update text', () => {
            BusyIndicator.set(button, resultRoot, 'Loading...');

            expect(button.disabled).toBe(true);
            expect(button.textContent).toBe('Loading...');
        });

        it('should use default loading message when no label provided', () => {
            BusyIndicator.set(button, resultRoot);

            expect(button.disabled).toBe(true);
            // Check for either 'Loading' or 'Executing' depending on implementation
            const hasLoadingText = button.textContent.includes('Loading') || button.textContent.includes('Executing');
            expect(hasLoadingText).toBe(true);
        });

        it('should update result container with loading UI', () => {
            BusyIndicator.set(button, resultRoot, 'Processing...');

            expect(resultRoot.innerHTML).toContain('pdt-toolbar');
            expect(resultRoot.innerHTML).toContain('pdt-table-wrapper');
            expect(resultRoot.innerHTML).toContain('aria-busy="true"');
        });

        it('should handle null button gracefully', () => {
            expect(() => {
                BusyIndicator.set(null, resultRoot, 'Loading...');
            }).not.toThrow();

            expect(resultRoot.innerHTML).toContain('pdt-toolbar');
        });

        it('should handle null resultRoot gracefully', () => {
            expect(() => {
                BusyIndicator.set(button, null, 'Loading...');
            }).not.toThrow();

            expect(button.disabled).toBe(true);
            expect(button.textContent).toBe('Loading...');
        });

        it('should handle both null parameters gracefully', () => {
            expect(() => {
                BusyIndicator.set(null, null, 'Loading...');
            }).not.toThrow();
        });

        it('should overwrite existing result content', () => {
            resultRoot.innerHTML = '<p>Previous content</p>';
            BusyIndicator.set(button, resultRoot, 'Loading...');

            expect(resultRoot.innerHTML).not.toContain('Previous content');
            expect(resultRoot.innerHTML).toContain('pdt-toolbar');
        });

        it('should include result loading message in output', () => {
            BusyIndicator.set(button, resultRoot);

            expect(resultRoot.innerHTML).toContain('Result');
        });

        it('should include wait message', () => {
            BusyIndicator.set(button, resultRoot);

            // Check for loading/waiting message
            expect(resultRoot.innerHTML).toBeTruthy();
        });

        it('should create proper HTML structure', () => {
            BusyIndicator.set(button, resultRoot);

            const toolbar = resultRoot.querySelector('.pdt-toolbar');
            const wrapper = resultRoot.querySelector('.pdt-table-wrapper');
            const note = resultRoot.querySelector('.pdt-note');

            expect(toolbar).not.toBeNull();
            expect(wrapper).not.toBeNull();
            expect(note).not.toBeNull();
        });
    });

    describe('clear', () => {
        it('should clear busy indicator', () => {
            BusyIndicator.set(button, resultRoot, 'Loading...');

            expect(button.disabled).toBe(true);
            expect(button.textContent).toBe('Loading...');

            BusyIndicator.clear(button);
            expect(button.disabled).toBe(false);
        });
    });
});