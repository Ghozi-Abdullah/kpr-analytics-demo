import { esc, fmt } from '../core/format.js';
import { ok } from '../core/values.js';
import { pick, enhancePicks, seg, onSeg } from '../core/controls.js';
import { achLevel } from '../core/achievement.js';
import { MONTHS_SHORT } from '../core/dates.js';
import { lineChart, barChart, C, SERIES, CONTEXT_GRAY } from '../charts/charts.js';
import { loadTable } from '../services/data-source.js';
import { loadReal, loadPf, loadSla } from '../services/datasets.js';
import { indexPerf, NASIONAL, dayOf } from '../models/performance-model.js';
import { colorIndexOf, sumberMode } from '../models/realisasi-sumber.js';
import { periodsOf, perfPeriods, realPeriods, pfSplit, slaNow } from '../models/direktur-model.js';
import { PERF_UNIT, REAL_UNIT, PF_UNIT } from '../analytics/wording.js';

const soft = (p) => p.catch((err) => { console.warn(err); return null; });
const MINUS = '−';

const tn = (vM, d = 2) => fmt.rupiah(ok(vM) ? vM * PERF_UNIT : vM, d);
const signedTn = (vM) => (ok(vM) ? `${vM > 0 ? '+' : vM < 0 ? MINUS : ''}${fmt.rupiah(Math.abs(vM) * PERF_UNIT, 2)}` : '–');
const realRp = (v, d = 1) => fmt.rupiah(ok(v) ? v * REAL_UNIT : v, d);
const pfRp = (v, d = 2) => fmt.rupiah(ok(v) ? v * PF_UNIT : v, d);
const pct = (r, d = 2) => fmt.pct(r, d);
const shortMonth = (ym) => MONTHS_SHORT[Number(ym.slice(5, 7)) - 1];
const toDate = (iso) => `${dayOf(iso)} ${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]}`;
const splitValue = (v) => {
  const [n, u = ''] = String(v).split(' ');
  return { n, u };
};

function chip(r, d = 1) {
  if (!ok(r)) return '';
  return `<span class="dx-chip ${achLevel(r)}">${esc(pct(r, d))}</span>`;
}

function tile({ id, label, value, unit = '', badge = '', rows = [], hero = false, tag = '' }) {
  return `<section class="dx-tile${hero ? ' hero' : ''}" aria-labelledby="dx-t-${id}">
    <header><h2 id="dx-t-${id}">${esc(label)}</h2>${tag ? `<span class="dx-tag">${esc(tag)}</span>` : ''}${badge}</header>
    <p class="dx-value">${esc(value)}${unit ? `<small>${esc(unit)}</small>` : ''}</p>
    <dl class="dx-sub">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
  </section>`;
}

function tiles(c) {
  const p = c.now;
  const sla = c.sla;
  const os = splitValue(tn(p.os));
  const disb = splitValue(tn(p.disb));
  return [
    tile({ id: 'os', label: 'OS', value: os.n, unit: os.u, hero: true, badge: chip(p.achOs), rows: [['RKA', tn(p.rkaOs)], ['Gap', signedTn(ok(p.os) && ok(p.rkaOs) ? p.os - p.rkaOs : null)]] }),
    tile({ id: 'deb', label: 'Debitur', value: fmt.num(p.deb), badge: chip(p.achDeb), rows: [['RKA', fmt.num(p.rkaDeb)], ['Gap', fmt.signed(ok(p.deb) && ok(p.rkaDeb) ? p.deb - p.rkaDeb : null)]] }),
    tile({ id: 'sml', label: 'SML', value: pct(p.smlPct).replace('%', ''), unit: '%', badge: chip(p.achSml), rows: [['Nominal', tn(p.sml)], ['RKA', pct(p.rkaSmlPct)]] }),
    tile({ id: 'npl', label: 'NPL', value: pct(p.nplPct).replace('%', ''), unit: '%', badge: chip(p.achNpl), rows: [['Nominal', tn(p.npl)], ['RKA', pct(p.rkaNplPct)]] }),
    tile({ id: 'disb', label: 'Disburse', value: disb.n, unit: disb.u, badge: chip(p.progDisb), rows: [['Prognosa', tn(p.prognosa)], ['vs Guidance', pct(p.achDisb, 1)]] }),
    sla?.hasRows
      ? tile({ id: 'sla', label: 'Lewat SLA', value: fmt.num(sla.late), unit: 'berkas', tag: sla.sample ? 'contoh' : '',
        rows: [['Berjalan', fmt.num(sla.berkas)], ['Tepat SLA', pct(sla.onTime, 1)]] })
      : tile({ id: 'sla', label: 'Lewat SLA', value: '–', rows: [] }),
  ].join('');
}

function card(id, title, body, extra = '') {
  return `<section class="dx-card dx-${id}" aria-labelledby="dx-c-${id}">
    <header><h2 id="dx-c-${id}">${esc(title)}</h2>${extra}</header>${body}</section>`;
}

const key = (items) => `<ul class="dx-key">${items.map(([cls, label, color]) => `<li class="${cls}"${color ? ` style="--k:${color}"` : ''}><i></i>${esc(label)}</li>`).join('')}</ul>`;
const plot = (id, label) => `<div class="dx-plot"><canvas id="direktur-${id}" role="img" aria-label="${esc(label)}"></canvas></div>`;

const tipeColor = (t) => (t ? SERIES[colorIndexOf(t)] : CONTEXT_GRAY);

function realCard(c) {
  if (!c.real) return card('real', 'Realisasi', '<p class="dx-empty">–</p>');
  const modes = c.realModel.modes || ['7', '5'];
  const toggle = modes.length > 1 ? seg({ name: 'dx-sumber', label: 'Jumlah sumber', small: true, value: c.sel.sumber, options: modes.map((m) => ({ value: m, label: m })) }) : '';
  const legend = key(c.real.tipes.map((t) => ['sw', t || 'Lainnya', tipeColor(t)]));
  return card('real', 'Realisasi', `${plot('real', 'Realisasi per sumber, 3 bulan terakhir dan bulan berjalan')}${legend}`, toggle);
}

function splitCard(c) {
  const s = c.split;
  if (!s || !ok(s.os.fi) || !ok(s.os.nfi)) return card('split', 'FI · NFI', '<p class="dx-empty">–</p>');
  const bar = (fi, nfi) => {
    const total = (fi || 0) + (nfi || 0);
    const a = total ? (fi || 0) / total : 0;
    return `<span class="dx-split-bar" role="img" aria-label="FI ${esc(pct(a, 1))}, NFI ${esc(pct(1 - a, 1))}">
      <i class="fi" style="width:${(a * 100).toFixed(2)}%">${a >= 0.18 ? esc(pct(a, 0)) : ''}</i><i class="nfi" style="width:${((1 - a) * 100).toFixed(2)}%">${1 - a >= 0.18 ? esc(pct(1 - a, 0)) : ''}</i></span>`;
  };
  const rows = [
    ['OS', bar(s.os.fi, s.os.nfi), pfRp(s.os.fi), '', pfRp(s.os.nfi), ''],
    ['SML', bar(s.sml.fi, s.sml.nfi), pct(s.smlPct.fi), pfRp(s.sml.fi), pct(s.smlPct.nfi), pfRp(s.sml.nfi)],
    ['NPL', bar(s.npl.fi, s.npl.nfi), pct(s.nplPct.fi), pfRp(s.npl.fi), pct(s.nplPct.nfi), pfRp(s.npl.nfi)],
  ];
  const body = `<div class="dx-split-grid" role="table" aria-label="Fix Income dan Non Fix Income">
    <div class="dx-split-hd" role="row"><span role="columnheader"></span><span role="columnheader"></span><span role="columnheader" class="fi">FI</span><span role="columnheader" class="nfi">NFI</span></div>
    ${rows.map(([k, b, fi, fiSub, nfi, nfiSub]) => `<div class="dx-split-row" role="row"><span role="rowheader">${k}</span><span role="cell">${b}</span>
      <span role="cell"><b>${esc(fi)}</b>${fiSub ? `<small>${esc(fiSub)}</small>` : ''}</span><span role="cell"><b>${esc(nfi)}</b>${nfiSub ? `<small>${esc(nfiSub)}</small>` : ''}</span></div>`).join('')}
  </div>`;
  return card('split', 'FI · NFI', body, `<span class="dx-asof">${esc(fmt.month(s.month, true))}</span>`);
}

function slaCard(c) {
  const s = c.sla;
  if (!s?.hasRows) return card('sla', 'SLA', '<p class="dx-empty">–</p>');
  const max = Math.max(1, ...s.stages.map((x) => x.berkas));
  const cairNow = s.cair.get(c.cur);
  const rows = s.stages.map((x) => `<li><span class="k">${esc(x.label)}</span>
    <span class="dx-sla-bar" role="img" aria-label="${esc(`${x.label}: ${fmt.num(x.berkas)} berkas, ${fmt.num(x.late)} lewat SLA`)}">
      <i class="ok" style="width:${(((x.berkas - x.late) / max) * 100).toFixed(2)}%"></i><i class="late" style="width:${((x.late / max) * 100).toFixed(2)}%"></i></span>
    <b>${esc(fmt.num(x.berkas))}</b><em${x.late ? '' : ' class="zero"'}>${esc(fmt.num(x.late))}</em></li>`).join('');
  const foot = cairNow ? `<p class="dx-sla-foot"><span>Cair ${esc(shortMonth(c.cur))}</span><b>${esc(fmt.num(cairNow.berkas))}</b><span>${esc(fmt.rupiah(cairNow.nominal, 1))}</span></p>` : '';
  const extra = `${s.sample ? '<span class="dx-tag">contoh</span>' : ''}${key([['ok', 'Tepat'], ['late', 'Lewat']])}`;
  return card('sla', 'SLA', `<ul class="dx-sla-list">${rows}</ul>${foot}`, extra);
}

function tableCard(c) {
  const rows = [...c.periods].reverse();
  const cair = (m) => c.sla?.cair.get(m)?.berkas;
  const body = rows.map((p, i) => {
    const label = i === 0 && !p.full ? `s.d. ${toDate(p.date)}` : fmt.month(p.month, true);
    if (!p.end) return `<tr><th scope="row">${esc(label)}</th>${'<td>–</td>'.repeat(7)}</tr>`;
    return `<tr${i === 0 ? ' class="now"' : ''}><th scope="row">${esc(label)}</th>
      <td>${esc(tn(p.os))}</td><td>${chip(p.achOs)}</td><td>${esc(pct(p.nplPct))}</td><td>${esc(pct(p.smlPct))}</td>
      <td>${esc(tn(p.disb))}</td><td>${chip(p.achDisb)}</td><td>${esc(fmt.num(cair(p.month)))}</td></tr>`;
  }).join('');
  const table = `<div class="dx-table-wrap"><table class="dx-table">
    <thead><tr><th scope="col"></th><th scope="col">OS</th><th scope="col">vs RKA</th><th scope="col">%NPL</th><th scope="col">%SML</th><th scope="col">Disburse</th><th scope="col">vs Guidance</th><th scope="col">Cair</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
  return card('history', `${c.periods.length - 1} bulan`, table);
}

function screenHtml(c) {
  const where = c.sel.ro ? c.sel.ro.replace(/^.*\/\s*/, '') : NASIONAL;
  const roPick = pick({ id: 'dx-ro', label: 'RO', value: c.sel.ro, on: !!c.sel.ro, options: [{ value: '', label: NASIONAL }, ...c.pm.regions.map((r) => ({ value: r, label: r }))] });
  return `<div class="dx">
    <header class="dx-head">
      <h1>Dashboard KPR</h1>
      <button class="dx-pos" type="button" data-open-status><span class="dot" id="exec-status-dot"></span><span>${esc(where)}</span><span>${esc(fmt.date(c.now.date))}</span></button>
      <div class="dx-tools">${roPick}</div>
    </header>
    <div class="dx-kpis">${tiles(c)}</div>
    <div class="dx-grid">
      ${card('os', 'OS', plot('os', 'OS harian dan RKA, 3 bulan terakhir dan bulan berjalan'), key([['line', 'OS', C.accent], ['dash', 'RKA', C.muted]]))}
      ${card('quality', '%NPL · %SML', plot('quality', 'Persentase NPL dan SML harian'), key([['line', '%NPL', C.npl], ['line', '%SML', C.sml]]))}
      ${realCard(c)}
      ${splitCard(c)}
      ${slaCard(c)}
      ${tableCard(c)}
    </div>
  </div>`;
}

const monthTick = (iso, i) => (iso && (i === 0 || iso.endsWith('-01')) ? shortMonth(iso) : '');

function scaleTn(values) {
  const v = values.filter(ok);
  const span = v.length ? Math.max(...v) - Math.min(...v) : 0;
  const d = span < 500 ? 2 : span < 3000 ? 1 : 0;
  return (x) => fmt.rupiah(x * PERF_UNIT, d);
}

function drawCharts(root, c) {
  const days = c.periods.flatMap((p) => p.days);
  const labels = days.map((r) => r.tanggal);
  const at = (id) => root.querySelector(`#direktur-${id}`);
  const title = (pts) => fmt.date(labels[pts[0].dataIndex]);
  lineChart(at('os'), {
    labels, title, xLabel: monthTick, yAxis: true, values: 'last', beginAtZero: false,
    series: [
      { label: 'OS', data: days.map((r) => (ok(r.os) ? r.os : null)), color: C.accent, fill: true, width: 2.5 },
      { label: 'RKA', data: days.map((r) => (ok(r.rka_os) ? r.rka_os : null)), color: C.muted, dash: true, stepped: true, width: 1.5 },
    ],
    format: (v) => tn(v), tickFormat: scaleTn(days.flatMap((r) => [r.os, r.rka_os])),
  });
  const share = (a, b) => (ok(a) && ok(b) && b ? a / b : null);
  lineChart(at('quality'), {
    labels, title, xLabel: monthTick, yAxis: true, values: 'last', beginAtZero: false,
    series: [
      { label: '%NPL', data: days.map((r) => share(r.npl, r.os)), color: C.npl, width: 2.25 },
      { label: '%SML', data: days.map((r) => share(r.dpk, r.os)), color: C.sml, width: 2.25 },
    ],
    format: (v) => pct(v), tickFormat: (v) => pct(v, 1),
  });
  const realEl = at('real');
  if (realEl && c.real) {
    const last = c.real.months.length - 1;
    barChart(realEl, {
      labels: c.real.months.map((m, i) => (i === last && c.now.date && !c.now.full ? `1–${dayOf(c.now.date)} ${shortMonth(m.month)}` : shortMonth(m.month))),
      stacked: true, sort: 'stack',
      series: c.real.tipes.map((t) => ({ label: t || 'Lainnya', data: c.real.months.map((m) => m.by.get(t) || 0), color: tipeColor(t) })),
      format: (v) => realRp(v), labelFormat: (v) => realRp(v), tickFormat: (v) => realRp(v, 0),
      footer: { label: 'Total', value: (pts) => realRp(pts.reduce((s, p) => s + (p.parsed.y || 0), 0)) },
    });
  }
}

export default {
  id: 'direktur', title: 'Direktur', icon: 'star', screen: true,
  async load() {
    const [perf, real, pf, sla] = await Promise.all([loadTable('perf_daily.json'), soft(loadReal()), soft(loadPf()), soft(loadSla())]);
    return { pm: indexPerf(perf, []), real, pf, sla };
  },
  normalize(p, m) {
    return {
      ro: m.pm.regions.includes(p.ro) ? p.ro : '',
      sumber: m.real ? sumberMode(p.sumber, m.real) : '7',
    };
  },
  context(m, sel) {
    const months = periodsOf(m.pm);
    const periods = perfPeriods(m.pm, sel.ro, months);
    return {
      pm: m.pm, sel, cur: months.at(-1), periods, now: periods.at(-1) || {},
      realModel: m.real,
      real: m.real ? realPeriods(m.real, sel.ro, months, sel.sumber) : null,
      split: m.pf ? pfSplit(m.pf, sel.ro) : null,
      sla: m.sla ? slaNow(m.sla, sel.ro, months) : null,
    };
  },
  subtitle(c) {
    return `${c.sel.ro || NASIONAL}, posisi ${fmt.date(c.now.date)}`;
  },
  skeleton() {
    return `<div class="dx dx-loading" aria-hidden="true"><div class="dx-head"><h1>Dashboard KPR</h1></div>
      <div class="dx-kpis">${'<section class="dx-tile"></section>'.repeat(6)}</div>
      <div class="dx-grid">${'<section class="dx-card"></section>'.repeat(6)}</div></div>`;
  },
  render(root, c, { set }) {
    root.innerHTML = screenHtml(c);
    enhancePicks(root);
    root.querySelector('#dx-ro')?.addEventListener('change', (e) => set({ ro: e.target.value }));
    onSeg(root, 'dx-sumber', (v) => set({ sumber: v === '7' ? '' : v }));
    drawCharts(root, c);
  },
};
