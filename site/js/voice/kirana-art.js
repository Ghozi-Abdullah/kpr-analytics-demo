export const HALF = {
  neutral: 'img/kira-half-neutral.webp',
  blink: 'img/kira-half-blink.webp',
  smile: 'img/kira-half-smile.webp',
  bright: 'img/kira-half-bright.webp',
  laugh: 'img/kira-half-laugh.webp',
  giggle: 'img/kira-half-giggle.webp',
  excited: 'img/kira-half-excited.webp',
  surprised: 'img/kira-half-surprised.webp',
  awed: 'img/kira-half-awed.webp',
  joy: 'img/kira-half-joy.webp',
  energetic: 'img/kira-half-energetic.webp',
  blush: 'img/kira-half-blush.webp',
  shy: 'img/kira-half-shy.webp',
  worried: 'img/kira-half-worried.webp',
  sad: 'img/kira-half-sad.webp',
  sleepy: 'img/kira-half-sleepy.webp',
  confused: 'img/kira-half-confused.webp',
  thinking: 'img/kira-half-thinking.webp',
  realize: 'img/kira-half-realize.webp',
  idea: 'img/kira-half-idea.webp',
  determined: 'img/kira-half-determined.webp',
};

export const FULL = {
  stand: 'img/kira-full-stand.webp',
  smile: 'img/kira-full-smile.webp',
  cheer: 'img/kira-full-cheer.webp',
  think: 'img/kira-full-think.webp',
  gasp: 'img/kira-full-gasp.webp',
  happy: 'img/kira-full-happy.webp',
  confused: 'img/kira-full-confused.webp',
  yawn: 'img/kira-full-yawn.webp',
  wave: 'img/kira-full-wave.webp',
};

export const FACE = { idle: 'img/kira-face.webp', smile: 'img/kira-face-smile.webp' };
export const DEPTH = 'img/kira-depth.webp';
export const MOUTH = {
  url: 'img/kira-mouth.webp',
  rect: [0.401, 0.7385, 0.2899, 0.1694],
  hole: [0.503, 0.2767, 0.3982, 0.6097],
  home: [0.503, 0.1262],
  open: [0.5868, 0.0971],
  round: [0.524, 0.1456],
  roundFit: [1.7959, 1.1333],
  tilePx: 63,
};
export const HALF_SIZE = [352, 372];
export const FULL_SIZE = [298, 880];

export const MOTION = {
  neutral: { tilt: [0, 0], roll: 0, lift: 0, zoom: 1, sway: 1 },
  smile: { tilt: [0, -0.05], roll: 0, lift: 0.004, zoom: 1.02, sway: 0.7 },
  bright: { tilt: [0, -0.1], roll: 0.02, lift: 0.006, zoom: 1.03, sway: 0.6, hop: 0.9 },
  laugh: { tilt: [0, -0.15], roll: 0.03, lift: 0.006, zoom: 1.03, sway: 0.3, hop: 1, bounce: 1 },
  giggle: { tilt: [0.1, -0.05], roll: 0.03, lift: 0.004, zoom: 1.02, sway: 0.4, bounce: 0.6 },
  excited: { tilt: [0, -0.15], roll: 0, lift: 0.012, zoom: 1.04, sway: 0.3, hop: 1.2 },
  energetic: { tilt: [0, -0.1], roll: 0.02, lift: 0.01, zoom: 1.03, sway: 0.4, hop: 1 },
  surprised: { tilt: [0, -0.25], roll: 0, lift: 0.012, zoom: 1.04, sway: 0.3, hop: 1.2 },
  awed: { tilt: [0, -0.2], roll: 0, lift: 0.008, zoom: 1.03, sway: 0.3, hop: 0.6 },
  joy: { tilt: [0, -0.08], roll: 0.03, lift: 0.006, zoom: 1.03, sway: 0.4, rock: 1 },
  blush: { tilt: [0, 0.1], roll: -0.03, lift: 0, zoom: 1.02, sway: 0.4, rock: 0.6 },
  shy: { tilt: [0.1, 0.2], roll: -0.04, lift: -0.004, zoom: 1, sway: 0.3 },
  worried: { tilt: [0, 0.25], roll: -0.03, lift: -0.006, zoom: 1, sway: 0.3 },
  sad: { tilt: [0, 0.5], roll: -0.04, lift: -0.014, zoom: 0.99, sway: 0.3 },
  sleepy: { tilt: [0.1, 0.55], roll: 0.08, lift: -0.012, zoom: 1, sway: 0.5, slow: 1 },
  confused: { tilt: [0.35, 0.05], roll: 0.1, lift: 0, zoom: 1, sway: 0.4 },
  thinking: { tilt: [-0.5, -0.4], roll: -0.05, lift: 0.004, zoom: 1, sway: 0.4 },
  realize: { tilt: [0, -0.2], roll: 0, lift: 0.01, zoom: 1.04, sway: 0.3, hop: 0.9 },
  idea: { tilt: [0, -0.12], roll: 0.02, lift: 0.008, zoom: 1.03, sway: 0.4, hop: 0.8 },
  determined: { tilt: [0, 0.05], roll: 0, lift: 0.004, zoom: 1.03, sway: 0.4, hop: 0.5 },
  talk: { tilt: [0, 0], roll: 0, lift: 0.004, zoom: 1.01, sway: 0.6, nod: 1 },
};
