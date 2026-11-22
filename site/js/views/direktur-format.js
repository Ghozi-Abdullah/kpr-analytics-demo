import { fmt } from '../core/format.js';
import { ok } from '../core/values.js';
import { achLevel } from '../core/achievement.js';
import { MONTHS_SHORT } from '../core/dates.js';
import { PERF_UNIT, REAL_UNIT, PF_UNIT } from '../analytics/wording.js';

export const MINUS = '−';
const sign = (v) => (v > 0 ? '+' : v < 0 ? MINUS : '');

export const tn = (vM, d = 2) => fmt.rupiah(ok(vM) ? vM * PERF_UNIT : vM, d);
export const signedTn = (vM) => (ok(vM) ? `${sign(vM)}${tn(Math.abs(vM))}` : '–');
export const realRp = (v, d = 1) => fmt.rupiah(ok(v) ? v * REAL_UNIT : v, d);
export const pfRp = (v, d = 2) => fmt.rupiah(ok(v) ? v * PF_UNIT : v, d);
export const pct = (r, d = 2) => fmt.pct(r, d);
export const points = (v) => (ok(v) ? `${sign(Math.round(v * 1e4) ? v : 0)}${fmt.num(Math.abs(v) * 100, 2)} poin` : '–');
export const short = (ym) => (ym ? MONTHS_SHORT[Number(ym.slice(5, 7)) - 1] : '');
export const roShort = (ro) => String(ro || '').replace(/^.*\/\s*/, '');
export const tone = (r) => (ok(r) ? achLevel(r) : 'none');
export const diff = (a, b) => (ok(a) && ok(b) ? a - b : null);
export const trendTone = (v, good = true) => (!ok(v) || v === 0 ? 'none' : (v > 0) === good ? 'good' : 'bad');
