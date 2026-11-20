#!/usr/bin/env node
// Regenerates 1200x630 Open Graph cover images in public/ from built dist/ cover slides.
// Requires Google Chrome (or CHROME_PATH) and Python 3 with Pillow.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const publicDir = path.join(root, 'public');

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) throw new Error('Chrome not found. Set CHROME_PATH to a Chrome/Chromium binary.');
  return found;
}

const chrome = findChrome();

// Ensure dist/ is fresh before capturing cover slides.
execFileSync(process.execPath, [path.join(root, 'scripts', 'build.mjs')], { stdio: 'inherit' });

const locales = fs.readdirSync(path.join(src, 'locales'))
  .filter(file => file.endsWith('.json'))
  .map(file => JSON.parse(fs.readFileSync(path.join(src, 'locales', file), 'utf8')))
  .sort((a, b) => a.output.split('/').length - b.output.split('/').length || a.lang.localeCompare(b.lang));

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-og-'));
try {
  // Capture all locales before writing into public/, so an active `npm run dev` watcher
  // rebuilding dist/ on public/ changes cannot remove dist/en/index.html mid-run.
  const pending = [];
  for (const locale of locales) {
    const ogImage = locale.meta?.ogImage;
    if (!ogImage) continue;
    const raw = path.join(tmpDir, `${locale.lang}.png`);
    const cropped = path.join(tmpDir, `${locale.lang}-og.png`);
    const url = `${pathToFileURL(path.join(dist, locale.output)).href}#slide-1`;

    execFileSync(chrome, [
      '--headless=new',
      '--no-first-run',
      `--user-data-dir=${path.join(tmpDir, `profile-${locale.lang}`)}`,
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--window-size=1440,888',
      '--virtual-time-budget=3000',
      `--screenshot=${raw}`,
      url,
    ], { stdio: 'pipe' });

    execFileSync('python3', [
      '-c',
      'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("RGB").crop((0,27,1440,783)).resize((1200,630), Image.LANCZOS).save(sys.argv[2], optimize=True)',
      raw,
      cropped,
    ], { stdio: 'inherit' });

    pending.push({ cropped, ogImage });
  }
  for (const { cropped, ogImage } of pending) {
    fs.copyFileSync(cropped, path.join(publicDir, ogImage));
    console.log(`updated public/${ogImage}`);
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
