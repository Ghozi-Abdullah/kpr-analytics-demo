import { fmt } from '../core/format.js';
import { ratio, ok } from '../core/values.js';
import { loadHub } from '../analytics/data-hub.js';
import { pfLabels } from '../analytics/measures.js';
import { rpPf, rpReal, monthName, monthYear } from '../analytics/wording.js';
import { kancaProvince, kancaLabel } from './branch-locations.js';

const roKey = (ro) => String(ro || '').replace(/^.*\/\s*/, '').replace(/^RO\s+/i, '').trim().toLowerCase();

export async function perfKancaSource(regions = []) {
  const hub = await loadHub();
  const known = new Map(regions.map((r) => [roKey(r), r]));
  const toRo = (ro) => known.get(roKey(ro)) || ro;
  const kancas = new Map();
  const add = (k, ro) => {
    if (!kancas.has(k)) {
      const prov = kancaProvince(k);
      if (!prov) return null;
      kancas.set(k, { key: k, label: kancaLabel(k), ro: toRo(ro), prov, sums: { b: 0, s: 0, n: 0, r: 0 } });
    }
    return kancas.get(k);
  };
  const pfMonth = hub.pf?.index?.months?.at(-1) || '';
  if (pfMonth) {
    const L = pfLabels(hub.pf, 'os');
    for (const r of hub.pf.monthData.get(pfMonth) || []) {
      if (!r.kanca) continue;
      const o = add(r.kanca, r.ro);
      if (!o) continue;
      if (r.kat === L.base) o.sums.b += r.v || 0;
      else if (r.kat === L.sml) o.sums.s += r.v || 0;
      else if (r.kat === L.npl) o.sums.n += r.v || 0;
    }
  }
  const realMonth = hub.real?.months?.at(-1) || '';
  if (realMonth) {
    for (const r of hub.real.rows) {
      if (r.bulan !== realMonth || !r.kanca) continue;
      const o = add(r.kanca, r.ro);
      if (o) o.sums.r += ok(r.plafond) ? r.plafond : 0;
    }
  }
  const metrics = [];
  if (pfMonth) {
    metrics.push(
      { id: 'npl', label: '%NPL', calc: (t) => ratio(t.n, t.b), format: (v) => fmt.pct(v, 2) },
      { id: 'sml', label: '%SML', calc: (t) => ratio(t.s, t.b), format: (v) => fmt.pct(v, 2) },
      { id: 'os', label: 'OS', calc: (t) => (t.b ? t.b : null), format: rpPf },
    );
  }
  if (realMonth) {
    metrics.push({ id: 'real', label: 'Realisasi', calc: (t) => (t.r ? t.r : null), format: rpReal });
  }
  const last = realMonth && hub.real.maxDate?.startsWith(realMonth) ? Number(hub.real.maxDate.slice(8, 10)) : null;
  const note = [pfMonth ? `OS dan kualitas: portofolio ${monthYear(pfMonth)}` : '', realMonth ? `realisasi ${monthName(realMonth)}${last ? ` sampai tanggal ${last}` : ''}` : ''].filter(Boolean).join('; ');
  return { kancas: [...kancas.values()], metrics, note: note ? `${note}.` : '' };
}
