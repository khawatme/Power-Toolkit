/**
 * @file ODataQueryBuilder
 * @description Build OData query strings from high-level parameters
 * @module utils/builders/ODataQueryBuilder
 */

import { isValidGuid } from '../../helpers/index.js';

/**
 * ODataQueryBuilder class for constructing OData query strings.
 * @class ODataQueryBuilder
 */
export class ODataQueryBuilder {
    /**
     * Builds an OData query string from high-level parameters.
     * Handles select expansion for lookups, filter operators, type inference, and ordering.
     * Combines filter groups using inter-group operators (AND/OR).
     * @param {Object} p - Query parameters
     * @param {string[]} p.select - Array of column names to select
     * @param {Array<{filterType:string, filters:Array<{attr:string, op:string, value?:string}>, interGroupOperator?:string}>} p.filterGroups - Array of filter groups with inter-group operators
     * @param {string=} p.orderAttr - Attribute name to order by
     * @param {'asc'|'desc'=} p.orderDir - Sort direction (default: 'asc')
     * @param {string|number=} p.top - Maximum number of records to return
     * @param {Map<string, {type:string, targets?:string[]}>} p.attrMap - Attribute metadata map for type resolution
     * @returns {string} OData query string (e.g., '?$select=name&$filter=statecode eq 0&$top=10') or empty string
     */
    static build({ select = [], filterGroups = [], orderAttr, orderDir = 'asc', top, attrMap }) {
        const selectParts = this._buildSelectPart(select, attrMap);
        const filterExpression = this._buildFilterExpression(filterGroups, attrMap);
        return this._buildQueryParams(selectParts, filterExpression, top, orderAttr, orderDir);
    }

    /**
     * Escapes a string value for OData query (doubles single quotes).
     * @param {string} s - String to escape
     * @returns {string} Escaped string wrapped in single quotes
     * @private
     */
    static _escapeString(s) {
        return `'${String(s).replace(/'/g, "''")}'`;
    }

    /**
     * Builds the $select part of the query, handling lookup field expansion.
     * @param {string[]} select - Array of column names
     * @param {Map<string, {type:string}>} attrMap - Attribute metadata map
     * @returns {string[]} Array of select parts (with _value suffix for lookups)
     * @private
     */
    static _buildSelectPart(select, attrMap) {
        return select.map(c => {
            const col = c.toLowerCase();
            const meta = attrMap?.get(col);
            return (meta && meta.type === 'lookup') ? `_${col}_value` : col;
        });
    }

    /**
     * Builds a single filter condition based on attribute type and operator.
     * @param {Object} filter - Filter object
     * @param {string} filter.attr - Attribute name
     * @param {string} filter.op - Operator (eq, ne, contains, etc.)
     * @param {string=} filter.value - Filter value
     * @param {Map<string, {type:string}>} attrMap - Attribute metadata map
     * @returns {string|null} OData filter expression or null if invalid
     * @private
     */
    static _buildFilterCondition(filter, attrMap) {
        const attr = (filter.attr || '').toLowerCase();
        const { op } = filter;
        const raw = (filter.value ?? '').trim();

        if (!attr || !op) {
            return null;
        }

        const meta = attrMap?.get(attr);
        const isLookup = meta?.type === 'lookup';

        if (op.includes('null')) {
            return this._buildNullCondition(attr, op, isLookup);
        }

        const type = meta?.type || this._guess(raw);

        if (['contains', 'startswith', 'endswith', 'not contains'].includes(op)) {
            return this._buildStringFunctionCondition(attr, op, raw, type);
        }

        return this._formatValueByType(attr, op, raw, type);
    }

    /**
     * Builds a null/not-null condition, using _value suffix for lookup fields.
     * @param {string} attr - Attribute name (lowercase)
     * @param {string} op - Null operator (e.g. 'eq null', 'ne null')
     * @param {boolean} isLookup - Whether the attribute is a lookup type
     * @returns {string} OData null condition expression
     * @private
     */
    static _buildNullCondition(attr, op, isLookup) {
        const fieldName = isLookup ? `_${attr}_value` : attr;
        return `${fieldName} ${op}`;
    }

    /**
     * Builds a string function condition (contains, startswith, endswith, not contains).
     * Returns null if the attribute type is not a string.
     * @param {string} attr - Attribute name (lowercase)
     * @param {string} op - String function operator
     * @param {string} raw - Raw filter value
     * @param {string} type - Resolved attribute type
     * @returns {string|null} OData string function expression or null
     * @private
     */
    static _buildStringFunctionCondition(attr, op, raw, type) {
        if (type !== 'string') {
            return null;
        }
        const fn = (op === 'not contains') ? 'contains' : op;
        const expr = `${fn}(${attr},${this._escapeString(raw)})`;
        return op === 'not contains' ? `not ${expr}` : expr;
    }

    /**
     * Formats a filter value according to its resolved type.
     * @param {string} attr - Attribute name (lowercase)
     * @param {string} op - Comparison operator
     * @param {string} raw - Raw filter value
     * @param {string} type - Resolved attribute type
     * @returns {string} OData comparison expression
     * @private
     */
    static _formatValueByType(attr, op, raw, type) {
        switch (type) {
            case 'boolean':  return `${attr} ${op} ${raw.toLowerCase()}`;
            case 'number':   return `${attr} ${op} ${Number(raw)}`;
            case 'date':     return `${attr} ${op} ${this._escapeString(new Date(raw).toISOString())}`;
            case 'optionset':return `${attr} ${op} ${isNaN(Number(raw)) ? this._escapeString(raw) : Number(raw)}`;
            case 'lookup':   return `_${attr}_value ${op} ${raw}`;
            default:         return `${attr} ${op} ${this._escapeString(raw)}`;
        }
    }

    /**
     * Builds a filter group expression from multiple conditions.
     * @param {Object} group - Filter group object
     * @param {string} group.filterType - Group type (and, or, not)
     * @param {Array<{attr:string, op:string, value?:string}>} group.filters - Array of filters
     * @param {Map<string, {type:string}>} attrMap - Attribute metadata map
     * @returns {string|null} Filter group expression or null if no valid filters
     * @private
     */
    static _buildFilterGroup(group, attrMap) {
        const { filterType = 'and', filters = [] } = group;
        const filterParts = [];

        for (const filter of filters) {
            const condition = this._buildFilterCondition(filter, attrMap);
            if (condition) {
                filterParts.push(condition);
            }
        }

        if (filterParts.length === 0) {
            return null;
        }

        let groupExpr;
        if (filterType === 'not') {
            groupExpr = `not (${filterParts.join(' and ')})`;
        } else {
            groupExpr = filterParts.join(` ${filterType} `);
        }

        // Wrap in parentheses if multiple conditions
        if (filterParts.length > 1) {
            groupExpr = `(${groupExpr})`;
        }

        return groupExpr;
    }

    /**
     * Builds the complete filter expression by combining filter groups with inter-group operators.
     * @param {Array<{filterType:string, filters:Array, interGroupOperator?:string}>} filterGroups - Array of filter groups
     * @param {Map<string, {type:string}>} attrMap - Attribute metadata map
     * @returns {string} Combined filter expression or empty string
     * @private
     */
    static _buildFilterExpression(filterGroups, attrMap) {
        const groupExpressions = [];

        for (let i = 0; i < filterGroups.length; i++) {
            const group = filterGroups[i];
            const { interGroupOperator = 'and' } = group;
            const groupExpr = this._buildFilterGroup(group, attrMap);

            if (groupExpr) {
                groupExpressions.push({
                    expression: groupExpr,
                    interGroupOperator: i > 0 ? interGroupOperator : null
                });
            }
        }

        if (groupExpressions.length === 0) {
            return '';
        }

        // Combine groups using their inter-group operators
        let finalFilter = groupExpressions[0].expression;
        for (let i = 1; i < groupExpressions.length; i++) {
            const operator = groupExpressions[i].interGroupOperator || 'and';
            finalFilter = `${finalFilter} ${operator} ${groupExpressions[i].expression}`;
        }

        return finalFilter;
    }

    /**
     * Assembles the final OData query string from all parts.
     * @param {string[]} selectParts - Array of select columns
     * @param {string} filterExpression - Complete filter expression
     * @param {string|number=} top - Maximum number of records
     * @param {string=} orderAttr - Attribute to order by
     * @param {'asc'|'desc'} orderDir - Sort direction
     * @returns {string} Complete OData query string with ? prefix, or empty string
     * @private
     */
    static _buildQueryParams(selectParts, filterExpression, top, orderAttr, orderDir) {
        const params = [];

        if (selectParts.length) {
            params.push(`$select=${selectParts.join(',')}`);
        }
        if (filterExpression) {
            params.push(`$filter=${filterExpression}`);
        }
        if (top) {
            params.push(`$top=${top}`);
        }
        if (orderAttr) {
            params.push(`$orderby=${orderAttr.toLowerCase()} ${orderDir}`);
        }

        return params.length ? `?${params.join('&')}` : '';
    }

    /**
     * Guesses the data type of a value based on its format.
     * Checks for boolean, GUID, number, date, or defaults to string.
     * @param {string} v - The value to analyze
     * @returns {'boolean'|'lookup'|'number'|'date'|'string'} The guessed data type
     * @private
     */
    static _guess(v) {
        if (/^(true|false)$/i.test(v)) {
            return 'boolean';
        }
        if (isValidGuid(v)) {
            return 'lookup';
        }
        if (!Number.isNaN(Number(v))) {
            return 'number';
        }
        if (!Number.isNaN(Date.parse(v))) {
            return 'date';
        }
        return 'string';
    }
}
