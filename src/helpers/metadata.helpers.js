/**
 * @file Metadata and entity utilities.
 * @module helpers/metadata.helpers
 * @description Provides utilities for working with Dataverse metadata (entities and attributes).
 */

import { MetadataBrowserDialog } from '../ui/MetadataBrowserDialog.js';
import { NotificationService } from '../services/NotificationService.js';
import { Config } from '../constants/index.js';

/**
 * Metadata utility functions.
 * @namespace MetadataHelpers
 */
export const MetadataHelpers = {
    /**
     * Extracts the display name from a Dataverse metadata object (entity or attribute).
     * Falls back to SchemaName if no display name is available.
     * @param {object} metadataItem - The metadata object (entity or attribute definition).
     * @returns {string} The display name or schema name.
     */
    getMetadataDisplayName(metadataItem) {
        if (!metadataItem) {
            return '';
        }
        return metadataItem.DisplayName?.UserLocalizedLabel?.Label || metadataItem.SchemaName || '';
    },

    /**
     * Shows column browser with validation.
     * Validates that an entity is selected before opening the column browser.
     * Shows a notification if no entity is selected.
     *
     * @param {Function} resolveEntityName - Async function that returns the entity logical name.
     *                                       Should throw an error if no entity is selected.
     * @param {Function} onSelect - Callback when a column is selected.
     * @returns {Promise<void>}
     */
    async showColumnBrowser(resolveEntityName, onSelect) {
        try {
            const entityLogicalName = await resolveEntityName();
            await MetadataBrowserDialog.show('attribute', onSelect, entityLogicalName);
        } catch (e) {
            // Show user-friendly notification instead of error dialog
            const message = e.message || Config.MESSAGES.WEB_API?.enterValidTable || 'Please select a table first';
            NotificationService.show(message, 'warning');
        }
    }
};
