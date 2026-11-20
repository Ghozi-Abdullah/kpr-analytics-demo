import { esc, fmt } from '../core/format.js';
import { ok, ratio } from '../core/values.js';
import { pick, enhancePicks, seg, onSeg } from '../core/controls.js';
import { achLevel } from '../core/achievement.js';
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

function kpi({ id, label, value, unit = '', bar, status, note = [], wide = false }) {
  return `<section class="dx-kpi${wide ? ' wide' : ''}" aria-labelledby="dx-k-${id}">
    <h2 id="dx-k-${id}">${esc(label)}</h2>
    <p class="dx-kpi-v">${esc(value)}${unit ? `<small>${esc(unit)}</small>` : ''}</p>
    ${bar}
    <p class="dx-kpi-s">${status}${note.map(([k, v]) => `<span>${k ? `${esc(k)} ` : ''}<b>${esc(v)}</b></span>`).join('')}</p>
  </section>`;
}

const stat = (r, word) => (ok(r) ? `<strong class="${level(r)}">${esc(pct(r, 1))}</strong><span>${esc(word)}</span>` : '');

function band(c) {
  const p = c.now;
  const sla = c.sla;
  const os = unitOf(tn(p.os));
  const disb = unitOf(tn(p.disb));
  const items = [
    kpi({ id: 'os', label: 'Outstanding', value: os.n, unit: os.u, wide: true, bar: meter(ratio(p.os, p.rkaOs)),
      status: stat(p.achOs, 'RKA'), note: [['Gap', signedTn(ok(p.os) && ok(p.rkaOs) ? p.os - p.rkaOs : null)]] }),
    kpi({ id: 'deb', label: 'Debitur', value: fmt.num(p.deb), bar: meter(ratio(p.deb, p.rkaDeb)),
      status: stat(p.achDeb, 'RKA'), note: [['Gap', fmt.signed(ok(p.deb) && ok(p.rkaDeb) ? p.deb - p.rkaDeb : null)]] }),
    kpi({ id: 'sml', label: 'SML', value: pct(p.smlPct).replace('%', ''), unit: '%', bar: meter(ratio(p.sml, p.rkaSml), { inverse: true }),
      status: '', note: [['RKA', pct(p.rkaSmlPct)], ['', tn(p.sml)]] }),
    kpi({ id: 'npl', label: 'NPL', value: pct(p.nplPct).replace('%', ''), unit: '%', bar: meter(ratio(p.npl, p.rkaNpl), { inverse: true }),
      status: '', note: [['RKA', pct(p.rkaNplPct)], ['', tn(p.npl)]] }),
    kpi({ id: 'disb', label: 'Disburse', value: disb.n, unit: disb.u, bar: meter(p.progDisb),
      status: stat(p.progDisb, 'prognosa') }),
    sla?.hasRows
      ? kpi({ id: 'sla', label: sla.sample ? 'Lewat SLA (contoh)' : 'Lewat SLA', value: fmt.num(sla.late), unit: 'berkas', bar: meter(null, { fill: sla.onTime }),
        status: stat(sla.onTime, 'tepat'), note: [['Berjalan', fmt.num(sla.berkas)]] })
      : kpi({ id: 'sla', label: 'Lewat SLA', value: '–', bar: meter(null), status: '' }),
  ];
  return `<div class="dx-band">${items.join('')}</div>`;
}

function section(id, title, body, aside = '') {
  return `<section class="dx-sec dx-${id}" aria-labelledby="dx-s-${id}">
    <header><h2 id="dx-s-${id}">${esc(title)}</h2>${aside}</header>${body}</section>`;
}

const plot = (id, label) => `<div class="dx-plot"><canvas id="direktur-${id}" role="img" aria-label="${esc(label)}"></canvas></div>`;

function osSection(c) {
  const p = c.now;
  const aside = `<p class="dx-aside"><span><i class="ln os"></i>OS</span><span><i class="ln rka"></i>RKA ${esc(tn(p.rkaOs))}</span></p>`;
  return section('os', 'OS harian', plot('os', `OS harian ${monthLong(c.cur)} dibanding RKA`), aside);
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
  const max = Math.max(1, ...r.rows.map((x) => Math.max(x.value, x.prev)));
  const delta = (ch) => (ok(ch) ? `<em class="${ch >= 0 ? 'up' : 'down'}">${esc(fmt.signedPct(ch, 0))}</em>` : '<em></em>');
  const rows = r.rows.map((x) => `<li style="--c:${tipeColor(x.tipe)}">
      <span class="n">${esc(x.tipe || 'Lainnya')}</span>
      <span class="b" role="img" aria-label="${esc(`${x.tipe || 'Lainnya'}: ${realRp(x.value)}, bulan lalu ${realRp(x.prev)}`)}"><i style="width:${((x.value / max) * 100).toFixed(1)}%"></i><s style="left:${((x.prev / max) * 100).toFixed(1)}%"></s></span>
      <b>${esc(realRp(x.value))}</b>${delta(x.change)}</li>`).join('');
  const total = `<p class="dx-aside dx-real-total"><b>${esc(realRp(r.total))}</b>${delta(r.change)}<small>vs bulan lalu</small></p>`;
  const prevWord = r.full ? 'bulan lalu' : `bulan lalu s.d. tgl ${r.lastDay}`;
  const bar = `<div class="dx-real-bar">${toggle}<span class="dx-real-key"><i></i>${esc(prevWord)}</span></div>`;
  return section('real', 'Realisasi', `${bar}<ol class="dx-src">${rows}</ol>`, total);
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
  if (at('os') && days.length) {
    lineChart(at('os'), {
      labels, title, yAxis: true, values: 'last', beginAtZero: false, pulse: true,
      series: [
        { label: 'OS', data: days.map((r) => (ok(r.os) ? r.os : null)), color: C.accent, fill: true, width: 2.75 },
        { label: 'RKA', data: days.map((r) => (ok(r.rka_os) ? r.rka_os : null)), color: C.muted, dash: true, width: 1.5, lab: 'none' },
      ],
      format: (v) => tn(v), tickFormat: scaleTn(days.flatMap((r) => [r.os, r.rka_os])),
    });
  }
  const daily = (id, key, rkaKey, color, label) => {
    const el = at(id);
    if (!el || !days.length) return;
    const bars = days.map((r) => (ok(r[key]) ? r[key] : null));
    const rka = days.map((r) => r[rkaKey]).filter(ok).at(-1);
    bandCombo(el, {
      labels, title, bars, pct: days.map((r) => ratio(r[key], r.os)),
      barColors: bars.map((v) => (ok(v) && ok(rka) && v > rka ? OVER : `${color}66`)),
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
      pm: m.pm, sel, cur, periods, now: periods.at(-1) || {},
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
