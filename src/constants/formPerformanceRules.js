/**
 * @file Form performance review rules, grounded in Microsoft Learn guidance.
 * @module constants/formPerformanceRules
 * @description The rule catalogue behind the Performance tab's review. Every rule links back to the
 * Microsoft Learn page that documents it, so a maker can verify the finding rather than take it on
 * trust — the same contract the Copilot Studio instruction review uses.
 *
 * Rules are pure: they read a snapshot of the form and return findings. Nothing here touches the
 * DOM, the Xrm API, or the network.
 */

/**
 * The Microsoft Learn pages the rules are grounded in. Anchors point at the exact section so a
 * finding lands on the paragraph that justifies it.
 */
export const PERF_DOCS = {
    /** Design forms for performance — the top-level guidance for form load. */
    performantForms: 'https://learn.microsoft.com/power-apps/maker/model-driven-apps/design-performant-forms',
    /** "Significance of the default tab" — controls on the default tab always initialize on load. */
    defaultTab: 'https://learn.microsoft.com/power-apps/maker/model-driven-apps/design-performant-forms#significance-of-the-default-tab',
    /** "Data-driven controls" — subgrids, quick views, timelines fetch over the network. */
    dataControls: 'https://learn.microsoft.com/power-apps/maker/model-driven-apps/design-performant-forms#data-driven-controls',
    /** "Don't open new windows". */
    newWindows: 'https://learn.microsoft.com/power-apps/maker/model-driven-apps/design-performant-forms#dont-open-new-windows',
    /** "Remove usage of console APIs in production code". */
    consoleApis: 'https://learn.microsoft.com/power-apps/maker/model-driven-apps/design-performant-forms#remove-usage-of-console-apis-in-production-code',
    /** "Avoid memory leaks" — timers, listeners, and global references. */
    memoryLeaks: 'https://learn.microsoft.com/power-apps/maker/model-driven-apps/design-performant-forms#avoid-memory-leaks',
    /** "Load code only when it's needed". */
    loadCode: 'https://learn.microsoft.com/power-apps/maker/model-driven-apps/design-performant-forms#load-code-only-when-its-needed',
    /** "Limit the amount of data requested during form load". */
    limitData: 'https://learn.microsoft.com/power-apps/maker/model-driven-apps/design-performant-forms#limit-the-amount-of-data-requested-during-form-load',
    /** Mobile object limits — 5 tabs / 75 columns / 10 subgrids. */
    mobileLimits: 'https://learn.microsoft.com/power-apps/maker/model-driven-apps/main-form-presentations#form-elements',
    /** Solution checker rule web-use-async (Category: Performance, Impact potential: High). */
    asyncRequests: 'https://learn.microsoft.com/power-apps/developer/model-driven-apps/best-practices/business-logic/interact-http-https-resources-asynchronously',
    /** Best practice: avoid window.top (Impact potential: High). */
    windowTop: 'https://learn.microsoft.com/power-apps/developer/model-driven-apps/best-practices/business-logic/avoid-window-top',
    /** Best practice: the OData v2.0 endpoint is deprecated. */
    odataV2: 'https://learn.microsoft.com/power-apps/developer/model-driven-apps/best-practices/business-logic/do-not-use-odata-v2-endpoint',
    /** Best practice: disable the NavBar when opening forms or views by URL. */
    navBar: 'https://learn.microsoft.com/power-apps/developer/model-driven-apps/best-practices/business-logic/consider-disabling-navbar-programmatically-opening-entity-forms-views'
};

/**
 * Documented mobile object limits for a main form.
 * Docs: "To optimize performance on mobile devices, the number of objects is limited to 5 tabs or
 * 75 columns and 10 subgrids."
 */
export const MOBILE_LIMITS = Object.freeze({ tabs: 5, columns: 75, subgrids: 10 });

/**
 * Thresholds the docs describe qualitatively rather than numerically ("keep only the most
 * frequently used", "too many fields"). The numbers are the toolkit's, not Microsoft's, and every
 * message that uses one says so — a finding must never imply a limit that Microsoft didn't publish.
 */
export const REVIEW_THRESHOLDS = Object.freeze({
    /** Data-driven controls (subgrid / quick view / timeline) on the default tab. */
    defaultTabDataControls: 3,
    /** Controls of any kind on the default tab. */
    defaultTabControls: 40,
    /** OnChange handlers across the form. */
    onChangeHandlers: 25,
    /** Form load time, in milliseconds. */
    loadTimeWarnMs: 2000,
    loadTimeBadMs: 4000
});

/**
 * Control types that fetch their own data over the network. Docs list quick view form, subgrid,
 * timeline and the Sales Insights assistant as the controls that "produce the most strain on form
 * responsiveness and loading speed".
 */
export const DATA_DRIVEN_CONTROL_TYPES = Object.freeze([
    'subgrid', 'customsubgrid', 'quickform', 'timelinewall', 'timercontrol', 'kbsearch'
]);

/**
 * Control types the docs call "less impactful than the data-driven controls" but still worth moving
 * off the default tab: lookup, iFrame and web resource.
 */
export const DEFERRABLE_CONTROL_TYPES = Object.freeze(['iframe', 'webresource']);

/** Readable names for the control types a finding reports. @private */
const CONTROL_TYPE_LABELS = Object.freeze({
    subgrid: 'subgrid',
    customsubgrid: 'subgrid',
    quickform: 'quick view form',
    timelinewall: 'timeline',
    timercontrol: 'timer',
    kbsearch: 'knowledge search',
    iframe: 'iFrame',
    webresource: 'web resource',
    lookup: 'lookup'
});

// ═══════════════════════════════════════════════════════════
// SCRIPT PATTERNS
// ═══════════════════════════════════════════════════════════

/**
 * `console.*` calls. Comment lines are stripped before the scan, so a commented-out call does not
 * fire the rule. @private
 */
const CONSOLE_RE = /\bconsole\s*\.\s*(?:log|info|warn|error|debug|trace|dir|table|time|timeEnd|group)\s*\(/g;

/**
 * A synchronous XMLHttpRequest: the `async` argument of `open` set to false. Docs list this first
 * under "Problematic patterns".
 *
 * Matched on argument shape rather than on the method name, because the scanned source has its
 * string literals blanked out. `async` is XHR's third argument, so the pattern requires two
 * arguments before the `false` — that keeps an unrelated two-argument `something.open(opts, false)`
 * out of what is an error-severity finding. @private
 */
const SYNC_XHR_RE = /\.\s*open\s*\([^(),]*,[^(),]*,\s*false\s*[),]/g;

/** jQuery's `async: false`, the second documented problematic pattern. @private */
const SYNC_AJAX_RE = /\basync\s*:\s*false\b/g;

/** `window.top` and the parent hierarchy — the docs note `window.parent` causes the same symptoms. @private */
const WINDOW_TOP_RE = /\bwindow\s*\.\s*(?:top|parent)\b/g;

/** Opening a new browser window, which cannot reuse the client cache. @private */
const WINDOW_OPEN_RE = /\bwindow\s*\.\s*open\s*\(/g;

/** `openForm` asked to use a new window (openInNewWindow / windowPosition on the options object). @private */
const OPEN_FORM_NEW_WINDOW_RE = /\bopenInNewWindow\s*:\s*true\b/g;

/** A repeating timer. Paired with a clearInterval check before it is reported. @private */
const SET_INTERVAL_RE = /\bsetInterval\s*\(/g;

/** Clearing a timer — presence anywhere in the library is treated as the cleanup. @private */
const CLEAR_INTERVAL_RE = /\bclearInterval\s*\(/;

/** A listener attached to window, which outlives the form unless it is removed. @private */
const WINDOW_LISTENER_RE = /\bwindow\s*\.\s*addEventListener\s*\(/g;

/** Removing a window listener. @private */
const WINDOW_LISTENER_CLEANUP_RE = /\bwindow\s*\.\s*removeEventListener\s*\(/;

/** The deprecated OData v2.0 (2011) endpoint. @private */
const ODATA_V2_RE = /XRMServices\/2011\/OrganizationData\.svc/g;

/** Opening a form or view by URL without suppressing the navigation bar. @private */
const NAVBAR_RE = /\bnavbar\s*=\s*(?:on|["']on["'])/gi;

/**
 * Strips line and block comments. Deliberately simple: it errs toward removing too much, which
 * costs a missed finding rather than a false accusation.
 * @param {string} source - Raw JavaScript.
 * @returns {string} Source without comments.
 * @private
 */
function _stripComments(source) {
    return String(source || '')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        // The `[^:]` guard keeps `https://` from being read as a line comment.
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/**
 * Blanks out string literals so a pattern *named* in a message or a log string is not reported as
 * live code. Rules that must look inside strings — endpoint URLs, query-string switches — read the
 * comment-stripped text instead.
 *
 * Template literals are reduced to their `${...}` expressions: the text around them is prose and
 * must not be scanned, but the expressions are live code and routinely hold the very things the
 * rules look for (`` `${window.top.location.href}` ``). Keeping only the expressions errs toward a
 * missed finding rather than accusing a script of something that is only a sentence in a message.
 * @param {string} source - Source without comments.
 * @returns {string} Source with string literals emptied.
 * @private
 */
function _stripStrings(source) {
    return String(source || '')
        // Templates first, so quotes inside a `${...}` expression are blanked by the passes below.
        .replace(/`(?:\\.|[^`\\])*`/g, literal => (literal.match(/\$\{[^{}]*\}/g) || []).join(' '))
        .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
        .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

/**
 * Counts non-overlapping matches of a global pattern.
 * @param {RegExp} pattern - A regex with the global flag.
 * @param {string} text - The text to search.
 * @returns {number} Match count.
 * @private
 */
function _countMatches(pattern, text) {
    pattern.lastIndex = 0;
    let count = 0;
    while (pattern.exec(text) !== null) {
        count += 1;
    }
    return count;
}

/**
 * Runs a script pattern across every scanned library and reports which ones matched.
 * @param {ScannedScript[]} scripts - Libraries with their prepared source.
 * @param {RegExp} pattern - Global pattern to count.
 * @param {object} [options] - Scan options.
 * @param {(script: ScannedScript) => boolean} [options.skip] - Returns true to exempt a library.
 * @param {'code'|'text'} [options.field='code'] - Which view to search. `code` has string literals
 *   blanked out; `text` keeps them, for rules that look for an endpoint or a URL switch.
 * @returns {{names: string[], total: number}|null} Hit summary, or null when nothing matched.
 * @private
 */
function _scanScripts(scripts, pattern, options = {}) {
    const { skip, field = 'code' } = options;
    const names = [];
    let total = 0;

    for (const script of scripts) {
        if (skip?.(script)) {
            continue;
        }
        const hits = _countMatches(pattern, script[field] ?? script.code ?? '');
        if (hits > 0) {
            names.push(script.name);
            total += hits;
        }
    }

    return total > 0 ? { names, total } : null;
}

/**
 * Runs several patterns for one rule and merges what they find.
 *
 * The alternative — `_scanScripts(a) || _scanScripts(b)` — reports only whichever pattern matched
 * first, so a library whose only problem matches the second pattern is never named at all.
 * @param {ScannedScript[]} scripts - Libraries with their prepared source.
 * @param {Array<RegExp|[RegExp, object]>} patterns - Patterns, optionally with per-pattern options.
 * @returns {{names: string[], total: number}|null} Merged hit summary, or null when nothing matched.
 * @private
 */
function _scanAny(scripts, patterns) {
    const names = new Set();
    let total = 0;

    for (const entry of patterns) {
        const [pattern, options] = Array.isArray(entry) ? entry : [entry, undefined];
        const hit = _scanScripts(scripts, pattern, options);
        if (hit) {
            hit.names.forEach(name => names.add(name));
            total += hit.total;
        }
    }

    return total > 0 ? { names: [...names], total } : null;
}

/**
 * Renders a library list for a message, capped so one bad solution can't produce a wall of text.
 * @param {string[]} names - Library names.
 * @returns {string} A readable list.
 * @private
 */
function _listScripts(names) {
    if (names.length <= 3) {
        return names.join(', ');
    }
    return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}

/**
 * Pluralizes a count.
 * @param {number} count - The count.
 * @param {string} word - Singular noun.
 * @returns {string} "1 tab" / "3 tabs".
 * @private
 */
function _plural(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/**
 * Names a control type for a message.
 * @param {string} type - Raw control type.
 * @returns {string} Readable label.
 * @private
 */
function _controlLabel(type) {
    return CONTROL_TYPE_LABELS[type] || type;
}

/**
 * Summarizes a control-type tally as "3 subgrids, 1 timeline". Types that share a label are merged
 * first — a standard and a custom subgrid are both "subgrid", and reporting them as "2 subgrids,
 * 1 subgrid" would read like a bug.
 * @param {Record<string, number>} tally - Control type to count.
 * @returns {string} Readable summary.
 * @private
 */
function _describeControls(tally) {
    const byLabel = new Map();

    for (const [type, count] of Object.entries(tally)) {
        if (count > 0) {
            const label = _controlLabel(type);
            byLabel.set(label, (byLabel.get(label) || 0) + count);
        }
    }

    return [...byLabel.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => _plural(count, label))
        .join(', ');
}

// ═══════════════════════════════════════════════════════════
// RULES
// ═══════════════════════════════════════════════════════════

/**
 * A scanned form library, prepared in two views so a rule can look at code shape or at string
 * content without the other producing false findings.
 * @typedef {object} ScannedScript
 * @property {string} name - Web resource name.
 * @property {string} code - Comments removed and string literals blanked out.
 * @property {string} text - Comments removed, string literals intact.
 */

/**
 * What a rule reads. Everything is optional so a partial snapshot degrades to fewer findings rather
 * than throwing.
 * @typedef {object} FormPerformanceSnapshot
 * @property {number} [totalLoadTime] - Total form load in milliseconds.
 * @property {boolean} [isApiAvailable] - Whether Xrm.Performance supplied the timing.
 * @property {{network:number, server:number, client:number}} [breakdown] - Load time split.
 * @property {{tabs:number, sections:number, controls:number, onChange:number}} [uiCounts] - Totals.
 * @property {Record<string, number>} [controlTypes] - Control type to count, whole form.
 * @property {object} [defaultTab] - The first expanded visible tab.
 * @property {string} [defaultTab.label] - Its label.
 * @property {number} [defaultTab.controls] - Controls on it.
 * @property {Record<string, number>} [defaultTab.dataControls] - Data-driven control tally.
 * @property {Record<string, number>} [defaultTab.deferrable] - iFrame / web resource tally.
 * @property {ScannedScript[]} [scripts] - Scanned libraries. Absent means scripts were not read,
 *   which disables every script rule rather than reporting them as clean.
 */

/**
 * A single finding.
 * @typedef {object} PerformanceFinding
 * @property {string} id - Stable rule id.
 * @property {'error'|'warn'|'info'} severity - How hard the guidance is.
 * @property {string} message - What to do, naming what was found on this form.
 * @property {string} reason - Why, quoting or paraphrasing the documented rationale.
 * @property {string} docUrl - The Microsoft Learn page that documents the rule.
 * @property {boolean} [needsScripts] - True when the rule only runs after a script scan.
 */

/**
 * The rule catalogue. `test` returns a falsy value when the rule passes, or a truthy value handed to
 * `message` when it fires. `needsScripts` marks the rules that require a script scan.
 * @private
 */
const REVIEW_RULES = [
    // ═══ Documented platform limits ════════════════════════════════════════════════
    {
        id: 'mobile-tabs',
        severity: 'warn',
        doc: 'mobileLimits',
        test: (s) => {
            const tabs = s.uiCounts?.tabs || 0;
            return tabs > MOBILE_LIMITS.tabs ? tabs : null;
        },
        message: (tabs) => `Reduce the form to ${MOBILE_LIMITS.tabs} tabs for mobile — it has ${tabs}.`,
        reason: `Docs: "To optimize performance on mobile devices, the number of objects is limited to ${MOBILE_LIMITS.tabs} tabs or ${MOBILE_LIMITS.columns} columns and ${MOBILE_LIMITS.subgrids} subgrids." Past the limit the phone and tablet apps stop rendering the extra objects.`
    },
    {
        id: 'mobile-columns',
        severity: 'warn',
        doc: 'mobileLimits',
        // Counted in columns (bound attributes), which is how the limit is stated — a subgrid is a
        // control but not a column. Falls back to the control count for a snapshot without it.
        test: (s) => {
            const columns = s.uiCounts?.columns ?? s.uiCounts?.controls ?? 0;
            return columns > MOBILE_LIMITS.columns ? columns : null;
        },
        message: (columns) => `Trim the form below ${MOBILE_LIMITS.columns} columns for mobile — it has ${columns}.`,
        reason: `Docs cap a mobile-rendered main form at ${MOBILE_LIMITS.columns} columns. Splitting rarely used columns onto a second form keeps the mobile experience intact.`
    },
    {
        id: 'mobile-subgrids',
        severity: 'warn',
        doc: 'mobileLimits',
        test: (s) => {
            const subgrids = (s.controlTypes?.subgrid || 0) + (s.controlTypes?.customsubgrid || 0);
            return subgrids > MOBILE_LIMITS.subgrids ? subgrids : null;
        },
        message: (subgrids) => `Reduce the form to ${MOBILE_LIMITS.subgrids} subgrids for mobile — it has ${subgrids}.`,
        reason: `Docs cap a mobile-rendered main form at ${MOBILE_LIMITS.subgrids} subgrids, and each one renders as its own panel.`
    },

    // ═══ Default tab: the controls that always initialize ══════════════════════════
    {
        id: 'default-tab-data-controls',
        severity: 'warn',
        doc: 'dataControls',
        test: (s) => {
            const tally = s.defaultTab?.dataControls || {};
            const total = Object.values(tally).reduce((sum, n) => sum + n, 0);
            return total >= REVIEW_THRESHOLDS.defaultTabDataControls ? { tally, total } : null;
        },
        message: ({ tally, total }, s) => `Move some of the ${total} data-driven controls off "${s.defaultTab.label}" — it holds ${_describeControls(tally)}, and each fetches its own data before the form is usable.`,
        reason: 'Docs: data-driven controls "produce the most strain on form responsiveness and loading speed". Keep only the most frequently used on the default tab and move the rest to secondary tabs, which do not initialize until opened.'
    },
    {
        id: 'default-tab-deferrable',
        severity: 'info',
        doc: 'dataControls',
        test: (s) => {
            const tally = s.defaultTab?.deferrable || {};
            const total = Object.values(tally).reduce((sum, n) => sum + n, 0);
            return total > 0 ? { tally, total } : null;
        },
        message: ({ tally }, s) => `Consider moving the ${_describeControls(tally)} off "${s.defaultTab.label}" to a secondary tab.`,
        reason: 'Docs name iFrames and web resources as less impactful than data-driven controls but still worth placing on a secondary tab, where they load only when the tab is opened.'
    },
    {
        id: 'default-tab-controls',
        severity: 'info',
        doc: 'defaultTab',
        test: (s) => {
            const controls = s.defaultTab?.controls || 0;
            return controls >= REVIEW_THRESHOLDS.defaultTabControls ? controls : null;
        },
        message: (controls, s) => `"${s.defaultTab.label}" initializes ${_plural(controls, 'control')} on every form load. Keep the most-used at the top and move the rest to secondary tabs.`,
        reason: 'Docs: "the controls of the default tab are always rendered when opening a record" and control initialization runs for every one of them. A secondary tab defers that work until the tab is opened.'
    },

    // ═══ Measured load time ════════════════════════════════════════════════════════
    {
        id: 'load-time',
        severity: 'warn',
        doc: 'performantForms',
        test: (s) => {
            const total = Number(s.totalLoadTime) || 0;
            return total >= REVIEW_THRESHOLDS.loadTimeWarnMs ? total : null;
        },
        severityOf: (total) => (total >= REVIEW_THRESHOLDS.loadTimeBadMs ? 'error' : 'warn'),
        message: (total) => `This form took ${total} ms to load. Anything above roughly ${REVIEW_THRESHOLDS.loadTimeWarnMs} ms is worth investigating — the threshold is the toolkit's, not Microsoft's.`,
        reason: 'Docs: "Performance has been shown to be a key driver of dissatisfaction of an app when it is not optimized for performance." Use the breakdown below to see whether server, network, or client time dominates.'
    },
    {
        id: 'server-dominant',
        severity: 'info',
        doc: 'limitData',
        test: (s) => {
            const { server = 0, network = 0, client = 0 } = s.breakdown || {};
            return s.isApiAvailable && server > client && server > network ? server : null;
        },
        message: (server) => `Server processing dominates this load (${server} ms). Review synchronous plug-ins and real-time workflows that run on retrieve.`,
        reason: 'Time spent server-side is not fixed by form layout. Plug-ins registered on Retrieve, real-time workflows, and calculated or rollup columns all add to it.'
    },
    {
        id: 'client-dominant',
        severity: 'info',
        doc: 'performantForms',
        test: (s) => {
            const { server = 0, network = 0, client = 0 } = s.breakdown || {};
            return s.isApiAvailable && client > server && client > network ? client : null;
        },
        message: (client) => `Client rendering dominates this load (${client} ms). Look at form scripts and control count before anything server-side.`,
        reason: 'Client time covers script execution and control initialization — the two things form design and JavaScript customization directly control.'
    },
    {
        id: 'network-dominant',
        severity: 'info',
        doc: 'limitData',
        test: (s) => {
            const { server = 0, network = 0, client = 0 } = s.breakdown || {};
            return s.isApiAvailable && network > Math.max(server, client) ? network : null;
        },
        message: (network) => `Network transfer dominates this load (${network} ms). Request only the columns the form's logic needs.`,
        reason: 'Docs: "Only request the minimum amount of data that is necessary to perform business logic on a form", and cache values that rarely change in sessionStorage.'
    },
    {
        id: 'onchange-handlers',
        severity: 'info',
        doc: 'loadCode',
        test: (s) => {
            const count = s.uiCounts?.onChange || 0;
            return count >= REVIEW_THRESHOLDS.onChangeHandlers ? count : null;
        },
        message: (count) => `${_plural(count, 'OnChange handler')} are registered on this form. Load the libraries they need in OnChange rather than OnLoad.`,
        reason: 'Docs: "Avoid loading libraries in the OnLoad event if they are only used for the OnChange or OnSave events" — the platform can then defer loading them until after the form is up.'
    },

    // ═══ Script rules — only run once the libraries have been read ═════════════════
    {
        id: 'script-sync-request',
        severity: 'error',
        doc: 'asyncRequests',
        needsScripts: true,
        test: (s) => _scanAny(s.scripts, [SYNC_XHR_RE, SYNC_AJAX_RE]),
        message: (hit) => `Make the ${_plural(hit.total, 'synchronous request')} in ${_listScripts(hit.names)} asynchronous.`,
        reason: 'Solution checker rule web-use-async — Category: Performance, Impact potential: High. Docs: "Synchronous requests block the execution of other scripts", freezing the browser until the call returns. Synchronous XMLHttpRequest is also deprecated and may throw in future browsers.'
    },
    {
        id: 'script-window-top',
        severity: 'error',
        doc: 'windowTop',
        needsScripts: true,
        test: (s) => _scanScripts(s.scripts, WINDOW_TOP_RE),
        message: (hit) => `Remove the ${_plural(hit.total, 'window.top / window.parent reference')} in ${_listScripts(hit.names)}.`,
        reason: 'Best practice: avoid window.top — Impact potential: High. Docs: it throws "Blocked a frame with origin … from accessing a cross-origin frame" in App for Outlook, phones and tablets, and any host that embeds Dataverse in an iframe. window.parent has the same symptoms.'
    },
    {
        id: 'script-odata-v2',
        severity: 'error',
        doc: 'odataV2',
        needsScripts: true,
        // The endpoint is always inside a string literal, so this reads the text view.
        test: (s) => _scanScripts(s.scripts, ODATA_V2_RE, { field: 'text' }),
        message: (hit) => `Move ${_listScripts(hit.names)} off the OData v2.0 endpoint to the Web API.`,
        reason: 'Docs: the 2011 OData v2.0 endpoint (/XRMServices/2011/OrganizationData.svc) is deprecated. Code using it should be upgraded to the Web API OData v4.0 endpoint.'
    },
    {
        id: 'script-console',
        severity: 'warn',
        doc: 'consoleApis',
        needsScripts: true,
        test: (s) => _scanScripts(s.scripts, CONSOLE_RE),
        message: (hit) => `Remove the ${_plural(hit.total, 'console call')} from ${_listScripts(hit.names)} before shipping.`,
        reason: 'Docs: "Logging data to the console can significantly increase memory demand and might prevent data from being cleaned up in memory. This can lead to the app becoming slower over time and eventually crashing."'
    },
    {
        id: 'script-new-window',
        severity: 'warn',
        doc: 'newWindows',
        needsScripts: true,
        // openInNewWindow lives on an options object, so it survives into the code view either way.
        test: (s) => _scanAny(s.scripts, [WINDOW_OPEN_RE, OPEN_FORM_NEW_WINDOW_RE]),
        message: (hit) => `${_listScripts(hit.names)} opens a new browser window. Use the existing window, or the multisession experience.`,
        reason: 'Docs: "Opening a new window means that all of the page resources need to be fetched and loaded from scratch since the page is unable to leverage the in-memory data caching capabilities."'
    },
    {
        id: 'script-timers',
        severity: 'warn',
        doc: 'memoryLeaks',
        needsScripts: true,
        // A library that also calls clearInterval is assumed to clean up after itself.
        test: (s) => _scanScripts(s.scripts, SET_INTERVAL_RE, {
            skip: (script) => CLEAR_INTERVAL_RE.test(script.code)
        }),
        message: (hit) => `${_listScripts(hit.names)} starts a repeating timer with no matching clearInterval.`,
        reason: 'Docs list "Cleanup all timers like setInterval" among the steps that prevent memory leaks. A timer left running outlives the form and keeps its closure alive, so the app slows over a long session and eventually crashes.'
    },
    {
        id: 'script-window-listeners',
        severity: 'warn',
        doc: 'memoryLeaks',
        needsScripts: true,
        test: (s) => _scanScripts(s.scripts, WINDOW_LISTENER_RE, {
            skip: (script) => WINDOW_LISTENER_CLEANUP_RE.test(script.code)
        }),
        message: (hit) => `${_listScripts(hit.names)} adds a window event listener that is never removed.`,
        reason: 'Docs: "Cleanup all event listeners and subscriptions, especially if it\'s on the window object." A listener on window survives navigation between records and holds on to everything it closes over.'
    },
    {
        id: 'script-navbar',
        severity: 'info',
        doc: 'navBar',
        needsScripts: true,
        // navbar=on lives in a URL string, so this reads the text view.
        test: (s) => _scanScripts(s.scripts, NAVBAR_RE, { field: 'text' }),
        message: (hit) => `${_listScripts(hit.names)} opens a page with the navigation bar enabled. Pass navbar=off unless the user needs it.`,
        reason: 'Docs: opening forms or views by URL with the navigation bar enabled loads extra resources, which is slower on high-latency networks.'
    }
];

/**
 * Builds one finding, or null when the rule passes.
 * @param {object} rule - The rule.
 * @param {FormPerformanceSnapshot} snapshot - The form snapshot.
 * @returns {PerformanceFinding|null} The finding.
 * @private
 */
function _buildFinding(rule, snapshot) {
    const hit = rule.test(snapshot);
    if (!hit) {
        return null;
    }
    return {
        id: rule.id,
        // A rule may grade itself from what it found — a 5-second load is not the same finding as
        // a 2-second one.
        severity: rule.severityOf ? rule.severityOf(hit) : rule.severity,
        message: typeof rule.message === 'function' ? rule.message(hit, snapshot) : rule.message,
        reason: rule.reason,
        docUrl: PERF_DOCS[rule.doc],
        needsScripts: !!rule.needsScripts
    };
}

/**
 * Whether a rule can run against the snapshot it was given. Script rules are skipped — not passed —
 * when the libraries have not been read, so an unscanned form never reports a clean bill of health
 * it hasn't earned.
 * @param {object} rule - The rule.
 * @param {FormPerformanceSnapshot} snapshot - The snapshot.
 * @returns {boolean} True when the rule should run.
 * @private
 */
function _ruleRuns(rule, snapshot) {
    return !rule.needsScripts || Array.isArray(snapshot.scripts);
}

/**
 * Reviews a form against the documented performance guidance.
 *
 * Pure and deterministic: the same snapshot always produces the same findings, most severe first.
 * An empty array means every applicable rule passed.
 * @param {FormPerformanceSnapshot} snapshot - The form snapshot. Supply `scripts` to enable the
 *   script rules; omit it and they are skipped rather than reported as passing.
 * @returns {PerformanceFinding[]} Findings, most severe first.
 */
export function reviewFormPerformance(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        return [];
    }
    const order = { error: 0, warn: 1, info: 2 };
    return REVIEW_RULES
        .filter(rule => _ruleRuns(rule, snapshot))
        .map(rule => _buildFinding(rule, snapshot))
        .filter(Boolean)
        .sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * How many rules a review actually ran, so an all-clear can say what it checked.
 * @param {boolean} [withScripts=false] - Whether the form's libraries were scanned.
 * @returns {number} The number of rules that ran.
 */
export function countFormPerformanceRules(withScripts = false) {
    return REVIEW_RULES.filter(rule => withScripts || !rule.needsScripts).length;
}

/**
 * Prepares a library for scanning: comments removed, in a code view (string literals blanked) and a
 * text view (literals intact, for endpoint and URL rules).
 * @param {string} name - Web resource name.
 * @param {string} source - Raw JavaScript.
 * @returns {ScannedScript} The scannable script.
 */
export function toScannedScript(name, source) {
    const text = _stripComments(source);
    return { name: String(name || ''), code: _stripStrings(text), text };
}
