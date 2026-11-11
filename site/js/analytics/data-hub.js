import { loadPerf, loadReal, loadPf, preparePf } from '../services/datasets.js';

let pending = null;

export function resetHub() { pending = null; }

export function loadHub() {
  if (!pending) {
    pending = build().catch((err) => { pending = null; throw err; });
  }
  return pending;
}

async function build() {
  const soft = (p) => p.catch((err) => { console.warn(err); return null; });
  const [pm, real, pf] = await Promise.all([soft(loadPerf()), soft(loadReal()), soft(loadPf())]);
  if (pf?.index?.months?.length) await soft(preparePf(pf, { bulan: pf.index.months.at(-1) }));
  if (!pm && !real && !pf) throw new Error('Data dashboard belum bisa dimuat.');
  return { pm, real, pf };
}
