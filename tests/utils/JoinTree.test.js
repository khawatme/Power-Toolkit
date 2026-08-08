/**
 * @file Tests for JoinTree
 * @module tests/utils/JoinTree.test.js
 * @description Parent/child traversal for FetchXML join groups, including the cyclic and
 * malformed shapes the user-editable parent selects make reachable.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JoinTree, PRIMARY_PARENT, JOIN_GROUP_SELECTOR } from '../../src/utils/JoinTree.js';

describe('JoinTree', () => {
    let container;

    /**
     * Adds a join group whose parent select holds the given value.
     * @param {string} joinId - The join id
     * @param {string} parentValue - Parent id, PRIMARY_PARENT, or '' for unset
     * @returns {HTMLElement} The created group
     */
    const addGroup = (joinId, parentValue = PRIMARY_PARENT) => {
        const group = document.createElement('div');
        group.className = 'pdt-form-grid link-entity-group';
        group.dataset.joinId = joinId;

        const select = document.createElement('select');
        select.setAttribute('data-prop', 'parent');
        // A select only accepts values it actually offers.
        [PRIMARY_PARENT, parentValue, ''].forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            select.appendChild(option);
        });
        select.value = parentValue;

        group.appendChild(select);
        container.appendChild(group);
        return group;
    };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
        container = null;
    });

    describe('getGroups', () => {
        it('should list groups in document order', () => {
            addGroup('join_1');
            addGroup('join_2');

            expect(JoinTree.getGroups(container).map(g => g.dataset.joinId))
                .toEqual(['join_1', 'join_2']);
        });

        it('should return an empty array for a null container', () => {
            expect(JoinTree.getGroups(null)).toEqual([]);
        });

        it('should match the exported selector', () => {
            const group = addGroup('join_1');
            expect(group.matches(JOIN_GROUP_SELECTOR)).toBe(true);
        });
    });

    describe('findGroup', () => {
        it('should find a group by id', () => {
            addGroup('join_1');
            expect(JoinTree.findGroup(container, 'join_1').dataset.joinId).toBe('join_1');
        });

        it('should return null for an unknown id', () => {
            expect(JoinTree.findGroup(container, 'join_9')).toBeNull();
        });

        it('should return null for missing arguments', () => {
            expect(JoinTree.findGroup(null, 'join_1')).toBeNull();
            expect(JoinTree.findGroup(container, '')).toBeNull();
        });
    });

    describe('getParentId', () => {
        it('should read the selected parent', () => {
            expect(JoinTree.getParentId(addGroup('join_1', PRIMARY_PARENT))).toBe(PRIMARY_PARENT);
        });

        it('should return an empty string when unset', () => {
            expect(JoinTree.getParentId(addGroup('join_1', ''))).toBe('');
        });

        it('should return an empty string when there is no parent select', () => {
            const bare = document.createElement('div');
            expect(JoinTree.getParentId(bare)).toBe('');
            expect(JoinTree.getParentId(null)).toBe('');
        });
    });

    describe('depthOf', () => {
        it('should report 0 for a join off the primary entity', () => {
            expect(JoinTree.depthOf(container, addGroup('join_1'))).toBe(0);
        });

        it('should report 0 for an unset parent', () => {
            expect(JoinTree.depthOf(container, addGroup('join_1', ''))).toBe(0);
        });

        it('should count each level of nesting', () => {
            addGroup('join_1', PRIMARY_PARENT);
            addGroup('join_2', 'join_1');
            const third = addGroup('join_3', 'join_2');

            expect(JoinTree.depthOf(container, third)).toBe(2);
        });

        it('should follow a reparented ancestor without stale values', () => {
            const first = addGroup('join_1', PRIMARY_PARENT);
            const second = addGroup('join_2', 'join_1');
            const third = addGroup('join_3', 'join_2');
            expect(JoinTree.depthOf(container, third)).toBe(2);

            // Detach the middle join from the chain.
            second.querySelector('[data-prop="parent"]').value = PRIMARY_PARENT;

            expect(JoinTree.depthOf(container, second)).toBe(0);
            expect(JoinTree.depthOf(container, third)).toBe(1);
            expect(JoinTree.depthOf(container, first)).toBe(0);
        });

        it('should not count a parent that no longer exists', () => {
            const orphan = addGroup('join_2', 'join_1');
            expect(JoinTree.depthOf(container, orphan)).toBe(0);
        });

        it('should terminate on a two-node cycle', () => {
            const first = addGroup('join_1', 'join_2');
            const second = addGroup('join_2', 'join_1');

            expect(() => JoinTree.depthOf(container, first)).not.toThrow();
            expect(JoinTree.depthOf(container, second)).toBeGreaterThanOrEqual(0);
        });

        it('should terminate on a self-referencing join', () => {
            const group = addGroup('join_1', 'join_1');
            expect(() => JoinTree.depthOf(container, group)).not.toThrow();
        });
    });

    describe('isDescendant', () => {
        it('should detect a direct child', () => {
            const parent = addGroup('join_1');
            const child = addGroup('join_2', 'join_1');

            expect(JoinTree.isDescendant(container, child, parent)).toBe(true);
        });

        it('should detect a grandchild', () => {
            const parent = addGroup('join_1');
            addGroup('join_2', 'join_1');
            const grandchild = addGroup('join_3', 'join_2');

            expect(JoinTree.isDescendant(container, grandchild, parent)).toBe(true);
        });

        it('should not treat a sibling as a descendant', () => {
            const first = addGroup('join_1');
            const second = addGroup('join_2');

            expect(JoinTree.isDescendant(container, second, first)).toBe(false);
        });

        it('should not treat an ancestor as its own descendant', () => {
            const parent = addGroup('join_1');
            const child = addGroup('join_2', 'join_1');

            expect(JoinTree.isDescendant(container, parent, child)).toBe(false);
        });

        it('should return false for missing arguments', () => {
            const group = addGroup('join_1');
            expect(JoinTree.isDescendant(container, group, null)).toBe(false);
            expect(JoinTree.isDescendant(container, null, group)).toBe(false);
        });

        it('should terminate on a cycle', () => {
            const first = addGroup('join_1', 'join_2');
            const second = addGroup('join_2', 'join_1');

            expect(() => JoinTree.isDescendant(container, first, second)).not.toThrow();
        });
    });

    describe('reachesPrimary', () => {
        it('should accept a join parented to the primary entity', () => {
            expect(JoinTree.reachesPrimary(container, addGroup('join_1'))).toBe(true);
        });

        it('should accept a deep chain ending at the primary entity', () => {
            addGroup('join_1', PRIMARY_PARENT);
            addGroup('join_2', 'join_1');
            const third = addGroup('join_3', 'join_2');

            expect(JoinTree.reachesPrimary(container, third)).toBe(true);
        });

        it('should reject an unset parent', () => {
            expect(JoinTree.reachesPrimary(container, addGroup('join_1', ''))).toBe(false);
        });

        it('should reject a chain that dead-ends on a missing parent', () => {
            const orphan = addGroup('join_2', 'join_1');
            expect(JoinTree.reachesPrimary(container, orphan)).toBe(false);
        });

        it('should reject both halves of a cycle', () => {
            const first = addGroup('join_1', 'join_2');
            const second = addGroup('join_2', 'join_1');

            expect(JoinTree.reachesPrimary(container, first)).toBe(false);
            expect(JoinTree.reachesPrimary(container, second)).toBe(false);
        });

        it('should reject a chain that reaches a cycle', () => {
            addGroup('join_1', 'join_2');
            addGroup('join_2', 'join_1');
            const third = addGroup('join_3', 'join_1');

            expect(JoinTree.reachesPrimary(container, third)).toBe(false);
        });
    });

    describe('eligibleParents', () => {
        it('should offer other joins to a new group', () => {
            addGroup('join_1');
            addGroup('join_2');

            expect(JoinTree.eligibleParents(container, null).map(g => g.dataset.joinId))
                .toEqual(['join_1', 'join_2']);
        });

        it('should exclude the group itself', () => {
            const first = addGroup('join_1');
            addGroup('join_2');

            expect(JoinTree.eligibleParents(container, first).map(g => g.dataset.joinId))
                .toEqual(['join_2']);
        });

        it('should exclude descendants so no cycle can be chosen', () => {
            const first = addGroup('join_1');
            addGroup('join_2', 'join_1');
            addGroup('join_3', 'join_2');

            expect(JoinTree.eligibleParents(container, first)).toEqual([]);
        });

        it('should still offer an unrelated join', () => {
            const first = addGroup('join_1');
            addGroup('join_2', 'join_1');
            addGroup('join_3', PRIMARY_PARENT);

            expect(JoinTree.eligibleParents(container, first).map(g => g.dataset.joinId))
                .toEqual(['join_3']);
        });

        it('should skip groups with no join id', () => {
            addGroup('join_1');
            const idless = document.createElement('div');
            idless.className = 'link-entity-group';
            container.appendChild(idless);

            expect(JoinTree.eligibleParents(container, null).map(g => g.dataset.joinId))
                .toEqual(['join_1']);
        });

        it('should return an empty array when there are no joins', () => {
            expect(JoinTree.eligibleParents(container, null)).toEqual([]);
        });
    });

    describe('ancestorIds', () => {
        it('should yield ancestors nearest first', () => {
            addGroup('join_1', PRIMARY_PARENT);
            addGroup('join_2', 'join_1');
            const third = addGroup('join_3', 'join_2');

            expect([...JoinTree.ancestorIds(container, third)]).toEqual(['join_2', 'join_1']);
        });

        it('should yield nothing for a join off the primary entity', () => {
            expect([...JoinTree.ancestorIds(container, addGroup('join_1'))]).toEqual([]);
        });

        it('should stop rather than repeat a cycle', () => {
            addGroup('join_1', 'join_2');
            const second = addGroup('join_2', 'join_1');

            const ids = [...JoinTree.ancestorIds(container, second)];
            expect(ids).toEqual(['join_1', 'join_2']);
            expect(new Set(ids).size).toBe(ids.length);
        });
    });
});
