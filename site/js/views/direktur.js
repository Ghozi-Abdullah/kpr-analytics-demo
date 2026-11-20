import { esc, fmt } from '../core/format.js';
import { ok, ratio } from '../core/values.js';
import { pick, enhancePicks, seg, onSeg } from '../core/controls.js';
import { achLevel } from '../core/achievement.js';
import { sparkline } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { MONTHS_SHORT, MONTHS } from '../core/dates.js';
import { lineChart, bandCombo, C, SERIES, CONTEXT_GRAY } from '../charts/charts.js';
import { loadTable } from '../services/data-source.js';
import { loadReal, loadPf, loadSla } from '../services/datasets.js';
import { indexPerf, NASIONAL, dayOf } from '../models/performance-model.js';
import { colorIndexOf, sumberMode } from '../models/realisasi-sumber.js';
import { periodsOf, perfPeriods, realCompare, pfSplit, slaNow } from '../models/direktur-model.js';
import { PERF_UNIT, REAL_UNIT, PF_UNIT } from '../analytics/wording.js';

const soft = (p) => p.catch((err) => { console.warn(err); return null; });
const MINUS = '−';
const OVER = '#EB6834';

const tn = (vM, d = 2) => fmt.rupiah(ok(vM) ? vM * PERF_UNIT : vM, d);
const signedTn = (vM) => (ok(vM) ? `${vM > 0 ? '+' : vM < 0 ? MINUS : ''}${fmt.rupiah(Math.abs(vM) * PERF_UNIT, 2)}` : '–');
const realRp = (v, d = 1) => fmt.rupiah(ok(v) ? v * REAL_UNIT : v, d);
const pfRp = (v, d = 2) => fmt.rupiah(ok(v) ? v * PF_UNIT : v, d);
const pct = (r, d = 2) => fmt.pct(r, d);
const monthLong = (ym) => (ym ? `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : '');
const toDate = (iso) => `${dayOf(iso)} ${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]}`;
const unitOf = (v) => {
  const [n, u = ''] = String(v).split(' ');
  return { n, u };
};
const tipeColor = (t) => (t ? SERIES[colorIndexOf(t)] : CONTEXT_GRAY);
const level = (r) => (ok(r) ? achLevel(r) : 'none');

function meter(r, { inverse = false, fill = null } = {}) {
  if (!ok(r) && !ok(fill)) return '<span class="dx-meter none" aria-hidden="true"></span>';
  const span = 1.25;
  const w = ok(fill) ? Math.max(0, Math.min(1, fill)) : Math.max(0, Math.min(span, r)) / span;
  const state = ok(fill) ? level(fill) : level(inverse ? 1 / r : r);
  return `<span class="dx-meter ${state}" aria-hidden="true" title="${ok(fill) ? 'Isi = persentase' : 'Garis putih = RKA'}"><i style="width:${(w * 100).toFixed(1)}%"></i>${ok(fill) ? '' : `<b style="left:${(100 / span).toFixed(1)}%"></b>`}</span>`;
}

function delta(v, { text, good, prev, tip }) {
  if (!ok(v)) return '';
  const dir = v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
  const tone = v === 0 ? 'flat' : (v > 0) === good ? 'good' : 'bad';
  const arrow = v > 0 ? '▲' : v < 0 ? '▼' : '■';
  return `<span class="dx-delta ${dir} ${tone}" title="${esc(tip)}">${arrow} ${esc(text)}<small>vs ${esc(prev)}</small></span>`;
}

function kpi({ id, label, value, unit = '', bar, status, note = [], wide = false, change = '', trend = [] }) {
  return `<section class="dx-kpi${wide ? ' wide' : ''}" aria-labelledby="dx-k-${id}">
    <header><h2 id="dx-k-${id}">${esc(label)}</h2>${change}</header>
    <div class="dx-kpi-row"><p class="dx-kpi-v">${esc(value)}${unit ? `<small>${esc(unit)}</small>` : ''}</p>${trend.filter(ok).length > 1 ? sparkline(trend, { w: 84, h: 30, color: '#FFFFFF' }) : ''}</div>
    ${bar}
    <p class="dx-kpi-s">${status}${note.map(([k, v]) => `<span>${k ? `${esc(k)} ` : ''}<b>${esc(v)}</b></span>`).join('')}</p>
  </section>`;
}

const stat = (r, word) => (ok(r) ? `<strong class="${level(r)}">${esc(pct(r, 1))}</strong><span>${esc(word)}</span>` : '');

function band(c) {
  const p = c.now;
  const prev = c.prev || {};
  const pm = prev.month ? MONTHS_SHORT[Number(prev.month.slice(5, 7)) - 1] : '';
  const days = p.days || [];
  const sla = c.sla;
  const os = unitOf(tn(p.os));
  const disb = unitOf(tn(p.disb));
  const diff = (a, b) => (ok(a) && ok(b) ? a - b : null);
  const ppText = (v) => `${fmt.num(Math.abs(v) * 100, 2)}%`;
  const disbPrev = p.end?.disburse_lalu;
  const disbCh = ok(p.disb) && ok(disbPrev) && disbPrev ? p.disb / disbPrev - 1 : null;
  const items = [
    kpi({ id: 'os', label: 'Outstanding', value: os.n, unit: os.u, wide: true, bar: meter(ratio(p.os, p.rkaOs)), trend: days.map((r) => r.os),
      change: delta(diff(p.os, prev.os), { text: tn(Math.abs(diff(p.os, prev.os) ?? 0)), good: true, prev: pm, tip: `Dibanding OS akhir ${monthLong(prev.month)}` }),
      status: stat(p.achOs, 'RKA'), note: [['Gap', signedTn(diff(p.os, p.rkaOs))]] }),
    kpi({ id: 'deb', label: 'Debitur', value: fmt.num(p.deb), bar: meter(ratio(p.deb, p.rkaDeb)), trend: days.map((r) => r.debitur),
      change: delta(diff(p.deb, prev.deb), { text: fmt.num(Math.abs(diff(p.deb, prev.deb) ?? 0)), good: true, prev: pm, tip: `Dibanding debitur akhir ${monthLong(prev.month)}` }),
      status: stat(p.achDeb, 'RKA'), note: [['Gap', fmt.signed(diff(p.deb, p.rkaDeb))]] }),
    kpi({ id: 'sml', label: 'SML', value: pct(p.smlPct).replace('%', ''), unit: '%', bar: meter(ratio(p.sml, p.rkaSml), { inverse: true }), trend: days.map((r) => ratio(r.dpk, r.os)),
      change: delta(diff(p.smlPct, prev.smlPct), { text: ppText(diff(p.smlPct, prev.smlPct) ?? 0), good: false, prev: pm, tip: `Dibanding %SML akhir ${monthLong(prev.month)}` }),
      status: '', note: [['RKA', pct(p.rkaSmlPct)], ['', tn(p.sml)]] }),
    kpi({ id: 'npl', label: 'NPL', value: pct(p.nplPct).replace('%', ''), unit: '%', bar: meter(ratio(p.npl, p.rkaNpl), { inverse: true }), trend: days.map((r) => ratio(r.npl, r.os)),
      change: delta(diff(p.nplPct, prev.nplPct), { text: ppText(diff(p.nplPct, prev.nplPct) ?? 0), good: false, prev: pm, tip: `Dibanding %NPL akhir ${monthLong(prev.month)}` }),
      status: '', note: [['RKA', pct(p.rkaNplPct)], ['', tn(p.npl)]] }),
    kpi({ id: 'disb', label: 'Disburse', value: disb.n, unit: disb.u, bar: meter(p.progDisb), trend: days.map((r) => r.disburse),
      change: delta(disbCh, { text: fmt.pct(Math.abs(disbCh ?? 0), 0), good: true, prev: pm, tip: `Dibanding disburse ${monthLong(prev.month)} pada tanggal yang sama` }),
      status: stat(p.progDisb, 'prognosa') }),
    sla?.hasRows
      ? kpi({ id: 'sla', label: sla.sample ? 'Lewat SLA (contoh)' : 'Lewat SLA', value: fmt.num(sla.late), unit: 'berkas', bar: meter(null, { fill: sla.onTime }),
        status: stat(sla.onTime, 'tepat'), note: [['Berjalan', fmt.num(sla.berkas)]] })
      : kpi({ id: 'sla', label: 'Lewat SLA', value: '–', bar: meter(null), status: '' }),
  ];
  return `<div class="dx-band">${items.join('')}</div>`;
}

const SEC_ICON = { os: 'wallet', npl: 'shield', sml: 'flag', real: 'send', split: 'layers', sla: 'clock', history: 'table' };

function section(id, title, body, aside = '') {
  return `<section class="dx-sec dx-${id}" aria-labelledby="dx-s-${id}">
    <header><h2 id="dx-s-${id}"><span class="dx-ico" aria-hidden="true">${icon(SEC_ICON[id] || 'pulse', 15)}</span>${esc(title)}</h2>${aside}</header>${body}</section>`;
}

const plot = (id, label) => `<div class="dx-plot"><canvas id="direktur-${id}" role="img" aria-label="${esc(label)}"></canvas></div>`;

function osSection(c) {
  const p = c.now;
  const prev = c.prev || {};
  const key = `<p class="dx-q-key"><span><i class="ln os"></i>${esc(fmt.month(c.cur, true))}</span>${prev.month ? `<span><i class="ln prev"></i>${esc(fmt.month(prev.month, true))}</span>` : ''}<span><i class="ln rka"></i>RKA</span></p>`;
  const aside = `<p class="dx-aside dx-q-h"><span class="${level(p.achOs)}">${esc(tn(p.os))}</span><small>RKA ${esc(tn(p.rkaOs))}</small></p>`;
  return section('os', 'OS harian', `${key}${plot('os', `OS harian ${monthLong(c.cur)} dibanding ${monthLong(prev.month)} dan RKA`)}`, aside);
}

function qualitySection(c, id, label, value, rka) {
  const aside = `<p class="dx-aside dx-q-h"><span class="${level(ok(value) && value ? rka / value : null)}">${esc(pct(value))}</span><small>RKA ${esc(pct(rka))}</small></p>`;
  const key = `<p class="dx-q-key"><span><i class="sw ${id}"></i>Nominal</span><span><i class="sw over"></i>Di atas RKA</span><span><i class="ln ${id}"></i>%${esc(label)}</span></p>`;
  return section(id, `${label} harian`, `${key}${plot(id, `${label} harian ${monthLong(c.cur)}: nominal dan persentase terhadap OS, dibanding RKA`)}`, aside);
}

function realSection(c) {
  const r = c.real;
  if (!r) return section('real', 'Realisasi', '<p class="dx-empty">–</p>');
  const modes = c.realModel.modes || ['7', '5'];
  const toggle = modes.length > 1 ? seg({ name: 'dx-sumber', label: 'Pembagian sumber realisasi', small: true, value: c.sel.sumber, options: modes.map((m) => ({ value: m, label: `${m} sumber` })) }) : '';
  const change = (ch) => (ok(ch) ? `<em class="${ch >= 0 ? 'up' : 'down'}">${esc(fmt.signedPct(ch, 0))}</em>` : '<em>–</em>');
  const total = `<p class="dx-aside dx-real-total"><b>${esc(realRp(r.total))}</b>${change(r.change)}<small>vs bulan lalu</small></p>`;
  const live = r.rows.filter((x) => x.value > 0);
  const mix = `<div class="dx-mix" role="img" aria-label="Porsi realisasi per sumber">${live.map((x) => `<i style="flex:${x.value};--c:${tipeColor(x.tipe)}" title="${esc(`${x.tipe || 'Lainnya'} ${pct(r.total ? x.value / r.total : null, 1)}`)}"></i>`).join('')}</div>`;
  const tip = r.full ? 'Dibanding bulan lalu' : `Dibanding bulan lalu sampai tanggal ${r.lastDay}`;
  const rows = r.rows.map((x) => `<li><i style="--c:${tipeColor(x.tipe)}"></i><span class="n">${esc(x.tipe || 'Lainnya')}</span>
      <b>${esc(realRp(x.value))}</b><span class="s">${esc(pct(r.total ? x.value / r.total : null, 0))}</span>${change(x.change)}</li>`).join('');
  const body = `<div class="dx-real-bar">${toggle}</div>${mix}
    <div class="dx-src-hd" aria-hidden="true"><span></span><span></span><span>Nilai</span><span>Porsi</span><span title="${esc(tip)}">vs bulan lalu</span></div>
    <ol class="dx-src">${rows}</ol>`;
  return section('real', 'Realisasi', body, total);
}

function splitSection(c) {
  const s = c.split;
  if (!s || !ok(s.os.fi) || !ok(s.os.nfi)) return section('split', 'FI dan NFI', '<p class="dx-empty">–</p>');
  const bar = (fi, nfi) => {
    const total = (fi || 0) + (nfi || 0);
    const a = total ? (fi || 0) / total : 0;
    return `<span class="dx-split-bar" role="img" aria-label="FI ${esc(pct(a, 1))}, NFI ${esc(pct(1 - a, 1))}">
      <i class="fi" style="width:${(a * 100).toFixed(2)}%">${esc(pct(a, 0))}</i><i class="nfi" style="width:${((1 - a) * 100).toFixed(2)}%">${esc(pct(1 - a, 0))}</i></span>`;
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
  return section('split', 'FI dan NFI', body, `<p class="dx-aside">${esc(monthLong(s.month))}</p>`);
}

function slaSection(c) {
  const s = c.sla;
  if (!s?.hasRows) return section('sla', 'Berkas SLA', '<p class="dx-empty">–</p>');
  const max = Math.max(1, ...s.stages.map((x) => x.berkas));
  const rows = s.stages.map((x) => `<li><span class="k">${esc(x.label)}</span>
    <span class="dx-sla-bar" role="img" aria-label="${esc(`${x.label}: ${fmt.num(x.berkas)} berkas, ${fmt.num(x.late)} lewat SLA`)}">
      <i class="ok" style="width:${(((x.berkas - x.late) / max) * 100).toFixed(2)}%"></i><i class="late" style="width:${((x.late / max) * 100).toFixed(2)}%"></i></span>
    <b>${esc(fmt.num(x.berkas))}</b><em${x.late ? '' : ' class="zero"'}>${esc(fmt.num(x.late))}</em></li>`).join('');
  const aside = `<p class="dx-aside">${s.sample ? '<span class="dx-sample">data contoh</span>' : ''}<span><i class="sq ok"></i>Tepat</span><span><i class="sq late"></i>Lewat</span></p>`;
  return section('sla', 'Berkas SLA', `<ul class="dx-sla-list">${rows}</ul>`, aside);
}

function historySection(c) {
  const rows = [...c.periods].reverse();
  const tone = (r) => `<span class="dx-ach ${level(r)}">${esc(ok(r) ? pct(r, 1) : '–')}</span>`;
  const body = rows.map((p, i) => {
    const label = i === 0 && !p.full ? `s.d. ${toDate(p.date)}` : fmt.month(p.month, true);
    if (!p.end) return `<tr><th scope="row">${esc(label)}</th>${'<td>–</td>'.repeat(6)}</tr>`;
    return `<tr${i === 0 ? ' class="now"' : ''}><th scope="row">${esc(label)}</th>
      <td>${esc(tn(p.os))}</td><td>${tone(p.achOs)}</td><td>${esc(pct(p.nplPct))}</td><td>${esc(pct(p.smlPct))}</td>
      <td>${esc(tn(p.disb))}</td><td>${tone(p.achDisb)}</td></tr>`;
  }).join('');
  const table = `<div class="dx-table-wrap"><table class="dx-table">
    <thead><tr><th scope="col"></th><th scope="col">OS</th><th scope="col">vs RKA</th><th scope="col">%NPL</th><th scope="col">%SML</th><th scope="col">Disburse</th><th scope="col">vs Guidance</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
  return section('history', `${c.periods.length - 1} bulan terakhir`, table);
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
    ${band(c)}
    <div class="dx-sheet dx-sheet-a">${osSection(c)}${qualitySection(c, 'npl', 'NPL', c.now.nplPct, c.now.rkaNplPct)}${qualitySection(c, 'sml', 'SML', c.now.smlPct, c.now.rkaSmlPct)}${realSection(c)}</div>
    <div class="dx-sheet dx-sheet-b">${splitSection(c)}${slaSection(c)}${historySection(c)}</div>
  </div>`;
}

function scaleTn(values) {
  const v = values.filter(ok);
  const span = v.length ? Math.max(...v) - Math.min(...v) : 0;
  const d = span < 500 ? 2 : span < 3000 ? 1 : 0;
  return (x) => fmt.rupiah(x * PERF_UNIT, d);
}

function drawCharts(root, c) {
  const days = c.now.days || [];
  const labels = days.map((r) => String(dayOf(r.tanggal)));
  const at = (id) => root.querySelector(`#direktur-${id}`);
  const title = (pts) => fmt.date(days[pts[0].dataIndex]?.tanggal);
  const prevDays = c.prev?.days || [];
  if (at('os') && days.length) {
    const n = Math.max(days.length, prevDays.length);
    const byDay = (list, k) => Array.from({ length: n }, (_, i) => { const r = list.find((x) => dayOf(x.tanggal) === i + 1); return r && ok(r[k]) ? r[k] : null; });
    const cur = byDay(days, 'os');
    const prv = byDay(prevDays, 'os');
    const rka = byDay(days, 'rka_os');
    const curName = MONTHS_SHORT[Number(c.cur.slice(5, 7)) - 1];
    const prevName = c.prev?.month ? MONTHS_SHORT[Number(c.prev.month.slice(5, 7)) - 1] : '';
    lineChart(at('os'), {
      labels: Array.from({ length: n }, (_, i) => String(i + 1)), title: (pts) => `Tanggal ${pts[0].dataIndex + 1}`,
      yAxis: true, values: 'last', beginAtZero: false, pulse: true,
      series: [
        { label: curName, data: cur, color: C.accent, fill: true, width: 2.75 },
        ...(prevName ? [{ label: prevName, data: prv, color: C.prev, width: 2 }] : []),
        { label: 'RKA', data: rka, color: C.muted, dash: true, width: 1.5, lab: 'none' },
      ],
      format: (v) => tn(v), tickFormat: scaleTn([...cur, ...prv, ...rka]),
    });
  }
  const daily = (id, key, rkaKey, color, label) => {
    const el = at(id);
    if (!el || !days.length) return;
    const bars = days.map((r) => (ok(r[key]) ? r[key] : null));
    const rka = days.map((r) => r[rkaKey]).filter(ok).at(-1);
    const last = bars.length - 1;
    bandCombo(el, {
      labels, title, bars, pct: days.map((r) => ratio(r[key], r.os)),
      barColors: bars.map((v, i) => {
        const over = ok(v) && ok(rka) && v > rka;
        if (i === last) return over ? OVER : color;
        return over ? `${OVER}A6` : `${color}55`;
      }),
      color: `${color}66`, lineColor: color, barLabel: `${label} nominal`, pctLabel: `%${label}`,
      format: (v) => tn(v), labelFormat: (v) => tn(v, 1), tickFormat: (v) => tn(v, 1), barValues: false, lineValues: false,
      refs: ok(rka) ? [{ axis: 'y', value: rka, label: `RKA ${tn(rka, 1).replace(' ', '\u00a0')}` }] : [],
    });
  };
  daily('npl', 'npl', 'rka_npl', C.npl, 'NPL');
  daily('sml', 'dpk', 'rka_dpk', C.sml, 'SML');
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
    const cur = months.at(-1);
    return {
      pm: m.pm, sel, cur, periods, now: periods.at(-1) || {}, prev: periods.at(-2) || null,
      realModel: m.real,
      real: m.real?.rows.length ? realCompare(m.real, sel.ro, sel.sumber, cur) : null,
      split: m.pf ? pfSplit(m.pf, sel.ro) : null,
      sla: m.sla ? slaNow(m.sla, sel.ro, months) : null,
    };
  },
  subtitle(c) {
    return `${c.sel.ro || NASIONAL}, posisi ${fmt.date(c.now.date)}`;
  },
  skeleton() {
    return `<div class="dx dx-loading" aria-hidden="true"><div class="dx-head"><h1>Dashboard KPR</h1></div>
      <div class="dx-band"></div><div class="dx-sheet dx-sheet-a"></div><div class="dx-sheet dx-sheet-b"></div></div>`;
  },
  render(root, c, { set }) {
    root.innerHTML = screenHtml(c);
    enhancePicks(root);
    root.querySelector('#dx-ro')?.addEventListener('change', (e) => set({ ro: e.target.value }));
    onSeg(root, 'dx-sumber', (v) => set({ sumber: v === '7' ? '' : v }));
    drawCharts(root, c);
  },
};
