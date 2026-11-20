#!/usr/bin/env node
// Static quality checks for brochure sources, locales, assets and viewer script.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const publicDir = path.join(root, 'public');
const read = file => fs.readFileSync(file, 'utf8');

const errors = [];
const fail = message => errors.push(message);

// 1. Validate viewer.js syntax.
try {
  execFileSync(process.execPath, ['--check', path.join(src, 'viewer.js')], { stdio: 'pipe' });
} catch (error) {
  fail(`src/viewer.js syntax error: ${error.stderr?.toString().trim() || error.message}`);
}

// 2. Load locales and validate matching slide file sets.
const locales = fs.readdirSync(path.join(src, 'locales'))
  .filter(file => file.endsWith('.json'))
  .map(file => JSON.parse(read(path.join(src, 'locales', file))))
  .sort((a, b) => a.output.split('/').length - b.output.split('/').length || a.lang.localeCompare(b.lang));

if (!locales.length) fail('No locale JSON files found in src/locales/');

const listSlides = lang => fs.readdirSync(path.join(src, 'slides', lang)).filter(f => f.endsWith('.html')).sort();
const [defaultLocale, ...translations] = locales;
const baseSlides = defaultLocale ? listSlides(defaultLocale.lang) : [];

if (!baseSlides.length) fail(`src/slides/${defaultLocale?.lang}: no HTML slides found`);

for (const locale of translations) {
  const actual = new Set(listSlides(locale.lang));
  const expected = new Set(baseSlides);
  const missing = baseSlides.filter(f => !actual.has(f));
  const extra = [...actual].filter(f => !expected.has(f));
  if (missing.length) fail(`slides/${locale.lang}: missing [${missing.join(', ')}]`);
  if (extra.length) fail(`slides/${locale.lang}: extra [${extra.join(', ')}]`);
}

// Collect overview shortcut targets from template.html.
const template = read(path.join(src, 'template.html'));
const overviewTargets = [...template.matchAll(/data-overview-target="([^"]+)"/g)].map(m => m[1]);

// Check template {{base}} asset references (excluding dynamic fonts built into dist/).
for (const match of template.matchAll(/\{\{base\}\}([^"'?\s]+)/g)) {
  const rel = match[1];
  if (rel.startsWith('fonts/')) continue;
  if (!fs.existsSync(path.join(publicDir, rel))) fail(`src/template.html: missing public asset "${rel}"`);
}

// 3. Validate each locale's slides and metadata assets.
const themesBySlide = new Map();

for (const locale of locales) {
  if (locale.meta?.ogImage && !fs.existsSync(path.join(publicDir, locale.meta.ogImage))) {
    fail(`src/locales/${locale.lang}.json: missing public asset "${locale.meta.ogImage}"`);
  }

  const slideFiles = listSlides(locale.lang);
  const seenIds = new Set();

  slideFiles.forEach((file, index) => {
    const where = `slides/${locale.lang}/${file}`;
    const html = read(path.join(src, 'slides', locale.lang, file));

    // Section opening tag & hidden state.
    const sectionTag = html.match(/<section\b[^>]*>/)?.[0];
    if (!sectionTag) {
      fail(`${where}: missing <section> root`);
      return;
    }
    const isHidden = /\bhidden\b/.test(sectionTag);
    if (index === 0 && isHidden) fail(`${where}: cover slide must not have hidden attribute`);
    if (index > 0 && !isHidden) fail(`${where}: non-cover slide must have hidden attribute`);

    // aria-labelledby must match the first h1/h2 id and be unique within the deck.
    const labelledBy = sectionTag.match(/aria-labelledby="([^"]+)"/)?.[1];
    const headingId = html.match(/<h[12]\b[^>]*\bid="([^"]+)"/)?.[1];
    if (!labelledBy) fail(`${where}: missing aria-labelledby`);
    else if (labelledBy !== headingId) fail(`${where}: aria-labelledby="${labelledBy}" does not match heading id="${headingId ?? 'none'}"`);
    if (labelledBy) {
      if (seenIds.has(labelledBy)) fail(`${where}: duplicate slide id "${labelledBy}"`);
      seenIds.add(labelledBy);
    }

    // Theme parity across locales.
    const isDark = /\btheme-dark\b/.test(sectionTag);
    if (!themesBySlide.has(file)) themesBySlide.set(file, isDark);
    else if (themesBySlide.get(file) !== isDark) fail(`${where}: theme-dark differs from ${defaultLocale.lang}`);

    // Unescaped ampersands in HTML text/attributes.
    const badAmps = html.match(/&(?![a-zA-Z0-9#]+;)/g);
    if (badAmps) fail(`${where}: found ${badAmps.length} unescaped "&" (use &amp;)`);

    // Public asset references ({{base}}...).
    for (const match of html.matchAll(/\{\{base\}\}([^"'?\s]+)/g)) {
      const rel = match[1];
      if (!fs.existsSync(path.join(publicDir, rel))) fail(`${where}: missing public asset "${rel}"`);
    }

    // Partial includes & required params.
    for (const match of html.matchAll(/<!--@include\s+(\S+)((?:\s+[\w-]+="[^"]*")*)\s*-->/g)) {
      const partialPath = path.join(src, match[1]);
      if (!fs.existsSync(partialPath)) {
        fail(`${where}: missing partial "${match[1]}"`);
        continue;
      }
      const params = new Set([...match[2].matchAll(/([\w-]+)="[^"]*"/g)].map(m => m[1]));
      const partial = read(partialPath);
      for (const placeholder of partial.matchAll(/\{\{([\w-]+)\}\}/g)) {
        if (!params.has(placeholder[1])) fail(`${where}: include ${match[1]} missing param "${placeholder[1]}"`);
      }
    }
  });

  // Verify overview shortcut targets exist in this locale.
  for (const target of overviewTargets) {
    if (!seenIds.has(target)) fail(`slides/${locale.lang}: missing overview shortcut target "${target}"`);
  }
}

if (errors.length) {
  console.error(`check failed with ${errors.length} error(s):\n` + errors.map(e => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log(`check passed (${locales.map(l => l.lang).join(', ')}, ${baseSlides.length} slides each)`);
