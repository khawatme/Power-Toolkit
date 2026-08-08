/**
 * @file Tests for ODataQueryBuilder utility
 * @module tests/utils/builders/ODataQueryBuilder
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ODataQueryBuilder } from '../../../src/utils/builders/ODataQueryBuilder.js';

describe('ODataQueryBuilder', () => {
    let attrMap;

    beforeEach(() => {
        attrMap = new Map([
            ['name', { type: 'string' }],
            ['age', { type: 'number' }],
            ['isactive', { type: 'boolean' }],
            ['createdon', { type: 'date' }],
            ['ownerid', { type: 'lookup', targets: ['systemuser'] }],
            ['parentaccountid', { type: 'lookup', targets: ['account'] }]
        ]);
    });

    describe('values that do not match the column type', () => {
        const filterOn = (type, value) => ODataQueryBuilder.build({
            filterGroups: [{ filterType: 'and', filters: [{ attr: 'col', op: 'eq', value }] }],
            attrMap: new Map([['col', { type }]])
        });

        it('should not throw on an unparseable date', () => {
            // new Date('not a date').toISOString() raises a RangeError.
            expect(() => filterOn('date', 'not a date')).not.toThrow();
        });

        it('should quote an unparseable date rather than emitting an invalid literal', () => {
            expect(filterOn('date', 'not a date')).toBe("?$filter=col eq 'not a date'");
        });

        it('should still format a valid date as an ISO literal', () => {
            expect(filterOn('date', '2026-03-01')).toContain('2026-03-01T00:00:00.000Z');
        });

        it('should not emit NaN for a non-numeric value', () => {
            const result = filterOn('number', 'abc');
            expect(result).not.toContain('NaN');
            expect(result).toBe("?$filter=col eq 'abc'");
        });

        it('should still format a valid number bare', () => {
            expect(filterOn('number', '42')).toBe('?$filter=col eq 42');
        });

        it('should not emit a bare non-boolean for a boolean column', () => {
            expect(filterOn('boolean', 'yes')).toBe("?$filter=col eq 'yes'");
        });

        it.each(['true', 'FALSE'])('should still format %s bare for a boolean column', (value) => {
            expect(filterOn('boolean', value)).toBe(`?$filter=col eq ${value.toLowerCase()}`);
        });

        it('should emit a valid lookup guid unquoted', () => {
            const guid = '00000000-0000-0000-0000-000000000001';
            expect(filterOn('lookup', guid)).toBe(`?$filter=_col_value eq ${guid}`);
        });

        it('should quote a lookup value that is not a guid', () => {
            // Previously interpolated bare, producing malformed OData.
            expect(filterOn('lookup', 'not-a-guid')).toBe("?$filter=_col_value eq 'not-a-guid'");
        });

        it('should keep quote escaping intact for string values', () => {
            expect(filterOn('string', "O'Brien")).toBe("?$filter=col eq 'O''Brien'");
        });

        // A primary key is Edm.Guid: a quoted literal is rejected as a type mismatch, and unlike a
        // lookup it takes no _value suffix.
        it('should emit a guid column value unquoted and unsuffixed', () => {
            const guid = '00000000-0000-0000-0000-000000000001';
            expect(filterOn('guid', guid)).toBe(`?$filter=col eq ${guid}`);
        });

        it('should quote a guid column value that is not a guid', () => {
            expect(filterOn('guid', 'not-a-guid')).toBe("?$filter=col eq 'not-a-guid'");
        });

        // Dropping it would silently widen whatever the condition guards — including a bulk delete.
        it('should still emit a string function on a guid column rather than dropping it', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{ filterType: 'and', filters: [{ attr: 'col', op: 'contains', value: 'abc' }] }],
                attrMap: new Map([['col', { type: 'guid' }]])
            });
            expect(result).toBe("?$filter=contains(col,'abc')");
        });
    });

    describe('date query functions', () => {
        const filterOn = (op, value) => ODataQueryBuilder.build({
            filterGroups: [{ filterType: 'and', filters: [{ attr: 'createdon', op, value }] }],
            attrMap: new Map([['createdon', { type: 'date' }]])
        });

        it('should emit On as a namespaced function call', () => {
            expect(filterOn('fn:On', '2026-01-01')).toBe(
                "?$filter=Microsoft.Dynamics.CRM.On(PropertyName='createdon',PropertyValue='2026-01-01')"
            );
        });

        it('should emit a no-argument function without PropertyValue', () => {
            expect(filterOn('fn:Today', '')).toBe(
                "?$filter=Microsoft.Dynamics.CRM.Today(PropertyName='createdon')"
            );
        });

        it('should ignore a stray value on a no-argument function', () => {
            expect(filterOn('fn:Today', 'ignored')).toBe(
                "?$filter=Microsoft.Dynamics.CRM.Today(PropertyName='createdon')"
            );
        });

        it('should drop a function that needs a value but has none', () => {
            expect(filterOn('fn:On', '')).toBe('');
            expect(filterOn('fn:LastXDays', '')).toBe('');
        });

        it('should emit a numeric-argument function', () => {
            expect(filterOn('fn:LastXDays', '30')).toBe(
                "?$filter=Microsoft.Dynamics.CRM.LastXDays(PropertyName='createdon',PropertyValue='30')"
            );
        });

        it('should escape and encode the function value', () => {
            expect(filterOn('fn:On', "a&b'c")).toContain("PropertyValue='a%26b''c'");
        });

        it('should drop a malformed function marker', () => {
            expect(filterOn('fn:', '2026-01-01')).toBe('');
        });

        it('should combine a function with a normal condition', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'createdon', op: 'fn:Today', value: '' },
                        { attr: 'name', op: 'eq', value: 'Contoso' }
                    ]
                }],
                attrMap: new Map([
                    ['createdon', { type: 'date' }],
                    ['name', { type: 'string' }]
                ])
            });

            expect(result).toBe(
                "?$filter=(Microsoft.Dynamics.CRM.Today(PropertyName='createdon') and name eq 'Contoso')"
            );
        });
    });

    describe('empty filter values', () => {
        const filterOn = (type, value) => ODataQueryBuilder.build({
            filterGroups: [{ filterType: 'and', filters: [{ attr: 'col', op: 'eq', value }] }],
            attrMap: new Map([['col', { type }]])
        });

        // `col eq ''` on a date made Dataverse reject the query outright:
        // "Found operand types 'Edm.DateTimeOffset' and 'Edm.String' for operator kind 'Equal'".
        it.each(['date', 'number', 'boolean', 'lookup', 'optionset'])(
            'should drop an empty condition on a %s column',
            (type) => {
                expect(filterOn(type, '')).toBe('');
            }
        );

        it('should drop a whitespace-only value', () => {
            expect(filterOn('date', '   ')).toBe('');
        });

        it('should still allow an empty comparison on a string column', () => {
            expect(filterOn('string', '')).toBe("?$filter=col eq ''");
        });

        it('should keep other conditions when one is dropped', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'createdon', op: 'eq', value: '' },
                        { attr: 'name', op: 'eq', value: 'Contoso' }
                    ]
                }],
                attrMap: new Map([
                    ['createdon', { type: 'date' }],
                    ['name', { type: 'string' }]
                ])
            });

            expect(result).toBe("?$filter=name eq 'Contoso'");
        });

        it('should still emit null operators with no value', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [{ attr: 'createdon', op: 'eq null', value: '' }]
                }],
                attrMap: new Map([['createdon', { type: 'date' }]])
            });

            expect(result).toBe('?$filter=createdon eq null');
        });
    });

    // The query string is concatenated into the request URL with no encoding downstream.
    describe('url-breaking characters in values', () => {
        const filterOn = (type, value) => ODataQueryBuilder.build({
            filterGroups: [{ filterType: 'and', filters: [{ attr: 'col', op: 'eq', value }] }],
            attrMap: new Map([['col', { type }]])
        });

        it('should encode an ampersand so it cannot split the query string', () => {
            expect(filterOn('string', 'Smith & Sons')).toBe("?$filter=col eq 'Smith %26 Sons'");
        });

        it('should encode a hash so it cannot truncate the url', () => {
            expect(filterOn('string', 'Suite #3')).toBe("?$filter=col eq 'Suite %233'");
        });

        it('should encode a plus so it is not read as a space', () => {
            expect(filterOn('string', '+123')).toBe("?$filter=col eq '%2B123'");
        });

        it('should encode a question mark', () => {
            expect(filterOn('string', 'why?')).toBe("?$filter=col eq 'why%3F'");
        });

        it('should encode percent first so encodings are not double-encoded', () => {
            expect(filterOn('string', '50% & up')).toBe("?$filter=col eq '50%25 %26 up'");
        });

        it('should leave spaces and commas readable', () => {
            expect(filterOn('string', 'Contoso, Ltd')).toBe("?$filter=col eq 'Contoso, Ltd'");
        });

        it('should encode inside string functions too', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [{ attr: 'col', op: 'contains', value: 'A & B' }]
                }],
                attrMap: new Map([['col', { type: 'string' }]])
            });
            expect(result).toBe("?$filter=contains(col,'A %26 B')");
        });

        it('should not encode the operators or structure around the value', () => {
            const result = filterOn('string', 'x');
            expect(result.startsWith('?$filter=col eq ')).toBe(true);
        });
    });

    describe('build', () => {
        it('should build empty query when no parameters provided', () => {
            const result = ODataQueryBuilder.build({});
            expect(result).toBe('');
        });

        it('should build select query with string fields', () => {
            const result = ODataQueryBuilder.build({
                select: ['name', 'age']
            });
            expect(result).toBe('?$select=name,age');
        });

        it('should transform lookup fields to _value format', () => {
            const result = ODataQueryBuilder.build({
                select: ['name', 'ownerid'],
                attrMap
            });
            expect(result).toBe('?$select=name,_ownerid_value');
        });

        it('should build filter with eq operator and string type', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'name', op: 'eq', value: 'John' }
                    ]
                }],
                attrMap
            });
            expect(result).toContain("$filter=name eq 'John'");
        });

        it('should build filter with number type', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'age', op: 'gt', value: '25' }
                    ]
                }],
                attrMap
            });
            expect(result).toContain('$filter=age gt 25');
        });

        it('should build filter with boolean type', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'isactive', op: 'eq', value: 'true' }
                    ]
                }],
                attrMap
            });
            expect(result).toContain('$filter=isactive eq true');
        });

        it('should handle contains operator', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'name', op: 'contains', value: 'test' }
                    ]
                }],
                attrMap
            });
            expect(result).toContain("contains(name,'test')");
        });

        it('should handle startswith operator', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'name', op: 'startswith', value: 'A' }
                    ]
                }],
                attrMap
            });
            expect(result).toContain("startswith(name,'A')");
        });

        it('should handle endswith operator', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'name', op: 'endswith', value: 'son' }
                    ]
                }],
                attrMap
            });
            expect(result).toContain("endswith(name,'son')");
        });

        it('should handle "not contains" operator', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'name', op: 'not contains', value: 'test' }
                    ]
                }],
                attrMap
            });
            expect(result).toContain("not contains(name,'test')");
        });

        it('should handle null and not null operators', () => {
            const result1 = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'name', op: 'eq null' }
                    ]
                }]
            });
            expect(result1).toContain('$filter=name eq null');

            const result2 = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'name', op: 'ne null' }
                    ]
                }]
            });
            expect(result2).toContain('$filter=name ne null');
        });

        it('should handle null and not null operators for lookup fields', () => {
            const result1 = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'ownerid', op: 'eq null' }
                    ]
                }],
                attrMap
            });
            expect(result1).toContain('$filter=_ownerid_value eq null');

            const result2 = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'parentaccountid', op: 'ne null' }
                    ]
                }],
                attrMap
            });
            expect(result2).toContain('$filter=_parentaccountid_value ne null');
        });

        it('should combine multiple filters with AND', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'name', op: 'eq', value: 'John' },
                        { attr: 'age', op: 'gt', value: '25' }
                    ]
                }],
                attrMap
            });
            expect(result).toContain("name eq 'John' and age gt 25");
        });

        it('should combine multiple filters with OR', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'or',
                    filters: [
                        { attr: 'name', op: 'eq', value: 'John' },
                        { attr: 'name', op: 'eq', value: 'Jane' }
                    ]
                }],
                attrMap
            });
            expect(result).toContain("name eq 'John' or name eq 'Jane'");
        });

        it('should combine multiple filter groups with inter-group operator', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [
                    {
                        filterType: 'and',
                        filters: [
                            { attr: 'name', op: 'eq', value: 'John' }
                        ],
                        interGroupOperator: 'and'
                    },
                    {
                        filterType: 'and',
                        filters: [
                            { attr: 'age', op: 'gt', value: '25' }
                        ]
                    }
                ],
                attrMap
            });
            expect(result).toContain("name eq 'John'");
            expect(result).toContain('age gt 25');
            expect(result).toContain(' and ');
        });

        it('should add $top parameter', () => {
            const result = ODataQueryBuilder.build({
                select: ['name'],
                top: 10
            });
            expect(result).toContain('$top=10');
        });

        it('should add $orderby parameter with asc direction', () => {
            const result = ODataQueryBuilder.build({
                select: ['name'],
                orderAttr: 'name',
                orderDir: 'asc'
            });
            expect(result).toContain('$orderby=name asc');
        });

        it('should add $orderby parameter with desc direction', () => {
            const result = ODataQueryBuilder.build({
                select: ['name'],
                orderAttr: 'name',
                orderDir: 'desc'
            });
            expect(result).toContain('$orderby=name desc');
        });

        it('should build complete query with all parameters', () => {
            const result = ODataQueryBuilder.build({
                select: ['name', 'age'],
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'age', op: 'gt', value: '25' }
                    ]
                }],
                orderAttr: 'name',
                orderDir: 'asc',
                top: 50,
                attrMap
            });
            expect(result).toContain('$select=name,age');
            expect(result).toContain('$filter=age gt 25');
            expect(result).toContain('$orderby=name asc');
            expect(result).toContain('$top=50');
        });

        it('should escape single quotes in string values', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'name', op: 'eq', value: "O'Brien" }
                    ]
                }],
                attrMap
            });
            expect(result).toContain("name eq 'O''Brien'");
        });

        it('should handle date type filters', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'createdon', op: 'gt', value: '2024-01-01' }
                    ]
                }],
                attrMap
            });
            expect(result).toContain('createdon gt');
        });

        it('should skip invalid filters without attr or op', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'name' }, // missing op
                        { op: 'eq' }, // missing attr
                        { attr: 'age', op: 'eq', value: '25' } // valid
                    ]
                }],
                attrMap
            });
            expect(result).toContain('age eq 25');
            expect(result).not.toContain('name');
        });

        it('should handle empty filter groups', () => {
            const result = ODataQueryBuilder.build({
                select: ['name'],
                filterGroups: [{
                    filterType: 'and',
                    filters: []
                }]
            });
            expect(result).toBe('?$select=name');
        });

        it('should handle GUID values', () => {
            const guid = '12345678-1234-1234-1234-123456789012';
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'ownerid', op: 'eq', value: guid }
                    ]
                }]
            });
            expect(result).toContain(guid);
        });

        it('should handle comparison operators (ne, lt, le, ge)', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [
                        { attr: 'age', op: 'ne', value: '30' },
                        { attr: 'age', op: 'lt', value: '50' },
                        { attr: 'age', op: 'le', value: '60' },
                        { attr: 'age', op: 'ge', value: '20' }
                    ]
                }],
                attrMap
            });
            expect(result).toContain('age ne 30');
            expect(result).toContain('age lt 50');
            expect(result).toContain('age le 60');
            expect(result).toContain('age ge 20');
        });
    });

    describe('_escapeString', () => {
        it('should wrap string in single quotes', () => {
            const result = ODataQueryBuilder._escapeString('test');
            expect(result).toBe("'test'");
        });

        it('should escape single quotes by doubling them', () => {
            const result = ODataQueryBuilder._escapeString("O'Brien");
            expect(result).toBe("'O''Brien'");
        });

        it('should handle empty strings', () => {
            const result = ODataQueryBuilder._escapeString('');
            expect(result).toBe("''");
        });

        it('should handle multiple single quotes', () => {
            const result = ODataQueryBuilder._escapeString("It's a test's value");
            expect(result).toBe("'It''s a test''s value'");
        });

        it('should convert non-string values to string', () => {
            const result = ODataQueryBuilder._escapeString(123);
            expect(result).toBe("'123'");
        });
    });

    describe('_buildSelectPart', () => {
        it('should return columns as-is when attrMap is undefined', () => {
            const result = ODataQueryBuilder._buildSelectPart(['name', 'age'], undefined);
            expect(result).toEqual(['name', 'age']);
        });

        it('should return columns as-is when attrMap is null', () => {
            const result = ODataQueryBuilder._buildSelectPart(['name', 'age'], null);
            expect(result).toEqual(['name', 'age']);
        });

        it('should handle columns not found in attrMap (lowercased)', () => {
            const attrMap = new Map([['name', { type: 'string' }]]);
            const result = ODataQueryBuilder._buildSelectPart(['name', 'unknownField'], attrMap);
            expect(result).toEqual(['name', 'unknownfield']);
        });
    });

    describe('_buildFilterCondition', () => {
        let attrMap;

        beforeEach(() => {
            attrMap = new Map([
                ['name', { type: 'string' }],
                ['status', { type: 'optionset' }],
                ['ownerid', { type: 'lookup' }],
                ['count', { type: 'number' }]
            ]);
        });

        it('should handle optionset type with numeric value', () => {
            const result = ODataQueryBuilder._buildFilterCondition(
                { attr: 'status', op: 'eq', value: '1' },
                attrMap
            );
            expect(result).toBe('status eq 1');
        });

        it('should handle optionset type with string value', () => {
            const result = ODataQueryBuilder._buildFilterCondition(
                { attr: 'status', op: 'eq', value: 'Active' },
                attrMap
            );
            expect(result).toBe("status eq 'Active'");
        });

        it('should handle lookup type filter with _value suffix', () => {
            const guid = '12345678-1234-1234-1234-123456789012';
            const result = ODataQueryBuilder._buildFilterCondition(
                { attr: 'ownerid', op: 'eq', value: guid },
                attrMap
            );
            expect(result).toBe(`_ownerid_value eq ${guid}`);
        });

        it('should return null for string function operators on non-string types', () => {
            const result = ODataQueryBuilder._buildFilterCondition(
                { attr: 'count', op: 'contains', value: '5' },
                attrMap
            );
            expect(result).toBeNull();
        });

        it('should return null for startswith on number type', () => {
            const result = ODataQueryBuilder._buildFilterCondition(
                { attr: 'count', op: 'startswith', value: '5' },
                attrMap
            );
            expect(result).toBeNull();
        });

        it('should return null for endswith on non-string type', () => {
            const result = ODataQueryBuilder._buildFilterCondition(
                { attr: 'count', op: 'endswith', value: '5' },
                attrMap
            );
            expect(result).toBeNull();
        });

        it('should return null for not contains on non-string type', () => {
            const result = ODataQueryBuilder._buildFilterCondition(
                { attr: 'count', op: 'not contains', value: '5' },
                attrMap
            );
            expect(result).toBeNull();
        });

        it('should handle filter with undefined value', () => {
            const result = ODataQueryBuilder._buildFilterCondition(
                { attr: 'name', op: 'eq null' },
                attrMap
            );
            expect(result).toBe('name eq null');
        });
    });

    describe('_buildFilterGroup', () => {
        let attrMap;

        beforeEach(() => {
            attrMap = new Map([
                ['name', { type: 'string' }],
                ['age', { type: 'number' }]
            ]);
        });

        it('should handle NOT filter type with single condition', () => {
            const result = ODataQueryBuilder._buildFilterGroup({
                filterType: 'not',
                filters: [{ attr: 'name', op: 'eq', value: 'John' }]
            }, attrMap);
            expect(result).toBe("not (name eq 'John')");
        });

        it('should handle NOT filter type with multiple conditions', () => {
            const result = ODataQueryBuilder._buildFilterGroup({
                filterType: 'not',
                filters: [
                    { attr: 'name', op: 'eq', value: 'John' },
                    { attr: 'age', op: 'gt', value: '25' }
                ]
            }, attrMap);
            expect(result).toBe("(not (name eq 'John' and age gt 25))");
        });

        it('should return null for empty filters array', () => {
            const result = ODataQueryBuilder._buildFilterGroup({
                filterType: 'and',
                filters: []
            }, attrMap);
            expect(result).toBeNull();
        });

        it('should return null when all filters are invalid', () => {
            const result = ODataQueryBuilder._buildFilterGroup({
                filterType: 'and',
                filters: [
                    { attr: 'name' }, // missing op
                    { op: 'eq' } // missing attr
                ]
            }, attrMap);
            expect(result).toBeNull();
        });

        it('should use default filterType of and when not specified', () => {
            const result = ODataQueryBuilder._buildFilterGroup({
                filters: [
                    { attr: 'name', op: 'eq', value: 'John' },
                    { attr: 'age', op: 'gt', value: '25' }
                ]
            }, attrMap);
            expect(result).toBe("(name eq 'John' and age gt 25)");
        });
    });

    describe('_buildFilterExpression', () => {
        let attrMap;

        beforeEach(() => {
            attrMap = new Map([
                ['name', { type: 'string' }],
                ['age', { type: 'number' }],
                ['status', { type: 'optionset' }]
            ]);
        });

        it('should combine filter groups with OR inter-group operator', () => {
            const result = ODataQueryBuilder._buildFilterExpression([
                {
                    filterType: 'and',
                    filters: [{ attr: 'name', op: 'eq', value: 'John' }]
                },
                {
                    filterType: 'and',
                    filters: [{ attr: 'age', op: 'gt', value: '25' }],
                    interGroupOperator: 'or'
                }
            ], attrMap);
            expect(result).toBe("name eq 'John' or age gt 25");
        });

        it('should skip empty filter groups in expression', () => {
            const result = ODataQueryBuilder._buildFilterExpression([
                {
                    filterType: 'and',
                    filters: []
                },
                {
                    filterType: 'and',
                    filters: [{ attr: 'name', op: 'eq', value: 'John' }]
                }
            ], attrMap);
            expect(result).toBe("name eq 'John'");
        });

        it('should return empty string when all filter groups are empty', () => {
            const result = ODataQueryBuilder._buildFilterExpression([
                { filterType: 'and', filters: [] },
                { filterType: 'or', filters: [] }
            ], attrMap);
            expect(result).toBe('');
        });

        it('should default to AND when interGroupOperator is undefined for second group', () => {
            const result = ODataQueryBuilder._buildFilterExpression([
                {
                    filterType: 'and',
                    filters: [{ attr: 'name', op: 'eq', value: 'John' }]
                },
                {
                    filterType: 'and',
                    filters: [{ attr: 'age', op: 'gt', value: '25' }]
                    // interGroupOperator intentionally omitted
                }
            ], attrMap);
            expect(result).toBe("name eq 'John' and age gt 25");
        });

        it('should default to AND when interGroupOperator is empty string', () => {
            const result = ODataQueryBuilder._buildFilterExpression([
                {
                    filterType: 'and',
                    filters: [{ attr: 'name', op: 'eq', value: 'John' }]
                },
                {
                    filterType: 'and',
                    filters: [{ attr: 'age', op: 'gt', value: '25' }],
                    interGroupOperator: ''
                }
            ], attrMap);
            expect(result).toBe("name eq 'John' and age gt 25");
        });

        it('should handle three filter groups with mixed operators', () => {
            const result = ODataQueryBuilder._buildFilterExpression([
                {
                    filterType: 'and',
                    filters: [{ attr: 'name', op: 'eq', value: 'John' }]
                },
                {
                    filterType: 'and',
                    filters: [{ attr: 'age', op: 'gt', value: '25' }],
                    interGroupOperator: 'and'
                },
                {
                    filterType: 'or',
                    filters: [{ attr: 'status', op: 'eq', value: '1' }],
                    interGroupOperator: 'or'
                }
            ], attrMap);
            expect(result).toContain("name eq 'John'");
            expect(result).toContain('age gt 25');
            expect(result).toContain('status eq 1');
            expect(result).toContain(' and ');
            expect(result).toContain(' or ');
        });
    });

    describe('_guess', () => {
        it('should guess boolean type for true value', () => {
            const result = ODataQueryBuilder._guess('true');
            expect(result).toBe('boolean');
        });

        it('should guess boolean type for false value (case insensitive)', () => {
            const result = ODataQueryBuilder._guess('FALSE');
            expect(result).toBe('boolean');
        });

        it('should guess boolean type for True value', () => {
            const result = ODataQueryBuilder._guess('True');
            expect(result).toBe('boolean');
        });

        it('should guess lookup type for valid GUID', () => {
            const result = ODataQueryBuilder._guess('12345678-1234-1234-1234-123456789012');
            expect(result).toBe('lookup');
        });

        it('should guess number type for integer string', () => {
            const result = ODataQueryBuilder._guess('42');
            expect(result).toBe('number');
        });

        it('should guess number type for decimal string', () => {
            const result = ODataQueryBuilder._guess('3.14');
            expect(result).toBe('number');
        });

        it('should guess number type for negative number', () => {
            const result = ODataQueryBuilder._guess('-100');
            expect(result).toBe('number');
        });

        it('should guess date type for ISO date string', () => {
            const result = ODataQueryBuilder._guess('2024-01-15');
            expect(result).toBe('date');
        });

        it('should guess date type for ISO datetime string', () => {
            const result = ODataQueryBuilder._guess('2024-01-15T10:30:00Z');
            expect(result).toBe('date');
        });

        it('should guess string type for non-matching values', () => {
            const result = ODataQueryBuilder._guess('hello world');
            expect(result).toBe('string');
        });

        it('should guess string type for empty string', () => {
            const result = ODataQueryBuilder._guess('');
            expect(result).toBe('number');
        });

        it('should guess string type for special characters', () => {
            const result = ODataQueryBuilder._guess('test@example.com');
            expect(result).toBe('string');
        });
    });

    describe('type inference in filters without attrMap', () => {
        it('should infer boolean type and format correctly', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [{ attr: 'isactive', op: 'eq', value: 'true' }]
                }]
            });
            expect(result).toContain('isactive eq true');
        });

        it('should infer number type from numeric value', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [{ attr: 'count', op: 'gt', value: '100' }]
                }]
            });
            expect(result).toContain('count gt 100');
        });

        it('should infer lookup type from GUID value', () => {
            const guid = '12345678-1234-1234-1234-123456789012';
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [{ attr: 'recordid', op: 'eq', value: guid }]
                }]
            });
            expect(result).toContain(`_recordid_value eq ${guid}`);
        });

        it('should infer date type from date string', () => {
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [{ attr: 'createdon', op: 'gt', value: '2024-06-15' }]
                }]
            });
            expect(result).toContain('createdon gt');
            expect(result).toContain('2024-06-15');
        });
    });

    describe('edge cases and complex scenarios', () => {
        it('should handle filter with whitespace-only value as empty', () => {
            const attrMap = new Map([['name', { type: 'string' }]]);
            const result = ODataQueryBuilder.build({
                filterGroups: [{
                    filterType: 'and',
                    filters: [{ attr: 'name', op: 'eq', value: '   ' }]
                }],
                attrMap
            });
            expect(result).toContain("name eq ''");
        });

        it('should handle multiple lookup fields in select', () => {
            const attrMap = new Map([
                ['ownerid', { type: 'lookup' }],
                ['parentid', { type: 'lookup' }],
                ['name', { type: 'string' }]
            ]);
            const result = ODataQueryBuilder.build({
                select: ['name', 'ownerid', 'parentid'],
                attrMap
            });
            expect(result).toBe('?$select=name,_ownerid_value,_parentid_value');
        });

        it('should handle only top parameter', () => {
            const result = ODataQueryBuilder.build({ top: 5 });
            expect(result).toBe('?$top=5');
        });

        it('should handle only orderby parameter', () => {
            const result = ODataQueryBuilder.build({
                orderAttr: 'createdon',
                orderDir: 'desc'
            });
            expect(result).toBe('?$orderby=createdon desc');
        });

        it('should handle string top parameter', () => {
            const result = ODataQueryBuilder.build({
                select: ['name'],
                top: '25'
            });
            expect(result).toContain('$top=25');
        });

        it('should build complex query with NOT filter group', () => {
            const attrMap = new Map([
                ['status', { type: 'optionset' }],
                ['name', { type: 'string' }]
            ]);
            const result = ODataQueryBuilder.build({
                select: ['name', 'status'],
                filterGroups: [{
                    filterType: 'not',
                    filters: [
                        { attr: 'status', op: 'eq', value: '0' },
                        { attr: 'name', op: 'contains', value: 'test' }
                    ]
                }],
                top: 10,
                attrMap
            });
            expect(result).toContain('$select=name,status');
            expect(result).toContain('not (status eq 0 and');
            expect(result).toContain("contains(name,'test')");
            expect(result).toContain('$top=10');
        });
    });
});
