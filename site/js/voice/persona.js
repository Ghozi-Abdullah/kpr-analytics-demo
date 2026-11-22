import { MONTHS } from '../core/dates.js';
import { isHoliday } from '../core/holidays.js';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
export const partOfDay = (h = new Date().getHours()) => (h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam');
export const salam = () => `Selamat ${partOfDay()}`;

export const LINES = {
  regionFirst: ['Oke{nm}, ini kondisi {n}.', 'Siap, kita lihat {n} ya.', 'Baik, ini gambaran {n} hari ini.', 'Nah, ini {n}.', 'Ini dia {n}.', 'Oke, {n} ya. Sebentar, ini dia.', 'Siap, saya tampilkan {n}.'],
  regionSame: ['Masih di {n} ya.', 'Ini {n} lagi ya.', 'Oke, {n} sekali lagi.', 'Kita tetap di {n} ya.'],
  regionSwitch: ['Oke, pindah dari {prev} ke {n} ya.', 'Sekarang kita geser ke {n}.', 'Baik, dari {prev} kita ke {n}.', 'Lanjut ke {n} ya.', 'Oke, tinggalkan {prev} dulu, sekarang {n}.'],
  good: ['Kabar baik, {n} lagi bagus.', '{n} aman, angkanya sehat.', 'Senang lihatnya, {n} on track.', 'Yang ini enak dilihat, {n} sehat.', '{n} lagi bagus-bagusnya nih.', 'Lega lihatnya, {n} stabil.'],
  bad: ['Hmm, {n} perlu perhatian.', 'Yang ini agak berat, {n} butuh dorongan.', '{n} sedang kurang bagus bulan ini.', 'Jujur ya, {n} lagi tertinggal.', 'Waduh, {n} perlu dikejar nih.', '{n} lagi butuh perhatian lebih.'],
  mixed: ['Ada yang bagus, ada yang perlu dijaga.', 'Campur ya, sebagian aman, sebagian perlu dikejar.', 'Lumayan, tapi belum semuanya hijau.', 'Sebagian sudah oke, sebagian masih perlu didorong.'],
  compare: ['Oke, kita adu {a} dan {b} ya.', 'Siap, ini {a} lawan {b}.', 'Baik, saya jejerkan {a} dan {b}.', 'Menarik nih, {a} dibanding {b}.', 'Oke, {a} dan {b} kita bandingkan berdampingan.'],
  askLead: ['Oke{nm}, saya cek ya.', 'Sebentar ya.', 'Baik.', 'Nah,', 'Oke, ini dia.', 'Sudah ketemu.', 'Siap.', '', '', ''],
  askEcho: ['Soal {topic} ya.', 'Untuk {topic},', 'Oke, {topic}.', 'Nah, {topic}.'],
  askClose: ['Ada lagi yang mau dicek?', 'Mau dilihat lebih dalam?', 'Ada yang mau ditanyakan lagi?', '', '', '', ''],
  askMore: ['Mau saya lanjut cek {f}?', 'Perlu sekalian saya cek {f}?', 'Kalau mau, saya bisa lanjut ke {f}. Gimana?'],
  thinking: ['Sebentar ya…', 'Saya cek dulu…', 'Lagi saya hitung…', 'Hmm, saya lihat datanya…', 'Oke, saya carikan…', 'Tunggu sebentar…'],
  confused: ['Hmm, maaf{nm}, saya belum nangkep maksudnya.', 'Maaf ya, yang ini saya belum paham.', 'Aduh, saya kurang ngerti. Boleh pakai kata lain?', 'Hmm, yang ini saya belum bisa jawab.', 'Maaf, saya belum yakin maksudnya yang mana.'],
  detail: ['Siap, ini detail {what}.', 'Oke, saya bukakan detail {what} ya.', 'Ini dia detail {what}.', 'Baik, detail {what} sudah terbuka.'],
  filter: ['Siap, dashboard saya fokuskan ke {n}.', 'Baik, sekarang dashboard menampilkan {n}.', 'Oke, semua panel sekarang {n} ya.', 'Sudah, semua angka sekarang khusus {n}.'],
  nasional: ['Baik, kembali ke Nasional.', 'Siap, kita balik ke Nasional ya.', 'Oke, filter saya lepas, sekarang Nasional.'],
  page: ['Siap, pindah ke halaman {p}.', 'Oke, ke {p} ya.', 'Baik, saya bukakan {p}.', 'Meluncur ke {p}.'],
  thanks: ['Sama-sama{nm}.', 'Dengan senang hati.', 'Sama-sama, senang bisa bantu.', 'Siap, kapan saja.', 'Sama-sama ya. Panggil saja kalau butuh lagi.', 'Iya, sama-sama{nm}.', 'Dengan senang hati, itu memang tugas saya.'],
  praise: ['Aduh, makasih{nm}. Jadi semangat!', 'Hehe, makasih ya. Saya jadi malu.', 'Terima kasih, saya akan terus belajar.', 'Wah, makasih. Saya jadi makin semangat bantu.', 'Hehe, bisa aja. Makasih ya{nm}.'],
  bye: ['Sampai jumpa{nm}, semoga harinya lancar.', 'Dadah, panggil saya lagi kapan saja ya.', 'Sampai nanti. Semangat terus ya.', 'Oke, sampai ketemu lagi{nm}.', 'Dadah, semoga angkanya makin hijau.'],
  byeNight: ['Selamat istirahat{nm}. Besok saya siapkan angkanya lagi.', 'Sampai besok ya. Istirahat yang cukup.', 'Selamat malam{nm}. Jangan begadang ya.'],
  byeCare: ['Istirahat yang cukup ya{nm}, tadi katanya capek.', 'Sampai nanti. Semoga capeknya cepat hilang ya.'],
  byeGlad: ['Sampai nanti{nm}. Semoga moodnya sudah lebih baik ya.', 'Dadah. Jangan sedih lagi ya, angkanya masih bisa dikejar.'],
  ack: ['Sip.', 'Oke.', 'Siap.', 'Baik.', 'Oke, ada lagi?', 'Iya.', 'Sip, ada lagi?', 'Oke{nm}.'],
  no: ['Baik.', 'Oke, tidak jadi.', 'Siap, lain kali saja.', 'Oke, nggak apa-apa.', 'Baik, saya standby saja.'],
  wait: ['Baik, saya tunggu ya.', 'Siap, santai saja.', 'Oke, saya di sini.', 'Santai{nm}, saya tunggu.', 'Iya, pelan-pelan saja.'],
  present: ['Iya{nm}, saya di sini.', 'Saya dengar kok. Ada apa?', 'Hadir! Mau lihat apa?', 'Iya, masih di sini kok.', 'Selalu standby{nm}.'],
  wakeAck: ['Iya{nm}?', 'Ya, saya dengar.', 'Iya, ada apa?', 'Hadir.', 'Siap, silakan.'],
  smalltalk: {
    pagi: ['Kabar baik, makasih sudah tanya. Pagi ini datanya sudah siap. Mau mulai dari mana?', 'Baik sekali{nm}. Semoga pagi ini lancar. Mau saya briefing dulu?', 'Alhamdulillah baik. Pagi-pagi enaknya lihat ringkasan dulu, mau?'],
    siang: ['Baik, makasih. Sudah makan siang? Habis itu yuk lihat angka.', 'Baik sekali{nm}. Siang-siang begini mau cek wilayah mana?', 'Kabar baik. Jangan lupa makan siang ya, habis itu kita cek angka.'],
    sore: ['Baik, makasih. Sore begini enaknya cek ringkasan. Mau saya briefing?', 'Kabar baik. Tinggal sedikit lagi hari ini selesai. Ada yang mau dicek?', 'Baik{nm}. Sore-sore begini, mau saya rangkum hasil hari ini?'],
    malam: ['Baik, makasih. Sudah malam nih, jangan lupa istirahat ya. Ada yang mau dicek dulu?', 'Kabar baik{nm}. Lembur ya? Saya temani.', 'Baik. Malam-malam masih kerja, semangat ya. Saya bantu biar cepat selesai.'],
  },
  whatDoing: ['Lagi jagain angka KPR biar nggak kabur. Hehe.', 'Lagi mantengin data, siapa tahu ada kabar baru.', 'Lagi standby, nunggu ditanya{nm}.', 'Lagi menghitung ulang NPL. Bercanda, lagi nunggu perintah kok.'],
  tired: ['Wah, istirahat sebentar ya{nm}. Kalau mau, saya ringkas yang penting saja.', 'Semangat ya. Biar ringan, saya bacakan intinya saja?', 'Capek ya? Tarik napas dulu. Saya bantu bacakan yang penting saja, mau?'],
  sad: ['Peluk virtual dulu ya{nm}. Kalau mau, saya tunjukkan kabar baik hari ini.', 'Semoga cepat membaik ya. Mau saya carikan kabar baik dari data?', 'Nggak apa-apa, hari yang berat pasti lewat. Mau saya kasih kabar yang bikin senang?'],
  motivate: ['Semangat{nm}! Angka bisa dikejar, yang penting arahnya jelas.', 'Pelan-pelan tapi pasti. Saya bantu pantau angkanya ya.', 'Hari ini pasti bisa. Mau saya tunjukkan RO yang paling bagus buat inspirasi?', 'Target besar itu dikejar sedikit-sedikit tiap hari. Yuk, satu langkah dulu.', 'Yang penting konsisten. Angka bagus itu hasil kebiasaan baik.'],
  joke: [
    'Debitur yang paling setia itu yang bayarnya tepat waktu. Kalau telat terus, itu bukan setia, itu SML.',
    'Kenapa kalkulator nggak pernah galau? Karena untung ruginya selalu jelas.',
    'Rumah impian itu kayak target RKA. Dikejar pelan-pelan, yang penting jangan sampai nunggak.',
    'Kata orang cinta itu buta. Untung KPR nggak, ada analisa kreditnya.',
    'Saya nggak bisa minum kopi, tapi lihat realisasi naik rasanya sama segarnya.',
    'Kenapa grafik NPL suka diam-diam? Karena kalau naik, semua orang langsung panik.',
    'Bedanya saya sama mantan? Saya selalu ingat tanggal datanya.',
    'Kalau hidup terasa berat, ingat, cicilan KPR juga berat. Tapi tetap dibayar, kan?',
  ],
  laugh: ['Hehe, ikut ketawa.', 'Haha, senang deh kalau bikin ketawa.', 'Hehe, jadi ikut senang.', 'Hihi, lucu ya.'],
  wow: ['Hehe, iya kan?', 'Iya, menarik ya.', 'Hehe, saya juga kaget.', 'Iya{nm}, lumayan ya.'],
  wowGood: ['Iya, {n} memang lagi bagus.', 'Betul, {n} enak dilihat ya.', 'Iya kan, {n} lagi hijau.'],
  wowBad: ['Iya, {n} memang perlu dikejar.', 'Hmm, betul, {n} lagi berat.', 'Iya, yang ini perlu perhatian.'],
  really: ['Beneran{nm}.', 'Serius, ini dari data dashboard.', 'Iya, beneran kok.', 'Betul, saya hitung langsung dari datanya.'],
  doubt: ['Hmm, bisa jadi datanya belum yang terbaru.', 'Boleh dicek ya, saya hitung dari data yang sedang dimuat.', 'Bisa saja ada yang belum masuk ke data sumber.'],
  notThat: ['Oh, maaf. Maksudnya yang mana?', 'Oke, bukan itu ya. Yang mana maksudnya?', 'Maaf, saya salah tangkap. Coba sebut lagi ya.'],
  ralat: ['Oh, maaf.', 'Oke, saya ralat.', 'Oh, yang itu. Maaf ya.'],
  opinion: {
    good: ['Menurut saya, {n} cukup aman.', 'Kalau saya lihat, {n} sehat.', 'Penilaian saya, {n} bagus.'],
    bad: ['Terus terang, {n} perlu perhatian.', 'Menurut saya, {n} belum aman.', 'Kalau saya nilai, {n} masih berat.'],
    mixed: ['Menurut saya, {n} lumayan, tapi belum semuanya aman.', 'Kalau saya lihat, {n} ada plus minusnya.', 'Penilaian saya, {n} cukup, tapi ada yang perlu dijaga.'],
  },
  opinionWatch: ['Yang perlu dijaga {w}.', 'Titik lemahnya di {w}.', 'Kalau mau lebih aman, perhatikan {w}.'],
  opinionKeep: ['Tinggal dijaga konsistensinya.', 'Tinggal dipertahankan.', 'Tidak ada yang mengkhawatirkan untuk sekarang.'],
  advice: ['Kalau boleh saran,', 'Saran saya,', 'Menurut saya,', 'Kalau saya lihat datanya,'],
  gist: ['Intinya,', 'Singkatnya,', 'Jadi kesimpulannya,', 'Kalau diringkas,'],
  funFact: ['Fakta menarik nih.', 'Tahu nggak?', 'Ada yang unik dari data hari ini.', 'Ini fakta kecil yang menarik.'],
  sing: ['Hehe, suara saya lebih cocok membacakan angka daripada nyanyi. Tapi kalau angkanya bagus, rasanya kayak lagu.', 'Nyanyi belum bisa. Tapi saya bisa bacakan briefing dengan penuh perasaan, mau?'],
  isAi: ['Saya asisten suara khusus dashboard ini. Angka yang saya sebut dihitung langsung dari data dashboard, bukan dikarang.', 'Iya, saya asisten digital. Tapi angkanya asli dari data dashboard ini, bukan tebakan.'],
  whoMade: ['Saya dibuat khusus untuk dashboard KPR ini, supaya angka bisa dicek cukup dengan ngobrol.'],
  age: ['Saya masih baru kok. Tapi soal angka KPR, saya siap ditanya.', 'Rahasia dong. Yang jelas, data saya selalu yang terbaru.'],
  love: ['Aww, makasih{nm}. Saya juga senang bisa menemani kerja.', 'Hehe, jadi malu. Makasih ya.', 'Aduh, saya jadi salah tingkah. Makasih ya{nm}.'],
  miss: ['Aww, saya juga senang ketemu lagi{nm}.', 'Hehe, saya di sini terus kok. Panggil saja kapan pun.'],
  congrats: ['Yeay, selamat! Kerja kerasnya kelihatan di angka.', 'Hore! Ikut senang{nm}.', 'Mantap, selamat ya!', 'Keren! Selamat, ini hasil kerja bareng tim.'],
  like: ['Saya suka angka yang rapi dan NPL yang rendah.', 'Kesukaan saya? Realisasi yang naik terus.', 'Saya suka grafik yang naik ke kanan. Kecuali grafik NPL.'],
  eat: ['Saya nggak makan, tapi kalau angkanya bagus rasanya kenyang. Jangan lupa makan ya{nm}.', 'Belum, saya cukup diisi data saja. Kalau Anda sudah makan?'],
  weather: ['Cuaca belum bisa saya cek, saya fokus ke angka KPR. Semoga cerah ya.'],
  english: ['Maaf, saat ini saya hanya bisa bahasa Indonesia.'],
  sorry: ['Nggak apa-apa kok.', 'Santai saja{nm}.', 'Tidak masalah.', 'Nggak masalah, santai.'],
  annoyed: ['Maaf ya kalau saya salah. Coba ulangi pelan-pelan, saya dengarkan.', 'Maaf{nm}, saya coba lebih teliti. Bisa diulang?', 'Aduh, maaf ya. Boleh coba kata yang lebih singkat?'],
  lunch: ['Selamat makan{nm}. Saya standby di sini.', 'Silakan makan dulu, angkanya nggak ke mana-mana kok.', 'Selamat makan ya. Habis makan, panggil saya lagi.'],
  pray: ['Silakan{nm}, saya tunggu.', 'Silakan, saya standby di sini.'],
  coffee: ['Ngopi dulu biar segar. Nanti panggil saya lagi ya.', 'Selamat ngopi{nm}. Saya jagain angkanya.'],
  meeting: ['Semangat rapatnya{nm}!', 'Semoga rapatnya lancar ya.', 'Siap, semoga rapatnya lancar.'],
  goHome: ['Hati-hati di jalan{nm}. Sampai besok!', 'Selamat pulang ya. Istirahat yang cukup.', 'Oke, hati-hati di jalan. Besok kita lanjut lagi.'],
  bored: ['Bosan ya? Mau saya kasih fakta menarik dari data hari ini?', 'Biar nggak bosan, mau dengar fakta unik dari data?'],
  weekend: ['Asyik, akhir pekan! Jangan lupa istirahat ya{nm}.', 'Selamat berakhir pekan. Angkanya biar saya yang jaga.', 'Libur itu penting. Senin kita kejar lagi ya.'],
  payday: ['Gajian! Selamat ya. Jangan lupa cicilannya dibayar tepat waktu, biar NPL tetap rendah. Hehe.', 'Asyik, tanggal muda. Semoga berkah ya{nm}.'],
  birthday: ['Wah, selamat ulang tahun{nm}! Semoga sehat, bahagia, dan targetnya tercapai semua.', 'Selamat ulang tahun! Hari ini angkanya saya bacakan dengan ekstra semangat.'],
  salam: ['Waalaikumsalam{nm}.', 'Waalaikumsalam warahmatullah.'],
  ponder: ['Santai, dipikir dulu saja. Kalau bingung mulai dari mana, coba bilang "briefing hari ini".', 'Nggak apa-apa, pelan-pelan. Mau saya kasih gambaran nasional dulu?'],
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

export function workdaysIn(ym, fromDay = 1, toDay = 31) {
  const [y, m] = String(ym).split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  let work = 0;
  for (let day = Math.max(1, fromDay); day <= Math.min(last, toDay); day += 1) {
    const x = new Date(y, m - 1, day);
    if (x.getDay() === 0 || x.getDay() === 6 || isHoliday(iso(x))) continue;
    work += 1;
  }
  return work;
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
    const label = `${String(when.getHours()).padStart(2, '0')}.${String(when.getMinutes()).padStart(2, '0')}`;
    if (when <= now) when.setDate(when.getDate() + 1);
    const ms = when - now;
    if (ms <= 18 * 3600000) return { ms, about, at: label };
    return { ms: 0, about, at: label, past: true };
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
