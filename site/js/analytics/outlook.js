import { ok, ratio } from '../core/values.js';
import { daysInMonth, shiftMonth, weekday } from '../core/dates.js';
import { NASIONAL, dayOf, monthSlice, workdayIndex } from '../models/performance-model.js';
import { median, PERF_UNIT, REAL_UNIT } from './wording.js';

const FIXED_HOLIDAYS = new Set(['01-01', '05-01', '06-01', '08-17', '12-25']);
const pad = (n) => String(n).padStart(2, '0');
const runoffOf = (r) => (ok(r?.disburse) && ok(r?.gr_os) ? r.disburse - r.gr_os : null);
const okList = (list) => list.filter(ok);

export function workdaysIn(month) {
  let n = 0;
  for (let d = 1; d <= daysInMonth(month); d += 1) {
    const iso = `${month}-${pad(d)}`;
    if (weekday(iso) < 5 && !FIXED_HOLIDAYS.has(iso.slice(5))) n += 1;
  }
  return n;
}

function monthStats(rows) {
  const by = new Map();
  for (const r of rows) {
    const m = r.tanggal.slice(0, 7);
    if (!by.has(m)) by.set(m, []);
    by.get(m).push(r);
  }
  return [...by.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([month, list]) => {
    const end = list.at(-1);
    const osStart = ok(end.helper_os) ? end.helper_os : null;
    const runoff = runoffOf(end);
    return {
      month, rows: list, end, complete: dayOf(end.tanggal) === daysInMonth(month), osStart, os: end.os,
      disb: end.disburse, runoff, runoffRate: ratio(runoff, osStart), wd: end.hari_kerja, rate: ratio(end.disburse, end.hari_kerja),
      npl: end.npl, nplStart: end.helper_npl, rka: end.rka_os, rkaNpl: end.rka_npl, rm: end.jum_rm, guidance: end.guidance_disb,
    };
  });
}

function shareAt(list, wdNow, get) {
  const shares = [];
  for (const s of list) {
    const total = get(s.end);
    if (!ok(total) || total <= 0) continue;
    let at = null;
    for (const r of s.rows) if (ok(r.hari_kerja) && r.hari_kerja <= wdNow) at = r;
    const v = at ? get(at) : 0;
    if (ok(v)) shares.push(Math.min(1, Math.max(0, v / total)));
  }
  return shares.length >= 2 ? median(shares) : null;
}

function ticketOf(real, ro, months) {
  if (!real?.rows?.length) return null;
  const set = new Set(months);
  let plafond = 0;
  let debitur = 0;
  for (const r of real.rows) {
    if (!set.has(r.bulan) || (ro && r.ro !== ro)) continue;
    plafond += ok(r.plafond) ? r.plafond : 0;
    debitur += ok(r.debitur) ? r.debitur : 0;
  }
  return debitur > 0 ? (plafond * REAL_UNIT) / debitur : null;
}

export function outlook(pm, { ro = '', real = null, target = null, perRo = true } = {}) {
  if (!pm) return null;
  const roKey = ro && pm.byRo.has(ro) ? ro : (pm.hasNasional ? NASIONAL : null);
  if (!roKey) return null;
  const stats = monthStats(pm.byRo.get(roKey) || []);
  const cur = stats.at(-1);
  if (!cur || !ok(cur.os) || !ok(cur.osStart)) return null;
  const done = stats.filter((s) => s.complete && s.month !== cur.month);
  const base = done.slice(-3);
  if (base.length < 2) return null;

  const rate = median(okList(base.map((s) => s.rate)));
  const runRate = median(okList(base.map((s) => s.runoffRate)));
  const runRecent = okList(done.slice(-6).map((s) => s.runoffRate));
  const runBest = runRecent.length ? Math.min(...runRecent) : runRate;
  const dNpl = median(okList(base.map((s) => (ok(s.npl) && ok(s.nplStart) ? s.npl - s.nplStart : null))));
  const rkaSteps = [];
  for (let i = Math.max(1, stats.length - 3); i < stats.length; i += 1) {
    const a = stats[i - 1].rka;
    const b = stats[i].rka;
    if (ok(a) && ok(b)) rkaSteps.push(b - a);
  }
  const dRka = rkaSteps.length ? median(rkaSteps) : null;
  const prodRm = median(okList(base.map((s) => ratio(s.disb, s.rm))));
  if (!ok(rate) || !ok(runRate)) return null;

  const slice = monthSlice(pm.byRo.get(roKey), cur.month);
  const wdTot = cur.complete ? cur.wd : workdayIndex(slice).at(-1);
  const wdNow = cur.end.hari_kerja;
  const remWd = cur.complete ? 0 : Math.max(0, wdTot - wdNow);
  let close;
  if (cur.complete) {
    close = { os: cur.os, disb: cur.disb, runoff: cur.runoff, method: 'actual' };
  } else {
    const shareD = shareAt(base, wdNow, (r) => r.disburse);
    const shareR = shareAt(base, wdNow, runoffOf);
    const typical = rate * wdTot;
    const disb = wdNow >= 8 && shareD > 0.2 ? cur.disb / shareD : cur.disb + typical * (1 - (ok(shareD) ? shareD : wdNow / wdTot));
    const runoff = (cur.runoff ?? 0) + runRate * cur.osStart * (1 - (ok(shareR) ? shareR : wdNow / wdTot));
    close = { os: cur.osStart + disb - runoff, disb, runoff, method: wdNow >= 8 && shareD > 0.2 ? 'pace' : 'rate', shareD, shareR };
  }

  const month = shiftMonth(cur.month, 1);
  const ahead = (pm.future?.get(roKey) || []).filter((r) => r.tanggal.startsWith(month));
  const aheadRka = ahead.filter((r) => ok(r.rka_os)).at(-1)?.rka_os ?? null;
  const aheadWd = ahead.filter((r) => ok(r.hari_kerja) && r.hari_kerja > 0).at(-1)?.hari_kerja ?? null;
  const wdN = aheadWd ?? workdaysIn(month);
  const baseDisb = rate * wdN;
  const baseRun = runRate * close.os;
  const baseOs = close.os + baseDisb - baseRun;
  const estTarget = ok(dRka) && ok(cur.rka) ? cur.rka + dRka : null;
  const targetSource = ok(target) ? 'input' : ok(aheadRka) ? 'rka' : 'estimate';
  const targetN = ok(target) ? target : ok(aheadRka) ? aheadRka : estTarget;
  const needDisb = ok(targetN) ? targetN - close.os + baseRun : null;
  const needDisbBest = ok(targetN) ? targetN - close.os + runBest * close.os : null;
  const rm = cur.end.jum_rm;
  const ticket = ticketOf(real, roKey === NASIONAL ? '' : roKey, done.slice(-3).map((s) => s.month));
  const months = (cur.complete ? 0 : remWd / wdTot) + 1;
  const nplNow = cur.end.npl;
  const nplBase = ok(nplNow) && ok(dNpl) ? nplNow + dNpl * months : null;
  const ratioNow = ratio(nplNow, cur.os);
  const ratioTarget = ratio(cur.rkaNpl, cur.rka);

  const next = {
    month, wd: wdN, wdFromData: ok(aheadWd), baseDisb, baseRun, baseOs, target: targetN, estTarget, targetSource, targetGiven: targetSource !== 'estimate',
    needDisb, lift: ok(needDisb) ? needDisb / baseDisb - 1 : null,
    needDisbBest, liftBest: ok(needDisbBest) ? needDisbBest / baseDisb - 1 : null,
    perWd: ok(needDisb) ? needDisb / wdN : null, rate,
    rm, perRm: ok(needDisb) && rm ? needDisb / rm : null, basePerRm: rm ? baseDisb / rm : null, prodRm,
    ticket, needDeb: ok(needDisb) && ticket ? (needDisb * PERF_UNIT) / ticket : null, baseDeb: ticket ? (baseDisb * PERF_UNIT) / ticket : null,
    achBase: ratio(baseOs, targetN),
    npl: {
      now: nplNow, trend: dNpl, months, base: nplBase, ratioNow, ratioBase: ratio(nplBase, baseOs), ratioTarget,
      ceilTarget: ok(ratioTarget) ? ratioTarget * baseOs : null, ceilKeep: ok(ratioNow) ? ratioNow * baseOs : null,
    },
  };

  const current = cur.complete ? null : (() => {
    const needGrowth = ok(cur.rka) ? cur.rka - cur.os : null;
    const remRun = close.runoff - (cur.runoff ?? 0);
    const remDisb = close.disb - cur.disb;
    const needRem = ok(needGrowth) ? needGrowth + remRun : null;
    const needGuid = ok(cur.guidance) ? cur.guidance - cur.disb : null;
    return {
      month: cur.month, wdNow, wdTot, remWd, target: cur.rka, os: cur.os, disb: cur.disb, guidance: cur.guidance,
      closeOs: close.os, closeDisb: close.disb, ach: ratio(close.os, cur.rka), achDisb: ratio(close.disb, cur.guidance),
      remDisb, remRun, needRem, lift: ok(needRem) && remDisb > 0 ? needRem / remDisb - 1 : null,
      perWd: ok(needRem) && remWd ? needRem / remWd : null, ratePerWd: remWd ? remDisb / remWd : null,
      needGuid, liftGuid: ok(needGuid) && remDisb > 0 ? needGuid / remDisb - 1 : null,
      npl: { now: nplNow, target: cur.rkaNpl, room: ok(cur.rkaNpl) && ok(nplNow) ? cur.rkaNpl - nplNow : null },
    };
  })();

  const out = {
    roKey, national: roKey === NASIONAL, cur, close, base: base.map((s) => s.month), next, current,
    runRate, runBest, dRka,
  };
  if (perRo && roKey === NASIONAL) {
    out.regions = pm.regions.map((r) => {
      const o = outlook(pm, { ro: r, real, perRo: false });
      if (!o) return null;
      return {
        ro: r, baseDisb: o.next.baseDisb, needDisb: o.next.needDisb, lift: o.next.lift, achBase: o.next.achBase, target: o.next.target,
        cur: o.current ? { needRem: o.current.needRem, remDisb: o.current.remDisb, lift: o.current.lift, ach: o.current.ach } : null,
      };
    }).filter(Boolean);
  }
  return out;
}

export function simulate(o, lift) {
  const n = o.next;
  const disb = n.baseDisb * (1 + lift);
  const os = o.close.os + disb - n.baseRun;
  return { disb, os, growth: os - o.close.os, ach: ratio(os, n.target), gap: ok(n.target) ? os - n.target : null };
}

export function simulateCurrent(o, lift) {
  const c = o.current;
  const rem = c.remDisb * (1 + lift);
  const os = c.os + rem - c.remRun;
  return { disb: c.disb + rem, os, ach: ratio(os, c.target), achDisb: ratio(c.disb + rem, c.guidance), gap: ok(c.target) ? os - c.target : null };
}
