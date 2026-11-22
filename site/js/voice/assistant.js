import { esc } from '../core/format.js';
import { icon } from '../core/icons.js';
import { ok } from '../core/values.js';
import { checkSmooth } from '../core/smooth.js';
import { speakRemote } from '../services/data-source.js';
import { roStanding } from '../models/direktur-model.js';
import { voiceSupport, createRecognizer, speak, hush, createLevel, chime, setCloudSpeaker, setVoiceChoice, setRate, nextVoice, usingCloud } from './speech.js';
import { routeCommand, findWake, cleanSpoken, spoken, shortRo, WAKE_NAME, WAKE_PHRASE } from './command.js';
import { regionData, showcaseHtml, regionTalk, compareHtml, compareTalk, flyIn } from './showcase.js';

const PREF_KEY = 'kpr.assistant';
const FOLLOW_MS = 9000;
const ECHO_MS = 450;
const EARLY_MS = 650;
const MOOD_MS = 2400;
const SLEEP_MS = 30000;
const QUICK = new Set(['bye', 'pageUnknown', 'region', 'detail', 'close', 'filter', 'nasional', 'sumber', 'wakeOff', 'wakeOn', 'mute', 'unmute', 'thanks', 'help', 'yes', 'no', 'hush', 'compare', 'brief', 'page', 'menu', 'back', 'nextRo', 'prevRo', 'repeat', 'slower', 'faster', 'voice', 'praise', 'rankShow']);
const DETAIL_NAME = {
  os: 'outstanding', deb: 'debitur', sml: 'SML', npl: 'NPL', disb: 'disburse', real: 'realisasi',
  split: 'Fix Income dan Non Fix Income', sla: 'berkas SLA', history: 'riwayat bulanan', watch: 'semua RO',
};
const PAGE_NAME = { ringkasan: 'Summary', performance: 'Performance', realisasi: 'Realisasi', portofolio: 'Portofolio', sla: 'SLA', direktur: 'Direktur' };
const HINTS = ['Briefing hari ini', 'Lihat Bandung', 'Bandingkan Bandung dan Surabaya', 'RO mana yang perlu perhatian?'];
const HELP = [
  ['Kondisi wilayah', ['Briefing hari ini', 'Lihat Bandung', 'Gimana Jakarta 2?', 'Tampilkan RO terburuk']],
  ['Bandingkan', ['Bandingkan Bandung dan Surabaya', 'Medan vs Makassar', 'Bandingkan NPL Jakarta 1 dan Jakarta 2']],
  ['Buka detail', ['Buka realisasi', 'Detail NPL Surabaya', 'Riwayat 3 bulan', 'Semua RO']],
  ['Tanya angka', ['NPL Bandung bulan lalu?', 'Top 5 kanca realisasi bulan ini', 'RO dengan NPL di atas 4 persen', 'Kenapa OS naik bulan lalu?', 'Kalau disburse naik 15 persen bulan depan?', 'Berapa berkas lewat SLA?']],
  ['Atur dashboard', ['Fokus ke Makassar', 'Kembali ke nasional', '5 sumber', 'Buka halaman realisasi', 'Refresh data']],
  ['Ngobrol', ['Ulangi', 'Lebih pelan', 'Ganti suara', 'Berikutnya', 'Kembali', 'Tutup']],
];
const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 1 0-7 0v6A3.5 3.5 0 0 0 12 15Z"/><path d="M18.5 11.5a6.5 6.5 0 0 1-13 0M12 18v3.5"/></svg>';
const SOUND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const HEART = '<svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21.2S1.6 14.9 1.6 7.6A5.6 5.6 0 0 1 12 4.9a5.6 5.6 0 0 1 10.4 2.7c0 7.3-10.4 13.6-10.4 13.6Z"/></svg>';
const ERRORS = {
  'not-allowed': 'Mikrofon belum diizinkan. Klik ikon di kiri alamat situs, izinkan Mikrofon, lalu coba lagi.',
  'service-not-allowed': 'Browser menolak layanan suara. Pakai Chrome atau Edge terbaru, atau ketik perintah.',
  'audio-capture': 'Mikrofon tidak ditemukan. Sambungkan mikrofon atau ketik perintah.',
  network: 'Pengenal suara butuh koneksi internet. Sementara, ketik perintah di bawah.',
  'language-not-supported': 'Browser ini belum mengenali bahasa Indonesia untuk suara. Ketik perintah di bawah.',
  unsupported: 'Browser ini belum mendukung perintah suara. Pakai Chrome atau Edge, atau ketik perintah di bawah.',
  start: 'Mikrofon sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.',
};

const readPref = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; } };
const writePref = (p) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch {} };
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
const salam = () => {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
};
const sameText = (a, b) => {
  const x = String(a || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const y = String(b || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  return !!x && !!y && (x === y || y.startsWith(x) || x.startsWith(y));
};

const ARC = '<svg class="c" viewBox="0 0 20 10" aria-hidden="true"><path d="M3.5 8.5Q10 -.5 16.5 8.5"/></svg>';
const LIP = `<svg class="lip" viewBox="0 0 30 15" aria-hidden="true"><path class="smile" d="M8.5 3.5Q15 12.5 21.5 3.5"/><path class="grin" d="M6 2.5Q15 17 24 2.5"/><path class="frown" d="M9.5 10.5Q15 3 20.5 10.5"/><path class="flat" d="M11 7.5H19"/></svg>`;
export const orbHtml = () => `<span class="blob" aria-hidden="true"><span class="swirl"></span><span class="face">
  <span class="eye"><i class="o"></i>${ARC}<i class="h">${HEART}</i></span><span class="eye"><i class="o"></i>${ARC}<i class="h">${HEART}</i></span>
  <span class="cheek"></span><span class="cheek"></span>
  <span class="mouth">${LIP}<i class="talk"></i><i class="round"></i></span></span></span>`;

const FX = `<span class="fx" aria-hidden="true"><i class="q">?</i><i class="zz">z</i><i class="zz">z</i><i class="sp"></i><i class="sp"></i><i class="sp"></i><i class="sp"></i>
  <i class="hrt">${HEART}</i><i class="hrt">${HEART}</i><i class="tear"></i><span class="dots"><b></b><b></b><b></b></span></span>`;

function revealWords(el) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let n = 0;
  for (const node of nodes) {
    const parts = node.textContent.split(/(\s+)/);
    const frag = document.createDocumentFragment();
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.append(part); continue; }
      const w = document.createElement('span');
      w.className = 'va-w';
      w.style.setProperty('--w', String(Math.min(n, 40)));
      w.textContent = part;
      frag.append(w);
      n += 1;
    }
    node.replaceWith(frag);
  }
}

export function createAssistant({ engine, getContext, set, openDetail, closeDetail }) {
  const pref = { wake: false, mute: false, voice: 0, rate: 1, ...readPref() };
  setVoiceChoice(pref.voice);
  setRate(pref.rate);
  setCloudSpeaker(speakRemote);
  let dlg = null;
  let launcher = null;
  let orbEl = null;
  let phase = 'idle';
  let mode = 'off';
  let speakingUntil = 0;
  let followUntil = 0;
  let followTimer = 0;
  let restartTimer = 0;
  let moodTimer = 0;
  let sleepTimer = 0;
  let quickEnds = 0;
  let attached = false;
  let busy = 0;
  let showing = '';
  let offer = null;
  let lastSpeech = '';
  let trail = [];
  let pointerRaf = 0;
  const early = { timer: 0, text: '', done: '' };
  const $ = (id) => dlg?.querySelector(`#${id}`);
  const level = createLevel((v) => orbEl?.style.setProperty('--lvl', v.toFixed(3)));
  const rec = createRecognizer({ onResult, onEnd, onError, onStart: () => { quickEnds = 0; } });
  const ding = (kind) => { if (!pref.mute) chime(kind); };
  const regions = () => getContext()?.pm?.regions || [];

  function build() {
    if (dlg) return;
    dlg = document.createElement('dialog');
    dlg.className = 'voice-assistant';
    dlg.id = 'voice-assistant';
    dlg.dataset.stage = 'empty';
    dlg.setAttribute('aria-label', `${WAKE_NAME}, asisten suara`);
    dlg.innerHTML = `
      <div class="va-top">
        <button class="va-pill" type="button" id="va-wake" aria-pressed="false">${MIC}<span>Mode dengar "${esc(WAKE_PHRASE)}"</span></button>
        <button class="va-pill" type="button" id="va-mute" aria-pressed="true">${SOUND}<span>Jawab dengan suara</span></button>
        <button class="va-x" type="button" id="va-close" aria-label="Tutup ${esc(WAKE_NAME)}">${icon('close')}</button>
      </div>
      <div class="va-stage" id="va-stage"></div>
      <div class="va-dock">
        <p class="va-heard" id="va-heard" aria-live="polite"></p>
        <button class="va-orb" type="button" id="va-orb" aria-label="Bicara ke ${esc(WAKE_NAME)}"><span class="halo" aria-hidden="true"></span>${orbHtml()}${FX}</button>
        <p class="va-status" id="va-status" role="status"></p>
        <form class="va-type" id="va-type">
          <input id="va-input" type="text" autocomplete="off" enterkeyhint="send" placeholder="Ketik perintah, misalnya: lihat Bandung" aria-label="Perintah untuk ${esc(WAKE_NAME)}">
          <button type="submit" aria-label="Kirim">${icon('send', 16)}</button>
        </form>
        <div class="va-next" id="va-next"></div>
      </div>`;
    document.body.append(dlg);
    orbEl = $('va-orb');
    suggest(HINTS);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    dlg.addEventListener('click', onClick);
    dlg.addEventListener('pointermove', onPointer, { passive: true });
    $('va-close').addEventListener('click', close);
    $('va-orb').addEventListener('click', () => (phase === 'listen' ? stopListening() : listen()));
    $('va-wake').addEventListener('click', () => setWake(!pref.wake, true));
    $('va-mute').addEventListener('click', () => setMute(!pref.mute));
    $('va-type').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('va-input').value.trim();
      $('va-input').value = '';
      if (v) handle(v, { typed: true });
    });
    $('va-input').addEventListener('input', awake);
    syncPills();
  }

  function onPointer(e) {
    if (pointerRaf) return;
    pointerRaf = requestAnimationFrame(() => {
      pointerRaf = 0;
      if (!orbEl) return;
      const r = orbEl.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / 320;
      const dy = (e.clientY - (r.top + r.height / 2)) / 320;
      orbEl.style.setProperty('--lx', Math.max(-1, Math.min(1, dx)).toFixed(3));
      orbEl.style.setProperty('--ly', Math.max(-1, Math.min(1, dy)).toFixed(3));
    });
    awake();
  }

  function onClick(e) {
    awake();
    if (e.target === dlg || e.target.id === 'va-stage') { close(); return; }
    const sayBtn = e.target.closest('[data-say]');
    if (sayBtn) { handle(sayBtn.dataset.say, { typed: true }); return; }
    const f = e.target.closest('[data-va-filter]');
    if (f) { set({ ro: f.dataset.vaFilter }); close(); return; }
    const ro = e.target.closest('[data-va-ro]');
    if (ro) { showRegion(ro.dataset.vaRo); return; }
    const pick = e.target.closest('[data-va-pick]');
    if (pick && pick.dataset.vaPick) { showRegion(pick.dataset.vaPick); return; }
    const card = e.target.closest('[data-va-open]');
    if (card && !e.target.closest('button, a')) {
      const target = showing;
      close();
      openDetail(card.dataset.vaOpen, target);
    }
  }

  function suggest(list) {
    if (!dlg) return;
    $('va-next').innerHTML = (list || []).map((h, i) => `<button type="button" data-say="${esc(h)}" style="--n:${i}">${esc(h)}</button>`).join('');
  }

  function syncPills() {
    if (dlg) {
      $('va-wake').setAttribute('aria-pressed', String(pref.wake));
      $('va-mute').setAttribute('aria-pressed', String(!pref.mute));
      $('va-wake').hidden = !voiceSupport.listen;
      $('va-mute').hidden = !voiceSupport.speak && !usingCloud();
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
    $('va-status').textContent = text || { listen: 'Mendengarkan', think: 'Sebentar ya', speak: '', idle: idleText, error: '' }[next] || '';
    if (next === 'idle') snooze();
  }

  function setMood(mood, ms = MOOD_MS) {
    if (!dlg) return;
    clearTimeout(moodTimer);
    dlg.dataset.mood = mood;
    if (mood && ms) moodTimer = setTimeout(() => { if (dlg && dlg.dataset.mood === mood) dlg.dataset.mood = ''; }, ms);
  }

  function snooze() {
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => { if (isOpen() && phase === 'idle') setMood('sleepy', 0); }, SLEEP_MS);
  }

  function awake() {
    if (dlg?.dataset.mood === 'sleepy') setMood('surprised', 900);
    snooze();
  }

  function setStage(kind) {
    if (dlg.dataset.stage !== kind) dlg.dataset.stage = kind;
  }

  const isOpen = () => !!dlg?.open;

  function open({ listenNow = true, focusInput = false } = {}) {
    build();
    if (!dlg.open) {
      dlg.showModal();
      setStage(showing || $('va-stage').childElementCount ? 'show' : 'empty');
      checkSmooth();
      setMood('surprised', 800);
    }
    if (phase !== 'think') setPhase('idle');
    if (focusInput || !voiceSupport.listen || matchMedia('(pointer: fine)').matches) $('va-input').focus({ preventScroll: true });
    else $('va-orb').focus({ preventScroll: true });
    if (listenNow && voiceSupport.listen) listen();
  }

  function close() {
    if (!dlg?.open) return;
    hush();
    speakingUntil = 0;
    clearTimeout(followTimer);
    clearTimeout(early.timer);
    clearTimeout(sleepTimer);
    followUntil = 0;
    offer = null;
    trail = [];
    level.stop();
    if (mode === 'command') { rec.abort(); mode = 'off'; }
    dlg.close();
    clearStage();
    $('va-heard').textContent = '';
    suggest(HINTS);
    setMood('');
    setPhase('idle');
    clearTimeout(sleepTimer);
    if (pref.wake) startWake();
    syncPills();
  }

  function clearStage() {
    showing = '';
    if (!dlg) return;
    $('va-stage').innerHTML = '';
    setStage('empty');
  }

  function listen() {
    if (!voiceSupport.listen) { setPhase('error', ERRORS.unsupported); return; }
    hush();
    speakingUntil = 0;
    follow();
    ding('on');
    awake();
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
    clearTimeout(early.timer);
    if (mode === 'command') { rec.abort(); mode = 'off'; }
    ding('off');
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
      if (fromUser) reply(`Mode dengar menyala. Panggil saya dengan "${esc(WAKE_PHRASE)}" kapan saja.`, { mood: 'happy' });
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

  function heardEarly(text) {
    clearTimeout(early.timer);
    early.text = text;
    early.timer = setTimeout(() => {
      const cmd = routeCommand(text, { regions: regions(), showing });
      if (!QUICK.has(cmd.type) || early.text !== text) return;
      early.done = text;
      if (mode === 'command') { mode = 'off'; rec.abort(); }
      handle(text);
    }, EARLY_MS);
  }

  function bestOf(text, alts) {
    if (!alts?.length) return text;
    const score = (t) => {
      const cmd = routeCommand(t, { regions: regions(), showing });
      return (cmd.type === 'ask' ? 0 : 2) + (cmd.ro || cmd.ros ? 1 : 0);
    };
    let best = text;
    let top = score(text);
    for (const alt of alts.slice(1)) { const s = score(alt); if (s > top + 0.5) { best = alt; top = s; } }
    return best;
  }

  function heardFinal(text, alts) {
    clearTimeout(early.timer);
    if (sameText(early.done, text)) { early.done = ''; return; }
    early.done = '';
    handle(bestOf(text, alts));
  }

  function onResult({ text, alts, final }) {
    if (Date.now() < speakingUntil) {
      if (!(final && findWake(text))) return;
      hush();
      speakingUntil = 0;
    }
    awake();
    if (mode === 'wake') {
      const wake = findWake(text);
      if (!isOpen()) {
        if (!wake) return;
        open({ listenNow: false });
        ding('on');
        setPhase('listen');
        follow();
        if (wake.rest) { showHeard(wake.rest, final); if (final) heardFinal(wake.rest); else heardEarly(wake.rest); }
        return;
      }
      const cmd = wake ? wake.rest : text;
      if (wake) { follow(); if (phase !== 'think') setPhase('listen'); setMood('surprised', 700); }
      if (!wake && Date.now() > followUntil) return;
      if (!cmd) return;
      showHeard(cmd, final);
      if (final) heardFinal(cmd, wake ? null : alts); else heardEarly(cmd);
      return;
    }
    if (mode === 'command') {
      showHeard(text, final);
      if (final) { mode = 'off'; rec.abort(); heardFinal(text, alts); } else heardEarly(text);
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
      if (phase === 'listen') { ding('off'); setPhase('idle', 'Tidak terdengar perintah. Klik bola dan bicara lagi.'); }
    }
  }

  function onError(err) {
    if (err === 'aborted') return;
    if (err === 'no-speech') {
      if (mode === 'command') { mode = 'off'; ding('off'); setPhase('idle', 'Tidak terdengar suara. Klik bola dan bicara lagi.'); }
      return;
    }
    if (err === 'network' && mode === 'wake') { quickEnds += 2; if (isOpen()) setPhase('error', ERRORS.network); return; }
    if (['not-allowed', 'service-not-allowed', 'audio-capture', 'unsupported', 'language-not-supported'].includes(err)) {
      if (pref.wake) { pref.wake = false; writePref(pref); }
      stopWake();
    }
    mode = 'off';
    if (!isOpen() && err !== 'network') open({ listenNow: false, focusInput: true });
    setMood('sad', 0);
    setPhase('error', ERRORS[err] || 'Suara belum bisa diproses. Ketik perintah di bawah.');
  }

  function showHeard(text, final) {
    if (!dlg) return;
    const el = $('va-heard');
    el.textContent = text ? `“${text}”` : '';
    el.classList.toggle('final', !!final);
  }

  function say(text, { after } = {}) {
    const done = () => {
      after?.();
      if (!isOpen()) return;
      if (pref.wake && voiceSupport.listen) { follow(); setPhase('listen'); } else setPhase('idle');
    };
    if (text) lastSpeech = text;
    if (!text || pref.mute || (!voiceSupport.speak && !usingCloud())) { done(); return; }
    if (isOpen()) setPhase('think', usingCloud() ? 'Menyiapkan suara' : '');
    speakingUntil = Date.now() + 60000;
    speak(spoken(text), {
      onStart: () => { if (isOpen()) setPhase('speak'); },
      onEnd: () => {
        speakingUntil = Date.now() + ECHO_MS;
        done();
      },
    });
  }

  function remember(entry) {
    trail.push(entry);
    if (trail.length > 12) trail.shift();
  }

  function reply(html, { title = '', chips = [], lines = [], speakText, next = null, mood = '', keep = true } = {}) {
    build();
    showing = '';
    const stage = $('va-stage');
    stage.innerHTML = `<article class="va-card va-answer in">
      ${title ? `<p class="va-code">${esc(title)}</p>` : ''}<h2>${html}</h2>
      ${lines.map((l) => `<p>${l}</p>`).join('')}
      ${chips.length ? `<dl class="va-facts">${chips.map((c) => `<div><dt>${esc(c.k)}</dt><dd>${esc(c.v)}</dd></div>`).join('')}</dl>` : ''}
    </article>`;
    revealWords(stage.querySelector('.va-answer h2'));
    setStage('show');
    if (next) suggest(next);
    if (mood) setMood(mood);
    if (keep) remember({ kind: 'answer', args: [html, { title, chips, lines, next, mood }] });
    say(speakText ?? html);
  }

  function helpCard() {
    build();
    showing = '';
    $('va-stage').innerHTML = `<article class="va-card va-answer va-help in"><p class="va-code">${esc(WAKE_NAME)}</p>
      <h2>Ucapkan atau ketik perintah seperti ini</h2>
      <div class="va-help-grid">${HELP.map(([t, items]) => `<section><h3>${esc(t)}</h3>${items.map((i) => `<button type="button" data-say="${esc(i)}">${esc(i)}</button>`).join('')}</section>`).join('')}</div>
      <p class="va-note">${voiceSupport.listen ? `Nyalakan mode dengar di kanan atas supaya cukup bilang "${esc(WAKE_PHRASE)}" tanpa klik.` : 'Browser ini hanya bisa perintah ketik.'} Boleh pakai bahasa santai, angka boleh diucapkan. Tutup dengan Esc atau bilang "tutup".</p></article>`;
    setStage('show');
    suggest(HINTS);
    setMood('happy');
    remember({ kind: 'help', args: [] });
    say(`Saya ${WAKE_NAME}. Saya bisa menampilkan kondisi wilayah, membandingkan dua RO, membuka detail, menjawab pertanyaan angka, dan mengatur dashboard. Bicara santai saja.`);
  }

  function showRegion(ro, { lead = '', quiet = false } = {}) {
    const c = getContext();
    if (!c) return;
    const d = regionData(c, ro);
    if (!d.now?.end) { reply(`Data ${esc(shortRo(ro) || 'Nasional')} belum ada.`, { mood: 'confused' }); return null; }
    build();
    showing = ro;
    const stage = $('va-stage');
    stage.innerHTML = showcaseHtml(d);
    setStage('show');
    flyIn(stage, $('va-orb'));
    const talk = regionTalk(d, lead);
    offer = talk.offer;
    suggest(talk.next);
    setMood('happy');
    ding('done');
    remember({ kind: 'region', args: [ro] });
    say(quiet ? `Kembali ke ${d.name}.` : talk.text);
    return talk;
  }

  function showCompare(roA, roB, focus = '', { quiet = false } = {}) {
    const c = getContext();
    if (!c) return;
    const a = regionData(c, roA);
    const b = regionData(c, roB);
    if (!a.now?.end || !b.now?.end) { reply('Data salah satu RO belum ada.', { mood: 'confused' }); return; }
    build();
    showing = '';
    const stage = $('va-stage');
    stage.innerHTML = compareHtml(a, b, focus);
    setStage('show');
    flyIn(stage, $('va-orb'));
    offer = { say: `Lihat ${a.name}`, ask: '' };
    suggest([`Lihat ${a.name}`, `Lihat ${b.name}`, `Fokus ke ${a.name}`]);
    setMood('happy');
    ding('done');
    remember({ kind: 'compare', args: [roA, roB, focus] });
    say(quiet ? `Kembali ke perbandingan ${a.name} dan ${b.name}.` : `${pickOne(['Ini perbandingannya.', 'Siap, saya bandingkan.', 'Oke, adu angka ya.'])} ${compareTalk(a, b, focus)}`);
  }

  async function brief() {
    const talk = showRegion('', { lead: `${salam()}. Ini ringkasan nasional hari ini.` });
    if (!talk) return;
    try {
      const { a } = await engine.ask('ro mana yang perlu perhatian', { context: { ro: '' } });
      if (a?.title && a.ok !== false && showing === '') {
        const names = (a.title.replace(/<[^>]+>/g, '').split(':')[1] || '').split(',').map((x) => x.trim().replace(/\.$/, '')).filter(Boolean).slice(0, 3);
        if (names.length) {
          suggest(names.map((n) => `Lihat ${n}`));
          lastSpeech = `${talk.text.replace(talk.offer.ask, '')} Yang perlu perhatian: ${names.join(', ')}.`;
          say(lastSpeech);
        }
      }
    } catch {}
  }

  function stepRo(dir) {
    const list = regions();
    if (!list.length) return;
    const at = list.indexOf(showing);
    const next = at < 0 ? (dir > 0 ? list[0] : list[list.length - 1]) : list[(at + dir + list.length) % list.length];
    showRegion(next);
  }

  function rankShow(order) {
    const c = getContext();
    const list = roStanding(c.pm).filter((x) => ok(x.achOs)).sort((x, y) => (order === 'worst' ? x.achOs - y.achOs : y.achOs - x.achOs));
    if (!list.length) { reply('Belum ada data capaian RO.', { mood: 'confused' }); return; }
    const top = list[0];
    showRegion(top.ro, { lead: order === 'worst' ? `Capaian OS terendah saat ini ${shortRo(top.ro)}.` : `Capaian OS tertinggi saat ini ${shortRo(top.ro)}.` });
  }

  function goBack() {
    trail.pop();
    const prev = trail.pop();
    if (!prev) { reply('Belum ada tampilan sebelumnya.', { keep: false, next: HINTS }); return; }
    if (prev.kind === 'region') showRegion(prev.args[0], { quiet: true });
    else if (prev.kind === 'compare') showCompare(prev.args[0], prev.args[1], prev.args[2], { quiet: true });
    else if (prev.kind === 'help') helpCard();
    else reply(prev.args[0], { ...prev.args[1], speakText: 'Ini tampilan sebelumnya.' });
  }

  async function handle(text, { typed = false } = {}) {
    const ticket = ++busy;
    clearTimeout(early.timer);
    awake();
    if (!isOpen()) open({ listenNow: false, focusInput: typed });
    if (mode === 'command') { rec.abort(); mode = 'off'; }
    hush();
    showHeard(text, true);
    setPhase('think');
    const c = getContext();
    const list = regions();
    let q = null;
    try { q = await engine.parse(cleanSpoken(text, list)); } catch (err) { console.warn(err); }
    if (ticket !== busy) return;
    const cmd = routeCommand(text, { q, regions: list, showing });
    const pending = offer;
    if (cmd.type !== 'yes' && cmd.type !== 'no') offer = null;
    switch (cmd.type) {
      case 'none': setPhase('idle'); return;
      case 'yes':
        offer = null;
        if (pending) { handle(pending.say); return; }
        reply('Siap. Mau lihat apa?', { next: HINTS, mood: 'happy' });
        return;
      case 'no': offer = null; reply(pickOne(['Baik.', 'Oke, siap.', 'Baik, tidak jadi.']), { next: showing ? null : HINTS, keep: false }); return;
      case 'hush': setPhase(pref.wake ? 'listen' : 'idle'); return;
      case 'close': ding('off'); closeDetail(); close(); return;
      case 'bye': setMood('love'); ding('off'); say(pickOne(['Sampai jumpa, semoga harinya lancar.', 'Dadah, panggil saya lagi kapan saja.', 'Sampai nanti ya.']), { after: close }); return;
      case 'thanks': ding('love'); reply(pickOne(['Sama-sama.', 'Sama-sama, senang bisa bantu.', 'Dengan senang hati.']), { mood: 'love', next: HINTS, keep: false }); return;
      case 'praise': ding('love'); reply(pickOne(['Aduh, makasih. Jadi semangat!', 'Hehe, terima kasih!', 'Makasih, saya jadi malu.']), { mood: 'love', keep: false }); return;
      case 'intro': reply(`Halo, saya ${esc(WAKE_NAME)}, asisten dashboard KPR.`, { lines: ['Saya bisa menampilkan kondisi wilayah, membandingkan RO, membuka detail, menjawab pertanyaan angka, dan mengatur dashboard. Panggil saja "Hai Kirana".'], mood: 'love', next: HINTS }); return;
      case 'smalltalk': reply(pickOne(['Kabar baik, terima kasih sudah bertanya. Datanya juga siap. Mau lihat apa?', 'Baik sekali. Hari ini mau cek wilayah mana?']), { mood: 'happy', next: HINTS, keep: false }); return;
      case 'wakeOff': setWake(false, true); return;
      case 'wakeOn': setWake(true, true); return;
      case 'mute': setMute(true); reply('Suara jawaban dimatikan. Jawaban tetap tampil di layar.', { keep: false }); return;
      case 'unmute': setMute(false); reply('Suara jawaban menyala lagi.', { mood: 'happy', keep: false }); return;
      case 'voice': {
        const v = nextVoice();
        pref.voice = v.index;
        writePref(pref);
        reply(`Ini suara ${esc(v.name)}. Suka yang ini?`, { mood: 'happy', keep: false, next: ['Ganti suara', 'Lebih pelan', 'Lebih cepat'] });
        return;
      }
      case 'slower':
      case 'faster': {
        pref.rate = Math.min(1.35, Math.max(0.8, Math.round(((pref.rate || 1) + (cmd.type === 'faster' ? 0.08 : -0.08)) * 100) / 100));
        setRate(pref.rate);
        writePref(pref);
        reply(cmd.type === 'faster' ? 'Oke, saya bicara sedikit lebih cepat. Segini enak?' : 'Baik, saya pelankan. Segini enak?', { keep: false, next: ['Lebih pelan', 'Lebih cepat', 'Ganti suara'] });
        return;
      }
      case 'repeat':
        if (lastSpeech) { say(lastSpeech); return; }
        reply('Belum ada yang perlu diulang. Mau lihat apa?', { next: HINTS, keep: false });
        return;
      case 'help': helpCard(); return;
      case 'greet': reply(`${salam()}. Saya ${esc(WAKE_NAME)}. Mau lihat apa?`, { lines: ['Contoh: "briefing hari ini", "lihat Bandung", atau "bandingkan Bandung dan Surabaya".'], next: HINTS, mood: 'happy', keep: false }); return;
      case 'sumber': set({ sumber: cmd.mode === '7' ? '' : cmd.mode }); reply(`Siap, realisasi sekarang memakai ${esc(cmd.mode)} sumber.`, { mood: 'happy', keep: false }); return;
      case 'nasional': set({ ro: '' }); clearStage(); reply(pickOne(['Baik, dashboard kembali ke Nasional.', 'Siap, kembali ke Nasional.']), { mood: 'happy', next: HINTS, keep: false }); return;
      case 'filter': {
        set({ ro: cmd.ro });
        setMood('happy');
        ding('done');
        say(pickOne([`Siap, dashboard saya fokuskan ke ${shortRo(cmd.ro)}.`, `Baik, sekarang dashboard menampilkan ${shortRo(cmd.ro)}.`]), { after: close });
        return;
      }
      case 'page': {
        ding('done');
        close();
        location.hash = `#/${cmd.view}`;
        return;
      }
      case 'pageUnknown': ding('oops'); reply('Halaman itu belum ada.', { lines: ['Halaman yang tersedia: Direktur, Summary, Performance, Realisasi, Portofolio, dan SLA.'], mood: 'confused', next: ['Buka halaman realisasi', 'Buka halaman performance', 'Buka halaman SLA'], keep: false }); return;
      case 'menu': close(); document.getElementById('screen-menu')?.click(); return;
      case 'refresh': document.getElementById('reload')?.click(); reply('Siap, data sedang saya perbarui.', { mood: 'happy', keep: false }); return;
      case 'status': close(); document.querySelector('[data-open-status]')?.click(); return;
      case 'detail': {
        const name = DETAIL_NAME[cmd.id] || 'detail';
        const ro = cmd.ro || showing;
        const where = ro ? ` ${shortRo(ro)}` : '';
        ding('done');
        close();
        openDetail(cmd.id, ro);
        say(pickOne([`Baik, ini detail ${name}${where}.`, `Siap, saya bukakan detail ${name}${where}.`, `Ini detail ${name}${where}.`]));
        return;
      }
      case 'region': showRegion(cmd.ro); return;
      case 'compare': showCompare(cmd.ros[0], cmd.ros[1], cmd.metric); return;
      case 'brief': brief(); return;
      case 'rankShow': rankShow(cmd.order); return;
      case 'back': goBack(); return;
      case 'nextRo': stepRo(1); return;
      case 'prevRo': stepRo(-1); return;
      default: break;
    }
    try {
      const { a, q: asked } = await engine.ask(cmd.text || text, { context: { ro: showing || c?.sel?.ro || '' } });
      if (ticket !== busy) return;
      const ros = (asked?.entities?.ro || []).filter((r) => list.includes(r));
      const lines = (a.lines || []).slice(0, 3);
      const chips = (a.chips || []).filter((x) => x && x.k && x.v && !['Catatan', 'Sumber'].includes(x.k)).slice(0, 6);
      const next = [
        ...(ros.length === 1 ? [`Lihat ${shortRo(ros[0])}`] : []),
        ...(a.followups || []).filter((f) => typeof f === 'string'),
      ].slice(0, 3);
      const failed = a.ok === false;
      if (failed) ding('oops');
      reply(a.title || 'Belum ada jawaban.', { lines, chips, next: next.length ? next : HINTS, mood: failed ? 'confused' : 'happy' });
    } catch (err) {
      console.error(err);
      reply('Maaf, jawabannya belum bisa dihitung. Coba ulangi dengan kata lain ya.', { mood: 'sad' });
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
        setTimeout(() => { engine.ensure?.().catch(() => null); }, 1500);
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
    get state() { return { phase, mode, wake: pref.wake, mute: pref.mute, open: isOpen(), showing, offer: offer?.say || '', trail: trail.length }; },
  };
}
