import { loadHub } from '../analytics/data-hub.js';
import { buildVocab, parseQuestion, mergeFollowUp, suggestFromVocab, normalizeText } from './parser.js';
import { answer, dataContext } from './answers.js';
import { EXAMPLES } from './lexicon.js';
import { esc } from '../core/format.js';
import { groupNames } from '../models/realisasi-sumber.js';

const ALL_EXAMPLES = EXAMPLES.flatMap((g) => g.items);

function overlap(a, b) {
  const A = new Set(normalizeText(a).split(' ').filter((w) => w.length > 2));
  const B = normalizeText(b).split(' ').filter((w) => w.length > 2);
  return B.filter((w) => A.has(w)).length;
}

function fallback(q, text) {
  const ranked = ALL_EXAMPLES.map((e) => ({ e, s: overlap(text, e) })).sort((x, y) => y.s - x.s);
  const picks = (ranked[0]?.s ? ranked.filter((x) => x.s > 0) : ranked).slice(0, 4).map((x) => x.e);
  const unknown = q.unknown.slice(0, 3);
  return {
    ok: false,
    title: unknown.length ? `Saya belum paham bagian "${esc(unknown.join(' '))}".` : 'Pertanyaan ini belum bisa saya jawab.',
    lines: ['Sebut metrik yang dimaksud (OS, NPL, SML, disburse, realisasi, debitur), lalu wilayah atau periode bila perlu.'],
    followups: picks,
  };
}

export function createAsk() {
  let vocab = null;
  let D = null;
  let hubRef = null;
  let memory = null;

  async function ensure() {
    const hub = await loadHub();
    if (hub === hubRef) return;
    hubRef = hub;
    D = dataContext(hub);
    const kancas = new Set();
    const rms = new Set();
    for (const r of hub.real?.rows || []) { if (r.kanca) kancas.add(r.kanca); if (r.rm) rms.add(r.rm); }
    for (const rows of hub.pf?.monthData?.values() || []) for (const r of rows) if (r.kanca) kancas.add(r.kanca);
    vocab = buildVocab({ ros: D.regions, kancas: [...kancas], rms: [...rms], tipes: [...(hub.real?.tipes || []), ...(hub.real ? groupNames(hub.real) : [])] });
  }

  async function ask(text, { context = {} } = {}) {
    await ensure();
    let q = parseQuestion(text, vocab);
    q = mergeFollowUp(q, memory);
    const hasPlace = q.entities.ro.length || q.entities.prov.length || q.entities.kanca.length || q.entities.rm.length;
    if (!hasPlace && context.ro && D.regions.includes(context.ro) && !['help', 'define'].includes(q.intent) && !(q.intent === 'rank' && q.groupBy === 'ro') && !q.followUp) {
      q.entities = { ...q.entities, ro: [context.ro] };
      q.fromFilter = true;
    }
    let a = null;
    try {
      a = await answer(q, D, vocab);
    } catch (err) {
      console.error(err);
      a = { ok: false, title: 'Terjadi kesalahan saat menghitung jawaban.', lines: [esc(err?.message || '')] };
    }
    if (!a) a = fallback(q, text);
    if (q.fromFilter && a.chips) a.chips.push({ k: 'Catatan', v: 'wilayah diambil dari filter halaman' });
    if (a.ok !== false && !['help', 'define'].includes(q.intent)) memory = q;
    return { q, a };
  }

  function suggest(text) {
    const t = normalizeText(text);
    if (!t) return [];
    const out = [];
    if (vocab) for (const s of suggestFromVocab(text, vocab, 4)) out.push({ kind: 'entity', text: s.text, value: s.value, type: s.type });
    const words = t.split(' ').filter((w) => w.length > 1);
    const ex = ALL_EXAMPLES.filter((e) => {
      const n = normalizeText(e);
      return words.every((w) => n.includes(w));
    }).slice(0, 5);
    for (const e of ex) out.push({ kind: 'question', text: e });
    return out.slice(0, 7);
  }

  return { ask, suggest, ensure, reset: () => { memory = null; }, invalidate: () => { hubRef = null; } };
}
