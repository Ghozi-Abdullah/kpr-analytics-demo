import { normalizeText } from '../ask/parser.js';

export const WAKE_NAME = 'Kirana';
export const WAKE_PHRASE = `Hai ${WAKE_NAME}`;

const WAKE_RE = /(?:^|\s)(?:(?:h[ae]i|hey|hei|halo|hallo|helo|oke|ok|eh|yo|kak|mbak|neng|dik)\s*)?(?:kirana|kirena|qirana|kiranna|kiraana|kiranah|khirana|kirani)(?=\s|$|[,.!?])/i;

export function findWake(text) {
  const m = WAKE_RE.exec(` ${text}`);
  if (!m) return null;
  return { rest: ` ${text}`.slice(m.index + m[0].length).replace(/^[\s,.!?]+/, '').trim() };
}

export const shortRo = (ro) => String(ro || '').replace(/^.*\/\s*/, '');

const DIGIT = { nol: 0, kosong: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9 };

function readNumber(tk, i) {
  let total = 0;
  let cur = 0;
  let any = false;
  let open = true;
  let j = i;
  while (j < tk.length) {
    const w = tk[j];
    if (w in DIGIT) { if (!open) break; cur += DIGIT[w]; any = true; open = false; } else if (w === 'sepuluh' || w === 'sebelas') { if (!open) break; cur += w === 'sepuluh' ? 10 : 11; any = true; open = false; } else if (w === 'seratus') { if (!open) break; cur += 100; any = true; open = true; } else if (w === 'seribu') { if (!open) break; total += 1000; any = true; open = true; } else if (w === 'belas' && any && cur % 100 < 10) { cur += 10; open = false; } else if (w === 'puluh' && any && cur % 100 < 10) { cur = cur - (cur % 100) + (cur % 100) * 10; open = true; } else if (w === 'ratus' && any && cur < 10) { cur *= 100; open = true; } else if (w === 'ribu' && any) { total += (cur || 1) * 1000; cur = 0; open = true; } else break;
    j += 1;
  }
  if (!any) return null;
  let text = String(total + cur);
  if (tk[j] === 'koma' && tk[j + 1] in DIGIT) {
    let k = j + 1;
    let dec = '';
    while (k < tk.length && tk[k] in DIGIT) { dec += DIGIT[tk[k]]; k += 1; }
    text += `,${dec}`;
    j = k;
  }
  return { text, next: j };
}

export function spokenNumbers(t) {
  const tk = t.split(' ');
  const out = [];
  for (let i = 0; i < tk.length;) {
    const n = readNumber(tk, i);
    if (n) { out.push(n.text); i = n.next; } else { out.push(tk[i]); i += 1; }
  }
  return out.join(' ');
}

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

const ALIAS = { jogja: 'yogyakarta', yogya: 'yogyakarta', jogjakarta: 'yogyakarta', djogja: 'yogyakarta', 'ujung pandang': 'makassar', jkt: 'jakarta' };

function fixPlaces(t, regions) {
  const names = [...new Set(regions.map((r) => shortRo(r).toLowerCase()).filter((n) => n && !/\d/.test(n)))];
  const compact = names.map((n) => [n, n.replace(/\s+/g, '')]);
  let s = ` ${t} `;
  for (const [from, to] of Object.entries(ALIAS)) s = s.replace(new RegExp(`\\s${from}\\s`, 'g'), ` ${to} `);
  const tk = s.trim().split(' ');
  const out = [];
  for (let i = 0; i < tk.length;) {
    let hit = null;
    for (const len of [3, 2]) {
      if (i + len > tk.length) continue;
      const joined = tk.slice(i, i + len).join('');
      const m = compact.find(([, c]) => joined === c || (c.length >= 9 && lev(joined, c) <= 1));
      if (m) { hit = { name: m[0], len }; break; }
    }
    if (hit) { out.push(hit.name); i += hit.len; } else { out.push(tk[i]); i += 1; }
  }
  return out.join(' ');
}

const FILLER = /\b(tolong|coba|dong|deh|yuk|sih|nih|mohon|please|kak|bro|sayang|kirana|kirena|bisakah|minta)\b/g;

export function cleanSpoken(text, regions = []) {
  let t = String(text || '').toLowerCase().replace(/[?!,;:"“”]/g, ' ').replace(/\s+/g, ' ').trim();
  t = spokenNumbers(t);
  t = t.replace(/\b(disalurkan|penyaluran|pencairan|dicairkan|salurkan|cairkan|disalurin|dicairin)\b/g, 'disburse');
  t = t.replace(/(\d+(?:,\d+)?) ?(persen|%) ke atas/g, 'di atas $1 persen').replace(/(\d+(?:,\d+)?) ?(persen|%) ke bawah/g, 'di bawah $1 persen');
  t = t.replace(FILLER, ' ').replace(/^\s*(ya|oke|ok|nah|terus|lalu|trus|eh|hmm|em)\s+/, ' ').replace(/\s+(ya|aja|saja|gitu)\s*$/, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  if (regions.length) t = fixPlaces(t, regions);
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
    if (name === 'bandar lampung') keys.push('lampung');
    const at = keys.map((k) => t.indexOf(` ${k} `)).filter((i) => i >= 0);
    if (at.length) hits.push({ ro, at: Math.min(...at) });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.ro);
}

const TARGETS = [
  ['watch', /\b(semua ro|seluruh ro|perlu perhatian|ro perhatian|daftar ro|semua region)\b/],
  ['history', /\b(riwayat|histori|history|3 bulan|bulan terakhir)\b/],
  ['split', /\b(nfi|fix income|non fix|fixed income|fi dan nfi|fi nfi)\b|\bfi\b/],
  ['sla', /\b(sla|berkas|proses berkas)\b/],
  ['real', /\brealisasi\b/],
  ['disb', /\b(disburse|disbursement|pencairan|penyaluran|guidance|prognosa)\b/],
  ['npl', /\b(npl|kredit macet|non performing)\b/],
  ['sml', /\b(sml|dpk|special mention|perhatian khusus)\b/],
  ['deb', /\b(debitur|nasabah)\b/],
  ['os', /\b(os|outstanding|baki debet)\b/],
];
export const targetOf = (t) => TARGETS.find(([, re]) => re.test(t))?.[0] || '';

const PERF = /\b(performance|performa|kinerja|riwayat|histori|history|perkembangan|data bulanan|rekap|rekapan|laporan bulanan|tren bulanan)\b/;
const ANALYSIS = /\b(analisis|analisa|analisanya|analisisnya|insight|insightnya|temuan|apa yang perlu (saya |aku )?(tahu|ketahui)|poin penting|hal penting|highlight)\b/;

export function spanFrom(t) {
  if (/\b(tahun ini|ytd|year to date|sejak (awal tahun|januari)|awal tahun)\b/.test(t)) return 'ytd';
  if (/\b(setahun|satu tahun|1 tahun|setahun terakhir)\b/.test(t)) return '12';
  if (/\b(semester|setengah tahun)\b/.test(t)) return '6';
  if (/\b(kuartal|triwulan|quarter)\b/.test(t) && !/\b(q[1-4]|kuartal [1-4]|triwulan [1-4])\b/.test(t)) return '3';
  const m = /\b(\d{1,2}) bulan\b/.exec(t);
  if (m && !/\bbulan (lalu|depan|kemarin)\b/.test(t)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 24) return String(n);
  }
  return '';
}

const PAGES = [
  ['ringkasan', /\b(ringkasan|summary)\b/], ['performance', /\b(performance|performa|kinerja)\b/], ['realisasi', /\brealisasi\b/],
  ['portofolio', /\b(portofolio|portfolio)\b/], ['sla', /\b(sla|berkas)\b/], ['direktur', /\b(direktur|utama|beranda|home|depan)\b/],
];

const OPEN = /\b(buka|bukain|bukakan|detail|detil|detailnya|rincian|rinciannya|rinci|perbesar|zoom|lengkapnya|selengkapnya|lebih lengkap|grafik|grafiknya|chart|diagram)\b/;
const SHOW = /\b(lihat|liat|lihatin|tampilkan|tampilin|tunjukkan|tunjukin|cek|check|buka|bukain|gimana|bagaimana|gmn|kondisi|keadaan|ringkasan|rangkum|rangkuman|overview|performa|kinerja|profil|laporan|apa kabar|kabar|mau lihat|pengen lihat)\b/;
const ASKING = /\b(berapa|brp|kenapa|knp|mengapa|apakah|bandingkan|dibanding|dibandingkan|banding|vs|versus|tren|trend|naik|turun|tertinggi|terendah|terbesar|terkecil|paling|ranking|peringkat|siapa|mana|kapan|harus|perlu|butuh|target|proyeksi|prediksi|kalau|jika|rata|porsi|kontribusi|selisih|beda|apa)\b/;
const TIME = /\b(kemarin|kemaren|tadi|minggu (lalu|kemarin)|pekan lalu|bulan (lalu|kemarin|depan|sebelumnya)|tahun (lalu|depan|ini)|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|q[1-4]|kuartal|triwulan|semester|tanggal|tgl|\d+ (hari|minggu|bulan|tahun)|sejak|ytd|awal tahun|akhir (bulan|tahun)|20\d\d)\b/;
const FILTER = /\b(filter|saring|pilih|ganti ke|ganti jadi|pindah ke|set ke|fokus ke|fokus|fokuskan|fokusin|filterin)\b/;
const CLOSE = /^(tutup|tutupin|close|selesai|sudah|udah|keluar|batal|hide|sembunyikan|bubar)(\s+(aja|saja|dulu|ya|semua|semuanya|pop ?up|popup|jendela|layar|detail|tampilan|kirana))*$/;
const HUSH = /^(stop|diam|diem|sst+|cukup|berhenti|udah diam|jangan ngomong dulu)(\s+(dulu|ya|bicara|ngomong|dong|bicaranya))*$/;
const BACK = /^(kembali|balik|mundur|back|sebelumnya|yang tadi|tadi)(\s+(lagi|dong|ya|ke tadi|ke yang tadi|ke sebelumnya|sebelumnya))*$/;
const NEXT = /^((ro|region|wilayah|yang)\s+)?(berikutnya|selanjutnya|next|lainnya|lain)(\s+(dong|ya|lagi))*$/;
const PREV = /^(ro|region|wilayah)\s+sebelumnya$/;
const BRIEF = /\b(briefing|brief|laporan (pagi|harian|hari ini|singkat|terbaru)|rangkum(an)?( hari ini| semua| nasional)?|ringkasan( hari ini| nasional| semua)?|update hari ini|(gimana|bagaimana|kondisi|keadaan|kabar) (hari ini|nasional|semua|kpr)|nasional (gimana|bagaimana)|lihat nasional|tampilkan nasional|kondisi kpr|kabar kpr|situasi (hari ini|terkini|nasional))\b/;
const OPINION = /\b(menurut (kamu|kirana|mu|anda)|gimana menurut(mu| kamu)|pendapat(mu| kamu)|penilaian(mu| kamu)|(bagus|aman|sehat|oke|parah|bahaya|gawat|jelek|baik) (nggak|gak|ga|tidak|enggak|ngga|apa (nggak|gak|ga|enggak|tidak))|apakah (bagus|aman|sehat|baik))\b|^(apakah|apa) .*\b(aman|sehat|bagus|parah|gawat|bahaya)$/;
const ADVICE = /\b(saran(nya|mu| kamu)?|rekomendasi(nya|mu| kamu)?|masukan(nya|mu| kamu)?|apa yang (harus|perlu|bisa) (saya |aku |kita )?(lakukan|kerjakan|dilakukan|diperbaiki|dikejar)|harus ngapain|perlu ngapain|(gimana|bagaimana) (caranya|cara) (naik|menaikkan|naikin|turunin|menurunkan|ngejar|mengejar|kejar|memperbaiki|perbaiki|benahi)|langkah(nya)? (apa|selanjutnya)|tindak lanjut(nya)?|fokus(nya)? (ke )?apa|prioritas(nya)?( apa)?)\b/;
const QUARTER = /\b(?:q|kuartal|triwulan|tw)\s?([1-4])\b|\bsemester\s?(1|2|satu|dua)\b/;
const YEAR_END = /\b(akhir tahun|akhir desember|desember|tutup tahun|year end)\b/;
const PROJECTION = /\b(proyeksi|perkiraan|prediksi|estimasi|forecast|tercapai|capai|kecapai|kekejar|terkejar|target|tembus)\b/;
const GAP = /\b(capaian|pencapaian|achievement|sisa|kurang|kekurangan|gap|jarak|selisih)\b/;
const GAP_REF = /\b(rka|guidance|target|prognosa)\b/;
const RANKY = /\b(tertinggi|terendah|terbaik|terburuk|paling|peringkat|ranking|ro mana|mana yang|per ro|per kanca|semua ro|daftar|siapa)\b/;
const SLA_WORDS = /\b(berkas|sla|tahap|tertahan|prakarsa|putusan|pemutus|antrian|antre)\b/;
const MONTH_RE = /\b(januari|jan|februari|pebruari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|agt|ags|september|sept|sep|oktober|okt|november|nov|nop|desember|des)\b(?:\s+(?:tahun\s+)?(20\d\d))?/g;
const MONTH_NO = { januari: 1, jan: 1, februari: 2, pebruari: 2, feb: 2, maret: 3, mar: 3, april: 4, apr: 4, mei: 5, juni: 6, jun: 6, juli: 7, jul: 7, agustus: 8, agu: 8, agt: 8, ags: 8, september: 9, sept: 9, sep: 9, oktober: 10, okt: 10, november: 11, nov: 11, nop: 11, desember: 12, des: 12 };
const MONTH_CMP = /\b(bandingkan|bandingin|banding|dibanding(kan)?|perbandingan|vs|versus|beda(nya)?|selisih(nya)?|compare)\b/;
const MONTH_JOIN = /\b(dan|sama|dengan|ke|sampai|hingga|vs)\b/;
const MONTH_SHOW = /\b(lihat|liat|tampilkan|tunjukkan|tunjukin|buka|cek|data|kinerja|performa|performance|posisi|kondisi|rekap|ringkasan|gimana|bagaimana|seperti apa|kayak apa)\b/;

export function monthsIn(t) {
  const lastYear = /\btahun (lalu|kemarin)\b/.test(t);
  const out = [];
  for (const m of t.matchAll(MONTH_RE)) out.push({ m: MONTH_NO[m[1]], y: m[2] ? Number(m[2]) : null, lastYear, at: m.index });
  for (const m of t.matchAll(/\bbulan (lalu|kemarin|sebelumnya)\b/g)) out.push({ rel: -1, at: m.index });
  for (const m of t.matchAll(/\b(bulan ini|sekarang|saat ini)\b/g)) out.push({ rel: 0, at: m.index });
  return out.sort((a, b) => a.at - b.at).map(({ at, ...x }) => x);
}

const WORST = /\b(terburuk|terjelek|terparah|terlemah|terbawah|paling (jelek|buruk|parah|lemah|rendah|bawah|tertinggal))\b/;
const BEST = /\b(terbaik|terbagus|terkuat|teratas|juara|paling (bagus|baik|kuat|oke|top|atas))\b/;

export function routeCommand(raw, { q = null, regions = [], showing = '', focus = '' } = {}) {
  const t = cleanSpoken(raw, regions);
  if (!t) return { type: 'none', text: t };
  const words = t.split(' ').length;
  const r = (type, extra = {}) => ({ type, text: t, ...extra });
  const fix = t.match(/^(?:eh |oh )?(?:bukan|salah)(?: bukan)?(?: itu| yang itu)? (?:maksud(?:nya|ku| saya| aku)|tapi|yang saya mau|yang aku mau|saya mau|aku mau|maunya)\s+(.+)$/);
  if (fix) return { ...routeCommand(fix[1], { q, regions, showing, focus }), corrected: true };
  if (/^(?:eh |oh )?(bukan|keliru|salah dengar|salah tangkap)( (itu|yang itu|yang ini|begitu|gitu|maksudnya|maksud saya|maksud aku))*$/.test(t)) return r('notThat');
  if (HUSH.test(t)) return r('hush');
  if (CLOSE.test(t) || (/\btutup\b/.test(t) && words <= 5)) return r('close');
  if (/^(iya|ya|yap|yup|yoi|boleh|oke|ok|okay|mau|lanjut|gas|gaskeun|silakan|tentu|betul|benar|setuju|sip|siap|ayo|yuk)(\s+(dong|deh|aja|saja|ya|kak|boleh|mau|lanjut|silakan|banget|gas))*$/.test(t)) return r('yes');
  if (/^(tidak|nggak|enggak|gak|ga|engga|ndak|jangan|nanti|no|belum)(\s+(usah|dulu|saja|aja|deh|ya|perlu|lain kali|makasih|terima kasih|jadi))*$/.test(t)) return r('no');
  if (/\b(terima ?kasih|makasih|maksih|thanks|thank you|tengkyu|suwun|nuhun)\b/.test(t) && words <= 6) return r('thanks');
  if (/^(dadah|dah|bye|bye bye|sampai jumpa|sampai nanti|selamat tinggal|udahan|see you|pamit)(\s+(ya|dulu|lagi|kirana))*$/.test(t)) return r('bye');
  if (/^(wah |wow |oke |ok |nah )?(kamu |kirana )?(bagus|mantap|mantab|mantul|keren|pintar|pinter|hebat|good|nice|top|luar biasa|cakep|cantik|lucu|gemes|gemas|imut|sip mantap)(\s+(sekali|banget|bgt|ya|deh|jawabannya|nih|job|kamu|sih))*$/.test(t)) return r('praise');
  const low = String(raw || '').toLowerCase().replace(/[?!,;:."“”]/g, ' ').replace(/\s+/g, ' ').trim();
  const bare = low.replace(/^(hai|hei|hey|halo|oke|ok)\s+/, '').replace(/^kirana\s+/, '').replace(/\s+kirana$/, '');
  if (/\b(siapa nama (saya|aku|gue)|nama (saya|aku|gue) siapa|(kamu|masih) (tahu|tau|ingat|inget) nama (saya|aku|gue)|aku siapa|saya siapa)\b/.test(low)) return r('whoAmI');
  if (/\b(lupakan nama (saya|aku)|hapus nama (saya|aku)|jangan panggil nama|(nggak|gak|ga|tidak) usah panggil nama)\b/.test(low)) return r('forgetName');
  const who = low.match(/\b(?:panggil (?:saya|aku|gue|gw)|nama (?:saya|aku|gue)(?: adalah)?|sebut (?:saya|aku)|kenalin (?:saya|aku)|kenalkan (?:saya|aku)|(?:saya|aku) biasa dipanggil)\s+(?:dengan\s+)?((?:pak|bu|bapak|ibu|mas|mbak|mba|kak|bang)\s+)?([a-z]+(?: [a-z]+)?)$/);
  if (who && !/^(apa|siapa|kamu|kirana)\b/.test(who[2])) return r('setName', { name: `${who[1] || ''}${who[2]}` });
  if (/^((kamu|kirana) )?(masih )?(di sana|disana|dengar|denger|ada|bangun|on|dengar aku|dengar saya)( (nggak|gak|ga|tidak|kan|ya))?$/.test(bare) || /^(tes|test|cek|check)( (tes|test|satu dua|1 2|suara|mic))*$/.test(bare)) return r('present');
  if (/^(tunggu|sebentar|bentar|wait|sabar|tunggu sebentar|tunggu bentar|sebentar ya|bentar ya)( (dulu|ya|aku|saya|mikir|lagi mikir))*$/.test(bare)) return r('wait');
  if (/^(maaf|sori|sorry|maafin|maafkan|maaf ya)( (ya|aku|saya|kirana|salah|tadi))*$/.test(bare)) return r('sorry');
  if (/\b(salah (terus|lagi|melulu)|kok salah|nggak nyambung|gak nyambung|ga nyambung|budek|bego|bodoh|lemot|nggak ngerti ngerti|gak ngerti ngerti)\b/.test(low)) return r('annoyed');
  if (/\b(selamat tidur|mau tidur|pamit tidur|good night|met bobo|aku tidur dulu|saya tidur dulu|mau istirahat)\b/.test(low)) return r('goodnight');
  if (/\b(cerita lucu|lelucon|jokes?|lawak|ngelawak|melawak|bikin (aku |saya )?ketawa|hibur (aku|saya)|tebak tebakan|tebak-tebakan|receh|lucu lucuan)\b/.test(low)) return r('joke');
  if (/\b(nyanyi|bernyanyi|nyanyiin|nyanyikan|sing a song)\b/.test(low)) return r('sing');
  if (/\b((kamu|kirana) (itu )?(ai|a i|robot|manusia|mesin|chatgpt|bot|beneran)|apakah kamu (ai|robot|manusia)|kamu pakai ai|kamu orang)\b/.test(low)) return r('isAi');
  if (/\b(siapa yang (bikin|buat|membuat|menciptakan|program) (kamu|kirana)|(kamu|kirana) (dibuat|dibikin|diciptakan) (oleh|sama|siapa)|pencipta(mu| kamu)|yang bikin kamu)\b/.test(low)) return r('whoMade');
  if (/\b(umur(mu| kamu)|usia(mu| kamu)|(kamu|kirana) umur berapa|berapa umur (kamu|kirana))\b/.test(low)) return r('age');
  if (/\b(aku|saya|gue) (sayang|cinta|suka) (kamu|kirana|sama kamu)\b|\b(i )?love you\b|\bkamu (sayang|cinta) (aku|saya)\b/.test(low)) return r('love');
  if (/\b(kamu suka apa|kesukaan(mu| kamu)|hobi(mu| kamu)|favorit(mu| kamu)|kamu sukanya apa)\b/.test(low)) return r('like');
  if (/\b(kamu )?(sudah|udah) makan\b|\bmakan apa (hari ini|tadi)\b/.test(low) && words <= 6) return r('eat');
  if (/\b(cuaca|hujan (nggak|gak|ga|tidak)|bakal hujan)\b/.test(low)) return r('weather');
  if (/\b(bahasa inggris|speak english|in english|english please|pakai english)\b/.test(low)) return r('english');
  if (/\b(aku|saya|gue) (lagi |sedang )?(sedih|galau|bete|kesal|kesel|bad mood|badmood|down)\b/.test(low)) return r('sad');
  if (/\b(capek|cape|lelah|pusing|penat|stres|stress|suntuk|ngantuk)\b/.test(low) && !targetOf(t)) return r('tired');
  if (/\b(semangatin|semangati|kasih semangat|beri semangat|motivasi(in)?|kata kata (motivasi|mutiara|bijak)|butuh semangat|semangat dong)\b/.test(low)) return r('motivate');
  if (/\b(gajian|gaji (masuk|turun|cair)|tanggal muda)\b/.test(low) && !targetOf(t)) return r('payday');
  if (/^(hore+|horee+|yeay+|yey+|asik+|asyik+|mantap jiwa|alhamdulillah)(\s|$)/.test(bare) || /\b(target (sudah |udah )?tercapai|kita berhasil|selamat ya|selamat kirana)\b/.test(low)) return r('congrats');
  if (/\b(data (per|terakhir|terbaru|tanggal)|(update|diperbarui|diupdate|diupdet) (kapan|terakhir|tanggal berapa)|kapan (data|terakhir (diperbarui|diupdate|update))|datanya (per )?(kapan|tanggal berapa)|posisi data|data (sampai|hingga) (kapan|tanggal))\b/.test(t) || (/\bdata(nya)?\b/.test(t) && /\b(update|diperbarui|diupdate|masuk|terakhir)\b/.test(t) && /\b(kapan|jam berapa|tanggal berapa)\b/.test(t) && !targetOf(t))) return r('dataDate');
  if (/\b(jam berapa|pukul berapa|sekarang jam)\b/.test(t)) return r('time');
  if (/\b(tanggal berapa|hari apa|hari ini tanggal|tanggal hari ini|sekarang tanggal)\b/.test(t)) return r('date');
  if ((/\b(sisa|tinggal|kurang) (berapa )?hari( kerja)?\b|\bberapa hari (kerja )?lagi\b|\bhari kerja (tersisa|tinggal|sisa|bulan ini)\b/.test(t)) && !/\b(disburse|realisasi|target|per hari|kejar)\b/.test(t)) return r('daysLeft');
  if (/\b(keluar|tutup|matikan|selesai|berhenti|exit|udahan)\b.*\b(layar penuh|full ?screen|mode presentasi)\b/.test(t)) return r('exitFull');
  if (/\b(layar penuh|full ?screen|mode presentasi|perbesar layar)\b/.test(t)) return r('fullscreen');
  if (/^(cetak|print|printout|print out|cetak halaman|print halaman|cetak dashboard|print dashboard)$/.test(t)) return r('print');
  if (/^(salin|copy|kopi|copas)( (jawaban(nya)?|teks(nya)?|itu|ini|tadi|hasil(nya)?))*$/.test(t)) return r('copy');
  if (/^(bagikan|share|kirim)( (jawaban(nya)?|ini|itu|ke (wa|whatsapp|email|grup|tim)))*$/.test(t)) return r('share');
  if (/\b(batal(kan)?|hapus|matikan|cancel) (semua )?(pengingat|reminder|alarm)\b/.test(t)) return r('remindCancel');
  if (/\b(ada pengingat|pengingat apa|daftar pengingat|reminder apa)\b/.test(t)) return r('remindList');
  if (/\b(ingatkan|ingetin|ingatin|ingetkan|reminder|pengingat|alarm)\b/.test(t)) return r('remind');
  if (/\b(kerasin|keraskan|lebih keras|perbesar suara|besarkan suara|gedein suara|gedein volume|volume (naik|naikkan|naikin|tambah|lebih besar|dibesarkan|full)|kurang (keras|kedengaran|kedengeran|jelas suaranya)|nggak kedengaran|gak kedengaran)\b/.test(t)) return r('volUp');
  if (/\b((kecilkan|kecilin|pelankan|pelanin) (suara|volume)(nya)?|lebih kecil suaranya|suaranya (kecilin|kecilkan|terlalu keras|kekencengan|kebesaran)|volume (turun|turunkan|turunin|kecilkan|kecilin|dikecilkan|lebih kecil)|jangan (terlalu )?keras)\b/.test(t)) return r('volDown');
  if (/\b(matikan|nonaktifkan|hentikan|stop|off(kan)?|gak usah pakai|nggak usah pakai|jangan pakai) (peredam|penyaring|filter|pengurang) (bising|suara|noise|kebisingan|mic|mikrofon|berisik)\b|\bnoise cancel(l)?ing(nya)? (off|mati|matikan)\b|\b(peredam|penyaring|filter) (bising|suara|noise|kebisingan|mic|mikrofon)(nya)? (off|mati(in|kan)?|dimatikan)\b/.test(t)) return r('cleanOff');
  if (/\b(nyalakan|aktifkan|hidupkan|on(kan)?|pakai|pasang) (peredam|penyaring|filter|pengurang) (bising|suara|noise|kebisingan|mic|mikrofon|berisik)\b|\bnoise cancel(l)?ing\b|\b(cuma|hanya|cukup) (dengar(kan|in)?|denger(in)?) (suara |omongan )?saya( (aja|saja|doang))?\b|\b(lagi|di sini|ruangan(nya)?|suasana(nya)?) (rame|ramai|berisik|bising)\b/.test(t)) return r('cleanOn');
  if (/\b(peredam|penyaring|filter) (bising|suara|noise|kebisingan|mic|mikrofon)(nya)? (nyala|aktif|on|jalan)( (ga|gak|nggak|tidak|belum))?\b/.test(t)) return r('cleanStatus');
  if (/\b(jawab(an(nya)?)? (singkat|pendek|ringkas)|to the point|langsung ke inti|intinya (saja|aja)|jangan panjang panjang|kepanjangan|mode singkat)\b/.test(t) || /^(singkat|ringkas|pendek)( (saja|aja|aja ya))?$/.test(t)) return r('short');
  if (/\b(jawab(an(nya)?)? (lengkap|panjang|detail)|mode lengkap|jangan (terlalu )?singkat|kurang lengkap)\b/.test(t)) return r('long');
  if (/\b(lagi di (halaman|mana)|sekarang di (halaman )?(mana|apa)|ini halaman apa|(ini|lagi|sedang|sekarang) (lagi )?lihat apa|filter(nya)? apa)\b/.test(t)) return r('whereAmI');
  if (/\b(kabar (baik|gembira|bagus)(nya)?|berita (baik|bagus)|good news|yang bagus (apa|siapa)|apa yang bagus|ada yang bagus)\b/.test(t)) return r('goodNews');
  if (/\b(kabar (buruk|jelek)(nya)?|berita (buruk|jelek)|bad news|yang (jelek|buruk) (apa|siapa)|apa yang (jelek|buruk)|yang perlu diwaspadai|ada yang (jelek|buruk|bahaya))\b/.test(t)) return r('badNews');
  if (/\b(hapus|bersihkan|kosongkan|reset) (catatan|daftar) (belajar|pertanyaan)\b/.test(low)) return r('missClear');
  if (/\b(pertanyaan|perintah) (yang )?(belum|gak|nggak|ga|tidak) (bisa )?(kamu )?(dijawab|terjawab|dipahami|dimengerti)\b|\b(catatan|daftar) (belajar|pertanyaan gagal)\b|\bapa (saja|aja) yang (belum|gak|nggak|ga) (bisa )?(kamu )?jawab\b/.test(low)) return r('missList');
  if (/^(assalamu ?alaikum|asalamu ?alaikum)\b/.test(bare) && words <= 5) return r('salam');
  if (/^(ha(ha)+h?|he(he)+|hi(hi)+|wk(wk)+\w*|xixi\w*|lol|ngakak)( (ha|he|hi|wk)\w*)*( (lucu|kocak|banget|bgt))*$/.test(bare)) return r('laugh');
  if (/^((wah+|wow+|wih+|weh+|widih|anjay|gokil|gila)( (keren|mantap|gokil|lumayan|seru))?|keren juga|mantap juga|lumayan|lumayan juga|not bad)( (ya|banget|sih|juga|nih|deh|dong))*$/.test(bare)) return r('wow');
  if (/^(serius|seriusan|beneran|masa|masak|masa sih|yang bener|yang benar|yakin|sungguh|emang iya|benarkah|apa iya|really)( (sih|nih|kirana|ya|kamu|itu|angkanya|datanya))*$/.test(bare)) return r('really');
  if (/\b(angka(nya)?|data(nya)?|hitungan(nya)?) (kok )?(salah|aneh|keliru|nggak (bener|benar|valid|masuk akal)|gak (bener|benar|valid|masuk akal)|ga (bener|benar|valid|masuk akal))\b|\b(kayaknya|sepertinya) (salah|keliru)\b|\bkok aneh\b|\b(nggak|gak|ga|tidak) masuk akal\b/.test(low)) return r('doubt');
  if (/^(jadi |terus |trus |oke )?(intinya|kesimpulannya|singkatnya|ringkasnya|garis besarnya|jadi gimana|jadi bagaimana|kesimpulan(nya)? apa|intinya apa|jadi intinya)( (apa|gimana|dong|ya|nih|aja|saja))*$/.test(bare)) return r('gist');
  if (/\b(lagi apa|lagi ngapain|sedang apa|ngapain aja|kamu ngapain)\b/.test(low) && words <= 5) return r('whatDoing');
  if (/\b(makan siang|mau makan|makan dulu|lapar|laper|ishoma|maksi|istirahat makan)\b/.test(low) && words <= 7 && !targetOf(t)) return r('lunch');
  if (/\b(sholat|shalat|solat|salat|jumatan|ke masjid|ibadah dulu)\b/.test(low) && words <= 7) return r('pray');
  if (/\b(ngopi|minum kopi|ngeteh|minum teh|coffee break|rehat kopi)\b/.test(low) && words <= 7) return r('coffee');
  if (/\b((mau|ada|akan|siap siap|persiapan|habis ini|abis ini|sebentar lagi|bentar lagi) (rapat|meeting|presentasi)|(rapat|meeting) (sebentar|bentar) lagi)\b/.test(low) && !targetOf(t)) return r('meeting');
  if (/\b(mau pulang|pulang dulu|(aku|saya|gue) pulang|cabut dulu|otw pulang|(sudah|udah) jam pulang|waktunya pulang)\b/.test(low)) return r('goHome');
  if (/^(ayo |yuk |mari |oke )?(mulai|kita mulai|mulai kerja|ayo kerja|kerja yuk|siap kerja|gas kerja|mulai hari ini|let s go|lets go)( (yuk|ya|dong|kirana|sekarang|deh))*$/.test(bare)) return r('workStart');
  if (/\b(bosan|bosen|gabut|jenuh|boring)\b/.test(low) && !targetOf(t)) return r('bored');
  if (/\b(akhir pekan|weekend|wiken|besok libur|libur panjang|long weekend|malam minggu|hari libur)\b/.test(low) && !targetOf(t) && words <= 7) return r('weekend');
  if (/\b((aku|saya|gue) (lagi )?(ulang tahun|ultah)|hari ini (aku |saya )?(ulang tahun|ultah)|ultah (aku|saya)|ulang tahun (aku|saya))\b/.test(low)) return r('birthday');
  if (/\b(kangen|rindu)\b/.test(low) && (/\b(kamu|kirana)\b/.test(low) || words <= 3)) return r('miss');
  if (/^(hmm+ |em+ )?(gimana ya|bagaimana ya|apa ya|bingung|bingung nih|aku bingung|saya bingung|mulai dari mana ya|enaknya apa ya)$/.test(bare)) return r('ponder');
  if (/\b(fakta (menarik|unik|lucu)|fun fact|hal (menarik|unik)|info menarik|ada yang menarik|cerita(in)? (sesuatu|dong)|kasih tahu sesuatu)\b/.test(low)) return r('funFact');
  if (/^(maksudnya|artinya|jelasin|jelaskan|terangkan|gimana maksudnya|maksudnya gimana|maksudnya apa|artinya apa|lebih detail|lebih jelas|jelaskan lebih (lanjut|detail|jelas)|jelasin lagi|detailnya|penjelasannya)( (lagi|lebih lanjut|lebih detail|gimana|apa))*$/.test(t)) return r('explain');
  if (/^(kenapa|mengapa|kok gitu|kok begitu|kok bisa|why|apa sebabnya|apa penyebabnya|penyebabnya apa|sebabnya apa)( (bisa|begitu|gitu|ya|sih))*$/.test(t)) return r('why');
  if (/^(terus|trus|lalu|selanjutnya apa|terus gimana|trus gimana|lalu gimana|habis itu|abis itu|lanjutkan|lanjutin|teruskan|terus apa lagi|apa lagi|ada lagi)$/.test(bare)) return r('continue');
  if (/^(lagi|satu lagi|tambah lagi|yang lain lagi|lagi lagi|another|one more)( (dong|ya|kirana|deh))*$/.test(bare)) return r('more');
  if (/^(wah |waduh |aduh |hmm |wih )?(parah|jelek (banget)?|gawat|bahaya|anjlok|ngeri|kacau|waduh|aduh|turun terus|kok turun|merah semua)( (ya|banget|nih|juga|sekali))*$/.test(bare)) return r('reactBad');
  if (/^(oh+|oh gitu|oh begitu|o gitu|gitu ya|begitu ya|i see|noted|paham|ngerti|mengerti|oke paham|sip paham|hmm+|mm+|oh oke|oh ok|ooh|okelah|baiklah)( (ya|deh|kirana))*$/.test(bare)) return r('ack');
  if (/\b(siapa (kamu|namamu|nama kamu|anda|dirimu)|kamu siapa|nama kamu siapa|perkenalkan( diri)?|kenalan)\b/.test(t)) return r('intro');
  if (/\b(apa kabar|gimana kabar|kabarmu|kabar kamu|lagi apa|sehat)\b/.test(t) && !OPINION.test(t) && !regions.some((x) => t.includes(shortRo(x).toLowerCase()))) return r('smalltalk');
  if (/\b(bisa apa|bantuan|help|apa saja yang bisa|perintah apa|cara pakai|contoh perintah|bisa ngapain|daftar perintah|list perintah|list command|daftar command|menu perintah|semua perintah|perintah (suara|ngobrol|asisten|santai|wilayah|detail))\b/.test(t)) return r('help');
  if (/^(halo|hai|hei|hey|hallo|pagi|siang|sore|malam|selamat (pagi|siang|sore|malam))(\s+(kirana|semua|juga))?$/.test(t)) return r('greet');
  if (/\b(matikan|nonaktifkan|berhenti|stop|jangan)\b.*\b(mode dengar|dengar|mendengar|mendengarkan|mic|mikrofon)\b/.test(t)) return r('wakeOff');
  if (/\b(nyalakan|aktifkan|hidupkan)\b.*\b(mode dengar|dengar|mendengar|mendengarkan)\b/.test(t)) return r('wakeOn');
  if (/\b(daftar suara|suara apa (saja|aja)|ada suara apa|pilihan suara|atur suara|setting suara|pengaturan suara|menu suara|pilih suara)$/.test(t) || /^(suara( kirana)?|suara apa|ada suara apa)$/.test(t)) return r('voiceList');
  const sex = t.match(/^suara (cowok|cewek|pria|wanita|perempuan|laki laki)$/);
  if (sex) return r('voicePick', { name: sex[1] });
  const pick = t.match(/\b(?:pakai|ganti|pilih|ubah|coba|tukar)(?: ke)? suara(?:nya)?(?: ke| jadi| yang)? ([a-z][a-z ]{1,24})$/);
  if (pick && !/^(lain|lainnya|yang lain|baru|lagi|dong|ya|lain dong|lain lagi|lain ya|aja)$/.test(pick[1].trim())) return r('voicePick', { name: pick[1].replace(/\b(dong|ya|aja|saja|deh|dulu)\b/g, '').trim() });
  if (/\b(nada|nadanya|suara|suaranya)\b/.test(t) && /\b(tinggi|tinggiin|tinggikan|naikin|naikkan|cempreng|imut|ceria)\b/.test(t) && !targetOf(t)) return r('pitchUp');
  if (/\b(nada|nadanya|suara|suaranya)\b/.test(t) && /\b(rendah|rendahin|rendahkan|turunin|turunkan|berat|ngebas|dalam|kalem)\b/.test(t) && !targetOf(t)) return r('pitchDown');
  if (/\b(jangan (bicara|ngomong|bersuara)|tanpa suara|mute|bisukan|matikan suara(nya)?|suaranya matikan|matiin suara(nya)?)\b/.test(t)) return r('mute');
  if (/\b(nyalakan suara|bersuara lagi|unmute|bicara lagi|pakai suara|hidupkan suara)\b/.test(t)) return r('unmute');
  if (/\b(ganti|ubah|tukar|coba|pakai) (suara|voice|suaranya)( (lain|lainnya|yang lain|baru))?\b/.test(t)) return r('voice');
  const talkCue = /\b(bicara|ngomong|suara|suaranya|bicaranya|ngomongnya|bacanya|kamu|temponya)\b/.test(t) || words <= 3;
  if (/\b(pelan|pelanin|pelankan|lambat|lambatin|lambatkan)\b/.test(t) && talkCue && !targetOf(t)) return r('slower');
  if (/\b(cepat|cepet|cepetan|cepatkan|cepetin)\b/.test(t) && talkCue && !targetOf(t)) return r('faster');
  if (/^(ulangi|ulang|ulang lagi|ulangin|apa tadi|tadi apa|sekali lagi|coba ulangi|diulang|bilang lagi|apa|hah|maaf apa)(\s+(dong|lagi|ya|tadi|sekali lagi))*$/.test(t)) return r('repeat');
  if (/\b(refresh|muat ulang|perbarui data|update data|segarkan|reload|tarik data)\b/.test(t)) return r('refresh');
  if (/^(buka|tampilkan|lihat|munculkan)\s+(menu|sidebar|navigasi|daftar menu)$/.test(t)) return r('menu');
  if (/\b(status data|info data)\b/.test(t)) return r('status');
  const pageCue = /\b(halaman|menu|page|tab|dashboard)\b/.test(t) || /\b(pindah|pergi|masuk|balik) ke\b/.test(t) || (/^ke\b/.test(t) && words <= 3);
  const page = pageCue ? PAGES.find(([, re]) => re.test(t))?.[0] : '';
  if (page) return r('page', { view: page });
  if (/\b(halaman|page)\b/.test(t) && /\b(buka|pindah|pergi|masuk|ke|lihat)\b/.test(t)) return r('pageUnknown');
  const sumber = /\b(7|6|5) sumber\b/.exec(t);
  if (sumber && words <= 6) return r('sumber', { mode: sumber[1] });
  if (BACK.test(t)) return r('back');
  if (PREV.test(t)) return r('prevRo');
  if (NEXT.test(t)) return r('nextRo');
  const asking = ASKING.test(t);
  const time = TIME.test(t);
  const ent = q?.entities || {};
  const target0 = targetOf(t);
  const specific = !!(ent.kanca?.length || ent.rm?.length || ent.tipe?.length || ent.node?.length || ent.prov?.length || (ent.fi && target0 !== 'split')) || /\b(kanca|kc|kcp|cabang|unit|rm|pemutus|provinsi|kota|kabupaten)\b/.test(t);
  const qRos = ent.ro || [];
  const ros0 = qRos.length ? qRos.filter((x) => regions.includes(x)) : matchRegion(t, regions);
  const area = /\b(jakarta|jkt|jabodetabek|jabotabek)\b(?! ?\d)/.test(t) && ros0.length >= 2 && !/\b(jakarta|jkt) ?\d\b/.test(t);
  if (area || ros0.length >= 3) return r('ask', { ro: '', text: engineText(t, { q, target: targetOf(t), ros: ros0 }) });
  const ros = ros0;
  const ro = ros.length === 1 ? ros[0] : '';
  const target = targetOf(t);
  const near = showing && /\b(sini|situ|ini|itu|tersebut|tadi|nya)\b/.test(t.replace(/\b(bulan|hari|minggu|tahun|saat|pekan|sampai) (ini|itu)\b/g, '')) ? showing : '';
  const subject = /\bnasional\b/.test(t) ? '' : ro || showing || focus || '';
  const why0 = /^(kenapa|mengapa|knp|kok bisa)\b/.test(t);
  if (YEAR_END.test(t) && PROJECTION.test(t) && !/\b(tahun depan|202[7-9])\b/.test(t) && ros.length < 2 && !specific && !why0) return r('yearEnd', { ro: ro || near });
  const qm = t.match(QUARTER);
  if (qm && ros.length < 2 && !specific && !why0) {
    const part = qm[1] ? { kind: 'q', n: Number(qm[1]) } : { kind: 's', n: /^(1|satu)$/.test(qm[2]) ? 1 : 2 };
    return r('quarter', { ro: ro || near, part: { ...part, y: Number(/\b(20\d\d)\b/.exec(t)?.[1]) || null, lastYear: /\btahun (lalu|kemarin)\b/.test(t) }, focus: target });
  }
  const defineQ = /\b(apa (itu|arti|artinya|maksud|maksudnya)|artinya apa|maksudnya apa|itu apa|definisi)\b/.test(t);
  const planWord = /\b(bulan depan|tahun depan|harus|butuh|dibutuhkan|simulasi|kalau|jika|bila|agar|supaya)\b/.test(t);
  if (((GAP.test(t) && (GAP_REF.test(t) || /\b(capaian|pencapaian)\b/.test(t))) || (GAP_REF.test(t) && /\b(vs|versus|dibanding|banding|terhadap)\b/.test(t)) || /^rka (os|outstanding|npl|sml|debitur)\b|\brka (os|outstanding|npl|sml|debitur)\b/.test(t)) && !planWord && !defineQ && !RANKY.test(t) && ros.length < 2 && !specific && !why0 && !monthsIn(t).some((x) => x.m)) {
    const focusOn = /\b(guidance|prognosa|disburse|penyaluran|pencairan)\b/.test(t) ? 'disb' : ['deb', 'npl', 'sml'].includes(target) ? target : 'os';
    return r('target', { ro: ro || near, focus: focusOn });
  }
  if (/\b(rata rata|rata2|rerata|per hari|sehari|harian)\b/.test(t) && /\b(disburse|penyaluran|pencairan)\b/.test(t) && !RANKY.test(t) && !defineQ && ros.length < 2 && !specific && !why0) return r('target', { ro: ro || near, focus: /\b(harus|perlu|butuh|sisa|kejar|kurang)\b/.test(t) ? 'disb' : 'pace' });
  if (target === 'sml' && /\b(proyeksi|prediksi|perkiraan|estimasi|bulan depan)\b/.test(t) && ros.length < 2 && !specific && !why0) return r('ratioForecast', { ro: ro || near, focus: 'sml' });
  if (target === 'split' && !q?.metric && ros.length < 2 && !why0 && !/\b(berapa|brp|bandingkan|banding|vs)\b/.test(t)) return r('detail', { id: 'split', ro: ro || near });
  if (OPINION.test(t) && ros.length < 2 && !specific && !time) return r('opinion', { ro: subject, target });
  if (ADVICE.test(t) && ros.length < 2 && !specific) return r('advice', { ro: subject, target });
  const months = monthsIn(t);
  const named = months.filter((x) => x.m).length;
  const span0 = spanFrom(t);
  const why = /^(kenapa|mengapa|knp|kok bisa)\b/.test(t);
  const rangeOnly = (/\b(sampai|hingga|s d)\b/.test(t) && !MONTH_CMP.test(t) && ['real', 'disb'].includes(target)) || (['real', 'disb'].includes(target) && months.some((x) => x.rel === 0));
  if ((named || MONTH_CMP.test(t)) && months.length >= 2 && ros.length < 2 && !specific && !why && !span0 && !rangeOnly && (MONTH_CMP.test(t) || MONTH_JOIN.test(t))) {
    return r('monthCompare', { ro: ro || near, months: months.slice(0, 2), focus: target });
  }
  if (named === 1 && ros.length >= 2 && !specific && !why) return r('compare', { ros: ros.slice(0, 2), metric: target, month: months.find((x) => x.m) });
  const since = months.length === 1 && named && /\b(dari|sejak|semenjak) (bulan )?(januari|jan|februari|pebruari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|agt|ags|september|sept|sep|oktober|okt|november|nov|nop|desember|des)\b/.test(t);
  if (since && ros.length < 2 && !specific && !why && !['real', 'disb'].includes(target)) return r('monthCompare', { ro: ro || near, months: [months[0], { rel: 0 }], focus: target });
  if (months.length === 1 && ros.length < 2 && !specific && !why && !span0 && (!target || PERF.test(t))
    && (MONTH_SHOW.test(t) || (named && words <= 3)) && (named || MONTH_SHOW.test(t.replace(/\bbulan (lalu|kemarin|sebelumnya|ini)\b/, '')))) {
    return r('month', { ro: ro || near, month: months[0] });
  }
  if (/\b(kembali ke nasional|ke nasional|reset( filter)?|hapus filter|tanpa filter|semua wilayah|nasional saja|nasional aja|lepas filter)\b/.test(t) && !ro && !asking) return r('nasional');
  if (ros.length >= 2 && !time && !specific) return r('compare', { ros: ros.slice(0, 2), metric: target });
  if (BRIEF.test(t) && !ro && !target && !specific && !time) return r('brief');
  if (!ro && !target && !specific && !time && (WORST.test(t) || BEST.test(t)) && (SHOW.test(t) || words <= 4)) return r('rankShow', { order: WORST.test(t) ? 'worst' : 'best' });
  if (OPEN.test(t) && !target && !ro && (showing || near) && !time && !asking) return r('detail', { id: 'os', ro: showing });
  const span = spanFrom(t);
  const perfWord = PERF.test(t);
  if (span && !specific && ros.length < 2 && (perfWord || target === 'history' || target === 'real' || (ANALYSIS.test(t) && !SLA_WORDS.test(t)) || (!target && (OPEN.test(t) || SHOW.test(t) || words <= 4))) && !(asking && !perfWord && target !== 'history')) {
    return r('detail', { id: /\brealisasi\b/.test(t) && !perfWord ? 'real' : 'history', ro: ro || near, span });
  }
  if (ANALYSIS.test(t) && !SLA_WORDS.test(t) && !specific && ros.length < 2) return r('analysis', { ro: ro || near || '' });
  if (target === 'history' && !asking && !specific) return r('detail', { id: target, ro: ro || near });
  if (target && !time && !specific && !asking && (OPEN.test(t) || target === 'watch')) return r('detail', { id: target, ro: ro || near });
  if (target && !time && !specific && !asking && SHOW.test(t) && words <= 9 && !(target === 'os' && ro && !/\b(os|outstanding)\b/.test(t))) return r('detail', { id: target, ro: ro || near });
  if (FILTER.test(t) && !asking && (ro || near)) return r('filter', { ro: ro || near });
  if (ro && !asking && !target && !time && !specific) return r('region', { ro });
  if (ro && SHOW.test(t) && !asking && !time && !specific && (!target || target === 'os')) return r('region', { ro });
  const note = /\bprovinsi\b/.test(t) && RANKY.test(t) ? 'Data kinerja tercatat per RO, jadi saya urutkan per RO.' : '';
  return r('ask', { ro, text: engineText(t, { q, target, ros }), note });
}

function engineText(t, { q, target, ros }) {
  let text = t;
  const metric = q?.metric || '';
  const ent = q?.entities || {};
  if (/\b(risiko|resiko|bahaya|waspada|diwaspadai|lampu merah|warning|red flag)\b/.test(text) && !metric) return 'ro mana yang perlu perhatian';
  if (/\b(rumah|unit) (terjual|laku|tersalur)\b|\bterjual\b/.test(text)) return `jumlah akad ${text.replace(/\b(berapa|rumah|unit|terjual|laku|tersalur)\b/g, '').trim()}`.trim();
  if (/\bberkas\b.*\b(paling lama|terlama|paling tua)\b/.test(text)) return 'umur berkas terlama';
  text = text.replace(/\brencana\b/g, 'strategi');
  if (/\b(kalau|kalo|jika|bila|seandainya|misal|misalnya|andai)\b/.test(text) && /\d+\s*(persen|%)/.test(text) && !/\bsimulasi\b/.test(text)) text = `simulasi ${text}`;
  if (/\b(proyeksi|prediksi|perkiraan|estimasi)\b/.test(text) && metric === 'npl' && !/\b(bulan depan|akhir|desember|tahun)\b/.test(text)) text = `${text.replace(/\b(proyeksi|prediksi|perkiraan|estimasi)\b/, '').trim()} bulan depan`;
  if (/\brm\b/.test(text) && !metric && !ent.rm?.length && ros.length === 1 && !/\b(per rm|terbaik|terburuk|tertinggi|terendah|paling|belum)\b/.test(text)) text = text.replace(/\brm\b/, 'realisasi per rm');
  if (/\bprovinsi\b/.test(text) && /\b(tertinggi|terendah|terbaik|terburuk|paling|peringkat|per provinsi)\b/.test(text)) text = text.replace(/\bprovinsi\b/g, 'ro');
  if (ros.length >= 3 && !metric && !/\bos\b/.test(text)) text = `${text} os`;
  const defined = /^(.+?) (itu apa|itu apaan|artinya apa|maksudnya apa|apa artinya|apa maksudnya|tuh apa)$/.exec(text);
  if (defined) return `apa itu ${defined[1]}`;
  const explain = /^(jelaskan|jelasin|terangkan|terangin)( apa itu)? (.+)$/.exec(text);
  if (explain && !ros.length && !TIME.test(text) && explain[3].split(' ').length <= 3) return `apa itu ${explain[3]}`;
  if (/\bro\b.*\b(paling besar|terbesar|paling kecil|terkecil)\b|\b(paling besar|terbesar|paling kecil|terkecil)\b.*\bro\b/.test(text) && !metric) text = `${text} os`;
  if ((ent.node?.length || /\b(subsidi|komersial)\b/.test(text)) && !metric && !/\b(bandingkan|vs|dan|banding)\b/.test(text)) text = `os ${text}`;
  if (ent.tipe?.length && !metric) text = `realisasi ${text}`;
  if (/\b(tipe|jenis|sumber)\b/.test(text) && /\brealisasi\b/.test(text) && !/\bper\b/.test(text) && !ent.tipe?.length) text = `realisasi per tipe ${text.replace(/\b(realisasi|tipe|jenis|sumber|developer)\b/g, '').trim()}`.trim();
  if (/\bkanca\b/.test(text) && !ent.kanca?.length && ros.length === 1 && !/\b(per kanca|tertinggi|terendah|terbaik|terburuk|paling|belum|tanpa|nol)\b/.test(text)) text = text.replace(/\bkanca\b/, 'per kanca');
  if (/\bberapa persen\b/.test(text) && ['os', 'debitur', 'realisasi', 'disburse'].includes(metric) && (ros.length || ent.prov?.length)) text = text.replace(/\bberapa persen\b/, 'porsi');
  if (/\b(puncak|rekor)\b/.test(text) && metric) text = `${text.replace(/\b(puncak|rekor)\b/, '').trim()} tertinggi kapan`;
  if ((/\b(naik|turun|tumbuh|bertambah|berkurang) (berapa|ga|gak|nggak|ngga|enggak|tidak|atau turun|apa turun|atau naik|apa naik)\b/.test(text) || /^perubahan\b/.test(text)) && metric && !/\b(bulan depan|tahun depan|target|harus|butuh|perlu|agar|supaya|rka)\b/.test(text)) {
    text = `${text.replace(/\b(naik|turun|tumbuh|bertambah|berkurang) (berapa|ga|gak|nggak|ngga|enggak|tidak|atau turun|apa turun|atau naik|apa naik)\b|^perubahan\b|\bbulan ini\b/g, '').replace(/\s+/g, ' ').trim()} bulan ini dibanding bulan lalu`;
  }
  return text;
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
