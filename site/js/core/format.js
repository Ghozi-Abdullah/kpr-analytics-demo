import { ok } from './values.js';
import { MONTHS, MONTHS_SHORT } from './dates.js';

const nf = new Map();
const numberFormat = (d) => {
  if (!nf.has(d)) {
    const base = new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
    nf.set(d, { format: (v) => base.format(Math.abs(v) < 0.5 / 10 ** d ? 0 : v) });
  }
  return nf.get(d);
};
export const fmt = {
  num: (v, d = 0) => (ok(v) ? numberFormat(d).format(v) : '–'),
  signed: (v, d = 0) => (ok(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${numberFormat(d).format(Math.abs(v))}` : '–'),
  pct: (r, d = 2) => (ok(r) ? `${numberFormat(d).format(r * 100)}%` : '–'),
  signedPct: (r, d = 1) => (ok(r) ? `${r > 0 ? '+' : r < 0 ? '−' : ''}${numberFormat(d).format(Math.abs(r * 100))}%` : '–'),
  rupiah(v, d = 2) {
    if (!ok(v)) return '–';
    const a = Math.abs(v);
    if (a >= 1e12) return `${numberFormat(d).format(v / 1e12)} T`;
    if (a >= 1e9) return `${numberFormat(d).format(v / 1e9)} M`;
    if (a >= 1e6) return `${numberFormat(d).format(v / 1e6)} Jt`;
    return numberFormat(0).format(v);
  },
  compact(v) {
    if (!ok(v)) return '–';
    const a = Math.abs(v);
    if (a >= 1e9) return `${numberFormat(2).format(v / 1e9)} M`;
    if (a >= 1e6) return `${numberFormat(2).format(v / 1e6)} jt`;
    if (a >= 1e4) return `${numberFormat(1).format(v / 1e3)} rb`;
    return numberFormat(0).format(v);
  },
  date(iso) {
    if (!iso) return '–';
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  },
  dateShort(iso) {
    if (!iso) return '–';
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
  },
  month: (ym, short = false) => {
    if (!ym) return '–';
    const [y, m] = ym.split('-').map(Number);
    return `${(short ? MONTHS_SHORT : MONTHS)[m - 1]} ${y}`;
  },
  monthOnly: (ym) => (ym ? MONTHS_SHORT[Number(ym.slice(5, 7)) - 1] : '–'),
};

export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function initials(name) {
  const w = String(name).replace(/^(RO|KC|RM)\s+/i, '').split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2)).toUpperCase();
}
export const shortRo = (ro) => String(ro || '').replace(/^.*\/\s*/, '').replace(/^RO\s+/i, '').trim();
