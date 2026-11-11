import { norm } from '../core/values.js';
import { PORTFOLIO_NODES, PORTFOLIO_RP_UNIT } from '../config.js';

export const PORTFOLIO_UNIT = { rupiah: 1, juta: 1e6, miliar: 1e9 }[PORTFOLIO_RP_UNIT] || 1;
export const NODE = Object.fromEntries(PORTFOLIO_NODES.map((n) => [n.id, n]));

const toks = (l) => norm(l).split(' ');
export const kolOf = (l) => toks(l).find((t) => t === 'SML' || t === 'NPL') || '';
export const jpOf = (l) => toks(l).find((t) => t === 'FI' || t === 'NFI') || '';
export const denomOf = (l) => l.split(/\s+/).filter((t) => !['SML', 'NPL'].includes(t.toUpperCase())).join(' ');
export const matches = (row, filter) => Object.entries(filter).every(([k, v]) => (Array.isArray(v) ? v : [v]).some((x) => norm(row[k]) === norm(x)));

export const SEGMENT_FIELDS = { produk: 'Produk', tujuan: 'Tujuan Kredit', tier: 'Tier Dev' };

export function segmentGaps(rows) {
  const gaps = [];
  for (const [key, column] of Object.entries(SEGMENT_FIELDS)) {
    const present = new Set(rows.map((r) => norm(r[key])).filter(Boolean));
    const options = PORTFOLIO_NODES.filter((n) => n.filter[key] !== undefined).map((n) => [].concat(n.filter[key]));
    const missing = [...new Set(options.filter((alts) => !alts.some((a) => present.has(norm(a)))).map((alts) => alts.join(' atau ')))];
    if (!missing.length) continue;
    const values = [...new Set(rows.map((r) => String(r[key] ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
    gaps.push({ key, column, missing, values });
  }
  return gaps;
}

export function labelsFor(index, ukuran) {
  const order = (index.kategori[ukuran] || []).map(([l]) => l);
  const find = (kol, jp) => order.find((l) => kolOf(l) === kol && jpOf(l) === jp);
  return {
    order, base: find('', '') || order[0], sml: find('SML', ''), npl: find('NPL', ''),
    fi: find('', 'FI'), nfi: find('', 'NFI'), smlFi: find('SML', 'FI'), smlNfi: find('SML', 'NFI'), nplFi: find('NPL', 'FI'), nplNfi: find('NPL', 'NFI'),
  };
}

export function nodeTotals(rows) {
  return new Map(PORTFOLIO_NODES.map((n) => {
    const t = new Map();
    for (const r of rows) if (matches(r, n.filter)) t.set(r.kat, (t.get(r.kat) || 0) + (r.v || 0));
    return [n.id, t];
  }));
}
