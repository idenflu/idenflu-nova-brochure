#!/usr/bin/env node
// Assembles src/ into self-contained HTML decks in dist/ (one per locale).
//
//   node scripts/build.mjs            build once
//   node scripts/build.mjs --watch    rebuild when src/ or public/ change
//   node scripts/build.mjs --serve    build, watch, and serve dist/ on http://localhost:5173
//
// Template syntax
//   {{key.path}}    value from src/locales/<lang>.json, HTML-escaped
//   {{{name}}}      raw content (styles, viewer, slides, i18n)
// Slide syntax
//   <!--@include partials/file.svg name="value" ...-->   inlines a partial; {{name}} in it is replaced with value

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const publicDir = path.join(root, 'public');
const dist = path.join(root, 'dist');
const args = new Set(process.argv.slice(2));
const serve = args.has('--serve');
const watch = serve || args.has('--watch');

const read = file => fs.readFileSync(file, 'utf8');
const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function lookup(data, key, where) {
  const value = key.split('.').reduce((node, part) => node?.[part], data);
  if (value === undefined || value === null) throw new Error(`${where}: missing value for "${key}"`);
  return value;
}

function expandIncludes(html, where) {
  return html.replace(/<!--@include\s+(\S+)((?:\s+[\w-]+="[^"]*")*)\s*-->/g, (_, file, attrs) => {
    const params = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    const partial = read(path.join(src, file));
    return partial.replace(/\{\{([\w-]+)\}\}/g, (__, name) => {
      if (!(name in params)) throw new Error(`${where}: include ${file} needs ${name}="…"`);
      return params[name];
    });
  });
}

function render(template, data, raw, where) {
  return template
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, name) => {
      if (!(name in raw)) throw new Error(`${where}: missing raw block "${name}"`);
      return raw[name];
    })
    .replace(/\{\{([\w.]+)\}\}/g, (_, key) => escapeHtml(lookup(data, key, where)));
}

function loadLocales() {
  return fs.readdirSync(path.join(src, 'locales'))
    .filter(file => file.endsWith('.json'))
    .map(file => JSON.parse(read(path.join(src, 'locales', file))))
    .filter(locale => fs.existsSync(path.join(src, 'slides', locale.lang)))
    // The default locale (output index.html at the root) is listed first.
    .sort((a, b) => a.output.split('/').length - b.output.split('/').length || a.lang.localeCompare(b.lang));
}

// Pretendard (SIL OFL 1.1) is self-hosted. The dynamic-subset build splits the font by
// unicode-range so a page downloads only the glyph chunks it actually uses.
function copyFonts() {
  const pkg = path.join(root, 'node_modules', 'pretendard', 'dist');
  if (!fs.existsSync(pkg)) throw new Error('Pretendard is missing. Run `npm install` first.');
  const out = path.join(dist, 'fonts', 'pretendard');
  fs.mkdirSync(out, { recursive: true });
  fs.cpSync(path.join(pkg, 'web', 'variable', 'pretendardvariable-dynamic-subset.css'), path.join(out, 'pretendardvariable-dynamic-subset.css'));
  fs.cpSync(path.join(pkg, 'web', 'variable', 'woff2-dynamic-subset'), path.join(out, 'woff2-dynamic-subset'), { recursive: true });
  fs.cpSync(path.join(pkg, 'LICENSE.txt'), path.join(out, 'LICENSE.txt'));
}

const relativeUrl = (from, to) => path.posix.relative(path.posix.dirname(from), to) || path.posix.basename(to);

function languageBlocks(locale, locales) {
  const others = locales.filter(other => other !== locale);
  const alternates = others
    .map(other => `<link rel="alternate" hreflang="${other.lang}" href="${escapeHtml(relativeUrl(locale.output, other.output))}">\n`)
    .join('');
  const links = others.map(other => `  <a class="language-button" href="${escapeHtml(relativeUrl(locale.output, other.output))}" hreflang="${other.lang}" lang="${other.lang}" aria-label="${escapeHtml(other.languageName)}" title="${escapeHtml(other.languageName)}">${escapeHtml(other.languageShort)}</a>\n`);
  const languageSwitch = links.length ? `  <i class="control-divider" aria-hidden="true"></i>\n${links.join('')}` : '';
  return { alternates, languageSwitch };
}

function build() {
  const started = performance.now();
  const template = read(path.join(src, 'template.html'));
  const styles = read(path.join(src, 'styles.css'));
  const viewer = read(path.join(src, 'viewer.js'));
  const locales = loadLocales();

  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  if (fs.existsSync(publicDir)) fs.cpSync(publicDir, dist, { recursive: true });
  copyFonts();

  for (const locale of locales) {
    const slideDir = path.join(src, 'slides', locale.lang);
    const slides = fs.readdirSync(slideDir).filter(file => file.endsWith('.html')).sort()
      .map(file => expandIncludes(read(path.join(slideDir, file)), `slides/${locale.lang}/${file}`))
      .join('');
    const depth = locale.output.split('/').length - 1;
    const data = { ...locale, base: '../'.repeat(depth) };
    const i18n = JSON.stringify(locale.ui).replaceAll('<', '\\u003c');
    const raw = { styles, viewer, slides, i18n, ...languageBlocks(locale, locales) };
    const html = render(template, data, raw, `locale ${locale.lang}`);
    const out = path.join(dist, locale.output);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
  }
  console.log(`built ${locales.map(l => l.output).join(', ')} in ${Math.round(performance.now() - started)}ms`);
}

function safeBuild() {
  try { build(); } catch (error) { console.error(`build failed: ${error.message}`); if (!watch) process.exit(1); }
}

safeBuild();

if (watch) {
  let timer;
  for (const dir of [src, publicDir].filter(fs.existsSync)) {
    fs.watch(dir, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(safeBuild, 80); });
  }
  console.log('watching src/ and public/ for changes');
}

if (serve) {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.mp4': 'video/mp4', '.webp': 'image/webp' };
  const port = Number(process.env.PORT) || 5173;
  http.createServer((req, res) => {
    let file = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(dist)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  }).listen(port, () => console.log(`serving dist/ at http://localhost:${port}`));
}
