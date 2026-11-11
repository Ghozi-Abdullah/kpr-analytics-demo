import { ok } from '../core/values.js';
import { rpM, pct, signedPct, num, monthName, listJoin } from './wording.js';

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

const figure = (label, value, sub) => ({ label, value, sub });

function nextText(o, where) {
  const n = o.next;
  const m = monthName(n.month);
  const targetWord = { input: 'target yang Anda isi', rka: 'RKA', estimate: 'perkiraan RKA' }[n.targetSource] || 'perkiraan RKA';
  let lead;
  if (!ok(n.target)) lead = `Laju biasa memberi disburse ${b(rpM(n.baseDisb))} dan OS akhir ${m} ${b(rpM(n.baseOs))}.`;
  else if (n.lift <= 0) lead = `Dengan laju biasa, OS ${where} akhir ${m} diperkirakan ${b(rpM(n.baseOs))}, sudah di atas ${targetWord} ${b(rpM(n.target))}. Disburse ${b(rpM(n.needDisb))} sudah cukup, ${b(pct(-n.lift, 0))} di bawah laju 3 bulan terakhir.`;
  else lead = `Agar OS ${where} akhir ${m} mencapai ${b(rpM(n.target))} (${targetWord}), disburse perlu sekitar ${b(rpM(n.needDisb))}, ${b(pct(n.lift, 0))} di atas laju 3 bulan terakhir (${rpM(n.baseDisb)}).`;
  const figures = [
    figure('Disburse dibutuhkan', ok(n.needDisb) ? rpM(n.needDisb) : '–', `laju biasa ${rpM(n.baseDisb)}`),
    figure('Per hari kerja', ok(n.perWd) ? rpM(n.perWd) : '–', `biasanya ${rpM(n.rate)}, ${num(n.wd)} hari kerja`),
    n.rm ? figure('Per RM', ok(n.perRm) ? rpM(n.perRm) : '–', `biasanya ${rpM(n.prodRm)}, ${num(n.rm)} RM`) : '',
    ok(n.needDeb) ? figure('Debitur baru', `± ${num(Math.round(n.needDeb / 10) * 10)}`, `biasanya ± ${num(Math.round(n.baseDeb / 10) * 10)}, tiket ${rpM(n.ticket / 1e9)}`)
      : figure('Runoff diperkirakan', rpM(n.baseRun), `${pct(o.runRate, 2)} dari OS awal bulan`),
  ];
  const facts = [
    ok(n.perWd) ? `Per hari kerja ${b(rpM(n.perWd))}, biasanya ${rpM(n.rate)} (${num(n.wd)} hari kerja di ${m}).` : '',
    n.rm && ok(n.perRm) ? `Per RM ${b(rpM(n.perRm))}, biasanya ${rpM(n.prodRm)} (${num(n.rm)} RM).` : '',
    ok(n.needDeb) ? `Setara sekitar ${b(num(Math.round(n.needDeb / 10) * 10))} debitur baru dengan tiket rata-rata ${rpM(n.ticket / 1e9)} (biasanya ${num(Math.round(n.baseDeb / 10) * 10)}).` : '',
  ].filter(Boolean);
  const notes = [
    `Laju biasa: OS akhir ${rpM(n.baseOs)}${ok(n.target) ? `, capaian ${pct(n.achBase, 1)}${n.baseOs < n.target ? `, kurang ${rpM(n.target - n.baseOs)}` : ''}` : ''}.`,
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
  return { lead, figures: figures.filter(Boolean), facts, notes, quality };
}

function currentText(o, where) {
  const c = o.current;
  const m = monthName(c.month);
  let lead;
  if (!ok(c.needRem)) lead = `Sisa ${num(c.remWd)} hari kerja ${m}, proyeksi OS akhir bulan ${b(rpM(c.closeOs))}.`;
  else if (c.lift <= 0) lead = `Dengan laju biasa, OS ${where} akhir ${m} sekitar ${b(rpM(c.closeOs))}, sudah di atas RKA ${b(rpM(c.target))}.`;
  else lead = `Agar OS ${where} akhir ${m} sesuai RKA ${b(rpM(c.target))}, sisa ${num(c.remWd)} hari kerja perlu disburse ${b(rpM(c.needRem))}, ${b(pct(c.lift, 0))} di atas laju biasa untuk sisa bulan.`;
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
  return { lead, figures: figures.filter(Boolean), facts, notes, quality };
}

export function moreNames(list, max = 4) {
  return list.length <= max ? listJoin(list) : `${list.slice(0, max).join(', ')}, dan ${list.length - max} RO lain`;
}

export function roRows(o, mode) {
  return (o.regions || []).map((r) => (mode === 'current'
    ? { ro: r.ro, base: r.cur?.remDisb, need: r.cur?.needRem, lift: r.cur?.lift, ach: r.cur?.ach }
    : { ro: r.ro, base: r.baseDisb, need: r.needDisb, lift: r.lift, ach: r.achBase }))
    .filter((r) => ok(r.base)).sort((a, c) => (c.lift ?? -Infinity) - (a.lift ?? -Infinity));
}


export function outlookText(o, mode, where) {
  return mode === 'current' && o.current ? currentText(o, where) : nextText(o, where);
}
