import { icon } from '../core/icons.js';
import { esc } from '../core/format.js';

const BARS = [38, 52, 44, 66, 58, 80, 72];

const art = `<img class="auth-photo" src="css/login-photo.webp" alt="" width="1200" height="1199" decoding="async">
  <span class="auth-chip auth-chip-a" aria-hidden="true">${icon('home', 22)}</span>
  <span class="auth-chip auth-chip-b" aria-hidden="true">${icon('shield', 22)}</span>
  <span class="auth-chip auth-chip-c" aria-hidden="true">${icon('check', 20)}</span>
  <span class="auth-chip auth-chip-bars" aria-hidden="true"><span class="auth-bars">${BARS.map((h, i) => `<i style="--h:${h}%;--i:${i}"></i>`).join('')}</span></span>`;

function hideBrokenArt(host) {
  const img = host.querySelector('.auth-photo');
  if (!img) return;
  const hide = () => { img.hidden = true; };
  if (img.complete && !img.naturalWidth) hide();
  else img.addEventListener('error', hide, { once: true });
}

function layout(panel, loading = '') {
  return `<main class="auth">
    <div class="auth-device">
      <div class="auth-leaf auth-leaf-l">
        <section class="auth-art">${art}</section>
        ${loading ? `<div class="auth-back" aria-hidden="true">${loading}</div>` : ''}
      </div>
      <div class="auth-leaf auth-leaf-r"><section class="auth-panel">${panel}</section></div>
      <span class="auth-hinge" aria-hidden="true"></span>
    </div>
    ${loading ? `<div class="auth-splash" aria-hidden="true">${loading}</div>` : ''}
  </main>`;
}

const G_SRC = ['css/google-g.png', 'css/google-g.svg'];
const FOLD = { start: 120, close: 940, go: 1750, calm: 650 };

function bindGoogleMark(host) {
  const img = host.querySelector('.auth-g');
  if (!img) return;
  let i = 0;
  const fail = () => {
    i += 1;
    if (i < G_SRC.length) { img.src = G_SRC[i]; return; }
    img.hidden = true;
    host.querySelector('.auth-g-alt').hidden = false;
  };
  img.addEventListener('error', fail);
  if (img.complete && !img.naturalWidth) fail();
}

function bindSwipe(host, onDone, onMove = () => {}) {
  const wrap = host.querySelector('.auth-swipe');
  const knob = wrap.querySelector('.auth-swipe-knob');
  const pad = 6;
  let max = 0;
  let x = 0;
  let from = 0;
  let drag = false;
  let travel = 0;
  let done = false;
  let nudgeTimer;
  const measure = () => { max = Math.max(0, wrap.clientWidth - knob.offsetWidth - pad * 2); };
  const set = (v) => {
    x = Math.max(0, Math.min(max, v));
    wrap.style.setProperty('--x', `${x}px`);
    wrap.style.setProperty('--p', max ? (x / max).toFixed(3) : '0');
    onMove(max ? x / max : 0);
  };
  const finish = () => {
    if (done) return;
    done = true;
    measure();
    wrap.classList.remove('is-drag', 'is-nudge');
    wrap.classList.add('is-snap', 'is-done');
    set(max);
    knob.setAttribute('aria-disabled', 'true');
    onDone();
  };
  const nudge = () => {
    clearTimeout(nudgeTimer);
    wrap.classList.remove('is-nudge');
    void wrap.offsetWidth;
    wrap.classList.add('is-nudge');
    host.querySelector('.auth-swipe-hint')?.classList.add('is-on');
    nudgeTimer = setTimeout(() => wrap.classList.remove('is-nudge'), 900);
  };
  knob.addEventListener('pointerdown', (e) => {
    if (done || e.button > 0) return;
    measure();
    drag = true;
    travel = 0;
    from = e.clientX - x;
    wrap.classList.remove('is-snap', 'is-nudge');
    wrap.classList.add('is-drag');
    knob.setPointerCapture?.(e.pointerId);
  });
  knob.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const v = e.clientX - from;
    travel = Math.max(travel, Math.abs(v));
    set(v);
  });
  const release = () => {
    if (!drag) return;
    drag = false;
    wrap.classList.remove('is-drag');
    if (max && x >= max * 0.8) { finish(); return; }
    wrap.classList.add('is-snap');
    set(0);
    if (travel < 6) nudge();
  };
  knob.addEventListener('pointerup', release);
  knob.addEventListener('pointercancel', release);
  knob.addEventListener('lostpointercapture', release);
  knob.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); }
  });
  knob.addEventListener('click', (e) => { if (e.detail === 0) finish(); });
  addEventListener('resize', () => { if (done) { measure(); set(max); } }, { passive: true });
}

export function loginScreen(host, { message = '', demo = false, roles = false, onLogin }) {
  let role = 'viewer';
  const going = demo ? 'Menyiapkan dashboard' : 'Menghubungkan ke Google';
  const loading = `<div class="auth-load">
      <span class="auth-load-mark">${icon('logo', 30)}</span>
      <b>KPR Analytics</b>
      <small>${going}…</small>
      <span class="auth-load-bar"></span>
    </div>`;
  host.innerHTML = layout(`
    <div class="auth-box">
      <span class="auth-mark">${icon('logo', 26)}</span>
      <h1>Masuk ke KPR Analytics</h1>
      <p class="auth-lead">Dashboard internal. Hanya akun yang sudah didaftarkan admin yang bisa membuka data.</p>
      ${message ? `<p class="auth-msg" role="alert">${esc(message)}</p>` : ''}
      ${roles ? `<div class="auth-role" role="group" aria-label="Masuk sebagai">
        <span>Masuk sebagai</span>
        <button type="button" data-role="viewer" aria-pressed="true">Pengguna</button>
        <button type="button" data-role="admin" aria-pressed="false">Admin</button>
      </div>` : ''}
      <div class="auth-swipe">
        <span class="auth-swipe-fill" aria-hidden="true"></span>
        <span class="auth-swipe-label" aria-hidden="true">Geser untuk masuk dengan Google</span>
        <span class="auth-swipe-done" aria-hidden="true">${going}…</span>
        <span class="auth-swipe-end" aria-hidden="true">${icon('arrow-right', 18)}</span>
        <button type="button" class="auth-swipe-knob" id="login" aria-label="Masuk dengan Google. Geser ke kanan, atau tekan Enter.">
          <img class="auth-g" src="${G_SRC[0]}" alt="" width="26" height="26" decoding="async"><span class="auth-g-alt" hidden>${icon('arrow-right', 22)}</span>
        </button>
      </div>
      <p class="auth-swipe-hint">Geser bulatan ke kanan sampai ujung, atau tekan Enter. Pakai akun Google yang sudah didaftarkan admin.</p>
      <p class="sr-only" role="status" aria-live="polite" id="auth-live"></p>
      ${demo ? `<p class="auth-demo">Versi demo: geser untuk langsung membuka dashboard tanpa memeriksa akun.${roles ? ' Halaman admin hanya muncul bila masuk sebagai Admin.' : ''} Di versi asli, Google memeriksa akun Anda lalu server mencocokkan email dengan daftar akses sebelum data dikirim.</p>` : ''}
      <ul class="auth-points">
        <li>${icon('shield', 16)}<span>Tidak ada password yang disimpan di dashboard ini.</span></li>
        <li>${icon('user-check', 16)}<span>Belum terdaftar? Masuk dulu, lalu kirim permintaan akses ke admin.</span></li>
        <li>${icon('lock', 16)}<span>Data baru dikirim setelah server memeriksa login dan email Anda.</span></li>
      </ul>
    </div>`, loading);
  hideBrokenArt(host);
  bindGoogleMark(host);
  host.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => {
    role = b.dataset.role;
    host.querySelectorAll('[data-role]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  const root = host.querySelector('.auth');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = matchMedia('(min-width: 900px)');
  const lift = (p) => { if (!calm && wide.matches) root.style.setProperty('--lift', p.toFixed(3)); };
  const frame = () => {
    const knob = host.querySelector('#login').getBoundingClientRect();
    root.style.setProperty('--ox', `${Math.round(knob.left + knob.width / 2)}px`);
    root.style.setProperty('--oy', `${Math.round(knob.top + knob.height / 2)}px`);
    if (!wide.matches) return;
    const box = root.querySelector('.auth-device').getBoundingClientRect();
    root.style.setProperty('--fit', Math.min(1, (innerHeight - 32) / (box.height * 1.15)).toFixed(3));
    if (box.top < 0 || box.bottom > innerHeight) scrollTo({ top: scrollY + box.top + box.height / 2 - innerHeight / 2, behavior: calm ? 'auto' : 'smooth' });
  };
  bindSwipe(host, () => {
    host.querySelector('#auth-live').textContent = `${going}, tunggu sebentar.`;
    root.setAttribute('aria-busy', 'true');
    frame();
    setTimeout(() => root.classList.add('is-folding'), calm ? 0 : FOLD.start);
    setTimeout(() => root.classList.add('is-closed'), calm ? 0 : FOLD.close);
    addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); }, { once: true });
    setTimeout(() => onLogin(role), calm ? FOLD.calm : FOLD.go);
  }, lift);
  host.querySelector('#login').focus({ preventScroll: true });
}

export function deniedScreen(host, { email = '', asked = false, canAsk = false, note = '', onAsk, onSwitch, onReload }) {
  const draw = (state, error = '') => {
    const waiting = state === 'pending';
    const off = state === 'off';
    host.innerHTML = layout(`
      <div class="auth-box">
        <span class="auth-mark ${waiting ? 'is-wait' : 'is-lock'}">${icon(waiting ? 'clock' : 'lock', 26)}</span>
        <h1>${waiting ? 'Menunggu persetujuan admin' : off ? 'Akses dinonaktifkan' : 'Akses belum diberikan'}</h1>
        <p class="auth-lead">${email ? `Anda masuk sebagai <b>${esc(email)}</b>. ` : ''}${waiting
    ? 'Permintaan akses sudah terkirim. Setelah admin menyetujui, tekan Cek lagi untuk membuka dashboard.'
    : off ? 'Admin menonaktifkan akses akun ini. Hubungi admin dashboard bila ini keliru.'
      : canAsk ? 'Akun ini belum ada di daftar akses. Kirim permintaan, nanti admin yang menyetujui.' : esc(note)}</p>
        ${error ? `<p class="auth-msg" role="alert">${esc(error)}</p>` : ''}
        <div class="auth-actions">
          ${canAsk && !waiting && !off ? `<button class="btn primary auth-btn" type="button" id="ask-access">${icon('user-check', 17)}Minta akses</button>` : ''}
          ${waiting || !canAsk ? `<button class="btn primary auth-btn" type="button" id="recheck">Cek lagi</button>` : ''}
          ${onSwitch ? '<button class="btn auth-btn" type="button" id="switch-account">Masuk dengan akun lain</button>' : ''}
        </div>
      </div>`);
    hideBrokenArt(host);
    host.querySelector('#switch-account')?.addEventListener('click', () => onSwitch());
    host.querySelector('#recheck')?.addEventListener('click', () => onReload());
    const ask = host.querySelector('#ask-access');
    ask?.addEventListener('click', async () => {
      ask.disabled = true;
      try {
        const res = await onAsk();
        if (res?.status === 'allowed') { onReload(); return; }
        draw(res?.status === 'off' ? 'off' : 'pending');
      } catch (err) {
        draw('idle', err?.message || 'Permintaan belum terkirim. Coba lagi.');
      }
    });
    (host.querySelector('#recheck') || ask || host.querySelector('#switch-account'))?.focus({ preventScroll: true });
  };
  draw(asked ? 'pending' : 'idle');
}
