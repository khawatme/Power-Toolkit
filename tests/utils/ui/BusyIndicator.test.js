/**
 * @file Comprehensive tests for BusyIndicator utility
 * @module tests/utils/ui/BusyIndicator.test.js
 * @description Tests for UI busy state management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BusyIndicator } from '../../../src/utils/ui/BusyIndicator.js';

vi.mock('../../../src/constants/index.js', () => ({
    Config: {
        MESSAGES: {
            UI: {
                loading: 'Loading...',
                resultLoading: 'Loading Results',
                pleaseWait: 'Please wait...',
                execute: 'Execute'
            }
        }
    }
}));

describe('BusyIndicator', () => {
    let executeBtn;
    let resultRoot;

    beforeEach(() => {
        // Create mock elements
        executeBtn = document.createElement('button');
        executeBtn.textContent = 'Execute';
        executeBtn.disabled = false;

        resultRoot = document.createElement('div');
        resultRoot.id = 'result-root';

        document.body.appendChild(executeBtn);
        document.body.appendChild(resultRoot);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('set', () => {
        it('should disable the execute button', () => {
            BusyIndicator.set(executeBtn, resultRoot);
            expect(executeBtn.disabled).toBe(true);
        });

        it('should update button text to loading message', () => {
            BusyIndicator.set(executeBtn, resultRoot);
            expect(executeBtn.textContent).toBe('Loading...');
        });

        it('should use custom label when provided', () => {
            BusyIndicator.set(executeBtn, resultRoot, 'Custom Loading...');
            expect(executeBtn.textContent).toBe('Custom Loading...');
        });

        it('should update result root with loading indicator', () => {
            BusyIndicator.set(executeBtn, resultRoot);
            expect(resultRoot.innerHTML).toContain('Loading Results');
            expect(resultRoot.innerHTML).toContain('Please wait...');
        });

        it('should set aria-busy attribute on table wrapper', () => {
            BusyIndicator.set(executeBtn, resultRoot);
            const wrapper = resultRoot.querySelector('[aria-busy="true"]');
            expect(wrapper).toBeTruthy();
        });

        it('should not throw when executeBtn is null', () => {
            expect(() => BusyIndicator.set(null, resultRoot)).not.toThrow();
        });

        it('should not throw when resultRoot is null', () => {
            expect(() => BusyIndicator.set(executeBtn, null)).not.toThrow();
        });

        it('should not throw when both arguments are null', () => {
            expect(() => BusyIndicator.set(null, null)).not.toThrow();
        });

        it('should only update button when resultRoot is null', () => {
            BusyIndicator.set(executeBtn, null);
            expect(executeBtn.disabled).toBe(true);
            expect(executeBtn.textContent).toBe('Loading...');
        });

        it('should only update resultRoot when executeBtn is null', () => {
            BusyIndicator.set(null, resultRoot);
            expect(resultRoot.innerHTML).toContain('Please wait...');
        });

        it('should render loading structure with toolbar', () => {
            BusyIndicator.set(executeBtn, resultRoot);
            const toolbar = resultRoot.querySelector('.pdt-toolbar');
            expect(toolbar).toBeTruthy();
        });

        it('should render section title in loading state', () => {
            BusyIndicator.set(executeBtn, resultRoot);
            const title = resultRoot.querySelector('.section-title');
            expect(title).toBeTruthy();
        });

        it('should render pdt-note message in loading state', () => {
            BusyIndicator.set(executeBtn, resultRoot);
            const note = resultRoot.querySelector('.pdt-note');
            expect(note).toBeTruthy();
        });

        it('should render pdt-table-wrapper for loading content', () => {
            BusyIndicator.set(executeBtn, resultRoot);
            const wrapper = resultRoot.querySelector('.pdt-table-wrapper');
            expect(wrapper).toBeTruthy();
        });
    });

    describe('clear', () => {
        it('should enable the execute button', () => {
            executeBtn.disabled = true;
            BusyIndicator.clear(executeBtn);
            expect(executeBtn.disabled).toBe(false);
        });

        it('should restore button text to Execute', () => {
            executeBtn.textContent = 'Loading...';
            BusyIndicator.clear(executeBtn);
            expect(executeBtn.textContent).toBe('Execute');
        });

        it('should not throw when executeBtn is null', () => {
            expect(() => BusyIndicator.clear(null)).not.toThrow();
        });

        it('should not throw when executeBtn is undefined', () => {
            expect(() => BusyIndicator.clear(undefined)).not.toThrow();
        });

        it('should restore button after set was called', () => {
            BusyIndicator.set(executeBtn, resultRoot);
            expect(executeBtn.disabled).toBe(true);

            BusyIndicator.clear(executeBtn);
            expect(executeBtn.disabled).toBe(false);
            expect(executeBtn.textContent).toBe('Execute');
        });
    });

    describe('full workflow', () => {
        it('should toggle button state correctly', () => {
            // Initial state
            expect(executeBtn.disabled).toBe(false);
            expect(executeBtn.textContent).toBe('Execute');

            // Set busy
            BusyIndicator.set(executeBtn, resultRoot);
            expect(executeBtn.disabled).toBe(true);
            expect(executeBtn.textContent).toBe('Loading...');

            // Clear busy
            BusyIndicator.clear(executeBtn);
            expect(executeBtn.disabled).toBe(false);
            expect(executeBtn.textContent).toBe('Execute');
        });

        it('should handle multiple set calls', () => {
            BusyIndicator.set(executeBtn, resultRoot);
            BusyIndicator.set(executeBtn, resultRoot, 'Second call');

            expect(executeBtn.disabled).toBe(true);
            expect(executeBtn.textContent).toBe('Second call');
        });

        it('should handle multiple clear calls', () => {
            BusyIndicator.set(executeBtn, resultRoot);
            BusyIndicator.clear(executeBtn);
            BusyIndicator.clear(executeBtn);

            expect(executeBtn.disabled).toBe(false);
            expect(executeBtn.textContent).toBe('Execute');
        });

        it('should handle clear without set', () => {
            // Clear without ever setting busy
            expect(() => BusyIndicator.clear(executeBtn)).not.toThrow();
            expect(executeBtn.disabled).toBe(false);
        });
    });
});
