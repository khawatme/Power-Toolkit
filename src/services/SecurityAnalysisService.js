/**
 * @file Security Analysis Service for comparing user permissions
 * @module services/SecurityAnalysisService
 * @description Provides security analysis functionality to compare user privileges,
 * roles, field security profiles, and entity permissions. Helps troubleshoot
 * why users can't see or access specific fields, buttons, or forms.
 */

import { PowerAppsApiService } from './PowerAppsApiService.js';
import { WebApiService } from './WebApiService.js';
import { MetadataService } from './MetadataService.js';
import { NotificationService } from './NotificationService.js';
import { Config } from '../constants/index.js';

/**
 * @typedef {Object} SecurityRole
 * @property {string} roleid - The root role identifier, stable across business units
 * @property {string[]} sourceRoleIds - The role records actually assigned, for id-keyed lookups
 * @property {string} name - The display name of the role
 * @property {boolean} [isInherited] - Whether the role is inherited from a team
 * @property {Array<{teamId: string, teamName: string}>} [teams] - Array of teams providing this role (only for inherited roles)
 */

/**
 * @typedef {Object} EntityPrivilege
 * @property {string} name - The privilege name (e.g., prvReadAccount)
 * @property {string} privilegeid - The unique identifier
 * @property {string} depth - The access level (Basic, Local, Deep, Global)
 */

/**
 * @typedef {Object} FieldSecurityProfile
 * @property {string} fieldsecurityprofileid - The unique identifier
 * @property {string} name - The profile name
 * @property {Array<FieldPermission>} permissions - Field permissions in this profile
 */

/**
 * @typedef {Object} FieldPermission
 * @property {string} entityname - The table logical name
 * @property {string} attributelogicalname - The column logical name
 * @property {number} canread - Read permission (0=Not Allowed, 4=Allowed)
 * @property {number} cancreate - Create permission (0=Not Allowed, 4=Allowed)
 * @property {number} canupdate - Update permission (0=Not Allowed, 4=Allowed)
 */

/**
 * @typedef {Object} SecurityComparison
 * @property {Array<SecurityRole>} currentUserRoles - Roles of the current user
 * @property {Array<SecurityRole>} targetUserRoles - Roles of the target user
 * @property {Array<SecurityRole>} commonRoles - Roles that both users have
 * @property {Array<SecurityRole>} currentUserOnlyRoles - Roles only the current user has
 * @property {Array<SecurityRole>} targetUserOnlyRoles - Roles only the target user has
 * @property {Array<FieldSecurityProfile>} targetUserFieldProfiles - Field security profiles of target user
 * @property {Array<EntityPrivilege>} entityPrivileges - Entity privileges for target user
 */


/**
 * Verb reported in the Entity Privileges table, keyed by the `PrivilegeType` the platform returns
 * for each privilege in table metadata.
 *
 * Reading the type from metadata removes all guesswork: privilege *names* do not follow the table's
 * logical name (`systemuser` is granted by `prvReadUser`, activity tables share `prvReadActivity`),
 * so any name-matching scheme silently reports "No Access" for those tables.
 * @private
 * @type {Object<string, string>}
 */
const PRIVILEGE_TYPE_TO_VERB = {
    Create: 'create',
    Read: 'read',
    Write: 'write',
    Delete: 'delete',
    Assign: 'assign',
    Share: 'share',
    Append: 'append',
    AppendTo: 'appendto'
};

/**
 * Display label for each `Depth` value returned by the privilege-retrieval messages.
 * @private
 * @type {Object<string, string>}
 */
const DEPTH_LABELS = {
    Basic: 'Basic (User)',
    Local: 'Local (BU)',
    Deep: 'Deep (BU + Child)',
    Global: 'Global (Org)'
};

/**
 * Depth ranking, used to keep the strongest grant when several roles grant the same privilege.
 * @private
 * @type {Object<string, number>}
 */
const DEPTH_RANK = { Basic: 0, Local: 1, Deep: 2, Global: 3 };

/** Verb keys every privilege result carries, in the order the UI renders them. @private */
const PRIVILEGE_VERBS = ['read', 'create', 'write', 'delete', 'append', 'appendto', 'assign', 'share'];

/**
 * Builds the "no privileges known" result every entity-privilege lookup starts from.
 * @private
 * @returns {Object<string, {hasPrivilege: boolean, depth: string|null, roles: string[]}>}
 */
function _emptyPrivilegeSet() {
    return PRIVILEGE_VERBS.reduce((acc, verb) => {
        acc[verb] = { hasPrivilege: false, depth: null, roles: [] };
        return acc;
    }, {});
}

/**
 * Normalizes the `Depth` of a returned role privilege to a {@link DEPTH_RANK} key.
 *
 * The documented responses use the enum member name, but OData enums can also arrive as their
 * ordinal. Silently dropping an ordinal would report a held privilege as denied — the exact failure
 * this lookup exists to avoid — so both forms are accepted.
 * @private
 * @param {string|number} depth - The `Depth` value from a RolePrivilege
 * @returns {string|null} A DEPTH_RANK key, or null when unrecognized
 */
function _normalizeDepth(depth) {
    if (typeof depth === 'string' && depth in DEPTH_RANK) {
        return depth;
    }
    if (Number.isInteger(depth)) {
        return Object.keys(DEPTH_RANK).find(name => DEPTH_RANK[name] === depth) || null;
    }
    return null;
}

/**
 * Normalizes a GUID for use as a map key. Dataverse is inconsistent about casing and braces
 * between metadata, function responses and table rows.
 * @private
 * @param {string} guid - The value to normalize
 * @returns {string} Lowercase GUID without braces, or an empty string
 */
function _guidKey(guid) {
    return String(guid || '').replace(/[{}]/g, '').toLowerCase();
}

/**
 * Security Analysis Service - provides tools to analyze and compare user security settings.
 */
export const SecurityAnalysisService = {

    /**
     * Gets the security roles for the current user.
     * Fetches roles using Web API to get consistent _parentrootroleid_value for comparison.
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array<SecurityRole>>} Array of security roles
     * @async
     */
    async getCurrentUserRoles(getEntitySetName = MetadataService.getEntitySetName) {
        try {
            const gc = PowerAppsApiService.getGlobalContext();
            const userId = gc?.userSettings?.userId?.replace(/[{}]/g, '');

            if (!userId) {
                return [];
            }

            // Fetch roles using Web API to get _parentrootroleid_value
            // This ensures consistent role IDs across business units for comparison
            return await this.getUserRoles(userId, getEntitySetName);
        } catch (error) {
            NotificationService.show(Config.MESSAGES.COMMON?.operationFailed?.(error.message) || `Failed to get current user roles: ${error.message}`, 'error');
            return [];
        }
    },

    /**
     * Gets the team memberships for the current user.
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array<Team>>} Array of teams
     * @async
     */
    async getCurrentUserTeams(getEntitySetName = MetadataService.getEntitySetName) {
        try {
            const gc = PowerAppsApiService.getGlobalContext();
            const userId = gc?.userSettings?.userId?.replace(/[{}]/g, '');

            if (!userId) {
                return [];
            }

            return await this.getUserTeams(userId, getEntitySetName);
        } catch (error) {
            NotificationService.show(Config.MESSAGES.COMMON?.operationFailed?.(error.message) || `Failed to get current user teams: ${error.message}`, 'error');
            return [];
        }
    },

    /**
     * Gets the security roles for a specific user by ID.
     * Includes both direct roles and roles inherited from teams.
     * @param {string} userId - The system user ID
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array<SecurityRole>>} Array of security roles
     * @async
     */
    async getUserRoles(userId, getEntitySetName = MetadataService.getEntitySetName) {
        try {
            return await this._fetchUserRoles(userId, getEntitySetName);
        } catch (error) {
            NotificationService.show(Config.MESSAGES.COMMON?.operationFailed?.(error.message) || `Failed to get user roles: ${error.message}`, 'error');
            return [];
        }
    },

    /**
     * Reports whether a user holds any security role at all, directly or through a team.
     *
     * Unlike {@link getUserRoles} this propagates failures instead of returning an empty array, so
     * callers can tell "holds no roles" from "could not ask" — a user genuinely without roles fails
     * every request while impersonated, which is worth warning about; a failed lookup is not.
     * @param {string} userId - The system user ID
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<boolean>} True when the user holds at least one role
     * @throws {Error} When the roles cannot be read
     * @async
     */
    async hasAnySecurityRole(userId, getEntitySetName = MetadataService.getEntitySetName) {
        const roles = await this._fetchUserRoles(userId, getEntitySetName);
        return roles.length > 0;
    },

    /**
     * Fetches a user's direct and team-inherited roles, throwing on failure.
     * @param {string} userId - The system user ID
     * @param {Function} getEntitySetName - Entity set name resolver
     * @returns {Promise<Array<SecurityRole>>} Array of security roles
     * @private
     * @async
     */
    async _fetchUserRoles(userId, getEntitySetName) {
        // Handle null userId by getting current user
        let actualUserId = userId;
        if (!actualUserId) {
            const currentUserId = PowerAppsApiService.getGlobalContext()?.userSettings?.userId;
            if (!currentUserId) {
                return [];
            }
            actualUserId = currentUserId.replace(/[{}]/g, '');
        }

        // Fetch direct roles (full records) and team memberships in parallel
        // We need all fields to access _parentrootroleid_value which is the consistent root role ID
        const [directRolesResponse, teamsResponse] = await Promise.all([
            WebApiService.webApiFetch(
                'GET',
                `systemusers(${actualUserId})/systemuserroles_association`,
                '',
                null,
                {},
                getEntitySetName
            ),
            WebApiService.webApiFetch(
                'GET',
                `systemusers(${actualUserId})/teammembership_association?$select=teamid,name`,
                '',
                null,
                {},
                getEntitySetName
            )
        ]);

        // `roleid` is the root role so the same role compares equal across business units;
        // `sourceRoleIds` keeps the records actually assigned, which is what tables such as
        // roleprivilegescollection are keyed by.
        const directRoles = (directRolesResponse?.value || []).map(r => ({
            roleid: r._parentrootroleid_value || r.roleid,
            sourceRoleIds: [r.roleid],
            name: r.name,
            isInherited: false
        }));

        const teams = (teamsResponse?.value || []);
        const teamIds = teams.map(t => t.teamid);

        // Fetch team roles (full records) for all teams in parallel
        let teamRoles = [];
        if (teamIds.length > 0) {
            const teamRolePromises = teamIds.map((teamId, index) =>
                WebApiService.webApiFetch(
                    'GET',
                    `teams(${teamId})/teamroles_association`,
                    '',
                    null,
                    {},
                    getEntitySetName
                ).then(result => ({ teamId, teamName: teams[index].name, result }))
                    .catch(() => ({ teamId, teamName: teams[index].name, result: { value: [] } }))
            );

            const teamRoleResults = await Promise.all(teamRolePromises);
            teamRoles = teamRoleResults.flatMap(({ teamId, teamName, result }) =>
                (result?.value || []).map(r => ({
                    roleid: r._parentrootroleid_value || r.roleid,
                    sourceRoleIds: [r.roleid],
                    name: r.name,
                    isInherited: true,
                    teamId,
                    teamName
                }))
            );
        }

        // Group roles, tracking all teams that provide each inherited role
        const roleMap = new Map();
        for (const role of directRoles) {
            roleMap.set(role.roleid, role);
        }
        for (const role of teamRoles) {
            if (!roleMap.has(role.roleid)) {
                roleMap.set(role.roleid, {
                    ...role,
                    teams: [{ teamId: role.teamId, teamName: role.teamName }]
                });
                continue;
            }

            const existing = roleMap.get(role.roleid);
            // The same root role can reach the user through several business-unit copies; every
            // one of them is a record that could carry the privilege rows.
            for (const sourceId of role.sourceRoleIds) {
                if (!existing.sourceRoleIds.includes(sourceId)) {
                    existing.sourceRoleIds.push(sourceId);
                }
            }
            if (existing.isInherited) {
                if (!existing.teams) {
                    existing.teams = [];
                }
                existing.teams.push({ teamId: role.teamId, teamName: role.teamName });
            }
        }

        return Array.from(roleMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    },

    /**
     * Gets the field security profiles associated with a user.
     * Includes both direct user profiles and team-inherited profiles.
     * @param {string} userId - The system user ID
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array<FieldSecurityProfile>>} Array of field security profiles
     * @async
     */
    async getUserFieldSecurityProfiles(userId, getEntitySetName = MetadataService.getEntitySetName) {
        // Handle null userId by getting current user
        let actualUserId = userId;
        if (!actualUserId) {
            const currentUserId = PowerAppsApiService.getGlobalContext()?.userSettings?.userId;
            if (!currentUserId) {
                return [];
            }
            actualUserId = currentUserId.replace(/[{}]/g, '');
        }

        try {
            // Fetch direct user profiles and team memberships in parallel
            const [directProfilesResponse, teamsResponse] = await Promise.all([
                WebApiService.webApiFetch(
                    'GET',
                    `systemusers(${actualUserId})/systemuserprofiles_association?$select=fieldsecurityprofileid,name`,
                    '',
                    null,
                    {},
                    getEntitySetName
                ).catch(() => ({ value: [] })),
                WebApiService.webApiFetch(
                    'GET',
                    `systemusers(${actualUserId})/teammembership_association?$select=teamid`,
                    '',
                    null,
                    {},
                    getEntitySetName
                ).catch(() => ({ value: [] }))
            ]);

            const directProfiles = (directProfilesResponse?.value || []).map(p => ({
                fieldsecurityprofileid: p.fieldsecurityprofileid,
                name: p.name,
                permissions: [],
                isInherited: false
            }));

            // Fetch team profiles for all teams in parallel
            const teamIds = (teamsResponse?.value || []).map(t => t.teamid);
            let teamProfiles = [];

            if (teamIds.length > 0) {
                const teamProfilePromises = teamIds.map(teamId =>
                    WebApiService.webApiFetch(
                        'GET',
                        `teams(${teamId})/teamprofiles_association?$select=fieldsecurityprofileid,name`,
                        '',
                        null,
                        {},
                        getEntitySetName
                    ).catch(() => ({ value: [] }))
                );

                const teamProfileResults = await Promise.all(teamProfilePromises);
                teamProfiles = teamProfileResults.flatMap(result =>
                    (result?.value || []).map(p => ({
                        fieldsecurityprofileid: p.fieldsecurityprofileid,
                        name: p.name,
                        permissions: [],
                        isInherited: true
                    }))
                );
            }

            // Deduplicate by profile ID, preferring direct profiles
            const profileMap = new Map();
            for (const profile of directProfiles) {
                profileMap.set(profile.fieldsecurityprofileid, profile);
            }
            for (const profile of teamProfiles) {
                if (!profileMap.has(profile.fieldsecurityprofileid)) {
                    profileMap.set(profile.fieldsecurityprofileid, profile);
                }
            }

            return Array.from(profileMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            NotificationService.show(Config.MESSAGES.COMMON?.operationFailed?.(error.message) || `Failed to get field security profiles: ${error.message}`, 'error');
            return [];
        }
    },

    /**
     * Gets the field permissions for a specific field security profile and entity.
     * @param {string} profileId - The field security profile ID
     * @param {string} [entityName] - Optional: filter by entity name
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array<FieldPermission>>} Array of field permissions
     * @async
     */
    async getFieldPermissions(profileId, entityName = null, getEntitySetName = MetadataService.getEntitySetName) {
        if (!profileId) {
            return [];
        }

        try {
            let filter = '';
            if (entityName) {
                filter = `&$filter=entityname eq '${entityName}'`;
            }

            const response = await WebApiService.webApiFetch(
                'GET',
                `fieldsecurityprofiles(${profileId})/lk_fieldpermission_fieldsecurityprofileid?$select=entityname,attributelogicalname,canread,cancreate,canupdate${filter}`,
                '',
                null,
                {},
                getEntitySetName
            );

            return (response?.value || []).map(p => ({
                entityname: p.entityname,
                attributelogicalname: p.attributelogicalname,
                canread: p.canread,
                cancreate: p.cancreate,
                canupdate: p.canupdate
            }));
        } catch (error) {
            NotificationService.show(Config.MESSAGES.COMMON?.operationFailed?.(error.message) || `Failed to get field permissions: ${error.message}`, 'error');
            return [];
        }
    },

    /**
     * Gets the teams that a user belongs to.
     * @param {string} userId - The system user ID
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array<Object>>} Array of teams with id, name, and type
     * @async
     */
    async getUserTeams(userId, getEntitySetName = MetadataService.getEntitySetName) {
        // Handle null userId by getting current user
        let actualUserId = userId;
        if (!actualUserId) {
            const currentUserId = PowerAppsApiService.getGlobalContext()?.userSettings?.userId;
            if (!currentUserId) {
                return [];
            }
            actualUserId = currentUserId.replace(/[{}]/g, '');
        }

        try {
            const response = await WebApiService.webApiFetch(
                'GET',
                `systemusers(${actualUserId})/teammembership_association?$select=teamid,name,teamtype`,
                '',
                null,
                {},
                getEntitySetName
            );

            return (response?.value || []).map(t => ({
                teamid: t.teamid,
                name: t.name,
                teamtype: this._getTeamTypeName(t.teamtype)
            })).sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            NotificationService.show(Config.MESSAGES.COMMON?.operationFailed?.(error.message) || `Failed to get user teams: ${error.message}`, 'error');
            return [];
        }
    },

    /**
     * Converts team type code to human-readable name.
     * @param {number} teamtype - The team type code
     * @returns {string} Human-readable team type name
     * @private
     */
    _getTeamTypeName(teamtype) {
        switch (teamtype) {
            case 0:
                return 'Owner';
            case 1:
                return 'Access';
            case 2:
                return 'AAD Security Group';
            case 3:
                return 'AAD Office Group';
            default:
                return 'Unknown';
        }
    },

    /**
     * Gets the entity-specific privileges for a user for a specific entity.
     * Queries the user's roles and checks which privileges they have for the entity.
     * @param {string} userId - The system user ID
     * @param {string} entityLogicalName - The entity logical name
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Object>} Object with CRUD privilege flags and depth
     * @async
     */
    async getUserEntityPrivileges(userId, entityLogicalName, getEntitySetName = MetadataService.getEntitySetName) {
        const privileges = _emptyPrivilegeSet();

        // Handle null userId by getting current user
        let actualUserId = userId;
        if (!actualUserId) {
            const currentUserId = PowerAppsApiService.getGlobalContext()?.userSettings?.userId;
            if (!currentUserId) {
                return privileges;
            }
            actualUserId = currentUserId.replace(/[{}]/g, '');
        }

        if (!entityLogicalName) {
            return privileges;
        }

        let privilegeMetadata;
        try {
            privilegeMetadata = await this._getEntityPrivilegeMetadata(entityLogicalName, getEntitySetName);
        } catch (error) {
            // A failure here is not the same as "no access" — say so rather than let the table
            // claim the user is locked out of a table they may well own.
            privileges.unavailable = error.message;
            return privileges;
        }

        if (privilegeMetadata.size === 0) {
            return privileges;
        }

        try {
            const depths = await this._retrieveHeldPrivileges(actualUserId, [...privilegeMetadata.keys()], getEntitySetName);
            for (const [privilegeId, depth] of depths) {
                const verb = privilegeMetadata.get(privilegeId)?.verb;
                if (verb) {
                    privileges[verb] = { hasPrivilege: true, depth: DEPTH_LABELS[depth], roles: [] };
                }
            }
        } catch (error) {
            privileges.unavailable = error.message;
            return privileges;
        }

        // Which roles grant each privilege is a diagnostic nicety layered on top of an answer we
        // already have, so a failure here degrades the badge list rather than the verdict.
        try {
            await this._attachGrantingRoles(actualUserId, privilegeMetadata, privileges, getEntitySetName);
        } catch {
            // Privilege depths stand on their own without role attribution.
        }

        return privileges;
    },

    /**
     * Reads the privileges that guard a table straight from its metadata.
     *
     * `EntityMetadata.Privileges` states each privilege's `PrivilegeType`, so the verb never has to
     * be inferred from the privilege name.
     * @param {string} entityLogicalName - The entity logical name
     * @param {Function} getEntitySetName - Entity set name resolver
     * @returns {Promise<Map<string, {verb: string, name: string}>>} Privilege id → verb and name
     * @private
     * @async
     */
    async _getEntityPrivilegeMetadata(entityLogicalName, getEntitySetName) {
        const response = await WebApiService.webApiFetch(
            'GET',
            `EntityDefinitions(LogicalName='${entityLogicalName}')`,
            '?$select=LogicalName,Privileges',
            null,
            {},
            getEntitySetName
        );

        const byId = new Map();
        for (const privilege of response?.Privileges || []) {
            const verb = PRIVILEGE_TYPE_TO_VERB[privilege?.PrivilegeType];
            const id = _guidKey(privilege?.PrivilegeId);
            if (verb && id) {
                byId.set(id, { verb, name: privilege.Name });
            }
        }
        return byId;
    },

    /**
     * Asks the platform which of the given privileges a user actually holds, and at what depth.
     *
     * `RetrieveUserSetOfPrivilegesByIds` accounts for direct roles, team-inherited roles and the
     * System Administrator role in one call — which role-by-role queries against
     * `roleprivilegescollection` do not, because the role ids a user is assigned in a child business
     * unit are copies of the ones those queries look for.
     * @param {string} userId - The system user ID
     * @param {string[]} privilegeIds - Privilege ids to test
     * @param {Function} getEntitySetName - Entity set name resolver
     * @returns {Promise<Map<string, string>>} Privilege id → highest depth held ('Basic'…'Global')
     * @private
     * @async
     */
    async _retrieveHeldPrivileges(userId, privilegeIds, getEntitySetName) {
        const wanted = new Set(privilegeIds);
        try {
            const response = await WebApiService.webApiFetch(
                'GET',
                `systemusers(${userId})/Microsoft.Dynamics.CRM.RetrieveUserSetOfPrivilegesByIds(PrivilegeIds=@p1)`,
                `?@p1=${encodeURIComponent(JSON.stringify(privilegeIds))}`,
                null,
                {},
                getEntitySetName
            );
            return this._toDepthMap(response, wanted);
        } catch {
            // RetrieveUserPrivileges takes no parameters, so it survives anything that upsets the
            // collection-parameter call. It reports team-inherited privileges as Basic depth
            // regardless of the team role's real depth, so it is the second choice, not the first.
            const response = await WebApiService.webApiFetch(
                'GET',
                `systemusers(${userId})/Microsoft.Dynamics.CRM.RetrieveUserPrivileges`,
                '',
                null,
                {},
                getEntitySetName
            );
            return this._toDepthMap(response, wanted);
        }
    },

    /**
     * Reduces a `RolePrivileges` response to the strongest depth held per requested privilege.
     * @param {Object} response - A response carrying a `RolePrivileges` collection
     * @param {Set<string>} wanted - Privilege ids to keep
     * @returns {Map<string, string>} Privilege id → highest depth held
     * @private
     */
    _toDepthMap(response, wanted) {
        const depths = new Map();
        for (const rolePrivilege of response?.RolePrivileges || []) {
            const id = _guidKey(rolePrivilege?.PrivilegeId);
            const depth = _normalizeDepth(rolePrivilege?.Depth);
            if (!wanted.has(id) || !depth) {
                continue;
            }
            const held = depths.get(id);
            if (held === undefined || DEPTH_RANK[depth] > DEPTH_RANK[held]) {
                depths.set(id, depth);
            }
        }
        return depths;
    },

    /**
     * Names the roles that grant each privilege the user was found to hold.
     * @param {string} userId - The system user ID
     * @param {Map<string, {verb: string}>} privilegeMetadata - Privilege id → verb
     * @param {Object} privileges - The privileges object to annotate in place
     * @param {Function} getEntitySetName - Entity set name resolver
     * @returns {Promise<void>}
     * @private
     * @async
     */
    async _attachGrantingRoles(userId, privilegeMetadata, privileges, getEntitySetName) {
        const roles = await this.getUserRoles(userId, getEntitySetName);
        const roleNames = new Map();
        for (const role of roles) {
            for (const id of role.sourceRoleIds || []) {
                roleNames.set(_guidKey(id), role.name);
            }
            roleNames.set(_guidKey(role.roleid), role.name);
        }
        if (roleNames.size === 0) {
            return;
        }

        // One request: the filter is bounded by the table's handful of privileges and the user's
        // roles, so it can never page.
        const privilegeFilter = [...privilegeMetadata.keys()].map(id => `privilegeid eq '${id}'`).join(' or ');
        const roleFilter = [...roleNames.keys()].map(id => `roleid eq '${id}'`).join(' or ');
        const response = await WebApiService.webApiFetch(
            'GET',
            'roleprivilegescollection',
            `?$select=roleid,privilegeid&$filter=(${privilegeFilter}) and (${roleFilter})`,
            null,
            {},
            getEntitySetName
        );

        for (const row of response?.value || []) {
            const verb = privilegeMetadata.get(_guidKey(row?.privilegeid))?.verb;
            const roleName = roleNames.get(_guidKey(row?.roleid));
            const privilege = verb ? privileges[verb] : null;
            if (privilege?.hasPrivilege && roleName && !privilege.roles.includes(roleName)) {
                privilege.roles.push(roleName);
            }
        }

        for (const verb of PRIVILEGE_VERBS) {
            privileges[verb].roles.sort((a, b) => a.localeCompare(b));
        }
    },

    /**
     * Compares security settings between the current user and a target user.
     * @param {string} targetUserId - The target user's system user ID
     * @param {string} [entityLogicalName] - Optional: entity to check privileges for
     * @param {string|null} [comparisonUserId] - Optional: comparison user ID (null = current user)
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<SecurityComparison>} Security comparison object
     * @async
     */
    async compareUserSecurity(targetUserId, entityLogicalName = null, comparisonUserId = null, getEntitySetName = MetadataService.getEntitySetName) {
        const [currentUserRoles, currentUserTeams, targetUserRoles, targetUserFieldProfiles, targetUserTeams] = await Promise.all([
            this.getUserRoles(comparisonUserId, getEntitySetName),
            this.getUserTeams(comparisonUserId, getEntitySetName),
            this.getUserRoles(targetUserId, getEntitySetName),
            this.getUserFieldSecurityProfiles(targetUserId, getEntitySetName),
            this.getUserTeams(targetUserId, getEntitySetName)
        ]);

        const currentRoleIds = new Set(currentUserRoles.map(r => r.roleid));
        const targetRoleIds = new Set(targetUserRoles.map(r => r.roleid));

        const commonRoles = currentUserRoles.filter(r => targetRoleIds.has(r.roleid));
        const currentUserOnlyRoles = currentUserRoles.filter(r => !targetRoleIds.has(r.roleid));
        const targetUserOnlyRoles = targetUserRoles.filter(r => !currentRoleIds.has(r.roleid));

        let entityPrivileges = null;
        let comparisonUserEntityPrivileges = null;
        if (entityLogicalName) {
            [entityPrivileges, comparisonUserEntityPrivileges] = await Promise.all([
                this.getUserEntityPrivileges(targetUserId, entityLogicalName, getEntitySetName),
                this.getUserEntityPrivileges(comparisonUserId, entityLogicalName, getEntitySetName)
            ]);
        }

        const comparisonUserFieldProfiles = await this.getUserFieldSecurityProfiles(comparisonUserId, getEntitySetName);

        await Promise.all([
            this._attachFieldPermissions(targetUserFieldProfiles, entityLogicalName, getEntitySetName),
            this._attachFieldPermissions(comparisonUserFieldProfiles, entityLogicalName, getEntitySetName)
        ]);

        return {
            currentUserRoles,
            currentUserTeams,
            targetUserRoles,
            commonRoles,
            currentUserOnlyRoles,
            targetUserOnlyRoles,
            targetUserFieldProfiles,
            targetUserTeams,
            entityPrivileges,
            comparisonUserEntityPrivileges,
            comparisonUserFieldProfiles
        };
    },

    /**
     * Loads each profile's field permissions for an entity, in parallel, onto `profile.permissions`.
     * A user can hold many field security profiles, and the sequential version made one round trip
     * per profile per user on a path the preview overlay hits on every toggle.
     * @param {Array<FieldSecurityProfile>} profiles - Profiles to annotate in place
     * @param {string|null} entityLogicalName - Entity to scope permissions to; no-op when absent
     * @param {Function} getEntitySetName - Entity set name resolver
     * @returns {Promise<void>}
     * @private
     * @async
     */
    async _attachFieldPermissions(profiles, entityLogicalName, getEntitySetName) {
        if (!entityLogicalName || !profiles?.length) {
            return;
        }

        const permissions = await Promise.all(profiles.map(profile =>
            this.getFieldPermissions(profile.fieldsecurityprofileid, entityLogicalName, getEntitySetName)
        ));
        profiles.forEach((profile, index) => {
            profile.permissions = permissions[index];
        });
    },

    /**
     * Gets a list of secured columns for a specific entity that the user has restrictions on.
     * @param {string} userId - The system user ID
     * @param {string} entityLogicalName - The entity logical name
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array<Object>>} Array of restricted columns with their permissions
     * @async
     */
    async getSecuredColumnsForEntity(userId, entityLogicalName, getEntitySetName = MetadataService.getEntitySetName) {
        if (!userId || !entityLogicalName) {
            return [];
        }

        try {
            const profiles = await this.getUserFieldSecurityProfiles(userId, getEntitySetName);

            if (profiles.length === 0) {
                return [];
            }

            await this._attachFieldPermissions(profiles, entityLogicalName, getEntitySetName);

            const allPermissions = profiles.flatMap(profile =>
                (profile.permissions || []).map(perm => ({ ...perm, profileName: profile.name }))
            );

            const columnMap = new Map();
            for (const perm of allPermissions) {
                const key = perm.attributelogicalname;
                if (!columnMap.has(key)) {
                    columnMap.set(key, {
                        attributelogicalname: perm.attributelogicalname,
                        canread: perm.canread,
                        cancreate: perm.cancreate,
                        canupdate: perm.canupdate,
                        profiles: [perm.profileName]
                    });
                } else {
                    const existing = columnMap.get(key);
                    existing.canread = Math.max(existing.canread, perm.canread);
                    existing.cancreate = Math.max(existing.cancreate, perm.cancreate);
                    existing.canupdate = Math.max(existing.canupdate, perm.canupdate);
                    if (!existing.profiles.includes(perm.profileName)) {
                        existing.profiles.push(perm.profileName);
                    }
                }
            }

            return Array.from(columnMap.values()).sort((a, b) =>
                a.attributelogicalname.localeCompare(b.attributelogicalname)
            );
        } catch (error) {
            NotificationService.show(Config.MESSAGES.COMMON?.operationFailed?.(error.message) || `Failed to get secured columns: ${error.message}`, 'error');
            return [];
        }
    },

    /**
     * Generates a link to the Power Platform Admin Center for user management.
     * @returns {string} The admin center URL
     */
    generateAdminCenterLink() {
        return 'https://admin.powerplatform.microsoft.com/environments';
    },
    /**
     * Generates a link to the Microsoft Entra Admin Center.
     * @returns {string} The Entra admin center URL
     */
    generateEntraLink() {
        return 'https://entra.microsoft.com/';
    },
    /**
     * Formats a privilege permission value to a human-readable string.
     * @param {number} value - The permission value (0 = Not Allowed, 4 = Allowed)
     * @returns {string} Human-readable permission string
     */
    formatPermissionValue(value) {
        return value === 4 ? 'Allowed' : 'Not Allowed';
    },

    /**
     * Checks if a permission is allowed.
     * @param {number} value - The permission value
     * @returns {boolean} True if allowed
     */
    isPermissionAllowed(value) {
        return value === 4;
    }
};
