'use strict';
/**
 * @file package-all.cjs
 * @description Builds Chrome & Firefox extensions and packages each into a
 *   versioned ZIP, then archives the source tree.
 *
 * Outputs (in releases/ — git-ignored):
 *   chrome-v<version>.zip    — contents of dist/extension/
 *   firefox-v<version>.zip   — contents of dist-firefox/extension/
 *   source-v<version>.zip    — full source via `git archive`
 */

const { execSync, execFileSync } = require('child_process');
const { readFileSync, mkdirSync, readdirSync, writeFileSync, rmSync } = require('fs');
const path = require('path');
const os = require('os');

const rootDir = path.resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = `v${pkg.version}`;

const releasesDir = path.join(rootDir, 'releases');
mkdirSync(releasesDir, { recursive: true });

const chromeZip = path.join(releasesDir, `chrome-${version}.zip`);
const firefoxZip = path.join(releasesDir, `firefox-${version}.zip`);
const sourceZip = path.join(releasesDir, `source-${version}.zip`);

const opts = { cwd: rootDir, stdio: 'inherit' };

console.log(`\n📦  Power-Toolkit Full Package — ${version}\n`);

// ── 1. Build both targets ─────────────────────────────────────────────────────
console.log('⚙️   Building Chrome & Firefox…');
execSync('npm run build:all', opts);

// ── 2. Chrome extension ───────────────────────────────────────────────────────
console.log(`\n📦  Creating chrome-${version}.zip…`);
zipDir(path.join(rootDir, 'dist', 'extension'), chromeZip);

// ── 3. Firefox extension ──────────────────────────────────────────────────────
console.log(`\n📦  Creating firefox-${version}.zip…`);
zipDir(path.join(rootDir, 'dist-firefox', 'extension'), firefoxZip);

// ── 4. Source archive ─────────────────────────────────────────────────────────
console.log(`\n📦  Creating source-${version}.zip…`);
execSync(`git archive -o "${sourceZip}" HEAD`, opts);

console.log(`\n✅  All packages ready in releases/`);
console.log(`   • releases/chrome-${version}.zip`);
console.log(`   • releases/firefox-${version}.zip`);
console.log(`   • releases/source-${version}.zip\n`);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists every file under a directory as a ZIP-safe relative path.
 * @param {string} dir  - Directory to walk.
 * @param {string} base - Root the returned paths are relative to.
 * @returns {string[]} Relative paths, always forward-slash separated.
 */
function listFiles(dir, base = dir) {
    const found = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            found.push(...listFiles(full, base));
        } else {
            found.push(path.relative(base, full).split(path.sep).join('/'));
        }
    }
    return found;
}

/** Escapes a path for a single-quoted PowerShell string literal. */
function psQuote(value) {
    return value.replace(/'/g, "''");
}

/**
 * Zips the *contents* of a directory (not the directory folder itself).
 *
 * @param {string} sourceDir - Absolute path to the directory to compress.
 * @param {string} destZip   - Absolute path for the output ZIP file.
 */
function zipDir(sourceDir, destZip) {
    const files = listFiles(sourceDir);
    if (!files.length) {
        throw new Error(`Nothing to package: ${sourceDir} is empty. Did the build run?`);
    }

    const src = psQuote(sourceDir.replace(/\\/g, '/'));
    const dst = psQuote(destZip.replace(/\\/g, '/'));

    const script = [
        `$ErrorActionPreference = 'Stop'`,
        `Add-Type -AssemblyName System.IO.Compression`,
        `Add-Type -AssemblyName System.IO.Compression.FileSystem`,
        `if (Test-Path -LiteralPath '${dst}') { Remove-Item -LiteralPath '${dst}' -Force }`,
        `$zip = [System.IO.Compression.ZipFile]::Open('${dst}', 'Create')`,
        `try {`,
        ...files.map(file => '  [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile('
            + `$zip, '${src}/${psQuote(file)}', '${psQuote(file)}', `
            + '[System.IO.Compression.CompressionLevel]::Optimal)'),
        `} finally { $zip.Dispose() }`
    ].join('\n');

    const scriptPath = path.join(os.tmpdir(), `pt-zip-${process.pid}-${Date.now()}.ps1`);
    writeFileSync(scriptPath, script, 'utf8');
    try {
        execFileSync(
            'powershell',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
            { stdio: 'inherit' }
        );
    } finally {
        rmSync(scriptPath, { force: true });
    }

    assertZipEntryNames(destZip, files.length);
}

/**
 * Fails the build if an archive contains a backslash in any entry name, so a ZIP
 * Firefox will reject can never reach the releases folder unnoticed.
 * @param {string} zipPath  - Archive to inspect.
 * @param {number} expected - How many entries it should contain.
 */
function assertZipEntryNames(zipPath, expected) {
    const dst = psQuote(zipPath.replace(/\\/g, '/'));
    const names = execFileSync('powershell', [
        '-NoProfile', '-Command',
        `Add-Type -AssemblyName System.IO.Compression.FileSystem; `
        + `$z = [System.IO.Compression.ZipFile]::OpenRead('${dst}'); `
        + `try { $z.Entries | ForEach-Object { $_.FullName } } finally { $z.Dispose() }`
    ], { encoding: 'utf8' })
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    const invalid = names.filter(name => name.includes('\\'));
    if (invalid.length) {
        throw new Error(
            `${path.basename(zipPath)} has ${invalid.length} entry name(s) with backslashes, `
            + `which Firefox rejects: ${invalid.slice(0, 3).join(', ')}`
        );
    }
    if (names.length !== expected) {
        throw new Error(
            `${path.basename(zipPath)} has ${names.length} entries, expected ${expected}.`
        );
    }
    console.log(`   ✓ ${names.length} entries, all forward-slash separated`);
}
