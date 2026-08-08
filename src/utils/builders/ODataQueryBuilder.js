/**
 * @file ODataQueryBuilder
 * @description Build OData query strings from high-level parameters
 * @module utils/builders/ODataQueryBuilder
 */

import { isValidGuid, findFilterOperator } from '../../helpers/index.js';

/** @private Marks an operator value as a Dataverse query function rather than a binary operator. */
const QUERY_FUNCTION_PREFIX = 'fn:';

/** @private Namespace every Dataverse query function must be called through. */
const QUERY_FUNCTION_NAMESPACE = 'Microsoft.Dynamics.CRM';

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
     * Escapes a string value for use inside an OData query string.
     *
     * Two separate escapes are needed. OData requires a single quote to be doubled, and the URL
     * requires characters like `&`, `+`, `#` and `?` to be percent-encoded — the query string is
     * concatenated straight into the request URL, so an unencoded `&` would split it into a
     * different parameter and a `#` would truncate everything after it.
     *
     * Only the value is touched; the surrounding quotes and the OData operators around it stay
     * literal.
     * @param {string} s - String to escape
     * @returns {string} Escaped, encoded string wrapped in single quotes
     * @private
     */
    static _escapeString(s) {
        const odataEscaped = String(s).replace(/'/g, "''");
        return `'${this._encodeForUrl(odataEscaped)}'`;
    }

    /**
     * Percent-encodes the characters that would otherwise break the query string.
     *
     * Deliberately narrower than encodeURIComponent, which would also encode spaces and commas
     * and make the request preview hard to read. Percent is handled first so the encodings this
     * introduces are not themselves re-encoded.
     * @param {string} value - Value to encode
     * @returns {string} Encoded value
     * @private
     */
    static _encodeForUrl(value) {
        return String(value)
            .replace(/%/g, '%25')
            .replace(/&/g, '%26')
            .replace(/\+/g, '%2B')
            .replace(/#/g, '%23')
            .replace(/\?/g, '%3F');
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

        // Query functions use a call syntax, so they are handled before the operator branches.
        if (op.startsWith(QUERY_FUNCTION_PREFIX)) {
            return this._buildQueryFunctionCondition(attr, op, raw);
        }

        if (op.includes('null')) {
            return this._buildNullCondition(attr, op, isLookup);
        }

        const type = meta?.type || this._guess(raw);

        // An empty box cannot produce a literal of the column's type. Emitting `col eq ''` makes
        // Dataverse reject the whole query with a type mismatch, so the condition is dropped
        // instead. Strings keep it, where comparing to an empty value is at least valid.
        if (!raw && type !== 'string') {
            return null;
        }

        if (['contains', 'startswith', 'endswith', 'not contains'].includes(op)) {
            return this._buildStringFunctionCondition(attr, op, raw, type);
        }

        return this._formatValueByType(attr, op, raw, type);
    }

    /**
     * Builds a Dataverse query function condition, e.g.
     * `Microsoft.Dynamics.CRM.On(PropertyName='createdon',PropertyValue='2026-01-01')`.
     *
     * Whether a value is expected comes from the operator definition rather than from whether one
     * happens to be present: a function that needs one but has none is dropped, so it cannot be
     * emitted in a form the service rejects.
     * @param {string} attr - Attribute name (lowercase)
     * @param {string} op - Operator value carrying the `fn:` prefix
     * @param {string} raw - Raw filter value
     * @returns {string|null} The function call, or null when a required value is missing
     * @private
     */
    static _buildQueryFunctionCondition(attr, op, raw) {
        const fnName = op.slice(QUERY_FUNCTION_PREFIX.length);
        if (!fnName) {
            return null;
        }

        const definition = findFilterOperator(op);
        const takesValue = definition?.arg !== 'none';

        if (takesValue && !raw) {
            return null;
        }

        const args = [`PropertyName='${attr}'`];
        if (takesValue) {
            args.push(`PropertyValue=${this._escapeString(raw)}`);
        }

        return `${QUERY_FUNCTION_NAMESPACE}.${fnName}(${args.join(',')})`;
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
        // GUID columns are let through even though the service will refuse the call: dropping the
        // condition instead would silently widen whatever it guards, and a bulk update or delete
        // built on a condition that vanished is far worse than one that errors.
        if (type !== 'string' && type !== 'guid') {
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
            case 'boolean':  return `${attr} ${op} ${this._booleanLiteral(raw)}`;
            case 'number':   return `${attr} ${op} ${this._numberLiteral(raw)}`;
            case 'date':     return `${attr} ${op} ${this._dateLiteral(raw)}`;
            case 'optionset':return `${attr} ${op} ${isNaN(Number(raw)) ? this._escapeString(raw) : Number(raw)}`;
            case 'lookup':   return `_${attr}_value ${op} ${isValidGuid(raw) ? raw : this._escapeString(raw)}`;
            // Edm.Guid takes a bare literal — quoting it makes the service reject the comparison as
            // a type mismatch. A malformed value still gets quoted so the error names the type
            // rather than a parse failure, as with the other literal helpers.
            case 'guid':     return `${attr} ${op} ${isValidGuid(raw) ? raw : this._escapeString(raw)}`;
            default:         return `${attr} ${op} ${this._escapeString(raw)}`;
        }
    }

    /**
     * Renders a boolean literal, falling back to a quoted string when the value is not one.
     *
     * Values that cannot be coerced are quoted rather than emitted bare, following the optionset
     * case: the query stays syntactically valid, so the service reports a type mismatch instead
     * of a parse error.
     * @param {string} raw - Raw filter value
     * @returns {string} An OData literal
     * @private
     */
    static _booleanLiteral(raw) {
        const lowered = String(raw).toLowerCase();
        return (lowered === 'true' || lowered === 'false') ? lowered : this._escapeString(raw);
    }

    /**
     * Renders a numeric literal, falling back to a quoted string rather than emitting NaN.
     * @param {string} raw - Raw filter value
     * @returns {string} An OData literal
     * @private
     */
    static _numberLiteral(raw) {
        const parsed = Number(raw);
        return Number.isNaN(parsed) ? this._escapeString(raw) : String(parsed);
    }

    /**
     * Renders a date literal, falling back to a quoted string for an unparseable value.
     *
     * Guards against `new Date(raw).toISOString()`, which throws a RangeError on an invalid date
     * rather than returning anything.
     * @param {string} raw - Raw filter value
     * @returns {string} An OData literal
     * @private
     */
    static _dateLiteral(raw) {
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime())
            ? this._escapeString(raw)
            : this._escapeString(parsed.toISOString());
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
