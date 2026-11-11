import { esc } from '../core/format.js';
import { icon } from '../core/icons.js';
import { seg, onSeg, pick, enhancePicks } from '../core/controls.js';
import { ID_PROVINCES } from './provinces.js';
import { MAP_RAMP, NO_DATA, mapClasses, provinceName, bindMap } from './indonesia-map.js';
import { kancaPoint, shortKancaName } from './kanca-points.js';

export const ISLAND_GROUPS = [
  { id: 'sumatera', name: 'Sumatera', prov: ['ID-AC', 'ID-SU', 'ID-SB', 'ID-RI', 'ID-KR', 'ID-JA', 'ID-BE', 'ID-SS', 'ID-BB', 'ID-LA'] },
  { id: 'jawa', name: 'Jawa', prov: ['ID-BT', 'ID-JK', 'ID-JB', 'ID-JT', 'ID-YO', 'ID-JI'] },
  { id: 'kalimantan', name: 'Kalimantan', prov: ['ID-KB', 'ID-KT', 'ID-KS', 'ID-KI'] },
  { id: 'sulawesi', name: 'Sulawesi', prov: ['ID-SA', 'ID-GO', 'ID-ST', 'ID-SR', 'ID-SN', 'ID-SG'] },
  { id: 'nusa', name: 'Bali dan Nusa Tenggara', prov: ['ID-BA', 'ID-NB', 'ID-NT'] },
  { id: 'timur', name: 'Maluku dan Papua', prov: ['ID-MA', 'ID-MU', 'ID-PB', 'ID-PA'] },
];
export const islandOf = (prov) => ISLAND_GROUPS.find((g) => g.prov.includes(prov)) || null;

const PROV = new Map(ID_PROVINCES.map((p) => [p.id, p]));
const BOXES = new Map();
const FIT = { region: [70, 46], province: [16, 11], cluster: [4.5, 3] };
const DOT = 5.5;
const MERGE = 11;
const roShort = (ro) => String(ro || '').replace(/^.*\/\s*/, '').replace(/^RO\s+/i, '').trim();
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const finite = (v) => Number.isFinite(v);
const overlaps = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

function boxOf(id) {
  if (BOXES.has(id)) return BOXES.get(id);
  const nums = (PROV.get(id)?.d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    x0 = Math.min(x0, nums[i]); x1 = Math.max(x1, nums[i]);
    y0 = Math.min(y0, nums[i + 1]); y1 = Math.max(y1, nums[i + 1]);
  }
  const box = Number.isFinite(x0) ? [x0, y0, x1, y1] : null;
  BOXES.set(id, box);
  return box;
}

function unionBox(boxes) {
  const list = boxes.filter(Boolean);
  if (!list.length) return null;
  return [Math.min(...list.map((b) => b[0])), Math.min(...list.map((b) => b[1])), Math.max(...list.map((b) => b[2])), Math.max(...list.map((b) => b[3]))];
}

function fitView(box, [minW, minH]) {
  let [x0, y0, x1, y1] = box;
  const padX = Math.max(minW * 0.1, (x1 - x0) * 0.12);
  const padY = Math.max(minH * 0.1, (y1 - y0) * 0.14);
  x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
  if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
  if (y1 - y0 < minH) { const c = (y0 + y1) / 2; y0 = c - minH / 2; y1 = c + minH / 2; }
  return [x0, y0, x1 - x0, y1 - y0];
}

function zoom(svg, from, to) {
  if (calm() || !from || from.every((v, i) => Math.abs(v - to[i]) < 1e-6)) { svg.setAttribute('viewBox', to.join(' ')); return Promise.resolve(); }
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / 460);
      const e = 1 - (1 - k) ** 3;
      svg.setAttribute('viewBox', from.map((v, i) => v + (to[i] - v) * e).join(' '));
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

function addSums(a, b) {
  for (const [k, v] of Object.entries(b)) a[k] = (a[k] || 0) + (finite(v) ? v : 0);
  return a;
}

function median(values) {
  const s = values.filter(finite).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function pointOf(k) {
  const pt = kancaPoint(k.key, k.prov);
  if (pt) return { x: pt.xy[0], y: pt.xy[1], approx: false };
  const meta = PROV.get(k.prov);
  return meta ? { x: meta.cx, y: meta.cy, approx: true } : null;
}

function spread(points) {
  const groups = new Map();
  for (const p of points) {
    const id = `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    groups.set(id, [...(groups.get(id) || []), p]);
  }
  for (const list of groups.values()) {
    list.slice(1).forEach((p, i) => {
      const n = i + 1;
      p.x += Math.cos(n * 2.39996) * 0.18 * Math.sqrt(n);
      p.y += Math.sin(n * 2.39996) * 0.18 * Math.sqrt(n);
    });
  }
  return points;
}

function mapNames(points) {
  const first = new Map();
  for (const p of points) {
    const w = p.name.split(' ')[0].toLowerCase();
    first.set(w, (first.get(w) || 0) + 1);
  }
  for (const p of points) {
    const words = p.name.split(' ');
    const rest = words.slice(1).join(' ').replace(/^[-–\s]+/, '');
    p.mapName = words.length > 1 && first.get(words[0].toLowerCase()) > 1 && rest.length >= 3 && !/^\d+$/.test(rest) ? rest : p.name;
  }
  return points;
}

const radiusOf = (n) => (n > 1 ? Math.min(15, 8.5 + Math.log2(n) * 1.7) : DOT);

function clusterize(points, scale) {
  const marks = points.map((p) => ({ x: p.x, y: p.y, items: [p] }));
  let merged = true;
  while (merged) {
    merged = false;
    scan: for (let i = 0; i < marks.length; i += 1) {
      for (let j = i + 1; j < marks.length; j += 1) {
        const a = marks[i];
        const b = marks[j];
        const gap = Math.hypot(a.x - b.x, a.y - b.y) * scale;
        if (gap < Math.max(MERGE, (radiusOf(a.items.length) + radiusOf(b.items.length)) * 0.85)) {
          const items = [...a.items, ...b.items];
          marks[i] = { x: items.reduce((s, p) => s + p.x, 0) / items.length, y: items.reduce((s, p) => s + p.y, 0) / items.length, items };
          marks.splice(j, 1);
          merged = true;
          break scan;
        }
      }
    }
  }
  return marks.map((m) => ({ ...m, r: radiusOf(m.items.length) }));
}

function drawOverlay(svg, view, ctx) {
  const layer = svg.querySelector('.mp-overlay');
  const rect = svg.getBoundingClientRect();
  if (!layer || !rect.width || !rect.height) return [];
  const scale = Math.min(rect.width / view[2], rect.height / view[3]);
  const u = 1 / scale;
  const vx = view[0] - (rect.width / scale - view[2]) / 2;
  const vy = view[1] - (rect.height / scale - view[3]) / 2;
  const sx = (x) => (x - vx) * scale;
  const sy = (y) => (y - vy) * scale;
  const ux = (px) => vx + px * u;
  const uy = (py) => vy + py * u;
  const marks = clusterize(ctx.points, scale);
  const taken = marks.map((m) => [sx(m.x) - m.r - 2, sy(m.y) - m.r - 2, sx(m.x) + m.r + 2, sy(m.y) + m.r + 2]);
  const free = (b) => b[0] >= 2 && b[1] >= 2 && b[2] <= rect.width - 2 && b[3] <= rect.height - 2 && !taken.some((t) => overlaps(t, b));
  const provText = [];
  const kancaText = [];
  const placeProvinces = () => {
    for (const p of ctx.provLabels) {
      const w = p.name.length * 6.3 + 8;
      for (const dy of [0, -15, 15, -28, 28]) {
        const cx = sx(p.cx);
        const cy = sy(p.cy) + dy;
        const box = [cx - w / 2, cy - 7, cx + w / 2, cy + 7];
        if (!free(box)) continue;
        taken.push(box);
        provText.push(`<text class="mp-pname${p.muted ? ' muted' : ''}" x="${ux(cx)}" y="${uy(cy + 4)}" font-size="${11 * u}">${esc(p.name)}</text>`);
        break;
      }
    }
  };
  const placeKancas = () => {
    const singles = marks.filter((m) => m.items.length === 1)
      .sort((a, b) => (finite(b.items[0].v) ? b.items[0].v : -Infinity) - (finite(a.items[0].v) ? a.items[0].v : -Infinity))
      .slice(0, 90);
    for (const m of singles) {
      const name = m.items[0].mapName;
      const w = name.length * 6 + 4;
      const cx = sx(m.x);
      const cy = sy(m.y);
      const g = m.r + 4;
      const spots = [
        [[cx + g, cy - 6, cx + g + w, cy + 6], 'start', cx + g, cy + 4],
        [[cx - g - w, cy - 6, cx - g, cy + 6], 'end', cx - g, cy + 4],
        [[cx - w / 2, cy - g - 12, cx + w / 2, cy - g], 'middle', cx, cy - g - 2.5],
        [[cx - w / 2, cy + g, cx + w / 2, cy + g + 12], 'middle', cx, cy + g + 9.5],
      ];
      const spot = spots.find(([box]) => free(box));
      if (!spot) continue;
      taken.push(spot[0]);
      kancaText.push(`<text class="mp-kname" x="${ux(spot[2])}" y="${uy(spot[3])}" text-anchor="${spot[1]}" font-size="${10.5 * u}">${esc(name)}</text>`);
    }
  };
  if (ctx.zoomed) { placeKancas(); placeProvinces(); } else { placeProvinces(); placeKancas(); }
  const dots = marks.map((m, i) => {
    const n = m.items.length;
    const v = n > 1 ? median(m.items.map((p) => p.v)) : m.items[0].v;
    const cls = finite(v) && ctx.classes ? ctx.classes.classOf(v) : -1;
    return `<g class="mp-mark${n > 1 ? ' is-group' : ''}${cls >= 3 ? ' is-dark' : ''}${m.items.some((p) => p.key === ctx.sel) ? ' is-sel' : ''}" data-mark="${i}" transform="translate(${m.x} ${m.y})">
      <circle class="mp-hit" r="${Math.max(m.r + 5, 11) * u}"/><circle class="mp-ring" r="${(m.r + 3.5) * u}"/>
      <circle class="mp-halo" r="${(m.r + 1.6) * u}"/><circle class="mp-dot" r="${m.r * u}" fill="${cls >= 0 ? MAP_RAMP[cls] : NO_DATA}"/>
      ${n > 1 ? `<text class="mp-count" y="${3.4 * u}" font-size="${(n > 99 ? 8.5 : 9.5) * u}">${n}</text>` : ''}</g>`;
  }).join('');
  layer.style.setProperty('--u', String(u));
  layer.innerHTML = `<g class="mp-pnames">${provText.join('')}</g><g class="mp-marks">${dots}</g><g class="mp-knames">${kancaText.join('')}</g>`;
  return marks;
}

let dlg = null;
let watcher = null;

function ensureDialog() {
  if (dlg) return dlg;
  dlg = document.createElement('dialog');
  dlg.id = 'map-popout';
  dlg.className = 'map-popout';
  dlg.setAttribute('aria-labelledby', 'mp-title');
  dlg.setAttribute('closedby', 'any');
  document.body.appendChild(dlg);
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }
  dlg.addEventListener('close', () => { watcher?.disconnect(); document.documentElement.classList.remove('is-modal'); });
  return dlg;
}

export function openMapPopout(opts) {
  const d = ensureDialog();
  const state = {
    mode: opts.mode || 'region', ro: opts.ro || '', island: opts.island || islandOf(opts.prov)?.id || 'jawa',
    metric: opts.metric || '', prov: opts.prov || '', view: null, zoom: null, sel: '',
  };
  let data = null;
  let marks = [];

  const close = () => d.close();
  const shell = (inner) => `<header class="mp-head"><div class="mp-titles"><h2 id="mp-title">${inner.title}</h2><p>${inner.sub || ''}</p></div>
      <div class="mp-head-actions">${inner.actions || ''}<button type="button" class="icon-btn" data-mp-close aria-label="Tutup">${icon('close', 18)}</button></div></header>${inner.body}`;

  const markOf = (key) => marks.findIndex((m) => m.items.some((p) => p.key === key));
  const paintSelection = (scroll) => {
    d.querySelectorAll('.mp-mark').forEach((el) => el.classList.toggle('is-sel', !!state.sel && marks[Number(el.dataset.mark)]?.items.some((p) => p.key === state.sel)));
    d.querySelectorAll('.mp-table tr[data-k]').forEach((tr) => tr.classList.toggle('is-sel', tr.dataset.k === state.sel));
    if (scroll && state.sel) {
      const row = [...d.querySelectorAll('.mp-table tr[data-k]')].find((tr) => tr.dataset.k === state.sel);
      row?.scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' });
    }
  };
  const heat = (key) => {
    const i = key ? markOf(key) : -1;
    d.querySelectorAll('.mp-mark').forEach((el) => el.classList.toggle('is-hot', Number(el.dataset.mark) === i));
  };

  const render = () => {
    const { kancas, metrics } = data;
    const metric = metrics.find((m) => m.id === state.metric) || metrics[0];
    state.metric = metric.id;
    const ros = [...new Set(kancas.map((k) => k.ro).filter(Boolean))].sort((a, b) => roShort(a).localeCompare(roShort(b), 'id'));
    if (state.mode === 'region' && !ros.includes(state.ro)) {
      const count = new Map();
      for (const k of kancas.filter((x) => x.prov === state.prov)) count.set(k.ro, (count.get(k.ro) || 0) + 1);
      state.ro = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ros[0] || '';
    }
    const islands = ISLAND_GROUPS.filter((g) => kancas.some((k) => g.prov.includes(k.prov)));
    if (!islands.some((g) => g.id === state.island)) state.island = islands[0]?.id || 'jawa';
    const island = ISLAND_GROUPS.find((g) => g.id === state.island);
    const scope = state.mode === 'region' ? kancas.filter((k) => k.ro === state.ro) : kancas.filter((k) => island.prov.includes(k.prov));
    const focusIds = state.mode === 'region' ? [...new Set(scope.map((k) => k.prov))] : island.prov.filter((p) => PROV.has(p));
    if (state.prov && !focusIds.includes(state.prov)) state.prov = '';
    const byProv = new Map();
    for (const k of scope) {
      const o = byProv.get(k.prov) || { sums: {}, n: 0 };
      addSums(o.sums, k.sums);
      o.n += 1;
      byProv.set(k.prov, o);
    }
    const shown = state.prov ? scope.filter((k) => k.prov === state.prov) : scope;
    if (state.sel && !shown.some((k) => k.key === state.sel)) state.sel = '';
    const total = shown.reduce((acc, k) => addSums(acc, k.sums), {});
    const points = mapNames(spread(shown.map((k) => {
      const at = pointOf(k);
      return at ? { ...at, k, key: k.key, name: shortKancaName(k.key) || k.label, v: metric.calc(k.sums) } : null;
    }).filter(Boolean)));
    const approx = points.filter((p) => p.approx).length;
    const classes = mapClasses(points.map((p) => p.v));
    const listed = shown
      .map((k) => ({ ...k, v: metric.calc(k.sums) }))
      .sort((a, b) => (finite(b.v) ? b.v : -Infinity) - (finite(a.v) ? a.v : -Infinity));
    const title = state.mode === 'region' ? `RO ${esc(roShort(state.ro))}` : esc(island.name);
    const provNames = focusIds.filter((p) => byProv.has(p)).map(provinceName);
    const sub = `${scope.length} kantor cabang di ${provNames.length} provinsi${provNames.length && provNames.length <= 4 ? ` (${esc(provNames.join(', '))})` : ''}. ${esc(data.note || '')}`;
    const regionBox = unionBox((focusIds.length ? focusIds : [...PROV.keys()]).map(boxOf));
    const target = state.zoom ? fitView(state.zoom, FIT.cluster)
      : state.prov && boxOf(state.prov) ? fitView(boxOf(state.prov), FIT.province)
        : fitView(regionBox, FIT.region);
    const zoomed = !!(state.zoom || state.prov);
    const paths = ID_PROVINCES.map((p) => {
      const cls = ['map-province', byProv.has(p.id) ? 'has-data' : 'is-dim', focusIds.includes(p.id) ? 'in-scope' : '', state.prov === p.id ? 'on' : ''].filter(Boolean).join(' ');
      return `<path class="${cls}" data-prov="${p.id}" d="${p.d}"/>`;
    }).join('');
    const provLabels = (zoomed ? ID_PROVINCES.filter((p) => p.id !== state.prov) : ID_PROVINCES.filter((p) => byProv.has(p.id)))
      .slice().sort((a, b) => b.a - a.a)
      .map((p) => ({ name: p.name, cx: p.cx, cy: p.cy, muted: !focusIds.includes(p.id) }));
    const swatches = !classes ? ''
      : classes.lo === classes.hi ? `<span class="is-dot"><i style="background:${MAP_RAMP[2]}"></i>${esc(metric.label)} ${esc(metric.format(classes.lo))}</span>`
        : MAP_RAMP.map((c, i) => `<span class="is-dot"><i style="background:${c}"></i>${esc(metric.format(classes.bounds[i][0]))}${i === MAP_RAMP.length - 1 ? `–${esc(metric.format(classes.hi))}` : ''}</span>`).join('');
    const key = `${swatches}<span class="mp-key-group" hidden><i aria-hidden="true">3</i>kanca berdekatan, klik untuk memperbesar</span>
      <span class="map-hint">${icon('info', 13)}Lokasi titik perkiraan per kota${approx ? `; ${approx} kanca di tengah provinsi` : ''}</span>`;
    const regionPick = state.mode === 'region'
      ? pick({ id: 'mp-ro', label: 'Region', value: state.ro, options: ros.map((r) => ({ value: r, label: roShort(r) })) })
      : pick({ id: 'mp-island', label: 'Pulau', value: state.island, options: islands.map((g) => ({ value: g.id, label: g.name })) });
    const stats = metrics.map((m) => `<div title="${esc(m.label)}"><dt>${esc(m.label)}</dt><dd>${esc(m.format(m.calc(total)))}</dd></div>`).join('');
    const cols = metrics.map((m) => `<th scope="col" class="${m.id === metric.id ? 'is-sorted' : ''}">${esc(m.label)}</th>`).join('');
    const rows = listed.map((k) => `<tr data-k="${esc(k.key)}"${state.sel === k.key ? ' class="is-sel"' : ''}>
        <th scope="row">${opts.onKanca ? `<button type="button" class="mp-kanca" data-k="${esc(k.key)}">${esc(k.label)}</button>` : `<span class="mp-kanca">${esc(k.label)}</span>`}
          <small>${esc(state.mode === 'island' ? `${roShort(k.ro)}, ${provinceName(k.prov)}` : provinceName(k.prov))}</small></th>
        ${metrics.map((m) => `<td class="${m.id === metric.id ? 'is-sorted' : ''}">${esc(m.format(m.calc(k.sums)))}</td>`).join('')}</tr>`).join('');
    const actions = state.mode === 'region' && opts.onRegion ? `<button type="button" class="btn sm" data-mp-region>${icon('target', 15)}Filter dashboard ke ${esc(roShort(state.ro))}</button>` : '';
    const where = state.mode === 'region' ? `wilayah RO ${roShort(state.ro)}` : island.name;
    d.innerHTML = shell({
      title, sub, actions,
      body: `<div class="mp-controls">
          ${seg({ name: 'mp-mode', label: 'Tampilan', small: true, value: state.mode, options: [{ value: 'region', label: 'Per region' }, { value: 'island', label: 'Per pulau' }] })}
          ${regionPick}
          ${metrics.length > 1 ? seg({ name: 'mp-metric', label: 'Ukuran', small: true, value: metric.id, options: metrics.map((m) => ({ value: m.id, label: m.label })) }) : ''}
        </div>
        <div class="mp-body">
          <div class="mp-map">
            <div class="mp-canvas is-zooming"><svg class="indonesia-map mp-svg" viewBox="${(state.view || target).join(' ')}" role="img" aria-label="${esc(`Peta ${where}: ${points.length} titik kantor cabang, warna menurut ${metric.label}`)}" preserveAspectRatio="xMidYMid meet">
              <g class="map-provinces">${paths}</g><g class="mp-overlay" aria-hidden="true"></g></svg>
              <div class="map-tip" role="status" hidden></div>
              ${zoomed ? `<button type="button" class="mp-zoomout" data-mp-zoomout>${icon('undo', 14)}Perkecil</button>` : ''}</div>
            <div class="map-key" aria-label="Legenda warna titik">${key}</div>
          </div>
          <section class="mp-list" aria-labelledby="mp-list-h">
            <div class="mp-list-head"><h3 id="mp-list-h">${state.prov ? `Kantor cabang di ${esc(provinceName(state.prov))}` : 'Kantor cabang'} <span>${listed.length}</span></h3>
              ${state.prov ? '<button type="button" class="link" data-mp-allprov>Semua provinsi</button>' : ''}</div>
            <dl class="mp-stats">${stats}</dl>
            <div class="table-wrap scroll mp-table" tabindex="0" role="region" aria-labelledby="mp-list-h"><table class="data-table">
              <thead><tr><th scope="col">Kantor cabang</th>${cols}</tr></thead><tbody>${rows || `<tr><td colspan="${metrics.length + 1}" class="mp-empty">Belum ada kantor cabang di data</td></tr>`}</tbody></table></div>
            ${opts.kancaHint && listed.length ? `<p class="mp-hint">${esc(opts.kancaHint)}</p>` : ''}
          </section>
        </div>`,
    });
    const svg = d.querySelector('.mp-svg');
    const canvas = d.querySelector('.mp-canvas');
    const ctx = { points, classes, provLabels, zoomed, sel: state.sel };
    let ready = false;
    const groupKey = d.querySelector('.mp-key-group');
    const redraw = () => {
      if (!ready) return;
      marks = drawOverlay(svg, target, { ...ctx, sel: state.sel });
      if (groupKey) groupKey.hidden = !marks.some((m) => m.items.length > 1);
    };
    const from = state.view;
    state.view = target;
    marks = [];
    watcher?.disconnect();
    watcher = new ResizeObserver(() => requestAnimationFrame(redraw));
    watcher.observe(canvas);
    zoom(svg, from, target).then(() => {
      ready = true;
      redraw();
      canvas.classList.remove('is-zooming');
    });
    bindMap(canvas, {
      tipOf: (id, name) => {
        const o = byProv.get(id);
        if (!o) return `<b>${esc(name)}</b><span>${focusIds.includes(id) ? 'Belum ada kantor cabang di data' : 'Di luar pilihan'}</span>`;
        return `<b>${esc(name)}</b><span>${o.n} kantor cabang</span><em>${esc(metric.label)} ${esc(metric.format(metric.calc(o.sums)))}</em><span>${state.prov === id ? 'Klik untuk kembali ke seluruh wilayah' : 'Klik untuk memperbesar'}</span>`;
      },
      onPick: (id) => {
        if (!byProv.has(id)) return;
        state.prov = state.prov === id ? '' : id;
        state.zoom = null;
        render();
      },
      marks: {
        tipOf: (i) => {
          const m = marks[Number(i)];
          if (!m) return '';
          if (m.items.length > 1) {
            const names = m.items.map((p) => p.name);
            const sums = m.items.reduce((acc, p) => addSums(acc, p.k.sums), {});
            return `<b>${m.items.length} kantor cabang</b><span>${esc(names.slice(0, 4).join(', '))}${names.length > 4 ? `, dan ${names.length - 4} lainnya` : ''}</span>
              <em>${esc(metric.label)} gabungan ${esc(metric.format(metric.calc(sums)))}</em><span>Klik untuk memperbesar</span>`;
          }
          const p = m.items[0];
          const others = metrics.filter((x) => x.id !== metric.id).map((x) => `${x.label} ${x.format(x.calc(p.k.sums))}`).join(', ');
          return `<b>${esc(p.k.label)}</b><span>RO ${esc(roShort(p.k.ro))}, ${esc(provinceName(p.k.prov))}</span>
            <em>${esc(metric.label)} ${esc(metric.format(p.v))}</em>${others ? `<span>${esc(others)}</span>` : ''}
            ${p.approx ? '<span>Lokasi belum dikenali, titik ditaruh di tengah provinsi</span>' : ''}`;
        },
        onPick: (i) => {
          const m = marks[Number(i)];
          if (!m) return;
          if (m.items.length > 1) {
            state.zoom = [Math.min(...m.items.map((p) => p.x)), Math.min(...m.items.map((p) => p.y)), Math.max(...m.items.map((p) => p.x)), Math.max(...m.items.map((p) => p.y))];
            render();
            return;
          }
          state.sel = state.sel === m.items[0].key ? '' : m.items[0].key;
          paintSelection(true);
        },
        onHover: (i) => {
          const m = i == null ? null : marks[Number(i)];
          const keys = new Set(m ? m.items.map((p) => p.key) : []);
          d.querySelectorAll('.mp-table tr[data-k]').forEach((tr) => tr.classList.toggle('is-hot', keys.has(tr.dataset.k)));
        },
      },
    });
    enhancePicks(d.querySelector('.mp-controls'));
    onSeg(d, 'mp-mode', (v) => {
      if (v === 'island') {
        const main = [...byProv.entries()].sort((a, b) => b[1].n - a[1].n)[0]?.[0] || state.prov;
        state.island = islandOf(main)?.id || state.island;
      } else {
        const count = new Map();
        for (const k of scope) count.set(k.ro, (count.get(k.ro) || 0) + 1);
        state.ro = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || state.ro;
      }
      state.mode = v;
      state.prov = '';
      state.zoom = null;
      render();
    });
    onSeg(d, 'mp-metric', (v) => { state.metric = v; render(); });
    d.querySelector('#mp-ro')?.addEventListener('change', (e) => { state.ro = e.target.value; state.prov = ''; state.zoom = null; render(); });
    d.querySelector('#mp-island')?.addEventListener('change', (e) => { state.island = e.target.value; state.prov = ''; state.zoom = null; render(); });
    d.querySelector('[data-mp-allprov]')?.addEventListener('click', () => { state.prov = ''; state.zoom = null; render(); });
    d.querySelector('[data-mp-zoomout]')?.addEventListener('click', () => {
      if (state.zoom) state.zoom = null;
      else state.prov = '';
      render();
    });
    d.querySelector('[data-mp-close]').addEventListener('click', close);
    d.querySelector('[data-mp-region]')?.addEventListener('click', () => { const ro = state.ro; close(); opts.onRegion(ro); });
    d.querySelectorAll('.mp-kanca[data-k]').forEach((b) => b.addEventListener('click', (e) => {
      if (!opts.onKanca || b.tagName !== 'BUTTON') return;
      e.stopPropagation();
      const k = kancas.find((x) => x.key === b.dataset.k);
      close();
      opts.onKanca(b.dataset.k, k?.ro || '');
    }));
    d.querySelectorAll('.mp-table tr[data-k]').forEach((tr) => {
      tr.addEventListener('pointerenter', () => heat(tr.dataset.k));
      tr.addEventListener('pointerleave', () => heat(''));
      tr.addEventListener('focusin', () => heat(tr.dataset.k));
      tr.addEventListener('focusout', () => heat(''));
      tr.addEventListener('click', () => { state.sel = state.sel === tr.dataset.k ? '' : tr.dataset.k; paintSelection(false); });
    });
  };

  const loading = () => {
    d.innerHTML = shell({
      title: 'Memuat detail wilayah', sub: 'Mengambil data kantor cabang',
      body: '<div class="mp-loading" aria-busy="true"><div class="skel" aria-hidden="true"><i></i><i></i><i></i></div></div>',
    });
    d.querySelector('[data-mp-close]').addEventListener('click', close);
  };

  if (!d.open) {
    document.documentElement.classList.add('is-modal');
    d.showModal();
  }
  if (opts.load) {
    loading();
    opts.load().then((res) => { if (!d.open) return; data = res; render(); }).catch((err) => {
      d.innerHTML = shell({ title: 'Detail wilayah belum bisa dimuat', sub: esc(err?.message || ''), body: '' });
      d.querySelector('[data-mp-close]').addEventListener('click', close);
    });
  } else {
    data = { kancas: opts.kancas || [], metrics: opts.metrics || [], note: opts.note || '' };
    render();
  }
}
