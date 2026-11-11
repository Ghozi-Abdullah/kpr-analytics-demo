import { ID_VIEWBOX, ID_PROVINCES } from './provinces.js';
import { esc } from '../core/format.js';

const PROV = new Map(ID_PROVINCES.map((p) => [p.id, p]));
export const MAP_RAMP = ['#D3E4F8', '#A3C6F0', '#5E9BE3', '#2468CC', '#06357A'];
export const NO_DATA = '#E6ECF4';

export function mapClasses(values) {
  const v = values.filter(Number.isFinite);
  if (!v.length) return null;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const step = (hi - lo) / MAP_RAMP.length;
  const classOf = (x) => {
    if (!Number.isFinite(x)) return -1;
    if (hi === lo) return 2;
    return Math.min(MAP_RAMP.length - 1, Math.floor((x - lo) / step));
  };
  const bounds = MAP_RAMP.map((_, i) => [lo + step * i, i === MAP_RAMP.length - 1 ? hi : lo + step * (i + 1)]);
  return { lo, hi, classOf, bounds };
}

export function mapSvg({ provinces, classes, labels = [], selected = new Set(), aria }) {
  const [x0, y0, w, h] = ID_VIEWBOX;
  const fillOf = (p) => {
    const d = provinces.get(p.id);
    if (!d || !Number.isFinite(d.value) || !classes) return NO_DATA;
    return MAP_RAMP[classes.classOf(d.value)];
  };
  const paths = ID_PROVINCES.map((p) => {
    const d = provinces.get(p.id);
    const cls = `map-province${d ? ' has-data' : ''}${selected.has(p.id) ? ' on' : ''}`;
    return `<path class="${cls}" data-prov="${p.id}" d="${p.d}" fill="${fillOf(p)}"/>`;
  }).join('');
  const text = placeLabels(labels, w, h).map(({ l, anchor, x, y, moved }) => {
    const under = provinces.get(anchor.id)?.value;
    const dark = !moved && !!classes && Number.isFinite(under) && classes.classOf(under) >= 3;
    const lead = moved ? `<path class="map-leader" d="M${anchor.cx} ${anchor.cy}L${x} ${y + (y < anchor.cy ? 12 : -12)}"/><circle class="map-dot" cx="${anchor.cx}" cy="${anchor.cy}" r="2"/>` : '';
    const mark = l.swatch ? `<circle class="map-swatch" cx="${-Math.round(l.text.length * 3.2) - 7}" cy="6.5" r="3.6" fill="${l.swatch}"/>` : '';
    return `${lead}<g class="map-label${dark ? ' dark' : ''}${moved ? ' out' : ''}" transform="translate(${x} ${y})">
      <text y="-3">${esc(l.name)}</text>${mark}<text class="map-value" y="10">${esc(l.text)}</text></g>`;
  }).join('');
  return `<svg class="indonesia-map" viewBox="${x0} ${y0} ${w} ${h}" role="img" aria-label="${esc(aria)}" preserveAspectRatio="xMidYMid meet">
    <g class="map-provinces">${paths}</g><g class="map-labels" aria-hidden="true">${text}</g></svg>`;
}

function placeLabels(labels, w, h) {
  const box = (l, x, y) => {
    const tw = Math.max(l.name.length * 5.1, l.text.length * 6.4) + 6;
    return { x0: x - tw / 2, x1: x + tw / 2, y0: y - 13, y1: y + 14 };
  };
  const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const items = labels.map((l) => ({ l, anchor: l.prov.map((id) => PROV.get(id)).filter(Boolean).sort((a, b) => b.a - a.a)[0] }))
    .filter((x) => x.anchor)
    .map((x) => ({ ...x, area: x.l.prov.reduce((t, id) => t + (PROV.get(id)?.a || 0), 0) }))
    .sort((a, b) => b.area - a.area);
  const placed = [];
  const out = [];
  const OFFS = [0, -30, 34, -52, 56, -74, 78];
  for (const it of items) {
    const { cx, cy } = it.anchor;
    let spot = null;
    for (const dy of OFFS) {
      for (const dx of dy === 0 ? [0] : [0, -40, 40]) {
        const b = box(it.l, cx + dx, cy + dy);
        if (b.x0 < 2 || b.x1 > w - 2 || b.y0 < 2 || b.y1 > h - 2) continue;
        if (placed.some((p) => hit(p, b))) continue;
        spot = { x: cx + dx, y: cy + dy, b, moved: dy !== 0 };
        break;
      }
      if (spot) break;
    }
    if (!spot) continue;
    placed.push(spot.b);
    out.push({ l: it.l, anchor: it.anchor, x: Math.round(spot.x), y: Math.round(spot.y), moved: spot.moved });
  }
  return out;
}

export function bindMap(root, { tipOf, onPick, marks = null }) {
  const svg = root.querySelector('.indonesia-map');
  const tip = root.querySelector('.map-tip');
  if (!svg || !tip) return;
  let hot = null;
  const unmark = (keep = null) => svg.querySelectorAll('.highlighted').forEach((el) => { if (el !== keep) el.classList.remove('highlighted'); });
  const setHot = (id) => { if (hot === id) return; hot = id; marks?.onHover?.(id); };
  const hide = () => { tip.hidden = true; unmark(); setHot(null); };
  const show = (html, e) => {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = root.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.max(4, Math.min(r.width - tw - 4, x + 14))}px`;
    tip.style.top = `${Math.max(4, y - tip.offsetHeight - 12)}px`;
  };
  svg.addEventListener('pointermove', (e) => {
    const mark = marks && e.target.closest('[data-mark]');
    if (mark) {
      unmark(mark);
      mark.classList.add('highlighted');
      setHot(mark.dataset.mark);
      show(marks.tipOf(mark.dataset.mark), e);
      return;
    }
    setHot(null);
    const el = e.target.closest('.map-province');
    if (!el) { hide(); return; }
    unmark(el);
    el.classList.add('highlighted');
    el.parentNode.appendChild(el);
    show(tipOf(el.dataset.prov, PROV.get(el.dataset.prov)?.name || el.dataset.prov), e);
  });
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('click', (e) => {
    const mark = marks && e.target.closest('[data-mark]');
    if (mark) { marks.onPick(mark.dataset.mark); return; }
    const el = e.target.closest('.map-province');
    if (el) onPick(el.dataset.prov);
  });
}

export const provinceName = (id) => PROV.get(id)?.name || id;
