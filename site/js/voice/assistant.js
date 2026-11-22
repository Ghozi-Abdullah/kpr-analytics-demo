import { esc } from '../core/format.js';
import { icon } from '../core/icons.js';
import { ok } from '../core/values.js';
import { checkSmooth } from '../core/smooth.js';
import { speakRemote } from '../services/data-source.js';
import { roStanding } from '../models/direktur-model.js';
import { voiceSupport, createRecognizer, speak, hush, createLevel, chime, setCloudSpeaker, setVoice, setRate, setPitch, setVolume, nextVoice, usingCloud, voiceList, findVoice } from './speech.js';
import { routeCommand, findWake, cleanSpoken, spoken, shortRo, WAKE_NAME, WAKE_PHRASE } from './command.js';
import { regionData, showcaseHtml, regionTalk, compareHtml, compareTalk, flyIn, toneOf, regionMore } from './showcase.js';
import { createPersona, pickOne, salam, partOfDay, clockText, dateText, workdaysLeft, longDate, parseReminder, nameFrom } from './persona.js';
import { pct } from '../views/direktur-format.js';
import { buildInsights } from '../analytics/insights.js';
import { periodRows, periodStory, storySpeech } from '../analytics/period.js';

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
const HINTS = ['Briefing hari ini', 'Lihat Bandung', 'Kabar baik hari ini apa?', 'RO mana yang perlu perhatian?'];
const HELP = [
  { name: 'Wilayah', key: /wilayah|regional|ro\b/, items: [
    ['Briefing hari ini', 'Ringkasan nasional dan RO yang perlu perhatian'],
    ['Lihat Bandung', 'Empat kartu kondisi satu RO'],
    ['Gimana Jakarta 2?', 'Sama, dengan bahasa santai'],
    ['Tampilkan RO terbaik', 'RO dengan capaian OS tertinggi, juga "terburuk"'],
    ['Berikutnya', 'Pindah ke RO berikutnya, juga "sebelumnya"'],
  ] },
  { name: 'Bandingkan', key: /banding/, items: [
    ['Bandingkan Bandung dan Surabaya', 'Adu sembilan ukuran berdampingan'],
    ['Medan vs Makassar', 'Cara singkat'],
    ['Bandingkan NPL Jakarta 1 dan Jakarta 2', 'Fokus ke satu ukuran'],
  ] },
  { name: 'Detail', key: /detail|pop/, items: [
    ['Detail NPL Surabaya', 'Pop-out detail NPL satu RO'],
    ['Buka realisasi', 'Pop-out realisasi per sumber'],
    ['Riwayat 3 bulan', 'Tabel bulanan semua KPI'],
    ['Semua RO', 'Capaian semua RO dalam satu tabel'],
  ] },
  { name: 'Tanya angka', key: /angka|tanya|data/, items: [
    ['NPL Bandung bulan lalu?', 'Nilai per wilayah dan periode'],
    ['Top 5 kanca realisasi bulan ini', 'Peringkat kanca atau RM'],
    ['RO dengan NPL di atas 4 persen', 'Daftar dengan syarat'],
    ['Kenapa OS naik bulan lalu?', 'Penyebab perubahan'],
    ['Kalau disburse naik 15 persen bulan depan?', 'Simulasi target'],
    ['Berapa berkas lewat SLA?', 'Proses berkas'],
  ] },
  { name: 'Ngobrol', key: /ngobrol|obrol|percakapan/, items: [
    ['Kabar baik hari ini apa?', 'Yang sedang bagus'],
    ['Kabar buruknya apa?', 'Yang perlu diwaspadai'],
    ['Maksudnya?', 'Penjelasan tampilan terakhir'],
    ['Kenapa?', 'Penyebab angka yang sedang tampil'],
    ['Terus?', 'Lanjut ke tawaran berikutnya'],
    ['Kembali', 'Tampilan sebelumnya, juga "ulangi"'],
  ] },
  { name: 'Atur dashboard', key: /atur|dashboard|filter|halaman/, items: [
    ['Fokus ke Makassar', 'Filter semua panel ke satu RO'],
    ['Kembali ke nasional', 'Lepas filter'],
    ['5 sumber', 'Ganti hitungan realisasi'],
    ['Buka halaman realisasi', 'Pindah halaman'],
    ['Refresh data', 'Ambil data terbaru'],
    ['Layar penuh', 'Mode presentasi'],
  ] },
  { name: 'Asisten', key: /asisten|pengingat|ingat/, items: [
    ['Panggil saya Pak Andi', 'Kirana ingat nama panggilan'],
    ['Ingatkan saya 10 menit lagi untuk rapat', 'Pengingat, juga "jam 3 sore"'],
    ['Jam berapa sekarang?', 'Jam dan tanggal'],
    ['Sisa hari kerja bulan ini', 'Hari kerja tersisa, libur sudah dihitung'],
    ['Data per tanggal berapa?', 'Posisi data terakhir'],
    ['Salin jawabannya', 'Salin ke clipboard, juga "bagikan"'],
  ] },
  { name: 'Suara', key: /suara|voice|volume/, items: [
    ['Jawab singkat aja', 'Hanya inti, balik dengan "jawab lengkap"'],
    ['Lebih pelan', 'Tempo bicara, juga "lebih cepat"'],
    ['Kerasin suaranya', 'Volume, juga "kecilin suaranya"'],
    ['Nada lebih tinggi', 'Nada suara, juga "lebih rendah"'],
    ['Bisukan', 'Jawab teks saja, balik dengan "nyalakan suara"'],
    ['Matikan mode dengar', 'Berhenti mendengar "Hai Kirana"'],
  ] },
  { name: 'Santai', key: /santai|lucu|fun/, items: [
    ['Apa kabar?', 'Sapa Kirana'],
    ['Cerita lucu dong', 'Lelucon, bilang "lagi" untuk yang lain'],
    ['Kasih semangat dong', 'Kata penyemangat'],
    ['Capek banget hari ini', 'Kirana tawarkan ringkasan singkat'],
    ['Kamu robot ya?', 'Kenalan dengan Kirana'],
    ['Dadah', 'Tutup Kirana dengan salam'],
  ] },
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
const plain = (html) => String(html || '').replace(/<(br|\/p|\/li|\/div|\/h\d)[^>]*>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
const shorten = (text) => {
  const parts = String(text).split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length <= 2) return text;
  const keep = [parts[0]];
  const num = parts.slice(1).find((x) => /\d/.test(x) && !x.endsWith('?'));
  if (!/\d/.test(parts[0]) && num) keep.push(num);
  else if (!parts[1].endsWith('?')) keep.push(parts[1]);
  if (parts.at(-1).endsWith('?')) keep.push(parts.at(-1));
  return keep.join(' ');
};
const minutesText = (ms) => {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} jam ${r} menit` : `${h} jam`;
};
const MAX_REMINDERS = 5;
const sameText = (a, b) => {
  const x = String(a || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const y = String(b || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  return !!x && !!y && (x === y || y.startsWith(x) || x.startsWith(y));
};

const POSES = ['idle', 'think', 'pout', 'smart', 'joy'];
export const orbHtml = () => `<span class="blob" aria-hidden="true">${POSES.map((p) => `<i class="kira-pose kira-${p}"></i>`).join('')}</span>`;

const FX = `<span class="fx" aria-hidden="true"><i class="q">?</i><i class="zz">z</i><i class="zz">z</i><i class="sp"></i><i class="sp"></i><i class="sp"></i><i class="sp"></i>
  <i class="hrt">${HEART}</i><i class="hrt">${HEART}</i><span class="dots"><b></b><b></b><b></b></span></span>`;

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
  const pref = { wake: false, mute: false, voiceId: '', rate: 1, pitch: 1, volume: 1, short: false, name: '', askedName: false, ...readPref() };
  delete pref.voice;
  setVoice(pref.voiceId);
  setRate(pref.rate);
  setPitch(pref.pitch);
  setVolume(pref.volume);
  const persona = createPersona(pref);
  const line = persona.line;
  let lastAnswer = null;
  let lastRegion = null;
  let lastKind = '';
  let greetOnOpen = false;
  const reminders = [];
  const insightCache = new Map();

  function insightsFor(ro) {
    const c = getContext();
    if (!c) return [];
    const key = `${ro}|${c.now?.date}|${c.now?.os}|${c.sel?.sumber}`;
    if (!insightCache.has(key)) {
      let list = [];
      try { list = buildInsights({ pm: c.pm, real: c.realModel, pf: c.pfModel }, { ro }, { sources: ['performance', 'realisasi'], limit: 5, perKind: 1 }); } catch {}
      insightCache.set(key, list);
      if (insightCache.size > 30) insightCache.delete(insightCache.keys().next().value);
    }
    return insightCache.get(key);
  }
  const insightLine = (it, full = true) => `${plain(it.headline)}${full && it.implication ? ` ${plain(it.implication)}` : ''}`;
  const spanWords = (span) => (span === 'ytd' ? 'tahun ini' : `${span} bulan terakhir`);
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

  function chooseVoice(id) {
    pref.voiceId = id;
    setVoice(id);
    writePref(pref);
  }

  function onClick(e) {
    awake();
    if (e.target === dlg || e.target.id === 'va-stage') { close(); return; }
    const tab = e.target.closest('[data-help-tab]');
    if (tab) { helpTab(Number(tab.dataset.helpTab)); return; }
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
    let listenText = 'Mendengarkan';
    if (next === 'listen' && greetOnOpen) {
      greetOnOpen = false;
      listenText = `${salam()}${pref.name ? `, ${pref.name}` : ''}. Silakan bicara`;
    }
    $('va-status').textContent = text || { listen: listenText, think: 'Sebentar ya', speak: '', idle: idleText, error: '' }[next] || '';
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
      greetOnOpen = true;
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
    const words = spoken(text);
    speak(pref.short ? shorten(words) : words, {
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
    stage.innerHTML = `<article class="va-card va-answer">
      ${title ? `<p class="va-code">${esc(title)}</p>` : ''}<h2>${html}</h2>
      ${lines.map((l) => `<p>${l}</p>`).join('')}
      ${chips.length ? `<dl class="va-facts">${chips.map((c) => `<div><dt>${esc(c.k)}</dt><dd>${esc(c.v)}</dd></div>`).join('')}</dl>` : ''}
    </article>`;
    setStage('show');
    flyIn(stage, $('va-orb'));
    revealWords(stage.querySelector('.va-answer h2'));
    if (next) suggest(next);
    if (mood) setMood(mood);
    if (keep) remember({ kind: 'answer', args: [html, { title, chips, lines, next, mood }] });
    say(speakText ?? html);
  }

  function helpRows(i) {
    return HELP[i].items.map(([say, what]) => `<li><button type="button" data-say="${esc(say)}">${esc(say)}</button><span>${esc(what)}</span></li>`).join('');
  }

  function helpTab(i, focus = false) {
    const card = $('va-stage')?.querySelector('.va-help');
    if (!card) return;
    card.querySelectorAll('[data-help-tab]').forEach((b) => {
      const on = Number(b.dataset.helpTab) === i;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    const list = card.querySelector('#va-cmds');
    list.innerHTML = helpRows(i);
    list.setAttribute('aria-labelledby', `va-tab-${i}`);
  }

  function helpCard(topic = '') {
    build();
    showing = '';
    const t = String(topic || '').toLowerCase();
    const at = Math.max(0, HELP.findIndex((g) => g.key.test(t)));
    $('va-stage').innerHTML = `<article class="va-card va-answer va-help in">
      <header class="va-help-head"><div><p class="va-code">${esc(WAKE_NAME)}</p><h2>Daftar perintah</h2></div>
        <p>Klik untuk mencoba. Boleh juga diucapkan dengan kata sendiri.</p></header>
      <div class="va-help-body">
        <div class="va-help-rail" role="tablist" aria-label="Kelompok perintah" aria-orientation="vertical">${HELP.map((g, i) => `<button type="button" role="tab" id="va-tab-${i}" data-help-tab="${i}" aria-selected="${i === at}" aria-controls="va-cmds" tabindex="${i === at ? 0 : -1}"><span>${esc(g.name)}</span><small>${g.items.length}</small></button>`).join('')}</div>
        <ul class="va-cmds" id="va-cmds" role="tabpanel" aria-labelledby="va-tab-${at}">${helpRows(at)}</ul>
      </div>
      <p class="va-note">${voiceSupport.listen ? `Nyalakan mode dengar di kanan atas supaya cukup bilang "${esc(WAKE_PHRASE)}".` : 'Browser ini hanya bisa perintah ketik.'} Tutup dengan Esc atau bilang "tutup".</p></article>`;
    const rail = $('va-stage').querySelector('.va-help-rail');
    rail.addEventListener('keydown', (e) => {
      const cur = Number(document.activeElement?.dataset?.helpTab);
      if (Number.isNaN(cur)) return;
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (step) { e.preventDefault(); helpTab((cur + step + HELP.length) % HELP.length, true); }
      else if (e.key === 'Home') { e.preventDefault(); helpTab(0, true); }
      else if (e.key === 'End') { e.preventDefault(); helpTab(HELP.length - 1, true); }
    });
    setStage('show');
    suggest(HINTS);
    setMood('happy');
    remember({ kind: 'help', args: [topic] });
    say(`${pref.name ? `${pref.name}, ` : ''}saya bisa menampilkan kondisi wilayah, membandingkan dua RO, membuka detail, menjawab pertanyaan angka, mengingatkan jadwal, dan diajak ngobrol. Bicara santai saja, seperti ngobrol biasa.`);
  }

  function openerFor(d, lead) {
    if (pref.short) return lead ? lead.split(/(?<=[.!?])\s+/)[0] : '';
    const tone = toneOf(d);
    const react = line(tone, { n: d.name });
    if (lead) return `${lead} ${react}`;
    const key = d.ro || '';
    const same = lastRegion && lastRegion.key === key;
    const first = same ? line('regionSame', { n: d.name }) : lastRegion ? line('regionSwitch', { n: d.name, prev: lastRegion.name }) : line('regionFirst', { n: d.name });
    return `${first} ${react}`;
  }

  function showRegion(ro, { lead = '', quiet = false, tail = '', tailOffer = null } = {}) {
    const c = getContext();
    if (!c) return null;
    const d = regionData(c, ro);
    if (!d.now?.end) { reply(`Data ${esc(shortRo(ro) || 'Nasional')} belum ada.`, { mood: 'confused' }); return null; }
    build();
    showing = ro;
    const stage = $('va-stage');
    stage.innerHTML = showcaseHtml(d);
    setStage('show');
    flyIn(stage, $('va-orb'));
    const top = pref.short ? null : insightsFor(d.ro || '')[0];
    const talk = regionTalk(d, openerFor(d, lead), top ? `${pickOne(['Catatan analisis saya:', 'Dari sisi analisis,', 'Yang perlu dicermati,'])} ${insightLine(top)}` : '');
    if (tail) talk.text = `${talk.text.replace(talk.offer.ask, '').trim()} ${tail}${tailOffer ? ` ${tailOffer.ask}` : ''}`;
    if (tailOffer) talk.offer = tailOffer;
    lastRegion = { key: d.ro || '', name: d.name, d };
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
    lastRegion = null;
    say(quiet ? `Kembali ke perbandingan ${a.name} dan ${b.name}.` : `${line('compare', { a: a.name, b: b.name })} ${compareTalk(a, b, focus)} Mau saya buka salah satunya?`);
  }

  async function brief() {
    const lead = `${salam()}${pref.name ? `, ${pref.name}` : ''}. Ini ringkasan nasional hari ini.`;
    let names = [];
    try {
      const { a } = await engine.ask('ro mana yang perlu perhatian', { context: { ro: '' } });
      if (a?.title && a.ok !== false) names = (a.title.replace(/<[^>]+>/g, '').split(':')[1] || '').split(',').map((x) => x.trim().replace(/\.$/, '')).filter(Boolean).slice(0, 3);
    } catch {}
    const talk = names.length
      ? showRegion('', { lead, tail: `Yang perlu perhatian: ${names.join(', ')}.`, tailOffer: { say: `Lihat ${names[0]}`, ask: `Mau lihat ${names[0]} dulu?` } })
      : showRegion('', { lead });
    if (talk && names.length) suggest(names.map((n) => `Lihat ${n}`));
  }

  function talkOnly(text, mood = '') {
    if (mood) setMood(mood);
    say(text);
  }

  function chat(text, { mood = 'happy', next = null, lines = [], keep = false, chime = '' } = {}) {
    if (chime) ding(chime);
    reply(esc(text), { mood, next: next || (showing ? null : HINTS), lines, keep });
  }

  function standing() {
    const c = getContext();
    return c ? roStanding(c.pm).filter((x) => ok(x.achOs)) : [];
  }

  function goodNews() {
    const list = standing();
    if (!list.length) { chat('Belum ada data capaian RO untuk dicari kabar baiknya.', { mood: 'confused' }); return; }
    const reached = list.filter((x) => x.achOs >= 1);
    const best = [...list].sort((a, b) => b.achOs - a.achOs)[0];
    const calm = list.filter((x) => ok(x.nplPct) && ok(x.rkaNplPct) && x.nplPct <= x.rkaNplPct);
    const lowNpl = [...list].filter((x) => ok(x.nplPct)).sort((a, b) => a.nplPct - b.nplPct)[0];
    const parts = [reached.length ? `${reached.length} dari ${list.length} RO sudah mencapai RKA outstanding.` : `Belum ada RO yang mencapai RKA outstanding, tapi yang paling dekat ${shortRo(best.ro)}.`];
    parts.push(`Capaian tertinggi ${shortRo(best.ro)}, ${pct(best.achOs, 1)} dari RKA.`);
    if (lowNpl) parts.push(`NPL terendah ${shortRo(lowNpl.ro)}, ${pct(lowNpl.nplPct)}.`);
    if (calm.length) parts.push(`${calm.length} RO punya NPL di bawah RKA.`);
    offer = { say: `Lihat ${shortRo(best.ro)}`, ask: `Mau lihat ${shortRo(best.ro)}?` };
    reply(`${pickOne(['Ada kabar baik nih.', 'Kabar baiknya begini.', 'Oke, yang bikin senang dulu ya.'])} ${parts[0]}`, {
      lines: parts.slice(1).map(esc), mood: 'happy', next: [`Lihat ${shortRo(best.ro)}`, 'Kabar buruknya apa?', 'Briefing hari ini'],
      speakText: `${parts.join(' ')} ${offer.ask}`,
    });
    ding('love');
  }

  function badNews() {
    const list = standing();
    if (!list.length) { chat('Belum ada data capaian RO.', { mood: 'confused' }); return; }
    const worst = [...list].sort((a, b) => a.achOs - b.achOs)[0];
    const over = list.filter((x) => ok(x.nplPct) && ok(x.rkaNplPct) && x.nplPct > x.rkaNplPct).sort((a, b) => (b.nplPct - b.rkaNplPct) - (a.nplPct - a.rkaNplPct));
    const parts = [`Capaian outstanding terendah ${shortRo(worst.ro)}, ${pct(worst.achOs, 1)} dari RKA.`];
    if (over.length) parts.push(`${over.length} RO punya NPL di atas RKA, paling jauh ${shortRo(over[0].ro)} dengan ${pct(over[0].nplPct)}.`);
    else parts.push('Untungnya, belum ada RO dengan NPL di atas RKA.');
    const target = over[0]?.ro || worst.ro;
    offer = { say: `Lihat ${shortRo(target)}`, ask: `Mau saya tampilkan ${shortRo(target)}?` };
    reply(`${pickOne(['Oke, yang perlu diwaspadai ya.', 'Ini yang perlu perhatian.', 'Baik, kabar kurang enaknya begini.'])} ${parts[0]}`, {
      lines: parts.slice(1).map(esc), mood: 'sad', next: [`Lihat ${shortRo(target)}`, 'Kabar baiknya apa?', 'RO mana yang perlu perhatian?'],
      speakText: `${parts.join(' ')} ${offer.ask}`,
    });
  }

  function explain() {
    if (showing !== '' || (lastRegion && trail.at(-1)?.kind === 'region')) {
      const d = lastRegion?.d;
      const more = d ? regionMore(d) : [];
      const extra = d ? insightsFor(d.ro || '').slice(1, 3).map((it) => insightLine(it)) : [];
      if (more.length || extra.length) {
        offer = { say: `Performance ${d.name} 3 bulan`, ask: 'Mau saya bukakan tren 3 bulannya?' };
        talkOnly(`${pickOne(['Maksudnya begini.', 'Jadi begini.', 'Saya jelaskan sedikit ya.'])} ${[...more, ...extra].join(' ')} ${offer.ask}`, 'happy');
        return;
      }
    }
    if (lastAnswer?.lines?.length) {
      talkOnly(`${pickOne(['Maksudnya begini.', 'Jadi begini.'])} ${lastAnswer.lines.map(plain).join(' ')}`, 'happy');
      return;
    }
    if (lastRegion?.d) {
      talkOnly(`${pickOne(['Jadi begini.', 'Saya jelaskan ya.'])} ${regionMore(lastRegion.d).join(' ')}`, 'happy');
      return;
    }
    chat('Yang mana ya maksudnya? Coba sebut wilayah atau angkanya, misalnya "jelaskan NPL Bandung".', { mood: 'confused' });
  }

  function analysis(ro) {
    const c = getContext();
    if (!c) return;
    const name = ro ? shortRo(ro) : 'Nasional';
    const list = insightsFor(ro);
    if (!list.length) { chat(`Belum ada temuan yang cukup kuat untuk ${name}.`, { mood: 'confused' }); return; }
    const story = periodStory(periodRows(c.pm, ro, '3'), name);
    const dot = { positive: 'good', negative: 'bad', risk: 'warn', neutral: '' };
    const lines = list.slice(0, 4).map((it) => `<span class="va-tone ${dot[it.tone] || ''}"></span>${it.headline}${it.implication ? `<small>${it.implication}</small>` : ''}`);
    if (story?.focus) lines.push(`<span class="va-tone"></span><b>Tiga bulan terakhir:</b> ${esc(story.focus)}`);
    offer = { say: `Performance ${name} 3 bulan`, ask: `Mau saya bukakan performance ${name} tiga bulan terakhir?` };
    const spoken = [insightLine(list[0]), list[1] ? plain(list[1].headline) : '', story?.focus ? `Kalau dilihat tiga bulan terakhir, ${story.focus.charAt(0).toLowerCase()}${story.focus.slice(1)}` : ''].filter(Boolean).join(' ');
    reply(`Analisis ${esc(name)}, ${esc(longDate(c.now?.date) || 'posisi terakhir')}`, {
      lines, mood: 'happy', next: [`Performance ${name} 3 bulan`, ro ? `Detail NPL ${name}` : 'Kabar buruknya apa?', 'Maksudnya?'],
      speakText: `${pickOne(['Baik, ini analisis saya.', 'Oke, saya rangkum temuannya.', 'Ini poin pentingnya.'])} ${spoken} ${offer.ask}`,
    });
    lastAnswer = { text: [`Analisis ${name}`, ...list.map((it) => insightLine(it))].join(' '), lines: list.map((it) => insightLine(it)) };
  }

  function remind(text) {
    const r = parseReminder(text);
    if (!r) { chat('Mau diingatkan kapan? Misalnya, "ingatkan saya 10 menit lagi untuk rapat".', { mood: 'confused', next: ['Ingatkan saya 10 menit lagi', 'Ingatkan saya jam 3 sore'] }); return; }
    if (reminders.length >= MAX_REMINDERS) { chat(`Pengingatnya sudah ${MAX_REMINDERS}. Bilang "batalkan pengingat" dulu ya.`, { mood: 'confused' }); return; }
    const about = r.about.replace(/\s+(ya|dong|nanti)$/, '');
    const item = { about, due: Date.now() + r.ms, at: r.at || '' };
    item.timer = setTimeout(() => fireReminder(item), r.ms);
    reminders.push(item);
    const when = r.at ? `jam ${r.at} nanti` : `${minutesText(r.ms)} lagi`;
    chat(`Siap, ${when} saya ingatkan${about ? ` untuk ${about}` : ''}.`, { lines: ['Pengingat aktif selama halaman dashboard ini terbuka.'], chime: 'done' });
  }

  function fireReminder(item) {
    const at = reminders.indexOf(item);
    if (at >= 0) reminders.splice(at, 1);
    if (!isOpen()) open({ listenNow: false });
    ding('done');
    setMood('surprised', 1500);
    chat(`${pref.name ? `${pref.name}, ` : ''}ini pengingatnya${item.about ? `: ${item.about}` : ''}.`, { mood: 'surprised', lines: [item.at ? `Sesuai permintaan, jam ${item.at}.` : 'Sesuai waktu yang diminta tadi.'] });
  }

  async function copyText(share = false) {
    const text = plain(lastAnswer?.text || lastSpeech || '');
    if (!text) { chat('Belum ada jawaban yang bisa disalin.', { mood: 'confused' }); return; }
    if (share && navigator.share) {
      try { await navigator.share({ title: 'Dashboard KPR', text }); talkOnly('Siap, silakan pilih tujuannya.', 'happy'); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      talkOnly(share ? 'Sudah saya salin. Tinggal tempel di WhatsApp atau email ya.' : 'Sudah saya salin, tinggal tempel.', 'happy');
    } catch {
      chat('Browser belum mengizinkan menyalin otomatis. Blok teksnya lalu tekan Ctrl+C ya.', { mood: 'confused' });
    }
  }

  function personal(type) {
    const moods = { joke: 'happy', sing: 'happy', isAi: 'happy', whoMade: 'love', age: 'happy', love: 'love', like: 'happy', eat: 'happy', weather: 'confused', english: 'confused', sad: 'love', tired: 'love', motivate: 'happy', congrats: 'love' };
    const offers = {
      tired: { say: 'Briefing hari ini', ask: 'Mau saya ringkas sekarang?' },
      sad: { say: 'Kabar baiknya apa?', ask: '' },
      motivate: { say: 'Tampilkan RO terbaik', ask: '' },
      sing: { say: 'Briefing hari ini', ask: '' },
    };
    const text = line(type);
    if (offers[type]) offer = offers[type];
    const next = type === 'joke' ? ['Lagi dong', 'Briefing hari ini'] : type === 'tired' ? ['Briefing hari ini', 'Jawab singkat aja'] : type === 'sad' ? ['Kabar baiknya apa?'] : null;
    chat(text, { mood: moods[type] || 'happy', next, chime: type === 'congrats' || type === 'love' ? 'love' : '' });
  }

  function continueTalk(pending) {
    if (pending) { handle(pending.say); return; }
    if (lastKind === 'joke') { personal('joke'); return; }
    if (showing !== '' && trail.at(-1)?.kind === 'region') { stepRo(1); return; }
    if (lastAnswer?.lines?.length) { talkOnly(`${pickOne(['Lanjut ya.', 'Terus begini.'])} ${lastAnswer.lines.map(plain).join(' ')}`); return; }
    brief();
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
    showRegion(top.ro, { lead: order === 'worst' ? `Capaian outstanding terendah saat ini ${shortRo(top.ro)}, ${pct(top.achOs, 1)} dari RKA.` : `Capaian outstanding tertinggi saat ini ${shortRo(top.ro)}, ${pct(top.achOs, 1)} dari RKA.` });
  }

  function goBack() {
    trail.pop();
    const prev = trail.pop();
    if (!prev) { reply('Belum ada tampilan sebelumnya.', { keep: false, next: HINTS }); return; }
    if (prev.kind === 'region') showRegion(prev.args[0], { quiet: true });
    else if (prev.kind === 'compare') showCompare(prev.args[0], prev.args[1], prev.args[2], { quiet: true });
    else if (prev.kind === 'help') helpCard(prev.args[0]);
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
    const prevKind = lastKind;
    lastKind = cmd.type;
    const onStage = !!showing || !!$('va-stage')?.childElementCount;
    switch (cmd.type) {
      case 'none': setPhase('idle'); return;
      case 'yes':
        offer = null;
        if (pending) { handle(pending.say); return; }
        if (/\b(lanjut|gas|terus)\b/.test(cmd.text)) { lastKind = prevKind; continueTalk(null); return; }
        if (onStage) { talkOnly(line('ack'), 'happy'); return; }
        reply('Siap. Mau lihat apa?', { next: HINTS, mood: 'happy' });
        return;
      case 'no': offer = null; if (onStage) talkOnly(line('no')); else reply(esc(line('no')), { next: HINTS, keep: false }); return;
      case 'hush': setPhase(pref.wake ? 'listen' : 'idle'); return;
      case 'close': ding('off'); closeDetail(); close(); return;
      case 'bye': setMood('love'); ding('off'); say(line(partOfDay() === 'malam' ? 'byeNight' : 'bye'), { after: close }); return;
      case 'goodnight': setMood('sleepy', 0); ding('off'); say(line('byeNight'), { after: close }); return;
      case 'thanks': ding('love'); if (onStage) talkOnly(`${line('thanks')} ${pickOne(['Ada lagi?', '', ''])}`, 'love'); else reply(esc(line('thanks')), { mood: 'love', next: HINTS, keep: false }); return;
      case 'praise':
        if (showing !== '' && lastRegion && !/\b(kamu|kirana)\b/i.test(text)) {
          const tone = toneOf(lastRegion.d);
          talkOnly(tone === 'good' ? `Iya, ${lastRegion.name} memang lagi bagus.` : tone === 'bad' ? `Hmm, sebenarnya ${lastRegion.name} masih perlu dikejar.` : `Iya, sebagian sudah bagus. Tinggal dijaga.`, tone === 'bad' ? 'confused' : 'happy');
          return;
        }
        ding('love'); if (onStage) talkOnly(line('praise'), 'love'); else reply(esc(line('praise')), { mood: 'love', keep: false });
        return;
      case 'reactBad':
        if (pending?.ask) { offer = pending; talkOnly(`Iya, betul. ${pending.ask}`, 'sad'); return; }
        offer = { say: 'Kabar buruknya apa?', ask: '' };
        talkOnly(showing !== '' && lastRegion ? `Iya, ${lastRegion.name} memang perlu perhatian. Mau saya rangkum yang perlu dikejar?` : 'Iya, yang ini perlu dikejar. Mau saya rangkum yang perlu diwaspadai?', 'sad');
        return;
      case 'ack': talkOnly(line('ack'), 'happy'); return;
      case 'present': talkOnly(line('present'), 'happy'); return;
      case 'wait': talkOnly(line('wait'), 'happy'); return;
      case 'sorry': talkOnly(line('sorry'), 'love'); return;
      case 'annoyed': ding('oops'); talkOnly(line('annoyed'), 'sad'); return;
      case 'joke': case 'sing': case 'isAi': case 'whoMade': case 'age': case 'love': case 'like': case 'eat': case 'weather': case 'english': case 'sad': case 'tired': case 'motivate': case 'congrats':
        personal(cmd.type); return;
      case 'continue': lastKind = prevKind; continueTalk(pending); return;
      case 'more':
        lastKind = prevKind;
        if (['joke', 'motivate', 'sing', 'like'].includes(prevKind)) { personal(prevKind); return; }
        continueTalk(pending);
        return;
      case 'explain': explain(); return;
      case 'why':
        if (lastRegion?.d && trail.at(-1)?.kind === 'region') {
          const d = lastRegion.d;
          const rose = ok(d.now?.nplPct) && ok(d.before?.nplPct) && d.now.nplPct > d.before.nplPct;
          handle(rose ? `kenapa npl ${d.name} naik` : `kenapa os ${d.name} naik`);
          return;
        }
        break;
      case 'goodNews': goodNews(); return;
      case 'badNews': badNews(); return;
      case 'time': chat(clockText(), { mood: 'happy' }); return;
      case 'date': chat(dateText(), { mood: 'happy' }); return;
      case 'daysLeft': {
        const w = workdaysLeft();
        chat(w.work ? `Bulan ${w.month} tinggal ${w.work} hari kerja lagi, termasuk hari ini.` : `Hari kerja bulan ${w.month} sudah habis.`, { lines: [w.last ? `Hari kerja terakhir ${w.last.getDate()} ${w.month}. Sisa hari kalender ${w.calendar}.` : ''].filter(Boolean), mood: 'happy' });
        return;
      }
      case 'dataDate': {
        const d = c ? regionData(c, '').now : null;
        const when = longDate(d?.date);
        offer = { say: 'Status data', ask: '' };
        chat(when ? `Data terakhir per ${when}.` : 'Tanggal data belum terbaca.', { lines: ['Dashboard mengecek data baru secara otomatis. Bilang "status data" untuk rincian.'], next: ['Status data', 'Refresh data'] });
        return;
      }
      case 'fullscreen':
        try {
          await document.documentElement.requestFullscreen();
          talkOnly('Siap, layar penuh. Bilang "keluar layar penuh" untuk kembali.', 'happy');
        } catch {
          chat('Browser belum mengizinkan layar penuh lewat suara. Tekan F11 ya.', { mood: 'confused' });
        }
        return;
      case 'exitFull':
        if (document.fullscreenElement) { document.exitFullscreen?.().catch(() => null); talkOnly('Oke, layar penuh dimatikan.'); }
        else talkOnly('Sekarang tidak sedang layar penuh kok. Kalau pakai F11, tekan F11 lagi ya.');
        return;
      case 'print': ding('done'); close(); setTimeout(() => window.print(), 350); return;
      case 'copy': copyText(false); return;
      case 'share': copyText(true); return;
      case 'remind': remind(cmd.text); return;
      case 'remindCancel': {
        const n = reminders.length;
        reminders.splice(0).forEach((x) => clearTimeout(x.timer));
        chat(n ? `Siap, ${n} pengingat saya batalkan.` : 'Belum ada pengingat yang aktif.', { mood: 'happy' });
        return;
      }
      case 'remindList':
        chat(reminders.length ? `Ada ${reminders.length} pengingat aktif.` : 'Belum ada pengingat yang aktif.', { lines: reminders.map((x) => esc(`${x.about || 'Pengingat'}: ${minutesText(Math.max(0, x.due - Date.now()))} lagi`)) });
        return;
      case 'volUp':
      case 'volDown': {
        const before = pref.volume;
        pref.volume = Math.min(1, Math.max(0.3, Math.round(((pref.volume || 1) + (cmd.type === 'volUp' ? 0.15 : -0.15)) * 100) / 100));
        setVolume(pref.volume);
        writePref(pref);
        if (cmd.type === 'volUp' && before >= 1) { talkOnly('Suara saya sudah paling keras. Coba naikkan volume laptop ya.'); return; }
        talkOnly(cmd.type === 'volUp' ? 'Oke, saya keraskan. Segini terdengar?' : 'Baik, saya kecilkan. Segini?');
        return;
      }
      case 'short': pref.short = true; writePref(pref); talkOnly('Siap, mulai sekarang saya jawab singkat.', 'happy'); return;
      case 'long': pref.short = false; writePref(pref); talkOnly('Baik, saya jawab lengkap lagi.', 'happy'); return;
      case 'whereAmI': {
        const view = (location.hash.match(/^#\/([a-z]+)/) || [])[1] || 'direktur';
        const ro = c?.sel?.ro || '';
        talkOnly(`Sekarang di halaman ${PAGE_NAME[view] || view}, ${ro ? `filter ${shortRo(ro)}` : 'tampilan Nasional'}.${showing ? ` Di layar saya sedang tampil ${shortRo(showing)}.` : ''}`);
        return;
      }
      case 'setName': {
        pref.name = nameFrom(cmd.name);
        pref.askedName = true;
        writePref(pref);
        ding('love');
        chat(`Salam kenal, ${pref.name}. Mulai sekarang saya panggil ${pref.name} ya.`, { mood: 'love' });
        return;
      }
      case 'whoAmI':
        chat(pref.name ? `Tentu ingat, ${pref.name}.` : 'Saya belum tahu nih. Mau dipanggil siapa?', { mood: pref.name ? 'love' : 'confused', lines: pref.name ? [] : ['Bilang saja, misalnya, "panggil saya Pak Andi".'] });
        return;
      case 'forgetName': pref.name = ''; writePref(pref); chat('Baik, nama sudah saya lupakan.', { mood: 'happy' }); return;
      case 'intro': {
        const ask = !pref.name && !pref.askedName;
        if (ask) { pref.askedName = true; writePref(pref); }
        reply(`Halo, saya ${esc(WAKE_NAME)}, asisten dashboard KPR.`, { lines: ['Saya bisa menampilkan kondisi wilayah, membandingkan RO, membuka detail, menjawab pertanyaan angka, mengingatkan jadwal, dan mengatur dashboard. Panggil saja "Hai Kirana".', ...(ask ? ['Oh iya, mau dipanggil siapa? Bilang saja, misalnya, "panggil saya Pak Andi".'] : [])], mood: 'love', next: HINTS });
        return;
      }
      case 'smalltalk': {
        const part = partOfDay();
        if (part === 'sore' || part === 'pagi') offer = { say: 'Briefing hari ini', ask: '' };
        reply(esc(line(`smalltalk.${part}`)), { mood: 'happy', next: HINTS, keep: false });
        return;
      }
      case 'wakeOff': setWake(false, true); return;
      case 'wakeOn': setWake(true, true); return;
      case 'mute': setMute(true); reply('Suara jawaban dimatikan. Jawaban tetap tampil di layar.', { keep: false }); return;
      case 'unmute': setMute(false); reply('Suara jawaban menyala lagi.', { mood: 'happy', keep: false }); return;
      case 'voice': {
        const list = voiceList();
        if (list.cloud.length + list.web.filter((v) => !v.male).length <= 1) {
          reply('Browser ini cuma punya satu suara perempuan bahasa Indonesia, jadi belum ada yang bisa diganti.', { lines: [list.natural ? 'Kecepatan dan nada tetap bisa diatur: "lebih pelan", "nada lebih tinggi".' : 'Buka dashboard di Microsoft Edge untuk suara Gadis Natural yang lebih lembut, atau nyalakan suara Google.'], keep: false });
          return;
        }
        const v = nextVoice();
        pref.voiceId = v.id;
        writePref(pref);
        reply(`Ini suara ${esc(v.name)}. Suka yang ini?`, { mood: 'happy', keep: false, next: ['Ganti suara', 'Lebih pelan', 'Nada lebih tinggi'] });
        return;
      }
      case 'voicePick': {
        const v = findVoice(cmd.name);
        if (!v) {
          const names = [...voiceList().cloud, ...voiceList().web].map((x) => x.name);
          reply(`Suara “${esc(cmd.name)}” tidak ada di browser ini.`, { lines: [names.length ? `Pilihan yang ada: ${esc(names.join(', '))}.` : 'Browser ini tidak punya suara bahasa Indonesia.'], mood: 'confused', keep: false });
          return;
        }
        if (pref.mute) setMute(false);
        chooseVoice(v.id);
        reply(`Siap, sekarang saya pakai suara ${esc(v.name)}. Begini kedengarannya.`, { mood: 'happy', keep: false, next: ['Ganti suara', 'Lebih pelan', 'Lebih cepat'] });
        return;
      }
      case 'voiceList': {
        const { cloud, web } = voiceList();
        const names = [...cloud, ...web].map((x) => x.name);
        reply(names.length ? `Ada ${names.length} pilihan suara: ${esc(names.join(', '))}.` : 'Browser ini tidak punya suara bahasa Indonesia.', { lines: names.length ? [`Bilang “pakai suara ${esc(names[0])}” untuk mengganti.`] : [], keep: false });
        return;
      }
      case 'pitchUp':
      case 'pitchDown': {
        if (usingCloud()) { reply('Nada suara Google tidak bisa diubah. Coba ganti suara, misalnya “pakai suara Aoede”.', { keep: false, next: ['Daftar suara', 'Ganti suara'] }); return; }
        pref.pitch = Math.min(1.3, Math.max(0.8, Math.round(((pref.pitch || 1) + (cmd.type === 'pitchUp' ? 0.06 : -0.06)) * 100) / 100));
        setPitch(pref.pitch);
        writePref(pref);
        reply(cmd.type === 'pitchUp' ? 'Oke, nada saya naikkan sedikit. Segini?' : 'Baik, nada saya turunkan sedikit. Segini?', { keep: false, next: ['Nada lebih tinggi', 'Nada lebih rendah', 'Ganti suara'] });
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
      case 'help': helpCard(cmd.text); return;
      case 'greet': {
        const ask = !pref.name && !pref.askedName;
        if (ask) { pref.askedName = true; writePref(pref); }
        reply(`${salam()}${pref.name ? `, ${esc(pref.name)}` : ''}. ${pickOne(['Ada yang bisa saya bantu?', 'Mau lihat apa hari ini?', 'Senang ketemu lagi. Mau mulai dari mana?'])}`, { lines: [ask ? 'Oh iya, mau dipanggil siapa? Bilang saja, misalnya, "panggil saya Pak Andi".' : 'Contoh: "briefing hari ini", "lihat Bandung", atau "kabar baik hari ini apa".'], next: HINTS, mood: 'happy', keep: false });
        return;
      }
      case 'sumber': set({ sumber: cmd.mode === '7' ? '' : cmd.mode }); reply(`Siap, realisasi sekarang memakai ${esc(cmd.mode)} sumber.`, { mood: 'happy', keep: false }); return;
      case 'nasional': set({ ro: '' }); clearStage(); reply(esc(line('nasional')), { mood: 'happy', next: HINTS, keep: false }); return;
      case 'filter': {
        set({ ro: cmd.ro });
        setMood('happy');
        ding('done');
        say(line('filter', { n: shortRo(cmd.ro) }), { after: close });
        return;
      }
      case 'page': {
        ding('done');
        close();
        location.hash = `#/${cmd.view}`;
        say(line('page', { p: PAGE_NAME[cmd.view] || cmd.view }));
        return;
      }
      case 'pageUnknown': ding('oops'); reply('Halaman itu belum ada.', { lines: ['Halaman yang tersedia: Direktur, Summary, Performance, Realisasi, Portofolio, dan SLA.'], mood: 'confused', next: ['Buka halaman realisasi', 'Buka halaman performance', 'Buka halaman SLA'], keep: false }); return;
      case 'menu': close(); document.getElementById('screen-menu')?.click(); return;
      case 'refresh': document.getElementById('reload')?.click(); reply('Siap, data sedang saya perbarui.', { mood: 'happy', keep: false }); return;
      case 'status': close(); document.querySelector('[data-open-status]')?.click(); return;
      case 'detail': {
        const name = cmd.span ? `${cmd.id === 'real' ? 'realisasi' : 'performance'} ${spanWords(cmd.span)}` : DETAIL_NAME[cmd.id] || 'detail';
        const ro = cmd.ro || showing;
        const where = ro ? ` ${shortRo(ro)}` : '';
        ding('done');
        close();
        openDetail(cmd.id, ro, cmd.span ? { span: cmd.span } : {});
        let more = '';
        if (cmd.id === 'history' && c) {
          const story = periodStory(periodRows(c.pm, ro, cmd.span || '3'), ro ? shortRo(ro) : 'Nasional');
          more = storySpeech(story, { max: pref.short ? 1 : 3 });
        }
        lastAnswer = more ? { text: more, lines: [more] } : lastAnswer;
        say(`${line('detail', { what: `${name}${where}` })} ${more}`);
        return;
      }
      case 'analysis': analysis(cmd.ro || ''); return;
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
      const title = a.title || 'Belum ada jawaban.';
      if (!failed && ros.length === 1 && Math.random() < 0.6) offer = { say: `Lihat ${shortRo(ros[0])}`, ask: `Mau saya tampilkan kondisi lengkap ${shortRo(ros[0])}?` };
      const lead = failed ? line('confused') : line('askLead');
      const tail = failed ? 'Coba pakai kata lain, misalnya "NPL Bandung berapa?"' : offer ? offer.ask : line('askClose');
      lastAnswer = { text: [title, ...lines].map(plain).join(' '), lines };
      reply(title, { lines, chips, next: next.length ? next : HINTS, mood: failed ? 'confused' : 'happy', speakText: [lead, title, tail].filter(Boolean).join(' ') });
    } catch (err) {
      console.error(err);
      reply(pickOne(['Maaf, jawabannya belum bisa dihitung. Coba ulangi dengan kata lain ya.', 'Aduh, ada yang macet waktu menghitung. Boleh diulang dengan kata lain?']), { mood: 'sad' });
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
