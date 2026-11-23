export const REST = [0, 1, 0, 0];
export const SILENT = [0, 0, 0, 0, 0];
const QUIET = [...REST, ...SILENT];

const VOWEL = {
  a: [0.92, 1, 0, 0, 1, 0, 0, 0, 0],
  i: [0.34, 1.1, 0, 0, 0, 1, 0, 0, 0],
  e: [0.52, 1.06, 0, 0, 0, 0, 0, 1, 0],
  E: [0.62, 1.04, 0, 0, 0.3, 0, 0, 0.8, 0],
  '@': [0.44, 0.95, 0, 0, 0.25, 0.1, 0, 0.45, 0],
  o: [0.76, 0.66, 0, 1, 0, 0, 0, 0, 1],
  u: [0.46, 0.5, 0, 1, 0, 0, 1, 0, 0],
};
const GLIDE_Y = [0.24, 1.04, 0, 0, 0, 0.5, 0, 0.1, 0];
const GLIDE_W = [0.3, 0.52, 0, 1, 0, 0, 0.7, 0, 0];

const CONSONANT = [
  [/^[mbp]$/, [0, 0.92, 1, 0, 0, 0, 0, 0, 0], 0, 0.5],
  [/^[fv]$/, [0.14, 0.98, 0, 0, 0, 0.2, 0, 0.1, 0], 0.2, 0.45],
  [/^w$/, [0.3, 0.5, 0, 1, 0, 0, 0.85, 0, 0], 0.2, 0.4],
  [/^(c|j|sy)$/, [0.22, 0.94, 0, 0.3, 0, 0.2, 0.25, 0.1, 0], 0.3, 0.46],
  [/^(s|z|y|ny)$/, [0.22, 1.03, 0, 0, 0, 0.35, 0, 0.15, 0], 0.35, 0.44],
  [/^[tdnlr]$/, [0.3, 1, 0, 0, 0.15, 0.1, 0, 0.2, 0], 0.55, 0.4],
  [/^(k|g|ng|kh|h)$/, [0.4, 1, 0, 0, 0.2, 0, 0, 0.1, 0], 0.85, 0.42],
];

const DIGRAPH = new Set(['kh', 'ng', 'ny', 'sy']);
const DIPHTHONG = new Set(['ai', 'au', 'oi', 'ei']);
const SPELLED_E = /^(be|ce|de|ge|je|pe|te|ve|we|ye)$/;
const SPELLED_EH = /^(e[lmnfsr]|eks)$/;
const PAUSE = { ',': 1.6, ';': 1.6, ':': 1.6, '.': 2.4, '!': 2.4, '?': 2.4, '\n': 2.4 };
const GAP = 0.12;
const GLIDE = 0.22;
const LEAD = 0.4;

const ONES = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
const SCALE = [[1e12, 'triliun'], [1e9, 'miliar'], [1e6, 'juta'], [1e3, 'ribu']];

function hundreds(n) {
  const out = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) out.push(h === 1 ? 'seratus' : `${ONES[h]} ratus`);
  if (r === 10) out.push('sepuluh');
  else if (r === 11) out.push('sebelas');
  else if (r > 11 && r < 20) out.push(`${ONES[r - 10]} belas`);
  else if (r >= 20) out.push(`${ONES[Math.floor(r / 10)]} puluh${r % 10 ? ` ${ONES[r % 10]}` : ''}`);
  else if (r) out.push(ONES[r]);
  return out.join(' ');
}

export function numberWords(digits) {
  const s = String(digits);
  if (s.length > 15 || (s.length > 1 && s[0] === '0')) return s.split('').map((d) => ONES[d]).join(' ');
  let n = Number(s);
  if (!n) return 'nol';
  const out = [];
  for (const [size, name] of SCALE) {
    const q = Math.floor(n / size);
    if (!q) continue;
    out.push(size === 1e3 && q === 1 ? 'seribu' : `${hundreds(q)} ${name}`);
    n %= size;
  }
  if (n) out.push(hundreds(n));
  return out.join(' ');
}

const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const isVowel = (u) => u in VOWEL || u === 'é' || u === 'è' || u === 'ê';

function segments(word) {
  const out = [];
  for (let i = 0; i < word.length;) {
    const two = word.slice(i, i + 2);
    if (DIGRAPH.has(two)) { out.push({ ch: two, at: i }); i += 2; } else { out.push({ ch: word[i], at: i }); i += 1; }
  }
  return out.map((x, i) => (x.ch === 'x' ? { ...x, ch: i === 0 ? 's' : 'ks' } : x.ch === 'q' ? { ...x, ch: 'k' } : x));
}

function vowelOf(ch, k, segs, word) {
  if (ch === 'é') return 'e';
  if (ch === 'è') return 'E';
  if (ch === 'ê') return '@';
  if (ch !== 'e') return ch;
  if (SPELLED_E.test(word)) return 'e';
  if (SPELLED_EH.test(word)) return 'E';
  const vowels = segs.filter((s) => isVowel(s.ch));
  const last = vowels.at(-1) === segs[k];
  if (!last || vowels.length < 2) return '@';
  const tail = segs.slice(k + 1).map((s) => s.ch).join('');
  return tail === 'r' ? '@' : 'e';
}

function wordPhones(word) {
  const segs = segments(word);
  const phones = [];
  for (let k = 0; k < segs.length; k += 1) {
    const { ch, at } = segs[k];
    if (isVowel(ch)) {
      const v = vowelOf(ch, k, segs, word);
      const next = segs[k + 1];
      const pair = next && `${v === '@' ? 'e' : v}${next.ch}`;
      const after = segs[k + 2];
      if (next && DIPHTHONG.has(pair) && (!after || !isVowel(after.ch))) {
        phones.push({ at, n: next.at + next.ch.length - at, d: 1.35, from: VOWEL[v], shape: VOWEL[next.ch] });
        k += 1;
        continue;
      }
      phones.push({ at, n: ch.length, d: 1, shape: VOWEL[v], vowel: true });
      if (next && isVowel(next.ch)) phones.push({ at: next.at, n: 0, d: GLIDE, shape: 'iEe@'.includes(v) ? GLIDE_Y : GLIDE_W });
      continue;
    }
    for (const part of ch === 'ks' ? ['k', 's'] : [ch]) {
      const rule = CONSONANT.find(([re]) => re.test(part));
      if (rule) phones.push({ at, n: ch === 'ks' ? 0.5 : ch.length, d: rule[3], own: rule[1], coart: rule[2] });
    }
  }
  const vowelIdx = phones.map((p, i) => (p.vowel || p.from ? i : -1)).filter((i) => i >= 0);
  for (let i = 0; i < phones.length; i += 1) {
    const p = phones[i];
    if (!p.own) continue;
    const nextV = vowelIdx.find((j) => j > i);
    const prevV = [...vowelIdx].reverse().find((j) => j < i);
    const onset = nextV !== undefined && phones.slice(i + 1, nextV).every((q) => q.own);
    const ref = onset ? phones[nextV] : prevV !== undefined ? phones[prevV] : null;
    const target = ref ? (onset && ref.from ? ref.from : ref.shape) : VOWEL['@'];
    p.shape = mix(p.own, target, p.coart);
    if (p.own[2] === 1) p.shape = [0, p.shape[1], 1, target[3] * 0.5, 0, 0, 0, 0, 0];
  }
  return phones;
}

export function planSpeech(text) {
  const src = String(text || '');
  const lower = src.toLowerCase();
  const cum = new Float32Array(src.length);
  const phones = [];
  let t = 0;
  const re = /\d+|[a-zà-ÿ]+|[^\da-zà-ÿ]/g;
  let m;
  while ((m = re.exec(lower))) {
    const tok = m[0];
    const start = m.index;
    if (/^\d/.test(tok)) {
      const t0 = t;
      numberWords(tok).split(' ').forEach((w, i) => {
        if (i) t += GAP;
        for (const p of wordPhones(w)) { phones.push({ s: t, d: p.d, shape: p.shape, from: p.from }); t += p.d; }
      });
      for (let i = 0; i < tok.length; i += 1) cum[start + i] = t0 + ((t - t0) * (i + 1)) / tok.length;
      continue;
    }
    if (/^[a-zà-ÿ]/.test(tok)) {
      const list = wordPhones(tok);
      const ends = new Float32Array(tok.length);
      for (const p of list) {
        phones.push({ s: t, d: p.d, shape: p.shape, from: p.from });
        t += p.d;
        const last = Math.min(tok.length - 1, Math.max(p.at, Math.ceil(p.at + p.n) - 1));
        for (let i = p.at; i <= last; i += 1) ends[i] = t;
      }
      let run = cum[start - 1] || 0;
      for (let i = 0; i < tok.length; i += 1) { run = Math.max(run, ends[i]); cum[start + i] = run; }
      continue;
    }
    const pause = PAUSE[tok];
    if (pause) { phones.push({ s: t, d: pause, shape: QUIET }); t += pause; } else t += tok === ' ' ? GAP : 0.3;
    cum[start] = t;
  }
  return { cum, total: t, phones };
}

const ease = (x) => x * x * (3 - 2 * x);

function lookAt(plan, units) {
  const list = plan?.phones;
  if (!list?.length) return QUIET;
  const u = units + LEAD;
  if (u >= plan.total) return QUIET;
  let lo = 0;
  let hi = list.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (list[mid].s <= u) lo = mid; else hi = mid - 1; }
  const p = list[lo];
  if (u < p.s) return QUIET;
  const local = (u - p.s) / p.d;
  if (local >= 1) {
    const next = list[lo + 1];
    if (!next) return QUIET;
    const gap = Math.max(1e-3, next.s - (p.s + p.d));
    return mix(p.shape, next.from || next.shape, ease(Math.min(1, (u - p.s - p.d) / gap)));
  }
  if (p.from) return mix(p.from, p.shape, ease(Math.min(1, Math.max(0, (local - 0.25) / 0.75))));
  return p.shape;
}

export const mouthAt = (plan, units) => lookAt(plan, units).slice(0, 4);
export const visemeAt = (plan, units) => lookAt(plan, units).slice(4);
