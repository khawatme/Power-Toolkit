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
        getPerformanceDetails: vi.fn(() => Promise.resolve(mockPerformanceMetrics))
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

        it('should initialize thresholds with default values', () => {
            component = new PerformanceTab();
            expect(component.thresholds).toBeDefined();
            expect(component.thresholds.totalMsWarn).toBe(2000);
            expect(component.thresholds.totalMsBad).toBe(4000);
            expect(component.thresholds.controlsWarn).toBe(200);
            expect(component.thresholds.onChangeWarn).toBe(25);
            expect(component.thresholds.tabsWarn).toBe(8);
            expect(component.thresholds.sectionsWarn).toBe(30);
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

    describe('insights computation', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should return few or no warnings for good metrics', () => {
            const goodMetrics = {
                totalLoadTime: 1000,
                isApiAvailable: true,
                breakdown: { server: 300, network: 300, client: 400 },
                uiCounts: { tabs: 3, sections: 10, controls: 50, onChange: 5 }
            };
            const insights = component._computeInsights(goodMetrics);
            // Good metrics should have minimal or no warnings
            const warnings = insights.filter(i => i.type === 'warning');
            expect(warnings.length).toBeLessThanOrEqual(1);
        });

        it('should warn about high total load time', () => {
            const slowMetrics = {
                totalLoadTime: 2500,
                isApiAvailable: true,
                breakdown: { server: 1000, network: 500, client: 1000 },
                uiCounts: { tabs: 3, sections: 10, controls: 50, onChange: 5 }
            };
            const insights = component._computeInsights(slowMetrics);
            expect(insights.some(i => i.includes('load time'))).toBe(true);
        });

        it('should warn about critical load time', () => {
            const criticalMetrics = {
                totalLoadTime: 5000,
                isApiAvailable: true,
                breakdown: { server: 2000, network: 1000, client: 2000 },
                uiCounts: { tabs: 3, sections: 10, controls: 50, onChange: 5 }
            };
            const insights = component._computeInsights(criticalMetrics);
            expect(insights.some(i => i.includes('critical'))).toBe(true);
        });

        it('should warn about too many controls', () => {
            const manyControlsMetrics = {
                totalLoadTime: 1000,
                isApiAvailable: true,
                breakdown: { server: 300, network: 300, client: 400 },
                uiCounts: { tabs: 3, sections: 10, controls: 250, onChange: 5 }
            };
            const insights = component._computeInsights(manyControlsMetrics);
            expect(insights.some(i => i.includes('controls'))).toBe(true);
        });

        it('should warn about too many onChange handlers', () => {
            const manyOnChangeMetrics = {
                totalLoadTime: 1000,
                isApiAvailable: true,
                breakdown: { server: 300, network: 300, client: 400 },
                uiCounts: { tabs: 3, sections: 10, controls: 50, onChange: 30 }
            };
            const insights = component._computeInsights(manyOnChangeMetrics);
            expect(insights.some(i => i.includes('OnChange'))).toBe(true);
        });

        it('should warn about too many tabs', () => {
            const manyTabsMetrics = {
                totalLoadTime: 1000,
                isApiAvailable: true,
                breakdown: { server: 300, network: 300, client: 400 },
                uiCounts: { tabs: 10, sections: 10, controls: 50, onChange: 5 }
            };
            const insights = component._computeInsights(manyTabsMetrics);
            expect(insights.some(i => i.includes('tabs'))).toBe(true);
        });

        it('should warn about too many sections', () => {
            const manySectionsMetrics = {
                totalLoadTime: 1000,
                isApiAvailable: true,
                breakdown: { server: 300, network: 300, client: 400 },
                uiCounts: { tabs: 3, sections: 35, controls: 50, onChange: 5 }
            };
            const insights = component._computeInsights(manySectionsMetrics);
            expect(insights.some(i => i.includes('sections'))).toBe(true);
        });

        it('should identify server-side bottleneck', () => {
            const serverHeavyMetrics = {
                totalLoadTime: 3000,
                isApiAvailable: true,
                breakdown: { server: 2000, network: 500, client: 500 },
                uiCounts: { tabs: 3, sections: 10, controls: 50, onChange: 5 }
            };
            const insights = component._computeInsights(serverHeavyMetrics);
            expect(insights.some(i => i.includes('Server-side'))).toBe(true);
        });

        it('should identify client-side bottleneck', () => {
            const clientHeavyMetrics = {
                totalLoadTime: 3000,
                isApiAvailable: true,
                breakdown: { server: 500, network: 500, client: 2000 },
                uiCounts: { tabs: 3, sections: 10, controls: 50, onChange: 5 }
            };
            const insights = component._computeInsights(clientHeavyMetrics);
            expect(insights.some(i => i.includes('Client'))).toBe(true);
        });

        it('should identify network bottleneck', () => {
            const networkHeavyMetrics = {
                totalLoadTime: 3000,
                isApiAvailable: true,
                breakdown: { server: 500, network: 2000, client: 500 },
                uiCounts: { tabs: 3, sections: 10, controls: 50, onChange: 5 }
            };
            const insights = component._computeInsights(networkHeavyMetrics);
            expect(insights.some(i => i.includes('Network'))).toBe(true);
        });

        it('should not show breakdown insights when API is not available', () => {
            const noApiMetrics = {
                totalLoadTime: 3000,
                isApiAvailable: false,
                breakdown: { server: 2000, network: 500, client: 500 },
                uiCounts: { tabs: 3, sections: 10, controls: 50, onChange: 5 }
            };
            const insights = component._computeInsights(noApiMetrics);
            expect(insights.every(i => !i.includes('Server-side') && !i.includes('Network time dominates') && !i.includes('Client rendering dominates'))).toBe(true);
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

    describe('insights section', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should build insights section', () => {
            const section = component._buildInsightsSection(mockPerformanceMetrics);
            expect(section).toBeInstanceOf(HTMLElement);
            expect(section.className).toContain('pdt-perf-section');
        });

        it('should have Insights title', () => {
            const section = component._buildInsightsSection(mockPerformanceMetrics);
            expect(section.textContent).toContain('Insights');
        });

        it('should show "no issues" when no insights', () => {
            const goodMetrics = {
                totalLoadTime: 1000,
                isApiAvailable: true,
                breakdown: { server: 300, network: 300, client: 400 },
                uiCounts: { tabs: 3, sections: 10, controls: 50, onChange: 5 }
            };
            const section = component._buildInsightsSection(goodMetrics);
            expect(section.querySelector('.pdt-note')).toBeTruthy();
        });

        it('should show insights list when issues found', () => {
            const section = component._buildInsightsSection(mockHighLoadMetrics);
            expect(section.querySelector('ul')).toBeTruthy();
        });

        it('should create list items for each insight', () => {
            const section = component._buildInsightsSection(mockHighLoadMetrics);
            const listItems = section.querySelectorAll('li');
            expect(listItems.length).toBeGreaterThan(0);
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

    describe('_buildInsightsSection no insights - lines 307-311 coverage', () => {
        beforeEach(() => {
            component = new PerformanceTab();
        });

        it('should display no issues message when insights array is empty', () => {
            // Create metrics that will produce NO insights at all:
            // - totalLoadTime < 2000 (below warn threshold)
            // - controls < 200
            // - onChange < 25
            // - tabs < 8
            // - sections < 30
            // - isApiAvailable = false (to skip breakdown checks)
            const noInsightsMetrics = {
                totalLoadTime: 500,
                isApiAvailable: false,  // Skip breakdown-based insights
                breakdown: { server: 0, network: 0, client: 0 },
                uiCounts: { tabs: 2, sections: 5, controls: 20, onChange: 3 }
            };

            // First verify that _computeInsights returns empty array
            const insights = component._computeInsights(noInsightsMetrics);
            expect(insights.length).toBe(0);

            // Now test _buildInsightsSection
            const section = component._buildInsightsSection(noInsightsMetrics);

            expect(section).toBeInstanceOf(HTMLElement);
            expect(section.className).toBe('pdt-perf-section');

            // Should have a p.pdt-note (not ul.pdt-note)
            const note = section.querySelector('p.pdt-note');
            expect(note).toBeTruthy();
            expect(section.querySelector('ul')).toBeNull();
        });

        it('should show header followed by note paragraph when no insights', () => {
            const noInsightsMetrics = {
                totalLoadTime: 100,
                isApiAvailable: false,
                breakdown: { server: 0, network: 0, client: 0 },
                uiCounts: { tabs: 1, sections: 2, controls: 10, onChange: 1 }
            };

            // Verify no insights
            expect(component._computeInsights(noInsightsMetrics).length).toBe(0);

            const section = component._buildInsightsSection(noInsightsMetrics);

            const header = section.querySelector('.section-title');
            expect(header).toBeTruthy();
            expect(header.textContent).toContain('Insights');

            const note = section.querySelector('p.pdt-note');
            expect(note).toBeTruthy();
        });
    });
});
