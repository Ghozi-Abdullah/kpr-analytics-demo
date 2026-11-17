import {
  METRIC_WORDS, MODIFIER_WORDS, INTENT_WORDS, ORDER_WORDS, COMPARATOR_WORDS, GROUP_WORDS, TIPE_WORDS, NODE_WORDS, FI_WORDS,
  RO_ALIASES, PROVINCE_ALIASES, MONTH_WORDS, TIME_WORDS, NUMBER_WORDS, STOP_WORDS, GLOSSARY, SLA_METRIC_WORDS, STAGE_WORDS,
  PUTUSAN_WORDS, ATTENTION_WORDS, ABBREVIATIONS, DIFFS,
} from './lexicon.js';

export function normalizeText(text) {
  let s = String(text || '').toLowerCase();
  s = s.replace(/[‘’`´]/g, "'").replace(/[–—]/g, '-');
  s = s.replace(/s\.\s?d\.?|s\/d/g, ' sampai ');
  s = s.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2').replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2');
  s = s.replace(/(\d),(\d)/g, '$1.$2');
  s = s.replace(/(\d)\s*-\s*(\d)/g, '$1 sampai $2');
  s = s.replace(/\b(rata|masing|kira|beda|sama|apa|mana|siapa|kapan|banyak)2\b/g, '$1 $1');
  s = s.replace(/([a-z])-([a-z0-9])/g, '$1 $2').replace(/([a-z])(\d)/g, (m, a, d) => (a === 'q' ? m : `${a} ${d}`));
  s = s.replace(/(\d)(%)/g, '$1 $2').replace(/%/g, ' % ');
  s = s.replace(/(\d)\s*(t|m|jt|rb|miliar|triliun|juta)\b/g, '$1 $2');
  s = s.replace(/[^\p{L}\p{N}%.<>\s]/gu, ' ').replace(/(?<!\d)\.|\.(?!\d)/g, ' ');
  s = s.replace(/\bnya\b/g, ' ').replace(/([a-z]{3,})nya\b/g, '$1');
  return s.split(/\s+/).filter(Boolean).map((w) => ABBREVIATIONS[w] || w).join(' ').replace(/\s+/g, ' ').trim();
}

const tok = (s) => normalizeText(s).split(' ').filter(Boolean);

function damerau(a, b) {
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > 2) return 9;
  const d = Array.from({ length: al + 1 }, (_, i) => [i, ...new Array(bl).fill(0)]);
  for (let j = 0; j <= bl; j += 1) d[0][j] = j;
  for (let i = 1; i <= al; i += 1) {
    for (let j = 1; j <= bl; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[al][bl];
}

const roKeyOf = (ro) => String(ro).replace(/^.*\/\s*/, '').trim().toLowerCase();
const stripKanca = (k) => normalizeText(k).replace(/^(kc|kanca|kck|kcp|kantor cabang|cabang|unit)\s+/, '').trim();

export function buildVocab({ ros = [], kancas = [], rms = [], tipes = [] } = {}) {
  const phrases = new Map();
  const singles = new Map();
  const add = (text, type, value, priority = 1) => {
    const t = tok(text);
    if (!t.length) return;
    const entry = { tokens: t, type, value, priority, text: t.join(' ') };
    if (!phrases.has(t[0])) phrases.set(t[0], []);
    phrases.get(t[0]).push(entry);
    for (const w of t) if (w.length >= 3 && !/^\d+$/.test(w)) singles.set(w, Math.max(singles.get(w) || 0, priority));
  };
  for (const [id, words] of Object.entries(METRIC_WORDS)) for (const w of words) add(w, 'metric', id, 5);
  for (const [id, words] of Object.entries(MODIFIER_WORDS)) for (const w of words) add(w, 'mod', id, 4);
  for (const [id, words] of Object.entries(INTENT_WORDS)) for (const w of words) add(w, 'intent', id, 4);
  for (const w of ATTENTION_WORDS) add(w, 'intent', 'attention', 4);
  for (const [id, words] of Object.entries(SLA_METRIC_WORDS)) for (const w of words) add(w, 'slametric', id, 5);
  for (const [id, words] of Object.entries(STAGE_WORDS)) for (const w of words) add(w, 'stage', id, 4);
  for (const [id, words] of Object.entries(PUTUSAN_WORDS)) for (const w of words) add(w, 'putusan', id, 3);
  for (const [id, words] of Object.entries(ORDER_WORDS)) for (const w of words) add(w, 'order', id, 4);
  for (const [id, words] of Object.entries(COMPARATOR_WORDS)) for (const w of words) add(w, 'cmp', id, 3);
  for (const [id, words] of Object.entries(GROUP_WORDS)) for (const w of words) add(w, 'group', id, 3);
  for (const [id, words] of Object.entries(NODE_WORDS)) for (const w of words) add(w, 'node', id, 3);
  for (const [id, words] of Object.entries(FI_WORDS)) for (const w of words) add(w, 'fi', id, 3);
  for (const [id, words] of Object.entries(MONTH_WORDS)) for (const w of words) add(w, 'month', Number(id), 4);
  for (const [id, words] of Object.entries(TIME_WORDS)) for (const w of words) add(w, 'time', id, 3);
  for (const [w, n] of Object.entries(NUMBER_WORDS)) add(w, 'numword', n, 2);
  for (const t of tipes) {
    for (const w of new Set(TIPE_WORDS[t] || [t])) add(w, 'tipe', t, 3);
  }
  const roByKey = new Map(ros.map((r) => [roKeyOf(r), r]));
  for (const r of ros) {
    const key = roKeyOf(r);
    const code = (String(r).match(/region\s+(\d+)/i) || [])[1];
    const aliases = new Set([key, ...(RO_ALIASES[key] || [])]);
    if (code) for (const c of new Set([code, String(Number(code))])) { aliases.add(`region ${c}`); aliases.add(`ro ${c}`); aliases.add(`regional ${c}`); }
    for (const a of [...aliases]) for (const pre of ['ro', 'region', 'kanwil', 'regional', 'wilayah']) aliases.add(`${pre} ${a}`);
    aliases.add(normalizeText(r));
    for (const a of aliases) add(a, 'ro', [r], 4);
  }
  const jakarta = ros.filter((r) => /jakarta/i.test(r));
  if (jakarta.length > 1) for (const a of ['jakarta', 'jkt', 'ro jakarta', 'jabodetabek']) add(a, 'ro', jakarta, 3);
  for (const [code, words] of Object.entries(PROVINCE_ALIASES)) for (const w of words) add(w, 'prov', code, 3);
  const roAliasSet = new Set();
  for (const list of phrases.values()) for (const p of list) if (p.type === 'ro' || p.type === 'prov') roAliasSet.add(p.text);
  for (const k of kancas) {
    const full = normalizeText(k);
    const bare = stripKanca(k);
    add(full, 'kanca', k, 2);
    for (const pre of ['kc', 'kanca', 'cabang', 'kantor cabang']) add(`${pre} ${bare}`, 'kanca', k, 2);
    if (bare && !roAliasSet.has(bare) && !STOP_WORDS.has(bare) && bare.length >= 4) add(bare, 'kanca', k, 1);
  }
  for (const m of rms) {
    const full = normalizeText(m);
    add(full, 'rm', m, 2);
    const bare = full.replace(/^rm\s+/, '');
    add(`rm ${bare}`, 'rm', m, 2);
    if (bare.split(' ').length >= 2 && !/^dummy/.test(bare)) add(bare, 'rm', m, 1);
  }
  for (const list of phrases.values()) list.sort((a, b) => b.tokens.length - a.tokens.length);
  const glossary = new Map();
  for (const g of GLOSSARY) for (const k of g.keys) glossary.set(normalizeText(k), g);
  for (const k of glossary.keys()) for (const w of k.split(' ')) if (w.length >= 3) singles.set(w, Math.max(singles.get(w) || 0, 1));
  return { phrases, singles, roByKey, glossary, ros, kancas, rms, tipes };
}

function scan(tokens, vocab) {
  const hits = [];
  let i = 0;
  while (i < tokens.length) {
    const cands = vocab.phrases.get(tokens[i]) || [];
    let best = [];
    let len = 0;
    for (const p of cands) {
      const L = p.tokens.length;
      if (L < len) break;
      let ok = true;
      for (let k = 1; k < L; k += 1) if (tokens[i + k] !== p.tokens[k]) { ok = false; break; }
      if (!ok) continue;
      if (L > len) { best = [p]; len = L; } else best.push(p);
    }
    if (best.length) { hits.push({ i, len, entries: best, text: tokens.slice(i, i + len).join(' ') }); i += len; }
    else { hits.push({ i, len: 1, entries: [], text: tokens[i] }); i += 1; }
  }
  return hits;
}

const NO_FIX = new Set(('terima kasih makasih makasi trims thanks halo hallo hello pagi siang sore malam selamat mantap mantab mantul oke okay okey ' +
  'siap kamu anda siapa update diupdate diperbarui permisi assalamualaikum pintar hebat keren paham ngerti jelas noted lanjut dadah ' +
  'kapan tanggal salam punten testing miliar milyar triliun juta ribu persen hari bps berkas aman bantu bantuin membantu kita asli dummy ' +
  'palsu sungguhan bagus jelek sehat parah beres kacau gawat lumayan cukup agak baik buruk lihat liat cek ngecek tolong dong').split(' '));

function correct(tokens, vocab) {
  const fixes = [];
  const out = tokens.map((t) => {
    if (t.length < 4 || /\d/.test(t) || STOP_WORDS.has(t) || NO_FIX.has(t) || vocab.phrases.has(t) || vocab.singles.has(t)) return t;
    let best = null;
    let bestScore = Infinity;
    const limit = t.length <= 5 ? 1 : 2;
    for (const [w, pr] of vocab.singles) {
      if (Math.abs(w.length - t.length) > limit) continue;
      const d = damerau(t, w);
      if (d > limit) continue;
      const score = d * 10 - pr + (w[0] === t[0] ? 0 : 3);
      if (score < bestScore) { bestScore = score; best = w; }
    }
    if (best) { fixes.push([t, best]); return best; }
    return t;
  });
  return { tokens: out, fixes };
}

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4 };

function parseTime(tokens, hits) {
  const t = { kind: null, label: '' };
  const taken = new Set();
  for (const h of hits) {
    if (h.entries.some((e) => ['ro', 'kanca', 'rm', 'tipe', 'node', 'metric', 'prov'].includes(e.type))) for (let k = h.i; k < h.i + h.len; k += 1) taken.add(k);
  }
  const has = (type, value) => hits.some((h) => h.entries.some((e) => e.type === type && (value === undefined || e.value === value)));
  const num = (s) => (s !== undefined && /^\d+(\.\d+)?$/.test(s) ? Number(s) : NUMBER_WORDS[s] ?? null);
  const monthAt = (i) => {
    const h = hits.find((x) => x.i === i);
    return h && h.entries.find((e) => e.type === 'month')?.value;
  };
  const yearAfter = (i) => (/^20\d\d$/.test(tokens[i] || '') ? Number(tokens[i]) : null);
  for (let i = 0; i < tokens.length; i += 1) {
    const w = tokens[i];
    const qm = w.match(/^q([1-4])$/);
    if (qm) return { kind: 'quarter', q: Number(qm[1]), year: yearAfter(i + 1), label: `Q${qm[1]}` };
    if (['kuartal', 'triwulan', 'quarter'].includes(w)) {
      const q = num(tokens[i + 1]) ?? ROMAN[tokens[i + 1]];
      if (q >= 1 && q <= 4) return { kind: 'quarter', q, year: yearAfter(i + 2), label: `kuartal ${q}` };
    }
    if (w === 'semester') {
      const sm = num(tokens[i + 1]) ?? ROMAN[tokens[i + 1]];
      if (sm === 1 || sm === 2) return { kind: 'semester', s: sm, year: yearAfter(i + 2), label: `semester ${sm}` };
    }
    const n = taken.has(i) ? null : num(w);
    if (n !== null && Number.isInteger(n) && n > 0 && n <= 400) {
      const unit = tokens[i + 1];
      const after = tokens[i + 2];
      if (['bulan', 'bln'].includes(unit) && (after === 'terakhir' || tokens[i - 1] === 'terakhir')) return { kind: 'lastN', n, unit: 'month', label: `${n} bulan terakhir` };
      if (unit === 'hari' && (after === 'terakhir' || tokens[i - 1] === 'terakhir')) return { kind: 'lastN', n, unit: 'day', label: `${n} hari terakhir` };
      if (['minggu', 'pekan'].includes(unit) && (after === 'terakhir' || tokens[i - 1] === 'terakhir')) return { kind: 'lastN', n: n * 7, unit: 'day', label: `${n} minggu terakhir` };
      if (['bulan', 'bln'].includes(unit) && after === 'lalu') return { kind: 'monthRel', n: -n, label: `${n} bulan lalu` };
      if (n <= 31) {
        const m1 = monthAt(i + 1);
        if (m1) return { kind: 'date', day: n, month: m1, year: yearAfter(i + 2), label: `${n} ${tokens[i + 1]}` };
        if (['sampai', 'hingga'].includes(tokens[i + 1])) {
          const n2 = num(tokens[i + 2]);
          const m2 = monthAt(i + 3);
          if (n2 && m2) return { kind: 'range', day: n, day2: n2, month: m2, year: yearAfter(i + 4), label: `${n} sampai ${n2} ${tokens[i + 3]}` };
        }
        if (['tanggal', 'tgl'].includes(tokens[i - 1])) return { kind: 'date', day: n, month: null, year: null, label: `tanggal ${n}` };
      }
    }
  }
  const mHit = hits.find((h) => h.entries.some((e) => e.type === 'month'));
  if (mHit) {
    const month = mHit.entries.find((e) => e.type === 'month').value;
    const year = yearAfter(mHit.i + mHit.len);
    const toHit = hits.find((h) => h.i > mHit.i && h.entries.some((e) => e.type === 'month'));
    if (toHit && hits.some((h) => h.i > mHit.i && h.i < toHit.i && h.entries.some((e) => e.type === 'time' && e.value === 'until'))) {
      return { kind: 'monthRange', month, month2: toHit.entries.find((e) => e.type === 'month').value, year, label: `${mHit.text} sampai ${toHit.text}` };
    }
    return { kind: 'month', month, year, label: `${mHit.text}${year ? ` ${year}` : ''}` };
  }
  if (has('time', 'nextMonth')) return { kind: 'monthRel', n: 1, label: 'bulan depan' };
  if (has('time', 'thisMonth')) return { kind: 'monthRel', n: 0, label: 'bulan ini' };
  if (has('time', 'lastMonth')) return { kind: 'monthRel', n: -1, label: 'bulan lalu' };
  if (has('time', 'ytd')) return { kind: 'ytd', label: 'sejak awal tahun' };
  if (has('time', 'lastYear')) return { kind: 'yearRel', n: -1, label: 'tahun lalu' };
  if (has('time', 'thisWeek')) return { kind: 'week', n: 0, label: 'minggu ini' };
  if (has('time', 'lastWeek')) return { kind: 'week', n: -1, label: 'minggu lalu' };
  if (has('time', 'yesterday')) return { kind: 'yesterday', label: 'kemarin' };
  if (has('time', 'today')) return { kind: 'today', label: 'hari ini' };
  if (has('time', 'latest')) return { kind: 'latest', label: 'posisi terakhir' };
  const y = tokens.find((x) => /^20\d\d$/.test(x));
  if (y) return { kind: 'year', year: Number(y), label: y };
  return t;
}

function parseThreshold(tokens, hits) {
  for (const h of hits) {
    const c = h.entries.find((e) => e.type === 'cmp');
    if (!c) continue;
    const j = h.i + h.len;
    const raw = tokens[j];
    if (!raw || !/^\d+(\.\d+)?$/.test(raw)) continue;
    let value = Number(raw);
    let unit = null;
    const u = tokens[j + 1];
    if (u === '%' || u === 'persen') { unit = '%'; value /= 100; }
    else if (u === 'bps') { unit = '%'; value /= 10000; }
    else if (['t', 'triliun'].includes(u)) { unit = 'rp'; value *= 1e12; }
    else if (['m', 'miliar', 'milyar'].includes(u)) { unit = 'rp'; value *= 1e9; }
    else if (['jt', 'juta'].includes(u)) { unit = 'rp'; value *= 1e6; }
    else if (u === 'hari') unit = 'hari';
    else if (u === 'berkas') unit = 'berkas';
    return { op: c.value === 'gt' ? '>' : '<', value, unit, text: `${h.text} ${raw}${u && unit ? ` ${u}` : ''}` };
  }
  return null;
}

function parseTopN(tokens, hits) {
  for (let i = 0; i < tokens.length; i += 1) {
    const w = tokens[i];
    const n = /^\d+$/.test(w) ? Number(w) : NUMBER_WORDS[w];
    if (!n || n > 50) continue;
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    if (prev === 'top' || ['besar', 'teratas', 'tertinggi', 'terbesar', 'terbawah', 'terendah', 'terkecil', 'terbaik', 'terburuk', 'terbanyak'].includes(next)) return n;
    if (['ro', 'kanca', 'cabang', 'rm', 'kc'].includes(next) && hits.some((h) => h.entries.some((e) => e.type === 'order'))) return n;
  }
  return null;
}

const INTENT_PRIORITY = ['help', 'define', 'attention', 'plan', 'coverage', 'why', 'forecast', 'anomaly', 'compare', 'trend', 'share', 'count', 'average', 'summary', 'change', 'value'];

const WEAK_SLA = new Set(['lama', 'berapa lama', 'durasi', 'pengajuan', 'permohonan', 'kepatuhan', 'tepat waktu', 'keputusan', 'approval',
  'disetujui', 'approve', 'tertahan', 'nyangkut', 'numpuk', 'menumpuk', 'pending', 'mandek', 'tertunda', 'belum selesai', 'masih jalan',
  'masih proses', 'telat', 'terlambat', 'tolak', 'reject', 'decline', 'analisa', 'analisis', 'putusan', 'diputus', 'antrian', 'antrean', 'berapa hari']);
const EVAL = /\b(bagus|jelek|aman|sehat|oke|ok|baik|buruk|parah|bahaya|gawat|kacau|beres|lancar|wajar|normal|gimana|bagaimana|kondisi|keadaan)\b/;
const ANALISA_ONLY = new Set(['analisa', 'analisis']);
const CAIR_WORDS = new Set(['cair', 'pencairan', 'dicairkan', 'disburse', 'disbursement', 'disburs', 'booking']);
const SLA_ORDER = ['ditolak', 'lama', 'late', 'ontime', 'umur', 'nominal', 'stuck', 'berkas', 'sla'];
const STATUS_TEXT = new Set(['berkas berjalan', 'berkas aktif', 'masih jalan', 'masih proses', 'belum selesai']);
const TIME_ANCHOR = new Set(['thisMonth', 'lastMonth', 'nextMonth', 'ytd', 'lastYear', 'thisWeek', 'lastWeek', 'yesterday', 'latest', 'today']);
const PERIOD_JOIN = new Set(['vs', 'versus', 'dibanding', 'dibandingkan', 'banding', 'dengan', 'dan', 'lawan', 'sama', 'terhadap', 'ketimbang', 'daripada']);

const TALK = [
  ['thanks', /\b(terima ?kasih|makasih|makasi|trims|thanks|thank you|thx|tq|nuhun|matur nuwun|suwun)\b/],
  ['bye', /^(dadah|bye|bye bye|sampai jumpa|udah dulu|sudah dulu|cukup dulu|segitu dulu|selesai|see you)\b/],
  ['identity', /\b(kamu|anda|lo|lu|kau) (siapa|itu apa|apa sih|ai|robot|bot|manusia)|\bsiapa (kamu|anda|ini)\b|\b(pakai|pake|menggunakan|pakek) (ai|chatgpt|gpt|claude|internet)|\b(chatgpt|gpt|claude)\b|\bcara (kamu|anda|kerja) (kerja|menjawab|jawab)|\bbagaimana (kamu|anda) (bekerja|menjawab|kerja)/],
  ['fresh', /\b(update|diupdate|diperbarui|pembaruan|refresh|terakhir diperbarui|asli|dummy|sungguhan|data palsu|data contoh)\b|\bdata (per|sampai|hingga|posisi) (kapan|tanggal)|\b(kapan|tanggal berapa) data|\bdata (terakhir|terbaru) (kapan|tanggal|tgl)|\bposisi data\b|\bdata (asli|dummy|contoh|sungguhan)\b/],
  ['greet', /^(halo|hallo|helo|hello|hai|hay|hi|hey|hei|pagi|siang|sore|malam|met (pagi|siang|sore|malam)|selamat (pagi|siang|sore|malam|datang)|assalamualaikum|assalamu alaikum|asalamualaikum|salam|permisi|punten|tes|test|testing|ping|p)\b/],
  ['praise', /^(pintar|pinter|hebat|keren|mantap|mantab|mantul|top|bagus|good job|nice|wow|wah|luar biasa|cakep|josss?|jos)\b/],
  ['ack', /^(ok|oke|okay|okey|okee|sip|siap|baik|noted|paham|ngerti|mengerti|jelas|good|yaudah|ya sudah|ya|iya|yoi|hmm|hm|oh|oo|ooh|ohh|oh gitu|oh begitu|begitu ya|lanjut|next)\b/],
];

function detectTalk(norm) {
  for (const [kind, re] of TALK) if (re.test(norm)) return kind;
  return null;
}

function findTerms(tokens, vocab) {
  const out = [];
  for (let i = 0; i < tokens.length;) {
    let hit = null;
    for (let L = 4; L >= 1 && !hit; L -= 1) {
      const k = tokens.slice(i, i + L).join(' ');
      if (L <= tokens.length - i && vocab.glossary.has(k)) hit = { k, L };
    }
    if (hit) { if (!out.includes(hit.k)) out.push(hit.k); i += hit.L; } else i += 1;
  }
  return out;
}

export function diffOf(a, b) {
  const ga = GLOSSARY.find((g) => g.keys.includes(a));
  const gb = GLOSSARY.find((g) => g.keys.includes(b));
  return DIFFS.find((d) => {
    const [x, y] = d.pair.map((k) => GLOSSARY.find((g) => g.keys.includes(k)));
    return (x === ga && y === gb) || (x === gb && y === ga);
  }) || null;
}

function splitPeriods(tokens, hits, vocab) {
  const anchors = hits.filter((h) => h.entries.some((e) => e.type === 'month' || (e.type === 'time' && TIME_ANCHOR.has(e.value))) || /^q[1-4]$/.test(h.text) || /^20\d\d$/.test(h.text));
  if (anchors.length < 2) return null;
  const a = anchors[0];
  const z = anchors[anchors.length - 1];
  const between = tokens.slice(a.i + a.len, z.i);
  if (between.some((w) => ['sampai', 'hingga', 'sd', 'ke'].includes(w))) return null;
  const cut = between.findIndex((w) => PERIOD_JOIN.has(w));
  if (cut < 0) return null;
  const at = a.i + a.len + cut;
  const left = tokens.slice(0, at);
  const right = tokens.slice(at + 1);
  const t1 = parseTime(left, scan(left, vocab));
  const t2 = parseTime(right, scan(right, vocab));
  return t1.kind && t2.kind ? [t1, t2] : null;
}

const SERIES_JOIN = new Set(['dan', 'serta', '&', 'atau']);

function expandSeries(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    out.push(tokens[i]);
    if (!/^(jakarta|jkt|region|regional|ro)$/.test(tokens[i]) || !/^\d{1,2}$/.test(tokens[i + 1] || '')) continue;
    out.push(tokens[i + 1]);
    let j = i + 2;
    while (j < tokens.length) {
      if (SERIES_JOIN.has(tokens[j]) && /^\d{1,2}$/.test(tokens[j + 1] || '')) { out.push(tokens[i], tokens[j + 1]); j += 2; continue; }
      if (/^\d{1,2}$/.test(tokens[j])) { out.push(tokens[i], tokens[j]); j += 1; continue; }
      break;
    }
    i = j - 1;
  }
  return out;
}

export function parseQuestion(text, vocab) {
  const norm0 = normalizeText(text);
  const raw = expandSeries(norm0.split(' ').filter(Boolean));
  const { tokens, fixes } = correct(raw, vocab);
  const hits = scan(tokens, vocab);
  const pick = (type) => hits.flatMap((h) => h.entries.filter((e) => e.type === type).map((e) => ({ ...e, at: h.i, len: h.len, text: h.text })));
  const metrics = pick('metric');
  const mods = new Set(pick('mod').map((e) => e.value));
  const intents = new Set(pick('intent').map((e) => e.value));
  const orders = pick('order').map((e) => e.value);
  const groups = pick('group');
  const q = {
    raw: text, norm: tokens.join(' '), normRaw: raw.join(' '), tokens, fixes, hits,
    intent: null, metric: null, metrics: [...new Set(metrics.map((m) => m.value))],
    nominal: mods.has('nominal'), ratio: mods.has('ratio'), target: mods.has('target'), prognosa: mods.has('prognosa'),
    entities: { ro: [], kanca: [], rm: [], tipe: [], node: [], fi: null, fiList: [], prov: [] },
    groupBy: null, order: null, topN: parseTopN(tokens, hits), threshold: parseThreshold(tokens, hits),
    time: parseTime(tokens, hits), term: null, unknown: [],
  };
  const seen = new Set();
  const typeHits = {};
  for (const h of hits) {
    for (const e of h.entries) {
      const k = `${e.type}:${JSON.stringify(e.value)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      typeHits[e.type] = (typeHits[e.type] || 0) + 1;
      if (e.type === 'ro') q.entities.ro.push(...e.value.filter((r) => !q.entities.ro.includes(r)));
      if (e.type === 'kanca') q.entities.kanca.push(e.value);
      if (e.type === 'rm') q.entities.rm.push(e.value);
      if (e.type === 'tipe') q.entities.tipe.push(e.value);
      if (e.type === 'node') q.entities.node.push(e.value);
      if (e.type === 'fi') { q.entities.fi = e.value; if (!q.entities.fiList.includes(e.value)) q.entities.fiList.push(e.value); }
      if (e.type === 'prov') q.entities.prov.push(e.value);
    }
  }
  const pm = (id) => q.metrics.includes(id);
  if (pm('newdeb')) q.metrics = [...q.metrics.filter((m) => m !== 'newdeb'), 'realisasi', 'debitur'];
  if (pm('quality') && !pm('npl') && !pm('sml')) q.metric = 'quality';
  else if (pm('npl')) q.metric = 'npl';
  else if (pm('sml')) q.metric = 'sml';
  else if (pm('ticket')) q.metric = 'ticket';
  else if (pm('prodrm')) q.metric = 'prodrm';
  else if (pm('runoff')) q.metric = 'runoff';
  else if (pm('rmcount')) q.metric = 'rmcount';
  else if (pm('kancacount')) q.metric = 'kancacount';
  else if (pm('realisasi') && pm('debitur')) q.metric = 'realdeb';
  else if (pm('realisasi') || (pm('plafond') && !pm('os'))) q.metric = 'realisasi';
  else if (pm('disburse')) q.metric = 'disburse';
  else if (pm('growth')) q.metric = 'growth';
  else if (pm('os')) q.metric = 'os';
  else if (pm('debitur')) q.metric = 'debitur';
  else if (q.prognosa) q.metric = 'disburse';
  if (!q.metric && (intents.has('count') || tokens.includes('jumlah') || tokens.includes('berapa'))) {
    const g = groups.map((x) => x.value);
    if (g.includes('rm')) q.metric = 'rmcount';
    else if (g.includes('kanca')) q.metric = 'kancacount';
  }
  const perRm = metrics.find((m) => m.value === 'prodrm' && m.text === 'per rm');
  if (perRm && (pm('realisasi') || pm('plafond') || pm('debitur'))) {
    q.metric = pm('debitur') && pm('realisasi') ? 'realdeb' : pm('debitur') ? 'debitur' : 'realisasi';
    q.groupBy = 'rm';
  }
  const groupHit = groups.find((g) => {
    const before = tokens[g.at - 1];
    const after = tokens[g.at + g.len];
    return ['per', 'tiap', 'setiap', 'masing', 'antar', 'berdasarkan', 'menurut', 'by', 'semua', 'seluruh', 'tiap tiap'].includes(before)
      || ['mana', 'apa', 'yang', 'dengan', 'paling', 'teratas', 'terbawah', 'terbaik', 'terburuk', 'tertinggi', 'terendah', 'terbesar', 'terkecil', 'top', 'saja'].includes(after)
      || orders.length || q.threshold || intents.has('share');
  });
  if (groupHit && !q.groupBy) q.groupBy = groupHit.value;
  q.speed = orders.includes('slow') ? 'slow' : orders.includes('fast') ? 'fast' : null;
  if (orders.includes('best') || orders.includes('worst')) q.order = orders.includes('best') ? 'best' : 'worst';
  else if (orders.includes('desc')) q.order = 'desc';
  else if (orders.includes('asc')) q.order = 'asc';
  else if (orders.includes('rank')) q.order = 'desc';
  else if (q.speed) q.order = q.speed === 'slow' ? 'asc' : 'desc';
  if (intents.has('define')) {
    const after = tokens.slice(hits.find((h) => h.entries.some((e) => e.type === 'intent' && e.value === 'define'))?.i + 1 || 0);
    for (let L = 3; L >= 1 && !q.term; L -= 1) {
      for (let i = 0; i + L <= after.length; i += 1) {
        const k = after.slice(i, i + L).join(' ');
        if (vocab.glossary.has(k)) { q.term = k; break; }
      }
    }
    if (!q.term) q.term = after.filter((w) => !STOP_WORDS.has(w)).join(' ') || null;
    q.terms = findTerms(tokens, vocab);
    if (q.terms.length >= 2 && /\b(beda|bedanya|perbedaan|bedain|membedakan|versus|vs|banding)\b/.test(tokens.join(' '))) q.diff = q.terms.slice(0, 2);
  }
  const sameTypeMany = ['ro', 'kanca', 'rm', 'tipe', 'node', 'prov', 'fi'].some((k) => (typeHits[k] || 0) >= 2);
  q.manyOf = ['ro', 'kanca', 'rm', 'tipe', 'node', 'prov', 'fi'].find((k) => (typeHits[k] || 0) >= 2) || null;
  if (q.manyOf === 'fi') q.manyOf = 'fiList';
  if (intents.has('coverage') && (q.metric || q.order || q.threshold)) {
    const hit = pick('intent').find((e) => e.value === 'coverage');
    intents.delete('coverage');
    if (hit && /kanca|cabang|kc/.test(hit.text) && !q.groupBy) { q.groupBy = 'kanca'; if (!q.order) q.order = 'desc'; }
    else if (hit && /\bro\b|region/.test(hit.text) && !q.groupBy) q.groupBy = 'ro';
  }
  for (const name of INTENT_PRIORITY) {
    if (name === 'compare' && !intents.has('share') && (intents.has('compare') || (sameTypeMany && !q.order && !q.groupBy))) { q.intent = 'compare'; break; }
    if (name === 'summary' && intents.has('summary') && !q.metric) { q.intent = 'summary'; break; }
    if (name === 'change' && intents.has('change')) {
      if (q.order || q.groupBy) { q.intent = 'rank'; q.byChange = true; }
      else q.intent = 'change';
      break;
    }
    if (name !== 'compare' && name !== 'summary' && name !== 'change' && intents.has(name)) { q.intent = name; break; }
  }
  if (!q.intent || q.intent === 'value') {
    if (q.threshold) q.intent = 'filter';
    else if (q.order) q.intent = 'rank';
    else if (q.groupBy) q.intent = 'share';
  }
  if (q.intent === 'value' && intents.has('summary') && !q.metric) q.intent = 'summary';
  if (q.intent === 'trend' && q.order) q.intent = 'rank';
  if (!q.intent) q.intent = q.metric ? 'value' : (Object.values(q.entities).some((v) => (Array.isArray(v) ? v.length : v)) ? 'summary' : 'unknown');
  if (q.time?.kind === 'monthRel' && q.time.n === 1 && ['value', 'forecast', 'summary', 'unknown', 'trend', 'change', 'rank'].includes(q.intent)) {
    q.planRank = q.intent === 'rank';
    q.intent = 'plan';
  }
  for (const h of hits) if (!h.entries.length && !STOP_WORDS.has(h.text) && !/^\d/.test(h.text) && h.text.length > 2) q.unknown.push(h.text);
  refine(q, { tokens, hits, pick, metrics, intents, groups, vocab, normRaw: raw.join(' ') });
  for (let k = 0; k < hits.length; k += 1) {
    const g = hits[k].entries.find((e) => e.type === 'group' && ['kanca', 'rm', 'ro'].includes(e.value));
    if (!g) continue;
    const rest = [];
    for (let j = k + 1; j < hits.length && !hits[j].entries.length; j += 1) {
      if (STOP_WORDS.has(hits[j].text) && !rest.length) break;
      rest.push(hits[j].text);
    }
    const name = rest.filter((w) => !STOP_WORDS.has(w)).join(' ');
    if (name && !/^\d+$/.test(name) && !q.entities[g.value === 'ro' ? 'ro' : g.value].length) { q.unresolved = { type: g.value, text: name }; break; }
  }
  return q;
}

function refine(q, { tokens, hits, pick, metrics, intents, groups, vocab, normRaw }) {
  const norm = tokens.join(' ');
  const slaM = pick('slametric');
  const stageH = pick('stage');
  const putH = pick('putusan');
  const groupIds = groups.map((g) => g.value);
  const nonSla = metrics.filter((m) => !(m.value === 'disburse' && CAIR_WORDS.has(m.text)) && !['quality'].includes(m.value));
  const cues = [...slaM, ...stageH];
  const strong = cues.filter((h) => !WEAK_SLA.has(h.text)).length + groupIds.filter((g) => g === 'tahap' || g === 'putusan').length + putH.length
    + (/\bbelum (di ?putus|cair)\b/.test(norm) ? 1 : 0);
  const weak = cues.filter((h) => WEAK_SLA.has(h.text));
  const extra = (q.speed ? 1 : 0) + (q.threshold?.unit === 'hari' ? 1 : 0) + (slaM.some((h) => ['umur', 'lama'].includes(h.value)) ? 1 : 0);
  const onlyAnalisa = weak.length && weak.every((h) => ANALISA_ONLY.has(h.text)) && !slaM.length;
  const speedCair = q.speed && metrics.some((m) => m.value === 'disburse' && CAIR_WORDS.has(m.text)) && !nonSla.length;
  const slaish = strong > 0 || speedCair || (weak.length > 0 && !nonSla.length && (!onlyAnalisa || weak.length + extra >= 2));
  if (slaish) {
    const ids = new Set(slaM.map((h) => h.value));
    const stages = [];
    for (const h of stageH) if (!stages.includes(h.value)) stages.push(h.value);
    if (metrics.some((m) => m.value === 'disburse' && CAIR_WORDS.has(m.text)) && !stages.includes('cair') && !ids.has('lama')) stages.push('cair');
    const explicit = stages.filter((x) => x !== 'cair' && x !== 'putusan');
    if (/\bbelum (di ?putus)\b/.test(norm) && !explicit.length) { stages.length = 0; stages.push('prakarsa', 'analisa'); }
    else if (/\bbelum cair\b/.test(norm) && !stageH.some((h) => h.value !== 'cair')) { stages.length = 0; stages.push('prakarsa', 'analisa', 'putusan'); }
    else if (/\bbelum cair\b/.test(norm)) { const k = stages.indexOf('cair'); if (k >= 0) stages.splice(k, 1); }
    let metric = SLA_ORDER.find((m) => ids.has(m)) || (speedCair ? 'lama' : null);
    if (metric === 'umur' && stages.length === 1 && stages[0] === 'cair') metric = 'lama';
    if (metric === 'lama' && !stages.length) stages.push('cair');
    if (metric === 'sla' && (q.order === 'best' || q.order === 'worst')) metric = 'ontime';
    const status = slaM.some((h) => STATUS_TEXT.has(h.text) || h.value === 'stuck');
    const eventWord = /\b(masuk|baru|progres|progress|harian|mingguan|bulanan|per hari|per minggu|per bulan|tiap hari|setiap hari|tiap bulan|per tanggal)\b/.test(norm);
    const timed = q.time.kind && q.time.kind !== 'latest';
    const events = !status && !['late', 'ontime', 'umur', 'lama', 'ditolak'].includes(metric) && (eventWord || timed || q.intent === 'trend');
    const putusan = [...new Set(putH.map((h) => h.value))];
    if (putusan.includes('clf') && !putusan.includes('cabang') && /\b(vs|versus|dan|dengan|dibanding|dibandingkan|banding|lawan)\b/.test(norm) && /\bcabang\b/.test(norm)) putusan.push('cabang');
    const perPutusan = /\b(per|tiap|setiap|berdasarkan|menurut|antar) (jenis )?(putusan|pemutus|kewenangan)\b/.test(norm);
    if (perPutusan) { const k = stages.indexOf('putusan'); if (k >= 0) stages.splice(k, 1); }
    q.domain = 'sla';
    q.sla = { metric: metric || (status ? 'berkas' : null), stages, events, putusan, stuck: ids.has('stuck'), status };
    q.metric = null;
    q.metrics = [];
    if (putusan.length >= 2 && !q.manyOf) q.manyOf = 'putusan';
    if (q.entities.fiList.length >= 2 && !q.manyOf) q.manyOf = 'fiList';
    if (perPutusan) q.groupBy = 'putusan';
    if (q.groupBy === 'pendapatan') q.groupBy = 'fi';
    if (['rank', 'share', 'filter', 'compare', 'trend', 'why', 'define', 'help', 'attention', 'summary'].includes(q.intent) === false) q.intent = 'value';
    if (q.intent === 'summary' && !q.entities.ro.length && !q.entities.kanca.length) q.intent = 'value';
    if (q.intent === 'value' && q.order) q.intent = 'rank';
    if (q.intent === 'value' && q.threshold) q.intent = 'filter';
    if (q.intent === 'value' && q.manyOf) q.intent = 'compare';
    if (q.intent === 'value' && q.groupBy) q.intent = 'rank';
    if (q.intent === 'plan') q.intent = 'value';
    q.unknown = q.unknown.filter((w) => !['berjalan', 'masuk', 'baru', 'progres', 'progress'].includes(w));
    q.unresolved = q.unresolved && q.unresolved.text && STAGE_WORDS[q.unresolved.text] ? null : q.unresolved;
  }
  if (!q.domain) {
    const anyEnt = Object.values(q.entities).some((v) => (Array.isArray(v) ? v.length : v));
    if (!q.metric && EVAL.test(norm) && (q.entities.node.length || (q.entities.fi && !q.entities.ro.length))) { q.metric = 'quality'; q.intent = 'value'; }
    else if (!q.metric && EVAL.test(norm) && (q.time.kind || anyEnt) && ['unknown', 'value', 'summary', 'change'].includes(q.intent)) q.intent = 'summary';
    if (q.intent === 'rank' && !q.metric && (q.order === 'worst') && (!q.groupBy || q.groupBy === 'ro')) q.intent = 'attention';
    if (q.metric && /\b(berapa persen|persentase|porsi|kontribusi)\b.*\bdari (total|nasional|keseluruhan|semua)\b|\bdari total\b/.test(norm) && anyEnt && !q.groupBy) q.intent = 'share';
    if (q.intent === 'plan' && /\b(naik|turun|tumbuh|bertambah) berapa\b/.test(norm) && q.time.kind && !(q.time.kind === 'monthRel' && q.time.n >= 0) && !/\b(harus|perlu|butuh|agar|supaya|untuk capai)\b/.test(norm)) {
      q.intent = 'value';
      if (q.metric === 'os') q.metric = 'growth';
    }
    const peakAsk = /\b(kapan|bulan apa|bulan mana|tanggal berapa|hari apa|minggu apa|minggu mana)\b/.test(norm);
    if (peakAsk && q.metric && (q.order || /\b(puncak|rekor|tertinggi|terendah)\b/.test(norm)) && !q.groupBy) {
      q.intent = 'trend';
      q.peak = q.order === 'asc' || q.order === 'worst' ? 'low' : 'high';
      q.order = null;
      if (/\b(tanggal berapa|hari apa)\b/.test(norm)) q.grain = 'day';
      else if (/\b(minggu apa|minggu mana)\b/.test(norm)) q.grain = 'week';
      if (!q.time.kind && q.grain !== 'day') q.time = { kind: 'ytd', label: 'sejak awal tahun' };
    }
    if (q.target && /\b(target|rka|guidance)\b(\s+\S+){0,3}\s+berapa\b|\bberapa (target|rka|guidance)\b/.test(normRaw) && q.intent === 'value') q.targetAsk = true;
    if (q.intent === 'compare' && !q.manyOf) {
      const pair = splitPeriods(tokens, hits, vocab);
      if (pair) { q.time = pair[0]; q.time2 = pair[1]; }
    } else if (!q.manyOf && ['value', 'change', 'trend', 'unknown'].includes(q.intent) && q.metric) {
      const pair = splitPeriods(tokens, hits, vocab);
      if (pair) { q.time = pair[0]; q.time2 = pair[1]; q.intent = 'compare'; }
    }
    if (/\bjauh dari (rka|target|guidance)\b|\b(tertinggal|ketinggalan)\b/.test(norm) && q.metric) { q.target = true; if (!q.groupBy) q.groupBy = 'ro'; if (q.intent === 'value') q.intent = 'rank'; }
    if (q.intent === 'change' && /\b(dibanding|dibandingkan|banding|vs|versus|ketimbang|daripada)\b/.test(norm) && q.time.kind && !q.manyOf) q.intent = 'compare';
    if (q.intent === 'change' && /\bnaik atau turun|turun atau naik|naik apa turun|turun apa naik\b/.test(norm)) { q.intent = 'compare'; q.upDownAsk = true; }
    if (/\bnaik atau turun|turun atau naik|naik apa turun|turun apa naik\b/.test(norm)) q.upDownAsk = true;
    const grain = /\b(per|tiap|setiap) (hari|tanggal)\b|\bharian\b/.test(norm) ? 'day'
      : /\b(per|tiap|setiap) (minggu|pekan)\b|\bmingguan\b/.test(norm) ? 'week'
        : /\b(per|tiap|setiap) bulan\b|\bbulanan\b|\bdari bulan ke bulan\b/.test(norm) ? 'month' : null;
    if (grain && q.metric && !intents.has('average') && ['value', 'trend', 'change', 'unknown'].includes(q.intent)) { q.grain = grain; q.intent = 'trend'; }
    else if (grain && q.intent === 'trend') q.grain = grain;
    if (q.metric && /\b(belum|tidak|tanpa|nol|kosong|zero)\b(\s+\S+){0,2}\s+(realisasi|akad|pencairan|disburse)\b|\b(realisasi|akad)\s+(nol|kosong)\b/.test(norm)
      && (q.groupBy || /\b(kanca|cabang|rm|kc)\b/.test(norm))) {
      q.intent = 'zero';
      q.metric = 'realisasi';
      if (!q.groupBy) q.groupBy = /\brm\b/.test(norm) ? 'rm' : 'kanca';
    }
    if (!q.threshold && /\b(negatif|minus|merah|menyusut|turun)\b/.test(norm) && q.groupBy && (q.metric === 'growth' || q.metric === 'os') && !q.order) {
      q.threshold = { op: '<', value: 0, unit: null, text: 'negatif' };
      if (q.metric === 'os') q.metric = 'growth';
      q.intent = 'filter';
    } else if (!q.threshold && /\b(positif)\b/.test(norm) && q.groupBy && (q.metric === 'growth' || q.metric === 'os') && !q.order) {
      q.threshold = { op: '>', value: 0, unit: null, text: 'positif' };
      if (q.metric === 'os') q.metric = 'growth';
      q.intent = 'filter';
    }
    const reach = /\b(belum|tidak|gagal|kurang|blm)\s+(capai|mencapai|tercapai|memenuhi|sampai|nyampe|memenuhi|penuhi)\b/.test(norm) ? '<'
      : /\b(sudah|telah|berhasil|udah)\s+(capai|mencapai|tercapai|melampaui|melebihi|memenuhi|penuhi)\b|\b(melampaui|melebihi|over) (rka|target)\b/.test(norm) ? '>' : null;
    if (reach && (q.target || /\b(rka|target)\b/.test(norm))) {
      q.target = true;
      if (!q.metric) q.metric = 'os';
      if (!q.groupBy) q.groupBy = 'ro';
      q.threshold = { op: reach, value: 1, unit: 'ach', text: reach === '<' ? 'belum capai RKA' : 'sudah capai RKA' };
      q.intent = 'filter';
    }
    if (q.intent !== 'plan' && /\b(kalau|jika|bila|seandainya|andai|andaikan|misal|misalnya|apabila|asumsi)\b/.test(norm) && /\b(naik|turun|tambah|kurang|lebih)\b\s*\d+(\.\d+)?\s*%/.test(norm)) q.intent = 'plan';
    if (q.intent === 'plan' && /\bdebitur\b/.test(norm) && !/disburse/.test(norm)) q.planDebitur = true;
    if (intents.has('attention') && !q.metric && q.intent !== 'help') q.intent = 'attention';
  }
  const anyEntity = Object.values(q.entities).some((v) => (Array.isArray(v) ? v.length : v));
  if (!q.metric && !q.domain && !anyEntity && !q.threshold && !q.order && !['help', 'define', 'coverage', 'attention', 'anomaly', 'plan', 'forecast', 'why'].includes(q.intent)) {
    q.talk = detectTalk(normRaw) || detectTalk(norm);
    if (q.talk) q.intent = 'talk';
  }
  if (q.intent === 'define' && !q.diff) {
    const terms = findTerms(tokens, vocab);
    if (terms.length >= 2 && /\b(beda|bedanya|perbedaan|bedain|membedakan)\b/.test(norm)) q.diff = terms.slice(0, 2);
  }
}

const FOLLOW_WORDS = new Set(['kalau', 'kalo', 'klo', 'bagaimana', 'gimana', 'gmn', 'terus', 'trus', 'lalu', 'yang', 'untuk', 'bandingkan', 'dibanding', 'vs']);

export function mergeFollowUp(q, prev) {
  if (!prev || ['help', 'define', 'unknown', 'talk'].includes(prev.intent)) return q;
  const hasEntity = Object.values(q.entities).some((v) => (Array.isArray(v) ? v.length : v));
  const followWord = FOLLOW_WORDS.has(q.tokens[0]);
  if (['talk', 'help', 'define'].includes(q.intent)) return q;
  if (['why', 'forecast', 'attention', 'anomaly'].includes(q.intent) && !q.metric && !q.domain && !hasEntity) {
    if (q.intent === 'attention' && prev.intent !== 'attention') return q;
    const time = q.time.kind ? q.time : prev.intent === 'compare' ? (prev.time2 ? prev.time : { kind: null, label: '' }) : prev.time;
    return { ...q, followUp: true, metric: prev.metric, entities: prev.entities, time, domain: prev.domain, sla: prev.sla, nominal: prev.nominal, target: prev.target };
  }
  if (['why', 'forecast', 'anomaly'].includes(q.intent) && !q.metric && !q.domain && hasEntity && prev.metric) {
    return { ...q, followUp: true, metric: prev.metric, time: q.time.kind ? q.time : prev.time, domain: prev.domain, sla: prev.sla };
  }
  const prevEnt = Object.values(prev.entities || {}).some((v) => (Array.isArray(v) ? v.length : v));
  if (q.metric && !hasEntity && !q.domain && !q.groupBy && !/\bnasional\b/.test(q.norm) && prevEnt
    && (q.tokens.length <= 3 || followWord) && !['coverage', 'plan', 'help', 'define'].includes(q.intent)) {
    return { ...q, followUp: true, entities: prev.entities, time: q.time.kind ? q.time : prev.time };
  }
  if (q.metric && !hasEntity && !q.domain && ['kanca', 'rm'].includes(q.groupBy) && !/\bnasional\b/.test(q.norm) && (prev.entities?.ro?.length || prev.entities?.prov?.length)
    && (q.tokens.length <= 4 || followWord)) {
    return { ...q, followUp: true, entities: { ...q.entities, ro: prev.entities.ro || [], prov: prev.entities.prov || [] } };
  }
  if (q.domain === 'sla') {
    if (prev.domain === 'sla' && !hasEntity && followWord) return { ...q, entities: prev.entities, followUp: true };
    return q;
  }
  if (prev.domain === 'sla' && !q.metric && !['coverage', 'plan', 'forecast', 'anomaly'].includes(q.intent)) {
    const stages = [...new Set(q.hits.flatMap((h) => h.entries.filter((e) => e.type === 'stage').map((e) => e.value)))];
    if (hasEntity || q.time.kind || q.order || q.groupBy || stages.length || (followWord && !q.unknown.length)) {
      const out = { ...q, followUp: true, domain: 'sla', sla: { ...prev.sla, stages: stages.length ? stages : prev.sla.stages } };
      if (q.threshold) out.intent = 'filter';
      else if (q.order) out.intent = 'rank';
      else if (q.groupBy) out.intent = 'rank';
      else out.intent = ['rank', 'filter'].includes(prev.intent) && !hasEntity ? prev.intent : prev.intent === 'compare' ? 'value' : prev.intent;
      if (out.intent === 'rank') { out.groupBy = q.groupBy || prev.groupBy || 'kanca'; out.order = q.order || prev.order || 'desc'; out.speed = q.speed || prev.speed; }
      if (out.intent === 'filter' && !q.threshold) out.threshold = prev.threshold;
      if (!q.time.kind) out.time = prev.time;
      if (!hasEntity && (!q.groupBy || q.groupBy !== 'ro')) out.entities = { ...prev.entities, kanca: q.groupBy === 'kanca' ? [] : prev.entities.kanca };
      return out;
    }
  }
  const explicitSummary = q.hits.some((h) => h.entries.some((e) => e.type === 'intent' && e.value === 'summary'));
  if (q.metric || explicitSummary || ['help', 'define', 'coverage', 'plan', 'why', 'forecast', 'anomaly', 'zero'].includes(q.intent)) return q;
  if (!(hasEntity || q.time.kind || q.order || q.groupBy)) {
    if (!followWord || q.unknown.length) return q;
  }
  if (q.unknown.length >= 2 && !hasEntity) return q;
  const out = { ...q, followUp: true, metric: prev.metric, nominal: q.nominal || prev.nominal, target: q.target || prev.target, ratio: q.ratio || prev.ratio };
  if (q.threshold) out.intent = 'filter';
  else if (q.order) out.intent = 'rank';
  else if (q.intent === 'compare') out.intent = 'compare';
  else if (q.groupBy) out.intent = prev.intent === 'rank' ? 'rank' : 'share';
  else out.intent = prev.intent === 'summary' && prev.metric ? 'value' : prev.intent;
  if (out.intent === 'rank') {
    out.groupBy = q.groupBy || prev.groupBy || 'ro';
    out.order = q.order || prev.order || 'desc';
    out.byChange = q.byChange || (prev.byChange && !q.order);
  }
  if (out.intent === 'share' && !out.groupBy) out.groupBy = prev.groupBy;
  if (!q.time.kind) out.time = prev.time;
  if (out.intent === 'compare' && !q.manyOf && q.time.kind && prev.time?.kind && !q.time2) { out.time = prev.time; out.time2 = q.time; }
  if (out.intent === 'compare' && q.manyOf) {
    out.entities = q.entities;
  } else if (out.intent === 'compare') {
    const kind = ['ro', 'kanca', 'rm', 'tipe', 'node', 'prov'].find((k) => (q.entities[k] || []).length);
    const merged = { ro: [], kanca: [], rm: [], tipe: [], node: [], prov: [], fiList: [], fi: null };
    if (kind) merged[kind] = [...new Set([...(prev.entities[kind] || []), ...q.entities[kind]])];
    out.entities = kind ? merged : prev.entities;
    out.manyOf = kind && merged[kind].length >= 2 ? kind : null;
  } else if (!hasEntity && !q.groupBy) {
    out.entities = prev.entities;
  } else if (!hasEntity && q.groupBy && q.groupBy !== 'ro') {
    out.entities = { ...prev.entities, kanca: q.groupBy === 'kanca' ? [] : prev.entities.kanca, rm: [] };
  }
  return out;
}

export function suggestFromVocab(text, vocab, limit = 6) {
  const t = normalizeText(text);
  const last = t.split(' ').at(-1) || '';
  if (last.length < 2) return [];
  const out = [];
  const seen = new Set();
  for (const list of vocab.phrases.values()) {
    for (const p of list) {
      if (!['ro', 'kanca', 'metric', 'tipe'].includes(p.type)) continue;
      if (!p.text.startsWith(last) || seen.has(p.text)) continue;
      if (p.type === 'kanca' && !/^(kc|kanca)\b/.test(p.text) && p.priority < 2) continue;
      seen.add(p.text);
      const display = p.type === 'ro' ? (p.value.length > 1 ? 'Jakarta (semua)' : String(p.value[0]).replace(/^.*\/\s*/, '')) : p.type === 'kanca' ? p.value : p.type === 'tipe' ? p.value : p.text.toUpperCase() === p.text ? p.text : p.text;
      if (seen.has(`d:${display}`)) continue;
      seen.add(`d:${display}`);
      out.push({ text: display, type: p.type, value: p.value });
    }
  }
  out.sort((a, b) => a.text.length - b.text.length);
  return out.slice(0, limit);
}
