const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
const CAPTURE = { echoCancellation: true, noiseSuppression: true, autoGainControl: false, voiceIsolation: true, channelCount: 1 };
const TICK_MS = 25;
const FLOOR_WINDOW = 240;
const FLOOR_RANK = 0.3;
const OPEN_RATIO = 4;
const KEEP_RATIO = 2;
const WARM_MS = 400;
const LOUD_RMS = 0.05;
const MIN_RMS = 0.012;
const MAKEUP_GAIN = 2;
const QUIET_FLOOR = 0.001;
const HOLD_MS = 450;
const LOOKAHEAD_S = 0.06;
const QUIET_GAIN = 0.08;
const IDLE_CLOSE_MS = 1500;
const NEAR_WINDOW_MS = 2500;
const NEAR_NEED_MS = 250;
const ONSET_TICKS = 2;

export const micSupport = !!globalThis.navigator?.mediaDevices?.getUserMedia && !!AC;

const holders = new Set();
let stream = null;
let ctx = null;
let gate = null;
let analyser = null;
let output = null;
let samples = null;
let ticker = 0;
let idleTimer = 0;
let pending = null;
let clean = true;
let rms = 0;
let smooth = 0;
let level = 0;
let gateOpen = false;
let openUntil = 0;
let startedAt = 0;
let onset = 0;
const history = [];
const voiced = [];

function floorNow() {
  if (history.length < 4) return MIN_RMS;
  const sorted = [...history].sort((a, b) => a - b);
  return Math.max(1e-4, sorted[Math.floor(sorted.length * FLOOR_RANK)]);
}

function setGate(next) {
  if (next === gateOpen) return;
  gateOpen = next;
  if (gate && ctx) gate.gain.setTargetAtTime(!clean || next ? 1 : QUIET_GAIN, ctx.currentTime, next ? 0.01 : 0.12);
}

function tick() {
  if (!analyser) return;
  analyser.getFloatTimeDomainData(samples);
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
  rms = Math.sqrt(sum / samples.length);
  smooth = smooth * 0.7 + rms * 0.3;
  const now = performance.now();
  const warm = now - startedAt < WARM_MS;
  history.push(smooth);
  if (history.length > FLOOR_WINDOW) history.shift();
  const floor = floorNow();
  const loud = warm ? rms > LOUD_RMS : rms > Math.max(floor > QUIET_FLOOR ? MIN_RMS : MIN_RMS / 3, floor * OPEN_RATIO);
  const held = gateOpen && rms > Math.max(floor > QUIET_FLOOR ? MIN_RMS * 0.6 : MIN_RMS / 4, floor * KEEP_RATIO);
  onset = loud ? onset + 1 : 0;
  if (onset >= ONSET_TICKS || held) openUntil = now + HOLD_MS;
  setGate(now < openUntil);
  if (gateOpen && (loud || held)) voiced.push(now);
  while (voiced.length && voiced[0] < now - NEAR_WINDOW_MS) voiced.shift();
  const shown = Math.min(1, rms * 5);
  level = shown > level ? level * 0.45 + shown * 0.55 : level * 0.82 + shown * 0.18;
}

function shutdown() {
  clearInterval(ticker);
  ticker = 0;
  stream?.getTracks().forEach((t) => t.stop());
  ctx?.close().catch(() => null);
  stream = null;
  ctx = null;
  gate = null;
  analyser = null;
  output = null;
  history.length = 0;
  voiced.length = 0;
  gateOpen = false;
  level = 0;
}

async function build() {
  const s = await navigator.mediaDevices.getUserMedia({ audio: CAPTURE });
  if (!holders.size) { s.getTracks().forEach((t) => t.stop()); return false; }
  stream = s;
  ctx = new AC();
  const source = ctx.createMediaStreamSource(s);
  const lowCut = ctx.createBiquadFilter();
  lowCut.type = 'highpass';
  lowCut.frequency.value = 110;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  samples = new Float32Array(analyser.fftSize);
  const delay = ctx.createDelay(0.2);
  delay.delayTime.value = LOOKAHEAD_S;
  gate = ctx.createGain();
  gate.gain.value = clean ? QUIET_GAIN : 1;
  const leveler = ctx.createDynamicsCompressor();
  leveler.threshold.value = -32;
  leveler.knee.value = 12;
  leveler.ratio.value = 4;
  leveler.attack.value = 0.005;
  leveler.release.value = 0.2;
  const makeup = ctx.createGain();
  makeup.gain.value = MAKEUP_GAIN;
  output = ctx.createMediaStreamDestination();
  source.connect(lowCut);
  lowCut.connect(analyser);
  lowCut.connect(delay).connect(gate).connect(leveler).connect(makeup).connect(output);
  startedAt = performance.now();
  ticker = setInterval(tick, TICK_MS);
  if (ctx.state !== 'running') await ctx.resume().catch(() => null);
  return true;
}

export function openMic(who) {
  if (!micSupport) return Promise.resolve(false);
  holders.add(who);
  clearTimeout(idleTimer);
  if (stream) {
    if (ctx?.state === 'suspended') ctx.resume().catch(() => null);
    return Promise.resolve(true);
  }
  pending ||= build().catch(() => false).finally(() => { pending = null; });
  return pending;
}

export function releaseMic(who) {
  holders.delete(who);
  if (holders.size) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!holders.size) shutdown(); }, IDLE_CLOSE_MS);
}

export function micTrack() {
  if (!clean || !output || ctx?.state !== 'running') return null;
  const track = output.stream.getAudioTracks()[0];
  return track?.readyState === 'live' ? track : null;
}

export const micReady = () => !!stream;
export const micLevel = () => level;

export function nearSpeech() {
  if (!clean || !analyser || ctx?.state !== 'running') return true;
  return voiced.length * TICK_MS >= NEAR_NEED_MS;
}

export function setMicClean(on) {
  clean = !!on;
  if (gate && ctx) gate.gain.setTargetAtTime(!clean || gateOpen ? 1 : QUIET_GAIN, ctx.currentTime, 0.05);
}

export const micClean = () => clean;
