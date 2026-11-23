import { REST, mouthAt } from './mouth.js';

const PAD_X = 0.06;
const PAD_TOP = 0.08;
const FOCUS = 0.42;
const DEPTH_PUSH = 0.05;
const FADE_MS = 360;
const g = (n) => Number(n).toFixed(4);
const v2 = (a) => `vec2(${g(a[0])}, ${g(a[1])})`;

const VERT = `attribute vec2 pos;
varying vec2 uv;
void main() {
  uv = vec2(pos.x * 0.5 + 0.5, 0.5 - pos.y * 0.5);
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

const frag = (M) => `precision mediump float;
varying vec2 uv;
uniform sampler2D faceA;
uniform sampler2D faceB;
uniform sampler2D faceC;
uniform sampler2D depth;
uniform float blendAB;
uniform float blendC;
uniform vec2 tilt;
uniform float roll;
uniform float lift;
uniform float zoom;
uniform vec4 frame;
uniform sampler2D mouthTex;
uniform vec4 mouth;
uniform float talkMix;

float zAt(vec2 p) { return texture2D(depth, p).r; }

vec4 tile(float i, vec2 q) {
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return vec4(0.0);
  float edge = 0.5 / ${g(M.tilePx)};
  return texture2D(mouthTex, vec2(q.x, (i + clamp(q.y, edge, 1.0 - edge)) / 4.0));
}

vec2 reach(vec2 q, vec2 from, vec2 scale) { return from + (q - ${v2(M.home)}) / scale; }

void main() {
  vec2 q = (uv - frame.xy) * frame.zw;
  vec2 pivot = vec2(0.5, 0.9);
  q -= pivot;
  q.y += lift;
  q /= zoom;
  float s = sin(roll);
  float c = cos(roll);
  q = vec2(c * q.x + s * q.y, -s * q.x + c * q.y) + pivot;
  vec2 p = q;
  for (int i = 0; i < 3; i++) p = q - tilt * (zAt(p) - ${FOCUS.toFixed(2)}) * ${DEPTH_PUSH.toFixed(3)};
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) { gl_FragColor = vec4(0.0); return; }
  vec4 col = mix(mix(texture2D(faceA, p), texture2D(faceB, p), blendAB), texture2D(faceC, p), blendC);
  vec2 mq = (p - vec2(${g(M.rect[0])}, ${g(M.rect[1])})) / vec2(${g(M.rect[2])}, ${g(M.rect[3])});
  if (talkMix > 0.001 && mq.x >= 0.0 && mq.y >= 0.0 && mq.x <= 1.0 && mq.y <= 1.0) {
    float hole = 1.0 - smoothstep(0.85, 1.15, length((mq - vec2(${g(M.hole[0])}, ${g(M.hole[1])})) / vec2(${g(M.hole[2])}, ${g(M.hole[3])})));
    float shut = 1.0 - smoothstep(0.08, 0.24, mouth.x);
    float gape = max(mouth.x, 0.12);
    vec4 closed = tile(1.0, reach(mq, ${v2(M.home)}, vec2(mouth.y * (1.0 - 0.12 * mouth.z), 1.0 - 0.3 * mouth.z)));
    vec4 wide = tile(2.0, reach(mq, ${v2(M.open)}, vec2(mouth.y, gape)));
    vec4 pursed = tile(3.0, reach(mq, ${v2(M.round)}, vec2(mouth.y * ${g(M.roundFit[0])}, gape * ${g(M.roundFit[1])})));
    vec4 lips = closed * shut + mix(wide, pursed, mouth.w) * (1.0 - shut);
    vec4 mouthCol = lips + tile(0.0, mq) * (1.0 - lips.a);
    col = mix(col, mouthCol, max(hole, lips.a) * talkMix);
  }
  gl_FragColor = col * smoothstep(1.0, 0.9, p.y);
}`;

const BASE = { talk: 'smile' };
const ALT = { neutral: 'blink' };
const IDLE = 'neutral';

const MOUTH_RATE = [[26, 34], [16, 16], [34, 22], [14, 14]];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function spring(state, target, dt, k) {
  state.v += (k * k * (target - state.x) - 2 * k * state.v) * dt;
  state.x += state.v * dt;
}

function program(gl, mouthArt) {
  const make = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  };
  const vs = make(gl.VERTEX_SHADER, VERT);
  const fs = make(gl.FRAGMENT_SHADER, frag(mouthArt));
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

export function mountAvatar3d(orb, { faces: faceUrls, depth: depthUrl, mouth: mouthArt, motion: MOTION, voiceLevel = () => -1, voiceCue = () => null, lite = () => false } = {}) {
  const blob = orb?.querySelector('.blob');
  if (!blob || orb.querySelector('.kira-3d')) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'kira-3d';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl || gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) < 5) return null;
  const prog = program(gl, mouthArt);
  if (!prog) return null;

  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const faces = new Map();
  let depthTex = null;
  let mouthTex = null;
  let ready = false;
  let running = false;
  let raf = 0;
  let last = 0;
  let clock = 0;

  const view = { a: IDLE, b: ALT[IDLE], c: IDLE, target: IDLE, ab: 0, fade: 0, fadeFrom: 0, fading: false };
  let pose = IDLE;
  let mouth = 0;
  const lips = [...REST];
  let talkMix = 0;
  let talkFrom = 0;
  let listen = 0;
  let blinkAt = 0;
  let blinkStart = -1;
  const look = { x: 0, y: 0, at: 0 };
  const motion = { tx: { x: 0, v: 0 }, ty: { x: 0, v: 0 }, roll: { x: 0, v: 0 }, lift: { x: 0, v: 0 }, zoom: { x: 1, v: 0 } };

  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const at = gl.getAttribLocation(prog, 'pos');
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  const u = Object.fromEntries(['faceA', 'faceB', 'faceC', 'depth', 'blendAB', 'blendC', 'tilt', 'roll', 'lift', 'zoom', 'frame', 'mouthTex', 'mouth', 'talkMix']
    .map((k) => [k, gl.getUniformLocation(prog, k)]));
  gl.uniform1i(u.faceA, 0);
  gl.uniform1i(u.faceB, 1);
  gl.uniform1i(u.faceC, 2);
  gl.uniform1i(u.depth, 3);
  gl.uniform1i(u.mouthTex, 4);
  gl.uniform4f(u.frame, PAD_X / (1 + 2 * PAD_X), PAD_TOP / (1 + PAD_TOP), 1 + 2 * PAD_X, 1 + PAD_TOP);
  gl.clearColor(0, 0, 0, 0);

  function texture(img, unit = 4) {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
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
    if (!depthUrl || !mouthArt?.url || !names.length) return false;
    const [depthImg, mouthImg, ...imgs] = await Promise.all([loadImage(depthUrl), loadImage(mouthArt.url), ...names.map(([, src]) => loadImage(src))]);
    if (gl.isContextLost()) return false;
    depthTex = texture(depthImg);
    mouthTex = texture(mouthImg);
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

  const baseOf = (p) => BASE[p] || p;
  const altOf = (p) => ALT[p] || baseOf(p);

  function show(next) {
    if (next === pose) return;
    const prevBody = MOTION[pose] || MOTION[IDLE];
    pose = next;
    const body = MOTION[next] || MOTION[IDLE];
    if (body.hop && !calm.matches) motion.lift.v += 0.45 * body.hop;
    if (!prevBody.hop && body.zoom > 1.02 && !calm.matches) motion.zoom.v += 0.25;
    if (view.fading && view.fade > 0.5) { view.a = view.c; view.b = altOf(view.target); view.ab = 0; }
    view.target = next;
    if (next === 'talk') talkFrom = clock;
    view.c = baseOf(next);
    view.fade = 0;
    view.fadeFrom = clock;
    view.fading = view.c !== view.a || view.ab > 0.01;
    if (!view.fading) view.b = altOf(next);
  }

  function step(dt) {
    clock += dt;
    const still = calm.matches;
    const body = MOTION[pose] || MOTION[IDLE];

    if (view.fading) {
      view.fade = ease(clamp((clock - view.fadeFrom) / (still ? 0.2 : FADE_MS / 1000), 0, 1));
      if (view.fade >= 1) { view.a = view.c; view.b = altOf(pose); view.ab = 0; view.fade = 0; view.fading = false; }
    }

    let shape = REST;
    const talking = pose === 'talk';
    if (talking) {
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
    talkMix += ((talking ? 1 : 0) - talkMix) * Math.min(1, (talking ? 14 : 8) * dt);
    mouth = lips[0];

    let blink = 0;
    if (baseOf(pose) === IDLE && !view.fading) {
      if (!blinkAt) blinkAt = clock + 2 + Math.random() * 3;
      if (blinkStart < 0 && clock >= blinkAt) blinkStart = clock;
      if (blinkStart >= 0) {
        const t = clock - blinkStart;
        blink = t < 0.09 ? ease(t / 0.09) : t < 0.17 ? 1 : t < 0.33 ? 1 - ease((t - 0.17) / 0.16) : 0;
        if (t >= 0.33) { blinkStart = -1; blinkAt = clock + 3.2 + Math.random() * 3.5; }
      }
    } else { blinkStart = -1; blinkAt = 0; }

    view.ab = view.b === 'blink' ? blink : 0;

    if (clock - look.at > 2.5) { const k = Math.min(1, 1.2 * dt); look.x -= look.x * k; look.y -= look.y * k; }
    const sway = still ? 0 : body.sway * (body.slow ? 0.6 : 1);
    const t = clock * (body.slow ? 0.55 : 1);
    let tx = body.tilt[0] + (still ? 0 : look.x * 0.85) + sway * (0.2 * Math.sin(t * 0.55) + 0.08 * Math.sin(t * 1.37));
    let ty = body.tilt[1] + (still ? 0 : look.y * 0.7) + sway * 0.12 * Math.sin(t * 0.71);
    let roll = body.roll + sway * 0.022 * Math.sin(t * 0.47);
    let lift = body.lift + (still ? 0 : 0.004 * Math.sin(t * 1.6));
    let zoom = body.zoom + (still ? 0 : 0.005 * Math.sin(t * 1.6 + 1) + listen * 0.05);
    if (!still && body.bounce) { lift += 0.012 * Math.abs(Math.sin(clock * 8)); roll += 0.03 * Math.sin(clock * 8); }
    if (!still && body.rock) roll += 0.05 * Math.sin(clock * 2.4);
    if (!still && body.nod) { ty += mouth * 0.14; lift -= mouth * 0.004; }
    tx = clamp(tx, -1, 1);
    ty = clamp(ty, -1, 1);

    const k = still ? 30 : 7;
    spring(motion.tx, tx, dt, k);
    spring(motion.ty, ty, dt, k);
    spring(motion.roll, roll, dt, k);
    spring(motion.lift, lift, dt, k * 1.2);
    spring(motion.zoom, zoom, dt, k * 1.2);
  }

  function draw() {
    fit();
    gl.clear(gl.COLOR_BUFFER_BIT);
    [faces.get(view.a), faces.get(view.b), faces.get(view.c), depthTex, mouthTex].forEach((tex, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex || faces.get(IDLE));
    });
    gl.uniform4f(u.mouth, lips[0], lips[1], lips[2], lips[3]);
    gl.uniform1f(u.talkMix, talkMix);
    gl.uniform1f(u.blendAB, view.ab);
    gl.uniform1f(u.blendC, view.fading ? view.fade : 0);
    gl.uniform2f(u.tilt, motion.tx.x, motion.ty.x);
    gl.uniform1f(u.roll, motion.roll.x);
    gl.uniform1f(u.lift, motion.lift.x);
    gl.uniform1f(u.zoom, motion.zoom.x);
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
    orb.classList.remove('is-3d');
  });

  new MutationObserver(() => { if (orb.dataset.pose) show(orb.dataset.pose); }).observe(orb, { attributes: true, attributeFilter: ['data-pose'] });
  blob.append(canvas);
  load().then((okay) => {
    if (!okay) { canvas.remove(); return; }
    ready = true;
    orb.classList.add('is-3d');
    step(1 / 60);
    draw();
    if (orb.isConnected && orb.closest('dialog')?.open) start();
  }).catch(() => canvas.remove());

  return {
    look(x, y) { look.x = clamp(x, -1, 1); look.y = clamp(y, -1, 1); look.at = clock; },
    listen(v) { listen = clamp(Number(v) || 0, 0, 1); },
    start,
    stop,
    get ready() { return ready; },
  };
}
