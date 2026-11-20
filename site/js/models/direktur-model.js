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

export const roKeyOf = (pm, ro) => (ro && pm.byRo.has(ro) ? ro : pm.hasNasional ? NASIONAL : pm.ros[0]);

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

export function realPeriods(real, ro, months, mode) {
  const key = sumberKey(mode);
  const list = listOf(real, mode);
  const sums = new Map(months.map((m) => [m, new Map()]));
  for (const r of real.rows) {
    const box = sums.get(r.bulan);
    if (!box || (ro && r.ro !== ro)) continue;
    const k = list.includes(r[key]) ? r[key] : '';
    box.set(k, (box.get(k) || 0) + (ok(r.plafond) ? r.plafond : 0));
  }
  const other = months.some((m) => (sums.get(m).get('') || 0) > 0);
  return {
    tipes: [...list, ...(other ? [''] : [])],
    months: months.map((m) => {
      const by = sums.get(m);
      return { month: m, by, total: [...by.values()].reduce((a, b) => a + b, 0) };
    }),
  };
}

const SPLIT_KAT = { os: ['OS FI', 'OS NFI'], sml: ['OS SML FI', 'OS SML NFI'], npl: ['OS NPL FI', 'OS NPL NFI'] };

export function pfSplit(pf, ro) {
  const trend = pf?.trend || [];
  const months = [...new Set(trend.map((r) => r.bulan))].sort();
  const month = months.at(-1) || '';
  const t = new Map();
  for (const r of trend) {
    if (r.bulan !== month || r.m !== 'os' || (ro && r.ro !== ro)) continue;
    t.set(r.kat, (t.get(r.kat) || 0) + (ok(r.v) ? r.v : 0));
  }
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
