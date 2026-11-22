import { esc } from '../core/format.js';
import { icon } from '../core/icons.js';
import { voiceSupport, createRecognizer, speak, hush, createLevel } from './speech.js';
import { routeCommand, findWake, cleanSpoken, spoken, shortRo, WAKE_NAME, WAKE_PHRASE } from './command.js';
import { regionData, showcaseHtml, regionSpeech, flyIn } from './showcase.js';

const PREF_KEY = 'kpr.atlas';
const FOLLOW_MS = 9000;
const ECHO_MS = 450;
const DETAIL_NAME = {
  os: 'Outstanding', deb: 'Debitur', sml: 'SML', npl: 'NPL', disb: 'Disburse', real: 'Realisasi',
  split: 'Fix Income dan Non Fix Income', sla: 'Berkas SLA', history: 'riwayat bulanan', watch: 'semua RO',
};
const HINTS = ['Lihat Bandung', 'RO mana yang perlu perhatian?', 'Buka realisasi', 'NPL Jakarta 1 berapa?'];
const HELP = [
  ['Kondisi satu regional', ['Lihat Bandung', 'Gimana Jakarta 2?']],
  ['Buka detail', ['Buka realisasi', 'Detail NPL Surabaya']],
  ['Tanya angka', ['RO mana yang perlu perhatian?', 'Disburse Medan bulan ini berapa?']],
  ['Atur dashboard', ['Fokus ke Makassar', 'Kembali ke nasional', '5 sumber']],
];
const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 1 0-7 0v6A3.5 3.5 0 0 0 12 15Z"/><path d="M18.5 11.5a6.5 6.5 0 0 1-13 0M12 18v3.5"/></svg>';
const SOUND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';

const readPref = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; } };
const writePref = (p) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch {} };

const ERRORS = {
  'not-allowed': 'Mikrofon belum diizinkan. Klik ikon di kiri alamat situs, izinkan Mikrofon, lalu coba lagi.',
  'service-not-allowed': 'Browser menolak layanan suara. Pakai Chrome atau Edge terbaru, atau ketik perintah.',
  'audio-capture': 'Mikrofon tidak ditemukan. Sambungkan mikrofon atau ketik perintah.',
  network: 'Pengenal suara butuh koneksi internet. Sementara, ketik perintah di bawah.',
  'language-not-supported': 'Browser ini belum mengenali bahasa Indonesia untuk suara. Ketik perintah di bawah.',
  unsupported: 'Browser ini belum mendukung perintah suara. Pakai Chrome atau Edge, atau ketik perintah di bawah.',
  start: 'Mikrofon sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.',
};

export function createAtlas({ engine, getContext, set, openDetail, closeDetail }) {
  const pref = { wake: false, mute: false, ...readPref() };
  let dlg = null;
  let launcher = null;
  let phase = 'idle';
  let mode = 'off';
  let speakingUntil = 0;
  let followUntil = 0;
  let followTimer = 0;
  let restartTimer = 0;
  let quickEnds = 0;
  let attached = false;
  let busy = 0;
  let showing = '';
  const $ = (id) => dlg?.querySelector(`#${id}`);
  let orbEl = null;
  const level = createLevel((v) => orbEl?.style.setProperty('--lvl', v.toFixed(3)));
  const rec = createRecognizer({ onResult, onEnd, onError, onStart: () => { quickEnds = 0; } });

  function build() {
    if (dlg) return;
    dlg = document.createElement('dialog');
    dlg.className = 'atlas';
    dlg.id = 'atlas';
    dlg.setAttribute('aria-label', `${WAKE_NAME}, asisten suara`);
    dlg.innerHTML = `
      <div class="atl-top">
        <button class="atl-pill" type="button" id="atl-wake" aria-pressed="false">${MIC}<span>Mode dengar "${esc(WAKE_PHRASE)}"</span></button>
        <button class="atl-pill" type="button" id="atl-mute" aria-pressed="true">${SOUND}<span>Jawab dengan suara</span></button>
        <button class="atl-x" type="button" id="atl-close" aria-label="Tutup ${esc(WAKE_NAME)}">${icon('close')}</button>
      </div>
      <div class="atl-stage" id="atl-stage"></div>
      <div class="atl-dock">
        <p class="atl-heard" id="atl-heard" aria-live="polite"></p>
        <button class="atl-orb" type="button" id="atl-orb" aria-label="Bicara ke ${esc(WAKE_NAME)}">
          <span class="halo" aria-hidden="true"></span>
          <span class="blob" aria-hidden="true"><span class="swirl"></span><span class="eyes"><i></i><i></i></span></span>
        </button>
        <p class="atl-status" id="atl-status" role="status"></p>
        <form class="atl-type" id="atl-type">
          <input id="atl-input" type="text" autocomplete="off" enterkeyhint="send" placeholder="Ketik perintah, misalnya: lihat Bandung" aria-label="Perintah untuk ${esc(WAKE_NAME)}">
          <button type="submit" aria-label="Kirim">${icon('send', 16)}</button>
        </form>
        <div class="atl-hints" id="atl-hints">${HINTS.map((h) => `<button type="button" data-say="${esc(h)}">${esc(h)}</button>`).join('')}</div>
      </div>`;
    document.body.append(dlg);
    orbEl = $('atl-orb');
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.id === 'atl-stage') { close(); return; }
      const sayBtn = e.target.closest('[data-say]');
      if (sayBtn) { handle(sayBtn.dataset.say, { typed: true }); return; }
      const f = e.target.closest('[data-atl-filter]');
      if (f) { set({ ro: f.dataset.atlFilter }); close(); return; }
      const ro = e.target.closest('[data-atl-ro]');
      if (ro) showRegion(ro.dataset.atlRo);
    });
    $('atl-close').addEventListener('click', close);
    $('atl-orb').addEventListener('click', () => (phase === 'listen' ? stopListening() : listen()));
    $('atl-wake').addEventListener('click', () => setWake(!pref.wake, true));
    $('atl-mute').addEventListener('click', () => setMute(!pref.mute));
    $('atl-type').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('atl-input').value.trim();
      $('atl-input').value = '';
      if (v) handle(v, { typed: true });
    });
    syncPills();
  }

  function syncPills() {
    if (dlg) {
      $('atl-wake').setAttribute('aria-pressed', String(pref.wake));
      $('atl-mute').setAttribute('aria-pressed', String(!pref.mute));
      $('atl-wake').hidden = !voiceSupport.listen;
      $('atl-mute').hidden = !voiceSupport.speak;
    }
    if (launcher) {
      launcher.classList.toggle('is-wake', pref.wake && mode === 'wake');
      const t = launcher.querySelector('.t small');
      if (t) t.textContent = pref.wake && mode === 'wake' ? `dengar "${WAKE_PHRASE}"` : 'Ctrl+Spasi';
      launcher.title = pref.wake ? `Ucapkan "${WAKE_PHRASE}" atau klik (Ctrl+Spasi)` : `Bicara ke ${WAKE_NAME} (Ctrl+Spasi)`;
    }
  }

  function setPhase(next, text = '') {
    phase = next;
    if (!dlg) return;
    dlg.dataset.state = next;
    if (next === 'listen' && dlg.open && voiceSupport.level) level.start();
    const idleText = !voiceSupport.listen ? ERRORS.unsupported
      : pref.wake ? `Ucapkan "${WAKE_PHRASE}" atau klik bola untuk bicara` : 'Klik bola atau tekan Ctrl+Spasi untuk bicara';
    $('atl-status').textContent = text || { listen: 'Mendengarkan', think: 'Sebentar', speak: '', idle: idleText, error: '' }[next] || '';
  }

  const isOpen = () => !!dlg?.open;

  function open({ listenNow = true, focusInput = false } = {}) {
    build();
    if (!dlg.open) {
      dlg.showModal();
      dlg.dataset.stage = showing ? 'show' : 'empty';
    }
    setPhase(phase === 'think' ? 'think' : 'idle');
    if (focusInput || !voiceSupport.listen) $('atl-input').focus();
    else $('atl-orb').focus({ preventScroll: true });
    if (listenNow && voiceSupport.listen) listen();
  }

  function close() {
    if (!dlg?.open) return;
    hush();
    speakingUntil = 0;
    clearTimeout(followTimer);
    followUntil = 0;
    level.stop();
    if (mode === 'command') { rec.abort(); mode = 'off'; }
    dlg.close();
    clearStage();
    $('atl-heard').textContent = '';
    setPhase('idle');
    if (pref.wake) startWake();
    syncPills();
  }

  function clearStage() {
    showing = '';
    if (!dlg) return;
    $('atl-stage').innerHTML = '';
    dlg.dataset.stage = 'empty';
  }

  function listen() {
    if (!voiceSupport.listen) { setPhase('error', ERRORS.unsupported); return; }
    hush();
    speakingUntil = 0;
    follow();
    if (pref.wake) {
      if (mode !== 'wake' || !rec.active) startWake();
      setPhase('listen');
      return;
    }
    mode = 'command';
    if (rec.start({ continuous: false })) setPhase('listen');
  }

  function stopListening() {
    followUntil = 0;
    if (mode === 'command') { rec.abort(); mode = 'off'; }
    setPhase('idle');
  }

  function follow() {
    clearTimeout(followTimer);
    followUntil = Date.now() + FOLLOW_MS;
    followTimer = setTimeout(() => { if (phase === 'listen' && pref.wake) setPhase('idle'); }, FOLLOW_MS);
  }

  function startWake() {
    clearTimeout(restartTimer);
    if (!pref.wake || !voiceSupport.listen || !attached || document.visibilityState !== 'visible') { syncPills(); return; }
    mode = 'wake';
    rec.start({ continuous: true });
    syncPills();
  }

  function stopWake() {
    clearTimeout(restartTimer);
    if (mode === 'wake') rec.abort();
    mode = 'off';
    syncPills();
  }

  function setWake(on, fromUser = false) {
    pref.wake = !!on && voiceSupport.listen;
    writePref(pref);
    if (pref.wake) {
      startWake();
      if (isOpen()) setPhase(phase === 'listen' ? 'listen' : 'idle');
      if (fromUser) reply(`Mode dengar menyala. Panggil saya dengan "${WAKE_PHRASE}".`);
    } else {
      stopWake();
      if (isOpen()) setPhase('idle');
      if (fromUser) reply('Mode dengar dimatikan. Klik bola kalau mau bicara.');
    }
    syncPills();
  }

  function setMute(on) {
    pref.mute = !!on;
    writePref(pref);
    if (pref.mute) hush();
    syncPills();
  }

  function onResult({ text, final }) {
    if (Date.now() < speakingUntil) return;
    if (mode === 'wake') {
      const wake = findWake(text);
      if (!isOpen()) {
        if (!wake) return;
        open({ listenNow: false });
        setPhase('listen');
        follow();
        if (wake.rest) showHeard(wake.rest, final);
        if (final && wake.rest) handle(wake.rest);
        return;
      }
      const cmd = wake ? wake.rest : text;
      if (wake) { follow(); if (phase !== 'think') setPhase('listen'); }
      if (!wake && Date.now() > followUntil) return;
      if (!cmd) return;
      showHeard(cmd, final);
      if (final) handle(cmd);
      return;
    }
    if (mode === 'command') {
      showHeard(text, final);
      if (final) { mode = 'off'; rec.abort(); handle(text); }
    }
  }

  function onEnd() {
    if (mode === 'wake') {
      quickEnds += 1;
      const wait = quickEnds > 4 ? Math.min(30000, 1000 * 2 ** (quickEnds - 4)) : 250;
      clearTimeout(restartTimer);
      restartTimer = setTimeout(startWake, wait);
      return;
    }
    if (mode === 'command') {
      mode = 'off';
      if (phase === 'listen') setPhase('idle', 'Tidak terdengar perintah. Klik bola dan bicara lagi.');
    }
  }

  function onError(err) {
    if (err === 'aborted') return;
    if (err === 'no-speech') {
      if (mode === 'command') { mode = 'off'; setPhase('idle', 'Tidak terdengar suara. Klik bola dan bicara lagi.'); }
      return;
    }
    if (err === 'network' && mode === 'wake') { quickEnds += 2; if (isOpen()) setPhase('error', ERRORS.network); return; }
    if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture' || err === 'unsupported' || err === 'language-not-supported') {
      if (pref.wake) { pref.wake = false; writePref(pref); }
      stopWake();
    }
    mode = 'off';
    if (!isOpen()) build();
    if (!isOpen() && err !== 'network') open({ listenNow: false, focusInput: true });
    setPhase('error', ERRORS[err] || 'Suara belum bisa diproses. Ketik perintah di bawah.');
  }

  function showHeard(text, final) {
    if (!dlg) return;
    const el = $('atl-heard');
    el.textContent = text ? `“${text}”` : '';
    el.classList.toggle('final', !!final);
  }

  function say(text, { after } = {}) {
    if (!text || pref.mute || !voiceSupport.speak) { done(); return; }
    setPhase('speak');
    speakingUntil = Date.now() + 60000;
    speak(spoken(text), {
      onEnd: () => {
        speakingUntil = Date.now() + ECHO_MS;
        done();
      },
    });
    function done() {
      after?.();
      if (!isOpen()) return;
      if (pref.wake && voiceSupport.listen) { follow(); setPhase('listen'); } else setPhase('idle');
    }
  }

  function reply(html, { title = '', chips = [], lines = [], speakText } = {}) {
    build();
    showing = '';
    const stage = $('atl-stage');
    stage.innerHTML = `<article class="atl-card atl-answer in">
      ${title ? `<p class="atl-code">${esc(title)}</p>` : ''}<h2>${html}</h2>
      ${lines.map((l) => `<p>${l}</p>`).join('')}
      ${chips.length ? `<dl class="atl-facts">${chips.map((c) => `<div><dt>${esc(c.k)}</dt><dd>${esc(c.v)}</dd></div>`).join('')}</dl>` : ''}
    </article>`;
    dlg.dataset.stage = 'show';
    say(speakText ?? html);
  }

  function helpCard() {
    build();
    showing = '';
    $('atl-stage').innerHTML = `<article class="atl-card atl-answer atl-help in"><p class="atl-code">${esc(WAKE_NAME)}</p>
      <h2>Ucapkan atau ketik perintah seperti ini</h2>
      <div class="atl-help-grid">${HELP.map(([t, items]) => `<section><h3>${esc(t)}</h3>${items.map((i) => `<button type="button" data-say="${esc(i)}">${esc(i)}</button>`).join('')}</section>`).join('')}</div>
      <p class="atl-note">${voiceSupport.listen ? `Nyalakan mode dengar di kanan atas supaya cukup bilang "${esc(WAKE_PHRASE)}" tanpa klik.` : 'Browser ini hanya bisa perintah ketik.'} Tutup dengan Esc atau bilang "tutup".</p></article>`;
    dlg.dataset.stage = 'show';
    say('Saya bisa menampilkan kondisi satu regional, membuka detail, menjawab pertanyaan angka, dan mengatur dashboard.');
  }

  function showRegion(ro) {
    const c = getContext();
    if (!c || !ro) return;
    const d = regionData(c, ro);
    if (!d.now?.end) { reply(`Data ${esc(shortRo(ro))} belum ada.`); return; }
    build();
    showing = ro;
    const stage = $('atl-stage');
    stage.innerHTML = showcaseHtml(d);
    dlg.dataset.stage = 'show';
    flyIn(stage, $('atl-orb'));
    say(regionSpeech(d));
  }

  async function handle(text, { typed = false } = {}) {
    const ticket = ++busy;
    if (!isOpen()) open({ listenNow: false, focusInput: typed });
    if (mode === 'command') { rec.abort(); mode = 'off'; }
    showHeard(text, true);
    setPhase('think');
    const c = getContext();
    const regions = c?.pm?.regions || [];
    let q = null;
    try { q = await engine.parse(cleanSpoken(text, regions)); } catch (err) { console.warn(err); }
    if (ticket !== busy) return;
    const cmd = routeCommand(text, { q, regions });
    switch (cmd.type) {
      case 'none': setPhase('idle'); return;
      case 'close': hush(); closeDetail(); close(); return;
      case 'thanks': reply('Sama-sama.', { speakText: 'Sama-sama.' }); return;
      case 'wakeOff': setWake(false, true); return;
      case 'wakeOn': setWake(true, true); return;
      case 'mute': setMute(true); reply('Suara jawaban dimatikan. Jawaban tetap tampil di layar.'); return;
      case 'unmute': setMute(false); reply('Suara jawaban menyala lagi.'); return;
      case 'help': helpCard(); return;
      case 'greet': reply('Halo. Mau lihat apa?', { lines: ['Contoh: "lihat Bandung", "buka realisasi", atau "RO mana yang perlu perhatian?"'] }); return;
      case 'sumber': set({ sumber: cmd.mode === '7' ? '' : cmd.mode }); reply(`Realisasi sekarang memakai ${esc(cmd.mode)} sumber.`); return;
      case 'nasional': set({ ro: '' }); clearStage(); reply('Dashboard kembali ke Nasional.'); return;
      case 'filter': set({ ro: cmd.ro }); say(`Dashboard difokuskan ke ${shortRo(cmd.ro)}.`, { after: close }); return;
      case 'detail': {
        const name = DETAIL_NAME[cmd.id] || 'detail';
        close();
        openDetail(cmd.id, cmd.ro);
        say(`Ini detail ${name}${cmd.ro ? ` ${shortRo(cmd.ro)}` : ''}.`);
        return;
      }
      case 'region': showRegion(cmd.ro); return;
      default: break;
    }
    try {
      const { a, q: asked } = await engine.ask(cmd.text || text, { context: { ro: showing || c?.sel?.ro || '' } });
      if (ticket !== busy) return;
      const ros = (asked?.entities?.ro || []).filter((r) => regions.includes(r));
      const lines = (a.lines || []).slice(0, 3);
      const chips = (a.chips || []).filter((x) => x && x.k && x.v && !['Catatan', 'Sumber'].includes(x.k)).slice(0, 6);
      reply(a.title || 'Belum ada jawaban.', { lines, chips });
      if (ros.length === 1 && a.ok !== false) {
        $('atl-stage').querySelector('.atl-answer')?.insertAdjacentHTML('beforeend', `<p class="atl-more"><button type="button" data-atl-ro="${esc(ros[0])}">Lihat kondisi ${esc(shortRo(ros[0]))}</button></p>`);
      }
    } catch (err) {
      console.error(err);
      reply('Maaf, jawaban belum bisa dihitung. Coba ulangi dengan kata lain.');
    }
  }

  function onKey(e) {
    if (!attached) return;
    if (e.code === 'Space' && e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (isOpen() && phase === 'listen') stopListening();
      else open({ listenNow: true });
    }
  }

  function onVisible() {
    if (!attached) return;
    if (document.visibilityState === 'visible') { if (pref.wake && mode !== 'wake' && !isOpen()) startWake(); }
    else { hush(); if (mode === 'wake') stopWake(); }
  }

  return {
    attach(button) {
      launcher = button;
      if (!attached) {
        attached = true;
        document.addEventListener('keydown', onKey);
        document.addEventListener('visibilitychange', onVisible);
        if (pref.wake) startWake();
      }
      button?.addEventListener('click', () => open({ listenNow: true }));
      syncPills();
    },
    detach() {
      attached = false;
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisible);
      close();
      stopWake();
      rec.abort();
      launcher = null;
    },
    openTyped: () => open({ listenNow: false, focusInput: true }),
    run: (text) => handle(text, { typed: true }),
    get state() { return { phase, mode, wake: pref.wake, mute: pref.mute, open: isOpen(), showing }; },
  };
}
