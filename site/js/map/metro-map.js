import { esc } from '../core/format.js';
import { METRO_AREAS, METRO_GRID } from './metro-areas.js';
import { MAP_RAMP, NO_DATA } from './indonesia-map.js';

const cellsOf = (a) => {
  const out = [];
  for (let dx = 0; dx < (a.w || 1); dx += 1) for (let dy = 0; dy < (a.h || 1); dy += 1) out.push([a.x + dx, a.y + dy]);
  return out;
};

function borderPath(ownerOfArea) {
  const { cols, rows } = METRO_GRID;
  const at = new Map();
  for (const a of METRO_AREAS) for (const [x, y] of cellsOf(a)) at.set(`${x},${y}`, ownerOfArea(a.id) || `area:${a.id}`);
  const own = (x, y) => at.get(`${x},${y}`) || '';
  const seg = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x <= cols; x += 1) {
      const l = own(x - 1, y); const r = own(x, y);
      if (l !== r && (l || r)) seg.push(`M${x} ${y}V${y + 1}`);
    }
  }
  for (let x = 0; x < cols; x += 1) {
    for (let y = 0; y <= rows; y += 1) {
      const t = own(x, y - 1); const b = own(x, y);
      if (t !== b && (t || b)) seg.push(`M${x} ${y}H${x + 1}`);
    }
  }
  return seg.join('');
}

export function metroGrid({ tiles, classes, selected = new Set(), aria }) {
  const fill = (v) => (Number.isFinite(v) && classes ? MAP_RAMP[classes.classOf(v)] : NO_DATA);
  const dark = (v) => Number.isFinite(v) && classes && classes.classOf(v) >= 3;
  const items = METRO_AREAS.map((a) => {
    const t = tiles.get(a.id);
    const style = [`grid-area:${a.y + 1} / ${a.x + 1} / span ${a.h || 1} / span ${a.w || 1}`, `--fill:${fill(t?.value)}`];
    let cls = 'metro-tile';
    if (t?.split && Number.isFinite(t.split.value)) {
      style.push(`--fill-2:${fill(t.split.value)}`, `--band:${Math.round(Math.min(0.34, Math.max(0.18, 1 - t.split.share)) * 100)}%`);
      cls += ' split';
    }
    if (!t) cls += ' empty';
    if (dark(t?.value)) cls += ' dark';
    if (selected.has(a.id)) cls += ' on';
    return `<button type="button" class="${cls}" data-area="${a.id}" style="${style.join(';')}"${t ? '' : ' disabled'}
      aria-label="${esc(t?.aria || `${a.name}, belum ada kantor cabang di data`)}"${selected.has(a.id) ? ' aria-pressed="true"' : ''}>
      <b>${esc(a.short)}</b><span>${esc(t?.sub || 'Tanpa kanca')}</span></button>`;
  }).join('');
  const owners = new Map(METRO_AREAS.map((a) => [a.id, tiles.get(a.id)?.owner || '']));
  return `<div class="metro-map" role="group" aria-label="${esc(aria)}" style="--cols:${METRO_GRID.cols};--rows:${METRO_GRID.rows}">${items}
    <svg class="metro-lines" viewBox="0 0 ${METRO_GRID.cols} ${METRO_GRID.rows}" preserveAspectRatio="none" aria-hidden="true"><path d="${borderPath((id) => owners.get(id))}"/></svg></div>`;
}

export function bindMetro(root, { tipOf, onPick }) {
  const grid = root.querySelector('.metro-map');
  const tip = root.querySelector('.map-tip');
  if (!grid || !tip) return;
  const show = (el, x, y) => {
    tip.innerHTML = tipOf(el.dataset.area);
    tip.hidden = false;
    const r = root.getBoundingClientRect();
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.max(4, Math.min(r.width - tw - 4, x + 14))}px`;
    tip.style.top = `${Math.max(4, y - tip.offsetHeight - 12)}px`;
  };
  const hide = () => { tip.hidden = true; };
  grid.addEventListener('pointermove', (e) => {
    const el = e.target.closest('.metro-tile:not(.empty)');
    if (!el) { hide(); return; }
    const r = root.getBoundingClientRect();
    show(el, e.clientX - r.left, e.clientY - r.top);
  });
  grid.addEventListener('pointerleave', hide);
  grid.addEventListener('focusin', (e) => {
    const el = e.target.closest('.metro-tile:not(.empty)');
    if (!el || !el.matches(':focus-visible')) return;
    const r = root.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    show(el, b.left - r.left + b.width / 2 - 14, b.top - r.top + 4);
  });
  grid.addEventListener('focusout', hide);
  grid.addEventListener('click', (e) => {
    const el = e.target.closest('.metro-tile:not(.empty)');
    if (el) onPick(el.dataset.area);
  });
}
