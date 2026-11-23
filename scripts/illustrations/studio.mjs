// Generates src/partials/studio-overview.svg and studio-inspect.svg (slide 14)
// using the same dimetric projection as equipment-illust.svg (slide 10).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const partials = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/partials');

const CY = 0.4, VW = 480, VH = 142;
let acc = [];
// Camera: x axis → (AX), y axis → (AY). Default matches slide 10; overview uses a flatter bird's-eye.
let AX = [1, CY], AY = [-1, CY];
const r = n => +n.toFixed(1);
const P = (x, y, z = 0) => { const p = [r(x * AX[0] + y * AY[0]), r(x * AX[1] + y * AY[1] - z)]; acc.push(p); return p; };
const pts = (...ps) => ps.map(p => p.join(',')).join(' ');
const poly = (ps, fill, extra = '') => `<polygon points="${pts(...ps)}" fill="${fill}"${extra}/>`;
const line = (a, b, attrs) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" ${attrs}/>`;
const FONT = 'font-family="Pretendard Variable, Pretendard, sans-serif"';
// Muted slate-blue palette shared with equipment.mjs (slide 10); amber is reserved for the alarm.
const ACCENT = '#4f78b4', INK = '#1e2b3e', MUTED = '#5e6d80';
const AMBER = '#bf8638', AMBER_BG = '#fbf5ea', AMBER_LINE = '#e2cca4';
const PANEL_LINE = '#dde3ea', RIB = 'stroke="#a3b1c4" stroke-width="0.8"';

const C = {
  frame: { t: '#e1e7ef', l: '#a7b5c8', r: '#c3cedc', s: '#8394ab' },
  post: { t: '#a9b6c8', l: '#7f8fa6', r: '#95a4b9', s: '#6e7f97' },
  tote: { t: '#f3f6f9', l: '#bcc7d6', r: '#d5dde8', s: '#9aa8bb' },
  white: { t: '#ffffff', l: '#b6c8e2', r: '#d3dff0', s: '#6f8fbd' },
  accent: { t: '#7b9ccc', l: '#4a6a99', r: '#6688bb', s: '#4a6a99' },
  bed: { t: '#dbe2eb', l: '#98a7bc', r: '#b4c0d0', s: '#8394ab' },
  amber: { t: '#e6b66c', l: '#a97b37', r: '#c9984f', s: '#8d6630' },
  ghost: { t: '#f4f6f9', l: '#dbe1e9', r: '#e7ebf1', s: '#c4cdd9' },
  ghostPost: { t: '#dbe1e9', l: '#c4cdd9', r: '#d0d8e2', s: '#b3bfce' },
};

function box(x, y, z, dx, dy, dz, c, sw = 0.9) {
  const top = [P(x, y, z + dz), P(x + dx, y, z + dz), P(x + dx, y + dy, z + dz), P(x, y + dy, z + dz)];
  const right = [P(x + dx, y, z), P(x + dx, y + dy, z), P(x + dx, y + dy, z + dz), P(x + dx, y, z + dz)];
  const left = [P(x, y + dy, z), P(x + dx, y + dy, z), P(x + dx, y + dy, z + dz), P(x, y + dy, z + dz)];
  return `<g stroke="${c.s}" stroke-width="${sw}" stroke-linejoin="round">${poly(left, c.l)}${poly(right, c.r)}${poly(top, c.t)}</g>`;
}
const floor = (x0, y0, x1, y1, fill, stroke, extra = '') =>
  poly([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], fill, ` stroke="${stroke}" stroke-width="0.8"${extra}`);
// Solid rack block with level and bay lines on its two visible faces.
function rackBlock(x, y, z, dx, dy, dz, levels, bays, c) {
  const out = [box(x, y, z, dx, dy, dz, c)];
  const ls = `stroke="${c.s}" stroke-width="0.6" opacity="0.75"`;
  for (let k = 1; k < levels; k++) {
    const h = z + (dz * k) / levels;
    out.push(line(P(x, y + dy, h), P(x + dx, y + dy, h), ls), line(P(x + dx, y, h), P(x + dx, y + dy, h), ls));
  }
  for (let b = 1; b < bays; b++) {
    const bx = x + (dx * b) / bays;
    out.push(line(P(bx, y + dy, z), P(bx, y + dy, z + dz), ls));
  }
  return out.join('');
}
function ring(xc, yc, rad, stroke, extra = '') {
  const ps = [];
  for (let i = 0; i < 40; i++) { const t = (i / 40) * Math.PI * 2; ps.push(P(xc + rad * Math.cos(t), yc + rad * Math.sin(t))); }
  return poly(ps, 'none', ` stroke="${stroke}"${extra}`);
}
function pin(x, y, base, top, label, color) {
  const a = P(x, y, base), b = P(x, y, top);
  acc.push([b[0] - 8, b[1] - 8], [b[0] + 8, b[1] + 8]);
  return line(a, b, `stroke="${color}" stroke-width="1.2"`)
    + `<circle cx="${a[0]}" cy="${a[1]}" r="1.8" fill="${color}"/>`
    + `<circle cx="${b[0]}" cy="${b[1]}" r="7.5" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>`
    + `<text x="${b[0]}" y="${r(b[1] + 3.4)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#ffffff">${label}</text>`;
}

// Fits a scene's body into an area rect; returns { g, map } where map projects scene coords.
function fit(body, area) {
  const xs = acc.map(p => p[0]), ys = acc.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const S = Math.min(area.w / (maxX - minX), area.h / (maxY - minY));
  const tx = r(area.x + area.w / 2 - S * (minX + maxX) / 2), ty = r(area.y + area.h / 2 - S * (minY + maxY) / 2);
  return {
    g: `<g transform="translate(${tx} ${ty}) scale(${r(S * 1000) / 1000})">\n    ${body.join('\n    ')}\n  </g>`,
    map: p => [r(tx + S * p[0]), r(ty + S * p[1])],
    S,
  };
}

/* ---------------- overview: three zones on one floor ---------------- */
function overview() {
  acc = []; AX = [1, 0.22]; AY = [-0.62, 0.46];
  const out = [floor(0, 0, 184, 54, '#e8edf3', '#d5dde7')];
  const pad = (x0, x1, warn) => floor(x0, 2, x1, 33, warn ? AMBER_BG : '#dfe6ee', warn ? AMBER_LINE : '#c3cedc', ' stroke-dasharray="3 2"');
  out.push(pad(2, 58, false), pad(64, 122, true), pad(128, 182, false));
  out.push(ring(93, 18, 13, AMBER, ' stroke-width="0.9" opacity="0.45"'), ring(93, 18, 19, AMBER, ' stroke-width="0.7" opacity="0.25"'));
  // A · storage
  out.push(rackBlock(8, 5, 0, 44, 9, 26, 3, 4, C.frame), rackBlock(8, 20, 0, 44, 9, 26, 3, 4, C.frame));
  // B · sorter with chutes
  out.push(box(70, 6, 0, 46, 11, 8, C.bed));
  for (let x = 76; x < 116; x += 8) out.push(line(P(x, 6, 8), P(x, 17, 8), RIB));
  for (const xc of [78, 93, 108]) {
    out.push(poly([P(xc - 4, 17, 7), P(xc + 4, 17, 7), P(xc + 4, 30, 1), P(xc - 4, 30, 1)], '#e3e8ef', ' stroke="#9aa8bb" stroke-width="0.8" stroke-linejoin="round"'));
  }
  out.push(box(84, 8, 8, 7, 7, 6, C.amber), box(99, 8, 8, 7, 7, 6, C.tote, 0.8));
  // C · shipping pallets
  for (const [x, y, h] of [[134, 6, 2], [156, 6, 1], [134, 20, 1], [156, 20, 2]]) {
    out.push(box(x, y, 0, 18, 11, 2.5, C.post));
    for (let k = 0; k < h; k++) out.push(box(x + 1.5, y + 1, 2.5 + k * 9, 15, 9, 9, C.tote, 0.8));
  }
  // main conveyor + flow
  out.push(box(2, 38, 0, 180, 9, 6, C.bed));
  const f = [P(6, 42.5, 6), P(172, 42.5, 6)];
  out.push(line(f[0], f[1], `stroke="${ACCENT}" stroke-width="1.4" stroke-dasharray="4 3" opacity="0.85"`));
  out.push(poly([P(171, 39.5, 6), P(180, 42.5, 6), P(171, 45.5, 6)], ACCENT));
  for (const x of [14, 32]) out.push(box(x, 39.5, 6, 9, 6, 6, C.tote, 0.8));
  for (const x of [50, 60, 70]) out.push(box(x, 39.5, 6, 9, 6, 6, C.amber));
  for (const x of [132, 156]) out.push(box(x, 39.5, 6, 9, 6, 6, C.tote, 0.8));
  // zone pins
  out.push(pin(30, 17, 26, 42, 'A', ACCENT), pin(93, 18, 0, 26, 'B', AMBER), pin(155, 17, 21, 36, 'C', ACCENT));
  const scene = fit(out, { x: 186, y: 8, w: 286, h: 126 });

  // status panel
  const rows = [
    ['A', '{{zone-a}}', '{{state-ok}}', false],
    ['B', '{{zone-b}}', '{{state-warn}}', true],
    ['C', '{{zone-c}}', '{{state-ok}}', false],
  ];
  const px = 12, pw = 162, top = 22, rh = 30, gap = 6;
  const panel = [`<rect x="${px}" y="${top - 10}" width="${pw}" height="${rows.length * (rh + gap) + 14}" rx="6" fill="#ffffff" stroke="${PANEL_LINE}"/>`];
  rows.forEach(([id, name, state, warn], i) => {
    const y = top + i * (rh + gap);
    if (warn) panel.push(`<rect x="${px + 6}" y="${y - 4}" width="${pw - 12}" height="${rh + 2}" rx="4" fill="${AMBER_BG}" stroke="${AMBER_LINE}"/>`);
    const color = warn ? AMBER : ACCENT;
    panel.push(
      `<circle cx="${px + 22}" cy="${y + 11}" r="8" fill="${color}"/>`,
      `<text x="${px + 22}" y="${y + 14.5}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#ffffff">${id}</text>`,
      `<text x="${px + 37}" y="${y + 15}" font-size="11.5" font-weight="700" fill="${INK}">${name}</text>`,
      `<text x="${px + pw - 14}" y="${y + 15}" text-anchor="end" font-size="10.5" font-weight="600" fill="${warn ? AMBER : MUTED}">${state}</text>`,
    );
  });
  return [scene.g, `<g ${FONT}>${panel.join('')}</g>`];
}

/* ---------------- inspect: three levels, alarm narrowed to 2F lift ---------------- */
function inspect() {
  acc = []; AX = [1, CY]; AY = [-1, CY];
  const out = [];
  const LV = [0, 30, 60], W = 92, D = 44;
  const active = 1;
  const pal = k => (k === active ? { slab: C.frame, item: C.frame, post: C.post, bed: C.bed } : { slab: C.ghost, item: C.ghost, post: C.ghostPost, bed: C.ghost });
  out.push(floor(-6, -6, W + 24, D + 6, '#e8edf3', '#d5dde7'));
  out.push(box(0, 0, 0, 2.5, 2.5, 63, C.ghostPost), box(W - 2.5, 0, 0, 2.5, 2.5, 63, C.ghostPost));
  LV.forEach((z, k) => {
    const p = pal(k);
    out.push(box(0, 0, z, W, D, 3, p.slab, k === active ? 1 : 0.8));
    if (k === active) out.push(poly([P(0, 0, z + 3), P(W, 0, z + 3), P(W, D, z + 3), P(0, D, z + 3)], 'none', ` stroke="${AMBER}" stroke-width="1.4"`));
    out.push(rackBlock(5, 4, z + 3, 50, 9, 18, 2, 5, p.item), rackBlock(5, 18, z + 3, 50, 9, 18, 2, 5, p.item));
    out.push(box(58, 17, z + 3, W - 58, 9, 5, p.bed, 0.8));
    if (k === active) out.push(box(64, 18, z + 8, 8, 7, 6, C.tote, 0.8), box(77, 18, z + 8, 8, 7, 6, C.amber));
  });
  out.push(box(0, D - 2.5, 0, 2.5, 2.5, 63, C.ghostPost), box(W - 2.5, D - 2.5, 0, 2.5, 2.5, 63, C.ghostPost));
  // vertical lift beside the levels
  const lx = W + 2, ly = 14, lz = LV[active] + 3;
  out.push(box(lx, ly, 0, 2, 2, 78, C.post), box(lx + 14, ly, 0, 2, 2, 78, C.post));
  out.push(box(lx + 1, ly + 1, lz, 15, 14, 4, C.amber), box(lx + 4, ly + 4, lz + 4, 9, 8, 7, C.tote, 0.8));
  out.push(box(lx, ly + 14, 0, 2, 2, 78, C.post), box(lx + 14, ly + 14, 0, 2, 2, 78, C.post));
  out.push(box(lx, ly, 78, 16, 16, 2.5, C.post));
  out.push(ring(lx + 8, ly + 8, 14, AMBER, ' stroke-width="0.9" opacity="0.4"'));
  // height scale at the front-left corner
  const hs = [P(-4, D + 4, 0), P(-4, D + 4, 66)];
  out.push(line(hs[0], hs[1], `stroke="${ACCENT}" stroke-width="1.2"`));
  LV.forEach((z, k) => {
    const t = P(-4, D + 4, z + 1.5);
    acc.push([t[0] - 26, t[1]]);
    const hot = k === active;
    out.push(line([t[0] - 3, t[1]], [t[0] + 3, t[1]], `stroke="${hot ? AMBER : ACCENT}" stroke-width="1.4"`));
    out.push(`<text x="${r(t[0] - 7)}" y="${r(t[1] + 3.5)}" text-anchor="end" font-size="10" font-weight="700" fill="${hot ? AMBER : '#8a99ad'}">${k + 1}F</text>`);
  });
  const pinTop = P(lx + 8, ly + 8, lz + 30);
  out.push(pin(lx + 8, ly + 8, lz + 11, lz + 30, '!', AMBER));
  const scene = fit(out, { x: 14, y: 6, w: 300, h: 130 });

  // level selector + alarm card
  const px = 330, pw = 136, top = 11;
    const panel = [`<rect x="${px}" y="${top}" width="${pw}" height="128" rx="6" fill="#ffffff" stroke="${PANEL_LINE}"/>`];
  ['3F', '2F', '1F'].forEach((lv, i) => {
    const x = px + 10 + i * 40, hot = lv === '2F';
    panel.push(
      `<rect x="${x}" y="${top + 10}" width="36" height="22" rx="4" fill="${hot ? AMBER_BG : '#f3f5f8'}" stroke="${hot ? AMBER : PANEL_LINE}"${hot ? ' stroke-width="1.3"' : ''}/>`,
      `<text x="${x + 18}" y="${top + 25}" text-anchor="middle" font-size="11" font-weight="700" fill="${hot ? AMBER : '#97a4b6'}">${lv}</text>`,
    );
  });
  const pinAt = scene.map(pinTop);
  const cy = r(pinAt[1] - 17);
  panel.push(
    `<rect x="${px + 10}" y="${cy}" width="${pw - 20}" height="76" rx="5" fill="${AMBER_BG}" stroke="${AMBER_LINE}"/>`,
    `<circle cx="${px + 25}" cy="${cy + 17}" r="7" fill="${AMBER}"/>`,
    `<text x="${px + 25}" y="${cy + 20.5}" text-anchor="middle" font-size="10" font-weight="800" fill="#ffffff">!</text>`,
    `<text x="${px + 38}" y="${cy + 21}" font-size="11.5" font-weight="700" fill="${INK}">{{alarm-title}}</text>`,
    `<text x="${px + 18}" y="${cy + 42}" font-size="10.5" font-weight="600" fill="${MUTED}">2F · LIFT-02</text>`,
    `<text x="${px + 18}" y="${cy + 60}" font-size="10.5" font-weight="600" fill="${MUTED}">{{alarm-time}}</text>`,
  );
  const leader = `<polyline points="${pinAt[0] + 9},${pinAt[1]} ${px + 18},${pinAt[1]}" fill="none" stroke="${AMBER}" stroke-width="1.2" stroke-dasharray="3 2.5"/>`;
  return [scene.g, leader, `<g ${FONT}>${panel.join('')}</g>`];
}

const wrap = (parts, note) => `<svg class="studio-figure" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="{{aria-label}}" xmlns="http://www.w3.org/2000/svg">
<!-- Generated by scripts/illustrations/studio.mjs (npm run illustrations): ${note}. Edit the script, not this file. -->
  <g ${FONT}>
  ${parts.join('\n  ')}
  </g>
</svg>
`;
const dir = partials;
fs.writeFileSync(path.join(dir, 'studio-overview.svg'), wrap(overview(), 'zone overview with status panel'));
fs.writeFileSync(path.join(dir, 'studio-inspect.svg'), wrap(inspect(), 'multi-level inspection with alarm card'));
console.log('studio.mjs: written studio-overview.svg, studio-inspect.svg');
