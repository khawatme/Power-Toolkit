/**
 * @file Comprehensive tests for PerformanceTab component
 * @module tests/components/PerformanceTab.test.js
 * @description Tests for the Performance monitoring component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceTab } from '../../src/components/PerformanceTab.js';

// Mock performance metrics data
const mockPerformanceMetrics = {
    totalLoadTime: 2500,
    isApiAvailable: true,
    breakdown: {
        server: 1000,
        network: 500,
        client: 1000
    },
    uiCounts: {
        tabs: 5,
        sections: 15,
        controls: 50,
        onChange: 10
    }
};

const mockPerformanceMetricsNoApi = {
    totalLoadTime: 3000,
    isApiAvailable: false,
    breakdown: {
        server: 0,
        network: 0,
        client: 0
    },
    uiCounts: {
        tabs: 3,
        sections: 10,
        controls: 30,
        onChange: 5
    }
};

const mockHighLoadMetrics = {
    totalLoadTime: 5000,
    isApiAvailable: true,
    breakdown: {
        server: 2500,
        network: 1000,
        client: 1500
    },
    uiCounts: {
        tabs: 10,
        sections: 40,
        controls: 250,
        onChange: 30
    }
};

// Mock dependencies
vi.mock('../../src/services/DataService.js', () => ({
    DataService: {
        getPerformanceDetails: vi.fn(() => Promise.resolve(mockPerformanceMetrics)),
        getFormScriptSources: vi.fn(() => Promise.resolve({ scripts: [], skipped: [] }))
    }
}));

vi.mock('../../src/services/PowerAppsApiService.js', () => ({
    PowerAppsApiService: {
        isFormContextAvailable: true,
        getEntityName: vi.fn(() => 'account')
    }
}));

vi.mock('../../src/services/NotificationService.js', () => ({
    NotificationService: { show: vi.fn() }
}));

vi.mock('../../src/ui/UIFactory.js', () => ({
    UIFactory: {
        createFormDisabledMessage: vi.fn(() => {
            const div = document.createElement('div');
            div.className = 'pdt-note';
            div.textContent = 'Form context not available';
            return div;
        })
    }
}));

import { DataService } from '../../src/services/DataService.js';
import { PowerAppsApiService } from '../../src/services/PowerAppsApiService.js';

describe('PerformanceTab', () => {
    let component;

    beforeEach(() => {
        vi.clearAllMocks();
        DataService.getPerformanceDetails.mockResolvedValue(mockPerformanceMetrics);
        DataService.getFormScriptSources.mockResolvedValue({ scripts: [], skipped: [] });
        // clearAllMocks wipes the return value set in the factory, so restore it here rather than
        // letting a later suite inherit an undefined entity name.
        PowerAppsApiService.getEntityName.mockReturnValue('account');
        document.body.innerHTML = '';
    });

    afterEach(() => {
        component?.destroy?.();
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should initialize with correct id', () => {
            component = new PerformanceTab();
            expect(component.id).toBe('performance');
        });

        it('should initialize with correct label', () => {
            component = new PerformanceTab();
            expect(component.label).toContain('Performance');
        });

        it('should have an icon defined', () => {
            component = new PerformanceTab();
            expect(component.icon).toBeDefined();
        });

        it('should be a form-only component', () => {
            component = new PerformanceTab();
            expect(component.isFormOnly).toBe(true);
        });

        it('should initialize UI object', () => {
            component = new PerformanceTab();
            expect(component.ui).toBeDefined();
            expect(component.ui).toEqual({});
        });

        it('should initialize latestMetrics as null', () => {
            component = new PerformanceTab();
            expect(component.latestMetrics).toBeNull();
        });

        it('should start with no scanned scripts so script rules stay disabled', () => {
            component = new PerformanceTab();
            expect(component.scannedScripts).toBeNull();
        });

        it('should start with an idle scan status', () => {
            component = new PerformanceTab();
            expect(component.scanStatus).toEqual({ state: 'idle', message: '' });
        });
    });

    describe('render', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should return an HTMLElement', async () => {
            const element = await component.render();
            expect(element).toBeInstanceOf(HTMLElement);
        });

        it('should render section title', async () => {
            const element = await component.render();
            expect(element.querySelector('.section-title')).toBeTruthy();
        });

        it('should render section title with correct text', async () => {
            const element = await component.render();
            const title = element.querySelector('.section-title');
            expect(title.textContent).toBe('Form Performance');
        });

        it('should render content container', async () => {
            const element = await component.render();
            expect(element.querySelector('.pdt-content-host')).toBeTruthy();
        });

        it('should show loading message initially', async () => {
            const element = await component.render();
            const content = element.querySelector('.pdt-content-host');
            expect(content.textContent).toContain('Loading');
        });

        it('should cache container and content in ui', async () => {
            const element = await component.render();
            expect(component.ui.container).toBe(element);
            expect(component.ui.content).toBeTruthy();
        });
    });

    describe('postRender', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should not throw when called', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            await expect(component.postRender(element)).resolves.not.toThrow();
        });

        it('should cache content element', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);
            expect(component.ui.content).toBeTruthy();
        });

        it('should call DataService.getPerformanceDetails', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);
            expect(DataService.getPerformanceDetails).toHaveBeenCalled();
        });

        it('should store latestMetrics after loading', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);
            expect(component.latestMetrics).toBeTruthy();
        });

        it('should render performance sections', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            const sections = element.querySelectorAll('.pdt-perf-section');
            expect(sections.length).toBeGreaterThanOrEqual(2);
        });

        it('should handle API errors gracefully', async () => {
            DataService.getPerformanceDetails.mockRejectedValueOnce(new Error('API Error'));
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(element.textContent).toContain('API Error');
        });

        it('should display error with pdt-error class', async () => {
            DataService.getPerformanceDetails.mockRejectedValueOnce(new Error('API Error'));
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(element.querySelector('.pdt-error')).toBeTruthy();
        });
    });

    describe('metrics normalization', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should normalize metrics with default values', () => {
            const normalized = component._normalizeMetrics({});
            expect(normalized.totalLoadTime).toBe(0);
            expect(normalized.isApiAvailable).toBe(false);
            expect(normalized.breakdown.server).toBe(0);
            expect(normalized.breakdown.network).toBe(0);
            expect(normalized.breakdown.client).toBe(0);
        });

        it('should normalize valid metrics correctly', () => {
            const normalized = component._normalizeMetrics(mockPerformanceMetrics);
            expect(normalized.totalLoadTime).toBe(2500);
            expect(normalized.isApiAvailable).toBe(true);
            expect(normalized.breakdown.server).toBe(1000);
            expect(normalized.uiCounts.controls).toBe(50);
        });

        it('should handle null raw metrics', () => {
            const normalized = component._normalizeMetrics(null);
            expect(normalized.totalLoadTime).toBe(0);
            expect(normalized.isApiAvailable).toBe(false);
        });

        it('should handle undefined raw metrics', () => {
            const normalized = component._normalizeMetrics(undefined);
            expect(normalized.totalLoadTime).toBe(0);
        });

        it('should handle string totalLoadTime', () => {
            const normalized = component._normalizeMetrics({ totalLoadTime: '1500' });
            expect(normalized.totalLoadTime).toBe(1500);
        });
    });

    describe('script scan', () => {
        beforeEach(() => {
            component = new PerformanceTab();
            DataService.getFormScriptSources.mockResolvedValue({ scripts: [], skipped: [] });
        });

        it('should read the current table\'s libraries', async () => {
            await component._handleScanScripts();
            expect(DataService.getFormScriptSources).toHaveBeenCalledWith('account');
        });

        it('should enable the script rules once the scan completes', async () => {
            DataService.getFormScriptSources.mockResolvedValue({
                scripts: [{ name: 'new_/a.js', source: 'console.log(1);' }],
                skipped: []
            });

            await component._handleScanScripts();

            expect(component.scannedScripts).toHaveLength(1);
            expect(component.scanStatus.state).toBe('done');
        });

        it('should strip comments so a commented-out call is not reported', async () => {
            DataService.getFormScriptSources.mockResolvedValue({
                scripts: [{ name: 'new_/a.js', source: '// console.log(1);' }],
                skipped: []
            });

            await component._handleScanScripts();

            expect(component.scannedScripts[0].code).not.toContain('console.log');
        });

        it('should treat a table with no libraries as scanned, not unscanned', async () => {
            await component._handleScanScripts();
            expect(component.scannedScripts).toEqual([]);
            expect(component.scanStatus.message).toContain('No unmanaged JavaScript libraries');
        });

        it('should report how many managed libraries it left out', async () => {
            DataService.getFormScriptSources.mockResolvedValue({
                scripts: [{ name: 'new_/a.js', source: 'var a = 1;' }],
                skipped: [],
                system: 4
            });

            await component._handleScanScripts();

            expect(component.scanStatus.message).toContain('4 managed libraries skipped');
        });

        it('should name the libraries it could not read', async () => {
            DataService.getFormScriptSources.mockResolvedValue({
                scripts: [],
                skipped: ['new_/missing.js']
            });

            await component._handleScanScripts();

            expect(component.scanStatus.message).toContain('new_/missing.js');
        });

        it('should report a failure without claiming the scripts are clean', async () => {
            DataService.getFormScriptSources.mockRejectedValue(new Error('403'));

            await component._handleScanScripts();

            expect(component.scanStatus.state).toBe('error');
            expect(component.scanStatus.message).toContain('403');
            expect(component.scannedScripts).toBeNull();
        });

        it('should explain when there is no table context', async () => {
            PowerAppsApiService.getEntityName.mockReturnValueOnce('');

            await component._handleScanScripts();

            expect(DataService.getFormScriptSources).not.toHaveBeenCalled();
            expect(component.scanStatus.state).toBe('error');
        });
    });

    describe('load time section', () => {
        beforeEach(async () => {
            component = new PerformanceTab();
        });

        it('should build load time section', () => {
            const section = component._buildLoadTimeSection(mockPerformanceMetrics);
            expect(section).toBeInstanceOf(HTMLElement);
            expect(section.className).toContain('pdt-perf-section');
        });

        it('should display total load time', () => {
            const section = component._buildLoadTimeSection(mockPerformanceMetrics);
            expect(section.textContent).toContain('2500');
        });

        it('should show "ms" unit', () => {
            const section = component._buildLoadTimeSection(mockPerformanceMetrics);
            expect(section.textContent).toContain('ms');
        });

        it('should show Xrm.Performance label when API is available', () => {
            const section = component._buildLoadTimeSection(mockPerformanceMetrics);
            expect(section.textContent).toContain('Xrm.Performance');
        });

        it('should show Fallback label when API is not available', () => {
            const section = component._buildLoadTimeSection(mockPerformanceMetricsNoApi);
            expect(section.textContent).toContain('Fallback');
        });

        it('should build performance bar when API is available', () => {
            const section = component._buildLoadTimeSection(mockPerformanceMetrics);
            expect(section.querySelector('.pdt-perf-bar')).toBeTruthy();
        });

        it('should not build performance bar when API is not available', () => {
            const section = component._buildLoadTimeSection(mockPerformanceMetricsNoApi);
            expect(section.querySelector('.pdt-perf-bar')).toBeFalsy();
        });

        it('should show note when API is not available', () => {
            const section = component._buildLoadTimeSection(mockPerformanceMetricsNoApi);
            expect(section.querySelector('.pdt-note')).toBeTruthy();
        });

        it('should build legend when API is available', () => {
            const section = component._buildLoadTimeSection(mockPerformanceMetrics);
            expect(section.querySelector('.pdt-perf-legend')).toBeTruthy();
        });
    });

    describe('performance bar', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should build performance bar with segments', () => {
            const bar = component._buildPerfBar(
                mockPerformanceMetrics.breakdown,
                { serverPct: 40, networkPct: 20, clientPct: 40 }
            );
            expect(bar.children.length).toBe(3);
        });

        it('should set correct title on bar', () => {
            const bar = component._buildPerfBar(
                mockPerformanceMetrics.breakdown,
                { serverPct: 40, networkPct: 20, clientPct: 40 }
            );
            expect(bar.title).toContain('Server');
            expect(bar.title).toContain('Network');
            expect(bar.title).toContain('Client');
        });
    });

    describe('bar segment', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should create segment with correct class', () => {
            const segment = component._buildBarSegment('pdt-perf-server', 50, 'Test');
            expect(segment.className).toBe('pdt-perf-server');
        });

        it('should create segment with correct width', () => {
            const segment = component._buildBarSegment('pdt-perf-server', 50, 'Test');
            expect(segment.style.width).toBe('50%');
        });

        it('should create segment with correct title', () => {
            const segment = component._buildBarSegment('pdt-perf-server', 50, 'Server: 1000ms');
            expect(segment.title).toBe('Server: 1000ms');
        });

        it('should clamp width to 0-100', () => {
            const segmentNegative = component._buildBarSegment('pdt-perf-server', -10, 'Test');
            expect(segmentNegative.style.width).toBe('0%');

            const segmentOver100 = component._buildBarSegment('pdt-perf-server', 150, 'Test');
            expect(segmentOver100.style.width).toBe('100%');
        });
    });

    describe('legend', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should build legend with correct class', () => {
            const legend = component._buildLegend();
            expect(legend.className).toBe('pdt-perf-legend');
        });

        it('should contain Server, Network, and Client labels', () => {
            const legend = component._buildLegend();
            expect(legend.textContent).toContain('Server');
            expect(legend.textContent).toContain('Network');
            expect(legend.textContent).toContain('Client');
        });
    });

    describe('composition section', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should build composition section', () => {
            const section = component._buildCompositionSection(mockPerformanceMetrics);
            expect(section).toBeInstanceOf(HTMLElement);
            expect(section.className).toContain('pdt-perf-section');
        });

        it('should have Form Composition title', () => {
            const section = component._buildCompositionSection(mockPerformanceMetrics);
            expect(section.textContent).toContain('Form Composition');
        });

        it('should display tabs count', () => {
            const section = component._buildCompositionSection(mockPerformanceMetrics);
            expect(section.textContent).toContain('Tabs');
            expect(section.textContent).toContain('5');
        });

        it('should display sections count', () => {
            const section = component._buildCompositionSection(mockPerformanceMetrics);
            expect(section.textContent).toContain('Sections');
            expect(section.textContent).toContain('15');
        });

        it('should display controls count', () => {
            const section = component._buildCompositionSection(mockPerformanceMetrics);
            expect(section.textContent).toContain('Controls');
            expect(section.textContent).toContain('50');
        });

        it('should display onChange count', () => {
            const section = component._buildCompositionSection(mockPerformanceMetrics);
            expect(section.textContent).toContain('OnChange');
            expect(section.textContent).toContain('10');
        });

        it('should create grid layout', () => {
            const section = component._buildCompositionSection(mockPerformanceMetrics);
            expect(section.querySelector('.pdt-grid-4')).toBeTruthy();
        });
    });

    describe('stat card', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should build stat card', () => {
            const card = component._buildStatCard(42, 'Test Label');
            expect(card).toBeInstanceOf(HTMLElement);
            expect(card.className).toBe('pdt-stat-card');
        });

        it('should display value', () => {
            const card = component._buildStatCard(42, 'Test Label');
            expect(card.textContent).toContain('42');
        });

        it('should display label', () => {
            const card = component._buildStatCard(42, 'Test Label');
            expect(card.textContent).toContain('Test Label');
        });
    });

    describe('review section', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should build the review section', () => {
            const section = component._buildReviewSection(mockPerformanceMetrics);
            expect(section).toBeInstanceOf(HTMLElement);
            expect(section.className).toContain('pdt-perf-review');
        });

        it('should title the section Performance Review', () => {
            const section = component._buildReviewSection(mockPerformanceMetrics);
            expect(section.textContent).toContain('Performance Review');
        });

        it('should list a finding per rule that fired', () => {
            const section = component._buildReviewSection(mockHighLoadMetrics);
            expect(section.querySelectorAll('.pdt-review-finding').length).toBeGreaterThan(0);
        });

        it('should give every finding a Microsoft Learn link', () => {
            const section = component._buildReviewSection(mockHighLoadMetrics);
            const findings = section.querySelectorAll('.pdt-review-finding');
            const links = section.querySelectorAll('.pdt-review-finding-doc');

            expect(links.length).toBe(findings.length);
            links.forEach(link => {
                expect(link.href).toContain('learn.microsoft.com');
                expect(link.rel).toContain('noopener');
            });
        });

        it('should say how many rules it checked when nothing fires', () => {
            // isApiAvailable false so the breakdown-dominance rules skip and nothing fires.
            const goodMetrics = {
                totalLoadTime: 1000,
                isApiAvailable: false,
                breakdown: { server: 0, network: 0, client: 0 },
                uiCounts: { tabs: 3, sections: 10, controls: 50, onChange: 5 }
            };

            const section = component._buildReviewSection(goodMetrics);

            expect(section.querySelectorAll('.pdt-review-finding')).toHaveLength(0);
            expect(section.textContent).toContain('rules checked');
        });

        it('should count more rules once scripts have been scanned', () => {
            // isApiAvailable false so the breakdown-dominance rules skip and nothing fires.
            const goodMetrics = {
                totalLoadTime: 1000,
                isApiAvailable: false,
                breakdown: { server: 0, network: 0, client: 0 },
                uiCounts: { tabs: 3, sections: 10, controls: 50, onChange: 5 }
            };
            const before = component._buildReviewSection(goodMetrics).textContent;

            component.scannedScripts = [];
            const after = component._buildReviewSection(goodMetrics).textContent;

            expect(before).not.toBe(after);
        });

        it('should summarize the findings by severity', () => {
            const section = component._buildReviewSection(mockHighLoadMetrics);
            expect(section.querySelector('.pdt-perf-review-summary')).toBeTruthy();
        });

        it('should offer the script scan and a refresh', () => {
            const section = component._buildReviewSection(mockPerformanceMetrics);
            expect(section.querySelector('#perf-scan-scripts')).toBeTruthy();
            expect(section.querySelector('#perf-refresh')).toBeTruthy();
        });

        it('should right-align the toolbar buttons', () => {
            const bar = component._buildReviewSection(mockPerformanceMetrics)
                .querySelector('.pdt-perf-scan-bar');

            expect(bar.className).toContain('pdt-toolbar-end');
            // Buttons come last so the status text can push them right.
            expect(bar.lastElementChild.id).toBe('perf-refresh');
        });

        it('should disable both buttons while a scan is running', () => {
            component.scanStatus = { state: 'busy', message: 'Reading...' };
            const section = component._buildReviewSection(mockPerformanceMetrics);

            expect(section.querySelector('#perf-scan-scripts').disabled).toBe(true);
            expect(section.querySelector('#perf-refresh').disabled).toBe(true);
        });

        it('should escape a finding message rather than render markup from it', () => {
            const section = component._buildReviewSection({
                ...mockHighLoadMetrics,
                defaultTab: {
                    label: '<img src=x onerror="alert(1)">',
                    controls: 50,
                    dataControls: { subgrid: 4 },
                    deferrable: {}
                }
            });

            expect(section.querySelector('img')).toBeNull();
            expect(section.textContent).toContain('<img src=x onerror="alert(1)">');
        });
    });

    describe('loading state', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should set loading state', async () => {
            const element = await component.render();
            document.body.appendChild(element);

            component._setLoading(true);
            expect(component.ui.content.textContent).toContain('Loading');
        });

        it('should handle missing content element', () => {
            component.ui.content = null;
            expect(() => component._setLoading(true)).not.toThrow();
        });
    });

    describe('full render cycle', () => {
        it('should render all sections after postRender', async () => {
            component = new PerformanceTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            // Should have Load Time, Composition, and Insights sections
            const sections = element.querySelectorAll('.pdt-perf-section');
            expect(sections.length).toBe(3);
        });

        it('should display total load time in rendered output', async () => {
            component = new PerformanceTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(element.textContent).toContain('2500');
        });

        it('should display performance bar in rendered output', async () => {
            component = new PerformanceTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            expect(element.querySelector('.pdt-perf-bar')).toBeTruthy();
        });
    });

    describe('destroy', () => {
        it('should not throw when called', () => {
            component = new PerformanceTab();
            expect(() => component.destroy()).not.toThrow();
        });

        it('should not throw when called after render', async () => {
            component = new PerformanceTab();
            const element = await component.render();
            document.body.appendChild(element);
            expect(() => component.destroy()).not.toThrow();
        });

        it('should cleanup after render and postRender', async () => {
            component = new PerformanceTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);
            expect(() => component.destroy()).not.toThrow();
        });
    });

    describe('edge cases', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should handle zero total load time', () => {
            const zeroMetrics = {
                totalLoadTime: 0,
                isApiAvailable: true,
                breakdown: { server: 0, network: 0, client: 0 },
                uiCounts: { tabs: 0, sections: 0, controls: 0, onChange: 0 }
            };
            const section = component._buildLoadTimeSection(zeroMetrics);
            expect(section.textContent).toContain('0');
        });

        it('should handle missing breakdown', () => {
            const noBreakdown = {
                totalLoadTime: 1000,
                isApiAvailable: true,
                breakdown: null,
                uiCounts: { tabs: 3, sections: 10, controls: 50, onChange: 5 }
            };
            const normalized = component._normalizeMetrics(noBreakdown);
            expect(normalized.breakdown.server).toBe(0);
        });

        it('should handle missing uiCounts', () => {
            const noUiCounts = {
                totalLoadTime: 1000,
                isApiAvailable: true,
                breakdown: { server: 300, network: 300, client: 400 },
                uiCounts: null
            };
            const normalized = component._normalizeMetrics(noUiCounts);
            expect(normalized.uiCounts.tabs).toBe(0);
        });
    });

    describe('review section all-clear', () => {
        // Metrics below every threshold, with isApiAvailable false so the breakdown rules skip.
        const cleanMetrics = {
            totalLoadTime: 500,
            isApiAvailable: false,
            breakdown: { server: 0, network: 0, client: 0 },
            uiCounts: { tabs: 2, sections: 5, controls: 20, onChange: 3 }
        };

        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should render a note rather than a findings list', () => {
            const section = component._buildReviewSection(cleanMetrics);

            expect(section.querySelectorAll('.pdt-review-finding')).toHaveLength(0);
            expect(section.querySelector('p.pdt-note')).toBeTruthy();
        });

        it('should keep the section header', () => {
            const section = component._buildReviewSection(cleanMetrics);
            const header = section.querySelector('.section-title');

            expect(header).toBeTruthy();
            expect(header.textContent).toContain('Performance Review');
        });
    });

    describe('refresh', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should re-read the metrics', async () => {
            const element = await component.render();
            await component.postRender(element);
            DataService.getPerformanceDetails.mockClear();

            element.querySelector('#perf-refresh').click();
            await vi.waitFor(() => expect(DataService.getPerformanceDetails).toHaveBeenCalled());
        });

        it('should clear a previous scan so its findings do not survive', async () => {
            const element = await component.render();
            await component.postRender(element);
            component.scannedScripts = [{ name: 'a.js', code: 'console.log(1);', text: '' }];
            component.scanStatus = { state: 'done', message: '1 library scanned.' };

            await component._loadAndRenderMetrics();

            expect(component.scannedScripts).toBeNull();
            expect(component.scanStatus).toEqual({ state: 'idle', message: '' });
        });

        it('should clear the scan when the tool-wide refresh re-runs postRender', async () => {
            // The component is a registry singleton, so Refresh Tool reuses this instance.
            const element = await component.render();
            await component.postRender(element);
            component.scannedScripts = [];

            component.destroy();
            const fresh = await component.render();
            await component.postRender(fresh);

            expect(component.scannedScripts).toBeNull();
        });
    });

    describe('_refreshReview', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should replace only the review section', async () => {
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);

            const loadTimeBefore = element.querySelector('.pdt-perf-total-time');
            component.scannedScripts = [];
            component._refreshReview();

            // The timing chart is the same node; only the review was rebuilt.
            expect(element.querySelector('.pdt-perf-total-time')).toBe(loadTimeBefore);
            expect(element.querySelectorAll('.pdt-perf-review')).toHaveLength(1);
        });

        it('should do nothing before the metrics have loaded', () => {
            expect(() => component._refreshReview()).not.toThrow();
        });
    });

    // The rule module is unit-tested against hand-built snapshots, which cannot catch the tab
    // dropping a field on the way in. These drive the real load path with the exact shape
    // FormInspectionService.getPerformanceDetails returns.
    describe('composition data reaches the rules', () => {
        /** The service payload, including the fields only the review reads. */
        const richMetrics = {
            totalLoadTime: 1200,
            isApiAvailable: true,
            breakdown: { server: 400, network: 300, client: 500 },
            uiCounts: { tabs: 3, sections: 8, controls: 200, columns: 120, onChange: 5 },
            controlTypes: { standard: 180, subgrid: 12, quickform: 2 },
            defaultTab: {
                name: 'general',
                label: 'General',
                controls: 60,
                dataControls: { subgrid: 4, quickform: 1 },
                deferrable: { iframe: 1 }
            }
        };

        beforeEach(async () => {
            DataService.getPerformanceDetails.mockResolvedValue(richMetrics);
            component = new PerformanceTab();
            const element = await component.render();
            document.body.appendChild(element);
            await component.postRender(element);
        });

        it('should keep the column count so the mobile-columns rule can fire', () => {
            expect(component.latestMetrics.uiCounts.columns).toBe(120);
            expect(document.body.textContent).toContain('below 75 columns for mobile — it has 120');
        });

        it('should keep controlTypes so the mobile-subgrids rule can fire', () => {
            expect(component.latestMetrics.controlTypes).toEqual(richMetrics.controlTypes);
            expect(document.body.textContent).toContain('to 10 subgrids for mobile — it has 12');
        });

        it('should keep the default tab so its rules can fire', () => {
            expect(component.latestMetrics.defaultTab).toEqual(richMetrics.defaultTab);
            const text = document.body.textContent;
            expect(text).toContain('"General"');
            expect(text).toContain('4 subgrids, 1 quick view form');
        });

        it('should not count columns as controls when the service omits them', async () => {
            // A snapshot without `columns` must not fall back to the 200 controls and invent a
            // mobile-columns finding the form has not earned.
            DataService.getPerformanceDetails.mockResolvedValue({
                ...richMetrics,
                uiCounts: { tabs: 3, sections: 8, controls: 200, onChange: 5 }
            });
            await component._loadAndRenderMetrics();

            expect(document.body.textContent).not.toContain('columns for mobile');
        });
    });
});
