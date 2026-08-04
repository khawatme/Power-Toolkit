/**
 * @file Tests for QuickCheckService
 * @module tests/services/QuickCheckService.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════
// MOCKS - MUST BE BEFORE IMPORTS
// ═══════════════════════════════════════════════════════════

vi.mock('../../src/services/WebApiService.js', () => ({
    WebApiService: { webApiFetch: vi.fn() }
}));

vi.mock('../../src/services/MetadataService.js', () => ({
    MetadataService: { getEntitySetName: vi.fn() }
}));

vi.mock('../../src/services/SecurityAnalysisService.js', () => ({
    SecurityAnalysisService: {
        getUserRoles: vi.fn(() => Promise.resolve([])),
        getUserEntityPrivileges: vi.fn(() => Promise.resolve({})),
        getSecuredColumnsForEntity: vi.fn(() => Promise.resolve([]))
    }
}));

// ═══════════════════════════════════════════════════════════
// IMPORTS - AFTER MOCKS
// ═══════════════════════════════════════════════════════════

import { QuickCheckService } from '../../src/services/QuickCheckService.js';
import { WebApiService } from '../../src/services/WebApiService.js';
import { SecurityAnalysisService } from '../../src/services/SecurityAnalysisService.js';

const USER = 'aaaaaaaa-0000-0000-0000-000000000001';

/**
 * Routes webApiFetch by URL instead of call order, so a change in request sequence surfaces as a
 * real failure rather than a silently mismatched mock.
 * @param {Array<[string, object|Function]>} handlers - [url fragment, response or thrower]
 */
function route(handlers) {
    WebApiService.webApiFetch.mockImplementation((method, path, query = '') => {
        const url = `${path}${query}`;
        for (const [fragment, response] of handlers) {
            if (url.includes(fragment)) {
                return typeof response === 'function' ? response(url) : Promise.resolve(response);
            }
        }
        return Promise.resolve({ value: [] });
    });
}

describe('QuickCheckService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        QuickCheckService.clearCache();
        SecurityAnalysisService.getUserRoles.mockResolvedValue([]);
        SecurityAnalysisService.getSecuredColumnsForEntity.mockResolvedValue([]);
        SecurityAnalysisService.getUserEntityPrivileges.mockResolvedValue({});
    });

    describe('getAvailableForms', () => {
        it('should ask the platform which forms the user can access', async () => {
            route([['RetrieveFilteredForms', { value: [{ formid: 'form-1', name: 'Account' }] }]]);

            await QuickCheckService.getAvailableForms(USER, 'account', vi.fn());

            const [, path, query] = WebApiService.webApiFetch.mock.calls[0];
            expect(path).toBe('systemforms/Microsoft.Dynamics.CRM.RetrieveFilteredForms(EntityLogicalName=@p1,FormType=@p2,User=@p3)');
            expect(decodeURIComponent(query)).toBe(`?@p1='account'&@p2=2&@p3={"@odata.id":"systemusers(${USER})"}`);
        });

        it('should return the forms the platform reports', async () => {
            route([['RetrieveFilteredForms', { value: [{ formid: 'form-2', name: 'Account (Sales)' }] }]]);

            const result = await QuickCheckService.getAvailableForms(USER, 'account', vi.fn());

            expect(result.availableForms).toEqual([{ formid: 'form-2', name: 'Account (Sales)' }]);
        });
    });

    describe('getRecordAccess', () => {
        it('should parse a full rights list', async () => {
            route([['RetrievePrincipalAccess', { AccessRights: 'ReadAccess, WriteAccess, AppendAccess' }]]);

            const result = await QuickCheckService.getRecordAccess(USER, 'accounts', 'rec-1', vi.fn());

            expect(result).toMatchObject({ checked: true, canRead: true, canWrite: true });
            expect(result.rights).toEqual(['ReadAccess', 'WriteAccess', 'AppendAccess']);
        });

        it('should treat "None" as no access', async () => {
            route([['RetrievePrincipalAccess', { AccessRights: 'None' }]]);

            const result = await QuickCheckService.getRecordAccess(USER, 'accounts', 'rec-1', vi.fn());

            expect(result).toMatchObject({ checked: true, canRead: false, canWrite: false });
            expect(result.rights).toEqual([]);
        });

        it('should treat an empty string as no access', async () => {
            route([['RetrievePrincipalAccess', { AccessRights: '' }]]);

            const result = await QuickCheckService.getRecordAccess(USER, 'accounts', 'rec-1', vi.fn());

            expect(result.rights).toEqual([]);
        });

        it('should report read-without-write', async () => {
            route([['RetrievePrincipalAccess', { AccessRights: 'ReadAccess' }]]);

            const result = await QuickCheckService.getRecordAccess(USER, 'accounts', 'rec-1', vi.fn());

            expect(result).toMatchObject({ canRead: true, canWrite: false });
        });

        it('should not check anything on an unsaved record', async () => {
            const result = await QuickCheckService.getRecordAccess(USER, 'accounts', null, vi.fn());

            expect(result.checked).toBe(false);
            expect(WebApiService.webApiFetch).not.toHaveBeenCalled();
        });
    });

    describe('getVisibleApps', () => {
        it('should match apps through every role record the user holds', async () => {
            // A user in a child business unit is assigned a copy of the role; the app may reference
            // either the copy or the root.
            SecurityAnalysisService.getUserRoles.mockResolvedValue([
                { roleid: 'role-root', sourceRoleIds: ['role-bu-copy'], name: 'Sales' }
            ]);
            route([['appmodules', {
                value: [
                    { appmoduleid: 'a1', name: 'Sales Hub', appmoduleroles_association: [{ roleid: 'ROLE-BU-COPY' }] },
                    { appmoduleid: 'a2', name: 'Service Hub', appmoduleroles_association: [{ roleid: 'role-other' }] }
                ]
            }]]);

            const result = await QuickCheckService.getVisibleApps(USER, vi.fn());

            expect(result.visible.map(a => a.name)).toEqual(['Sales Hub']);
            expect(result.hidden.map(a => a.name)).toEqual(['Service Hub']);
        });

        it('should treat an app with no roles as undetermined, not visible', async () => {
            route([['appmodules', {
                value: [{ appmoduleid: 'a1', name: 'Admin App', appmoduleroles_association: [] }]
            }]]);

            const result = await QuickCheckService.getVisibleApps(USER, vi.fn());

            expect(result.undetermined.map(a => a.name)).toEqual(['Admin App']);
            expect(result.visible).toEqual([]);
            expect(result.hidden).toEqual([]);
        });
    });

    describe('getRoleScopedViews', () => {
        it('should not query roles when no view carries role conditions', async () => {
            route([['savedqueries', {
                value: [{ savedqueryid: 'v1', name: 'Active Accounts', roledisplayconditionsxml: '' }]
            }]]);

            const result = await QuickCheckService.getRoleScopedViews(USER, 'account', vi.fn());

            expect(result).toEqual({ restricted: [], hidden: [] });
            expect(SecurityAnalysisService.getUserRoles).not.toHaveBeenCalled();
        });

        it('should hide a role-scoped view the user has no matching role for', async () => {
            SecurityAnalysisService.getUserRoles.mockResolvedValue([
                { roleid: 'bbbbbbbb-0000-0000-0000-000000000002', sourceRoleIds: [], name: 'Sales' }
            ]);
            route([['savedqueries', {
                value: [{
                    savedqueryid: 'v1',
                    name: 'Finance View',
                    roledisplayconditionsxml: '<roles><role id="cccccccc-0000-0000-0000-000000000003" /></roles>'
                }]
            }]]);

            const result = await QuickCheckService.getRoleScopedViews(USER, 'account', vi.fn());

            expect(result.hidden.map(v => v.name)).toEqual(['Finance View']);
        });

        it('should keep a role-scoped view the user does have a role for', async () => {
            SecurityAnalysisService.getUserRoles.mockResolvedValue([
                { roleid: 'CCCCCCCC-0000-0000-0000-000000000003', sourceRoleIds: [], name: 'Finance' }
            ]);
            route([['savedqueries', {
                value: [{
                    savedqueryid: 'v1',
                    name: 'Finance View',
                    roledisplayconditionsxml: '<roles><role id="cccccccc-0000-0000-0000-000000000003" /></roles>'
                }]
            }]]);

            const result = await QuickCheckService.getRoleScopedViews(USER, 'account', vi.fn());

            expect(result.hidden).toEqual([]);
        });

        it('should not claim a view is hidden when the condition XML cannot be read', async () => {
            // The schema is undocumented; an unparseable shape is not evidence of a restriction.
            SecurityAnalysisService.getUserRoles.mockResolvedValue([]);
            route([['savedqueries', {
                value: [{ savedqueryid: 'v1', name: 'Odd View', roledisplayconditionsxml: '<unknown-shape />' }]
            }]]);

            const result = await QuickCheckService.getRoleScopedViews(USER, 'account', vi.fn());

            expect(result.hidden).toEqual([]);
            expect(result.restricted.map(v => v.name)).toEqual(['Odd View']);
        });
    });

    describe('getSecuredColumns', () => {
        /**
         * Stubs the table's secured-column metadata.
         * @param {string[]} securedNames - Logical names the table secures
         */
        const securedAttributes = (securedNames) => route([['/Attributes', {
            value: [
                ...securedNames.map(LogicalName => ({ LogicalName, IsSecured: true })),
                { LogicalName: 'name', IsSecured: false }
            ]
        }]]);

        it('should map field permissions to read/update flags', async () => {
            securedAttributes(['creditlimit', 'revenue']);
            SecurityAnalysisService.getSecuredColumnsForEntity.mockResolvedValue([
                { attributelogicalname: 'creditlimit', canread: 0, canupdate: 0, profiles: ['Finance'] },
                { attributelogicalname: 'revenue', canread: 4, canupdate: 0, profiles: ['Sales'] }
            ]);

            const { columns } = await QuickCheckService.getSecuredColumns(USER, 'account', vi.fn());

            expect(columns.get('creditlimit')).toEqual({ canRead: false, canUpdate: false, profiles: ['Finance'] });
            expect(columns.get('revenue')).toEqual({ canRead: true, canUpdate: false, profiles: ['Sales'] });
        });

        it('should report every secured column as denied when the user holds no profile', async () => {
            // Field security is default-deny. Reading only the user's granted rows reported the
            // commonest case — a user with no field security profile — as unrestricted.
            securedAttributes(['creditlimit', 'revenue']);
            SecurityAnalysisService.getSecuredColumnsForEntity.mockResolvedValue([]);

            const { columns } = await QuickCheckService.getSecuredColumns(USER, 'account', vi.fn());

            expect([...columns.keys()]).toEqual(['creditlimit', 'revenue']);
            expect(columns.get('creditlimit')).toEqual({ canRead: false, canUpdate: false, profiles: [] });
        });

        it('should not list a secured column the user is fully granted', async () => {
            securedAttributes(['creditlimit']);
            SecurityAnalysisService.getSecuredColumnsForEntity.mockResolvedValue([
                { attributelogicalname: 'creditlimit', canread: 4, canupdate: 4, profiles: ['Finance'] }
            ]);

            const { columns } = await QuickCheckService.getSecuredColumns(USER, 'account', vi.fn());

            expect(columns.size).toBe(0);
        });

        it('should report nothing when the table secures no columns', async () => {
            securedAttributes([]);
            SecurityAnalysisService.getSecuredColumnsForEntity.mockResolvedValue([]);

            const { columns } = await QuickCheckService.getSecuredColumns(USER, 'account', vi.fn());

            expect(columns.size).toBe(0);
        });
    });

    describe('buildCheck', () => {
        const pageContext = {
            entityLogicalName: 'account',
            entitySetName: 'accounts',
            recordId: 'rec-1',
            formId: 'form-1'
        };

        it('should return null without a user or an entity', async () => {
            await expect(QuickCheckService.buildCheck(null, pageContext)).resolves.toBeNull();
            await expect(QuickCheckService.buildCheck(USER, {})).resolves.toBeNull();
        });

        it('should assemble every section', async () => {
            route([
                ['RetrieveFilteredForms', { value: [{ formid: 'form-1', name: 'Account' }] }],
                ['RetrievePrincipalAccess', { AccessRights: 'ReadAccess, WriteAccess' }],
                ['appmodules', { value: [] }],
                ['savedqueries', { value: [] }]
            ]);

            const preview = await QuickCheckService.buildCheck(USER, pageContext, vi.fn());

            expect(preview.form.matchesCurrent).toBe(true);
            expect(preview.record.canWrite).toBe(true);
            expect(preview.apps.visible).toEqual([]);
            expect(preview.views.restricted).toEqual([]);
        });

        it('should keep one failing section from collapsing the preview', async () => {
            route([
                ['RetrieveFilteredForms', () => Promise.reject(new Error('HTTP 403 Forbidden'))],
                ['RetrievePrincipalAccess', { AccessRights: 'ReadAccess' }],
                ['appmodules', { value: [] }],
                ['savedqueries', { value: [] }]
            ]);

            const preview = await QuickCheckService.buildCheck(USER, pageContext, vi.fn());

            expect(preview.form.unavailable).toContain('403');
            expect(preview.record.canRead).toBe(true);
        });

        it('should not report a form mismatch when the form lookup failed', async () => {
            // Unknown must never render as "they would get a different form".
            route([['RetrieveFilteredForms', () => Promise.reject(new Error('HTTP 500'))]]);

            const preview = await QuickCheckService.buildCheck(USER, pageContext, vi.fn());

            expect(preview.form.matchesCurrent).toBe(true);
            expect(preview.form.unavailable).toBeTruthy();
        });

        it('should skip the form lookup entirely on a list page', async () => {
            // A list has no form to contradict, so asking which form they would get is wasted work.
            route([
                ['RetrievePrincipalAccess', { AccessRights: 'ReadAccess' }],
                ['appmodules', { value: [] }],
                ['savedqueries', { value: [] }]
            ]);

            const result = await QuickCheckService.buildCheck(
                USER, { ...pageContext, recordId: null, formId: null }, vi.fn()
            );

            const paths = WebApiService.webApiFetch.mock.calls.map(c => c[1]);
            expect(paths.some(p => p.includes('RetrieveFilteredForms'))).toBe(false);
            expect(result.form.notApplicable).toBe(true);
            expect(result.record.checked).toBe(false);
        });

        it('should still report table privileges, apps and views on a list page', async () => {
            route([
                ['appmodules', { value: [] }],
                ['savedqueries', { value: [] }]
            ]);

            const result = await QuickCheckService.buildCheck(
                USER, { ...pageContext, recordId: null, formId: null }, vi.fn()
            );

            expect(result.privileges).toBeDefined();
            expect(result.apps).toBeDefined();
            expect(result.views).toBeDefined();
            expect(result.securedColumns).toBeDefined();
        });

        it('should detect the current form against the cached form list', async () => {
            route([['RetrieveFilteredForms', { value: [{ formid: 'FORM-9', name: 'Other' }] }]]);

            const preview = await QuickCheckService.buildCheck(USER, pageContext, vi.fn());

            expect(preview.form.matchesCurrent).toBe(false);
        });

        it('should treat a matching form as a match regardless of GUID casing or braces', async () => {
            route([['RetrieveFilteredForms', { value: [{ formid: 'FORM-1', name: 'Account' }] }]]);

            const preview = await QuickCheckService.buildCheck(
                USER, { ...pageContext, formId: '{form-1}' }, vi.fn()
            );

            expect(preview.form.matchesCurrent).toBe(true);
        });
    });

    describe('caching', () => {
        const pageContext = {
            entityLogicalName: 'account',
            entitySetName: 'accounts',
            recordId: 'rec-1',
            formId: 'form-1'
        };

        beforeEach(() => {
            route([
                ['RetrieveFilteredForms', { value: [{ formid: 'form-1', name: 'Account' }] }],
                ['RetrievePrincipalAccess', { AccessRights: 'ReadAccess' }],
                ['appmodules', { value: [] }],
                ['savedqueries', { value: [] }]
            ]);
        });

        it('should re-check only the record when navigating within the same table', async () => {
            // The overlay recomputes on every navigation; without the memo this would re-issue a
            // dozen requests per record instead of one.
            await QuickCheckService.buildCheck(USER, pageContext, vi.fn());
            WebApiService.webApiFetch.mockClear();

            await QuickCheckService.buildCheck(USER, { ...pageContext, recordId: 'rec-2' }, vi.fn());

            const paths = WebApiService.webApiFetch.mock.calls.map(c => c[1]);
            expect(paths).toHaveLength(1);
            expect(paths[0]).toContain('RetrievePrincipalAccess');
        });

        it('should recompute everything for a different table', async () => {
            await QuickCheckService.buildCheck(USER, pageContext, vi.fn());
            WebApiService.webApiFetch.mockClear();

            await QuickCheckService.buildCheck(
                USER, { ...pageContext, entityLogicalName: 'contact', entitySetName: 'contacts' }, vi.fn()
            );

            const paths = WebApiService.webApiFetch.mock.calls.map(c => c[1]);
            expect(paths.some(p => p.includes('RetrieveFilteredForms'))).toBe(true);
        });

        it('should recompute after the cache is cleared', async () => {
            await QuickCheckService.buildCheck(USER, pageContext, vi.fn());
            QuickCheckService.clearCache();
            WebApiService.webApiFetch.mockClear();

            await QuickCheckService.buildCheck(USER, pageContext, vi.fn());

            const paths = WebApiService.webApiFetch.mock.calls.map(c => c[1]);
            expect(paths.some(p => p.includes('RetrieveFilteredForms'))).toBe(true);
        });

        it('should not cache a failure, so a transient error can retry', async () => {
            let attempts = 0;
            route([
                ['RetrieveFilteredForms', () => {
                    attempts++;
                    return attempts === 1
                        ? Promise.reject(new Error('HTTP 503'))
                        : Promise.resolve({ value: [{ formid: 'form-1', name: 'Account' }] });
                }],
                ['RetrievePrincipalAccess', { AccessRights: 'ReadAccess' }]
            ]);

            const first = await QuickCheckService.buildCheck(USER, pageContext, vi.fn());
            const second = await QuickCheckService.buildCheck(USER, pageContext, vi.fn());

            expect(first.form.unavailable).toContain('503');
            expect(second.form.unavailable).toBeUndefined();
        });
    });
});
