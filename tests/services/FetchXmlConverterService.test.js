import { describe, it, expect, beforeEach } from 'vitest';

import { FetchXmlConverterService } from '../../src/services/FetchXmlConverterService.js';

describe('FetchXmlConverterService', () => {
    // ═══════════════════════════════════════════════════════════
    // Test Data
    // ═══════════════════════════════════════════════════════════

    const simpleFetchXml = `
<fetch top="10">
  <entity name="account">
    <attribute name="name" />
    <attribute name="revenue" />
    <order attribute="name" />
    <filter type="and">
      <condition attribute="statecode" operator="eq" value="0" />
    </filter>
  </entity>
</fetch>`;

    const aggregateFetchXml = `
<fetch aggregate="true">
  <entity name="account">
    <attribute name="revenue" alias="TotalRevenue" aggregate="sum" />
    <attribute name="address1_city" alias="City" groupby="true" />
    <order alias="TotalRevenue" descending="true" />
  </entity>
</fetch>`;

    const fetchWithJoin = `
<fetch>
  <entity name="account">
    <attribute name="name" />
    <link-entity name="contact" from="parentcustomerid" to="accountid" link-type="inner" alias="c">
      <attribute name="fullname" />
      <filter type="and">
        <condition attribute="statecode" operator="eq" value="0" />
      </filter>
    </link-entity>
  </entity>
</fetch>`;

    const allAttributesFetchXml = `
<fetch>
  <entity name="account">
    <all-attributes />
    <order attribute="createdon" descending="true" />
  </entity>
</fetch>`;

    const multiFilterFetchXml = `
<fetch top="50">
  <entity name="contact">
    <attribute name="fullname" />
    <attribute name="emailaddress1" />
    <filter type="or">
      <condition attribute="statecode" operator="eq" value="0" />
      <condition attribute="fullname" operator="like" value="%Smith%" />
      <filter type="and">
        <condition attribute="address1_city" operator="eq" value="Seattle" />
        <condition attribute="jobtitle" operator="not-null" />
      </filter>
    </filter>
  </entity>
</fetch>`;

    // ═══════════════════════════════════════════════════════════
    // getFormats
    // ═══════════════════════════════════════════════════════════

    describe('getFormats', () => {
        it('should return all supported format objects', () => {
            const formats = FetchXmlConverterService.getFormats();
            expect(formats).toBeInstanceOf(Array);
            expect(formats.length).toBe(6);
        });

        it('should include all expected format ids', () => {
            const ids = FetchXmlConverterService.getFormats().map(f => f.id);
            expect(ids).toContain('csharp');
            expect(ids).toContain('javascript');
            expect(ids).toContain('odata');
            expect(ids).toContain('sql');
            expect(ids).toContain('powerautomate');
            expect(ids).toContain('webapiurl');
        });

        it('should have label for each format', () => {
            FetchXmlConverterService.getFormats().forEach(f => {
                expect(f.label).toBeTruthy();
                expect(typeof f.label).toBe('string');
            });
        });
    });

    // ═══════════════════════════════════════════════════════════
    // convert() dispatch
    // ═══════════════════════════════════════════════════════════

    describe('convert', () => {
        it('should throw for unknown format', () => {
            expect(() =>
                FetchXmlConverterService.convert(simpleFetchXml, 'unknown')
            ).toThrow('Unknown format');
        });

        it('should throw for invalid XML', () => {
            expect(() =>
                FetchXmlConverterService.convert('<not-valid', 'sql')
            ).toThrow();
        });

        it('should throw when no entity element found', () => {
            expect(() =>
                FetchXmlConverterService.convert('<fetch></fetch>', 'sql')
            ).toThrow('No <entity>');
        });

        it('should convert all supported formats without error', () => {
            const formats = ['csharp', 'javascript', 'odata', 'sql', 'powerautomate', 'webapiurl'];
            formats.forEach(format => {
                const result = FetchXmlConverterService.convert(simpleFetchXml, format);
                expect(typeof result).toBe('string');
                expect(result.length).toBeGreaterThan(0);
            });
        });
    });

    // ═══════════════════════════════════════════════════════════
    // C# QueryExpression
    // ═══════════════════════════════════════════════════════════

    describe('C# QueryExpression', () => {
        it('should generate QueryExpression with correct entity', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'csharp');
            expect(result).toContain('new QueryExpression("account")');
        });

        it('should generate ColumnSet with selected attributes', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'csharp');
            expect(result).toContain('new ColumnSet("name", "revenue")');
        });

        it('should generate ColumnSet(true) for all-attributes', () => {
            const result = FetchXmlConverterService.convert(allAttributesFetchXml, 'csharp');
            expect(result).toContain('new ColumnSet(true)');
        });

        it('should generate TopCount', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'csharp');
            expect(result).toContain('query.TopCount = 10');
        });

        it('should generate AddOrder', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'csharp');
            expect(result).toContain('query.AddOrder("name", OrderType.Ascending)');
        });

        it('should generate descending order', () => {
            const result = FetchXmlConverterService.convert(allAttributesFetchXml, 'csharp');
            expect(result).toContain('OrderType.Descending');
        });

        it('should generate filter conditions', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'csharp');
            expect(result).toContain('AddCondition("statecode", ConditionOperator.Equal, "0")');
        });

        it('should generate link entity', () => {
            const result = FetchXmlConverterService.convert(fetchWithJoin, 'csharp');
            expect(result).toContain('AddLink("contact"');
            expect(result).toContain('EntityAlias = "c"');
        });

        it('should generate RetrieveMultiple call', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'csharp');
            expect(result).toContain('service.RetrieveMultiple(query)');
        });

        it('should handle nested filters in C#', () => {
            const result = FetchXmlConverterService.convert(multiFilterFetchXml, 'csharp');
            expect(result).toContain('LogicalOperator.Or');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // JavaScript Xrm
    // ═══════════════════════════════════════════════════════════

    describe('JavaScript Xrm', () => {
        it('should generate simple OData query for basic fetch', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'javascript');
            expect(result).toContain('Xrm.WebApi.retrieveMultipleRecords');
            expect(result).toContain('account');
        });

        it('should use fetchXml for complex queries with joins', () => {
            const result = FetchXmlConverterService.convert(fetchWithJoin, 'javascript');
            expect(result).toContain('fetchXml');
            expect(result).toContain('<link-entity');
        });

        it('should use fetchXml for aggregate queries', () => {
            const result = FetchXmlConverterService.convert(aggregateFetchXml, 'javascript');
            expect(result).toContain('aggregate="true"');
        });

        it('should include result iteration code', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'javascript');
            expect(result).toContain('result.entities.forEach');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // OData
    // ═══════════════════════════════════════════════════════════

    describe('OData', () => {
        it('should generate $select with attributes', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'odata');
            expect(result).toContain('$select=name,revenue');
        });

        it('should generate $filter', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'odata');
            expect(result).toContain('$filter=');
            expect(result).toContain('statecode eq 0');
        });

        it('should generate $orderby', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'odata');
            expect(result).toContain('$orderby=name asc');
        });

        it('should generate $top', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'odata');
            expect(result).toContain('$top=10');
        });

        it('should note that aggregate is not supported', () => {
            const result = FetchXmlConverterService.convert(aggregateFetchXml, 'odata');
            expect(result).toContain('not directly supported');
        });

        it('should handle or filters', () => {
            const result = FetchXmlConverterService.convert(multiFilterFetchXml, 'odata');
            expect(result).toContain(' or ');
        });

        it('should handle null operator', () => {
            const result = FetchXmlConverterService.convert(multiFilterFetchXml, 'odata');
            expect(result).toContain('ne null');
        });

        it('should handle like operator with contains', () => {
            const result = FetchXmlConverterService.convert(multiFilterFetchXml, 'odata');
            expect(result).toContain('contains(fullname');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // SQL
    // ═══════════════════════════════════════════════════════════

    describe('SQL', () => {
        it('should generate SELECT with column names', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'sql');
            expect(result).toContain('SELECT');
            expect(result).toContain('name, revenue');
        });

        it('should generate SELECT * for all-attributes', () => {
            const result = FetchXmlConverterService.convert(allAttributesFetchXml, 'sql');
            expect(result).toContain('SELECT *');
        });

        it('should generate FROM with entity name', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'sql');
            expect(result).toContain('FROM account');
        });

        it('should generate TOP clause', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'sql');
            expect(result).toContain('TOP 10');
        });

        it('should generate WHERE clause', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'sql');
            expect(result).toContain('WHERE');
            expect(result).toContain("statecode = '0'");
        });

        it('should generate ORDER BY', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'sql');
            expect(result).toContain('ORDER BY name ASC');
        });

        it('should generate INNER JOIN for link-entity', () => {
            const result = FetchXmlConverterService.convert(fetchWithJoin, 'sql');
            expect(result).toContain('INNER JOIN contact');
            expect(result).toContain('ON c.parentcustomerid = account.accountid');
        });

        it('should generate aggregate SQL with GROUP BY', () => {
            const result = FetchXmlConverterService.convert(aggregateFetchXml, 'sql');
            expect(result).toContain('SUM(revenue)');
            expect(result).toContain('GROUP BY');
            expect(result).toContain('address1_city');
        });

        it('should generate OR in SQL for or-type filter', () => {
            const result = FetchXmlConverterService.convert(multiFilterFetchXml, 'sql');
            expect(result).toContain(' OR ');
        });

        it('should generate LIKE for like operator', () => {
            const result = FetchXmlConverterService.convert(multiFilterFetchXml, 'sql');
            expect(result).toContain("LIKE '%Smith%'");
        });

        it('should generate IS NULL and IS NOT NULL', () => {
            const result = FetchXmlConverterService.convert(multiFilterFetchXml, 'sql');
            expect(result).toContain('IS NOT NULL');
        });

        it('should generate ORDER BY DESC for aggregate', () => {
            const result = FetchXmlConverterService.convert(aggregateFetchXml, 'sql');
            expect(result).toContain('TotalRevenue DESC');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // Power Automate
    // ═══════════════════════════════════════════════════════════

    describe('Power Automate', () => {
        it('should include table name in instructions', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'powerautomate');
            expect(result).toContain('account');
        });

        it('should include List rows action reference', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'powerautomate');
            expect(result).toContain('List rows');
        });

        it('should include the FetchXML', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'powerautomate');
            expect(result).toContain('<fetch');
            expect(result).toContain('<entity name="account"');
        });

        it('should include dynamic content expression', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'powerautomate');
            expect(result).toContain('outputs(');
        });

        it('should include field access expressions', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'powerautomate');
            expect(result).toContain("items('Apply_to_each')");
        });
    });

    // ═══════════════════════════════════════════════════════════
    // Web API URL
    // ═══════════════════════════════════════════════════════════

    describe('Web API URL', () => {
        it('should include encoded fetchXml parameter', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'webapiurl');
            expect(result).toContain('fetchXml=');
            expect(result).toContain('%3Cfetch');
        });

        it('should include entity set name', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'webapiurl');
            expect(result).toContain('accounts');
        });

        it('should include required headers', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'webapiurl');
            expect(result).toContain('Authorization: Bearer');
            expect(result).toContain('OData-Version: 4.0');
        });

        it('should use v9.2 API version', () => {
            const result = FetchXmlConverterService.convert(simpleFetchXml, 'webapiurl');
            expect(result).toContain('/api/data/v9.2/');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // Parser
    // ═══════════════════════════════════════════════════════════

    describe('_parse', () => {
        it('should extract entity name', () => {
            const result = FetchXmlConverterService._parse(simpleFetchXml);
            expect(result.entityName).toBe('account');
        });

        it('should extract attributes', () => {
            const result = FetchXmlConverterService._parse(simpleFetchXml);
            expect(result.attributes).toEqual(['name', 'revenue']);
        });

        it('should detect all-attributes', () => {
            const result = FetchXmlConverterService._parse(allAttributesFetchXml);
            expect(result.allAttributes).toBe(true);
        });

        it('should extract top count', () => {
            const result = FetchXmlConverterService._parse(simpleFetchXml);
            expect(result.top).toBe(10);
        });

        it('should return null top when not specified', () => {
            const result = FetchXmlConverterService._parse(allAttributesFetchXml);
            expect(result.top).toBeNull();
        });

        it('should detect aggregate mode', () => {
            const result = FetchXmlConverterService._parse(aggregateFetchXml);
            expect(result.aggregate).toBe(true);
        });

        it('should extract aggregate attributes', () => {
            const result = FetchXmlConverterService._parse(aggregateFetchXml);
            expect(result.aggregateAttributes).toHaveLength(1);
            expect(result.aggregateAttributes[0]).toEqual({
                name: 'revenue',
                alias: 'TotalRevenue',
                aggregate: 'sum'
            });
        });

        it('should extract group-by attributes', () => {
            const result = FetchXmlConverterService._parse(aggregateFetchXml);
            expect(result.groupByAttributes).toHaveLength(1);
            expect(result.groupByAttributes[0].name).toBe('address1_city');
            expect(result.groupByAttributes[0].alias).toBe('City');
        });

        it('should extract orders', () => {
            const result = FetchXmlConverterService._parse(simpleFetchXml);
            expect(result.orders).toHaveLength(1);
            expect(result.orders[0].attribute).toBe('name');
            expect(result.orders[0].descending).toBe(false);
        });

        it('should extract filters', () => {
            const result = FetchXmlConverterService._parse(simpleFetchXml);
            expect(result.filters).toHaveLength(1);
            expect(result.filters[0].type).toBe('and');
            expect(result.filters[0].conditions).toHaveLength(1);
        });

        it('should extract link entities', () => {
            const result = FetchXmlConverterService._parse(fetchWithJoin);
            expect(result.linkEntities).toHaveLength(1);
            expect(result.linkEntities[0].name).toBe('contact');
            expect(result.linkEntities[0].from).toBe('parentcustomerid');
            expect(result.linkEntities[0].to).toBe('accountid');
            expect(result.linkEntities[0].linkType).toBe('inner');
            expect(result.linkEntities[0].alias).toBe('c');
        });

        it('should parse nested filters', () => {
            const result = FetchXmlConverterService._parse(multiFilterFetchXml);
            expect(result.filters[0].type).toBe('or');
            expect(result.filters[0].nestedFilters).toHaveLength(1);
            expect(result.filters[0].nestedFilters[0].type).toBe('and');
        });

        it('should parse link entity attributes', () => {
            const result = FetchXmlConverterService._parse(fetchWithJoin);
            expect(result.linkEntities[0].attributes).toEqual(['fullname']);
        });

        it('should parse link entity filters', () => {
            const result = FetchXmlConverterService._parse(fetchWithJoin);
            expect(result.linkEntities[0].filters).toHaveLength(1);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // Edge Cases
    // ═══════════════════════════════════════════════════════════

    describe('Edge Cases', () => {
        it('should handle fetch with no attributes', () => {
            const xml = '<fetch><entity name="account"></entity></fetch>';
            const result = FetchXmlConverterService.convert(xml, 'csharp');
            expect(result).toContain('ColumnSet(false)');
        });

        it('should handle distinct fetch', () => {
            const xml = '<fetch distinct="true"><entity name="account"><attribute name="name" /></entity></fetch>';
            const result = FetchXmlConverterService.convert(xml, 'csharp');
            expect(result).toContain('query.Distinct = true');
        });

        it('should handle distinct in SQL', () => {
            const xml = '<fetch distinct="true"><entity name="account"><attribute name="name" /></entity></fetch>';
            const result = FetchXmlConverterService.convert(xml, 'sql');
            expect(result).toContain('SELECT DISTINCT');
        });

        it('should handle in operator with multiple values', () => {
            const xml = `
<fetch>
  <entity name="account">
    <filter>
      <condition attribute="statecode" operator="in">
        <value>0</value>
        <value>1</value>
      </condition>
    </filter>
  </entity>
</fetch>`;
            const sqlResult = FetchXmlConverterService.convert(xml, 'sql');
            expect(sqlResult).toContain("IN ('0', '1')");

            const csharpResult = FetchXmlConverterService.convert(xml, 'csharp');
            expect(csharpResult).toContain('ConditionOperator.In');
        });

        it('should handle date grouping in SQL', () => {
            const xml = `
<fetch aggregate="true">
  <entity name="account">
    <attribute name="revenue" alias="Total" aggregate="sum" />
    <attribute name="createdon" alias="Month" groupby="true" dategrouping="month" />
  </entity>
</fetch>`;
            const result = FetchXmlConverterService.convert(xml, 'sql');
            expect(result).toContain('DATEPART(month, createdon)');
        });

        it('should handle outer join in SQL', () => {
            const xml = `
<fetch>
  <entity name="account">
    <link-entity name="contact" from="parentcustomerid" to="accountid" link-type="outer" />
  </entity>
</fetch>`;
            const result = FetchXmlConverterService.convert(xml, 'sql');
            expect(result).toContain('LEFT OUTER JOIN');
            expect(result).toContain('ON contact.parentcustomerid = account.accountid');
        });

        it('should handle outer join in C#', () => {
            const xml = `
<fetch>
  <entity name="account">
    <link-entity name="contact" from="parentcustomerid" to="accountid" link-type="outer" />
  </entity>
</fetch>`;
            const result = FetchXmlConverterService.convert(xml, 'csharp');
            expect(result).toContain('JoinOperator.LeftOuter');
        });

        it('should handle between operator in SQL', () => {
            const xml = `
<fetch>
  <entity name="account">
    <filter>
      <condition attribute="revenue" operator="between">
        <value>100</value>
        <value>1000</value>
      </condition>
    </filter>
  </entity>
</fetch>`;
            const result = FetchXmlConverterService.convert(xml, 'sql');
            expect(result).toContain("BETWEEN '100' AND '1000'");
        });

        it('should handle not-between operator in SQL', () => {
            const xml = `
<fetch>
  <entity name="account">
    <filter>
      <condition attribute="revenue" operator="not-between">
        <value>100</value>
        <value>1000</value>
      </condition>
    </filter>
  </entity>
</fetch>`;
            const result = FetchXmlConverterService.convert(xml, 'sql');
            expect(result).toContain("NOT BETWEEN '100' AND '1000'");
        });

        it('should handle between operator in OData', () => {
            const xml = `
<fetch>
  <entity name="account">
    <filter>
      <condition attribute="revenue" operator="between">
        <value>100</value>
        <value>1000</value>
      </condition>
    </filter>
  </entity>
</fetch>`;
            const result = FetchXmlConverterService.convert(xml, 'odata');
            expect(result).toContain('revenue ge 100');
            expect(result).toContain('revenue le 1000');
        });

        it('should handle eq-userid operator', () => {
            const xml = `
<fetch>
  <entity name="account">
    <filter>
      <condition attribute="ownerid" operator="eq-userid" />
    </filter>
  </entity>
</fetch>`;
            const sqlResult = FetchXmlConverterService.convert(xml, 'sql');
            expect(sqlResult).toContain('@CurrentUserId');

            const csharpResult = FetchXmlConverterService.convert(xml, 'csharp');
            expect(csharpResult).toContain('EqualUserId');
        });

        it('should use FetchExpression for aggregate queries in C#', () => {
            const result = FetchXmlConverterService.convert(aggregateFetchXml, 'csharp');
            expect(result).toContain('FetchExpression');
            expect(result).toContain('aggregate');
            expect(result).not.toContain('new QueryExpression');
        });

        it('should format OData numeric values without quotes', () => {
            const xml = `
<fetch>
  <entity name="account">
    <filter>
      <condition attribute="revenue" operator="gt" value="1000000" />
    </filter>
  </entity>
</fetch>`;
            const result = FetchXmlConverterService.convert(xml, 'odata');
            expect(result).toContain('revenue gt 1000000');
            expect(result).not.toContain("revenue gt '1000000'");
        });

        it('should format OData GUID values without quotes', () => {
            const xml = `
<fetch>
  <entity name="account">
    <filter>
      <condition attribute="accountid" operator="eq" value="12345678-1234-1234-1234-123456789012" />
    </filter>
  </entity>
</fetch>`;
            const result = FetchXmlConverterService.convert(xml, 'odata');
            expect(result).toContain('accountid eq 12345678-1234-1234-1234-123456789012');
            expect(result).not.toContain("'");
        });

        it('should format OData string values with quotes', () => {
            const xml = `
<fetch>
  <entity name="account">
    <filter>
      <condition attribute="name" operator="eq" value="Contoso" />
    </filter>
  </entity>
</fetch>`;
            const result = FetchXmlConverterService.convert(xml, 'odata');
            expect(result).toContain("name eq 'Contoso'");
        });

        it('should generate LinkCriteria properly in C#', () => {
            const result = FetchXmlConverterService.convert(fetchWithJoin, 'csharp');
            expect(result).toContain('LinkCriteria.FilterOperator');
            expect(result).toContain('LinkCriteria.AddCondition');
            expect(result).not.toContain('var cLink.LinkCriteria');
        });
    });
});
