export const HALF = {
  neutral: 'img/kira-half-neutral.webp',
  blink: 'img/kira-half-blink.webp',
  smile: 'img/kira-half-smile.webp',
  blush: 'img/kira-half-blush.webp',
  laugh: 'img/kira-half-laugh.webp',
  thinking: 'img/kira-half-thinking.webp',
  surprised: 'img/kira-half-surprised.webp',
  worried: 'img/kira-half-worried.webp',
  confused: 'img/kira-half-confused.webp',
  sleepy: 'img/kira-half-sleepy.webp',
  wave: 'img/kira-half-wave.webp',
};

export const FULL = {
  neutral: 'img/kira-full-neutral.webp',
  blink: 'img/kira-full-blink.webp',
  smile: 'img/kira-full-smile.webp',
  happy: 'img/kira-full-happy.webp',
  surprised: 'img/kira-full-surprised.webp',
};

export const FACE = { idle: 'img/kira-face.webp', smile: 'img/kira-face-smile.webp' };

export const HALF_RIG = {
  map: 'img/kira-half-rig.webp',
  size: [440, 440],
  pad: [0.1, 0.12],
  fade: 0.07,
  breath: 0.01,
  sway: 0.02,
  hair: 1.3,
  closed: ['blink', 'laugh', 'sleepy'],
  geo: { neck: [0.528, 0.727], chin: 0.69, shoulder: 0.795, waist: 1.4, face: [0.526, 0.5], base: 1.0 },
  mouth: { url: 'img/kira-half-mouth.webp', rect: [0.433, 0.5489, 0.2318, 0.1261], hole: [0.5, 0.2387, 0.4, 0.3829], home: [0.5, 0.1351], open: [0.5392, 0.1441], round: [0.5637, 0.2342], roundFit: [1.9583, 2.1212], tilePx: 56 },
};

export const FULL_RIG = {
  map: 'img/kira-full-rig.webp',
  size: [430, 1364],
  pad: [0.12, 0.04],
  fade: 0,
  breath: 0.012,
  sway: 0.012,
  hair: 1.4,
  closed: ['blink', 'happy'],
  geo: { neck: [0.513, 0.1364], chin: 0.1289, shoulder: 0.161, waist: 0.2838, face: [0.5043, 0.0928], base: 0.9932 },
  mouth: { url: 'img/kira-full-mouth.webp', rect: [0.4719, 0.101, 0.0909, 0.0232], hole: [0.4881, 0.4412, 0.2976, 0.2059], home: [0.4881, 0.3676], open: [0.4881, 0.3647], round: [0.4881, 0.3382], roundFit: [2.0, 1.0], tilePx: 32 },
};

export const HALF_POSES = {
  neutral: { face: 'neutral' },
  smile: { face: 'smile', roll: 0.03 },
  blush: { face: 'blush', roll: -0.06, look: [0.25, 0.3], rock: 0.35 },
  laugh: { face: 'laugh', hop: 0.8, bounce: 0.6 },
  thinking: { face: 'thinking', roll: -0.06, look: [-0.5, -0.4], sway: 0.5 },
  surprised: { face: 'surprised', hop: 1, look: [0, -0.3] },
  worried: { face: 'worried', roll: 0.05, look: [0, 0.35], sway: 0.5 },
  confused: { face: 'confused', roll: 0.1, look: [0.35, 0], sway: 0.6 },
  sleepy: { face: 'sleepy', roll: 0.07, look: [0, 0.45], slow: 1 },
  wave: { face: 'wave', hop: 0.6, rock: 0.8 },
  talk: { face: 'smile', nod: 1, sway: 0.8 },
};

export const FULL_POSES = {
  neutral: { face: 'neutral' },
  smile: { face: 'smile', roll: 0.03 },
  blush: { face: 'smile', roll: -0.06, look: [0.25, 0.3], rock: 0.35 },
  laugh: { face: 'happy', hop: 0.8, bounce: 0.6 },
  thinking: { face: 'neutral', roll: -0.09, look: [-0.7, -0.6], sway: 0.5 },
  surprised: { face: 'surprised', hop: 1, look: [0, -0.35] },
  worried: { face: 'neutral', roll: 0.07, look: [0, 0.45], sway: 0.5 },
  confused: { face: 'neutral', roll: 0.14, look: [0.45, 0], sway: 0.6 },
  sleepy: { face: 'blink', roll: 0.09, look: [0, 0.55], slow: 1 },
  wave: { face: 'happy', hop: 0.7, rock: 0.8 },
  talk: { face: 'neutral', nod: 1, sway: 0.8 },
};
