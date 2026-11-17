import { ok, ratio } from '../core/values.js';
import { esc } from '../core/format.js';
import { NASIONAL } from '../models/performance-model.js';
import { realTotals } from '../analytics/measures.js';
import { rpM, rpReal, pct, bpsSigned, num, monthName, monthYear, dateText } from '../analytics/wording.js';
import { GLOSSARY } from './lexicon.js';
import { diffOf } from './parser.js';
import { slaBrief } from './sla-answers.js';

const b = (t) => `<b>${t}</b>`;

function partOfDay() {
  const h = new Date().getHours();
  return h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam';
}

function briefLines(D) {
  const lines = [];
  const nat = D.pm?.byRo.get(NASIONAL)?.at(-1);
  if (nat) {
    const ach = ratio(nat.os, nat.rka_os);
    lines.push(`OS nasional ${b(rpM(nat.os))}${ok(ach) ? `, ${pct(ach, 1)} dari RKA` : ''}.`);
    const npl = ratio(nat.npl, nat.os);
    const start = ratio(nat.helper_npl, nat.helper_os);
    lines.push(`%NPL ${b(pct(npl))}${ok(start) ? ` (${bpsSigned(npl - start)} sejak awal bulan)` : ''}, %SML ${pct(ratio(nat.dpk, nat.os))}.`);
  }
  if (D.real?.rows?.length) {
    const m = D.realLatest.slice(0, 7);
    const t = realTotals(D.real.rows.filter((r) => r.bulan === m));
    lines.push(`Realisasi ${monthName(m)} ${b(rpReal(t.plafond))} dari ${num(t.debitur)} debitur.`);
  }
  const s = slaBrief(D.sla);
  if (s) lines.push(s.line);
  return lines;
}

function memoryFollowups(memory) {
  const label = { os: 'OS', growth: 'growth OS', npl: 'NPL', sml: 'SML', disburse: 'disburse', realisasi: 'realisasi', debitur: 'debitur', ticket: 'plafond rata-rata', runoff: 'runoff' }[memory?.metric];
  if (memory?.domain === 'sla') return ['Kanca dengan berkas lewat SLA terbanyak', 'Kenapa berkas lewat SLA?', 'Tren berkas cair 6 bulan terakhir'];
  if (label) return [`Tren ${label} 6 bulan terakhir`, `RO dengan ${label} tertinggi`, `Kenapa ${label} berubah bulan lalu?`];
  return ['Mana yang perlu perhatian?', 'Ringkasan bulan ini', 'Berapa berkas lewat SLA?'];
}

export function answerTalk(q, D, memory) {
  const kind = q.talk;
  if (kind === 'greet') {
    const said = /^(pagi|siang|sore|malam)\b/.exec(q.normRaw || '')?.[1] || /selamat (pagi|siang|sore|malam)/.exec(q.normRaw || '')?.[1];
    const hello = said ? `Selamat ${said} juga!` : /assalam|asalam/.test(q.normRaw || '') ? "Wa'alaikumsalam!" : `Halo, selamat ${partOfDay()}!`;
    return {
      ok: true, talk: true,
      title: `${hello} Ini gambaran singkat per ${dateText(D.perfLatest || D.realLatest)}:`,
      lines: [...briefLines(D), 'Silakan tanya apa saja soal angka di dashboard ini, misalnya peringkat, tren, penyebab, atau berkas yang perlu dikejar.'],
      followups: ['Mana yang perlu perhatian?', 'Ringkasan bulan ini', 'RO mana NPL tertinggi?', 'Berapa berkas lewat SLA?'],
    };
  }
  if (kind === 'thanks' || kind === 'praise') {
    return {
      ok: true, talk: true,
      title: kind === 'thanks' ? 'Sama-sama. Senang bisa bantu.' : 'Terima kasih. Semua jawaban dihitung langsung dari data dashboard, jadi angkanya sama dengan yang tampil di halaman.',
      lines: [`Kalau mau lanjut, misalnya: ${memoryFollowups(memory).slice(0, 2).map((x) => `"${x}"`).join(' atau ')}.`],
      followups: memoryFollowups(memory),
    };
  }
  if (kind === 'ack') {
    return { ok: true, talk: true, title: 'Siap. Mau lanjut ke mana?', lines: [`Misalnya: ${memoryFollowups(memory).slice(0, 3).map((x) => `"${x}"`).join(', ')}.`], followups: memoryFollowups(memory) };
  }
  if (kind === 'bye') {
    return { ok: true, talk: true, title: 'Sampai jumpa. Percakapan ini tetap tersimpan selama halaman belum dimuat ulang.', lines: [], followups: [] };
  }
  if (kind === 'identity') {
    return {
      ok: true, talk: true,
      title: 'Saya asisten Tanya data di dashboard KPR ini. Saya tidak memakai AI dan tidak terhubung ke internet.',
      lines: [
        'Cara kerjanya: pertanyaan Anda dibaca dengan kamus istilah dan aturan bahasa (termasuk singkatan dan salah ketik umum), lalu angkanya dihitung langsung dari data yang sedang dimuat di browser ini.',
        'Karena itu jawaban selalu sama dengan angka di dashboard, tidak ada data yang dikirim ke pihak lain, dan saya tidak mengarang angka. Kalau datanya tidak ada, saya bilang tidak ada.',
        'Saya bisa menjawab posisi, capaian RKA, peringkat, tren, perbandingan, penyebab perubahan, proyeksi, kebutuhan disburse, wilayah, istilah, dan proses berkas (SLA).',
      ],
      followups: ['Mana yang perlu perhatian?', 'Bisa tanya apa saja?', 'Apa bedanya NPL dan SML?'],
    };
  }
  if (kind === 'fresh') {
    const meta = D.hub?.meta;
    const lines = [];
    if (D.perfLatest) lines.push(`Performance (OS, NPL, SML, disburse): sampai ${b(dateText(D.perfLatest))}.`);
    if (D.realLatest) lines.push(`Realisasi: sampai ${b(dateText(D.realLatest))}.`);
    if (D.pfLatest) lines.push(`Portofolio: bulan ${b(monthYear(D.pfLatest))}.`);
    if (D.sla?.rows?.length) lines.push(`SLA berkas: posisi ${b(dateText(D.sla.snapshot || D.sla.dayMax))}.`);
    if (meta?.generated_at) {
      const t = new Date(meta.generated_at);
      if (!Number.isNaN(t.getTime())) lines.push(`Data diproses ${dateText(meta.generated_at.slice(0, 10))} pukul ${String(t.getHours()).padStart(2, '0')}.${String(t.getMinutes()).padStart(2, '0')}.`);
    }
    return {
      ok: true, talk: true,
      title: `Data terbaru per ${b(dateText(D.perfLatest || D.realLatest))}.`,
      lines,
      meaning: meta?.is_dummy ? 'Ini masih data contoh (dummy), bukan data asli. Angkanya hanya untuk mencoba dashboard.' : '',
      followups: ['Ringkasan bulan ini', 'Mana yang perlu perhatian?'],
    };
  }
  return null;
}

export function answerDiff(q) {
  const [a, c] = q.diff;
  const ga = GLOSSARY.find((g) => g.keys.includes(a));
  const gc = GLOSSARY.find((g) => g.keys.includes(c));
  if (!ga || !gc) return null;
  const d = diffOf(a, c);
  const short = (g) => g.title.split(' (')[0];
  const asks = ['os', 'npl', 'sml', 'disburse', 'realisasi', 'growth', 'runoff', 'lewat sla', 'kepatuhan sla', 'rka', 'guidance', 'prognosa'];
  const follow = [ga, gc].filter((g) => g.keys.some((k) => asks.includes(k))).map((g) => (g.keys.includes('rka') ? 'Capaian RKA OS nasional' : g.keys.includes('guidance') || g.keys.includes('prognosa') ? 'Disburse bulan ini vs guidance' : `${short(g)} nasional berapa?`));
  return {
    ok: true,
    title: `Beda ${b(esc(short(ga)))} dan ${b(esc(short(gc)))}`,
    lines: [d ? d.text : `${esc(short(ga))}: ${ga.text}`, ...(d ? [`${b(esc(short(ga)))}: ${ga.text}`, `${b(esc(short(gc)))}: ${gc.text}`] : [`${esc(short(gc))}: ${gc.text}`])],
    chips: [{ k: 'Sumber', v: 'kamus dashboard' }],
    followups: follow.length ? follow : ['Bisa tanya apa saja?'],
  };
}
