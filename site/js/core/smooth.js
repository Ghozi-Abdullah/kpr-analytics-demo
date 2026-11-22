const KEY = 'kpr.fx';
const MIN_FPS = 40;
let lite = false;
try { lite = localStorage.getItem(KEY) === 'lite'; } catch {}
if (lite) document.documentElement.classList.add('fx-lite');

let sampling = false;

export function checkSmooth() {
  if (lite || sampling || document.visibilityState !== 'visible') return;
  sampling = true;
  setTimeout(() => {
    let frames = 0;
    const start = performance.now();
    const step = (t) => {
      frames += 1;
      if (t - start < 800) { requestAnimationFrame(step); return; }
      sampling = false;
      if (document.visibilityState !== 'visible') return;
      const fps = (frames * 1000) / (t - start);
      if (fps >= MIN_FPS) return;
      lite = true;
      document.documentElement.classList.add('fx-lite');
      try { localStorage.setItem(KEY, 'lite'); } catch {}
    };
    requestAnimationFrame(step);
  }, 250);
}
