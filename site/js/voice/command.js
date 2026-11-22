import { normalizeText } from '../ask/parser.js';

export const WAKE_NAME = 'Kirana';
export const WAKE_PHRASE = `Hai ${WAKE_NAME}`;

const WAKE_RE = /(?:^|\s)(?:(?:h[ae]i|hey|hei|halo|hallo|helo|oke|ok|eh|yo|kak|mbak|neng|dik)\s*)?(?:kirana|kirena|qirana|kiranna|kiraana|kiranah|khirana|kirani)(?=\s|$|[,.!?])/i;

export function findWake(text) {
  const m = WAKE_RE.exec(` ${text}`);
  if (!m) return null;
  return { rest: ` ${text}`.slice(m.index + m[0].length).replace(/^[\s,.!?]+/, '').trim() };
}

const NUMBER = {
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11,
};
const numberOf = (w) => {
  const parts = w.split(' ');
  if (parts.length === 2 && parts[1] === 'belas') return NUMBER[parts[0]] + 10;
  if (parts.length === 2 && parts[1] === 'puluh') return NUMBER[parts[0]] * 10;
  return NUMBER[w];
};
const NUM_WORD = '(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|(?:dua|tiga|empat|lima|enam|tujuh|delapan|sembilan) belas|dua puluh)';
const PLACE_NUM = new RegExp(`\\b(jakarta|jkt|region|regional|ro|kanwil|wilayah)\\s+${NUM_WORD}\\b`, 'g');
const FILLER = /\b(tolong|coba|dong|deh|yuk|sih|nih|mohon|please|kak|bro|sayang|kirana|kirena)\b/g;

export const shortRo = (ro) => String(ro || '').replace(/^.*\/\s*/, '');

export function cleanSpoken(text, regions = []) {
  let t = String(text || '').toLowerCase().replace(/[?!,]/g, ' ');
  t = t.replace(PLACE_NUM, (m, place, n) => `${place} ${numberOf(n)}`);
  t = t.replace(FILLER, ' ').replace(/^\s*(ya|oke|ok|nah|terus|lalu|trus)\s+/, ' ').replace(/\s+(ya|aja|saja)\s*$/, ' ');
  const names = regions.map((r) => shortRo(r).toLowerCase()).filter(Boolean).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (names.length) t = t.replace(new RegExp(`\\b(regional|kanwil|region|wilayah|ro|daerah|area)\\s+(?=(${names.join('|')})\\b)`, 'g'), '');
  return t.replace(/\s+/g, ' ').trim();
}

export function matchRegion(text, regions) {
  const t = ` ${normalizeText(text)} `;
  const hits = [];
  for (const ro of regions) {
    const name = normalizeText(shortRo(ro));
    const num = /region\s*0*(\d+)/i.exec(ro)?.[1];
    const keys = [name, ...(num ? [`region ${num}`, `regional ${num}`, `ro ${num}`, `kanwil ${num}`] : [])];
    if (/^jakarta \d$/.test(name)) keys.push(name.replace('jakarta', 'jkt'));
    const at = keys.map((k) => t.indexOf(` ${k} `)).filter((i) => i >= 0);
    if (at.length) hits.push({ ro, at: Math.min(...at) });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.ro);
}

const TARGETS = [
  ['watch', /\b(semua ro|seluruh ro|perlu perhatian|ro perhatian|daftar ro|semua region)\b/],
  ['history', /\b(riwayat|histori|history|tiga bulan|3 bulan|bulan terakhir)\b/],
  ['split', /\b(nfi|fix income|non fix|fixed income|fi dan nfi|fi nfi)\b|\bfi\b/],
  ['sla', /\b(sla|berkas|proses berkas)\b/],
  ['real', /\brealisasi\b/],
  ['disb', /\b(disburse|disbursement|pencairan|penyaluran)\b/],
  ['npl', /\b(npl|kredit macet|non performing)\b/],
  ['sml', /\b(sml|dpk|special mention|perhatian khusus)\b/],
  ['deb', /\b(debitur|nasabah)\b/],
  ['os', /\b(os|outstanding|baki debet)\b/],
];
export const targetOf = (t) => TARGETS.find(([, re]) => re.test(t))?.[0] || '';

const OPEN = /\b(buka|bukain|bukakan|detail|detil|rincian|rinci|perbesar|zoom|lengkapnya|selengkapnya|lebih lengkap)\b/;
const SHOW = /\b(lihat|liat|tampilkan|tampilin|tunjukkan|tunjukin|cek|check|buka|bukain|gimana|bagaimana|gmn|kondisi|keadaan|ringkasan|rangkum|rangkuman|overview|performa|kinerja|profil|laporan|apa kabar)\b/;
const ASKING = /\b(berapa|brp|kenapa|knp|mengapa|apakah|bandingkan|dibanding|dibandingkan|banding|vs|versus|tren|trend|naik|turun|tertinggi|terendah|terbesar|terkecil|paling|ranking|peringkat|siapa|mana|kapan|harus|perlu|butuh|target|proyeksi|prediksi|kalau|jika)\b/;
const FILTER = /\b(filter|saring|pilih|ganti ke|ganti jadi|pindah ke|set ke|fokus ke|fokus)\b/;
const CLOSE = /^(tutup|close|selesai|sudah|udah|cukup|keluar|batal|stop|kembali|balik|hide|sembunyikan)(\s+(aja|saja|dulu|ya|semua|semuanya|pop ?up|popup|jendela|layar|detail|tampilan))*$/;
const SPOKEN_LIMIT = 9;

export function routeCommand(raw, { q = null, regions = [] } = {}) {
  const t = cleanSpoken(raw, regions);
  if (!t) return { type: 'none', text: t };
  const words = t.split(' ').length;
  if (CLOSE.test(t) || (/\btutup\b/.test(t) && words <= 5)) return { type: 'close', text: t };
  if (/\b(terima ?kasih|makasih|maksih|thanks|thank you|tengkyu|suwun)\b/.test(t) && words <= 6) return { type: 'thanks', text: t };
  if (/^(iya|ya|yap|yup|yoi|boleh|oke|ok|okay|mau|lanjut|gas|silakan|tentu|betul|benar|setuju|sip|siap)( (dong|deh|aja|saja|ya|kak|boleh|mau|lanjut|silakan|banget))*$/.test(t)) return { type: 'yes', text: t };
  if (/^(tidak|nggak|enggak|gak|ga|engga|ndak|jangan|nanti|no)( (usah|dulu|saja|aja|deh|ya|perlu|lain kali|makasih|terima kasih))*$/.test(t)) return { type: 'no', text: t };
  if (/\b(matikan|nonaktifkan|berhenti|stop|jangan)\b.*\b(mode dengar|dengar|mendengar|mendengarkan|mic|mikrofon)\b/.test(t)) return { type: 'wakeOff', text: t };
  if (/\b(nyalakan|aktifkan|hidupkan)\b.*\b(mode dengar|dengar|mendengar|mendengarkan)\b/.test(t)) return { type: 'wakeOn', text: t };
  if (/\b(diam|jangan (bicara|ngomong|bersuara)|tanpa suara|mute|bisukan|matikan suara)\b/.test(t)) return { type: 'mute', text: t };
  if (/\b(nyalakan suara|bersuara lagi|unmute|bicara lagi|pakai suara)\b/.test(t)) return { type: 'unmute', text: t };
  if (/\b(bisa apa|bantuan|help|apa saja yang bisa|perintah apa|cara pakai|contoh perintah)\b/.test(t)) return { type: 'help', text: t };
  if (/^(halo|hai|hei|hey|hallo|pagi|siang|sore|malam|selamat (pagi|siang|sore|malam))( (kirana|semua))?$/.test(t)) return { type: 'greet', text: t };
  const sumber = /\b(7|6|5|tujuh|enam|lima) sumber\b/.exec(t);
  if (sumber && words <= 6) return { type: 'sumber', mode: String({ tujuh: 7, enam: 6, lima: 5 }[sumber[1]] || sumber[1]), text: t };
  const asking = ASKING.test(t);
  const qRos = q?.entities?.ro || [];
  const ros = qRos.length ? qRos.filter((r) => regions.includes(r)) : matchRegion(t, regions);
  const ro = ros.length === 1 ? ros[0] : '';
  if (/\b(nasional|semua wilayah|seluruh wilayah|seluruh indonesia|reset filter|hapus filter|tanpa filter)\b/.test(t) && !asking && !ro) return { type: 'nasional', text: t };
  const target = targetOf(t);
  if (target && (OPEN.test(t) || target === 'history' || target === 'watch') && !asking) return { type: 'detail', id: target, ro, text: t };
  if (target && SHOW.test(t) && !asking && words <= SPOKEN_LIMIT && !(target === 'os' && ro && !/\b(os|outstanding)\b/.test(t))) return { type: 'detail', id: target, ro, text: t };
  if (ro && FILTER.test(t) && !asking) return { type: 'filter', ro, text: t };
  if (ro && !asking && !target && ros.length === 1) return { type: 'region', ro, text: t };
  if (ro && SHOW.test(t) && !asking && ros.length === 1 && (!target || target === 'os')) return { type: 'region', ro, text: t };
  return { type: 'ask', ro, text: t };
}

const MONTH = { Jan: 'Januari', Feb: 'Februari', Mar: 'Maret', Apr: 'April', Jun: 'Juni', Jul: 'Juli', Agu: 'Agustus', Sep: 'September', Okt: 'Oktober', Nov: 'November', Des: 'Desember' };
const LETTERS = { RKA: 'er ka a', NPL: 'en pe el', SML: 'es em el', SLA: 'es el a', OS: 'o es', RO: 'er o', NFI: 'en ef i', FI: 'ef i', KPR: 'ka pe er', RM: 'er em', KC: 'ka ce', DPK: 'de pe ka' };
const SAY = [
  [/[“”"«»]/g, ''], [/%(?=[A-Z])/g, ''], [/\bRp\.?\s?/g, ''], [/▲\s?/g, 'naik '], [/▼\s?/g, 'turun '],
  [/(\d)\.(\d{3})(?!\d)/g, '$1$2'], [/(\d)\.(\d{3})(?!\d)/g, '$1$2'],
  [/(\d+),(\d+)/g, (m, a, b) => `${a} koma ${b.split('').join(' ')}`],
  [/(\d)\s?T\b/g, '$1 triliun'], [/(\d)\s?M\b/g, '$1 miliar'], [/(\d)\s?Jt\b/gi, '$1 juta'], [/(\d)\s?Rb\b/gi, '$1 ribu'],
  [/(\d)\s?%/g, '$1 persen'], [/\bbps\b/gi, 'basis poin'], [/[−–]\s?(?=\d)/g, 'minus '], [/\+(?=\d)/g, 'plus '],
  [/\bs\.d\.?\s?/gi, 'sampai '], [/\bvs\.?\b/gi, 'dibanding'], [/\btgl\b/gi, 'tanggal'],
  [/\b(RKA|NPL|SML|SLA|OS|RO|NFI|FI|KPR|RM|KC|DPK)\b/g, (m) => LETTERS[m]],
  [/\b(Jan|Feb|Mar|Apr|Jun|Jul|Agu|Sep|Okt|Nov|Des)\b/g, (m) => MONTH[m]],
  [/\b(naik|turun) (plus|minus) /g, '$1 '], [/\bRegion 0?(\d+)\s*\/\s*/g, ''], [/\s*\/\s*/g, ' '], [/\s[–-]\s/g, ', '],
];

export function spoken(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  let t = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  for (const [re, to] of SAY) t = t.replace(re, to);
  return t.replace(/\s+/g, ' ').trim();
}
