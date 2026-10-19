/* Builds dist/fillkaro-store.zip for the Chrome Web Store: extension files only, manifest at the root.
 * Uses tar (built into Windows 10+, macOS, Linux) so paths use forward slashes. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES = ['manifest.json', 'background.js', 'popup.html', 'options.html', 'icons', 'src', 'ui'];
const out = path.join(ROOT, 'dist', 'fillkaro-store.zip');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(out, { force: true });
// on Windows use the built-in bsdtar (Git's GNU tar can't write zips)
const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
const args = process.platform === 'win32' || process.platform === 'darwin' ? ['-a', '-c', '-f'] : ['--format=zip', '-c', '-f'];
execFileSync(tar, [...args, path.relative(ROOT, out), ...FILES], { cwd: ROOT, stdio: 'inherit' });
console.log('Built', path.relative(ROOT, out), Math.round(fs.statSync(out).size / 1024) + ' KB');
