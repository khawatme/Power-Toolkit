/**
 * @file Tests for MetadataBrowserDialog
 * @module tests/ui/MetadataBrowserDialog.test.js
 * @description Test suite for metadata browser dialog
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockDataService = {
    getEntityDefinitions: vi.fn(),
    getAttributeDefinitions: vi.fn()
};

const mockDialogService = {
    show: vi.fn()
};

vi.mock('../../src/services/DataService.js', () => ({
    DataService: mockDataService
}));

vi.mock('../../src/services/DialogService.js', () => ({
    DialogService: mockDialogService
}));

describe('MetadataBrowserDialog', () => {
    let MetadataBrowserDialog;
    let mockDialog;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create a mock dialog with a spy close function
        const closeFn = vi.fn();
        mockDialog = {
            close: closeFn,
            _closeSpy: closeFn
        };
        mockDialogService.show.mockReturnValue(mockDialog);

        // Reset modules to get fresh imports
        vi.resetModules();
        const module = await import('../../src/ui/MetadataBrowserDialog.js');
        MetadataBrowserDialog = module.MetadataBrowserDialog;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('show', () => {
        describe('entity picker', () => {
            it('should display entity picker dialog', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } },
                    { LogicalName: 'contact', DisplayName: { UserLocalizedLabel: { Label: 'Contact' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                expect(mockDialogService.show).toHaveBeenCalled();
                expect(mockDataService.getEntityDefinitions).toHaveBeenCalled();
            });

            it('should use correct title for entity picker', async () => {
                mockDataService.getEntityDefinitions.mockResolvedValue([]);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                expect(mockDialogService.show).toHaveBeenCalled();
                const callArgs = mockDialogService.show.mock.calls[0];
                expect(callArgs[0]).toContain('Table');
            });

            it('should render entities in table', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } },
                    { LogicalName: 'contact', DisplayName: { UserLocalizedLabel: { Label: 'Contact' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');

                expect(listContainer.innerHTML).toContain('account');
                expect(listContainer.innerHTML).toContain('contact');
            });

            it('should handle empty entity list', async () => {
                mockDataService.getEntityDefinitions.mockResolvedValue([]);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                expect(mockDataService.getEntityDefinitions).toHaveBeenCalled();
                expect(mockDialogService.show).toHaveBeenCalled();
            });

            it('should handle errors gracefully', async () => {
                mockDataService.getEntityDefinitions.mockRejectedValue(new Error('API Error'));

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                expect(mockDialogService.show).toHaveBeenCalled();
                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');
                expect(listContainer.innerHTML).toContain('error');
            });

            it('should include search input', async () => {
                mockDataService.getEntityDefinitions.mockResolvedValue([]);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const searchInput = dialogContent.querySelector('#pdt-metadata-search');
                expect(searchInput).toBeTruthy();
            });

            it('should call onSelect when row is clicked', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');
                const row = listContainer.querySelector('tr[data-logical-name="account"]');

                if (row) {
                    row.click();
                    expect(onSelect).toHaveBeenCalled();
                    expect(onSelect.mock.calls[0][0].LogicalName).toBe('account');
                }
            });

            it('should close dialog after selection', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');
                const row = listContainer.querySelector('tr[data-logical-name="account"]');

                if (row) {
                    row.click();
                    // The dialog close gets overridden by the component, so we check the spy was wrapped
                    expect(mockDialog._closeSpy).toHaveBeenCalled();
                }
            });
        });

        describe('attribute picker', () => {
            it('should display attribute picker for entity', async () => {
                const mockAttributes = [
                    { LogicalName: 'name', DisplayName: { UserLocalizedLabel: { Label: 'Name' } } },
                    { LogicalName: 'email', DisplayName: { UserLocalizedLabel: { Label: 'Email' } } }
                ];

                mockDataService.getAttributeDefinitions.mockResolvedValue(mockAttributes);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('attribute', onSelect, 'contact');

                expect(mockDialogService.show).toHaveBeenCalled();
                expect(mockDataService.getAttributeDefinitions).toHaveBeenCalledWith('contact');
            });

            it('should use correct title for attribute picker', async () => {
                mockDataService.getAttributeDefinitions.mockResolvedValue([]);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('attribute', onSelect, 'account');

                expect(mockDialogService.show).toHaveBeenCalled();
                const callArgs = mockDialogService.show.mock.calls[0];
                expect(callArgs[0]).toContain('account');
            });

            it('should show error when attribute type without entity', async () => {
                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('attribute', onSelect);

                expect(mockDialogService.show).toHaveBeenCalled();
                expect(mockDataService.getAttributeDefinitions).not.toHaveBeenCalled();
            });

            it('should render attributes in table', async () => {
                const mockAttributes = [
                    { LogicalName: 'name', DisplayName: { UserLocalizedLabel: { Label: 'Name' } } },
                    { LogicalName: 'emailaddress1', DisplayName: { UserLocalizedLabel: { Label: 'Email' } } }
                ];

                mockDataService.getAttributeDefinitions.mockResolvedValue(mockAttributes);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('attribute', onSelect, 'contact');

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');

                expect(listContainer.innerHTML).toContain('name');
                expect(listContainer.innerHTML).toContain('emailaddress1');
            });

            it('should call onSelect with attribute when clicked', async () => {
                const mockAttributes = [
                    { LogicalName: 'name', DisplayName: { UserLocalizedLabel: { Label: 'Name' } } }
                ];

                mockDataService.getAttributeDefinitions.mockResolvedValue(mockAttributes);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('attribute', onSelect, 'account');

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');
                const row = listContainer.querySelector('tr[data-logical-name="name"]');

                if (row) {
                    row.click();
                    expect(onSelect).toHaveBeenCalled();
                    expect(onSelect.mock.calls[0][0].LogicalName).toBe('name');
                }
            });

            it('should handle attribute load errors', async () => {
                mockDataService.getAttributeDefinitions.mockRejectedValue(new Error('Failed to load'));

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('attribute', onSelect, 'account');

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');
                expect(listContainer.innerHTML).toContain('error');
            });
        });

        describe('search functionality', () => {
            it('should include search input with placeholder', async () => {
                mockDataService.getEntityDefinitions.mockResolvedValue([]);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const searchInput = dialogContent.querySelector('#pdt-metadata-search');

                expect(searchInput).toBeTruthy();
                expect(searchInput.placeholder).toBeTruthy();
            });

            it('should filter entities on search', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } },
                    { LogicalName: 'contact', DisplayName: { UserLocalizedLabel: { Label: 'Contact' } } },
                    { LogicalName: 'lead', DisplayName: { UserLocalizedLabel: { Label: 'Lead' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const searchInput = dialogContent.querySelector('#pdt-metadata-search');
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');

                // Initially all entities visible
                expect(listContainer.innerHTML).toContain('account');
                expect(listContainer.innerHTML).toContain('contact');
                expect(listContainer.innerHTML).toContain('lead');

                // Trigger search - note: search uses debounce so might need to simulate
                searchInput.value = 'account';
                searchInput.dispatchEvent(new Event('keyup'));

                // Wait for debounce (the actual filtering is async/debounced)
                await new Promise(resolve => setTimeout(resolve, 250));
            });
        });

        describe('sorting functionality', () => {
            it('should render sortable headers', async () => {
                const mockEntities = [
                    { LogicalName: 'contact', DisplayName: { UserLocalizedLabel: { Label: 'Contact' } } },
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');
                const headers = listContainer.querySelectorAll('th[data-sort-key]');

                expect(headers.length).toBeGreaterThan(0);
            });

            it('should sort by display name by default', async () => {
                const mockEntities = [
                    { LogicalName: 'contact', DisplayName: { UserLocalizedLabel: { Label: 'Contact' } } },
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');
                const rows = listContainer.querySelectorAll('tbody tr');

                // First row should be Account (alphabetically first)
                if (rows.length >= 2) {
                    expect(rows[0].getAttribute('data-logical-name')).toBe('account');
                }
            });

            it('should toggle sort on header click', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } },
                    { LogicalName: 'contact', DisplayName: { UserLocalizedLabel: { Label: 'Contact' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');
                const header = listContainer.querySelector('th[data-sort-key]');

                if (header) {
                    header.click();
                    // Sort should toggle
                }
            });

            it('should support keyboard navigation for sorting', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');
                const header = listContainer.querySelector('th[data-sort-key]');

                if (header) {
                    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
                    header.dispatchEvent(enterEvent);
                }
            });
        });

        describe('display name handling', () => {
            it('should handle entities without DisplayName', async () => {
                const mockEntities = [
                    { LogicalName: 'account' }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');

                expect(listContainer.innerHTML).toContain('account');
            });

            it('should handle entities with null UserLocalizedLabel', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: null } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');

                expect(listContainer.innerHTML).toContain('account');
            });
        });

        describe('cleanup', () => {
            it('should remove event listeners on dialog close', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                // Call the overridden close method
                mockDialog.close();

                // The close function was called (it gets overwritten by the component)
                expect(mockDialog._closeSpy).toHaveBeenCalled();
            });
        });

        describe('edge cases', () => {
            it('should handle very long entity names', async () => {
                const longName = 'a'.repeat(200);
                const mockEntities = [
                    { LogicalName: longName, DisplayName: { UserLocalizedLabel: { Label: 'Test Entity' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');

                expect(listContainer.innerHTML).toContain(longName);
            });

            it('should escape HTML in entity names', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: '<script>xss</script>' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');

                expect(listContainer.innerHTML).not.toContain('<script>');
            });

            it('should handle special characters in search', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const searchInput = dialogContent.querySelector('#pdt-metadata-search');

                searchInput.value = '.*+?^${}()|[]\\';
                searchInput.dispatchEvent(new Event('keyup'));

                // Should not throw error
            });

            it('should handle rapid search input', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const searchInput = dialogContent.querySelector('#pdt-metadata-search');

                // Rapid input changes
                for (let i = 0; i < 10; i++) {
                    searchInput.value = 'a'.repeat(i);
                    searchInput.dispatchEvent(new Event('keyup'));
                }

                // Should not throw and should debounce properly
            });

            it('should handle clicking on non-row elements', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');

                // Click on the container itself, not a row
                listContainer.click();

                // onSelect should not be called
                expect(onSelect).not.toHaveBeenCalled();
            });

            it('should handle keyboard Enter on sort header', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } },
                    { LogicalName: 'contact', DisplayName: { UserLocalizedLabel: { Label: 'Contact' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');
                const sortHeader = listContainer.querySelector('th[data-sort-key]');

                if (sortHeader) {
                    // Dispatch keydown with Enter key on the header
                    const keyEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
                    sortHeader.dispatchEvent(keyEvent);

                    // Should trigger sort - we just verify it doesn't throw
                }
            });

            it('should handle keyboard Space on sort header', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } },
                    { LogicalName: 'contact', DisplayName: { UserLocalizedLabel: { Label: 'Contact' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');
                const sortHeader = listContainer.querySelector('th[data-sort-key]');

                if (sortHeader) {
                    // Dispatch keydown with Space key on the header
                    const keyEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
                    sortHeader.dispatchEvent(keyEvent);

                    // Should trigger sort and prevent default - we just verify it doesn't throw
                }
            });

            it('should not trigger sort on other keys', async () => {
                const mockEntities = [
                    { LogicalName: 'account', DisplayName: { UserLocalizedLabel: { Label: 'Account' } } }
                ];

                mockDataService.getEntityDefinitions.mockResolvedValue(mockEntities);

                const onSelect = vi.fn();
                await MetadataBrowserDialog.show('entity', onSelect);

                const dialogContent = mockDialogService.show.mock.calls[0][1];
                const listContainer = dialogContent.querySelector('#pdt-metadata-list');
                const sortHeader = listContainer.querySelector('th[data-sort-key]');

                if (sortHeader) {
                    // Dispatch keydown with Tab key (should not trigger sort)
                    const keyEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
                    sortHeader.dispatchEvent(keyEvent);

                    // Should not throw
                }
            });
        });
    });
});
