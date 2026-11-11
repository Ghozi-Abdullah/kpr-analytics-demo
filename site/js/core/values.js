export const ok = (v) => v !== null && v !== undefined && Number.isFinite(v);
export const norm = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
export const uniq = (a) => [...new Set(a)];
export const ratio = (a, b) => (ok(a) && ok(b) && b !== 0 ? a / b : null);
export const sumBy = (rows, key) => rows.reduce((s, r) => s + (ok(r[key]) ? r[key] : 0), 0);
export const byText = (a, b) => String(a).localeCompare(String(b), 'id');
export function sortByOrder(values, order) {
  const idx = new Map(order.map((v, i) => [norm(v), i]));
  return [...values].sort((a, b) => (idx.get(norm(a)) ?? 999) - (idx.get(norm(b)) ?? 999) || byText(a, b));
}
export function sumGroup(rows, key, field) {
  const m = new Map();
  for (const r of rows) {
    const k = key(r);
    m.set(k, (m.get(k) || 0) + (ok(r[field]) ? r[field] : 0));
  }
  return m;
}
export function decode(table) {
  const { fields, dicts, rows } = table;
  const lookups = fields.map((f) => dicts[f] || null);
  return rows.map((r) => {
    const o = {};
    for (let i = 0; i < fields.length; i += 1) o[fields[i]] = lookups[i] ? lookups[i][r[i]] : r[i];
    return o;
  });
}
