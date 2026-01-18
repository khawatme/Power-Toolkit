/**
 * @file Tests for metadata helpers
 * @module tests/helpers/metadata.helpers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetadataHelpers } from '../../src/helpers/metadata.helpers.js';

// Mock dependencies
vi.mock('../../src/ui/MetadataBrowserDialog.js', () => ({
    MetadataBrowserDialog: {
        show: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: {
        show: vi.fn()
    }
}));

vi.mock('../../src/constants/index.js', () => ({
    Config: {
        MESSAGES: {
            WEB_API: {
                enterValidTable: 'Please enter a valid table name'
            }
        }
    }
}));

describe('Metadata Helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getMetadataDisplayName', () => {
        // Happy path scenarios
        it('should return UserLocalizedLabel when available', () => {
            const metadataItem = {
                DisplayName: {
                    UserLocalizedLabel: {
                        Label: 'Account Name'
                    }
                },
                SchemaName: 'account_name'
            };
            expect(MetadataHelpers.getMetadataDisplayName(metadataItem)).toBe('Account Name');
        });

        it('should return SchemaName when UserLocalizedLabel is not available', () => {
            const metadataItem = {
                DisplayName: {},
                SchemaName: 'new_customfield'
            };
            expect(MetadataHelpers.getMetadataDisplayName(metadataItem)).toBe('new_customfield');
        });

        it('should return SchemaName when DisplayName is null', () => {
            const metadataItem = {
                DisplayName: null,
                SchemaName: 'ContactId'
            };
            expect(MetadataHelpers.getMetadataDisplayName(metadataItem)).toBe('ContactId');
        });

        it('should return SchemaName when DisplayName is undefined', () => {
            const metadataItem = {
                SchemaName: 'LeadId'
            };
            expect(MetadataHelpers.getMetadataDisplayName(metadataItem)).toBe('LeadId');
        });

        it('should return SchemaName when UserLocalizedLabel is null', () => {
            const metadataItem = {
                DisplayName: {
                    UserLocalizedLabel: null
                },
                SchemaName: 'OpportunityId'
            };
            expect(MetadataHelpers.getMetadataDisplayName(metadataItem)).toBe('OpportunityId');
        });

        it('should return SchemaName when Label is empty string', () => {
            const metadataItem = {
                DisplayName: {
                    UserLocalizedLabel: {
                        Label: ''
                    }
                },
                SchemaName: 'CaseId'
            };
            expect(MetadataHelpers.getMetadataDisplayName(metadataItem)).toBe('CaseId');
        });

        // Edge cases
        it('should return empty string when metadataItem is null', () => {
            expect(MetadataHelpers.getMetadataDisplayName(null)).toBe('');
        });

        it('should return empty string when metadataItem is undefined', () => {
            expect(MetadataHelpers.getMetadataDisplayName(undefined)).toBe('');
        });

        it('should return empty string when metadataItem is empty object', () => {
            expect(MetadataHelpers.getMetadataDisplayName({})).toBe('');
        });

        it('should return empty string when both DisplayName and SchemaName are missing', () => {
            const metadataItem = { LogicalName: 'account' };
            expect(MetadataHelpers.getMetadataDisplayName(metadataItem)).toBe('');
        });

        // Localization scenarios
        it('should handle localized labels with special characters', () => {
            const metadataItem = {
                DisplayName: {
                    UserLocalizedLabel: {
                        Label: 'Nom du compte (français)'
                    }
                },
                SchemaName: 'accountname'
            };
            expect(MetadataHelpers.getMetadataDisplayName(metadataItem)).toBe('Nom du compte (français)');
        });

        it('should handle localized labels with unicode characters', () => {
            const metadataItem = {
                DisplayName: {
                    UserLocalizedLabel: {
                        Label: '账户名称'
                    }
                },
                SchemaName: 'accountname'
            };
            expect(MetadataHelpers.getMetadataDisplayName(metadataItem)).toBe('账户名称');
        });

        it('should handle localized labels with RTL characters', () => {
            const metadataItem = {
                DisplayName: {
                    UserLocalizedLabel: {
                        Label: 'اسم الحساب'
                    }
                },
                SchemaName: 'accountname'
            };
            expect(MetadataHelpers.getMetadataDisplayName(metadataItem)).toBe('اسم الحساب');
        });

        // Different metadata types
        it('should handle entity metadata', () => {
            const entityMetadata = {
                DisplayName: {
                    UserLocalizedLabel: {
                        Label: 'Account',
                        LanguageCode: 1033
                    }
                },
                SchemaName: 'Account',
                LogicalName: 'account',
                EntitySetName: 'accounts'
            };
            expect(MetadataHelpers.getMetadataDisplayName(entityMetadata)).toBe('Account');
        });

        it('should handle attribute metadata', () => {
            const attributeMetadata = {
                DisplayName: {
                    UserLocalizedLabel: {
                        Label: 'Primary Contact',
                        LanguageCode: 1033
                    }
                },
                SchemaName: 'PrimaryContactId',
                LogicalName: 'primarycontactid',
                AttributeType: 'Lookup'
            };
            expect(MetadataHelpers.getMetadataDisplayName(attributeMetadata)).toBe('Primary Contact');
        });

        it('should handle optionset metadata', () => {
            const optionSetMetadata = {
                DisplayName: {
                    UserLocalizedLabel: {
                        Label: 'Status Reason'
                    }
                },
                SchemaName: 'statuscode',
                OptionSetType: 'Status'
            };
            expect(MetadataHelpers.getMetadataDisplayName(optionSetMetadata)).toBe('Status Reason');
        });

        it('should prioritize UserLocalizedLabel over SchemaName', () => {
            const metadataItem = {
                DisplayName: {
                    UserLocalizedLabel: {
                        Label: 'Display Label'
                    }
                },
                SchemaName: 'SchemaNameValue'
            };
            expect(MetadataHelpers.getMetadataDisplayName(metadataItem)).toBe('Display Label');
        });
    });

    describe('showColumnBrowser', () => {
        let MetadataBrowserDialog;
        let NotificationService;

        beforeEach(async () => {
            const dialogModule = await import('../../src/ui/MetadataBrowserDialog.js');
            const notificationModule = await import('../../src/services/NotificationService.js');
            MetadataBrowserDialog = dialogModule.MetadataBrowserDialog;
            NotificationService = notificationModule.NotificationService;
        });

        // Happy path scenarios
        it('should call MetadataBrowserDialog.show when entity name is resolved', async () => {
            const resolveEntityName = vi.fn().mockResolvedValue('account');
            const onSelect = vi.fn();

            await MetadataHelpers.showColumnBrowser(resolveEntityName, onSelect);

            expect(resolveEntityName).toHaveBeenCalled();
            expect(MetadataBrowserDialog.show).toHaveBeenCalledWith('attribute', onSelect, 'account');
        });

        it('should pass correct parameters to MetadataBrowserDialog.show', async () => {
            const resolveEntityName = vi.fn().mockResolvedValue('contact');
            const onSelect = vi.fn();

            await MetadataHelpers.showColumnBrowser(resolveEntityName, onSelect);

            expect(MetadataBrowserDialog.show).toHaveBeenCalledWith('attribute', onSelect, 'contact');
        });

        it('should handle different entity names', async () => {
            const entities = ['lead', 'opportunity', 'case', 'incident'];

            for (const entity of entities) {
                vi.clearAllMocks();
                const resolveEntityName = vi.fn().mockResolvedValue(entity);
                const onSelect = vi.fn();

                await MetadataHelpers.showColumnBrowser(resolveEntityName, onSelect);

                expect(MetadataBrowserDialog.show).toHaveBeenCalledWith('attribute', onSelect, entity);
            }
        });

        // Error handling scenarios
        it('should show warning notification when resolveEntityName throws error', async () => {
            const resolveEntityName = vi.fn().mockRejectedValue(new Error('No entity selected'));
            const onSelect = vi.fn();

            await MetadataHelpers.showColumnBrowser(resolveEntityName, onSelect);

            expect(NotificationService.show).toHaveBeenCalledWith('No entity selected', 'warning');
            expect(MetadataBrowserDialog.show).not.toHaveBeenCalled();
        });

        it('should show default message when error has no message', async () => {
            const resolveEntityName = vi.fn().mockRejectedValue(new Error());
            const onSelect = vi.fn();

            await MetadataHelpers.showColumnBrowser(resolveEntityName, onSelect);

            expect(NotificationService.show).toHaveBeenCalledWith('Please enter a valid table name', 'warning');
        });

        it('should show notification with custom error message', async () => {
            const customError = new Error('Custom validation error');
            const resolveEntityName = vi.fn().mockRejectedValue(customError);
            const onSelect = vi.fn();

            await MetadataHelpers.showColumnBrowser(resolveEntityName, onSelect);

            expect(NotificationService.show).toHaveBeenCalledWith('Custom validation error', 'warning');
        });

        it('should not call onSelect when entity resolution fails', async () => {
            const resolveEntityName = vi.fn().mockRejectedValue(new Error('Failed'));
            const onSelect = vi.fn();

            await MetadataHelpers.showColumnBrowser(resolveEntityName, onSelect);

            expect(onSelect).not.toHaveBeenCalled();
        });

        it('should handle non-Error objects thrown', async () => {
            const resolveEntityName = vi.fn().mockRejectedValue({ message: 'Object error' });
            const onSelect = vi.fn();

            await MetadataHelpers.showColumnBrowser(resolveEntityName, onSelect);

            expect(NotificationService.show).toHaveBeenCalledWith('Object error', 'warning');
        });

        it('should handle string thrown as error', async () => {
            const resolveEntityName = vi.fn().mockRejectedValue('String error');
            const onSelect = vi.fn();

            await MetadataHelpers.showColumnBrowser(resolveEntityName, onSelect);

            expect(NotificationService.show).toHaveBeenCalledWith('Please enter a valid table name', 'warning');
        });

        // Async behavior tests
        it('should wait for resolveEntityName to complete', async () => {
            let resolved = false;
            const resolveEntityName = vi.fn().mockImplementation(() => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolved = true;
                        resolve('account');
                    }, 10);
                });
            });
            const onSelect = vi.fn();

            await MetadataHelpers.showColumnBrowser(resolveEntityName, onSelect);

            expect(resolved).toBe(true);
            expect(MetadataBrowserDialog.show).toHaveBeenCalled();
        });

        it('should await MetadataBrowserDialog.show', async () => {
            const resolveEntityName = vi.fn().mockResolvedValue('account');
            const onSelect = vi.fn();
            let dialogShown = false;

            MetadataBrowserDialog.show.mockImplementation(() => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        dialogShown = true;
                        resolve();
                    }, 10);
                });
            });

            await MetadataHelpers.showColumnBrowser(resolveEntityName, onSelect);

            expect(dialogShown).toBe(true);
        });
    });
});
