// Generates src/partials/equipment-illust.svg: four scenes in one shared dimetric
// projection, each auto-centred and drawn at a common scale.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const partials = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/partials');

const CY = 0.4, VW = 256, VH = 168, PAD = 8;
let acc = [];
const r = n => +n.toFixed(1);
const P = (x, y, z = 0) => { const p = [r(x - y), r((x + y) * CY - z)]; acc.push(p); return p; };
const pts = (...ps) => ps.map(p => p.join(',')).join(' ');
const poly = (ps, fill, extra = '') => `<polygon points="${pts(...ps)}" fill="${fill}"${extra}/>`;
const line = (a, b, attrs) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" ${attrs}/>`;
const polyline = (ps, attrs) => `<polyline points="${pts(...ps)}" fill="none" ${attrs}/>`;
// Muted slate-blue palette: the illustration supports the card copy rather than competing with it.
const ACCENT = '#4f78b4', INK = '#3f6296';
const dot = p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="${ACCENT}"/>`;
const DASH = `stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.85"`;
const RIB = 'stroke="#a3b1c4" stroke-width="0.8"';

const C = {
  frame: { t: '#e1e7ef', l: '#a7b5c8', r: '#c3cedc', s: '#8394ab' },
  post: { t: '#a9b6c8', l: '#7f8fa6', r: '#95a4b9', s: '#6e7f97' },
  tote: { t: '#f3f6f9', l: '#bcc7d6', r: '#d5dde8', s: '#9aa8bb' },
  white: { t: '#ffffff', l: '#b6c8e2', r: '#d3dff0', s: '#6f8fbd' },
  accent: { t: '#7b9ccc', l: '#4a6a99', r: '#6688bb', s: '#4a6a99' },
  bed: { t: '#dbe2eb', l: '#98a7bc', r: '#b4c0d0', s: '#8394ab' },
  module: { t: '#f4f6f9', l: '#ffffff', r: '#e0e6ee', s: '#9aa8bb' },
};

function box(x, y, z, dx, dy, dz, c, sw = 0.9) {
  const top = [P(x, y, z + dz), P(x + dx, y, z + dz), P(x + dx, y + dy, z + dz), P(x, y + dy, z + dz)];
  const right = [P(x + dx, y, z), P(x + dx, y + dy, z), P(x + dx, y + dy, z + dz), P(x + dx, y, z + dz)];
  const left = [P(x, y + dy, z), P(x + dx, y + dy, z), P(x + dx, y + dy, z + dz), P(x, y + dy, z + dz)];
  return `<g stroke="${c.s}" stroke-width="${sw}" stroke-linejoin="round">${poly(left, c.l)}${poly(right, c.r)}${poly(top, c.t)}</g>`;
}
const ground = (x0, y0, x1, y1) => poly([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], '#e8edf3', ' stroke="#d5dde7" stroke-width="0.8"');
// Maps local (u = x, v = -z) onto a front face at constant y.
const frontFace = y => `matrix(1 ${CY} 0 1 ${r(-y)} ${r(CY * y)})`;
// Registers a text box so the auto-fit accounts for it.
function text(p, str, { size = 12, anchor = 'middle', fill = INK, width = 18 } = {}) {
  const x0 = anchor === 'middle' ? p[0] - width / 2 : p[0];
  acc.push([x0, p[1] - size], [x0 + width, p[1] + 2]);
  return `<text x="${p[0]}" y="${p[1]}" text-anchor="${anchor}" font-size="${size}" font-weight="700" fill="${fill}">${str}</text>`;
}

/* ---------- storage: open-bay racks + stacker crane at the aisle end ---------- */
function rack(x0, y0, len, dep, levels, h, fill) {
  const t = 2.5, out = [], bay = len / 3, H = levels * h + t;
  out.push(box(x0, y0, 0, t, t, H, C.post), box(x0 + len - t, y0, 0, t, t, H, C.post));
  for (let k = 0; k <= levels; k++) {
    out.push(box(x0, y0, k * h, len, dep, t, C.frame));
    if (k === levels) break;
    fill[k].forEach((on, b) => {
      if (on) out.push(box(x0 + b * bay + (bay - 15) / 2, y0 + 2.5, k * h + t, 15, dep - 5, 9, C.tote, 0.8));
    });
  }
  out.push(box(x0, y0 + dep - t, 0, t, t, H, C.post), box(x0 + len - t, y0 + dep - t, 0, t, t, H, C.post));
  return out.join('');
}
const storage = () => [
  ground(0, 4, 100, 76),
  line(P(2, 39), P(94, 39), DASH),
  rack(8, 12, 66, 18, 3, 16, [[1, 1, 0], [1, 0, 1], [0, 1, 1]]),
  rack(8, 48, 66, 18, 3, 16, [[1, 0, 1], [1, 1, 0], [0, 1, 1]]),
  box(78, 33, 0, 18, 12, 4, C.accent),
  box(79, 33, 24, 13, 12, 3, C.accent),
  box(80.5, 34.5, 27, 10, 9, 9, C.white, 1.1),
  box(92, 37.5, 4, 3, 3, 56, C.accent),
  box(78, 36.5, 60, 18, 5, 3, C.accent),
];

/* ---------- transport: conveyor hands over to an AMR route ---------- */
function transport() {
  const out = [ground(0, 4, 98, 90)];
  const a = P(86, 21), b = P(86, 82), c = P(18, 82);
  out.push(polyline([a, b, c], DASH), dot(a), dot(c));
  out.push(box(12, 15, 0, 3, 12, 10, C.post), box(66, 15, 0, 3, 12, 10, C.post));
  out.push(box(2, 12, 10, 78, 18, 6, C.bed));
  for (let x = 8; x <= 74; x += 8) out.push(line(P(x, 13, 16), P(x, 29, 16), RIB));
  out.push(box(16, 15, 16, 13, 12, 9, C.tote, 0.8), box(44, 15, 16, 13, 12, 9, C.tote, 0.8));
  out.push(box(76, 44, 1, 20, 22, 7, C.accent), box(80, 49, 8, 12, 12, 9, C.white, 1.1));
  return out;
}

/* ---------- sorting: cross-belt line diverting into chutes ---------- */
function chute(xc, active) {
  const c = active ? { b: '#d9e4f3', w: '#b5c6de', s: '#6f8fbd' } : { b: '#e3e8ef', w: '#c3cdda', s: '#9aa8bb' };
  const a = xc - 6, b = xc + 6, y0 = 30, y1 = 72, z0 = 11, z1 = 1;
  const attrs = w => ` stroke="${c.s}" stroke-width="${w}" stroke-linejoin="round"`;
  return [
    poly([P(a, y0, z0), P(a, y1, z1), P(a, y1, z1 + 4), P(a, y0, z0 + 4)], c.w, attrs(0.9)),
    poly([P(a, y0, z0), P(b, y0, z0), P(b, y1, z1), P(a, y1, z1)], c.b, attrs(1)),
    poly([P(b, y0, z0), P(b, y1, z1), P(b, y1, z1 + 4), P(b, y0, z0 + 4)], c.w, attrs(0.9)),
  ].join('');
}
function sorting() {
  const out = [ground(0, 4, 96, 96), box(11, 9, 0, 3, 3, 26, C.post), box(2, 14, 0, 90, 16, 12, C.bed)];
  for (let x = 14; x < 92; x += 11) out.push(line(P(x, 14, 12), P(x, 30, 12), RIB));
  out.push(chute(32, false), chute(57, true), chute(82, true));
  out.push(box(4, 17, 12, 9, 10, 8, C.tote, 0.8), box(22, 17, 12, 9, 10, 8, C.tote, 0.8));
  out.push(box(77, 17, 12, 10, 10, 8, C.accent), box(52, 46, 6.5, 10, 10, 8, C.accent));
  out.push(box(11, 31, 0, 3, 3, 26, C.post), box(10, 9, 26, 5, 25, 3, C.accent));
  out.push(text(P(32, 89), '01', { fill: '#8a99ad' }), text(P(57, 89), '02'), text(P(82, 89), '03'));
  return out;
}

/* ---------- picking: two-level rack with lit pick/put indicators ---------- */
function shelf(z, mods) {
  const out = [box(8, 30, z, 84, 26, 3, C.frame)];
  mods.forEach((qty, b) => out.push(box(12 + b * 28, 33, z + 3, 22, 20, 12, qty ? C.white : C.tote, qty ? 1.1 : 0.8)));
  mods.forEach((qty, b) => {
    const x = 12 + b * 28;
    out.push(box(x, 56, z - 10, 24, 2.5, 13, C.module));
    const scr = qty
      ? `<rect x="${x + 2}" y="${-(z + 1)}" width="20" height="9" rx="1.5" fill="#7193c6"/><circle cx="${x + 5.5}" cy="${-(z - 3.5)}" r="1.6" fill="#e3effc"/><text x="${x + 20.5}" y="${-(z - 6.6)}" text-anchor="end" font-size="8.5" font-weight="700" fill="#ffffff">${qty}</text>`
      : `<rect x="${x + 2}" y="${-(z + 1)}" width="20" height="9" rx="1.5" fill="#edf1f5" stroke="#c3cdda" stroke-width="0.7"/>`;
    out.push(`<g transform="${frontFace(58.5)}">${scr}</g>`);
  });
  return out.join('');
}
function picking() {
  const out = [ground(0, 22, 100, 72)];
  out.push(box(8, 30, 0, 2.5, 2.5, 61, C.post), box(89.5, 30, 0, 2.5, 2.5, 61, C.post));
  out.push(shelf(12, [null, '08', null]), shelf(36, ['12', null, '04']));
  out.push(box(8, 30, 58, 84, 26, 3, C.frame));
  out.push(box(8, 53.5, 0, 2.5, 2.5, 61, C.post), box(89.5, 53.5, 0, 2.5, 2.5, 61, C.post));
  const from = P(52, 58.5, 2), pillY = r(from[1] + 14), w = 98;
  acc.push([from[0] - w / 2, pillY], [from[0] + w / 2, pillY + 18]);
  out.push(
    line(from, [from[0], pillY], `stroke="${ACCENT}" stroke-width="1.2" stroke-dasharray="3 2.5" opacity="0.85"`),
    `<rect x="${r(from[0] - w / 2)}" y="${pillY}" width="${w}" height="18" rx="9" fill="#ffffff" stroke="${ACCENT}" stroke-width="1"/>`,
    `<path d="M${r(from[0] - 38)} ${r(pillY + 9)} l3 3 l5.5 -6" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<text x="${r(from[0] + 7)}" y="${r(pillY + 13)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${INK}">{{confirm-label}}</text>`,
  );
  return out;
}

// Build each scene, measure it, then fit all at one shared scale.
const scenes = { storage, transport, sorting, picking }, built = {};
for (const [kind, fn] of Object.entries(scenes)) {
  acc = [];
  const body = fn();
  const xs = acc.map(p => p[0]), ys = acc.map(p => p[1]);
  built[kind] = { body, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
const S = Math.min(...Object.values(built).map(b =>
  Math.min((VW - 2 * PAD) / (b.maxX - b.minX), (VH - 2 * PAD) / (b.maxY - b.minY))));
const withText = new Set(['sorting', 'picking']);
const groups = Object.entries(built).map(([kind, b]) => {
  const tx = r(VW / 2 - S * (b.minX + b.maxX) / 2), ty = r(VH / 2 - S * (b.minY + b.maxY) / 2);
  const font = withText.has(kind) ? ' font-family="Pretendard Variable, Pretendard, sans-serif"' : '';
  return `  <g class="equip-scene equip-${kind}" transform="translate(${tx} ${ty}) scale(${r(S * 100) / 100})"${font}>\n    ${b.body.join('\n    ')}\n  </g>`;
});

const svg = `<svg class="equip-illust" data-kind="{{kind}}" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="{{aria-label}}" xmlns="http://www.w3.org/2000/svg">
<!-- Generated by scripts/illustrations/equipment.mjs (npm run illustrations). Edit the script, not this file. -->
${groups.join('\n\n')}
</svg>
`;
fs.writeFileSync(path.join(partials, 'equipment-illust.svg'), svg);
console.log(`${path.basename(fileURLToPath(import.meta.url))}: scale`, S.toFixed(3), Object.fromEntries(Object.entries(built).map(([k, b]) => [k, [r(b.maxX - b.minX), r(b.maxY - b.minY)]])));
