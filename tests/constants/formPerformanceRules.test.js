/**
 * @file Tests for the form performance review rules.
 * @module tests/constants/formPerformanceRules.test.js
 */

import { describe, it, expect } from 'vitest';
import {
    reviewFormPerformance,
    countFormPerformanceRules,
    toScannedScript,
    PERF_DOCS,
    MOBILE_LIMITS,
    REVIEW_THRESHOLDS,
    DATA_DRIVEN_CONTROL_TYPES,
    DEFERRABLE_CONTROL_TYPES
} from '../../src/constants/formPerformanceRules.js';

/** A form that trips nothing: under every threshold, no timing API. */
const CLEAN_SNAPSHOT = {
    totalLoadTime: 800,
    isApiAvailable: false,
    breakdown: { server: 0, network: 0, client: 0 },
    uiCounts: { tabs: 3, sections: 8, controls: 40, onChange: 4 },
    controlTypes: { standard: 38, subgrid: 2 },
    defaultTab: { label: 'General', controls: 20, dataControls: { subgrid: 1 }, deferrable: {} }
};

/**
 * Finds a finding by rule id.
 * @param {object[]} findings - The findings.
 * @param {string} id - Rule id.
 * @returns {object|undefined} The finding.
 */
function byId(findings, id) {
    return findings.find(f => f.id === id);
}

/**
 * Runs a review with scripts attached.
 * @param {string} source - JavaScript source.
 * @param {object} [snapshot] - Base snapshot.
 * @returns {object[]} Findings.
 */
function reviewScript(source, snapshot = CLEAN_SNAPSHOT) {
    return reviewFormPerformance({
        ...snapshot,
        scripts: [toScannedScript('new_/form.js', source)]
    });
}

describe('formPerformanceRules', () => {
    describe('contract', () => {
        it('should return an empty array for a form that trips nothing', () => {
            expect(reviewFormPerformance(CLEAN_SNAPSHOT)).toEqual([]);
        });

        it('should return an empty array for a missing snapshot', () => {
            expect(reviewFormPerformance(null)).toEqual([]);
            expect(reviewFormPerformance(undefined)).toEqual([]);
            expect(reviewFormPerformance('not a snapshot')).toEqual([]);
        });

        it('should not throw on an empty snapshot', () => {
            expect(() => reviewFormPerformance({})).not.toThrow();
        });

        it('should be deterministic', () => {
            const a = reviewFormPerformance(CLEAN_SNAPSHOT);
            const b = reviewFormPerformance(CLEAN_SNAPSHOT);
            expect(a).toEqual(b);
        });

        it('should sort findings most severe first', () => {
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                totalLoadTime: 9000,
                uiCounts: { tabs: 9, sections: 40, controls: 200, onChange: 40 },
                scripts: [toScannedScript('a.js', 'console.log(1); window.top.foo;')]
            });

            const order = { error: 0, warn: 1, info: 2 };
            const severities = findings.map(f => order[f.severity]);
            expect(severities).toEqual([...severities].sort((x, y) => x - y));
        });

        it('should give every finding an id, message, reason and doc URL', () => {
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                totalLoadTime: 9000,
                uiCounts: { tabs: 9, sections: 40, controls: 200, onChange: 40 },
                scripts: [toScannedScript('a.js', 'console.log(1);')]
            });

            expect(findings.length).toBeGreaterThan(0);
            findings.forEach(finding => {
                expect(finding.id).toBeTruthy();
                expect(finding.message).toBeTruthy();
                expect(finding.reason).toBeTruthy();
                expect(finding.docUrl).toMatch(/^https:\/\/learn\.microsoft\.com\//);
            });
        });

        it('should point every doc at learn.microsoft.com', () => {
            Object.values(PERF_DOCS).forEach(url => {
                expect(url).toMatch(/^https:\/\/learn\.microsoft\.com\//);
            });
        });

        it('should resolve every rule\'s doc key to a real URL', () => {
            // A typo in a rule's `doc` key yields docUrl undefined, and the finding renders with no
            // Learn link at all — which is the one thing this review promises. Trip every rule and
            // check the link resolved.
            const known = new Set(Object.values(PERF_DOCS));
            const snapshots = [
                {
                    totalLoadTime: 9000,
                    isApiAvailable: true,
                    breakdown: { server: 8000, network: 1, client: 1 },
                    uiCounts: { tabs: 9, sections: 40, controls: 200, columns: 200, onChange: 40 },
                    controlTypes: { subgrid: 20 },
                    defaultTab: {
                        label: 'General',
                        controls: 90,
                        dataControls: { subgrid: 5 },
                        deferrable: { iframe: 1 }
                    },
                    scripts: [toScannedScript('bad.js', [
                        'console.log(1);',
                        'xhr.open("GET", u, false);',
                        'window.top.foo;',
                        'window.open(u);',
                        'setInterval(f, 1);',
                        'window.addEventListener("resize", f);',
                        'var a = "/XRMServices/2011/OrganizationData.svc";',
                        'var b = "/main.aspx?navbar=on";'
                    ].join('\n'))]
                },
                // The dominance rules are mutually exclusive, so the other two need their own runs.
                { isApiAvailable: true, breakdown: { server: 1, network: 1, client: 900 } },
                { isApiAvailable: true, breakdown: { server: 1, network: 900, client: 1 } }
            ];

            const seen = new Set();
            snapshots.forEach(snapshot => {
                reviewFormPerformance(snapshot).forEach(finding => {
                    expect(known.has(finding.docUrl), `${finding.id} has no doc URL`).toBe(true);
                    seen.add(finding.id);
                });
            });

            // Every rule in the catalogue fired at least once, so none went unchecked above.
            expect(seen.size).toBe(countFormPerformanceRules(true));
        });

        it('should give every rule a unique id', () => {
            const findings = reviewFormPerformance({
                totalLoadTime: 9000,
                isApiAvailable: true,
                breakdown: { server: 8000, network: 1, client: 1 },
                uiCounts: { tabs: 9, sections: 40, controls: 200, columns: 200, onChange: 40 },
                controlTypes: { subgrid: 20 },
                defaultTab: { label: 'G', controls: 90, dataControls: { subgrid: 5 }, deferrable: { iframe: 1 } },
                scripts: [toScannedScript('a.js', 'console.log(1);')]
            });

            expect(new Set(findings.map(f => f.id)).size).toBe(findings.length);
        });
    });

    describe('documented mobile limits', () => {
        it('should use the documented numbers', () => {
            // Docs: "the number of objects is limited to 5 tabs or 75 columns and 10 subgrids".
            expect(MOBILE_LIMITS).toEqual({ tabs: 5, columns: 75, subgrids: 10 });
        });

        it('should not fire at exactly the limit', () => {
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                uiCounts: { tabs: 5, sections: 8, controls: 75, onChange: 4 },
                controlTypes: { subgrid: 10 }
            });

            expect(byId(findings, 'mobile-tabs')).toBeUndefined();
            expect(byId(findings, 'mobile-columns')).toBeUndefined();
            expect(byId(findings, 'mobile-subgrids')).toBeUndefined();
        });

        it('should fire one past the limit', () => {
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                uiCounts: { tabs: 6, sections: 8, controls: 76, onChange: 4 },
                controlTypes: { subgrid: 11 }
            });

            expect(byId(findings, 'mobile-tabs')).toBeDefined();
            expect(byId(findings, 'mobile-columns')).toBeDefined();
            expect(byId(findings, 'mobile-subgrids')).toBeDefined();
        });

        it('should count columns rather than controls', () => {
            // 80 controls but only 70 columns — a subgrid is a control, not a column.
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                uiCounts: { tabs: 3, sections: 8, controls: 80, columns: 70, onChange: 4 }
            });

            expect(byId(findings, 'mobile-columns')).toBeUndefined();
        });

        it('should fall back to the control count when columns are absent', () => {
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                uiCounts: { tabs: 3, sections: 8, controls: 90, onChange: 4 }
            });

            expect(byId(findings, 'mobile-columns')).toBeDefined();
        });

        it('should count custom subgrids toward the subgrid limit', () => {
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                controlTypes: { subgrid: 6, customsubgrid: 6 }
            });

            expect(byId(findings, 'mobile-subgrids')).toBeDefined();
        });

        it('should name the actual count in the message', () => {
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                uiCounts: { tabs: 12, sections: 8, controls: 40, onChange: 4 }
            });

            expect(byId(findings, 'mobile-tabs').message).toContain('12');
        });
    });

    describe('default tab', () => {
        it('should flag data-driven controls that always initialize', () => {
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                defaultTab: {
                    label: 'Summary',
                    controls: 20,
                    dataControls: { subgrid: 2, timelinewall: 1 },
                    deferrable: {}
                }
            });

            const finding = byId(findings, 'default-tab-data-controls');
            expect(finding).toBeDefined();
            expect(finding.message).toContain('Summary');
            expect(finding.message).toContain('2 subgrids');
            expect(finding.docUrl).toBe(PERF_DOCS.dataControls);
        });

        it('should merge control types that share a label', () => {
            // Standard and custom subgrids are both "subgrid"; "2 subgrids, 1 subgrid" reads as a bug.
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                defaultTab: {
                    label: 'Summary',
                    controls: 20,
                    dataControls: { subgrid: 2, customsubgrid: 1 },
                    deferrable: {}
                }
            });

            expect(byId(findings, 'default-tab-data-controls').message).toContain('3 subgrids');
        });

        it('should stay quiet below the threshold', () => {
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                defaultTab: {
                    label: 'Summary',
                    controls: 10,
                    dataControls: { subgrid: 1 },
                    deferrable: {}
                }
            });

            expect(byId(findings, 'default-tab-data-controls')).toBeUndefined();
        });

        it('should flag iframes and web resources separately and more gently', () => {
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                defaultTab: {
                    label: 'Summary',
                    controls: 10,
                    dataControls: {},
                    deferrable: { iframe: 1, webresource: 2 }
                }
            });

            const finding = byId(findings, 'default-tab-deferrable');
            expect(finding.severity).toBe('info');
            expect(finding.message).toContain('iFrame');
        });

        it('should flag a heavy default tab', () => {
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                defaultTab: {
                    label: 'Details',
                    controls: REVIEW_THRESHOLDS.defaultTabControls,
                    dataControls: {},
                    deferrable: {}
                }
            });

            expect(byId(findings, 'default-tab-controls')).toBeDefined();
        });

        it('should skip the default tab rules when no tab is expanded', () => {
            const findings = reviewFormPerformance({ ...CLEAN_SNAPSHOT, defaultTab: null });

            expect(byId(findings, 'default-tab-data-controls')).toBeUndefined();
            expect(byId(findings, 'default-tab-controls')).toBeUndefined();
            expect(byId(findings, 'default-tab-deferrable')).toBeUndefined();
        });
    });

    describe('load time', () => {
        it('should grade a slow load as a warning', () => {
            const findings = reviewFormPerformance({ ...CLEAN_SNAPSHOT, totalLoadTime: 2500 });
            expect(byId(findings, 'load-time').severity).toBe('warn');
        });

        it('should escalate a very slow load to an error', () => {
            const findings = reviewFormPerformance({ ...CLEAN_SNAPSHOT, totalLoadTime: 6000 });
            expect(byId(findings, 'load-time').severity).toBe('error');
        });

        it('should accept the string the Xrm API returns', () => {
            const findings = reviewFormPerformance({ ...CLEAN_SNAPSHOT, totalLoadTime: '6000' });
            expect(byId(findings, 'load-time')).toBeDefined();
        });

        it('should say the threshold is the toolkit\'s, not Microsoft\'s', () => {
            const findings = reviewFormPerformance({ ...CLEAN_SNAPSHOT, totalLoadTime: 2500 });
            expect(byId(findings, 'load-time').message).toContain('not Microsoft');
        });

        it('should skip the breakdown rules when the timing API is unavailable', () => {
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                isApiAvailable: false,
                breakdown: { server: 3000, network: 10, client: 10 }
            });

            expect(byId(findings, 'server-dominant')).toBeUndefined();
        });

        it('should name the dominant phase', () => {
            const server = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                isApiAvailable: true,
                breakdown: { server: 3000, network: 10, client: 10 }
            });
            const client = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                isApiAvailable: true,
                breakdown: { server: 10, network: 10, client: 3000 }
            });
            const network = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                isApiAvailable: true,
                breakdown: { server: 10, network: 3000, client: 10 }
            });

            expect(byId(server, 'server-dominant')).toBeDefined();
            expect(byId(client, 'client-dominant')).toBeDefined();
            expect(byId(network, 'network-dominant')).toBeDefined();
        });

        it('should report only one dominant phase at a time', () => {
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                isApiAvailable: true,
                breakdown: { server: 3000, network: 10, client: 10 }
            });

            const dominant = findings.filter(f => f.id.endsWith('-dominant'));
            expect(dominant).toHaveLength(1);
        });
    });

    describe('script rules', () => {
        it('should be skipped entirely when the scripts were not read', () => {
            const findings = reviewFormPerformance(CLEAN_SNAPSHOT);
            expect(findings.every(f => !f.needsScripts)).toBe(true);
        });

        it('should run against an empty library list', () => {
            const findings = reviewFormPerformance({ ...CLEAN_SNAPSHOT, scripts: [] });
            expect(findings).toEqual([]);
        });

        it('should flag console calls', () => {
            const finding = byId(reviewScript('function f(){ console.log("x"); }'), 'script-console');
            expect(finding).toBeDefined();
            expect(finding.docUrl).toBe(PERF_DOCS.consoleApis);
        });

        it('should not flag a console call inside a comment', () => {
            expect(byId(reviewScript('// console.log("x");'), 'script-console')).toBeUndefined();
            expect(byId(reviewScript('/* console.log("x"); */'), 'script-console')).toBeUndefined();
        });

        it('should not flag a console call named in a string', () => {
            expect(byId(reviewScript('var s = "console.log(1)";'), 'script-console')).toBeUndefined();
        });

        it('should flag a synchronous XMLHttpRequest', () => {
            const finding = byId(reviewScript('xhr.open("GET", url, false);'), 'script-sync-request');
            expect(finding).toBeDefined();
            expect(finding.severity).toBe('error');
        });

        it('should not flag an asynchronous XMLHttpRequest', () => {
            expect(byId(reviewScript('xhr.open("GET", url, true);'), 'script-sync-request')).toBeUndefined();
            expect(byId(reviewScript('xhr.open("GET", url);'), 'script-sync-request')).toBeUndefined();
        });

        it('should still flag a synchronous open with credentials after the async flag', () => {
            expect(byId(reviewScript('xhr.open("GET", url, false, user, pass);'), 'script-sync-request')).toBeDefined();
        });

        it('should not flag an unrelated two-argument open(x, false)', () => {
            // async is XHR's third argument; a two-argument call is some other API.
            expect(byId(reviewScript('dialog.open(options, false);'), 'script-sync-request')).toBeUndefined();
        });

        it('should flag jQuery async false', () => {
            expect(byId(reviewScript('$.ajax({ async: false, url: u });'), 'script-sync-request')).toBeDefined();
        });

        it('should flag window.top and window.parent', () => {
            expect(byId(reviewScript('var x = window.top.Xrm;'), 'script-window-top')).toBeDefined();
            expect(byId(reviewScript('var x = window.parent.Xrm;'), 'script-window-top')).toBeDefined();
        });

        it('should flag the deprecated OData v2 endpoint inside a string literal', () => {
            // The endpoint is always in a string, so this rule must read the text view. Scanning
            // only the string-blanked code view would make it permanently unfireable.
            const source = 'var u = base + "/XRMServices/2011/OrganizationData.svc/AccountSet";';
            expect(byId(reviewScript(source), 'script-odata-v2')).toBeDefined();
        });

        it('should flag a URL that leaves the navigation bar on', () => {
            const source = 'Xrm.Navigation.openUrl("/main.aspx?etn=account&navbar=on");';
            expect(byId(reviewScript(source), 'script-navbar')).toBeDefined();
        });

        it('should not flag a URL that turns the navigation bar off', () => {
            const source = 'Xrm.Navigation.openUrl("/main.aspx?etn=account&navbar=off");';
            expect(byId(reviewScript(source), 'script-navbar')).toBeUndefined();
        });

        it('should flag opening a new window', () => {
            expect(byId(reviewScript('window.open(url);'), 'script-new-window')).toBeDefined();
            expect(byId(reviewScript('Xrm.Navigation.openForm({ openInNewWindow: true });'), 'script-new-window')).toBeDefined();
        });

        it('should flag a timer with no cleanup', () => {
            expect(byId(reviewScript('setInterval(poll, 1000);'), 'script-timers')).toBeDefined();
        });

        it('should not flag a timer that is cleared', () => {
            const source = 'var t = setInterval(poll, 1000); function stop(){ clearInterval(t); }';
            expect(byId(reviewScript(source), 'script-timers')).toBeUndefined();
        });

        it('should flag a window listener with no cleanup', () => {
            expect(byId(reviewScript('window.addEventListener("resize", f);'), 'script-window-listeners')).toBeDefined();
        });

        it('should not flag a window listener that is removed', () => {
            const source = 'window.addEventListener("resize", f); window.removeEventListener("resize", f);';
            expect(byId(reviewScript(source), 'script-window-listeners')).toBeUndefined();
        });

        it('should name the library that tripped the rule', () => {
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                scripts: [
                    toScannedScript('new_/clean.js', 'function f(){}'),
                    toScannedScript('new_/noisy.js', 'console.log(1);')
                ]
            });

            const finding = byId(findings, 'script-console');
            expect(finding.message).toContain('new_/noisy.js');
            expect(finding.message).not.toContain('new_/clean.js');
        });

        it('should summarize rather than list every library', () => {
            const scripts = Array.from({ length: 6 }, (_, i) => toScannedScript(`lib${i}.js`, 'console.log(1);'));
            const finding = byId(reviewFormPerformance({ ...CLEAN_SNAPSHOT, scripts }), 'script-console');

            expect(finding.message).toContain('3 more');
        });

        it('should count every occurrence across libraries', () => {
            const findings = reviewFormPerformance({
                ...CLEAN_SNAPSHOT,
                scripts: [
                    toScannedScript('a.js', 'console.log(1); console.warn(2);'),
                    toScannedScript('b.js', 'console.error(3);')
                ]
            });

            expect(byId(findings, 'script-console').message).toContain('3 console calls');
        });
    });

    describe('countFormPerformanceRules', () => {
        it('should count fewer rules without a script scan', () => {
            expect(countFormPerformanceRules(false)).toBeLessThan(countFormPerformanceRules(true));
        });

        it('should default to the no-scripts count', () => {
            expect(countFormPerformanceRules()).toBe(countFormPerformanceRules(false));
        });
    });

    describe('toScannedScript', () => {
        it('should keep the library name', () => {
            expect(toScannedScript('new_/a.js', '').name).toBe('new_/a.js');
        });

        it('should tolerate missing input', () => {
            expect(toScannedScript(undefined, undefined)).toEqual({ name: '', code: '', text: '' });
        });

        it('should strip block and line comments', () => {
            const scanned = toScannedScript('a.js', '/* gone */ var a = 1; // gone too');
            expect(scanned.code).not.toContain('gone');
            expect(scanned.code).toContain('var a = 1;');
        });

        it('should not mistake a protocol slash for a comment', () => {
            const scanned = toScannedScript('a.js', 'var u = x + https://example.com;');
            expect(scanned.code).toContain('https:');
        });

        it('should keep string contents in the text view and drop them from the code view', () => {
            const scanned = toScannedScript('a.js', 'var u = "/XRMServices/2011/OrganizationData.svc";');

            expect(scanned.text).toContain('OrganizationData.svc');
            expect(scanned.code).not.toContain('OrganizationData.svc');
        });

        it('should strip comments from both views', () => {
            const scanned = toScannedScript('a.js', '// "/XRMServices/2011/OrganizationData.svc"');

            expect(scanned.text).not.toContain('OrganizationData.svc');
            expect(scanned.code).not.toContain('OrganizationData.svc');
        });

        it('should drop the prose of a template literal from the code view', () => {
            const scanned = toScannedScript('a.js', 'var m = `Never call window.top here`;');

            // Prose that merely names a pattern must not be scanned as if it were a call.
            expect(scanned.code).not.toContain('window.top');
            expect(scanned.text).toContain('window.top');
        });

        it('should keep the expressions inside a template literal', () => {
            const scanned = toScannedScript('a.js', 'var u = `${window.top.location.href}/api`;');

            // The expression is live code, and this idiom is exactly what the rule looks for.
            expect(scanned.code).toContain('window.top.location.href');
            expect(scanned.code).not.toContain('/api');
        });
    });

    describe('rules with more than one pattern', () => {
        it('should name a library whose only problem matches the second pattern', () => {
            // Regression: reporting `patternA || patternB` hid library b entirely.
            const findings = reviewFormPerformance({
                scripts: [
                    toScannedScript('a.js', 'xhr.open(m, u, false);'),
                    toScannedScript('b.js', '$.ajax({ async: false });')
                ]
            });

            const finding = findings.find(f => f.id === 'script-sync-request');
            expect(finding.message).toContain('a.js');
            expect(finding.message).toContain('b.js');
            expect(finding.message).toContain('2 synchronous requests');
        });

        it('should merge new-window patterns across libraries', () => {
            const findings = reviewFormPerformance({
                scripts: [
                    toScannedScript('a.js', 'window.open(u);'),
                    toScannedScript('b.js', 'Xrm.Navigation.openForm({ openInNewWindow: true });')
                ]
            });

            const finding = findings.find(f => f.id === 'script-new-window');
            expect(finding.message).toContain('a.js');
            expect(finding.message).toContain('b.js');
        });

        it('should count a library once when both patterns hit it', () => {
            const findings = reviewFormPerformance({
                scripts: [toScannedScript('a.js', 'xhr.open(m, u, false); $.ajax({ async: false });')]
            });

            const finding = findings.find(f => f.id === 'script-sync-request');
            expect(finding.message).toBe('Make the 2 synchronous requests in a.js asynchronous.');
        });
    });

    describe('template literals in script rules', () => {
        it('should not report window.top named in a message', () => {
            const findings = reviewFormPerformance({
                scripts: [toScannedScript('a.js', 'var msg = `Do not use window.parent`;')]
            });

            expect(findings.find(f => f.id === 'script-window-top')).toBeUndefined();
        });

        it('should still report window.top used inside a template expression', () => {
            const findings = reviewFormPerformance({
                scripts: [toScannedScript('a.js', 'var u = `${window.top.location.origin}/x`;')]
            });

            expect(findings.find(f => f.id === 'script-window-top')).toBeDefined();
        });
    });

    describe('control type catalogues', () => {
        it('should treat subgrids, quick views and timelines as data-driven', () => {
            expect(DATA_DRIVEN_CONTROL_TYPES).toContain('subgrid');
            expect(DATA_DRIVEN_CONTROL_TYPES).toContain('quickform');
            expect(DATA_DRIVEN_CONTROL_TYPES).toContain('timelinewall');
        });

        it('should treat iframes and web resources as deferrable', () => {
            expect(DEFERRABLE_CONTROL_TYPES).toEqual(expect.arrayContaining(['iframe', 'webresource']));
        });

        it('should not overlap', () => {
            const overlap = DEFERRABLE_CONTROL_TYPES.filter(t => DATA_DRIVEN_CONTROL_TYPES.includes(t));
            expect(overlap).toEqual([]);
        });
    });
});
