/**
 * @file Tests for ComponentRegistry
 * @module tests/core/ComponentRegistry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentRegistry } from '../../src/core/ComponentRegistry.js';
import { NotificationService } from '../../src/services/NotificationService.js';
import { BaseComponent } from '../../src/core/BaseComponent.js';

vi.mock('../../../src/services/NotificationService.js');

class TestComponent extends BaseComponent {
    constructor(id, label) {
        super(id, label, '<svg></svg>', false);
    }

    async render() {
        return document.createElement('div');
    }
}

describe('ComponentRegistry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('register', () => {
        it('should register a valid component', () => {
            const component = new TestComponent('test1', 'Test 1');

            ComponentRegistry.register(component);

            expect(ComponentRegistry.has('test1')).toBe(true);
            expect(ComponentRegistry.get('test1')).toBe(component);
        });

        it('should register components with same prefix but different ids', () => {
            const comp1 = new TestComponent('test1', 'Test 1');
            const comp2 = new TestComponent('test2', 'Test 2');

            ComponentRegistry.register(comp1);
            ComponentRegistry.register(comp2);

            expect(ComponentRegistry.has('test1')).toBe(true);
            expect(ComponentRegistry.has('test2')).toBe(true);
        });

        it('should handle duplicate registration gracefully', () => {
            const comp1 = new TestComponent('duplicate', 'First');
            const comp2 = new TestComponent('duplicate', 'Second');

            ComponentRegistry.register(comp1);
            ComponentRegistry.register(comp2);

            // Second registration replaces first (after showing warning)
            const retrieved = ComponentRegistry.get('duplicate');
            expect(retrieved.id).toBe('duplicate');
            expect(retrieved.label).toBe('Second'); // Second component replaced the first
        });

        it('should handle invalid component without id', () => {
            const invalidComponent = { label: 'Invalid', icon: 'icon' };

            ComponentRegistry.register(invalidComponent);

            // Invalid component is not registered
            expect(ComponentRegistry.get(undefined)).toBeUndefined();
        });

        describe('get', () => {
            it('should retrieve registered component by ID', () => {
                const component = new TestComponent('test', 'Test');
                ComponentRegistry.register(component);

                const retrieved = ComponentRegistry.get('test');

                expect(retrieved).toBe(component);
            });

            it('should return undefined for non-existent component', () => {
                const retrieved = ComponentRegistry.get('nonexistent');

                expect(retrieved).toBeUndefined();
            });
        });

        describe('has', () => {
            it('should return true for registered component', () => {
                const component = new TestComponent('exists', 'Exists');
                ComponentRegistry.register(component);

                expect(ComponentRegistry.has('exists')).toBe(true);
            });

            it('should return false for non-existent component', () => {
                expect(ComponentRegistry.has('notfound')).toBe(false);
            });
        });

        describe('getAll', () => {
            it('should return all registered components', () => {
                const comp1 = new TestComponent('one', 'One');
                const comp2 = new TestComponent('two', 'Two');

                ComponentRegistry.register(comp1);
                ComponentRegistry.register(comp2);

                const all = ComponentRegistry.getAll();

                expect(all.length).toBeGreaterThanOrEqual(2);
                expect(Array.isArray(all)).toBe(true);
            });
        });
    });
});