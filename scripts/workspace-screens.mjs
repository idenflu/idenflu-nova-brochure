#!/usr/bin/env node
// Renders the NOVA Workspace concept screens from assets-src/workspace/screens.html.
//   lossless originals → assets-src/workspace/png/<name>-<lang>.png
//   deck images        → public/media/workspace/<name>-<lang>.webp
// Edit screens.html (layout, copy, sample data) and re-run; never edit the images by hand.
// Usage: node scripts/workspace-screens.mjs [name ...]   (no args = all screens)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'assets-src', 'workspace', 'screens.html');
const pngDir = path.join(root, 'assets-src', 'workspace', 'png');
const webpDir = path.join(root, 'public', 'media', 'workspace');

// name, screen, CSS viewport. Aspect ratios match the image slots on each slide (rendered at 2x).
const SPECS = [
  { name: 'waves-wide', screen: 'waves', width: 1920, height: 1011 }, // slide 4  (1.9:1)
  { name: 'overview', screen: 'overview', width: 1440, height: 1058 }, // slide 11 (1.36:1)
  { name: 'waves', screen: 'waves', width: 1600, height: 860 }, // slide 12 (1.86:1)
  { name: 'alarms', screen: 'alarms', width: 1600, height: 860 }, // slide 12
  { name: 'roles', screen: 'roles', width: 1600, height: 860 }, // slide 13
  { name: 'schedules', screen: 'schedules', width: 1600, height: 860 }, // slide 13
];
const LANGS = ['ko', 'en'];
const SCALE = 2;
const WEBP_QUALITY = 90;

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find(p => fs.existsSync(p));
}

const only = new Set(process.argv.slice(2));
const specs = SPECS.filter(s => !only.size || only.has(s.name));
if (!specs.length) {
  console.error(`unknown screen. choose from: ${SPECS.map(s => s.name).join(', ')}`);
  process.exit(1);
}
const chromePath = findChrome();
if (!chromePath) {
  console.error('Chrome not found. Set CHROME_PATH.');
  process.exit(1);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-screens-'));
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });

const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  chrome.stderr.on('data', d => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) resolve(m[1]);
  });
  chrome.on('exit', code => reject(new Error(`Chrome exited (${code})`)));
});

const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let seq = 0;
const pending = new Map();
const waiters = [];
ws.onmessage = e => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) {
    for (const w of [...waiters]) if (w.method === msg.method && w.sessionId === msg.sessionId) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg.params); }
  }
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});
const once = (method, sessionId) => new Promise(resolve => waiters.push({ method, sessionId, resolve }));

try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  fs.mkdirSync(pngDir, { recursive: true });
  fs.mkdirSync(webpDir, { recursive: true });

  for (const spec of specs) {
    for (const lang of LANGS) {
      await send('Emulation.setDeviceMetricsOverride', { width: spec.width, height: spec.height, deviceScaleFactor: SCALE, mobile: false }, sessionId);
      const url = `${pathToFileURL(source).href}?screen=${spec.screen}&lang=${lang}`;
      const loaded = once('Page.loadEventFired', sessionId);
      await send('Page.navigate', { url }, sessionId);
      await loaded;
      await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))', awaitPromise: true }, sessionId);
      const clip = { x: 0, y: 0, width: spec.width, height: spec.height, scale: 1 };
      const png = await send('Page.captureScreenshot', { format: 'png', clip }, sessionId);
      const webp = await send('Page.captureScreenshot', { format: 'webp', quality: WEBP_QUALITY, clip }, sessionId);
      const file = `${spec.name}-${lang}`;
      fs.writeFileSync(path.join(pngDir, `${file}.png`), Buffer.from(png.data, 'base64'));
      fs.writeFileSync(path.join(webpDir, `${file}.webp`), Buffer.from(webp.data, 'base64'));
      console.log(`rendered ${file} (${spec.width * SCALE}×${spec.height * SCALE})`);
    }
  }
} finally {
  ws.close();
  const exited = new Promise(resolve => chrome.once('exit', resolve));
  chrome.kill();
  await exited;
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
