/**
 * @file Guards the impersonation boundary across the whole source tree.
 * @module tests/services/impersonation-scope.test.js
 * @description Impersonation is applied by `WebApiService`. Any module that calls `fetch` directly
 * builds its own headers, and every time that happened the impersonation header was forgotten —
 * paging, Custom API execution and file upload all silently ran as the signed-in user while the UI
 * said otherwise. This test makes that mistake impossible to reintroduce quietly.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

// Resolved from the working directory, not import.meta.url: tests/setup.js replaces global.URL with
// a stub that recurses if constructed here.
const SRC_ROOT = resolve(process.cwd(), 'src');

/**
 * Modules allowed to call `fetch` directly, each with the reason it is exempt.
 * Adding an entry here is a deliberate act that a reviewer will see.
 */
const ALLOWED_DIRECT_FETCH = {
    'services/WebApiService.js': 'owns header construction, including the impersonation header',
    'services/CustomApiService.js': 'builds headers via WebApiService.buildHeaders (function vs action URLs differ)',
    'services/FileUploadService.js': 'builds headers via WebApiService.buildHeaders (chunked block upload)',
    'services/CommandBarAnalysisService.js': 'ribbon metadata is user-independent; headers via WebApiService.buildHeaders'
};

/**
 * Matches a real `fetch(` call with an argument.
 * Deliberately excludes: `webApiFetch(`/`.fetch(` (word or member prefix), `<fetch(` (FetchXML regex
 * literals), and `fetch()` with empty parens (the word in generated-code prose).
 */
const DIRECT_FETCH = /(^|[^.\w<])fetch\s*\(\s*[^)\s]/;

/** Lines that are comments carry documentation, not calls. */
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/;

/**
 * Collects every .js file under a directory.
 * @param {string} dir - Directory to walk
 * @returns {string[]} Absolute file paths
 */
function collectJsFiles(dir) {
    return readdirSync(dir).flatMap(entry => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            return collectJsFiles(full);
        }
        return full.endsWith('.js') ? [full] : [];
    });
}

describe('impersonation scope', () => {
    const files = collectJsFiles(SRC_ROOT);

    it('should find source files to scan', () => {
        expect(files.length).toBeGreaterThan(50);
    });

    it('should not call fetch directly outside the allow-list', () => {
        const offenders = files.filter(file => {
            const key = relative(SRC_ROOT, file).split(sep).join('/');
            if (ALLOWED_DIRECT_FETCH[key]) {
                return false;
            }
            return readFileSync(file, 'utf8')
                .split('\n')
                .filter(line => !COMMENT_LINE.test(line))
                // Code-generation templates emit fetch(...) as text for the user to copy, not to run.
                .filter(line => !line.includes('code +=') && !line.includes('lines.push'))
                .some(line => DIRECT_FETCH.test(line));
        });

        expect(offenders.map(f => relative(SRC_ROOT, f).split(sep).join('/'))).toEqual([]);
    });

    it('should build headers through WebApiService in every allow-listed module', () => {
        const missing = Object.keys(ALLOWED_DIRECT_FETCH)
            .filter(key => key !== 'services/WebApiService.js')
            .filter(key => !readFileSync(join(SRC_ROOT, key), 'utf8').includes('WebApiService.buildHeaders('));

        expect(missing).toEqual([]);
    });
});
