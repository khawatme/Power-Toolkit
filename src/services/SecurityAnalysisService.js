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
 * @property {string} roleid - The unique identifier of the role
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

            // Use _parentrootroleid_value (root role ID) if available, otherwise use roleid
            // This ensures consistent role IDs across business units and environments
            const directRoles = (directRolesResponse?.value || []).map(r => ({
                roleid: r._parentrootroleid_value || r.roleid,
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
                } else if (roleMap.get(role.roleid).isInherited) {
                    const existing = roleMap.get(role.roleid);
                    if (!existing.teams) {
                        existing.teams = [];
                    }
                    existing.teams.push({ teamId: role.teamId, teamName: role.teamName });
                }
            }

            return Array.from(roleMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            NotificationService.show(Config.MESSAGES.COMMON?.operationFailed?.(error.message) || `Failed to get user roles: ${error.message}`, 'error');
            return [];
        }
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
        const privilegeVerbs = ['Read', 'Create', 'Write', 'Delete', 'Append', 'AppendTo', 'Assign', 'Share'];

        const privileges = {};
        for (const verb of privilegeVerbs) {
            privileges[verb.toLowerCase()] = { hasPrivilege: false, depth: null, roles: [] };
        }

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

        try {
            const entityPrivileges = await this._getEntityPrivilegesFromMetadata(entityLogicalName, getEntitySetName);

            if (entityPrivileges.length === 0) {
                return privileges;
            }

            const privilegeIdToInfo = new Map();
            for (const priv of entityPrivileges) {
                const name = priv.name || '';
                for (const verb of privilegeVerbs) {
                    const pattern = verb === 'Append'
                        ? new RegExp(`^prv${verb}(?!To)`, 'i')
                        : new RegExp(`^prv${verb}`, 'i');

                    if (pattern.test(name)) {
                        privilegeIdToInfo.set(priv.privilegeid, { verb: verb.toLowerCase(), name: priv.name });
                        break;
                    }
                }
            }

            const userRoles = await this.getUserRoles(actualUserId, getEntitySetName);

            for (const role of userRoles) {
                await this._checkRolePrivileges(role, privilegeIdToInfo, privileges, getEntitySetName);
            }

            return privileges;
        } catch (error) {
            NotificationService.show(Config.MESSAGES.COMMON?.operationFailed?.(error.message) || `Failed to get entity privileges: ${error.message}`, 'error');
            return privileges;
        }
    },

    /**
     * Checks privileges for a single role and updates the privileges object.
     * Queries the roleprivilegescollection entity to get privileges with depth information.
     * Handles pagination since roles can have more than 5000 privileges.
     * @param {Object} role - The role object with roleid
     * @param {Map} privilegeIdToInfo - Map of privilege IDs to privilege info
     * @param {Object} privileges - The privileges object to update
     * @param {Function} getEntitySetName - Entity set name resolver
     * @private
     * @async
     */
    async _checkRolePrivileges(role, privilegeIdToInfo, privileges, getEntitySetName) {
        try {
            // Query the roleprivilegescollection intersect entity directly
            // EntitySetName: roleprivilegescollection
            // Columns: roleid, privilegeid, privilegedepthmask (integer bit mask)
            // Bit masks: Basic=1, Local=2, Deep=4, Global=8
            // Note: GUIDs in OData filters must be enclosed in single quotes

            let roleIdValue = role.roleid;
            if (typeof roleIdValue === 'object' && roleIdValue !== null) {
                roleIdValue = roleIdValue.guid || roleIdValue.value || roleIdValue.toString();
            }

            roleIdValue = String(roleIdValue || '').trim();
            if (!roleIdValue) {
                return;
            }

            const guidMatch = roleIdValue.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
            const cleanRoleId = guidMatch ? guidMatch[0] : roleIdValue;

            const allRolePrivs = [];
            let nextUrl = 'roleprivilegescollection?$select=privilegeid,privilegedepthmask&$filter=roleid eq \'' + cleanRoleId + '\'';

            while (nextUrl) {
                const rolePrivResponse = await WebApiService.webApiFetch(
                    'GET',
                    nextUrl,
                    '',
                    null,
                    {},
                    getEntitySetName
                );

                if (rolePrivResponse?.value) {
                    allRolePrivs.push(...rolePrivResponse.value);
                }

                if (rolePrivResponse?.['@odata.nextLink']) {
                    const nextLink = rolePrivResponse['@odata.nextLink'];
                    const match = nextLink.match(/\/api\/data\/v[\d.]+\/(.+)/);
                    nextUrl = match ? match[1] : null;
                } else {
                    nextUrl = null;
                }
            }

            for (const rolePriv of allRolePrivs) {
                this._updatePrivilegeIfBetter(rolePriv, privilegeIdToInfo, privileges, role.name);
            }
        } catch {
            // Continue checking other roles even if one fails
        }
    },

    /**
     * Updates the privilege if the new depth is better than existing.
     * Handles role privilege objects from roleprivilegescollection entity.
     * @param {Object} rolePriv - The role privilege object with privilegeid and privilegedepthmask
     * @param {Map} privilegeIdToInfo - Map of privilege IDs to privilege info
     * @param {Object} privileges - The privileges object to update
     * @param {string} roleName - Name of the role granting this privilege
     * @private
     */
    _updatePrivilegeIfBetter(rolePriv, privilegeIdToInfo, privileges, roleName) {
        // roleprivilegescollection returns privilegeid and privilegedepthmask (integer bit mask)
        const privilegeId = rolePriv.privilegeid;
        const privInfo = privilegeIdToInfo.get(privilegeId);
        if (!privInfo) {
            return;
        }

        const existingPriv = privileges[privInfo.verb];
        // privilegedepthmask is an integer bit mask:
        // Basic = 1 (0x00000001)
        // Local = 2 (0x00000002)
        // Deep = 4 (0x00000004)
        // Global = 8 (0x00000008)
        const depthMask = rolePriv.privilegedepthmask;

        if (!existingPriv.hasPrivilege || this._compareDepth(depthMask, existingPriv.depth) >= 0) {
            const depthName = this._getDepthName(depthMask);

            if (!existingPriv.hasPrivilege || this._compareDepth(depthMask, existingPriv.depth) > 0) {
                privileges[privInfo.verb] = {
                    hasPrivilege: true,
                    depth: depthName,
                    roles: [roleName]
                };
            } else if (this._compareDepth(depthMask, existingPriv.depth) === 0) {
                if (!existingPriv.roles.includes(roleName)) {
                    existingPriv.roles.push(roleName);
                }
            }
        }
    },

    /**
     * Gets the privileges linked to a specific entity from metadata.
     * Uses the entity's ObjectTypeCode to find associated privileges.
     * @param {string} entityLogicalName - The entity logical name
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array>} Array of privilege objects with privilegeid and name
     * @async
     * @private
     */
    async _getEntityPrivilegesFromMetadata(entityLogicalName, getEntitySetName) {
        try {
            const entityResponse = await WebApiService.webApiFetch(
                'GET',
                `EntityDefinitions(LogicalName='${entityLogicalName}')?$select=ObjectTypeCode,LogicalName,IsActivity`,
                '',
                null,
                {},
                getEntitySetName
            );

            const objectTypeCode = entityResponse?.ObjectTypeCode;
            if (!objectTypeCode) {
                return [];
            }

            const isActivityEntity = entityResponse?.IsActivity === true;
            const entityToUseForPrivileges = isActivityEntity && entityLogicalName !== 'activitypointer'
                ? 'activitypointer'
                : entityLogicalName;


            const allPrivileges = await this._fetchAllPrivileges(getEntitySetName);

            const privilegeEntityName = entityToUseForPrivileges === 'activitypointer' ? 'activity' : entityToUseForPrivileges;
            const entityNameLower = privilegeEntityName.toLowerCase();
            const entityPrivileges = allPrivileges.filter(p => {
                const nameLower = (p.name || '').toLowerCase();
                return nameLower.endsWith(entityNameLower);
            });

            return entityPrivileges;
        } catch (error) {
            NotificationService.show(Config.MESSAGES.COMMON?.operationFailed?.(error.message) || `Failed to get entity privileges from metadata: ${error.message}`, 'error');
            return [];
        }
    },

    /**
     * Fetches all privileges from the system, handling pagination.
     * The privileges table can have thousands of records, so we need to follow @odata.nextLink.
     * @param {Function} [getEntitySetName] - Entity set name resolver
     * @returns {Promise<Array>} Array of all privilege objects
     * @async
     * @private
     */
    async _fetchAllPrivileges(getEntitySetName) {
        const allPrivileges = [];
        let nextUrl = 'privileges?$select=privilegeid,name';

        try {
            while (nextUrl) {
                const response = await WebApiService.webApiFetch(
                    'GET',
                    nextUrl,
                    '',
                    null,
                    {},
                    getEntitySetName
                );

                if (response?.value) {
                    allPrivileges.push(...response.value);
                }

                if (response?.['@odata.nextLink']) {
                    const nextLink = response['@odata.nextLink'];
                    const match = nextLink.match(/\/api\/data\/v[\d.]+\/(.+)/);
                    nextUrl = match ? match[1] : null;
                } else {
                    nextUrl = null;
                }
            }
        } catch (error) {
            NotificationService.show(Config.MESSAGES.COMMON?.operationFailed?.(error.message) || `Failed to fetch all privileges: ${error.message}`, 'error');
        }

        return allPrivileges;
    },

    /**
     * Converts privilegedepthmask bitmask to depth value.
     * @param {number} depthMask - The privilege depth mask (bitmask)
     * @returns {number} Depth value (0=Basic, 1=Local, 2=Deep, 3=Global)
     * @private
     */
    _depthMaskToDepth(depthMask) {
        // privilegedepthmask is a bitmask:
        // 1 = Basic (User), 2 = Local (BU), 4 = Deep (BU+Child), 8 = Global (Org)
        // Return the highest depth level
        if (depthMask & 8) {
            return 3; // Global
        }
        if (depthMask & 4) {
            return 2; // Deep
        }
        if (depthMask & 2) {
            return 1; // Local
        }
        if (depthMask & 1) {
            return 0; // Basic
        }
        return -1; // No access
    },

    /**
     * Compares two depth values. Returns positive if depth1 is better than depth2.
     * @param {number|string} depth1 - First depth value (bit mask: 1=Basic, 2=Local, 4=Deep, 8=Global, or depth number 0-3, or string)
     * @param {number|string|null} depth2 - Second depth value (can be null or string like "Global (Org)")
     * @returns {number} Positive if depth1 > depth2, negative if depth1 < depth2, 0 if equal
     * @private
     */
    _compareDepth(depth1, depth2) {
        const getDepthNumber = (d) => {
            if (typeof d === 'number') {
                if (d === 1 || d === 2 || d === 4 || d === 8) {
                    return this._depthMaskToDepth(d);
                }
                // Otherwise assume it's already a depth number (0-3)
                return d;
            }
            if (!d) {
                return -1;
            }
            const dLower = String(d).toLowerCase();
            if (dLower.includes('global') || dLower.includes('organization')) {
                return 3;
            }
            if (dLower.includes('deep') || dLower.includes('parent')) {
                return 2;
            }
            if (dLower.includes('local') || dLower.includes('bu')) {
                return 1;
            }
            if (dLower.includes('basic') || dLower.includes('user')) {
                return 0;
            }
            return -1;
        };

        return getDepthNumber(depth1) - getDepthNumber(depth2);
    },

    /**
     * Converts privilege depth bit mask to human-readable name.
     * @param {number} depthMask - The privilege depth bit mask (1=Basic, 2=Local, 4=Deep, 8=Global)
     * @returns {string} Human-readable depth name
     * @private
     */
    _getDepthName(depthMask) {
        const depth = this._depthMaskToDepth(depthMask);

        switch (depth) {
            case 0:
                return 'Basic (User)';
            case 1:
                return 'Local (BU)';
            case 2:
                return 'Deep (BU + Child)';
            case 3:
                return 'Global (Org)';
            default:
                return 'Not Allowed';
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

        if (entityLogicalName && targetUserFieldProfiles.length > 0) {
            for (const profile of targetUserFieldProfiles) {
                profile.permissions = await this.getFieldPermissions(
                    profile.fieldsecurityprofileid,
                    entityLogicalName,
                    getEntitySetName
                );
            }
        }

        if (entityLogicalName && comparisonUserFieldProfiles.length > 0) {
            for (const profile of comparisonUserFieldProfiles) {
                profile.permissions = await this.getFieldPermissions(
                    profile.fieldsecurityprofileid,
                    entityLogicalName,
                    getEntitySetName
                );
            }
        }

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

            const allPermissions = [];
            for (const profile of profiles) {
                const permissions = await this.getFieldPermissions(
                    profile.fieldsecurityprofileid,
                    entityLogicalName,
                    getEntitySetName
                );

                for (const perm of permissions) {
                    allPermissions.push({
                        ...perm,
                        profileName: profile.name
                    });
                }
            }

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
