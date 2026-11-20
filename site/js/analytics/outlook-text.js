import { ok, ratio } from '../core/values.js';
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

function tierLine(tier) {
  if (tier === 'base') return 'Laju biasa sudah cukup.';
  if (tier === 'stretch') return `Butuh dorongan, tetapi masih di bawah laju terbaik yang pernah dicapai, jadi ${b('realistis')}.`;
  if (tier === 'beyond') return `Ini ${b('di atas laju terbaik yang pernah dicapai')}, jadi perlu langkah khusus atau target ditinjau.`;
  return '';
}

const liftWords = (v) => (!ok(v) ? '' : Math.abs(v) < 0.005 ? 'sama dengan laju biasa'
  : v >= 0.95 ? `${num(1 + v, 1)} kali laju biasa`
    : v > 0 ? `${pct(v, v < 0.1 ? 1 : 0)} di atas laju biasa` : `${pct(-v, -v < 0.1 ? 1 : 0)} di bawah laju biasa`);

function nextText(o, where) {
  const n = o.next;
  const m = monthName(n.month);
  const prevM = monthName(o.cur.month);
  let lead;
  if (n.targetSource === 'input') {
    lead = ok(n.needDisb)
      ? `Agar OS ${where} akhir ${m} mencapai ${b(rpM(n.target))} (target yang Anda isi), disburse perlu sekitar ${b(rpM(n.needDisb))}, ${liftWords(n.lift)}. ${tierLine(n.tier)}`
      : `Laju biasa memberi disburse ${b(rpM(n.baseDisb))} dan OS akhir ${m} ${b(rpM(n.baseOs))}.`;
  } else if (!ok(n.growthGoal)) {
    lead = `Laju biasa memberi disburse ${b(rpM(n.baseDisb))} dan OS akhir ${m} ${b(rpM(n.baseOs))}.`;
  } else {
    const from = n.targetSource === 'rka'
      ? `RKA OS naik ${b(rpM(n.growthGoal))} dari ${prevM} ke ${m}.`
      : `RKA ${m} belum ada di data. Bila RKA naik seperti 3 bulan terakhir, kenaikannya ${b(rpM(n.growthGoal))}.`;
    lead = n.growthGoal <= 0
      ? `${from} Laju biasa (disburse ${rpM(n.baseDisb)}) sudah cukup.`
      : `${from} Agar OS ${where} ikut naik sebesar itu, disburse ${m} perlu sekitar ${b(rpM(n.needDisb))}, ${liftWords(n.lift)}. ${tierLine(n.tier)}`;
  }
  const figures = [
    n.targetSource === 'input'
      ? figure('Target OS', rpM(n.target), `kini ${rpM(o.close.os)}`)
      : figure('Target tumbuh (RKA)', ok(n.growthGoal) ? rpM(n.growthGoal) : '–', ok(n.target) ? `RKA ${m} ${rpM(n.target)}` : ''),
    figure('Disburse dibutuhkan', ok(n.needDisb) ? rpM(Math.max(0, n.needDisb)) : '–', `laju biasa ${rpM(n.baseDisb)}`),
    figure('Per hari kerja', ok(n.perWd) ? rpM(Math.max(0, n.perWd)) : '–', `biasanya ${rpM(n.rate)}, ${num(n.wd)} hari kerja`),
    figure('Laju terbaik', rpM(n.capDisb), `disburse ${m} yang pernah dicapai`),
  ];
  const facts = [
    ok(n.perWd) ? `Per hari kerja ${b(rpM(Math.max(0, n.perWd)))}, biasanya ${rpM(n.rate)} (${num(n.wd)} hari kerja di ${m}).` : '',
    n.rm && ok(n.perRm) ? `Per RM ${b(rpM(Math.max(0, n.perRm)))}, biasanya ${rpM(n.basePerRm)} (${num(n.rm)} RM).` : '',
    ok(n.needDeb) ? `Setara sekitar ${b(num(Math.max(0, Math.round(n.needDeb / 10) * 10)))} debitur baru dengan tiket rata-rata ${rpM(n.ticket / 1e9)} (biasanya ${num(Math.round(n.baseDeb / 10) * 10)}).` : '',
  ].filter(Boolean);
  const notes = [
    n.targetSource === 'input'
      ? `Dengan laju biasa, OS akhir ${m} sekitar ${rpM(n.baseOs)} (capaian target ${pct(n.achBase, 1)}).`
      : ok(n.growthGoal) && n.growthGoal > 0
        ? `Dengan laju biasa, OS tumbuh ${rpM(n.growthBase)} di ${m}, ${pct(n.achGrowth, 0)} dari target tumbuh ${rpM(n.growthGoal)}.`
        : `Dengan laju biasa, OS tumbuh ${rpM(n.growthBase)} di ${m}.`,
    `Laju terbaik memberi disburse ${rpM(n.capDisb)} dan OS tumbuh ${rpM(n.capDisb - n.baseRun)}.`,
  ];
  if (ok(n.liftBest) && ok(n.lift) && n.lift > 0 && o.runBest < o.runRate * 0.97) {
    notes.push(`Bila runoff turun ke level terbaik 6 bulan terakhir (${pct(o.runBest, 2)} dari OS, kini ${pct(o.runRate, 2)}), kenaikan disburse cukup ${b(liftText(n.liftBest))}.`);
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
  else if (!ok(c.growthGoal)) lead = `Agar OS ${where} akhir ${m} sesuai RKA ${b(rpM(c.target))}, sisa ${num(c.remWd)} hari kerja perlu disburse ${b(rpM(Math.max(0, c.needRem)))}, ${liftWords(c.lift)}. ${tierLine(c.tier)}`;
  else if (c.grown >= c.growthGoal && c.needRem <= c.remDisb) lead = `Target tumbuh ${m} menurut RKA ${b(rpM(c.growthGoal))} dan OS ${where} sudah tumbuh ${b(rpM(c.grown))}. Laju biasa untuk sisa bulan sudah cukup.`;
  else lead = `Target tumbuh ${m} menurut RKA ${b(rpM(c.growthGoal))}, dan sejak awal bulan OS ${where} ${c.grown >= 0 ? `baru tumbuh ${b(rpM(c.grown))}` : `justru turun ${b(rpM(-c.grown))}`}. Agar tercapai, sisa ${num(c.remWd)} hari kerja perlu disburse ${b(rpM(Math.max(0, c.needRem)))}, ${liftWords(c.lift)}. ${tierLine(c.tier)}`;
  const figures = [
    ok(c.growthGoal) ? figure('Target tumbuh (RKA)', rpM(c.growthGoal), c.grown >= 0 ? `sudah tumbuh ${rpM(c.grown)}` : `OS turun ${rpM(-c.grown)} sejak awal bulan`) : figure('RKA akhir bulan', rpM(c.target), ''),
    figure('Disburse dibutuhkan (sisa)', ok(c.needRem) ? rpM(Math.max(0, c.needRem)) : '–', `laju biasa ${rpM(c.remDisb)}`),
    figure('Proyeksi tumbuh bulan ini', rpM(c.closeOs - c.osStart), ok(c.achGrowth) ? `${pct(c.achGrowth, 0)} dari target, OS akhir ${rpM(c.closeOs)}` : `OS akhir ${rpM(c.closeOs)}`),
    figure('Agar capai guidance', ok(c.needGuid) ? rpM(Math.max(0, c.needGuid)) : '–', ok(c.liftGuid) ? `${liftText(c.liftGuid)} dari laju biasa` : ''),
  ];
  const facts = [
    ok(c.perWd) ? `Per hari kerja ${b(rpM(Math.max(0, c.perWd)))}, biasanya ${rpM(c.ratePerWd)}.` : '',
    `Dengan laju biasa, OS tumbuh ${rpM(c.closeOs - c.osStart)} di ${m}${ok(c.achGrowth) ? ` (${pct(c.achGrowth, 0)} dari target tumbuh)` : ''}.`,
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
  input: 'target simulasi',
  rka: `RKA Desember ${y.year}`,
  'rka-growth': `tumbuh ${pct(y.growthRef, 1)}, setara RKA ${y.year - 1}`,
  'rka-trend': `tumbuh ${pct(y.growthRef, 1)}, setara laju RKA ${y.year - 1}`,
  trend: `tumbuh ${pct(y.growthRef, 1)}, setara laju tahun ${y.year - 1}`,
}[y.targetSource] || 'target');

export const yearLabel = (y) => (y.months.every((m) => m.startsWith(String(y.year))) && y.planCount < 12 ? `Sisa ${y.year}` : `Tahun ${y.year}`);

function regionLines(o) {
  const s = o.year.split;
  if (!s) return [];
  const lines = [];
  if (s.gap <= 0) {
    lines.push('Target nasional sudah tercapai bila tiap RO menjaga laju biasanya, jadi fokusnya menjaga laju di semua RO.');
    return lines;
  }
  const top = s.rows.filter((r) => r.add > 0).slice(0, 3);
  const easy = s.rows.filter((r) => r.tier === 'base').map((r) => roName(r.ro));
  lines.push(`Kekurangan ${rpM(s.gap)} di atas laju biasa dibagi menurut ruang tumbuh tiap RO (laju terbaik dikurangi laju biasa), jadi tiap RO hanya diminta yang pernah sanggup dicapainya.${top.length ? ` Porsi terbesar: ${listJoin(top.map((r) => `${roName(r.ro)} +${rpM(r.add)}`))}.` : ''}${easy.length ? ` ${moreNames(easy)} cukup menjaga laju biasa.` : ''}`);
  if (s.uncovered > 0) lines.push(`Bahkan bila semua RO bekerja di laju terbaiknya, OS nasional masih kurang ${b(rpM(s.uncovered))}. Sisanya perlu sumber pertumbuhan baru (program, kanal, atau kerja sama developer), atau target ditinjau.`);
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
  else lead = `Agar OS ${where} akhir ${y.year} mencapai ${b(rpM(y.target))} (${tw}), disburse ${label.toLowerCase()} perlu sekitar ${b(rpM(y.need.disb))}, rata-rata ${b(rpM(perMonth(y.need.disb)))} per bulan, ${b(pct(y.lift, y.lift < 0.1 ? 1 : 0))} di atas laju biasa. ${tierLine(y.tier)}`;
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
  const grow = ok(y.target) ? y.target - y.startOs : null;
  if (ok(y.lift) && y.lift > 0) {
    strategy.push(`${b('Target bulanan.')} OS perlu tumbuh ${rpM(grow)} sepanjang ${y.year}, rata-rata ${rpM(grow / y.planCount)} per bulan. Untuk itu disburse rata-rata ${b(rpM(perMonth(y.need.disb)))} per bulan, ${liftWords(y.lift)}.`);
  } else if (ok(grow)) {
    strategy.push(`${b('Target bulanan.')} OS perlu tumbuh ${rpM(grow)} sepanjang ${y.year}, rata-rata ${rpM(grow / y.planCount)} per bulan. Laju biasa (disburse ${rpM(perMonth(y.base.disb))} per bulan) sudah cukup, jadi kuncinya menjaga laju tetap stabil.`);
  }
  const phase = phasingLine(y);
  if (phase) strategy.push(`${b('Pola bulanan.')} ${phase}`);
  const lv = y.levers;
  if (lv.runoff > 0) {
    strategy.push(`${b('Tekan runoff.')} Bila runoff turun ke level terbaik 6 bulan terakhir (${pct(y.runBest, 2)} per bulan, kini ${pct(y.runRate, 2)}), OS akhir ${y.year} bertambah sekitar ${b(rpM(lv.runoff))}${ok(y.liftBest) && ok(y.lift) && y.lift > 0 ? ` dan kenaikan disburse yang dibutuhkan tinggal ${liftText(Math.max(0, y.liftBest))}` : ''}. Caranya antara lain menahan pelunasan dipercepat dan take over ke bank lain.`);
  }
  if (lv.disburse > 0) strategy.push(`${b('Jaga disburse di laju terbaik.')} Menambah OS akhir ${y.year} sekitar ${rpM(lv.disburse)}.`);
  if (lv.runoff > 0 && ok(y.target)) {
    strategy.push(`${b('Kombinasi keduanya.')} OS akhir ${y.year} sekitar ${b(rpM(y.combo.os))}, capaian ${pct(y.achCombo, 1)}. ${y.combo.os >= y.target ? 'Target masuk akal bila dua pengungkit ini dijalankan bersama.' : 'Target masih di atas kombinasi terbaik yang pernah dicapai, jadi perlu sumber pertumbuhan baru atau target ditinjau.'}`);
  }
  if (ok(y.lift) && y.lift > 0 && ok(y.perRm) && ok(y.rmNeed) && y.rm) {
    strategy.push(`${b('Tenaga RM.')} Dengan ${num(y.rm)} RM, tiap RM perlu ${rpM(y.perRm)} per bulan (biasanya ${rpM(y.basePerRm)}). ${y.rmGap > 0
      ? `Pada produktivitas terbaik yang pernah dicapai, butuh sekitar ${b(`${num(y.rmNeed)} RM`)}, tambah ${num(y.rmGap)}.`
      : 'Pada produktivitas terbaik yang pernah dicapai, jumlah RM sekarang sudah cukup.'}`);
  }
  if (o.national) for (const line of regionLines(o)) strategy.push(`${b('Pembagian per RO.')} ${line}`);
  const quality = [];
  if (ok(y.npl.end) && ok(y.npl.now)) {
    quality.push(`Bila tren %NPL 6 bulan terakhir berlanjut (makin lama makin diredam), %NPL akhir ${y.year} sekitar ${b(pct(y.npl.end))} (kini ${pct(y.npl.now)}${ok(y.npl.target) ? `, sasaran rasio RKA ${pct(y.npl.target)}` : ''}).`);
    if (ok(y.npl.target) && y.npl.end > y.npl.target) quality.push(`Agar tetap di bawah ${pct(y.npl.target)}, penyelesaian NPL perlu berjalan seiring kenaikan disburse, karena tambahan debitur baru juga menambah risiko.`);
  }
  return { lead, figures: figures.filter(Boolean), facts: strategy, notes, quality, strategy };
}

export function yearLevers(o) {
  const y = o.year;
  const lv = y.levers;
  const rows = [{ label: 'Laju biasa', sub: 'tanpa perubahan', os: y.base.os, add: 0 }];
  if (lv.runoff > 0) rows.push({ label: 'Tekan runoff', sub: `ke ${pct(y.runBest, 2)} per bulan, kini ${pct(y.runRate, 2)}`, os: y.base.os + lv.runoff, add: lv.runoff });
  if (lv.disburse > 0) rows.push({ label: 'Disburse di laju terbaik', sub: y.capFromRegions ? 'tiap RO di laju terbaiknya' : 'bulan terbaik 6 bulan terakhir', os: y.cap.os, add: lv.disburse });
  if (lv.runoff > 0 && lv.disburse > 0) rows.push({ label: 'Kombinasi keduanya', sub: 'runoff ditekan dan disburse terbaik', os: y.combo.os, add: lv.combo });
  return rows.map((r) => ({ ...r, ach: ratio(r.os, y.target) }));
}

export function yearBrief(o) {
  const y = o.year;
  const lines = [];
  const grow = ok(y.target) ? y.target - y.startOs : null;
  if (ok(grow)) {
    lines.push(ok(y.lift) && y.lift > 0
      ? `OS perlu tumbuh ${b(rpM(grow))} (${rpM(grow / y.planCount)} per bulan). Disburse rata-rata ${b(rpM(y.need.disb / y.planCount))} per bulan, ${liftWords(y.lift)}.`
      : `OS perlu tumbuh ${b(rpM(grow))} (${rpM(grow / y.planCount)} per bulan). Laju biasa sudah cukup, kuncinya menjaga laju stabil.`);
  }
  if (ok(y.target) && y.combo.os < y.target && y.levers.combo > 0) lines.push(`Kombinasi terbaik pun belum sampai target, jadi perlu sumber pertumbuhan baru (program, kanal, kerja sama developer) atau target ditinjau.`);
  if (ok(y.lift) && y.lift > 0 && ok(y.rmNeed) && y.rm && y.rmGap > 0) lines.push(`Pada produktivitas RM terbaik, butuh sekitar ${b(`${num(y.rmNeed)} RM`)} (kini ${num(y.rm)}, tambah ${num(y.rmGap)}).`);
  const phase = phasingLine(y);
  if (phase) lines.push(phase);
  return lines;
}

export function moreNames(list, max = 4) {
  return list.length <= max ? listJoin(list) : `${list.slice(0, max).join(', ')}, dan ${list.length - max} RO lain`;
}

export function roRows(o, mode) {
  if (mode === 'year') {
    return (o.year?.split?.rows || []).map((r) => ({
      ro: r.ro, base: r.disbBase / r.planCount, need: r.disb / r.planCount, lift: r.lift, tier: r.tier,
      target: r.os, add: r.add, start: r.startOs, cap: r.cap,
    })).sort((a, c) => c.add - a.add || (c.lift ?? 0) - (a.lift ?? 0));
  }
  return (o.regions || []).map((r) => {
    if (mode === 'current') return { ro: r.ro, base: r.cur?.remDisb, need: r.cur?.needRem, cap: r.cur?.capRem, lift: r.cur?.lift, ach: r.cur?.ach, tier: r.cur?.tier, gap: r.cur?.gap };
    if (mode === 'year') return null;
    return { ro: r.ro, base: r.baseDisb, need: r.needDisb, cap: r.capDisb, lift: r.lift, ach: r.achBase, tier: r.tier, gap: r.gap };
  }).filter((r) => ok(r.base)).sort((a, c) => (c.lift ?? -Infinity) - (a.lift ?? -Infinity));
}

export function yearTable(o) {
  const y = o.year;
  const need = y.need?.path;
  const start = (path, i) => (i ? path[i - 1].os : o.close.os);
  return y.base.path.map((p, i) => [
    fmt.month(p.month, true), num(p.wd), rpM(p.disb), need ? rpM(need[i].disb) : '–',
    need ? rpM(need[i].os - start(need, i)) : '–', rpM(p.os), need ? rpM(need[i].os) : '–', p.plan ? '' : 'sebelum tahun rencana',
  ]);
}

export function yearRoTable(o) {
  return roRows(o, 'year').map((r) => [
    roName(r.ro), rpM(r.start), rpM(r.target), rpM(r.target - r.start), rpM(r.need), liftText(r.lift), tierOf(r.tier).short,
  ]);
}

export function outlookText(o, mode, where) {
  if (mode === 'year' && o.year) return yearText(o, where);
  return mode === 'current' && o.current ? currentText(o, where) : nextText(o, where);
}
