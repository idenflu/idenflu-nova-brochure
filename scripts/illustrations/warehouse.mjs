// Generates the shared dark warehouse scene in two variants (same projection as slides 10/14):
//   warehouse-route-scene.svg  slide 5 — numbered stops and a route that rides on the equipment
//   warehouse-cover-scene.svg  slide 1 — the same site with vehicle routes (matches the cover caption)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const partials = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/partials');
const CY = 0.4, VW = 720, VH = 420, PAD = 22;
const r = n => +n.toFixed(1);
let acc = [];
const P = (x, y, z = 0) => { const p = [r(x - y), r((x + y) * CY - z)]; acc.push(p); return p; };
const pts = (...ps) => ps.map(p => p.join(',')).join(' ');
const poly = (ps, fill, extra = '') => `<polygon points="${pts(...ps)}" fill="${fill}"${extra}/>`;
const line = (a, b, attrs) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" ${attrs}/>`;
const quad = (x0, y0, x1, y1, z = 0) => [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)];

const ROUTE = '#9ddaff', VEHICLE = '#88befc';
const C = {
  rack: { t: '#b6c9e5', l: '#57739c', r: '#7f9bc1', s: '#2b3d58' },
  mast: { t: '#9ddaff', l: '#5d9ad0', r: '#7fb8e8', s: '#2b3d58' },
  bed: { t: '#3e5577', l: '#22324a', r: '#2d425f', s: '#5d7699' },
  tote: { t: '#dbe8fb', l: '#8fa9cf', r: '#b5c9e6', s: '#2b3d58' },
  live: { t: '#e2f2ff', l: '#6fb0e6', r: '#9dd0f5', s: '#17202f' },
  pallet: { t: '#6d84a6', l: '#3e5577', r: '#536b8f', s: '#2b3d58' },
  wall: { t: '#3a4f70', l: '#26374f', r: '#2a3c57', s: '#4b6385' },
  amr: { t: '#9ddaff', l: '#3f7fbf', r: '#5f9fd8', s: '#17202f' },
  cart: { t: '#2d425f', l: '#22324a', r: '#2a3c57', s: '#6f89ad' },
};

function box(x, y, z, dx, dy, dz, c, sw = 0.6) {
  const top = quad(x, y, x + dx, y + dy, z + dz);
  const right = [P(x + dx, y, z), P(x + dx, y + dy, z), P(x + dx, y + dy, z + dz), P(x + dx, y, z + dz)];
  const left = [P(x, y + dy, z), P(x + dx, y + dy, z), P(x + dx, y + dy, z + dz), P(x, y + dy, z + dz)];
  return `<g stroke="${c.s}" stroke-width="${sw}" stroke-linejoin="round">${poly(left, c.l)}${poly(right, c.r)}${poly(top, c.t)}</g>`;
}
function rackBlock(x, y, dx, dy, dz, levels, bays) {
  const out = [box(x, y, 0, dx, dy, dz, C.rack)];
  const ls = 'stroke="#2b3d58" stroke-width="0.7"';
  for (let k = 1; k < levels; k++) {
    const h = (dz * k) / levels;
    out.push(line(P(x, y + dy, h), P(x + dx, y + dy, h), ls), line(P(x + dx, y, h), P(x + dx, y + dy, h), ls));
  }
  for (let b = 1; b < bays; b++) out.push(line(P(x + (dx * b) / bays, y + dy, 0), P(x + (dx * b) / bays, y + dy, dz), ls));
  return out.join('');
}
function conveyor(x, y, dx, dy, h = 7) {
  const out = [box(x, y, 0, dx, dy, h, C.bed)];
  const ls = 'stroke="#5d7699" stroke-width="0.5"';
  if (dx >= dy) for (let i = x + 4; i < x + dx; i += 6) out.push(line(P(i, y, h), P(i, y + dy, h), ls));
  else for (let j = y + 4; j < y + dy; j += 6) out.push(line(P(x, j, h), P(x + dx, j, h), ls));
  return out.join('');
}
const pathLength = ps => ps.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - ps[i][0], p[1] - ps[i][1]), 0);

function scene(variant) {
  acc = [];
  const isRoute = variant === 'route';
  const W = 240, D = 150;
  const layers = { floor: [], shadow: [], structure: [], route: [], load: [] };
  const put = (layer, depth, svg) => layers[layer].push({ depth, svg });
  // Contact shadow on the floor, offset toward the front-right.
  const shadow = (x, y, dx, dy, s = 3) => put('shadow', 0, poly(quad(x + 1, y + 1, x + dx + s, y + dy + s), '#0d1522', ' opacity="0.45"'));

  /* floor, zones, grid and back walls */
  put('floor', 0, poly(quad(0, 0, W, D), '#223249', ' stroke="#5d7699" stroke-width="0.6"'));
  for (const [x0, y0, x1, y1] of [[3, 90, 50, D], [40, 3, 134, 78], [176, 3, W, 104]]) {
    put('floor', 1, poly(quad(x0, y0, x1, y1), '#283b58', ' stroke="#3a5070" stroke-width="0.5" stroke-dasharray="3 2"'));
  }
  for (let x = 20; x < W; x += 20) put('floor', 2, line(P(x, 0), P(x, D), 'stroke="#2e4160" stroke-width="0.5"'));
  for (let y = 20; y < D; y += 20) put('floor', 2, line(P(0, y), P(W, y), 'stroke="#2e4160" stroke-width="0.5"'));
  put('floor', 3, box(0, 0, 0, W, 3, 24, C.wall));
  put('floor', 3, box(0, 0, 0, 3, D, 24, C.wall));
  for (const y0 of [100, 124]) {
    put('floor', 4, poly([P(3, y0, 0), P(3, y0 + 18, 0), P(3, y0 + 18, 17), P(3, y0, 17)], '#16202f', ' stroke="#6f89ad" stroke-width="0.7"'));
    for (let z = 4; z < 17; z += 4) put('floor', 4, line(P(3, y0 + 1, z), P(3, y0 + 17, z), 'stroke="#2e4160" stroke-width="0.6"'));
  }
  for (const xc of [196, 214, 232]) put('floor', 4, poly(quad(xc - 7, 76, xc + 7, 100), 'none', ' stroke="#5d7699" stroke-width="0.6" stroke-dasharray="3 2"'));

  const stops = [[22, 123, 8], [90, 66, 8], [150, 123, 8], [206, 30, 10]];

  /* AS/RS: three rack rows, aisle cranes, front I/O conveyor */
  for (const y of [10, 28, 46]) { shadow(44, y, 86, 12, 4); put('structure', 86 + y, rackBlock(44, y, 86, 12, 54, 6, 9)); }
  for (const [x, y, cz] of [[72, 23.5, 30], [104, 41.5, 16]]) {
    put('structure', x + y, box(x, y, 0, 2.5, 2.5, 58, C.mast) + box(x - 2.5, y - 2, cz, 7.5, 6.5, 4, C.mast));
  }
  const conv = [[52, 62, 74, 9], [14, 118, 54, 10], [58, 71, 10, 47], [112, 71, 10, 47], [112, 118, 58, 10]];
  for (const [x, y, dx, dy] of conv) { shadow(x, y, dx, dy, 2); put('structure', x + dx / 2 + y + dy / 2, conveyor(x, y, dx, dy)); }

  /* sorter, chutes and roll cages */
  shadow(180, 24, 58, 12, 3);
  put('structure', 240, box(180, 24, 0, 58, 12, 9, C.bed));
  for (let x = 186; x < 238; x += 7) put('structure', 241, line(P(x, 24, 9), P(x, 36, 9), 'stroke="#5d7699" stroke-width="0.5"'));
  for (const xc of [196, 214, 232]) {
    put('structure', xc + 56, poly([P(xc - 5, 36, 8), P(xc + 5, 36, 8), P(xc + 5, 74, 2), P(xc - 5, 74, 2)], '#3e5577', ' stroke="#6f89ad" stroke-width="0.6" stroke-linejoin="round"'));
    shadow(xc - 6, 80, 12, 12, 2);
    put('structure', xc + 88, box(xc - 6, 80, 0, 12, 12, 13, C.cart));
  }

  /* inbound pallets */
  for (const [x, y, h] of [[8, 98, 2], [8, 130, 1], [26, 132, 2]]) {
    shadow(x, y, 14, 14, 2);
    let s = box(x, y, 0, 14, 14, 2.5, C.pallet);
    for (let k = 0; k < h; k++) s += box(x + 1, y + 1, 2.5 + k * 9, 12, 12, 9, C.tote);
    put('structure', x + y, s);
  }

  /* routes */
  if (isRoute) {
    const route = [[22, 123, 8], [63, 123, 8], [63, 66, 8], [117, 66, 8], [117, 123, 8], [172, 123, 1], [176, 123, 1], [176, 30, 1], [180, 30, 10], [214, 30, 10], [214, 60, 6]];
    const rp = route.map(([x, y, z]) => P(x, y, z));
    const len = r(pathLength(rp));
    put('route', 0, `<polyline points="${pts(...rp)}" fill="none" stroke="#17202f" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`);
    put('route', 1, `<polyline points="${pts(...rp)}" fill="none" stroke="${ROUTE}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    put('route', 2, `<polyline class="pulse" points="${pts(...rp)}" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="16 ${len}" style="--period:${r(len + 16)}"/>`);
  } else {
    const paths = [
      [[172, 123], [176, 123], [176, 30]],
      [[40, 142], [180, 142], [180, 104], [214, 104]],
    ];
    for (const ps of paths) {
      put('route', 0, `<polyline class="flow" points="${pts(...ps.map(([x, y]) => P(x, y, 0.5)))}" fill="none" stroke="${VEHICLE}" stroke-width="1.6" stroke-dasharray="4 3" stroke-linejoin="round"/>`);
    }
  }

  /* loads */
  const tote = (x, y, z, c) => box(x, y, z, 9, 7, 7, c);
  const ambient = isRoute ? C.tote : C.live;
  if (isRoute) {
    put('load', 153, tote(30, 119.5, 7, C.live));
    put('load', 158, box(59.5, 92, 7, 7, 8, 7, C.live));
    put('load', 158.1, tote(88, 62.5, 7, C.live));
    put('load', 268, tote(142, 119.5, 7, C.live));
  } else {
    for (const x of [24, 46]) put('load', x + 123, tote(x, 119.5, 7, ambient));
    for (const x of [64, 104]) put('load', x + 66, tote(x, 62.5, 7, ambient));
    for (const x of [128, 154]) put('load', x + 123, tote(x, 119.5, 7, ambient));
    shadow(100, 135, 16, 14, 2);
    put('load', 108 + 142, box(100, 135, 0.5, 16, 14, 5, C.amr) + box(103.5, 137.5, 5.5, 9, 9, 7, C.tote));
  }
  shadow(169, 70, 14, 16, 2);
  put('load', 254, box(169, 70, 0.5, 14, 16, 5, C.amr) + box(171.5, 73, 5.5, 9, 9, 7, isRoute ? C.live : C.tote));
  put('load', 256, box(222, 26, 9, 8, 8, 7, C.tote));

  const body = Object.values(layers).flatMap(list => list.sort((a, b) => a.depth - b.depth).map(i => i.svg));

  /* fit */
  const xs = acc.map(p => p[0]), ys = acc.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys) - (isRoute ? 22 : 14), maxY = Math.max(...ys);
  const S = Math.min((VW - 2 * PAD) / (maxX - minX), (VH - 2 * PAD) / (maxY - minY));
  const tx = r(VW / 2 - S * (minX + maxX) / 2), ty = r(VH / 2 - S * (minY + maxY) / 2);
  const map = p => [r(tx + S * p[0]), r(ty + S * p[1])];

  /* screen-space overlays: labels and stop markers */
  const fs = isRoute ? 11 : 13;
  const label = (p, text, anchor = 'middle') => {
    const [x, y] = map(p), w = r(text.length * fs * 0.69 + 16);
    // Keep every pill inside the viewBox so no label is clipped at the panel edge.
    const want = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    const x0 = Math.min(Math.max(want, PAD / 2), VW - PAD / 2 - w);
    const h = fs + 9;
    return `<g><rect x="${r(x0)}" y="${r(y - h + 5)}" width="${w}" height="${h}" rx="${h / 2}" fill="#17202f" fill-opacity="0.82" stroke="#3b5170"/>`
      + `<text x="${r(x0 + w / 2)}" y="${r(y - 1)}" text-anchor="middle" font-size="${fs}" font-weight="600" letter-spacing="1.2" fill="#c3d5ef">${text}</text></g>`;
  };
  const labels = [
    label(P(4, 90, 26), 'DOCK', 'start'),
    label(P(44, 6, 64), 'AS/RS'),
    label(P(90, 97, 0), 'CONVEYOR'),
    // The cover caption already explains the dashed vehicle routes.
    ...(isRoute ? [label(P(218, 118, 0), 'AGV / AMR')] : []),
    label(P(236, 10, 30), 'SORTER'),
  ];
  const markers = isRoute ? stops.map(([x, y, z], i) => {
    const base = map(P(x, y, z)), top = [base[0], r(base[1] - 34)];
    return line(base, top, `stroke="${ROUTE}" stroke-width="1.5"`)
      + `<circle cx="${base[0]}" cy="${base[1]}" r="3" fill="${ROUTE}"/>`
      + `<circle cx="${top[0]}" cy="${top[1]}" r="14" fill="#e2f2ff" stroke="#17202f" stroke-width="2"/>`
      + `<text x="${top[0]}" y="${r(top[1] + 5)}" text-anchor="middle" font-size="15" font-weight="700" fill="#172b48">${i + 1}</text>`;
  }) : [];

  const script = path.basename(fileURLToPath(import.meta.url));
  return `<svg class="route-scene" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="{{aria-label}}" xmlns="http://www.w3.org/2000/svg">
<!-- Generated by scripts/illustrations/${script} (npm run illustrations). Edit the script, not this file. -->
  <g transform="translate(${tx} ${ty}) scale(${r(S * 1000) / 1000})">
    ${body.join('\n    ')}
  </g>
  <g font-family="Pretendard Variable, Pretendard, sans-serif">
    ${[...labels, ...markers].join('\n    ')}
  </g>
</svg>
`;
}

fs.writeFileSync(path.join(partials, 'warehouse-route-scene.svg'), scene('route'));
fs.writeFileSync(path.join(partials, 'warehouse-cover-scene.svg'), scene('cover'));
console.log('warehouse.mjs: written warehouse-route-scene.svg, warehouse-cover-scene.svg');
