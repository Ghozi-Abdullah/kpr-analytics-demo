import { fmt } from '../core/format.js';
import { ok, ratio } from '../core/values.js';
import { perfPeriods } from '../models/direktur-model.js';
import { tn, signedTn, pct, short, roShort } from '../views/direktur-format.js';
import { streak } from './measures.js';

export const SPANS = [
  { value: '3', label: '3 bulan' },
  { value: '6', label: '6 bulan' },
  { value: '12', label: '12 bulan' },
  { value: 'ytd', label: 'Tahun ini' },
];

export const spanOf = (v) => (String(v) === 'ytd' || (/^\d{1,2}$/.test(String(v)) && Number(v) >= 1 && Number(v) <= 24) ? String(v) : '3');
export const spanTitle = (span, n) => (span === 'ytd' ? `Tahun ${n}` : `${span} bulan terakhir`);

export function spanMonths(pm, span) {
  const cur = pm.months.at(-1);
  if (!cur) return [];
  if (span === 'ytd') return pm.months.filter((m) => m.slice(0, 4) === cur.slice(0, 4));
  return pm.months.slice(-(Number(span) + 1));
}

export function periodRows(pm, ro, span) {
  return perfPeriods(pm, ro, spanMonths(pm, span)).filter((p) => p.end);
}

const pts = (d) => `${fmt.num(Math.abs(d) * 100, 2)} poin`;
const dir = (d, up = 'naik', down = 'turun', flat = 'stabil') => (!ok(d) || Math.abs(d) < 0.00005 ? flat : d > 0 ? up : down);
const monthName = (ym) => fmt.month(ym, true);
const sumOf = (list, f) => list.reduce((s, p) => s + (ok(f(p)) ? f(p) : 0), 0);

export function periodFacts(rows) {
  if (rows.length < 2) return null;
  const first = rows[0];
  const last = rows.at(-1);
  const full = rows.filter((p) => p.full);
  const steps = rows.slice(1).map((p, i) => ({ month: p.month, d: ok(p.os) && ok(rows[i].os) ? p.os - rows[i].os : null, full: p.full })).filter((x) => ok(x.d));
  const stepsFull = steps.filter((x) => x.full);
  const best = [...stepsFull].sort((a, b) => b.d - a.d)[0] || null;
  const worst = [...stepsFull].sort((a, b) => a.d - b.d)[0] || null;
  const dOs = ok(last.os) && ok(first.os) ? last.os - first.os : null;
  const gapStart = ok(first.rkaOs) && ok(first.os) ? first.rkaOs - first.os : null;
  const gapNow = ok(last.rkaOs) && ok(last.os) ? last.rkaOs - last.os : null;
  const npl = rows.map((p) => p.nplPct).filter(ok);
  const sml = rows.map((p) => p.smlPct).filter(ok);
  const disbFull = full.filter((p) => ok(p.disb) && ok(p.guidance) && p.guidance > 0);
  const disbTotal = sumOf(disbFull, (p) => p.disb);
  const guideTotal = sumOf(disbFull, (p) => p.guidance);
  return {
    first, last, months: rows.length - 1, dOs, rel: ratio(dOs, first.os), avg: ok(dOs) ? dOs / (rows.length - 1) : null,
    best, worst, gapStart, gapNow,
    dAch: ok(last.achOs) && ok(first.achOs) ? last.achOs - first.achOs : null,
    dNpl: ok(last.nplPct) && ok(first.nplPct) ? last.nplPct - first.nplPct : null,
    dSml: ok(last.smlPct) && ok(first.smlPct) ? last.smlPct - first.smlPct : null,
    nplRun: streak(npl), smlRun: streak(sml),
    nplOver: rows.filter((p) => ok(p.nplPct) && ok(p.rkaNplPct) && p.nplPct > p.rkaNplPct).length,
    smlOver: rows.filter((p) => ok(p.smlPct) && ok(p.rkaSmlPct) && p.smlPct > p.rkaSmlPct).length,
    dDeb: ok(last.deb) && ok(first.deb) ? last.deb - first.deb : null,
    disbTotal, guideTotal, disbAch: ratio(disbTotal, guideTotal), disbMonths: disbFull.length,
    lowDisb: disbFull.filter((p) => p.achDisb < 0.5).length,
    partial: !last.full,
  };
}

export function periodStory(rows, name) {
  const f = periodFacts(rows);
  if (!f) return null;
  const span = f.months === 1 ? 'sebulan terakhir' : `${f.months} bulan terakhir`;
  const lines = [];
  const notes = [];
  if (ok(f.dOs)) {
    let s = `OS ${name} ${dir(f.dOs, 'tumbuh', 'turun')} ${tn(Math.abs(f.dOs))} (${fmt.signedPct(f.rel, 1)}) dalam ${span}, rata-rata ${signedTn(f.avg)} per bulan.`;
    if (f.best && f.worst && f.best.month !== f.worst.month) s += ` Paling kuat ${short(f.best.month)} (${signedTn(f.best.d)}), paling lemah ${short(f.worst.month)} (${signedTn(f.worst.d)}).`;
    lines.push({ tone: f.dOs >= 0 ? 'good' : 'bad', text: s });
  }
  if (ok(f.gapNow) && ok(f.gapStart)) {
    const widen = f.gapNow - f.gapStart;
    const ach = ok(f.last.achOs) ? pct(f.last.achOs, 1) : '–';
    const s = f.gapNow <= 0
      ? `OS sudah melampaui RKA (capaian ${ach}).`
      : `Capaian RKA OS ${dir(f.dAch, 'naik', 'turun', 'bertahan')} ke ${ach}; selisih ke RKA ${dir(widen, 'melebar', 'menyempit', 'tetap')} dari ${tn(f.gapStart)} menjadi ${tn(f.gapNow)}.`;
    lines.push({ tone: f.gapNow <= 0 ? 'good' : widen > 0 ? 'bad' : 'warn', text: s });
  }
  if (ok(f.dNpl)) {
    const run = f.nplRun.n >= 2 ? `, ${f.nplRun.n} bulan berturut-turut ${f.nplRun.dir > 0 ? 'naik' : 'turun'}` : '';
    const over = f.nplOver ? ` ${f.nplOver} dari ${f.months + 1} bulan di atas RKA.` : ' Selalu di bawah RKA.';
    lines.push({ tone: f.dNpl > 0 || (ok(f.last.rkaNplPct) && f.last.nplPct > f.last.rkaNplPct) ? 'bad' : 'good', text: `%NPL ${dir(f.dNpl)} ${pts(f.dNpl)} ke ${pct(f.last.nplPct)}${run}.${over}` });
  }
  if (ok(f.dSml)) {
    const over = f.smlOver ? ` ${f.smlOver} bulan di atas RKA.` : '';
    lines.push({ tone: f.dSml > 0 ? 'bad' : 'good', text: `%SML ${dir(f.dSml)} ${pts(f.dSml)} ke ${pct(f.last.smlPct)}.${over}` });
  }
  if (f.disbMonths) {
    const low = f.lowDisb ? ` ${f.lowDisb} dari ${f.disbMonths} bulan penuh di bawah 50% guidance.` : '';
    lines.push({ tone: f.disbAch >= 0.9 ? 'good' : f.disbAch >= 0.6 ? 'warn' : 'bad', text: `Disburse bulan penuh ${tn(f.disbTotal)}, atau ${pct(f.disbAch, 1)} dari guidance.${low}` });
  }
  if (f.partial && ok(f.last.progDisb)) notes.push(`${monthName(f.last.month)} masih berjalan, disburse baru ${pct(f.last.progDisb, 1)} dari prognosa.`);
  const nplBad = ok(f.last.nplPct) && ok(f.last.rkaNplPct) && f.last.nplPct > f.last.rkaNplPct;
  let focus = '';
  if (nplBad && f.dNpl > 0) focus = 'Fokus utama ada di kualitas: sepanjang periode ini %NPL naik dan sudah di atas RKA, jadi penagihan perlu didahulukan sebelum mengejar volume.';
  else if (f.disbMonths && f.disbAch < 0.6) focus = `Titik lemah utama di penyaluran: disburse rata-rata ${pct(f.disbAch, 0)} dari guidance, sehingga selisih ke RKA OS sulit tertutup dari pertumbuhan biasa.`;
  else if (ok(f.gapNow) && ok(f.gapStart) && f.gapNow > f.gapStart && f.gapNow > 0) focus = `Selisih ke RKA OS melebar ${tn(f.gapNow - f.gapStart)}; tanpa tambahan disburse, capaian akan terus tergerus.`;
  else if (nplBad) focus = '%NPL masih di atas RKA walau tidak naik sepanjang periode ini; jaga penagihan supaya tidak berbalik.';
  else if (ok(f.dOs) && f.dOs > 0) focus = 'Arah sehat: OS tumbuh dan kualitas terjaga. Pertahankan laju penyaluran.';
  return { facts: f, lines, notes, focus };
}

export function storySpeech(story, { max = 3 } = {}) {
  if (!story) return '';
  return [...story.lines.slice(0, max).map((l) => l.text), story.focus].filter(Boolean).join(' ');
}

export function periodByRo(pm, span) {
  const months = spanMonths(pm, span);
  return pm.regions.map((ro) => {
    const rows = perfPeriods(pm, ro, months).filter((p) => p.end);
    const f = periodFacts(rows);
    return f ? { ro, name: roShort(ro), ...f } : null;
  }).filter(Boolean);
}
