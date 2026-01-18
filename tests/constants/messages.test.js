import { describe, it, expect } from 'vitest';
import {
    COMMON,
    ENV_VARS,
    AUTOMATION,
    FETCHXML,
    WEB_API,
    DATA_SERVICE,
    UI_MANAGER,
    UI,
    FORM_COLUMNS,
    INSPECTOR,
    SETTINGS,
    HELPERS,
    PLUGIN_CONTEXT,
    PLUGIN_TRACE,
    METADATA_BROWSER,
    USER_CONTEXT,
    PERFORMANCE,
    IMPERSONATE,
    EVENT_MONITOR,
    SOLUTION_LAYERS
} from '../../src/constants/messages.js';

describe('COMMON messages', () => {
    it('should have selectTableFirst message', () => {
        expect(COMMON.selectTableFirst).toBe('Please select a table first.');
    });
});

describe('ENV_VARS messages', () => {
    describe('static messages', () => {
        it('should have saved message', () => {
            expect(ENV_VARS.saved).toBe('Environment variable value saved.');
        });

        it('should have deleted message', () => {
            expect(ENV_VARS.deleted).toBe('Environment variable value deleted.');
        });

        it('should have created message', () => {
            expect(ENV_VARS.created).toBe('Environment variable value created.');
        });

        it('should have defaultUpdated message', () => {
            expect(ENV_VARS.defaultUpdated).toBe('Default value updated.');
        });

        it('should have selectSolution message', () => {
            expect(ENV_VARS.selectSolution).toBe('Please select a solution first.');
        });

        it('should have noVariablesFound message', () => {
            expect(ENV_VARS.noVariablesFound).toBe('No environment variables found in this environment.');
        });

        it('should have selectSolutionBeforeCreate message', () => {
            expect(ENV_VARS.selectSolutionBeforeCreate).toBe('Please select a solution before creating an environment variable.');
        });

        it('should have selectSolutionButton message', () => {
            expect(ENV_VARS.selectSolutionButton).toBe('Select solution…');
        });

        it('should have changeSolutionButton message', () => {
            expect(ENV_VARS.changeSolutionButton).toBe('Change solution…');
        });

        it('should have noSolutionSelected message', () => {
            expect(ENV_VARS.noSolutionSelected).toBe('No current solution selected. The variable will be created but not added to a solution.');
        });

        it('should have solutionSuccess message', () => {
            expect(ENV_VARS.solutionSuccess).toBe('✓');
        });
    });

    describe('function messages', () => {
        it('should format saveFailed correctly', () => {
            expect(ENV_VARS.saveFailed('Network error')).toBe('Failed to save environment variable value: Network error');
        });

        it('should format deleteFailed correctly', () => {
            expect(ENV_VARS.deleteFailed('Permission denied')).toBe('Failed to delete environment variable value: Permission denied');
        });

        it('should format createFailed correctly', () => {
            expect(ENV_VARS.createFailed('Validation error')).toBe('Failed to create environment variable value: Validation error');
        });

        it('should format invalidValue correctly', () => {
            expect(ENV_VARS.invalidValue('String', 'Too long')).toBe('Invalid String value: Too long');
        });

        it('should format loadFailed correctly', () => {
            expect(ENV_VARS.loadFailed('API timeout')).toBe('Could not retrieve environment variables: API timeout');
        });

        it('should format solutionSelected correctly', () => {
            expect(ENV_VARS.solutionSelected('MySolution', 'pub')).toBe('Will be added to solution: <strong>MySolution</strong> (prefix: pub)');
        });

        it('should format solutionSelected with null prefix', () => {
            expect(ENV_VARS.solutionSelected('MySolution', null)).toBe('Will be added to solution: <strong>MySolution</strong> (prefix: n/a)');
        });

        it('should format solutionWarning correctly', () => {
            expect(ENV_VARS.solutionWarning('Warning message')).toBe('<strong>⚠ Warning message</strong>');
        });
    });
});

describe('AUTOMATION messages', () => {
    describe('static messages', () => {
        it('should have ruleDeleted message', () => {
            expect(AUTOMATION.ruleDeleted).toBe('Business rule deleted.');
        });

        it('should have ruleActivated message', () => {
            expect(AUTOMATION.ruleActivated).toBe('Business rule activated.');
        });

        it('should have ruleDeactivated message', () => {
            expect(AUTOMATION.ruleDeactivated).toBe('Business rule deactivated.');
        });

        it('should have systemLocked message', () => {
            expect(AUTOMATION.systemLocked).toBe('System is locked by a solution import. Please try again later.');
        });

        it('should have noRulesFound message', () => {
            expect(AUTOMATION.noRulesFound).toBe('No business rules found for this table.');
        });

        it('should have noClientLogic message', () => {
            expect(AUTOMATION.noClientLogic).toBe('This rule has no client logic payload.');
        });

        it('should have noFormDefinition message', () => {
            expect(AUTOMATION.noFormDefinition).toBe('Could not retrieve form definition or no main form found.');
        });
    });

    describe('function messages', () => {
        it('should format actionFailed correctly', () => {
            expect(AUTOMATION.actionFailed('Unknown error')).toBe('Action failed: Unknown error');
        });

        it('should format deleteFailed correctly', () => {
            expect(AUTOMATION.deleteFailed('Deletion blocked')).toBe('Failed to delete business rule: Deletion blocked');
        });

        it('should format activateFailed correctly', () => {
            expect(AUTOMATION.activateFailed('Activation error')).toBe('Failed to activate business rule: Activation error');
        });

        it('should format deactivateFailed correctly', () => {
            expect(AUTOMATION.deactivateFailed('Deactivation error')).toBe('Failed to deactivate business rule: Deactivation error');
        });

        it('should format parseRuleLogicFailed correctly', () => {
            expect(AUTOMATION.parseRuleLogicFailed('Invalid XML')).toBe('Unable to parse rule logic. Invalid XML');
        });

        it('should format refreshingRules correctly', () => {
            expect(AUTOMATION.refreshingRules('account')).toBe('Refreshing rules for account...');
        });

        it('should format refreshFailed correctly', () => {
            expect(AUTOMATION.refreshFailed('Timeout')).toBe('Error refreshing business rules: Timeout');
        });

        it('should format loadingRules correctly', () => {
            expect(AUTOMATION.loadingRules('contact')).toBe('Loading rules for contact...');
        });

        it('should format loadingHandlers correctly', () => {
            expect(AUTOMATION.loadingHandlers('lead')).toBe('Loading form handlers for lead...');
        });

        it('should format loadAutomationsFailed correctly', () => {
            expect(AUTOMATION.loadAutomationsFailed('Server error')).toBe('Error loading automations: Server error');
        });
    });
});

describe('FETCHXML messages', () => {
    describe('static messages', () => {
        it('should have generated message', () => {
            expect(FETCHXML.generated).toBe('FetchXML generated successfully.');
        });

        it('should have generating message', () => {
            expect(FETCHXML.generating).toBe('Generating...');
        });

        it('should have cannotBeEmpty message', () => {
            expect(FETCHXML.cannotBeEmpty).toBe('Table name cannot be empty.');
        });

        it('should have noEntityName message', () => {
            expect(FETCHXML.noEntityName).toBe('Could not determine entity name from selection.');
        });

        it('should have enterLinkToTableName message', () => {
            expect(FETCHXML.enterLinkToTableName).toBe('Please enter a "Link to Table" name for this join before browsing its columns');
        });

        it('should have enterLinkEntityTableName message', () => {
            expect(FETCHXML.enterLinkEntityTableName).toBe('Please enter the link-entity table name first.');
        });

        it('should have countNotAvailable message', () => {
            expect(FETCHXML.countNotAvailable).toBe('Count not available in response.');
        });

        it('should have selectJoinParent message', () => {
            expect(FETCHXML.selectJoinParent).toBe('Please select which table to join from (parent).');
        });

        it('should have parentJoinRequiresTableName message', () => {
            expect(FETCHXML.parentJoinRequiresTableName).toBe('Parent join must have a table name.');
        });

        it('should have nestedJoinInfo message', () => {
            expect(FETCHXML.nestedJoinInfo).toBe('Nested joins allow you to chain relationships (e.g., Account → Contact → Lead).');
        });

        it('should have bannerTitle message', () => {
            expect(FETCHXML.bannerTitle).toBe('⚠️ More Records Available');
        });

        it('should have bannerLoadingTitle message', () => {
            expect(FETCHXML.bannerLoadingTitle).toBe('⏳ Loading All Records...');
        });
    });

    describe('function messages', () => {
        it('should format formatFailed correctly', () => {
            expect(FETCHXML.formatFailed('Parse error')).toBe('Failed to format FetchXML: Parse error');
        });

        it('should format countFailed correctly', () => {
            expect(FETCHXML.countFailed('Count error')).toBe('Failed to get count: Count error');
        });

        it('should format cannotRemoveJoin correctly', () => {
            expect(FETCHXML.cannotRemoveJoin(3)).toBe('Cannot remove this join - 3 nested join(s) depend on it.');
        });

        it('should format paginationWarning correctly', () => {
            expect(FETCHXML.paginationWarning(5000)).toBe('Showing 5000 records. More data is available (5000 record limit per page).');
        });

        it('should format allRecordsLoaded correctly', () => {
            expect(FETCHXML.allRecordsLoaded(150)).toBe('All records loaded (150 total).');
        });

        it('should format loadingAllRecords with singular page', () => {
            expect(FETCHXML.loadingAllRecords(100, 1)).toBe('Loaded 100 records (1 page)...');
        });

        it('should format loadingAllRecords with plural pages', () => {
            expect(FETCHXML.loadingAllRecords(5000, 2)).toBe('Loaded 5000 records (2 pages)...');
        });

        it('should format loadAllSuccess with singular page', () => {
            expect(FETCHXML.loadAllSuccess(100, 1)).toBe('Loaded all 100 records (1 pages).');
        });

        it('should format loadAllSuccess with plural pages', () => {
            expect(FETCHXML.loadAllSuccess(10000, 3)).toBe('Loaded all 10000 records (3 pages).');
        });

        it('should format loadAllSuccess with zero pages', () => {
            expect(FETCHXML.loadAllSuccess(0, 0)).toBe('Loaded all 0 records (0 page).');
        });

        it('should format resolveEntityFailed correctly', () => {
            expect(FETCHXML.resolveEntityFailed('Entity not found')).toBe('Could not resolve entity name: Entity not found');
        });
    });
});

describe('WEB_API messages', () => {
    describe('static messages', () => {
        it('should have requestSuccess message', () => {
            expect(WEB_API.requestSuccess).toBe('Request executed successfully.');
        });

        it('should have invalidJson message', () => {
            expect(WEB_API.invalidJson).toBe('Invalid JSON in request body.');
        });

        it('should have enterValidTable message', () => {
            expect(WEB_API.enterValidTable).toBe('Please enter a valid table name.');
        });

        it('should have countNotAvailable message', () => {
            expect(WEB_API.countNotAvailable).toBe('Count not available in response. The query may need adjustment.');
        });

        it('should have executing message', () => {
            expect(WEB_API.executing).toBe('Executing…');
        });

        it('should have counting message', () => {
            expect(WEB_API.counting).toBe('Counting...');
        });

        it('should have bannerTitle message', () => {
            expect(WEB_API.bannerTitle).toBe('⚠️ More Records Available');
        });

        it('should have bannerLoadingTitle message', () => {
            expect(WEB_API.bannerLoadingTitle).toBe('⏳ Loading All Records...');
        });

        it('should have findingRecords message', () => {
            expect(WEB_API.findingRecords).toBe('Finding matching records...');
        });

        it('should have noFieldsProvided message', () => {
            expect(WEB_API.noFieldsProvided).toBe('No fields provided. Add at least one field or switch to JSON mode.');
        });

        it('should have noPrimaryKeyFound message', () => {
            expect(WEB_API.noPrimaryKeyFound).toBe('No primary key found');
        });

        it('should have noSuitableField message', () => {
            expect(WEB_API.noSuitableField).toBe('No suitable field to update');
        });

        it('should have noRequiredFields message', () => {
            expect(WEB_API.noRequiredFields).toBe('No required fields found for this table.');
        });

        it('should have confirmBulkUpdate message', () => {
            expect(WEB_API.confirmBulkUpdate).toBe('Confirm Bulk Update');
        });

        it('should have confirmBulkDelete message', () => {
            expect(WEB_API.confirmBulkDelete).toBe('Confirm Bulk Delete');
        });

        it('should have confirmDelete message', () => {
            expect(WEB_API.confirmDelete).toBe('Confirm Delete');
        });

        it('should have reloadingRecords message', () => {
            expect(WEB_API.reloadingRecords).toBe('Reloading records...');
        });

        it('should have bulkOperationCancelled message', () => {
            expect(WEB_API.bulkOperationCancelled).toBe('Bulk operation cancelled.');
        });

        it('should have noRecordsSelected message', () => {
            expect(WEB_API.noRecordsSelected).toBe('No records selected. Please select at least one record.');
        });

        it('should have noRecordsMatched message', () => {
            expect(WEB_API.noRecordsMatched).toBe('No records match the filter conditions.');
        });

        it('should have bulkModeInfo message', () => {
            expect(WEB_API.bulkModeInfo).toBe('Add filter conditions to update/delete multiple records at once.');
        });

        it('should have idOrConditionsRequired message', () => {
            expect(WEB_API.idOrConditionsRequired).toBe('Either provide a Record ID or add filter conditions for bulk operation.');
        });

        it('should have touchDialogTitle message', () => {
            expect(WEB_API.touchDialogTitle).toBe('Configure Bulk Touch Operation');
        });

        it('should have touchDialogInstructions message', () => {
            expect(WEB_API.touchDialogInstructions).toBe('Select which fields to update. This will trigger <strong>modifiedon/modifiedby</strong> updates and any associated plugins or workflows.');
        });

        it('should have touchDialogColumnLabel message', () => {
            expect(WEB_API.touchDialogColumnLabel).toBe('Column Name:');
        });

        it('should have touchDialogValueModeLabel message', () => {
            expect(WEB_API.touchDialogValueModeLabel).toBe('Value Mode:');
        });

        it('should have touchDialogKeepValue message', () => {
            expect(WEB_API.touchDialogKeepValue).toBe('Keep current value');
        });

        it('should have touchDialogSetValue message', () => {
            expect(WEB_API.touchDialogSetValue).toBe('Set custom value:');
        });

        it('should have touchDialogPlaceholder message', () => {
            expect(WEB_API.touchDialogPlaceholder).toBe('e.g., name, description');
        });

        it('should have touchDialogCustomPlaceholder message', () => {
            expect(WEB_API.touchDialogCustomPlaceholder).toBe('Enter custom value');
        });

        it('should have touchDialogRemoveButton message', () => {
            expect(WEB_API.touchDialogRemoveButton).toBe('Remove');
        });

        it('should have touchDialogAddButton message', () => {
            expect(WEB_API.touchDialogAddButton).toBe('+ Add Field');
        });

        it('should have touchDialogConfirmButton message', () => {
            expect(WEB_API.touchDialogConfirmButton).toBe('Confirm & Touch Records');
        });

        it('should have touchDialogCancelButton message', () => {
            expect(WEB_API.touchDialogCancelButton).toBe('Cancel');
        });

        it('should have touchDialogBrowseTitle message', () => {
            expect(WEB_API.touchDialogBrowseTitle).toBe('Browse columns');
        });

        it('should have touchDialogBrowseFailed message', () => {
            expect(WEB_API.touchDialogBrowseFailed).toBe('Failed to browse columns');
        });

        it('should have touchFieldNameRequired message', () => {
            expect(WEB_API.touchFieldNameRequired).toBe('Please enter a field name for all fields or remove empty ones');
        });

        it('should have touchCustomValueRequired message', () => {
            expect(WEB_API.touchCustomValueRequired).toBe('Please enter a custom value or select "Keep current value"');
        });

        it('should have touchNoFieldsConfigured message', () => {
            expect(WEB_API.touchNoFieldsConfigured).toBe('Please add at least one field');
        });

        it('should have loadingRequiredFields message', () => {
            expect(WEB_API.loadingRequiredFields).toBe('Loading required fields...');
        });

        it('should have jsonModeLabel message', () => {
            expect(WEB_API.jsonModeLabel).toBe('JSON Mode');
        });

        it('should have fieldBuilderLabel message', () => {
            expect(WEB_API.fieldBuilderLabel).toBe('Field Builder');
        });
    });

    describe('function messages', () => {
        it('should format buildUrlFailed correctly', () => {
            expect(WEB_API.buildUrlFailed('Invalid URL')).toBe('Failed to build API URL: Invalid URL');
        });

        it('should format countFailed correctly', () => {
            expect(WEB_API.countFailed('Timeout')).toBe('Failed to get count: Timeout');
        });

        it('should format countingProgress correctly', () => {
            expect(WEB_API.countingProgress(5000)).toBe('Counting... (5000)');
        });

        it('should format countLimitWarning correctly', () => {
            expect(WEB_API.countLimitWarning(500000)).toBe('⚠️ Count stopped at 500000 records (100 page limit). Actual count may be higher.');
        });

        it('should format countSuccess with singular page', () => {
            expect(WEB_API.countSuccess(100, 1)).toBe('Found 100 records across 1 page.');
        });

        it('should format countSuccess with plural pages', () => {
            expect(WEB_API.countSuccess(10000, 5)).toBe('Found 10000 records across 5 pages.');
        });

        it('should format paginationWarning correctly', () => {
            expect(WEB_API.paginationWarning(5000)).toBe('Showing 5000 records. More data is available (5000 record limit per page).');
        });

        it('should format allRecordsLoaded correctly', () => {
            expect(WEB_API.allRecordsLoaded(250)).toBe('All records loaded (250 total).');
        });

        it('should format loadingAllRecords with singular page', () => {
            expect(WEB_API.loadingAllRecords(100, 1)).toBe('Loaded 100 records (1 page)...');
        });

        it('should format loadingAllRecords with plural pages', () => {
            expect(WEB_API.loadingAllRecords(5000, 2)).toBe('Loaded 5000 records (2 pages)...');
        });

        it('should format loadAllSuccess with singular page', () => {
            expect(WEB_API.loadAllSuccess(100, 1)).toBe('Loaded all 100 records (1 pages).');
        });

        it('should format loadAllSuccess with plural pages', () => {
            expect(WEB_API.loadAllSuccess(10000, 3)).toBe('Loaded all 10000 records (3 pages).');
        });

        it('should format loadAllSuccess with zero pages', () => {
            expect(WEB_API.loadAllSuccess(0, 0)).toBe('Loaded all 0 records (0 page).');
        });

        it('should format requiredFieldsPopulated correctly with singular', () => {
            expect(WEB_API.requiredFieldsPopulated(1)).toBe('Populated 1 required field.');
        });

        it('should format requiredFieldsPopulated correctly with plural', () => {
            expect(WEB_API.requiredFieldsPopulated(5)).toBe('Populated 5 required fields.');
        });

        it('should format requiredFieldsLoadFailed correctly', () => {
            expect(WEB_API.requiredFieldsLoadFailed('Network error')).toBe('Failed to load required fields: Network error');
        });

        it('should format reloadRecordsFailed correctly', () => {
            expect(WEB_API.reloadRecordsFailed('Server error')).toBe('Failed to reload records: Server error');
        });

        it('should format bulkUpdateConfirm with singular', () => {
            expect(WEB_API.bulkUpdateConfirm(1)).toBe('Update 1 record matching the filter conditions?');
        });

        it('should format bulkUpdateConfirm with plural', () => {
            expect(WEB_API.bulkUpdateConfirm(10)).toBe('Update 10 records matching the filter conditions?');
        });

        it('should format bulkDeleteConfirm with singular', () => {
            expect(WEB_API.bulkDeleteConfirm(1)).toBe('Delete 1 record matching the filter conditions? This action cannot be undone.');
        });

        it('should format bulkDeleteConfirm with plural', () => {
            expect(WEB_API.bulkDeleteConfirm(10)).toBe('Delete 10 records matching the filter conditions? This action cannot be undone.');
        });

        it('should format bulkTouchConfirm with singular', () => {
            expect(WEB_API.bulkTouchConfirm(1)).toBe('Touch (update without changes) 1 selected record?');
        });

        it('should format bulkTouchConfirm with plural', () => {
            expect(WEB_API.bulkTouchConfirm(5)).toBe('Touch (update without changes) 5 selected records?');
        });

        it('should format deleteRecordConfirm correctly', () => {
            expect(WEB_API.deleteRecordConfirm('abc-123', 'accounts')).toBe('<p>Delete record <code>abc-123</code> from <strong>accounts</strong>?</p><p class="pdt-text-error">This action cannot be undone.</p>');
        });

        it('should format bulkUpdateProgress correctly', () => {
            expect(WEB_API.bulkUpdateProgress(5, 10)).toBe('Updating records... (5/10)');
        });

        it('should format bulkDeleteProgress correctly', () => {
            expect(WEB_API.bulkDeleteProgress(3, 8)).toBe('Deleting records... (3/8)');
        });

        it('should format bulkTouchProgress correctly', () => {
            expect(WEB_API.bulkTouchProgress(2, 5)).toBe('Touching records... (2/5)');
        });

        it('should format bulkUpdateSuccess with singular', () => {
            expect(WEB_API.bulkUpdateSuccess(1)).toBe('Successfully updated 1 record.');
        });

        it('should format bulkUpdateSuccess with plural', () => {
            expect(WEB_API.bulkUpdateSuccess(10)).toBe('Successfully updated 10 records.');
        });

        it('should format bulkDeleteSuccess with singular', () => {
            expect(WEB_API.bulkDeleteSuccess(1)).toBe('Successfully deleted 1 record.');
        });

        it('should format bulkDeleteSuccess with plural', () => {
            expect(WEB_API.bulkDeleteSuccess(5)).toBe('Successfully deleted 5 records.');
        });

        it('should format bulkTouchSuccess with singular', () => {
            expect(WEB_API.bulkTouchSuccess(1)).toBe('Successfully touched 1 record.');
        });

        it('should format bulkTouchSuccess with plural', () => {
            expect(WEB_API.bulkTouchSuccess(3)).toBe('Successfully touched 3 records.');
        });

        it('should format bulkTouchReloadSuccess with singular', () => {
            expect(WEB_API.bulkTouchReloadSuccess(1)).toBe('Successfully touched 1 record. Reloaded with updated values.');
        });

        it('should format bulkTouchReloadSuccess with plural', () => {
            expect(WEB_API.bulkTouchReloadSuccess(7)).toBe('Successfully touched 7 records. Reloaded with updated values.');
        });

        it('should format bulkUpdateFailed correctly', () => {
            expect(WEB_API.bulkUpdateFailed(8, 2, 10)).toBe('Updated 8/10 records. 2 failed.');
        });

        it('should format bulkDeleteFailed correctly', () => {
            expect(WEB_API.bulkDeleteFailed(5, 3, 8)).toBe('Deleted 5/8 records. 3 failed.');
        });

        it('should format bulkTouchFailed correctly', () => {
            expect(WEB_API.bulkTouchFailed(4, 1, 5)).toBe('Touched 4/5 records. 1 failed.');
        });

        it('should format touchDialogTip correctly', () => {
            expect(WEB_API.touchDialogTip('name')).toBe('<strong>Tip:</strong> Default field is <code>name</code> (Primary Name Attribute)');
        });

        it('should format touchDialogFieldLabel correctly', () => {
            expect(WEB_API.touchDialogFieldLabel(1)).toBe('Field 1');
            expect(WEB_API.touchDialogFieldLabel(5)).toBe('Field 5');
        });
    });
});

describe('DATA_SERVICE messages', () => {
    describe('static messages', () => {
        it('should have lackPermissions message', () => {
            expect(DATA_SERVICE.lackPermissions).toBe('You lack sufficient permissions to perform impersonation.');
        });

        it('should have impersonationStarted message', () => {
            expect(DATA_SERVICE.impersonationStarted).toBe('Impersonation started.');
        });

        it('should have impersonationEnded message', () => {
            expect(DATA_SERVICE.impersonationEnded).toBe('Impersonation ended.');
        });

        it('should have limitedMetadata message', () => {
            expect(DATA_SERVICE.limitedMetadata).toBe('Impersonated user lacks metadata read permissions. Metadata Browser will be limited.');
        });
    });

    describe('function messages', () => {
        it('should format metadataFailed correctly', () => {
            expect(DATA_SERVICE.metadataFailed('API error')).toBe('Failed to retrieve metadata: API error');
        });

        it('should format fetchFailed correctly', () => {
            expect(DATA_SERVICE.fetchFailed('users')).toBe("DataService fetch failed for key 'users'.");
        });
    });
});

describe('UI_MANAGER messages', () => {
    describe('static messages', () => {
        it('should have cacheCleared message', () => {
            expect(UI_MANAGER.cacheCleared).toBe('Cache cleared successfully.');
        });

        it('should have cannotResetNew message', () => {
            expect(UI_MANAGER.cannotResetNew).toBe('Cannot reset a new (unsaved) record form.');
        });

        it('should have formReset message', () => {
            expect(UI_MANAGER.formReset).toBe('Form reset successfully.');
        });

        it('should have logicalNamesHidden message', () => {
            expect(UI_MANAGER.logicalNamesHidden).toBe('Logical names removed from form.');
        });

        it('should have logicalNamesAlreadyHidden message', () => {
            expect(UI_MANAGER.logicalNamesAlreadyHidden).toBe('No logical names to remove.');
        });
    });

    describe('function messages', () => {
        it('should format renderFailed correctly', () => {
            expect(UI_MANAGER.renderFailed('TabComponent')).toBe('Failed to render TabComponent:');
        });

        it('should format godModeSuccess correctly', () => {
            expect(UI_MANAGER.godModeSuccess(5, 3, 2)).toBe('God Mode: 5 fields unlocked, 3 required fields cleared, 2 hidden fields shown.');
        });

        it('should format resetFailed correctly', () => {
            expect(UI_MANAGER.resetFailed('Validation error')).toBe('Error resetting form: Validation error');
        });

        it('should format logicalNamesShown correctly', () => {
            expect(UI_MANAGER.logicalNamesShown(4, 10, 25)).toBe('Showing logical names: 4 tabs, 10 sections, 25 controls.');
        });

        it('should format logicalNameCopied correctly', () => {
            expect(UI_MANAGER.logicalNameCopied('accountname')).toBe('Copied: accountname');
        });
    });
});

describe('UI messages', () => {
    it('should have loading message', () => {
        expect(UI.loading).toBe('Executing…');
    });

    it('should have resultLoading message', () => {
        expect(UI.resultLoading).toBe('Result (loading…)');
    });

    it('should have pleaseWait message', () => {
        expect(UI.pleaseWait).toBe('Loading, please wait…');
    });

    it('should have execute message', () => {
        expect(UI.execute).toBe('Execute');
    });

    it('should have noRecords message', () => {
        expect(UI.noRecords).toBe('No records returned.');
    });

    it('should have hideSystemTooltip message', () => {
        expect(UI.hideSystemTooltip).toBe('Hides system-generated fields (e.g., @odata.*, metadata) from results.');
    });
});

describe('FORM_COLUMNS messages', () => {
    describe('static messages', () => {
        it('should have updated message', () => {
            expect(FORM_COLUMNS.updated).toBe('Field updated successfully.');
        });

        it('should have noColumns message', () => {
            expect(FORM_COLUMNS.noColumns).toBe('No columns to display for this form.');
        });

        it('should have lookupEmpty message', () => {
            expect(FORM_COLUMNS.lookupEmpty).toBe('Lookup value is empty.');
        });

        it('should have noFormColumns message', () => {
            expect(FORM_COLUMNS.noFormColumns).toBe('No form columns matched your search.');
        });

        it('should have noRecordColumns message', () => {
            expect(FORM_COLUMNS.noRecordColumns).toBe('No record columns were returned by the API.');
        });

        it('should have noColumnsPrefix message', () => {
            expect(FORM_COLUMNS.noColumnsPrefix).toBe('No columns to display.');
        });
    });

    describe('function messages', () => {
        it('should format updateFailed correctly', () => {
            expect(FORM_COLUMNS.updateFailed('Invalid data')).toBe('Update failed: Invalid data');
        });

        it('should format loading correctly', () => {
            expect(FORM_COLUMNS.loading('form')).toBe("Loading columns for 'form' view...");
        });

        it('should format loadFailed correctly', () => {
            expect(FORM_COLUMNS.loadFailed('Connection error')).toBe('Could not load form columns: Connection error');
        });
    });
});

describe('INSPECTOR messages', () => {
    describe('static messages', () => {
        it('should have fieldUpdated message', () => {
            expect(INSPECTOR.fieldUpdated).toBe('Field updated successfully.');
        });

        it('should have updateFailed message', () => {
            expect(INSPECTOR.updateFailed).toBe('Failed to update field.');
        });

        it('should have hierarchyLoadFailed message', () => {
            expect(INSPECTOR.hierarchyLoadFailed).toBe('Could not load form hierarchy. This tool is designed for standard record forms.');
        });
    });

    describe('function messages', () => {
        it('should format loadFailed correctly', () => {
            expect(INSPECTOR.loadFailed('Unknown error')).toBe('Error loading form hierarchy: Unknown error');
        });

        it('should format copied correctly', () => {
            expect(INSPECTOR.copied('abc-123-def')).toBe('Copied: abc-123-def');
        });
    });
});

describe('SETTINGS messages', () => {
    describe('static messages', () => {
        it('should have importSuccess message', () => {
            expect(SETTINGS.importSuccess).toBe('Settings imported successfully.');
        });

        it('should have exportSuccess message', () => {
            expect(SETTINGS.exportSuccess).toBe('Settings exported successfully.');
        });

        it('should have invalidSettings message', () => {
            expect(SETTINGS.invalidSettings).toBe('Import failed: File does not contain valid settings.');
        });

        it('should have resetSuccess message', () => {
            expect(SETTINGS.resetSuccess).toBe('Settings reset to defaults.');
        });
    });

    describe('function messages', () => {
        it('should format importFailed correctly', () => {
            expect(SETTINGS.importFailed('Parse error')).toBe('Error importing settings: Parse error');
        });

        it('should format exportFailed correctly', () => {
            expect(SETTINGS.exportFailed('Write error')).toBe('Error exporting settings: Write error');
        });
    });
});

describe('HELPERS messages', () => {
    it('should have copyFailed message', () => {
        expect(HELPERS.copyFailed).toBe('Copy to clipboard failed:');
    });
});

describe('PLUGIN_CONTEXT messages', () => {
    describe('static messages', () => {
        it('should have emptyTargetCreate message', () => {
            expect(PLUGIN_CONTEXT.emptyTargetCreate).toBe('Target should include initial values for create.');
        });

        it('should have emptyTargetUpdate message', () => {
            expect(PLUGIN_CONTEXT.emptyTargetUpdate).toBe('Target is empty. Change at least one field to populate Update.Target.');
        });

        it('should have emptyTargetDelete message', () => {
            expect(PLUGIN_CONTEXT.emptyTargetDelete).toBe('Target is an EntityReference (see "InputParameters[\'Target\']").');
        });

        it('should have emptyPreImageCreate message', () => {
            expect(PLUGIN_CONTEXT.emptyPreImageCreate).toBe('Pre-Image is not applicable for Create.');
        });

        it('should have emptyPreImageUpdate message', () => {
            expect(PLUGIN_CONTEXT.emptyPreImageUpdate).toBe('Pre-Image appears when at least one field is dirty (simulated).');
        });

        it('should have emptyPreImageDeletePre message', () => {
            expect(PLUGIN_CONTEXT.emptyPreImageDeletePre).toBe('Pre-Image should show the entity being deleted; if empty, the form had no readable fields.');
        });

        it('should have emptyPreImageDeleteOther message', () => {
            expect(PLUGIN_CONTEXT.emptyPreImageDeleteOther).toBe('Pre-Image is not available in this stage.');
        });

        it('should have postImageNote message', () => {
            expect(PLUGIN_CONTEXT.postImageNote).toBe('Note: Post-Image is simplified (current form data). In reality, it reflects server-side calculations, workflows, and system fields.');
        });

        it('should have exportSuccess message', () => {
            expect(PLUGIN_CONTEXT.exportSuccess).toBe('Plugin context exported successfully');
        });

        it('should have exportWebApiLoading message', () => {
            expect(PLUGIN_CONTEXT.exportWebApiLoading).toBe('Loading...');
        });

        it('should have exportWebApiError message', () => {
            expect(PLUGIN_CONTEXT.exportWebApiError).toBe('Failed to convert context to Web API format');
        });

        it('should have noTargetEntity message', () => {
            expect(PLUGIN_CONTEXT.noTargetEntity).toBe('No target entity found in context.');
        });

        it('should have noEntityId message', () => {
            expect(PLUGIN_CONTEXT.noEntityId).toBe('No entity ID found for delete operation.');
        });
    });

    describe('function messages', () => {
        it('should format generateFailed correctly', () => {
            expect(PLUGIN_CONTEXT.generateFailed('Context error')).toBe('Failed to generate plugin context: Context error');
        });

        it('should format validationNoId correctly', () => {
            expect(PLUGIN_CONTEXT.validationNoId('Update')).toBe('Update message requires an existing record ID. Please open an existing record.');
        });

        it('should format serializeFailed correctly', () => {
            expect(PLUGIN_CONTEXT.serializeFailed('Circular reference')).toBe('Could not serialize context: Circular reference');
        });

        it('should format exportWebApiFailed correctly', () => {
            expect(PLUGIN_CONTEXT.exportWebApiFailed('Conversion error')).toBe('Could not export Web API JSON: Conversion error');
        });

        it('should format exportCSharpFailed correctly', () => {
            expect(PLUGIN_CONTEXT.exportCSharpFailed('Template error')).toBe('Could not export C# code: Template error');
        });
    });
});

describe('PLUGIN_TRACE messages', () => {
    it('should have loading message', () => {
        expect(PLUGIN_TRACE.loading).toBe('Loading...');
    });

    it('should have loadFailed message', () => {
        expect(PLUGIN_TRACE.loadFailed).toBe('Error loading traces. The Tracing service might be disabled.');
    });

    it('should have noTracesFound message', () => {
        expect(PLUGIN_TRACE.noTracesFound).toBe('No plugin trace logs found for the current filter criteria.');
    });

    it('should have correlationCopied message', () => {
        expect(PLUGIN_TRACE.correlationCopied).toBe('Correlation ID Copied!');
    });
});

describe('METADATA_BROWSER messages', () => {
    describe('static messages', () => {
        it('should have loadingTables message', () => {
            expect(METADATA_BROWSER.loadingTables).toBe('Loading tables...');
        });

        it('should have selectTable message', () => {
            expect(METADATA_BROWSER.selectTable).toBe('Select a table to view its columns.');
        });

        it('should have loadingColumns message', () => {
            expect(METADATA_BROWSER.loadingColumns).toBe('Loading columns...');
        });
    });

    describe('function messages', () => {
        it('should format loadTablesFailed correctly', () => {
            expect(METADATA_BROWSER.loadTablesFailed('API error')).toBe('Could not load tables: API error');
        });

        it('should format loadColumnsFailed correctly', () => {
            expect(METADATA_BROWSER.loadColumnsFailed('Timeout')).toBe('Could not load columns: Timeout');
        });
    });
});

describe('USER_CONTEXT messages', () => {
    describe('static messages', () => {
        it('should have loading message', () => {
            expect(USER_CONTEXT.loading).toBe('Loading user context...');
        });

        it('should have noRoles message', () => {
            expect(USER_CONTEXT.noRoles).toBe('No roles found.');
        });
    });

    describe('function messages', () => {
        it('should format loadFailed correctly', () => {
            expect(USER_CONTEXT.loadFailed('Permission denied')).toBe('Could not retrieve user context: Permission denied');
        });
    });
});

describe('PERFORMANCE messages', () => {
    describe('static messages', () => {
        it('should have loading message', () => {
            expect(PERFORMANCE.loading).toBe('Loading performance metrics...');
        });

        it('should have noIssues message', () => {
            expect(PERFORMANCE.noIssues).toBe('No significant issues detected for this form.');
        });
    });

    describe('function messages', () => {
        it('should format loadFailed correctly', () => {
            expect(PERFORMANCE.loadFailed('Metrics unavailable')).toBe('Could not retrieve performance metrics: Metrics unavailable');
        });
    });
});

describe('IMPERSONATE messages', () => {
    describe('static messages', () => {
        it('should have searching message', () => {
            expect(IMPERSONATE.searching).toBe('Searching...');
        });

        it('should have noUsersFound message', () => {
            expect(IMPERSONATE.noUsersFound).toBe('No active users found matching your search.');
        });
    });

    describe('function messages', () => {
        it('should format searchFailed correctly', () => {
            expect(IMPERSONATE.searchFailed('Search timeout')).toBe('Error searching for users: Search timeout');
        });
    });
});

describe('EVENT_MONITOR messages', () => {
    it('should have monitoring message', () => {
        expect(EVENT_MONITOR.monitoring).toBe('Monitoring form events...');
    });

    it('should have cleared message', () => {
        expect(EVENT_MONITOR.cleared).toBe('Event log cleared.');
    });
});

describe('SOLUTION_LAYERS messages', () => {
    describe('static messages', () => {
        it('should have selectSolution message', () => {
            expect(SOLUTION_LAYERS.selectSolution).toBe('Select a solution to view its components.');
        });

        it('should have noSolutions message', () => {
            expect(SOLUTION_LAYERS.noSolutions).toBe('No solutions found.');
        });

        it('should have noComponents message', () => {
            expect(SOLUTION_LAYERS.noComponents).toBe('No components found matching the current filters.');
        });

        it('should have noActiveCustomizations message', () => {
            expect(SOLUTION_LAYERS.noActiveCustomizations).toBe('No active customizations found in this solution.');
        });

        it('should have layerDeleted message', () => {
            expect(SOLUTION_LAYERS.layerDeleted).toBe('Active customization removed successfully.');
        });

        it('should have deleteLayerSuccess message', () => {
            expect(SOLUTION_LAYERS.deleteLayerSuccess).toBe('Layer deleted successfully.');
        });

        it('should have loadingComponents message', () => {
            expect(SOLUTION_LAYERS.loadingComponents).toBe('Loading solution components...');
        });
    });

    describe('function messages', () => {
        it('should format loadSolutionsFailed correctly', () => {
            expect(SOLUTION_LAYERS.loadSolutionsFailed('API error')).toBe('Failed to load solutions: API error');
        });

        it('should format loadComponentsFailed correctly', () => {
            expect(SOLUTION_LAYERS.loadComponentsFailed('Timeout')).toBe('Failed to load solution components: Timeout');
        });

        it('should format deleteLayerFailed correctly', () => {
            expect(SOLUTION_LAYERS.deleteLayerFailed('Permission denied')).toBe('Failed to remove active customization: Permission denied');
        });
    });
});
