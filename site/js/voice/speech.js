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

let voice = null;
const pickVoice = () => {
  const list = globalThis.speechSynthesis?.getVoices() || [];
  const id = list.filter((v) => /^id([-_]|$)/i.test(v.lang));
  return id.find((v) => /google/i.test(v.name)) || id.find((v) => /natural|online/i.test(v.name)) || id[0] || null;
};
if (voiceSupport.speak) {
  voice = pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', () => { voice = pickVoice(); });
}

export function speak(text, { onStart, onEnd } = {}) {
  if (!voiceSupport.speak || !text) { onEnd?.(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'id-ID';
  if (voice) u.voice = voice;
  u.rate = 1.04;
  u.pitch = 1;
  let done = false;
  const finish = () => { if (!done) { done = true; onEnd?.(); } };
  u.onstart = () => onStart?.();
  u.onend = finish;
  u.onerror = finish;
  speechSynthesis.speak(u);
  setTimeout(() => { if (!speechSynthesis.speaking && !speechSynthesis.pending) finish(); }, Math.max(4000, text.length * 120));
}

export const hush = () => { if (voiceSupport.speak) speechSynthesis.cancel(); };

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
