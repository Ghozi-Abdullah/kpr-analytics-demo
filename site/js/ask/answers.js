import { ok, ratio } from '../core/values.js';
import { esc } from '../core/format.js';
import { daysInMonth, shiftMonth, weekday } from '../core/dates.js';
import { NASIONAL } from '../models/performance-model.js';
import { NODE } from '../models/portfolio-model.js';
import { PORTFOLIO_NODES } from '../config.js';
import { filterKeyOf, modeOf } from '../models/realisasi-sumber.js';
import { buildTerritory } from '../map/territory.js';
import { METRO_NAME, metroArea } from '../map/metro-areas.js';
import { provinceName } from '../map/indonesia-map.js';
import { kancaLabel } from '../map/branch-locations.js';
import { preparePf } from '../services/datasets.js';
import { outlook, simulate, simulateCurrent } from '../analytics/outlook.js';
import { outlookText, roRows, liftText, liftTone, LIFT_WORD } from '../analytics/outlook-text.js';
import {
  perfScope, growthEngine, realFilter, realTotals, realGroup, workdaysOf, pfLabels, pfSums, pfGroup,
} from '../analytics/measures.js';
import {
  buildInsights, growthInsight, spreadInsight, qualityInsight, paceInsights, realScope, volumeInsight, mixInsight, anomalyInsight,
  realProjectionInsight, pfScope, hotspotInsight, segmentInsight, incomeInsight,
} from '../analytics/insights.js';
import {
  rp, rpM, rpMSigned, rpReal, rpRealSigned, pct, signedPct, bps, bpsSigned, num, signedNum, listJoin, roName, monthName, monthYear,
  dateText, dateShort, median, sum, PF_UNIT,
} from '../analytics/wording.js';
import { ISLANDS, GLOSSARY, EXAMPLES, PROVINCE_ALIASES } from './lexicon.js';

const b = (t) => `<b>${t}</b>`;
const cap = (html) => String(html).replace(/^((?:<[^>]+>)*)(\p{Ll})/u, (m, tags, ch) => tags + ch.toUpperCase());
const plain = (h) => String(h || '').replace(/<[^>]+>/g, '');
const pad = (n) => String(n).padStart(2, '0');
const monthEnd = (ym) => `${ym}-${pad(daysInMonth(ym))}`;
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const PERF_SUM = ['os', 'gr_os', 'npl', 'dpk', 'disburse', 'debitur', 'gr_deb', 'jum_rm', 'jum_rm_lalu', 'rka_os', 'rka_npl', 'rka_dpk',
  'rka_deb', 'guidance_disb', 'prognosa_disb', 'helper_os', 'helper_npl', 'helper_dpk', 'helper_deb', 'disburse_lalu', 'graph_os_lalu'];

export function dataContext(hub) {
  const { pm, real, pf } = hub;
  const natRows = pm ? (pm.byRo.get(NASIONAL) || pm.byRo.get(pm.ros[0]) || []) : [];
  return {
    hub, pm, real, pf,
    perfLatest: natRows.at(-1)?.tanggal || null,
    perfDates: natRows.map((r) => r.tanggal),
    realLatest: real?.maxDate || null,
    pfLatest: pf?.index?.months?.at(-1) || null,
    regions: pm?.regions?.length ? pm.regions : (real?.ros || []),
    territory: pm?.territory || buildTerritory([], pm?.regions?.length ? pm.regions : (real?.ros || [])),
  };
}

function inferYear(month, anchor) {
  const ay = Number(anchor.slice(0, 4));
  return month <= Number(anchor.slice(5, 7)) ? ay : ay - 1;
}

export function resolvePeriod(t, D, source) {
  const anchor = source === 'perf' ? D.perfLatest : source === 'real' ? D.realLatest : (D.pfLatest ? monthEnd(D.pfLatest) : null);
  if (!anchor) return null;
  const am = anchor.slice(0, 7);
  const ay = anchor.slice(0, 4);
  const monthP = (ym, label = '') => {
    const future = ym > am;
    const end = ym === am ? anchor : monthEnd(ym);
    const partial = ym === am && anchor < monthEnd(ym);
    return {
      kind: 'month', month: ym, from: `${ym}-01`, to: end, date: end, months: [ym], future, partial,
      label: label || (partial ? `${monthYear(ym)} s.d. ${dateShort(anchor)}` : monthYear(ym)),
    };
  };
  const rangeP = (from, to, label) => ({ kind: 'range', month: to.slice(0, 7), from, to: to > anchor ? anchor : to, date: to > anchor ? anchor : to, months: [...new Set([from.slice(0, 7), to.slice(0, 7)])], label });
  const monthsP = (list, label) => ({
    kind: 'months', month: list.at(-1), from: `${list[0]}-01`, to: list.at(-1) >= am ? anchor : monthEnd(list.at(-1)), date: list.at(-1) >= am ? anchor : monthEnd(list.at(-1)),
    months: list.filter((m) => m <= am), label,
  });
  switch (t?.kind) {
    case 'monthRel': return monthP(shiftMonth(am, t.n));
    case 'month': return monthP(`${t.year || inferYear(t.month, anchor)}-${pad(t.month)}`);
    case 'monthRange': {
      const y = t.year || inferYear(t.month, anchor);
      const a = `${y}-${pad(t.month)}`;
      const z = `${t.month2 >= t.month ? y : y + 1}-${pad(t.month2)}`;
      const list = [];
      for (let m = a; m <= z && list.length < 24; m = shiftMonth(m, 1)) list.push(m);
      return monthsP(list, `${monthYear(a)} sampai ${monthYear(z)}`);
    }
    case 'date': {
      const back = !t.month && t.day > Number(anchor.slice(8, 10));
      const baseMonth = back ? shiftMonth(am, -1) : am;
      const m = t.month || Number(baseMonth.slice(5, 7));
      const y = t.year || (t.month ? inferYear(t.month, anchor) : Number(baseMonth.slice(0, 4)));
      const d = `${y}-${pad(m)}-${pad(Math.min(t.day, daysInMonth(`${y}-${pad(m)}`)))}`;
      return { kind: 'date', month: d.slice(0, 7), from: d, to: d, date: d, months: [d.slice(0, 7)], label: dateText(d), future: d > anchor };
    }
    case 'range': {
      const y = t.year || inferYear(t.month, anchor);
      const ym = `${y}-${pad(t.month)}`;
      return rangeP(`${ym}-${pad(t.day)}`, `${ym}-${pad(Math.min(t.day2, daysInMonth(ym)))}`, `${t.day} sampai ${t.day2} ${monthYear(ym)}`);
    }
    case 'ytd': {
      const list = [];
      for (let m = `${ay}-01`; m <= am; m = shiftMonth(m, 1)) list.push(m);
      return { ...monthsP(list, `1 Januari sampai ${dateShort(anchor)}`), kind: 'ytd' };
    }
    case 'year': case 'yearRel': {
      const y = t.kind === 'year' ? t.year : Number(ay) + t.n;
      const list = [];
      for (let m = 1; m <= 12; m += 1) list.push(`${y}-${pad(m)}`);
      return monthsP(list, `tahun ${y}`);
    }
    case 'week': {
      const wd = weekday(anchor);
      const monday = addDays(anchor, -wd + t.n * 7);
      const end = t.n === 0 ? anchor : addDays(monday, 6);
      return rangeP(monday, end, t.n === 0 ? `minggu ini (${dateShort(monday)} sampai ${dateShort(end)})` : `minggu lalu (${dateShort(monday)} sampai ${dateShort(end)})`);
    }
    case 'yesterday': {
      const dates = source === 'perf' ? D.perfDates : null;
      const d = dates ? dates[Math.max(0, dates.indexOf(anchor) - 1)] : addDays(anchor, -1);
      return { kind: 'date', month: d.slice(0, 7), from: d, to: d, date: d, months: [d.slice(0, 7)], label: dateText(d) };
    }
    case 'lastN': {
      if (t.unit === 'month') {
        const list = [];
        for (let i = t.n - 1; i >= 0; i -= 1) list.push(shiftMonth(am, -i));
        return monthsP(list, `${t.n} bulan terakhir`);
      }
      return rangeP(addDays(anchor, -(t.n - 1)), anchor, `${t.n} hari terakhir`);
    }
    case 'quarter': case 'semester': {
      const size = t.kind === 'quarter' ? 3 : 6;
      const idx = t.kind === 'quarter' ? t.q : t.s;
      let y = t.year || Number(ay);
      if (!t.year && `${y}-${pad((idx - 1) * size + 1)}` > am) y -= 1;
      const list = [];
      for (let k = 0; k < size; k += 1) list.push(`${y}-${pad((idx - 1) * size + 1 + k)}`);
      return monthsP(list, `${t.kind === 'quarter' ? `kuartal ${idx}` : `semester ${idx}`} ${y}`);
    }
    default:
      if (source === 'perf') return { kind: 'latest', month: am, from: `${am}-01`, to: anchor, date: anchor, months: [am], label: dateText(anchor), partial: anchor < monthEnd(am) };
      return { ...monthP(am), kind: 'latest' };
  }
}

function rosOfProvince(code, D) {
  const codes = ISLANDS[code] || [code];
  const weight = new Map();
  for (const c of codes) for (const { ro, n } of D.territory.rosIn(c)) weight.set(ro, (weight.get(ro) || 0) + n);
  return D.regions.filter((r) => weight.has(r)).sort((a, b) => weight.get(b) - weight.get(a));
}

function provinceLabel(code) {
  const words = PROVINCE_ALIASES[code] || [code];
  return words[0].replace(/\b\w/g, (c) => c.toUpperCase()).replace(/^Dki\b/, 'DKI').replace(/^Di\b/, 'DI');
}

function rosOf(q, D) {
  const set = new Set(q.entities.ro);
  for (const p of q.entities.prov) for (const r of rosOfProvince(p, D)) set.add(r);
  return [...set];
}

function whereText(q, D, { source } = {}) {
  const parts = [];
  if (q.entities.rm.length) parts.push(listJoin(q.entities.rm.map(esc)));
  if (q.entities.kanca.length) parts.push(listJoin(q.entities.kanca.map(esc)));
  if (q.entities.prov.length) {
    const ros = rosOf({ ...q, entities: { ...q.entities, ro: [] } }, D);
    parts.push(`${listJoin(q.entities.prov.map(provinceLabel))}${ros.length ? ` (RO ${listJoin(ros.map(roName))})` : ''}`);
  } else if (q.entities.ro.length) parts.push(listJoin(q.entities.ro.map(roName)));
  if (q.entities.tipe.length && source === 'real') parts.push(listJoin(q.entities.tipe.map(esc)));
  if (q.entities.node.length && source === 'pf') parts.push(`segmen ${listJoin(q.entities.node.map((n) => NODE[n]?.label || n))}`);
  if (q.entities.fi && source === 'pf') parts.push(q.entities.fi === 'FI' ? 'debitur fixed income' : 'debitur non fixed income');
  return parts.join(', ') || 'Nasional';
}

const TIPE_TO_NODE = { 'Dev Tier 1': 'tier1', 'Non Dev Tier 1': 'nontier1', Secondary: 'secondary' };
const NODE_TO_TIPE = { tier1: 'Dev Tier 1', nontier1: 'Non Dev Tier 1', secondary: 'Secondary' };

export function pickSource(q) {
  const m = q.metric;
  const e = q.entities;
  const g = q.groupBy;
  if (['realisasi', 'realdeb', 'ticket', 'kancacount'].includes(m)) return 'real';
  const pfish = e.kanca.length || e.node.length || e.fi || g === 'kanca' || g === 'node';
  if (['npl', 'sml'].includes(m)) return pfish || g === 'tujuan' ? 'pf' : 'perf';
  if (m === 'os') return pfish || g === 'tujuan' || e.tipe.some((t) => TIPE_TO_NODE[t]) ? 'pf' : 'perf';
  if (m === 'debitur') return e.rm.length || e.tipe.length || ['rm', 'tipe'].includes(g) ? 'real' : pfish ? 'pf' : 'perf';
  if (['disburse', 'prodrm'].includes(m)) return e.kanca.length || e.rm.length || e.tipe.length || ['kanca', 'rm', 'tipe', 'tujuan'].includes(g) ? 'real' : 'perf';
  if (m === 'rmcount') return e.kanca.length || g === 'kanca' || g === 'rm' ? 'real' : 'perf';
  if (e.kanca.length || e.rm.length || e.tipe.length) return 'real';
  return 'perf';
}

function realMetricOf(q) {
  if (q.metric === 'realdeb' || q.metric === 'debitur') return 'realdeb';
  if (q.metric === 'ticket') return 'ticket';
  if (q.metric === 'rmcount') return 'rmcount';
  if (q.metric === 'kancacount') return 'kancacount';
  return 'realisasi';
}

const PERF_M = {
  os: { label: 'OS', get: (r) => r.os, f: rpM, kind: 'level', better: 'up', target: 'rka_os', additive: true, widget: 'trend-os' },
  growth: { label: 'growth OS', get: (r) => r.gr_os, f: rpMSigned, kind: 'flow', better: 'up', additive: true, widget: 'trend-os' },
  npl: { label: '%NPL', get: (r) => ratio(r.npl, r.os), f: (v) => pct(v), kind: 'ratio', better: 'down', nominal: 'npl', helper: 'helper_npl', target: 'rka_npl', widget: 'npl' },
  sml: { label: '%SML', get: (r) => ratio(r.dpk, r.os), f: (v) => pct(v), kind: 'ratio', better: 'down', nominal: 'dpk', helper: 'helper_dpk', target: 'rka_dpk', widget: 'sml' },
  disburse: { label: 'disburse', get: (r) => r.disburse, f: rpM, kind: 'flow', better: 'up', target: 'guidance_disb', additive: true, widget: 'trend-disb' },
  debitur: { label: 'jumlah debitur', get: (r) => r.debitur, f: (v) => num(v), kind: 'level', better: 'up', target: 'rka_deb', additive: true, widget: 'rank' },
  prodrm: { label: 'disburse per RM', get: (r) => ratio(r.disburse, r.jum_rm), f: rpM, kind: 'ratio', better: 'up', widget: 'prod-rm' },
  rmcount: { label: 'jumlah RM', get: (r) => r.jum_rm, f: (v) => num(v), kind: 'level', better: 'up', additive: true, widget: 'kuadran' },
  runoff: { label: 'runoff', get: (r) => (ok(r.disburse) && ok(r.gr_os) ? r.disburse - r.gr_os : null), f: rpM, kind: 'flow', better: 'down', additive: true, widget: 'trend-os' },
};
const NOMINAL_M = {
  npl: { label: 'NPL (nominal)', get: (r) => r.npl, f: rpM, kind: 'level', better: 'down', target: 'rka_npl', additive: true, widget: 'npl', ratioKey: 'npl' },
  sml: { label: 'SML (nominal)', get: (r) => r.dpk, f: rpM, kind: 'level', better: 'down', target: 'rka_dpk', additive: true, widget: 'sml', ratioKey: 'sml' },
};
const perfMetric = (q) => (q.nominal && NOMINAL_M[q.metric] ? NOMINAL_M[q.metric] : PERF_M[q.metric] || PERF_M.os);

function perfRowAt(D, ro, date) {
  const rows = D.pm?.byRo.get(ro);
  if (!rows) return null;
  let best = null;
  for (const r of rows) { if (r.tanggal <= date) best = r; else break; }
  return best;
}

function perfAt(D, ros, date) {
  if (!ros.length) return D.pm.byRo.has(NASIONAL) ? perfRowAt(D, NASIONAL, date) : perfAt(D, D.pm.regions, date);
  if (ros.length === 1) return perfRowAt(D, ros[0], date);
  const rows = ros.map((r) => perfRowAt(D, r, date)).filter(Boolean);
  if (!rows.length) return null;
  const out = { tanggal: rows[0].tanggal, hari_kerja: rows[0].hari_kerja };
  for (const k of PERF_SUM) {
    const vals = rows.map((r) => r[k]).filter(ok);
    out[k] = vals.length ? sum(vals) : null;
  }
  return out;
}

const REAL_M = {
  realisasi: { label: 'realisasi', get: (t) => t.plafond, f: rpReal, additive: true, better: 'up' },
  realdeb: { label: 'debitur realisasi', get: (t) => t.debitur, f: (v) => `${num(v)} debitur`, additive: true, better: 'up' },
  ticket: { label: 'plafond rata-rata', get: (t) => t.ticket, f: rpReal, additive: false, better: 'up' },
};

function realFilters(q, D, { except = '' } = {}) {
  const ros = rosOf(q, D);
  const f = {};
  if (except !== 'ro' && ros.length) f.ro = ros;
  if (except !== 'kanca' && q.entities.kanca.length) f.kanca = q.entities.kanca;
  if (except !== 'rm' && q.entities.rm.length) f.rm = q.entities.rm;
  const tipes = [...q.entities.tipe, ...q.entities.node.map((n) => NODE_TO_TIPE[n]).filter(Boolean)];
  if (except !== 'tipe') for (const t of new Set(tipes)) { const k = filterKeyOf(D.real, t); f[k] = [...(f[k] || []), t]; }
  return f;
}
const inRange = (rows, P) => rows.filter((r) => r.tanggal >= P.from && r.tanggal <= P.to);

function prevRange(P) {
  if ((P.kind === 'months' || P.kind === 'ytd') && P.months.length > 1 && P.kind !== 'ytd') {
    const n = P.months.length;
    const first = shiftMonth(P.months[0], -n);
    const last = shiftMonth(P.months[0], -1);
    return { from: `${first}-01`, to: monthEnd(last), label: `${monthYear(first)} sampai ${monthYear(last)}` };
  }
  if ((P.kind === 'month' || P.kind === 'latest') && P.partial) {
    const pm = shiftMonth(P.month, -1);
    const day = Number(P.to.slice(8, 10));
    return { from: `${pm}-01`, to: `${pm}-${pad(Math.min(day, daysInMonth(pm)))}`, label: `periode yang sama ${monthName(pm)}` };
  }
  if (P.kind === 'month' || P.kind === 'latest') {
    const pm = shiftMonth(P.month, -1);
    return { from: `${pm}-01`, to: monthEnd(pm), label: monthYear(pm) };
  }
  const days = Math.round((new Date(`${P.to}T00:00:00Z`) - new Date(`${P.from}T00:00:00Z`)) / 864e5) + 1;
  return { from: addDays(P.from, -days), to: addDays(P.from, -1), label: `${days} hari sebelumnya` };
}

async function pfRows(D, month, needKanca, ukuran = 'os') {
  if (needKanca) {
    await preparePf(D.pf, { bulan: month });
    return (D.pf.monthData.get(month) || []).filter((r) => r.m === ukuran);
  }
  return D.pf.trend.filter((r) => r.bulan === month && r.m === ukuran);
}

function pfFilterRows(rows, q, D, { except = '' } = {}) {
  const ros = rosOf(q, D);
  return rows.filter((r) => (except === 'ro' || !ros.length || ros.includes(r.ro)) && (except === 'kanca' || !q.entities.kanca.length || q.entities.kanca.includes(r.kanca)));
}

function pfNodeFilter(q) {
  const nodes = [...q.entities.node, ...q.entities.tipe.map((t) => TIPE_TO_NODE[t]).filter(Boolean)];
  return nodes.length === 1 ? NODE[nodes[0]].filter : {};
}

function pfValueOf(sums, q) {
  const fi = q.entities.fi;
  if (q.metric === 'npl') return q.nominal ? (fi === 'FI' ? sums.nplFi : fi === 'NFI' ? sums.nplNfi : sums.npl) : fi === 'FI' ? sums.nplFiR : fi === 'NFI' ? sums.nplNfiR : sums.nplR;
  if (q.metric === 'sml') return q.nominal ? (fi === 'FI' ? sums.smlFi : fi === 'NFI' ? sums.smlNfi : sums.sml) : fi === 'FI' ? ratio(sums.smlFi, sums.fi) : fi === 'NFI' ? ratio(sums.smlNfi, sums.nfi) : sums.smlR;
  return fi === 'FI' ? sums.fi : fi === 'NFI' ? sums.nfi : sums.base;
}
function pfFormat(q) {
  if ((q.metric === 'npl' || q.metric === 'sml') && !q.nominal) return (v) => pct(v);
  if (q.metric === 'debitur') return (v) => `${num(v)} debitur`;
  return (v) => rp(v * PF_UNIT);
}
const pfLabel = (q) => ({ npl: q.nominal ? 'NPL (nominal)' : '%NPL', sml: q.nominal ? 'SML (nominal)' : '%SML', debitur: 'debitur' }[q.metric] || 'OS');

function chips(list) { return list.filter((c) => c && c[1]).map(([k, v]) => ({ k, v })); }
function fixChips(q) { return q.fixes?.length ? [['Dibaca sebagai', q.fixes.map(([a, c]) => `${a} → ${c}`).join(', ')]] : []; }

function linkFor(source, q, D, P, widget = '') {
  const ros = rosOf(q, D);
  const one = (list) => (list.length === 1 ? list[0] : '');
  if (source === 'perf') return { view: 'performance', params: { ro: one(ros), bulan: P?.month && P.month !== D.perfLatest?.slice(0, 7) ? P.month : '' }, widget, label: 'Buka di Performance' };
  if (source === 'real') return { view: 'realisasi', params: { ro: one(ros), kanca: one(q.entities.kanca), rm: one(q.entities.rm), tipe: one(q.entities.tipe), sumber: modeOf(D.real, one(q.entities.tipe)), bulan: P?.month && P.month !== D.realLatest?.slice(0, 7) ? P.month : '' }, widget, label: 'Buka di Realisasi' };
  return { view: 'portofolio', params: { ro: one(ros), kanca: one(q.entities.kanca), bulan: P?.month && P.month !== D.pfLatest ? P.month : '', node: one(q.entities.node) }, widget, label: 'Buka di Portofolio' };
}

const SOURCE_NAME = { perf: 'Performance', real: 'Realisasi', pf: 'Portofolio' };

function outOfRange(P, source, D) {
  if (!P) return `Data ${SOURCE_NAME[source]} belum tersedia.`;
  const first = source === 'perf' ? D.perfDates[0] : source === 'real' ? D.real?.rows?.reduce((m, r) => (r.tanggal < m ? r.tanggal : m), '9999') : `${D.pf?.index.months[0]}-01`;
  const last = source === 'perf' ? D.perfLatest : source === 'real' ? D.realLatest : monthEnd(D.pfLatest);
  if (P.future || P.from > last || (P.to && P.to < first)) {
    return `Data ${SOURCE_NAME[source]} hanya tersedia dari ${dateText(first)} sampai ${dateText(last)}. Periode "${P.label}" di luar rentang itu.`;
  }
  return '';
}

function perfValue(q, D) {
  const P = resolvePeriod(q.time, D, 'perf');
  const miss = outOfRange(P, 'perf', D);
  if (miss) return { ok: false, title: miss };
  const ros = rosOf(q, D);
  const M = perfMetric(q);
  const r = perfAt(D, ros, P.date);
  if (!r) return { ok: false, title: 'Data untuk wilayah dan tanggal ini tidak ada.' };
  const where = whereText(q, D, { source: 'perf' });
  const v = M.get(r);
  const lines = [];
  const at = dateText(r.tanggal);
  let title = cap(`${M.label} ${where} ${b(M.f(v))} per ${at}.`);
  if (q.metric === 'disburse' || q.metric === 'growth' || q.metric === 'runoff') title = `${M.label[0].toUpperCase()}${M.label.slice(1)} ${where} sejak awal ${monthName(r.tanggal.slice(0, 7))} sampai ${at}: ${b(M.f(v))}.`;
  if (M.target && ok(r[M.target])) {
    const t = r[M.target];
    const ach = M.better === 'down' ? ratio(t, v) : ratio(v, t);
    if (q.metric === 'disburse') {
      lines.push(`Capaian terhadap guidance ${b(pct(ach, 1))} (guidance ${rpM(t)})${ok(r.prognosa_disb) ? `; prognosa ${rpM(r.prognosa_disb)}` : ''}.`);
    } else if (M.kind === 'ratio') {
      lines.push(`Nominal ${rpM(r[M.nominal])}; RKA nominal ${rpM(t)}, posisi ${r[M.nominal] > t ? 'di atas' : 'di bawah'} RKA ${rpM(Math.abs(r[M.nominal] - t))} (makin kecil makin baik).`);
    } else {
      lines.push(`Capaian RKA ${b(pct(ach, 1))} (RKA ${M.f(t)}, GAP ${M.f === rpM ? rpMSigned(v - t) : signedNum(v - t)}).`);
    }
  }
  if (q.metric === 'os' && ok(r.gr_os)) lines.push(`Sejak awal bulan ${r.gr_os >= 0 ? 'tumbuh' : 'turun'} ${rpM(Math.abs(r.gr_os))} (${signedPct(ratio(r.gr_os, r.helper_os), 2)}).`);
  if (M.kind === 'ratio' && M.helper) {
    const start = ratio(r[M.helper], r.helper_os);
    if (ok(start)) lines.push(`Awal bulan ${pct(start)}, berubah ${b(bpsSigned(v - start))} sejak itu.`);
  }
  if (q.metric === 'disburse' && ok(r.disburse_lalu) && r.disburse_lalu > 0) lines.push(`Periode yang sama bulan lalu ${rpM(r.disburse_lalu)} (${signedPct(v / r.disburse_lalu - 1)}).`);
  if (q.metric === 'runoff' && ok(r.helper_os)) lines.push(`Setara ${pct(ratio(v, r.helper_os))} OS awal bulan; runoff = disburse ${rpM(r.disburse)} dikurangi growth OS ${rpMSigned(r.gr_os)}.`);
  if (q.metric === 'debitur' && ok(r.gr_deb)) lines.push(`Sejak awal bulan ${signedNum(r.gr_deb)} debitur.`);
  if (q.metric === 'rmcount') {
    if (ok(r.jum_rm_lalu) && r.jum_rm_lalu > 0) lines.push(`Akhir bulan lalu ${num(r.jum_rm_lalu)} RM (${r.jum_rm === r.jum_rm_lalu ? 'tetap' : `${signedNum(r.jum_rm - r.jum_rm_lalu)} RM`}).`);
    if (ok(r.disburse) && r.jum_rm > 0) {
      const now = r.disburse / r.jum_rm;
      const before = ok(r.disburse_lalu) && r.jum_rm_lalu > 0 ? r.disburse_lalu / r.jum_rm_lalu : null;
      lines.push(`Produktivitas sejak awal bulan ${b(rpM(now))} disburse per RM${ok(before) && before > 0 ? `; periode yang sama bulan lalu ${rpM(before)} per RM (${signedPct(now / before - 1)})` : ''}.`);
    }
    if (!ros.length) {
      const all = D.pm.regions.map((ro) => ({ ro, v: perfRowAt(D, ro, P.date)?.jum_rm })).filter((x) => ok(x.v) && x.v > 0).sort((a, c) => c.v - a.v);
      if (all.length > 2) lines.push(`RM terbanyak di ${roName(all[0].ro)} (${num(all[0].v)}), paling sedikit di ${roName(all.at(-1).ro)} (${num(all.at(-1).v)}); rata-rata ${num(Math.round(sum(all.map((x) => x.v)) / all.length))} RM per RO.`);
    }
  }
  if (ros.length) {
    const nat = perfAt(D, [], P.date);
    const all = D.pm.regions.map((ro) => ({ ro, v: M.get(perfRowAt(D, ro, P.date) || {}) })).filter((x) => ok(x.v));
    if (M.additive && nat && ok(M.get(nat))) lines.push(`Porsi ${pct(ratio(v, M.get(nat)), 1)} dari nasional (${M.f(M.get(nat))}).`);
    else if (nat) lines.push(`Nasional ${M.f(M.get(nat))}.`);
    if (ros.length === 1 && all.length > 2) {
      const sorted = [...all].sort((a, c) => c.v - a.v);
      const pos = sorted.findIndex((x) => x.ro === ros[0]) + 1;
      if (pos > 0) lines.push(`Peringkat ${pos} tertinggi dari ${sorted.length} RO.`);
    }
  }
  return {
    ok: true, title, lines,
    chips: chips([['Metrik', M.label], ['Wilayah', where], ['Posisi', at], ['Sumber', 'Performance'], ...fixChips(q)]),
    link: linkFor('perf', q, D, P, M.widget),
    followups: followupsFor(q, where),
  };
}

function realValue(q, D) {
  const P = resolvePeriod(q.time, D, 'real');
  const miss = outOfRange(P, 'real', D);
  if (miss) return { ok: false, title: miss };
  const metric = realMetricOf(q);
  const f = realFilters(q, D);
  const base = realFilter(D.real.rows, f);
  const rows = inRange(base, P);
  const where = whereText(q, D, { source: 'real' });
  if (metric === 'rmcount' || metric === 'kancacount') {
    const key = metric === 'rmcount' ? 'rm' : 'kanca';
    const n = new Set(rows.filter((r) => r.plafond > 0).map((r) => r[key])).size;
    const all = new Set(base.map((r) => r[key])).size;
    return {
      ok: true,
      title: `${b(num(n))} ${key === 'rm' ? 'RM' : 'kanca'} mencatat realisasi di ${where} pada ${P.label}.`,
      lines: [`Total ${key === 'rm' ? 'RM' : 'kanca'} yang pernah muncul di data realisasi ${where}: ${num(all)}.`],
      chips: chips([['Metrik', key === 'rm' ? 'RM aktif' : 'kanca aktif'], ['Wilayah', where], ['Periode', P.label], ['Sumber', 'Realisasi'], ...fixChips(q)]),
      link: linkFor('real', q, D, P, key === 'rm' ? 'rm' : 'kanca'),
      followups: [`Top 5 ${key === 'rm' ? 'RM' : 'kanca'} realisasi ${P.label}`, `Realisasi ${where} ${P.label}`],
    };
  }
  const M = REAL_M[metric];
  const t = realTotals(rows);
  const PR = prevRange(P);
  const p = realTotals(inRange(base, PR));
  const lines = [];
  const title = metric === 'ticket'
    ? `Plafond rata-rata realisasi ${where} ${P.label}: ${b(rpReal(t.ticket))} per debitur.`
    : `Realisasi ${where} ${P.label}: ${b(rpReal(t.plafond))} dari ${b(num(t.debitur))} debitur.`;
  if (metric !== 'ticket') lines.push(`Plafond rata-rata ${rpReal(t.ticket)} per debitur.`);
  if (p.plafond > 0) {
    const cur = M.get(t);
    const prv = M.get(p);
    lines.push(`Dibanding ${PR.label}: ${M.f(prv)} (${signedPct(ratio(cur, prv) - 1)}).`);
  }
  if (Object.keys(f).length) {
    const nat = realTotals(inRange(D.real.rows, P));
    if (M.additive && nat.plafond > 0) lines.push(`Porsi ${pct(ratio(M.get(t), M.get(nat)), 1)} dari realisasi nasional pada periode yang sama.`);
  }
  if (!f.tipe && t.plafond > 0) {
    const g = [...realGroup(rows, 'tipe')].sort((a, c) => c[1].plafond - a[1].plafond);
    if (g.length > 1) lines.push(`Tipe terbesar ${esc(g[0][0])} (${pct(g[0][1].plafond / t.plafond, 1)}), lalu ${esc(g[1][0])} (${pct(g[1][1].plafond / t.plafond, 1)}).`);
  }
  if (P.partial) {
    const k = workdaysOf(P.month, Number(P.to.slice(8, 10))).length;
    lines.push(`Bulan berjalan baru ${k} hari kerja; rata-rata ${rpReal(t.plafond / Math.max(1, k))} per hari kerja.`);
  }
  return {
    ok: true, title, lines,
    chips: chips([['Metrik', M.label], ['Wilayah', where], ['Periode', P.label], ['Sumber', 'Realisasi'], ...fixChips(q)]),
    link: linkFor('real', q, D, P, 'summary'),
    followups: followupsFor({ ...q, metric: 'realisasi' }, where),
  };
}

async function pfValue(q, D) {
  const P = resolvePeriod(q.time, D, 'pf');
  const miss = outOfRange(P, 'pf', D);
  if (miss) return { ok: false, title: miss };
  const month = D.pf.index.months.includes(P.month) ? P.month : D.pfLatest;
  const ukuran = q.metric === 'debitur' ? 'deb' : 'os';
  const L = pfLabels(D.pf, ukuran);
  const rows = pfFilterRows(await pfRows(D, month, q.entities.kanca.length > 0, ukuran), q, D);
  const s = pfSums(rows, L, pfNodeFilter(q));
  const v = pfValueOf(s, q);
  const f = pfFormat(q);
  const where = whereText(q, D, { source: 'pf' });
  const lines = [];
  const prev = shiftMonth(month, -1);
  if (q.metric === 'npl' || q.metric === 'sml') {
    lines.push(`OS ${rp(s.base * PF_UNIT)}; ${q.metric === 'npl' ? `%SML ${pct(s.smlR)}` : `%NPL ${pct(s.nplR)}`}.`);
    if (D.pf.index.months.includes(prev)) {
      const pr = pfSums(pfFilterRows(await pfRows(D, prev, q.entities.kanca.length > 0, ukuran), q, D), L, pfNodeFilter(q));
      const pv = pfValueOf(pr, q);
      if (ok(pv) && ok(v)) lines.push(`${monthYear(prev)}: ${f(pv)} (${q.nominal ? rp((v - pv) * PF_UNIT) : bpsSigned(v - pv)}).`);
    }
    if (q.entities.kanca.length || rosOf(q, D).length || q.entities.node.length) {
      const nat = pfSums(await pfRows(D, month, false, ukuran), L);
      lines.push(`Nasional ${f(pfValueOf(nat, { ...q, entities: { ...q.entities, fi: q.entities.fi } }))}.`);
    }
    if (!q.entities.fi && ok(s.nplFiR) && ok(s.nplNfiR) && q.metric === 'npl') lines.push(`%NPL FI ${pct(s.nplFiR)}, NFI ${pct(s.nplNfiR)}.`);
  } else {
    if (D.pf.index.months.includes(prev)) {
      const pr = pfSums(pfFilterRows(await pfRows(D, prev, q.entities.kanca.length > 0, ukuran), q, D), L, pfNodeFilter(q));
      const pv = pfValueOf(pr, q);
      if (ok(pv) && pv) lines.push(`${monthYear(prev)}: ${f(pv)} (${signedPct(v / pv - 1, 2)}).`);
    }
    lines.push(`%NPL ${pct(s.nplR)}, %SML ${pct(s.smlR)}.`);
  }
  return {
    ok: true,
    title: `${pfLabel(q)} ${where} ${b(f(v))} pada ${monthYear(month)}.`,
    lines,
    chips: chips([['Metrik', pfLabel(q)], ['Wilayah', where], ['Bulan', monthYear(month)], ['Sumber', 'Portofolio'], ...fixChips(q)]),
    link: linkFor('pf', q, D, { month }, q.metric === 'npl' ? 'top-npl' : 'tree'),
    followups: followupsFor(q, where),
  };
}

function orderDir(q, better) {
  if (q.order === 'best') return better === 'down' ? 'asc' : 'desc';
  if (q.order === 'worst') return better === 'down' ? 'desc' : 'asc';
  return q.order === 'asc' ? 'asc' : 'desc';
}
const orderWord = (dir, q) => (q.order === 'best' ? 'terbaik' : q.order === 'worst' ? 'terburuk' : dir === 'asc' ? 'terendah' : 'tertinggi');

async function rankItems(q, D) {
  const source = pickSource(q);
  const dim = q.groupBy || (source === 'real' ? 'kanca' : 'ro');
  if (source === 'perf') {
    const P = resolvePeriod(q.time, D, 'perf');
    const miss = outOfRange(P, 'perf', D);
    if (miss) return { miss };
    const M = perfMetric(q);
    const pool = rosOf(q, D).length > 1 ? rosOf(q, D) : D.pm.regions;
    const items = pool.map((ro) => {
      const r = perfRowAt(D, ro, P.date);
      if (!r) return null;
      let v = M.get(r);
      let text = M.f(v);
      if (q.byChange) {
        if (M.kind === 'ratio' && M.helper) { v = v - ratio(r[M.helper], r.helper_os); text = bpsSigned(v); }
        else if (q.metric === 'os' || q.metric === 'growth') { v = ratio(r.gr_os, r.helper_os); text = signedPct(v, 2); }
        else if (q.metric === 'disburse' && ok(r.disburse_lalu) && r.disburse_lalu) { v = r.disburse / r.disburse_lalu - 1; text = signedPct(v); }
      }
      return ok(v) ? { key: ro, label: roName(ro), v, text, sub: q.byChange ? `${M.label} ${M.f(M.get(r))}` : (M.kind === 'ratio' ? `OS ${rpM(r.os)}` : '') } : null;
    }).filter(Boolean);
    const nat = perfAt(D, [], P.date);
    return {
      source, dim: 'ro', items, M, P, better: q.byChange && M.kind !== 'ratio' ? 'up' : M.better,
      ref: nat ? `Nasional ${q.byChange && M.kind === 'ratio' && M.helper ? bpsSigned(M.get(nat) - ratio(nat[M.helper], nat.helper_os)) : M.f(M.get(nat))}` : '',
      total: M.additive && !q.byChange && nat ? M.get(nat) : null,
      label: q.byChange ? (M.kind === 'ratio' ? `perubahan ${M.label} sejak awal bulan` : `pertumbuhan ${M.label}`) : M.label,
    };
  }
  if (source === 'real') {
    const P = resolvePeriod(q.time, D, 'real');
    const miss = outOfRange(P, 'real', D);
    if (miss) return { miss };
    const metric = realMetricOf(q) === 'rmcount' || realMetricOf(q) === 'kancacount' ? 'realisasi' : realMetricOf(q);
    const M = REAL_M[metric];
    const d = ['ro', 'kanca', 'rm', 'tipe', 'tujuan'].includes(dim) ? dim : 'kanca';
    const base = realFilter(D.real.rows, realFilters(q, D, { except: d }));
    const cur = realGroup(inRange(base, P), d);
    const PR = prevRange(P);
    const prev = q.byChange ? realGroup(inRange(base, PR), d) : null;
    const total = sum([...cur.values()].map((g) => M.get(g)));
    const items = [...cur].map(([k, g]) => {
      let v = M.get(g);
      let text = M.f(v);
      if (prev) {
        const pg = prev.get(k);
        const pv = pg ? M.get(pg) : null;
        if (!ok(pv) || pv <= 0) return null;
        v = v / pv - 1;
        text = signedPct(v);
      }
      if (metric === 'ticket' && g.debitur < 5) return null;
      return ok(v) ? { key: k, label: d === 'ro' ? roName(k) : esc(k), v, text, sub: metric === 'realisasi' ? `${num(g.debitur)} debitur` : '' } : null;
    }).filter(Boolean);
    return {
      source, dim: d, items, M, P, better: 'up', ref: metric === 'ticket' ? `Rata-rata keseluruhan ${rpReal(realTotals(inRange(base, P)).ticket)}` : `Total ${M.f(total)}`,
      total: M.additive && !prev ? total : null, label: prev ? `pertumbuhan ${M.label} vs ${PR.label}` : M.label,
      note: q.metric === 'disburse' || q.metric === 'prodrm' ? 'Disburse per kanca, RM, atau tipe memakai data Realisasi (plafond).' : '',
    };
  }
  const P = resolvePeriod(q.time, D, 'pf');
  const miss = outOfRange(P, 'pf', D);
  if (miss) return { miss };
  const month = D.pf.index.months.includes(P.month) ? P.month : D.pfLatest;
  const ukuran = q.metric === 'debitur' ? 'deb' : 'os';
  const L = pfLabels(D.pf, ukuran);
  const f = pfFormat(q);
  if (dim === 'node') {
    const rows = pfFilterRows(await pfRows(D, month, q.entities.kanca.length > 0, ukuran), q, D);
    const items = PORTFOLIO_NODES.filter((n) => n.id !== 'all').map((n) => {
      const s = pfSums(rows, L, n.filter);
      const v = pfValueOf(s, q);
      return ok(v) && s.base > 0 ? { key: n.id, label: esc(n.label), v, text: f(v), sub: `OS ${rp(s.base * PF_UNIT)}` } : null;
    }).filter(Boolean);
    return { source: 'pf', dim, items, P: { ...P, month, label: monthYear(month) }, M: { label: pfLabel(q), f }, better: q.metric === 'npl' || q.metric === 'sml' ? 'down' : 'up', ref: '', label: pfLabel(q) };
  }
  const d = dim === 'kanca' || dim === 'tujuan' ? dim : 'ro';
  const rows = pfFilterRows(await pfRows(D, month, d === 'kanca' || q.entities.kanca.length > 0, ukuran), q, D, { except: d });
  const nodeF = pfNodeFilter(q);
  const groups = [...pfGroup(rows, L, d, nodeF)];
  const all = pfSums(rows, L, nodeF);
  const ratioMetric = (q.metric === 'npl' || q.metric === 'sml') && !q.nominal;
  const minBase = ratioMetric && d === 'kanca' ? all.base * 0.001 : 0;
  let prevMap = null;
  if (q.byChange && D.pf.index.months.includes(shiftMonth(month, -1))) {
    const pr = pfFilterRows(await pfRows(D, shiftMonth(month, -1), d === 'kanca' || q.entities.kanca.length > 0, ukuran), q, D, { except: d });
    prevMap = pfGroup(pr, L, d, nodeF);
  }
  const items = groups.map(([k, s]) => {
    if (s.base <= minBase) return null;
    let v = pfValueOf(s, q);
    let text = f(v);
    if (prevMap) {
      const ps = prevMap.get(k);
      const pv = ps ? pfValueOf(ps, q) : null;
      if (!ok(pv)) return null;
      v = ratioMetric ? v - pv : (pv ? v / pv - 1 : null);
      text = ratioMetric ? bpsSigned(v) : signedPct(v, 2);
    }
    return ok(v) ? { key: k, label: d === 'ro' ? roName(k) : esc(k), v, text, sub: ratioMetric ? `OS ${rp(s.base * PF_UNIT)}` : '' } : null;
  }).filter(Boolean);
  return {
    source: 'pf', dim: d, items, P: { ...P, month, label: monthYear(month) }, M: { label: pfLabel(q), f }, better: ratioMetric ? 'down' : 'up',
    ref: `Nasional ${f(pfValueOf(all, q))}`, total: !ratioMetric && !prevMap ? pfValueOf(all, q) : null,
    label: prevMap ? `perubahan ${pfLabel(q)} dari ${monthName(shiftMonth(month, -1))}` : pfLabel(q),
    note: minBase ? `Hanya kanca dengan OS di atas ${rp(minBase * PF_UNIT)} yang diurutkan.` : '',
  };
}

const DIM_WORD = { ro: 'RO', kanca: 'kanca', rm: 'RM', tipe: 'sumber', tujuan: 'tujuan', node: 'segmen' };

async function answerRank(q, D) {
  const R = await rankItems(q, D);
  if (R.miss) return { ok: false, title: R.miss };
  if (!R.items.length) return { ok: false, title: 'Tidak ada data yang bisa diurutkan untuk pertanyaan ini.' };
  const dir = orderDir(q, R.better);
  const sorted = [...R.items].sort((a, c) => (dir === 'asc' ? a.v - c.v : c.v - a.v));
  const n = Math.min(q.topN || (q.order === null && R.dim === 'ro' ? sorted.length : 5), sorted.length, 25);
  const top = sorted.slice(0, n);
  const lead = top[0];
  const lines = [];
  if (R.ref) lines.push(`${R.ref}.`);
  if (R.total && top.length > 1 && !q.byChange && dir === 'desc' && R.items.every((x) => x.v >= 0)) lines.push(`${n} ${DIM_WORD[R.dim]} teratas memegang ${b(pct(sum(top.map((x) => x.v)) / R.total, 0))} dari total ${R.items.length} ${DIM_WORD[R.dim]}.`);
  if (R.note) lines.push(R.note);
  const where = whereText({ ...q, entities: { ...q.entities, [R.dim === 'node' ? 'node' : R.dim]: [] } }, D, { source: R.source });
  return {
    ok: true,
    title: cap(`${b(lead.label)} mencatat ${R.label} ${orderWord(dir, q)}: ${b(lead.text)}${where !== 'Nasional' ? ` (${where})` : ''}, ${R.P.label}.`),
    lines,
    list: { items: top.map((x, i) => ({ ...x, rank: i + 1 })), dir, abs: !q.byChange },
    chips: chips([['Metrik', R.label], ['Dikelompokkan per', DIM_WORD[R.dim]], ['Urutan', orderWord(dir, q)], ['Periode', R.P.label], ['Sumber', SOURCE_NAME[R.source]], ...fixChips(q)]),
    link: linkFor(R.source, q, D, R.P, R.source === 'perf' ? 'rank' : R.source === 'real' ? (R.dim === 'rm' ? 'rm' : R.dim === 'ro' ? 'ro' : 'kanca') : 'top-npl'),
    followups: [
      R.dim === 'ro' ? `Kondisi ${lead.label.replace(/<[^>]+>/g, '')}` : `${R.M.label} ${lead.label.replace(/<[^>]+>/g, '')}`,
      `${dir === 'asc' ? 'Yang tertinggi' : 'Yang terendah'}?`,
      R.source === 'perf' ? `Tren ${R.M.label} ${lead.label.replace(/<[^>]+>/g, '')} 6 bulan terakhir` : `Porsi ${R.M.label} per ${DIM_WORD[R.dim]}`,
    ],
  };
}

async function answerFilter(q, D) {
  const R = await rankItems({ ...q, byChange: false }, D);
  if (R.miss) return { ok: false, title: R.miss };
  const th = q.threshold;
  const hit = R.items.filter((x) => (th.op === '>' ? x.v > th.value : x.v < th.value)).sort((a, c) => (th.op === '>' ? c.v - a.v : a.v - c.v));
  const thText = th.unit === '%' ? pct(th.value) : th.unit === 'rp' ? rp(th.value) : num(th.value, 2);
  return {
    ok: true,
    title: hit.length
      ? `${b(`${hit.length} ${DIM_WORD[R.dim]}`)} punya ${R.label} ${th.op === '>' ? 'di atas' : 'di bawah'} ${thText}, ${R.P.label}.`
      : `Tidak ada ${DIM_WORD[R.dim]} dengan ${R.label} ${th.op === '>' ? 'di atas' : 'di bawah'} ${thText} pada ${R.P.label}.`,
    lines: [R.ref ? `${R.ref}.` : '', `Dari ${R.items.length} ${DIM_WORD[R.dim]} yang punya data.`, R.note].filter(Boolean),
    list: hit.length ? { items: hit.slice(0, 25).map((x, i) => ({ ...x, rank: i + 1 })), dir: th.op === '>' ? 'desc' : 'asc', abs: true } : null,
    chips: chips([['Metrik', R.label], ['Syarat', `${th.op === '>' ? '>' : '<'} ${thText}`], ['Periode', R.P.label], ['Sumber', SOURCE_NAME[R.source]], ...fixChips(q)]),
    link: linkFor(R.source, q, D, R.P, R.source === 'perf' ? 'rank' : 'top-npl'),
    followups: [`${R.M.label} ${DIM_WORD[R.dim]} tertinggi`, `Tren ${R.M.label} 6 bulan terakhir`],
  };
}

async function answerShare(q, D) {
  const source = pickSource(q);
  const dim = q.groupBy || (source === 'real' ? 'tipe' : source === 'pf' ? 'node' : 'ro');
  const R = await rankItems({ ...q, groupBy: dim, byChange: false, order: 'desc' }, D);
  if (R.miss) return { ok: false, title: R.miss };
  let items = R.items;
  const extra = [];
  if (R.dim === 'node') {
    const top = PORTFOLIO_NODES.filter((n) => n.parent === 'all').map((n) => n.id);
    const kids = (id) => PORTFOLIO_NODES.filter((n) => n.parent === id).map((n) => n.id);
    const byId = new Map(R.items.map((x) => [x.key, x]));
    const isRatio = (q.metric === 'npl' || q.metric === 'sml') && !q.nominal;
    if (!isRatio) {
      const tot = sum(top.map((id) => byId.get(id)?.v || 0));
      for (const id of top) {
        const ch = kids(id).map((k) => byId.get(k)).filter(Boolean);
        const parent = byId.get(id);
        if (ch.length && parent?.v) extra.push(`${parent.label} terdiri dari ${listJoin(ch.map((c) => `${c.label} ${pct(c.v / parent.v, 1)}`))}.`);
      }
      items = top.map((id) => byId.get(id)).filter(Boolean);
      R.total = tot;
    }
  }
  const additive = R.total !== null && R.total !== undefined;
  const sorted = [...items].sort((a, c) => c.v - a.v);
  const total = additive ? R.total : null;
  const top = sorted.slice(0, q.topN || 12);
  const lead = top[0];
  if (!lead) return { ok: false, title: 'Tidak ada data untuk dibagi per kelompok.' };
  return {
    ok: true,
    title: additive
      ? `${b(lead.label)} porsi terbesar ${R.label}: ${b(pct(lead.v / total, 1))} (${lead.text}) dari total ${R.M.f(total)}, ${R.P.label}.`
      : cap(`${R.label} ${/ per /.test(R.label) ? 'tiap' : 'per'} ${DIM_WORD[R.dim]}, ${R.P.label}: tertinggi ${b(lead.label)} (${lead.text}).`),
    lines: [additive && top.length > 2 ? `${top.length} ${DIM_WORD[R.dim]} ditampilkan; 3 terbesar memegang ${pct(sum(top.slice(0, 3).map((x) => x.v)) / total, 0)}.` : !additive && R.ref ? `${R.ref}.` : '', ...extra, R.note].filter(Boolean),
    list: { items: top.map((x, i) => ({ ...x, rank: i + 1, text: additive ? `${pct(x.v / total, 1)} (${x.text})` : x.text })), dir: 'desc', abs: true },
    chips: chips([['Metrik', R.label], ['Per', DIM_WORD[R.dim]], ['Periode', R.P.label], ['Sumber', SOURCE_NAME[R.source]], ...fixChips(q)]),
    link: linkFor(R.source, q, D, R.P, R.source === 'real' ? (R.dim === 'tipe' ? 'hero' : R.dim) : R.source === 'pf' ? 'tree' : 'rank'),
    followups: [`Tren ${R.M.label} 6 bulan terakhir`, `${R.M.label} ${DIM_WORD[R.dim]} tertinggi`],
  };
}

async function compareEntities(q, D) {
  const kind = q.manyOf || (q.entities.ro.length ? 'ro' : q.entities.kanca.length ? 'kanca' : q.entities.tipe.length ? 'tipe' : 'ro');
  const list = q.entities[kind] || [];
  if (list.length < 2) return null;
  const metric = q.metric || (kind === 'tipe' || kind === 'rm' || kind === 'kanca' ? 'realisasi' : kind === 'fiList' ? 'npl' : null);
  const entitiesFor = (val) => {
    const e = { ro: [], kanca: [], rm: [], tipe: [], node: [], prov: [], fiList: [], fi: q.entities.fi };
    if (kind === 'fiList') e.fi = val;
    else e[kind] = [val];
    for (const k of ['ro', 'kanca', 'rm', 'tipe', 'node', 'prov']) if (k !== kind) e[k] = kind === 'prov' && k === 'ro' ? [] : (e[k].length ? e[k] : q.entities[k]);
    return e;
  };
  const label = (val) => (kind === 'ro' ? roName(val) : kind === 'prov' ? provinceLabel(val) : kind === 'fiList' ? (val === 'FI' ? 'Fixed income (FI)' : 'Non fixed income (NFI)') : esc(kind === 'node' ? NODE[val]?.label || val : val));
  if (metric) {
    const res = [];
    for (const val of list) {
      const sub = { ...q, metric, intent: 'value', entities: entitiesFor(val) };
      const src = pickSource(sub);
      const val2 = await valueOf(sub, D, src);
      res.push({ label: label(val), ...val2, src });
    }
    const valid = res.filter((x) => ok(x.v));
    if (!valid.length) return { ok: false, title: 'Data untuk perbandingan ini tidak tersedia.' };
    const sorted = [...valid].sort((a, c) => c.v - a.v);
    const hi = sorted[0];
    const lo = sorted.at(-1);
    const diff = hi.ratioKind ? bps(hi.v - lo.v) : hi.f === rpM || hi.f === rpReal ? hi.f(hi.v - lo.v) : num(hi.v - lo.v);
    return {
      ok: true,
      title: `${b(cap(hi.label))} lebih tinggi dari ${b(lo.label)}: ${hi.text} dibanding ${lo.text} (${hi.ratioKind ? `selisih ${diff}` : `selisih ${diff}, ${signedPct(ratio(hi.v, lo.v) - 1)}`}), ${hi.period}.`,
      lines: res.map((x) => `${x.label}: ${b(x.text)}${x.extra ? `; ${x.extra}` : ''}.`),
      list: { items: sorted.map((x, i) => ({ key: x.label, label: x.label, v: x.v, text: x.text, rank: i + 1 })), dir: 'desc', abs: true },
      chips: chips([['Metrik', hi.metricLabel], ['Dibandingkan', listJoin(res.map((x) => x.label))], ['Periode', hi.period], ['Sumber', SOURCE_NAME[hi.src]], ...fixChips(q)]),
      followups: [`Tren ${hi.metricLabel} ${hi.label.replace(/<[^>]+>/g, '')} dan ${lo.label.replace(/<[^>]+>/g, '')}`, `Kenapa ${hi.metricLabel} ${lo.label.replace(/<[^>]+>/g, '')} lebih rendah?`],
    };
  }
  const cols = [['os', 'OS'], ['growth', 'Growth OS MtD'], ['npl', '%NPL'], ['sml', '%SML'], ['disburse', 'Disburse MtD'], ['realisasi', 'Realisasi bulan ini']];
  const rows = [];
  for (const val of list) {
    const row = [label(val)];
    for (const [m] of cols) {
      const sub = { ...q, metric: m, intent: 'value', entities: entitiesFor(val), time: q.time };
      const r = await valueOf(sub, D, pickSource(sub));
      row.push(r.text || '–');
    }
    rows.push(row);
  }
  return {
    ok: true,
    title: `Perbandingan ${listJoin(list.map(label))} pada posisi terakhir.`,
    lines: [],
    table: { columns: ['', ...cols.map((c) => c[1])], rows },
    chips: chips([['Dibandingkan', listJoin(list.map(label))], ['Sumber', 'Performance dan Realisasi'], ...fixChips(q)]),
    followups: [`Bandingkan NPL ${listJoin(list.map(label).map((x) => x.replace(/<[^>]+>/g, '')))}`, `Bandingkan realisasi ${listJoin(list.map(label).map((x) => x.replace(/<[^>]+>/g, '')))} bulan ini`],
  };
}

async function valueOf(q, D, source) {
  if (source === 'perf') {
    const P = resolvePeriod(q.time, D, 'perf');
    const M = perfMetric(q);
    const r = P ? perfAt(D, rosOf(q, D), P.date) : null;
    const v = r ? M.get(r) : null;
    const extra = M.target && r && ok(r[M.target]) && M.kind !== 'ratio' ? `capaian ${pct(M.better === 'down' ? ratio(r[M.target], v) : ratio(v, r[M.target]), 1)}` : '';
    return { v, text: ok(v) ? M.f(v) : '–', f: M.f, period: r ? dateText(r.tanggal) : '', metricLabel: M.label, ratioKind: M.kind === 'ratio' && M.f !== rpM, extra };
  }
  if (source === 'real') {
    const P = resolvePeriod(q.time, D, 'real');
    const metric = realMetricOf(q);
    const M = REAL_M[metric] || REAL_M.realisasi;
    const t = P ? realTotals(inRange(realFilter(D.real.rows, realFilters(q, D)), P)) : null;
    const v = t ? M.get(t) : null;
    return { v, text: ok(v) ? M.f(v) : '–', f: M.f, period: P?.label || '', metricLabel: M.label, extra: t && metric === 'realisasi' ? `${num(t.debitur)} debitur` : '' };
  }
  const P = resolvePeriod(q.time, D, 'pf');
  const month = P && D.pf.index.months.includes(P.month) ? P.month : D.pfLatest;
  const ukuran = q.metric === 'debitur' ? 'deb' : 'os';
  const s = pfSums(pfFilterRows(await pfRows(D, month, q.entities.kanca.length > 0, ukuran), q, D), pfLabels(D.pf, ukuran), pfNodeFilter(q));
  const v = pfValueOf(s, q);
  const f = pfFormat(q);
  return { v, text: ok(v) ? f(v) : '–', f, period: monthYear(month), metricLabel: pfLabel(q), ratioKind: (q.metric === 'npl' || q.metric === 'sml') && !q.nominal };
}

async function answerTrend(q, D) {
  const source = pickSource(q);
  const t = q.time.kind ? q.time : { kind: 'lastN', n: 6, unit: 'month' };
  const P = resolvePeriod(t, D, source === 'pf' ? 'pf' : source);
  const miss = outOfRange(P, source, D);
  if (miss) return { ok: false, title: miss };
  const where = whereText(q, D, { source });
  let labels = [];
  let values = [];
  let f = (v) => num(v);
  let metricLabel = '';
  const daily = (P.kind === 'month' || P.kind === 'range' || P.kind === 'latest') && P.months.length === 1 && q.time.kind;
  if (source === 'perf') {
    const M = perfMetric(q);
    metricLabel = M.label;
    f = M.f;
    const ros = rosOf(q, D);
    if (daily) {
      for (const d of D.perfDates.filter((x) => x >= P.from && x <= P.to)) {
        const r = perfAt(D, ros, d);
        labels.push(dateShort(d).replace(/ \d{4}$/, ''));
        values.push(r ? M.get(r) : null);
      }
    } else {
      const months = P.months.length > 1 ? P.months : (() => { const l = []; for (let i = 5; i >= 0; i -= 1) l.push(shiftMonth(P.month, -i)); return l; })();
      for (const m of months) {
        if (!D.pm.months.includes(m)) continue;
        const end = m === D.perfLatest.slice(0, 7) ? D.perfLatest : monthEnd(m);
        const r = perfAt(D, ros, end);
        labels.push(m === D.perfLatest.slice(0, 7) && D.perfLatest < monthEnd(m) ? `${monthName(m).slice(0, 3)}*` : monthName(m).slice(0, 3));
        values.push(r ? M.get(r) : null);
      }
    }
  } else if (source === 'real') {
    const metric = realMetricOf(q) === 'rmcount' ? 'realisasi' : realMetricOf(q);
    const M = REAL_M[metric] || REAL_M.realisasi;
    metricLabel = M.label;
    f = M.f;
    const base = realFilter(D.real.rows, realFilters(q, D));
    if (daily) {
      const by = new Map();
      for (const r of inRange(base, P)) {
        let g = by.get(r.tanggal);
        if (!g) { g = { plafond: 0, debitur: 0 }; by.set(r.tanggal, g); }
        g.plafond += r.plafond || 0;
        g.debitur += r.debitur || 0;
      }
      for (const d of [...by.keys()].sort()) { labels.push(String(Number(d.slice(8, 10)))); const g = by.get(d); values.push(M.get({ ...g, ticket: ratio(g.plafond, g.debitur) })); }
    } else {
      const months = P.months.length > 1 ? P.months : (() => { const l = []; for (let i = 5; i >= 0; i -= 1) l.push(shiftMonth(P.month, -i)); return l; })();
      for (const m of months.filter((x) => D.real.months.includes(x))) {
        const tt = realTotals(base.filter((r) => r.bulan === m));
        labels.push(m === D.realLatest.slice(0, 7) && D.realLatest < monthEnd(m) ? `${monthName(m).slice(0, 3)}*` : monthName(m).slice(0, 3));
        values.push(M.get(tt));
      }
    }
  } else {
    metricLabel = pfLabel(q);
    f = pfFormat(q);
    const ukuran = q.metric === 'debitur' ? 'deb' : 'os';
    const L = pfLabels(D.pf, ukuran);
    const months = P.months.length > 1 ? P.months : (() => { const l = []; for (let i = 5; i >= 0; i -= 1) l.push(shiftMonth(P.month, -i)); return l; })();
    for (const m of months.filter((x) => D.pf.index.months.includes(x))) {
      const s = pfSums(pfFilterRows(await pfRows(D, m, q.entities.kanca.length > 0, ukuran), q, D), L, pfNodeFilter(q));
      labels.push(monthName(m).slice(0, 3));
      values.push(pfValueOf(s, q));
    }
  }
  const flowLike = source === 'real' || (source === 'perf' && ['flow'].includes(perfMetric(q).kind));
  const all = values.map((v, i) => ({ v, l: labels[i] })).filter((x) => ok(x.v));
  const pts = flowLike && !daily ? all.filter((x) => !x.l.endsWith('*')) : all;
  if (pts.length < 2) return { ok: false, title: 'Data belum cukup untuk melihat tren.' };
  const first = pts[0];
  const last = pts.at(-1);
  const hi = pts.reduce((m, x) => (x.v > m.v ? x : m));
  const lo = pts.reduce((m, x) => (x.v < m.v ? x : m));
  const isRatio = metricLabel.startsWith('%');
  if (source === 'real' && daily && metricLabel !== 'plafond rata-rata') {
    const total = sum(pts.map((x) => x.v));
    const k = pts.length;
    const peak = pts.reduce((m, x) => (x.v > m.v ? x : m));
    return {
      ok: true,
      title: cap(`${metricLabel} harian ${where} ${P.label}: total ${b(f(total))} dalam ${k} hari bertransaksi, rata-rata ${f(total / k)} per hari.`),
      lines: [`Tertinggi tanggal ${peak.l} (${f(peak.v)}), terendah tanggal ${lo.l} (${f(lo.v)}).`],
      spark: { labels, values, fmt: f, bars: true },
      chips: chips([['Metrik', metricLabel], ['Wilayah', where], ['Periode', P.label], ['Sumber', 'Realisasi'], ...fixChips(q)]),
      link: linkFor('real', q, D, P, 'calendar'),
      followups: [`Realisasi ${where} ${P.label}`, `Top 5 kanca realisasi ${P.label}`],
    };
  }
  const change = isRatio ? bpsSigned(last.v - first.v) : signedPct(ratio(last.v, first.v) - 1);
  let run = 0;
  for (let i = pts.length - 1; i > 0 && Math.sign(pts[i].v - pts[i - 1].v) === Math.sign(last.v - pts[pts.length - 2].v) && pts[i].v !== pts[i - 1].v; i -= 1) run += 1;
  const lines = [`Tertinggi ${f(hi.v)} (${hi.l}), terendah ${f(lo.v)} (${lo.l}).`];
  if (run >= 2) lines.push(`${last.v >= pts[pts.length - 2].v ? 'Naik' : 'Turun'} ${run} periode berturut-turut.`);
  if (labels.some((l) => l.endsWith('*'))) lines.push(flowLike && !daily ? 'Tanda * berarti bulan berjalan; tidak dipakai dalam perbandingan karena belum penuh.' : 'Tanda * berarti bulan berjalan (belum penuh).');
  return {
    ok: true,
    title: `${cap(metricLabel)} ${where} ${upWord(last.v - first.v)} dari ${f(first.v)} (${first.l}) ke ${b(f(last.v))} (${last.l}), ${b(change)}.`,
    lines,
    spark: { labels, values, fmt: f },
    chips: chips([['Metrik', metricLabel], ['Wilayah', where], ['Periode', daily ? P.label : `${pts.length} ${daily ? 'hari' : 'bulan'}`], ['Sumber', SOURCE_NAME[source]], ...fixChips(q)]),
    link: linkFor(source, q, D, null, source === 'perf' ? (perfMetric(q).widget) : source === 'real' ? 'months-chart' : 'qtrend'),
    followups: [`Kenapa ${metricLabel} ${where} ${last.v >= first.v ? 'naik' : 'turun'}?`, `${metricLabel} RO tertinggi`],
  };
}
const upWord = (d) => (!ok(d) || d === 0 ? 'stabil' : d > 0 ? 'naik' : 'turun');

function insightCards(list) { return list.filter(Boolean); }

async function answerWhy(q, D) {
  const source = pickSource(q);
  const ros = rosOf(q, D);
  const ro = ros.length === 1 ? ros[0] : '';
  if (source === 'real' || ['realisasi', 'realdeb', 'ticket'].includes(q.metric)) {
    const P = resolvePeriod(q.time, D, 'real');
    const rs = realScope(D.real, { ro, kanca: q.entities.kanca[0] || '', rm: q.entities.rm[0] || '', tipe: q.entities.tipe[0] || '', bulan: P?.month || '' });
    if (!rs) return { ok: false, title: 'Data realisasi belum tersedia.' };
    const cards = insightCards([volumeInsight(rs), mixInsight(rs), anomalyInsight(rs)]);
    if (!cards.length) return { ok: false, title: 'Belum ada perubahan realisasi yang cukup berarti untuk dijelaskan pada periode ini.' };
    const lines = [];
    const PR = prevRange(P);
    const contrib = (dim) => {
      const cur = realGroup(inRange(rs.base, P), dim);
      const old = realGroup(inRange(rs.base, PR), dim);
      const keys = new Set([...cur.keys(), ...old.keys()]);
      return [...keys].map((k) => ({ k, d: (cur.get(k)?.plafond || 0) - (old.get(k)?.plafond || 0) })).sort((a, c) => a.d - c.d);
    };
    const dim = rs.kanca || rs.rm ? null : rs.ro ? 'kanca' : 'ro';
    if (dim) {
      const c = contrib(dim);
      const neg = c.filter((x) => x.d < 0).slice(0, 3);
      const pos = c.filter((x) => x.d > 0).reverse().slice(0, 3);
      const nameOf = (k) => (dim === 'ro' ? roName(k) : esc(k));
      if (neg.length) lines.push(`Penurunan terbesar per ${DIM_WORD[dim]}: ${listJoin(neg.map((x) => `${nameOf(x.k)} (${rpRealSigned(x.d)})`))}.`);
      if (pos.length) lines.push(`Kenaikan terbesar: ${listJoin(pos.map((x) => `${nameOf(x.k)} (${rpRealSigned(x.d)})`))}.`);
    }
    if (!rs.tipe) {
      const c = contrib('tipe');
      const worst = c[0];
      const best = c.at(-1);
      if (worst && worst.d < 0) lines.push(`Per sumber, penurunan terbesar ${esc(worst.k)} (${rpRealSigned(worst.d)})${best && best.d > 0 ? `, kenaikan terbesar ${esc(best.k)} (${rpRealSigned(best.d)})` : ''}.`);
    }
    return {
      ok: true, title: cards[0].implication || cards[0].headline, lines, insights: cards,
      chips: chips([['Penjelasan', 'volume, tiket, komposisi, pola harian'], ['Periode', P?.label || ''], ['Sumber', 'Realisasi'], ...fixChips(q)]),
      link: linkFor('real', q, D, P, 'summary'),
      followups: [`Porsi realisasi per sumber ${P?.label || ''}`.trim(), 'Top 5 kanca realisasi bulan ini'],
    };
  }
  if (source === 'pf') {
    const P = resolvePeriod(q.time, D, 'pf');
    const month = P && D.pf.index.months.includes(P.month) ? P.month : D.pfLatest;
    await preparePf(D.pf, { bulan: month });
    const fs = pfScope(D.pf, { ro, kanca: q.entities.kanca[0] || '', bulan: month });
    const cards = fs ? insightCards([segmentInsight(fs), hotspotInsight(fs), incomeInsight(fs)]) : [];
    if (!cards.length) return { ok: false, title: 'Belum ada perubahan portofolio yang cukup berarti untuk dijelaskan.' };
    return { ok: true, title: cards[0].implication || cards[0].headline, lines: [], insights: cards, chips: chips([['Penjelasan', 'segmen, kantong risiko, profil penghasilan'], ['Bulan', monthYear(month)], ['Sumber', 'Portofolio']]), link: linkFor('pf', q, D, { month }, 'qtrend'), followups: ['Kanca NPL tertinggi', 'Tren NPL portofolio 6 bulan terakhir'] };
  }
  const P = resolvePeriod(q.time, D, 'perf');
  const miss = outOfRange(P, 'perf', D);
  if (miss) return { ok: false, title: miss };
  const ps = perfScope(D.pm, { ro, bulan: P.month, sd: P.kind === 'date' ? Number(P.date.slice(8, 10)) : null });
  if (!ps) return { ok: false, title: 'Data Performance untuk periode ini tidak ada.' };
  let cards;
  if (q.metric === 'npl' || q.metric === 'sml') cards = [qualityInsight(ps)];
  else if (q.metric === 'disburse' || q.metric === 'prodrm') cards = [...paceInsights(ps), growthInsight(ps)];
  else cards = [growthInsight(ps), spreadInsight(ps)];
  cards = insightCards(cards);
  if (!cards.length) return { ok: false, title: 'Belum ada perubahan yang cukup berarti untuk dijelaskan pada periode ini.' };
  const lines = [];
  if (!ps.slice.full && ps.wd < 5) lines.push(`Bulan berjalan baru ${ps.wd} hari kerja. Untuk penjelasan yang lebih stabil, coba tanyakan dengan "bulan lalu".`);
  return {
    ok: true, title: cards[0].implication || cards[0].headline, lines, insights: cards,
    chips: chips([['Penjelasan', q.metric === 'npl' || q.metric === 'sml' ? 'efek nominal vs efek pertumbuhan OS, kontribusi RO' : 'disburse vs runoff, kontribusi RO'], ['Wilayah', roName(ro || NASIONAL)], ['Periode', ps.slice.full ? monthYear(ps.bulan) : `sampai ${dateText(ps.date)}`], ['Sumber', 'Performance'], ...fixChips(q)]),
    link: linkFor('perf', q, D, P, q.metric === 'npl' ? 'npl' : 'trend-os'),
    followups: q.metric === 'npl' ? [`RO mana NPL naik paling tinggi?`, `Tren NPL ${roName(ro || NASIONAL)} 6 bulan terakhir`] : [`RO dengan growth OS terendah`, `Proyeksi disburse akhir bulan`],
  };
}

async function answerForecast(q, D) {
  const ros = rosOf(q, D);
  const ro = ros.length === 1 ? ros[0] : '';
  if (['realisasi', 'realdeb'].includes(q.metric) || pickSource(q) === 'real') {
    const rs = realScope(D.real, { ro, kanca: q.entities.kanca[0] || '', rm: q.entities.rm[0] || '', tipe: q.entities.tipe[0] || '' });
    const card = rs && realProjectionInsight(rs);
    if (!card) {
      const k = rs ? workdaysOf(rs.bulan, rs.lastDay).length : 0;
      return { ok: false, title: rs && !rs.full && k < 5 ? `Bulan berjalan baru ${k} hari kerja, pola awal bulan terlalu labil untuk diproyeksikan. Proyeksi tersedia mulai hari kerja ke-5.` : 'Proyeksi realisasi belum bisa dihitung untuk pilihan ini.' };
    }
    return { ok: true, title: card.headline, lines: [], insights: [card], chips: chips([['Metode', 'pola kumulatif hari kerja 6 bulan terakhir'], ['Sumber', 'Realisasi']]), link: linkFor('real', q, D, null, 'cum-grid'), followups: ['Kenapa realisasi bulan ini turun?', 'Porsi realisasi per sumber bulan ini'] };
  }
  const ps = perfScope(D.pm, { ro });
  if (!ps) return { ok: false, title: 'Data Performance belum tersedia.' };
  const cards = paceInsights(ps).filter((c) => (q.metric === 'os' || q.metric === 'growth' ? /OS/.test(c.headline) : /[Dd]isburse/.test(c.headline)) || !q.metric);
  if (!cards.length) {
    const o = !ps.slice.full ? outlook(D.pm, { ro, real: D.real, perRo: false }) : null;
    if (o?.current) {
      const c = o.current;
      const m = monthName(c.month);
      const where = o.national ? 'nasional' : roName(o.roKey);
      return {
        ok: true,
        title: `Dengan laju biasa, disburse ${where} ${m} diperkirakan ${b(rpM(c.closeDisb))}${ok(c.achDisb) ? ` (${pct(c.achDisb, 1)} dari guidance ${rpM(c.guidance)})` : ''} dan OS akhir bulan ${b(rpM(c.closeOs))}${ok(c.ach) ? ` (capaian RKA ${pct(c.ach, 1)})` : ''}.`,
        lines: [
          `Bulan berjalan baru ${num(c.wdNow)} hari kerja, jadi proyeksi memakai pola 3 bulan penuh terakhir: berapa bagian disburse dan runoff yang biasanya terjadi setelah hari kerja yang sama.`,
          ok(c.lift) && c.lift > 0 ? `Agar OS akhir bulan sesuai RKA, disburse sisa bulan perlu ${rpM(c.needRem)}, ${liftText(c.lift)} dari laju biasa.` : '',
          'Proyeksi dari pola bulan berjalan sendiri tersedia mulai hari kerja ke-5.',
        ].filter(Boolean),
        link: { view: 'ringkasan', params: { ro }, widget: 'outlook', label: 'Buka panel Outlook' },
      };
    }
    return { ok: false, title: 'Proyeksi belum bisa dihitung untuk pilihan ini.' };
  }
  return { ok: true, title: cards[0].implication || cards[0].headline, lines: [], insights: cards, chips: chips([['Metode', 'pola kumulatif hari kerja 6 bulan terakhir'], ['Wilayah', roName(ro || NASIONAL)], ['Sumber', 'Performance']]), link: linkFor('perf', q, D, null, 'pace'), followups: ['RO mana yang paling jauh dari guidance?', 'Kenapa disburse bulan lalu di bawah guidance?'] };
}

async function answerSummary(q, D) {
  const ros = rosOf(q, D);
  if (q.entities.kanca.length || q.entities.rm.length) {
    const sub = { ...q, metric: 'realisasi', intent: 'value' };
    const real = realValue(sub, D);
    const lines = [...(real.lines || [])];
    if (q.entities.kanca.length && D.pf) {
      const pfA = await pfValue({ ...q, metric: 'npl', intent: 'value', time: {} }, D);
      if (pfA.ok) lines.push(pfA.title.replace(/<[^>]+>/g, ''));
    }
    return { ...real, lines, followups: [`Tren realisasi ${whereText(q, D, { source: 'real' })} 6 bulan terakhir`, `Top 5 RM realisasi di ${whereText(q, D, { source: 'real' })}`] };
  }
  const ro = ros.length === 1 ? ros[0] : '';
  const where = ro ? roName(ro) : ros.length ? listJoin(ros.map(roName)) : 'Nasional';
  const ps = perfScope(D.pm, { ro });
  const lines = [];
  if (ps && (ro || !ros.length)) {
    const e = ps.slice.end;
    const g = growthEngine(ps.slice);
    lines.push(`OS ${b(rpM(e.os))}, capaian RKA ${pct(ratio(e.os, e.rka_os), 1)}; ${g.dOs >= 0 ? 'tumbuh' : 'turun'} ${rpM(Math.abs(g.dOs))} sejak awal bulan.`);
    lines.push(`%NPL ${b(pct(ratio(e.npl, e.os)))}, %SML ${pct(ratio(e.dpk, e.os))}; disburse ${rpM(e.disburse)} (${pct(ratio(e.disburse, e.guidance_disb), 1)} guidance).`);
  }
  if (D.real) {
    const rs = realScope(D.real, { ro });
    if (rs) {
      const t = realTotals(rs.base.filter((r) => r.bulan === rs.bulan && r.hari <= rs.lastDay));
      lines.push(`Realisasi ${monthName(rs.bulan)} sampai tanggal ${rs.lastDay}: ${rpReal(t.plafond)} dari ${num(t.debitur)} debitur.`);
    }
  }
  const scope = { performance: { ro }, realisasi: { ro }, portofolio: { ro } };
  if (D.pf) await preparePf(D.pf, { bulan: D.pfLatest });
  const cards = buildInsights({ pm: D.pm, real: D.real, pf: D.pf }, scope, { limit: 3, perKind: 1 });
  return {
    ok: true,
    title: `Ringkasan ${where} per ${ps ? dateText(ps.date) : ''}.`,
    lines, insights: cards,
    chips: chips([['Wilayah', where], ['Isi', 'posisi utama dan 3 temuan terbesar'], ...fixChips(q)]),
    link: linkFor('perf', { ...q, entities: { ...q.entities, ro: ro ? [ro] : [] } }, D, null, 'strip'),
    followups: [`Kenapa OS ${where} naik bulan lalu?`, `Tren NPL ${where} 6 bulan terakhir`, `Proyeksi disburse ${where} akhir bulan`],
  };
}

async function answerAnomaly(q, D) {
  const ros = rosOf(q, D);
  const rs = realScope(D.real, { ro: ros.length === 1 ? ros[0] : '' });
  const card = rs && anomalyInsight(rs);
  if (!card) {
    return {
      ok: true,
      title: `Tidak ada pola realisasi yang menyimpang jauh pada 5 hari kerja terakhir${ros.length === 1 ? ` di ${roName(ros[0])}` : ''}.`,
      lines: ['Cara cek: angka tiap RO (atau kanca bila RO dipilih) pada hari kerja yang sama dibandingkan dengan 6 bulan sebelumnya. Ditandai bila di bawah 60% atau di atas 170% dari median dan selisihnya berarti.'],
      chips: chips([['Metode', 'median hari kerja yang sama, 6 bulan'], ['Sumber', 'Realisasi']]),
      followups: ['Realisasi minggu ini', 'Top 5 kanca realisasi bulan ini'],
    };
  }
  return { ok: true, title: card.headline, lines: [], insights: [card], chips: chips([['Metode', 'median hari kerja yang sama, 6 bulan'], ['Sumber', 'Realisasi']]), link: { ...card.focus, label: 'Buka di Realisasi' }, followups: ['Realisasi minggu ini', 'Ada anomali di Jakarta 1?'] };
}

function answerDefine(q, vocab) {
  const term = q.term || '';
  const g = vocab.glossary.get(term) || GLOSSARY.find((x) => x.keys.some((k) => term.includes(k) || k.includes(term)));
  if (!g) {
    return {
      ok: false,
      title: term ? `Istilah "${esc(term)}" belum ada di kamus dashboard.` : 'Istilah mana yang ingin dijelaskan?',
      lines: [`Istilah yang tersedia: ${GLOSSARY.map((x) => x.title.split(' (')[0]).join(', ')}.`],
      followups: ['Apa itu SML?', 'Apa itu runoff?', 'Rumus %NPL'],
    };
  }
  return { ok: true, title: `${b(esc(g.title))}`, lines: [g.text], chips: chips([['Sumber', 'kamus dashboard']]), followups: GLOSSARY.filter((x) => x !== g).slice(0, 3).map((x) => `Apa itu ${x.title.split(' (')[0]}?`) };
}

function answerHelp() {
  return {
    ok: true,
    title: 'Tanya dengan bahasa sehari-hari. Sebut metrik, wilayah, dan periode bila perlu.',
    lines: ['Metrik: OS, growth, NPL, SML, disburse, realisasi, debitur, plafond rata-rata, produktivitas RM, runoff.', 'Wilayah: nama RO (misal Bandung, Jakarta 2), provinsi, kanca (awali dengan KC), RM, atau sumber realisasi (termasuk ETB).', 'Periode: hari ini, kemarin, minggu ini, bulan lalu, Oktober, Q3, 3 bulan terakhir, sejak awal tahun.'],
    examples: EXAMPLES,
  };
}

function followupsFor(q, where) {
  const label = { os: 'OS', growth: 'growth OS', npl: 'NPL', sml: 'SML', disburse: 'disburse', realisasi: 'realisasi', debitur: 'debitur', ticket: 'plafond rata-rata', prodrm: 'produktivitas RM', runoff: 'runoff' }[q.metric] || 'OS';
  const w = where.replace(/<[^>]+>/g, '');
  const out = [`Tren ${label} ${w} 6 bulan terakhir`];
  out.push(w === 'Nasional' ? `RO dengan ${label} tertinggi` : `Bandingkan ${label} ${w} dengan nasional`.replace(' dengan nasional', ' dan Jakarta 1'));
  out.push(`Kenapa ${label} ${w} berubah bulan lalu?`);
  return out;
}

function similarNames(text, names, limit = 3) {
  const t = text.toLowerCase();
  const score = (n) => {
    const s = n.toLowerCase().replace(/^(kc|kanca|rm|region \d+ \/)\s*/, '');
    if (s.includes(t) || t.includes(s)) return 0;
    let common = 0;
    for (let i = 0; i < Math.min(s.length, t.length) && s[i] === t[i]; i += 1) common += 1;
    return 10 - common;
  };
  return names.map((n) => ({ n, s: score(n) })).filter((x) => x.s <= 8).sort((a, c) => a.s - c.s).slice(0, limit).map((x) => x.n);
}

function answerUnresolved(q, vocab) {
  const u = q.unresolved;
  const pool = u.type === 'kanca' ? vocab.kancas : u.type === 'rm' ? vocab.rms : vocab.ros;
  const near = similarNames(u.text, pool);
  const word = { kanca: 'Kanca', rm: 'RM', ro: 'RO' }[u.type];
  return {
    ok: false,
    title: `${word} "${esc(u.text)}" tidak ditemukan di data yang sedang dimuat.`,
    lines: [near.length ? `Nama yang mirip: ${listJoin(near.map((n) => esc(u.type === 'ro' ? roName(n) : n)))}.` : `Cek ejaan, atau pilih dari daftar ${word.toLowerCase()} di filter halaman.`],
    followups: near.slice(0, 2).map((n) => `Realisasi ${u.type === 'ro' ? roName(n) : n} bulan ini`),
  };
}

function answerPlan(q, D) {
  if (!D.pm) return { ok: false, title: 'Data Performance belum tersedia untuk menghitung kebutuhan.' };
  const ros = rosOf(q, D);
  const ro = ros.length === 1 ? ros[0] : '';
  const o = outlook(D.pm, { ro, real: D.real });
  if (!o) return { ok: false, title: 'Riwayat data belum cukup untuk proyeksi. Proyeksi butuh minimal dua bulan penuh sebelum bulan berjalan.' };
  const wantsCurrent = (q.time?.kind === 'monthRel' && q.time.n === 0) || /\bsisa\b/.test(q.norm);
  const mode = wantsCurrent && o.current ? 'current' : 'next';
  const where = o.national ? 'nasional' : roName(o.roKey);
  const month = mode === 'current' ? o.current.month : o.next.month;
  const link = { view: D.pm ? 'ringkasan' : 'performance', params: { ro }, widget: 'outlook', label: 'Buka panel Outlook' };
  const view = outlookText(o, mode, where);
  const m = monthName(month);
  const lift = /(naik|tambah|lebih|turun|kurang|minus)\s*(\d+(?:[.,]\d+)?)\s*(%|persen)/.exec(String(q.raw).toLowerCase());
  if (lift) {
    const v = (Number(lift[2].replace(',', '.')) / 100) * (/(turun|kurang|minus)/.test(lift[1]) ? -1 : 1);
    if (mode === 'current') {
      const r = simulateCurrent(o, v);
      return {
        ok: true,
        title: `Bila disburse sisa ${m} ${liftText(v)} dari laju biasa, OS ${where} akhir bulan sekitar ${b(rpM(r.os))}, capaian RKA ${b(pct(r.ach, 1))}.`,
        lines: [
          ok(r.gap) ? (r.gap >= 0 ? `Lebih ${rpM(r.gap)} dari RKA ${rpM(o.current.target)}.` : `Masih kurang ${rpM(-r.gap)} dari RKA ${rpM(o.current.target)}.`) : '',
          ok(o.current.lift) ? `Kenaikan yang pas untuk 100% RKA: ${b(liftText(o.current.lift))} (sisa bulan ${rpM(Math.max(0, o.current.needRem))}).` : '',
          ok(r.achDisb) ? `Capaian guidance disburse menjadi ${pct(r.achDisb, 1)}.` : '',
        ].filter(Boolean),
        link,
      };
    }
    const r = simulate(o, v);
    const n = o.next;
    return {
      ok: true,
      title: `Bila disburse ${m} ${liftText(v)} dari laju biasa (${b(rpM(r.disb))}), OS ${where} akhir ${m} sekitar ${b(rpM(r.os))}${ok(r.ach) ? `, capaian ${b(pct(r.ach, 1))} terhadap ${{ input: 'target', rka: 'RKA' }[n.targetSource] || 'perkiraan RKA'} ${rpM(n.target)}` : ''}.`,
      lines: [
        ok(r.gap) ? (r.gap >= 0 ? `Lebih ${rpM(r.gap)} dari target.` : `Masih kurang ${rpM(-r.gap)} dari target.`) : '',
        ok(n.lift) ? `Kenaikan yang pas untuk 100%: ${b(liftText(n.lift))} (disburse ${rpM(n.needDisb)}).` : '',
        `Pertumbuhan OS ${rpM(r.growth)} setelah runoff sekitar ${rpM(n.baseRun)}.`,
      ].filter(Boolean),
      link,
    };
  }
  if (q.metric === 'npl' || q.metric === 'sml') {
    const lines = view.quality.slice(1);
    return { ok: true, title: view.quality[0] || `Belum ada data NPL yang cukup untuk ${m}.`, lines, link };
  }
  const byRo = q.planRank || q.order || q.groupBy === 'ro' || /\b(ro|region|regional)\b (mana|yang paling|paling)|\b(per|tiap|setiap|masing masing) (ro|region)\b/.test(q.norm);
  if (byRo && o.national) {
    const rows = roRows(o, mode);
    const asc = q.order === 'asc' || q.order === 'best';
    const sorted = asc ? [...rows].reverse() : rows;
    const top = sorted[0];
    return {
      ok: true,
      title: top ? `${b(roName(top.ro))} ${asc ? 'paling ringan' : 'paling butuh dorongan'} ${mode === 'current' ? `di sisa ${m}` : `di ${m}`}: disburse perlu ${b(rpM(Math.max(0, top.need)))}, ${liftText(top.lift)} dari laju biasa ${rpM(top.base)}.` : 'Belum ada data per RO.',
      lines: [
        `${rows.filter((r) => liftTone(r.lift) === 'bad').length} RO butuh kenaikan di atas 40%, ${rows.filter((r) => liftTone(r.lift) === 'good').length} RO cukup dengan laju biasa.`,
        'Kenaikan dihitung terhadap rata-rata disburse per hari kerja 3 bulan penuh terakhir; target memakai RKA bila ada, atau perkiraan dari kenaikan RKA 3 bulan terakhir.',
      ],
      list: { items: sorted.slice(0, q.topN || 8).map((r, i) => ({ rank: i + 1, label: esc(roName(r.ro)), sub: LIFT_WORD[liftTone(r.lift)], v: r.lift ?? 0, text: `${liftText(r.lift)}, ${rpM(Math.max(0, r.need ?? 0))}` })) },
      link,
    };
  }
  return { ok: true, title: view.lead, lines: [...view.facts, ...view.notes], link };
}

function answerCoverage(q, D) {
  const T = D.territory;
  const short = (k) => esc(kancaLabel(k).replace(/^KC\s+/i, ''));
  const names = (list, max = 8) => {
    const all = list.map((x) => short(x.kanca));
    return all.length > max ? `${all.slice(0, max).join(', ')}, dan ${all.length - max} lainnya` : all.join(', ');
  };
  const link = (ro = '') => ({ view: 'performance', params: { ro }, widget: 'map', label: 'Buka peta wilayah' });
  const ros = rosOf({ ...q, entities: { ...q.entities, prov: [] } }, D);
  if (q.entities.kanca.length) {
    const found = q.entities.kanca.map((k) => ({ k, hit: T.findKanca(k) }));
    const lines = found.map(({ k, hit }) => (hit
      ? `${b(short(hit.kanca))} masuk ${b(roName(hit.ro))}, provinsi ${provinceName(hit.prov)}${hit.area ? `, wilayah ${metroArea(hit.area).name}` : ''}.`
      : `${esc(k)} belum ada di daftar kantor cabang per RO.`));
    const first = found.find((x) => x.hit)?.hit;
    return { ok: true, title: lines[0], lines: lines.slice(1), link: link(first?.ro || '') };
  }
  if (q.entities.prov.length && !ros.length) {
    const codes = [...new Set(q.entities.prov.flatMap((c) => ISLANDS[c] || [c]))];
    const weight = new Map();
    for (const c of codes) for (const { ro, n } of T.rosIn(c)) weight.set(ro, (weight.get(ro) || 0) + n);
    const list = [...weight.entries()].sort((a, c) => c[1] - a[1]);
    const label = listJoin(q.entities.prov.map(provinceLabel));
    if (!list.length) return { ok: true, title: `Belum ada kantor cabang di ${label} pada data yang dimuat.`, lines: [] };
    const total = list.reduce((t, [, n]) => t + n, 0);
    return {
      ok: true,
      title: `${label} dilayani ${list.length > 1 ? `${b(list.length)} RO` : b(roName(list[0][0]))} dengan ${b(num(total))} kantor cabang.`,
      lines: list.map(([ro, n]) => {
        const here = codes.flatMap((c) => T.kancasIn(c)).filter((x) => x.ro === ro);
        return `${b(roName(ro))}: ${num(n)} kanca${here.length ? ` (${names(here)})` : ''}.`;
      }),
      link: link(list.length === 1 ? list[0][0] : ''),
    };
  }
  const wantsMetro = !ros.length && /jabodetabek|jakarta|jkt|metro/.test(q.norm);
  const list = ros.length ? ros : wantsMetro ? D.regions.filter((ro) => T.isMetro(ro)) : [];
  const areaLines = (ro) => {
    const areas = T.metroAreasOf(ro);
    const mine = T.kancasOf(ro);
    return areas.map((id) => {
      const here = mine.filter((x) => x.area === id);
      const n = T.metroIn(id).find((x) => x.ro === ro)?.n || here.length;
      return `${metroArea(id).name} (${num(n)})${here.length ? `: ${names(here, 6)}` : ''}`;
    });
  };
  const provLines = (ro) => T.provincesOf(ro).map((p) => {
    const n = T.rosIn(p).find((x) => x.ro === ro)?.n || 0;
    const here = T.kancasOf(ro).filter((x) => x.prov === p);
    return `${provinceName(p)} (${num(n)})${here.length ? `: ${names(here, 6)}` : ''}`;
  });
  if (list.length === 1) {
    const ro = list[0];
    const n = T.kancaCount(ro);
    const provs = T.provincesOf(ro).map(provinceName);
    const metro = T.isMetro(ro);
    const shared = T.provincesOf(ro).filter((p) => T.rosIn(p).length > 1)
      .map((p) => `${provinceName(p)} (bersama ${listJoin(T.rosIn(p).filter((x) => x.ro !== ro).map((x) => roName(x.ro)))})`);
    return {
      ok: true,
      title: `${b(roName(ro))} membawahi ${b(num(n))} kantor cabang di ${listJoin(provs)}.`,
      lines: [
        ...(metro ? areaLines(ro) : provLines(ro)).map((l) => `${l}.`),
        ...(shared.length ? [`Provinsi yang juga dilayani RO lain: ${listJoin(shared)}.`] : []),
      ],
      link: link(ro),
    };
  }
  if (list.length > 1) {
    return {
      ok: true,
      title: `Pembagian wilayah ${listJoin(list.map(roName))} mengikuti kantor cabangnya:`,
      lines: list.map((ro) => {
        const parts = T.isMetro(ro)
          ? T.metroAreasOf(ro).map((id) => `${metroArea(id).short} ${num(T.metroIn(id).find((x) => x.ro === ro)?.n || 0)}`)
          : T.provincesOf(ro).map((p) => `${provinceName(p)} ${num(T.rosIn(p).find((x) => x.ro === ro)?.n || 0)}`);
        return `${b(roName(ro))}, ${num(T.kancaCount(ro))} kanca: ${parts.join(', ')}.`;
      }),
      link: link(),
    };
  }
  const shared = T.provinces().filter((p) => T.rosIn(p).length > 1)
    .map((p) => `${provinceName(p)} (${listJoin(T.rosIn(p).map((x) => roName(x.ro)))})`);
  const metroRos = D.regions.filter((ro) => T.isMetro(ro));
  return {
    ok: true,
    title: `${b(num(D.regions.length))} RO membawahi ${b(num(T.totalKanca()))} kantor cabang. Wilayah tiap RO ditentukan oleh kantor cabangnya.`,
    lines: [
      ...(metroRos.length ? [`${METRO_NAME} dibagi ke ${listJoin(metroRos.map(roName))}: ${metroRos.map((ro) => `${roName(ro)} di ${listJoin(T.metroAreasOf(ro).map((id) => metroArea(id).short))}`).join('; ')}.`] : []),
      ...(shared.length ? [`Provinsi yang dilayani lebih dari satu RO: ${shared.join('; ')}.`] : []),
      'Sebut nama RO, provinsi, atau kanca untuk melihat rinciannya.',
    ],
    link: link(),
  };
}

export async function answer(q, D, vocab) {
  if (q.unresolved && !['help', 'define'].includes(q.intent)) return answerUnresolved(q, vocab);
  if (q.intent === 'rank' && !q.metric) {
    if (['rm', 'kanca', 'tipe', 'tujuan'].includes(q.groupBy)) q = { ...q, metric: 'realisasi' };
    else {
      return {
        ok: false,
        title: `${q.order === 'best' ? 'Terbaik' : q.order === 'worst' ? 'Terburuk' : 'Peringkat'} menurut apa?`,
        lines: ['Sebut metriknya agar urutannya jelas.'],
        followups: ['RO dengan growth OS tertinggi', 'RO dengan NPL terendah', 'RO dengan capaian disburse tertinggi'],
      };
    }
  }
  if (q.intent === 'help') return answerHelp();
  if (q.intent === 'coverage') return answerCoverage(q, D);
  if (q.intent === 'plan') return answerPlan(q, D);
  if (q.intent === 'define') return answerDefine(q, vocab);
  if (q.intent === 'anomaly') return answerAnomaly(q, D);
  if (q.intent === 'why') return answerWhy(q, D);
  if (q.intent === 'forecast') return answerForecast(q, D);
  if (q.intent === 'summary') return answerSummary(q, D);
  if (!q.metric && q.intent !== 'compare') return null;
  if (q.intent === 'compare') return compareEntities(q, D);
  if (q.intent === 'rank') return answerRank(q, D);
  if (q.intent === 'filter') return answerFilter(q, D);
  if (q.intent === 'share') return answerShare(q, D);
  if (q.intent === 'trend') return answerTrend(q, D);
  const source = pickSource(q);
  if (q.intent === 'count' && q.metric === 'debitur' && source === 'perf') return perfValue(q, D);
  if (q.intent === 'average' && (q.metric === 'realisasi' || q.metric === 'disburse')) return realValue({ ...q, metric: q.metric === 'disburse' ? 'realisasi' : q.metric }, D);
  if (q.intent === 'change') {
    const v = source === 'perf' ? perfValue(q, D) : source === 'real' ? realValue(q, D) : await pfValue(q, D);
    return v;
  }
  if (source === 'perf') return perfValue(q, D);
  if (source === 'real') return realValue(q, D);
  return pfValue(q, D);
}

