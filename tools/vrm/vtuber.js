import { AmbientLight, DirectionalLight, MathUtils, Object3D, PerspectiveCamera, Scene, SRGBColorSpace, TextureLoader, Vector3, WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const VISEMES = ['aa', 'ih', 'ou', 'ee', 'oh'];
const MOODS = ['happy', 'sad', 'surprised', 'relaxed', 'angry'];
const FACE = {
  idle: { happy: 0.12 },
  blink: { happy: 0.12 },
  smile: { happy: 0.45 },
  grin: { happy: 0.75 },
  laugh: { happy: 1 },
  love: { happy: 0.6, relaxed: 0.25 },
  think: {},
  hmm: { sad: 0.12 },
  wow: { surprised: 0.85 },
  sad: { sad: 0.75 },
  sleepy: { relaxed: 0.85 },
  talk: { happy: 0.12 },
};
const BODY = {
  think: { tilt: 0.12, pitch: -0.08, yaw: 0.12, eyeX: -0.35, eyeY: 0.35 },
  hmm: { tilt: -0.16, pitch: 0.02, yaw: -0.05 },
  sad: { tilt: 0.05, pitch: 0.14 },
  sleepy: { tilt: 0.1, pitch: 0.18, sway: 1.6 },
  wow: { pitch: -0.08, hop: 1 },
  laugh: { bounce: 1 },
  love: { sway: 1.2, tilt: -0.06, hop: 0.6 },
  grin: { hop: 0.5 },
  smile: { pitch: -0.03 },
  talk: {},
};
const ARM_DOWN = 1.2;
const BLINK_CLOSE_S = 0.07;
const BLINK_OPEN_S = 0.11;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const approach = (cur, to, rate, dt) => cur + (to - cur) * Math.min(1, rate * dt);

export async function mountVtuber(host, { url, voiceLevel, voiceCue, visemeAt, lite = () => false }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'kira-vrm';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: !lite(), powerPreference: 'low-power' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const loader = new GLTFLoader();
  loader.register((parser) => {
    const images = new TextureLoader(parser.options.manager);
    images.setCrossOrigin(parser.options.crossOrigin);
    parser.textureLoader = images;
    return { name: 'kpr_image_element' };
  });
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm;
  if (!vrm) throw new Error('bukan VRM');
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons?.(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((o) => { o.frustumCulled = false; });

  const scene = new Scene();
  scene.add(vrm.scene);
  const sun = new DirectionalLight(0xffffff, Math.PI * 0.78);
  sun.position.set(0.5, 1.2, 1.4);
  scene.add(sun, new AmbientLight(0xffffff, 0.35));

  const bone = (name) => vrm.humanoid?.getNormalizedBoneNode(name) || null;
  const B = Object.fromEntries(['hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand', 'leftShoulder', 'rightShoulder'].map((n) => [n, bone(n)]));
  vrm.update(0);
  const hipsY = B.hips ? B.hips.position.y : 0;
  const headPos = new Vector3();
  (B.head || vrm.scene).getWorldPosition(headPos);
  const camera = new PerspectiveCamera(20, 1, 0.1, 20);
  const aim = new Vector3(0, headPos.y * 0.985, 0);
  const place = () => {
    const tall = headPos.y * 0.48;
    const dist = tall / 2 / Math.tan(MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, aim.y + 0.04, headPos.z + dist / Math.min(1, camera.aspect * 1.25));
    camera.lookAt(aim);
  };

  const gazeTarget = new Object3D();
  scene.add(gazeTarget);
  if (vrm.lookAt) vrm.lookAt.target = gazeTarget;

  const has = new Set(Object.keys(vrm.expressionManager?.expressionMap || {}));
  const setFace = (name, v) => { if (has.has(name)) vrm.expressionManager.setValue(name, v); };

  host.prepend(canvas);
  const size = () => {
    const r = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite() ? 1 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    place();
  };
  const ro = new ResizeObserver(size);
  ro.observe(host);
  size();

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const face = Object.fromEntries(MOODS.map((k) => [k, 0]));
  const mouth = [0, 0, 0, 0, 0];
  const body = { tilt: 0, pitch: 0, yaw: 0, eyeX: 0, eyeY: 0, sway: 0, bounce: 0 };
  const look = { x: 0, y: 0, tx: 0, ty: 0, at: 0 };
  let pose = host.dataset.pose || 'idle';
  let hopAt = -10;
  let hopPower = 0;
  let blinkAt = 2;
  let blinkPhase = -1;
  let blinkTwice = false;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let running = false;

  const watch = new MutationObserver(() => {
    const next = host.dataset.pose || 'idle';
    if (next === pose) return;
    pose = next;
    const hop = BODY[pose]?.hop;
    if (hop) { hopAt = clock; hopPower = hop; }
  });
  watch.observe(host, { attributes: true, attributeFilter: ['data-pose'] });

  function blinkValue(dt) {
    if (blinkPhase < 0) {
      blinkAt -= dt;
      if (blinkAt <= 0) { blinkPhase = 0; }
      return 0;
    }
    blinkPhase += dt;
    const total = BLINK_CLOSE_S + BLINK_OPEN_S;
    if (blinkPhase >= total) {
      blinkPhase = -1;
      if (!blinkTwice && Math.random() < 0.18) { blinkTwice = true; blinkAt = 0.12; } else { blinkTwice = false; blinkAt = 2.4 + Math.random() * 3.4; }
      return 0;
    }
    return blinkPhase < BLINK_CLOSE_S ? smooth(0, BLINK_CLOSE_S, blinkPhase) : 1 - smooth(BLINK_CLOSE_S, total, blinkPhase);
  }

  function step(dt) {
    clock += dt;
    const still = reduce.matches;
    const talking = pose === 'talk';

    const want = FACE[pose] || FACE.idle;
    for (const k of MOODS) face[k] = approach(face[k], want[k] || 0, 6, dt);

    let target = [0, 0, 0, 0, 0];
    let level = 0;
    if (talking) {
      const live = voiceLevel?.() ?? -1;
      const cue = voiceCue?.();
      if (cue?.plan && visemeAt) {
        target = visemeAt(cue.plan, cue.units);
        if (live >= 0 && live < 0.008) target = [0, 0, 0, 0, 0];
        else if (live >= 0) { const g = 0.55 + 0.45 * smooth(0.04, 0.3, clamp(live * 4, 0, 1)); target = target.map((v) => v * g); }
      } else {
        const beat = Math.max(0, Math.sin(clock * 2 * Math.PI * 4.1 + Math.sin(clock * 1.7) * 1.6));
        target = [live >= 0 ? smooth(0.12, 0.5, clamp(live * 4, 0, 1)) : smooth(0.15, 0.7, beat ** 0.7) * 0.8, 0, 0, 0, 0];
      }
    }
    for (let k = 0; k < 5; k += 1) {
      mouth[k] = approach(mouth[k], target[k], target[k] > mouth[k] ? 24 : 30, dt);
      level = Math.max(level, mouth[k]);
    }

    const shape = BODY[pose] || {};
    for (const k of ['tilt', 'pitch', 'yaw', 'eyeX', 'eyeY', 'sway', 'bounce']) body[k] = approach(body[k], shape[k] || 0, 4, dt);

    if (clock - look.at > 2.5) { look.tx = 0; look.ty = 0; }
    look.x = approach(look.x, look.tx, 3.2, dt);
    look.y = approach(look.y, look.ty, 3.2, dt);

    const breath = still ? 0 : Math.sin(clock * 1.55);
    const drift = still ? 0 : Math.sin(clock * 0.47) * 0.6 + Math.sin(clock * 0.21 + 1.3) * 0.4;
    const sway = still ? 0 : Math.sin(clock * 1.9) * body.sway;
    const hopT = clock - hopAt;
    const hop = still || hopT > 0.6 ? 0 : Math.sin((hopT / 0.6) * Math.PI) * 0.035 * hopPower;
    const bounce = still ? 0 : Math.abs(Math.sin(clock * 7)) * 0.012 * body.bounce;
    const nod = talking && !still ? level * 0.05 * Math.sin(clock * 6.3) : 0;

    if (B.hips) { B.hips.position.y = hipsY + hop + bounce; B.hips.rotation.z = drift * 0.02 + sway * 0.04; }
    if (B.spine) { B.spine.rotation.x = breath * 0.012; B.spine.rotation.z = drift * 0.012; }
    if (B.chest) { B.chest.rotation.x = breath * 0.018; }
    if (B.upperChest) { B.upperChest.rotation.x = breath * 0.01; }
    const yaw = look.x * 0.45 + body.yaw;
    const pitch = look.y * 0.3 + body.pitch + nod;
    const roll = body.tilt + drift * 0.03 + sway * 0.06 - look.x * 0.06;
    if (B.neck) B.neck.rotation.set(pitch * 0.4, yaw * 0.4, roll * 0.4);
    if (B.head) B.head.rotation.set(pitch * 0.6, yaw * 0.6, roll * 0.6);
    const armSwing = breath * 0.015;
    if (B.leftUpperArm) B.leftUpperArm.rotation.set(0.12, 0, -ARM_DOWN + armSwing);
    if (B.rightUpperArm) B.rightUpperArm.rotation.set(0.12, 0, ARM_DOWN - armSwing);
    if (B.leftLowerArm) B.leftLowerArm.rotation.set(0, -0.25, -0.12);
    if (B.rightLowerArm) B.rightLowerArm.rotation.set(0, 0.25, 0.12);
    if (B.leftShoulder) B.leftShoulder.rotation.z = -breath * 0.01;
    if (B.rightShoulder) B.rightShoulder.rotation.z = breath * 0.01;

    gazeTarget.position.set(camera.position.x + look.x * 0.6 + body.eyeX * 0.5, camera.position.y - look.y * 0.4 + body.eyeY * 0.4, camera.position.z);

    const blink = face.happy > 0.6 || face.relaxed > 0.6 ? 0 : blinkValue(dt);
    for (const k of MOODS) setFace(k, face[k]);
    VISEMES.forEach((k, i) => setFace(k, mouth[i] * (1 - face.surprised * 0.5)));
    setFace('blink', Math.max(blink, pose === 'sleepy' ? 0.35 : 0));
    vrm.update(dt);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    if (lite() && last && now - last < 31) return;
    last = now;
    step(dt);
    renderer.render(scene, camera);
  }

  return {
    canvas,
    start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); raf = 0; },
    look(dx, dy) { look.tx = clamp(dx, -1, 1); look.ty = clamp(dy, -1, 1); look.at = clock; },
    dispose() {
      this.stop();
      ro.disconnect();
      watch.disconnect();
      VRMUtils.deepDispose(vrm.scene);
      renderer.dispose();
      canvas.remove();
    },
  };
}
