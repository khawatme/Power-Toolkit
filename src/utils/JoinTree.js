/**
 * @file JoinTree - Parent/child traversal for FetchXML join groups.
 * @module utils/JoinTree
 * @description The FetchXML Builder renders each join as a `.link-entity-group` element whose
 * parent is recorded in a `[data-prop="parent"]` select. That makes the joins a tree stored
 * entirely in the DOM, and every traversal of it has to tolerate a cycle: the parent selects
 * are user-editable, so nothing structurally prevents one.
 *
 * These helpers are read-only. Callers own presentation (indentation, dropdown labels) and
 * validation messages.
 */

/** Parent value meaning "hangs directly off the primary entity". */
export const PRIMARY_PARENT = 'primary';

/** Selector for a join group element. */
export const JOIN_GROUP_SELECTOR = '.link-entity-group';

/** @private Selector for the parent select inside a join group. */
const PARENT_SELECT_SELECTOR = '[data-prop="parent"]';

export const JoinTree = {
    /**
     * Lists every join group in document order.
     * @param {HTMLElement|null} container - The joins container
     * @returns {HTMLElement[]} Join group elements
     */
    getGroups(container) {
        return [...(container?.querySelectorAll(JOIN_GROUP_SELECTOR) || [])];
    },

    /**
     * Finds a join group by its id.
     * @param {HTMLElement|null} container - The joins container
     * @param {string} joinId - The join id to look for
     * @returns {HTMLElement|null} The matching group, or null
     */
    findGroup(container, joinId) {
        if (!container || !joinId) {
            return null;
        }
        // Ids are generated internally ("join_1"), so they need no escaping.
        return container.querySelector(`[data-join-id="${joinId}"]`);
    },

    /**
     * Reads the parent id recorded on a join group.
     * @param {HTMLElement|null} group - A join group element
     * @returns {string} The parent id, PRIMARY_PARENT, or '' when unset
     */
    getParentId(group) {
        return group?.querySelector(PARENT_SELECT_SELECTOR)?.value || '';
    },

    /**
     * Walks from a group towards the primary entity, yielding each ancestor id.
     *
     * Stops at the primary entity, at an unset parent, or on revisiting an id, so a cycle
     * terminates instead of looping forever.
     * @param {HTMLElement|null} container - The joins container
     * @param {HTMLElement|null} group - The group to walk up from
     * @yields {string} Ancestor parent ids, nearest first
     */
    *ancestorIds(container, group) {
        let current = group;
        const visited = new Set();

        while (current) {
            const parentId = this.getParentId(current);
            if (!parentId || parentId === PRIMARY_PARENT || visited.has(parentId)) {
                return;
            }
            visited.add(parentId);
            yield parentId;
            current = this.findGroup(container, parentId);
        }
    },

    /**
     * Reports whether one join sits beneath another in the parent chain.
     * @param {HTMLElement|null} container - The joins container
     * @param {HTMLElement|null} candidate - The group being tested
     * @param {HTMLElement|null} ancestor - The group that may be above it
     * @returns {boolean} True when candidate descends from ancestor
     */
    isDescendant(container, candidate, ancestor) {
        const ancestorId = ancestor?.dataset?.joinId;
        if (!ancestorId || !candidate) {
            return false;
        }

        for (const parentId of this.ancestorIds(container, candidate)) {
            if (parentId === ancestorId) {
                return true;
            }
        }
        return false;
    },

    /**
     * Counts how deeply a join is nested.
     *
     * Derived by walking the chain rather than read from a cached value, so it stays correct
     * when an ancestor is reparented.
     * @param {HTMLElement|null} container - The joins container
     * @param {HTMLElement|null} group - The group to measure
     * @returns {number} 0 for a join hanging off the primary entity
     */
    depthOf(container, group) {
        let depth = 0;
        for (const parentId of this.ancestorIds(container, group)) {
            if (this.findGroup(container, parentId)) {
                depth++;
            }
        }
        return depth;
    },

    /**
     * Reports whether a join's parent chain terminates at the primary entity.
     *
     * A join that does not is unreachable when the XML is built from the primary entity down,
     * and would be omitted from the output without any error.
     * @param {HTMLElement|null} container - The joins container
     * @param {HTMLElement|null} group - The group to check
     * @returns {boolean} True when the join is reachable from the primary entity
     */
    reachesPrimary(container, group) {
        let current = group;
        const visited = new Set();

        while (current) {
            const parentId = this.getParentId(current);
            if (parentId === PRIMARY_PARENT) {
                return true;
            }
            if (!parentId || visited.has(parentId)) {
                return false;
            }
            visited.add(parentId);
            current = this.findGroup(container, parentId);
        }

        return false;
    },

    /**
     * Lists the groups that may legally parent the given one.
     *
     * Excludes the group itself and everything beneath it, which is what stops a cycle from
     * being created through the UI.
     * @param {HTMLElement|null} container - The joins container
     * @param {HTMLElement|null} group - The group needing a parent, or null for a new one
     * @returns {HTMLElement[]} Groups eligible to be its parent
     */
    eligibleParents(container, group) {
        return this.getGroups(container).filter(candidate => {
            if (!candidate.dataset.joinId || candidate === group) {
                return false;
            }
            return !this.isDescendant(container, candidate, group);
        });
    }
};
