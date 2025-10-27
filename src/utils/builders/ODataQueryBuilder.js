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
     * @param {Object} p - Query parameters
     * @param {string[]} p.select - Array of column names to select
     * @param {Array<{attr:string, op:string, value?:string}>} p.filters - Array of filter conditions
     * @param {string=} p.orderAttr - Attribute name to order by
     * @param {'asc'|'desc'=} p.orderDir - Sort direction (default: 'asc')
     * @param {string|number=} p.top - Maximum number of records to return
     * @param {Map<string, {type:string, targets?:string[]}>} p.attrMap - Attribute metadata map for type resolution
     * @returns {string} OData query string (e.g., '?$select=name&$filter=statecode eq 0&$top=10') or empty string
     */
    static build({ select = [], filters = [], orderAttr, orderDir = 'asc', top, attrMap }) {
        const esc = (s) => `'${String(s).replace(/'/g, "''")}'`;

        const selectParts = select.map(c => {
            const meta = attrMap?.get(c);
            return (meta && meta.type === 'lookup') ? `_${c}_value` : c;
        });

        const filterParts = [];
        for (const f of filters) {
            const { attr, op } = f;
            const raw = (f.value ?? '').trim();

            if (!attr || !op) continue;
            if (op.includes('null')) { filterParts.push(`${attr} ${op}`); continue; }

            const meta = attrMap?.get(attr);
            const type = meta?.type || this._guess(raw);

            if (['contains', 'startswith', 'endswith', 'not contains'].includes(op)) {
                if (type !== 'string') continue;
                const fn = (op === 'not contains') ? 'contains' : op;
                const expr = `${fn}(${attr},${esc(raw)})`;
                filterParts.push(op === 'not contains' ? `not ${expr}` : expr);
                continue;
            }

            if (type === 'boolean') { filterParts.push(`${attr} ${op} ${raw.toLowerCase()}`); continue; }
            if (type === 'number') { filterParts.push(`${attr} ${op} ${Number(raw)}`); continue; }
            if (type === 'date') { filterParts.push(`${attr} ${op} ${esc(new Date(raw).toISOString())}`); continue; }
            if (type === 'optionset') {
                filterParts.push(`${attr} ${op} ${isNaN(Number(raw)) ? esc(raw) : Number(raw)}`);
                continue;
            }
            if (type === 'lookup') { filterParts.push(`_${attr}_value ${op} ${raw}`); continue; }

            filterParts.push(`${attr} ${op} ${esc(raw)}`);
        }

        const params = [];
        if (selectParts.length) params.push(`$select=${selectParts.join(',')}`);
        if (filterParts.length) params.push(`$filter=${filterParts.join(' and ')}`);
        if (top) params.push(`$top=${top}`);
        if (orderAttr) params.push(`$orderby=${orderAttr} ${orderDir}`);

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
        if (/^(true|false)$/i.test(v)) return 'boolean';
        if (isValidGuid(v)) return 'lookup';
        if (!Number.isNaN(Number(v))) return 'number';
        if (!Number.isNaN(Date.parse(v))) return 'date';
        return 'string';
    }
}
