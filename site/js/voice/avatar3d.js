const PAD_X = 0.06;
const PAD_TOP = 0.08;
const FOCUS = 0.42;
const DEPTH_PUSH = 0.05;
const FADE_MS = 360;
const LIPS_AT = [0.537, 0.62];
const LIPS_SIZE = [0.09, 0.057];
const LIP_FACES = ['idle', 'talk', 'grin', 'wow'];

const VERT = `attribute vec2 pos;
varying vec2 uv;
void main() {
  uv = vec2(pos.x * 0.5 + 0.5, 0.5 - pos.y * 0.5);
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

const FRAG = `precision mediump float;
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
uniform sampler2D lipsM;
uniform sampler2D lipsA;
uniform sampler2D lipsE;
uniform sampler2D lipsO;
uniform vec4 lips;

float zAt(vec2 p) { return texture2D(depth, p).r; }

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
  float open = lips.x + lips.y + lips.z + lips.w;
  if (open > 0.002) {
    float r = length((p - vec2(${LIPS_AT[0]}, ${LIPS_AT[1]})) / vec2(${LIPS_SIZE[0]}, ${LIPS_SIZE[1]}));
    float m = smoothstep(1.35, 0.75, r);
    if (m > 0.0) {
      vec4 shape = texture2D(lipsM, p) * lips.x + texture2D(lipsA, p) * lips.y + texture2D(lipsE, p) * lips.z + texture2D(lipsO, p) * lips.w;
      col = mix(col, shape + col * max(0.0, 1.0 - open), m);
    }
  }
  gl_FragColor = col;
}`;

const BODY = {
  idle: { tilt: [0, 0], roll: 0, lift: 0, zoom: 1, sway: 1 },
  smile: { tilt: [0, -0.05], roll: 0, lift: 0.004, zoom: 1.02, sway: 0.7 },
  grin: { tilt: [0, -0.1], roll: 0.02, lift: 0.006, zoom: 1.03, sway: 0.6, hop: 0.9 },
  laugh: { tilt: [0, -0.15], roll: 0.03, lift: 0.006, zoom: 1.03, sway: 0.3, hop: 1, bounce: 1 },
  love: { tilt: [0, -0.05], roll: 0, lift: 0.006, zoom: 1.03, sway: 0.3, hop: 0.8, rock: 1 },
  think: { tilt: [-0.55, -0.45], roll: -0.05, lift: 0.004, zoom: 1, sway: 0.4 },
  hmm: { tilt: [0.35, 0.05], roll: 0.1, lift: 0, zoom: 1, sway: 0.4 },
  wow: { tilt: [0, -0.25], roll: 0, lift: 0.012, zoom: 1.04, sway: 0.3, hop: 1.2 },
  sad: { tilt: [0, 0.55], roll: -0.04, lift: -0.016, zoom: 0.99, sway: 0.3 },
  sleepy: { tilt: [0.1, 0.6], roll: 0.08, lift: -0.014, zoom: 1, sway: 0.5, slow: 1 },
  talk: { tilt: [0, 0], roll: 0, lift: 0.004, zoom: 1.01, sway: 0.6, nod: 1 },
};
const BASE = { talk: 'smile', blink: 'idle' };
const ALT = { idle: 'blink' };

const LIP = { a: 1, i: 2, e: 2, o: 3, u: 3, m: 0, b: 0, p: 0 };
const NEAR = { w: [3, 0.7], f: [2, 0.4], v: [2, 0.4], y: [2, 0.5] };
const QUIET = /[\s.,!?;:]/;

function lipTarget(text, index) {
  const w = [0, 0, 0, 0];
  const ch = String(text[index] || ' ').toLowerCase();
  if (QUIET.test(ch)) return w;
  if (ch in LIP) { w[LIP[ch]] = 1; return w; }
  if (ch in NEAR) { const [k, v] = NEAR[ch]; w[k] = v; return w; }
  for (let j = index + 1; j < Math.min(text.length, index + 3); j += 1) {
    const n = String(text[j]).toLowerCase();
    if (QUIET.test(n)) break;
    if (LIP[n] > 0) { w[LIP[n]] = 0.55; return w; }
  }
  w[1] = 0.3;
  return w;
}

const urlOf = (value) => (String(value || '').match(/url\(\s*["']?(.*?)["']?\s*\)/) || [])[1] || '';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function spring(state, target, dt, k) {
  state.v += (k * k * (target - state.x) - 2 * k * state.v) * dt;
  state.x += state.v * dt;
}

function program(gl) {
  const make = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  };
  const vs = make(gl.VERTEX_SHADER, VERT);
  const fs = make(gl.FRAGMENT_SHADER, FRAG);
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

export function mountAvatar3d(orb, { voiceLevel = () => -1, voiceCue = () => null, lite = () => false } = {}) {
  const blob = orb?.querySelector('.blob');
  if (!blob || orb.querySelector('.kira-3d')) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'kira-3d';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl || gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) < 8) return null;
  const prog = program(gl);
  if (!prog) return null;

  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const faces = new Map();
  let depthTex = null;
  let ready = false;
  let running = false;
  let raf = 0;
  let last = 0;
  let clock = 0;

  const view = { a: 'idle', b: 'blink', c: 'idle', target: 'idle', ab: 0, fade: 0, fadeFrom: 0, fading: false };
  let pose = 'idle';
  let mouth = 0;
  const lips = [0, 0, 0, 0];
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
  const u = Object.fromEntries(['faceA', 'faceB', 'faceC', 'depth', 'blendAB', 'blendC', 'tilt', 'roll', 'lift', 'zoom', 'frame', 'lipsM', 'lipsA', 'lipsE', 'lipsO', 'lips']
    .map((k) => [k, gl.getUniformLocation(prog, k)]));
  gl.uniform1i(u.faceA, 0);
  gl.uniform1i(u.faceB, 1);
  gl.uniform1i(u.faceC, 2);
  gl.uniform1i(u.depth, 3);
  ['lipsM', 'lipsA', 'lipsE', 'lipsO'].forEach((k, i) => gl.uniform1i(u[k], 4 + i));
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
    const names = [...blob.querySelectorAll('.kira-pose')].map((el) => [el.className.match(/kira-(\w+)$/)?.[1], urlOf(getComputedStyle(el).backgroundImage)]);
    const depthUrl = urlOf(getComputedStyle(orb).getPropertyValue('--kira-depth'));
    if (!depthUrl || names.some(([n, src]) => !n || !src)) return false;
    const [depthImg, ...imgs] = await Promise.all([loadImage(depthUrl), ...names.map(([, src]) => loadImage(src))]);
    if (gl.isContextLost()) return false;
    depthTex = texture(depthImg);
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
    const prevBody = BODY[pose] || BODY.idle;
    pose = next;
    const body = BODY[next] || BODY.idle;
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
    const body = BODY[pose] || BODY.idle;

    if (view.fading) {
      view.fade = ease(clamp((clock - view.fadeFrom) / (still ? 0.2 : FADE_MS / 1000), 0, 1));
      if (view.fade >= 1) { view.a = view.c; view.b = altOf(pose); view.ab = 0; view.fade = 0; view.fading = false; }
    }

    let shape = [0, 0, 0, 0];
    if (pose === 'talk') {
      const live = voiceLevel();
      const cue = voiceCue();
      if (cue) {
        shape = lipTarget(cue.text, cue.index);
        if (live >= 0) {
          const open = smooth(0.04, 0.3, clamp(live * 4, 0, 1));
          shape = shape.map((v, k) => (k === 0 ? v : v * (0.35 + 0.65 * open)));
          if (live < 0.008) shape = [0, 0, 0, 0];
        }
      } else {
        const t = clock - talkFrom;
        const beat = Math.max(0, Math.sin(t * 2 * Math.PI * 4.1 + Math.sin(t * 1.7) * 1.6));
        const phrase = 0.72 + 0.28 * Math.cos(t * 1.3);
        shape[1] = live >= 0 ? smooth(0.12, 0.5, clamp(live * 4, 0, 1)) : smooth(0.15, 0.7, beat ** 0.7 * phrase);
      }
    }
    for (let k = 0; k < 4; k += 1) {
      const rate = shape[k] > lips[k] ? 30 : 18;
      lips[k] += (shape[k] - lips[k]) * Math.min(1, rate * dt);
    }
    mouth = lips[1] + lips[2] * 0.8 + lips[3] * 0.7;

    let blink = 0;
    if (baseOf(pose) === 'idle' && !view.fading) {
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
    [view.a, view.b, view.c, null, ...LIP_FACES].forEach((name, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, name ? faces.get(name) || faces.get('idle') : depthTex);
    });
    gl.uniform4f(u.lips, lips[0], lips[1], lips[2], lips[3]);
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
