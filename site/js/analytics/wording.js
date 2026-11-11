import { ok } from '../core/values.js';
import { fmt, shortRo } from '../core/format.js';
import { MONTHS } from '../core/dates.js';
import { PORTFOLIO_RP_UNIT, REALISASI_PLAFOND_UNIT } from '../config.js';

const UNITS = { rupiah: 1, juta: 1e6, miliar: 1e9 };
export const REAL_UNIT = UNITS[REALISASI_PLAFOND_UNIT] || 1;
export const PF_UNIT = UNITS[PORTFOLIO_RP_UNIT] || 1;
export const PERF_UNIT = 1e9;

const MINUS = '−';

export function rp(v) {
  if (!ok(v)) return '–';
  const a = Math.abs(v);
  const sign = v < 0 ? MINUS : '';
  if (a >= 1e12) return `${sign}Rp ${fmt.num(a / 1e12, a >= 1e14 ? 1 : 2)} T`;
  if (a >= 1e9) return `${sign}Rp ${fmt.num(a / 1e9, a >= 1e11 ? 0 : 1)} M`;
  if (a >= 1e6) return `${sign}Rp ${fmt.num(a / 1e6, a >= 1e8 ? 0 : 1)} jt`;
  return `${sign}Rp ${fmt.num(a, 0)}`;
}
export const rpSigned = (v) => (ok(v) ? `${v > 0 ? '+' : ''}${rp(v)}` : '–');
export const rpM = (v) => rp(ok(v) ? v * PERF_UNIT : v);
export const rpMSigned = (v) => rpSigned(ok(v) ? v * PERF_UNIT : v);
export const rpReal = (v) => rp(ok(v) ? v * REAL_UNIT : v);
export const rpRealSigned = (v) => rpSigned(ok(v) ? v * REAL_UNIT : v);
export const rpPf = (v) => rp(ok(v) ? v * PF_UNIT : v);
export const rpPfSigned = (v) => rpSigned(ok(v) ? v * PF_UNIT : v);

export const pct = (r, d = 2) => fmt.pct(r, d);
export const signedPct = (r, d = 1) => fmt.signedPct(r, d);
export const num = (v, d = 0) => fmt.num(v, d);
export const signedNum = (v, d = 0) => fmt.signed(v, d);

export function bps(d) {
  if (!ok(d)) return '–';
  return `${fmt.num(Math.abs(d) * 1e4, 0)} bps`;
}
export function bpsSigned(d) {
  if (!ok(d)) return '–';
  const v = Math.round(d * 1e4);
  return `${v > 0 ? '+' : v < 0 ? MINUS : ''}${fmt.num(Math.abs(v), 0)} bps`;
}

export function pp(d) {
  if (!ok(d)) return '–';
  const v = Math.round(d * 1000) / 10;
  return `${v > 0 ? '+' : v < 0 ? MINUS : ''}${fmt.num(Math.abs(v), 1)} poin`;
}

export const upDown = (v, up = 'naik', down = 'turun', flat = 'stabil') => (!ok(v) || v === 0 ? flat : v > 0 ? up : down);

export function listJoin(items, word = 'dan') {
  const a = items.filter(Boolean);
  if (a.length <= 1) return a[0] || '';
  if (a.length === 2) return `${a[0]} ${word} ${a[1]}`;
  return `${a.slice(0, -1).join(', ')}, ${word} ${a.at(-1)}`;
}

export const roName = (ro) => (!ro || ro === 'Nasional' ? 'Nasional' : shortRo(ro));
export const monthName = (ym) => (ym ? MONTHS[Number(ym.slice(5, 7)) - 1] : '');
export const monthYear = (ym) => fmt.month(ym);
export const dateText = (iso) => fmt.date(iso);
export const dateShort = (iso) => fmt.dateShort(iso);

export function times(a, b) {
  if (!ok(a) || !ok(b) || b === 0) return '–';
  return `${fmt.num(a / b, a / b >= 10 ? 0 : 1)}×`;
}

export function median(values) {
  const a = values.filter(ok).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export function quantile(values, q) {
  const a = values.filter(ok).sort((x, y) => x - y);
  if (!a.length) return null;
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

export const sum = (values) => values.reduce((s, v) => s + (ok(v) ? v : 0), 0);
