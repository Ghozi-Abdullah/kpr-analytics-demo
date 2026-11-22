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
let voice = null;
const pickVoice = () => {
  const list = globalThis.speechSynthesis?.getVoices() || [];
  const id = list.filter((v) => /^id([-_]|$)/i.test(v.lang) || /indonesia/i.test(v.name));
  const female = id.filter((v) => !MALE.test(v.name));
  return female.find((v) => /gadis/i.test(v.name) && /natural|online/i.test(v.name))
    || female.find((v) => /gadis/i.test(v.name))
    || female.find((v) => /google/i.test(v.name))
    || female.find((v) => /damayanti/i.test(v.name))
    || female[0] || id[0] || null;
};
const tempoOf = (v) => {
  if (!v) return { rate: 1.1, pitch: 1.04 };
  if (/microsoft/i.test(v.name) && /natural|online/i.test(v.name)) return { rate: 1.08, pitch: 1 };
  if (/google/i.test(v.name)) return { rate: 1.16, pitch: 1.05 };
  return { rate: 1.07, pitch: 1.02 };
};
if (voiceSupport.speak) {
  voice = pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', () => { voice = pickVoice(); });
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

let speakGen = 0;

export function speak(text, { onStart, onEnd } = {}) {
  const mine = ++speakGen;
  if (!voiceSupport.speak || !text) { onEnd?.(); return; }
  speechSynthesis.cancel();
  const parts = sentences(text);
  const { rate, pitch } = tempoOf(voice);
  let i = 0;
  let started = false;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(guard);
    if (mine === speakGen) onEnd?.();
  };
  const next = () => {
    if (mine !== speakGen) { finish(); return; }
    if (i >= parts.length) { finish(); return; }
    const u = new SpeechSynthesisUtterance(parts[i]);
    i += 1;
    u.lang = 'id-ID';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = pitch;
    u.onstart = () => { if (!started) { started = true; onStart?.(); } };
    u.onend = next;
    u.onerror = (e) => { if (e.error === 'interrupted' || e.error === 'canceled') finish(); else next(); };
    speechSynthesis.speak(u);
  };
  const guard = setTimeout(finish, Math.max(5000, String(text).length * 95));
  next();
}

export const hush = () => { speakGen += 1; if (voiceSupport.speak) speechSynthesis.cancel(); };

let chimeCtx = null;
export function chime(kind = 'on') {
  try {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    chimeCtx ||= new AC();
    if (chimeCtx.state === 'suspended') chimeCtx.resume();
    const t = chimeCtx.currentTime + 0.01;
    const notes = { on: [[784, 0], [1175, 0.085]], off: [[988, 0], [659, 0.08]], done: [[1047, 0], [1319, 0.07], [1568, 0.14]] }[kind] || [[880, 0]];
    for (const [f, dt] of notes) {
      const o = chimeCtx.createOscillator();
      const g = chimeCtx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(0.07, t + dt + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.16);
      o.connect(g).connect(chimeCtx.destination);
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
