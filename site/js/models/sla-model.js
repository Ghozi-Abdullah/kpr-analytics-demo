import { SLA_STAGES, SLA_TARGET_HARI, SLA_CRS_ORDER, SLA_JENIS_KPR_ORDER, SLA_SKIP_PROSES } from '../config.js';
import { ok, uniq, byText, sortByOrder } from '../core/values.js';

const keyOf = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const STAGE_BY_TEXT = new Map(SLA_STAGES.flatMap((s) => s.match.map((m) => [m, s.id])));

const STAGE_IDS = new Set(SLA_STAGES.map((s) => s.id));

export const ACTIVE_STAGES = SLA_STAGES.filter((s) => s.active);
export const stageById = (id) => SLA_STAGES.find((s) => s.id === id);
export const isLate = (r) => ok(r.umur) && r.umur > SLA_TARGET_HARI;
export const hasAge = (r) => ok(r.umur) && r.umur >= 0;

export function prepareSla(source, meta, daily = []) {
  for (const r of source) {
    if (!('stage' in r)) r.stage = STAGE_BY_TEXT.get(keyOf(r.proses)) || '';
  }
  const rows = source.filter((r) => r.stage);
  const kancaRo = new Map();
  for (const r of rows) if (r.kanca && !kancaRo.has(r.kanca)) kancaRo.set(r.kanca, r.ro);
  const info = meta?.datasets?.sla || {};
  const days = daily.filter((r) => STAGE_IDS.has(r.tahap) && r.tanggal);
  return {
    rows,
    daily: days,
    dayMin: days.reduce((m, r) => (!m || r.tanggal < m ? r.tanggal : m), ''),
    dayMax: days.reduce((m, r) => (r.tanggal > m ? r.tanggal : m), ''),
    snapshot: info.snapshot || null,
    sample: !!info.sample,
    ros: uniq(rows.map((r) => r.ro)).filter(Boolean).sort(byText),
    months: uniq(rows.map((r) => r.bulan)).filter(Boolean).sort(),
    pendapatan: uniq(rows.map((r) => r.pendapatan)).filter(Boolean).sort(byText),
    putusan: uniq(rows.map((r) => r.putusan)).filter(Boolean).sort(byText),
    crs: sortByOrder(uniq(rows.map((r) => r.crs)).filter(Boolean), SLA_CRS_ORDER),
    jenis: sortByOrder(uniq(rows.map((r) => r.jenis_kpr)).filter(Boolean), SLA_JENIS_KPR_ORDER),
    unknownProses: uniq(source.filter((r) => !r.stage).map((r) => r.proses)).filter((p) => p && !SLA_SKIP_PROSES.includes(keyOf(p))),
    kancaRo,
  };
}

export function filterRows(model, sel, { stage = true } = {}) {
  return model.rows.filter((r) => (!sel.ro || r.ro === sel.ro)
    && (!sel.kanca || r.kanca === sel.kanca)
    && (!sel.pendapatan || r.pendapatan === sel.pendapatan)
    && (!sel.putusan || r.putusan === sel.putusan)
    && (!sel.bulan || r.bulan === sel.bulan)
    && (!stage || !sel.tahap || r.stage === sel.tahap));
}

const blank = () => ({ berkas: 0, nominal: 0, cair: 0, ok: 0, late: 0, umurSum: 0, umurN: 0, umurMin: null, umurMax: null, lamaSum: 0, lamaN: 0, lamaMin: null, lamaMax: null });
const lower = (a, b) => (a === null ? b : Math.min(a, b));
const upper = (a, b) => (a === null ? b : Math.max(a, b));

export function tally(rows) {
  const t = blank();
  for (const r of rows) {
    const n = r.berkas || 0;
    t.berkas += n;
    t.nominal += r.nominal_pengajuan || 0;
    t.cair += r.nominal_cair || 0;
    t.lamaSum += r.lama_sum || 0;
    t.lamaN += r.lama_n || 0;
    if (ok(r.lama_min)) t.lamaMin = lower(t.lamaMin, r.lama_min);
    if (ok(r.lama_max)) t.lamaMax = upper(t.lamaMax, r.lama_max);
    if (hasAge(r)) {
      if (isLate(r)) t.late += n; else t.ok += n;
      t.umurSum += r.umur * n;
      t.umurN += n;
      t.umurMin = lower(t.umurMin, r.umur);
      t.umurMax = upper(t.umurMax, r.umur);
    }
  }
  t.umurAvg = t.umurN ? t.umurSum / t.umurN : null;
  t.lamaAvg = t.lamaN ? t.lamaSum / t.lamaN : null;
  t.onTime = t.ok + t.late ? t.ok / (t.ok + t.late) : null;
  return t;
}

export function byStage(rows) {
  const out = new Map(SLA_STAGES.map((s) => [s.id, []]));
  for (const r of rows) if (out.has(r.stage)) out.get(r.stage).push(r);
  return new Map([...out].map(([k, list]) => [k, tally(list)]));
}

export function groupTally(rows, key) {
  const g = new Map();
  for (const r of rows) {
    const k = r[key] || '';
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(r);
  }
  return new Map([...g].map(([k, list]) => [k, tally(list)]));
}

export const activeRows = (rows) => rows.filter((r) => ACTIVE_STAGES.some((s) => s.id === r.stage));

export function filterDaily(model, sel) {
  return model.daily.filter((r) => (!sel.ro || r.ro === sel.ro)
    && (!sel.kanca || r.kanca === sel.kanca)
    && (!sel.pendapatan || r.pendapatan === sel.pendapatan)
    && (!sel.putusan || r.putusan === sel.putusan));
}

const blankDay = () => Object.fromEntries(SLA_STAGES.map((s) => [s.id, { berkas: 0, nominal: 0 }]));

export function byDate(rows) {
  const out = new Map();
  for (const r of rows) {
    if (!out.has(r.tanggal)) out.set(r.tanggal, blankDay());
    const cell = out.get(r.tanggal)[r.tahap];
    cell.berkas += r.berkas || 0;
    cell.nominal += r.nominal || 0;
  }
  return out;
}

export function shiftDay(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function lastDays(end, count) {
  return end ? Array.from({ length: count }, (_, i) => shiftDay(end, i - count + 1)) : [];
}

export function dayTotals(cells, days, stage) {
  return days.map((d) => cells.get(d)?.[stage]?.berkas || 0);
}
