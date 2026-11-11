import { ok, ratio } from '../core/values.js';
import { esc } from '../core/format.js';
import { prevMonth, shiftMonth, daysInMonth } from '../core/dates.js';
import { monthEnds, dayOf } from '../models/performance-model.js';
import { PORTFOLIO_NODES } from '../config.js';
import { filterKeyOf, sumberKey } from '../models/realisasi-sumber.js';
import {
  perfScope, growthEngine, qualityMove, monthEndRatios, streak, paceProjection,
  realLastDay, realFilter, realInMonth, realTotals, realGroup, workdaysOf, pfLabels, pfSums, pfGroup,
} from './measures.js';
import {
  rpM, rpMSigned, rpReal, rpRealSigned, rp, pct, signedPct, bps, bpsSigned, pp, num, signedNum, listJoin, roName,
  monthName, monthYear, dateText, median, sum, REAL_UNIT, PF_UNIT,
} from './wording.js';

export const KINDS = {
  growth: { label: 'Mesin pertumbuhan', icon: 'trend' },
  pace: { label: 'Lintasan target', icon: 'target' },
  projection: { label: 'Proyeksi bulan ini', icon: 'calendar' },
  spread: { label: 'Sebaran kontribusi', icon: 'bars-horizontal' },
  quality: { label: 'Kualitas kredit', icon: 'shield' },
  matrix: { label: 'Pertumbuhan vs kualitas', icon: 'scatter' },
  volume: { label: 'Volume dan tiket', icon: 'users' },
  mix: { label: 'Komposisi produk', icon: 'donut' },
  reliance: { label: 'Ketergantungan', icon: 'team' },
  anomaly: { label: 'Pola tidak biasa', icon: 'alert' },
  hotspot: { label: 'Kantong risiko', icon: 'map' },
  income: { label: 'Profil penghasilan', icon: 'wallet' },
  segment: { label: 'Kualitas per segmen', icon: 'layers' },
  portfolio: { label: 'Pertumbuhan portofolio', icon: 'layers' },
  productivity: { label: 'Produktivitas RM', icon: 'user-check' },
};
export const TONES = { positive: 'Positif', negative: 'Negatif', risk: 'Risiko', neutral: 'Netral' };
const WEIGHT = {
  growth: 1.2, pace: 1.15, projection: 1, spread: 0.9, quality: 1.3, matrix: 1, volume: 1, mix: 0.8,
  reliance: 0.55, anomaly: 1.05, hotspot: 1.1, income: 0.8, segment: 0.9, portfolio: 0.7, productivity: 0.6,
};

const b = (t) => `<b>${t}</b>`;
const nm = (s) => esc(roName(s));
const raw = (s) => esc(s);

function make(o) {
  return {
    confidence: 'tinggi', confidenceNote: '', evidence: [], implication: '', tone: 'neutral', impact: 0, ...o,
    kindLabel: KINDS[o.kind].label, icon: KINDS[o.kind].icon,
  };
}

const moreLess = (d) => (!ok(d) || Math.abs(d) < 0.00005 ? 'sama dengan' : d > 0 ? 'naik dari' : 'turun dari');
const earlyConfidence = (wd) => (ok(wd) && wd < 5 ? { confidence: 'sedang', confidenceNote: `baru ${wd} hari kerja data bulan ini` } : {});
const periodOf = (ps) => (ps.slice.full ? `sepanjang ${monthYear(ps.bulan)}` : 'sejak awal bulan');
const versusOf = (ps) => (ps.slice.full ? `dibanding ${monthName(prevMonth(ps.bulan))}` : 'dibanding periode yang sama bulan lalu');
const changeText = (r, d = 1) => (!ok(r) ? '–' : Math.abs(r) < 0.0005 ? 'relatif sama' : signedPct(r, d));
const moreNames = (list, shown) => (list.length > shown ? `, dan ${list.length - shown} RO lain` : '');

function growthInsight(ps) {
  const g = growthEngine(ps.slice);
  if (!ok(g.dOs) || !ok(g.disb) || !ok(g.osStart)) return null;
  const L = nm(ps.roKey);
  const when = periodOf(ps);
  const vs = versusOf(ps);
  const headline = g.dOs >= 0
    ? `OS ${L} tumbuh ${b(rpM(g.dOs))} ${when} (${signedPct(g.rel, 2)}): disburse ${rpM(g.disb)} dikurangi runoff ${rpM(g.runoff)}.`
    : `OS ${L} turun ${b(rpM(-g.dOs))} ${when}: runoff ${rpM(g.runoff)} lebih besar dari disburse ${rpM(g.disb)}.`;
  const evidence = [];
  if (ok(g.runoffRate) && ok(g.runoffRatePrev)) {
    const dr = g.runoffRate - g.runoffRatePrev;
    evidence.push(`Runoff (angsuran pokok, pelunasan, hapus buku) setara ${b(pct(g.runoffRate))} OS awal bulan${Math.abs(dr) < 0.00005 ? `, sama dengan bulan lalu` : `, ${dr > 0 ? 'naik' : 'turun'} ${bps(dr)} ${vs}`}.`);
  }
  if (ok(g.disbPrev) && g.disbPrev > 0) evidence.push(`Disburse ${changeText(g.disb / g.disbPrev - 1)} ${vs} (${rpM(g.disbPrev)}).`);
  let implication = '';
  let tone = g.dOs >= 0 ? 'neutral' : 'negative';
  let impact = Math.abs(g.dOs) * 0.25;
  if (ok(g.dOsPrev) && ok(g.runoffPrev) && ok(g.disbPrev)) {
    const dd = g.dOs - g.dOsPrev;
    const fromDisb = g.disb - g.disbPrev;
    const fromRunoff = -(g.runoff - g.runoffPrev);
    const material = Math.abs(dd) >= Math.abs(g.osStart) * 0.0002;
    if (material) {
      evidence.push(`Pertumbuhan ${dd >= 0 ? 'lebih tinggi' : 'lebih rendah'} ${b(rpM(Math.abs(dd)))} ${vs}: sisi disburse ${rpMSigned(fromDisb)}, sisi runoff ${rpMSigned(fromRunoff)}.`);
      tone = dd >= 0 ? 'positive' : 'negative';
      impact = Math.max(impact, Math.abs(dd));
      if (dd < 0) {
        implication = fromRunoff < fromDisb
          ? `Perlambatan terutama datang dari runoff yang naik ${rpM(-fromRunoff)}, bukan dari penyaluran. Kenaikan runoff umumnya bersumber dari pelunasan dipercepat atau take over ke bank lain.`
          : `Perlambatan bersumber dari penyaluran yang lebih rendah ${rpM(-fromDisb)}; runoff ${Math.abs(fromRunoff) < Math.abs(fromDisb) * 0.25 ? 'relatif stabil' : fromRunoff > 0 ? 'justru melambat dan menahan penurunan' : 'ikut naik'}.`;
      } else {
        implication = fromDisb >= fromRunoff
          ? `Percepatan ditopang penyaluran yang lebih kuat (${rpMSigned(fromDisb)}).`
          : `Percepatan lebih banyak berasal dari runoff yang melambat (${rpM(fromRunoff)} lebih rendah) daripada dari penyaluran.`;
      }
    } else {
      evidence.push(`Laju pertumbuhan hampir sama ${vs} (selisih ${rpMSigned(dd)}).`);
    }
  }
  return make({
    kind: 'growth', tone, impact, headline, evidence, implication,
    ...earlyConfidence(ps.slice.full ? null : ps.wd), focus: { view: 'performance', widget: 'trend-os', params: ps.slice.full ? { bulan: ps.bulan } : {} },
  });
}

function regionProjection(ps) {
  return ps.regions.map((x) => {
    const p = paceProjection(ps.pm, x.ro, x.slice, 'disburse');
    const g = x.slice.end.guidance_disb;
    return p && ok(g) && g > 0 ? { ro: x.ro, proj: p.proj, guidance: g, ach: p.proj / g } : null;
  }).filter(Boolean);
}

function paceInsights(ps) {
  const out = [];
  const s = ps.slice;
  const e = s.end;
  const L = nm(ps.roKey);
  const guidance = e.guidance_disb;
  if (ok(guidance) && guidance > 0 && ok(e.disburse)) {
    if (s.full) {
      const ach = e.disburse / guidance;
      out.push(make({
        kind: 'pace', tone: ach >= 1 ? 'positive' : ach >= 0.95 ? 'neutral' : 'negative', impact: Math.abs(guidance - e.disburse),
        headline: `Disburse ${L} ${monthYear(ps.bulan)} ditutup ${b(rpM(e.disburse))}, ${b(pct(ach, 1))} dari guidance ${rpM(guidance)}.`,
        evidence: ok(e.prognosa_disb) ? [`Prognosa ${rpM(e.prognosa_disb)}; disburse ${e.disburse >= e.prognosa_disb ? 'di atas' : 'di bawah'} prognosa ${rpM(Math.abs(e.disburse - e.prognosa_disb))}.`] : [],
        focus: { view: 'performance', widget: 'trend-disb' },
      }));
    } else {
      const p = paceProjection(ps.pm, ps.roKey, s, 'disburse');
      if (p && p.wdNow >= 5) {
        const ach = p.proj / guidance;
        const evidence = [
          `Sampai hari kerja ke-${p.wdNow} dari ${p.totalWd}: ${rpM(p.cur)}. Pada ${p.n} bulan sebelumnya, posisi hari kerja yang sama rata-rata baru ${b(pct(p.med, 0))} dari total bulan.`,
          `Rentang proyeksi ${rpM(p.projLo)} sampai ${rpM(p.projHi)}. Proyeksi linear tanpa pola akhir bulan hanya ${rpM(p.linear)}.`,
        ];
        if (ok(e.prognosa_disb)) evidence.push(`Prognosa ${rpM(e.prognosa_disb)}: proyeksi ${p.proj >= e.prognosa_disb ? 'di atas' : 'di bawah'} prognosa ${rpM(Math.abs(p.proj - e.prognosa_disb))}.`);
        if (ps.national) {
          const reg = regionProjection(ps);
          const low = reg.filter((r) => r.ach < 0.9).sort((a, c) => (c.guidance - c.proj) - (a.guidance - a.proj));
          if (low.length) {
            const gap = sum(low.map((r) => r.guidance - r.proj));
            evidence.push(`${low.length} RO diproyeksikan di bawah 90% guidance dengan selisih gabungan ${b(rpM(gap))}; terbesar ${listJoin(low.slice(0, 3).map((r) => `${nm(r.ro)} (kurang ${rpM(r.guidance - r.proj)}, ${pct(r.ach, 0)})`))}.`);
          }
        }
        const implication = p.proj < guidance
          ? `Menutup selisih ${rpM(guidance - p.proj)} ke guidance berarti tambahan sekitar ${b(rpM((guidance - p.proj) / Math.max(1, p.remWd)))} per hari kerja di atas pola normal, pada ${p.remWd} hari kerja tersisa.`
          : `Dengan pola normal, guidance terlampaui sekitar ${rpM(p.proj - guidance)}.`;
        const spread = p.projHi / p.projLo;
        const conf = p.wdNow <= 3
          ? { confidence: 'rendah', confidenceNote: `baru ${p.wdNow} hari kerja, pola awal bulan masih labil` }
          : p.n >= 4 && spread < 1.35 ? { confidence: 'tinggi', confidenceNote: `${p.n} bulan pembanding dengan pola konsisten` }
            : { confidence: 'sedang', confidenceNote: `${p.n} bulan pembanding, rentang lebar` };
        out.push(make({
          kind: 'pace', tone: ach >= 1 ? 'positive' : ach >= 0.95 ? 'neutral' : 'negative', impact: Math.abs(guidance - p.proj),
          headline: `Dengan pola ${p.n} bulan terakhir, disburse ${L} ${monthName(ps.bulan)} diproyeksikan ${b(rpM(p.proj))}, atau ${b(pct(ach, 0))} dari guidance.`,
          evidence, implication, ...conf, focus: { view: 'performance', widget: 'pace' },
        }));
      }
    }
  }
  const rka = e.rka_os;
  const g = growthEngine(s);
  if (ok(rka) && ok(e.os) && s.full) {
    const ach = e.os / rka;
    out.push(make({
      kind: 'pace', tone: ach >= 1 ? 'positive' : ach >= 0.995 ? 'neutral' : 'negative', impact: Math.abs(rka - e.os),
      headline: `OS ${L} ${monthYear(ps.bulan)} ditutup ${b(rpM(e.os))}, ${b(pct(ach, 1))} dari RKA ${rpM(rka)} (${rpMSigned(e.os - rka)}).`,
      evidence: ok(g.dOs) && ok(g.osStart) ? [`Target pertumbuhan bulan itu ${rpM(rka - g.osStart)}; tercapai ${rpM(g.dOs)} (${pct(ratio(g.dOs, rka - g.osStart), 0)}).`] : [],
      focus: { view: 'performance', widget: 'strip', params: { bulan: ps.bulan } },
    }));
  }
  if (ok(rka) && ok(e.os) && ok(g.osStart) && !s.full && ok(ps.wd) && ps.wd >= 5) {
    const need = rka - e.os;
    const p = paceProjection(ps.pm, ps.roKey, s, 'gr_os');
    const remWd = p ? p.remWd : null;
    if (need <= 0) {
      out.push(make({
        kind: 'pace', tone: 'positive', impact: Math.abs(need) * 0.4,
        headline: `OS ${L} sudah ${b(rpM(-need))} di atas RKA ${monthName(ps.bulan)} (${rpM(rka)}).`,
        evidence: [`Capaian RKA OS ${pct(e.os / rka, 1)} per ${dateText(e.tanggal)}.`],
        focus: { view: 'performance', widget: 'strip' },
      }));
    } else if (p && ok(g.dOs)) {
      const projOs = g.osStart + p.proj;
      const evidence = [`Jarak ke RKA saat ini ${rpM(need)}.`];
      if (remWd) evidence.push(`Butuh ${b(rpM(need / remWd))} per hari kerja pada ${remWd} hari kerja tersisa; rata-rata pertumbuhan sejauh ini ${rpM(g.dOs / Math.max(1, p.wdNow))} per hari kerja.`);
      out.push(make({
        kind: 'pace', tone: projOs >= rka ? 'positive' : projOs >= rka - Math.abs(rka - g.osStart) * 0.2 ? 'neutral' : 'negative',
        impact: Math.abs(rka - projOs),
        headline: `OS ${L} diproyeksikan ${b(rpM(projOs))} di akhir bulan, ${b(pct(projOs / rka, 1))} dari RKA ${rpM(rka)}.`,
        evidence,
        implication: projOs >= rka
          ? `Pola pertumbuhan akhir bulan cukup untuk menutup jarak ${rpM(need)} yang tersisa.`
          : `Dengan pola normal, OS akhir bulan masih kurang sekitar ${b(rpM(rka - projOs))} dari RKA.`,
        ...(p.n >= 4 ? {} : { confidence: 'sedang', confidenceNote: `${p.n} bulan pembanding` }),
        focus: { view: 'performance', widget: 'trend-os' },
      }));
    }
  }
  return out;
}

function spreadInsight(ps) {
  if (!ps.national || ps.regions.length < 3) return null;
  const rows = ps.regions.map((x) => ({ ro: x.ro, g: growthEngine(x.slice) })).filter((x) => ok(x.g.dOs));
  const total = sum(rows.map((r) => r.g.dOs));
  const pos = rows.filter((r) => r.g.dOs > 0).sort((a, c) => c.g.dOs - a.g.dOs);
  const neg = rows.filter((r) => r.g.dOs < 0).sort((a, c) => a.g.dOs - c.g.dOs);
  const negSum = sum(neg.map((r) => r.g.dOs));
  const top = pos.slice(0, 3);
  const topSum = sum(top.map((r) => r.g.dOs));
  const names = (list) => listJoin(list.map((r) => `${nm(r.ro)} (${rpMSigned(r.g.dOs)})`));
  const when = periodOf(ps);
  let headline;
  let tone = 'neutral';
  let implication = '';
  const share = total > 0 ? topSum / total : null;
  if (total > 0 && share > 1) {
    headline = `${listJoin(top.map((r) => nm(r.ro)))} tumbuh ${b(rpM(topSum))} ${when}, lebih besar dari pertumbuhan bersih nasional ${rpM(total)}, karena ${neg.length} RO lain turun ${rpM(-negSum)}.`;
    tone = 'risk';
  } else if (total > 0 && share >= 0.5) {
    headline = `Pertumbuhan OS ${when} terkonsentrasi: ${listJoin(top.map((r) => nm(r.ro)))} menyumbang ${b(pct(share, 0))} dari pertumbuhan bersih nasional ${rpM(total)}.`;
    tone = share >= 0.65 ? 'risk' : 'neutral';
  } else if (total > 0) {
    headline = `Pertumbuhan OS ${when} cukup merata: ${pos.length} dari ${rows.length} RO tumbuh, 3 RO teratas menyumbang ${b(pct(share, 0))} dari ${rpM(total)}.`;
    tone = 'positive';
  } else {
    headline = `OS nasional turun ${b(rpM(-total))} ${when}: ${neg.length} RO turun dengan total ${rpM(-negSum)}.`;
    tone = 'negative';
  }
  const evidence = [];
  if (top.length) evidence.push(`Kontributor terbesar: ${names(top)}.`);
  if (neg.length) evidence.push(`Turun: ${names(neg.slice(0, 4))}${moreNames(neg, 4)}.`);
  const byRate = rows.filter((r) => ok(r.g.rel)).sort((a, c) => c.g.rel - a.g.rel);
  if (byRate.length > 2) evidence.push(`Laju tertinggi ${nm(byRate[0].ro)} ${signedPct(byRate[0].g.rel, 2)}, terendah ${nm(byRate.at(-1).ro)} ${signedPct(byRate.at(-1).g.rel, 2)}.`);
  if (top.length && total > 0 && share >= 0.5) {
    implication = `Capaian nasional sensitif terhadap segelintir RO: tanpa ${nm(top[0].ro)}, pertumbuhan bersih nasional tinggal ${rpM(total - top[0].g.dOs)}.`;
  }
  return make({
    kind: 'spread', tone, impact: Math.abs(negSum) + (share && share >= 0.6 ? total * 0.3 : 0), headline, evidence, implication,
    ...earlyConfidence(ps.slice.full ? null : ps.wd), focus: { view: 'performance', widget: 'rank', params: ps.slice.full ? { bulan: ps.bulan } : {} },
  });
}

function qualityInsight(ps) {
  const q = qualityMove(ps.slice, 'npl');
  const qs = qualityMove(ps.slice, 'dpk');
  if (!ok(q.r) || !ok(q.r0) || !ok(q.dv)) return null;
  const L = nm(ps.roKey);
  const when = periodOf(ps);
  let headline;
  if (q.dv > 0 && q.dr < 0) headline = `%NPL ${L} turun ${bps(-q.dr)} ke ${b(pct(q.r))} ${when}, tetapi nominal NPL justru naik ${b(rpM(q.dv))}: penurunan rasio datang dari pertumbuhan OS.`;
  else if (q.dv > 0) headline = `NPL ${L} naik ${b(rpM(q.dv))} ${when}; %NPL ${pct(q.r0)} menjadi ${b(pct(q.r))} (${bpsSigned(q.dr)}).`;
  else headline = `NPL ${L} turun ${b(rpM(-q.dv))} ${when}; %NPL ${b(pct(q.r))} (${bpsSigned(q.dr)}).`;
  const evidence = [];
  if (ok(q.numEffect) && ok(q.denEffect) && Math.abs(q.denEffect) >= 0.00005) {
    evidence.push(`Perubahan %NPL ${bpsSigned(q.dr)} terdiri dari efek nominal NPL ${bpsSigned(q.numEffect)} dan efek pertumbuhan OS ${bpsSigned(q.denEffect)}.`);
  }
  if (ok(q.target)) evidence.push(`Nominal NPL ${q.v > q.target ? 'di atas' : 'di bawah'} RKA ${rpM(q.target)} sebesar ${rpM(Math.abs(q.v - q.target))}.`);
  const sSeries = monthEndRatios(ps.pm, ps.roKey, 'dpk', 4).filter((x) => x.bulan <= ps.bulan);
  const st = streak(sSeries.map((x) => x.r));
  if (ok(qs.r)) evidence.push(`%SML ${pct(qs.r)} (${bpsSigned(qs.dr)} ${when})${st.n >= 2 ? `; pada akhir bulan sudah ${st.dir > 0 ? 'naik' : 'turun'} ${st.n} bulan berturut-turut` : ''}.`);
  const nSeries = monthEndRatios(ps.pm, ps.roKey, 'npl', 3).filter((x) => x.bulan <= ps.bulan);
  if (nSeries.length >= 2) evidence.push(`%NPL akhir bulan: ${nSeries.map((x) => `${monthName(x.bulan)} ${pct(x.r)}`).join(', ')}.`);
  if (ps.national && q.dv > 0) {
    const contrib = ps.regions.map((x) => ({ ro: x.ro, m: qualityMove(x.slice, 'npl') })).filter((x) => ok(x.m.dv) && x.m.dv > 0)
      .sort((a, c) => c.m.dv - a.m.dv);
    const top = contrib.slice(0, 3);
    if (top.length) evidence.push(`Kenaikan terbesar dari ${listJoin(top.map((x) => `${nm(x.ro)} (${rpMSigned(x.m.dv)})`))}, ${pct(sum(top.map((x) => x.m.dv)) / q.dv, 0)} dari kenaikan nasional.`);
  }
  let implication = '';
  if (q.dv > 0 && q.dr < 0 && ok(q.denEffect)) implication = `Jika pertumbuhan OS melambat, rasio NPL akan naik walau kualitas tidak berubah; saat ini rasio terbantu ${bps(-q.denEffect)} oleh pertumbuhan OS.`;
  else if (q.dv > 0 && ok(qs.dv) && qs.dv < 0) implication = `SML turun ${rpM(-qs.dv)} sementara NPL naik ${rpM(q.dv)}: pola ini konsisten dengan debitur SML yang bergeser ke kolektibilitas NPL, bukan perbaikan kualitas.`;
  else if ((ok(qs.dr) && qs.dr > 0.0005) || (st.n >= 2 && st.dir > 0)) implication = 'SML adalah indikator awal NPL: selama tren SML naik, tekanan ke %NPL pada bulan-bulan berikutnya cenderung berlanjut.';
  else if (q.dv < 0) implication = 'Perbaikan terjadi pada nominal NPL, bukan sekadar efek pertumbuhan OS.';
  const tone = q.dv > 0 ? (q.dr > 0.001 ? 'negative' : 'risk') : 'positive';
  return make({
    kind: 'quality', tone, impact: Math.abs(q.dv) * 3 + (ok(qs.dv) && qs.dv > 0 ? qs.dv : 0), headline, evidence, implication,
    ...earlyConfidence(ps.slice.full ? null : ps.wd), focus: { view: 'performance', widget: 'npl', params: ps.slice.full ? { bulan: ps.bulan } : {} },
  });
}

function monthEndRow(pm, ro, bulan) {
  const row = monthEnds(pm, ro).find((x) => x.bulan === bulan)?.row;
  return row && dayOf(row.tanggal) === daysInMonth(bulan) ? row : null;
}

function matrixInsight(ps) {
  if (!ps.national || ps.regions.length < 4) return null;
  const back = shiftMonth(ps.bulan, -3);
  const rows = ps.regions.map((x) => {
    const old = monthEndRow(ps.pm, x.ro, back);
    const e = x.slice.end;
    const r = ratio(e.npl, e.os);
    const r3 = old ? ratio(old.npl, old.os) : null;
    return {
      ro: x.ro, os: e.os, r, g: old && ok(old.os) && old.os ? e.os / old.os - 1 : null,
      dq: ok(r) && ok(r3) ? r - r3 : null, dn: old && ok(old.npl) && ok(e.npl) ? e.npl - old.npl : null,
    };
  }).filter((x) => ok(x.g) && ok(x.dq));
  if (rows.length < 4) return null;
  const medG = median(rows.map((x) => x.g));
  const risky = rows.filter((x) => x.g >= medG && x.dq >= 0.0005).sort((a, c) => c.dq - a.dq);
  const stressed = rows.filter((x) => x.g < 0 && x.dq >= 0.0005).sort((a, c) => c.dq - a.dq);
  const healthy = rows.filter((x) => x.g >= medG && x.dq <= 0).sort((a, c) => c.g - a.g);
  const totalOs = sum(rows.map((x) => x.os));
  const span = `${monthName(back)} sampai ${ps.slice.full ? monthName(ps.bulan) : dateText(ps.date)}`;
  const line = (x) => `${nm(x.ro)}: OS ${signedPct(x.g, 1)}, %NPL ${bpsSigned(x.dq)} (kini ${pct(x.r)})`;
  const evidence = [];
  let headline;
  let tone = 'risk';
  let implication = '';
  if (risky.length) {
    headline = `${b(`${risky.length} RO`)} tumbuh di atas median sambil %NPL naik dalam 3 bulan: ${listJoin(risky.slice(0, 4).map((x) => nm(x.ro)))}${moreNames(risky, 4)}.`;
    evidence.push(...risky.slice(0, 3).map((x) => `${line(x)}.`));
    implication = `Kelompok ini memegang ${pct(sum(risky.map((x) => x.os)) / totalOs, 1)} OS nasional; pertumbuhan baru di sana menambah eksposur pada wilayah yang kualitasnya sedang memburuk.`;
  } else if (stressed.length) {
    headline = `${b(`${stressed.length} RO`)} mengalami OS turun dan %NPL naik bersamaan dalam 3 bulan: ${listJoin(stressed.slice(0, 4).map((x) => nm(x.ro)))}${moreNames(stressed, 4)}.`;
    tone = 'negative';
  } else if (healthy.length) {
    headline = `${b(`${healthy.length} RO`)} tumbuh di atas median dengan %NPL stabil atau turun dalam 3 bulan: ${listJoin(healthy.slice(0, 4).map((x) => nm(x.ro)))}${moreNames(healthy, 4)}.`;
    tone = 'positive';
  } else return null;
  if (stressed.length && risky.length) evidence.push(`OS turun dan %NPL naik: ${listJoin(stressed.slice(0, 3).map((x) => `${nm(x.ro)} (${bpsSigned(x.dq)})`))}.`);
  if (healthy.length && (risky.length || stressed.length)) evidence.push(`Tumbuh sehat: ${listJoin(healthy.slice(0, 3).map((x) => `${nm(x.ro)} (${signedPct(x.g, 1)})`))}.`);
  evidence.push(`Periode ${span}; median pertumbuhan OS antar RO ${signedPct(medG, 1)}.`);
  const impact = sum([...risky, ...stressed].map((x) => (ok(x.dn) && x.dn > 0 ? x.dn : 0))) * 2 + (tone === 'positive' ? 10 : 0);
  return make({ kind: 'matrix', tone, impact, headline, evidence, implication, focus: { view: 'performance', widget: 'map' } });
}

function productivityInsight(ps) {
  const e = ps.slice.end;
  const g = growthEngine(ps.slice);
  if (!ok(e.prod_rm) || !ok(e.prod_rm_lalu) || e.prod_rm_lalu <= 0) return null;
  const ch = e.prod_rm / e.prod_rm_lalu - 1;
  const dRm = ok(e.jum_rm) && ok(e.jum_rm_lalu) ? e.jum_rm - e.jum_rm_lalu : null;
  if (Math.abs(ch) < 0.05 && !dRm) return null;
  const L = nm(ps.roKey);
  const evidence = [];
  if (ok(dRm)) evidence.push(`Jumlah RM ${num(e.jum_rm)} (${signedNum(dRm)} dari bulan lalu); disburse ${ok(g.disbPrev) && g.disbPrev ? signedPct(g.disb / g.disbPrev - 1) : '–'} dibanding periode yang sama.`);
  let implication = '';
  if (ok(dRm) && dRm > 0 && ch < 0) implication = `Penambahan ${num(dRm)} RM belum diikuti kenaikan penyaluran yang sebanding; produktivitas turun karena penyebut naik lebih cepat dari penyaluran.`;
  else if (ok(dRm) && dRm < 0 && ch > 0) implication = 'Produktivitas naik sebagian karena jumlah RM berkurang, bukan semata karena penyaluran meningkat.';
  return make({
    kind: 'productivity', tone: ch >= 0 ? 'positive' : 'negative', impact: Math.abs(e.prod_rm - e.prod_rm_lalu) * (e.jum_rm || 1) * 0.5,
    headline: `Disburse per RM ${L} ${b(rpM(e.prod_rm))} sampai hari kerja ke-${num(e.hari_kerja)}, ${b(signedPct(ch))} dibanding periode yang sama bulan lalu.`,
    evidence, implication, ...earlyConfidence(ps.wd), focus: { view: 'performance', widget: 'prod-rm' },
  });
}

function realScope(real, scope) {
  if (!real?.rows?.length) return null;
  const bulan = real.months.includes(scope.bulan) ? scope.bulan : real.months.at(-1);
  const lastDay = realLastDay(real, bulan);
  const tipeKey = ['5', '6', '7'].includes(scope.sumber) ? sumberKey(scope.sumber) : filterKeyOf(real, scope.tipe);
  const filter = { ro: scope.ro || null, kanca: scope.kanca || null, rm: scope.rm || null, [tipeKey]: scope.tipe || null };
  const base = realFilter(real.rows, filter);
  const label = [scope.rm, scope.kanca, scope.ro ? roName(scope.ro) : '', scope.tipe].filter(Boolean)[0] || 'Nasional';
  return {
    real, bulan, lastDay, base, filter, label: raw(label), full: lastDay === daysInMonth(bulan), prev: prevMonth(bulan),
    ro: scope.ro || '', kanca: scope.kanca || '', rm: scope.rm || '', tipe: scope.tipe || '', tipeKey,
  };
}

function volumeInsight(rs) {
  const cur = realTotals(realInMonth(rs.base, rs.bulan, rs.lastDay));
  const prev = realTotals(realInMonth(rs.base, rs.prev, rs.lastDay));
  if (!(prev.plafond > 0) || !(cur.debitur > 0) || !(prev.debitur > 0)) return null;
  const dP = cur.plafond - prev.plafond;
  const volEff = (cur.debitur - prev.debitur) * prev.ticket;
  const tickEff = cur.debitur * (cur.ticket - prev.ticket);
  const period = rs.full ? monthYear(rs.bulan) : `${monthName(rs.bulan)} s.d. tanggal ${rs.lastDay}`;
  const vs = rs.full ? `dibanding ${monthName(rs.prev)}` : `dibanding periode yang sama ${monthName(rs.prev)}`;
  const k = workdaysOf(rs.bulan, rs.lastDay).length;
  const evidence = [
    `Jumlah debitur ${num(cur.debitur)} (${signedPct(cur.debitur / prev.debitur - 1)}), plafond rata-rata ${rpReal(cur.ticket)} (${signedPct(cur.ticket / prev.ticket - 1)}).`,
    `Selisih ${rpRealSigned(dP)} terdiri dari efek jumlah debitur ${b(rpRealSigned(volEff))} dan efek plafond rata-rata ${b(rpRealSigned(tickEff))}.`,
  ];
  const implication = Math.abs(volEff) >= Math.abs(tickEff)
    ? `Perubahan didominasi jumlah akad, bukan nilai per akad.`
    : `Perubahan didominasi nilai per akad: plafond rata-rata ${cur.ticket >= prev.ticket ? 'naik' : 'turun'}, sementara jumlah akad relatif ${Math.abs(cur.debitur / prev.debitur - 1) < 0.05 ? 'stabil' : cur.debitur > prev.debitur ? 'bertambah' : 'berkurang'}.`;
  return make({
    kind: 'volume', tone: dP >= 0 ? 'positive' : 'negative', impact: Math.abs(dP) * REAL_UNIT / 1e9,
    headline: `Realisasi ${rs.label} ${period}: ${b(rpReal(cur.plafond))}, ${b(signedPct(cur.plafond / prev.plafond - 1))} ${vs}.`,
    evidence, implication, ...(!rs.full && k < 5 ? { confidence: 'sedang', confidenceNote: `baru ${k} hari kerja, ${num(cur.debitur)} debitur` } : {}),
    focus: { view: 'realisasi', widget: 'summary', params: rs.full ? { bulan: rs.bulan } : {} },
  });
}

function cumulativeShares(rows, bulan, k) {
  const days = workdaysOf(bulan);
  if (days.length < k) return null;
  const cut = days[k - 1];
  let atK = 0;
  let total = 0;
  for (const r of rows) {
    if (r.bulan !== bulan) continue;
    const v = ok(r.plafond) ? r.plafond : 0;
    total += v;
    if (r.hari <= cut) atK += v;
  }
  return total > 0 ? { share: atK / total, total, tail: (() => {
    const last5 = days.slice(-5)[0];
    let t = 0;
    for (const r of rows) if (r.bulan === bulan && r.hari >= last5) t += ok(r.plafond) ? r.plafond : 0;
    return t / total;
  })() } : null;
}

function realProjectionInsight(rs) {
  if (rs.full) return null;
  const k = workdaysOf(rs.bulan, rs.lastDay).length;
  if (k < 5) return null;
  const cur = realTotals(realInMonth(rs.base, rs.bulan, rs.lastDay)).plafond;
  if (!(cur > 0)) return null;
  const hist = [];
  for (let i = 1; i <= 6; i += 1) {
    const m = shiftMonth(rs.bulan, -i);
    if (!rs.real.months.includes(m)) continue;
    const c = cumulativeShares(rs.base, m, k);
    if (c && c.share > 0) hist.push({ m, ...c });
  }
  if (hist.length < 2) return null;
  const med = median(hist.map((h) => h.share));
  const proj = cur / med;
  const prevFull = hist.find((h) => h.m === rs.prev)?.total;
  const lo = cur / Math.max(...hist.map((h) => h.share));
  const hi = cur / Math.min(...hist.map((h) => h.share));
  const tail = median(hist.map((h) => h.tail));
  const evidence = [
    `Sampai hari kerja ke-${k}: ${rpReal(cur)}. Pada ${hist.length} bulan sebelumnya, posisi yang sama rata-rata baru ${b(pct(med, 0))} dari total bulan.`,
    `Rentang proyeksi ${rpReal(lo)} sampai ${rpReal(hi)}.`,
  ];
  if (ok(tail)) evidence.push(`Rata-rata ${b(pct(tail, 0))} realisasi bulanan terjadi pada 5 hari kerja terakhir, sehingga angka awal bulan selalu tampak rendah.`);
  return make({
    kind: 'projection', tone: prevFull ? (proj >= prevFull ? 'positive' : proj >= prevFull * 0.95 ? 'neutral' : 'negative') : 'neutral',
    impact: prevFull ? Math.abs(proj - prevFull) * REAL_UNIT / 1e9 : cur * REAL_UNIT / 1e10,
    headline: `Realisasi ${rs.label} ${monthName(rs.bulan)} diproyeksikan ${b(rpReal(proj))}${prevFull ? `, ${b(signedPct(proj / prevFull - 1))} dibanding ${monthName(rs.prev)} penuh (${rpReal(prevFull)})` : ''}.`,
    evidence,
    ...(k <= 3 ? { confidence: 'rendah', confidenceNote: `baru ${k} hari kerja` } : hist.length < 4 ? { confidence: 'sedang', confidenceNote: `${hist.length} bulan pembanding` } : {}),
    focus: { view: 'realisasi', widget: 'cum-grid' },
  });
}

function mixInsight(rs) {
  if (rs.tipe) return null;
  const cur = realGroup(realInMonth(rs.base, rs.bulan, rs.lastDay), rs.tipeKey);
  const prevMonths = [1, 2, 3].map((i) => shiftMonth(rs.bulan, -i)).filter((m) => rs.real.months.includes(m));
  if (!prevMonths.length || cur.size < 2) return null;
  const old = realGroup(rs.base.filter((r) => prevMonths.includes(r.bulan)), rs.tipeKey);
  const totC = sum([...cur.values()].map((g) => g.plafond));
  const totO = sum([...old.values()].map((g) => g.plafond));
  const debC = sum([...cur.values()].map((g) => g.debitur));
  const debO = sum([...old.values()].map((g) => g.debitur));
  if (!(totC > 0) || !(totO > 0) || !(debC > 0) || !(debO > 0)) return null;
  const types = [...new Set([...cur.keys(), ...old.keys()])];
  const rows = types.map((t) => {
    const c = cur.get(t) || { plafond: 0, debitur: 0 };
    const o = old.get(t) || { plafond: 0, debitur: 0 };
    return {
      t, sNow: c.plafond / totC, sOld: o.plafond / totO, cNow: c.debitur / debC, cOld: o.debitur / debO, ticketOld: ratio(o.plafond, o.debitur),
    };
  }).map((x) => ({ ...x, d: x.sNow - x.sOld }));
  rows.sort((a, c) => c.d - a.d);
  const up = rows[0];
  const down = rows.at(-1);
  if (Math.abs(up.d) < 0.02 && Math.abs(down.d) < 0.02) return null;
  const mixEffect = sum(rows.map((x) => (ok(x.ticketOld) ? (x.cNow - x.cOld) * x.ticketOld : 0)));
  const evidence = [
    `Porsi ${raw(down.t)} ${pct(down.sNow, 1)} (rata-rata 3 bulan ${pct(down.sOld, 1)}, ${pp(down.d)}).`,
    `Pergeseran komposisi ini sendiri mengubah plafond rata-rata ${b(rpRealSigned(mixEffect))} per debitur.`,
  ];
  const second = rows[1];
  if (second && second.d >= 0.01) evidence.unshift(`Porsi ${raw(second.t)} juga naik ke ${pct(second.sNow, 1)} (${pp(second.d)}).`);
  return make({
    kind: 'mix', tone: 'neutral', impact: Math.abs(mixEffect) * debC * REAL_UNIT / 1e9 + Math.abs(up.d) * totC * REAL_UNIT / 1e9 * 0.3,
    headline: `Komposisi realisasi ${rs.label} bergeser ke ${b(raw(up.t))}: porsinya ${b(pct(up.sNow, 1))} ${rs.full ? `pada ${monthName(rs.bulan)}` : 'bulan ini'}, dibanding rata-rata 3 bulan sebelumnya ${pct(up.sOld, 1)}.`,
    evidence,
    implication: mixEffect < 0
      ? 'Pergeseran ke sumber dengan plafond lebih kecil menekan nilai realisasi walau jumlah akad tidak berubah.'
      : 'Pergeseran ke sumber dengan plafond lebih besar mengangkat nilai realisasi walau jumlah akad tidak berubah.',
    focus: { view: 'realisasi', widget: 'hero', params: rs.full ? { bulan: rs.bulan } : {} },
  });
}

function relianceInsight(rs) {
  if (rs.rm) return null;
  const curRows = realInMonth(rs.base, rs.bulan, rs.lastDay);
  const byRm = [...realGroup(curRows, 'rm').values()].map((g) => g.plafond).filter((v) => v > 0).sort((a, c) => c - a);
  if (byRm.length < 10) return null;
  const total = sum(byRm);
  const nTop = Math.max(1, Math.round(byRm.length * 0.1));
  const topShare = sum(byRm.slice(0, nTop)) / total;
  const recent = [1, 2, 3].map((i) => shiftMonth(rs.bulan, -i));
  const known = new Set(rs.base.filter((r) => recent.includes(r.bulan) && r.plafond > 0).map((r) => r.rm));
  const activeNow = new Set(curRows.filter((r) => r.plafond > 0).map((r) => r.rm));
  const idle = [...known].filter((x) => !activeNow.has(x)).length;
  const prevRecent = [2, 3, 4].map((i) => shiftMonth(rs.bulan, -i));
  const knownPrev = new Set(rs.base.filter((r) => prevRecent.includes(r.bulan) && r.plafond > 0).map((r) => r.rm));
  const activePrev = new Set(realInMonth(rs.base, rs.prev, rs.lastDay).filter((r) => r.plafond > 0).map((r) => r.rm));
  const idlePrev = [...knownPrev].filter((x) => !activePrev.has(x)).length;
  const evidence = [];
  if (known.size) {
    evidence.push(`${b(`${num(idle)} dari ${num(known.size)} RM`)} yang aktif dalam 3 bulan sebelumnya ${rs.full ? `tidak mencatat realisasi sepanjang ${monthName(rs.bulan)}` : 'belum mencatat realisasi bulan ini'} (${pct(idle / known.size, 0)}); ${rs.full ? `pada ${monthName(rs.prev)}` : 'pada periode yang sama bulan lalu'} ${knownPrev.size ? pct(idlePrev / knownPrev.size, 0) : '–'}.`);
  }
  if (!rs.kanca) {
    const byK = [...realGroup(curRows, 'kanca').values()].map((g) => g.plafond).filter((v) => v > 0);
    const tk = sum(byK);
    if (byK.length > 4 && tk > 0) {
      const hhi = sum(byK.map((v) => (v / tk) ** 2));
      evidence.push(`Sebaran per kanca setara ${b(`${num(1 / hhi)} kanca`)} dengan porsi sama, dari ${num(byK.length)} kanca yang menyalurkan.`);
    }
  }
  return make({
    kind: 'reliance', tone: topShare >= 0.35 ? 'risk' : 'neutral', impact: total * REAL_UNIT / 1e9 * topShare * 0.08,
    headline: `${b(pct(topShare, 0))} realisasi ${rs.label} ${rs.full ? `sepanjang ${monthName(rs.bulan)}` : 'bulan ini'} datang dari 10% RM teratas (${num(nTop)} dari ${num(byRm.length)} RM aktif).`,
    evidence,
    implication: topShare >= 0.35 ? 'Ketergantungan pada sedikit RM membuat realisasi rentan terhadap rotasi, cuti, atau perpindahan segelintir orang.' : '',
    focus: { view: 'realisasi', widget: 'rm', params: rs.full ? { bulan: rs.bulan } : {} },
  });
}

function anomalyInsight(rs) {
  if (rs.kanca || rs.rm) return null;
  const dim = rs.ro ? 'kanca' : 'ro';
  const days = workdaysOf(rs.bulan, rs.lastDay);
  const k = days.length;
  if (k < 3) return null;
  const W = Math.min(5, k);
  const from = days[k - W];
  const to = days[k - 1];
  const prevMonths = [1, 2, 3, 4, 5, 6].map((i) => shiftMonth(rs.bulan, -i)).filter((m) => rs.real.months.includes(m));
  if (prevMonths.length < 3) return null;
  const windows = new Map(prevMonths.map((m) => {
    const d = workdaysOf(m);
    return [m, d.length >= k ? [d[k - W], d[k - 1]] : null];
  }));
  const stats = new Map();
  for (const r of rs.base) {
    const key = r[dim];
    if (!key) continue;
    let s = stats.get(key);
    if (!s) { s = { now: 0, hist: new Map(), month: 0 }; stats.set(key, s); }
    const v = ok(r.plafond) ? r.plafond : 0;
    if (r.bulan === rs.bulan && r.hari >= from && r.hari <= to) s.now += v;
    const w = windows.get(r.bulan);
    if (w && r.hari >= w[0] && r.hari <= w[1]) s.hist.set(r.bulan, (s.hist.get(r.bulan) || 0) + v);
    if (windows.has(r.bulan)) s.month += v;
  }
  const flagged = [];
  for (const [key, s] of stats) {
    const hist = [...windows.keys()].filter((m) => windows.get(m)).map((m) => s.hist.get(m) || 0);
    if (hist.length < 3) continue;
    const med = median(hist);
    const monthlyAvg = s.month / prevMonths.length;
    if (!(med > 0) || !(monthlyAvg > 0)) continue;
    const r = s.now / med;
    const diff = s.now - med;
    if ((r <= 0.6 || r >= 1.7) && Math.abs(diff) >= monthlyAvg * 0.08) {
      flagged.push({ key, now: s.now, med, r, diff, min: Math.min(...hist), max: Math.max(...hist), n: hist.length });
    }
  }
  if (!flagged.length) return null;
  flagged.sort((a, c) => Math.abs(c.diff) - Math.abs(a.diff));
  const f = flagged[0];
  const who = dim === 'ro' ? nm(f.key) : raw(f.key);
  const drop = f.r < 1;
  const evidence = [`Pembanding: ${f.n} bulan, posisi hari kerja yang sama. Terendah ${rpReal(f.min)}, tertinggi ${rpReal(f.max)}.`];
  const others = flagged.slice(1, 4).map((x) => `${dim === 'ro' ? nm(x.key) : raw(x.key)} (${x.r < 1 ? '−' : '+'}${pct(Math.abs(1 - x.r), 0)})`);
  if (others.length) evidence.push(`Pola serupa: ${listJoin(others)}.`);
  const outside = drop ? f.now < f.min : f.now > f.max;
  return make({
    kind: 'anomaly', tone: drop ? 'negative' : 'positive', impact: Math.abs(f.diff) * REAL_UNIT / 1e9 * 1.5,
    headline: `Realisasi ${who} pada ${W} hari kerja terakhir ${b(rpReal(f.now))}, ${b(pct(Math.abs(1 - f.r), 0))} ${drop ? 'di bawah' : 'di atas'} pola hari kerja yang sama (median ${rpReal(f.med)}).`,
    evidence,
    implication: outside
      ? `Angka ini berada di luar rentang semua bulan pembanding, sehingga sulit dijelaskan sebagai variasi biasa.`
      : `Masih di dalam rentang bulan pembanding, tetapi jauh dari pola tengahnya.`,
    focus: { view: 'realisasi', widget: dim === 'ro' ? 'ro' : 'kanca', params: dim === 'ro' ? { ro: f.key } : { kanca: f.key } },
  });
}

function pfScope(pf, scope) {
  if (!pf?.index?.months?.length) return null;
  const bulan = pf.index.months.includes(scope.bulan) ? scope.bulan : pf.index.months.at(-1);
  const rows = (pf.monthData.get(bulan) || []).filter((r) => r.m === 'os');
  if (!rows.length) return null;
  const L = pfLabels(pf, 'os');
  const inScope = rows.filter((r) => (!scope.ro || r.ro === scope.ro) && (!scope.kanca || r.kanca === scope.kanca));
  const label = scope.kanca ? raw(scope.kanca) : scope.ro ? nm(scope.ro) : 'Nasional';
  return { pf, bulan, rows, inScope, L, label, ro: scope.ro || '', kanca: scope.kanca || '' };
}

function hotspotInsight(fs) {
  if (fs.kanca) return null;
  const all = pfSums(fs.inScope, fs.L);
  if (!(all.base > 0) || !ok(all.nplR)) return null;
  const groups = [...pfGroup(fs.inScope, fs.L, 'kanca')].map(([k, s]) => ({ k, ...s })).filter((x) => x.base > 0);
  if (groups.length < 6) return null;
  const minOs = all.base * 0.0025;
  const hot = groups.filter((x) => ok(x.nplR) && x.nplR >= all.nplR * 1.5 && x.base >= minOs).sort((a, c) => (c.npl - c.base * all.nplR) - (a.npl - a.base * all.nplR));
  if (!hot.length) return null;
  const osShare = sum(hot.map((x) => x.base)) / all.base;
  const nplShare = sum(hot.map((x) => x.npl)) / all.npl;
  const excess = sum(hot.map((x) => x.npl - x.base * all.nplR));
  return make({
    kind: 'hotspot', tone: 'risk', impact: (excess * PF_UNIT) / 1e9 * 2,
    headline: `${b(`${hot.length} kanca`)} dengan %NPL di atas 1,5 kali rata-rata ${fs.label} memegang ${pct(osShare, 1)} OS tetapi ${b(pct(nplShare, 1))} NPL.`,
    evidence: [
      `Tertinggi: ${listJoin(hot.slice(0, 3).map((x) => `${raw(x.k)} ${pct(x.nplR)} (OS ${rp(x.base * PF_UNIT)})`))}.`,
      `Rata-rata %NPL ${fs.label} ${pct(all.nplR)} per ${monthYear(fs.bulan)}; hanya kanca dengan OS di atas ${rp(minOs * PF_UNIT)} yang dihitung.`,
    ],
    implication: `Jika kelompok ini memiliki %NPL setara rata-rata, NPL ${fs.label} lebih rendah ${b(rp(excess * PF_UNIT))} atau ${bps(excess / all.base)}.`,
    focus: { view: 'portofolio', widget: 'top-npl' },
  });
}

function incomeInsight(fs) {
  const s = pfSums(fs.inScope, fs.L);
  if (!ok(s.nplFiR) || !ok(s.nplNfiR) || !(s.fi > 0) || !(s.nfi > 0)) return null;
  const hiNfi = s.nplNfiR >= s.nplFiR;
  const [hiR, loR] = hiNfi ? [s.nplNfiR, s.nplFiR] : [s.nplFiR, s.nplNfiR];
  if (hiR - loR < 0.003) return null;
  const nfiShare = s.nfi / (s.fi + s.nfi);
  const nplNfiShare = s.nplNfi / (s.nplFi + s.nplNfi);
  const excess = hiNfi ? s.nplNfi - s.nfi * s.nplFiR : s.nplFi - s.fi * s.nplNfiR;
  return make({
    kind: 'income', tone: 'risk', impact: (excess * PF_UNIT) / 1e9,
    headline: `Debitur ${hiNfi ? 'non fixed income (NFI)' : 'fixed income (FI)'} ${fs.label} ${b(`${num(hiR / loR, 1)} kali`)} lebih berisiko: %NPL ${b(pct(hiR))} dibanding ${pct(loR)}.`,
    evidence: [`Porsi OS NFI ${pct(nfiShare, 1)}, porsi NPL NFI ${pct(nplNfiShare, 1)} (${monthYear(fs.bulan)}).`],
    implication: `Selisih profil risiko ini setara NPL ${rp(excess * PF_UNIT)} di atas yang terjadi bila %NPL kedua kelompok sama.`,
    focus: { view: 'portofolio', widget: 'fi' },
  });
}

function segmentInsight(fs) {
  const prev = prevMonth(fs.bulan);
  if (!fs.pf.index.months.includes(prev)) return null;
  const trend = fs.pf.trend.filter((r) => r.m === 'os' && (!fs.ro || r.ro === fs.ro));
  const at = (m) => trend.filter((r) => r.bulan === m);
  const cur = at(fs.bulan);
  const old = at(prev);
  if (!cur.length || !old.length || fs.kanca) return null;
  const rows = PORTFOLIO_NODES.map((n) => {
    const c = pfSums(cur, fs.L, n.filter);
    const o = pfSums(old, fs.L, n.filter);
    return { n, r: c.nplR, d: ok(c.nplR) && ok(o.nplR) ? c.nplR - o.nplR : null, dn: c.npl - o.npl, base: c.base };
  }).filter((x) => ok(x.d) && x.base > 0);
  const all = rows.find((x) => x.n.id === 'all');
  const segs = rows.filter((x) => x.n.id !== 'all').sort((a, c) => c.d - a.d);
  if (!all || !segs.length) return null;
  const worst = segs[0];
  const best = segs.at(-1);
  const top = [...segs].sort((a, c) => c.r - a.r)[0];
  return make({
    kind: 'segment', tone: all.d > 0.0005 ? 'risk' : all.d < -0.0005 ? 'positive' : 'neutral', impact: Math.abs(all.dn * PF_UNIT) / 1e9 * 1.5,
    headline: `%NPL portofolio ${fs.label} ${pct(all.r)} pada ${monthYear(fs.bulan)} (${bpsSigned(all.d)} dari ${monthName(prev)}); kenaikan terbesar di segmen ${b(raw(worst.n.label))} (${bpsSigned(worst.d)}).`,
    evidence: [
      `%NPL tertinggi di segmen ${raw(top.n.label)} ${pct(top.r)}.`,
      best.d < 0 ? `Perbaikan terbesar di segmen ${raw(best.n.label)} (${bpsSigned(best.d)}).` : `Tidak ada segmen yang membaik bulan ini.`,
    ],
    focus: { view: 'portofolio', widget: 'qtrend' },
  });
}

function pfMoveInsight(fs) {
  if (fs.kanca) return null;
  const prev = prevMonth(fs.bulan);
  if (!fs.pf.index.months.includes(prev)) return null;
  const trend = fs.pf.trend.filter((r) => r.m === 'os' && (!fs.ro || r.ro === fs.ro));
  const cur = trend.filter((r) => r.bulan === fs.bulan);
  const old = trend.filter((r) => r.bulan === prev);
  const a = pfSums(cur, fs.L);
  const o = pfSums(old, fs.L);
  if (!(a.base > 0) || !(o.base > 0)) return null;
  const d = a.base - o.base;
  const parts = PORTFOLIO_NODES.filter((n) => n.parent === 'all').map((n) => {
    const c = pfSums(cur, fs.L, n.filter);
    const p = pfSums(old, fs.L, n.filter);
    return { n, d: c.base - p.base, share: c.base / a.base };
  });
  const evidence = parts.map((x) => `${raw(x.n.label)} ${rpSignedPf(x.d)} (porsi OS ${pct(x.share, 1)}).`);
  if (!fs.ro) {
    const byRo = [...pfGroup(cur, fs.L, 'ro')].map(([k, v]) => ({ k, os: v.base, npl: v.npl })).filter((x) => x.os > 0);
    const totNpl = sum(byRo.map((x) => x.npl));
    const top = [...byRo].sort((x, y) => y.npl - x.npl).slice(0, 3);
    if (top.length === 3 && totNpl > 0) {
      evidence.push(`3 RO dengan NPL terbesar (${listJoin(top.map((x) => nm(x.k)))}) memegang ${pct(sum(top.map((x) => x.os)) / a.base, 1)} OS dan ${pct(sum(top.map((x) => x.npl)) / totNpl, 1)} NPL.`);
    }
  }
  const lead = [...parts].sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
  return make({
    kind: 'portfolio', tone: d >= 0 ? 'positive' : 'negative', impact: Math.abs(d * PF_UNIT) / 1e9 * 0.6,
    headline: `OS portofolio ${fs.label} ${d >= 0 ? 'tumbuh' : 'turun'} ${b(rp(Math.abs(d) * PF_UNIT))} pada ${monthYear(fs.bulan)} (${signedPct(d / o.base, 2)} dari ${monthName(prev)}), terutama dari segmen ${raw(lead.n.label)}.`,
    evidence, focus: { view: 'portofolio', widget: 'trend' },
  });
}

const rpSignedPf = (v) => (ok(v) ? `${v > 0 ? '+' : ''}${rp(v * PF_UNIT)}` : '–');

const SOURCES = {
  performance: (d, sc) => {
    const ps = perfScope(d.pm, sc);
    if (!ps) return [];
    const early = !ps.slice.full && ok(ps.wd) && ps.wd < 5;
    if (!early) return [growthInsight(ps), ...paceInsights(ps), spreadInsight(ps), qualityInsight(ps), matrixInsight(ps), productivityInsight(ps)];
    const prev = prevMonth(ps.bulan);
    const pc = d.pm.months.includes(prev) ? perfScope(d.pm, { ro: sc.ro, bulan: prev }) : null;
    const close = pc && pc.slice.full ? [growthInsight(pc), ...paceInsights(pc), spreadInsight(pc), qualityInsight(pc), matrixInsight(pc)] : [];
    return [...close.filter(Boolean).map((x) => ({ ...x, period: 'close', closeMonth: prev, liveDays: ps.wd })), qualityInsight(ps)];
  },
  realisasi: (d, sc) => {
    const rs = realScope(d.real, sc);
    if (!rs) return [];
    const k = workdaysOf(rs.bulan, rs.lastDay).length;
    if (rs.full || k >= 5) return [volumeInsight(rs), realProjectionInsight(rs), mixInsight(rs), relianceInsight(rs), anomalyInsight(rs)];
    const rc = rs.real.months.includes(rs.prev) ? realScope(d.real, { ...sc, bulan: rs.prev }) : null;
    const close = rc ? [volumeInsight(rc), mixInsight(rc), relianceInsight(rc)].filter(Boolean).map((x) => ({ ...x, period: 'close', closeMonth: rs.prev, liveDays: k })) : [];
    return [...close, volumeInsight(rs), anomalyInsight(rs)];
  },
  portofolio: (d, sc) => {
    const fs = pfScope(d.pf, sc);
    if (!fs) return [];
    return [hotspotInsight(fs), incomeInsight(fs), segmentInsight(fs), pfMoveInsight(fs)];
  },
};

export function buildInsights(data, scope = {}, { sources = ['performance', 'realisasi', 'portofolio'], limit = 0, perKind = 2 } = {}) {
  const list = [];
  for (const key of sources) {
    const src = SOURCES[key];
    if (!src) continue;
    const sub = scope[key] || scope;
    let items = [];
    try { items = src(data, sub) || []; } catch (err) { console.warn(err); }
    for (const it of items) if (it) list.push({ ...it, source: key });
  }
  for (const it of list) it.score = (it.impact || 0) * (WEIGHT[it.kind] || 1) * (it.tone === 'neutral' ? 0.7 : 1) * (it.confidence === 'rendah' ? 0.6 : 1);
  list.sort((a, c) => c.score - a.score);
  const count = new Map();
  const out = [];
  for (const it of list) {
    const n = count.get(it.kind) || 0;
    if (n >= perKind) continue;
    count.set(it.kind, n + 1);
    out.push(it);
    if (limit && out.length >= limit) break;
  }
  return out;
}

export function insightText(it) {
  const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return [strip(it.headline), ...it.evidence.map(strip), it.implication ? `Implikasi: ${strip(it.implication)}` : ''].filter(Boolean).join(' ');
}


export {
  growthInsight, paceInsights, spreadInsight, qualityInsight, matrixInsight, productivityInsight,
  realScope, volumeInsight, realProjectionInsight, mixInsight, relianceInsight, anomalyInsight,
  pfScope, hotspotInsight, incomeInsight, segmentInsight, pfMoveInsight,
};
