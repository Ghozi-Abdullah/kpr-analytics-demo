import { loadPerf, loadReal, loadPf, preparePf, loadSla } from '../services/datasets.js';
import { loadOne, loadTable } from '../services/data-source.js';

let pending = null;
let slaPending = null;

export function resetHub() { pending = null; slaPending = null; }

export function loadHub() {
  if (!pending) {
    pending = build().catch((err) => { pending = null; throw err; });
  }
  return pending;
}

export function loadSlaHub() {
  if (!slaPending) {
    slaPending = buildSla().catch((err) => { console.warn(err); slaPending = null; return null; });
  }
  return slaPending;
}

async function build() {
  const soft = (p) => p.catch((err) => { console.warn(err); return null; });
  const [pm, real, pf, meta] = await Promise.all([soft(loadPerf()), soft(loadReal()), soft(loadPf()), soft(loadOne('meta.json'))]);
  if (pf?.index?.months?.length) await soft(preparePf(pf, { bulan: pf.index.months.at(-1) }));
  if (!pm && !real && !pf) throw new Error('Data dashboard belum bisa dimuat.');
  return { pm, real, pf, meta };
}

async function buildSla() {
  const [model, raw] = await Promise.all([loadSla(), loadTable('sla.json', [])]);
  if (!model?.rows?.length) return model || null;
  model.rejected = (raw || []).filter((r) => /tolak/i.test(String(r.proses || '')));
  return model;
}
