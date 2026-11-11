import { fmt, esc } from '../core/format.js';
import { icon } from '../core/icons.js';

const { Chart } = window;
if (window.ChartDataLabels) Chart.register(window.ChartDataLabels);

export const C = {
  fg: '#0B2147', muted: '#5B6880', line: '#DFE6F0', grid: '#EAEFF6', surface: '#FFFFFF',
  accent: '#0857C3', mid: '#307FE2', prev: '#71C5E8', up: '#1E8E3E', warn: '#C27C00', down: '#D70015',
  sml: '#307FE2', npl: '#06357A', lancar: '#C6DAF5', bar: '#0857C3', barPrev: '#D3E3F8', neg: '#EB6834',
};
export const SERIES = ['#0857C3', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const CONTEXT_GRAY = '#C5CEDB';
export const SEQ = ['#EAF2FD', '#CFE0F8', '#A9C8F1', '#7AAAE8', '#4A88DC', '#2468CC', '#0857C3', '#06449A'];
export const seqColor = (t) => SEQ[Math.max(0, Math.min(SEQ.length - 1, Math.round(t * (SEQ.length - 1))))];

Chart.defaults.font.family = '"Google Sans Flex", -apple-system, BlinkMacSystemFont, "SF Pro Text", Aptos, "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.font.weight = 500;
Chart.defaults.color = C.muted;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.resizeDelay = 120;
Chart.defaults.animation.duration = 420;
if (matchMedia('(prefers-reduced-motion: reduce)').matches) Chart.defaults.animation = false;
Chart.defaults.plugins.legend.display = false;
if (Chart.defaults.plugins.datalabels) Chart.defaults.plugins.datalabels.display = false;

function externalTooltip({ chart, tooltip }) {
  const box = chart.canvas.parentNode;
  let el = box.querySelector(':scope > .chart-tooltip');
  if (!el) {
    el = document.createElement('div');
    el.className = 'chart-tooltip';
    el.setAttribute('aria-hidden', 'true');
    box.appendChild(el);
  }
  if (!tooltip.opacity || !tooltip.dataPoints?.length) { el.style.opacity = 0; return; }
  const o = chart.$ktip || {};
  const horizontal = chart.options.indexAxis === 'y';
  const donut = chart.config.type === 'doughnut';
  const value = (dp) => (typeof dp.parsed === 'number' ? dp.parsed : horizontal ? dp.parsed.x : dp.parsed.y);
  const swatch = (dp) => (donut ? dp.dataset.backgroundColor[dp.dataIndex]
    : Array.isArray(dp.dataset.backgroundColor) && chart.config.type === 'bar' ? dp.dataset.backgroundColor[dp.dataIndex] : (dp.dataset.$color || dp.dataset.borderColor));
  let points = tooltip.dataPoints.filter((dp) => Number.isFinite(value(dp)));
  if (o.sort === 'stack') points = points.slice().reverse();
  else if (o.sort) points = points.sort((a, b) => value(b) - value(a));
  const title = o.title ? o.title(tooltip.dataPoints) : tooltip.title.join(' ');
  if (o.rows) {
    const dp = tooltip.dataPoints[0];
    el.innerHTML = `<b>${esc(title)}</b>${o.rows(dp).map(([l, v]) => `<div class="tooltip-row" style="--c:${dp.dataset.$color}"><i></i><span>${esc(l)}</span><em>${esc(v)}</em></div>`).join('')}`;
    placeTip(el, chart, tooltip);
    return;
  }
  el.innerHTML = `<b>${esc(title)}</b>${points.map((dp) => `<div class="tooltip-row" style="--c:${swatch(dp)}">
      <i></i><span>${esc(donut ? dp.label : dp.dataset.label)}</span><em>${esc(o.format ? o.format(value(dp), dp) : fmt.num(value(dp)))}</em></div>`).join('')}
    ${o.footer && points.length > 1 ? `<div class="tooltip-row"><i style="opacity:0"></i><span>${esc(o.footer.label)}</span><em>${esc(o.footer.value(points))}</em></div>` : ''}
    ${o.hint ? `<div class="hint">${esc(o.hint)}</div>` : ''}`;
  placeTip(el, chart, tooltip);
}

function placeTip(el, chart, tooltip) {
  const box = chart.canvas.parentNode;
  const w = el.offsetWidth; const h = el.offsetHeight; const bw = box.clientWidth; const bh = box.clientHeight;
  let x = tooltip.caretX + 16;
  if (x + w > bw) x = tooltip.caretX - w - 16;
  x = Math.max(0, x);
  const y = Math.max(-6, Math.min(tooltip.caretY - h / 2, bh - h + 6));
  el.style.transform = `translate(${x}px, ${y}px)`;
  el.style.opacity = 1;
}

const crosshair = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    if (chart.config.type !== 'line') return;
    const active = chart.tooltip?.getActiveElements?.() || [];
    if (!active.length) return;
    const { ctx, chartArea } = chart;
    const x = active[0].element.x;
    ctx.save();
    ctx.strokeStyle = 'rgba(8, 87, 195, .4)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

const pulse = {
  id: 'pulse',
  afterDraw(chart, _args, opts) {
    const box = chart.canvas.parentNode;
    let dot = box.querySelector(':scope > .pulse');
    if (!opts?.enabled) { dot?.remove(); return; }
    const i = opts.dataset ?? 0;
    const meta = chart.getDatasetMeta(i);
    const data = chart.data.datasets[i]?.data || [];
    let idx = -1;
    for (let k = data.length - 1; k >= 0; k -= 1) if (Number.isFinite(data[k])) { idx = k; break; }
    if (idx < 0 || !chart.isDatasetVisible(i) || !meta.data[idx]) { dot?.remove(); return; }
    if (!dot) { dot = document.createElement('span'); dot.className = 'pulse'; box.appendChild(dot); }
    const p = meta.data[idx];
    dot.style.left = `${p.x}px`;
    dot.style.top = `${p.y}px`;
  },
};

const background = {
  id: 'background',
  beforeDraw(chart) {
    if (!chart.$export) return;
    const { ctx, width, height } = chart;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = C.surface;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
};
const refLines = {
  id: 'refLines',
  afterDatasetsDraw(chart, _args, opts) {
    const lines = opts?.lines || [];
    if (!lines.length) return;
    const { ctx, chartArea: a } = chart;
    ctx.save();
    for (const l of lines) {
      const sc = chart.scales[l.axis];
      if (!sc) continue;
      const p = sc.getPixelForValue(l.value);
      ctx.strokeStyle = l.color || 'rgba(29,29,31,.35)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (l.axis === 'x') { ctx.moveTo(p, a.top); ctx.lineTo(p, a.bottom); } else { ctx.moveTo(a.left, p); ctx.lineTo(a.right, p); }
      ctx.stroke();
      if (l.label && opts.outside && l.axis !== 'x') {
        ctx.setLineDash([]);
        const [k, v] = String(l.label).split(' ');
        const x = a.right + 6;
        ctx.textAlign = 'left';
        ctx.fillStyle = C.muted;
        ctx.font = `500 9.5px ${Chart.defaults.font.family}`;
        ctx.fillText(k, x, p - 2);
        if (v) { ctx.fillStyle = C.fg; ctx.font = `600 10px ${Chart.defaults.font.family}`; ctx.fillText(v, x, p + 10); }
      } else if (l.label) {
        ctx.setLineDash([]);
        ctx.font = `600 10px ${Chart.defaults.font.family}`;
        const tw = ctx.measureText(l.label).width;
        const x = l.axis === 'x' ? p - tw / 2 : a.right - tw;
        const y = l.axis === 'x' ? a.top - 4 : p - 5;
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - 5, y - 10, tw + 10, 14, 7); else ctx.rect(x - 5, y - 10, tw + 10, 14);
        ctx.fill();
        ctx.fillStyle = C.muted;
        ctx.textAlign = 'left';
        ctx.fillText(l.label, x, y);
      }
    }
    ctx.restore();
  },
};
Chart.register(crosshair, pulse, background, refLines);

const LBL_FONT = { size: 10, weight: 600 };
function lastFinite(data) {
  for (let k = data.length - 1; k >= 0; k -= 1) if (Number.isFinite(data[k])) return k;
  return -1;
}
function labelStep(chart, n, px) {
  const a = chart.chartArea;
  const w = a ? a.right - a.left : chart.width;
  return Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / px))));
}
function pickLabel(ctx, px) {
  const ds = ctx.dataset;
  const i = ctx.dataIndex;
  if (!ds.$lab || ds.$lab === 'none' || !Number.isFinite(ds.data[i])) return false;
  const last = lastFinite(ds.data);
  if (i === last) return ds.$lab === 'main' ? true : 'auto';
  if (ds.$lab !== 'main') return false;
  const st = labelStep(ctx.chart, ds.data.length, px);
  if (st === 1) return 'auto';
  if (last - i < st * 0.7) return false;
  return i % st === 0 ? 'auto' : false;
}
function lineLabels(fmtFn, px = 46) {
  return {
    display: (ctx) => pickLabel(ctx, px),
    align: (ctx) => ctx.dataset.$align || (ctx.dataset.$lab === 'main' ? 'top' : 'bottom'),
    anchor: 'center',
    offset: (ctx) => (ctx.dataset.$lab === 'main' && ctx.dataIndex === lastFinite(ctx.dataset.data) ? 8 : 5),
    clamp: true,
    color: (ctx) => (ctx.dataset.$lab === 'main' ? '#33415C' : C.muted),
    textStrokeColor: 'rgba(255,255,255,.95)',
    textStrokeWidth: 3,
    font: LBL_FONT,
    formatter: (v) => fmtFn(v),
  };
}
function topVisibleAt(chart, i) {
  for (let d = chart.data.datasets.length - 1; d >= 0; d -= 1) {
    const v = chart.data.datasets[d].data[i];
    if (chart.isDatasetVisible(d) && Number.isFinite(v) && v !== 0) return d;
  }
  return -1;
}
function totalAt(chart, i) {
  return chart.data.datasets.reduce((t, ds, d) => t + (chart.isDatasetVisible(d) && Number.isFinite(ds.data[i]) ? ds.data[i] : 0), 0);
}
function barLabels({ horizontal, stacked, fmtFn }) {
  return {
    display: (ctx) => {
      const ds = ctx.dataset;
      if (!ds.$lab || ds.$lab === 'none' || !Number.isFinite(ds.data[ctx.dataIndex])) return false;
      if (stacked) return ctx.datasetIndex === topVisibleAt(ctx.chart, ctx.dataIndex);
      if (horizontal) return ds.data.length <= 16 ? true : 'auto';
      const shown = ctx.chart.data.datasets.filter((d, k) => d.$lab === 'main' && d.type !== 'line' && ctx.chart.isDatasetVisible(k)).length || 1;
      return pickLabel(ctx, 30 * shown);
    },
    anchor: 'end', align: 'end', offset: horizontal ? 4 : 2, clamp: true,
    color: C.fg, font: { size: horizontal ? 11.5 : 10, weight: 600 },
    textStrokeColor: 'rgba(255,255,255,.9)', textStrokeWidth: horizontal ? 0 : 2,
    formatter: (v, ctx) => fmtFn(stacked ? totalAt(ctx.chart, ctx.dataIndex) : v),
  };
}

function inkOn(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (!Number.isFinite(n)) return C.fg;
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return lum > 0.32 ? C.fg : '#FFFFFF';
}

function segmentLabels({ horizontal, fmtFn, min = 14 }) {
  return {
    display: (ctx) => {
      const v = ctx.dataset.data[ctx.dataIndex];
      if (!Number.isFinite(v) || v <= 0 || !ctx.chart.isDatasetVisible(ctx.datasetIndex)) return false;
      if (ctx.chart.data.datasets.filter((d, k) => ctx.chart.isDatasetVisible(k)).length < 2) return false;
      const el = ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.dataIndex];
      if (!el) return false;
      const { x, y, base, width, height } = el.getProps(['x', 'y', 'base', 'width', 'height'], true);
      const length = Math.abs((horizontal ? x : y) - base);
      const thick = horizontal ? height : width;
      return length >= min && thick >= 16;
    },
    anchor: 'center', align: 'center', clamp: true,
    color: (ctx) => inkOn(ctx.dataset.$color),
    font: { size: 10.5, weight: 650 },
    formatter: (v) => fmtFn(v),
  };
}

const registry = new Map();
function mount(canvas, config, ktip = {}) {
  const key = canvas.id;
  registry.get(key)?.destroy();
  canvas.parentNode.querySelector(':scope > .pulse')?.remove();
  const tip = canvas.parentNode.querySelector(':scope > .chart-tooltip');
  if (tip) tip.style.opacity = 0;
  const chart = new Chart(canvas, config);
  chart.$ktip = ktip;
  registry.set(key, chart);
  return chart;
}
export const getChart = (id) => registry.get(id);
export function destroyCharts(prefix) {
  for (const [k, ch] of registry) if (k.startsWith(prefix)) { ch.destroy(); registry.delete(k); }
}

function gradient(color) {
  return (ctx) => {
    const { chartArea, ctx: c } = ctx.chart;
    if (!chartArea) return 'transparent';
    const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    g.addColorStop(0, `${color}4D`);
    g.addColorStop(0.55, `${color}12`);
    g.addColorStop(1, `${color}00`);
    return g;
  };
}

const xScale = (extra = {}) => ({
  grid: { display: false },
  border: { display: false },
  ticks: { color: C.muted, autoSkip: true, autoSkipPadding: 10, maxRotation: 0, font: { size: 10.5 } },
  ...extra,
});
const yScale = (show, tickFormat, extra = {}) => (show ? {
  grid: { color: C.grid, drawTicks: false },
  border: { display: false, dash: [4, 4] },
  ticks: { color: C.muted, maxTicksLimit: 5, padding: 8, font: { size: 10.5 }, callback: (v) => (tickFormat ? tickFormat(v) : fmt.compact(v)) },
  ...extra,
} : { display: false, ...extra });

function clickHandler(onClick) {
  if (!onClick) return undefined;
  return (evt, _els, chart) => {
    const pts = chart.getElementsAtEventForMode(evt, 'index', { intersect: false }, true);
    if (pts.length) onClick(pts[0].index, pts, chart);
  };
}

export function lineChart(canvas, {
  labels, series, format, title, hint, footer, yAxis = false, tickFormat, pulse: withPulse = false,
  onClick, sort = false, beginAtZero = null, grace = '8%', refs = [], values = 'auto', labelFormat,
}) {
  if (onClick) canvas.parentNode.classList.add('clickable');
  const allValues = series.flatMap((s) => s.data.filter(Number.isFinite));
  const zeroBased = beginAtZero ?? (allValues.length > 0 && Math.min(...allValues) >= 0);
  const orders = series.map((s, i) => s.order ?? i);
  const primary = orders.indexOf(Math.min(...orders));
  const roleOf = (s, i) => {
    if (s.lab) return s.lab;
    if (!values) return 'none';
    if (i === primary) return values === 'last' ? 'end' : 'main';
    return series.length <= 3 || (s.order ?? i) < 50 ? 'end' : 'none';
  };
  const labFmt = labelFormat || format || ((v) => fmt.num(v));
  return mount(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: series.map((s, i) => ({
        label: s.label, data: s.data, key: s.key,
        $color: s.color, $base: s.color,
        borderColor: s.color,
        backgroundColor: s.fill ? gradient(s.color) : s.color,
        fill: s.fill ? 'origin' : false,
        borderDash: s.dash ? [6, 5] : [],
        borderWidth: s.width ?? (i === 0 ? 2.75 : 2),
        pointRadius: s.points ?? 0,
        pointHoverRadius: 6,
        pointHoverBorderWidth: 3,
        pointHoverBorderColor: s.color,
        pointHoverBackgroundColor: C.surface,
        pointBackgroundColor: s.color,
        borderCapStyle: 'round',
        tension: s.stepped ? 0 : 0.35,
        stepped: s.stepped || false,
        spanGaps: false,
        hidden: s.hidden || false,
        order: s.order ?? i,
        $order: s.order ?? i,
        $lab: roleOf(s, i),
        $align: s.align,
      })),
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      layout: { padding: values ? { top: 18, right: 22, left: 2 } : { top: 10, right: 10, left: 2 } },
      scales: { x: xScale(), y: yScale(yAxis, tickFormat, { grace: values ? '14%' : grace, beginAtZero: zeroBased }) },
      onClick: clickHandler(onClick),
      plugins: {
        tooltip: { enabled: false, external: externalTooltip },
        pulse: { enabled: withPulse, dataset: 0 },
        refLines: { lines: refs },
        datalabels: lineLabels(labFmt),
      },
    },
  }, { format, title, hint, footer, sort });
}

export function barChart(canvas, {
  labels, series, stacked = false, horizontal = false, format, title, hint, footer, onClick,
  valueLabels = 'auto', axis = true, tickFormat, labelFormat, refs = [], sort: sortTip = null, segments = false,
}) {
  if (onClick) canvas.parentNode.classList.add('clickable');
  const valueAxis = horizontal ? 'x' : 'y';
  const catAxis = horizontal ? 'y' : 'x';
  const n = labels?.length || 0;
  const max = stacked
    ? Math.max(1, ...Array.from({ length: n }, (_, i) => series.reduce((t, s) => t + (Number.isFinite(s.data[i]) ? s.data[i] : 0), 0)))
    : Math.max(1, ...series.flatMap((s) => s.data.filter(Number.isFinite)));
  const dense = n > 16;
  const labFmt = labelFormat || format || ((v) => fmt.num(v));
  return mount(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: series.map((s) => ({
        label: s.label, data: s.data, $color: s.color, backgroundColor: s.colors || s.color, hoverBackgroundColor: s.hover || s.colors || s.color,
        borderRadius: stacked ? 4 : (dense ? 4 : 10), borderSkipped: false,
        borderColor: C.surface, borderWidth: stacked ? 2 : 0,
        barPercentage: horizontal ? 0.86 : (dense ? 0.8 : 0.62), categoryPercentage: horizontal ? 0.8 : 0.84, hidden: s.hidden || false,
        $lab: s.lab || (valueLabels ? 'main' : 'none'),
      })),
    },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: valueLabels && !horizontal ? 16 : 8, right: valueLabels && horizontal ? 44 : 6 } },
      scales: {
        [catAxis]: horizontal
          ? { stacked, grid: { display: false }, border: { display: false }, ticks: { color: C.fg, font: { size: 12.5, weight: 500 } } }
          : xScale({ stacked }),
        [valueAxis]: horizontal
          ? { stacked, display: false, beginAtZero: true, max: valueLabels ? max * 1.12 : undefined }
          : yScale(axis, tickFormat, { stacked, beginAtZero: true, grace: valueLabels ? '10%' : 0 }),
      },
      onClick: clickHandler(onClick),
      plugins: {
        tooltip: { enabled: false, external: externalTooltip },
        refLines: { lines: refs },
        datalabels: stacked && segments
          ? { labels: { total: barLabels({ horizontal, stacked, fmtFn: labFmt }), segment: segmentLabels({ horizontal, fmtFn: labFmt }) } }
          : barLabels({ horizontal, stacked, fmtFn: labFmt }),
      },
    },
  }, { format, title, hint, footer, sort: sortTip ?? stacked });
}

function hugScales(bars, pct, { gap = 0.06, top = 0.86 } = {}) {
  const pairs = bars.map((b, i) => [b, pct[i]]).filter(([b, q]) => Number.isFinite(b) && Number.isFinite(q));
  const maxBar = Math.max(1, ...bars.filter(Number.isFinite));
  const qs = pairs.map(([, q]) => q);
  if (pairs.length < 2) return { yMax: maxBar * 1.2, pMin: 0, pMax: (Math.max(0, ...qs) * 1.3) || 1 };
  const qMin = Math.min(...qs);
  const qMax = Math.max(...qs);
  let best = null;
  for (let f = 0.74; f >= 0.4; f -= 0.04) {
    const yMax = maxBar / f;
    const r = pairs.map(([b]) => Math.max(0, b) / yMax + gap);
    for (let k = 0; k <= 40; k += 1) {
      const pMin = qMin - (qMax - qMin + Math.abs(qMin) * 0.02 + 1e-9) * (k / 10);
      const span = Math.min(...pairs.map(([, q], i) => (q - pMin) / r[i]));
      if (!(span > 0)) continue;
      if ((qMax - pMin) / span > top) continue;
      const slack = pairs.reduce((t, [, q], i) => t + ((q - pMin) / span - r[i]), 0) / pairs.length;
      if (!best || slack < best.slack - 1e-6) best = { yMax, pMin, pMax: pMin + span, slack };
    }
    if (best) break;
  }
  return best || { yMax: maxBar / 0.4, pMin: 0, pMax: qMax / top };
}

export function bandCombo(canvas, {
  labels, bars, barColors, pct, color, lineColor = color, barLabel, pctLabel, format = (v) => fmt.num(v),
  pctFormat = (v) => fmt.pct(v, 1), labelFormat, tickFormat, title, refs = [],
}) {
  const refMax = Math.max(0, ...refs.filter((r) => r.axis === 'y').map((r) => r.value));
  const { yMax, pMin, pMax } = hugScales(bars, pct);
  const yTop = Math.max(yMax, refMax * 1.08);
  const fmtBar = labelFormat || format;
  return mount(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { type: 'line', label: pctLabel, data: pct, yAxisID: 'p', order: 0, $color: lineColor, $base: lineColor, $lab: 'main',
          borderColor: lineColor, backgroundColor: lineColor, borderWidth: 2.2, tension: 0.3, pointRadius: 0, pointHoverRadius: 4,
          datalabels: { ...lineLabels(pctFormat, 40), offset: 4 } },
        { type: 'bar', label: barLabel, data: bars, yAxisID: 'y', order: 1, $color: color, $lab: 'main',
          backgroundColor: barColors || color, borderRadius: 3, borderSkipped: 'start', barPercentage: 0.84, categoryPercentage: 0.88,
          datalabels: {
            display: (ctx) => {
              const y = ctx.chart.scales.y;
              const v = ctx.dataset.data[ctx.dataIndex];
              if (!y || !Number.isFinite(v) || Math.abs(y.getPixelForValue(0) - y.getPixelForValue(v)) < 34) return false;
              return pickLabel(ctx, 26);
            },
            anchor: 'start', align: 'end', rotation: -90, offset: 4, clamp: true,
            color: '#33415C', textStrokeColor: 'rgba(255,255,255,.9)', textStrokeWidth: 2.5,
            font: { size: 9.5, weight: 600 }, formatter: (v) => fmtBar(v),
          } },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 6, right: refs.length ? 42 : 8, left: 2 } },
      scales: {
        x: xScale(),
        y: yScale(true, tickFormat, { beginAtZero: true, max: yTop, ticks: {
          color: C.muted, maxTicksLimit: 4, padding: 8, font: { size: 10.5 }, callback: (v) => (v > yMax * 0.62 ? '' : (tickFormat ? tickFormat(v) : fmt.compact(v))),
        } }),
        p: { type: 'linear', display: false, min: pMin, max: pMax },
      },
      plugins: {
        tooltip: { enabled: false, external: externalTooltip },
        refLines: { lines: refs, outside: true },
        datalabels: { display: false },
      },
    },
  }, { format: (v, dp) => (dp?.dataset?.yAxisID === 'p' ? fmt.pct(v) : format(v)), title });
}

export function donutChart(canvas, { items, format = (v) => fmt.num(v), share = true }) {
  const total = items.reduce((t, x) => t + (x.value || 0), 0);
  return mount(canvas, {
    type: 'doughnut',
    data: {
      labels: items.map((x) => x.label),
      datasets: [{ label: 'Komposisi', data: items.map((x) => x.value), backgroundColor: items.map((x) => x.color),
        $color: items[0]?.color, borderWidth: 0, borderRadius: 6, spacing: 3, hoverOffset: 4 }],
    },
    options: { cutout: '72%', layout: { padding: 6 }, interaction: { mode: 'nearest', intersect: true }, plugins: { tooltip: { enabled: false, external: externalTooltip } } },
  }, { title: () => 'Komposisi', format: (v) => `${format(v)}${share && total ? ` (${fmt.pct(v / total, 1)})` : ''}` });
}

export function bubbleChart(canvas, { points, xFormat, yFormat, xTitle, yTitle, refX = null, onClick }) {
  if (onClick) canvas.parentNode.classList.add('clickable');
  return mount(canvas, {
    type: 'bubble',
    data: {
      datasets: points.map((p) => ({
        label: p.label, data: [{ x: p.x, y: p.y, r: p.r }], $color: p.color, $rows: p.rows,
        backgroundColor: `${p.color}CC`, borderColor: C.surface, borderWidth: 2, hoverBorderWidth: 2, hoverBackgroundColor: p.color,
      })),
    },
    options: {
      layout: { padding: { top: 18, right: 18, left: 4 } },
      interaction: { mode: 'nearest', intersect: true },
      onClick: onClick ? (evt, els, chart) => { if (els.length) onClick(chart.data.datasets[els[0].datasetIndex].label); } : undefined,
      scales: {
        x: { grace: '6%', suggestedMax: refX ?? undefined, grid: { color: C.grid, drawTicks: false }, border: { display: false },
          title: xTitle ? { display: true, text: xTitle, color: C.muted, font: { size: 11 } } : undefined,
          ticks: { color: C.muted, padding: 6, maxTicksLimit: 6, font: { size: 10.5 }, callback: (v) => (xFormat ? xFormat(v) : v) } },
        y: { grace: '10%', grid: { color: C.grid, drawTicks: false }, border: { display: false },
          title: yTitle ? { display: true, text: yTitle, color: C.muted, font: { size: 11 } } : undefined,
          ticks: { color: C.muted, padding: 6, maxTicksLimit: 5, font: { size: 10.5 }, callback: (v) => (yFormat ? yFormat(v) : v) } },
      },
      plugins: {
        tooltip: { enabled: false, external: externalTooltip },
        refLines: { lines: refX !== null ? [{ axis: 'x', value: refX, label: 'RKA' }] : [] },
        datalabels: {
          display: 'auto', anchor: 'center', clamp: true, offset: (ctx) => (ctx.dataset.data[0].r || 6) + 2,
          align: (ctx) => {
            const { x, chartArea } = { x: ctx.chart.scales.x.getPixelForValue(ctx.dataset.data[0].x), chartArea: ctx.chart.chartArea };
            return chartArea && x > chartArea.right - 96 ? 'top' : 'right';
          },
          color: C.fg, font: { size: 11, weight: 600 }, formatter: (_v, ctx) => ctx.dataset.label,
        },
      },
    },
  }, { title: (p) => p[0].dataset.label, rows: (dp) => dp.dataset.$rows || [] });
}

export function bindLegend(el, chart, { shape = 'line', onHover } = {}) {
  el.innerHTML = chart.data.datasets.map((ds, i) => `<button type="button" class="legend-chip" data-i="${i}" aria-pressed="${chart.isDatasetVisible(i)}"
      style="--c:${ds.$color}"><i class="${shape === 'box' ? 'box' : (ds.borderDash?.length ? 'dash' : '')}"></i>${esc(ds.label)}</button>`).join('');
  el.querySelectorAll('.legend-chip').forEach((b) => {
    const i = Number(b.dataset.i);
    b.addEventListener('click', () => {
      const vis = !chart.isDatasetVisible(i);
      chart.setDatasetVisibility(i, vis);
      b.setAttribute('aria-pressed', String(vis));
      chart.update();
    });
    if (onHover) {
      b.addEventListener('mouseenter', () => onHover(chart.data.datasets[i].key ?? i));
      b.addEventListener('focus', () => onHover(chart.data.datasets[i].key ?? i));
      b.addEventListener('mouseleave', () => onHover(null));
      b.addEventListener('blur', () => onHover(null));
    }
  });
}

export function emphasize(prefix, key) {
  for (const [k, chart] of registry) {
    if (!k.startsWith(prefix) || chart.config.type !== 'line') continue;
    chart.data.datasets.forEach((ds) => {
      const on = key === null || ds.key === key;
      const color = on ? ds.$base : '#DADDE8';
      ds.borderColor = color;
      ds.pointBackgroundColor = color;
      ds.order = key !== null && ds.key === key ? -1 : (ds.$order ?? ds.order);
    });
    chart.update('none');
  }
}

export function toolButtons({ table = true, png = true } = {}) {
  return `<div class="chart-actions">
    ${table ? `<button class="icon-btn" type="button" data-tool="table" title="Lihat tabel data" aria-label="Lihat tabel data">${icon('table', 17)}</button>` : ''}
    ${png ? `<button class="icon-btn" type="button" data-tool="png" title="Unduh gambar chart" aria-label="Unduh gambar chart">${icon('download', 17)}</button>` : ''}
  </div>`;
}

export function downloadPng(chartOrId, name) {
  const chart = typeof chartOrId === 'string' ? registry.get(chartOrId) : chartOrId;
  if (!chart) return;
  const a = document.createElement('a');
  chart.$export = true;
  chart.draw();
  a.href = chart.toBase64Image('image/png', 1);
  chart.$export = false;
  chart.draw();
  a.download = `${name.replace(/[^\w-]+/g, '_')}.png`;
  a.click();
}
