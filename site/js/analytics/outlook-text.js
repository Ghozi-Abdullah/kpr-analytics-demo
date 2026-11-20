import { ok } from '../core/values.js';
import { fmt } from '../core/format.js';
import { rpM, pct, signedPct, num, monthName, listJoin, roName } from './wording.js';

const b = (t) => `<b>${t}</b>`;
export const liftText = (v) => (ok(v) ? signedPct(v, 0) : '–');

export function liftTone(v) {
  if (!ok(v)) return 'neutral';
  if (v <= 0) return 'good';
  if (v <= 0.15) return 'neutral';
  if (v <= 0.4) return 'warn';
  return 'bad';
}

export const LIFT_WORD = { good: 'Laju biasa cukup', neutral: 'Sedikit di atas biasa', warn: 'Perlu dorongan', bad: 'Berat' };

export const TIER = {
  base: { tone: 'good', word: 'Laju biasa cukup', short: 'Laju biasa' },
  stretch: { tone: 'warn', word: 'Butuh dorongan, masih dalam kemampuan', short: 'Dalam kemampuan' },
  beyond: { tone: 'bad', word: 'Di atas kemampuan terbukti', short: 'Di atas kemampuan' },
  none: { tone: 'neutral', word: 'Belum ada target', short: '–' },
};
export const tierOf = (t) => TIER[t] || TIER.none;

const figure = (label, value, sub) => ({ label, value, sub });
const targetWords = { input: 'target yang Anda isi', rka: 'RKA', estimate: 'perkiraan RKA' };

function tierLine(tier, what) {
  if (tier === 'base') return `${what} sudah tercapai dengan laju biasa.`;
  if (tier === 'stretch') return `${what} butuh dorongan, tetapi masih di bawah laju terbaik yang pernah dicapai, jadi ${b('realistis')}.`;
  if (tier === 'beyond') return `${what} ${b('di atas laju terbaik yang pernah dicapai')}, jadi perlu langkah khusus atau target ditinjau.`;
  return '';
}

function nextText(o, where) {
  const n = o.next;
  const m = monthName(n.month);
  const targetWord = targetWords[n.targetSource] || 'perkiraan RKA';
  let lead;
  if (!ok(n.target)) lead = `Laju biasa memberi disburse ${b(rpM(n.baseDisb))} dan OS akhir ${m} ${b(rpM(n.baseOs))}.`;
  else if (n.lift <= 0) lead = `Dengan laju biasa, OS ${where} akhir ${m} diperkirakan ${b(rpM(n.baseOs))}, sudah di atas ${targetWord} ${b(rpM(n.target))}. Disburse ${b(rpM(n.needDisb))} sudah cukup.`;
  else lead = `Agar OS ${where} akhir ${m} mencapai ${b(rpM(n.target))} (${targetWord}), disburse perlu sekitar ${b(rpM(n.needDisb))}, ${b(pct(n.lift, n.lift < 0.1 ? 1 : 0))} di atas laju biasa (${rpM(n.baseDisb)}). ${tierLine(n.tier, 'Target ini')}`;
  const figures = [
    figure('Disburse dibutuhkan', ok(n.needDisb) ? rpM(n.needDisb) : '–', `laju biasa ${rpM(n.baseDisb)}`),
    figure('Laju terbaik', rpM(n.capDisb), `OS akhir ${rpM(n.capOs)}`),
    figure('Per hari kerja', ok(n.perWd) ? rpM(n.perWd) : '–', `biasanya ${rpM(n.rate)}, ${num(n.wd)} hari kerja`),
    ok(n.needDeb) ? figure('Debitur baru', `± ${num(Math.round(n.needDeb / 10) * 10)}`, `biasanya ± ${num(Math.round(n.baseDeb / 10) * 10)}, tiket ${rpM(n.ticket / 1e9)}`)
      : n.rm ? figure('Per RM', ok(n.perRm) ? rpM(n.perRm) : '–', `biasanya ${rpM(n.basePerRm)}, ${num(n.rm)} RM`)
        : figure('Runoff diperkirakan', rpM(n.baseRun), `${pct(o.runRate, 2)} dari OS awal bulan`),
  ];
  const facts = [
    ok(n.perWd) ? `Per hari kerja ${b(rpM(n.perWd))}, biasanya ${rpM(n.rate)} (${num(n.wd)} hari kerja di ${m}).` : '',
    n.rm && ok(n.perRm) ? `Per RM ${b(rpM(n.perRm))}, biasanya ${rpM(n.basePerRm)} (${num(n.rm)} RM).` : '',
    ok(n.needDeb) ? `Setara sekitar ${b(num(Math.round(n.needDeb / 10) * 10))} debitur baru dengan tiket rata-rata ${rpM(n.ticket / 1e9)} (biasanya ${num(Math.round(n.baseDeb / 10) * 10)}).` : '',
    `Laju terbaik 6 bulan terakhir memberi disburse ${rpM(n.capDisb)} dan OS akhir ${rpM(n.capOs)}.`,
  ].filter(Boolean);
  const notes = [
    `Laju biasa: OS akhir ${rpM(n.baseOs)}${ok(n.target) ? `, capaian ${pct(n.achBase, 1)}${n.baseOs < n.target ? `, kurang ${rpM(n.target - n.baseOs)}` : ''}` : ''}. Rentang wajar ${rpM(n.lowOs)} sampai ${rpM(n.capOs)}.`,
  ];
  if (ok(n.liftBest) && o.runBest < o.runRate * 0.97) {
    notes.push(`Bila runoff turun ke level terbaik 6 bulan terakhir (${pct(o.runBest, 2)} dari OS, kini ${pct(o.runRate, 2)}), kenaikan disburse yang dibutuhkan cukup ${b(liftText(n.liftBest))}.`);
  }
  const q = n.npl;
  const quality = [];
  if (ok(q.trend) && ok(q.base)) {
    quality.push(`Tren NPL 3 bulan terakhir ${q.trend >= 0 ? '+' : ''}${rpM(q.trend)} per bulan. Bila berlanjut, NPL akhir ${m} ${b(rpM(q.base))} dengan %NPL ${b(pct(q.ratioBase))} (kini ${pct(q.ratioNow)}).`);
  }
  if (ok(q.ceilTarget) && ok(q.now)) {
    const room = q.ceilTarget - q.now;
    const add = ok(q.trend) ? q.trend * q.months : null;
    if (room <= 0) quality.push(`Agar %NPL tidak melewati sasaran ${pct(q.ratioTarget)} (rasio RKA bulan ini), NPL nominal perlu turun ${b(rpM(-room))} dari posisi sekarang.`);
    else quality.push(`Agar %NPL tidak melewati sasaran ${pct(q.ratioTarget)} (rasio RKA bulan ini), kenaikan NPL nominal sampai akhir ${m} paling banyak ${b(rpM(room))}${ok(add) ? (add >= 0 ? `; bila tren berlanjut, kenaikannya ${rpM(add)}` : `; bila tren berlanjut, NPL justru turun ${rpM(-add)}`) : ''}.`);
    if (ok(add) && add > room) quality.push(`Selisih ${b(rpM(add - Math.max(0, room)))} perlu tertutup lewat penyelesaian NPL (pelunasan, restrukturisasi, atau lelang) agar sasaran rasio terjaga.`);
  }
  return { lead, figures: figures.filter(Boolean), facts, notes, quality, strategy: [] };
}

function currentText(o, where) {
  const c = o.current;
  const m = monthName(c.month);
  let lead;
  if (!ok(c.needRem)) lead = `Sisa ${num(c.remWd)} hari kerja ${m}, proyeksi OS akhir bulan ${b(rpM(c.closeOs))}.`;
  else if (c.lift <= 0) lead = `Dengan laju biasa, OS ${where} akhir ${m} sekitar ${b(rpM(c.closeOs))}, sudah di atas RKA ${b(rpM(c.target))}.`;
  else lead = `Agar OS ${where} akhir ${m} sesuai RKA ${b(rpM(c.target))}, sisa ${num(c.remWd)} hari kerja perlu disburse ${b(rpM(c.needRem))}, ${b(pct(c.lift, c.lift < 0.1 ? 1 : 0))} di atas laju biasa untuk sisa bulan. ${tierLine(c.tier, 'Kebutuhan ini')}`;
  const figures = [
    figure('Disburse dibutuhkan (sisa)', ok(c.needRem) ? rpM(Math.max(0, c.needRem)) : '–', `laju biasa ${rpM(c.remDisb)}`),
    figure('Per hari kerja', ok(c.perWd) ? rpM(Math.max(0, c.perWd)) : '–', `biasanya ${rpM(c.ratePerWd)}`),
    figure('Proyeksi OS akhir bulan', rpM(c.closeOs), `capaian RKA ${pct(c.ach, 1)}`),
    figure('Agar capai guidance', ok(c.needGuid) ? rpM(Math.max(0, c.needGuid)) : '–', ok(c.liftGuid) ? `${liftText(c.liftGuid)} dari laju biasa` : ''),
  ];
  const facts = [
    ok(c.perWd) ? `Per hari kerja ${b(rpM(Math.max(0, c.perWd)))}, biasanya ${rpM(c.ratePerWd)}.` : '',
    `Dengan laju biasa, OS akhir ${m} sekitar ${rpM(c.closeOs)} (capaian RKA ${pct(c.ach, 1)}).`,
    ok(c.needGuid) ? `Agar capai guidance disburse ${rpM(c.guidance)}, sisa bulan perlu ${rpM(Math.max(0, c.needGuid))} (${liftText(c.liftGuid)} dari laju biasa).` : '',
  ].filter(Boolean);
  const notes = [
    `Hari kerja ke-${num(c.wdNow)} dari ${num(c.wdTot)}. Disburse sejak awal bulan ${rpM(c.disb)}, runoff sisa bulan diperkirakan ${rpM(c.remRun)}.`,
  ];
  const quality = [];
  if (ok(c.npl.room)) {
    quality.push(c.npl.room >= 0
      ? `NPL sekarang ${rpM(c.npl.now)}, ruang sampai RKA NPL ${m} tinggal ${b(rpM(c.npl.room))}.`
      : `NPL sekarang ${rpM(c.npl.now)}, sudah ${b(rpM(-c.npl.room))} di atas RKA NPL ${m}.`);
  }
  const trend = o.next.npl.trend;
  if (ok(trend) && ok(c.npl.now) && c.wdTot) {
    const rest = trend * (c.remWd / c.wdTot);
    const end = c.npl.now + rest;
    quality.push(`Tren NPL 3 bulan terakhir ${trend >= 0 ? '+' : ''}${rpM(trend)} per bulan. Bila pola itu berulang di sisa ${m}, NPL akhir bulan sekitar ${b(rpM(end))} dengan %NPL ${b(pct(end / c.closeOs))}${ok(c.npl.target) ? (end > c.npl.target ? `, ${rpM(end - c.npl.target)} di atas RKA NPL` : `, masih ${rpM(c.npl.target - end)} di bawah RKA NPL`) : ''}.`);
  }
  return { lead, figures: figures.filter(Boolean), facts, notes, quality, strategy: [] };
}

const yearTargetWord = (y) => ({
  input: 'target yang Anda isi',
  rka: `RKA Desember ${y.year}`,
  'rka-growth': `tumbuh ${pct(y.growthRef, 1)}, setara RKA ${y.year - 1}`,
  'rka-trend': `tumbuh ${pct(y.growthRef, 1)}, setara laju RKA ${y.year - 1}`,
  trend: `tumbuh ${pct(y.growthRef, 1)}, setara laju tahun ${y.year - 1}`,
}[y.targetSource] || 'target');

export const yearLabel = (y) => (y.months.every((m) => m.startsWith(String(y.year))) && y.planCount < 12 ? `Sisa ${y.year}` : `Tahun ${y.year}`);

function regionLines(o) {
  const y = o.year;
  const rows = (o.regions || []).filter((r) => r.year);
  if (!rows.length) return [];
  const group = (t) => rows.filter((r) => r.year.tier === t).map((r) => roName(r.ro));
  const easy = group('base');
  const fit = group('stretch');
  const hard = group('beyond');
  const lines = [];
  lines.push(`Dengan target pola RKA masing-masing: ${num(easy.length)} RO cukup dengan laju biasa, ${num(fit.length)} RO butuh dorongan tetapi masih dalam kemampuan, ${num(hard.length)} RO di atas kemampuan terbukti${hard.length ? ` (${moreNames(hard)})` : ''}.`);
  const s = y.split;
  if (s && s.gap > 0) {
    const top = s.rows.filter((r) => r.add > 0).slice(0, 3);
    if (top.length) lines.push(`Bila kekurangan nasional ${rpM(s.gap)} dibagi menurut ruang tumbuh tiap RO, porsi terbesar ada di ${listJoin(top.map((r) => `${roName(r.ro)} (${rpM(r.add)})`))}.`);
    if (s.uncovered > 0) lines.push(`Bahkan bila semua RO bekerja di laju terbaiknya, OS nasional masih kurang ${b(rpM(s.uncovered))}. Target perlu ditinjau, atau butuh sumber pertumbuhan baru seperti program atau kanal baru.`);
  } else if (s) {
    lines.push('Target nasional sudah tercapai bila tiap RO menjaga laju biasa.');
  }
  return lines;
}

function phasingLine(y) {
  if (!y.seasonal?.length || y.seasonal.length < 6) return '';
  const lo = y.seasonal.reduce((a, c) => (c.f < a.f ? c : a));
  const hi = y.seasonal.reduce((a, c) => (c.f > a.f ? c : a));
  if (hi.f - lo.f < 0.04) return '';
  return `Pola ${y.year - 1}: ${monthName(lo.month)} biasanya paling pelan dan ${monthName(hi.month)} paling ramai. Target bulanan di tabel sudah mengikuti pola itu.`;
}

function yearText(o, where) {
  const y = o.year;
  const tw = yearTargetWord(y);
  const perMonth = (v) => (ok(v) ? v / y.planCount : null);
  const label = yearLabel(y);
  const baseLine = `Dengan laju biasa, OS ${where} akhir ${y.year} diperkirakan ${b(rpM(y.base.os))}${ok(y.target) ? `, capaian ${pct(y.ach, 1)}` : ''}.`;
  let lead;
  if (!ok(y.target)) lead = baseLine;
  else if (y.lift <= 0) lead = `${baseLine} Itu sudah melewati target ${b(rpM(y.target))} (${tw}).`;
  else lead = `Agar OS ${where} akhir ${y.year} mencapai ${b(rpM(y.target))} (${tw}), disburse ${label.toLowerCase()} perlu sekitar ${b(rpM(y.need.disb))}, rata-rata ${b(rpM(perMonth(y.need.disb)))} per bulan, ${b(pct(y.lift, y.lift < 0.1 ? 1 : 0))} di atas laju biasa. ${tierLine(y.tier, 'Target ini')}`;
  const figures = [
    figure(`Target OS akhir ${y.year}`, ok(y.target) ? rpM(y.target) : '–', ok(y.growth) ? `${signedPct(y.growth, 1)} dari proyeksi akhir ${monthName(y.startMonth)} ${y.startMonth.slice(0, 4)}` : ''),
    figure('Disburse per bulan', ok(y.need?.disb) ? rpM(perMonth(y.need.disb)) : '–', `laju biasa ${rpM(perMonth(y.base.disb))}`),
    figure('Laju terbaik', rpM(y.cap.os), ok(y.achCap) ? `OS akhir ${y.year}, capaian ${pct(y.achCap, 1)}` : `OS akhir ${y.year}`),
    y.rm ? figure('Per RM per bulan', ok(y.perRm) ? rpM(y.perRm) : '–', `biasanya ${rpM(y.basePerRm)}, ${num(y.rm)} RM`) : '',
  ];
  const notes = [
    `Laju biasa: OS akhir ${y.year} ${rpM(y.base.os)}${ok(y.target) ? `, capaian ${pct(y.ach, 1)}${y.base.os < y.target ? `, kurang ${rpM(y.target - y.base.os)}` : ''}` : ''}. Rentang wajar ${rpM(y.low.os)} sampai ${rpM(y.cap.os)}.`,
  ];
  const strategy = [];
  if (ok(y.lift) && y.lift > 0) {
    strategy.push(`${b('Disburse.')} Naikkan disburse rata-rata ke ${rpM(perMonth(y.need.disb))} per bulan, dari laju biasa ${rpM(perMonth(y.base.disb))}. Laju terbaik yang pernah dicapai setara ${b(liftText(y.capLift))} di atas laju biasa.`);
  }
  const phase = phasingLine(y);
  if (phase) strategy.push(`${b('Pola bulanan.')} ${phase}`);
  if (ok(y.liftBest) && ok(y.lift) && y.lift > 0) {
    strategy.push(`${b('Runoff.')} Bila runoff ditekan ke level terbaik 6 bulan terakhir (${pct(y.runBest, 2)} per bulan, kini ${pct(y.runRate, 2)}), kenaikan disburse cukup ${b(liftText(Math.max(0, y.liftBest)))}.`);
  }
  if (ok(y.lift) && y.lift > 0 && ok(y.perRm) && ok(y.rmNeed) && y.rm) {
    strategy.push(`${b('Tenaga RM.')} Dengan ${num(y.rm)} RM, tiap RM perlu ${rpM(y.perRm)} per bulan (biasanya ${rpM(y.basePerRm)}). ${y.rmGap > 0
      ? `Pada produktivitas terbaik yang pernah dicapai, butuh sekitar ${b(`${num(y.rmNeed)} RM`)}, tambah ${num(y.rmGap)}.`
      : 'Pada produktivitas terbaik yang pernah dicapai, jumlah RM sekarang sudah cukup.'}`);
  }
  if (o.national) for (const line of regionLines(o)) strategy.push(`${b('Per RO.')} ${line}`);
  const quality = [];
  if (ok(y.npl.end) && ok(y.npl.now)) {
    quality.push(`Bila tren %NPL 6 bulan terakhir berlanjut (makin lama makin diredam), %NPL akhir ${y.year} sekitar ${b(pct(y.npl.end))} (kini ${pct(y.npl.now)}${ok(y.npl.target) ? `, sasaran rasio RKA ${pct(y.npl.target)}` : ''}).`);
    if (ok(y.npl.target) && y.npl.end > y.npl.target) quality.push(`Agar tetap di bawah ${pct(y.npl.target)}, penyelesaian NPL perlu berjalan seiring kenaikan disburse, karena tambahan debitur baru juga menambah risiko.`);
  }
  return { lead, figures: figures.filter(Boolean), facts: strategy, notes, quality, strategy };
}

export function moreNames(list, max = 4) {
  return list.length <= max ? listJoin(list) : `${list.slice(0, max).join(', ')}, dan ${list.length - max} RO lain`;
}

export function roRows(o, mode) {
  return (o.regions || []).map((r) => {
    if (mode === 'current') return { ro: r.ro, base: r.cur?.remDisb, need: r.cur?.needRem, cap: r.cur?.capRem, lift: r.cur?.lift, ach: r.cur?.ach, tier: r.cur?.tier };
    if (mode === 'year') {
      const y = r.year;
      return { ro: r.ro, base: y ? y.disb / y.planCount : null, need: ok(y?.needDisb) ? y.needDisb / y.planCount : null, cap: y?.cap, lift: y?.lift, ach: ok(y?.target) ? y.base / y.target : null, tier: y?.tier, target: y?.target, os: y?.base };
    }
    return { ro: r.ro, base: r.baseDisb, need: r.needDisb, cap: r.capDisb, lift: r.lift, ach: r.achBase, tier: r.tier };
  }).filter((r) => ok(r.base)).sort((a, c) => (c.lift ?? -Infinity) - (a.lift ?? -Infinity));
}

export function yearTable(o) {
  const y = o.year;
  const need = y.need?.path;
  return y.base.path.map((p, i) => [
    fmt.month(p.month, true), num(p.wd), rpM(p.disb), need ? rpM(need[i].disb) : '–', rpM(y.cap.path[i].disb),
    rpM(p.os), need ? rpM(need[i].os) : '–', p.plan ? '' : 'jembatan',
  ]);
}

export function outlookText(o, mode, where) {
  if (mode === 'year' && o.year) return yearText(o, where);
  return mode === 'current' && o.current ? currentText(o, where) : nextText(o, where);
}
