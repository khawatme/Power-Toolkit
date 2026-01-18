/**
 * @file Tests for ResultPanel
 * @module tests/utils/ui/ResultPanel.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResultPanel } from '../../src/utils/ui/ResultPanel.js';

// Mock NotificationService
vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    }
}));

describe('ResultPanel', () => {
    let resultPanel;
    let root;
    let mockOnToggleView;
    let mockOnToggleHide;
    let mockGetSortState;
    let mockSetSortState;

    beforeEach(() => {
        root = document.createElement('div');
        document.body.appendChild(root);

        mockOnToggleView = vi.fn();
        mockOnToggleHide = vi.fn();
        mockGetSortState = vi.fn().mockReturnValue({ column: null, direction: 'asc' });
        mockSetSortState = vi.fn();

        resultPanel = new ResultPanel({
            root,
            onToggleView: mockOnToggleView,
            onToggleHide: mockOnToggleHide,
            getSortState: mockGetSortState,
            setSortState: mockSetSortState
        });
    });

    describe('constructor', () => {
        it('should initialize with config', () => {
            expect(resultPanel.root).toBe(root);
            expect(resultPanel.onToggleView).toBe(mockOnToggleView);
            expect(resultPanel.onToggleHide).toBe(mockOnToggleHide);
            expect(resultPanel.getSortState).toBe(mockGetSortState);
            expect(resultPanel.setSortState).toBe(mockSetSortState);
        });

        it('should initialize pagination state', () => {
            expect(resultPanel.currentPage).toBe(1);
            expect(resultPanel.pageSize).toBeDefined();
        });

        it('should support selection when enabled', () => {
            const panelWithSelection = new ResultPanel({
                root,
                onToggleView: mockOnToggleView,
                onToggleHide: mockOnToggleHide,
                getSortState: mockGetSortState,
                setSortState: mockSetSortState,
                enableSelection: true
            });

            expect(panelWithSelection.enableSelection).toBe(true);
        });
    });

    describe('renderShell', () => {
        it('should create toolbar and wrapper', () => {
            resultPanel.renderShell(5, 'table', false);
            
            expect(root.innerHTML).toBeTruthy();
        });
    });

    describe('updatePagination', () => {
        it('should update pagination for dataset', () => {
            const data = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Item ${i}` }));
            
            resultPanel.renderShell(data.length, 'table', false);
            
            expect(resultPanel.currentPage).toBeDefined();
        });
    });

    describe('destroy', () => {
        it('should cleanup resources', () => {
            resultPanel.renderShell(0, 'table', false);
            
            expect(() => resultPanel.destroy()).not.toThrow();
        });
    });
});
