'use strict';
/**
 * @file package-full.cjs
 * @description Builds Chrome & Firefox extensions and packages each into a
 *   versioned ZIP, then archives the source tree.
 *
 * Outputs (in releases/ — git-ignored):
 *   chrome-v<version>.zip    — contents of dist/extension/
 *   firefox-v<version>.zip   — contents of dist-firefox/extension/
 *   source-v<version>.zip    — full source via `git archive`
 */

const { execSync, spawnSync } = require('child_process');
const { readFileSync, mkdirSync } = require('fs');
const path = require('path');

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
 * Zips the *contents* of a directory (not the directory folder itself) into a
 * ZIP file using System.IO.Compression.ZipFile via PowerShell.
 *
 * @param {string} sourceDir - Absolute path to the directory to compress.
 * @param {string} destZip   - Absolute path for the output ZIP file.
 */
function zipDir(sourceDir, destZip) {
    // Normalise to forward-slashes; PowerShell accepts them and it avoids
    // backslash-escape headaches inside the single-quoted PS string literals.
    const src = sourceDir.replace(/\\/g, '/');
    const dst = destZip.replace(/\\/g, '/');

    const ps = [
        `Add-Type -AssemblyName System.IO.Compression.FileSystem`,
        `if (Test-Path '${dst}') { Remove-Item -LiteralPath '${dst}' }`,
        `[System.IO.Compression.ZipFile]::CreateFromDirectory('${src}', '${dst}')`,
    ].join('; ');

    execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'inherit' });
}
