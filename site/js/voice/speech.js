import { planSpeech } from './mouth.js';
import { openMic, releaseMic, micTrack, micReady, micLevel, micSupport } from './mic.js';

const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

export const voiceSupport = {
  listen: !!Recognition,
  speak: 'speechSynthesis' in globalThis && 'SpeechSynthesisUtterance' in globalThis,
  level: !!globalThis.navigator?.mediaDevices?.getUserMedia && !!(globalThis.AudioContext || globalThis.webkitAudioContext),
};

const deskMic = () => micSupport && globalThis.matchMedia?.('(pointer: fine)').matches;

export function createRecognizer({ lang = 'id-ID', onResult, onEnd, onError, onStart }) {
  let rec = null;
  let gen = 0;
  let feed = null;

  function unfeed() {
    feed?.stop();
    feed = null;
  }

  function launch(r, mine) {
    if (mine !== gen) return false;
    unfeed();
    const track = micTrack()?.clone() || null;
    try {
      if (track) { feed = track; r.start(track); } else r.start();
      return true;
    } catch {
      unfeed();
      if (track) { try { r.start(); return true; } catch {} }
      if (rec === r) rec = null;
      return false;
    }
  }

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
      unfeed();
      releaseMic('listen');
      onEnd?.();
    };
    rec = r;
    if (deskMic()) {
      const ready = micReady();
      const opening = openMic('listen');
      if (!ready) {
        opening.then(() => { if (!launch(r, mine) && mine === gen) onError?.('start'); });
        return true;
      }
    }
    if (launch(r, mine)) return true;
    onError?.('start');
    return false;
  }

  function abort() {
    gen += 1;
    const r = rec;
    rec = null;
    if (r) { try { r.abort(); } catch {} }
    unfeed();
    releaseMic('listen');
  }

  return { start, abort, get active() { return !!rec; }, get cleaned() { return !!feed; } };
}

const MALE = /andika|ardi|\bmale\b|pria|laki/i;
const NATURAL = /natural|online|neural|enhanced|premium|siri/i;
let browserVoices = [];
let choice = '';
const listVoices = () => {
  const list = globalThis.speechSynthesis?.getVoices() || [];
  const id = list.filter((v) => /^id([-_]|$)/i.test(v.lang) || /indonesia/i.test(v.name));
  const rank = (v) => (MALE.test(v.name) ? 10 : 0) + (/gadis/i.test(v.name) && NATURAL.test(v.name) ? 0 : NATURAL.test(v.name) ? 1 : /gadis/i.test(v.name) ? 2 : /google/i.test(v.name) ? 3 : /damayanti/i.test(v.name) ? 4 : 5);
  return [...id].sort((a, b) => rank(a) - rank(b));
};
const labelOf = (v) => (/google/i.test(v.name) ? 'Google' : v.name.replace(/^Microsoft\s+/i, '').replace(/\s*-\s*Indonesian.*$/i, '').replace(/\s*Online\s*\(Natural\)/i, ' Natural').replace(/\s*\([^)]*\)/g, '').trim() || v.name);
const browserVoice = () => {
  if (choice.startsWith('web:')) {
    const v = browserVoices.find((x) => x.name === choice.slice(4));
    if (v) return v;
  }
  return browserVoices[0] || null;
};
const tempoOf = (v) => {
  if (!v) return { rate: 1.02, pitch: 1.08 };
  if (/microsoft/i.test(v.name) && NATURAL.test(v.name)) return { rate: 1, pitch: 1.04 };
  if (/google/i.test(v.name)) return { rate: 1.08, pitch: 1.14 };
  if (/damayanti/i.test(v.name)) return { rate: 1, pitch: 1.06 };
  return { rate: 1.02, pitch: 1.08 };
};
if (voiceSupport.speak) {
  browserVoices = listVoices();
  speechSynthesis.addEventListener?.('voiceschanged', () => { browserVoices = listVoices(); });
}

export const CLOUD_VOICES = [
  ['id-ID-Chirp3-HD-Vindemiatrix', 'Vindemiatrix'], ['id-ID-Chirp3-HD-Achernar', 'Achernar'], ['id-ID-Chirp3-HD-Sulafat', 'Sulafat'],
  ['id-ID-Chirp3-HD-Despina', 'Despina'], ['id-ID-Chirp3-HD-Callirrhoe', 'Callirrhoe'], ['id-ID-Chirp3-HD-Aoede', 'Aoede'],
];
const CLOUD_RATE = 1;
const CLOUD_WAIT_MS = 7000;
let cloud = null;
let cloudOff = false;
let cloudOk = false;
let rateMul = 1;
let pitchMul = 1;
let volume = 1;
const audioCache = new Map();

export function setCloudSpeaker(fn) { cloud = typeof fn === 'function' ? fn : null; }
export function setVoice(id) { choice = typeof id === 'string' ? id : ''; }
export function setRate(mul) { rateMul = Math.min(1.35, Math.max(0.8, Number(mul) || 1)); }
export function setPitch(mul) { pitchMul = Math.min(1.3, Math.max(0.8, Number(mul) || 1)); }
export function setVolume(v) { volume = Math.min(1, Math.max(0.3, Number(v) || 1)); }
const cloudReady = () => !!cloud && !cloudOff;
export const usingCloud = () => cloudReady() && !choice.startsWith('web:');
const cloudVoiceId = () => (choice.startsWith('cloud:') && CLOUD_VOICES.some(([id]) => id === choice.slice(6)) ? choice.slice(6) : CLOUD_VOICES[0][0]);

export function voiceList() {
  if (voiceSupport.speak && !browserVoices.length) browserVoices = listVoices();
  const current = usingCloud() ? `cloud:${cloudVoiceId()}` : browserVoice() ? `web:${browserVoice().name}` : '';
  const cloudList = cloudReady() ? CLOUD_VOICES.map(([id, name]) => ({ id: `cloud:${id}`, name, kind: 'cloud' })) : [];
  const webList = browserVoices.map((v) => ({ id: `web:${v.name}`, name: labelOf(v), kind: 'web', male: MALE.test(v.name), natural: NATURAL.test(v.name) }));
  return { current, cloud: cloudList, cloudOn: cloudOk, web: webList, natural: cloudOk || webList.some((v) => v.natural && !v.male) };
}

export function findVoice(name) {
  const q = String(name || '').toLowerCase().trim();
  if (!q) return null;
  const { cloud: c, web } = voiceList();
  const all = [...c, ...web];
  if (/^(cowok|pria|laki( laki)?)$/.test(q)) return web.find((v) => v.male) || null;
  if (/^(cewek|wanita|perempuan)$/.test(q)) return c[0] || web.find((v) => !v.male) || null;
  if (q === 'google') return c[0] || web.find((v) => v.name === 'Google') || null;
  return all.find((v) => v.name.toLowerCase() === q) || all.find((v) => v.name.toLowerCase().includes(q) || q.includes(v.name.toLowerCase().split(' ')[0])) || null;
}

export function nextVoice() {
  const { current, cloud: c, web } = voiceList();
  const all = [...c, ...web.filter((v) => !v.male)];
  if (!all.length) return { id: '', name: 'bawaan' };
  const next = all[(all.findIndex((v) => v.id === current) + 1) % all.length];
  choice = next.id;
  return next;
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

function cloudAudio(text, voice) {
  const voiceId = voice || cloudVoiceId();
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
    cloudOk = true;
    const bin = atob(res.audio);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return ac.decodeAudioData(bytes.buffer);
  }).catch(() => { cloudOff = true; return null; });
  audioCache.set(key, job);
  job.then((buf) => { if (!buf) audioCache.delete(key); });
  if (audioCache.size > 40) audioCache.delete(audioCache.keys().next().value);
  return job;
}

let speakGen = 0;
let playing = null;
let meter = null;
let meterData = null;
let cue = null;
let saidBefore = '';
const MS_PER_UNIT = 100;

function makeCue(text, { dur = 0, rate = 1 } = {}) {
  const plan = planSpeech(text);
  return { text: String(text), plan, cum: plan.cum, total: plan.total, t0: performance.now(), dur, unit: MS_PER_UNIT / Math.max(0.5, rate), anchor: null };
}

function beginCue(text, opts) {
  if (cue) saidBefore = `${saidBefore} ${cue.text}`.slice(-400);
  cue = makeCue(text, opts);
}

export function voiceCue() {
  if (!cue) return null;
  const now = performance.now();
  let units;
  if (cue.anchor) units = (cue.cum[cue.anchor.i - 1] || 0) + (now - cue.anchor.at) / cue.unit;
  else if (cue.dur) units = ((now - cue.t0) / cue.dur) * cue.total;
  else units = (now - cue.t0) / cue.unit;
  if (units >= cue.total) return { text: cue.text, index: cue.text.length, before: saidBefore, units: cue.total, plan: cue.plan };
  let lo = 0;
  let hi = cue.cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cue.cum[mid] < units) lo = mid + 1; else hi = mid; }
  return { text: cue.text, index: lo, before: saidBefore, units, plan: cue.plan };
}

export function voiceLevel() {
  if (!playing || !meter) return -1;
  meterData ||= new Uint8Array(meter.fftSize);
  meter.getByteTimeDomainData(meterData);
  let sum = 0;
  for (let i = 0; i < meterData.length; i += 1) { const x = (meterData[i] - 128) / 128; sum += x * x; }
  return Math.sqrt(sum / meterData.length) / Math.max(0.3, volume);
}

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
    u.pitch = Math.min(2, pitch * pitchMul);
    u.volume = volume;
    const said = parts[i - 1];
    u.onstart = () => { beginCue(said, { rate: u.rate }); onStart(); };
    u.onboundary = (e) => { if (cue && cue.text === said && Number.isFinite(e.charIndex)) cue.anchor = { i: e.charIndex, at: performance.now() }; };
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
    const gain = ac.createGain();
    gain.gain.value = volume;
    meter ||= Object.assign(ac.createAnalyser(), { fftSize: 512 });
    src.connect(gain).connect(meter);
    meter.connect(ac.destination);
    playing = src;
    hooks.onStart();
    beginCue(groups[i], { dur: buf.duration * 1000 });
    await new Promise((resolve) => { src.onended = resolve; src.start(); });
    if (playing === src) { playing = null; cue = null; }
  }
  hooks.finish();
}

export function speak(text, { onStart, onEnd } = {}) {
  const mine = ++speakGen;
  cue = null;
  saidBefore = '';
  if (!text || (!voiceSupport.speak && !usingCloud())) { onEnd?.(); return; }
  const parts = sentences(text);
  let started = false;
  let done = false;
  const guard = setTimeout(() => finish(), Math.max(9000, String(text).length * 110 + CLOUD_WAIT_MS));
  function finish() {
    if (done) return;
    done = true;
    clearTimeout(guard);
    if (mine === speakGen) cue = null;
    if (mine === speakGen) onEnd?.();
  }
  const hooks = { onStart: () => { if (!started) { started = true; onStart?.(); } }, finish };
  if (usingCloud()) speakCloud(parts, mine, hooks);
  else speakBrowser(parts, mine, hooks);
}

export function hush() {
  speakGen += 1;
  cue = null;
  saidBefore = '';
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
  let raf = 0;
  let wanted = false;
  let frame = 0;

  const loop = () => {
    raf = requestAnimationFrame(loop);
    frame += 1;
    if (frame % 2) return;
    onLevel(micLevel());
  };

  async function start() {
    if (wanted) return micReady();
    wanted = true;
    if (!voiceSupport.level) return false;
    const okay = await openMic('meter');
    if (!wanted || !okay) return false;
    cancelAnimationFrame(raf);
    loop();
    return true;
  }

  function stop() {
    wanted = false;
    cancelAnimationFrame(raf);
    raf = 0;
    releaseMic('meter');
    onLevel(0);
  }

  return { start, stop };
}
