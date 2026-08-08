/**
 * @file OrganizationService - Reads environment-level diagnostic settings from the `organization` table.
 * @module services/OrganizationService
 * @description Surfaces org-wide toggles that explain otherwise-silent empty states in other tabs:
 * the plugin trace logging level, Copilot Studio transcript recording, and cloud-flow run retention.
 * Same-origin Web API reads only. There is exactly one `organization` row per environment.
 */

/**
 * Plugin trace log setting values — the `organization.plugintracelogsetting` global choice
 * (`organization_plugintracelogsetting`). Whether the platform writes plug-in trace logs at all
 * depends on this value.
 * @readonly
 * @enum {number}
 */
export const PLUGIN_TRACE_LOG_SETTING = {
    OFF: 0,
    EXCEPTION: 1,
    ALL: 2
};

/**
 * Valid values of {@link PLUGIN_TRACE_LOG_SETTING}, used to reject anything else before a write.
 * @private
 * @type {ReadonlyArray<number>}
 */
const PLUGIN_TRACE_LOG_SETTING_VALUES = Object.freeze(Object.values(PLUGIN_TRACE_LOG_SETTING));

/**
 * @typedef {object} OrganizationDiagnostics
 * @property {string|null} organizationId - GUID of the single organization row (needed to update settings).
 * @property {number|null} pluginTraceLogSetting - 0 = Off, 1 = Exception, 2 = All (null if unavailable).
 * @property {boolean} transcriptRecordingBlocked - True when Copilot Studio transcript recording is turned off org-wide.
 * @property {boolean} transcriptAccessBlocked - True when transcript viewing/download is blocked org-wide.
 * @property {number|null} flowRunRetentionSeconds - Cloud-flow run-history retention in seconds (0 = disabled, null if unavailable).
 */

export const OrganizationService = {
    /**
     * Reads the environment's diagnostic settings from the single `organization` row. These org-wide
     * toggles explain empty states elsewhere (no plugin traces, no transcripts, no flow runs) that
     * would otherwise look like bugs.
     * @param {Function} retrieveMultipleRecords - Bound DataService.retrieveMultipleRecords.
     * @returns {Promise<OrganizationDiagnostics>} Parsed diagnostic settings.
     * @throws {Error} When the organization table cannot be read.
     */
    async getDiagnosticSettings(retrieveMultipleRecords) {
        const query =
            '?$select=organizationid,plugintracelogsetting,' +
            'blocktranscriptrecordingforcopilotstudio,blockaccesstosessiontranscriptsforcopilotstudio,' +
            'flowruntimetoliveinseconds&$top=1';

        const response = await retrieveMultipleRecords('organizations', query);
        const org = (response.entities || [])[0] || {};

        return {
            organizationId: org.organizationid || null,
            pluginTraceLogSetting: typeof org.plugintracelogsetting === 'number' ? org.plugintracelogsetting : null,
            transcriptRecordingBlocked: org.blocktranscriptrecordingforcopilotstudio === true,
            transcriptAccessBlocked: org.blockaccesstosessiontranscriptsforcopilotstudio === true,
            flowRunRetentionSeconds: typeof org.flowruntimetoliveinseconds === 'number'
                ? org.flowruntimetoliveinseconds
                : null
        };
    },

    /**
     * Changes the environment-wide plug-in trace logging level — the same setting as System Settings →
     * Customization → "Enable logging to plug-in trace log". It is a plain column on the single
     * `organization` row, so a PATCH is all it takes; there is no dedicated message for it.
     *
     * Writing `organization` needs the `prvWriteOrganization` privilege (System Administrator), so a
     * caller without it gets a 403 back from the platform — surface that error rather than hiding it.
     * @param {Function} updateRecord - Bound record-update function `(entity, id, data) => Promise`.
     * @param {string} organizationId - GUID of the organization row (from {@link getDiagnosticSettings}).
     * @param {number} level - One of {@link PLUGIN_TRACE_LOG_SETTING}.
     * @returns {Promise<object>} The update response.
     * @throws {Error} When the organization id is missing or the level is not a valid option value.
     */
    setPluginTraceLogSetting(updateRecord, organizationId, level) {
        if (!organizationId) {
            throw new Error('Organization ID is required');
        }
        if (!PLUGIN_TRACE_LOG_SETTING_VALUES.includes(level)) {
            throw new Error(`Invalid plugin trace log setting: ${level}`);
        }

        return updateRecord('organizations', organizationId, { plugintracelogsetting: level });
    }
};
