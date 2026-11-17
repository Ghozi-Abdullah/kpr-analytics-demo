import { icon } from '../core/icons.js';
import { esc } from '../core/format.js';

const keyMark = (size = 44) => `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <circle cx="17" cy="24" r="8.5"/>
  <circle cx="17" cy="24" r="2.6" fill="currentColor" stroke="none"/>
  <path d="M25.5 24H41M35 24v6.5M40.5 24v5"/>
</svg>`;

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

function layout(panel) {
  return `<main class="auth">
    <div class="auth-device">
      <span class="auth-hinge" aria-hidden="true"></span>
      <section class="auth-art">${art}</section>
      <section class="auth-panel">${panel}</section>
    </div>
  </main>`;
}

export function loginScreen(host, { message = '', demo = false, onLogin }) {
  host.innerHTML = layout(`
    <div class="auth-box">
      <span class="auth-mark">${icon('logo', 26)}</span>
      <h1>Masuk ke KPR Analytics</h1>
      <p class="auth-lead">Dashboard internal. Hanya akun yang sudah didaftarkan admin yang bisa membuka data.</p>
      ${message ? `<p class="auth-msg" role="alert">${esc(message)}</p>` : ''}
      <button class="auth-scan" type="button" id="login">
        <span class="auth-scan-ico">${keyMark(42)}</span>
        <span class="auth-scan-text"><b>Masuk dengan Google</b><small>Pakai akun Google yang sudah didaftarkan admin</small></span>
        ${icon('arrow-right', 18)}
      </button>
      ${demo ? '<p class="auth-demo">Versi demo: tombol ini langsung membuka dashboard tanpa memeriksa akun. Di versi asli, Google memeriksa akun Anda lalu server mencocokkan email dengan daftar akses sebelum data dikirim.</p>' : ''}
      <ul class="auth-points">
        <li>${icon('shield', 16)}<span>Tidak ada password yang disimpan di dashboard ini.</span></li>
        <li>${icon('user-check', 16)}<span>Belum terdaftar? Masuk dulu, lalu kirim permintaan akses ke admin.</span></li>
        <li>${icon('lock', 16)}<span>Data baru dikirim setelah server memeriksa login dan email Anda.</span></li>
      </ul>
    </div>`);
  hideBrokenArt(host);
  const btn = host.querySelector('#login');
  btn.addEventListener('click', () => onLogin());
  btn.focus({ preventScroll: true });
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
