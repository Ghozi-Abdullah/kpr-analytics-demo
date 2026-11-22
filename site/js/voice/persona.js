import { MONTHS } from '../core/dates.js';
import { isHoliday } from '../core/holidays.js';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
export const partOfDay = (h = new Date().getHours()) => (h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam');
export const salam = () => `Selamat ${partOfDay()}`;

export const LINES = {
  regionFirst: ['Oke{nm}, ini kondisi {n}.', 'Siap, kita lihat {n} ya.', 'Baik, ini gambaran {n} hari ini.', 'Nah, ini {n}.', 'Ini dia {n}.'],
  regionSame: ['Masih di {n} ya.', 'Ini {n} lagi ya.'],
  regionSwitch: ['Oke, pindah dari {prev} ke {n} ya.', 'Sekarang kita geser ke {n}.', 'Baik, dari {prev} kita ke {n}.'],
  good: ['Kabar baik, {n} lagi bagus.', '{n} aman, angkanya sehat.', 'Senang lihatnya, {n} on track.'],
  bad: ['Hmm, {n} perlu perhatian.', 'Yang ini agak berat, {n} butuh dorongan.', '{n} sedang kurang bagus bulan ini.'],
  mixed: ['Ada yang bagus, ada yang perlu dijaga.', 'Campur ya, sebagian aman, sebagian perlu dikejar.'],
  compare: ['Oke, kita adu {a} dan {b} ya.', 'Siap, ini {a} lawan {b}.', 'Baik, saya jejerkan {a} dan {b}.'],
  askLead: ['Oke{nm}, saya cek ya.', 'Sebentar ya.', 'Baik.', 'Nah,', '', '', ''],
  askClose: ['Ada lagi yang mau dicek?', 'Mau dilihat lebih dalam?', '', '', '', ''],
  confused: ['Hmm, maaf{nm}, saya belum nangkep maksudnya.', 'Maaf ya, yang ini saya belum paham.', 'Aduh, saya kurang ngerti. Boleh pakai kata lain?'],
  detail: ['Siap, ini detail {what}.', 'Oke, saya bukakan detail {what} ya.', 'Ini dia detail {what}.'],
  filter: ['Siap, dashboard saya fokuskan ke {n}.', 'Baik, sekarang dashboard menampilkan {n}.', 'Oke, semua panel sekarang {n} ya.'],
  nasional: ['Baik, kembali ke Nasional.', 'Siap, kita balik ke Nasional ya.', 'Oke, filter saya lepas, sekarang Nasional.'],
  page: ['Siap, pindah ke halaman {p}.', 'Oke, ke {p} ya.', 'Baik, saya bukakan {p}.'],
  thanks: ['Sama-sama{nm}.', 'Dengan senang hati.', 'Sama-sama, senang bisa bantu.', 'Siap, kapan saja.'],
  praise: ['Aduh, makasih{nm}. Jadi semangat!', 'Hehe, makasih ya. Saya jadi malu.', 'Terima kasih, saya akan terus belajar.'],
  bye: ['Sampai jumpa{nm}, semoga harinya lancar.', 'Dadah, panggil saya lagi kapan saja ya.', 'Sampai nanti. Semangat terus ya.'],
  byeNight: ['Selamat istirahat{nm}. Besok saya siapkan angkanya lagi.', 'Sampai besok ya. Istirahat yang cukup.'],
  ack: ['Sip.', 'Oke.', 'Siap.', 'Baik.', 'Oke, ada lagi?'],
  no: ['Baik.', 'Oke, tidak jadi.', 'Siap, lain kali saja.'],
  wait: ['Baik, saya tunggu ya.', 'Siap, santai saja.', 'Oke, saya di sini.'],
  present: ['Iya{nm}, saya di sini.', 'Saya dengar kok. Ada apa?', 'Hadir! Mau lihat apa?'],
  smalltalk: {
    pagi: ['Kabar baik, makasih sudah tanya. Pagi ini datanya sudah siap. Mau mulai dari mana?', 'Baik sekali{nm}. Semoga pagi ini lancar. Mau saya briefing dulu?'],
    siang: ['Baik, makasih. Sudah makan siang? Habis itu yuk lihat angka.', 'Baik sekali{nm}. Siang-siang begini mau cek wilayah mana?'],
    sore: ['Baik, makasih. Sore begini enaknya cek ringkasan. Mau saya briefing?', 'Kabar baik. Tinggal sedikit lagi hari ini selesai. Ada yang mau dicek?'],
    malam: ['Baik, makasih. Sudah malam nih, jangan lupa istirahat ya. Ada yang mau dicek dulu?', 'Kabar baik{nm}. Lembur ya? Saya temani.'],
  },
  tired: ['Wah, istirahat sebentar ya{nm}. Kalau mau, saya ringkas yang penting saja.', 'Semangat ya. Biar ringan, saya bacakan intinya saja?'],
  sad: ['Peluk virtual dulu ya{nm}. Kalau mau, saya tunjukkan kabar baik hari ini.', 'Semoga cepat membaik ya. Mau saya carikan kabar baik dari data?'],
  motivate: ['Semangat{nm}! Angka bisa dikejar, yang penting arahnya jelas.', 'Pelan-pelan tapi pasti. Saya bantu pantau angkanya ya.', 'Hari ini pasti bisa. Mau saya tunjukkan RO yang paling bagus buat inspirasi?'],
  joke: [
    'Debitur yang paling setia itu yang bayarnya tepat waktu. Kalau telat terus, itu bukan setia, itu SML.',
    'Kenapa kalkulator nggak pernah galau? Karena untung ruginya selalu jelas.',
    'Rumah impian itu kayak target RKA. Dikejar pelan-pelan, yang penting jangan sampai nunggak.',
    'Kata orang cinta itu buta. Untung KPR nggak, ada analisa kreditnya.',
    'Saya nggak bisa minum kopi, tapi lihat realisasi naik rasanya sama segarnya.',
  ],
  sing: ['Hehe, suara saya lebih cocok membacakan angka daripada nyanyi. Tapi kalau angkanya bagus, rasanya kayak lagu.', 'Nyanyi belum bisa. Tapi saya bisa bacakan briefing dengan penuh perasaan, mau?'],
  isAi: ['Saya asisten suara khusus dashboard ini. Angka yang saya sebut dihitung langsung dari data dashboard, bukan dikarang.'],
  whoMade: ['Saya dibuat khusus untuk dashboard KPR ini, supaya angka bisa dicek cukup dengan ngobrol.'],
  age: ['Saya masih baru kok. Tapi soal angka KPR, saya siap ditanya.'],
  love: ['Aww, makasih{nm}. Saya juga senang bisa menemani kerja.', 'Hehe, jadi malu. Makasih ya.'],
  congrats: ['Yeay, selamat! Kerja kerasnya kelihatan di angka.', 'Hore! Ikut senang{nm}.', 'Mantap, selamat ya!'],
  like: ['Saya suka angka yang rapi dan NPL yang rendah.', 'Kesukaan saya? Realisasi yang naik terus.'],
  eat: ['Saya nggak makan, tapi kalau angkanya bagus rasanya kenyang. Jangan lupa makan ya{nm}.'],
  weather: ['Cuaca belum bisa saya cek, saya fokus ke angka KPR. Semoga cerah ya.'],
  english: ['Maaf, saat ini saya hanya bisa bahasa Indonesia.'],
  sorry: ['Nggak apa-apa kok.', 'Santai saja{nm}.', 'Tidak masalah.'],
  annoyed: ['Maaf ya kalau saya salah. Coba ulangi pelan-pelan, saya dengarkan.', 'Maaf{nm}, saya coba lebih teliti. Bisa diulang?'],
  notYet: ['Yang itu belum bisa saya lakukan. Coba bilang "bantuan" untuk lihat yang bisa saya kerjakan.'],
};

export function createPersona(pref) {
  let calledAt = 0;
  let last = '';
  const nameTag = (chance = 0.4) => {
    if (!pref.name) return '';
    if (Date.now() - calledAt < 25000 || Math.random() > chance) return '';
    calledAt = Date.now();
    return `, ${pref.name}`;
  };
  const fill = (t, vars) => t.replace(/\{(\w+)\}/g, (_, k) => (k === 'nm' ? vars.nm ?? '' : vars[k] ?? ''));
  const tidy = (t) => t.replace(/\s+([,.!?])/g, '$1').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
  function line(key, vars = {}) {
    const list = key.split('.').reduce((o, k) => o?.[k], LINES);
    if (!Array.isArray(list) || !list.length) return '';
    let out = '';
    for (let i = 0; i < 4; i += 1) {
      out = list[Math.floor(Math.random() * list.length)];
      if (out !== last || list.length === 1) break;
    }
    last = out;
    const nm = out.includes('{nm}') ? nameTag(0.55) : '';
    return tidy(fill(out, { ...vars, nm }));
  }
  return { line, nameTag };
}

export function clockText(d = new Date()) {
  const h = d.getHours();
  const m = d.getMinutes();
  const part = partOfDay(h);
  return `Sekarang jam ${h}.${String(m).padStart(2, '0')} ${part}.`;
}

export function dateText(d = new Date()) {
  return `Hari ini ${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}.`;
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function workdaysLeft(d = new Date()) {
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  let work = 0;
  let last = null;
  for (let x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x <= end; x.setDate(x.getDate() + 1)) {
    const wd = x.getDay();
    if (wd === 0 || wd === 6 || isHoliday(iso(x))) continue;
    work += 1;
    last = new Date(x);
  }
  return { work, calendar: end.getDate() - d.getDate() + 1, last, month: MONTHS[d.getMonth()] };
}

export function longDate(isoDate) {
  const [y, m, d] = String(isoDate || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function parseReminder(t) {
  const about = (t.match(/\b(?:untuk|buat|soal|tentang)\s+(.{2,40})$/) || [])[1] || '';
  const half = /\bsetengah jam\b/.test(t);
  const mins = /(\d+(?:[.,]\d+)?)\s*(menit|jam)\b(?!\s*\d)/.exec(t);
  if (/\b(lagi|kemudian|dari sekarang)\b/.test(t) || half) {
    if (half) return { ms: 30 * 60000, about };
    if (mins) {
      const n = Number(mins[1].replace(',', '.'));
      const ms = mins[2] === 'jam' ? n * 3600000 : n * 60000;
      if (ms > 0 && ms <= 12 * 3600000) return { ms, about };
    }
  }
  const at = /\b(?:jam|pukul)\s*(\d{1,2})(?:[.:](\d{2}))?\b/.exec(t);
  if (at) {
    const now = new Date();
    const when = new Date(now);
    let h = Number(at[1]);
    if (/\b(sore|malam)\b/.test(t) && h < 12) h += 12;
    if (/\bsiang\b/.test(t) && h < 7) h += 12;
    when.setHours(h, Number(at[2] || 0), 0, 0);
    if (when <= now) when.setDate(when.getDate() + 1);
    const ms = when - now;
    if (ms <= 18 * 3600000) return { ms, about, at: `${String(when.getHours()).padStart(2, '0')}.${String(when.getMinutes()).padStart(2, '0')}` };
  }
  return null;
}

export function nameFrom(raw) {
  const words = String(raw || '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
  if (!words.length) return '';
  const title = { pak: 'Pak', bapak: 'Pak', bu: 'Bu', ibu: 'Bu', mas: 'Mas', mbak: 'Mbak', kak: 'Kak', bang: 'Bang', mba: 'Mbak' };
  const out = words.map((w, i) => (i === 0 && title[w.toLowerCase()] ? title[w.toLowerCase()] : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()));
  return out.join(' ').slice(0, 30);
}
