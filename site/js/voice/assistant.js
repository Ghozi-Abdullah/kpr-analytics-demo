import { esc, fmt } from '../core/format.js';
import { icon } from '../core/icons.js';
import { ok } from '../core/values.js';
import { shiftMonth } from '../core/dates.js';
import { checkSmooth } from '../core/smooth.js';
import { speakRemote } from '../services/data-source.js';
import { roStanding } from '../models/direktur-model.js';
import { nearSpeech, setMicClean, micClean, micSupport } from './mic.js';
import { voiceSupport, createRecognizer, speak, hush, createLevel, chime, setCloudSpeaker, setVoice, setRate, setPitch, setVolume, nextVoice, usingCloud, voiceList, findVoice, voiceLevel, voiceCue } from './speech.js';
import { mountPuppet } from './puppet.js';
import { HALF, FULL, FACE, HALF_RIG, FULL_RIG, HALF_POSES, FULL_POSES } from './kirana-art.js';
import { routeCommand, findWake, cleanSpoken, spoken, shortRo, targetOf, WAKE_NAME, WAKE_PHRASE } from './command.js';
import { regionData, monthData, MONTH_ROWS, monthTalk, showcaseHtml, regionTalk, compareHtml, compareTalk, flyIn, toneOf, regionMore } from './showcase.js';
import { createPersona, pickOne, salam, partOfDay, clockText, dateText, workdaysLeft, workdaysIn, longDate, parseReminder, nameFrom } from './persona.js';
import { outlook } from '../analytics/outlook.js';
import { pct, tn, realRp } from '../views/direktur-format.js';
import { buildInsights } from '../analytics/insights.js';
import { periodRows, periodStory, storySpeech } from '../analytics/period.js';

const PREF_KEY = 'kpr.assistant';
const FOLLOW_MS = 9000;
const FOLLOW_ASK_MS = 13000;
const ASK_MEMORY_MS = 180000;
const KEEP_CHAIN = new Set(['ack', 'thanks', 'praise', 'wait', 'present', 'laugh', 'wow', 'really', 'yes', 'no', 'hush', 'sorry', 'repeat']);
const COMPARE_KEYS = new Set(['os', 'deb', 'npl', 'sml', 'disb', 'real']);
const ECHO_MS = 450;
const ECHO_TAIL_MS = 1200;
const EARLY_MS = 650;
const MOOD_MS = 2400;
const SLEEP_MS = 30000;
const REGREET_MS = 10 * 60000;
const PET_MS = 1100;
const QUICK = new Set(['bye', 'pageUnknown', 'region', 'detail', 'close', 'filter', 'nasional', 'sumber', 'wakeOff', 'wakeOn', 'mute', 'unmute', 'thanks', 'help', 'yes', 'no', 'hush', 'compare', 'brief', 'page', 'menu', 'back', 'nextRo', 'prevRo', 'repeat', 'slower', 'faster', 'voice', 'praise', 'rankShow']);
const DETAIL_NAME = {
  os: 'outstanding', deb: 'debitur', sml: 'SML', npl: 'NPL', disb: 'disburse', real: 'realisasi',
  split: 'Fix Income dan Non Fix Income', sla: 'berkas SLA', history: 'riwayat bulanan', watch: 'semua RO',
};
const METRIC_NAME = { npl: 'NPL', sml: 'SML', os: 'outstanding', debitur: 'debitur', realisasi: 'realisasi', disburse: 'disburse', growth: 'pertumbuhan OS', runoff: 'runoff', quality: 'kualitas kredit', realdeb: 'debitur baru' };
const PARTS = ['pagi', 'siang', 'sore', 'malam'];
const lowerFirst = (t) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const firstSentence = (t) => (String(t || '').match(/^.*?[.!?](\s|$)/) || [String(t || '')])[0].trim();
const PAGE_NAME = { ringkasan: 'Summary', performance: 'Performance', realisasi: 'Realisasi', portofolio: 'Portofolio', sla: 'SLA', direktur: 'Direktur' };
const HINTS = ['Briefing hari ini', 'Lihat Bandung', 'Kabar baik hari ini apa?', 'RO mana yang perlu perhatian?'];
const HELP = [
  { name: 'Wilayah', key: /wilayah|regional|ro\b/, items: [
    ['Briefing hari ini', 'Ringkasan nasional dan RO yang perlu perhatian'],
    ['Lihat Bandung', 'Empat kartu kondisi satu RO'],
    ['Gimana Jakarta 2?', 'Sama, dengan bahasa santai'],
    ['Tampilkan RO terbaik', 'RO dengan capaian OS tertinggi, juga "terburuk"'],
    ['Berikutnya', 'Pindah ke RO berikutnya, juga "sebelumnya"'],
    ['Kembali', 'Tampilan sebelumnya, juga "ulangi"'],
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
    ['Menurut kamu Bandung gimana?', 'Penilaian Kirana dengan angkanya'],
    ['Saran dong', 'Langkah prioritas dari data'],
    ['Intinya apa?', 'Ringkasan satu kalimat, juga "serius?"'],
    ['Bukan, maksud saya Medan', 'Ralat tanpa mengulang dari awal'],
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
    ['Pertanyaan yang belum bisa dijawab', 'Catatan belajar Kirana, untuk dikirim ke tim'],
  ] },
  { name: 'Suara', key: /suara|voice|volume/, items: [
    ['Stop', 'Kirana berhenti bicara. Bisa juga langsung bicara perintah baru'],
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
    ['Kasih fakta menarik', 'Fakta unik dari data hari ini'],
    ['Habis ini aku ada rapat', 'Kirana tawarkan poin penting'],
    ['Kamu robot ya?', 'Kenalan dengan Kirana'],
    ['Dadah', 'Tutup Kirana, juga "aku makan siang dulu"'],
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

const MISS_KEY = 'kpr.kirana.belajar';
const MISS_MAX = 40;
const readMiss = () => { try { const v = JSON.parse(localStorage.getItem(MISS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const writeMiss = (list) => { try { localStorage.setItem(MISS_KEY, JSON.stringify(list.slice(-MISS_MAX))); } catch {} };
const readPref = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; } };
const writePref = (p) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch {} };
const WIDE_SCREEN = '(min-width: 1100px) and (min-height: 620px)';
const LOG_MAX = 60;
const DOCK_MS = 620;
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
const trimTalk = (text, max = 4) => {
  const parts = String(text).split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length <= max + 1) return text;
  const keep = parts.slice(0, max);
  if (parts.at(-1).endsWith('?')) keep.push(parts.at(-1));
  return keep.join(' ');
};
const NUM_WORD = { nol: '0', satu: '1', dua: '2', tiga: '3', empat: '4', lima: '5', enam: '6', tujuh: '7', delapan: '8', sembilan: '9', sepuluh: '10' };
const SPELLED = [[/\ben pe el\b/g, 'npl'], [/\bes em el\b/g, 'sml'], [/\ber ka a\b/g, 'rka'], [/\bes el a\b/g, 'sla'], [/\bo es\b/g, 'os']];
const tokensOf = (t) => SPELLED.reduce((x, [re, to]) => x.replace(re, to), String(t || '').toLowerCase()).replace(/%/g, ' persen ').replace(/(\d)([a-z])/g, '$1 $2').replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(Boolean).map((w) => NUM_WORD[w] || w);
const STOP = /^(stop|setop|berhenti|diam|diem|cukup|udah|sudah|skip|lewati|tunggu|sebentar|bentar|oke stop|ok stop)( (dulu|deh|kirana|ya|aja|saja|sebentar|ngomong|bicara))*$/;
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

const MOOD_POSE = {
  happy: 'smile', laugh: 'laugh', giggle: 'giggle', love: 'blush', shy: 'blush', joy: 'laugh', excited: 'wave', energetic: 'wave',
  surprised: 'surprised', awed: 'surprised', realize: 'surprised', idea: 'smile', determined: 'smile', sad: 'worried', worried: 'worried',
  confused: 'confused', sleepy: 'sleepy', thinking: 'thinking', wave: 'wave', pout: 'pout',
};
const TALK_POSE = {
  happy: 'talkHappy', laugh: 'talkHappy', giggle: 'talkHappy', love: 'talkHappy', shy: 'talkHappy', joy: 'talkHappy', excited: 'talkHappy',
  energetic: 'talkHappy', wave: 'talkHappy', idea: 'talkHappy', determined: 'talkHappy', sad: 'talkSad', worried: 'talkSad', confused: 'talkThink', thinking: 'talkThink',
};
const poseOf = (state, mood) => (state === 'error' ? 'worried' : state === 'speak' ? TALK_POSE[mood] || 'talk' : MOOD_POSE[mood] || (state === 'think' ? 'thinking' : state === 'listen' ? 'smile' : 'neutral'));
const faceOf = (poses, pose) => poses[pose]?.face || 'neutral';
const fallbackFace = (pose) => (FULL[faceOf(FULL_POSES, pose)] ? faceOf(FULL_POSES, pose) : 'neutral');
const halfHtml = () => Object.entries(HALF).map(([face, src]) => `<i class="kira-pose${face === 'neutral' ? ' on' : ''}" data-face="${face}" style="background-image: url('${src}')"></i>`).join('');
const fullHtml = () => `<span class="blob" aria-hidden="true">${Object.entries(FULL).map(([face, src]) => `<img class="${face === 'neutral' ? 'on' : ''}" data-face="${face}" src="${src}" alt="" decoding="async" draggable="false">`).join('')}</span>`;
export const launchHtml = () => `<span class="blob" aria-hidden="true"><img class="kira-face" src="${FACE.idle}" alt=""><img class="kira-face smile" src="${FACE.smile}" alt=""></span>`;

const FX = `<span class="fx" aria-hidden="true"><i class="q">?</i><i class="zz">z</i><i class="zz">z</i><i class="sp"></i><i class="sp"></i><i class="sp"></i><i class="sp"></i>
  <i class="hrt">${HEART}</i><i class="hrt">${HEART}</i><span class="dots"><b></b><b></b><b></b></span></span>`;
const FX_FULL = `<span class="fx fx-full" aria-hidden="true"><i class="q">?</i><i class="zz">z</i><i class="zz">z</i><i class="sp"></i><i class="sp"></i><i class="sp"></i><i class="sp"></i>
  <i class="hrt">${HEART}</i><i class="hrt">${HEART}</i><i class="ex">!!</i><i class="drop"></i><i class="ang"><svg viewBox="0 0 24 24"><path d="M9 3v4a2 2 0 0 1-2 2H3M15 3v4a2 2 0 0 0 2 2h4M9 21v-4a2 2 0 0 0-2-2H3M15 21v-4a2 2 0 0 1 2-2h4"/></svg></i><i class="blu"><b></b><b></b><b></b></i></span>`;

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
  const pref = { wake: false, mute: false, voiceId: '', rate: 1, pitch: 1, volume: 1, short: false, clean: true, name: '', askedName: false, ...readPref() };
  setMicClean(pref.clean !== false);
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
  let lastTyped = false;
  let autoListen = false;
  let prefix = '';
  let lastFact = -1;
  let focusRo = '';
  let askChain = false;
  let viewCtx = null;
  let askAt = 0;
  let wakeAckTimer = 0;
  let petTimer = 0;
  let petAt = 0;
  let greetFeel = false;
  let speakingNow = false;
  let selfWords = new Set();
  let lastSelf = new Set();
  let selfUntil = 0;
  let autoTimer = 0;
  let bargeTries = 0;
  const feel = { tired: false, sad: false };
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
  let avatar = null;
  let figure = null;
  let lastUserMsg = null;
  let sayLogged = true;
  let logStick = true;
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
  let followRaf = 0;
  let helloAt = 0;
  let cardAt = -1e9;
  const early = { timer: 0, text: '', done: '' };
  const $ = (id) => dlg?.querySelector(`#${id}`);
  const level = createLevel((v) => { $('va-panel')?.style.setProperty('--lvl', v.toFixed(3)); avatar?.listen(v); figure?.listen(v); });
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
      <section class="va-panel" id="va-panel" aria-label="Obrolan dengan ${esc(WAKE_NAME)}">
        <div class="va-log" id="va-log" role="log" aria-label="Riwayat obrolan" tabindex="0"></div>
        <div class="va-scene">
          <div class="va-bubble"><p class="va-say" id="va-say" aria-live="polite"></p></div>
          <button class="va-full" type="button" id="va-full" aria-label="Bicara ke ${esc(WAKE_NAME)}">${fullHtml()}${FX_FULL}</button>
          <button class="va-orb" type="button" id="va-orb" aria-label="Bicara ke ${esc(WAKE_NAME)}"><span class="halo" aria-hidden="true"></span><span class="blob" aria-hidden="true">${halfHtml()}</span>${FX}</button>
        </div>
        <p class="va-heard" id="va-heard" aria-live="polite"></p>
        <p class="va-status" id="va-status" role="status"></p>
        <div class="va-next" id="va-next"></div>
        <div class="va-bar">
          <form class="va-type" id="va-type">
            <input id="va-input" type="text" autocomplete="off" enterkeyhint="send" placeholder="Tanya Kirana…" aria-label="Pesan untuk ${esc(WAKE_NAME)}">
            <button type="submit" aria-label="Kirim">${icon('send', 16)}</button>
          </form>
          <button class="va-mic" type="button" id="va-mic" aria-label="Bicara ke ${esc(WAKE_NAME)}" aria-pressed="false">${MIC}</button>
        </div>
      </section>`;
    document.body.append(dlg);
    orbEl = $('va-orb');
    const log = $('va-log');
    log.addEventListener('scroll', () => { logStick = log.scrollHeight - log.scrollTop - log.clientHeight < 40; }, { passive: true });
    new ResizeObserver(() => { if (logStick) log.scrollTop = log.scrollHeight; }).observe(log);
    avatar = mountPuppet(orbEl, { faces: HALF, rig: HALF_RIG, poses: HALF_POSES, voiceLevel, voiceCue });
    figure = mountPuppet($('va-full'), { faces: FULL, rig: FULL_RIG, poses: FULL_POSES, voiceLevel, voiceCue });
    suggest(HINTS);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    dlg.addEventListener('click', onClick);
    dlg.addEventListener('pointermove', onPointer, { passive: true });
    $('va-close').addEventListener('click', close);
    const talkToggle = () => (phase === 'listen' ? stopListening() : listen());
    $('va-orb').addEventListener('click', talkToggle);
    $('va-full').addEventListener('click', talkToggle);
    $('va-mic').addEventListener('click', talkToggle);
    $('va-wake').addEventListener('click', () => setWake(!pref.wake, true));
    $('va-mute').addEventListener('click', () => setMute(!pref.mute));
    $('va-type').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('va-input').value.trim();
      $('va-input').value = '';
      if (v) handle(v, { typed: true });
    });
    $('va-input').addEventListener('input', () => { awake(); stopTalking(); if (dlg.dataset.layout !== 'chat') figure?.look(-0.1, 0.9); });
    syncPills();
  }

  function onPointer(e) {
    if (pointerRaf) return;
    pointerRaf = requestAnimationFrame(() => {
      pointerRaf = 0;
      if (!orbEl || !dlg) return;
      const chat = dlg.dataset.layout === 'chat';
      const r = (chat ? orbEl : $('va-full')).getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / 320;
      const dy = (e.clientY - (r.top + r.height * (chat ? 0.5 : 0.12))) / 320;
      (chat ? avatar : figure)?.look(dx, dy);
      pet(!chat && Math.abs(e.clientX - (r.left + r.width / 2)) < r.width * 0.14 && e.clientY > r.top && e.clientY < r.top + r.height * 0.13);
    });
    awake();
  }

  function pet(on) {
    if (!on) { clearTimeout(petTimer); petTimer = 0; return; }
    if (petTimer || Date.now() - petAt < 12000) return;
    petTimer = setTimeout(() => {
      petTimer = 0;
      if (!isOpen() || dlg.dataset.layout === 'chat' || !['idle', 'listen'].includes(phase) || speakingNow || dlg.dataset.mood) return;
      petAt = Date.now();
      setMood(pickOne(['shy', 'giggle']), 2400);
    }, PET_MS);
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
    const mon = e.target.closest('[data-va-month]');
    if (mon) { showMonth(mon.dataset.vaRo || '', mon.dataset.vaMonth); return; }
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
    if (next !== 'think') $('va-say')?.classList.remove('typing');
    syncPose();
    if (next === 'listen' && dlg.open && voiceSupport.level) level.start();
    const idleText = !voiceSupport.listen ? ERRORS.unsupported
      : pref.wake ? `Ucapkan "${WAKE_PHRASE}" atau ketuk mic untuk bicara`
        : matchMedia('(pointer: fine)').matches ? 'Klik Kirana atau tekan Ctrl+Spasi untuk bicara' : 'Ketuk mic untuk bicara';
    let listenText = 'Mendengarkan';
    if (next === 'listen' && greetOnOpen) {
      greetOnOpen = false;
      listenText = 'Silakan bicara, saya dengarkan';
    }
    $('va-status').textContent = text || { listen: listenText, think: 'Sebentar ya', speak: '', idle: idleText, error: '' }[next] || '';
    if (next === 'idle') snooze();
  }

  function syncPose() {
    const orb = $('va-orb');
    if (!orb || !dlg) return;
    const pose = poseOf(dlg.dataset.state, dlg.dataset.mood);
    const fullEl = $('va-full');
    orb.dataset.pose = pose;
    fullEl.dataset.pose = pose;
    orb.querySelectorAll('.kira-pose').forEach((el) => el.classList.toggle('on', el.dataset.face === faceOf(HALF_POSES, pose)));
    fullEl.querySelectorAll('img').forEach((el) => el.classList.toggle('on', el.dataset.face === fallbackFace(pose)));
    $('va-mic').setAttribute('aria-pressed', String(dlg.dataset.state === 'listen'));
  }

  function setMood(mood, ms = MOOD_MS) {
    if (!dlg) return;
    clearTimeout(moodTimer);
    dlg.dataset.mood = mood;
    syncPose();
    if (mood && ms) moodTimer = setTimeout(() => { if (dlg && dlg.dataset.mood === mood) { dlg.dataset.mood = ''; syncPose(); } }, ms);
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
    if (kind === 'show') cardAt = performance.now();
    if (kind === 'show' && dlg.open) dock();
  }

  const isOpen = () => !!dlg?.open;

  function open({ listenNow = true, focusInput = false, greet = false } = {}) {
    build();
    let hello = '';
    if (!dlg.open) {
      dlg.showModal();
      dlg.dataset.layout = 'intro';
      figure?.start();
      setStage(showing || $('va-stage').childElementCount ? 'show' : 'empty');
      checkSmooth();
      hello = line(Date.now() - helloAt < REGREET_MS ? 'helloAgain' : 'hello', { salam: salam(), nm: pref.name ? `, ${pref.name}` : '' });
      helloAt = Date.now();
      setMood('wave', 2600);
      greetOnOpen = true;
    }
    const voiced = !!hello && greet && !pref.mute && (voiceSupport.speak || usingCloud());
    if (hello && !voiced) { setSay(hello); sayLogged = true; }
    if (phase !== 'think') setPhase('idle');
    if (focusInput || !voiceSupport.listen || matchMedia('(pointer: fine)').matches) $('va-input').focus({ preventScroll: true });
    else $(dlg.dataset.layout === 'chat' ? 'va-orb' : 'va-mic').focus({ preventScroll: true });
    if (voiced) {
      lastTyped = !listenNow;
      setMood('wave', 0);
      greetFeel = true;
      say(hello);
      sayLogged = true;
      return true;
    }
    if (listenNow && voiceSupport.listen) listen();
    return false;
  }

  function close() {
    if (!dlg?.open) return;
    greetFeel = false;
    clearTimeout(wakeAckTimer);
    hush();
    speakingUntil = 0;
    clearTimeout(followTimer);
    clearTimeout(early.timer);
    clearTimeout(sleepTimer);
    followUntil = 0;
    offer = null;
    trail = [];
    level.stop();
    if (mode === 'command' || mode === 'barge') { rec.abort(); mode = 'off'; }
    speakingNow = false;
    clearTimeout(autoTimer);
    dlg.close();
    avatar?.stop();
    figure?.stop();
    clearStage();
    $('va-heard').textContent = '';
    suggest(HINTS);
    setMood('');
    setPhase('idle');
    clearTimeout(sleepTimer);
    if (pref.wake) startWake();
    syncPills();
  }

  function dock() {
    if (!dlg || dlg.dataset.layout === 'chat') return;
    const panel = $('va-panel');
    const from = panel.getBoundingClientRect();
    dlg.dataset.layout = 'chat';
    figure?.stop();
    avatar?.start();
    scrollLog(true);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const easing = 'cubic-bezier(.2, .8, .2, 1)';
    if (matchMedia(WIDE_SCREEN).matches) {
      const to = panel.getBoundingClientRect();
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.bottom - to.bottom;
      panel.animate([{ transform: `translate(${dx}px, ${dy}px)`, opacity: 0.6 }, { transform: 'none', opacity: 1 }], { duration: DOCK_MS, easing });
    }
    $('va-orb').animate([{ opacity: 0, transform: 'translateY(28px) scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: DOCK_MS * 0.45, easing, fill: 'backwards' });
  }

  function flushSay() {
    const el = $('va-say');
    if (el && !sayLogged && el.textContent) logMsg('kira', el.textContent);
    sayLogged = true;
  }

  function briefOf(text) {
    const all = plain(text).replace(/\s+/g, ' ').trim();
    if (all.length <= 170) return all;
    const parts = all.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/);
    const last = parts.at(-1);
    return [...parts.slice(0, 2), ...(parts.length > 2 && /\?$/.test(last) ? [last] : [])].join(' ');
  }

  function setSay(text) {
    const el = $('va-say');
    if (!el) return;
    flushSay();
    el.classList.remove('typing');
    el.textContent = plain(text);
    el.scrollTop = 0;
    sayLogged = !el.textContent;
  }

  function followSay(out) {
    const el = $('va-say');
    cancelAnimationFrame(followRaf);
    if (!el) return;
    const tick = () => {
      if (!speakingNow || !isOpen()) return;
      const room = el.scrollHeight - el.clientHeight;
      const c = room > 4 && !el.matches(':hover') ? voiceCue() : null;
      if (c) {
        const at = Math.max(0, out.indexOf(c.text));
        const goal = Math.max(0, Math.min(1, (at + c.index) / out.length - 0.15)) * room;
        el.scrollTop += (goal - el.scrollTop) * 0.1;
      }
      followRaf = requestAnimationFrame(tick);
    };
    followRaf = requestAnimationFrame(tick);
  }

  function typing() {
    const el = $('va-say');
    if (!el) return;
    flushSay();
    el.textContent = '';
    el.classList.add('typing');
  }

  function scrollLog(force = false) {
    const log = $('va-log');
    if (!log) return;
    if (force) logStick = true;
    if (logStick) log.scrollTop = log.scrollHeight;
  }

  function logMsg(who, text) {
    if (!dlg) return null;
    const clean = plain(text);
    if (!clean) return null;
    const log = $('va-log');
    const msg = document.createElement('p');
    msg.className = `va-msg ${who}`;
    msg.textContent = clean;
    log.append(msg);
    while (log.childElementCount > LOG_MAX) log.firstElementChild.remove();
    scrollLog(who === 'me');
    return msg;
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
    speakingNow = false;
    clearTimeout(autoTimer);
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
    clearTimeout(autoTimer);
    if (mode === 'command' || mode === 'barge') { rec.abort(); mode = 'off'; }
    ding('off');
    setPhase('idle');
  }

  function follow(ms = FOLLOW_MS) {
    clearTimeout(followTimer);
    followUntil = Date.now() + ms;
    followTimer = setTimeout(() => { if (phase === 'listen' && pref.wake) setPhase('idle'); }, ms);
  }

  function keepListening() {
    mode = 'command';
    autoListen = true;
    ding('on');
    setPhase('listen', pickOne(['Silakan jawab', 'Saya dengarkan', 'Iya atau tidak?']));
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if (mode !== 'command' || !autoListen) return;
      rec.abort();
      mode = 'off';
      autoListen = false;
      ding('off');
      setPhase('idle');
    }, 8000);
  }

  function startBarge() {
    mode = 'barge';
    if (!rec.start({ continuous: true })) mode = 'off';
  }

  function endGreet() {
    if (!greetFeel) return;
    greetFeel = false;
    if (dlg?.dataset.mood === 'wave') setMood('happy', 1500);
  }

  function stopTalking() {
    endGreet();
    if (!speakingNow) return;
    hush();
    speakingNow = false;
    speakingUntil = 0;
    if (mode === 'barge') { rec.abort(); mode = 'off'; }
    setPhase('idle');
  }

  function selfSet() {
    const c = speakingNow ? voiceCue() : null;
    if (c) lastSelf = new Set(tokensOf(`${c.before || ''} ${c.text.slice(0, c.index + 24)}`.slice(-190)));
    return lastSelf.size ? lastSelf : selfWords;
  }

  function echoScore(text) {
    if (!speakingNow && Date.now() > selfUntil) return 0;
    const tk = tokensOf(text);
    if (!tk.length) return 0;
    const own = selfSet();
    const pool = [...own].filter((w) => w.length >= 4);
    const hit = tk.filter((w) => own.has(w) || (w.length >= 4 && pool.some((x) => x.includes(w) || w.includes(x)))).length;
    return hit / tk.length;
  }

  function interrupts(text, final) {
    if (findWake(text)) return true;
    const tk = tokensOf(text);
    const echo = echoScore(text);
    if (STOP.test(tk.join(' ')) && echo < 1) return true;
    return (tk.length >= 3 || (final && tk.length >= 2)) && echo < 0.4;
  }

  function bargeIn() {
    hush();
    speakingNow = false;
    speakingUntil = 0;
    selfUntil = 0;
    clearTimeout(wakeAckTimer);
    if (mode === 'barge') { mode = 'command'; autoListen = false; }
    if (mode === 'wake') follow();
    setMood('surprised', 600);
    setPhase('listen');
  }

  function listenAgain() {
    if (mode !== 'off' || !voiceSupport.listen) { setPhase('idle'); return; }
    mode = 'command';
    autoListen = true;
    if (rec.start({ continuous: false })) { ding('on'); setPhase('listen', pickOne(['Silakan jawab', 'Saya dengarkan', 'Iya atau tidak?'])); }
    else { mode = 'off'; autoListen = false; setPhase('idle'); }
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
      if (fromUser) reply('Mode dengar dimatikan. Klik saya kalau mau bicara.');
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

  function heardFinal(text, alts, loose = false) {
    clearTimeout(early.timer);
    if (sameText(early.done, text)) { early.done = ''; return; }
    early.done = '';
    handle(bestOf(text, alts), { loose });
  }

  function onResult({ text, alts, final }) {
    const strict = mode === 'wake' || mode === 'barge' || speakingNow || autoListen;
    if (strict && rec.cleaned && !nearSpeech()) return;
    if (speakingNow) {
      if (!interrupts(text, final)) return;
      bargeIn();
    } else if (Date.now() < speakingUntil) return;
    else if (Date.now() < selfUntil && tokensOf(text).length >= 3 && echoScore(text) >= 0.6) return;
    awake();
    if (mode === 'wake') {
      const wake = findWake(text);
      if (!isOpen()) {
        if (!wake) return;
        const greeted = open({ listenNow: false, greet: !wake.rest });
        ding('on');
        if (!greeted) setPhase('listen');
        follow();
        if (wake.rest) { showHeard(wake.rest, final); if (final) heardFinal(wake.rest); else heardEarly(wake.rest); }
        return;
      }
      const cmd = wake ? wake.rest : text;
      if (wake) { follow(); if (phase !== 'think') setPhase('listen'); setMood('surprised', 700); }
      if (!wake && Date.now() > followUntil) return;
      clearTimeout(wakeAckTimer);
      if (!cmd) {
        if (wake && final) wakeAckTimer = setTimeout(() => { if (isOpen() && phase === 'listen') talkOnly(line('wakeAck', { nm: pref.name ? `, ${pref.name}` : '' }), 'wave'); }, 1100);
        return;
      }
      showHeard(cmd, final);
      if (final) heardFinal(cmd, wake ? null : alts, !wake); else heardEarly(cmd);
      return;
    }
    if (mode === 'command') {
      showHeard(text, final);
      if (final) {
        const loose = autoListen;
        mode = 'off';
        autoListen = false;
        clearTimeout(autoTimer);
        rec.abort();
        heardFinal(text, alts, loose);
      } else heardEarly(text);
    }
  }

  function onEnd() {
    if (mode === 'barge') {
      mode = 'off';
      if (speakingNow && bargeTries < 3) { bargeTries += 1; startBarge(); }
      return;
    }
    if (mode === 'wake') {
      quickEnds += 1;
      const wait = quickEnds > 4 ? Math.min(30000, 1000 * 2 ** (quickEnds - 4)) : 250;
      clearTimeout(restartTimer);
      restartTimer = setTimeout(startWake, wait);
      return;
    }
    if (mode === 'command') {
      mode = 'off';
      if (phase === 'listen') { ding('off'); setPhase('idle', autoListen ? '' : 'Tidak terdengar perintah. Klik Kirana dan bicara lagi.'); }
      autoListen = false;
    }
  }

  function onError(err) {
    if (err === 'aborted') return;
    if (mode === 'barge') { mode = 'off'; return; }
    if (err === 'no-speech') {
      if (mode === 'command') { mode = 'off'; ding('off'); setPhase('idle', autoListen ? '' : 'Tidak terdengar suara. Klik Kirana dan bicara lagi.'); autoListen = false; }
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

  function say(text, { after, full = false, show = '' } = {}) {
    if (prefix && text) { text = `${prefix} ${text}`; if (show) show = `${prefix} ${show}`; }
    prefix = '';
    if (text && isOpen()) setSay(show || (performance.now() - cardAt < 1500 ? briefOf(text) : text));
    const feelNow = dlg?.dataset.mood || '';
    const asking = /\?\s*$/.test(plain(text));
    const done = () => {
      endGreet();
      after?.();
      if (!isOpen()) { if (mode === 'barge') { rec.abort(); mode = 'off'; } return; }
      if (pref.wake && voiceSupport.listen) { follow(asking ? FOLLOW_ASK_MS : FOLLOW_MS); setPhase('listen'); }
      else if (asking && !after && !lastTyped && voiceSupport.listen) { if (mode === 'barge') keepListening(); else listenAgain(); }
      else { if (mode === 'barge') { rec.abort(); mode = 'off'; } setPhase('idle'); }
    };
    if (text) lastSpeech = text;
    if (!text || pref.mute || (!voiceSupport.speak && !usingCloud())) { done(); return; }
    if (isOpen()) setPhase('think', usingCloud() ? 'Menyiapkan suara' : '');
    speakingUntil = Date.now() + 60000;
    const words = spoken(text);
    const out = pref.short ? shorten(words) : full ? words : trimTalk(words);
    selfWords = new Set([...tokensOf(plain(text)), ...tokensOf(out)]);
    lastSelf = new Set();
    speakingNow = true;
    bargeTries = 0;
    if (!pref.wake && voiceSupport.listen && !lastTyped && mode === 'off' && matchMedia('(pointer: fine)').matches) startBarge();
    speak(out, {
      onStart: () => { if (isOpen()) { setPhase('speak'); followSay(out); } },
      onEnd: () => {
        lastSelf = new Set(tokensOf(out.slice(-180)));
        speakingNow = false;
        const keepFeel = dlg?.dataset.mood || feelNow;
        if (isOpen() && keepFeel && !['sleepy', 'wave'].includes(keepFeel)) setMood(keepFeel, 1800);
        speakingUntil = Date.now() + ECHO_MS;
        selfUntil = Date.now() + ECHO_TAIL_MS;
        done();
      },
    });
  }

  function remember(entry) {
    trail.push(entry);
    if (trail.length > 12) trail.shift();
  }

  function reply(html, { title = '', chips = [], lines = [], speakText, next = null, mood = '', keep = true, full = false } = {}) {
    build();
    if (!keep && !title && !chips.length) {
      if (next) suggest(next);
      if (mood) setMood(mood);
      say(speakText ?? html, { full, show: [plain(html), ...lines.map(plain)].filter(Boolean).join(' ') });
      return;
    }
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
    say(speakText ?? html, { full });
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
    focusRo = d.ro || '';
    offer = talk.offer;
    suggest(talk.next);
    setMood({ good: 'excited', bad: 'worried' }[toneOf(d)] || 'happy');
    ding('done');
    remember({ kind: 'region', args: [ro] });
    say(quiet ? `Kembali ke ${d.name}.` : talk.text);
    return talk;
  }

  function showCompare(roA, roB, focus = '', { quiet = false, month = null } = {}) {
    const c = getContext();
    if (!c) return;
    const ym = month ? (typeof month === 'string' ? month : monthOf(month, c)) : '';
    const a = ym ? monthData(c, roA, ym, { label: 'place' }) : regionData(c, roA);
    const b = ym ? monthData(c, roB, ym, { label: 'place' }) : regionData(c, roB);
    if (ym && (!a.now?.end || !b.now?.end)) { noMonth(ym, c); return; }
    if (!a.now?.end || !b.now?.end) { reply('Data salah satu RO belum ada.', { mood: 'confused' }); return; }
    const key = COMPARE_KEYS.has(focus) ? focus : '';
    build();
    showing = '';
    const stage = $('va-stage');
    stage.innerHTML = ym ? compareHtml(a, b, key, { list: MONTH_ROWS, pick: (d) => `data-va-month="${esc(ym)}" data-va-ro="${esc(d.ro)}"` }) : compareHtml(a, b, focus);
    setStage('show');
    flyIn(stage, $('va-orb'));
    offer = { say: `Lihat ${a.name}`, ask: '' };
    suggest([`Lihat ${a.name}`, `Lihat ${b.name}`, `Fokus ke ${a.name}`]);
    setMood('happy');
    ding('done');
    remember({ kind: 'compare', args: [roA, roB, focus, ym] });
    lastRegion = null;
    const when = ym ? ` Posisi akhir ${a.when}.` : '';
    say(quiet ? `Kembali ke perbandingan ${a.name} dan ${b.name}.` : `${line('compare', { a: a.name, b: b.name })}${when} ${ym ? compareTalk(a, b, key, { list: MONTH_ROWS }) : compareTalk(a, b, focus)} Mau saya buka salah satunya?`);
  }

  function monthOf(spec, c) {
    if (typeof spec === 'string') return spec;
    const cur = c.cur;
    if (spec.rel != null) return shiftMonth(cur, spec.rel);
    const cy = Number(cur.slice(0, 4));
    const y = spec.y ?? (spec.lastYear ? cy - 1 : cy);
    const mm = String(spec.m).padStart(2, '0');
    const ym = `${y}-${mm}`;
    return spec.y == null && !spec.lastYear && ym > cur ? `${y - 1}-${mm}` : ym;
  }

  function noMonth(ym, c) {
    const first = c.pm.months.find((m) => perfPeriods1(c, m));
    chat(`Data ${fmt.month(ym)} belum ada. Yang tersedia ${first ? fmt.month(first) : 'awal data'} sampai ${fmt.month(c.cur)}.`, {
      mood: 'confused', next: [`Lihat ${fmt.month(c.cur)}`, `Lihat ${fmt.month(shiftMonth(c.cur, -1))}`, 'Performance 6 bulan'],
    });
  }

  function perfPeriods1(c, ym) {
    return !!monthData(c, '', ym).now?.end;
  }

  function showMonth(ro, spec, { quiet = false } = {}) {
    const c = getContext();
    if (!c) return;
    const ym = monthOf(spec, c);
    if (ym === c.cur) { showRegion(ro, { quiet }); return; }
    const d = regionData(c, ro, ym);
    if (!d.now?.end) { noMonth(ym, c); return; }
    d.place = d.name;
    d.when = fmt.month(ym);
    focusRo = ro || '';
    const p = d.now;
    const b = d.before?.end ? d.before : null;
    const grow = b && ok(p.os) && ok(b.os) ? p.os - b.os : null;
    const nplOver = ok(p.nplPct) && ok(p.rkaNplPct) && p.nplPct > p.rkaNplPct;
    const head = `${d.when}, ${d.place}: outstanding ${tn(p.os)}${ok(p.achOs) ? `, ${pct(p.achOs, 1)} dari RKA` : ''}.`;
    const debTxt = ok(p.deb) ? `debitur ${fmt.num(p.deb)}${b && ok(b.deb) ? ` (${p.deb - b.deb >= 0 ? '+' : '−'}${fmt.num(Math.abs(p.deb - b.deb))})` : ''}` : '';
    const lines = [
      ok(grow) ? `${grow >= 0 ? 'Tumbuh' : 'Turun'} ${tn(Math.abs(grow))} dari akhir ${fmt.month(b.month)}${debTxt ? `; ${debTxt}` : ''}.` : debTxt ? `${debTxt.charAt(0).toUpperCase()}${debTxt.slice(1)}.` : '',
      ok(p.nplPct) ? `%NPL ${pct(p.nplPct)}${ok(p.rkaNplPct) ? `, ${nplOver ? 'di atas' : 'di bawah'} RKA ${pct(p.rkaNplPct)}` : ''}${ok(p.smlPct) ? `; %SML ${pct(p.smlPct)}${ok(p.rkaSmlPct) ? `, ${p.smlPct > p.rkaSmlPct ? 'di atas' : 'di bawah'} RKA ${pct(p.rkaSmlPct)}` : ''}` : ''}.` : '',
      ok(p.disb) ? `Disburse ${p.full ? 'sebulan' : `sampai ${fmt.date(p.date)}`} ${tn(p.disb)}${ok(p.achDisb) ? `, ${pct(p.achDisb, 1)} dari guidance ${tn(p.guidance)}` : ''}.` : '',
      ok(d.real?.total) ? `Realisasi ${realRp(d.real.total)}${ok(d.real.change) ? ` (${fmt.signedPct(d.real.change, 1)} dari bulan sebelumnya)` : ''}.` : '',
    ].filter(Boolean);
    const now = fmt.month(c.cur);
    const where = ro ? `${d.place} ` : '';
    offer = ym === c.cur
      ? { say: `Performance ${d.place} 3 bulan`, ask: 'Mau lihat tren tiga bulannya?' }
      : { say: `Bandingkan ${where}${d.when} dan ${now}`, ask: `Mau saya bandingkan dengan ${now}?` };
    const next = [offer.say, `Lihat ${where}${fmt.month(shiftMonth(ym, -1))}`];
    if (ym < c.cur) next.push(`Lihat ${where}${fmt.month(shiftMonth(ym, 1))}`);
    lastAnswer = { text: [head, ...lines].join(' '), lines, fact: head };
    lastRegion = null;
    viewCtx = { kind: 'month', ro, months: [ym], at: Date.now() };
    remember({ kind: 'month', args: [ro, ym] });
    build();
    showing = ro || '';
    const stage = $('va-stage');
    stage.innerHTML = showcaseHtml(d);
    setStage('show');
    flyIn(stage, $('va-orb'));
    suggest(next);
    setMood(nplOver || (ok(p.achOs) && p.achOs < 0.95) ? '' : 'happy');
    ding('done');
    say(quiet ? `Kembali ke ${d.when}.` : `${pickOne(['Oke, ini', 'Siap, ini posisi', 'Baik, ini'])} ${head} ${lines.slice(0, 3).join(' ')} ${offer.ask}`);
  }

  function targetGap(ro, focus) {
    const c = getContext();
    if (!c) return;
    const d = regionData(c, ro);
    const p = d.now || {};
    if (!p.end) { chat(`Data ${shortRo(ro) || 'Nasional'} belum ada.`, { mood: 'confused' }); return; }
    focusRo = ro || '';
    const day = Number(String(p.date).slice(8, 10));
    const done = workdaysIn(p.month, 1, day);
    const left = p.full ? 0 : workdaysIn(p.month, day + 1);
    const month = fmt.month(p.month);
    let head = '';
    const lines = [];
    let chips = [];
    let mood = 'happy';
    if (focus === 'disb' || focus === 'pace') {
      const rem = ok(p.guidance) && ok(p.disb) ? p.guidance - p.disb : null;
      const perDay = done ? p.disb / done : null;
      head = focus === 'pace'
        ? `Rata-rata disburse ${d.name} ${month} ${tn(perDay)} per hari kerja, dari total ${tn(p.disb)} dalam ${done} hari kerja.`
        : `Disburse ${d.name} ${month} ${tn(p.disb)}, ${pct(p.achDisb, 1)} dari guidance ${tn(p.guidance)}.`;
      if (ok(rem)) {
        if (p.full) lines.push(rem > 0 ? `Bulan sudah selesai, kurang ${tn(rem)} dari guidance.` : `Bulan sudah selesai, guidance terlampaui ${tn(-rem)}.`);
        else if (rem > 0 && left) lines.push(`Sisa ${tn(rem)} ke guidance, artinya perlu ${tn(rem / left)} per hari kerja selama ${left} hari kerja tersisa${ok(perDay) ? `, ${pct(rem / left / perDay, 0)} dari laju sekarang` : ''}.`);
        else lines.push(rem > 0 ? `Masih kurang ${tn(rem)} dari guidance.` : `Guidance sudah terlampaui ${tn(-rem)}.`);
        if (rem > 0) mood = '';
      }
      if (ok(p.progDisb)) lines.push(`Terhadap prognosa ${tn(p.prognosa)}: ${pct(p.progDisb, 1)}.`);
      chips = [{ k: 'Disburse', v: tn(p.disb) }, { k: 'Guidance', v: tn(p.guidance) }, { k: 'Capaian', v: pct(p.achDisb, 1) }, { k: 'Per hari kerja', v: tn(perDay) }];
    } else if (focus === 'os' || focus === 'deb') {
      const os = focus === 'os';
      const show = os ? tn : (x) => `${fmt.num(x)} debitur`;
      const [v, rka, ach] = os ? [p.os, p.rkaOs, p.achOs] : [p.deb, p.rkaDeb, p.achDeb];
      head = `Capaian RKA ${os ? 'outstanding' : 'debitur'} ${d.name} ${pct(ach, 1)}: ${show(v)} dari RKA ${show(rka)}.`;
      if (ok(v) && ok(rka)) {
        const gap = rka - v;
        lines.push(gap > 0 ? `Masih kurang ${show(gap)} untuk 100%.` : `Sudah melampaui RKA ${show(-gap)}.`);
        if (gap > 0) mood = '';
        const b = d.before?.end ? d.before : null;
        if (os && b && ok(b.os)) lines.push(`Bulan ${month} outstanding ${p.os >= b.os ? 'tumbuh' : 'turun'} ${tn(Math.abs(p.os - b.os))} dari akhir ${fmt.month(b.month)}.`);
      }
      chips = [{ k: os ? 'Outstanding' : 'Debitur', v: show(v) }, { k: 'RKA', v: show(rka) }, { k: 'Capaian', v: pct(ach, 1) }];
    } else {
      const npl = focus === 'npl';
      const [now, rka] = npl ? [p.nplPct, p.rkaNplPct] : [p.smlPct, p.rkaSmlPct];
      const name = npl ? 'NPL' : 'SML';
      head = `%${name} ${d.name} ${pct(now)} terhadap RKA ${pct(rka)}.`;
      if (ok(now) && ok(rka)) {
        const over = now - rka;
        lines.push(over > 0 ? `Di atas RKA ${fmt.num(over * 100, 2)} poin, setara sekitar ${tn(over * p.os)} kredit yang perlu diselesaikan.` : `Masih di bawah RKA ${fmt.num(-over * 100, 2)} poin.`);
        if (over > 0) mood = 'sad';
      }
      chips = [{ k: `%${name}`, v: pct(now) }, { k: 'RKA', v: pct(rka) }];
    }
    offer = { say: ro ? `Saran untuk ${d.name}` : 'Saran dong', ask: pickOne(['Mau saya kasih saran langkahnya?', 'Perlu saran untuk mengejarnya?']) };
    lastAnswer = { text: [head, ...lines].join(' '), lines, fact: head };
    reply(esc(head), {
      title: `Posisi ${fmt.date(p.date)}`, lines: lines.map(esc), chips: chips.filter((x) => x.v && x.v !== '–'), mood,
      next: [offer.say, ro ? `Lihat ${d.name}` : 'Briefing hari ini', 'Proyeksi akhir tahun'],
      speakText: `${head} ${lines.join(' ')} ${mood ? '' : offer.ask}`,
    });
  }

  function ratioForecast(ro, focus) {
    const c = getContext();
    if (!c) return;
    const rows = periodRows(c.pm, ro, '3').filter((x) => ok(x.smlPct) && ok(x.nplPct));
    const name = ro ? shortRo(ro) : 'Nasional';
    if (rows.length < 3) { chat('Riwayat belum cukup untuk proyeksi.', { mood: 'confused' }); return; }
    focusRo = ro || '';
    const get = (x) => (focus === 'npl' ? x.nplPct : x.smlPct);
    const steps = rows.slice(1).map((x, i) => get(x) - get(rows[i])).sort((a, b) => a - b);
    const step = steps[Math.floor(steps.length / 2)];
    const last = rows.at(-1);
    const next = Math.max(0, get(last) + step);
    const rka = focus === 'npl' ? last.rkaNplPct : last.rkaSmlPct;
    const label = focus === 'npl' ? 'NPL' : 'SML';
    const nextMonth = fmt.month(shiftMonth(last.month, 1));
    const head = `Kalau tren tiga bulan terakhir berlanjut, %${label} ${name} akhir ${nextMonth} sekitar ${pct(next)} (sekarang ${pct(get(last))}).`;
    const lines = [
      `Rata-rata pergerakan per bulan ${step >= 0 ? 'naik' : 'turun'} ${fmt.num(Math.abs(step) * 100, 2)} poin.`,
      ok(rka) ? (next > rka ? `Itu di atas RKA ${pct(rka)}, jadi perlu penagihan lebih awal.` : `Masih di bawah RKA ${pct(rka)}.`) : '',
      ok(last.os) ? `Setara nominal ${label} sekitar ${tn(next * last.os)} bila OS tetap.` : '',
    ].filter(Boolean);
    offer = { say: ro ? `Detail ${label} ${name}` : `Detail ${label}`, ask: `Mau lihat detail ${label}-nya?` };
    lastAnswer = { text: [head, ...lines].join(' '), lines, fact: head };
    reply(esc(head), { title: 'Proyeksi sederhana', lines: lines.map(esc), mood: ok(rka) && next > rka ? 'worried' : 'idea', next: [offer.say, 'Saran dong', `Tren ${label} 6 bulan`], speakText: `${head} ${lines.join(' ')} ${offer.ask}` });
  }

  function yearEnd(ro) {
    const c = getContext();
    if (!c) return;
    const o = outlook(c.pm, { ro, real: c.realModel || null, perRo: false });
    const name = ro ? shortRo(ro) : 'Nasional';
    const curYear = c.cur.slice(0, 4);
    const dec = `${curYear}-12`;
    if (!o?.year?.base?.path) { chat('Riwayat data belum cukup untuk proyeksi akhir tahun.', { mood: 'confused' }); return; }
    focusRo = ro || '';
    const at = (path) => path?.find((x) => x.month === dec)?.os;
    const base = c.cur >= dec ? regionData(c, ro).now?.os : at(o.year.base.path);
    const low = at(o.year.low?.path);
    const high = at(o.year.cap?.path);
    const p = regionData(c, ro).now || {};
    const rows = periodRows(c.pm, ro, '3').filter((x) => ok(x.rkaOs));
    const steps = rows.slice(1).map((x, i) => x.rkaOs - rows[i].rkaOs);
    const step = steps.length ? steps.sort((a, b) => a - b)[Math.floor(steps.length / 2)] : null;
    const monthsLeft = Math.max(0, 12 - Number(c.cur.slice(5, 7)));
    const rkaDec = ok(p.rkaOs) && ok(step) ? p.rkaOs + step * monthsLeft : null;
    if (!ok(base)) { chat('Proyeksi akhir tahun belum bisa dihitung.', { mood: 'confused' }); return; }
    const ach = ok(rkaDec) && rkaDec > 0 ? base / rkaDec : null;
    const head = `Dengan laju biasa, outstanding ${name} akhir Desember ${curYear} diperkirakan ${tn(base)}${ok(p.os) ? `, tumbuh ${tn(base - p.os)} dari sekarang` : ''}.`;
    const lines = [
      ok(rkaDec) ? `Kalau RKA terus naik seperti tiga bulan terakhir, RKA Desember sekitar ${tn(rkaDec)}, jadi capaiannya sekitar ${pct(ach, 1)}.` : '',
      ok(low) && ok(high) && high - low > Math.abs(base) * 0.001 ? `Rentangnya ${tn(low)} sampai ${tn(high)}, tergantung laju penyaluran.` : '',
      ok(ach) && ach < 1 ? `Untuk mengejar, perlu tambahan pertumbuhan sekitar ${tn(rkaDec - base)} di atas laju biasa sampai Desember.` : ok(ach) ? 'Arahnya sudah aman untuk melewati RKA.' : '',
    ].filter(Boolean);
    offer = { say: `Strategi ${Number(curYear) + 1}`, ask: `Mau lihat rencana tahun ${Number(curYear) + 1}?` };
    lastAnswer = { text: [head, ...lines].join(' '), lines, fact: head };
    reply(esc(head), {
      title: 'Proyeksi akhir tahun', lines: lines.map(esc), mood: ok(ach) && ach < 1 ? '' : 'happy', full: true,
      chips: [{ k: 'Proyeksi Desember', v: tn(base) }, { k: 'Perkiraan RKA', v: ok(rkaDec) ? tn(rkaDec) : '' }, { k: 'Capaian', v: ok(ach) ? pct(ach, 1) : '' }].filter((x) => x.v && x.v !== '–'),
      next: [offer.say, 'Saran dong', 'Disburse bulan depan harus berapa?'],
      speakText: `${head} ${lines.join(' ')} ${offer.ask}`,
    });
  }

  function quarterView(ro, part, focus) {
    const c = getContext();
    if (!c) return;
    const cy = Number(c.cur.slice(0, 4));
    const y = part.y || (part.lastYear ? cy - 1 : cy);
    const span = part.kind === 'q' ? 3 : 6;
    const endM = part.n * span;
    const mm = (n) => String(n).padStart(2, '0');
    const first = `${y}-${mm(endM - span + 1)}`;
    let to = `${y}-${mm(endM)}`;
    const label = part.kind === 'q' ? `Q${part.n} ${y}` : `Semester ${part.n} ${y}`;
    if (first > c.cur) { chat(`${label} belum berjalan. Data terakhir ${fmt.month(c.cur)}.`, { mood: 'confused' }); return; }
    if (to > c.cur) to = c.cur;
    let from = shiftMonth(first, -1);
    if (!monthData(c, ro, from).now?.end) from = first;
    if (from === to) { showMonth(ro, to); return; }
    showMonthCompare(ro, [from, to], focus, { label: `${label}${to < `${y}-${mm(endM)}` ? ` (berjalan sampai ${fmt.month(to)})` : ''}` });
  }

  function showMonthCompare(ro, specs, focus = '', { quiet = false, label = '' } = {}) {
    const c = getContext();
    if (!c) return;
    let [x, y] = specs.map((sp) => monthOf(sp, c));
    if (!y || x === y) { showMonth(ro, x); return; }
    if (x > y) [x, y] = [y, x];
    const a = monthData(c, ro, x);
    const b = monthData(c, ro, y);
    const miss = [a, b].find((d) => !d.now?.end);
    if (miss) { noMonth(miss.ym, c); return; }
    focusRo = ro || '';
    const key = COMPARE_KEYS.has(focus) ? focus : '';
    build();
    showing = '';
    const stage = $('va-stage');
    stage.innerHTML = compareHtml(a, b, key, { list: MONTH_ROWS, pick: (d) => `data-va-month="${esc(d.ym)}" data-va-ro="${esc(ro || '')}"` });
    setStage('show');
    flyIn(stage, $('va-orb'));
    const where = ro ? `${a.place} ` : '';
    offer = { say: `Lihat ${where}${b.when}`, ask: '' };
    suggest([`Lihat ${where}${a.when}`, `Lihat ${where}${b.when}`, `Performance ${a.place} 6 bulan`]);
    setMood('happy');
    ding('done');
    remember({ kind: 'monthCompare', args: [ro, [x, y], focus] });
    viewCtx = { kind: 'monthCompare', ro, months: [x, y], at: Date.now() };
    lastRegion = null;
    const story = monthTalk(a, b, key);
    lastAnswer = { text: story, lines: [], fact: story };
    const lead = label ? `${label}, ${ro ? a.place : 'Nasional'}: posisi akhir ${a.when} dibanding akhir ${b.when}.` : `${pickOne(['Oke, kita bandingkan', 'Siap, ini perbandingan', 'Baik, saya jejerkan'])} ${a.when} dan ${b.when}${ro ? ` untuk ${a.place}` : ', Nasional'}.`;
    say(quiet ? `Kembali ke perbandingan ${a.when} dan ${b.when}.` : `${lead} ${story} ${key ? '' : compareTalk(a, b, '', { list: MONTH_ROWS })} Mau saya buka salah satu bulannya?`);
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

  function talkOnly(text, mood = '', full = false) {
    if (mood) setMood(mood);
    say(text, { full });
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
        talkOnly(`${pickOne(['Maksudnya begini.', 'Jadi begini.', 'Saya jelaskan sedikit ya.'])} ${[...more, ...extra].join(' ')} ${offer.ask}`, 'happy', true);
        return;
      }
    }
    if (lastAnswer?.lines?.length) {
      talkOnly(`${pickOne(['Maksudnya begini.', 'Jadi begini.'])} ${lastAnswer.lines.map(plain).join(' ')}`, 'happy', true);
      return;
    }
    if (lastRegion?.d) {
      talkOnly(`${pickOne(['Jadi begini.', 'Saya jelaskan ya.'])} ${regionMore(lastRegion.d).join(' ')}`, 'happy', true);
      return;
    }
    chat('Yang mana ya maksudnya? Coba sebut wilayah atau angkanya, misalnya "jelaskan NPL Bandung".', { mood: 'confused' });
  }

  function analysis(ro) {
    const c = getContext();
    if (!c) return;
    focusRo = ro || '';
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
      lines, mood: 'happy', full: true, next: [`Performance ${name} 3 bulan`, ro ? `Detail NPL ${name}` : 'Kabar buruknya apa?', 'Maksudnya?'],
      speakText: `${pickOne(['Baik, ini analisis saya.', 'Oke, saya rangkum temuannya.', 'Ini poin pentingnya.'])} ${spoken} ${offer.ask}`,
    });
    lastAnswer = { text: [`Analisis ${name}`, ...list.map((it) => insightLine(it))].join(' '), lines: list.map((it) => insightLine(it)) };
  }

  function remind(text) {
    const r = parseReminder(text);
    if (!r) { chat('Mau diingatkan kapan? Misalnya, "ingatkan saya 10 menit lagi untuk rapat".', { mood: 'confused', next: ['Ingatkan saya 10 menit lagi', 'Ingatkan saya jam 3 sore'] }); return; }
    if (r.past) { chat(`Jam ${r.at} hari ini sudah lewat. Mau diingatkan berapa menit lagi?`, { mood: 'confused', next: ['Ingatkan saya 10 menit lagi', 'Ingatkan saya 30 menit lagi'] }); return; }
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
    const moods = { joke: 'giggle', sing: 'joy', isAi: 'happy', whoMade: 'shy', age: 'giggle', love: 'shy', like: 'happy', eat: 'joy', weather: 'thinking', english: 'confused', sad: 'worried', tired: 'worried', motivate: 'determined', congrats: 'excited', weekend: 'joy', payday: 'energetic', birthday: 'excited', miss: 'shy' };
    if (type === 'tired') feel.tired = true;
    if (type === 'sad') feel.sad = true;
    const offers = {
      tired: { say: 'Briefing hari ini', ask: 'Mau saya ringkas sekarang?' },
      sad: { say: 'Kabar baiknya apa?', ask: '' },
      motivate: { say: 'Tampilkan RO terbaik', ask: '' },
      sing: { say: 'Briefing hari ini', ask: '' },
    };
    const text = line(type);
    if (offers[type]) offer = offers[type];
    const next = type === 'joke' ? ['Lagi dong', 'Briefing hari ini'] : type === 'tired' ? ['Briefing hari ini', 'Jawab singkat aja'] : type === 'sad' ? ['Kabar baiknya apa?'] : null;
    chat(text, { mood: moods[type] || 'happy', next, chime: ['congrats', 'love', 'birthday', 'miss'].includes(type) ? 'love' : '' });
  }

  function continueTalk(pending) {
    if (pending) { handle(pending.say, { inner: true }); return; }
    if (lastKind === 'joke') { personal('joke'); return; }
    if (showing !== '' && trail.at(-1)?.kind === 'region') { stepRo(1); return; }
    if (lastAnswer?.lines?.length) { talkOnly(`${pickOne(['Lanjut ya.', 'Terus begini.'])} ${lastAnswer.lines.map(plain).join(' ')}`); return; }
    brief();
  }

  function dayFlavor(d = new Date()) {
    const w = workdaysLeft(d);
    if (w.work && w.work <= 3) return `Bulan ${w.month} tinggal ${w.work} hari kerja lagi, waktunya kejar target.`;
    return { 1: 'Awal minggu nih, semangat!', 5: 'Sudah Jumat, sedikit lagi akhir pekan.', 6: 'Akhir pekan masih kerja? Semangat ya.', 0: 'Hari Minggu masih buka dashboard, salut.' }[d.getDay()] || '';
  }

  function dataDay() {
    const c = getContext();
    return longDate(c ? regionData(c, '').now?.date : '');
  }

  function really() {
    const when = dataDay();
    const src = when ? `Datanya per ${when}.` : '';
    if (lastRegion?.d && trail.at(-1)?.kind === 'region') {
      const p = lastRegion.d.now || {};
      const fact = ok(p.achOs) ? `Outstanding ${lastRegion.name} memang ${pct(p.achOs, 1)} dari RKA${ok(p.nplPct) ? `, NPL ${pct(p.nplPct)}` : ''}.` : '';
      talkOnly(`${line('really')} ${fact} ${src}`, 'happy');
      return;
    }
    if (lastAnswer?.text) {
      const fact = plain(lastAnswer.fact || firstSentence(lastAnswer.text));
      talkOnly(`${line('really')} ${fact} ${when && fact.includes(when) ? '' : src}`, 'happy');
      return;
    }
    talkOnly(`${line('really')} ${src}`, 'happy');
  }

  function doubt() {
    const when = dataDay();
    offer = { say: 'Status data', ask: '' };
    chat(line('doubt'), {
      mood: 'confused', next: ['Status data', 'Refresh data', 'Data per tanggal berapa?'],
      lines: [when ? `Angka yang saya pakai posisi ${when}.` : 'Tanggal data belum terbaca.', 'Kalau data sumber baru diisi, bilang "refresh data". Untuk rinciannya, bilang "status data".'],
    });
  }

  function verdict(p, target) {
    const parts = [];
    let watch = '';
    let good = null;
    const nplOver = ok(p.nplPct) && ok(p.rkaNplPct) && p.nplPct > p.rkaNplPct;
    const smlOver = ok(p.smlPct) && ok(p.rkaSmlPct) && p.smlPct > p.rkaSmlPct;
    const os = ok(p.achOs) ? `outstanding ${pct(p.achOs, 1)} dari RKA` : '';
    const npl = ok(p.nplPct) ? `NPL ${pct(p.nplPct)}${ok(p.rkaNplPct) ? (nplOver ? `, di atas RKA ${pct(p.rkaNplPct)}` : `, masih di bawah RKA ${pct(p.rkaNplPct)}`) : ''}` : '';
    const sml = ok(p.smlPct) ? `SML ${pct(p.smlPct)}${ok(p.rkaSmlPct) ? (smlOver ? ', di atas RKA' : ', di bawah RKA') : ''}` : '';
    const disb = ok(p.achDisb) ? `disburse ${pct(p.achDisb, 0)} dari guidance` : '';
    const order = { npl: [npl, os, disb], sml: [sml, npl, os], os: [os, npl, disb], deb: [os, npl, disb], disb: [disb, os, npl], real: [disb, os, npl] }[target] || [os, npl, disb];
    parts.push(...order.filter(Boolean));
    if (target === 'npl' && ok(p.nplPct)) good = !nplOver;
    else if (target === 'sml' && ok(p.smlPct)) good = !smlOver;
    else if ((target === 'disb' || target === 'real') && ok(p.achDisb)) good = p.achDisb >= (p.full ? 0.9 : 0.5);
    if (nplOver) watch = 'NPL-nya';
    else if (smlOver) watch = 'SML-nya';
    else if (ok(p.achOs) && p.achOs < 0.97) watch = 'pencapaian outstanding';
    else if (ok(p.achDisb) && !p.full && ok(p.progDisb) && p.progDisb < 0.8) watch = 'laju penyaluran bulan ini';
    return { parts, watch, good };
  }

  function opinion(ro, target) {
    const c = getContext();
    if (!c) return;
    const d = regionData(c, ro);
    const p = d.now || {};
    if (!p.end) { chat(`Data ${shortRo(ro) || 'Nasional'} belum ada, jadi saya belum bisa menilai.`, { mood: 'confused' }); return; }
    const { parts, watch, good } = verdict(p, target);
    focusRo = ro || '';
    const tone = good === null ? toneOf(d) : good ? 'good' : 'bad';
    const head = line(`opinion.${tone}`, { n: d.name });
    const body = parts.length ? `${parts.join(', ').replace(/^./, (x) => x.toUpperCase())}.` : '';
    const tail = watch ? line('opinionWatch', { w: watch }) : line('opinionKeep');
    const story = periodStory(periodRows(c.pm, ro, '3'), d.name);
    const trend = story?.focus && !pref.short ? `Kalau dilihat tiga bulan terakhir, ${lowerFirst(story.focus)}` : '';
    offer = { say: ro ? `Analisis ${d.name}` : 'Analisis hari ini', ask: pickOne(['Mau saya bedah lebih dalam?', 'Perlu saya rinci temuannya?']) };
    lastAnswer = { text: [head, body, tail, trend].filter(Boolean).join(' '), lines: [body, tail, trend].filter(Boolean), fact: body };
    reply(esc(head), {
      lines: [body, tail, trend].filter(Boolean).map(esc), mood: tone === 'bad' ? 'sad' : tone === 'good' ? 'happy' : '',
      next: [ro ? `Analisis ${d.name}` : 'Analisis hari ini', 'Saran dong', ro ? `Lihat ${d.name}` : 'Kabar buruknya apa?'],
      full: true,
      speakText: [head, body, tail, trend, offer.ask].filter(Boolean).join(' '),
    });
  }

  function advice(ro) {
    const c = getContext();
    if (!c) return;
    const d = regionData(c, ro);
    const p = d.now || {};
    if (!p.end) { chat(`Data ${shortRo(ro) || 'Nasional'} belum ada.`, { mood: 'confused' }); return; }
    const w = workdaysLeft();
    const tips = [];
    focusRo = ro || '';
    if (ok(p.nplPct) && ok(p.rkaNplPct) && p.nplPct > p.rkaNplPct && ok(p.os)) {
      tips.push(`dahulukan penagihan: NPL perlu turun ${fmt.num((p.nplPct - p.rkaNplPct) * 100, 2)} poin ke RKA, setara sekitar ${tn((p.nplPct - p.rkaNplPct) * p.os)} kredit bermasalah yang harus diselesaikan`);
    }
    if (!p.full && ok(p.guidance) && ok(p.disb) && p.guidance > p.disb && w.work > 0) {
      tips.push(`kejar penyaluran: masih kurang ${tn(p.guidance - p.disb)} ke guidance, sekitar ${tn((p.guidance - p.disb) / w.work)} per hari kerja selama ${w.work} hari kerja tersisa`);
    }
    if (ok(p.rkaOs) && ok(p.os) && p.rkaOs > p.os) tips.push(`selisih ke RKA outstanding ${tn(p.rkaOs - p.os)}, jadi jaga runoff supaya pelunasan tidak menggerus pertumbuhan`);
    if (ok(p.smlPct) && ok(p.rkaSmlPct) && p.smlPct > p.rkaSmlPct) tips.push(`pantau SML ${pct(p.smlPct)} yang di atas RKA, supaya tidak turun kelas jadi NPL`);
    const top = insightsFor(ro).find((it) => it.tone === 'negative' || it.tone === 'risk');
    if (top && tips.length < 3) tips.push(`perhatikan juga, ${lowerFirst(plain(top.headline)).replace(/\.$/, '')}`);
    if (!tips.length) {
      chat(`${d.name} sedang sehat, jadi saran saya pertahankan ritme penyaluran dan jaga kualitas.`, { mood: 'happy', next: [ro ? `Analisis ${d.name}` : 'Analisis hari ini', 'Kabar baik hari ini apa?'] });
      return;
    }
    const order = ['Pertama', 'Kedua', 'Ketiga'];
    const list = tips.slice(0, 3).map((t, i) => `${tips.length > 1 ? `${order[i]}, ` : ''}${t}.`);
    const head = `${line('advice')} untuk ${d.name} ada ${list.length} hal.`;
    offer = { say: ro ? `Performance ${d.name} 3 bulan` : 'RO mana yang perlu perhatian?', ask: ro ? 'Mau saya bukakan tren tiga bulannya?' : 'Mau saya tunjukkan RO yang paling perlu dorongan?' };
    lastAnswer = { text: [head, ...list].join(' '), lines: list, fact: list[0] };
    reply(esc(head), { lines: list.map((x) => esc(x.charAt(0).toUpperCase() + x.slice(1))), mood: 'determined', full: true, next: [offer.say, 'Intinya apa?', 'Kabar buruknya apa?'], speakText: `${head} ${list.join(' ')} ${offer.ask}` });
  }

  function gist() {
    if (lastRegion?.d && trail.at(-1)?.kind === 'region') {
      const d = lastRegion.d;
      const { parts } = verdict(d.now || {}, '');
      const word = { good: 'aman', bad: 'perlu perhatian', mixed: 'ada plus minusnya' }[toneOf(d)];
      talkOnly(`${line('gist')} ${d.name} ${word}. ${parts.slice(0, 2).join(', ').replace(/^./, (x) => x.toUpperCase())}.`, toneOf(d) === 'bad' ? 'worried' : 'happy');
      return;
    }
    if (lastAnswer?.text) { talkOnly(`${line('gist')} ${lowerFirst(firstSentence(plain(lastAnswer.text)))}`, 'happy'); return; }
    offer = { say: 'Briefing hari ini', ask: '' };
    talkOnly('Belum ada yang perlu diringkas. Mau saya briefing kondisi hari ini?', 'confused');
  }

  function funFact() {
    const c = getContext();
    if (!c) return;
    const nat = regionData(c, '').now || {};
    const rows = (c.pm.regions || []).map((ro) => ({ ro, end: (c.pm.byRo.get(ro) || []).at(-1) })).filter((x) => x.end && ok(x.end.os));
    const facts = [];
    if (ok(nat.os) && ok(nat.deb) && nat.deb > 0) facts.push(`Rata-rata sisa pinjaman KPR per debitur sekitar ${tn(nat.os / nat.deb)}.`);
    if (ok(nat.deb)) facts.push(`Saat ini ada ${fmt.num(nat.deb, 0)} debitur KPR. Kalau satu debitur satu rumah, itu ${fmt.num(nat.deb, 0)} keluarga yang tinggal di rumah lewat KPR kita.`);
    const big = [...rows].sort((a, b) => b.end.os - a.end.os)[0];
    if (big && ok(nat.os) && nat.os > 0) facts.push(`RO dengan outstanding terbesar ${shortRo(big.ro)}, ${tn(big.end.os)}, sekitar ${pct(big.end.os / nat.os, 0)} dari total nasional.`);
    const many = [...rows].filter((x) => ok(x.end.debitur)).sort((a, b) => b.end.debitur - a.end.debitur)[0];
    if (many) facts.push(`Debitur terbanyak ada di ${shortRo(many.ro)}, ${fmt.num(many.end.debitur, 0)} debitur.`);
    const grow = rows.map((x) => { const r = regionData(c, x.ro); return { ro: x.ro, g: ok(r.now?.os) && ok(r.before?.os) ? r.now.os - r.before.os : null }; }).filter((x) => ok(x.g)).sort((a, b) => b.g - a.g)[0];
    if (grow && grow.g > 0) facts.push(`Bulan ini, outstanding yang tumbuh paling besar ada di ${shortRo(grow.ro)}, tambah ${tn(grow.g)} sejak akhir bulan lalu.`);
    if (!facts.length) { chat('Datanya belum cukup untuk fakta menarik. Nanti saya cari lagi ya.', { mood: 'confused' }); return; }
    let i = Math.floor(Math.random() * facts.length);
    if (i === lastFact && facts.length > 1) i = (i + 1) % facts.length;
    lastFact = i;
    lastKind = 'funFact';
    chat(`${line('funFact')} ${facts[i]}`, { mood: 'awed', next: ['Fakta menarik lagi', 'Briefing hari ini', 'Cerita lucu dong'] });
  }

  function meetingPrep() {
    offer = { say: 'Analisis hari ini', ask: '' };
    const w = workdaysLeft();
    chat(`${line('meeting')} Mau saya siapkan poin pentingnya dulu?`, {
      mood: 'happy', next: ['Analisis hari ini', 'Briefing hari ini', 'Kabar buruknya apa?'],
      lines: [w.work ? `Bulan ${w.month} tinggal ${w.work} hari kerja, bisa jadi pembuka rapat.` : ''].filter(Boolean),
    });
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
    else if (prev.kind === 'compare') showCompare(prev.args[0], prev.args[1], prev.args[2], { quiet: true, month: prev.args[3] || null });
    else if (prev.kind === 'month') showMonth(prev.args[0], prev.args[1], { quiet: true });
    else if (prev.kind === 'monthCompare') showMonthCompare(prev.args[0], prev.args[1], prev.args[2], { quiet: true });
    else if (prev.kind === 'help') helpCard(prev.args[0]);
    else reply(prev.args[0], { ...prev.args[1], speakText: 'Ini tampilan sebelumnya.' });
  }

  async function handle(text, { typed = false, inner = false, loose = false } = {}) {
    const ticket = ++busy;
    endGreet();
    if (!inner) lastTyped = typed;
    clearTimeout(early.timer);
    clearTimeout(autoTimer);
    awake();
    if (!isOpen()) open({ listenNow: false, focusInput: typed });
    if (!inner) {
      flushSay();
      lastUserMsg = logMsg('me', text);
      dock();
      typing();
    }
    if (mode === 'command' || mode === 'barge') { rec.abort(); mode = 'off'; }
    autoListen = false;
    hush();
    speakingNow = false;
    speakingUntil = 0;
    showHeard(text, true);
    setPhase('think', line('thinking'));
    const c = getContext();
    const list = regions();
    let q = null;
    try { q = await engine.parse(cleanSpoken(text, list)); } catch (err) { console.warn(err); }
    if (ticket !== busy) return;
    const cmd = routeCommand(text, { q, regions: list, showing, focus: focusRo });
    if (cmd.corrected) prefix = line('ralat');
    const chained = askChain && Date.now() - askAt < ASK_MEMORY_MS;
    if (!KEEP_CHAIN.has(cmd.type)) askChain = false;
    const view = viewCtx && Date.now() - viewCtx.at < ASK_MEMORY_MS ? viewCtx : null;
    if (!['month', 'monthCompare', 'quarter', ...KEEP_CHAIN].includes(cmd.type)) viewCtx = null;
    const short = cmd.type === 'ask' && view && cmd.text && cmd.text.split(' ').length <= 4 && !/\b(20\d\d|bulan|minggu|hari|tahun|kemarin|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/.test(cmd.text);
    if (short && view.kind === 'monthCompare' && COMPARE_KEYS.has(targetOf(cmd.text))) { showMonthCompare(cmd.ro || view.ro, view.months, targetOf(cmd.text)); return; }
    if (short && view.kind === 'month') cmd.text = `${cmd.text} ${fmt.month(view.months[0]).toLowerCase()}${view.ro && !cmd.ro ? ` ${shortRo(view.ro).toLowerCase()}` : ''}`;
    const pending = offer;
    if (cmd.type !== 'yes' && cmd.type !== 'no') offer = null;
    const prevKind = lastKind;
    lastKind = cmd.type;
    const onStage = !!showing || !!$('va-stage')?.childElementCount;
    switch (cmd.type) {
      case 'none': lastUserMsg?.remove(); lastUserMsg = null; $('va-say').classList.remove('typing'); setPhase('idle'); return;
      case 'yes':
        offer = null;
        if (pending) { prefix = pickOne(['Siap.', 'Oke.', 'Baik.']); handle(pending.say, { inner: true }); return; }
        if (/\b(lanjut|gas|terus)\b/.test(cmd.text)) { lastKind = prevKind; continueTalk(null); return; }
        if (onStage) { talkOnly(line('ack'), 'happy'); return; }
        reply('Siap. Mau lihat apa?', { next: HINTS, mood: 'happy' });
        return;
      case 'no': offer = null; if (onStage) talkOnly(line('no')); else reply(esc(line('no')), { next: HINTS, keep: false }); return;
      case 'hush': setPhase(pref.wake ? 'listen' : 'idle'); return;
      case 'close': ding('off'); closeDetail(); close(); return;
      case 'bye': setMood('love'); ding('off'); say(line(feel.tired ? 'byeCare' : feel.sad ? 'byeGlad' : partOfDay() === 'malam' ? 'byeNight' : 'bye'), { after: close }); return;
      case 'goodnight': setMood('sleepy', 0); ding('off'); say(line('byeNight'), { after: close }); return;
      case 'thanks': ding('love'); if (onStage) talkOnly(`${line('thanks')} ${pickOne(['Ada lagi yang mau dicek?', 'Mau lanjut lihat yang lain?', 'Kabari saja kalau perlu lagi.'])}`, 'joy'); else reply(esc(line('thanks')), { mood: 'joy', next: HINTS, keep: false }); return;
      case 'praise':
        if (showing !== '' && lastRegion && !/\b(kamu|kirana)\b/i.test(text)) {
          const tone = toneOf(lastRegion.d);
          talkOnly(tone === 'good' ? `Iya, ${lastRegion.name} memang lagi bagus.` : tone === 'bad' ? `Hmm, sebenarnya ${lastRegion.name} masih perlu dikejar.` : `Iya, sebagian sudah bagus. Tinggal dijaga.`, tone === 'good' ? 'energetic' : tone === 'bad' ? 'thinking' : 'happy');
          return;
        }
        ding('love'); if (onStage) talkOnly(line('praise'), 'shy'); else reply(esc(line('praise')), { mood: 'shy', keep: false });
        return;
      case 'reactBad':
        if (pending?.ask) { offer = pending; talkOnly(`Iya, betul. ${pending.ask}`, 'worried'); return; }
        offer = { say: 'Kabar buruknya apa?', ask: '' };
        talkOnly(showing !== '' && lastRegion ? `Iya, ${lastRegion.name} memang perlu perhatian. Mau saya rangkum yang perlu dikejar?` : 'Iya, yang ini perlu dikejar. Mau saya rangkum yang perlu diwaspadai?', 'pout');
        return;
      case 'ack': talkOnly(line('ack'), 'happy'); return;
      case 'present': talkOnly(line('present'), 'happy'); return;
      case 'wait': talkOnly(line('wait'), 'happy'); return;
      case 'sorry': talkOnly(line('sorry'), 'love'); return;
      case 'annoyed': ding('oops'); talkOnly(line('annoyed'), 'worried'); return;
      case 'joke': case 'sing': case 'isAi': case 'whoMade': case 'age': case 'love': case 'like': case 'eat': case 'weather': case 'english': case 'sad': case 'tired': case 'motivate': case 'congrats':
        personal(cmd.type); return;
      case 'weekend': case 'payday': case 'birthday': case 'miss': personal(cmd.type); return;
      case 'missList': {
        const list = readMiss();
        if (!list.length) { chat('Belum ada pertanyaan yang gagal saya jawab. Mantap!', { mood: 'happy' }); return; }
        lastAnswer = { text: list.map((x) => x.t).join('; '), lines: [], fact: '' };
        offer = { say: 'Salin jawabannya', ask: '' };
        reply(esc(`${list.length} pertanyaan belum bisa saya jawab`), {
          title: 'Catatan belajar', lines: list.slice(-12).reverse().map((x) => `${esc(x.t)} <small>${esc(longDate(x.at))}</small>`), mood: 'confused', keep: false,
          next: ['Salin jawabannya', 'Hapus catatan belajar'],
          speakText: `Ada ${list.length} pertanyaan yang belum bisa saya jawab. Daftarnya di layar. Salin lalu kirimkan ke tim pembuat, supaya saya bisa belajar menjawabnya.`,
        });
        return;
      }
      case 'missClear': writeMiss([]); talkOnly('Sudah, catatan belajar saya kosongkan.', 'happy'); return;
      case 'notThat': offer = null; chat(line('notThat'), { mood: 'confused', next: HINTS }); return;
      case 'salam': chat(`${line('salam')} ${pickOne(['Ada yang bisa Kirana bantu?', 'Ada yang bisa Kirana bantu hari ini?', 'Silakan, mau cek apa?'])}`, { mood: 'love' }); return;
      case 'laugh': talkOnly(line('laugh'), 'laugh'); return;
      case 'wow': {
        if (showing !== '' && lastRegion && trail.at(-1)?.kind === 'region') {
          const tone = toneOf(lastRegion.d);
          talkOnly(tone === 'good' ? line('wowGood', { n: lastRegion.name }) : tone === 'bad' ? line('wowBad', { n: lastRegion.name }) : line('wow'), tone === 'bad' ? 'worried' : 'excited');
          return;
        }
        talkOnly(line('wow'), 'surprised');
        return;
      }
      case 'really': really(); return;
      case 'doubt': doubt(); return;
      case 'opinion': opinion(cmd.ro, cmd.target); return;
      case 'advice': advice(cmd.ro); return;
      case 'gist': gist(); return;
      case 'funFact': funFact(); return;
      case 'whatDoing': chat(line('whatDoing'), { mood: 'happy' }); return;
      case 'ponder': offer = { say: 'Briefing hari ini', ask: '' }; chat(line('ponder'), { mood: 'love', next: HINTS }); return;
      case 'lunch': case 'pray': case 'coffee': case 'goHome': setMood('love'); ding('off'); say(line(cmd.type), { after: close }); return;
      case 'meeting': meetingPrep(); return;
      case 'workStart': brief(); return;
      case 'bored': offer = { say: 'Fakta menarik', ask: '' }; chat(line('bored'), { mood: 'happy', next: ['Fakta menarik', 'Cerita lucu dong'] }); return;
      case 'continue': lastKind = prevKind; continueTalk(pending); return;
      case 'more':
        lastKind = prevKind;
        if (['joke', 'motivate', 'sing', 'like'].includes(prevKind)) { personal(prevKind); return; }
        if (prevKind === 'funFact') { funFact(); return; }
        continueTalk(pending);
        return;
      case 'explain': explain(); return;
      case 'why':
        if (lastRegion?.d && trail.at(-1)?.kind === 'region') {
          const d = lastRegion.d;
          const rose = ok(d.now?.nplPct) && ok(d.before?.nplPct) && d.now.nplPct > d.before.nplPct;
          handle(rose ? `kenapa npl ${d.name} naik` : `kenapa os ${d.name} naik`, { inner: true });
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
      case 'cleanOn':
      case 'cleanOff':
      case 'cleanStatus': {
        const desk = micSupport && matchMedia('(pointer: fine)').matches;
        if (cmd.type !== 'cleanStatus') { pref.clean = cmd.type === 'cleanOn'; writePref(pref); setMicClean(pref.clean); }
        if (!desk) { talkOnly('Peredam bising cuma jalan di laptop atau komputer. Di HP, saya pakai peredam bawaan HP.', ''); return; }
        if (!micClean()) { talkOnly(cmd.type === 'cleanOff' ? 'Oke, peredam bising saya matikan. Semua suara di ruangan ikut saya dengar.' : 'Peredam bising lagi mati. Bilang "nyalakan peredam bising" kalau ruangannya rame.', ''); return; }
        talkOnly(cmd.type === 'cleanOn' ? 'Siap, peredam bising nyala. Saya cuma dengar suara yang dekat ke mikrofon, obrolan di sekitar saya abaikan.' : 'Peredam bising nyala. Suara jauh dan obrolan sekitar saya abaikan.', 'happy');
        return;
      }
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
        const said = (cmd.text.match(/\b(pagi|siang|sore|malam)\b/) || [])[1];
        const now = partOfDay();
        const nm = pref.name ? `, ${pref.name}` : '';
        const hello = Date.now() - helloAt < 90000 && !said ? `${pickOne(['Hai juga', 'Halo juga'])}${nm}!`
          : said && said !== now
          ? `Selamat ${said} juga${nm}. Eh, sekarang ${PARTS.indexOf(said) > PARTS.indexOf(now) ? 'masih' : 'sudah'} ${now} lho, hehe.`
          : `${salam()}${nm}.`;
        const flavor = dayFlavor();
        const q = ask ? 'Ada yang bisa Kirana bantu? Oh iya, Kirana boleh panggil dengan sebutan apa?' : pickOne(['Ada yang bisa Kirana bantu?', 'Ada yang bisa Kirana bantu hari ini?', 'Senang ketemu lagi. Ada yang bisa Kirana bantu?']);
        const greeting = [hello, flavor, q].filter(Boolean).join(' ');
        reply(esc(greeting), { lines: ask ? [esc('Bilang saja, misalnya, "panggil saya Pak Andi" atau "panggil saya Bu Rina".')] : [], next: HINTS, mood: 'wave', keep: false, speakText: greeting });
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
          more = storySpeech(story, { max: pref.short ? 1 : 2 });
        }
        lastAnswer = more ? { text: more, lines: [more] } : lastAnswer;
        say(`${line('detail', { what: `${name}${where}` })} ${more}`);
        return;
      }
      case 'analysis': analysis(cmd.ro || ''); return;
      case 'region': showRegion(cmd.ro); return;
      case 'compare': showCompare(cmd.ros[0], cmd.ros[1], cmd.metric, { month: cmd.month || null }); return;
      case 'month': showMonth(cmd.ro || c?.sel?.ro || '', cmd.month); return;
      case 'monthCompare': showMonthCompare(cmd.ro || c?.sel?.ro || '', cmd.months, cmd.focus); return;
      case 'quarter': quarterView(cmd.ro || c?.sel?.ro || '', cmd.part, cmd.focus); return;
      case 'yearEnd': yearEnd(cmd.ro || c?.sel?.ro || ''); return;
      case 'ratioForecast': ratioForecast(cmd.ro || c?.sel?.ro || '', cmd.focus); return;
      case 'target': targetGap(cmd.ro || c?.sel?.ro || '', cmd.focus); return;
      case 'brief': brief(); return;
      case 'rankShow': rankShow(cmd.order); return;
      case 'back': goBack(); return;
      case 'nextRo': stepRo(1); return;
      case 'prevRo': stepRo(-1); return;
      default: break;
    }
    try {
      if (!chained) engine.reset?.();
      if (cmd.note) prefix = cmd.note;
      const { a, q: asked } = await engine.ask(cmd.text || text, { context: { ro: showing || c?.sel?.ro || '' } });
      if (ticket !== busy) return;
      askChain = a.ok !== false;
      askAt = Date.now();
      const ros = (asked?.entities?.ro || []).filter((r) => list.includes(r));
      if (ros.length === 1) focusRo = ros[0];
      const lines = (a.lines || []).slice(0, 3);
      const chips = (a.chips || []).filter((x) => x && x.k && x.v && !['Catatan', 'Sumber'].includes(x.k)).slice(0, 6);
      const next = [
        ...(ros.length === 1 ? [`Lihat ${shortRo(ros[0])}`] : []),
        ...(a.followups || []).filter((f) => typeof f === 'string'),
      ].slice(0, 3);
      const failed = a.ok === false;
      if (failed && loose) { lastUserMsg?.remove(); lastUserMsg = null; $('va-say').classList.remove('typing'); showHeard(text, false); setPhase(pref.wake ? 'listen' : 'idle'); return; }
      if (failed) {
        const said = String(text).trim().slice(0, 140);
        const list = readMiss().filter((x) => x.t !== said);
        list.push({ t: said, at: new Date().toISOString().slice(0, 10) });
        writeMiss(list);
      }
      if (failed) ding('oops');
      const title = a.title || 'Belum ada jawaban.';
      if (!failed && ros.length === 1 && Math.random() < 0.6) offer = { say: `Lihat ${shortRo(ros[0])}`, ask: `Mau saya tampilkan kondisi lengkap ${shortRo(ros[0])}?` };
      if (!failed && !offer) {
        const f = (a.followups || []).find((x) => typeof x === 'string' && x.length < 70);
        if (f) offer = { say: f, ask: line('askMore', { f: lowerFirst(f.replace(/[?.!]+$/, '')) }) };
      }
      const metricName = METRIC_NAME[asked?.metric] || '';
      const topic = metricName ? `${metricName}${ros.length === 1 ? ` ${shortRo(ros[0])}` : ''}` : '';
      const echo = topic && !plain(title).toLowerCase().includes(topic.toLowerCase()) && Math.random() < 0.6;
      const lead = failed ? line('confused') : echo ? line('askEcho', { topic }) : line('askLead');
      const tail = failed ? 'Coba pakai kata lain, misalnya "NPL Bandung berapa?"' : offer ? offer.ask : line('askClose');
      lastAnswer = { text: [title, ...lines].map(plain).join(' '), lines, fact: plain(title) };
      const body = asked?.intent === 'define' ? lines.slice(0, 2).map(plain).join(' ') : '';
      reply(title, { lines, chips, next: next.length ? next : HINTS, mood: failed ? 'confused' : 'happy', full: !!body, speakText: [asked?.intent === 'define' ? `${plain(title)}.` : lead, asked?.intent === 'define' ? body : title, tail].filter(Boolean).join(' ') });
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
      else open({ listenNow: true, greet: true });
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
        const idle = globalThis.requestIdleCallback || ((fn) => setTimeout(fn, 600));
        setTimeout(() => idle(() => { if (attached) build(); }, { timeout: 3000 }), 2600);
      }
      button?.addEventListener('click', () => open({ listenNow: true, greet: true }));
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
    openTyped: () => open({ listenNow: false, focusInput: true, greet: true }),
    run: (text) => handle(text, { typed: true }),
    get state() { return { phase, mode, wake: pref.wake, mute: pref.mute, open: isOpen(), showing, offer: offer?.say || '', trail: trail.length }; },
  };
}
