import { ok, ratio } from '../core/values.js';
import { daysInMonth, shiftMonth, weekday } from '../core/dates.js';
import { monthSlice, monthEnds, workdayIndex, dayOf, NASIONAL } from '../models/performance-model.js';
import { labelsFor, matches } from '../models/portfolio-model.js';
import { median } from './wording.js';

export function perfScope(pm, { ro = '', bulan = '', sd = null } = {}) {
  if (!pm) return null;
  const month = pm.months.includes(bulan) ? bulan : pm.months.at(-1);
  const roKey = ro && pm.byRo.has(ro) ? ro : (pm.hasNasional ? NASIONAL : null);
  if (!roKey) return null;
  const slice = monthSlice(pm.byRo.get(roKey), month, sd);
  if (!slice) return null;
  const regions = pm.regions
    .map((r) => ({ ro: r, slice: monthSlice(pm.byRo.get(r), month, slice.endDay) }))
    .filter((x) => x.slice && x.slice.end);
  return { pm, bulan: month, roKey, national: roKey === NASIONAL, slice, regions, date: slice.end.tanggal, wd: slice.end.hari_kerja };
}

export function prevSameDay(slice) {
  for (let d = slice.endDay; d >= 1; d -= 1) {
    const r = slice.prevByDay.get(d);
    if (r) return r;
  }
  return slice.prevEnd;
}

export function growthEngine(slice) {
  const e = slice.end;
  const osEnd = e.os;
  const osStart = ok(e.helper_os) ? e.helper_os : slice.prevEnd?.os;
  const dOs = ok(e.gr_os) ? e.gr_os : (ok(osEnd) && ok(osStart) ? osEnd - osStart : null);
  const disb = e.disburse;
  const runoff = ok(disb) && ok(dOs) ? disb - dOs : null;
  const pr = prevSameDay(slice);
  const dOsPrev = pr && ok(pr.gr_os) ? pr.gr_os : (ok(e.graph_os_lalu) ? e.graph_os_lalu : null);
  const disbPrev = ok(e.disburse_lalu) ? e.disburse_lalu : (pr && ok(pr.disburse) ? pr.disburse : null);
  const osStartPrev = pr && ok(pr.helper_os) ? pr.helper_os : null;
  const runoffPrev = ok(disbPrev) && ok(dOsPrev) ? disbPrev - dOsPrev : null;
  return {
    osEnd, osStart, dOs, rel: ratio(dOs, osStart), disb, runoff, runoffRate: ratio(runoff, osStart),
    dOsPrev, disbPrev, runoffPrev, runoffRatePrev: ratio(runoffPrev, osStartPrev), osStartPrev,
  };
}

export function qualityMove(slice, field) {
  const e = slice.end;
  const v = e[field];
  const os = e.os;
  const v0 = e[`helper_${field}`];
  const os0 = e.helper_os;
  const r = ratio(v, os);
  const r0 = ratio(v0, os0);
  const dv = ok(v) && ok(v0) ? v - v0 : null;
  return {
    v, v0, os, os0, r, r0, dr: ok(r) && ok(r0) ? r - r0 : null, dv,
    numEffect: ok(dv) && ok(os) && os ? dv / os : null,
    denEffect: ok(v0) && ok(os) && ok(os0) && os && os0 ? v0 / os - v0 / os0 : null,
    target: e[`rka_${field}`],
  };
}

export function monthEndRatios(pm, roKey, field, count = 6) {
  return monthEnds(pm, roKey)
    .filter((x) => x.row && dayOf(x.row.tanggal) === daysInMonth(x.bulan))
    .slice(-count)
    .map((x) => ({ bulan: x.bulan, r: ratio(x.row[field], x.row.os), v: x.row[field] }));
}

export function streak(values) {
  let n = 0;
  let dir = 0;
  for (let i = values.length - 1; i > 0; i -= 1) {
    const d = values[i] - values[i - 1];
    if (!ok(d) || d === 0) break;
    const s = Math.sign(d);
    if (dir === 0) dir = s;
    if (s !== dir) break;
    n += 1;
  }
  return { n, dir };
}

export function paceProjection(pm, roKey, slice, field = 'disburse', { months = 6, positive = true } = {}) {
  const rows = pm.byRo.get(roKey) || [];
  const wdNow = slice.end.hari_kerja;
  const cur = slice.end[field];
  if (!ok(wdNow) || !ok(cur)) return null;
  const byMonth = new Map();
  for (const r of rows) {
    const m = r.tanggal.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(r);
  }
  const shares = [];
  for (let k = 1; k <= months; k += 1) {
    const m = shiftMonth(slice.bulan, -k);
    const mr = byMonth.get(m);
    if (!mr?.length) continue;
    const end = mr.at(-1);
    if (dayOf(end.tanggal) !== daysInMonth(m)) continue;
    const total = end[field];
    if (!ok(total) || (positive && total <= 0)) continue;
    let at = null;
    for (const r of mr) if (ok(r.hari_kerja) && r.hari_kerja <= wdNow) at = r;
    if (!at || !ok(at[field])) continue;
    const share = at[field] / total;
    if (share > 0 && share <= 1.5) shares.push(share);
  }
  const idx = workdayIndex(slice);
  const totalWd = idx.at(-1);
  if (shares.length < 2) return null;
  const med = median(shares);
  const lo = Math.min(...shares);
  const hi = Math.max(...shares);
  return {
    cur, shares, med, n: shares.length, wdNow, totalWd, remWd: Math.max(0, totalWd - wdNow),
    proj: cur / med, projLo: cur / hi, projHi: cur / lo, linear: wdNow ? (cur / wdNow) * totalWd : null,
  };
}

export function realLastDay(real, bulan) {
  return bulan === real.months.at(-1) ? Number(real.maxDate.slice(8, 10)) : daysInMonth(bulan);
}

const asSet = (v) => (v === undefined || v === null || v === '' ? null : new Set(Array.isArray(v) ? v : [v]));

export function realFilter(rows, f = {}) {
  const sets = Object.entries(f).map(([k, v]) => [k, asSet(v)]).filter(([, s]) => s);
  if (!sets.length) return rows;
  return rows.filter((r) => sets.every(([k, s]) => s.has(r[k])));
}

export function realInMonth(rows, bulan, lastDay = 31) {
  return rows.filter((r) => r.bulan === bulan && r.hari <= lastDay);
}

export function realInRange(rows, from, to) {
  return rows.filter((r) => r.tanggal >= from && r.tanggal <= to);
}

export function realTotals(rows) {
  let plafond = 0;
  let debitur = 0;
  for (const r of rows) {
    plafond += ok(r.plafond) ? r.plafond : 0;
    debitur += ok(r.debitur) ? r.debitur : 0;
  }
  return { plafond, debitur, ticket: ratio(plafond, debitur), n: rows.length };
}

export function realGroup(rows, dim) {
  const m = new Map();
  for (const r of rows) {
    const k = r[dim];
    if (k === undefined || k === null || k === '') continue;
    let g = m.get(k);
    if (!g) { g = { plafond: 0, debitur: 0 }; m.set(k, g); }
    g.plafond += ok(r.plafond) ? r.plafond : 0;
    g.debitur += ok(r.debitur) ? r.debitur : 0;
  }
  for (const g of m.values()) g.ticket = ratio(g.plafond, g.debitur);
  return m;
}

export function workdaysOf(bulan, lastDay = 31) {
  const out = [];
  const D = Math.min(daysInMonth(bulan), lastDay);
  for (let d = 1; d <= D; d += 1) {
    const iso = `${bulan}-${String(d).padStart(2, '0')}`;
    if (weekday(iso) < 5) out.push(d);
  }
  return out;
}

export function pfLabels(pf, ukuran = 'os') {
  return labelsFor(pf.index, ukuran);
}

export function pfSums(rows, L, filter = {}) {
  const keys = ['base', 'sml', 'npl', 'fi', 'nfi', 'smlFi', 'smlNfi', 'nplFi', 'nplNfi'];
  const byLabel = new Map(keys.filter((k) => L[k]).map((k) => [L[k], k]));
  const out = Object.fromEntries(keys.map((k) => [k, 0]));
  const hasFilter = Object.keys(filter).length > 0;
  for (const r of rows) {
    const k = byLabel.get(r.kat);
    if (!k) continue;
    if (hasFilter && !matches(r, filter)) continue;
    out[k] += r.v || 0;
  }
  out.nplR = ratio(out.npl, out.base);
  out.smlR = ratio(out.sml, out.base);
  out.nplFiR = ratio(out.nplFi, out.fi);
  out.nplNfiR = ratio(out.nplNfi, out.nfi);
  return out;
}

export function pfGroup(rows, L, dim, filter = {}) {
  const groups = new Map();
  for (const r of rows) {
    const k = r[dim];
    if (k === undefined || k === null || k === '') continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const out = new Map();
  for (const [k, list] of groups) out.set(k, pfSums(list, L, filter));
  return out;
}
