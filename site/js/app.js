import { icon } from './core/icons.js';
import { esc, fmt } from './core/format.js';
import { toast, announce, openTable, emptyState } from './core/ui.js';
import { enhancePicks } from './core/controls.js';
import { downloadPng, destroyCharts } from './charts/charts.js';
import { boot, MODE, AccessError, AuthError, clearCache, readLayout, writeLayout } from './services/data-source.js';
import { startLive, ago, LIVE_INTERVAL } from './services/live.js';
import { resetHub } from './analytics/data-hub.js';
import { createAsk } from './ask/engine.js';
import { createAskDialog } from './ask/ask-dialog.js';
import { handleRedirect, login, logout, session, hasHint } from './services/auth.js';
import { initRouter, navigate, route, hrefFor } from './services/router.js';
import { Board, compact } from './board/board.js';
import ringkasan from './views/ringkasan.js';
import performance from './views/performance.js';
import portofolio from './views/portofolio.js';
import realisasi from './views/realisasi.js';
import sla from './views/sla.js';

const VIEWS = { ringkasan, performance, portofolio, realisasi, sla };
const ORDER = ['ringkasan', 'performance', 'portofolio', 'realisasi', 'sla'];
const S = {
  info: null, view: null, model: null, ctx: null, board: null, editing: false,
  history: [], token: 0, saveTimer: 0, cleanups: new Map(), pendingFocus: '',
  live: null, liveState: { state: 'idle', checkedAt: 0 }, pendingData: '', refreshing: false,
};
const askEngine = createAsk();
let askDialog = null;
const $ = (id) => document.getElementById(id);

function renderShell() {
  const sideNav = ORDER.map((v) => `<a class="side-row" data-view="${v}" href="${hrefFor(v)}">
      <span class="side-ico">${icon(VIEWS[v].icon, 20)}</span><span class="side-label">${VIEWS[v].title}</span></a>`).join('');
  const askHint = 'Tanya data, misal: RO mana NPL tertinggi?';
  const bottomNav = ORDER.map((v) => `<a data-view="${v}" href="${hrefFor(v)}">${icon(VIEWS[v].icon, 21)}<span>${VIEWS[v].title}</span></a>`).join('');
  $('app').innerHTML = `
    <a class="skip" href="#board">Langsung ke panel</a>
    <aside class="side" id="sidebar" aria-label="Navigasi">
      <a class="side-brand" href="${hrefFor('ringkasan')}" data-view="ringkasan" aria-label="KPR Analytics, ke Summary">
        <span class="side-ico">${icon('logo', 26)}</span><span class="side-label"><b>KPR Analytics</b><small>Dashboard internal</small></span></a>
      <button class="side-ask" type="button" data-open-ask aria-keyshortcuts="/ Control+K">
        <span class="side-ico">${icon('ask', 20)}</span><span class="side-label">Tanya data<kbd>/</kbd></span></button>
      <div class="side-wave">
        <div class="side-shape" aria-hidden="true"><i class="side-rail"></i></div>
        <nav class="side-nav" aria-label="Halaman"><span class="side-indicator" aria-hidden="true"></span>${sideNav}</nav>
        <button class="side-tog" type="button" id="sidebar-toggle" aria-expanded="false" aria-label="Buka menu" title="Buka menu">${icon('chevron', 15)}</button>
      </div>
      <div class="side-foot">
        <button class="side-st" type="button" data-open-status>
          <span class="side-ico">${icon('database', 19)}<span class="dot" id="sidebar-status-dot"></span></span><span class="side-label"><b id="sidebar-data">Status data</b><small id="sidebar-fresh"></small></span></button>
      </div>
    </aside>
    <div class="shell">
      <div class="masthead"><header class="page-header">
        <img class="page-logo page-logo-start" src="img/logo-danantara.webp" alt="Danantara Indonesia" width="423" height="112" decoding="async" onerror="this.hidden=true">
        <button class="ask-trigger" type="button" data-open-ask aria-keyshortcuts="/ Control+K">${icon('ask', 19)}<span>${askHint}</span><kbd>/</kbd></button>
        <div class="page-title">
          <a class="brand" href="${hrefFor('ringkasan')}" data-view="ringkasan"><span class="mark">${icon('logo', 18)}</span>KPR Analytics</a>
          <h1 id="page-heading">KPR Analytics</h1><p id="page-subheading">Memuat data</p>
        </div>
        <div class="page-actions">
          <span class="save" id="save" role="status" aria-live="polite"></span>
          <button class="data-btn live-chip" type="button" data-open-status><span class="dot" id="header-status-dot"></span><span id="data-label">Status data</span></button>
          <button class="icon-btn" type="button" id="reload" title="Muat ulang data" aria-label="Muat ulang data">${icon('refresh', 18)}</button>
          <button class="btn" type="button" id="edit" aria-pressed="false">${icon('grid', 17)}<span>Atur panel</span></button>
        </div>
        <img class="page-logo page-logo-end" src="img/logo-bri.webp" alt="BRI" width="221" height="112" decoding="async" onerror="this.hidden=true">
      </header></div>
      <div class="filter-bar" id="filter-bar">
        <div class="filters" id="filters" role="group" aria-label="Filter"></div>
        <div class="editbar" id="edit-bar" hidden>
          <p><b>Mode atur panel.</b> Seret panel untuk memindah, tarik sudut kanan bawah untuk mengubah ukuran. Perubahan tersimpan otomatis untuk akun Anda.</p>
          <div class="editbar-act">
            <button class="btn ghost" type="button" id="undo" disabled>${icon('undo', 16)}Urungkan</button>
            <button class="btn ghost" type="button" id="reset">Tata letak awal</button>
            <button class="btn primary" type="button" id="done">Selesai</button>
          </div>
        </div>
      </div>
      <div class="work" id="workspace">
        <main id="board" tabindex="-1" aria-label="Panel dashboard"></main>
        <aside class="palette" id="palette" aria-labelledby="palette-title" hidden>
          <div class="palette-head"><h2 id="palette-title">Panel tersedia <span id="palette-count"></span></h2>
            <p>Seret ke papan, atau klik tombol tambah untuk menaruhnya di bawah.</p></div>
          <ul class="palette-list" id="palette-list"></ul>
        </aside>
      </div>
      <p id="board-help" class="sr-only">Di mode atur panel: tombol panah memindah panel, Shift dan panah mengubah ukuran, Delete menyembunyikan panel.</p>
    </div>
    <nav class="bottom-nav" aria-label="Halaman">${bottomNav}</nav>
    <dialog id="status-dialog" aria-labelledby="status-dialog-title"></dialog>
    <dialog id="table-dialog" aria-labelledby="table-dialog-title"></dialog>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <div class="sr-only" id="live-region" aria-live="assertive"></div>`;

  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onDocKey);
  bindSide();
  $('reload').addEventListener('click', reload);
  askDialog = createAskDialog({
    engine: askEngine,
    context: () => ({ ro: route().params.ro || '' }),
    onNavigate: (view, params, widget) => go(view, params, { focus: widget }),
  });
  window.addEventListener('resize', placeIndicator);
  setInterval(updateFreshness, 30000);
  $('edit').addEventListener('click', () => setEditing(!S.editing));
  $('done').addEventListener('click', () => setEditing(false));
  $('undo').addEventListener('click', undo);
  $('reset').addEventListener('click', resetLayout);
  $('palette-list').addEventListener('pointerdown', (e) => {
    const li = e.target.closest('.palette-item');
    if (!li || e.target.closest('.palette-add') || e.button !== 0) return;
    S.board?.startAdd(li.dataset.id, e, li);
  });
  $('palette-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (b) S.board?.addItem(b.dataset.add);
  });
  const bar = $('filter-bar');
  new IntersectionObserver(([e]) => bar.classList.toggle('stuck', e.intersectionRatio < 1), { threshold: [1], rootMargin: '-1px 0px 0px 0px' }).observe(bar);
}

let sideOpen = false;
const afterPaint = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function setRail({ animate = false } = {}) {
  const editing = document.body.classList.contains('is-editing');
  const want = !editing && sideOpen;
  const shell = document.querySelector('.shell');
  const lead = shell?.firstElementChild;
  const moving = animate && !calm() && lead && document.body.classList.contains('side-open') !== want;
  const before = moving ? lead.getBoundingClientRect().left : 0;
  document.body.classList.toggle('side-open', want);
  if (moving) {
    const dx = before - lead.getBoundingClientRect().left;
    if (dx) shell.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  }
  const tog = $('sidebar-toggle');
  if (!tog) return;
  const word = want ? 'Tutup menu' : 'Buka menu';
  tog.setAttribute('aria-expanded', String(want));
  tog.setAttribute('aria-label', word);
  tog.title = editing ? 'Menu dirapatkan selama mengatur panel' : word;
  tog.disabled = editing;
}
function placeIndicator() {
  const nav = document.querySelector('.side-nav');
  if (!nav) return;
  const cur = nav.querySelector('.side-row[aria-current="page"]');
  nav.classList.toggle('has-active', !!cur);
  if (cur) nav.style.setProperty('--indicator-y', `${cur.offsetTop}px`);
}

function fitRail() {
  const side = $('sidebar');
  if (!side) return;
  const labels = [...side.querySelectorAll('.side-row .side-label, .side-brand .side-label, .side-ask .side-label')];
  const text = Math.max(0, ...labels.map((l) => {
    const cs = getComputedStyle(l);
    return l.scrollWidth - (cs.position === 'absolute' ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) : 0);
  }));
  const width = Math.round(Math.min(240, Math.max(176, 16 + 46 + 10 + text + 18)));
  document.documentElement.style.setProperty('--side-open', `${width}px`);
}

function bindSide() {
  try { sideOpen = localStorage.getItem('kpr.side.open') === '1'; } catch { sideOpen = false; }
  fitRail();
  document.fonts?.ready?.then(fitRail);
  setRail();
  $('sidebar-toggle').addEventListener('click', () => {
    sideOpen = !sideOpen;
    try { localStorage.setItem('kpr.side.open', sideOpen ? '1' : '0'); } catch {}
    setRail({ animate: true });
  });
}

function onDocClick(e) {
  const nav = e.target.closest('[data-view]');
  if (nav && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
    e.preventDefault();
    if (nav.dataset.view !== S.view?.id) go(nav.dataset.view, {});
    return;
  }
  if (e.target.closest('[data-open-status]')) openStatus();
  if (e.target.closest('[data-open-ask]')) askDialog?.open();
}

const typing = (el) => !!el?.closest?.('input, textarea, select, [contenteditable="true"]');

function onDocKey(e) {
  const k = e.key.toLowerCase();
  if (((e.metaKey || e.ctrlKey) && k === 'k') || (k === '/' && !typing(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey)) {
    if (!document.querySelector('dialog[open]:not(#ask-dialog)') && !S.editing) {
      e.preventDefault();
      askDialog?.open();
      return;
    }
  }
  if (e.key === 'Escape' && !S.editing) document.body.classList.add('tips-off');
  if (e.key === 'Escape') {
    if (document.querySelector('dialog[open], [popover]:popover-open')) return;
    if (S.editing) setEditing(false);
  }
  if (S.editing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.target.closest('input, textarea')) {
    e.preventDefault();
    undo();
  }
}

function updateNav(view) {
  const ro = route().params.ro;
  document.querySelectorAll('[data-view]').forEach((a) => {
    a.href = hrefFor(a.dataset.view, ro ? { ro } : {});
    if (a.classList.contains('side-brand') || a.classList.contains('brand')) return;
    if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  placeIndicator();
}

function setTitle(title, sub) {
  $('page-heading').textContent = /^(Performance|Portofolio|Realisasi|Summary|SLA)$/.test(title) ? `Dashboard ${title} KPR` : title;
  $('page-subheading').textContent = sub;
  document.title = `${title} – KPR Analytics`;
}

const DS_LABEL = { performance: 'Performance', kuadran: 'Kuadran RM', portfolio: 'Portofolio', realisasi: 'Realisasi', sla: 'SLA' };
function updateStatus() {
  const meta = S.info?.meta;
  const dummy = !!meta?.is_dummy;
  for (const id of ['sidebar-status-dot', 'header-status-dot']) $(id)?.classList.toggle('dummy', dummy);
  $('sidebar-data').textContent = dummy ? 'Data dummy' : 'Data asli';
  updateFreshness();
}

function updateFreshness() {
  const meta = S.info?.meta;
  if (!meta || !$('data-label')) return;
  const when = ago(meta.generated_at);
  const live = S.liveState.state;
  const word = live === 'offline' ? 'Offline' : live === 'error' ? 'Gagal cek data' : `Diperbarui ${when}`;
  $('data-label').textContent = meta.is_dummy && live !== 'offline' && live !== 'error' ? `Dummy, ${when}` : word;
  $('sidebar-fresh').textContent = live === 'offline' ? 'Offline' : `Diperbarui ${when}`;
  for (const id of ['sidebar-status-dot', 'header-status-dot']) {
    const el = $(id);
    if (!el) continue;
    el.classList.toggle('live', live === 'live');
    el.classList.toggle('off', live === 'offline' || live === 'error');
  }
  const checked = S.liveState.checkedAt ? new Date(S.liveState.checkedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
  const tip = `Dashboard memeriksa data baru setiap ${Math.round(LIVE_INTERVAL / 1000)} detik${checked ? `. Terakhir dicek ${checked}` : ''}.`;
  document.querySelectorAll('[data-open-status]').forEach((el) => { el.title = tip; });
}

function openStatus() {
  const meta = S.info?.meta;
  const dlg = $('status-dialog');
  const items = Object.entries(meta?.datasets || {}).map(([k, d]) => {
    const period = d.max_date ? `${fmt.dateShort(d.min_date)} s.d. ${fmt.dateShort(d.max_date)}`
      : `${fmt.month(d.min_month, true)} s.d. ${fmt.month(d.max_month, true)}`;
    const dropped = (d.columns_dropped || []).map((c) => `<span class="tag off">${esc(c)}</span>`).join('');
    return `<div class="data-status-item"><b>${esc(DS_LABEL[k] || k)}</b>
      <small>${esc(d.file)}, ${fmt.num(d.rows_in)} baris sumber menjadi ${fmt.num(d.rows_out)} baris agregat. Periode ${esc(period)}.</small>
      ${dropped ? `<small>Kolom yang tidak dibawa ke dashboard:</small><div class="tags">${dropped}</div>` : ''}</div>`;
  }).join('');
  const how = MODE === 'api'
    ? `<p class="note">Masuk sebagai <b>${esc(S.info.email || '')}</b>. Data dikirim oleh Apps Script setelah login Anda dicek. Tata letak panel tersimpan untuk email ini.</p>
       <button class="btn" type="button" id="logout">Keluar</button>`
    : MODE === 'gas'
    ? `<p class="note">Data dibaca dari spreadsheet agregat dengan akun <b>${esc(S.info.email || 'Anda')}</b>. Tata letak panel tersimpan di akun ini. Data diperbarui oleh pemicu terjadwal di project pipeline.</p>`
    : `<p class="note">Mode lokal. Tata letak panel tersimpan di browser ini. Untuk memperbarui data, simpan export spreadsheet ke folder data_raw lalu jalankan:</p>
       <div class="code">python pipeline/build_data.py</div>`;
  const checked = S.liveState.checkedAt ? new Date(S.liveState.checkedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'belum';
  const liveWord = { live: 'Aktif', offline: 'Terhenti, perangkat sedang offline', error: 'Gagal menghubungi server, dicoba lagi otomatis', idle: 'Menyiapkan' }[S.liveState.state] || 'Aktif';
  const liveBox = `<div class="live-box"><b>${icon('signal', 16)}Pembaruan otomatis: ${esc(liveWord)}</b>
    <small>Dashboard memeriksa versi data setiap ${Math.round(LIVE_INTERVAL / 1000)} detik selama halaman terbuka, lalu memperbarui panel tanpa memuat ulang halaman dan tanpa mengubah filter. Terakhir dicek ${esc(checked)}.</small>
    <small>Versi data: ${esc(fmt.date((meta?.generated_at || '').slice(0, 10)))} pukul ${esc((meta?.generated_at || '').slice(11, 16).replace(':', '.'))} (${esc(ago(meta?.generated_at))}).</small></div>`;
  dlg.innerHTML = `<div class="dialog-head"><div style="flex:1"><h2 id="status-dialog-title">Status data</h2>
      <p>Dibangun ${esc(fmt.date((meta?.generated_at || '').slice(0, 10)))} pukul ${esc((meta?.generated_at || '').slice(11, 16).replace(':', '.'))}${meta?.is_dummy ? ', memakai data dummy' : ''}</p></div>
      <button class="icon-btn" type="button" data-close aria-label="Tutup">${icon('close')}</button></div>
    <div class="dialog-body">${liveBox}<div class="data-status">${items}</div>${how}<p class="credit">Ikon: <a href="https://www.flaticon.com/uicons" target="_blank" rel="noopener noreferrer">Uicons by Flaticon</a></p></div>`;
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('#logout')?.addEventListener('click', () => {
    logout();
    try { sessionStorage.setItem('kpr.auth.msg', 'Anda sudah keluar.'); } catch {}
    location.replace(location.pathname);
  });
  dlg.showModal();
}

async function mount({ view: vid, params }) {
  const token = ++S.token;
  setEditing(false);
  const view = VIEWS[vid];
  updateNav(vid);
  if (S.view !== view || !S.model) {
    S.board?.destroy();
    S.view = view;
    S.model = null;
    S.ctx = null;
    S.history = [];
    updateUndo();
    setTitle(view.title, 'Memuat data');
    $('filters').innerHTML = '<span class="filters-skel" aria-hidden="true"></span>';
    $('board').setAttribute('aria-busy', 'true');
    S.board = new Board($('board'), {
      defs: new Map(Object.entries(view.widgets)), render: renderWidget, destroy: destroyWidget, commit: onCommit,
    });
    $('board').addEventListener('board:stack', onStack);
    onStack({ detail: S.board.stack });
    S.board.setItems(layoutFor(view));
    try {
      S.model = await view.load();
    } catch (err) {
      if (token === S.token) showError(err);
      return;
    }
    if (token !== S.token) return;
  }
  await update(params, token);
}

async function update(params, token = S.token) {
  const view = S.view;
  const sel = view.normalize(params, S.model);
  try {
    await view.prepare?.(S.model, sel);
  } catch (err) {
    if (token === S.token) showError(err);
    return;
  }
  if (token !== S.token) return;
  S.ctx = view.context(S.model, sel);
  setTitle(view.title, view.subtitle(S.ctx));
  const f = $('filters');
  const focused = f.contains(document.activeElement) ? document.activeElement.id : '';
  f.innerHTML = view.filters(S.ctx);
  enhancePicks(f);
  view.bindFilters(f, S.ctx, setParams);
  if (focused) document.getElementById(focused)?.focus({ preventScroll: true });
  $('board').removeAttribute('aria-busy');
  S.board.renderAll();
  if (S.pendingFocus) {
    const target = S.pendingFocus;
    S.pendingFocus = '';
    requestAnimationFrame(() => focusWidget(target));
  }
}

function onRoute(r) {
  if (VIEWS[r.view] !== S.view) mount(r);
  else update(r.params);
  updateNav(r.view);
}

function setParams(patch) {
  const r = route();
  const params = { ...r.params, ...patch };
  for (const k of Object.keys(params)) if (params[k] === '' || params[k] === null) delete params[k];
  navigate(r.view, params, { replace: true });
  updateNav(r.view);
  update(params);
}

function go(view, params = {}, { focus = '' } = {}) {
  const ro = route().params.ro;
  const next = navigate(view, { ...(ro ? { ro } : {}), ...params });
  S.pendingFocus = focus || '';
  updateNav(view);
  window.scrollTo({ top: 0 });
  afterPaint().then(() => { if (route().view === next.view) mount(next); });
}

async function copyText(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    openTable({ title: 'Salin teks', columns: ['Teks'], rows: text.split('\n').filter(Boolean).map((l) => [l]) });
  }
}

async function refreshData({ manual = false, version = '' } = {}) {
  if (S.refreshing) return;
  if (S.editing) { S.pendingData = version || 'manual'; return; }
  S.refreshing = true;
  const before = S.info?.meta?.generated_at || '';
  try {
    clearCache();
    resetHub();
    const info = await boot();
    S.info = { ...S.info, meta: info.meta };
    askEngine.invalidate();
    updateStatus();
    if (S.view) {
      const model = await S.view.load();
      S.model = model;
      await update(route().params);
    }
    const changed = (info.meta?.generated_at || '') !== before;
    if (changed && !manual) {
      toast(`Data terbaru masuk (${fmt.date((info.meta.generated_at || '').slice(0, 10))} pukul ${(info.meta.generated_at || '').slice(11, 16).replace(':', '.')}). Panel sudah diperbarui.`);
      askDialog?.notifyData('Data baru masuk. Jawaban berikutnya memakai data terbaru.');
    } else if (manual) {
      toast(changed ? 'Data terbaru dimuat' : 'Data sudah yang terbaru');
    }
  } catch (err) {
    if (manual) showError(err);
    else console.warn(err);
  } finally {
    S.refreshing = false;
  }
}

function reload() {
  refreshData({ manual: true });
}

function showError(err) {
  console.error(err);
  if (err instanceof AuthError) { reauth(err.message); return; }
  if (err instanceof AccessError) { showAccessDenied(err); return; }
  S.board?.destroy();
  S.board = null;
  S.model = null;
  $('filters').innerHTML = '';
  $('board').removeAttribute('aria-busy');
  $('board').innerHTML = `<div class="fatal" role="alert"><h2>Data belum bisa ditampilkan</h2><p>${esc(err?.message || err)}</p>
    <button class="btn primary" type="button" id="retry">Coba lagi</button></div>`;
  $('retry').addEventListener('click', () => {
    if (!S.info?.meta) { location.reload(); return; }
    clearCache();
    mount(route());
  });
}

function layoutFor(view) {
  const saved = readLayout(view.id, S.info?.layouts);
  const valid = (saved || []).filter((i) => view.widgets[i.id] && [i.x, i.y, i.w, i.h].every(Number.isFinite));
  return valid.length ? valid : view.layout.map((i) => ({ ...i }));
}

function runCleanup(id) {
  for (const fn of S.cleanups.get(id) || []) { try { fn(); } catch {} }
  S.cleanups.delete(id);
}

function destroyWidget(id) {
  runCleanup(id);
  destroyCharts(`${S.view.id}-${id}-`);
}

function renderWidget(id, el) {
  const view = S.view;
  const def = view.widgets[id];
  runCleanup(id);
  destroyCharts(`${view.id}-${id}-`);
  const old = el.querySelector('.panel-body');
  const body = old.cloneNode(false);
  old.replaceWith(body);
  body.inert = !!S.board?.editing;
  const sub = el.querySelector('.panel-desc');
  const h2 = el.querySelector('.panel-title h2');
  const meta = el.querySelector('.panel-stats');
  const tools = el.querySelector('.panel-tools');
  sub.textContent = '';
  h2.removeAttribute('title');
  if (meta) meta.innerHTML = '';
  tools.innerHTML = '';
  if (!S.ctx) {
    el.setAttribute('aria-busy', 'true');
    body.innerHTML = '<div class="skel" aria-hidden="true"><i></i><i></i><i></i></div>';
    return;
  }
  el.removeAttribute('aria-busy');
  const api = {
    ctx: S.ctx, body, id, meta: S.info?.meta || null,
    cid: (k) => `${view.id}-${id}-${k}`,
    sub: (t) => { sub.textContent = t; if (t) h2.title = t; },
    set: setParams,
    go,
    focus: focusWidget,
    cleanup: (fn) => { if (!S.cleanups.has(id)) S.cleanups.set(id, []); S.cleanups.get(id).push(fn); },
    tools({ table = null, png = null, copy = null } = {}) {
      tools.innerHTML = `${copy ? `<button class="icon-btn sm" type="button" data-t="copy" title="Salin sebagai teks" aria-label="Salin ${esc(def.title)} sebagai teks">${icon('copy', 16)}</button>` : ''}
        ${table ? `<button class="icon-btn sm" type="button" data-t="table" title="Lihat tabel data" aria-label="Lihat tabel data ${esc(def.title)}">${icon('table', 16)}</button>` : ''}
        ${png ? `<button class="icon-btn sm" type="button" data-t="png" title="Unduh gambar" aria-label="Unduh gambar ${esc(def.title)}">${icon('download', 16)}</button>` : ''}`;
      tools.querySelector('[data-t="copy"]')?.addEventListener('click', () => copyText(copy(), 'Teks siap ditempel ke email atau chat'));
      tools.querySelector('[data-t="table"]')?.addEventListener('click', () => openTable(table()));
      tools.querySelector('[data-t="png"]')?.addEventListener('click', () => downloadPng(png, `${def.title} ${view.title}`));
    },
  };
  try {
    def.render(api);
    const st = body.querySelector(':scope > .stats');
    if (st && meta) meta.appendChild(st);
  } catch (err) {
    console.error(err);
    body.innerHTML = emptyState('Panel ini gagal ditampilkan', err?.message || '');
  }
}

function focusWidget(id) {
  const el = S.board?.els.get(id);
  if (!el) {
    const d = S.view.widgets[id];
    toast(`Panel ${d ? d.title : id} sedang disembunyikan. Tampilkan lewat Atur panel.`);
    return;
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash');
  requestAnimationFrame(() => el.classList.add('flash'));
  setTimeout(() => el.classList.remove('flash'), 1400);
}

function onStack(e) {
  const stack = !!e.detail;
  const btn = $('edit');
  btn.disabled = stack;
  btn.title = stack ? 'Atur panel tersedia di layar yang lebih lebar' : '';
  if (stack && S.editing) setEditing(false);
}

function setEditing(on) {
  if (!S.board) { S.editing = false; return; }
  if (on === S.editing) return;
  if (on && S.board.stack) { toast('Atur panel tersedia di layar yang lebih lebar.'); return; }
  S.editing = on;
  document.body.classList.toggle('is-editing', on);
  setRail();
  S.board.setEditing(on);
  $('edit').setAttribute('aria-pressed', String(on));
  $('edit-bar').hidden = !on;
  $('filters').hidden = on;
  $('palette').hidden = !on;
  if (on) {
    renderPalette();
    announce('Mode atur panel aktif. Seret panel atau pakai tombol panah pada ikon titik di kiri judul panel.');
    $('done').focus({ preventScroll: true });
  } else {
    announce('Mode atur panel selesai');
    $('edit').focus({ preventScroll: true });
    if (S.pendingData) {
      const v = S.pendingData;
      S.pendingData = '';
      refreshData({ version: v === 'manual' ? '' : v, manual: v === 'manual' });
    }
  }
}

function renderPalette() {
  if (!S.board) return;
  const hidden = S.board.hidden();
  $('palette-count').textContent = hidden.length ? `(${hidden.length})` : '';
  $('palette-list').innerHTML = hidden.length
    ? hidden.map((id) => {
      const d = S.view.widgets[id];
      return `<li class="palette-item" data-id="${id}">
        <span class="palette-icon">${icon(d.icon || 'grid', 18)}</span>
        <span class="palette-text"><b>${esc(d.title)}</b><small>${esc(d.desc || '')}</small></span>
        <button class="palette-add" type="button" data-add="${id}" aria-label="Tambah panel ${esc(d.title)}" title="Tambah ke papan">${icon('plus', 16)}</button></li>`;
    }).join('')
    : '<li class="palette-empty">Semua panel sudah tampil. Sembunyikan panel dengan tombol × di pojok panel untuk memindahkannya ke sini.</li>';
}

function onCommit(items, info) {
  if (info.reason !== 'undo' && info.before) {
    S.history.push(info.before);
    if (S.history.length > 40) S.history.shift();
  }
  updateUndo();
  renderPalette();
  scheduleSave();
  if (info.reason === 'remove') {
    const d = S.view.widgets[info.id];
    toast(`Panel ${d.title} disembunyikan`, { label: 'Urungkan', run: undo });
  }
}

function updateUndo() { $('undo').disabled = !S.history.length; }

function undo() {
  const prev = S.history.pop();
  if (!prev || !S.board) return;
  S.board.apply(prev, { reason: 'undo' });
  announce('Perubahan terakhir dibatalkan');
}

function resetLayout() {
  if (!S.board) return;
  S.board.apply(compact(S.view.layout.map((i) => ({ ...i }))), { reason: 'reset' });
  toast('Tata letak awal dipulihkan', { label: 'Urungkan', run: undo });
}

function setSave(state, err) {
  const el = $('save');
  clearTimeout(el._t);
  el.className = `save ${state}`;
  if (state === 'saving') el.innerHTML = '<i class="spin" aria-hidden="true"></i>Menyimpan';
  if (state === 'saved') {
    el.innerHTML = `${icon('check', 15)}Tersimpan`;
    el._t = setTimeout(() => { el.className = 'save'; el.textContent = ''; }, 2600);
  }
  if (state === 'error') {
    el.innerHTML = `Gagal menyimpan <button type="button" class="link" id="save-retry">Coba lagi</button>`;
    el.title = err?.message || '';
    $('save-retry').addEventListener('click', scheduleSave);
  }
}

function scheduleSave() {
  if (!S.board) return;
  const view = S.view;
  const items = S.board.items.map((i) => ({ ...i }));
  setSave('saving');
  clearTimeout(S.saveTimer);
  S.saveTimer = setTimeout(async () => {
    try {
      await writeLayout(view.id, items, S.info?.layouts);
      setSave('saved');
    } catch (err) {
      setSave('error', err);
    }
  }, 700);
}

function showAccessDenied(err) {
  const api = MODE === 'api';
  $('app').innerHTML = `<main class="gate" role="alert">
    <span class="gate-ico">${icon('lock', 28)}</span>
    <h1>Akses belum diberikan</h1>
    <p>${esc(err.message)} ${api
    ? 'Minta pemilik dashboard menambahkan email Google Anda ke daftar akses, atau masuk dengan akun lain.'
    : 'Minta pemilik dashboard menambahkan email Google Anda sebagai <b>Viewer</b> di spreadsheet data agregat, lalu muat ulang halaman ini.'}</p>
    <div class="gate-act">${api ? '<button class="btn primary" type="button" id="view-switch">Masuk dengan akun lain</button>' : ''}
      <button class="btn${api ? '' : ' primary'}" type="button" id="reload-after-error">Muat ulang</button></div></main>`;
  $('reload-after-error').addEventListener('click', () => location.reload());
  $('view-switch')?.addEventListener('click', () => login({ switchAccount: true }));
}

function showLogin(message = '') {
  $('app').innerHTML = `<main class="gate">
    <span class="gate-ico">${icon('logo', 28)}</span>
    <h1>KPR Analytics</h1>
    <p>Dashboard internal. Masuk dengan akun Google yang sudah didaftarkan pemilik dashboard.</p>
    ${message ? `<p class="gate-msg" role="alert">${esc(message)}</p>` : ''}
    <div class="gate-act"><button class="btn primary" type="button" id="login">${icon('mail', 17)}Masuk dengan Google</button></div>
    <p class="gate-note">${icon('lock', 14)}Data baru dikirim setelah server memeriksa login dan email Anda.</p></main>`;
  $('login').addEventListener('click', () => login());
  $('login').focus();
}

function reauth(message) {
  let tried = false;
  try { tried = sessionStorage.getItem('kpr.auth.silent') === '1'; } catch {}
  if (hasHint() && !tried) {
    try { sessionStorage.setItem('kpr.auth.silent', '1'); } catch {}
    login({ silent: true });
    return;
  }
  showLogin(message);
}

async function fontsReady() {
  await Promise.race([document.fonts?.ready || Promise.resolve(), new Promise((r) => { setTimeout(r, 1500); })]);
}

async function start() {
  if (MODE === 'api') {
    const r = handleRedirect();
    if (r.status === 'ok') { try { sessionStorage.removeItem('kpr.auth.silent'); } catch {} }
    if (!session()) {
      let msg = '';
      try { msg = sessionStorage.getItem('kpr.auth.msg') || ''; sessionStorage.removeItem('kpr.auth.msg'); } catch {}
      if (r.status === 'none' && !msg) { reauth(''); return; }
      showLogin(msg || r.message || '');
      return;
    }
  }
  renderShell();
  try {
    S.info = await boot();
  } catch (err) {
    if (err instanceof AccessError) { showAccessDenied(err); return; }
    if (err instanceof AuthError) { reauth(err.message); return; }
    S.info = { meta: null, layouts: MODE === 'local' ? null : {}, email: '' };
    showError(err);
    return;
  }
  updateStatus();
  S.live = startLive({
    current: () => S.info?.meta?.generated_at || '',
    onUpdate: (version) => refreshData({ version }),
    onState: (st) => { S.liveState = st; updateFreshness(); },
  });
  document.addEventListener('pointermove', () => document.body.classList.remove('tips-off'), { passive: true });
  const r = await initRouter(onRoute);
  await fontsReady();
  mount(r);
}

start();
