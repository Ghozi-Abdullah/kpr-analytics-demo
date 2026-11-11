import { esc, fmt } from '../core/format.js';
import { ratio } from '../core/values.js';
import { icon } from '../core/icons.js';
import { emptyState } from '../core/ui.js';
import { donutChart } from '../charts/charts.js';

export const chartBox = (api, key, label, cls = '') =>
  `<div class="chart-box ${cls}"><canvas id="${api.cid(key)}" role="img" aria-label="${esc(label)}"></canvas></div>`;
export const canvasOf = (api, key) => api.body.querySelector(`#${CSS.escape(api.cid(key))}`);

export const legend = (api, key = 'lg') => `<div class="legend" id="${api.cid(key)}"></div>`;
export const legendOf = (api, key = 'lg') => api.body.querySelector(`#${CSS.escape(api.cid(key))}`);

export const stats = (items) => `<dl class="stats">${items.map((s) => `<div${s.series ? ` class="stat-${s.series}"` : ''}${s.title ? ` title="${esc(s.title)}"` : ''}>
  <dt>${esc(s.label)}</dt><dd class="${s.tone || ''}">${s.html ?? esc(s.value)}</dd></div>`).join('')}</dl>`;

export function delta(r, { inverse = false, pct = true, d = 1 } = {}) {
  if (!Number.isFinite(r)) return '<span class="delta">–</span>';
  const good = inverse ? r < 0 : r > 0;
  const cls = r === 0 ? '' : good ? 'up' : 'down';
  const arrow = r > 0 ? '↑' : r < 0 ? '↓' : '';
  return `<span class="delta ${cls}">${arrow}${pct ? fmt.pct(Math.abs(r), d) : fmt.num(Math.abs(r), d)}</span>`;
}

export function rankList(items, { format = (v) => fmt.num(v), max = null, attr = 'data-pick', empty = 'Belum ada data' } = {}) {
  if (!items.length) return emptyState(empty, '');
  const top = max ?? Math.max(...items.map((i) => Math.abs(i.value || 0)), 1);
  return `<ol class="rank">${items.map((it, i) => `<li><button type="button" ${attr}="${esc(it.key ?? it.label)}"${it.active ? ' aria-pressed="true"' : ''}>
      <span class="rank-number">${i + 1}</span>
      <span class="rank-main"><span class="rank-label">${esc(it.label)}</span>${it.sub ? `<span class="rank-sub">${it.sub}</span>` : ''}
        <span class="rank-bar"><i style="width:${Math.max(1.5, (Math.abs(it.value || 0) / top) * 100).toFixed(1)}%${it.color ? `;background:${it.color}` : ''}"></i></span></span>
      <span class="rank-value">${esc(format(it.value))}</span></button></li>`).join('')}</ol>`;
}

export function donutHtml(api, key, label) {
  return `<div class="donut"><div class="donut-chart"><canvas id="${api.cid(key)}" role="img" aria-label="${esc(label)}"></canvas>
    <div class="donut-center" id="${api.cid(`${key}-mid`)}"></div></div><ul class="donut-legend" id="${api.cid(`${key}-lg`)}"></ul></div>`;
}
export function mountDonut(api, key, items, { center, centerSub, format }) {
  const total = items.reduce((t, x) => t + (x.value || 0), 0);
  const canvas = canvasOf(api, key);
  if (!total) {
    canvas.closest('.donut').innerHTML = emptyState('Tidak ada data', '');
    return null;
  }
  const chart = donutChart(canvas, { items, format });
  api.body.querySelector(`#${CSS.escape(api.cid(`${key}-mid`))}`).innerHTML = `<b>${esc(center)}</b><span>${esc(centerSub)}</span>`;
  api.body.querySelector(`#${CSS.escape(api.cid(`${key}-lg`))}`).innerHTML = items.map((x) => `<li style="--c:${x.color}">
    <i></i><span>${esc(x.label)}</span><b>${fmt.pct(ratio(x.value, total), 1)}</b><small>${esc(format(x.value))}</small></li>`).join('');
  return chart;
}

export function onPick(api, attr, fn) {
  api.body.addEventListener('click', (e) => {
    const el = e.target.closest(`[${attr}]`);
    if (el && api.body.contains(el)) fn(el.getAttribute(attr), el, e);
  });
}

export const empty = (title, text = '') => emptyState(title, text);

export const ico = icon;
