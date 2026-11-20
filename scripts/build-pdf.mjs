#!/usr/bin/env node
// Builds dist/ with pre-rendered 1440x810 PDFs per locale using headless Chrome.
// Passes through flags such as --public-only to build.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const forwardArgs = process.argv.slice(2);

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

const chrome = findChrome();
if (!chrome) {
  console.warn('Chrome not found: building web deck without pre-rendered PDFs.');
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build.mjs'), ...forwardArgs], { stdio: 'inherit' });
  process.exit(0);
}

execFileSync(
  process.execPath,
  [path.join(root, 'scripts', 'build.mjs'), '--with-pdf', ...forwardArgs],
  { stdio: 'inherit' },
);

const locales = fs.readdirSync(path.join(src, 'locales'))
  .filter(file => file.endsWith('.json'))
  .map(file => JSON.parse(fs.readFileSync(path.join(src, 'locales', file), 'utf8')))
  .sort((a, b) => a.output.split('/').length - b.output.split('/').length || a.lang.localeCompare(b.lang));

for (const locale of locales) {
  const htmlFile = path.join(dist, locale.output);
  const pdfName = `nova-brochure-${locale.lang}.pdf`;
  const pdfFile = path.join(dist, pdfName);
  const url = pathToFileURL(htmlFile).href;

  execFileSync(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--virtual-time-budget=3000',
    `--print-to-pdf=${pdfFile}`,
    url,
  ], { stdio: 'pipe' });

  const sizeKb = Math.round(fs.statSync(pdfFile).size / 1024);
  console.log(`generated dist/${pdfName} (${sizeKb} KB)`);
}
