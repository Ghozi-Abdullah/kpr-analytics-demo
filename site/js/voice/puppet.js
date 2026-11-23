import { REST, mouthAt } from './mouth.js';

const FADE_MS = 300;
const g = (n) => Number(n).toFixed(4);
const v2 = (a) => `vec2(${g(a[0])}, ${g(a[1])})`;

const VERT = `attribute vec2 pos;
varying vec2 uv;
void main() {
  uv = vec2(pos.x * 0.5 + 0.5, 0.5 - pos.y * 0.5);
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

const mouthPart = (M) => `
uniform sampler2D mouthTex;
uniform vec4 mouth;
uniform float talkMix;

vec4 tile(float i, vec2 q) {
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return vec4(0.0);
  float edge = 0.5 / ${g(M.tilePx)};
  return texture2D(mouthTex, vec2(q.x, (i + clamp(q.y, edge, 1.0 - edge)) / 4.0));
}

vec2 reach(vec2 q, vec2 from, vec2 scale) { return from + (q - ${v2(M.home)}) / scale; }

vec4 speak(vec4 col, vec2 p) {
  vec2 mq = (p - vec2(${g(M.rect[0])}, ${g(M.rect[1])})) / vec2(${g(M.rect[2])}, ${g(M.rect[3])});
  if (talkMix < 0.001 || mq.x < 0.0 || mq.y < 0.0 || mq.x > 1.0 || mq.y > 1.0) return col;
  float hole = 1.0 - smoothstep(0.85, 1.15, length((mq - vec2(${g(M.hole[0])}, ${g(M.hole[1])})) / vec2(${g(M.hole[2])}, ${g(M.hole[3])})));
  float shut = 1.0 - smoothstep(0.08, 0.24, mouth.x);
  float gape = max(mouth.x, 0.12);
  vec4 closed = tile(1.0, reach(mq, ${v2(M.home)}, vec2(mouth.y * (1.0 - 0.12 * mouth.z), 1.0 - 0.3 * mouth.z)));
  vec4 wide = tile(2.0, reach(mq, ${v2(M.open)}, vec2(mouth.y, gape)));
  vec4 pursed = tile(3.0, reach(mq, ${v2(M.round)}, vec2(mouth.y * ${g(M.roundFit[0])}, gape * ${g(M.roundFit[1])})));
  vec4 lips = closed * shut + mix(wide, pursed, mouth.w) * (1.0 - shut);
  vec4 mouthCol = lips + tile(0.0, mq) * (1.0 - lips.a);
  return mix(col, mouthCol, max(hole, lips.a) * talkMix);
}`;

const frag = (rig) => {
  const { geo, mouth: M, fade, size } = rig;
  const aspect = size[0] / size[1];
  return `precision mediump float;
varying vec2 uv;
uniform sampler2D faceA;
uniform sampler2D faceB;
uniform sampler2D faceC;
uniform sampler2D rigMap;
uniform float blendAB;
uniform float blendC;
uniform vec4 frame;
uniform float headRoll;
uniform vec2 headShift;
uniform vec2 look;
uniform float breath;
uniform float bodyRoll;
uniform float lift;
uniform vec2 hair;
${M ? mouthPart(M) : ''}
vec2 turn(vec2 v, float a) {
  v.x *= ${g(aspect)};
  float s = sin(a);
  float c = cos(a);
  v = vec2(c * v.x - s * v.y, s * v.x + c * v.y);
  v.x /= ${g(aspect)};
  return v;
}

void main() {
  vec2 q = (uv - frame.xy) * frame.zw;
  vec2 base = vec2(0.5, ${g(geo.base)});
  q.y += lift;
  q = base + turn(q - base, bodyRoll);
  float above = 1.0 - smoothstep(${g(geo.waist - 0.01)}, ${g(geo.waist + 0.03)}, q.y);
  q.y = mix(q.y, ${g(geo.waist)} + (q.y - ${g(geo.waist)}) / (1.0 + breath), above);
  float hw = 1.0 - smoothstep(${g(geo.chin)}, ${g(geo.shoulder)}, q.y);
  vec2 neck = ${v2(geo.neck)};
  q = neck + turn(q - neck, headRoll * hw) - headShift * hw;
  vec4 r = texture2D(rigMap, q);
  q -= look * r.g;
  q.x -= r.r * hair.x * sin(hair.y + q.y * 7.0);
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) { gl_FragColor = vec4(0.0); return; }
  vec4 col = mix(mix(texture2D(faceA, q), texture2D(faceB, q), blendAB), texture2D(faceC, q), blendC);
  ${M ? 'col = speak(col, q);' : ''}
  gl_FragColor = ${fade ? `col * smoothstep(1.0, ${g(1 - fade)}, q.y)` : 'col'};
}`;
};

const MOUTH_RATE = [[26, 34], [16, 16], [34, 22], [14, 14]];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function spring(state, target, dt, k) {
  state.v += (k * k * (target - state.x) - 2 * k * state.v) * dt;
  state.x += state.v * dt;
}

function program(gl, rig) {
  const make = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  };
  const vs = make(gl.VERTEX_SHADER, VERT);
  const fs = make(gl.FRAGMENT_SHADER, frag(rig));
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  return gl.getProgramParameter(prog, gl.LINK_STATUS) ? prog : null;
}

async function loadImage(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  return img;
}

export function mountPuppet(host, { faces: faceUrls, rig, poses: POSES, voiceLevel = () => -1, voiceCue = () => null, lite = () => false } = {}) {
  const blob = host?.querySelector('.blob');
  if (!blob || host.querySelector('.kira-gl') || !rig) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'kira-gl';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  const units = rig.mouth ? 5 : 4;
  if (!gl || gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) < units) return null;
  const prog = program(gl, rig);
  if (!prog) return null;

  const IDLE = 'neutral';
  const shut = new Set(rig.closed || ['blink']);
  const [PAD_X, PAD_TOP] = rig.pad;
  const headH = (rig.geo.chin - rig.geo.face[1]) * 2.6;
  const aspect = rig.size[0] / rig.size[1];
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const faces = new Map();
  let rigTex = null;
  let mouthTex = null;
  let ready = false;
  let running = false;
  let raf = 0;
  let last = 0;
  let clock = 0;

  const poseOf = (p) => POSES[p] || POSES[IDLE];
  const faceOf = (p) => poseOf(p).face || IDLE;
  const view = { a: IDLE, c: IDLE, fade: 0, fadeFrom: 0, fading: false };
  let pose = IDLE;
  const lips = [...REST];
  let talkMix = 0;
  let talkFrom = 0;
  let listen = 0;
  let blinkAt = 0;
  let blinkStart = -1;
  const look = { x: 0, y: 0, at: 0 };
  const m = {};
  for (const k of ['roll', 'lx', 'ly', 'nod', 'lift', 'body']) m[k] = { x: 0, v: 0 };

  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const at = gl.getAttribLocation(prog, 'pos');
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  const u = Object.fromEntries(['faceA', 'faceB', 'faceC', 'rigMap', 'blendAB', 'blendC', 'frame', 'headRoll', 'headShift', 'look', 'breath', 'bodyRoll', 'lift', 'hair', 'mouthTex', 'mouth', 'talkMix']
    .map((k) => [k, gl.getUniformLocation(prog, k)]));
  ['faceA', 'faceB', 'faceC', 'rigMap', 'mouthTex'].slice(0, units).forEach((k, i) => gl.uniform1i(u[k], i));
  gl.uniform4f(u.frame, PAD_X / (1 + 2 * PAD_X), PAD_TOP / (1 + PAD_TOP), 1 + 2 * PAD_X, 1 + PAD_TOP);
  gl.clearColor(0, 0, 0, 0);

  function texture(img) {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + 4);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  async function load() {
    const names = Object.entries(faceUrls || {});
    if (!rig.map || !names.length) return false;
    const [rigImg, mouthImg, ...imgs] = await Promise.all([loadImage(rig.map), rig.mouth ? loadImage(rig.mouth.url) : null, ...names.map(([, src]) => loadImage(src))]);
    if (gl.isContextLost()) return false;
    rigTex = texture(rigImg);
    if (mouthImg) mouthTex = texture(mouthImg);
    names.forEach(([n], i) => faces.set(n, texture(imgs[i])));
    return true;
  }

  function fit() {
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1) * (lite() ? 0.75 : 1);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
  }

  function show(next) {
    if (next === pose) return;
    pose = next;
    const body = poseOf(next);
    if (body.hop && !calm.matches) m.lift.v += 4 * body.hop;
    if (next === 'talk') talkFrom = clock;
    const face = faceOf(next);
    if (view.fading && view.fade > 0.5) view.a = view.c;
    if (face === view.a && !view.fading) return;
    view.c = face;
    view.fade = 0;
    view.fadeFrom = clock;
    view.fading = true;
  }

  function step(dt) {
    clock += dt;
    const still = calm.matches;
    const body = poseOf(pose);

    if (view.fading) {
      view.fade = ease(clamp((clock - view.fadeFrom) / (still ? 0.15 : FADE_MS / 1000), 0, 1));
      if (view.fade >= 1) { view.a = view.c; view.fade = 0; view.fading = false; }
    }

    let shape = REST;
    const talking = pose === 'talk';
    if (talking && rig.mouth) {
      const live = voiceLevel();
      const cue = voiceCue();
      if (cue?.plan) {
        shape = mouthAt(cue.plan, cue.units);
        if (live >= 0 && live < 0.008) shape = REST;
        else if (live >= 0) shape = [shape[0] * (0.55 + 0.45 * smooth(0.04, 0.3, clamp(live * 4, 0, 1))), shape[1], shape[2], shape[3]];
      } else {
        const t = clock - talkFrom;
        const beat = Math.max(0, Math.sin(t * 2 * Math.PI * 4.1 + Math.sin(t * 1.7) * 1.6));
        const phrase = 0.72 + 0.28 * Math.cos(t * 1.3);
        const open = live >= 0 ? smooth(0.12, 0.5, clamp(live * 4, 0, 1)) : smooth(0.15, 0.7, beat ** 0.7 * phrase);
        shape = [open * 0.8, 1, 0, 0];
      }
    }
    for (let k = 0; k < 4; k += 1) {
      const [up, down] = MOUTH_RATE[k];
      lips[k] += (shape[k] - lips[k]) * Math.min(1, (shape[k] > lips[k] ? up : down) * dt);
    }
    talkMix += ((talking && rig.mouth ? 1 : 0) - talkMix) * Math.min(1, (talking ? 14 : 8) * dt);

    let blink = 0;
    const eyesOpen = !shut.has(view.a) && !view.fading;
    if (eyesOpen && faces.has('blink')) {
      if (!blinkAt) blinkAt = clock + 1.5 + Math.random() * 3;
      if (blinkStart < 0 && clock >= blinkAt) blinkStart = clock;
      if (blinkStart >= 0) {
        const t = clock - blinkStart;
        blink = t < 0.07 ? ease(t / 0.07) : t < 0.14 ? 1 : t < 0.28 ? 1 - ease((t - 0.14) / 0.14) : 0;
        if (t >= 0.28) { blinkStart = -1; blinkAt = clock + (Math.random() < 0.2 ? 0.25 : 2.6 + Math.random() * 3.6); }
      }
    } else { blinkStart = -1; blinkAt = 0; }
    view.blink = blink;

    if (clock - look.at > 2.5) { const k = Math.min(1, 1.2 * dt); look.x -= look.x * k; look.y -= look.y * k; }
    const slow = body.slow ? 0.55 : 1;
    const t = clock * slow;
    const sway = still ? 0 : (body.sway ?? 1);
    const tilt = body.look || [0, 0];
    const lx = clamp(tilt[0] + (still ? 0 : look.x), -1, 1);
    const ly = clamp(tilt[1] + (still ? 0 : look.y * 0.8), -1, 1);
    let roll = (body.roll || 0) + sway * (0.035 * Math.sin(t * 0.6) + 0.012 * Math.sin(t * 1.43)) - lx * 0.03;
    let nod = 0;
    if (!still && body.nod) nod = lips[0] * 0.5 + 0.12 * Math.max(0, Math.sin((clock - talkFrom) * 3.1));
    if (!still && body.rock) roll += 0.07 * body.rock * Math.sin(clock * 2.6);
    let lift = 0;
    if (!still && body.bounce) lift += 0.15 * body.bounce * Math.abs(Math.sin(clock * 7.5));
    const bodyRoll = sway * 0.6 * Math.sin(t * 0.42 + 0.8) + (!still && body.rock ? 0.3 * body.rock * Math.sin(clock * 2.6 - 0.6) : 0);

    const k = still ? 30 : 6;
    spring(m.roll, clamp(roll, -0.3, 0.3), dt, k);
    spring(m.lx, lx, dt, k);
    spring(m.ly, ly + nod, dt, k * 1.3);
    spring(m.nod, nod, dt, k * 1.5);
    spring(m.lift, lift, dt, k * 1.4);
    spring(m.body, bodyRoll, dt, k * 0.7);
    view.breath = still ? 0 : 0.5 + 0.5 * Math.sin(clock * 1.55 * slow);
    view.hairPhase = clock * 1.25 * slow;
    view.hairAmp = still ? 0 : 0.55 + Math.min(1.4, Math.abs(m.roll.v) * 9 + Math.abs(m.body.v) * 5 + Math.abs(m.lift.v) * 0.8);
    view.listen = listen;
  }

  function draw() {
    fit();
    gl.clear(gl.COLOR_BUFFER_BIT);
    const texA = faces.get(view.a) || faces.get(IDLE);
    const texB = faces.get('blink') || texA;
    const texC = faces.get(view.c) || texA;
    [texA, texB, texC, rigTex, mouthTex].slice(0, units).forEach((tex, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex);
    });
    if (rig.mouth) {
      gl.uniform4f(u.mouth, lips[0], lips[1], lips[2], lips[3]);
      gl.uniform1f(u.talkMix, talkMix);
    }
    const H = headH;
    gl.uniform1f(u.blendAB, view.blink || 0);
    gl.uniform1f(u.blendC, view.fading ? view.fade : 0);
    gl.uniform1f(u.headRoll, m.roll.x);
    gl.uniform2f(u.headShift, 0, m.nod.x * H * 0.025);
    gl.uniform2f(u.look, (m.lx.x * H * 0.035) / aspect, m.ly.x * H * 0.03);
    gl.uniform1f(u.breath, (view.breath || 0) * rig.breath + (view.listen || 0) * rig.breath * 0.6);
    gl.uniform1f(u.bodyRoll, m.body.x * rig.sway);
    gl.uniform1f(u.lift, m.lift.x * H * 0.25);
    gl.uniform2f(u.hair, ((view.hairAmp || 0) * H * 0.022 * rig.hair) / aspect, view.hairPhase || 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function frame(now) {
    raf = running ? requestAnimationFrame(frame) : 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    step(dt);
    draw();
  }

  function start() {
    if (!ready || running) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    stop();
    ready = false;
    host.classList.remove('is-gl');
  });

  new MutationObserver(() => { if (host.dataset.pose) show(host.dataset.pose); }).observe(host, { attributes: true, attributeFilter: ['data-pose'] });
  blob.append(canvas);
  load().then((okay) => {
    if (!okay) { canvas.remove(); return; }
    ready = true;
    host.classList.add('is-gl');
    if (host.dataset.pose) show(host.dataset.pose);
    view.a = view.c;
    view.fading = false;
    step(1 / 60);
    draw();
    if (host.isConnected && host.closest('dialog')?.open && host.getClientRects().length) start();
  }).catch(() => canvas.remove());

  return {
    look(x, y) { look.x = clamp(x, -1, 1); look.y = clamp(y, -1, 1); look.at = clock; },
    listen(v) { listen = clamp(Number(v) || 0, 0, 1); },
    start,
    stop,
    get ready() { return ready; },
  };
}
