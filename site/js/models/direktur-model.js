import { shiftMonth, daysInMonth } from '../core/dates.js';
import { ok, ratio } from '../core/values.js';
import { NASIONAL, dayOf } from './performance-model.js';
import { sumberKey, listOf } from './realisasi-sumber.js';
import { ACTIVE_STAGES, byStage } from './sla-model.js';

export const HISTORY_MONTHS = 3;

export function periodsOf(pm) {
  const cur = pm.months.at(-1);
  if (!cur) return [];
  const back = Array.from({ length: HISTORY_MONTHS }, (_, i) => shiftMonth(cur, i - HISTORY_MONTHS));
  return [...back.filter((m) => pm.months.includes(m)), cur];
}

const roKeyOf = (pm, ro) => (ro && pm.byRo.has(ro) ? ro : pm.hasNasional ? NASIONAL : pm.ros[0]);

export function perfPeriods(pm, ro, months) {
  const rows = pm.byRo.get(roKeyOf(pm, ro)) || [];
  return months.map((month) => {
    const days = rows.filter((r) => r.tanggal.startsWith(month));
    const end = days.at(-1) || null;
    if (!end) return { month, days, end: null };
    return {
      month, days, end, date: end.tanggal, full: dayOf(end.tanggal) === daysInMonth(month),
      os: end.os, rkaOs: end.rka_os, achOs: ratio(end.os, end.rka_os),
      deb: end.debitur, rkaDeb: end.rka_deb, achDeb: ratio(end.debitur, end.rka_deb),
      npl: end.npl, rkaNpl: end.rka_npl, nplPct: ratio(end.npl, end.os), rkaNplPct: ratio(end.rka_npl, end.rka_os), achNpl: ratio(end.rka_npl, end.npl),
      sml: end.dpk, rkaSml: end.rka_dpk, smlPct: ratio(end.dpk, end.os), rkaSmlPct: ratio(end.rka_dpk, end.rka_os), achSml: ratio(end.rka_dpk, end.dpk),
      disb: end.disburse, guidance: end.guidance_disb, prognosa: end.prognosa_disb,
      achDisb: ratio(end.disburse, end.guidance_disb), progDisb: ratio(end.disburse, end.prognosa_disb),
    };
  });
}

const SPLIT_KAT = { os: ['OS FI', 'OS NFI'], sml: ['OS SML FI', 'OS SML NFI'], npl: ['OS NPL FI', 'OS NPL NFI'] };

function splitOf(t, month) {
  const pair = ([fi, nfi]) => ({ fi: t.has(fi) ? t.get(fi) : null, nfi: t.has(nfi) ? t.get(nfi) : null });
  const os = pair(SPLIT_KAT.os);
  const sml = pair(SPLIT_KAT.sml);
  const npl = pair(SPLIT_KAT.npl);
  return {
    month, os, sml, npl,
    smlPct: { fi: ratio(sml.fi, os.fi), nfi: ratio(sml.nfi, os.nfi) },
    nplPct: { fi: ratio(npl.fi, os.fi), nfi: ratio(npl.nfi, os.nfi) },
  };
}

function pfTotals(pf, ro, keep) {
  const out = new Map();
  for (const r of pf?.trend || []) {
    if (r.m !== 'os' || (ro && r.ro !== ro) || !keep(r)) continue;
    if (!out.has(r.bulan)) out.set(r.bulan, new Map());
    const t = out.get(r.bulan);
    t.set(r.kat, (t.get(r.kat) || 0) + (ok(r.v) ? r.v : 0));
  }
  return out;
}

const pfMonths = (pf) => [...new Set((pf?.trend || []).map((r) => r.bulan))].sort();

export function pfSplit(pf, ro) {
  const month = pfMonths(pf).at(-1) || '';
  return splitOf(pfTotals(pf, ro, (r) => r.bulan === month).get(month) || new Map(), month);
}

export function pfTrend(pf, ro, count = 12) {
  const months = pfMonths(pf).slice(-count);
  const by = pfTotals(pf, ro, (r) => months.includes(r.bulan));
  return months.map((m) => splitOf(by.get(m) || new Map(), m));
}

export function pfByRo(pf, regions) {
  const month = pfMonths(pf).at(-1) || '';
  const by = new Map();
  for (const r of pf?.trend || []) {
    if (r.bulan !== month || r.m !== 'os') continue;
    if (!by.has(r.ro)) by.set(r.ro, new Map());
    const t = by.get(r.ro);
    t.set(r.kat, (t.get(r.kat) || 0) + (ok(r.v) ? r.v : 0));
  }
  return regions.map((ro) => ({ ro, ...splitOf(by.get(ro) || new Map(), month) }));
}

export function slaNow(sla, ro, months) {
  const rows = (sla?.rows || []).filter((r) => !ro || r.ro === ro);
  const stages = byStage(rows);
  const active = ACTIVE_STAGES.map((s) => {
    const t = stages.get(s.id);
    return { id: s.id, label: s.label, berkas: t.berkas, late: t.late, nominal: t.nominal };
  });
  const cair = new Map(months.map((m) => [m, { berkas: 0, nominal: 0 }]));
  for (const r of sla?.daily || []) {
    if (r.tahap !== 'cair' || (ro && r.ro !== ro)) continue;
    const box = cair.get(r.tanggal.slice(0, 7));
    if (box) { box.berkas += r.berkas || 0; box.nominal += r.nominal || 0; }
  }
  const berkas = active.reduce((s, x) => s + x.berkas, 0);
  const late = active.reduce((s, x) => s + x.late, 0);
  const aged = active.reduce((s, x) => s + (stages.get(x.id).ok + stages.get(x.id).late), 0);
  return {
    stages: active, berkas, late, onTime: aged ? 1 - late / aged : null, cair,
    sample: !!sla?.sample, dayMax: sla?.dayMax || '', hasRows: rows.length > 0,
  };
}

function realWindow(real, month) {
  const at = real.months.includes(month) ? month : real.months.at(-1);
  const latest = at === real.months.at(-1);
  const lastDay = latest ? Number(real.maxDate.slice(8, 10)) : daysInMonth(at);
  return { at, prev: shiftMonth(at, -1), lastDay, full: !latest || lastDay === daysInMonth(at) };
}

const plafondOf = (r) => (ok(r.plafond) ? r.plafond : 0);

export function realCompare(real, ro, mode, month) {
  const key = sumberKey(mode);
  const list = listOf(real, mode);
  const { at, prev, lastDay, full } = realWindow(real, month);
  const cur = new Map();
  const before = new Map();
  for (const r of real.rows) {
    if (ro && r.ro !== ro) continue;
    const box = r.bulan === at ? cur : r.bulan === prev && r.hari <= lastDay ? before : null;
    if (!box) continue;
    const k = list.includes(r[key]) ? r[key] : '';
    box.set(k, (box.get(k) || 0) + plafondOf(r));
  }
  const tipes = [...list, ...(cur.get('') || before.get('') ? [''] : [])];
  const rows = tipes.map((t) => ({ tipe: t, value: cur.get(t) || 0, prev: before.get(t) || 0 }))
    .map((r) => ({ ...r, change: r.prev ? r.value / r.prev - 1 : null }))
    .sort((a, b) => b.value - a.value);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const prevTotal = rows.reduce((s, r) => s + r.prev, 0);
  return { month: at, lastDay, full, rows, total, prevTotal, change: prevTotal ? total / prevTotal - 1 : null };
}

export function realByRo(real, mode, month, regions) {
  const key = sumberKey(mode);
  const list = listOf(real, mode);
  const { at, prev, lastDay, full } = realWindow(real, month);
  const by = new Map(regions.map((ro) => [ro, { ro, cells: new Map(), total: 0, prev: 0 }]));
  let other = false;
  for (const r of real.rows) {
    const box = by.get(r.ro);
    if (!box) continue;
    if (r.bulan === at) {
      const k = list.includes(r[key]) ? r[key] : '';
      if (!k) other = true;
      box.cells.set(k, (box.cells.get(k) || 0) + plafondOf(r));
      box.total += plafondOf(r);
    } else if (r.bulan === prev && r.hari <= lastDay) box.prev += plafondOf(r);
  }
  const rows = [...by.values()].map((x) => ({ ...x, change: x.prev ? x.total / x.prev - 1 : null })).sort((a, b) => b.total - a.total);
  return { month: at, lastDay, full, tipes: [...list, ...(other ? [''] : [])], rows };
}

export function realMonths(real, ro, mode, count = 6) {
  const key = sumberKey(mode);
  const list = listOf(real, mode);
  const months = real.months.slice(-count);
  const cells = new Map();
  let other = false;
  for (const r of real.rows) {
    if ((ro && r.ro !== ro) || !months.includes(r.bulan)) continue;
    const k = list.includes(r[key]) ? r[key] : '';
    if (!k) other = true;
    const id = `${r.bulan}|${k}`;
    cells.set(id, (cells.get(id) || 0) + plafondOf(r));
  }
  const tipes = [...list, ...(other ? [''] : [])];
  const value = (m, t) => cells.get(`${m}|${t}`) || 0;
  return {
    months, tipes, value,
    totals: months.map((m) => tipes.reduce((s, t) => s + value(m, t), 0)),
    partial: months.at(-1) === real.months.at(-1) && Number(real.maxDate.slice(8, 10)) < daysInMonth(months.at(-1)),
  };
}

export function slaByRo(sla, regions, month) {
  return regions.map((ro) => ({ ro, ...slaNow(sla, ro, [month]) })).filter((x) => x.hasRows);
}

export function slaDays(sla, ro, month) {
  const days = Array.from({ length: daysInMonth(month) }, () => ({ cair: 0, masuk: 0 }));
  for (const r of sla?.daily || []) {
    if (!r.tanggal.startsWith(month) || (ro && r.ro !== ro)) continue;
    const d = days[Number(r.tanggal.slice(8, 10)) - 1];
    if (r.tahap === 'cair') d.cair += r.berkas || 0;
    if (r.tahap === 'prakarsa') d.masuk += r.berkas || 0;
  }
  const last = (sla?.daily || []).reduce((m, r) => (r.tanggal.startsWith(month) && r.tanggal > m ? r.tanggal : m), '');
  return { days: last ? days.slice(0, Number(last.slice(8, 10))) : [], last };
}

export function roPeriods(pm, month) {
  const months = [shiftMonth(month, -1), month];
  return pm.regions.map((ro) => {
    const [before, now] = perfPeriods(pm, ro, months);
    return now.end ? { ro, now, before: before.end ? before : null } : null;
  }).filter(Boolean);
}

export function roStanding(pm) {
  return pm.regions.map((ro) => {
    const end = (pm.byRo.get(ro) || []).at(-1);
    if (!end) return null;
    return {
      ro, achOs: ratio(end.os, end.rka_os), nplPct: ratio(end.npl, end.os), rkaNplPct: ratio(end.rka_npl, end.rka_os),
      achNpl: ratio(end.rka_npl, end.npl),
    };
  }).filter(Boolean);
}
