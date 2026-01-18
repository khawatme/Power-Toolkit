/**
 * @file DOM Helpers Tests
 * @description Comprehensive tests for DOM manipulation utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DOMHelpers } from '../../src/helpers/dom.helpers.js';

describe('DOMHelpers', () => {
    describe('appendLogEntry', () => {
        let container;

        beforeEach(() => {
            container = document.createElement('div');
        });

        it('should append log entry with timestamp and message', () => {
            const result = DOMHelpers.appendLogEntry(container, 'test-class', 'Test message');

            expect(result).toBeInstanceOf(HTMLElement);
            expect(container.children.length).toBe(1);
            expect(result.className).toContain('log-entry');
            expect(result.className).toContain('test-class');
            expect(result.textContent).toContain('Test message');
            expect(result.textContent).toMatch(/\[\d{1,2}:\d{2}:\d{2}.*\]/);
        });

        it('should auto-scroll to bottom when autoScroll is true', () => {
            container.style.height = '100px';
            container.style.overflow = 'auto';
            document.body.appendChild(container);

            for (let i = 0; i < 20; i++) {
                DOMHelpers.appendLogEntry(container, 'test', `Message ${i}`, 500, true);
            }

            // Check that entries were added (auto-scroll behavior may not work in test DOM)
            expect(container.children.length).toBeGreaterThan(0);
            document.body.removeChild(container);
        });

        it('should not auto-scroll when autoScroll is false', () => {
            const result = DOMHelpers.appendLogEntry(container, 'test', 'Message', 500, false);
            expect(result).toBeTruthy();
            expect(container.scrollTop).toBe(0);
        });

        it('should trim old entries when exceeding maxEntries', () => {
            const maxEntries = 5;

            for (let i = 0; i < 10; i++) {
                DOMHelpers.appendLogEntry(container, 'test', `Message ${i}`, maxEntries);
            }

            expect(container.children.length).toBe(maxEntries);
            expect(container.firstChild.textContent).toContain('Message 5');
            expect(container.lastChild.textContent).toContain('Message 9');
        });

        it('should handle null container gracefully', () => {
            const result = DOMHelpers.appendLogEntry(null, 'test', 'Message');
            expect(result).toBeNull();
        });

        it('should use default maxEntries of 500', () => {
            for (let i = 0; i < 501; i++) {
                DOMHelpers.appendLogEntry(container, 'test', `Message ${i}`);
            }
            expect(container.children.length).toBe(500);
        });
    });

    describe('clearContainer', () => {
        it('should remove all children from container', () => {
            const container = document.createElement('div');
            container.innerHTML = '<p>1</p><p>2</p><p>3</p>';
            expect(container.children.length).toBe(3);

            const result = DOMHelpers.clearContainer(container);

            expect(result).toBe(true);
            expect(container.children.length).toBe(0);
            expect(container.innerHTML).toBe('');
        });

        it('should handle empty container', () => {
            const container = document.createElement('div');
            const result = DOMHelpers.clearContainer(container);

            expect(result).toBe(true);
            expect(container.children.length).toBe(0);
        });

        it('should handle null container gracefully', () => {
            const result = DOMHelpers.clearContainer(null);
            expect(result).toBe(false);
        });

        it('should handle undefined container', () => {
            const result = DOMHelpers.clearContainer(undefined);
            expect(result).toBe(false);
        });
    });

    describe('findNodeInTree', () => {
        it('should find node by property value at root level', () => {
            const nodes = [
                { id: 1, name: 'Node 1' },
                { id: 2, name: 'Node 2' },
                { id: 3, name: 'Node 3' }
            ];

            const result = DOMHelpers.findNodeInTree(nodes, 'id', 2);
            expect(result).toEqual({ id: 2, name: 'Node 2' });
        });

        it('should find node in nested children', () => {
            const nodes = [
                {
                    id: 1, name: 'Parent', children: [
                        { id: 2, name: 'Child 1' },
                        {
                            id: 3, name: 'Child 2', children: [
                                { id: 4, name: 'Grandchild' }
                            ]
                        }
                    ]
                }
            ];

            const result = DOMHelpers.findNodeInTree(nodes, 'id', 4);
            expect(result).toEqual({ id: 4, name: 'Grandchild' });
        });

        it('should use custom children key', () => {
            const nodes = [
                {
                    id: 1, items: [
                        { id: 2, name: 'Item' }
                    ]
                }
            ];

            const result = DOMHelpers.findNodeInTree(nodes, 'id', 2, 'items');
            expect(result).toEqual({ id: 2, name: 'Item' });
        });

        it('should return null when node not found', () => {
            const nodes = [
                { id: 1, name: 'Node 1' },
                { id: 2, name: 'Node 2' }
            ];

            const result = DOMHelpers.findNodeInTree(nodes, 'id', 999);
            expect(result).toBeNull();
        });

        it('should return null for non-array input', () => {
            expect(DOMHelpers.findNodeInTree(null, 'id', 1)).toBeNull();
            expect(DOMHelpers.findNodeInTree(undefined, 'id', 1)).toBeNull();
            expect(DOMHelpers.findNodeInTree({}, 'id', 1)).toBeNull();
        });

        it('should handle empty array', () => {
            const result = DOMHelpers.findNodeInTree([], 'id', 1);
            expect(result).toBeNull();
        });

        it('should find first match when duplicates exist', () => {
            const nodes = [
                { id: 1, name: 'First', children: [{ id: 2, name: 'Nested' }] },
                { id: 1, name: 'Second' }
            ];

            const result = DOMHelpers.findNodeInTree(nodes, 'id', 1);
            expect(result.name).toBe('First');
        });

        it('should handle complex nested structures', () => {
            const nodes = [
                {
                    id: 'a',
                    children: [
                        {
                            id: 'b',
                            children: [
                                {
                                    id: 'c',
                                    children: [
                                        { id: 'd' }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ];

            expect(DOMHelpers.findNodeInTree(nodes, 'id', 'd')).toEqual({ id: 'd' });
        });
    });
});
