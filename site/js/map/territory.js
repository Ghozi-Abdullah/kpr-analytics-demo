import { RO_TERRITORY } from '../config.js';
import { shortRo } from '../core/format.js';
import { kancaProvince, kancaLabel } from './branch-locations.js';
import { metroAreaOf } from './metro-areas.js';

const roKey = (ro) => shortRo(ro).toLowerCase().replace(/\s+/g, ' ');
const keyMatch = (ro, key) => new RegExp(`(^|[^a-z0-9])${key}([^a-z0-9]|$)`).test(roKey(ro));

function bump(map, a, b, n) {
  if (!map.has(a)) map.set(a, new Map());
  const inner = map.get(a);
  inner.set(b, (inner.get(b) || 0) + n);
}

export function buildTerritory(dimRows, regions) {
  const known = new Map(regions.map((r) => [roKey(r), r]));
  const kancas = new Map();
  for (const row of dimRows || []) {
    const ro = known.get(roKey(row?.ro));
    if (!ro || !row.kanca) continue;
    if (!kancas.has(ro)) kancas.set(ro, new Set());
    kancas.get(ro).add(row.kanca);
  }

  const byProv = new Map();
  const byRo = new Map();
  const metro = new Map();
  const metroKanca = new Map();
  const roMetro = new Map();
  const unplaced = [];
  const placed = [];
  for (const [ro, set] of kancas) {
    for (const k of set) {
      const p = kancaProvince(k);
      if (!p) { unplaced.push(k); continue; }
      bump(byProv, p, ro, 1);
      bump(byRo, ro, p, 1);
      const area = metroAreaOf(k, p);
      placed.push({ ro, kanca: k, prov: p, area });
      if (!area) continue;
      bump(metro, area, ro, 1);
      roMetro.set(ro, (roMetro.get(ro) || 0) + 1);
      if (!metroKanca.has(area)) metroKanca.set(area, new Map());
      const list = metroKanca.get(area).get(ro) || [];
      list.push(k);
      metroKanca.get(area).set(ro, list);
    }
  }
  for (const ro of regions) {
    if (byRo.has(ro)) continue;
    const hit = RO_TERRITORY.find((e) => keyMatch(ro, e.key));
    if (!hit) continue;
    for (const [p, n] of Object.entries(hit.prov)) { bump(byProv, p, ro, n); bump(byRo, ro, p, n); }
    for (const [area, n] of Object.entries(hit.metro || {})) { bump(metro, area, ro, n); roMetro.set(ro, (roMetro.get(ro) || 0) + n); }
  }

  const order = new Map(regions.map((r, i) => [r, i]));
  const ranked = (m) => [...(m || new Map()).entries()]
    .sort((a, b) => b[1] - a[1] || (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0));
  const total = (ro) => [...(byRo.get(ro)?.values() || [])].reduce((t, n) => t + n, 0);
  const owner = (p) => ranked(byProv.get(p))[0]?.[0] || '';

  return {
    fromKanca: kancas.size > 0,
    provinces: () => [...byProv.keys()],
    rosIn: (p) => ranked(byProv.get(p)).map(([ro, n]) => ({ ro, n })),
    owner,
    provincesOf: (ro) => ranked(byRo.get(ro)).map(([p]) => p),
    homeOf: (ro) => {
      const all = ranked(byRo.get(ro)).map(([p]) => p);
      const own = all.filter((p) => owner(p) === ro);
      return own.length ? own : all.slice(0, 1);
    },
    kancaCount: total,
    isMetro: (ro) => total(ro) > 0 && (roMetro.get(ro) || 0) >= total(ro) / 2,
    metroIn: (area) => ranked(metro.get(area)).map(([ro, n]) => ({ ro, n, kanca: metroKanca.get(area)?.get(ro) || [] })),
    metroAreasOf: (ro) => [...metro.entries()].filter(([, m]) => m.has(ro)).sort((a, b) => b[1].get(ro) - a[1].get(ro)).map(([area]) => area),
    kancasOf: (ro) => placed.filter((x) => x.ro === ro),
    kancasIn: (p) => placed.filter((x) => x.prov === p),
    findKanca: (name) => {
      const key = kancaLabel(name).toLowerCase().replace(/\s+/g, ' ');
      return placed.find((x) => kancaLabel(x.kanca).toLowerCase().replace(/\s+/g, ' ') === key) || null;
    },
    totalKanca: () => [...byRo.keys()].reduce((t, ro) => t + total(ro), 0),
    unplaced,
    unmapped: regions.filter((r) => !byRo.has(r)),
  };
}
