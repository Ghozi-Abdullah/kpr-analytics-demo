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
  ['disb', /\b(disburse|disbursement|pencairan|penyaluran)\b/],
  ['npl', /\b(npl|kredit macet|non performing)\b/],
  ['sml', /\b(sml|dpk|special mention|perhatian khusus)\b/],
  ['deb', /\b(debitur|nasabah)\b/],
  ['os', /\b(os|outstanding|baki debet)\b/],
];
export const targetOf = (t) => TARGETS.find(([, re]) => re.test(t))?.[0] || '';

const PAGES = [
  ['ringkasan', /\b(ringkasan|summary)\b/], ['performance', /\b(performance|performa|kinerja)\b/], ['realisasi', /\brealisasi\b/],
  ['portofolio', /\b(portofolio|portfolio)\b/], ['sla', /\b(sla|berkas)\b/], ['direktur', /\b(direktur|utama|beranda|home|depan)\b/],
];

const OPEN = /\b(buka|bukain|bukakan|detail|detil|detailnya|rincian|rinciannya|rinci|perbesar|zoom|lengkapnya|selengkapnya|lebih lengkap)\b/;
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
const WORST = /\b(terburuk|terjelek|terparah|terlemah|terbawah|paling (jelek|buruk|parah|lemah|rendah|bawah|tertinggal))\b/;
const BEST = /\b(terbaik|terbagus|terkuat|teratas|juara|paling (bagus|baik|kuat|oke|top|atas))\b/;

export function routeCommand(raw, { q = null, regions = [], showing = '' } = {}) {
  const t = cleanSpoken(raw, regions);
  if (!t) return { type: 'none', text: t };
  const words = t.split(' ').length;
  const r = (type, extra = {}) => ({ type, text: t, ...extra });
  if (HUSH.test(t)) return r('hush');
  if (CLOSE.test(t) || (/\btutup\b/.test(t) && words <= 5)) return r('close');
  if (/^(iya|ya|yap|yup|yoi|boleh|oke|ok|okay|mau|lanjut|gas|gaskeun|silakan|tentu|betul|benar|setuju|sip|siap|ayo|yuk)(\s+(dong|deh|aja|saja|ya|kak|boleh|mau|lanjut|silakan|banget|gas))*$/.test(t)) return r('yes');
  if (/^(tidak|nggak|enggak|gak|ga|engga|ndak|jangan|nanti|no|belum)(\s+(usah|dulu|saja|aja|deh|ya|perlu|lain kali|makasih|terima kasih|jadi))*$/.test(t)) return r('no');
  if (/\b(terima ?kasih|makasih|maksih|thanks|thank you|tengkyu|suwun|nuhun)\b/.test(t) && words <= 6) return r('thanks');
  if (/^(dadah|dah|bye|bye bye|sampai jumpa|sampai nanti|selamat tinggal|udahan|see you|pamit)(\s+(ya|dulu|lagi|kirana))*$/.test(t)) return r('bye');
  if (/^(wah |wow |oke |ok |nah )?(kamu |kirana )?(bagus|mantap|mantab|mantul|keren|pintar|pinter|hebat|good|nice|top|luar biasa|cakep|cantik|lucu|gemes|gemas|imut|sip mantap)(\s+(sekali|banget|bgt|ya|deh|jawabannya|nih|job|kamu|sih))*$/.test(t)) return r('praise');
  if (/\b(siapa (kamu|namamu|nama kamu|anda|dirimu)|kamu siapa|nama kamu siapa|perkenalkan( diri)?|kenalan)\b/.test(t)) return r('intro');
  if (/\b(apa kabar|gimana kabar|kabarmu|kabar kamu|lagi apa|sehat)\b/.test(t) && !regions.some((x) => t.includes(shortRo(x).toLowerCase()))) return r('smalltalk');
  if (/\b(bisa apa|bantuan|help|apa saja yang bisa|perintah apa|cara pakai|contoh perintah|bisa ngapain)\b/.test(t)) return r('help');
  if (/^(halo|hai|hei|hey|hallo|pagi|siang|sore|malam|selamat (pagi|siang|sore|malam))(\s+(kirana|semua|juga))?$/.test(t)) return r('greet');
  if (/\b(matikan|nonaktifkan|berhenti|stop|jangan)\b.*\b(mode dengar|dengar|mendengar|mendengarkan|mic|mikrofon)\b/.test(t)) return r('wakeOff');
  if (/\b(nyalakan|aktifkan|hidupkan)\b.*\b(mode dengar|dengar|mendengar|mendengarkan)\b/.test(t)) return r('wakeOn');
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
  const ros = qRos.length ? qRos.filter((x) => regions.includes(x)) : matchRegion(t, regions);
  const ro = ros.length === 1 ? ros[0] : '';
  const target = targetOf(t);
  const near = showing && /\b(sini|situ|ini|itu|tersebut|tadi|nya)\b/.test(t) ? showing : '';
  if (/\b(kembali ke nasional|ke nasional|reset( filter)?|hapus filter|tanpa filter|semua wilayah|nasional saja|nasional aja|lepas filter)\b/.test(t) && !ro && !asking) return r('nasional');
  if (ros.length >= 2 && !time && !specific) return r('compare', { ros: ros.slice(0, 2), metric: target });
  if (BRIEF.test(t) && !ro && !target && !specific && !time) return r('brief');
  if (!ro && !target && !specific && !time && (WORST.test(t) || BEST.test(t)) && (SHOW.test(t) || words <= 4)) return r('rankShow', { order: WORST.test(t) ? 'worst' : 'best' });
  if (OPEN.test(t) && !target && !ro && (showing || near) && !time && !asking) return r('detail', { id: 'os', ro: showing });
  if (target === 'history' && !asking && !specific) return r('detail', { id: target, ro: ro || near });
  if (target && !time && !specific && !asking && (OPEN.test(t) || target === 'watch')) return r('detail', { id: target, ro: ro || near });
  if (target && !time && !specific && !asking && SHOW.test(t) && words <= 9 && !(target === 'os' && ro && !/\b(os|outstanding)\b/.test(t))) return r('detail', { id: target, ro: ro || near });
  if (FILTER.test(t) && !asking && (ro || near)) return r('filter', { ro: ro || near });
  if (ro && !asking && !target && !time && !specific) return r('region', { ro });
  if (ro && SHOW.test(t) && !asking && !time && !specific && (!target || target === 'os')) return r('region', { ro });
  let text = t;
  if (/\b(bandingkan|banding|dibanding|vs)\b/.test(t) && !target && !q?.metric && !ros.length) text = `${t} os`;
  return r('ask', { ro, text });
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
