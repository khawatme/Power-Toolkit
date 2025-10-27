/**
 * Plugin development and execution constants.
 * @module constants/plugin
 */

/**
 * Plugin execution messages supported by Dataverse.
 * @type {Object.<string, string>}
 */
export const PLUGIN_MESSAGES = {
    CREATE: 'Create',
    UPDATE: 'Update',
    DELETE: 'Delete',
    RETRIEVE: 'Retrieve',
    RETRIEVE_MULTIPLE: 'RetrieveMultiple',
    ASSOCIATE: 'Associate',
    DISASSOCIATE: 'Disassociate',
    SET_STATE: 'SetState',
    ASSIGN: 'Assign',
    MERGE: 'Merge',
    GRANT_ACCESS: 'GrantAccess',
    REVOKE_ACCESS: 'RevokeAccess',
    MODIFY_ACCESS: 'ModifyAccess'
};

/**
 * Plugin execution stages as defined in the Plugin Registration Tool.
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/event-framework#event-execution-pipeline
 * @type {Object.<string, {value: number, label: string}>}
 */
export const PLUGIN_STAGES = {
    PRE_VALIDATION: { value: 10, label: 'Pre-Validation' },
    PRE_OPERATION: { value: 20, label: 'Pre-Operation' },
    MAIN_OPERATION: { value: 30, label: 'Main Operation' },
    POST_OPERATION: { value: 40, label: 'Post-Operation' }
};
