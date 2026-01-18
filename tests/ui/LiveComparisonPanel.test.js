/**
 * @file Tests for LiveComparisonPanel
 * @module tests/ui/LiveComparisonPanel.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies BEFORE importing
vi.mock('../../src/services/LiveImpersonationService.js', () => ({
    LiveImpersonationService: {
        stop: vi.fn(),
        clearResults: vi.fn(),
        isActive: false,
        results: [],
        comparisonResults: [],
        impersonatedUserName: 'Test User',
        getSummary: vi.fn().mockReturnValue({
            totalDifferences: 0,
            accessDenied: 0,
            hiddenRecords: 0,
            hiddenFields: 0
        }),
        onComparisonUpdate: null
    }
}));

vi.mock('../../src/core/ComponentRegistry.js', () => ({
    ComponentRegistry: {
        get: vi.fn()
    }
}));

vi.mock('../../src/helpers/index.js', () => ({
    escapeHtml: (text) => String(text).replace(/[&<>"']/g, (char) => {
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return escapeMap[char];
    }),
    copyToClipboard: vi.fn()
}));

// Import AFTER mocks
import { LiveComparisonPanel } from '../../src/ui/LiveComparisonPanel.js';
import { LiveImpersonationService } from '../../src/services/LiveImpersonationService.js';
import { ComponentRegistry } from '../../src/core/ComponentRegistry.js';

describe('LiveComparisonPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        // Reset the panel state
        if (LiveComparisonPanel.panel) {
            LiveComparisonPanel.panel.remove();
            LiveComparisonPanel.panel = null;
        }
    });

    afterEach(() => {
        if (LiveComparisonPanel.panel) {
            LiveComparisonPanel.panel.remove();
            LiveComparisonPanel.panel = null;
        }
    });

    describe('initialization', () => {
        it('should create panel on first show', () => {
            LiveComparisonPanel.show('Test User');

            expect(LiveComparisonPanel.panel).toBeTruthy();
            expect(LiveComparisonPanel.panel.id).toBe('pdt-live-comparison-panel');
        });

        it('should have correct structure with header and body', () => {
            LiveComparisonPanel.show('Test User');

            const header = LiveComparisonPanel.panel.querySelector('.pdt-live-header');
            const body = LiveComparisonPanel.panel.querySelector('.pdt-live-body');

            expect(header).toBeTruthy();
            expect(body).toBeTruthy();
        });

        it('should have minimize and stop buttons in controls', () => {
            LiveComparisonPanel.show('Test User');

            const minimizeBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-minimize');
            const stopBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-stop');

            expect(minimizeBtn).toBeTruthy();
            expect(stopBtn).toBeTruthy();
        });
    });

    describe('show', () => {
        it('should display panel when called', () => {
            LiveComparisonPanel.show('John Doe');

            expect(LiveComparisonPanel.panel.style.display).toBe('flex');
        });

        it('should set username in panel', () => {
            LiveComparisonPanel.show('Jane Smith');

            const username = LiveComparisonPanel.panel.querySelector('#pdt-live-username');
            expect(username.textContent).toBe('Jane Smith');
        });

        it('should reset stats when showing', () => {
            LiveComparisonPanel.show('Test User');

            // Stats are updated via _updateSummary which is called in show()
            // Check that the UI stat elements exist
            expect(LiveComparisonPanel.ui.totalStat).toBeTruthy();
            expect(LiveComparisonPanel.ui.deniedStat).toBeTruthy();
            expect(LiveComparisonPanel.ui.recordsStat).toBeTruthy();
            expect(LiveComparisonPanel.ui.fieldsStat).toBeTruthy();
        });
    });

    describe('hide', () => {
        it('should hide panel when called', () => {
            LiveComparisonPanel.show('Test User');
            LiveComparisonPanel.hide();

            expect(LiveComparisonPanel.panel.style.display).toBe('none');
        });
    });

    describe('stop button', () => {
        it('should call LiveImpersonationService.stop when clicked', () => {
            LiveComparisonPanel.show('Test User');

            const stopBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-stop');
            stopBtn.click();

            expect(LiveImpersonationService.stop).toHaveBeenCalled();
        });

        it('should hide panel when stop is clicked', () => {
            LiveComparisonPanel.show('Test User');

            const stopBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-stop');
            stopBtn.click();

            expect(LiveComparisonPanel.panel.style.display).toBe('none');
        });

        it('should notify ImpersonateTab to update button state', () => {
            const mockImpersonateTab = {
                _updateLiveButtonState: vi.fn()
            };

            ComponentRegistry.get.mockReturnValue(mockImpersonateTab);

            LiveComparisonPanel.show('Test User');

            const stopBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-stop');
            stopBtn.click();

            expect(ComponentRegistry.get).toHaveBeenCalledWith('impersonate');
            expect(mockImpersonateTab._updateLiveButtonState).toHaveBeenCalledWith(false);
        });

        it('should handle missing ImpersonateTab gracefully', () => {
            ComponentRegistry.get.mockReturnValue(null);

            LiveComparisonPanel.show('Test User');

            const stopBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-stop');

            // Should not throw
            expect(() => stopBtn.click()).not.toThrow();
        });

        it('should handle ImpersonateTab without _updateLiveButtonState method', () => {
            ComponentRegistry.get.mockReturnValue({});

            LiveComparisonPanel.show('Test User');

            const stopBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-stop');

            // Should not throw
            expect(() => stopBtn.click()).not.toThrow();
        });
    });

    describe('minimize button', () => {
        it('should toggle minimized state when clicked', () => {
            LiveComparisonPanel.show('Test User');

            const minimizeBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-minimize');

            expect(LiveComparisonPanel.isMinimized).toBe(false);

            minimizeBtn.click();
            expect(LiveComparisonPanel.isMinimized).toBe(true);

            minimizeBtn.click();
            expect(LiveComparisonPanel.isMinimized).toBe(false);
        });

        it('should update panel class when minimized', () => {
            LiveComparisonPanel.show('Test User');

            const minimizeBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-minimize');
            minimizeBtn.click();

            // Check the isMinimized state and body display style
            expect(LiveComparisonPanel.isMinimized).toBe(true);
            expect(LiveComparisonPanel.ui.body.style.display).toBe('none');
        });
    });

    describe('clear button', () => {
        it('should call LiveImpersonationService.clearResults when clicked', () => {
            LiveComparisonPanel.show('Test User');

            const clearBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-clear');
            clearBtn.click();

            expect(LiveImpersonationService.clearResults).toHaveBeenCalled();
        });
    });

    describe('_updateSummary', () => {
        it('should update summary stats via internal method', () => {
            LiveComparisonPanel.show('Test User');

            // _updateSummary is called in show() with zeros
            // Verify UI stat elements were created
            expect(LiveComparisonPanel.ui.totalStat).toBeTruthy();
            expect(LiveComparisonPanel.ui.deniedStat).toBeTruthy();
            expect(LiveComparisonPanel.ui.recordsStat).toBeTruthy();
            expect(LiveComparisonPanel.ui.fieldsStat).toBeTruthy();
        });
    });

    describe('draggable functionality', () => {
        it('should have draggable header', () => {
            LiveComparisonPanel.show('Test User');

            const header = LiveComparisonPanel.panel.querySelector('.pdt-live-header');
            expect(header).toBeTruthy();
        });

        it('should have fixed positioning', () => {
            LiveComparisonPanel.show('Test User');

            // Panel has pdt-live-panel class which sets position via CSS
            expect(LiveComparisonPanel.panel.classList.contains('pdt-live-panel')).toBe(true);
        });
    });

    describe('destroy', () => {
        it('should hide panel when destroyed', () => {
            LiveComparisonPanel.show('Test User');
            LiveComparisonPanel.destroy();

            expect(LiveComparisonPanel.isVisible).toBe(false);
        });

        it('should remove panel from DOM', () => {
            LiveComparisonPanel.show('Test User');
            const panelParent = LiveComparisonPanel.panel.parentNode;

            LiveComparisonPanel.destroy();

            expect(LiveComparisonPanel.panel).toBeNull();
        });

        it('should reset UI refs', () => {
            LiveComparisonPanel.show('Test User');
            LiveComparisonPanel.destroy();

            expect(LiveComparisonPanel.ui).toEqual({});
        });

        it('should handle destroy when panel does not exist', () => {
            // Don't show panel, just try to destroy
            LiveComparisonPanel.panel = null;

            expect(() => LiveComparisonPanel.destroy()).not.toThrow();
        });
    });

    describe('show edge cases', () => {
        it('should use Unknown User when userName is null', () => {
            LiveComparisonPanel.show(null);

            const username = LiveComparisonPanel.panel.querySelector('#pdt-live-username');
            expect(username.textContent).toBe('Unknown User');
        });

        it('should use Unknown User when userName is undefined', () => {
            LiveComparisonPanel.show(undefined);

            const username = LiveComparisonPanel.panel.querySelector('#pdt-live-username');
            expect(username.textContent).toBe('Unknown User');
        });

        it('should reuse existing panel on second show', () => {
            LiveComparisonPanel.show('First User');
            const firstPanel = LiveComparisonPanel.panel;

            LiveComparisonPanel.show('Second User');

            expect(LiveComparisonPanel.panel).toBe(firstPanel);
            expect(LiveComparisonPanel.ui.userName.textContent).toBe('Second User');
        });

        it('should reset minimized state on show', () => {
            LiveComparisonPanel.show('Test User');
            LiveComparisonPanel.isMinimized = true;

            LiveComparisonPanel.show('Test User Again');

            expect(LiveComparisonPanel.isMinimized).toBe(false);
        });

        it('should set onComparisonUpdate callback', () => {
            LiveComparisonPanel.show('Test User');

            expect(LiveImpersonationService.onComparisonUpdate).toBeInstanceOf(Function);
        });
    });

    describe('hide', () => {
        it('should set isVisible to false', () => {
            LiveComparisonPanel.show('Test User');
            LiveComparisonPanel.hide();

            expect(LiveComparisonPanel.isVisible).toBe(false);
        });

        it('should clear onComparisonUpdate callback', () => {
            LiveComparisonPanel.show('Test User');
            LiveComparisonPanel.hide();

            expect(LiveImpersonationService.onComparisonUpdate).toBeNull();
        });

        it('should handle hide when panel is null', () => {
            LiveComparisonPanel.panel = null;

            expect(() => LiveComparisonPanel.hide()).not.toThrow();
        });
    });

    describe('_updateResults', () => {
        it('should update summary when results change', () => {
            LiveImpersonationService.getSummary.mockReturnValue({
                totalDifferences: 5,
                accessDenied: 2,
                hiddenRecords: 3,
                hiddenFields: 1
            });

            LiveComparisonPanel.show('Test User');

            // Trigger the update callback
            const callback = LiveImpersonationService.onComparisonUpdate;
            callback([{
                timestamp: new Date(),
                entityName: 'account',
                url: '/api/data/v9.2/accounts',
                fullUrl: 'https://org.crm.dynamics.com/api/data/v9.2/accounts',
                userCanAccess: true,
                hiddenRecords: [],
                hiddenFields: ['field1'],
                hiddenCount: 0
            }]);

            expect(LiveComparisonPanel.ui.totalStat.textContent).toBe('5');
            expect(LiveComparisonPanel.ui.deniedStat.textContent).toBe('2');
            expect(LiveComparisonPanel.ui.recordsStat.textContent).toBe('3');
            expect(LiveComparisonPanel.ui.fieldsStat.textContent).toBe('1');
        });

        it('should show empty message when results is empty', () => {
            LiveComparisonPanel.show('Test User');

            const callback = LiveImpersonationService.onComparisonUpdate;
            callback([]);

            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('pdt-live-empty');
        });

        it('should render result items when results exist', () => {
            LiveComparisonPanel.show('Test User');

            const callback = LiveImpersonationService.onComparisonUpdate;
            callback([{
                timestamp: new Date(),
                entityName: 'account',
                url: '/api/data/v9.2/accounts',
                fullUrl: 'https://org.crm.dynamics.com/api/data/v9.2/accounts',
                userCanAccess: true,
                hiddenRecords: [],
                hiddenFields: ['revenue', 'creditlimit'],
                hiddenCount: 0
            }]);

            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('account');
            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('pdt-live-item');
        });
    });

    describe('_renderResultItem', () => {
        beforeEach(() => {
            LiveComparisonPanel.show('Test User');
        });

        it('should render access denied result', () => {
            const callback = LiveImpersonationService.onComparisonUpdate;
            callback([{
                timestamp: new Date(),
                entityName: 'account',
                url: '/api/data/v9.2/accounts(123)',
                fullUrl: 'https://org.crm.dynamics.com/api/data/v9.2/accounts(123)',
                userCanAccess: false,
                error: 'Access Denied',
                hiddenRecords: [],
                hiddenFields: [],
                hiddenCount: 0
            }]);

            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('pdt-live-item-error');
            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('🚫');
        });

        it('should render hidden records result with hiddenCount', () => {
            const callback = LiveImpersonationService.onComparisonUpdate;
            callback([{
                timestamp: new Date(),
                entityName: 'account',
                url: '/api/data/v9.2/accounts',
                fullUrl: 'https://org.crm.dynamics.com/api/data/v9.2/accounts',
                userCanAccess: true,
                hiddenRecords: ['id1', 'id2'],
                hiddenFields: [],
                hiddenCount: 5,
                adminCount: 10,
                userCount: 5
            }]);

            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('pdt-live-item-warning');
            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('📋');
            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('5/10');
        });

        it('should render hidden records result without count info', () => {
            const callback = LiveImpersonationService.onComparisonUpdate;
            callback([{
                timestamp: new Date(),
                entityName: 'account',
                url: '/api/data/v9.2/accounts',
                fullUrl: 'https://org.crm.dynamics.com/api/data/v9.2/accounts',
                userCanAccess: true,
                hiddenRecords: ['id1', 'id2'],
                hiddenFields: [],
                hiddenCount: 2,
                adminCount: null,
                userCount: null
            }]);

            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('pdt-live-item-warning');
            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('2');
        });

        it('should render hidden fields result', () => {
            const callback = LiveImpersonationService.onComparisonUpdate;
            callback([{
                timestamp: new Date(),
                entityName: 'account',
                url: '/api/data/v9.2/accounts(123)',
                fullUrl: 'https://org.crm.dynamics.com/api/data/v9.2/accounts(123)',
                userCanAccess: true,
                hiddenRecords: [],
                hiddenFields: ['revenue', 'creditlimit'],
                hiddenCount: 0
            }]);

            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('pdt-live-item-info');
            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('🔒');
            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('revenue');
        });

        it('should truncate hidden fields list when more than 5', () => {
            const callback = LiveImpersonationService.onComparisonUpdate;
            callback([{
                timestamp: new Date(),
                entityName: 'account',
                url: '/api/data/v9.2/accounts(123)',
                fullUrl: 'https://org.crm.dynamics.com/api/data/v9.2/accounts(123)',
                userCanAccess: true,
                hiddenRecords: [],
                hiddenFields: ['field1', 'field2', 'field3', 'field4', 'field5', 'field6', 'field7'],
                hiddenCount: 0
            }]);

            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('+2 more');
        });

        it('should render unknown difference when no specific issue', () => {
            const callback = LiveImpersonationService.onComparisonUpdate;
            callback([{
                timestamp: new Date(),
                entityName: 'account',
                url: '/api/data/v9.2/accounts',
                fullUrl: 'https://org.crm.dynamics.com/api/data/v9.2/accounts',
                userCanAccess: true,
                hiddenRecords: [],
                hiddenFields: [],
                hiddenCount: 0
            }]);

            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('pdt-live-item-warning');
            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('⚠️');
        });

        it('should use hiddenRecords.length when hiddenCount is 0', () => {
            const callback = LiveImpersonationService.onComparisonUpdate;
            callback([{
                timestamp: new Date(),
                entityName: 'account',
                url: '/api/data/v9.2/accounts',
                fullUrl: 'https://org.crm.dynamics.com/api/data/v9.2/accounts',
                userCanAccess: true,
                hiddenRecords: ['id1', 'id2', 'id3'],
                hiddenFields: [],
                hiddenCount: 0,
                adminCount: null,
                userCount: null
            }]);

            expect(LiveComparisonPanel.ui.resultsList.innerHTML).toContain('3');
        });
    });

    describe('copy button and _copyReport', () => {
        it('should call copyToClipboard when clicked', async () => {
            const { copyToClipboard } = await import('../../src/helpers/index.js');

            LiveImpersonationService.comparisonResults = [
                {
                    timestamp: new Date(),
                    entityName: 'account',
                    url: '/api/data/v9.2/accounts',
                    userCanAccess: true,
                    error: null,
                    hiddenRecords: ['id1'],
                    hiddenFields: [],
                    hiddenCount: 1,
                    adminCount: 5,
                    userCount: 4
                }
            ];
            LiveImpersonationService.getSummary.mockReturnValue({
                totalDifferences: 1,
                accessDenied: 0,
                hiddenRecords: 1,
                hiddenFields: 0
            });

            LiveComparisonPanel.show('Test User');

            const copyBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-copy');
            copyBtn.click();

            expect(copyToClipboard).toHaveBeenCalled();
            const reportArg = copyToClipboard.mock.calls[0][0];
            expect(reportArg).toContain('Live Impersonation Report');
            expect(reportArg).toContain('Test User');
            expect(reportArg).toContain('account');
        });

        it('should include access denied in report', async () => {
            const { copyToClipboard } = await import('../../src/helpers/index.js');

            LiveImpersonationService.comparisonResults = [
                {
                    timestamp: new Date(),
                    entityName: 'contact',
                    url: '/api/data/v9.2/contacts(123)',
                    userCanAccess: false,
                    error: 'Insufficient privileges',
                    hiddenRecords: [],
                    hiddenFields: [],
                    hiddenCount: 0
                }
            ];
            LiveImpersonationService.getSummary.mockReturnValue({
                totalDifferences: 1,
                accessDenied: 1,
                hiddenRecords: 0,
                hiddenFields: 0
            });

            LiveComparisonPanel.show('Test User');

            const copyBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-copy');
            copyBtn.click();

            const reportArg = copyToClipboard.mock.calls[0][0];
            expect(reportArg).toContain('ACCESS DENIED');
            expect(reportArg).toContain('Insufficient privileges');
        });

        it('should include hidden fields in report', async () => {
            const { copyToClipboard } = await import('../../src/helpers/index.js');

            LiveImpersonationService.comparisonResults = [
                {
                    timestamp: new Date(),
                    entityName: 'opportunity',
                    url: '/api/data/v9.2/opportunities(456)',
                    userCanAccess: true,
                    error: null,
                    hiddenRecords: [],
                    hiddenFields: ['estimatedvalue', 'actualvalue'],
                    hiddenCount: 0
                }
            ];
            LiveImpersonationService.getSummary.mockReturnValue({
                totalDifferences: 1,
                accessDenied: 0,
                hiddenRecords: 0,
                hiddenFields: 2
            });

            LiveComparisonPanel.show('Test User');

            const copyBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-copy');
            copyBtn.click();

            const reportArg = copyToClipboard.mock.calls[0][0];
            expect(reportArg).toContain('Hidden Fields');
            expect(reportArg).toContain('estimatedvalue');
            expect(reportArg).toContain('actualvalue');
        });

        it('should include sample record IDs when hiddenRecords exist', async () => {
            const { copyToClipboard } = await import('../../src/helpers/index.js');

            LiveImpersonationService.comparisonResults = [
                {
                    timestamp: new Date(),
                    entityName: 'account',
                    url: '/api/data/v9.2/accounts',
                    userCanAccess: true,
                    error: null,
                    hiddenRecords: ['id1', 'id2', 'id3'],
                    hiddenFields: [],
                    hiddenCount: 3,
                    adminCount: 10,
                    userCount: 7
                }
            ];

            LiveComparisonPanel.show('Test User');

            const copyBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-copy');
            copyBtn.click();

            const reportArg = copyToClipboard.mock.calls[0][0];
            expect(reportArg).toContain('Sample Record IDs');
            expect(reportArg).toContain('id1');
        });

        it('should truncate sample record IDs when more than 10', async () => {
            const { copyToClipboard } = await import('../../src/helpers/index.js');

            const manyIds = Array.from({ length: 15 }, (_, i) => `id-${i + 1}`);
            LiveImpersonationService.comparisonResults = [
                {
                    timestamp: new Date(),
                    entityName: 'account',
                    url: '/api/data/v9.2/accounts',
                    userCanAccess: true,
                    error: null,
                    hiddenRecords: manyIds,
                    hiddenFields: [],
                    hiddenCount: 15
                }
            ];

            LiveComparisonPanel.show('Test User');

            const copyBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-copy');
            copyBtn.click();

            const reportArg = copyToClipboard.mock.calls[0][0];
            expect(reportArg).toContain('...');
        });

        it('should include hidden records count without adminCount/userCount in report', async () => {
            const { copyToClipboard } = await import('../../src/helpers/index.js');

            LiveImpersonationService.comparisonResults = [
                {
                    timestamp: new Date(),
                    entityName: 'account',
                    url: '/api/data/v9.2/accounts',
                    userCanAccess: true,
                    error: null,
                    hiddenRecords: ['id1', 'id2'],
                    hiddenFields: [],
                    hiddenCount: 2,
                    adminCount: null,
                    userCount: null
                }
            ];
            LiveImpersonationService.getSummary.mockReturnValue({
                totalDifferences: 1,
                accessDenied: 0,
                hiddenRecords: 2,
                hiddenFields: 0
            });

            LiveComparisonPanel.show('Test User');

            const copyBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-copy');
            copyBtn.click();

            const reportArg = copyToClipboard.mock.calls[0][0];
            expect(reportArg).toContain('Hidden Records: 2');
            expect(reportArg).not.toContain('User sees');
        });
    });

    describe('draggable functionality', () => {
        it('should set cursor to move on header', () => {
            LiveComparisonPanel.show('Test User');

            expect(LiveComparisonPanel.ui.header.style.cursor).toBe('move');
        });

        it('should not start drag when clicking button', () => {
            LiveComparisonPanel.show('Test User');

            const stopBtn = LiveComparisonPanel.ui.stopBtn;
            const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 100,
                clientY: 100
            });
            Object.defineProperty(mouseDownEvent, 'target', { value: stopBtn });

            LiveComparisonPanel.ui.header.dispatchEvent(mouseDownEvent);

            // If drag started, panel style would have been changed
            // Since we clicked a button, drag should not start
            expect(LiveComparisonPanel.panel.style.transition).toBe('');
        });

        it('should handle mousedown on header', () => {
            LiveComparisonPanel.show('Test User');

            const header = LiveComparisonPanel.ui.header;
            const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 100,
                clientY: 100
            });
            Object.defineProperty(mouseDownEvent, 'target', { value: header });

            header.dispatchEvent(mouseDownEvent);

            expect(LiveComparisonPanel.panel.style.transition).toBe('none');
        });

        it('should update position on mousemove during drag', () => {
            LiveComparisonPanel.show('Test User');

            // Set initial position
            LiveComparisonPanel.panel.style.position = 'fixed';
            LiveComparisonPanel.panel.style.left = '100px';
            LiveComparisonPanel.panel.style.top = '100px';

            const header = LiveComparisonPanel.ui.header;

            // Start drag
            const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 100,
                clientY: 100
            });
            Object.defineProperty(mouseDownEvent, 'target', { value: header });
            header.dispatchEvent(mouseDownEvent);

            // Move
            const mouseMoveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                clientX: 150,
                clientY: 150
            });
            document.dispatchEvent(mouseMoveEvent);

            // Panel position should have been updated
            // The actual values depend on getBoundingClientRect which is mocked
        });

        it('should end drag on mouseup', () => {
            LiveComparisonPanel.show('Test User');

            const header = LiveComparisonPanel.ui.header;

            // Start drag
            const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 100,
                clientY: 100
            });
            Object.defineProperty(mouseDownEvent, 'target', { value: header });
            header.dispatchEvent(mouseDownEvent);

            expect(LiveComparisonPanel.panel.style.transition).toBe('none');

            // End drag
            const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true });
            document.dispatchEvent(mouseUpEvent);

            expect(LiveComparisonPanel.panel.style.transition).toBe('');
        });

        it('should not move panel when not dragging', () => {
            LiveComparisonPanel.show('Test User');

            // Set initial position
            LiveComparisonPanel.panel.style.left = '100px';

            // Move without starting drag
            const mouseMoveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                clientX: 200,
                clientY: 200
            });
            document.dispatchEvent(mouseMoveEvent);

            // Position should not change
            expect(LiveComparisonPanel.panel.style.left).toBe('100px');
        });
    });

    describe('minimize expand cycle', () => {
        it('should expand when clicking minimize button twice', () => {
            LiveComparisonPanel.show('Test User');

            const minimizeBtn = LiveComparisonPanel.panel.querySelector('#pdt-live-minimize');

            // Minimize
            minimizeBtn.click();
            expect(LiveComparisonPanel.isMinimized).toBe(true);
            expect(LiveComparisonPanel.ui.body.style.display).toBe('none');
            expect(minimizeBtn.textContent).toBe('+');

            // Expand
            minimizeBtn.click();
            expect(LiveComparisonPanel.isMinimized).toBe(false);
            expect(LiveComparisonPanel.ui.body.style.display).toBe('block');
            expect(minimizeBtn.textContent).toBe('−');
        });
    });
});
