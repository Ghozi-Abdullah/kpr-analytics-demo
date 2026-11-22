const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

export const voiceSupport = {
  listen: !!Recognition,
  speak: 'speechSynthesis' in globalThis && 'SpeechSynthesisUtterance' in globalThis,
  level: !!globalThis.navigator?.mediaDevices?.getUserMedia && !!(globalThis.AudioContext || globalThis.webkitAudioContext),
};

export function createRecognizer({ lang = 'id-ID', onResult, onEnd, onError, onStart }) {
  let rec = null;
  let gen = 0;

  function start({ continuous = false } = {}) {
    if (!Recognition) { onError?.('unsupported'); return false; }
    abort();
    const mine = ++gen;
    const r = new Recognition();
    r.lang = lang;
    r.continuous = continuous;
    r.interimResults = true;
    r.maxAlternatives = 3;
    r.onstart = () => { if (mine === gen) onStart?.(); };
    r.onresult = (e) => {
      if (mine !== gen) return;
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const res = e.results[i];
        onResult?.({ text: res[0].transcript.trim(), alts: Array.from(res, (a) => a.transcript.trim()), final: res.isFinal, index: i });
      }
    };
    r.onerror = (e) => { if (mine === gen) onError?.(e.error || 'unknown'); };
    r.onend = () => {
      if (mine !== gen) return;
      rec = null;
      onEnd?.();
    };
    rec = r;
    try {
      r.start();
    } catch (err) {
      rec = null;
      onError?.('start');
      return false;
    }
    return true;
  }

  function abort() {
    gen += 1;
    const r = rec;
    rec = null;
    if (r) { try { r.abort(); } catch {} }
  }

  return { start, abort, get active() { return !!rec; } };
}

const MALE = /andika|ardi|\bmale\b|pria|laki/i;
let browserVoices = [];
let browserPick = 0;
const listVoices = () => {
  const list = globalThis.speechSynthesis?.getVoices() || [];
  const id = list.filter((v) => /^id([-_]|$)/i.test(v.lang) || /indonesia/i.test(v.name));
  const female = id.filter((v) => !MALE.test(v.name));
  const rank = (v) => (/gadis/i.test(v.name) && /natural|online/i.test(v.name) ? 0 : /gadis/i.test(v.name) ? 1 : /google/i.test(v.name) ? 2 : /damayanti/i.test(v.name) ? 3 : 4);
  return [...female].sort((a, b) => rank(a) - rank(b)).concat(female.length ? [] : id);
};
const browserVoice = () => browserVoices[browserPick % Math.max(1, browserVoices.length)] || null;
const tempoOf = (v) => {
  if (!v) return { rate: 1.1, pitch: 1.04 };
  if (/microsoft/i.test(v.name) && /natural|online/i.test(v.name)) return { rate: 1.08, pitch: 1 };
  if (/google/i.test(v.name)) return { rate: 1.16, pitch: 1.05 };
  return { rate: 1.07, pitch: 1.02 };
};
if (voiceSupport.speak) {
  browserVoices = listVoices();
  speechSynthesis.addEventListener?.('voiceschanged', () => { browserVoices = listVoices(); });
}

export const CLOUD_VOICES = [
  ['id-ID-Chirp3-HD-Despina', 'Despina'], ['id-ID-Chirp3-HD-Sulafat', 'Sulafat'], ['id-ID-Chirp3-HD-Aoede', 'Aoede'],
  ['id-ID-Chirp3-HD-Leda', 'Leda'], ['id-ID-Chirp3-HD-Erinome', 'Erinome'], ['id-ID-Chirp3-HD-Kore', 'Kore'],
];
const CLOUD_RATE = 1.06;
const CLOUD_WAIT_MS = 7000;
let cloud = null;
let cloudOff = false;
let cloudPick = 0;
let rateMul = 1;
const audioCache = new Map();

export function setCloudSpeaker(fn) { cloud = typeof fn === 'function' ? fn : null; }
export function setVoiceChoice(i) { cloudPick = Math.max(0, Number(i) || 0) % CLOUD_VOICES.length; browserPick = Math.max(0, Number(i) || 0); }
export function setRate(mul) { rateMul = Math.min(1.35, Math.max(0.8, Number(mul) || 1)); }
export const usingCloud = () => !!cloud && !cloudOff;
export function nextVoice() {
  if (usingCloud()) { cloudPick = (cloudPick + 1) % CLOUD_VOICES.length; return { index: cloudPick, name: CLOUD_VOICES[cloudPick][1] }; }
  browserPick = (browserPick + 1) % Math.max(1, browserVoices.length);
  return { index: browserPick, name: (browserVoice()?.name || 'bawaan').replace(/^(Microsoft|Google)\s*/i, '').replace(/\s*-.*$/, '') };
}

function sentences(text) {
  const out = [];
  for (const part of String(text).split(/(?<=[.!?])\s+/)) {
    let rest = part.trim();
    while (rest.length > 180) {
      const cut = Math.max(rest.lastIndexOf(', ', 180), rest.lastIndexOf(' ', 180));
      out.push(rest.slice(0, cut > 40 ? cut : 180));
      rest = rest.slice(cut > 40 ? cut + 1 : 180).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

let audioCtx = null;
function ctx() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  audioCtx ||= new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => null);
  return audioCtx;
}

function cloudAudio(text) {
  const voiceId = CLOUD_VOICES[cloudPick][0];
  const rate = Math.round(CLOUD_RATE * rateMul * 100) / 100;
  const key = `${voiceId}|${rate}|${text}`;
  if (audioCache.has(key)) return audioCache.get(key);
  const job = Promise.race([
    cloud(text, voiceId, rate),
    new Promise((resolve) => { setTimeout(() => resolve({ slow: true }), CLOUD_WAIT_MS); }),
  ]).then(async (res) => {
    if (!res || res.slow) return null;
    if (res.off) { cloudOff = true; return null; }
    const ac = ctx();
    if (!ac || !res.audio) return null;
    const bin = atob(res.audio);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return ac.decodeAudioData(bytes.buffer);
  }).catch(() => null);
  audioCache.set(key, job);
  job.then((buf) => { if (!buf) audioCache.delete(key); });
  if (audioCache.size > 40) audioCache.delete(audioCache.keys().next().value);
  return job;
}

let speakGen = 0;
let playing = null;

function speakBrowser(parts, mine, { onStart, finish }) {
  if (!voiceSupport.speak) { finish(); return; }
  speechSynthesis.cancel();
  const v = browserVoice();
  const { rate, pitch } = tempoOf(v);
  let i = 0;
  const next = () => {
    if (mine !== speakGen || i >= parts.length) { finish(); return; }
    const u = new SpeechSynthesisUtterance(parts[i]);
    i += 1;
    u.lang = 'id-ID';
    if (v) u.voice = v;
    u.rate = Math.min(1.6, rate * rateMul);
    u.pitch = pitch;
    u.onstart = onStart;
    u.onend = next;
    u.onerror = (e) => { if (e.error === 'interrupted' || e.error === 'canceled') finish(); else next(); };
    speechSynthesis.speak(u);
  };
  next();
}

async function speakCloud(parts, mine, hooks) {
  const groups = parts.length > 1 ? [parts[0], parts.slice(1).join(' ')] : parts;
  const jobs = groups.map((g) => cloudAudio(g));
  for (let i = 0; i < groups.length; i += 1) {
    const buf = await jobs[i];
    if (mine !== speakGen) { hooks.finish(); return; }
    if (!buf) { speakBrowser(sentences(groups.slice(i).join(' ')), mine, hooks); return; }
    const ac = ctx();
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    playing = src;
    hooks.onStart();
    await new Promise((resolve) => { src.onended = resolve; src.start(); });
    if (playing === src) playing = null;
  }
  hooks.finish();
}

export function speak(text, { onStart, onEnd } = {}) {
  const mine = ++speakGen;
  if (!text || (!voiceSupport.speak && !usingCloud())) { onEnd?.(); return; }
  const parts = sentences(text);
  let started = false;
  let done = false;
  const guard = setTimeout(() => finish(), Math.max(9000, String(text).length * 110 + CLOUD_WAIT_MS));
  function finish() {
    if (done) return;
    done = true;
    clearTimeout(guard);
    if (mine === speakGen) onEnd?.();
  }
  const hooks = { onStart: () => { if (!started) { started = true; onStart?.(); } }, finish };
  if (usingCloud()) speakCloud(parts, mine, hooks);
  else speakBrowser(parts, mine, hooks);
}

export function hush() {
  speakGen += 1;
  if (voiceSupport.speak) speechSynthesis.cancel();
  if (playing) { try { playing.stop(); } catch {} playing = null; }
}

export function chime(kind = 'on') {
  try {
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime + 0.01;
    const notes = {
      on: [[784, 0], [1175, 0.085]], off: [[988, 0], [659, 0.08]], done: [[1047, 0], [1319, 0.07], [1568, 0.14]],
      love: [[1319, 0], [1568, 0.08], [2093, 0.16]], oops: [[523, 0], [494, 0.1]],
    }[kind] || [[880, 0]];
    for (const [f, dt] of notes) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(0.07, t + dt + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.16);
      o.connect(g).connect(ac.destination);
      o.start(t + dt);
      o.stop(t + dt + 0.18);
    }
  } catch {}
}

export function createLevel(onLevel) {
  let stream = null;
  let ctx = null;
  let raf = 0;
  let level = 0;
  let wanted = false;

  async function start() {
    wanted = true;
    if (stream || !voiceSupport.level) return !!stream;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!wanted) { s.getTracks().forEach((t) => t.stop()); return false; }
      stream = s;
    } catch {
      return false;
    }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    ctx = new AC();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let frame = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      frame += 1;
      if (frame % 2) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) { const x = (data[i] - 128) / 128; sum += x * x; }
      const now = Math.min(1, Math.sqrt(sum / data.length) * 5);
      level = now > level ? level * 0.45 + now * 0.55 : level * 0.82 + now * 0.18;
      onLevel(level);
    };
    loop();
    return true;
  }

  function stop() {
    wanted = false;
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    ctx?.close().catch(() => null);
    stream = null;
    ctx = null;
    level = 0;
    onLevel(0);
  }

  return { start, stop };
}
