/**
 * @file FetchXmlConverterService - Converts FetchXML to multiple output formats.
 * @module services/FetchXmlConverterService
 * @description Stateless service that parses FetchXML and converts it to
 * C# QueryExpression, JavaScript Xrm, OData, SQL, Power Automate, and Web API URL formats.
 */

/**
 * @typedef {Object} FetchXmlParsed
 * @property {string} entityName - Primary entity logical name
 * @property {string[]} attributes - Selected attribute names (empty = all)
 * @property {boolean} allAttributes - Whether all attributes are selected
 * @property {Object|null} order - Order clause {attribute, descending}
 * @property {number|null} top - Top count
 * @property {boolean} aggregate - Whether this is an aggregate query
 * @property {boolean} distinct - Whether distinct is set
 * @property {Array<Object>} filters - Parsed filter conditions
 * @property {Array<Object>} linkEntities - Parsed link-entity nodes
 * @property {Array<Object>} aggregateAttributes - Parsed aggregate attributes
 * @property {Array<Object>} groupByAttributes - Parsed group-by attributes
 */

/**
 * Service for converting FetchXML to multiple output formats.
 * All methods are static — no instance required.
 * @class FetchXmlConverterService
 */
export class FetchXmlConverterService {
    // ═══════════════════════════════════════════════════════════
    // PUBLIC CONVERTERS
    // ═══════════════════════════════════════════════════════════

    /**
     * Convert FetchXML to a named format.
     * @param {string} fetchXml - The FetchXML string
     * @param {string} format - One of: 'csharp', 'javascript', 'odata', 'sql', 'powerautomate', 'webapiurl'
     * @param {Object} [options] - Optional conversion options
     * @param {string} [options.orgUrl] - Organization URL for Web API URL format
     * @returns {string} The converted output
     * @throws {Error} When XML is invalid or format is unknown
     * @static
     */
    static convert(fetchXml, format, options = {}) {
        const parsed = FetchXmlConverterService._parse(fetchXml);

        const converters = {
            csharp: () => FetchXmlConverterService._toCSharp(parsed, fetchXml),
            javascript: () => FetchXmlConverterService._toJavaScript(parsed),
            odata: () => FetchXmlConverterService._toOData(parsed, options),
            sql: () => FetchXmlConverterService._toSQL(parsed),
            powerautomate: () => FetchXmlConverterService._toPowerAutomate(fetchXml),
            webapiurl: () => FetchXmlConverterService._toWebApiUrl(parsed, fetchXml, options)
        };

        const converter = converters[format];
        if (!converter) {
            throw new Error(`Unknown format: ${format}`);
        }

        return converter();
    }

    /**
     * Get available conversion formats with labels.
     * @returns {Array<{id: string, label: string}>}
     * @static
     */
    static getFormats() {
        return [
            { id: 'csharp', label: 'C# QueryExpression' },
            { id: 'javascript', label: 'JavaScript Xrm' },
            { id: 'odata', label: 'OData' },
            { id: 'sql', label: 'SQL' },
            { id: 'powerautomate', label: 'Power Automate' },
            { id: 'webapiurl', label: 'Web API URL' }
        ];
    }

    // ═══════════════════════════════════════════════════════════
    // XML PARSER
    // ═══════════════════════════════════════════════════════════

    /**
     * Parse FetchXML string into a structured object.
     * @param {string} fetchXml - Raw FetchXML string
     * @returns {FetchXmlParsed}
     * @throws {Error} When XML is malformed
     * @private
     * @static
     */
    static _parse(fetchXml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(fetchXml, 'text/xml');

        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error('Invalid FetchXML: ' + parseError.textContent.substring(0, 100));
        }

        const fetchEl = doc.querySelector('fetch');
        if (!fetchEl) {
            throw new Error('No <fetch> element found.');
        }

        const entityEl = fetchEl.querySelector('entity');
        if (!entityEl) {
            throw new Error('No <entity> element found.');
        }

        const entityName = entityEl.getAttribute('name') || '';
        const top = fetchEl.getAttribute('top') ? parseInt(fetchEl.getAttribute('top'), 10) : null;
        const aggregate = fetchEl.getAttribute('aggregate') === 'true';
        const distinct = fetchEl.getAttribute('distinct') === 'true';

        // Attributes (direct children only)
        const allAttrEl = FetchXmlConverterService._directChildren(entityEl, 'all-attributes');
        const allAttributes = allAttrEl.length > 0;
        const attrEls = FetchXmlConverterService._directChildren(entityEl, 'attribute');

        const attributes = [];
        const aggregateAttributes = [];
        const groupByAttributes = [];

        attrEls.forEach(a => {
            const name = a.getAttribute('name') || '';
            const alias = a.getAttribute('alias') || '';
            const aggregateFn = a.getAttribute('aggregate') || '';
            const groupby = a.getAttribute('groupby') === 'true';
            const dategrouping = a.getAttribute('dategrouping') || '';

            if (aggregateFn) {
                aggregateAttributes.push({ name, alias, aggregate: aggregateFn });
            } else if (groupby) {
                groupByAttributes.push({ name, alias, dategrouping });
            } else {
                attributes.push(name);
            }
        });

        // Order
        const orderEls = FetchXmlConverterService._directChildren(entityEl, 'order');
        const orders = orderEls.map(o => ({
            attribute: o.getAttribute('attribute') || o.getAttribute('alias') || '',
            descending: o.getAttribute('descending') === 'true',
            alias: o.getAttribute('alias') || ''
        }));

        // Filters
        const filterEls = FetchXmlConverterService._directChildren(entityEl, 'filter');
        const filters = filterEls.map(f => FetchXmlConverterService._parseFilter(f));

        // Link entities
        const linkEls = FetchXmlConverterService._directChildren(entityEl, 'link-entity');
        const linkEntities = linkEls.map(l => FetchXmlConverterService._parseLinkEntity(l));

        return {
            entityName,
            attributes,
            allAttributes,
            orders,
            top,
            aggregate,
            distinct,
            filters,
            linkEntities,
            aggregateAttributes,
            groupByAttributes
        };
    }

    /**
     * Get direct child elements with a specific tag name.
     * @param {Element} parent - Parent element
     * @param {string} tagName - Tag name to find
     * @returns {Element[]}
     * @private
     * @static
     */
    static _directChildren(parent, tagName) {
        return Array.from(parent.children).filter(
            c => c.tagName.toLowerCase() === tagName.toLowerCase()
        );
    }

    /**
     * Parse a <filter> element recursively.
     * @param {Element} filterEl - The filter element
     * @returns {Object} Parsed filter with type and conditions
     * @private
     * @static
     */
    static _parseFilter(filterEl) {
        const type = filterEl.getAttribute('type') || 'and';
        const conditions = [];
        const nestedFilters = [];

        Array.from(filterEl.children).forEach(child => {
            if (child.tagName.toLowerCase() === 'condition') {
                conditions.push({
                    attribute: child.getAttribute('attribute') || '',
                    operator: child.getAttribute('operator') || 'eq',
                    value: child.getAttribute('value') ?? '',
                    entityname: child.getAttribute('entityname') || '',
                    values: Array.from(child.querySelectorAll('value')).map(v => v.textContent)
                });
            } else if (child.tagName.toLowerCase() === 'filter') {
                nestedFilters.push(FetchXmlConverterService._parseFilter(child));
            }
        });

        return { type, conditions, nestedFilters };
    }

    /**
     * Parse a <link-entity> element.
     * @param {Element} linkEl - The link-entity element
     * @returns {Object} Parsed link entity
     * @private
     * @static
     */
    static _parseLinkEntity(linkEl) {
        const name = linkEl.getAttribute('name') || '';
        const from = linkEl.getAttribute('from') || '';
        const to = linkEl.getAttribute('to') || '';
        const linkType = linkEl.getAttribute('link-type') || 'inner';
        const alias = linkEl.getAttribute('alias') || '';

        const attrEls = FetchXmlConverterService._directChildren(linkEl, 'attribute');
        const attributes = attrEls.map(a => a.getAttribute('name') || '');

        const filterEls = FetchXmlConverterService._directChildren(linkEl, 'filter');
        const filters = filterEls.map(f => FetchXmlConverterService._parseFilter(f));

        const nestedLinks = FetchXmlConverterService._directChildren(linkEl, 'link-entity')
            .map(l => FetchXmlConverterService._parseLinkEntity(l));

        return { name, from, to, linkType, alias, attributes, filters, nestedLinks };
    }

    // ═══════════════════════════════════════════════════════════
    // C# QueryExpression
    // ═══════════════════════════════════════════════════════════

    /**
     * Convert parsed FetchXML to C# QueryExpression code.
     * Falls back to FetchExpression for aggregate queries.
     * @param {FetchXmlParsed} parsed
     * @param {string} fetchXml - Raw FetchXML string (used for aggregate fallback)
     * @returns {string}
     * @private
     * @static
     */
    static _toCSharp(parsed, fetchXml) {
        // Aggregate queries require FetchExpression (QueryExpression doesn't support aggregation)
        if (parsed.aggregate) {
            return FetchXmlConverterService._toAggregateCSharp(fetchXml);
        }

        const lines = [];
        lines.push('// C# QueryExpression');
        lines.push(`var query = new QueryExpression("${parsed.entityName}");`);

        if (parsed.allAttributes) {
            lines.push('query.ColumnSet = new ColumnSet(true);');
        } else if (parsed.attributes.length > 0) {
            const cols = parsed.attributes.map(a => `"${a}"`).join(', ');
            lines.push(`query.ColumnSet = new ColumnSet(${cols});`);
        } else {
            lines.push('query.ColumnSet = new ColumnSet(false);');
        }

        if (parsed.distinct) {
            lines.push('query.Distinct = true;');
        }

        if (parsed.top) {
            lines.push(`query.TopCount = ${parsed.top};`);
        }

        // Orders
        if (parsed.orders?.length > 0) {
            parsed.orders.forEach(o => {
                const dir = o.descending ? 'OrderType.Descending' : 'OrderType.Ascending';
                lines.push(`query.AddOrder("${o.attribute}", ${dir});`);
            });
        }

        // Filters
        if (parsed.filters.length > 0) {
            parsed.filters.forEach(f => {
                lines.push('');
                lines.push(...FetchXmlConverterService._filterToCSharp(f, 'query.Criteria'));
            });
        }

        // Link entities
        parsed.linkEntities.forEach(link => {
            lines.push('');
            lines.push(...FetchXmlConverterService._linkEntityToCSharp(link, 'query'));
        });

        lines.push('');
        lines.push('var result = service.RetrieveMultiple(query);');

        return lines.join('\n');
    }

    /**
     * Convert a filter object to C# FilterExpression lines.
     * @param {Object} filter - Parsed filter
     * @param {string} parentVar - Parent criteria variable name (e.g. 'query.Criteria', 'link.LinkCriteria', or a variable name)
     * @returns {string[]}
     * @private
     * @static
     */
    static _filterToCSharp(filter, parentVar) {
        const lines = [];
        const logicalOp = filter.type === 'or' ? 'LogicalOperator.Or' : 'LogicalOperator.And';

        // Property paths (query.Criteria, link.LinkCriteria) are existing objects — set their operator.
        // Plain variable names need to be declared as new FilterExpression.
        const isProperty = parentVar.includes('.');
        if (isProperty) {
            lines.push(`${parentVar}.FilterOperator = ${logicalOp};`);
        } else {
            lines.push(`var ${parentVar} = new FilterExpression(${logicalOp});`);
        }

        filter.conditions.forEach(c => {
            const op = FetchXmlConverterService._fetchOpToCSharpOp(c.operator);
            if (c.values.length > 0) {
                const vals = c.values.map(v => `"${v}"`).join(', ');
                lines.push(`${parentVar}.AddCondition("${c.attribute}", ${op}, ${vals});`);
            } else if (c.value !== '') {
                lines.push(`${parentVar}.AddCondition("${c.attribute}", ${op}, "${c.value}");`);
            } else {
                lines.push(`${parentVar}.AddCondition("${c.attribute}", ${op});`);
            }
        });

        filter.nestedFilters.forEach((nf, i) => {
            // Create a safe variable name by replacing dots/non-alphanumerics
            const cleanBase = parentVar.replace(/[^a-zA-Z0-9_]/g, '_');
            const nestedVar = `${cleanBase}_nested${i}`;
            lines.push(...FetchXmlConverterService._filterToCSharp(nf, nestedVar));
            lines.push(`${parentVar}.AddFilter(${nestedVar});`);
        });

        return lines;
    }

    /**
     * Convert a link entity to C# LinkEntity lines.
     * @param {Object} link - Parsed link entity
     * @param {string} parentVar - Parent query variable name
     * @returns {string[]}
     * @private
     * @static
     */
    static _linkEntityToCSharp(link, parentVar) {
        const lines = [];
        const varName = link.alias || link.name;
        const safe = varName.replace(/[^a-zA-Z0-9_]/g, '_');
        const joinOp = FetchXmlConverterService._linkTypeToCSharpJoin(link.linkType);

        lines.push(`var ${safe}Link = ${parentVar}.AddLink("${link.name}", "${link.to}", "${link.from}", ${joinOp});`);

        if (link.alias) {
            lines.push(`${safe}Link.EntityAlias = "${link.alias}";`);
        }

        if (link.attributes.length > 0) {
            const cols = link.attributes.map(a => `"${a}"`).join(', ');
            lines.push(`${safe}Link.Columns = new ColumnSet(${cols});`);
        }

        link.filters.forEach(f => {
            lines.push(...FetchXmlConverterService._filterToCSharp(f, `${safe}Link.LinkCriteria`));
        });

        link.nestedLinks.forEach(nl => {
            lines.push(...FetchXmlConverterService._linkEntityToCSharp(nl, `${safe}Link`));
        });

        return lines;
    }

    /**
     * Map FetchXML operator to ConditionOperator enum.
     * @param {string} op - FetchXML operator
     * @returns {string} C# ConditionOperator
     * @private
     * @static
     */
    static _fetchOpToCSharpOp(op) {
        const map = {
            'eq': 'ConditionOperator.Equal',
            'ne': 'ConditionOperator.NotEqual',
            'neq': 'ConditionOperator.NotEqual',
            'gt': 'ConditionOperator.GreaterThan',
            'ge': 'ConditionOperator.GreaterEqual',
            'lt': 'ConditionOperator.LessThan',
            'le': 'ConditionOperator.LessEqual',
            'like': 'ConditionOperator.Like',
            'not-like': 'ConditionOperator.NotLike',
            'in': 'ConditionOperator.In',
            'not-in': 'ConditionOperator.NotIn',
            'between': 'ConditionOperator.Between',
            'not-between': 'ConditionOperator.NotBetween',
            'null': 'ConditionOperator.Null',
            'not-null': 'ConditionOperator.NotNull',
            'above': 'ConditionOperator.Above',
            'under': 'ConditionOperator.Under',
            'begins-with': 'ConditionOperator.BeginsWith',
            'not-begin-with': 'ConditionOperator.DoesNotBeginWith',
            'ends-with': 'ConditionOperator.EndsWith',
            'not-end-with': 'ConditionOperator.DoesNotEndWith',
            'contains': 'ConditionOperator.Contains',
            'not-contain': 'ConditionOperator.DoesNotContain',
            'on': 'ConditionOperator.On',
            'on-or-before': 'ConditionOperator.OnOrBefore',
            'on-or-after': 'ConditionOperator.OnOrAfter',
            'today': 'ConditionOperator.Today',
            'yesterday': 'ConditionOperator.Yesterday',
            'tomorrow': 'ConditionOperator.Tomorrow',
            'last-x-days': 'ConditionOperator.LastXDays',
            'next-x-days': 'ConditionOperator.NextXDays',
            'last-x-hours': 'ConditionOperator.LastXHours',
            'next-x-hours': 'ConditionOperator.NextXHours',
            'this-month': 'ConditionOperator.ThisMonth',
            'this-year': 'ConditionOperator.ThisYear',
            'last-month': 'ConditionOperator.LastMonth',
            'last-year': 'ConditionOperator.LastYear',
            'eq-userid': 'ConditionOperator.EqualUserId',
            'ne-userid': 'ConditionOperator.NotEqualUserId',
            'eq-businessid': 'ConditionOperator.EqualBusinessId',
            'ne-businessid': 'ConditionOperator.NotEqualBusinessId',
            'contain-values': 'ConditionOperator.ContainValues',
            'not-contain-values': 'ConditionOperator.DoesNotContainValues'
        };
        return map[op] || `ConditionOperator.Equal /* unmapped: ${op} */`;
    }

    /**
     * Map link-type to JoinOperator enum.
     * @param {string} linkType - FetchXML link-type
     * @returns {string} C# JoinOperator
     * @private
     * @static
     */
    static _linkTypeToCSharpJoin(linkType) {
        const map = {
            'inner': 'JoinOperator.Inner',
            'outer': 'JoinOperator.LeftOuter',
            'natural': 'JoinOperator.Natural',
            'exists': 'JoinOperator.Exists',
            'in': 'JoinOperator.In',
            'matchfirstrowusingcrossapply': 'JoinOperator.MatchFirstRowUsingCrossApply'
        };
        return map[linkType] || 'JoinOperator.Inner';
    }

    /**
     * Generate C# code for aggregate queries using FetchExpression.
     * QueryExpression does not support aggregation.
     * @param {string} fetchXml - Raw FetchXML string
     * @returns {string}
     * @private
     * @static
     */
    static _toAggregateCSharp(fetchXml) {
        const escaped = fetchXml.trim().replace(/"/g, '""');
        const lines = [];
        lines.push('// Aggregate queries require FetchExpression (QueryExpression does not support aggregation)');
        lines.push('// Use verbatim string for readability');
        lines.push(`var fetchXml = @"${escaped}";`);
        lines.push('');
        lines.push('var result = service.RetrieveMultiple(new FetchExpression(fetchXml));');
        lines.push('');
        lines.push('// Access aggregate results:');
        lines.push('foreach (var entity in result.Entities)');
        lines.push('{');
        lines.push('    // entity.GetAttributeValue<AliasedValue>("AliasName").Value');
        lines.push('}');
        return lines.join('\n');
    }

    // ═══════════════════════════════════════════════════════════
    // JavaScript Xrm
    // ═══════════════════════════════════════════════════════════

    /**
     * Convert parsed FetchXML to JavaScript Xrm.WebApi code.
     * @param {FetchXmlParsed} parsed
     * @returns {string}
     * @private
     * @static
     */
    static _toJavaScript(parsed) {
        const lines = [];
        lines.push('// JavaScript - Xrm.WebApi');

        if (parsed.aggregate || parsed.linkEntities.length > 0) {
            // For complex queries, use FetchXML directly via Xrm.WebApi
            lines.push(`const fetchXml = \`<fetch${parsed.aggregate ? ' aggregate="true"' : ''}${parsed.top ? ` top="${parsed.top}"` : ''}>`);
            lines.push(`  <entity name="${parsed.entityName}">`);

            if (parsed.aggregate) {
                parsed.aggregateAttributes.forEach(a => {
                    lines.push(`    <attribute name="${a.name}" alias="${a.alias}" aggregate="${a.aggregate}" />`);
                });
                parsed.groupByAttributes.forEach(a => {
                    const dg = a.dategrouping ? ` dategrouping="${a.dategrouping}"` : '';
                    lines.push(`    <attribute name="${a.name}" alias="${a.alias}" groupby="true"${dg} />`);
                });
            } else {
                if (parsed.allAttributes) {
                    lines.push('    <all-attributes />');
                } else {
                    parsed.attributes.forEach(a => {
                        lines.push(`    <attribute name="${a}" />`);
                    });
                }
            }

            parsed.orders.forEach(o => {
                const desc = o.descending ? ' descending="true"' : '';
                const attrOrAlias = o.alias ? `alias="${o.alias}"` : `attribute="${o.attribute}"`;
                lines.push(`    <order ${attrOrAlias}${desc} />`);
            });

            parsed.filters.forEach(f => {
                lines.push(...FetchXmlConverterService._filterToXmlLines(f, '    '));
            });

            parsed.linkEntities.forEach(l => {
                lines.push(...FetchXmlConverterService._linkEntityToXmlLines(l, '    '));
            });

            lines.push('  </entity>');
            lines.push('</fetch>\`;');
            lines.push('');
            lines.push('const result = await Xrm.WebApi.retrieveMultipleRecords(');
            lines.push(`  '${parsed.entityName}',`);
            lines.push('  `?fetchXml=${encodeURIComponent(fetchXml)}`');
            lines.push(');');
        } else {
            // Simple query using OData options
            const options = FetchXmlConverterService._buildODataOptions(parsed);
            lines.push('const result = await Xrm.WebApi.retrieveMultipleRecords(');
            lines.push(`  '${parsed.entityName}',`);
            lines.push(`  '${options}'`);
            lines.push(');');
        }

        lines.push('');
        lines.push('console.log(`Retrieved ${result.entities.length} records`);');
        lines.push('result.entities.forEach(record => {');
        lines.push('  console.log(record);');
        lines.push('});');

        return lines.join('\n');
    }

    /**
     * Serialize a filter back to FetchXML lines (for JS template literal).
     * @param {Object} filter - Parsed filter
     * @param {string} indent - Current indentation
     * @returns {string[]}
     * @private
     * @static
     */
    static _filterToXmlLines(filter, indent) {
        const lines = [];
        lines.push(`${indent}<filter type="${filter.type}">`);

        filter.conditions.forEach(c => {
            const entityAttr = c.entityname ? ` entityname="${c.entityname}"` : '';
            if (c.values.length > 0) {
                lines.push(`${indent}  <condition attribute="${c.attribute}" operator="${c.operator}"${entityAttr}>`);
                c.values.forEach(v => {
                    lines.push(`${indent}    <value>${v}</value>`);
                });
                lines.push(`${indent}  </condition>`);
            } else {
                const valAttr = c.value !== '' ? ` value="${c.value}"` : '';
                lines.push(`${indent}  <condition attribute="${c.attribute}" operator="${c.operator}"${valAttr}${entityAttr} />`);
            }
        });

        filter.nestedFilters.forEach(nf => {
            lines.push(...FetchXmlConverterService._filterToXmlLines(nf, indent + '  '));
        });

        lines.push(`${indent}</filter>`);
        return lines;
    }

    /**
     * Serialize a link-entity back to FetchXML lines.
     * @param {Object} link - Parsed link entity
     * @param {string} indent - Current indentation
     * @returns {string[]}
     * @private
     * @static
     */
    static _linkEntityToXmlLines(link, indent) {
        const lines = [];
        const aliasAttr = link.alias ? ` alias="${link.alias}"` : '';
        lines.push(`${indent}<link-entity name="${link.name}" from="${link.from}" to="${link.to}" link-type="${link.linkType}"${aliasAttr}>`);

        link.attributes.forEach(a => {
            lines.push(`${indent}  <attribute name="${a}" />`);
        });

        link.filters.forEach(f => {
            lines.push(...FetchXmlConverterService._filterToXmlLines(f, indent + '  '));
        });

        link.nestedLinks.forEach(nl => {
            lines.push(...FetchXmlConverterService._linkEntityToXmlLines(nl, indent + '  '));
        });

        lines.push(`${indent}</link-entity>`);
        return lines;
    }

    // ═══════════════════════════════════════════════════════════
    // OData
    // ═══════════════════════════════════════════════════════════

    /**
     * Convert parsed FetchXML to OData query string.
     * @param {FetchXmlParsed} parsed
     * @returns {string}
     * @private
     * @static
     */
    static _toOData(parsed, convOptions = {}) {
        const orgUrl = convOptions.orgUrl || '{org-url}';
        const hasRealUrl = orgUrl !== '{org-url}';

        if (parsed.aggregate) {
            return `// Aggregate queries are not directly supported in OData.\n// Use FetchXML via Web API instead:\n// GET ${orgUrl}/api/data/v9.2/${parsed.entityName}s?fetchXml={encodedFetchXml}`;
        }

        const lines = [];
        lines.push(`// OData query for ${parsed.entityName}`);
        lines.push(`// GET ${orgUrl}/api/data/v9.2/${parsed.entityName}s`);
        if (!hasRealUrl) {
            lines.push('// Replace {org-url} with your environment URL');
        }
        lines.push('');

        const options = FetchXmlConverterService._buildODataOptions(parsed);
        lines.push(options || '// No query options');

        return lines.join('\n');
    }

    /**
     * Build OData query options string.
     * @param {FetchXmlParsed} parsed
     * @returns {string}
     * @private
     * @static
     */
    static _buildODataOptions(parsed) {
        const parts = [];

        if (parsed.attributes.length > 0 && !parsed.allAttributes) {
            parts.push(`$select=${parsed.attributes.join(',')}`);
        }

        if (parsed.filters.length > 0) {
            const filterStr = parsed.filters
                .map(f => FetchXmlConverterService._filterToOData(f))
                .filter(Boolean)
                .join(' and ');
            if (filterStr) {
                parts.push(`$filter=${filterStr}`);
            }
        }

        if (parsed.orders?.length > 0) {
            const orderStr = parsed.orders
                .map(o => `${o.attribute} ${o.descending ? 'desc' : 'asc'}`)
                .join(',');
            parts.push(`$orderby=${orderStr}`);
        }

        if (parsed.top) {
            parts.push(`$top=${parsed.top}`);
        }

        // Note: $expand requires navigation property names, not entity names.
        // The names below are the entity names — replace with the actual
        // navigation property (relationship schema name) from metadata.
        if (parsed.linkEntities.length > 0) {
            const expands = parsed.linkEntities
                .filter(l => l.linkType === 'inner' || l.linkType === 'outer')
                .map(l => {
                    const selectPart = l.attributes.length > 0
                        ? `($select=${l.attributes.join(',')})`
                        : '';
                    return `${l.name}${selectPart}`;
                });
            if (expands.length > 0) {
                parts.push(`$expand=${expands.join(',')}`);
            }
        }

        return parts.length > 0 ? `?${parts.join('&')}` : '';
    }

    /**
     * Convert a filter to OData $filter string.
     * @param {Object} filter - Parsed filter
     * @returns {string}
     * @private
     * @static
     */
    static _filterToOData(filter) {
        const parts = [];

        filter.conditions.forEach(c => {
            const clause = FetchXmlConverterService._conditionToOData(c);
            if (clause) {
                parts.push(clause);
            }
        });

        filter.nestedFilters.forEach(nf => {
            const nested = FetchXmlConverterService._filterToOData(nf);
            if (nested) {
                parts.push(`(${nested})`);
            }
        });

        const joiner = filter.type === 'or' ? ' or ' : ' and ';
        return parts.join(joiner);
    }

    /**
     * Convert a single condition to OData syntax.
     * Uses smart value formatting (numbers, GUIDs, booleans are unquoted).
     * @param {Object} cond - Condition object
     * @returns {string}
     * @private
     * @static
     */
    static _conditionToOData(cond) {
        const a = cond.attribute;
        const v = cond.value;
        const fv = FetchXmlConverterService._formatODataValue(v);
        const map = {
            'eq': () => `${a} eq ${fv}`,
            'ne': () => `${a} ne ${fv}`,
            'neq': () => `${a} ne ${fv}`,
            'gt': () => `${a} gt ${fv}`,
            'ge': () => `${a} ge ${fv}`,
            'lt': () => `${a} lt ${fv}`,
            'le': () => `${a} le ${fv}`,
            'like': () => `contains(${a},'${v.replace(/%/g, '')}')`,
            'not-like': () => `not contains(${a},'${v.replace(/%/g, '')}')`,
            'begins-with': () => `startswith(${a},'${v}')`,
            'ends-with': () => `endswith(${a},'${v}')`,
            'contains': () => `contains(${a},'${v}')`,
            'not-contain': () => `not contains(${a},'${v}')`,
            'null': () => `${a} eq null`,
            'not-null': () => `${a} ne null`,
            'in': () => {
                const vals = cond.values.length > 0 ? cond.values : [v];
                return `Microsoft.Dynamics.CRM.In(PropertyName='${a}',PropertyValues=[${vals.map(x => `'${x}'`).join(',')}])`;
            },
            'not-in': () => {
                const vals = cond.values.length > 0 ? cond.values : [v];
                return `not Microsoft.Dynamics.CRM.In(PropertyName='${a}',PropertyValues=[${vals.map(x => `'${x}'`).join(',')}])`;
            },
            'between': () => {
                const vals = cond.values.length >= 2 ? cond.values : [v, v];
                const fv0 = FetchXmlConverterService._formatODataValue(vals[0]);
                const fv1 = FetchXmlConverterService._formatODataValue(vals[1]);
                return `(${a} ge ${fv0} and ${a} le ${fv1})`;
            },
            'not-between': () => {
                const vals = cond.values.length >= 2 ? cond.values : [v, v];
                const fv0 = FetchXmlConverterService._formatODataValue(vals[0]);
                const fv1 = FetchXmlConverterService._formatODataValue(vals[1]);
                return `(${a} lt ${fv0} or ${a} gt ${fv1})`;
            },
            'on': () => `${a} eq ${v}`,
            'on-or-before': () => `${a} le ${v}`,
            'on-or-after': () => `${a} ge ${v}`,
            'above': () => `Microsoft.Dynamics.CRM.Above(PropertyName='${a}',PropertyValue=${fv})`,
            'under': () => `Microsoft.Dynamics.CRM.Under(PropertyName='${a}',PropertyValue=${fv})`,
            'today': () => `Microsoft.Dynamics.CRM.Today(PropertyName='${a}')`,
            'yesterday': () => `Microsoft.Dynamics.CRM.Yesterday(PropertyName='${a}')`,
            'tomorrow': () => `Microsoft.Dynamics.CRM.Tomorrow(PropertyName='${a}')`,
            'last-x-days': () => `Microsoft.Dynamics.CRM.LastXDays(PropertyName='${a}',PropertyValue=${v})`,
            'next-x-days': () => `Microsoft.Dynamics.CRM.NextXDays(PropertyName='${a}',PropertyValue=${v})`,
            'last-x-hours': () => `Microsoft.Dynamics.CRM.LastXHours(PropertyName='${a}',PropertyValue=${v})`,
            'next-x-hours': () => `Microsoft.Dynamics.CRM.NextXHours(PropertyName='${a}',PropertyValue=${v})`,
            'this-month': () => `Microsoft.Dynamics.CRM.ThisMonth(PropertyName='${a}')`,
            'this-year': () => `Microsoft.Dynamics.CRM.ThisYear(PropertyName='${a}')`,
            'last-month': () => `Microsoft.Dynamics.CRM.LastMonth(PropertyName='${a}')`,
            'last-year': () => `Microsoft.Dynamics.CRM.LastYear(PropertyName='${a}')`,
            'eq-userid': () => `Microsoft.Dynamics.CRM.EqualUserId(PropertyName='${a}')`,
            'ne-userid': () => `Microsoft.Dynamics.CRM.NotEqualUserId(PropertyName='${a}')`,
            'eq-businessid': () => `Microsoft.Dynamics.CRM.EqualBusinessId(PropertyName='${a}')`,
            'ne-businessid': () => `Microsoft.Dynamics.CRM.NotEqualBusinessId(PropertyName='${a}')`
        };

        const fn = map[cond.operator];
        return fn ? fn() : `${a} eq ${fv} /* unmapped operator: ${cond.operator} */`;
    }

    /**
     * Format a value for OData based on content detection.
     * Numbers, GUIDs, and booleans are unquoted; strings are single-quoted.
     * @param {string} value - The raw value string
     * @returns {string} Formatted OData value
     * @private
     * @static
     */
    static _formatODataValue(value) {
        if (value === null || value === undefined || value === '') {
            return "''";
        }
        // Boolean
        if (value === 'true' || value === 'false') {
            return value;
        }
        // Integer
        if (/^-?\d+$/.test(value)) {
            return value;
        }
        // Decimal
        if (/^-?\d+\.\d+$/.test(value)) {
            return value;
        }
        // GUID
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
            return value;
        }
        // String — single-quoted
        return `'${value}'`;
    }

    // ═══════════════════════════════════════════════════════════
    // SQL
    // ═══════════════════════════════════════════════════════════

    /**
     * Convert parsed FetchXML to SQL-like representation.
     * @param {FetchXmlParsed} parsed
     * @returns {string}
     * @private
     * @static
     */
    static _toSQL(parsed) {
        const lines = [];
        lines.push('-- SQL representation (Dataverse T-SQL)');

        // SELECT
        let selectPart;
        if (parsed.aggregate) {
            const aggCols = parsed.aggregateAttributes.map(a =>
                `${a.aggregate.toUpperCase()}(${a.name}) AS [${a.alias}]`
            );
            const groupCols = parsed.groupByAttributes.map(a => {
                if (a.dategrouping) {
                    return `DATEPART(${a.dategrouping}, ${a.name}) AS [${a.alias}]`;
                }
                return `${a.name} AS [${a.alias}]`;
            });
            selectPart = [...aggCols, ...groupCols].join(',\n       ');
        } else if (parsed.allAttributes) {
            selectPart = '*';
        } else if (parsed.attributes.length > 0) {
            selectPart = parsed.attributes.join(', ');
        } else {
            selectPart = '*';
        }

        const topClause = parsed.top && !parsed.aggregate ? `TOP ${parsed.top} ` : '';
        const distinctClause = parsed.distinct ? 'DISTINCT ' : '';
        lines.push(`SELECT ${distinctClause}${topClause}${selectPart}`);

        // FROM
        lines.push(`FROM ${parsed.entityName}`);

        // JOINs
        parsed.linkEntities.forEach(link => {
            lines.push(...FetchXmlConverterService._linkEntityToSQL(link, parsed.entityName));
        });

        // WHERE
        if (parsed.filters.length > 0) {
            const whereStr = parsed.filters
                .map(f => FetchXmlConverterService._filterToSQL(f))
                .filter(Boolean)
                .join(' AND ');
            if (whereStr) {
                lines.push(`WHERE ${whereStr}`);
            }
        }

        // GROUP BY
        if (parsed.aggregate && parsed.groupByAttributes.length > 0) {
            const groupCols = parsed.groupByAttributes.map(a => {
                if (a.dategrouping) {
                    return `DATEPART(${a.dategrouping}, ${a.name})`;
                }
                return a.name;
            });
            lines.push(`GROUP BY ${groupCols.join(', ')}`);
        }

        // ORDER BY
        if (parsed.orders?.length > 0) {
            const orderParts = parsed.orders.map(o =>
                `${o.alias || o.attribute} ${o.descending ? 'DESC' : 'ASC'}`
            );
            lines.push(`ORDER BY ${orderParts.join(', ')}`);
        }

        return lines.join('\n');
    }

    /**
     * Convert link entity to SQL JOIN clause.
     * @param {Object} link - Parsed link entity
     * @param {string} parentEntity - Parent entity name or alias for the ON clause
     * @returns {string[]}
     * @private
     * @static
     */
    static _linkEntityToSQL(link, parentEntity) {
        const lines = [];
        const joinType = FetchXmlConverterService._linkTypeToSQLJoin(link.linkType);
        const aliasStr = link.alias ? ` AS ${link.alias}` : '';
        const linkRef = link.alias || link.name;
        lines.push(`${joinType} ${link.name}${aliasStr} ON ${linkRef}.${link.from} = ${parentEntity}.${link.to}`);

        link.filters.forEach(f => {
            const filterStr = FetchXmlConverterService._filterToSQL(f);
            if (filterStr) {
                lines.push(`  AND ${filterStr}`);
            }
        });

        link.nestedLinks.forEach(nl => {
            lines.push(...FetchXmlConverterService._linkEntityToSQL(nl, linkRef));
        });

        return lines;
    }

    /**
     * Convert filter to SQL WHERE clause.
     * @param {Object} filter - Parsed filter
     * @returns {string}
     * @private
     * @static
     */
    static _filterToSQL(filter) {
        const parts = [];

        filter.conditions.forEach(c => {
            parts.push(FetchXmlConverterService._conditionToSQL(c));
        });

        filter.nestedFilters.forEach(nf => {
            const nested = FetchXmlConverterService._filterToSQL(nf);
            if (nested) {
                parts.push(`(${nested})`);
            }
        });

        const joiner = filter.type === 'or' ? ' OR ' : ' AND ';
        return parts.filter(Boolean).join(joiner);
    }

    /**
     * Convert a single condition to SQL.
     * @param {Object} cond - Condition object
     * @returns {string}
     * @private
     * @static
     */
    static _conditionToSQL(cond) {
        const a = cond.attribute;
        const v = cond.value;
        const map = {
            'eq': () => `${a} = '${v}'`,
            'ne': () => `${a} <> '${v}'`,
            'neq': () => `${a} <> '${v}'`,
            'gt': () => `${a} > '${v}'`,
            'ge': () => `${a} >= '${v}'`,
            'lt': () => `${a} < '${v}'`,
            'le': () => `${a} <= '${v}'`,
            'like': () => `${a} LIKE '${v}'`,
            'not-like': () => `${a} NOT LIKE '${v}'`,
            'begins-with': () => `${a} LIKE '${v}%'`,
            'ends-with': () => `${a} LIKE '%${v}'`,
            'contains': () => `${a} LIKE '%${v}%'`,
            'not-contain': () => `${a} NOT LIKE '%${v}%'`,
            'null': () => `${a} IS NULL`,
            'not-null': () => `${a} IS NOT NULL`,
            'in': () => {
                const vals = cond.values.length > 0 ? cond.values : [v];
                return `${a} IN (${vals.map(x => `'${x}'`).join(', ')})`;
            },
            'not-in': () => {
                const vals = cond.values.length > 0 ? cond.values : [v];
                return `${a} NOT IN (${vals.map(x => `'${x}'`).join(', ')})`;
            },
            'between': () => {
                const vals = cond.values.length >= 2 ? cond.values : [v, v];
                return `${a} BETWEEN '${vals[0]}' AND '${vals[1]}'`;
            },
            'not-between': () => {
                const vals = cond.values.length >= 2 ? cond.values : [v, v];
                return `${a} NOT BETWEEN '${vals[0]}' AND '${vals[1]}'`;
            },
            'on': () => `CAST(${a} AS DATE) = '${v}'`,
            'on-or-before': () => `${a} <= '${v}'`,
            'on-or-after': () => `${a} >= '${v}'`,
            'today': () => `CAST(${a} AS DATE) = CAST(GETDATE() AS DATE)`,
            'yesterday': () => `CAST(${a} AS DATE) = CAST(DATEADD(day, -1, GETDATE()) AS DATE)`,
            'this-month': () => `MONTH(${a}) = MONTH(GETDATE()) AND YEAR(${a}) = YEAR(GETDATE())`,
            'this-year': () => `YEAR(${a}) = YEAR(GETDATE())`,
            'last-month': () => `MONTH(${a}) = MONTH(DATEADD(month, -1, GETDATE())) AND YEAR(${a}) = YEAR(DATEADD(month, -1, GETDATE()))`,
            'last-year': () => `YEAR(${a}) = YEAR(DATEADD(year, -1, GETDATE()))`,
            'last-x-days': () => `${a} >= DATEADD(day, -${v}, GETDATE())`,
            'next-x-days': () => `${a} <= DATEADD(day, ${v}, GETDATE())`,
            'last-x-hours': () => `${a} >= DATEADD(hour, -${v}, GETDATE())`,
            'next-x-hours': () => `${a} <= DATEADD(hour, ${v}, GETDATE())`,
            'eq-userid': () => `${a} = @CurrentUserId`,
            'ne-userid': () => `${a} <> @CurrentUserId`,
            'eq-businessid': () => `${a} = @CurrentBusinessUnitId`,
            'ne-businessid': () => `${a} <> @CurrentBusinessUnitId`
        };

        const fn = map[cond.operator];
        return fn ? fn() : `${a} = '${v}' /* unmapped: ${cond.operator} */`;
    }

    /**
     * Map link-type to SQL JOIN keyword.
     * @param {string} linkType
     * @returns {string}
     * @private
     * @static
     */
    static _linkTypeToSQLJoin(linkType) {
        const map = {
            'inner': 'INNER JOIN',
            'outer': 'LEFT OUTER JOIN',
            'exists': 'CROSS APPLY',
            'in': 'INNER JOIN',
            'natural': 'NATURAL JOIN'
        };
        return map[linkType] || 'INNER JOIN';
    }

    // ═══════════════════════════════════════════════════════════
    // Power Automate
    // ═══════════════════════════════════════════════════════════

    /**
     * Convert FetchXML to Power Automate "List rows" action format.
     * @param {string} fetchXml - Raw FetchXML
     * @returns {string}
     * @private
     * @static
     */
    static _toPowerAutomate(fetchXml) {
        const parsed = FetchXmlConverterService._parse(fetchXml);
        const lines = [];

        lines.push('// Power Automate - "List rows" action configuration');
        lines.push('// ================================================');
        lines.push('');
        lines.push('// 1. Use the "List rows" action from the Dataverse connector');
        lines.push(`// 2. Table name: ${parsed.entityName}`);
        lines.push('// 3. In "Advanced parameters", set "Fetch Xml Query" to:');
        lines.push('');

        // Clean up/normalize the FetchXML for Power Automate
        const cleanXml = fetchXml.trim().replace(/\n\s*/g, '\n');
        lines.push(cleanXml);
        lines.push('');
        lines.push('// ================================================');
        lines.push('// Power Automate Expression (for dynamic content):');
        // eslint-disable-next-line quotes
        lines.push(`// outputs('List_rows')?['body/value']`);

        if (parsed.attributes.length > 0) {
            lines.push('//');
            lines.push('// Access fields in an Apply to Each:');
            parsed.attributes.slice(0, 5).forEach(attr => {
                lines.push(`//   items('Apply_to_each')?['${attr}']`);
            });
            if (parsed.attributes.length > 5) {
                lines.push(`//   ... and ${parsed.attributes.length - 5} more fields`);
            }
        }

        return lines.join('\n');
    }

    // ═══════════════════════════════════════════════════════════
    // Web API URL
    // ═══════════════════════════════════════════════════════════

    /**
     * Convert FetchXML to Dataverse Web API URL.
     * @param {FetchXmlParsed} parsed - Parsed FetchXML
     * @param {string} fetchXml - Raw FetchXML
     * @param {Object} [options] - Optional conversion options
     * @param {string} [options.orgUrl] - Organization URL (e.g. 'https://org.crm.dynamics.com')
     * @returns {string}
     * @private
     * @static
     */
    static _toWebApiUrl(parsed, fetchXml, options = {}) {
        const lines = [];
        const orgUrl = options.orgUrl || '{org-url}';
        const hasRealUrl = orgUrl !== '{org-url}';

        lines.push('// Dataverse Web API URL with FetchXML');
        if (!hasRealUrl) {
            lines.push('// Replace {org-url} with your environment URL');
        }
        lines.push(`// Note: Entity set name "${parsed.entityName}s" may differ — verify in your metadata`);
        lines.push('');

        const encoded = encodeURIComponent(fetchXml.trim());
        lines.push(`${orgUrl}/api/data/v9.2/${parsed.entityName}s?fetchXml=${encoded}`);
        lines.push('');
        lines.push('// Headers required:');
        lines.push('// Authorization: Bearer {access-token}');
        lines.push('// OData-MaxVersion: 4.0');
        lines.push('// OData-Version: 4.0');
        lines.push('// Accept: application/json');
        lines.push('// Prefer: odata.include-annotations="*"');

        return lines.join('\n');
    }
}
