import { icon } from '../core/icons.js';
import { esc } from '../core/format.js';

const ROLE_LABEL = { viewer: 'Pengguna', admin: 'Admin' };
const EMAIL_RE = /^[a-z0-9._%+-]{1,64}@[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63}){1,4}$/;
const CONFIRM_MS = 4000;

const when = (iso) => {
  if (!iso) return 'Belum pernah';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export function demoAccessApi() {
  const day = (n, h = 9) => new Date(Date.UTC(2026, 9, n, h - 7, 12)).toISOString();
  const state = {
    users: [
      { email: 'admin.demo@contoh.id', role: 'admin', status: 'active', fixed: true },
      { email: 'sari.wulandari@contoh.id', role: 'admin', status: 'active', added: day(2), by: 'admin.demo@contoh.id', last: day(30, 8) },
      { email: 'bagus.pratama@contoh.id', role: 'viewer', status: 'active', added: day(5), by: 'admin.demo@contoh.id', last: day(29, 14) },
      { email: 'dewi.lestari@contoh.id', role: 'viewer', status: 'active', added: day(9), by: 'sari.wulandari@contoh.id', last: day(27, 10) },
      { email: 'rizky.hidayat@contoh.id', role: 'viewer', status: 'off', added: day(11), by: 'admin.demo@contoh.id', last: day(14, 16) },
    ],
    requests: [
      { email: 'putri.anggraini@contoh.id', at: day(30, 11) },
      { email: 'fajar.nugroho@contoh.id', at: day(29, 15) },
    ],
    log: [
      [day(30, 11), 'putri.anggraini@contoh.id', 'minta akses'],
      [day(30, 11), 'putri.anggraini@contoh.id', 'ditolak'],
      [day(30, 8), 'sari.wulandari@contoh.id', 'masuk'],
      [day(29, 15), 'fajar.nugroho@contoh.id', 'minta akses'],
      [day(29, 14), 'bagus.pratama@contoh.id', 'masuk'],
      [day(27, 10), 'dewi.lestari@contoh.id', 'masuk'],
    ],
  };
  const me = 'admin.demo@contoh.id';
  const note = (text) => state.log.unshift([new Date().toISOString(), me, text]);
  const snapshot = () => JSON.parse(JSON.stringify(state));
  return {
    me,
    list: async () => snapshot(),
    save: async ({ email, role, status }) => {
      const old = state.users.find((u) => u.email === email);
      if (old) Object.assign(old, { role, status });
      else state.users.push({ email, role, status, added: new Date().toISOString(), by: me, last: '' });
      state.requests = state.requests.filter((r) => r.email !== email);
      note(`${old ? 'ubah' : 'tambah'} ${email}`);
      return snapshot();
    },
    remove: async (email) => {
      state.users = state.users.filter((u) => u.email !== email);
      note(`hapus ${email}`);
      return snapshot();
    },
    decide: async (email, approve) => {
      state.requests = state.requests.filter((r) => r.email !== email);
      if (approve) state.users.push({ email, role: 'viewer', status: 'active', added: new Date().toISOString(), by: me, last: '' });
      note(`${approve ? 'tambah' : 'tolak'} ${email}`);
      return snapshot();
    },
  };
}

function requestRows(requests) {
  if (!requests.length) return '<p class="admin-empty">Tidak ada permintaan yang menunggu.</p>';
  return `<ul class="admin-requests">${requests.map((r) => `<li>
      <span class="admin-who"><b>${esc(r.email)}</b><small>Meminta ${esc(when(r.at))}</small></span>
      <span class="admin-row-act">
        <button class="btn primary sm" type="button" data-approve="${esc(r.email)}">${icon('check', 15)}Setujui</button>
        <button class="btn sm" type="button" data-reject="${esc(r.email)}">Tolak</button>
      </span></li>`).join('')}</ul>`;
}

function userRows(users, me) {
  const order = (u) => (u.fixed ? 0 : u.status === 'off' ? 2 : 1);
  const sorted = users.slice().sort((a, b) => order(a) - order(b) || a.email.localeCompare(b.email));
  return `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th scope="col">Email</th><th scope="col">Peran</th><th scope="col">Status</th><th scope="col">Terakhir masuk</th><th scope="col"><span class="sr-only">Aksi</span></th></tr></thead>
    <tbody>${sorted.map((u) => {
    const self = u.email === me;
    const locked = u.fixed || self;
    const tag = u.fixed ? (u.role === 'admin' ? 'Admin utama' : 'Dari pengaturan') : self ? 'Anda' : '';
    const on = u.status === 'active';
    return `<tr class="${on ? '' : 'is-off'}">
        <th scope="row"><span class="admin-email">${esc(u.email)}</span>${tag ? `<span class="admin-tag">${tag}</span>` : ''}${u.by && !u.fixed ? `<small>Ditambahkan ${esc(when(u.added))}</small>` : ''}</th>
        <td>${locked ? `<span class="admin-fixed">${ROLE_LABEL[u.role] || esc(u.role)}</span>`
    : `<select class="admin-select" data-role="${esc(u.email)}" aria-label="Peran ${esc(u.email)}">${Object.entries(ROLE_LABEL).map(([k, v]) => `<option value="${k}"${k === u.role ? ' selected' : ''}>${v}</option>`).join('')}</select>`}</td>
        <td>${locked ? `<span class="admin-state on">Aktif</span>`
    : `<button class="admin-switch" type="button" role="switch" aria-checked="${on}" data-toggle="${esc(u.email)}" aria-label="Akses ${esc(u.email)}"><i></i><span>${on ? 'Aktif' : 'Nonaktif'}</span></button>`}</td>
        <td class="admin-last">${u.fixed ? '' : esc(when(u.last))}</td>
        <td class="admin-end">${locked ? '' : `<button class="btn sm admin-del" type="button" data-remove="${esc(u.email)}">Hapus</button>`}</td>
      </tr>`;
  }).join('')}</tbody></table></div>`;
}

function logRows(log) {
  if (!log.length) return '<p class="admin-empty">Belum ada riwayat.</p>';
  const tone = (e) => (e === 'masuk' ? 'ok' : e === 'ditolak' ? 'warn' : '');
  return `<ol class="admin-log">${log.map(([at, email, event]) => `<li><time>${esc(when(at))}</time><b>${esc(email)}</b><span class="${tone(event)}">${esc(event)}</span></li>`).join('')}</ol>`;
}

export function adminScreen(host, { api, me = '', demo = false, onBack }) {
  let data = { users: [], requests: [], log: [] };
  let notice = '';
  let confirmTimer;

  const draw = () => {
    const active = data.users.filter((u) => u.status === 'active').length;
    host.innerHTML = `<main class="admin">
      <header class="admin-head">
        <button class="btn" type="button" id="admin-back">${icon('home', 16)}Dashboard</button>
        <div><h1>Kelola akses</h1><p>${demo ? 'Contoh tampilan dengan data buatan. Perubahan di sini tidak tersimpan.' : `Masuk sebagai ${esc(me)}. Perubahan langsung berlaku.`}</p></div>
      </header>
      <div class="admin-stats">
        <div><small>Pengguna aktif</small><b>${active}</b></div>
        <div><small>Admin</small><b>${data.users.filter((u) => u.role === 'admin' && u.status === 'active').length}</b></div>
        <div class="${data.requests.length ? 'is-warn' : ''}"><small>Menunggu persetujuan</small><b>${data.requests.length}</b></div>
      </div>
      <p class="admin-notice" role="status" aria-live="polite">${esc(notice)}</p>
      <section class="admin-card" aria-labelledby="admin-req-h"><h2 id="admin-req-h">${icon('user-check', 17)}Permintaan akses</h2>${requestRows(data.requests)}</section>
      <section class="admin-card" aria-labelledby="admin-add-h"><h2 id="admin-add-h">${icon('plus', 17)}Tambah pengguna</h2>
        <form class="admin-form" id="admin-add" novalidate>
          <label class="admin-field"><span>Email Google</span><input type="email" id="admin-email" name="email" autocomplete="off" inputmode="email" spellcheck="false" placeholder="nama@gmail.com" maxlength="120" required></label>
          <label class="admin-field admin-field-role"><span>Peran</span><select id="admin-role" class="admin-select">${Object.entries(ROLE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
          <button class="btn primary" type="submit">Tambah</button>
        </form>
        <p class="admin-hint">Pengguna bisa melihat dashboard. Admin juga bisa mengatur siapa yang boleh masuk.</p>
      </section>
      <section class="admin-card" aria-labelledby="admin-users-h"><h2 id="admin-users-h">${icon('users', 17)}Pengguna</h2>${userRows(data.users, me)}</section>
      <section class="admin-card" aria-labelledby="admin-log-h"><h2 id="admin-log-h">${icon('clock', 17)}Riwayat terakhir</h2>${logRows(data.log)}</section>
    </main>`;
    bind();
  };

  const run = async (task, done) => {
    host.querySelector('.admin')?.setAttribute('aria-busy', 'true');
    try {
      data = await task();
      notice = done;
    } catch (err) {
      notice = err?.message || 'Perubahan gagal disimpan.';
    }
    draw();
  };

  function bind() {
    host.querySelector('#admin-back').addEventListener('click', () => onBack());
    host.querySelector('#admin-add').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = host.querySelector('#admin-email');
      const email = input.value.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) { notice = 'Tulis alamat email yang lengkap, contoh nama@gmail.com.'; draw(); host.querySelector('#admin-email').focus(); return; }
      if (data.users.some((u) => u.email === email)) { notice = `${email} sudah ada di daftar.`; draw(); return; }
      run(() => api.save({ email, role: host.querySelector('#admin-role').value, status: 'active' }), `${email} ditambahkan.`);
    });
    host.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', () => run(() => api.decide(b.dataset.approve, true), `${b.dataset.approve} disetujui.`)));
    host.querySelectorAll('[data-reject]').forEach((b) => b.addEventListener('click', () => run(() => api.decide(b.dataset.reject, false), `Permintaan ${b.dataset.reject} ditolak.`)));
    host.querySelectorAll('[data-role]').forEach((sel) => sel.addEventListener('change', () => {
      const u = data.users.find((x) => x.email === sel.dataset.role);
      run(() => api.save({ email: u.email, role: sel.value, status: u.status }), `${u.email} sekarang ${ROLE_LABEL[sel.value]}.`);
    }));
    host.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
      const u = data.users.find((x) => x.email === b.dataset.toggle);
      const status = u.status === 'active' ? 'off' : 'active';
      run(() => api.save({ email: u.email, role: u.role, status }), `${u.email} ${status === 'active' ? 'diaktifkan' : 'dinonaktifkan'}.`);
    }));
    host.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.armed !== '1') {
        clearTimeout(confirmTimer);
        host.querySelectorAll('[data-armed="1"]').forEach((x) => { x.dataset.armed = ''; x.textContent = 'Hapus'; });
        b.dataset.armed = '1';
        b.textContent = 'Yakin hapus?';
        confirmTimer = setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Hapus'; }, CONFIRM_MS);
        return;
      }
      clearTimeout(confirmTimer);
      run(() => api.remove(b.dataset.remove), `${b.dataset.remove} dihapus.`);
    }));
  }

  host.innerHTML = '<main class="admin" aria-busy="true"><p class="admin-loading">Memuat daftar akses…</p></main>';
  api.list().then((res) => { data = res; draw(); }).catch((err) => {
    host.innerHTML = `<main class="admin"><div class="fatal" role="alert"><h2>Halaman admin belum bisa dibuka</h2><p>${esc(err?.message || err)}</p>
      <button class="btn primary" type="button" id="admin-back">Kembali ke dashboard</button></div></main>`;
    host.querySelector('#admin-back').addEventListener('click', () => onBack());
  });
}
