import { ok, ratio } from '../core/values.js';
import { daysInMonth, shiftMonth, weekday } from '../core/dates.js';
import { isHoliday, holidaysListed } from '../core/holidays.js';
import { NASIONAL, dayOf, monthSlice, workdayIndex } from '../models/performance-model.js';
import { median, PERF_UNIT, REAL_UNIT } from './wording.js';

const DAMP = 0.8;
const SPREAD_MIN = 0.02;
const TREND_CAP = 0.04;
const SEASON_SHRINK = 0.5;
const SEASON_CAP = 0.15;
const HISTORY = 6;
const GROWTH_RANGE = [-0.2, 0.5];

const pad = (n) => String(n).padStart(2, '0');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const runoffOf = (r) => (ok(r?.disburse) && ok(r?.gr_os) ? r.disburse - r.gr_os : null);
const okList = (list) => list.filter(ok);
const mmOf = (m) => Number(m.slice(5, 7));
const yearOf = (m) => Number(m.slice(0, 4));
const monthsBetween = (a, b) => (yearOf(b) - yearOf(a)) * 12 + mmOf(b) - mmOf(a);
const sum = (list) => list.reduce((a, b) => a + b, 0);

export function workdaysIn(month) {
  let n = 0;
  for (let d = 1; d <= daysInMonth(month); d += 1) {
    const iso = `${month}-${pad(d)}`;
    if (weekday(iso) < 5 && !isHoliday(iso)) n += 1;
  }
  return n;
}

export const holidayBasis = (month) => (holidaysListed(yearOf(month)) ? 'skb' : 'fixed');

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

function theilSen(ys) {
  const n = ys.length;
  if (n < 2) return { slope: 0, level: n ? ys[0] : null };
  const slopes = [];
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) slopes.push((ys[j] - ys[i]) / (j - i));
  const slope = median(slopes);
  return { slope, level: median(ys.map((y, i) => y + slope * (n - 1 - i))) };
}

const sorted = (list, desc) => [...list].sort((a, b) => (desc ? b - a : a - b));
const robustHigh = (list) => sorted(list, true)[list.length >= 4 ? 1 : 0];
const robustLow = (list) => sorted(list, false)[list.length >= 4 ? 1 : 0];

function dampSum(h) {
  let g = 0;
  let d = 1;
  for (let i = 1; i <= h; i += 1) { d *= DAMP; g += d; }
  return g;
}

const seasonCache = new WeakMap();
function seasonOf(pm) {
  if (seasonCache.has(pm)) return seasonCache.get(pm);
  const f = new Array(13).fill(1);
  const series = pm.hasNasional
    ? monthStats(pm.byRo.get(NASIONAL) || []).filter((s) => s.complete && ok(s.rate) && s.rate > 0)
    : [];
  let used = false;
  if (series.length >= 9) {
    const { slope, level } = theilSen(series.map((s) => s.rate));
    const n = series.length;
    const acc = new Array(13).fill(0);
    const cnt = new Array(13).fill(0);
    series.forEach((s, i) => {
      const fit = level - slope * (n - 1 - i);
      if (!(fit > 0)) return;
      acc[mmOf(s.month)] += s.rate / fit;
      cnt[mmOf(s.month)] += 1;
    });
    for (let mm = 1; mm <= 12; mm += 1) {
      if (cnt[mm]) f[mm] = clamp(1 + SEASON_SHRINK * (acc[mm] / cnt[mm] - 1), 1 - SEASON_CAP, 1 + SEASON_CAP);
    }
    const mean = sum(f.slice(1)) / 12;
    for (let mm = 1; mm <= 12; mm += 1) f[mm] /= mean;
    used = true;
  }
  const out = { f, used, months: series.map((s) => s.month) };
  seasonCache.set(pm, out);
  return out;
}

function capability(done, season) {
  const hist = done.slice(-HISTORY).filter((s) => ok(s.rate) && s.rate > 0);
  if (hist.length < 2) return null;
  const ys = hist.map((s) => s.rate / season.f[mmOf(s.month)]);
  const n = ys.length;
  const fit = n >= 3 ? theilSen(ys) : { slope: 0, level: median(ys) };
  const level = fit.level > 0 ? fit.level : median(ys);
  const slope = fit.level > 0 ? fit.slope : 0;
  const rel = n >= 4 && level > 0 ? clamp(slope / level, -TREND_CAP, TREND_CAP) : 0;
  const res = ys.map((y, i) => {
    const at = level - slope * (n - 1 - i);
    return at > 0 ? y / at - 1 : 0;
  });
  return {
    last: hist.at(-1).month, months: hist.map((s) => s.month), level, rel, n,
    up: Math.max(SPREAD_MIN, robustHigh(res)), down: Math.min(-SPREAD_MIN, robustLow(res)), best: robustHigh(ys),
  };
}

function ratesAt(cap, season, month) {
  const h = Math.max(1, monthsBetween(cap.last, month));
  const s = season.f[mmOf(month)];
  const trend = cap.level * (1 + cap.rel * dampSum(h));
  return { base: trend * s, high: Math.max(trend * (1 + cap.up), cap.best) * s, low: trend * (1 + cap.down) * s, season: s };
}

function workdaysAhead(pm, roKey, month) {
  const rows = (pm.future?.get(roKey) || []).filter((r) => r.tanggal.startsWith(month) && ok(r.hari_kerja) && r.hari_kerja > 0);
  const v = rows.length ? Math.max(...rows.map((r) => r.hari_kerja)) : null;
  return { wd: ok(v) ? v : workdaysIn(month), fromData: ok(v) };
}

function rkaOf(pm, roKey, stats, month) {
  const fut = (pm.future?.get(roKey) || []).filter((r) => r.tanggal.startsWith(month) && ok(r.rka_os));
  if (fut.length) return fut.at(-1).rka_os;
  const s = stats.find((x) => x.month === month);
  return s && ok(s.rka) ? s.rka : null;
}

function latestRka(pm, roKey, stats, year) {
  const pool = [...stats.map((s) => ({ month: s.month, v: s.rka })), ...(pm.future?.get(roKey) || []).map((r) => ({ month: r.tanggal.slice(0, 7), v: r.rka_os }))]
    .filter((x) => yearOf(x.month) === year && ok(x.v) && x.v > 0);
  return pool.length ? pool.reduce((a, b) => (b.month >= a.month ? b : a)) : null;
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

export const tierOf = (need, base, high) => (!ok(need) || !ok(base) ? 'none' : need <= base ? 'base' : ok(high) && need <= high * 1.000001 ? 'stretch' : 'beyond');
const tierOfLift = (lift, capLift) => (!ok(lift) ? 'none' : lift <= 0 ? 'base' : lift <= capLift + 1e-9 ? 'stretch' : 'beyond');

function planYear(ctx, yearTarget) {
  const { pm, roKey, stats, done, cur, close, cap, season, runRate, runBest } = ctx;
  const curYear = yearOf(cur.month);
  const year = mmOf(cur.month) >= 7 ? curYear + 1 : curYear;
  const end = `${year}-12`;
  const months = [];
  for (let m = shiftMonth(cur.month, 1); m <= end; m = shiftMonth(m, 1)) months.push(m);
  if (!months.length) return null;
  const wdInfo = months.map((m) => workdaysAhead(pm, roKey, m));
  const rates = months.map((m) => ratesAt(cap, season, m));
  const inPlan = months.map((m) => yearOf(m) === year);
  const planCount = inPlan.filter(Boolean).length;
  if (!planCount) return null;

  const run = (lift, { rateKey = 'base', planRun = runRate } = {}) => {
    let os = close.os;
    let disb = 0;
    let runoff = 0;
    const path = months.map((m, i) => {
      const plan = inPlan[i];
      const d = (plan ? rates[i][rateKey] : rates[i].base) * wdInfo[i].wd * (plan ? 1 + lift : 1);
      const r = (plan ? planRun : runRate) * os;
      os = os + d - r;
      if (plan) { disb += d; runoff += r; }
      return { month: m, wd: wdInfo[i].wd, disb: d, runoff: r, os, plan, season: rates[i].season };
    });
    return { path, os, disb, runoff };
  };

  const base = run(0);
  const slope = run(1).os - base.os;
  const capRun = run(0, { rateKey: 'high' });
  const lowRun = run(0, { rateKey: 'low' });
  const startIdx = inPlan.indexOf(true);
  const startOs = startIdx > 0 ? base.path[startIdx - 1].os : close.os;
  const startMonth = startIdx > 0 ? base.path[startIdx - 1].month : cur.month;

  const first = stats.find((s) => yearOf(s.month) === curYear);
  const osYearStart = first && mmOf(first.month) === 1 && ok(first.osStart) && first.osStart > 0 ? first.osStart : null;
  const rkaDec = rkaOf(pm, roKey, stats, `${curYear}-12`);
  let target = null;
  let source = 'none';
  let growthRef = null;
  if (ok(yearTarget) && yearTarget > 0) {
    target = yearTarget;
    source = 'input';
  } else if (year === curYear && ok(rkaDec)) {
    target = rkaDec;
    source = 'rka';
  } else if (ok(osYearStart)) {
    let g = null;
    if (ok(rkaDec)) {
      g = rkaDec / osYearStart - 1;
      source = 'rka-growth';
    } else {
      const last = latestRka(pm, roKey, stats, curYear);
      if (last && mmOf(last.month) >= 3) {
        g = (last.v / osYearStart) ** (12 / mmOf(last.month)) - 1;
        source = 'rka-trend';
      } else {
        const k = done.filter((s) => yearOf(s.month) === curYear).length;
        const lastDone = done.at(-1);
        if (k >= 3 && ok(lastDone?.os)) {
          g = (lastDone.os / osYearStart) ** (12 / k) - 1;
          source = 'trend';
        }
      }
    }
    if (ok(g)) {
      growthRef = clamp(g, ...GROWTH_RANGE);
      target = (year === curYear ? osYearStart : startOs) * (1 + growthRef);
    }
  }

  const lift = ok(target) && slope > 0 ? (target - base.os) / slope : null;
  const capLift = slope > 0 ? Math.max(0, (capRun.os - base.os) / slope) : 0;
  const need = ok(lift) ? run(lift) : null;
  const best = run(0, { planRun: runBest });
  const slopeBest = run(1, { planRun: runBest }).os - best.os;
  const liftBest = ok(target) && slopeBest > 0 && ok(runBest) && runBest < runRate * 0.97 ? (target - best.os) / slopeBest : null;

  const planPath = (p) => p.path.filter((x) => x.plan);
  const wdPlan = sum(planPath(base).map((x) => x.wd));
  const rm = ok(cur.end.jum_rm) && cur.end.jum_rm > 0 ? cur.end.jum_rm : null;
  const prodHist = done.slice(-HISTORY).map((s) => (s.rm > 0 && ok(s.disb) && s.wd > 0 ? s.disb / s.rm / s.wd : null)).filter(ok);
  const prodCap = prodHist.length >= 2 ? robustHigh(prodHist) : null;
  const needDisb = need ? need.disb : null;
  const rmNeed = ok(needDisb) && prodCap > 0 && wdPlan > 0 ? Math.ceil(needDisb / (prodCap * wdPlan)) : null;

  const ratios = done.slice(-HISTORY).map((s) => ratio(s.npl, s.os)).filter(ok);
  const ntrend = ratios.length >= 3 ? theilSen(ratios) : null;
  const nplNow = ratio(cur.end.npl, cur.os);
  const nplEnd = ntrend && ok(nplNow) ? Math.max(0, nplNow + ntrend.slope * dampSum(monthsBetween(cur.month, end))) : null;

  const seasonal = season.used ? months.filter((_, i) => inPlan[i]).map((m) => ({ month: m, f: season.f[mmOf(m)] })) : null;

  return {
    year, end, months, planCount, startMonth, startOs, target, targetSource: source, growthRef,
    growth: ok(target) && startOs > 0 ? target / startOs - 1 : null,
    base: { os: base.os, disb: base.disb, runoff: base.runoff, path: base.path },
    cap: { os: capRun.os, disb: capRun.disb, path: capRun.path },
    low: { os: lowRun.os, disb: lowRun.disb, path: lowRun.path },
    need: need ? { os: need.os, disb: need.disb, runoff: need.runoff, path: need.path } : null,
    lift, capLift, slope, tier: tierOfLift(lift, capLift), ach: ratio(base.os, target), achCap: ratio(capRun.os, target),
    runRate, runBest, liftBest,
    rm, wdPlan, prodCap, rmNeed, rmGap: ok(rmNeed) && rm ? rmNeed - rm : null,
    perRm: ok(needDisb) && rm ? needDisb / planCount / rm : null, basePerRm: rm ? base.disb / planCount / rm : null,
    npl: { now: nplNow, end: nplEnd, slope: ntrend?.slope ?? null, target: ratio(cur.rkaNpl, cur.rka) },
    seasonal, wdBasis: wdInfo.some((w) => w.fromData) ? 'data' : holidayBasis(end),
  };
}

export function splitYear(year, regions) {
  if (!year || !ok(year.target)) return null;
  const rows = regions.filter((r) => r.year && ok(r.year.base) && ok(r.year.cap));
  if (!rows.length) return null;
  const rawBase = sum(rows.map((r) => r.year.base));
  const scale = rawBase > 0 && year.base.os > 0 ? year.base.os / rawBase : 1;
  const heads = rows.map((r) => Math.max(0, r.year.cap - r.year.base) * scale);
  const room = sum(heads);
  const gap = year.target - year.base.os;
  const k = gap <= 0 || room <= 0 ? 0 : Math.min(1, gap / room);
  return {
    gap, room, k, sumBase: year.base.os, sumCap: year.base.os + room, uncovered: Math.max(0, gap - room),
    rows: rows.map((r, i) => {
      const add = heads[i] * k;
      const lift = r.year.slope > 0 ? add / scale / r.year.slope : 0;
      return { ro: r.ro, base: r.year.base, cap: r.year.cap, room: heads[i], add, os: r.year.base + add, disb: r.year.disb * (1 + lift), lift, share: gap > 0 ? add / gap : 0 };
    }).sort((a, b) => b.add - a.add || b.room - a.room),
  };
}

export function outlook(pm, { ro = '', real = null, target = null, yearTarget = null, perRo = true } = {}) {
  if (!pm) return null;
  const roKey = ro && pm.byRo.has(ro) ? ro : (pm.hasNasional ? NASIONAL : null);
  if (!roKey) return null;
  const stats = monthStats(pm.byRo.get(roKey) || []);
  const cur = stats.at(-1);
  if (!cur || !ok(cur.os) || !ok(cur.osStart)) return null;
  const done = stats.filter((s) => s.complete && s.month !== cur.month);
  const base = done.slice(-3);
  if (base.length < 2) return null;
  const season = seasonOf(pm);
  const cap = capability(cur.complete ? stats.filter((s) => s.complete) : done, season);
  if (!cap) return null;

  const runRate = median(okList(base.map((s) => s.runoffRate)));
  const runRecent = okList(done.slice(-HISTORY).map((s) => s.runoffRate));
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
  if (!ok(runRate)) return null;

  const curRates = ratesAt(cap, season, cur.month);
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
    const typical = curRates.base * wdTot;
    const disb = wdNow >= 8 && shareD > 0.2 ? cur.disb / shareD : cur.disb + typical * (1 - (ok(shareD) ? shareD : wdNow / wdTot));
    const runoff = (cur.runoff ?? 0) + runRate * cur.osStart * (1 - (ok(shareR) ? shareR : wdNow / wdTot));
    close = { os: cur.osStart + disb - runoff, disb, runoff, method: wdNow >= 8 && shareD > 0.2 ? 'pace' : 'rate', shareD, shareR };
  }

  const month = shiftMonth(cur.month, 1);
  const ahead = (pm.future?.get(roKey) || []).filter((r) => r.tanggal.startsWith(month));
  const aheadRka = ahead.filter((r) => ok(r.rka_os)).at(-1)?.rka_os ?? null;
  const wdInfo = workdaysAhead(pm, roKey, month);
  const wdN = wdInfo.wd;
  const nr = ratesAt(cap, season, month);
  const rate = nr.base;
  const baseDisb = rate * wdN;
  const capDisb = nr.high * wdN;
  const lowDisb = nr.low * wdN;
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
    month, wd: wdN, wdFromData: wdInfo.fromData, wdBasis: wdInfo.fromData ? 'data' : holidayBasis(month),
    baseDisb, baseRun, baseOs, target: targetN, estTarget, targetSource, targetGiven: targetSource !== 'estimate',
    capDisb, lowDisb, capOs: close.os + capDisb - baseRun, lowOs: close.os + lowDisb - baseRun, liftCap: capDisb / baseDisb - 1,
    tier: tierOf(needDisb, baseDisb, capDisb), season: nr.season,
    needDisb, lift: ok(needDisb) ? needDisb / baseDisb - 1 : null,
    needDisbBest, liftBest: ok(needDisbBest) ? needDisbBest / baseDisb - 1 : null,
    perWd: ok(needDisb) ? needDisb / wdN : null, rate,
    rm, perRm: ok(needDisb) && rm ? needDisb / rm : null, basePerRm: rm ? baseDisb / rm : null, prodRm,
    ticket, needDeb: ok(needDisb) && ticket ? (needDisb * PERF_UNIT) / ticket : null, baseDeb: ticket ? (baseDisb * PERF_UNIT) / ticket : null,
    achBase: ratio(baseOs, targetN), achCap: ratio(close.os + capDisb - baseRun, targetN),
    npl: {
      now: nplNow, trend: dNpl, months, base: nplBase, ratioNow, ratioBase: ratio(nplBase, baseOs), ratioTarget,
      ceilTarget: ok(ratioTarget) ? ratioTarget * baseOs : null, ceilKeep: ok(ratioNow) ? ratioNow * baseOs : null,
    },
  };

  const current = cur.complete ? null : (() => {
    const needGrowth = ok(cur.rka) ? cur.rka - cur.os : null;
    const remRun = close.runoff - (cur.runoff ?? 0);
    const remDisb = close.disb - cur.disb;
    const capRem = remDisb > 0 ? remDisb * (curRates.high / curRates.base) : remDisb;
    const needRem = ok(needGrowth) ? needGrowth + remRun : null;
    const needGuid = ok(cur.guidance) ? cur.guidance - cur.disb : null;
    return {
      month: cur.month, wdNow, wdTot, remWd, target: cur.rka, os: cur.os, disb: cur.disb, guidance: cur.guidance,
      closeOs: close.os, closeDisb: close.disb, ach: ratio(close.os, cur.rka), achDisb: ratio(close.disb, cur.guidance),
      remDisb, remRun, needRem, capRem, tier: tierOf(needRem, remDisb, capRem),
      lift: ok(needRem) && remDisb > 0 ? needRem / remDisb - 1 : null,
      perWd: ok(needRem) && remWd ? needRem / remWd : null, ratePerWd: remWd ? remDisb / remWd : null,
      needGuid, liftGuid: ok(needGuid) && remDisb > 0 ? needGuid / remDisb - 1 : null,
      npl: { now: nplNow, target: cur.rkaNpl, room: ok(cur.rkaNpl) && ok(nplNow) ? cur.rkaNpl - nplNow : null },
    };
  })();

  const year = planYear({ pm, roKey, stats, done, cur, close, cap, season, runRate, runBest }, yearTarget);

  const out = {
    roKey, national: roKey === NASIONAL, cur, close, base: cap.months, next, current, year,
    runRate, runBest, dRka, trend: cap.rel, seasonUsed: season.used, seasonMonths: season.months,
  };
  if (perRo && roKey === NASIONAL) {
    out.regions = pm.regions.map((r) => {
      const o = outlook(pm, { ro: r, real, perRo: false });
      if (!o) return null;
      return {
        ro: r, baseDisb: o.next.baseDisb, capDisb: o.next.capDisb, needDisb: o.next.needDisb, lift: o.next.lift, tier: o.next.tier,
        achBase: o.next.achBase, target: o.next.target, trend: o.trend,
        cur: o.current ? { needRem: o.current.needRem, remDisb: o.current.remDisb, capRem: o.current.capRem, lift: o.current.lift, ach: o.current.ach, tier: o.current.tier } : null,
        year: o.year ? {
          base: o.year.base.os, cap: o.year.cap.os, target: o.year.target, lift: o.year.lift, tier: o.year.tier, slope: o.year.slope,
          disb: o.year.base.disb, needDisb: o.year.need?.disb ?? null, planCount: o.year.planCount,
        } : null,
      };
    }).filter(Boolean);
    if (out.year) out.year.split = splitYear(out.year, out.regions);
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

export function simulateYear(o, lift) {
  const y = o.year;
  const os = y.base.os + lift * y.slope;
  return { disb: y.base.disb * (1 + lift), os, growth: os - y.startOs, ach: ratio(os, y.target), gap: ok(y.target) ? os - y.target : null };
}
