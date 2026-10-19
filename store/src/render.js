/* Renders store/src/shots.html into the Chrome Web Store image sizes with headless Chrome,
 * then flattens them to 24-bit PNG (no alpha) with Python Pillow. Run: node store/src/render.js */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome'
].find(p => fs.existsSync(p));
if (!CHROME) throw new Error('Chrome not found');

const SRC = pathToFileURL(path.join(__dirname, 'shots.html')).href;
const OUT = path.join(__dirname, '..', 'images');
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [
  ['fill', 'screenshot-1-fill.png', 1280, 800],
  ['preview', 'screenshot-2-preview.png', 1280, 800],
  ['details', 'screenshot-3-details.png', 1280, 800],
  ['safety', 'screenshot-4-safety.png', 1280, 800],
  ['promo-small', 'promo-small-440x280.png', 440, 280],
  ['promo-marquee', 'promo-marquee-1400x560.png', 1400, 560]
];

for (const [id, file, w, h] of SHOTS) {
  const out = path.join(OUT, file);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--allow-file-access-from-files', '--force-color-profile=srgb', '--default-background-color=ffffffff',
    `--window-size=${w},${h}`, `--screenshot=${out}`, `${SRC}#${id}`], { stdio: 'ignore' });
  // strip alpha + make sure the size is exact
  execFileSync('python', ['-I', '-c',
    'import sys;from PIL import Image;p,w,h=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]);im=Image.open(p).convert("RGB").crop((0,0,w,h));im.save(p,"PNG");print(p,im.size,im.mode)',
    out, String(w), String(h)], { stdio: 'inherit' });
}
