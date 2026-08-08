/**
 * @file Computes what a given user would see on the page you are currently on.
 * @module services/QuickCheckService
 * @description Impersonation is a web-service concept: it changes who executes a request, not who
 * the model-driven UI renders for. There is no "view as" feature in model-driven apps, so the only
 * honest way to answer "what does this user see?" is to compute it from documented metadata APIs.
 *
 * The result is reported entirely in the toolkit's own panel. Nothing is written to the host form —
 * an earlier revision annotated it with form and control notifications, and touching a form context
 * that the Unified Interface is tearing down during navigation is not worth the risk to a running
 * app.
 *
 * Everything here runs **as the signed-in user**, never impersonated — it is the toolkit asking on
 * the operator's behalf, and an impersonated user frequently cannot read the metadata that describes
 * their own experience.
 *
 * Each section reports its own `unavailable` reason. A section that cannot be determined is reported
 * as unknown, never as denied: a failed lookup and a real restriction look identical to a user, and
 * conflating them is how a diagnostic tool starts lying.
 */

import { WebApiService } from './WebApiService.js';
import { MetadataService } from './MetadataService.js';
import { SecurityAnalysisService } from './SecurityAnalysisService.js';

/** Main form. Matches `systemform.type` option 2. @private */
const FORM_TYPE_MAIN = 2;

/** Access rights returned by RetrievePrincipalAccess that Quick Check reports on. @private */
const READ_ACCESS = 'ReadAccess';
const WRITE_ACCESS = 'WriteAccess';

/** `savedquery.querytype` 0 = public view — the only type users pick from the view selector. @private */
const QUERY_TYPE_PUBLIC = 0;

/**
 * Normalizes a GUID for comparison. Dataverse is inconsistent about casing and braces between
 * metadata, function responses and table rows.
 * @private
 * @param {string} guid - The value to normalize
 * @returns {string} Lowercase GUID without braces, or an empty string
 */
function _guidKey(guid) {
    return String(guid || '').replace(/[{}]/g, '').toLowerCase();
}

/**
 * Encodes a value as an OData parameter alias payload.
 * @private
 * @param {*} value - Value to encode
 * @returns {string} URI-encoded JSON
 */
function _alias(value) {
    return encodeURIComponent(JSON.stringify(value));
}

/**
 * Runs a section of the preview, converting a failure into an `unavailable` marker.
 * Keeps one failing lookup from collapsing the whole preview.
 * @private
 * @param {Function} run - Async producer for the section
 * @param {Object} fallback - Shape to return when the producer throws
 * @returns {Promise<Object>} The section result, or the fallback plus `unavailable`
 */
async function _section(run, fallback) {
    try {
        return await run();
    } catch (error) {
        return { ...fallback, unavailable: error.message };
    }
}

export const QuickCheckService = {
    /**
     * Session cache for the sections that depend only on the user and the table, not the record.
     * Quick Check re-runs on every navigation, so without this, moving between records of the same
     * table would re-issue a dozen requests each time instead of one.
     * @private @type {Map<string, Promise<*>>}
     */
    _cache: new Map(),

    /**
     * Memoizes a section by key. Rejections are not cached, so a transient failure can retry.
     * @private
     * @param {string} key - Cache key
     * @param {Function} run - Producer
     * @returns {Promise<*>} The cached or freshly produced value
     */
    _memo(key, run) {
        if (!this._cache.has(key)) {
            const pending = Promise.resolve().then(run);
            pending.catch(() => this._cache.delete(key));
            this._cache.set(key, pending);
        }
        return this._cache.get(key);
    },

    /**
     * Builds the full picture of what a user would see on a page.
     *
     * Works on a record form and on a list. `formId` and `recordId` are simply absent on a list, and
     * the form and record sections report themselves as not applicable rather than failing.
     * @param {string} userId - The user to check
     * @param {{entityLogicalName: string, entitySetName: string, recordId: string|null, formId: string|null}} pageContext
     *   Supplied by the caller so this service never touches `Xrm` and stays testable
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Object|null>} The result; sections carry their own `unavailable` reasons
     * @async
     */
    async buildCheck(userId, pageContext, getEntitySetName = MetadataService.getEntitySetName) {
        const { entityLogicalName, entitySetName, recordId, formId } = pageContext || {};
        if (!userId || !entityLogicalName) {
            return null;
        }

        const scope = `${userId}|${entityLogicalName}`;
        const [forms, record, securedColumns, privileges, apps, views] = await Promise.all([
            // Only meaningful on a form; a list has no form to contradict.
            formId
                ? _section(() => this._memo(`forms|${scope}`,
                    () => this.getAvailableForms(userId, entityLogicalName, getEntitySetName)), { availableForms: [] })
                : Promise.resolve({ availableForms: [], notApplicable: true }),
            // Never cached: this is the one section that is about the record on screen.
            _section(() => this.getRecordAccess(userId, entitySetName, recordId, getEntitySetName), { checked: false, rights: [] }),
            _section(() => this._memo(`columns|${scope}`,
                () => this.getSecuredColumns(userId, entityLogicalName, getEntitySetName)), { columns: new Map() }),
            _section(() => this._memo(`privileges|${scope}`,
                () => SecurityAnalysisService.getUserEntityPrivileges(userId, entityLogicalName, getEntitySetName)), {}),
            _section(() => this._memo(`apps|${userId}`,
                () => this.getVisibleApps(userId, getEntitySetName)), { visible: [], hidden: [], undetermined: [] }),
            _section(() => this._memo(`views|${scope}`,
                () => this.getRoleScopedViews(userId, entityLogicalName, getEntitySetName)), { restricted: [], hidden: [] })
        ]);

        // Which form is on screen changes as you navigate, so it is matched here rather than baked
        // into the cached form list. A failed lookup or an unknown current form leaves this true:
        // "we could not tell" must never render as "they would get a different form".
        const current = _guidKey(formId);
        const canCompare = !forms.unavailable && !forms.notApplicable && current && Array.isArray(forms.availableForms);
        const form = {
            ...forms,
            matchesCurrent: canCompare
                ? forms.availableForms.some(f => _guidKey(f.formid) === current)
                : true
        };

        return { userId, entityLogicalName, recordId, form, record, securedColumns, privileges, apps, views };
    },

    /**
     * Lists the main forms available to a user, using the platform's own filtering.
     *
     * `RetrieveFilteredForms` is bound to the systemform *collection* and is the documented way to
     * ask which forms a specific user can access; replicating role-based form rules by hand would
     * not account for fallback forms.
     * @param {string} userId - The user to ask about
     * @param {string} entityLogicalName - Table logical name
     * @param {Function} getEntitySetName - Entity set name resolver
     * @returns {Promise<{availableForms: Array}>}
     * @async
     */
    async getAvailableForms(userId, entityLogicalName, getEntitySetName) {
        const response = await WebApiService.webApiFetch(
            'GET',
            'systemforms/Microsoft.Dynamics.CRM.RetrieveFilteredForms(EntityLogicalName=@p1,FormType=@p2,User=@p3)',
            `?@p1='${entityLogicalName}'&@p2=${FORM_TYPE_MAIN}&@p3=${_alias({ '@odata.id': `systemusers(${userId})` })}`,
            null,
            {},
            getEntitySetName
        );

        return { availableForms: (response?.value || []).map(f => ({ formid: f.formid, name: f.name })) };
    },

    /**
     * Checks what a user could do with the specific record on screen.
     * @param {string} userId - The user to ask about
     * @param {string} entitySetName - Entity set name of the record
     * @param {string|null} recordId - Record id; absent on a create form
     * @param {Function} getEntitySetName - Entity set name resolver
     * @returns {Promise<{checked: boolean, rights: string[], canRead: boolean, canWrite: boolean}>}
     * @async
     */
    async getRecordAccess(userId, entitySetName, recordId, getEntitySetName) {
        if (!recordId || !entitySetName) {
            return { checked: false, rights: [], canRead: false, canWrite: false };
        }

        const response = await WebApiService.webApiFetch(
            'GET',
            `systemusers(${userId})/Microsoft.Dynamics.CRM.RetrievePrincipalAccess(Target=@t)`,
            `?@t=${_alias({ '@odata.id': `${entitySetName}(${_guidKey(recordId)})` })}`,
            null,
            {},
            getEntitySetName
        );

        // "None" and "" both mean no access; anything else is a comma-separated rights list.
        const raw = String(response?.AccessRights || '').trim();
        const rights = raw && raw !== 'None'
            ? raw.split(',').map(r => r.trim()).filter(Boolean)
            : [];

        return {
            checked: true,
            rights,
            canRead: rights.includes(READ_ACCESS),
            canWrite: rights.includes(WRITE_ACCESS)
        };
    },

    /**
     * Maps the columns field security restricts for a user.
     * @param {string} userId - The user to ask about
     * @param {string} entityLogicalName - Table logical name
     * @param {Function} getEntitySetName - Entity set name resolver
     * @returns {Promise<{columns: Map<string, {canRead: boolean, canUpdate: boolean, profiles: string[]}>}>}
     * @async
     */
    async getSecuredColumns(userId, entityLogicalName, getEntitySetName) {
        // Start from the columns the table secures, not from the permissions the user happens to
        // hold. Field security is default-deny: a user with no field security profile has a
        // permission row for nothing, and reading only their granted rows would report that user —
        // the common case — as having no restrictions at all, which is the exact opposite.
        const [securedAttributes, granted] = await Promise.all([
            this._getSecuredAttributes(entityLogicalName, getEntitySetName),
            SecurityAnalysisService.getSecuredColumnsForEntity(userId, entityLogicalName, getEntitySetName)
        ]);

        const grantedByColumn = new Map(granted.map(column => [column.attributelogicalname, column]));

        const columns = new Map();
        for (const logicalName of securedAttributes) {
            const permission = grantedByColumn.get(logicalName);
            // Field permissions use 4 for "allowed"; a missing row is a denial, not an absence.
            const canRead = permission?.canread === 4;
            const canUpdate = permission?.canupdate === 4;
            if (canRead && canUpdate) {
                // Secured, but fully granted to this user — not a restriction worth reporting.
                continue;
            }
            columns.set(logicalName, { canRead, canUpdate, profiles: permission?.profiles || [] });
        }
        return { columns };
    },

    /**
     * Lists the columns a table secures with field-level security.
     * @param {string} entityLogicalName - Table logical name
     * @param {Function} getEntitySetName - Entity set name resolver
     * @returns {Promise<string[]>} Logical names of secured columns
     * @private
     * @async
     */
    async _getSecuredAttributes(entityLogicalName, getEntitySetName) {
        const response = await WebApiService.webApiFetch(
            'GET',
            `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes`,
            '?$select=LogicalName,IsSecured',
            null,
            {},
            getEntitySetName
        );

        // Filtered client-side: $filter support on metadata collections is uneven, and the payload
        // is two columns wide.
        return (response?.value || [])
            .filter(attribute => attribute?.IsSecured === true)
            .map(attribute => attribute.LogicalName)
            .filter(Boolean);
    },

    /**
     * Splits the environment's model-driven apps by whether the user's roles grant access.
     * @param {string} userId - The user to ask about
     * @param {Function} getEntitySetName - Entity set name resolver
     * @returns {Promise<{visible: Array, hidden: Array, undetermined: Array}>}
     * @async
     */
    async getVisibleApps(userId, getEntitySetName) {
        const [roles, response] = await Promise.all([
            SecurityAnalysisService.getUserRoles(userId, getEntitySetName),
            WebApiService.webApiFetch(
                'GET',
                'appmodules',
                // Active apps only: counting drafts and disabled apps in the denominator would
                // understate access against a total the user can never reach.
                '?$select=appmoduleid,name,uniquename&$filter=statecode eq 0'
                + '&$expand=appmoduleroles_association($select=roleid,name)',
                null,
                {},
                getEntitySetName
            )
        ]);

        // Match on every role record the user holds, not just the root role: a user in a child
        // business unit is assigned a copy, and app assignments can reference either.
        const held = new Set();
        for (const role of roles) {
            held.add(_guidKey(role.roleid));
            (role.sourceRoleIds || []).forEach(id => held.add(_guidKey(id)));
        }

        const visible = [];
        const hidden = [];
        const undetermined = [];

        for (const app of response?.value || []) {
            const appRoles = app.appmoduleroles_association || [];
            const entry = { appmoduleid: app.appmoduleid, name: app.name, uniquename: app.uniquename };

            if (appRoles.length === 0) {
                // No role assignment usually means admin-only. Guessing either way would be a lie.
                undetermined.push(entry);
            } else if (appRoles.some(role => held.has(_guidKey(role.roleid)))) {
                visible.push(entry);
            } else {
                hidden.push(entry);
            }
        }

        return { visible, hidden, undetermined };
    },

    /**
     * Finds public views whose visibility is restricted to particular security roles.
     *
     * Role assignment lives in the `roledisplayconditionsxml` column, not in a relationship — the
     * savedquery table has no N:N to role. That column's schema is undocumented, so parsing is
     * best-effort: any GUID it contains is treated as a role id, and a shape we cannot read is
     * reported as unavailable rather than guessed at.
     * @param {string} userId - The user to ask about
     * @param {string} entityLogicalName - Table logical name
     * @param {Function} getEntitySetName - Entity set name resolver
     * @returns {Promise<{restricted: Array, hidden: Array}>}
     * @async
     */
    async getRoleScopedViews(userId, entityLogicalName, getEntitySetName) {
        const response = await WebApiService.webApiFetch(
            'GET',
            'savedqueries',
            '?$select=savedqueryid,name,roledisplayconditionsxml'
            + `&$filter=returnedtypecode eq '${entityLogicalName}' and querytype eq ${QUERY_TYPE_PUBLIC} and statecode eq 0`,
            null,
            {},
            getEntitySetName
        );

        const restricted = (response?.value || []).filter(v => String(v.roledisplayconditionsxml || '').trim());
        if (restricted.length === 0) {
            // Every view is visible to everyone — nothing worth reporting.
            return { restricted: [], hidden: [] };
        }

        const roles = await SecurityAnalysisService.getUserRoles(userId, getEntitySetName);
        const held = new Set();
        for (const role of roles) {
            held.add(_guidKey(role.roleid));
            (role.sourceRoleIds || []).forEach(id => held.add(_guidKey(id)));
        }

        const hidden = restricted.filter(view => {
            const roleIds = this._extractRoleIds(view.roledisplayconditionsxml);
            // An unreadable condition is not evidence of a restriction.
            return roleIds.length > 0 && !roleIds.some(id => held.has(id));
        }).map(v => ({ savedqueryid: v.savedqueryid, name: v.name }));

        return {
            restricted: restricted.map(v => ({ savedqueryid: v.savedqueryid, name: v.name })),
            hidden
        };
    },

    /**
     * Pulls role ids out of a view's role display conditions.
     * @param {string} xml - The `roledisplayconditionsxml` value
     * @returns {string[]} Normalized role ids, empty when none could be read
     * @private
     */
    _extractRoleIds(xml) {
        const matches = String(xml || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
        return matches ? matches.map(_guidKey) : [];
    },

    /**
     * Clears the session cache. Called when preview is switched off or the user changes.
     * @returns {void}
     */
    clearCache() {
        this._cache.clear();
    }
};
