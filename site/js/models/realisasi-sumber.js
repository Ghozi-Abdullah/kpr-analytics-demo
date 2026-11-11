import { REALISASI_SUMBER_7, REALISASI_SUMBER_6, REALISASI_SUMBER_5, REALISASI_PADANAN, REALISASI_TIPE_ALIAS, REALISASI_LOCAL_CHAMP, REALISASI_SUMBER_DEFAULT } from '../config.js';
import { ok, sortByOrder, uniq } from '../core/values.js';

const LISTS = { 7: REALISASI_SUMBER_7, 6: REALISASI_SUMBER_6, 5: REALISASI_SUMBER_5 };
const MODES = ['7', '6', '5'];
const PALETTE_SIZE = 8;
const SOURCES = { 7: ['tipe'], 6: ['sumber6Raw', 'tipe', 'sumber5Raw'], 5: ['sumber5Raw', 'tipe', 'sumber6Raw'] };
const COLUMN_LABEL = { tipe: 'Tipe KPR', sumber5Raw: '5 Sumber', sumber6Raw: '6 Sumber' };

const keyOf = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const KNOWN = uniq([...MODES.flatMap((m) => LISTS[m]), ...Object.values(REALISASI_PADANAN).flatMap((p) => [...Object.keys(p), ...Object.values(p)])]);
const CANONICAL = new Map([
  ...KNOWN.map((name) => [keyOf(name), name]),
  ...Object.entries(REALISASI_TIPE_ALIAS).map(([alias, name]) => [keyOf(alias), name]),
]);

export const canonicalTipe = (v) => CANONICAL.get(keyOf(v)) || String(v ?? '').trim();
export const sumberKey = (mode) => (MODES.includes(mode) ? `sumber${mode}` : 'tipe');
export const sumberMode = (v, model) => ((model?.modes || ['7', '5']).includes(v) ? v : REALISASI_SUMBER_DEFAULT);
export const listOf = (model, mode) => LISTS[mode] || LISTS[REALISASI_SUMBER_DEFAULT];
export const modeOptions = (model) => (model.modes || ['7', '5']).map((m) => ({ value: m, label: `${m} sumber` }));

export function categoryIn(mode, value) {
  if (!value) return '';
  const list = LISTS[mode];
  if (list.includes(value)) return value;
  const mapped = REALISASI_PADANAN[mode]?.[value];
  return mapped && list.includes(mapped) ? mapped : '';
}

const COLOR = (() => {
  const color = new Map();
  [...LISTS[5], ...LISTS[7]].forEach((name) => { if (!color.has(name)) color.set(name, color.size); });
  const used = new Set(LISTS[6].filter((t) => color.has(t)).map((t) => color.get(t)));
  const rest = [];
  for (const t of LISTS[6].filter((x) => !color.has(x))) {
    const i = color.get(categoryIn('5', t));
    if (i !== undefined && !used.has(i)) { color.set(t, i); used.add(i); } else rest.push(t);
  }
  for (const t of rest) {
    let i = 0;
    while (used.has(i) && i < PALETTE_SIZE - 1) i += 1;
    color.set(t, i);
    used.add(i);
  }
  return color;
})();

export const colorIndexOf = (t) => COLOR.get(t) ?? PALETTE_SIZE - 1;

export function isLocalChamp(value) {
  const key = keyOf(value);
  if (!key || /\b(non|bukan|tidak|no|not)\b/.test(key)) return false;
  return REALISASI_LOCAL_CHAMP.yesValues.includes(key) || key.includes('local champ');
}

function splitLocalChamp(r) {
  const base = SOURCES[6].map((f) => r[f]).find((v) => categoryIn('5', v));
  if (categoryIn('5', base) !== REALISASI_LOCAL_CHAMP.from) return '';
  return isLocalChamp(r.dev_local_champion) ? REALISASI_LOCAL_CHAMP.yes : REALISASI_LOCAL_CHAMP.no;
}

export function tagSumber(rows) {
  let has6 = false;
  for (const r of rows) {
    if (!('sumber5Raw' in r)) {
      r.tipe = canonicalTipe(r.tipe);
      r.sumber5Raw = canonicalTipe(r.sumber5);
      r.sumber6Raw = canonicalTipe(r.sumber6);
    }
    if (r.sumber6Raw || r.dev_local_champion) has6 = true;
    for (const m of MODES) {
      let cat = '';
      for (const f of SOURCES[m]) { cat = categoryIn(m, r[f]); if (cat) break; }
      if (!cat && m === '6') cat = splitLocalChamp(r);
      r[sumberKey(m)] = cat;
    }
  }
  return {
    tipes: sortByOrder(uniq(rows.map((r) => r.tipe)).filter(Boolean), LISTS[7]),
    modes: ['7', ...(has6 ? ['6'] : []), '5'],
  };
}

export function unassigned(rows, mode, field) {
  const key = sumberKey(mode);
  const by = new Map();
  for (const r of rows) {
    if (r[key]) continue;
    const src = SOURCES[mode].find((f) => r[f]) || 'tipe';
    const label = r[src] || '';
    const id = `${src}|${label}`;
    if (!by.has(id)) {
      const group = categoryIn('5', label);
      by.set(id, { label, column: COLUMN_LABEL[src], value: 0, months: new Set(), targets: group ? LISTS[mode].filter((c) => categoryIn('5', c) === group) : [] });
    }
    const g = by.get(id);
    g.value += ok(r[field]) ? r[field] : 0;
    g.months.add(r.bulan);
  }
  return [...by.values()].filter((g) => g.value > 0).sort((a, b) => b.value - a.value);
}

export function modeOf(model, t) {
  if (!t || LISTS[7].includes(t)) return '';
  return ['5', '6'].find((m) => (model?.modes || ['7', '5']).includes(m) && LISTS[m].includes(t)) || '';
}

export function filterKeyOf(model, t, mode = '') {
  if (mode && LISTS[mode]?.includes(t)) return sumberKey(mode);
  const m = ['5', '6', '7'].find((x) => LISTS[x].includes(t));
  return m ? sumberKey(m) : 'tipe';
}

export function groupNames(model) {
  return uniq(['5', ...((model?.modes || []).includes('6') ? ['6'] : [])].flatMap((m) => LISTS[m].filter((t) => !LISTS[7].includes(t))));
}

export function tipeFor(mode, tipe, model) {
  if (!tipe) return '';
  const m = sumberMode(mode, model);
  if (LISTS[m].includes(tipe)) return tipe;
  return categoryIn(m, tipe) || categoryIn(m, categoryIn('5', tipe));
}

export function groupedColumns(mode, tipes) {
  if (mode !== '7') return tipes.map((t) => ({ tipe: t }));
  const out = [];
  for (const t of tipes) {
    const g = categoryIn('5', t);
    const grouped = g && g !== t ? g : '';
    const last = out.at(-1);
    if (grouped && last?.group === grouped) last.members.push(t);
    else out.push(grouped ? { group: grouped, members: [t] } : { tipe: t });
  }
  return out.map((x) => (x.group && x.members.length < 2 ? { tipe: x.members[0] } : x));
}
