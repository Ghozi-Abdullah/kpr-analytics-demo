import { load, loadOne, loadTable } from './data-source.js';
import { prepareSla } from '../models/sla-model.js';
import { indexPerf } from '../models/performance-model.js';
import { uniq, byText } from '../core/values.js';
import { tagSumber } from '../models/realisasi-sumber.js';
import { buildTerritory } from '../map/territory.js';

export async function loadPerf() {
  const [perf, kuad, dim] = await Promise.all([loadTable('perf_daily.json'), loadTable('perf_kuadran.json', []), loadTable('dim_kanca.json', [])]);
  const pm = indexPerf(perf, kuad);
  pm.territory = buildTerritory(dim, pm.regions);
  return pm;
}

export async function loadReal() {
  const rows = await loadTable('realisasi_daily.json');
  for (const r of rows) { r.bulan = r.tanggal.slice(0, 7); r.hari = Number(r.tanggal.slice(8, 10)); }
  const months = uniq(rows.map((r) => r.bulan)).sort();
  const sumber = tagSumber(rows);
  return {
    rows, months, ...sumber,
    ros: uniq(rows.map((r) => r.ro)).filter(Boolean).sort(byText),
    maxDate: rows.reduce((m, r) => (r.tanggal > m ? r.tanggal : m), ''),
  };
}

export async function loadPf() {
  const [index, trend] = await Promise.all([
    load(['portfolio_index.json']).then(([x]) => x),
    loadTable('portfolio_trend.json', []),
  ]);
  return { index, trend, monthData: new Map() };
}

export async function preparePf(m, sel) {
  if (!m.monthData.has(sel.bulan)) m.monthData.set(sel.bulan, await loadTable(`portfolio/${sel.bulan}.json`));
}

export async function loadSla() {
  const [rows, daily, meta] = await Promise.all([loadTable('sla.json', []), loadTable('sla_daily.json', []), loadOne('meta.json').catch(() => null)]);
  return prepareSla(rows, meta, daily);
}
