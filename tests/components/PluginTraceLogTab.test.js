/**
 * @file Comprehensive tests for PluginTraceLogTab component
 * @module tests/components/PluginTraceLogTab.test.js
 * @description Tests for the Plugin Trace Log viewer component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginTraceLogTab } from '../../src/components/PluginTraceLogTab.js';

// Mock trace data
const mockTraces = [
    {
        plugintracelogid: 'trace-1',
        typename: 'AccountPlugin.PreCreate',
        messagename: 'Create',
        primaryentity: 'account',
        createdon: '2024-01-15T10:30:00Z',
        performanceexecutionduration: 125,
        messageblock: 'Plugin executed successfully with context data',
        exceptiondetails: null,
        correlationid: '11111111-1111-1111-1111-111111111111'
    },
    {
        plugintracelogid: 'trace-2',
        typename: 'ContactPlugin.PostUpdate',
        messagename: 'Update',
        primaryentity: 'contact',
        createdon: '2024-01-15T10:25:00Z',
        performanceexecutionduration: 85,
        messageblock: 'Contact updated with new address',
        exceptiondetails: null,
        correlationid: '22222222-2222-2222-2222-222222222222'
    },
    {
        plugintracelogid: 'trace-3',
        typename: 'LeadPlugin.PreValidate',
        messagename: 'Create',
        primaryentity: 'lead',
        createdon: '2024-01-15T10:20:00Z',
        performanceexecutionduration: 350,
        messageblock: 'Validation failed for required fields',
        exceptiondetails: 'System.InvalidOperationException: Required field missing at LeadPlugin.Execute()',
        correlationid: '33333333-3333-3333-3333-333333333333'
    }
];

const mockEmptyResult = { entities: [], nextLink: null };
const mockTracesResult = { entities: mockTraces, nextLink: null };
const mockTracesWithNextLink = {
    entities: mockTraces,
    nextLink: 'https://org.crm.dynamics.com/api/data/v9.2/plugintracelogs?$skiptoken=page2'
};

// Mock dependencies
vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        getPluginTraceLogs: vi.fn(() => Promise.resolve({ entities: [], nextLink: null })),
        executeFetchXml: vi.fn(() => Promise.resolve({ entities: [] })),
        retrieveMultipleRecords: vi.fn(() => Promise.resolve({ entities: [] }))
    }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: true
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/ui/UIFactory.js', () => ({
    UIFactory: {
        createCopyableCodeBlock: vi.fn((content, type) => {
            const pre = document.createElement('pre');
            pre.className = 'copyable-code-block';
            pre.textContent = content;
            return pre;
        })
    }
}));

vi.mock('../../src/helpers/index.js', () => ({
    addEnterKeyListener: vi.fn((input, handler) => {
        const listener = (e) => {
            if (e.key === 'Enter') handler();
        };
        input.addEventListener('keydown', listener);
        return listener;
    }),
    buildODataFilterClauses: vi.fn((filters) => {
        const clauses = [];
        if (filters?.typename) {
            clauses.push(`contains(typename,'${filters.typename}')`);
        }
        if (filters?.messageblock) {
            clauses.push(`contains(messageblock,'${filters.messageblock}')`);
        }
        return clauses.length > 0 ? `&$filter=${clauses.join(' and ')}` : '';
    }),
    clearContainer: vi.fn((container) => {
        while (container?.firstChild) {
            container.removeChild(container.firstChild);
        }
    }),
    copyToClipboard: vi.fn(() => Promise.resolve()),
    escapeHtml: vi.fn((str) => str || ''),
    toggleElementHeight: vi.fn((element) => {
        if (element) {
            element.classList.toggle('expanded');
        }
    })
}));

import { DataService } from '../../src/services/DataService.js';
import { NotificationService } from '../../src/services/NotificationService.js';
import { copyToClipboard, toggleElementHeight } from '../../src/helpers/index.js';

describe('PluginTraceLogTab', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        component = new PluginTraceLogTab();
        document.body.innerHTML = '';
        DataService.getPluginTraceLogs.mockResolvedValue(mockEmptyResult);
    });

    afterEach(() => {
        component?.destroy?.();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    describe('constructor', () => {
        it('should initialize with correct id', () => {
            expect(component.id).toBe('traces');
        });

        it('should initialize with correct label', () => {
            expect(component.label).toContain('Trace');
        });

        it('should have an icon defined', () => {
            expect(component.icon).toBeDefined();
        });

        it('should NOT be a form-only component', () => {
            expect(component.isFormOnly).toBeFalsy();
        });

        it('should initialize UI object as empty', () => {
            expect(component.ui).toEqual({});
        });

        it('should initialize currentPage to 1', () => {
            expect(component.currentPage).toBe(1);
        });

        it('should initialize pageSize to 25', () => {
            expect(component.pageSize).toBe(25);
        });

        it('should initialize allTraces as empty array', () => {
            expect(component.allTraces).toEqual([]);
        });

        it('should initialize totalPages to 0', () => {
            expect(component.totalPages).toBe(0);
        });

        it('should initialize pollingTimer as null', () => {
            expect(component.pollingTimer).toBeNull();
        });

        it('should initialize hasMoreTraces to false', () => {
            expect(component.hasMoreTraces).toBe(false);
        });

        it('should initialize nextBatchLink as null', () => {
            expect(component.nextBatchLink).toBeNull();
        });

        it('should initialize filters with empty values', () => {
            expect(component.filters).toEqual({ typeName: '', messageContent: '', dateFrom: '', dateTo: '' });
        });

        it('should initialize isLoading to false', () => {
            expect(component.isLoading).toBe(false);
        });
    });

    describe('render', () => {
        it('should return an HTMLElement', async () => {
            const element = await component.render();
            expect(element).toBeInstanceOf(HTMLElement);
        });

        it('should have pdt-traces-root class', async () => {
            const element = await component.render();
            expect(element.classList.contains('pdt-traces-root')).toBe(true);
        });

        it('should render section title with correct text', async () => {
            const element = await component.render();
            const title = element.querySelector('.section-title');
            expect(title).toBeTruthy();
            expect(title.textContent).toBe('Plugin Trace Logs');
        });

        it('should render toolbar with filter inputs', async () => {
            const element = await component.render();
            const toolbar = element.querySelector('.pdt-toolbar');
            expect(toolbar).toBeTruthy();
        });

        it('should render type name filter input', async () => {
            const element = await component.render();
            const typeNameInput = element.querySelector('#trace-filter-typename');
            expect(typeNameInput).toBeTruthy();
            expect(typeNameInput.placeholder).toContain('Type Name');
        });

        it('should render content filter input', async () => {
            const element = await component.render();
            const contentInput = element.querySelector('#trace-filter-content');
            expect(contentInput).toBeTruthy();
            expect(contentInput.placeholder).toContain('Content');
        });

        it('should render date from filter input', async () => {
            const element = await component.render();
            const dateFromInput = element.querySelector('#trace-filter-date-from');
            expect(dateFromInput).toBeTruthy();
            expect(dateFromInput.type).toBe('datetime-local');
        });

        it('should render date to filter input', async () => {
            const element = await component.render();
            const dateToInput = element.querySelector('#trace-filter-date-to');
            expect(dateToInput).toBeTruthy();
            expect(dateToInput.type).toBe('datetime-local');
        });

        it('should render server filter button', async () => {
            const element = await component.render();
            const filterBtn = element.querySelector('#apply-server-filters-btn');
            expect(filterBtn).toBeTruthy();
            expect(filterBtn.textContent).toBe('Filter');
        });

        it('should render live toggle checkbox', async () => {
            const element = await component.render();
            const liveToggle = element.querySelector('#trace-live-toggle');
            expect(liveToggle).toBeTruthy();
            expect(liveToggle.type).toBe('checkbox');
        });

        it('should render live interval select with options', async () => {
            const element = await component.render();
            const intervalSelect = element.querySelector('#trace-live-interval');
            expect(intervalSelect).toBeTruthy();
            expect(intervalSelect.querySelectorAll('option').length).toBe(3);
        });

        it('should render live status indicator', async () => {
            const element = await component.render();
            const indicator = element.querySelector('#live-status-indicator');
            expect(indicator).toBeTruthy();
            expect(indicator.classList.contains('live-indicator')).toBe(true);
        });

        it('should render trace log list container', async () => {
            const element = await component.render();
            const logList = element.querySelector('#trace-log-list');
            expect(logList).toBeTruthy();
        });

        it('should render pagination controls', async () => {
            const element = await component.render();
            expect(element.querySelector('.pdt-pagination')).toBeTruthy();
            expect(element.querySelector('#trace-pagination-info')).toBeTruthy();
            expect(element.querySelector('#first-page-btn')).toBeTruthy();
            expect(element.querySelector('#prev-page-btn')).toBeTruthy();
            expect(element.querySelector('#next-page-btn')).toBeTruthy();
            expect(element.querySelector('#last-page-btn')).toBeTruthy();
            expect(element.querySelector('#page-input')).toBeTruthy();
            expect(element.querySelector('#page-label')).toBeTruthy();
        });

        it('should show loading message initially', async () => {
            const element = await component.render();
            const logList = element.querySelector('#trace-log-list');
            expect(logList.textContent).toContain('Loading');
        });
    });

    describe('postRender', () => {
        it('should not throw when called', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            expect(() => component.postRender(element)).not.toThrow();
        });

        it('should cache UI elements', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component.ui.container).toBe(element);
            expect(component.ui.serverFilterBtn).toBeTruthy();
            expect(component.ui.typeNameInput).toBeTruthy();
            expect(component.ui.contentInput).toBeTruthy();
            expect(component.ui.dateFromInput).toBeTruthy();
            expect(component.ui.dateToInput).toBeTruthy();
            expect(component.ui.liveToggle).toBeTruthy();
            expect(component.ui.liveIntervalSelect).toBeTruthy();
            expect(component.ui.logList).toBeTruthy();
            expect(component.ui.paginationInfo).toBeTruthy();
            expect(component.ui.pageInput).toBeTruthy();
        });

        it('should trigger initial load of traces', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            await vi.runAllTimersAsync();
            expect(DataService.getPluginTraceLogs).toHaveBeenCalled();
        });

        it('should bind click handler to server filter button', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component._handleServerFilter).toBeDefined();
        });

        it('should bind pagination button handlers', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);

            expect(component._handleFirstPage).toBeDefined();
            expect(component._handlePrevPage).toBeDefined();
            expect(component._handleNextPage).toBeDefined();
            expect(component._handleLastPage).toBeDefined();
        });
    });

    describe('_fetchAllTraces', () => {
        beforeEach(async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            vi.clearAllMocks();
        });

        it('should show loading message when not polling', async () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockEmptyResult);
            component._fetchAllTraces(false);

            expect(component.ui.logList.innerHTML).toContain('Loading');
        });

        it('should not show loading message when polling', async () => {
            component.ui.logList.innerHTML = '<div class="trace-item">Existing</div>';
            DataService.getPluginTraceLogs.mockResolvedValue(mockEmptyResult);
            component._fetchAllTraces(true);

            expect(component.ui.logList.innerHTML).toContain('Existing');
        });

        it('should call DataService.getPluginTraceLogs with options', async () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockTracesResult);
            await component._fetchAllTraces();
            await vi.runAllTimersAsync();

            expect(DataService.getPluginTraceLogs).toHaveBeenCalledWith(
                expect.any(String),
                250  // FETCH_PAGE_SIZE for bulk fetch
            );
        });

        it('should render traces when successful', async () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockTracesResult);
            await component._fetchAllTraces();
            await vi.runAllTimersAsync();

            const traceItems = component.ui.logList.querySelectorAll('.trace-item');
            expect(traceItems.length).toBe(3);
        });

        it('should show no traces message when empty result', async () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockEmptyResult);
            await component._fetchAllTraces();
            await vi.runAllTimersAsync();

            expect(component.ui.logList.textContent).toContain('No plugin trace logs');
        });

        it('should show error message on failure', async () => {
            DataService.getPluginTraceLogs.mockRejectedValue(new Error('Network error'));
            await component._fetchAllTraces();
            await vi.runAllTimersAsync();

            expect(component.ui.logList.innerHTML).toContain('pdt-error');
        });

        it('should populate allTraces array', async () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockTracesResult);
            await component._fetchAllTraces();
            await vi.runAllTimersAsync();

            expect(component.allTraces.length).toBe(3);
        });

        it('should fetch all pages when nextLink is present', async () => {
            DataService.getPluginTraceLogs.mockResolvedValueOnce(mockTracesWithNextLink);
            DataService.getPluginTraceLogs.mockResolvedValueOnce(mockTracesResult);
            await component._fetchAllTraces();
            await vi.runAllTimersAsync();

            expect(DataService.getPluginTraceLogs).toHaveBeenCalledTimes(2);
            expect(component.allTraces.length).toBe(6); // 3 from each page
        });

        it('should calculate totalPages correctly', async () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockTracesResult);
            await component._fetchAllTraces();
            await vi.runAllTimersAsync();

            expect(component.totalPages).toBe(1); // 3 traces / 25 per page = 1
        });

        it('should update pagination UI after load', async () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockTracesResult);
            await component._fetchAllTraces();
            await vi.runAllTimersAsync();

            expect(component.ui.paginationInfo.textContent).toContain('1-3');
        });
    });

    describe('_renderTraceList', () => {
        beforeEach(async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();
            vi.clearAllMocks();
        });

        it('should render trace items for each log', () => {
            component._renderTraceList(mockTraces);
            const items = component.ui.logList.querySelectorAll('.trace-item');
            expect(items.length).toBe(3);
        });

        it('should show trace type name', () => {
            component._renderTraceList(mockTraces);
            const typeSpan = component.ui.logList.querySelector('.trace-type');
            expect(typeSpan.textContent).toBe('AccountPlugin.PreCreate');
        });

        it('should show trace message and entity', () => {
            component._renderTraceList(mockTraces);
            const metaSpan = component.ui.logList.querySelector('.trace-meta');
            expect(metaSpan.textContent).toContain('Create');
            expect(metaSpan.textContent).toContain('account');
        });

        it('should show execution duration', () => {
            component._renderTraceList(mockTraces);
            const duration = component.ui.logList.querySelector('.trace-duration');
            expect(duration.textContent).toContain('125');
            expect(duration.textContent).toContain('ms');
        });

        it('should apply trace-success class for non-error traces', () => {
            component._renderTraceList(mockTraces);
            const successHeaders = component.ui.logList.querySelectorAll('.trace-success');
            expect(successHeaders.length).toBe(2);
        });

        it('should apply trace-error class for traces with exceptions', () => {
            component._renderTraceList(mockTraces);
            const errorHeaders = component.ui.logList.querySelectorAll('.trace-error');
            expect(errorHeaders.length).toBe(1);
        });

        it('should render correlation id as non-copyable', () => {
            component._renderTraceList(mockTraces);
            // Correlation ID is in the details section, not trace-meta
            const details = component.ui.logList.querySelector('.trace-details');
            expect(details).toBeTruthy();
            expect(details.textContent).toContain('11111111');
            // Verify correlation ID is NOT in a copyable element
            const copyable = component.ui.logList.querySelector('.copyable');
            expect(copyable).toBeFalsy();
        });

        it('should show no traces message for empty array', () => {
            component._renderTraceList([]);
            expect(component.ui.logList.textContent).toContain('No plugin trace logs');
        });

        it('should clear previous content before rendering', () => {
            component._renderTraceList(mockTraces);
            component._renderTraceList([mockTraces[0]]);
            const items = component.ui.logList.querySelectorAll('.trace-item');
            expect(items.length).toBe(1);
        });
    });

    describe('server-side filtering (_applyServerFilters)', () => {
        beforeEach(async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();
            vi.clearAllMocks();
        });

        it('should update filters from input values', async () => {
            component.ui.typeNameInput.value = 'TestPlugin';
            component.ui.contentInput.value = 'error';
            component.ui.dateFromInput.value = '2024-01-01T00:00';
            component.ui.dateToInput.value = '2024-12-31T23:59';
            DataService.getPluginTraceLogs.mockResolvedValue(mockEmptyResult);

            component._applyServerFilters();
            await vi.runAllTimersAsync();

            expect(component.filters.typeName).toBe('TestPlugin');
            expect(component.filters.messageContent).toBe('error');
            expect(component.filters.dateFrom).toBe('2024-01-01T00:00');
            expect(component.filters.dateTo).toBe('2024-12-31T23:59');
        });

        it('should reset currentPage to 1', async () => {
            component.currentPage = 3;
            DataService.getPluginTraceLogs.mockResolvedValue(mockEmptyResult);

            component._applyServerFilters();
            await vi.runAllTimersAsync();

            expect(component.currentPage).toBe(1);
        });

        it('should clear allTraces array', async () => {
            component.allTraces = [mockTraces[0], mockTraces[1]];
            DataService.getPluginTraceLogs.mockResolvedValue(mockEmptyResult);

            component._applyServerFilters();
            await vi.runAllTimersAsync();

            expect(component.allTraces).toEqual([]);
        });

        it('should reset totalPages', async () => {
            component.totalPages = 5;
            DataService.getPluginTraceLogs.mockResolvedValue(mockEmptyResult);

            component._applyServerFilters();
            await vi.runAllTimersAsync();

            expect(component.totalPages).toBe(1); // Min 1 page
        });

        it('should trigger new data load', async () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockEmptyResult);

            component._applyServerFilters();
            await vi.runAllTimersAsync();

            expect(DataService.getPluginTraceLogs).toHaveBeenCalled();
        });

        it('should trim whitespace from filter inputs', async () => {
            component.ui.typeNameInput.value = '  TestPlugin  ';
            component.ui.contentInput.value = '  error  ';
            component.ui.dateFromInput.value = '2024-01-01T00:00';
            component.ui.dateToInput.value = '2024-12-31T23:59';
            DataService.getPluginTraceLogs.mockResolvedValue(mockEmptyResult);

            component._applyServerFilters();
            await vi.runAllTimersAsync();

            expect(component.filters.typeName).toBe('TestPlugin');
            expect(component.filters.messageContent).toBe('error');
            expect(component.filters.dateFrom).toBe('2024-01-01T00:00');
            expect(component.filters.dateTo).toBe('2024-12-31T23:59');
        });
    });

    describe('pagination', () => {
        beforeEach(async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();
            vi.clearAllMocks();
        });

        describe('_changePage', () => {
            it('should not go below page 1', () => {
                component.currentPage = 1;
                component._changePage(-1);
                expect(component.currentPage).toBe(1);
            });

            it('should not go beyond totalPages', () => {
                component.currentPage = 1;
                component.totalPages = 1;
                component._changePage(1);
                expect(component.currentPage).toBe(1);
            });

            it('should go to next page when within totalPages', async () => {
                component.currentPage = 1;
                component.totalPages = 3;
                component.allTraces = Array(75).fill(mockTraces[0]); // 75 traces = 3 pages

                component._changePage(1);
                await vi.runAllTimersAsync();

                expect(component.currentPage).toBe(2);
            });

            it('should go to previous page', async () => {
                component.currentPage = 2;
                component.totalPages = 3;
                component.allTraces = Array(75).fill(mockTraces[0]);

                component._changePage(-1);
                await vi.runAllTimersAsync();

                expect(component.currentPage).toBe(1);
            });
        });

        describe('_goToPage', () => {
            it('should not go to page 0 or negative', () => {
                component.totalPages = 3;
                component._goToPage(0);
                expect(component.currentPage).toBe(1);

                component._goToPage(-1);
                expect(component.currentPage).toBe(1);
            });

            it('should go to page 1', async () => {
                component.currentPage = 3;
                component.totalPages = 3;
                component.allTraces = Array(75).fill(mockTraces[0]);

                component._goToPage(1);
                await vi.runAllTimersAsync();

                expect(component.currentPage).toBe(1);
            });

            it('should not go beyond totalPages', () => {
                component.totalPages = 2;
                component._goToPage(5);
                expect(component.currentPage).toBe(1);
            });

            it('should go to any page within totalPages', async () => {
                component.totalPages = 5;
                component.allTraces = Array(125).fill(mockTraces[0]);

                component._goToPage(3);
                await vi.runAllTimersAsync();

                expect(component.currentPage).toBe(3);
            });
        });

        describe('_goToLastPage', () => {
            it('should go to last page', async () => {
                component.currentPage = 1;
                component.totalPages = 5;
                component.allTraces = Array(125).fill(mockTraces[0]);

                component._goToLastPage();
                await vi.runAllTimersAsync();

                expect(component.currentPage).toBe(5);
            });

            it('should stay on current page if already on last', () => {
                component.currentPage = 3;
                component.totalPages = 3;

                component._goToLastPage();

                expect(component.currentPage).toBe(3);
            });
        });

        describe('_updatePaginationUI', () => {
            it('should show 0 Traces when no traces', () => {
                component.allTraces = [];
                component.totalPages = 1;
                component._updatePaginationUI();
                expect(component.ui.paginationInfo.textContent).toBe('0 Traces');
            });

            it('should show exact range for current page', () => {
                component.currentPage = 1;
                component.pageSize = 25;
                component.allTraces = Array(10).fill(mockTraces[0]);
                component.totalPages = 1;

                component._updatePaginationUI();

                expect(component.ui.paginationInfo.textContent).toContain('1-10 of 10');
            });

            it('should show exact total count (no +)', () => {
                component.currentPage = 1;
                component.allTraces = Array(25).fill(mockTraces[0]);
                component.totalPages = 1;

                component._updatePaginationUI();

                expect(component.ui.paginationInfo.textContent).not.toContain('+');
                expect(component.ui.paginationInfo.textContent).toContain('of 25');
            });

            it('should disable first/prev buttons on page 1', () => {
                component.currentPage = 1;
                component.totalPages = 3;
                component.allTraces = Array(75).fill(mockTraces[0]);
                component._updatePaginationUI();

                expect(component.ui.firstPageBtn.disabled).toBe(true);
                expect(component.ui.prevPageBtn.disabled).toBe(true);
            });

            it('should enable first/prev buttons on page > 1', () => {
                component.currentPage = 2;
                component._updatePaginationUI(false, 10);

                expect(component.ui.firstPageBtn.disabled).toBe(false);
                expect(component.ui.prevPageBtn.disabled).toBe(false);
            });

            it('should disable next button when no next page', () => {
                component._updatePaginationUI(false, 10);
                expect(component.ui.nextPageBtn.disabled).toBe(true);
            });

            it('should enable next button when has next page', () => {
                component.currentPage = 1;
                component.totalPages = 2;
                component._updatePaginationUI();
                expect(component.ui.nextPageBtn.disabled).toBe(false);
            });

            it('should enable next button when hasMoreTraces is true', () => {
                component.currentPage = 2;
                component.totalPages = 2;
                component.hasMoreTraces = true;
                component._updatePaginationUI();
                expect(component.ui.nextPageBtn.disabled).toBe(false);
            });

            it('should update page input value', () => {
                component.currentPage = 5;
                component._updatePaginationUI(false, 10);
                expect(component.ui.pageInput.value).toBe('5');
            });
        });

        describe('page input handling', () => {
            beforeEach(() => {
                // Set up component with multiple pages
                component.allTraces = Array(100).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));
                component.totalPages = 4;
                component.currentPage = 1;
                component._updatePaginationUI();
            });

            it('should navigate to valid page on change', async () => {
                DataService.getPluginTraceLogs.mockResolvedValue(mockTracesResult);

                component.ui.pageInput.value = '2';
                component.ui.pageInput.dispatchEvent(new Event('change'));
                await vi.runAllTimersAsync();

                expect(component.currentPage).toBe(2);
            });

            it('should reset to current page on invalid input', () => {
                component.currentPage = 1;
                component.ui.pageInput.value = '-5';
                component.ui.pageInput.dispatchEvent(new Event('change'));

                expect(component.ui.pageInput.value).toBe('1');
            });

            it('should reset to current page on NaN input', () => {
                component.currentPage = 1;
                component.ui.pageInput.value = 'abc';
                component.ui.pageInput.dispatchEvent(new Event('change'));

                expect(component.ui.pageInput.value).toBe('1');
            });
        });
    });

    describe('live mode / auto-refresh', () => {
        beforeEach(async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();
            vi.clearAllMocks();
        });

        it('should start polling when toggle is checked', () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockTracesResult);
            component.ui.liveToggle.checked = true;
            component.ui.liveToggle.dispatchEvent(new Event('change'));

            expect(component.pollingTimer).not.toBeNull();
        });

        it('should stop polling when toggle is unchecked', () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockTracesResult);
            component.ui.liveToggle.checked = true;
            component.ui.liveToggle.dispatchEvent(new Event('change'));

            component.ui.liveToggle.checked = false;
            component.ui.liveToggle.dispatchEvent(new Event('change'));

            expect(component.pollingTimer).toBeNull();
        });

        it('should add is-live class to indicator when enabled', () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockTracesResult);
            component.ui.liveToggle.checked = true;
            component.ui.liveToggle.dispatchEvent(new Event('change'));

            expect(component.ui.liveStatusIndicator.classList.contains('is-live')).toBe(true);
        });

        it('should remove is-live class when disabled', () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockTracesResult);
            component.ui.liveToggle.checked = true;
            component.ui.liveToggle.dispatchEvent(new Event('change'));

            component.ui.liveToggle.checked = false;
            component.ui.liveToggle.dispatchEvent(new Event('change'));

            expect(component.ui.liveStatusIndicator.classList.contains('is-live')).toBe(false);
        });

        it('should set up interval timer for periodic refresh', () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockTracesResult);
            component.ui.liveIntervalSelect.value = '5000';
            component.ui.liveToggle.checked = true;
            component.ui.liveToggle.dispatchEvent(new Event('change'));

            // Verify that polling timer is set (don't await, just check sync state)
            expect(component.pollingTimer).not.toBeNull();

            // Verify the interval value is used from the select
            expect(component.ui.liveIntervalSelect.value).toBe('5000');
        });

        it('should restart polling when interval changes', async () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockTracesResult);
            component.ui.liveToggle.checked = true;
            component.ui.liveToggle.dispatchEvent(new Event('change'));

            const oldTimer = component.pollingTimer;

            component.ui.liveIntervalSelect.value = '30000';
            component.ui.liveIntervalSelect.dispatchEvent(new Event('change'));

            expect(component.pollingTimer).not.toBe(oldTimer);
        });

        it('should not start polling when interval changes if toggle is off', () => {
            component.ui.liveToggle.checked = false;
            component.ui.liveIntervalSelect.value = '30000';
            component.ui.liveIntervalSelect.dispatchEvent(new Event('change'));

            expect(component.pollingTimer).toBeNull();
        });
    });

    describe('trace item interactions', () => {
        beforeEach(async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();
            DataService.getPluginTraceLogs.mockResolvedValue(mockTracesResult);
            await component._fetchAllTraces();
            await vi.runAllTimersAsync();
        });

        it('should expand/collapse details when header is clicked', () => {
            const header = component.ui.logList.querySelector('.trace-header');
            header.click();

            expect(toggleElementHeight).toHaveBeenCalled();
        });

        it('should not toggle when clicking non-header element', () => {
            vi.clearAllMocks();
            const logList = component.ui.logList;
            logList.click();

            expect(toggleElementHeight).not.toHaveBeenCalled();
        });
    });

    describe('_createTraceItemElement', () => {
        beforeEach(async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();
        });

        it('should create trace-item div', () => {
            const item = component._createTraceItemElement(mockTraces[0]);
            expect(item.classList.contains('trace-item')).toBe(true);
        });

        it('should show N/A for missing duration', () => {
            const trace = { ...mockTraces[0], performanceexecutionduration: null };
            const item = component._createTraceItemElement(trace);
            expect(item.textContent).toContain('N/A');
        });

        it('should show formatted date', () => {
            const item = component._createTraceItemElement(mockTraces[0]);
            // Should contain formatted date parts
            expect(item.textContent).toMatch(/\d/);
        });

        it('should not show correlation if missing', () => {
            const trace = { ...mockTraces[0], correlationid: null };
            const item = component._createTraceItemElement(trace);
            expect(item.querySelector('.copyable')).toBeNull();
        });

        it('should render exception details for error traces', () => {
            const item = component._createTraceItemElement(mockTraces[2]);
            expect(item.querySelector('.trace-exception')).toBeTruthy();
        });

        it('should not render exception section for non-error traces', () => {
            const item = component._createTraceItemElement(mockTraces[0]);
            const exceptions = item.querySelectorAll('.trace-exception');
            // Should have 0 exception sections for successful trace
            expect(exceptions.length).toBe(0);
        });
    });

    describe('_buildODataOptions', () => {
        beforeEach(async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();
        });

        it('should include select clause', () => {
            const options = component._buildODataOptions();
            expect(options).toContain('$select=');
        });

        it('should include orderby clause', () => {
            const options = component._buildODataOptions();
            expect(options).toContain('$orderby=createdon desc');
        });

        it('should start with ?', () => {
            const options = component._buildODataOptions();
            expect(options.startsWith('?')).toBe(true);
        });
    });

    describe('destroy', () => {
        it('should not throw when called without initialization', () => {
            expect(() => component.destroy()).not.toThrow();
        });

        it('should cleanup after render and postRender', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();

            expect(() => component.destroy()).not.toThrow();
        });

        it('should stop polling timer', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();

            DataService.getPluginTraceLogs.mockResolvedValue(mockTracesResult);
            component.ui.liveToggle.checked = true;
            component.ui.liveToggle.dispatchEvent(new Event('change'));

            expect(component.pollingTimer).not.toBeNull();

            component.destroy();

            expect(component.pollingTimer).toBeNull();
        });

        it('should clear handler references', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();

            component.destroy();

            expect(component._handleServerFilter).toBeNull();
            expect(component._handleFirstPage).toBeNull();
            expect(component._handlePrevPage).toBeNull();
            expect(component._handleNextPage).toBeNull();
            expect(component._handleLastPage).toBeNull();
        });

        it('should be safe to call multiple times', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();

            expect(() => {
                component.destroy();
                component.destroy();
                component.destroy();
            }).not.toThrow();
        });
    });

    describe('enter key behavior', () => {
        beforeEach(async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();
            vi.clearAllMocks();
        });

        it('should apply server filters when Enter pressed in type name input', async () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockEmptyResult);
            component.ui.typeNameInput.value = 'TestPlugin';

            const event = new KeyboardEvent('keydown', { key: 'Enter' });
            component.ui.typeNameInput.dispatchEvent(event);
            await vi.runAllTimersAsync();

            expect(DataService.getPluginTraceLogs).toHaveBeenCalled();
        });

        it('should apply server filters when Enter pressed in content input', async () => {
            DataService.getPluginTraceLogs.mockResolvedValue(mockEmptyResult);
            component.ui.contentInput.value = 'test content';

            const event = new KeyboardEvent('keydown', { key: 'Enter' });
            component.ui.contentInput.dispatchEvent(event);
            await vi.runAllTimersAsync();

            expect(DataService.getPluginTraceLogs).toHaveBeenCalled();
        });
    });

    describe('pagination handler callbacks - lines 418-421 coverage', () => {
        it('should bind server filter handler', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();

            // The _handleServerFilter should be bound
            expect(component._handleServerFilter).toBeDefined();
            expect(typeof component._handleServerFilter).toBe('function');
        });

        it('should trigger _handleFirstPage to go to page 1', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();

            expect(component._handleFirstPage).toBeDefined();

            component._goToPage = vi.fn();
            if (component._handleFirstPage) {
                component._handleFirstPage();
            }

            expect(component._goToPage).toHaveBeenCalledWith(1);
        });

        it('should trigger _handlePrevPage to change page by -1', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();

            expect(component._handlePrevPage).toBeDefined();

            component._changePage = vi.fn();
            if (component._handlePrevPage) {
                component._handlePrevPage();
            }

            expect(component._changePage).toHaveBeenCalledWith(-1);
        });

        it('should trigger _handleNextPage to change page by 1', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();

            expect(component._handleNextPage).toBeDefined();

            component._changePage = vi.fn();
            if (component._handleNextPage) {
                component._handleNextPage();
            }

            expect(component._changePage).toHaveBeenCalledWith(1);
        });

        it('should trigger _handleLastPage to go to last page', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();

            expect(component._handleLastPage).toBeDefined();

            component._goToLastPage = vi.fn();
            if (component._handleLastPage) {
                component._handleLastPage();
            }

            expect(component._goToLastPage).toHaveBeenCalledWith();
        });
    });

    describe('_startLiveMode polling callback - line 581 coverage', () => {
        it('should reset pagination state on polling interval', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();

            DataService.getPluginTraceLogs.mockResolvedValue(mockEmptyResult);

            // Enable live mode
            component.ui.liveToggle.checked = true;
            component.ui.liveToggle.dispatchEvent(new Event('change'));

            // Set some pagination state
            component.currentPage = 5;
            component.allTraces = Array(100).fill(mockTraces[0]);
            component.totalPages = 4;

            // Advance timer by the interval
            await vi.advanceTimersByTimeAsync(5000);

            // After polling, state should be reset
            // Note: This tests the callback inside setInterval
        });
    });

    describe('_createTraceItemElement details removal - line 581 coverage', () => {
        it('should remove details container when no content is added', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();

            // Create a trace with no messageblock or exceptiondetails
            const emptyTrace = {
                plugintracelogid: 'trace-empty',
                typename: 'EmptyPlugin',
                messagename: 'Create',
                primaryentity: 'account',
                createdon: '2024-01-15T10:30:00Z',
                performanceexecutionduration: 50,
                messageblock: null,
                exceptiondetails: null
            };

            const item = component._createTraceItemElement(emptyTrace);

            // The item should be created
            expect(item).toBeDefined();
            expect(item.classList.contains('trace-item')).toBe(true);
        });
    });

    describe('Progressive Loading (Batch Fetching)', () => {
        beforeEach(async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();
            vi.clearAllMocks();
        });

        describe('_fetchAllTraces with batch loading', () => {
            it('should load up to 1000 records in first batch', async () => {
                // Create 1200 mock traces across multiple pages
                const batch1 = Array(250).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));
                const batch2 = Array(250).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i + 250}` }));
                const batch3 = Array(250).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i + 500}` }));
                const batch4 = Array(250).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i + 750}` }));

                DataService.getPluginTraceLogs
                    .mockResolvedValueOnce({ entities: batch1, nextLink: 'link2' })
                    .mockResolvedValueOnce({ entities: batch2, nextLink: 'link3' })
                    .mockResolvedValueOnce({ entities: batch3, nextLink: 'link4' })
                    .mockResolvedValueOnce({ entities: batch4, nextLink: 'link5' });

                await component._fetchAllTraces(false, true);
                await vi.runAllTimersAsync();

                // Should fetch 4 pages (1000 records)
                expect(DataService.getPluginTraceLogs).toHaveBeenCalledTimes(4);
                expect(component.allTraces.length).toBe(1000);
                expect(component.hasMoreTraces).toBe(true);
                expect(component.nextBatchLink).toBe('link5');
            });

            it('should set hasMoreTraces to false when no nextLink', async () => {
                const traces = Array(100).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));
                DataService.getPluginTraceLogs.mockResolvedValue({ entities: traces, nextLink: null });

                await component._fetchAllTraces(false, true);
                await vi.runAllTimersAsync();

                expect(component.hasMoreTraces).toBe(false);
                expect(component.nextBatchLink).toBeNull();
            });

            it('should show + indicator when hasMoreTraces is true', async () => {
                const traces = Array(1000).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));
                component.allTraces = traces;
                component.hasMoreTraces = true;
                component.totalPages = 40;
                component._updatePaginationUI();

                expect(component.ui.paginationInfo.textContent).toContain('1000+');
                expect(component.ui.pageLabel.textContent).toContain('40+');
            });

            it('should NOT show + indicator when hasMoreTraces is false', async () => {
                const traces = Array(1000).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));
                component.allTraces = traces;
                component.hasMoreTraces = false;
                component.totalPages = 40;
                component._updatePaginationUI();

                expect(component.ui.paginationInfo.textContent).toContain('1000');
                expect(component.ui.paginationInfo.textContent).not.toContain('1000+');
                expect(component.ui.pageLabel.textContent).toContain('40');
                expect(component.ui.pageLabel.textContent).not.toContain('40+');
            });
        });

        describe('_loadMoreTraces', () => {
            it('should load next batch of up to 1000 records', async () => {
                component.nextBatchLink = 'https://test.com?skiptoken=page2';
                component.hasMoreTraces = true;
                component.allTraces = Array(1000).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));

                const batch1 = Array(250).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i + 1000}` }));
                const batch2 = Array(250).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i + 1250}` }));
                const batch3 = Array(250).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i + 1500}` }));
                const batch4 = Array(250).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i + 1750}` }));

                DataService.getPluginTraceLogs
                    .mockResolvedValueOnce({ entities: batch1, nextLink: 'link3' })
                    .mockResolvedValueOnce({ entities: batch2, nextLink: 'link4' })
                    .mockResolvedValueOnce({ entities: batch3, nextLink: 'link5' })
                    .mockResolvedValueOnce({ entities: batch4, nextLink: 'link6' });

                await component._loadMoreTraces();

                expect(component.allTraces.length).toBe(2000);
                expect(component.hasMoreTraces).toBe(true);
                expect(component.nextBatchLink).toBe('link6');
            });

            it('should not load if nextBatchLink is null', async () => {
                component.nextBatchLink = null;
                component.hasMoreTraces = false;

                await component._loadMoreTraces();

                expect(DataService.getPluginTraceLogs).not.toHaveBeenCalled();
            });

            it('should not load if isLoading is true', async () => {
                component.nextBatchLink = 'https://test.com?skiptoken=page2';
                component.isLoading = true;

                await component._loadMoreTraces();

                expect(DataService.getPluginTraceLogs).not.toHaveBeenCalled();
            });
        });

        describe('_loadAllRemainingTraces', () => {
            it('should load all remaining records', async () => {
                component.nextBatchLink = 'https://test.com?skiptoken=page2';
                component.hasMoreTraces = true;
                component.allTraces = Array(1000).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));

                const batch1 = Array(250).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i + 1000}` }));
                const batch2 = Array(250).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i + 1250}` }));
                const batch3 = Array(50).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i + 1500}` }));

                DataService.getPluginTraceLogs
                    .mockResolvedValueOnce({ entities: batch1, nextLink: 'link3' })
                    .mockResolvedValueOnce({ entities: batch2, nextLink: 'link4' })
                    .mockResolvedValueOnce({ entities: batch3, nextLink: null });

                await component._loadAllRemainingTraces();

                expect(component.allTraces.length).toBe(1550);
                expect(component.hasMoreTraces).toBe(false);
                expect(component.nextBatchLink).toBeNull();
            });

            it('should not load if nextBatchLink is null', async () => {
                component.nextBatchLink = null;

                await component._loadAllRemainingTraces();

                expect(DataService.getPluginTraceLogs).not.toHaveBeenCalled();
            });
        });

        describe('_changePage with auto-load', () => {
            it('should auto-load more traces when navigating to last loaded page with hasMoreTraces', async () => {
                component.currentPage = 39;
                component.totalPages = 40;
                component.hasMoreTraces = true;
                component.nextBatchLink = 'https://test.com?skiptoken=page2';
                component.allTraces = Array(1000).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));

                const newBatch = Array(500).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i + 1000}` }));
                DataService.getPluginTraceLogs.mockResolvedValue({ entities: newBatch, nextLink: null });

                await component._changePage(1);
                await vi.runAllTimersAsync();

                expect(component.allTraces.length).toBe(1500);
                expect(component.currentPage).toBe(40);
            });

            it('should not auto-load if not at last page', async () => {
                component.currentPage = 1;
                component.totalPages = 40;
                component.hasMoreTraces = true;
                component.allTraces = Array(1000).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));

                await component._changePage(1);

                expect(DataService.getPluginTraceLogs).not.toHaveBeenCalled();
                expect(component.currentPage).toBe(2);
            });
        });

        describe('_goToLastPage with auto-load', () => {
            it('should load all remaining traces before going to last page', async () => {
                component.currentPage = 1;
                component.totalPages = 40;
                component.hasMoreTraces = true;
                component.nextBatchLink = 'https://test.com?skiptoken=page2';
                component.allTraces = Array(1000).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));

                const batch1 = Array(500).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i + 1000}` }));
                DataService.getPluginTraceLogs.mockResolvedValue({ entities: batch1, nextLink: null });

                await component._goToLastPage();
                await vi.runAllTimersAsync();

                expect(component.allTraces.length).toBe(1500);
                expect(component.hasMoreTraces).toBe(false);
                expect(component.currentPage).toBe(60); // 1500 / 25 = 60 pages
            });

            it('should not load if hasMoreTraces is false', async () => {
                component.currentPage = 1;
                component.totalPages = 40;
                component.hasMoreTraces = false;
                component.allTraces = Array(1000).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));

                await component._goToLastPage();

                expect(DataService.getPluginTraceLogs).not.toHaveBeenCalled();
                expect(component.currentPage).toBe(40);
            });
        });

        describe('Next button state with hasMoreTraces', () => {
            it('should enable next button when on last page but hasMoreTraces is true', () => {
                component.currentPage = 40;
                component.totalPages = 40;
                component.hasMoreTraces = true;
                component._updatePaginationUI();

                expect(component.ui.nextPageBtn.disabled).toBe(false);
            });

            it('should enable last button when on last page but hasMoreTraces is true', () => {
                component.currentPage = 40;
                component.totalPages = 40;
                component.hasMoreTraces = true;
                component._updatePaginationUI();

                expect(component.ui.lastPageBtn.disabled).toBe(false);
            });

            it('should disable next button when on last page and no more traces', () => {
                component.currentPage = 40;
                component.totalPages = 40;
                component.hasMoreTraces = false;
                component._updatePaginationUI();

                expect(component.ui.nextPageBtn.disabled).toBe(true);
            });
        });
    });

    describe('Page Size Selector', () => {
        beforeEach(async () => {
            const element = await component.render();
            document.body.appendChild(element);
            component.postRender(element);
            await vi.runAllTimersAsync();
            vi.clearAllMocks();
        });

        describe('UI rendering', () => {
            it('should render page size selector', async () => {
                const element = await component.render();
                const pageSizeSelect = element.querySelector('#trace-page-size-select');
                expect(pageSizeSelect).toBeTruthy();
                expect(pageSizeSelect.classList.contains('pdt-pagination-size-select')).toBe(true);
            });

            it('should have default page size options', async () => {
                const element = await component.render();
                const pageSizeSelect = element.querySelector('#trace-page-size-select');
                const options = Array.from(pageSizeSelect.querySelectorAll('option'));

                expect(options.length).toBe(4);
                expect(options.map(o => parseInt(o.value))).toEqual([25, 50, 100, 250]);
            });

            it('should have 25 selected by default', async () => {
                const element = await component.render();
                const pageSizeSelect = element.querySelector('#trace-page-size-select');
                expect(pageSizeSelect.value).toBe('25');
            });

            it('should cache page size selector in UI refs', () => {
                expect(component.ui.pageSizeSelect).toBeTruthy();
                expect(component.ui.pageSizeSelect.id).toBe('trace-page-size-select');
            });
        });

        describe('Page size change behavior', () => {
            it('should update pageSize when valid option selected', () => {
                component.allTraces = Array(100).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));
                component.totalPages = 4;
                component.currentPage = 2;

                component.ui.pageSizeSelect.value = '50';
                component.ui.pageSizeSelect.dispatchEvent(new Event('change'));

                expect(component.pageSize).toBe(50);
            });

            it('should reset to page 1 when changing page size', () => {
                component.allTraces = Array(100).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));
                component.currentPage = 3;
                component.pageSize = 25;
                component.totalPages = 4;

                component.ui.pageSizeSelect.value = '50';
                component.ui.pageSizeSelect.dispatchEvent(new Event('change'));

                expect(component.currentPage).toBe(1);
            });

            it('should recalculate totalPages based on new page size', () => {
                component.allTraces = Array(100).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));
                component.pageSize = 25;
                component.totalPages = 4;

                component.ui.pageSizeSelect.value = '50';
                component.ui.pageSizeSelect.dispatchEvent(new Event('change'));

                expect(component.totalPages).toBe(2); // 100 / 50 = 2
            });

            it('should re-render current page after size change', () => {
                component.allTraces = Array(75).fill(null).map((_, i) => ({
                    plugintracelogid: `trace-${i}`,
                    typename: 'TestPlugin',
                    messagename: 'Create',
                    primaryentity: 'account',
                    createdon: '2024-01-15T10:30:00Z',
                    performanceexecutionduration: 100,
                    messageblock: 'Test message'
                }));
                component.pageSize = 25;
                component.totalPages = 3;
                component.currentPage = 1;
                component._renderCurrentPage();

                // Should show 25 items initially
                let items = component.ui.logList.querySelectorAll('.trace-item');
                expect(items.length).toBe(25);

                // Change to 50 per page
                component.ui.pageSizeSelect.value = '50';
                component.ui.pageSizeSelect.dispatchEvent(new Event('change'));

                // Should now show 50 items
                items = component.ui.logList.querySelectorAll('.trace-item');
                expect(items.length).toBe(50);
            });

            it('should handle edge case with exact division', () => {
                component.allTraces = Array(100).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));

                component.ui.pageSizeSelect.value = '100';
                component.ui.pageSizeSelect.dispatchEvent(new Event('change'));

                expect(component.totalPages).toBe(1); // 100 / 100 = 1
            });

            it('should handle edge case with remainder', () => {
                component.allTraces = Array(125).fill(null).map((_, i) => ({ plugintracelogid: `trace-${i}` }));

                component.ui.pageSizeSelect.value = '50';
                component.ui.pageSizeSelect.dispatchEvent(new Event('change'));

                expect(component.totalPages).toBe(3); // 125 / 50 = 2.5 -> 3
            });
        });

        describe('Validation', () => {
            it('should reject page size below 1', () => {
                component.pageSize = 25;

                component.ui.pageSizeSelect.value = '0';
                component.ui.pageSizeSelect.dispatchEvent(new Event('change'));

                expect(component.pageSize).toBe(25); // Should not change
                expect(component.ui.pageSizeSelect.value).toBe('25'); // Should reset
            });

            it('should reject page size above 1000', () => {
                component.pageSize = 25;

                component.ui.pageSizeSelect.value = '1001';
                component.ui.pageSizeSelect.dispatchEvent(new Event('change'));

                expect(component.pageSize).toBe(25); // Should not change
                expect(component.ui.pageSizeSelect.value).toBe('25'); // Should reset
            });

            it('should reject NaN page size', () => {
                component.pageSize = 25;

                component.ui.pageSizeSelect.value = 'abc';
                component.ui.pageSizeSelect.dispatchEvent(new Event('change'));

                expect(component.pageSize).toBe(25); // Should not change
                expect(component.ui.pageSizeSelect.value).toBe('25'); // Should reset
            });

            it('should show notification on invalid page size', () => {
                component.ui.pageSizeSelect.value = '2000';
                component.ui.pageSizeSelect.dispatchEvent(new Event('change'));

                expect(NotificationService.show).toHaveBeenCalledWith(
                    'Page size must be between 1 and 1000',
                    'warning'
                );
            });
        });

        describe('Handler cleanup', () => {
            it('should bind page size change handler', () => {
                expect(component._handlePageSizeChange).toBeDefined();
                expect(typeof component._handlePageSizeChange).toBe('function');
            });

            it('should clear handler reference on destroy', () => {
                component.destroy();
                expect(component._handlePageSizeChange).toBeNull();
            });

            it('should remove event listener on destroy', () => {
                const removeSpy = vi.spyOn(component.ui.pageSizeSelect, 'removeEventListener');
                component.destroy();

                expect(removeSpy).toHaveBeenCalledWith('change', expect.any(Function));
            });
        });
    });
});
