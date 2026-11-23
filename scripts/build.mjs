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
const argv = process.argv.slice(2);
const args = new Set(argv);
const serve = args.has('--serve');
const watch = serve || args.has('--watch');
const publicOnly = args.has('--public-only') || process.env.PUBLIC_ONLY === '1';
const withPdf = args.has('--with-pdf') || process.env.WITH_PDF === '1';
const clientArg = argv.find(arg => arg.startsWith('--client='))?.slice('--client='.length);
const clientName = (clientArg ?? process.env.CLIENT ?? '').trim();

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
    // The default locale (output index.html at the root) is listed first.
    .sort((a, b) => a.output.split('/').length - b.output.split('/').length || a.lang.localeCompare(b.lang));
}

function listSlideFiles(locale) {
  return fs.readdirSync(path.join(src, 'slides', locale.lang))
    .filter(file => file.endsWith('.html')).sort();
}

function validateSlideFiles(locales) {
  const [defaultLocale, ...translations] = locales;
  if (!defaultLocale) throw new Error('No locales configured');

  const slideFiles = listSlideFiles(defaultLocale);
  if (!slideFiles.length) throw new Error(`slides/${defaultLocale.lang}: no HTML slides`);
  const expected = new Set(slideFiles);

  // Language links preserve the slide number, so every deck must have the same files.
  for (const locale of translations) {
    const actual = new Set(listSlideFiles(locale));
    const missing = slideFiles.filter(file => !actual.has(file));
    const extra = [...actual].filter(file => !expected.has(file));
    const differences = [];
    if (missing.length) differences.push(`missing [${missing.join(', ')}]`);
    if (extra.length) differences.push(`extra [${extra.join(', ')}]`);
    if (differences.length) {
      throw new Error(`slides/${locale.lang} differs from slides/${defaultLocale.lang}: ${differences.join(', ')}`);
    }
  }
  return slideFiles;
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

// Public address of dist/ ("homepage" in package.json, or SITE_URL). Link previews, canonical and
// hreflang need absolute URLs; without one the build falls back to relative links.
const siteUrl = process.env.SITE_URL || JSON.parse(read(path.join(root, 'package.json'))).homepage || '';
const pageUrl = output => new URL(output.replace(/(^|\/)index\.html$/, '$1'), siteUrl).href;

function headLinks(locale, locales) {
  if (!siteUrl) {
    return locales.filter(other => other !== locale)
      .map(other => `<link rel="alternate" hreflang="${other.lang}" href="${escapeHtml(relativeUrl(locale.output, other.output))}">\n`)
      .join('');
  }
  const links = [
    `<link rel="canonical" href="${escapeHtml(pageUrl(locale.output))}">`,
    `<meta property="og:url" content="${escapeHtml(pageUrl(locale.output))}">`,
  ];
  if (locales.length > 1) {
    links.push(...locales.map(other => `<link rel="alternate" hreflang="${other.lang}" href="${escapeHtml(pageUrl(other.output))}">`));
    links.push(`<link rel="alternate" hreflang="x-default" href="${escapeHtml(pageUrl(locales[0].output))}">`);
  }
  return links.map(link => `${link}\n`).join('');
}

function languageBlocks(locale, locales) {
  const others = locales.filter(other => other !== locale);
  const alternates = headLinks(locale, locales);
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
  const slideFiles = validateSlideFiles(locales);

  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  if (fs.existsSync(publicDir)) fs.cpSync(publicDir, dist, { recursive: true });
  copyFonts();

  const editions = locales.map(locale => {
    const slideDir = path.join(src, 'slides', locale.lang);
    const slideHtmls = slideFiles
      .map(file => expandIncludes(read(path.join(slideDir, file)), `slides/${locale.lang}/${file}`))
      .filter(html => !publicOnly || !html.includes('example-placeholder'));
    if (!slideHtmls.length) throw new Error(`slides/${locale.lang}: no slides remaining after filtering`);
    slideHtmls[0] = slideHtmls[0].replace(/(<section\b[^>]*?)\s+hidden(?=[\s>])/, '$1');
    if (clientName) {
      const badge = `<p class="client-badge">${escapeHtml(locale.ui.preparedFor)} · ${escapeHtml(clientName)}</p>`;
      slideHtmls[0] = slideHtmls[0].replace('<div class="hero-copy">', `<div class="hero-copy">${badge}`);
    }
    const slides = slideHtmls.join('');
    const depth = locale.output.split('/').length - 1;
    const base = '../'.repeat(depth);
    const ogImageUrl = siteUrl ? new URL(locale.meta.ogImage, siteUrl).href : base + locale.meta.ogImage;
    const data = { ...locale, base, ogImageUrl };
    const i18n = JSON.stringify(locale.ui).replaceAll('<', '\\u003c');
    const notes = JSON.stringify(locale.notes || {}).replaceAll('<', '\\u003c');
    const pdfAttr = withPdf ? ` data-pdf="${escapeHtml(`${base}nova-brochure-${locale.lang}.pdf`)}"` : '';
    const raw = { styles: '', viewer: '', translations: '', slides, i18n, notes, pdfAttr, ...languageBlocks(locale, locales) };
    const html = render(template, data, raw, locale.lang);
    return { locale, data, raw, html };
  });

  for (const edition of editions) {
    const { locale, data, raw } = edition;
    // Bundle alternate markup so presentation mode can also switch languages offline.
    const translations = JSON.stringify(Object.fromEntries(editions
      .filter(other => other !== edition)
      .map(other => [other.locale.lang, other.html]))).replaceAll('<', '\\u003c');
    const html = render(template, data, { ...raw, styles, viewer, translations }, locale.lang);
    const out = path.join(dist, locale.output);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
  }
  const mode = [publicOnly && 'public-only', withPdf && 'with-pdf', clientName && `client=${clientName}`].filter(Boolean).join(', ');
  console.log(`built ${locales.map(l => l.output).join(', ')}${mode ? ` (${mode})` : ''} in ${Math.round(performance.now() - started)}ms`);
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
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.mp4': 'video/mp4', '.webp': 'image/webp', '.pdf': 'application/pdf' };
  const port = Number(process.env.PORT) || 5173;
  http.createServer((req, res) => {
    let file = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(dist)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('Not found'); return; }
    const size = fs.statSync(file).size;
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': size, 'Accept-Ranges': 'bytes' };
    // Native video controls request byte ranges when seeking, including on a local preview.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    let bounds;
    if (req.method === 'GET' && range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start > end || start >= size) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
        return;
      }
      bounds = { start, end };
      headers['Content-Length'] = end - start + 1;
      headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    }
    res.writeHead(bounds ? 206 : 200, headers);
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(file, bounds).on('error', () => res.destroy()).pipe(res);
  }).listen(port, () => console.log(`serving dist/ at http://localhost:${port}`));
}
